/**
 * Environment variables, read by intent rather than by one exact name.
 *
 * Vercel would not accept `SUPABASE_SERVICE_ROLE_KEY` as a name in this
 * project, so the key is stored there as `service_role`. That is a perfectly
 * reasonable thing for a hosting dashboard to refuse and a terrible thing for
 * a deployment to fail on silently, so each variable gets a list of names it
 * may legitimately be under and the first one that is actually set wins.
 *
 * Order matters: the canonical name is first, so a project that *can* use it
 * is unaffected and there is no ambiguity about which one is authoritative.
 */
const NAMES = {
  serviceRole: [
    'SUPABASE_SERVICE_ROLE_KEY',
    'service_role',
    'SERVICE_ROLE',
    'SUPABASE_SERVICE_KEY',
  ],
  supabaseUrl: ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'supabase_url'],
  stripeSecret: ['STRIPE_SECRET_KEY', 'stripe_secret_key'],
  stripeWebhook: ['STRIPE_WEBHOOK_SECRET', 'stripe_webhook_secret'],
  siteUrl: ['SITE_URL', 'PUBLIC_SITE_URL'],

  /* Plaid. Same treatment as the others: the dashboard may have refused a
     name, so each has a list and the canonical one is first.

     NONE of these is a VITE_ variable, and that is the point. Vite inlines
     every VITE_ name into the bundle it ships to the browser, so naming the
     secret VITE_PLAID_SECRET would publish a bank credential to every visitor
     of the site. If one of these ever needs to be read in src/, the answer is
     that it does not: the browser gets a link_token and nothing else. */
  plaidClientId: ['PLAID_CLIENT_ID', 'plaid_client_id'],
  plaidSecret: ['PLAID_SECRET', 'plaid_secret'],
  /* sandbox | production. Defaulted at the call site rather than here, so a
     missing value is a deliberate choice of sandbox and not a silent one. */
  plaidEnv: ['PLAID_ENV', 'plaid_env'],
}

/** The value, or undefined. Empty strings count as unset. */
export function env(key) {
  for (const name of NAMES[key] ?? [key]) {
    const v = process.env[name]
    if (v) return v
  }
  return undefined
}

/**
 * Which of the required things are missing, reported using the name a person
 * would recognise. Returning the whole accepted list would be noise; naming
 * only the canonical one and letting the alternatives work quietly is the
 * behaviour that makes a misconfigured deployment fixable in one read.
 */
export function missingEnv(keys) {
  return keys.filter((k) => !env(k)).map((k) => (NAMES[k] ?? [k])[0])
}
