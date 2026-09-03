import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { usePageMeta } from '../lib/pageMeta'
import { DOC_ORDER, LEGAL } from '../legal/content'
import DeleteAccount from '../components/DeleteAccount'
import PushToggle from '../components/PushToggle'
import { Screen, Section, TopBar } from '../components/ui'

/**
 * Settings: everything about the account that is not about who you are.
 *
 * WHY THIS IS A SEPARATE SCREEN FROM /profile.
 *
 * /me was one page carrying six unrelated shelves: your consistency chart,
 * your photo and name, your currency, a link to your goals, the way to sign
 * out, and the button that deletes your account. Finding the language picker
 * meant scrolling past a chart, and the destructive button lived on the same
 * screen as a row that opens your reading list.
 *
 * The split is by question. /profile answers "who am I here" and is the thing
 * the avatar in the bar now opens. This page answers "what can I change, read
 * or end", which is a different visit.
 *
 * WHY THE LEGAL LINKS ARE HERE AND NOT ONLY IN THE PUBLIC FOOTER.
 *
 * The footer is on the marketing site. Somebody signed in, on a phone, never
 * sees it: the app has a tab bar, not a footer. Terms you agreed to and a
 * privacy policy you are subject to should be reachable from inside the thing
 * they govern, and this is the screen people already come to looking for them.
 */
export default function Account() {
  const { signOut, updateProfile } = useAuth()
  const { t, locale } = useT()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  /**
   * Show the budget walkthrough again.
   *
   * Moved here from the profile page with the rest of the settings: it is a
   * thing you can switch back on, not a fact about who you are. It clears the
   * flag and goes straight to the screen the walkthrough is about, because
   * landing back here having "done" something invisible is how somebody taps
   * it twice.
   */
  async function rewatchIntro() {
    setBusy(true)
    await updateProfile?.({ has_seen_budget_intro: false })
    setBusy(false)
    navigate('/money')
  }

  usePageMeta({ title: `${t('account.title')} · Rich & Friends` })

  const docs = LEGAL[locale] ?? LEGAL.en

  return (
    <Screen>
      <TopBar
        title={t('account.title')}
        back={() => navigate('/profile')}
        backLabel={t('common.back')}
      />

      <div className="pane-grid">
      {/**
       * Help first, because it is the reason most people open this screen and
       * because everything below it is either a document or a way out.
       */}
      <Section title={t('account.support')}>
        <div className="lg px-5">
          <div className="list">
            <Row to="/aide" label={t('account.faq')} hook="faq" />
            {/* mailto rather than a form: a form needs a backend, an inbox and
                a reply path, and this address already has all three. */}
            <Row
              href="mailto:contact@richandfriends.xyz"
              label={t('account.contact')}
              hint="contact@richandfriends.xyz"
              hook="contact"
            />
          </div>
        </div>
      </Section>

      <Section title={t('account.info')}>
        <div className="lg px-5">
          <div className="list">
            {/* Driven by DOC_ORDER so a fourth document appears here without
                anybody remembering this file exists. */}
            {DOC_ORDER.map((slug) => (
              <Row
                key={slug}
                to={`/legal/${slug}`}
                label={docs?.[slug]?.title ?? slug}
                hook={`legal-${slug}`}
              />
            ))}
            <Row to="/about" label={t('account.about')} hook="about" />
          </div>
        </div>
      </Section>

      {/**
       * Signing out on its own, above the danger zone and below everything
       * that is merely reading. It is not destructive, but it is the end of
       * the visit, so it does not belong in a list of documents.
       */}
      {/* Above the account rows, because it is the only thing on this screen
          that changes what the app DOES rather than what it shows. */}
      <Section title={t('push.section')}>
        <div className="lg px-5">
          <PushToggle />
        </div>
      </Section>

      <Section title={t('me.account')}>
        <div className="lg px-5">
          <div className="list">
            <button
              onClick={rewatchIntro}
              disabled={busy}
              data-hook="rewatch"
              className="press flex w-full items-center gap-4 py-5 text-left"
            >
              <span className="flex-1 text-body text-ink">{t('settings.rewatch_intro')}</span>
              <span aria-hidden="true" className="text-small text-muted">→</span>
            </button>
            <button
              onClick={signOut}
              data-hook="sign-out"
              className="press flex w-full items-center gap-4 py-5 text-left"
            >
              <span className="flex-1 text-body text-ink">{t('me.sign_out')}</span>
            </button>
          </div>
        </div>
      </Section>

      {/**
       * Closing the account, last and outside the card above it.
       *
       * Kept out of that list for the reason it was kept out of the old one: a
       * row that looks like "Sign out" and destroys everything is a row
       * somebody taps on the way to something else.
       */}
      <Section title={t('danger.zone')}>
        <DeleteAccount />
      </Section>
      </div>

    </Screen>
  )
}

/**
 * One row of a settings list, internal or external.
 *
 * Written once because the alternative is eight near-identical anchors that
 * drift: the first thing to go is the arrow, and then half the list stops
 * looking tappable.
 */
function Row({ to, href, label, hint, hook }) {
  const inner = (
    <>
      <span className="flex-1 text-body text-ink">{label}</span>
      {hint && <span className="hidden text-small text-muted sm:block">{hint}</span>}
      <span aria-hidden="true" className="text-small text-muted">
        →
      </span>
    </>
  )
  const cls = 'press flex items-center gap-4 py-5 no-underline'
  return href ? (
    <a href={href} data-hook={hook} className={cls}>
      {inner}
    </a>
  ) : (
    <Link to={to} data-hook={hook} className={cls}>
      {inner}
    </Link>
  )
}
