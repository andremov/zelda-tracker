import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import MAPS from "../public/maps/maps.json";
import { useLocal } from "./storage";
import { Icon, categoryIcon } from "./icons";

export type Age = "child" | "adult";
export type MapImage = { src: string; w: number; h: number };
export type Area = { id: string; name: string; child?: MapImage; adult?: MapImage };
type View = { x: number; y: number; scale: number };

export const AREAS = MAPS as Area[];
const MAX_ZOOM = 6;

/** The places (as the journal names them) each map covers: the area itself and the buildings in it. */
export const AREA_PLACES: Record<string, string[]> = {
  KokiriForest: ["Kokiri Forest", "Link's House", "Mido's House", "Saria's House", "Know-It-All Brothers' House", "House of Twins", "Kokiri Shop", "Kokiri Training Area", "Deku Tree Meadow"],
  LostWood: ["Lost Woods", "Lost Woods Bridge"],
  SacredForestMeadow: ["Sacred Forest Meadow"],
  HyruleField: ["Hyrule Field"],
  LonLonRanch: ["Lon Lon Ranch", "Lon Lon Ranch House", "Lon Lon Ranch Stables", "Lon Lon Ranch Silo"],
  Market: ["Market Entrance", "Market", "Back Alley", "Happy Mask Shop", "Market Bazaar", "Market Potion Shop", "Market Shooting Gallery", "Bombchu Shop", "Bombchu Bowling Alley", "Treasure Chest Game", "Dog Lady's House", "Temple of Time"],
  HyruleCastle: ["Hyrule Castle", "Castle Courtyard", "Hyrule Castle Great Fairy Fountain", "Outside Ganon's Castle", "Ganon's Castle Great Fairy Fountain"],
  KakarikoVillage: ["Kakariko Village", "Impa's House", "Windmill", "House of Skulltula", "Kakariko Bazaar", "Kakariko Potion Shop", "Kakariko Shooting Gallery", "Granny's Potion Shop"],
  Graveyard: ["Kakariko Graveyard", "Dampé's Hut"],
  DeathMountainTrail: ["Death Mountain Trail", "Death Mountain Summit", "Death Mountain Great Fairy Fountain"],
  GoronCity: ["Goron City", "Goron Shop"],
  DeathMountainCrater: ["Death Mountain Crater", "Crater Great Fairy Fountain"],
  ZoraRiver: ["Zora's River"],
  ZoraDomain: ["Zora's Domain", "Zora Shop"],
  ZoraFountain: ["Zora's Fountain", "Zora's Fountain Great Fairy Fountain"],
  LakeHylia: ["Lake Hylia", "Lakeside Laboratory", "Fishing Pond"],
  GerudoValley: ["Gerudo Valley", "Carpenters' Tent"],
  GerudoFortress: ["Gerudo's Fortress", "Thieves' Hideout"],
  HauntedWasteland: ["Haunted Wasteland"],
  DesertColossus: ["Desert Colossus", "Colossus Great Fairy Fountain"],
};
/** What the map counts, in the order shown. */
export const COUNTED = ["Heart Piece", "Gold Skulltula"];
export const PLURAL: Record<string, string> = { "Heart Piece": "Heart Pieces", "Gold Skulltula": "Gold Skulltulas" };

export type CountedStep = { _id: string; category: string; location: string; age: string; how: string };
type Props = {
  steps: CountedStep[];
  player: string;
  doneBy: Map<string, string[]>;
  placeOf: (location: string) => string;
  /** Show the journal filtered to one kind in these places. */
  onOpen: (category: string, places: string[]) => void;
};

/** The game's own area maps (extracted from its UI textures). Drag to move, wheel or pinch to zoom. */
export function MapView({ steps, player, doneBy, placeOf, onOpen }: Props) {
  const [areaId, setAreaId] = useLocal<string>("map-area", AREAS[0].id);
  const [age, setAge] = useLocal<Age>("map-age", "child");
  const area = AREAS.find((a) => a.id === areaId) ?? AREAS[0];
  const shownAge: Age = area[age] ? age : age === "child" ? "adult" : "child";
  const image = area[shownAge]!;

  // Found so far (ticked by anyone) in an area at this age; entries with no age count at both.
  const tallies = (a: Area) =>
    COUNTED.map((category) => {
      const places = AREA_PLACES[a.id] ?? [];
      const found = steps.filter(
        (s) => s.category === category && places.includes(placeOf(s.location)) && (!s.age || s.age.toLowerCase() === shownAge),
      );
      const count = (p: string) => found.filter((s) => doneBy.get(s._id)?.includes(p)).length;
      return { category, places, found: found.length, mine: count(player) };
    });
  const here = tallies(area);

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
  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);

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
        {/* Controls sit on the map; pointer events on them must not pan it. */}
        <div className="map-panel" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          <div className="journal-row">
            <select className="map-area" value={area.id} onChange={(e) => setAreaId(e.target.value)} aria-label="Area">
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {tallies(a).some((t) => t.found) ? ` · ${tallies(a).map((t) => `${t.mine}/${t.found}`).join(" · ")}` : ""}
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
          <div className="map-counts">
            {here.map((t) => (
              <button
                key={t.category}
                type="button"
                className="map-count"
                disabled={!t.found}
                onClick={() => onOpen(t.category, t.places)}
                title={`${PLURAL[t.category]}: ${t.mine} of the ${t.found} found${t.found ? " (show them in the journal)" : ""}`}
                aria-label={`${PLURAL[t.category]}: ${t.mine} of ${t.found}`}
              >
                <Icon name={categoryIcon(t.category)} size={20} />
                <strong>
                  {t.mine}/{t.found}
                </strong>
              </button>
            ))}
          </div>
        </div>
        <div className="map-zoom" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
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
