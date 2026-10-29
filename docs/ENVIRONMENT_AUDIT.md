# Environment audit

Audited 2026-10-29 on the QA workstation. Re-run `.\scripts\doctor.ps1` any time for the current state.

## Host

| Item | Found | Assessment |
|---|---|---|
| OS | Windows 10 Pro 10.0.19045, 64-bit | Supported |
| CPU | Intel Core i5-7400 @ 3.0 GHz (4 cores, no Hyper-Threading) | Works, but it is the limiting factor for emulator speed |
| RAM | 15.9 GB total; 1.8 to 3.3 GB free while the emulator runs | Tight. The AVD is limited to 4 GB |
| Virtualization | Hyper-V hypervisor present. `emulator -accel-check`: **WHPX installed and usable** | OK. WMI reports `VirtualizationFirmwareEnabled=False` only because Hyper-V owns VT-x |
| Disk C: | 18.3 GB free at the start, 14.9 GB later | Low. AVD disk images were placed on D: |
| Disk D: | 669 GB free | Holds the project and the AVD (`D:\Android\avd`) |

## Tooling found before setup

| Component | Found | Action |
|---|---|---|
| Claude Code CLI | 2.1.312, logged in (claude.ai account) | Reused |
| Java | Oracle JDK 27 (`C:\Program Files\Java\jdk-27`), machine-level `JAVA_HOME` | Reused (meets 17+) |
| Node.js / npm | v24.19.0 / 11.17.0 | Reused (not needed by the framework) |
| Git | `C:\Program Files\Git` | Available. The project is not a git repository yet |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk`, user-level `ANDROID_HOME` | Reused |
| platform-tools / adb | 37.0.1 (adb 1.0.41) | Reused |
| Emulator | 37.2.12 | Reused |
| Build-tools | 36.0.0 (provides `aapt`) | Reused |
| Platform | android-37.0 | Reused |
| System image | `system-images;android-37.0;google_apis_playstore;x86_64` rev 8 | Reused at first; replaced as default (see "Emulator stability") |
| SDK licences | `android-sdk-license` already accepted | No licence prompt was needed for the existing packages |
| **cmdline-tools** (`sdkmanager`, `avdmanager`) | **missing** | Installed |
| AVDs | none | Created `SalesHiker_API37` |
| **Maestro CLI** | **missing** | Installed |
| Maestro MCP | not configured (only the Claude Docs connector) | Configured |
| Package managers | winget present; no choco or scoop | Not needed |

## Installed during setup

| Component | Source | Verification |
|---|---|---|
| Android command-line tools (`commandlinetools-win-15859902_latest.zip`) to `%ANDROID_HOME%\cmdline-tools\latest` | dl.google.com (official) | SHA-256 matched the developer.android.com value `90ae805d…fb04a`. `sdkmanager --version` returns 22.0 |
| Maestro CLI 2.12.0 to `%USERPROFILE%\maestro`, added to the **user** PATH | GitHub release `cli-2.12.0` (official) | SHA-256 matched `checksums_sha256.txt`. `maestro --version` returns 2.12.0 |
| AVD `SalesHiker_API37` (pixel_7, API 37 Play image, disks on `D:\Android\avd`) | `avdmanager` | Boots and runs the app |
| Maestro MCP (`.mcp.json`, project scope) | `claude mcp add maestro --scope project -- cmd /c scripts\maestro-mcp.cmd` | stdio handshake verified: 10 tools exposed; `list_devices` returned `emulator-5554` |
| System image `system-images;android-35;google_apis;x86_64` (approved by the user; SDK licence accepted) | `sdkmanager` (official Google repository) | `system.img` present |
| AVD `SalesHiker_API35` (pixel_7, disks on `D:\Android\avd`), **now the default** | `start-emulator.ps1` (`avdmanager`) | Booted Android 15. Smoke and regression passed with 0 ANRs and 0 crashes |

Nothing required administrator rights. No machine-level settings were changed; only the user PATH gained `%USERPROFILE%\maestro\bin`.

## Issues found and how they were resolved

| # | Issue | Evidence | Resolution |
|---|---|---|---|
| 1 | `sdkmanager` and `avdmanager` refuse JDK 27 ("Java version 17 or higher is required") | `avdmanager.bat` line 74 compares the single-number version `27` with `170` | Scripts set `SKIP_JDK_VERSION_CHECK=1`. The JDK itself is fine |
| 2 | First emulator boot showed the device as `unauthorized` | `%USERPROFILE%\.android\adbkey.pub` was missing (only `adbkey` existed) | Generated it with `adb pubkey`. `start-emulator.ps1` now does this automatically |
| 3 | ANR dialogs, first in system apps, then in SalesHiker | `am_anr` events for systemui, phone, gms and vending *before* the app was used. AVD defaults were 2 vCPU, 2 GB, software GPU | AVD hardware is configurable and applied on every start (4 vCPU, 4 GB, host GPU) |
| 4 | Maestro driver start-up timeout | "Maestro Android driver did not start up in time" | `MAESTRO_DRIVER_STARTUP_TIMEOUT=180000` set by the scripts |
| 5 | SystemUI crash loop on the API 37 Play image | Repeated SIGABRT: `Check failed: ... IsInDataSection ... SystemUIGoogle.apk`. Afterwards a cold boot never came online | Recovered with `-WipeData`. A lighter API 35 Google APIs image was approved and installed |
| 6 | `setx PATH "%PATH%;..."` (from the Maestro docs) would truncate PATH at 1024 characters and merge the machine PATH into the user PATH | Known `setx` behaviour | The user PATH was updated through .NET instead |

## Manual actions that may still be needed

- **Restart VS Code / Claude Code** so new processes see the updated PATH and load `.mcp.json`. On first start, approve the project MCP server `maestro`.
- Free space on C: if it falls below ~10 GB; the emulator writes temporary files there.
