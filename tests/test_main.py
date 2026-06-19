"""Basic smoke tests for main.py helper functions.

These tests validate utility functions without requiring the full
Whisper model or external services.
"""
import json
import os
import tempfile

import pytest


def test_load_config_returns_defaults(tmp_path, monkeypatch):
    """_load_config should return defaults when no config file exists."""
    monkeypatch.chdir(tmp_path)
    from main import _load_config, DEFAULTS

    config = _load_config()
    assert config["model"] == DEFAULTS["model"]
    assert config["device"] == DEFAULTS["device"]
    assert config["compute_type"] == DEFAULTS["compute_type"]


def test_save_and_load_config_roundtrip(tmp_path, monkeypatch):
    """Saved config should be loadable and contain the same values."""
    monkeypatch.chdir(tmp_path)
    from main import _save_config, _load_config

    cfg = {
        "model": "tiny",
        "device": "cpu",
        "compute_type": "int8",
        "language": "pt",
        "temperature": 0.5,
        "beam_size": 3,
        "vad_filter": False,
    }
    _save_config(cfg)
    loaded = _load_config()
    assert loaded["model"] == "tiny"
    assert loaded["language"] == "pt"
    assert loaded["temperature"] == 0.5


def test_save_config_is_atomic(tmp_path, monkeypatch):
    """_save_config should use atomic write (no partial files on crash)."""
    monkeypatch.chdir(tmp_path)
    from main import _save_config, CONFIG_FILE

    _save_config({"model": "small", "device": "cpu", "compute_type": "int8"})
    assert os.path.exists(CONFIG_FILE)
    assert not os.path.exists(CONFIG_FILE + ".tmp")


def test_cleanup_temp_files(tmp_path, monkeypatch):
    """_cleanup_temp_files should remove temp_* files."""
    monkeypatch.chdir(tmp_path)
    from main import _cleanup_temp_files

    # Create some temp files
    (tmp_path / "temp_abc123.ogg").write_bytes(b"fake audio")
    (tmp_path / "temp_def456.wav").write_bytes(b"fake audio")
    (tmp_path / "real_file.txt").write_text("keep me")

    _cleanup_temp_files()

    assert not (tmp_path / "temp_abc123.ogg").exists()
    assert not (tmp_path / "temp_def456.wav").exists()
    assert (tmp_path / "real_file.txt").exists()
