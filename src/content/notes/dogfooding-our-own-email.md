---
title: "We run our own email on Vectis Mail"
description: "Before we asked anyone else to trust Vectis Mail with their email, we moved our own onto it — every domain we operate, the licensing path, and the forms on this very site. Here's what running it in production taught us."
pubDate: 2026-06-08
excerpt: "There are no customer logos to show you yet. So here's the next best proof: every piece of email infrastructure Veltara Works depends on already runs on Vectis Mail."
---

**Short version.** We don't have a wall of customer logos yet — Vectis Mail is new. What we do have is the next most honest thing: we run our own email on it. Every domain Veltara Works operates, the licensing path that powers Pro, and the contact forms on this site all run on the same Vectis Mail you can install today. Nothing here is a staging environment we keep separate from the product. It *is* the product.

This isn't a stunt. It's the cheapest, most direct quality signal we can give: if the thing we sell wasn't good enough for our own critical mail, we'd know before you did.

## What actually runs on it

- **All of our email.** This product's mail, our other products' mail, and the mail for the client domains across our portfolio all live on Vectis Mail installs. No Google Workspace bill, no SendGrid bill, one product handling inbound mailboxes and outbound sending together.
- **This website's forms.** When you submit the [contact form](/contact/) or the [Talk-to-us](/talk-to-us/) capture form, the Cloudflare Function behind it makes an authenticated `POST` to Vectis Mail's own `/api/v1/send` endpoint. The email that lands in our inbox was sent by the same REST API documented in our [API reference](/api/sending/). We didn't reach for a third-party form service — we used the sending API we ship.
- **The licensing path.** Vectis Mail Pro is licensed through [ValidonX](https://validonx.com), which Veltara Works also builds. Our own production install resolves its entitlements through exactly the path a paying customer's install does — so when we change the licensing flow, we feel it first.

## Why it makes the product better

Running your own software in production is a different kind of test than a CI suite. The suite tells you the code does what you wrote; production tells you whether what you wrote was the right thing. A lot of what's in the [changelog](/release-notes/v010/) exists because we hit it ourselves on real mail:

- **UTF-8 in bounce messages.** Real bounces from real providers carry non-ASCII. We found the rough edge by receiving one, not by imagining it.
- **TLS certificate renewal.** Certs renew on a schedule that doesn't care whether you're watching. Edge cases in the renewal path are the kind of thing you only meet by leaving a server running for months.
- **IP warmup and reputation.** We warmed our own sending IPs the same slow way we tell customers to. There's no fast path we keep for ourselves.
- **Backups you can actually restore.** A backup you've never restored is a hope, not a backup. We run the restore drill on our own data because our own data is what's at stake.

Every one of those is a fix that shipped to everyone. Dogfooding turns our inconvenience into your stability.

## Be honest about what that means

Eating your own dog food cuts both ways, and it should.

- **We carry the pager.** When an outbound IP gets temporarily listed, or a disk fills, or a renewal misfires, it's our phone at an inconvenient hour — the same pager any self-hoster signs up for. We're not insulated from the trade-off we describe on the [deliverability page](/deliverability/); we live inside it.
- **We're focused, on purpose.** We'd rather do one product well than many unevenly, and running it ourselves keeps us honest about where the edges are. Email is infrastructure we operate every day across our portfolio, not a side experiment.
- **New is new.** Production-since-2026 is real production, but it isn't a decade of it. We tell you what's shipped, what's on the roadmap, and we don't dress one up as the other.

## The point

"We use it ourselves" is easy to say and easy to fake. So the specifics matter: the email that replies to your enquiry, the licensing call our install makes, the inbound mail for every domain we run — all of it is Vectis Mail, in production, today. When external proof points arrive we'll show those too. Until then, the most credible thing we can do is depend on our own work — and we do.

If you want to see what we run, the honest starting points are the [self-host decision guide](/guides/self-host-email-2026/) (with real numbers) and the [installation guide](/getting-started/installation/). Same install. Same product. The one we trust with our own mail.
