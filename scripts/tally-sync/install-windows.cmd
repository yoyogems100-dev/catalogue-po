@echo off
rem Keep the Tally live sync running on this Windows PC: starts when you log in.
rem Run "node tally-sync.mjs setup" first (it saves the website address and sync key).
rem   install-windows.cmd          install / update
rem   install-windows.cmd remove   stop and remove
set TASK=YOYO Tally Sync
set DIR=%USERPROFILE%\yoyo-tally-sync

if /I "%1"=="remove" (
  schtasks /End /TN "%TASK%" >nul 2>&1
  schtasks /Delete /TN "%TASK%" /F
  echo Tally sync removed.
  exit /b 0
)

if not exist "%USERPROFILE%\.yoyo-tally-sync.json" (
  echo Run "node tally-sync.mjs setup" first.
  exit /b 1
)
where node >nul 2>&1 || (echo Node.js is not installed. Get it from https://nodejs.org & exit /b 1)

if not exist "%DIR%" mkdir "%DIR%"
copy /Y "%~dp0tally-sync.mjs" "%DIR%\tally-sync.mjs" >nul
> "%DIR%\run.cmd" echo @echo off
>> "%DIR%\run.cmd" echo node "%DIR%\tally-sync.mjs" ^>^> "%DIR%\sync.log" 2^>^&1

schtasks /Create /TN "%TASK%" /TR "\"%DIR%\run.cmd\"" /SC ONLOGON /RL LIMITED /F
schtasks /Run /TN "%TASK%"
echo Tally sync is running. Log: %DIR%\sync.log
