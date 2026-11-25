@echo off
rem Keep the Tally live sync running on this Windows PC. It starts by itself
rem when you log in, runs hidden, and needs no Administrator rights.
rem Run "node tally-sync.mjs setup" first (it saves the website address and sync key).
rem   install-windows.cmd          install / update
rem   install-windows.cmd remove   stop and remove
where node >nul 2>&1 || (echo Node.js is not installed. Get it from https://nodejs.org & exit /b 1)
if /I "%1"=="remove" (
  node "%~dp0tally-sync.mjs" uninstall
) else (
  node "%~dp0tally-sync.mjs" install
)
