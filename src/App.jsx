import { useEffect, useMemo, useRef, useState } from 'react'

function makePerson(user) {
  return { ...user, avatar: user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() }
}

function Avatar({ person, small = false }) {
  return <div className={`avatar avatar-${person.color || 'coral'} ${small ? 'avatar-small' : ''}`}>{person.avatar}<span className={person.online ? 'presence online' : 'presence'} /></div>
}

function App() {
  const [account, setAccount] = useState(() => JSON.parse(localStorage.getItem('chaty-account') || 'null'))
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [people, setPeople] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [activeTab, setActiveTab] = useState('Inbox')
  const chatContentRef = useRef(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsForm, setSettingsForm] = useState({ name: '', currentPassword: '', newPassword: '' })
  const [settingsError, setSettingsError] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)

  const name = account?.user?.name || ''

  useEffect(() => {
    if (!account?.token) return undefined
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const socketUrl = import.meta.env.DEV ? `ws://${window.location.hostname}:3001/ws` : `${protocol}://${window.location.host}/ws`
    const connection = new WebSocket(socketUrl)
    connection.onopen = () => { connection.send(JSON.stringify({ type: 'identify', token: account.token })); setConnected(true) }
    connection.onclose = () => setConnected(false)
    connection.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'users') {
        const nextPeople = data.users.filter((person) => person.id !== data.selfId).map(makePerson)
        setPeople(nextPeople)
        setSelectedId((current) => current || nextPeople[0]?.id || null)
      }
      if (data.type === 'history') setMessages(data.messages)
      if (data.type === 'message') setMessages((current) => [...current, data.message])
    }
    setSocket(connection)
    return () => connection.close()
  }, [account])

  const selectedPerson = people.find((person) => person.id === selectedId) || people[0]
  const filteredPeople = useMemo(() => people.filter((person) => person.name.toLowerCase().includes(query.toLowerCase())), [people, query])
  const visibleMessages = messages.filter((item) => selectedPerson && (item.from === selectedPerson.id || item.to === selectedPerson.id))

  useEffect(() => {
    const chatContent = chatContentRef.current
    if (chatContent) chatContent.scrollTop = chatContent.scrollHeight
  }, [selectedId, visibleMessages.length])

  async function submitAuth(event) {
    event.preventDefault()
    setAuthError('')
    try {
      const response = await fetch(`/api/${authMode === 'login' ? 'login' : 'register'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authForm) })
      const data = await response.json()
      if (!response.ok) return setAuthError(data.error)
      localStorage.setItem('chaty-account', JSON.stringify(data))
      setAccount(data)
    } catch {
      setAuthError('Chaty is unavailable. Please try again.')
    }
  }

  function logout() {
    localStorage.removeItem('chaty-account')
    setAccount(null)
  }

  function openSettings() {
    setSettingsForm({ name, currentPassword: '', newPassword: '' })
    setSettingsError('')
    setSettingsSaved(false)
    setSettingsOpen(true)
  }

  async function saveSettings(event) {
    event.preventDefault()
    setSettingsError('')
    setSettingsSaved(false)
    try {
      const response = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: account.token, ...settingsForm }) })
      const data = await response.json()
      if (!response.ok) return setSettingsError(data.error)
      const nextAccount = { ...account, user: data.user }
      localStorage.setItem('chaty-account', JSON.stringify(nextAccount))
      setAccount(nextAccount)
      setSettingsForm({ name: data.user.name, currentPassword: '', newPassword: '' })
      setSettingsSaved(true)
    } catch {
      setSettingsError('Chaty is unavailable. Please try again.')
    }
  }

  function sendMessage(event) {
    event.preventDefault()
    if (!message.trim() || !selectedPerson || socket?.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'message', to: selectedPerson.id, text: message.trim() }))
    setMessage('')
  }

  if (!account) return <main className="join-screen"><div className="join-card"><div className="brand-mark join-brand">c<span>·</span></div><p className="eyebrow">Private conversations</p><h1>{authMode === 'login' ? <>Welcome<br /><em>back.</em></> : <>Make space for<br /><em>good</em> conversations.</>}</h1><p className="join-copy">{authMode === 'login' ? 'Sign in to continue your conversations.' : 'Create an account to start chatting securely.'}</p><form onSubmit={submitAuth}><label htmlFor="username">Username</label><input id="username" required value={authForm.username} onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })} placeholder="e.g. jordan" autoFocus /><label htmlFor="password">Password</label><input id="password" type="password" required value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder="At least 8 characters" />{authError && <p className="auth-error">{authError}</p>}<button className="join-button">{authMode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button></form><button className="auth-switch" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('') }}>{authMode === 'login' ? 'New to Chaty? Create an account' : 'Already have an account? Sign in'}</button></div><div className="join-orb orb-one" /><div className="join-orb orb-two" /></main>

  return <main className="app-shell">
    <aside className="rail"><div className="brand-mark">c<span>·</span></div><nav className="rail-nav" aria-label="Primary navigation"><button className="rail-button active" aria-label="Messages" title="Messages">◒</button><button className="rail-button" aria-label="Explore" title="Explore">⌕</button><button className="rail-button" aria-label="Notifications" title="Notifications">♡</button><button className="rail-button" aria-label="Saved" title="Saved">▱</button></nav><button className="rail-button profile-button" aria-label="Open settings" title="Settings" onClick={openSettings}><div className="profile-dot">{name.slice(0, 2).toUpperCase()}</div></button></aside>
    <section className="inbox-panel"><header className="inbox-header"><div><p className="eyebrow">Messages</p><h1>Inbox <span className="count">{people.length}</span></h1></div><button className="compose-button" aria-label="Refresh contacts" onClick={() => socket?.send(JSON.stringify({ type: 'ping' }))}>↻</button></header><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" aria-label="Search people" /></div><div className="tabs" role="tablist"><button className={activeTab === 'Inbox' ? 'tab active-tab' : 'tab'} onClick={() => setActiveTab('Inbox')}>People</button><button className={activeTab === 'Requests' ? 'tab active-tab' : 'tab'} onClick={() => setActiveTab('Requests')}>Status <span className="request-count">{connected ? 'Live' : 'Offline'}</span></button></div><div className="conversation-list">{filteredPeople.map((person) => <button key={person.id} className={selectedId === person.id ? 'conversation selected' : 'conversation'} onClick={() => setSelectedId(person.id)}><Avatar person={person} small /><span className="conversation-copy"><strong>{person.name}</strong><span>{person.online ? 'Online now · Start a conversation' : 'Offline'}</span></span><span className="conversation-meta"><small>{person.online ? 'live' : ''}</small></span></button>)}{filteredPeople.length === 0 && <p className="empty-state">{people.length ? 'No people match your search.' : 'Open Chaty in another window to find people.'}</p>}</div><div className="inbox-footer"><span className="status-line"><i className={connected ? '' : 'offline'} /> {connected ? `Signed in as ${name}` : 'Connecting to Chaty...'}</span></div></section>
    <section className="chat-panel"><header className="chat-header">{selectedPerson ? <><div className="chat-person"><Avatar person={selectedPerson} /><div><h2>{selectedPerson.name}</h2><p>{selectedPerson.online ? 'Active now' : 'Offline'}</p></div></div><div className="chat-actions"><button aria-label="Start audio call">⌁</button><button aria-label="Start video call">▣</button><button aria-label="More options">•••</button></div></> : <div className="chat-placeholder"><span>✦</span><p>Select a person to start chatting</p></div>}</header>{selectedPerson && <><div className="chat-content" ref={chatContentRef}><div className="profile-intro"><Avatar person={selectedPerson} /><h3>{selectedPerson.name}</h3><p>Live conversation with {selectedPerson.name}</p></div><div className="date-divider"><span>{visibleMessages.length ? 'Messages' : 'New conversation'}</span></div><div className="message-stack">{visibleMessages.map((item) => <div key={item.id} className={`message-row ${item.from === 'me' ? 'mine' : ''}`}><div className="message-bubble">{item.text}<small>{item.time}</small></div></div>)}</div></div><form className="message-form" onSubmit={sendMessage}><button type="button" className="form-icon" aria-label="Add attachment">⊕</button><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={`Message ${selectedPerson.name.split(' ')[0]}`} aria-label="Write a message" /><button type="button" className="form-icon" aria-label="Add emoji">☺</button><button className="send-button" type="submit" aria-label="Send message">↑</button></form></>}</section>
    <aside className="details-panel">{selectedPerson ? <><div className="details-heading"><p className="eyebrow">Details</p><button aria-label="Close details" onClick={() => setSelectedId(null)}>×</button></div><div className="detail-avatar"><Avatar person={selectedPerson} /></div><h2>{selectedPerson.name}</h2><p className="detail-handle">{selectedPerson.online ? 'Online now' : 'Currently offline'}</p><div className="detail-actions"><button><span>♧</span> Mute</button><button><span>⌁</span> Call</button><button><span>i</span> Info</button></div><div className="detail-section"><button className="detail-row"><span>Media, links & docs</span><b>›</b></button><button className="detail-row"><span>Privacy & support</span><b>›</b></button></div><div className="shared-note"><span>✦</span><div><strong>Live connection</strong><p>Messages are delivered instantly while you are both online.</p></div></div></> : <div className="details-empty"><span>✦</span><p>Your contact details will appear here.</p></div>}</aside>{settingsOpen && <div className="settings-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSettingsOpen(false)}><section className="settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="details-heading"><div><p className="eyebrow">Account</p><h2 id="settings-title">Settings</h2></div><button aria-label="Close settings" onClick={() => setSettingsOpen(false)}>×</button></div><form className="settings-form" onSubmit={saveSettings}><label htmlFor="settings-name">Display name</label><input id="settings-name" required value={settingsForm.name} onChange={(event) => setSettingsForm({ ...settingsForm, name: event.target.value })} /><label htmlFor="current-password">Current password</label><input id="current-password" type="password" required value={settingsForm.currentPassword} onChange={(event) => setSettingsForm({ ...settingsForm, currentPassword: event.target.value })} /><label htmlFor="new-password">New password <span>(optional)</span></label><input id="new-password" type="password" value={settingsForm.newPassword} onChange={(event) => setSettingsForm({ ...settingsForm, newPassword: event.target.value })} placeholder="Leave blank to keep current password" />{settingsError && <p className="auth-error">{settingsError}</p>}{settingsSaved && <p className="settings-success">Settings saved.</p>}<button className="join-button">Save changes <span>→</span></button></form><button className="settings-logout" onClick={logout}>Sign out</button></section></div>}
  </main>
}

export default App
