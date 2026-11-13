# Hyrule Log

A shared progress log for a group playing through Ocarina of Time together.

The site doesn't know anything about the game. It starts empty, and the list only grows from what players log themselves. It is not a guide.

## How it works

- **One entry per step.** A mask is three steps: get it, deliver it, pay for it at the shop. Each is its own entry, and each player checks steps off on their own. Nothing is ever marked done because some other step was done.
- **Entry fields:** category (Heart Piece, Mask…), what (the thing itself), step (Got it, Delivered, Paid…), where, how, and child or adult.
- **No spoilers.** Steps you haven't done appear only as "Heart Piece · done by Bea". Click Reveal to see one.
- **Duplicates.** If you log a step someone already logged, the site offers to check theirs off instead.
- **Scoreboard.** Counts per player per category. There are no totals, so it never says how many exist.
- **No accounts.** Each device remembers which player is using it. The data is open to anyone with the URL, which is fine for a group of friends.

## Stack

Vite, React, and [Convex](https://convex.dev) for the database, hosted on Vercel.

## Setup

```sh
npm install
npx convex dev        # logs in, creates the Convex project, writes .env.local
npm run dev           # in a second terminal
```

### Deploy to Vercel

1. In the Convex dashboard, open the project's **production** deployment, go to Settings, and click **Generate Production Deploy Key**.
2. Import this repo in Vercel (or run `vercel link`), then add the key as the environment variable `CONVEX_DEPLOY_KEY`.
3. Deploy. `vercel.json` runs `npx convex deploy --cmd 'npm run build'`, which pushes the Convex functions and builds the site with the right `VITE_CONVEX_URL`.
