import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { snippet, wasEdited, wasTrimmed } from '../lib/entries'
import {
  clearPasscode,
  isOpen,
  loadAttempts,
  loadEntries,
  loadLock,
  markClosed,
  markOpen,
  saveAttempts,
  setPasscode,
  verifyPin,
} from '../lib/journal'
import { attemptState, clearFailures, cryptoReady, recordFailure, waitSeconds } from '../lib/lock'
import { Empty, Screen, Section, Sheet, TopBar } from '../components/ui'
import { MoodBadge } from '../components/MoodBoard'
import InkPreview from '../components/InkPreview'
import JournalIntro from '../components/JournalIntro'
import JournalEntrySheet from '../components/JournalEntrySheet'
import PasscodePad from '../components/PasscodePad'

/**
 * The journal.
 *
 * The one screen in this app that is nobody else's business. Everything else
 * here is built to be seen by four other people on purpose; this is built so
 * that it cannot be, and the policies in supabase/27_journal.sql are the
 * feature rather than a guard on it.
 *
 * THREE STATES, IN ORDER.
 *
 * Locked, which is where a passcode-holder lands and which shows nothing at
 * all behind it: no count, no dates, no thumbnails. A lock screen that says
 * "14 entries" has already told somebody holding the phone something they were
 * not meant to know.
 *
 * Empty, which gets the two-slide intro and its prompts, because the blank
 * page is the hard part of journalling.
 *
 * Full, which is the grid.
 */
export default function Journal() {
  const { user, profile, updateProfile } = useAuth()
  const { t, locale } = useT()

  const [rows, setRows] = useState([])
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)

  const [lock, setLock] = useState(null)
  const [unlocked, setUnlocked] = useState(() => isOpen())
  const [attempts, setAttempts] = useState(() => loadAttempts())
  const [pinError, setPinError] = useState(null)
  const [checking, setChecking] = useState(false)

  const [editing, setEditing] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [seedText, setSeedText] = useState('')
  const [lockSheet, setLockSheet] = useState(false)

  /**
   * The lock is read before the entries and the entries are not read at all
   * until it is open.
   *
   * Not a rendering decision. Fetching the rows and hiding them behind a
   * keypad would put the entire journal in the browser's memory and in the
   * network tab, where the passcode is decoration. So a locked journal makes
   * no query for its contents until it is unlocked.
   */
  useEffect(() => {
    let alive = true
    if (!user) return

    ;(async () => {
      const { lock: found, missing: gone } = await loadLock(user.id)
      if (!alive) return
      setLock(found)
      setMissing(gone)
      /* No passcode set is the default for every account, and it means the
         journal is simply open. */
      if (!found) setUnlocked(true)
      if (gone) setLoading(false)
    })()

    return () => {
      alive = false
    }
  }, [user])

  const refresh = useCallback(async () => {
    if (!user) return
    const { rows: found, missing: gone } = await loadEntries(user.id)
    setRows(found)
    setMissing((m) => m || gone)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (!unlocked || !user) return
    refresh()
  }, [unlocked, user, refresh])

  /**
   * Closing the tab locks it again.
   *
   * The unlocked flag lives in sessionStorage, which already dies with the
   * tab; this clears it on the way out as well so a browser that restores a
   * session does not restore the unlocking with it.
   */
  useEffect(() => {
    if (!lock) return
    const close = () => markClosed()
    window.addEventListener('pagehide', close)
    return () => window.removeEventListener('pagehide', close)
  }, [lock])

  const gate = attemptState(attempts)

  async function tryPin(pin) {
    if (gate.locked) return
    setChecking(true)
    setPinError(null)

    const ok = await verifyPin(pin, lock)
    setChecking(false)

    if (ok) {
      const clean = clearFailures()
      setAttempts(clean)
      saveAttempts(clean)
      markOpen()
      setUnlocked(true)
      return
    }

    const next = recordFailure(attempts)
    setAttempts(next)
    saveAttempts(next)

    const state = attemptState(next)
    setPinError(
      state.locked
        ? t('journal.pin_locked', { s: waitSeconds(state.waitMs) })
        : t('journal.pin_wrong', { n: state.remaining }),
    )
  }

  /* The lockout has to end on its own. Without a tick the keypad stays dead
     until something else happens to re-render the page, which from the outside
     is a wait that never finishes. */
  useEffect(() => {
    if (!gate.locked) return
    const id = setTimeout(() => setAttempts((a) => ({ ...a })), gate.waitMs + 50)
    return () => clearTimeout(id)
  }, [gate.locked, gate.waitMs])

  function openNew(text = '') {
    setEditing(null)
    setSeedText(text)
    setSheetOpen(true)
  }

  function openEntry(entry) {
    setEditing(entry)
    setSeedText('')
    setSheetOpen(true)
  }

  /* Applied locally as well as refetched: the grid moves the instant the sheet
     closes rather than after a round trip, and the refetch underneath confirms
     it. */
  function afterSave(row, deletedId) {
    if (deletedId) setRows((r) => r.filter((x) => x.id !== deletedId))
    else if (row) {
      setRows((r) => {
        const without = r.filter((x) => x.id !== row.id)
        return [row, ...without].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
      })
    }
    refresh()
  }

  const showIntro = !profile?.has_seen_journal_intro && !missing

  async function dismissIntro() {
    await updateProfile?.({ has_seen_journal_intro: true })
  }

  // ---- locked ---------------------------------------------------------------

  if (lock && !unlocked) {
    return (
      <Screen>
        <div className="flex min-h-[70dvh] flex-col items-center justify-center">
          <PasscodePad
            title={t('journal.locked_title')}
            hint={t('journal.locked_hint')}
            error={pinError}
            busy={checking}
            disabled={gate.locked}
            onComplete={tryPin}
          />
          {gate.locked && (
            <p className="mt-6 text-small text-muted">
              {t('journal.pin_locked', { s: waitSeconds(gate.waitMs) })}
            </p>
          )}
        </div>
      </Screen>
    )
  }

  // ---- open -----------------------------------------------------------------

  return (
    <Screen>
      <TopBar
        title={t('journal.title')}
        sub={t('journal.sub')}
        right={
          <button
            onClick={() => setLockSheet(true)}
            aria-label={t('journal.lock_settings')}
            className="press flex h-10 w-10 items-center justify-center rounded-pill bg-ink/[0.06] text-ink transition-colors hover:bg-ink/[0.1]"
          >
            <LockIcon closed={Boolean(lock)} />
          </button>
        }
      />

      {missing ? (
        <div className="card-warn mt-8">
          <p className="text-body text-on-field">{t('journal.not_installed')}</p>
        </div>
      ) : (
        <>
          {showIntro && <JournalIntro onDismiss={dismissIntro} onPickPrompt={(p) => openNew(`${p}\n\n`)} />}

          <div className="mt-6">
            <button onClick={() => openNew()} className="btn-primary press w-full sm:w-auto">
              {t('journal.new_entry')}
            </button>
          </div>

          <Section title={rows.length ? t('journal.entries') : null}>
            {loading ? (
              <p className="py-10 text-center text-small text-muted">{t('err.loading')}</p>
            ) : rows.length === 0 ? (
              <Empty>{t('journal.empty')}</Empty>
            ) : (
              <Grid rows={rows} locale={locale} onOpen={openEntry} />
            )}
          </Section>
        </>
      )}

      <JournalEntrySheet
        open={sheetOpen}
        entry={editing}
        seedText={seedText}
        onClose={() => setSheetOpen(false)}
        onSaved={afterSave}
      />

      <LockSheet
        open={lockSheet}
        lock={lock}
        onClose={() => setLockSheet(false)}
        onChanged={(next) => {
          setLock(next)
          if (next) markOpen()
          else markClosed()
        }}
      />
    </Screen>
  )
}

/**
 * The grid.
 *
 * Polaroids: a picture area of fixed proportion with the writing under it,
 * which is the shape that makes a wall of small cards scannable. Two across on
 * a phone, three from `sm`, because a 390px screen gives each card about 170px
 * and a third column would make the date illegible before the snippet even
 * started.
 *
 * Everything on a card is what the entry is; nothing on it is chrome. The date
 * is the heading because a journal is looked through by date, and the mood
 * badge sits in the corner of the picture rather than in the caption so the
 * caption stays a single readable block of text.
 */
function Grid({ rows, locale, onOpen }) {
  const { t } = useT()
  const fmt = useMemo(
    () => new Intl.DateTimeFormat(localeTag(locale), { day: 'numeric', month: 'short', year: 'numeric' }),
    [locale],
  )

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {rows.map((entry) => {
        /* Parsed as local noon rather than as a bare date string. `new
           Date('2026-08-13')` is midnight UTC, which is the 12th for anybody
           west of Greenwich, so the card would show the wrong day to half the
           world. */
        const [y, m, d] = (entry.day ?? '').split('-').map(Number)
        const when = y ? fmt.format(new Date(y, m - 1, d, 12)) : entry.day

        return (
          <button
            key={entry.id}
            onClick={() => onOpen(entry)}
            className="press group flex flex-col overflow-hidden rounded-card border border-hairline bg-surface p-3 text-left shadow-raised transition-shadow hover:shadow-float"
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-inner bg-bg">
              {entry.kind === 'ink' && entry.ink ? (
                /* Cropped to the writing. A thumbnail of a whole page with
                   three words in the corner is a thumbnail of nothing. */
                <InkPreview ink={entry.ink} crop className="h-full w-full p-2" />
              ) : (
                /* Cut in JS and faded in CSS. See snippet() in entries.js for
                   the card that read "…la marche du matin… / avant que" and
                   why line-clamp could not be trusted here, and .fade-b in
                   index.css for why the remainder dissolves rather than
                   stopping mid-letter at the card's edge. */
                <div
                  className={`absolute inset-0 overflow-hidden ${
                    wasTrimmed(entry.body) ? 'fade-b' : ''
                  }`}
                >
                  <p className="p-3 text-small leading-snug text-ink">{snippet(entry.body)}</p>
                </div>
              )}
            </div>

            {/**
             * The mood sits beside the date, not in the corner of the picture.
             *
             * It was over the picture, which looked right on a drawing and
             * landed squarely on the last line of every long typed entry: the
             * face covered "…pendant dix minutes". Nudging the padding would
             * have fixed the cards that exist and broken again at another font
             * size, so it moved somewhere overlap is not possible.
             */}
            <p className="mt-2.5 flex items-center gap-2 text-small font-semibold text-ink">
              <span className="min-w-0 flex-1 truncate">{when}</span>
              {entry.mood && <MoodBadge id={entry.mood} size={20} />}
            </p>
            <p className="mt-0.5 text-label text-muted">
              {entry.kind === 'ink' ? t('journal.handwritten') : t('journal.typed')}
              {wasEdited(entry) ? ` · ${t('journal.edited')}` : ''}
            </p>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Turning the passcode on, changing it, or turning it off.
 *
 * Setting one asks twice, because a passcode typed once and mistyped is a
 * journal nobody can open, and there is no reset: no email, no security
 * question, nothing. Removing one asks for the current passcode first, or
 * anybody holding an already-unlocked phone could simply take the lock off.
 */
function LockSheet({ open, lock, onClose, onChanged }) {
  const { user } = useAuth()
  const { t } = useT()

  const [step, setStep] = useState('menu')
  const [first, setFirst] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep('menu')
    setFirst('')
    setError(null)
  }, [open])

  async function choose(pin) {
    if (!first) {
      setFirst(pin)
      setError(null)
      setStep('confirm')
      return
    }

    if (pin !== first) {
      setFirst('')
      setStep('set')
      setError(t('journal.pin_mismatch'))
      return
    }

    setBusy(true)
    const { error: failed, lock: made } = await setPasscode(user.id, pin)
    setBusy(false)

    if (failed) {
      setError(
        failed.message === 'crypto-unavailable' ? t('journal.crypto_missing') : failed.message,
      )
      return
    }
    /* The record that was just stored, not a placeholder. The parent verifies
       against whatever it is handed, so a stand-in with no hash in it would
       lock the journal behind a passcode that could never open it. */
    onChanged?.(made)
    onClose?.()
  }

  async function confirmRemove(pin) {
    setBusy(true)
    const ok = await verifyPin(pin, lock)
    if (!ok) {
      setBusy(false)
      setError(t('journal.pin_wrong_plain'))
      return
    }
    const { error: failed } = await clearPasscode(user.id)
    setBusy(false)
    if (failed) return setError(failed.message)
    onChanged?.(null)
    onClose?.()
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('journal.lock_settings')}>
      {step === 'menu' && (
        <div className="space-y-6">
          <p className="text-body text-muted">
            {lock ? t('journal.lock_on') : t('journal.lock_off')}
          </p>

          {/**
           * The honest sentence, on the screen where somebody decides.
           *
           * It would be easy to write "your journal is protected" here and let
           * people assume it means encrypted. It does not: the entries are
           * stored as plain text and anybody holding the database reads them.
           * What this stops is a person picking up the phone, which is the
           * thing that actually happens, and saying so is the difference
           * between a feature and a false promise.
           */}
          <p className="text-small text-muted">{t('journal.lock_honest')}</p>

          <div className="space-y-3">
            <button
              onClick={() => {
                setFirst('')
                setError(null)
                setStep('set')
              }}
              disabled={!cryptoReady()}
              className="btn-primary press w-full disabled:opacity-50"
            >
              {lock ? t('journal.lock_change') : t('journal.lock_set')}
            </button>

            {lock && (
              <button
                onClick={() => {
                  setError(null)
                  setStep('remove')
                }}
                className="press w-full rounded-pill py-2.5 text-small font-semibold text-muted transition-colors hover:text-negative"
              >
                {t('journal.lock_remove')}
              </button>
            )}
          </div>

          {!cryptoReady() && <p className="text-small text-negative">{t('journal.crypto_missing')}</p>}
        </div>
      )}

      {(step === 'set' || step === 'confirm') && (
        <PasscodePad
          /* A fresh pad per step. Without it React keeps the same instance
             across "choose" and "type it again", so the second screen opens
             already holding the first passcode. */
          key={step}
          title={step === 'set' ? t('journal.pin_choose') : t('journal.pin_again')}
          hint={step === 'set' ? t('journal.pin_choose_hint') : t('journal.pin_again_hint')}
          error={error}
          busy={busy}
          onComplete={choose}
          onCancel={() => {
            setFirst('')
            setError(null)
            setStep('menu')
          }}
        />
      )}

      {step === 'remove' && (
        <PasscodePad
          title={t('journal.pin_confirm_remove')}
          hint={t('journal.pin_confirm_remove_hint')}
          error={error}
          busy={busy}
          onComplete={confirmRemove}
          onCancel={() => setStep('menu')}
        />
      )}
    </Sheet>
  )
}

function LockIcon({ closed }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="3" y="8" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      {closed ? (
        <path d="M6 8V5.5a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth="1.5" />
      ) : (
        <path d="M6 8V5.5a3 3 0 0 1 5.8-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      )}
    </svg>
  )
}
