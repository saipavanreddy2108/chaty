import React from 'react'
import { Avatar } from '../Avatar'
import { CallControls } from './CallControls'

export function VoiceCallScreen({
  call,
  peer,
  callTimer,
  formatDuration,
  micMuted,
  onToggleMic,
  speakerMuted,
  onToggleSpeaker,
  onEndCall
}) {
  const statusLabels = {
    calling: 'Calling...',
    ringing: 'Ringing...',
    connecting: 'Connecting...',
    connected: 'Connected',
    reconnecting: 'Reconnecting...',
    ended: 'Call Ended'
  }

  const statusText = statusLabels[call?.status] || 'Calling...'
  const isConnecting = call?.status === 'calling' || call?.status === 'connecting' || call?.status === 'ringing'

  return (
    <div className="fullscreen-call-overlay voice-call-view" role="dialog" aria-modal="true" aria-label="Voice call">
      <div className="call-ambient-glow" />

      <header className="call-top-bar">
        <span className="call-security-badge">
          <span className="security-dot" />
          <span>Encrypted Voice Call</span>
        </span>
      </header>

      <main className="call-center-stage">
        <div className={'call-avatar-container ' + (isConnecting ? 'is-pulsing' : '')}>
          <div className="avatar-pulse-ring ring-1" />
          <div className="avatar-pulse-ring ring-2" />
          <div className="avatar-pulse-ring ring-3" />
          <Avatar
            person={peer}
            size="xl"
            showPresence={false}
            className="call-main-avatar"
          />
        </div>

        <h1 className="call-contact-name">{peer?.name || call?.peerName || 'Contact'}</h1>
        <p className="call-contact-handle">@{peer?.username || 'user'}</p>

        <div className="call-status-box">
          <span className={'call-status-indicator ' + (call?.status === 'connected' ? 'connected' : 'waiting')}>
            {statusText}
          </span>
          {call?.status === 'connected' && (
            <span className="call-duration-timer">
              {formatDuration ? formatDuration(callTimer) : callTimer}
            </span>
          )}
        </div>
      </main>

      <footer className="call-bottom-bar">
        <CallControls
          callType="voice"
          micMuted={micMuted}
          onToggleMic={onToggleMic}
          speakerMuted={speakerMuted}
          onToggleSpeaker={onToggleSpeaker}
          onEndCall={onEndCall}
        />
      </footer>
    </div>
  )
}
