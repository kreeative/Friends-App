import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { REACTIONS, REACTION_GLYPH, byMonth, loadProofs, toggleReaction } from '../lib/proofs'
import { Avatar, Empty, Section } from './ui'

/**
 * What the group actually did, in photographs.
 *
 * Everything else in this app is a claim: a tick, a percentage, a line of text
 * saying the videos were posted. This is the one screen that shows the thing
 * itself, and it is the reason the proof column stopped being a sentence.
 *
 * A grid rather than a feed. A feed is read once, in order, and then it is
 * behind you; a grid is a place you go back to, which is what "look at what we
 * did in August" needs. Three columns because at phone width that is the
 * largest tile that still reads as a collection rather than as a list.
 *
 * The reaction glyphs are drawn from the type rather than from the emoji font.
 * An emoji here would sit at a different weight and colour from everything
 * around it, which is the argument the budget banner already lost once.
 */

/** One tile. The image is the button; everything else floats on top of it. */
function Tile({ proof, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(proof)}
      className="press relative aspect-square overflow-hidden rounded-card ring-1 ring-inset ring-ink/[0.06]"
    >
      <img
        src={proof.photo_url}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />

      {/* Who, bottom left, small. The grid is mostly one person's own photos,
          so this is a label rather than a headline. */}
      <span className="absolute bottom-1.5 left-1.5">
        <Avatar
          profile={{ display_name: proof.display_name, avatar_url: proof.avatar_url }}
          size={22}
        />
      </span>

      {/* Only when there are any. A zero on every tile is ninety zeroes. */}
      {proof.reaction_count > 0 && (
        <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-pill bg-ink/70 px-2 py-0.5 text-label font-bold text-white backdrop-blur-sm">
          <span aria-hidden="true">{REACTION_GLYPH.heart}</span>
          {proof.reaction_count}
        </span>
      )}
    </button>
  )
}

/**
 * One photograph, full size, with the four ways to say something about it.
 *
 * Not a route. A photograph is something you look at and dismiss, and pushing
 * a screen for it means the back button leaves the gallery rather than the
 * picture. Escape and the backdrop both close it, and the body does not scroll
 * behind it.
 */
function Viewer({ proof, onClose, onReact, locale }) {
  const { t } = useT()

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  if (!proof) return null

  const mine = new Set(proof.my_reactions ?? [])
  const counts = proof.reaction_counts ?? {}
  const when = new Date(proof.submitted_at)

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex min-h-0 flex-1 flex-col justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center gap-3 pb-3">
            <Avatar
              profile={{ display_name: proof.display_name, avatar_url: proof.avatar_url }}
              size={36}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-small font-semibold text-white">
                {proof.display_name}
              </span>
              <span className="block text-label text-white/60">
                {when.toLocaleString(localeTag(locale), {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </span>
            <button
              onClick={onClose}
              aria-label={t('ui.close')}
              className="press rounded-pill bg-white/15 px-3 py-1.5 text-small font-bold text-white"
            >
              {t('ui.close')}
            </button>
          </div>

          {/* contain, not cover. The modal is where the whole frame is shown;
              cropping here would mean the picture is never seen intact. */}
          <img
            src={proof.photo_url}
            alt=""
            className="max-h-[58dvh] w-full rounded-card object-contain"
          />

          {proof.goal_title && (
            <p className="mt-3 inline-flex items-center rounded-pill bg-white/15 px-3 py-1 text-label font-bold text-white">
              {proof.goal_title}
            </p>
          )}

          {proof.evidence && (
            <p className="mt-2 text-small text-white/75">{proof.evidence}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {REACTIONS.map((emoji) => {
              const on = mine.has(emoji)
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(proof, emoji, on)}
                  aria-pressed={on}
                  className={`press inline-flex items-center gap-2 rounded-pill px-4 py-2 text-small font-bold transition-colors ${
                    on ? 'bg-accent text-on-accent' : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  <span aria-hidden="true">{REACTION_GLYPH[emoji]}</span>
                  {t(`proof.react_${emoji}`)}
                  {counts[emoji] > 0 && (
                    <span className="[font-variant-numeric:tabular-nums]">{counts[emoji]}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * @param limit         how many to show. The full screen wants everything; the
 *                      strip under the check-in wants one screenful.
 * @param refreshToken  any value that changes when the caller knows there is
 *                      something new. This is the fix for "the photo I just
 *                      submitted is not here": the gallery had no reason to
 *                      re-read, so a check-in filed on the same screen left it
 *                      showing the set it loaded on mount.
 */
export default function ProofGallery({ groupId, limit, refreshToken = 0 }) {
  const { user } = useAuth()
  const { t, locale } = useT()

  const [proofs, setProofs] = useState([])
  const [missing, setMissing] = useState(false)
  const [open, setOpen] = useState(null)

  const load = useCallback(async () => {
    const r = await loadProofs(groupId, limit)
    setProofs(r.proofs)
    setMissing(r.missing)
  }, [groupId, limit])

  useEffect(() => {
    load()
  }, [load, refreshToken])

  /* Coming back to the tab, because a photograph gets there by somebody else
     posting one and nothing in this browser will hear about that. */
  useEffect(() => {
    const onWake = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onWake)
    return () => document.removeEventListener('visibilitychange', onWake)
  }, [load])

  const months = useMemo(() => byMonth(proofs, localeTag(locale)), [proofs, locale])

  /**
   * Reacting moves the count before the network answers, and the open viewer
   * with it. A heart that waits for a round trip to appear is a heart people
   * tap twice.
   */
  const react = useCallback(
    async (proof, emoji, isOn) => {
      const apply = (row) => {
        if (row.item_id !== proof.item_id) return row
        const mine = new Set(row.my_reactions ?? [])
        const counts = { ...(row.reaction_counts ?? {}) }

        if (isOn) {
          mine.delete(emoji)
          counts[emoji] = Math.max(0, (counts[emoji] ?? 1) - 1)
          if (!counts[emoji]) delete counts[emoji]
        } else {
          mine.add(emoji)
          counts[emoji] = (counts[emoji] ?? 0) + 1
        }

        return {
          ...row,
          my_reactions: [...mine],
          reaction_counts: counts,
          reaction_count: Math.max(0, (row.reaction_count ?? 0) + (isOn ? -1 : 1)),
        }
      }

      setProofs((prev) => prev.map(apply))
      setOpen((prev) => (prev ? apply(prev) : prev))

      const { error } = await toggleReaction(proof.item_id, user?.id, emoji, isOn)
      if (error) await load()
    },
    [user?.id, load],
  )

  if (missing) {
    return (
      <Section title={t('proof.title')}>
        <div className="lg px-5 py-2">
          <Empty>{t('proof.not_installed')}</Empty>
        </div>
      </Section>
    )
  }

  if (proofs.length === 0) {
    return (
      <Section title={t('proof.title')}>
        <div className="lg px-5 py-2">
          <Empty>{t('proof.empty')}</Empty>
        </div>
      </Section>
    )
  }

  return (
    <>
      {months.map((month) => (
        /* The month is the section heading, so the grid gets the page's own
           rhythm rather than a second heading style invented for it. */
        <Section key={month.key} title={month.label}>
          <div className="grid grid-cols-3 gap-2">
            {month.proofs.map((proof) => (
              <Tile key={proof.item_id} proof={proof} onOpen={setOpen} />
            ))}
          </div>
        </Section>
      ))}

      <Viewer proof={open} onClose={() => setOpen(null)} onReact={react} locale={locale} />
    </>
  )
}
