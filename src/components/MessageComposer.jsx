import React from 'react'
import {
  IconReply,
  IconX,
  IconPaperclip,
  IconSmile,
  IconMic,
  IconSend
} from './Icons'

export function MessageComposer({
  replyingTo,
  setReplyingTo,
  selectedImage,
  setSelectedImage,
  recordingVoice,
  voiceDuration,
  formatDuration,
  stopVoiceRecording,
  emojiPickerOpen,
  setEmojiPickerOpen,
  emojiCategories,
  activeEmojiCategory,
  setActiveEmojiCategory,
  handleSelectEmoji,
  editingMessageId,
  cancelEdit,
  fileInputRef,
  messageInputRef,
  message,
  handleInputChange,
  selectedPerson,
  startVoiceRecording,
  submitComposer
}) {
  return (
    <footer className= composer-footer>
      {replyingTo && (
        <div className=composer-reply-banner>
          <div className=reply-banner-content>
            <IconReply size={14} className=text-accent />
            <div>
              <span className=reply-to-name>Replying to {replyingTo.fromName}</span>
              <span className=reply-to-text>{replyingTo.text}</span>
            </div>
          </div>
          <button className=icon-btn-sm onClick={() => setReplyingTo(null)} aria-label=Cancel reply>
            <IconX size={14} />
          </button>
        </div>
      )}

      {selectedImage && (
        <div className=composer-image-preview>
          <img src={selectedImage} alt=Ready to send className=preview-thumb />
          <span className=preview-info>Photo attachment ready</span>
          <button className=icon-btn-sm text-danger onClick={() => setSelectedImage(null)} aria-label=Remove photo>
            <IconX size={16} />
          </button>
        </div>
      )}

      {recordingVoice ? (
        <div className=voice-recording-hud>
          <div className=recording-pulse-box>
            <span className=rec-dot />
            <span className=rec-time>Recording: {formatDuration(voiceDuration)}</span>
          </div>
          <div className=rec-actions>
            <button className=btn btn-secondary btn-sm onClick={() => stopVoiceRecording(false)}>
              Cancel
            </button>
            <button className=btn btn-primary btn-sm onClick={() => stopVoiceRecording(true)}>
              Send Voice Note
            </button>
          </div>
        </div>
      ) : (
        <>
          {emojiPickerOpen && (
            <div className=emoji-picker-container>
              <div className=emoji-categories-bar>
                {emojiCategories.map((cat, idx) => (
                  <button
                    key={cat.name}
                    type=button
                    className={'emoji-cat-tab ' + (activeEmojiCategory === idx ? 'active' : '')}
                    onClick={() => setActiveEmojiCategory(idx)}
                  >
                    <span>{cat.icon}</span>
                    <span className=cat-label>{cat.name}</span>
                  </button>
                ))}
              </div>
              <div className=emoji-tiles-grid>
                {emojiCategories[activeEmojiCategory].emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type=button
                    className=emoji-tile-btn
                    onClick={() => handleSelectEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form className=composer-form onSubmit={submitComposer}>
            {editingMessageId && (
              <button type=button className=composer-cancel-edit onClick={cancelEdit}>
                Cancel edit
              </button>
            )}

            <button
              type=button
              className=composer-tool-btn
              onClick={() => fileInputRef.current?.click()}
              title=Attach Photo
              aria-label=Attach photo
            >
              <IconPaperclip size={20} />
            </button>

            <input
              ref={messageInputRef}
              type=text
              className=composer-input
              value={message}
              onChange={handleInputChange}
              placeholder={
                editingMessageId
                  ? 'Edit your message...'
                  : 'Write a message to ' + (selectedPerson?.name?.split(' ')[0] || 'chat') + '...'
              }
              aria-label=Write a message
            />

            <button
              type=button
              className={'composer-tool-btn ' + (emojiPickerOpen ? 'active' : '')}
              onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
              title=Emoji palette
              aria-label=Pick emoji
            >
              <IconSmile size={20} />
            </button>

            <button
              type=button
              className=composer-tool-btn
              onClick={startVoiceRecording}
              title=Record voice message
              aria-label=Record voice
            >
              <IconMic size={20} />
            </button>

            <button
              type=submit
              className=composer-send-btn
              disabled={!message.trim() && !selectedImage}
              title=Send message
              aria-label=Send
            >
              <IconSend size={18} />
            </button>
          </form>
        </>
      )}
    </footer>
  )
}
