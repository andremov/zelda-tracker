import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

const fields = {
  category: v.string(),
  subject: v.string(),
  action: v.string(),
  location: v.string(),
  how: v.string(),
  age: v.string(),
};

const clean = (s: string) => s.trim().slice(0, 500);

// You can't complete a dungeon without entering it or (where it has one) its boss key.
// Keep in sync with COMPLETION_IMPLIES in src/gamedata.ts.
const COMPLETION_IMPLIES = ["Entered", "Got the boss key"];

/** Give a player progress on a step, plus whatever that step implies. Only ticks entries that already exist. */
async function giveProgress(ctx: MutationCtx, step: Doc<"steps">, player: string) {
  const targets = [step];
  if (step.category === "Dungeon" && step.action === "Completed") {
    const siblings = await ctx.db
      .query("steps")
      .withIndex("by_subject", (q) => q.eq("category", step.category).eq("subject", step.subject))
      .collect();
    targets.push(...siblings.filter((s) => COMPLETION_IMPLIES.includes(s.action)));
  }
  for (const t of targets) {
    const has = await ctx.db
      .query("progress")
      .withIndex("by_step_player", (q) => q.eq("stepId", t._id).eq("player", player))
      .unique();
    if (!has) await ctx.db.insert("progress", { stepId: t._id, player });
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const steps = await ctx.db.query("steps").collect();
    const progress = await ctx.db.query("progress").collect();
    return { steps, progress };
  },
});

export const add = mutation({
  args: { player: v.string(), ...fields },
  handler: async (ctx, { player, ...f }) => {
    const p = clean(player);
    if (!p || !clean(f.category) || !clean(f.subject) || !clean(f.action)) {
      throw new Error("Player, category, subject and step are required");
    }
    const stepId = await ctx.db.insert("steps", {
      createdBy: p,
      category: clean(f.category),
      subject: clean(f.subject),
      action: clean(f.action),
      location: clean(f.location),
      how: clean(f.how),
      age: clean(f.age),
    });
    await giveProgress(ctx, (await ctx.db.get(stepId))!, p);
    return stepId;
  },
});

export const update = mutation({
  args: { id: v.id("steps"), ...fields },
  handler: async (ctx, { id, ...f }) => {
    await ctx.db.patch(id, {
      category: clean(f.category),
      subject: clean(f.subject),
      action: clean(f.action),
      location: clean(f.location),
      how: clean(f.how),
      age: clean(f.age),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("steps") },
  handler: async (ctx, { id }) => {
    const rows = await ctx.db
      .query("progress")
      .withIndex("by_step", (q) => q.eq("stepId", id))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
    await ctx.db.delete(id);
  },
});

export const setDone = mutation({
  args: { stepId: v.id("steps"), player: v.string(), done: v.boolean() },
  handler: async (ctx, { stepId, player, done }) => {
    const p = clean(player);
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_step_player", (q) => q.eq("stepId", stepId).eq("player", p))
      .unique();
    if (done) {
      const step = await ctx.db.get(stepId);
      if (step) await giveProgress(ctx, step, p);
    }
    if (!done && existing) await ctx.db.delete(existing._id);
  },
});
