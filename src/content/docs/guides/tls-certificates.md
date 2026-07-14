---
title: "TLS Certificates"
description: "How Vectis Mail issues TLS certificates: automatic Let's Encrypt via Traefik, mirrored to Postfix and Dovecot, plus bring-your-own certs and TLS 1.2+."
faq:
  - q: "Does Vectis Mail handle TLS certificates automatically?"
    a: "Yes. By default Traefik issues a single Let's Encrypt certificate for your mail hostname over the HTTP-01 challenge and renews it automatically. A small cert-extractor sidecar mirrors that certificate into the mail-certs volume so Postfix and Dovecot (SMTP/IMAP/POP3) serve the same cert, reloading them whenever it rotates — no manual intervention."
  - q: "What TLS version does Vectis Mail require?"
    a: "TLS 1.2 is enforced as the minimum across SMTP, IMAP, POP3, and HTTPS; TLS 1.0 and 1.1 are disabled. Submission ports 587 (STARTTLS) and 465 (implicit TLS) require encryption, while inbound port 25 uses opportunistic TLS for interoperability but only allows authentication over TLS."
  - q: "Can I use my own TLS certificate instead of Let's Encrypt?"
    a: "Yes. Set provider: custom in config.yaml with cert_path and key_path pointing to your PEM-encoded fullchain and key, then run `vectis config apply`. With custom certificates you're responsible for renewal — Vectis won't auto-renew them. This is also the path for wildcard certificates, or when port 80 isn't reachable."
  - q: "How do I issue mail certificates if port 80 is blocked?"
    a: "Built-in Let's Encrypt issuance uses the HTTP-01 challenge, so port 80 must be reachable from the internet. If you can't open port 80 (or you need a wildcard certificate), obtain a certificate yourself — for example with your own acme.sh or certbot using a DNS-01 challenge — and point Vectis at it with provider: custom in config.yaml. You then own renewal."
  - q: "How do I check when my mail TLS certificate expires?"
    a: "Run `openssl s_client -connect mail.example.com:993` piped to `openssl x509 -noout -dates`, check the Vectis health API, or run `vectis tls status` on the host. Let's Encrypt certificates last 90 days and Traefik renews them automatically within 30 days of expiry; the cert-extractor mirrors the renewed cert to the mail services within seconds."
---

Vectis Mail encrypts all connections by default. A single Let's Encrypt certificate is issued and renewed by Traefik, and Vectis mirrors it to the mail services so HTTPS, SMTP, IMAP, and POP3 all serve the same certificate. There is no separate certificate client to run or babysit.

## Architecture overview

Traefik is the only ACME client. It issues one Let's Encrypt certificate for your mail hostname (over the HTTP-01 challenge) as a side-effect of serving the admin UI on 443, and renews it automatically. A small `vectis-cert-extractor` sidecar watches Traefik's certificate store and mirrors the certificate into the shared mail-certs volume, so Postfix and Dovecot serve the identical cert.

| Protocol | Termination | Certificate source | Renewal |
|----------|-------------|--------------------|---------|
| HTTPS (443) | Traefik | Let's Encrypt (HTTP-01) | Automatic |
| SMTP (465, 587) | Postfix | Mirrored from Traefik | Automatic |
| IMAP (993) | Dovecot | Mirrored from Traefik | Automatic |
| POP3 (995) | Dovecot | Mirrored from Traefik | Automatic |

Postfix and Dovecot read `/etc/ssl/mail/fullchain.pem` and `/etc/ssl/mail/privkey.pem` from the shared `mail-certs` Docker volume. The cert-extractor writes those files; nothing else issues certificates.

### Why mirror instead of terminating mail TLS at the proxy?

Mail protocols (SMTP, IMAP, POP3) handle their own TLS directly — they are not routed through Traefik. This avoids TCP-passthrough and STARTTLS handling in a reverse proxy: each service manages its own TLS termination, giving cleaner logs and simpler debugging, while still using a single Traefik-issued certificate.

## Automatic provisioning with Let's Encrypt

By default, Vectis uses Let's Encrypt. This is configured in `config.yaml`:

```yaml
tls:
  provider: letsencrypt
  email: admin@example.com
```

### How it works

1. Traefik uses the HTTP-01 challenge: Let's Encrypt makes an HTTP request to port 80 on your server.
2. Traefik responds with a challenge token, proving you control the hostname, and Let's Encrypt issues the certificate.
3. Traefik stores it in `/var/traefik/acme/acme.json` and renews it automatically before expiry.
4. The `vectis-cert-extractor` sidecar polls that store, writes the certificate to `/etc/ssl/mail/fullchain.pem` and `/etc/ssl/mail/privkey.pem`, and signals Postfix and Dovecot to reload when the certificate changes.

Before the first certificate is issued, the extractor writes a short-lived self-signed placeholder so Dovecot can start; it is replaced automatically the moment the real certificate lands.

### Requirements for HTTP-01 challenges

Built-in issuance uses HTTP-01, which requires:

- Port 80 open and reachable from the internet
- Your hostname's A record pointing to your server's IP
- The hostname publicly resolvable
- No proxy in front of port 80 that intercepts ACME challenge requests

If you can't meet these (or you need a wildcard certificate), use a **custom certificate** — see below.

## Custom certificates (bring your own)

Use a certificate from another CA, an internal PKI, a wildcard certificate, or one you obtained yourself with a DNS-01 challenge (e.g. via your own acme.sh or certbot) when port 80 isn't reachable.

Set the provider to `custom` in `config.yaml`:

```yaml
tls:
  provider: custom
  cert_path: /etc/vectis/certs/fullchain.pem
  key_path: /etc/vectis/certs/privkey.pem
```

The certificate and key files must be:

- PEM-encoded
- Readable by the Vectis containers (bind-mounted into the appropriate containers)
- A full chain (your certificate + intermediate certificates) in the cert file

### Applying custom certificates

```bash
# Copy your certificate files
cp your-cert.pem /etc/vectis/certs/fullchain.pem
cp your-key.pem  /etc/vectis/certs/privkey.pem

# Set permissions
chmod 644 /etc/vectis/certs/fullchain.pem
chmod 600 /etc/vectis/certs/privkey.pem

# Apply the configuration
vectis config apply
```

When using custom certificates, **you are responsible for renewal** — Vectis will not auto-renew them. Replace the files before they expire and run `vectis config apply` to reload.

## TLS enforcement

Vectis enforces TLS 1.2 as the minimum protocol version across all services. TLS 1.0 and 1.1 are disabled.

### Postfix (SMTP)

```
# Inbound (other servers connecting to you)
smtpd_tls_protocols = >=TLSv1.2
smtpd_tls_mandatory_protocols = >=TLSv1.2
smtpd_tls_security_level = may
smtpd_tls_auth_only = yes

# Outbound (your server connecting to others)
smtp_tls_protocols = >=TLSv1.2
smtp_tls_security_level = may
```

Key points:

- **Inbound TLS is opportunistic** (`may`): Vectis accepts unencrypted connections from other servers on port 25 (required for interoperability — many legitimate mail servers still connect without TLS), but authentication is only allowed over TLS (`smtpd_tls_auth_only = yes`).
- **Submission ports (587, 465) require TLS**: Port 587 uses STARTTLS and port 465 uses implicit TLS. Your email clients must connect with encryption.
- **Outbound TLS is opportunistic** (`may`): Vectis uses TLS when the remote server supports it, falling back to plaintext if not. This is standard practice — enforcing TLS for outbound mail would prevent delivery to servers that don't support it.

### Dovecot (IMAP/POP3)

```
ssl = required
ssl_min_protocol = TLSv1.2
```

IMAP (993) and POP3 (995) use implicit TLS — encrypted from the first byte. Unencrypted IMAP (143) and POP3 (110) are not exposed.

### Traefik (HTTPS)

Traefik enforces TLS 1.2+ for all HTTPS connections. HTTP requests on port 80 are automatically redirected to HTTPS on port 443.

## Certificate file locations

| File | Path | Used by |
|------|------|---------|
| Mail certificate chain | `/etc/ssl/mail/fullchain.pem` | Postfix, Dovecot |
| Mail private key | `/etc/ssl/mail/privkey.pem` | Postfix, Dovecot |
| Traefik ACME storage | `/var/traefik/acme/acme.json` | Traefik |
| Custom certificates | `/etc/vectis/certs/` | Configured in `config.yaml` |

## Certificate renewal

### Let's Encrypt (automatic)

Let's Encrypt certificates are valid for 90 days. Traefik renews automatically within 30 days of expiry, and the cert-extractor mirrors the renewed certificate to the mail services within seconds and reloads them. No manual intervention is needed.

You can verify certificate expiry dates:

```bash
# Check the mail certificate
openssl s_client -connect mail.example.com:993 -servername mail.example.com </dev/null 2>/dev/null | \
  openssl x509 -noout -dates

# Check the HTTPS certificate
openssl s_client -connect mail.example.com:443 -servername mail.example.com </dev/null 2>/dev/null | \
  openssl x509 -noout -dates

# Check all certs from the host
vectis tls status
```

### Custom certificates (manual)

Replace the certificate files and reload:

```bash
cp new-fullchain.pem /etc/vectis/certs/fullchain.pem
cp new-privkey.pem   /etc/vectis/certs/privkey.pem
vectis config apply
```

## Verifying TLS

### Test SMTP TLS

```bash
# Test STARTTLS on port 587
openssl s_client -starttls smtp -connect mail.example.com:587 -servername mail.example.com

# Test implicit TLS on port 465
openssl s_client -connect mail.example.com:465 -servername mail.example.com
```

### Test IMAP TLS

```bash
openssl s_client -connect mail.example.com:993 -servername mail.example.com
```

### Test POP3 TLS

```bash
openssl s_client -connect mail.example.com:995 -servername mail.example.com
```

### Test HTTPS TLS

```bash
openssl s_client -connect mail.example.com:443 -servername mail.example.com
```

In all cases, look for:
- `Protocol  : TLSv1.2` or `TLSv1.3` in the output
- `Verify return code: 0 (ok)` indicating a valid certificate chain
- The correct subject (CN) and issuer

## Troubleshooting

### Certificate not found

If Postfix or Dovecot fail to start with "certificate not found" errors, Traefik hasn't issued the certificate yet (or the extractor hasn't mirrored it). Check both:

```bash
# Has the extractor written the cert and is it watching?
docker logs vectis-cert-extractor

# Has Traefik issued? Look for acme / rate-limit / error lines.
docker logs vectis-traefik | grep -iE 'acme|error|ratelimit'
```

The most common cause is that the HTTP-01 challenge can't complete: port 80 isn't reachable, the hostname's A record is wrong, or Let's Encrypt rate-limited the account. The extractor writes a self-signed placeholder in the meantime so mail services still start.

### Certificate expired

If automatic renewal failed, it's almost always a renewal-time HTTP-01 failure at the Traefik layer:

```bash
# Check Traefik's ACME activity
docker logs vectis-traefik | grep -iE 'acme|renew|error'

# Confirm the extractor sees the current cert
docker logs vectis-cert-extractor
vectis tls status
```

Make sure port 80 is still reachable and your DNS still resolves to this server. If you're on a custom certificate, renewal is your responsibility — replace the files and run `vectis config apply`.

### TLS handshake failures

If clients cannot connect:

```bash
# Test with verbose output
openssl s_client -connect mail.example.com:993 -servername mail.example.com -debug

# Check the server's supported protocols
nmap --script ssl-enum-ciphers -p 993 mail.example.com
```

Common causes:
- Client requires TLS 1.0 or 1.1 (not supported — the client needs updating)
- Certificate hostname mismatch (the certificate's CN or SAN does not match the hostname the client is connecting to)
- Incomplete certificate chain (the fullchain file is missing intermediate certificates)

## Frequently asked questions

### Does Vectis Mail handle TLS certificates automatically?

Yes. By default Traefik issues a single Let's Encrypt certificate for your mail hostname over the HTTP-01 challenge and renews it automatically. A small cert-extractor sidecar mirrors that certificate into the mail-certs volume so Postfix and Dovecot (SMTP/IMAP/POP3) serve the same cert, reloading them whenever it rotates — no manual intervention.

### What TLS version does Vectis Mail require?

TLS 1.2 is enforced as the minimum across SMTP, IMAP, POP3, and HTTPS; TLS 1.0 and 1.1 are disabled. Submission ports 587 (STARTTLS) and 465 (implicit TLS) require encryption, while inbound port 25 uses opportunistic TLS for interoperability but only allows authentication over TLS.

### Can I use my own TLS certificate instead of Let's Encrypt?

Yes. Set `provider: custom` in `config.yaml` with `cert_path` and `key_path` pointing to your PEM-encoded fullchain and key, then run `vectis config apply`. With custom certificates you're responsible for renewal — Vectis won't auto-renew them. This is also the path for wildcard certificates, or when port 80 isn't reachable.

### How do I issue mail certificates if port 80 is blocked?

Built-in Let's Encrypt issuance uses the HTTP-01 challenge, so port 80 must be reachable from the internet. If you can't open port 80 (or you need a wildcard certificate), obtain a certificate yourself — for example with your own acme.sh or certbot using a DNS-01 challenge — and point Vectis at it with `provider: custom` in `config.yaml`. You then own renewal.

### How do I check when my mail TLS certificate expires?

Run `openssl s_client -connect mail.example.com:993` piped to `openssl x509 -noout -dates`, check the Vectis health API, or run `vectis tls status` on the host. Let's Encrypt certificates last 90 days and Traefik renews them automatically within 30 days of expiry; the cert-extractor mirrors the renewed cert to the mail services within seconds.

## Next steps

- [Cloudflare integration](/guides/cloudflare/) for using Cloudflare DNS with Vectis
- [Troubleshooting](/guides/troubleshooting/) for common TLS and connectivity issues
- [Installation guide](/getting-started/installation/) for initial server setup
