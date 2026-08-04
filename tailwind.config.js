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
        ink: c('ink'),
        muted: c('muted'),
        hairline: c('hairline'),
        accent: c('accent'),
        'accent-ink': c('accent-ink'),
        positive: c('positive'),
        caution: c('caution'),
        negative: c('negative'),
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
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
      borderRadius: { card: '1.125rem', field: '0.75rem', pill: '999px' },
      boxShadow: {
        // One soft lift, used instead of a border — never alongside one.
        soft: '0 1px 2px rgb(28 26 23 / 0.04), 0 8px 24px -12px rgb(28 26 23 / 0.10)',
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
