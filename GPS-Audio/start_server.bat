@echo off
title GuardianTrack Local Backend Server
echo ============================================================
echo   GuardianTrack — Starting Local Dashboard Server
echo   Web Dashboard URL: http://192.168.123.6:8888/
echo ============================================================
echo.

cd /d "%~dp0backend"

echo Launching web browser to http://192.168.123.6:8888 ...
start "" "http://192.168.123.6:8888"

echo Starting Netlify Dev server...
npm run dev
pause
