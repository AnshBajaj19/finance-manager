@echo off
echo ===================================================
echo           Starting Dhan Drishti
echo ===================================================
echo.
echo 1. Launching ML Service (Port 8000)...
start "Dhan Drishti - ML Service (Port 8000)" cmd /k "cd ml-service && if exist venv\Scripts\python.exe ( venv\Scripts\python.exe app.py ) else ( python app.py )"

echo 2. Launching Backend API (Port 5000)...
start "Dhan Drishti - Backend (Port 5000)" cmd /k "cd backend && npm run dev"

echo 3. Launching Frontend (Port 5173)...
start "Dhan Drishti - Frontend (Port 5173)" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo All 3 services have been launched in separate windows!
echo Open your browser at: http://localhost:5173
echo ===================================================
echo.
pause
