import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { useLocal } from "./storage";
import { CATEGORIES, Icon, categoryIcon, categoryInfo } from "./icons";
import { REGIONS } from "./locations";
import { BOSS_DUNGEONS, DUNGEON_ICON, DUNGEONS, GREAT_FAIRIES, HEART_PIECES, SONGS, type Group } from "./gamedata";
import { sameMomentAs } from "../convex/links";

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
  return <Tracker player={player} onChangePlayer={() => setPlayer("")} />;
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

function Tracker({ player, onChangePlayer }: { player: string; onChangePlayer: () => void }) {
  const data = useQuery(api.steps.list);
  const [search, setSearch] = useState("");
  const [kinds, setKinds] = useLocal<string[]>("filter-kinds", []);
  const [who, setWho] = useLocal<string[]>("filter-players", []);
  const [dialog, setDialog] = useState<DialogState>(null);

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
  const kindCounts = new Map<string, number>();
  for (const s of data.steps) kindCounts.set(s.category, (kindCounts.get(s.category) ?? 0) + 1);
  const playerCounts = new Map(players.map((p) => [p, data.progress.filter((r) => r.player === p).length]));
  const activeKinds = kinds.filter((k) => kindCounts.has(k));
  const activeWho = who.filter((p) => players.includes(p));

  const q = norm(search);
  const filtered = data.steps.filter(
    (s) =>
      (!activeKinds.length || activeKinds.includes(s.category)) &&
      (!activeWho.length || activeWho.some((p) => doneBy.get(s._id)?.includes(p))) &&
      (!q || [s.subject, s.action, s.location, s.how, s.category].some((f) => norm(f).includes(q))),
  );

  const saveCard = (name: string) => (
    <SaveCard
      key={name}
      name={name}
      isMe={name === player}
      steps={data.steps}
      doneBy={doneBy}
    />
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Hyrule Log</span>
          <div className="topbar-actions">
            <button className="me" onClick={onChangePlayer} title="Switch save">
              <Icon name="user" size={16} />
              <span>{player}</span>
            </button>
            <button className="btn primary hide-mobile" onClick={() => setDialog({ mode: "add", initial: EMPTY })}>
              <Icon name="quill" size={18} /> Log a step
            </button>
          </div>
        </div>
      </header>

      <div className="layout">
        <main className="main">

          <>
              <div className="journal-tools">
                <label className="search">
                  <Icon name="search" size={18} />
                  <input type="search" placeholder="Search the journal" value={search} onChange={(e) => setSearch(e.target.value)} />
                </label>
                <MultiSelect
                  label="Kinds"
                  options={[...kindCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => ({ value: k, count: n, icon: categoryIcon(k) }))}
                  selected={activeKinds}
                  onChange={setKinds}
                />
                <MultiSelect
                  label="Players"
                  options={players.map((p) => ({ value: p, count: playerCounts.get(p) ?? 0, note: p === player ? "you" : undefined }))}
                  selected={activeWho}
                  onChange={setWho}
                />
              </div>

              <Journal
                steps={filtered}
                player={player}
                doneBy={doneBy}
                searching={!!q || activeKinds.length > 0 || activeWho.length > 0}
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
}: {
  label: string;
  options: { value: string; count: number; icon?: string; note?: string }[];
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
  const summary = !selected.length ? "All" : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <details className={`multi ${selected.length ? "on" : ""}`} ref={ref}>
      <summary>
        <span className="multi-label">{label}</span>
        <span className="multi-value">{summary}</span>
      </summary>
      <div className="multi-menu">
        {options.map((o) => (
          <label key={o.value} className="multi-option">
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
            {o.icon && <Icon name={o.icon} size={15} />}
            <span>{o.value}</span>
            {o.note && <span className="pill">{o.note}</span>}
            <span className="muted">{o.count}</span>
          </label>
        ))}
        {selected.length > 0 && (
          <button type="button" className="text-btn" onClick={() => onChange([])}>
            Clear
          </button>
        )}
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

/** One icon per thing in a complete set: lit when collected, dark when not. */
function Track({ label, icon, items, have }: { label: string; icon: string | ((item: string) => string); items: string[]; have: Set<string> }) {
  return (
    <div className="track">
      <span className="track-label">
        {label} <b>{items.filter((x) => have.has(x)).length}</b>/{items.length}
      </span>
      <div className="track-icons">
        {items.map((x) => (
          <span key={x} className={`track-icon ${have.has(x) ? "lit" : ""}`} title={x}>
            <Icon name={typeof icon === "string" ? icon : icon(x)} size={16} />
          </span>
        ))}
      </div>
    </div>
  );
}

// Shown as a set on the save card, or not at all; everything else is a plain count.
const TRACKED = ["Heart Piece", "Dungeon", "Great Fairy", "Song", "Item", "Mask", "Gold Skulltula"];

function SaveCard({ name, isMe, steps, doneBy }: { name: string; isMe: boolean; steps: Step[]; doneBy: Map<string, string[]> }) {
  const done = steps.filter((s) => doneBy.get(s._id)?.includes(name));
  const pieces = done.filter((s) => s.category === "Heart Piece").length;
  const completed = new Set(done.filter((s) => s.category === "Dungeon" && s.action === "Completed").map((s) => s.subject));
  // Each boss leaves a heart container, so a completed boss dungeon is a heart.
  const containers = BOSS_DUNGEONS.filter((d) => completed.has(d)).length;
  const hearts = BASE_HEARTS + containers + Math.floor(pieces / 4);
  const fairies = new Set(done.filter((s) => s.category === "Great Fairy").map((s) => s.subject));
  const songs = new Set(done.filter((s) => s.category === "Song").map((s) => s.subject));

  // Fixed kinds count every entry; named kinds count distinct things.
  const tallies = new Map<string, Set<string>>();
  for (const s of done) {
    if (TRACKED.includes(s.category)) continue;
    const set = tallies.get(s.category) ?? new Set<string>();
    set.add(categoryInfo(s.category).fixed ? s._id : norm(s.subject));
    tallies.set(s.category, set);
  }

  return (
    <section className={`frame save-card ${isMe ? "is-me" : ""}`}>
      <header className="save-head">
        <h2 className="save-name">{name}</h2>
        <span className="tally-tile" title="Gold Skulltula tokens">
          <Icon name="spider" size={18} />
          <b>{done.filter((s) => s.category === "Gold Skulltula").length}</b>
        </span>
      </header>
      <Hearts full={hearts} quarters={pieces % 4} />
      <Track label="Dungeons" icon={(d) => DUNGEON_ICON[d] ?? "door"} items={DUNGEONS.flatMap((g) => g.items)} have={completed} />
      <Track label="Songs" icon="note" items={SONGS.flatMap((g) => g.items)} have={songs} />
      <Track label="Great Fairies" icon="fairy" items={GREAT_FAIRIES.flatMap((g) => g.items)} have={fairies} />
      {tallies.size > 0 && (
        <div className="save-tallies">
          {[...tallies.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([c, set]) => (
              <span key={c} className="tally-tile" title={c}>
                <Icon name={categoryIcon(c)} size={18} />
                <b>{set.size}</b>
              </span>
            ))}
        </div>
      )}
    </section>
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
    const key = twin ? `${norm(twin.category)}|${norm(twin.subject)}` : `${norm(s.category)}|${norm(s.subject)}`;
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
  const canAdd = !!info.fixed || missing.length > 0;

  return (
    <article className="frame subject-card">
      <header>
        <div className="cat-badge">
          <Icon name={info.icon} size={22} />
        </div>
        <div className="subject-title">
          <h3>{info.fixed ? `${first.subject}s` : cardSubject}</h3>
          {!info.fixed && <span className="eyebrow">{isFairyCard && gift ? `Great Fairy · ${gift}` : cardCategory}</span>}
        </div>
      </header>
      <ol className="steps">
        {steps.map((s) => (
          <StepRow
            key={s._id}
            step={s}
            fixed={!!info.fixed}
            title={isFairyCard ? (s.category === "Great Fairy" ? "Visited the fountain" : `Got ${s.subject}`) : undefined}
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
            onAdd({ ...EMPTY, category: first.category, subject: first.subject, action: !info.fixed && missing.length === 1 ? missing[0] : "" })
          }
        >
          <Icon name="plus" size={16} />{" "}
          {info.fixed ? `Log another ${first.subject}` : missing.length === 1 ? `Log ${first.subject} · ${missing[0]}` : `Log a step for ${first.subject}`}
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
  // For fixed kinds (heart pieces…) the place is what tells entries apart, so it leads.
  const samePlace = !!categoryInfo(step.category).place;
  const title = titleOverride ?? (fixed && !samePlace ? step.location || step.action : step.action);
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
  const [f, setF] = useState<Fields>({
    category: init.category,
    subject: init.subject,
    action: init.action,
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
      // Fixed kinds (heart pieces…) are told apart by place, so they only match on the same place.
      const matches = steps.filter(
        (s) =>
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
