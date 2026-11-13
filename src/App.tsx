import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { useLocal } from "./storage";

type Step = Doc<"steps">;
type Fields = Pick<Step, "category" | "subject" | "action" | "location" | "how" | "age">;

// Generic suggestions only. They name kinds of things, never specific ones.
const CATEGORY_HINTS = [
  "Heart Piece",
  "Heart Container",
  "Gold Skulltula",
  "Mask",
  "Item",
  "Equipment",
  "Upgrade",
  "Bottle",
  "Song",
  "Quest Item",
  "Dungeon",
  "Boss",
  "Side Quest",
  "Other",
];
const ACTION_HINTS = ["Got it", "Delivered", "Paid", "Learned", "Traded", "Defeated", "Unlocked", "Talked to", "Completed"];
const EMPTY: Fields = { category: "", subject: "", action: "", location: "", how: "", age: "" };

const norm = (s: string) => s.trim().toLowerCase();
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));

export default function App() {
  const [player, setPlayer] = useLocal<string>("player", "");
  if (!player) return <PickName onPick={setPlayer} />;
  return <Tracker player={player} onChangePlayer={() => setPlayer("")} />;
}

function PickName({ onPick }: { onPick: (name: string) => void }) {
  const data = useQuery(api.steps.list);
  const known = uniq(data?.progress.map((p) => p.player) ?? []);
  const [name, setName] = useState("");
  return (
    <main className="pick">
      <h1>Hyrule Log</h1>
      <p>Who's playing on this device?</p>
      {known.length > 0 && (
        <div className="chips">
          {known.map((k) => (
            <button key={k} onClick={() => onPick(k)}>
              {k}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onPick(name.trim());
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New player name" maxLength={40} />
        <button type="submit">Start</button>
      </form>
    </main>
  );
}

function Tracker({ player, onChangePlayer }: { player: string; onChangePlayer: () => void }) {
  const data = useQuery(api.steps.list);
  const add = useMutation(api.steps.add);
  const setDone = useMutation(api.steps.setDone);
  const [revealed, setRevealed] = useLocal<string[]>(`revealed:${player}`, []);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [dupes, setDupes] = useState<{ fields: Fields; matches: Step[] } | null>(null);

  const doneBy = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const p of data?.progress ?? []) m.set(p.stepId, [...(m.get(p.stepId) ?? []), p.player]);
    return m;
  }, [data]);

  if (!data) return <main className="loading">Loading…</main>;

  const isMine = (s: Step) => doneBy.get(s._id)?.includes(player) ?? false;
  const isVisible = (s: Step) => isMine(s) || revealed.includes(s._id);
  const players = uniq([player, ...data.progress.map((p) => p.player)]);
  const categories = uniq([...CATEGORY_HINTS, ...data.steps.map((s) => s.category)]);
  // Subject suggestions come only from steps you can already see, so typing never spoils anything.
  const visibleSteps = data.steps.filter(isVisible);
  const subjects = uniq(visibleSteps.map((s) => s.subject));

  const q = norm(search);
  const matchesFilter = (s: Step) =>
    (!category || s.category === category) &&
    (!q || [s.subject, s.action, s.location, s.how, s.category].some((f) => norm(f).includes(q)));

  const shown = visibleSteps.filter(matchesFilter);
  const hidden = data.steps.filter((s) => !isVisible(s) && (!category || s.category === category));

  const submit = async (fields: Fields, force = false) => {
    if (!force) {
      // Someone may have logged this exact step already (hidden from you). Offer to check it off instead.
      const matches = data.steps.filter(
        (s) =>
          !isMine(s) &&
          norm(s.category) === norm(fields.category) &&
          norm(s.subject) === norm(fields.subject) &&
          norm(s.action) === norm(fields.action),
      );
      if (matches.length) {
        setDupes({ fields, matches });
        return;
      }
    }
    await add({ player, ...fields });
    setDupes(null);
    setShowAdd(false);
  };

  return (
    <main>
      <header>
        <h1>Hyrule Log</h1>
        <span className="who">
          Playing as <b>{player}</b> <button className="link" onClick={onChangePlayer}>change</button>
        </span>
      </header>

      <Scoreboard players={players} steps={data.steps} doneBy={doneBy} />

      <section className="toolbar">
        <button className="primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Close" : "+ Log a step"}
        </button>
        <input type="search" placeholder="Search your steps" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {uniq(data.steps.map((s) => s.category)).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </section>

      {showAdd && !dupes && (
        <StepForm initial={EMPTY} categories={categories} subjects={subjects} submitLabel="Log it" onSubmit={(f) => submit(f)} />
      )}

      {dupes && (
        <div className="card dupes">
          <p>
            Someone already logged <b>{dupes.fields.subject}</b>: <b>{dupes.fields.action}</b>. Is it the same thing you did?
          </p>
          {dupes.matches.map((s) => (
            <StepDetails key={s._id} step={s} doneBy={doneBy.get(s._id) ?? []} />
          ))}
          <div className="row">
            <button
              className="primary"
              onClick={async () => {
                for (const s of dupes.matches) await setDone({ stepId: s._id, player, done: true });
                setDupes(null);
                setShowAdd(false);
              }}
            >
              Yes, mark as done
            </button>
            <button onClick={() => submit(dupes.fields, true)}>No, log mine separately</button>
            <button className="link" onClick={() => setDupes(null)}>Back</button>
          </div>
        </div>
      )}

      <StepList steps={shown} player={player} doneBy={doneBy} categories={categories} subjects={subjects} />

      {hidden.length > 0 && (
        <section className="hidden-steps">
          <h2>Logged by others ({hidden.length})</h2>
          <p className="muted">Hidden so nothing gets spoiled. Reveal one only if you want to know.</p>
          <ul>
            {hidden.map((s) => (
              <li key={s._id} className="card hidden-card">
                <span className="tag">{s.category}</span>
                <span className="muted">done by {(doneBy.get(s._id) ?? [s.createdBy]).join(", ")}</span>
                <button onClick={() => setRevealed([...revealed, s._id])}>Reveal</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {revealed.length > 0 && (
        <p className="muted center">
          <button className="link" onClick={() => setRevealed([])}>Hide everything I revealed again</button>
        </p>
      )}
    </main>
  );
}

function Scoreboard({ players, steps, doneBy }: { players: string[]; steps: Step[]; doneBy: Map<string, string[]> }) {
  const cats = uniq(steps.map((s) => s.category));
  if (!cats.length) return null;
  const count = (p: string, c: string) => steps.filter((s) => s.category === c && doneBy.get(s._id)?.includes(p)).length;
  return (
    <section className="score">
      <table>
        <thead>
          <tr>
            <th />
            {players.map((p) => (
              <th key={p}>{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cats.map((c) => (
            <tr key={c}>
              <th>{c}</th>
              {players.map((p) => (
                <td key={p}>{count(p, c) || "·"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StepList(props: {
  steps: Step[];
  player: string;
  doneBy: Map<string, string[]>;
  categories: string[];
  subjects: string[];
}) {
  const { steps } = props;
  if (!steps.length) return <p className="muted center">Nothing logged here yet.</p>;
  // Group by category, then subject, so e.g. one mask's steps sit together.
  const byCat = new Map<string, Map<string, Step[]>>();
  for (const s of [...steps].sort((a, b) => a._creationTime - b._creationTime)) {
    const subj = byCat.get(s.category) ?? new Map<string, Step[]>();
    subj.set(s.subject, [...(subj.get(s.subject) ?? []), s]);
    byCat.set(s.category, subj);
  }
  return (
    <>
      {[...byCat.keys()].sort().map((cat) => (
        <section key={cat} className="category">
          <h2>{cat}</h2>
          {[...byCat.get(cat)!.entries()].map(([subject, list]) => (
            <div key={subject} className="subject">
              <h3>{subject}</h3>
              <ul>
                {list.map((s) => (
                  <StepRow key={s._id} step={s} {...props} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

function StepRow({
  step,
  player,
  doneBy,
  categories,
  subjects,
}: {
  step: Step;
  player: string;
  doneBy: Map<string, string[]>;
  categories: string[];
  subjects: string[];
}) {
  const setDone = useMutation(api.steps.setDone);
  const update = useMutation(api.steps.update);
  const remove = useMutation(api.steps.remove);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const who = doneBy.get(step._id) ?? [];
  const mine = who.includes(player);

  if (editing) {
    return (
      <li className="card">
        <StepForm
          initial={step}
          categories={categories}
          subjects={subjects}
          submitLabel="Save"
          onSubmit={async (f) => {
            await update({ id: step._id as Id<"steps">, ...f });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className={`card step ${mine ? "mine" : ""}`}>
      <label className="check">
        <input type="checkbox" checked={mine} onChange={(e) => setDone({ stepId: step._id, player, done: e.target.checked })} />
        <span>{mine ? "Done" : "Not yet"}</span>
      </label>
      <StepDetails step={step} doneBy={who} />
      <div className="actions">
        <button className="link" onClick={() => setEditing(true)}>edit</button>
        {confirmDelete ? (
          <>
            <button className="link danger" onClick={() => remove({ id: step._id })}>really delete?</button>
            <button className="link" onClick={() => setConfirmDelete(false)}>no</button>
          </>
        ) : (
          <button className="link" onClick={() => setConfirmDelete(true)}>delete</button>
        )}
      </div>
    </li>
  );
}

function StepDetails({ step, doneBy }: { step: Step; doneBy: string[] }) {
  return (
    <div className="details">
      <div>
        <b>{step.action}</b>
        {step.age && <span className="tag">{step.age}</span>}
      </div>
      {step.location && <div><span className="label">Where</span> {step.location}</div>}
      {step.how && <div><span className="label">How</span> {step.how}</div>}
      <div className="muted small">
        logged by {step.createdBy}
        {doneBy.length > 0 && <> · done by {doneBy.join(", ")}</>}
      </div>
    </div>
  );
}

function StepForm({
  initial,
  categories,
  subjects,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Fields;
  categories: string[];
  subjects: string[];
  submitLabel: string;
  onSubmit: (f: Fields) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [f, setF] = useState<Fields>({
    category: initial.category,
    subject: initial.subject,
    action: initial.action,
    location: initial.location,
    how: initial.how,
    age: initial.age,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Fields) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const id = useMemo(() => Math.random().toString(36).slice(2), []);

  return (
    <form
      className="card form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(f);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Category
        <input required list={`cat-${id}`} value={f.category} onChange={set("category")} placeholder="Heart Piece, Mask…" />
      </label>
      <label>
        What
        <input required list={`subj-${id}`} value={f.subject} onChange={set("subject")} placeholder="The thing itself, e.g. the mask's name" />
      </label>
      <label>
        Step
        <input required list={`act-${id}`} value={f.action} onChange={set("action")} placeholder="Got it, Delivered, Paid…" />
      </label>
      <label>
        Where
        <input value={f.location} onChange={set("location")} placeholder="Where it happened" />
      </label>
      <label className="wide">
        How
        <textarea value={f.how} onChange={set("how")} rows={3} placeholder="What you did to get it" />
      </label>
      <label>
        Age
        <select value={f.age} onChange={set("age")}>
          <option value="">-</option>
          <option>Child</option>
          <option>Adult</option>
          <option>Either</option>
        </select>
      </label>
      <p className="muted small wide">One step per entry. If something takes three actions, log three steps.</p>
      <div className="row wide">
        <button className="primary" type="submit" disabled={busy}>{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
      <datalist id={`cat-${id}`}>{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id={`subj-${id}`}>{subjects.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id={`act-${id}`}>{ACTION_HINTS.map((c) => <option key={c} value={c} />)}</datalist>
    </form>
  );
}
