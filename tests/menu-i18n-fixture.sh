#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
python3 - "$ROOT" <<'PY'
import ast
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
menu = json.loads((root / "root/usr/share/luci/menu.d/luci-app-sbair-modem.json").read_text(encoding="utf-8"))

def catalog(path):
    result = {}
    msgid = None
    msgstr = None
    target = None

    def flush():
        if msgid is not None and msgstr is not None:
            result[msgid] = msgstr

    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("msgid "):
            flush()
            msgid = ast.literal_eval(line[6:])
            msgstr = None
            target = "msgid"
        elif line.startswith("msgstr "):
            msgstr = ast.literal_eval(line[7:])
            target = "msgstr"
        elif line.startswith('"') and target == "msgid":
            msgid += ast.literal_eval(line)
        elif line.startswith('"') and target == "msgstr":
            msgstr += ast.literal_eval(line)
        elif not line.strip():
            flush()
            msgid = msgstr = target = None
    flush()
    return result

titles = sorted({entry["title"] for entry in menu.values()})
for language in ("ko", "ja"):
    translations = catalog(root / f"po/{language}/luci-app-sbair-modem.po")
    missing = [title for title in titles if not translations.get(title)]
    if missing:
        raise SystemExit(f"{language}: missing menu title translations: {missing}")
    print(f"{language}: {len(titles)} menu title keys translated")
PY
