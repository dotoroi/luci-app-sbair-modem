#!/bin/sh
# SPDX-License-Identifier: MIT
set -eu

repo=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$repo"
node - out/i18n/sbair-i18n.js <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.argv[2], 'utf8');
const tools = fs.readFileSync('htdocs/luci-static/resources/tools/sbair.js', 'utf8');
const views = fs.readdirSync('htdocs/luci-static/resources/view/sbair')
  .filter(name => name.endsWith('.js')).map(name => 'view/sbair/' + name);
for (const path of [...views, 'tools/sbair.js', 'protocol/ql_datacall.js']) {
  const js = fs.readFileSync('htdocs/luci-static/resources/' + path, 'utf8');
  assert.match(js, /'require tools\.sbair-i18n as i18n';[\s\S]*var _ = i18n\.translate;/, path);
}
function createLocale(lang) {
  return vm.runInNewContext('(function() {\n' + source + '\n})()', {
    document: { documentElement: { lang } },
    L: { Class: { extend: object => object } },
    _: () => { throw new Error('The global LuCI dictionary must not be used'); }
  });
}
const ko = createLocale('ko-KR');
const ja = createLocale('ja');
assert.equal(ko.translate('Connection mode'), '연결 모드');
assert.equal(ja.translate('Connection mode'), '接続モード');
assert.equal(createLocale('en').translate('Connection mode'), 'Connection mode');
assert.equal(createLocale('de').translate('Connection mode'), 'Connection mode');
assert.equal(ko.translate('constructor'), 'constructor');
const netmode = fs.readFileSync('htdocs/luci-static/resources/view/sbair/netmode.js', 'utf8');
const multiline = [...netmode.matchAll(/_\(("(?:\\.|[^"\\])*")\)/g)]
  .map(match => JSON.parse(match[1])).filter(key => key.includes('\n'));
assert.equal(multiline.length, 3);
for (const key of multiline) {
  assert.match(ko.translate(key), /[가-힣]/);
  assert.match(ja.translate(key), /[ぁ-んァ-ン]/);
  assert.equal(ko.translate(key).split('\n').length, key.split('\n').length);
}
const translator = vm.runInNewContext('(function() {\n' + tools + '\n})()', {
  baseclass: { extend: object => object },
  i18n: ko
});
assert.equal(translator.errorText(new Error('Unable to restart dnsmasq.')), 'dnsmasq를 다시 시작하지 못했습니다.');
assert.equal(translator.errorText(new Error('Unable to back up the configuration: /etc/config/dhcp')),
  '설정을 백업하지 못했습니다: /etc/config/dhcp');
console.log('i18n-fixture-ok');
NODE
