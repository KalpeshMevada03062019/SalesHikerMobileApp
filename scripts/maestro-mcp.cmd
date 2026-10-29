@echo off
rem Starts the Maestro MCP server over stdio for Claude Code (registered in .mcp.json).
rem Resolves Maestro from PATH first, then from the default install folder, so it also
rem works in editor sessions started before Maestro was added to PATH.
rem Nothing may be written to stdout here except the MCP protocol itself.
set MAESTRO_CLI_NO_ANALYTICS=1
set MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
where maestro >nul 2>nul
if %errorlevel%==0 (
  maestro mcp
  exit /b %errorlevel%
)
if exist "%USERPROFILE%\maestro\bin\maestro.bat" (
  call "%USERPROFILE%\maestro\bin\maestro.bat" mcp
  exit /b %errorlevel%
)
echo Maestro CLI not found. Install it as described in docs\SETUP.md. 1>&2
exit /b 1
