import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import MAPS from "../public/maps/maps.json";
import { useLocal } from "./storage";

type Age = "child" | "adult";
type MapImage = { src: string; w: number; h: number };
type Area = { id: string; name: string; child?: MapImage; adult?: MapImage };
type View = { x: number; y: number; scale: number };

const AREAS = MAPS as Area[];
const MAX_ZOOM = 6;

/** The game's own area maps (extracted from its UI textures). Drag to move, wheel or pinch to zoom. */
export function MapView() {
  const [areaId, setAreaId] = useLocal<string>("map-area", AREAS[0].id);
  const [age, setAge] = useLocal<Age>("map-age", "child");
  const area = AREAS.find((a) => a.id === areaId) ?? AREAS[0];
  const shownAge: Age = area[age] ? age : age === "child" ? "adult" : "child";
  const image = area[shownAge]!;

  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const fitScale = useRef(1);

  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const s = Math.min(el.clientWidth / image.w, el.clientHeight / image.h) * 0.95;
    fitScale.current = s;
    setView({ scale: s, x: (el.clientWidth - image.w * s) / 2, y: (el.clientHeight - image.h * s) / 2 });
  }, [image]);
  useLayoutEffect(fit, [fit]);

  /** Zoom by `factor`, keeping the point (px, py) of the box still. */
  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    const v = viewRef.current;
    const scale = Math.min(MAX_ZOOM, Math.max(fitScale.current * 0.5, v.scale * factor));
    const k = scale / v.scale;
    setView({ scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
  }, []);

  // Wheel zoom needs a non-passive listener so the page doesn't scroll.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Pointers: one drags, two pinch.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onMove = (e: React.PointerEvent) => {
    const ps = pointers.current;
    const prev = ps.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    if (ps.size === 1) {
      const v = viewRef.current;
      setView({ ...v, x: v.x + next.x - prev.x, y: v.y + next.y - prev.y });
    } else if (ps.size === 2) {
      const other = [...ps.entries()].find(([id]) => id !== e.pointerId)![1];
      const r = e.currentTarget.getBoundingClientRect();
      const before = Math.hypot(prev.x - other.x, prev.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      if (before > 0) zoomAt(after / before, (next.x + other.x) / 2 - r.left, (next.y + other.y) / 2 - r.top);
    }
    ps.set(e.pointerId, next);
  };
  const onUp = (e: React.PointerEvent) => pointers.current.delete(e.pointerId);
  const center = (factor: number) => {
    const el = box.current;
    if (el) zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2);
  };

  return (
    <section className="map-view">
      <div className="journal-row">
        <select className="map-area" value={area.id} onChange={(e) => setAreaId(e.target.value)} aria-label="Area">
          {AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <div className="segmented">
          {(["child", "adult"] as const).map((a) => (
            <button key={a} type="button" className={shownAge === a ? "active" : ""} disabled={!area[a]} onClick={() => setAge(a)}>
              {a === "child" ? "Child" : "Adult"}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={box}
        className="map-box"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          zoomAt(2, e.clientX - r.left, e.clientY - r.top);
        }}
      >
        <img
          key={image.src}
          src={`/maps/${image.src}`}
          alt={`Map of ${area.name} (${shownAge})`}
          width={image.w}
          height={image.h}
          draggable={false}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        />
        <div className="map-zoom">
          <button type="button" className="btn" onClick={() => center(1.5)} aria-label="Zoom in">
            +
          </button>
          <button type="button" className="btn" onClick={() => center(1 / 1.5)} aria-label="Zoom out">
            −
          </button>
          <button type="button" className="btn" onClick={fit} aria-label="Fit the map">
            Fit
          </button>
        </div>
      </div>
    </section>
  );
}
