import React from 'react'
import { IconDownload, IconX } from './Icons'

export function Lightbox({ lightboxImage, setLightboxImage }) {
  if (!lightboxImage) return null

  return (
    <div className= lightbox-backdrop onClick={() => setLightboxImage(null)}>
      <div className=lightbox-modal onClick={(e) => e.stopPropagation()}>
        <div className=lightbox-top-bar>
          <a
            href={lightboxImage}
            download=chaty-photo.jpg
            className=icon-btn text-white
            title=Download image
          >
            <IconDownload size={20} />
          </a>
          <button
            className=icon-btn text-white
            onClick={() => setLightboxImage(null)}
            aria-label=Close image preview
          >
            <IconX size={22} />
          </button>
        </div>
        <img src={lightboxImage} alt=Full preview className=lightbox-img />
      </div>
    </div>
  )
}
