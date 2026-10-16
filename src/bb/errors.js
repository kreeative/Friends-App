/**
 * What to say for an /api/bb answer that did not work: one sentence, in the
 * student's language, that says what happened and what to do. Never the
 * raw error (CLAUDE.md: no message carries a credential, and a stack trace
 * is not a sentence).
 */
export function errorMessage(t, locale, data) {
  const error = data?.error
  if (error === 'limit') {
    const at = data?.resetsAt ? new Date(data.resetsAt) : null
    const time = at ? at.toLocaleTimeString(locale === 'fr' ? 'fr-CA' : 'en-CA', { hour: '2-digit', minute: '2-digit' }) : ''
    const when = t('bb.limit.tomorrow', { time })
    return `${t('bb.limit.reached', { when })}${data?.tier === 'free' ? ` ${t('bb.limit.upgrade')}` : ''}`
  }
  if (error === 'plan_chapters') return t('bb.course.plan_chapters')
  if (error === 'no_key' || error === 'key_format' || error === 'no_workspace' || error === 'setup') return t('bb.err.no_key')
  if (error === 'offline') return t('bb.err.offline')
  if (error === 'busy') return t('bb.proc.err.busy')
  if (error === 'no_anchor' || error === 'no_chapters' || error === 'not_marked') return t('bb.err.no_source')
  const file = ['download', 'too_big', 'not_pdf', 'pptx_images', 'heic', 'legacy', 'unknown_format', 'empty', 'refused', 'too_long']
  if (file.includes(error)) return t(`bb.proc.err.${error}`)
  if (error === 'model_failed' || error === 'model') return t('bb.proc.err.model')
  return t('bb.err.generic')
}

/** The material's own stored error, as a sentence. */
export function materialError(t, code) {
  if (!code) return t('bb.proc.err.other')
  const known = ['download', 'too_big', 'not_pdf', 'pptx_images', 'heic', 'legacy', 'unknown_format', 'empty', 'refused', 'too_long', 'model']
  return known.includes(code) ? t(`bb.proc.err.${code}`) : code === 'model_failed' ? t('bb.proc.err.model') : t('bb.proc.err.other')
}
