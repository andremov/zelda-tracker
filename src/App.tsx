import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { useLocal } from "./storage";
import { Race } from "./Race";
import { CATEGORIES, Icon, categoryIcon, categoryInfo } from "./icons";
import { REGIONS } from "./locations";
import {
  BOSS_DUNGEONS,
  DUNGEON_ICON,
  DUNGEON_STEPS,
  DUNGEONS,
  MINI_DUNGEONS,
  EQUIPMENT,
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
import { sameMomentAs, STACKING } from "../convex/links";

type Step = Doc<"steps">;
type Progress = Doc<"progress">;
type Fields = Pick<Step, "category" | "subject" | "action" | "location" | "how" | "age">;
type DialogState = { mode: "add"; initial: Fields } | { mode: "edit"; step: Step } | null;

const EMPTY: Fields = { category: "", subject: "", action: "", location: "", how: "", age: "" };
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
  const [dialog, setDialog] = useState<DialogState>(null);
  const [detail, setDetail] = useState<string | null>(null);

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

  const q = norm(search);
  const passes = {
    kind: (s: Step) => !activeKinds.length || activeKinds.includes(s.category),
    place: (s: Step) => {
      const p = placeOf(s.location);
      return !activePlaces.length || activePlaces.includes(p) || activePlaces.includes(regionKey(regionOfPlace(p)));
    },
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
  // (the player counts ignore "Anyone but me" too: it belongs to the same dropdown)
  const playerSteps = data.steps.filter((s) => passes.kind(s) && passes.place(s) && passes.search(s));
  const playerCounts = tally(playerSteps, (s) => doneBy.get(s._id) ?? []);
  const filtering = !!q || activeKinds.length > 0 || activePlaces.length > 0 || activeWho.length > 0 || notMine;
  const clearFilters = () => {
    setSearch("");
    setKinds([]);
    setPlaces([]);
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
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Hyrule Log</span>
          <div className="topbar-actions">
            <PlayerSwitch player={player} players={players} onSwitch={onSwitch} />
            <button className="btn primary hide-mobile" onClick={() => setDialog({ mode: "add", initial: EMPTY })}>
              <Icon name="quill" size={18} /> Log a step
            </button>
          </div>
        </div>
      </header>

      <div className="layout">
        <Race players={players} me={player} steps={data.steps} doneBy={doneBy} />
        <main className="main">

          <>
              <div className="journal-tools">
                <div className="journal-row">
                  <label className="search">
                    <Icon name="search" size={18} />
                    <input type="search" placeholder="Search the journal" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </label>
                  {/* Picks up the kind you're filtered to, so a Skulltula-only feed logs a Skulltula. */}
                  <button
                    type="button"
                    className="btn primary feed-log"
                    onClick={() => setDialog({ mode: "add", initial: { ...EMPTY, category: activeKinds.length === 1 ? activeKinds[0] : "" } })}
                  >
                    <Icon name="quill" size={18} /> {activeKinds.length === 1 ? `Log ${activeKinds[0]}` : "Log a step"}
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
                onAdd={(initial) => setDialog({ mode: "add", initial })}
                onEdit={(step) => setDialog({ mode: "edit", step })}
              />
          </>
        </main>

        <aside className="side">
          <h2 className="side-title">Save Logs</h2>
          {players.map(saveCard)}
        </aside>
      </div>

      <button className="fab" onClick={() => setDialog({ mode: "add", initial: EMPTY })} aria-label="Log a step">
        <Icon name="quill" size={26} />
      </button>

      {detail && <SaveDetail name={detail} steps={data.steps} doneBy={doneBy} onClose={() => setDetail(null)} />}

      {dialog && (
        <StepDialog
          state={dialog}
          player={player}
          steps={data.steps}
          isMine={isMine}
          doneBy={doneBy}
          onClose={() => setDialog(null)}
        />
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
  onAdd: (f: Fields) => void;
  onEdit: (s: Step) => void;
}) {
  const { steps, searching, onAdd } = props;
  if (!steps.length) {
    return (
      <div className="empty frame">
        <Icon name="scroll" size={40} />
        {searching ? (
          <p>Nothing matches.</p>
        ) : (
          <>
            <h3>Your journal is blank</h3>
            <p>Found something? Write it down, one small step at a time.</p>
            <button className="btn primary" onClick={() => onAdd(EMPTY)}>
              <Icon name="quill" size={18} /> Log your first step
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
    // Countable kinds (heart pieces, skulltulas…) get one card per entry.
    const key = categoryInfo(s.category).fixed
      ? s._id
      : twin
        ? `${norm(twin.category)}|${norm(twin.subject)}`
        : `${norm(s.category)}|${norm(s.subject)}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  const cards = [...groups.values()]
    .map((list) => list.sort((a, b) => a._creationTime - b._creationTime))
    .sort((a, b) => b[b.length - 1]._creationTime - a[a.length - 1]._creationTime);

  return (
    <div className="cards">
      {cards.map((list) => (
        <SubjectCard key={list[0]._id} {...props} steps={list} />
      ))}
    </div>
  );
}

function SubjectCard({
  steps,
  player,
  doneBy,
  onAdd,
  onEdit,
}: {
  steps: Step[];
  player: string;
  doneBy: Map<string, string[]>;
  onAdd: (f: Fields) => void;
  onEdit: (s: Step) => void;
}) {
  const first = steps[0];
  // A fountain card may hold the gift's entry only (if nobody logged the fountain itself).
  const fountain = first.category === "Great Fairy" ? first : undefined;
  const fairyTwin = fountain ? undefined : first.category !== "Great Fairy" ? sameMomentAs(first) : undefined;
  const isFairyCard = !!fountain || (!!fairyTwin && fairyTwin.category === "Great Fairy");
  const cardCategory = isFairyCard ? "Great Fairy" : first.category;
  const cardSubject = fountain?.subject ?? fairyTwin?.subject ?? first.subject;
  const info = categoryInfo(cardCategory);
  const gift = isFairyCard ? sameMomentAs({ category: "Great Fairy", subject: cardSubject, action: "Got the gift" })?.subject : undefined;

  // Offer the next step only while this thing has steps nobody has logged yet.
  const allSteps = info.subjectActions?.[first.subject] ?? info.actions;
  const missing = isFairyCard ? [] : allSteps.filter((a) => !steps.some((s) => s.action === a));
  // Countable kinds are logged fresh from "Log a step", so their cards have no add button.
  // Stacking upgrades: one entry per place, so offer another while some are left.
  const stack = STACKING[first.subject] ?? 0;
  const another = stack > 0 && steps.length < stack;
  const canAdd = !info.fixed && (missing.length > 0 || another);

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
            onEdit={categoryInfo(s.category).noHow ? undefined : () => onEdit(s)}
          />
        ))}
      </ol>
      {canAdd && (
        <button
          className="add-next"
          onClick={() =>
            onAdd({ ...EMPTY, category: first.category, subject: first.subject, action: another ? allSteps[0] : missing.length === 1 ? missing[0] : "" })
          }
        >
          <Icon name="plus" size={16} />{" "}
          {another ? `Log another ${first.subject}` : missing.length === 1 ? `Log ${first.subject} · ${missing[0]}` : `Log a step for ${first.subject}`}
        </button>
      )}
    </article>
  );
}

function StepRow({
  step,
  fixed,
  title: titleOverride,
  player,
  who,
  onEdit,
}: {
  step: Step;
  fixed: boolean;
  title?: string;
  player: string;
  who: string[];
  onEdit?: () => void;
}) {
  const setDone = useMutation(api.steps.setDone);
  const mine = who.includes(player);
  const title = titleOverride ?? step.action;
  return (
    <li className={`step ${mine ? "done" : ""}`}>
      <button
        className="check"
        aria-pressed={mine}
        title={mine ? "Mark as not done (removed once nobody has it)" : "Mark as done"}
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
            logged by {step.createdBy}, {ago(step._creationTime)}
          </span>
          {onEdit && (
            <div className="row-actions">
              <button className="icon-btn sm" onClick={onEdit} title="Fix a mistake in this entry">
                <Icon name="edit" size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------------- Form bits ---------------- */

const NEW = "__new__";

const regionOf = (place: string) => REGIONS.find((r) => r.places.includes(place))?.region ?? "";

const PLACE_GROUPS: Group[] = REGIONS.map((r) => ({ label: r.region, items: r.places }));

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

/** A dropdown of known values, with a "New…" option that switches to free text. */
function ComboField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  required?: boolean;
}) {
  const [typing, setTyping] = useState(() => !options.length || (!!value && !options.includes(value)));
  return (
    <label className="field">
      <span>{label}</span>
      {typing ? (
        <div className="combo">
          <input required={required} autoFocus={options.length > 0} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
          {options.length > 0 && (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setTyping(false);
                onChange("");
              }}
            >
              pick from list
            </button>
          )}
        </div>
      ) : (
        <select
          required={required}
          value={value}
          onChange={(e) => {
            if (e.target.value === NEW) {
              setTyping(true);
              onChange("");
            } else onChange(e.target.value);
          }}
        >
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={NEW}>+ Something new…</option>
        </select>
      )}
    </label>
  );
}

/* ---------------- Dialog ---------------- */

function StepDialog({
  state,
  player,
  steps,
  isMine,
  doneBy,
  onClose,
}: {
  state: NonNullable<DialogState>;
  player: string;
  steps: Step[];
  isMine: (s: Step) => boolean;
  doneBy: Map<string, string[]>;
  onClose: () => void;
}) {
  const add = useMutation(api.steps.add);
  const update = useMutation(api.steps.update);
  const setDone = useMutation(api.steps.setDone);
  const ref = useRef<HTMLDialogElement>(null);
  const init = state.mode === "edit" ? state.step : state.initial;
  // Opening with only a kind chosen (e.g. from a filtered feed) fills in what picking that kind would.
  const initInfo = categoryInfo(init.category);
  const [f, setF] = useState<Fields>({
    category: init.category,
    subject: init.subject || (init.category && initInfo.fixed) || "",
    action: init.action || (init.category && initInfo.actions.length === 1 ? initInfo.actions[0] : ""),
    location: init.location,
    how: init.how,
    age: init.age,
  });
  const [customAction, setCustomAction] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dupes, setDupes] = useState<Step[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const info = categoryInfo(f.category);
  const set = <K extends keyof Fields>(k: K, v: string) => setF((prev) => ({ ...prev, [k]: v }));
  const pickCategory = (name: string) => {
    const next = categoryInfo(name);
    setCustomAction(false);
    setF((prev) => ({
      ...prev,
      category: name,
      // Keep what's typed only if it still makes sense for the new kind.
      subject:
        next.fixed ??
        (categoryInfo(prev.category).fixed || (next.options && !next.options.some((g) => g.items.includes(prev.subject))) ? "" : prev.subject),
      action: next.actions.includes(prev.action) ? prev.action : next.actions.length === 1 ? next.actions[0] : "",
    }));
  };

  // Dropdown options only come from steps you can already see, so choosing never spoils anything.
  const subjects = uniq(steps.filter((s) => norm(s.category) === norm(f.category)).map((s) => s.subject));
  // Steps are a fixed list per kind. Free text only for "Other" and kinds people add themselves.
  const freeAction = !!info.freeAction;
  const baseActions = info.subjectActions?.[f.subject] ?? info.actions;
  const actionOptions =
    state.mode === "edit" && f.action && !freeAction && !baseActions.includes(f.action) ? [...baseActions, f.action] : baseActions;
  const showActionInput = freeAction && (customAction || (!!f.action && !actionOptions.includes(f.action)));
  const askAction = actionOptions.length > 1 || freeAction;
  // Questions appear in order, each only once the answers above it are in, so nothing shows up and then vanishes.
  const subjectChosen = !!f.subject.trim();
  const ready = subjectChosen && (!askAction || !!f.action.trim());
  const twin = ready ? sameMomentAs(f) : undefined;
  const canSave = f.category.trim() && f.subject.trim() && f.action.trim();
  // Some answers are known from the kind and step alone; those questions aren't asked.
  const subjectKnown = !!info.options?.some((g) => g.items.includes(f.subject));
  const lockedLocation =
    info.stepPlaceBySubject?.[f.action]?.[f.subject] ??
    info.stepLocations?.[f.action] ??
    info.subjectPlace?.[f.subject] ??
    info.place ??
    (info.subjectIsPlace && subjectKnown ? f.subject : undefined);
  const lockedAge = info.age ?? info.subjectAge?.[f.subject];
  const final: Fields = { ...f, location: lockedLocation ?? f.location, age: lockedAge ?? f.age };

  const save = async (force = false) => {
    setError("");
    if (state.mode === "add" && !force) {
      // Named things never get a second entry: the backend just ticks the existing one.
      // Countable kinds (heart pieces…) can repeat, so ask when one in the same place is already logged.
      const matches = steps.filter(
        (s) =>
          !!info.fixed &&
          !isMine(s) &&
          norm(s.category) === norm(f.category) &&
          norm(s.subject) === norm(f.subject) &&
          norm(s.action) === norm(f.action) &&
          (!info.fixed || (!info.place && !!final.location.trim() && norm(s.location) === norm(final.location))),
      );
      if (matches.length) {
        setDupes(matches);
        return;
      }
    }
    setBusy(true);
    try {
      if (state.mode === "edit") await update({ id: state.step._id as Id<"steps">, ...final });
      else await add({ player, ...final });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) save();
        }}
      >
        <header className="dialog-head">
          <h2>{state.mode === "edit" ? "Amend the entry" : "Log a step"}</h2>
          <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        <Ornament />

        {dupes ? (
          <div className="dupes">
            <p>
              Someone already logged <b>{f.subject}</b> · <b>{f.action}</b>
              {info.fixed && f.location && (
                <>
                  {" "}
                  at <b>{f.location}</b>
                </>
              )}
              . Is it the same thing you did?
            </p>
            {dupes.map((s) => (
              <div key={s._id} className="dupe">
                {s.location && (
                  <p className="step-where">
                    <Icon name="pin" size={14} /> {s.location}
                  </p>
                )}
                {s.how && <p className="step-how">{s.how}</p>}
                <span className="muted small">done by {(doneBy.get(s._id) ?? []).join(", ")}</span>
              </div>
            ))}
            <div className="dialog-actions">
              <button type="button" className="text-btn" onClick={() => setDupes(null)}>
                Back
              </button>
              <button type="button" className="btn" onClick={() => save(true)} disabled={busy}>
                No, log mine separately
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  for (const s of dupes) await setDone({ stepId: s._id, player, done: true });
                  onClose();
                }}
              >
                Yes, mark it done
              </button>
            </div>
          </div>
        ) : (
          <>
            <fieldset>
              <legend>What kind of thing?</legend>
              <div className="cat-grid">
                {CATEGORIES.map((c) => (
                  <button
                    type="button"
                    key={c.name}
                    className={`cat-tile ${f.category === c.name ? "active" : ""}`}
                    onClick={() => pickCategory(c.name)}
                  >
                    <Icon name={c.icon} size={22} />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {f.category && (
              <div className="form-rest" key={f.category}>
                {!info.fixed && info.options && (
                  <ListField
                    key={`subj-${f.category}`}
                    label={info.subjectLabel ?? "What is it?"}
                    value={f.subject}
                    onChange={(v) =>
                      setF((prev) => {
                        const steps = info.subjectActions?.[v] ?? info.actions;
                        return { ...prev, subject: v, action: steps.includes(prev.action) ? prev.action : steps.length === 1 ? steps[0] : "" };
                      })
                    }
                    groups={info.options}
                    groupNoun={info.groupNoun}
                    required
                  />
                )}
                {!info.fixed && !info.options && (
                  <ComboField
                    key={`subj-${f.category}`}
                    label={info.subjectLabel ?? "What is it?"}
                    value={f.subject}
                    onChange={(v) => set("subject", v)}
                    options={subjects}
                    placeholder={info.subjectPlaceholder ?? "Name it"}
                    required
                  />
                )}

                {askAction && subjectChosen && (
                <fieldset>
                  <legend>Which step?</legend>
                  <div className="quick">
                    {actionOptions.map((a) => (
                      <button
                        type="button"
                        key={a}
                        className={`chip ${!showActionInput && f.action === a ? "active" : ""}`}
                        onClick={() => {
                          setCustomAction(false);
                          set("action", a);
                        }}
                      >
                        {a}
                      </button>
                    ))}
                    {freeAction && (
                      <button
                        type="button"
                        className={`chip ${showActionInput ? "active" : ""}`}
                        onClick={() => {
                          setCustomAction(true);
                          set("action", "");
                        }}
                      >
                        Other…
                      </button>
                    )}
                  </div>
                  {showActionInput && (
                    <input className="mt" autoFocus value={f.action} onChange={(e) => set("action", e.target.value)} placeholder="Describe the step" />
                  )}
                  {info.note && <p className="hint mt">{info.note}</p>}
                </fieldset>
                )}

                {ready ? (
                  <>
                    {twin && (
                      <p className="hint">
                        Also counts as {twin.category === "Great Fairy" ? <>visiting the {twin.subject}</> : <>getting {twin.subject}</>}.
                      </p>
                    )}
                    {(lockedLocation || lockedAge) && (
                      <p className="locked">
                        {lockedLocation && (
                          <span>
                            <Icon name="pin" size={15} /> {lockedLocation}
                            {regionOf(lockedLocation) && <span className="muted"> · {regionOf(lockedLocation)}</span>}
                          </span>
                        )}
                        {lockedAge && (
                          <span>
                            <Icon name="user" size={15} /> {lockedAge}
                          </span>
                        )}
                      </p>
                    )}

                    {!lockedLocation && (
                      <ListField key={`loc-${f.category}`} label="Where?" value={f.location} onChange={(v) => set("location", v)} groups={PLACE_GROUPS} groupNoun="Region" />
                    )}

                    {!lockedAge && (
                      <fieldset>
                        <legend>As which age?</legend>
                        <div className="segmented">
                          {["", "Child", "Adult", "Either"].map((a) => (
                            <button type="button" key={a || "none"} className={f.age === a ? "active" : ""} onClick={() => set("age", a)}>
                              {a || "-"}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    )}

                    {!info.noHow && (
                      <label className="field">
                        <span>How?</span>
                        <textarea rows={3} value={f.how} onChange={(e) => set("how", e.target.value)} placeholder={info.howPlaceholder ?? "What you did"} />
                      </label>
                    )}
                  </>
                ) : (
                  <p className="hint">{subjectChosen ? "Pick the step to continue." : "Pick which one to continue."}</p>
                )}
              </div>
            )}

            <p className="hint">One step per entry. If something takes three actions, log three steps.</p>
            {error && <p className="error">{error}</p>}

            <div className="dialog-actions">
              <button type="button" className="text-btn" onClick={() => ref.current?.close()}>
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={!canSave || busy}>
                {state.mode === "edit" ? "Save" : "Write it down"}
              </button>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
}
