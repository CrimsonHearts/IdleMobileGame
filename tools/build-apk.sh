#!/usr/bin/env bash
# Build a correctly-signed release APK for Path to Immortality.
#
# WHY THIS EXISTS: `npx cap build android --keystore...` signs with the legacy
# v1 (JAR) scheme only. Android refuses to INSTALL a v1-only APK when
# targetSdk >= 30 ("App not installed"). This script signs with apksigner
# (v2 + v3), which is what modern Android requires.
#
# Usage:  bash tools/build-apk.sh
# Output: ~/Desktop/PathToImmortality.apk
set -euo pipefail

export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
BT="$ANDROID_HOME/build-tools/35.0.0"

KS="xianxia-release.keystore"
KS_PASS="CrimsonHearts@2026"
KS_ALIAS="xianxia"
OUT="$HOME/Desktop/PathToImmortality.apk"

cd "$(dirname "$0")/.."

echo "▸ Syncing web assets → Android …"
npx cap sync android

echo "▸ Gradle assembleRelease (unsigned) …"
( cd android && ./gradlew assembleRelease )

UNSIGNED="android/app/build/outputs/apk/release/app-release-unsigned.apk"

echo "▸ zipalign + apksigner (v2 + v3) …"
"$BT/zipalign" -f 4 "$UNSIGNED" /tmp/ptoi-aligned.apk
"$BT/apksigner" sign \
  --ks "$KS" --ks-pass "pass:$KS_PASS" \
  --ks-key-alias "$KS_ALIAS" --key-pass "pass:$KS_PASS" \
  --v2-signing-enabled true --v3-signing-enabled true \
  --out "$OUT" /tmp/ptoi-aligned.apk

echo "▸ Verifying …"
"$BT/apksigner" verify "$OUT" && echo "✅ Signature valid (v2+v3) — installable."
echo "✅ Done → $OUT  ($(du -h "$OUT" | cut -f1))"
