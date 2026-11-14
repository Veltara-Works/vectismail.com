---
title: "What the Microsoft 365 outage says about who runs your email"
description: "Microsoft's November 2026 outage disrupted Outlook in 74 countries. What these incidents share, and what self-hosting your email does and doesn't change."
pubDate: 2026-11-14
excerpt: "When one provider runs most of the world's business email, its bad day is everyone's bad day at the same moment. Self-hosting doesn't stop outages. It changes whose outage you're exposed to, and who decides what happens next."
---

**Short version.** On 12–13 November 2026, Microsoft 365 went down around the world. Exchange Online, Outlook, Teams and Copilot were disrupted, and for some organisations recovery ran into a second day. Outages happen to every mail system, including ones you run yourself. What made this one so damaging is that it hit a very large share of the world's business email at the same moment, and nobody outside Microsoft could do anything about it. That second part is a choice you can revisit.

## What happened

Reports to Downdetector began at about 16:17 UTC on Thursday 12 November, early Friday morning in Australia and New Zealand and late Thursday afternoon in Europe. Within an hour they were coming from [74 countries and territories](https://ia.acs.org.au/article/2026/major-microsoft-outage-hits-outlook--teams-more.html). Microsoft said Exchange Online was the primary problem. Over the following hours it reverted configuration changes, restarted servers, took unresponsive ones out of service and moved traffic to other paths.

The effects were widespread:

- In the UK, a union said some NHS staff couldn't refer patient details in the normal way.
- Immigration New Zealand halted visa processing.
- Indian airlines warned that they might not receive customers' emails.
- Japan's economy minister warned of a "significant impact".
- In Australia, the Australian Federal Police, ASIO and the ABC were among the organisations affected.

([ABC](https://www.abc.net.au/news/2026-11-14/microsoft-says-sorry-for-global-outage-and-details-recovery/107385540), [ACS Information Age](https://ia.acs.org.au/article/2026/major-microsoft-outage-hits-outlook--teams-more.html))

Microsoft said it was not a cyberattack, apologised, and [attributed it](https://www.abc.net.au/news/2026-11-14/microsoft-says-sorry-for-global-outage-and-details-recovery/107385540) to "an issue during an earlier network capacity upgrade that surfaced following a recent network change". It has promised a full post-incident report.

The CEO of the Australian Computer Society, Dr Prins Ralston, [said](https://ia.acs.org.au/article/2026/major-microsoft-outage-hits-outlook--teams-more.html): "ASIO and the AFP had workarounds. Most small businesses and many agencies don't. Resilience shouldn't depend on whether you happen to have a second system."

## It isn't a one-off

Every large provider has incidents. The ones below are on the public record:

<div class="table-scroll">

| When | Provider | What happened |
|---|---|---|
| Nov 2026 | Microsoft 365 | Worldwide disruption to Exchange Online, Outlook and Teams, linked to a network upgrade and a later network change. Recovery ran into a second day for some organisations. |
| Jan 2026 | Microsoft 365 | [Nearly ten hours](https://www.theregister.com/2026/01/23/microsoft_365_outage/) of disruption to email and files across North America. |
| Nov 2024 | Microsoft 365 | Outlook and Teams [disrupted into a second day](https://www.windowscentral.com/software-apps/microsoft-365-outlook-and-microsoft-teams-are-down-heres-when-youll-be-able-to-use-them-again). Microsoft attributed it to a change it had made. |
| 2023 | Microsoft Exchange Online | Attackers used a stolen Microsoft signing key to forge access tokens, and read Exchange Online mailboxes at 22 organisations and of 503 individuals. The US Cyber Safety Review Board [called it](https://therecord.media/dhs-cascade-of-security-failures-microsoft-china-hack) the result of "a cascade of security failures". |
| Aug–Sep 2023 | Microsoft (Australia) | Several services in Australia [out for more than 24 hours](https://ia.acs.org.au/article/2026/major-microsoft-outage-hits-outlook--teams-more.html), linked to power and staffing issues at a local data centre. |
| Dec 2022 | Rackspace Hosted Exchange | A ransomware attack took the service down. Rackspace [never brought it back](https://practical365.com/what-we-can-learn-from-the-rackspace-breach/) and pointed customers to Microsoft 365. Only mail from before the attack could be recovered, and a little over half of customers eventually got some or all of it back. |
| Dec 2020 | Google | An authentication failure made Gmail and other Google services that need sign-in unavailable worldwide for [47 minutes](https://status.cloud.google.com/incident/zall/20013). |

</div>

Two things stand out. Most of these incidents began with a change the provider made: an upgrade, a configuration change, a quota migration. And in every case the customer's options were the same: wait, and refresh the status page.

## What you hand over with your email

Hosted email is a reasonable choice for many organisations, especially those that rely on the rest of the suite. But it helps to be clear about what you are delegating. It's more than storage.

- **When it fails, and how often.** Your availability is the provider's availability. Their change windows are your change windows, and you won't be told about them in advance.
- **How it fails.** When a provider fails, all its customers fail at once. Your suppliers, customers and staff all lose email at the same moment, which is exactly when you most need another way to reach them.
- **Whether you can get in.** Account decisions are made by the provider's systems and policies. In 2022 the New York Times reported on a father whose Google account was [disabled](https://ia.acs.org.au/article/2022/google-bans-father-for-taking-naked-pics-of-son.html) after an automated system flagged photos of his son taken for a doctor. Police cleared him, but Google did not restore the account, and he lost his email, his contacts and his phone number.
- **Whether the service continues at all.** Rackspace's hosted Exchange customers didn't get the service back.
- **Who else can ask for your mail.** Asked under oath by the French Senate in June 2025 whether he could guarantee that French customers' data would never be handed to US authorities without French approval, Microsoft France's legal director [replied](https://www.theregister.com/2025/07/25/microsoft_admits_it_cannot_guarantee/) "No, I cannot guarantee that." The same US law applies to every US-headquartered provider.
- **What it costs next year.** In October 2025 the ACCC [sued Microsoft](https://www.startupdaily.net/topic/artificial-intelligence-machine-learning/accc-sues-microsoft-alleging-it-misled-2-7-million-australians-on-microsoft-365-plans/), alleging that it misled about 2.7 million Australians by not clearly telling them that a cheaper plan without Copilot was available. We cover the per-seat maths in [self-hosted email vs Google Workspace and Microsoft 365](/guides/self-hosted-email-vs-google-workspace-microsoft-365/).

## What self-hosting changes, and what it doesn't

To be plain about it, **a single self-hosted server is not more reliable than Microsoft 365.** It has far fewer engineers, data centres and redundant paths behind it. If your only goal is the fewest minutes of downtime per year, self-hosting is not an obvious win.

What self-hosting changes is the shape of the risk:

- **Your failures are your own.** If your server has a bad hour, the rest of the world doesn't go down with you. Your customers can still email each other, your suppliers, and you once you're back.
- **Inbound mail waits instead of vanishing.** Sending servers queue and retry. The SMTP standard says they should keep trying for [at least four to five days](https://www.rfc-editor.org/rfc/rfc5321#section-4.5.4.1) before giving up. An hour of downtime on your own server means mail arrives late, not that it's lost. (The same applies to Microsoft, but you can't see their queues, and you can see yours.)
- **Nothing changes unless you change it.** Updates run when you run them, not when a provider rolls out a network change.
- **You can see what's happening.** Logs, the mail queue, the spam filter's scoring. When something breaks, you can find out why instead of waiting for an incident ID to be updated.
- **Nobody else can lock you out.** No automated policy system sits between you and your own mailbox.
- **You choose the jurisdiction.** Your mail lives where your server is. Choose a host based in your own country and the question of foreign access is much simpler. (A US-owned host in Sydney is still a US-owned host.)

The trade-off is real. **You're on call.** Disk space, TLS certificates, blocklists, updates and backups are your job, or the job of whoever you pay to do them. We set out the full trade-off, with numbers, in our [self-hosting decision guide](/guides/self-host-email-2026/).

## Worth doing whichever you run

Most of this applies whether your email is hosted or self-hosted:

1. **Own your domain at a registrar you control**, with the login somewhere other than the mailbox it protects. Your MX record is how you move. If you can't edit it during an outage, you can't leave.
2. **Keep an independent copy of important mail.** An IMAP backup on a schedule, stored somewhere that isn't the provider, and test that you can restore it.
3. **Have a second way to reach people.** A list of key contacts' phone numbers, and an agreed fallback channel, stored somewhere that doesn't depend on the system that just went down.
4. **Know what your critical inboxes are.** Billing, support and security addresses often matter more than any one person's mailbox. Some organisations run those on separate infrastructure for exactly this reason.

## Where Vectis Mail fits

[Vectis Mail](/) is the self-hosted mail server we build. It installs Postfix, Dovecot and Rspamd on your own server in one guided command, and you manage it from an admin dashboard or a REST API. It's designed around the risks above:

- **Updates** snapshot first, run health checks, and roll back automatically if anything fails.
- **Backups** are scheduled and encrypted, and you restore them from the dashboard.
- **You decide where your mail lives**, because it runs on whichever server you choose.

If you're thinking about moving some or all of your mailboxes, start with the [migration guide](/guides/migrate-to-self-hosted-email/). The [installation guide](/getting-started/installation/) goes from a fresh VPS to a working mailbox.

This isn't a reason to panic and move everything this week. The outage is a good reason to ask, calmly, what happens to your business the next time your email provider has a bad day, and whether you'd like that answer to depend partly on you.
