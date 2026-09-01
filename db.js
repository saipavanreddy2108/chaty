import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { createClient } from '@libsql/client'

// In-memory fallback stores (guarantees server stays 100% online even if database is not yet created)
const memUsers = new Map()
const memSessions = new Map()
const memMessages = []
const memRequests = []

let client = null
let isTursoActive = false

const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoToken = process.env.TURSO_AUTH_TOKEN

if ((tursoUrl && tursoUrl.startsWith('libsql://')) || (tursoUrl && tursoUrl.startsWith('https://'))) {
  try {
    client = createClient({
      url: tursoUrl,
      authToken: tursoToken
    })
  } catch (err) {
    console.warn('Could not initialize Turso client:', err.message)
  }
}

export async function setupDatabase() {
  if (!client) {
    console.log('Running Chaty with in-memory database storage (Add TURSO_DATABASE_URL for persistent cloud storage)')
    return
  }

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        name TEXT,
        email TEXT,
        passwordHash TEXT,
        color TEXT,
        createdAt TEXT
      );
    `)

    await client.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        userId TEXT,
        sessionHash TEXT UNIQUE,
        createdAt TEXT
      );
    `)

    await client.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        fromId TEXT,
        toId TEXT,
        text TEXT,
        image TEXT,
        time TEXT,
        createdAt TEXT,
        edited INTEGER DEFAULT 0,
        deleted INTEGER DEFAULT 0
      );
    `)

    await client.execute(`
      CREATE TABLE IF NOT EXISTS requests (
        requestId TEXT PRIMARY KEY,
        fromId TEXT,
        toId TEXT,
        messageId TEXT,
        status TEXT,
        createdAt TEXT
      );
    `)

    isTursoActive = true
    console.log(`Connected to Turso Cloud Database (${tursoUrl})`)
  } catch (error) {
    isTursoActive = false
    console.warn(`Turso connection failed (${error.message}). Falling back to in-memory mode.`)
  }
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

function validPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false
  const [salt, key] = storedHash.split(':')
  if (!salt || !key) return false
  const expected = Buffer.from(key, 'hex')
  const actual = scryptSync(password, salt, 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function publicUser(user) {
  return { id: user.id, name: user.name || user.username, color: user.color }
}

export async function createAccount(name, email, password, color) {
  const user = { id: `user-${randomUUID()}`, name, username: name, email, passwordHash: hashPassword(password), color, createdAt: new Date().toISOString() }
  if (isTursoActive) {
    try {
      await client.execute({
        sql: `INSERT INTO users (id, username, name, email, passwordHash, color, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [user.id, user.username, user.name, user.email, user.passwordHash, user.color, user.createdAt]
      })
      return publicUser(user)
    } catch {}
  }
  memUsers.set(user.id, user)
  return publicUser(user)
}

export async function authenticateUser(email, password) {
  if (isTursoActive) {
    try {
      const result = await client.execute({ sql: `SELECT * FROM users WHERE email = ?`, args: [email] })
      if (result.rows.length) {
        const user = result.rows[0]
        if (validPassword(password, user.passwordHash)) return publicUser(user)
        return null
      }
    } catch {}
  }
  const user = [...memUsers.values()].find((u) => u.email === email)
  if (!user || !validPassword(password, user.passwordHash)) return null
  return publicUser(user)
}

export async function createUsernameAccount(username, password, color) {
  if (isTursoActive) {
    try {
      const existing = await client.execute({ sql: `SELECT id FROM users WHERE lower(username) = lower(?)`, args: [username] })
      if (existing.rows.length > 0) throw new Error('Account already exists')
      const user = { id: `user-${randomUUID()}`, name: username, username, email: '', passwordHash: hashPassword(password), color, createdAt: new Date().toISOString() }
      await client.execute({
        sql: `INSERT INTO users (id, username, name, email, passwordHash, color, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [user.id, user.username, user.name, user.email, user.passwordHash, user.color, user.createdAt]
      })
      return publicUser(user)
    } catch (e) {
      if (e.message === 'Account already exists') throw e
    }
  }
  const existsInMem = [...memUsers.values()].some((u) => u.username.toLowerCase() === username.toLowerCase())
  if (existsInMem) throw new Error('Account already exists')
  const user = { id: `user-${randomUUID()}`, name: username, username, email: '', passwordHash: hashPassword(password), color, createdAt: new Date().toISOString() }
  memUsers.set(user.id, user)
  return publicUser(user)
}

export async function authenticateUsername(username, password) {
  if (isTursoActive) {
    try {
      const result = await client.execute({ sql: `SELECT * FROM users WHERE lower(username) = lower(?)`, args: [username] })
      if (result.rows.length) {
        const user = result.rows[0]
        if (validPassword(password, user.passwordHash)) return publicUser(user)
        return null
      }
    } catch {}
  }
  const user = [...memUsers.values()].find((u) => u.username.toLowerCase() === username.toLowerCase())
  if (!user || !validPassword(password, user.passwordHash)) return null
  return publicUser(user)
}

export async function updateProfile(userId, currentPassword, name, newPassword) {
  if (isTursoActive) {
    try {
      const result = await client.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [userId] })
      if (result.rows.length) {
        const user = result.rows[0]
        if (!validPassword(currentPassword, user.passwordHash)) throw new Error('Current password is incorrect.')
        const passwordHash = newPassword ? hashPassword(newPassword) : user.passwordHash
        await client.execute({
          sql: `UPDATE users SET name = ?, passwordHash = ? WHERE id = ?`,
          args: [name, passwordHash, userId]
        })
        return publicUser({ ...user, name })
      }
    } catch (e) {
      if (e.message === 'Current password is incorrect.') throw e
    }
  }
  const user = memUsers.get(userId)
  if (!user || !validPassword(currentPassword, user.passwordHash)) throw new Error('Current password is incorrect.')
  user.name = name
  if (newPassword) user.passwordHash = hashPassword(newPassword)
  return publicUser(user)
}

export async function getAllUsers() {
  if (isTursoActive) {
    try {
      const result = await client.execute(`SELECT id, name, username, color FROM users`)
      return result.rows.map((r) => ({ id: r.id, name: r.name || r.username, color: r.color }))
    } catch {}
  }
  return [...memUsers.values()].map(publicUser)
}

export async function getUsersForUser(userId, query = '') {
  if (isTursoActive) {
    try {
      if (query) {
        const result = await client.execute({
          sql: `SELECT id, name, username, color FROM users WHERE lower(name) LIKE ? OR lower(username) LIKE ? LIMIT 50`,
          args: [`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`]
        })
        return result.rows.map((r) => ({ id: r.id, name: r.name || r.username, color: r.color }))
      }
      const result = await client.execute({
        sql: `SELECT DISTINCT u.id, u.name, u.username, u.color FROM users u WHERE u.id != ? LIMIT 50`,
        args: [userId]
      })
      return result.rows.map((r) => ({ id: r.id, name: r.name || r.username, color: r.color }))
    } catch {}
  }

  const all = [...memUsers.values()].filter((u) => u.id !== userId)
  if (query) {
    return all.filter((u) => (u.name || u.username).toLowerCase().includes(query.toLowerCase())).map(publicUser)
  }
  return all.map(publicUser)
}

export async function createSession(userId) {
  const token = randomBytes(32).toString('hex')
  const sessionHash = createHash('sha256').update(token).digest('hex')
  if (isTursoActive) {
    try {
      await client.execute({ sql: `DELETE FROM sessions WHERE userId = ?`, args: [userId] })
      await client.execute({ sql: `INSERT INTO sessions (userId, sessionHash, createdAt) VALUES (?, ?, ?)`, args: [userId, sessionHash, new Date().toISOString()] })
      return token
    } catch {}
  }
  memSessions.set(sessionHash, userId)
  return token
}

export async function findUserBySession(token) {
  if (!token) return null
  const sessionHash = createHash('sha256').update(token).digest('hex')
  if (isTursoActive) {
    try {
      const result = await client.execute({
        sql: `SELECT u.id, u.name, u.username, u.color FROM sessions s JOIN users u ON s.userId = u.id WHERE s.sessionHash = ?`,
        args: [sessionHash]
      })
      if (result.rows.length) return publicUser(result.rows[0])
    } catch {}
  }
  const userId = memSessions.get(sessionHash)
  if (!userId) return null
  const user = memUsers.get(userId)
  return user ? publicUser(user) : null
}

export async function getMessagesForUser(userId) {
  if (isTursoActive) {
    try {
      const result = await client.execute({
        sql: `SELECT id, fromId, toId, text, image, time, edited, deleted FROM messages WHERE fromId = ? OR toId = ? ORDER BY createdAt ASC`,
        args: [userId, userId]
      })
      return result.rows.map((r) => ({
        id: r.id,
        from: r.fromId === userId ? 'me' : r.fromId,
        to: r.toId,
        text: r.text,
        image: r.image,
        time: r.time,
        edited: Boolean(r.edited),
        deleted: Boolean(r.deleted)
      }))
    } catch {}
  }
  return memMessages
    .filter((m) => m.from === userId || m.to === userId)
    .map((m) => ({ ...m, from: m.from === userId ? 'me' : m.from }))
}

export async function saveMessage(message) {
  if (isTursoActive) {
    try {
      await client.execute({
        sql: `INSERT INTO messages (id, fromId, toId, text, image, time, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [message.id, message.from, message.to, message.text || '', message.image || null, message.time || '', new Date().toISOString()]
      })
      return
    } catch {}
  }
  memMessages.push({ ...message, createdAt: new Date().toISOString() })
}

export async function editMessage(messageId, userId, text) {
  if (isTursoActive) {
    try {
      await client.execute({
        sql: `UPDATE messages SET text = ?, edited = 1 WHERE id = ? AND fromId = ?`,
        args: [text, messageId, userId]
      })
      return
    } catch {}
  }
  const msg = memMessages.find((m) => m.id === messageId && m.from === userId)
  if (msg) {
    msg.text = text
    msg.edited = true
  }
}

export async function deleteMessage(messageId, userId) {
  if (isTursoActive) {
    try {
      await client.execute({
        sql: `UPDATE messages SET text = 'Message deleted', image = NULL, deleted = 1 WHERE id = ? AND fromId = ?`,
        args: [messageId, userId]
      })
      return
    } catch {}
  }
  const msg = memMessages.find((m) => m.id === messageId && m.from === userId)
  if (msg) {
    msg.text = 'Message deleted'
    msg.image = null
    msg.deleted = true
  }
}

export async function createMessageRequest(request) {
  if (isTursoActive) {
    try {
      await client.execute({
        sql: `INSERT INTO requests (requestId, fromId, toId, messageId, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [request.requestId, request.from, request.to, request.messageId, 'pending', new Date().toISOString()]
      })
      return
    } catch {}
  }
  memRequests.push({ ...request, createdAt: new Date().toISOString() })
}

export async function getMessageRequests(userId) {
  if (isTursoActive) {
    try {
      const result = await client.execute({
        sql: `SELECT requestId, fromId as "from", toId as "to", messageId, status, createdAt FROM requests WHERE toId = ? AND status = 'pending'`,
        args: [userId]
      })
      return result.rows
    } catch {}
  }
  return memRequests.filter((r) => r.to === userId && r.status === 'pending')
}

export async function getConversationState(from, to) {
  if (isTursoActive) {
    try {
      const reqResult = await client.execute({
        sql: `SELECT status FROM requests WHERE (fromId = ? AND toId = ?) OR (fromId = ? AND toId = ?) ORDER BY createdAt DESC LIMIT 1`,
        args: [from, to, to, from]
      })
      const msgResult = await client.execute({
        sql: `SELECT id FROM messages WHERE (fromId = ? AND toId = ?) OR (fromId = ? AND toId = ?) LIMIT 1`,
        args: [from, to, to, from]
      })
      return {
        hasMessages: msgResult.rows.length > 0,
        status: reqResult.rows.length ? reqResult.rows[0].status : null
      }
    } catch {}
  }

  const req = memRequests.find((r) => (r.from === from && r.to === to) || (r.from === to && r.to === from))
  const hasMsg = memMessages.some((m) => (m.from === from && m.to === to) || (m.from === to && m.to === from))
  return {
    hasMessages: hasMsg,
    status: req ? req.status : null
  }
}

export async function respondToMessageRequest(requestId, userId, status) {
  if (isTursoActive) {
    try {
      await client.execute({
        sql: `UPDATE requests SET status = ? WHERE requestId = ? AND toId = ? AND status = 'pending'`,
        args: [status, requestId, userId]
      })
      return
    } catch {}
  }
  const req = memRequests.find((r) => r.requestId === requestId && r.to === userId && r.status === 'pending')
  if (req) req.status = status
}

