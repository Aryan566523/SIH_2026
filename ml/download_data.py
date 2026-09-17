# -*- coding: utf-8 -*-
"""Download the Elliptic labeled Bitcoin dataset (real-world validation data).

Source: Hugging Face mirror `yhoma/elliptic-bitcoin-dataset` of the public
Elliptic dataset (Elliptic, 2019 — "Anticipating attacks on the Bitcoin
blockchain network"). It is used ONLY as a separate, clearly-labeled
real-world benchmark for the tx-level model. It is never mixed into the
synthetic wallet model's training data (RULES.md §5: synthetic data must be
clearly labeled and never silently mixed into real-world validated numbers).

Files:
  elliptic_txs_classes.csv      (~3 MB)  tx_id,time step,class
  elliptic_txs_edgelist.csv     (~4 MB)  tx_id1,tx_id2
  elliptic_txs_features.csv     (~690 MB, LFS)  tx_id + 166 features

Usage:
  python download_data.py                 # classes + edgelist (fast)
  python download_data.py --full          # + the 690 MB features file
  python download_data.py --dir ../ml/data
"""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
import urllib.request
from pathlib import Path

BASE = "https://huggingface.co/datasets/yhoma/elliptic-bitcoin-dataset/"

FILES = {
    "elliptic_txs_classes.csv": 3_305_144,
    "elliptic_txs_edgelist.csv": 4_470_584,
    "elliptic_txs_features.csv": 689_683_771,
}


def _sha256(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            block = f.read(chunk)
            if not block:
                break
            h.update(block)
    return h.hexdigest()


def download(url: str, dest: Path, expected_size: int) -> None:
    if dest.exists() and dest.stat().st_size == expected_size:
        print(f"  already present: {dest.name} ({dest.stat().st_size / 1e6:.1f} MB)")
        return
    tmp = dest.with_suffix(".part")
    print(f"  downloading {dest.name} ({expected_size / 1e6:.0f} MB)...")
    req = urllib.request.Request(url, headers={"User-Agent": "chainsentinel-ml/0.1"})
    with urllib.request.urlopen(req) as resp, open(tmp, "wb") as out:
        done = 0
        while True:
            block = resp.read(1 << 20)
            if not block:
                break
            out.write(block)
            done += len(block)
            if done % (64 << 20) == 0:
                print(f"    {done / 1e6:.0f} MB...")
    os.replace(tmp, dest)
    print(f"  done: {dest.name} ({dest.stat().st_size / 1e6:.1f} MB)")


def main() -> int:
    ap = argparse.ArgumentParser(description="Download the Elliptic labeled Bitcoin dataset")
    ap.add_argument("--dir", default=str(Path(__file__).parent / "data" / "elliptic"))
    ap.add_argument("--full", action="store_true", help="also download the 690 MB features file")
    ap.add_argument("--verify", action="store_true", help="print SHA-256 of downloaded files")
    args = ap.parse_args()

    out_dir = Path(args.dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    targets = ["elliptic_txs_classes.csv", "elliptic_txs_edgelist.csv"]
    if args.full:
        targets.append("elliptic_txs_features.csv")
        print("NOTE: elliptic_txs_features.csv is ~690 MB (LFS). Proceeding...")
    else:
        print("NOTE: features file skipped (--full for the 690 MB file). The tx-level "
              "Elliptic benchmark model requires it; the synthetic wallet model does not.")

    for name in targets:
        download(f"{BASE}/{name}", out_dir / name, FILES[name])

    if args.verify:
        print("\nSHA-256 verification:")
        for name in targets:
            p = out_dir / name
            if p.exists():
                print(f"  {name}: {_sha256(p)}")

    print("\nElliptic dataset ready at:", out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())