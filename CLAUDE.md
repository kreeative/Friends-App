# Working agreements

Standing instructions for this repo. These came out of real corrections during
sessions, so each one is here because getting it wrong cost something.

## SQL is always plain text in the chat, never a file

When a migration or a data change needs running, paste **the complete SQL as
plain text in the reply**. Not a file attachment, not a path to a file in the
repo, not "run `scripts/x.mjs` and paste the output". The whole thing, ready
to copy straight into the Supabase SQL editor.

This holds even when the SQL is long, and even when the same text also exists
as a file in the repo. Attaching a file instead is a wasted round trip.

Keep generated SQL **ASCII** where it is going to travel through a clipboard.
French comments are valid Postgres and were tested against a real Postgres 16
to confirm it, but mangled UTF-8 in transit produces `invalid byte sequence`
and the error points at the wrong thing.

## Verification

- `npm test` must stay green. No exceptions.
- Verify UI in headless Chromium before committing. Screenshot it and look at
  the screenshot; do not reason about what the CSS should produce.
- Prefer probes that **measure painted pixels** over probes that read
  computed styles. Reading `backgroundColor` and dropping its alpha has
  already produced a probe that passed a real contrast failure.

### Contrast

- Normal text 4.5:1, large text 3:1 (>=24px, or >=18.66px at weight 700),
  graphics 3:1 (WCAG 1.4.11).
- Colour must never be the only signal (1.4.1).
- Composite translucent and opacity-reduced colours down to the opaque layer
  before measuring.
- On a gradient there is no single background colour. Measure the **worst
  case**, not the commonest pixel.

## Writing

- **No em dashes anywhere.** Not in prose, not in commit messages, not in
  code comments, not in PR bodies.
- Commit messages and PR bodies explain *why*, and say plainly what was
  measured and what failed.

## Git

Develop on the designated feature branch, commit, push, open a PR, merge to
`main`, then resync the branch onto `main`.

## Test selectors

Key Playwright selectors to `data-*` hooks, never to class names. Selectors
keyed to classes have broken on every single restyle in this repo's history
(`ul.lg` to a slate card, `.lg` to a tinted panel, `rounded-3xl` to
`rounded-[1.75rem]`) and told us nothing about the app when they did.

Existing hooks: `data-actionbar`, `data-ledger`, `data-card="pool"`,
`data-envelope`, `data-cat`, `data-hook`.

## Books

Manuscripts are markdown under `content/books/<slug>/`. See
`content/books/README.md` for house style. After editing:
`node scripts/build-chapters.mjs`, then paste the regenerated SQL per the rule
at the top of this file.

## Gotchas that have cost time

- Playwright route ordering: **the last registered route wins**, so
  `install()` from the fixtures must be registered FIRST.
- `getByRole` name matching is substring by default. "Mer" matched
  "SuppriMER mon compte". Use `exact: true`.
- `getByText` with a string is case-insensitive substring matching.
- `innerText` returns CSS-uppercased text; `textContent` returns what is
  written.
- `hyphens: auto` needs a per-language dictionary and Chromium ships none for
  French. Use U+00AD soft hyphens. `overflow-wrap: break-word` breaks at any
  character and was cutting words mid-syllable.
- A single word has nowhere to wrap. It does not truncate, it spills.
- A round linecap on a zero-length dash still paints a dot.
- Default parameters only fire for `undefined`, not for `null`.
- Tailwind scans source text, so `text-cat-${n}` produces no class at build
  time. Write whole class strings.
- The `--c-` prefix on colour tokens is load-bearing: `tailwind.config.js`
  builds `var(--c-<name>)`.
- RLS refuses a DELETE or UPDATE **silently**: 0 rows, no error. Ask for
  `{ count: 'exact' }` and check it. In a Playwright stub the count comes back
  `null` unless the fulfilled response also carries
  `access-control-expose-headers: Content-Range`, because `content-range` is
  not CORS-safelisted. Real Supabase sends it; a stub that does not makes the
  rollback look broken when it is the instrument that is wrong.
- Never chain two `npx vite build` calls in one command. They race and both
  report a bogus rolldown error.
- `backdrop-filter` blurs what is behind an element. Over a flat ground it
  returns that same flat colour, so glass needs a ground to be worth anything.
