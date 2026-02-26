# Tech Stack Research: 3D Playground Tag Game

## Recommended Stack
- **Three.js 0.169** — procedural playground geometry (no external models)
- **cannon-es 0.20** — simple physics, sufficient for casual game
- **Electron 33 + Vite** — clean build pipeline, hot reload in dev
- **Groq SDK** (llama-3.3-70b) — batch all 5 agents per request, 600ms cycle
- **Tween.js** — smooth visual interpolation between AI decisions

## Key Findings
- Playground equipment built procedurally from primitives (zero loading, zero licensing)
- Agents as colored capsule shapes (CapsuleGeometry)
- cannon-es over Rapier (simpler, no WASM, sufficient for casual game)
- Vite + vite-plugin-electron for dev experience

## Groq Integration
- **Batch approach**: one Groq call returns decisions for all 5 agents
- **Rate limits**: free tier 30 req/min → batch = ~100 req/min OK
- **max_tokens: 50** — decisions are tiny JSON, reduces latency
- **response_format: { type: "json_object" }** — eliminates parse errors
- Main process handles Groq (API keys safe), renderer handles game

## Package List
```json
{
  "dependencies": {
    "three": "0.169.0",
    "cannon-es": "0.20.0",
    "groq-sdk": "0.9.1",
    "@tweenjs/tween.js": "23.1.3"
  },
  "devDependencies": {
    "electron": "33.2.0",
    "electron-builder": "25.1.8",
    "vite": "6.0.0",
    "vite-plugin-electron": "0.28.0"
  }
}
```
