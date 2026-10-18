---
title: "Why your spam blocklists may have quietly stopped working"
description: "Spamhaus and URIBL refuse lookups that arrive via big shared DNS resolvers, and most mail servers never tell you. Check yours in two commands, and see our fix."
pubDate: 2026-10-18
excerpt: "On one of our own production mail servers, about a quarter of messages were scored with half the spam filter switched off. Nothing logged an error. Here's what was happening and how to check yours."
---

**Short version.** DNS blocklists such as Spamhaus and URIBL are some of the strongest spam signals a mail server has. But they refuse to answer lookups that reach them through large shared DNS resolvers: public ones like Google's `8.8.8.8`, and often the busy resolvers your hosting provider gives you. The refusal looks like a normal DNS answer, so the spam filter scores the message without those checks and moves on. Nothing errors. We found this on our own servers, fixed it in Vectis Mail, and the check below takes two commands on any self-hosted mail server.

## What we found

During a routine look at what was landing in Junk on one of our production servers, a pattern stood out: obvious spam scoring just under the spam threshold. The scores weren't wrong. They were missing pieces.

Our spam filter is [rspamd](https://rspamd.com/). When a blocklist refuses a query, rspamd adds a symbol ending in `_BLOCKED` (for example `URIBL_BLOCKED`) instead of a real result. On that server, **263 of 1,068 recently delivered messages carried one of those symbols**, so roughly a quarter of all mail was being scored with the blocklist checks effectively off. The link-reputation checks (URIBL) never worked at all, and the Spamhaus checks worked or didn't depending on which upstream resolver happened to answer.

## Why it happens

Blocklist operators give away a lot of lookups for free, and they protect that with limits on where queries come from:

- **Spamhaus** doesn't serve queries that arrive via large public or shared resolvers. It answers with a special "refused" code (`127.255.255.254`) or not at all. Its free public mirrors are also meant for non-commercial, low-volume use; [Spamhaus's terms](https://www.spamhaus.org/blocklists/dnsbl-fair-use-policy/) are the authority on that.
- **URIBL** returns `127.0.0.1` when a query is blocked, which a filter can easily mistake for "not listed".

A self-hosted mail server usually doesn't choose its resolver at all. In Docker, every container's DNS goes through Docker's embedded resolver, which forwards to whatever the host uses: often a provider resolver, sometimes `8.8.8.8` as a fallback. Thousands of other servers share those resolvers, so the blocklists have long since rate-limited or blocked them. Your server inherits that, and nothing in the mail logs says so.

## Check yours in two commands

Run these **from the same place your spam filter resolves DNS**: inside the container if it's containerised, because the host can use a different resolver than the containers do.

```sh
# URIBL's test record. A working lookup returns 127.0.0.14.
dig +short test.uribl.com.multi.uribl.com

# Spamhaus ZEN's test record. A working lookup returns 127.0.0.2 (often with .4 and .10).
dig +short 2.0.0.127.zen.spamhaus.org
```

How to read the answers:

| You get | It means |
|---|---|
| `127.0.0.14` / `127.0.0.2` | Working. The blocklist is answering you. |
| `127.0.0.1` (URIBL) | Your queries are being blocked. |
| `127.255.255.254` (Spamhaus) | You're querying through a public or shared resolver Spamhaus refuses. |
| Nothing at all | No answer: refused, rate-limited or timed out. Also not working. |

If your filter is rspamd, you can also search recent message headers (`X-Spamd-Result`) for symbols ending in `_BLOCKED`. Any hits mean some of your mail was scored blind.

## How we fixed it in Vectis Mail

The fix is to stop sharing. Since v0.1.53, Vectis Mail runs a small local recursive resolver ([Unbound](https://nlnetlabs.nl/projects/unbound/about/)) inside the spam-filter container. It asks the authoritative DNS servers directly instead of going through a shared resolver, so blocklist queries come from your server alone. It uses about 18 MB of memory. We recorded the decision as an architecture decision before building it, because adding a resolver to a mail stack is a real change.

The results from the same production server:

- **Before:** about 25% of messages scored with a `_BLOCKED` symbol, and URIBL never answered.
- **After:** **0 `_BLOCKED` symbols across 117 real messages** over five days, all four blocklist test records answering correctly every time (40/40), and real reputation results appearing in scores again (DNSWL, Mailspike, URIBL grey listings).

It's on by default and can be switched off if you'd rather use your own resolver. If you send at commercial volume, Spamhaus offers a paid Data Query Service (DQS) with its own key. Whether you need it is between you and Spamhaus, and our [release notes](/release-notes/) say so plainly rather than deciding it for you.

## If you run something else

You don't need Vectis Mail to fix this. Any of these work:

- **Run a local recursive resolver** (Unbound or similar) and point your spam filter at it, configured to recurse rather than forward to `8.8.8.8`.
- **Use a paid feed** such as Spamhaus DQS if your volume or use is commercial.
- **Re-run the two `dig` checks after any change** to your hosting, Docker networking or resolver settings. This breaks quietly, so check it again whenever those change.

## The wider point

A mail server can be "healthy" by every dashboard and still be doing a worse job than you think. Process checks pass, containers report green, and mail flows; meanwhile, half the spam filter is answering into a void. We'd rather find these things on our own mail first, fix them for everyone, and tell you how to check yours. For more on what affects whether mail is accepted and filtered properly, see our [deliverability guide](/guides/deliverability/).
