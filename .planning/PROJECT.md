# PROJECT: Sifa Playground

## Vision
3D детская площадка где 5 ИИ-агентов играют в сифу (tag). Каждый агент имеет уникальную личность и управляется через Groq LLM. Desktop Windows приложение.

## Goals
1. Создать визуально приятную 3D детскую площадку (горки, качели, песочница, лесенки)
2. 5 ИИ-агентов с уникальными характерами играют в сифу автономно
3. Агенты "хотят" играть — показывают эмоции, кричат "СИФА!", убегают и догоняют
4. Плавный геймплей 60fps без зависаний от LLM
5. Упакованное Electron приложение для Windows

## Constraints
- Groq FREE tier (30 req/min) → batch all 5 agents per call
- No external 3D models — procedural geometry only
- Desktop only (no web, no mobile)
- Russian UI/speech bubbles

## Tech Decisions
| Decision | Choice | Reason |
|----------|--------|--------|
| 3D Engine | Three.js 0.169 | Fastest to prototype, huge community |
| Physics | cannon-es 0.20 | Simple, no WASM, sufficient for casual |
| Desktop | Electron 33 | Cross-platform, WebGL support |
| Build | Vite + vite-plugin-electron | HMR, fast builds |
| AI | Groq (llama-3.3-70b) | 0.3-0.5s latency, FREE |
| AI arch | 3-tier (render/behavior/LLM) | LLM never blocks game loop |

## Target Users
- Демо/fun проект
- Showcase AI agent capabilities

## Out of Scope (V1)
- Multiplayer
- Map editor
- Voice synthesis
- Mobile/web deployment
- Replay system
- Leaderboards
