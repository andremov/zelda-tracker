import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

/**
 * Give logged entries their catalog keys. Entries that turn out to be the same thing are merged:
 * their ticks move onto the first one and the rest are deleted. Run catalog:seed afterwards.
 */
export const toCatalog = internalMutation({
  args: { pairs: v.array(v.object({ id: v.id("steps"), key: v.string() })) },
  handler: async (ctx, { pairs }) => {
    const log: string[] = [];
    for (const { id, key } of pairs) {
      const step = await ctx.db.get(id);
      if (!step) {
        log.push(`${id} is gone`);
        continue;
      }
      const into = await ctx.db
        .query("steps")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (!into || into._id === id) {
        await ctx.db.patch(id, { key });
        continue;
      }
      for (const r of await ctx.db.query("progress").withIndex("by_step", (q) => q.eq("stepId", id)).collect()) {
        const has = await ctx.db
          .query("progress")
          .withIndex("by_step_player", (q) => q.eq("stepId", into._id as Id<"steps">).eq("player", r.player))
          .unique();
        if (!has) await ctx.db.insert("progress", { stepId: into._id, player: r.player });
        await ctx.db.delete(r._id);
      }
      await ctx.db.delete(id);
      log.push(`merged ${id} (${step.location} | ${step.how}) into ${key}`);
    }
    return log;
  },
});
