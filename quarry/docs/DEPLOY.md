# Running QUARRY and using it on your iPad

QUARRY has two parts: a **server** (database, data feeds, API) and the **app** you open
in a browser. Your iPad can't run the server, so it runs on a computer that stays on and
the iPad connects to it privately over **Tailscale**.

## 1. Pick where the server runs

| Option | Cost | Notes |
|---|---|---|
| Small cloud server (VPS), e.g. 2 vCPU / 4 GB RAM, Ubuntu | ~£5–10/month | Always on; recommended |
| A home PC or Mac that stays on | £0 | Fine if it never sleeps |

Install Docker on it (https://docs.docker.com/engine/install/).

## 2. Start QUARRY

```bash
git clone <this repo> && cd <repo>/quarry
cp .env.example .env        # then open .env and paste your API keys
make up                     # builds and starts everything
curl http://127.0.0.1:8000/health   # should say "ok"
```

QUARRY only listens on `127.0.0.1`, so nothing is exposed to the internet.

## 3. Connect your iPad with Tailscale (free for personal use)

1. Create a Tailscale account: https://tailscale.com
2. On the server: install Tailscale (`curl -fsSL https://tailscale.com/install.sh | sh`),
   run `sudo tailscale up`, and sign in.
3. Still on the server, publish QUARRY to your private network over HTTPS:
   ```bash
   sudo tailscale serve --bg 8000
   ```
   It prints an address like `https://quarry-server.your-tailnet.ts.net`.
4. On the iPad: install the **Tailscale** app from the App Store and sign in with the
   same account.

HTTPS matters. iPad Safari only allows Home Screen web apps and their offline shell on
secure (HTTPS) addresses, and `tailscale serve` provides a valid certificate automatically.

## 4. Add QUARRY to the iPad Home Screen

1. Open the `https://….ts.net` address in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open QUARRY from its icon. It runs full-screen like a normal app.

A Magic Keyboard works with the command line too: Ctrl/⌘+K, Tab, Enter.

## Updating

```bash
git pull && make up
```

The iPad app picks up the new version automatically the next time it opens.

## Backups

The database lives in the `dbdata` Docker volume. Backup/restore tooling arrives in
Phase 8; until then: `docker compose exec db pg_dump -U quarry quarry > backup.sql`.
