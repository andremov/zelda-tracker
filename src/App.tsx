import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { useLocal } from "./storage";
import { CATEGORIES, Icon, categoryIcon, categoryInfo } from "./icons";

type Step = Doc<"steps">;
type Progress = Doc<"progress">;
type PlayerDoc = Doc<"players">;
type Fields = Pick<Step, "category" | "subject" | "action" | "location" | "how" | "age">;
type DialogState = { mode: "add"; initial: Fields } | { mode: "edit"; step: Step } | null;
type Tab = "journal" | "sealed" | "saves";

const EMPTY: Fields = { category: "", subject: "", action: "", location: "", how: "", age: "" };
const PLAYER_COLORS = ["#7a2e1f", "#2f5a35", "#2c4a6e", "#6b3a5c", "#8a6420", "#3d5f5a", "#5a4632", "#4a3f73"];
const BASE_HEARTS = 3;

const norm = (s: string) => s.trim().toLowerCase();
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));
const colorFor = (name: string) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PLAYER_COLORS[h % PLAYER_COLORS.length];
};
const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export default function App() {
  const [player, setPlayer] = useLocal<string>("player", "");
  const [theme, setTheme] = useLocal<"" | "light" | "dark">("theme", "");
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);
  const toggleTheme = () => {
    const dark = theme ? theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(dark ? "light" : "dark");
  };
  if (!player) return <PickName onPick={setPlayer} />;
  return <Tracker player={player} onChangePlayer={() => setPlayer("")} onToggleTheme={toggleTheme} />;
}

function Crest({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span className="crest" style={{ background: colorFor(name), width: size, height: size * 1.12, fontSize: size * 0.46 }} title={name}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
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
  const known = uniq([...(data?.progress.map((p) => p.player) ?? []), ...(data?.players.map((p) => p.name) ?? [])]);
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
                  <Crest name={k} size={40} />
                  <span>{k}</span>
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

function Tracker({ player, onChangePlayer, onToggleTheme }: { player: string; onChangePlayer: () => void; onToggleTheme: () => void }) {
  const data = useQuery(api.steps.list);
  const [revealed, setRevealed] = useLocal<string[]>(`revealed:${player}`, []);
  const [tab, setTab] = useState<Tab>("journal");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
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
  const isVisible = (s: Step) => isMine(s) || revealed.includes(s._id);
  const others = uniq([...data.progress.map((p) => p.player), ...data.players.map((p) => p.name)]).filter((p) => p !== player);
  const players = [player, ...others];
  const visible = data.steps.filter(isVisible);
  const sealed = data.steps.filter((s) => !isVisible(s));
  const statusOf = (name: string) => data.players.find((p) => p.name === name);

  const pool = tab === "sealed" ? sealed : visible;
  const chipCounts = new Map<string, number>();
  for (const s of pool) chipCounts.set(s.category, (chipCounts.get(s.category) ?? 0) + 1);
  const activeCategory = chipCounts.has(category) ? category : "";

  const q = norm(search);
  const filtered = pool.filter(
    (s) =>
      (!activeCategory || s.category === activeCategory) &&
      (tab === "sealed" || !q || [s.subject, s.action, s.location, s.how, s.category].some((f) => norm(f).includes(q))),
  );

  const saveCard = (name: string) => (
    <SaveCard
      key={name}
      name={name}
      isMe={name === player}
      steps={data.steps}
      doneBy={doneBy}
      progress={data.progress}
      status={statusOf(name)}
      locations={uniq(visible.map((s) => s.location))}
    />
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Hyrule Log</span>
          <div className="topbar-actions">
            <button className="icon-btn" onClick={onToggleTheme} title="Day / night">
              <Icon name="eye" size={18} />
            </button>
            <button className="me" onClick={onChangePlayer} title="Switch save">
              <Crest name={player} size={22} />
              <span className="me-name">{player}</span>
            </button>
            <button className="btn primary hide-mobile" onClick={() => setDialog({ mode: "add", initial: EMPTY })}>
              <Icon name="quill" size={18} /> Log a step
            </button>
          </div>
        </div>
      </header>

      <div className="layout">
        <main className="main">
          <nav className="tabs" role="tablist">
            <TabButton id="journal" tab={tab} setTab={setTab} icon="scroll" label="Journal" count={visible.length} />
            <TabButton id="sealed" tab={tab} setTab={setTab} icon="lock" label="Sealed" count={sealed.length} />
            <TabButton id="saves" tab={tab} setTab={setTab} icon="save" label="Save Logs" count={players.length} />
          </nav>

          {tab === "saves" ? (
            <div className="save-grid">{players.map(saveCard)}</div>
          ) : (
            <>
              {tab === "journal" && saveCard(player)}

              {tab === "journal" && (
                <label className="search">
                  <Icon name="search" size={18} />
                  <input type="search" placeholder="Search your journal" value={search} onChange={(e) => setSearch(e.target.value)} />
                </label>
              )}

              {chipCounts.size > 1 && (
                <div className="chips">
                  <button className={`chip ${!activeCategory ? "active" : ""}`} onClick={() => setCategory("")}>
                    All <span>{pool.length}</span>
                  </button>
                  {[...chipCounts.entries()]
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([c, n]) => (
                      <button key={c} className={`chip ${activeCategory === c ? "active" : ""}`} onClick={() => setCategory(c)}>
                        <Icon name={categoryIcon(c)} size={15} /> {c} <span>{n}</span>
                      </button>
                    ))}
                </div>
              )}

              {tab === "journal" ? (
                <Journal
                  steps={filtered}
                  player={player}
                  doneBy={doneBy}
                  searching={!!q || !!activeCategory}
                  onAdd={(initial) => setDialog({ mode: "add", initial })}
                  onEdit={(step) => setDialog({ mode: "edit", step })}
                />
              ) : (
                <Sealed
                  steps={filtered}
                  doneBy={doneBy}
                  onReveal={(id) => setRevealed([...revealed, id])}
                  revealedCount={revealed.length}
                  onHideAll={() => setRevealed([])}
                />
              )}
            </>
          )}
        </main>

        <aside className="side">
          <Activity progress={data.progress} steps={data.steps} isVisible={isVisible} />
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
          visible={visible}
          doneBy={doneBy}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function TabButton({ id, tab, setTab, icon, label, count }: { id: Tab; tab: Tab; setTab: (t: Tab) => void; icon: string; label: string; count: number }) {
  return (
    <button role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
      <Icon name={icon} size={17} /> {label} <span className="count">{count}</span>
    </button>
  );
}

/* ---------------- Save logs ---------------- */

function Hearts({ full, quarters }: { full: number; quarters: number }) {
  return (
    <div className="hearts" aria-label={`${full} hearts${quarters ? ` and ${quarters}/4` : ""}`}>
      {Array.from({ length: full }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className="heart full">
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
      ))}
      {quarters > 0 && (
        <svg viewBox="0 0 24 24" className="heart partial">
          <defs>
            <clipPath id={`q${quarters}`}>
              {/* quarters fill clockwise from top-left */}
              {quarters >= 1 && <rect x="0" y="0" width="12" height="12" />}
              {quarters >= 2 && <rect x="12" y="0" width="12" height="12" />}
              {quarters >= 3 && <rect x="12" y="12" width="12" height="12" />}
            </clipPath>
          </defs>
          <path className="empty" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
          <path clipPath={`url(#q${quarters})`} d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
      )}
    </div>
  );
}

function SaveCard({
  name,
  isMe,
  steps,
  doneBy,
  progress,
  status,
  locations,
}: {
  name: string;
  isMe: boolean;
  steps: Step[];
  doneBy: Map<string, string[]>;
  progress: Progress[];
  status?: PlayerDoc;
  locations: string[];
}) {
  const setStatus = useMutation(api.steps.setStatus);
  const [editing, setEditing] = useState(false);
  const [lastSeen, setLastSeen] = useState(status?.lastSeen ?? "");
  const [note, setNote] = useState(status?.note ?? "");

  const done = steps.filter((s) => doneBy.get(s._id)?.includes(name));
  const count = (cat: string) => done.filter((s) => s.category === cat).length;
  const pieces = count("Heart Piece");
  const hearts = BASE_HEARTS + count("Heart Container") + Math.floor(pieces / 4);

  // Fixed kinds count every entry; named kinds count distinct things.
  const tallies = new Map<string, Set<string>>();
  for (const s of done) {
    if (s.category === "Heart Piece" || s.category === "Heart Container") continue;
    const set = tallies.get(s.category) ?? new Set<string>();
    set.add(categoryInfo(s.category).fixed ? s._id : norm(s.subject));
    tallies.set(s.category, set);
  }
  const lastActive = progress.filter((p) => p.player === name).reduce((m, p) => Math.max(m, p._creationTime), 0);

  return (
    <section className={`frame save-card ${isMe ? "is-me" : ""}`}>
      <header className="save-head">
        <Crest name={name} size={38} />
        <div className="save-name">
          <h2>{name}</h2>
          <span className="muted small">{lastActive ? `active ${ago(lastActive)}` : "no steps yet"}</span>
        </div>
        <div className="save-steps">
          <b>{done.length}</b>
          <span>steps</span>
        </div>
      </header>

      <Hearts full={hearts} quarters={pieces % 4} />

      {tallies.size > 0 && (
        <div className="save-tallies">
          {[...tallies.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([c, set]) => (
              <span key={c} className="tally-tile" title={c}>
                <Icon name={categoryIcon(c)} size={18} />
                <b>{set.size}</b>
                <small>{c}</small>
              </span>
            ))}
        </div>
      )}

      {editing ? (
        <form
          className="save-edit"
          onSubmit={async (e) => {
            e.preventDefault();
            await setStatus({ player: name, lastSeen, note });
            setEditing(false);
          }}
        >
          <ComboField label="Last seen at" value={lastSeen} onChange={setLastSeen} options={locations} placeholder="Where you saved" />
          <label className="field">
            <span>Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you're up to, no spoilers" maxLength={200} />
          </label>
          <div className="dialog-actions">
            <button type="button" className="text-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="btn primary">
              Save
            </button>
          </div>
        </form>
      ) : (
        <div className="save-status">
          {status?.lastSeen || status?.note ? (
            <div className="save-status-text">
              {status.lastSeen && (
                <p>
                  <Icon name="pin" size={15} /> {status.lastSeen}
                </p>
              )}
              {status.note && <p className="save-note">“{status.note}”</p>}
            </div>
          ) : (
            <p className="muted small">{isMe ? "Say where you left off." : "No note yet."}</p>
          )}
          {isMe && (
            <button
              className="text-btn"
              onClick={() => {
                setLastSeen(status?.lastSeen ?? "");
                setNote(status?.note ?? "");
                setEditing(true);
              }}
            >
              <Icon name="edit" size={14} /> Update
            </button>
          )}
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

  // One card per (category, subject). Most recently touched first.
  const groups = new Map<string, Step[]>();
  for (const s of steps) {
    const key = `${norm(s.category)}|${norm(s.subject)}`;
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
  const info = categoryInfo(first.category);
  const mineCount = steps.filter((s) => doneBy.get(s._id)?.includes(player)).length;
  return (
    <article className="frame subject-card">
      <header>
        <div className="cat-badge">
          <Icon name={info.icon} size={22} />
        </div>
        <div className="subject-title">
          <h3>{info.fixed ? `${first.subject}s` : first.subject}</h3>
          {!info.fixed && <span className="eyebrow">{first.category}</span>}
        </div>
        <span className="tally" title="Entries you've done in this card">
          {mineCount}/{steps.length}
        </span>
      </header>
      <ol className="steps">
        {steps.map((s) => (
          <StepRow key={s._id} step={s} fixed={!!info.fixed} player={player} who={doneBy.get(s._id) ?? []} onEdit={() => onEdit(s)} />
        ))}
      </ol>
      <button className="add-next" onClick={() => onAdd({ ...EMPTY, category: first.category, subject: first.subject })}>
        <Icon name="plus" size={16} /> {info.fixed ? `Log another ${first.subject}` : `Add a step for ${first.subject}`}
      </button>
    </article>
  );
}

function StepRow({ step, fixed, player, who, onEdit }: { step: Step; fixed: boolean; player: string; who: string[]; onEdit: () => void }) {
  const setDone = useMutation(api.steps.setDone);
  const remove = useMutation(api.steps.remove);
  const [confirm, setConfirm] = useState(false);
  const mine = who.includes(player);
  // For fixed kinds (heart pieces…) the place is what tells entries apart, so it leads.
  const title = fixed ? step.location || step.action : step.action;
  return (
    <li className={`step ${mine ? "done" : ""}`}>
      <button
        className="check"
        aria-pressed={mine}
        title={mine ? "Mark as not done" : "Mark as done"}
        onClick={() => setDone({ stepId: step._id, player, done: !mine })}
      >
        <Icon name="check" size={16} />
      </button>
      <div className="step-body">
        <div className="step-head">
          <span className="step-action">{title}</span>
          {step.age && <span className={`age age-${norm(step.age)}`}>{step.age}</span>}
          {!mine && <span className="pill">revealed</span>}
        </div>
        {!fixed && step.location && (
          <p className="step-where">
            <Icon name="pin" size={14} /> {step.location}
          </p>
        )}
        {step.how && <p className="step-how">{step.how}</p>}
        <div className="step-foot">
          <div className="who">
            {who.map((p) => (
              <Crest key={p} name={p} size={18} />
            ))}
          </div>
          <span className="muted small">
            logged by {step.createdBy} · {ago(step._creationTime)}
          </span>
          <div className="row-actions">
            {confirm ? (
              <>
                <button className="text-btn danger" onClick={() => remove({ id: step._id })}>
                  Delete for everyone
                </button>
                <button className="text-btn" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button className="icon-btn sm" onClick={onEdit} title="Edit">
                  <Icon name="edit" size={15} />
                </button>
                <button className="icon-btn sm" onClick={() => setConfirm(true)} title="Delete">
                  <Icon name="trash" size={15} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/* ---------------- Sealed ---------------- */

function Sealed({
  steps,
  doneBy,
  onReveal,
  revealedCount,
  onHideAll,
}: {
  steps: Step[];
  doneBy: Map<string, string[]>;
  onReveal: (id: string) => void;
  revealedCount: number;
  onHideAll: () => void;
}) {
  return (
    <>
      <p className="sealed-intro">
        <Icon name="lock" size={16} /> Steps your party has logged that you haven't done yet. They stay sealed until you choose to reveal one.
      </p>
      {!steps.length ? (
        <div className="empty frame">
          <Icon name="lock" size={40} />
          <p>Nothing sealed. You've seen everything the party has logged.</p>
        </div>
      ) : (
        <div className="sealed-grid">
          {[...steps]
            .sort((a, b) => b._creationTime - a._creationTime)
            .map((s) => (
              <div key={s._id} className="sealed-card">
                <div className="seal" aria-hidden="true">
                  <Icon name={categoryIcon(s.category)} size={20} />
                </div>
                <span className="sealed-cat">{s.category}</span>
                <div className="who">
                  {(doneBy.get(s._id) ?? [s.createdBy]).map((p) => (
                    <Crest key={p} name={p} size={18} />
                  ))}
                </div>
                <button className="text-btn" onClick={() => onReveal(s._id)}>
                  <Icon name="eye" size={15} /> Break the seal
                </button>
              </div>
            ))}
        </div>
      )}
      {revealedCount > 0 && (
        <button className="text-btn center-btn" onClick={onHideAll}>
          <Icon name="eyeOff" size={15} /> Re-seal the {revealedCount} step{revealedCount === 1 ? "" : "s"} I revealed
        </button>
      )}
    </>
  );
}

/* ---------------- Sidebar ---------------- */

function Activity({ progress, steps, isVisible }: { progress: Progress[]; steps: Step[]; isVisible: (s: Step) => boolean }) {
  const byId = new Map(steps.map((s) => [s._id as string, s]));
  const recent = [...progress].sort((a, b) => b._creationTime - a._creationTime).slice(0, 14);
  return (
    <section className="frame panel">
      <h2 className="panel-title">Party Chronicle</h2>
      <Ornament />
      {!recent.length ? (
        <p className="muted small">Nothing yet.</p>
      ) : (
        <ul className="feed">
          {recent.map((p) => {
            const s = byId.get(p.stepId);
            if (!s) return null;
            const show = isVisible(s);
            const info = categoryInfo(s.category);
            return (
              <li key={p._id}>
                <Crest name={p.player} size={20} />
                <div>
                  <p>
                    <b>{p.player}</b>{" "}
                    {show ? (
                      <>
                        · {info.fixed ? s.subject : s.subject} <span className="muted">· {info.fixed ? s.location || s.action : s.action}</span>
                      </>
                    ) : (
                      <span className="muted">
                        sealed a <Icon name={info.icon} size={13} /> {s.category} step
                      </span>
                    )}
                  </p>
                  <span className="muted small">{ago(p._creationTime)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------- Form bits ---------------- */

const NEW = "__new__";

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
  visible,
  doneBy,
  onClose,
}: {
  state: NonNullable<DialogState>;
  player: string;
  steps: Step[];
  isMine: (s: Step) => boolean;
  visible: Step[];
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
  const known = CATEGORIES.some((c) => c.name === init.category);
  const [customCat, setCustomCat] = useState(!!init.category && !known);
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
    setCustomCat(false);
    setCustomAction(false);
    setF((prev) => ({
      ...prev,
      category: name,
      subject: next.fixed ?? (categoryInfo(prev.category).fixed ? "" : prev.subject),
      action: next.actions.includes(prev.action) ? prev.action : next.actions.length === 1 ? next.actions[0] : "",
    }));
  };

  // Dropdown options only come from steps you can already see, so choosing never spoils anything.
  const subjects = uniq(visible.filter((s) => norm(s.category) === norm(f.category)).map((s) => s.subject));
  const locations = uniq(visible.map((s) => s.location));
  const customCats = uniq(steps.map((s) => s.category)).filter((c) => !CATEGORIES.some((k) => k.name === c));
  const actionOptions = uniq([...info.actions, ...visible.filter((s) => norm(s.category) === norm(f.category)).map((s) => s.action)]);
  const showActionInput = customAction || (!!f.action && !actionOptions.includes(f.action));
  const canSave = f.category.trim() && f.subject.trim() && f.action.trim();

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
          (!info.fixed || (!!f.location.trim() && norm(s.location) === norm(f.location))),
      );
      if (matches.length) {
        setDupes(matches);
        return;
      }
    }
    setBusy(true);
    try {
      if (state.mode === "edit") await update({ id: state.step._id as Id<"steps">, ...f });
      else await add({ player, ...f });
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
                    className={`cat-tile ${!customCat && f.category === c.name ? "active" : ""}`}
                    onClick={() => pickCategory(c.name)}
                  >
                    <Icon name={c.icon} size={22} />
                    <span>{c.name}</span>
                  </button>
                ))}
                {customCats.map((c) => (
                  <button type="button" key={c} className={`cat-tile ${!customCat && f.category === c ? "active" : ""}`} onClick={() => pickCategory(c)}>
                    <Icon name="star" size={22} />
                    <span>{c}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`cat-tile ${customCat ? "active" : ""}`}
                  onClick={() => {
                    setCustomCat(true);
                    setF((prev) => ({ ...prev, category: "", subject: categoryInfo(prev.category).fixed ? "" : prev.subject }));
                  }}
                >
                  <Icon name="plus" size={22} />
                  <span>New kind…</span>
                </button>
              </div>
              {customCat && (
                <input className="mt" autoFocus value={f.category} onChange={(e) => set("category", e.target.value)} placeholder="Name the new kind" />
              )}
            </fieldset>

            {f.category && (
              <div className="form-rest" key={customCat ? "custom" : f.category}>
                {!info.fixed && (
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
                  </div>
                  {showActionInput && (
                    <input className="mt" autoFocus value={f.action} onChange={(e) => set("action", e.target.value)} placeholder="Describe the step" />
                  )}
                </fieldset>

                <ComboField label="Where?" value={f.location} onChange={(v) => set("location", v)} options={locations} placeholder="Where it happened" />

                <label className="field">
                  <span>How?</span>
                  <textarea rows={3} value={f.how} onChange={(e) => set("how", e.target.value)} placeholder={info.howPlaceholder ?? "What you did"} />
                </label>

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
