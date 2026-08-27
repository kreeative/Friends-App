import { useT } from '../lib/i18n'

/**
 * The two things the budget can send you to that are not part of the budget.
 *
 * WHAT THIS IS, AND WHY IT CAME BACK.
 *
 * It was asked for as four cards: Formation, Projets & Objectifs, Analyse &
 * Comparaison, Journal Financier. It got built, and then it quietly went away
 * during the restructure that cut the budget to four pillars, taking the only
 * route to the course with it. The copy stayed in the dictionary in both
 * languages, pointing at nothing, which is how it was found again.
 *
 * It is two cards now, not four, and both of the missing ones are missing for
 * a reason rather than by attrition:
 *
 *   Projets & Objectifs  is Haut Budget, which is a section of the budget with
 *                        its own card in the grid above. Two doors to one room,
 *                        eighty pixels apart, is worse than one.
 *   Journal Financier    the journal came out of the app entirely. A card
 *                        advertising a feature nobody can reach is the exact
 *                        fault this component was found by.
 *
 * WHY IT SITS UNDER THE RANK CARD.
 *
 * The brief for the dashboard was hero, primary button, shortcuts, recent, and
 * nothing else. That is about the top of the screen: what you see before you
 * scroll has to be what you came for, which is what is left and how to log
 * something. These are the other kind of thing, the ones you go looking for,
 * so they sit at the bottom under a heading that says as much.
 */
export default function FeatureCards({ onOpen }) {
  const { t } = useT()

  const cards = [
    {
      id: 'formation',
      title: t('feat.formation_t'),
      body: t('feat.formation_d'),
      well: 'bg-cat-1-soft',
      icon: (
        /* An open book. Two leaves off a centre gutter, not one rectangle with
           a line down it, which at 24px reads as a closed laptop. */
        <>
          <path d="M11.15 6.1v13.2a.9.9 0 0 1-1.28.82A11.6 11.6 0 0 0 4.9 19.1H3.5a1.2 1.2 0 0 1-1.2-1.2V6.4a1.2 1.2 0 0 1 1.2-1.2h1.4c2 0 3.96.4 5.77 1.17a.4.4 0 0 1 .24.37Z" />
          <path d="M12.85 6.1v13.2a.9.9 0 0 0 1.28.82 11.6 11.6 0 0 1 4.97-1.02h1.4a1.2 1.2 0 0 0 1.2-1.2V6.4a1.2 1.2 0 0 0-1.2-1.2h-1.4c-2 0-3.96.4-5.77 1.17a.4.4 0 0 0-.24.37Z" />
        </>
      ),
    },
    {
      id: 'months',
      title: t('feat.benchmarks_t'),
      body: t('feat.benchmarks_d'),
      well: 'bg-cat-5-soft',
      icon: (
        /* Three bars of different heights, which is what the screen behind this
           card actually draws. An icon that shows the wrong chart is a small
           lie somebody notices one tap later. */
        <>
          <rect x="3.4" y="13.2" width="4.6" height="7.4" rx="1.4" />
          <rect x="9.7" y="8.4" width="4.6" height="12.2" rx="1.4" />
          <rect x="16" y="3.4" width="4.6" height="17.2" rx="1.4" />
        </>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4" data-hook="features">
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          data-feature={c.id}
          onClick={() => onOpen(c.id)}
          /* Title and body both, because the title alone ("Analyse &
             Comparaison") does not say what happens when you press it. */
          aria-label={`${c.title}. ${c.body}`}
          className="press glass-card flex flex-col items-start rounded-3xl border p-5 text-left"
        >
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${c.well}`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 text-mark">
              <g fill="currentColor" fillRule="evenodd" clipRule="evenodd">
                {c.icon}
              </g>
            </svg>
          </span>
          <span aria-hidden="true" className="mt-4 block text-body font-bold leading-tight text-ink">
            {c.title}
          </span>
          <span aria-hidden="true" className="mt-1.5 block text-small leading-snug text-muted">
            {c.body}
          </span>
        </button>
      ))}
    </div>
  )
}
