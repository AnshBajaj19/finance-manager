@echo off
echo ===================================================
echo           Starting Finance Manager
echo ===================================================
echo.
echo 1. Launching ML Service (Port 8000)...
start "Finance Manager - ML Service (Port 8000)" cmd /k "cd ml-service && python app.py"

echo 2. Launching Backend API (Port 5000)...
start "Finance Manager - Backend (Port 5000)" cmd /k "cd backend && npm run dev"

echo 3. Launching Frontend (Port 5173)...
start "Finance Manager - Frontend (Port 5173)" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo All 3 services have been launched in separate windows!
echo Open your browser at: http://localhost:5173
echo ===================================================
echo.
pause
