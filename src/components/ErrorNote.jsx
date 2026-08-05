import { useT } from '../lib/i18n'

/**
 * Turns a Supabase error into something a person can act on.
 *
 * The two failures that actually happen during setup — the provider not being
 * enabled, and the return URL not being on the allowlist — both surface as
 * opaque strings, and both used to render as nothing at all. Naming the fix in
 * the message is the difference between a dead button and a to-do.
 */
export function explain(error, t) {
  if (!error) return null
  const raw = `${error.code ?? ''} ${error.description ?? ''}`.toLowerCase()

  if (raw.includes('provider') && (raw.includes('not enabled') || raw.includes('disabled'))) {
    return t('err.provider_disabled')
  }
  if (raw.includes('redirect') || raw.includes('not allowed') || raw.includes('requested path')) {
    return t('err.redirect_not_allowed')
  }
  if (raw.includes('failed to fetch') || raw.includes('networkerror') || error.code === 'network') {
    return t('err.load_failed')
  }
  // PostgREST's way of saying the table does not exist. It only ever means one
  // thing here — the SQL in supabase/ was never run — and the raw string sends
  // people looking for a caching bug instead.
  // `raw` is already lower-cased; comparing error.code directly would miss
  // PGRST205 and 42P01, which arrive upper-case.
  if (raw.includes('schema cache') || raw.includes('pgrst205') || raw.includes('42p01')) {
    return t('err.no_tables')
  }
  if (raw.includes('does not exist') && raw.includes('relation')) {
    return t('err.no_tables')
  }
  return error.description || t('err.signin_failed')
}

export default function ErrorNote({ error, onRetry }) {
  const { t } = useT()
  if (!error) return null

  return (
    <div role="alert" className="card">
      <p className="text-body text-ink">{t('err.title')}</p>
      <p className="mt-2 text-small text-muted">{explain(error, t)}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost press mt-4">
          {t('err.retry')}
        </button>
      )}
    </div>
  )
}
