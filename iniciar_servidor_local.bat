@echo off
title Servidor Local - Tickets HIT PCI
echo ======================================================================
echo    INICIANDO SERVIDOR LOCAL PARA TICKETS Y TURNOS HIT (OPERACION PCI)
echo ======================================================================
echo.
echo 1. Abriendo tu navegador en http://localhost:8000 ...
start http://localhost:8000
echo 2. Servidor activo en puerto 8000.
echo    (Para detener el servidor, simplemente cierra esta ventana)
echo.
"C:\Users\PCI\AppData\Local\Programs\Python\Python312\python.exe" -m http.server 8000
pause
