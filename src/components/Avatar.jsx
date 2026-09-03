import React from 'react'

export function Avatar({ person, size = 'md', showPresence = true, className = '' }) {
  const sizeMap = {
    sm: 'avatar-sm',
    md: 'avatar-md',
    lg: 'avatar-lg',
    xl: 'avatar-xl'
  }
  const colorClass = 'avatar-' + (person?.color || 'coral')
  const initials = person?.avatar || (person?.name || person?.username || 'U').slice(0, 2).toUpperCase()

  return (
    <div className={'avatar ' + (sizeMap[size] || 'avatar-md') + ' ' + colorClass + ' ' + className}>
      <span className= avatar-text>{initials}</span>
      {showPresence && (
        <span
          className={'presence-dot ' + (person?.online ? 'online' : 'offline')}
          title={person?.online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  )
}
