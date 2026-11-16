import { useEffect, useMemo, useRef } from "react";
import type { Doc } from "../convex/_generated/dataModel";
import { useLocal } from "./storage";
import { isComplete } from "./Race";

type Step = Doc<"steps">;
type Progress = Doc<"progress">;

const COLORS = ["#d9b44a", "#f6dc8a", "#3d6534", "#8d2f22", "#f4e8cc", "#a07a2a"];
const PIECES = Array.from({ length: 90 }, (_, i) => ({
  x: Math.random() * 100,
  delay: Math.random() * 2.5,
  fall: 3 + Math.random() * 2.5,
  spin: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540),
  color: COLORS[i % COLORS.length],
  wide: Math.random() < 0.5,
}));

/** A short rising arpeggio and a held chord. Browsers may block sound before the page is clicked; then it's silent. */
function playFanfare() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime + 0.05;
    const note = (freq: number, at: number, len: number, gain = 0.12) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, now + at);
      g.gain.linearRampToValueAtTime(gain, now + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + at + len);
      o.connect(g).connect(ctx.destination);
      o.start(now + at);
      o.stop(now + at + len + 0.05);
    };
    // C major, up two octaves, then a bright held chord
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => note(f, i * 0.11, 0.3));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => note(f, 0.62, 1.6, 0.08));
    setTimeout(() => ctx.close(), 3000);
  } catch {
    /* no audio */
  }
}

/**
 * The celebration when someone ticks every entry in the catalog. Each browser sees it once per player.
 * Add `?fanfare=Name` to the address to see it for anyone.
 */
export function Fanfare({
  players,
  steps,
  progress,
  doneBy,
  total,
}: {
  players: string[];
  steps: Step[];
  progress: Progress[];
  doneBy: Map<string, string[]>;
  total: number;
}) {
  const [seen, setSeen] = useLocal<string[]>("fanfare-seen", []);
  const preview = useMemo(() => new URLSearchParams(location.search).get("fanfare"), []);

  const champions = players
    .filter((name) => isComplete(steps.filter((s) => doneBy.get(s._id)?.includes(name)), total))
    .map((name) => ({ name, at: Math.max(...progress.filter((p) => p.player === name).map((p) => p._creationTime)) }));
  const show = preview ? { name: preview, at: Date.now() } : champions.find((c) => !seen.includes(c.name));

  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!show) return;
    button.current?.focus();
    playFanfare();
  }, [show?.name]);

  if (!show) return null;
  const close = () => {
    if (preview) {
      history.replaceState(null, "", location.pathname);
      location.reload();
    } else setSeen([...seen, show.name]);
  };
  const date = new Date(show.at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fanfare" role="dialog" aria-modal="true" aria-labelledby="fanfare-title" onKeyDown={(e) => e.key === "Escape" && close()}>
      <div className="fanfare-confetti" aria-hidden="true">
        {PIECES.map((p, i) => (
          <span
            key={i}
            style={{
              left: `${p.x}%`,
              background: p.color,
              width: p.wide ? 12 : 7,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.fall}s`,
              ["--spin" as string]: `${p.spin}deg`,
            }}
          />
        ))}
      </div>
      <div className="fanfare-card">
        <svg className="fanfare-triforce" viewBox="0 0 24 21" aria-hidden="true">
          <path d="M12 1 17.5 10.5H6.5zM6.5 10.5 12 20H1zM17.5 10.5 23 20H12z" />
        </svg>
        <p className="fanfare-eyebrow">Hyrule is complete</p>
        <h2 id="fanfare-title" className="fanfare-name">{show.name}</h2>
        <p className="fanfare-score">100%</p>
        <p className="fanfare-line">
          Every entry in the log, done. Finished on {date}.
        </p>
        <button ref={button} type="button" className="btn primary" onClick={close}>
          Hooray!
        </button>
      </div>
    </div>
  );
}
