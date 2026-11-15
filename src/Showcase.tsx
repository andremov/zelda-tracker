import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { AREAS, AREA_PLACES, COUNTED, type Age, type Area, type CountedStep } from "./MapView";
import { Icon, categoryIcon } from "./icons";

/** How long each map is shown, in ms. The CSS animations in style.css use the same length (--showcase-slide). */
const SLIDE_MS = 60_000;

/** Entries pop in after the title and are all gone just before the map changes (fractions of the slide). */
const ENTRIES_FROM = 0.1;
const ENTRIES_TO = 0.95;
/** Each page of entries stays at least this long; past that, more entries share a page (stacked, up to MAX_STACK). */
const MIN_PAGE_MS = 7_000;
const MAX_STACK = 4;
const LEAVE_MS = 600;

/** "either": the area's child and adult maps are the same picture, so it plays once with both ages' entries. */
type Slide = { area: Area; age: Age | "either" };
type Props = {
  steps: CountedStep[];
  /** Everyone in the group: each card is wide enough for all their stamps on one row. */
  players: string[];
  doneBy: Map<string, string[]>;
  placeOf: (location: string) => string;
};

const shuffle = <T,>(xs: T[]) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const allSlides = (): Slide[] =>
  AREAS.flatMap((area): Slide[] =>
    area.child && area.adult && area.child.src === area.adult.src
      ? [{ area, age: "either" }]
      : (["child", "adult"] as const).filter((age) => area[age]).map((age) => ({ area, age })),
  );

/** A hands-off tour of the maps: one a minute, panned edge to edge, with the area's collectibles popping in and out. */
export function Showcase({ steps, players, doneBy, placeOf }: Props) {
  const [deck, setDeck] = useState(() => shuffle(allSlides()));
  const [index, setIndex] = useState(0);
  const slide = deck[index];

  useEffect(() => {
    const t = setTimeout(() => {
      if (index + 1 < deck.length) setIndex(index + 1);
      else {
        // New round: reshuffle, without showing the same map twice in a row.
        let next = shuffle(allSlides());
        if (next[0].area.id === slide.area.id && next[0].age === slide.age) next = [...next.slice(1), next[0]];
        setDeck(next);
        setIndex(0);
      }
    }, SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, deck, slide]);

  // Keyed per slide so every animation starts over.
  return (
    <section className="showcase">
      <ShowcaseSlide key={`${index}-${slide.area.id}-${slide.age}`} slide={slide} steps={steps} players={players} doneBy={doneBy} placeOf={placeOf} />
    </section>
  );
}

function ShowcaseSlide({ slide, steps, players, doneBy, placeOf }: { slide: Slide } & Props) {
  const { area, age } = slide;
  const image = (age === "either" ? area.child : area[age])!;
  const box = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState<{ from: string; to: string } | null>(null);
  const [moving, setMoving] = useState(false);

  // Zoom in enough to have room to move, then glide from one random edge to the opposite one.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const s = Math.max(vw / image.w, vh / image.h) * 1.25;
    const w = image.w * s;
    const h = image.h * s;
    const cx = (vw - w) / 2;
    const cy = (vh - h) / 2;
    const at = (x: number, y: number) => `translate(${x}px, ${y}px) scale(${s})`;
    const ends = [
      [at(0, cy), at(vw - w, cy)],
      [at(vw - w, cy), at(0, cy)],
      [at(cx, 0), at(cx, vh - h)],
      [at(cx, vh - h), at(cx, 0)],
    ];
    const [from, to] = ends[Math.floor(Math.random() * ends.length)];
    setPan({ from, to });
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setMoving(true)));
    return () => cancelAnimationFrame(raf);
  }, [image]);

  // This area's heart pieces and skulltulas at this age (no age: either; an "either" slide: all), only those somebody has ticked.
  const entries = useMemo(() => {
    const places = AREA_PLACES[area.id] ?? [];
    return COUNTED.flatMap((category) =>
      steps
        .filter((s) => s.category === category && places.includes(placeOf(s.location)) && (age === "either" || !s.age || s.age.toLowerCase() === age))
        .map((s) => ({ step: s, who: doneBy.get(s._id) ?? [] }))
        .filter((e) => e.who.length > 0),
    );
  }, [area, age, steps, doneBy, placeOf]);

  // Pages: as few entries per page as fit the time; the cards of a page are placed apart so they never overlap.
  const span = (ENTRIES_TO - ENTRIES_FROM) * SLIDE_MS;
  const stack = Math.min(MAX_STACK, Math.max(1, Math.ceil(entries.length / Math.max(1, Math.floor(span / MIN_PAGE_MS)))));
  const pages = Array.from({ length: Math.ceil(entries.length / stack) }, (_, i) => entries.slice(i * stack, (i + 1) * stack));
  const pageMs = pages.length ? span / pages.length : span;
  const [now, setNow] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setNow(performance.now() - start), 200);
    return () => clearInterval(id);
  }, []);
  const t = now - ENTRIES_FROM * SLIDE_MS;
  const pageIndex = t < 0 ? -1 : Math.floor(t / pageMs);
  const page = pages[pageIndex];
  const leaving = !!page && t - pageIndex * pageMs > pageMs - LEAVE_MS;

  return (
    <div className="showcase-slide">
      <div ref={box} className="showcase-map">
        {pan && (
          <img
            src={`/maps/${image.src}`}
            alt=""
            width={image.w}
            height={image.h}
            draggable={false}
            style={{ transform: moving ? pan.to : pan.from, transition: moving ? `transform ${SLIDE_MS}ms cubic-bezier(0.45, 0, 0.55, 1)` : "none" }}
          />
        )}
      </div>

      <div className="showcase-title">
        <h2>{area.name}</h2>
        <span>{age === "either" ? "Either age" : age === "child" ? "Child" : "Adult"}</span>
      </div>

      <Scatter key={pageIndex} durationMs={pageMs} leaving={leaving}>
        {entries.length === 0 && t >= 0 && t < span
          ? [<div key="empty" className="showcase-entry empty">Nothing found here yet</div>]
          : (page ?? []).map(({ step, who }) => (
              <div key={step._id} className="showcase-entry">
                <div className="showcase-entry-head">
                  <Icon name={categoryIcon(step.category)} size={20} />
                  <span className="eyebrow">{step.category}</span>
                  {placeOf(step.location) !== area.name && <span className="showcase-place">{step.location}</span>}
                </div>
                <div className="showcase-entry-body">
                  <p>{step.how || "No description yet"}</p>
                  <div className="stamps">
                    {who.map((p) => (
                      <span key={p} className="stamp">
                        {p}
                      </span>
                    ))}
                  </div>
                  {/* Invisible row of every player's stamp: sets the card's width so a full row always fits. */}
                  <div className="stamps stamps-sizer" aria-hidden="true">
                    {players.map((p) => (
                      <span key={p} className="stamp">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                {/* The title fades out early, so each card says which age it's about. */}
                <div className="showcase-entry-foot">{step.age ? step.age : "Either age"}</div>
              </div>
            ))}
      </Scatter>
    </div>
  );
}

type Spot = { x: number; y: number; dx: number; dy: number; rot: number; drot: number };

/**
 * Lays its children out at random spots whose centers fall in the middle half of the screen, never overlapping,
 * and lets each one drift a little while it's up. Measures the cards first (hidden), then places them.
 */
function Scatter({ children, durationMs, leaving }: { children: ReactElement[]; durationMs: number; leaving: boolean }) {
  const area = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const count = children.length;

  useLayoutEffect(() => {
    const el = area.current;
    if (!el || !count) return;
    const W = el.clientWidth;
    const H = el.clientHeight;
    const GAP = 16;
    const DRIFT = 60; // keep room for the drift so moving cards don't run into each other
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const overlap = (r: { x: number; y: number; w: number; h: number }) =>
      placed.reduce((sum, q) => {
        const ox = Math.min(r.x + r.w, q.x + q.w) + GAP + DRIFT - Math.max(r.x, q.x);
        const oy = Math.min(r.y + r.h, q.y + q.h) + GAP + DRIFT - Math.max(r.y, q.y);
        return sum + (ox > 0 && oy > 0 ? ox * oy : 0);
      }, 0);
    const out: Spot[] = [];
    for (let i = 0; i < count; i++) {
      const w = cards.current[i]?.offsetWidth ?? 340;
      const h = cards.current[i]?.offsetHeight ?? 140;
      let best = { x: 0, y: 0, w, h };
      let bestScore = Infinity;
      for (let tries = 0; tries < 300 && bestScore > 0; tries++) {
        // center somewhere in the middle half, card kept fully on screen
        const cx = W * (0.25 + Math.random() * 0.5);
        const cy = H * (0.25 + Math.random() * 0.5);
        const r = { x: Math.min(Math.max(cx - w / 2, 12), W - w - 12), y: Math.min(Math.max(cy - h / 2, 12), H - h - 12), w, h };
        const score = overlap(r);
        if (score < bestScore) [best, bestScore] = [r, score];
      }
      placed.push(best);
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 30;
      out.push({
        x: best.x,
        y: best.y,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        rot: (Math.random() - 0.5) * 4,
        drot: (Math.random() - 0.5) * 3,
      });
    }
    setSpots(out);
  }, [count]);

  return (
    <div ref={area} className="showcase-scatter">
      {children.map((child, i) => {
        const spot = spots?.[i];
        return (
          <div
            key={child.key}
            ref={(el) => {
              cards.current[i] = el;
            }}
            className="showcase-drift"
            style={
              spot
                ? ({
                    left: spot.x,
                    top: spot.y,
                    "--dx": `${spot.dx}px`,
                    "--dy": `${spot.dy}px`,
                    "--rot": `${spot.rot}deg`,
                    "--drot": `${spot.rot + spot.drot}deg`,
                    animationDuration: `${durationMs}ms`,
                  } as CSSProperties)
                : { visibility: "hidden", left: 0, top: 0, animation: "none" }
            }
          >
            <div className={`showcase-pop ${leaving ? "leaving" : ""}`} style={{ animationDelay: leaving ? "0ms" : `${i * 350}ms` }}>
              {child}
            </div>
          </div>
        );
      })}
    </div>
  );
}
