#!/usr/bin/env python3
"""Re-parses the cached 'condominium' search pages, keeping judgments that predate neutral
citations. BC neutral citations begin in 1999; keying a row on the citation silently drops every
judgment older than that, and the court database goes back to 1990. The key is the citation where
there is one and the judgment's file id otherwise.

Reads only the cached pages — nothing is fetched. No judgment text is read, and no style of cause
is recorded (rule 6: do not keep the names of private individuals).
"""
import json, pathlib, re, sys

CACHE = pathlib.Path("/Users/amaan/Documents/Apps - Pixeltec/bylawIQ/bylawiq-app/kb/.cache/bccourts/condo")
OUT = pathlib.Path(__file__).with_name("bcc_condo.json")
ROW = re.compile(
    r"href='(?P<url>/[Jj]db-txt/[^']+)'[^>]*>\s*<span id=\"[^\"]*_label1\">(?P<name>[^<]*)</span></a>.*?"
    r"_lblcitation\">(?P<cit>[^<]*)</span>.*?"
    r"(?:_lblDocket\">(?P<docket>[^<]*)</span>.*?)?"
    r"_lblDate\">(?P<date>[^<]*)</span>.*?"
    r"_lblCourt\"[^>]*>(?P<court>[^<]*)</span>", re.S)

rows: dict[str, dict] = {}
pages = sorted(CACHE.glob("condominium_p*.html"))
expected = None
for p in pages:
    text = p.read_text(errors="replace")
    if expected is None:
        m = re.search(r"Number found:\s*([0-9,]+)", text)
        expected = int(m.group(1).replace(",", "")) if m else 0
    for m in ROW.finditer(text):
        cit = m.group("cit").strip() or None
        if cit and not re.fullmatch(r"\d{4} BC(?:SC|CA) \d+", cit):
            cit = None
        url = m.group("url")
        file_id = re.sub(r"\.htm$", "", url.rsplit("/", 1)[-1], flags=re.I)
        key = cit or file_id
        r = rows.setdefault(key, {
            "citation": cit,
            "file_id": None if cit else file_id,
            "court": "BCCA" if "Appeal" in m.group("court") else "BCSC",
            "date": m.group("date").strip().replace("/", "-"),
            "docket": (m.group("docket") or "").strip() or None,
            "url": "https://www.bccourts.ca" + url,
            "found_by": [],
        })
        if "phrase:condominium" not in r["found_by"]:
            r["found_by"].append("phrase:condominium")

print(f"{len(pages)} cached page(s); site reported {expected} hits; parsed {len(rows)} distinct", file=sys.stderr)
if expected and len(rows) < expected * 0.97:
    print(f"  SHORT by {expected - len(rows)} — do not treat this as complete", file=sys.stderr)
dated = sorted(rows.values(), key=lambda r: r["date"])
print(f"  {dated[0]['date']} to {dated[-1]['date']}; "
      f"{sum(1 for r in dated if not r['citation'])} predate neutral citations", file=sys.stderr)
OUT.write_text(json.dumps(dated, indent=1))
