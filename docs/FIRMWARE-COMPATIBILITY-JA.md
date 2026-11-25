# Air Terminal 6の互換性とファームウェア情報

Floop3はSoftBank Air 6（RG620T-SBK / RUDOLF / SBA6D）のメーカー版ファームウェア環境向けです。upstream OpenWrt向けの汎用パッケージではありません。

## インストーラーの確認項目

インストーラーは`/etc/knos-config/INPUT_BASE_MODULE=RG620TSBK`と`INPUT_PROJECT=RUDOLF`で機種を識別し、同梱バックエンドの実行条件として`uname -m`が`aarch64`であることを確認します。KNOSとOpenWrtのrelease、revision、target、architectureは診断用に表示しますが、固定バージョンの許可リストとは比較しません。

以下のバージョンは、解析したイメージから得た過去の観察記録です。対応バージョン一覧でも、すべての機能を各バージョンで検証したという意味でもありません。

| 観察したKNOS | 観察したOpenWrt情報 | 根拠 |
|---|---|---|
| 0.09.45 | 21.02.7、`gem6xxx/evb6990_cpe_mt7990_emmc`、ARM64 | 既存AスロットSquashFS。vendor SDK `RG620TSBK00AAR03A01G4G_OCPU_BETA20240204` |
| 1.00.22 | 21.02.7、同じtargetとarchitecture | 既存B rootfs抽出物。SDK `...OCPU_BETA20240705` |
| 1.01.20 | 21.02.7、同じtargetとarchitecture | 2台のrootfsで5,293項目が一致したという比較記録。SDK `...QDM064-EA_01.001.01.002_V01` |
| 1.01.44 | 21.02.7、同じtargetとarchitecture | P26解析rootfs。同じQDM064 SDK識別子 |
| 1.01.52 | 21.02.7、同じtargetとarchitecture | P39解析SquashFS。同じQDM064 SDK識別子。解析用画像であり書き込み対象ではありません |

## 互換性の限界

- Air 6の機種識別が一致すれば、上記の観察記録にない新しい、または不明なファームウェアでも機種チェックを通過します。各機能の動作を保証するものではありません。
- 同梱バックエンドは`linux/arm64`、`CGO_ENABLED=0`です。インストーラーは`uname -m`を確認しますが、vendor RPC、シェルツール、モデムサービス、Wi-Fi連携、設定構造はファームウェアごとに異なる場合があります。
- 識別されたSoftBank Air 6のメーカー版環境でのみ使用してください。別の基板や一般upstream OpenWrtには導入しないでください。
- 設定をバックアップし、独立した復旧手段を確保してください。事前検査結果を確認し、導入後にLuCI、RPC、Wi-Fi、ネットワークの主要機能を確認してください。
- 1.01.52の安定性記録は1.01.20由来overlayを混ぜた試験で、WAPP SIGSEGVとカーネル例外を含みます。純正1.01.52単独が原因と証明するものでも、安定性を認証するものでもありません。

純正ファームウェアや機器固有のユーザーデータはリリースに含まれません。
