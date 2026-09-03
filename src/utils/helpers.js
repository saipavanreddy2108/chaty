export function makePerson(user) {
  const displayName = user.name || user.username || 'User'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return { ...user, avatar: initials || 'U' }
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, totalSeconds || 0)
  const m = String(Math.floor(s / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return m + ':' + sec
}

export function compressImage(file, maxWidth = 900, maxHeight = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          } else {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = event.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export const EMOJI_CATEGORIES = [
  { name: 'Smileys', icon: '😀', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😋','😛','😜','🤪','😝','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😌','😔','😪','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬'] },
  { name: 'Gestures', icon: '👍', emojis: ['👍','👎','👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦵','🦶','👂','👃','🧠','👀','👁️','👅','👄'] },
  { name: 'Hearts', icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','✨','⭐','🌟','💫','⚡','🔥'] },
  { name: 'Fun', icon: '🎉', emojis: ['🎉','🎊','🎈','🎂','🎁','🏆','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🎾','🏐','🎱','🏓','🥊','🎯','🎮','🎲','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','📱','💻','⌨️','🖥️','📷','💡','📚','💰','💸'] },
  { name: 'Food', icon: '☕', emojis: ['☕','🍵','🧃','🥤','🍺','🍻','🥂','🍷','🍕','🍔','🍟','🌭','🥪','🌮','🌯','🥙','🥗','🍝','🍜','🍣','🍱','🍦','🍰','🧁','🍫','🍬','🍭','🍩','🍪'] }
]

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']
