import React from 'react'

export function Toast({ toastMessage }) {
  if (!toastMessage) return null

  return (
    <div className= app-toast>
      <span>{toastMessage}</span>
    </div>
  )
}
