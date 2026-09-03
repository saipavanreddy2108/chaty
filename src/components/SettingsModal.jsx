import React from 'react'
import {
  IconSettings,
  IconSun,
  IconMoon,
  IconBell,
  IconX,
  IconLogOut,
  IconShield
} from './Icons'
import { Avatar } from './Avatar'

export function SettingsModal({
  settingsOpen,
  setSettingsOpen,
  settingsTab,
  setSettingsTab,
  settingsForm,
  setSettingsForm,
  saveSettings,
  currentUserName,
  currentUserColor,
  settingsError,
  settingsSaved,
  logout,
  theme,
  setTheme,
  soundEnabled,
  setSoundEnabled,
  showToast
}) {
  if (!settingsOpen) return null

  return (
    <div
      className= modal-backdrop
      role=presentation
      onMouseDown={(e) => e.target === e.currentTarget && setSettingsOpen(false)}
    >
      <div className=modal-dialog settings-dialog role=dialog aria-modal=true>
        <div className=modal-header>
          <h2>Preferences and Settings</h2>
          <button className=icon-btn onClick={() => setSettingsOpen(false)} aria-label=Close settings>
            <IconX size={18} />
          </button>
        </div>

        <div className=settings-dialog-layout>
          <div className=settings-sidebar-nav>
            <button
              className={'settings-nav-item ' + (settingsTab === 'profile' ? 'active' : '')}
              onClick={() => setSettingsTab('profile')}
            >
              <IconSettings size={16} /> Account Profile
            </button>
            <button
              className={'settings-nav-item ' + (settingsTab === 'appearance' ? 'active' : '')}
              onClick={() => setSettingsTab('appearance')}
            >
              <IconSun size={16} /> Appearance
            </button>
            <button
              className={'settings-nav-item ' + (settingsTab === 'notifications' ? 'active' : '')}
              onClick={() => setSettingsTab('notifications')}
            >
              <IconBell size={16} /> Notifications and Audio
            </button>
          </div>

          <div className=settings-tab-content>
            {settingsTab === 'profile' && (
              <form onSubmit={saveSettings} className=settings-form>
                <div className=settings-avatar-preview>
                  <Avatar
                    person={{ name: settingsForm.name || currentUserName, color: currentUserColor || 'coral' }}
                    size=lg
                    showPresence={false}
                  />
                  <div>
                    <strong>{settingsForm.name || currentUserName}</strong>
                    <p>Your public display identity on Chaty.</p>
                  </div>
                </div>

                <div className=form-group>
                  <label htmlFor=settings-name>Display Name</label>
                  <input
                    id=settings-name
                    required
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                  />
                </div>

                <div className=form-group>
                  <label htmlFor=current-password>Current Password</label>
                  <input
                    id=current-password
                    type=password
                    required
                    value={settingsForm.currentPassword}
                    onChange={(e) => setSettingsForm({ ...settingsForm, currentPassword: e.target.value })}
                    placeholder=Required to make changes
                  />
                </div>

                <div className=form-group>
                  <label htmlFor=new-password>
                    New Password <span className=text-muted>(optional)</span>
                  </label>
                  <input
                    id=new-password
                    type=password
                    value={settingsForm.newPassword}
                    onChange={(e) => setSettingsForm({ ...settingsForm, newPassword: e.target.value })}
                    placeholder=Leave blank to keep current password
                  />
                </div>

                {settingsError && <p className=auth-error>{settingsError}</p>}
                {settingsSaved && <p className=settings-success>Settings updated successfully.</p>}

                <div className=settings-actions-row>
                  <button type=submit className=btn btn-primary>
                    Save Profile
                  </button>
                  <button type=button className=btn btn-danger-outline onClick={logout}>
                    <IconLogOut size={16} /> Sign out
                  </button>
                </div>
              </form>
            )}

            {settingsTab === 'appearance' && (
              <div className=settings-appearance-panel>
                <h4>Interface Theme</h4>
                <p className=settings-desc>Select your preferred visual style for Chaty.</p>

                <div className=theme-selector-grid>
                  <button
                    type=button
                    className={'theme-card-btn ' + (theme === 'dark' ? 'active' : '')}
                    onClick={() => setTheme('dark')}
                  >
                    <div className=theme-preview-box dark-box>
                      <span className=preview-bubble mine />
                      <span className=preview-bubble theirs />
                    </div>
                    <div className=theme-card-info>
                      <IconMoon size={16} />
                      <span>Dark Mode</span>
                    </div>
                  </button>

                  <button
                    type=button
                    className={'theme-card-btn ' + (theme === 'dusk' ? 'active' : '')}
                    onClick={() => setTheme('dusk')}
                  >
                    <div className=theme-preview-box dusk-box>
                      <span className=preview-bubble mine />
                      <span className=preview-bubble theirs />
                    </div>
                    <div className=theme-card-info>
                      <IconShield size={16} />
                      <span>Dusk Slate</span>
                    </div>
                  </button>

                  <button
                    type=button
                    className={'theme-card-btn ' + (theme === 'light' ? 'active' : '')}
                    onClick={() => setTheme('light')}
                  >
                    <div className=theme-preview-box light-box>
                      <span className=preview-bubble mine />
                      <span className=preview-bubble theirs />
                    </div>
                    <div className=theme-card-info>
                      <IconSun size={16} />
                      <span>Light Mode</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {settingsTab === 'notifications' && (
              <div className=settings-notifications-panel>
                <h4>Audio and Sound Effects</h4>
                <p className=settings-desc>Configure how Chaty alerts you to incoming events.</p>

                <div className=settings-toggle-row>
                  <div>
                    <strong>Message and Call Chimes</strong>
                    <p>Play synthesizer sound alerts on new message arrival and phone calls.</p>
                  </div>
                  <input
                    type=checkbox
                    className=switch-toggle
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                  />
                </div>

                <div className=settings-toggle-row>
                  <div>
                    <strong>Desktop Push Notifications</strong>
                    <p>Receive native system alerts when Chaty is running in background tabs.</p>
                  </div>
                  <button
                    type=button
                    className=btn btn-secondary btn-sm
                    onClick={() => {
                      if ('Notification' in window) {
                        Notification.requestPermission().then((res) => {
                          showToast('Permission ' + res)
                        })
                      }
                    }}
                  >
                    Request Permission
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
