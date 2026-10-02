#!/usr/bin/env python3
"""Merges every decision index into the two files the kb keeps, and reports coverage."""
import collections
import json
import pathlib

HERE = pathlib.Path(__file__).parent
OUT = pathlib.Path("/Users/amaan/Documents/Apps - Pixeltec/bylawIQ/bylawiq-app/kb/research/decision-candidates")


def load_jsonl(p):
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()] if p.exists() else []


def load_json(p):
    return json.loads(p.read_text()) if p.exists() else []


# --- CRT -------------------------------------------------------------------
crt = {r["citation"]: r for r in load_jsonl(OUT / "crt-index.jsonl")}
for r in crt.values():
    r.setdefault("collection", "Strata Property")
    r.setdefault("matched", None)

# Decisions outside the Strata Property collection are kept in their own file, not merged.
# Sampling the small claims hits showed a large share are non-strata claims that merely cite a
# case whose style of cause contains "Strata Plan" (Downing v. Strata Plan VR2356 appeared in
# three of six sampled snippets, cited for whether an oral hearing is needed on credibility).
# Merging them would pollute an index whose value is that every row is a strata matter.
other = [r for r in load_json(HERE / "crt_other.json") if r["citation"] not in crt]
narrow = load_json(HERE / "crt_other_narrow.json")
narrow_cits = {r["citation"]: r.get("matched_narrow", []) for r in narrow}
for r in other:
    if r["citation"] in narrow_cits:
        r["matched_narrow"] = narrow_cits[r["citation"]]
other.sort(key=lambda r: (r["date"], r["citation"]))
(OUT / "crt-adjacent-index.jsonl").write_text(
    "".join(json.dumps(r, separators=(",", ":")) + "\n" for r in other))
added = len(other)
confident = sum(1 for r in other if r.get("matched_narrow"))

crt_rows = sorted(crt.values(), key=lambda r: (r["date"], r["citation"]))
(OUT / "crt-index.jsonl").write_text(
    "".join(json.dumps(r, separators=(",", ":")) + "\n" for r in crt_rows))

# --- Courts ----------------------------------------------------------------
# Pre-1999 judgments have no neutral citation, so the key falls back to the URL.
key = lambda r: r.get("citation") or r["url"]
courts = {key(r): r for r in load_jsonl(OUT / "courts-index.jsonl")}
for r in load_json(HERE / "bcc_all.json"):
    cur = courts.get(key(r))
    if cur:
        for f in r.get("found_by", []):
            if f not in cur.setdefault("found_by", []):
                cur["found_by"].append(f)
    else:
        courts[key(r)] = r

court_rows = sorted(courts.values(), key=lambda r: (r["date"], r.get("citation") or r.get("file_id", "")))
(OUT / "courts-index.jsonl").write_text(
    "".join(json.dumps(r, separators=(",", ":")) + "\n" for r in court_rows))

# --- Report ----------------------------------------------------------------
print(f"CRT strata collection : {len(crt_rows)} decisions, {crt_rows[0]['date']} to {crt_rows[-1]['date']}")
print(f"CRT adjacent (separate): {added} decisions mentioning strata in other collections, "
      f"{confident} of them matched a narrower strata phrase")
print("        by collection:", dict(collections.Counter(r.get("collection", "?") for r in other)))
cited = sum(1 for r in court_rows if r.get("citation"))
print(f"Courts: {len(court_rows)} judgments, {court_rows[0]['date']} to {court_rows[-1]['date']} "
      f"({cited} with a neutral citation, {len(court_rows) - cited} predating them)")
print("        by court:", dict(collections.Counter(r["court"] for r in court_rows)))
decades = collections.Counter(r["date"][:3] + "0s" for r in court_rows)
print("        by decade:", dict(sorted(decades.items())))
span = int(court_rows[-1]["date"][:4]) - int(court_rows[0]["date"][:4])
print(f"        span: {span} years")
print(f"TOTAL : {len(crt_rows) + len(court_rows)} strata decisions and judgments, "
      f"plus {added} adjacent")
for name in ("crt-index.jsonl", "crt-adjacent-index.jsonl", "courts-index.jsonl"):
    print(f"        {name}: {(OUT / name).stat().st_size // 1024} KB")
