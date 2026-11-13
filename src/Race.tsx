import { useLayoutEffect, useRef, useState } from "react";
import type { Doc } from "../convex/_generated/dataModel";
import { useLocal } from "./storage";
import {
  BOSS_DUNGEONS,
  DUNGEON_STEPS,
  EQUIPMENT,
  FROGS,
  GREAT_FAIRIES,
  ITEMS,
  MASK_STEPS,
  SONGS,
  TOTALS,
  UPGRADES,
  type Group,
} from "./gamedata";

type Step = Doc<"steps">;
type Mode = "story" | "full";

const key = (category: string, subject: string, action: string) => `${category}|${subject}|${action}`;
const flat = (groups: Group[]) => groups.flatMap((g) => g.items);

/** The steps that move the story along: entering and beating every boss dungeon and Ganon's Castle. */
const STORY: string[] = [...BOSS_DUNGEONS, "Ganon's Castle"].flatMap((d) =>
  (DUNGEON_STEPS[d] ?? []).filter((a) => a === "Entered" || a === "Got the boss key" || a === "Completed").map((a) => key("Dungeon", d, a)),
);

/** Every named step in the game's lists. Countable kinds are added on top, up to their totals. */
const EVERYTHING: string[] = [
  ...Object.entries(DUNGEON_STEPS).flatMap(([d, actions]) => actions.map((a) => key("Dungeon", d, a))),
  ...Object.entries(MASK_STEPS).flatMap(([m, actions]) => actions.map((a) => key("Mask", m, a))),
  ...flat(SONGS).map((s) => key("Song", s, "Learned")),
  ...flat(GREAT_FAIRIES).map((f) => key("Great Fairy", f, "Got the gift")),
  ...flat(ITEMS).map((x) => key("Item", x, "Got it")),
  ...flat(EQUIPMENT).map((x) => key("Equipment", x, "Got it")),
  ...flat(UPGRADES).map((x) => key("Upgrade", x, "Got it")),
  ...flat(FROGS).map((x) => key("Frogs", x, "Played it")),
];
const FULL_TOTAL = EVERYTHING.length + Object.values(TOTALS).reduce((a, b) => a + b, 0);

/** How far along a player is, from 0 to 1. */
function progress(mode: Mode, done: Step[]) {
  const have = new Set(done.map((s) => key(s.category, s.subject, s.action)));
  if (mode === "story") return STORY.filter((k) => have.has(k)).length / STORY.length;
  const named = EVERYTHING.filter((k) => have.has(k)).length;
  const counted = Object.entries(TOTALS).reduce((n, [c, total]) => n + Math.min(total, done.filter((s) => s.category === c).length), 0);
  return (named + counted) / FULL_TOTAL;
}

const BUBBLE_H = 30;
const ROW = 38; // bubble plus the gap to the next row
const NEAR = 16; // from the line to the first row
const GAP = 8;

type Placed = { name: string; frac: number; x: number; left: number; row: number; above: boolean };

/** Spread bubbles into rows so none overlap. Each bubble sits over its runner, nudged inside the track. */
function place(runners: { name: string; frac: number; above: boolean }[], width: number, widths: Map<string, number>) {
  const rowsEnd: Record<string, number[]> = { above: [], below: [] };
  return [...runners]
    .sort((a, b) => a.frac - b.frac)
    .map((r): Placed => {
      const w = widths.get(r.name) ?? 80;
      const x = r.frac * width;
      const left = Math.max(0, Math.min(width - w, x - w / 2));
      const ends = rowsEnd[r.above ? "above" : "below"];
      let row = ends.findIndex((end) => end + GAP <= left);
      if (row < 0) row = ends.length;
      ends[row] = left + w;
      return { ...r, x, left, row };
    });
}

export function Race({ players, me, steps, doneBy }: { players: string[]; me: string; steps: Step[]; doneBy: Map<string, string[]> }) {
  const [mode, setMode] = useLocal<Mode>("race-mode", "story");
  const trackRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef(new Map<string, HTMLSpanElement>());
  const [size, setSize] = useState<{ width: number; widths: Map<string, number> }>({ width: 0, widths: new Map() });

  const scores = players.map((name) => ({ name, frac: progress(mode, steps.filter((s) => doneBy.get(s._id)?.includes(name))) }));
  const best = Math.max(0, ...scores.map((s) => s.frac));
  // The leader goes above the line (everyone tied for first, if it's a tie). Nobody leads at the start line.
  const runners = scores.map((s) => ({ ...s, above: best > 0 && s.frac === best }));

  // Bubble widths depend on the name and the font, so measure them once they're on screen.
  useLayoutEffect(() => {
    const measure = () => {
      const width = trackRef.current?.clientWidth ?? 0;
      const widths = new Map([...bubbleRefs.current].map(([n, el]) => [n, el.offsetWidth]));
      setSize((prev) =>
        prev.width === width && widths.size === prev.widths.size && [...widths].every(([n, w]) => prev.widths.get(n) === w) ? prev : { width, widths },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    for (const el of bubbleRefs.current.values()) ro.observe(el);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [players.join("|")]);

  const placed = place(runners, size.width, size.widths);
  const rowsAbove = Math.max(0, ...placed.filter((p) => p.above).map((p) => p.row + 1));
  const rowsBelow = Math.max(0, ...placed.filter((p) => !p.above).map((p) => p.row + 1));
  const span = (rows: number) => (rows ? NEAR + BUBBLE_H + (rows - 1) * ROW : 8);
  const lineY = span(rowsAbove) + 6;
  const height = lineY + span(rowsBelow) + 6;

  return (
    <section className="frame race" aria-label="Race">
      <header className="race-head">
        <h2 className="side-title">The Race</h2>
        <div className="segmented" role="group" aria-label="Race to">
          <button type="button" className={mode === "story" ? "active" : ""} onClick={() => setMode("story")}>
            Completing the game
          </button>
          <button type="button" className={mode === "full" ? "active" : ""} onClick={() => setMode("full")}>
            100% completion
          </button>
        </div>
      </header>
      <p className="muted small race-note">
        {mode === "story"
          ? "Entering and beating the eight boss dungeons and Ganon's Castle."
          : "Everything on the save log: dungeons, songs, fairies, masks, items, gear, upgrades, frogs, heart pieces, skulltulas, poes and bottles."}
      </p>

      <div className="race-track" ref={trackRef} style={{ height }}>
        <div className="race-line" style={{ top: lineY }}>
          {[0.25, 0.5, 0.75].map((t) => (
            <span key={t} className="race-tick" style={{ left: `${t * 100}%` }} />
          ))}
        </div>
        <svg className="race-goal" viewBox="0 0 24 21" style={{ top: lineY - 10 }} aria-hidden="true">
          <path d="M12 1 17.5 10.5H6.5zM6.5 10.5 12 20H1zM17.5 10.5 23 20H12z" />
        </svg>
        {placed.map((p) => {
          const top = p.above ? lineY - NEAR - BUBBLE_H - p.row * ROW : lineY + NEAR + p.row * ROW;
          const stemTop = p.above ? top + BUBBLE_H : lineY;
          const stemBottom = p.above ? lineY : top;
          return (
            <div key={p.name} className={`runner ${p.above ? "leader" : ""} ${p.name === me ? "is-me" : ""}`}>
              <span className="race-stem" style={{ left: p.x, top: stemTop, height: stemBottom - stemTop }} />
              <span className="race-dot" style={{ left: p.x, top: lineY }} />
              <span
                ref={(el) => {
                  if (el) bubbleRefs.current.set(p.name, el);
                  else bubbleRefs.current.delete(p.name);
                }}
                className={`bubble ${p.above ? "up" : "down"}`}
                style={{ left: p.left, top, ["--tail" as string]: `${p.x - p.left}px` }}
                title={`${p.name}: ${Math.round(p.frac * 100)}%`}
              >
                {p.name}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
