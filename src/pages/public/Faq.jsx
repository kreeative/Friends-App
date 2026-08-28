import { FAQ, faqItems } from '../../content/faq'
import { useT } from '../../lib/i18n'
import { usePageMeta } from '../../lib/pageMeta'

/**
 * L'aide, lisible avec ou sans compte.
 *
 * POURQUOI DES <details> ET PAS UNE LISTE DEROULEE.
 *
 * Le probleme d'origine etait deux paves de six lignes au-dessus d'un bouton :
 * du texte qu'on saute parce qu'il y en a trop d'un coup. Recopier ces paves
 * ici, les uns sous les autres, referait le meme mur, plus long.
 *
 * Donc chaque question est un titre qu'on ouvre. La page entiere se parcourt
 * en une ecran, et on ne lit que la reponse qu'on est venu chercher. C'est le
 * meme choix que le "ce que ce chiffre veut dire" de la fiche de rang.
 *
 * <details> plutot qu'un useState : l'ouvert et le ferme sont un etat du
 * document, la touche entree et la recherche du navigateur marchent sans qu'on
 * ecrive quoi que ce soit, et une question ouverte reste ouverte a l'impression.
 */
export default function Faq() {
  const { locale } = useT()
  const c = FAQ[locale] ?? FAQ.en

  /* Depuis le contenu de la page et la langue du lecteur, comme How et About,
     plutot qu'une table de chaines anglaises ailleurs qui derivera a la
     premiere modification de cette copie. */
  usePageMeta({
    title: `${c.title} · Rich & Friends`,
    description: `${c.lede} ${faqItems(locale).slice(0, 3).map((i) => i.q).join(' ')}`,
  })

  return (
    <section className="mx-auto w-full max-w-3xl animate-rise px-6 pb-20 pt-10 md:pt-14">
      <header className="panel p-8 md:p-11">
        <p className="eyebrow">{c.eyebrow}</p>
        <h1 className="display mt-4 text-[clamp(2rem,5.5vw,3rem)]">{c.title}</h1>
        <p className="lede mt-5 max-w-[52ch]">{c.lede}</p>
      </header>

      {c.groups.map((group) => (
        <section key={group.id} className="mt-12" data-faq-group={group.id}>
          <h2 className="text-h2 font-semibold text-ink">{group.title}</h2>

          <ul className="mt-5 space-y-3">
            {group.items.map((item) => (
              <li key={item.q}>
                <details className="panel group px-6 py-1" data-faq="">
                  <summary
                    className="press flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-body font-semibold text-ink [&::-webkit-details-marker]:hidden"
                  >
                    {item.q}
                    {/* Un chevron dessine plutot qu'un caractere : le glyphe
                        change de forme selon la police installee, et celui-ci
                        tourne. aria-hidden parce que <details> annonce deja
                        son etat, et le repeter le ferait dire deux fois. */}
                    <svg
                      viewBox="0 0 20 20"
                      className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180"
                      aria-hidden="true"
                    >
                      <path
                        d="M5 8l5 5 5-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </summary>

                  <div className="border-t border-hairline pb-5 pt-4">
                    {item.a.map((para) => (
                      <p key={para.slice(0, 24)} className="lede mt-3 text-small first:mt-0">
                        {para}
                      </p>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}
