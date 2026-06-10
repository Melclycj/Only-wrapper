#!/usr/bin/env bash
SP='|/-\'
# Phase A: ~2.5s of continuous repaint (spinner + ticking seconds) on one line
for i in $(seq 1 25); do
  printf '\r\033[2K\xe2\x9c\xbb Thinking (%ds) %s' "$((i/10))" "${SP:$((i%4)):1}"
  sleep 0.1
done
# Phase B: settle ~1.8s on a Claude-style confirmation menu
printf '\r\033[2K\n\n'
printf 'Do you want to proceed?\n'
printf '\xe2\x9d\xaf 1. Yes\n'
printf '  2. No\n\n'
printf 'Esc to cancel \xc2\xb7 Tab to amend \xc2\xb7 ctrl+e to explain\n'
sleep 1.8
# Phase C: settle ~1.5s on a bare shell prompt
printf '\n(base) user@host ~/project %% '
sleep 1.5
