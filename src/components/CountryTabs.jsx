import { COUNTRIES } from '../content/courses'

/**
 * Choisir sa region, une fois, pour tout le cours.
 *
 * DEMANDE MOT POUR MOT: "les rectangles leger glassmorphisme mais pas des
 * rectangles partout surtout pas un rectangle qui rassemble tout a
 * l'interieur".
 *
 * Donc ce composant est le SEUL endroit rectangulaire de l'ecran de lecon.
 * Le reste du texte est pose sur la page, separe par des filets. Aucune carte
 * n'enveloppe la lecon.
 *
 * CE QUI FAIT REELLEMENT LE VERRE ICI, ET CE QUI N'Y FAIT RIEN.
 *
 * backdrop-filter floute ce qu'il y a DERRIERE. Sur un fond plat il rend ce
 * meme fond plat, c'est-a-dire rien du tout, et c'est ecrit dans les gotchas du
 * depot. Le flou est quand meme la, parce que ces pages ont des autocollants et
 * un degrade derriere elles a certains endroits et qu'il paie a ces
 * endroits-la. Mais ce qui rend l'onglet visible partout ailleurs, c'est le
 * remplissage blanc translucide et le filet, pas le flou.
 *
 * L'etat n'est jamais porte par la couleur seule (1.4.1): l'onglet choisi a un
 * fond plein, une graisse plus forte, et aria-pressed.
 */
export default function CountryTabs({ value, onPick, className = '' }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} data-hook="country-tabs">
      {COUNTRIES.map((c) => {
        const on = c.id === value
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            aria-pressed={on}
            data-country={c.id}
            data-on={on ? 'yes' : 'no'}
            className={`press rounded-inner border px-3.5 py-2 text-small font-semibold backdrop-blur-md transition-colors ${
              on
                ? 'border-accent bg-accent text-on-accent'
                : 'border-hairline bg-[rgb(var(--glass-tint)/0.55)] text-muted hover:text-ink'
            }`}
          >
            <span aria-hidden="true" className="mr-1.5">
              {c.flag}
            </span>
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
