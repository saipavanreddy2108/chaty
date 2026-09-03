import React from 'react'
import {
  IconSearch,
  IconX,
  IconRefresh,
  IconUsers,
  IconStar,
  IconBellOff
} from './Icons'
import { Avatar } from './Avatar'

export function ConversationList({
  mobileView,
  filteredPeople,
  selectedId,
  setSelectedId,
  setMobileView,
  unreadCounts,
  setUnreadCounts,
  mutedUsers,
  typingUsers,
  messages,
  currentUserId,
  query,
  setQuery,
  connected,
  reconnecting,
  socket,
  inboxFilter,
  setInboxFilter,
  messageRequests,
  activeNavTab
}) {
  const pendingRequestsCount = messageRequests.filter((r) => r.status === 'pending').length

  return (
    <section className={'inbox-column ' + (mobileView === 'chat' ? 'mobile-hide' : '')}>
      <header className= inbox-header>
        <div className=inbox-header-title-row>
          <div className=inbox-title-group>
            <h2>Messages</h2>
            <span className=inbox-counter>{filteredPeople.length}</span>
          </div>
          <div className=inbox-header-actions>
            <span
              className={'status-pill ' + (connected ? 'status-online' : reconnecting ? 'status-reconnecting' : 'status-offline')}
              title={connected ? 'Connected live' : reconnecting ? 'Reconnecting...' : 'Offline'}
            >
              <span className=status-dot />
              <span>{connected ? 'Live' : reconnecting ? 'Reconnecting' : 'Offline'}</span>
            </span>
            <button
              className=icon-btn
              onClick={() => socket?.send(JSON.stringify({ type: 'ping' }))}
              title=Refresh network sync
              aria-label=Refresh
            >
              <IconRefresh size={16} />
            </button>
          </div>
        </div>

        <div className=inbox-search-bar>
          <IconSearch size={16} className=search-icon />
          <input
            type=text
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder=Search conversations...
            aria-label=Search conversations
          />
          {query && (
            <button className=search-clear-btn onClick={() => setQuery('')} aria-label=Clear search>
              <IconX size={14} />
            </button>
          )}
        </div>

        {activeNavTab !== 'saved' && (
          <div className=inbox-filter-tabs>
            <button
              className={'filter-tab ' + (inboxFilter === 'all' ? 'active' : '')}
              onClick={() => setInboxFilter('all')}
            >
              All
            </button>
            <button
              className={'filter-tab ' + (inboxFilter === 'unread' ? 'active' : '')}
              onClick={() => setInboxFilter('unread')}
            >
              Unread
            </button>
            <button
              className={'filter-tab ' + (inboxFilter === 'requests' ? 'active' : '')}
              onClick={() => setInboxFilter('requests')}
            >
              Requests
              {pendingRequestsCount > 0 && (
                <span className=filter-badge>{pendingRequestsCount}</span>
              )}
            </button>
          </div>
        )}
      </header>

      <div className=conversation-scroll-list>
        {activeNavTab === 'saved' ? (
          <div className=saved-messages-intro>
            <IconStar size={26} filled className=text-accent />
            <h3>Starred Messages</h3>
            <p>Messages you star across your chats are collected here for quick access.</p>
          </div>
        ) : (
          <>
            {filteredPeople.map((person) => {
              const isSelected = selectedId === person.id
              const isMuted = mutedUsers.includes(person.id)
              const unread = unreadCounts[person.id] || 0
              const isTyping = typingUsers[person.id]
              const lastMsg = messages
                .filter(
                  (m) =>
                    (m.from === person.id && m.to === currentUserId) ||
                    (m.from === 'me' && m.to === person.id)
                )
                .slice(-1)[0]

              return (
                <button
                  key={person.id}
                  className={'conv-item ' + (isSelected ? 'selected' : '') + ' ' + (unread > 0 ? 'has-unread' : '')}
                  onClick={() => {
                    setSelectedId(person.id)
                    setMobileView('chat')
                    setUnreadCounts((current) => ({ ...current, [person.id]: 0 }))
                  }}
                >
                  <Avatar person={person} size=md />
                  <div className=conv-info>
                    <div className=conv-top-line>
                      <span className=conv-name>{person.name}</span>
                      {lastMsg && <span className=conv-time>{lastMsg.time}</span>}
                    </div>
                    <div className=conv-bottom-line>
                      <span className=conv-preview>
                        {isTyping ? (
                          <span className=typing-text>Typing...</span>
                        ) : lastMsg ? (
                          lastMsg.deleted ? (
                            <em className=deleted-snippet>Message deleted</em>
                          ) : lastMsg.image ? (
                            <span>Photo</span>
                          ) : lastMsg.audio ? (
                            <span>Voice message</span>
                          ) : (
                            lastMsg.text
                          )
                        ) : (
                          <span className=status-snippet>{person.online ? 'Online now' : 'Offline'}</span>
                        )}
                      </span>
                      <div className=conv-badges>
                        {isMuted && <IconBellOff size={13} className=muted-icon />}
                        {unread > 0 && <span className=unread-badge>{unread}</span>}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}

            {filteredPeople.length === 0 && (
              <div className=empty-conversations>
                <IconUsers size={32} className=empty-icon />
                <p className=empty-title>No contacts found</p>
                <p className=empty-desc>
                  {query
                    ? 'No contacts match your search query.'
                    : 'Open Chaty in another browser tab and create a second username to test live messaging.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
