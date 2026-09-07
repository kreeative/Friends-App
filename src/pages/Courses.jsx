import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { COURSES } from '../content/courses'
import {
  COUNTRY_KEY,
  DEFAULT_COUNTRY,
  countryLabel,
  courseBySlug,
  firstLessonOf,
  hasRegions,
  lessonById,
  modulesOf,
  neighbours,
  progressOf,
  safeCountry,
  say,
  variantFor,
} from '../lib/courses'
import { useT } from '../lib/i18n'
import { termsFor } from '../lib/glossary'
import { usePageMeta } from '../lib/pageMeta'
import { Screen, Section, TopBar } from '../components/ui'
import CountryTabs from '../components/CountryTabs'

/**
 * Les cours, dans l'application.
 *
 * UN COMPOSANT POUR TROIS ADRESSES.
 *
 * /cours, /cours/:slug et /cours/:slug/:lessonId. Meme raison que Money, qui
 * sert six chemins: les trois vues lisent exactement les memes donnees, et les
 * separer voudrait dire trois copies de la meme resolution de slug et trois
 * occasions qu'elles ne soient plus d'accord sur ce qu'est une lecon.
 *
 * LES RECTANGLES, EN DEUX TEMPS.
 *
 * Consigne d'origine: "pas des rectangles partout surtout pas un rectangle qui
 * rassemble tout a l'interieur". Puis, en voyant le resultat: "rajoute un peu
 * de rectangle quand meme". Les deux sont vraies ensemble, et la regle qui
 * sort des deux est plus utile que chacune prise seule.
 *
 * Un panneau est rendu quand un bloc est AUTRE CHOSE que de la prose: la
 * promesse en ouverture, le compte a ouvrir en premier, les phrases a dire, le
 * quiz, et la liste de lecons d'un module. Rien ne l'est quand le bloc EST la
 * prose: les trois points cles restent une liste separee par des filets, parce
 * que trois cartes a la suite refont le mur qui a ete refuse.
 *
 * Et rien n'enveloppe la lecon entiere, ce qui est l'autre moitie de la
 * consigne et la seule qui n'a pas bouge.
 */
export default function Courses() {
  const { slug, lessonId } = useParams()
  const navigate = useNavigate()
  const { t, locale } = useT()

  /**
   * La region, par appareil.
   *
   * Comme le theme, et pour la meme raison: elle doit etre lue avant le premier
   * rendu et ne concerne que l'ecran qu'on a dans la main. La mettre sur le
   * profil demanderait une migration, donc du SQL a copier depuis un iPad, pour
   * une preference qui change une fois dans une vie. Si un jour elle doit
   * suivre le compte, c'est une colonne et trois lignes.
   */
  const [country, setCountry] = useState(() => {
    try {
      return safeCountry(localStorage.getItem(COUNTRY_KEY))
    } catch {
      return DEFAULT_COUNTRY
    }
  })

  const pickCountry = (id) => {
    const next = safeCountry(id)
    setCountry(next)
    try {
      localStorage.setItem(COUNTRY_KEY, next)
    } catch {
      /* Navigation privee. Le choix ne survivra pas au rechargement, et c'est
         tout: la page se lit pareil. */
    }
  }

  const course = slug ? courseBySlug(slug) : null
  const lesson = course && lessonId ? lessonById(course, lessonId) : null

  usePageMeta({
    title: `${say(lesson?.title, locale) || say(course?.title, locale) || t('courses.title')} · Rich & Friends`,
  })

  /* Une adresse inventee renvoie a la liste, qui existe toujours, plutot qu'a
     une page blanche. */
  if (slug && !course) return <Redirect to="/cours" navigate={navigate} />
  if (lessonId && !lesson) return <Redirect to={`/cours/${slug}`} navigate={navigate} />

  if (lesson) {
    return (
      <LessonView
        course={course}
        lesson={lesson}
        country={country}
        t={t}
        locale={locale}
        navigate={navigate}
      />
    )
  }

  if (course) {
    return (
      <CourseView
        course={course}
        country={country}
        onPick={pickCountry}
        t={t}
        locale={locale}
        navigate={navigate}
      />
    )
  }

  return <CourseList t={t} locale={locale} />
}

function Redirect({ to, navigate }) {
  useEffect(() => {
    navigate(to, { replace: true })
  }, [to, navigate])
  return null
}

/* --- la liste des cours --------------------------------------------------- */

function CourseList({ t, locale }) {
  return (
    <Screen>
      <TopBar title={t('courses.title')} sub={t('courses.sub')} />

      {/**
       * PLUS DE QUESTION DE REGION ICI.
       *
       * "J'avais demande qu'au debut du cours on te demande ta region pour
       * adapter ton learning." Elle etait posee sur cette liste, avant meme
       * d'avoir choisi un cours, a quelqu'un qui allait peut-etre ouvrir Riche
       * lentement, qui n'en a pas besoin. Elle est posee maintenant en tete du
       * cours qui en depend, et seulement de ceux-la.
       */}

      <Section title={t('courses.available')}>
        <div className="space-y-3">
          {COURSES.map((c) => {
            const p = progressOf(c)
            return (
              <Link
                key={c.slug}
                to={`/cours/${c.slug}`}
                data-hook="course-card"
                /* Le slug sur la carte, comme dans Lectures. Une sonde qui
                   visait nth(1) a attrape le mauvais cours des qu'un
                   troisieme a ete insere avant celui qu'elle cherchait: se
                   reperer par position est exactement ce que CLAUDE.md
                   interdit pour les selecteurs. */
                data-slug={c.slug}
                className="press block rounded-card border border-hairline bg-[rgb(var(--glass-tint)/0.55)] p-5 backdrop-blur-md"
              >
                <span className="block text-h2 font-semibold text-ink">{say(c.title, locale)}</span>
                <span className="mt-2 block max-w-[52ch] text-body text-muted">
                  {say(c.tagline, locale)}
                </span>
                <span className="mt-3 block text-small text-muted">
                  {t('courses.progress', { written: p.written, total: p.total })}
                </span>
              </Link>
            )
          })}
        </div>
      </Section>
    </Screen>
  )
}

/* --- le sommaire d'un cours ----------------------------------------------- */

function CourseView({ course, country, onPick, t, locale, navigate }) {
  const first = firstLessonOf(course)
  const regional = hasRegions(course)

  return (
    <Screen>
      {/* La meme colonne de lecture que la lecon: le sommaire est un texte
          avec des listes, pas un tableau de bord. Voir .reading. */}
      <div className="reading">
      <TopBar
        title={say(course.title, locale)}
        sub={say(course.tagline, locale)}
        back={() => navigate('/cours')}
        backLabel={t('common.back')}
      />

      {/**
       * LA REGION, AU DEBUT DU COURS, ET SEULEMENT DES COURS QUI EN DEPENDENT.
       *
       * Demande telle quelle: "qu'au debut du cours on te demande ta region
       * pour adapter ton learning". C'est ici que la reponse change quelque
       * chose: les lecons par pays sont dans ce cours-ci. Sur Riche lentement,
       * qui est universel, la question n'a rien a adapter et n'est pas posee.
       *
       * Le choix reste par appareil (localStorage), comme avant: le changer
       * ici le change pour tous les cours, ce qui est ce qu'on attend d'une
       * reponse a "ou vis-tu".
       */}
      {regional && (
        <div className="pt-2" data-hook="course-region">
          <p className="eyebrow">{t('courses.where')}</p>
          <CountryTabs value={country} onPick={onPick} className="mt-3" />
          {course.regionAnswers?.[country] && (
            <p className="mt-4 max-w-[46ch] text-body text-muted" data-hook="country-answer">
              {say(course.regionAnswers[country], locale)}
            </p>
          )}
          <p className="mt-2 text-small text-muted">{t('courses.change_anytime')}</p>
        </div>
      )}

      {/**
       * COMMENCER, AVANT LE SOMMAIRE ET PAS APRES.
       *
       * Demande mot pour mot: "un bouton commencer le cours qui t'envoie
       * directement au commencement". Il est en haut parce que c'est la seule
       * position ou il evite le travail qu'il remplace: sous les six modules,
       * il faudrait avoir defile devant toutes les lecons pour le trouver,
       * c'est-a-dire avoir deja fait a la main ce qu'il fait.
       *
       * Le sommaire reste dessous en entier. Le bouton est pour la premiere
       * visite; revenir a la lecon quatre est ce qu'on fait toutes les fois
       * suivantes, et une liste est ce qui sert a ca.
       */}
      {first && (
        <div className={regional ? 'pt-8' : 'pt-2'}>
          <Link
            to={`/cours/${course.slug}/${first.id}`}
            data-hook="course-start"
            data-lesson={first.id}
            className="btn-primary press"
          >
            {t('courses.start')}
            <span aria-hidden="true">→</span>
          </Link>
          <p className="mt-2.5 text-small text-muted" data-hook="course-start-note">
            {t('courses.start_note', { title: say(first.title, locale) })}
          </p>
        </div>
      )}

      {modulesOf(course).map((m) => (
        <Section key={String(m.n)} title={<span data-hook="module-n">{t('courses.module_n', { n: m.n })}</span>}>
          <h3 className="text-h2 font-semibold text-ink">{say(m.title, locale)}</h3>
          {m.intro && (
            <p className="mt-2 max-w-[52ch] text-body text-muted">{say(m.intro, locale)}</p>
          )}

          {/* Un panneau par module, pas un pour toute la page, et pas une carte
              par lecon. Il groupe des cibles tactiles, ce qui est le seul
              travail qu'un rectangle fait mieux qu'un filet: dire ou commence
              et ou finit la liste. */}
          <Panel className="mt-5 px-5 py-1" hook="lesson-list-panel">
          <ul className="divide-y divide-hairline" data-hook="lesson-list">
            {m.lessons.map((l) => (
              <li key={l.id}>
                <Link
                  to={`/cours/${course.slug}/${l.id}`}
                  data-hook="lesson-link"
                  data-state={l.state}
                  className="press flex items-baseline gap-3 py-4"
                >
                  <span className="shrink-0 font-mono text-small text-muted">{l.id}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-semibold text-ink">
                      {say(l.title, locale)}
                    </span>
                    {l.sub && (
                      <span className="mt-0.5 block text-small text-muted">{say(l.sub, locale)}</span>
                    )}
                  </span>
                  {/* Une lecon encore en plan le dit. Masquer les modules non
                      rediges donnerait un cours qui a l'air fini et qui
                      s'arrete sans prevenir. */}
                  {l.state === 'plan' && (
                    <span className="shrink-0 rounded-pill bg-ink/[0.06] px-2.5 py-0.5 text-label font-semibold uppercase tracking-[0.06em] text-muted">
                      {t('courses.state_plan')}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          </Panel>

          {m.action && (
            <p className="mt-5 max-w-[52ch] text-small text-ink">
              <span className="eyebrow block">{t('courses.action')}</span>
              <span className="mt-1 block">{say(m.action, locale)}</span>
            </p>
          )}
        </Section>
      ))}
      </div>
    </Screen>
  )
}

/* --- une lecon ------------------------------------------------------------ */

/**
 * QUATRIEME PASSE SUR CETTE PAGE, ET LA REGLE QUI EN SORT.
 *
 * Les trois premieres, dans l'ordre: "pas de rectangles partout" (page a
 * plat), "rajoute un peu de rectangle quand meme" (verre blanc sur les blocs),
 * "fais une rectangle rose" (tout en panneaux roses). Puis, capture a l'appui
 * sur les blocs jaune et rose de la metaphore et de l'action: "je t'ai dit je
 * veux pas voir cette UI la, trop de rectangles, trop de couleur, surcharge".
 *
 * Chaque passe corrigeait la precedente en ajoutant quelque chose. Celle-ci
 * enleve, et pose une regle plutot qu'un reglage:
 *
 *   LA PROSE EST DU TEXTE. Objectif, points, image, reflexion, action, script:
 *   des paragraphes avec un sur-titre, separes par du blanc. Aucun fond, aucun
 *   filet, aucune couleur. La hierarchie est typographique.
 *
 *   UN RECTANGLE, ET IL EST INTERACTIF. Le quiz est un autre mode, on y
 *   repond, il repond. Il a un contour neutre, et ses options sont des
 *   boutons, donc des cibles, donc des bords.
 *
 *   LA COULEUR DIT UN ETAT, PAS UN GENRE DE BLOC. Vert juste, rouge faux,
 *   rose sur un lien. Une metaphore n'est pas un etat.
 *
 * Ce qui reste des passes precedentes: le corps n'est toujours pas enveloppe
 * dans une seule grande carte, et la region est rappelee sans etre redemandee.
 */
function LessonView({ course, lesson, country, t, locale, navigate }) {
  const { prev, next } = neighbours(course, lesson.id)
  const variant = variantFor(lesson, country)
  const points = variant?.points ?? lesson.points ?? []
  const todo = variant?.todo ?? lesson.todo
  /* Les mots de cette lecon, filtres par la region: le CELI n'a rien a faire
     dans le lexique de quelqu'un en France. Voir src/lib/glossary.js. */
  const terms = termsFor(lesson, course, country)

  return (
    <Screen>
      {/* Une colonne de lecture, centree des que la fenetre est plus large
          qu'elle: voir .reading dans index.css. Les blocs n'ont plus de
          largeur a eux, c'est la colonne qui la porte. */}
      <div className="reading">
      <TopBar
        title={say(lesson.title, locale)}
        sub={say(lesson.sub, locale)}
        back={() => navigate(`/cours/${course.slug}`)}
        backLabel={t('common.back')}
      />

      <div className="pt-2" data-hook="lesson" data-lesson={lesson.id}>
        <p className="font-mono text-small text-muted">
          {t('courses.module_n', { n: lesson.module?.n })} · {lesson.id}
        </p>

        {lesson.state === 'plan' ? (
          <p className="mt-6 max-w-[46ch] text-body text-muted" data-hook="lesson-plan">
            {t('courses.plan_body')}
          </p>
        ) : (
          <>
            {lesson.objective && (
              <Block hook="lesson-objective" label={t('courses.objective')} className="mt-7">
                {say(lesson.objective, locale)}
              </Block>
            )}

            {lesson.universal && (
              <p className="mt-7 text-body text-ink" data-hook="lesson-universal">
                {say(lesson.universal, locale)}
              </p>
            )}

            {/* La region est rappelee, pas redemandee. Une ligne, et le lien
                mene au debut du cours, ou la question est posee. */}
            {lesson.byCountry && (
              <p className="mt-5 text-small text-muted" data-hook="lesson-region">
                {t('courses.showing_region', { region: countryLabel(country, locale) })}{' '}
                <Link
                  to={`/cours/${course.slug}`}
                  className="underline underline-offset-4 hover:text-ink"
                >
                  {t('courses.change_region')}
                </Link>
              </p>
            )}

            {/* Le grail est mis en avant par la graisse, pas par une boite:
                c'est la seule phrase de la lecon qui est en semi-gras sur
                toute sa longueur. */}
            {variant?.grail && (
              <Block
                hook="lesson-grail"
                label={say(lesson.grailLabel, locale) || t('courses.grail')}
                className="mt-8"
                strong
              >
                {say(variant.grail, locale)}
              </Block>
            )}

            <ol className="mt-8 divide-y divide-hairline" data-hook="lesson-points">
              {points.map((p, i) => (
                <li key={say(p.lead)} className="flex gap-4 py-5 first:pt-0">
                  <span className="shrink-0 font-mono text-small text-muted">{i + 1}</span>
                  <span className="max-w-[46ch]">
                    <b className="font-semibold text-ink">{say(p.lead, locale)}</b>{' '}
                    <span className="text-muted">{say(p.body, locale)}</span>
                  </span>
                </li>
              ))}
            </ol>

            {variant?.note && (
              <p className="mt-6 text-body text-ink" data-hook="lesson-note">
                {say(variant.note, locale)}
              </p>
            )}

            {lesson.metaphor && (
              <Block hook="lesson-metaphor" label={t('courses.metaphor')} className="mt-8">
                {say(lesson.metaphor, locale)}
              </Block>
            )}

            {lesson.reflection && (
              <Block hook="lesson-reflection" label={t('courses.reflection')} className="mt-8">
                {say(lesson.reflection, locale)}
              </Block>
            )}

            {lesson.script && (
              <div className="mt-8" data-hook="lesson-script">
                <p className="eyebrow">{t('courses.script')}</p>
                {/* Des phrases a dire: en italique, ouvertes par un guillemet,
                    et rien d'autre. Un bord ou un fond en ferait des cartes,
                    et c'est precisement ce qui a ete refuse. */}
                <div className="mt-3 space-y-4">
                  {lesson.script.map((line) => (
                    <p key={say(line)} className="text-body italic text-ink">
                      « {say(line, locale)} »
                    </p>
                  ))}
                </div>
              </div>
            )}

            {todo && (
              <Block hook="lesson-todo" label={t('courses.action')} className="mt-8">
                {say(todo, locale)}
              </Block>
            )}

            {/* Un lien sortant porte par la variante regionale: pour le Canada,
                le parrainage Wealthsimple demande dans le brief d'origine. La
                phrase dit elle-meme que c'est un parrainage. Le bouton est le
                seul element de la lecon qui quitte l'application, donc il
                s'ouvre a cote et le dit avec une fleche. */}
            {variant?.cta && (
              <div className="mt-6" data-hook="lesson-cta">
                <p className="text-body text-ink">{say(variant.cta.text, locale)}</p>
                <a
                  href={variant.cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="goal-action press mt-3 inline-flex"
                  data-hook="lesson-cta-link"
                >
                  {say(variant.cta.label, locale)} ↗
                </a>
              </div>
            )}

            {/**
             * LES MOTS, A LA FIN DE LA LECON.
             *
             * "Can you add in the module some part where words are explained
             * like inflation etc."
             *
             * A LA FIN ET PAS AU DEBUT. Une liste de definitions en tete
             * demande d'apprendre du vocabulaire avant de savoir a quoi il
             * sert, ce qui est la facon la plus sure de ne pas le retenir. Ici
             * le mot a deja ete rencontre dans une phrase; la definition
             * confirme, elle n'introduit pas.
             *
             * DE LA PROSE, PAS UN RECTANGLE DE PLUS. La regle de la quatrieme
             * passe tient: un seul conteneur par lecon, le quiz. Une liste de
             * definitions est du texte avec un sur-titre, separee par les
             * memes filets que les points de la lecon.
             *
             * Sur la derniere lecon d'un cours, `terms: 'course'` rend tous
             * les mots croises dans le cours: le recap devient le lexique.
             */}
            {terms.length > 0 && (
              <div className="mt-10" data-hook="lesson-terms" data-count={terms.length}>
                <p className="eyebrow">{t('courses.words')}</p>
                <dl className="mt-3 divide-y divide-hairline">
                  {terms.map((w) => (
                    <div key={w.id} className="py-4 first:pt-2" data-hook="term" data-term={w.id}>
                      <dt className="text-body font-semibold text-ink">{say(w.term, locale)}</dt>
                      <dd className="mt-1 max-w-[46ch] text-body text-muted">{say(w.short, locale)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {lesson.quiz && <Quiz items={lesson.quiz} t={t} locale={locale} />}
          </>
        )}

        {/* La navigation traverse les modules: la derniere lecon d'un module
            mene a la premiere du suivant, sans repasser par le sommaire. */}
        <nav className="mt-12 flex flex-wrap gap-3" data-hook="lesson-nav">
          {prev && (
            <Link to={`/cours/${course.slug}/${prev.id}`} className="goal-action press">
              ← {say(prev.title, locale)}
            </Link>
          )}
          {next && (
            <Link to={`/cours/${course.slug}/${next.id}`} className="goal-action press">
              {say(next.title, locale)} →
            </Link>
          )}
        </nav>
      </div>
      </div>
    </Screen>
  )
}

/**
 * Un bloc de prose avec son sur-titre. Du texte, rien autour.
 *
 * C'est ce qui remplace Panel et Marked pour tout ce qui se lit. Le sur-titre
 * est le meme gris que partout ailleurs dans l'application (.eyebrow), pas
 * l'accent: la couleur est reservee aux etats et aux liens, et une image ou
 * une reflexion n'est pas un etat.
 */
function Block({ hook, label, children, className = '', strong = false }) {
  return (
    <div data-hook={hook} className={className}>
      <p className="eyebrow">{label}</p>
      <p className={`mt-1.5 text-body text-ink ${strong ? 'font-semibold' : ''}`}>{children}</p>
    </div>
  )
}

/**
 * Le seul conteneur de la lecon: la feuille de l'application, pas un filet.
 *
 * Il ne sert qu'a deux choses, la liste de lecons d'un module (un groupe de
 * cibles tactiles) et le quiz (un autre mode). Il a ete un contour gris sans
 * fond pendant une version, pour ne pas remettre de couleur; a l'ecran c'etait
 * un formulaire imprime pose sur la page: "perhaps on peut ajouter des
 * shadows". Donc .lg, la meme feuille que les cartes de Lectures, avec son
 * bord blanc et son ombre: un objet pose sur la page, ce que le quiz est.
 *
 * Pas de couleur en plus. Une ombre n'est pas un lavis, et la regle de la
 * quatrieme passe tient: la prose reste du texte, un seul rectangle par lecon,
 * et c'est celui-la.
 */
function Panel({ children, className = '', hook, ...rest }) {
  return (
    <div
      {...rest}
      data-hook={hook}
      data-panel="sheet"
      className={`lg p-5 ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Le quiz, une question a la fois, et on peut le refaire.
 *
 * "Le quiz doit etre interactif, les questions doivent apparaitre une par une,
 * et donner l'option de refaire le quiz."
 *
 * Les trois questions etaient affichees d'un coup, les unes sous les autres.
 * Ca se lit comme un formulaire d'examen: on voit la longueur avant de
 * commencer, et l'oeil file vers la question deux pendant qu'on repond a la
 * une. Une question a l'ecran, c'est une conversation: on repond, il repond,
 * on passe a la suivante.
 *
 * L'explication reste le vrai contenu et apparait des le clic, juste ou faux.
 * A la fin, le score et la liste de ce qui est passe ou pas, puis "Refaire le
 * quiz", qui remet tout a zero. Refaire n'est pas tricher: c'est la seule
 * facon de relire une explication qu'on n'a pas retenue.
 *
 * L'etat n'est pas porte par la couleur seule (1.4.1): coche et croix, et le
 * texte dit quelle lettre etait la bonne.
 */
function Quiz({ items, t, locale }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState({})
  const [done, setDone] = useState(false)

  const total = items.length
  const q = items[i]
  const chosen = picked[i]
  const answered = chosen !== undefined
  const right = Object.entries(picked).filter(([qi, oi]) => items[qi].answer === oi).length

  const retake = () => {
    setPicked({})
    setI(0)
    setDone(false)
  }

  return (
    <Panel className="mt-12" hook="quiz" data-total={total}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow">{t('courses.quiz')}</p>
        {!done && (
          <p className="font-mono text-small text-muted" data-hook="quiz-progress">
            {t('courses.quiz_progress', { n: i + 1, total })}
          </p>
        )}
      </div>

      {done ? (
        <div className="mt-5" data-hook="quiz-done" data-right={right} data-total={total}>
          <p className="text-h2 font-semibold text-ink">
            {t('courses.quiz_score', { right, total })}
          </p>
          <p className="mt-2 max-w-[46ch] text-small text-muted">
            {right === total ? t('courses.quiz_perfect') : t('courses.quiz_review')}
          </p>
          {/* Ce qui est passe et ce qui ne l'est pas, question par question:
              c'est ce qui dit quoi relire avant de refaire. */}
          <ol className="mt-5 divide-y divide-hairline">
            {items.map((it, qi) => {
              const ok = picked[qi] === it.answer
              return (
                <li key={say(it.ask)} className="flex gap-3 py-3 text-small" data-hook="quiz-recap" data-ok={ok ? 'yes' : 'no'}>
                  <span aria-hidden="true" className={`shrink-0 font-mono ${ok ? 'text-green' : 'text-negative'}`}>
                    {ok ? '✓' : '✕'}
                  </span>
                  <span className="min-w-0 flex-1 text-ink">{say(it.ask, locale)}</span>
                </li>
              )
            })}
          </ol>
          <button type="button" onClick={retake} className="goal-action press mt-6" data-hook="quiz-retake">
            {t('courses.quiz_retake')}
          </button>
        </div>
      ) : (
        <div className="mt-5" data-hook="quiz-q" data-index={i}>
          <p className="max-w-[46ch] text-body font-semibold text-ink">
            {i + 1}. {say(q.ask, locale)}
          </p>

          {/* Des tuiles posees, pas des cases dessinees: un fond de surface et
              l'ombre basse de l'application, comme les cartes ailleurs. Le
              bord est transparent au repos, pour que rien ne saute quand il
              se colore, et il ne se colore que pour dire juste ou faux, avec
              la coche et la croix a cote (1.4.1). */}
          <div className="mt-3 space-y-2">
            {q.options.map((opt, oi) => {
              const isRight = oi === q.answer
              const mine = chosen === oi
              const show = answered && (isRight || mine)
              return (
                <button
                  key={say(opt)}
                  type="button"
                  onClick={() => setPicked((p) => ({ ...p, [i]: oi }))}
                  disabled={answered}
                  data-hook="quiz-option"
                  data-right={isRight ? 'yes' : 'no'}
                  className={`press flex w-full items-start gap-3 rounded-inner border px-4 py-3 text-left text-small text-ink shadow-raised ${
                    show && isRight
                      ? 'border-green bg-green/[0.10]'
                      : show
                        ? 'border-negative bg-negative/[0.08]'
                        : 'border-transparent bg-surface'
                  } disabled:cursor-default`}
                >
                  <span aria-hidden="true" className="shrink-0 font-mono">
                    {show ? (isRight ? '✓' : '✕') : String.fromCharCode(65 + oi)}
                  </span>
                  <span className="min-w-0 flex-1">{say(opt, locale)}</span>
                </button>
              )
            })}
          </div>

          {answered && (
            <>
              <p className="mt-3 max-w-[46ch] text-small text-muted" data-hook="quiz-why">
                <b className="font-semibold text-ink">
                  {t('courses.answer_is', { letter: String.fromCharCode(65 + q.answer) })}
                </b>{' '}
                {say(q.why, locale)}
              </p>
              {/* Le bouton n'existe qu'une fois la question repondue: on ne
                  saute pas une question, on la traverse. */}
              <button
                type="button"
                onClick={() => (i + 1 < total ? setI(i + 1) : setDone(true))}
                className="goal-action press mt-4"
                data-hook="quiz-next"
              >
                {i + 1 < total ? t('courses.quiz_next') : t('courses.quiz_finish')} →
              </button>
            </>
          )}
        </div>
      )}
    </Panel>
  )
}
