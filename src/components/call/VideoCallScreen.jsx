import React, { useEffect, useRef } from 'react'
import { Avatar } from '../Avatar'
import { CallControls } from './CallControls'
import { IconVideoOff } from '../Icons'

export function VideoCallScreen({
  call,
  peer,
  myAccount,
  localStream,
  remoteStream,
  callTimer,
  formatDuration,
  micMuted,
  onToggleMic,
  speakerMuted,
  onToggleSpeaker,
  cameraOff,
  onToggleCamera,
  onSwitchCamera,
  onEndCall
}) {
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream])

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream
    }
  }, [remoteStream])

  const statusLabels = {
    calling: 'Calling...',
    ringing: 'Ringing...',
    connecting: 'Connecting video...',
    connected: 'Connected',
    reconnecting: 'Reconnecting...',
    ended: 'Call Ended'
  }

  const statusText = statusLabels[call?.status] || 'Connecting...'
  const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live')

  return (
    <div className="fullscreen-call-overlay video-call-view" role="dialog" aria-modal="true" aria-label="Video call">
      {/* 1. Main Stage: Remote Video or Remote Avatar Fallback */}
      <div className="video-stage-remote">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={'remote-video-stream ' + (hasRemoteVideo ? 'active' : 'hidden')}
        />

        {(!hasRemoteVideo || call?.status !== 'connected') && (
          <div className="remote-video-fallback">
            <div className="call-avatar-container is-pulsing">
              <Avatar person={peer} size="xl" showPresence={false} />
            </div>
            <h2 className="fallback-peer-name">{peer?.name || call?.peerName || 'Contact'}</h2>
            <span className="fallback-status-text">
              {call?.status === 'connected' ? 'Camera is turned off' : statusText}
            </span>
          </div>
        )}
      </div>

      {/* 2. Top Info Header Pill */}
      <header className="video-top-bar">
        <div className="video-header-pill">
          <span className="video-peer-name">{peer?.name || call?.peerName || 'Contact'}</span>
          <span className="video-pill-dot" />
          <span className="video-call-status">
            {call?.status === 'connected' ? (formatDuration ? formatDuration(callTimer) : callTimer) : statusText}
          </span>
        </div>
      </header>

      {/* 3. Floating Picture-in-Picture Self Preview */}
      <div className="video-self-preview-card" aria-label="Your camera preview">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={'self-video-stream ' + (cameraOff ? 'hidden' : 'active')}
        />
        {cameraOff && (
          <div className="self-preview-avatar-fallback">
            <Avatar person={myAccount?.user || { name: 'Me' }} size="md" showPresence={false} />
            <span className="camera-off-indicator" title="Camera is off">
              <IconVideoOff size={14} />
            </span>
          </div>
        )}
        <div className="self-preview-label">You</div>
      </div>

      {/* 4. Bottom Floating Glass Control Bar */}
      <footer className="call-bottom-bar video-bottom-bar">
        <CallControls
          callType="video"
          micMuted={micMuted}
          onToggleMic={onToggleMic}
          speakerMuted={speakerMuted}
          onToggleSpeaker={onToggleSpeaker}
          cameraOff={cameraOff}
          onToggleCamera={onToggleCamera}
          onSwitchCamera={onSwitchCamera}
          onEndCall={onEndCall}
        />
      </footer>
    </div>
  )
}
