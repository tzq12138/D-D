"""COC 7th Edition Investigator Generator — with random background stories"""
import random, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def roll(n, d, plus=0):
    return sum(random.randint(1, d) for _ in range(n)) + plus

SKILL_BASE = {
    "会计学":5,"人类学":1,"估价":5,"考古学":1,"艺术与手艺":5,"魅惑":15,"攀爬":20,
    "计算机使用":5,"信用评级":0,"克苏鲁神话":0,"乔装":5,"闪避":25,"汽车驾驶":20,
    "电气维修":10,"电子学":1,"话术":5,"格斗":25,"射击":20,"急救":30,"历史":5,
    "恐吓":15,"跳跃":20,"其他语言":1,"母语":50,"法律":5,"图书馆使用":20,"聆听":20,
    "锁匠":1,"机械维修":10,"医学":1,"博物学":10,"领航":10,"神秘学":5,"操作重型机械":1,
    "说服":10,"驾驶":1,"精神分析":1,"心理学":10,"骑术":5,"科学":1,"妙手":10,
    "侦查":25,"潜行":20,"生存":10,"游泳":20,"投掷":20,"追踪":10,
}

OCCUPATIONS = {
    "记者": {"credit":(9,30),"oskills":["艺术与手艺(摄影)","历史","图书馆使用","其他语言","话术","心理学","侦查","自选一"],"formula":"edu4"},
    "私家侦探": {"credit":(9,30),"oskills":["艺术与手艺(摄影)","乔装","法律","图书馆使用","话术","心理学","侦查","射击(手枪)"],"formula":"edu2_dex2"},
    "教授": {"credit":(20,70),"oskills":["图书馆使用","其他语言","母语","心理学","历史","神秘学","考古学","科学"],"formula":"edu4"},
    "医生": {"credit":(30,80),"oskills":["急救","其他语言(拉丁文)","医学","心理学","科学(生物学)","科学(药学)","精神分析","自选一"],"formula":"edu4"},
    "古文物学家": {"credit":(5,40),"oskills":["估价","艺术与手艺","历史","图书馆使用","其他语言","话术","侦查","神秘学"],"formula":"edu4"},
    "罪犯": {"credit":(5,65),"oskills":["话术","心理学","侦查","潜行","格斗(拳击)","射击(手枪)","锁匠","妙手"],"formula":"edu2_dex2"},
    "作家": {"credit":(9,30),"oskills":["艺术与手艺(文学)","历史","图书馆使用","博物学","其他语言","母语","心理学","神秘学"],"formula":"edu4"},
    "警察": {"credit":(9,30),"oskills":["格斗(拳击)","射击(手枪)","急救","法律","心理学","侦查","汽车驾驶","聆听"],"formula":"edu2_dex2"},
}

# --- Background generators ---
FIRST_NAMES_M = ["阿尔伯特","亨利","弗兰克","爱德华","乔治","沃尔特","查尔斯","亚瑟","约瑟夫","杰克"]
LAST_NAMES = ["莫里森","沃克","布莱克伍德","科尔","格雷","沙利文","奥康奈尔","里德","克劳福德","伯恩"]

IDEAS = [
    "金钱是这个世界唯一通用的语言，其余的不过是华丽的说辞。",
    "每个人都有价格，问题在于你有没有找到那个数字。",
    "社会这座大厦的锁芯，我比造锁的人更懂怎么打开它。",
    "过去犯的错太多，但总有办法用今后的事来弥补——我是说，一定程度上。",
    "这世界是个巨大的骗局，我只是学会了在舞台背面行走。",
]

PEOPLE = [
    ("文森特·罗西","地下钱庄老板，你的债主兼保护人。他信你，但信任是有利息的。"),
    ("玛格丽特·科尔","你的妹妹，嫁给了一位正直的检察官。她以为你是个普通的锁具经销商。"),
    ("汤米·奥哈拉","儿时玩伴，现在是码头的搬运工。他是少数几个见过你落魄一面的人。"),
    ("伊丽莎白·沃伦","阿卡姆图书馆的管理员，你们在一次'夜间光顾'中偶然相识，互相都假装对方是走错了路。"),
    ("约瑟夫·克劳利","退休的警察，在街上救过你一次。你不知道他为什么没抓你，但每年圣诞都会给他送一瓶波本。"),
]

PLACES = [
    ("老码头仓库 14 号","你在这里藏了一个工具箱，里面有你在深夜出入各种建筑物时需要的一切。"),
    ("波比的地下酒吧","波士顿北端一家没有招牌的酒吧，后门直通你的公寓。酒保记得你的名字但从不问问题。"),
    ("布罗德街锁具修理店","你体面的掩护身份。楼上的小公寓里堆满了报纸和咖啡罐，窗帘常年拉着——不是因为羞耻，而是因为方便。"),
    ("密斯卡托尼克河畔的长椅","你常在深夜独自坐在这里，看着对岸大学图书馆的灯火。有时候，你甚至不觉得自己是个坏人。"),
]

POSSESSIONS = [
    ("一套手工打造的撬锁工具","你父亲留给你的——他是一个真正的锁匠。这是他留下的唯一一件没有当掉的东西。"),
    ("一枚圣母像吊坠","你母亲临终前塞进你手里的。你不是信徒，但你从来不敢把它摘下来。"),
    ("一本袖珍版《麦克白》","你在一次闯空门时偷出来的，本来想卖掉，翻开第一页就没能合上。现在书脊都快散了。"),
    ("一把柯尔特警探特装版","枪柄上刻着不属于你的缩写。你不想谈它的来历，但它从来没卡过壳。"),
]

TRAITS = [
    ("凡事留后路","每次进入一栋建筑，你都会默记至少三条离开的路线。这个习惯救过你两次命。"),
    ("只偷该偷的人","你有一条不成文的规矩：不碰穷人、不碰小商户、不碰看起来已经在哭的人。这让你赚得少，但睡得稍好一些。"),
    ("手指不停敲","紧张的时候，你的右手食指会不由自主地在桌上敲出摩尔斯电码。你的母亲曾经是电报员。"),
    ("在黑暗中依然冷静","灯关了的时候，大多数人会慌。你不会。黑暗是你的工具，而不是敌人。"),
]

def gen_background(occ_name, credit, stats):
    first = random.choice(FIRST_NAMES_M)
    last = random.choice(LAST_NAMES)
    age = random.randint(25, 45)

    return {
        "name": f"{first}·{last}",
        "age": age,
        "idea": random.choice(IDEAS),
        "person": random.choice(PEOPLE),
        "place": random.choice(PLACES),
        "possession": random.choice(POSSESSIONS),
        "trait": random.choice(TRAITS),
    }

def base_for(skill_name):
    key = skill_name.split("(")[0] if "(" in skill_name else skill_name
    return SKILL_BASE.get(key, 5)

def gen_full():
    stats = {
        "STR": roll(3,6)*5, "CON": roll(3,6)*5, "SIZ": roll(2,6,6)*5,
        "DEX": roll(3,6)*5, "APP": roll(3,6)*5, "INT": roll(2,6,6)*5,
        "POW": roll(3,6)*5, "EDU": roll(2,6,6)*5, "LUCK": roll(3,6)*5,
    }
    hp = (stats["CON"] + stats["SIZ"]) // 10
    san = stats["POW"]
    mp = stats["POW"] // 5

    total = stats["STR"] + stats["SIZ"]
    if total < 65:   db, build = "-2", -2
    elif total < 85: db, build = "-1", -1
    elif total < 125: db, build = "0", 0
    elif total < 165: db, build = "+1D4", 1
    elif total < 205: db, build = "+1D6", 2
    else:            db, build = "+2D6", 3

    above = sum(1 for v in [stats["STR"], stats["DEX"]] if v >= stats["SIZ"])
    mov = 7 if above == 0 else (8 if above == 1 else 9)

    occ_name = random.choice(list(OCCUPATIONS.keys()))
    occ = OCCUPATIONS[occ_name]
    credit_min, credit_max = occ["credit"]
    credit = random.randint(credit_min, credit_max)

    if occ["formula"] == "edu4":
        occ_pts = stats["EDU"] * 4
    else:
        occ_pts = stats["EDU"] * 2 + stats["DEX"] * 2

    int_pts = stats["INT"] * 2

    skills = {}
    def add_skill(name, pts):
        key = name.split("(")[0] if "(" in name else name
        if key not in skills:
            skills[key] = {"name": name, "val": base_for(name)}
        skills[key]["val"] += pts

    raw_oskills = list(occ["oskills"])
    alloc = []
    base_alloc = occ_pts // len(raw_oskills)
    remainder = occ_pts % len(raw_oskills)
    for i, sk in enumerate(raw_oskills):
        a = base_alloc + (1 if i < remainder else 0)
        alloc.append(a)
    for i in range(len(alloc)):
        shift = random.randint(-20, 20)
        if 0 <= i+1 < len(alloc):
            alloc[i] += shift
            alloc[i+1] -= shift
    alloc = [max(5, a) for a in alloc]
    for sk, a in zip(raw_oskills, alloc):
        add_skill(sk, a)
    add_skill("信用评级", credit)

    interest_pool = [
        "聆听","闪避","急救","图书馆使用","汽车驾驶","攀爬",
        "跳跃","恐吓","魅惑","说服","追踪","估价","机械维修",
        "博物学","神秘学","历史","投掷","游泳"
    ]
    chosen = random.sample(interest_pool, random.randint(4, 6))
    ipts = int_pts
    for i, c in enumerate(chosen):
        pts = ipts // (len(chosen) - i)
        add_skill(c, pts)
        ipts -= pts

    bg = gen_background(occ_name, credit, stats)
    return stats, hp, san, mp, db, build, mov, occ_name, credit, occ_pts, int_pts, skills, bg


def print_card(data):
    s, hp, san, mp, db, build, mov, occ_name, credit, occ_pts, int_pts, skills, bg = data

    labels = {"STR":"力量","CON":"体质","SIZ":"体型","DEX":"敏捷",
              "APP":"外貌","INT":"智力","POW":"意志","EDU":"教育","LUCK":"幸运"}

    bar = "█"
    print("=" * 58)
    print("     🐙 克苏鲁的呼唤 第七版 · 调查员角色卡")
    print("=" * 58)

    # Basic info
    print(f"\n  ▸ 姓名：{bg['name']}　　职业：{occ_name}　　信用评级：{credit}%")
    print(f"  ▸ 年龄：{bg['age']}　　性别：男")

    # Attributes
    print(f"\n  ┌─ 属性 ────────────────────────────────────┐")
    for k, v in s.items():
        cn = labels.get(k, k)
        b = "█" * (v // 5) + "░" * (20 - v // 5)
        half, fifth = v // 2, v // 5
        print(f"  │ {cn:4s} {v:3d}%  {b} │ 半{half:2d}  五{fifth:2d} │")
    print(f"  └──────────────────────────────────────────┘")

    # HP
    print(f"\n  ┌─ 生命值 ───────────────────────────────────┐")
    hp_bar = "♥" * hp + "♡" * (max(0, 18 - hp))
    print(f"  │ HP {hp:2d}/ {hp:2d}  {hp_bar}       │")
    print(f"  │ 重伤阈值: {(hp+1)//2:2d}  濒死: 0                               │")
    print(f"  └──────────────────────────────────────────┘")

    # Combat
    print(f"\n  ┌─ 战斗 ─────────────────────────────────────┐")
    print(f"  │ 伤害加值(DB): {db:>5s}  体格: {build:2d}  闪避: {skills.get('闪避',{}).get('val',25):3d}%          │")
    print(f"  │ MOV: {mov}   每轮可移动 {mov*5} 码/米                       │")
    print(f"  └──────────────────────────────────────────┘")

    # Sanity
    print(f"\n  ┌─ 理智 & 魔法 ─────────────────────────────┐")
    print(f"  │ SAN: {san:3d}  (初始)   当前 SAN: {san:3d}                  │")
    print(f"  │ MP:  {mp:2d}           临时疯狂阈值: {san//5:2d}                  │")
    print(f"  │ 不定性疯狂阈值: {(san*4)//5:3d}                              │")
    print(f"  └──────────────────────────────────────────┘")

    # Skills
    print(f"\n  ┌─ 技能 ────────────────────────────────────┐")
    print(f"  │ {'技能':20s} {'基础':>4s}  {'总值':>4s}  {'½值':>4s}  {'⅕值':>4s} │")
    print(f"  ├──────────────────────────────────────────┤")

    groups = [
        ("战斗", ["格斗","射击","闪避","投掷"]),
        ("社交", ["话术","魅惑","恐吓","说服","心理学","信用评级","乔装"]),
        ("技术", ["锁匠","妙手","机械维修","电气维修","汽车驾驶","急救","医学","计算机使用","图书馆使用"]),
        ("感知", ["侦查","聆听","追踪"]),
        ("知识", ["历史","神秘学","博物学","其他语言","母语","估价","科学","考古学","法律","人类学","艺术与手艺","领航","精神分析","会计学"]),
        ("体能", ["攀爬","跳跃","潜行","游泳","骑术","生存","操作重型机械"]),
        ("特殊", ["克苏鲁神话"]),
    ]
    for gname, gkeys in groups:
        gs = [(k, v) for k, v in skills.items() if k in gkeys]
        if gs:
            for k, v in sorted(gs, key=lambda x: -x[1]["val"]):
                val = v["val"]
                print(f"  │ {v['name']:20s} {base_for(k):4d}%  {val:4d}%  {val//2:4d}%  {val//5:4d}% │")
    print(f"  └──────────────────────────────────────────┘")

    # Background
    print(f"\n  💰 根据{credit}%信用评级确定起始资产。")
    trait_title, trait_desc = bg['trait']
    person_name, person_desc = bg['person']
    place_name, place_desc = bg['place']
    item_name, item_desc = bg['possession']

    print(f"\n  ┌─ 背景故事 ────────────────────────────────┐")
    print(f"  │ 个人标签：{trait_title}")
    print(f"  │   {trait_desc}")
    print(f"  │                                            │")
    print(f"  │ 思想/信念：")
    print(f"  │   「{bg['idea']}」")
    print(f"  │                                            │")
    print(f"  │ 重要之人：{person_name}")
    print(f"  │   {person_desc}")
    print(f"  │                                            │")
    print(f"  │ 意义非凡之地：{place_name}")
    print(f"  │   {place_desc}")
    print(f"  │                                            │")
    print(f"  │ 宝贵之物：{item_name}")
    print(f"  │   {item_desc}")
    print(f"  │                                            │")
    print(f"  │ 特点：{trait_title}")
    print(f"  │   {trait_desc}")
    print(f"  └──────────────────────────────────────────┘")
    print("=" * 58)

if __name__ == "__main__":
    random.seed()
    data = gen_full()
    print_card(data)
