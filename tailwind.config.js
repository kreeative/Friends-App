/**
 * Colours are declared as raw RGB channels in index.css so that Tailwind's
 * `<alpha-value>` still works (`bg-surface/60`) and so light and dark are the
 * same class names with different values — no `dark:` variant on every element.
 */
const c = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        raised: c('raised'),
        ink: c('ink'),
        muted: c('muted'),
        hairline: c('hairline'),

        // The chosen accent — pink, yellow or blue, one at a time, never
        // together. A fill only: never available as a text colour.
        accent: c('accent'),
        'accent-pressed': c('accent-pressed'),
        'on-accent': c('on-accent'),

        // Not themeable. "Checked in this week" is a fact about the world,
        // not a matter of taste, so it means the same thing in every theme.
        green: c('green'),
        'on-pop': c('on-pop'),
        negative: c('negative'),
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        // Playfair is the public voice — landing page, nav, footer headings.
        // Deliberately NOT the app's `display` face: inside the product,
        // Instrument Serif still carries the metrics, so nothing already
        // designed and approved shifts underneath it.
        title: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      fontSize: {
        // Scale, not weight, carries the hierarchy.
        hero: ['3.5rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
        metric: ['3rem', { lineHeight: '1', letterSpacing: '-0.025em' }],
        h1: ['2rem', { lineHeight: '1.12', letterSpacing: '-0.02em' }],
        h2: ['1.375rem', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        body: ['1rem', { lineHeight: '1.6' }],
        small: ['0.875rem', { lineHeight: '1.55' }],
        label: ['0.8125rem', { lineHeight: '1.3', letterSpacing: '0.08em' }],
      },
      spacing: {
        // 8px rhythm. Named so the intent survives a refactor.
        gutter: '1.5rem',
        section: '2.5rem',
      },
      maxWidth: { content: '40rem' },
      // Layered radii: outer containers are rounder than what nests inside
      // them. Matching radii read as flat.
      borderRadius: { card: '1.375rem', inner: '0.8125rem', field: '0.8125rem', pill: '999px' },
      boxShadow: {
        // Three levels, no exceptions. Values live in index.css so dark mode
        // can swap warm ink for true black — a light-tinted shadow on a dark
        // ground reads as a glow.
        raised: 'var(--e-raised)',
        float: 'var(--e-float)',
      },
      transitionTimingFunction: { settle: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: { rise: 'rise 220ms cubic-bezier(0.22,0.61,0.36,1) both' },
    },
  },
  plugins: [],
}
