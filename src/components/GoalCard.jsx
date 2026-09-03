import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useGroup } from '../context/GroupContext'
import { shortDate } from '../lib/time'
import { localeTag, useT } from '../lib/i18n'
import { errorText } from '../lib/dberr'
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

/* DayDots lived here: seven dots under every card, showing which of the last
   seven days the goal was done. It went with the rest of the block under the
   rule. GoalDetail draws the same history at a size you can actually read,
   which is where somebody goes when that is the question they have. */

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
  /** Whether the person looking at this may delete it. See canDelete in Goals. */
  deletable = false,
}) {
  const { reloadGroup, removeGoal } = useGroup()
  const { t, locale } = useT()
  const paused = goal.status === 'paused'
  const finished = DONE[goal.status] ?? null

  const [asking, setAsking] = useState(false)
  /* Whether the overflow menu is open. Per card, so two cards cannot both be
     showing one. */
  const [menu, setMenu] = useState(false)
  /**
   * Escape closes it, like every other transient thing in this app.
   *
   * That is all that is left of the listeners. The floating version also
   * closed on scroll and on resize, because a fixed layer measured once
   * detaches from its button the moment the page moves. The rows are part of
   * the card now, so they move with it and there is nothing to keep in sync.
   */
  useEffect(() => {
    if (!menu) return undefined
    const onKey = (e) => e.key === 'Escape' && setMenu(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu])

  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
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

  /**
   * Whether this goal has a day-by-day history to show.
   *
   * Derived from the goal rather than passed in. It was a `track` prop, and a
   * prop is a thing a caller can forget: the answer is written on the row.
   * goal_days exists for goals with no group, because cycles.group_id is not
   * null and a solo goal has no cycle to be counted in. See lib/streak.js.
   *
   * The CARD does not use it. It is handed to GoalDetail, which is the place a
   * single goal is looked at in depth and is where the streak, the total and
   * the history belong.
   */
  const solo = !goal.group_id

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
      className={`${finished?.card ?? 'lg p-5'} relative w-full overflow-hidden transition-opacity duration-200 ease-settle ${
        paused ? 'opacity-55' : ''
      }`}
    >
      {/**
       * THE THREE DOTS, AT THE TOP, AND A SIBLING OF THE HEADER RATHER THAN
       * INSIDE IT.
       *
       * The region that opens the detail page is a real <button> wrapping the
       * whole upper half of the card, so a control nested in it would be a
       * button inside a button: invalid HTML that browsers resolve by dropping
       * one of the two, and which one is not something to find out per browser.
       * Absolute, over that region, is how both stay real buttons.
       *
       * z-10 and not more: it only has to beat its own card's contents. The
       * menu it opens is no longer a layer over the page, so there is nothing
       * else here to out-stack.
       */}
      {showControls && !finished && (
        <button
          type="button"
          onClick={() => setMenu((v) => !v)}
          aria-expanded={menu}
          aria-controls={`goal-actions-${goal.id}`}
          aria-label={t('goal.actions')}
          title={t('goal.actions')}
          data-hook="goal-menu"
          className="press absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-pill text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink aria-expanded:bg-ink/[0.06] aria-expanded:text-ink"
        >
          <span aria-hidden="true" className="text-h2 leading-none">&#8943;</span>
        </button>
      )}
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
        /* pr-10 when the dots are there, so a long title wraps before it runs
           under them rather than being overprinted by a control it cannot
           see. */
        className={`press -m-1 block w-full rounded-inner p-1 text-left transition-colors hover:bg-ink/[0.02] ${
          showControls && !finished ? 'pr-10' : ''
        }`}
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
       * NOTHING UNDER THE RULE ANY MORE.
       *
       * There was a tick, a "not due today" line, a streak and seven day dots
       * here. Asked for, in these words: "everything after the horizontal line
       * after the objective disappears".
       *
       * The argument is not that the information was wrong, it is that it was
       * in the wrong place. The check-in rail at the top of the page asks
       * whether today is done, once, for every goal due. Repeating the
       * question under each card asked it five more times and made a list of
       * goals read as a list of chores. What is left is what the goal IS: its
       * title, when it is due, how often, and the way to change it.
       *
       * The `track` prop went with the block rather than being left accepted
       * and ignored. Nothing passes it, and a prop every caller has stopped
       * passing is one the next person has to go and check.
       */}

      {/**
       * THE ACTIONS EXPAND THE CARD. THEY ARE NOT A LAYER OVER IT.
       *
       * Three rounds got here. They were a wrapping row of three filled pills
       * and a red word, four things competing at the bottom of every card,
       * none of them the reason anybody opened the page. Then they collapsed
       * behind a discreet control, which was right, but the menu it opened was
       * `absolute` inside a card that carries overflow-hidden, so it was drawn
       * and then clipped away. Then it was portalled to the body and placed
       * against the button's rect, which worked and cost a scrim, a measured
       * position, a flip, a scroll listener and a tab-bar floor.
       *
       * All of that machinery existed to hold a floating layer in the right
       * place. Asked for instead: open the card. So the actions are simply
       * rows at the bottom of the article, and the card gets taller.
       *
       * WHAT THAT DELETES IS THE POINT. No portal, no coordinates, no z-index
       * race, no scrim to dismiss, nothing to reposition on scroll, and
       * nothing that can be clipped by an ancestor, because there is no
       * positioned element left to clip. overflow-hidden stays exactly as it
       * was and is no longer in anybody's way.
       */}
      {showControls && !finished && menu && (
        <div
          id={`goal-actions-${goal.id}`}
          data-hook="goal-menu-items"
          /* animate-rise is the same entrance the rest of the app uses, so the
             card grows rather than the rows appearing already in place. */
          className="animate-rise mt-4 flex flex-col border-t border-hairline pt-3"
        >
          {editHref && (
            <Link
              to={editHref}
              className="press rounded-inner px-3 py-2.5 text-left text-small font-semibold text-ink hover:bg-ink/[0.06]"
            >
              {t('goal.edit')}
            </Link>
          )}
          <button
            type="button"
            onClick={() => { setMenu(false); setStatus(paused ? 'active' : 'paused') }}
            className="press rounded-inner px-3 py-2.5 text-left text-small font-semibold text-ink hover:bg-ink/[0.06]"
          >
            {paused ? t('goal.resume') : t('goal.pause')}
          </button>
          <button
            type="button"
            onClick={() => { setMenu(false); setStatus('completed') }}
            className="press rounded-inner px-3 py-2.5 text-left text-small font-semibold text-ink hover:bg-ink/[0.06]"
          >
            {t('goal.mark_done')}
          </button>
          {deletable && (
            <button
              type="button"
              onClick={() => { setMenu(false); setAsking(true) }}
              /* Separated by a rule and set in the negative colour. The one
                 action here that cannot be undone should not be adjacent to
                 the three that can. */
              className="press mt-1 rounded-inner border-t border-hairline px-3 pb-2.5 pt-3 text-left text-small font-semibold text-negative hover:bg-negative/[0.09]"
            >
              {t('goal.delete')}
            </button>
          )}
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
        track={solo}
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
