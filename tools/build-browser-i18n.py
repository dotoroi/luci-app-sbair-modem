#!/usr/bin/env python3
"""Generate the Floop3 LuCI module from the same PO files as the menu catalogs."""
import json
import pathlib
import runpy
import sys


def main():
    tools = pathlib.Path(__file__).resolve().parent
    read_po = runpy.run_path(str(tools / "check-translations.py"))["parse_po"]
    catalogs = {}
    for lang in ("ko", "ja"):
        entries, fuzzy = read_po(tools.parent / "po" / lang / "luci-app-sbair-modem.po")
        if fuzzy:
            raise ValueError(f"{lang}: fuzzy translations are not ready to ship")
        catalogs[lang] = {key: value for key, value in entries.items() if key and value}
    output = pathlib.Path(sys.argv[1])
    output.parent.mkdir(parents=True, exist_ok=True)
    # Escape Unicode line separators for older browser parsers.
    encoded = json.dumps(catalogs, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    encoded = encoded.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    output.write_text(
        "'use strict';\n"
        "var catalogs = " + encoded + ";\n"
        "var language = (document.documentElement.lang || 'en').toLowerCase().split(/[-_]/)[0];\n"
        "if (language !== 'ko' && language !== 'ja') language = 'en';\n"
        "var catalog = catalogs[language];\n"
        "return L.Class.extend({\n"
        "    language: language,\n"
        "    translate: function(message) {\n"
        "        return catalog && Object.prototype.hasOwnProperty.call(catalog, message) ? catalog[message] : message;\n"
        "    }\n"
        "});\n",
        encoding="utf-8",
        newline="\n",
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: build-browser-i18n.py OUTPUT.js")
    main()
