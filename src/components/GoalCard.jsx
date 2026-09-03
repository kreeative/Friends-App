import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { shortDate } from '../lib/time'
import { localeTag, useT } from '../lib/i18n'
import { errorText } from '../lib/dberr'
import { countOn, nextCount, progressFor, recentDays, streakOf } from '../lib/streak'
import { rectOf } from '../lib/gesture'
import { Avatar } from './ui'
import ConfirmDialog from './ConfirmDialog'
import GoalDetail from './GoalDetail'

/**
 * Finished states. Each gets its own card colour and a chip, rather than the
 * word appended to the cadence line where it was previously. "3 times a day
 * · done" is the kind of sentence you read past.
 */
const DONE = {
  completed: { label: 'goal.done', card: 'card-done', chip: 'chip-green' },
  abandoned: { label: 'goal.dropped', card: 'card-dropped', chip: 'chip-quiet' },
}

/**
 * Seven days of dots, oldest on the left.
 *
 * The streak is one number and a number is a claim; this is the evidence for
 * it, and it is the part that makes a broken streak feel recoverable rather
 * than final. A day the goal was never due is drawn as a gap rather than a
 * miss, because a Mon/Wed goal showing five empty circles is a picture of
 * failing at something nobody asked for.
 */
function DayDots({ days }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {days.map((d) =>
        !d.due ? (
          <span key={d.day} className="h-1 w-1 rounded-pill bg-ink/15" />
        ) : (
          <span
            key={d.day}
            className={`h-2.5 w-2.5 rounded-pill transition-colors duration-200 ease-settle ${
              d.done ? 'bg-accent' : 'bg-ink/[0.13]'
            }`}
          />
        ),
      )}
    </div>
  )
}

export default function GoalCard({
  goal,
  owner,
  /**
   * Rendered inside the card, under everything else.
   *
   * This is where the daily check-in goes. It was a sibling below the card for
   * one round and that was visibly wrong: a hairline and a question floating on
   * the page background next to a card, rather than the card asking it. "Move
   * it onto each card" is the request and inside the <article> is the only
   * place that is literally true.
   *
   * A slot rather than the check-in itself, because GoalCard draws a goal and
   * should not also know what a cycle is. The page that has the answers passes
   * the block in.
   */
  footer = null,
  showControls = false,
  progress = null,
  editHref = null,
  /**
   * Whether this card carries the daily tick.
   *
   * On for a goal with no group, which has nowhere else to be marked done: the
   * check-in runs off cycles, and cycles belong to groups. Off for a goal
   * inside a group, where the check-in already owns this question and a second
   * private tick would be two answers to it.
   */
  track = false,
  /** Whether the person looking at this may delete it. See canDelete in Goals. */
  deletable = false,
}) {
  const { reloadGroup, dayIndex, setGoalDay, removeGoal } = useGroup()
  const { t, locale } = useT()
  const paused = goal.status === 'paused'
  const finished = DONE[goal.status] ?? null

  const [asking, setAsking] = useState(false)
  /* Whether the overflow menu is open. Per card, so two cards cannot both be
     showing one. */
  const [menu, setMenu] = useState(false)
  /**
   * Where to draw it, in viewport coordinates, measured when it opens.
   *
   * The menu is portalled to document.body to escape the card's
   * overflow-hidden, and the price of leaving the card is that it can no
   * longer be placed by `right-0` relative to the button. So the button is
   * measured instead.
   *
   * `flip` is not a nicety. The last card in a list sits near the bottom of
   * the viewport, and a menu drawn downwards from it opens off the bottom of
   * the screen: the same "cannot reach what it offers" as the clipping bug,
   * arrived at from the other direction. When there is not room below, it
   * hangs upwards from the button instead.
   */
  const [at, setAt] = useState(null)
  const menuBtn = useRef(null)

  const place = () => {
    const el = menuBtn.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    /* Roughly what the menu needs: four rows at 2.375rem plus its padding.
       Approximate on purpose, because the real height is not knowable until
       it has rendered, and one frame of it in the wrong place is worse than a
       few pixels of slack. */
    const need = 200

    /**
     * The floor is the tab bar, not the bottom of the window.
     *
     * The bar is fixed over the page on phones, so the room below a button is
     * the room down to IT. Measured at 41px of overlap when this used the
     * viewport height: the menu still worked, because it stacks above the bar,
     * but "Supprimer" sat on top of the navigation, which is a bad place to
     * put the one action that cannot be undone.
     *
     * Queried rather than assumed, because the bar is `md:hidden` and its
     * height moves with env(safe-area-inset-bottom).
     */
    const bar = document.querySelector('[data-hook="tab-bar"]')
    const floor = (bar ? bar.getBoundingClientRect().top : window.innerHeight) - 8
    const ceil = 8

    /* Right edges aligned, which is what right-0 did before, then clamped to
       both edges: min-w is 11rem and the viewport can be narrower than the
       card's own margins would suggest. */
    const left = Math.max(8, Math.min(r.right - 176, window.innerWidth - 184))

    /* Below the button when it fits above the bar. */
    if (r.bottom + 4 + need <= floor) return { left, top: r.bottom + 4, flip: false }
    /* Otherwise above it, when THAT fits under the top of the screen. */
    if (r.top - 4 - need >= ceil) return { left, top: r.top - 4, flip: true }
    /* Neither: sit on the floor. A menu not quite touching its button is a
       smaller problem than one hanging off the edge of the screen. */
    return { left, top: floor, flip: true }
  }

  const openMenu = () => {
    if (menu) return setMenu(false)
    setAt(place())
    setMenu(true)
  }

  /**
   * Scrolling closes it rather than moving it.
   *
   * A fixed menu measured once and left alone detaches from its button the
   * moment the page moves under it, and following the button costs a
   * measurement on every scroll frame for a control open for two seconds.
   * Closing is both cheaper and the behaviour every native menu has.
   */
  useEffect(() => {
    if (!menu) return undefined
    const shut = () => setMenu(false)
    window.addEventListener('scroll', shut, true)
    window.addEventListener('resize', shut)
    const onKey = (e) => e.key === 'Escape' && setMenu(false)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', shut, true)
      window.removeEventListener('resize', shut)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [ticking, setTicking] = useState(false)
  /**
   * The optimistic half of deleting, and it lives here rather than in the list
   * for one reason: this component owns the dialog. Removing the goal from the
   * list first is the obvious build and it unmounts the only thing capable of
   * saying the delete failed, so a refusal looked like the card blinking out
   * and returning with no explanation. Hiding itself keeps it mounted.
   */
  const [gone, setGone] = useState(false)

  /**
   * The rectangle this card occupied when it was tapped, and null when the
   * full page is shut.
   *
   * The rect and the open flag are one piece of state on purpose: the morph
   * needs the geometry of the card AT THE MOMENT OF THE TAP, and measuring it
   * later gets the wrong answer, because by then the page behind has a dialog
   * over it and the body has had its scrolling locked.
   */
  const [origin, setOrigin] = useState(null)

  async function setStatus(status) {
    await supabase.from('goals').update({ status }).eq('id', goal.id)
    await reloadGroup()
  }

  const today = progressFor(goal, dayIndex, new Date())
  const streak = track ? streakOf(goal, dayIndex, new Date()) : 0

  /**
   * One tap, and the count it produces is worked out from the same index the
   * card is drawn from rather than from a piece of local state. Two components
   * showing one goal would otherwise disagree, and the tick would fight the
   * refetch.
   */
  async function tick() {
    if (ticking) return
    setTicking(true)
    const current = countOn(dayIndex, goal.id, today.day)
    await setGoalDay(goal, nextCount(goal, current))
    setTicking(false)
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError(null)
    /* The card goes now, before the request. The question has been answered
       and waiting on a round trip to acknowledge it is what makes an app feel
       slow on a phone with two bars. */
    setGone(true)

    const { error } = await removeGoal(goal)

    if (error) {
      /* Back on screen, dialog still open, reason printed. Nothing was
         changed in the database, so putting the card back is the whole of the
         rollback: there is no stale value to reconcile. */
      setGone(false)
      setDeleting(false)
      setDeleteError(errorText(error))
      return
    }
    /* Deliberately not closing the dialog or clearing state: the goal has left
       the list, so this component is about to unmount, and setting state on
       the way out is a warning for nothing. */
  }

  /* A one-off with no due date says "une fois" rather than "avant le" with
     nothing after it. The date is optional by design, so the missing case is
     ordinary and gets its own sentence instead of a broken one. */
  const due = shortDate(goal.due_on, localeTag(locale))
  const cadence =
    goal.cadence === 'recurring'
      ? t('goal.times_a_day', { n: goal.target_per_cycle })
      : due
        ? t('goal.by_date', { date: due })
        : t('goal.once')

  const when = [goal.trigger_when, goal.trigger_where].filter(Boolean).join(', ')

  /* Measured from the article, not from the button inside it: the thing that
     should appear to grow is the card, and the tappable region is only its
     upper half. Growing from the header alone lands the page's top-left corner
     in the middle of where the card was. */
  const article = useRef(null)
  const expand = () => setOrigin(rectOf(article.current))

  /**
   * The card and the dialog are siblings, not parent and child, and that is
   * deliberate: `gone` hides the article while leaving the dialog mounted, so
   * a delete that comes back refused still has somewhere to print why. The
   * dialog portals to the body regardless, so nothing about its position
   * depends on the article being here.
   */
  return (
    <>
      {!gone && (
    /**
     * Four levels, where there used to be one.
     *
     * Every line on this card was the same size and the same colour: the
     * title, the cadence, the trigger, the proof and the owner's name, five
     * stacked sentences in identical type. Nothing was findable, because
     * finding something in a list requires the list to have a shape.
     *
     * So: who it belongs to is a badge above, the commitment is the one big
     * thing, and everything that used to be a sentence underneath is a pill.
     * Pills work here because these facts are short, unordered and scanned
     * rather than read, which is exactly the case running text handles worst.
     */
    <article
      ref={article}
      /* overflow-hidden is the backstop, not the fix. Everything inside is
         constrained on its own; this is what stops the next field somebody
         adds from painting onto the page background before anybody notices. */
      className={`${finished?.card ?? 'lg p-5'} w-full overflow-hidden transition-opacity duration-200 ease-settle ${
        paused ? 'opacity-55' : ''
      }`}
    >
      {/**
       * The upper half of the card is the way in, and only the upper half.
       *
       * Not the whole article: the tick, the three status controls and the
       * delete are all buttons, and a button inside a button is invalid HTML
       * that browsers resolve by dropping one of them. So the region that
       * opens the page is the part that is pure description, which is also the
       * part somebody reaching for "tell me more about this" aims at.
       *
       * A real button rather than a div with a click handler: it needs to be
       * reachable by keyboard, announce itself, and take the focus ring, and
       * all three come free from the element that already means this.
       */}
      <button
        type="button"
        onClick={expand}
        aria-haspopup="dialog"
        className="press -m-1 block w-full rounded-inner p-1 text-left transition-colors hover:bg-ink/[0.02]"
      >
      {/**
       * Whose goal it is, first and quietly. It was the last line on the card,
       * under the buttons, which is where you put something nobody needs; in a
       * shared list it is the first thing you check.
       *
       * SHOWN ONLY WHEN IT HAS SOMETHING TO SAY. The badge used to render
       * unconditionally and fell back to "everyone" whenever the owner's
       * profile could not be resolved. On /goals there is no group and so no
       * roster to resolve anybody against, which labelled every private goal
       * TOUT LE MONDE: the exact opposite of what that page is, printed on the
       * one screen whose promise is that nobody else can see it.
       *
       * Three cases, and now each says the true thing: a named owner gets
       * their name, a goal belonging to the group gets "everyone", and a goal
       * of your own on a page with only your own gets no badge, because there
       * is nobody it could belong to but you.
       */}
      {(owner || goal.kind === 'group') && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="inline-flex min-w-0 items-center gap-2 rounded-pill bg-accent/[0.14] py-1 pl-1 pr-3">
            {owner ? (
              <Avatar profile={owner} size={20} />
            ) : (
              <span className="h-5 w-5 shrink-0 rounded-pill bg-accent/30" aria-hidden="true" />
            )}
            <span className="truncate text-label font-semibold uppercase tracking-[0.06em] text-ink">
              {owner ? owner.display_name : t('goal.everyone')}
            </span>
          </span>

          {finished && <span className={`${finished.chip} shrink-0`}>{t(finished.label)}</span>}
        </div>
      )}

      {/* Without the badge above there is nowhere else for the finished chip to
          go, so it sits beside the title instead of disappearing with it. */}
      <div className="flex items-start justify-between gap-3">
        {/* text-safe is min-width:0 plus permission to break a long word. The
            chip beside it is shrink-0, so without the first of those the title
            cannot give way and widens the card instead of wrapping. */}
        {/* Clamped to three lines, which is a judgement the pixel measurement
            could not make and the screenshot could: a pasted URL was contained
            but ran to nine lines and swallowed the card. Three is chosen
            because an ordinary long commitment, "reviser la biochimie tous les
            soirs avant de dormir", is exactly three lines at this width, so
            real titles are untouched and only the pathological ones are cut.
            GoalDetail renders the same field unclamped, so nothing is lost:
            the full text is one tap away, and the card is a summary. */}
        <h3 className="text-safe line-clamp-3 text-h2 font-semibold text-ink">{goal.commitment}</h3>
        {finished && !owner && goal.kind !== 'group' && (
          <span className={`${finished.chip} shrink-0`}>{t(finished.label)}</span>
        )}
      </div>

      {/**
       * Two tones, not one. The cadence is the goal's own rule and carries the
       * accent; when, where, proof and stake are circumstances and sit on ink.
       * A row of five identical pills would be the same flatness the sentences
       * had, in a rounder shape.
       */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-pill bg-accent/[0.14] px-3 py-1 text-label font-semibold text-ink ring-1 ring-inset ring-accent/25">
          {cadence}
        </span>

        {/* These three carry whatever was typed into the form, so they are the
            ones that escape. pill-safe caps them at the card width and clamps
            the text to two lines; the inner span is what the clamp needs,
            since an inline-flex box cannot carry one. */}
        {when && (
          <span className="pill-safe inline-flex items-center rounded-pill bg-ink/[0.055] px-3 py-1 text-label font-semibold text-muted">
            <span>{when}</span>
          </span>
        )}

        {goal.evidence_def && (
          <span className="pill-safe inline-flex items-center rounded-pill bg-ink/[0.055] px-3 py-1 text-label font-semibold text-muted">
            <span>{t('goal.proof', { text: goal.evidence_def })}</span>
          </span>
        )}

        {goal.stake_text && (
          <span className="pill-safe inline-flex items-center rounded-pill bg-ink/[0.055] px-3 py-1 text-label font-semibold text-muted">
            <span>{goal.stake_text}</span>
          </span>
        )}

        {paused && (
          <span className="inline-flex items-center rounded-pill bg-ink/[0.055] px-3 py-1 text-label font-semibold text-muted">
            {t('goal.paused')}
          </span>
        )}
        </div>
      </button>

      {progress && (
        <div className="mt-6">
          {/* Yellow, not pink: this is progress, not something you tap. */}
          <div className="h-1.5 w-full overflow-hidden rounded-pill bg-ink/[0.07]">
            <div
              className="h-full rounded-pill bg-accent transition-[width] duration-300 ease-settle"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <p className="mt-2.5 text-small text-muted">
            {t('goal.progress', { done: progress.actual, total: progress.target })}
          </p>
        </div>
      )}

      {/**
       * The daily tick, for a goal with no group behind it.
       *
       * This is the whole of what was missing. Migration 09 let a goal exist
       * without a group; nothing let it be marked done, because every path to
       * "I did it" ran through cycles, and cycles belong to groups. So a solo
       * goal sat on the screen unticked forever.
       *
       * A checkbox and a streak rather than the check-in screen: the check-in
       * asks for a mood, a note, a proof and a next commitment, which is the
       * right ceremony for five people meeting once a day and far too much to
       * ask of somebody ticking off "drink water" on their own.
       */}
      {track && !finished && (
        <div className="mt-5 border-t border-hairline pt-4">
          {today.due ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={tick}
                disabled={ticking}
                aria-pressed={today.complete}
                className={`press inline-flex items-center gap-2.5 rounded-pill py-2 pl-2 pr-4 text-small font-semibold transition-colors duration-200 ease-settle disabled:opacity-60 ${
                  today.complete ? 'bg-accent text-on-accent' : 'bg-ink/[0.06] text-ink hover:bg-ink/[0.11]'
                }`}
              >
                {/* A box that fills, not an icon font. It has to read as
                    checked from arm's length and in both themes, and a tick
                    drawn in currentColor does that at any density. */}
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-[0.5rem] border-2 transition-colors duration-200 ease-settle ${
                    today.complete ? 'border-on-accent' : 'border-ink/25'
                  }`}
                >
                  {today.complete && (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                {today.target > 1
                  ? t('goal.today_count', { done: today.done, total: today.target })
                  : today.complete
                    ? t('goal.done_today')
                    : t('goal.mark_today')}
              </button>

              {streak > 0 && (
                <span className="text-small font-semibold text-muted">
                  {t('goal.streak', { n: streak })}
                </span>
              )}
            </div>
          ) : (
            /* Not due is not the same as not done, and must not look like it.
               No checkbox at all, because offering one would invite a tick on
               a day the goal does not run and quietly corrupt the streak. */
            <p className="text-small text-muted">{t('goal.not_due_today')}</p>
          )}

          <div className="mt-4">
            <DayDots days={recentDays(goal, dayIndex, 7, new Date())} />
          </div>
        </div>
      )}

      {/**
       * FOUR BUTTONS BECAME A MENU, AND THE CARD IS THE REASON.
       *
       * They were a wrapping row of three filled pills and a red word, which
       * is four things competing at the bottom of every card, none of them the
       * reason anybody opened the page. Managing a goal is rare; looking at
       * one is constant. A row that loud for the rare job made the list read
       * as a settings screen.
       *
       * So they collapse behind one discreet control. Nothing is removed and
       * nothing is harder to reach: it is one tap to open and one to choose,
       * against one tap before, on actions taken once a month.
       *
       * NOT a hover menu. This is a phone first, and a menu that only appears
       * on hover does not exist on a touch screen.
       */}
      {showControls && !finished && (
        <div className="mt-4 flex justify-end">
          <div className="relative">
            <button
              ref={menuBtn}
              type="button"
              onClick={openMenu}
              aria-expanded={menu}
              aria-haspopup="menu"
              aria-label={t('goal.actions')}
              title={t('goal.actions')}
              data-hook="goal-menu"
              className="press flex h-9 w-9 items-center justify-center rounded-pill text-muted hover:bg-ink/[0.06] hover:text-ink"
            >
              <span aria-hidden="true" className="text-h2 leading-none">&#8943;</span>
            </button>

            {/**
             * THE MENU IS PORTALLED, AND THAT IS THE WHOLE FIX.
             *
             * It was `absolute` inside the card, and the card carries
             * overflow-hidden a hundred lines up. An absolutely positioned
             * child does not escape a clipping ancestor, and z-index has no
             * say in it: z-50 stacks the menu above its siblings and the card
             * still cuts it off at its own edge. What people saw was a sliver
             * of a white sheet at the bottom of the card and no way to reach
             * anything in it.
             *
             * The overflow-hidden is not the thing to remove. It is the
             * backstop that stops a single unbroken word spilling out of the
             * card, which is what the whole of cardOverflow.test.mjs exists
             * for. So the menu leaves the card instead: rendered into
             * document.body, positioned against the button's own rect.
             */}
            {menu && at && createPortal(
              <>
                {/* A full-screen button behind the menu, so a tap anywhere
                    closes it. A click handler on the document would fire
                    before React's own and close it on the opening tap. */}
                <button
                  type="button"
                  aria-label={t('goal.actions_close')}
                  onClick={() => setMenu(false)}
                  className="fixed inset-0 z-[70] cursor-default"
                />
                <div
                  role="menu"
                  data-hook="goal-menu-items"
                  /* Fixed, so the coordinates are viewport coordinates and no
                     scrolled ancestor has to be accounted for. Closed on
                     scroll rather than followed, because a menu that chases
                     the page is worse than one that gets out of the way. */
                  style={{ position: 'fixed', top: at.top, left: at.left, ...(at.flip ? { transform: 'translateY(-100%)' } : null) }}
                  className="lg lg-modal z-[71] flex w-max min-w-[11rem] flex-col p-1.5"
                >
                  {editHref && (
                    <Link
                      to={editHref}
                      role="menuitem"
                      className="press rounded-inner px-3 py-2 text-left text-small font-semibold text-ink hover:bg-ink/[0.06]"
                    >
                      {t('goal.edit')}
                    </Link>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenu(false); setStatus(paused ? 'active' : 'paused') }}
                    className="press rounded-inner px-3 py-2 text-left text-small font-semibold text-ink hover:bg-ink/[0.06]"
                  >
                    {paused ? t('goal.resume') : t('goal.pause')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenu(false); setStatus('completed') }}
                    className="press rounded-inner px-3 py-2 text-left text-small font-semibold text-ink hover:bg-ink/[0.06]"
                  >
                    {t('goal.mark_done')}
                  </button>
                  {deletable && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setMenu(false); setAsking(true) }}
                      /* Separated by a rule and set in the negative colour.
                         The one action here that cannot be undone should not
                         be adjacent to the three that can. */
                      className="press mt-1 rounded-inner border-t border-hairline px-3 pb-2 pt-3 text-left text-small font-semibold text-negative hover:bg-negative/[0.09]"
                    >
                      {t('goal.delete')}
                    </button>
                  )}
                </div>
              </>,
              document.body,
            )}
          </div>
        </div>
      )}

      {/* An archived goal keeps one control: putting it back. Nothing else
          makes sense on a record, and a finished goal you want to restart is
          common enough to be worth one tap. */}
      {showControls && finished && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button onClick={() => setStatus('active')} className="goal-action-soft press">
            {t('goal.reopen')}
          </button>
          {deletable && <DeleteButton onClick={() => setAsking(true)} label={t('goal.delete')} />}
        </div>
      )}

      {footer}
    </article>
      )}

      {/* The full page. Rendered per card so it carries this card's own
          rectangle without a list-level registry mapping ids to elements, and
          only one can be open at a time because only one card can be tapped. */}
      <GoalDetail
        goal={origin ? goal : null}
        origin={origin}
        owner={owner}
        track={track}
        deletable={deletable}
        editHref={editHref}
        onClose={() => setOrigin(null)}
      />

      <ConfirmDialog
        open={asking}
        title={t('goal.delete_title')}
        body={t('goal.delete_body')}
        cancelLabel={t('goal.delete_cancel')}
        confirmLabel={deleting ? t('goal.deleting') : t('goal.delete_confirm')}
        busy={deleting}
        error={deleteError}
        onCancel={() => {
          setAsking(false)
          setDeleteError(null)
        }}
        onConfirm={confirmDelete}
      />
    </>
  )
}

/**
 * The destructive one, and it is the only control on the card that does not
 * look like the others.
 *
 * Pushed to the far end of the row by ml-auto rather than sitting fourth in
 * line, so the tap that deletes is never adjacent to the tap that pauses. It
 * carries no fill and no border until you are on it: three filled pills and a
 * fourth in red would make the row look like four equal choices, and this one
 * is not equal to the others.
 *
 * `text-negative` rather than a raw red: the app has two themes and the token
 * is the red that has been checked against both grounds. A fixed red-500 is
 * the correct colour on exactly one of them.
 */
function DeleteButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press ml-auto inline-flex items-center rounded-pill px-4 py-2 text-small font-semibold text-negative transition-colors duration-200 ease-settle hover:bg-negative/[0.09]"
    >
      {label}
    </button>
  )
}
