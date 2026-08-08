import { useT } from '../lib/i18n'

/* The library ships in its own SQL file, separately from the core schema.
   PostgREST names the relation it could not find, and that name is the only
   thing telling the two cases apart — sending someone to 01/02/03 when what is
   missing is the books has them re-running migrations they already have. */
const LIBRARY_TABLES = [
  'books',
  'chapters',
  'entitlements',
  'reading_progress',
  'highlights',
  'reading_shares',
]

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

  /* Reader-specific, and checked before the string matching below because
     both are conditions the app worked out for itself rather than messages
     Postgres handed back. */
  if (error.code === 'unknown_book') return t('err.unknown_book', { slug: error.description })
  if (error.code === 'no_chapters') return t('err.no_chapters')
  if (error.code === 'preview_missing') return t('err.preview_missing')

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
  const missingTable =
    raw.includes('schema cache') ||
    raw.includes('pgrst205') ||
    raw.includes('42p01') ||
    (raw.includes('does not exist') && raw.includes('relation'))

  if (missingTable) {
    return LIBRARY_TABLES.some((name) => raw.includes(name))
      ? t('err.no_library_tables')
      : t('err.no_tables')
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
