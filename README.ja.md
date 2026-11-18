[English](README.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

# luci-app-sbair-modem

**SoftBank Air 6（RG620T-SBK / RUDOLF）のvendor OpenWrt向けLuCIアプリ**です。
モデムの状態表示、eSIM管理、SIMロック、APN、SMSの受信に加えて、
SoftBank Air 6のAP / Bridgeおよびeth1有線WANルーターモードを扱います。
導入対象はvendor OpenWrt 21.02.7で、vendor MT-WiFi構成に対応する管理・補助機能が必要な場合です。
最新OpenWrtを使う場合はFloop3を導入しない運用を基本とします。

## LuCI language catalogs

English source messages and Japanese and Korean gettext catalogs are under `po/`. Compile the translated catalogs
with LuCI's `po2lmo` using `PO2LMO=/path/to/po2lmo ./tools/build-i18n.sh` (or
`LUCI_ROOT=/path/to/luci ./tools/build-i18n.sh`), then run `install.sh` against
a rootfs tree to stage the catalogs. English uses the source message IDs and needs no `.lmo`; installation stops if either translated catalog is missing.
The live-device installer registers `en`, `ja` and `ko` in Language and Style
immediately, preserving the current selection; image/tree installs register
them on first boot through uci-defaults. All dedicated LuCI views and menu
labels use English gettext message IDs with English, Japanese and Korean
catalogs. The optional SBA6 LuCI bootstrap also installs the standard LuCI
`luci-i18n-base-ja` and `luci-i18n-base-ko` packages. Dynamic modem and firmware
diagnostics may still contain vendor-provided text returned by the backend
rather than rendered from static UI strings.

インストール後のroot/LuCIパスワードの扱い、HTTP/8080の制限、初回確認は
[韓国語のアクセス・パスワード指針](docs/INSTALL-ACCESS-KO.md)を参照してください。

Codexを使わず一般のLinux/macOS/WSLからビルド・SSH配備する手順は
[Codexなしのインストール手順](docs/INSTALL-NON-CODEX-KO.md)を参照してください。

---

## 対象と前提

| | |
|---|---|
| 機体 | SoftBank Air 6 / RG620T-SBK（MediaTek MT6990 + MD800内蔵モデム） |
| 対象OS | OpenWrt 21.02.7（ベンダー改造版。最新OpenWrt向けではない） |
| ATの入口 | **`/dev/adb_atci_socket`**（`atcid`がlistenするUNIXソケット） |
| SIM | 物理スロット1 + 内蔵eSIM 1。**同時に有効にできるのは1つ**（`AT+ESIMMAP?`） |
| 搭載されていないもの | `ttyUSB*` / `cdc-wdm*` / `qmi_wwan` / `cdc_mbim` |

---

## 画面

`admin/sbair`の下に5つの機能領域があります。モバイル回線、Wi-Fi、ネットワーク、本体には
LuCI標準の子画面があります。

| | |
|---|---|
| **モバイル回線** | **状態**（回線概要 / 電波 / バンド / IMS / 詳細操作）、**SIM / eSIM**、**SMS**を子画面に分離 |
| **Wi-Fi** | **基本設定**（SSID / Radio / 適用）、**詳細設定**（無線出力 / Steering / Isolation / 11r / MACフィルタ / WPS）、**診断**（UCI / vendor persistent / runtime / Known-good）を子画面に分離 |
| **接続機器** | 有線・無線端末の一覧、メモ、ポートスキャン、一時切断、端末ごとの広告ブロックを1画面で管理 |
| **ネットワーク** | **接続モード**（AP / Bridge・eth1有線WANルーター・未管理・Safe Apply）、**LANサービス**（LAN DHCPサーバー）、**診断**（Bridge / NIC / USB Ethernet候補）を子画面に分離 |
| **本体** | **本体情報**（機種 / ファームウェア / IMEI / 温度）、**USB機器**、**アップデート管理**（OTA / FOTA）を子画面に分離 |

**識別子（IMEI / IMSI / ICCID / EID / Cell ID / 電話番号 / SMSの送信者）は、既定では伏せて表示します。**
チェックボックスで表示／非表示を切り替えられます。

---

## 構成

```
luci-app-sbair-modem/
├── root/usr/libexec/rpcd/sbair        rpcdの入口（2行。中身はsbair-modem rpcd）
├── root/usr/sbin/sbair-netmode        AP / Bridge設定・状態監視・復旧CLI
├── root/usr/sbin/sbair-maintenance    LAN DHCPサーバー / OTA保守CLI
├── root/usr/sbin/sbair-usb-nic        任意のUSB CDC-NCM gadget安全ゲート
├── root/usr/sbin/sbair-netfix         15秒周期でvendor設定を補正するデーモン
├── root/usr/sbin/sbair-wifidrift      Wi-Fiの差分を監視する軽量ポーリングデーモン
├── root/usr/share/sbair/firewall.include AP時のDHCPパケットガード用fw3 include
├── root/usr/share/rpcd/acl.d/         ACL
├── root/usr/share/luci/menu.d/        メニュー
├── htdocs/luci-static/resources/
│   ├── tools/sbair.js                 タブ共通のUIヘルパー
│   ├── protocol/ql_datacall.js        Network → InterfacesでWANを扱えるようにする
│   └── view/sbair/*.js                機能領域ごとのLuCI view
├── root/etc/init.d/sbair-apn          起動時にAPNを設定し、AT+CNMIを再設定する
├── src/sbair-modem/                   バックエンド（Go）
└── docs/API.md                        ubus APIとLuCI画面（SMS / IMS / バンド / リセット）
```

```
sbair-modem at [-r] [-t SEC] '<AT>'   ATコマンドを1本送信
            simlock [on|off]          SIMロックの表示 / 切り替え
            ims [on|off]              IMSの表示 / 切り替え
            reset                     モデムをリセット（CFUN 0/1）し、wanをifup
            sms                       受信SMSを保管庫へ取り込む
            apn [apply|probe]         APNの表示 / 適用 / SIMから読み出す
            netmode show|get-config   接続モードの状態 / 設定
            netmode netdev-status     有線 / USB・Kernel能力の読み取り専用診断
            netmode usb-lan-list      アプリがLANへ追加したUSBポート
            netmode usb-lan-add IFACE USB Host Ethernetをbr-lanへ追加
            netmode usb-lan-remove IFACE USB Host Ethernetをbr-lanから削除
            netmode set-config ...     非推奨。draftだけを保存（ネットワーク変更なし）
            netmode apply sim|ap|ethwan|vlanwan Safe Apply（AP自動確認、他は最大120秒でrollback）
            netmode confirm|rollback|repair
            netmode recover            192.168.3.1 + ローカルDHCPへ緊急復旧
            wifi-drift status|logs|mark-good|save-test|restart-test
            overview                  モデム状態をJSONで表示
            status                    SIMマッピングとカードの種別
            simmap [1|2]              SIMマッピングの表示 / 切り替え
            list / enable / disable / delete
            nickname <ICCID> [<NAME>] profileに名前を付ける
            download / discovery      ES9+ / ES11
            gc                        残存した論理チャネルを回収する
            rpcd list | call <method> rpcdバックエンド（rpcdから呼び出される）
```

---

## ビルドと導入

```sh
PO2LMO=/path/to/po2lmo ./build.sh  # aarch64バイナリ + en/ja/koカタログ
./tools/check-i18n.sh              # 全JSビュー・プロトコル・メニューのキーを検査
./install.sh /                     # 稼働中の実機へ導入
./install.sh <tree>                # 展開済みrootfsツリーへ導入
```

`PO2LMO` または `LUCI_ROOT` を指定しないビルドではカタログ生成を省略します。
その場合、`install.sh` は言語選択肢だけが登録される不完全な導入を防ぐため停止します。

本体のGoバイナリは、CGOを無効にした静的リンクでビルドします。そのため、ビルドホストがglibc環境でも
OpenWrt（musl）上で実行できます。ビルドにはGo 1.25以上が必要です（OpenWrt 21.02に含まれるgolangは1.18のため不足します）。
goenvを使う場合は、`export PATH=$HOME/.goenv/bin:$HOME/.goenv/shims:$PATH`を実行してください。

### vendor MT-WiFi向け構成でLuCIがない場合（条件付き）

Floop3本体はvendor OpenWrt 21.02.7上のvendor MT-WiFi連携を対象にしたアプリです。
最新OpenWrtではFloop3自体を導入しません。

LuCI bootstrapはそれとは別の前提条件です。vendor OpenWrt 21.02.7にLuCIがない場合だけ、
LuCIを追加するため[`extras/luci-bootstrap/`](extras/luci-bootstrap/)を先に使います。
LuCIがすでにあるvendor環境ではbootstrapだけを省略します。最新OpenWrtや別release/SNAPSHOT
にはbootstrapの固定package manifestを適用しません。

bootstrapはMT-WiFiドライバーの修復・移植をしません。vendor Wi-Fi関連ABIを置換しない
方針でLuCI依存関係を共存させます。

```sh
./extras/luci-bootstrap/install.sh root@<現在のAir6管理IP>
./extras/luci-bootstrap/install.sh --check root@<現在のAir6管理IP>
```

これはホスト側でOpenWrt 21.02.7の固定マニフェストを取得・検証してからAir 6へ転送し、
LuCIをuhttpd `:8080`へ追加します。純正lighttpd `:80`、管理IP、vendor feedは変更せず、
自動再起動もしません。詳細は [`extras/luci-bootstrap/README.md`](extras/luci-bootstrap/README.md)を参照してください。

### USB NIC（CDC-NCM Gadget）— 実験的・任意

Air 6本体をUSB CDC-NCM gadgetとして動かす機能は、通常のUSB機器インベントリとは別の高リスク機能です。
デフォルトでは未導入・未有効化で、必要な場合に限り[`extras/usb-nic/`](extras/usb-nic/)のホスト側installerから
bundleを導入します。bundleの導入と実行時の有効化は分離されており、kernel moduleの読み込み、ConfigFS、
UDC、ネットワーク設定、起動時の自動有効化は、通常のアプリインストールでは行いません。

出典・クレジット：[Karin-Laboratory/sbat6-usb-nic](https://github.com/Karin-Laboratory/sbat6-usb-nic)。
モジュールはGPL-2.0-onlyの第三者ソフトウェアであり、本体のMITソフトウェアとは別扱いです。

確認は [docs/API.md](docs/API.md)。

GitHub ActionsのCIは、`src/sbair-modem/go.mod`のGoバージョンを基準に
`go test ./... -count=1`、`go vet ./...`、`./build.sh`、全fixture、
`git diff --check`を実行します。ローカルでも同じ検証を再現できます。

```sh
(cd src/sbair-modem && go test ./... -count=1 && go vet ./...)
./build.sh
for t in tests/*-fixture.sh; do
    echo "==> $t"
    case "$t" in
        tests/iperf3-parser-fixture.sh|tests/publication-hygiene-fixture.sh) bash "$t" ;;
        *) sh "$t" ;;
    esac
done
git diff --check
```

`iperf3-parser-fixture.sh`と`publication-hygiene-fixture.sh`はBash専用のため、
実行権限・shebangを使う上記ループ、または`bash "$t"`で実行してください。

### ネットワーク / LANサービス

`admin/sbair/network/lan-services`（LANサービス）では、Air 6がLAN端末にIPアドレスを配布する
**LAN DHCPサーバー**を管理できます。ここでいうDHCPサーバーは`dhcp.lan.ignore`だけを対象とし、
ネットワーク全体は再起動しません。

用語を混同しないでください。

| 機能 | 意味 | 管理元 |
|---|---|---|
| **DHCPクライアント** | Air 6自身が親ルーターから管理IPを取得する | ネットワーク > 接続モード。`network.lan.*` / `management_proto`はLANサービスから変更しません |
| **DHCPサーバー** | Air 6がLAN端末へIPアドレスを配布する | ネットワーク > LANサービス。`dhcp.lan.ignore`だけを変更します |

接続モードがAP / Bridgeとして管理されている間は、LAN DHCPサーバーの有効化を拒否します。
EasyMeshの設定は自動変更しません。DHCPサーバーの変更前には`/root/sbair-backups/`へ
タイムスタンプ付きのバックアップを作成します。

AP / Bridgeの固定IP欄を空欄にすると、初回の管理開始前に保存した純正の`network.lan`設定を継承します。
空欄をFallback `192.168.3.1`へ置き換えることはありません。純正値を取得できない必須項目は、
ネットワーク変更前に拒否されます。画面の適用プレビューで、純正値・適用予定値・値の出所を確認できます。

### 本体 / アップデート管理

`admin/sbair/device/update`（アップデート管理）では、純正の`kn_fotad`によるOTA / FOTA自動更新を管理できます。
OTA / FOTAを無効にすると、`fota.config.enabled=0`と`fota.provision.enabled=0`を保存し、
`kn_fotad`を停止して自動起動を無効にします。`fota.config.respawn`は変更せず、約10秒待って再起動（respawn）
していないことを確認します。いずれも自動再起動は行いません。

---

## ⚠ 注意

- **内蔵eSIMにはISD-Rがありません。** eUICCを操作できるのは物理スロットのカードだけで、
  `AT+ESIMMAP?`が`1`のときに限られます。**ただし、そのカードがeUICCとは限りません。**
  通常のSIMが挿入されている状態も正常として扱います。
- **`AT+ESIMMAP=<n>`を直接入力しないでください。** 必ず`AT+CFUN=4`で停止してから実行します。
  切り替え後20～30秒間はATに応答しません。
- **再起動すると物理スロット側へ移ります。** そこに有効なprofileがなければ圏外になります。
- **SIMロックは`AT+ESMLCK`を直接発行して解除します。** ベンダーの`/bin/sim_lock.sh`は戻り値を確認しないため、
  使用しません。解除後は`AT+CFUN=0` → `1`の実行が必要です。
- **IMSは出荷時には無効です。** **SMSはIMS経由で配送されるため、未登録の場合は届きません。**
  モバイル回線 > 状態から有効にできます。設定変更後は再起動が必要です。設定を初期化すると
  SIMロックが戻って圏外になり、IMSも登録できなくなります。
- **SMSの取り込みは、モデム側の未読を既読に変更します**（`AT+CMGL`の仕様上、避けられません）。
  保管庫には最初に取り込んだ時点の未読状態が残りますが、純正WebUIの未読表示は消えます。
- **eSIMのインストールには、この機体からインターネットへ接続できることが必要です。**
  既定ではデフォルトルートがありません。
- **AP / Bridgeの管理IP用DHCPクライアントは利用できますが、非常に高いリスクを伴います。** これは
  Air 6自身が上流ルーターから管理IPを取得する設定です。切り替えや適用に失敗すると、すべてのネットワーク接続を失い、
  ソフトブリックしてUARTによる復旧が必要になるおそれがあります。UARTなどの復旧手段を確保できない場合は、
  選択・適用しないでください。Safe Applyの自動ロールバックも、あらゆる設定失敗からの復旧を保証しません。
  無効化する場合は`uci set sbair.bridge.ap_dhcp_enabled=0 && uci commit sbair`を実行します。
- **初回インストールでは、既存の`dhcp.lan.ignore`からAPモードを推測しません。** LuCIで明示的にAPを適用するまで、
  ネットワーク設定は変更しません。APモードでは、Air 6自身のIPv4 DHCP OFFER/ACKを`br-lan`外向きでDROPするguardも維持します。
- **有線／USB診断は読み取り専用です。** `network.wan`の信頼できるプロトコルとdevice、netifdの状態、sysfsの実測だけを表示し、
  自動bridge・WAN割り当てやkernel moduleのインストールは行いません。

---

## ライセンス

MIT（→ [LICENSE](LICENSE)）。第三者ソフトウェアの扱いは[NOTICE.md](NOTICE.md)を参照してください。


