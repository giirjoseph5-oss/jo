# Deriv Relay

A tiny Node.js server that holds one WebSocket connection to Deriv and
re-broadcasts every message, unchanged, to any browser that connects to it.
Use this when your own network can reach ordinary WebSocket servers but
something between you and `ws.derivws.com` / `*.binaryws.com` is silently
killing the connection (handshake completes, then it's cut a few seconds
in with no error — that's the pattern this is built to work around).

## Deploy to Render.com (free tier)

1. Put these files in a new GitHub repo (or a folder of an existing one).
2. Go to https://dashboard.render.com → **New** → **Blueprint**.
3. Point it at your repo. Render will read `render.yaml` and set everything
   up automatically (Node environment, build command, start command).
4. Click **Apply**. Wait for the first deploy to finish (a minute or two).
5. Your relay's URL will look like `https://deriv-relay-xxxx.onrender.com`.
   Use the **`wss://`** version of that same host in the dashboard's
   "Relay URL" field, e.g. `wss://deriv-relay-xxxx.onrender.com`.

No blueprint? You can also create the service manually:
- New → Web Service → connect your repo
- Environment: **Node**
- Build command: `npm install`
- Start command: `npm start`
- Plan: **Free**

## Notes

- Render's free tier spins the service down after 15 minutes of no traffic
  and takes a few seconds to wake back up on the next connection — the
  dashboard's auto-reconnect logic already handles that, it'll just take
  one extra reconnect cycle after idle periods.
- To stream more than one symbol, set the `SYMBOLS` environment variable
  in Render's dashboard to a comma-separated list, e.g. `R_10,R_25,R_50`.
  The relay subscribes to all of them and forwards every tick; a client
  dashboard just needs to filter by `tick.symbol` if it only wants one.
- This relay only ever forwards public market data (ticks). It never
  holds an API token and can't place trades — there's nothing in it to
  authenticate with, by design.
- If Render's own IP range ever gets blocked too, the same code deploys
  identically to Railway, Fly.io, or any small VPS — just run
  `npm install && npm start` with the `PORT` environment variable set by
  the platform (or left as the default 3000 on a VPS you access directly).

## Run locally (for testing)

```bash
npm install
npm start
```

Then point a client at `ws://localhost:3000`.
