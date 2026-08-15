import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT, localeTag } from '../lib/i18n'
import { formatCurrency } from '../lib/currency'
import { emojiOf } from '../lib/emotions'
import { isRealChange, readLog, valueShape } from '../lib/txnlog'

/**
 * What this transaction used to say.
 *
 * A budget row is the one thing in this app people go back and argue with
 * themselves about. "I thought I put forty" is a real sentence, and the app's
 * only answer used to be the current value: an edit overwrote its own
 * evidence, so a number that looked wrong was indistinguishable from a number
 * somebody had changed.
 *
 * FETCHED WHEN OPENED, NOT WHEN THE SHEET IS.
 *
 * Most people never open this. Loading it with every sheet would put a query
 * behind every tap on every transaction to serve the one time in fifty that
 * somebody wants it, on a screen whose whole appeal is that logging a coffee
 * takes two seconds.
 *
 * The rows are written by a trigger, not by this app, and the table has no
 * insert policy at all. See migration 33 for why an audit trail the audited
 * party can edit is not one.
 */
export default function TxnHistory({ entryId, currency }) {
  const { t, locale } = useT()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(null) // null = not fetched yet
  const [error, setError] = useState(null)

  /* Reset when the sheet moves to a different transaction. Without this,
     opening a second one shows the first one's history until the fetch lands,
     which is the worst possible thing for a screen about accuracy to do. */
  useEffect(() => {
    setOpen(false)
    setRows(null)
    setError(null)
  }, [entryId])

  useEffect(() => {
    if (!open || rows !== null || !entryId) return
    let cancelled = false
    ;(async () => {
      const { data, error: failed } = await supabase
        .from('budget_entry_log')
        .select('id, action, changes, at')
        .eq('entry_id', entryId)
        .order('at', { ascending: false })
        .limit(50)

      if (cancelled) return
      /* A soft failure, and deliberately so: migration 33 may not have been
         run. Somebody who has not run it should meet an empty drawer with a
         sentence, not a red error on a screen they opened to check a number. */
      if (failed) setError(failed)
      setRows(data ?? [])
    })()
    return () => {
      cancelled = true
    }
  }, [open, rows, entryId])

  if (!entryId) return null

  const log = readLog(rows ?? [])

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="press flex w-full items-center justify-between gap-3 rounded-inner py-3 text-left text-small font-semibold text-ink transition-colors hover:bg-ink/[0.04]"
      >
        {t('txn.history')}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ease-settle ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Grid rows from 0fr to 1fr, the same technique as the mood card: it
          animates to the content's real height with nothing measured and
          degrades to an instant open where it is unsupported. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-settle motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
        aria-hidden={!open}
      >
        <div className="overflow-hidden">
          <div className="pt-1">
            {rows === null ? (
              <p className="py-3 text-small text-muted">{t('txn.history_loading')}</p>
            ) : error ? (
              <p className="py-3 text-small text-muted">{t('txn.history_unavailable')}</p>
            ) : log.length === 0 ? (
              <p className="py-3 text-small text-muted">{t('txn.history_empty')}</p>
            ) : (
              <ol className="space-y-3 border-l border-hairline pl-4">
                {log.map((entry) => (
                  <li key={entry.id}>
                    <p className="text-small font-semibold text-ink">
                      {t(`txn.log_${entry.action}`)}
                      <span className="ml-2 font-normal text-muted">{when(entry.at, locale)}</span>
                    </p>
                    {entry.changes.filter(isRealChange).map((c) => (
                      <p key={c.field} className="mt-1 text-small text-muted">
                        {t('txn.log_change', {
                          field: t(`txn.field_${c.field}`),
                          from: render(c.field, c.from, { t, locale, currency }),
                          to: render(c.field, c.to, { t, locale, currency }),
                        })}
                      </p>
                    ))}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** The day and the time, in the reader's own locale. */
function when(at, locale) {
  const d = new Date(at ?? '')
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/**
 * One stored value as a phrase.
 *
 * The shape comes from txnlog.js, which knows nothing about words or money;
 * the words and the currency live here. Keeping them apart is what lets the
 * diff logic be tested with no Intl and no translation table, and it stops a
 * currency symbol being frozen into a string that somebody may later read on a
 * device set to a different one.
 */
function render(field, value, { t, locale, currency }) {
  const { tag, value: v } = valueShape(field, value)

  if (tag === 'empty') return t('txn.log_nothing')
  if (tag === 'money') return formatCurrency(v, currency, [localeTag(locale)])
  if (tag === 'bool') return v ? t('txn.log_yes') : t('txn.log_no')
  if (tag === 'date') return v
  if (tag === 'term') {
    /* A category and a direction are translated with the keys the rest of the
       screen already uses, so the history says the same word the form does. */
    return field === 'category' ? t(`money.cat_${v}`) : t(`txn.kind_${v}`)
  }
  if (tag === 'emotions') return v.map((id) => `${emojiOf(id)} ${t(`emo.${id}`)}`).join(', ')
  return String(v)
}
