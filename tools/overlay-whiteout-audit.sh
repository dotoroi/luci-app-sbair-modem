#!/bin/sh
# Read-only overlay/whiteout audit for SBA6D. Writes nothing to the device.
# AIR6_AUDIT_ROOT can point to an extracted/mounted root tree for offline review.
set -u

ROOT=${AIR6_AUDIT_ROOT:-}
path() {
    printf '%s%s' "$ROOT" "$1"
}

printf 'audit_time='; date '+%Y-%m-%dT%H:%M:%S%z' 2>&1
printf 'hostname='; hostname 2>&1 || true
printf 'kernel='; uname -a 2>&1 || true

echo '[overlay mounts]'
if command -v mount >/dev/null 2>&1; then
    mount 2>&1 | grep -E ' /overlay |overlayfs' || true
else
    echo 'mount command unavailable'
fi

echo '[character devices under overlay upper: candidate whiteouts]'
UPPER=$(path /overlay/upper)
if [ -d "$UPPER" ]; then
    find "$UPPER" -type c -exec ls -ln {} \; 2>&1
else
    echo "overlay upper directory not found: $UPPER"
fi

CORE_PATHS='/etc/rc.common
/etc/inittab
/etc/init.d/boot
/etc/init.d/network
/etc/init.d/knos_config'
echo '[core file visibility: merged root, rom, upper]'
printf '%s\n' "$CORE_PATHS" | while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    merged=$(path "$rel")
    rom=$(path "/rom$rel")
    upper=$(path "/overlay/upper$rel")
    echo "-- $rel"
    ls -ldn "$merged" "$rom" "$upper" 2>&1 || true
    if [ -e "$merged" ]; then result=0; else result=1; fi
    echo "merged_exists=$result"
    if [ -f "$rom" ]; then result=0; else result=1; fi
    echo "rom_regular_file=$result"
    if [ -e "$upper" ]; then result=0; else result=1; fi
    echo "upper_entry_exists=$result"
done

echo '[interpretation]'
echo 'Character-device entries in upper are candidates for overlay whiteouts; correlate exact path and device major/minor.'
echo 'These *_exists and rom_regular_file values are test exit statuses: 0 means yes, 1 means no.'
echo 'rom_regular_file=0 with merged_exists=1 means the ROM file exists but the merged path is absent; inspect the matching upper entry and boot logs.'
echo 'This audit does not remove markers or modify overlay contents.'
