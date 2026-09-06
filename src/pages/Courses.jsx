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

  return (
    <Screen>
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
              <p className="mt-7 max-w-[48ch] text-body text-ink" data-hook="lesson-universal">
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

            <ol className="mt-8 max-w-[48ch] divide-y divide-hairline" data-hook="lesson-points">
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
              <p className="mt-6 max-w-[48ch] text-body text-ink" data-hook="lesson-note">
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
              <div className="mt-8 max-w-[48ch]" data-hook="lesson-script">
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
    <div data-hook={hook} className={`max-w-[48ch] ${className}`}>
      <p className="eyebrow">{label}</p>
      <p className={`mt-1.5 text-body text-ink ${strong ? 'font-semibold' : ''}`}>{children}</p>
    </div>
  )
}

/**
 * Le seul conteneur de la lecon: un contour neutre, pas un lavis.
 *
 * Il ne sert plus qu'a deux choses, la liste de lecons d'un module (un groupe
 * de cibles tactiles) et le quiz (un autre mode). Un filet suffit a dire "ceci
 * est un ensemble"; le rose en plus disait "ceci est important" a chaque bloc,
 * donc a aucun.
 */
function Panel({ children, className = '', hook }) {
  return (
    <div
      data-hook={hook}
      data-panel="neutral"
      className={`rounded-card border border-hairline p-5 ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Le quiz, qui repond avant d'etre note.
 *
 * L'explication est le vrai contenu: un quiz dont on sort en sachant seulement
 * qu'on a eu faux n'apprend rien a personne. Elle apparait donc des le clic,
 * juste et faux confondus, et la bonne reponse est toujours marquee.
 *
 * L'etat n'est pas porte par la couleur seule (1.4.1): la bonne reponse gagne
 * une coche, la mauvaise une croix, et le texte de l'explication dit laquelle
 * etait la bonne.
 */
function Quiz({ items, t, locale }) {
  const [picked, setPicked] = useState({})

  /* Le quiz est un autre mode: on repond, il repond. Un panneau le dit avant
     qu'on ait lu la premiere question. */
  return (
    <Panel className="mt-12 max-w-[48ch]" hook="quiz">
      <p className="eyebrow">{t('courses.quiz')}</p>

      <div className="mt-6 space-y-9">
        {items.map((q, qi) => {
          const chosen = picked[qi]
          const answered = chosen !== undefined
          return (
            <div key={say(q.ask)} data-hook="quiz-q">
              <p className="max-w-[46ch] text-body font-semibold text-ink">
                {qi + 1}. {say(q.ask, locale)}
              </p>

              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => {
                  const right = oi === q.answer
                  const mine = chosen === oi
                  const show = answered && (right || mine)
                  return (
                    <button
                      key={say(opt)}
                      type="button"
                      onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                      disabled={answered}
                      data-hook="quiz-option"
                      data-right={right ? 'yes' : 'no'}
                      className={`press flex w-full items-start gap-3 rounded-inner border px-4 py-3 text-left text-small ${
                        show && right
                          ? 'border-green bg-green/[0.10] text-ink'
                          : show
                            ? 'border-negative bg-negative/[0.08] text-ink'
                            : 'border-hairline text-ink'
                      } disabled:cursor-default`}
                    >
                      <span aria-hidden="true" className="shrink-0 font-mono">
                        {show ? (right ? '✓' : '✕') : String.fromCharCode(65 + oi)}
                      </span>
                      <span className="min-w-0 flex-1">{say(opt, locale)}</span>
                    </button>
                  )
                })}
              </div>

              {answered && (
                <p className="mt-3 max-w-[46ch] text-small text-muted" data-hook="quiz-why">
                  <b className="font-semibold text-ink">
                    {t('courses.answer_is', { letter: String.fromCharCode(65 + q.answer) })}
                  </b>{' '}
                  {say(q.why, locale)}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
