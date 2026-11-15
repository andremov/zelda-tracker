import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

type Slide = { area: Area; age: Age };
type Props = {
  steps: CountedStep[];
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
const allSlides = (): Slide[] => AREAS.flatMap((area) => (["child", "adult"] as const).filter((age) => area[age]).map((age) => ({ area, age })));

/** A hands-off tour of the maps: one a minute, panned edge to edge, with the area's collectibles popping in and out. */
export function Showcase({ steps, doneBy, placeOf }: Props) {
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
      <ShowcaseSlide key={`${index}-${slide.area.id}-${slide.age}`} slide={slide} steps={steps} doneBy={doneBy} placeOf={placeOf} />
    </section>
  );
}

function ShowcaseSlide({ slide, steps, doneBy, placeOf }: { slide: Slide } & Props) {
  const { area, age } = slide;
  const image = area[age]!;
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

  // This area's heart pieces and skulltulas at this age (no age: either), only those somebody has ticked.
  const entries = useMemo(() => {
    const places = AREA_PLACES[area.id] ?? [];
    return COUNTED.flatMap((category) =>
      steps
        .filter((s) => s.category === category && places.includes(placeOf(s.location)) && (!s.age || s.age.toLowerCase() === age))
        .map((s) => ({ step: s, who: doneBy.get(s._id) ?? [] }))
        .filter((e) => e.who.length > 0),
    );
  }, [area, age, steps, doneBy, placeOf]);

  // Pages: as few entries per page as fit the time, stacked in one column so they never overlap.
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
        <span>{age === "child" ? "Child" : "Adult"}</span>
      </div>

      <div className="showcase-entries">
        {entries.length === 0 && t >= 0 && t < span && <div className="showcase-entry empty">Nothing found here yet</div>}
        {page?.map(({ step, who }, i) => (
          <div
            key={`${pageIndex}-${step._id}`}
            className={`showcase-entry ${leaving ? "leaving" : ""}`}
            style={{ animationDelay: leaving ? "0ms" : `${i * 250}ms` }}
          >
            <div className="showcase-entry-head">
              <Icon name={categoryIcon(step.category)} size={20} />
              <span className="eyebrow">{step.category}</span>
              {placeOf(step.location) !== area.name && <span className="showcase-place">{step.location}</span>}
            </div>
            <p>{step.how || "No description yet"}</p>
            <div className="stamps">
              {who.map((p) => (
                <span key={p} className="stamp">
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
