import { Link } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { Mark } from '../../components/Wordmark'
import PreviewCard from '../../components/PreviewCard'
import { Badge, Doodle, SpinBadge, Sparkle, Spot, Tape, cast } from '../../components/StickerKit'
import { stickerSrc } from '../../lib/art'

/**
 * The front page: what this is, why groups go quiet, and the way in.
 *
 * EN COLLAGE, DEPUIS LE 15 OCTOBRE.
 *
 *   "The home page of rich and friends could look funnier and cooler with
 *    more stickers and stuff like that same for the footer"
 *
 * La page etait blanche, du texte noir et trois touches de couleur, et a
 * 1440 px elle n'avait AUCUN sticker: le rail est reserve au telephone depuis
 * qu'il tombait sur les titres (la note est dans Stickers.jsx). Les stickers
 * sont maintenant dans la composition elle-meme: dans le titre, colles aux
 * coins de la carte, au bout des bandes du manifeste, au coin de chaque
 * pilier, devant chaque raison, et des amis qui depassent du panneau jaune.
 * Les regles de pose sont en tete de src/components/StickerKit.jsx.
 *
 * Chaque mot de la page est le meme qu'avant. Seule la mise en page change.
 */

/**
 * Qui va ou. Une seule liste par scene, passee par cast() pour qu'un sticker
 * renomme soit remplace plutot que de laisser un trou. Aucun ne se repete sur
 * la page: vingt-trois des vingt-neuf du dossier, chacun a un seul endroit.
 */
const HERO_ART = cast(['chaching', 'thumb', 'coin', 'daisy'])
const BAND_ART = cast(['fire', 'lips'])
/* Discipline: celui qui s'entraine. Ambitions: la licorne. Serenite: la carpe
   koi, le poisson des bassins calmes. */
const PILLAR_ART = cast(['baller', 'unicorn', 'koi'])
/* L'objectif vague: la tete dans les nuages. Quelqu'un qui disparait: l'oiseau
   qui dit "sup", c'est-a-dire l'ami qui ecrit. La serie cassee: la flamme qui
   est morte. */
const REASON_ART = cast(['cloudguy', 'bird', 'skullfire'])
/* Les amis qu'on serait gene de decevoir, qui regardent par-dessus le bord. */
const PEEK_ART = cast(['cat', 'homie', 'eyelips', 'fox', 'skull'])

/* Une pente par carte, courte et repetee, comme TILTS dans Stickers.jsx: une
   serie se lit comme un geste, des valeurs au hasard comme du bruit. */
const PILLAR_TILT = [-2.2, 1.6, -1.2]

/**
 * Une bande de scotch qui repete des mots, plus large que l'ecran et penchee.
 * Decor: aria-hidden, les mots sont ceux de la page.
 */
function WordTape({ words, tone, tilt }) {
  return (
    <div
      aria-hidden="true"
      className={`relative ml-[-8%] w-[116%] py-2.5 ${tone}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div className="flex justify-center gap-5 whitespace-nowrap text-[clamp(0.95rem,1.8vw,1.25rem)] font-extrabold uppercase tracking-[0.05em] text-[#111111]">
        {[0, 1, 2, 3].flatMap((k) => words.map((w) => <span key={`${k}${w}`}>{w} ✦</span>))}
      </div>
    </div>
  )
}

/**
 * The words the marker goes behind, if they are in the title. A translation
 * that rewords the title without updating `mark` loses the highlight and
 * nothing else.
 */
function markParts(title, mark) {
  const i = mark ? title.indexOf(mark) : -1
  if (i < 0) return title
  return (
    <>
      {title.slice(0, i)}
      <span className="marker">{mark}</span>
      {title.slice(i + mark.length)}
    </>
  )
}

export default function Home() {
  const { locale } = useT()
  const c = LANDING[locale] ?? LANDING.en
  const fun = c.fun

  /**
   * The name, and then what the thing is.
   *
   * This was the product's name alone, on the reasoning that every other page
   * is "<page> · Rich & Friends" so the home page repeating it would say the
   * name twice. That is right about a browser tab and wrong about a search
   * result: "Rich & Friends" gives a search engine no subject to weigh, and
   * the name has to compete with a song of the same name by a band people
   * have heard of. The tagline is the only place the subject gets stated
   * where a crawler can see it.
   *
   * It is the same string the static <head> carries, so what a crawler that
   * runs JavaScript ends up with matches what one that does not started with.
   */
  usePageMeta({ title: `Rich & Friends · ${c.tagline}`, description: c.hero.body })

  return (
    <>
      {/**
       * LE HERO: LE TEXTE A GAUCHE, LE COLLAGE A DROITE.
       *
       * Toujours sans conteneur autour des mots (la note d'avant tient: une
       * feuille blanche sur un fond blanc n'est qu'une ombre qui enferme le
       * titre). Le collage est a cote, pas derriere: la carte du produit,
       * penchee, scotchee, avec des stickers colles a ses coins. Sur un
       * telephone il passe sous les boutons, pour que le titre et l'appel
       * restent dans le premier ecran.
       *
       * Le titre perd un peu de taille a partir de lg (76 px au lieu de 92)
       * pour tenir en trois lignes dans sa colonne. Mesure a 1024, 1180 et
       * 1440: "Change de vie." est la ligne la plus longue et tient partout.
       */}
      <section data-hook="hero" className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-10 md:pb-24 md:pt-14">
        {/* Les deux colonnes alignees par le BAS: le badge rond est au pied du
            collage et la fleche qui part de lui doit tomber sur le bouton,
            quelle que soit la hauteur du texte. Centrees, en anglais (quatre
            lignes de titre au lieu de trois), elle pointait le paragraphe. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:items-end lg:gap-10">
          <div className="stagger">
            {/* Des stickers a mots a la place d'un chapeau gris. Chacun repete
                une chose que la page dit deja; voir `fun` dans landing.js. */}
            <div style={{ '--i': 0 }} className="flex flex-wrap items-center gap-2.5" data-hook="hero-badges">
              <Badge tone="pink" tilt={-5} delay={120}>{fun.badges[0]}</Badge>
              <Badge tone="sky" tilt={3} delay={220}>{fun.badges[1]}</Badge>
              <Badge tone="yellow" tilt={-2} delay={320}>{fun.badges[2]}</Badge>
            </div>

            <h1
              style={{ '--i': 1 }}
              className="mt-7 max-w-[14ch] text-[clamp(2.75rem,9vw,5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-ink
                         lg:text-[clamp(3.5rem,6.2vw,4.75rem)]"
            >
              {markParts(c.hero.title, c.hero.mark)}
              {/* Dans la ligne, pas pose dessus: il passe a la ligne avec les
                  mots, donc il ne peut en couvrir aucun, a aucune largeur. */}
              <Spot name={HERO_ART[0]} tilt={-9} delay={500} eager className="spot-inline" />
            </h1>

            <p
              style={{ '--i': 2 }}
              className="mt-8 max-w-[46ch] text-[clamp(1.0625rem,1.6vw,1.25rem)] leading-[1.55] text-muted"
            >
              {c.hero.body}
            </p>

            <div style={{ '--i': 3 }} className="mt-10 flex flex-wrap items-center gap-3">
              {/* The accent is the theme's other colour: yellow when the type is
                  blue, pink when the type is yellow-adjacent. Either way the
                  button is never the colour it is sitting on. */}
              <Link to="/signin" className="btn-primary press w-auto px-9">
                {c.hero.cta}
              </Link>
              <Link to="/how-it-works" className="btn-outline press w-auto px-9">
                {c.hero.secondary}
              </Link>
            </div>
            <p style={{ '--i': 4 }} className="mt-6 text-small text-muted">
              {c.hero.note}
            </p>
          </div>

          {/**
           * LE COLLAGE. La carte du produit (la meme que sur Comment ca marche,
           * construite avec les vraies classes de l'interface), penchee et
           * scotchee, et trois stickers colles a ses bords.
           *
           * Chaque sticker deborde de la carte de MOINS que son padding (24 px):
           * il tient le coin ou le bord, jamais une ligne. Le padding du
           * collage est la place qu'ils prennent dehors, et c'est aussi ce qui
           * les garde dans l'ecran a 320 px.
           */}
          <div
            data-hook="hero-collage"
            className="relative mx-auto mt-16 w-full max-w-[26rem] px-1 pb-28 pt-20 sm:max-w-[28rem] sm:px-9 sm:pt-16 lg:mt-0 lg:max-w-none lg:px-10"
          >
            <div className="relative" style={{ transform: 'rotate(2.5deg)' }}>
              <Tape className="-top-2.5 left-8" tilt={-9} />
              <Tape className="-top-2.5 right-10" tilt={7} tone="255 0 122" />
              <PreviewCard className="relative" />
              <Spot name={HERO_ART[3]} tilt={10} delay={700} className="absolute -right-2 -top-[4.75rem] z-[3] w-[4.5rem] sm:-right-6 sm:w-[5.25rem]" />
              {/* Sur un telephone la carte prend toute la largeur pour que ses
                  pastilles tiennent sur une ligne, donc il n'y a plus de bord
                  gauche ou coller le pouce: il passe au-dessus du coin. */}
              <Spot
                name={HERO_ART[1]}
                tilt={-14}
                delay={820}
                className="absolute -top-[5.1rem] left-2 z-[3] w-[3.1rem] sm:-left-[3.1rem] sm:top-[34%] sm:w-[3.6rem]"
              />
              <Spot name={HERO_ART[2]} tilt={9} delay={940} className="absolute -bottom-[3.4rem] -right-2 z-[3] w-[6.25rem] sm:-right-5 sm:w-[7rem]" />
            </div>
            <SpinBadge
              text={fun.spin}
              label={c.hero.cta}
              tilt={-8}
              delay={1000}
              className="absolute bottom-0 left-1 z-[4] w-[7rem] sm:w-[7.75rem]"
            />
            <Sparkle className="absolute right-3 top-6 w-6 text-[#FF007A]" />
            <Sparkle className="absolute bottom-24 right-1 w-4 text-[#38BDF8]" />
            {/* Une fleche du badge vers le bouton principal. Elle n'a de sens
                que quand les deux sont cote a cote, donc a partir de lg. */}
            <Doodle
              kind="swoop"
              className="absolute -left-[6.5rem] bottom-[4.75rem] hidden w-24 text-[#FF007A] lg:block"
              style={{ transform: 'scaleX(-1) rotate(8deg)' }}
            />
          </div>
        </div>
      </section>

      {/**
       * THE MANIFESTO. One sentence, alone, with nothing to compete with it.
       *
       * Sur une bande noire, en jaune (13,4:1), entre deux bandes de scotch
       * qui repetent les mots de la page, penchees dans l'autre sens. Les
       * deux bandes sont du decor (aria-hidden); la phrase, elle, reste un
       * paragraphe normal, lu une fois.
       *
       * Empilees et pas croisees. Croisee derriere la bande noire, la rose
       * n'en sortait qu'aux deux bouts a 1440 px et jamais sur un telephone:
       * la bande noire y est plus haute que la rose ne s'ecarte.
       *
       * No quotation marks. Nobody is being quoted; the app is saying it.
       * Punctuation that implies a source the page cannot name reads as a
       * testimonial with the name filed off.
       *
       * Les bandes sont plus larges que l'ecran et penchees, donc la section
       * coupe ce qui depasse. Rien de collant n'est dedans: la coupe ne tue
       * aucun position: sticky (la note sur .ground dit pourquoi c'est la
       * seule precaution qui compte).
       */}
      <section data-hook="manifesto-band" className="relative overflow-hidden py-14 md:py-20">
        <WordTape words={fun.tape} tone="bg-[#FF007A]" tilt={3} />
        <div
          className="relative z-10 -my-2 ml-[-8%] w-[116%] bg-[#111111] px-[11%] py-11 md:py-14"
          style={{ transform: 'rotate(-2.5deg)' }}
        >
          {/* Colles sur la bande, a cheval sur son bord: chacun entre moins
              dans le noir que la bande n'a de marge au-dessus et au-dessous
              de la phrase. */}
          <Spot
            name={BAND_ART[0]}
            tilt={-10}
            className="absolute -top-9 left-[12%] w-[4rem] md:w-[6.5rem]"
          />
          <p
            data-hook="manifesto"
            className="mx-auto max-w-[24ch] text-center text-[clamp(1.5rem,4.2vw,2.75rem)] font-bold leading-[1.12] tracking-[-0.02em] text-[#FFD60A]"
          >
            {c.manifesto}
          </p>
          <Spot
            name={BAND_ART[1]}
            tilt={8}
            className="absolute -bottom-8 right-[12%] w-[3.5rem] md:w-[5.5rem]"
          />
        </div>
        <WordTape words={[...fun.tape].reverse()} tone="bg-[#38BDF8]" tilt={2} />
      </section>

      {/**
       * THE THREE PILLARS.
       *
       * Money is one of three here rather than the whole story, and that is
       * what makes this page agree with the app: the sections below it talk
       * about groups going quiet and about check-ins, which a page that opened
       * on budgeting alone would have contradicted three screens later.
       *
       * Each pillar names a part of the app that actually exists. A pillar
       * that does not resolve to a screen is a slogan, and this page has one
       * of those already, on purpose, at the top.
       *
       * EN CARTES DECOUPEES, PLEINES DE COULEUR.
       *
       * La note d'avant gardait la couleur dans une petite tuile, parce que
       * trois cartes de couleur pleine "font une page de blocs" et que le texte
       * devait etre remesure sur trois fonds. Il l'a ete: tout le texte des
       * cartes est en ENCRE, #111 sur #FF007A 4,98:1, sur #38BDF8 8,81:1, sur
       * #FFD60A 13,4:1. Le gris secondaire n'y entre pas: #565656 sur ce rose
       * tomberait a 1,9:1. Les blocs, c'est ce qui a ete demande.
       */}
      <section id="lifestyle" className="mx-auto w-full max-w-5xl px-6 pb-16 pt-4 md:pb-24">
        <p className="tag">{c.pillars.eyebrow}</p>
        <h2 className="display mt-6 max-w-[20ch] text-[clamp(1.625rem,3.6vw,2.5rem)]">
          {c.pillars.title}
        </h2>

        <ol className="mt-16 grid gap-14 md:grid-cols-3 md:gap-6">
          {c.pillars.items.map((item, i) => (
            <li
              key={item.n}
              data-pillar={item.n}
              className={`diecut relative flex flex-col rounded-[1.75rem] p-6 pt-7 text-[#111111] ${item.tone}`}
              style={{ '--tilt': `${PILLAR_TILT[i]}deg` }}
            >
              {/* Au coin haut droit, au-dessus de la ligne du numero: le titre
                  commence 100 px plus bas que le haut de la carte, le sticker
                  s'arrete avant. */}
              <Spot
                name={PILLAR_ART[i]}
                tilt={i % 2 ? -9 : 9}
                className="absolute -right-4 -top-12 w-[4.75rem]"
              />
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-white font-display text-body font-extrabold [font-variant-numeric:tabular-nums]"
              >
                {item.n}
              </span>
              <h3 className="mt-5 text-[1.125rem] font-bold leading-snug">{item.title}</h3>
              <p className="mt-2.5 text-small leading-relaxed">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/**
       * THE ANSWER, IN THE SHAPE OF THE QUESTION.
       *
       * The eyebrow asks why WE do not reach our goals and the heading used to
       * reply that other apps do not fail for want of features. Nobody arrives
       * on this page wondering why software fails, and an answer aimed at a
       * different question reads as evasion however true it is.
       *
       * Three reasons about people, and under each one the thing this app does
       * about it. The reason and the remedy are on the same row deliberately:
       * split across two sections they become a complaint and a brochure.
       *
       * Un sticker devant chaque raison, dans sa propre colonne: il ne peut
       * donc rien couvrir. Le remede est un post-it scotche, jaune pale, en
       * encre (16,5:1): meme role que le panneau rose d'avant, une forme fermee
       * qui le distingue de la raison sans l'annoncer par un mot.
       */}
      <section id="finances" className="mx-auto w-full max-w-5xl px-6 py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-[1fr_1.5fr] md:gap-10">
          <div>
            <p className="tag">{c.problem.eyebrow}</p>
            <h2 className="display mt-6 max-w-[16ch] text-[clamp(1.625rem,3.6vw,2.5rem)]">
              {c.problem.title}
            </h2>
            <div className="relative mt-10 hidden h-32 md:block" aria-hidden="true">
              {/* Le monogramme, decoupe comme un sticker: le bord blanc est sur
                  l'enveloppe, parce que la tuile pose deja son propre style. */}
              <span className="diecut absolute left-1 top-0 inline-flex rounded-[1.75rem] bg-white" style={{ '--tilt': '-8deg' }}>
                <Mark size={84} />
              </span>
              <Doodle kind="swoop" className="absolute left-[7.5rem] top-4 w-28 text-[#FF007A]" />
            </div>
          </div>

          <ul className="space-y-11">
            {c.problem.reasons.map((r, i) => (
              <li
                key={r.why}
                data-reason=""
                className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-4 sm:grid-cols-[4.25rem_minmax(0,1fr)] sm:gap-5"
              >
                <Spot name={REASON_ART[i]} tilt={i % 2 ? 8 : -8} className="mt-1 w-full" />
                <div>
                  <h3 className="max-w-[30ch] text-body font-bold leading-snug text-ink">{r.why}</h3>
                  <p className="mt-2 max-w-[52ch] text-small leading-relaxed text-muted">{r.body}</p>
                  {/* The remedy. Still not labelled "solution", because a word
                      would make each of these a little sales pitch, and the
                      sentence needs to read as a different kind of sentence
                      without being announced. */}
                  <div className="relative mt-4 max-w-[52ch]" style={{ transform: `rotate(${i % 2 ? 0.7 : -0.7}deg)` }}>
                    {/* Le scotch mord sur la marge du haut du post-it et s'arrete
                        avant la premiere ligne: mesure, il touchait la boite de
                        la ligne quand la marge etait de 16 px. */}
                    <Tape className="-top-3.5 left-6" tilt={-4} tone={i % 2 ? '56 189 248' : '255 0 122'} />
                    <p className="rounded-inner bg-[#FFF4AD] px-4 pb-3 pt-6 text-small leading-relaxed text-[#111111] shadow-[0_6px_16px_rgb(17_17_17/0.08)]">
                      {r.fix}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/**
         * L'ETUDE, CITEE SOUS L'ARGUMENT QU'ELLE SOUTIENT.
         *
         * "Avoir un lien sur la home page du site pour citer ce sondage-la ou
         * d'autres affaires."
         *
         * Ici et pas dans le hero : cette section explique pourquoi les gens
         * n'atteignent pas leurs objectifs, et le sondage est ce sur quoi cette
         * explication repose. Une page qui affirme puis, deux paragraphes plus
         * bas, montre ou aller verifier, est une page differente d'une page qui
         * affirme seulement.
         *
         * Une ligne et un lien. Pas un encart avec des chiffres : les chiffres
         * sont sur la page qui porte aussi la methode, et les sortir d'ici
         * reviendrait a publier une statistique sans ses limites.
         */}
        <div className="mt-14 flex flex-col gap-3 border-t border-hairline pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-[46ch] text-small leading-relaxed text-muted">
            {c.studies.home_line}
          </p>
          <Link
            to="/etudes"
            data-hook="home-studies"
            className="chip press shrink-0 self-start sm:self-auto"
          >
            {c.studies.home_link}
          </Link>
        </div>
      </section>

      {/**
       * The one block of yellow on the page, and it is the last thing you read,
       * with black on it at 16.5:1.
       *
       * Et les amis qu'on serait gene de decevoir depassent du bas, comme des
       * tetes au-dessus d'un mur. Le panneau les coupe (overflow-hidden) et
       * garde sous le bouton la hauteur qu'ils prennent, donc aucun ne monte
       * jusqu'au texte. Au survol, chacun sort un peu plus la tete.
       */}
      <section id="mouvement" className="relative mx-auto w-full max-w-5xl px-6 pb-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-field px-6 pb-[clamp(8.5rem,21vw,12rem)] pt-16 text-center md:pt-20">
          <Badge tone="pink" shape="round" tilt={-12} className="absolute left-4 top-4 hidden w-[5.5rem] text-[0.75rem] sm:flex md:left-6 md:top-6">
            {fun.badges[1]}
          </Badge>
          {/* Dans la marge du haut (64 px), au-dessus de la premiere ligne du
              titre: a 390 px, plus bas, la grande etoile mordait sur "Une". */}
          <Sparkle className="absolute right-[9%] top-5 w-7 text-[#FF007A]" />
          <Sparkle className="absolute right-[17%] top-9 hidden w-4 text-[#111111] sm:block" />
          <h2 className="mx-auto max-w-[18ch] text-[clamp(1.875rem,5vw,3rem)] font-semibold leading-[1.02] tracking-[-0.024em] text-on-field">
            {c.close.title}
          </h2>
          <p className="mx-auto mt-5 max-w-[40ch] text-body text-on-field/75">{c.close.body}</p>
          <div className="mt-9 flex justify-center">
            {/* Black on the field, rather than the accent: in sun the accent
                is pink on yellow, which is the one pairing in the set that
                fails as a filled control. */}
            <Link
              to="/signin"
              className="btn press w-auto bg-on-field px-10 text-field hover:opacity-90"
            >
              {c.close.cta}
            </Link>
          </div>
          <div
            aria-hidden="true"
            data-hook="peekers"
            className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-[3%] px-4"
          >
            {PEEK_ART.map((name, i) =>
              stickerSrc(name) ? (
                <img
                  key={name}
                  src={stickerSrc(name)}
                  alt=""
                  loading="lazy"
                  draggable="false"
                  data-sticker={name}
                  className={`peek w-[21%] max-w-[8.5rem] sm:w-[17%] drop-shadow-[0_-4px_10px_rgb(0_0_0/0.12)] ${i === 4 ? 'hidden sm:block' : ''}`}
                  style={{ '--tilt': `${[-6, 4, -3, 6, -5][i]}deg`, '--sink': `${[30, 24, 34, 26, 30][i]}%` }}
                />
              ) : null,
            )}
          </div>
        </div>
      </section>
    </>
  )
}
