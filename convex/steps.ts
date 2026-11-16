import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { impliedBy, impliersOf, POSTGAME, type StepKey } from "./links";
import { v } from "convex/values";

const clean = (s: string) => s.trim().slice(0, 500);

async function findSteps(ctx: MutationCtx, k: StepKey) {
  return (
    await ctx.db
      .query("steps")
      .withIndex("by_subject", (q) => q.eq("category", k.category).eq("subject", k.subject))
      .collect()
  ).filter((s) => s.action === k.action);
}

/** Give a player progress on a step, plus whatever that step implies. True if anything was new. */
async function giveProgress(ctx: MutationCtx, step: Doc<"steps">, player: string) {
  const targets = [step];
  for (const k of impliedBy(step)) targets.push(...(await findSteps(ctx, k)));
  let added = false;
  for (const t of targets) {
    const has = await ctx.db
      .query("progress")
      .withIndex("by_step_player", (q) => q.eq("stepId", t._id).eq("player", player))
      .unique();
    if (!has) {
      await ctx.db.insert("progress", { stepId: t._id, player });
      added = true;
    }
  }
  return added;
}

async function takeProgress(ctx: MutationCtx, stepId: Id<"steps">, player: string) {
  const mine = await ctx.db
    .query("progress")
    .withIndex("by_step_player", (q) => q.eq("stepId", stepId).eq("player", player))
    .unique();
  if (mine) await ctx.db.delete(mine._id);
}

/**
 * The entries someone has ticked, each with who ticked it first and when, plus all the ticks.
 * Entries nobody has ticked stay on the server, so the site never sees what it hasn't found;
 * it only gets how many entries there are: `total` for 100%, `postgameTotal` for the Hall of Fallen Foes.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const progress = (await ctx.db.query("progress").collect()).sort((a, b) => a._creationTime - b._creationTime);
    const first = new Map<Id<"steps">, Doc<"progress">>();
    for (const p of progress) if (!first.has(p.stepId)) first.set(p.stepId, p);
    const steps = [];
    for (const [id, p] of first) {
      const s = await ctx.db.get(id);
      if (s) steps.push({ ...s, firstBy: p.player, firstAt: p._creationTime });
    }
    const keyed = (await ctx.db.query("steps").collect()).filter((s) => s.key);
    const postgameTotal = keyed.filter((s) => POSTGAME.includes(s.category)).length;
    return { steps, progress, total: keyed.length - postgameTotal, postgameTotal };
  },
});

/**
 * Tick catalog entries by key for a player (what a save sync calls). Already-ticked keys are skipped.
 * Returns what was new for the player ("category | subject | action | place | how") and the keys the catalog doesn't have.
 */
export const tick = mutation({
  args: { player: v.string(), keys: v.array(v.string()) },
  handler: async (ctx, { player, keys }) => {
    const p = clean(player);
    if (!p) throw new Error("Player is required");
    const ticked: string[] = [];
    const unknown: string[] = [];
    for (const key of new Set(keys)) {
      const step = await ctx.db
        .query("steps")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();
      if (!step) unknown.push(key);
      else if (await giveProgress(ctx, step, p)) {
        ticked.push([step.category, step.subject, step.action, step.location, step.how].filter(Boolean).join(" | "));
      }
    }
    return { ticked, unknown };
  },
});

/** Tick or untick an entry from the site. Unticking also unticks what counts as it (Completed for Entered…). */
export const setDone = mutation({
  args: { stepId: v.id("steps"), player: v.string(), done: v.boolean() },
  handler: async (ctx, { stepId, player, done }) => {
    const p = clean(player);
    const step = await ctx.db.get(stepId);
    if (!p || !step) return;
    if (done) {
      await giveProgress(ctx, step, p);
      return;
    }
    const targets = [step];
    for (const k of impliersOf(step)) targets.push(...(await findSteps(ctx, k)));
    for (const t of targets) await takeProgress(ctx, t._id, p);
  },
});

/** Fix an entry's text by hand: `npx convex run steps:update '{"key": "...", "how": "..."}'`. */
export const update = internalMutation({
  args: { key: v.string(), location: v.optional(v.string()), how: v.optional(v.string()), age: v.optional(v.string()) },
  handler: async (ctx, { key, ...f }) => {
    const step = await ctx.db
      .query("steps")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (!step) throw new Error("No entry with key " + key);
    await ctx.db.patch(step._id, Object.fromEntries(Object.entries(f).filter(([, x]) => x !== undefined)));
  },
});
