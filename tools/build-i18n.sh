#!/bin/sh
# Compile the app's LuCI gettext catalogs with OpenWrt's po2lmo utility.
set -eu
SELF=$(cd "$(dirname "$0")/.." && pwd)
OUT="$SELF/out/i18n"
PO2LMO=${PO2LMO:-}
PYTHON3=${PYTHON3:-python3}

command -v "$PYTHON3" >/dev/null 2>&1 || {
	echo "Python 3 command not found: $PYTHON3 (set PYTHON3=python if needed)" >&2
	exit 1
}

sh "$SELF/tools/check-i18n.sh"

if [ -z "$PO2LMO" ]; then
	PO2LMO=$(command -v po2lmo 2>/dev/null || true)
fi
if [ -z "$PO2LMO" ] && [ -n "${LUCI_ROOT:-}" ] && [ -x "$LUCI_ROOT/build/po2lmo" ]; then
	PO2LMO="$LUCI_ROOT/build/po2lmo"
fi
if [ -z "$PO2LMO" ]; then
	echo "po2lmo unavailable; using the bundled Python fallback for singular PO catalogs" >&2
	PO2LMO="$SELF/tools/po2lmo-fallback.py"
fi

mkdir -p "$OUT"

# English is the source language, so all msgstr values are identical to msgid.
# po2lmo intentionally emits no file when there are no translated entries;
# LuCI already renders the English message IDs directly.
for lang in ja ko; do
	if [ "$PO2LMO" = "$SELF/tools/po2lmo-fallback.py" ]; then
		"$PYTHON3" "$PO2LMO" "$SELF/po/$lang/luci-app-sbair-modem.po" "$OUT/luci-app-sbair-modem.$lang.lmo"
	else
		"$PO2LMO" "$SELF/po/$lang/luci-app-sbair-modem.po" "$OUT/luci-app-sbair-modem.$lang.lmo"
	fi
done
"$PYTHON3" "$SELF/tools/build-browser-i18n.py" "$OUT/sbair-i18n.js"
echo "built: $OUT/luci-app-sbair-modem.{ja,ko}.lmo (English uses the source message IDs)"
