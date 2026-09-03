import React from 'react'
import { IconMessageSquare, IconChevronRight } from './Icons'

export function AuthScreen({
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  authError,
  setAuthError,
  submitAuth
}) {
  return (
    <main className= join-screen>
      <div className=join-card>
        <div className=brand-badge>
          <div className=brand-icon-box>
            <IconMessageSquare size={22} />
          </div>
          <span className=brand-text>Chaty</span>
        </div>

        <div className=join-header>
          <h1>{authMode === 'login' ? 'Welcome back' : 'Create an account'}</h1>
          <p className=join-copy>
            {authMode === 'login'
              ? 'Sign in to access your secure, live encrypted conversations.'
              : 'Fast, minimal, and private messaging for modern teams.'}
          </p>
        </div>

        <form onSubmit={submitAuth} className=join-form>
          <div className=form-group>
            <label htmlFor=username>Username</label>
            <input
              id=username
              required
              value={authForm.username}
              onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })}
              placeholder=e.g. jordan
              autoFocus
            />
          </div>
          <div className=form-group>
            <label htmlFor=password>Password</label>
            <input
              id=password
              type=password
              required
              value={authForm.password}
              onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
              placeholder=At least 8 characters
            />
          </div>
          {authError && <p className=auth-error>{authError}</p>}
          <button className=btn btn-primary join-submit-btn type=submit>
            <span>{authMode === 'login' ? 'Sign in' : 'Create account'}</span>
            <IconChevronRight size={18} />
          </button>
        </form>

        <div className=join-footer>
          <button
            type=button
            className=auth-switch-btn
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login')
              setAuthError('')
            }}
          >
            {authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </main>
  )
}
