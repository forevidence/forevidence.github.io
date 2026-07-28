#!/usr/bin/env python3
"""Validation gate for Policy Signal Daily Brief data (briefs/data/**).

Checks (see docs/policy-signal/TECHNICAL_DESIGN.md §6):
  1. Every day file conforms to briefs/data/schema.json, and its date matches
     its filename.
  2. All strings are plain text: no HTML angle brackets, no control characters
     (newlines allowed only in Tier B bodies).
  3. All URLs parse as https.
  4. index.json is consistent: newest-first, unique dates, one entry per day
     file and one file per entry, item_count/has_analysis accurate.
  5. Immutability against a base git ref: published items are never edited,
     corrections are append-only, index entries for published days change only
     their `corrected` flag.
  6. Optionally (--check-urls) every URL in files changed since the base ref
     resolves over HTTPS.

Exit code 0 = pass, 1 = violations found.
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

try:
    import jsonschema
except ImportError:
    jsonschema = None

DATA_DIR = Path("briefs/data")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# C0 controls; \n (0x0A) is conditionally allowed, \r and \t never.
CONTROL_RE = re.compile(r"[\x00-\x09\x0b-\x1f\x7f]")

errors = []


def err(msg: str) -> None:
    errors.append(msg)
    print(f"ERROR: {msg}", file=sys.stderr)


def iter_strings(node, path="$"):
    if isinstance(node, str):
        yield path, node
    elif isinstance(node, dict):
        for k, v in node.items():
            yield from iter_strings(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from iter_strings(v, f"{path}[{i}]")


def check_plain_text(day: dict, fname: str) -> None:
    for path, s in iter_strings(day):
        if "<" in s or ">" in s:
            err(f"{fname}: HTML angle bracket in string at {path}")
        stripped = s.replace("\n", "") if path.endswith(".body") else s
        if "\n" in stripped or CONTROL_RE.search(stripped):
            err(f"{fname}: control character in string at {path}")


def collect_urls(day: dict):
    for item in day.get("items", []):
        if item.get("tier") == "A" and "source_url" in item:
            yield item["source_url"]
        for c in item.get("citations", []) or []:
            yield c.get("url", "")


def check_urls_syntax(day: dict, fname: str) -> None:
    for url in collect_urls(day):
        if not url.startswith("https://") or " " in url:
            err(f"{fname}: URL is not clean https ({url!r})")


def check_urls_resolve(day: dict, fname: str) -> None:
    for url in collect_urls(day):
        last = None
        for _ in range(3):
            try:
                req = urllib.request.Request(url, method="GET", headers={
                    "User-Agent": "ForEvidence-PolicySignal-validator/1.0"})
                with urllib.request.urlopen(req, timeout=20) as resp:
                    if resp.status < 400:
                        last = None
                        break
                    last = f"HTTP {resp.status}"
            except Exception as e:  # noqa: BLE001 — any failure is a retry
                last = str(e)
        if last is not None:
            err(f"{fname}: citation URL failed to resolve after retries: {url} ({last})")


def git_show(ref: str, path: str):
    proc = subprocess.run(["git", "show", f"{ref}:{path}"],
                          capture_output=True, text=True)
    if proc.returncode != 0:
        return None
    return json.loads(proc.stdout)


def check_immutability(base_ref: str, day: dict, fname: str) -> None:
    old = git_show(base_ref, f"{DATA_DIR}/{fname}")
    if old is None:
        return  # new file — nothing to preserve
    for field in ("date", "published_at", "no_material_developments", "items"):
        if old.get(field) != day.get(field):
            err(f"{fname}: published field '{field}' was modified; "
                f"day files are immutable except for appended corrections")
    old_corr, new_corr = old.get("corrections", []), day.get("corrections", [])
    if new_corr[: len(old_corr)] != old_corr:
        err(f"{fname}: corrections are append-only; existing entries changed")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-ref", help="git ref to enforce immutability against")
    ap.add_argument("--check-urls", action="store_true",
                    help="verify that URLs in changed day files resolve")
    args = ap.parse_args()

    schema = json.loads((DATA_DIR / "schema.json").read_text())
    index = json.loads((DATA_DIR / "index.json").read_text())

    day_files = sorted(p for p in DATA_DIR.glob("*.json")
                       if p.name not in ("schema.json", "index.json"))

    changed = {p.name for p in day_files}
    if args.base_ref:
        proc = subprocess.run(
            ["git", "diff", "--name-only", args.base_ref, "--", str(DATA_DIR)],
            capture_output=True, text=True)
        if proc.returncode == 0:
            changed = {Path(line).name for line in proc.stdout.splitlines()}

    days = {}
    for path in day_files:
        fname = path.name
        stem = path.stem
        if not DATE_RE.match(stem):
            err(f"{fname}: filename is not YYYY-MM-DD.json")
            continue
        try:
            day = json.loads(path.read_text())
        except json.JSONDecodeError as e:
            err(f"{fname}: invalid JSON ({e})")
            continue
        days[stem] = day

        if jsonschema is not None:
            for e in jsonschema.Draft7Validator(schema).iter_errors(day):
                err(f"{fname}: schema violation at {'/'.join(map(str, e.path)) or '<root>'}: {e.message}")
        if day.get("date") != stem:
            err(f"{fname}: 'date' field {day.get('date')!r} does not match filename")
        if day.get("no_material_developments") and day.get("items"):
            err(f"{fname}: no_material_developments is true but items is non-empty")
        for i, item in enumerate(day.get("items", [])):
            if item.get("tier") == "B" and not item.get("approval_id"):
                err(f"{fname}: items[{i}] is Tier B without an approval_id")
        check_plain_text(day, fname)
        check_urls_syntax(day, fname)
        if args.base_ref:
            check_immutability(args.base_ref, day, fname)
        if args.check_urls and fname in changed:
            check_urls_resolve(day, fname)

    # Index consistency
    entries = index.get("days", [])
    dates = [e.get("date") for e in entries]
    if len(dates) != len(set(dates)):
        err("index.json: duplicate dates")
    if dates != sorted(dates, reverse=True):
        err("index.json: days must be sorted newest-first")
    for e in entries:
        d = e.get("date")
        if d not in days:
            err(f"index.json: entry {d} has no day file")
            continue
        day = days[d]
        if e.get("item_count") != len(day.get("items", [])):
            err(f"index.json: item_count for {d} is {e.get('item_count')}, "
                f"file has {len(day.get('items', []))}")
        has_b = any(i.get("tier") == "B" for i in day.get("items", []))
        if bool(e.get("has_analysis")) != has_b:
            err(f"index.json: has_analysis for {d} does not match file")
        if bool(e.get("corrected")) != bool(day.get("corrections")):
            err(f"index.json: corrected flag for {d} does not match file")
    for d in days:
        if d not in dates:
            err(f"index.json: day file {d}.json is not listed")

    if errors:
        print(f"\n{len(errors)} violation(s).", file=sys.stderr)
        return 1
    print(f"OK: {len(days)} day file(s) valid, index consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
