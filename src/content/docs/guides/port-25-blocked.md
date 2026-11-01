---
title: "Port 25 Blocked on Your VPS? How to Get It Unblocked"
description: "Most VPS providers block outbound port 25 on new servers. How to test for it, and how to get it lifted at BinaryLane, Hetzner, Vultr, Linode, AWS and more."
lastUpdated: 2026-11-01
faq:
  - q: "Why is port 25 blocked on my new VPS?"
    a: "Providers block outbound port 25 on new servers to stop compromised or abusive machines from sending spam. It's a default, not a judgement about you. Most providers lift it on request once your account is verified or has some history."
  - q: "Can I use port 587 or 465 instead of port 25?"
    a: "Not for a mail server. Ports 587 and 465 are for submitting mail to your own provider with a login. When your server delivers mail to Gmail, Outlook or any other domain, it connects to that domain's mail server on port 25. There is no other port for server-to-server delivery."
  - q: "How do I check whether outbound port 25 is blocked?"
    a: "Run `vectis preflight`, which reports 'SMTP out: port 25 reachable' or 'port 25 blocked'. Without Vectis, run `nc -vz -w 10 gmail-smtp-in.l.google.com 25`. A '220' greeting or 'succeeded' means it's open. A timeout means it's blocked."
  - q: "Does the block stop my server receiving email?"
    a: "No. The block is on outbound connections. Other servers can still deliver to your server on port 25, so inbound mail works. What stops working is your server delivering mail to other domains."
  - q: "Which providers block outbound port 25?"
    a: "As of November 2026, by their own documentation: BinaryLane, Hetzner Cloud, DigitalOcean, Vultr, Scaleway, AWS EC2 and Google Cloud block it by default, as do Linode for some accounts and Azure for most subscription types. BinaryLane, Hetzner, Vultr, Linode, Scaleway and AWS document a way to lift it. DigitalOcean and Google Cloud document no request process."
---

**Short answer.** Most VPS providers block **outbound** port 25 on new servers. A mail server needs it: delivery to other domains only ever happens on port 25. Test with `vectis preflight` (or `nc`), then follow your provider's process below. On some it's a checkbox; on others it's a support request that's reviewed case by case.

## Why it matters for a mail server

Email moves between servers on **port 25**. When someone at your domain writes to a Gmail address, your server looks up Gmail's MX record and connects to it on port 25. No other port does that job.

Ports **587** and **465** exist for a different job: an email app or website *submitting* mail to its own provider with a username and password. You'll see advice to "just use 587" when port 25 is blocked. That works if you're relaying through someone else's server. It can't make your own server deliver mail directly.

The block is outbound only. Other servers can still reach yours on port 25, so **incoming mail keeps working**. Outgoing mail queues up and eventually bounces.

## Test for the block

On a Vectis Mail server, preflight checks it for you:

```bash
vectis preflight
```

```
SMTP out:      port 25 reachable            ✓
```

or, when blocked:

```
SMTP out:      port 25 blocked              ! Contact your hosting provider to unblock outbound SMTP (port 25)
```

Without Vectis, connect to any large mail server on port 25:

```bash
nc -vz -w 10 gmail-smtp-in.l.google.com 25
```

A `220` greeting or `succeeded` means outbound 25 is open. A timeout means it's blocked. Run it again after the provider confirms the change: some providers apply it within minutes, and some need the server restarted.

## Provider by provider

Each entry summarises the provider's own documentation as of **1 November 2026**; links are at the end. Policies change, so check the linked page before you buy a server specifically for mail.

### BinaryLane

- **Default:** Port Blocking is on for new servers. It blocks outbound TCP **22, 25 and 3389**.
- **To lift it:** in mPanel, open the server, go to **Network → Port Blocking**, untick *Block outgoing connections for email, SSH and Remote Desktop*, then **Save and Apply**. It's per server.
- **Conditions:** it can't be turned off while your account is under review (BinaryLane says reviews usually take 24–48 hours on business days). If the option is greyed out after approval, log out of mPanel and back in.
- **At creation:** servers created through the API with `"port_blocking": false` (or the CLI's `--no-port-blocking`) start with it off.

### Hetzner Cloud

- **Default:** ports **25 and 465** are blocked on all cloud servers. Port 587 isn't.
- **To lift it:** once your account is **at least a month old and the first invoice is paid**, create a **limit request** in the Hetzner Console describing your use case.
- **Conditions:** requests are decided case by case.

### Vultr

- **Default:** outbound port 25 is blocked on all new compute instances.
- **To lift it:** open a **support ticket**. Describe your intended mail use, the anti-spam measures in place (SPF, DKIM, rate limits) and your expected sending volume.
- **Conditions:** reviewed case by case, and approval isn't guaranteed.

### Linode (Akamai Cloud)

- **Default:** outbound connections on **25, 465 and 587** are restricted for *some* accounts created after 5 November 2019.
- **To lift it:** open a **support ticket** asking for the SMTP restrictions to be lifted. Include your first and last name, a detailed description of your email use and how you'll avoid unwanted mail, and the domain(s) you'll send from. Organisation name and public links are optional.
- **Conditions:** support reviews each request and may ask for more information.

### AWS EC2

- **Default:** outbound port 25 is blocked to public IP addresses (it's allowed only to private ranges).
- **To lift it:** submit the **Request to remove email sending limitations** form from your AWS account, one per Region. AWS's guidance is to give a clear use case and your plan to prevent unwanted email. Lightsail has its own equivalent request.

### Scaleway

- **Default:** outbound SMTP is blocked on Instances.
- **To lift it:** complete identity verification (KYC). Then, in the console, open **Instances → Security groups**, select the group and tick **Enable SMTP**. The change applies to every Instance in that group.

### Microsoft Azure

- **Default:** outbound port 25 is blocked for VMs on most subscription types. It's open on standard **Enterprise Agreement** and **Microsoft Customer Agreement for enterprise (MCA-E)** subscriptions.
- **Enterprise Dev/Test:** the block can be removed through **Diagnose and solve → Cannot send email (SMTP-Port 25)** on the virtual network in the Azure portal. VMs then need to be stopped, deallocated and restarted.
- **Other subscription types:** Microsoft documents no way to remove it.

### DigitalOcean

- **Default:** SMTP ports **25, 465 and 587** are blocked on all Droplets, including traffic through a Reserved IP.
- **To lift it:** DigitalOcean's documentation describes no request process.

### Google Cloud (Compute Engine)

- **Default:** connections to port 25 outside your VPC network are blocked. Google notes that some projects don't have the restriction.
- **To lift it:** Google's documentation describes no request process.

## What to include in an unblock request

Providers that review requests by hand ask much the same questions. A clear request covers:

- **Who you are:** your name, plus your organisation's name and website if it has one.
- **What the server does:** for example, "business mailboxes for example.com and transactional email for our application", with your expected daily volume.
- **That it isn't bulk marketing:** if you'll never send cold or bulk email from it, say so.
- **Your safeguards:**
  - reverse DNS (PTR) set to the mail hostname;
  - SPF, DKIM and DMARC published for every sending domain;
  - TLS on all mail ports;
  - authenticated submission only, with no open relay;
  - spam filtering and rate limits.

Vectis Mail sets up DKIM signing, TLS and authenticated-only submission at install, and the admin dashboard shows the SPF, DKIM and DMARC records to publish for each domain. Set the PTR record before you write the request: several providers look for it.

A template to adapt:

```text
Hello,

Please remove the outbound port 25 restriction on server <server name / IP>.

The server runs our own mail server for <your domain(s)>: business mailboxes
for <N> people and transactional email from our application, roughly <N>
messages per day. We don't send bulk or marketing email from it.

Safeguards in place:
- Reverse DNS: <IP> -> <mail.example.com>, matching forward DNS
- SPF, DKIM and DMARC published for every sending domain
- TLS on all mail ports; submission requires authentication (no open relay)
- Inbound and outbound spam filtering, with rate limits

Thank you,
<name>, <organisation>
```

## After it's lifted

1. Re-run `vectis preflight` (or the `nc` test) and confirm port 25 is reachable.
2. Flush anything that queued while it was blocked: `docker exec vectis-postfix postqueue -f`.
3. Send a test message to an outside address and check the headers for SPF, DKIM and DMARC `pass`. The [deliverability guide](/guides/deliverability/) covers what to check next.

If you're choosing a provider for a new mail server, look for three things before you buy: a documented way to lift the port 25 block, a custom PTR record, and a clean IP range. The [installation guide](/getting-started/installation/) lists the other prerequisites.

## Frequently asked questions

### Why is port 25 blocked on my new VPS?

Providers block outbound port 25 on new servers to stop compromised or abusive machines from sending spam. It's a default, not a judgement about you. Most providers lift it on request once your account is verified or has some history.

### Can I use port 587 or 465 instead of port 25?

Not for a mail server. Ports 587 and 465 are for submitting mail to your own provider with a login. When your server delivers mail to Gmail, Outlook or any other domain, it connects to that domain's mail server on port 25. There is no other port for server-to-server delivery.

### How do I check whether outbound port 25 is blocked?

Run `vectis preflight`, which reports 'SMTP out: port 25 reachable' or 'port 25 blocked'. Without Vectis, run `nc -vz -w 10 gmail-smtp-in.l.google.com 25`. A '220' greeting or 'succeeded' means it's open. A timeout means it's blocked.

### Does the block stop my server receiving email?

No. The block is on outbound connections. Other servers can still deliver to your server on port 25, so inbound mail works. What stops working is your server delivering mail to other domains.

### Which providers block outbound port 25?

As of November 2026, by their own documentation: BinaryLane, Hetzner Cloud, DigitalOcean, Vultr, Scaleway, AWS EC2 and Google Cloud block it by default, as do Linode for some accounts and Azure for most subscription types. BinaryLane, Hetzner, Vultr, Linode, Scaleway and AWS document a way to lift it. DigitalOcean and Google Cloud document no request process.

## Sources

Provider documentation, checked 1 November 2026:

- BinaryLane: [Outbound emails don't work](https://support.binarylane.com.au/support/solutions/articles/11000061067-outbound-emails-don-t-work)
- Hetzner: [Cloud servers FAQ](https://docs.hetzner.com/cloud/servers/faq/) ("Why can I not send any mails from my server?")
- Vultr: [Why is SMTP blocked?](https://docs.vultr.com/support/products/compute/why-is-smtp-blocked)
- Akamai (Linode): [Send email](https://techdocs.akamai.com/cloud-computing/docs/send-email)
- AWS: [Amazon EC2 service quotas](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-resource-limits.html) and [Remove the port 25 restriction](https://repost.aws/knowledge-center/ec2-port-25-throttle)
- Scaleway: [Send emails from your Instance](https://www.scaleway.com/en/docs/instances/how-to/send-emails-from-your-instance/)
- Microsoft: [Troubleshoot outbound SMTP connectivity in Azure](https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-network/troubleshoot-outbound-smtp-connectivity)
- DigitalOcean: [Why is SMTP blocked?](https://docs.digitalocean.com/support/why-is-smtp-blocked/)
- Google Cloud: [Sending email from an instance](https://docs.cloud.google.com/compute/docs/tutorials/sending-mail)
