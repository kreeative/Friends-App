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

export async function addProjectEntry({ projectId, userId, amountCents, label, category, happenedOn }) {
  const { error } = await supabase.from('budget_project_entry').insert({
    project_id: projectId,
    /* Always the caller. The policy enforces this too, but sending somebody
       else's id and getting a refusal is a worse error than not being able to
       express the idea. */
    paid_by: userId,
    amount_cents: amountCents,
    label: label?.trim() || null,
    category: category?.trim() || null,
    happened_on: happenedOn,
  })
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
