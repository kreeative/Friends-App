/**
 * Le geste sous le doigt (src/lib/motion.js), sans navigateur: un faux
 * document, de faux elements, et ce que l'ecouteur leur demande d'animer.
 */
import {
  DOWN_MS,
  PRESSABLE,
  SETTLE,
  UP_MS,
  downFrames,
  installPress,
  pressScale,
  pressTarget,
  upFrames,
} from './motion.js'

let faux = 0
let total = 0
const ok = (name, cond, why = '') => {
  total += 1
  if (!cond) faux += 1
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${!cond && why ? `  (${why})` : ''}`)
}
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps

/* --- un faux DOM, juste assez pour closest/querySelector/animate ---------- */
function el({ tag = 'BUTTON', matches = [], parent = null, disabled = false, attrs = {}, display = 'block', inner = [], box = { width: 48, height: 48 } } = {}) {
  const node = {
    tagName: tag,
    disabled,
    parent,
    attrs,
    display,
    inner,
    animations: [],
    getAttribute: (k) => attrs[k] ?? null,
    hasAttribute: (k) => k in attrs,
    getBoundingClientRect: () => box,
    animate(frames, opts) {
      const anim = { frames, opts, cancelled: false, cancel() { this.cancelled = true } }
      node.animations.push(anim)
      return anim
    },
    /* `matches` est la liste des selecteurs simples de PRESSABLE que ce noeud
       satisfait; closest remonte jusqu'au premier qui en satisfait un. */
    closest(sel) {
      const parts = sel.split(',').map((s) => s.trim())
      let n = node
      while (n) {
        if (n.matchList.some((m) => parts.includes(m))) return n
        n = n.parent
      }
      return null
    },
    querySelector(sel) {
      const parts = sel.split(',').map((s) => s.trim())
      return node.inner.find((c) => c.matchList.some((m) => parts.includes(m))) ?? null
    },
  }
  node.matchList = matches
  return node
}
const button = (o = {}) => el({ tag: 'BUTTON', matches: ['button'], ...o })
const win = (reduce = false) => ({
  listeners: {},
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn) },
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn) },
  matchMedia: () => ({ matches: reduce }),
  getComputedStyle: (n) => ({ display: n.display }),
  fire(type, e = {}) { for (const fn of this.listeners[type] ?? []) fn(e) },
})
const doc = () => {
  const d = win()
  delete d.matchMedia
  return d
}

console.log('\npressScale')
ok('a 48px button loses 6 %', close(pressScale(48, 48), 0.94))
ok('a 120px pill is still at the floor', close(pressScale(120, 40), 0.94))
ok('a 300px card loses 8px of 300', close(pressScale(300, 120), 1 - 8 / 300))
ok('a 390px card loses 8px of 390, about 2 %', close(pressScale(390, 200), 1 - 8 / 390))
ok('from 533px up the loss is capped at 1.5 %', close(pressScale(600, 200), 0.985) && close(pressScale(2000, 2000), 0.985))
ok('no size: a middling press', close(pressScale(undefined, null), 0.96))
ok('the longest side decides', close(pressScale(40, 300), 1 - 8 / 300))

console.log('\nframes')
ok('down goes from 1 to the scale', JSON.stringify(downFrames(0.94)) === '[{"scale":1},{"scale":0.94}]')
const up = upFrames(0.94)
ok('up starts at the scale, overshoots, lands on 1', up.length === 3 && up[0].scale === 0.94 && up[1].scale > 1 && up[1].offset === 0.45 && up[2].scale === 1)
ok('the overshoot is 55 % of the way down, so a deeper press springs higher', close(up[1].scale, 1 + 0.06 * 0.55) && upFrames(0.98)[1].scale < up[1].scale)
ok('fast in, slow out: 90 then 380 on the house curve', DOWN_MS === 90 && UP_MS === 380 && SETTLE === 'cubic-bezier(0.32, 0.72, 0, 1)')

console.log('\npressTarget')
const w = win()
ok('a button is itself', pressTarget(button(), w)?.tagName === 'BUTTON')
const inner = el({ tag: 'SPAN', matches: [], parent: button() })
ok('a span inside a button resolves to the button', pressTarget(inner, w)?.tagName === 'BUTTON')
ok('a disabled button is nothing', pressTarget(button({ disabled: true }), w) === null)
ok('aria-disabled too', pressTarget(button({ attrs: { 'aria-disabled': 'true' } }), w) === null)
ok('data-still opts out', pressTarget(button({ attrs: { 'data-still': '' } }), w) === null)
ok('plain text is nothing', pressTarget(el({ tag: 'P', matches: [] }), w) === null)
ok('null is nothing', pressTarget(null, w) === null && pressTarget({}, w) === null)
const inlineLink = el({ tag: 'A', matches: ['a[href]'], display: 'inline' })
const blockLink = el({ tag: 'A', matches: ['a[href]'], display: 'flex' })
ok('a link in a sentence is a word, not a button', pressTarget(inlineLink, w) === null)
ok('a block link (a card, a tab) is a button', pressTarget(blockLink, w) === blockLink)
ok('without a window to measure display, a link stays still', pressTarget(blockLink, null) === null)
const box = el({ tag: 'INPUT', matches: ['input[type="checkbox"]'] })
const label = el({ tag: 'LABEL', matches: ['label'], inner: [box] })
box.parent = label
ok('a checkbox in its label presses the whole label', pressTarget(box, w) === label)
ok('the label itself, tapped on its text, too', pressTarget(label, w) === label)
const loneBox = el({ tag: 'INPUT', matches: ['input[type="checkbox"]'] })
ok('a checkbox with no label presses itself', pressTarget(loneBox, w) === loneBox)
const textLabel = el({ tag: 'LABEL', matches: ['label'], inner: [] })
ok('a label with no box inside is text', pressTarget(textLabel, w) === null)
const sw = el({ tag: 'BUTTON', matches: ['button', '[role="switch"]'] })
ok('a switch is a button', pressTarget(sw, w) === sw)
ok('PRESSABLE names buttons, roles, summary, links, labels, selects, boxes and radios',
   ['button', '[role="button"]', '[role="tab"]', '[role="switch"]', 'summary', 'a[href]', 'label', 'select', 'input[type="checkbox"]', 'input[type="radio"]']
     .every((s) => PRESSABLE.split(',').map((x) => x.trim()).includes(s)))

console.log('\ninstallPress')
{
  const d = doc()
  const wn = win()
  const off = installPress(d, wn)
  ok('it listens on the document for the press and on the window for the release',
     Object.keys(d.listeners).sort().join() === 'keydown,keyup,pointerdown' && Object.keys(wn.listeners).sort().join() === 'blur,pointercancel,pointerup')
  const b = button()
  d.fire('pointerdown', { target: b, button: 0 })
  ok('pointerdown animates the button down, held', b.animations.length === 1 && b.animations[0].frames[1].scale === 0.94 && b.animations[0].opts.fill === 'forwards' && b.animations[0].opts.duration === 90)
  wn.fire('pointerup', {})
  ok('pointerup cancels the hold and springs back', b.animations.length === 2 && b.animations[0].cancelled && b.animations[1].frames.length === 3 && b.animations[1].opts.duration === 380 && b.animations[1].opts.fill === undefined)
  wn.fire('pointerup', {})
  ok('a second release does nothing', b.animations.length === 2)
  d.fire('pointerdown', { target: b, button: 2 })
  ok('a right click does not press', b.animations.length === 2)
  const b2 = button({ disabled: true })
  d.fire('pointerdown', { target: b2, button: 0 })
  ok('a disabled button does not press', b2.animations.length === 0)
  d.fire('pointerdown', { target: b, button: 0 })
  wn.fire('pointercancel', {})
  ok('a scroll (pointercancel) releases', b.animations.length === 4 && b.animations[3].frames.length === 3)
  d.fire('pointerdown', { target: b, button: 0 })
  const b3 = button()
  d.fire('pointerdown', { target: b3, button: 0 })
  ok('pressing another releases the first', b.animations.length === 6 && b3.animations.length === 1)
  wn.fire('blur', {})
  ok('losing the window releases', b3.animations.length === 2)
  d.fire('keydown', { target: b, key: ' ' })
  ok('space on a focused button presses it', b.animations.length === 7)
  d.fire('keydown', { target: b, key: ' ', repeat: true })
  ok('a held key does not re-press', b.animations.length === 7)
  d.fire('keyup', {})
  ok('keyup releases', b.animations.length === 8)
  d.fire('keydown', { target: b, key: 'a' })
  ok('other keys do nothing', b.animations.length === 8)
  const p = el({ tag: 'P', matches: [] })
  d.fire('pointerdown', { target: p, button: 0 })
  ok('text does not press', p.animations.length === 0)
  off()
  ok('uninstall removes every listener', Object.values(d.listeners).every((l) => l.length === 0) && Object.values(wn.listeners).every((l) => l.length === 0))
}
{
  const d = doc()
  const wn = win(true)
  installPress(d, wn)
  const b = button()
  d.fire('pointerdown', { target: b, button: 0 })
  ok('prefers-reduced-motion: nothing moves', b.animations.length === 0)
}
{
  const d = doc()
  const wn = win()
  installPress(d, wn)
  const b = button()
  delete b.animate
  d.fire('pointerdown', { target: b, button: 0 })
  wn.fire('pointerup', {})
  ok('an element without Web Animations is left alone, no throw', true)
}
ok('no document: a no-op that still returns an uninstaller', typeof installPress(null, null) === 'function')

console.log(`\n${total - faux} passed, ${faux} failed`)
process.exit(faux ? 1 : 0)
