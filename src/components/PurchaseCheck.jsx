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
  const [fixing, setFixing] = useState(false)
  const [fixed, setFixed] = useState(null)
  const [lib, setLib] = useState(null)
  const [libBusy, setLibBusy] = useState(false)

  /**
   * Ask Stripe what was actually paid for, and take delivery of it.
   *
   * Separate from the check above, and deliberately so: a diagnostic that
   * writes while claiming to look is a surprise, and this one grants books.
   * The check tells you the webhook never fired; this is what you press
   * afterwards to get the books that payment already bought.
   */
  const recover = async () => {
    setFixing(true)
    setFixed(null)
    try {
      const { data } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe-recover', {
        method: 'POST',
        headers: { authorization: `Bearer ${data?.session?.access_token ?? ''}` },
      })
      const type = res.headers.get('content-type') ?? ''
      setFixed(type.includes('json') ? await res.json() : { error: t('diag.local_only', { code: res.status }) })
    } catch (e) {
      setFixed({ error: String(e?.message ?? e) })
    }
    setFixing(false)
  }

  /**
   * Why a book will not open, which is a different question from whether it
   * was paid for.
   *
   * The purchase check above answers "did the money arrive and was access
   * recorded". This answers "is the text there and can the policy hand it
   * over", and those fail independently: an entitlement with no chapter rows
   * behind it produces "you own this book" over an empty page, which is
   * exactly what was reported after the payment side was fixed.
   */
  const checkLibrary = async () => {
    setLibBusy(true)
    setLib(null)
    try {
      const { data } = await supabase.auth.getSession()
      const res = await fetch('/api/library-health', {
        headers: { authorization: `Bearer ${data?.session?.access_token ?? ''}` },
      })
      const type = res.headers.get('content-type') ?? ''
      setLib(type.includes('json') ? await res.json() : { error: t('diag.local_only', { code: res.status }) })
    } catch (e) {
      setLib({ error: String(e?.message ?? e) })
    }
    setLibBusy(false)
  }

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
      {/* The paragraph that explained what this checks moved to the help
          page. Asked for directly: the settings screen should be buttons, not
          essays. Somebody arriving here already knows why they came, and
          somebody who does not has a page for that. */}
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
          {/* Offered under the findings, because it only makes sense once
              somebody has read what is wrong. */}
          <button
            type="button"
            onClick={recover}
            disabled={fixing}
            className="goal-action press mt-4"
            data-hook="purchase-recover"
          >
            {fixing ? t('diag.recovering') : t('diag.recover')}
          </button>

          {fixed && (
            <p
              className="text-safe mt-3 rounded-inner bg-ink/[0.04] px-4 py-3 text-small text-ink"
              role="status"
              data-hook="purchase-recover-out"
            >
              {fixed.error
                ? fixed.error
                : fixed.granted?.length
                  ? t(fixed.granted.length === 1 ? 'diag.recovered_one' : 'diag.recovered_other', { n: fixed.granted.length })
                  : t('diag.recovered_none')}
            </p>
          )}

          {/* A separate question, so a separate button. Somebody whose
              payment landed and whose book will not open needs this one, and
              folding both into one press would report two unrelated things
              under one verdict. */}
          <button
            type="button"
            onClick={checkLibrary}
            disabled={libBusy}
            className="goal-action press mt-4"
            data-hook="library-check"
          >
            {libBusy ? t('diag.running') : t('diag.check_books')}
          </button>

          {lib && (
            <div className="mt-3" data-hook="library-check-out">
              <ul className="space-y-2">
                {(lib.error ? [lib.error] : (lib.advice ?? [])).map((a2, i) => (
                  <li key={i} className="text-safe rounded-inner bg-ink/[0.04] px-4 py-3 text-small text-ink">
                    {a2}
                  </li>
                ))}
              </ul>
              {(lib.checks ?? []).length > 0 && (
                <details className="mt-3">
                  <summary className="press cursor-pointer text-small font-semibold text-muted">
                    {t('diag.detail')}
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {lib.checks.map((c2, i) => (
                      <li key={i} className="text-safe text-small text-muted">
                        <span className="font-semibold text-ink">{c2.name}</span>: {c2.status}
                        {c2.detail ? ` \u2014 ${c2.detail}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

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
