#!/bin/sh
set -eu

SELF=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM

# Always validate full KO/JA content, including msgstr == msgid and static JS keys.
# The stdlib checker also works on hosts where gettext utilities are absent.
python3 "$SELF/tools/check-translations.py"

MISSING=""
for tool in xgettext msgcmp msgfmt msgattrib; do
	command -v "$tool" >/dev/null 2>&1 || MISSING="$MISSING $tool"
done
if [ -n "$MISSING" ]; then
	echo "gettext utilities unavailable ($MISSING); portable PO/JS check passed, upstream xgettext/msgcmp check skipped" >&2
	exit 0
fi

find "$SELF/htdocs/luci-static/resources" -type f -name '*.js' -print > "$TMP/sources"
python3 - "$SELF/root/usr/share/luci/menu.d/luci-app-sbair-modem.json" "$TMP/menu-titles.js" "$SELF/src/sbair-modem" "$TMP/backend-errors.js" <<'PY'
import ast
import json
import pathlib
import re
import sys

source, target, go_root, errors_target = sys.argv[1:]
menu = json.load(open(source, encoding="utf-8"))
with open(target, "w", encoding="utf-8") as out:
	for node in menu.values():
		title = node.get("title")
		if title:
			out.write("_(" + json.dumps(title, ensure_ascii=False) + ");\n")

error_value = re.compile(r'(?:"error"\s*:|out\["error"\]\s*=|out\["reason"\]\s*=)\s*("(?:\\.|[^"\\])*"|`[^`]*`)')
cjk = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]")
messages = set()
for path in pathlib.Path(go_root).glob("*.go"):
	if path.name.endswith("_test.go"):
		continue
	for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
		match = error_value.search(line)
		if not match:
			continue
		literal = match.group(1)
		value = ast.literal_eval(literal) if literal.startswith('"') else literal[1:-1]
		if cjk.search(value):
			raise SystemExit(f"{path}:{lineno}: user-visible backend error/reason must use an English message ID: {value}")
		messages.add(value)
		# These backend messages are rendered through sbair.errorText(), which
		# calls gettext at runtime. Synthesize the same IDs here so catalog drift
		# is caught even though xgettext cannot see Go string literals.
	for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
		for call in re.finditer(r'\b(?:errors\.New|fmt\.Errorf)\(\s*("(?:\\.|[^"\\])*"|`[^`]*`)', line):
			literal = call.group(1)
			value = ast.literal_eval(literal) if literal.startswith('"') else literal[1:-1]
			if "%" in value or (path.name != "pdu.go" and not ("out[\"error\"]" in line or "out[\"reason\"]" in line)):
				continue
			if cjk.search(value):
				raise SystemExit(f"{path}:{lineno}: user-visible backend error must use an English message ID: {value}")
			messages.add(value)
		for call in re.finditer(r'\b(?:notes\s*=\s*append\(notes,|step\()\s*("(?:\\.|[^"\\])*"|`[^`]*`)', line):
			literal = call.group(1)
			value = ast.literal_eval(literal) if literal.startswith('"') else literal[1:-1]
			if cjk.search(value):
				raise SystemExit(f"{path}:{lineno}: user-visible backend status must use an English message ID: {value}")
			messages.add(value)
		if "j.fail(" in line or "j.done(" in line:
			for literal in re.findall(r'("(?:\\.|[^"\\])*"|`[^`]*`)', line):
				value = ast.literal_eval(literal) if literal.startswith('"') else literal[1:-1]
				if "%" in value or not value:
					continue
				if cjk.search(value):
					raise SystemExit(f"{path}:{lineno}: user-visible job status must use an English message ID: {value}")
				messages.add(value)
with open(errors_target, "w", encoding="utf-8") as out:
	for message in sorted(messages):
		out.write("_(" + json.dumps(message, ensure_ascii=False) + ");\n")
PY
printf '%s\n' "$TMP/menu-titles.js" >> "$TMP/sources"
printf '%s\n' "$TMP/backend-errors.js" >> "$TMP/sources"
xgettext --language=JavaScript --keyword=_ --from-code=UTF-8 \
	--files-from="$TMP/sources" --output="$TMP/ui.pot"
[ -z "${I18N_TEMPLATE_OUT:-}" ] || cp "$TMP/ui.pot" "$I18N_TEMPLATE_OUT"

for lang in en ja ko; do
	po="$SELF/po/$lang/luci-app-sbair-modem.po"
	msgfmt --check -o /dev/null "$po"
	msgcmp "$po" "$TMP/ui.pot" 2>/dev/null
	for mode in --untranslated --only-fuzzy; do
		count=$(msgattrib "$mode" --no-wrap --no-location "$po" | awk '/^msgid / { n++ } END { print n+0 }')
		[ "$count" -le 1 ] || {
			echo "$lang catalog has untranslated or fuzzy entries ($mode): $count" >&2
			exit 1
		}
	done
done

echo "i18n checks passed: JS views, protocol, menu titles, and en/ja/ko catalogs"
