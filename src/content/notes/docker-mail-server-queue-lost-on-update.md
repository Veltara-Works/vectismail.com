---
title: "Your Docker mail server may be deleting mail every time you update it"
description: "If Postfix's queue lives inside the container, recreating the container throws away mail you already accepted. We found this in our own stack. Here's how to check yours and how we fixed it."
pubDate: 2026-10-18
excerpt: "Most of the time the mail queue is empty, which is exactly why this bug hides. It only matters on the day a remote server is down, and that's the day you lose mail."
---

**Short version.** Postfix keeps mail it has accepted but not yet delivered in its queue directory, `/var/spool/postfix`. In a Docker setup, unless that directory is on a volume, it lives in the container's own writable layer, and **recreating the container deletes it**. Updates recreate containers. We found this in Vectis Mail's own stack, fixed it in v0.1.57, and tested the fix by recreating a container with a message queued. Two commands will tell you whether your setup has the same gap.

## Why this one hides so well

On a healthy server the queue is almost always empty. Mail comes in and goes out within seconds, so there's nothing to lose, and nothing goes wrong when you update.

The queue fills up when something *else* is wrong:

- A remote mail server is down or slow, so outbound mail is **deferred** and retried for days.
- A receiving server is **greylisting** you and asks you to try again later.
- A message is on **hold** while you investigate it.

That's when the queue holds real mail, mail your server already accepted and promised to deliver. If an update recreates the container then, those messages are simply gone. There's no bounce and no error; the sender believes it was delivered and the recipient never gets it.

## How we found it

We were building a feature that lets `vectis config apply` recreate containers whose configuration changed. During code review, a pointed question came up: *what happens to Postfix's queue when you recreate it?* We checked, and the answer wasn't good. The queue directory had never been on a volume. The new feature would recreate Postfix more often, and **every update since launch** had been recreating it too.

We can't prove no message was ever lost during a past update. Our own production servers had empty queues when we checked, and updates usually land when nothing is deferred, but "usually" isn't a guarantee. So we fixed it properly rather than work around it.

## Check yours in two commands

Replace `postfix` with your Postfix container's name.

```sh
# 1. Where does Postfix keep its queue? (Almost always /var/spool/postfix.)
docker exec postfix postconf -h queue_directory

# 2. Is that directory a mount? No output means it's NOT persisted.
docker inspect --format '{{range .Mounts}}{{println .Destination}}{{end}}' postfix | grep -x /var/spool/postfix
```

If the second command prints nothing, your queue lives in the container and the next recreate will empty it.

**Until you fix it, empty the queue before any update or recreate:**

```sh
docker exec postfix postqueue -p   # should say "Mail queue is empty"
docker exec postfix postqueue -f   # if not: try delivering everything now, then check again
```

If mail stays queued (a remote server is down, say), wait it out or move it deliberately before updating. Don't update over it.

## How we fixed it in Vectis Mail

From v0.1.57, Postfix's queue lives on its own named Docker volume, `postfix-spool`, mounted at `/var/spool/postfix`. A named volume is the right tool here: the queue is data, not configuration.

We tested it the boring way. We queued a message that couldn't be delivered, recreated the container, and checked the queue:

- **With the volume:** the same message, with the **same queue ID**, was still there after the recreate, and Postfix's own consistency check (`postfix check`) was clean.
- **Without it (the old layout):** one message queued before the recreate, zero after.

Two more safeguards:

- **A guard on recreates.** If Vectis Mail ever has to recreate a Postfix container that *doesn't* have the volume (for example, after rolling back to an older release), it first tries to deliver anything queued. If mail is still waiting, it refuses to recreate Postfix and says why, instead of deleting it.
- **The one-time move.** The update that *introduces* the volume still starts from an empty queue, because that's the moment the volume is first attached. Before updating to v0.1.57, check `postqueue -p` shows an empty queue. Our own update scripts now refuse to proceed until it does.

## The wider point

Containers make it easy to forget which state lives where. Configuration is usually mounted, mailboxes are usually on a volume, and that leaves the in-flight state in between, the queue, quietly sitting in a layer that every update throws away. If you run any mail stack in Docker, ours or anyone else's, the two-command check above is worth a minute. We'd rather tell you about a bug we had than pretend we never had one.

See our [troubleshooting guide](/guides/troubleshooting/) for other mail-flow checks, and the [release notes](/release-notes/) for what changes in each version.
