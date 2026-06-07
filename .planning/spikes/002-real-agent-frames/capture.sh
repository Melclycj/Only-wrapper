#!/usr/bin/env bash
# Capture real agent-TUI frames through the frame-stability recorder (Spike 002).
#
# Usage (run from a REAL project directory so claude has context):
#   cd ~/some-project
#   /path/to/.planning/spikes/002-real-agent-frames/capture.sh claude   claude --rc
#   /path/to/.planning/spikes/002-real-agent-frames/capture.sh vim      vim
#   /path/to/.planning/spikes/002-real-agent-frames/capture.sh ssh      ssh user@host
#   /path/to/.planning/spikes/002-real-agent-frames/capture.sh repl     python3
#
# Drive the tool normally. For claude: ask it to do something that ends in a
# confirmation (e.g. "run git status and tell me what changed"), let it reach the
# y/N or numbered menu, WAIT ~2s, then answer. Exit the tool (Ctrl-D / :q / exit)
# to end the capture. The per-tick log + an end-of-run timeline are written to
# capture-<label>.jsonl in this directory.
set -euo pipefail
LABEL="${1:?usage: ./capture.sh <label> <command...>}"; shift
HERE="$(cd "$(dirname "$0")" && pwd)"
REC="$HERE/../001-frame-stability-mechanism/record.cjs"
echo "▶ recording '$*' (label=$LABEL) — drive it, reach a waiting prompt, then exit the tool"
LOG="$HERE/capture-$LABEL.jsonl" node "$REC" -- "$@"
echo "✓ log: $HERE/capture-$LABEL.jsonl"
