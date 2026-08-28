import { supabase } from './supabase'

/**
 * Reads and writes for shared project budgets.
 *
 * Separate from project.js so that file stays pure arithmetic with no
 * imports, which is what lets `npm test` run it under plain node with no
 * bundler and no environment.
 *
 * `missing` is migration 38 not having been run. It is a state, not an error:
 * the caller hides the feature rather than showing a PostgREST code to
 * somebody who cannot act on one. Same contract as loadBudget.
 */
/* PGRST202 is the RPC half of the same state: PostgREST answers a function it
   has never heard of with that, not with PGRST205. Without it here, a database
   that has not run migration 41 shows the person a PostgREST code under an
   invite button instead of simply not offering the button. */
const ABSENT = new Set(['PGRST205', 'PGRST202', '42P01', '42883'])

const absent = (r) => Boolean(r?.error && ABSENT.has(r.error.code))

/**
 * An invite code, in the shape groups already use.
 *
 * No I, O, 0 or 1. This gets read off one phone screen and typed into
 * another, and those four are the pairs people get wrong doing that.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newInviteCode(len = 6) {
  const bytes = new Uint8Array(len)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

/**
 * Every project you are in, with its members and its entries.
 *
 * Three queries rather than one nested select: PostgREST can embed these, but
 * the embed depends on the foreign keys being introspected the way you expect
 * and it fails by returning fewer rows rather than by erroring. Three plain
 * reads keyed on project ids cannot half-work.
 */
export async function loadProjects(userId) {
  if (!userId) return { projects: [], members: [], entries: [], missing: false }

  const mine = await supabase
    .from('budget_project_member')
    .select('project_id')
    .eq('user_id', userId)

  if (absent(mine)) return { projects: [], members: [], entries: [], missing: true }

  const ids = (mine.data ?? []).map((r) => r.project_id)
  if (ids.length === 0) return { projects: [], members: [], entries: [], missing: false }

  const [p, m, e] = await Promise.all([
    supabase.from('budget_project').select('*').in('id', ids).order('created_at', { ascending: false }),
    supabase.from('budget_project_member').select('*').in('project_id', ids),
    supabase
      .from('budget_project_entry')
      .select('*')
      .in('project_id', ids)
      .order('happened_on', { ascending: false })
      .limit(500),
  ])

  if ([p, m, e].some(absent)) return { projects: [], members: [], entries: [], missing: true }

  return {
    projects: p.data ?? [],
    members: m.data ?? [],
    entries: e.data ?? [],
    missing: false,
  }
}

/**
 * The display names of everybody in these projects.
 *
 * Read separately and keyed by id rather than embedded, because a member row
 * whose profile fails to embed would silently render as a blank name beside a
 * real amount of money, which is worse than no name at all.
 */
export async function loadProjectProfiles(userIds = []) {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (ids.length === 0) return {}
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', ids)
  if (error) return {}
  return Object.fromEntries((data ?? []).map((r) => [r.id, r]))
}

/**
 * Create a project and put the owner in it.
 *
 * Two writes, and the second can fail on its own. If it does the project is
 * deleted rather than left orphaned: a project its own creator is not a
 * member of is invisible to them under the read policy, so it would be a row
 * nobody could ever see or remove.
 */
export async function createProject({ userId, name, currency, targetCents, startsOn, endsOn }) {
  const { data, error } = await supabase
    .from('budget_project')
    .insert({
      owner_id: userId,
      name: name.trim(),
      currency,
      target_cents: targetCents ?? 0,
      starts_on: startsOn || null,
      ends_on: endsOn || null,
      invite_code: newInviteCode(),
    })
    .select()
    .single()

  if (error) return { error }

  const join = await supabase
    .from('budget_project_member')
    .insert({ project_id: data.id, user_id: userId })

  if (join.error) {
    await supabase.from('budget_project').delete().eq('id', data.id)
    return { error: join.error }
  }
  return { project: data }
}

/** Join by code. The lookup runs as the definer; see migration 38. */
export async function joinProject(code) {
  const { data, error } = await supabase.rpc('join_budget_project', {
    code: code.trim().toUpperCase(),
  })
  if (error) return { error }
  return { projectId: data }
}

export async function addProjectEntry({ projectId, userId, amountCents, label, category, happenedOn, lineId }) {
  const row = {
    project_id: projectId,
    /* Always the caller. The policy enforces this too, but sending somebody
       else's id and getting a refusal is a worse error than not being able to
       express the idea. */
    paid_by: userId,
    amount_cents: amountCents,
    label: label?.trim() || null,
    category: category?.trim() || null,
    happened_on: happenedOn,
  }
  /* Only sent when there IS one, so this call still works verbatim against a
     database that has not run migration 42: PostgREST rejects the whole insert
     for an unknown column, and logging a spend you just made must not start
     failing because a plan feature is not installed yet. */
  if (lineId) row.line_id = lineId

  const { error } = await supabase.from('budget_project_entry').insert(row)
  return { error }
}

/* ---------------------------------------------------------------------------
 * What the project still has to pay.
 *
 * A line is a plan, an entry is a fact, and paying a line is an ordinary entry
 * with line_id set. There is no pay_line() RPC on purpose: 38's insert policy
 * already says the only rule that matters, `paid_by = auth.uid()`, and a rule
 * stated twice is a rule that can disagree with itself. See migration 42.
 * ------------------------------------------------------------------------ */

/** Every line on these projects. Soft on migration 42 the same way as 38. */
export async function loadProjectLines(projectIds = []) {
  const ids = [...new Set(projectIds.filter(Boolean))]
  if (ids.length === 0) return { lines: [], missing: false }
  const r = await supabase
    .from('budget_project_line')
    .select('*')
    .in('project_id', ids)
    .order('created_at', { ascending: true })
  if (absent(r)) return { lines: [], missing: true }
  if (r.error) return { lines: [], missing: false }
  return { lines: r.data ?? [], missing: false }
}

/** Returns the row, because "add it and mark it paid" needs its id. */
export async function addProjectLine({ projectId, userId, label, amountCents, category, assignedTo, dueOn }) {
  const { data, error } = await supabase
    .from('budget_project_line')
    .insert({
      project_id: projectId,
      /* Always the caller, and the policy insists on it too. Sending somebody
         else's id and being refused is a worse way to learn the rule than not
         being able to express it. */
      created_by: userId,
      label: label.trim(),
      amount_cents: amountCents,
      category: category?.trim() || null,
      assigned_to: assignedTo || null,
      due_on: dueOn || null,
    })
    .select()
    .single()
  if (error) return { error }
  return { line: data }
}

export async function updateProjectLine(id, patch) {
  const { error } = await supabase.from('budget_project_line').update(patch).eq('id', id)
  return { error }
}

/**
 * Delete a line without touching what was already paid against it.
 *
 * line_id is `on delete set null`, so the payments survive with their payer
 * and their amount and simply stop being attached to a plan. Every balance in
 * the project stays correct, which is the point: removing a to-do must never
 * rewrite what a trip cost.
 */
export async function deleteProjectLine(id) {
  const { error } = await supabase.from('budget_project_line').delete().eq('id', id)
  return { error }
}

export async function deleteProjectEntry(id) {
  const { error } = await supabase.from('budget_project_entry').delete().eq('id', id)
  return { error }
}

export async function leaveProject({ projectId, userId }) {
  const { error } = await supabase
    .from('budget_project_member')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)
  return { error }
}

/**
 * Change something about the project itself. Owner only, which is what
 * budget_project_update in 38 already enforces.
 *
 * Nothing is converted when the currency moves, and the screen says so. The
 * amounts are the numbers people typed; relabelling dollars as euros does not
 * move any money, and an app that silently multiplied a trip by an exchange
 * rate it looked up would be far worse than one that does nothing. This is the
 * same position Me.jsx takes about the personal currency, for the same reason.
 */
export async function updateProject(projectId, patch) {
  const { error } = await supabase.from('budget_project').update(patch).eq('id', projectId)
  return { error }
}

/**
 * Delete a project outright, with everything in it.
 *
 * ARCHIVING AND DELETING ARE DIFFERENT ANSWERS TO DIFFERENT QUESTIONS.
 *
 * archiveProject below is for a trip that ENDED: 38 calls a project ephemeral
 * and says "the numbers are worth keeping, what did Greece actually cost is
 * the question you ask next time you plan one". This is for a project that
 * should never have existed, or one somebody is done with entirely, and there
 * was no way to express it: the row could be created and never removed.
 *
 * budget_project_delete has always been `owner_id = auth.uid()`, so this is a
 * screen catching up with a policy rather than a new power. Members, entries
 * and lines all cascade; project_id is `on delete cascade` on all three, so
 * one statement takes the lot and nothing is left pointing at a project that
 * is gone.
 *
 * No soft delete and no undo. A trip's ledger is not something to half-remove
 * and leave somebody wondering which version four people are looking at, and
 * the confirmation dialog is where the second thought belongs.
 */
export async function deleteProject(projectId) {
  const { error } = await supabase.from('budget_project').delete().eq('id', projectId)
  return { error }
}

export async function archiveProject(projectId) {
  const { error } = await supabase
    .from('budget_project')
    .update({ archived: true })
    .eq('id', projectId)
  return { error }
}

/* ---------------------------------------------------------------------------
 * Inviting somebody who is already a friend.
 *
 * The code above still exists and still works, because it is the only way to
 * reach somebody who is not in any of your groups. This is the other half:
 * pick a name, and they find the invitation in their own budget.
 *
 * Everything below is soft on migration 41 being absent, the same way
 * loadProjects is soft on 38. A person looking at a budget cannot run a
 * migration, so the feature disappears rather than erroring.
 * ------------------------------------------------------------------------ */

/**
 * Everybody you are allowed to invite.
 *
 * This is a plain read of profiles with no filter, and that is the whole
 * trick: profiles_select in 03_policies is `id = auth.uid() or
 * shares_group(id)`, so the rows that come back ARE your group-mates. Building
 * the same set by hand out of group_members would be a second definition of
 * "people you know" that could drift from the one the database enforces, and
 * invite_to_project() checks the database's.
 *
 * Yourself dropped here rather than in the caller, because you are in the set
 * by that policy and are never an answer to "who do you want to add".
 */
export async function loadInvitableFriends(userId) {
  if (!userId) return []
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .neq('id', userId)
    .order('display_name')
  if (error) return []
  return data ?? []
}

/**
 * What is waiting for you.
 *
 * An RPC rather than a select, because the invite row on its own is two uuids
 * and neither of those is a sentence anybody can read. my_project_invites()
 * joins the project name on as the definer without granting a read of the
 * project row, so a pending invitee never sees the invite code. See 41.
 */
export async function loadMyProjectInvites() {
  const { data, error } = await supabase.rpc('my_project_invites')
  if (error) return { invites: [], missing: absent({ error }) }
  return { invites: data ?? [], missing: false }
}

/** The pending invitations you have sent, so the list can say "invited". */
export async function loadSentInvites(projectIds = []) {
  const ids = [...new Set(projectIds.filter(Boolean))]
  if (ids.length === 0) return []
  const { data, error } = await supabase
    .from('budget_project_invite')
    .select('id, project_id, invited_user, created_at')
    .in('project_id', ids)
    .eq('state', 'pending')
  if (error) return []
  return data ?? []
}

export async function inviteToProject(projectId, userId) {
  const { data, error } = await supabase.rpc('invite_to_project', {
    p_project: projectId,
    p_user: userId,
  })
  if (error) return { error }
  return { inviteId: data }
}

export async function respondToProjectInvite(inviteId, accept) {
  const { data, error } = await supabase.rpc('respond_to_project_invite', {
    p_invite: inviteId,
    p_accept: accept,
  })
  if (error) return { error }
  return { projectId: data }
}

/**
 * Which refusal this was, as an i18n key.
 *
 * invite_to_project() and respond_to_project_invite() raise plain English
 * sentences, because a Postgres exception is written for whoever is reading
 * the log. The app is bilingual, so the sentence is matched here and the one
 * on screen is translated. Matched on a distinctive fragment rather than on
 * equality: the message arrives wrapped in PostgREST's own envelope.
 *
 * Null for anything unrecognised, and the caller falls back to errorText. A
 * refusal nobody predicted must still reach the screen, in full, rather than
 * being flattened into a friendly sentence that is not true.
 */
const INVITE_ERRORS = [
  ['do not share a group', 'proj.err_not_friend'],
  ['only the owner', 'proj.err_not_owner'],
  ['already in this project', 'proj.err_already_in'],
  ['is archived', 'proj.err_archived'],
  ['already been answered', 'proj.err_answered'],
  ['not yours', 'proj.err_not_yours'],
  ['no such invitation', 'proj.err_gone'],
]

export function inviteErrorKey(error) {
  const raw = `${error?.message ?? ''} ${error?.details ?? ''} ${error?.hint ?? ''}`.toLowerCase()
  return INVITE_ERRORS.find(([needle]) => raw.includes(needle))?.[1] ?? null
}

/** Withdraw one you sent. The policy allows it only while it is unanswered. */
export async function withdrawProjectInvite(inviteId) {
  const { error } = await supabase
    .from('budget_project_invite')
    .delete()
    .eq('id', inviteId)
  return { error }
}
