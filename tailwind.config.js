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

        // The theme's accent — what you click. A fill only, never text.
        accent: c('accent'),
        'accent-pressed': c('accent-pressed'),
        'on-accent': c('on-accent'),

        // The theme's field — large blocks. Also a fill, also carries black.
        field: c('field'),
        'on-field': c('on-field'),

        // The highlight on the dark card — yellow in both themes, because it
        // is the one colour both palettes already contain.
        spark: c('spark'),

        // Not themeable. "Checked in this week" is a fact about the world,
        // not a matter of taste, so it means the same thing in every theme.
        green: c('green'),
        'on-pop': c('on-pop'),
        negative: c('negative'),
      },
      fontFamily: {
        // One typeface. `display` is kept as a name because the app's metrics
        // and invite codes reference it, but it resolves to the same family —
        // there is no second voice on any screen now.
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        /**
         * Scale carries the hierarchy; the tracking only keeps it honest.
         *
         * Poppins is a geometric face built on circles, so it is wide and its
         * default spacing is generous — at display sizes it reads as set in
         * neon-sign letters unless it is pulled in. Not as far as Montserrat
         * needed, because Poppins has a tall x-height that fills the line, but
         * further than a narrow face would want.
         *
         * Line height goes up rather than down for the same reason: the tall
         * x-height and short descenders make tightly-led Poppins look packed.
         */
        hero: ['3.5rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        metric: ['3rem', { lineHeight: '1.04', letterSpacing: '-0.028em' }],
        h1: ['2rem', { lineHeight: '1.2', letterSpacing: '-0.024em' }],
        h2: ['1.375rem', { lineHeight: '1.34', letterSpacing: '-0.016em' }],
        body: ['1rem', { lineHeight: '1.65', letterSpacing: '-0.006em' }],
        small: ['0.875rem', { lineHeight: '1.58', letterSpacing: '-0.002em' }],
        // Uppercase stays open rather than going negative: caps have no
        // descenders to separate them, and tightening closes them into one
        // shape. Geometric caps are the widest in the set, so they need most.
        label: ['0.8125rem', { lineHeight: '1.35', letterSpacing: '0.02em' }],
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
        // `drift` lived here for the aurora blobs. The ground is flat now and
        // the stickers are the only thing moving on it.
        bob: {
          '0%, 100%': { transform: 'translateY(0) rotate(var(--tilt, 0deg))' },
          '50%': { transform: 'translateY(-10px) rotate(var(--tilt, 0deg))' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        rise: 'rise 220ms cubic-bezier(0.22,0.61,0.36,1) both',
        bob: 'bob 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
