import { useState } from 'react'
import { useT } from '../lib/i18n'
import { Sheet } from './ui'

/**
 * How somebody else gets in.
 *
 * There has always been an invite code and it has always been a code: six
 * characters, read out or retyped by hand, on a screen at the bottom of a
 * settings page. That works and it is more friction than it needs to be,
 * because the person you are inviting is usually one tap away in a messaging
 * app and what they want is something to press.
 *
 * So the link is the headline and the code is underneath it. The link carries
 * the code as a query parameter, /start?join=CODE, which the join screen reads
 * and fills in, so a friend who taps it lands on a form already holding the
 * answer. The code stays for the case the link cannot travel: read out over a
 * phone call, or written on the back of something.
 *
 * ONE BUTTON THAT DOES THE RIGHT THING PER DEVICE.
 *
 * navigator.share on a phone raises the OS sheet, which is every messaging app
 * the person already has, in the order they use them. Nothing this app could
 * draw would beat it. On a desktop, where there is usually no share sheet, the
 * same button copies instead and says so, rather than being a button that does
 * nothing on half the machines it appears on.
 */
export default function InviteSheet({ group, open, onClose }) {
  const { t } = useT()
  const [copied, setCopied] = useState(null)

  if (!group) return null

  const link = `${window.location.origin}/start?join=${encodeURIComponent(group.invite_code)}`
  const text = `${group.name} · Rich & Friends\n${link}`

  async function copy(what, value) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(what)
      /* Cleared rather than left standing, so the next copy of the other thing
         does not read as a stale confirmation of this one. */
      setTimeout(() => setCopied(null), 2400)
    } catch {
      /* No clipboard permission. The value is on screen and selectable, which
         is the fallback that has always worked. */
    }
  }

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: group.name, text, url: link }).catch(() => {})
      return
    }
    copy('link', link)
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('settings.invite_title')}>
      <p className="text-body text-muted">{t('settings.invite_body')}</p>

      <button onClick={share} className="btn-primary press mt-7">
        {copied === 'link' && !navigator.share
          ? t('settings.copied')
          : navigator.share
            ? t('settings.share_link')
            : t('settings.copy_link')}
      </button>

      <div className="mt-4 rounded-inner bg-ink/[0.04] p-4">
        <p className="break-all text-small text-muted">{link}</p>
      </div>

      {/* The code, for when a link cannot travel: read out on a call, or
          written down. Tabular figures, because this one is transcribed by a
          human and a wandering baseline costs accuracy. */}
      <div className="mt-8 border-t border-hairline pt-7">
        <span className="eyebrow">{t('start.invite_code')}</span>
        <p className="mt-3 font-display text-metric tracking-[0.12em] text-ink [font-variant-numeric:tabular-nums]">
          {group.invite_code}
        </p>
        <button
          onClick={() => copy('code', group.invite_code)}
          className="goal-action press mt-5"
        >
          {copied === 'code' ? t('settings.copied') : t('settings.copy_code')}
        </button>
      </div>

      <p className="mt-7 text-small text-muted">{t('settings.invite_note')}</p>
    </Sheet>
  )
}
