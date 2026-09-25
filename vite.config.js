import { defineConfig } from 'vite'
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

export default defineConfig({
  plugins: [react(), buildStamp()],
  define: { __BUILD_ID__: JSON.stringify(build) },
  build: { outDir: 'dist' },
})
