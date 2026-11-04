"""Uji aturan kepatuhan dengan kotak buatan (tanpa model, tanpa GPU).

Jalankan dari root repo: .venv/Scripts/python -m pytest app/backend/tests -q
"""
import numpy as np

from app.backend.compliance import check
from app.backend.experiment import GLOVES, HANDS, HEAD, HELMET, PERSON

ORANG = [100, 100, 200, 400]
KEPALA = [130, 100, 170, 150]
HELM = [128, 98, 172, 125]  # bagian atas kepala, > 50% luasnya di dalam kotak kepala
TANGAN = [100, 250, 120, 270]


def run(rows, conf=0.25):
    boxes = np.array([r[0] for r in rows], dtype=np.float32).reshape(-1, 4)
    scores = np.array([r[1] for r in rows], dtype=np.float32)
    cls = np.array([r[2] for r in rows], dtype=int)
    return check(boxes, scores, cls, conf)


def test_helm_dan_tanpa_tangan_telanjang_patuh():
    o = run([(ORANG, 0.9, PERSON), (KEPALA, 0.9, HEAD), (HELM, 0.9, HELMET)])["orang"][0]
    assert (o["status"], o["helm"], o["sarung_tangan"]) == ("patuh", "ya", "tidak terlihat")


def test_kepala_tanpa_helm_tidak_patuh():
    o = run([(ORANG, 0.9, PERSON), (KEPALA, 0.9, HEAD)])["orang"][0]
    assert (o["status"], o["helm"]) == ("tidak patuh", "tidak")
    assert o["kepala"][0]["skor_pelanggaran"] == 0.9


def test_skor_pelanggaran_sama_dengan_rumus_eksperimen():
    # s_h * (1 - s_m) = 0,8 * (1 - 0,6) = 0,32 < 0,5 -> dianggap memakai helm
    k = run([(ORANG, 0.9, PERSON), (KEPALA, 0.8, HEAD), (HELM, 0.6, HELMET)])["orang"][0]["kepala"][0]
    assert abs(k["skor_pelanggaran"] - 0.32) < 1e-3 and not k["tanpa_helm"]


def test_helm_berskor_rendah_tetap_dipakai_aturan():
    # Helm 0,1 tidak tampil di layar (conf 0,25), tetapi tetap mengurangi skor pelanggaran,
    # sama seperti evaluasi yang memakai semua prediksi conf >= 0,001.
    k = run([(ORANG, 0.9, PERSON), (KEPALA, 0.9, HEAD), (HELM, 0.1, HELMET)])["orang"][0]["kepala"][0]
    assert abs(k["skor_pelanggaran"] - 0.81) < 1e-3


def test_helm_di_luar_kepala_tidak_dihitung():
    helm_jauh = [300, 300, 340, 330]
    o = run([(ORANG, 0.9, PERSON), (KEPALA, 0.9, HEAD), (helm_jauh, 0.9, HELMET)])["orang"][0]
    assert o["helm"] == "tidak"


def test_tangan_bersarung_tidak_dianggap_telanjang():
    # Kasus image1003 Construction-PPE: hands dan gloves pada kotak yang sama.
    o = run([(ORANG, 0.9, PERSON), (KEPALA, 0.9, HEAD), (HELM, 0.9, HELMET),
             (TANGAN, 0.69, HANDS), (TANGAN, 0.49, GLOVES)])["orang"][0]
    assert (o["status"], o["sarung_tangan"]) == ("patuh", "ya")


def test_tangan_telanjang_tidak_patuh():
    o = run([(ORANG, 0.9, PERSON), (KEPALA, 0.9, HEAD), (HELM, 0.9, HELMET), (TANGAN, 0.8, HANDS)])["orang"][0]
    assert (o["status"], o["sarung_tangan"]) == ("tidak patuh", "tidak")


def test_tanpa_kepala_tidak_diketahui():
    o = run([(ORANG, 0.9, PERSON)])["orang"][0]
    assert o["status"] == "tidak diketahui"


def test_kepala_tanpa_orang_dilaporkan_lepas():
    r = run([(KEPALA, 0.9, HEAD)])
    assert r["orang"] == [] and r["ringkasan"]["kepala_tanpa_helm_lepas"] == 1


def test_kepala_ikut_orang_yang_memuatnya():
    orang2 = [300, 100, 400, 400]
    kepala2 = [330, 100, 370, 150]
    r = run([(ORANG, 0.9, PERSON), (orang2, 0.9, PERSON), (KEPALA, 0.9, HEAD), (HELM, 0.9, HELMET),
             (kepala2, 0.9, HEAD)])
    assert [o["status"] for o in r["orang"]] == ["patuh", "tidak patuh"]


def test_gambar_kosong():
    r = run([])
    assert r["orang"] == [] and r["ringkasan"]["patuh"] == 0
