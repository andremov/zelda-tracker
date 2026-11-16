import { useLayoutEffect, useRef, useState } from "react";
import type { Doc } from "../convex/_generated/dataModel";
import { useLocal } from "./storage";
import { Icon } from "./icons";
import { BOSS_DUNGEONS, DUNGEON_ICON, DUNGEON_STEPS, SET_COLOR } from "./gamedata";

type Step = Doc<"steps">;
type Mode = "story" | "full";

const key = (category: string, subject: string, action: string) => `${category}|${subject}|${action}`;

/** The steps that move the story along: entering and beating every boss dungeon and Ganon's Castle. */
const STORY: string[] = [...BOSS_DUNGEONS, "Ganon's Castle"].flatMap((d) =>
  (DUNGEON_STEPS[d] ?? []).filter((a) => a === "Entered" || a === "Got the boss key" || a === "Completed").map((a) => key("Dungeon", d, a)),
);

/** Where on the story line each boss dungeon is done, if they're played in order. Ganon's Castle is the finish. */
const MILESTONES = BOSS_DUNGEONS.map((d) => ({ dungeon: d, at: (STORY.indexOf(key("Dungeon", d, "Completed")) + 1) / STORY.length }));

/** How far along a player is, from 0 to 1. 100% is every entry in the catalog (`total`, from the server). */
function progress(mode: Mode, done: Step[], total: number) {
  if (mode === "story") {
    const have = new Set(done.map((s) => key(s.category, s.subject, s.action)));
    return STORY.filter((k) => have.has(k)).length / STORY.length;
  }
  return total ? Math.min(1, done.filter((s) => s.key).length / total) : 0;
}

/** Has this player ticked every entry in the catalog? */
export const isComplete = (done: Step[], total: number) => progress("full", done, total) >= 1;

const BUBBLE_H = 30;
const ROW = 38; // bubble plus the gap to the next row
const NEAR = 22; // from the line to the first row, clear of the milestones
const GAP = 8;

type Placed = { name: string; frac: number; champion: boolean; x: number; left: number; row: number; above: boolean };

/** Spread bubbles into rows so none overlap. Each bubble sits over its runner, nudged inside the track. */
function place(runners: { name: string; frac: number; champion: boolean; above: boolean }[], width: number, widths: Map<string, number>) {
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

export function Race({
  players,
  me,
  steps,
  doneBy,
  total,
}: {
  players: string[];
  me: string;
  steps: Step[];
  doneBy: Map<string, string[]>;
  total: number;
}) {
  const [mode, setMode] = useLocal<Mode>("race-mode", "story");
  const trackRef = useRef<HTMLDivElement>(null);
  const bubbleRefs = useRef(new Map<string, HTMLSpanElement>());
  const [size, setSize] = useState<{ width: number; widths: Map<string, number> }>({ width: 0, widths: new Map() });

  const scores = players.map((name) => {
    const done = steps.filter((s) => doneBy.get(s._id)?.includes(name));
    return { name, frac: progress(mode, done, total), champion: isComplete(done, total) };
  });
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
          {mode === "full" &&
            [0.25, 0.5, 0.75].map((t) => <span key={t} className="race-tick" style={{ left: `${t * 100}%` }} />)}
        </div>
        {mode === "story" &&
          MILESTONES.map((m) => (
            <span
              key={m.dungeon}
              className="milestone"
              style={{ left: `${m.at * 100}%`, top: lineY, background: SET_COLOR[m.dungeon] }}
              title={m.dungeon}
            >
              <Icon name={DUNGEON_ICON[m.dungeon] ?? "door"} size={12} />
            </span>
          ))}
        <svg className="race-goal" viewBox="0 0 24 21" style={{ top: lineY - 10 }} aria-hidden="true">
          <path d="M12 1 17.5 10.5H6.5zM6.5 10.5 12 20H1zM17.5 10.5 23 20H12z" />
        </svg>
        {placed.map((p) => {
          const top = p.above ? lineY - NEAR - BUBBLE_H - p.row * ROW : lineY + NEAR + p.row * ROW;
          const stemTop = p.above ? top + BUBBLE_H : lineY;
          const stemBottom = p.above ? lineY : top;
          return (
            <div key={p.name} className={`runner ${p.above ? "leader" : ""} ${p.name === me ? "is-me" : ""} ${p.champion ? "champion" : ""}`}>
              <span className="race-stem" style={{ left: p.x, top: stemTop, height: stemBottom - stemTop }} />
              <span className="race-dot" style={{ left: p.x, top: lineY }} />
              <span
                ref={(el) => {
                  if (el) bubbleRefs.current.set(p.name, el);
                  else bubbleRefs.current.delete(p.name);
                }}
                className={`bubble ${p.above ? "up" : "down"}`}
                style={{ left: p.left, top, ["--tail" as string]: `${p.x - p.left}px` }}
                title={p.champion ? `${p.name}: 100% complete` : `${p.name}: ${Math.round(p.frac * 100)}%`}
              >
                {p.champion && (
                  <svg className="champion-mark" viewBox="0 0 24 21" aria-label="100% complete">
                    <path d="M12 1 17.5 10.5H6.5zM6.5 10.5 12 20H1zM17.5 10.5 23 20H12z" />
                  </svg>
                )}
                {p.name}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
