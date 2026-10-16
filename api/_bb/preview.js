import { escapeHtml, previewLocale } from '../invite-preview.js'

/**
 * GET /api/bb/preview?p=  the link preview of Beauty & Brain.
 *
 * Every path is served the same index.html, whose tags describe Rich &
 * Friends; a crawler runs no JavaScript, so a /bb link pasted in a message
 * showed the R&F card. vercel.json sends the crawlers' user agents here for
 * /bb and /bb/tarifs (like /join/:code to api/invite-preview.js); a person
 * who lands here anyway is sent on to the page.
 */
const ORIGIN = 'https://richandfriends.xyz'
const IMAGE = `${ORIGIN}/brand/bb-og.png`

const COPY = {
  fr: {
    title: 'Beauty & Brain · Pas besoin de choisir.',
    pricing: 'Beauty & Brain · Les tarifs',
    description: 'Ton coach d’étude transforme tes diapos, tes notes et tes anciens examens en questions de niveau examen. Puis 15 minutes par jour jusqu’au jour J. Gratuit pour un cours.',
    open: 'Ouvrir Beauty & Brain',
  },
  en: {
    title: 'Beauty & Brain · You don’t have to pick.',
    pricing: 'Beauty & Brain · Pricing',
    description: 'Your study coach turns your slides, notes and past exams into exam-level questions. Then 15 minutes a day until exam day. Free for one course.',
    open: 'Open Beauty & Brain',
  },
}

export function bbPreviewHtml({ page = '', locale = 'fr' }) {
  const c = COPY[locale] ?? COPY.fr
  const path = page === 'tarifs' ? '/bb/tarifs' : '/bb'
  const url = `${ORIGIN}${path}`
  const t = escapeHtml(page === 'tarifs' ? c.pricing : c.title)
  const d = escapeHtml(c.description)
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Beauty &amp; Brain" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${IMAGE}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="Beauty &amp; Brain" />
<meta property="og:locale" content="${locale === 'en' ? 'en_GB' : 'fr_FR'}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${IMAGE}" />
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${path}">${escapeHtml(c.open)}</a></p>
</body>
</html>`
}

export default function preview(req, res) {
  const locale = previewLocale(req.headers?.['accept-language'])
  const page = req.query?.p === 'tarifs' ? 'tarifs' : ''
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600')
  return res.end(bbPreviewHtml({ page, locale }))
}
