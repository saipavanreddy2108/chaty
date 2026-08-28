import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { createClient } from '@libsql/client'

// Turso Cloud Database connection (defaults to local SQLite file if environment variables are not set)
const tursoUrl = process.env.TURSO_DATABASE_URL || 'file:chaty.db'
const tursoToken = process.env.TURSO_AUTH_TOKEN || undefined

const client = createClient({
  url: tursoUrl,
  authToken: tursoToken
})

export async function setupDatabase() {
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

  console.log(`Connected to database via libSQL/Turso (${tursoUrl})`)
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
  await client.execute({
    sql: `INSERT INTO users (id, username, name, email, passwordHash, color, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [user.id, user.username, user.name, user.email, user.passwordHash, user.color, user.createdAt]
  })
  return publicUser(user)
}

export async function authenticateUser(email, password) {
  const result = await client.execute({ sql: `SELECT * FROM users WHERE email = ?`, args: [email] })
  if (!result.rows.length) return null
  const user = result.rows[0]
  if (!validPassword(password, user.passwordHash)) return null
  return publicUser(user)
}

export async function createUsernameAccount(username, password, color) {
  const existing = await client.execute({ sql: `SELECT id FROM users WHERE lower(username) = lower(?)`, args: [username] })
  if (existing.rows.length > 0) throw new Error('Account already exists')
  const user = { id: `user-${randomUUID()}`, name: username, username, email: '', passwordHash: hashPassword(password), color, createdAt: new Date().toISOString() }
  await client.execute({
    sql: `INSERT INTO users (id, username, name, email, passwordHash, color, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [user.id, user.username, user.name, user.email, user.passwordHash, user.color, user.createdAt]
  })
  return publicUser(user)
}

export async function authenticateUsername(username, password) {
  const result = await client.execute({ sql: `SELECT * FROM users WHERE lower(username) = lower(?)`, args: [username] })
  if (!result.rows.length) return null
  const user = result.rows[0]
  if (!validPassword(password, user.passwordHash)) return null
  return publicUser(user)
}

export async function updateProfile(userId, currentPassword, name, newPassword) {
  const result = await client.execute({ sql: `SELECT * FROM users WHERE id = ?`, args: [userId] })
  if (!result.rows.length) throw new Error('User not found')
  const user = result.rows[0]
  if (!validPassword(currentPassword, user.passwordHash)) throw new Error('Current password is incorrect.')
  const passwordHash = newPassword ? hashPassword(newPassword) : user.passwordHash
  await client.execute({
    sql: `UPDATE users SET name = ?, passwordHash = ? WHERE id = ?`,
    args: [name, passwordHash, userId]
  })
  return publicUser({ ...user, name })
}

export async function getAllUsers() {
  const result = await client.execute(`SELECT id, name, username, color FROM users`)
  return result.rows.map((r) => ({ id: r.id, name: r.name || r.username, color: r.color }))
}

export async function getUsersForUser(userId, query = '') {
  if (query) {
    const result = await client.execute({
      sql: `SELECT id, name, username, color FROM users WHERE lower(name) LIKE ? OR lower(username) LIKE ? LIMIT 50`,
      args: [`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`]
    })
    return result.rows.map((r) => ({ id: r.id, name: r.name || r.username, color: r.color }))
  }

  // Get active contacts with conversations
  const result = await client.execute({
    sql: `SELECT DISTINCT u.id, u.name, u.username, u.color
          FROM users u
          WHERE u.id != ?
          LIMIT 50`,
    args: [userId]
  })
  return result.rows.map((r) => ({ id: r.id, name: r.name || r.username, color: r.color }))
}

export async function createSession(userId) {
  const token = randomBytes(32).toString('hex')
  const sessionHash = createHash('sha256').update(token).digest('hex')
  await client.execute({ sql: `DELETE FROM sessions WHERE userId = ?`, args: [userId] })
  await client.execute({ sql: `INSERT INTO sessions (userId, sessionHash, createdAt) VALUES (?, ?, ?)`, args: [userId, sessionHash, new Date().toISOString()] })
  return token
}

export async function findUserBySession(token) {
  if (!token) return null
  const sessionHash = createHash('sha256').update(token).digest('hex')
  const result = await client.execute({
    sql: `SELECT u.id, u.name, u.username, u.color FROM sessions s JOIN users u ON s.userId = u.id WHERE s.sessionHash = ?`,
    args: [sessionHash]
  })
  return result.rows.length ? publicUser(result.rows[0]) : null
}

export async function getMessagesForUser(userId) {
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
}

export async function saveMessage(message) {
  await client.execute({
    sql: `INSERT INTO messages (id, fromId, toId, text, image, time, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [message.id, message.from, message.to, message.text || '', message.image || null, message.time || '', new Date().toISOString()]
  })
}

export async function editMessage(messageId, userId, text) {
  await client.execute({
    sql: `UPDATE messages SET text = ?, edited = 1 WHERE id = ? AND fromId = ?`,
    args: [text, messageId, userId]
  })
}

export async function deleteMessage(messageId, userId) {
  await client.execute({
    sql: `UPDATE messages SET text = 'Message deleted', image = NULL, deleted = 1 WHERE id = ? AND fromId = ?`,
    args: [messageId, userId]
  })
}

export async function createMessageRequest(request) {
  await client.execute({
    sql: `INSERT INTO requests (requestId, fromId, toId, messageId, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [request.requestId, request.from, request.to, request.messageId, 'pending', new Date().toISOString()]
  })
}

export async function getMessageRequests(userId) {
  const result = await client.execute({
    sql: `SELECT requestId, fromId as "from", toId as "to", messageId, status, createdAt FROM requests WHERE toId = ? AND status = 'pending'`,
    args: [userId]
  })
  return result.rows
}

export async function getConversationState(from, to) {
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
}

export async function respondToMessageRequest(requestId, userId, status) {
  await client.execute({
    sql: `UPDATE requests SET status = ? WHERE requestId = ? AND toId = ? AND status = 'pending'`,
    args: [status, requestId, userId]
  })
}
