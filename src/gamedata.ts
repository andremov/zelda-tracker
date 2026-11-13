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
  {
    label: "Dungeons",
    items: [
      "Inside the Deku Tree",
      "Dodongo's Cavern",
      "Inside Jabu-Jabu's Belly",
      "Forest Temple",
      "Fire Temple",
      "Water Temple",
      "Shadow Temple",
      "Spirit Temple",
      "Bottom of the Well",
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

/** The age each dungeon is played at. The Spirit Temple is played at both, so it isn't listed. */
export const DUNGEON_AGE: Record<string, string> = {
  "Inside the Deku Tree": "Child",
  "Dodongo's Cavern": "Child",
  "Inside Jabu-Jabu's Belly": "Child",
  "Bottom of the Well": "Child",
  "Forest Temple": "Adult",
  "Fire Temple": "Adult",
  "Water Temple": "Adult",
  "Shadow Temple": "Adult",
  "Ice Cavern": "Adult",
  "Gerudo Training Ground": "Adult",
  "Ganon's Castle": "Adult",
};
