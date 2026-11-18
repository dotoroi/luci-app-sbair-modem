[English](README.en.md) | [한국어](README.ko.md) | [日本語](README.md)

# SBA6 LuCI bootstrap (optional)

これは **純正 SoftBank Air 6 の vendor OpenWrt 21.02.7** で、vendor MT-WiFi 構成を残したまま LuCI 実行環境を追加する補助機能です。
`luci-app-sbair-modem` 本体の [../../install.sh](../../install.sh) とは独立しています。
Floop3本体はvendor MT-WiFi向けのvendor OpenWrt環境で使うもので、最新OpenWrtでは導入しません。bootstrapはFloop3本体とは別に、対象vendor環境にLuCIがない場合に限って使います。LuCIがすでに入っているvendor環境ではbootstrapを省略します。

このbootstrapはMT-WiFiドライバーを導入・修復・置換するものではありません。vendorの `libiwinfo.so.20230701` と `libnl-tiny.so.1` を保護し、LuCIに必要な別ABIを共存させる設計です。別のOpenWrt release / SNAPSHOTには固定済みpackage manifestが適合しないため適用しません。

## 標準操作

Mac/Linuxホストから、Air6の現在の管理IPを指定します。IPはスクリプトに
ハードコードされていません。

```sh
./extras/luci-bootstrap/install.sh root@<AIR6_IP>
```

AP化などで現在のIPが別の場合は、そのIPを使います。

```sh
./extras/luci-bootstrap/install.sh root@<AIR6_IP>
```

ホストが公式OpenWrt archiveから `packages.lock` の `.ipk` を取得し、SHA256を
検証してから、SSH経由で `/tmp/sba6-luci-bootstrap/` へ転送します。Air6側は
転送済みファイルだけを使うため、Air6自身のdefault route/DNS/Internet接続は
不要です。SSHで到達できることだけが必要です。

bootstrapにはOpenWrt標準LuCIの韓国語・日本語カタログ
(`luci-i18n-base-ko`, `luci-i18n-base-ja`)も固定版・SHA256付きで含まれます。
Floop3専用メニューの翻訳は別カタログです。アプリの `install.sh` が韓国語・日本語の
`.lmo` を配置し、English・한국어・日本語を言語選択肢に登録します。標準LuCIと
Floop3専用メニューは、それぞれ対応するカタログを使用します。
rootパスワードとHTTP/8080の注意事項は[インストール後のアクセス指針](../../docs/INSTALL-ACCESS-KO.md)を参照してください。

インストールは自動rebootしません。完了後に表示される現在のLAN IPへ、次のURLで
アクセスします。

```text
http://<current-LAN-IP>:8080/cgi-bin/luci/
```

再起動した後の確認：

```sh
./extras/luci-bootstrap/install.sh --check root@<AIR6_IP>
```

## モード

```sh
# 変更なしでSSH・platform・依存関係のdry-runまで行う
./extras/luci-bootstrap/install.sh --dry-run root@AIR6_IP

# read-onlyの状態確認。パッケージ取得や再起動はしない
./extras/luci-bootstrap/install.sh --check root@AIR6_IP

# パッケージを再導入せず、uhttpd/firewall/rpcd cache/autostartだけ修復
./extras/luci-bootstrap/install.sh --repair root@AIR6_IP
```

パッケージは `SBA6_LUCI_CACHE_DIR` で指定したディレクトリにキャッシュできます。
既定値は `/tmp/sba6-luci-bootstrap-cache` です。

## 実装の境界

| ファイル | 実行場所 | 役割 |
| --- | --- | --- |
| `install.sh` | Mac/Linuxホスト | SSH確認、固定manifest取得、SHA256、転送、target実行 |
| `target.sh` | Air6 | preflight、backup、ローカルopkg、uhttpd、firewall、永続化 |
| `check.sh` | Air6 | read-onlyのpost-install/post-reboot検証 |
| `packages.lock` | ホスト/転送物 | OpenWrt 21.02.7 package URL、filename、SHA256、用途 |
| `docs/TROUBLESHOOTING.md` | 文書 | 到達性・起動・Firewallの切り分け |
| `docs/IP-MIGRATION.md` | 文書 | IP変更個体だけの任意修復 |

target側はBusyBox `/bin/sh`互換です。`install(1)`には依存しません。

## 安全上の方針

- 対象は OpenWrt 21.02.7、`gem6xxx/evb6990_cpe_mt7990_emmc`、
  `aarch64_cortex-a55_neon-vfpv4` のSBA6Dだけです。それ以外はabortします。
- `/etc/opkg/distfeeds.conf` は変更しません。`opkg update` と `opkg upgrade` も実行しません。
- vendorの `libnl-tiny.so.1` はopkgで置換しません。公式 `libnl-tiny1` を一時展開し、
  LuCI ABIテスト後に `/usr/lib/libnl-tiny.so` としてside-by-side配置します。
- vendorの `libiwinfo.so.20230701` を削除せず、公式側の `.20210430` と共存させます。
- 純正lighttpdのTCP/80は維持し、LuCIはuhttpdのTCP/8080だけを使います。
- Firewallは `br-lan` からのTCP/8080だけを許可し、WAN/5Gへは開けません。
- `/root/sba6-pre-luci-<timestamp>.<pid>/` に導入前の設定とpackage一覧を保存します。
- LAN IP、DHCP、gateway、DNS、SSH、OTA、純正WebUI、firmware flashは変更しません。
- `network.lan.ipaddr` とruntimeの `br-lan` IPが違う場合は、device sectionを推測削除せず停止します。

`.ipk` 自体はリポジトリへ同梱せず、公式OpenWrt archiveから取得します。固定URLと
hashだけを `packages.lock` で管理するため、vendor packageの再配布は行いません。


