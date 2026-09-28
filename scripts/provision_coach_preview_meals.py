"""Upload two authorised sample photos to the development Convex deployment.

Usage: python3 scripts/provision_coach_preview_meals.py BOWL_IMAGE FLATBREAD_IMAGE
The upload URLs and storage IDs are intentionally never printed.
"""

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

DEPLOYMENT = "beloved-stoat-88"
SAMPLES = (
    ("COACH_PREVIEW_MEAL_BOWL_STORAGE_ID", "burrito bowl"),
    ("COACH_PREVIEW_MEAL_FLATBREAD_STORAGE_ID", "chicken flatbread"),
)
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


def convex(*args: str) -> str:
    result = subprocess.run(
        ["bunx", "convex", *args, "--deployment", DEPLOYMENT],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Pass the bowl and flatbread image paths, in that order.")
    paths = [Path(arg).resolve() for arg in sys.argv[1:]]
    for path in paths:
        if not path.is_file() or path.suffix.lower() not in MIME:
            raise SystemExit(f"Missing or unsupported image: {path}")
        if path.stat().st_size > 5_000_000:
            raise SystemExit(f"Image exceeds the 5 MB preview limit: {path}")
    for (variable, label), path in zip(SAMPLES, paths):
        upload_url = json.loads(convex("run", "upload:generateUploadUrl", "{}"))
        request = urllib.request.Request(
            upload_url,
            data=path.read_bytes(),
            headers={"Content-Type": MIME[path.suffix.lower()]},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            storage_id = json.load(response)["storageId"]
        convex("env", "set", variable, storage_id)
        print(f"Configured {label} on development Convex.")


if __name__ == "__main__":
    main()
