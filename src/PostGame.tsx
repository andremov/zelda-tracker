import type { Doc } from "../convex/_generated/dataModel";
import { Race } from "./Race";
import { Icon } from "./icons";
import { GAUNTLETS, STATUES } from "./gamedata";

type Step = Doc<"steps">;

const STATUE_COUNT = STATUES.reduce((n, g) => n + g.items.length, 0);
const GAUNTLET_COUNT = GAUNTLETS.reduce((n, g) => n + g.items.length, 0);

/**
 * The post-game, apart from the journal: the Hall of Fallen Foes race, where everyone stands,
 * and the statues and gauntlets someone has got (nothing nobody has got is shown).
 */
export function PostGame({
  players,
  me,
  steps,
  doneBy,
  total,
}: {
  players: string[];
  me: string;
  steps: Step[];
  doneBy: Map<string, string[]>;
  total: number;
}) {
  const has = (name: string, category: string) => steps.filter((s) => s.category === category && doneBy.get(s._id)?.includes(name)).length;
  const bySubject = (category: string) => new Map(steps.filter((s) => s.category === category).map((s) => [s.subject, s]));
  const statues = bySubject("Monster Statue");
  const gauntlets = bySubject("Rematch Gauntlet");

  const entry = (s: Step, icon: string) => (
    <li key={s._id} className="post-entry">
      <Icon name={icon} size={16} />
      <span className="post-name">{s.subject}</span>
      <span className="stamps">
        {(doneBy.get(s._id) ?? []).map((p) => (
          <span key={p} className={`stamp ${p === me ? "mine" : ""}`} title={`${p} got this`}>
            {p}
          </span>
        ))}
      </span>
    </li>
  );

  return (
    <div className="layout postgame">
      <Race players={players} me={me} steps={steps} doneBy={doneBy} total={total} modes={["postgame"]} />
      <main className="main">
        <section className="frame post-standings" aria-label="Standings">
          <h2 className="side-title">Hall of Fallen Foes</h2>
          <table className="post-table">
            <thead>
              <tr>
                <th />
                <th>
                  <Icon name="skull" size={16} /> Statues
                </th>
                <th>
                  <Icon name="tower" size={16} /> Gauntlets
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p} className={p === me ? "is-me" : ""}>
                  <th scope="row">{p}</th>
                  <td>
                    <b>{has(p, "Monster Statue")}</b> <span className="muted">/ {STATUE_COUNT}</span>
                  </td>
                  <td>
                    <b>{has(p, "Rematch Gauntlet")}</b> <span className="muted">/ {GAUNTLET_COUNT}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {gauntlets.size > 0 && (
          <section className="frame post-group">
            <h3 className="post-title">Rematch gauntlets</h3>
            <ul className="post-list">
              {GAUNTLETS.flatMap((g) => g.items)
                .map((n) => gauntlets.get(n))
                .filter((s): s is Step => !!s)
                .map((s) => entry(s, "tower"))}
            </ul>
          </section>
        )}

        {STATUES.map((g) => {
          const got = g.items.map((n) => statues.get(n)).filter((s): s is Step => !!s);
          return (
            got.length > 0 && (
              <section key={g.label} className="frame post-group">
                <h3 className="post-title">
                  {g.label} <span className="muted">· {got.length} found</span>
                </h3>
                <ul className="post-list">{got.map((s) => entry(s, "skull"))}</ul>
              </section>
            )
          );
        })}
      </main>
    </div>
  );
}
