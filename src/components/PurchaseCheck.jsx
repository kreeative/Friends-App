import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'

/**
 * "Why did my book not arrive", with a button instead of a dashboard login.
 *
 * The purchase path crosses the browser, this project's functions, Stripe and
 * Postgres, and when a book does not appear every one of them looks fine from
 * where the owner is standing: there is a receipt, the checkout function
 * answered 200, and the library is empty. The one thing nobody can see from
 * inside the app is whether Stripe was ever told where to send the event.
 *
 * /api/stripe-health asks all four and answers in sentences. This is the way
 * in, because a fix that needs curl and a bearer token is a fix that does not
 * get run.
 *
 * THE ANSWER IS PRINTED RAW, AND THAT IS DELIBERATE.
 *
 * A prettier rendering would mean deciding in advance which fields matter, and
 * the whole reason this exists is that the failing field was not the one
 * anybody expected. The endpoint is careful never to return a secret's value,
 * so the raw object is safe to read and safe to paste into a message.
 */
export default function PurchaseCheck() {
  const { t } = useT()
  const [state, setState] = useState('idle')
  const [out, setOut] = useState(null)

  const run = async () => {
    setState('running')
    setOut(null)
    try {
      /* The endpoint wants the caller signed in, so the access token goes with
         it. Read from the live session rather than kept in state: a token that
         was fetched when this component mounted may have rotated since. */
      const { data } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe-health', {
        headers: { authorization: `Bearer ${data?.session?.access_token ?? ''}` },
      })
      const type = res.headers.get('content-type') ?? ''
      if (!type.includes('json')) {
        /* On a local dev server /api is not a function, it is the SPA fallback,
           so this returns index.html and JSON.parse throws something unhelpful
           about "<". Say what actually happened instead. */
        setOut({
          problems: [t('diag.local_only', { code: res.status })],
        })
      } else {
        setOut(await res.json())
      }
    } catch (e) {
      setOut({ problems: [String(e?.message ?? e)] })
    }
    setState('done')
  }

  return (
    <div data-hook="purchase-check">
      <p className="text-small text-muted">{t('diag.body')}</p>
      <button
        type="button"
        onClick={run}
        disabled={state === 'running'}
        className="goal-action press mt-3"
        data-hook="purchase-check-run"
      >
        {state === 'running' ? t('diag.running') : t('diag.run')}
      </button>

      {out && (
        <div className="mt-4" data-hook="purchase-check-out">
          {/* The sentences first, because they are the answer. Everything else
              is the working. */}
          <ul className="space-y-2">
            {(out.problems ?? []).map((p, i) => (
              <li key={i} className="text-safe rounded-inner bg-ink/[0.04] px-4 py-3 text-small text-ink">
                {p}
              </li>
            ))}
          </ul>
          <details className="mt-3">
            <summary className="press cursor-pointer text-small font-semibold text-muted">
              {t('diag.detail')}
            </summary>
            <pre className="mt-2 max-h-80 overflow-auto rounded-inner bg-ink/[0.04] p-3 text-label leading-relaxed text-ink">
              {JSON.stringify(out, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}
