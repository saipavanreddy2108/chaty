import React from 'react'
import { Avatar } from '../Avatar'
import { IconPhoneIncoming, IconPhoneOff, IconVideo } from '../Icons'

export function IncomingCallModal({
  call,
  peer,
  onAccept,
  onDecline
}) {
  if (!call || call.status !== 'incoming') return null

  const isVideo = call.type === 'video'

  return (
    <div className="incoming-call-backdrop" role="alertdialog" aria-modal="true" aria-label="Incoming call">
      <div className="incoming-call-card">
        <div className="incoming-call-header">
          <span className="incoming-tag">
            {isVideo ? <IconVideo size={16} /> : <IconPhoneIncoming size={16} />}
            <span>Incoming {isVideo ? 'Video' : 'Voice'} Call</span>
          </span>
        </div>

        <div className="incoming-avatar-wrap">
          <div className="avatar-pulse-ring ring-1" />
          <div className="avatar-pulse-ring ring-2" />
          <Avatar person={peer || { name: call.peerName }} size="xl" showPresence={false} />
        </div>

        <h2 className="incoming-caller-name">{call.peerName || 'Incoming Call'}</h2>
        <p className="incoming-subtext">
          {isVideo ? 'is inviting you to a video call...' : 'is calling you...'}
        </p>

        <div className="incoming-actions-row">
          <button
            type="button"
            className="btn-call-decline"
            onClick={onDecline}
            title="Decline call"
            aria-label="Decline call"
          >
            <IconPhoneOff size={22} />
            <span>Decline</span>
          </button>

          <button
            type="button"
            className="btn-call-accept"
            onClick={onAccept}
            title="Accept call"
            aria-label="Accept call"
          >
            {isVideo ? <IconVideo size={22} /> : <IconPhoneIncoming size={22} />}
            <span>Accept</span>
          </button>
        </div>
      </div>
    </div>
  )
}
