import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const RENAME: Record<string, string> = {
  "Bullet Bag (40)": "Bullet Bag Upgrade",
  "Bullet Bag (50)": "Bullet Bag Upgrade",
  "Quiver (40)": "Quiver Upgrade",
  "Quiver (50)": "Quiver Upgrade",
  "Big Bomb Bag (30)": "Bomb Bag Upgrade",
  "Biggest Bomb Bag (40)": "Bomb Bag Upgrade",
  "Deku Sticks (20)": "Deku Stick Upgrade",
  "Deku Sticks (30)": "Deku Stick Upgrade",
  "Deku Nuts (30)": "Deku Nut Upgrade",
  "Deku Nuts (40)": "Deku Nut Upgrade",
};

/** Sized bag upgrades -> stacking "<thing> Upgrade" entries, merging any that land on the same place. */
export const stackUpgrades = internalMutation({
  args: {},
  handler: async (ctx) => {
    const kept = new Map<string, Id<"steps">>();
    const log: string[] = [];
    for (const step of await ctx.db.query("steps").collect()) {
      const subject = step.category === "Upgrade" ? RENAME[step.subject] : undefined;
      if (!subject) continue;
      const key = `${subject}|${step.action}|${step.location.toLowerCase()}`;
      const into = kept.get(key);
      if (!into) {
        kept.set(key, step._id);
        await ctx.db.patch(step._id, { subject });
        log.push(`${step.subject} @ ${step.location} -> ${subject}`);
        continue;
      }
      // Same upgrade at the same place twice: move the ticks onto the first one.
      for (const r of await ctx.db.query("progress").withIndex("by_step", (q) => q.eq("stepId", step._id)).collect()) {
        const has = await ctx.db
          .query("progress")
          .withIndex("by_step_player", (q) => q.eq("stepId", into).eq("player", r.player))
          .unique();
        if (!has) await ctx.db.insert("progress", { stepId: into, player: r.player });
        await ctx.db.delete(r._id);
      }
      await ctx.db.delete(step._id);
      log.push(`${step.subject} @ ${step.location} merged into ${subject}`);
    }
    return log;
  },
});
