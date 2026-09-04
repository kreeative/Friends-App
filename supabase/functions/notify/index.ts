/**
 * Scheduled sender. The piece a static site cannot provide.
 *
 * A Netlify-hosted bundle only runs when someone opens it, and the person the
 * app most needs to reach is the one who has stopped opening it. So the two
 * outbound messages live here, on a schedule, instead of in the client.
 *
 * The ceiling is one email per kind per person per cycle and it is enforced by
 * the database, not by this code: every send first claims a row in
 * notifications_log, whose unique (user_id, cycle_id, kind) constraint makes a
 * duplicate physically impossible even if this function runs twice.
 *
 * A claim is GIVEN BACK when the send does not happen. Taking it first is what
 * makes the ceiling real; keeping it after a failure made the ceiling into a
 * trap, where one refused send cost somebody their only message of the cycle
 * for good. See release().
 *
 *   digest  . A few hours before the window opens: what you committed to
 *   nudge   . A day after somebody goes quiet, addressed TO them. If a friend
 *             volunteered in the app it is sent in that friend's name, which
 *             is the version that has a chance of working
 *   birthday. Three days before a friend's birthday, addressed to everybody
 *             else, because on the day itself it is too late to do anything
 *             but send a message
 *
 * Deploy:  supabase functions deploy notify --no-verify-jwt
 * Secrets: supabase secrets set RESEND_API_KEY=...
 *
 * MAIL_FROM is optional and should usually be left alone. See the note on it
 * below: the default is the address the rest of the product already sends from,
 * and using a second one costs deliverability for no gain.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { type Block, layout, plain } from './template.ts'
import { sendPush } from './push.ts'

const SITE = Deno.env.get('SITE_URL') ?? 'https://richandfriends.xyz'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const RESEND_KEY = Deno.env.get('RESEND_API_KEY')
/**
 * ONE SENDING ADDRESS FOR THE WHOLE PRODUCT, AND WHY IT MATTERS.
 *
 * This defaulted to Resend's shared sandbox domain, and the deploy note above
 * used to suggest MAIL_FROM="Friends <hi@yourdomain>" as the example to copy.
 * Both were wrong, and the second one caused a real problem: the sign-in codes
 * go out as hello@, because that is what Supabase's own mail settings use, so
 * following the example split the product across two senders.
 *
 * Mailbox providers build reputation per ADDRESS, not only per domain. A
 * verified domain gets the message accepted; it does not decide which folder
 * it lands in. hello@ had weeks of one-to-one sign-in mail behind it, and hi@
 * had never sent anything until nine near-identical messages went out at once,
 * which is the exact profile of a bulk send from a stranger.
 *
 * So the default is the address that already reaches people. Overriding it is
 * still possible and is still the right thing when the domain is different,
 * but it should not be done to pick a nicer word before the @.
 */
const MAIL_FROM = Deno.env.get('MAIL_FROM') ?? 'Rich & Friends <hello@richandfriends.xyz>'

/**
 * A human address, used for two different jobs.
 *
 * As Reply-To, because a message nobody can answer is a message from a robot,
 * and mailbox providers weigh that. It is the same address the settings screen
 * offers for support, so an answer arrives somewhere a person reads.
 *
 * As the List-Unsubscribe target, for the reason below.
 */
const SUPPORT = Deno.env.get('SUPPORT_EMAIL') ?? 'contact@richandfriends.xyz'

/**
 * WHY DELIVERED IS NOT THE SAME AS RECEIVED.
 *
 * Resend reporting "Delivered" means the receiving server accepted the message.
 * What Gmail does with it after that is a separate decision, and a bulk sender
 * with no unsubscribe header and no reply address is one it files under
 * Promotions or Spam without telling anybody.
 *
 * List-Unsubscribe is the cheapest signal there is and this had none.
 *
 * A mailto rather than a URL, and no List-Unsubscribe-Post. One-click
 * unsubscribe means a provider will POST to that URL and expect the person to
 * be unsubscribed by the time it answers. Nothing in this app answers such a
 * POST, so declaring it would be promising something that does not exist,
 * which is worse than not declaring it: the provider tries, fails, and now
 * distrusts the sender. A mailto needs no endpoint and is honoured.
 */
const UNSUB = `<mailto:${SUPPORT}?subject=Unsubscribe>`

/**
 * VAPID, which is what lets a push service believe this is us.
 *
 * Generated once with `node scripts/vapid.mjs` and set as secrets. The public
 * half is also compiled into the browser bundle as VITE_VAPID_PUBLIC_KEY and
 * the two MUST be the same pair: a browser subscribes with the public key, and
 * a push signed by a different private key is refused with 403 by every
 * service. That is the one mistake here that produces a clean-looking failure.
 */
const VAPID = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  subject: Deno.env.get('VAPID_SUBJECT') ?? `mailto:${SUPPORT}`,
}
const PUSH_READY = Boolean(VAPID.publicKey && VAPID.privateKey)

/**
 * The same news, on the lock screen.
 *
 * WHY THIS IS IN ADDITION TO THE EMAIL AND NOT INSTEAD OF IT.
 *
 * The email demonstrably arrives; what it does not do is get noticed, because
 * whether a message lights up a phone is Gmail's decision on the recipient's
 * device. A push is the opposite: it appears on the lock screen, the wording is
 * ours, and nobody has to configure anything. But it only reaches browsers that
 * have subscribed, which is nobody on the first day and never anybody who said
 * no. Dropping the email would trade a channel that reaches everyone quietly
 * for one that reaches some people loudly.
 *
 * Both go out under the SAME claim in notifications_log. One piece of news is
 * one message however many ways it travels, and claiming twice would let
 * somebody get the push this hour and the email next.
 *
 * A dead subscription is deleted rather than retried. 404 and 410 mean the
 * browser is gone or permission was revoked, and a row that will never work
 * again would otherwise be posted to every hour forever.
 */
async function pushTo(
  userId: string,
  note: { title: string; body: string; url: string; tag: string },
): Promise<{ devices: number; delivered: number }> {
  if (!PUSH_READY) return { devices: 0, delivered: 0 }

  const { data: subs } = await supabase
    .from('push_subscription')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)

  /**
   * COUNTED, AND HANDED BACK.
   *
   * This returned nothing, so deliverNudge answered sent: true whether it had
   * reached five phones or none at all. Somebody who has never turned
   * notifications on has no rows here, the loop below runs zero times, and the
   * card in the app then said "they have just been told, on their phone"
   * about a phone that was never contacted.
   *
   * That is the same mistake as claiming a delivery from the old function's
   * truthy tally, made one layer further down. A send is not a delivery, and
   * zero devices is not a failure either: it is a fact about the other person
   * that the sender should simply be told.
   */
  let delivered = 0
  const devices = (subs ?? []).length

  for (const sub of subs ?? []) {
    let result: string
    try {
      result = await sendPush(sub as any, JSON.stringify(note), VAPID)
    } catch (err) {
      /* One unreachable push service must not take the run down with it: the
         email for this person has already gone, and the next person's has not. */
      console.error('push threw', String(err).slice(0, 200))
      tally.pushFailed += 1
      continue
    }

    if (result === 'sent') {
      tally.pushed += 1
      delivered += 1
      await supabase
        .from('push_subscription')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('endpoint', sub.endpoint)
    } else if (result === 'gone') {
      tally.pushDropped += 1
      await supabase.from('push_subscription').delete().eq('endpoint', sub.endpoint)
    } else {
      tally.pushFailed += 1
    }
  }

  return { devices, delivered }
}

/**
 * THE WORDS, IN BOTH LANGUAGES.
 *
 * These two messages were English only. The app has been bilingual since it
 * shipped, but the language lived in localStorage and this function runs with
 * nobody's browser attached, so it had nothing to read and wrote to everybody
 * in English. On a product whose own survey is 91 % Ivorian, the single
 * message sent to somebody who has gone quiet was arriving in a language they
 * may not read.
 *
 * profiles.locale (migration 46) is what fixed that. It is nullable, so a
 * profile that has never been seen by the client falls back rather than
 * failing, and `fr` is the fallback rather than `en` because that is what most
 * of the people this app is for actually speak.
 *
 * The copy is here rather than in template.ts because template.ts is layout:
 * it knows about tables and preheaders and dark mode, and it should not also
 * be the place two languages are kept in step.
 */
type Loc = 'fr' | 'en'
const localeOf = (raw: unknown): Loc => (raw === 'en' ? 'en' : 'fr')

const COPY = {
  /**
   * DU VRAI FRANCAIS, AVEC LES ACCENTS ET LES APOSTROPHES.
   *
   * Ce bloc etait en ASCII pur, et rendu dans une boite de reception ca donnait
   * "C est une question", "Ouvre l application", "Il n y a pas de retard",
   * "Envoye une fois". Ce n'est pas une contrainte technique qui produisait ca :
   * l'apostrophe est de l'ASCII, elle sautait seulement parce que les chaines
   * etaient entre guillemets simples et que personne ne voulait les echapper.
   * Le resultat ressemblait a du spam mal traduit, dans le seul message que
   * l'application envoie a quelqu'un qui ne l'ouvre plus.
   *
   * La regle ASCII du depot vise le SQL colle dans l'editeur Supabase, ou un
   * octet abime donne "invalid byte sequence" et une erreur qui designe la
   * mauvaise ligne. Ici c'est du TypeScript : un accent abime s'affiche mal,
   * il ne casse rien, et le fichier transporte deja des caracteres accentues.
   *
   * Les guillemets francais sont voulus. Le corps cite un bouton de
   * l'application, et « ... » evite d'echapper des guillemets droits a
   * l'interieur d'une chaine qui en est deja entouree.
   */
  fr: {
    digestSubject: (g: string) => `Le point ouvre ce soir. ${g}`,
    digestTitle: 'Le point ouvre ce soir',
    digestPre: (g: string, n: number) =>
      `${g} · ${n} chose${n === 1 ? '' : 's'} à regarder, environ une minute.`,
    digestLead: 'Ce que tu as dit que tu ferais :',
    digestCta: 'Faire le point',
    digestTail: 'Moins d’une minute. Rien à rattraper si tu le manques.',

    /* SANS PERSONNE À NOMMER. Personne n’a encore touché « Je m’en occupe »,
       donc le message ne peut pas prétendre que quelqu’un demande de tes
       nouvelles : ce serait inventer un ami inquiet pour faire revenir
       quelqu’un. Il pose la question lui-même, ce qui reste vrai. */
    nudgeSubject: (g: string) => `Tout va bien ? ${g}`,
    nudgeTitle: 'Tout va bien ?',
    nudgePre: (g: string) => `Personne ne t’a vu dans ${g} depuis deux semaines.`,
    nudgeLead: (g: string) => `Ça fait deux semaines qu’on ne te voit pas dans ${g}.`,
    /* « Quand tu es prête » est parti d’ici : un accord féminin dans un message
       envoyé à tout le monde se trompe une fois sur deux. */
    nudgeBody:
      'C’est une question, pas un reproche. Ouvre l’application et touche « Je suis toujours là » : ça met en pause tout ce qui traîne et te demande une seule chose. Il n’y a pas de retard à combler et rien à expliquer.',
    nudgeCta: 'Je suis toujours là',
    nudgeFoot: (g: string) => `Envoyé une fois, parce que tu es dans ${g}. Il n’y en aura pas de deuxième.`,

    /* AVEC QUELQU’UN À NOMMER. Quelqu’un a vraiment touché « Je m’en occupe »
       dans le groupe, donc le nom est un fait et pas une tournure. C’est la
       version qui a une chance de marcher : ce qui ramène une personne qui a
       arrêté d’ouvrir une application, c’est un ami, pas une notification. */
    /**
     * Her sentence, with the participle agreed rather than guessed.
     *
     * "se demande ou tu es passe" is what was asked for. The participle agrees
     * with the person reading it, so it is "passee" for a woman, and the only
     * thing the app may consult for that is what somebody put in the pronouns
     * box. See isFeminine: set to she/her means "passee", everything else
     * including an empty box takes the masculine, which is French's default
     * for an unknown subject. A name is never read.
     *
     * An earlier version dropped the participle to sidestep this. That was the
     * safe sentence rather than the right one, and it was overruled.
     */
    nudgeFromSubject: (who: string, fem?: boolean) =>
      `${who} se demande où tu es pass${fem ? 'ée' : 'é'}`,
    nudgeFromTitle: (who: string, fem?: boolean) =>
      `${who} se demande où tu es pass${fem ? 'ée' : 'é'}`,
    nudgeFromLead: (who: string, g: string) =>
      `${who} se demande comment tu vas. Ça fait deux semaines qu’on ne te voit pas dans ${g}.`,
    /**
     * The body of the instant push, which used to be nudgeCta.
     *
     * That is a button label, "Je suis toujours là", and as the second line of
     * a lock screen notification it read as something the recipient had said
     * rather than something being offered to them. A body has to be a sentence
     * about why the phone lit up.
     *
     * No obligation in it, deliberately. Somebody who has gone quiet for two
     * weeks does not need a task, and a message that arrives as one is the
     * message that gets swiped away.
     */
    nudgeNowBody: 'Rien à faire. C’est juste pour prendre de tes nouvelles.',
    /* The self test. Says what it is, so that a notification arriving out of
       nowhere on somebody's lock screen is never a mystery. */
    selfTestTitle: 'Test des notifications',
    selfTestBody: 'Si tu vois ceci, tout marche : le serveur, les clés, et cet appareil.',

    birthdaySubject: (n: number, first: string) =>
      n === 1 ? `L’anniversaire de ${first}, dans trois jours` : `${n} anniversaires dans trois jours`,
    birthdayTitle: (n: number) =>
      n === 1 ? 'Un anniversaire dans trois jours' : `${n} anniversaires dans trois jours`,
    birthdayPre: (n: number) =>
      n === 1 ? 'Trois jours pour y penser.' : `${n} personnes à qui penser, dans trois jours.`,
    birthdayLead: 'Trois jours, c’est encore le temps de faire quelque chose.',
    birthdayNote:
      'Le jour même il ne reste que le message, et il arrive avec tous les autres. Trois jours avant, on peut encore réserver, commander, écrire quelque chose qui se lit. Ceci est le rappel, pas le geste.',
    birthdayCta: 'Ouvrir le groupe',
    birthdayFoot: (g: string) => `Envoyé une fois par anniversaire, parce que tu es dans ${g}.`,

    /**
     * QUELQU’UN A AJOUTÉ UN OBJECTIF COMMUN.
     *
     * Le nom est un fait quand on l’a : created_by est la personne qui a tapé
     * l’objectif. Il peut manquer, pour tout objectif commun créé avant la
     * migration 50, et dans ce cas la phrase ne nomme personne plutôt que
     * d’inventer un auteur. Même règle que pour le rappel d’ami absent.
     */
    goalSubject: (who: string | null, g: string) =>
      who ? `${who} a ajouté un objectif commun dans ${g}` : `Un nouvel objectif commun dans ${g}`,
    goalSubjectMany: (n: number, g: string) => `${n} nouveaux objectifs communs dans ${g}`,
    goalTitle: (n: number) =>
      n === 1 ? 'Un nouvel objectif commun' : `${n} nouveaux objectifs communs`,
    goalPre: (n: number, g: string) =>
      n === 1 ? `Quelque chose de nouveau dans ${g}.` : `${n} choses nouvelles dans ${g}.`,
    goalLead: (who: string | null, g: string) =>
      who
        ? `${who} a ajouté un nouvel objectif commun dans ${g}.`
        : `Un nouvel objectif commun vient d’arriver dans ${g}.`,
    goalLeadMany: (g: string) => `Voici ce qui a été ajouté dans ${g}.`,
    /* Qui a ajouté quoi, sous chaque ligne, parce que dans un groupe la
       question suivante est toujours celle-là. */
    goalBy: (who: string) => `ajouté par ${who}`,
    goalCta: 'Ouvrir le groupe',
    goalFoot: (g: string) =>
      `Envoyé une fois par cycle au plus, parce que tu es dans ${g}. Les objectifs ajoutés ensuite arrivent dans le même message.`,

    /**
     * LE RAPPEL DE CYCLE. LE SEUL MESSAGE QUI TOUCHE A CES DONNEES.
     *
     * Adresse a la personne elle-meme et a personne d'autre. Rien dans ce
     * message ne nomme un groupe, et il ne part que si elle a coche la case.
     * La migration 51 dit pourquoi : ce sont les donnees les plus sensibles du
     * produit, et ce rappel est l'unique exception prevue.
     *
     * Le mot « regles » n'est pas dans l'objet. Un objet s'affiche sur un
     * ecran verrouille, dans une salle de cours, a cote de quelqu'un.
     */
    cycleSubject: 'Un petit rappel',
    cycleTitle: 'Un petit rappel',
    cyclePre: (n: number) =>
      n === 1 ? 'Pour demain.' : `Pour dans ${n} jours.`,
    cycleLead: (n: number) =>
      n === 1
        ? 'Tes regles sont prevues demain, d\u2019apres tes propres dates.'
        : `Tes regles sont prevues dans ${n} jours, d\u2019apres tes propres dates.`,
    cycleNote:
      'Une estimation, pas une certitude. Trois choses qui aident, si tu veux les preparer aujourd\u2019hui.',
    cycleCta: 'Ouvrir le calendrier',
    cycleFoot:
      'Tu recois ceci parce que tu l\u2019as active. Personne d\u2019autre ne le voit, et tu peux le couper dans le calendrier.',
    prepWater: 'Bois plus d\u2019eau aujourd\u2019hui.',
    prepWarmth: 'Prepare quelque chose de chaud, une infusion ou une bouillotte.',
    prepGentle: 'Prevois quelque chose de plus doux que d\u2019habitude.',

    smallPrint:
      'Au plus un message de chaque sorte par cycle. Les rappels d’objectif se coupent objectif par objectif, dans l’application.',
  },
  en: {
    digestSubject: (g: string) => `Check-in opens tonight. ${g}`,
    digestTitle: 'Check-in opens tonight',
    digestPre: (g: string, n: number) =>
      `${g} · ${n} thing${n === 1 ? '' : 's'} to look at, about a minute.`,
    digestLead: 'What you said you would do:',
    digestCta: 'Check in',
    digestTail: 'Takes under a minute. Nothing to catch up on if you miss it.',
    nudgeSubject: (g: string) => `Everything all right? ${g}`,
    nudgeTitle: 'Everything all right?',
    nudgePre: (g: string) => `Nobody has seen you in ${g} for two weeks.`,
    nudgeLead: (g: string) => `Nobody has seen you in ${g} for a couple of weeks.`,
    nudgeBody:
      'It is a question, not a complaint. Open the app and tap "I am still in": it parks everything old and asks for one thing. There is no backlog to clear and nothing to explain.',
    nudgeCta: 'I am still in',
    nudgeFoot: (g: string) => `Sent once, because you are in ${g}. There is no second one.`,

    /* English has no agreement to make, so the flag is accepted and ignored
       rather than the two locales having different shapes. */
    nudgeFromSubject: (who: string, _fem?: boolean) => `${who} is wondering where you got to`,
    nudgeFromTitle: (who: string, _fem?: boolean) => `${who} is wondering where you got to`,
    nudgeFromLead: (who: string, g: string) =>
      `${who} wants to know how you are. Nobody has seen you in ${g} for a couple of weeks.`,
    nudgeNowBody: 'Nothing to do. They just wanted to hear from you.',
    selfTestTitle: 'Notification test',
    selfTestBody: 'If you can see this, the whole chain works: the server, the keys, and this device.',

    birthdaySubject: (n: number, first: string) =>
      n === 1 ? `${first}'s birthday, in three days` : `${n} birthdays in three days`,
    birthdayTitle: (n: number) =>
      n === 1 ? 'A birthday in three days' : `${n} birthdays in three days`,
    birthdayPre: (n: number) =>
      n === 1 ? 'Three days to think of something.' : `${n} people to think of, three days out.`,
    birthdayLead: 'Three days is still enough time to do something.',
    birthdayNote:
      'On the day there is only the message left, and it arrives with everyone else’s. Three days out you can still book something, order something, write something worth reading. This is the reminder, not the gesture.',
    birthdayCta: 'Open the group',
    birthdayFoot: (g: string) => `Sent once per birthday, because you are in ${g}.`,

    goalSubject: (who: string | null, g: string) =>
      who ? `${who} added a shared goal in ${g}` : `A new shared goal in ${g}`,
    goalSubjectMany: (n: number, g: string) => `${n} new shared goals in ${g}`,
    goalTitle: (n: number) => (n === 1 ? 'A new shared goal' : `${n} new shared goals`),
    goalPre: (n: number, g: string) =>
      n === 1 ? `Something new in ${g}.` : `${n} new things in ${g}.`,
    goalLead: (who: string | null, g: string) =>
      who ? `${who} added a new shared goal in ${g}.` : `A new shared goal has appeared in ${g}.`,
    goalLeadMany: (g: string) => `Here is what was added in ${g}.`,
    goalBy: (who: string) => `added by ${who}`,
    goalCta: 'Open the group',
    goalFoot: (g: string) =>
      `Sent at most once per cycle, because you are in ${g}. Goals added after this arrive in the same message.`,

    cycleSubject: 'A small heads-up',
    cycleTitle: 'A small heads-up',
    cyclePre: (n: number) => (n === 1 ? 'For tomorrow.' : `For ${n} days from now.`),
    cycleLead: (n: number) =>
      n === 1
        ? 'Your period is expected tomorrow, going by your own dates.'
        : `Your period is expected in ${n} days, going by your own dates.`,
    cycleNote:
      'An estimate, not a certainty. Three things that help, if you want to get them ready today.',
    cycleCta: 'Open the calendar',
    cycleFoot:
      'You get this because you turned it on. Nobody else sees it, and you can switch it off in the calendar.',
    prepWater: 'Drink more water today.',
    prepWarmth: 'Get something warm ready, a tea or a bottle.',
    prepGentle: 'Plan something gentler than usual.',

    smallPrint:
      'At most one message of each kind per cycle. Goal reminders can be switched off per goal, in the app.',
  },
} as const

/**
 * Where to write, and in which language.
 *
 * Two reads rather than one because the address lives in auth.users and the
 * language in public.profiles, and there is no join across that boundary from
 * here. Returns null for the whole thing when there is no address, since a
 * language with nowhere to send it is not worth a second query.
 */
async function recipient(userId: string): Promise<{ to: string; loc: Loc; fem: boolean } | null> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  const to = data?.user?.email
  if (!to) return null

  const { data: prof } = await supabase
    .from('profiles')
    .select('locale, pronouns')
    .eq('id', userId)
    .maybeSingle()

  return { to, loc: localeOf(prof?.locale), fem: isFeminine(prof?.pronouns) }
}

/**
 * Whether to write "passee" rather than "passe" about this person.
 *
 * French past participles agree with the person the sentence is about, and
 * "se demande ou tu es passe" is addressed to the recipient, so the app has to
 * know something about them to write it. It knows exactly one thing: what they
 * put in the pronouns box, if they put anything.
 *
 * TRUE ONLY FOR SOMEBODY WHO SAID SO. Anything else, including an empty box,
 * a set this does not recognise, and "prefer not to say", falls to the
 * masculine, which is French's grammatical default for an unknown subject.
 * That is a real limitation of the language and not a judgement about anybody.
 * A name is never consulted: guessing gender from a name is how an app
 * misgenders a real person in a way a default never does.
 */
function isFeminine(pronouns?: string | null): boolean {
  const p = (pronouns ?? '').trim().toLowerCase()
  return p === 'she/her' || p === 'elle' || p === 'elle/elle'
}

/**
 * Both parts, always. A message with an HTML part and no text alternative
 * scores badly with spam filters and is unreadable in a text-only client, and
 * the text part is also what shows if the HTML fails to render.
 */
async function send(
  to: string,
  subject: string,
  { title, preheader, blocks, footnote, loc }: {
    title: string
    preheader: string
    blocks: Block[]
    footnote?: string
    /* The shell has words of its own. Without this they were English on every
       message, including the French ones. */
    loc: Loc
  },
) {
  const smallPrint = COPY[loc].smallPrint
  const html = layout({ title, preheader, blocks, footnote, smallPrint })
  const text = plain(title, blocks, footnote)

  /**
   * NO KEY IS A CONFIGURATION FAULT, NOT A SUCCESS.
   *
   * This returned true here, so a deployment with RESEND_API_KEY unset looked
   * from the outside exactly like one that worked: rows claimed, {"ok":true}
   * returned, and not one message sent. Because the claim is what the ceiling
   * is made of, every person it touched became permanently unmailable for
   * that cycle. One unset secret, silently, forever.
   *
   * It is still a dry run, which is right for running this locally. It is
   * just no longer a lie about having sent something, and the caller releases
   * the claim so the moment the key appears, everything retries.
   */
  if (!RESEND_KEY) {
    console.log('[dry-run]', to, subject, `${html.length} bytes html`)
    return 'dry-run' as const
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to,
      subject,
      html,
      text,
      reply_to: SUPPORT,
      headers: { 'List-Unsubscribe': UNSUB },
    }),
  })
  if (!res.ok) {
    /* Read once. The body is a stream, and a second read throws, which would
       turn a reportable send failure into an unhandled exception. */
    const why = await res.text().catch(() => '')
    console.error('send failed', res.status, why.slice(0, 400))
    return 'failed' as const
  }
  return 'sent' as const
}

/**
 * THE THIRD KIND WAS MISSING FROM THIS TYPE.
 *
 * It said 'digest' | 'nudge' while sendBirthdays passed 'birthday', which is a
 * type error, and Supabase type-checks an Edge Function when it deploys. So
 * every deploy since birthdays were added had something to complain about,
 * and a function that does not deploy is indistinguishable from one that
 * deploys and sends nothing.
 */
type Kind = 'digest' | 'nudge' | 'birthday' | 'group_goal'

/** Claim the right to send. Returns false if this message already went out. */
async function claim(userId: string, cycleId: string, kind: Kind) {
  const { error } = await supabase
    .from('notifications_log')
    .insert({ user_id: userId, cycle_id: cycleId, kind })
  return !error
}

/**
 * Give the claim back, when the message did not actually go.
 *
 * The claim is taken BEFORE the send, and that ordering is right: it is what
 * makes a duplicate physically impossible even if this function runs twice at
 * once. What was missing is the other half. A send that fails left its row
 * behind, so the unique constraint then refused every retry, and one bad
 * minute at Resend or one unverified sending domain cost somebody their only
 * message of the cycle, permanently and with nothing written down.
 *
 * Releasing narrows the guarantee from "at most once, ever" to "at most once
 * per successful send", which is the guarantee actually wanted. The window
 * where two runs could overlap is the length of one HTTP call, and losing that
 * race sends one duplicate; not releasing loses the message every time.
 */
async function release(userId: string, cycleId: string, kind: Kind) {
  const { error } = await supabase
    .from('notifications_log')
    .delete()
    .eq('user_id', userId)
    .eq('cycle_id', cycleId)
    .eq('kind', kind)
  if (error) console.error('release failed', kind, error.message)
}

/**
 * What this run did, returned in the response body.
 *
 * net._http_response is the only window into this function from the SQL
 * editor, and it was showing {"ok":true} whether the run sent four messages or
 * silently sent none. Counting them is the difference between "the pipeline is
 * fine, nobody was due" and "it tried and Resend refused", which are the two
 * answers somebody debugging this actually needs to tell apart.
 */
const tally = {
  digest: 0, nudge: 0, birthday: 0, group_goal: 0, cycle: 0, failed: 0, dryRun: 0,
  /* The other channel, counted separately: a run can send every email and no
     push, which is the normal state until somebody turns push on. */
  pushed: 0, pushFailed: 0, pushDropped: 0,
}

/** Record the outcome, and hand the claim back if nothing was sent. */
async function settle(
  result: 'sent' | 'failed' | 'dry-run',
  kind: Kind,
  userId: string,
  cycleId: string,
) {
  if (result === 'sent') {
    tally[kind] += 1
    return
  }
  tally[result === 'failed' ? 'failed' : 'dryRun'] += 1
  await release(userId, cycleId, kind)
}

async function sendDigests() {
  // Cycles opening in the next three hours.
  const { data: cycles } = await supabase
    .from('cycles')
    .select('id, group_id, opens_at, closes_at, groups(name)')
    .eq('state', 'upcoming')
    .gt('opens_at', new Date().toISOString())
    .lt('opens_at', new Date(Date.now() + 3 * 3600_000).toISOString())

  for (const cycle of cycles ?? []) {
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', cycle.group_id)

    for (const m of members ?? []) {
      const { data: goals } = await supabase
        .from('goals')
        .select('commitment, target_per_cycle, cadence, trigger_when, trigger_where, remind')
        .eq('group_id', cycle.group_id)
        .eq('status', 'active')
        .or(`owner_id.eq.${m.user_id},kind.eq.group`)

      // `remind` is per goal and opt-out. A muted goal should not be the
      // reason an email goes out at all, so filter before deciding to send.
      const listed = (goals ?? []).filter((g: any) => g.remind !== false)
      if (!listed.length) continue
      if (!(await claim(m.user_id, cycle.id, 'digest'))) continue

      const who = await recipient(m.user_id)
      if (!who) continue
      const c = COPY[who.loc]

      /**
       * The trigger goes in the email.
       *
       * The app has no idea where anyone is and is never going to have one.
       * So the "when and where" on a goal is a sentence you wrote to
       * yourself, and the only way it can do any work is for something to
       * read it back to you shortly before the moment it describes. This
       * message is that something. Without it the field was a note nobody
       * ever saw again, which is presumably why it looked like tracking.
       */
      const items = listed.map((g: any) => ({
        title: `${g.commitment}${g.cadence === 'recurring' ? ` · ${g.target_per_cycle}×` : ''}`,
        note: [g.trigger_when, g.trigger_where].filter(Boolean).join(' · ') || undefined,
      }))

      const name = (cycle as any).groups?.name ?? (who.loc === 'fr' ? 'ton groupe' : 'your group')

      const outcome = await send(who.to, c.digestSubject(name), {
        title: c.digestTitle,
        // Shown next to the subject in the inbox. Without one, clients scrape
        // the first text in the message, which would be the logo's alt text.
        preheader: c.digestPre(name, items.length),
        blocks: [
          { kind: 'lead', text: c.digestLead },
          { kind: 'list', items },
          { kind: 'button', label: c.digestCta, href: `${SITE}/g/${cycle.group_id}/checkin` },
          { kind: 'text', text: c.digestTail },
        ],
        loc: who.loc,
      })
      await settle(outcome, 'digest', m.user_id, cycle.id)
      if (outcome === 'sent') {
        await pushTo(m.user_id, {
          title: c.digestTitle,
          body: c.digestPre(name, items.length),
          url: `${SITE}/g/${cycle.group_id}/checkin`,
          tag: 'digest',
        })
      }
    }
  }
}

/**
 * How long the group gets before the app writes instead.
 *
 * The component that shows these cards says it plainly: the one thing that
 * reliably reaches somebody who has stopped opening an app is a message from a
 * friend, not another notification. So the friends go first. tick() raises the
 * nudge, the card appears for everybody except the quiet person, and this waits
 * a day to see whether anyone taps "I'll check on them".
 *
 * If somebody does, the email can name them, and that is a completely
 * different message: a person is asking after you, rather than software
 * noticing you are gone. If nobody does, the app asks the question itself, and
 * it asks as itself rather than inventing a concerned friend.
 *
 * A day, matching the fallback rotation in tick() that assigns an unclaimed
 * nudge after the same interval. Two clocks measuring the same patience should
 * not disagree.
 */
const GROUP_HEAD_START_HOURS = 24

async function sendNudges() {
  // One message to the person who went quiet. Never a second.
  const { data: nudges } = await supabase
    .from('nudges')
    .select('id, cycle_id, subject_id, group_id, claimed_by, created_at, groups(name)')
    .in('state', ['pending', 'claimed'])

  for (const n of nudges ?? []) {
    /* Not yet. Nobody has volunteered and the card has not been up long
       enough to say nobody is going to. Claiming the log row here would burn
       the one send on the weakest version of the message. */
    const old = Date.parse((n as any).created_at) < Date.now() - GROUP_HEAD_START_HOURS * 3600_000
    if (!n.claimed_by && !old) continue

    if (!(await claim(n.subject_id, n.cycle_id, 'nudge'))) continue

    const who = await recipient(n.subject_id)
    if (!who) continue
    const c = COPY[who.loc]

    const name = (n as any).groups?.name ?? (who.loc === 'fr' ? 'ton groupe' : 'your group')

    /**
     * The name of whoever volunteered, and only if they really did.
     *
     * claimed_by is somebody pressing a button, so it is a fact. assigned_to
     * is the rotation in tick() handing the card to whoever is next, which is
     * the app's decision and not that person's, so it is NOT usable here:
     * "Fatim is asking after you" when Fatim has done nothing is the app
     * fabricating concern to get somebody to come back. A missing profile
     * falls back to the unnamed version for the same reason.
     */
    let from: string | null = null
    if (n.claimed_by) {
      const { data: p } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', n.claimed_by)
        .maybeSingle()
      from = p?.display_name?.trim() || null
    }

    /* Deliberately the quiet one: no button colour shouting, no count of what
       was missed, no streak language. The whole design of this message is
       that it must not read as a debt collector. */
    const outcome = await send(who.to, from ? c.nudgeFromSubject(from, who.fem) : c.nudgeSubject(name), {
      title: from ? c.nudgeFromTitle(from, who.fem) : c.nudgeTitle,
      preheader: c.nudgePre(name),
      blocks: [
        { kind: 'lead', text: from ? c.nudgeFromLead(from, name) : c.nudgeLead(name) },
        { kind: 'text', text: c.nudgeBody },
        /* /profile, not /me. Both still serve the page, but /profile is the
           canonical address now and a link in an email outlives the deploy
           that renamed it. */
        { kind: 'button', label: c.nudgeCta, href: `${SITE}/profile` },
      ],
      footnote: c.nudgeFoot(name),
      loc: who.loc,
    })
    await settle(outcome, 'nudge', n.subject_id, n.cycle_id)
    if (outcome === 'sent') {
      await pushTo(n.subject_id, {
        title: from ? c.nudgeFromTitle(from, who.fem) : c.nudgeTitle,
        body: from ? c.nudgeFromLead(from, name) : c.nudgeLead(name),
        url: `${SITE}/profile`,
        tag: 'nudge',
      })
    }
  }
}

/**
 * Birthdays, three days out.
 *
 * WHY THREE DAYS AND NOT ON THE DAY.
 *
 * The same argument BirthdayBanner makes on screen. On the morning of, the
 * only thing left is a message, and it lands in a pile of identical ones. Three
 * days is the difference between remembering and being able to do something
 * about it: a table can still be booked, a thing can still arrive, a paragraph
 * can still be written by somebody who is not in a hurry.
 *
 * The in-app banner starts a week out and counts down, because a banner costs
 * nothing to look past. An email is not free, so it fires once, on one day.
 *
 * WHY ONE MESSAGE FOR EVERYBODY WHOSE BIRTHDAY IT IS.
 *
 * The ceiling is one row per recipient per cycle per kind, so two friends
 * sharing a date would otherwise mean the second one silently never sends.
 * Listing them is both the fix and the better message, and it is the shape the
 * digest already uses for goals.
 */
const BIRTHDAY_LEAD_DAYS = 3

/**
 * The month and day it will be in `tz`, `ahead` days from now.
 *
 * Resolve the local calendar date first, then do the arithmetic on it in UTC.
 * Adding 3 * 86400000 to an instant and reading it back in a timezone crosses
 * DST wrong twice a year, and this is the kind of bug that produces one wrong
 * email in March and none anybody can reproduce in June.
 */
function monthDayAhead(tz: string, ahead: number): { month: number; day: number } {
  let iso: string
  try {
    iso = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    // A group carrying a timezone Deno does not know should not stop every
    // other group's birthdays from going out.
    iso = new Date().toISOString().slice(0, 10)
  }
  const [y, m, d] = iso.split('-').map(Number)
  const at = new Date(Date.UTC(y, m - 1, d) + ahead * 86400_000)
  return { month: at.getUTCMonth() + 1, day: at.getUTCDate() }
}

/* profiles.birthday is a date, so it arrives as "1998-04-12" and the month and
   day are already right there. Parsing it into a Date would reinterpret it in
   whatever zone the runtime is in and move the 1st of a month to the last of
   the one before, for everybody west of UTC. */
const monthDayOf = (iso: string) => ({
  month: Number(iso.slice(5, 7)),
  day: Number(iso.slice(8, 10)),
})

async function sendBirthdays() {
  const { data: groups } = await supabase.from('groups').select('id, name, timezone')

  for (const g of groups ?? []) {
    // Every group agrees with itself about what day it is, the same way cycles
    // do. A group in Abidjan should not get its reminders on Montreal's clock.
    const target = monthDayAhead((g as any).timezone ?? 'UTC', BIRTHDAY_LEAD_DAYS)

    const { data: members } = await supabase
      .from('group_members')
      .select('user_id, profiles(display_name, birthday)')
      .eq('group_id', g.id)

    /* Whose birthday it is. A 29 February birthday only matches in a leap
       year, which is the same thing every calendar does with it and better
       than picking the 28th or the 1st on somebody's behalf. */
    const celebrating = (members ?? []).filter((m: any) => {
      const b = m.profiles?.birthday
      if (!b) return false
      const md = monthDayOf(b)
      return md.month === target.month && md.day === target.day
    })
    if (!celebrating.length) continue

    // The anchor for the ceiling. A group always has cycles; if it somehow has
    // none there is nothing to claim against and nothing to send.
    const { data: cyc } = await supabase
      .from('cycles')
      .select('id')
      .eq('group_id', g.id)
      .order('opens_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!cyc) continue

    for (const m of members ?? []) {
      /* Never your own. Being told your birthday is in three days is the app
         reminding you of the one date you did not need reminding of, and it
         would also tell you that everybody else just got an email about it. */
      const others = celebrating.filter((c: any) => c.user_id !== m.user_id)
      if (!others.length) continue

      if (!(await claim(m.user_id, cyc.id, 'birthday'))) continue

      const who = await recipient(m.user_id)
      if (!who) continue
      const c = COPY[who.loc]

      const names = others.map(
        (o: any) => o.profiles?.display_name?.trim() || (who.loc === 'fr' ? 'Quelqu un' : 'Someone'),
      )
      const group = (g as any).name ?? (who.loc === 'fr' ? 'ton groupe' : 'your group')

      const outcome = await send(who.to, c.birthdaySubject(names.length, names[0]), {
        title: c.birthdayTitle(names.length),
        preheader: c.birthdayPre(names.length),
        blocks: [
          { kind: 'lead', text: c.birthdayLead },
          { kind: 'list', items: names.map((n: string) => ({ title: n })) },
          { kind: 'text', text: c.birthdayNote },
          { kind: 'button', label: c.birthdayCta, href: `${SITE}/g/${g.id}` },
        ],
        footnote: c.birthdayFoot(group),
        loc: who.loc,
      })
      await settle(outcome, 'birthday', m.user_id, cyc.id)
      if (outcome === 'sent') {
        await pushTo(m.user_id, {
          title: c.birthdayTitle(names.length),
          body: c.birthdaySubject(names.length, names[0]),
          url: `${SITE}/g/${g.id}`,
          tag: 'birthday',
        })
      }
    }
  }
}

/**
 * Shared goals somebody added, emailed once and then left alone.
 *
 * THE IN-APP ROW IS WRITTEN BY THE DATABASE, NOT BY THIS FUNCTION.
 *
 * A trigger on goals fans the notification out to every member the moment the
 * goal is inserted, inside the same transaction, so the app shows it
 * immediately and it exists whether or not this function ever runs. See
 * migration 50 for why that is a trigger and not a client insert.
 *
 * What is left for this to do is the other channel. It picks up the rows that
 * have not been emailed, groups them per person, sends one message, and stamps
 * emailed_at so they are never picked up again. emailed_at is the thing that
 * stops the same news going out twice; the notifications_log claim is what
 * stops two overlapping runs both sending it once.
 *
 * ONE MESSAGE PER PERSON PER CYCLE, LISTING EVERYTHING.
 *
 * Four people adding a shared goal on the same evening is four rows in the app
 * and one email. The alternative is a group being able to generate four emails
 * for one person in an hour by doing something entirely reasonable, which is
 * how a product teaches people to filter it.
 *
 * That does mean a goal added later in the same cycle gets no email of its
 * own. It still arrives in the app, and the footer says so rather than leaving
 * somebody to work out why the second one was quiet.
 */
async function sendGroupGoals() {
  /* Everything unsent, newest information last so the list reads in the order
     things happened. The join pulls the goal and the group in one go: without
     the goal there is nothing to name, and a goal deleted since the
     notification was written takes the row with it by cascade. */
  const { data: pending } = await supabase
    .from('notification')
    .select('id, user_id, group_id, created_at, goals(commitment, status), profiles!notification_actor_id_fkey(display_name), groups(name)')
    .eq('kind', 'group_goal')
    .is('emailed_at', null)
    .order('created_at', { ascending: true })

  if (!pending?.length) return

  /* Per person, then per group. Somebody in two groups who got a goal in each
     gets two messages, because one message spanning two groups would have to
     explain which line came from where and the subject could name neither. */
  const byPerson = new Map<string, typeof pending>()
  for (const row of pending) {
    const key = `${row.user_id}|${row.group_id}`
    const list = byPerson.get(key) ?? []
    list.push(row)
    byPerson.set(key, list)
  }

  for (const [key, rows] of byPerson) {
    const userId = key.split('|')[0]

    /* A goal that was paused or finished between being added and this run is
       not news any more. If that empties the batch, the rows are still stamped
       below so they are not reconsidered every hour forever. */
    const live = rows.filter((r: any) => r.goals && r.goals.status === 'active')

    const stamp = async () => {
      await supabase
        .from('notification')
        .update({ emailed_at: new Date().toISOString() })
        .in('id', rows.map((r: any) => r.id))
    }

    if (!live.length) {
      await stamp()
      continue
    }

    /* The anchor for the ceiling, same as birthdays: the group's newest cycle.
       A group with no cycles has nothing to claim against. */
    const { data: cyc } = await supabase
      .from('cycles')
      .select('id')
      .eq('group_id', rows[0].group_id)
      .order('opens_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!cyc) continue

    if (!(await claim(userId, cyc.id, 'group_goal'))) {
      /* Already had one this cycle. The rows are stamped rather than left
         pending, because leaving them would mean the next cycle emails goals
         that are by then weeks old. They are in the app, which is where a
         thing that is no longer news belongs. */
      await stamp()
      continue
    }

    const who = await recipient(userId)
    if (!who) {
      await release(userId, cyc.id, 'group_goal')
      continue
    }
    const c = COPY[who.loc]

    const group = (rows[0] as any).groups?.name ?? (who.loc === 'fr' ? 'ton groupe' : 'your group')
    const names = live.map((r: any) => r.profiles?.display_name?.trim() || null)
    const only = live.length === 1

    const outcome = await send(
      who.to,
      only ? c.goalSubject(names[0], group) : c.goalSubjectMany(live.length, group),
      {
        title: c.goalTitle(live.length),
        preheader: c.goalPre(live.length, group),
        blocks: [
          {
            kind: 'lead',
            text: only ? c.goalLead(names[0], group) : c.goalLeadMany(group),
          },
          {
            kind: 'list',
            items: live.map((r: any, i: number) => ({
              title: r.goals.commitment,
              /* Named only when the name is a fact. A shared goal created
                 before migration 50 has no author recorded, and guessing one
                 would put words in somebody's mouth. */
              note: names[i] ? c.goalBy(names[i]) : undefined,
            })),
          },
          { kind: 'button', label: c.goalCta, href: `${SITE}/g/${rows[0].group_id}` },
        ],
        footnote: c.goalFoot(group),
        loc: who.loc,
      },
    )

    await settle(outcome, 'group_goal', userId, cyc.id)

    if (outcome === 'sent') {
      await stamp()
      await pushTo(userId, {
        title: c.goalTitle(live.length),
        body: only ? c.goalLead(names[0], group) : c.goalLeadMany(group),
        url: `${SITE}/g/${rows[0].group_id}`,
        tag: 'group_goal',
      })
    }
    /* Not stamped when the send failed. settle() has already given the claim
       back, so the next run retries both halves together rather than marking
       something as emailed that was not. */
  }
}

/**
 * The cycle reminder. The one message in this function that touches those
 * tables, and it goes to the person themselves and to nobody else.
 *
 * WHY THE ARITHMETIC IS HERE AND NOT IMPORTED.
 *
 * src/lib/cycle.js has all of it, under 67 assertions, and this runs in Deno
 * from a bundled file with no access to the app's source tree. So the two
 * rules that matter are restated: drop gaps outside 21 to 45 days, because a
 * short one is two entries for one period and a long one is a period that went
 * unrecorded, and roll the prediction forward rather than pointing at a date
 * in the past. Everything else the client does, the window, the confidence,
 * the fertile span, is for drawing and is not needed to decide whether today
 * is the day.
 *
 * WHAT STOPS IT SENDING TWICE.
 *
 * notification_preference.cycle_reminded_for, holding the predicted date the
 * last reminder was about. Deliberately not a notifications_log claim: that
 * table keys on a group's cycle_id, and this feature works for somebody with
 * no group, so anchoring to one would mean the reminder silently never fires
 * for exactly the people using the app alone.
 */
const MIN_CYCLE = 21
const MAX_CYCLE = 45
const DAY_MS = 86400000

const asDay = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
const dayString = (ms: number) => new Date(ms).toISOString().slice(0, 10)

async function sendCycleReminders() {
  const { data: people } = await supabase
    .from('notification_preference')
    .select('user_id, cycle_remind, cycle_remind_days, stated_cycle, cycle_reminded_for')
    .eq('cycle_remind', true)

  if (!people?.length) return

  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  for (const person of people) {
    const { data: logs } = await supabase
      .from('cycle_log')
      .select('started_on')
      .eq('user_id', person.user_id)
      .order('started_on', { ascending: true })

    /* The annotation on the predicate is not decoration. Deno type-checks this
       file when it deploys, and `(d): d is number` leaves `d` implicitly any
       under noImplicitAny, which is an error and a blocked deploy. This repo
       has lost a deploy to exactly that class of thing before. */
    const starts = (logs ?? [])
      .map((l: { started_on: string }) => asDay(l.started_on))
      .filter((d: number | null): d is number => d !== null)
    if (!starts.length) continue

    const gaps: number[] = []
    for (let i = 1; i < starts.length; i += 1) {
      const gap = Math.round((starts[i] - starts[i - 1]) / DAY_MS)
      if (gap >= MIN_CYCLE && gap <= MAX_CYCLE) gaps.push(gap)
    }
    const recent = gaps.slice(-6)
    const length =
      recent.length > 0
        ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
        : person.stated_cycle && person.stated_cycle >= MIN_CYCLE && person.stated_cycle <= MAX_CYCLE
          ? person.stated_cycle
          : 28

    let next = starts[starts.length - 1] + length * DAY_MS
    let guard = 0
    while (next < today && guard < 24) {
      next += length * DAY_MS
      guard += 1
    }

    const ahead = Math.round((next - today) / DAY_MS)
    const wanted = person.cycle_remind_days ?? 2

    /* Exactly the day, not "within N". Firing on each of the three days before
       is three notifications about one event, which is how somebody turns the
       feature off. */
    if (ahead !== wanted) continue

    const forDate = dayString(next)
    if (person.cycle_reminded_for === forDate) continue

    const who = await recipient(person.user_id)
    if (!who) continue
    const c = COPY[who.loc]

    /* Stamped BEFORE the send, so two overlapping runs cannot both pass the
       check above. A failed send loses this one reminder rather than
       repeating it, which is the right way round for a message that is only
       useful on one specific day: retrying it tomorrow would be a reminder
       about the wrong number of days. */
    await supabase
      .from('notification_preference')
      .update({ cycle_reminded_for: forDate })
      .eq('user_id', person.user_id)

    const outcome = await send(who.to, c.cycleSubject, {
      title: c.cycleTitle,
      preheader: c.cyclePre(ahead),
      blocks: [
        { kind: 'lead', text: c.cycleLead(ahead) },
        { kind: 'text', text: c.cycleNote },
        {
          kind: 'list',
          items: [
            { title: c.prepWater },
            { title: c.prepWarmth },
            { title: c.prepGentle },
          ],
        },
        { kind: 'button', label: c.cycleCta, href: `${SITE}/calendar` },
      ],
      footnote: c.cycleFoot,
      loc: who.loc,
    })

    if (outcome === 'sent') {
      tally.cycle += 1
      await pushTo(person.user_id, {
        title: c.cycleTitle,
        body: c.cycleLead(ahead),
        url: `${SITE}/calendar`,
        tag: 'cycle',
      })
    } else {
      tally[outcome === 'failed' ? 'failed' : 'dryRun'] += 1
    }
  }
}

/**
 * ============================================================================
 * INSTANT PUSH, ON DEMAND.
 * ============================================================================
 *
 * Everything above this line is a scheduled job: cron calls the function, it
 * looks at who is due, and it sends. That is right for a digest and wrong for
 * the one message that is worth being immediate, which is somebody in your
 * group deciding to reach out to you because you have gone quiet. An hour late
 * that is a form letter; in the same minute it is a person.
 *
 * WHY THIS LIVES HERE AND NOT IN /api.
 *
 * A push has to be signed with the VAPID private key, and that key is in
 * Supabase and nowhere else. Not in the repository, not in Vercel, not in a
 * message. A Vercel route could not send one without moving it, so the send
 * happens where the key already is.
 *
 * THE REQUEST NEVER NAMES A RECIPIENT, AND THAT IS THE WHOLE SECURITY MODEL.
 *
 * It names a NUDGE. The nudge row already records who it is about, which group
 * it belongs to and who claimed it, and every one of those was written by the
 * database under policies that had already decided who may do what. So the
 * caller cannot choose a target: they can only point at a row, and the row
 * says where the message goes.
 *
 * An endpoint shaped the other way, taking { user_id, title, body }, would let
 * anybody with an account write anything to anybody's lock screen. That is the
 * obvious API and it is the wrong one.
 *
 * Four things are checked before anything is sent, and all four are about the
 * row rather than about the request:
 *
 *   the caller is signed in                    a verified JWT, not a claim
 *   the nudge exists                           and is loaded server-side
 *   the caller claimed it                      claimed_by is the caller
 *   it has not just been sent                  see the ledger below
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })

/**
 * One push per nudge per hour, whoever asks and however often.
 *
 * The notification table is the ledger rather than a new column, because a row
 * has to be written anyway: the person being reached out to should find it in
 * their inbox whether or not their phone was reachable at that moment. Reusing
 * it means the guard and the record are the same fact, and cannot disagree.
 *
 * An hour rather than forever. Claiming a nudge twice in a week is two real
 * gestures a fortnight apart; twice in a minute is a double tap or a retry.
 */
async function recentlyNudged(subjectId: string, groupId: string): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('notification')
    .select('id')
    .eq('user_id', subjectId)
    .eq('group_id', groupId)
    .eq('kind', 'nudge')
    .gte('created_at', since)
    .limit(1)
  return (data ?? []).length > 0
}

/**
 * Is this somebody in the app asking for one message now?
 *
 * Pulled out as its own function because getting it wrong stopped every
 * scheduled message in the product for a day, and a decision that important
 * should be testable rather than only readable.
 *
 * True only for a body that names a nudge or asks for a self test. Everything
 * else, and above all the empty body pg_cron sends, is the scheduled run.
 */
export function wantsInstant(body: { nudge_id?: string; self_test?: boolean } | null): boolean {
  if (!body) return false
  if (body.self_test === true) return true
  return typeof body.nudge_id === 'string' && body.nudge_id.length > 0
}

async function deliverNudge(
  req: Request,
  body: { nudge_id?: string; self_test?: boolean },
): Promise<Response> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ ok: false, error: 'signed_out' }, 401)

  const { data: who } = await supabase.auth.getUser(token)
  const caller = who?.user
  if (!caller) return json({ ok: false, error: 'bad_session' }, 401)

  /**
   * A real push, from this server, to the person asking for it. Nobody else.
   *
   * WHY THIS EXISTS.
   *
   * There was no way to test the chain alone. You cannot nudge yourself: the
   * check below refuses it, and the card about you is never shown to you
   * anyway, so verifying that push works at all took two people and two
   * phones and a lot of guessing about which link had broken. The button in
   * Settings only calls showNotification in the browser, which proves the
   * device can paint one and proves nothing about the server.
   *
   * This is the whole chain in one tap: the function is the new one, it has
   * VAPID keys, this device is subscribed, and the push arrives. The answer
   * says which of those failed.
   *
   * WHY IT IS SAFE.
   *
   * The request names no recipient and cannot. The push goes to caller.id,
   * taken from the verified token, so the worst anybody can do with this
   * endpoint is send themselves a notification. It writes no inbox row: this
   * is a diagnostic, not a message, and it should leave nothing behind.
   */
  if (body.self_test === true) {
    const me = await recipient(caller.id)
    const c = COPY[me?.loc ?? 'fr']
    const reach = await pushTo(caller.id, {
      title: c.selfTestTitle,
      body: c.selfTestBody,
      url: `${SITE}/settings`,
      tag: 'rf-self-test',
    })
    return json({
      ok: true,
      self_test: true,
      push: PUSH_READY,
      devices: reach.devices,
      delivered: reach.delivered,
    })
  }

  if (!body.nudge_id) return json({ ok: false, error: 'no_nudge' }, 400)

  const { data: nudge } = await supabase
    .from('nudges')
    .select('id, group_id, subject_id, claimed_by, state')
    .eq('id', body.nudge_id)
    .maybeSingle()

  if (!nudge) return json({ ok: false, error: 'no_such_nudge' }, 404)

  /* The caller has to be the one who claimed it. Membership alone would let
     any member of the group fire a message about somebody else's gesture. */
  if (nudge.claimed_by !== caller.id) return json({ ok: false, error: 'not_yours' }, 403)
  if (nudge.subject_id === caller.id) return json({ ok: false, error: 'self' }, 400)

  if (await recentlyNudged(nudge.subject_id, nudge.group_id)) {
    return json({ ok: true, sent: false, reason: 'already_sent_recently' })
  }

  /* The words, in the recipient's language rather than the sender's. This
     function runs with nobody's browser attached, so the only source is the
     profile, which is exactly why sendNudges reads it too. */
  const to = await recipient(nudge.subject_id)
  const c = COPY[to?.loc ?? 'fr']

  const { data: actor } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', caller.id)
    .maybeSingle()
  const from = actor?.display_name?.trim()

  /* The inbox row first. If the push fails, is refused, or the phone is off,
     the message still exists somewhere they will find it. A push that is the
     only copy of something is a message that can be lost silently. */
  await supabase.from('notification').insert({
    user_id: nudge.subject_id,
    kind: 'nudge',
    href: `/g/${nudge.group_id}`,
    actor_id: caller.id,
    group_id: nudge.group_id,
  })

  const reach = await pushTo(nudge.subject_id, {
    title: from ? c.nudgeFromTitle(from, to?.fem) : c.nudgeTitle,
    /* Was nudgeCta, which is the label on a button in an email. On a lock
       screen "Je suis toujours la" reads as something the recipient said. */
    body: c.nudgeNowBody,
    url: `${SITE}/g/${nudge.group_id}`,
    tag: 'nudge',
  })

  /**
   * devices AND delivered, not just "sent".
   *
   * This answered { sent: true, push: PUSH_READY } whatever happened, and
   * PUSH_READY only says whether this server holds VAPID keys. It says nothing
   * about whether the other person has ever turned notifications on, and
   * somebody who has not has no rows in push_subscription at all: the loop in
   * pushTo runs zero times and the app then told the sender "they have just
   * been told, on their phone".
   *
   * Three different facts, and the sender deserves all three:
   *   push      this server can sign a push at all
   *   devices   how many of their devices are subscribed
   *   delivered how many actually accepted it just now
   *
   * The inbox row above is written either way, so nothing is lost when the
   * number is zero. It is simply not a delivery, and must not be reported as
   * one.
   */
  /**
   * NO PHONE REACHED MEANS SEND THE EMAIL, NOW.
   *
   * "She will see it next time she opens the app" was the answer here, and it
   * is not an answer. The whole point of this feature is that somebody who has
   * stopped opening the app gets reached; telling the sender that the message
   * is sitting where the quiet person is not looking is the failure written
   * politely.
   *
   * Push cannot always work and never will: it needs the recipient to have
   * subscribed on a device, which on an iPhone means adding the site to the
   * home screen first. Email needs nothing. It is the channel that reaches
   * everybody, it is already built, and the scheduled sender was going to use
   * it for this exact nudge on its next run anyway. Doing it now is the only
   * part that is new.
   *
   * Under the SAME claim in notifications_log, so this cannot become a second
   * message: one piece of news is one message however many ways it travels. If
   * the claim is refused, this person has already been written to for this
   * cycle and nothing more is owed. If the send fails, the claim goes back, or
   * one refused email would cost them their only message of the cycle.
   */
  let mailed = false
  if (reach.delivered === 0) {
    if (await claim(nudge.subject_id, nudge.cycle_id, 'nudge')) {
      const { data: g } = await supabase
        .from('groups').select('name').eq('id', nudge.group_id).maybeSingle()
      const name = g?.name ?? (to?.loc === 'fr' ? 'ton groupe' : 'your group')
      const outcome = to?.to
        ? await send(to.to, from ? c.nudgeFromSubject(from, to.fem) : c.nudgeSubject(name), {
            title: from ? c.nudgeFromTitle(from, to.fem) : c.nudgeTitle,
            preheader: c.nudgePre(name),
            blocks: [
              { kind: 'lead', text: from ? c.nudgeFromLead(from, name) : c.nudgeLead(name) },
              { kind: 'text', text: c.nudgeBody },
              { kind: 'button', label: c.nudgeCta, href: `${SITE}/profile` },
            ],
            footnote: c.nudgeFoot(name),
            loc: to.loc,
          })
        : 'failed'
      mailed = outcome === 'sent'
      if (!mailed) await release(nudge.subject_id, nudge.cycle_id, 'nudge')
    }
  }

  return json({
    ok: true,
    sent: true,
    push: PUSH_READY,
    devices: reach.devices,
    delivered: reach.delivered,
    mailed,
  })
}

Deno.serve(async (req) => {
  /* The browser asks first, and a preflight that is not answered makes the
     real request never happen, with nothing in the function's logs to say so:
     the failure is entirely on the other side. */
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  /* A POST is somebody in the app asking for one message now. Anything else is
     cron asking for the scheduled run, which is what this function was before
     and still is by default. */
  if (req.method === 'POST') {
    /**
     * WHICH CALLER THIS IS, DECIDED BY THE BODY AND NEVER BY THE METHOD.
     *
     * This read `if (req.method === 'POST') return deliverNudge(req)`, and that
     * one line killed every scheduled message in the product.
     *
     * pg_cron calls this hourly through net.http_post, which is a POST by
     * definition, carrying `{}` and the service role key. So every hourly run
     * was handed to the instant-push path, which asks Supabase to resolve that
     * key as a user session, fails, and answers 401 bad_session. Confirmed
     * from net._http_response: 401, on the hour, every hour, for as long as
     * that line has been deployed. No digest, no scheduled nudge, no birthday,
     * no group goal, no cycle reminder, in silence.
     *
     * The two callers are told apart by what they ask for. Somebody in the app
     * names a nudge or asks for a self test. Cron asks for neither, and gets
     * the scheduled run it has always been asking for.
     *
     * The body is parsed HERE and passed down, because a request body can only
     * be read once and deliverNudge used to read it itself.
     */
    let body: { nudge_id?: string; self_test?: boolean } = {}
    try {
      body = await req.json()
    } catch {
      /* No body, or not JSON. That is cron, and it falls through below. */
      body = {}
    }

    if (wantsInstant(body)) {
      try {
        return await deliverNudge(req, body)
      } catch (err) {
        console.error('instant push failed', err)
        return json({ ok: false, error: String(err) }, 500)
      }
    }
  }

  try {
    // Advance cycles first so the digests and nudges below see current state.
    await supabase.rpc('tick')
    await sendDigests()
    await sendNudges()
    await sendBirthdays()
    await sendGroupGoals()
    await sendCycleReminders()

    /**
     * SAY WHAT HAPPENED, NOT MERELY THAT NOTHING THREW.
     *
     * This returned {"ok":true} whether the run sent four messages, sent none
     * because nobody was due, or tried and had every one refused. From the SQL
     * editor, net._http_response is the only window into this function, and
     * all three looked identical through it.
     *
     * `resend` is the one to read first. False means RESEND_API_KEY is not set
     * on this deployment, which is a configuration fault that used to look
     * exactly like success.
     */
    return new Response(
      JSON.stringify({
        ok: true,
        resend: Boolean(RESEND_KEY),
        from: MAIL_FROM,
        /* Resend's shared sandbox domain. Mail from it is accepted and then
           filed under Promotions or Spam by most providers, because it is a
           domain thousands of unrelated senders share and none of them has
           authenticated. If this is true, deliverability is the problem and no
           amount of looking at this function will fix it: the answer is a
           verified domain in Resend and MAIL_FROM pointed at it. */
        sandboxDomain: MAIL_FROM.includes('resend.dev'),
        /* False means VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is not set on this
           deployment, so every push was skipped without trying. */
        push: PUSH_READY,
        sent: tally,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 })
  }
})
