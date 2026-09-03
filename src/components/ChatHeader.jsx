import React from 'react'
import {
  IconArrowLeft,
  IconSearch,
  IconPhone,
  IconInfo,
  IconBellOff,
  IconX
} from './Icons'
import { Avatar } from './Avatar'

export function ChatHeader({
  selectedPerson,
  isPeerTyping,
  isSelectedMuted,
  setMobileView,
  chatSearchOpen,
  setChatSearchOpen,
  chatSearchQuery,
  setChatSearchQuery,
  matchCount,
  startAudioCall,
  detailsOpen,
  setDetailsOpen
}) {
  return (
    <>
      <header className= chat-header>
        <div className=chat-header-left>
          <button
            className=mobile-back-btn icon-btn
            onClick={() => setMobileView('inbox')}
            aria-label=Back to messages
          >
            <IconArrowLeft size={18} />
          </button>
          <Avatar person={selectedPerson} size=md />
          <div className=chat-header-meta>
            <div className=chat-header-name-row>
              <h3>{selectedPerson.name}</h3>
              {isSelectedMuted && <IconBellOff size={14} className=text-muted title=Muted />}
            </div>
            <span className=chat-header-status>
              {isPeerTyping ? (
                <span className=typing-text>Typing...</span>
              ) : selectedPerson.online ? (
                <span className=status-online-text>Active now</span>
              ) : (
                <span className=status-offline-text>Offline</span>
              )}
            </span>
          </div>
        </div>

        <div className=chat-header-actions>
          <button
            className={'icon-btn ' + (chatSearchOpen ? 'active' : '')}
            onClick={() => {
              setChatSearchOpen(!chatSearchOpen)
              if (chatSearchOpen) setChatSearchQuery('')
            }}
            title=Search messages in chat
            aria-label=Search in conversation
          >
            <IconSearch size={18} />
          </button>

          <button
            className=icon-btn
            onClick={startAudioCall}
            title=Start voice call
            aria-label=Call contact
          >
            <IconPhone size={18} />
          </button>

          <button
            className={'icon-btn ' + (detailsOpen ? 'active' : '')}
            onClick={() => setDetailsOpen(!detailsOpen)}
            title=Toggle contact info
            aria-label=Toggle details
          >
            <IconInfo size={18} />
          </button>
        </div>
      </header>

      {chatSearchOpen && (
        <div className=inchat-search-bar>
          <IconSearch size={16} className=text-muted />
          <input
            type=text
            value={chatSearchQuery}
            onChange={(e) => setChatSearchQuery(e.target.value)}
            placeholder=Search in this conversation...
            autoFocus
          />
          {chatSearchQuery && (
            <span className=search-count-pill>
              {matchCount} match{matchCount === 1 ? '' : 'es'}
            </span>
          )}
          <button
            className=icon-btn-sm
            onClick={() => {
              setChatSearchOpen(false)
              setChatSearchQuery('')
            }}
            aria-label=Close search
          >
            <IconX size={16} />
          </button>
        </div>
      )}
    </>
  )
}
