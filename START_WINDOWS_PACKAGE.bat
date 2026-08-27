@echo off
cd /d "%~dp0"
echo ==============================================
echo V360 MACHINE HEALTH - WINDOWS FINAL PACKAGE
echo ==============================================
echo 1. Open README
start "" "00_README_FIRST_WINDOWS.md"
echo 2. Open Machine Health generator
start "" "machine_health_generator\V360_Machine_Health_Audit_Generator_v1.0.0.html"
echo 3. For the tested direct-JSON viewer, run:
echo    integrated_direct_json_viewer\START_VIEWER_WINDOWS.bat
pause
