import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // One minute, self-contained step someone in the group did. Nothing is pre-seeded:
  // the list only grows from what players log themselves.
  steps: defineTable({
    createdBy: v.string(),
    category: v.string(), // "Heart Piece", "Mask", ...
    subject: v.string(), // "Keaton Mask", "Heart Piece"
    action: v.string(), // "Got it", "Delivered", "Paid at shop"
    location: v.string(),
    how: v.string(),
    age: v.string(), // "Child" | "Adult" | ""
  }).index("by_subject", ["category", "subject"]),
  // Who has done which step. Each player checks steps off independently;
  // nothing is ever inferred from other steps.
  progress: defineTable({
    stepId: v.id("steps"),
    player: v.string(),
  })
    .index("by_step", ["stepId"])
    .index("by_step_player", ["stepId", "player"]),
});
