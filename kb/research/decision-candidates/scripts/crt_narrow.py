#!/usr/bin/env python3
"""Flags which of the strata-adjacent CRT decisions are likely to be real strata matters.

Searching "strata" in the small claims collection returns a lot of decisions that are not about
strata at all: they cite a case whose style of cause contains "Strata Plan" for an unrelated
procedural point. Searching narrower phrases that only appear when the decision is actually
discussing strata property gives a confidence signal without discarding anything.

Same rules: sequential, 2s apart, identifying User-Agent, cached, stop on non-200, no decision
document fetched, citation and date only.
"""
import json
import pathlib
import re
import subprocess
import sys
import time

CACHE = pathlib.Path("/Users/amaan/Documents/Apps - Pixeltec/bylawIQ/bylawiq-app/kb/.cache/crt/narrow")
UA = "BylawIQ-research-bot (contact: amaan.shahana@park10x.com)"
BASE = "https://decisions.civilresolutionbc.ca/crt/en/d/s/index.do"
# Phrases that appear when a decision is applying strata law, not merely citing a strata-named case.
PHRASES = ["strata corporation", "strata lot", "Strata Property Act", "strata fees", "common property"]
COLLECTIONS = {"119": "Small Claims", "194": "Societies and Cooperative Associations"}
LI = re.compile(r'<li class="(?:odd|even)[^"]*">', re.S)
CIT = re.compile(r'<span class="citation">\s*([^<]+?)\s*</span>')


def fetch(col: str, phrase: str, page: int) -> str:
    tag = re.sub(r"\W+", "_", phrase)[:24]
    path = CACHE / f"col{col}_{tag}_p{page:03d}.html"
    if path.exists():
        return path.read_text(errors="replace")
    url = (f"{BASE}?cont={phrase.replace(' ', '+')}&col={col}&iframe=true&or=date"
           + (f"&page={page}" if page > 1 else ""))
    time.sleep(2)
    r = subprocess.run(["curl", "-sS", "--max-time", "60", "-A", UA,
                        "-w", "\n__HTTP__%{http_code}", url], capture_output=True, text=True, check=False)
    body, _, code = r.stdout.rpartition("\n__HTTP__")
    if code.strip() != "200":
        raise SystemExit(f"HTTP {code.strip()} — stopping")
    path.write_text(body)
    return body


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    hits: dict[str, set] = {}
    for col in COLLECTIONS:
        for phrase in PHRASES:
            first = fetch(col, phrase, 1)
            m = re.search(r"([\d,]+)\s*results?", first)
            expected = int(m.group(1).replace(",", "")) if m else 0
            pages = -(-expected // 25)
            print(f"col {col} {phrase!r}: {expected} hits, {pages} page(s)", file=sys.stderr)
            for page in range(1, pages + 1):
                text = first if page == 1 else fetch(col, phrase, page)
                for block in LI.split(text)[1:]:
                    c = CIT.search(block)
                    if not c:
                        continue
                    cit = re.sub(r"(20\d\d)\D*BCCRT\D*(\d+)", r"\1 BCCRT \2", c.group(1))
                    hits.setdefault(cit, set()).add(phrase)
    out = pathlib.Path(__file__).with_name("crt_other_narrow.json")
    out.write_text(json.dumps(
        [{"citation": c, "matched_narrow": sorted(p)} for c, p in sorted(hits.items())], indent=1))
    print(f"\n{len(hits)} decisions matched at least one narrow phrase -> {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
