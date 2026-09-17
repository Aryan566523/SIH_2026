# -*- coding: utf-8 -*-
"""One-command ML setup + training runner.

Checks that all Python dependencies are installed (installing any that are
missing), then trains the wallet risk model, then prints a success report
with the metrics, gate result and where the model was exported so the API
can pick it up.

Usage (from the repo root or anywhere):
    python ml/setup_and_train.py
    python ml/setup_and_train.py --n-wallets 4000 --seed 42
    python ml/setup_and_train.py --with-elliptic      # + real-world Elliptic benchmark
    python ml/setup_and_train.py --force              # export even if gates fail

Exit codes:
    0  success (model trained, gates passed)
    1  training failed or gates blocked (unless --force)
    2  dependency install failed
"""

from __future__ import annotations

import argparse
import importlib
import json
import subprocess
import sys
from pathlib import Path

ML_DIR = Path(__file__).resolve().parent

REQUIRED = [
    ("numpy", "numpy"),
    ("pandas", "pandas"),
    ("sklearn", "scikit-learn"),
    ("xgboost", "xgboost"),
]

REQUIREMENTS = ML_DIR / "requirements.txt"


def check_python() -> None:
    if sys.version_info < (3, 10):
        print(f"[ERROR] Python {sys.version_info.major}.{sys.version_info.minor} is too old; "
              f"need >= 3.10 (XGBoost requirement).")
        sys.exit(2)


def missing_dependencies() -> list:
    missing = []
    for module, pkg in REQUIRED:
        try:
            importlib.import_module(module)
        except ImportError:
            missing.append(pkg)
    return missing


def install_dependencies(missing: list) -> bool:
    print(f"[INSTALL] Installing missing dependencies: {', '.join(missing)}")
    print(f"   -> pip install -r {REQUIREMENTS.name}")
    try:
        res = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS)],
            capture_output=True, text=True,
        )
        if res.returncode != 0:
            print(res.stderr[-2000:])
            return False
        return True
    except Exception as exc:  # noqa: BLE001            print(f"[ERROR] pip install failed: {exc}")
        return False


def run_training(args) -> subprocess.CompletedProcess:
    cmd = [sys.executable, str(ML_DIR / "train.py"),
           "--n-wallets", str(args.n_wallets),
           "--seed", str(args.seed),
           "--out", str(args.out)]
    if args.with_elliptic:
        cmd.append("--with-elliptic")
    if args.force:
        cmd.append("--force")
    print(f"[TRAIN] Running: {' '.join(cmd)}\n")
    return subprocess.run(cmd, cwd=ML_DIR)


def print_success_report(out_dir: Path, returncode: int, forced: bool) -> None:
    print("\n" + "=" * 72)
    print("[SUCCESS] TRAINING COMPLETE - SUCCESS REPORT")
    print("=" * 72)

    manifest_path = out_dir / "manifest.json"
    metrics_path = out_dir / "metrics.json"
    if not manifest_path.exists() or not metrics_path.exists():
        print("[WARN] Artifacts missing - training did not complete cleanly.")
        return

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))

    print(f"\n[PACKAGE] Model version : {manifest['model_version']}")
    print(f"   Model type    : {manifest['model_type']}")
    print(f"   Trees         : {manifest['n_trees']}")
    print(f"   Features      : {len(manifest['features'])} (interpretable)")
    print(f"   Model sha256  : {manifest['model_sha256'][:16]}...")
    print(f"   Trained at    : {manifest['trained_at']}")

    print("\n[METRICS] Held-out TEST metrics:")
    test = metrics["test"]
    for k, v in test.items():
        if k == "n":
            continue
        print(f"   {k:22s} {v}")

    gate = metrics["gate_passed"]
    print(f"\n[GATES] Deployment gates : {'PASSED' if gate else 'BLOCKED'}"
          + ("  (exported with --force)" if forced and not gate else ""))

    print(f"\n[FILES] Artifacts written to: {out_dir.resolve()}")
    for name in ("model.json", "manifest.json", "metrics.json", "golden_vectors.json", "MODEL_CARD.md"):
        p = out_dir / name
        print(f"   - {name}  ({p.stat().st_size / 1024:.0f} KB)" if p.exists() else f"   - {name}  (missing)")

    prov = manifest.get("data_provenance", {})
    syn = prov.get("synthetic", {})
    print(f"\n[DATA] Training data  : {syn.get('n_wallets', '?')} labeled synthetic wallets "
          f"({syn.get('n_fraud', '?')} fraud / {syn.get('n_legit', '?')} legit), is_synthetic=true")
    if prov.get("elliptic"):
        print(f"   Real-world     : Elliptic benchmark model included "
              f"({prov['elliptic']['n_transactions']} txs) — separate, never mixed")
    print(f"   Split          : {manifest['split']['method']}")

    print(f"\n[API] The API loads these artifacts automatically when "
          f"ML_MODEL_PATH={out_dir.resolve()} (default: ml/artifacts).")
    print("\n" + "=" * 72)
    if gate:
        print("MODEL READY - restart the API (`pnpm dev:api`) and risk scoring will use it.")
    else:
        print("WARNING: Model did NOT pass gates - production deployment is blocked (condition 5.7).")
        print("  Retrain with more data or tune, or export with --force for demo purposes only.")
    print("=" * 72)


def main() -> int:
    ap = argparse.ArgumentParser(description="Check deps, install if needed, train, success report")
    ap.add_argument("--n-wallets", type=int, default=4000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=str(ML_DIR / "artifacts"))
    ap.add_argument("--with-elliptic", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--skip-install", action="store_true", help="fail instead of installing")
    args = ap.parse_args()

    check_python()

    print("[CHECK] Checking Python dependencies...")
    missing = missing_dependencies()
    if missing:
        if args.skip_install:
            print(f"[ERROR] Missing: {', '.join(missing)} (--skip-install set; run "
                  f"`pip install -r ml/requirements.txt` manually)")
            return 2
        if not install_dependencies(missing):
            return 2
        # re-check
        still = missing_dependencies()
        if still:
            print(f"[ERROR] Still missing after install: {still}")
            return 2
        print("[OK] Dependencies installed.")
    else:
        print("[OK] All dependencies present.")

    res = run_training(args)
    out_dir = Path(args.out)
    print_success_report(out_dir, res.returncode, args.force)

    if res.returncode != 0:
        return 1
    gate = False
    metrics_path = out_dir / "metrics.json"
    if metrics_path.exists():
        gate = json.loads(metrics_path.read_text(encoding="utf-8")).get("gate_passed", False)
    if not gate and not args.force:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())