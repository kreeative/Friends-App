import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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

/**
 * The photograph, framed to its own shape.
 *
 * THE DARK BARS, AND WHY `cover` ALONE IS THE WRONG ANSWER.
 *
 * This was a fixed 4:3 box with `object-contain`, which meant a photo taken in
 * portrait, which is most of them, sat in the middle of two large dark bars.
 * That is the reported bug and it looked terrible.
 *
 * The obvious fix is `object-cover`, and on its own it trades one fault for a
 * worse one: filling a landscape box with a portrait photo throws away the top
 * and bottom of it. On an ordinary gallery that is a crop. Here the picture IS
 * the evidence, and cropping a photo of a gym floor or a finished page can
 * remove the very thing somebody posted it to show.
 *
 * So the box takes the photo's shape instead of the photo taking the box's.
 * The natural ratio is read on load and becomes the frame's aspect-ratio, so a
 * portrait photo gets a portrait frame and fills it edge to edge with nothing
 * cropped and no bars anywhere. `cover` then has nothing to cut, and stays as
 * the belt for the two cases below.
 *
 * TWO LIMITS, AND BOTH EARN THEIR PLACE.
 *
 * The ratio is clamped, because a panorama or a full-page screenshot would
 * otherwise produce a frame the shape of a letterbox or a drainpipe. Outside
 * those bounds `cover` crops, which is the right behaviour for a shape nothing
 * sensible can be done with.
 *
 * And the height is capped in viewport units, because the whole point of the
 * previous fixed box was that the reactions underneath stay reachable. A tall
 * portrait photo on a short phone hits the cap, and `cover` crops it there
 * rather than pushing everything else off the screen.
 */
function PhotoFrame({ url }) {
  /* 4:3 until the image says otherwise. A frame that starts at zero height and
     jumps once the photo decodes is a page that moves under a thumb. */
  const [ratio, setRatio] = useState(4 / 3)

  return (
    <div
      className="relative w-full shrink-0 overflow-hidden rounded-3xl bg-black/30 shadow-float"
      /* Capped by the room actually left rather than by a share of the
         screen. The chrome above and below the picture is a fixed twenty rem
         (header, the goal pill, the edit button, the reaction row, the safe
         areas), so subtracting it is what keeps the reactions above the fold
         on a short phone while letting a tall one show the photograph whole.
         At 62dvh the same phone photo was uncropped on a 844px screen and
         pushed the reactions off a 667px one. */
      style={{ aspectRatio: ratio, maxHeight: 'calc(100dvh - 20rem)' }}
    >
      <img
        src={url}
        alt=""
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget
          if (!w || !h) return
          setRatio(Math.min(1.6, Math.max(0.62, w / h)))
        }}
        className="h-full w-full object-cover object-center"
      />

      {/**
       * The rim, drawn over the photograph rather than around it.
       *
       * `ring-inset` on the frame itself is painted under the image, so on a
       * photo that fills its box the edge was invisible, which is exactly when
       * a dark photograph needs separating from the dark scrim behind it. An
       * overlay with pointer-events off sits on top and always shows.
       */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/20"
      />
    </div>
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
 * One proof, full size, with the four ways to say something about it.
 *
 * Not a route. A photograph is something you look at and dismiss, and pushing a
 * screen for it means the back button leaves the gallery rather than the
 * picture. Escape and the backdrop both close it, and the body does not scroll
 * behind it.
 *
 * PORTALLED, AND THAT IS THE WHOLE OF THE OVERLAP BUG.
 *
 * It was `fixed inset-0 z-50` rendered where it sits in the tree, and that is
 * not the same thing as covering the viewport. position:fixed resolves against
 * the nearest ancestor with a transform, filter or backdrop-filter, not against
 * the window, and this component renders inside `.page-enter`, which animates
 * in with a transform. So the overlay was fixed to a card-sized box partway
 * down the page, its header sat underneath the app bar, and no amount of
 * z-index could help: the two were never in the same stacking context to begin
 * with. Out at the body there is nothing above it to capture the positioning.
 *
 * Third time this exact bug has appeared in this repo. The bottom sheets had
 * it, the journal editor had it, and now this.
 *
 * A COLUMN THAT SCROLLS, NOT A BLOCK THAT IS CENTRED.
 *
 * The old layout centred one tall stack in a flex box, so on a short screen the
 * reactions were simply below the fold with nothing to scroll. Now the header
 * and the picture are fixed height, and everything under them scrolls, so the
 * bottom row is always reachable however tall the photograph is.
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

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-ink/90 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-4"
        onClick={(e) => e.stopPropagation()}
        /* The notch, the status bar and the home indicator. Without the top
           inset the avatar sits under the clock on a notched phone; without
           the bottom one the last reaction row sits under the home bar. */
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* ---- who and when, and the way out ---------------------------- */}
        <div className="flex shrink-0 items-center gap-3 pb-3">
          <Avatar
            profile={{ display_name: proof.display_name, avatar_url: proof.avatar_url }}
            size={36}
            onDark
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
            className="press shrink-0 rounded-pill bg-white/15 px-3.5 py-2 text-small font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
          >
            {t('ui.close')}
          </button>
        </div>

        {/* ---- the proof itself ------------------------------------------ */}
        {kind === 'photo' && <PhotoFrame url={proof.photo_url} />}

        {kind === 'link' && (
          /**
           * An anchor, opening away from the app.
           *
           * noreferrer as well as noopener: without the second the target page
           * learns which app sent it, and a proof link is somebody's private
           * Strava or a work document. The href has already been through
           * normaliseLink on the way in, which is what stops a javascript: URL
           * ever reaching an href here, and the check constraint in migration
           * 28 is the second wall.
           */
          <a
            href={proof.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="press flex shrink-0 items-center gap-3 rounded-3xl bg-white/10 p-4 no-underline ring-1 ring-inset ring-white/15 backdrop-blur-md"
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
          <p className="shrink-0 whitespace-pre-wrap rounded-3xl bg-white/10 p-5 text-body leading-relaxed text-white ring-1 ring-inset ring-white/15 backdrop-blur-md">
            {proof.evidence}
          </p>
        )}

        {/**
         * ---- everything else, in rows, scrolling -----------------------
         *
         * Three separate rows with real space between them, because they are
         * three different kinds of thing: what this was for, what you can do
         * to it, and what you can say about it. They used to run together with
         * 8px between them and read as one paragraph of buttons.
         */}
        <div className="no-scrollbar mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
          {(proof.goal_title || (proof.evidence && kind !== 'text')) && (
            <div className="space-y-2">
              {proof.goal_title && (
                <p className="inline-flex items-center rounded-pill bg-white/10 px-3.5 py-1.5 text-label font-semibold text-white backdrop-blur-md">
                  {proof.goal_title}
                </p>
              )}
              {/* The caption, when it is one. On a text proof the evidence IS
                  the proof and has already been rendered above; repeating it
                  here was the same sentence twice. */}
              {proof.evidence && kind !== 'text' && (
                <p className="text-small leading-relaxed text-white/80">{proof.evidence}</p>
              )}
            </div>
          )}

          {/**
           * Yours to change, and only yours.
           *
           * Gated on the viewer being the person who filed it. The database
           * agrees independently: checkin_items_write is scoped to check-ins
           * you own, so hiding this button is a courtesy and not the control.
           */}
          {mine && (
            <div>
              <button
                type="button"
                onClick={() => onEdit(proof)}
                className="press inline-flex items-center gap-1.5 rounded-pill bg-white/10 px-4 py-2 text-small font-semibold text-white ring-1 ring-inset ring-white/20 backdrop-blur-md transition-colors hover:bg-white/20"
              >
                {t('proof.edit')}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {REACTIONS.map((emoji) => {
              const on = reacted.has(emoji)
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(proof, emoji, on)}
                  aria-pressed={on}
                  /* The chosen one is solid rather than another pane of glass:
                     at 10% white on 10% white, "I reacted" and "I did not" were
                     the same button twice. */
                  className={`press inline-flex items-center gap-2 rounded-pill px-4 py-2.5 text-small font-semibold transition-colors ${
                    on
                      ? 'bg-white text-ink'
                      : 'bg-white/10 text-white ring-1 ring-inset ring-white/20 backdrop-blur-md hover:bg-white/20'
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
    </div>,
    document.body,
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
