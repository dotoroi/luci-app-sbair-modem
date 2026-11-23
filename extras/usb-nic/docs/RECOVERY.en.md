# USB NIC gadget recovery

[English](RECOVERY.en.md) | [한국어](RECOVERY.ko.md) | [日本語](RECOVERY.md)

This feature changes USB UDC/ConfigFS ownership. Never enable it without an independent LAN or Wi-Fi management path. Losing the USB connection alone does not prove failure; check status through the independent management path.

## First steps

```sh
/usr/sbin/sbair-usb-nic status
/usr/sbin/sbair-usb-nic preflight
```

If needed, run this through independent SSH/UART:

```sh
/usr/sbin/sbair-usb-nic disable
```

Disable unbinds/cleans only the exact app-owned gadget topology. If unknown ConfigFS objects, vendor gadget functions, or unexpected UDC bindings exist, it stops with `rollback-required` and does not delete them. It never force-unloads the module. Do not use a blind reboot or blindly rerun the vendor USB init script as recovery.

## If manual recovery is needed

From the independent management path, preserve the snapshot path reported by `status`. It stores the pre-enable ConfigFS and UDC baseline with root-only access. If the baseline cannot be reconstructed exactly, leave the UDC unbound; do not guess the vendor topology. Follow upstream [RECOVERY.md](https://github.com/Karin-Laboratory/sbat6-usb-nic/blob/main/docs/RECOVERY.md) and the device-specific UART procedure for vendor gadget recovery.

This bundle does not restore factory state or recover firmware. Reset, `firstboot`, and firmware flashing are not automatic recovery actions for this feature.
