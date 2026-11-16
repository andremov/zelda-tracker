import { internalMutation } from "./_generated/server";
import { COUNTABLE_ENTRIES } from "./catalogData";
import { STACKING, stepKey } from "./links";
import {
  ACQUIRED_AGE,
  ACQUIRED_PLACE,
  DUNGEON_AGE,
  DUNGEON_STEPS,
  EQUIPMENT,
  FALLEN_FOES,
  FROGS,
  GREAT_FAIRIES,
  GREAT_FAIRY_AGE,
  ITEMS,
  MASK_DELIVERY,
  MASK_STEPS,
  SONG_AGE,
  SONG_PLACE,
  SONGS,
  UPGRADES,
  type Group,
} from "../src/gamedata";

/** One entry in the game. Players tick these; nobody adds them. */
export type Entry = { key: string; category: string; subject: string; action: string; location: string; how: string; age: string };

const all = (groups: Group[]) => groups.flatMap((g) => g.items);

/** Named things: one entry per thing and step, keyed "category|subject|action". */
function named(): Entry[] {
  const out: Entry[] = [];
  const add = (category: string, subject: string, action: string, location = "", age = "") =>
    out.push({ key: stepKey(category, subject, action), category, subject, action, location, how: "", age });
  for (const [category, groups] of [
    ["Item", ITEMS],
    ["Equipment", EQUIPMENT],
    ["Upgrade", UPGRADES],
  ] as const) {
    // Stacking bag upgrades are one entry per place (countable, see catalogData.ts).
    for (const s of all(groups)) if (!(s in STACKING)) add(category, s, "Got it", ACQUIRED_PLACE[s], ACQUIRED_AGE[s]);
  }
  for (const s of all(SONGS)) add("Song", s, "Learned", SONG_PLACE[s], SONG_AGE[s]);
  for (const [mask, steps] of Object.entries(MASK_STEPS)) {
    for (const a of steps) add("Mask", mask, a, a === "Delivered" ? MASK_DELIVERY[mask] : "Happy Mask Shop", "Child");
  }
  for (const [dungeon, steps] of Object.entries(DUNGEON_STEPS)) for (const a of steps) add("Dungeon", dungeon, a, dungeon, DUNGEON_AGE[dungeon]);
  for (const f of all(GREAT_FAIRIES)) add("Great Fairy", f, "Got the gift", f, GREAT_FAIRY_AGE[f]);
  for (const s of all(FROGS)) add("Frogs", s, "Played it", "Zora's River", "Child");
  for (const s of all(FALLEN_FOES)) add("Fallen Foes", s, "Completed", "Hall of Fallen Foes");
  return out;
}

export const CATALOG: Entry[] = [...named(), ...COUNTABLE_ENTRIES];

/**
 * Make the steps table match the catalog: insert missing entries, update the text of existing ones.
 * A named entry's "how" is kept when the catalog has none. Run after every catalog change:
 * `npx convex run catalog:seed` (add `--prod` for the live site).
 */
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let updated = 0;
    const keys = new Set<string>();
    for (const e of CATALOG) {
      if (keys.has(e.key)) throw new Error("Duplicate catalog key " + e.key);
      keys.add(e.key);
      const step = await ctx.db
        .query("steps")
        .withIndex("by_key", (q) => q.eq("key", e.key))
        .first();
      if (!step) {
        await ctx.db.insert("steps", e);
        inserted++;
        continue;
      }
      const want = { ...e, how: e.how || step.how };
      if ((["category", "subject", "action", "location", "how", "age"] as const).some((f) => step[f] !== want[f])) {
        await ctx.db.patch(step._id, want);
        updated++;
      }
    }
    // Entries dropped from the catalog go too, unless someone has ticked them.
    let removed = 0;
    for (const s of await ctx.db.query("steps").collect()) {
      if (!s.key || keys.has(s.key)) continue;
      const ticked = await ctx.db
        .query("progress")
        .withIndex("by_step", (q) => q.eq("stepId", s._id))
        .first();
      if (!ticked) {
        await ctx.db.delete(s._id);
        removed++;
      }
    }
    // Anything left over predates the catalog or was ticked before being dropped (see migrations:toCatalog).
    const stray = (await ctx.db.query("steps").collect())
      .filter((s) => !s.key || !keys.has(s.key))
      .map((s) => `${s._id} ${s.key ?? "(no key)"} ${s.category} | ${s.subject} | ${s.action} | ${s.location} | ${s.how}`);
    return { catalog: CATALOG.length, inserted, updated, removed, stray };
  },
});
