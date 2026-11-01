"""Jalankan antrean eksperimen satu per satu, masing-masing di proses Python baru.

- Proses baru per run: memori GPU bersih, tidak ada state yang terbawa antar run.
- Bisa dilanjutkan: job yang file hasilnya sudah ada dilewati. Kalau laptop mati, jalankan
  perintah yang sama lagi; run data penuh melanjutkan dari last.pt.
- Charger dipantau tiap 20 detik. AC hilang > 60 detik: job dimatikan sebelum baterai habis, antrean
  menunggu listrik, lalu job diulang. Mematikan job lebih aman daripada laptop mati saat menulis file.
- GPU >= 90 °C: job berikutnya menunggu dingin dulu.
- Timeout per jenis job, karena job macet tidak boleh menghabiskan sisa malam.
- `09_queue.py --jeda` menulis results/berhenti.flag: few-shot selesai dulu lalu berhenti, data penuh
  langsung dihentikan dan nanti lanjut dari epoch terakhir.
- last.pt run data penuh disalin ke last_backup.pt tiap kali berubah; file itu dipakai kalau last.pt
  rusak karena listrik mati saat menulis.
- Run yang gagal dicatat lalu antrean lanjut (log lengkap di results/logs/<tag>.log).

Contoh: python scripts/09_queue.py tahap2
        python scripts/09_queue.py tahap2 --list   (lihat isi dan status tanpa menjalankan)
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import psutil
import pynvml

sys.path.insert(0, str(Path(__file__).parent))
from common import RESULTS, ROOT, RUNS, SPLITS  # noqa: E402
from telemetry import keep_awake  # noqa: E402

PY = sys.executable
KS, K_BESAR = [1, 5, 10, 30], 100
INTI = ["yoloe-vp", "yoloe-lp", "yoloe-ft", "yolo26"]
JADWAL = {"A": (64, 100), "B": (8, 100), "C": (8, 300)}  # jadwal: (nbs, epoch)
AC_POLL_S, AC_GRACE_S = 20, 60
SUHU_MAKS, SUHU_JEDA_S = 90, 60
MACET_S, MACET_ULANG = 300, 2  # log diam dan GPU < 5% selama 5 menit; job diulang paling banyak 2 kali
STOP = RESULTS / "berhenti.flag"
NEVER = RESULTS / "_never_"  # job yang selalu dijalankan; skrip itu sendiri melewati bagian yang sudah ada


def train_job(model, k=None, seed=0, full=False, suffix="", extra=(), split="test"):
    shot = f"full_seed{seed}" if full else f"k{k}_seed{seed}"
    argv = ["scripts/05_train.py", "--model", model, "--seed", str(seed), "--eval-split", split]
    argv += ["--full"] if full else ["--k", str(k)]
    if suffix:
        argv += ["--suffix", suffix]
    argv += list(extra)
    tag = f"{shot}_{model}s{suffix}"
    return tag, argv, RESULTS / ("runs" if split == "test" else "runs_dev") / f"{tag}.json"


def script_job(tag, result, *argv):
    """result: file yang menandakan job selesai (untuk dilewati saat antrean diulang)."""
    return tag, list(argv), result


def zs_val(model, imgsz=None):
    name = f"zeroshot_{model}" + (f"_{imgsz}" if imgsz else "")
    argv = ["scripts/03_zeroshot_yoloe.py", "--model", model] + (["--imgsz", str(imgsz)] if imgsz else [])
    return script_job(name, RESULTS / "runs" / f"{name}.json", *argv)


def zs_ov(model, tag=None):
    tag = tag or f"zeroshot_{model}"
    return script_job(tag, RESULTS / "runs" / f"{tag}.json", "scripts/08_zeroshot_ov.py", "--model", model, "--tag", tag)


def fps_job(name, model):
    return script_job(f"fps_{name}", RESULTS / "runs_fps" / f"fps_{name}.json", "scripts/06_fps.py",
                      "--model", model, "--tag", f"fps_{name}")


def paket():
    p1_siap = [
        script_job("dedup_embedding", SPLITS / "train_final.txt", "scripts/02c_dedup_embedding.py"),
        script_job("split_dev", SPLITS / "pool.txt", "scripts/02d_split_dev.py"),
        script_job("sample_fewshot", SPLITS / "fewshot" / "k30_seed4_train.txt", "scripts/04_sample_fewshot.py"),
    ]
    p1_worker = [train_job("yolo26", full=True, suffix=f"_ujiw{w}", split="dev",
                           extra=["--epochs", "1", "--workers", str(w)]) for w in (8, 6, 4, 2, 1)]  # worker 12 gagal: memori virtual habis (results/hasil/gerbang.md)
    p1_jadwal = [train_job(m, k, 0, suffix=f"_jadwal{j}", split="dev", extra=["--nbs", str(n), "--epochs", str(e)])
                 for j, (n, e) in JADWAL.items() for k in (1, 10) for m in ("yoloe-lp", "yolo26")]
    n, e = JADWAL["B"]
    p1_rep = [train_job(m, 10, 0, suffix="_jadwalB_rep", split="dev", extra=["--nbs", str(n), "--epochs", str(e)])
              for m in ("yoloe-lp", "yolo26")]
    # Fine-tune YOLOE memakai jadwal YOLO26, jadi hanya diukur kecepatan dan VRAM-nya.
    p1_ft = [train_job("yoloe-ft", k, 0, suffix="_jadwalB", split="dev", extra=["--nbs", str(n), "--epochs", str(e)])
             for k in (1, 10)] + [train_job("yoloe-ft", full=True, suffix="_ujift", split="dev", extra=["--epochs", "1"])]
    gate = script_job("gerbang", NEVER, "scripts/15_gate.py")
    analisis = script_job("analisis", NEVER, "scripts/13_analyze.py")
    zero = [zs_val(f"yoloe-26{s}") for s in "nsmlx"] + [zs_val(f"yolov8{s}-worldv2") for s in "smlx"] \
        + [zs_val("yoloe-26s", 1280), zs_val("yoloe-26l", 1280)] \
        + [zs_ov("yoloe-26s", "zeroshot_det_yoloe-26s"), zs_ov("yoloe-26l", "zeroshot_det_yoloe-26l"),
           zs_ov("gdino-base"), zs_ov("owlv2-base"),
           script_job("prompt_ablation", RESULTS / "runs" / "prompt_yoloe26s_ensemble.json",
                      "scripts/10_prompt_ablation.py", "s")]
    return {
        "tahap1_siap": p1_siap,
        "tahap1_worker": p1_worker,
        "tahap1_jadwal": p1_jadwal + p1_rep + p1_ft,
        "tahap1": p1_siap + p1_worker + p1_jadwal + p1_rep + p1_ft + [gate],
        # seed sebagai loop terluar: setiap seed selesai, satu kurva k lengkap sudah tersedia
        "tahap2": zero + [train_job(m, k, s) for s in (0, 1, 2) for k in KS for m in INTI] + [analisis, gate],
        "tahap3": [train_job(m, k, s) for s in (3, 4) for k in KS for m in INTI]
                  + [train_job(m, K_BESAR, s) for s in range(5) for m in INTI]
                  + [train_job("yolo26", full=True),
                     script_job("cross_zeroshot", NEVER, "scripts/11_cross_dataset.py", "zeroshot"),
                     script_job("cross_trained", NEVER, "scripts/11_cross_dataset.py", "trained"),
                     script_job("violation", NEVER, "scripts/12_violation.py")]
                  + [fps_job(t, m) for t, m in [
                      ("yoloe-26s_zeroshot", "yoloe-26s"), ("yoloe-26l_zeroshot", "yoloe-26l"),
                      ("yolov8s-worldv2", "yolov8s-worldv2"), ("yolov8l-worldv2", "yolov8l-worldv2"),
                      ("gdino-tiny", "gdino-tiny"), ("gdino-base", "gdino-base"), ("owlv2-base", "owlv2-base"),
                      ("k10_seed0_yoloe-lps", "k10_seed0_yoloe-lps/weights/last.pt"),
                      ("k10_seed0_yolo26s", "k10_seed0_yolo26s/weights/last.pt"),
                      ("full_seed0_yolo26s", "full_seed0_yolo26s/weights/best.pt")]]
                  + [analisis, gate],
        "tahap4": [train_job("yoloe-ft", full=True)]
                  + [train_job("yolow-ft", k, s) for s in range(5) for k in KS]
                  + [zs_ov("owlv2-large"),
                     script_job("cross_zeroshot_l", NEVER, "scripts/11_cross_dataset.py", "zeroshot", "owlv2-large"),
                     script_job("negasi_ov", NEVER, "scripts/12_violation.py", "negasi-ov"),
                     analisis, gate],
    }


def job_timeout_s(tag):
    if tag.startswith("full_") and "_uji" not in tag:
        return 24 * 3600  # 45 menit akan membunuh run data penuh
    if tag == "negasi_ov":
        return 4 * 3600
    if tag.startswith("k100_") or any(x in tag for x in ("gdino", "owlv2", "cross_", "violation")):
        return 90 * 60
    return 45 * 60


def ac_on():
    bat = psutil.sensors_battery()
    return bat is None or bool(bat.power_plugged)


def gpu_temp():
    try:
        pynvml.nvmlInit()
        t = pynvml.nvmlDeviceGetTemperature(pynvml.nvmlDeviceGetHandleByIndex(0), pynvml.NVML_TEMPERATURE_GPU)
        pynvml.nvmlShutdown()
        return t
    except pynvml.NVMLError:  # gangguan baca sesaat tidak boleh mematikan antrean
        return 0


def gpu_util():
    try:
        pynvml.nvmlInit()
        u = pynvml.nvmlDeviceGetUtilizationRates(pynvml.nvmlDeviceGetHandleByIndex(0)).gpu
        pynvml.nvmlShutdown()
        return u
    except pynvml.NVMLError:  # anggap aktif; watchdog menilai lagi pada putaran berikutnya
        return 100


def kill_tree(proc):
    """Matikan seluruh pohon proses, termasuk worker dataloader yang masih memegang RAM."""
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(proc.pid)], capture_output=True)
    else:
        proc.kill()
    proc.wait()


def backup_last(last, seen, min_age_s=5):
    """Salin last.pt yang sudah selesai ditulis ke last_backup.pt; mengembalikan mtime yang sudah disalin."""
    try:
        mtime = last.stat().st_mtime
    except OSError:
        return seen
    if mtime == seen or time.time() - mtime < min_age_s:
        return seen
    tmp = last.with_name("last_backup.tmp")
    shutil.copyfile(last, tmp)
    os.replace(tmp, last.with_name("last_backup.pt"))
    return mtime


def run_job(argv, logfile, timeout_s, poll_s=AC_POLL_S, grace_s=AC_GRACE_S, last=None):
    """Mengembalikan exit code, 'timeout', 'ac_hilang', atau 'berhenti' (job sudah dimatikan).

    last: path last.pt untuk run data penuh, yang dicadangkan dan bisa dihentikan langsung."""
    with open(logfile, "a", encoding="utf-8") as f:
        proc = subprocess.Popen([PY, *argv], cwd=ROOT, stdout=f, stderr=subprocess.STDOUT)
        t0, ac_lost, seen, aktif = time.time(), None, None, time.time()
        latih = "scripts/05_train.py" in argv
        while True:
            try:
                return proc.wait(timeout=poll_s)
            except subprocess.TimeoutExpired:
                pass
            if last is not None:
                if STOP.exists():
                    kill_tree(proc)
                    return "berhenti"
                seen = backup_last(last, seen)
            # Macet: worker dataloader mati bisa membuat proses utama menunggu selamanya tanpa memakai GPU.
            if latih:
                if gpu_util() >= 5 or time.time() - logfile.stat().st_mtime < MACET_S:
                    aktif = time.time()
                elif time.time() - aktif > MACET_S:
                    kill_tree(proc)
                    return "macet"
            if time.time() - t0 > timeout_s:
                kill_tree(proc)
                return "timeout"
            if ac_on():
                ac_lost = None
            elif ac_lost is None:
                ac_lost = time.time()
            elif time.time() - ac_lost > grace_s:
                kill_tree(proc)
                return "ac_hilang"


def run_phase(name, jobs, poll_s=AC_POLL_S, grace_s=AC_GRACE_S):
    keep_awake()
    logs = RESULTS / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    qlog = open(logs / f"queue_{name}.log", "a", encoding="utf-8")

    def say(msg):
        line = f"{time.strftime('%H:%M:%S')} {msg}"
        print(line, flush=True)
        qlog.write(line + "\n")
        qlog.flush()

    say(f"MULAI fase {name}: {len(jobs)} job")
    for i, (tag, argv, res) in enumerate(jobs, 1):
        if STOP.exists():
            say("BERHENTI atas permintaan; jalankan perintah yang sama untuk melanjutkan")
            qlog.close()
            return False
        if res.exists():
            continue
        while (t := gpu_temp()) >= SUHU_MAKS:
            say(f"JEDA GPU {t} °C")
            time.sleep(SUHU_JEDA_S)
        macet = 0
        while True:
            while not ac_on() and not STOP.exists():
                time.sleep(poll_s)
            if STOP.exists():
                code = "berhenti"
                break
            t0 = time.time()
            last = RUNS / "train" / tag / "weights" / "last.pt" if tag.startswith("full_") else None
            code = run_job(argv, logs / f"{tag}.log", job_timeout_s(tag), poll_s, grace_s, last)
            if code == "macet" and macet < MACET_ULANG:
                macet += 1
                say(f"MACET {tag}, dimatikan dan diulang ({macet}/{MACET_ULANG})")
                continue
            if code != "ac_hilang":
                break
            say(f"AC hilang, {tag} dimatikan setelah {(time.time() - t0) / 60:.1f} mnt; menunggu listrik")
        if code == "berhenti":
            say(f"BERHENTI atas permintaan, {tag} dihentikan; jalankan perintah yang sama untuk melanjutkan")
            qlog.close()
            return False
        dt = (time.time() - t0) / 60
        if code == 0 and res == NEVER:
            say(f"DONE [{i}/{len(jobs)}] {tag} ({dt:.1f} mnt)")
        elif code == 0 and res.exists():
            r = json.loads(res.read_text()) if res.suffix == ".json" else {}
            say(f"DONE [{i}/{len(jobs)}] {tag} mAP50={r.get('mAP50', float('nan')):.4f} ({dt:.1f} mnt)")
        else:
            say(f"FAIL [{i}/{len(jobs)}] {tag} exit={code} ({dt:.1f} mnt)")
    say(f"SELESAI fase {name}")
    qlog.close()
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("phases", nargs="*", help="fase, dijalankan berurutan")
    ap.add_argument("--list", action="store_true", help="tampilkan job (dan statusnya) tanpa menjalankan")
    ap.add_argument("--jeda", action="store_true", help="minta antrean yang sedang jalan berhenti dengan rapi")
    a = ap.parse_args()
    if a.jeda:
        STOP.touch()
        print("Penanda jeda ditulis. Few-shot selesai dulu; data penuh berhenti paling lama 20 detik.")
        return
    if not a.phases:
        ap.error("sebutkan fase, atau pakai --jeda")
    semua = paket()
    for name in a.phases:
        if name not in semua:
            sys.exit(f"Fase tidak dikenal: {name}. Pilihan: {', '.join(semua)}")
    if a.list:
        for name in a.phases:
            jobs = semua[name]
            print(f"== {name}: {len(jobs)} job, {sum(r.exists() for _, _, r in jobs)} sudah selesai")
            for tag, argv, r in jobs:
                print(f"  {'[x]' if r.exists() else '[ ]'} {tag:<36} {' '.join(argv)}")
        return
    STOP.unlink(missing_ok=True)  # penanda sisa sesi lalu tidak boleh menghentikan antrean baru
    for name in a.phases:
        if not run_phase(name, semua[name]):
            break


if __name__ == "__main__":
    main()
