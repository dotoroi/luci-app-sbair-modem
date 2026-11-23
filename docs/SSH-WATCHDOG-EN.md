[English](SSH-WATCHDOG-EN.md) | [한국어](SSH-WATCHDOG-KO.md) | [日本語](SSH-WATCHDOG-JA.md)

# Air6 SSH Watchdog and Modem Band Restore

## SSH watchdog

`air6-ssh-watchdog` monitors the existing vendor Dropbear path and repairs only the documented management LAN route.

- Every 15 seconds it checks the IPv4 address on `br-lan`, the TCP/22 listener, and `input_lan_drop_rule`.
- The current build is scoped to PC `192.168.3.240/32` and a router address in `192.168.3.0/24`.
- It restores only the PC-to-router TCP/22 exception when missing.
- If Dropbear is not listening, it invokes `/etc/init.d/zzzz_air6_dropbear start`.
- It does not open WAN SSH, allow other clients, or change password policy.

### Start and check

`install.sh /` places files and boot links but does not start services already running. On a live device, keep the current SSH session open and run:

```sh
/etc/init.d/zzzzz_air6_ssh_watchdog start
/usr/bin/air6-ssh-watchdog --check
/etc/init.d/zzzzz_air6_ssh_watchdog status
```

Review `br-lan`, the source IP, firewall chain, and vendor Dropbear recovery script before using this on a different LAN layout. The watchdog fails closed if the expected chain is missing.

### Rollback

```sh
/etc/init.d/zzzzz_air6_ssh_watchdog stop
/etc/init.d/zzzzz_air6_ssh_watchdog disable
rm -f /etc/rc.d/S99zzzzz_air6_ssh_watchdog /etc/rc.d/K01zzzzz_air6_ssh_watchdog
rm -f /etc/init.d/zzzzz_air6_ssh_watchdog /usr/bin/air6-ssh-watchdog
```

Do not remove the vendor `/etc/init.d/zzzz_air6_dropbear` service or its boot link.

## Saved modem band restore

`AT+EPBSEH=` LTE/NR masks can revert after modem restart or delayed initialization. When `sbair.band.lte` and `.nr` are saved, `S95sbair-apn` starts `air6-band-restore` after the ordinary APN apply path. The helper changes only LTE/NR masks and preserves current GSM/UMTS masks. It does not invoke the broader `sbair-modem boot` workflow, which may also apply APN, SIM-lock, IMS, and SMS-notification settings.

The helper waits for the modem AT service and monitors the masks for up to 120 seconds, exiting after the saved masks remain stable for 45 seconds. Check its `air6-band-restore` syslog tag.

```sh
uci show sbair.band
/usr/sbin/air6-band-restore
/usr/bin/sbair-modem at -t 5 -r 'AT+EPBSEH?'
```

Applying masks can trigger a cellular rescan and briefly interrupt mobile data. A matching mask does not guarantee network registration or data connectivity. Confirm startup behavior on the target firmware after reboot.
