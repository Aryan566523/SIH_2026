@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo              ChainSentinel AI - Launcher
echo =======================================================
echo.

set "PATH=%APPDATA%\npm;%ProgramFiles%\nodejs;%PATH%"

echo [*] Checking Node.js runtime...
where node >nul 2>&1
if errorlevel 1 goto NO_NODE

echo [*] Checking pnpm package manager...
where pnpm >nul 2>&1
if errorlevel 1 goto NO_PNPM

echo [*] Verifying installed dependencies...
if not exist "node_modules" goto MISSING_DEPS
if not exist "apps\web\node_modules" goto MISSING_DEPS
if not exist "apps\api\node_modules" goto MISSING_DEPS
if not exist "packages\types\dist" goto MISSING_DEPS

echo [OK] All dependencies verified!
echo.

if not exist ".env" (
    if exist ".env.example" (
        echo [*] Initializing .env configuration from .env.example...
        copy /y ".env.example" ".env" >nul
        echo [OK] .env initialized.
    )
)

echo =======================================================
echo Starting ChainSentinel AI Development Servers...
echo - Web Dashboard:  http://localhost:3000
echo - API Backend:    http://localhost:3001
echo - API Docs:       http://localhost:3001/docs
echo =======================================================
echo.

call pnpm dev
if errorlevel 1 goto RUN_FAIL
exit /b 0

:NO_NODE
echo.
echo =======================================================
echo [EXCEPTION ERROR] Node.js is NOT installed!
echo =======================================================
echo Node.js is required to run ChainSentinel AI.
echo Please install Node.js v18 or higher from https://nodejs.org/
echo After installing Node.js, run install.bat.
echo.
pause
exit /b 1

:NO_PNPM
echo.
echo =======================================================
echo [EXCEPTION ERROR] Missing dependency: pnpm is not installed!
echo =======================================================
echo The package manager 'pnpm' is required to run the project.
echo.
echo Please run "install.bat" to install pnpm and all dependencies.
echo.
pause
exit /b 1

:MISSING_DEPS
echo.
echo =======================================================
echo [EXCEPTION ERROR] Dependencies are NOT installed yet!
echo =======================================================
echo One or more required packages or dependencies are missing.
echo.
echo =======================================================
echo  >>> PLEASE RUN "install.bat" TO INSTALL DEPENDENCIES <<<
echo =======================================================
echo.
pause
exit /b 1

:RUN_FAIL
echo.
echo [ERROR] An error occurred while running the project.
echo If this is due to corrupted or missing packages, please run "install.bat".
echo.
pause
exit /b 1
