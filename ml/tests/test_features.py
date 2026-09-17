# -*- coding: utf-8 -*-
"""Feature extraction tests (RULES.md §5 — interpretable, deterministic)."""

import math

import pytest

from features import EMPTY_CONTEXT, FEATURE_NAMES, extract_wallet_features, feature_vector

T0 = 1_750_000_000.0


def _tx(frm, to, amount, ts, chain="ETH", kind="normal"):
    return {"from": frm, "to": to, "amount": amount, "timestamp": ts, "chain": chain, "kind": kind}


def test_feature_count_and_names():
    assert len(FEATURE_NAMES) == 25
    assert len(set(FEATURE_NAMES)) == 25


def test_crafted_wallet_values():
    # receive 100 at t0, send 50 at t0+10min, send 50 at t0+20min
    txs = [
        _tx("0xsender", "0xwallet", 100.0, T0),
        _tx("0xwallet", "0xrecv1", 50.0, T0 + 600),
        _tx("0xwallet", "0xrecv2", 50.0, T0 + 1200),
    ]
    f = extract_wallet_features(txs, wallet_address="0xwallet", first_seen=T0 - 86400)
    assert f["tx_count"] == 3
    assert f["unique_senders"] == 1
    assert f["unique_receivers"] == 2
    assert f["rapid_forwarding_count"] == 1
    assert f["forwarding_ratio"] == pytest.approx(1.0)
    assert f["log_amount_received_total"] == pytest.approx(math.log10(101))
    assert f["log_amount_sent_total"] == pytest.approx(math.log10(101))
    assert f["log_max_amount"] == pytest.approx(math.log10(101))
    assert f["min_receive_send_gap_min"] == pytest.approx(math.log10(11))
    assert f["amount_concentration"] == pytest.approx(100.0 / 51.0)
    # age = now(ts of latest tx = T0+1200) - first_seen(T0-86400) = 87600s = 1.0139 days
    assert f["wallet_age_days"] == pytest.approx(math.log10(1.0 + 87600.0 / 86400.0))
    assert f["vasp_proximity"] == 3.0  # no VASP counterparty
    assert f["mixer_interaction"] == 0.0


def test_entity_context_flags():
    txs = [
        _tx("0xsender", "0xwallet", 5000.0, T0),
        _tx("0xwallet", "0x7222577874756158bd95558ce9ed23bb24c38d4", 4900.0, T0 + 300, kind="mixer"),
    ]
    f = extract_wallet_features(txs, wallet_address="0xwallet", first_seen=T0 - 86400)
    assert f["mixer_interaction"] == 1.0
    assert f["vasp_proximity"] == 3.0


def test_deterministic():
    txs = [_tx("a", "w", 10, T0), _tx("w", "b", 9, T0 + 60)]
    a = extract_wallet_features(txs, wallet_address="w", first_seen=T0)
    b = extract_wallet_features(txs, wallet_address="w", first_seen=T0)
    assert a == b
    assert len(feature_vector(txs, wallet_address="w", first_seen=T0)) == 25


def test_empty_wallet():
    f = extract_wallet_features([], wallet_address="w", first_seen=T0, now_ts=T0)
    assert f["tx_count"] == 0
    assert f["forwarding_ratio"] == 0.0
    assert all(math.isfinite(v) for v in f.values())


def test_context_address_sets():
    txs = [_tx("0xsender", "w", 100, T0), _tx("w", "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0", 90, T0 + 60)]
    f = extract_wallet_features(txs, wallet_address="w", first_seen=T0,
                                context=EMPTY_CONTEXT)
    assert f["vasp_proximity"] == 3.0  # no context supplied -> not known