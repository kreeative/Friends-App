# Decisions

Why v2 is shaped the way it is. Every entry answers one question: *does this
make the group more likely to still be here in week 12?*

Four decisions marked **[contested]** depart from the original brief. Each one
notes how to reverse it, because they are judgement calls rather than facts.

---

## The check-in window is a property of the group, not the person **[contested]**

The brief said each person has their own recurring check-in. This builds one
shared window instead: everyone checks in between Sunday 18:00 and Monday
23:59 in the group's timezone.

A ritual needs simultaneity. If one person checks in on Tuesday and another on
Friday, there is no moment — only a form that is permanently open, which is
what v1 already was and what went quiet after nine days. A shared window gives
the week a beat, makes one digest email meaningful instead of five, and turns
"who hasn't checked in yet" into something the group can see rather than
something only the server knows.

It also makes silence cheap to detect. `cycles` rows mean "missed two in a
row" is a join, not date arithmetic scattered through the client.

*To reverse:* move `checkin_dow` / `opens_hour` / `window_hours` from `groups`
to `group_members` and make `cycles` per-member. The rest of the schema is
unaffected — `checkins` already keys on `(cycle_id, user_id)`.

## Results stay sealed until the window closes

Until the window ends (or everyone is in, whichever comes first), the board
shows *who* has checked in, not *what* they said.

Holding the reveal is what makes the app worth opening at a specific time. An
always-visible board looks identical whenever you glance at it, so there is
never a reason to glance. It also removes the anchoring effect where whoever
posts first sets the tone and everyone else calibrates their honesty to it.

## No freezes — declared absences instead **[contested]**

The brief asked for a small number of freezes that auto-apply to a missed
period. This ships `away_periods` instead: you mark a cycle away *in advance*,
and it leaves the completion-rate denominator entirely.

Freezes exist to protect an unbroken chain. The headline metric here is
deliberately not a chain — it is "11 of the last 14" over a rolling window,
which needs no protection because it heals on its own as the window slides. An
auto-applied freeze would be worse than nothing: it silently changes the
denominator to 13, the user never sees the save, so it costs a balance, refill
rules and UI while delivering no felt relief.

A declared absence does the same forgiveness work honestly, and it earns its
keep twice — a member who says "exams, back in two weeks" is not silent, so
they correctly do not trigger the quiet-member flow.

*To reverse:* add `freezes_remaining` to `group_members` (the `freeze_grace`
column on `groups` is already there, unused) and have `tick()` consume one
when it would otherwise record a miss.

## Nudges are claimed, not assigned **[contested]**

The brief asked for a rotating assignment. This shows the whole group that
someone has gone quiet and lets anyone claim it; the rotation kicks in only
after 24 hours with no volunteer.

Rotation distributes by fairness, not by closeness. In a group of five some
pairs are close friends and some are acquaintances-by-association, and "you
have been assigned to check on Sam" produces either nothing or a stilted
message. Volunteering is a real commitment; an assigned chore is the exact
texture of obligation that makes people quit. But pure volunteering fails to
diffusion of responsibility, hence the 24-hour fallback — the rotation is the
safety net, not the mechanism.

The nudge deliberately points *out* of the app: message them where you
actually talk. Competing with iMessage is a losing game, and a nudge that
arrives as another app notification is the thing being ignored, not the cure.

*To reverse:* in `tick()`, set `assigned_to` at insert time rather than after
24 hours, and drop the claim button from `NudgeBanner`.

## OAuth first, magic link second **[contested]**

The brief allowed either. Google sign-in is the primary path and email is the
fallback.

A magic link opens in whatever the OS considers the default browser, which is
frequently not the browser the person started in — so the session lands
somewhere they cannot see, and they are stuck. For an app whose entire promise
is "sixty seconds, standing up", that is a fatal first-run failure. The link
stays available for anyone who would rather not use a Google account.

*To reverse:* swap the button order in `pages/SignIn.jsx`. No schema change.

## Counts, not three states, for recurring goals

The brief specified done / partial / missed. The database stores
`count_done` and *derives* the three-state label.

"3× a week" has four honest answers, not three, and the difference between 0
and 2 is exactly the information the group needs to be useful. Storing the
count also makes group-goal contribution tracking fall out for free instead of
needing its own table.

## A rate, never a streak

The headline number is "11 of the last 14" over a rolling window. Nothing in
the app can reset to zero.

The abandonment cliff on chain counters is well documented and mechanical: the
chain breaks, the identity attached to it ("I'm a 40-day person") dies, and
restarting from zero is less appealing than quitting. A percentage degrades
gracefully — a bad week is a few points, and the window forgets it entirely
within three months.

## Missing is a hollow square, not a red one

`HistoryStrip` draws submitted cycles as filled, missed ones as an empty
outline, away ones as hatched. Nothing is red and nothing is labelled
"overdue".

Guilt-shaped UI produces avoidance: a wall of red makes people close the app,
which is the opposite of what a wall of red is trying to achieve. The strip is
built to show accumulation — Amabile's progress principle is that visible small
progress is the strongest sustained motivator there is, so the design shows
what has been built rather than what is owed.

## Pause is a first-class state

`goals.status` includes `paused`, and re-entry pauses everything old in one
tap rather than presenting a backlog.

Someone returning after three quiet weeks meets either a wall of overdue items
or a clean slate. The wall is why they do not return. Pausing is not a soft
delete — history stays intact, so the completion rate stays honest.

## Group progress, no leaderboard

Settings shows one collective rate and everyone's history side by side,
unsorted.

Ranking friends by performance demotivates whoever is last, and that is
precisely the person the group needs to retain. Cooperative framing also gives
the group a shared object to talk about, which is what a check-in is for.

## Two emails per cycle, enforced in the database

One digest before the window opens, one message after a missed cycle. The
ceiling is a unique constraint on `notifications_log (user_id, cycle_id, kind)`,
not a rule in application code.

Notification fatigue is a top churn driver, and send-limiting logic is exactly
the kind of thing that quietly breaks during a refactor or double-fires on a
retry. Making it a constraint means a duplicate is impossible rather than
unlikely.

## Outcome goals are discouraged, not blocked

`GoalForm` pattern-matches on outcome language ("hit 10k followers") and asks
what weekly action would get you there, offering to track that instead. It
does not refuse to save.

Process goals are within the person's control, which is what makes it fair to
hold someone accountable for one. But hard-blocking teaches people to phrase
around the filter, and some outcome goals are genuinely what someone wants to
watch. The nudge is at creation time, where rewriting is cheap.

## What was deliberately not built

**Chat.** They already have a group chat and it is better than anything this
app would ship. Settings has a share-out button instead.

**Push notifications.** Web push on iOS requires installing the PWA to the
home screen, which most people will not do — so a push-first design would
silently reach nobody. Email is the honest channel.

**Payments for stakes.** `stake_text` is a string the humans settle
themselves. Processing money between friends adds compliance surface and
converts a joke into a debt.

**Points, badges, currencies.** Extrinsic rewards crowd out intrinsic
motivation for goals people actually care about, and this app is only useful
to people who already care.
