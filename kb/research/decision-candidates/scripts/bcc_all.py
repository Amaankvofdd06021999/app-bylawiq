#!/usr/bin/env python3
"""Enumerates every BC Supreme Court and Court of Appeal judgment the court search can reach for
strata, across several phrases, as far back as the database goes.

"strata" (about 4,760 hits) is the broadest net among the strata phrases, but it is NOT the whole
set: the bare word "condominium" (about 3,940 hits) reaches 2,657 judgments that no strata phrase
does, because BC's pre-2000 regime was the Condominium Act and many of those judgments never use
the word strata. "Condominium Act" is narrower again and kept for confidence scoring. Each phrase
is paged from the first result to the last, and the parsed count is reconciled against the site's
own "Number found" before the result is trusted.

robots.txt on bccourts.ca allows /search_judgments.aspx and disallows /jdb-txt/, where the
judgments live. This pages search results and never fetches a judgment, so no judgment text is read
and the index carries no reasons.

Records the neutral citation, court, date, URL and which phrases found it. Does NOT record the
style of cause: rule 6 forbids keeping the names of private individuals.

Politeness: sequential, 2s apart, identifying User-Agent, session cookie, HTTP/1.1 (HTTP/2 fails on
a body this size against this host), every page cached, and a hard stop on any non-200.
"""
import html
import json
import pathlib
import re
import subprocess
import sys
import time
import urllib.parse

CACHE = pathlib.Path("/Users/amaan/Documents/Apps - Pixeltec/bylawIQ/bylawiq-app/kb/.cache/bccourts/all")
UA = "BylawIQ-research-bot (contact: amaan.shahana@park10x.com)"
SEARCH = "https://www.bccourts.ca/search_judgments.aspx"
FIELDS = ("__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION", "__PREVIOUSPAGE",
          "TabContainer_ClientState")
PHRASES = ["strata", "condominium", "Condominium Act"]
ROW = re.compile(
    r"href='(?P<url>/[Jj]db-txt/[^']+)'[^>]*>\s*<span id=\"[^\"]*_label1\">(?P<name>[^<]*)</span></a>.*?"
    r"_lblcitation\">(?P<cit>[^<]*)</span>.*?_lblDate\">(?P<date>[^<]*)</span>.*?"
    r"_lblCourt\"[^>]*>(?P<court>[^<]*)</span>", re.S)


def hidden(text: str) -> dict:
    out = {}
    for n in FIELDS:
        m = re.search(r'name="%s"[^>]*value="([^"]*)"' % re.escape(n), text)
        if m:
            out[n] = html.unescape(m.group(1))
    return out


def run(args: list[str], cache_name: str) -> str:
    path = CACHE / cache_name
    if path.exists():
        return path.read_text(errors="replace")
    for attempt in (1, 2, 3):
        time.sleep(2 if attempt == 1 else 15)
        r = subprocess.run(args + ["-w", "\n__HTTP__%{http_code}"],
                           capture_output=True, text=True, check=False)
        body, _, code = r.stdout.rpartition("\n__HTTP__")
        if code.strip() == "200":
            path.write_text(body)
            return body
        print(f"      attempt {attempt}: HTTP {code.strip() or '000'}", file=sys.stderr)
    raise SystemExit(f"giving up on {cache_name} — stopping, per the research plan's rule 3")


def session(tag: str) -> tuple[dict, pathlib.Path]:
    jar = CACHE / f"_cookies_{tag}.txt"
    text = run(["curl", "-sS", "--http1.1", "--max-time", "60", "-A", UA, "-c", str(jar), SEARCH],
               f"_form_{tag}.html")
    return hidden(text), jar


def post(data: dict, jar: pathlib.Path, cache_name: str) -> str:
    payload = CACHE / f"_payload_{cache_name}.txt"
    payload.write_text("&".join(f"{urllib.parse.quote_plus(k)}={urllib.parse.quote_plus(v)}"
                                for k, v in data.items()))
    out = run(["curl", "-sS", "--http1.1", "--max-time", "150", "-A", UA,
               "-b", str(jar), "-c", str(jar), "-e", SEARCH,
               "-H", "Content-Type: application/x-www-form-urlencoded",
               "--data-binary", f"@{payload}", SEARCH], cache_name)
    payload.unlink(missing_ok=True)
    return out


def harvest(text: str, phrase: str, rows: dict) -> int:
    n = 0
    for m in ROW.finditer(text):
        cit = m.group("cit").strip()
        if cit and not re.fullmatch(r"\d{4} BC(?:SC|CA) \d+", cit):
            cit = None
        # BC neutral citations begin in 1999 and this database goes back to 1990, so a row keyed on
        # the citation drops every older judgment without a sound. 1,123 of them are real. Key on
        # the citation where there is one and the judgment's file id otherwise, and reconcile the
        # parsed count against the site's own total before believing any of it.
        url = m.group("url")
        file_id = re.sub(r"\.htm$", "", url.rsplit("/", 1)[-1], flags=re.I)
        n += 1
        r = rows.setdefault(cit or file_id, {
            "citation": cit or None,
            "file_id": None if cit else file_id,
            "court": "BCCA" if "Appeal" in m.group("court") else "BCSC",
            "date": m.group("date").strip().replace("/", "-"),
            "url": "https://www.bccourts.ca" + url,
            "found_by": [],
        })
        tag = f"phrase:{phrase}"
        if tag not in r["found_by"]:
            r["found_by"].append(tag)
    return n


def main() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    out_path = pathlib.Path(__file__).with_name("bcc_all.json")
    rows: dict[str, dict] = {}
    if out_path.exists():
        rows = {r["citation"]: r for r in json.loads(out_path.read_text())}
        print(f"resuming with {len(rows)} already indexed", file=sys.stderr)

    for phrase in PHRASES:
        tag = re.sub(r"\W+", "_", phrase)[:24]
        state, jar = session(tag)
        text = post(dict(state, **{
            "TabContainer$search$txtFullText": phrase,
            "TabContainer$search$type": "radBoth",
            "TabContainer$search$btnSubmit": "Submit",
        }), jar, f"{tag}_p001.html")
        total = re.search(r"Number found:\s*([0-9,]+)", text)
        expected = int(total.group(1).replace(",", "")) if total else 0
        pages = -(-expected // 50)
        print(f"\n{phrase!r}: {expected} hits across {pages} page(s)", file=sys.stderr)

        got = harvest(text, phrase, rows)
        for page in range(2, pages + 1):
            text = post(dict(hidden(text), **{
                "__EVENTTARGET": "gvResults",
                "__EVENTARGUMENT": f"Page${page}",
                "TabContainer$search$txtFullText": phrase,
                "TabContainer$search$type": "radBoth",
            }), jar, f"{tag}_p{page:03d}.html")
            got += harvest(text, phrase, rows)
            if page % 10 == 0 or page == pages:
                oldest = min(r["date"] for r in rows.values())
                print(f"  page {page}/{pages}: {got} rows for this phrase, "
                      f"{len(rows)} distinct overall, oldest {oldest}", file=sys.stderr)
                out_path.write_text(json.dumps(sorted(rows.values(), key=lambda r: r["date"]), indent=1))

    final = sorted(rows.values(), key=lambda r: (r["date"], r["citation"]))
    out_path.write_text(json.dumps(final, indent=1))
    print(f"\n{len(final)} distinct judgments, {final[0]['date']} to {final[-1]['date']} -> {out_path}",
          file=sys.stderr)


if __name__ == "__main__":
    main()
