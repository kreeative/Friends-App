/**
 * Un anneau qui se remplit, avec le pourcentage au milieu.
 *
 *   "quand tu vas checker le goal sur une vue tu vois comme un pourcentage de
 *    progression"
 *
 * Sur la carte d'un objectif a etapes, et en plus grand sur sa fiche. Le
 * chiffre est ecrit au centre, donc l'anneau n'est jamais le seul a dire
 * l'avancement (1.4.1), et la ligne "3 sur 7 faites" a cote le redit en
 * toutes lettres.
 *
 * PAS DE BOUT ROND A ZERO. Un linecap rond sur un tiret de longueur nulle
 * peint quand meme un point (voir le CLAUDE.md), et un anneau a zero pour
 * cent qui montre un point a midi a l'air d'etre a trois pour cent. Le bout
 * est carre tant qu'il n'y a rien a arrondir.
 */
export default function ProgressRing({ pct = 0, size = 44, stroke = 4, label, className = '' }) {
  const p = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${p}%`}
      data-hook="progress-ring"
      data-pct={p}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-ink) / 0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgb(var(--c-accent))"
          strokeWidth={stroke}
          strokeLinecap={p > 0 ? 'round' : 'butt'}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p / 100)}
          className="transition-[stroke-dashoffset] duration-500 ease-settle"
        />
      </svg>
      <span
        className={`absolute font-semibold text-ink [font-variant-numeric:tabular-nums] ${size >= 60 ? 'text-body' : 'text-[0.6875rem]'}`}
      >
        {p}%
      </span>
    </span>
  )
}
