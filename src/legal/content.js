/**
 * Legal content, EN and FR.
 *
 * Kept out of the i18n dictionary on purpose: these are long documents that
 * change on their own schedule and need to be diffable as prose, not as
 * hundreds of interface keys.
 *
 * IMPORTANT. This is a drafted template, not legal advice. It was written to
 * match what this application actually does (see the data map in `privacy`,
 * which mirrors supabase/01_schema.sql), but it must be reviewed by a
 * qualified lawyer before publication. Anything in [BRACKETS] is a value only
 * the owner can supply.
 */

export const OWNER = 'Anne-Kelly Kouyaté'
/**
 * The one contact address in the project.
 *
 * It was written out by hand in the footer, on the account screen twice, and
 * was about to be a fourth time on the credits page. Four copies of an address
 * is three chances to change it in three places and miss the fourth, which is
 * the same drift the top of studies.js exists to prevent for numbers.
 */
export const CONTACT_EMAIL = 'contact@richandfriends.xyz'
export const APP_NAME = 'Rich & Friends'
export const LAST_UPDATED = '2026-08-04'

const PLACEHOLDER = {
  email: '[contact@yourdomain]',
  address: '[postal address]',
  domain: '[yourdomain]',
}

export const LEGAL = {
  en: {
    notice: {
      slug: 'notice',
      title: 'Legal notice',
      intro:
        'French law requires every website to identify its publisher and its host. This page does that.',
      sections: [
        {
          h: 'Publisher',
          p: [
            `${APP_NAME} is published by ${OWNER}, an individual publisher.`,
            `Postal address: ${PLACEHOLDER.address}`,
            `Contact: ${PLACEHOLDER.email}`,
            `Director of publication: ${OWNER}.`,
            'If the publisher is registered as a business, the registration number and, where applicable, the intra-community VAT number belong here.',
          ],
        },
        {
          h: 'Hosting',
          p: [
            'The interface is hosted by Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, United States.',
            'The database, authentication and file storage are operated by Supabase, Inc., 970 Toa Payoh North, Singapore 318992, on infrastructure located in the region selected for the project.',
            'Transactional email is sent through the provider configured for the service.',
          ],
        },
        {
          h: 'Reporting a problem',
          p: [
            `To report unlawful content, a security issue or an intellectual property infringement, write to ${PLACEHOLDER.email} with enough detail to identify the material concerned. Reports are reviewed promptly.`,
          ],
        },
      ],
    },

    terms: {
      slug: 'terms',
      title: 'Terms of use',
      intro: `These terms govern your use of ${APP_NAME}. By creating an account you accept them.`,
      sections: [
        {
          h: '1. The service',
          p: [
            `${APP_NAME} lets a small group of people set goals, check in on a shared weekly schedule, and see each other's progress. It is provided as it stands and may change over time.`,
          ],
        },
        {
          h: '2. Accounts',
          p: [
            'You need an account to use the service. You are responsible for the security of the sign-in method you choose and for activity that takes place under your account.',
            'You must be at least 15 years old to create an account. If you are under 18, you should have your parent or guardian read these terms with you.',
            'You may close your account at any time. Closing it removes your access; see the privacy policy for what happens to your data.',
          ],
        },
        {
          h: '3. What you may not do',
          p: [
            'Do not use the service to harass, threaten, or abuse anyone, including members of your own group.',
            'Do not upload content that is unlawful, that infringes somebody else’s rights, or that you do not have the right to share.',
            'Do not attempt to access data belonging to groups you are not a member of, probe or circumvent the access controls, or test the security of the service without written permission.',
            'Do not scrape, harvest, or systematically extract content, and do not use automated means to create accounts or submit check-ins.',
            'Do not copy, decompile, reverse engineer, or create a derivative version of the software, except to the limited extent that mandatory law permits it.',
          ],
        },
        {
          h: '4. Your content',
          p: [
            'Your goals, check-ins, notes and any evidence you attach remain yours. Nothing here transfers ownership of them.',
            'You grant the publisher a limited, non-exclusive, royalty-free licence to store, reproduce and display that content strictly as needed to operate the service for you and the members of your group. That licence exists only so the application can function, ends when you delete the content or your account, and does not permit any other use. In particular it does not permit publication, sale, or use for advertising.',
            'You are responsible for what you post. Remember that everything you submit is visible to the other members of your group.',
          ],
        },
        {
          h: '5. Intellectual property',
          p: [
            `The service, including its source code, database structure, interface design, layouts, graphics, wording, and the name and wordmark "${APP_NAME}". Is the exclusive property of ${OWNER} and is protected by copyright and, where registered, by trade mark law. All rights are reserved.`,
            'These terms grant you a personal, non-transferable, revocable right to use the service as an end user. They grant no licence over the code, the design, the name or the wordmark, and no right to reproduce, adapt, translate, distribute, publicly display or exploit any part of them.',
            `You may not use "${APP_NAME}", the wordmark, or any confusingly similar name or sign to identify a product or service, or in a way that suggests endorsement by or affiliation with the publisher.`,
            'Reproducing all or a substantial part of the interface, the copy, or the structure of the service in a competing product is an infringement and will be treated as one.',
          ],
        },
        {
          h: '6. Feedback',
          p: [
            'If you send suggestions for improving the service, the publisher may use them without obligation, payment or attribution. This does not affect the ownership of anything you already own.',
          ],
        },
        {
          h: '7. Availability and warranties',
          p: [
            'The service is provided without any guarantee of uninterrupted availability. It may be suspended for maintenance, or altered or discontinued.',
            'To the fullest extent permitted by law, the service is provided as is, without warranty that it will be free of errors or that it will meet a particular need. Nothing in this section limits the guarantees that consumer law makes mandatory.',
            'The service is a tool for keeping commitments to friends. It is not medical, psychological, financial or professional advice.',
          ],
        },
        {
          h: '8. Liability',
          p: [
            'To the extent permitted by law, the publisher is not liable for indirect losses, loss of data, or loss of profit or opportunity arising from use of the service.',
            'Nothing here excludes liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot lawfully be excluded.',
          ],
        },
        {
          h: '9. Suspension',
          p: [
            'An account may be suspended or closed if these terms are seriously or repeatedly broken, in particular where the safety of other members is at stake. Where reasonable, notice and an opportunity to respond will be given first.',
          ],
        },
        {
          h: '10. Changes',
          p: [
            'These terms may be updated. Substantive changes will be signalled in the application before they take effect. Continuing to use the service after that point means accepting the new version.',
          ],
        },
        {
          h: '11. Governing law',
          p: [
            'These terms are governed by French law.',
            'In the event of a dispute, the parties will first try to reach an amicable solution. Failing that, the dispute will be brought before the competent French courts. If you are a consumer, you keep the right to bring proceedings in the courts of your place of residence, and you may use the European Commission’s online dispute resolution platform.',
          ],
        },
        {
          h: '12. Contact',
          p: [`Questions about these terms: ${PLACEHOLDER.email}`],
        },
      ],
    },

    privacy: {
      slug: 'privacy',
      title: 'Privacy policy',
      intro:
        'What this application stores, why, for how long, and what you can ask for. Written to match what the software actually does.',
      sections: [
        {
          h: 'Who is responsible',
          p: [
            `${OWNER} is the data controller for the personal data processed by ${APP_NAME}.`,
            `Contact: ${PLACEHOLDER.email}`,
          ],
        },
        {
          h: 'What is collected',
          p: [
            'Account data: your email address, the display name and avatar supplied by your sign-in provider, and your timezone. The timezone is stored so reminders arrive at a sensible hour.',
            'Group data: which groups you belong to, when you joined, and your position in the rotation used to prompt someone to check on a quiet member.',
            'Content you write: your goals, including the trigger and the evidence you define; your check-ins, the outcome recorded for each goal, any evidence text, and the single commitment you write for the following cycle; and any period you mark yourself away for.',
            'Delivery records: a log of which of the two permitted emails per cycle has already been sent to you, so the same message is never sent twice.',
            'Stored on your device only: your language preference, the group you last viewed, and any check-in composed while offline and waiting to sync. This is browser storage, not cookies, and it never leaves your device except when a queued check-in is sent.',
            'No advertising identifiers, no tracking pixels, and no analytics profiling are used.',
          ],
        },
        {
          h: 'Why, and on what legal basis',
          p: [
            'To provide the service. Creating your account, running the weekly cycle, storing and showing your check-ins to your group. Basis: performance of the contract between you and the publisher.',
            'To send the check-in digest before a window opens, and one message if you have missed two cycles in a row. Basis: performance of the contract, since these are the mechanics of the service itself. You can stop them by closing your account.',
            'To keep the service secure and prevent abuse. Basis: the publisher’s legitimate interest in a safe service.',
            'To comply with legal obligations where they apply.',
          ],
        },
        {
          h: 'Who else sees it',
          p: [
            'Members of your group see your display name, your check-in status, and the content of your check-ins once the window closes. That visibility is the purpose of the application.',
            'Your email address is never shown to other members.',
            'Processors acting on the publisher’s instructions: Supabase (database, authentication, storage), Netlify (hosting of the interface), the configured transactional email provider, and your chosen sign-in provider. Each is bound by a data processing agreement.',
            'Some of these providers operate outside the European Union. Transfers rely on the European Commission’s standard contractual clauses or an adequacy decision.',
            'Your data is never sold, rented, or shared for advertising.',
          ],
        },
        {
          h: 'How long it is kept',
          p: [
            'Account and content data are kept while your account is open.',
            'When you delete your account, your profile, goals, check-ins and away periods are deleted along with it. Where a check-in formed part of a group cycle, an anonymised record that a cycle took place may remain so that other members’ history stays coherent.',
            'Delivery records are kept for up to twelve months so the message limit can be enforced.',
            'Backups are overwritten on the provider’s ordinary cycle.',
          ],
        },
        {
          h: 'How it is protected',
          p: [
            'Access is enforced at the database level: every table carries row level security policies that resolve to "this row is mine" or "I am a member of this group". A user cannot read another group’s data even if the application code were bypassed.',
            'Traffic is encrypted in transit. Authentication is handled by the sign-in provider; no password is stored by this application.',
          ],
        },
        {
          h: 'Your rights',
          p: [
            'You may request access to your data, correction of it, erasure, restriction of processing, portability, and you may object to processing based on legitimate interest.',
            `To exercise any of these, write to ${PLACEHOLDER.email}. A response will be given within one month.`,
            'If you believe your data is being handled improperly, you may lodge a complaint with the CNIL (Commission nationale de l’informatique et des libertés), 3 place de Fontenoy, 75007 Paris, or with the supervisory authority where you live.',
          ],
        },
        {
          h: 'Age',
          p: [
            'This service is not intended for children under 15. If you believe a child has created an account, please get in touch and it will be removed.',
          ],
        },
        {
          h: 'Changes',
          p: [
            'This policy may be updated. The date at the top of this page shows the current version, and material changes will be signalled in the application.',
          ],
        },
      ],
    },
  },

  fr: {
    notice: {
      slug: 'notice',
      title: 'Mentions légales',
      intro:
        'La loi française impose à tout site d’identifier son éditeur et son hébergeur. C’est l’objet de cette page.',
      sections: [
        {
          h: 'Éditeur',
          p: [
            `${APP_NAME} est édité par ${OWNER}, éditeur personne physique.`,
            `Adresse postale : ${PLACEHOLDER.address}`,
            `Contact : ${PLACEHOLDER.email}`,
            `Directrice de la publication : ${OWNER}.`,
            'Si l’éditeur est immatriculé, le numéro d’immatriculation et, le cas échéant, le numéro de TVA intracommunautaire doivent figurer ici.',
          ],
        },
        {
          h: 'Hébergement',
          p: [
            'L’interface est hébergée par Netlify, Inc., 512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis.',
            'La base de données, l’authentification et le stockage de fichiers sont opérés par Supabase, Inc., 970 Toa Payoh North, Singapour 318992, sur une infrastructure située dans la région choisie pour le projet.',
            'Les courriels transactionnels sont envoyés via le prestataire configuré pour le service.',
          ],
        },
        {
          h: 'Signaler un problème',
          p: [
            `Pour signaler un contenu illicite, une faille de sécurité ou une atteinte à la propriété intellectuelle, écrire à ${PLACEHOLDER.email} en donnant les éléments permettant d’identifier le contenu concerné. Tout signalement est examiné sans délai.`,
          ],
        },
      ],
    },

    terms: {
      slug: 'terms',
      title: 'Conditions générales d’utilisation',
      intro: `Ces conditions régissent votre utilisation de ${APP_NAME}. En créant un compte, vous les acceptez.`,
      sections: [
        {
          h: '1. Le service',
          p: [
            `${APP_NAME} permet à un petit groupe de personnes de fixer des objectifs, de faire le point selon un rythme hebdomadaire commun et de suivre les progrès de chacun. Le service est fourni en l’état et peut évoluer.`,
          ],
        },
        {
          h: '2. Comptes',
          p: [
            'Un compte est nécessaire pour utiliser le service. Vous êtes responsable de la sécurité de votre moyen de connexion et des activités effectuées depuis votre compte.',
            'Vous devez avoir au moins 15 ans pour créer un compte. Si vous êtes mineur, lisez ces conditions avec votre représentant légal.',
            'Vous pouvez fermer votre compte à tout moment. La fermeture met fin à votre accès ; le sort de vos données est décrit dans la politique de confidentialité.',
          ],
        },
        {
          h: '3. Ce qui est interdit',
          p: [
            'Ne pas utiliser le service pour harceler, menacer ou maltraiter qui que ce soit, y compris les membres de votre propre groupe.',
            'Ne pas publier de contenu illicite, portant atteinte aux droits d’autrui, ou que vous n’avez pas le droit de partager.',
            'Ne pas tenter d’accéder aux données de groupes dont vous n’êtes pas membre, ni de contourner ou tester les contrôles d’accès sans autorisation écrite.',
            'Ne pas extraire, aspirer ou collecter systématiquement les contenus, ni recourir à des moyens automatisés pour créer des comptes ou soumettre des points hebdomadaires.',
            'Ne pas copier, décompiler, désassembler ou créer une version dérivée du logiciel, sauf dans la stricte mesure permise par les dispositions impératives de la loi.',
          ],
        },
        {
          h: '4. Vos contenus',
          p: [
            'Vos objectifs, vos points hebdomadaires, vos notes et les preuves que vous ajoutez restent vôtres. Rien ici n’en transfère la propriété.',
            'Vous concédez à l’éditrice une licence limitée, non exclusive et gratuite pour héberger, reproduire et afficher ces contenus, strictement dans la mesure nécessaire au fonctionnement du service pour vous et les membres de votre groupe. Cette licence n’existe que pour faire fonctionner l’application, prend fin lorsque vous supprimez le contenu ou votre compte, et n’autorise aucun autre usage, en particulier ni publication, ni cession, ni exploitation publicitaire.',
            'Vous êtes responsable de ce que vous publiez. Tout ce que vous soumettez est visible par les autres membres de votre groupe.',
          ],
        },
        {
          h: '5. Propriété intellectuelle',
          p: [
            `Le service. Son code source, la structure de sa base de données, le design de son interface, ses mises en page, ses graphismes, ses textes, ainsi que la dénomination et le logotype « ${APP_NAME} ». Est la propriété exclusive de ${OWNER} et est protégé par le droit d’auteur et, en cas d’enregistrement, par le droit des marques. Tous droits réservés.`,
            'Les présentes conditions vous confèrent un droit d’usage personnel, non cessible et révocable, en qualité d’utilisateur final. Elles ne confèrent aucune licence sur le code, le design, la dénomination ou le logotype, ni aucun droit de reproduction, d’adaptation, de traduction, de distribution, de représentation ou d’exploitation.',
            `Vous ne pouvez pas utiliser « ${APP_NAME} », le logotype, ni un signe prêtant à confusion, pour désigner un produit ou un service, ni d’une manière laissant croire à un partenariat ou à une approbation de l’éditrice.`,
            'La reprise de tout ou partie substantielle de l’interface, des textes ou de la structure du service dans un produit concurrent constitue une contrefaçon et sera traitée comme telle.',
          ],
        },
        {
          h: '6. Suggestions',
          p: [
            'Si vous transmettez des suggestions d’amélioration, l’éditrice peut les utiliser sans obligation, rémunération ni mention. Cela ne modifie en rien la propriété de ce qui vous appartient déjà.',
          ],
        },
        {
          h: '7. Disponibilité et garanties',
          p: [
            'Le service est fourni sans garantie de disponibilité continue. Il peut être suspendu pour maintenance, modifié ou interrompu.',
            'Dans la limite permise par la loi, le service est fourni en l’état, sans garantie d’absence d’erreur ni d’adéquation à un besoin particulier. Les garanties légales impératives, notamment celles du droit de la consommation, demeurent applicables.',
            'Le service est un outil d’engagement entre amis. Il ne constitue ni un avis médical, ni psychologique, ni financier, ni professionnel.',
          ],
        },
        {
          h: '8. Responsabilité',
          p: [
            'Dans la limite permise par la loi, l’éditrice n’est pas responsable des dommages indirects, des pertes de données, ni des pertes de bénéfice ou d’opportunité résultant de l’utilisation du service.',
            'Rien ici n’exclut la responsabilité en cas de dommage corporel causé par une négligence, de dol, ou dans les autres cas où l’exclusion est légalement impossible.',
          ],
        },
        {
          h: '9. Suspension',
          p: [
            'Un compte peut être suspendu ou fermé en cas de manquement grave ou répété aux présentes conditions, en particulier lorsque la sécurité des autres membres est en jeu. Dans la mesure du raisonnable, un avertissement et une possibilité de réponse seront donnés au préalable.',
          ],
        },
        {
          h: '10. Modifications',
          p: [
            'Ces conditions peuvent être mises à jour. Les modifications substantielles seront signalées dans l’application avant leur entrée en vigueur. Poursuivre l’utilisation du service après cette date vaut acceptation de la nouvelle version.',
          ],
        },
        {
          h: '11. Droit applicable',
          p: [
            'Les présentes conditions sont soumises au droit français.',
            'En cas de litige, les parties rechercheront d’abord une solution amiable. À défaut, le litige sera porté devant les juridictions françaises compétentes. Si vous êtes consommateur, vous conservez le droit de saisir la juridiction de votre lieu de résidence et pouvez recourir à la plateforme européenne de règlement en ligne des litiges.',
          ],
        },
        {
          h: '12. Contact',
          p: [`Questions relatives à ces conditions : ${PLACEHOLDER.email}`],
        },
      ],
    },

    privacy: {
      slug: 'privacy',
      title: 'Politique de confidentialité',
      intro:
        'Ce que cette application enregistre, pourquoi, pendant combien de temps, et ce que vous pouvez demander. Rédigée d’après ce que le logiciel fait réellement.',
      sections: [
        {
          h: 'Responsable de traitement',
          p: [
            `${OWNER} est responsable du traitement des données personnelles mises en œuvre par ${APP_NAME}.`,
            `Contact : ${PLACEHOLDER.email}`,
          ],
        },
        {
          h: 'Données collectées',
          p: [
            'Données de compte : votre adresse électronique, le nom d’affichage et l’avatar fournis par votre fournisseur de connexion, et votre fuseau horaire. Le fuseau horaire sert à envoyer les rappels à une heure cohérente.',
            'Données de groupe : les groupes dont vous êtes membre, la date d’adhésion, et votre rang dans la rotation utilisée pour proposer à quelqu’un de prendre des nouvelles d’un membre silencieux.',
            'Contenus que vous écrivez : vos objectifs, y compris le déclencheur et la preuve que vous définissez ; vos points hebdomadaires, le résultat consigné pour chaque objectif, le texte de preuve éventuel et l’engagement unique que vous notez pour le cycle suivant ; ainsi que les périodes d’absence que vous déclarez.',
            'Journal d’envoi : la trace des deux courriels autorisés par cycle déjà envoyés, afin qu’un même message ne parte jamais deux fois.',
            'Stocké uniquement sur votre appareil : votre langue, le dernier groupe consulté, et tout point hebdomadaire rédigé hors ligne en attente de synchronisation. Il s’agit du stockage du navigateur, non de cookies, et ces données ne quittent l’appareil que lors de l’envoi d’un point en attente.',
            'Aucun identifiant publicitaire, aucun pixel de suivi et aucun profilage analytique ne sont utilisés.',
          ],
        },
        {
          h: 'Finalités et bases légales',
          p: [
            'Fournir le service. Créer votre compte, faire tourner le cycle hebdomadaire, enregistrer et afficher vos points à votre groupe. Base légale : exécution du contrat.',
            'Envoyer le récapitulatif avant l’ouverture d’une fenêtre, et un message unique après deux cycles manqués consécutifs. Base légale : exécution du contrat, ces envois constituant le mécanisme même du service. Vous pouvez y mettre fin en fermant votre compte.',
            'Assurer la sécurité du service et prévenir les abus. Base légale : intérêt légitime de l’éditrice à proposer un service sûr.',
            'Respecter les obligations légales lorsqu’elles s’appliquent.',
          ],
        },
        {
          h: 'Destinataires',
          p: [
            'Les membres de votre groupe voient votre nom d’affichage, votre statut, et le contenu de vos points une fois la fenêtre close. Cette visibilité est la raison d’être de l’application.',
            'Votre adresse électronique n’est jamais montrée aux autres membres.',
            'Sous-traitants agissant sur instruction de l’éditrice : Supabase (base de données, authentification, stockage), Netlify (hébergement de l’interface), le prestataire d’envoi de courriels configuré, et votre fournisseur de connexion. Chacun est lié par un accord de sous-traitance.',
            'Certains de ces prestataires opèrent hors de l’Union européenne. Les transferts reposent sur les clauses contractuelles types de la Commission européenne ou sur une décision d’adéquation.',
            'Vos données ne sont ni vendues, ni louées, ni partagées à des fins publicitaires.',
          ],
        },
        {
          h: 'Durées de conservation',
          p: [
            'Les données de compte et de contenu sont conservées tant que votre compte est ouvert.',
            'À la suppression de votre compte, votre profil, vos objectifs, vos points et vos absences sont supprimés. Lorsqu’un point s’inscrivait dans un cycle de groupe, une trace anonymisée de l’existence du cycle peut subsister afin que l’historique des autres membres reste cohérent.',
            'Le journal d’envoi est conservé jusqu’à douze mois pour faire respecter la limite de messages.',
            'Les sauvegardes sont écrasées selon le cycle habituel du prestataire.',
          ],
        },
        {
          h: 'Sécurité',
          p: [
            'Les accès sont contrôlés au niveau de la base : chaque table porte des politiques de sécurité au niveau des lignes qui se résument à « cette ligne est la mienne » ou « je suis membre de ce groupe ». Un utilisateur ne peut pas lire les données d’un autre groupe, même si le code de l’application était contourné.',
            'Les échanges sont chiffrés en transit. L’authentification est assurée par le fournisseur de connexion ; aucun mot de passe n’est conservé par cette application.',
          ],
        },
        {
          h: 'Vos droits',
          p: [
            'Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, de portabilité, et d’un droit d’opposition aux traitements fondés sur l’intérêt légitime.',
            `Pour les exercer, écrivez à ${PLACEHOLDER.email}. Une réponse vous sera apportée dans un délai d’un mois.`,
            'Si vous estimez que vos données sont mal traitées, vous pouvez saisir la CNIL, 3 place de Fontenoy, 75007 Paris, ou l’autorité de contrôle de votre lieu de résidence.',
          ],
        },
        {
          h: 'Âge',
          p: [
            'Ce service ne s’adresse pas aux enfants de moins de 15 ans. Si vous pensez qu’un enfant a créé un compte, signalez-le et il sera supprimé.',
          ],
        },
        {
          h: 'Modifications',
          p: [
            'Cette politique peut être mise à jour. La date en tête de page indique la version en vigueur, et les changements substantiels seront signalés dans l’application.',
          ],
        },
      ],
    },
  },
}

export const DOC_ORDER = ['terms', 'privacy', 'notice']
