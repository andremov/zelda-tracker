// The game's fixed lists. These name things that exist; they say nothing about where or how to get them.
export type Group = { label: string; items: string[] };

export const ITEMS: Group[] = [
  {
    label: "Items",
    items: [
      "Deku Sticks",
      "Deku Nuts",
      "Bombs",
      "Fairy Slingshot",
      "Fairy Ocarina",
      "Ocarina of Time",
      "Bombchus",
      "Boomerang",
      "Fairy Bow",
      "Hookshot",
      "Longshot",
      "Megaton Hammer",
      "Lens of Truth",
      "Magic Beans",
      "Fire Arrow",
      "Ice Arrow",
      "Light Arrow",
      "Din's Fire",
      "Farore's Wind",
      "Nayru's Love",
    ],
  },
  { label: "Quest items", items: ["Light Medallion", "Echo Gem", "Gerudo's Card"] },
  { label: "Other", items: ["Epona"] },
  { label: "Child trading items", items: ["Weird Egg", "Chicken", "Zelda's Letter"] },
  {
    label: "Adult trading items",
    items: [
      "Pocket Egg",
      "Pocket Cucco",
      "Cojiro",
      "Odd Mushroom",
      "Odd Potion",
      "Poacher's Saw",
      "Broken Goron's Sword",
      "Prescription",
      "Eyeball Frog",
      "World's Finest Eye Drops",
      "Claim Check",
    ],
  },
];

export const UPGRADES: Group[] = [
  { label: "Capacity", items: ["Bullet Bag Upgrade", "Quiver Upgrade", "Bomb Bag Upgrade", "Deku Stick Upgrade", "Deku Nut Upgrade"] },
  { label: "Rupees", items: ["Adult's Wallet", "Giant's Wallet"] },
  { label: "Strength", items: ["Goron's Bracelet", "Silver Gauntlets", "Golden Gauntlets"] },
  { label: "Diving", items: ["Silver Scale", "Golden Scale"] },
  { label: "Magic & defense", items: ["Double Magic", "Double Defense"] },
];

export const EQUIPMENT: Group[] = [
  { label: "Swords", items: ["Kokiri Sword", "Master Sword", "Giant's Knife", "Biggoron's Sword"] },
  { label: "Shields", items: ["Deku Shield", "Hylian Shield", "Mirror Shield"] },
  { label: "Tunics", items: ["Goron Tunic", "Zora Tunic"] },
  { label: "Boots", items: ["Iron Boots", "Hover Boots"] },
];

export const SONGS: Group[] = [
  {
    label: "Songs",
    items: ["Zelda's Lullaby", "Epona's Song", "Saria's Song", "Sun's Song", "Song of Time", "Song of Storms"],
  },
  {
    label: "Warp songs",
    items: ["Minuet of Forest", "Bolero of Fire", "Serenade of Water", "Requiem of Spirit", "Nocturne of Shadow", "Prelude of Light"],
  },
];

export const MASKS: Group[] = [
  { label: "Masks", items: ["Keaton Mask", "Skull Mask", "Spooky Mask", "Bunny Hood", "Mask of Truth", "Goron Mask", "Zora Mask", "Gerudo Mask"] },
];

export const DUNGEONS: Group[] = [
  { label: "Child", items: ["Inside the Deku Tree", "Dodongo's Cavern", "Inside Jabu-Jabu's Belly", "Bottom of the Well"] },
  {
    label: "Adult",
    items: [
      "Forest Temple",
      "Fire Temple",
      "Water Temple",
      "Shadow Temple",
      "Spirit Temple",
      "Ice Cavern",
      "Gerudo Training Ground",
      "Ganon's Castle",
    ],
  },
];

/** Dungeons without a boss. Kept off the save card's dungeon row, which is the main quest. */
export const MINI_DUNGEONS = ["Bottom of the Well", "Ice Cavern", "Gerudo Training Ground"];

/** Dungeons that end in a boss. Completing one also means its heart container and its stone or medallion. */
export const BOSS_DUNGEONS = [
  "Inside the Deku Tree",
  "Dodongo's Cavern",
  "Inside Jabu-Jabu's Belly",
  "Forest Temple",
  "Fire Temple",
  "Water Temple",
  "Shadow Temple",
  "Spirit Temple",
];

/** Each dungeon's progress checklist. Only dungeons that have a boss key, map or compass list them. */
const MAP_COMPASS = ["Entered", "Got the map", "Got the compass", "Completed"];
const WITH_BOSS_KEY = ["Entered", "Got the map", "Got the compass", "Got the boss key", "Completed"];
export const DUNGEON_STEPS: Record<string, string[]> = {
  "Inside the Deku Tree": MAP_COMPASS,
  "Dodongo's Cavern": MAP_COMPASS,
  "Inside Jabu-Jabu's Belly": MAP_COMPASS,
  "Bottom of the Well": MAP_COMPASS,
  "Ice Cavern": MAP_COMPASS,
  "Forest Temple": WITH_BOSS_KEY,
  "Fire Temple": WITH_BOSS_KEY,
  "Water Temple": WITH_BOSS_KEY,
  "Shadow Temple": WITH_BOSS_KEY,
  "Spirit Temple": WITH_BOSS_KEY,
  "Gerudo Training Ground": ["Entered", "Completed"],
  "Ganon's Castle": ["Entered", "Got the boss key", "Completed"],
};


/** The age each dungeon counts as, read off the groups above. */
export const DUNGEON_AGE: Record<string, string> = Object.fromEntries(DUNGEONS.flatMap((g) => g.items.map((d) => [d, g.label])));

/** Where each song is learned. Only shown once you pick the song, i.e. after you've learned it. */
export const SONG_PLACE: Record<string, string> = {
  "Zelda's Lullaby": "Castle Courtyard",
  "Epona's Song": "Lon Lon Ranch",
  "Saria's Song": "Sacred Forest Meadow",
  "Sun's Song": "Kakariko Graveyard",
  "Song of Time": "Hyrule Field",
  "Song of Storms": "Windmill",
  "Minuet of Forest": "Sacred Forest Meadow",
  "Bolero of Fire": "Death Mountain Crater",
  "Serenade of Water": "Ice Cavern",
  "Nocturne of Shadow": "Kakariko Village",
  "Requiem of Spirit": "Desert Colossus",
  "Prelude of Light": "Temple of Time",
};

/** The age each song is learned at. */
export const SONG_AGE: Record<string, string> = {
  "Zelda's Lullaby": "Child",
  "Epona's Song": "Child",
  "Saria's Song": "Child",
  "Sun's Song": "Child",
  "Song of Time": "Child",
  "Song of Storms": "Adult",
  "Minuet of Forest": "Adult",
  "Bolero of Fire": "Adult",
  "Serenade of Water": "Adult",
  "Nocturne of Shadow": "Adult",
  "Requiem of Spirit": "Adult",
  "Prelude of Light": "Adult",
};

/** Masks you sell have three steps; the rest can only be borrowed. */
const SOLD = ["Got it", "Delivered", "Paid"];
export const MASK_STEPS: Record<string, string[]> = {
  "Keaton Mask": SOLD,
  "Skull Mask": SOLD,
  "Spooky Mask": SOLD,
  "Bunny Hood": SOLD,
  "Mask of Truth": ["Got it"],
  "Goron Mask": ["Got it"],
  "Zora Mask": ["Got it"],
  "Gerudo Mask": ["Got it"],
};

/** Where each mask is delivered. Only shown once you pick the mask and "Delivered". */
export const MASK_DELIVERY: Record<string, string> = {
  "Keaton Mask": "Kakariko Village",
  "Skull Mask": "Lost Woods",
  "Spooky Mask": "Kakariko Graveyard",
  "Bunny Hood": "Hyrule Field",
};

/**
 * Where and at what age each item, piece of equipment and upgrade is first obtained.
 * Only fixed answers are listed: things with several sources leave out the place.
 * Only shown once you pick the thing, i.e. after you've got it.
 */
export const ACQUIRED: Record<string, { place?: string; age?: string }> = {
  // Items
  "Deku Sticks": { place: "Kokiri Forest", age: "Child" },
  "Deku Nuts": { place: "Kokiri Forest", age: "Child" },
  Bombs: { place: "Dodongo's Cavern", age: "Child" },
  "Fairy Slingshot": { place: "Inside the Deku Tree", age: "Child" },
  "Fairy Ocarina": { place: "Lost Woods Bridge", age: "Child" },
  "Ocarina of Time": { place: "Hyrule Field", age: "Child" },
  Boomerang: { place: "Inside Jabu-Jabu's Belly", age: "Child" },
  "Fairy Bow": { place: "Forest Temple", age: "Adult" },
  Hookshot: { place: "Kakariko Graveyard", age: "Adult" },
  Longshot: { place: "Water Temple", age: "Adult" },
  "Megaton Hammer": { place: "Fire Temple", age: "Adult" },
  "Lens of Truth": { place: "Bottom of the Well", age: "Child" },
  "Magic Beans": { place: "Zora's River", age: "Child" },
  "Fire Arrow": { place: "Lake Hylia", age: "Adult" },
  "Ice Arrow": { place: "Gerudo Training Ground", age: "Adult" },
  "Light Arrow": { place: "Temple of Time", age: "Adult" },
  "Din's Fire": { place: "Hyrule Castle Great Fairy Fountain", age: "Child" },
  "Farore's Wind": { place: "Zora's Fountain Great Fairy Fountain", age: "Child" },
  "Nayru's Love": { place: "Colossus Great Fairy Fountain", age: "Child" },
  Epona: { place: "Lon Lon Ranch", age: "Adult" },
  // Quest items
  "Light Medallion": { place: "Temple of Time", age: "Adult" },
  "Echo Gem": { place: "House of Skulltula", age: "Either" },
  "Gerudo's Card": { place: "Gerudo's Fortress", age: "Adult" },
  // Trading items
  "Weird Egg": { place: "Hyrule Castle", age: "Child" },
  Chicken: { age: "Child" },
  "Zelda's Letter": { place: "Castle Courtyard", age: "Child" },
  "Pocket Egg": { place: "Kakariko Village", age: "Adult" },
  "Pocket Cucco": { age: "Adult" },
  Cojiro: { place: "Kakariko Village", age: "Adult" },
  "Odd Mushroom": { place: "Lost Woods", age: "Adult" },
  "Odd Potion": { place: "Granny's Potion Shop", age: "Adult" },
  "Poacher's Saw": { place: "Lost Woods", age: "Adult" },
  "Broken Goron's Sword": { place: "Carpenters' Tent", age: "Adult" },
  Prescription: { place: "Death Mountain Summit", age: "Adult" },
  "Eyeball Frog": { place: "Zora's Domain", age: "Adult" },
  "World's Finest Eye Drops": { place: "Lakeside Laboratory", age: "Adult" },
  "Claim Check": { place: "Death Mountain Summit", age: "Adult" },
  // Equipment
  "Kokiri Sword": { place: "Kokiri Training Area", age: "Child" },
  "Master Sword": { place: "Temple of Time", age: "Child" },
  "Giant's Knife": { place: "Goron City", age: "Adult" },
  "Biggoron's Sword": { place: "Death Mountain Summit", age: "Adult" },
  "Deku Shield": { place: "Kokiri Shop", age: "Child" },
  "Mirror Shield": { place: "Spirit Temple", age: "Adult" },
  "Goron Tunic": { place: "Goron City", age: "Adult" },
  "Zora Tunic": { place: "Zora's Domain", age: "Adult" },
  "Iron Boots": { place: "Ice Cavern", age: "Adult" },
  "Hover Boots": { place: "Shadow Temple", age: "Adult" },
  // Upgrades
  // Bag upgrades stack (the next size, whichever place comes first), so their place and age are asked.
  // Remake: 10 Skulltula tokens, holds 500.
  "Adult's Wallet": { place: "House of Skulltula", age: "Either" },
  "Giant's Wallet": { place: "House of Skulltula", age: "Either" },
  "Goron's Bracelet": { place: "Goron City", age: "Child" },
  "Silver Gauntlets": { place: "Spirit Temple", age: "Child" },
  "Golden Gauntlets": { place: "Ganon's Castle", age: "Adult" },
  "Silver Scale": { place: "Zora's Domain", age: "Child" },
  "Golden Scale": { place: "Fishing Pond", age: "Adult" },
  "Double Magic": { place: "Crater Great Fairy Fountain", age: "Adult" },
  "Double Defense": { place: "Ganon's Castle Great Fairy Fountain", age: "Adult" },
};

export const ACQUIRED_PLACE: Record<string, string> = Object.fromEntries(
  Object.entries(ACQUIRED).flatMap(([k, v]) => (v.place ? [[k, v.place]] : [])),
);
export const ACQUIRED_AGE: Record<string, string> = Object.fromEntries(
  Object.entries(ACQUIRED).flatMap(([k, v]) => (v.age ? [[k, v.age]] : [])),
);

/** The Great Fairy fountains. Visiting one counts as getting her gift, and the other way around (see convex/links.ts). */
export const GREAT_FAIRIES: Group[] = [
  {
    label: "Child",
    items: [
      "Hyrule Castle Great Fairy Fountain",
      "Zora's Fountain Great Fairy Fountain",
      "Colossus Great Fairy Fountain",
      "Death Mountain Great Fairy Fountain",
    ],
  },
  { label: "Adult", items: ["Crater Great Fairy Fountain", "Ganon's Castle Great Fairy Fountain"] },
];
export const GREAT_FAIRY_AGE: Record<string, string> = Object.fromEntries(GREAT_FAIRIES.flatMap((g) => g.items.map((f) => [f, g.label])));

/** Songs the frogs in Zora's River respond to, plus their minigame. */
export const FROGS: Group[] = [
  {
    label: "Frogs",
    items: ["Zelda's Lullaby", "Epona's Song", "Saria's Song", "Sun's Song", "Song of Time", "Song of Storms", "Frog minigame"],
  },
];

/** Heart pieces in the game. */
export const HEART_PIECES = 36;

/** Symbol for each dungeon on the save card (original icons, see src/icons.tsx). */
export const DUNGEON_ICON: Record<string, string> = {
  "Inside the Deku Tree": "tree",
  "Dodongo's Cavern": "cave",
  "Inside Jabu-Jabu's Belly": "fish",
  "Bottom of the Well": "well",
  "Forest Temple": "leaf",
  "Fire Temple": "flame",
  "Water Temple": "drop",
  "Shadow Temple": "moon",
  "Spirit Temple": "sun",
  "Ice Cavern": "snowflake",
  "Gerudo Training Ground": "swords",
  "Ganon's Castle": "tower",
};

/** Fill colour for each thing on the save card once it's collected. Muted to sit on parchment. */
export const SET_COLOR: Record<string, string> = {
  // Dungeons
  "Inside the Deku Tree": "#4f7a32",
  "Dodongo's Cavern": "#8a5a32",
  "Inside Jabu-Jabu's Belly": "#3f7f9a",
  "Forest Temple": "#2f6b3a",
  "Fire Temple": "#a8392a",
  "Water Temple": "#2f5f9e",
  "Shadow Temple": "#5a3f7a",
  "Spirit Temple": "#c07a23",
  "Gerudo Training Ground": "#b4924a",
  "Ganon's Castle": "#3b2a4a",
  // Songs
  "Zelda's Lullaby": "#c45c8a",
  "Epona's Song": "#9a5f35",
  "Saria's Song": "#4f8a3a",
  "Sun's Song": "#c9a227",
  "Song of Time": "#3f6fa8",
  "Song of Storms": "#5f6b78",
  "Minuet of Forest": "#2f7a3f",
  "Bolero of Fire": "#b23a2a",
  "Serenade of Water": "#2f6fae",
  "Requiem of Spirit": "#c9762a",
  "Nocturne of Shadow": "#6a3f8a",
  "Prelude of Light": "#c8a43a",
  // Great Fairies, by their gift
  "Hyrule Castle Great Fairy Fountain": "#b8432f",
  "Zora's Fountain Great Fairy Fountain": "#3f8a4f",
  "Colossus Great Fairy Fountain": "#3f6fb0",
  "Death Mountain Great Fairy Fountain": "#5a9a3f",
  "Crater Great Fairy Fountain": "#2f7a3a",
  "Ganon's Castle Great Fairy Fountain": "#a8304a",
};

/** Totals for the countable kinds, shown in a save log's breakdown. */
export const TOTALS: Record<string, number> = {
  "Heart Piece": 36,
  "Gold Skulltula": 100,
  "Big Poe": 10,
  Bottle: 5, // the remake has five
};
