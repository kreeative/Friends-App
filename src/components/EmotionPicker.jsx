import { EMOTION_GROUPS, emojiOf, inGroup, toggleEmotion } from '../lib/emotions'
import { useT } from '../lib/i18n'

/**
 * How the money felt, as chips.
 *
 * WHY MULTI-SELECT AND NOT A SINGLE CHOICE.
 *
 * Because one purchase is genuinely two things at once, and being made to pick
 * between them produces an arbitrary answer. A takeaway is fatigue and
 * comfort. A gift is generosity and, often, an impulse. See emotions.js.
 *
 * WHY THE BANDS HAVE HEADINGS.
 *
 * Thirteen chips in one wrap is a wall, and the eye has no way in. Three short
 * bands give it somewhere to land, and the order is deliberate: the everyday
 * ones first, because they are the honest answer most of the time, and the
 * hardest ones last. A picker that opens on 'compulsion' is one that feels
 * like an accusation before anything has been bought.
 *
 * The chips are buttons with aria-pressed rather than checkboxes with labels.
 * Both are correct to a screen reader; the button is what a toggle chip is,
 * and it does not require a hidden input to be kept in step with the styling.
 */
export default function EmotionPicker({ value = [], onChange }) {
  const { t } = useT()
  const chosen = Array.isArray(value) ? value : []

  return (
    <div className="space-y-4">
      {EMOTION_GROUPS.map((group) => (
        <div key={group}>
          <p className="eyebrow">{t(`emo.group_${group}`)}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {inGroup(group).map(({ id, emoji }) => {
              const on = chosen.includes(id)
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange?.(toggleEmotion(chosen, id))}
                  /**
                   * The micro-interaction is a scale on press plus a colour
                   * settle, nothing more. These are thirteen small controls
                   * somebody taps two of in under a second, and an animation
                   * with a duration you can perceive would be thirteen things
                   * moving on a sheet whose main job is a number.
                   *
                   * The ring rather than a border: a border changes the box
                   * size, so a chip would jump by two pixels as it turned on
                   * and reflow the ones after it on the same line.
                   */
                  className={`press inline-flex items-center gap-1.5 rounded-pill px-3 py-2 text-small font-semibold ring-1 ring-inset transition-[background-color,color,box-shadow] duration-200 ease-settle active:scale-[0.96] ${
                    on
                      ? 'bg-accent/[0.16] text-ink ring-accent/45'
                      : 'bg-ink/[0.04] text-muted ring-transparent hover:bg-ink/[0.08] hover:text-ink'
                  }`}
                >
                  <span aria-hidden="true" className="text-body leading-none">
                    {emoji}
                  </span>
                  {t(`emo.${id}`)}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * The read-only version, for a list row.
 *
 * Emoji only, no words. A transaction line is one line and already carries a
 * note, a date, a category and an amount; spelling out "Impulsif · Stress"
 * next to those is what turns a scannable list into a paragraph. The words are
 * on the title attribute and in the accessible label, so nothing is lost to
 * anybody who needs them, and the amount stays the thing you see first.
 */
export function EmotionBadges({ value = [], className = '' }) {
  const { t } = useT()
  const list = Array.isArray(value) ? value : []
  if (list.length === 0) return null

  const words = list.map((id) => t(`emo.${id}`)).join(', ')

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 ${className}`} title={words}>
      <span className="sr-only">{words}</span>
      {list.map((id) => (
        <span key={id} aria-hidden="true" className="text-small leading-none">
          {emojiOf(id)}
        </span>
      ))}
    </span>
  )
}
