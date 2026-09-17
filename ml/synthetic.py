# -*- coding: utf-8 -*-
"""Deterministic synthetic wallet dataset generator.

Produces labeled wallet samples (fraud flow patterns vs legitimate behavior).
Every sample is tagged `is_synthetic: true` and carries wallet_id / case_id /
first_seen so training splits can be performed by wallet/case/time without
leakage (RULES.md §5, for-implementation/conditions.md 5.6).

Synthetic patterns mirror the fraud typologies in prompt.md Task 2 Stage 10
and for-implementation/prompt.md §10: rapid forwarding, peel chains, fan-out,
fan-in, split/merge, mixer entry, bridge use, exchange cash-out, multi-victim.
"""

from __future__ import annotations

import hashlib
import random
from typing import Any, Dict, List, Tuple

# Known-entity address space used both by the generator and by runtime context.
VASP_ADDRESSES = [
    "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0",  # WazirX hot wallet
    "0x28C6c06298d514Db089934071355E5743bf21d60",  # Binance hot wallet
]
MIXER_ADDRESSES = [
    "0x7222577874756158bd95558ce9ed23bb24c38d4",  # Tornado Cash
]
BRIDGE_ADDRESSES = [
    "0x48c92b1688c096d1072c5a43c07d0a23c6b52616",  # THORChain bridge
]
SANCTIONED_ADDRESSES = [
    "0x1a4c31d54f0d2a3b6e8f9c0d1e2f3a4b5c6d7e8f",  # OFAC-listed sample
]

FRAUD_PATTERNS = [
    "rapid_forwarding", "peel_chain", "fan_out", "fan_in", "split_merge",
    "mixer_entry", "bridge_hop", "exchange_cashout", "multi_victim", "direct_theft",
]
LEGIT_PATTERNS = [
    "salary_income", "shopping", "savings", "exchange_user", "p2p_transfers",
]

_TS0 = 1_750_000_000  # ~2025-06-15 UTC; stable epoch for determinism


def _addr(i: int) -> str:
    return "0x" + hashlib.sha256(f"addr:{i}".encode()).hexdigest()[:40]


def _tx_hash(i: int) -> str:
    return "0x" + hashlib.sha256(f"tx:{i}".encode()).hexdigest()[:64]


class WalletBuilder:
    """Builds a wallet's transactions with tagged counterparty kinds."""

    def __init__(self, rng: random.Random, wallet_id: str, first_seen: float):
        self.rng = rng
        self.wallet_id = wallet_id
        self.first_seen = first_seen
        self.txs: List[Dict[str, Any]] = []
        self._n = 0

    def _tx(self, frm: str, to: str, amount: float, ts: float, chain: str = "ETH",
            kind: str = "normal") -> None:
        self._n += 1
        self.txs.append({
            "tx_id": _tx_hash(hash(self.wallet_id) + self._n),
            "from": frm,
            "to": to,
            "amount": amount,
            "timestamp": ts,
            "chain": chain,
            "kind": kind,
        })

    def receive(self, amount: float, ts: float, sender: str = None, chain: str = "ETH") -> str:
        sender = sender or _addr(self.rng.randint(0, 10_000_000))
        self._tx(sender, self.wallet_id, amount, ts, chain, "normal")
        return sender

    def send(self, amount: float, ts: float, receiver: str = None, chain: str = "ETH",
             kind: str = "normal") -> str:
        receiver = receiver or _addr(self.rng.randint(0, 10_000_000))
        self._tx(self.wallet_id, receiver, amount, ts, chain, kind)
        return receiver

    def send_vasp(self, amount: float, ts: float) -> str:
        return self.send(amount, ts, self.rng.choice(VASP_ADDRESSES), kind="vasp")

    def send_mixer(self, amount: float, ts: float) -> str:
        return self.send(amount, ts, MIXER_ADDRESSES[0], kind="mixer")

    def send_bridge(self, amount: float, ts: float) -> str:
        return self.send(amount, ts, BRIDGE_ADDRESSES[0], kind="bridge", chain="ETH")


def _fraud_wallet(rng: random.Random, wallet_id: str, case_id: str,
                  pattern: str, first_seen: float) -> Dict[str, Any]:
    w = WalletBuilder(rng, wallet_id, first_seen)
    day = 86400.0
    # Fraud wallets are usually (but not always) young; ages overlap with
    # legit wallets so wallet_age_days stays informative, not deterministic.
    now = first_seen + rng.randint(1, 120) * day
    reported_amount = rng.choice([5000, 10000, 25000, 50000, 100000])
    hop = rng.randint(1, 3)

    if pattern == "rapid_forwarding":
        # receive then forward through 4 intermediaries within minutes
        amt = reported_amount
        ts = now - 6 * 3600
        w.receive(amt, ts)
        for i in range(4):
            ts += rng.randint(60, 300)
            amt = round(amt * rng.uniform(0.9, 1.0), 2)
            w.send(amt, ts)
        w.send_vasp(amt * 0.95, ts + rng.randint(60, 240))
    elif pattern == "peel_chain":
        amt = reported_amount
        ts = now - 8 * 3600
        w.receive(amt, ts)
        parts = rng.randint(5, 9)
        for i in range(parts):
            ts += rng.randint(120, 900)
            w.send(round(amt / parts * rng.uniform(0.9, 1.1), 2), ts)
    elif pattern == "fan_out":
        amt = reported_amount
        ts = now - 5 * 3600
        w.receive(amt, ts)
        for i in range(rng.randint(3, 6)):
            ts += rng.randint(30, 300)
            w.send(round(amt / (i + 2), 2), ts)
        w.send_vasp(amt * 0.4, ts + 600)
    elif pattern == "fan_in":
        ts = now - 4 * 3600
        for i in range(rng.randint(3, 6)):
            ts += rng.randint(60, 600)
            w.receive(round(reported_amount / (i + 2), 2), ts)
        w.send(round(reported_amount * 0.8, 2), ts + rng.randint(60, 300))
        w.send_vasp(round(reported_amount * 0.5, 2), ts + 1200)
    elif pattern == "split_merge":
        ts = now - 7 * 3600
        w.receive(reported_amount, ts)
        a = w.send(round(reported_amount * 0.6, 2), ts + 600)
        b = w.send(round(reported_amount * 0.3, 2), ts + 900)
        w.receive(round(reported_amount * 0.9, 2), ts + 1800)
        w.send(round(reported_amount * 0.85, 2), ts + 2400)
        w.send_vasp(round(reported_amount * 0.7, 2), ts + 3000)
    elif pattern == "mixer_entry":
        ts = now - 3 * 3600
        w.receive(reported_amount, ts)
        w.send_mixer(reported_amount * 0.97, ts + rng.randint(300, 900))
        w.send_vasp(reported_amount * 0.3, ts + 3600)
    elif pattern == "bridge_hop":
        ts = now - 9 * 3600
        w.receive(reported_amount, ts)
        w.send_bridge(reported_amount * 0.95, ts + rng.randint(600, 1800))
        w.send_vasp(reported_amount * 0.5, ts + 7200)
    elif pattern == "exchange_cashout":
        ts = now - 2 * 3600
        w.receive(reported_amount, ts)
        w.send_vasp(reported_amount * 0.99, ts + rng.randint(300, 1200))
        w.send_vasp(reported_amount * 0.2, ts + 2400)
    elif pattern == "multi_victim":
        ts = now - 10 * 3600
        for i in range(rng.randint(3, 7)):
            ts += rng.randint(600, 3600)
            w.receive(round(reported_amount / (i + 1), 2), ts)
        w.send_vasp(round(reported_amount * 0.6, 2), ts + 600)
    else:  # direct_theft
        ts = now - 3600
        w.receive(reported_amount, ts)
        w.send(round(reported_amount * 0.95, 2), ts + rng.randint(120, 900))
        w.send_vasp(round(reported_amount * 0.6, 2), ts + 1800)

    # Realistic noise: 1-2 small unrelated transfers that do not fit the
    # pattern, so no single feature perfectly separates fraud from legit.
    for _ in range(rng.randint(1, 2)):
        amt = round(rng.uniform(50, 400), 2)
        ts = now + rng.randint(1, 3) * 3600
        w.receive(amt, ts)
        w.send(round(amt * rng.uniform(0.7, 1.0), 2), ts + rng.randint(600, 3600))

    return {
        "wallet_id": wallet_id,
        "case_id": case_id,
        "label": 1,
        "pattern": pattern,
        "is_synthetic": True,
        "first_seen": first_seen,
        "reported_amount": reported_amount,
        "txs": w.txs,
    }


def _legit_wallet(rng: random.Random, wallet_id: str, first_seen: float) -> Dict[str, Any]:
    w = WalletBuilder(rng, wallet_id, first_seen)
    day = 86400.0
    now = first_seen + rng.randint(30, 200) * day
    pattern = rng.choice(LEGIT_PATTERNS)

    if pattern == "salary_income":
        for m in range(6):
            ts = first_seen + m * 30 * day
            w.receive(rng.choice([1500, 2000, 2500]), ts)
            w.send(round(rng.uniform(300, 800), 2), ts + rng.randint(2, 10) * day)
    elif pattern == "shopping":
        ts = first_seen + 5 * day
        w.receive(5000, ts)
        for i in range(20):
            ts += rng.randint(1, 3) * day
            w.send(round(rng.uniform(20, 150), 2), ts)
    elif pattern == "savings":
        ts = first_seen + 3 * day
        w.receive(20000, ts)
        for i in range(4):
            ts += 20 * day
            w.send(round(rng.uniform(50, 300), 2), ts)
    elif pattern == "exchange_user":
        ts = first_seen + 2 * day
        w.receive(8000, ts)
        w.send_vasp(round(rng.uniform(500, 1500), 2), ts + 3 * day)
        w.receive(2000, ts + 10 * day)
        w.send_vasp(round(rng.uniform(100, 400), 2), ts + 12 * day)
    else:  # p2p_transfers
        buddy = _addr(rng.randint(0, 1000))
        ts = first_seen + day
        for i in range(12):
            ts += rng.randint(5, 20) * day
            if i % 2 == 0:
                w.receive(round(rng.uniform(50, 500), 2), ts, sender=buddy)
            else:
                w.send(round(rng.uniform(50, 500), 2), ts, receiver=buddy)

    # Noise tx: occasional rapid forward so legit wallets are not perfect.
    if rng.random() < 0.25:
        amt = round(rng.uniform(100, 600), 2)
        ts = now - 3600
        w.receive(amt, ts)
        w.send(round(amt * 0.9, 2), ts + rng.randint(120, 900))

    return {
        "wallet_id": wallet_id,
        "case_id": f"LEGIT-{wallet_id}",
        "label": 0,
        "pattern": pattern,
        "is_synthetic": True,
        "first_seen": first_seen,
        "reported_amount": None,
        "txs": w.txs,
    }


def generate_dataset(n_wallets: int = 4000, seed: int = 42, fraud_ratio: float = 0.35) -> List[Dict[str, Any]]:
    """Generate a deterministic synthetic dataset.

    Wallets are ordered by `first_seen` (time-ordered) so downstream
    train/val/test splits can be done chronologically without leakage.
    """
    rng = random.Random(seed)
    samples: List[Dict[str, Any]] = []
    n_fraud = int(n_wallets * fraud_ratio)

    # Fraud cases and legit wallets are interleaved over the same 240-day
    # window so any chronological split stays representative. One base time
    # is drawn per case; all wallets of that case appear within a few days
    # of it (temporally coherent). Legit wallets each get their own case.
    n_fraud_cases = (n_fraud + 2) // 3
    for c in range(n_fraud_cases):
        case_id = f"syn-case-{c}"
        case_base = _TS0 + rng.randint(0, 240) * 86400
        for w in range(3):
            i = c * 3 + w
            if i >= n_fraud:
                break
            wallet_id = f"syn-wallet-{i}"
            first_seen = case_base + rng.randint(-2, 2) * 86400
            pattern = FRAUD_PATTERNS[i % len(FRAUD_PATTERNS)]
            sample = _fraud_wallet(rng, wallet_id, case_id, pattern, first_seen)
            # distance_from_report overlaps between classes so it stays a
            # graph feature, not a label in disguise: 40% of fraud wallets are
            # the reported suspect (distance 0), the rest are intermediaries.
            sample["distance_from_report"] = 0.0 if rng.random() < 0.4 else float(rng.randint(1, 3))
            samples.append(sample)

    for i in range(n_fraud, n_wallets):
        wallet_id = f"syn-wallet-{i}"
        first_seen = _TS0 + rng.randint(0, 240) * 86400
        sample = _legit_wallet(rng, wallet_id, first_seen)
        # Legit wallets can also appear inside investigation graphs (merchants,
        # exchanges) at some hop distance, so their distance is not always 0.
        sample["distance_from_report"] = 0.0 if rng.random() < 0.6 else float(rng.randint(1, 2))
        samples.append(sample)

    samples.sort(key=lambda s: s["first_seen"])
    return samples


def samples_to_rows(samples: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Flatten wallet samples into feature rows (one row per wallet)."""
    from features import extract_wallet_features, FEATURE_NAMES  # local import to avoid cycles

    rows: List[Dict[str, Any]] = []
    for s in samples:
        feats = extract_wallet_features(
            s["txs"],
            wallet_address=s["wallet_id"],
            first_seen=s["first_seen"],
            distance_from_report=s["distance_from_report"],
        )
        row = {"wallet_id": s["wallet_id"], "case_id": s["case_id"], "label": s["label"],
               "pattern": s["pattern"], "is_synthetic": s["is_synthetic"],
               "first_seen": s["first_seen"]}
        row.update({n: feats[n] for n in FEATURE_NAMES})
        rows.append(row)
    return rows