import React from 'react'

export function Avatar({ person, size = 'md', small = false, showPresence = true, className = '' }) {
  const actualSize = small ? 'sm' : size
  const sizeMap = {
    xs: 'avatar-xs',
    sm: 'avatar-sm',
    md: 'avatar-md',
    lg: 'avatar-lg',
    xl: 'avatar-xl'
  }
  const colorClass = 'avatar-' + (person?.color || 'teal')
  const initials = person?.avatar || (person?.name || person?.username || 'U').slice(0, 2).toUpperCase()

  return (
    <div className={`avatar ${sizeMap[actualSize] || 'avatar-md'} ${colorClass} ${className}`}>
      {person?.avatarUrl ? (
        <img src={person.avatarUrl} alt={person.name || 'User avatar'} className="avatar-img" />
      ) : (
        <span className="avatar-text">{initials}</span>
      )}
      {showPresence && (
        <span
          className={`presence-dot ${person?.online ? 'online' : 'offline'}`}
          title={person?.online ? 'Online now' : 'Offline'}
        >
          {person?.online && <span className="presence-ring" />}
        </span>
      )}
    </div>
  )
}
