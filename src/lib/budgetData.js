import { supabase } from './supabase'

/**
 * One read of everything the money feature needs.
 *
 * Separate from budget.js so that file stays pure arithmetic with no imports,
 * which is what lets `npm test` run it under plain node with no bundler and no
 * environment. Shared by the dashboard card and the money page so the two can
 * never disagree about what "left this period" means.
 *
 * `missing` is the migration not having been run. It is a state, not an error:
 * the caller hides the feature rather than showing a PostgREST code to
 * somebody who cannot act on one.
 */
const ABSENT = new Set(['PGRST205', '42P01'])

export async function loadBudget(userId) {
  if (!userId) return { plan: null, fixed: [], entries: [], missing: false }

  const [p, f, e] = await Promise.all([
    supabase.from('budget_plan').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('budget_fixed')
      .select('*')
      .eq('user_id', userId)
      .order('amount_cents', { ascending: false }),
    supabase
      .from('budget_entry')
      .select('*')
      .eq('user_id', userId)
      .order('happened_on', { ascending: false })
      .limit(200),
  ])

  if ([p, f, e].some((r) => r?.error && ABSENT.has(r.error.code))) {
    return { plan: null, fixed: [], entries: [], missing: true }
  }

  return {
    plan: p.data ?? null,
    fixed: f.data ?? [],
    entries: e.data ?? [],
    missing: false,
  }
}
