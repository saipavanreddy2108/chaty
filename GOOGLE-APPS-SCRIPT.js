const SECRET = 'change-this-secret'

function doGet() {
  return json({ ok: true, service: 'Chaty Google Sheets API' })
}

function doPost(event) {
  try {
    const data = JSON.parse(event.postData.contents)
    if (data.secret !== SECRET) return json({ ok: false, error: 'Unauthorized' })

    if (data.action === 'createUser') return createUser(data)
    if (data.action === 'authenticateUser') return authenticateUser(data)
    if (data.action === 'createSession') return createSession(data)
    if (data.action === 'findSession') return findSession(data)
    if (data.action === 'getMessages') return getMessages(data)
    if (data.action === 'getUsers') return getUsers()
    if (data.action === 'getUser') return getUser(data)
    if (data.action === 'updateUser') return updateUser(data)
    if (data.action === 'saveMessage') return saveMessage(data)
    if (data.action === 'editMessage') return editMessage(data)
    if (data.action === 'deleteMessage') return deleteMessage(data)
    return json({ ok: false, error: 'Unknown action' })
  } catch (error) {
    return json({ ok: false, error: error.message })
  }
}

function sheet(name) {
  const result = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name)
  if (!result) throw new Error(`Missing sheet: ${name}`)
  return result
}

function rows(name) {
  const values = sheet(name).getDataRange().getValues()
  return values.slice(1)
}

function userFromRow(row) {
  return { id: row[0], name: row[1], username: row[1], email: row[2], passwordHash: row[3], color: row[4], createdAt: row[5] }
}

function publicUser(user) {
  return { id: user.id, name: user.name, color: user.color }
}

function createUser(data) {
  if (rows('Users').some((row) => row[1] === data.username || (data.email && row[2] === data.email))) throw new Error('Account already exists')
  sheet('Users').appendRow([data.id, data.username, data.email || '', data.passwordHash, data.color, new Date()])
  return json({ ok: true })
}

function authenticateUser(data) {
  const row = rows('Users').find((item) => item[1] === data.username || item[2] === data.email)
  return json({ ok: true, user: row ? userFromRow(row) : null })
}

function getUsers() {
  const users = rows('Users').map(function(row) {
    return { id: row[0], name: row[1], color: row[4] }
  })
  return json({ ok: true, users: users })
}

function getUser(data) {
  const row = rows('Users').find(function(item) {
    return item[0] === data.userId
  })
  return json({ ok: true, user: row ? userFromRow(row) : null })
}

function updateUser(data) {
  const currentSheet = sheet('Users')
  const rowIndex = rows('Users').findIndex(function(row) {
    return row[0] === data.userId
  })
  if (rowIndex < 0) throw new Error('User not found')
  currentSheet.getRange(rowIndex + 2, 2, 1, 4).setValues([[data.name, data.email || '', data.passwordHash, data.color || 'coral']])
  return json({ ok: true })
}

function createSession(data) {
  const sessionSheet = sheet('Sessions')
  const sessionRows = rows('Sessions')
  const index = sessionRows.findIndex((row) => row[0] === data.userId)
  if (index >= 0) sessionSheet.getRange(index + 2, 2).setValue(data.sessionHash)
  else sessionSheet.appendRow([data.userId, data.sessionHash, new Date()])
  return json({ ok: true })
}

function findSession(data) {
  const row = rows('Sessions').find((item) => item[1] === data.sessionHash)
  const userRow = row && rows('Users').find((item) => item[0] === row[0])
  return json({ ok: true, user: userRow ? userFromRow(userRow) : null })
}

function getMessages(data) {
  const saved = rows('Messages').filter((row) => row[1] === data.userId || row[2] === data.userId)
  const messages = saved.map((row) => ({ id: row[0], from: row[1] === data.userId ? 'me' : row[1], to: row[2], text: row[3], time: row[4] }))
  return json({ ok: true, messages })
}

function saveMessage(data) {
  sheet('Messages').appendRow([data.id, data.from, data.to, data.text, data.time, new Date(), ''])
  return json({ ok: true })
}

function findMessageRow(messageId) {
  return rows('Messages').findIndex(function(row) {
    return row[0] === messageId
  })
}

function editMessage(data) {
  const currentSheet = sheet('Messages')
  const rowIndex = findMessageRow(data.messageId)
  if (rowIndex < 0) throw new Error('Message not found')
  const row = rows('Messages')[rowIndex]
  if (row[1] !== data.userId) throw new Error('You can only edit your own messages')
  currentSheet.getRange(rowIndex + 2, 4).setValue(data.text)
  return json({ ok: true })
}

function deleteMessage(data) {
  const currentSheet = sheet('Messages')
  const rowIndex = findMessageRow(data.messageId)
  if (rowIndex < 0) throw new Error('Message not found')
  const row = rows('Messages')[rowIndex]
  if (row[1] !== data.userId) throw new Error('You can only delete your own messages')
  currentSheet.getRange(rowIndex + 2, 4).setValue('Message deleted')
  currentSheet.getRange(rowIndex + 2, 7).setValue(new Date())
  return json({ ok: true })
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)
}
