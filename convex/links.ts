// Steps that count as other steps. Used by the backend when someone marks a step done,
// and by the form to explain it. Only entries someone has already logged get ticked.

export type StepKey = { category: string; subject: string; action: string };

/** The catalog key of a named thing's step (see convex/catalog.ts). */
export const stepKey = (category: string, subject: string, action: string) => `${category}|${subject}|${action}`;

/**
 * Kinds there are many of (told apart by place and how), so two entries can look alike and both be real.
 * Every other kind names one specific thing, so there is only ever one entry per thing and step.
 */
export const COUNTABLE = ["Heart Piece", "Gold Skulltula", "Big Poe", "Bottle"];

/** The Hall of Fallen Foes: its own race, kept out of 100%. */
export const POSTGAME = ["Monster Statue", "Rematch Gauntlet"];

/**
 * Capacity upgrades that stack: each place gives the next size, whichever you visit first.
 * Logged as "<thing> Upgrade" with the place; one entry per place, and the count is the bag size.
 * Value: how many there are in the game.
 */
export const STACKING: Record<string, number> = {
  "Bullet Bag Upgrade": 2,
  "Quiver Upgrade": 2,
  "Bomb Bag Upgrade": 2,
  "Deku Stick Upgrade": 2,
  "Deku Nut Upgrade": 2,
};

/** You can't complete a dungeon without entering it or (where it has one) its boss key. Map and compass are optional. */
export const COMPLETION_IMPLIES = ["Entered", "Got the boss key"];

/** Visiting a Great Fairy is getting her gift, and the other way around. */
const FAIRY_GIFTS: [string, string, string][] = [
  ["Hyrule Castle Great Fairy Fountain", "Item", "Din's Fire"],
  ["Zora's Fountain Great Fairy Fountain", "Item", "Farore's Wind"],
  ["Colossus Great Fairy Fountain", "Item", "Nayru's Love"],
  ["Crater Great Fairy Fountain", "Upgrade", "Double Magic"],
  ["Ganon's Castle Great Fairy Fountain", "Upgrade", "Double Defense"],
];

/** Pairs of steps that are the same moment, in both directions. */
export const SAME_MOMENT: [StepKey, StepKey][] = FAIRY_GIFTS.map(([fountain, category, gift]) => [
  { category: "Great Fairy", subject: fountain, action: "Got the gift" },
  { category, subject: gift, action: "Got it" },
]);

/**
 * Things that come in sizes or tiers: getting a later one means you got the earlier ones first.
 * One way only: logging the bigger bag ticks the smaller one, not the other way around.
 */
const TIERS: [string, string[]][] = [
  ["Upgrade", ["Adult's Wallet", "Giant's Wallet"]],
  ["Upgrade", ["Goron's Bracelet", "Silver Gauntlets", "Golden Gauntlets"]],
  ["Upgrade", ["Silver Scale", "Golden Scale"]],
  ["Item", ["Hookshot", "Longshot"]],
];
const got = (category: string, subject: string): StepKey => ({ category, subject, action: "Got it" });

const same = (a: StepKey, b: StepKey) => a.category === b.category && a.subject === b.subject && a.action === b.action;

/** Every step that marking `step` done should also tick. */
export function impliedBy(step: StepKey): StepKey[] {
  const out: StepKey[] = [];
  if (step.category === "Dungeon" && step.action === "Completed") {
    for (const action of COMPLETION_IMPLIES) out.push({ category: "Dungeon", subject: step.subject, action });
  }
  for (const [a, b] of SAME_MOMENT) {
    if (same(a, step)) out.push(b);
    if (same(b, step)) out.push(a);
  }
  for (const [category, tiers] of TIERS) {
    const i = step.action === "Got it" && step.category === category ? tiers.indexOf(step.subject) : -1;
    for (const lower of tiers.slice(0, Math.max(i, 0))) out.push(got(category, lower));
  }
  return out;
}

/** Every step that, when done, counts as `step` too (the reverse of impliedBy). */
export function impliersOf(step: StepKey): StepKey[] {
  const out: StepKey[] = [];
  if (step.category === "Dungeon" && COMPLETION_IMPLIES.includes(step.action)) {
    out.push({ category: "Dungeon", subject: step.subject, action: "Completed" });
  }
  for (const [a, b] of SAME_MOMENT) {
    if (same(a, step)) out.push(b);
    if (same(b, step)) out.push(a);
  }
  for (const [category, tiers] of TIERS) {
    const i = step.action === "Got it" && step.category === category ? tiers.indexOf(step.subject) : -1;
    if (i >= 0) for (const higher of tiers.slice(i + 1)) out.push(got(category, higher));
  }
  return out;
}

/** The step that counts the same as this one, if any (for explaining it in the form). */
export function sameMomentAs(step: StepKey): StepKey | undefined {
  for (const [a, b] of SAME_MOMENT) {
    if (same(a, step)) return b;
    if (same(b, step)) return a;
  }
}
