"""Jembatan ke kode eksperimen di scripts/ (hanya dibaca, tidak diubah).

Nama kelas, prompt, dan aturan asosiasi diambil langsung dari skrip eksperimen, supaya aplikasi
memakai logika yang sama persis dengan yang dievaluasi di results/hasil/ringkasan.md.
"""
import importlib
import sys

from .config import ROOT

_SCRIPTS = str(ROOT / "scripts")
if _SCRIPTS not in sys.path:
    sys.path.insert(0, _SCRIPTS)

common = importlib.import_module("common")
# Nama modul diawali angka, jadi tidak bisa memakai `import` biasa.
violation = importlib.import_module("12_violation")

SH17_NAMES: list[str] = list(common.SH17_NAMES)
PROMPTS: list[str] = list(common.PROMPTS)
CLASS_GROUPS: dict[str, list[str]] = dict(common.CLASS_GROUPS)

PERSON = SH17_NAMES.index("person")
HEAD = violation.HEAD
HELMET = violation.HELMET
HANDS = violation.HANDS
GLOVES = SH17_NAMES.index("gloves")

ioa = violation.ioa
rule_predictions = violation.rule_predictions
hands_predictions = violation.hands_predictions
