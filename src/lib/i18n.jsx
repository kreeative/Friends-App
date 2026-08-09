import { createContext, useContext, useMemo, useState } from 'react'

/**
 * Two locales, one flat dictionary, no dependency.
 *
 * The copy is translated rather than transliterated. French keeps the same
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
    'nav.board': 'Board',

    'home.morning': 'Good morning',
    'home.afternoon': 'Good afternoon',
    'home.evening': 'Good evening',
    'home.sub': 'Everything you are in, in one place.',
    'home.your_groups': 'Your groups',
    'home.no_groups': 'You are not in a group yet. Start one, or join with a code from a friend.',
    'home.new': '+ New',
    'home.groups': 'Groups',
    'home.waiting_on_you': '{group} is waiting on you',
    'home.n_of_total': '{n} of {total} in',
    'home.you_overall': 'You, across every group',
    'home.your_books': 'Your books',
    'home.no_books': 'Nothing bought yet. The first chapter of each is free to read.',

    'sync.queued_one': 'Saved. It will send as soon as you’re back online.',
    'sync.queued_other': 'Saved. They will send as soon as you’re back online.',
    'sync.offline': 'You’re offline. Anything you write will send itself later.',

    'board.open_for': 'Open for another {t}',
    'board.reveals_in': 'Everyone’s week shows in {t}',
    'board.sealed_note':
      'You can check in any time this week. Nobody sees anybody’s answers until the week is up.',
    'board.last_week': 'Week of {d}',
    'board.opens_in': 'Opens in {t}',
    'board.next_opens_in': 'Next one opens in {t}',
    'board.closed': 'Closed for now',
    'board.getting_ready': 'Getting things ready',
    'board.ready': 'Ready when you are',
    'board.nothing_listed': 'Nothing on your list yet. Add something first.',
    'board.things_to_look_at_one': '{n} thing to look at. Takes about a minute.',
    'board.things_to_look_at_other': '{n} things to look at. Takes about a minute.',
    'board.check_in': 'Check in',
    'settings.role_creator': 'Group creator',
    'settings.role_admin': 'Admin',
    'settings.promote': 'Make admin',
    'settings.demote': 'Remove admin',
    'settings.permissions': 'Permissions',
    'settings.admins_can_delete': 'Allow admins to delete this group',
    'settings.admins_can_delete_on': 'Admins can delete it. Everyone loses their history if they do.',
    'settings.admins_can_delete_off': 'Off. Only you can delete this group.',
    'settings.roles_not_installed':
      'Roles need the database. Run supabase/18_daily_roles_and_feed.sql in Supabase to switch them on.',
    'board.today_objective': 'Objective today',
    'board.one_tap_done': 'Mark done',
    'board.done_today': 'All done today',
    'board.feed': 'Recently',
    'board.missed_line': '{name} missed their goal: "{goal}" today.',
    'board.this_week': 'This week',
    'board.how_we_are': 'How the group is doing',
    'board.rate_note': 'Everyone’s check-ins across the last fourteen weeks. Away weeks are not counted as misses.',
    'board.moods_today': 'How friends are feeling today',
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
    'board.invite_body': 'It’s just you so far. Send this code to a friend. Two to six people works best.',
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
    'nudge.claimed_by_me': 'You’ve got this one. Send them a message about them, not about the app.',
    'nudge.claimed_by_other': '{name} is checking in on them.',
    'nudge.assigned': 'Nobody picked this one up, so it came to you. A text is plenty.',
    'nudge.open': 'Someone should say hello, wherever you actually talk, not in here.',
    'nudge.claim': 'I’ll check on them',
    'nudge.close': 'Done, we spoke',
    'nudge.busy': 'One moment',

    'signin.title': 'Get in with people who move.',
    'signin.pitch':
      'One check-in a week, at the same time, with the same people. Sixty seconds. That’s the whole thing.',
    'signin.google': 'Continue with Google',
    'signin.use_email': 'Use email instead',
    'signin.email': 'Email',
    'signin.send_code': 'Send me a code',
    'signin.sending': 'Sending',
    'signin.code': 'Six-digit code',
    'signin.code_sent': 'We sent a code to {email}. It expires shortly.',
    'signin.verify': 'Sign in',
    'signin.verifying': 'Checking',
    'signin.wrong_email': 'Use a different address',

    'money.title': 'Money',
    'money.sub_new': 'Being rich starts with planning it.',
    'money.sub_period': '{days} days left in this period',
    'money.pitch':
      'Tell it what comes in, what is already promised to somebody else, and what you are keeping. It works out what is actually yours to spend, and splits it over the days left. Two minutes once, then it is one number.',
    'money.set_up': 'Set it up',
    'money.edit_plan': 'Edit plan',
    'money.not_installed': 'The money tables are not in the database yet.',

    'money.today_label': 'Safe to spend today',
    'money.today_body': '{left} left, over {days} days.',
    'money.over_label': 'Over by',
    'money.over_body':
      'The free money for this period is gone and there are {days} days to go. Anything else comes out of what you were keeping.',
    'money.overcommitted_title': 'This plan does not close.',
    'money.overcommitted_body':
      'Fixed costs and savings come to {fixed}, against {income} coming in. That is {over} short before you have spent anything. Lower the savings target, or something fixed has to go.',
    'money.overcommitted_short': '{over} short before you spend anything.',

    'money.add_title': 'Add something',
    'money.kind_expense': 'Spent',
    'money.kind_income': 'Came in',
    'money.add': 'Add',
    'money.remove': 'Remove',

    'money.cat_food': 'Food',
    'money.cat_transport': 'Transport',
    'money.cat_home': 'Home',
    'money.cat_fun': 'Fun',
    'money.cat_health': 'Health',
    'money.cat_other': 'Other',

    'money.this_period': 'This period',
    'money.left': 'Left',
    'money.spent': 'Spent',
    'money.days_left': 'Days left',
    'money.where': 'Where it went',
    'money.recent': 'Recent',
    'money.no_entries': 'Nothing logged this period yet.',

    'money.plan_title': 'Your plan',
    'money.income': 'Money in, each month',
    'money.income_hint': 'What actually lands in your account, after tax.',
    'money.payday': 'Day you get paid',
    'money.payday_hint': 'The period runs payday to payday, not the 1st to the 31st.',
    'money.savings': 'Keeping each month',
    'money.savings_hint': 'Pay yourself first. This comes off before anything is spendable.',
    'money.fixed': 'Fixed costs',
    'money.fixed_hint': 'Rent, phone, transit, subscriptions. The money that is already promised.',
    'money.fixed_label_ph': 'Rent',
    'money.add_fixed': 'Add a cost',
    'money.save': 'Save',
    'money.saving': 'Saving',

    'start.new_group': 'New group',
    'start.join_one': 'Join one',
    'start.group_name': 'Group name',
    'start.group_name_ph': 'Sunday Four',
    'start.checkin_opens': 'Check-in opens',
    'start.checkin_hint':
      'Everyone checks in inside the same window. The shared moment is the part that keeps a group alive. Staggered check-ins are just a form that’s always open.',
    'start.window_note': 'The day resets at midnight · {tz}',
    'start.create': 'Create group',
    'start.creating': 'Creating',
    'start.invite_code': 'Invite code',
    'start.invite_hint': 'Six characters, from whoever set the group up.',
    'start.join': 'Join',
    'start.joining': 'Joining',

    'checkin.title': 'Check-in',
    'checkin.closes_in': 'Closes in {t}',
    'checkin.window_closed': 'Window closed',
    'checkin.between': 'Between weeks',
    'checkin.between_body':
      'Last week is finished and the new one starts in {t}. You will have the whole week to write it, not just the evening.',
    'checkin.no_cycle_body':
      'This group has no check-in window yet. The first one is being set up. It will appear here on the day and hour the group chose.',
    'checkin.closed_body':
      'This cycle’s window has closed. The next one opens in {t}. Nothing to catch up on in the meantime.',
    'checkin.no_goals': 'No active goals yet. Add one first: a check-in needs something to check.',
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
    'mood.question_day': 'What is the mood of the day?',
    'mood.today_is': 'The mood of the day is',
    'mood.choose': 'Choose mood',
    'mood.change': 'Change',
    'mood.clear': 'Clear it',
    'mood.optional': 'Optional, and never counted either way.',
    'mood.hint': 'Optional, and not counted either way. Tap again to unpick.',
    'mood.when':
      'This is the first thing your check-in asks. It unlocks when the new week starts, and it is always optional.',
    'mood.share': 'Let my groups see this',
    'mood.share_on': 'The people in your groups can see today’s mood. Only today’s, and only while this is on.',
    'mood.share_off': 'Off. Nobody else can see it.',
    'mood.share_unavailable':
      'Sharing needs the database. Today’s mood is saved on this device, and a device cannot show it to anyone else. Run supabase/12_daily_mood.sql in Supabase to switch sharing on.',
    'mood.local_note': 'Saved on this device.',
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
    'goals.past': 'Past goals',
    'goals.show_n': 'Show {n}',
    'goals.hide': 'Hide',
    'goals.edit_goal': 'Edit goal',
    'goals.solo_sub': 'Yours alone. Nobody else can see these.',
    'goals.empty_solo':
      'Nothing here yet. These are private: no group needed, and nobody sees them but you.',
    'goal.edit': 'Edit',
    'goal.done': 'done',
    'goal.dropped': 'dropped',
    'goal.reopen': 'Start it again',

    'me.consistency_title': 'Your consistency',
    'me.account': 'Your account',
    'me.your_goals': 'Your own goals',

    'settings.leaving': 'Leaving',
    'settings.leave_not_installed':
      'Leaving is not switched on in the database yet. In Supabase, run supabase/09_solo_goals_and_leaving.sql, then try again.',
    'settings.delete_admin_only': 'Only an admin can delete this group.',
    'settings.leave': 'Leave this group',
    'settings.delete': 'Delete the group',
    'settings.keep': 'Never mind',
    'settings.leave_confirm': 'Leave {group}?',
    'settings.leave_note':
      'Your own goals come with you and stay in Your goals. The group keeps its history, and you can rejoin with the invite code. If you are the last one out, the group is deleted.',
    'settings.leave_yes': 'Yes, leave',
    'settings.delete_confirm': 'Delete {group} for everyone?',
    'settings.delete_note':
      'This removes the group, its cycles and every check-in in it, for all members. Personal goals are kept and become private to whoever wrote them. It cannot be undone.',
    'settings.delete_yes': 'Delete it permanently',

    'form.mine': 'Mine',
    'form.whole_group': 'Whole group',
    'form.commitment': 'The commitment',
    'form.commitment_hint': 'The action you take, not the result you hope for.',
    'form.commitment_ph': 'Post 3 videos',
    'form.step_what': 'What are you committing to?',
    'form.step_often': 'How often?',
    'form.step_when': 'When will you actually do it?',
    'form.step_proof': 'Proof and stakes',
    'form.optional_step': 'Both optional.',
    'form.cadence_hint': '',
    'form.times_hint': '',
    'form.until_hint': 'Leave empty to keep going.',
    'form.where_hint':
      'A note to yourself, nothing more. The app has no idea where you are and never asks. Writing the place down is what makes the plan specific enough to act on.',
    'form.remind': 'Email me this before check-in',
    'form.remind_hint':
      'Your commitment and the when-and-where, in the digest that already goes out before the window opens. Never more than one email per cycle.',
    'form.outcome_1':
      'That reads like a result rather than an action. Results depend on things you don’t control, so a bad week looks like failure even when you did the work.',
    'form.outcome_2': 'What would you do each week to get there? Track that instead.',
    'form.keep_as_is': 'Keep as is',
    'form.rewrite': 'Let me rewrite',
    'form.cadence': 'How often',
    'form.every_cycle': 'Every cycle',
    'form.one_off': 'One-off',
    'form.times_per_cycle': 'How many times',
    'form.until': 'Stop after (optional)',
    'form.due_by': 'Due by',
    'form.when': 'When',
    'form.when_hint':
      'Naming a specific moment roughly doubles follow-through compared with stating the intention alone. "After my Tuesday lecture" beats "twice a week".',
    'form.when_ph': 'After my Tuesday lecture',
    'form.where': 'Where (optional)',
    'form.where_ph': 'At the library, third floor',
    'form.evidence': 'How you’ll show it happened',
    'form.evidence_hint': '',
    'form.evidence_ph': 'Links to the posted videos',
    'form.stake': 'Stake (optional)',
    'form.stake_hint': 'Settled between you. The app only remembers it.',
    'form.stake_ph': 'Coffee for whoever asks',
    'form.save_changes': 'Save changes',
    'form.add_goal': 'Add goal',
    'form.saving': 'Saving',
    'form.required': 'A commitment and a when are needed to save.',

    'me.consistency': 'Your consistency',
    'me.quiet_label': 'Been a couple of cycles',
    'me.still_in': 'Still in?',
    'me.still_in_body': 'Park what’s there and pick one thing. No catching up, no backlog.',
    'me.reset': 'I’m still in, reset me',
    'me.last14': 'Last 14 cycles',
    'me.checked_in': 'Checked in',
    'me.live_goals': 'Live goals',
    'me.away': 'Away',
    'me.not_counted': 'Not counted',
    'me.no_cycles': 'No cycles yet',
    'me.rate_note':
      'A rate, not a streak. A bad cycle moves this a few points. It never resets anything to zero.',
    'me.last12': 'Last 12 cycles',
    'me.rate_window': 'last 14 cycles',
    'me.rate_note_short': '3-cycle average',
    'me.legend_in': 'In',
    'me.legend_away': 'Away',
    'me.legend_missed': 'Missed',
    'me.sign_out': 'Sign out',
    'me.one_thing': 'One thing',

    'settings.group_rate': 'Group check-in rate',
    'settings.people': 'People',
    'settings.everyone': 'Everyone',
    'settings.send_to_friend': 'Send to a friend',
    'settings.invite_note':
      'Conversation lives in your group chat, not here. This app only holds the check-in.',
    'settings.switch_group': 'Switch group',
    'settings.language': 'Language',

    'theme.title': 'Theme',
    'theme.colour': 'Colour',
    'theme.name_sun': 'Sun',
    'theme.name_sea': 'Sea',

    'err.title': 'Something went wrong',
    'err.signin_failed': 'Sign-in didn’t complete.',
    'err.provider_disabled':
      'Google sign-in isn’t switched on for this project yet. Use email instead, or enable the Google provider in Supabase.',
    'err.redirect_not_allowed':
      'This address isn’t on the sign-in allowlist. Add it under Authentication → URL Configuration in Supabase.',
    'err.load_failed': 'Couldn’t reach the server. Your connection may be down.',
    'err.no_tables':
      'The database is empty. The tables have not been created yet. In Supabase, open the SQL Editor and run supabase/01_schema.sql, then 02_functions.sql, then 03_policies.sql, pasting the contents of each file.',
    'err.no_library_tables':
      'The library tables do not exist yet. In Supabase, open the SQL Editor and run supabase/07_books_all_in_one.sql. A single paste that creates the tables and adds the three books.',
    'err.unknown_book':
      'There is no book with the address “{slug}”. It may have been renamed. The three books are on the Library page.',
    'err.no_chapters':
      'This book has no chapters in the database. In Supabase, run supabase/07_books_all_in_one.sql to create them, then supabase/08_chapter_bodies.sql to fill in the writing.',
    'err.preview_missing':
      'The free chapter is missing from the database rather than locked. Chapter 1 is readable by everyone, so this is not something buying the book would fix. In Supabase, run supabase/07_books_all_in_one.sql and then supabase/08_chapter_bodies.sql.',
    'err.retry': 'Try again',
    'err.loading': 'Loading',

    'nav.library': 'Library',
    'library.sub': 'Three books, read here',
    'library.empty':
      'The catalogue is empty. In Supabase, open the SQL Editor and run supabase/07_books_all_in_one.sql. It adds the three books.',
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
    'preview.rest_title': 'The other {n} chapters',
    'preview.buy': 'Buy the book · {price}',
    'preview.opening': 'Opening checkout',
    'preview.already_bought': 'Already bought it? Sign in',
    'reader.free_preview': 'free preview',
    'reader.free': 'Free',
    'reader.locked': 'Locked',
    'reader.locked_title': 'This chapter is part of the full book',
    'reader.locked_body':
      'Chapter 1 is free to read. The rest opens once you have the book.',
    'reader.local_only':
      'The rest of this book is not connected yet. The free chapter is included in the app; the paid chapters arrive once the catalogue is set up in Supabase.',
    'reader.unlock': 'Get the book',
    'reader.previous': 'Previous',
    'reader.next': 'Next',

    'ui.close': 'Close',
    'ui.save': 'Save',
  },

  fr: {
    'nav.home': 'Accueil',
    'nav.goals': 'Objectifs',
    'nav.you': 'Toi',
    'nav.group': 'Groupe',
    'nav.board': 'Tableau',

    'home.morning': 'Bonjour',
    'home.afternoon': 'Bon après-midi',
    'home.evening': 'Bonsoir',
    'home.sub': 'Tout ce dont tu fais partie, au même endroit.',
    'home.your_groups': 'Tes groupes',
    'home.no_groups': 'Tu n’es encore dans aucun groupe. Crée-en un, ou rejoins-en un avec le code d’un ami.',
    'home.new': '+ Nouveau',
    'home.groups': 'Groupes',
    'home.waiting_on_you': '{group} t’attend',
    'home.n_of_total': '{n} sur {total}',
    'home.you_overall': 'Toi, tous groupes confondus',
    'home.your_books': 'Tes livres',
    'home.no_books': 'Rien d’acheté pour l’instant. Le premier chapitre de chacun est en accès libre.',

    'sync.queued_one': 'Enregistré. Ça partira dès que tu seras reconnecté.',
    'sync.queued_other': 'Enregistrés. Ils partiront dès que tu seras reconnecté.',
    'sync.offline': 'Tu es hors ligne. Ce que tu écris partira tout seul plus tard.',

    'board.open_for': 'Encore ouvert {t}',
    'board.reveals_in': 'La semaine de tout le monde s’affiche dans {t}',
    'board.sealed_note':
      'Tu peux faire ton point quand tu veux dans la semaine. Personne ne voit les réponses des autres avant la fin de la semaine.',
    'board.last_week': 'Semaine du {d}',
    'board.opens_in': 'Ouvre dans {t}',
    'board.next_opens_in': 'Le prochain ouvre dans {t}',
    'board.closed': 'Fermé pour l’instant',
    'board.getting_ready': 'On prépare tout',
    'board.ready': 'Quand tu veux',
    'board.nothing_listed': 'Rien sur ta liste. Commence par ajouter quelque chose.',
    'board.things_to_look_at_one': '{n} chose à regarder. Une minute suffit.',
    'board.things_to_look_at_other': '{n} choses à regarder. Une minute suffit.',
    'board.check_in': 'Faire le point',
    'settings.role_creator': 'Créateur du groupe',
    'settings.role_admin': 'Admin',
    'settings.promote': 'Nommer admin',
    'settings.demote': 'Retirer admin',
    'settings.permissions': 'Permissions',
    'settings.admins_can_delete': 'Autoriser les admins à supprimer ce groupe',
    'settings.admins_can_delete_on': 'Les admins peuvent le supprimer. Tout le monde perd son historique.',
    'settings.admins_can_delete_off': 'Désactivé. Toi seul peux supprimer ce groupe.',
    'settings.roles_not_installed':
      'Les rôles ont besoin de la base. Exécute supabase/18_daily_roles_and_feed.sql dans Supabase.',
    'board.today_objective': 'Objectif du jour',
    'board.one_tap_done': 'Marquer fait',
    'board.done_today': 'Tout est fait aujourd’hui',
    'board.feed': 'Récemment',
    'board.missed_line': '{name} a manqué son objectif : « {goal} » aujourd’hui.',
    'board.this_week': 'Cette semaine',
    'board.how_we_are': 'Où en est le groupe',
    'board.rate_note': 'Les points de tout le monde sur les quatorze dernières semaines. Les semaines d’absence ne comptent pas comme des oublis.',
    'board.moods_today': 'Comment vont les autres aujourd’hui',
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
      'Tu es seul pour l’instant. Envoie ce code à un ami. De deux à six, c’est l’idéal.',
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
      'C’est toi qui t’en occupes. Écris-lui, et parle de lui, pas de l’appli.',
    'nudge.claimed_by_other': '{name} prend de ses nouvelles.',
    'nudge.assigned': 'Personne ne s’en est chargé, alors ça te revient. Un message suffit.',
    'nudge.open': 'Quelqu’un devrait lui écrire. Là où vous parlez vraiment, pas ici.',
    'nudge.claim': 'Je m’en occupe',
    'nudge.close': 'C’est fait, on s’est parlé',
    'nudge.busy': 'Un instant',

    'signin.title': 'Rejoins des gens qui avancent.',
    'signin.pitch':
      'Un point par semaine, au même moment, avec les mêmes personnes. Une minute. C’est tout.',
    'signin.google': 'Continuer avec Google',
    'signin.use_email': 'Utiliser mon e-mail',
    'signin.email': 'E-mail',
    'signin.send_code': 'Envoyez-moi un code',
    'signin.sending': 'Envoi',
    'signin.code': 'Code à six chiffres',
    'signin.code_sent': 'Code envoyé à {email}. Il expire rapidement.',
    'signin.verify': 'Se connecter',
    'signin.verifying': 'Vérification',
    'signin.wrong_email': 'Utiliser une autre adresse',

    'money.title': 'Argent',
    'money.sub_new': 'Être riche commence par le planifier.',
    'money.sub_period': 'Il reste {days} jours dans cette période',
    'money.pitch':
      'Indique ce qui rentre, ce qui est déjà promis à quelqu’un d’autre, et ce que tu gardes. Le reste est calculé : ce qui est vraiment à toi, réparti sur les jours qui restent. Deux minutes une fois, ensuite c’est un seul chiffre.',
    'money.set_up': 'Configurer',
    'money.edit_plan': 'Modifier',
    'money.not_installed': 'Les tables budget ne sont pas encore dans la base.',

    'money.today_label': 'Disponible aujourd’hui',
    'money.today_body': '{left} restants, sur {days} jours.',
    'money.over_label': 'Dépassement de',
    'money.over_body':
      'L’argent libre de cette période est parti et il reste {days} jours. Le reste sort de ce que tu gardais.',
    'money.overcommitted_title': 'Ce plan ne tient pas.',
    'money.overcommitted_body':
      'Les charges fixes et l’épargne font {fixed}, contre {income} qui rentrent. Il manque {over} avant même d’avoir dépensé quoi que ce soit. Baisse l’épargne, ou une charge fixe doit sauter.',
    'money.overcommitted_short': 'Il manque {over} avant toute dépense.',

    'money.add_title': 'Ajouter',
    'money.kind_expense': 'Dépensé',
    'money.kind_income': 'Rentré',
    'money.add': 'Ajouter',
    'money.remove': 'Retirer',

    'money.cat_food': 'Nourriture',
    'money.cat_transport': 'Transport',
    'money.cat_home': 'Maison',
    'money.cat_fun': 'Plaisir',
    'money.cat_health': 'Santé',
    'money.cat_other': 'Autre',

    'money.this_period': 'Cette période',
    'money.left': 'Restant',
    'money.spent': 'Dépensé',
    'money.days_left': 'Jours restants',
    'money.where': 'Où c’est parti',
    'money.recent': 'Récent',
    'money.no_entries': 'Rien d’enregistré pour cette période.',

    'money.plan_title': 'Ton plan',
    'money.income': 'Ce qui rentre, par mois',
    'money.income_hint': 'Ce qui arrive vraiment sur ton compte, après impôts.',
    'money.payday': 'Jour de paie',
    'money.payday_hint': 'La période va de paie à paie, pas du 1er au 31.',
    'money.savings': 'Ce que tu gardes, par mois',
    'money.savings_hint': 'Paie-toi en premier. Retiré avant tout le reste.',
    'money.fixed': 'Charges fixes',
    'money.fixed_hint': 'Loyer, téléphone, transport, abonnements. L’argent déjà promis.',
    'money.fixed_label_ph': 'Loyer',
    'money.add_fixed': 'Ajouter une charge',
    'money.save': 'Enregistrer',
    'money.saving': 'Enregistrement',

    'start.new_group': 'Nouveau groupe',
    'start.join_one': 'Rejoindre',
    'start.group_name': 'Nom du groupe',
    'start.group_name_ph': 'Les Quatre du Dimanche',
    'start.checkin_opens': 'Le point ouvre',
    'start.checkin_hint':
      'Tout le monde fait le point dans la même fenêtre. C’est ce moment partagé qui fait tenir un groupe. Des points décalés, ce n’est qu’un formulaire toujours ouvert.',
    'start.window_note': 'La journée repart à minuit · {tz}',
    'start.create': 'Créer le groupe',
    'start.creating': 'Création',
    'start.invite_code': 'Code d’invitation',
    'start.invite_hint': 'Six caractères, donnés par la personne qui a créé le groupe.',
    'start.join': 'Rejoindre',
    'start.joining': 'Connexion',

    'checkin.title': 'Le point',
    'checkin.closes_in': 'Ferme dans {t}',
    'checkin.window_closed': 'Fenêtre fermée',
    'checkin.between': 'Entre deux semaines',
    'checkin.between_body':
      'La semaine passée est bouclée et la nouvelle commence dans {t}. Tu auras toute la semaine pour l’écrire, pas seulement la soirée.',
    'checkin.no_cycle_body':
      'Ce groupe n’a pas encore de fenêtre de point. La première est en cours de création. Elle apparaîtra ici au jour et à l’heure choisis par le groupe.',
    'checkin.closed_body':
      'La fenêtre de ce cycle est fermée. La prochaine ouvre dans {t}. Rien à rattraper d’ici là.',
    'checkin.no_goals':
      'Aucun objectif actif. Commence par en ajouter un : il faut quelque chose à pointer.',
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
    'mood.question_day': 'C’est quoi l’humeur du jour ?',
    'mood.today_is': 'L’humeur du jour, c’est',
    'mood.choose': 'Choisir',
    'mood.change': 'Changer',
    'mood.clear': 'Effacer',
    'mood.optional': 'Facultatif, et jamais compté d’une façon ou d’une autre.',
    'mood.hint': 'Facultatif, et jamais compté. Retape dessus pour l’enlever.',
    'mood.when':
      'C’est la première question du point. Ça s’ouvre quand la nouvelle semaine commence, et c’est toujours facultatif.',
    'mood.share': 'Laisser mes groupes le voir',
    'mood.share_on': 'Les gens de tes groupes voient ton humeur du jour. Celle d’aujourd’hui seulement, et seulement tant que c’est activé.',
    'mood.share_off': 'Désactivé. Personne d’autre ne le voit.',
    'mood.share_unavailable':
      'Le partage a besoin de la base. Ton humeur du jour est enregistrée sur cet appareil, et un appareil ne peut la montrer à personne. Exécute supabase/12_daily_mood.sql dans Supabase pour activer le partage.',
    'mood.local_note': 'Enregistré sur cet appareil.',
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
    'goals.past': 'Objectifs passés',
    'goals.show_n': 'Afficher {n}',
    'goals.hide': 'Masquer',
    'goals.edit_goal': 'Modifier l’objectif',
    'goals.solo_sub': 'Rien qu’à toi. Personne d’autre ne les voit.',
    'goals.empty_solo':
      'Rien ici pour l’instant. Ceux-là sont privés : pas besoin de groupe, et personne d’autre ne les voit.',
    'goal.edit': 'Modifier',
    'goal.done': 'terminé',
    'goal.dropped': 'abandonné',
    'goal.reopen': 'Relancer',

    'me.consistency_title': 'Ta régularité',
    'me.account': 'Ton compte',
    'me.your_goals': 'Tes propres objectifs',

    'settings.leaving': 'Quitter',
    'settings.leave_not_installed':
      'Quitter un groupe n’est pas encore activé dans la base. Dans Supabase, exécute supabase/09_solo_goals_and_leaving.sql, puis réessaie.',
    'settings.delete_admin_only': 'Seul un admin peut supprimer ce groupe.',
    'settings.leave': 'Quitter ce groupe',
    'settings.delete': 'Supprimer le groupe',
    'settings.keep': 'Annuler',
    'settings.leave_confirm': 'Quitter {group} ?',
    'settings.leave_note':
      'Tes objectifs personnels te suivent et restent dans Tes objectifs. Le groupe garde son historique, et tu peux revenir avec le code d’invitation. Si tu es le dernier à partir, le groupe est supprimé.',
    'settings.leave_yes': 'Oui, quitter',
    'settings.delete_confirm': 'Supprimer {group} pour tout le monde ?',
    'settings.delete_note':
      'Cela supprime le groupe, ses cycles et tous les points qui s’y trouvent, pour tous les membres. Les objectifs personnels sont conservés et deviennent privés. C’est irréversible.',
    'settings.delete_yes': 'Supprimer définitivement',

    'form.mine': 'Le mien',
    'form.whole_group': 'Tout le groupe',
    'form.commitment': 'L’engagement',
    'form.commitment_hint':
      'Ce qui se fait concrètement. Pas le résultat visé, mais l’action elle-même.',
    'form.commitment_ph': 'Publier 3 vidéos',
    'form.step_what': 'Tu t’engages à quoi ?',
    'form.step_often': 'À quelle fréquence ?',
    'form.step_when': 'Tu le feras quand, concrètement ?',
    'form.step_proof': 'Preuve et gage',
    'form.optional_step': 'Les deux sont facultatifs.',
    'form.cadence_hint': '',
    'form.times_hint': '',
    'form.until_hint': 'Laisse vide pour continuer indéfiniment.',
    'form.where_hint':
      'Une note pour toi, rien de plus. L’app ne sait pas où tu es et ne le demande jamais. Écrire le lieu, c’est ce qui rend le plan assez précis pour être suivi.',
    'form.remind': 'Me l’envoyer par e-mail avant le point',
    'form.remind_hint':
      'Ton engagement et le quand-et-où, dans le récap qui part déjà avant l’ouverture. Jamais plus d’un e-mail par cycle.',
    'form.outcome_1':
      'Ça ressemble à un résultat plutôt qu’à une action. Un résultat dépend de choses hors de ton contrôle : une mauvaise semaine ressemble à un échec même quand tu as fait le travail.',
    'form.outcome_2': 'Que ferais-tu chaque semaine pour y arriver ? Suis plutôt ça.',
    'form.keep_as_is': 'Garder ainsi',
    'form.rewrite': 'Je reformule',
    'form.cadence': 'À quelle fréquence',
    'form.every_cycle': 'Chaque cycle',
    'form.one_off': 'Une seule fois',
    'form.times_per_cycle': 'Combien de fois',
    'form.until': 'Jusqu’au (optionnel)',
    'form.due_by': 'Avant le',
    'form.when': 'Quand',
    'form.when_hint':
      'Préciser quand et où double à peu près les chances de s’y tenir, par rapport à une simple intention.',
    'form.when_ph': 'Après mon cours du mardi',
    'form.where': 'Où (facultatif)',
    'form.where_ph': 'À la bibliothèque, deuxième étage',
    'form.evidence': 'La preuve',
    'form.evidence_hint': '',
    'form.evidence_ph': 'Les liens vers les vidéos publiées',
    'form.stake': 'Gage (optionnel)',
    'form.stake_hint': 'À régler entre vous. L’appli ne fait que s’en souvenir.',
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
    'me.reset': 'Je suis toujours là, remets à zéro',
    'me.last14': '14 derniers cycles',
    'me.checked_in': 'Points faits',
    'me.live_goals': 'Objectifs actifs',
    'me.away': 'Absences',
    'me.not_counted': 'Non comptées',
    'me.no_cycles': 'Aucun cycle',
    'me.rate_note':
      'Un taux, pas une série. Un mauvais cycle fait bouger ça de quelques points. Rien ne repart jamais de zéro.',
    'me.last12': '12 derniers cycles',
    'me.rate_window': '14 derniers cycles',
    'me.rate_note_short': 'moyenne sur 3 cycles',
    'me.legend_in': 'Fait',
    'me.legend_away': 'Absent',
    'me.legend_missed': 'Manqué',
    'me.sign_out': 'Se déconnecter',
    'me.one_thing': 'Une seule chose',

    'settings.group_rate': 'Taux du groupe',
    'settings.people': 'Membres',
    'settings.everyone': 'Tout le monde',
    'settings.send_to_friend': 'Envoyer à un ami',
    'settings.invite_note':
      'Les discussions se passent dans votre groupe habituel, pas ici. Cette appli ne garde que le point.',
    'settings.switch_group': 'Changer de groupe',
    'settings.language': 'Langue',

    'theme.title': 'Thème',
    'theme.colour': 'Couleur',
    'theme.name_sun': 'Soleil',
    'theme.name_sea': 'Mer',

    'err.title': 'Quelque chose a échoué',
    'err.signin_failed': 'La connexion n’est pas allée au bout.',
    'err.provider_disabled':
      'La connexion Google n’est pas encore activée sur ce projet. Utilise l’e-mail, ou active le fournisseur Google dans Supabase.',
    'err.redirect_not_allowed':
      'Cette adresse n’est pas autorisée pour la connexion. Ajoute-la dans Authentication → URL Configuration sur Supabase.',
    'err.load_failed': 'Impossible de joindre le serveur. Ta connexion est peut-être coupée.',
    'err.no_tables':
      'La base est vide. Les tables n’ont pas encore été créées. Dans Supabase, ouvre l’éditeur SQL et exécute supabase/01_schema.sql, puis 02_functions.sql, puis 03_policies.sql, en collant le contenu de chaque fichier.',
    'err.no_library_tables':
      'Les tables de la bibliothèque n’existent pas encore. Dans Supabase, ouvre l’éditeur SQL et exécute supabase/07_books_all_in_one.sql. Un seul copier-coller qui crée les tables et ajoute les trois livres.',
    'err.unknown_book':
      'Aucun livre ne correspond à l’adresse « {slug} ». Il a peut-être été renommé. Les trois livres sont sur la page Lectures.',
    'err.no_chapters':
      'Ce livre n’a aucun chapitre dans la base. Dans Supabase, exécute supabase/07_books_all_in_one.sql pour les créer, puis supabase/08_chapter_bodies.sql pour le texte.',
    'err.preview_missing':
      'Le chapitre gratuit est absent de la base, pas verrouillé. Le chapitre 1 est lisible par tout le monde : acheter le livre n’y changerait rien. Dans Supabase, exécute supabase/07_books_all_in_one.sql puis supabase/08_chapter_bodies.sql.',
    'err.retry': 'Réessayer',
    'err.loading': 'Chargement',

    'nav.library': 'Lectures',
    'library.sub': 'Trois livres, à lire ici',
    'library.empty':
      'Le catalogue est vide. Dans Supabase, ouvre l’éditeur SQL et exécute supabase/07_books_all_in_one.sql. Il ajoute les trois livres.',
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
    'preview.rest_title': 'Les {n} autres chapitres',
    'preview.buy': 'Acheter le livre · {price}',
    'preview.opening': 'Ouverture du paiement',
    'preview.already_bought': 'Déjà acheté ? Connecte-toi',
    'reader.free_preview': 'extrait gratuit',
    'reader.free': 'Gratuit',
    'reader.locked': 'Verrouillé',
    'reader.locked_title': 'Ce chapitre fait partie du livre complet',
    'reader.locked_body':
      'Le chapitre 1 est en accès libre. La suite s’ouvre une fois le livre acquis.',
    'reader.local_only':
      'La suite de ce livre n’est pas encore connectée. Le chapitre gratuit est inclus dans l’app ; les chapitres payants arrivent une fois le catalogue installé dans Supabase.',
    'reader.unlock': 'Obtenir le livre',
    'reader.previous': 'Précédent',
    'reader.next': 'Suivant',

    'ui.close': 'Fermer',
    'ui.save': 'Enregistrer',
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
        /* storage disabled. The choice just won't survive a reload */
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
