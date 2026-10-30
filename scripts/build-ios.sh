#!/usr/bin/env bash
# SmartWatt - Native iOS App Build Script
set -e

echo "=== Building SmartWatt Native iOS App ==="
cd "$(dirname "$0")/../ios"

xcodebuild clean build \
  -project SmartWatt.xcodeproj \
  -scheme SmartWatt \
  -configuration Release \
  -destination "generic/platform=iOS" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY=""

echo "=== Build Complete! App bundle located in DerivedData ==="
