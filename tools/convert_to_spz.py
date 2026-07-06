# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Convert a trained 3DGS .ply into a distribution-ready .spz (PRD §6.2).

Thin wrapper around the official Niantic spz CLI so scene conversion is a
single reproducible command:

    uv run tools/convert_to_spz.py input.ply -o public/assets/my-scene.spz \
        --sh-degree 3 --update-manifest my-scene

The CLI binary is located via (in order):
  1. the --spz-cli option,
  2. the SPZ_CLI environment variable,
  3. `spz` on PATH.

Build it from https://github.com/nianticlabs/spz if you don't have it yet.
Source .ply files are never committed to this repository (PRD §6.2).
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

MAX_ASSET_BYTES = 50 * 1024 * 1024
REPO_ROOT = Path(__file__).resolve().parent.parent
MANIFEST = REPO_ROOT / "public" / "scenes.json"


def find_cli(explicit: str | None) -> str:
    for candidate in (explicit, os.environ.get("SPZ_CLI")):
        if candidate:
            if shutil.which(candidate) or Path(candidate).is_file():
                return candidate
            sys.exit(f"error: spz CLI not found at {candidate!r}")
    found = shutil.which("spz")
    if found:
        return found
    sys.exit(
        "error: Niantic spz CLI not found.\n"
        "Set SPZ_CLI (or pass --spz-cli), or put `spz` on PATH.\n"
        "Build instructions: https://github.com/nianticlabs/spz"
    )


def update_manifest(slug: str, out_path: Path, sh_degree: int) -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for scene in manifest["scenes"]:
        if scene["slug"] == slug:
            scene["fileSizeBytes"] = out_path.stat().st_size
            scene["shDegree"] = sh_degree
            MANIFEST.write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            print(f"updated scenes.json entry for {slug!r}")
            return
    print(
        f"note: no scenes.json entry with slug {slug!r} — add one manually "
        "(see PRD §6.3 for the schema)."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="source .ply (3DGS point cloud)")
    parser.add_argument("-o", "--output", type=Path, required=True, help="output .spz path")
    parser.add_argument(
        "--sh-degree",
        type=int,
        default=3,
        choices=range(4),
        help="spherical harmonics degree to keep (default: 3 — lower it for oversized scenes)",
    )
    parser.add_argument("--spz-cli", help="path to the Niantic spz CLI binary")
    parser.add_argument(
        "--update-manifest",
        metavar="SLUG",
        help="update fileSizeBytes/shDegree of this slug in public/scenes.json",
    )
    args = parser.parse_args()

    if not args.input.is_file():
        sys.exit(f"error: input not found: {args.input}")
    args.output.parent.mkdir(parents=True, exist_ok=True)

    cli = find_cli(args.spz_cli)
    cmd = [
        cli,
        "compress",
        str(args.input),
        "-o",
        str(args.output),
        "--include-sh",
        str(args.sh_degree),
    ]
    print("$", " ".join(cmd))
    result = subprocess.run(cmd)
    if result.returncode != 0:
        sys.exit(result.returncode)

    size = args.output.stat().st_size
    print(f"wrote {args.output} ({size / 1_000_000:.1f} MB)")
    if size > MAX_ASSET_BYTES:
        sys.exit(
            f"error: output exceeds the 50MB cap ({size} bytes). "
            "Re-run with a lower --sh-degree (PRD §6.2)."
        )

    if args.update_manifest:
        update_manifest(args.update_manifest, args.output, args.sh_degree)


if __name__ == "__main__":
    main()
