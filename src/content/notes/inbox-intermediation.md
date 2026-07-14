---
title: "The other half of the email intermediation problem"
description: "Google, Yahoo, Microsoft and Apple turned inboxes into parsers. Here's what that means if you receive email — and what self-hosting actually changes."
pubDate: 2026-05-26
excerpt: "The deliverability-focused conversation is incomplete. Provider-side ML now decides what you see when you receive email too — and that side is the part you can actually do something about."
---

**Short version.** [Jacques Corby-Tuech's recent essay](https://www.jacquescorbytuech.com/writing/what-google-yahoo-microsoft-and-apple-are-doing-your-email) is the most thoroughly-cited piece of work we've seen on what the major inbox providers are now doing to email in transit. It deserves to be read in full — 50+ footnotes to patents and academic papers, no hype. We want to add one thing the deliverability-focused conversation usually skips: this isn't only a sender problem. It's a receiver problem too, and the receiver side is the half you can actually do something about.

## What JCT documented

Quick recap, in case you haven't read it yet (you should — go now, this post will still be here).

- **Google** runs a system called Crusher that finds ~1.5M new email templates a week using DOM-level layout hashing. Gemini summaries now appear above the message body on mobile, replacing the preview text the sender wrote.
- **Yahoo's** SPICE classifier labels 96% of incoming mail into a 119-class taxonomy using only the sender name and subject line — a decision made before you ever open the message.
- **Microsoft** auto-archives time-sensitive messages once their natural-language expiry passes ("RSVP by", "boarding pass", "expires").
- **Apple** ships Mail Categorization (Primary / Transactions / Updates / Promotions), Priority Messages above the inbox, and Brand Message Grouping that collapses multiple sends from the same sender into a single visual unit.

The unifying thesis: providers have stopped being neutral transport and started being active intermediaries that parse, classify, summarise, group, and rank messages on the recipient's behalf using ML. The sender no longer controls what the recipient sees. Neither, increasingly, does the recipient.

JCT's framing is "the inbox is now a parser, not a mailbox." That's accurate.

## The half the conversation usually skips

When this kind of research surfaces, the response from the email industry is almost entirely sender-focused: how do we game the classifier, how do we land in Primary, how do we survive a 96-class taxonomy we can't see. That conversation matters, and it's noisy and well-staffed.

The conversation that gets less air is the recipient's. **You are receiving mail through these systems too.**

If your email is on Gmail, Outlook, iCloud or Yahoo right now, every message addressed to you has already been:

- Classified against a 119-bucket taxonomy you didn't approve
- Summarised by an LLM that may or may not have hallucinated
- Grouped with other senders the system decided are equivalent
- Prioritised, deprioritised, or auto-archived without your input

You can turn some of these off in settings. You cannot turn off the fact that the provider is making the decision in the first place, and you cannot inspect the rules. The classifier weights, the patent-described "user personas," the relevance-ranking model — these are not user-configurable.

This isn't a complaint about any specific feature. AI summaries are sometimes useful. Categorisation is sometimes useful. The problem is structural: **you've delegated a decision-making layer to a third party whose incentives are increasingly orthogonal to yours.**

## What self-hosting actually changes

Most "you should self-host" arguments lean on sender-side benefits — own your IP reputation, control your DKIM, escape per-seat pricing. Those are real. The receiver-side argument is less rehearsed and, for a lot of people, more compelling once you've heard it.

<div class="table-scroll">

| Decision | Provider-hosted inbox | Self-hosted inbox |
|---|---|---|
| What constitutes spam | Provider's classifier; opaque, frequently updated | Your rspamd/SpamAssassin rules; inspectable, version-controlled |
| Whether mail is summarised by an LLM | Provider opt-out at best; default-on increasingly | Off unless you wire it in yourself |
| Whether mail is auto-categorised | Provider's taxonomy, no override | Your Sieve rules, your folders, your call |
| Whether mail is auto-archived | "Time-sensitive" heuristics you can't see | Nothing archives without your rule |
| Whether the sender's preview text is replaced | Increasingly yes (Gemini summaries) | What the sender sent is what you see |
| Audit trail when a message went to spam | Header inspection if you're lucky | Full rspamd score breakdown, every time |

</div>

That last one matters more than it sounds. The number of "my client never got my invoice" support tickets that resolve with "your provider's classifier silently scored it 8.2 and folded it into Promotions" is non-trivial. On a self-hosted stack you can answer the question. On Gmail you can guess.

## Be honest about the trade

Self-hosting doesn't make this problem vanish — it relocates it.

- **You don't get Gmail's spam team.** You get [rspamd](https://rspamd.com/), which is genuinely excellent and ships sensible defaults, but you're the one who tunes the false-positive threshold when it bites.
- **You don't get magical categorisation.** You get Sieve rules and IMAP folders. If you want "Promotions" you write it.
- **You don't get a summarisation layer.** You get the body of the message. If you want an LLM summary you run it locally or you don't.
- **You eat the pager.** Outbound IP got listed at 3am? Your phone. Disk filled up? Your phone. TLS cert expired during cert-extractor edge case? Your phone.
- **You own the keys.** Which means you also own the responsibility for not losing them.

The honest framing: self-hosting trades convenience for sovereignty. For some people that trade is obviously worth it (regulated industries, people who've been burned by a provider's silent policy change, anyone whose business depends on actually receiving every message a customer sends). For other people it isn't — and that's a defensible call too. We wrote a long [decision guide on the self-host-vs-SaaS question](/guides/self-host-email-2026/) if you want to think through it with real numbers.

## Where to start if you want to try

Self-hosting your own inbound mail is a small industry with several mature options. We make one of them — [Vectis Mail](/) — but it isn't the only good answer. Worth evaluating:

- **[Mail-in-a-Box](https://mailinabox.email/)** — the original "one-script install" project. Mature, opinionated, single-tenant.
- **[Mailcow](https://mailcow.email/)** — Docker-based, German-built, large community, very mature admin UI.
- **[Stalwart](https://stalw.art/)** — newer, Rust-built, modern protocol coverage (JMAP), single binary.
- **Vectis Mail** — what we build. Declarative YAML config, REST API, atomic version updates, designed for solo operators and small teams who want infrastructure they can describe in source control.

Whichever you pick, the underlying point holds: deciding what happens to mail addressed to your domain is a decision you can take back. The question Corby-Tuech's essay raises is whether you'd rather make that decision once, in source, or let it be made for you a thousand times a day by a classifier you can't read.

---

*Thanks to Jacques Corby-Tuech for the [original research](https://www.jacquescorbytuech.com/writing/what-google-yahoo-microsoft-and-apple-are-doing-your-email). Any misreadings of his argument are ours; the good stuff is his.*
