---
title: "TLS Certificates"
description: "How Vectis Mail handles TLS certificate provisioning with acme.sh, Let's Encrypt automatic issuance, Cloudflare DNS-01 challenges, custom certificates, and TLS 1.2+ enforcement across SMTP, IMAP, POP3, and HTTPS."
---

Vectis Mail encrypts all connections by default. HTTPS traffic is terminated by Traefik with automatic Let's Encrypt certificates. Mail protocols (SMTP, IMAP, POP3) use a separate certificate managed by an acme.sh sidecar container. This dual-certificate architecture keeps the HTTP and mail TLS stacks independent and simplifies renewal.

## Architecture overview

Vectis uses two separate TLS certificate paths:

| Protocol | Termination | Certificate Source | Renewal |
|----------|-------------|-------------------|---------|
| HTTPS (443) | Traefik | Let's Encrypt (HTTP-01) | Automatic |
| SMTP (465, 587) | Postfix | acme.sh sidecar | Automatic |
| IMAP (993) | Dovecot | acme.sh sidecar (shared) | Automatic |
| POP3 (995) | Dovecot | acme.sh sidecar (shared) | Automatic |

Both Postfix and Dovecot read from the same certificate files at `/etc/ssl/mail/`, which are provisioned by the acme.sh sidecar and shared via a Docker volume.

### Why two certificate paths?

Mail protocols (SMTP, IMAP, POP3) handle their own TLS directly -- they are not routed through Traefik. This avoids the complexity of TCP passthrough configuration and STARTTLS handling in a reverse proxy. Each service manages its own TLS termination, giving you cleaner logs and simpler debugging.

## Automatic provisioning with Let's Encrypt

By default, Vectis uses Let's Encrypt for all TLS certificates. This is configured in `config.yaml`:

```yaml
tls:
  provider: letsencrypt
  email: admin@example.com
```

### How it works

**For HTTPS (Traefik):**

1. Traefik uses the HTTP-01 challenge: Let's Encrypt makes an HTTP request to port 80 on your server
2. Traefik responds with a challenge token, proving you control the hostname
3. Let's Encrypt issues the certificate
4. Traefik stores it in `/etc/traefik/acme/acme.json` and automatically renews before expiry

**For mail services (acme.sh sidecar):**

1. The acme.sh container runs a renewal script on startup and periodically thereafter
2. It issues a certificate for your mail hostname using the standalone HTTP-01 challenge or DNS-01 (if configured)
3. The certificate is installed to `/etc/ssl/mail/fullchain.pem` and `/etc/ssl/mail/privkey.pem`
4. Postfix and Dovecot read these files from the shared `mail-certs` Docker volume
5. On renewal, a reload signal is sent to Postfix and Dovecot

### Requirements for HTTP-01 challenges

HTTP-01 is the simplest method but has requirements:

- Port 80 must be open and reachable from the internet
- Your hostname's A record must point to your server's IP
- The hostname must be publicly resolvable
- You cannot be behind a proxy that intercepts port 80 traffic (unless it passes through ACME challenges)

If any of these are not met, use DNS-01 challenges instead.

## DNS-01 challenges with Cloudflare

If you use Cloudflare for DNS, you can configure the acme.sh sidecar to use DNS-01 challenges. This is useful when:

- Port 80 is blocked or used by another service
- You want to issue wildcard certificates
- Your server is behind a firewall that blocks inbound HTTP

### Configuration

Add your Cloudflare API token to `secrets.yaml`:

```yaml
cloudflare:
  api_token: "your-cloudflare-api-token"
```

The API token needs the following permissions:
- **Zone > DNS > Edit** for the zone(s) you want to issue certificates for

Then set `dns_challenge: cloudflare` in your TLS configuration. The acme.sh sidecar will use the Cloudflare API to create a temporary TXT record for domain validation, then clean it up after the certificate is issued.

### How DNS-01 works

1. acme.sh requests a certificate from Let's Encrypt
2. Let's Encrypt provides a challenge token
3. acme.sh creates a TXT record (`_acme-challenge.mail.example.com`) via the Cloudflare API
4. Let's Encrypt verifies the TXT record
5. Certificate is issued
6. acme.sh removes the temporary TXT record

This entire process is automatic and requires no manual intervention after initial configuration.

## Custom certificates

If you have certificates from another CA (or an internal PKI), you can use them instead of Let's Encrypt.

### Configuration

Set the TLS provider to `custom` in `config.yaml`:

```yaml
tls:
  provider: custom
  cert_path: /etc/vectis/certs/fullchain.pem
  key_path: /etc/vectis/certs/privkey.pem
```

The certificate and key files must be:

- PEM-encoded
- Readable by the Vectis containers (bind-mounted into the appropriate containers)
- The certificate file should include the full chain (your certificate + intermediate certificates)

### Applying custom certificates

```bash
# Copy your certificate files
cp your-cert.pem /etc/vectis/certs/fullchain.pem
cp your-key.pem /etc/vectis/certs/privkey.pem

# Set permissions
chmod 644 /etc/vectis/certs/fullchain.pem
chmod 600 /etc/vectis/certs/privkey.pem

# Apply the configuration
vectis config apply
```

When using custom certificates, you are responsible for renewal. Vectis will not automatically renew them. Set a calendar reminder or use your own automation to replace the files before they expire, then run `vectis config apply` to reload.

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

- **Inbound TLS is opportunistic** (`may`): Vectis will accept unencrypted connections from other servers on port 25 (required for interoperability -- many legitimate mail servers still connect without TLS), but authentication is only allowed over TLS (`smtpd_tls_auth_only = yes`).
- **Submission ports (587, 465) require TLS**: Port 587 uses STARTTLS and port 465 uses implicit TLS. Your email clients must connect with encryption.
- **Outbound TLS is opportunistic** (`may`): Vectis will use TLS when the remote server supports it, but will fall back to plaintext if not. This is standard practice -- enforcing TLS for outbound mail would prevent delivery to servers that don't support it.

### Dovecot (IMAP/POP3)

```
ssl = required
ssl_min_protocol = TLSv1.2
```

IMAP (993) and POP3 (995) use implicit TLS -- the connection is encrypted from the first byte. Unencrypted IMAP (143) and POP3 (110) are not exposed.

### Traefik (HTTPS)

Traefik enforces TLS 1.2+ for all HTTPS connections. HTTP requests on port 80 are automatically redirected to HTTPS on port 443.

## Certificate file locations

| File | Path | Used by |
|------|------|---------|
| Mail certificate chain | `/etc/ssl/mail/fullchain.pem` | Postfix, Dovecot |
| Mail private key | `/etc/ssl/mail/privkey.pem` | Postfix, Dovecot |
| Traefik ACME storage | `/etc/traefik/acme/acme.json` | Traefik |
| Custom certificates | `/etc/vectis/certs/` | Configured in `config.yaml` |

## Certificate renewal

### Let's Encrypt (automatic)

Let's Encrypt certificates are valid for 90 days. Both Traefik and acme.sh automatically renew certificates when they are within 30 days of expiry. No manual intervention is needed.

You can verify certificate expiry dates:

```bash
# Check the mail certificate
openssl s_client -connect mail.example.com:993 -servername mail.example.com </dev/null 2>/dev/null | \
  openssl x509 -noout -dates

# Check the HTTPS certificate
openssl s_client -connect mail.example.com:443 -servername mail.example.com </dev/null 2>/dev/null | \
  openssl x509 -noout -dates

# Check via the Vectis API
curl https://mail.example.com/api/v1/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Custom certificates (manual)

Replace the certificate files and reload:

```bash
cp new-fullchain.pem /etc/vectis/certs/fullchain.pem
cp new-privkey.pem /etc/vectis/certs/privkey.pem
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

If Postfix or Dovecot fail to start with "certificate not found" errors, check that the acme.sh sidecar has completed its initial certificate issuance:

```bash
vectis logs acme
docker logs vectis-acme
```

The sidecar needs port 80 access (or DNS-01 configuration) to issue the first certificate.

### Certificate expired

If automatic renewal failed:

```bash
# Check acme.sh logs for errors
vectis logs acme

# Force a manual renewal
docker exec vectis-acme acme.sh --renew --domain mail.example.com --force
```

### TLS handshake failures

If clients cannot connect:

```bash
# Test with verbose output
openssl s_client -connect mail.example.com:993 -servername mail.example.com -debug

# Check the server's supported protocols
nmap --script ssl-enum-ciphers -p 993 mail.example.com
```

Common causes:
- Client requires TLS 1.0 or 1.1 (not supported -- the client needs updating)
- Certificate hostname mismatch (the certificate's CN or SAN does not match the hostname the client is connecting to)
- Incomplete certificate chain (the fullchain file is missing intermediate certificates)

## Next steps

- [Cloudflare integration](/guides/cloudflare) for using Cloudflare DNS with Vectis
- [Troubleshooting](/guides/troubleshooting) for common TLS and connectivity issues
- [Installation guide](/getting-started/installation) for initial server setup
