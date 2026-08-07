/**
 * The crew.
 *
 * Hand-drawn as SVG rather than shipped as PNGs, for three reasons: they
 * stay sharp at any size, they weigh a few kB instead of a few hundred, and
 * the skin tones and garment colours are props rather than baked pixels — so
 * a character can be recoloured without a round trip to a drawing tool.
 *
 * The style is the Abidjan streetwear vocabulary from the reference sheets:
 * one heavy black contour, flat fills with no gradients or shading, faces
 * built from half-lidded eyes and a heavy brow, and hair carrying most of
 * the silhouette. Nobody is smiling. That is the look — these are people who
 * are unimpressed with you, which is the correct posture for a wall of
 * characters watching you sign in.
 */

const INK = '#141216'

/* Skin, warm to deep. Named rather than indexed so a character reads as a
   choice in the markup instead of as a number. */
const SKIN = {
  amber: '#C68642',
  clay: '#A9714B',
  cocoa: '#8D5524',
  espresso: '#5C3A21',
}

/**
 * A closed bumpy ring — the afro, and the basis of the twists.
 *
 * Generated rather than hand-authored, because the alternative is a group of
 * overlapping circles, and overlapping stroked circles show every internal
 * seam. This produces ONE contour, which is the whole point of the style.
 *
 * Each bump is an arc between two adjacent points on a circle, bulging
 * outward. Bump radius is set from the chord so the lobes stay tangent
 * instead of pinching.
 */
function bumpyCircle(cx, cy, r, bumps) {
  const step = (Math.PI * 2) / bumps
  const chord = 2 * r * Math.sin(step / 2)
  const br = chord * 0.62
  const pt = (i) => [
    (cx + r * Math.cos(i * step - Math.PI / 2)).toFixed(2),
    (cy + r * Math.sin(i * step - Math.PI / 2)).toFixed(2),
  ]

  let [x0, y0] = pt(0)
  let d = `M${x0} ${y0}`
  for (let i = 1; i <= bumps; i += 1) {
    const [x, y] = pt(i % bumps)
    d += `A${br.toFixed(2)} ${br.toFixed(2)} 0 0 1 ${x} ${y}`
  }
  return `${d}Z`
}

const AFRO_D = bumpyCircle(60, 47, 46, 11)
const TWISTS_D = bumpyCircle(60, 46, 44, 16)

/** The face, minus hair — every character is this plus a silhouette. */
function Face({ skin, mouth = 'flat', browTilt = 5 }) {
  return (
    <>
      {/* ears first, so the head contour draws over their inner edge */}
      <ellipse cx="16" cy="64" rx="7.5" ry="10" fill={skin} stroke={INK} strokeWidth="3.5" />
      <ellipse cx="104" cy="64" rx="7.5" ry="10" fill={skin} stroke={INK} strokeWidth="3.5" />

      <path
        d="M60 18c25 0 41 17 41 42 0 29-18 47-41 47S19 89 19 60c0-25 16-42 41-42z"
        fill={skin}
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* Brows do the whole expression. Tilted down toward the nose reads as
          unimpressed; the eyes underneath barely change. */}
      <path
        d={`M31 ${47 + browTilt}L53 45`}
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      <path
        d={`M89 ${47 + browTilt}L67 45`}
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
      />

      {[36, 84].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="60" rx="11" ry="8.5" fill="#fff" stroke={INK} strokeWidth="3" />
          {/* the heavy upper lid — the half-lidded look is all of it */}
          <path d={`M${cx - 11} 60A11 8.5 0 0 1 ${cx + 11} 60Z`} fill={INK} />
          <circle cx={cx} cy="63" r="3.2" fill={INK} />
        </g>
      ))}

      <path d="M60 66v10" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />

      {mouth === 'flat' && (
        <path
          d="M45 88q15-7 30 0q-15 9-30 0z"
          fill="#C97C87"
          stroke={INK}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
      )}
      {mouth === 'teeth' && (
        <g>
          <path
            d="M44 84q16-6 32 0v8q-16 8-32 0z"
            fill="#7A3B44"
            stroke={INK}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M47 85h26v5H47z" fill="#fff" />
          <path d="M56 85v5M65 85v5" stroke={INK} strokeWidth="2" />
        </g>
      )}
      {mouth === 'grill' && (
        <g>
          <path
            d="M44 84q16-6 32 0v8q-16 8-32 0z"
            fill="#7A3B44"
            stroke={INK}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M47 85h26v5H47z" fill="#F8CB02" />
          <path d="M56 85v5M65 85v5" stroke={INK} strokeWidth="2" />
        </g>
      )}
    </>
  )
}

/**
 * Big round afro, drawn BEHIND the face so it reads as volume the head sits
 * inside. Drawn in front — which is where it was — it becomes a fringe.
 */
function Afro({ colour = '#2A2027' }) {
  return <path d={AFRO_D} fill={colour} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
}

/** Short twists: the same ring, more lobes and tighter. */
function Twists({ colour = '#E8873B' }) {
  return <path d={TWISTS_D} fill={colour} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
}

/**
 * Locs. The strands have to fall past the jaw to read as locs rather than as
 * earrings, so they run the full height of the face and sit behind it.
 */
function Locs({ colour = '#241C22', tips = '#C0392B' }) {
  return (
    <g>
      {[
        [12, 34, 62],
        [24, 22, 70],
        [96, 22, 70],
        [108, 34, 62],
      ].map(([x, y, h], i) => (
        <g key={i}>
          <rect
            x={x - 7}
            y={y}
            width="14"
            height={h}
            rx="7"
            fill={colour}
            stroke={INK}
            strokeWidth="3.5"
          />
          <path
            d={`M${x - 7} ${y + h - 12}v5a7 7 0 0 0 14 0v-5z`}
            fill={tips}
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </g>
      ))}
      <path
        d="M60 6c25 0 40 15 40 34 0 6-1 11-3 15-4-14-11-22-21-25-11 8-33 9-45 2-6 5-10 13-11 23-2-4-3-9-3-15C17 21 35 6 60 6z"
        fill={colour}
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </g>
  )
}

/** Bandana with hand-lettering, from the sheet. */
function Bandana({ colour = '#F3E2B8', word = 'FREE' }) {
  return (
    <g>
      <path
        d="M60 6c22 0 38 13 40 30-13 6-27 9-40 9s-27-3-40-9C22 19 38 6 60 6z"
        fill={colour}
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <text
        x="60"
        y="30"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill={INK}
        style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: '0.06em' }}
      >
        {word}
      </text>
    </g>
  )
}

/** Cap worn backwards: dome in front of the head, bill out to one side. */
function Cap({ colour = '#1B58D9' }) {
  return (
    <g>
      {/* the bill, pointing back — the whole reason it reads as backwards */}
      <path
        d="M22 32c-11 1-17 5-17 9 0 3 5 5 14 5h11z"
        fill={colour}
        stroke={INK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M60 6c22 0 37 14 38 32-12 5-24 7-38 7s-26-2-38-7C23 20 38 6 60 6z"
        fill={colour}
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="9" r="5" fill={colour} stroke={INK} strokeWidth="3.5" />
    </g>
  )
}

/**
 * back  goes behind the face — volume the head sits inside
 * front goes over it — anything worn on the head
 */
const CAST = {
  afro: { skin: SKIN.cocoa, mouth: 'teeth', back: <Afro colour="#E8873B" />, tilt: 6 },
  locs: { skin: SKIN.clay, mouth: 'flat', back: <Locs />, tilt: 4 },
  free: { skin: SKIN.espresso, mouth: 'grill', front: <Bandana />, tilt: 7 },
  cap: { skin: SKIN.amber, mouth: 'flat', front: <Cap />, tilt: 5 },
  twists: { skin: SKIN.cocoa, mouth: 'teeth', back: <Twists />, tilt: 3 },
  crown: { skin: SKIN.clay, mouth: 'grill', back: <Afro colour="#241C22" />, tilt: 8 },
}

export const CREW = Object.keys(CAST)

/**
 * @param who   a key of CAST
 * @param size  rendered width in px; the art is square
 */
export default function Character({ who = 'afro', size = 120, className = '', style }) {
  const c = CAST[who] ?? CAST.afro
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      style={style}
      role="img"
      aria-hidden="true"
    >
      {c.back}
      <Face skin={c.skin} mouth={c.mouth} browTilt={c.tilt} />
      {c.front}
    </svg>
  )
}
