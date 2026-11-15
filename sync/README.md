# Save sync

Reads your Hookshot save and ticks everything in it on Hyrule Log: items, songs, masks, dungeon steps, Great Fairies, frogs, heart pieces, Gold Skulltulas and Big Poes. It only ticks entries. It never adds, edits or unticks anything, so it can't make duplicates.

It needs Python 3.8 or newer and nothing else.

## Set it up

1. Install Python from [python.org](https://www.python.org/downloads/) if you don't have it.
2. Copy this `sync` folder anywhere (or clone the repo).
3. Find your save folder. It's in your Hookshot folder under `user\save\`, a folder with a long hex name that holds `slot_00` … `slot_05`. For example, `C:\Games\Hookshot\user\save\5a3c9e1f0b7d2468…`.
4. Copy `config.example.json` to `config.json` and fill in:
   - `player`: your name exactly as it appears on the site (same spelling and accents).
   - `save_dir`: that save folder. Use forward slashes (`C:/Games/...`), or double every backslash (`C:\\Games\\...`).
5. Check it reads your save without changing anything:

   ```
   python sync.py --dry-run
   ```

   It lists what it would tick. Run `python sync.py` to tick them for real.

## Keep it running

Leave this open while you play, and it syncs every 5 minutes:

```
python sync.py --every 300
```

Or schedule `python sync.py` every 5 minutes with Task Scheduler. Each run reads the newest save slot, skips it if nothing changed, and writes what it ticked to `sync.log`.

## What it can't see

The save doesn't point at a few things: bottles, and the Deku stick and nut upgrades. Once anyone has ticked one of those, it's on the site, and you can tick it there by hand.

If it logs "the site has no entry for …", tell Andrés. That's something the site's list is missing.

## How it works

Every entry on the site has a key. The script reads your save and sends the keys of everything you have to the site's `steps:tick` endpoint. `savekeys.json` lists the map IDs and flags it looks for, including the save bools of the heart-piece chests (no spoilers), and `roomflags.json` is how it tells you've been inside a dungeon.
