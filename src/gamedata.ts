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
  { label: "Quest items", items: ["Light Medallion", "Stone of Agony", "Gerudo's Card"] },
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
  { label: "Slingshot ammo", items: ["Bullet Bag (40)", "Bullet Bag (50)"] },
  { label: "Arrows", items: ["Quiver (40)", "Quiver (50)"] },
  { label: "Bombs", items: ["Big Bomb Bag (30)", "Biggest Bomb Bag (40)"] },
  { label: "Rupees", items: ["Adult's Wallet", "Giant's Wallet"] },
  { label: "Deku capacity", items: ["Deku Sticks (20)", "Deku Sticks (30)", "Deku Nuts (30)", "Deku Nuts (40)"] },
  { label: "Strength", items: ["Goron's Bracelet", "Silver Gauntlets", "Golden Gauntlets"] },
  { label: "Diving", items: ["Silver Scale", "Golden Scale"] },
  { label: "Magic & defense", items: ["Magic Meter", "Double Magic", "Double Defense"] },
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
    items: ["Zelda's Lullaby", "Epona's Song", "Saria's Song", "Sun's Song", "Song of Time", "Song of Storms", "Scarecrow's Song"],
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

/** You can't complete a dungeon without these, so ticking Completed ticks them too. Map and compass are optional. */
export const COMPLETION_IMPLIES = ["Entered", "Got the boss key"];

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
  "Scarecrow's Song": "Lake Hylia",
  "Minuet of Forest": "Sacred Forest Meadow",
  "Bolero of Fire": "Death Mountain Crater",
  "Serenade of Water": "Ice Cavern",
  "Nocturne of Shadow": "Kakariko Village",
  "Requiem of Spirit": "Desert Colossus",
  "Prelude of Light": "Temple of Time",
};

/** The age each song is learned at. Scarecrow's Song spans both ages, so it isn't listed. */
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
  // Quest items
  "Light Medallion": { place: "Temple of Time", age: "Adult" },
  "Stone of Agony": { place: "House of Skulltula", age: "Either" },
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
  "Deku Shield": { age: "Child" },
  "Mirror Shield": { place: "Spirit Temple", age: "Adult" },
  "Goron Tunic": { place: "Goron City", age: "Adult" },
  "Zora Tunic": { place: "Zora's Domain", age: "Adult" },
  "Iron Boots": { place: "Ice Cavern", age: "Adult" },
  "Hover Boots": { place: "Shadow Temple", age: "Adult" },
  // Upgrades
  "Bullet Bag (40)": { place: "Lost Woods", age: "Child" },
  "Bullet Bag (50)": { place: "Market Shooting Gallery", age: "Child" },
  "Quiver (40)": { place: "Kakariko Shooting Gallery", age: "Adult" },
  "Quiver (50)": { place: "Gerudo's Fortress", age: "Adult" },
  "Big Bomb Bag (30)": { place: "Bombchu Bowling Alley", age: "Child" },
  "Biggest Bomb Bag (40)": { place: "Goron City", age: "Child" },
  "Adult's Wallet": { place: "House of Skulltula", age: "Either" },
  "Giant's Wallet": { place: "House of Skulltula", age: "Either" },
  "Deku Sticks (20)": { place: "Lost Woods", age: "Child" },
  "Deku Sticks (30)": { place: "Lost Woods", age: "Child" },
  "Deku Nuts (30)": { place: "Lost Woods", age: "Child" },
  "Deku Nuts (40)": { place: "Lost Woods", age: "Child" },
  "Goron's Bracelet": { place: "Goron City", age: "Child" },
  "Silver Gauntlets": { place: "Spirit Temple", age: "Child" },
  "Golden Gauntlets": { place: "Ganon's Castle", age: "Adult" },
  "Silver Scale": { place: "Zora's Domain", age: "Child" },
  "Golden Scale": { place: "Fishing Pond", age: "Adult" },
  "Magic Meter": { place: "Death Mountain Great Fairy Fountain", age: "Child" },
  "Double Magic": { place: "Crater Great Fairy Fountain", age: "Adult" },
  "Double Defense": { place: "Outside Ganon's Castle", age: "Adult" },
};

export const ACQUIRED_PLACE: Record<string, string> = Object.fromEntries(
  Object.entries(ACQUIRED).flatMap(([k, v]) => (v.place ? [[k, v.place]] : [])),
);
export const ACQUIRED_AGE: Record<string, string> = Object.fromEntries(
  Object.entries(ACQUIRED).flatMap(([k, v]) => (v.age ? [[k, v.age]] : [])),
);
