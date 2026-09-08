import React from 'react'
import {
  IconMic,
  IconMicOff,
  IconVolume2,
  IconVolumeX,
  IconVideo,
  IconVideoOff,
  IconPhoneOff,
  IconCameraSwitch
} from '../Icons'

export function CallControls({
  callType = 'voice',
  micMuted,
  onToggleMic,
  speakerMuted,
  onToggleSpeaker,
  cameraOff,
  onToggleCamera,
  onSwitchCamera,
  onEndCall,
  className = ''
}) {
  return (
    <div className={'call-controls-bar ' + className} role="toolbar" aria-label="Call controls">
      {/* 1. Microphone Toggle */}
      <button
        type="button"
        className={'call-ctrl-btn ' + (micMuted ? 'muted' : '')}
        onClick={onToggleMic}
        title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
        aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
        aria-pressed={micMuted}
      >
        <span className="ctrl-icon-wrap">
          {micMuted ? <IconMicOff size={22} /> : <IconMic size={22} />}
        </span>
        <span className="ctrl-label">{micMuted ? 'Unmute' : 'Mute'}</span>
      </button>

      {/* 2. Camera Toggle (Video calls only) */}
      {callType === 'video' && (
        <button
          type="button"
          className={'call-ctrl-btn ' + (cameraOff ? 'muted' : '')}
          onClick={onToggleCamera}
          title={cameraOff ? 'Turn on camera' : 'Turn off camera'}
          aria-label={cameraOff ? 'Turn on camera' : 'Turn off camera'}
          aria-pressed={cameraOff}
        >
          <span className="ctrl-icon-wrap">
            {cameraOff ? <IconVideoOff size={22} /> : <IconVideo size={22} />}
          </span>
          <span className="ctrl-label">{cameraOff ? 'Start Video' : 'Stop Video'}</span>
        </button>
      )}

      {/* 3. Speaker / Audio output */}
      <button
        type="button"
        className={'call-ctrl-btn ' + (speakerMuted ? 'muted' : '')}
        onClick={onToggleSpeaker}
        title={speakerMuted ? 'Unmute audio' : 'Mute audio'}
        aria-label={speakerMuted ? 'Unmute audio' : 'Mute audio'}
        aria-pressed={speakerMuted}
      >
        <span className="ctrl-icon-wrap">
          {speakerMuted ? <IconVolumeX size={22} /> : <IconVolume2 size={22} />}
        </span>
        <span className="ctrl-label">{speakerMuted ? 'Muted' : 'Speaker'}</span>
      </button>

      {/* 4. Flip camera (Optional, shown in video mode if onSwitchCamera provided) */}
      {callType === 'video' && onSwitchCamera && (
        <button
          type="button"
          className="call-ctrl-btn"
          onClick={onSwitchCamera}
          title="Switch camera"
          aria-label="Switch camera"
        >
          <span className="ctrl-icon-wrap">
            <IconCameraSwitch size={22} />
          </span>
          <span className="ctrl-label">Flip</span>
        </button>
      )}

      {/* 5. End Call button (distinct red/danger) */}
      <button
        type="button"
        className="call-ctrl-btn end-call"
        onClick={onEndCall}
        title="End Call"
        aria-label="End call"
      >
        <span className="ctrl-icon-wrap end-icon">
          <IconPhoneOff size={24} />
        </span>
        <span className="ctrl-label">End Call</span>
      </button>
    </div>
  )
}
