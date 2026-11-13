// Steps that count as other steps. Used by the backend when someone marks a step done,
// and by the form to explain it. Only entries someone has already logged get ticked.

export type StepKey = { category: string; subject: string; action: string };

/** You can't complete a dungeon without entering it or (where it has one) its boss key. Map and compass are optional. */
export const COMPLETION_IMPLIES = ["Entered", "Got the boss key"];

/** Visiting a Great Fairy is getting her gift, and the other way around. */
const FAIRY_GIFTS: [string, string, string][] = [
  ["Hyrule Castle Great Fairy Fountain", "Item", "Din's Fire"],
  ["Zora's Fountain Great Fairy Fountain", "Item", "Farore's Wind"],
  ["Colossus Great Fairy Fountain", "Item", "Nayru's Love"],
  ["Death Mountain Great Fairy Fountain", "Upgrade", "Magic Meter"],
  ["Crater Great Fairy Fountain", "Upgrade", "Double Magic"],
  ["Ganon's Castle Great Fairy Fountain", "Upgrade", "Double Defense"],
];

/** Pairs of steps that are the same moment, in both directions. */
export const SAME_MOMENT: [StepKey, StepKey][] = FAIRY_GIFTS.map(([fountain, category, gift]) => [
  { category: "Great Fairy", subject: fountain, action: "Got the gift" },
  { category, subject: gift, action: "Got it" },
]);

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
  return out;
}

/** The step that counts the same as this one, if any (for explaining it in the form). */
export function sameMomentAs(step: StepKey): StepKey | undefined {
  for (const [a, b] of SAME_MOMENT) {
    if (same(a, step)) return b;
    if (same(b, step)) return a;
  }
}
