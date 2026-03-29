# DingClaw

<p align="center">
  <img src="./assets/readme-hero.svg" alt="DingClaw hero" width="100%" />
</p>

<p align="center">
  <img alt="npm" src="https://img.shields.io/npm/v/openclaw-dingtalk?style=flat-square" />
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D22.16-43853d?style=flat-square&logo=node.js&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-10.x-F69220?style=flat-square&logo=pnpm&logoColor=white" />
  <img alt="license" src="https://img.shields.io/github/license/yansheng21/openclaw-dingtalk?style=flat-square" />
</p>

<p align="center">
  <a href="./README.md">简体中文</a> | <a href="./README_EN.md">English</a> | 日本語 | <a href="./README_KO.md">한국어</a>
</p>

`DingClaw` は、DingTalk を中心にした企業向け運用のための OpenClaw 拡張版です。複数ボット接続、Agent ごとの独立ワークスペース、モデルのルーティングとフォールバック、ナレッジ同期、監査しやすい運用、そして中国語中心の管理 UI を提供します。

## 主な特徴

- DingTalk の複数アカウント接続と会話分離
- Agent ごとの独立ワークスペース、人格、スキル境界
- 主モデル、fallback、推論強度、ツール許可リストを含むモデルルーティング
- DingTalk ナレッジベースを Agent ローカルのメモリ領域へ同期
- 承認、監査、ポリシーを前提にしたガバナンス指向の運用
- npm 配布、CLI インストールスクリプト、GitHub Releases 対応

## クイックスタート

```bash
pnpm install
pnpm ui:build
pnpm openclaw gateway --port 18789 --verbose
```

ブラウザで `http://127.0.0.1:18789/` を開くと管理 UI に入れます。

## 主な構成

| コンポーネント      | 役割                                                        |
| ------------------- | ----------------------------------------------------------- |
| Gateway             | WebSocket、HTTP、チャネル接続、Agent 実行、静的 UI 配信     |
| Control UI          | 設定、Agent、スキル、知識ソース、チャット管理を行う管理画面 |
| Desktop Shell       | ローカル Gateway を起動または接続する Electron シェル       |
| Agents              | 独立ワークスペース、人格、スキル、知識キャッシュ            |
| DingTalk Connectors | 複数アカウントのメッセージ接続と知識同期                    |

## 関連リンク

- メイン README: [`README.md`](./README.md)
- 製品概要: [`docs/blueprint/01-product-overview.md`](./docs/blueprint/01-product-overview.md)
- システム構成: [`docs/blueprint/02-system-architecture.md`](./docs/blueprint/02-system-architecture.md)
- MVP スライス: [`docs/blueprint/12-mvp-build-slices.md`](./docs/blueprint/12-mvp-build-slices.md)
