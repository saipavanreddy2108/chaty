import React from 'react'
import {
  IconX,
  IconPhone,
  IconBell,
  IconBellOff,
  IconSearch,
  IconShield
} from './Icons'
import { Avatar } from './Avatar'

export function DetailsPanel({
  selectedPerson,
  setDetailsOpen,
  startAudioCall,
  isSelectedMuted,
  toggleMute,
  setChatSearchOpen,
  sharedMedia,
  setLightboxImage
}) {
  if (!selectedPerson) return null

  return (
    <aside className= details-column aria-label=Conversation Details>
      <div className=details-header>
        <h3>Contact Info</h3>
        <button className=icon-btn-sm onClick={() => setDetailsOpen(false)} aria-label=Close details>
          <IconX size={18} />
        </button>
      </div>

      <div className=details-body>
        <div className=details-profile-card>
          <Avatar person={selectedPerson} size=xl />
          <h2 className=details-name>{selectedPerson.name}</h2>
          <span className=details-handle>@{selectedPerson.username || 'user'}</span>
          <span className={'details-status-tag ' + (selectedPerson.online ? 'online' : 'offline')}>
            {selectedPerson.online ? 'Active now' : 'Offline'}
          </span>
        </div>

        <div className=details-quick-actions>
          <button className=quick-action-card onClick={startAudioCall}>
            <div className=action-icon-circle>
              <IconPhone size={18} />
            </div>
            <span>Call</span>
          </button>

          <button className=quick-action-card onClick={() => toggleMute(selectedPerson.id)}>
            <div className=action-icon-circle>
              {isSelectedMuted ? <IconBellOff size={18} className=text-danger /> : <IconBell size={18} />}
            </div>
            <span>{isSelectedMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          <button
            className=quick-action-card
            onClick={() => {
              setChatSearchOpen(true)
              setDetailsOpen(false)
            }}
          >
            <div className=action-icon-circle>
              <IconSearch size={18} />
            </div>
            <span>Search</span>
          </button>
        </div>

        <div className=details-section>
          <div className=details-section-header>
            <h4>Shared Media</h4>
            <span className=section-count>{sharedMedia.length}</span>
          </div>
          {sharedMedia.length > 0 ? (
            <div className=shared-media-grid>
              {sharedMedia.map((m) => (
                <div
                  key={m.id}
                  className=shared-media-thumb-box
                  onClick={() => setLightboxImage(m.image)}
                >
                  <img src={m.image} alt=Shared className=shared-media-thumb />
                </div>
              ))}
            </div>
          ) : (
            <p className=details-empty-note>No shared photos in this conversation yet.</p>
          )}
        </div>

        <div className=details-section>
          <div className=details-section-header>
            <h4>Security and Privacy</h4>
          </div>
          <div className=security-card>
            <IconShield size={18} className=text-accent />
            <div>
              <strong>Live WebSocket Security</strong>
              <p>Real-time delivery with session tokens and sub-10ms cloud sync.</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
