"""Read the newest Hookshot (OoT, Switch 2) save and tick everything it shows on Hyrule Log
(https://zelda-tracker.vercel.app) for one player. The site holds every entry already; this only ticks them,
by catalog key, and never unticks anything. Setup: see README.md next to this file.

  python sync.py             sync if the save changed since the last run
  python sync.py --every 300 keep running, syncing every 5 minutes
  python sync.py --dry-run   print what it would tick, change nothing
  python sync.py --force     sync even if the save didn't change
  python sync.py --show      print every key read from the save
  python sync.py --convex https://<deployment>.convex.cloud   tick on another deployment (testing)

Standard library only (Python 3.8+).
"""
import argparse, datetime, glob, json, os, struct, sys, time, unicodedata, urllib.request

CONVEX = "https://aromatic-weasel-508.convex.cloud"
HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "state.json")
LOG = os.path.join(HERE, "sync.log")
CONFIG = os.path.join(HERE, "config.json")
try:
    _config = json.load(open(CONFIG, encoding="utf-8"))
except OSError:
    sys.exit("Copy config.example.json to config.json and fill in your name and save folder (see README.md).")
PLAYER = _config["player"]  # exactly as on the site
SAVE_DIR = _config["save_dir"]  # the folder holding slot_00 ... slot_05
# What to look for in the save: map IDs of skulltulas and heart pieces, and the flags rewards set.
SAVE_KEYS = json.load(open(os.path.join(HERE, "savekeys.json"), encoding="utf-8"))


# ---------- save reading ----------

def murmur3(s: str) -> int:
    data = s.encode()
    c1, c2, h = 0xCC9E2D51, 0x1B873593, 0
    n = len(data) & ~3
    for i in range(0, n, 4):
        k = int.from_bytes(data[i:i + 4], "little")
        k = (k * c1) & 0xFFFFFFFF; k = ((k << 15) | (k >> 17)) & 0xFFFFFFFF; k = (k * c2) & 0xFFFFFFFF
        h ^= k; h = ((h << 13) | (h >> 19)) & 0xFFFFFFFF; h = (h * 5 + 0xE6546B64) & 0xFFFFFFFF
    tail, k = data[n:], 0
    if len(tail) >= 3: k ^= tail[2] << 16
    if len(tail) >= 2: k ^= tail[1] << 8
    if tail:
        k ^= tail[0]; k = (k * c1) & 0xFFFFFFFF; k = ((k << 15) | (k >> 17)) & 0xFFFFFFFF; k = (k * c2) & 0xFFFFFFFF
        h ^= k
    h ^= len(data)
    h ^= h >> 16; h = (h * 0x85EBCA6B) & 0xFFFFFFFF
    h ^= h >> 13; h = (h * 0xC2B2AE35) & 0xFFFFFFFF
    return h ^ (h >> 16)


def newest_save():
    files = glob.glob(os.path.join(SAVE_DIR, "slot_*", "progress.sav"))
    if not files:
        raise SystemExit("no progress.sav under " + SAVE_DIR)
    return max(files, key=os.path.getmtime)


def read_save(path):
    """({hash: raw u32} for every inline value, {u64 ids of collected placements})."""
    for attempt in range(3):
        d = open(path, "rb").read()
        if d[:4] == b"\x04\x03\x02\x01" and len(d) > 0x20:
            end = struct.unpack_from("<I", d, 8)[0]
            if 0x20 < end <= len(d):
                pairs = list(struct.iter_unpack("<II", d[0x20:end - (end - 0x20) % 8]))
                # The last section (marker 0, 32) holds one entry pointing at a list of 64-bit keys:
                # the placed objects you've collected (skulltulas, loose heart pieces, ...).
                ids = set()
                for i, (h, v) in enumerate(pairs):
                    if h == 0 and v == 32 and i + 1 < len(pairs):
                        off = pairs[i + 1][1]
                        if 0 < off < len(d):
                            ids = {k for (k,) in struct.iter_unpack("<Q", d[off:len(d) - (len(d) - off) % 8]) if k}
                return dict(pairs), ids
        time.sleep(2)  # caught the game mid-write
    raise RuntimeError("could not read " + path)


class Save:
    def __init__(self, raw, ids=frozenset()):
        self.raw, self.ids = raw, ids

    def flag(self, name):
        return self.raw.get(murmur3(name), 0) == 1

    def num(self, name):
        v = self.raw.get(murmur3(name), 0)
        return v - (1 << 32) if v >= 1 << 31 else v

    def got(self, actor):
        return self.flag("IsGet." + actor)


# ---------- what the save says (in Hyrule Log's terms) ----------

ITEMS = {  # subject: (actor flag, place, age) -- places/ages copied from the site's src/gamedata.ts
    "Deku Sticks": ("Item_DekuStick", "Kokiri Forest", "Child"),
    "Deku Nuts": ("Item_DekuNut", "Kokiri Forest", "Child"),
    "Bombs": ("Item_BombBag_Small", "Dodongo's Cavern", "Child"),
    "Fairy Slingshot": ("Weapon_Range_SlingShot", "Inside the Deku Tree", "Child"),
    "Fairy Ocarina": ("Item_Ocarina_Fairy", "Lost Woods Bridge", "Child"),
    "Ocarina of Time": ("Item_Ocarina_Time", "Hyrule Field", "Child"),
    "Bombchus": ("Item_Bombchu", "", ""),
    "Boomerang": ("Item_Boomerang", "Inside Jabu-Jabu's Belly", "Child"),
    "Fairy Bow": ("Weapon_Range_Bow", "Forest Temple", "Adult"),
    "Hookshot": ("Item_Hookshot", "Kakariko Graveyard", "Adult"),
    "Longshot": ("Item_Longshot", "Water Temple", "Adult"),
    "Megaton Hammer": ("Item_Hammer", "Fire Temple", "Adult"),
    "Lens of Truth": ("Armor_GlassTruth", "Bottom of the Well", "Child"),
    "Magic Beans": ("Item_MagicBean", "Zora's River", "Child"),
    "Fire Arrow": ("Item_Arrow_Fire", "Lake Hylia", "Adult"),
    "Ice Arrow": ("Item_Arrow_Ice", "Gerudo Training Ground", "Adult"),
    "Light Arrow": ("Item_Arrow_Light", "Temple of Time", "Adult"),
    "Din's Fire": ("Item_DinFire", "Hyrule Castle Great Fairy Fountain", "Child"),
    "Farore's Wind": ("Item_FaroreWind", "Zora's Fountain Great Fairy Fountain", "Child"),
    "Nayru's Love": ("Item_NayruLove", "Colossus Great Fairy Fountain", "Child"),
    "Light Medallion": ("Item_Medal_Light", "Temple of Time", "Adult"),
    "Echo Gem": ("Item_AgonyStone", "House of Skulltula", "Either"),
    "Gerudo's Card": ("Item_Token_Gerudo", "Gerudo's Fortress", "Adult"),
    "Weird Egg": ("Item_WeirdEgg", "Hyrule Castle", "Child"),
    "Chicken": ("Item_AlarmCucco", "", "Child"),
    "Zelda's Letter": ("Item_ZeldaLetter", "Castle Courtyard", "Child"),
    "Pocket Egg": ("Item_PocketEgg", "Kakariko Village", "Adult"),
    "Pocket Cucco": ("Item_PocketCucco", "", "Adult"),
    "Cojiro": ("Item_CojiroCucco", "Kakariko Village", "Adult"),
    "Odd Mushroom": ("Item_OddMushroom", "Lost Woods", "Adult"),
    "Odd Potion": ("Item_OddPowder", "Granny's Potion Shop", "Adult"),
    "Poacher's Saw": ("Item_PoacherSaw", "Lost Woods", "Adult"),
    "Broken Goron's Sword": ("Item_BrokenSword", "Carpenters' Tent", "Adult"),
    "Prescription": ("Item_Prescription", "Death Mountain Summit", "Adult"),
    "Eyeball Frog": ("Item_EyeballFrog", "Zora's Domain", "Adult"),
    "World's Finest Eye Drops": ("Item_EyeDrop", "Lakeside Laboratory", "Adult"),
    "Claim Check": ("Item_ClaimCheck", "Death Mountain Summit", "Adult"),
}
EQUIPMENT = {
    "Kokiri Sword": ("Weapon_Sword_Kokiri", "Kokiri Training Area", "Child"),
    "Master Sword": ("Weapon_Sword_Master", "Temple of Time", "Child"),
    "Giant's Knife": ("Weapon_Sword_Giant", "Goron City", "Adult"),
    "Biggoron's Sword": ("Weapon_Sword_Biggoron", "Death Mountain Summit", "Adult"),
    "Deku Shield": ("Weapon_Shield_Deku", "Kokiri Shop", "Child"),
    "Hylian Shield": ("Weapon_Shield_Hylian", "", ""),
    "Mirror Shield": ("Weapon_Shield_Mirror", "Spirit Temple", "Adult"),
    "Goron Tunic": ("Armor_Adult_Goron", "Goron City", "Adult"),
    "Zora Tunic": ("Armor_Adult_Zora", "Zora's Domain", "Adult"),
    "Iron Boots": ("Armor_Adult_HeavyBoot", "Ice Cavern", "Adult"),
    "Hover Boots": ("Armor_Adult_HoverBoot", "Shadow Temple", "Adult"),
}
UPGRADES = {
    "Adult's Wallet": ("Item_Wallet_Medium", "House of Skulltula", "Either"),
    "Giant's Wallet": ("Item_Wallet_Large", "House of Skulltula", "Either"),
    "Goron's Bracelet": ("Armor_Child_Gauntlet_Goron", "Goron City", "Child"),
    "Silver Gauntlets": ("Armor_Adult_Gauntlet_Silver", "Spirit Temple", "Child"),
    "Golden Gauntlets": ("Armor_Adult_Gauntlet_Gold", "Ganon's Castle", "Adult"),
    "Silver Scale": ("Item_Scale_Silver", "Zora's Domain", "Child"),
    "Golden Scale": ("Item_Scale_Gold", "Fishing Pond", "Adult"),
    "Double Magic": ("Item_FairyBless_MPDouble", "Crater Great Fairy Fountain", "Adult"),
    "Double Defense": ("Item_FairyBless_DefenseDouble", "Ganon's Castle Great Fairy Fountain", "Adult"),
}
STACKING = {  # one site entry per upgrade beyond the starting size
    "Bullet Bag Upgrade": ["Item_BulletBag_Medium", "Item_BulletBag_Large"],
    "Quiver Upgrade": ["Item_Quiver_Medium", "Item_Quiver_Large"],
    "Bomb Bag Upgrade": ["Item_BombBag_Medium", "Item_BombBag_Large"],
    "Deku Stick Upgrade": ["Item_StickBag_Medium", "Item_StickBag_Large"],
    "Deku Nut Upgrade": ["Item_NutBag_Medium", "Item_NutBag_Large"],
}
SONGS = {
    "Zelda's Lullaby": ("ZeldaLullaby", "Castle Courtyard", "Child"),
    "Epona's Song": ("EponaSong", "Lon Lon Ranch", "Child"),
    "Saria's Song": ("SariaSong", "Sacred Forest Meadow", "Child"),
    "Sun's Song": ("SunSong", "Kakariko Graveyard", "Child"),
    "Song of Time": ("TimeSong", "Hyrule Field", "Child"),
    "Song of Storms": ("StormSong", "Windmill", "Adult"),
    "Minuet of Forest": ("ForestMinuet", "Sacred Forest Meadow", "Adult"),
    "Bolero of Fire": ("FireBolero", "Death Mountain Crater", "Adult"),
    "Serenade of Water": ("WaterSerenade", "Ice Cavern", "Adult"),
    "Requiem of Spirit": ("SpiritRequiem", "Desert Colossus", "Adult"),
    "Nocturne of Shadow": ("ShadowNocturne", "Kakariko Village", "Adult"),
    "Prelude of Light": ("LightPrelude", "Temple of Time", "Adult"),
}
# The shop lends masks in order, and you must pay for one before borrowing the next.
MASK_ORDER = ["Keaton", "Skull", "Spooky", "Bunny", "Truth"]
MASK_NAME = {"Keaton": "Keaton Mask", "Skull": "Skull Mask", "Spooky": "Spooky Mask", "Bunny": "Bunny Hood",
             "Truth": "Mask of Truth", "Goron": "Goron Mask", "Zora": "Zora Mask", "Gerudo": "Gerudo Mask"}
MASK_DELIVERY = {"Keaton": "Kakariko Village", "Skull": "Lost Woods", "Spooky": "Kakariko Graveyard", "Bunny": "Hyrule Field"}
DUNGEONS = {  # subject: (DungeonInfo key, room-flag prefixes, boss counters, age, has boss key)
    "Inside the Deku Tree": ("InsideTheDekuTree", ["insidethedekutree"], ["Enemy_DungeonBoss_Gohma"], "Child", False),
    "Dodongo's Cavern": ("DodongoCavern", ["dodongocavern"], ["Enemy_DungeonBoss_Dodongo"], "Child", False),
    "Inside Jabu-Jabu's Belly": ("InsideJabuJabuBelly", ["insidejabujabubelly", "insidejabujabu"], ["Enemy_DungeonBoss_Barinade"], "Child", False),
    "Bottom of the Well": ("BottomOfTheWell", [], [], "Child", False),
    "Forest Temple": ("ForestTemple", ["foresttemple"], ["Enemy_DungeonBoss_PhantomGanon"], "Adult", True),
    "Fire Temple": ("FireTemple", ["firetemple"], ["Enemy_DungeonBoss_Volvagia", "Dm_Enemy_DungeonBoss_Volvagia"], "Adult", True),
    "Water Temple": ("WaterTemple", ["watertemple"], ["Enemy_DungeonBoss_Morpha"], "Adult", True),
    "Shadow Temple": ("ShadowTemple", ["shadowtemple"], ["Enemy_DungeonBoss_BongoBongo"], "Adult", True),
    "Spirit Temple": ("SpiritTemple", ["spirittemple"], ["Enemy_DungeonBoss_Twinrova"], "Adult", True),
    "Ice Cavern": ("IceCavern", [], [], "Adult", False),
    "Gerudo Training Ground": ("GerudoTrainingGround", ["gerudotrainingground"], [], "Adult", False),
    "Ganon's Castle": ("InsideGanonCastle", [], ["Enemy_DungeonBoss_Ganon"], "Adult", True),  # the final fight; Ganondorf comes before it
}
FAIRIES = {  # cutscene name: (fountain, age)
    "Din": ("Hyrule Castle Great Fairy Fountain", "Child"),
    "Frore": ("Zora's Fountain Great Fairy Fountain", "Child"),
    "Nayru": ("Colossus Great Fairy Fountain", "Child"),
    "Power": ("Death Mountain Great Fairy Fountain", "Child"),
    "Wisdom": ("Crater Great Fairy Fountain", "Adult"),
    "Courage": ("Ganon's Castle Great Fairy Fountain", "Adult"),
}
# Hall of Fallen Foes statues: name -> the monster whose defeat count unlocks it (the hall's own rule).
STATUES = {
    "Barinade": "Enemy_DungeonBoss_Barinade",
    "Bongo Bongo": "Enemy_DungeonBoss_BongoBongo",
    "Ganon": "Enemy_DungeonBoss_Ganon",
    "Ganondorf": "Enemy_DungeonBoss_Ganondorf",
    "Gohma": "Enemy_DungeonBoss_Gohma",
    "King Dodongo": "Enemy_DungeonBoss_Dodongo",
    "Morpha": "Enemy_DungeonBoss_Morpha",
    "Phantom Ganon": "Enemy_DungeonBoss_PhantomGanon",
    "Twinrova": "Enemy_DungeonBoss_Twinrova",
    "Volvagia": "Enemy_DungeonBoss_Volvagia",
    "Big Octo": "Enemy_MiddleBoss_BigOcto",
    "Dark Link": "Enemy_MiddleBoss_DarkLink",
    "Flare Dancer": "Enemy_MiddleBoss_FlareDancer",
    "Gerudo Thief": "Enemy_MiddleBoss_GerudoThief",
    "Iron Knuckle (Nabooru)": "Enemy_MiddleBoss_IronKnuckle_Nabooru",
    "Lizalfos": "Enemy_MiddleBoss_Lizalfos",
    "Meg, Firstborn": "Enemy_MiddleBoss_Poe_Meg",
    "Amy, Fourth Born": "Enemy_Poe_Amy",
    "Anubis": "Enemy_Anubis",
    "Armos": "Enemy_Amos",
    "Baby Dodongo": "Enemy_BabyDodongo",
    "Bari": "Enemy_Bari",
    "Beamos": "Enemy_Beamos",
    "Beth, Third Born": "Enemy_Poe_Beth",
    "Big Poe": "Enemy_Poe_Big",
    "Biri": "Enemy_Biri",
    "Blue Bubble": "Enemy_Bubble_Blue",
    "Blue Tektite": "Enemy_Tektite_Blue",
    "Business Scrub": "Enemy_Scrub_Business",
    "Dead Hand": "Enemy_DeadHand",
    "Deku Baba": "Enemy_Dekubaba",
    "Deku Scrub": "Enemy_Scrub_Deku",
    "Dinolfos": "Enemy_Dinolfos",
    "Dodongo": "Enemy_Dodongo",
    "False Door": "Enemy_TrickyDoor",
    "False Door (Spirit Temple)": "Enemy_TrickyDoor_SpiritTemple",
    "Fire Keese": "Enemy_Keese_Fire",
    "Flat the Younger": "Enemy_Poe_Flat",
    "Floormaster": "Enemy_Floormaster",
    "Flying Pot": "Enemy_FlyingPot",
    "Flying Tile": "Enemy_CrazyFloorTile",
    "Freezard": "Enemy_Freezard",
    "Giant Green Bubble": "Enemy_Bubble_Green_Big",
    "Gibdo": "Enemy_Gibdo",
    "Gohma Larva": "Enemy_Gohma_Larva",
    "Gold Skulltula": "Enemy_Skulltula_Gold",
    "Great Moblin": "Enemy_Moblin_Club",
    "Green Bubble": "Enemy_Bubble_Green",
    "Guay": "Enemy_Guay",
    "Ice Keese": "Enemy_Keese_Ice",
    "Iron Knuckle (black)": "Enemy_IronKnuckle_Black",
    "Iron Knuckle (silver)": "Enemy_IronKnuckle_Silver",
    "Iron Knuckle (white)": "Enemy_IronKnuckle_White",
    "Jo, Second Born": "Enemy_Poe_Joelle",
    "Keese": "Enemy_Keese",
    "Leever": "Enemy_Leever",
    "Leever Leader": "Enemy_Leever_Big",
    "Like Like": "Enemy_LikeLike",
    "Mad Scrub": "Enemy_Scrub_Mad",
    "Moblin": "Enemy_Moblin",
    "Octorok": "Enemy_Octorok",
    "Peahat": "Enemy_Peahat",
    "Peahat Larva": "Enemy_Peahat_Larva",
    "Poe": "Enemy_Poe",
    "Poe (Hyrule Field)": "Enemy_Poe_Hyrule",
    "ReDead": "Enemy_ReDead",
    "Red Bubble": "Enemy_Bubble_Red",
    "Red Tektite": "Enemy_Tektite_Red",
    "Shabom": "Enemy_Shabom",
    "Sharp the Elder": "Enemy_Poe_Sharp",
    "Shell Blade": "Enemy_ShellBlade",
    "Skull Kid": "Enemy_SkullKid",
    "Skulltula": "Enemy_Skulltula",
    "Skullwalltula": "Enemy_Skullwalltula",
    "Spike": "Enemy_Spike",
    "Stalchild": "Enemy_Stalchild",
    "Stalfos": "Enemy_Stalfos_ShadowTemple",
    "Stinger": "Enemy_Stinger",
    "Tailpasaran": "Enemy_Tailpasaran",
    "Torch Slug": "Enemy_TorchSlug",
    "Wallmaster": "Enemy_Wallmaster",
    "Weak Stalfos": "Enemy_Stalfos_Weak",
    "White Bubble": "Enemy_Bubble_White",
    "White Wolfos": "Enemy_Wolfos_White",
    "Wolfos": "Enemy_Wolfos",
}
# The rematch gauntlets: 3 battles (child era), 5 (adult era), all 10.
GAUNTLETS = {"Trial of the Spiritual Stones": "Npc_Dream_BossRush_Cleared",
               "Trial of the Five Sages": "Npc_Dream_BossRush_Cleared_01",
               "Trial of the Hero of Time": "Npc_Dream_BossRush_Cleared_02"}
FROGS = {"Zelda's Lullaby": "ZeldaLullaby", "Epona's Song": "EponaSong", "Saria's Song": "SariaSong",
         "Sun's Song": "SunSong", "Song of Time": "TimeSong", "Song of Storms": "StormSong"}


def step(category, subject, action, location="", age=""):
    return {"category": category, "subject": subject, "action": action, "location": location, "how": "", "age": age}


def from_save(s: Save):
    """(named steps, {countable category: count}, {stacking upgrade: count})"""
    out = []
    for table, cat in ((ITEMS, "Item"), (EQUIPMENT, "Equipment"), (UPGRADES, "Upgrade")):
        for subject, (actor, place, age) in table.items():
            if s.got(actor):
                out.append(step(cat, subject, "Got it", place, age))
    epona = s.flag("HaveTalked_Special.Get_Epona_AfterEscapeFromLonLonRanch_Npc_Hylia_Ingo_002_Adult_Talk_Event298")
    if epona:
        out.append(step("Item", "Epona", "Got it", "Lon Lon Ranch", "Adult"))
    for subject, (melody, place, age) in SONGS.items():
        if s.got("Item_Melody_" + melody):
            out.append(step("Song", subject, "Learned", place, age))
    have = {m: s.got("Armor_Child_Mask_" + m) for m in MASK_NAME}
    for m, name in MASK_NAME.items():
        if have[m]:
            out.append(step("Mask", name, "Got it", "Happy Mask Shop", "Child"))
    for i, m in enumerate(MASK_ORDER[:-1]):
        later = any(have[n] for n in MASK_ORDER[i + 1:])
        if later or (m == "Bunny" and s.flag("IsAfterSell_Mask_Bunny")):
            out.append(step("Mask", MASK_NAME[m], "Delivered", MASK_DELIVERY[m], "Child"))
        if later:
            out.append(step("Mask", MASK_NAME[m], "Paid", "Happy Mask Shop", "Child"))
    rooms = json.load(open(os.path.join(HERE, "roomflags.json")))
    for subject, (key, prefixes, bosses, age, bosskey) in DUNGEONS.items():
        info = lambda f: s.flag("DungeonInfo.%s.%s" % (key, f))
        done = any(s.num("DefeatedEnemyNum." + b) > 0 for b in bosses)
        if subject == "Gerudo Training Ground":
            done = s.got("Item_Arrow_Ice")
        if subject == "Bottom of the Well":
            done = s.got("Armor_GlassTruth")
        if subject == "Ice Cavern":
            done = s.got("Armor_Adult_HeavyBoot")
        acts = []
        if info("IsGetMap"): acts.append("Got the map")
        if info("IsGetCompass"): acts.append("Got the compass")
        if bosskey and info("IsGetBossKey"): acts.append("Got the boss key")
        if done: acts.append("Completed")
        # The Bottom of the Well sets some ShadowTemple_* room flags; the temple itself needs the Nocturne to reach.
        reachable = subject != "Shadow Temple" or s.got("Item_Melody_" + SONGS["Nocturne of Shadow"][0])
        if acts or (reachable and any(s.flag(n) for p in prefixes for n in rooms.get(p, []))):
            acts.insert(0, "Entered")
        for a in acts:
            out.append(step("Dungeon", subject, a, subject, age))
    for cut, (fountain, age) in FAIRIES.items():
        if s.flag("HavePlayedEvent.Dm_FairyFountain_" + cut):
            out.append(step("Great Fairy", fountain, "Got the gift", fountain, age))
    for subject, flag in FROGS.items():
        if s.flag("MiniGame_FrogTenors_" + flag):
            out.append(step("Frogs", subject, "Played it", "Zora's River", "Child"))
    if s.flag("MiniGame_FrogTenors_InsectRepellent_ClearAfter"):
        out.append(step("Frogs", "Frog minigame", "Played it", "Zora's River", "Child"))
    # Hall of Fallen Foes. The Shadow Temple Stalfos statue also needs the hall's own Stalfos fight.
    for subject, actor in STATUES.items():
        if actor == "Enemy_Stalfos_ShadowTemple":
            unlocked = s.flag("DreamWorld_DefeatStalfos") and s.num("DefeatedEnemyNum.Enemy_Stalfos") > 0
        else:
            unlocked = s.num("DefeatedEnemyNum." + actor) > 0
        if unlocked:
            out.append(step("Monster Statue", subject, "Got it", "Hall of Fallen Foes", ""))
    for subject, flag in GAUNTLETS.items():
        if s.flag(flag):
            out.append(step("Rematch Gauntlet", subject, "Cleared", "Hall of Fallen Foes", ""))

    # Heart pieces: max life is in quarter hearts; 3 hearts to start, one container per boss.
    containers = sum(1 for name, (_, _, bosses, _, _) in DUNGEONS.items() if bosses and name != "Ganon's Castle"
                     and any(s.num("DefeatedEnemyNum." + b) > 0 for b in bosses))
    pieces = s.num("PlayerStatus.MaxLife") - 4 * (3 + containers) + s.num("PouchData.Obj_Heart_Piece.StockNum")
    counts = {
        "Gold Skulltula": s.num("PouchData.Item_Token_Gold.StockNum"),
        # The per-Poe HyruleField_Defeat_BigPoe_NN flags are never set in this remake; the defeat count is.
        "Big Poe": min(10, max(0, s.num("DefeatedEnemyNum.Enemy_Poe_Big"))),
    }
    if 0 <= pieces <= 36:
        counts["Heart Piece"] = pieces
    stacks = {u: sum(s.got(a) for a in actors) for u, actors in STACKING.items()}
    return out, counts, stacks


norm = lambda x: unicodedata.normalize("NFC", x or "").strip().lower()


# ---------- Hyrule Log ----------

def convex(kind, path, args, url=None):
    req = urllib.request.Request((url or CONVEX) + "/api/" + kind, method="POST",
                                 data=json.dumps({"path": path, "args": args, "format": "json"}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.loads(r.read().decode("utf-8"))
    if res.get("status") != "success":
        raise RuntimeError("%s %s: %s" % (kind, path, res.get("errorMessage", res)))
    return res["value"]


def keys(s, named, counts):
    """The site's catalog key for everything the save shows (see convex/catalog.ts in the site's repo):
    "category|subject|action" for named things, gs:/hp:<map id> for placed skulltulas and heart pieces,
    hp:/up:<flag> for rewards, poe:<nn> for Big Poes."""
    out = {"%s|%s|%s" % (st["category"], st["subject"], st["action"]) for st in named}
    out |= {"%s:%s" % (kind, k) for k, kind in SAVE_KEYS["placed"].items() if int(k) in s.ids}
    out |= {"hp:" + f for f in SAVE_KEYS["heart_flags"] if s.flag(f)}
    out |= {"up:" + f for f in SAVE_KEYS["upgrade_flags"] if s.flag(f)}
    # Big Poes are told apart only by count: the first n of poe:01..poe:10.
    out |= {"poe:%02d" % i for i in range(1, 1 + counts["Big Poe"])}
    return out


def log(msg):
    line = "%s %s" % (datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), msg)
    print(line)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--every", type=int, help="keep running, syncing every this many seconds")
    ap.add_argument("--dry-run", action="store_true", help="print what it would tick, change nothing")
    ap.add_argument("--force", action="store_true", help="sync even if the save didn't change")
    ap.add_argument("--show", action="store_true", help="print everything read from the save")
    ap.add_argument("--convex", help="another Convex deployment URL (e.g. a dev one), for testing")
    a = ap.parse_args()
    if not a.every:
        return sync(a)
    print("Syncing %s's save every %d seconds. Ctrl+C to stop." % (PLAYER, a.every))
    while True:
        try:
            sync(a)
        except Exception as ex:  # a bad read or a network blip shouldn't stop the loop
            log("error: %r" % ex)
        time.sleep(a.every)


def sync(a):
    path = newest_save()
    mtime = os.path.getmtime(path)
    try:
        state = json.load(open(STATE, encoding="utf-8"))
    except (OSError, ValueError):
        state = {}
    if not (a.force or a.dry_run or a.show or a.convex) and state.get("path") == path and state.get("mtime") == mtime:
        return

    s = Save(*read_save(path))
    named, counts, stacks = from_save(s)
    found = keys(s, named, counts)
    if a.show:
        print(path)
        for k in sorted(found): print("  " + k)
        print("  counts", counts, "\n  stacking upgrades", stacks)
        return
    live = convex("query", "steps:list", {}, a.convex)
    mine = {st.get("key") for st in live["steps"] if any(p["stepId"] == st["_id"] and norm(p["player"]) == norm(PLAYER)
                                                         for p in live["progress"])}
    new = sorted(found - mine)
    if a.dry_run:
        print("%d to tick from %s:" % (len(new), path))
        for k in new: print("  " + k)
        return
    if new:
        res = convex("mutation", "steps:tick", {"player": PLAYER, "keys": new}, a.convex)
        for t in res["ticked"]:
            log("ticked " + t)
        said = state.setdefault("unknown_said", [])
        for k in res["unknown"]:
            if k not in said:
                log("the site has no entry for " + k)
                said.append(k)
    if not a.convex:
        state.update(path=path, mtime=mtime)
        json.dump(state, open(STATE, "w", encoding="utf-8"))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except Exception as ex:  # keep a record when run headless
        log("error: %r" % ex)
        sys.exit(1)
