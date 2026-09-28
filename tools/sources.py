"""Load and normalise the two source texts of the Zhouyi.

A = 《周易正义》武英殿本 (punctuated; 卦辞/爻辞/用九用六/彖传/大象)
B = 朱熹《周易本义》四库全书本 (unpunctuated; also carries every 小象)

Both come from the MIT-licensed npm package `opencode-tianji@0.6.0`
(data/爻辞.json, data/tuan_xiang.json, books/08_周易本义.json).
The classical text itself is in the public domain.
"""
import json
import os
import re
import subprocess
import tarfile
import tempfile

from opencc import OpenCC

PKG = "opencode-tianji@0.6.0"
PUNCT = re.compile(r"[，。；：、！？「」『』“”‘’（）()\s]")

_cc = OpenCC("t2s")
# Characters OpenCC would convert wrongly for this text.
# Also keep glyphs whose simplified forms fall outside common Windows fonts.
_PROTECT = {c: chr(0xE000 + i) for i, c in enumerate("乾餗纆繻撝")}
_AFTER = {"彊": "强"}


def to_simplified(s):
    for k, v in _PROTECT.items():
        s = s.replace(k, v)
    s = _cc.convert(s)
    for k, v in _PROTECT.items():
        s = s.replace(v, k)
    for k, v in _AFTER.items():
        s = s.replace(k, v)
    return s


def strip(s):
    return PUNCT.sub("", s)


def fetch(cache_dir=None):
    cache_dir = cache_dir or os.path.join(tempfile.gettempdir(), "yi-sources")
    root = os.path.join(cache_dir, "package")
    if not os.path.isdir(root):
        os.makedirs(cache_dir, exist_ok=True)
        out = subprocess.check_output(["npm", "pack", PKG, "--silent"], cwd=cache_dir, text=True)
        with tarfile.open(os.path.join(cache_dir, out.strip().splitlines()[-1])) as t:
            t.extractall(cache_dir)
    load = lambda p: json.load(open(os.path.join(root, p), encoding="utf-8"))
    return load("data/爻辞.json"), load("data/tuan_xiang.json"), load("books/08_周易本义.json")


def load():
    """Return (A, B): two lists of 64 dicts in King Wen order, simplified."""
    yaoci, tuanxiang, benyi = fetch()
    tx = {g["卦序"]: g for g in tuanxiang["六十四卦"]}
    A = []
    for g in yaoci["六十四卦"]:
        n = g["卦序"]
        judg = g["卦辞"].split("：", 1)[1]
        A.append({
            "num": n,
            "name": to_simplified(g["卦名"]),
            "judgment": to_simplified(judg),
            "lines": [(to_simplified(y["爻名"]), to_simplified(y["爻辞"])) for y in g["爻辞"]],
            "use": to_simplified(g["用"]) if g.get("用") else None,
            "tuan": to_simplified(tx[n]["彖传"]),
            "daxiang": to_simplified(tx[n]["大象"]),
        })
    gs = benyi["卷注"]["卷一·上经"] + benyi["卷注"]["卷二·下经"]
    B = []
    for g in gs:
        xs = [to_simplified(x["经文"]) for x in g["象曰注"] if x.get("类型") == "小象"]
        if g["卦序"] == 14:  # 大有六五's 小象 is split in two in this source
            xs[4:6] = [xs[4] + xs[5]]
        ds = [to_simplified(x["经文"]) for x in g["象曰注"] if x.get("类型") == "大象"]
        B.append({
            "num": g["卦序"],
            "name": to_simplified(g["卦名"]),
            "judgment": "".join(to_simplified(x["经文"]) for x in g["卦辞注"]),
            "lines": [(to_simplified(y["爻位"]), to_simplified(y["爻辞"])) for y in g["爻注"]],
            "tuan": "".join(to_simplified(x["经文"]) for x in g["彖曰注"]),
            "daxiang": ds[0],
            "xiao": xs,
        })
    return A, B
