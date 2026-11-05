@echo off
rem Jalankan Sorot: klik dua kali file ini.
rem 1. Memeriksa apakah server sudah jalan (kalau ya, langsung membuka browser).
rem 2. Memperingatkan kalau GPU sedang dipakai proses lain (aturan: satu proses GPU).
rem 3. Membangun tampilan kalau belum pernah dibangun.
rem 4. Menyalakan server, lalu membuka browser otomatis begitu model siap (+-25 detik).
rem Tutup jendela ini untuk mematikan server.

setlocal
title Sorot - server deteksi APD
cd /d "%~dp0.."
set "PY=%CD%\.venv\Scripts\python.exe"
set "URL=http://127.0.0.1:8000"

if not exist "%PY%" (
  echo [GAGAL] Python .venv tidak ditemukan di %PY%
  pause
  exit /b 1
)

rem --- pastikan Python dasar .venv ada di lokasi aslinya ---
rem .venv dibuat uv dari dalam aplikasi Claude (paket MSIX). Windows mengalihkan folder Roaming aplikasi itu
rem ke AppData\Local\Packages\Claude_*\LocalCache\Roaming, sehingga Python dasarnya hanya "terlihat" dari
rem dalam Claude. Kalau dijalankan dari Explorer, Python itu disalin sekali ke lokasi aslinya (+-61 MB).
set "PYHOME="
for /f "tokens=1,* delims== " %%a in ('findstr /b "home" ".venv\pyvenv.cfg"') do set "PYHOME=%%b"
if not defined PYHOME goto cek_python
if exist "%PYHOME%\python.exe" goto cek_python
for %%n in ("%PYHOME%") do set "PYNAMA=%%~nxn"
set "SALINAN="
for /d %%d in ("%LOCALAPPDATA%\Packages\Claude_*") do if exist "%%d\LocalCache\Roaming\uv\python\%PYNAMA%\python.exe" set "SALINAN=%%d\LocalCache\Roaming\uv\python\%PYNAMA%"
if not defined SALINAN (
  echo [GAGAL] Python dasar untuk .venv tidak ditemukan: %PYHOME%
  pause
  exit /b 1
)
echo Menyiapkan Python untuk pertama kali, sekali saja...
robocopy "%SALINAN%" "%PYHOME%" /E /NFL /NDL /NJH /NJS /NP >nul
if not exist "%PYHOME%\python.exe" (
  echo [GAGAL] Python tidak bisa disalin ke %PYHOME%
  pause
  exit /b 1
)

:cek_python
"%PY%" -c "import torch, ultralytics, fastapi" 2>nul
if errorlevel 1 (
  echo [GAGAL] Python .venv tidak bisa memuat torch, ultralytics, atau fastapi.
  "%PY%" -c "import torch, ultralytics, fastapi"
  pause
  exit /b 1
)

rem --- server sudah jalan? ---
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%URL%/api/health' | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  echo Sorot sudah berjalan. Membuka browser...
  if not defined SOROT_TANPA_BROWSER start "" "%URL%"
  exit /b 0
)

rem --- GPU dipakai proses lain? ---
for /f "delims=" %%p in ('nvidia-smi --query-compute-apps^=pid --format^=csv^,noheader 2^>nul') do set "GPU_SIBUK=1"
if defined GPU_SIBUK (
  echo.
  echo [PERINGATAN] GPU sedang dipakai proses lain, misalnya training:
  nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader
  echo Sebaiknya hentikan proses itu dulu supaya Sorot lancar.
  if not defined SOROT_TANPA_BROWSER (
    choice /c YT /m "Tetap lanjut? Y = ya, T = tidak"
    if errorlevel 2 exit /b 1
  )
)

rem --- bangun tampilan kalau belum ada ---
if not exist "app\frontend\dist\index.html" (
  echo Membangun tampilan untuk pertama kali...
  pushd app\frontend
  call npm install || goto gagal
  call npm run build || goto gagal
  popd
)

rem --- buka browser otomatis begitu model selesai dimuat ---
rem (di luar blok if, karena tanda kurung di perintah PowerShell akan menutup blok cmd lebih awal)
if defined SOROT_TANPA_BROWSER goto nyalakan
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i=0; $i -lt 90; $i++) { try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%URL%/api/health' | Out-Null; Start-Process '%URL%'; break } catch { Start-Sleep 1 } }"

:nyalakan
echo.
echo Menyalakan Sorot. Keenam model dimuat +-25 detik, lalu browser terbuka sendiri.
echo Alamat: %URL%
echo Tutup jendela ini untuk mematikan server.
echo.
"%PY%" -m uvicorn app.backend.main:app --host 127.0.0.1 --port 8000
echo.
echo Server berhenti.
pause
exit /b 0

:gagal
echo [GAGAL] Tampilan tidak bisa dibangun. Pastikan Node.js terpasang.
pause
exit /b 1
