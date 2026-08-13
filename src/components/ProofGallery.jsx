import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { localeTag, useT } from '../lib/i18n'
import { REACTIONS, REACTION_GLYPH, byMonth, loadProofs, toggleReaction } from '../lib/proofs'
import { linkHost, proofOf } from '../lib/proofKinds'
import { Avatar, Empty, Section } from './ui'
import ProofEditSheet from './ProofEditSheet'

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

/**
 * One tile, whichever of the three kinds it is.
 *
 * The grid was photographs only, because until migration 28 a photograph was
 * the only proof the schema could hold and the view filtered on `photo_url is
 * not null`. A link and a note now occupy the same square, drawn rather than
 * photographed: the tile has to stay square or the grid stops being a grid,
 * and a link tile that was a short wide bar would break the rhythm of every
 * row it appeared in.
 */
function Tile({ proof, onOpen }) {
  const { t } = useT()
  const kind = proofOf(proof)?.kind ?? 'text'

  return (
    <button
      type="button"
      onClick={() => onOpen(proof)}
      className="press relative aspect-square overflow-hidden rounded-card bg-raised ring-1 ring-inset ring-ink/[0.06]"
    >
      {kind === 'photo' ? (
        <img src={proof.photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : kind === 'link' ? (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2">
          <LinkGlyph />
          {/* The host, not the URL. A tile is about 110px wide and a real link
              is two hundred characters of tracking parameters; "strava.com" is
              the part that says what this is. */}
          <span className="w-full truncate text-center text-label font-semibold text-ink">
            {linkHost(proof.link_url) || t('proof.kind_link')}
          </span>
        </span>
      ) : (
        /* pb-7 leaves the bottom-left corner to the avatar. Without it the
           face sits on the last line of the note, which the fade softens but
           does not fix. */
        <span className="flex h-full w-full items-start p-2.5 pb-7">
          <span className="fade-b line-clamp-4 text-left text-label leading-snug text-ink">
            {proof.evidence}
          </span>
        </span>
      )}

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
        <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-pill bg-ink/70 px-2 py-0.5 text-label font-semibold text-white backdrop-blur-sm">
          <span aria-hidden="true">{REACTION_GLYPH.heart}</span>
          {proof.reaction_count}
        </span>
      )}
    </button>
  )
}

function LinkGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-muted">
      <path
        d="M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.3-1.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
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
function Viewer({ proof, onClose, onReact, onEdit, locale, mine }) {
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

  const reacted = new Set(proof.my_reactions ?? [])
  const counts = proof.reaction_counts ?? {}
  const when = new Date(proof.submitted_at)
  const kind = proofOf(proof)?.kind ?? 'text'

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
              className="press rounded-pill bg-white/15 px-3 py-1.5 text-small font-semibold text-white"
            >
              {t('ui.close')}
            </button>
          </div>

          {kind === 'photo' && (
            /* contain, not cover. The modal is where the whole frame is shown;
               cropping here would mean the picture is never seen intact. */
            <img
              src={proof.photo_url}
              alt=""
              className="max-h-[58dvh] w-full rounded-card object-contain"
            />
          )}

          {kind === 'link' && (
            /**
             * An anchor, opening away from the app.
             *
             * noreferrer as well as noopener: without the second the target
             * page learns which app sent it, and a proof link is somebody's
             * private Strava or a work document. The href has already been
             * through normaliseLink on the way in, which is what stops a
             * javascript: URL ever reaching an href here, and the check
             * constraint in migration 28 is the second wall.
             */
            <a
              href={proof.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="press flex items-center gap-3 rounded-card bg-white/15 p-4 no-underline"
            >
              <span className="text-white/70">
                <LinkGlyph />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small font-semibold text-white">
                  {linkHost(proof.link_url)}
                </span>
                <span className="block truncate text-label text-white/60">{proof.link_url}</span>
              </span>
              <span aria-hidden="true" className="text-small text-white/70">
                ↗
              </span>
            </a>
          )}

          {kind === 'text' && (
            <p className="whitespace-pre-wrap rounded-card bg-white/10 p-4 text-body leading-relaxed text-white">
              {proof.evidence}
            </p>
          )}

          {proof.goal_title && (
            <p className="mt-3 inline-flex items-center rounded-pill bg-white/15 px-3 py-1 text-label font-semibold text-white">
              {proof.goal_title}
            </p>
          )}

          {/* The caption, when it is one. On a text proof the evidence IS the
              proof and has already been rendered above; repeating it here was
              the same sentence twice. */}
          {proof.evidence && kind !== 'text' && (
            <p className="mt-2 text-small text-white/75">{proof.evidence}</p>
          )}

          {/**
           * Yours to change, and only yours.
           *
           * Gated on the viewer being the person who filed it. The database
           * agrees independently: checkin_items_write is scoped to check-ins
           * you own, so hiding this button is a courtesy and not the control.
           */}
          {mine && (
            <button
              type="button"
              onClick={() => onEdit(proof)}
              className="press mt-3 inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3.5 py-1.5 text-small font-semibold text-white transition-colors hover:bg-white/25"
            >
              {t('proof.edit')}
            </button>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {REACTIONS.map((emoji) => {
              const on = reacted.has(emoji)
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(proof, emoji, on)}
                  aria-pressed={on}
                  className={`press inline-flex items-center gap-2 rounded-pill px-4 py-2 text-small font-semibold transition-colors ${
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
  const [editing, setEditing] = useState(null)

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

  /**
   * No heading of its own, in any state.
   *
   * This used to wrap its empty and missing states in a Section titled
   * "Proof", and the check-in wraps the whole component in a Section titled
   * "Proof" as well, so the screen showed the word twice, one under the other,
   * with nothing between them. The /proofs screen has the same title in its
   * TopBar.
   *
   * A component that renders into somebody else's section should not name
   * itself. The caller owns the heading and the "See all" beside it; this owns
   * the photographs and the month labels between them.
   */
  if (missing) {
    return (
      <div className="lg px-5 py-2">
        <Empty>{t('proof.not_installed')}</Empty>
      </div>
    )
  }

  if (proofs.length === 0) {
    return (
      <div className="lg px-5 py-2">
        <Empty>{t('proof.empty')}</Empty>
      </div>
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

      <Viewer
        proof={open}
        onClose={() => setOpen(null)}
        onReact={react}
        onEdit={(p) => {
          /* The viewer closes as the sheet opens. Two stacked overlays with a
             scrim each is the dialog-on-a-dialog the budget intro already lost
             an argument about. */
          setOpen(null)
          setEditing(p)
        }}
        mine={Boolean(open && user?.id && open.user_id === user.id)}
        locale={locale}
      />

      <ProofEditSheet
        proof={editing}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
    </>
  )
}
