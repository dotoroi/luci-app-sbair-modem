#!/usr/bin/env python3
"""Portable LuCI language catalog validation (Python stdlib only).

Checks msgstr == msgid (with a reviewed technical-term exception list),
nonempty/nonfuzzy strings, message-ID parity, JS gettext literals, menu titles,
format tokens and leading/trailing join whitespace.
"""
from __future__ import annotations
import ast, collections, json, pathlib, re, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
PO=ROOT/'po'
EXCEPTIONS=ROOT/'tools/unchanged-technical-terms.txt'
MSG=re.compile(r'\b_\(\s*("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\')\s*\)',re.S)
FORMAT=re.compile(r'%(?:\([\w.]+\))?[-+#0 ]*(?:\d+|\*)?(?:\.\d+)?[diouxXeEfFgGcrs]|\{[a-zA-Z_]\w*\}')


def parse_po(path):
    entries={};fuzzy=set(); bad=[]
    for index, block in enumerate(path.read_text(encoding='utf-8').split('\n\n')):
        data={'id':[],'str':[]};mode=None
        for line in block.splitlines():
            if line.startswith('#,') and 'fuzzy' in line:
                flagged=True
            if line.startswith('msgid '):mode='id';part=line[6:]
            elif line.startswith('msgstr '):mode='str';part=line[7:]
            elif line.startswith('"') and mode:part=line
            elif line.startswith('msgid_plural') or line.startswith('msgctxt ') or line.startswith('msgstr['):
                raise ValueError(f'{path}: unsupported plural/context entry, use gettext for complex catalogs')
            else:continue
            try:data[mode].append(ast.literal_eval(part))
            except (SyntaxError,ValueError) as err:raise ValueError(f'{path}: {index}: {err}')
        if not data['id'] or not data['str']:continue
        key=''.join(data['id']); value=''.join(data['str'])
        if key in entries:bad.append(key)
        entries[key]=value
        if any(x.startswith('#,') and 'fuzzy' in x for x in block.splitlines()):fuzzy.add(key)
    if bad:raise ValueError(f'{path}: duplicate msgids: {bad}')
    return entries,fuzzy


def tokens(s):return collections.Counter(FORMAT.findall(s))

def check():
    issues=[]
    allowed={line for line in (x.strip() for x in EXCEPTIONS.read_text(encoding='utf-8').splitlines()) if line and not line.startswith('#')}
    catalogs={}; fuzzies={}
    for lang in ('en','ko','ja'):
        catalogs[lang],fuzzies[lang]=parse_po(PO/lang/'luci-app-sbair-modem.po')
        for key in sorted(fuzzies[lang]):issues.append(f'{lang} fuzzy: {key!r}')
    source=set(catalogs['en'])-set([''])
    for lang in ('ko','ja'):
        ids=set(catalogs[lang])-set([''])
        for k in sorted(source-ids):issues.append(f'{lang} missing msgid: {k!r}')
        for k in sorted(ids-source):issues.append(f'{lang} extra msgid: {k!r}')
        for k in sorted(ids&source):
            value=catalogs[lang][k]
            if not value:issues.append(f'{lang} empty msgstr: {k!r}')
            elif value==k and k not in allowed:issues.append(f'{lang} msgstr==msgid: {k!r}')
            if tokens(k)!=tokens(value):issues.append(f'{lang} format mismatch: {k!r}: {tokens(k)} != {tokens(value)}')
            if k[:1]==' ' and not value.startswith(' '):issues.append(f'{lang} initial space dropped: {k!r}')
            if k[-1:]==' ' and not value.endswith(' '):issues.append(f'{lang} trailing space dropped: {k!r}')
            if k[:1]=='\n' and not value.startswith('\n'):issues.append(f'{lang} initial newline dropped: {k!r}')
            if k[-1:]=='\n' and not value.endswith('\n'):issues.append(f'{lang} trailing newline dropped: {k!r}')
    for k in sorted(allowed):
        if k not in source:issues.append(f'unknown allowlisted msgid: {k!r}')
        elif len(k)>100:issues.append(f'overlong technical allowlist entry: {k!r}')
        elif not (k==catalogs['ko'].get(k) or k==catalogs['ja'].get(k)):
            issues.append(f'unnecessary allowlist entry: {k!r}')
    # Validate actual user-facing JS calls, rather than relying on an old CSV.
    static=set();jsfiles=list((ROOT/'htdocs/luci-static/resources').rglob('*.js'))
    for path in jsfiles:
        data=path.read_text(encoding='utf-8')
        for match in MSG.finditer(data):
            try: static.add(ast.literal_eval(match.group(1)))
            except (ValueError, SyntaxError):issues.append(f'bad JS gettext literal: {path}:{match.start()}')
    menu=json.loads((ROOT/'root/usr/share/luci/menu.d/luci-app-sbair-modem.json').read_text())
    for node in menu.values():
        if node.get('title'):static.add(node['title'])
    # Synthesize user-visible Go error / job / status IDs (parallel to the
    # xgettext helper in check-i18n.sh). JS can display these via errorText().
    go_messages=set()
    go_root=ROOT/'src/sbair-modem'
    error_value=re.compile(r'(?:"error"\s*:|out\["error"\]\s*=|out\["reason"\]\s*=)\s*("(?:\\.|[^"\\])*"|`[^`]*`)')
    for path in go_root.glob('*.go'):
        if path.name.endswith('_test.go'):continue
        for lineno,line in enumerate(path.read_text(encoding='utf-8').splitlines(),1):
            m=error_value.search(line)
            if m:
                literal=m.group(1)
                go_messages.add(ast.literal_eval(literal) if literal.startswith('"') else literal[1:-1])
            for m in re.finditer(r'\b(?:errors\.New|fmt\.Errorf)\(\s*("(?:\\.|[^"\\])*"|`[^`]*`)',line):
                literal=m.group(1)
                value=ast.literal_eval(literal) if literal.startswith('"') else literal[1:-1]
                if '%' not in value and (path.name=='pdu.go' or 'out["error"]' in line or 'out["reason"]' in line):go_messages.add(value)
            for m in re.finditer(r'\b(?:notes\s*=\s*append\(notes,|step\()\s*("(?:\\.|[^"\\])*"|`[^`]*`)',line):
                literal=m.group(1)
                go_messages.add(ast.literal_eval(literal) if literal.startswith('"') else literal[1:-1])
            if 'j.fail(' in line or 'j.done(' in line:
                for literal in re.findall(r'("(?:\\.|[^"\\])*"|`[^`]*`)',line):
                    value=ast.literal_eval(literal) if literal.startswith('"') else literal[1:-1]
                    if value and '%' not in value:go_messages.add(value)
    for key in sorted(go_messages-source):issues.append(f'Go backend message missing from catalog: {key!r}')
    for key in sorted(static-source):issues.append(f'gettext source missing from en/ko/ja catalogs: {key!r}')
    # We also prohibit format errors and record the exact number of static calls seen.
    for lang in ('ko','ja'):
        cnt=sum(k==v for k,v in catalogs[lang].items() if k)
        print(f'{lang}: {len(catalogs[lang])-1} messages, {cnt} approved unchanged terms, {len(catalogs[lang])-1-cnt} localized')
    print(f'JS/menu static gettext IDs: {len(static)} ({len(jsfiles)} JavaScript files); Go status/error IDs: {len(go_messages)}')
    if issues:
        print(f'FAILED: {len(issues)} catalog validation issue(s)',file=sys.stderr)
        for issue in issues[:100]:print(' - '+issue,file=sys.stderr)
        return 1
    print('PASS: KO/JA keys, technical exceptions, placeholders, join fragments and JS/menu literals')
    return 0
if __name__=='__main__':sys.exit(check())
