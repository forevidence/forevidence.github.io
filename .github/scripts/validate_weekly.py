#!/usr/bin/env python3
"""Validation gate for Weekly Briefing data (weekly-briefing/data/**).

Checks:
  1. No files tracked under weekly-briefing/data/pending/ — drafts stage in
     Drive, never in this public repo.
  2. index.json is well-formed; every edition file has an index entry and
     vice versa; item_count matches.
  3. Every edition: date matches filename; the five sections in canonical
     order; every item has headline/summary/why_it_matters and >=1 https
     source; no review-only fields (verify/status/drafted) survive to
     publication.
  4. New editions carry approval provenance: approved_by_role + published_at.
     (Editions published before this gate existed are exempt.)
  5. Immutability: an edition that existed at the base ref may only change in
     its corrections[] / corrected fields — items are immutable after publish.
  6. Strings contain no HTML-tag-like sequences or control characters
     (defense-in-depth with the text-node renderer).
  7. --check-urls: source URLs of new/changed editions must resolve.

Usage: validate_weekly.py --base-ref <sha> [--check-urls]
Exit: 0 ok, 1 validation failure.
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

DATA_DIR = Path("weekly-briefing/data")
PENDING_DIR = DATA_DIR / "pending"
SECTION_IDS = [
    "top-developments",
    "eval-guardrails-observability",
    "standards",
    "regulation-policy",
    "watch-next-week",
]
REQUIRED_ITEM_FIELDS = ["headline", "summary", "why_it_matters"]
REVIEW_ONLY_FIELDS = ["status", "drafted"]
# editions published before the approval-provenance gate existed
PROVENANCE_EXEMPT = {"2026-07-31"}
TAG_RE = re.compile(r"<\s*[a-zA-Z/!]")
CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

errors = []


def err(msg):
    errors.append(msg)


def at_base(ref, path):
    try:
        out = subprocess.run(["git", "show", f"{ref}:{path}"],
                             capture_output=True, text=True, check=True)
        return out.stdout
    except subprocess.CalledProcessError:
        return None


def check_strings(obj, where):
    if isinstance(obj, str):
        if TAG_RE.search(obj):
            err(f"{where}: HTML-tag-like sequence in string: {obj[:60]!r}")
        if CTRL_RE.search(obj):
            err(f"{where}: control character in string")
    elif isinstance(obj, dict):
        for k, v in obj.items():
            check_strings(v, f"{where}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            check_strings(v, f"{where}[{i}]")


def check_url(url):
    req = urllib.request.Request(url, method="HEAD",
                                 headers={"User-Agent": "forevidence-validator"})
    try:
        urllib.request.urlopen(req, timeout=15)
        return True
    except Exception:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "forevidence-validator"})
            urllib.request.urlopen(req, timeout=15)
            return True
        except Exception:
            return False


def validate_edition(path, doc, is_new, check_urls):
    name = path.name
    date = doc.get("date", "")
    if f"{date}.json" != name:
        err(f"{name}: date field {date!r} does not match filename")

    ids = [s.get("id") for s in doc.get("sections", [])]
    if ids != SECTION_IDS:
        err(f"{name}: sections must be exactly {SECTION_IDS}, got {ids}")

    for f in REVIEW_ONLY_FIELDS:
        if f in doc:
            err(f"{name}: review-only field {f!r} must not be published")

    if is_new and date not in PROVENANCE_EXEMPT:
        if not doc.get("approved_by_role"):
            err(f"{name}: missing approved_by_role (approval provenance required)")
        if not doc.get("published_at"):
            err(f"{name}: missing published_at")

    count = 0
    for section in doc.get("sections", []):
        sid = section.get("id", "?")
        items = section.get("items", [])
        if not items:
            err(f"{name} [{sid}]: no items")
        for n, item in enumerate(items, 1):
            count += 1
            where = f"{name} [{sid}] item {n}"
            for f in REQUIRED_ITEM_FIELDS:
                if not item.get(f):
                    err(f"{where}: missing {f}")
            if "verify" in item:
                err(f"{where}: unresolved verify flags must not be published")
            sources = item.get("sources", [])
            if not sources:
                err(f"{where}: no sources")
            for src in sources:
                url = str(src.get("url", ""))
                if not url.startswith("https://"):
                    err(f"{where}: source URL not https: {url!r}")
                elif check_urls and is_new and not check_url(url):
                    err(f"{where}: source URL does not resolve: {url}")

    check_strings(doc, name)
    return count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-ref", required=True)
    ap.add_argument("--check-urls", action="store_true")
    args = ap.parse_args()

    if PENDING_DIR.exists():
        tracked = subprocess.run(
            ["git", "ls-files", str(PENDING_DIR)],
            capture_output=True, text=True).stdout.strip()
        if tracked:
            err(f"files tracked under {PENDING_DIR}/ — drafts stage in Drive, "
                f"never in this repo: {tracked.splitlines()}")

    index_path = DATA_DIR / "index.json"
    if not index_path.exists():
        err(f"{index_path} missing")
        report()
    index = json.loads(index_path.read_text())
    index_dates = [e.get("date") for e in index.get("editions", [])]
    if index_dates != sorted(index_dates, reverse=True):
        err("index.json editions[] not sorted newest-first")

    edition_files = sorted(p for p in DATA_DIR.glob("*.json")
                           if p.name != "index.json")
    file_dates = [p.stem for p in edition_files]
    for d in index_dates:
        if d not in file_dates:
            err(f"index lists {d} but weekly-briefing/data/{d}.json missing")
    for d in file_dates:
        if d not in index_dates:
            err(f"{d}.json exists but is not in index.json")

    for path in edition_files:
        doc = json.loads(path.read_text())
        repo_path = path.as_posix()
        old_raw = at_base(args.base_ref, repo_path)
        is_new = old_raw is None
        count = validate_edition(path, doc, is_new, args.check_urls)

        entry = next((e for e in index.get("editions", [])
                      if e.get("date") == path.stem), None)
        if entry and entry.get("item_count") != count:
            err(f"{path.name}: index item_count {entry.get('item_count')} != "
                f"actual {count}")

        if not is_new:
            old = json.loads(old_raw)
            mutable = {"corrections", "corrected"}
            old_core = {k: v for k, v in old.items() if k not in mutable}
            new_core = {k: v for k, v in doc.items() if k not in mutable}
            if old_core != new_core:
                changed = [k for k in set(old_core) | set(new_core)
                           if old_core.get(k) != new_core.get(k)]
                err(f"{path.name}: published edition modified (fields: "
                    f"{changed}) — editions are immutable; append to "
                    f"corrections[] instead")

    report()


def report():
    if errors:
        print(f"VALIDATION FAILED — {len(errors)} problem(s):")
        for e in errors:
            print(f"  x {e}")
        sys.exit(1)
    print("weekly-briefing data valid")
    sys.exit(0)


if __name__ == "__main__":
    main()
