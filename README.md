# Hyrule Log

A shared progress log for a group playing through Ocarina of Time together.

The server holds a fixed list of everything in the game: every item, song, mask, dungeon step, heart piece and Gold Skulltula, with where it is and how to get it. Nobody adds entries; players only tick them. An entry shows up on the site once at least one player has ticked it, so the site never shows what nobody has found.

## How it works

- **One entry per step.** A mask is three steps: get it, deliver it, pay for it at the shop. Each is its own entry, and each player ticks steps on their own.
- **Ticking by hand.** "Mark done" ticks a named thing (a song, an item, a dungeon step). Anything already on the site can be ticked from its card.
- **Ticking from a save.** Heart pieces, Gold Skulltulas, Big Poes, bottles and bag upgrades only come from a save sync, which ticks them by key (see below).
- **No spoilers.** Steps you haven't done appear only as "Heart Piece · done by Bea". Click Reveal to see one.
- **Scoreboard.** Counts per player per category.
- **No accounts.** Each device remembers which player is using it. The data is open to anyone with the URL, which is fine for a group of friends.

## The catalog

`convex/catalog.ts` builds the list. Named things come from `src/gamedata.ts`, and countable ones from `convex/catalogData.ts` (generated from the save sync's map data; spoilers). Each entry has a key:

| Key | What |
| --- | --- |
| `Song\|Bolero of Fire\|Learned` | a named thing's step: category, subject, action |
| `gs:<map id>`, `hp:<map id>` | a placed Gold Skulltula or Heart Piece |
| `hp:<flag>`, `up:<flag>` | a heart piece or bag upgrade given as a reward |
| `poe:01`…`poe:10` | the Big Poes |
| `hp:graveyard-grave-chest`, `bottle:cucco-lady`… | things a save can't point at yet |

After changing the catalog, run `npx convex run catalog:seed` (add `--prod` for the live site). It inserts new entries and updates the text of existing ones. Fix one entry's text with `npx convex run steps:update '{"key": "...", "how": "..."}'`.

## Sync API

The [`sync/`](sync/README.md) folder has a ready-made save sync for Hookshot saves: set your name and save folder, and it ticks everything for you.

A save sync calls the public mutation `steps:tick` with `{ "player": "Name", "keys": [...] }`. Keys the player already has are skipped. It returns `{ ticked, unknown }`: what was new, and the keys the catalog doesn't have. `steps:list` returns the ticked entries (each with its `key`) and all ticks.

## Stack

Vite, React, and [Convex](https://convex.dev) for the database, hosted on Vercel.

## Setup

```sh
npm install
npx convex dev        # logs in, creates the Convex project, writes .env.local
npx convex run catalog:seed
npm run dev           # in a second terminal
```

### Deploy to Vercel

1. In the Convex dashboard, open the project's **production** deployment, go to Settings, and click **Generate Production Deploy Key**.
2. Import this repo in Vercel (or run `vercel link`), then add the key as the environment variable `CONVEX_DEPLOY_KEY`.
3. Deploy. `vercel.json` runs `npx convex deploy --cmd 'npm run build'`, which pushes the Convex functions and builds the site with the right `VITE_CONVEX_URL`.
