"""
金句素材库
按主题分类的名人名言、金句、文案短句
"""
from typing import Dict, List
import re

QUOTES: Dict[str, List[str]] = {
    "励志": [
        "天行健，君子以自强不息。——《周易》",
        "路漫漫其修远兮，吾将上下而求索。——屈原",
        "长风破浪会有时，直挂云帆济沧海。——李白",
        "宝剑锋从磨砺出，梅花香自苦寒来。——《警世贤文》",
        "千淘万漉虽辛苦，吹尽狂沙始到金。——刘禹锡",
        "既然选择了远方，便只顾风雨兼程。——汪国真",
        "世界以痛吻我，要我报之以歌。——泰戈尔",
        "不曾痛哭过长夜的人，不足以语人生。——卡莱尔",
    ],
    "坚持": [
        "锲而不舍，金石可镂。——荀子",
        "不积跬步，无以至千里；不积小流，无以成江海。——荀子",
        "滴水穿石，不是力量大，而是功夫深。——《荀子》化用",
        "成功的花儿，人们只惊羡她现时的明艳，然而当初她的芽儿，浸透了奋斗的泪泉。——冰心",
        "伟大出自平凡，平凡造就伟大。——习近平",
        "Rome wasn't built in a day. （罗马不是一天建成的。）",
    ],
    "创新": [
        "苟日新，日日新，又日新。——《礼记》",
        "创新是一个民族进步的灵魂。——江泽民",
        "想象力比知识更重要。——爱因斯坦",
        "踩着前人的脚印前进，最佳结果也只能是亚军。——李可染",
        "不创新，就死亡。——彼得·德鲁克",
    ],
    "学习": [
        "学而不思则罔，思而不学则殆。——孔子",
        "吾生也有涯，而知也无涯。——庄子",
        "读书破万卷，下笔如有神。——杜甫",
        "知识就是力量。——培根",
        "学习是终身的事业。——钱伟长",
    ],
    "合作": [
        "众人拾柴火焰高。——中国谚语",
        "单丝不成线，独木不成林。——中国谚语",
        "团结就是力量。——毛泽东",
        "If you want to go fast, go alone. If you want to go far, go together. （独行快，众行远。）——非洲谚语",
    ],
    "时间": [
        "逝者如斯夫，不舍昼夜。——孔子",
        "一寸光阴一寸金，寸金难买寸光阴。——《增广贤文》",
        "时间就是生命。——鲁迅",
        "Time is money. （时间就是金钱。）——富兰克林",
        "逝去的时间永远无法挽回。——歌德",
    ],
    "诚信": [
        "言必信，行必果。——孔子",
        "人无信不立。——孟子",
        "诚信是为人之本。——鲁迅",
        "Honesty is the best policy. （诚实是最好的策略。）——富兰克林",
    ],
    "写作": [
        "文章合为时而著，歌诗合为事而作。——白居易",
        "两句三年得，一吟双泪流。——贾岛",
        "为求一字稳，耐得半宵寒。——贾岛",
        "文章本天成，妙手偶得之。——陆游",
        "好的文章是改出来的。——鲁迅",
        "简洁是智慧的灵魂。——莎士比亚",
    ],
    "科技": [
        "科学技术是第一生产力。——邓小平",
        "科技改变生活。——比尔·盖茨",
        "Stay hungry, stay foolish. （求知若饥，虚心若愚。）——乔布斯",
        "预测未来的最好方式就是创造它。——艾伦·凯",
    ],
    "人生": [
        "人生自古谁无死，留取丹心照汗青。——文天祥",
        "生活不止眼前的苟且，还有诗和远方。——高晓松",
        "人生的价值，并不是用时间，而是用深度去衡量的。——列夫·托尔斯泰",
        "一个人可以被毁灭，但不能被打败。——海明威",
    ],
}


def get_quotes_by_theme(theme: str = "", count: int = 5) -> List[str]:
    """根据主题获取金句"""
    if theme and theme in QUOTES:
        quotes = QUOTES[theme][:count]
        return quotes

    # 自动匹配主题
    for key, quotes in QUOTES.items():
        if theme in key or key in theme:
            return quotes[:count]

    # 随机返回
    import random
    all_quotes = []
    for quotes in QUOTES.values():
        all_quotes.extend(quotes)
    return random.sample(all_quotes, min(count, len(all_quotes)))


def match_quotes_by_text(text: str, count: int = 5) -> dict:
    """根据文本内容自动匹配金句"""
    keywords_map = {
        "励志": ["努力", "奋斗", "拼搏", "成功", "梦想", "目标", "志向"],
        "坚持": ["坚持", "持续", "不懈", "毅力", "恒心", "耐心"],
        "创新": ["创新", "创造", "突破", "改变", "新颖", "变革"],
        "学习": ["学习", "读书", "知识", "教育", "研究", "学问"],
        "合作": ["合作", "团队", "协作", "团结", "配合", "共赢"],
        "时间": ["时间", "光阴", "效率", "珍惜", "时光"],
        "诚信": ["诚信", "信用", "诚实", "承诺", "守信"],
        "写作": ["写作", "文章", "文字", "表达", "笔", "修辞"],
        "科技": ["科技", "技术", "数字", "智能", "互联网", "AI", "人工智能"],
        "人生": ["人生", "生活", "生命", "意义", "价值", "态度"],
    }

    scores = {}
    for theme, keywords in keywords_map.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[theme] = score

    if not scores:
        # 默认返回几条
        return {
            "matched_themes": [],
            "quotes": get_quotes_by_theme("", count),
        }

    # 取得分最高的主题
    best_themes = sorted(scores.keys(), key=lambda t: scores[t], reverse=True)
    quotes = []
    seen = set()
    for theme in best_themes[:3]:
        for q in get_quotes_by_theme(theme, 3):
            if q not in seen:
                seen.add(q)
                quotes.append(q)
                if len(quotes) >= count:
                    break
        if len(quotes) >= count:
            break

    return {
        "matched_themes": best_themes[:3],
        "quotes": quotes[:count],
    }
