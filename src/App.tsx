import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import type { Doc } from "../convex/_generated/dataModel";
import { useLocal } from "./storage";
import { Race } from "./Race";
import { MapView } from "./MapView";
import { Showcase } from "./Showcase";
import { Fanfare } from "./Fanfare";
import { CATEGORIES, Icon, categoryIcon, categoryInfo } from "./icons";
import { REGIONS } from "./locations";
import {
  BOSS_DUNGEONS,
  DUNGEON_ICON,
  DUNGEON_STEPS,
  DUNGEONS,
  MINI_DUNGEONS,
  EQUIPMENT,
  FALLEN_FOES,
  FROGS,
  GREAT_FAIRIES,
  HEART_PIECES,
  ITEMS,
  MASK_STEPS,
  MASKS,
  SET_COLOR,
  SONGS,
  TOTALS,
  UPGRADES,
  type Group,
} from "./gamedata";
import { sameMomentAs, STACKING, stepKey } from "../convex/links";

/** An entry someone has ticked, with who ticked it first. Entries nobody has ticked never reach the site. */
type Step = FunctionReturnType<typeof api.steps.list>["steps"][number];
type Progress = Doc<"progress">;
/** The tick dialog, opened with a kind (and thing) already picked, or neither. */
type DialogState = { category: string; subject: string } | null;
const NO_PICK = { category: "", subject: "" };
const BASE_HEARTS = 3;
// Start, one container per boss, and every four pieces.
const MAX_HEARTS = BASE_HEARTS + 8 + HEART_PIECES / 4;

const norm = (s: string) => s.trim().toLowerCase();
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));

// The feed's place filter: an entry's place is matched to the map ignoring case; anything else goes under Other.
const OTHER_REGION = "Other";
const MAP_ORDER = REGIONS.flatMap((r) => r.places);
const MAP_PLACE = new Map(MAP_ORDER.map((p) => [norm(p), p]));
const MAP_REGION = new Map(REGIONS.flatMap((r) => r.places.map((p) => [p, r.region] as const)));
const placeOf = (location: string) => MAP_PLACE.get(norm(location)) ?? (location.trim() || "No place");
const regionOfPlace = (place: string) => MAP_REGION.get(place) ?? OTHER_REGION;
/** The journal's age filter. An entry with no age can be done at either age. */
const AGES = ["Child", "Adult", "Either age"];
const ageOf = (s: { age?: string }) => {
  const a = norm(s.age ?? "");
  return a === "child" ? "Child" : a === "adult" ? "Adult" : "Either age";
};
/** A whole region in the filter, kept apart from place names. */
const regionKey = (region: string) => `region:${region}`;
type PlaceGroup = { region: string; places: string[] };
const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function App() {
  const [player, setPlayer] = useLocal<string>("player", "");
  if (!player) return <PickName onPick={setPlayer} />;
  return <Tracker player={player} onSwitch={setPlayer} />;
}

function Ornament() {
  return (
    <svg className="ornament" viewBox="0 0 200 12" aria-hidden="true">
      <path d="M0 6h82M118 6h82" />
      <path d="M100 1l5 5-5 5-5-5 5-5zM88 6l4-3v6l-4-3zM112 6l-4-3v6l4-3z" />
    </svg>
  );
}

function PickName({ onPick }: { onPick: (name: string) => void }) {
  const data = useQuery(api.steps.list);
  const known = uniq(data?.progress.map((p) => p.player) ?? []);
  const [name, setName] = useState("");
  return (
    <main className="pick">
      <div className="frame pick-card">
        <h1 className="brand big">Hyrule Log</h1>
        <Ornament />
        <p className="lede">A shared journal for our journey, written only from what we find ourselves.</p>
        {known.length > 0 && (
          <>
            <h2 className="eyebrow">Choose your save</h2>
            <div className="pick-players">
              {known.map((k) => (
                <button key={k} className="pick-player" onClick={() => onPick(k)}>
                  {k}
                </button>
              ))}
            </div>
            <div className="divider">
              <span>or begin a new one</span>
            </div>
          </>
        )}
        <form
          className="pick-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onPick(name.trim());
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} autoFocus={!known.length} />
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            Begin
          </button>
        </form>
      </div>
    </main>
  );
}

function Tracker({ player, onSwitch }: { player: string; onSwitch: (name: string) => void }) {
  const data = useQuery(api.steps.list);
  const [search, setSearch] = useState("");
  const [kinds, setKinds] = useLocal<string[]>("filter-kinds", []);
  const [who, setWho] = useLocal<string[]>("filter-players", []);
  const [notMine, setNotMine] = useLocal<boolean>("filter-not-mine", false);
  const [places, setPlaces] = useLocal<string[]>("filter-places", []);
  const [ages, setAges] = useLocal<string[]>("filter-ages", []);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [view, setView] = useLocal<"journal" | "map" | "showcase">("view", "journal");

  const doneBy = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of data?.progress ?? []) m.set(p.stepId, [...(m.get(p.stepId) ?? []), p.player]);
    return m;
  }, [data]);

  if (!data) {
    return (
      <main className="loading">
        <div className="spinner" />
      </main>
    );
  }

  const isMine = (s: Step) => doneBy.get(s._id)?.includes(player) ?? false;
  const others = uniq(data.progress.map((p) => p.player)).filter((p) => p !== player);
  const players = [player, ...others];
  // Filters: nothing ticked means everything. Players match entries any of them has done.
  const allKinds = uniq(data.steps.map((s) => s.category));
  const activeKinds = kinds.filter((k) => allKinds.includes(k));
  const activeWho = who.filter((p) => players.includes(p));
  // Places that have entries, grouped by region in map order.
  const allPlaces = new Set(data.steps.map((s) => placeOf(s.location)));
  const mapIndex = (p: string) => (MAP_ORDER.includes(p) ? MAP_ORDER.indexOf(p) : MAP_ORDER.length);
  const placeGroups: PlaceGroup[] = [...REGIONS.map((r) => r.region), OTHER_REGION]
    .map((region) => ({
      region,
      places: [...allPlaces].filter((p) => regionOfPlace(p) === region).sort((a, b) => mapIndex(a) - mapIndex(b) || a.localeCompare(b)),
    }))
    .filter((g) => g.places.length);
  const activePlaces = places.filter((v) => allPlaces.has(v) || placeGroups.some((g) => regionKey(g.region) === v));

  const activeAges = ages.filter((a) => AGES.includes(a));

  const q = norm(search);
  const passes = {
    kind: (s: Step) => !activeKinds.length || activeKinds.includes(s.category),
    place: (s: Step) => {
      const p = placeOf(s.location);
      return !activePlaces.length || activePlaces.includes(p) || activePlaces.includes(regionKey(regionOfPlace(p)));
    },
    age: (s: Step) => !activeAges.length || activeAges.includes(ageOf(s)),
    who: (s: Step) => (!activeWho.length || activeWho.some((p) => doneBy.get(s._id)?.includes(p))) && (!notMine || !isMine(s)),
    search: (s: Step) => !q || [s.subject, s.action, s.location, s.how, s.category].some((f) => norm(f).includes(q)),
  };
  /** Steps that pass every filter except one: what a dropdown's counts are taken from, so they match what ticking shows. */
  const allBut = (skip: keyof typeof passes) =>
    data.steps.filter((s) => (Object.keys(passes) as (keyof typeof passes)[]).every((k) => k === skip || passes[k](s)));
  const filtered = allBut("search").filter(passes.search);
  const tally = (steps: Step[], keyOf: (s: Step) => string[]) => {
    const m = new Map<string, number>();
    for (const s of steps) for (const k of keyOf(s)) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const kindCounts = tally(allBut("kind"), (s) => [s.category]);
  const placeCounts = tally(allBut("place"), (s) => [placeOf(s.location)]);
  const ageCounts = tally(allBut("age"), (s) => [ageOf(s)]);
  // (the player counts ignore "Anyone but me" too: it belongs to the same dropdown)
  const playerSteps = data.steps.filter((s) => passes.kind(s) && passes.place(s) && passes.age(s) && passes.search(s));
  const playerCounts = tally(playerSteps, (s) => doneBy.get(s._id) ?? []);
  const filtering = !!q || activeKinds.length > 0 || activePlaces.length > 0 || activeAges.length > 0 || activeWho.length > 0 || notMine;
  const clearFilters = () => {
    setSearch("");
    setKinds([]);
    setPlaces([]);
    setAges([]);
    setWho([]);
    setNotMine(false);
  };

  const saveCard = (name: string) => (
    <SaveCard
      key={name}
      name={name}
      isMe={name === player}
      steps={data.steps}
      doneBy={doneBy}
      onOpen={() => setDetail(name)}
    />
  );

  return (
    <div className={view === "journal" ? "app" : "app map-mode"}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-left">
            <span className="brand">Hyrule Log</span>
            <nav className="view-tabs" aria-label="View">
              <button type="button" className={view === "journal" ? "active" : ""} onClick={() => setView("journal")}>
                Journal
              </button>
              <button type="button" className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
                Map
              </button>
              <button type="button" className={view === "showcase" ? "active" : ""} onClick={() => setView("showcase")}>
                Showcase
              </button>
            </nav>
          </div>
          <div className="topbar-actions">
            <PlayerSwitch player={player} players={players} onSwitch={onSwitch} />
            <button className="btn primary hide-mobile" onClick={() => setDialog(NO_PICK)}>
              <Icon name="check" size={18} /> Mark done
            </button>
          </div>
        </div>
      </header>

      <Fanfare players={players} steps={data.steps} progress={data.progress} doneBy={doneBy} total={data.total} />

      {view === "showcase" ? (
        <Showcase steps={data.steps} players={players} doneBy={doneBy} placeOf={placeOf} />
      ) : view === "map" ? (
            <MapView
              steps={data.steps}
              player={player}
              doneBy={doneBy}
              placeOf={placeOf}
              onOpen={(category, inPlaces) => {
                setSearch("");
                setKinds([category]);
                setPlaces(inPlaces);
                setAges([]);
                setWho([]);
                setNotMine(false);
                setView("journal");
                window.scrollTo(0, 0);
              }}
            />
      ) : (
      <div className="layout">
        <Race players={players} me={player} steps={data.steps} doneBy={doneBy} total={data.total} />
        <main className="main">
          <>
              <div className="journal-tools">
                <div className="journal-row">
                  <label className="search">
                    <Icon name="search" size={18} />
                    <input type="search" placeholder="Search the journal" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </label>
                  {/* Picks up the kind you're filtered to, so a Song-only feed marks a song. */}
                  <button
                    type="button"
                    className="btn primary feed-log"
                    onClick={() => setDialog({ ...NO_PICK, category: activeKinds.length === 1 ? activeKinds[0] : "" })}
                  >
                    <Icon name="check" size={18} /> Mark done
                  </button>
                </div>
                <div className="journal-row">
                  <MultiSelect
                    label="Kinds"
                    options={allKinds.map((k) => ({ value: k, count: kindCounts.get(k) ?? 0, icon: categoryIcon(k) }))}
                    selected={activeKinds}
                    onChange={setKinds}
                  />
                  <PlaceSelect groups={placeGroups} counts={placeCounts} selected={activePlaces} onChange={setPlaces} />
                  <MultiSelect
                    label="Ages"
                    options={AGES.map((a) => ({ value: a, count: ageCounts.get(a) ?? 0 }))}
                    selected={activeAges}
                    onChange={setAges}
                  />
                  <MultiSelect
                    label="Players"
                    options={players.map((p) => ({ value: p, count: playerCounts.get(p) ?? 0, note: p === player ? "you" : undefined }))}
                    selected={activeWho}
                    onChange={setWho}
                    extra={{ label: "Anyone but me", hint: "Steps you haven't done yet", checked: notMine, onChange: setNotMine }}
                  />
                  <button type="button" className="btn clear-filters" disabled={!filtering} onClick={clearFilters}>
                    Clear filters
                  </button>
                </div>
              </div>

              <Journal
                steps={filtered}
                player={player}
                doneBy={doneBy}
                searching={filtering}
                onMark={() => setDialog(NO_PICK)}
              />
          </>
        </main>

        <aside className="side">
          <h2 className="side-title">Save Logs</h2>
          {players.map(saveCard)}
        </aside>
      </div>
      )}

      {view === "journal" && (
        <button className="fab" onClick={() => setDialog(NO_PICK)} aria-label="Mark done">
          <Icon name="check" size={26} />
        </button>
      )}

      {detail && <SaveDetail name={detail} steps={data.steps} doneBy={doneBy} onClose={() => setDetail(null)} />}

      {dialog && (
        <TickDialog initial={dialog} player={player} steps={data.steps} isMine={isMine} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

/** A dropdown of checkboxes. Nothing ticked means no filter. */
function MultiSelect({
  label,
  options,
  selected,
  onChange,
  extra,
}: {
  label: string;
  options: { value: string; count: number; icon?: string; note?: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
  /** A special option shown first, kept apart from the list (e.g. "Anyone but me"). */
  extra?: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void };
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const picked = [...(extra?.checked ? [extra.label] : []), ...selected];
  const summary = !picked.length ? "All" : picked.length === 1 ? picked[0] : `${picked.length} selected`;
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <details className={`multi ${picked.length ? "on" : ""}`} ref={ref}>
      <summary>
        <span className="multi-label">{label}</span>
        <span className="multi-value">{summary}</span>
      </summary>
      <div className="multi-menu">
        {extra && (
          <label className="multi-option multi-extra" title={extra.hint}>
            <input type="checkbox" checked={extra.checked} onChange={() => extra.onChange(!extra.checked)} />
            <span>{extra.label}</span>
          </label>
        )}
        {options.map((o) => (
          <label key={o.value} className="multi-option">
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
            {o.icon && <Icon name={o.icon} size={15} />}
            <span>{o.value}</span>
            {o.note && <span className="pill">{o.note}</span>}
            <span className="muted">{o.count}</span>
          </label>
        ))}
        {picked.length > 0 && (
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              onChange([]);
              extra?.onChange(false);
            }}
          >
            Clear
          </button>
        )}
      </div>
    </details>
  );
}

/**
 * The place filter: regions, each with its places indented under it. Ticking a region keeps every place in it,
 * including ones logged later; ticking all of a region's places turns into the region.
 */
function PlaceSelect({
  groups,
  counts,
  selected,
  onChange,
}: {
  groups: PlaceGroup[];
  counts: Map<string, number>;
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const regionOn = (g: PlaceGroup) => selected.includes(regionKey(g.region));
  const toggleRegion = (g: PlaceGroup) => {
    const rest = selected.filter((v) => v !== regionKey(g.region) && !g.places.includes(v));
    onChange(regionOn(g) ? rest : [...rest, regionKey(g.region)]);
  };
  const togglePlace = (g: PlaceGroup, p: string) => {
    if (regionOn(g)) return onChange([...selected.filter((v) => v !== regionKey(g.region)), ...g.places.filter((x) => x !== p)]);
    if (selected.includes(p)) return onChange(selected.filter((v) => v !== p));
    const next = [...selected, p];
    onChange(g.places.every((x) => next.includes(x)) ? [...next.filter((v) => !g.places.includes(v)), regionKey(g.region)] : next);
  };
  const names = selected.map((v) => v.replace(/^region:/, ""));
  const summary = !names.length ? "All" : names.length === 1 ? names[0] : `${names.length} selected`;
  return (
    <details className={`multi ${names.length ? "on" : ""}`} ref={ref}>
      <summary>
        <span className="multi-label">Places</span>
        <span className="multi-value">{summary}</span>
      </summary>
      <div className="multi-menu">
        {groups.map((g) => {
          const on = regionOn(g);
          const some = !on && g.places.some((p) => selected.includes(p));
          return (
            <div key={g.region} className="multi-group">
              <label className="multi-option multi-region">
                <input
                  type="checkbox"
                  checked={on}
                  ref={(el) => {
                    if (el) el.indeterminate = some;
                  }}
                  onChange={() => toggleRegion(g)}
                />
                <span>{g.region}</span>
                <span className="muted">{g.places.reduce((n, p) => n + (counts.get(p) ?? 0), 0)}</span>
              </label>
              {g.places.map((p) => (
                <label key={p} className="multi-option multi-sub">
                  <input type="checkbox" checked={on || selected.includes(p)} onChange={() => togglePlace(g, p)} />
                  <span>{p}</span>
                  <span className="muted">{counts.get(p) ?? 0}</span>
                </label>
              ))}
            </div>
          );
        })}
        {names.length > 0 && (
          <button type="button" className="text-btn" onClick={() => onChange([])}>
            Clear
          </button>
        )}
      </div>
    </details>
  );
}

/** The current player in the top bar; opens a list of everyone to switch saves in one tap. */
function PlayerSwitch({ player, players, onSwitch }: { player: string; players: string[]; onSwitch: (name: string) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const pick = (name: string) => {
    if (ref.current) ref.current.open = false;
    onSwitch(name);
  };
  return (
    <details className="me-switch" ref={ref}>
      <summary className="me" title="Switch save">
        <Icon name="user" size={16} />
        <span>{player}</span>
      </summary>
      <div className="multi-menu me-menu">
        {[...players].sort((a, b) => a.localeCompare(b)).map((p) => (
          <button key={p} type="button" className={`me-option ${p === player ? "current" : ""}`} onClick={() => pick(p)}>
            {p}
            {p === player && <Icon name="check" size={15} />}
          </button>
        ))}
        <button type="button" className="me-option me-new" onClick={() => pick("")}>
          <Icon name="plus" size={15} /> Someone new
        </button>
      </div>
    </details>
  );
}

/* ---------------- Save logs ---------------- */

const HEART = "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z";

/** Every heart in the game: collected ones filled, the next one filled by quarters, the rest dark. */
function Hearts({ full, quarters }: { full: number; quarters: number }) {
  return (
    <div className="hearts" aria-label={`${full} of ${MAX_HEARTS} hearts${quarters ? ` and ${quarters}/4` : ""}`}>
      {Array.from({ length: MAX_HEARTS }, (_, i) => {
        if (i < full)
          return (
            <svg key={i} viewBox="0 0 24 24" className="heart full">
              <path d={HEART} />
            </svg>
          );
        const partial = i === full ? quarters : 0;
        return (
          <svg key={i} viewBox="0 0 24 24" className="heart missing">
            {partial > 0 && (
              <defs>
                <clipPath id={`q${partial}`}>
                  {/* quarters fill clockwise from top-left */}
                  {partial >= 1 && <rect x="0" y="0" width="12" height="12" />}
                  {partial >= 2 && <rect x="12" y="0" width="12" height="12" />}
                  {partial >= 3 && <rect x="12" y="12" width="12" height="12" />}
                </clipPath>
              </defs>
            )}
            <path className="dark" d={HEART} />
            {partial > 0 && <path className="piece" clipPath={`url(#q${partial})`} d={HEART} />}
          </svg>
        );
      })}
    </div>
  );
}

/** One icon per thing in a complete set, one row per group: lit when collected, dark when not. */
function Track({
  label,
  icon,
  rows,
  have,
}: {
  label: string;
  icon: string | ((item: string) => string);
  rows: string[][];
  have: Set<string>;
}) {
  const all = rows.flat();
  const columns = Math.max(...rows.map((r) => r.length));
  return (
    <div className="track" role="group" aria-label={`${label}: ${all.filter((x) => have.has(x)).length} of ${all.length}`}>
      {rows.map((row, i) => (
        <div key={i} className="track-icons" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {row.map((x) => (
            <span
              key={x}
              className={`track-icon ${have.has(x) ? "lit" : ""}`}
              style={have.has(x) && SET_COLOR[x] ? { background: SET_COLOR[x] } : undefined}
              title={x}
            >
              <Icon name={typeof icon === "string" ? icon : icon(x)} size={15} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function SaveCard({
  name,
  isMe,
  steps,
  doneBy,
  onOpen,
}: {
  name: string;
  isMe: boolean;
  steps: Step[];
  doneBy: Map<string, string[]>;
  onOpen: () => void;
}) {
  const done = steps.filter((s) => doneBy.get(s._id)?.includes(name));
  const pieces = done.filter((s) => s.category === "Heart Piece").length;
  const completed = new Set(done.filter((s) => s.category === "Dungeon" && s.action === "Completed").map((s) => s.subject));
  // Each boss leaves a heart container, so a completed boss dungeon is a heart.
  const containers = BOSS_DUNGEONS.filter((d) => completed.has(d)).length;
  const hearts = BASE_HEARTS + containers + Math.floor(pieces / 4);
  const fairies = new Set(done.filter((s) => s.category === "Great Fairy").map((s) => s.subject));
  const songs = new Set(done.filter((s) => s.category === "Song").map((s) => s.subject));

  return (
    <section
      className={`frame save-card ${isMe ? "is-me" : ""}`}
      role="button"
      tabIndex={0}
      title={`See everything ${name} has done`}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
    >
      <header className="save-head">
        <h2 className="save-name">{name}</h2>
        <span className="tally-tile" title="Gold Skulltula tokens">
          <Icon name="spider" size={18} />
          <b>{done.filter((s) => s.category === "Gold Skulltula").length}</b>
        </span>
      </header>
      <Hearts full={hearts} quarters={pieces % 4} />
      <Track label="Dungeons" icon={(d) => DUNGEON_ICON[d] ?? "door"} rows={[DUNGEONS.flatMap((g) => g.items).filter((d) => !MINI_DUNGEONS.includes(d))]} have={completed} />
      <Track label="Songs" icon="note" rows={SONGS.map((g) => g.items)} have={songs} />
      <Track label="Great Fairies" icon="fairy" rows={[GREAT_FAIRIES.flatMap((g) => g.items)]} have={fairies} />
    </section>
  );
}

/** Everything in the game for one player, lit where they've done it. Opened from a save card. */
function SaveDetail({ name, steps, doneBy, onClose }: { name: string; steps: Step[]; doneBy: Map<string, string[]>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const done = steps.filter((s) => doneBy.get(s._id)?.includes(name));
  const has = (category: string, subject: string, action?: string) =>
    done.some((s) => s.category === category && s.subject === subject && (!action || s.action === action));
  const count = (category: string) => done.filter((s) => s.category === category).length;

  const pieces = count("Heart Piece");
  const completed = new Set(done.filter((s) => s.category === "Dungeon" && s.action === "Completed").map((s) => s.subject));
  const hearts = BASE_HEARTS + BOSS_DUNGEONS.filter((d) => completed.has(d)).length + Math.floor(pieces / 4);

  const list = (category: string, groups: Group[]) =>
    groups.map((g) => (
      <div key={g.label} className="detail-group">
        {groups.length > 1 && <h4>{g.label}</h4>}
        <div className="chk-list">
          {g.items.map((x) => {
            const n = done.filter((s) => s.category === category && s.subject === x).length;
            return (
              <span key={x} className={`chk ${n ? "lit" : ""}`} style={n && SET_COLOR[x] ? { background: SET_COLOR[x] } : undefined}>
                {x}
                {x in STACKING && ` ${n}/${STACKING[x]}`}
              </span>
            );
          })}
        </div>
      </div>
    ));

  const stepsTable = (category: string, things: string[], stepsOf: (x: string) => string[]) => (
    <div className="detail-table">
      {things.map((x) => (
        <div key={x} className="detail-row">
          <span className={`detail-thing ${stepsOf(x).every((a) => has(category, x, a)) ? "all" : ""}`}>{x}</span>
          <div className="chk-list">
            {stepsOf(x).map((a) => (
              <span key={a} className={`chk sm ${has(category, x, a) ? "lit" : ""}`}>
                {a}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const section = (title: string, icon: string, body: ReactNode) => (
    <section className="detail-section">
      <h3>
        <Icon name={icon} size={18} /> {title}
      </h3>
      {body}
    </section>
  );

  return (
    <dialog ref={ref} className="dialog detail" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="dialog-body">
        <header className="dialog-head">
          <h2>{name}</h2>
          <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        <Ornament />

        <Hearts full={hearts} quarters={pieces % 4} />
        <div className="detail-counts">
          {Object.entries(TOTALS).map(([c, total]) => (
            <span key={c} className="tally-tile" title={c}>
              <Icon name={categoryIcon(c)} size={18} />
              <b>{count(c)}</b>
              <span className="muted">/ {total}</span>
              <small>{c}</small>
            </span>
          ))}
        </div>

        {section("Dungeons", "door", stepsTable("Dungeon", DUNGEONS.flatMap((g) => g.items), (d) => DUNGEON_STEPS[d] ?? []))}
        {section("Songs", "note", list("Song", SONGS))}
        {section("Great Fairies", "fairy", list("Great Fairy", GREAT_FAIRIES))}
        {section("Masks", "mask", stepsTable("Mask", MASKS.flatMap((g) => g.items), (m) => MASK_STEPS[m] ?? ["Got it"]))}
        {section("Items", "bag", list("Item", ITEMS))}
        {section("Equipment", "shield", list("Equipment", EQUIPMENT))}
        {section("Upgrades", "upgrade", list("Upgrade", UPGRADES))}
        {section("Frogs", "frog", list("Frogs", FROGS))}
        {section("Hall of Fallen Foes", "skull", list("Fallen Foes", FALLEN_FOES))}
      </div>
    </dialog>
  );
}

/* ---------------- Journal ---------------- */

function Journal(props: {
  steps: Step[];
  player: string;
  doneBy: Map<string, string[]>;
  searching: boolean;
  onMark: () => void;
}) {
  const { steps, searching, onMark } = props;
  if (!steps.length) {
    return (
      <div className="empty frame">
        <Icon name="scroll" size={40} />
        {searching ? (
          <p>Nothing matches.</p>
        ) : (
          <>
            <h3>Your journal is blank</h3>
            <p>Things show up here once someone has done them.</p>
            <button className="btn primary" onClick={onMark}>
              <Icon name="check" size={18} /> Mark your first step
            </button>
          </>
        )}
      </div>
    );
  }

  // One card per (category, subject). A Great Fairy and her gift are one moment, so they share the fountain's card.
  // Most recently touched first.
  const groups = new Map<string, Step[]>();
  for (const s of steps) {
    const twin = s.category === "Great Fairy" ? undefined : sameMomentAs(s);
    // Countable kinds (heart pieces, skulltulas…) get one card per entry. Big Poes are all alike: one card counts them.
    const key = s.category === "Big Poe"
      ? "big-poe"
      : categoryInfo(s.category).fixed
      ? s._id
      : twin
        ? `${norm(twin.category)}|${norm(twin.subject)}`
        : `${norm(s.category)}|${norm(s.subject)}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const cards = [...groups.values()]
    .map((list) => list.sort((a, b) => a.firstAt - b.firstAt))
    .sort((a, b) => b[b.length - 1].firstAt - a[a.length - 1].firstAt);

  return (
    <div className="cards">
      {cards.map((list) =>
        list[0].category === "Big Poe" ? (
          <CountCard key="big-poe" steps={list} player={props.player} doneBy={props.doneBy} />
        ) : (
          <SubjectCard key={list[0]._id} {...props} steps={list} />
        ),
      )}
    </div>
  );
}

/** Things that are all alike (Big Poes): one card with how many each player has. Only a save sync ticks them. */
function CountCard({ steps, player, doneBy }: { steps: Step[]; player: string; doneBy: Map<string, string[]> }) {
  const first = steps[0];
  const info = categoryInfo(first.category);
  const total = TOTALS[first.category];
  const counts = new Map<string, number>();
  for (const s of steps) for (const p of doneBy.get(s._id) ?? []) counts.set(p, (counts.get(p) ?? 0) + 1);
  const rows = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return (
    <article className="frame subject-card">
      <header>
        <div className="cat-badge">
          <Icon name={info.icon} size={22} />
        </div>
        <div className="subject-title">
          <h3>{first.subject}s</h3>
          <span className="eyebrow">{first.location}</span>
        </div>
      </header>
      <ol className="steps">
        {rows.map(([p, n]) => (
          <li key={p} className={`step ${p === player ? "done" : ""}`}>
            <div className="step-body">
              <div className="step-head">
                <span className="step-action">
                  {n} / {total}
                </span>
                <div className="stamps">
                  <span className={`stamp ${p === player ? "mine" : ""}`}>{p}</span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

function SubjectCard({ steps, player, doneBy }: { steps: Step[]; player: string; doneBy: Map<string, string[]> }) {
  const tick = useMutation(api.steps.tick);
  const first = steps[0];
  // A fountain card may hold the gift's entry only (if nobody logged the fountain itself).
  const fountain = first.category === "Great Fairy" ? first : undefined;
  const fairyTwin = fountain ? undefined : first.category !== "Great Fairy" ? sameMomentAs(first) : undefined;
  const isFairyCard = !!fountain || (!!fairyTwin && fairyTwin.category === "Great Fairy");
  const cardCategory = isFairyCard ? "Great Fairy" : first.category;
  const cardSubject = fountain?.subject ?? fairyTwin?.subject ?? first.subject;
  const info = categoryInfo(cardCategory);
  const gift = isFairyCard ? sameMomentAs({ category: "Great Fairy", subject: cardSubject, action: "Got the gift" })?.subject : undefined;

  // A named thing's steps nobody has done yet can be marked right here. Countable kinds (and stacking bag
  // upgrades, one entry per place) only come from a save sync.
  const allSteps = info.subjectActions?.[first.subject] ?? info.actions;
  const missing = isFairyCard || info.fixed || first.key?.startsWith("up:") ? [] : allSteps.filter((a) => !steps.some((s) => s.action === a));

  return (
    <article className="frame subject-card">
      <header>
        <div className="cat-badge">
          <Icon name={info.icon} size={22} />
        </div>
        <div className="subject-title">
          <h3>{info.fixed ? (info.place ? first.subject : first.location || first.subject) : cardSubject}</h3>
          <span className="eyebrow">
            {isFairyCard && gift ? `Great Fairy · ${gift}` : info.fixed && info.place ? first.location : cardCategory}
          </span>
        </div>
      </header>
      <ol className="steps">
        {steps.map((s) => (
          <StepRow
            key={s._id}
            step={s}
            fixed={!!info.fixed}
            title={isFairyCard ? (s.category === "Great Fairy" ? "Visited the fountain" : `Got ${s.subject}`) : s.action}
            player={player}
            who={doneBy.get(s._id) ?? []}
          />
        ))}
      </ol>
      {missing.map((a) => (
        <button
          key={a}
          className="add-next"
          title="Nobody has done this step yet"
          onClick={() => tick({ player, keys: [stepKey(first.category, first.subject, a)] })}
        >
          <Icon name="plus" size={16} /> Mark {first.subject} · {a}
        </button>
      ))}
    </article>
  );
}

function StepRow({
  step,
  fixed,
  title: titleOverride,
  player,
  who,
}: {
  step: Step;
  fixed: boolean;
  title?: string;
  player: string;
  who: string[];
}) {
  const setDone = useMutation(api.steps.setDone);
  const mine = who.includes(player);
  const title = titleOverride ?? step.action;
  return (
    <li className={`step ${mine ? "done" : ""}`}>
      <button
        className="check"
        aria-pressed={mine}
        title={mine ? "Mark as not done (hidden again once nobody has it)" : "Mark as done"}
        onClick={() => setDone({ stepId: step._id, player, done: !mine })}
      >
        <Icon name="check" size={16} />
      </button>
      <div className="step-body">
        <div className="step-head">
          <span className="step-action">{title}</span>
          {step.age && <span className={`age age-${norm(step.age)}`}>{step.age}</span>}
          <div className="stamps">
            {who.map((p) => (
              <span key={p} className={`stamp ${p === player ? "mine" : ""}`} title={`${p} did this`}>
                {p}
              </span>
            ))}
          </div>
        </div>
        {!fixed && step.location && (
          <p className="step-where">
            <Icon name="pin" size={14} /> {step.location}
          </p>
        )}
        {step.how && <p className="step-how">{step.how}</p>}
        <div className="step-foot">
          <span className="muted small">
            first done by {step.firstBy}, {ago(step.firstAt)}
          </span>
        </div>
      </div>
    </li>
  );
}

/* ---------------- Form bits ---------------- */

/**
 * A pick from the game's complete lists. Grouped lists are two dropdowns (group, then the thing);
 * a single list is one. Only the thing is stored; names are unique across groups.
 */
function ListField({
  label,
  value,
  onChange,
  groups,
  groupNoun = "Type",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  groups: Group[];
  groupNoun?: string;
  required?: boolean;
}) {
  const groupOf = (v: string) => groups.find((g) => g.items.includes(v))?.label ?? "";
  const split = groups.length > 1;
  // An older entry may hold a name that isn't on the list. Keep offering it so editing doesn't lose it.
  const legacy = value && !groupOf(value) ? value : "";
  const [group, setGroup] = useState(() => (split ? groupOf(value) : ""));
  const items = split ? (groups.find((g) => g.label === group)?.items ?? []) : (groups[0]?.items ?? []);
  const options = legacy && !items.includes(legacy) ? [legacy, ...items] : items;

  const itemSelect = (
    <select aria-label={label} required={required} value={value} disabled={split && !group && !legacy} onChange={(e) => onChange(e.target.value)}>
      <option value="">{split && !group && !legacy ? `Pick a ${groupNoun.toLowerCase()} first` : "Choose…"}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );

  if (!split) {
    return (
      <label className="field">
        <span>{label}</span>
        {itemSelect}
      </label>
    );
  }

  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="where">
        <select
          aria-label={groupNoun}
          value={group}
          onChange={(e) => {
            const next = groups.find((g) => g.label === e.target.value);
            setGroup(e.target.value);
            // A group with a single entry needs no second choice.
            onChange(next && next.items.length === 1 ? next.items[0] : "");
          }}
        >
          <option value="">{groupNoun}…</option>
          {groups.map((g) => (
            <option key={g.label} value={g.label}>
              {g.label}
            </option>
          ))}
        </select>
        {itemSelect}
      </div>
    </fieldset>
  );
}

/* ---------------- Dialog ---------------- */

/**
 * Mark a named thing's step done (a song, an item, a dungeon step…). Every entry already exists on the server,
 * so this only ticks it. Countable kinds (heart pieces, skulltulas…) come from a save sync instead,
 * and once someone has one, it's ticked from its card.
 */
function TickDialog({
  initial,
  player,
  steps,
  isMine,
  onClose,
}: {
  initial: NonNullable<DialogState>;
  player: string;
  steps: Step[];
  isMine: (s: Step) => boolean;
  onClose: () => void;
}) {
  const tick = useMutation(api.steps.tick);
  const ref = useRef<HTMLDialogElement>(null);
  const named = CATEGORIES.filter((c) => !c.fixed);
  const [category, setCategory] = useState(named.some((c) => c.name === initial.category) ? initial.category : "");
  const [subject, setSubject] = useState(initial.subject);
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const info = categoryInfo(category);
  // Stacking bag upgrades are one entry per place, found by the sync like heart pieces.
  const options = info.options?.map((g) => ({ ...g, items: g.items.filter((s) => !(s in STACKING)) })).filter((g) => g.items.length);
  const actions = info.subjectActions?.[subject] ?? info.actions;
  const chosen = actions.length === 1 ? actions[0] : action;
  const pickSubject = (s: string) => {
    setSubject(s);
    setAction("");
  };
  const done = steps.some((s) => s.category === category && s.subject === subject && s.action === chosen && isMine(s));
  const twin = subject && chosen ? sameMomentAs({ category, subject, action: chosen }) : undefined;

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await tick({ player, keys: [stepKey(category, subject, chosen)] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (subject && chosen && !done) save();
        }}
      >
        <header className="dialog-head">
          <h2>Mark done</h2>
          <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        <Ornament />

        <fieldset>
          <legend>What kind of thing?</legend>
          <div className="cat-grid">
            {named.map((c) => (
              <button
                type="button"
                key={c.name}
                className={`cat-tile ${category === c.name ? "active" : ""}`}
                onClick={() => {
                  setCategory(c.name);
                  pickSubject("");
                }}
              >
                <Icon name={c.icon} size={22} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
          <p className="hint mt">Heart pieces, Gold Skulltulas, Big Poes, bottles and bag upgrades come from the save sync.</p>
        </fieldset>

        {category && options && (
          <div className="form-rest" key={category}>
            <ListField label={info.subjectLabel ?? "What is it?"} value={subject} onChange={pickSubject} groups={options} groupNoun={info.groupNoun} required />
            {subject && actions.length > 1 && (
              <fieldset>
                <legend>Which step?</legend>
                <div className="quick">
                  {actions.map((a) => (
                    <button type="button" key={a} className={`chip ${action === a ? "active" : ""}`} onClick={() => setAction(a)}>
                      {a}
                    </button>
                  ))}
                </div>
                {info.note && <p className="hint mt">{info.note}</p>}
              </fieldset>
            )}
            {twin && (
              <p className="hint">
                Also counts as {twin.category === "Great Fairy" ? <>visiting the {twin.subject}</> : <>getting {twin.subject}</>}.
              </p>
            )}
            {done && <p className="hint">You've already done this.</p>}
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <div className="dialog-actions">
          <button type="button" className="text-btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!subject || !chosen || done || busy}>
            Mark it done
          </button>
        </div>
      </form>
    </dialog>
  );
}
