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
    if (data.action === 'getUsers') return getUsers(data)
    if (data.action === 'getUser') return getUser(data)
    if (data.action === 'updateUser') return updateUser(data)
    if (data.action === 'saveMessage') return saveMessage(data)
    if (data.action === 'editMessage') return editMessage(data)
    if (data.action === 'deleteMessage') return deleteMessage(data)
    if (data.action === 'createRequest') return createRequest(data)
    if (data.action === 'getRequests') return getRequests(data)
    if (data.action === 'conversationState') return conversationState(data)
    if (data.action === 'respondRequest') return respondRequest(data)
    return json({ ok: false, error: 'Unknown action' })
  } catch (error) {
    return json({ ok: false, error: error.message })
  }
}

function sheet(name) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  let result = spreadsheet.getSheetByName(name)
  if (!result && name === 'Requests') {
    result = spreadsheet.insertSheet(name)
    result.appendRow(['requestId', 'from', 'to', 'messageId', 'status', 'createdAt'])
  }
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

function getUsers(data) {
  const usersRows = rows('Users')
  const query = String(data.query || '').trim().toLowerCase()
  const userId = String(data.userId || '')
  let allowedIds = null
  if (!query && userId) {
    allowedIds = {}
    rows('Messages').forEach(function(row) {
      if (row[1] === userId) allowedIds[row[2]] = true
      if (row[2] === userId) allowedIds[row[1]] = true
    })
  }
  const users = usersRows.filter(function(row) {
    return query ? String(row[1]).toLowerCase().includes(query) : allowedIds && allowedIds[row[0]]
  }).map(function(row) {
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

function createRequest(data) {
  sheet('Requests').appendRow([data.requestId, data.from, data.to, data.messageId, 'pending', new Date()])
  return json({ ok: true })
}

function getRequests(data) {
  const requests = rows('Requests').filter(function(row) {
    return row[2] === data.userId && row[4] === 'pending'
  }).map(function(row) {
    return { requestId: row[0], from: row[1], to: row[2], messageId: row[3], status: row[4], createdAt: row[5] }
  })
  return json({ ok: true, requests: requests })
}

function conversationState(data) {
  const request = rows('Requests').find(function(row) {
    return (row[1] === data.from && row[2] === data.to) || (row[1] === data.to && row[2] === data.from)
  })
  const hasMessages = rows('Messages').some(function(row) {
    return (row[1] === data.from && row[2] === data.to) || (row[1] === data.to && row[2] === data.from)
  })
  return json({ ok: true, hasMessages: hasMessages, status: request ? request[4] : null })
}

function respondRequest(data) {
  const currentSheet = sheet('Requests')
  const rowIndex = rows('Requests').findIndex(function(row) {
    return row[0] === data.requestId && row[2] === data.userId && row[4] === 'pending'
  })
  if (rowIndex < 0) throw new Error('Request not found')
  if (data.status !== 'accepted' && data.status !== 'deleted') throw new Error('Invalid request status')
  currentSheet.getRange(rowIndex + 2, 5).setValue(data.status)
  return json({ ok: true })
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)
}
