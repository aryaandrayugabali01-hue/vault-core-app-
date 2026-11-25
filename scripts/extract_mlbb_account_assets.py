#!/usr/bin/env python3
"""Extract the approved MLBB account preview images from the source product ZIP."""
from pathlib import Path
from zipfile import ZipFile
import shutil

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "frontend" / "src" / "app" / "catalog" / "ML.zip"
DEST = ROOT / "frontend" / "public" / "assets" / "products" / "mlbb-account"

ASSETS = {
    "ML/250/bzvk6k6266lwo82h1pn0q.jpg": "account-overview-79-hero-130-skin.jpg",
    "ML/250/cqeqw0smpt5v9x6052g1me.jpg": "skin-catalog-01.jpg",
    "ML/250/szq89uuikvkjhaxo0x6ri.jpg": "skin-catalog-02.jpg",
    "ML/250/zktvmqe40kkgh6ft8jogfa.jpg": "skin-catalog-03.jpg",
    "ML/250/download (5).webp": "emblem-all-max.webp",
}

def main() -> None:
    if not ARCHIVE.is_file() or ARCHIVE.stat().st_size == 0:
        raise SystemExit(f"Required product archive is missing: {ARCHIVE}")
    DEST.mkdir(parents=True, exist_ok=True)
    with ZipFile(ARCHIVE) as archive:
        names = set(archive.namelist())
        missing = sorted(set(ASSETS) - names)
        if missing:
            raise SystemExit("ML.zip is missing required assets: " + ", ".join(missing))
        for source, filename in ASSETS.items():
            target = DEST / filename
            target.write_bytes(archive.read(source))
            if target.stat().st_size == 0:
                raise SystemExit(f"Empty extracted product image: {target}")
            print(f"extracted /assets/products/mlbb-account/{filename} ({target.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
