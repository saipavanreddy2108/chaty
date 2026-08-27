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
    if (data.action === 'saveMessage') return saveMessage(data)
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
  sheet('Messages').appendRow([data.id, data.from, data.to, data.text, data.time, new Date()])
  return json({ ok: true })
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)
}
