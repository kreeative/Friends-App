import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { useTheme } from '../lib/theme'
import { GENDERS, canFinish, cleanName, setupPatch } from '../lib/setup'
import { DECLINED, PRONOUN_OPTIONS } from '../lib/pronouns'
import ThemePicker from '../components/ThemePicker'
import LanguagePicker from '../components/LanguagePicker'
import Wordmark from '../components/Wordmark'

/**
 * The five questions, once, on the way in.
 *
 * WHY THIS SCREEN EXISTS.
 *
 * Signing in with Google hands the app a name and a photo. Signing in with an
 * email hands it less: display_name is seeded with the part of the address
 * before the @, so an account starts life called "annklyy" and that is what a
 * new member's friends see on the board.
 *
 * The other four were never asked at all. The theme was pink for everybody,
 * the language was guessed from the browser, the pronouns defaulted to they,
 * and the cycle tracker sat in the calendar of every man who signed up. All
 * four were settings that already existed and that nobody ever found, because
 * a preference nobody is offered is a preference nobody has.
 *
 * ONE SCREEN, NOT FIVE STEPS.
 *
 * A wizard would be five taps to answer four questions that are one tap each.
 * Everything is visible at once, the name is the only thing that has to be
 * typed, and the theme and the language apply as they are pressed: pressing
 * "Mer" repaints this screen blue, which is the whole preview anybody needs.
 *
 * NOTHING HERE IS PERMANENT AND THE SCREEN SAYS SO UNDER EVERY ANSWER.
 *
 * That is the condition for asking at all. Every one of these five lives on
 * /profile afterwards, in the same words, and the line under each question
 * names it. A question you cannot revisit is not a setting, it is a label
 * somebody else put on you.
 */
export default function Setup() {
  const { profile, updateProfile } = useAuth()
  const { t, locale } = useT()
  const { theme } = useTheme()

  /* Seeded from whatever the provider gave us, which is a real name from
     Google and an email prefix otherwise. Either way it is the thing most
     worth correcting, so it starts in the box selected rather than blank. */
  const [name, setName] = useState(() => cleanName(profile?.display_name))
  const [pronouns, setPronouns] = useState(profile?.pronouns ?? '')
  const [custom, setCustom] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [gender, setGender] = useState(profile?.gender ?? null)

  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(null)

  const ready = canFinish(name)

  async function finish() {
    if (!ready || busy) return
    setBusy(true)
    setFailed(null)

    /* The theme and the language are read from where they already live rather
       than from state of their own. Both pickers apply immediately and write
       the profile themselves; this is the same value, written once more as
       part of one patch, so the row is right even if one of those background
       writes was refused. */
    const { error } = (await updateProfile?.(
      setupPatch({
        name,
        theme,
        locale,
        pronouns: customOpen ? custom.trim() : pronouns,
        gender,
      }),
    )) ?? {}

    if (error) {
      /**
       * The database's own words, verbatim and selectable.
       *
       * "It could not be saved" was the entire message on the notification
       * screen for a week, and it sent somebody to their phone's settings for
       * a problem that turned out to be a table that had never been created.
       * The sentence above is this app's reading; this is the thing itself, so
       * it can be read out to whoever can act on it.
       */
      setFailed(`${error.code ?? 'error'}: ${error.message ?? String(error)}`)
      setBusy(false)
      return
    }
    /* No navigation and no reload. updateProfile has already put the new row
       in context, so landing() re-reads it and the app moves on by itself. */
  }

  const pickPronouns = (value) => {
    if (value === 'custom') {
      setCustomOpen(true)
      return
    }
    setCustomOpen(false)
    setPronouns(value)
  }

  return (
    <main
      className="min-h-dvh overflow-y-auto bg-bg px-6 pb-10 pt-8"
      data-hook="setup"
    >
      <div className="mx-auto w-full max-w-content">
        <div className="flex justify-center">
          <Wordmark size={96} flat />
        </div>

        <h1 className="text-safe mt-6 text-h1 font-extrabold leading-tight text-ink">
          {t('setup.title')}
        </h1>
        <p className="text-safe mt-2 max-w-[38ch] text-body leading-relaxed text-muted">
          {t('setup.lede')}
        </p>

        {/* One card, five blocks, hairlines between them. The same panel the
            rest of the app reads on, so the ink is the 7:1 it is everywhere
            else rather than white on a poster colour. */}
        <div className="lg mt-7 divide-y divide-hairline px-6">
          {/* --- the name ------------------------------------------------- */}
          <section className="py-6">
            <label className="eyebrow block" htmlFor="setup-name">
              {t('setup.name')}
            </label>
            <input
              id="setup-name"
              data-hook="setup-name"
              className="field mt-3"
              value={name}
              maxLength={60}
              autoComplete="name"
              placeholder={t('setup.name_ph')}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="mt-2 text-small text-muted">{t('setup.name_hint')}</p>
          </section>

          {/* --- the theme ------------------------------------------------ */}
          <section className="py-6">
            <ThemePicker />
            <p className="mt-2 text-small text-muted">{t('setup.theme_hint')}</p>
          </section>

          {/* --- the language --------------------------------------------- */}
          <section className="py-6">
            <LanguagePicker />
            <p className="mt-2 text-small text-muted">{t('setup.language_hint')}</p>
          </section>

          {/* --- the pronouns --------------------------------------------- */}
          <section className="py-6">
            <label className="eyebrow block" htmlFor="setup-pronouns">
              {t('me.pronouns')}
            </label>
            <select
              id="setup-pronouns"
              data-hook="setup-pronouns"
              className="field mt-3"
              value={customOpen ? 'custom' : pronouns}
              onChange={(e) => pickPronouns(e.target.value)}
            >
              <option value="">{t('me.pronouns_unset')}</option>
              {PRONOUN_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'custom'
                    ? t('me.pronouns_custom')
                    : option === DECLINED
                      ? t('me.pronouns_declined')
                      : option}
                </option>
              ))}
            </select>
            {customOpen && (
              <input
                className="field mt-3"
                value={custom}
                maxLength={40}
                placeholder={t('me.pronouns_ph')}
                onChange={(e) => setCustom(e.target.value)}
              />
            )}
            <p className="mt-2 text-small text-muted">{t('me.pronouns_hint')}</p>
          </section>

          {/* --- the one question that changes what the app contains ------- */}
          <section className="py-6" data-hook="setup-gender">
            <fieldset>
              <legend className="eyebrow">{t('setup.gender')}</legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {GENDERS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    data-gender={key}
                    onClick={() => setGender(key)}
                    aria-pressed={gender === key}
                    className={gender === key ? 'chip-accent press' : 'chip-quiet press'}
                  >
                    {t(`setup.gender_${key}`)}
                  </button>
                ))}
              </div>
            </fieldset>

            {/**
             * What the answer does, said before it is given rather than
             * discovered afterwards.
             *
             * This is the only question on the screen that changes what the
             * app contains rather than how it looks, so it is the only one
             * that has to explain itself. Two sentences: what it switches, and
             * what it does not touch. The second matters as much as the first,
             * because the articles about the cycle are written for everybody
             * and a man reading them is the point rather than an edge case.
             */}
            <p className="mt-3 max-w-[42ch] text-small text-muted" data-hook="setup-cycle-note">
              {t('setup.gender_hint')}
            </p>
            <p className="mt-2 max-w-[42ch] text-small text-muted">
              {t('setup.gender_articles')}
            </p>
          </section>
        </div>

        <button
          type="button"
          data-hook="setup-go"
          onClick={finish}
          disabled={!ready || busy}
          className="btn-primary press mt-7 w-full disabled:opacity-50"
        >
          {busy ? t('setup.saving') : t('setup.go')}
        </button>

        {/* The name is the only answer that can block this button, so it is the
            only one that gets a line explaining why nothing happened. */}
        {!ready && (
          <p className="mt-3 text-center text-small text-muted" data-hook="setup-blocked">
            {t('setup.need_name')}
          </p>
        )}

        {failed && (
          <>
            <p className="mt-3 text-small text-negative" role="alert">
              {t('setup.failed')}
            </p>
            <p className="mt-1 select-all text-small text-muted" data-hook="setup-detail">
              {failed}
            </p>
          </>
        )}
      </div>
    </main>
  )
}
