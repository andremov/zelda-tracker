import type { ReactNode } from "react";
import { ACQUIRED_AGE, ACQUIRED_PLACE, FROGS, GREAT_FAIRIES, GREAT_FAIRY_AGE, DUNGEON_AGE, DUNGEON_STEPS, DUNGEONS, EQUIPMENT, ITEMS, MASK_DELIVERY, MASK_STEPS, MASKS, SONG_AGE, SONG_PLACE, SONGS, UPGRADES, type Group } from "./gamedata";

// Simple original line icons, 24x24, stroke-based.
const paths: Record<string, ReactNode> = {
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  heartPiece: (
    <>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6V20z" />
      <path d="M12 7.4A4 4 0 0 1 19 10c0 2.3-1.2 4.4-2.7 6" strokeDasharray="2 2.2" />
    </>
  ),
  spider: (
    <>
      <circle cx="12" cy="13" r="3.2" />
      <circle cx="12" cy="8.2" r="1.6" />
      <path d="M8.8 11 5 8M8.8 13H4M8.8 15 5 18M15.2 11 19 8M15.2 13H20M15.2 15 19 18" />
    </>
  ),
  mask: (
    <>
      <path d="M4 7c3-2 13-2 16 0 0 7-3 12-8 12S4 14 4 7z" />
      <path d="M8 11.5c.8-.7 1.8-.7 2.6 0M13.4 11.5c.8-.7 1.8-.7 2.6 0M10 15.5c1.2.7 2.8.7 4 0" />
    </>
  ),
  bag: (
    <>
      <path d="M6 9h12l-1 11H7L6 9z" />
      <path d="M9 9V7a3 3 0 0 1 6 0v2" />
    </>
  ),
  shield: <path d="M12 3 5 6v5c0 4.6 3 8.3 7 10 4-1.7 7-5.4 7-10V6l-7-3z" />,
  upgrade: (
    <>
      <path d="M12 19V6M7 11l5-5 5 5" />
      <path d="M6 20h12" />
    </>
  ),
  bottle: (
    <>
      <path d="M10 3h4M10.5 3v4L7 11.5V19a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-7.5L13.5 7V3" />
      <path d="M7 14h10" />
    </>
  ),
  note: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="16" r="2" />
    </>
  ),
  gem: (
    <>
      <path d="M6 9 9 4h6l3 5-6 11L6 9z" />
      <path d="M6 9h12M9 4l3 5 3-5M12 9v11" />
    </>
  ),
  door: (
    <>
      <path d="M5 21V10a7 7 0 0 1 14 0v11" />
      <path d="M3 21h18M12 21v-8M9 13h6" />
    </>
  ),
  skull: (
    <>
      <path d="M12 3a7 7 0 0 0-7 7c0 2.6 1.3 4.2 3 5v3h8v-3c1.7-.8 3-2.4 3-5a7 7 0 0 0-7-7z" />
      <circle cx="9.3" cy="10.5" r="1.4" />
      <circle cx="14.7" cy="10.5" r="1.4" />
      <path d="M10.5 18v2M13.5 18v2" />
    </>
  ),
  scroll: (
    <>
      <path d="M7 4h11v13a3 3 0 0 1-3 3H7" />
      <path d="M7 4a2 2 0 0 0-2 2v2h2M7 20a2 2 0 0 1-2-2v-1h10" />
      <path d="M10 9h5M10 12.5h5" />
    </>
  ),
  star: <path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4l16 16M9.9 6A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.5 7.6A17 17 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.3-1.1" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
  trash: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  pin: (
    <>
      <path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5" />
    </>
  ),
  activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  save: (
    <>
      <path d="M5 4h11l3 3v13H5V4z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </>
  ),
  poe: (
    <>
      <path d="M7 20V11a5 5 0 0 1 10 0v9l-2-1.5-1.5 1.5-1.5-1.5-1.5 1.5L9 18.5 7 20z" />
      <circle cx="10" cy="11" r="1" />
      <circle cx="14" cy="11" r="1" />
      <path d="M12 6V3.5M10.5 4.5h3" />
    </>
  ),
  frog: (
    <>
      <path d="M4 15c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5c0 2-1.8 3.5-4 3.5H8c-2.2 0-4-1.5-4-3.5z" />
      <circle cx="8.5" cy="8" r="2" />
      <circle cx="15.5" cy="8" r="2" />
      <path d="M9 14.5c1.8 1 4.2 1 6 0" />
    </>
  ),
  fairy: (
    <>
      <circle cx="12" cy="12" r="2.2" />
      <path d="M10.2 11C7 6 3.5 7 4 10s4 3.5 6.2 2.4M13.8 11C17 6 20.5 7 20 10s-4 3.5-6.2 2.4" />
      <path d="M10.6 13.6C8 17 9 19.5 11 18.5M13.4 13.6C16 17 15 19.5 13 18.5" />
    </>
  ),
  quill: <path d="M20 4c-6 1-11 6-13 13l-2 3 3-2c7-2 12-7 13-13l-1-1zM7 17l5-5" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, className }: { name: IconName | string; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.star}
    </svg>
  );
}

// Kinds of things, never specific ones. Each kind shapes the logging form:
// `fixed` kinds have no "what is it" field (every entry is the same thing, told apart by where),
// and `actions` are the step choices offered for that kind.
export type Category = {
  name: string;
  icon: IconName;
  fixed?: string;
  subjectLabel?: string;
  subjectPlaceholder?: string;
  actions: string[];
  freeAction?: boolean;
  /** Known things of this kind, offered as a dropdown. */
  options?: Group[];
  /** What the groups in `options` are, shown on the first dropdown. */
  groupNoun?: string;
  /** Always happens in this place, so the form doesn't ask. */
  place?: string;
  /** Always done at this age, so the form doesn't ask. */
  age?: string;
  /** Steps that always happen in the same place, so the form doesn't ask where. */
  stepLocations?: Record<string, string>;
  /** Things of this kind that are always done at one age. */
  subjectAge?: Record<string, string>;
  /** The thing is itself a place (a dungeon), so every step happens there. */
  subjectIsPlace?: boolean;
  /** Steps that differ per thing (each dungeon has its own). Falls back to `actions`. */
  subjectActions?: Record<string, string[]>;
  /** Things of this kind that always happen in one place. */
  subjectPlace?: Record<string, string>;
  /** A step whose place depends on the thing, e.g. where each mask is delivered: { step: { thing: place } }. */
  stepPlaceBySubject?: Record<string, Record<string, string>>;
  /** Nothing to explain once the rest is filled in, so the form doesn't ask "How?". */
  noHow?: boolean;
  /** Shown under the step choice, to explain what a step covers. */
  note?: string;
  howPlaceholder?: string;
};

export const CATEGORIES: Category[] = [
  { name: "Heart Piece", icon: "heartPiece", fixed: "Heart Piece", actions: ["Got it"], howPlaceholder: "What you did to get it" },
  { name: "Gold Skulltula", icon: "spider", fixed: "Gold Skulltula", actions: ["Got the token"], howPlaceholder: "How you found or reached it" },
  { name: "Big Poe", icon: "poe", fixed: "Big Poe", actions: ["Caught"], place: "Hyrule Field", age: "Adult", howPlaceholder: "Where in the field, and how you caught it" },
  { name: "Mask", icon: "mask", subjectLabel: "Which mask?", subjectPlaceholder: "Mask name", actions: ["Got it", "Delivered", "Paid"], options: MASKS, subjectActions: MASK_STEPS, age: "Child", stepLocations: { "Got it": "Happy Mask Shop", Paid: "Happy Mask Shop" }, stepPlaceBySubject: { Delivered: MASK_DELIVERY }, noHow: true },
  { name: "Item", icon: "bag", subjectLabel: "Which item?", subjectPlaceholder: "Item name", actions: ["Got it"], options: ITEMS, subjectPlace: ACQUIRED_PLACE, subjectAge: ACQUIRED_AGE },
  { name: "Equipment", icon: "shield", subjectLabel: "Which equipment?", subjectPlaceholder: "Sword, shield, tunic, boots…", actions: ["Got it"], options: EQUIPMENT, subjectPlace: ACQUIRED_PLACE, subjectAge: ACQUIRED_AGE },
  { name: "Upgrade", icon: "upgrade", subjectLabel: "What got upgraded?", subjectPlaceholder: "Quiver, wallet, bomb bag…", actions: ["Got it"], options: UPGRADES, subjectPlace: ACQUIRED_PLACE, subjectAge: ACQUIRED_AGE },
  { name: "Bottle", icon: "bottle", fixed: "Bottle", actions: ["Got it"] },
  { name: "Song", icon: "note", subjectLabel: "Which song?", subjectPlaceholder: "Song name", actions: ["Learned"], options: SONGS, subjectPlace: SONG_PLACE, subjectAge: SONG_AGE, noHow: true },
  { name: "Dungeon", icon: "door", subjectLabel: "Which dungeon?", subjectPlaceholder: "Dungeon name", actions: ["Entered", "Got the map", "Got the compass", "Got the boss key", "Completed"], options: DUNGEONS, subjectActions: DUNGEON_STEPS, groupNoun: "Age", subjectAge: DUNGEON_AGE, subjectIsPlace: true, note: "Completed means you beat the boss and got what it leaves behind: the heart container and the stone or medallion. That's one step. It also ticks your Entered and boss key, if someone has logged those.", noHow: true },
  { name: "Great Fairy", icon: "fairy", subjectLabel: "Which fountain?", actions: ["Got the gift"], options: GREAT_FAIRIES, groupNoun: "Age", subjectAge: GREAT_FAIRY_AGE, subjectIsPlace: true, noHow: true, note: "Counts as getting her gift too (a spell, magic or defense), and logging the gift counts as visiting her. Either way, both get ticked if someone has logged them." },
  { name: "Frogs", icon: "frog", subjectLabel: "Which song?", actions: ["Played it"], options: FROGS, place: "Zora's River", age: "Child", noHow: true, note: "Heart pieces from the frogs go under Heart Piece." },
];

const FALLBACK: Category = { name: "", icon: "star", subjectLabel: "What is it?", subjectPlaceholder: "Name it", actions: ["Got it", "Found", "Completed"], freeAction: true };

export const categoryInfo = (category: string): Category =>
  CATEGORIES.find((c) => c.name.toLowerCase() === category.trim().toLowerCase()) ?? { ...FALLBACK, name: category };

export const categoryIcon = (category: string): IconName => categoryInfo(category).icon;
