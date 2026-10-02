#!/usr/bin/env python3
"""Pages the four remaining CRT collections to the end and merges them into the adjacent index."""
import json, pathlib, re, subprocess, sys, time

CACHE = pathlib.Path("/Users/amaan/Documents/Apps - Pixeltec/bylawIQ/bylawiq-app/kb/.cache/crt/rest")
OUT = pathlib.Path("/Users/amaan/Documents/Apps - Pixeltec/bylawIQ/bylawiq-app/kb/research/decision-candidates/crt-adjacent-index.jsonl")
UA = "BylawIQ-research-bot (contact: amaan.shahana@park10x.com)"
BASE = "https://decisions.civilresolutionbc.ca/crt/en/d/s/index.do"
COLS = {"192": "Accident Benefits", "193": "Accident Claims",
        "225": "Accident Responsibility", "226": "Intimate Images"}
NARROW = ["strata corporation", "strata lot", "Strata Property Act", "common property"]

def fetch(col, phrase, page=1):
    tag = re.sub(r"\W+", "_", phrase)[:20]
    path = CACHE / f"col{col}_{tag}_p{page}.html"
    if path.exists():
        return path.read_text(errors="replace")
    url = f"{BASE}?cont={phrase.replace(' ', '+')}&col={col}&iframe=true&or=date" + (f"&page={page}" if page > 1 else "")
    time.sleep(2)
    r = subprocess.run(["curl", "-sS", "--max-time", "60", "-A", UA, "-w", "\n__HTTP__%{http_code}", url],
                       capture_output=True, text=True, check=False)
    body, _, code = r.stdout.rpartition("\n__HTTP__")
    if code.strip() != "200":
        raise SystemExit(f"HTTP {code.strip()} on col {col} p{page} — stopping")
    path.write_text(body)
    return body

LI = re.compile(r'<li class="(?:odd|even)[^"]*">', re.S)
CIT = re.compile(r'<span class="citation">\s*([^<]+?)\s*</span>')
DATE = re.compile(r'<span class="[^"]*date[^"]*">\s*(\d{4}-\d{2}-\d{2})', re.I)
URL = re.compile(r'href="(/crt/[a-z]+/en/item/\d+/index\.do)')
TY = re.compile(r'<div class="subMetadata">.*?-\s*<span>([^<]+)</span>', re.S)

rows = {}
for col, name in COLS.items():
    first = fetch(col, "strata")
    m = re.search(r"([\d,]+)\s*results?", first)
    total = int(m.group(1).replace(",", "")) if m else 0
    pages = -(-total // 25)
    got = 0
    for page in range(1, pages + 1):
        t = first if page == 1 else fetch(col, "strata", page)
        for block in LI.split(t)[1:]:
            c, d, u = CIT.search(block), DATE.search(block), URL.search(block)
            if not (c and u):
                continue
            cit = re.sub(r"(20\d\d)\D*BCCRT\D*(\d+)", r"\1 BCCRT \2", c.group(1))
            rows[cit] = {"citation": cit, "date": d.group(1) if d else "", "collection": name,
                         "type": [name] + ([TY.search(block).group(1).strip()] if TY.search(block) else []),
                         "matched": "strata",
                         "url": "https://decisions.civilresolutionbc.ca" + u.group(1)}
            got += 1
    print(f"col {col} {name:24} expected {total:3}, parsed {got:3}", file=sys.stderr)
    if got != total:
        print(f"  MISMATCH on col {col}: {total - got} row(s) unaccounted for", file=sys.stderr)

# Which of them actually discuss strata law?
for phrase in NARROW:
    for col in COLS:
        t = fetch(col, phrase)
        m = re.search(r"([\d,]+)\s*results?", t)
        total = int(m.group(1).replace(",", "")) if m else 0
        for page in range(1, -(-total // 25) + 1):
            tt = t if page == 1 else fetch(col, phrase, page)
            for block in LI.split(tt)[1:]:
                c = CIT.search(block)
                if not c:
                    continue
                cit = re.sub(r"(20\d\d)\D*BCCRT\D*(\d+)", r"\1 BCCRT \2", c.group(1))
                if cit in rows:
                    rows[cit].setdefault("matched_narrow", [])
                    if phrase not in rows[cit]["matched_narrow"]:
                        rows[cit]["matched_narrow"].append(phrase)

existing = [json.loads(l) for l in OUT.read_text().splitlines() if l.strip()]
have = {r["citation"] for r in existing}
added = [r for c, r in rows.items() if c not in have]
for r in added:
    if "matched_narrow" in r:
        r["matched_narrow"] = sorted(r["matched_narrow"])
allrows = sorted(existing + added, key=lambda r: (r["date"], r["citation"]))
OUT.write_text("".join(json.dumps(r, separators=(",", ":")) + "\n" for r in allrows))
print(f"\n{len(rows)} row(s) found in the four collections; {len(added)} new; index now {len(allrows)}", file=sys.stderr)
print("of the new rows, discussing strata law:",
      sum(1 for r in added if r.get("matched_narrow")), file=sys.stderr)
for r in added:
    if r.get("matched_narrow"):
        print("   ", r["citation"], r["date"], r["collection"], r["matched_narrow"], file=sys.stderr)
