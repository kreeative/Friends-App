import { SHELVES, safeShelf } from '../lib/shelves'
import { useT } from '../lib/i18n'

/**
 * Les quatre etageres de Lectures, en haut de page.
 *
 * Demande: "barre d'onglets defilante, tout en haut de l'ecran, juste en
 * dessous du titre principal Library", avec [ Courses ] [ Articles ] [ Books ]
 * [ Studies ].
 *
 * DEFILANTE HORIZONTALEMENT, PAS SUR DEUX LIGNES.
 *
 * C'est ce qui a ete demande et c'est aussi ce qui tient: sur un iPhone SE a
 * 320 px les quatre libelles francais ne rentrent pas, et la version qui passe
 * a la ligne fait sauter tout le contenu de 40 px vers le bas selon la langue.
 * Un rail qui defile garde la page a la meme hauteur dans les deux langues et
 * a toutes les largeurs.
 *
 * `snap-x` pour que le defilement s'arrete sur un onglet entier plutot qu'au
 * milieu d'un mot, et un peu de marge a droite pour que le dernier onglet ne
 * colle pas au bord et se voie comme atteignable.
 *
 * L'ETAT N'EST PAS PORTE PAR LA COULEUR SEULE (1.4.1).
 *
 * L'onglet actif a un fond plein, une graisse plus forte que les autres, et
 * aria-selected. Quelqu'un qui ne distingue pas le rose du gris voit quand
 * meme lequel est choisi, et un lecteur d'ecran l'annonce.
 *
 * LE FOND ACTIF EST accent, LE ROSE POP, ET LE RATIO EST ECRIT ICI.
 *
 * Il a ete accent-pressed (#D6006B) pendant une version, parce que la sonde,
 * qui lit les pixels peints, avait mesure blanc sur #FF007A a 3,80:1 sur un
 * libelle de 14 px, sous les 4,5:1 d'un texte normal (WCAG 1.4.3). Le cran
 * plus fonce passait a 5,16:1 et a ete vu tout de suite: "on a dit qu'on
 * prenait le rose pop et plus jamais ce rose". C'est le rose vin que la
 * palette avait deja banni, revenu par la porte du contraste.
 *
 * Donc le meme rose que tout le reste. .btn-primary, .chip-accent et
 * CountryTabs sont du blanc sur #FF007A, et la decision de ce rose, avec son
 * cout, est ecrite une fois dans index.css a cote de --c-accent. Un onglet
 * d'une autre teinte n'etait pas plus accessible, il etait incoherent.
 * Mesure a nouveau ici: 3,80:1 sur sun, 5,40:1 sur sea, ou le bleu du theme
 * tient le blanc. Si le plancher de 4,5 doit un jour etre tenu sur ce
 * libelle, le changement est --c-on-accent et pas la teinte: l'encre sur ce
 * rose mesure 4,6:1.
 *
 * DES LIENS, PAS DES BOUTONS.
 *
 * L'etagere vit dans la query string, donc un onglet EST une adresse. Un
 * bouton qui appelle setState casserait le bouton retour du telephone, qui
 * quitterait la page au lieu de revenir a l'onglet d'avant, et empecherait
 * d'envoyer un lien vers les livres.
 */
export default function ShelfTabs({ value, onPick, counts = {} }) {
  const { t } = useT()
  const active = safeShelf(value)

  return (
    <div
      data-hook="library-tabs"
      role="tablist"
      aria-label={t('nav.library')}
      /* -mx-* puis px-* : le rail deborde jusqu'aux bords de l'ecran pour que
         le defilement parte du bord, mais les onglets restent alignes sur la
         meme marge que le titre au repos. */
      className="-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6"
    >
      {SHELVES.map((id) => {
        const on = id === active
        const n = counts[id]
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            data-shelf={id}
            data-on={on ? 'yes' : 'no'}
            onClick={() => onPick(id)}
            className={`press shrink-0 snap-start rounded-pill border px-4 py-2 text-small transition-colors ${
              on
                ? 'border-accent bg-accent font-bold text-on-accent'
                : 'border-hairline bg-[rgb(var(--glass-tint)/0.55)] font-semibold text-muted hover:text-ink'
            }`}
          >
            {t(`library.tab_${id}`)}
            {/* Le compteur dit s'il y a quelque chose avant qu'on touche.
                Masque quand il vaut zero: "Etudes 0" est une promesse vide, et
                l'onglet sans chiffre se lit comme "on verra". */}
            {n > 0 && (
              <span
                aria-hidden="true"
                /* Plein et pas a 75%: le compteur est de l'information, pas de
                   la decoration, et aria-hidden veut dire que seuls les yeux
                   l'ont. Une opacite reduite sur le fond actif retombait sous
                   4,5:1 alors que le libelle a cote passait. */
                className={`ml-1.5 font-mono text-label ${on ? 'text-on-accent' : 'text-muted'}`}
              >
                {n}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
