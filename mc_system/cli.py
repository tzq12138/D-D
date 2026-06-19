"""
剧本杀 AI MC 测试 CLI
用法: python cli.py
"""
import sys, os, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.dirname(__file__))
from engine import *

class MCEngine:
    def __init__(self):
        self.state = GameState()
        self._init_players()

    def _init_players(self):
        for pid, data in CHARACTERS.items():
            self.state.players[pid] = PlayerState(
                player_id=pid,
                character_name=data["name"]
            )

    def get_character_script(self, char_id):
        """返回角色剧本摘要（不包含禁止暴露的秘密）"""
        char = CHARACTERS[char_id]
        lines = [f"\n{'='*50}"]
        lines.append(f"角色：{char['name']}")
        lines.append(f"身份：{char['description']}")
        lines.append(f"\n推荐自我介绍：{char['public_bio']}")
        lines.append(f"\n你的秘密（不可主动暴露）：")
        for s in char.get("forbidden_secrets", []):
            lines.append(f"  ⛔ {s}")
        lines.append(f"\n你的地图字母：{char['map_letter']}")
        lines.append(f"{'='*50}\n")
        return "\n".join(lines)

    def get_available_clues(self, location, char_id):
        """返回某地点可供搜查的线索"""
        clues = []
        if location in ["diviner", "jose", "traveler", "milio"]:
            char_clues = CHARACTERS[location]["clues"]
            for c in char_clues:
                if c["id"] not in self.state.public_clues:
                    clues.append(c)
        elif location == "尸体":
            for i in range(1, 7):
                cid = f"corpse_{i}"
                if cid not in self.state.public_clues:
                    clues.append(SCENE_CLUES[cid])
        elif location == "现场":
            for i in range(1, 5):
                cid = f"scene1_{i}"
                if cid not in self.state.public_clues:
                    clues.append(SCENE_CLUES[cid])
        elif location == "现场2":
            for i in range(1, 5):
                cid = f"scene2_{i}"
                if cid not in self.state.public_clues:
                    clues.append(SCENE_CLUES[cid])
        return clues

    def search(self, char_id, location):
        """执行搜查，返回获得的线索"""
        player = self.state.players[char_id]
        current_round = self.state.round_num
        max_ap = 5 if current_round == 1 else 6

        if player.ap_used >= max_ap:
            return None, "本轮AP已用完"

        clues = self.get_available_clues(location, char_id)
        if not clues:
            return None, f"【{location}】已无可搜查的线索"

        clue = clues[0]
        player.ap_used += 1
        self.state.public_clues.append(clue["id"])
        player.clues_collected.append(clue)

        deep_hint = ""
        if clue.get("deep"):
            deep_hint = "\n[🔍 此线索可深入调查，需额外1点AP]"

        return clue, f"获得线索【{clue['name']}】: {clue['desc']}{deep_hint}"

    def deep_search(self, char_id, clue_name):
        """深入调查"""
        player = self.state.players[char_id]
        current_round = self.state.round_num
        max_ap = 5 if current_round == 1 else 6

        if player.ap_used >= max_ap:
            return "本轮AP已用完"

        # 简化版: 通过消耗AP获得提示
        player.ap_used += 1
        return f"深入调查【{clue_name}】完成。请根据线索内容进行推理。"

    def process_fate_letters(self, char_id, letter):
        """处理命运之门字母"""
        if letter not in self.state.fate_letters_revealed:
            self.state.fate_letters_revealed.append(letter)
        known = sorted(self.state.fate_letters_revealed)
        return known

    def try_unlock_fate(self, word_guess):
        """尝试解锁命运之门"""
        if word_guess.upper() == "FATE":
            self.state.fate_door_unlocked = True
            return True, ACT_5_TEXT
        return False, None

    def cast_vote(self, char_id, target_id):
        self.state.players[char_id].vote_cast = target_id
        target_name = CHARACTERS.get(target_id, {}).get("name", target_id)
        return f"投票已记录：指控【{target_name}】为凶手"

    def tally_votes(self):
        results = {}
        for pid, player in self.state.players.items():
            if player.vote_cast:
                target = CHARACTERS.get(player.vote_cast, {}).get("name", player.vote_cast)
                results[CHARACTERS[pid]["name"]] = target
        return results

    def get_status(self):
        s = f"\n{'~'*40}"
        s += f"\n📋 当前阶段: {self.state.phase}"
        s += f"\n📋 当前轮次: 第{self.state.round_num}轮"
        s += f"\n📋 已公开线索: {len(self.state.public_clues)}条"
        s += f"\n📋 命运字母: {', '.join(sorted(self.state.fate_letters_revealed)) if self.state.fate_letters_revealed else '尚未收集'}"
        s += f"\n{'~'*40}\n"

        for pid, player in self.state.players.items():
            name = CHARACTERS[pid]["name"]
            max_ap = 5 if self.state.round_num == 1 else 6
            s += f"\n  [{name}] AP: {max_ap - player.ap_used}/{max_ap} | 线索: {len(player.clues_collected)}条"

        s += f"\n\n可搜查地点: {', '.join(SEARCH_LOCATIONS)}"
        return s


if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════╗
║     《再见卡门》剧本杀 AI MC 引擎         ║
║     吉普赛女郎之死 · 4人开放本            ║
╚══════════════════════════════════════════╝
    """)

    mc = MCEngine()

    # 显示角色列表
    print("可选角色:")
    for pid, data in CHARACTERS.items():
        print(f"  [{pid}] {data['name']} - {data['description']}")

    print("\n输入 'read <角色id>' 阅读角色剧本")
    print("输入 'start' 开始游戏")
    print("输入 'help' 查看命令列表")
    print("输入 'quit' 退出\n")

    current_player = None

    while True:
        try:
            cmd = input(">>> ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not cmd:
            continue

        parts = cmd.split()
        action = parts[0].lower()

        if action == "quit":
            break
        elif action == "help":
            print("""
命令列表:
  read <角色id>     - 阅读角色剧本 (diviner/jose/traveler/milio)
  start             - 开始游戏
  search <地点>     - 搜查线索 (唐·何塞/米里奥/旅人/占卜师/尸体/现场/现场2)
  deep <线索名>     - 深入调查某条线索
  status            - 查看当前游戏状态
  clues             - 查看已收集的线索
  fate <字母>       - 贡献命运字母
  vote <角色id>     - 投票指控凶手
  answer <题号> <答案> - 填写答卷
""")
        elif action == "read":
            if len(parts) < 2:
                print("请指定角色: diviner / jose / traveler / milio")
            else:
                char_id = parts[1]
                if char_id in CHARACTERS:
                    current_player = char_id
                    print(mc.get_character_script(char_id))
                else:
                    print(f"未知角色: {char_id}")
        elif action == "start":
            mc.state.phase = "ACT_1"
            mc.state.round_num = 1
            print("\n🎭 游戏开始！ACT 1: 剧本阅读阶段")
            print("请所有玩家仔细阅读自己的角色剧本。")
            print("确认阅读完成后，输入 'ready' 进入第一轮搜证。")
        elif action == "ready":
            mc.state.phase = "ACT_2"
            print(f"\n🔍 ACT 2: 第一轮搜证开始！（每人{5}点AP）")
            print(mc.get_status())
        elif action == "search":
            if not current_player:
                print("请先用 'read <角色>' 选择角色")
                continue
            if len(parts) < 2:
                print("请指定搜索地点")
                print(f"可选: {', '.join(SEARCH_LOCATIONS)}")
                continue
            loc_name = " ".join(parts[1:])
            # Map Chinese names to IDs
            loc_map = {"唐·何塞": "jose", "何塞": "jose", "jose": "jose",
                       "米里奥": "milio", "milio": "milio",
                       "旅人": "traveler", "traveler": "traveler",
                       "占卜师": "diviner", "diviner": "diviner"}
            loc_id = loc_map.get(loc_name, loc_name)

            clue, msg = mc.search(current_player, loc_id)
            if clue:
                print(f"\n✅ {msg}")
            else:
                print(f"\n❌ {msg}")
        elif action == "deep":
            if not current_player:
                print("请先用 'read <角色>' 选择角色")
                continue
            if len(parts) < 2:
                print("请指定要深入调查的线索名称")
                continue
            clue_name = " ".join(parts[1:])
            msg = mc.deep_search(current_player, clue_name)
            print(f"\n🔍 {msg}")
        elif action == "status":
            print(mc.get_status())
        elif action == "clues":
            if not current_player:
                print("请先用 'read <角色>' 选择角色")
                continue
            player = mc.state.players[current_player]
            print(f"\n📋 你的线索 ({len(player.clues_collected)}条):")
            for c in player.clues_collected:
                print(f"  [{c['name']}] {c['desc'][:80]}...")
        elif action == "fate":
            if len(parts) < 2:
                print("请提供你的地图字母")
                continue
            letter = parts[1].upper()
            known = mc.process_fate_letters(current_player, letter)
            print(f"\n🗺️ 当前已知字母: {', '.join(known)}")
            if len(known) == 4:
                guess = "".join(known)
                print(f"组合: {guess}")
                if guess in ["FATE", "FETA", "AFTE", "ATEF", "TFAE", "TEFA", "EFTA", "EFAT",
                            "FAET", "FEAT", "AEFT", "ATFE", "TAEF", "TEAF", "EATF", "ETAF",
                            "FTEA", "FTAE", "AFET", "AETF", "TFEA", "TAFE", "EFTA", "ETFA"]:
                    print("\n💡 提示：这四个字母可以拼成一个有意义的英文单词。试试输入 'unlock <单词>'")
        elif action == "unlock":
            if len(parts) < 2:
                print("请输入单词猜测，如 'unlock fate'")
                continue
            word = parts[1]
            success, text = mc.try_unlock_fate(word)
            if success:
                print(f"\n🔓 命运之门已解锁！")
                print(text)
            else:
                print(f"\n❌ '{word}' 不正确，请再试。")
        elif action == "vote":
            if len(parts) < 2:
                print("请指定投票目标: diviner/jose/traveler/milio")
                continue
            target = parts[1]
            msg = mc.cast_vote(current_player, target)
            print(f"\n🗳️ {msg}")
        elif action == "votes":
            results = mc.tally_votes()
            print("\n🗳️ 当前投票情况:")
            for voter, target in results.items():
                print(f"  {voter} → {target}")
        elif action == "truth":
            print(TRUTH_SUMMARY)
        elif action == "reveal":
            mc.state.phase = "ACT_4"
            print("\n" + "="*50)
            print("🎭 真相揭示")
            print("="*50)
            print(TRUTH_SUMMARY)
            votes = mc.tally_votes()
            print("\n投票结果:")
            for voter, target in votes.items():
                print(f"  {voter} 指控 → {target}")
            # Determine winner
            murderer_votes = votes.get("占卜师", "") == "占卜师"
            print("\n命运之门揭示：四个男人其实是同一个人。")
            print("唐·何塞 → 米里奥 → 旅人 → 占卜师")
            print("他们在不同的人生阶段穿越回来，都想得到卡门。")
            print("卡门选择了自由——即使以生命为代价。")
        else:
            print(f"未知命令: {action}")
