import { createContext, useContext, useMemo, useState } from 'react'

/**
 * Two locales, one flat dictionary, no dependency.
 *
 * The copy is translated rather than transliterated — French keeps the same
 * voice the English has (short, plain, warm, second person singular). "Faire
 * le point" carries what "check in" actually means here far better than
 * "s'enregistrer" would.
 *
 * Plurals are handled per-string with a count, because the two languages
 * disagree about them: French treats 0 as singular, English does not.
 */
const STRINGS = {
  en: {
    'nav.home': 'Home',
    'nav.goals': 'Goals',
    'nav.you': 'You',
    'nav.group': 'Group',

    'sync.queued_one': 'Saved. It will send as soon as you’re back online.',
    'sync.queued_other': 'Saved. They will send as soon as you’re back online.',
    'sync.offline': 'You’re offline — anything you write will send itself later.',

    'board.open_for': 'Open for another {t}',
    'board.opens_in': 'Opens in {t}',
    'board.next_opens_in': 'Next one opens in {t}',
    'board.closed': 'Closed for now',
    'board.getting_ready': 'Getting things ready',
    'board.ready': 'Ready when you are',
    'board.nothing_listed': 'Nothing on your list yet — add something first.',
    'board.things_to_look_at_one': '{n} thing to look at. Takes about a minute.',
    'board.things_to_look_at_other': '{n} things to look at. Takes about a minute.',
    'board.check_in': 'Check in',
    'board.this_week': 'This week',
    'board.checked_in_count_one': '{n} of {total} has checked in',
    'board.checked_in_count_other': '{n} of {total} have checked in',
    'board.you': 'you',
    'board.state_away': 'Away this week',
    'board.state_in': 'Checked in',
    'board.state_quiet': 'Didn’t check in',
    'board.state_waiting': 'Not yet',
    'board.next': 'Next: {text}',
    'board.together': 'Together',
    'board.invite': 'Invite someone',
    'board.invite_body': 'It’s just you so far. Send this code to a friend — two to six people works best.',
    'board.did_it': 'Did it',
    'board.partly': 'Got part of the way',
    'board.not_this_week': 'Not this week',

    'goal.times_a_week_one': '{n} time a week',
    'goal.times_a_week_other': '{n} times a week',
    'goal.by_date': 'by {date}',
    'goal.paused': 'paused',
    'goal.proof': 'Proof: {text}',
    'goal.progress': '{done} of {total} so far this week',
    'goal.everyone': 'Everyone',
    'goal.pause': 'Pause',
    'goal.resume': 'Pick it back up',
    'goal.mark_done': 'Mark done',

    'nudge.quiet': '{name} has been quiet for a couple of weeks.',
    'nudge.claimed_by_me': 'You’ve got this one. Send them a message — about them, not about the app.',
    'nudge.claimed_by_other': '{name} is checking in on them.',
    'nudge.assigned': 'Nobody picked this one up, so it came to you. A text is plenty.',
    'nudge.open': 'Someone should say hello — wherever you actually talk, not in here.',
    'nudge.claim': 'I’ll check on them',
    'nudge.close': 'Done — we spoke',
    'nudge.busy': 'One moment',

    'signin.pitch':
      'One check-in a week, at the same time, with the same people. Sixty seconds. That’s the whole thing.',
    'signin.google': 'Continue with Google',
    'signin.use_email': 'Use email instead',
    'signin.email': 'Email',
    'signin.send_link': 'Send me a link',
    'signin.sending': 'Sending',
    'signin.link_sent':
      'Link sent to {email}. Open it on this device — if it opens in a different browser you’ll need to sign in again there.',

    'start.new_group': 'New group',
    'start.join_one': 'Join one',
    'start.group_name': 'Group name',
    'start.group_name_ph': 'Sunday Four',
    'start.checkin_opens': 'Check-in opens',
    'start.checkin_hint':
      'Everyone checks in inside the same window. The shared moment is the part that keeps a group alive — staggered check-ins are just a form that’s always open.',
    'start.window_note': 'Window stays open 30 hours · {tz}',
    'start.create': 'Create group',
    'start.creating': 'Creating',
    'start.invite_code': 'Invite code',
    'start.invite_hint': 'Six characters, from whoever set the group up.',
    'start.join': 'Join',
    'start.joining': 'Joining',

    'checkin.title': 'Check-in',
    'checkin.closes_in': 'Closes in {t}',
    'checkin.window_closed': 'Window closed',
    'checkin.closed_body':
      'This cycle’s window has closed. The next one opens in {t} — nothing to catch up on in the meantime.',
    'checkin.no_goals': 'No active goals yet. Add one first — a check-in needs something to check.',
    'checkin.what_happened': 'What actually happened',
    'checkin.committed': 'Committed: {n}×',
    'checkin.committed_once': 'Committed: once',
    'checkin.did_it': 'Did it',
    'checkin.not_yet': 'Not yet',
    'checkin.shared': 'Shared',
    'checkin.one_thing': 'One thing for next cycle',
    'checkin.one_thing_ph': 'The single thing you’ll do',
    'checkin.submit': 'Submit check-in',
    'checkin.sending': 'Sending',
    'checkin.away': 'I’m away this cycle',
    'checkin.away_note': 'Away weeks don’t count against you. They’re not misses.',
    'checkin.fewer': 'One fewer',
    'checkin.more': 'One more',

    'mood.question': 'How are you today?',
    'mood.hint': 'Optional, and not counted either way. Tap again to unpick.',
    'mood.excited': 'Excited',
    'mood.joyful': 'Joyful',
    'mood.grateful': 'Grateful',
    'mood.energized': 'Energized',
    'mood.sensitive': 'Sensitive',
    'mood.confused': 'Confused',
    'mood.bored': 'Bored',
    'mood.stressed': 'Stressed',
    'mood.angry': 'Angry',
    'mood.insecure': 'Insecure',
    'mood.hurt': 'Hurt',
    'mood.guilty': 'Guilty',

    'goals.add': '+ Add',
    'goals.yours': 'Yours',
    'goals.empty': 'Nothing yet. A goal needs a trigger and a proof to be checkable.',
    'goals.everyone_else': 'Everyone else',
    'goals.new_goal': 'New goal',

    'form.mine': 'Mine',
    'form.whole_group': 'Whole group',
    'form.commitment': 'The commitment',
    'form.commitment_hint': 'What specifically gets done. Not the result you want — the thing you do.',
    'form.commitment_ph': 'Post 3 videos',
    'form.outcome_1':
      'That reads like a result rather than an action. Results depend on things you don’t control, so a bad week looks like failure even when you did the work.',
    'form.outcome_2': 'What would you do each week to get there? Track that instead.',
    'form.keep_as_is': 'Keep as is',
    'form.rewrite': 'Let me rewrite',
    'form.cadence': 'Cadence',
    'form.every_cycle': 'Every cycle',
    'form.one_off': 'One-off',
    'form.times_per_cycle': 'Times per cycle',
    'form.until': 'Until (optional)',
    'form.due_by': 'Due by',
    'form.when': 'The trigger — when',
    'form.when_hint':
      'Naming when and where roughly doubles follow-through versus stating the intention alone.',
    'form.when_ph': 'After my Tuesday lecture',
    'form.where': 'The trigger — where',
    'form.where_ph': 'At the library, third floor',
    'form.evidence': 'The evidence',
    'form.evidence_hint': 'What you’ll show at check-in that proves it happened.',
    'form.evidence_ph': 'Links to the posted videos',
    'form.stake': 'Stake (optional)',
    'form.stake_hint': 'Settled between you — the app only remembers it.',
    'form.stake_ph': 'Coffee for whoever asks',
    'form.save_changes': 'Save changes',
    'form.add_goal': 'Add goal',
    'form.saving': 'Saving',
    'form.required': 'Commitment, trigger and evidence required',

    'me.consistency': 'Your consistency',
    'me.quiet_label': 'Been a couple of cycles',
    'me.still_in': 'Still in?',
    'me.still_in_body': 'Park what’s there and pick one thing. No catching up, no backlog.',
    'me.reset': 'I’m still in — reset me',
    'me.last14': 'Last 14 cycles',
    'me.checked_in': 'Checked in',
    'me.live_goals': 'Live goals',
    'me.away': 'Away',
    'me.not_counted': 'Not counted',
    'me.no_cycles': 'No cycles yet',
    'me.rate_note':
      'A rate, not a streak. A bad cycle moves this a few points — it never resets anything to zero.',
    'me.last12': 'Last 12 cycles',
    'me.legend_in': 'In',
    'me.legend_away': 'Away',
    'me.legend_missed': 'Missed',
    'me.sign_out': 'Sign out',
    'me.one_thing': 'One thing',

    'settings.group_rate': 'Group check-in rate',
    'settings.people': 'People',
    'settings.people_hint': '2–6 works best',
    'settings.everyone': 'Everyone',
    'settings.send_to_friend': 'Send to a friend',
    'settings.invite_note':
      'Conversation lives in your group chat, not here. This app only holds the check-in.',
    'settings.switch_group': 'Switch group',
    'settings.language': 'Language',

    'theme.title': 'Theme',
    'theme.appearance': 'Appearance',
    'theme.mode_system': 'System',
    'theme.mode_light': 'Light',
    'theme.mode_dark': 'Dark',
    'theme.accent': 'Colour',
    'theme.accent_pink': 'Pink',
    'theme.accent_yellow': 'Yellow',
    'theme.accent_blue': 'Blue',

    'err.title': 'Something went wrong',
    'err.signin_failed': 'Sign-in didn’t complete.',
    'err.provider_disabled':
      'Google sign-in isn’t switched on for this project yet. Use email instead, or enable the Google provider in Supabase.',
    'err.redirect_not_allowed':
      'This address isn’t on the sign-in allowlist. Add it under Authentication → URL Configuration in Supabase.',
    'err.load_failed': 'Couldn’t reach the server. Your connection may be down.',
    'err.no_tables':
      'The database is empty — the tables have not been created yet. In Supabase, open the SQL Editor and run supabase/01_schema.sql, then 02_functions.sql, then 03_policies.sql, pasting the contents of each file.',
    'err.retry': 'Try again',
    'err.loading': 'Loading',

    'nav.library': 'Library',
    'library.sub': 'Three books, read here',
    'library.empty': 'No books yet. They will appear here when published.',
    'library.owned': 'Yours',
    'library.read': 'Read',
    'library.read_free': 'Read chapter 1 free',
    'library.buy': 'Buy · {price}',
    'library.opening': 'Opening checkout',
    'library.progress': '{pct}% through',
    'library.share_title': 'Tell your group?',
    'library.share_body':
      'You can let the group know you have started this. Entirely optional, and nothing is shared unless you choose to.',
    'library.share_yes': 'Share it',
    'library.share_skip': 'Keep it to myself',

    'reader.chapters': 'Chapters',
    'reader.text_size': 'Aa',
    'reader.notes': 'Notes ({n})',
    'reader.your_notes': 'Your notes',
    'reader.no_notes': 'Nothing saved yet. Select a passage while reading to keep it.',
    'reader.save_highlight': 'Save this',
    'reader.share_highlight': 'Share with group',
    'reader.delete': 'Delete',
    'reader.chapter_n': 'Chapter {n}',
    'reader.free_preview': 'free preview',
    'reader.free': 'Free',
    'reader.locked': 'Locked',
    'reader.locked_title': 'This chapter is part of the full book',
    'reader.locked_body':
      'Chapter 1 is free to read. The rest opens once you have the book.',
    'reader.unlock': 'Get the book',
    'reader.previous': 'Previous',
    'reader.next': 'Next',

    'ui.close': 'Close',
  },

  fr: {
    'nav.home': 'Accueil',
    'nav.goals': 'Objectifs',
    'nav.you': 'Toi',
    'nav.group': 'Groupe',

    'sync.queued_one': 'Enregistré. Ça partira dès que tu seras reconnecté.',
    'sync.queued_other': 'Enregistrés. Ils partiront dès que tu seras reconnecté.',
    'sync.offline': 'Tu es hors ligne — ce que tu écris partira tout seul plus tard.',

    'board.open_for': 'Encore ouvert {t}',
    'board.opens_in': 'Ouvre dans {t}',
    'board.next_opens_in': 'Le prochain ouvre dans {t}',
    'board.closed': 'Fermé pour l’instant',
    'board.getting_ready': 'On prépare tout',
    'board.ready': 'Quand tu veux',
    'board.nothing_listed': 'Rien sur ta liste — commence par ajouter quelque chose.',
    'board.things_to_look_at_one': '{n} chose à regarder. Une minute suffit.',
    'board.things_to_look_at_other': '{n} choses à regarder. Une minute suffit.',
    'board.check_in': 'Faire le point',
    'board.this_week': 'Cette semaine',
    'board.checked_in_count_one': '{n} sur {total} a fait le point',
    'board.checked_in_count_other': '{n} sur {total} ont fait le point',
    'board.you': 'toi',
    'board.state_away': 'Absent cette semaine',
    'board.state_in': 'Fait',
    'board.state_quiet': 'Rien cette semaine',
    'board.state_waiting': 'Pas encore',
    'board.next': 'Ensuite : {text}',
    'board.together': 'Ensemble',
    'board.invite': 'Inviter quelqu’un',
    'board.invite_body':
      'Tu es seul pour l’instant. Envoie ce code à un ami — de deux à six, c’est l’idéal.',
    'board.did_it': 'Fait',
    'board.partly': 'En partie',
    'board.not_this_week': 'Pas cette semaine',

    'goal.times_a_week_one': '{n} fois par semaine',
    'goal.times_a_week_other': '{n} fois par semaine',
    'goal.by_date': 'avant le {date}',
    'goal.paused': 'en pause',
    'goal.proof': 'Preuve : {text}',
    'goal.progress': '{done} sur {total} cette semaine',
    'goal.everyone': 'Tout le monde',
    'goal.pause': 'Mettre en pause',
    'goal.resume': 'Reprendre',
    'goal.mark_done': 'Terminer',

    'nudge.quiet': '{name} n’a rien dit depuis deux semaines.',
    'nudge.claimed_by_me':
      'C’est toi qui t’en occupes. Écris-lui — parle de lui, pas de l’appli.',
    'nudge.claimed_by_other': '{name} prend de ses nouvelles.',
    'nudge.assigned': 'Personne ne s’en est chargé, alors ça te revient. Un message suffit.',
    'nudge.open': 'Quelqu’un devrait lui écrire — là où vous parlez vraiment, pas ici.',
    'nudge.claim': 'Je m’en occupe',
    'nudge.close': 'C’est fait — on s’est parlé',
    'nudge.busy': 'Un instant',

    'signin.pitch':
      'Un point par semaine, au même moment, avec les mêmes personnes. Une minute. C’est tout.',
    'signin.google': 'Continuer avec Google',
    'signin.use_email': 'Utiliser mon e-mail',
    'signin.email': 'E-mail',
    'signin.send_link': 'Envoyez-moi un lien',
    'signin.sending': 'Envoi',
    'signin.link_sent':
      'Lien envoyé à {email}. Ouvrez-le sur cet appareil — s’il s’ouvre dans un autre navigateur, il faudra vous reconnecter là-bas.',

    'start.new_group': 'Nouveau groupe',
    'start.join_one': 'Rejoindre',
    'start.group_name': 'Nom du groupe',
    'start.group_name_ph': 'Les Quatre du Dimanche',
    'start.checkin_opens': 'Le point ouvre',
    'start.checkin_hint':
      'Tout le monde fait le point dans la même fenêtre. C’est ce moment partagé qui fait tenir un groupe — des points décalés, ce n’est qu’un formulaire toujours ouvert.',
    'start.window_note': 'La fenêtre reste ouverte 30 heures · {tz}',
    'start.create': 'Créer le groupe',
    'start.creating': 'Création',
    'start.invite_code': 'Code d’invitation',
    'start.invite_hint': 'Six caractères, donnés par la personne qui a créé le groupe.',
    'start.join': 'Rejoindre',
    'start.joining': 'Connexion',

    'checkin.title': 'Le point',
    'checkin.closes_in': 'Ferme dans {t}',
    'checkin.window_closed': 'Fenêtre fermée',
    'checkin.closed_body':
      'La fenêtre de ce cycle est fermée. La prochaine ouvre dans {t} — rien à rattraper d’ici là.',
    'checkin.no_goals':
      'Aucun objectif actif. Commence par en ajouter un — il faut quelque chose à pointer.',
    'checkin.what_happened': 'Ce qui s’est vraiment passé',
    'checkin.committed': 'Prévu : {n}×',
    'checkin.committed_once': 'Prévu : une fois',
    'checkin.did_it': 'Fait',
    'checkin.not_yet': 'Pas encore',
    'checkin.shared': 'Commun',
    'checkin.one_thing': 'Une chose pour le prochain cycle',
    'checkin.one_thing_ph': 'La seule chose que tu feras',
    'checkin.submit': 'Envoyer',
    'checkin.sending': 'Envoi',
    'checkin.away': 'Je suis absent ce cycle',
    'checkin.away_note': 'Les semaines d’absence ne comptent pas contre toi. Ce ne sont pas des oublis.',
    'checkin.fewer': 'Un de moins',
    'checkin.more': 'Un de plus',

    'mood.question': 'Comment tu te sens aujourd’hui ?',
    'mood.hint': 'Facultatif, et jamais compté. Retape dessus pour l’enlever.',
    'mood.excited': 'Impatient',
    'mood.joyful': 'Joyeux',
    'mood.grateful': 'Reconnaissant',
    'mood.energized': 'Plein d’énergie',
    'mood.sensitive': 'Sensible',
    'mood.confused': 'Perdu',
    'mood.bored': 'Blasé',
    'mood.stressed': 'Stressé',
    'mood.angry': 'En colère',
    'mood.insecure': 'Pas sûr de moi',
    'mood.hurt': 'Blessé',
    'mood.guilty': 'Coupable',

    'goals.add': '+ Ajouter',
    'goals.yours': 'Les tiens',
    'goals.empty':
      'Rien pour l’instant. Un objectif a besoin d’un déclencheur et d’une preuve pour être vérifiable.',
    'goals.everyone_else': 'Les autres',
    'goals.new_goal': 'Nouvel objectif',

    'form.mine': 'Le mien',
    'form.whole_group': 'Tout le groupe',
    'form.commitment': 'L’engagement',
    'form.commitment_hint':
      'Ce qui se fait concrètement. Pas le résultat visé — l’action elle-même.',
    'form.commitment_ph': 'Publier 3 vidéos',
    'form.outcome_1':
      'Ça ressemble à un résultat plutôt qu’à une action. Un résultat dépend de choses hors de ton contrôle : une mauvaise semaine ressemble à un échec même quand tu as fait le travail.',
    'form.outcome_2': 'Que ferais-tu chaque semaine pour y arriver ? Suis plutôt ça.',
    'form.keep_as_is': 'Garder ainsi',
    'form.rewrite': 'Je reformule',
    'form.cadence': 'Rythme',
    'form.every_cycle': 'Chaque cycle',
    'form.one_off': 'Une seule fois',
    'form.times_per_cycle': 'Fois par cycle',
    'form.until': 'Jusqu’au (optionnel)',
    'form.due_by': 'Avant le',
    'form.when': 'Le déclencheur — quand',
    'form.when_hint':
      'Préciser quand et où double à peu près les chances de s’y tenir, par rapport à une simple intention.',
    'form.when_ph': 'Après mon cours du mardi',
    'form.where': 'Le déclencheur — où',
    'form.where_ph': 'À la bibliothèque, deuxième étage',
    'form.evidence': 'La preuve',
    'form.evidence_hint': 'Ce que tu montreras au moment du point pour prouver que c’est fait.',
    'form.evidence_ph': 'Les liens vers les vidéos publiées',
    'form.stake': 'Gage (optionnel)',
    'form.stake_hint': 'À régler entre vous — l’appli ne fait que s’en souvenir.',
    'form.stake_ph': 'Un café pour qui le demande',
    'form.save_changes': 'Enregistrer',
    'form.add_goal': 'Ajouter',
    'form.saving': 'Enregistrement',
    'form.required': 'Engagement, déclencheur et preuve obligatoires',

    'me.consistency': 'Ta régularité',
    'me.quiet_label': 'Ça fait deux cycles',
    'me.still_in': 'Toujours partant ?',
    'me.still_in_body':
      'On met de côté ce qui traîne et tu choisis une seule chose. Rien à rattraper.',
    'me.reset': 'Je suis toujours là — remets à zéro',
    'me.last14': '14 derniers cycles',
    'me.checked_in': 'Points faits',
    'me.live_goals': 'Objectifs actifs',
    'me.away': 'Absences',
    'me.not_counted': 'Non comptées',
    'me.no_cycles': 'Aucun cycle',
    'me.rate_note':
      'Un taux, pas une série. Un mauvais cycle fait bouger ça de quelques points — rien ne repart jamais de zéro.',
    'me.last12': '12 derniers cycles',
    'me.legend_in': 'Fait',
    'me.legend_away': 'Absent',
    'me.legend_missed': 'Manqué',
    'me.sign_out': 'Se déconnecter',
    'me.one_thing': 'Une seule chose',

    'settings.group_rate': 'Taux du groupe',
    'settings.people': 'Membres',
    'settings.people_hint': 'De 2 à 6, c’est l’idéal',
    'settings.everyone': 'Tout le monde',
    'settings.send_to_friend': 'Envoyer à un ami',
    'settings.invite_note':
      'Les discussions se passent dans votre groupe habituel, pas ici. Cette appli ne garde que le point.',
    'settings.switch_group': 'Changer de groupe',
    'settings.language': 'Langue',

    'theme.title': 'Thème',
    'theme.appearance': 'Apparence',
    'theme.mode_system': 'Système',
    'theme.mode_light': 'Clair',
    'theme.mode_dark': 'Sombre',
    'theme.accent': 'Couleur',
    'theme.accent_pink': 'Rose',
    'theme.accent_yellow': 'Jaune',
    'theme.accent_blue': 'Bleu',

    'err.title': 'Quelque chose a échoué',
    'err.signin_failed': 'La connexion n’est pas allée au bout.',
    'err.provider_disabled':
      'La connexion Google n’est pas encore activée sur ce projet. Utilise l’e-mail, ou active le fournisseur Google dans Supabase.',
    'err.redirect_not_allowed':
      'Cette adresse n’est pas autorisée pour la connexion. Ajoute-la dans Authentication → URL Configuration sur Supabase.',
    'err.load_failed': 'Impossible de joindre le serveur. Ta connexion est peut-être coupée.',
    'err.no_tables':
      'La base est vide — les tables n’ont pas encore été créées. Dans Supabase, ouvre l’éditeur SQL et exécute supabase/01_schema.sql, puis 02_functions.sql, puis 03_policies.sql, en collant le contenu de chaque fichier.',
    'err.retry': 'Réessayer',
    'err.loading': 'Chargement',

    'nav.library': 'Lectures',
    'library.sub': 'Trois livres, à lire ici',
    'library.empty': 'Aucun livre pour l’instant. Ils apparaîtront ici une fois publiés.',
    'library.owned': 'À toi',
    'library.read': 'Lire',
    'library.read_free': 'Lire le chapitre 1',
    'library.buy': 'Acheter · {price}',
    'library.opening': 'Ouverture du paiement',
    'library.progress': '{pct}% lu',
    'library.share_title': 'Le dire au groupe ?',
    'library.share_body':
      'Tu peux prévenir le groupe que tu as commencé. C’est facultatif, et rien n’est partagé sans ton accord.',
    'library.share_yes': 'Partager',
    'library.share_skip': 'Garder pour moi',

    'reader.chapters': 'Chapitres',
    'reader.text_size': 'Aa',
    'reader.notes': 'Notes ({n})',
    'reader.your_notes': 'Tes notes',
    'reader.no_notes': 'Rien d’enregistré. Sélectionne un passage pendant ta lecture pour le garder.',
    'reader.save_highlight': 'Garder ce passage',
    'reader.share_highlight': 'Partager au groupe',
    'reader.delete': 'Supprimer',
    'reader.chapter_n': 'Chapitre {n}',
    'reader.free_preview': 'extrait gratuit',
    'reader.free': 'Gratuit',
    'reader.locked': 'Verrouillé',
    'reader.locked_title': 'Ce chapitre fait partie du livre complet',
    'reader.locked_body':
      'Le chapitre 1 est en accès libre. La suite s’ouvre une fois le livre acquis.',
    'reader.unlock': 'Obtenir le livre',
    'reader.previous': 'Précédent',
    'reader.next': 'Suivant',

    'ui.close': 'Fermer',
  },
}

const STORE_KEY = 'friends.locale'

// localStorage throws in Safari private mode and when storage is disabled.
// An exception here would take the app down before it rendered anything.
function safeGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function detectLocale() {
  const saved = safeGet(STORE_KEY)
  if (saved && STRINGS[saved]) return saved
  const nav = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase()
  return nav.startsWith('fr') ? 'fr' : 'en'
}

const I18nCtx = createContext(null)

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale)

  const value = useMemo(() => {
    const dict = STRINGS[locale] ?? STRINGS.en

    /**
     * t('board.check_in')
     * t('goal.progress', { done: 5, total: 8 })
     * t('board.things_to_look_at', { n: 3 })   -> picks _one / _other by n
     */
    const t = (key, vars = {}) => {
      let k = key
      if ('n' in vars && !dict[key]) {
        // French counts 0 as singular; English does not.
        const one = locale === 'fr' ? Math.abs(vars.n) < 2 : Math.abs(vars.n) === 1
        k = `${key}_${one ? 'one' : 'other'}`
      }
      const raw = dict[k] ?? STRINGS.en[k] ?? key
      return raw.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`))
    }

    const setLocale = (next) => {
      try {
        localStorage.setItem(STORE_KEY, next)
      } catch {
        /* storage disabled — the choice just won't survive a reload */
      }
      setLocaleState(next)
      document.documentElement.lang = next
    }

    return { locale, t, setLocale }
  }, [locale])

  document.documentElement.lang = locale

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useT() {
  const ctx = useContext(I18nCtx)
  if (!ctx) throw new Error('useT must be used inside I18nProvider')
  return ctx
}

/** For date and number formatting that should follow the chosen locale. */
export const localeTag = (locale) => (locale === 'fr' ? 'fr-FR' : 'en-GB')
