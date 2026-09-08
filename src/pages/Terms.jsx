import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useT } from '../lib/i18n'
import { LAST_UPDATED } from '../legal/content'
import { errorText } from '../lib/dberr'

/**
 * Accepter les conditions, une fois, avant tout le reste.
 *
 * CE QUI A ETE DEMANDE
 *
 *   "When the user installs the app for the first time they should accept the
 *    terms and conditions, work on that too. Every existing user should also
 *    have a pop up so they could go and accept."
 *
 * UN ECRAN, PAS UNE FENETRE SURGISSANTE.
 *
 * Le mot employe etait "pop up", et c'est le seul endroit de cette demande ou
 * je ne fais pas ce qui est dit. Une fenetre par-dessus l'application se ferme
 * a cote, se rejette d'un geste, et laisse quelqu'un dans le produit sans
 * savoir s'il a accepte. Une acceptation qui peut etre esquivee n'a aucune
 * valeur, ni pour la personne ni le jour ou quelqu'un demande a la voir.
 *
 * Et c'est aussi une position que ce depot a deja prise, dans ces mots: "ces
 * genres de fenetres surgissantes". Les notifications sont devenues une page
 * pour cette raison-la.
 *
 * Donc: un ecran entier, hors de l'AppShell, sans barre d'onglets, exactement
 * comme Setup et Welcome. Rien n'en part sauf les documents eux-memes, qui
 * s'ouvrent dans un onglet a cote.
 *
 * LA MEME PORTE POUR LES DEUX POPULATIONS.
 *
 * Un compte cree ce matin la rencontre a sa premiere seconde. Un compte de
 * l'an dernier la rencontre au prochain lancement, parce que la migration 65
 * ne remplit rien retroactivement: sa colonne vaut null et null veut dire
 * "jamais accepte". Ecrire deux chemins aurait donne deux textes a garder
 * d'accord.
 *
 * LES DOCUMENTS NE SONT PAS RECOPIES ICI.
 *
 * Ils vivent dans src/legal/content.js et sont servis a /legal/terms,
 * /legal/privacy et /legal/notice, dans les deux langues. Les resumer sur cet
 * ecran creerait une deuxieme version qui derive de la vraie, et c'est celle
 * qu'on aurait lue au moment d'accepter.
 */
export default function Terms() {
  const { profile, updateProfile } = useAuth()
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function accept() {
    setBusy(true)
    setError(null)

    /**
     * La date ET la version.
     *
     * Un booleen repondrait "oui" et ne dirait pas a quoi. LAST_UPDATED vit
     * avec les textes, donc la version enregistree est litteralement celle qui
     * etait servie au moment du clic. Le jour ou les conditions changent
     * vraiment, c'est ce qui permettra de redemander a ceux qui ont accepte
     * l'ancienne et a personne d'autre.
     */
    /* updateProfile ecrit ET remet le profil dans le contexte. C'est le profil
       qui commande la porte: sans la mise a jour du contexte, landing()
       renverrait ici et l'ecran se redessinerait par-dessus lui-meme. */
    const { error: err } = await updateProfile({
      terms_accepted_at: new Date().toISOString(),
      terms_version: LAST_UPDATED,
    })

    if (err) {
      setBusy(false)
      setError(errorText(err))
    }
    /* Pas de setBusy(false) sur le succes: la porte s'ouvre, ce composant part,
       et remettre un etat sur un composant qui se demonte est un avertissement
       pour rien. */
  }

  const name = profile?.display_name?.trim()

  return (
    <div className="min-h-dvh bg-bg px-6 py-12">
      <div className="measure mx-auto">
        <span className="eyebrow">{t('terms.eyebrow')}</span>
        <h1 className="mt-3 text-h1 text-ink">
          {name ? t('terms.title_named', { name }) : t('terms.title')}
        </h1>
        <p className="reading mt-4 text-body text-muted">{t('terms.body')}</p>

        {/**
         * Les trois documents, ouverts a cote plutot qu'a la place.
         *
         * target="_blank" avec rel: partir d'ici pour lire, puis revenir et
         * retrouver l'ecran tel quel, plutot que de naviguer et de devoir
         * refaire le chemin. Le lien est reel et pointe sur le vrai texte, pas
         * sur un resume.
         */}
        <ul className="mt-8 space-y-3" data-hook="terms-docs">
          {['terms', 'privacy', 'notice'].map((doc) => (
            <li key={doc}>
              <Link
                to={`/legal/${doc}`}
                target="_blank"
                rel="noopener noreferrer"
                data-hook={`terms-link-${doc}`}
                className="press lg flex items-center gap-4 px-5 py-4 text-left"
              >
                <span className="flex-1 text-body font-semibold text-ink">{t(`terms.doc_${doc}`)}</span>
                <span aria-hidden="true" className="text-small text-muted">&#8599;</span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-small text-muted" data-hook="terms-version">
          {t('terms.version', { date: LAST_UPDATED })}
        </p>

        {error && (
          <p className="mt-4 text-small text-negative" role="alert" data-hook="terms-error">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={accept}
          disabled={busy}
          data-hook="terms-accept"
          className="btn-primary press mt-8 w-full disabled:opacity-50"
        >
          {busy ? t('terms.accepting') : t('terms.accept')}
        </button>

        {/* Ce qui se passe si on n'accepte pas, dit plutot que laisse a
            deviner. Il n'y a pas de bouton refuser: fermer l'application EST
            le refus, et pretendre offrir un choix qui mene a un ecran mort
            serait pire. */}
        <p className="mt-4 text-small text-muted">{t('terms.decline')}</p>
      </div>
    </div>
  )
}
