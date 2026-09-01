-- ============================================================================
-- story-you-tell: chapter bodies. GENERATED, do not edit.
--
-- Rebuild: node scripts/build-chapters.mjs
--
-- One book's worth of supabase/08_chapter_bodies.sql, which is the same
-- statements for all three books in one transaction. Run either. These only
-- UPDATE rows that 07_books_all_in_one.sql already created, so they are safe
-- to re-run and safe to run in any order.
--
-- 9 chapter(s), 13,134 words.
-- ============================================================================

begin;

-- story-you-tell | chapter 1 | 1,854 words | 01-the-moment-after-failure.md
update chapters c
   set body = $body$There is a moment, maybe four seconds long, that decides more about how far you get than almost anything else about you.

It is the moment just after something has gone badly. The feedback has landed. The number is worse than you expected. Someone has said the thing you were hoping they would not say. And before you have decided anything, before you have formed a sentence, a story arrives.

For some people the story is *I am not good at this.*

For others it is *I do not know how to do this yet.*

Those two sentences look like a difference of attitude. They are not. They are the beginning of two completely different sets of behaviour, and the behaviour is what compounds. The first sentence makes you want the evidence to go away. The second makes you want more of it. Over ten years that is not a difference in mood; it is a difference in how many hours of useful correction you have absorbed.

This chapter is about that moment. It is also, unavoidably, about the fact that this idea has been oversold to you (probably by a poster in a school corridor) and that the overselling has made a real finding harder to see.

## Praise, and what it does to a nine-year-old

In 1998 Claudia Mueller and Carol Dweck published a set of six studies that remain, twenty-five years later, the cleanest demonstration of the effect.

Children worked on a set of problems and did well. Then they were praised. One group was told they must be smart at this. Another group was told they must have worked hard at this. The praise was one sentence. That was the entire manipulation.

Then the children were given a much harder set. Hard enough that everyone did badly.

The two groups came apart immediately, and they came apart on almost every measure the researchers looked at.

Offered a choice of what to try next, the children praised for intelligence chose easier problems. Ones they knew they could do. The children praised for effort chose harder ones they might learn from. Asked how much they had enjoyed the task, the intelligence group's enjoyment dropped after the failure; the effort group's held up. Given a third set of problems at the original, easier difficulty, the intelligence group now performed *worse than they had at the start*. The effort group performed better.

And then the finding that tends to stop the room. The children were asked to write to a child at another school describing the task, on a sheet that had a space for their scores. Roughly four in ten of the intelligence-praised children misreported. They inflated their scores.

One sentence of praise. Not a childhood of it, not a parenting style. One sentence, delivered by a stranger, minutes earlier. And it produced children who avoided difficulty, enjoyed the work less, performed worse, and lied about it.

The point is not that praise is dangerous. The point is what the praise *installed*: a theory about what the failure meant. If ability is a fixed quantity you possess, then a bad result is information about the quantity, and it is information you would rather not have. Every reasonable thing follows from there. Of course you pick the easier problem. Of course you would rather the score were different.

## The part where the story got out of hand

If the field had stopped there, this would be a simpler book.

Instead, "growth mindset" became one of the most successful exports in the history of psychology. It went into schools, corporate training, sports academies, motivational posters. Somewhere in that journey it stopped being a specific claim about how people interpret failure and became a general theory that believing in yourself makes you capable of anything.

That version does not survive contact with the data, and you should know it.

In 2018 Victoria Sisk and colleagues published two meta-analyses covering hundreds of studies. Two findings mattered. First, the correlation between someone's mindset and their academic achievement was weak. Much weaker than the popular account implies. Second, and more damaging, the average effect of *mindset interventions* on achievement was very small, close to nothing in most samples.

But the same analysis contained a signal. The effects were not evenly spread. They showed up mainly in students who were academically at risk or from lower-income backgrounds. The students for whom the belief that ability is fixed had the most to do, because it was closest to what they were already being told.

That signal was then tested properly. Under David Yeager, the National Study of Learning Mindsets ran a pre-registered randomised trial across a nationally representative sample of US ninth-graders. Around twelve and a half thousand students in sixty-five schools. The intervention was short: two online sessions, under an hour in total.

It worked. It worked modestly, on the order of a tenth of a grade point, and it worked *only for lower-achieving students*, and (this is the part that should have ended the poster industry) it worked only in schools where the surrounding norms actually supported taking on challenge. Where the local culture punished struggle, the belief had nowhere to go.

Brooke Macnamara and Alexander Burgoyne have since published still more sceptical analyses, and the argument continues. I am not going to pretend it is settled.

Here is what I think a fair reading gives you.

**The original phenomenon is real.** How you explain a failure to yourself changes what you do next. That has been replicated in many forms and it is not seriously contested.

**The intervention is weak and conditional.** Telling someone their brain is a muscle, once, does very little on average. It does something for people who currently believe the opposite and who are in an environment that will let them act on the change.

**The popular version is false.** Mindset is not a substitute for teaching, practice, resources, or time. Anyone selling it as one is selling something else.

That third point is not a footnote to this book. It is chapter three, because false growth mindset (the performance of the belief without the behaviour) is now so common that it is probably the more likely failure mode for anyone reading this.

## Why the four seconds still matter

Given all that, why write a book about it?

Because the weak part is the *intervention*, not the *mechanism*. A one-hour online module is a very thin instrument for changing something that a person has been rehearsing since primary school. That it moves the needle at all is arguably the surprise.

And because the mechanism has a physical trace. Jennifer Mangels and colleagues put people in an EEG cap and gave them a hard general-knowledge test with feedback after every answer. First whether you were right, then what the right answer was. Everyone attended to the first signal; being wrong gets your attention regardless of what you believe. The difference was in the second. Participants who held a more incremental view of intelligence showed a stronger neural response to the *corrective* information (the part that tells you the answer) and they did better on a surprise retest of the items they had got wrong.

That is the whole thing, in a lab. Both groups noticed the failure. Only one group stayed in the room for the correction.

You can watch this in yourself, and it is worth doing. When something goes badly, notice how quickly you want to stop looking at it. Notice whether you read the whole piece of feedback or skim to find out how bad it is. Notice whether you go back to the thing you got wrong, or find something you are good at.

Nobody sits at one end of this. You are not a fixed-mindset person or a growth-mindset person; that framing is itself a fixed-mindset framing, and Dweck has spent years trying to walk it back. You are domain-specific and mood-specific and tired-on-Thursday-specific. The useful question is never "which am I." It is "which one showed up just then, and what did it cost me."

## What this does not fix

I want to be blunt about the limits, because the limits are where the popular version does damage.

Believing you can improve does not mean you can improve at the same rate as everyone else, or without instruction, or in the absence of time you do not have. Interpretation is one input among several, and it is not the largest one. A student with a good teacher and a fixed view of ability will out-learn a student with a growth view and no teacher, every time.

What interpretation controls is narrow but strategically placed: it controls whether you stay in contact with the information that would have made you better. That is why it compounds. It is not that the belief makes you learn faster. It is that the belief determines how many opportunities to learn you decline.

If you decline enough of them, you will eventually be right about yourself. That is the trap, and it closes slowly enough that it feels like evidence.

## Where this book goes

Chapter two is the actual research on fixed and growth theories, including what the replications showed, in more detail than most summaries will give you.

Chapter three is false growth mindset (the language without the behaviour, which is now the dominant failure) and how to tell whether you are doing it.

Chapters four and five are attribution and learned helplessness: *why* you think you failed, whether you locate the cause in something stable or something changeable, and Martin Seligman's work on what happens when an animal or a person concludes that outcomes are not connected to their actions.

Chapters six and seven are about stress. There is good evidence that whether you read your own physiological arousal as threat or as readiness changes both your performance and your cardiovascular response, and that reappraisal is trainable. This is one of the better-supported findings in the area and it is oddly under-used.

Chapter eight is practice and its ceiling, which is where I will disappoint anyone hoping for ten thousand hours.

Chapter nine is what to do on Monday.

## One thing to do this week

Write down the last three things you gave up on. Not big ones necessarily. A language app, a side project, a sport.

For each, write one sentence explaining why you stopped. Write it fast, in whatever words come first. Do not tidy it up.

Now look at the sentences and ask one question of each: **is the cause you named something about you, or something about the situation?**

"I'm not a numbers person" is about you. "I was doing it at eleven at night after work" is about the situation. Both can be true. But you will almost certainly find that you reach for one kind far more than the other, and that you do it without noticing, and that you do it fastest for the things that matter most to you.

That reflex is what the next eight chapters are for.$body$,
       word_count = 1854
  from books b
 where b.id = c.book_id
   and b.slug = 'story-you-tell'
   and c.idx = 1;

-- story-you-tell | chapter 2 | 1,291 words | 02-fixed-and-growth-and-the-replications.md
update chapters c
   set body = $body$The last chapter ended on a claim that ought to make you suspicious, because you have heard it before in a much worse form. So this chapter is the audit. What was the theory, what has been tested, what came out, and what is left standing.

I am going to be harder on this literature than most books about it are. If what remains still looks useful afterwards, that is worth more than a chapter of enthusiasm.

## The theory, stated precisely

Carol Dweck's proposal is about implicit theories: beliefs people hold, usually without articulating them, about whether a quality is fixed or developable. Applied to intelligence, an **entity theory** treats ability as a set amount you have; an **incremental theory** treats it as something that grows with work.

The claim is not that believing you can improve makes you improve. It is narrower and more mechanical. The belief determines what a setback *means*, and the meaning determines what you do next.

If ability is fixed, a difficulty is a measurement. It tells you the size of your allocation, and there is no good outcome from pursuing that information, so the rational move is to withdraw, avoid the harder task, and protect the estimate.

If ability is developable, the same difficulty is a location. It tells you where the edge currently is, which is the one piece of information you need in order to move it.

Both are coherent responses to the same event. The difference is in what happens over the following months, because one of them keeps you in contact with the material that would have taught you something and the other does not.

Lisa Blackwell, Kali Trzesniewski and Dweck followed students across the transition to junior high, a point where the work gets harder and grades typically dip. Students holding an incremental theory showed an upward maths trajectory over two years; students holding an entity theory flattened. In a second study, an intervention teaching the incremental view arrested a declining trajectory relative to a control group that received equally engaging study-skills material.

That is a good study. It is also from 2007, on modest samples, by the theory's own authors. What happened next is the part that matters.

## What the replications showed

**Sisk and colleagues, 2018.** A pair of meta-analyses. The first asked whether holding a growth mindset correlates with achievement: the average correlation was weak. The second asked whether mindset interventions improve achievement: the average effect was very small, and small enough that if you had been promised transformation you should feel misled.

But the same analysis found the effects were not spread evenly. They concentrated in students who were academically at risk and students from lower-income backgrounds. For high-achieving students in well-resourced settings, close to nothing. That pattern recurs everywhere in this literature and it is not a footnote; it is arguably the finding.

**Yeager and colleagues, 2019.** The National Study of Learning Mindsets, and the study that should be the reference point for anyone arguing about this. Pre-registered, nationally representative sample of US high schools, over twelve thousand students, a short online intervention of under an hour delivered in two sessions, with independent data handling.

Result: about a tenth of a grade point for lower-achieving students. Nothing detectable for higher-achieving students. And a moderator that ought to have ended the poster industry on its own: the effect appeared only in schools where the surrounding peer norms supported taking on challenging work. Where the local culture treated visible struggle as a signal of inadequacy, the belief had nowhere to go.

**Macnamara and Burgoyne, 2023.** A further meta-analysis applying corrections for publication bias and restricting to higher-quality designs, reporting effects near zero. There has been vigorous disagreement about the inclusion criteria and about how to handle the moderators, which is normal and unresolved.

**Foliano and colleagues, 2019.** A UK randomised trial of a mindset intervention in primary schools, run by an independent evaluator. Null.

## The honest summary

Take all of that together and I think the defensible position is this.

**As a school intervention delivered as a short online module to everybody, growth mindset is weak.** The average effect across a general population is somewhere between very small and zero. Anyone who told you it transforms outcomes was overclaiming, and the overclaiming did real damage, because it produced a decade of posters and assemblies and a widespread belief among teachers that the job was done.

**As a description of how people respond to setbacks, the mechanism is in better shape than the intervention.** The attribution literature it sits inside is old and robust. Bernard Weiner's work on how people explain outcomes, and Martin Seligman's on explanatory style, predate Dweck and point the same way: what you conclude about the cause of a failure predicts what you do afterwards.

**There is a physical trace, which is a point in the mechanism's favour.** Jennifer Mangels and colleagues put participants in an EEG cap during a hard general-knowledge test with two-part feedback after each answer: first whether they were right, then what the correct answer was. Everyone's brain responded to the first part, because being told you are wrong gets attention regardless of what you believe about ability. The difference appeared in the second part. Participants holding a more incremental view showed a stronger response to the *corrective* information, and they subsequently did better on a surprise retest of exactly the items they had got wrong.

That is a mechanism you can point at. Whether you stay attentive through the part that tells you the answer.

**The moderation is the actual finding, and it is being ignored.** Every good study says the same thing: this matters most for people who are struggling, and it only works where the environment permits the behaviour it licenses. Telling a student that ability is developable, in a school where struggling publicly is punished, gives them a belief with no available action attached to it.

## Why this book exists anyway

Given all that, why write about it.

Because the weakness is in the *delivery*, not in the *idea*. An hour of online material is an extraordinarily thin instrument for changing something a person has been rehearsing since they were six. That it moves anything at all is arguably the surprising result.

Because the population where it works is the population reading this. Not high-achieving students coasting through a supportive school. People who have hit something hard, concluded something about themselves, and withdrawn.

And because the environmental moderator, which is fatal for the school poster, is exactly what a small group of people is for. The intervention that failed was a belief handed to someone in a setting that contradicted it. A group of four people who all know that difficulty is information, who meet weekly, and who will ask you what actually happened, is not a poster. It is the supportive norm the studies say is required.

I would rather sell you a modest, well-bounded, correctly-scoped claim than a large one you will discard in six months.

## This week

Catch the sentence.

The next time something goes badly, and it will, notice the sentence that arrives immediately afterwards. Not the considered view you would give if someone asked. The first one, the one that shows up before you have decided anything.

Write it down verbatim. Do not improve it, do not soften it, do not add the reasonable qualification you would add in company.

Do that for a week. Most people find three or four sentences doing all the work, in the same words, arriving in the same situations. You cannot change a sentence you have never read. The next chapter is about what to do once you have the list.$body$,
       word_count = 1291
  from books b
 where b.id = c.book_id
   and b.slug = 'story-you-tell'
   and c.idx = 2;

-- story-you-tell | chapter 3 | 1,345 words | 03-false-growth-mindset.md
update chapters c
   set body = $body$There is a version of this idea that spread much faster than the research did, and it is worse than useless. Carol Dweck has spent the past decade trying to disown it, with limited success, and it is worth understanding because if you adopt it you will get none of the benefit and you will conclude, reasonably, that the whole thing was empty.

She calls it false growth mindset. It has four common forms.

## Form one: it becomes a synonym for being nice

The most widespread failure. Growth mindset gets absorbed into a general vocabulary of encouragement and comes to mean, roughly, being positive, being supportive, believing in people.

The theory is not about that. It is a claim about what a difficulty means and what you do next. It is compatible with being extremely demanding. In fact its practical implication is that you should give people harder work and more accurate feedback, because the entire mechanism is about staying in contact with information you would otherwise avoid.

You can tell this failure has happened when the language shows up but nothing about the work changes. Same tasks, same feedback, new posters.

## Form two: praising effort regardless of what happened

This is the one that comes directly from a misreading of the original studies, and it does damage.

The finding from the praise research is not that effort is good and ability is bad as a topic of praise. It is that praising a fixed attribute after a success sets up a specific trap: the child now has a reputation to protect, and the way to protect it is to avoid anything hard enough to threaten it. Praising the process worked better because it pointed at something the child controls and can repeat.

What that does not license is telling someone they worked hard when they did not, or when they did and it went nowhere.

Effort praise applied to a failed attempt with no change of approach communicates something quite specific, and it is not encouraging. Aneeta Rattan, Catherine Good and Dweck found that when teachers responded to a student's poor maths performance with comfort about ability, students inferred that the teacher had low expectations of them and reported lower motivation. Kindness about a bad outcome reads as a verdict.

The corrected version: praise or discuss the **strategy**, not the exertion. What did you try. What did you do when the first approach did not work. What would you try next. Effort in the absence of strategy is just repetition of something that is not working, and treating it as praiseworthy teaches people to grind rather than to think.

## Form three: claiming it as an identity

"I have a growth mindset."

Almost nobody holds one consistently. Dweck's own position, stated repeatedly, is that everyone is a mixture, that the mixture is domain-specific, and that it shifts under pressure. You may hold a thoroughly incremental view about your work and a rigidly fixed one about your body, your maths ability, or your capacity to be liked. Most people can find at least one domain where they hold a hard entity theory and have never noticed, because they have arranged their life so as never to test it.

Declaring the identity ends the enquiry. The useful question is never whether you have it. It is: in this specific area, right now, what do I currently believe about whether this can change, and what have I stopped attempting as a result.

The areas where you have stopped attempting things are where the fixed belief is, and they are precisely the areas you will not think of when asked.

## Form four: the belief without the environment

This is the most consequential, and it is where the research has been clearest and the practice worst.

The Yeager study found that the intervention only worked in schools whose norms supported taking on challenging work. Where the surrounding culture punished visible struggle, the belief had no effect. You can teach someone that difficulty is information, but if every signal in their environment says that struggling in public is evidence of not being good enough, they will not act on it, and they are not wrong to hesitate.

Elizabeth Canning, Yeager, Dweck and colleagues looked at the other side of this. Across STEM courses at a large university, they measured faculty members' own beliefs about whether ability is fixed. Courses taught by faculty holding more fixed beliefs showed larger racial achievement gaps and lower student motivation than courses taught by faculty holding more incremental beliefs. The students' own mindsets were not what was being manipulated. The instructor's belief was doing the work, presumably through a thousand small decisions about how much difficulty to expect and how to respond to it.

This is why an individual mindset intervention delivered into an unchanged environment is such a thin instrument, and it is the strongest argument in this book for doing any of this with other people rather than alone. The belief needs somewhere to be practised. A person who tells you what they actually attempted this week, including the parts that failed, in front of people who will not treat that as a confession, is running the environment the research says is necessary.

## What about real limits

I want to deal with the objection honestly, because the false version of this idea invites it.

Constraints are real. People differ, in ways that are partly heritable, in how quickly they pick things up. Time, money, health, obligations and circumstances all bound what is available. Nothing in this literature says otherwise, and the popular version that suggests anyone can become anything is both false and cruel, because it makes every limit a personal failure.

The claim is smaller and it survives all of that. Whatever your actual ceiling in some domain is, you are almost certainly not near it, and the reason is rarely the ceiling. It is that you concluded something after a bad experience and stopped generating attempts. The belief does not raise the ceiling. It determines whether you keep going long enough to find out where it is.

Consider what "I am not a numbers person" is actually reporting. Not a measurement of your capacity. A record of when you stopped.

## How to tell which one you are running

The clean diagnostic is not what you say about ability. It is what you do in the week after something goes badly.

Fixed, in practice, looks like: you avoid the same situation, you stop asking about it, you find a reason the task was unreasonable, you move to something you are already good at, and you do not go back and look at what you got wrong.

Incremental, in practice, looks like: you go back and look at what you got wrong, specifically, in detail, soon. You change one thing about the approach. You attempt it again while it still stings.

Notice that neither description mentions how you feel. Both of these are compatible with feeling terrible. The incremental version is not a cheerful version; it is frequently worse in the short run, because it involves staying in contact with evidence of your own inadequacy for longer than is comfortable. What it buys is that the evidence gets used.

## This week

Take the list of sentences you collected last week and pick the one that recurred most.

For that one, answer two questions on paper.

First: what have I stopped attempting because of this. Be concrete. Name the specific thing you no longer try, the conversation you do not have, the kind of work you do not put yourself forward for.

Second: what is the smallest attempt that would generate real information about whether the sentence is true.

Then do the second one before the week is out, and go back and look at how it went, in detail, while it is still uncomfortable.

That is the whole practice. Not believing something different. Staying in the room with the result for long enough to learn from it.$body$,
       word_count = 1345
  from books b
 where b.id = c.book_id
   and b.slug = 'story-you-tell'
   and c.idx = 3;

-- story-you-tell | chapter 4 | 1,406 words | 04-why-you-think-you-failed.md
update chapters c
   set body = $body$At the end of chapter one you wrote three sentences explaining why you stopped doing three things.

Go and get them. This chapter is about their internal structure, and there is more information in those sentences than you put there deliberately.

## Weiner's three dimensions

Bernard Weiner spent decades on a question that sounds too simple to be productive: when something goes wrong, what do people decide caused it, and does the answer predict anything?

It does, and the useful part is that the content of the explanation matters less than its shape. Weiner found three dimensions that organise almost any account anybody gives.

**Locus.** Is the cause in me or outside me? *I am not clever enough* against *the exam was unreasonable*.

**Stability.** Will this cause still be there next time? *I have no aptitude for this* against *I was exhausted that week*.

**Controllability.** Could I do anything about it? *I did not prepare* against *the trains were cancelled*.

Take an explanation, place it on those three axes, and you can predict a surprising amount about what the person does next, how they feel about it, and whether they try again.

The dimension that does most of the work is not the one people expect.

## Stability is the load-bearing one

The popular version of this material says the trouble is blaming yourself, and the remedy is to stop taking things personally.

That is not what the research says, and following it produces someone who never learns anything, because if the cause is always external there is never anything to change.

The dimension that predicts giving up is **stability**. A cause that will still be there next time makes the next attempt pointless. A cause that has changed makes it worth another go. And this is largely independent of where you locate the cause.

Consider four explanations for the same failed attempt at learning an instrument.

*I have no musical ability.* Internal, stable, uncontrollable. Nothing follows from this except stopping, and stopping is the rational response, because you have just concluded the outcome is fixed.

*I did not practise.* Internal, unstable, controllable. Uncomfortable, and it is the one that leaves the door open.

*The teacher was hopeless.* External, unstable, partly controllable. This one is fine, and may well be true. It points at a different teacher.

*Nobody in my family is musical.* External-ish, extremely stable. As inert as the first one, and it feels more objective, which makes it more dangerous.

The first and fourth end the enquiry. The second and third continue it. Notice that they do not split along the internal-external line at all.

This is also where the mindset material from chapter two actually sits. "I am not a maths person" is not primarily a statement about ability. It is a stable attribution, and its effect comes from the stability, not from the humility.

## Seligman's explanatory style

Martin Seligman arrived at a compatible framework from the direction of depression, and his three dimensions are worth having alongside Weiner's because they name a different failure.

**Personal**: is it me. **Permanent**: is it always. **Pervasive**: is it everything.

Permanent is Weiner's stability again, and Seligman's data agrees it matters. The addition is **pervasive**, which is about how far the explanation spreads.

*I was bad at that presentation* is bounded. *I am bad at communicating* has left the room and taken your whole professional life with it. *I am bad at everything* has left the building.

Seligman's longitudinal work found that a pessimistic explanatory style, one that reads bad events as personal, permanent and pervasive, predicted later depressive symptoms and, in several studies, poorer performance in domains from insurance sales to competitive swimming.

The spreading is what makes one bad afternoon into a bad month. It is also the easiest thing to catch in your own sentences, because the tell is a grammatical one: the explanation stops being about an event and starts being about a category.

## Now the part that gets left out

Three caveats, and the third is the one I would want if I were reading this.

**Much of it is correlational.** People who explain things pessimistically also do worse later. That is compatible with the explanations causing the outcomes, and equally compatible with a life that is going badly producing accurate pessimistic explanations. The experimental work, mostly attributional retraining, is more informative but smaller.

**Attributional retraining works, modestly, and mostly for one group.** Studies giving struggling students a reattribution intervention, typically reframing early difficulty as normal and temporary rather than as evidence of unsuitability, find real effects on persistence and grades. Raymond Perry's programme of work with university students is the most sustained. The effects are moderate, and they are consistently larger for students who were struggling, which is exactly the moderation chapter two found for mindset. For students already doing well, close to nothing.

**And sometimes the stable attribution is correct.** This is the caveat that self-help writing never makes, and refusing to make it is why people stop trusting the genre.

Some things you will not be good at. Some causes really are permanent: a physical limit, a market that does not exist, a field that requires something you do not have and cannot acquire in the time available. Reattributing your way through those is not resilience, it is a slow expensive way of not noticing.

The claim in the research is not that stable attributions are always wrong. It is that people make them **too fast, from too little evidence, and disproportionately for the things they care most about.** One bad exam is not a sample from which the stability of your mathematical ability can be estimated. Neither is one failed business, or three months of an instrument.

So the correction is not optimism. It is sample size.

## The asymmetry that keeps this hidden

Here is why the reflex is so hard to see in yourself.

People generally explain their *successes* with unstable, situational causes and their *failures* with stable, dispositional ones, and they do it most strongly in the domains that matter to them most. The good grade was an easy paper. The bad grade was you.

Which means your internal record is being written by a process that systematically converts good outcomes into luck and bad outcomes into character. Run that for twenty years and you will have a confident, detailed, evidence-rich account of your own limitations, assembled entirely out of bad Tuesdays, and you will experience it as realism.

The sister book on confidence attacks this from the other end, with a written record that the reflex cannot get at. This book attacks it here, at the moment the sentence is formed.

## What the useful version sounds like

An explanation you can work with has three properties.

**It is specific enough to act on.** "I was disorganised" is not actionable. "I did not start until the night before" is.

**It names something that has changed or could change.** Not because change is comforting, but because a cause that cannot change gives you nothing to do.

**It stays the size of the event.** One afternoon explains one afternoon.

And the test that catches most bad explanations in one move: **could a stranger check it?** "I have no aptitude" cannot be checked by anyone. "I attempted this four times over six weeks, always in the evening, always tired" can be, and it contains an obvious next experiment.

## This week

Take your three sentences.

Mark each one on Weiner's three axes. Internal or external, stable or unstable, controllable or not. Just the labels, no analysis.

Then, for any sentence you marked stable, do this: **write down the evidence you actually have for the stability.** Not for the failure, that happened. For the claim that the cause is permanent.

Number of attempts. Over what period. Under what conditions. With what instruction or help.

Most people discover the permanent verdict rests on two or three attempts, all made under conditions nobody would design on purpose, several years ago. That is not enough evidence to close a question, and you would not accept it about anybody else.

You do not have to overturn the conclusion. Just downgrade it from a finding to a hypothesis, and write beside it the one attempt that would actually test it.

The next chapter is about what happens when that reflex runs long enough that you stop making attempts at all.$body$,
       word_count = 1406
  from books b
 where b.id = c.book_id
   and b.slug = 'story-you-tell'
   and c.idx = 4;

-- story-you-tell | chapter 5 | 1,536 words | 05-learned-helplessness-and-its-reverse.md
update chapters c
   set body = $body$There was a place where nothing you did made any difference.

A job where the decisions were made elsewhere and the reasons were never given. A house where the mood of the evening was set by someone else and could not be predicted from anything you did. A system, an institution, a relationship, where you tried several reasonable things, and the outcomes arrived unconnected to any of them.

You adapted, correctly, by stopping. Trying costs something, and when trying and not trying produce the same distribution of outcomes, not trying is the better strategy.

The problem is what happened next, which is that you left, and took the adaptation with you into a situation where effort would in fact have worked.

## The experiment everybody half-remembers

Martin Seligman and Steven Maier ran it in 1967, and the design is the thing to hold on to, because the design is what makes the conclusion possible.

Three groups. The first received electric shocks they could stop by pressing a panel. The second received exactly the same shocks, delivered at the same times and for the same durations, but could do nothing about them. The pairing is the whole point: the two groups got identical physical experience and differed only in whether their actions mattered. The third group got no shocks.

Later, all three were placed in a box where a shock could be escaped simply by stepping over a low barrier.

The first and third groups learned to step over almost immediately. The second group largely did not. Many lay down and took it, without attempting the barrier that was right there.

The interpretation, which became one of the most cited ideas in psychology, was that the second group had *learned* that their actions did not matter, and had generalised it to a new situation where it was false.

## Fifty years later the authors said they had it backwards

This is the part that is not in the textbooks yet, and it is the reason this chapter exists.

In 2016 Maier and Seligman published a reassessment of their own theory in light of what neuroscience had established in the intervening decades. Their conclusion was that the original account had the mechanism inverted.

Passivity in the face of prolonged aversive experience is not learned. It is the **default**. It is what the mammalian brain does automatically when something bad goes on for a while, mediated by activity in the dorsal raphe nucleus, and it requires no learning whatsoever.

What is learned is the opposite. When an animal detects that its actions control the outcome, a region of the prefrontal cortex is engaged, and that region inhibits the automatic passivity response. The animals in the escapable group were not spared a lesson in helplessness. They were given a lesson in **control**, and it was that lesson which protected them later.

So the finding is not that adversity teaches you to give up. It is that giving up is what happens by default, and the thing that has to be actively acquired, and can be, is the detection of control.

I want to be clear about why this is in a book that keeps promising to tell you where the evidence is thin. This is not a critic attacking a famous study. This is the two original authors, on the fiftieth anniversary, saying that the interpretation they made famous was wrong about the mechanism. That is what a healthy field looks like, and it is rarer than it should be.

## Why the correction changes what you should do

If helplessness is learned, the task is to unlearn it, and the natural approach is to argue with the belief.

If passivity is the default and control is what gets learned, then arguing with the belief is beside the point, and the task is to **arrange experiences of contingency**, in which your action visibly produces an outcome, and to have enough of them that the detection system has something to detect.

There is a further result that makes this more than a rephrasing. In the animal work, experience of control *before* the uncontrollable episode was protective, and the protection was durable. Prior experience of your actions mattering appears to inoculate against later stretches where they do not.

Which suggests something about the order of operations after a bad period. You do not repair this by returning to the domain that damaged you and trying harder there, where the feedback is slow and contaminated and you have a long record of nothing working. You repair it wherever contingency is cheapest to demonstrate, and the domain does not have to be the important one.

## Humans, and the necessary caveats

Donald Hiroto and Seligman ran the human analogue with unpleasant noise instead of shock and a shuttle-box analogue afterwards, and found broadly the same pattern.

Four caveats, and you should apply all of them.

**The human laboratory work is 1970s social psychology**, with small samples and the methodological habits of the period. Treat it as suggestive.

**Not everybody became helpless.** A substantial minority in the human studies never showed the effect at all, and explaining that variation is what drove Seligman towards explanatory style, which is chapter four's material. What you conclude about the cause mediates a great deal.

**The extension from a laboratory to a life is long.** Applying this to poverty, to unemployment, to chronic illness is plausible and it is an inference, not a measurement. Be suspicious of anyone who describes a person's whole situation with this phrase.

**And the label gets used as an accusation.** This is the one that matters. "Learned helplessness" is regularly deployed to explain why people in bad structural circumstances do not act, in a way that relocates a political problem inside an individual's psychology.

If your outcomes genuinely are not contingent on your actions, then perceiving that accurately is not a distortion, it is perception. The dogs in the second group were right about their box. They were wrong only about the next one. The distinction between an accurate reading of a situation you are in and an inaccurate one carried forward into a situation you have left is the entire content of this chapter, and collapsing it is how the concept gets abused.

## The reverse, practically

Three things follow, and the second is the one people miss.

**One. Contingency has to be perceptible, not just present.** Many situations where you feel you have no influence are ones where you do, and the feedback arrives too slowly, too noisily, or too far downstream to be detected. Six months of work and a single yes or no at the end is, informationally, close to an uncontrollable box, even though it is not one.

So the first move is often not to gain control but to shorten the loop until existing control becomes visible. This is the same argument the design book makes about counting repetitions instead of days, and it is the same problem.

**Two. Start where it is undeniable.** Pick something where the connection between what you do and what happens is immediate, unambiguous and unmediated by anyone else's judgement. Cooking something and it works. Fixing something. Running a distance and the distance being run. Learning a piece of music to the point where it is playable.

This looks like avoiding the real issue and it is not. You are not trying to solve the important problem. You are re-establishing a detection system that has been given nothing to detect, and the system does not care which domain supplies the evidence.

**Three. There is a clinical version of this and it has good support.** Behavioural activation, the treatment approach that gets people to schedule and perform activities rather than working on their thoughts first, has held up well in trials, including a dismantling study by Neil Jacobson and colleagues where it performed comparably to full cognitive therapy on its own. It is, in effect, this chapter administered systematically.

If what you are reading here is describing your life rather than a bad year, that is the thing to go and ask about by name.

## This week

One domain, seven days, short loop.

Choose something where your action produces a visible result within an hour, where nobody else's opinion sits between the two, and where you can do it daily. It should be small and it is allowed to be trivial.

Then keep a two-column log. **What I did. What happened.** Nothing else, no reflection, no evaluation.

At the end of the week, read the two columns together. What you are looking for is not achievement. It is the correspondence between the columns, which is the thing you are currently unable to perceive in the domain that matters, and which you have to see somewhere before you will see it there.

Then, and only then, take the important domain and ask the shortening question: where in this could I get a real signal in a day instead of in six months.

Chapters six and seven are about what your body does while all of this is going on, and why the sensation you have been reading as a warning is frequently a preparation.$body$,
       word_count = 1536
  from books b
 where b.id = c.book_id
   and b.slug = 'story-you-tell'
   and c.idx = 5;

-- story-you-tell | chapter 6 | 1,489 words | 06-stress-as-a-signal-not-a-threat.md
update chapters c
   set body = $body$You have been told, repeatedly and from several directions, that stress is bad for you.

That it accumulates. That it does something to your heart and your immune system and probably your telomeres. That you should be managing it, reducing it, and that the amount you are currently carrying is a problem in itself.

So now, on top of the deadline, you have a second thing, which is a low background concern about what the deadline is doing to you.

There is a reasonable body of evidence that this second layer is worse than the first one.

## The mortality finding

Abiola Keller and colleagues used a large national health survey, around twenty-eight thousand American adults, which had asked two separate questions: how much stress people had experienced in the past year, and how much they believed that stress had affected their health. Death records were then linked over the following eight years.

High stress alone did not predict premature death.

High stress *combined with the belief that stress was harming their health* was associated with a substantially raised risk, in the region of forty per cent.

People reporting a lot of stress who did not believe it was damaging them had mortality no worse than people reporting little stress. Same reported load, different belief about it, different survival curve.

## Now the part that gets left out, immediately

That is an observational study and it cannot establish causation, and I am putting the caveat here rather than at the end because the finding is exactly the kind that gets repeated as though it were a trial.

The belief was measured once, with one item. People who believe stress is damaging their health may be doing so because they can feel it damaging their health, which would make the belief a symptom rather than a cause. The statistical adjustments were reasonable but no adjustment can rule that out.

So hold it as striking and suggestive, not as demonstrated. What makes it worth taking seriously is that experimental work points the same way.

## Crum's mindset studies

Alia Crum, Peter Salovey and Shawn Achor developed a measure of what they called stress mindset: the extent to which someone believes stress is enhancing rather than debilitating. Not how much stress you have. What you think it is for.

They then manipulated it, in employees at a large financial firm during a difficult period, using short films: one set presenting stress as debilitating, with the standard imagery about health damage, the other presenting it as enhancing, with material about how arousal improves focus and how demanding periods produce growth.

The films were three minutes long, shown a few times over a week.

The group shown the enhancing films reported better psychological symptoms and work performance afterwards, and showed a different cortisol response to a subsequent challenge. In later work with Modupe Akinola and colleagues, people with a stress-is-enhancing mindset showed more adaptive cardiovascular responses under an acute laboratory stressor, and greater cognitive flexibility, along with more willingness to seek out feedback about their performance.

That last one is not a physiological outcome and may be the most consequential. If you believe stress is damaging you, feedback about a difficult situation is more stress and you avoid it. If you believe it is preparing you, feedback is information. Over a year those two people end up in very different places for reasons that have nothing to do with cortisol.

## What the stress response is actually for

The framing that makes this feel less like positive thinking is to ask what the response is doing.

The acute stress response mobilises glucose, raises cardiac output, sharpens attention onto the immediate situation and, on Firdaus Dhabhar's work, actually enhances certain immune functions in the short term, redistributing immune cells to places where injury is plausible. It is a preparation for a demanding episode. It is not a malfunction, and it is not damage occurring.

Shelley Taylor's work adds a piece that the fight-or-flight account leaves out: the stress response also raises prosocial motivation, the impulse to seek out and give support. Taylor called it tend-and-befriend. Which means the urge to call someone when things are difficult is not a weakness in the system, it is part of the system.

And there is the challenge-versus-threat distinction, which the sister book on confidence goes into as a day-of tactic. The short version: two physiological patterns, similar subjective arousal, different peripheral responses, different performance. Whether you get one or the other depends substantially on whether you appraise your resources as adequate to the demand.

Put those together and the sensation you are having before a difficult meeting is not a warning that something is going wrong. It is what preparation feels like. Fear and readiness are not distinguishable from the inside, because at the level of the sensation they are largely the same event.

## The distinction this chapter must not blur

Everything above is about **acute** stress: episodes, with beginnings and ends, in situations where you have some influence.

**Chronic, uncontrollable stress is a different thing and it is genuinely damaging.** Bruce McEwen's work on allostatic load is the standard reference: a system built to spike and recover, kept elevated indefinitely, produces cumulative wear across cardiovascular, metabolic and immune function. Dhabhar's own finding on immune enhancement reverses under chronic stress, where the effect is suppressive.

This is not a caveat, it is half the subject, and the popular version of the mindset research routinely omits it.

Telling somebody working two jobs with an insecure tenancy and a sick parent that stress is enhancing is not a reframe. It is the same error the last chapter identified, taking a structural problem and relocating it inside a person's beliefs. The Keller finding is about people's interpretation of an ordinary stressful year. It is not a claim that the physiological consequences of sustained hardship are optional if you think about them correctly.

The honest boundary: **this material applies to demanding episodes you have some influence over.** For sustained, uncontrollable pressure, the intervention is the situation, and where the situation genuinely cannot be changed, the relevant chapter is the previous one.

## More caveats, briefly

Crum's studies are moderate in size and come from a small number of laboratories. Several of the physiological results are crossover interactions, where the intervention moved people in opposite directions depending on where they started, and interactions of that shape are easy to over-read and hard to replicate.

The three-minute-film result in particular sounds too cheap to be true, and results that sound too cheap to be true have a poor record over the last decade.

What I would defend: the direction is consistent across observational, experimental and physiological measures from different groups, the mechanism is plausible, and the intervention costs nothing and has no obvious downside. That is a reasonable basis for changing what you tell yourself, and not a reasonable basis for a confident number.

## Why this belongs in this book

Every chapter here has been about a sentence you say after something happens. This one is about a sentence you say *during*.

Chapter four established that the explanation you reach for predicts what you do next. Stress is the same structure, one level down. The sensation arrives, uninterpreted and ambiguous, and you attach a meaning to it within about a second, and the meaning determines whether the next hour is spent working or spent monitoring yourself.

"I am anxious, which means I am not ready" and "I am activated, which means my body is doing its job" are attributions about identical data.

## This week

Two things, and the first one takes five minutes.

**Write down what you actually believe about stress.** Not what you think you should believe. Finish these sentences honestly: *Stress is basically...* and *When I feel stressed, it means...*

Most people find something quite bleak comes out, and find they have never once examined it, and that it arrived from somewhere else entirely.

**Then take one recurring stressor and write the alternative reading.** Pick something that happens weekly. The Monday meeting, the school run, the call with the difficult client.

Write two sentences: what the sensation currently means to you, and what else it could accurately mean. It has to be *accurate*, not encouraging. "This is my body allocating resources to something I care about" is accurate. "This is going to be great" is not, and you will not believe it.

Then use it in the moment, out loud if you are alone, for the next four occurrences. Four, not one, because the first time you will hear yourself saying it and feel silly, and the silliness is not evidence about whether it works.

The next chapter is about whether this kind of reinterpretation is a knack some people have or a skill that can be trained, and about the specific situations where doing it is a mistake.$body$,
       word_count = 1489
  from books b
 where b.id = c.book_id
   and b.slug = 'story-you-tell'
   and c.idx = 6;

-- story-you-tell | chapter 7 | 1,487 words | 07-reappraisal-as-a-trainable-skill.md
update chapters c
   set body = $body$You tried it. It worked twice.

The third time, on a Wednesday that had already gone wrong, you said the sentence about your body doing its job and heard yourself say it and it landed like a line from a leaflet. Nothing shifted. And the conclusion you drew, within about a second, was that this stuff works for other people.

That conclusion is the thing to examine, because there is a version of it that is correct and a version that is not, and telling them apart is what this chapter is for.

## Reappraisal is fourth on the list, not first

James Gross's process model organises emotion regulation by *when* you intervene, and the ordering matters more than any individual technique.

**One: situation selection.** Choose which situations you enter at all.

**Two: situation modification.** Change something about the situation once you are in it.

**Three: attentional deployment.** Change what you are attending to within it.

**Four: cognitive change.** Change what the situation means. This is reappraisal.

**Five: response modulation.** Act on the response itself, after it has occurred. Suppression lives here.

Almost everyone reaches straight for four. It is the one that gets written about, it is the one that sounds like wisdom, and it is the most effortful and least reliable of the first four.

The earlier interventions are cheaper because they act before the emotional response has been generated, rather than trying to modify it once it is running. If a recurring meeting reliably ruins your afternoon, the sequence to consider is: does this meeting need to exist, can its format change, can I sit somewhere different and take notes, and only then, how should I think about it.

This is the same argument the sister book on habits makes about environments, arriving from a different literature. Arrange the situation rather than working on your response to it, because you have far more leverage over a situation than over a response, and you have it in advance rather than in the moment.

## What reappraisal buys, compared with the alternative

The comparison that gives reappraisal its reputation is against suppression, and the results are consistent.

Gross's experiments had participants watch distressing films under different instructions. Suppressors, told to keep their reactions off their faces, succeeded in looking less expressive and felt no better. Their sympathetic nervous system activation went up rather than down. They remembered less about what they had seen, because holding the face still consumed attention the film needed. In later work with conversation partners, the partners of suppressors showed rising blood pressure, having been placed opposite someone whose face had stopped providing information.

Reappraisers, told to think about the material differently, reported less negative emotion, showed no increase in physiological activation, and did not have the memory cost.

So the case for reappraisal is not that it is powerful. It is that the thing most people do instead is actively expensive.

## Is it trainable

Yes, with the qualifications below.

The neuroimaging work by Kevin Ochsner and Gross established that deliberate reappraisal engages regions of prefrontal cortex and is associated with reduced amygdala response, which at least tells you it is an effortful cognitive act rather than a description of a temperament.

Bryan Denny and Ochsner ran training studies: repeated practice at reappraising, across days, reduced affective responses, and the improvement generalised to material the participants had not practised on. That is the finding that makes it a skill rather than a knack, because generalisation is what distinguishes the two.

And the largest applied version of reappraisal training is cognitive behavioural therapy, which is essentially this, structured, with a person helping. It has one of the better evidence bases in psychotherapy.

## Now the part that gets left out

**The effect sizes are modest.** Christian Webb and colleagues meta-analysed emotion regulation strategies and found reappraisal produced a small to moderate effect. Not transformative. Also, "reappraisal" in that literature covers a wide range of quite different operations, which makes the average hard to interpret.

**The therapy numbers have come down.** Pim Cuijpers and colleagues have shown repeatedly that effect sizes in the psychotherapy literature shrink substantially once you account for small-trial bias and publication bias. CBT works. It works less well than the older meta-analyses said.

**And the biggest caveat is not methodological at all.**

## Sometimes reappraisal is the wrong move

Allison Troy, Amanda Shallcross and Iris Mauss ran the study that should be quoted every time this topic comes up, and almost never is.

They measured people's ability to reappraise, in a laboratory task, and separately assessed the stressful situations in participants' actual lives, including whether those situations were controllable.

The result was an interaction, and it went in both directions.

For people facing **uncontrollable** stress, a bereavement, an illness, something genuinely outside their influence, higher reappraisal ability predicted **lower** depression. As expected.

For people facing **controllable** stress, a bad job they could leave, a conflict they could address, higher reappraisal ability predicted **higher** depression.

Being good at reframing a situation you could have changed appears to help you stay in it.

That is a serious finding and it reframes the whole skill. Reappraisal is not a general-purpose good. It is a tool for one class of problem, and applied to the other class it functions as a very effective mechanism for tolerating something you should be ending.

Which is uncomfortable, because tolerating things is often praised, and because the people best at it are frequently the ones who stay longest in situations everyone around them can see are bad.

## The triage

So the technique comes with a question that has to be asked first, every time.

**Can I change this?**

If yes, do that. Change the situation, leave it, address the person, restructure the week. Reappraisal here is not resilience, it is anaesthetic, and Troy's data suggests the anaesthetic has a cost.

If no, or not yet, then reappraise, and do it properly.

Most people never ask the question, and the reason is that asking it honestly is more frightening than reframing. Reframing is available immediately and requires nothing of anybody else. Changing the situation involves a conversation, or a resignation, or an admission. So the tool that requires nothing gets used on the problems that require something, and it works well enough to prevent the something from happening.

## How to actually train it

Three practical points, given that it is a skill with a learning curve.

**Practise on small things.** Nobody learns a skill on the hardest available instance. You would not learn to swim in a rip current, and you should not try to build this capacity on the worst thing in your life. Use the delayed train, the unanswered message, the mildly rude email. Low stakes, high frequency, and the frequency is what matters because it is repetition that generalises.

**The reappraisal has to be believable.** An interpretation you do not accept does nothing except make you feel you are lying to yourself, which is a worse state than the original. The test is whether it is *plausible*, not whether it is comforting. "They are probably busy" is plausible. "They must be excited to reply" is not.

**Reappraising the situation beats reappraising yourself.** The versions with the best support involve reinterpreting what is happening, taking a detached or third-person view of it, or reconsidering the other person's likely reasons. They do not involve telling yourself things about your own character, which is where this most often goes wrong and turns into the affirmation problem the sister book on confidence takes apart.

## This week

**Every day, once: run the triage out loud on one irritation.**

Two questions, in order. *Can I change this?* If yes, name the specific action and put it somewhere you will do it. If no, say the alternative reading, out loud, once.

Keep a tally of the answers, because the tally is the finding. People arrive at this chapter assuming most of their stress is uncontrollable, and generally discover, after a week of asking honestly, that a good deal of it is controllable and has been reframed instead of addressed for a long time.

**And once this week, pick the largest recurring stressor you have, and ask the question about it properly.**

Not the daily irritations. The one. Give it twenty minutes and write the answer down, including what changing it would actually involve and what it would cost.

If the honest answer is that it is controllable and you have been reappraising it for a year, that is not a failure of this chapter. It is the single most useful thing the chapter can tell you, and it is worth more than any amount of getting better at the technique.

The next chapter is about practice, and about the ceiling on what practice can do, which is where the story most of these books tell starts to break down.$body$,
       word_count = 1487
  from books b
 where b.id = c.book_id
   and b.slug = 'story-you-tell'
   and c.idx = 7;

-- story-you-tell | chapter 8 | 1,490 words | 08-practice-and-the-ceiling-on-practice.md
update chapters c
   set body = $body$Ten thousand hours.

You know the number, and you have probably done the arithmetic on it at some point. Three hours a day for nine years. Forty hours a week for five. And depending on the mood you were in when you did the sum, it either felt like permission or like a sentence.

The number is real, in the sense that it appears in a real study. Almost everything else about how you have encountered it is wrong, including, importantly, the part that would let you off the hook.

## What the study actually found

Anders Ericsson, Ralf Krampe and Clemens Tesch-Römer studied violinists at a Berlin music academy in 1993. They divided them by expert assessment into the best students, good students, and those training to be music teachers, and reconstructed how much solitary, effortful practice each group had accumulated.

By age twenty, the best group had done something in the region of ten thousand hours. The good students around seven and a half thousand. The future teachers around four and a half.

That is the finding. A difference in accumulated practice between groups at different levels of attainment, in one conservatory, in one instrument, with practice hours reconstructed retrospectively from what people remembered.

Ericsson did not claim there was a threshold at ten thousand. He did not claim that reaching it produced expertise. The round number is an average for one group in one study, and it is an average, which means half of them had done less.

The threshold version is Malcolm Gladwell's, from *Outliers*, and Ericsson objected to it publicly and repeatedly for the rest of his life. He thought it had turned a claim about the *nature* of practice into a claim about its *quantity*, which was close to the opposite of his point.

## Ericsson's actual claim, which is more interesting

The concept was **deliberate practice**, and the adjective is the whole argument.

Deliberate practice is not doing the activity. It has a specific structure: a well-defined goal for the session, work at a level just beyond current ability, immediate feedback on what went wrong, and repetition with correction. It is usually designed by a teacher, and it is generally not enjoyable, which is why people do not do much of it voluntarily.

This is contrasted with mere experience, and the contrast is where the useful evidence is. Across a range of fields, the number of years someone has been doing something turns out to be a poor predictor of how well they do it. Ericsson wrote extensively about medicine in particular, where performance on some measures does not improve with experience and in places declines.

That finding is robust and it is the practically important one. Most people who have been doing something for a decade have been repeating the parts they can already do, at a comfortable level, without feedback, and are genuinely no better than they were in year three.

## Now the part that gets left out

The strong version of Ericsson's claim, that deliberate practice largely accounts for individual differences in expert performance, has not held up.

Brooke Macnamara, David Hambrick and Frederick Oswald, the same Macnamara who turns up in chapter two on mindset, meta-analysed the deliberate practice literature. They found practice explained roughly a quarter of the variance in performance in games, about a fifth in music, a similar figure in sports, a few per cent in education, and almost nothing in professions.

Averaged across domains, somewhere around an eighth.

That is a real and substantial contribution, and it is nowhere near what the popular version claims. If practice explained everything, that figure would be close to one.

Ericsson disputed the meta-analysis, arguing that it pooled studies measuring all sorts of activity as though it were deliberate practice, and that this was exactly the confusion he had spent thirty years trying to prevent. There is something to that. The dispute was not resolved before his death in 2020 and is not resolved now.

Where that leaves an honest reader: **deliberate practice is necessary and not sufficient**, its contribution varies enormously by domain, and how large it is remains contested.

## What this means, and what it does not

The temptation at this point is to reach for the word talent and stop. That is not what the numbers support either.

Unexplained variance is not a measurement of innate ability. It includes starting age, quality of instruction, the years of accumulated advantage in a family that owns a piano, physical characteristics that matter in some sports and not at all elsewhere, luck in who taught you at eleven, and a large quantity of noise in how performance was assessed. Reading three quarters of unexplained variance as three quarters talent is a conclusion nobody's data supports.

There is a more useful observation available, and it is the one this chapter is actually for.

**The ceiling is almost certainly not your problem.**

The variance-explained figures are about differences among people who are already serious, at or near the top of their domains. They are answering the question: given a pool of dedicated violinists, what separates the best from the good.

That is not the question you have. Your question is how to get from bad to competent, or from competent to good, and in that range practice is overwhelmingly the story. Nobody has ever failed to become a decent amateur pianist because of a genetic ceiling. They failed because they did twenty minutes a week of playing the bits they liked.

Worrying about the ceiling, at the stage almost everybody reading this is at, is a way of having a sophisticated reason to not do the work.

## Why this is in a book about explanations

Every chapter in this book has been about the sentence you produce after a setback and what it licenses.

Two wrong stories are available here, and they fail in opposite directions.

**If practice explains everything**, then every plateau is a moral verdict. You did not want it enough, you did not put the hours in, and the correct response to slow progress is contempt. This is the story most performance writing sells and it produces a specific kind of exhausted person who cannot rest and cannot enjoy the thing.

**If practice explains nothing**, then attempting anything unfamiliar is undignified, and the correct response to early difficulty is to conclude you have found your limit and withdraw. This is the fixed story from chapter two wearing a lab coat, and the meta-analysis gets cited in its defence by people who have not read past the abstract.

The accurate story is duller and permits more. Practice is the largest thing you control, it is far from the only thing operating, its contribution depends on the domain, and slow progress is therefore ordinary information rather than a referendum on your character.

That is the version that lets you keep going, because it does not require you to interpret a bad month as evidence about your worth.

## The one practical thing that follows

If quantity is not the lever and structure is, then the question to ask about your practice is not how many hours but whether any of them meet the definition.

Four tests, and most people's practice fails at least three.

**Is there a specific target for this session?** Not "practise the piece". "The transition at bar 40, at seventy per cent speed, until four consecutive clean repetitions."

**Is it just beyond what you can currently do?** If you can already do it, you are performing, not practising. Comfortable repetition is the thing that produces ten years of no improvement.

**Is there feedback, soon?** This is the one that is hardest to arrange alone and it is the most important. Recording yourself counts. A teacher counts. Doing it and feeling that it went fine does not.

**Do you go back and work on the specific thing that was wrong?** Which is chapter three's whole argument about staying in the room with the result, arriving here from the other end.

## This week

Take one hour that you would have spent on the activity anyway, and convert it.

Before it: write the single specific target. One. Small enough to be reached or missed unambiguously in an hour.

During it: arrange one source of feedback that is not your own impression at the time. Record it, have someone watch it, mark it against a standard, compare it with a reference.

After it: write two lines. What was still wrong, and what the target is next time.

One hour, structured, will teach you more than the five unstructured hours around it, and the discomfort you feel during it is the thing you are looking for rather than a sign that something has gone wrong.

Then stop counting hours entirely. They were never the variable.

The last chapter is what to do on Monday, and it is short.$body$,
       word_count = 1490
  from books b
 where b.id = c.book_id
   and b.slug = 'story-you-tell'
   and c.idx = 8;

-- story-you-tell | chapter 9 | 1,236 words | 09-what-to-do-monday.md
update chapters c
   set body = $body$It is Monday, and something will go wrong this week.

Not catastrophically. Ordinarily. A piece of work will come back with more red on it than you expected, or a conversation will go badly, or you will look at something you made and see clearly that it is not good.

Within a second or two of that happening, you will produce a sentence. You will not experience it as producing a sentence; you will experience it as noticing something true. That sentence is the entire subject of this book, and everything in the preceding eight chapters comes down to a small number of things to do with it.

This chapter is short because it should be.

## The five moves

**One. Write what actually happened, before you write what it means.**

Facts a camera would have recorded, separated from your commentary on them. This takes two minutes and it is the step everyone skips, and skipping it is what allows a conclusion about your permanent character to be filed as though it were an observation.

**Two. Find the stability claim and check what it rests on.**

From chapter four. Your explanation will contain a claim about whether the cause will still be there next time, and that claim is doing most of the damage. When you find one, write down the actual evidence for the permanence: number of attempts, over what period, under what conditions. Almost always it will be two or three attempts, years ago, under circumstances nobody would choose.

You do not have to abandon the conclusion. Downgrade it from a finding to a hypothesis and write the one attempt that would test it.

**Three. Ask whether you can change the situation, before you work on your response to it.**

From chapter seven, and it is the question people avoid because reframing is available immediately and changing something requires a conversation. If it is controllable, change it. Reappraisal applied to a controllable problem is anaesthetic, and Troy's data suggests it helps you stay somewhere you should be leaving.

If it genuinely is not controllable, then reappraise, and make it plausible rather than comforting.

**Four. Keep one short loop running somewhere.**

From chapter five. Something where your action produces a visible result within an hour and nobody's judgement sits in between. It does not have to be important, and it is not avoidance. It is maintenance on the system that detects whether your actions matter, which is the system that goes quiet first and is hardest to notice going.

**Five. Make one hour a week structured.**

From chapter eight. One specific target, one source of feedback that is not your own impression at the time, and going back to work on the thing that was wrong. One hour like this is worth more than the five comfortable ones around it.

That is the whole protocol. It fits on a card.

## What it will feel like

It will not feel like anything.

This is worth saying plainly, because the expectation of a felt shift is what makes people abandon this sort of thing in week two. You will do the two columns and still feel bad. You will write the evidence line and the stable conclusion will still seem obviously true. You will run the triage and get an answer you do not want.

None of that is failure. The measure is not whether you feel better. The measure is a behavioural one and it is the same one chapter three landed on: **did you go back and look at what went wrong, specifically, soon, and did you attempt it again.**

If the answer is yes, this is working, whatever it feels like. If the answer is no, it is not working, however much better you feel.

## What to discount, one last time

I have flagged the weaknesses as they came up. Here they are together, because a reader who takes this whole book at full strength has been misled by me rather than by the field.

**Growth mindset as an intervention** is close to zero at population level. What survives is small, for struggling students, in environments that permit the behaviour it licenses.

**Learned helplessness** had its mechanism revised by its own authors after fifty years. Passivity is the default; control is what is learned.

**Attribution retraining** works modestly, mostly for people who are struggling.

**Stress mindset** research is promising, comes from a small number of laboratories, and its most quotable finding is observational.

**Reappraisal** produces modest effects and appears to be actively harmful when applied to problems you could solve instead.

**Deliberate practice** explains a real but partial share of the variance, the share varies enormously by domain, and the size of it is still disputed.

That is a more honest inventory than this genre usually offers, and I would rather you held all of it loosely than held any of it as a law and then felt deceived.

What survives every one of those discounts is the shape, and the shape is consistent across attribution research, explanatory style, mindset, helplessness and stress appraisal, which arrived from five different directions:

**What you conclude about a setback predicts what you do next. The conclusion is usually drawn too quickly, from too small a sample, and disproportionately in the areas you care most about. And the correction is behavioural rather than attitudinal.**

You do not fix this by believing something different. You fix it by going back and looking at the thing you got wrong while it still stings, which is unpleasant, and which is the only part that has ever reliably worked.

## What this book cannot do

The same limit the other two books state, and it is not a disclaimer.

If what is stopping you is depression, or exhaustion that sleep does not repair, or a genuinely unfair situation, or not enough money, then the sentence you say after a setback is not the binding constraint. Treating it as one is how a psychological framing gets used to relocate a structural problem inside a person.

Chapter five was specific about this and it is worth repeating at the end: the dogs in the second group were right about their box. The error was only in the next one. If you are still in the box, the work is the box.

## Monday

Do one thing.

The next time something goes wrong this week, and it will, stop before you have finished the sentence, and write the two columns.

That is all. Not the protocol, not the five moves, not a system. One instance of separating what happened from what you concluded, on the day it happens.

Do that four or five times over a month and you will have something you have never had: a small collection of your own explanations, in your own words, visible from outside, where the pattern in them is obvious. The pattern is the thing. Nobody can describe your particular version of it to you, and you cannot see it from inside a sentence you are in the middle of believing.

If you want the material on how to make the behaviour itself happen more reliably, that is the book on design and habit. If what is stopping you is the belief that you are not the sort of person who could, that is the book on evidence, and it is the one to read next.$body$,
       word_count = 1236
  from books b
 where b.id = c.book_id
   and b.slug = 'story-you-tell'
   and c.idx = 9;

commit;
