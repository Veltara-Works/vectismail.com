---
title: Your First Domain
description: Add a domain, create a mailbox, and send your first email with Vectis Mail.
---

After [installing Vectis Mail](/docs/getting-started/installation), you're ready to add your first domain and mailbox.

## Add a Domain

### Via the Dashboard

1. Log into the admin dashboard at `https://your-hostname/admin`
2. Go to **Domains** and click **Add Domain**
3. Enter your domain name (e.g. `example.com`)
4. Vectis automatically generates a DKIM key pair

### Via the API

```bash
curl -X POST https://your-hostname/api/v1/domains \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "example.com"}'
```

### Via the CLI

```bash
vectis domain add example.com
```

## Create a Mailbox

### Via the Dashboard

1. Go to **Mailboxes**, select your domain
2. Click **Add Mailbox**
3. Enter username, password, and optional display name

### Via the API

```bash
curl -X POST https://your-hostname/api/v1/mailboxes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain_id": "DOMAIN_UUID",
    "local_part": "hello",
    "password": "a-strong-password",
    "display_name": "Hello World"
  }'
```

## Verify Domain Ownership

Before sending email, verify you own the domain:

1. Go to **Domains** → your domain → click **Verify**
2. Vectis shows a TXT record to add to your DNS:
   ```
   _vectis-verify.example.com  TXT  "vectis-verify=abc123..."
   ```
3. Add the record at your DNS provider
4. Click **Verify** again — Vectis checks for the TXT record

## Send a Test Email

### Via the API

```bash
curl -X POST https://your-hostname/api/v1/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from": {"email": "hello@example.com", "name": "Test"},
    "to": [{"email": "you@gmail.com"}],
    "subject": "Hello from Vectis Mail",
    "text_body": "If you receive this, your mail server is working!"
  }'
```

### Via any email client

Configure your email client with:

| Setting | Value |
|---------|-------|
| IMAP server | `your-hostname` |
| IMAP port | `993` (SSL) |
| SMTP server | `your-hostname` |
| SMTP port | `587` (STARTTLS) |
| Username | `hello@example.com` |
| Password | The password you set |

## Next Steps

- [Configure DNS records](/docs/getting-started/dns-setup) for full deliverability
- [Set up DKIM, SPF, and DMARC](/docs/guides/dkim-spf-dmarc)
