"""Pemeriksaan kepatuhan per orang (fitur 4).

Dasar dari eksperimen (scripts/12_violation.py, results/hasil/ringkasan.md):
- Prompt negasi ("bare head", "head without helmet") kalah jauh dari "deteksi dulu, lalu aturan
  asosiasi" (AP50 kepala tanpa helm 90,3 vs 57,2). Jadi aplikasi memakai aturan asosiasi.
- Skor pelanggaran kepala dihitung dengan fungsi yang sama persis dengan evaluasi:
  s_h * (1 - s_m), dengan s_m = skor helm tertinggi di antara helm yang >= 50% luasnya berada
  di dalam kotak kepala (rule_predictions).
- Tangan telanjang: kelas `hands` di SH17 berarti tangan tanpa sarung tangan. Eksperimen
  (hands_predictions) memakai skor `hands` apa adanya.

Bagian yang BARU di aplikasi (belum dievaluasi di eksperimen):
1. Tangan memakai rumus asosiasi yang sama dengan kepala-helm: s_tangan * (1 - s_sarung).
   Alasannya terlihat di gambar uji Construction-PPE image1003: pekerja bersarung tangan, tetapi
   YOLO26 mengeluarkan `hands` 0,69 dan `gloves` 0,49 pada kotak yang hampir sama. Dengan skor
   mentah, pekerja itu dinyatakan tidak patuh; dengan rumus asosiasi skornya 0,35.
2. Pengelompokan kepala dan tangan ke tiap orang. Kepala dianggap milik orang yang kotaknya memuat >= 80% luas kepala; kalau lebih
dari satu, dipilih yang memuat paling besar. Tangan memakai ambang 50%, karena tangan yang
terentang sering menempel di tepi kotak orang. Kedua ambang ini heuristik.
"""
import numpy as np

from .experiment import GLOVES, HANDS, HEAD, PERSON, ioa, rule_predictions

IOA_KEPALA_ORANG = 0.8
IOA_TANGAN_ORANG = 0.5
AMBANG_PELANGGARAN = 0.5


def _assign(persons, parts, minimum):
    """Indeks orang pemilik tiap bagian (-1 kalau tidak ada)."""
    if len(persons) == 0 or len(parts) == 0:
        return np.full(len(parts), -1, dtype=int)
    frac = ioa(persons, parts)  # [n_orang, n_bagian]: fraksi luas bagian di dalam orang
    best = frac.argmax(0)
    ok = frac[best, np.arange(len(parts))] >= minimum
    return np.where(ok, best, -1)


def _box(b):
    return [round(float(v), 1) for v in b]


def check(boxes, scores, cls, conf_tampil, ambang=AMBANG_PELANGGARAN):
    """boxes/scores/cls: prediksi mentah conf >= 0,001 (sama seperti evaluasi).

    Kepala, tangan, dan orang yang dihitung hanya yang skornya >= conf_tampil (yang terlihat di layar).
    Satu kepala dinyatakan tanpa helm kalau skor pelanggarannya >= ambang.
    """
    # Aturan asosiasi asli dari eksperimen, dijalankan pada semua prediksi berskor rendah juga,
    # supaya s_m identik dengan yang dievaluasi.
    hb, v_head, _ = rule_predictions({"img": (boxes, scores, cls)})["img"]
    s_head = scores[cls == HEAD]
    sm = np.where(s_head > 0, 1 - v_head / np.maximum(s_head, 1e-9), 0)  # skor helm terasosiasi

    keep_h = s_head >= conf_tampil
    hb, s_head, v_head, sm = hb[keep_h], s_head[keep_h], v_head[keep_h], sm[keep_h]

    pm = (cls == PERSON) & (scores >= conf_tampil)
    pb, ps = boxes[pm], scores[pm]
    # Tangan-sarung tangan: rumus yang sama dengan rule_predictions, juga memakai semua prediksi
    # sarung tangan berskor rendah.
    all_t, all_ts = boxes[cls == HANDS], scores[cls == HANDS]
    all_g, all_gs = boxes[cls == GLOVES], scores[cls == GLOVES]
    if len(all_t) and len(all_g):
        s_glove = np.where(ioa(all_t, all_g) >= 0.5, all_gs[None, :], 0).max(1)
    else:
        s_glove = np.zeros(len(all_t))
    keep_t = all_ts >= conf_tampil
    tb, ts, tsg = all_t[keep_t], all_ts[keep_t], s_glove[keep_t]
    tv = ts * (1 - tsg)  # skor pelanggaran tangan telanjang
    gb = all_g[all_gs >= conf_tampil]

    owner_h = _assign(pb, hb, IOA_KEPALA_ORANG)
    owner_t = _assign(pb, tb, IOA_TANGAN_ORANG)
    owner_g = _assign(pb, gb, IOA_TANGAN_ORANG)

    def kepala_item(j):
        return {"box": _box(hb[j]), "skor_kepala": round(float(s_head[j]), 3),
                "skor_helm": round(float(sm[j]), 3), "skor_pelanggaran": round(float(v_head[j]), 3),
                "tanpa_helm": bool(v_head[j] >= ambang)}

    def tangan_item(j):
        return {"box": _box(tb[j]), "skor_tangan": round(float(ts[j]), 3),
                "skor_sarung_tangan": round(float(tsg[j]), 3), "skor_pelanggaran": round(float(tv[j]), 3),
                "tanpa_sarung_tangan": bool(tv[j] >= ambang)}

    orang = []
    for i in range(len(pb)):
        kepala = [kepala_item(j) for j in np.flatnonzero(owner_h == i)]
        tangan = [tangan_item(j) for j in np.flatnonzero(owner_t == i)]
        n_sarung = int((owner_g == i).sum())

        if not kepala:
            helm = "tidak terlihat"
        elif any(k["tanpa_helm"] for k in kepala):
            helm = "tidak"
        else:
            helm = "ya"
        if any(t["tanpa_sarung_tangan"] for t in tangan):
            sarung = "tidak"
        elif n_sarung:
            sarung = "ya"
        else:
            sarung = "tidak terlihat"

        if helm == "tidak" or sarung == "tidak":
            status = "tidak patuh"
        elif helm == "ya":
            status = "patuh"  # helm terdeteksi dan tidak ada tangan telanjang yang terdeteksi
        else:
            status = "tidak diketahui"
        orang.append({"box": _box(pb[i]), "skor": round(float(ps[i]), 3), "status": status, "helm": helm,
                      "sarung_tangan": sarung, "kepala": kepala, "tangan": tangan})

    # Kepala dan tangan yang tidak masuk kotak orang mana pun (misalnya foto close-up) tetap dilaporkan.
    lepas = {"kepala": [kepala_item(j) for j in np.flatnonzero(owner_h == -1)],
             "tangan": [tangan_item(j) for j in np.flatnonzero(owner_t == -1)]}

    ringkas = {s: sum(o["status"] == s for o in orang) for s in ("patuh", "tidak patuh", "tidak diketahui")}
    ringkas["kepala_tanpa_helm_lepas"] = sum(k["tanpa_helm"] for k in lepas["kepala"])
    ringkas["tangan_telanjang_lepas"] = sum(t["tanpa_sarung_tangan"] for t in lepas["tangan"])
    return {"orang": orang, "lepas": lepas, "ringkasan": ringkas,
            "ambang": {"pelanggaran": ambang, "kepala_orang": IOA_KEPALA_ORANG, "tangan_orang": IOA_TANGAN_ORANG}}
