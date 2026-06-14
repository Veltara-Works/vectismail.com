---
title: "Where Are Mailcow's DKIM Keys? Finding, Backing Up & Fixing DKIM Signing"
description: "Modern mailcow stores DKIM private keys in Redis, not in /data/dkim — which is why migrations and backups break signing. Here's exactly where the keys live, how to export them, and how to fix the most common mailcow DKIM signing failures."
lastUpdated: 2026-06-14
faq:
  - q: "Where does mailcow store DKIM keys?"
    a: "In Redis, not on the filesystem. Modern mailcow keeps DKIM private keys in the redis-mailcow container under the DKIM_PRIV_KEYS hash, with a companion DKIM_SELECTORS hash mapping each domain to its selector. Older mailcow versions stored keys as files under data/dkim, which is why many guides still point there — but on any current install that directory is not where the live keys are."
  - q: "Why is there no /data/dkim/keys file in mailcow?"
    a: "Because mailcow migrated DKIM storage from files to Redis years ago. Rspamd signs using use_redis = true, so the authoritative private keys live in the redis-mailcow database, not on disk. If you're following an old tutorial that tells you to look in /data/dkim/keys, that advice predates the Redis migration."
  - q: "Why did DKIM stop working after I migrated mailcow?"
    a: "Almost always because the DKIM keys were left behind in Redis. If you copied only the mail data (maildirs, /data volumes) and assumed the keys came with them, the new server generates or expects different keys and outbound mail fails DKIM — often surfacing as a 550-5.7.26 rejection. The fix is to migrate Redis too: mailcow's official backup_and_restore.sh script includes Redis, so use it rather than copying directories by hand."
  - q: "How do I export or view a mailcow DKIM private key?"
    a: "Open a shell in the Redis container and read the hash: `docker compose exec redis-mailcow redis-cli`, then `HKEYS DKIM_PRIV_KEYS` to list the entries and `HGET DKIM_PRIV_KEYS example.com` to print the PEM private key. `HGETALL DKIM_SELECTORS` shows which selector each domain uses. You can also view and regenerate keys in the mailcow UI under Configuration → ARC/DKIM keys."
  - q: "How do I back up mailcow DKIM keys?"
    a: "Use mailcow's own backup_and_restore.sh script, which snapshots Redis along with the rest of the stack — that captures the DKIM keys. A filesystem-only backup of the data volumes will not, because the keys are in Redis. If you want a standalone copy, dump the DKIM_PRIV_KEYS and DKIM_SELECTORS hashes from redis-cli and store them securely alongside your DNS records."
  - q: "How do I fix 'no DKIM signature' or 'no key for signature' in mailcow?"
    a: "Check three things in order: that a key exists for the exact sending domain (`HKEYS DKIM_PRIV_KEYS`), that the selector in DNS matches the one in DKIM_SELECTORS, and that Rspamd reloaded after any key change (restart rspamd-mailcow). The 'invalid key type to load' error specifically points to a corrupted or wrong-format key in Redis — regenerate the key in the UI and republish the DNS record."
---

**If you're hunting for `/data/dkim/keys` on a mailcow server and coming up empty, you're not doing anything wrong — modern mailcow doesn't store DKIM keys as files.** They live in Redis. That single fact is behind most mailcow DKIM headaches: keys that vanish after a migration, backups that don't actually back up signing, and the "no key for signature" errors that follow. This guide shows exactly where the keys are, how to read and back them up, and how to fix the common signing failures.

:::tip[The short answer]
mailcow keeps DKIM **private keys in the `redis-mailcow` container**, in the `DKIM_PRIV_KEYS` hash (with selectors in `DKIM_SELECTORS`). There is no live key file under `data/dkim` on current versions. Jump to [reading the keys](#how-to-read-and-export-the-keys) or [backup & migration](#backing-up-and-migrating-without-losing-dkim).
:::

## Why there's no key file (and why old guides say there is)

Early mailcow stored DKIM private keys as files on disk. That changed when the project [migrated DKIM storage into Redis](https://github.com/mailcow/mailcow-dockerized/pull/286) so Rspamd could sign directly from the database. Rspamd's signing config (`data/conf/rspamd/local.d/dkim_signing.conf`) runs with `use_redis = true`, which means the **authoritative private keys are in Redis, not the filesystem.**

The leftover `data/dkim` path in a lot of older tutorials is why people still go looking there. On any current install, that's the wrong place — and assuming keys are files is the root cause of the migration and backup problems below.

## How to read and export the keys

Open a Redis shell inside the running stack and inspect the hashes:

```bash
# Open redis-cli in the mailcow Redis container
docker compose exec redis-mailcow redis-cli

# List every entry that has a private key
HKEYS DKIM_PRIV_KEYS

# Print the PEM private key for one domain
HGET DKIM_PRIV_KEYS example.com

# See which selector each domain signs with
HGETALL DKIM_SELECTORS
```

Run `HKEYS DKIM_PRIV_KEYS` first — it shows you the exact field names your install uses, so you read the right entry regardless of version differences. The value returned by `HGET` is the full PEM private key; the matching public key is what you publish in DNS (and what the mailcow UI shows under **Configuration → ARC/DKIM keys**).

To keep a standalone copy of the keys, dump both hashes and store them with your DNS records:

```bash
# From the host, export the two DKIM hashes to a file
docker compose exec redis-mailcow redis-cli HGETALL DKIM_PRIV_KEYS > dkim_priv_keys.txt
docker compose exec redis-mailcow redis-cli HGETALL DKIM_SELECTORS > dkim_selectors.txt
```

Treat those files like secrets — the private key is enough to forge signed mail for your domain.

## Backing up and migrating without losing DKIM

This is the one that bites people. Because the keys are in Redis:

- **A filesystem-only backup of your data volumes does *not* include DKIM.** If your backup routine just tars the maildirs and `data/` directories, your signing keys are not in it.
- **Copying directories to a new server loses the keys.** The new instance ends up with different (or missing) keys, and outbound mail starts failing DKIM — frequently as a `550-5.7.26` rejection from receivers like Gmail.

The correct approach is to **use mailcow's official `backup_and_restore.sh` script**, which snapshots Redis along with everything else, so the DKIM keys travel with the backup. If you're moving servers, restore from that script's output rather than hand-copying volumes. As a belt-and-braces step, also keep the `redis-cli` export above so you can re-import a key with `HSET DKIM_PRIV_KEYS example.com "$(cat key.pem)"` if you ever need to.

After any restore or key change, **restart `rspamd-mailcow`** so it picks up the keys, and confirm the published DNS record still matches the selector in `DKIM_SELECTORS`.

## Fixing the common signing failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `no key for signature` / mail unsigned | No key in Redis for the exact sending domain | `HKEYS DKIM_PRIV_KEYS` — if the domain is missing, generate a key in the UI |
| `cannot load dkim key: invalid key type to load` | Corrupted or wrong-format key in Redis | Regenerate the key in **Configuration → ARC/DKIM keys** and republish DNS |
| Signs after migration but `dkim=fail` at receiver | DNS selector ≠ the selector now in `DKIM_SELECTORS` | Update the DNS TXT record to match the live selector |
| Some domains sign, others don't | Key only generated for some domains | Add a key per domain; multi-domain setups need one each |
| Key changed but still failing | Rspamd didn't reload | `docker compose restart rspamd-mailcow`; allow DNS TTL to expire |

When you change a key, remember DNS propagation: lower the record's TTL before the change so the new public key takes effect quickly. (For the underlying mechanics of selectors, alignment, and records, see our [SPF, DKIM & DMARC guide](/guides/dkim-spf-dmarc/).)

## The deeper issue — and how to avoid the whole class of problem

mailcow is a capable stack, and once you know the keys are in Redis, the steps above are manageable. But it's worth naming *why* this trips so many operators: **DKIM keys stored in a database are invisible to ordinary backups and easy to leave behind in a migration.** The single most common way to lose DKIM on mailcow is a server move that didn't carry Redis with it.

It doesn't have to work that way. [Vectis Mail](/) takes the opposite approach: DKIM private keys are **plain files on the host** (`/var/vectis/dkim/<domain>/<selector>.key`), bind-mounted into the container, generated as RSA-2048 automatically, and **self-healed** (the orchestrator repairs ownership and permissions on every pass). Because the keys are just files in a known directory:

- A normal filesystem backup captures them — there's no separate database to remember.
- They travel with the box on a migration; restore the directory and signing keeps working.
- You can see, back up, and reason about exactly what's signing your mail.

If you're already on mailcow, the Redis steps above are all you need. If the recurring footguns — keys hidden in Redis, migrations that silently break signing — are why you're reading this, that's exactly the kind of operational sharp edge Vectis is built to remove. See the full [Vectis Mail vs mailcow comparison](/alternatives/mailcow/) for the honest, feature-by-feature picture.

## Frequently asked questions

### Where does mailcow store DKIM keys?

In Redis, not on the filesystem. Modern mailcow keeps DKIM private keys in the `redis-mailcow` container under the `DKIM_PRIV_KEYS` hash, with a companion `DKIM_SELECTORS` hash mapping each domain to its selector. Older mailcow versions stored keys as files under `data/dkim`, which is why many guides still point there — but on any current install that directory is not where the live keys are.

### Why is there no /data/dkim/keys file in mailcow?

Because mailcow migrated DKIM storage from files to Redis years ago. Rspamd signs using `use_redis = true`, so the authoritative private keys live in the `redis-mailcow` database, not on disk. If you're following an old tutorial that tells you to look in `/data/dkim/keys`, that advice predates the Redis migration.

### Why did DKIM stop working after I migrated mailcow?

Almost always because the DKIM keys were left behind in Redis. If you copied only the mail data (maildirs, `data/` volumes) and assumed the keys came with them, the new server generates or expects different keys and outbound mail fails DKIM — often surfacing as a `550-5.7.26` rejection. The fix is to migrate Redis too: mailcow's official `backup_and_restore.sh` script includes Redis, so use it rather than copying directories by hand.

### How do I export or view a mailcow DKIM private key?

Open a shell in the Redis container and read the hash: `docker compose exec redis-mailcow redis-cli`, then `HKEYS DKIM_PRIV_KEYS` to list the entries and `HGET DKIM_PRIV_KEYS example.com` to print the PEM private key. `HGETALL DKIM_SELECTORS` shows which selector each domain uses. You can also view and regenerate keys in the mailcow UI under **Configuration → ARC/DKIM keys**.

### How do I back up mailcow DKIM keys?

Use mailcow's own `backup_and_restore.sh` script, which snapshots Redis along with the rest of the stack — that captures the DKIM keys. A filesystem-only backup of the data volumes will not, because the keys are in Redis. If you want a standalone copy, dump the `DKIM_PRIV_KEYS` and `DKIM_SELECTORS` hashes from `redis-cli` and store them securely alongside your DNS records.

### How do I fix "no DKIM signature" or "no key for signature" in mailcow?

Check three things in order: that a key exists for the exact sending domain (`HKEYS DKIM_PRIV_KEYS`), that the selector in DNS matches the one in `DKIM_SELECTORS`, and that Rspamd reloaded after any key change (restart `rspamd-mailcow`). The "invalid key type to load" error specifically points to a corrupted or wrong-format key in Redis — regenerate the key in the UI and republish the DNS record.

## Next steps

- [SPF, DKIM & DMARC: the complete guide](/guides/dkim-spf-dmarc/) — how selectors, alignment, and records actually work
- [Vectis Mail vs mailcow](/alternatives/mailcow/) — the honest, feature-by-feature comparison
- [Email deliverability best practices](/guides/deliverability/) — everything beyond DKIM that affects the inbox
- [The best self-hosted email servers in 2026](/guides/best-self-hosted-email-servers-2026/) — if you're weighing your options
