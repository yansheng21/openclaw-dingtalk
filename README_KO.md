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
  <a href="./README.md">简体中文</a> | <a href="./README_EN.md">English</a> | <a href="./README_JA.md">日本語</a> | 한국어
</p>

`DingClaw` 는 DingTalk 중심 운영을 위해 설계된 엔터프라이즈 OpenClaw 포크입니다. 다중 봇 DingTalk 접속, 독립 Agent 및 작업공간, fallback 기반 모델 라우팅, 지식 동기화, 거버넌스 중심 제어, 그리고 중국어 우선 관리 콘솔을 제공합니다.

## 핵심 기능

- DingTalk 다중 계정 연결과 대화 격리
- Agent별 독립 워크스페이스, 정체성, 스킬 경계
- 기본 모델, fallback, reasoning, tool allowlist를 포함한 모델 라우팅
- DingTalk 지식베이스를 Agent 로컬 메모리로 동기화
- 승인, 감사, 정책 기반의 운영 거버넌스
- npm 배포, CLI 설치 스크립트, GitHub Releases 지원

## 빠른 시작

```bash
pnpm install
pnpm ui:build
pnpm openclaw gateway --port 18789 --verbose
```

브라우저에서 `http://127.0.0.1:18789/` 를 열면 관리 UI에 접속할 수 있습니다.

## 주요 구성요소

| 구성요소            | 역할                                                    |
| ------------------- | ------------------------------------------------------- |
| Gateway             | WebSocket, HTTP, 채널 연결, Agent 실행, 정적 UI 제공    |
| Control UI          | 설정, Agent, 스킬, 지식 소스, 채팅을 관리하는 운영 콘솔 |
| Desktop Shell       | 로컬 Gateway를 시작하거나 연결하는 Electron 셸          |
| Agents              | 독립 워크스페이스, 페르소나, 스킬, 지식 캐시            |
| DingTalk Connectors | 다중 계정 메시징과 지식 동기화                          |

## 링크

- 메인 README: [`README.md`](./README.md)
- 제품 개요: [`docs/blueprint/01-product-overview.md`](./docs/blueprint/01-product-overview.md)
- 시스템 아키텍처: [`docs/blueprint/02-system-architecture.md`](./docs/blueprint/02-system-architecture.md)
- MVP 빌드 슬라이스: [`docs/blueprint/12-mvp-build-slices.md`](./docs/blueprint/12-mvp-build-slices.md)
