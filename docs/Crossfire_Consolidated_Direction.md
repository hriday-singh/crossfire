# Crossfire — Consolidated Direction (Post-Pivot)

This document merges Crossfire_Knowledge_Transfer.md, Crossfire_Complete_Knowledge_Transfer.md, and the two repositioning discussions from September 6 (the model-agnostic USP pivot, and the follow-up on what actually starts a run), with the open questions from the first discussion now resolved. It supersedes both prior documents where they conflict and restates them where they don't. Anyone joining the project from here should be able to read this one file and understand the idea, the reasoning, and what's actually getting built, without going back to the earlier drafts.

Four things were confirmed before this document was written: the application text is still editable, so positioning changes can reach the written answers, not just the pitch. The model-provider idea is real scope, not just marketing language, but bounded to a short, named list rather than open-ended local/BYOK support. The build is starting from zero, so the full 48 hours is available. And the certainty language in the new pitch draft is being replaced with the original, more defensible framing — Crossfire reduces and exposes uncertainty, it does not promise correctness.

## 1. The thesis, locked

One line: don't ask AI whether your idea is good, make it survive Crossfire.

Crossfire takes a decision someone is about to commit real time or money to, breaks it into the specific claims that decision depends on, decides which of those claims actually matter, runs independent tests designed to break each one, grounds the important findings in evidence, and hands back what survived, what broke, and what's still unproven, along with what that should change about the decision.

Central metaphor: a crash test for decisions. A crash test is valuable because it's built to find failure, not because the rig is smarter than the engineers who designed the car. Nobody asks whether a crash test has good judgment.

## 2. What the pivot actually changed

Most of what came out of the repositioning conversation was already true in the earlier docs, just under-emphasized. Adaptive scrutiny, spending extra computation only where a wrong answer would change the decision, was already written into the Complete Knowledge Transfer doc as a core principle. The rejection of "more agents equals smarter" was already the stated reason the panel exists. What the pivot genuinely adds is sharper language for saying this out loud, one real architectural addition, and a clearer answer to what actually starts a run.

The sharper language: "you don't need a better model, you need a better way to use the model." This removes the implicit "us versus the frontier model" framing that made the earlier positioning slightly defensive, and replaces it with a framing where Crossfire and the model the user already trusts are on the same side. A useful way to say this concretely: Crossfire compiles a user's messy intent into a structured, testable investigation. The model stays the reasoning engine; Crossfire is the layer that decides what's worth investigating and in how much depth. Section 3 below is where that compiling actually happens, at the input stage, before any testing starts.

The real additions are the model provider layer, section 7, and the input model, section 3. Both were previously deferred or left implicit. The provider layer was explicitly listed alongside voice interfaces and full local execution as wrong to build first; it has now been narrowed enough to be in scope. The input model wasn't addressed at all before beyond "give it a decision" — it now has a specific opening question, a defined boundary on how rough the input can be, and an object (the Case) that everything else in the loop operates on.

What did not change: the core loop's shape, the claim and test schema, the four verdict states, the five-role panel, the demo plan, and the principle that Crossfire never claims to guarantee correctness. Anyone tempted to read the pivot as a rewrite should read it as a retitling with two new components bolted on.

## 3. The input model: what starts a run

This decision matters more than it looks, because whatever counts as valid input defines what Crossfire actually is.

The opening question is "What are you considering?" not "What's your idea?" The difference is deliberate. Crossfire is a pre-commitment testing system, not an idea generator, so the opening prompt can't imply the user needs to arrive with something already polished. But it also can't imply that Crossfire will invent the idea for them, because that's a different product with a different job.

There are two states a user can show up in. The first: they already have a formed idea, "I want to build an AI that helps students apply to college," which turns into claims immediately. The second: they have a direction or a problem but no settled solution, "I have this problem, but I'm not sure whether the right shape is a Chrome extension, a desktop app, or a mobile app." Crossfire should accept the second state, a rough, unsettled direction is still something with claims underneath it worth testing. Where the line has to hold is a third state: no direction at all, "I want to build something cool for students, no idea what." That's an ideation request, not a decision to test, and taking it on would dilute the product into something it isn't. The same boundary applies to open-ended requests for life advice, "I don't know what to do with my career," which Crossfire should redirect toward naming an actual decision rather than attempt to resolve. The rule worth keeping as a product principle: Crossfire can handle a rough or unsettled input, but it should converge toward a concrete decision before it starts testing, never stay ambiguous through the whole run.

The object a run actually operates on is a Case: the decision being considered, whatever context the user supplied, the claims extracted from it, the tests run against those claims, the evidence found, the findings, and the resulting decision state. This gives the earlier, looser "Decision Case" idea from the Complete Knowledge Transfer doc (section 32 there) a concrete shape, and it's the same object a future session or rerun feature would extend later, without needing to build that persistence layer now.

One mechanical addition belongs in the core loop because of this: after claims are extracted, Crossfire should state back what it thinks the user is actually deciding and list the claims it found, and let the user confirm or correct that list before any test runs. This is cheap to build, since it's a review screen rather than new logic, and it earns its place for two concrete reasons: it stops the system from spending its adaptive compute investigating the wrong claims when a rough or messy input got misread, and it gives the user a moment of control that a pure black-box report never offers. This step is folded into the core loop in section 4 below, not treated as a separate feature.

On what forms of input to actually accept in 48 hours: plain text and rough notes are free, since they're the input already assumed everywhere else in this document. A document upload (a proposal, a brief, a set of research notes) and a pasted URL (a competitor, a paper, a product page) are genuinely valuable next steps, since a document or a link becomes context for the case rather than a second product, "Crossfire PDF Analyzer" is the wrong shape, "your document is evidence for the decision being tested" is the right one. But both require an extraction step before claims can be pulled out, turning a twelve-page PDF or a fetched page into something the claim-extraction step can actually read, and that's real, additional build time that the original hour-by-hour plan didn't account for. Screenshots and voice input are worth wanting eventually but correctly out of scope now. Section 11 places document and URL ingestion as a stretch item, not a guaranteed one.

One UI principle worth locking alongside this: a single input box and a single question, never a menu of modes. Something like "Validate an idea," "Fact-check a claim," "Analyze a document," and "Stress-test a decision" presented as separate choices turns Crossfire into a feature list instead of one testing process; Crossfire should work out what kind of thing it's looking at, not make the user pick a lane first. And as a matter of intent, not just wording: never make the user restructure their thinking to fit Crossfire, Crossfire restructures their thinking for the investigation.

Two secondary sources came up in the discussion that produced this section (a validation-tool alternatives listing and a 2026 idea-validation roundup). Neither has actually been fetched and read by anyone on the team, unlike the three research papers in section 15, which were. They shouldn't go into the application or any research-grounding material as citations until someone does that, consistent with the standard already set for the OneFlow paper that was deliberately left out for the same reason.

## 4. The core loop and what a claim actually is

The loop: idea or decision, then what must be true for it to work, then a claim map, which Crossfire states back to the user for confirmation or correction before anything else runs, then which of the confirmed claims are load-bearing, then a test plan chosen for that specific decision, then independent testing, then evidence, then claim status, then decision consequence, then, if something is still uncertain, the smallest real-world experiment that would resolve it.

A load-bearing claim is one where, if it turns out false, the decision changes significantly. "Students will trust an AI submitting applications on their behalf" is load-bearing for a college-application product. "The onboarding screen should use a dark theme" is not. Crossfire spends its extra computation on the first kind and gives the second kind a fast, shallow pass or skips it. This is the actual answer to "why should I wait longer for this," and it only works if the system can tell the two kinds apart, which is itself a real design problem worth prototyping early rather than assuming it falls out naturally from the claim extraction step.

Internally, each test record should carry: the claim, why it matters, what would disprove it, what would support it, what evidence exists on each side, the finding, the remaining uncertainty, the decision impact, and the next action. This is what keeps the system from being a chat log with labels painted on it. If a negative finding can't point at a "because," it shouldn't be allowed to move a claim's status.

## 5. Verdict states and how conflicts get resolved

Four states, all of them genuinely reachable: survived, weakened, broken, unresolved. Unresolved is not a hedge, it's the signal that the system actually measured something instead of defaulting to an opinion. A product that always lands on a confident verdict is indistinguishable from a chatbot with better formatting.

When evaluators disagree, the resolution is not a vote. Findings are prioritized by the quality and traceability of their evidence and by how critical the claim is to the overall decision. When the evidence is genuinely conflicting or thin, the claim stays unresolved rather than being forced to a winner. This is the answer that was already tested and held up well against every reviewer question, and nothing in the pivot should touch it.

Every important finding should end in a decision consequence, not just a verdict: what failed, why it matters, what changes as a result, and what the smallest next validation step would be. A claim marked broken should point at what to fix or replace. A claim marked unresolved should point at the cheapest way to find out.

## 6. The panel, unchanged

Devil's Advocate, Overthinker, Builder, Receipts, Judge. This is the final named set. Each is defined by its objective first and its tone second, and each sits behind a specific test rather than appearing as a character in a conversation: Devil's Advocate usually runs the Assumption Test, Receipts the Evidence Test, Builder the Feasibility Test, Overthinker the Edge-Case Test, Judge reconciles and is the only one that can move a claim to a final status, and has to point at the evidence behind that call.

Build priority stays: Devil's Advocate, Receipts, and Judge first, since attack, verify, adjudicate is already a complete loop by itself. Builder next. Overthinker only if there's real time left, since it strengthens the panel without being load-bearing for the core loop to make sense.

What the user sees is the test name, not the persona: "Assumption Test: 2 of 3 held," never "Devil's Advocate attacks claim three." This single rule does more for the product's identity than any line of pitch copy, because it makes the multi-agent architecture nearly invisible without removing it. The interface should read like a test runner or a CI dashboard, never like a character chat.

## 7. The model provider layer (new)

The confirmed scope: a settings screen where the user points Crossfire at one of a fixed set of providers, not an open marketplace of every model under the sun. The list: Claude, OpenAI, Gemini, Ollama for local models, and a generic custom endpoint for anything else that speaks the OpenAI-compatible chat completions format.

The feasibility shortcut worth acting on: this is not five separate integrations, it's three. OpenAI, Ollama, and a custom endpoint can all be served by a single adapter that takes a base URL, an API key, and a model name, and speaks the OpenAI chat completions schema, since Ollama exposes that schema natively and most self-hosted or third-party endpoints do too. Claude needs its own adapter for the Anthropic Messages API, and Gemini needs its own adapter for the Google Generative AI API. That's three code paths behind one internal interface, something like `generate(system_prompt, messages, config) -> text`, and every persona's calls go through it regardless of which test is running.

The open design question this document is flagging rather than resolving unilaterally: whether the provider is chosen once per run, for the whole panel, or once per persona. Per-persona provider choice was explicitly deferred before as extra scope, and nothing about the current time budget changes that math. The recommendation here is one provider per run, selected in settings before the run starts, with per-persona choice noted as a real post-hackathon feature rather than something to build now. This keeps the new capability genuinely usable, "point Crossfire at your own model," without reopening a scope decision that was already made correctly the first time.

Two risks belong here specifically. First, API keys for the custom and hosted providers need to stay out of logs and out of anything committed to source control, even under hackathon time pressure; a `.env` file or local-only storage is enough, a checked-in key is not. Second, and more important for the actual demo: a local Ollama model is a real quality and latency wildcard. The same principle that applies to live web research in section 10, don't let the highest-stakes moment of the presentation depend on something unpredictable, applies here. The settings screen supporting Ollama is the feature. The live demo itself should run on a fast hosted provider regardless of what's configurable, with the local-model option shown briefly as a capability rather than run as the main event.

## 8. Differentiation, sharpened

|  | A raw prompt to a frontier model | An AI council | An AI fact-checker | Crossfire |
|---|---|---|---|---|
| What it optimizes for | The best single answer | Surfacing several opinions | Whether a statement is true | Reducing the uncertainty that could change a decision |
| Typical failure | Drifts toward agreement over a long exchange, and what gets investigated depends on how the prompt was written | Converges into consensus or a vote, and disagreement is visible but not resolved | Can only check backward-looking, already-settled facts | None claimed to be immune, but load-bearing claims get independent, evidence-grounded attention by design |
| How disagreement is resolved | There usually isn't any to resolve, it's one voice | Majority vote or an averaged score | Not applicable | Evidence quality and how critical the claim is, never a vote; unresolved is a valid outcome |
| What you get back | A recommendation | A transcript or a consensus score | A true or false label | A claim-by-claim verdict tied to what to do next |

The sentence this table is built to support: other systems make disagreement visible, or make a single fact checkable. Crossfire makes the object of a decision, the claims it depends on, testable, and connects the results to what changes about the decision. That is a different job from being a smarter model, which is why "we use more models" was never going to be the actual pitch.

## 9. The certainty framing, locked

Crossfire does not promise truth, correctness, or the elimination of error. The promise is that it exposes the assumptions, evidence, contradictions, and uncertainties behind a decision clearly enough that the user can decide what to do next. This is the version that survives the obvious follow-up question, "so you're guaranteeing this is right?", because the honest answer is no, and the product is built around that being fine. Language like "you always know it's verified" or "minimize the room for error to zero" should not appear in the application text or the pitch; language like "you always know what's actually been checked, and what hasn't" is the same idea without the overclaim.

## 10. The demo

Anchor idea stays: an AI that manages college applications for students. It has real, testable assumptions about users, competitors, and feasibility, and a specific claim, that students will trust autonomous submission, that can break in a memorable way.

The core demo mechanism is a live side-by-side: the same input goes into one plain, unstructured call to a strong model, and into Crossfire, at the same time, in front of the audience. The plain call should not be engineered to look weak, if it happens to catch the same flaw Crossfire does, that's fine, because the point was never that Crossfire is smarter. The point is that Crossfire produces an inspectable claim-by-claim record where the other side produces a paragraph of advice.

Live web research is unreliable by nature in a demo setting, and the same caution now extends to a live local model, per section 7. The evidence for the one claim the demo depends on should be prepared and reproducible in advance, with any live search or local-model call running as a bonus layered on top, never as the single point of failure holding up the strongest moment of the pitch.

## 11. Revised 48-hour build plan

Since the build is starting from zero, the full window is usable, and the provider layer and the input model each need a slot early enough that everything downstream can use them without rework later.

Hour 0 to 2: build the provider interface and its three adapters (OpenAI-compatible, Anthropic, Gemini), wired to a hardcoded single choice for now. This unblocks every other component from hour 2 onward and is small enough not to threaten the rest of the schedule.

Hour 2 to 6: lock the demo decision category and the test plan for it, matching the college-application anchor. Name three to four tests, agree what evidence means for this category, prepare the one reproducible piece of evidence the demo claim will depend on. Also settle the exact wording of the opening question and the claim-confirmation screen now, since both are cheap to decide here and expensive to redesign once the loop is built around them.

Hour 6 to 20: build the core loop, from raw text input through claim extraction, the user confirmation step from section 3, and on to Devil's Advocate, Receipts, Judge, running through the provider interface from hour 0. Get the smallest complete loop working end to end on one input before touching anything else.

Hour 20 to 28: add Builder. Build the real settings screen for the provider list (Claude, OpenAI, Gemini, Ollama, custom endpoint), since the core loop already runs through the abstraction that makes this mostly a UI and config task at this point, not a new integration.

Hour 28 to 36: the honest side-by-side. Run the same input through a plain model call and through Crossfire, and let the contrast in structure, not a staged gap in quality, do the work.

Hour 36 to 42: pick one, not both, of Overthinker or document and URL ingestion for the Case, whichever is closer to done, and only if the core loop and the settings screen are already solid. This is the cut point if time runs short; both are strengthening features, neither is load-bearing for the core loop to make sense.

Hour 42 to 46: rehearse twice, on the hosted provider the demo will actually run on, with the prepared fallback evidence in place.

Hour 46 to 48: pitch polish and a sleep buffer.

## 12. Application answers — status and suggested touch-ups

The application text is confirmed editable, so it's worth deciding which answers benefit from the new framing and which were already strong enough to leave alone.

Leave alone: the answer to what problem is being solved, the answer about conflicting findings not being resolved by vote count, and the answer about broken versus unproven claims needing different responses. All three were independently well-reviewed before and nothing in the pivot weakens them.

Worth a light revision: the "what is your project about" answer and the "how will your solution work in practice" answer could each pick up one sentence reflecting that Crossfire is designed to work with whatever model the user already trusts, rather than reading as a fixed single-model product. Something close to: "Crossfire works with the model you already trust, Claude, OpenAI, Gemini, a local model through Ollama, or your own endpoint, it isn't another model competing with them, it's the testing process wrapped around whichever one you use." This should be additive, not a replacement, since the existing answers already do the harder job of explaining the claim-based mechanism well.

The demo-vision answer already names the side-by-side mechanism explicitly and doesn't need changes tied to this pivot.

## 13. Consolidated risks

The category has close competitors with large selectable-advisor panels and consensus scoring. The mitigation is unchanged: claim-tracking has to be structurally real, not colored labels over a plain chat log, because that's exactly where a sharp question lands.

The product not clearly outperforming a well-written prompt is a real intellectual risk, and the fix is the same one as before, keep the value anchored in automation, independence, an evidence trail, and a repeatable protocol, not in claimed intelligence.

Evaluators can hallucinate or misattribute evidence. A claim's status should only move because of evidence traceable to an actual source, never because an evaluator asserted something confidently.

The system can drift toward reflexive negativity if nothing rewards finding what's actually strong. Evidence moves a claim's status, and it should be exactly as easy to land on survived as on broken.

From the provider layer: a slow or weak local model chosen in settings could make a live run visibly worse than the hosted-provider version, in a way that has nothing to do with Crossfire's actual logic. Keep the demo itself on a fast hosted provider regardless of what's configurable, and be ready to explain that distinction if asked on stage.

From the certainty framing: if the written application still contains language implying guaranteed correctness anywhere left over from the pivot draft, it directly contradicts the unresolved-as-a-feature answer that already tested well. Worth a full read-through of the final submitted text specifically hunting for that contradiction before it goes in.

From the input model: accepting a document or a URL as context introduces a parsing step that can misread the actual proposal inside it, an extraction bug looks exactly like a bad claim to the rest of the system. The claim-confirmation step from section 3 is the safety net for this, since it's the one point where a bad extraction gets caught by the user before any compute is spent testing the wrong thing. That's an argument for keeping the confirmation step even if document and URL ingestion get cut for time, not just if they make it in.

## 14. Explicitly cut from this build

Per-persona model selection, full local execution as the primary runtime rather than an option, a decision-journal or session-persistence layer beyond the single run, a marketplace of arbitrary providers beyond the five named ones, voice or audio interfaces, screenshots as an accepted input type, and letting someone talk one-on-one with a single investigator outside the claim record. Document and URL ingestion sit just outside this list rather than inside it, they're wanted, and section 11 gives them a shot at hour 36, but they are not guaranteed and should not be promised in the pitch as already working until they actually are. All of these are legitimate future directions and none of them prove the core loop, which is the only thing the 48 hours needs to prove.

## 15. Open items for the feasibility pass

Whether provider selection is per-run or eventually per-persona, decided above as per-run for now but worth re-confirming once the core loop is actually running and it's clear how much time is left. Whether the application's final text gets the light touch-up in section 12 before submission or after a first working prototype exists to point to. Whether document and URL ingestion or Overthinker is the better use of the hour 36 to 42 slot, which will likely become obvious once hour 28 arrives and it's clear how the settings screen and Builder went. And a straightforward time check partway through the build: if hour 20 arrives and the core loop isn't solid, everything in the hour 36 to 42 slot is the first thing to cut, before anything in sections 1 through 6 gets touched.

## 16. Research grounding, unchanged

The same three sources back the feasibility case as before, and the standard for using them stays the same: read in full, cited only for the conditional claim they actually support, never for more than that.

"Can LLM Agents Really Debate? A Controlled Study of Multi-Agent Debate in Logical Reasoning" (arxiv.org/abs/2511.07784): debate effectiveness tracks the agents' own reasoning strength and how genuinely different they are, not the act of debating itself, and majority pressure suppresses independent correction, the exact failure mode independence-before-confrontation is built to counter.

"Demystifying Multi-Agent Debate: The Role of Confidence and Diversity" (aclanthology.org/2026.findings-acl.1694): vanilla multi-agent debate often underperforms simple majority vote, but diversity-aware initialization and confidence-modulated updates outperform both. This is independent support for resolving conflicts by evidence quality rather than vote count.

"Free-MAD: Consensus-Free Multi-Agent Debate" (aclanthology.org/2026.findings-acl.1600): token overhead, error propagation from an incorrect early response, and unfairness from majority voting are the same problems Crossfire's design already avoids by keeping evaluators independent and never voting.

Left out deliberately: "Rethinking the Value of Multi-Agent Workflow: A Strong Single Agent Baseline" (arxiv.org/html/2601.12307v1), since its finding, that a single agent role-playing the same personas can match a multi-agent system's performance more cheaply, is the wrapper accusation handed to a judge in citation form, and only usable inside a specific defensive frame. The two market-report links that came up in the latest discussion (a validation-tool alternatives page and a 2026 idea-validation roundup) are not on this list for the same reason: nobody on the team has actually fetched and read them yet.
