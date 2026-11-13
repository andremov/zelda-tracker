import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { impliedBy, impliersOf, type StepKey } from "./links";
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

async function findSteps(ctx: MutationCtx, k: StepKey) {
  return (
    await ctx.db
      .query("steps")
      .withIndex("by_subject", (q) => q.eq("category", k.category).eq("subject", k.subject))
      .collect()
  ).filter((s) => s.action === k.action);
}

/** Give a player progress on a step, plus whatever that step implies. Only ticks entries that already exist. */
async function giveProgress(ctx: MutationCtx, step: Doc<"steps">, player: string) {
  const targets = [step];
  for (const k of impliedBy(step)) targets.push(...(await findSteps(ctx, k)));
  for (const t of targets) {
    const has = await ctx.db
      .query("progress")
      .withIndex("by_step_player", (q) => q.eq("stepId", t._id).eq("player", player))
      .unique();
    if (!has) await ctx.db.insert("progress", { stepId: t._id, player });
  }
}

/** Remove a player's progress on a step; an entry nobody has done anymore is removed. */
async function takeProgress(ctx: MutationCtx, stepId: Id<"steps">, player: string) {
  const mine = await ctx.db
    .query("progress")
    .withIndex("by_step_player", (q) => q.eq("stepId", stepId).eq("player", player))
    .unique();
  if (!mine) return;
  await ctx.db.delete(mine._id);
  const left = await ctx.db
    .query("progress")
    .withIndex("by_step", (q) => q.eq("stepId", stepId))
    .first();
  if (!left) await ctx.db.delete(stepId);
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
    const step = (await ctx.db.get(stepId))!;
    await giveProgress(ctx, step, p);
    // Anyone who already did something that counts as this step gets it too.
    for (const k of impliersOf(step)) {
      for (const source of await findSteps(ctx, k)) {
        const rows = await ctx.db
          .query("progress")
          .withIndex("by_step", (q) => q.eq("stepId", source._id))
          .collect();
        for (const r of rows) await giveProgress(ctx, step, r.player);
      }
    }
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

export const setDone = mutation({
  args: { stepId: v.id("steps"), player: v.string(), done: v.boolean() },
  handler: async (ctx, { stepId, player, done }) => {
    const p = clean(player);
    if (done) {
      const step = await ctx.db.get(stepId);
      if (step) await giveProgress(ctx, step, p);
    }
    if (!done) {
      const step = await ctx.db.get(stepId);
      if (!step) return;
      // Undoing a step also undoes whatever counts as it (the fountain for its gift, Completed for Entered).
      const targets = [step];
      for (const k of impliersOf(step)) targets.push(...(await findSteps(ctx, k)));
      for (const t of targets) await takeProgress(ctx, t._id, p);
    }
  },
});
