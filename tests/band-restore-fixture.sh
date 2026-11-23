#!/bin/sh
# Mock the modem and verify partial LTE/NR selections preserve the other mask.
set -eu

repo=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM
bin=$tmp/bin
mkdir -p "$bin"

cat > "$bin/uci" <<'EOF'
#!/bin/sh
case "${3:-}" in
	sbair.band.lte) printf '%s\n' "${TEST_LTE:-}" ;;
	sbair.band.nr) printf '%s\n' "${TEST_NR:-}" ;;
	*) exit 1 ;;
esac
EOF
cat > "$bin/logger" <<'EOF'
#!/bin/sh
for message do :; done
printf '%s\n' "$message"
EOF
cat > "$bin/sleep" <<'EOF'
#!/bin/sh
exit 0
EOF
cat > "$bin/sbair-modem" <<'EOF'
#!/bin/sh
cmd=
for arg in "$@"; do
	case "$arg" in AT+EPBSEH\?|AT+EPBSEH=*) cmd=$arg ;; esac
done
if [ "$cmd" = 'AT+EPBSEH?' ]; then
	IFS=, read -r gsm umts lte nr < "$TEST_MODEM_STATE"
	printf '+EPBSEH: "%s","%s","%s","%s"\n' "$gsm" "$umts" "$lte" "$nr"
	exit 0
fi
case "$cmd" in
	AT+EPBSEH=*)
		values=$(printf '%s\n' "${cmd#AT+EPBSEH=}" | tr -d '" ')
		printf '%s\n' "$values" > "$TEST_MODEM_STATE"
		printf 'OK\n'
		;;
	*) exit 2 ;;
esac
EOF
chmod 755 "$bin"/*

state=$tmp/state
run_restore() {
	PATH="$bin:/usr/bin:/bin" \
	TEST_MODEM_STATE="$state" TEST_LTE="${TEST_LTE-}" TEST_NR="${TEST_NR-}" \
	AIR6_MODEM_BIN="$bin/sbair-modem" "$repo/root/usr/sbin/air6-band-restore"
}

# LTE only: preserve the current NR mask and GSM/UMTS masks.
printf '%s\n' '00000001,00000002,0000000000000000,000000000000000000000000' > "$state"
out=$(TEST_LTE=1,8 TEST_NR= run_restore)
printf '%s\n' "$out" | grep -q 'saved band masks active;'
[ "$(cat "$state")" = '00000001,00000002,0000008100000000,000000000000000000000000' ] || {
	echo 'LTE-only restore changed the wrong masks' >&2
	exit 1
}

# NR only: preserve the current LTE mask and GSM/UMTS masks.
printf '%s\n' '00000001,00000002,0000000000000000,000000000000000000000000' > "$state"
out=$(TEST_LTE= TEST_NR=77,78 run_restore)
printf '%s\n' "$out" | grep -q 'saved band masks active;'
[ "$(cat "$state")" = '00000001,00000002,0000000000000000,000000000000000000003000' ] || {
	echo 'NR-only restore changed the wrong masks' >&2
	exit 1
}

echo band-restore-fixture-ok
