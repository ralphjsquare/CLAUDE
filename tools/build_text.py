"""Build data/text.js (周易原文, simplified Chinese) from the two source editions.

Base text: A (《周易正义》, punctuated). Readings where A differs from the
common received text (通行本) are corrected via FIXES below. Every field is
then cross-checked against B (朱熹《周易本义》) with punctuation removed, and
remaining differences are printed for review. 小象 come from xiaoxiang.txt,
whose punctuation was added by hand and which is checked against B the same way.

Usage: python3 tools/build_text.py   (needs `npm` and `pip install opencc-python-reimplemented`)
"""
import json
import os

from sources import load, strip

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "text.js")

# (卦序, field, old, new). field: name/judgment/tuan/daxiang or L1..L6 for 爻辞.
FIXES = [
    (1, "tuan", "大明始终", "大明终始"),
    (1, "tuan", "保合大和", "保合太和"),
    (4, "tuan", "初噬告", "初筮告"),
    (10, "daxiang", "安民志", "定民志"),
    (23, "daxiang", "山附地上", "山附于地"),
    (25, "tuan", "不佑", "不祐"),
    (28, "L5", "老妇得士夫", "老妇得其士夫"),
    (29, "tuan", "坎之时用", "险之时用"),
    (31, "judgment", "咸，亨", "亨"),
    (33, "name", "遁", "遯"),
    (34, "daxiang", "非礼勿履", "非礼弗履"),
    (35, "L4", "硕鼠", "鼫鼠"),
    (36, "L4", "出于门庭", "于出门庭"),
    (37, "L5", "勿恤，往吉", "勿恤，吉"),
    (41, "L1", "巳事", "已事"),
    (41, "L6", "贞吉，有攸往", "贞吉，利有攸往"),
    (47, "tuan", "刚掩也", "刚揜也"),
    (47, "L2", "利用享祀", "利用亨祀"),
    (48, "L5", "井冽", "井洌"),
    (49, "tuan", "革而信也", "革而信之"),
    (55, "tuan", "而况人于人乎", "而况于人乎"),
    (57, "judgment", "利攸往", "利有攸往"),
    (62, "tuan", "有飞鸟遗之音", "飞鸟遗之音"),
    (63, "daxiang", "预防", "豫防"),
]

# Variant glyphs used by the 四库本 (B), mapped to standard forms for comparison.
VARIANTS = dict(zip("隂乗䝉逺徳冦懐賔朶頥㝠𤼵聴畱𢎞𩔖𤣥髙闗彚勅徃耊甁厯熏",
                    "阴乘蒙远德寇怀宾朵颐冥发听留弘类玄高关汇敕往耋瓶历薰"))

# Known differences where B is a misprint or a minor variant and A is kept.
ACCEPTED = {
    (8, "L1"), (61, "L1"),            # 它 / 他
    (10, "daxiang"),                  # 辨 / 辩
    (11, "L1"), (12, "L1"),           # (none after VARIANTS; kept for safety)
    (21, "daxiang"),
    (28, "L2"),                       # B: 梯 (misprint of 稊)
    (39, "L6"),                       # B: 古 (misprint of 吉)
    (41, "L4"),                       # B: 瓦 (misprint of 无)
    (49, "judgment"), (49, "tuan"), (49, "L2"),  # 巳日 / 已日 / 己日: keep 巳 (王弼本)
    (52, "L3"),
    (54, "L1"),                       # B: 破 (misprint of 跛)
    (59, "daxiang"),                  # 享 / 亨
    (15, "L4"), (29, "L6"), (63, "L4"),  # protected rare glyphs
}
XIAO_ACCEPTED = {
    (26, 1),   # B: 利己 -> 利已（与爻辞一致）
    (26, 4),   # B: 无吉 -> 元吉
    (39, 2),   # B: 玉臣 -> 王臣
    (49, 2),   # 已日 -> 巳日 (consistent with 卦辞/爻辞)
    (50, 6),   # B omits 铉
}


def norm(s):
    return strip("".join(VARIANTS.get(c, c) for c in s))


def end(s):
    return s if s[-1] in "。！？" else s + "。"


def main():
    A, B = load()
    by_num = {a["num"]: a for a in A}
    for n, field, old, new in FIXES:
        a = by_num[n]
        if field.startswith("L"):
            i = int(field[1:]) - 1
            pos, text = a["lines"][i]
            assert old in text, (n, field, old)
            a["lines"][i] = (pos, text.replace(old, new))
        else:
            assert old in a[field], (n, field, old)
            a[field] = a[field].replace(old, new)

    xiao = {}
    for line in open(os.path.join(HERE, "xiaoxiang.txt"), encoding="utf-8"):
        if line.strip() and not line.startswith("#"):
            n, *xs = line.strip().split("|")
            xiao[int(n)] = xs
    xiao[49][1] = xiao[49][1].replace("已日", "巳日")

    review = []
    out = []
    for a, b in zip(A, B):
        n = a["num"]
        lines = list(a["lines"])
        if a["use"]:
            lines.append(tuple(a["use"].split("：", 1)))
        # B drops the hexagram name when it opens the judgment (履虎尾, 否之匪人 …).
        bj = b["judgment"]
        if norm(a["judgment"]).startswith(a["name"]) and not norm(bj).startswith(a["name"]):
            bj = a["name"] + bj
        checks = [("judgment", a["judgment"], bj), ("tuan", a["tuan"], b["tuan"]),
                  ("daxiang", a["daxiang"], b["daxiang"])]
        checks += [("L%d" % (i + 1), t, bt) for i, ((_, t), (_, bt)) in enumerate(zip(lines, b["lines"]))]
        for field, x, y in checks:
            if norm(x) != norm(y) and (n, field) not in ACCEPTED:
                review.append("%d %s %s\n  A: %s\n  B: %s" % (n, a["name"], field, x, y))
        xs = xiao[n]
        assert len(xs) == len(lines) == len(b["xiao"]), n
        for i, (x, bx) in enumerate(zip(xs, b["xiao"])):
            if norm(x) != norm(bx) and (n, i + 1) not in XIAO_ACCEPTED:
                review.append("%d %s 小象%d\n  mine: %s\n  B:    %s" % (n, a["name"], i + 1, x, bx))

        entry = {
            "n": n,
            "name": a["name"],
            "judgment": end(a["judgment"]),
            "tuan": end(a["tuan"]),
            "daxiang": end(a["daxiang"]),
            "lines": [{"pos": p, "text": end(t), "xiang": x} for (p, t), x in zip(lines[:6], xs[:6])],
        }
        if a["use"]:
            p, t = lines[6]
            entry["use"] = {"pos": p, "text": end(t), "xiang": xs[6]}
        out.append(entry)

    if review:
        print("\n".join(review))
        print("\n%d unexplained differences — fix FIXES / xiaoxiang.txt or add to ACCEPTED." % len(review))
        raise SystemExit(1)

    body = ",\n".join("  " + json.dumps(e, ensure_ascii=False) for e in out)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// 周易原文（卦辞、爻辞、彖传、大象、小象）。由 tools/build_text.py 生成，请勿手改。\n")
        f.write("// 底本：《周易正义》，以朱熹《周易本义》对校，个别文字依通行本校正。\n")
        f.write("(globalThis.Yi = globalThis.Yi || {}).TEXT = [\n" + body + "\n];\n")
    print("wrote", os.path.relpath(OUT), len(out), "hexagrams")


if __name__ == "__main__":
    main()
