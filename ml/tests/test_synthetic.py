# -*- coding: utf-8 -*-
"""Synthetic dataset tests — determinism, labeling, leakage-safe structure."""

from synthetic import FRAUD_PATTERNS, LEGIT_PATTERNS, generate_dataset, samples_to_rows


def test_deterministic_same_seed():
    a = generate_dataset(n_wallets=200, seed=7)
    b = generate_dataset(n_wallets=200, seed=7)
    assert a == b


def test_deterministic_different_seed():
    a = generate_dataset(n_wallets=200, seed=7)
    b = generate_dataset(n_wallets=200, seed=8)
    assert a != b


def test_all_samples_labeled_synthetic():
    samples = generate_dataset(n_wallets=300, seed=1)
    assert all(s["is_synthetic"] is True for s in samples)
    assert all(s["label"] in (0, 1) for s in samples)
    assert all(s["wallet_id"] for s in samples)
    assert all(s["case_id"] for s in samples)


def test_fraud_ratio():
    samples = generate_dataset(n_wallets=1000, seed=3)
    fraud = sum(1 for s in samples if s["label"] == 1)
    assert 0.30 <= fraud / 1000 <= 0.40


def test_time_ordered():
    samples = generate_dataset(n_wallets=500, seed=5)
    times = [s["first_seen"] for s in samples]
    assert times == sorted(times)


def test_all_patterns_covered():
    samples = generate_dataset(n_wallets=2000, seed=9)
    patterns = {s["pattern"] for s in samples}
    assert set(FRAUD_PATTERNS) <= patterns
    assert set(LEGIT_PATTERNS) <= patterns


def test_rows_have_all_features():
    samples = generate_dataset(n_wallets=120, seed=11)
    rows = samples_to_rows(samples)
    assert len(rows) == 120
    from features import FEATURE_NAMES
    for r in rows:
        for n in FEATURE_NAMES:
            assert n in r, f"missing feature {n}"
        assert r["is_synthetic"] is True