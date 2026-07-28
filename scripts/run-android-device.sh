#!/usr/bin/env bash
set -euo pipefail

physical_devices=$(adb devices | tail -n +2 | grep -v '^$' | grep -v '^emulator-' | grep -w 'device' | cut -f1 || true)

if [ -z "$physical_devices" ]; then
  echo "error: no physical Android device connected (only emulators or none found)" >&2
  echo "connect a device via USB with USB debugging enabled and try again" >&2
  exit 1
fi

device_id=$(echo "$physical_devices" | head -n1)
exec npx expo run:android --device "$device_id"
