import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Every step in the game, seeded from the catalog (convex/catalog.ts). Nobody adds entries: players only tick them.
  // An entry nobody has ticked yet is hidden from the site.
  steps: defineTable({
    key: v.optional(v.string()), // catalog key: "Song|Bolero of Fire|Learned", "gs:<map id>", "hp:<flag>"...
    createdBy: v.optional(v.string()), // who logged it, from before the catalog
    category: v.string(), // "Heart Piece", "Mask", ...
    subject: v.string(), // "Keaton Mask", "Heart Piece"
    action: v.string(), // "Got it", "Delivered", "Paid at shop"
    location: v.string(),
    how: v.string(),
    age: v.string(), // "Child" | "Adult" | ""
  })
    .index("by_subject", ["category", "subject"])
    .index("by_key", ["key"]),
  // Who has done which step. Each player checks steps off independently.
  progress: defineTable({
    stepId: v.id("steps"),
    player: v.string(),
  })
    .index("by_step", ["stepId"])
    .index("by_step_player", ["stepId", "player"]),
});
