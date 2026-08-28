import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { authenticateUsername, createMessageRequest, createUsernameAccount, createSession, deleteMessage, editMessage, findUserBySession, getAllUsers, getConversationState, getMessageRequests, getMessagesForUser, getUsersForUser, respondToMessageRequest, saveMessage, setupDatabase, updateProfile } from './db.js'

const clients = new Map()
const colors = ['coral', 'blue', 'gold', 'lavender', 'mint']
const root = fileURLToPath(new URL('.', import.meta.url))
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  let body = ''
  for await (const chunk of request) body += chunk
  return JSON.parse(body)
}

const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ service: 'chaty', connected: clients.size }))
    return
  }
  if (request.method === 'POST' && ['/api/register', '/api/login'].includes(request.url)) {
    readJson(request).then(async (data) => {
      const username = typeof data.username === 'string' ? data.username.trim().toLowerCase().slice(0, 30) : ''
      const password = typeof data.password === 'string' ? data.password : ''
      if (!username || !password) return sendJson(response, 400, { error: 'Please complete all required fields.' })
      if (request.url === '/api/register' && password.length < 8) return sendJson(response, 400, { error: 'Password must be at least 8 characters.' })
      try {
        const user = request.url === '/api/register'
          ? await createUsernameAccount(username, password, colors[Math.floor(Math.random() * colors.length)])
          : await authenticateUsername(username, password)
        if (!user) return sendJson(response, 401, { error: 'Email or password is incorrect.' })
        return sendJson(response, 200, { user, token: await createSession(user.id) })
      } catch (error) {
        if (error.code === 11000 || error.message === 'Account already exists') return sendJson(response, 409, { error: 'That username is already taken. Choose another one or sign in.' })
        console.error('Authentication storage error:', error.message)
        return sendJson(response, 500, { error: error.message || 'Unable to create your account right now.' })
      }
    }).catch(() => sendJson(response, 400, { error: 'Invalid request.' }))
    return
  }
  if (request.method === 'POST' && request.url === '/api/profile') {
    readJson(request).then(async (data) => {
      const user = await findUserBySession(data.token)
      const name = typeof data.name === 'string' ? data.name.trim().slice(0, 30) : ''
      const currentPassword = typeof data.currentPassword === 'string' ? data.currentPassword : ''
      const newPassword = typeof data.newPassword === 'string' ? data.newPassword : ''
      if (!user || !name || !currentPassword) return sendJson(response, 400, { error: 'Name and current password are required.' })
      if (newPassword && newPassword.length < 8) return sendJson(response, 400, { error: 'New password must be at least 8 characters.' })
      try {
        const updatedUser = await updateProfile(user.id, currentPassword, name, newPassword)
        return sendJson(response, 200, { user: updatedUser })
      } catch (error) {
        return sendJson(response, 400, { error: error.message })
      }
    }).catch(() => sendJson(response, 400, { error: 'Invalid request.' }))
    return
  }
  const requestedPath = request.url === '/' ? '/index.html' : request.url.split('?')[0]
  const filePath = join(root, 'dist', requestedPath)
  const fallbackPath = join(root, 'dist', 'index.html')
  const pathToServe = existsSync(filePath) ? filePath : fallbackPath
  if (!existsSync(pathToServe)) {
    response.writeHead(404)
    response.end('Build the client with npm run build first.')
    return
  }
  const headers = { 'Content-Type': contentTypes[extname(pathToServe)] || 'application/octet-stream' }
  if (extname(pathToServe) === '.html') headers['Cache-Control'] = 'no-store'
  response.writeHead(200, headers)
  response.end(readFileSync(pathToServe))
})
const websocketServer = new WebSocketServer({ server: httpServer, path: '/ws' })

async function broadcastUsers() {
  const onlineIds = new Set([...clients.values()].map((user) => user.id))
  for (const [socket, user] of clients) {
    if (socket.readyState !== 1) continue
    const registeredUsers = await getUsersForUser(user.id)
    const users = registeredUsers.filter((person) => person.id !== user.id).map((person) => ({ ...person, online: onlineIds.has(person.id) }))
    socket.send(JSON.stringify({ type: 'users', users, selfId: user.id }))
  }
}

// Keep-alive heartbeat interval to prevent Render / proxies from dropping idle WebSockets
const heartbeatInterval = setInterval(() => {
  for (const socket of websocketServer.clients) {
    if (socket.isAlive === false) {
      clients.delete(socket)
      socket.terminate()
      continue
    }
    socket.isAlive = false
    socket.ping()
  }
}, 30000)

websocketServer.on('close', () => clearInterval(heartbeatInterval))

websocketServer.on('connection', (socket) => {
  socket.isAlive = true
  socket.on('pong', () => { socket.isAlive = true })

  socket.on('message', async (raw) => {
    let data
    try { data = JSON.parse(raw.toString()) } catch { return }

    if (data.type === 'ping') {
      socket.isAlive = true
      socket.send(JSON.stringify({ type: 'pong' }))
      return
    }

    if (data.type === 'identify' && typeof data.token === 'string') {
      const user = await findUserBySession(data.token)
      if (!user) return socket.send(JSON.stringify({ type: 'error', message: 'Your session has expired.' }))
      clients.set(socket, user)
      await broadcastUsers()
      const history = await getMessagesForUser(user.id)
      if (history.length) socket.send(JSON.stringify({ type: 'history', messages: history.map((message) => ({ ...message, from: message.from === user.id ? 'me' : message.from })) }))
      socket.send(JSON.stringify({ type: 'message-requests', requests: await getMessageRequests(user.id) }))
    }

    if (data.type === 'message' && typeof data.to === 'string') {
      const sender = clients.get(socket)
      if (!sender) return
      const textContent = typeof data.text === 'string' ? data.text.trim().slice(0, 2000) : ''
      const imageContent = typeof data.image === 'string' && data.image.startsWith('data:image/') ? data.image : null
      if (!textContent && !imageContent) return

      const recipient = [...clients.entries()].find(([, user]) => user.id === data.to)
      const state = await getConversationState(sender.id, data.to)
      if (state.status === 'pending' || state.status === 'deleted') {
        socket.send(JSON.stringify({ type: 'error', message: 'Your message request is waiting for a response.' }))
        return
      }

      const message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        from: sender.id,
        to: data.to,
        text: textContent,
        image: imageContent,
        time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })
      }

      const isNewConversation = !state.hasMessages
      const request = isNewConversation ? { requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, messageId: message.id, from: sender.id, to: data.to, status: 'pending' } : null

      socket.send(JSON.stringify({ type: 'message', message: { ...message, from: 'me' } }))
      if (recipient && recipient[0].readyState === 1) {
        recipient[0].send(JSON.stringify({ type: 'message', message }))
        if (request) recipient[0].send(JSON.stringify({ type: 'message-request', request }))
      }

      try {
        // Single persistent save (fixed duplicate saveMessage bug)
        await saveMessage(message)
        if (request) await createMessageRequest(request)
      } catch (error) {
        console.error('Message storage error:', error.message)
        socket.send(JSON.stringify({ type: 'error', message: 'Message delivered live but could not be saved.' }))
      }
    }

    if (data.type === 'typing' && typeof data.to === 'string') {
      const sender = clients.get(socket)
      if (!sender) return
      const recipient = [...clients.entries()].find(([, user]) => user.id === data.to)
      if (recipient && recipient[0].readyState === 1) {
        recipient[0].send(JSON.stringify({ type: 'typing', from: sender.id, isTyping: Boolean(data.isTyping) }))
      }
    }

    if (data.type === 'search-users' && typeof data.query === 'string') {
      const user = clients.get(socket)
      if (!user) return
      const onlineIds = new Set([...clients.values()].map((person) => person.id))
      const foundUsers = await getUsersForUser(user.id, data.query.trim().slice(0, 50))
      socket.send(JSON.stringify({ type: 'users', users: foundUsers.filter((person) => person.id !== user.id).map((person) => ({ ...person, online: onlineIds.has(person.id) })), selfId: user.id }))
    }

    if (data.type === 'edit-message' && typeof data.messageId === 'string' && typeof data.text === 'string') {
      const sender = clients.get(socket)
      if (!sender || !data.text.trim()) return
      await editMessage(data.messageId, sender.id, data.text.trim().slice(0, 1000))
      const update = JSON.stringify({ type: 'message-edited', messageId: data.messageId, text: data.text.trim().slice(0, 1000) })
      socket.send(update)
      for (const [recipientSocket, user] of clients) {
        if (user.id === data.to && recipientSocket.readyState === 1) recipientSocket.send(update)
      }
    }

    if (data.type === 'delete-message' && typeof data.messageId === 'string') {
      const sender = clients.get(socket)
      if (!sender) return
      await deleteMessage(data.messageId, sender.id)
      const update = JSON.stringify({ type: 'message-deleted', messageId: data.messageId })
      socket.send(update)
      for (const [recipientSocket, user] of clients) {
        if (user.id === data.to && recipientSocket.readyState === 1) recipientSocket.send(update)
      }
    }

    if (data.type === 'respond-request' && typeof data.requestId === 'string' && (data.status === 'accepted' || data.status === 'deleted')) {
      const user = clients.get(socket)
      if (!user) return
      await respondToMessageRequest(data.requestId, user.id, data.status)
      socket.send(JSON.stringify({ type: 'request-updated', requestId: data.requestId, status: data.status }))
      for (const [recipientSocket, recipientUser] of clients) {
        if (recipientUser.id !== user.id && recipientSocket.readyState === 1) recipientSocket.send(JSON.stringify({ type: 'request-updated', requestId: data.requestId, status: data.status }))
      }
    }

    if (['call-offer', 'call-answer', 'call-ice', 'call-accepted', 'call-rejected', 'call-ended'].includes(data.type) && typeof data.to === 'string') {
      const sender = clients.get(socket)
      const recipient = [...clients.entries()].find(([, user]) => user.id === data.to)
      if (!sender || !recipient || recipient[0].readyState !== 1) return
      const signal = { type: data.type, from: sender.id, fromName: sender.name, offer: data.offer, answer: data.answer, candidate: data.candidate }
      recipient[0].send(JSON.stringify(signal))
    }
  })

  socket.on('close', () => { clients.delete(socket); broadcastUsers().catch(() => undefined) })
})

const port = Number(process.env.PORT || 3001)
setupDatabase().then(() => {
  httpServer.listen(port, '0.0.0.0', () => console.log(`Chaty is running on port ${port} (temporary memory mode)`))
}).catch((error) => {
  console.error('Database setup failed:', error.message)
  process.exit(1)
})