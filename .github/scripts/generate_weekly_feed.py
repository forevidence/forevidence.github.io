#!/usr/bin/env python3
"""Generate the Atom feed for the Weekly Briefing (weekly-briefing/feed.xml).

Reads weekly-briefing/data/index.json and each edition file, writes an Atom
1.0 feed with one entry per published edition, newest first.

Output is deterministic: every timestamp comes from the edition data
(published_at, falling back to the edition date), never from the clock, so
CI can regenerate the feed and diff it against the committed file. Because
main only accepts changes through pull requests, feed.xml is committed as
part of each publish PR — run this script after adding an edition:

    python .github/scripts/generate_weekly_feed.py

Exit: 0 on success (feed written), 1 on malformed data.
"""

import json
import sys
from pathlib import Path
from xml.sax.saxutils import escape

DATA_DIR = Path("weekly-briefing/data")
FEED_PATH = Path("weekly-briefing/feed.xml")
SITE = "https://forevidence.ai"
FEED_URL = f"{SITE}/weekly-briefing/feed.xml"
PAGE_URL = f"{SITE}/weekly-briefing.html"


def rfc3339(day):
    """Editions carry dates, not times; publish moments are recorded at day
    granularity, so midnight UTC is the canonical instant."""
    return f"{day}T00:00:00Z"


def entry_xml(edition):
    date = edition["date"]
    updated = rfc3339(edition.get("published_at") or date)
    link = f"{PAGE_URL}?date={date}"
    title = edition.get("title") or f"ForEvidence Weekly Briefing — {date}"

    # Entry body: standfirst, then the edition's headlines by section, then a
    # pointer to the full briefing. Built as escaped-HTML inside <content
    # type="html"> so feed readers render a useful preview.
    html = []
    if edition.get("standfirst"):
        html.append(f"<p><em>{escape(edition['standfirst'])}</em></p>")
    for section in edition.get("sections", []):
        items = section.get("items", [])
        if not items:
            continue
        html.append(f"<h3>{escape(section.get('title', ''))}</h3><ul>")
        for item in items:
            html.append(f"<li>{escape(item.get('headline', ''))}</li>")
        html.append("</ul>")
    html.append(f'<p><a href="{escape(link)}">Read the full briefing, with sources for every item →</a></p>')

    parts = [
        "  <entry>",
        f"    <title>{escape(title)}</title>",
        f'    <link rel="alternate" type="text/html" href="{escape(link)}"/>',
        f"    <id>{escape(link)}</id>",
        f"    <published>{rfc3339(date)}</published>",
        f"    <updated>{updated}</updated>",
    ]
    if edition.get("standfirst"):
        parts.append(f"    <summary>{escape(edition['standfirst'])}</summary>")
    parts.append(f'    <content type="html">{escape("".join(html))}</content>')
    parts.append("  </entry>")
    return "\n".join(parts)


def main():
    index = json.loads((DATA_DIR / "index.json").read_text(encoding="utf-8"))
    editions = []
    for ref in index.get("editions", []):
        path = DATA_DIR / f"{ref['date']}.json"
        if not path.exists():
            print(f"error: index lists {ref['date']} but {path} is missing", file=sys.stderr)
            return 1
        editions.append(json.loads(path.read_text(encoding="utf-8")))
    editions.sort(key=lambda e: e["date"], reverse=True)

    if editions:
        feed_updated = max(rfc3339(e.get("published_at") or e["date"]) for e in editions)
    else:
        feed_updated = rfc3339("2026-01-01")  # placeholder until the first edition

    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<feed xmlns="http://www.w3.org/2005/Atom">',
        "  <title>ForEvidence Weekly Briefing</title>",
        "  <subtitle>A weekly synthesis of movement in AI evaluation, guardrails and observability, standards, and regulation — reviewed before publication.</subtitle>",
        f'  <link rel="self" type="application/atom+xml" href="{FEED_URL}"/>',
        f'  <link rel="alternate" type="text/html" href="{PAGE_URL}"/>',
        f"  <id>{FEED_URL}</id>",
        f"  <updated>{feed_updated}</updated>",
        "  <author><name>ForEvidence.ai</name></author>",
    ]
    lines.extend(entry_xml(e) for e in editions)
    lines.append("</feed>")

    FEED_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {FEED_PATH} with {len(editions)} edition(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
