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
- **iPad and laptop are first-class, and nobody should have to ask.** After
  any UI change:
  `VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=stub-anon npm run build && npm run sweep`.
  The build must talk to the stub: a plain `npm run build` is "not
  configured" and serves only the public site; the sweep then measured that
  page under every route and reported 0 failed (seen 15 October). It now
  stops when it does not find `data-hook="app-shell"`. It renders every signed-in
  route at 390, 820 (iPad portrait), 1180 (iPad landscape) and 1440, and
  fails on a sideways scroll, a wrapping paragraph wider than 800px, an input
  wider than 40rem, or cards stacked full width above md. Look at the
  screenshots it writes to `.sweep/`. Limits go on blocks, never on the page:
  `.measure`, `.measure-form`, `.reading`, `.card-grid`, `.pane-grid`,
  `.page-grid` in `index.css`. A new page is built with them from the start,
  not fixed for the iPad afterwards.

### Contrast

- Normal text 4.5:1, large text 3:1 (>=24px, or >=18.66px at weight 700),
  graphics 3:1 (WCAG 1.4.11).
- Colour must never be the only signal (1.4.1).
- Composite translucent and opacity-reduced colours down to the opaque layer
  before measuring.
- On a gradient there is no single background colour. Measure the **worst
  case**, not the commonest pixel.
- **No black text on a dark or very saturated colour, even when the ratio
  passes.** "Le noir sur des couleurs sombres ou trop saturées ça donne mal
  aux yeux." Black on the brand pink `#FF007A` measures 4.98:1 and black on
  sky `#38BDF8` 8.81:1, and both were still called "très limite": the pair
  vibrates. Black stays on white, pastels and yellow.
- **The blue is the logo turquoise, `#009DB9`, and no other.** "le bleu que
  tu as pris et le bleu qui est sur le logo, c'est pas le même bleu." Two
  blues were tried and refused: `#38BDF8` and `#0B6FAD`. The pink is the
  logo pink `#FF007A` for the same reason; the deep `#D6006B` only ever
  existed to carry small white text. Words on the brand pink or the
  turquoise are white, and since white measures only 3.80:1 on `#FF007A`
  and 3.22:1 on `#009DB9`, they must be large text (bold and at least
  18.66px, the 3:1 bar; 19px in practice). Smaller text goes on white or a
  pastel, in ink.

## Design

- **The study app is called Hakkilo and lives at /hakkilo.** "Le nom de
  l'app va pas etre Nerd mais Hakkilo": hakkilo (or haqqille) is
  intelligence, the mind, wisdom, in Fulfulde (Pulaar), and the public
  footer says so. It was Beauty & Brain at /bb, then Nerd at /nerd, until
  17 October; its code, tables, API and i18n keys keep the bb name, but
  nothing a student reads says Beauty & Brain or Nerd. /bb, /nerd and
  everything under them answer 308 to /hakkilo (vercel.json), and
  `OldStudyPath` in `App.jsx` catches in-app links, so old TikTok links and
  installed apps still land. Never link /bb or /nerd. The manifest keeps
  `"id": "/bb/app"` so installed apps keep their identity. Slogan: "Révise
  comme une nerd." / "Study like a nerd."
- **A course has its exams, not one date.** "Ya le final exam mais ya
  aussi le mid term" (Kee). `bb_courses.exams` (migration 82,
  `src/lib/bb/exams.js`) holds the midterm (or two) and the final, each
  with its date, what it covers (the whole course, the chapters picked, or
  for a final only what came after the midterm) and its own length. The
  new-course flow asks both; the course page asks which chapters the
  midterm covers once there are chapters, and asks a course from before
  whether its one date was the midterm or the final. Whatever counted down
  to one date works towards the NEXT exam: the chip names it ("Intra dans 9
  jours"), the plan puts mock exams and an eve before each, sessions take
  its chapters first, the mock exam follows its chapters and length, the
  coach is told both. `exam_at` stays, holding the next exam, for an app
  opened before and for the database until 82 has run; `src/bb/data.js`
  reads and writes without `exams` while the column is missing.
- **The exam chip is the way to change an exam.** "Au lieu de mettre ce
  grand phrase 'changer la date', quand on clique sur 'exam in 46' on
  puisse changer et enregistrer" (Kee). On the course page the chip is a
  button with a pencil and opens that exam's form in its row; on Today and
  on the plan the same chip is a link to the course page with the form
  already open (`?examen=<id>`, read once by `src/bb/course/Exams.jsx`).
  No "change the date" line beside a chip, ever again.
- **Save waits for a change, everywhere.** "Si rien a changer le bouton
  enregistrer ou save rester griser partout pour l'app" (Kee). A form that
  edits something already saved compares itself with it (`changed()` in
  `src/lib/dirty.js`, read as a person reads a form: "6" is the 6 saved,
  spaces and an empty field are nothing, a set ticked in another order is
  the same set; amounts compare in cents through the app's own `toCents`,
  so "12,5" over a saved 12.50 is no change). Its Save is grey until they
  differ, and grey again once the change is undone or saved. Something new
  (an exam being added, a first answer) is itself the change. A form whose
  Save can be grey needs a way out that is not Save: Cancel or close.
  `src/lib/dirty.test.mjs` finds every such Save in the source by its
  data-hook and fails when one loses its gate; a new edit form joins that
  list.
- **A button that cannot be pressed is solid grey, everywhere**: `#52525B`
  on `#E4E4E7` (6.09:1), never the live colour faded (faded, the violet
  "Valider" measured 1.29:1). One rule at the end of `index.css` covers
  `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-outline` and the
  `.goal-action-*` pills; a button outside those families says it with
  `disabled:bg-[#E4E4E7] disabled:text-[#52525B]`.
- **Nothing shows in the gaps around Hakkilo's floating bars.** "Quelques
  problemes d'agencement" (Kee, the plan on an iPhone): the days ran under
  the clock above the top bar, and between the tab bar and Safari's
  buttons. The page draws under both (`viewport-fit=cover`), so the bars
  sit on the page's own ground out to and past the screen's edge
  (`src/bb/BBShell.jsx`), and the coach's box carries it down to the tab
  bar. Measured on every Hakkilo page: 0 pixels of content in either gap.
- **On a phone a line keeps the width.** A label column beside text (a day
  of the plan, a squad's row) puts the label over its line below `sm`, two
  columns from `sm`; a 7rem column left a study day 182px and three lines
  at 390. A chip never breaks onto two lines: the row around it wraps the
  chip under the name instead. A title and its button: the button goes
  under, not the title onto two lines.
- **Hakkilo is black and white, and colour arrives with an event.**
  "Instead of blue or pink theme can we go for a more straightforward theme
  like black and white", then "just black and white background" and "keep
  the color for a specific event like when you select or click or switch
  something in, and keep the regular color" (Kee). Inside /hakkilo
  (`[data-surface='bb']` in `index.css`) the page is white, wells are
  `#F4F4F5`, text is ink, primary buttons are black with white words. A
  colour appears because the student did something: light purple `#CFC2FF`
  for pressed and for where you are (active tab), its soft `#E6DFFF` for
  what you picked, the logo yellow `#F8CB02` for switched on, the
  highlighter and the fill of a progress bar ("au lieu d'etre noir ca peut
  etre colore"; lilac at 8% was a smudge), green `#1E7B34` only for right
  once checked. No resting
  pastel cards, no saturated violet ("ca donne deja vu"), no yellow on
  black. The values and their jobs are in `src/bb/kit.jsx`.
- **The Hakkilo logo is logo B**, chosen out of four: the logo yellow
  outlined in ink on a lilac tile (`BBLogo` in `src/bb/kit.jsx`). The word
  is in Crosner outlines (the font stays out of the repo), the "H" alone
  where the word would be too small to read. Yellow on lilac alone is
  1.06:1; the ink line is what makes it readable. In the rail the H is a
  44px square tile with the rows' 13px corners (`BBLogo square`), one more
  row of the column: "le logo a gauche est pas bien dispose dans la
  grille", when it was a 44 by 51 tile taller than every row under it.
- **Hakkilo type is two weights lighter than Rich & Friends** ("deux
  niveaux moins bold, c'est trop epais"): the 'Poppins BB' family in
  `index.css` maps 500 and 600 to Regular, 700 to Medium, 800 to SemiBold,
  from the same files. Button words are 14px in a button that keeps its
  54px: "Valider" at half its size would be 9.5px, too small to read.
- **Hakkilo uses icons where a button would only repeat a name**
  ("au lieu de gros boutons avec les noms, juste des icones"): the tab bar
  (the page you are on opens into a lilac pill with its name) and the
  Claude-style ask box in `src/bb/Composer.jsx`, each named in aria-label
  and title. The tab bar has five places, Today, Courses, Coach, Plan,
  Calendar (the fifth since 17 October, "add the calendar tab to hakkilo",
  last so the four did not move; measured at 320, 360 and 390 in both
  languages with each one open: one line, no icon cut, 17px between icons
  at the tightest). The profile is the avatar in the top bar and at the
  foot of the rail, never a tab ("pas la peine que ton profil soit dans la
  barre en bas"). In the ask
  box the course and the four ways to answer sit in the menu of a "+"
  ("au lieu que toutes les icones soient serrees ensemble, regroupe-les
  dans un bouton en forme de plus"). What was chosen shows as chips just
  above the box, outside it, as in Claude Code ("les icones sont juste en
  haut du rectangle ... c'est pas a l'interieur"); inside the box are only
  the words, the "+", the mic and the send arrow. Never a row of icons
  squeezed together again. Its floating bars are
  solid white, never glass: over a flat ground a translucent bar is a
  window onto whatever scrolls under it. The pink and turquoise rules
  above still hold for Rich & Friends.
- **The Hakkilo bars carry Hakkilo only.** "Enleve le logo RF dans la
  barre, ca peut etre mentionne dans le footer plutot": Rich & Friends is
  named at the end of each page, with its mark and the way back
  (`AppFooter` in `src/bb/BBShell.jsx`, `data-hook="bb-footer"`). The other
  way is one tap from every Rich & Friends screen: "un raccourci dans Rich
  and Friends qui me renvoie sur Hakkilo". Hakkilo's H sits right after the
  Rich & Friends logo, its twin (same tile, size, shadow and corners), in
  the top bar on a phone and under it at the top of the rail: "just the H,
  it should be close to the other logo, not the opposite side", and the
  "Hak / kilo" lettering was refused (`HakkiloLink` in
  `src/components/AppShell.jsx`, `data-hook="to-hakkilo"`). A link and
  nothing else; the card on /me stays.
- **Hakkilo's Today carries the shared calendar.** "Hakilo should have the
  home page with the calendar and the things to do today. You can just copy
  the Rich and Friend calendar with the Hakilo color." One account, one
  `calendar_event`: it is Rich & Friends' `WeekStrip` with `study`, never a
  second calendar. That copy reads the timetable and the goals with a
  deadline and stops; check-ins, moods, money, solo ticks and the cycle are
  never fetched there. Hakkilo's colours: today ink with a white number, the
  day picked lilac with an ink ring (lilac alone is 1.64:1 on white), marks
  in ink, told apart by shape. The exams are drawn from the courses
  (`examEvents` in `src/lib/bb/exams.js`), never written to the calendar,
  and left out when the calendar already has that exam (an 'examen' row
  that day at the same hour or naming the course). It looks 8 weeks and 4
  months ahead, where the exams are. No recap card, so no hold. It sits
  under the ask box, in the page's one column, and opens on the week, at
  every width. The Calendar tab (`/hakkilo/calendrier`,
  `src/bb/pages/Calendar.jsx`) is Rich & Friends' whole calendar page with
  all its views ("comme sur Rich and Friend avec toutes les views"): month,
  week, day, the event form, the timetable wizard, the layers, in its
  Hakkilo copy (`study` in `src/pages/Calendar.jsx`). That copy opens on the
  month, sits in the one 46rem column, paints a class the grey well, a
  study session the soft lilac, an exam the logo yellow and the rest white
  with an ink line (`STUDY_CHIP`, the category also in words in the day
  list), and reads the calendar's own sources only: never the cycle, the
  friends' birthdays, the checklists or the bookings, and no syllabus
  wizard. The same exams as Today (`useExamsOnCalendar` in
  `src/bb/kit.jsx`) open on their course page with their form.
- **The Pomodoro is one timer for the whole of Hakkilo.** "Un timer
  pomodoro sur la page d'accueil, qui te suit sur toutes tes pages comme une
  petite icone ... tout l'ecran devient violet avec un message prends une
  pause ... pendant la pause l'ecran devient jaune et decompte" (Kee). Its
  card is on Today under the calendar. A running block is a badge in the
  top bar, in the rail (a 44px row like the others) and in a session's bar,
  and tapping it opens the controls. The end of a block is the whole screen
  lilac `#CFC2FF` with "Prends une pause" and its three buttons; the break
  is the whole screen the logo yellow, counting down, and can be tucked
  away into a yellow badge. The screens keep the page's 24px sides ("trop
  pres des bords" at 16) and carry two real stickers each ("pourquoi il n'y
  a pas de stickers ?"), in a row of their own above the words, sized by
  their height, left out below 620px of height; the cover probe finds
  nothing under them. The bells are Web Audio, with a sound switch.
  The screen takes the focus itself, never its first button (Space moves on
  in a session and would start the break unread), and keeps the keys from
  the page under it. "Quand tu commences une session, ca compte aussi comme
  un pomodoro": a session starts a block of its length unless one is
  running; a mock exam is its own block, banking what ran, and its page
  holds the screens until the student leaves it. Every block of work is a
  row of `bb_focus` (migration 83), keyed by its start so two tabs log it
  once, and kept in the browser until it is sent; the totals come from
  `bb_focus_totals(tz)`. Times are instants, never counted ticks
  (`src/lib/bb/pomodoro.js`, `src/bb/timer.js`, `src/bb/focus.js`,
  `src/bb/Pomodoro.jsx`).
- **A length picked before a Start is one column with its button.** "Ca ne
  fait pas equilibre sur l'iPad", the lengths "cote a cote" with the Start
  (Kee): the question or the name sits over its lengths, never beside them,
  and the lengths (`SegTabs wide`) take the width of the button they lead
  to, full width on a phone and the `.btn` 26rem from md. The Pomodoro
  card, Today's "Tu as combien de temps ?" and the course page's.
- **Hakkilo runs on two Claude models** ("okay pour Sonnet", 18 October,
  once the token costs were laid out). Sonnet 5.5, half the price, writes
  for the student: the coach, a chapter's questions, the corrections, the
  cases. Opus 5.5 reads the files into the course map and checks every
  question before it is kept (`MODEL` and `HEAVY_MODEL` in
  `api/_bb/common.js`; `BB_MODEL` and `BB_MODEL_HEAVY` in Vercel override
  them). Sonnet 5.5 answers a 400 to `thinking: { type: 'disabled' }` and to
  a forced `tool_choice`; `server.test.mjs` fails if either appears. The
  tokens are paid by the Anthropic API account behind `ANTHROPIC_API_KEY`,
  never by Kee's Claude subscription; prices per call in `RATES`
  (`src/lib/bb/plans.js`), real spend in `bb_usage`.
- **Hakkilo's AI is on hold since 19 October.** "I have 100 dollars of
  free API credit but I don't wanna use it, so put a hold on the API
  utilisation for Hakkilo" (Kee). `AI_PAUSED` in `api/_bb/common.js` is
  true: `start()` answers 503 `paused` to every route that would call a
  model, before the key or any client, so nothing is spent; status says
  `paused`, and the student reads "Les fonctions IA de Hakkilo sont en
  pause" (`bb.err.paused`, `bb.proc.paused`) while sessions, cards, the
  plan, the calendar and the Pomodoro keep working. `BB_AI_PAUSED=0` in
  Vercel (then a redeploy) resumes without a code change; resuming in the
  code is setting `AI_PAUSED` back to false, only when Kee asks. Rich &
  Friends' syllabus reader (`api/syllabus.js`) is not held.
- **On the iPad, Hakkilo stays the one column it was.** "Arrete de
  travailler sur la vue d'iPad, keep-le comme avant" (Kee, 17 October,
  after "a lot of void space on the left and on the right"). For one
  release Today put the calendar in a second column from lg, and the course
  page, the plan and the list were being widened the same way; all of it
  was taken back or never shipped. Every Hakkilo page keeps its 46rem
  column on an iPad and a laptop. "First-class" above means nothing breaks
  there (the sweep), not a wider layout: do not rework it unless she asks.
  The Rich & Friends dashboard stays one column too: the bento was refused
  there three times.
- **Nothing is underlined in Hakkilo.** "J'aime pas quand c'est souligne.
  Ca peut etre en gras, ca peut etre a l'interieur d'un petit rond ou d'un
  petit bouton." A small action is a pill (`PILL` in `src/bb/kit.jsx`,
  `PILL_DANGER` for what deletes, `PILL_ROUND` for a cross alone). A link
  that ended a sentence leaves it and becomes a pill under it. Links in
  small print are bold ink (`<AuthForm plainLinks>` on the sign-in page).
  Beside a 54px button a pill needs `items-center` on its row, or the flex
  row stretches it to 54px ("Corriger" did). `app.test.mjs` fails on any
  `underline` utility under `src/bb`. Rich & Friends keeps its underlines
  until Kee asks.
- **A short label holds one line.** "Not sure but wrong, just wrong, it's
  making the design look bad when it's too long" (Kee). A stat's name, a
  chip, a tab, a button's words: one line at 320, 360 and 390, in French and
  in English. Shorten the words first ("Sure but wrong" is "Wrong" over the
  course's numbers; a button's long phrase goes into the sentence above
  it), never the type. A full-width button on a phone has 16px sides
  (`px-4`, built into `BigButton`), not the 24 of `.btn`, and a row of
  choices lets a button take the width its words need rather than break
  one ("Au hasard" in the session).
- **Dictation is the browser's own speech recognition** (the Web Speech
  API, `src/lib/bb/dictation.js`). The mic is not drawn where it cannot
  work: Firefox, the browsers inside TikTok and Instagram, and an app on an
  iPhone or iPad home screen, where the API exists and nothing happens. On a
  phone it listens for one sentence (Chrome on Android repeats words when it
  listens continuously). Wispr Flow has no web SDK, only its keyboard, and
  that keyboard already types into the box. Sending a student's voice to a
  server of ours would need the privacy page changed first.

- **The white die-cut outline belongs to real stickers only**, the PNGs in
  `src/assets/stickers`. "C'est pas vraiment des stickers, c'est des choses
  que tu as craftées." Badges, cards, pills and anything else drawn in code
  never wear a white sticker border to pass for one.
- **No code-drawn badges as decoration.** They were refused twice: the
  word pills, then the yellow spinning "START NOW" badge ("Ca aussi enlève
  je n'aime pas"). The decoration on the public pages is the real sticker
  art, plus tape, the yellow marker and the odd hand-drawn arrow.
- **Stickers cover no running text, except the hero headline.** "Des
  stickers autour du texte, un peu sur le texte", as in the references, was
  asked for the title. There they hang on words (`headline()` in
  `src/components/Headline.jsx`, used by the home page and the sign-in
  page), so they follow the line breaks, and they may take at most 30%
  of a letter's ink and 12% of a word's, measured on the painted page at
  every width in both languages. Everywhere else the cover probe must find
  nothing.
- **The checkout is our page, with Stripe's form inside it.** "What about
  the sticker on the checkout page, our colors etc??", then "Oui, notre
  page" (Kee). Hakkilo Plus at `/hakkilo/paiement/:plan`, the books at
  `/paiement/:slug`, signed in or not. The form sits in a card of the colour
  Stripe paints behind it (`CHECKOUT_LOOK` in `src/lib/checkoutLook.js`, the
  same values as the `branding_settings` of `api/_brand.js`), with real
  stickers on the card's top and bottom bands (`CheckoutCard`), never over
  the form (an iframe nothing here can measure) and never over our words.
  On a phone that card is a band from one edge of the screen to the other
  ("pas bien ajuste sur le telephone": inside the page's 24px and the
  card's 8px, Stripe's form had 326px of 390 and its own margins inside
  that); from sm it is the rounded card.
  The form opens only when the build has `VITE_STRIPE_PUBLISHABLE_KEY` and
  the server's two keys are of one mode (`embeddable`); otherwise, and
  whenever Stripe.js cannot load, the buyer goes to Stripe's hosted page as
  before. `ui_mode: 'embedded'`, Stripe.js from `js.stripe.com/clover/` and
  `initEmbeddedCheckout` belong to `BRANDING_API_VERSION`: dahlia renamed
  them (`embedded_page`, `createEmbeddedCheckoutPage`), so they move
  together or not at all. "Sandbox" on the form is the test key. The form
  carries no icon: "You cannot set `icon` when `ui_mode` is `embedded`"
  failed every live Hakkilo Plus checkout on 18 October ("Le paiement n'a
  pas pu demarrer"), so `brandingFor(app, embedded)` leaves it out, and
  `createCheckoutSession` (`api/_brand.js`) sends a session again without
  branding when Stripe refuses a branding field: a sale never fails over
  how it looks. Both checkouts create their session through it.
- Look at sticker art on a dark or coloured ground before trusting it. A
  white page hides a grey ghost outline and a stair-stepped cut; the pink
  footer shows both. `python3 scripts/diecut.py --write` re-cuts every file.

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
- Checkboxes are drawn by `index.css` (`appearance: none`, the tick a mask
  in `currentColor`), so `accent-color` does nothing on them, and Tailwind's
  preflight `color: inherit` outranks the `:where()` rule that colours the
  tick. On the Hakkilo surface a ticked box was a black square with a black
  tick until `[data-surface='bb'] input[type='checkbox']` set the colours:
  yellow when on, ink tick and outline.
- Tailwind 3 emits no native cascade layers: `@layer components` is only a
  place in the output. So `[data-surface='bb'] .btn` (an attribute and a
  class) outranks every `px-*` (one class) whatever comes later. A padding
  set there turned `sm:px-10` into 16px on every Hakkilo button. Put
  padding on the element.
- `backdrop-filter` blurs what is behind an element. Over a flat ground it
  returns that same flat colour, so glass needs a ground to be worth anything.
- A full-page Playwright screenshot scrolls a horizontal snap track: the
  week strip read 1848/308 (this week) before the capture and 976/308
  (September) after it, while real resizes and an iPad turned both ways kept
  it on this week. When the strip is what is being looked at, set the
  viewport to the page's height and take a plain screenshot. The sweep's
  full-page shots show the wrong week for that reason, not because of a bug.
