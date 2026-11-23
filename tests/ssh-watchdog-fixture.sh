#!/bin/sh
# Verify the watchdog exception remains pinned to the management PC and LAN IP.
set -eu

repo=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM
bin=$tmp/bin
mkdir -p "$bin"

cat > "$bin/ip" <<'EOF'
#!/bin/sh
printf '2: br-lan inet %s/24\n' "${TEST_ROUTER_IP:-192.168.3.1}"
EOF
cat > "$bin/iptables" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >> "$TEST_IPTABLES_LOG"
case "$1" in
	-nL) exit 0 ;;
	-C) [ "${TEST_RULE_EXISTS:-0}" = 1 ] ;;
	-I) exit 0 ;;
	*) exit 2 ;;
esac
EOF
cat > "$bin/netstat" <<'EOF'
#!/bin/sh
printf 'tcp 0 0 %s:22 0.0.0.0:* LISTEN\n' "${TEST_ROUTER_IP:-192.168.3.1}"
EOF
cat > "$bin/logger" <<'EOF'
#!/bin/sh
exit 0
EOF
chmod 755 "$bin"/*

export PATH="$bin:/usr/bin:/bin"
export TEST_IPTABLES_LOG="$tmp/iptables.log"
export TEST_ROUTER_IP=192.168.3.1

"$repo/root/usr/bin/air6-ssh-watchdog" --check
grep -Fxq -- '-nL input_lan_drop_rule' "$TEST_IPTABLES_LOG"
grep -Fxq -- '-C input_lan_drop_rule -s 192.168.3.240/32 -d 192.168.3.1/32 -p tcp --dport 22 -j RETURN' "$TEST_IPTABLES_LOG"
grep -Fxq -- '-I input_lan_drop_rule 1 -s 192.168.3.240/32 -d 192.168.3.1/32 -p tcp --dport 22 -j RETURN' "$TEST_IPTABLES_LOG"

: > "$TEST_IPTABLES_LOG"
if TEST_ROUTER_IP=10.0.0.1 "$repo/root/usr/bin/air6-ssh-watchdog" --check >/dev/null 2>&1; then
	echo 'watchdog accepted a non-management LAN address' >&2
	exit 1
fi
[ ! -s "$TEST_IPTABLES_LOG" ] || {
	echo 'watchdog changed firewall rules for a non-management LAN address' >&2
	exit 1
}

echo ssh-watchdog-fixture-ok
