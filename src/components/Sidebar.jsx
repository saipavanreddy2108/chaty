import React from 'react'
import {
  IconMessageSquare,
  IconUsers,
  IconStar,
  IconSettings,
  IconSun,
  IconMoon
} from './Icons'
import { Avatar } from './Avatar'

export function Sidebar({
  activeNavTab,
  setActiveNavTab,
  setInboxFilter,
  messageRequests,
  theme,
  setTheme,
  openSettings,
  currentUserName,
  currentUserColor,
  connected
}) {
  const pendingRequestsCount = messageRequests.filter((r) => r.status === 'pending').length

  return (
    <aside className= rail-sidebar aria-label=Navigation>
      <div className=rail-brand title=Chaty>
        <div className=brand-icon-box>
          <IconMessageSquare size={20} />
        </div>
      </div>

      <nav className=rail-nav>
        <button
          className={'rail-btn ' + (activeNavTab === 'chats' ? 'active' : '')}
          onClick={() => {
            setActiveNavTab('chats')
            setInboxFilter('all')
          }}
          title=All Chats
          aria-label=Chats
        >
          <IconMessageSquare size={20} />
          <span className=rail-tooltip>Chats</span>
        </button>

        <button
          className={'rail-btn ' + (activeNavTab === 'requests' ? 'active' : '')}
          onClick={() => {
            setActiveNavTab('requests')
            setInboxFilter('requests')
          }}
          title=Message Requests
          aria-label=Requests
        >
          <IconUsers size={20} />
          {pendingRequestsCount > 0 && (
            <span className=rail-badge>{pendingRequestsCount}</span>
          )}
          <span className=rail-tooltip>Requests</span>
        </button>

        <button
          className={'rail-btn ' + (activeNavTab === 'saved' ? 'active' : '')}
          onClick={() => setActiveNavTab('saved')}
          title=Starred Messages
          aria-label=Saved
        >
          <IconStar size={20} filled={activeNavTab === 'saved'} />
          <span className=rail-tooltip>Starred</span>
        </button>
      </nav>

      <div className=rail-bottom>
        <button
          className=rail-btn
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={'Switch to ' + (theme === 'dark' ? 'Light' : 'Dark') + ' mode'}
          aria-label=Toggle theme
        >
          {theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
          <span className=rail-tooltip>Theme</span>
        </button>

        <button
          className=rail-btn
          onClick={openSettings}
          title=Preferences and Settings
          aria-label=Settings
        >
          <IconSettings size={20} />
          <span className=rail-tooltip>Settings</span>
        </button>

        <button
          className=rail-profile-trigger
          onClick={openSettings}
          title={'Signed in as ' + currentUserName}
          aria-label=Profile
        >
          <Avatar
            person={{ name: currentUserName, color: currentUserColor || 'coral', online: connected }}
            size=sm
          />
        </button>
      </div>
    </aside>
  )
}
