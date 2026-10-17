import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * LE NUMERO DE LA CONSTRUCTION, ET POURQUOI L'APPLICATION LE CONNAIT.
 *
 *   "Where is the period thing, I don't see it, did you publish it?"
 *   "Okay now update the website app."
 *
 * Le deploiement etait a chaque fois passe. Ce qui ne passait pas, c'est le
 * telephone: une application installee sur l'ecran d'accueil n'est pas
 * rechargee quand on y revient, iOS la reveille la ou elle en etait, et elle
 * peut tourner sur le paquet de la semaine derniere pendant des jours. Le
 * service worker ne met rien en cache, expres (voir public/sw.js), donc un
 * VRAI rechargement prend toujours la nouvelle version; mais rien ne
 * provoquait ce rechargement.
 *
 * Donc chaque construction porte un numero. Il est grave dans le paquet
 * (`__BUILD_ID__`) et ecrit a cote dans `version.json`. Quand on revient sur
 * l'application, elle compare les deux (src/components/UpdateWatch.jsx) et se
 * recharge si le serveur a avance.
 *
 * Sur Vercel le numero est le commit, ce qui le rend lisible dans un rapport
 * de bug. En local c'est l'heure, pour que deux constructions successives
 * different et que la sonde puisse le verifier.
 */
const build =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || process.env.BUILD_ID || Date.now().toString(36)

/* `version.json` est emis DANS le paquet plutot que pose dans public/: un
   fichier qu'on oublie de regenerer dirait "rien de neuf" pour toujours, et
   c'est exactement la panne que ce mecanisme existe pour eviter. */
function buildStamp() {
  return {
    name: 'build-stamp',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build }) })
    },
  }
}

/**
 * LA CLE PUBLIQUE DE STRIPE, ET RIEN D'AUTRE.
 *
 * VITE_STRIPE_PUBLISHABLE_KEY est ecrite dans le paquet que lit chaque
 * visiteur: c'est voulu pour une cle pk_, publique par construction, qui
 * ouvre le formulaire de paiement sur notre page (src/lib/stripeEmbed.js).
 * Une cle secrete collee la par erreur serait publiee de la meme facon, sans
 * erreur et avec un site qui marche. Donc la construction s'arrete, et le
 * message ne repete pas la valeur.
 */
function publishableOnly(env) {
  const pk = env.VITE_STRIPE_PUBLISHABLE_KEY
  if (pk && !/^pk_(test|live)_/.test(pk)) {
    throw new Error(
      'VITE_STRIPE_PUBLISHABLE_KEY must be a publishable key (pk_test_ or pk_live_). Anything else there would be published to every visitor, so the build stops.',
    )
  }
}

export default defineConfig(({ mode }) => {
  publishableOnly(loadEnv(mode, process.cwd(), 'VITE_'))
  return {
    plugins: [react(), buildStamp()],
    define: { __BUILD_ID__: JSON.stringify(build) },
    build: { outDir: 'dist' },
  }
})
