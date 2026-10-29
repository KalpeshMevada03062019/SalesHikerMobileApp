# Setup

How to set up this framework on a Windows machine without Android Studio. Every command below is PowerShell. On this workstation all of it is already done; see `docs\ENVIRONMENT_AUDIT.md`.

Run `.\scripts\doctor.ps1` first. It tells you which of the steps below you still need.

## 1. Java 17+

Any JDK 17 or newer (Temurin, Oracle, Microsoft). Set `JAVA_HOME` to its folder and check:

```powershell
java -version
```

> With a single-number JDK version (for example 27), the `sdkmanager` and `avdmanager` launchers wrongly say "Java version 17 or higher is required". Set `$env:SKIP_JDK_VERSION_CHECK='1'` before calling them; the framework scripts do this for you.

## 2. Android SDK command-line tools

1. Download "Command line tools only" for Windows from https://developer.android.com/studio and verify the SHA-256 shown on that page.
2. Extract it so the layout is `%ANDROID_HOME%\cmdline-tools\latest\bin\sdkmanager.bat`. The `latest` folder name matters.
3. Set `ANDROID_HOME` (user scope) and add the tool folders to the user PATH:

```powershell
[Environment]::SetEnvironmentVariable('ANDROID_HOME', "$env:LOCALAPPDATA\Android\Sdk", 'User')
$p = [Environment]::GetEnvironmentVariable('Path', 'User')
foreach ($d in "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin", "$env:LOCALAPPDATA\Android\Sdk\platform-tools", "$env:LOCALAPPDATA\Android\Sdk\emulator") {
    if (($p -split ';') -notcontains $d) { $p = $p.TrimEnd(';') + ';' + $d }
}
[Environment]::SetEnvironmentVariable('Path', $p, 'User')
```

Do not use `setx PATH "%PATH%;..."`: it truncates PATH at 1024 characters.

## 3. Platform-tools, emulator and a system image

The next command downloads about 1.5 GB and asks you to accept the Android SDK licence:

```powershell
$env:SKIP_JDK_VERSION_CHECK = '1'
sdkmanager "platform-tools" "emulator" "build-tools;36.0.0" "system-images;android-35;google_apis;x86_64"
```

Hardware acceleration must be available:

```powershell
emulator -accel-check     # expect: "WHPX ... is installed and usable"
```

If it is not, enable virtualization in the BIOS and the Windows feature "Windows Hypervisor Platform". Both need administrator rights and a reboot.

## 4. AVD

Put the image and device in `config\.env` (`AVD_NAME`, `AVD_DEVICE`, `AVD_SYSTEM_IMAGE`, optionally `AVD_DIR`), then:

```powershell
.\scripts\start-emulator.ps1
```

The script creates the AVD with `avdmanager` if it is missing, applies `AVD_CORES`, `AVD_RAM_MB` and `AVD_GPU_MODE`, makes sure the adb public key exists, opens a visible emulator window, waits for a full boot and disables animations.

## 5. Maestro CLI

Official instructions: https://docs.maestro.dev/getting-started/installing-maestro/windows

```powershell
$dl = "$env:USERPROFILE\Downloads\maestro.zip"
curl.exe -sSL -o $dl https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip
# compare with checksums_sha256.txt from the same release
Get-FileHash $dl -Algorithm SHA256
Expand-Archive $dl "$env:USERPROFILE\maestro-tmp"; Move-Item "$env:USERPROFILE\maestro-tmp\maestro" "$env:USERPROFILE\maestro"
# then add %USERPROFILE%\maestro\bin to the user PATH as in step 2
maestro --version
```

## 6. Maestro MCP for Claude Code

The official command is `claude mcp add maestro -- maestro mcp`. On Windows `maestro` is a `.bat` file, so Claude Code must start it through `cmd /c`. This repo registers a small launcher that finds Maestro even when PATH has not been refreshed:

```powershell
claude mcp add maestro --scope project -- cmd /c scripts\maestro-mcp.cmd
```

This writes `.mcp.json`, which is already committed. Restart Claude Code in the project folder and approve the `maestro` server when asked. Then check:

```powershell
claude mcp list      # maestro: ... Connected
```

## 7. Project configuration

```powershell
Copy-Item config\.env.example config\.env     # then edit APK_PATH, TEST_USERNAME, TEST_PASSWORD
.\scripts\doctor.ps1
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `adb devices` shows `unauthorized` | `%USERPROFILE%\.android\adbkey.pub` is missing. `start-emulator.ps1` recreates it; restart the emulator |
| Emulator boots but everything ANRs | Raise `AVD_CORES` / `AVD_RAM_MB`, close other heavy apps, and prefer a `google_apis` image over `google_apis_playstore` |
| SystemUI keeps crashing, or a cold boot never comes online | `.\scripts\stop-emulator.ps1; .\scripts\start-emulator.ps1 -WipeData`, then reinstall the APK |
| Black emulator window | Set `AVD_GPU_MODE=swiftshader_indirect` |
| "Maestro Android driver did not start up in time" | The scripts already wait 180 s (`MAESTRO_DRIVER_STARTUP_TIMEOUT`); retry once the device is idle |
| `maestro` not found in an old terminal or editor | Open a new terminal. VS Code must be fully restarted to pick up the new PATH |
