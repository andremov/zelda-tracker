import { mutation, query } from "./_generated/server";
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
    await ctx.db.insert("progress", { stepId, player: p });
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
    if (done && !existing) await ctx.db.insert("progress", { stepId, player: p });
    if (!done && existing) await ctx.db.delete(existing._id);
  },
});

