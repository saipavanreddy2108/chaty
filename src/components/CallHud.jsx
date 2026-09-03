import React from 'react'
import {
  IconPhoneIncoming,
  IconPhoneOff,
  IconMic,
  IconMicOff,
  IconVolume2,
  IconVolumeX
} from './Icons'
import { Avatar } from './Avatar'

export function CallHud({
  call,
  selectedPerson,
  callTimer,
  formatDuration,
  acceptAudioCall,
  rejectAudioCall,
  endCall,
  micMuted,
  setMicMuted,
  speakerMuted,
  setSpeakerMuted
}) {
  if (!call) return null

  return (
    <div className={'call-hud call-' + call.status}>
      <div className= call-hud-info>
        <div className=call-pulse-avatar>
          <Avatar person={selectedPerson} size=sm showPresence={false} />
        </div>
        <div>
          <h4 className=call-hud-title>
            {call.status === 'incoming' && 'Incoming call from ' + call.peerName + '...'}
            {call.status === 'calling' && 'Calling ' + call.peerName + '...'}
            {call.status === 'connected' && 'Call with ' + call.peerName}
            {call.status === 'error' && 'Call could not connect'}
          </h4>
          {call.status === 'connected' && (
            <span className=call-timer-text>{formatDuration(callTimer)}</span>
          )}
        </div>
      </div>

      <div className=call-hud-controls>
        {call.status === 'incoming' && (
          <>
            <button className=btn btn-success call-btn onClick={acceptAudioCall}>
              <IconPhoneIncoming size={16} /> Accept
            </button>
            <button className=btn btn-danger call-btn onClick={rejectAudioCall}>
              <IconPhoneOff size={16} /> Decline
            </button>
          </>
        )}
        {call.status === 'connected' && (
          <>
            <button
              className={'btn-call-tool ' + (micMuted ? 'active' : '')}
              onClick={() => setMicMuted(!micMuted)}
              title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {micMuted ? <IconMicOff size={16} /> : <IconMic size={16} />}
            </button>
            <button
              className={'btn-call-tool ' + (speakerMuted ? 'active' : '')}
              onClick={() => setSpeakerMuted(!speakerMuted)}
              title={speakerMuted ? 'Unmute speaker' : 'Mute speaker'}
            >
              {speakerMuted ? <IconVolumeX size={16} /> : <IconVolume2 size={16} />}
            </button>
            <button className=btn btn-danger call-btn onClick={() => endCall(true)}>
              <IconPhoneOff size={16} /> End Call
            </button>
          </>
        )}
        {call.status === 'calling' && (
          <button className=btn btn-danger call-btn onClick={() => endCall(true)}>
            <IconPhoneOff size={16} /> Cancel
          </button>
        )}
      </div>
    </div>
  )
}
