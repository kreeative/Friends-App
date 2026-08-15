/**
 * Colours are declared as raw RGB channels in index.css so that Tailwind's
 * `<alpha-value>` still works (`bg-surface/60`) and so light and dark are the
 * same class names with different values, no `dark:` variant on every element.
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

        // The theme's accent, what you click. A fill only, never text.
        accent: c('accent'),
        'accent-pressed': c('accent-pressed'),
        'on-accent': c('on-accent'),

        // The theme's field, large blocks. Also a fill, also carries black.
        field: c('field'),
        'on-field': c('on-field'),
        // The same yellow at full strength, for the places a wash cannot be
        // seen: a 4px rule, a small mark, anything a couple of millimetres
        // wide. Never a large block, which is what `field` is for.
        'field-deep': c('field-deep'),

        // The highlight on the dark card, yellow in both themes, because it
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
        // and invite codes reference it, but it resolves to the same family. // there is no second voice on any screen now.
        sans: ['Poppins', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        /**
         * Scale carries the hierarchy; the tracking only keeps it honest.
         *
         * Poppins is a geometric face built on circles, so it is wide and its
         * default spacing is generous, at display sizes it reads as set in
         * neon-sign letters unless it is pulled in. Not as far as Montserrat
         * needed, because Poppins has a tall x-height that fills the line, but
         * further than a narrow face would want.
         *
         * Line height goes up rather than down for the same reason: the tall
         * x-height and short descenders make tightly-led Poppins look packed.
         *
         * BROUGHT DOWN A STEP, AND WHY.
         *
         * The top of this scale was built for impact and tuned against English
         * headings. It did not survive French, which is reliably a third
         * longer: "Rejoins des gens qui avancent." at the old 56px took three
         * lines of a 390px screen before anything else could be said. iOS sets
         * its own large title at 34px, so the old hero was 1.6x the platform's
         * loudest voice, on a phone.
         *
         * h2 mattered most and was the least obvious. At 22px it was the size
         * of a section heading AND the size of a goal card's title, so a list
         * of five goals rendered as five headings instead of five items. At
         * 18px a card title is a card title again.
         *
         * Only the display end moved. body, small and label are unchanged: 16px
         * is a floor rather than a preference, because iOS Safari zooms the
         * whole page when a focused input is smaller than that, which would
         * break every form in the app.
         *
         * Tracking follows the size rather than staying put. Negative tracking
         * is a correction for optical looseness at display sizes, so it has to
         * shrink as the sizes do or 40px ends up set as tightly as 56px was.
         * Leading goes the other way, up, for the same reason.
         */
        hero: ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.026em' }],
        metric: ['2.25rem', { lineHeight: '1.08', letterSpacing: '-0.024em' }],
        h1: ['1.625rem', { lineHeight: '1.26', letterSpacing: '-0.02em' }],
        h2: ['1.125rem', { lineHeight: '1.42', letterSpacing: '-0.011em' }],
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
        // can swap warm ink for true black, a light-tinted shadow on a dark
        // ground reads as a glow.
        raised: 'var(--e-raised)',
        float: 'var(--e-float)',
      },
      transitionTimingFunction: { settle: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
      keyframes: {
        // `drift` lived here for the aurora blobs. The ground is flat now and
        // the stickers are the only thing moving on it.
        /* translate3d rather than translateY: the z keeps the element on a
           composited layer for the whole cycle instead of letting the
           compositor drop it back to the main thread between frames. */
        bob: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) rotate(var(--tilt, 0deg))' },
          '50%': { transform: 'translate3d(0, -10px, 0) rotate(var(--tilt, 0deg))' },
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
