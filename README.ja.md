# Floop3 for SoftBank Air 6

[English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

Floop3は、**SoftBank Air 6（RG620T-SBK / RUDOLF / SBA6D）**向けのLuCIアプリです。モデム、SIM/eSIM、SMS、Wi-Fi、接続端末、ネットワーク設定を管理します。

## インストール前に

- 対象はメーカー版 **OpenWrt 21.02.7**、target `gem6xxx/evb6990_cpe_mt7990_emmc`、ARM64です。一般のupstream OpenWrt向けではありません。
- [ファームウェア互換性](docs/FIRMWARE-COMPATIBILITY-JA.md)を確認してください。メタデータが一致しても、全機能の動作を保証するものではありません。
- 設定をバックアップし、SSHまたはUARTの復旧経路を確保してください。インストーラーは`rpcd`を再起動しますが、ルーターは再起動しません。
- リリースのチェックサムと`install.sh --check`を確認してください。機種・既存ファイル所有権・保留中のfirewall変更・空き容量の検査を回避しないでください。

## はじめに

1. デバイスとソースに一致するタグ付きリリースを選びます。
2. [インストールガイド](docs/INSTALL-NON-CODEX-JA.md)と[アクセス設定](docs/INSTALL-ACCESS-JA.md)に従います。
3. Wi-Fi、ネットワークモード、USB NIC、復旧方法は[マニュアル一覧](docs/MANUALS.ja.md)を参照してください。

USB NIC機能は実験的で、アダプターとファームウェアに依存します。SSHとLuCIは信頼できるLAN内だけで利用し、インターネットへ直接公開しないでください。
