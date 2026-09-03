import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroup } from '../context/GroupContext'
import { cycleEnd, cyclePhase, untilLabel } from '../lib/time'
import { useT } from '../lib/i18n'
import { Screen, Section, TopBar } from '../components/ui'
import CelebrateStep from '../components/CelebrateStep'
import ProofGallery from '../components/ProofGallery'
import ActionBar, { CameraIcon, PartyIcon } from '../components/ActionBar'

/**
 * Proof, and telling somebody they did well.
 *
 * THIS SCREEN USED TO BE THE CHECK-IN AND IT IS NOT ANY MORE.
 *
 * It had three panes: answer your goals, look at the proof, celebrate
 * somebody. The first was a second copy of the goals list with one Submit at
 * the bottom, and it has moved onto the goal cards themselves, where the goal
 * already is. See components/GoalCheckin.jsx for why.
 *
 * What is left is the two jobs that were never about answering: the gallery of
 * what the group has proved, and the compliment. Both are things you come here
 * to do rather than things the day asks of you, which is why neither needed
 * the Submit that has gone with the goals pane.
 *
 * The route keeps its name. Renaming /g/:id/checkin would break every link
 * anybody has, and the path is not what the screen is called.
 */
export default function Checkin() {
  const { t } = useT()
  const { activeId, cycles, cadence, currentCycle, nextCycle, members } = useGroup()

  /**
   * The celebration draft, and a count of what has actually gone out.
   *
   * It used to ride along with Submit. That was defensible while this was one
   * scrolling form and became wrong the moment it got a pane of its own: with
   * Submit off screen, the only button in front of somebody who had just
   * written a compliment was "Skip". It also coupled two unrelated things, a
   * compliment is not a fact about your day and should not need a check-in to
   * be sent.
   *
   * So CelebrateStep posts it itself, and this page only keeps the draft
   * between pane switches and counts what went out, for the tile's badge.
   */
  const [party, setParty] = useState({ receiverId: null, message: '' })
  const [partySent, setPartySent] = useState(0)

  /* Bumped whenever something happened that the gallery below cannot know
     about. See ProofGallery's refreshToken: without it a check-in filed on
     this very screen left the strip showing the set it loaded on mount, which
     is the whole of "my photo did not appear". */
  const [proofTick, setProofTick] = useState(0)

  /* Which of the two jobs is on screen. Proof first: it is the one with
     something already in it on most days, and the celebration is an act rather
     than a thing to look at. */
  const [pane, setPane] = useState('proof')

  const phase = cyclePhase(currentCycle, cycles, cadence)
  const ends = cycleEnd(currentCycle, cycles, cadence)

  /**
   * No cycle at all, a group whose first window has not been materialised
   * yet. This used to `return null`, which paints nothing: a blank white
   * screen under the chrome, with no way to tell a loading state from a
   * broken one. Anything is better than nothing here.
   */
  if (!currentCycle) {
    return (
      <Screen>
        <TopBar title={t('checkin.title')} sub={t('board.getting_ready')} />
        <Section>
          <p className="card text-body text-muted">{t('checkin.no_cycle_body')}</p>
        </Section>
      </Screen>
    )
  }

  /**
   * A period you cannot write into.
   *
   * This screen was here for most of the week. Thirty hours open, a hundred
   * and thirty-eight shut, and the shut version was the one nearly everyone
   * saw. It is still here because a group whose next period has not started
   * yet is a real state, but it is now the rare one rather than the default,
   * and the copy says when rather than no.
   */
  if (phase !== 'open') {
    return (
      <Screen>
        <TopBar title={t('checkin.title')} sub={t('checkin.between')} />
        <Section>
          <div className="card">
            <p className="text-body text-muted">
              {/* nextCycle, not currentCycle: with nothing open, currentCycle
                  is the period that just ended, and its opens_at is in the
                  past, which is how you get "starts again 3d ago". */}
              {nextCycle
                ? t('checkin.between_body', { t: untilLabel(nextCycle.opens_at) })
: t('checkin.no_cycle_body')}
            </p>
          </div>
        </Section>

      </Screen>
    )
  }

  /**
   * The counters that used to sit here are gone with the goals pane.
   *
   * They told the tiles how many goals were answered and how many had proof
   * attached, which were facts about a form this screen no longer owns. A tile
   * that reported on state living on another page would be exactly the second
   * source of truth the goals pane was moved to remove.
   */
  const tiles = [
    {
      id: 'proof',
      icon: <CameraIcon />,
      label: t('checkin.tab_proof'),
    },
    {
      id: 'celebrate',
      icon: <PartyIcon />,
      label: t('checkin.tab_celebrate'),
    },
  ]

  return (
    <Screen>
      <TopBar
        title={t('checkin.title')}
        sub={t('board.reveals_in', { t: untilLabel(ends) })}
      />

      <ActionBar items={tiles} value={pane} onChange={setPane} />

      {/* One pane at a time. There is nothing outside them any more: the
          Submit that used to sit below both went with the goals pane. */}
      <div className="mt-6">
        {/**
         * Proof: a gallery, and nothing you can put anything into.
         *
         * This pane used to be both at once. It listed every goal again with a
         * photo picker beside it, and then showed the group's gallery
         * underneath, so one screen was "attach something" and "look at what
         * everyone did" with no line between them. People read it as the
         * second, which is the one it looks like, and never found the first.
         *
         * The pickers now live on the goal cards where the answers are. What
         * is left here is a feed: everything the group has proved, in every
         * kind, with your own entries editable in place.
         */}
        {pane === 'proof' && (
          <Section
            title={t('proof.title')}
            action={
              <Link
                to={`/g/${activeId}/proofs`}
                className="text-small text-ink underline-offset-4 hover:underline"
              >
                {t('proof.see_all')}
              </Link>
            }
          >
            <ProofGallery groupId={activeId} limit={9} refreshToken={proofTick} />
          </Section>
        )}

        {pane === 'celebrate' && (
          <CelebrateStep
            groupId={activeId}
            members={members}
            value={party}
            onChange={setParty}
            onSent={() => setPartySent((n) => n + 1)}
          />
        )}
      </div>

      {/**
       * No Submit and no "I am away" here any more.
       *
       * Both belonged to the check-in, and the check-in is on the goal cards
       * now. A button on this screen that sent answers filled in on a
       * different one would be the second source of truth this restructure
       * exists to remove: goals/away live where the goals are.
       */}
    </Screen>
  )
}
