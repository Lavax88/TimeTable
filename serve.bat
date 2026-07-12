@echo off
cd /d "%~dp0"

echo Installing Python dependencies...
pip install -r requirements.txt 2>nul

if "%VAPID_PRIVATE_KEY%"=="" (
    if exist generate_vapid_keys.py (
        echo Generating VAPID keys...
        for /f "tokens=*" %%i in ('python generate_vapid_keys.py') do set %%i
    )
)

if "%ADMIN_PASSWORD%"=="" set ADMIN_PASSWORD=admin
if "%VAPID_PRIVATE_KEY%"=="" echo WARNING: VAPID keys not set. Push notifications won't work.
if "%UPSTASH_REDIS_URL%"=="" echo INFO: Using local JSON files for storage (no Redis).

echo Starting local server at http://localhost:8000
python local_server.py
