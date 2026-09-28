#!/usr/bin/env python3
"""Read-only, resumable aggregate inventory for the development coach cutover.

Prints no member rows, captions, media, or environment values. Keep the ledger in
a private location: it contains opaque page cursors and checksums.
"""

import argparse
import collections
import hashlib
import json
import subprocess
from pathlib import Path


SOURCES = (
    "challenges",
    "checkInCategories",
    "challengeCompletions",
    "dailyActivities",
    "coachRewardSlotsV1",
    "coachProofSubmissionsV1",
    "posts",
)


def page(deployment: str, source: str, cursor: str | None) -> dict:
    args = {"source": source, "paginationOpts": {"numItems": 500, "cursor": cursor}}
    result = subprocess.run(
        [
            "bunx",
            "convex",
            "run",
            "--deployment",
            deployment,
            "coachLegacyInventory:migrationPage",
            json.dumps(args, separators=(",", ":")),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--deployment", required=True)
    parser.add_argument("--ledger", type=Path, required=True)
    args = parser.parse_args()
    if args.deployment != "beloved-stoat-88":
        parser.error("this Stage 10 inventory is restricted to beloved-stoat-88")

    ledger = json.loads(args.ledger.read_text()) if args.ledger.exists() else {}
    for source in SOURCES:
        state = ledger.setdefault(source, {"cursor": None, "done": False, "pages": [], "count": 0, "points": 0, "keys": {}, "states": {}, "links": {}})
        while not state["done"]:
            result = page(args.deployment, source, state["cursor"])
            rows = result["page"]
            canonical = json.dumps(rows, sort_keys=True, separators=(",", ":")).encode()
            state["pages"].append({"count": len(rows), "sha256": hashlib.sha256(canonical).hexdigest()})
            state["count"] += len(rows)
            state["points"] += sum(row.get("points") or 0 for row in rows)
            keys = collections.Counter(state["keys"])
            states = collections.Counter(state["states"])
            links = collections.Counter(state["links"])
            for row in rows:
                if source == "dailyActivities":
                    keys[row["key"]] += 1
                elif source == "challengeCompletions":
                    states["removed" if row["removed"] else "retained"] += 1
                    if row["hasMedia"]:
                        links["completion_media"] += 1
                elif source == "coachProofSubmissionsV1":
                    states[row["state"]] += 1
                    if row["hasStorage"]:
                        links["proof_media"] += 1
                elif source == "coachRewardSlotsV1":
                    keys[row["category"]] += 1
                    states[row["state"]] += 1
                elif source == "posts":
                    if row["challengeCompletionId"]:
                        links["completion_posts"] += 1
                    if row["activityId"]:
                        links["activity_posts"] += 1
                elif source == "challenges":
                    if row["isDailyChallenge"]:
                        states["daily"] += 1
                elif source == "checkInCategories":
                    keys[row["name"]] += 1
                    states["active" if row["active"] else "inactive"] += 1
            state["keys"] = dict(keys)
            state["states"] = dict(states)
            state["links"] = dict(links)
            state["cursor"] = result.get("continueCursor")
            state["done"] = result["isDone"]
            args.ledger.write_text(json.dumps(ledger, indent=2, sort_keys=True))
        print(source, json.dumps({k: state[k] for k in ("count", "points", "keys", "states", "links")}, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()
