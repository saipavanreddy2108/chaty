import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from './components/Avatar'
import {
  IconArrowLeft,
  IconMessageSquare,
  IconMoreVertical,
  IconPaperclip,
  IconPhone,
  IconVideo,
  IconRefresh,
  IconSearch,
  IconSend,
  IconSmile,
  IconInfo,
  IconX,
  IconCheckCheck,
  IconSparkles,
  IconLock,
  IconShield,
  IconUsers,
  IconSettings
} from './components/Icons'

import { VoiceCallScreen } from './components/call/VoiceCallScreen'
import { VideoCallScreen } from './components/call/VideoCallScreen'
import { IncomingCallModal } from './components/call/IncomingCallModal'

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
  const [detailsOpen, setDetailsOpen] = useState(true)

  // Real-time typing indicators
  const [typingUsers, setTypingUsers] = useState({})
  const isTypingSentRef = useRef(false)
  const typingTimeoutRef = useRef(null)

  // WebRTC Calls (Voice & Video)
  const [call, setCall] = useState(null)
  const [callTimer, setCallTimer] = useState(0)
  const [micMuted, setMicMuted] = useState(false)
  const [speakerMuted, setSpeakerMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const peerConnectionRef = useRef(null)
  const localStreamRef = useRef(null)
  const pendingOfferRef = useRef(null)
  const pendingIceCandidatesRef = useRef([])
  const remoteAudioRef = useRef(null)
  const selectedIdRef = useRef(null)
  const latestSearchRef = useRef({ requestId: 0, query: '' })
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
          if (data.searchRequestId && data.searchRequestId !== latestSearchRef.current.requestId) return
          if (!data.searchRequestId && latestSearchRef.current.query) return
          const nextPeople = data.users.filter((person) => person.id !== data.selfId).map(makePerson)
          setPeople(nextPeople)
          setSelectedId((current) => (current && nextPeople.some((p) => p.id === current) ? current : null))
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
          setCall({
            status: 'incoming',
            type: data.callType || 'voice',
            peerId: data.from,
            peerName: data.fromName
          })
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
      const normalizedSearchQuery = query.trim().slice(0, 50)
      const requestId = latestSearchRef.current.requestId + 1
      latestSearchRef.current = { requestId, query: normalizedSearchQuery }
      socket.send(JSON.stringify({ type: 'search-users', query: normalizedSearchQuery, requestId }))
    }
  }, [socket, query])

  const selectedPerson = selectedId ? people.find((person) => person.id === selectedId) || null : null
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

  // WebRTC Audio and Video Calls
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
      const stream = event.streams[0]
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream
      setRemoteStream(stream)
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
    setCall((current) => (current ? { ...current, status: 'connected' } : current))
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

  function toggleMic() {
    setMicMuted((prev) => {
      const next = !prev
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next
        })
      }
      return next
    })
  }

  function toggleSpeaker() {
    setSpeakerMuted((prev) => {
      const next = !prev
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = next
      }
      return next
    })
  }

  function toggleCamera() {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setCameraOff((prev) => !prev)
    }
  }

  async function switchCamera() {
    if (!localStreamRef.current || call?.type !== 'video') return
    try {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (!videoTrack) return
      const currentFacing = videoTrack.getSettings().facingMode || 'user'
      const nextFacing = currentFacing === 'user' ? 'environment' : 'user'

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: nextFacing } }
      })
      const newTrack = newStream.getVideoTracks()[0]
      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current.getSenders().find((s) => s.track && s.track.kind === 'video')
        if (sender) sender.replaceTrack(newTrack)
      }
      localStreamRef.current.removeTrack(videoTrack)
      videoTrack.stop()
      localStreamRef.current.addTrack(newTrack)
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()))
    } catch (e) {
      console.warn('Could not switch camera facing mode:', e)
    }
  }

  async function startCall(callType = 'voice') {
    if (!selectedPerson || socket?.readyState !== WebSocket.OPEN || call) return
    setMicMuted(false)
    setSpeakerMuted(false)
    setCameraOff(false)
    try {
      const constraints = {
        audio: true,
        video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      setLocalStream(stream)
      syncCallAudioState()
      const peerConnection = createPeerConnection(selectedPerson.id)
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream))
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      socket.send(JSON.stringify({
        type: 'call-offer',
        to: selectedPerson.id,
        fromName: name,
        callType,
        offer
      }))
      setCall({
        status: 'calling',
        type: callType,
        peerId: selectedPerson.id,
        peerName: selectedPerson.name
      })
      startRingtone(false)

      // 30s call timeout if no answer
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current)
      callTimeoutRef.current = setTimeout(() => {
        endCall(true)
        alert(`${selectedPerson.name} is not answering.`)
      }, 30000)
    } catch (err) {
      console.error('Call media error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert(`${callType === 'video' ? 'Camera and microphone' : 'Microphone'} access was denied. Please allow permissions in your browser settings to make calls.`)
      } else {
        alert(`Could not start ${callType} call: ${err.message}`)
      }
      setCall({ status: 'error', type: callType, peerId: selectedPerson.id, peerName: selectedPerson.name })
      setTimeout(() => endCall(false), 2000)
    }
  }

  async function acceptCall() {
    if (!call?.peerId || !pendingOfferRef.current) return
    const callType = call.type || 'voice'
    try {
      stopRingtone()
      const constraints = {
        audio: true,
        video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      setLocalStream(stream)
      syncCallAudioState()
      const peerConnection = createPeerConnection(call.peerId)
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream))
      await peerConnection.setRemoteDescription(pendingOfferRef.current)
      for (const candidate of pendingIceCandidatesRef.current) {
        await peerConnection.addIceCandidate(candidate)
      }
      pendingIceCandidatesRef.current = []
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      socket.send(JSON.stringify({ type: 'call-answer', to: call.peerId, answer, callType }))
      socket.send(JSON.stringify({ type: 'call-accepted', to: call.peerId, callType }))
      pendingOfferRef.current = null
      setCall((current) => (current ? { ...current, status: 'connected' } : null))
    } catch (err) {
      console.error('Accept call media error:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert(`${callType === 'video' ? 'Camera and microphone' : 'Microphone'} access was denied.`)
      }
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
    setLocalStream(null)
    setRemoteStream(null)
    pendingOfferRef.current = null
    pendingIceCandidatesRef.current = []
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null
    setMicMuted(false)
    setSpeakerMuted(false)
    setCameraOff(false)
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
  const callPeer = people.find((p) => p.id === call?.peerId) || { name: call?.peerName, username: 'user' }

  return (
    <main className={`app-shell ${detailsOpen && selectedPerson ? '' : 'details-hidden'}`}>
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
        <div
          className="brand-mark"
          onClick={() => { setSelectedId(null); setMobileView('inbox') }}
          role="button"
          tabIndex={0}
          title="Chaty - Return to Welcome"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedId(null); setMobileView('inbox') } }}
        >
          c<span>·</span>
        </div>
        <nav className="rail-nav" aria-label="Primary navigation">
          <button
            className={`rail-button ${!selectedPerson && mobileView === 'inbox' ? 'active' : ''}`}
            aria-label="Messages"
            title="All Messages"
            onClick={() => { setSelectedId(null); setMobileView('inbox') }}
          >
            <IconMessageSquare size={20} />
          </button>
          <button
            className="rail-button"
            aria-label="Explore"
            title="Search people"
            onClick={() => {
              setActiveTab('Inbox')
              setMobileView('inbox')
              searchInputRef.current?.focus()
            }}
          >
            <IconSearch size={20} />
          </button>
        </nav>
        <button
          className="rail-button profile-button"
          aria-label="Settings"
          title={`Signed in as ${name || 'User'} - Settings`}
          onClick={openSettings}
        >
          <div className="profile-dot">
            {(name || 'U').slice(0, 2).toUpperCase()}
            <span className={`profile-status-indicator ${connected ? 'online' : 'offline'}`} />
          </div>
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
          <IconSearch size={16} />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people..."
            aria-label="Search people"
          />
          {query && (
            <button
              className="search-clear-btn"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              title="Clear search"
              type="button"
            >
              <IconX size={14} />
            </button>
          )}
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
              <div className="conversation-section-header">Direct Messages</div>
              {filteredPeople.map((person) => (
                <button
                  key={person.id}
                  className={selectedId === person.id ? 'conversation selected' : 'conversation'}
                  onClick={() => {
                    setSelectedId(person.id)
                    setMobileView('chat')
                    setDetailsOpen(true)
                    setUnreadCounts((current) => ({ ...current, [person.id]: 0 }))
                  }}
                >
                  <Avatar person={person} size="sm" />
                  <span className="conversation-copy">
                    <div className="conversation-top-row">
                      <strong className="contact-name">{person.name}</strong>
                      <span className="conversation-time">
                        {person.online ? 'Active' : ''}
                      </span>
                    </div>
                    <span className="conversation-preview">
                      {typingUsers[person.id] ? (
                        <span className="typing-preview-text">Typing...</span>
                      ) : person.online ? (
                        'Online now · Start chatting'
                      ) : (
                        'Offline'
                      )}
                    </span>
                  </span>
                  {unreadCounts[person.id] > 0 && <span className="unread-count">{unreadCounts[person.id]}</span>}
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
                      setDetailsOpen(true)
                    }}
                  >
                    <Avatar person={requester} size="sm" />
                    <span className="conversation-copy">
                      <div className="conversation-top-row">
                        <strong className="contact-name">{requester.name}</strong>
                        <span className="conversation-badge-new">New</span>
                      </div>
                      <span className="conversation-preview">Wants to connect • {requester.online ? 'Online' : 'Offline'}</span>
                    </span>
                  </button>
                ) : null
              })}
            </>
          )}

          {filteredPeople.length === 0 && messageRequests.filter((r) => r.status === 'pending').length === 0 && (
            <div className="inbox-empty-state">
              <div className="inbox-empty-icon">
                <IconMessageSquare size={26} />
              </div>
              <h4>{query ? 'No contacts found' : 'No conversations yet'}</h4>
              <p>
                {query
                  ? `No people matched "${query}". Check spelling or try a different search.`
                  : 'Start a conversation by finding someone or exploring available contacts.'}
              </p>
              {query ? (
                <button className="inbox-clear-btn" onClick={() => setQuery('')}>
                  Clear search
                </button>
              ) : (
                <button
                  className="inbox-clear-btn"
                  onClick={() => searchInputRef.current?.focus()}
                >
                  Find People
                </button>
              )}
            </div>
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
        {selectedPerson ? (
          <>
            <header className="chat-header">
              <div className="chat-person">
                <button
                  className="mobile-back-btn"
                  aria-label="Back to contacts"
                  title="Back to contacts"
                  onClick={() => {
                    setMobileView('inbox')
                    setSelectedId(null)
                  }}
                >
                  <IconArrowLeft size={18} />
                </button>
                <Avatar person={selectedPerson} size="md" />
                <div className="chat-person-meta">
                  <h2>{selectedPerson.name}</h2>
                  <p className={selectedPerson.online ? 'active-status' : 'offline-status'}>
                    {isPeerTyping ? (
                      <span className="typing-pulse">Typing...</span>
                    ) : selectedPerson.online ? (
                      <><span className="status-dot online" /> Active now</>
                    ) : (
                      <><span className="status-dot offline" /> Offline</>
                    )}
                  </p>
                </div>
              </div>
              <div className="chat-actions">
                <button aria-label="Start voice call" title="Voice call" onClick={() => startCall('voice')}>
                  <IconPhone size={18} />
                </button>
                <button aria-label="Start video call" title="Video call" onClick={() => startCall('video')}>
                  <IconVideo size={18} />
                </button>
                <button
                  aria-label="Toggle contact details"
                  title="Contact details"
                  className={detailsOpen ? 'active' : ''}
                  onClick={() => setDetailsOpen((current) => !current)}
                >
                  <IconInfo size={18} />
                </button>
                <button aria-label="Open settings" title="Settings" onClick={openSettings}>
                  <IconMoreVertical size={18} />
                </button>
              </div>
            </header>
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
                      <div className="message-meta-row">
                        <small>{item.time}</small>
                        {item.from === 'me' && !item.deleted && (
                          <span className="message-read-receipt" title="Sent & Delivered">
                            <IconCheckCheck size={13} />
                          </span>
                        )}
                      </div>
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

            {/* Audio stream playback element */}
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
        ) : (
          <div className="welcome-screen">
            <div className="welcome-ambient-glow" />
            <div className="welcome-card">
              <div className="welcome-sparkle-pill">
                <IconSparkles size={15} />
                <span>Encrypted & Real-Time</span>
              </div>
              <h1 className="welcome-headline">
                Welcome back{name ? `, ${name}` : ''}!
              </h1>
              <p className="welcome-lead">
                Start a conversation with your friends, connect with peers, or launch crystal-clear voice and video calls.
              </p>

              <div className="welcome-cta-group">
                <button
                  className="welcome-cta-btn primary"
                  onClick={() => searchInputRef.current?.focus()}
                >
                  <IconSearch size={16} />
                  <span>Find someone</span>
                </button>
                {people.length > 0 && (
                  <button
                    className="welcome-cta-btn secondary"
                    onClick={() => {
                      const first = people[0]
                      if (first) {
                        setSelectedId(first.id)
                        setMobileView('chat')
                        setDetailsOpen(true)
                      }
                    }}
                  >
                    <IconMessageSquare size={16} />
                    <span>Start Chat</span>
                  </button>
                )}
                <button
                  className="welcome-cta-btn ghost"
                  onClick={() => {
                    setActiveTab('Inbox')
                    searchInputRef.current?.focus()
                  }}
                >
                  <IconUsers size={16} />
                  <span>Explore</span>
                </button>
              </div>

              <div className="welcome-highlights">
                <div className="highlight-item">
                  <div className="highlight-icon"><IconShield size={18} /></div>
                  <div className="highlight-body">
                    <strong>End-to-End Privacy</strong>
                    <p>Encrypted messaging, media sharing, and call signaling.</p>
                  </div>
                </div>
                <div className="highlight-item">
                  <div className="highlight-icon"><IconPhone size={18} /></div>
                  <div className="highlight-body">
                    <strong>Crystal Voice & Video</strong>
                    <p>Instant peer-to-peer WebRTC calls with ringtone alerts.</p>
                  </div>
                </div>
                <div className="highlight-item">
                  <div className="highlight-icon"><IconSparkles size={18} /></div>
                  <div className="highlight-body">
                    <strong>Live Social Presence</strong>
                    <p>Real-time typing status, unread badges, and active dots.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Details Side Panel */}
      {selectedPerson && (
        <aside className={`details-panel ${detailsOpen ? '' : 'details-collapsed'}`} aria-hidden={!detailsOpen}>
          <div className="details-heading">
            <p className="eyebrow">Contact Details</p>
            <button aria-label="Close details" title="Close contact details" onClick={() => setDetailsOpen(false)}>
              <IconX size={18} />
            </button>
          </div>
          <div className="detail-avatar">
            <Avatar person={selectedPerson} size="xl" />
          </div>
          <h2>{selectedPerson.name}</h2>
          <p className="detail-handle">
            <span className={`status-pill ${selectedPerson.online ? 'online' : 'offline'}`}>
              <span className="status-dot-sm" />
              {selectedPerson.online ? 'Online now' : 'Currently offline'}
            </span>
          </p>
          <div className="detail-actions">
            <button onClick={() => toggleMute(selectedPerson.id)} title={mutedIds.includes(selectedPerson.id) ? 'Unmute contact' : 'Mute contact'}>
              <span aria-hidden="true">◌</span> {mutedIds.includes(selectedPerson.id) ? 'Unmute' : 'Mute'}
            </button>
            <button onClick={() => startCall('voice')} title="Voice call">
              <IconPhone size={14} /> Call
            </button>
            <button onClick={() => startCall('video')} title="Video call">
              <IconVideo size={14} /> Video
            </button>
            <button onClick={openSettings} title="Settings & Info">
              <IconSettings size={14} /> Info
            </button>
          </div>
          <div className="detail-section">
            <div className="detail-row">
              <span>Media & photos</span><b>{visibleMessages.filter((m) => m.image).length}</b>
            </div>
            <div className="detail-row">
              <span>Messages exchanged</span><b>{visibleMessages.length}</b>
            </div>
            <div className="detail-row">
              <span>Privacy & security</span><b className="tag-protected">Protected</b>
            </div>
          </div>
          <div className="shared-note">
            <IconShield size={16} />
            <div>
              <strong>Encrypted Connection</strong>
              <p>Real-time delivery with auto-reconnect and instant audio calls.</p>
            </div>
          </div>
        </aside>
      )}

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
      {/* Full-Screen Voice Call Screen */}
      {call && call.status !== 'idle' && call.status !== 'incoming' && call.type === 'voice' && (
        <VoiceCallScreen
          call={call}
          peer={callPeer}
          callTimer={callTimer}
          formatDuration={formatCallDuration}
          micMuted={micMuted}
          onToggleMic={toggleMic}
          speakerMuted={speakerMuted}
          onToggleSpeaker={toggleSpeaker}
          onEndCall={() => endCall(true)}
        />
      )}

      {/* Full-Screen Video Call Screen */}
      {call && call.status !== 'idle' && call.status !== 'incoming' && call.type === 'video' && (
        <VideoCallScreen
          call={call}
          peer={callPeer}
          myAccount={account}
          localStream={localStream}
          remoteStream={remoteStream}
          callTimer={callTimer}
          formatDuration={formatCallDuration}
          micMuted={micMuted}
          onToggleMic={toggleMic}
          speakerMuted={speakerMuted}
          onToggleSpeaker={toggleSpeaker}
          cameraOff={cameraOff}
          onToggleCamera={toggleCamera}
          onSwitchCamera={switchCamera}
          onEndCall={() => endCall(true)}
        />
      )}

      {/* Incoming Call Notification Overlay */}
      {call && call.status === 'incoming' && (
        <IncomingCallModal
          call={call}
          peer={callPeer}
          onAccept={acceptCall}
          onDecline={rejectAudioCall}
        />
      )}
    </main>
  )
}

export default App

