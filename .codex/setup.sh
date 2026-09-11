#!/usr/bin/env bash
# Run from the cloud task: bash .codex/setup.sh
# Installs render dependencies only; does not publish or modify content queues.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
node --version
npm ci --include=dev
npx --no-install playwright install --with-deps chromium
if ! command -v ffprobe >/dev/null 2>&1; then
  if [ "$(id -u)" -eq 0 ] && command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y ffmpeg
  elif command -v sudo >/dev/null 2>&1 && command -v apt-get >/dev/null 2>&1; then
    sudo -n apt-get update
    sudo -n apt-get install -y ffmpeg
  else
    printf '%s\n' 'Install ffprobe (the ffmpeg package), then rerun this setup.' >&2
    exit 1
  fi
fi
node -e 'const cp=require("child_process");const ff=require("ffmpeg-static");cp.execFileSync(ff,["-version"],{stdio:"ignore"});console.log("FFmpeg ready")'
ffprobe -v error -version
printf '%s\n' 'Cloud render dependencies are ready. Start with CLOUD-HANDOFF.md.'
