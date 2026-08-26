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
const ABSENT = new Set(['PGRST205', '42P01', '42883'])

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
