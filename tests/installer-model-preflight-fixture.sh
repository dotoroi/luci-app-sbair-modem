#!/bin/sh
# Ensure the live installer gates by Air 6 identity and runtime architecture,
# not by the KNOS/OpenWrt versions that happened to be available for analysis.
set -eu
repo=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
installer="$repo/install.sh"
grep -Fq 'INPUT_BASE_MODULE' "$installer"
grep -Fq 'INPUT_PROJECT' "$installer"
grep -Fq "= 'RG620TSBK'" "$installer"
grep -Fq "= 'RUDOLF'" "$installer"
grep -Fq '[ "$machine" = aarch64 ]' "$installer"
grep -Fq 'KNOS ${knos:-unknown}; OpenWrt' "$installer"
if grep -Eq '0\.09\.45\|1\.00\.22\|1\.01\.20\|1\.01\.44\|1\.01\.52|확인되지 않은 KNOS 버전' "$installer"; then
	echo 'installer still has a KNOS version allowlist' >&2
	exit 1
fi
echo installer-model-preflight-fixture-ok
