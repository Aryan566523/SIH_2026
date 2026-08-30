@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo          ChainSentinel AI - Setup ^& Installer
echo =======================================================
echo.

set "PATH=%APPDATA%\npm;%ProgramFiles%\nodejs;%PATH%"

echo [*] Checking Node.js installation...
where node >nul 2>&1
if errorlevel 1 goto NO_NODE

for /f "delims=" %%i in ('node -v') do set "NODE_VER=%%i"
echo [OK] Node.js is installed: %NODE_VER%
echo.

echo [*] Checking pnpm installation...
where pnpm >nul 2>&1
if errorlevel 1 goto INSTALL_PNPM

for /f "delims=" %%i in ('pnpm -v') do set "PNPM_VER=%%i"
echo [OK] pnpm is installed: %PNPM_VER%
goto CHECK_ENV

:INSTALL_PNPM
echo [!] pnpm not found in PATH. Installing pnpm globally via npm...
call npm install -g pnpm@8.15.0
if errorlevel 1 goto PNPM_FAIL
echo [OK] pnpm installed successfully!
echo.

:CHECK_ENV
echo [*] Checking environment configuration...
if not exist ".env" (
    if exist ".env.example" (
        echo [*] Creating .env from .env.example...
        copy /y ".env.example" ".env" >nul
        echo [OK] .env file created from .env.example.
    ) else (
        echo [!] Creating default .env file...
        (
            echo NODE_ENV=development
            echo API_PORT=3001
            echo FRONTEND_URL=http://localhost:3000
            echo NEXT_PUBLIC_API_URL=http://localhost:3001
            echo DATABASE_URL=postgresql://chainsentinel:chainsentinel_dev_2026@localhost:5432/chainsentinel
            echo NEO4J_URI=bolt://localhost:7687
            echo NEO4J_USER=neo4j
            echo NEO4J_PASSWORD=chainsentinel_dev_2026
            echo REDIS_URL=redis://localhost:6379
            echo JWT_SECRET=super_secret_jwt_chainsentinel_dev_2026_key_for_development
            echo JWT_EXPIRATION=15m
            echo JWT_REFRESH_SECRET=super_secret_refresh_jwt_chainsentinel_dev_2026_key_for_development
            echo JWT_REFRESH_EXPIRATION=7d
        ) > ".env"
        echo [OK] Default .env created.
    )
) else (
    echo [OK] .env file already exists.
)
echo.

echo [*] Installing project dependencies with pnpm...
call pnpm install
if errorlevel 1 goto PNPM_INSTALL_FAIL
echo [OK] Dependencies installed successfully.
echo.

echo [*] Building shared workspace packages...
call pnpm --filter @chainsentinel/types build
if errorlevel 1 goto BUILD_TYPES_FAIL
echo [OK] Shared packages built successfully.
echo.

echo =======================================================
echo     Installation and setup completed successfully!
echo     You can now start the project by running: run.bat
echo =======================================================
echo.
pause
exit /b 0

:NO_NODE
echo.
echo =======================================================
echo [ERROR] Node.js is not installed or not found in PATH.
echo =======================================================
echo Please install Node.js v18 or higher from https://nodejs.org/
echo.
pause
exit /b 1

:PNPM_FAIL
echo.
echo =======================================================
echo [ERROR] Failed to install pnpm globally.
echo =======================================================
echo Please try running: npm install -g pnpm
echo.
pause
exit /b 1

:PNPM_INSTALL_FAIL
echo.
echo =======================================================
echo [ERROR] Dependency installation failed!
echo =======================================================
echo Please check your internet connection or package permissions.
echo.
pause
exit /b 1

:BUILD_TYPES_FAIL
echo.
echo =======================================================
echo [ERROR] Failed to build shared package @chainsentinel/types.
echo =======================================================
echo.
pause
exit /b 1
