import { Fragment, useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { LANDING } from '../../content/landing'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'
import { Mark } from '../../components/Wordmark'
import PreviewCard from '../../components/PreviewCard'
import { Doodle, SpinBadge, Sparkle, Spot, Tape, cast } from '../../components/StickerKit'
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
 * sont maintenant dans la composition elle-meme: autour du titre, colles aux
 * coins de la carte, au bout des bandes du manifeste, au coin de chaque
 * pilier, devant chaque raison, et des amis qui depassent du panneau jaune.
 * Les regles de pose sont en tete de src/components/StickerKit.jsx.
 *
 * Les couleurs sont celles du logo et aucune autre: le rose #FF007A, le
 * turquoise #009DB9, le jaune. Le bleu a ete #38BDF8 puis #0B6FAD, et "le
 * bleu que tu as pris et le bleu qui est sur le logo, c'est pas le même
 * bleu". Le blanc n'y fait que 3,80:1 et 3,22:1, donc tout mot pose sur ces
 * deux fonds est un grand texte, en gras et a 19 px au moins (le seuil de 3:1
 * des grands textes, 18,66 px en gras). Un texte plus petit va sur du blanc
 * ou un pastel, a l'encre.
 *
 * Chaque mot de la page est le meme qu'avant. Seule la mise en page change.
 */

/**
 * Qui va ou. Une seule liste par scene, passee par cast() pour qu'un sticker
 * renomme soit remplace plutot que de laisser un trou. Aucun ne se repete sur
 * la page: vingt-cinq des vingt-neuf du dossier, avec le pied de page, chacun
 * a un seul endroit.
 */
/* Autour du titre: FIRE sur le premier mot, le pouce au coin, CHACHING au
   bout de la phrase. */
const TITLE_ART = cast(['fire', 'thumb', 'chaching'])
const HERO_ART = cast(['daisy', 'pickle', 'coin'])
const BAND_ART = cast(['bass', 'lips'])
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
 * Decor: aria-hidden, les mots sont ceux de la page. En blanc sur le rose et
 * le turquoise du logo (en noir, "ça donne mal aux yeux"), et assez gros pour
 * le seuil des grands textes: 19 px en extra-gras au plus petit.
 */
function WordTape({ words, tone, tilt }) {
  return (
    <div
      aria-hidden="true"
      className={`relative ml-[-8%] w-[116%] py-2.5 ${tone}`}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div className="flex justify-center gap-5 whitespace-nowrap text-[clamp(1.1875rem,2vw,1.375rem)] font-extrabold uppercase tracking-[0.05em] text-white">
        {[0, 1, 2, 3].flatMap((k) => words.map((w) => <span key={`${k}${w}`}>{w} ✦</span>))}
      </div>
    </div>
  )
}

/**
 * LE TITRE, AVEC SES STICKERS ACCROCHES AUX MOTS.
 *
 *   "à la place, t'ajoutes des stickers autour du texte, un peu sur le
 *    texte, etc. Comme ce que j'avais montré."
 *
 * Les references posent une couronne de stickers autour du titre, et
 * certains mordent sur les lettres. Ici aussi, et c'est la seule exception a
 * la regle "rien ne couvre un mot" du kit.
 *
 * ACCROCHES A UN MOT, PAS A LA PAGE. Le titre ne tombe pas pareil d'une
 * largeur a l'autre: mesure, il fait trois a cinq lignes et ses coupures
 * changent avec la langue ("Change your" / "Change your life." / "Change"
 * seul a 320 px). Un sticker pose en pourcentages de la colonne finissait
 * sur un mot ou un autre selon la largeur. Accroche au mot, il le suit:
 * `pins.first` au premier mot, `pins.last` au dernier, en em, donc a la
 * taille du titre a toutes les largeurs. Le mot accroche est un <span> en
 * ligne (.pin dans index.css), donc le titre passe a la ligne exactement
 * comme sans lui.
 *
 * "UN PEU" SUR LE TEXTE, MESURE. Le plafond a ete fixe avant de poser quoi
 * que ce soit: 30 % de l'encre d'une lettre, 12 % de celle d'un mot, sur la
 * page peinte avec et sans le decor. Mesure de 320 a 1440 px, dans les deux
 * langues: le FIRE prend 13 a 15 % du C, le pouce au plus 24 % de la
 * derniere lettre de la premiere ligne, CHACHING au plus 8 % du point, et
 * aucun mot ne perd plus de 4 %.
 *
 * Les mots derriere lesquels passe le surligneur sont `mark`, s'ils sont dans
 * le titre. Une traduction qui change le titre sans changer `mark` perd le
 * surlignage et rien d'autre.
 */
function headline(title, mark, pins) {
  const at = mark ? title.indexOf(mark) : -1
  const runs = at < 0
    ? [[title, false]]
    : [[title.slice(0, at), false], [mark, true], [title.slice(at + mark.length), false]]
  const words = runs.flatMap(([text]) => text.split(/\s+/).filter(Boolean))
  const pinFor = { 0: pins.first, [words.length - 1]: pins.last }
  let k = 0
  return runs.map(([text, marked], r) => {
    const parts = text.split(/(\s+)/).map((part, j) => {
      if (!part || /^\s+$/.test(part)) return part
      const pin = pinFor[k++]
      return pin ? (
        <span key={j} className="pin">
          {part}
          {pin}
        </span>
      ) : (
        part
      )
    })
    return marked ? (
      <span key={r} className="marker">
        {parts}
      </span>
    ) : (
      <Fragment key={r}>{parts}</Fragment>
    )
  })
}

/**
 * Ou finit la premiere ligne du titre, en variable CSS sur le titre.
 *
 * Le pouce se colle au bout de la premiere ligne, et ce bout n'est jamais le
 * meme mot: "Change" seul a 320 px en anglais, "Change your" a 390, "Change
 * your life." a 414, "Change de vie." en francais. CSS ne sait pas ou une
 * ligne finit, donc on le mesure, mot par mot (les espaces de fin de ligne
 * n'ont pas d'encre), a chaque changement de taille et quand la police est
 * chargee. Divise par l'echelle du titre, parce que son entree joue un
 * scale(0.994) et que la mesure peut tomber pendant.
 *
 * Avant la premiere mesure, le pouce est au coin droit du bloc: juste aussi,
 * moins precis.
 */
function useLineEnd(ref, text) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const measure = () => {
      const box = el.getBoundingClientRect()
      if (!box.width) return
      const range = document.createRange()
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      let top = Infinity
      let end = 0
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        for (const m of n.textContent.matchAll(/\S+/g)) {
          range.setStart(n, m.index)
          range.setEnd(n, m.index + m[0].length)
          for (const r of range.getClientRects()) {
            if (r.top < top - 2) {
              top = r.top
              end = r.right
            } else if (r.top <= top + 2) end = Math.max(end, r.right)
          }
        }
      }
      if (end) el.style.setProperty('--line-end', `${((end - box.left) * el.offsetWidth) / box.width}px`)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [ref, text])
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

  const title = useRef(null)
  useLineEnd(title, c.hero.title)

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
       *
       * 13ch de large au plus, et plus 14. A 14, "financial freedom." tenait
       * sur une ligne entre 436 et 470 px, contre le bord de la colonne, et le
       * CHACHING accroche au dernier mot sortait de l'ecran de 27 px: mesure
       * de 10 en 10 px, de 320 a 1440. A 13 (8,4 em), "freedom." est seul sur
       * sa ligne a toutes les largeurs, et le francais ne bouge pas: sa plus
       * longue ligne fait 7,2 em.
       */}
      <section data-hook="hero" className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-10 md:pb-24 md:pt-14">
        {/* Les deux colonnes alignees par le BAS: le badge rond est au pied du
            collage et la fleche qui part de lui doit tomber sur le bouton,
            quelle que soit la hauteur du texte. Centrees, en anglais (quatre
            lignes de titre au lieu de trois), elle pointait le paragraphe. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:items-end lg:gap-10">
          <div className="stagger">
            {/* Plus de pastilles a mots au-dessus: "j'aime pas cette sorte de
                écriture en mode bouton". Le titre ouvre la page, et ses
                stickers prennent la place qu'elles avaient: le haut du pouce
                monte a 0,95 em au-dessus du titre, d'ou mt-3 et md:mt-8. */}
            <h1
              ref={title}
              style={{ '--i': 0 }}
              data-hook="hero-title"
              className="relative mt-3 max-w-[13ch] text-[clamp(2.75rem,9vw,5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-ink
                         md:mt-8 lg:text-[clamp(3.5rem,6.2vw,4.75rem)]"
            >
              {headline(c.hero.title, c.hero.mark, {
                /* FIRE, colle sur le haut du C. Pas plus a gauche que 0,2 em:
                    avec sa pente il deborde de 0,29 em, soit 23 px quand le
                    titre fait 80 px, et la page n'a que 24 px de marge. A
                    -0,5 em il etait coupe par le bord de l'ecran a 820. */
                first: (
                  <Spot
                    name={TITLE_ART[0]}
                    tilt={-12}
                    delay={380}
                    eager
                    style={{ left: '-0.2em', top: '-0.58em', width: '1.55em' }}
                  />
                ),
                /* CHACHING, au bout de la phrase, sur le point. */
                last: (
                  <Spot
                    name={TITLE_ART[2]}
                    tilt={-8}
                    delay={640}
                    eager
                    style={{ left: 'calc(100% - 0.3em)', top: '0.22em', width: '1.5em' }}
                  />
                ),
              })}
              {/* Le pouce, sur le bout de la premiere ligne, quelle qu'elle
                  soit (voir useLineEnd). Au-dessus de la premiere ligne il n'y
                  a que la marge, donc il ne prend que le haut des lettres. */}
              <Spot
                name={TITLE_ART[1]}
                tilt={14}
                delay={510}
                eager
                className="absolute"
                style={{ left: 'calc(var(--line-end, 100%) - 0.35em)', top: '-0.84em', width: '0.75em' }}
              />
            </h1>

            <p
              style={{ '--i': 1 }}
              className="mt-8 max-w-[46ch] text-[clamp(1.0625rem,1.6vw,1.25rem)] leading-[1.55] text-muted"
            >
              {c.hero.body}
            </p>

            <div style={{ '--i': 2 }} className="mt-10 flex flex-wrap items-center gap-3">
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
            <p style={{ '--i': 3 }} className="mt-6 text-small text-muted">
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
              <Spot name={HERO_ART[0]} tilt={10} delay={700} className="absolute -right-2 -top-[4.75rem] z-[3] w-[4.5rem] sm:-right-6 sm:w-[5.25rem]" />
              {/* Sur un telephone la carte prend toute la largeur pour que ses
                  pastilles tiennent sur une ligne, donc il n'y a plus de bord
                  gauche ou coller le cornichon: il passe au-dessus du coin. */}
              <Spot
                name={HERO_ART[1]}
                tilt={-14}
                delay={820}
                className="absolute -top-[5.1rem] left-2 z-[3] w-[2.9rem] sm:-left-[3.1rem] sm:top-[34%] sm:w-[3.4rem]"
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
            {/* Dans le vide au-dessus de la carte, pas contre un sticker: collee
                au bord de la marguerite, l'etincelle rose se lisait comme un
                defaut de decoupe. */}
            <Sparkle className="absolute left-[46%] top-7 w-6 text-[#FF007A]" />
            <Sparkle className="absolute bottom-24 right-1 w-4 text-[#009DB9]" />
            {/* Une fleche du badge vers le bouton principal, avec une boucle.
                Elle n'a de sens que quand les deux sont cote a cote, donc a
                partir de lg. */}
            <Doodle
              kind="loop"
              className="absolute -left-[7.25rem] bottom-[4.5rem] hidden w-28 text-[#FF007A] lg:block"
              style={{ transform: 'rotate(-4deg)' }}
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
        <WordTape words={[...fun.tape].reverse()} tone="bg-[#009DB9]" tilt={2} />
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
       * EN CARTES DE DEUX TONS: LA TETE AUX COULEURS DU LOGO, LE CORPS EN
       * PASTEL.
       *
       * Elles ont ete pleines de couleur, mesurees trois fois. #111 sur #FF007A
       * 4,98:1 et sur #38BDF8 8,81:1: le ratio passait, et c'etait "très
       * limite, ça donne mal aux yeux". Puis les tons profonds en blanc,
       * #D6006B et #0B6FAD: ce bleu-la n'etait pas celui du logo. Le blanc ne
       * fait que 3,80:1 sur le rose du logo et 3,22:1 sur son turquoise, assez
       * pour un grand titre en gras, pas pour un paragraphe en 14 px. Donc la
       * couleur du logo porte le numero et le titre, a 21 px en gras, et le
       * paragraphe est a l'encre sur le pastel de la meme couleur (plus de
       * 15:1). Chaque carte porte ses couleurs avec ses mots (`head` et
       * `ground` dans landing.js), pour que fond et texte ne se separent
       * jamais.
       *
       * Plus de bord blanc autour: c'etait l'effet sticker sur une chose
       * dessinee en code, et "c'est pas vraiment des stickers". La carte est
       * posee de travers avec son ombre (.lean), et le vrai sticker est celui
       * colle a son coin.
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
              className={`lean relative flex flex-col rounded-[1.75rem] ${item.ground}`}
              style={{ '--tilt': `${PILLAR_TILT[i]}deg` }}
            >
              <div className={`rounded-t-[1.75rem] px-6 pb-5 pt-7 ${item.head}`}>
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-white font-display text-body font-extrabold text-[#111111] [font-variant-numeric:tabular-nums]"
                >
                  {item.n}
                </span>
                {/* text-inherit: la base peint h1, h2 et h3 en encre, et sur le
                    rose et le turquoise le titre resterait noir pendant que la
                    tete de la carte est en blanc. */}
                <h3 className="mt-4 text-[1.3125rem] font-bold leading-snug text-inherit">{item.title}</h3>
              </div>
              <p className="px-6 pb-7 pt-5 text-small leading-relaxed text-[#111111]">{item.body}</p>
              {/* Au coin haut droit, au-dessus de la ligne du numero: le titre
                  commence 88 px sous le haut de la carte, le sticker s'arrete
                  avant. Il deborde de 8 px a droite. Avec le bord blanc de
                  6 px, -right-4 faisait 10; sans lui, -right-4 le poussait
                  hors de l'ecran a 320 px, et -right-2.5 encore d'un pixel en
                  francais, la ou la premiere carte est la plus haute. */}
              <Spot
                name={PILLAR_ART[i]}
                tilt={i % 2 ? -9 : 9}
                className="absolute -right-2 -top-[2.625rem] w-[4.75rem]"
              />
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
              {/* Le monogramme, penche, avec l'ombre de sa propre tuile. Il
                  portait un bord blanc de 6 px pour faire sticker; c'est le
                  logo, pas un sticker, et le bord est parti avec les badges. */}
              <span className="absolute left-1 top-0 inline-flex" style={{ transform: 'rotate(-8deg)' }}>
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
                    <Tape className="-top-3.5 left-6" tilt={-4} tone={i % 2 ? '0 157 185' : '255 0 122'} />
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
