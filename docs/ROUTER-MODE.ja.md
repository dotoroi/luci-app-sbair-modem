# Air 6 ルーターモード案内

[English](ROUTER-MODE.en.md) | [한국어](ROUTER-MODE.ko.md) | [日本語](ROUTER-MODE.ja.md)

この文書では、SoftBank Air 6のメーカー版ファームウェア上でFloop3の **Network → Connection Mode（ネットワーク → 接続モード）** に実装されたルーター構成を説明します。セルラー設定を維持しながら有線インターネットを使う場合、この案内では**Air 6 Ethernet WAN (VLAN 3)**を優先候補として推奨します。有線WANはポート経路の異なる2種類があるため、適用前に現在の機器のポート対応を確認してください。

## 選択できるモード

| LuCI表示 | 上流回線 | 動作 |
|---|---|---|
| **Stock cellular router (SIM / ccmni)** | 内蔵セルラーモデム | 保存済みSIMルータープロファイルを戻し、プライベートLANとLAN DHCPを維持します。 |
| **Air 6 Ethernet WAN (VLAN 3) — 推奨** | スイッチVLAN 3の`eth0.3` | VLAN 3にDHCP上流を追加し、セルラー`network.wan`設定を保持します。 |
| **Floop3 wired WAN router (eth1)** | 専用論理インターフェース`eth1` | 上位機器からDHCPでアドレスを取得し、`network.wan`をeth1へ割り当てます。セルラー上流を置き換えます。 |

有線モードはいずれもプライベートLANアドレスとDHCP範囲を維持し、既存のLAN→WAN転送とmasquerade（NAT）ポリシーを再利用します。適用前にWAN firewall zoneの入力ポリシーがDROP/REJECTであること、masqueradeとLAN→WAN転送があることを検証します。条件を満たさない場合、強制適用せず中止します。ハードウェアNATや性能アクセラレーションを有効化する機能ではありません。

### eth1有線WAN

`network.wan`のDHCPデバイスを`eth1`に変更します。`wan6`が存在すればIPv6 WANもeth1に割り当てます。セルラーとの**デュアルWANや自動フェイルオーバーは構成しません**。ルーターの上流はeth1に置き換わります。この設定自体はモデムを明示的に停止しません。

`eth1`はソフトウェアが識別する論理名です。リポジトリの記録だけでは筐体上のどの印字ポートか確定できません。**Network → Diagnostics**で候補とリンクを確認し、ポート表示を確認したうえで実際のリンク試験により判別してください。上流ネットワークをLANポートへ接続するとDHCPサーバーが競合するおそれがあります。

### 推奨構成：VLAN 3 Ethernet WAN

実装に記録されたスイッチ構成を使用します。外部スイッチポート1をVLAN 1から外してVLAN 3へuntaggedで追加し、CPUポート5をVLAN 3へtaggedで追加して`eth0.3`を作ります。別のDHCPクライアント`network.ethernetwan`をWAN firewall/NAT zoneへ登録します。セルラーの`network.wan`設定は残ります。

セルラー設定を保持したい場合の有線WAN推奨構成です。ただし「推奨」はモード選択についてであり、この実装がルーティングmetricを設定する意味ではありません。セルラーとEthernetの両方がデフォルトルートを広告する場合があり、コードは優先順位や自動フェイルオーバーを設定しません。状態画面または`ip route`で実際のデフォルトルートを確認してください。スイッチのポート番号から筐体の印字ポートを推測しないでください。VLAN変更の失敗で遠隔管理が切れる可能性があるためUART復旧手段を用意してください。

## 切り替え前の準備

1. SoftBank Air 6のメーカー版ファームウェアで動作していることを確認し、表示された機種と現在のポート対応を確認します。
2. 設定をバックアップし、独立した復旧手段（可能ならUART）を準備します。LAN/Wi-Fi経由のLuCI管理経路を維持してください。
3. **Network → Diagnostics**でリンクとWAN候補を確認します。物理WANポートを特定する前に上流ケーブルを接続しないでください。
4. 上位ルーター/モデムがIPv4アドレスをDHCP配布することを確認します。このethwan/VLAN WAN設定はPPPoEアカウントを設定しません。
5. LANには有効な固定プライベートIPv4アドレス/ネットマスク、LAN DHCPサーバー、LAN→WAN転送、WAN masqueradeが必要です。eth1モードへAPモードから直接切り替えることはできません。先にSIMルーターモードへ戻します。

## LuCIから切り替える

1. **Network → Connection Mode**を開き、現在のモード、管理IP、デフォルトルート、DHCP状態、WANアドレス/リンクを確認します。
2. AP/Bridge中なら先に**Stock cellular router (SIM / ccmni)**へ切り替えます。APから有線WANへの直接遷移は拒否されます。
3. **Floop3 wired WAN router (eth1)**または**Air 6 Ethernet WAN (VLAN 3)**を選択します。画面の説明とリンク候補を確認して**Apply changes**を押します。
4. 上流ケーブルを特定済みのWANポートに接続し、管理PCはLAN/Wi-Fiに残します。上流DHCPのリースとデフォルトルートを確認します。
5. 表示されたモード、WANアドレス/リンク、デフォルトルート、LAN DHCPが意図どおりの場合だけ、保留中の変更で**Check these settings/Confirm**を押します。不確かな場合や管理接続が不安定な場合は**Rollback**を選ぶか、120秒の期限切れを待ちます。

有線モード変更には最大120秒のSafe Apply確認時間があります。設定スナップショットは戻しますが、すべてのカーネル/スイッチ/ネットワーク障害からの復旧を保証しません。VLANモードをUARTなしで遠隔試験しないでください。

## 確認とセルラーへの復帰

**Network → Connection Mode**で`eth1`または`eth0.3`のリンク、DHCPアドレス、デフォルトルートを確認します。シェルが使える場合、次の読み取り確認もできます。

```sh
ip -4 addr show br-lan
ip route
ifstatus wan
ifstatus ethernetwan
```

`ethwan`では`wan`がDHCPアドレスとデフォルトルートを持つ状態が想定されます。VLAN WANでは`ethernetwan`を確認し、どの経路が選ばれたかも確認します。インターネットに接続できない場合、ファイアウォールを無効にしたりWANをLANブリッジへ直接追加したりしないでください。

セルラーへ戻るにはConnection Modeで**Stock cellular router (SIM / ccmni)**を選択して適用・確認します。ethwanは保存済みの元WAN設定を復元します。VLAN WANは保存済みVLAN基準設定を戻し、別Ethernet WANインターフェースを削除します。AP/Bridgeは有線ルーターモードの直接の復元先ではないため、先にSIMルーターモードへ戻してください。

## 2種類のDHCP設定

- **管理IP DHCPクライアント**：Air 6自身が上位ルーターから管理アドレスを取得します。AP/Bridge管理用で、WAN DHCPとは別です。
- **LAN DHCPサーバー**：Air 6が内部端末へアドレスを配布します。ルーターモードでは有効である必要があります。**Network → LAN Services**で管理し、Connection Mode画面がWAN/LAN DHCPを無条件に切り替えることはありません。

## Connection Modeの`sbair.errorText is not a function`エラー

ブラウザーに残った古い`tools/sbair.js`と新しい`netmode.js`が混在すると、このJavaScriptエラーが発生することがあります。このエラー自体はWAN設定や接続モードが変更されたことを示しません。エラーを消すために**Apply changes**を押さないでください。

1. デスクトップChromeでは`Ctrl+Shift+R`で強制再読み込みします。モバイルではLuCIのタブを閉じて開き直すか、先にシークレットタブで確認します。
2. 続く場合はルーターのLuCIアドレスのサイトキャッシュを消去して、再度ログインします。
3. それでも再発する場合はリリースバンドル全体を再インストールして、ページを再読み込みします。`netmode.js`だけをコピーしないでください。

最新の画面は共通エラーヘルパーを利用できない場合、元のエラーメッセージを表示するようにしています。再発時はLuCIのリリースバージョンとソースコミット、ブラウザーコンソールのメッセージを記録して報告してください。

## 個人的な注意：`/tmp`のログ

Air 6の`/tmp`に保存するログや一時ファイルはメモリーを使用します。詳細ログを有効にしたままにしたり、大量のログを長時間ためたりすると、メモリー不足によりLuCI、ネットワークサービス、アプリ機能が不安定または停止するおそれがあります。必要な診断ログだけを短時間取得してください。長期保存する場合はPCへコピーしてから、端末の一時ログを整理してください。
