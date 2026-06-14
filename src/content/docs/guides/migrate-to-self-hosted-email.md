---
title: "How to Migrate to a Self-Hosted Email Server Without Downtime (2026)"
description: "A step-by-step 2026 guide to migrating email to a self-hosted server with zero downtime — the dual-send overlap, syncing mailboxes with imapsync, handling SPF/DKIM/DMARC during cutover, and the MX switch. Plus provider-specific notes for SendGrid, Google Workspace, Microsoft 365, mailcow and iRedMail."
lastUpdated: 2026-06-14
faq:
  - q: "Can I migrate email to a self-hosted server without downtime?"
    a: "Yes. The key is overlap, not a hard cutover. You stand up the new server while DNS still points at the old one, sync existing mail, run both in parallel (dual-send) while the new IP warms, then switch the MX record only when you've verified the new server. Because both servers accept mail during the overlap, no message is lost and users never see an outage."
  - q: "How do I move my existing mailboxes and old email?"
    a: "Use imapsync or doveadm backup to copy maildirs from the old server to the new one. Most self-hosted stacks (mailcow, iRedMail, Vectis Mail) run vanilla Dovecot underneath, so the folder structure transfers directly. Run an initial sync days before cutover, then a final incremental sync just before you switch MX so nothing that arrived in between is missed."
  - q: "What happens to SPF, DKIM, and DMARC when I migrate?"
    a: "During the overlap, your SPF record should authorise both servers' IPs, and you publish the new server's DKIM key alongside the old one (different selectors), so mail signed by either server validates. Once you've fully cut over and decommissioned the old server, remove its IP from SPF and retire its DKIM selector. Keep DMARC at its current policy throughout; don't tighten it mid-migration."
  - q: "How long does an email migration take?"
    a: "Plan for about five weeks end to end, but the work itself is small — the constraint is IP warmup. Roughly: one week to stand up the new server and sync, three weeks of dual-send while the fresh IP builds reputation with Gmail and Microsoft, and a final week to switch MX and decommission. A brand-new sending IP is the slow part, not the software."
  - q: "Why do migrations break DKIM, and how do I avoid it?"
    a: "The classic failure is moving mail data but leaving the DKIM keys behind — especially on stacks like mailcow that store keys in Redis rather than as files. Mail then fails DKIM at the receiver (often a 550-5.7.26 rejection). Avoid it by explicitly exporting the keys (or publishing new keys on the new server before cutover) and verifying signing with a test message before you switch the MX record."
  - q: "Do I need to lower my DNS TTL before migrating?"
    a: "Yes. A day or two before the MX switch, lower the TTL on your MX (and any SPF/DKIM records you'll change) to 300 seconds so the change propagates in minutes instead of hours. Raise it back to 3600 once the migration has settled. This keeps the cutover window short and predictable."
---

**Migrating email feels risky — one wrong move and mail bounces, ends up in spam, or disappears.** It doesn't have to be. Done properly, an email migration has *zero* downtime and *zero* lost messages, because you never cut over cold: you run the old and new servers in parallel until the new one is proven. This guide is the full playbook — the overlap principle, syncing your mailboxes, handling authentication during cutover, the MX switch, and provider-specific notes.

:::tip[The one rule that prevents every disaster]
**Overlap, don't switch.** Keep the old server live and accepting mail while you stand up, sync, and warm the new one. Switch the MX record only after you've verified the new server end-to-end. Everything below is in service of that rule.
:::

## The migration in seven steps

### 1. Stand up the new server (DNS untouched)

Provision your new server and install your stack — for a one-command install on a fresh VPS, see [Getting started](/getting-started/installation/). Configure your domains and mailboxes, but **leave DNS pointed at the old server.** Nothing is live yet; you're just building.

Make sure the VPS basics are right before going further: outbound port 25 open, a custom [PTR (reverse DNS)](/guides/deliverability/) record set to your mail hostname, and the host not sitting on a residential blocklist.

### 2. Recreate domains and mailboxes

Create each domain and every mailbox on the new server with the same addresses. Match quotas and aliases. If you have a lot of accounts, script it against the API or CLI rather than clicking through a UI.

### 3. Sync existing mail

Copy the old mail across with `imapsync` (server-to-server) or `doveadm backup`. Most self-hosted stacks — mailcow, iRedMail, Vectis Mail — are vanilla Dovecot underneath, so maildir structure transfers directly:

```bash
# Example: sync one mailbox from old to new with imapsync
imapsync \
  --host1 old.example.com --user1 alice@example.com --password1 'OLDPASS' \
  --host2 new.example.com --user2 alice@example.com --password2 'NEWPASS' \
  --ssl1 --ssl2
```

Run a **full initial sync several days early**, then a **final incremental sync just before the MX switch** to catch anything that arrived in between.

### 4. Set up authentication for the overlap

This is where migrations most often break. During the parallel period, both servers send mail, so both must authenticate:

- **SPF** — authorise *both* IPs in the single SPF record, e.g. `v=spf1 ip4:OLD_IP ip4:NEW_IP mx -all`.
- **DKIM** — publish the **new server's DKIM key alongside the old one** using a different selector, so mail signed by either server validates. If you're leaving a stack that stores keys in a database, export them deliberately — see [where mailcow's DKIM keys live](/guides/mailcow-dkim-keys/) for the canonical example of keys that get left behind.
- **DMARC** — leave your policy as-is. **Do not tighten DMARC mid-migration.**

Send a test message through the new server and confirm `spf=pass` and `dkim=pass` before going further. (Full mechanics: [SPF, DKIM & DMARC](/guides/dkim-spf-dmarc/).)

### 5. Dual-send and warm the new IP

Start routing **new outbound mail through the new server** while the old one still handles inbound. A brand-new IP has no reputation, so ramp volume gradually over [a warmup schedule](/guides/ip-warmup/) — this overlap is exactly what protects you: the old, warm IP keeps delivering at full volume while the new one earns its reputation. There's no day-one deliverability cliff.

### 6. Switch the MX record

A day or two before cutover, **lower the MX record's TTL to 300 seconds** so the change propagates in minutes. When the new server is verified and the IP is warming well, point the MX at it. Inbound mail now flows to the new server. Because you synced in step 3 and kept both live, nothing is lost in the handover.

### 7. Verify, then decommission

Watch the new server for a few days: inbound arriving, outbound passing authentication, nothing in spam. Then retire the old server — and **clean up DNS**: remove the old IP from SPF, retire its DKIM selector, and raise your TTLs back to 3600.

## Migration timeline

| Phase | Duration | What's happening |
|-------|----------|------------------|
| Build + initial sync | ~1 week | New server up, mailboxes recreated, first full sync |
| Dual-send + warmup | ~3 weeks | New IP warming; both servers live; final syncs |
| Cutover + decommission | ~1 week | MX switch, verification, old server retired, DNS cleanup |

The infrastructure work is small. **IP warmup is the real constraint** — there is no shortcut to a sending IP that Gmail and Microsoft trust.

## Provider-specific notes

- **From SendGrid / Postmark / Mailgun (API senders).** There are no mailboxes to sync — it's transactional sending. The work is repointing your application's API calls and re-creating templates and webhooks, then warming the IP. The [SendGrid alternative](/alternatives/sendgrid/) and [Postmark alternative](/alternatives/postmark/) pages cover the API mapping.
- **From Google Workspace / Microsoft 365.** These hold real mailboxes — use `imapsync` to pull them. Remember you're only moving *email*; calendars, Docs/Office files, and Drive/OneDrive stay in the suite (or migrate separately). See [self-hosted email vs Google Workspace & Microsoft 365](/guides/self-hosted-email-vs-google-workspace-microsoft-365/) for what stays and what moves.
- **From mailcow / iRedMail.** Both are Dovecot underneath, so maildirs transfer cleanly. The main gotchas are DKIM keys (export them — don't assume they're files) and per-user Sieve filters (same format, copy them across). See the [mailcow](/alternatives/mailcow/) and [iRedMail](/alternatives/iredmail/) comparisons.

## Common pitfalls

- **Cutting over before warmup.** Switching MX and routing all outbound through a cold IP on day one is the fastest way to land in spam. Overlap exists to prevent this.
- **DKIM keys left behind.** The number-one migration failure. Export or regenerate keys deliberately and verify signing before the MX switch.
- **SPF over the lookup limit.** Adding the new server can push you past SPF's 10-DNS-lookup ceiling if you use many `include:` mechanisms. Prefer direct `ip4:` entries.
- **Forgetting the final incremental sync.** Mail that arrives between your initial sync and the MX switch is lost unless you run one last sync at cutover.
- **High TTLs during cutover.** A 24-hour MX TTL means a 24-hour-long ambiguous window. Lower it first.

## How Vectis Mail makes this easier

Vectis Mail is built for exactly this migration:

- **One-command install** stands the new server up in minutes.
- **DKIM keys are plain host-mounted files** that are generated automatically and survive backups and moves — no hunting through a database.
- **A built-in IP-warmup schedule** ramps the new IP for you, instead of you hand-rolling a calendar.
- **The deliverability checker** (`vectis domain check`) gives a green/yellow/red read on SPF, DKIM, DMARC, PTR, and MX so you know the new server is ready before you switch.

## Frequently asked questions

### Can I migrate email to a self-hosted server without downtime?

Yes. The key is overlap, not a hard cutover. You stand up the new server while DNS still points at the old one, sync existing mail, run both in parallel (dual-send) while the new IP warms, then switch the MX record only when you've verified the new server. Because both servers accept mail during the overlap, no message is lost and users never see an outage.

### How do I move my existing mailboxes and old email?

Use `imapsync` or `doveadm backup` to copy maildirs from the old server to the new one. Most self-hosted stacks (mailcow, iRedMail, Vectis Mail) run vanilla Dovecot underneath, so the folder structure transfers directly. Run an initial sync days before cutover, then a final incremental sync just before you switch MX so nothing that arrived in between is missed.

### What happens to SPF, DKIM, and DMARC when I migrate?

During the overlap, your SPF record should authorise both servers' IPs, and you publish the new server's DKIM key alongside the old one (different selectors), so mail signed by either server validates. Once you've fully cut over and decommissioned the old server, remove its IP from SPF and retire its DKIM selector. Keep DMARC at its current policy throughout; don't tighten it mid-migration.

### How long does an email migration take?

Plan for about five weeks end to end, but the work itself is small — the constraint is IP warmup. Roughly: one week to stand up the new server and sync, three weeks of dual-send while the fresh IP builds reputation with Gmail and Microsoft, and a final week to switch MX and decommission. A brand-new sending IP is the slow part, not the software.

### Why do migrations break DKIM, and how do I avoid it?

The classic failure is moving mail data but leaving the DKIM keys behind — especially on stacks like mailcow that store keys in Redis rather than as files. Mail then fails DKIM at the receiver (often a `550-5.7.26` rejection). Avoid it by explicitly exporting the keys (or publishing new keys on the new server before cutover) and verifying signing with a test message before you switch the MX record.

### Do I need to lower my DNS TTL before migrating?

Yes. A day or two before the MX switch, lower the TTL on your MX (and any SPF/DKIM records you'll change) to 300 seconds so the change propagates in minutes instead of hours. Raise it back to 3600 once the migration has settled. This keeps the cutover window short and predictable.

## Next steps

- [SPF, DKIM & DMARC](/guides/dkim-spf-dmarc/) — get authentication right before you cut over
- [IP warmup for new servers](/guides/ip-warmup/) — the warmup schedule that gates the timeline
- [Email deliverability best practices](/guides/deliverability/) — landing in the inbox after the move
- [The best self-hosted email servers in 2026](/guides/best-self-hosted-email-servers-2026/) — if you haven't picked a destination yet
