#!/usr/bin/env bash
# Build a debug APK, install it on a connected device/emulator, launch the
# app, and tail its logcat. For a signed release build use build-apk.sh.
#
# Usage:  bash tools/run-android.sh [--no-log]

set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

APP_ID="com.crimsonhearts.xianxiaidle"
TAIL_LOG=true
[[ "${1:-}" == "--no-log" ]] && TAIL_LOG=false

cd "$(dirname "$0")/.."

echo "▸ Checking for a connected device/emulator …"
DEVICE="$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
if [[ -z "$DEVICE" ]]; then
  echo "✗ No device/emulator found. Plug in a device (with USB debugging on)" \
       "or start one: \"\$ANDROID_HOME/emulator/emulator -avd <name>\"" >&2
  exit 1
fi
echo "  using $DEVICE"

echo "▸ Syncing web assets → Android …"
npx cap sync android

echo "▸ Gradle installDebug …"
( cd android && ./gradlew installDebug )

echo "▸ Launching app …"
adb -s "$DEVICE" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null

echo "✅ Running on $DEVICE"

if $TAIL_LOG; then
  echo "▸ Tailing logcat (Ctrl+C to stop) …"
  adb -s "$DEVICE" logcat --pid="$(adb -s "$DEVICE" shell pidof -s "$APP_ID")"
fi
