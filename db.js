import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

const users = new Map()
const usersByEmail = new Map()
const sessions = new Map()
const messages = []
const googleSheetsUrl = process.env.GOOGLE_SHEETS_URL || 'https://script.google.com/macros/s/AKfycbx8HDfGW8heNzxQ77jLxWquoaQQl3VY65FraItMRieVSCfA9COmTMNNlhMu3RBKAa0UXQ/exec'
const googleSheetsSecret = process.env.GOOGLE_SHEETS_SECRET || 'change-this-secret'

async function sheetsRequest(action, data = {}) {
  const response = await fetch(googleSheetsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, secret: googleSheetsSecret, ...data }) })
  const result = await response.json()
  if (!response.ok || !result.ok) throw new Error(result.error || 'Google Sheets request failed')
  return result
}

export async function setupDatabase() {
  return undefined
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

function validPassword(password, storedHash) {
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
  const user = { id: `user-${randomUUID()}`, name, email, passwordHash: hashPassword(password), color, createdAt: new Date() }
  await sheetsRequest('createUser', user)
  return publicUser(user)
}

export async function authenticateUser(email, password) {
  const { user } = await sheetsRequest('authenticateUser', { email, password })
  if (!user || !validPassword(password, user.passwordHash)) return null
  return publicUser(user)
}

export async function createUsernameAccount(username, password, color) {
  const user = { id: `user-${randomUUID()}`, name: username, username, email: '', passwordHash: hashPassword(password), color, createdAt: new Date() }
  await sheetsRequest('createUser', user)
  return publicUser(user)
}

export async function authenticateUsername(username, password) {
  const { user } = await sheetsRequest('authenticateUser', { username })
  if (!user || !validPassword(password, user.passwordHash)) return null
  return publicUser(user)
}

export async function createSession(userId) {
  const token = randomBytes(32).toString('hex')
  await sheetsRequest('createSession', { userId, sessionHash: createHash('sha256').update(token).digest('hex') })
  return token
}

export async function findUserBySession(token) {
  if (!token) return null
  const sessionHash = createHash('sha256').update(token).digest('hex')
  const { user } = await sheetsRequest('findSession', { sessionHash })
  return user ? publicUser(user) : null
}

export async function getMessagesForUser(userId) {
  const { messages: savedMessages } = await sheetsRequest('getMessages', { userId })
  return savedMessages
}

export async function saveMessage(message) {
  await sheetsRequest('saveMessage', message)
}
