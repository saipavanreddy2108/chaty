import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from './components/Avatar'
import {
  IconArrowLeft,
  IconMessageSquare,
  IconMoreVertical,
  IconPaperclip,
  IconPhone,
  IconRefresh,
  IconSearch,
  IconSend,
  IconSmile,
  IconX
} from './components/Icons'

import { playChime, startRingtone, stopRingtone } from './utils/audio'
import {
  makePerson,
  formatDuration,
  compressImage,
  EMOJI_CATEGORIES,
  QUICK_REACTIONS
} from './utils/helpers'


function App() {
  const [account, setAccount] = useState(() => JSON.parse(localStorage.getItem('chaty-account') || 'null'))
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [people, setPeople] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [activeTab, setActiveTab] = useState('Inbox')
  const [mobileView, setMobileView] = useState('inbox') // 'inbox' | 'chat'
  const [theme, setTheme] = useState(() => localStorage.getItem('chaty-theme') || 'dark')

  const chatContentRef = useRef(null)
  const messageInputRef = useRef(null)
  const searchInputRef = useRef(null)
  const fileInputRef = useRef(null)

  // Interactive extras state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsForm, setSettingsForm] = useState({ name: '', currentPassword: '', newPassword: '' })
  const [settingsError, setSettingsError] = useState('')
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState(null)
  const [messageRequests, setMessageRequests] = useState([])
  const [unreadCounts, setUnreadCounts] = useState({})
  const [mutedIds, setMutedIds] = useState([])
  
  // Media attachments & emoji
  const [selectedImage, setSelectedImage] = useState(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(0)
  const [lightboxImage, setLightboxImage] = useState(null)

  // Real-time typing indicators
  const [typingUsers, setTypingUsers] = useState({})
  const isTypingSentRef = useRef(false)
  const typingTimeoutRef = useRef(null)

  // WebRTC Audio Calls
  const [call, setCall] = useState(null)
  const [callTimer, setCallTimer] = useState(0)
  const [micMuted, setMicMuted] = useState(false)
  const [speakerMuted, setSpeakerMuted] = useState(false)
  const peerConnectionRef = useRef(null)
  const localStreamRef = useRef(null)
  const pendingOfferRef = useRef(null)
  const pendingIceCandidatesRef = useRef([])
  const remoteAudioRef = useRef(null)
  const selectedIdRef = useRef(null)
  const mutedIdsRef = useRef([])
  const isNearBottomRef = useRef(true)
  const [newMessageCount, setNewMessageCount] = useState(0)
  const callTimeoutRef = useRef(null)
  const callTimerIntervalRef = useRef(null)
  const reconnectAttemptRef = useRef(0)

  const name = account?.user?.name || ''

  // Sync theme attribute to <html>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('chaty-theme', theme)
  }, [theme])

  useEffect(() => {
    mutedIdsRef.current = mutedIds
  }, [mutedIds])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return
      setEmojiPickerOpen(false)
      setLightboxImage(null)
      setSettingsOpen(false)
      if (editingMessageId) cancelEdit()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingMessageId])

  // WebSocket lifecycle with exponential backoff & keep-alive ping
  useEffect(() => {
    if (!account?.token) return undefined

    let isUnmounted = false
    let currentSocket = null
    let pingInterval = null
    let reconnectTimeout = null

    function connect() {
      if (isUnmounted) return
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const socketUrl = import.meta.env.DEV ? `ws://${window.location.hostname}:3001/ws` : `${protocol}://${window.location.host}/ws`
      
      const connection = new WebSocket(socketUrl)
      currentSocket = connection

      connection.onopen = () => {
        if (isUnmounted) return connection.close()
        connection.send(JSON.stringify({ type: 'identify', token: account.token }))
        setConnected(true)
        setReconnecting(false)
        reconnectAttemptRef.current = 0

        // Keep connection active through proxies / Render
        if (pingInterval) clearInterval(pingInterval)
        pingInterval = setInterval(() => {
          if (connection.readyState === WebSocket.OPEN) {
            connection.send(JSON.stringify({ type: 'ping' }))
          }
        }, 25000)
      }

      connection.onclose = () => {
        if (isUnmounted) return
        setConnected(false)
        if (pingInterval) clearInterval(pingInterval)

        // Exponential backoff reconnect
        const attempt = reconnectAttemptRef.current + 1
        reconnectAttemptRef.current = attempt
        setReconnecting(true)
        const delay = Math.min(1000 * Math.pow(1.5, attempt), 12000)
        reconnectTimeout = setTimeout(connect, delay)
      }

      connection.onerror = () => {
        connection.close()
      }

      connection.onmessage = (event) => {
        let data
        try { data = JSON.parse(event.data) } catch { return }

        if (data.type === 'users') {
          const nextPeople = data.users.filter((person) => person.id !== data.selfId).map(makePerson)
          setPeople(nextPeople)
          setSelectedId((current) => current || nextPeople[0]?.id || null)
        }
        if (data.type === 'history') {
          setMessages(data.messages)
        }
        if (data.type === 'message') {
          setMessages((current) => [...current, data.message])
          if (data.message.from !== 'me') {
            if (!mutedIdsRef.current.includes(data.message.from)) playChime('receive')
            if (data.message.from !== selectedIdRef.current) {
              setUnreadCounts((current) => ({ ...current, [data.message.from]: (current[data.message.from] || 0) + 1 }))
              if (!mutedIdsRef.current.includes(data.message.from) && 'Notification' in window && Notification.permission === 'granted') {
                new Notification('New Chaty message', { body: data.message.text || 'Sent an image' })
              }
            }
          }
        }
        if (data.type === 'typing') {
          setTypingUsers((current) => ({ ...current, [data.from]: data.isTyping }))
        }
        if (data.type === 'message-edited') {
          setMessages((current) => current.map((item) => item.id === data.messageId ? { ...item, text: data.text, edited: true } : item))
        }
        if (data.type === 'message-deleted') {
          setMessages((current) => current.map((item) => item.id === data.messageId ? { ...item, text: 'Message deleted', deleted: true, image: null } : item))
        }
        if (data.type === 'message-requests') setMessageRequests(data.requests)
        if (data.type === 'message-request') setMessageRequests((current) => [...current.filter((item) => item.requestId !== data.request.requestId), data.request])
        if (data.type === 'request-updated') setMessageRequests((current) => current.filter((item) => item.requestId !== data.requestId))
        
        // WebRTC Signaling
        if (data.type === 'call-offer') {
          pendingOfferRef.current = data.offer
          setCall({ status: 'incoming', peerId: data.from, peerName: data.fromName })
          startRingtone(true)
        }
        if (data.type === 'call-answer') handleCallAnswer(data.answer)
        if (data.type === 'call-ice' && data.candidate) handleCallIce(data.candidate)
        if (data.type === 'call-accepted') {
          stopRingtone()
          if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current)
          setCall((current) => current ? { ...current, status: 'connected' } : current)
        }
        if (data.type === 'call-rejected' || data.type === 'call-ended') {
          stopRingtone()
          endCall(false)
        }
      }

      setSocket(connection)
    }

    connect()

    const handleOnline = () => {
      if (currentSocket?.readyState !== WebSocket.OPEN) connect()
    }
    window.addEventListener('online', handleOnline)

    return () => {
      isUnmounted = true
      window.removeEventListener('online', handleOnline)
      if (pingInterval) clearInterval(pingInterval)
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (currentSocket) currentSocket.close()
    }
  }, [account])

  // Request desktop notification permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // User search query dispatch
  useEffect(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'search-users', query }))
    }
  }, [socket, query])

  const selectedPerson = people.find((person) => person.id === selectedId) || people[0]
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  const normalizedQuery = query.trim().toLowerCase()
  const filteredPeople = useMemo(() => {
    const items = people.filter((person) => {
      const haystack = `${person.name || ''} ${person.username || ''}`.toLowerCase()
      return !normalizedQuery || haystack.includes(normalizedQuery)
    })
    return items
  }, [people, normalizedQuery])
  const visibleMessages = messages.filter((item) => selectedPerson && (item.from === selectedPerson.id || item.to === selectedPerson.id))

  // Keep the user's reading position unless they are already at the bottom.
  useEffect(() => {
    const chatContent = chatContentRef.current
    if (!chatContent) return
    chatContent.scrollTop = chatContent.scrollHeight
    isNearBottomRef.current = true
    setNewMessageCount(0)
  }, [selectedId])

  useEffect(() => {
    const chatContent = chatContentRef.current
    if (!chatContent || !visibleMessages.length) return
    if (isNearBottomRef.current) {
      chatContent.scrollTop = chatContent.scrollHeight
      setNewMessageCount(0)
    } else {
      setNewMessageCount((current) => current + 1)
    }
  }, [visibleMessages.length])

  function handleChatScroll(event) {
    const element = event.currentTarget
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    isNearBottomRef.current = distanceFromBottom < 80
    if (isNearBottomRef.current) setNewMessageCount(0)
  }

  function scrollToLatest() {
    const chatContent = chatContentRef.current
    if (!chatContent) return
    chatContent.scrollTo({ top: chatContent.scrollHeight, behavior: 'smooth' })
    isNearBottomRef.current = true
    setNewMessageCount(0)
  }

  function toggleMute(personId) {
    setMutedIds((current) => current.includes(personId)
      ? current.filter((id) => id !== personId)
      : [...current, personId])
  }

  // Typing indicator dispatch with debounce
  function handleInputChange(e) {
    const nextVal = e.target.value
    setMessage(nextVal)

    if (socket?.readyState === WebSocket.OPEN && selectedPerson) {
      if (!isTypingSentRef.current && nextVal.trim().length > 0) {
        isTypingSentRef.current = true
        socket.send(JSON.stringify({ type: 'typing', to: selectedPerson.id, isTyping: true }))
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        isTypingSentRef.current = false
        if (socket?.readyState === WebSocket.OPEN && selectedPerson) {
          socket.send(JSON.stringify({ type: 'typing', to: selectedPerson.id, isTyping: false }))
        }
      }, 1500)
    }
  }

  // Handle image upload
  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressedDataUrl = await compressImage(file)
      setSelectedImage(compressedDataUrl)
    } catch {
      alert('Could not load this image file.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleSelectEmoji(emoji) {
    setMessage((prev) => prev + emoji)
    setEmojiPickerOpen(false)
    messageInputRef.current?.focus()
  }

  async function submitAuth(event) {
    event.preventDefault()
    setAuthError('')
    try {
      const response = await fetch(`/api/${authMode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      })
      const data = await response.json()
      if (!response.ok) return setAuthError(data.error)
      localStorage.setItem('chaty-account', JSON.stringify(data))
      setAccount(data)
    } catch {
      setAuthError('Chaty is unavailable. Please check your connection and try again.')
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
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: account.token, ...settingsForm })
      })
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
    if ((!message.trim() && !selectedImage) || !selectedPerson || socket?.readyState !== WebSocket.OPEN) return
    
    // Stop typing indicator immediately
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    if (isTypingSentRef.current) {
      isTypingSentRef.current = false
      socket.send(JSON.stringify({ type: 'typing', to: selectedPerson.id, isTyping: false }))
    }

    socket.send(JSON.stringify({
      type: 'message',
      to: selectedPerson.id,
      text: message.trim(),
      image: selectedImage
    }))

    playChime('send')
    setMessage('')
    setSelectedImage(null)
    setEmojiPickerOpen(false)
  }

  // WebRTC Audio Calls
  function createPeerConnection(peerId) {
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    })
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'call-ice', to: peerId, candidate: event.candidate }))
      }
    }
    peerConnection.ontrack = (event) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0]
    }
    peerConnection.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(peerConnection.connectionState)) {
        endCall(false)
      }
    }
    peerConnectionRef.current = peerConnection
    return peerConnection
  }

  async function handleCallAnswer(answer) {
    const peerConnection = peerConnectionRef.current
    if (!peerConnection) return
    stopRingtone()
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current)
    await peerConnection.setRemoteDescription(answer)
    for (const candidate of pendingIceCandidatesRef.current) await peerConnection.addIceCandidate(candidate)
    pendingIceCandidatesRef.current = []
    setCall((current) => current ? { ...current, status: 'connected' } : current)
  }

  async function handleCallIce(candidate) {
    const peerConnection = peerConnectionRef.current
    if (!peerConnection?.remoteDescription) {
      pendingIceCandidatesRef.current.push(candidate)
      return
    }
    await peerConnection.addIceCandidate(candidate)
  }

  function formatCallDuration(totalSeconds) {
    const safeSeconds = Math.max(0, totalSeconds || 0)
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0')
    const seconds = String(safeSeconds % 60).padStart(2, '0')
    return `${minutes}:${seconds}`
  }

  function clearCallTimer() {
    if (callTimerIntervalRef.current) {
      clearInterval(callTimerIntervalRef.current)
      callTimerIntervalRef.current = null
    }
    setCallTimer(0)
  }

  function startCallTimer() {
    clearCallTimer()
    const tick = () => {
      setCallTimer((current) => current + 1)
    }
    tick()
    callTimerIntervalRef.current = setInterval(tick, 1000)
  }

  function syncCallAudioState() {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !micMuted
      })
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = speakerMuted
    }
  }

  async function startAudioCall() {
    if (!selectedPerson || socket?.readyState !== WebSocket.OPEN || call) return
    setMicMuted(false)
    setSpeakerMuted(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      syncCallAudioState()
      const peerConnection = createPeerConnection(selectedPerson.id)
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream))
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      socket.send(JSON.stringify({ type: 'call-offer', to: selectedPerson.id, fromName: name, offer }))
      setCall({ status: 'calling', peerId: selectedPerson.id, peerName: selectedPerson.name })
      startRingtone(false)

      // 30s call timeout if no answer
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = setTimeout(() => {
        endCall(true)
        alert(`${selectedPerson.name} is not answering.`)
      }, 30000)
    } catch {
      setCall({ status: 'error', peerId: selectedPerson.id, peerName: selectedPerson.name })
    }
  }

  async function acceptAudioCall() {
    if (!call?.peerId || !pendingOfferRef.current) return
    try {
      stopRingtone()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStreamRef.current = stream
      syncCallAudioState()
      const peerConnection = createPeerConnection(call.peerId)
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream))
      await peerConnection.setRemoteDescription(pendingOfferRef.current)
      for (const candidate of pendingIceCandidatesRef.current) await peerConnection.addIceCandidate(candidate)
      pendingIceCandidatesRef.current = []
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      socket.send(JSON.stringify({ type: 'call-answer', to: call.peerId, answer }))
      socket.send(JSON.stringify({ type: 'call-accepted', to: call.peerId }))
      pendingOfferRef.current = null
      setCall({ ...call, status: 'connected' })
    } catch {
      endCall(true)
    }
  }

  useEffect(() => {
    if (call?.status === 'connected') {
      startCallTimer()
    } else {
      clearCallTimer()
    }

    return () => {
      if (call?.status === 'connected') {
        clearCallTimer()
      }
    }
  }, [call?.status])

  useEffect(() => {
    syncCallAudioState()
  }, [micMuted, speakerMuted, call?.status])

  function rejectAudioCall() {
    stopRingtone()
    if (call?.peerId && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'call-rejected', to: call.peerId }))
    }
    endCall(false)
  }

  function endCall(notify = true) {
    stopRingtone()
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current)
    if (notify && call?.peerId && socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'call-ended', to: call.peerId }))
    }
    peerConnectionRef.current?.close()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    peerConnectionRef.current = null
    localStreamRef.current = null
    pendingOfferRef.current = null
    pendingIceCandidatesRef.current = []
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
    setMicMuted(false)
    setSpeakerMuted(false)
    clearCallTimer()
    setCall(null)
  }

  function beginEdit(item) {
    setEditingMessageId(item.id)
    setMessage(item.text)
    messageInputRef.current?.focus()
  }

  function cancelEdit() {
    setEditingMessageId(null)
    setMessage('')
  }

  function saveEditedMessage(item) {
    const text = message.trim()
    if (!text || socket?.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'edit-message', messageId: item.id, to: item.to, text }))
    cancelEdit()
  }

  function removeMessage(item) {
    if (socket?.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'delete-message', messageId: item.id, to: item.to }))
  }

  function respondToRequest(requestId, status) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'respond-request', requestId, status }))
    }
  }

  function submitMessage(event) {
    event.preventDefault()
    if (editingMessageId) {
      const item = messages.find((messageItem) => messageItem.id === editingMessageId)
      if (item) saveEditedMessage(item)
      return
    }
    sendMessage(event)
  }

  if (!account) {
    return (
      <main className="join-screen">
        <div className="join-card">
          <div className="brand-mark join-brand">c<span>·</span></div>
          <p className="eyebrow">Private conversations</p>
          <h1>
            {authMode === 'login' ? <>Welcome<br /><em>back.</em></> : <>Make space for<br /><em>good</em> conversations.</>}
          </h1>
          <p className="join-copy">
            {authMode === 'login' ? 'Sign in to continue your live conversations.' : 'Create an account to start chatting in real-time.'}
          </p>
          <form onSubmit={submitAuth}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              required
              value={authForm.username}
              onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })}
              placeholder="e.g. jordan"
              autoFocus
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={authForm.password}
              onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
              placeholder="At least 8 characters"
            />
            {authError && <p className="auth-error">{authError}</p>}
            <button className="join-button">
              {authMode === 'login' ? 'Sign in' : 'Create account'} <span>→</span>
            </button>
          </form>
          <button
            className="auth-switch"
            onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('') }}
          >
            {authMode === 'login' ? 'New to Chaty? Create an account' : 'Already have an account? Sign in'}
          </button>
        </div>
        <div className="join-orb orb-one" />
        <div className="join-orb orb-two" />
      </main>
    )
  }

  const isPeerTyping = selectedPerson && typingUsers[selectedPerson.id]

  return (
    <main className="app-shell">
      {/* Hidden file input for attachments */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* Rail Nav Sidebar */}
      <aside className="rail">
        <div className="brand-mark">c<span>·</span></div>
        <nav className="rail-nav" aria-label="Primary navigation">
          <button className="rail-button active" aria-label="Messages" title="Messages"><IconMessageSquare size={19} /></button>
          <button className="rail-button" aria-label="Explore" title="Search people" onClick={() => { setActiveTab('Inbox'); setMobileView('inbox'); searchInputRef.current?.focus() }}><IconSearch size={19} /></button>
        </nav>
        <button className="rail-button profile-button" aria-label="Settings" title="Settings" onClick={openSettings}>
          <div className="profile-dot">{name.slice(0, 2).toUpperCase()}</div>
        </button>
      </aside>

      {/* Inbox Panel */}
      <section className={`inbox-panel ${mobileView === 'chat' ? 'mobile-hide' : ''}`}>
        <header className="inbox-header">
          <div>
            <p className="eyebrow">Messages</p>
            <h1>Inbox <span className="count">{people.length}</span></h1>
          </div>
          <button
            className="compose-button"
            aria-label="Refresh contacts"
            title="Refresh contacts"
            onClick={() => socket?.send(JSON.stringify({ type: 'ping' }))}
          >
            <IconRefresh size={17} />
          </button>
        </header>
        
        <div className="search-box">
          <span>⌕</span>
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people"
            aria-label="Search people"
          />
        </div>

        <div className="tabs" role="tablist">
          <button
            className={activeTab === 'Inbox' ? 'tab active-tab' : 'tab'}
            onClick={() => setActiveTab('Inbox')}
          >
            All Chats
          </button>
        </div>

        <div className="conversation-list">
          {filteredPeople.length > 0 && (
            <>
              <div className="conversation-section-header">People</div>
              {filteredPeople.map((person) => (
                <button
                  key={person.id}
                  className={selectedId === person.id ? 'conversation selected' : 'conversation'}
                  onClick={() => {
                    setSelectedId(person.id)
                    setMobileView('chat')
                    setUnreadCounts((current) => ({ ...current, [person.id]: 0 }))
                  }}
                >
                  <Avatar person={person} small />
                  <span className="conversation-copy">
                    <strong>{person.name}</strong>
                    <span>
                      {typingUsers[person.id] ? 'Typing...' : person.online ? 'Online now · Start chatting' : 'Offline'}
                    </span>
                  </span>
                  {unreadCounts[person.id] > 0 && <span className="unread-count">{unreadCounts[person.id]}</span>}
                  <span className="conversation-meta">
                    <small>{person.online ? 'live' : ''}</small>
                  </span>
                </button>
              ))}
            </>
          )}

          {messageRequests.filter((r) => r.status === 'pending').length > 0 && (
            <>
              <div className="conversation-section-header">New Requests</div>
              {messageRequests.filter((r) => r.status === 'pending').map((request) => {
                const requester = people.find((p) => p.id === request.from)
                return requester ? (
                  <button
                    key={request.requestId}
                    className={selectedId === request.from ? 'conversation selected request-item' : 'conversation request-item'}
                    onClick={() => {
                      setSelectedId(request.from)
                      setMobileView('chat')
                    }}
                  >
                    <Avatar person={requester} small />
                    <span className="conversation-copy">
                      <strong>{requester.name}</strong>
                      <span>Wants to connect • {requester.online ? 'Online' : 'Offline'}</span>
                    </span>
                    <span className="conversation-meta">
                      <small>new</small>
                    </span>
                  </button>
                ) : null
              })}
            </>
          )}

          {filteredPeople.length === 0 && messageRequests.filter((r) => r.status === 'pending').length === 0 && (
            <p className="empty-state">{people.length ? 'No people match your search.' : 'Open Chaty in another browser to chat with someone.'}</p>
          )}
        </div>

        <div className="inbox-footer">
          <span className="status-line">
            <i className={connected ? '' : reconnecting ? 'reconnecting' : 'offline'} />
            {connected ? `Signed in as ${name}` : reconnecting ? 'Reconnecting to Chaty...' : 'Disconnected from server'}
          </span>
        </div>
      </section>

      {/* Main Chat Panel */}
      <section className={`chat-panel ${mobileView === 'inbox' ? 'mobile-hide' : ''}`}>
        <header className="chat-header">
          {selectedPerson ? (
            <>
              <div className="chat-person">
                <button
                  className="mobile-back-btn"
                  aria-label="Back to contacts"
                  onClick={() => setMobileView('inbox')}
                >
                  <IconArrowLeft size={18} />
                </button>
                <Avatar person={selectedPerson} />
                <div>
                  <h2>{selectedPerson.name}</h2>
                  <p>{isPeerTyping ? 'Typing...' : selectedPerson.online ? 'Active now' : 'Offline'}</p>
                </div>
              </div>
              <div className="chat-actions">
                <button aria-label="Start audio call" title="Audio call" onClick={startAudioCall}><IconPhone size={18} /></button>
                <button aria-label="Open settings" title="Settings" onClick={openSettings}><IconMoreVertical size={18} /></button>
              </div>
            </>
          ) : (
            <div className="chat-placeholder">
              <span>✦</span>
              <p>Select a contact to start messaging</p>
            </div>
          )}
        </header>

        {selectedPerson && (
          <>
            <div className="chat-content" ref={chatContentRef} onScroll={handleChatScroll}>
              <div className="profile-intro">
                <Avatar person={selectedPerson} />
                <h3>{selectedPerson.name}</h3>
                <p>Live encrypted connection with {selectedPerson.name}</p>
              </div>

              {messageRequests.some((request) => request.from === selectedPerson.id && request.status === 'pending') && (
                <div className="request-banner">
                  <strong>Message request</strong>
                  <p>{selectedPerson.name} wants to connect with you.</p>
                  <div>
                    <button type="button" onClick={() => respondToRequest(messageRequests.find((r) => r.from === selectedPerson.id).requestId, 'accepted')}>Accept</button>
                    <button type="button" onClick={() => respondToRequest(messageRequests.find((r) => r.from === selectedPerson.id).requestId, 'deleted')}>Decline</button>
                  </div>
                </div>
              )}

              <div className="date-divider">
                <span>{visibleMessages.length ? 'Messages' : 'Start of conversation'}</span>
              </div>

              <div className="message-stack">
                {visibleMessages.map((item) => (
                  <div key={item.id} className={`message-row ${item.from === 'me' ? 'mine' : ''}`}>
                    <div className={`message-bubble ${item.deleted ? 'deleted-message' : ''}`}>
                      {item.image && !item.deleted && (
                        <img
                          src={item.image}
                          alt="Attachment"
                          className="message-image"
                          onClick={() => setLightboxImage(item.image)}
                        />
                      )}
                      {item.text && <div>{item.text}</div>}
                      {item.edited && <em className="edited-label"> edited</em>}
                      {item.from === 'me' && !item.deleted && (
                        <span className="message-controls">
                          {item.text && <button type="button" onClick={() => beginEdit(item)}>Edit</button>}
                          <button type="button" onClick={() => removeMessage(item)}>Delete</button>
                        </span>
                      )}
                      <small>{item.time}</small>
                    </div>
                  </div>
                ))}

                {/* Real-time typing bubble */}
                {isPeerTyping && (
                  <div className="typing-indicator-row">
                    <div className="typing-dots">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                    <span>{selectedPerson.name} is typing...</span>
                  </div>
                )}
              </div>
              {newMessageCount > 0 && (
                <button className="new-message-jump" type="button" onClick={scrollToLatest}>
                  ↓ {newMessageCount} new {newMessageCount === 1 ? 'message' : 'messages'}
                </button>
              )}
            </div>

            {/* Audio Call Banner */}
            {call && (
              <div className={`call-panel call-${call.status}`}>
                <strong>
                  {call.status === 'incoming'
                    ? `Incoming audio call from ${call.peerName}...`
                    : call.status === 'calling'
                    ? `Calling ${call.peerName}...`
                    : call.status === 'connected'
                    ? `Live audio call with ${call.peerName} • ${formatCallDuration(callTimer)}`
                    : 'Audio call could not connect'}
                </strong>
                {call.status === 'incoming' && (
                  <>
                    <button type="button" onClick={acceptAudioCall}>Accept</button>
                    <button type="button" className="call-hangup-btn" onClick={rejectAudioCall}>Decline</button>
                  </>
                )}
                {call.status === 'connected' && (
                  <div className="call-audio-controls">
                    <button type="button" className={micMuted ? 'call-toggle-muted' : ''} onClick={() => setMicMuted((value) => !value)}>
                      {micMuted ? 'Mic off' : 'Mic on'}
                    </button>
                    <button type="button" className={speakerMuted ? 'call-toggle-muted' : ''} onClick={() => setSpeakerMuted((value) => !value)}>
                      {speakerMuted ? 'Speaker off' : 'Speaker on'}
                    </button>
                  </div>
                )}
                {call.status !== 'error' && call.status !== 'incoming' && (
                  <button type="button" className="call-hangup-btn" onClick={() => endCall(true)}>Hang up</button>
                )}
              </div>
            )}
            <audio ref={remoteAudioRef} autoPlay />

            {/* Message Composer Form */}
            <div className="message-form-wrapper">
              {/* Image Preview Bar if attached */}
              {selectedImage && (
                <div className="image-preview-bar">
                  <img src={selectedImage} alt="Upload preview" />
                  <div className="image-preview-info">Photo ready to send</div>
                  <button type="button" className="image-preview-remove" aria-label="Remove image attachment" title="Remove attachment" onClick={() => setSelectedImage(null)}><IconX size={16} /></button>
                </div>
              )}

              {/* Emoji Picker Popover */}
              {emojiPickerOpen && (
                <div className="emoji-picker-popover">
                  <div className="emoji-categories">
                    {EMOJI_CATEGORIES.map((cat, idx) => (
                      <button
                        key={cat.name}
                        type="button"
                        className={`emoji-cat-btn ${activeEmojiCategory === idx ? 'active' : ''}`}
                        onClick={() => setActiveEmojiCategory(idx)}
                      >
                        {cat.icon} {cat.name}
                      </button>
                    ))}
                  </div>
                  <div className="emoji-grid">
                    {EMOJI_CATEGORIES[activeEmojiCategory].emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="emoji-item"
                        onClick={() => handleSelectEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form className="message-form" onSubmit={submitMessage}>
                {editingMessageId && (
                  <button type="button" className="cancel-edit" onClick={cancelEdit}>
                    Cancel
                  </button>
                )}

                <button
                  type="button"
                  className="form-icon"
                  aria-label="Add image attachment"
                  title="Attach Photo"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <IconPaperclip size={19} />
                </button>

                <input
                  ref={messageInputRef}
                  value={message}
                  onChange={handleInputChange}
                  placeholder={editingMessageId ? 'Edit your message...' : `Message ${selectedPerson.name.split(' ')[0]}...`}
                  aria-label={editingMessageId ? 'Edit message' : 'Write a message'}
                />

                <button
                  type="button"
                  className={`form-icon ${emojiPickerOpen ? 'active' : ''}`}
                  aria-label="Add emoji"
                  title="Pick Emoji"
                  onClick={() => setEmojiPickerOpen((prev) => !prev)}
                >
                  <IconSmile size={19} />
                </button>

                <button
                  className="send-button"
                  type="submit"
                  aria-label={editingMessageId ? 'Save edited message' : 'Send message'}
                  title="Send"
                >
                  <IconSend size={18} />
                </button>
              </form>
            </div>
          </>
        )}
      </section>

      {/* Details Side Panel */}
      <aside className="details-panel">
        {selectedPerson ? (
          <>
            <div className="details-heading">
              <p className="eyebrow">Details</p>
              <button aria-label="Close details" title="Close contact details" onClick={() => setSelectedId(null)}><IconX size={18} /></button>
            </div>
            <div className="detail-avatar">
              <Avatar person={selectedPerson} />
            </div>
            <h2>{selectedPerson.name}</h2>
            <p className="detail-handle">{selectedPerson.online ? 'Online now' : 'Currently offline'}</p>
            <div className="detail-actions">
              <button onClick={() => toggleMute(selectedPerson.id)}>
                <span aria-hidden="true">◌</span> {mutedIds.includes(selectedPerson.id) ? 'Unmute' : 'Mute'}
              </button>
              <button onClick={startAudioCall}>
                <span>⌁</span> Call
              </button>
              <button onClick={openSettings}>
                <span>i</span> Info
              </button>
            </div>
            <div className="detail-section">
              <div className="detail-row">
                <span>Media, links & docs</span><b>0</b>
              </div>
              <div className="detail-row">
                <span>Privacy & security</span><b>Protected</b>
              </div>
            </div>
            <div className="shared-note">
              <span>✦</span>
              <div>
                <strong>Live status</strong>
                <p>Real-time delivery with auto-reconnect and instant audio calls.</p>
              </div>
            </div>
          </>
        ) : (
          <div className="details-empty">
            <span>✦</span>
            <p>Select a contact to view their profile details.</p>
          </div>
        )}
      </aside>

      {/* Settings Modal & Theme Switcher */}
      {settingsOpen && (
        <div
          className="settings-backdrop"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setSettingsOpen(false)}
        >
          <section className="settings-card" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="details-heading">
              <div>
                <p className="eyebrow">Preferences</p>
                <h2 id="settings-title">Settings</h2>
              </div>
              <button aria-label="Close settings" title="Close settings" onClick={() => setSettingsOpen(false)}><IconX size={18} /></button>
            </div>

            {/* Theme Selector */}
            <div className="theme-selector-group">
              <label>Interface Theme</label>
              <div className="theme-pills">
                <button
                  type="button"
                  className={`theme-pill ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                >
                  🌙 Dark
                </button>
                <button
                  type="button"
                  className={`theme-pill ${theme === 'dusk' ? 'active' : ''}`}
                  onClick={() => setTheme('dusk')}
                >
                  🌆 Dusk
                </button>
                <button
                  type="button"
                  className={`theme-pill ${theme === 'light' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                >
                  ☀️ Light
                </button>
              </div>
            </div>

            <form className="settings-form" onSubmit={saveSettings}>
              <label htmlFor="settings-name">Display name</label>
              <input
                id="settings-name"
                required
                value={settingsForm.name}
                onChange={(event) => setSettingsForm({ ...settingsForm, name: event.target.value })}
              />

              <label htmlFor="current-password">Current password</label>
              <input
                id="current-password"
                type="password"
                required
                value={settingsForm.currentPassword}
                onChange={(event) => setSettingsForm({ ...settingsForm, currentPassword: event.target.value })}
              />

              <label htmlFor="new-password">New password <span>(optional)</span></label>
              <input
                id="new-password"
                type="password"
                value={settingsForm.newPassword}
                onChange={(event) => setSettingsForm({ ...settingsForm, newPassword: event.target.value })}
                placeholder="Leave blank to keep current password"
              />

              {settingsError && <p className="auth-error">{settingsError}</p>}
              {settingsSaved && <p className="settings-success">Settings saved successfully.</p>}

              <button className="join-button">
                Save changes <span>→</span>
              </button>
            </form>

            <button className="settings-logout" onClick={logout}>
              Sign out of Chaty
            </button>
          </section>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {lightboxImage && (
        <div className="lightbox-backdrop" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setLightboxImage(null)}>✕</button>
            <img src={lightboxImage} alt="Fullscreen preview" />
          </div>
        </div>
      )}
    </main>
  )
}

export default App

