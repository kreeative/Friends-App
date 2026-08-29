import { useT } from '../lib/i18n'
import { useAuth } from '../context/AuthContext'

/**
 * Which language the app speaks.
 *
 * Lifted out of the group settings page so the personal one can have it too.
 * It was eleven lines of inline JSX there, which is not much to copy, and
 * copying it is exactly how two screens come to disagree about which locales
 * exist the next time one is added.
 *
 * The names are written in their own language rather than translated, because
 * somebody who has landed in the wrong one needs to recognise the way out. A
 * French speaker looking at an English build finds "Français", where a
 * translated list would offer them "French" and expect them to already read the
 * language they are trying to leave.
 */
const LANGUAGES = [
  ['fr', 'Français'],
  ['en', 'English'],
]

export default function LanguagePicker({ className = '' }) {
  const { t, locale, setLocale } = useT()
  const { updateProfile } = useAuth()

  /**
   * The device decides what you see; the profile decides what you are sent.
   *
   * setLocale is what changes the screen, instantly and without a round trip,
   * and it stays the thing that does that. The profile write is only for
   * supabase/functions/notify, which sends the reminder emails on a schedule
   * with no browser involved and therefore cannot read localStorage.
   *
   * Not awaited, and its failure is swallowed on purpose. Changing the
   * language must not wait on the network or fail visibly because the network
   * did: the screen has already changed, and the worst case is one email in
   * the previous language until the next time this is touched.
   */
  const pick = (code) => {
    setLocale(code)
    updateProfile?.({ locale: code })?.catch?.(() => {})
  }

  return (
    <div className={className}>
      <fieldset>
        <legend className="eyebrow">{t('settings.language')}</legend>
        <div className="mt-4 flex flex-wrap gap-3">
          {LANGUAGES.map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => pick(code)}
              /* Pressed rather than checked: these are buttons that act
                 immediately, not a form somebody submits afterwards. */
              aria-pressed={locale === code}
              className={locale === code ? 'chip-accent press' : 'chip-quiet press'}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
