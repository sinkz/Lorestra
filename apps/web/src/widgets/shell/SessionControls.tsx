import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../shared/api/session'
import { errorMessageKey } from '../../shared/api/errors'
import { Button, ModalDialog } from '../../shared/ui'

export function SessionControls() {
  const { t } = useTranslation()
  const { session, login, logout } = useSession()
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>()
  async function submit() {
    setPending(true)
    setError(undefined)
    try {
      await login(token)
      setToken('')
      setOpen(false)
    } catch (cause) {
      setError(cause)
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="session-toolbar">
      <small title={t(`session.${session.mode}`)}>
        {session.principal?.name ?? t('session.visitor')}
      </small>
      {session.mode === 'mock' ? (
        <small>{t('session.mock')}</small>
      ) : session.principal ? (
        <Button
          variant="secondary"
          onClick={() => {
            void logout().catch(setError)
          }}
        >
          {t('session.signOut')}
        </Button>
      ) : session.mode === 'local' ? (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          {t('session.signIn')}
        </Button>
      ) : (
        <a className="button button-secondary" href="/api/auth/login">
          {t('session.signIn')}
        </a>
      )}
      {error && !open ? <span role="alert">{t(errorMessageKey(error))}</span> : null}
      <ModalDialog
        className="memory-dialog"
        open={open}
        aria-labelledby="session-title"
        onRequestClose={() => {
          if (!pending) {
            setToken('')
            setOpen(false)
          }
        }}
      >
        <div className="memory-dialog-card">
          <h2 id="session-title">{t('session.local')}</h2>
          <p>{t('session.localHelp')}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <label className="form-field">
              <span>{t('session.localToken')}</span>
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required
              />
            </label>
            {error ? (
              <p className="field-error" role="alert">
                {t(errorMessageKey(error))}
              </p>
            ) : null}
            <div className="dialog-actions">
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  setToken('')
                  setOpen(false)
                }}
              >
                {t('document.cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {t('session.signIn')}
              </Button>
            </div>
          </form>
        </div>
      </ModalDialog>
    </div>
  )
}
