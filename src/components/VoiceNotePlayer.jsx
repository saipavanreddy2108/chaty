import React, { useState, useRef } from 'react'
import { IconPlay, IconPause } from './Icons'

export function VoiceNotePlayer({ audioSrc }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef(null)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    const current = audioRef.current.currentTime
    const total = audioRef.current.duration || 1
    setProgress((current / total) * 100)
  }

  const handleEnded = () => {
    setIsPlaying(false)
    setProgress(0)
  }

  return (
    <div className= voice-note-player>
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload=metadata
      />
      <button
        type=button
        className=voice-play-btn
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {isPlaying ? <IconPause size={14} /> : <IconPlay size={14} />}
      </button>
      <div className=voice-waveform>
        <div className=voice-waveform-track>
          <div className=voice-waveform-fill style={{ width: progress + '%' }} />
        </div>
        <span className=voice-badge>Voice Note</span>
      </div>
    </div>
  )
}
