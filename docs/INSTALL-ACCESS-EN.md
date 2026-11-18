# Login and password guidance after installation

[English](INSTALL-ACCESS-EN.md) | [한국어](INSTALL-ACCESS-KO.md) | [日本語](INSTALL-ACCESS-JA.md)

## Account behavior

- The bootstrap and Floop3 installers do not create or change the `root` password. Existing root credentials remain unchanged.
- LuCI uses the Linux `root` account; there is no separate Floop3 password. SSH password authentication uses the same root password when enabled by device policy.
- Selecting `en`, `ko`, or `ja` under Language and Style changes only the display language. It does not create an account or credentials.
- If root has no password, set one before exposing the management UI on a network. Check stock SoftBank firmware separately; installers do not infer or overwrite its account state.

## Recommended settings

1. First open LuCI only from a trusted wired LAN or private Wi-Fi network.
2. Set a long, unique root password. Do not reuse passwords from other devices, Wi-Fi, or email, and do not store it in source trees, logs, or installation reports. A passphrase of at least 16 characters is recommended.
3. If available, use **System → Administration → Router Password**, or run `passwd` from an authenticated SSH/UART root shell.
4. If SSH password login is unnecessary, use SSH public-key authentication and disable password login according to device policy.
5. Do not expose TCP/8080 directly to the public WAN. Bootstrap serves LuCI at `http://<LAN-IP>:8080/` and permits LAN bridge input only in the firewall. This HTTP connection is not encrypted; an attacker on the same network could observe credentials or session data. Use only trusted networks. For remote administration, use a VPN or separately verified HTTPS endpoint.

## Verify the installation

- Confirm the existing root password still works. The installer neither displays nor resets credentials.
- Confirm English, 한국어, and 日本語 appear under Language and Style.
- Check that both standard LuCI screens and Floop3 menus are translated. Their catalogs are separate.
- Log out of any existing browser session and sign in again to confirm language and authentication behavior.

