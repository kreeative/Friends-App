import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { COUNTRY_ANSWERS, COURSES } from '../content/courses'
import {
  COUNTRY_KEY,
  DEFAULT_COUNTRY,
  courseBySlug,
  lessonById,
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
        onPick={pickCountry}
        t={t}
        locale={locale}
        navigate={navigate}
      />
    )
  }

  if (course) return <CourseView course={course} t={t} locale={locale} navigate={navigate} />

  return <CourseList country={country} onPick={pickCountry} t={t} locale={locale} />
}

function Redirect({ to, navigate }) {
  useEffect(() => {
    navigate(to, { replace: true })
  }, [to, navigate])
  return null
}

/* --- la liste des cours --------------------------------------------------- */

function CourseList({ country, onPick, t, locale }) {
  return (
    <Screen>
      <TopBar title={t('courses.title')} sub={t('courses.sub')} />

      {/**
       * L'onboarding, reduit a ce qu'il est vraiment: une question.
       *
       * Elle est ici plutot que sur un ecran a elle, parce qu'un ecran de plus
       * avant le premier cours est un ecran de plus a franchir, et parce que la
       * reponse se voit tout de suite en dessous.
       */}
      <Section title={t('courses.where')}>
        <CountryTabs value={country} onPick={onPick} />
        <p className="mt-4 max-w-[46ch] text-body text-muted" data-hook="country-answer">
          {say(COUNTRY_ANSWERS[country], locale)}
        </p>
        <p className="mt-2 text-small text-muted">{t('courses.change_anytime')}</p>
      </Section>

      <Section title={t('courses.available')}>
        <div className="space-y-3">
          {COURSES.map((c) => {
            const p = progressOf(c)
            return (
              <Link
                key={c.slug}
                to={`/cours/${c.slug}`}
                data-hook="course-card"
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

function CourseView({ course, t, locale, navigate }) {
  return (
    <Screen>
      <TopBar
        title={say(course.title, locale)}
        sub={say(course.tagline, locale)}
        back={() => navigate('/cours')}
        backLabel={t('common.back')}
      />

      {course.modules.map((m) => (
        <Section key={String(m.n)} title={t('courses.module_n', { n: m.n })}>
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
            <p className="mt-5 max-w-[52ch] rounded-inner bg-accent/[0.07] px-4 py-3 text-small text-ink">
              <span className="eyebrow block text-accent">{t('courses.action')}</span>
              <span className="mt-1 block">{say(m.action, locale)}</span>
            </p>
          )}
        </Section>
      ))}
    </Screen>
  )
}

/* --- une lecon ------------------------------------------------------------ */

function LessonView({ course, lesson, country, onPick, t, locale, navigate }) {
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
              <Panel className="mt-6 max-w-[48ch]" hook="lesson-objective">
                <p className="eyebrow">{t('courses.objective')}</p>
                <p className="mt-1.5 text-body text-ink">{say(lesson.objective, locale)}</p>
              </Panel>
            )}

            {lesson.universal && (
              <p className="mt-7 max-w-[46ch] text-body text-ink">{say(lesson.universal, locale)}</p>
            )}

            {/* Les onglets, et l'unique endroit rectangulaire de la lecon. */}
            {lesson.byCountry && (
              <div className="mt-7" data-hook="lesson-country">
                <p className="eyebrow mb-3">{t('courses.your_region')}</p>
                <CountryTabs value={country} onPick={onPick} />
              </div>
            )}

            {variant?.grail && (
              <Panel className="mt-7 max-w-[48ch]" hook="lesson-grail">
                <p className="eyebrow text-accent">{t('courses.grail')}</p>
                <p className="mt-1.5 text-body text-ink">{say(variant.grail, locale)}</p>
              </Panel>
            )}

            <ol className="mt-8 divide-y divide-hairline" data-hook="lesson-points">
              {points.map((p, i) => (
                <li key={say(p.lead)} className="flex gap-4 py-5">
                  <span className="shrink-0 font-mono text-small text-accent">{i + 1}</span>
                  <span className="max-w-[46ch]">
                    <b className="font-semibold text-ink">{say(p.lead, locale)}</b>{' '}
                    <span className="text-muted">{say(p.body, locale)}</span>
                  </span>
                </li>
              ))}
            </ol>

            {variant?.note && (
              <p className="mt-6 max-w-[46ch] text-body text-muted">{say(variant.note, locale)}</p>
            )}

            {lesson.metaphor && (
              <Marked kind="field" label={t('courses.metaphor')} text={say(lesson.metaphor, locale)} hook="lesson-metaphor" />
            )}

            {lesson.reflection && (
              <Marked kind="field" label={t('courses.reflection')} text={say(lesson.reflection, locale)} hook="lesson-reflection" />
            )}

            {lesson.script && (
              <div className="mt-7" data-hook="lesson-script">
                <p className="eyebrow text-accent">{t('courses.script')}</p>
                {/* Chacune dans son panneau: ce sont des phrases a recopier et
                    a dire, pas du texte a lire. Le bord les detache de la
                    prose qui les entoure. */}
                <div className="mt-3 space-y-3">
                  {lesson.script.map((s) => (
                    <Panel key={say(s)} className="max-w-[48ch]">
                      <p className="text-body text-ink">{say(s, locale)}</p>
                    </Panel>
                  ))}
                </div>
              </div>
            )}

            {todo && (
              <Marked kind="accent" label={t('courses.action')} text={say(todo, locale)} hook="lesson-todo" />
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
 * Le panneau de verre, defini une fois.
 *
 * "Rajoute un peu de rectangle quand meme": la premiere version avait tout mis
 * a plat et la lecon etait devenue un long ruban de texte sans relief. Un
 * panneau est donc rendu la ou un bloc est AUTRE CHOSE que de la prose: la
 * promesse en ouverture, le compte a ouvrir, les phrases a dire, le quiz.
 *
 * Les trois points cles n'en recoivent pas, et c'est la limite: trois cartes
 * a la suite feraient exactement le mur de rectangles qui a ete refuse. Ils
 * restent une liste separee par des filets, c'est-a-dire le corps du texte.
 *
 * Le verre est le meme que celui des onglets: remplissage translucide et
 * filet, avec le flou en supplement la ou il y a quelque chose derriere.
 */
function Panel({ children, className = '', hook }) {
  return (
    <div
      data-hook={hook}
      data-panel="glass"
      className={`rounded-card border border-hairline bg-[rgb(var(--glass-tint)/0.55)] p-5 backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Les deux seuls blocs marques de la lecon, et ils ne disent pas la meme chose.
 *
 * Jaune: une image ou une question, quelque chose qui se passe dans ta tete.
 * Rose: quelque chose a faire dehors. Deux couleurs, deux jobs, et rien
 * d'autre sur la page n'est colore, sinon le marquage ne marque plus rien.
 */
function Marked({ kind, label, text, hook }) {
  const field = kind === 'field'
  return (
    <div
      data-hook={hook}
      className={`mt-7 max-w-[46ch] rounded-inner border-l-[3px] px-4 py-3.5 ${
        field ? 'border-field bg-field/[0.28]' : 'border-accent bg-accent/[0.07]'
      }`}
    >
      <p className={`eyebrow ${field ? 'text-ink/70' : 'text-accent'}`}>{label}</p>
      <p className="mt-1.5 text-body text-ink">{text}</p>
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
                            : 'border-hairline bg-[rgb(var(--glass-tint)/0.55)] text-muted'
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
