# -*- coding: utf-8 -*-
"""Leakage-safe dataset splitting.

RULES.md §5 / for-implementation/conditions.md 5.6:
  * Split by wallet/case/time — never random-row splits.
  * Reject a split if the same wallet appears in more than one partition.
  * Time ordering must hold: no training sample is newer than any test sample.

All three partitions are grouped by case_id (a case may contain several
wallets — e.g. suspect + intermediaries — and must stay together).
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple


class LeakageError(ValueError):
    """Raised when a proposed split would leak information across partitions."""


def leakage_safe_split(
    rows: List[Dict[str, Any]],
    time_col: str = "first_seen",
    case_col: str = "case_id",
    wallet_col: str = "wallet_id",
    train_frac: float = 0.7,
    val_frac: float = 0.15,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Chronological split by case.

    Cases are ordered by their earliest `time_col` value; the first
    train_frac of cases go to train, the next val_frac to validation, the
    remainder to test. Raises LeakageError if a wallet or case appears in
    more than one partition, or if time ordering is violated.
    """
    if not (0.0 < train_frac < 1.0 and 0.0 < val_frac < 1.0 and train_frac + val_frac < 1.0):
        raise ValueError("train_frac/val_frac must be in (0,1) and sum to < 1")

    cases: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        case_id = r.get(case_col)
        if case_id not in cases:
            cases[case_id] = {"earliest": float(r.get(time_col, 0.0)), "rows": [], "wallets": set()}
        cases[case_id]["earliest"] = min(cases[case_id]["earliest"], float(r.get(time_col, 0.0)))
        cases[case_id]["rows"].append(r)
        cases[case_id]["wallets"].add(r.get(wallet_col))

    ordered = sorted(cases.values(), key=lambda c: c["earliest"])
    n = len(ordered)
    n_train = max(int(n * train_frac), 1)
    n_val = max(int(n * val_frac), 1)
    if n_train + n_val >= n:
        raise ValueError("not enough cases for train/val/test split")

    train_cases = ordered[:n_train]
    val_cases = ordered[n_train:n_train + n_val]
    test_cases = ordered[n_train + n_val:]

    train: List[Dict[str, Any]] = []
    val: List[Dict[str, Any]] = []
    test: List[Dict[str, Any]] = []
    for part, dest in ((train_cases, train), (val_cases, val), (test_cases, test)):
        for c in part:
            dest.extend(c["rows"])

    _verify(rows, train, val, test, time_col, case_col, wallet_col)
    return train, val, test


def _verify(
    all_rows: List[Dict[str, Any]],
    train: List[Dict[str, Any]],
    val: List[Dict[str, Any]],
    test: List[Dict[str, Any]],
    time_col: str,
    case_col: str,
    wallet_col: str,
) -> None:
    def wallet_set(part: List[Dict[str, Any]]) -> set:
        return {r[wallet_col] for r in part}

    def case_set(part: List[Dict[str, Any]]) -> set:
        return {r[case_col] for r in part}

    w_train, w_val, w_test = wallet_set(train), wallet_set(val), wallet_set(test)
    if w_train & w_val or w_train & w_test or w_val & w_test:
        raise LeakageError("same wallet_id appears in more than one partition")

    c_train, c_val, c_test = case_set(train), case_set(val), case_set(test)
    if c_train & c_val or c_train & c_test or c_val & c_test:
        raise LeakageError("same case_id appears in more than one partition")

    if len(w_train) + len(w_val) + len(w_test) != len({r[wallet_col] for r in all_rows}):
        raise LeakageError("partition wallet counts do not add up")

    # time ordering at case granularity: the earliest sample of every case in
    # train must predate the earliest sample of every case in val/test, etc.
    def case_earliest(part: List[Dict[str, Any]]) -> Dict[str, float]:
        out: Dict[str, float] = {}
        for r in part:
            cid = r[case_col]
            out[cid] = min(out.get(cid, float("inf")), float(r[time_col]))
        return out

    def max_earliest(part: List[Dict[str, Any]]) -> float:
        vals = list(case_earliest(part).values())
        return max(vals) if vals else 0.0

    def min_earliest(part: List[Dict[str, Any]]) -> float:
        vals = list(case_earliest(part).values())
        return min(vals) if vals else float("inf")

    if train and val and max_earliest(train) > min_earliest(val):
        raise LeakageError("time leakage: training cases are newer than validation cases")
    if val and test and max_earliest(val) > min_earliest(test):
        raise LeakageError("time leakage: validation cases are newer than test cases")