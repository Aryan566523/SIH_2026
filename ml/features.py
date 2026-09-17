# -*- coding: utf-8 -*-
"""Shared feature specification and wallet-level feature extraction.

This module is the single source of truth for the 25 model features.
The Node.js runtime mirrors this extraction in
apps/api/src/modules/risk/ml-model.ts and is validated against golden
vectors produced at training time (see train.py / golden_vectors.json).

RULES.md §5 / for-implementation/scope.md §2.7:
  - interpretable features only
  - transaction / behavior / graph / flow-time groups
  - wallet-level (never per-row), so splits by wallet are meaningful
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

# ---------------------------------------------------------------------------
# Feature catalog
# ---------------------------------------------------------------------------

FEATURE_DEFS: List[Dict[str, str]] = [
    # --- transaction group ---
    {"name": "tx_count", "group": "transaction", "desc": "Total number of transactions"},
    {"name": "log_amount_received_total", "group": "transaction", "desc": "log10(1 + total amount received)"},
    {"name": "log_amount_sent_total", "group": "transaction", "desc": "log10(1 + total amount sent)"},
    {"name": "unique_senders", "group": "transaction", "desc": "Unique counterparties that sent funds"},
    {"name": "unique_receivers", "group": "transaction", "desc": "Unique counterparties that received funds"},
    {"name": "log_max_amount", "group": "transaction", "desc": "log10(1 + largest single transaction)"},
    # --- behavior group ---
    {"name": "avg_holding_min", "group": "behavior", "desc": "log10(1 + mean receive->send gap in minutes)"},
    {"name": "median_holding_min", "group": "behavior", "desc": "log10(1 + median receive->send gap in minutes)"},
    {"name": "forwarding_ratio", "group": "behavior", "desc": "total sent / total received (clipped 0..100)"},
    {"name": "activity_frequency", "group": "behavior", "desc": "transactions per active day"},
    {"name": "fan_in_ratio", "group": "behavior", "desc": "unique senders / received count"},
    {"name": "fan_out_ratio", "group": "behavior", "desc": "unique receivers / sent count"},
    {"name": "velocity_24h", "group": "behavior", "desc": "max tx in any 24h window / total tx"},
    # --- graph / entity group ---
    {"name": "vasp_proximity", "group": "graph", "desc": "1 if a direct counterparty is a known VASP, else 3 (clipped)"},
    {"name": "mixer_interaction", "group": "graph", "desc": "1 if any counterparty is a known mixer"},
    {"name": "bridge_interaction", "group": "graph", "desc": "1 if any counterparty is a known bridge contract"},
    {"name": "sanctioned_match", "group": "graph", "desc": "1 if wallet or counterparty matches a sanctioned list"},
    {"name": "distance_from_report", "group": "graph", "desc": "hop distance from the reported suspect wallet (0 = suspect)"},
    # --- flow / time group ---
    {"name": "rapid_forwarding_count", "group": "flow", "desc": "receive->send events within 30 minutes"},
    {"name": "fund_split_count", "group": "flow", "desc": "fan-out events (3+ unique receivers in 10 min)"},
    {"name": "fund_merge_count", "group": "flow", "desc": "fan-in events (3+ unique senders in 10 min)"},
    {"name": "min_receive_send_gap_min", "group": "flow", "desc": "log10(1 + minimum receive->send gap in minutes)"},
    {"name": "cross_chain_count", "group": "flow", "desc": "transactions touching more than one chain"},
    {"name": "wallet_age_days", "group": "flow", "desc": "log10(1 + days between first seen and assessment)"},
    {"name": "amount_concentration", "group": "flow", "desc": "max amount / (median amount + 1) — peel-chain signal"},
]

FEATURE_NAMES: List[str] = [f["name"] for f in FEATURE_DEFS]

# ---------------------------------------------------------------------------
# Entity context passed at extraction time (optional at inference)
# ---------------------------------------------------------------------------


@dataclass
class EntityContext:
    vasp_addresses: frozenset = frozenset()
    mixer_addresses: frozenset = frozenset()
    bridge_addresses: frozenset = frozenset()
    sanctioned_addresses: frozenset = frozenset()


EMPTY_CONTEXT = EntityContext()

# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------


def _log10_plus_one(x: float) -> float:
    return math.log10(max(x, 0.0) + 1.0)


def extract_wallet_features(
    txs: Sequence[Dict[str, Any]],
    *,
    wallet_address: Optional[str] = None,
    first_seen: Optional[float] = None,
    distance_from_report: float = 0.0,
    context: EntityContext = EMPTY_CONTEXT,
    now_ts: Optional[float] = None,
) -> Dict[str, float]:
    """Compute the 25 wallet-level features from a wallet's transactions.

    txs: list of dicts with keys: from, to, amount (float), timestamp (epoch
    seconds), chain (str, optional). Counterparty classification uses the
    'kind' key when present (synthetic data) and falls back to address sets
    from `context`.
    """
    if now_ts is None:
        now_ts = max((float(t.get("timestamp", 0)) for t in txs), default=0.0)

    received: List[Tuple[float, str, float]] = []  # (amount, sender, ts)
    sent: List[Tuple[float, str, float]] = []      # (amount, receiver, ts)
    all_ts: List[float] = []
    counterparties: set = set()
    counterparty_kinds: Dict[str, int] = {}
    chains: set = set()
    max_amount = 0.0
    amount_received_total = 0.0
    amount_sent_total = 0.0

    for tx in txs:
        try:
            amount = float(tx.get("amount", 0.0) or 0.0)
        except (TypeError, ValueError):
            amount = 0.0
        ts = float(tx.get("timestamp", 0.0) or 0.0)
        chain = str(tx.get("chain", "") or "")
        frm = str(tx.get("from", "") or "")
        to = str(tx.get("to", "") or "")
        kind = str(tx.get("kind", "") or "")
        all_ts.append(ts)
        if chain:
            chains.add(chain)

        def classify(addr: str, fallback_kind: str) -> str:
            if kind:
                return kind
            if addr in context.vasp_addresses:
                return "vasp"
            if addr in context.mixer_addresses:
                return "mixer"
            if addr in context.bridge_addresses:
                return "bridge"
            if addr in context.sanctioned_addresses:
                return "sanctioned"
            return fallback_kind

        if wallet_address is not None and frm == wallet_address:
            sent.append((amount, to, ts))
            if to:
                counterparties.add(to)
                counterparty_kinds[to] = classify(to, "normal")
        elif wallet_address is not None and to == wallet_address:
            received.append((amount, frm, ts))
            if frm:
                counterparties.add(frm)
                counterparty_kinds[frm] = classify(frm, "normal")
        elif wallet_address is None:
            # Unattributed mode: treat 'to' as self (used by synthetic builder parity checks)
            received.append((amount, frm, ts))
            sent.append((amount, to, ts))
            if frm:
                counterparties.add(frm)
            if to:
                counterparties.add(to)

        max_amount = max(max_amount, amount)
        if wallet_address is not None and frm == wallet_address:
            amount_sent_total += amount
        elif wallet_address is not None and to == wallet_address:
            amount_received_total += amount
        else:
            amount_received_total += amount
            amount_sent_total += amount

    tx_count = len(txs)
    unique_senders = len({s for _, s, _ in received})
    unique_receivers = len({r for _, r, _ in sent})

    # holding times: for each received tx, find first send after it
    holding: List[float] = []
    for amt, sender, rts in received:
        for s_amt, recv, sts in sent:
            if sts > rts:
                holding.append((sts - rts) / 60.0)
                break
    avg_hold = sum(holding) / len(holding) if holding else 0.0
    median_hold = sorted(holding)[len(holding) // 2] if holding else 0.0

    # rapid forwarding: receive then send within 30 min
    rapid = 0
    min_gap: Optional[float] = None
    for amt, sender, rts in received:
        for s_amt, recv, sts in sent:
            if sts > rts:
                gap = (sts - rts) / 60.0
                if gap <= 30.0:
                    rapid += 1
                min_gap = gap if min_gap is None else min(min_gap, gap)
                break

    # fan-in / fan-out events (3+ unique counterparties within 10 min)
    def _fan_events(rows: List[Tuple[float, str, float]], window_min: float) -> int:
        events = 0
        rows_sorted = sorted(rows, key=lambda r: r[2])
        for i in range(len(rows_sorted)):
            window = [r for r in rows_sorted if 0 <= (r[2] - rows_sorted[i][2]) / 60.0 <= window_min]
            if len({r[1] for r in window}) >= 3:
                events += 1
        return events

    split_count = _fan_events(sent, 10.0)
    merge_count = _fan_events(received, 10.0)

    # velocity: max tx count in any 24h window
    velocity = 0.0
    if all_ts:
        ts_sorted = sorted(all_ts)
        j = 0
        for i in range(len(ts_sorted)):
            while ts_sorted[i] - ts_sorted[j] > 86400:
                j += 1
            velocity = max(velocity, i - j + 1)
        velocity = velocity / tx_count if tx_count else 0.0

    # counterparty entity flags (kind strings from tx tags or address sets)
    any_vasp = any(k == "vasp" for k in counterparty_kinds.values()) or any(
        c in context.vasp_addresses for c in counterparties
    )
    any_mixer = any(k == "mixer" for k in counterparty_kinds.values()) or any(
        c in context.mixer_addresses for c in counterparties
    )
    any_bridge = any(k == "bridge" for k in counterparty_kinds.values()) or any(
        c in context.bridge_addresses for c in counterparties
    )
    sanctioned = any(
        k == "sanctioned" for k in counterparty_kinds.values()
    ) or any(c in context.sanctioned_addresses for c in counterparties)

    # activity span
    span_days = 1.0
    if len(all_ts) >= 2:
        span_days = max((max(all_ts) - min(all_ts)) / 86400.0, 1.0)

    age_days = 1.0
    if first_seen is not None:
        age_days = max((now_ts - first_seen) / 86400.0, 1.0)

    amounts = [a for a, _, _ in received] + [a for a, _, _ in sent]
    median_amount = sorted(amounts)[len(amounts) // 2] if amounts else 0.0

    return {
        "tx_count": float(tx_count),
        "log_amount_received_total": _log10_plus_one(amount_received_total),
        "log_amount_sent_total": _log10_plus_one(amount_sent_total),
        "unique_senders": float(unique_senders),
        "unique_receivers": float(unique_receivers),
        "log_max_amount": _log10_plus_one(max_amount),
        "avg_holding_min": _log10_plus_one(avg_hold),
        "median_holding_min": _log10_plus_one(median_hold),
        "forwarding_ratio": min(amount_sent_total / amount_received_total if amount_received_total > 0 else 0.0, 100.0),
        "activity_frequency": float(tx_count / span_days),
        "fan_in_ratio": float(unique_senders / len(received) if received else 0.0),
        "fan_out_ratio": float(unique_receivers / len(sent) if sent else 0.0),
        "velocity_24h": float(velocity),
        "vasp_proximity": 1.0 if any_vasp else 3.0,
        "mixer_interaction": 1.0 if any_mixer else 0.0,
        "bridge_interaction": 1.0 if any_bridge else 0.0,
        "sanctioned_match": 1.0 if sanctioned else 0.0,
        "distance_from_report": float(distance_from_report),
        "rapid_forwarding_count": float(rapid),
        "fund_split_count": float(split_count),
        "fund_merge_count": float(merge_count),
        "min_receive_send_gap_min": _log10_plus_one(min_gap if min_gap is not None else 0.0),
        "cross_chain_count": float(max(len(chains) - 1, 0)),
        "wallet_age_days": _log10_plus_one(age_days),
        "amount_concentration": float(max_amount / (median_amount + 1.0)),
    }


def feature_vector(txs: Sequence[Dict[str, Any]], **kw: Any) -> List[float]:
    feats = extract_wallet_features(txs, **kw)
    return [feats[n] for n in FEATURE_NAMES]