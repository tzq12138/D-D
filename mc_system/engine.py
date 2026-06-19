"""
剧本杀 AI MC 引擎 - 吉普赛女郎之死
游戏状态管理器 + 线索分发器 + 分幕控制器
"""
import json, os, random
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional

# ============================================================
# DATA MODELS
# ============================================================

@dataclass
class PlayerState:
    player_id: str
    character_name: str
    ap_total: int = 11
    ap_round1: int = 5
    ap_round2: int = 6
    ap_used: int = 0
    clues_collected: list = field(default_factory=list)
    revealed_secrets: list = field(default_factory=list)
    vote_cast: Optional[str] = None
    answer_sheet: dict = field(default_factory=dict)

@dataclass
class GameState:
    phase: str = "ACT_0"  # ACT_0 through ACT_4
    round_num: int = 0
    discussion_started: datetime = None
    last_message_time: datetime = None
    players: dict = field(default_factory=dict)
    public_clues: list = field(default_factory=list)
    discussion_log: list = field(default_factory=list)
    fate_letters_revealed: list = field(default_factory=list)
    fate_door_unlocked: bool = False

# ============================================================
# SCRIPT DATA
# ============================================================

CHARACTERS = {
    "diviner": {
        "id": "diviner",
        "name": "占卜师",
        "description": "塞维利亚德高望重的占卜师，五十多岁，黑袍苍发",
        "public_bio": "我是塞维利亚的一名占卜师，与诸位萍水相逢无冤无仇。今天围观了决斗后想检验占卜结果，23:50后目击了重要的事，回去后就被带来这里。",
        "is_murderer": True,
        "map_letter": "E",
        "forbidden_secrets": [
            "你的真实年龄",
            "你失忆了",
            "何塞捡到的地图是你的",
            "你与生俱来有一枚子弹"
        ],
        "clues": [
            {"id": "diviner_1", "name": "塔罗牌", "desc": "一沓塔罗牌，其中有几张格外陈旧：逆位愚者、正位恶魔、逆位倒吊人", "deep": True},
            {"id": "diviner_2", "name": "外表", "desc": "披着一件黑色的长袍，须发苍白，脸上的皱纹沟壑纵横", "deep": False},
            {"id": "diviner_3", "name": "手札", "desc": "记录着占卜时眼前出现的未来画面：1835王国大旱、1840革命爆发、1843新王继位、1845吉普赛人到来、唐·何塞……米里奥……旅人……卡门死亡", "deep": False},
            {"id": "diviner_4", "name": "旧牌-死神", "desc": "一张格外旧的塔罗牌：逆位死神", "deep": False},
            {"id": "diviner_5", "name": "旧牌-命运之轮", "desc": "一张格外旧的塔罗牌：命运之轮，分不清正逆", "deep": False}
        ]
    },
    "jose": {
        "id": "jose",
        "name": "唐·何塞",
        "description": "塞维利亚皇家骑士，二十多岁，五官端正、气宇不凡",
        "public_bio": "我是唐·何塞，卡门的恋人。今天决斗结束后23:25回到住处，23:50处理了私人感情，00:10回到帐篷，然后就被带到这里。",
        "is_murderer": False,
        "map_letter": "F",
        "forbidden_secrets": [],
        "clues": [
            {"id": "jose_1", "name": "军装", "desc": "穿着一身骑士的军装，五官端正、气宇不凡", "deep": False},
            {"id": "jose_2", "name": "红宝石戒指", "desc": "行囊里有一枚红宝石戒指", "deep": False},
            {"id": "jose_3", "name": "枯萎玫瑰", "desc": "口袋里有一朵枯萎的玫瑰", "deep": False},
            {"id": "jose_4", "name": "剑茧", "desc": "手上有常年用剑磨出的茧子", "deep": False},
            {"id": "jose_5", "name": "神秘地图", "desc": "一张神秘的地图，指向瓜达尔河源头，似乎有一扇门，名字字母已模糊（可辨认F）", "deep": False}
        ]
    },
    "traveler": {
        "id": "traveler",
        "name": "旅人",
        "description": "云游四方的传教士，四十多岁，白袍遮面，神色冷淡",
        "public_bio": "我是一个云游四方的旅人，在旅途中有缘遇到卡门，成为很好的朋友。今天围观决斗后23:30处理了私事，23:50左右回来找卡门时碰上吉普赛人，就被带来这里。",
        "is_murderer": False,
        "map_letter": "T",
        "forbidden_secrets": [
            "你曾是米里奥",
            "你通过地图回到了十年前",
            "你开枪了",
            "你把米里奥的怀表调慢了10分钟"
        ],
        "clues": [
            {"id": "traveler_1", "name": "空瓶(白)", "desc": "行囊里有一只空瓶，瓶中残留着微量白色粉末", "deep": True},
            {"id": "traveler_2", "name": "传教士打扮", "desc": "一副传教士的打扮，外面披着一件遮住半张脸的白袍，神色冷淡", "deep": False},
            {"id": "traveler_3", "name": "通缉令", "desc": "一沓印着卡门头像的通缉令", "deep": False},
            {"id": "traveler_4", "name": "超度手札", "desc": "一本手札，上面划掉了一系列名字，其中大多数人姓甄", "deep": False},
            {"id": "traveler_5", "name": "子弹", "desc": "衣袋里藏着一枚0.38口径转轮手枪的子弹", "deep": False},
            {"id": "traveler_6", "name": "火药", "desc": "袖口有黑色的粉末", "deep": False},
            {"id": "traveler_7", "name": "神秘地图", "desc": "一张神秘的地图，指向瓜达尔河源头，似乎有一扇门，名字字母已模糊（可辨认T）", "deep": False}
        ]
    },
    "milio": {
        "id": "milio",
        "name": "米里奥",
        "description": "吉普赛车队的强盗头子，三十多岁，肤色黝黑，五官难以辨认",
        "public_bio": "我是米里奥，卡门的丈夫。今天决斗结束后23:30和卡门处理了私人感情，5分钟后就离开了，等我再次回来找卡门时发现她已经死了。",
        "is_murderer": False,
        "map_letter": "A",
        "forbidden_secrets": [
            "你曾是唐·何塞",
            "你通过地图回到了十年前"
        ],
        "clues": [
            {"id": "milio_1", "name": "空瓶(红)", "desc": "口袋里有一只空瓶，瓶壁上残留着微量红色粉末", "deep": True},
            {"id": "milio_2", "name": "破碎怀表", "desc": "一只破碎的怀表，时间停在11:52", "deep": True},
            {"id": "milio_3", "name": "土匪打扮", "desc": "一副土匪的打扮，肤色黝黑、五官难以辨认", "deep": False},
            {"id": "milio_4", "name": "杀人手札", "desc": "一本手札，上面记录着一系列名字，其中大多数人姓甄", "deep": False},
            {"id": "milio_5", "name": "绝情信", "desc": "\"亲爱的米里奥，再见了，去不去塞维利亚并不重要，但是谁也别想掌控我的人生。\"", "deep": False},
            {"id": "milio_6", "name": "神秘地图", "desc": "一张神秘的地图，指向瓜达尔河源头，似乎有一扇门，名字字母已模糊（可辨认A）", "deep": False}
        ]
    }
}

SCENE_CLUES = {
    "corpse_1": {"id": "corpse_1", "name": "尸体-左胸伤口", "desc": "尸体正面左胸有一个狭长的贯穿伤口"},
    "corpse_2": {"id": "corpse_2", "name": "尸体-右胸伤口", "desc": "尸体正面右胸有一个直径0.38英寸的圆形伤口"},
    "corpse_3": {"id": "corpse_3", "name": "尸体-脸色", "desc": "尸体脸色苍白、血液呈不正常的深红色"},
    "corpse_4": {"id": "corpse_4", "name": "尸体-手指痕迹", "desc": "尸体右手无名指根部有一圈肤色略白，似乎是多年佩戴戒指的痕迹"},
    "corpse_5": {"id": "corpse_5", "name": "尸体-内脏镜像", "desc": "尸体的内脏与正常人呈镜像式分布"},
    "corpse_6": {"id": "corpse_6", "name": "尸体-微笑", "desc": "尸体的嘴角微微上扬"},
    "scene1_1": {"id": "scene1_1", "name": "现场-酒杯", "desc": "桌上有一个空的酒杯，杯底析出了少量红色结晶", "deep": True},
    "scene1_2": {"id": "scene1_2", "name": "现场-骑士剑", "desc": "地上有一把沾满鲜血的骑士剑"},
    "scene1_3": {"id": "scene1_3", "name": "现场-衣柜脚印", "desc": "衣柜里有脚印，似乎是一双传教士靴子的纹路"},
    "scene1_4": {"id": "scene1_4", "name": "现场-窗户弹孔", "desc": "窗户上有一个直径0.38英寸的弹孔"},
    "scene2_1": {"id": "scene2_1", "name": "现场2-转轮手枪", "desc": "帐篷门口有一把0.38口径的转轮手枪，弹匣内有一枚子弹", "deep": True},
    "scene2_2": {"id": "scene2_2", "name": "现场2-水杯", "desc": "桌上有一个水杯，内壁析出了少量白色结晶，且有两枚不同的唇印", "deep": True},
    "scene2_3": {"id": "scene2_3", "name": "现场2-衣柜破损", "desc": "衣柜的木板缺损了一块，破损处1.5米高，边缘锋利、沾有少量血迹", "deep": True},
    "scene2_4": {"id": "scene2_4", "name": "现场2-首饰盒", "desc": "卡门的首饰盒里有一枚红宝石戒指"},
}

SEARCH_LOCATIONS = ["diviner", "jose", "traveler", "milio", "尸体", "现场", "现场2"]
ACT_5_TEXT = """
第五幕 命运之门

听到命运（Fate）这个词，吉卜赛长老抽着烟袋，陷入了深深的沉思。

"在我还是个孩子的时候，曾听过一个传说……"

"相传世上有一扇命运之门。当人们被命运捉弄时，只要他克服千难万险逆着王国最湍急、最凶险的瓜达尔河来到它的源头，将有一扇神奇的门为他敞开。
当然，只有最坚韧的勇士怀着最深的执念才能见到它，任何凡夫俗子都只能在漫长的跋涉中随波逐流、向命运妥协。"

"而最终的勇士将被赐予一次回到十年前改变命运的机会。"

长老顿了顿，缓缓吐出一个烟圈。

"但是，幸运同时也是一种诅咒，有人说穿过那扇门的人将被命运之神剥夺一些重要的东西：有人说神拿走的是他们的名字，有人说是时间，但最可靠的说法是记忆——
除了他们坚定的执念，其余的记忆将一点点被蚕食。一旦完全失去记忆，最终他们将不再是自己。"

"唉……"长老叹口气，"希望那些傻孩子至少如愿以偿吧……"
"""

TRUTH_SUMMARY = """
【案件真相】
真凶是——占卜师。

四人其实是同一个男人在不同人生阶段穿越回十年前：
- 唐·何塞（最年轻）→ 十年后成为米里奥
- 米里奥 → 十年后成为旅人
- 旅人 → 十年后成为占卜师（失忆）

卡门身中三伤：
1. 左胸剑伤（何塞所刺，不致命——心脏在右侧）
2. 红花石蒜中毒（米里奥所下，被白蔷薇推迟发作，00:01才致死）
3. 右胸枪伤（占卜师在24:00开枪，子弹击中心脏，为真正致死原因）
   旅人曾在23:55向窗户开枪但未击中卡门。

占卜师开枪是应卡门请求——她选择以死亡换取自由，临终前微笑是因为终于解脱。
占卜师善后时将自带子弹装入弹匣，用剑破坏衣柜弹孔，试图嫁祸给窗外开枪的人。
"""

GAME_RULES = """
【游戏规则】
- 共两轮，每轮讨论90分钟
- 每人11点AP：第一轮5点，第二轮6点
- 搜索一次耗费1点AP，深入调查另耗1点
- 可搜查地点：唐·何塞、米里奥、旅人、占卜师、尸体、现场、现场2
- 一条线索只能被查看一次
- 第二轮开始时公开第五幕
- 投票前每人填写答卷
"""

if __name__ == "__main__":
    print("剧本杀 AI MC 引擎已加载")
    print(f"角色数: {len(CHARACTERS)}")
    print(f"搜索地点: {len(SEARCH_LOCATIONS)}")
