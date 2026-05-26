@echo off
echo Stopping existing Next.js servers...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak > nul
echo Starting Next.js dev server...
cd /d C:\MVP\frontend
start "Next.js Dev Server" cmd /k "npm run dev"
echo Done! Server starting at http://localhost:3000
