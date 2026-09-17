# -*- coding: utf-8 -*-
"""Leakage-safe split tests (for-implementation/conditions.md 5.6)."""

import pytest

from split import LeakageError, leakage_safe_split


def _rows(n_cases, wallets_per_case=1, base_time=1_700_000_000):
    rows = []
    i = 0
    for c in range(n_cases):
        for w in range(wallets_per_case):
            rows.append({
                "wallet_id": f"w{c}-{w}",
                "case_id": f"case{c}",
                "first_seen": base_time + c * 86400,
            })
            i += 1
    return rows


def test_no_wallet_overlap():
    rows = _rows(20, wallets_per_case=2)
    train, val, test = leakage_safe_split(rows)
    all_ids = [r["wallet_id"] for r in rows]
    assert len(train) + len(val) + len(test) == len(all_ids)
    w_train = {r["wallet_id"] for r in train}
    w_val = {r["wallet_id"] for r in val}
    w_test = {r["wallet_id"] for r in test}
    assert not (w_train & w_val or w_train & w_test or w_val & w_test)


def test_time_ordering():
    rows = _rows(30)
    train, val, test = leakage_safe_split(rows)
    assert max(r["first_seen"] for r in train) <= min(r["first_seen"] for r in val)
    assert max(r["first_seen"] for r in val) <= min(r["first_seen"] for r in test)


def test_case_grouping_kept():
    rows = _rows(20, wallets_per_case=3)
    train, val, test = leakage_safe_split(rows)
    c_train = {r["case_id"] for r in train}
    c_val = {r["case_id"] for r in val}
    c_test = {r["case_id"] for r in test}
    assert not (c_train & c_val or c_train & c_test or c_val & c_test)


def test_leakage_detected_same_wallet_two_cases():
    rows = _rows(12)
    # duplicate wallet w0-0 into the last case -> must be caught
    rows.append({"wallet_id": "w0-0", "case_id": "case11", "first_seen": rows[-1]["first_seen"] + 86400})
    with pytest.raises(LeakageError):
        leakage_safe_split(rows)


def test_invalid_fractions():
    rows = _rows(10)
    with pytest.raises(ValueError):
        leakage_safe_split(rows, train_frac=0.5, val_frac=0.6)