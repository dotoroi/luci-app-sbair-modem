#!/bin/sh
set -eu

SELF=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
CR=$(printf '\r')

check_file() {
	file=$1
	if LC_ALL=C grep -Fq "$CR" "$file"; then
		echo "!! CR character found in line-oriented input: $file" >&2
		return 1
	fi
}

for file in \
	"$SELF/install.sh" "$SELF/build.sh" \
	"$SELF/extras/luci-bootstrap/packages.lock" \
	"$SELF"/tools/*.sh "$SELF"/extras/*/*.sh \
	"$SELF"/root/etc/init.d/* \
	"$SELF"/root/etc/uci-defaults/* \
	"$SELF"/root/etc/udhcpc.user.d/* \
	"$SELF"/root/usr/libexec/rpcd/* \
	"$SELF"/root/usr/libexec/sbair/netmode/*.sh \
	"$SELF"/root/usr/sbin/* \
	"$SELF"/root/usr/share/sbair/* \
	"$SELF"/out/i18n-stage/etc/init.d/* \
	"$SELF"/out/i18n-stage/etc/uci-defaults/* \
	"$SELF"/out/i18n-stage/etc/udhcpc.user.d/* \
	"$SELF"/out/i18n-stage/usr/libexec/rpcd/* \
	"$SELF"/out/i18n-stage/usr/libexec/sbair/netmode/*.sh \
	"$SELF"/out/i18n-stage/usr/sbin/* \
	"$SELF"/out/i18n-stage/usr/share/sbair/*
do
	[ -f "$file" ] || continue
	check_file "$file"
done

echo "Shell line endings: LF"
