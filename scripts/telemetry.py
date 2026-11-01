"""Catat kondisi perangkat selama run: daya & clock GPU, suhu, sumber daya listrik.

Mode daya Lenovo (Quiet/Balanced/Performance) tidak bisa dibaca tanpa hak admin,
jadi yang dicatat adalah akibatnya: batas daya GPU yang sedang berlaku dan clock
yang benar-benar tercapai. Dua angka ini yang menentukan waktu latih dan FPS.
"""
import ctypes
import subprocess
import sys
import threading
import time

import psutil
import pynvml


def commit_free_GB():
    """Sisa commit Windows (RAM + page file). Tiap worker DataLoader memuat DLL CUDA sendiri, jadi ini yang
    habis lebih dulu, bukan RAM bebas; kalau habis, pin memory gagal dengan cuMemHostAlloc."""
    class Status(ctypes.Structure):
        _fields_ = [("len", ctypes.c_ulong), ("load", ctypes.c_ulong)] + [(n, ctypes.c_ulonglong) for n in (
            "phys", "avail_phys", "page", "avail_page", "virt", "avail_virt", "ext")]
    st = Status()
    st.len = ctypes.sizeof(Status)
    ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(st))
    return st.avail_page / 1024**3


def keep_awake():
    """Minta Windows tidak idle-sleep selama proses ini hidup (otomatis lepas saat proses selesai).
    Bukan mengubah pengaturan; sama seperti pemutar video yang mencegah layar mati."""
    if sys.platform == "win32":
        ES_CONTINUOUS, ES_SYSTEM_REQUIRED = 0x80000000, 0x00000001
        ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)


def power_context():
    bat = psutil.sensors_battery()
    plan = subprocess.run(["powercfg", "/getactivescheme"], capture_output=True, text=True).stdout
    pynvml.nvmlInit()
    h = pynvml.nvmlDeviceGetHandleByIndex(0)
    ctx = {
        "ac_power": None if bat is None else bool(bat.power_plugged),
        "battery_percent": None if bat is None else bat.percent,
        "windows_power_plan": plan.split("(")[-1].strip().rstrip(")") if "(" in plan else plan.strip(),
        "gpu_enforced_power_limit_W": pynvml.nvmlDeviceGetEnforcedPowerLimit(h) / 1000,
        "gpu_max_sm_clock_MHz": pynvml.nvmlDeviceGetMaxClockInfo(h, pynvml.NVML_CLOCK_SM),
    }
    pynvml.nvmlShutdown()
    return ctx


class GpuMonitor:
    """Ambil sampel GPU tiap `interval` detik di thread terpisah; ringkas saat keluar."""

    def __init__(self, interval=1.0):
        self.interval, self.samples, self._stop = interval, [], threading.Event()

    def _run(self):
        pynvml.nvmlInit()
        h = pynvml.nvmlDeviceGetHandleByIndex(0)
        while not self._stop.is_set():
            self.samples.append((
                pynvml.nvmlDeviceGetPowerUsage(h) / 1000,
                pynvml.nvmlDeviceGetClockInfo(h, pynvml.NVML_CLOCK_SM),
                pynvml.nvmlDeviceGetTemperature(h, pynvml.NVML_TEMPERATURE_GPU),
                pynvml.nvmlDeviceGetUtilizationRates(h).gpu,
                pynvml.nvmlDeviceGetEnforcedPowerLimit(h) / 1000,
                psutil.virtual_memory().available / 1024**3,
                pynvml.nvmlDeviceGetMemoryInfo(h).used / 1024**3,
                commit_free_GB(),
            ))
            time.sleep(self.interval)
        pynvml.nvmlShutdown()

    def __enter__(self):
        self.context = power_context()
        self._t = threading.Thread(target=self._run, daemon=True)
        self._t.start()
        return self

    def __exit__(self, *exc):
        self._stop.set()
        self._t.join()
        if self.samples:  # tetap tercatat di log kalau run gagal
            print(f"Sisa commit terendah {min(x[7] for x in self.samples):.1f} GB, "
                  f"RAM bebas terendah {min(x[5] for x in self.samples):.1f} GB", flush=True)

    def summary(self):
        s = self.samples
        if not s:
            return {**self.context}
        col = list(zip(*s))
        mean = lambda xs: round(sum(xs) / len(xs), 1)  # noqa: E731
        return {
            **self.context,
            "gpu_power_W_mean": mean(col[0]), "gpu_power_W_max": round(max(col[0]), 1),
            "gpu_sm_clock_MHz_mean": mean(col[1]), "gpu_temp_C_max": max(col[2]),
            "gpu_util_pct_mean": mean(col[3]),
            "gpu_power_limit_W_min": min(col[4]), "gpu_power_limit_W_max": max(col[4]),
            "ram_free_GB_min": round(min(col[5]), 2), "gpu_mem_used_GB_max": round(max(col[6]), 2),
            "commit_free_GB_min": round(min(col[7]), 2),
            "n_samples": len(s),
        }
