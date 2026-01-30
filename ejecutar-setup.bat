@echo off
REM =============================================
REM ZINERGIA - EJECUCIÓN AUTOMÁTICA SUPABASE
REM =============================================
REM Ejecutar este archivo .bat para Windows
REM =============================================

echo.
echo =============================================
echo   ZINERGIA - SETUP AUTOMÁTICO SUPABASE
echo =============================================
echo.

REM Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no está instalado
    echo Por favor, instala Node.js primero
    pause
    exit /b 1
)

echo [1/5] Verificando configuracion...
node -v
npm -v
echo.

REM Crear directorio de logs si no existe
if not exist "logs" mkdir logs

REM Fecha y hora para el log
set LOGFILE=logs\supabase-setup-%date:~-4,4%%date:~-7,2%%date:~-10,2%-%time:~0,2%%time:~3,2%%time:~6,2%.log
set LOGFILE=%LOGFILE: =0%

echo [2/5] Verificando conexion con Supabase...
echo.

npm run supabase:setup:check > %LOGFILE% 2>&1

if %ERRORLEVEL% EQU 0 (
    type %LOGFILE%
    echo.
    echo [OK] Supabase ya esta configurado correctamente
    echo.
    goto :END
)

echo [ATENCION] Supabase necesita configuracion
echo.
echo =============================================
echo   INSTRUCCIONES MANUALES
echo =============================================
echo.
echo 1. Abre tu navegador:
echo    https://jycwgzdrysesfcxgrxwg.supabase.co
echo.
echo 2. Inicia sesion
echo.
echo 3. SQL Editor ^> New query
echo.
echo 4. Abre este archivo en tu editor:
echo    supabase_fix_tarifas.sql
echo.
echo 5. Copia TODO el contenido
echo.
echo 6. Pegalo en el SQL Editor
echo.
echo 7. Haz clic en RUN (o Ctrl+Enter)
echo.
echo =============================================
echo.

pause

echo.
echo [3/5] Abriendo archivo SQL para ti...
echo.

REM Abrir el archivo SQL con el editor por defecto
start notepad supabase_fix_tarifas.sql

echo.
echo [4/5] Abriendo navegador en Supabase...
echo.

REM Abrir el navegador en Supabase
start https://jycwgzdrysesfcxgrxwg.supabase.co

echo.
echo [5/5] Esperando a que ejecutes el script...
echo.
echo Sigue las instrucciones en el navegador
echo Cuando termines, presiona cualquier tecla para verificar...
echo.

pause

echo.
echo =============================================
echo   VERIFICANDO CONFIGURACION
echo =============================================
echo.

npm run supabase:verify

echo.
echo =============================================
echo   PROCESO COMPLETADO
echo =============================================
echo.
echo Si ves checks en verde (PASS), todo esta correcto!
echo.
echo Para iniciar la aplicacion:
echo    npm run dev
echo.
echo Luego abre:
echo    http://localhost:3000/dashboard/simulator
echo.

pause

:END
echo.
echo =============================================
echo   SETUP COMPLETADO
echo =============================================
echo.
