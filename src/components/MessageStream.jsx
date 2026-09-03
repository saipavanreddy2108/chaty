import React from 'react'
import {
  IconReply,
  IconCopy,
  IconStar,
  IconEdit,
  IconTrash,
  IconCheckCheck
} from './Icons'
import { Avatar } from './Avatar'
import { VoiceNotePlayer } from './VoiceNotePlayer'

export function MessageStream({
  visibleMessages,
  selectedPerson,
  starredMessages,
  toggleReaction,
  quickReactions,
  setReplyingTo,
  copyMessage,
  toggleStar,
  beginEdit,
  removeMessage,
  setLightboxImage,
  isPeerTyping,
  messageRequests,
  respondToRequest,
  chatContentRef
}) {
  const pendingRequest = messageRequests.find(
    (r) => r.from === selectedPerson?.id && r.status === 'pending'
  )

  return (
    <div className= chat-stream ref={chatContentRef}>
      {/* Message Request Banner */}
      {pendingRequest && (
        <div className=request-banner-box>
          <div className=request-banner-text>
            <strong>Message Request</strong>
            <p>{selectedPerson.name} sent you a connection request.</p>
          </div>
          <div className=request-banner-actions>
            <button
              className=btn btn-primary btn-sm
              onClick={() => respondToRequest(pendingRequest.requestId, 'accepted')}
            >
              Accept
            </button>
            <button
              className=btn btn-secondary btn-sm
              onClick={() => respondToRequest(pendingRequest.requestId, 'deleted')}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {visibleMessages.length === 0 && (
        <div className=chat-empty-state>
          <Avatar person={selectedPerson} size=lg />
          <h3>{selectedPerson?.name}</h3>
          <p>This is the start of your live encrypted conversation with {selectedPerson?.name}.</p>
        </div>
      )}

      <div className=messages-flow>
        {visibleMessages.map((item) => {
          const isMine = item.from === 'me'
          const isStarred = starredMessages.includes(item.id)
          const reactions = item.reactions || {}
          const reactionEntries = Object.entries(reactions)

          return (
            <div
              key={item.id}
              className={'message-wrapper ' + (isMine ? 'mine' : 'theirs') + ' ' + (item.deleted ? 'is-deleted' : '')}
            >
              <div className=message-bubble-container>
                {!item.deleted && (
                  <div className=message-hover-toolbar>
                    <div className=quick-reaction-bar>
                      {quickReactions.map((emoji) => (
                        <button
                          key={emoji}
                          className=quick-rx-btn
                          onClick={() => toggleReaction(item.id, emoji)}
                          type=button
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <div className=toolbar-divider />
                    <button
                      className=toolbar-btn
                      onClick={() =>
                        setReplyingTo({
                          id: item.id,
                          fromName: isMine ? 'You' : selectedPerson.name,
                          text: item.text || (item.image ? 'Photo' : 'Voice note')
                        })
                      }
                      title=Reply
                    >
                      <IconReply size={14} />
                    </button>
                    <button
                      className=toolbar-btn
                      onClick={() => copyMessage(item.text)}
                      title=Copy text
                    >
                      <IconCopy size={14} />
                    </button>
                    <button
                      className={'toolbar-btn ' + (isStarred ? 'text-accent' : '')}
                      onClick={() => toggleStar(item.id)}
                      title={isStarred ? 'Unstar' : 'Star message'}
                    >
                      <IconStar size={14} filled={isStarred} />
                    </button>
                    {isMine && item.text && (
                      <button className=toolbar-btn onClick={() => beginEdit(item)} title=Edit>
                        <IconEdit size={14} />
                      </button>
                    )}
                    {isMine && (
                      <button
                        className=toolbar-btn text-danger
                        onClick={() => removeMessage(item)}
                        title=Delete
                      >
                        <IconTrash size={14} />
                      </button>
                    )}
                  </div>
                )}

                <div className=message-bubble>
                  {item.replyTo && (
                    <div className=quoted-reply-box>
                      <span className=quoted-reply-author>{item.replyTo.fromName || 'Reply'}</span>
                      <span className=quoted-reply-snippet>{item.replyTo.text}</span>
                    </div>
                  )}

                  {item.image && !item.deleted && (
                    <div className=bubble-image-wrapper onClick={() => setLightboxImage(item.image)}>
                      <img src={item.image} alt=Attachment className=bubble-image />
                    </div>
                  )}

                  {item.audio && !item.deleted && (
                    <VoiceNotePlayer audioSrc={item.audio} />
                  )}

                  {item.text && <div className=bubble-text>{item.text}</div>}

                  <div className=bubble-metadata>
                    {item.edited && <span className=edited-indicator>edited</span>}
                    <span className=bubble-timestamp>{item.time}</span>
                    {isMine && !item.deleted && (
                      <span className=delivery-tick title=Delivered>
                        <IconCheckCheck size={14} />
                      </span>
                    )}
                  </div>
                </div>

                {reactionEntries.length > 0 && !item.deleted && (
                  <div className=reaction-badges-row>
                    {reactionEntries.map(([userId, emoji]) => (
                      <button
                        key={userId}
                        type=button
                        className={'reaction-pill ' + (userId === 'me' ? 'my-rx' : '')}
                        onClick={() => toggleReaction(item.id, emoji)}
                      >
                        <span>{emoji}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {isPeerTyping && (
          <div className=typing-bubble-row>
            <div className=typing-bubble>
              <span className=typing-dot />
              <span className=typing-dot />
              <span className=typing-dot />
            </div>
            <span className=typing-label>{selectedPerson.name} is typing...</span>
          </div>
        )}
      </div>
    </div>
  )
}
