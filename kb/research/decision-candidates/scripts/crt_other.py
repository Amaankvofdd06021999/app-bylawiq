#!/usr/bin/env python3
"""Enumerates strata-relevant CRT decisions outside the Strata Property collection.

Why this exists: 2024 BCCRT 1181 notes that water leak disputes between strata lot owners are
typically decided in the tribunal's small claims jurisdiction as debt or damages claims. So the
Strata Property collection, which the main index covers completely, is not the whole picture.
Searching "strata" in the other collections finds about 1,450 more in small claims and about 50 in
societies and cooperative associations.

These are decisions that *mention* strata, not necessarily decisions about strata law, so the
collection and the matching term are recorded and nothing is claimed beyond that.

Same rules as the main index: sequential, 2s apart, identifying User-Agent, cached, stop on
non-200, no decision document fetched, citation/date/type/URL only, no party names.
"""
import html
import json
import pathlib
import re
import subprocess
import sys
import time

CACHE = pathlib.Path("/Users/amaan/Documents/Apps - Pixeltec/bylawIQ/bylawiq-app/kb/.cache/crt/other")
UA = "BylawIQ-research-bot (contact: amaan.shahana@park10x.com)"
BASE = "https://decisions.civilresolutionbc.ca/crt/en/d/s/index.do"
COLLECTIONS = {"119": "Small Claims", "194": "Societies and Cooperative Associations"}
TERM = "strata"
DISALLOWED = ("/icm/icm/en/item/120620/", "/icm/icm/en/120620/", "/icm/icm/en/item/111322/",
              "/icm/icm/en/111322/")
LI = re.compile(r'<li class="(?:odd|even)[^"]*">', re.S)
CIT = re.compile(r'<span class="citation">\s*([^<]+?)\s*</span>')
DATE = re.compile(r'<span class="publicationDate">\s*(\d{4}-\d{2}-\d{2})\s*</span>')
ITEM = re.compile(r'href="(/crt/[^"]*?/item/\d+/index\.do)')
SUB = re.compile(r'<div class="subMetadata">(.*?)</div>', re.S)


def tags(s: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"<[^>]+>", html.unescape(s)) if p.strip()]
    return [p for p in parts if p != "-"]


def fetch(col: str, page: int) -> str:
    path = CACHE / f"col{col}_p{page:03d}.html"
    if path.exists():
        return path.read_text(errors="replace")
    url = f"{BASE}?cont={TERM}&col={col}&iframe=true&or=date" + (f"&page={page}" if page > 1 else "")
    for bad in DISALLOWED:
        if bad in url:
            raise SystemExit("refusing a path robots.txt disallows")
    time.sleep(2)
    r = subprocess.run(["curl", "-sS", "--max-time", "60", "-A", UA,
                        "-w", "\n__HTTP__%{http_code}", url], capture_output=True, text=True, check=False)
    body, _, code = r.stdout.rpartition("\n__HTTP__")
    if code.strip() != "200":
        raise SystemExit(f"HTTP {code.strip()} on {col} page {page} — stopping")
    path.write_text(body)
    return body


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    rows: dict[str, dict] = {}
    for col, label in COLLECTIONS.items():
        first = fetch(col, 1)
        m = re.search(r"([\d,]+)\s*results?", first)
        expected = int(m.group(1).replace(",", "")) if m else 0
        pages = -(-expected // 25)
        print(f"\n{label} (col {col}): {expected} mention {TERM!r}, {pages} page(s)", file=sys.stderr)
        for page in range(1, pages + 1):
            text = first if page == 1 else fetch(col, page)
            n = 0
            for block in LI.split(text)[1:]:
                c, d, it = CIT.search(block), DATE.search(block), ITEM.search(block)
                if not (c and d and it):
                    continue
                sub = SUB.search(block)
                cit = re.sub(r"(20\d\d)\D*BCCRT\D*(\d+)", r"\1 BCCRT \2", c.group(1))
                rows.setdefault(cit, {
                    "citation": cit, "date": d.group(1),
                    "collection": label,
                    "type": [k for k in (tags(sub.group(1)) if sub else []) if k != label],
                    "matched": TERM,
                    "url": "https://decisions.civilresolutionbc.ca" + it.group(1).split("?")[0],
                })
                n += 1
            if page % 10 == 0 or page == pages:
                print(f"  page {page}/{pages}: {len(rows)} distinct so far", file=sys.stderr)
    out = pathlib.Path(__file__).with_name("crt_other.json")
    out.write_text(json.dumps(sorted(rows.values(), key=lambda r: (r["date"], r["citation"])), indent=1))
    print(f"\n{len(rows)} distinct -> {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
