-- ============================================================================
-- design-beats-discipline: chapter bodies. GENERATED, do not edit.
--
-- Rebuild: node scripts/build-chapters.mjs
--
-- One book's worth of supabase/08_chapter_bodies.sql, which is the same
-- statements for all three books in one transaction. Run either. These only
-- UPDATE rows that 07_books_all_in_one.sql already created, so they are safe
-- to re-run and safe to run in any order.
--
-- 10 chapter(s), 15,046 words.
-- ============================================================================

begin;

-- design-beats-discipline | chapter 1 | 1,949 words | 01-the-fuel-tank-that-wasnt.md
update chapters c
   set body = $body$You have met the disciplined person. Maybe you have envied them.

They are up at six. They train four times a week without appearing to negotiate about it. They do not seem to spend Sunday evening in a low argument with themselves about whether the week starts tomorrow or next Monday. And the story you tell yourself about them (the story almost everyone tells) is that they have more of something than you do. More grit. More willpower. A bigger tank.

That story is wrong, and it is wrong in a specific and useful way. The disciplined person is not winning more fights against temptation. In the studies where researchers actually followed people around and asked, the disciplined person was reporting *fewer fights*. They had arranged their life so that the argument came up less often.

This is the whole book in one paragraph. But you should not take it on the strength of one paragraph, because for about twenty years the field believed something else entirely, and the story of how that belief fell apart is the best possible argument for why you should stop trying to want it more.

## The radishes

In 1998 Roy Baumeister and his colleagues published an experiment that would go on to be cited thousands of times and to shape a decade of self-help.

Participants arrived at a lab that had been deliberately filled with the smell of fresh-baked chocolate chip cookies. On the table was a bowl of the cookies and a bowl of radishes. One group was told to eat the cookies. Another group was told to eat the radishes and leave the cookies alone. A third group skipped the food entirely.

Then everyone was given a geometric puzzle to work on. What nobody was told was that the puzzle was unsolvable.

The cookie group and the no-food group worked at it for around twenty minutes. The radish group, the people who had just spent five minutes sitting in front of warm cookies not eating them, gave up in about eight.

The interpretation was elegant and immediately intuitive: self-control runs on a limited resource. Resisting the cookies drew the tank down. There was less left for the puzzle. Baumeister called it *ego depletion*, and it explained an enormous amount of ordinary experience. Why you eat badly at eleven at night after a hard day. Why the diet survives the office and dies in your own kitchen. Why judges, famously, seemed to grant parole more often in the morning.

For most of two decades, this was the model. It is still the model most people are working from, including most people writing about habits. And it does not appear to be true.

## What happened when people checked

In 2014 Evan Carter and Michael McCullough re-examined the meta-analysis that the ego depletion literature rested on. When they corrected for small-study effects (the statistical fingerprint left when small experiments that found nothing quietly fail to get published), the effect shrank towards zero.

That is a warning sign, not a verdict. So the field did the right thing, and the correct thing here is rare enough to be worth admiring: they ran a pre-registered replication at scale. Twenty-three laboratories, a protocol agreed in advance with Baumeister's input, over two thousand participants, everyone committed to publishing whatever came out.

Martin Hagger and colleagues published the result in 2016. The effect was, for practical purposes, zero.

Related findings went with it. The glucose account (the idea that self-control literally burns blood sugar, and that a sweet drink restores it) did not hold up either; the arithmetic on how much glucose the brain actually uses for a cognitive task never really worked. The parole judges study turned out to have alternative explanations involving case ordering.

I want to be careful here, because "willpower is a myth" is its own kind of overclaim and you will see it on the internet in exactly that form. Effort is real. Fatigue is real. Anyone who has done a hard day's thinking knows that the ninth hour is not the first. What collapsed is something narrower and more specific: **the model in which self-control is a single general-purpose fuel that any act of restraint depletes for any other task.** That model is what most advice is built on. It is what "just be more disciplined" assumes. And it did not survive contact with a proper replication.

Which leaves the question the original experiment was trying to answer. Some people really are more consistent than others. If it is not the size of their tank, what is it?

## The people who never had to resist

Around the same time the depletion literature was coming apart, a different set of researchers were doing something less dramatic and more useful. They were finding out what high self-control people actually do all day.

Wilhelm Hofmann and colleagues ran an experience-sampling study. Participants carried devices that pinged them at random moments and asked what they wanted, whether it conflicted with a goal, and whether they had acted on it. Over a week, thousands of reports.

The finding is the one that should reorganise how you think about this. People who scored high on trait self-control did not report resisting temptation more successfully.

They reported **experiencing less temptation in the first place.**

Marina Milyavskaya and Michael Inzlicht found the same shape in students pursuing goals over a semester. The students who reported more temptation did worse. And effortful inhibition (actually gritting your teeth and refusing) did not predict whether they reached the goal. If anything, having to do a lot of it was a sign that the goal was already in trouble.

Then Brian Galla and Angela Duckworth put the mechanism on the table. Across six studies, they showed that the well-documented link between trait self-control and good life outcomes (better grades, better health, more savings) was substantially *mediated by beneficial habits*. Not by heroic resistance. By behaviours that had become automatic enough not to require a decision.

This lines up with what Wendy Wood's group has found by simply measuring what people do: a large share of daily behaviour is repeated in the same context, at the same time, in roughly the same way, without much conscious deliberation. Estimates vary and the often-quoted "43%" is a specific finding from specific diary studies rather than a law of nature. But the direction is not in dispute. A great deal of your day is not being decided. It is being run.

So here is the corrected picture. The disciplined person is not stronger. **They are running more of their day on rails, and fewer of their good outcomes depend on a decision going their way.**

## Why this is good news

I have watched people receive this idea two ways.

The first is relief, and it is usually followed by a specific memory. The person thinks of some stretch where they were doing well (training consistently, writing every morning, whatever it was) and they realise it was never that they wanted it more that month. It was that the gym was on the route home. Or their flatmate went at the same time. Or the deadline was real. And when the circumstance changed, the behaviour went with it, and they blamed their character for what was actually a change of address.

The second reaction is a kind of deflation. If it is not effort, what is it for? Where is the credit?

The credit is in the design. That is not a consolation prize; it is a harder and more transferable skill than wanting things. Anyone can want something on a Sunday evening. Arranging your life so that Wednesday at seven in the evening does not require wanting anything at all. That is the actual work, and almost nobody does it deliberately.

There is also a version of this that goes too far, so let me put the limit in now. Design does not make effort unnecessary. It makes effort *load-bearing in fewer places*. You will still have hard days. The point is to reduce the number of days on which everything depends on you being at your best, because your best is not something you can schedule.

## What this does to a check-in

If self-control is mostly design, then the honest question at the end of a week is not "did you try hard enough." Nobody can answer that, and the answer is not actionable either way.

The question is: **what were you relying on, and did it hold?**

That is answerable. It also produces something you can change. "I didn't have the discipline" leads nowhere. There is no next step, only a resolution to feel differently. "I was relying on going after work, and three times out of four something ran late" leads directly to a different plan.

This is also why doing this with other people works, and why it works even when nobody is checking whether you are trying. The group is not a source of willpower. It is a piece of structure. A fixed time, a specific set of people who will notice, a question you know is coming. It works the way a scheduled class works, which is to say it removes the decision rather than winning it.

## Where the rest of this goes

The next eight chapters are the mechanics.

We will look at what actually distinguishes people who look consistent (chapter two), and why a habit is a property of a context rather than of a person (chapter three), which is why your routine collapses when you move house, and why that is not a moral failure.

Then the tools. If-then plans, which are the single best-supported technique in this literature and take about ninety seconds to write (chapter four). Friction, which is the most powerful lever most people never touch (chapter five). Bundling and precommitment, including where precommitment backfires (chapter six).

Chapter seven is about how long this takes, and it is the chapter most likely to save you from quitting: the famous sixty-six days is a *median* with an enormous spread, and knowing the spread changes what you do at week three.

Chapter eight is about the lapse, which is not the problem. What you do in the seventy-two hours after the lapse is the problem, and that is a separate skill that almost no one is taught.

Chapter nine is identity, handled carefully. This is the part of the popular literature that has run furthest ahead of the evidence, and it is worth having straight.

Chapter ten is you building your own system, on paper, for one specific thing you are currently failing at.

## One thing to do this week

Do not change anything yet. Measure the thing you have never measured.

Pick the one behaviour you most want to be consistent about. For the next seven days, every time you either do it or skip it, write down one line: **where you were, what time it was, and what you had just finished doing.** Nothing else. Not how you felt, not whether you meant to. Those are the things you already pay attention to, and they are the least useful data you have.

At the end of the week, look at the skips. You are not looking for a reason. You are looking for a *pattern of circumstance*: a time of day, a place, a preceding activity that keeps showing up.

Almost everyone finds one. Most people are surprised by it, because it is not the thing they had been blaming.

That pattern is your first piece of design work. The rest of this book is what to do with it.$body$,
       word_count = 1949
  from books b
 where b.id = c.book_id
   and b.slug = 'design-beats-discipline'
   and c.idx = 1;

-- design-beats-discipline | chapter 2 | 1,471 words | 02-what-the-disciplined-actually-do.md
update chapters c
   set body = $body$There is a specific moment I want you to picture, because everything in this chapter turns on it.

It is Wednesday. You said you would train. You get home, you put your bag down, and there is a gap of about ninety seconds in which the thing is genuinely undecided. You are not lazy in that gap. You are not weak. You are simply a person standing in a warm room with a sofa in it, holding a decision that has to go the right way or the week has a hole in it.

The last chapter argued that consistent people are not winning that moment more often. This chapter is about what they are doing instead, and the answer is more concrete than "having good habits". They are systematically arranging things so that the ninety seconds either never happens, or happens somewhere it is easy to win.

## Upstream and downstream

The most useful map of this comes from an unlikely place: research on emotion, not on discipline.

James Gross spent years building what he called the process model of emotion regulation. His observation was that a feeling is not a single event you either control or fail to control. It unfolds over time, and you can intervene at several points along the way. He laid out five families of strategy, roughly in the order the opportunity arrives.

**Situation selection.** Choose whether to be there at all.

**Situation modification.** Be there, but change something about it.

**Attentional deployment.** Be there, in the unchanged situation, and change what you are looking at.

**Cognitive change.** Look at the same thing and think about it differently.

**Response modulation.** Feel the whole thing at full strength and suppress what you do about it.

Read that list from the bottom up and you have most of what people mean by willpower. Response modulation is the cookies in front of you and your jaw set. It is the last and hardest place to intervene, it costs the most, and it is where nearly all popular advice lives.

Read it from the top and you have what consistent people are actually doing. Angela Duckworth, working with Gross and Tamar Gendler, took this model and pointed it directly at self-control rather than at emotion. The claim is straightforward and, once you see it, hard to unsee: the strategies that arrive earlier in the sequence are cheaper and more reliable than the ones that arrive later, and the difference between people who look disciplined and people who do not is largely a difference in how early they intervene.

Duckworth's group tested this with adolescents facing an ordinary and genuinely hard problem: doing homework with a phone in the room. Students who used situational strategies (leaving the phone elsewhere, working in a room where other people were working) did better on self-control outcomes than students relying on gritting their teeth. The strategies were not more impressive. They were earlier.

Natasha Ent, working with Baumeister and Dianne Tice, found a matching pattern in trait measures. People who score high on self-control questionnaires report avoiding tempting situations more, not resisting them more. The questionnaire is called a self-control scale, and a large part of what it is measuring appears to be a talent for not being in the room.

## The marshmallow test was never about resisting

This is worth a section of its own, because the marshmallow test is the single most misremembered study in this area, and the misremembering is exactly the error this chapter is about.

Walter Mischel's paradigm, run at Stanford from the late 1960s, put a young child in a room with a treat and a promise: wait until the experimenter comes back and you get two, or ring the bell now and get one. Later work reported that children who waited longer had better outcomes years afterwards, and the study entered popular culture as a test of raw willpower in miniature. Some children had it. Some did not. Presumably that was destiny.

Two corrections.

The first is about the size of the effect. In 2018 Tyler Watts, Greg Duncan and Haonan Quan ran a conceptual replication on a much larger and more socioeconomically diverse sample. The association with later outcomes survived, but it shrank a great deal once family background and early cognitive ability were accounted for. Delay of gratification at four is real, and it is substantially a marker of the circumstances a child is growing up in rather than an independent engine of their future. Whether waiting even makes sense depends on whether adults in your life have historically come back with the second marshmallow.

The second correction is the one nobody quotes, and it is in Mischel's own data from the beginning. The children who waited were not sitting there wanting the treat harder and refusing harder. They were doing things. They turned around. They covered their eyes. They sang, kicked the table, invented games. When Mischel and Ebbesen made the treat visible rather than covered, waiting times collapsed. When children were coached to think about the marshmallow abstractly, as a picture of itself or as a cloud, they waited far longer.

The successful children were using attentional deployment and cognitive change. Positions three and four on Gross's list. Not response modulation. The most famous willpower study in psychology is, read properly, a study of children discovering that the way to win is to stop looking.

## Monitoring is not a moral activity

One more thing consistent people do, and it is the least glamorous item in this book.

They keep track.

Thomas Webb, Paschal Sheeran and colleagues (with Ben Harkin as lead author) pulled together 138 studies of progress monitoring, covering more than 19,000 participants. The result: prompting people to monitor their progress towards a goal improved the rate at which they attained it, and two things made it stronger. Reporting the progress publicly, or recording it physically, both increased the effect.

The mechanism is not mystical and it is not motivational. A goal is a comparison between where you are and where you said you would be, and you cannot run that comparison on information you do not have. Most people, most of the time, are working from a vague feeling about how the month has gone. That feeling is generated by memory, and memory is not a neutral witness about your own conduct.

This is also, incidentally, most of what a weekly check-in with other people is doing. Not inspiration. Measurement, out loud, in front of witnesses, on a schedule.

## What this looks like in a life

Put the three together and you get a description of the consistent person that has nothing to do with strength.

They have arranged their circumstances so that fewer decisions are live. They intervene early rather than late, which means most of their good outcomes are settled hours before the moment they would otherwise have had to fight for them. And they have some record of what they actually did, so that they are working from information rather than from a mood.

None of that is character. All of it is procedure. Which is why it can be copied, and why the people who look most disciplined are so often unhelpful when you ask them how they do it. They genuinely do not experience themselves as trying hard. From the inside, a decision you removed six months ago does not feel like a victory. It feels like nothing at all.

There is a cost to being honest about this, and I would rather state it than let you find it later. Situation selection is not always available. You cannot always choose the room. Someone with a chaotic job, small children, or a home they do not control has fewer upstream levers than someone with a quiet flat and a predictable calendar, and a lot of writing in this genre is quietly addressed to the second person while pretending to address the first. Where the levers are fewer, the honest advice is to spend them carefully rather than to spread them thin. One well-chosen change beats a system.

## This week

Find the ninety seconds.

Take the one behaviour you most want to be consistent about and identify the exact moment where it is decided. Not the hour. The moment. The point at which you are standing somewhere, holding something, having just finished something else, and it could go either way.

Then move one thing so that moment happens differently. Put the bag by the door instead of in the cupboard. Arrange to arrive with someone else. Change the room. Move the thing you reach for instead so it takes thirty seconds longer to get to.

One change, upstream of the decision, this week. Then notice whether the ninety seconds still happens at all.$body$,
       word_count = 1471
  from books b
 where b.id = c.book_id
   and b.slug = 'design-beats-discipline'
   and c.idx = 2;

-- design-beats-discipline | chapter 3 | 1,472 words | 03-habits-are-context-not-character.md
update chapters c
   set body = $body$Something happens when people move house, and almost nobody reads it correctly.

You had a routine. You ran three mornings a week, or you cooked properly, or you read before bed instead of scrolling. Then you moved, and within about a month most of it was gone. Not dramatically. It just stopped occurring to you. And the conclusion you drew, because it is the conclusion everyone draws, was about you: that you had let things slip, that the version of you who ran was a temporary version, that you would need to find the discipline again.

That is the wrong conclusion, and this chapter is about the research that shows why.

## A habit is a relationship between two things

The everyday use of the word habit is roughly "a thing I do a lot". The research use is more specific and much more useful: a habit is a learned association between a **context** and a **response**, strong enough that the context alone starts to produce the response without a decision in between.

The context is where you are, what time it is, who is present, and above all what you have just finished doing. The response is the behaviour. The association is what does the work. Once it is strong, the behaviour is no longer being chosen each time; it is being triggered.

Wendy Wood has spent a career making this precise. In diary studies with Jeffrey Quinn and Deborah Kashy, participants recorded what they were doing at intervals through the day along with how they were doing it. A large share of behaviour turned out to be repeated in a stable context, at a stable time, with little accompanying thought. The often-quoted figure of about 43% comes from this line of work, and it is worth being careful with: it is a finding from particular samples using particular diary methods, not a constant of human nature. The proportion moves around. What does not move around is the basic result, which is that a substantial part of your day is not being decided in the moment you experience as deciding it.

## The stale popcorn

If you want one study that makes the mechanism concrete, this is it.

David Neal, Wendy Wood, Mengju Wu and David Kurlander gave people popcorn in a cinema before a film. Some of the popcorn was fresh. Some had been sitting around for a week and was, by every account including the participants' own ratings, unpleasant.

People who reported a strong habit of eating popcorn at the cinema ate about as much of the stale popcorn as the fresh. People without the habit ate much less of the stale batch, which is what you would expect from anyone with functioning taste buds.

Then the researchers moved the whole thing to a meeting room. Same people, same popcorn, no cinema. The habitual popcorn eaters now behaved like everybody else. They ate the fresh and left the stale.

The habit was not a preference for popcorn. It was not a weakness for snacks. It was an association between a specific setting and a specific action, and when the setting went, the action went with it, immediately and without any effort or intention on the person's part.

## Moving house is a natural experiment

Which brings us back to your move.

Wood, Leona Tam and Melissa Witt studied students who transferred between universities, tracking exercise, newspaper reading and television watching before and after the move. The transfer changed the physical and social context wholesale, and the effect on behaviour depended on whether the relevant features of the context survived. Where the cues that had supported a behaviour were still present in the new environment, the old habit carried over. Where they were not, the behaviour reverted to being governed by intentions, which is to say it became fragile and effortful again.

Bas Verplanken and colleagues turned this into a proposal they called the habit discontinuity hypothesis: a change of circumstances temporarily unfreezes behaviour, and that window is when new patterns are unusually easy to establish. They tested it in the domain of environmental behaviour, and it has since been used deliberately in public health and transport interventions, on the reasoning that the best time to reach someone about how they travel to work is the month they move, not the month they are settled.

So the correct reading of your collapsed routine is not that you lost your discipline when you moved. It is that you were running a set of behaviours that were held in place by a kitchen, a route, a set of times and a particular front door, and you left all of them behind. What you lost was the scaffolding. You then blamed the building.

There is a second, more cheerful implication, and it is the reason this chapter exists in a book about design. If context is what holds a behaviour in place, context is also what you can change on purpose. You do not have to wait for a move.

## What is happening in the brain, briefly

I will keep this short, because the neuroscience is often used to add authority to claims it does not actually support.

Ann Graybiel's work on the basal ganglia describes a process she calls chunking: as a sequence of actions is repeated in a stable setting, its neural representation reorganises. Activity concentrates at the start and end of the sequence rather than being spread through it, as though the whole run has become a single unit that gets launched rather than a series of steps that get selected.

The other relevant finding comes from outcome devaluation studies in animals. Train an animal to perform an action for a reward, then make the reward worthless (by feeding the animal to satiety, or by pairing the reward with mild illness). Early in training, the animal stops performing the action. After extended training in a stable context, it keeps going. The behaviour has stopped being controlled by how much it wants the outcome and started being controlled by the situation.

That is a reasonable model for why you can find yourself eating something you do not want, in a kitchen, at eleven at night, having formed no intention to do so at any point.

What I want to flag is that "habits live in the striatum, so they are automatic and beyond your control" is an overreach. These systems interact. Goal-directed control is not switched off. The honest version is narrower: repetition in a stable context shifts the balance of control towards the situation and away from the outcome, and that shift is gradual, partial, and reversible.

## Why this reframing is worth having

Two practical consequences.

The first is diagnostic. If your consistency collapses, the first question is not "what is wrong with me" but "what changed about the circumstances". Holidays, illness, a new job, a partner's new shift pattern, a building site on your running route, a friend moving away. These are not excuses. They are the actual causal story, and looking at them gets you a next step, whereas looking at your character gets you a feeling.

The second is that it tells you what to attach a new behaviour to. If a habit is a context-response association, then a new behaviour needs a context, and the most reliable contexts are the ones that already happen at a fixed point without your involvement. Not "in the mornings". After the kettle boils. After you put the laptop in the bag. After the school run. Existing stable events are the most valuable real estate you own, because they arrive whether or not you were thinking about them.

This is what the next chapter is about in detail, because there is a specific and well-tested way of writing that link down, and it is the single best-supported technique in this literature.

## This week

Take the behaviour you are trying to make consistent and write down its context, in full, as it currently exists.

Where does it happen. What time. Who else is there. **What do you do immediately before it.** That last one is the question people skip and it is the one that matters most, because the preceding activity is usually the real trigger and it is almost never the one you would have named.

Then do the same for a behaviour you are consistent about already, and that you never think about. Brushing your teeth, making coffee, whatever it is. Notice how specific the context is, and notice that you did not build it deliberately.

You are looking for the difference between the two. In nearly every case, the behaviour that holds is the one that is welded to something that happens anyway, and the behaviour that keeps collapsing is floating free, waiting to be remembered.$body$,
       word_count = 1472
  from books b
 where b.id = c.book_id
   and b.slug = 'design-beats-discipline'
   and c.idx = 3;

-- design-beats-discipline | chapter 4 | 1,579 words | 04-if-then.md
update chapters c
   set body = $body$On Sunday you decided you were going to the gym three times this week.

You were not lying. You meant it completely. You could picture it, you knew which days, you felt the small lift that comes with having decided something. It is now Thursday evening and you have been once.

Nothing dramatic happened. There was no moment where you stood at the door and chose the sofa. Tuesday you were going to go after work and then a thing ran late and by the time you were home it was too complicated. Wednesday you were going to go in the morning and you did not surface in time and told yourself you would go in the evening instead, and then the evening arrived already occupied.

The intention never failed. It just never converted.

## The gap has been measured, and it is large

This is the intention-behaviour gap, and it is one of the more robustly documented embarrassments in psychology.

Paschal Sheeran's reviews put the headline figure plainly: intentions typically account for something in the region of a quarter to a third of the variation in whether people actually do things. That leaves the majority unexplained by the thing everyone treats as the cause.

The sharper version comes from Thomas Webb and Sheeran, who in 2006 pooled experimental studies rather than correlational ones, which matters, because a correlation between intending and doing might just mean that people who were going to do it anyway also reported intending it. They looked at studies that successfully *changed* people's intentions and then measured behaviour. A medium-to-large shift in intention produced only a small-to-medium shift in behaviour. Moving what people intend moves what they do, but far less than you would hope, and far less than most advice assumes.

So the standard response to inconsistency, which is to work on wanting it more, is aimed at a variable that is already close to maxed out and only weakly connected to the outcome. You do not have an intention problem on Thursday. You had a perfectly good intention on Sunday.

## Gollwitzer's move

Peter Gollwitzer's contribution was to separate two things that ordinary language runs together.

A **goal intention** is "I intend to reach Z". I intend to exercise more. I intend to get the report done.

An **implementation intention** is a different shape entirely: "If situation X arises, I will perform response Y." It does not concern itself with what you want. It specifies a cue and welds a response to it.

The claim is that this second form works through a mechanism the first does not have access to. By naming a concrete situational trigger, you make that situation more likely to be noticed when it arrives, and you pre-decide the response, so that acting on it does not require a fresh decision at a moment when you may have no appetite for one. Gollwitzer's phrase is that behaviour becomes *delegated to the situation*. Which should sound familiar, because it is the same machinery as the last chapter: a context, a response, an association between them. The difference is that here you are writing the association down deliberately instead of waiting years for repetition to build it.

## What happened when people tried it

Gollwitzer and Veronika Brandstätter ran the study that made the case. Students were asked to write a report on how they spent Christmas Eve, and to submit it within 48 hours, over a holiday period designed to be maximally hostile to getting anything done. Some were additionally asked to specify exactly when and where they would write it. In the group that formed those specific plans, roughly seven in ten submitted. In the group that only intended to, roughly three in ten did.

Sarah Milne, Sheila Orbell and Sheeran later tested it on exercise. One group filled in a questionnaire, one got a motivational intervention built on health-risk messaging, and one got the motivational intervention plus a request to write down when and where they would exercise in the coming week. The motivational intervention moved intentions. It did not move behaviour much: around a third to two fifths of both those groups exercised at least once a week. The group that also wrote the plan came in around ninety per cent.

The technique has been tried well outside the lab. Sheeran and Orbell found attendance at cervical screening appointments went up substantially among women asked to write down when and where they would go. David Nickerson and Todd Rogers ran a large field experiment on voting in which callers asked three questions, what time will you vote, where will you be coming from, what will you be doing beforehand, and turnout rose by a few percentage points against a script that merely encouraged voting. Katherine Milkman and colleagues added a blank line for the date and time to a flu-shot mailing sent to thousands of employees, and vaccination rates rose by about four percentage points off a base of a third.

Gollwitzer and Sheeran's 2006 meta-analysis pooled ninety-odd independent tests and reported a medium-to-large effect on goal attainment, over and above goal intentions. That is where the claim in the previous chapter comes from: this is the single best-evidenced technique in the behaviour-change literature.

## Now the part that gets left out

That meta-analysis is from 2006. It predates almost everything psychology has since learned about how its own literature was assembled, and the effect sizes in it should be read with that in mind. Small samples, student participants, short follow-ups, and a publication system that had no appetite for null results. When any technique's evidence base is dominated by studies of forty undergraduates over two weeks, the honest expectation is that the true effect is smaller than the average published one.

The larger and better-powered the test, the more modest the result tends to look. Milkman's own team later ran megastudies, single experiments comparing dozens of interventions across tens of thousands of people, on gym attendance and on vaccination. Planning prompts did something. They were not the standouts. Effects that read as transformative in a 1997 sample of students read as a few percentage points at scale, which is genuinely worth having and is not the same claim.

Three further limits, all of which Gollwitzer's own group established rather than critics:

**They do not manufacture motivation.** Sheeran, Webb and Gollwitzer showed the effect depends on actually being committed to the goal. If you do not want the thing, an if-then plan for it does nothing at all. This technique closes the gap between wanting and doing. It has no view on the wanting.

**More is not better.** Amy Dalton and Stephen Spiller found that planning helps when you are pursuing one goal and can hurt when you are pursuing several at once, apparently because laying out plans for five things makes the total load visible and the whole enterprise start to look unaffordable. The person who writes eight if-thens on Sunday night is doing something worse than writing one.

**They are better at starting than at continuing.** The evidence is strongest for initiating an action, attending the appointment, filing the report, getting to the gym in week one. Whether the behaviour survives to month six is a different question, and mostly a different mechanism, which is what the rest of this book is about.

## How to write one that works

The failures are nearly always in the *if*, not the *then*.

"If I have some time, I will study" is not an implementation intention. Having some time is not a detectable event. It has no edge, no moment where it becomes true, so there is nothing for your attention to catch on. Neither is "in the mornings", or "when I feel up to it", or "at some point on Tuesday".

A usable cue is something that either happens or does not, that you would notice, and that arrives whether or not you were thinking about it. The kettle clicking off. The laptop going into the bag. Dropping the kids at the gate. Sitting down on the train. The last chapter asked you to work out what you do immediately before the behaviour you are trying to keep. That answer is your *if*.

The *then* should be an action small enough that no negotiation is possible. Not "then I will train properly", which is an outcome and invites a debate about whether now is a good time for it. "Then I put my shoes on." Shoes are not a debate.

And you can point the same structure at obstacles rather than actions, which the literature calls coping planning: if the meeting overruns, then I go tomorrow morning instead. Naming the failure mode in advance is what stops a disrupted Tuesday from taking the rest of the week with it.

## This week

Write one if-then. One.

Take the single behaviour you most want to be consistent about, use the preceding event you identified last chapter as the cue, and write it as a sentence in this exact form:

**If [specific thing that happens], then I will [specific small action].**

Write it by hand and put it where the cue happens, not where you make plans. On the kettle, not in a notebook.

Then leave everything else alone. You will be tempted to do this for four behaviours, because it takes thirty seconds and feels productive, and that is precisely the version the research says stops working.$body$,
       word_count = 1579
  from books b
 where b.id = c.book_id
   and b.slug = 'design-beats-discipline'
   and c.idx = 4;

-- design-beats-discipline | chapter 5 | 1,481 words | 05-friction-is-the-lever.md
update chapters c
   set body = $body$There is a version of this you have already done by accident.

You moved the biscuits to the top shelf, or you left the phone in the other room while you worked, or you started sleeping in the clothes you run in. And it worked, and you felt slightly ridiculous that it worked, because the obstacle you put between yourself and the thing was so small. Fifteen seconds. One flight of stairs. A door.

It ought to be insulting that fifteen seconds can beat a decision you made with your whole chest on Sunday. It is worth sitting with the insult, because it is the most useful thing in this book.

## The unit is seconds, not willpower

The last two chapters said that habits live in contexts and that plans work by naming a cue. Both of those are about *when* a behaviour fires. This chapter is about *how far away it is*, which turns out to be a separate lever and a stronger one.

The general finding is that behaviour is extremely sensitive to small changes in effort, and almost completely insensitive to being told that the behaviour matters. Not proportionally sensitive. Disproportionately. A cost of a few seconds, which no rational account of your priorities would register at all, routinely moves what people do more than an argument about their health.

The cleanest demonstrations are the ones where nothing changed except the paperwork.

## Defaults

Eric Johnson and Daniel Goldstein looked at organ donor consent rates across European countries. In countries where you had to tick a box to become a donor, consent ran somewhere in the range of a few per cent to about a quarter. In countries where you had to tick a box to *not* be a donor, it ran in the high nineties.

Austria and Germany are the pair worth holding on to. Neighbouring countries, comparable populations, comparable views about death and medicine and bodies. Effectively everybody a donor in one, a small minority in the other. The difference is which way the box was printed.

Nobody in either country was thinking "I would be a donor if only the form were easier." The form was not experienced as an obstacle. It was experienced as nothing at all, which is precisely why it was decisive.

Brigitte Madrian and Dennis Shea found the same shape inside a single company's retirement plan. When new employees had to opt in, something like a third to a half enrolled. When the company switched to enrolling them automatically, with the same freedom to leave, participation went to around six in seven. And people mostly stayed at whatever contribution rate and fund the default had put them in, for years, including people for whom it was plainly the wrong rate.

Money, retirement, a decision that people say is important. Moved by the direction of a form.

## Proximity

Paul Rozin and colleagues ran a set of cafeteria studies where the only thing that changed was where the food was. Moving an item closer or further by a matter of inches, or putting it behind a sneeze guard so it needed asking for, shifted how much of it people took by something in the region of a tenth to a quarter.

Anne Thorndike's team did a longer version in the Massachusetts General Hospital cafeteria, where they labelled items green, yellow and red and also rearranged them, bringing water to eye level in every fridge and putting bottled water at the checkouts. Sales of red items fell, water rose, and the change was still there when they looked again two years later, which is unusual and worth noting: most of these effects are measured for a fortnight.

The people in that cafeteria were hospital staff. If health information were the binding constraint, it would not have been a fridge shelf that moved them.

## Now the part that gets left out

The category this all belongs to is nudging, and nudging has had a hard few years. You should know about it, because it affects how much you should expect from what follows.

**The most quotable studies in this literature are gone.** Brian Wansink ran the Cornell food lab and produced the results everybody can recite: the bottomless soup bowl that refilled itself while people kept eating, the enormous popcorn bucket, the plate size, the shelf height. He was, for two decades, the source for "your environment controls how much you eat."

Investigators found the results had been produced by running analyses until something came out, and by reporting data that did not match what had been collected. More than a dozen of his papers were retracted, and he resigned from Cornell in 2019. Some of his conclusions may still be true; the point is that they were never actually tested, and a lot of confident writing about food environments, including a great deal that is still in print, rests on them.

**The category-level effect is disputed.** A large meta-analysis by Stephanie Mertens and colleagues reported that nudges work with a medium-sized effect across the literature. A reanalysis by Maximilian Maier, Frantisek Bartos and colleagues applied corrections for publication bias, the tendency for studies that found nothing to never be written up, and found that the average effect became indistinguishable from zero. Both papers are in the same journal, a year apart. That is not a settled field.

**But defaults specifically survive.** When the analysis is narrowed to defaults rather than nudges in general, the effect holds up: Jonathan Jachimowicz and colleagues found a substantial one across a large body of work, and the organ donation and retirement findings are not fragile lab results, they are national datasets.

So the honest version is narrower than the popular version. Rearranging a room is not a magic trick, and anyone selling it as one is selling you Wansink. What is well established is more specific: **when the effortless option changes, behaviour follows, and it follows further than anyone's stated preferences predict.**

## The asymmetry you can use

There are two moves and they are not equally reliable.

*Removing* friction from something you want to do more of works, but you are competing against everything else that is also easy. The run is now twenty seconds closer and so is the sofa.

*Adding* friction to something you want to do less of is the stronger move, because the thing you are trying to interrupt is usually automatic, and automatic behaviour has no capacity to problem-solve. A habit does not want the biscuit enough to go and find a chair to stand on. It only ever wanted the biscuit that was already in reach. Interrupt it once and there is frequently nothing behind it.

This is why the phone in the other room outperforms the phone face-down on the desk, which outperforms the app moved to the third screen, which outperforms an intention to use it less. Each step in that list adds a few seconds, and each one buys more than the argument you have been having with yourself for a year.

The unit to think in is not motivation. It is: how many seconds and how many physical actions stand between me and this, right now.

## Why this chapter comes before the harder ones

Everything so far has been about making the right thing happen once. The rest of the book is about what happens over months, where the questions get genuinely harder and the evidence gets thinner.

Friction is where the leverage is highest and the effort is lowest, and it is the part you can put in place this afternoon without believing anything about yourself. That is worth doing before anything else, because it works whether or not the rest lands.

## This week

Pick the one behaviour you most wish you did less of. Not a list. The one.

Then add a single physical step between you and it. Not a rule about it, not a limit, not an intention. A step, in the world, that has to be taken with your body.

The charger goes in a different room, so the phone has to travel to be used in bed. The biscuits go somewhere that needs a chair. The app comes off the home screen and gets logged out, so it needs a password. The television remote's batteries live in a drawer.

Two rules about the step. It has to be small enough that you would not describe it as a sacrifice, because anything larger will be undone within four days. And it has to be physical, because a rule is something you can renegotiate at eleven at night and a chair is not.

Then notice, without judging it, how often the behaviour simply does not happen. Not resisted. Not overcome. Just absent, because the thing that used to run it was never that committed in the first place.$body$,
       word_count = 1481
  from books b
 where b.id = c.book_id
   and b.slug = 'design-beats-discipline'
   and c.idx = 5;

-- design-beats-discipline | chapter 6 | 1,352 words | 06-bundling-and-precommitment.md
update chapters c
   set body = $body$There is one podcast you are genuinely impatient to hear, and you have a rule that you only get it on the walk.

If you have ever done this, you have run the experiment yourself. The walk stopped requiring a decision. You were not being disciplined about walking; you were being impatient about the podcast, and the walk came along for the ride.

That is the whole of this chapter, in two forms. Attach the thing you avoid to something you want. And, where that fails, arrange the world in advance so that your future self has fewer options than you currently have.

## Temptation bundling

Katherine Milkman, Julia Minson and Kevin Volpp gave university gym members iPods loaded with page-turner audiobooks, Hunger Games and similar, and made them available only at the gym. The devices were held at the front desk. You could have the book if you came.

Attendance rose substantially, somewhere in the region of a quarter to a half above the control group in the early weeks, and the effect decayed over the following couple of months and largely disappeared after the Thanksgiving break interrupted everyone's routine.

The detail that makes the study interesting is what happened at the end. Offered the chance to buy their own restricted access, so that the audiobooks would remain gym-only, about six in ten of them said yes and were willing to pay for it. These are people volunteering to have their own choices narrowed, having felt what it bought them.

The mechanism is not complicated. Going to the gym has its costs now and its benefits in some indistinct future. Listening to a good book has its benefit now. Bundling moves a piece of the payoff forward into the moment where the reluctance actually lives, which is the moment you are standing in the hallway deciding.

## Now the part that gets left out

Milkman's own team went on to run the largest test of gym interventions anybody has run, a megastudy at a national fitness chain with tens of thousands of members and dozens of different interventions compared side by side.

Temptation bundling worked. It was not the standout. The whole field of interventions produced increases measured in a few extra minutes of exercise a week, and almost everything faded once the programme stopped. Several things that sound excellent did nothing.

That result should be held next to the 2014 study rather than replacing it. Bundling is real and it is cheap and it is worth doing. It is not a machine for turning you into someone who trains. The published effect sizes from small early studies are the ceiling, not the expectation.

Two practical limits worth knowing before you try it:

**The reward has to be genuinely wanted and genuinely restricted.** A bundle where you would have listened to the podcast anyway is not a bundle. It is a podcast.

**It works for the boring, not for the aversive.** If the activity is tedious, a good audiobook fixes the tedium. If the activity is frightening or humiliating, and a gym is that for a lot of people, then the audiobook is not addressing the thing that is actually stopping you, and the bundle will quietly fail while looking like it should have worked.

## Precommitment, and Schelling's version of you

Thomas Schelling wrote about this more clearly than the psychologists did, partly because he was describing himself trying to quit smoking. His framing was that you are not one person deciding, you are a sequence of people with conflicting interests, and the one making the plan is not the one who has to execute it.

Sunday you is negotiating on behalf of Thursday you without consulting them. Thursday you did not agree to any of this and cannot be reached in advance. All Sunday you can do is arrange the furniture before Thursday arrives.

That is precommitment: an action taken now whose entire purpose is to remove an option later.

Dan Ariely and Klaus Wertenbroch tested a mild version in a university course. Some students had three papers due at evenly spaced deadlines set by the instructor. Some could set their own deadlines, with penalties for missing them. Some had only the end of term.

Students who could set their own deadlines mostly did set them early, which is the interesting finding: given the chance to bind themselves, people take it. They also outperformed the students with no deadlines but their own. And they were still beaten by the students whose deadlines were imposed and evenly spaced.

Both halves matter. People know they need constraints and will pay for them. People are also not very good at setting them for themselves, and tend to leave more slack than is good for them.

## When money is on the line

The strongest version puts something at stake. Dean Karlan and colleagues ran a smoking-cessation programme in the Philippines where smokers deposited their own money into an account, to be returned if a urine test six months later showed they had quit, and forfeited to charity if not.

Quit rates rose by a few percentage points over the control group. Which sounds small until you notice that the base rate was low, so the relative improvement was substantial, and that this is a real behaviour with real biochemical verification rather than a self-report.

Commitment contracts are the same idea generalised, and the evidence on them is consistent and unspectacular: they help while they are active, and the effect attenuates once they stop. Heather Royer and colleagues found the same pattern with gym attendance and payments.

Three things determine whether one works at all.

**It has to be enforced by something other than you.** A promise you can quietly release yourself from at eleven at night is not a commitment, it is a mood. This is why the deposit, the referee, the direct debit and the friend who is expecting you outperform the resolution.

**The stake has to sting but not ruin.** Too small and you will pay it and shrug. Too large and you will find a way to cancel the whole arrangement, and then you are worse off than before because you have now learned that your commitments are negotiable.

**It has to name the behaviour, not the outcome.** Commit to attending four times, not to losing weight. You control the attending. The scale involves a dozen things you do not control, and a contract you can lose while doing everything right teaches you that trying does not work.

## Where this fits

Chapter five was about the seconds between you and a behaviour. This chapter is about the same principle pushed forward in time: you are still changing the situation rather than yourself, only now the situation is Thursday's, and you are changing it while you still have the appetite to.

The strategies stack. A bundle makes the behaviour more attractive. A precommitment removes the escape. Friction removes the alternative. None of them requires you to want it more on the day, which is the resource that has never been reliably available.

## This week

Do one, not both.

**If the behaviour is boring**, build a bundle. Take something you actively look forward to, a specific series, a specific album, a particular coffee, and make it available only during the thing you are avoiding. It has to be something you would otherwise have this week, so that withholding it costs you something. Then hold the line for seven days, which is the whole test.

**If the behaviour is one you avoid for reasons other than boredom**, make one precommitment instead, and make it small. Pay for the thing in advance. Tell one specific person a specific time you will be there. Put the appointment in the calendar as an appointment with someone else, not as a note to yourself.

Write down which one you chose and why, in a sentence. In six weeks that sentence will tell you something useful about which category the behaviour actually belonged to, and people are frequently wrong about that on the first attempt.$body$,
       word_count = 1352
  from books b
 where b.id = c.book_id
   and b.slug = 'design-beats-discipline'
   and c.idx = 6;

-- design-beats-discipline | chapter 7 | 1,263 words | 07-sixty-six-days-give-or-take-a-lot.md
update chapters c
   set body = $body$You know the number. Twenty-one days to form a habit.

It is on posters in gyms and in the opening paragraph of a thousand articles, and it has the particular smell of a fact that everybody knows and nobody has ever seen a source for.

Here is the source. In 1960 a plastic surgeon named Maxwell Maltz published a self-help book called *Psycho-Cybernetics*. He observed that patients seemed to take about three weeks to get used to a new face after surgery, and that people who had lost a limb often reported a phantom sensation for roughly the same period. From this he wrote that it usually requires a minimum of about twenty-one days for an old mental image to dissolve and a new one to take hold.

Note what he actually wrote. *Usually. A minimum. About.* Three hedges in one sentence, attached to an observation about surgical recovery, in a book that sold thirty million copies. The hedges did not survive the retelling. The number did.

## What happened when somebody measured it

Phillippa Lally, Cornelia van Jaarsveld, Henry Potts and Jane Wardle did the study that should have replaced it, and largely has not.

They recruited around a hundred people, had each choose one new eating, drinking or activity behaviour to do daily in response to a cue of their choosing, and then had them log every day for twelve weeks. Crucially, what was measured was not whether they did it. It was how *automatic* it felt, on a validated scale, tracking the shift from deliberate action to something that happens without a decision.

The automaticity scores traced a curve that rises steeply at first and then flattens. The median time to reach the flat part was 66 days.

That is where the number in the title comes from, and it is a better number than 21. But it is the least interesting thing in the paper.

## The bit that actually matters

**The range was 18 to 254 days.**

Some people were done in under three weeks. Some were still climbing after eight months. Same study, same design, same daily logging.

And the 66 figure is a median drawn from the subset of participants whose data fit the curve well enough to extrapolate from, which was fewer than half of them. For the rest, the model could not say when they would plateau, because they had not.

So the honest summary of the best study anybody has run is: it takes somewhere between three weeks and most of a year, it depends enormously on who you are and what you picked, and for a large fraction of people twelve weeks of daily repetition was not enough to finish the job.

Which is a far more useful thing to know than 66, because it means that if you are on day 40 and it still feels like effort, nothing has gone wrong. You are inside the normal range and not near the end of it.

## Three findings people skip past

**Complexity changed everything.** Drinking a glass of water with lunch became automatic quickly. Doing fifty sit-ups before breakfast took far longer and in some cases never got there. The behaviour you choose sets the timescale, and choosing an ambitious one is choosing a long one.

**Missing a day did not matter.** The researchers looked specifically at what happened when someone skipped an opportunity, and found that a single missed day did not meaningfully affect the trajectory. The curve carried on where it had left off.

This is the finding most worth carrying out of this book, and the next chapter is entirely about it.

**Early repetitions were worth more than later ones.** Because the curve is steep at the start and shallow at the end, the tenth repetition buys you far more automaticity than the sixtieth. Front-loading matters. A dense, consistent first fortnight is doing more work than a scattered first two months, even if the total count ends up the same.

## Now the part that gets left out

This is one study, with fewer than a hundred people, using self-report, published in 2010, and it has become the single most cited number in popular writing about habits. That combination should make you uneasy, and it makes me uneasy.

The follow-up work is thinner than the fame of the finding suggests. There have been replications and extensions, in physical activity and in health behaviours, and they broadly agree about the shape of the curve and about the enormous individual variation. Larger recent analyses of health-habit formation land in a similar region, somewhere around two months as a central tendency with a spread that makes the central tendency nearly useless for any individual.

So the shape is reasonably well supported. The precise number is one median from one modest study, and quoting 66 with confidence is the same error as quoting 21, committed by people who happen to have read one paper more.

There is also a measurement problem worth naming. Automaticity is self-reported, which means the study measures how habitual something *feels*, and feelings about one's own automaticity are exactly the sort of thing people are unreliable about.

## What to do with a number this vague

Stop using elapsed days as your instrument.

Days are the wrong unit because they do not distinguish between someone who did the thing thirty times in thirty days and someone who did it nine times, and those two people are in completely different places despite both being able to say "I'm a month in."

The unit that matters is **repetitions in a consistent context**. That is what the third chapter established and it is what this curve is actually plotting. Twenty repetitions triggered by the same cue in the same place is a different quantity from twenty repetitions scattered across whenever you got round to it, and only the first one is building the association.

Which produces a rule of thumb worth more than either number: consistency of context beats frequency, and frequency beats duration. Doing it four times a week at the same moment will get you there faster than doing it six times a week at whatever moment.

## Why this changes what a bad week means

If you believe in 21 days, then a lapse on day 12 has destroyed something and you have to start again. That belief is doing an enormous amount of damage, and it is the reason people abandon things in week three.

If you believe what the data says, there is nothing to restart. There is a curve, you are somewhere on it, the curve is long and it varies wildly between people, and one missing day does not reset anything because the association is built out of a count that does not go backwards.

That distinction is worth more than any technique in this book.

## This week

Change what you are counting.

Take the behaviour you are working on and stop tracking the date. Instead, keep a running total of repetitions performed in response to the same cue, in the same place. One tally, one line, no calendar.

Then set your expectation deliberately, in writing, before you start. Write down: *this will probably take between one and six months to stop requiring a decision, and I will not be able to tell which end I am at until I am well into it.*

That sentence sounds like a small thing. It is the difference between quitting on day 19 because it should have worked by now, and being unsurprised on day 90.$body$,
       word_count = 1263
  from books b
 where b.id = c.book_id
   and b.slug = 'design-beats-discipline'
   and c.idx = 7;

-- design-beats-discipline | chapter 8 | 1,441 words | 08-the-lapse-is-not-the-problem.md
update chapters c
   set body = $body$You missed Tuesday.

There was a reason. It was a decent reason. And then Wednesday was awkward because of Tuesday, and by Thursday the thing had acquired a small weight of failure that made it slightly unpleasant to look at, and the following Monday was a natural place to start again, and it is now March.

Nobody decided to stop. There was no moment of giving up. There was one missed session and then a fortnight of not quite getting back, and the fortnight is what ended it.

This chapter is about that fortnight, because that is where things actually die. Not at the lapse. In the response to it.

## Marlatt's distinction

Alan Marlatt spent his career on relapse in addiction treatment, and the single most useful thing he produced is a distinction that sounds pedantic and is not.

A **lapse** is one instance. One drink, one missed session, one cigarette.

A **relapse** is a return to the prior pattern.

They are different events, and the first does not cause the second. What connects them is what Marlatt called the **abstinence violation effect**: the reaction the lapse triggers.

Someone who lapses and thinks "that was a hard evening and I had one" tends to carry on. Someone who lapses and thinks "I knew it, I have no self-control, this was always going to happen" tends not to. The second person has taken a single event and read it as evidence about their permanent character, and once the conclusion is *I am the sort of person who cannot do this*, continuing makes no sense. Why would you keep doing something you have just proved you cannot do.

Marlatt's clinical data pointed the same way about *where* lapses happen. They cluster in a small number of recognisable situations: negative emotional states above all, then interpersonal conflict, then social pressure. Not random. Not distributed across the week. Concentrated in circumstances that could have been listed in advance by anyone who thought about it for ten minutes.

## The milkshake

Janet Polivy and Peter Herman demonstrated the mechanism in a laboratory in a way that is hard to argue with.

Participants, some of them dieters and some not, were given a milkshake to drink as part of what they were told was a taste test. Then they were left with bowls of ice cream and told to taste as much as they wanted.

The non-dieters did the sensible thing: having had a large milkshake, they ate less ice cream.

The dieters did the opposite. Having had the milkshake, they ate *more* than dieters who had not been given one, and more than the non-dieters. Their day was already ruined, the rule was already broken, and once broken there was nothing left to protect until tomorrow.

This became known as the what-the-hell effect, and it is not about food. It is about what a rule does when it breaks. A commitment framed as unbroken has a cliff edge in it, and the whole structure is load-bearing on a record that any single Tuesday can destroy.

## What the habit data says about a missed day

Recall the study from the last chapter, the one that tracked automaticity daily for twelve weeks.

The researchers looked specifically at what happened to the curve when somebody missed an opportunity. The answer was: nothing much. A single missed day did not meaningfully alter the trajectory. The curve resumed where it had been.

Put that next to the milkshake and you have the entire problem stated precisely. **The lapse costs you almost nothing mechanically. The story you tell about the lapse costs you everything.** One of those is a fact about repetition and one is a fact about interpretation, and only the second one is under any kind of control.

## Being harder on yourself does not work

The instinct, when you have missed three sessions, is that you have been too soft and what is needed is more severity.

Claire Adams and Mark Leary ran the study that tests this directly. Restrained eaters were given a doughnut to eat. Some then received a brief message, essentially permission not to be harsh with themselves about it, that everyone eats unhealthily sometimes and it is not a reason for self-criticism. Then everyone was given bowls of sweets, ostensibly for a taste test.

The people who had been told not to beat themselves up ate *less* of the sweets than those who had not.

This is the reverse of what most people predict. The worry about self-compassion is always that it licenses the behaviour, that letting yourself off means doing it again. What the study suggests is that the self-criticism was itself driving the second helping, because feeling terrible is a state people reliably want out of, and the sweets were right there.

## Now the part that gets left out

The self-compassion literature is weaker than its popularity implies, and you should discount accordingly.

Much of it is correlational: people who score higher on self-compassion scales also report better outcomes, which is entirely compatible with things going well making people kinder to themselves rather than the other way round. The experimental studies, including the doughnut one, tend to be small, single-session, and conducted on undergraduates. There is a live methodological argument about whether the standard scale measures one thing or two, with the negative items possibly just measuring self-criticism.

And the licensing worry has not been definitively resolved. It is plausible that self-compassion helps after a lapse and hurts before one, and the studies mostly are not designed to separate those.

What survives all that caveating is narrow but solid, and it is enough: **there is no evidence that harshness after a lapse improves subsequent behaviour, and some evidence that it makes it worse.** You are not being disciplined by feeling awful about Tuesday. You are just feeling awful.

## The design answer

Everything in this book so far has said the same thing: do not rely on having the right reaction in the moment, arrange things in advance instead. The lapse is no different.

Which means the response to a missed session should be written down before any session is missed, while you are calm and can see clearly that one Tuesday is not a referendum on your character.

Three components, and they map onto chapter four's coping plans:

**Name the situations.** Marlatt's categories are a good starting list. When are you actually going to miss this? Bad day at work, argument, travel, illness, someone else's plans. Write the three most likely.

**Write the if-then for each.** If I miss the morning session, then I do the ten-minute version that evening. If I am travelling, then the target for that week is two, not four.

**Decide the rule about consecutive misses now.** The most useful one in circulation is simply: never miss twice. It is not a research finding, it is a heuristic, but it is the right shape, because it puts the line in the place where the damage actually occurs. One miss is inside the design. Two starts to be a new pattern.

There is a related point about how targets are written. A goal defined as an unbroken run has a cliff in it and gets abandoned at the first break. A goal defined as a count with slack built in, four out of seven, with two spare days that are yours to spend, has no cliff to fall off. Some research on flexible versus rigid goals finds better persistence with built-in allowances, though the results are not uniform. The logic stands regardless: do not build a structure whose only two states are perfect and finished.

## This week

Write your lapse plan, now, on the day you are reading this, while nothing has gone wrong.

One page. Three likely situations, one if-then for each, and the sentence you will read when it happens.

Make that last sentence specific and true, not encouraging. Something closer to *a missed day does not change the trajectory, and the fortnight after is what decides this* than to *don't be so hard on yourself.*

Put it where you will find it on a bad Tuesday. Not in a document you would have to go looking for, because on a bad Tuesday you will not go looking for it.

Then, when it happens, do the only thing that matters: **do the next one.** Not a make-up session, not a doubled session, not a fresh start on Monday. The next one, at its normal time, as though nothing had happened. That is the entire recovery protocol, and there is nothing else in it.$body$,
       word_count = 1441
  from books b
 where b.id = c.book_id
   and b.slug = 'design-beats-discipline'
   and c.idx = 8;

-- design-beats-discipline | chapter 9 | 1,442 words | 09-identity-and-consistency.md
update chapters c
   set body = $body$Someone offers you a cigarette and you say "no thanks, I don't smoke."

You are not resisting. There is nothing to resist. The offer did not land as an offer, because it was addressed to a person who does not exist, and declining cost you nothing at all.

Now compare that with the same evening a fortnight after quitting, where the same offer produces a small internal negotiation, and the sentence that comes out is "no, I can't, I'm trying to stop." That sentence is doing something quite different. It concedes that you want one, positions the refusal as an external rule, and invites the other person to argue with the rule.

The distance between those two sentences is what this chapter is about. It is also the chapter where I have to be most careful, because the popular version of it is far ahead of the evidence.

## The claim, and why it is attractive

The idea in circulation is that lasting change is identity change: that you should aim not to run but to become a runner, and that every repetition is a vote for the kind of person you are becoming.

It is an appealing idea and it explains something real. People who have kept a behaviour for years genuinely do describe it differently. They do not say they are trying to exercise. They say they train on Tuesdays, in the tone you would use for a fact about your life rather than a project you are managing. Somewhere in there the behaviour stopped being something they do and became something they are.

The question is whether that is a cause or a souvenir.

## What the evidence actually supports

Start with the oldest and firmest piece, which is Daryl Bem's self-perception theory. Bem's argument is that we work out our own attitudes largely the way an observer would, by watching what we do. When internal signals are weak or ambiguous, and they usually are, you look at your behaviour and infer backwards.

This is not a fringe position and it has held up. It also predicts the direction of travel precisely: **behaviour first, identity after.** You do not adopt an identity and then act on it. You accumulate actions and then notice what they add up to.

The related classic is foot-in-the-door. Jonathan Freedman and Scott Fraser found that people who agreed to a trivial request, putting a small sign in a window, were substantially more likely to agree to an absurd one later, a large ugly billboard on the lawn. Meta-analyses since have found the effect is real and modest. The usual explanation is self-perception: having done the small thing, you now think of yourself as the sort of person who does this sort of thing, and the large thing follows from that.

Then there is a small, specific and rather elegant finding on the sentence you use. Vanessa Patrick and Henrik Hagtvedt had people refuse temptations using either "I can't" or "I don't", and those using "I don't" held out longer and were more likely to stick with the goal afterwards. The proposed reason is exactly the difference in the smoking example: "I can't" points at a constraint imposed on you, which invites negotiation, while "I don't" points at a fact about you, which does not.

These are small studies. Treat the sentence finding as a promising detail rather than a law.

## Now the part that gets left out

Most of the identity literature in popular circulation is correlational, and the correlation is unsurprising to the point of being uninformative. People who exercise regularly score highly on exercise identity scales. Of course they do. They exercise regularly. Reading that as evidence that identity produces the exercise is reading the arrow backwards without checking.

The strongest experimental support people cite has also had a hard time. Christopher Bryan and colleagues published a striking set of studies showing that noun framing beat verb framing: asking people to "be a voter" rather than to "vote" raised turnout, and telling children not to "be a cheater" rather than not to "cheat" reduced cheating. It was elegant, it was in a top journal, and it was repeated everywhere.

Alan Gerber, Gregory Huber and colleagues then ran preregistered replications of the voting result with much larger samples and found no effect. The original authors disputed the interpretation, and the argument has not been fully settled. What is clear is that the headline finding is contested, and it should not be quoted the way it usually is.

And there is a genuinely uncomfortable result pointing the other way. Peter Gollwitzer, Paschal Sheeran and colleagues found that when people announced an identity-relevant goal to someone who acknowledged it, they subsequently worked *less* on it than people who kept it to themselves. The proposed mechanism is that the social recognition delivers a premature sense of already being the thing, and the sense of completeness reduces the drive to actually do it.

Which lands directly on the advice to declare a new identity out loud. Announcing that you are now a writer, to an audience who nods, may buy you the feeling of being a writer at the exact moment the feeling is most likely to substitute for the writing.

So: I am not going to tell you to decide you are a runner. The honest reading of the evidence is that this is the weakest-supported chapter in the book, that the direction of causation runs mostly the other way, and that the most confident version of this advice has a specific study suggesting it backfires.

## The version that survives

Here is what I think is defensible, and it is narrower and less exciting than the poster.

**Identity is a lagging indicator worth watching, not a lever to pull.** It tells you something true about how established a behaviour is. It is not the mechanism that establishes it.

**The mechanism is still repetition in a stable context**, which is chapters three through seven. Nothing in this chapter replaces any of that. Identity is what accumulates on top of it.

**Evidence is what changes a self-description, and only evidence.** You cannot argue yourself into a self-concept, and the attempt tends to produce the hollow feeling of saying something you do not believe. What changes it is a pile of instances large enough that the old description becomes obviously false. This is the entire subject of the second book in this series, and it is the same claim from the other direction: confidence is downstream of accumulated proof, not upstream of it.

**But the sentence is free, so use it once the evidence is there.** When you have actually done the thing thirty times, "I don't drink on weeknights" is not a claim you are inflating. It is a description of the last two months, and it is easier to say and harder to argue with than "I'm trying not to."

The failure mode is using that sentence at week one, where it is a wish wearing the grammar of a fact, and where everybody involved including you can hear it.

## Why this matters for the last chapter

You now have the whole toolkit. Contexts, cues, if-thens, friction, bundles, precommitments, a realistic timescale, and a plan for the day it goes wrong.

What you do not have is a way of knowing which of those to use for a particular problem, and that is the only thing left. The next chapter is about assembling them into something specific to you, rather than running all of them at once, which is the most common way this material gets wasted.

## This week

Two small things, and neither one is a declaration.

**First, count.** For the behaviour you have been working on, write down the actual number of times you have done it since you started. Not weeks elapsed. Instances. This is the only thing that gives you the standing to say anything about yourself at all, and most people have never once looked at it.

**Second, change one refusal sentence**, and only if the count supports it. Find the situation where you most often have to decline something, and replace "I can't" with "I don't". Say it out loud once, alone, before you have to use it, because the first time is awkward and you would rather the awkwardness happened in the kitchen than in front of someone.

If the count does not support it yet, do not use the sentence. Go and get the count. That is not a delay, it is the actual work, and the sentence will be waiting when it is true.$body$,
       word_count = 1442
  from books b
 where b.id = c.book_id
   and b.slug = 'design-beats-discipline'
   and c.idx = 9;

-- design-beats-discipline | chapter 10 | 1,596 words | 10-building-your-own-system.md
update chapters c
   set body = $body$You have read nine chapters and you are about to make the classic mistake.

The mistake is to do all of it. Write six if-thens, move four things out of reach, set up two bundles, sign a commitment contract, start a tally, and draft a lapse plan, all on the same Sunday evening, in a state of considerable enthusiasm.

By Thursday most of it will be abandoned, and the abandonment will feel like evidence about you rather than what it is, which is the entirely predictable result of changing nine things at once and having no way to tell which one was working.

Recall the finding from chapter four. Amy Dalton and Stephen Spiller found that planning helps when you are pursuing one goal and can hurt when you are pursuing several, apparently because seeing the full set laid out makes the whole enterprise look unaffordable. This chapter is the last one, so here is the last chance to say it: **the techniques in this book are subtractive, not cumulative.** Pick the one that matches the problem. Leave the rest on the shelf.

## Diagnose before you prescribe

Three questions, in order. They take about four minutes and they will tell you which chapter you actually need.

### One. Is the problem starting, or continuing?

These have different causes and different fixes, and people routinely apply the wrong one.

**Starting** looks like: you meant to, and the moment went past without you noticing it was the moment. Days end and you realise you did not do it and cannot say exactly when you decided not to.

That is a cue problem. Go to chapter four. You need a specific, detectable trigger and a pre-decided response, and the cue has to be an event with an edge, not a period of time.

**Continuing** looks like: you do it, but only when you push, and the pushing is getting expensive. Weeks three and four cost more than week one.

That is not a cue problem and another if-then will not fix it. Go to chapters three and five. Either the context is not stable enough for an association to form, or the alternatives are still too cheap.

### Two. Is the behaviour boring, or aversive?

This is the question people get wrong most often, because admitting the second answer is unpleasant.

**Boring** means you can do it, it is fine, it is just dull. Bundle it, per chapter six. Attach something you want to the tedium and the tedium stops being the obstacle.

**Aversive** means something in it makes you feel stupid, exposed, incompetent or ashamed. The gym where you do not know how the machines work. The email you have been not sending for three weeks. The instrument you are bad at in a flat with thin walls.

A bundle will not touch this, and here is the tell: you will set one up, it will look sensible, and you still will not go. Because the audiobook was never the problem.

For aversive behaviours the move is to shrink the exposure until the feeling is survivable. Go for the ten minutes that only involves the equipment you understand. Write the email badly and send it. The scale is the lever, not the reward, and the goal of the first month is not progress, it is enough repetitions to stop the situation being frightening.

### Three. Is the context stable?

Chapter three said habits are associations between settings and actions. Chapter seven said the count is what builds them.

So if your weeks are not alike, if you travel, work shifts, have small children or have just moved, then you are not going to get a stable association, and hammering at it harder is not going to produce one. Design for it instead. Anchor the cue to something that travels with you rather than to a place. Set the target as a weekly count with slack rather than a daily run. And expect the rebuild after every disruption, because there will be one, and expecting it is the difference between an interruption and an ending.

## The page

Write this on one side of one sheet. Not a document, not an app. A page you can put on a wall.

**The behaviour.** One sentence, in specifics. Not "exercise more". "Twenty minutes on the bike." If you cannot write it as an action a stranger could watch you perform, it is not ready.

**The cue.** The event immediately before it, from chapter three's exercise. An event, not a time of day.

**The if-then.** One. In the exact form: if [event], then I will [small action]. The action should be the first physical step, not the whole session.

**The friction change.** One thing you have moved, in the world, with your hands. Either the obstacle you added to the competing behaviour or the step you removed from this one.

**The count.** A tally, starting at zero, of repetitions in the context. Not dates.

**The lapse plan.** Three likely failure situations, one if-then each, and the sentence you read on a bad day.

Six lines. That is the entire system, and it is deliberately smaller than what you wanted to write.

## What to do when it does not work

It will not work at some point, and the useful skill is reading the failure rather than concluding something about yourself from it.

**If you keep missing the cue**, the cue is wrong. It is probably not a discrete event, or it happens at a moment when you are genuinely unable to act. Pick an earlier one. The cue can be two steps upstream of the behaviour.

**If you notice the cue and do not act**, the first step is too big. "Then I will train" is a debate. "Then I put my shoes on" is not. Shrink it until refusing would be absurd.

**If you act but it never becomes automatic**, look at context stability before anything else. Twenty repetitions in twenty different circumstances is not twenty repetitions.

**If it works for three weeks and then stops**, look at what changed in the environment, because something did. That is what chapter three predicts and it is almost always right. A holiday, a new office, a rearranged kitchen, a broken machine.

**If you cannot make yourself care**, stop. Chapter four was explicit: implementation intentions do nothing without commitment to the goal. This entire book is a set of tools for closing the gap between wanting and doing. It has no view whatsoever on the wanting, and applying it to something you do not actually want is how people spend years failing at goals that were never theirs.

## What this book cannot do

Two honest limits, and they matter more than any technique above.

The first is that everything here assumes the barrier is design. Sometimes it is not. Sometimes the reason you are not doing it is depression, or exhaustion that sleep does not fix, or working two jobs, or grief. Those are not friction problems and calling them friction problems is an insult dressed as help. If moving the trainers next to the door is not the missing piece, and you already know that it is not, then the honest thing is to go and address the actual thing, which may involve a doctor rather than a tally chart.

The second is that the evidence in this book is better than most of what is written about habits and is still not as good as it sounded while you were reading it. The most-cited number came from one study of ninety-odd people. The most famous environment research was retracted. The category-level effect of nudging is disputed in print. The identity material is thin. I have flagged each of those where it came up, and the cumulative version is worth stating plainly: this is a field with real findings and a large volume of confident overstatement built on top of them, and you should hold the specifics loosely.

What survives all of it is the frame, and the frame is the point. **Your consistency is mostly a property of your situation rather than your character.** That claim is supported from several independent directions: the depletion research that failed to replicate, the experience sampling showing that the disciplined face fewer temptations, the popcorn that stopped being eaten when the cinema was removed, the organ donation rates that were set by the direction of a form. Different methods, same conclusion.

Which means the question to ask after a bad week is not what is wrong with me. It is what was different about the week, and what would need to change so that next week does not require me to be a better person than I was this week.

## This week

Write the page. Six lines. Put it where the cue happens.

Then do nothing else from this book for a month.

Not because the rest is worthless, but because with one thing running you will be able to tell whether it is working, and with six you will not. When the tally has thirty marks on it, come back and pick the next one.

If you want the material on why failure feels the way it does, and on what to do with the sentences that show up afterwards, that is the first book in this series. If the thing stopping you is not friction but the belief that you are not the sort of person who could, that is the second, and it is the one to read next.$body$,
       word_count = 1596
  from books b
 where b.id = c.book_id
   and b.slug = 'design-beats-discipline'
   and c.idx = 10;

commit;
