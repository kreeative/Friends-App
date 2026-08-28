import { useCallback, useEffect, useState } from 'react'
import { useT } from '../lib/i18n'
import { bankConnections, connectBank, disconnectBank, syncBanks } from '../lib/plaidLink'
import { Empty } from './ui'

/**
 * Connect a bank, and pull transactions in from it.
 *
 * It lives on the transactions page rather than on the dashboard, because what
 * it produces is transactions and the first thing anybody wants after an
 * import is to look at what arrived.
 *
 * WHAT THIS SCREEN IS CAREFUL TO SAY OUT LOUD.
 *
 * An import that reports "38 added" while quietly dropping 9 transfers has
 * told somebody their bank had 38 transactions in it, which is false. Every
 * skipped row is counted by src/lib/plaidMap.js and every reason is named
 * here, because the biggest category of skip is credit card repayments and a
 * person who does not know they were skipped will add them by hand and double
 * count exactly the way the formation's card module warns about.
 */
export default function BankImport({ onImported }) {
  const { t, locale } = useT()

  /**
   * The server's sentence, in the reader's language.
   *
   * describePlaidError returns an English `error` and a Plaid `code`. The code
   * is the durable thing, so it picks the translated string and the English
   * only survives as the fallback for a code Plaid adds after this shipped.
   * Without this a French reader got an English sentence on an otherwise
   * French page, which the screenshot caught.
   *
   * The `hint` beside it is deliberately NOT translated: it names PLAID_ENV
   * and PLAID_SECRET, which are English strings in a Vercel dashboard, and
   * translating the sentence around them would make them harder to find.
   */
  const fromServer = (out) => {
    const key = out?.code ? `bank.err_${out.code}` : null
    const translated = key ? t(key) : null
    return {
      text: translated && translated !== key ? translated : out?.error,
      hint: out?.hint,
    }
  }
  const [connections, setConnections] = useState([])
  const [busy, setBusy] = useState('')
  /* { text, hint }. The hint is the operator's sentence, which on this
     product is the same person: it names the Vercel variable to change rather
     than apologising. Kept separate so it can be styled as the aside it is. */
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const refresh = useCallback(async () => {
    const { connections: rows, error: err } = await bankConnections()
    /* A missing function means 44 has not been run. Say which file, the way
       the rest of this project's errors do, rather than showing an empty list
       for a feature that is simply not installed. */
    if (err) {
      setError({
        text: /function|does not exist|schema cache/i.test(err.message ?? '')
          ? t('bank.not_installed')
          : (err.message ?? String(err)),
      })
      return
    }
    setError(null)
    setConnections(rows)
  }, [t])

  useEffect(() => { refresh() }, [refresh])

  const connect = async (itemId = null) => {
    setBusy('connect'); setError(null); setResult(null)
    const out = await connectBank({ locale, itemId })
    setBusy('')
    /* Closing the dialog is how this flow ends most of the time. It is not an
       error and showing one for it would be wrong every day. */
    if (out.cancelled) return
    if (out.error) return setError(fromServer(out))
    await refresh()
    await sync()
  }

  const sync = async () => {
    setBusy('sync'); setError(null)
    const out = await syncBanks()
    setBusy('')
    if (out.error) return setError(fromServer(out))
    /* A sync can succeed as a request and still have failed per bank, which is
       the shape the route returns. Reporting "0 added" for that would hide a
       broken link behind a number that looks like a quiet month. */
    const broke = (out.items ?? []).find((i) => i.error && i.error !== 'reauth')
    if (broke) {
      const d = fromServer(broke)
      setError({ text: d.text ?? t('bank.sync_failed'), hint: d.hint })
    }
    setResult(out)
    await refresh()
    /* The ledger behind this panel has to change in the same breath. An import
       that needs a manual refresh to show up reads as an import that did
       nothing. */
    if (out.added > 0 || out.removed > 0) await onImported?.()
  }

  const disconnect = async (itemId) => {
    if (!window.confirm(t('bank.disconnect_confirm'))) return
    setBusy(itemId); setError(null)
    const out = await disconnectBank(itemId)
    setBusy('')
    if (out.error) return setError(fromServer(out))
    await refresh()
  }

  return (
    <div className="glass-card rounded-3xl p-5" data-hook="bank-import">
      <p className="text-body font-semibold text-ink">{t('bank.title')}</p>
      <p className="mt-1.5 text-small leading-relaxed text-muted">{t('bank.body')}</p>

      {connections.length === 0 ? (
        <div className="mt-4">
          <Empty>{t('bank.none')}</Empty>
          <button
            className="btn-primary press mt-4 w-full"
            data-hook="bank-connect"
            disabled={busy === 'connect'}
            onClick={() => connect()}
          >
            {busy === 'connect' ? t('common.saving') : t('bank.connect')}
          </button>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-2" data-hook="bank-list">
            {connections.map((c) => (
              <li
                key={c.item_id}
                data-bank={c.item_id}
                className="flex items-center justify-between gap-3 rounded-card bg-ink/[0.04] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-small font-semibold text-ink">
                    {c.institution || t('bank.unnamed')}
                  </p>
                  {/* Colour is never the only signal: the broken state says so
                      in words as well as by sitting in a different tone. */}
                  <p className="text-label text-muted">
                    {c.status === 'reauth'
                      ? t('bank.needs_reauth')
                      : t('bank.imported_n', { n: c.imported })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.status === 'reauth' && (
                    <button
                      className="goal-action press"
                      data-hook="bank-reauth"
                      onClick={() => connect(c.item_id)}
                    >
                      {t('bank.fix')}
                    </button>
                  )}
                  <button
                    className="goal-action press"
                    data-hook="bank-disconnect"
                    disabled={busy === c.item_id}
                    onClick={() => disconnect(c.item_id)}
                  >
                    {t('bank.disconnect')}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex gap-2">
            <button
              className="btn-primary press flex-1"
              data-hook="bank-sync"
              disabled={busy === 'sync'}
              onClick={sync}
            >
              {busy === 'sync' ? t('bank.syncing') : t('bank.sync')}
            </button>
            <button
              className="goal-action press shrink-0"
              data-hook="bank-add"
              disabled={busy === 'connect'}
              onClick={() => connect()}
            >
              {t('bank.add')}
            </button>
          </div>
        </>
      )}

      {result && <Tally result={result} />}

      {error && (
        <div className="mt-3" role="alert">
          <p className="break-words text-small text-negative" data-hook="bank-error">
            {error.text}
          </p>
          {/* The fix, when there is one. Muted rather than red: it is not a
              second failure, it is the instruction for the one above. */}
          {error.hint && (
            <p className="mt-1.5 break-words text-label leading-relaxed text-muted" data-hook="bank-hint">
              {error.hint}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * What the import did, including what it did NOT do.
 *
 * The skipped counts are the part that matters. Transfers are the common one
 * and the reason is the same one the credit card module teaches: a card
 * repayment is the same money moving a second time between two places that are
 * both yours, so importing it alongside the purchases it settles counts them
 * twice. Somebody who sees "9 skipped" with no reason will go and add them by
 * hand.
 */
function Tally({ result }) {
  const { t } = useT()

  /* The per-reason counts live on each item, not on the top level: the sync
     route returns `skipped` as a TOTAL at the top and as a breakdown per bank.
     A first draft read `result.skipped` here as though it were the breakdown,
     which made it a number, and then guarded the "nothing new" line with
     `typeof s === 'object'`. That guard was false for every real response, so
     the line could never appear and an import that found nothing showed an
     empty grey box. */
  const count = (why) => result.items?.reduce((n, i) => n + (i.skipped?.[why] ?? 0), 0) ?? 0
  const reasons = [
    ['transfer', count('transfer')],
    ['pending', count('pending')],
    ['currency', count('currency')],
  ].filter(([, n]) => n > 0)

  const quiet = (result.added ?? 0) === 0 && (result.removed ?? 0) === 0 && reasons.length === 0

  return (
    <div className="mt-4 rounded-card bg-ink/[0.04] p-4" data-hook="bank-tally">
      <p className="text-small font-semibold text-ink" data-hook="bank-added">
        {t('bank.added_n', { n: result.added ?? 0 })}
      </p>
      {reasons.length > 0 && (
        <ul className="mt-2 space-y-1">
          {reasons.map(([why, n]) => (
            <li key={why} className="text-label leading-relaxed text-muted" data-skip={why}>
              {t(`bank.skip_${why}`, { n })}
            </li>
          ))}
        </ul>
      )}
      {quiet && (
        <p className="mt-1 text-label text-muted" data-hook="bank-quiet">
          {t('bank.nothing_new')}
        </p>
      )}
    </div>
  )
}
