# Aladin Lite Multiplayer Game

A multiplayer astronomy map game using Aladin Lite with cross-device synchronization.

## Features
- Real-time multiplayer collaboration
- Cross-device synchronization via Deno Deploy
- Same-browser tab sync via BroadcastChannel
- Add markers with custom colors and descriptions
- Mobile-friendly interface

## Local Development

1. Install Deno: https://deno.land/

2. Run the server:
```bash
./run-server.sh
# or
deno run --allow-net --allow-read --allow-env --unstable-kv server.ts
```

3. Open `index.html` in your browser

## Deployment to Deno Deploy

1. Create a project on https://deno.com/deploy

2. Connect your GitHub repository

3. Set the entry point to `server.ts`

4. Deploy!

5. Update the `DENO_DEPLOY_URL` in `index.html`:
```javascript
const DENO_DEPLOY_URL = 'https://your-app.deno.dev';
```

## How it Works

### Dual Sync Architecture
- **BroadcastChannel**: Instant sync between tabs in the same browser
- **Deno KV + Polling**: Cross-device sync via REST API

### Components
- `index.html` - Main game interface
- `server.ts` - Deno Deploy server with KV storage
- `test-broadcast.html` - BroadcastChannel test page
- `test-websocket.html` - WebSocket client test page

## Usage

1. Enter your name and choose a color
2. Click anywhere on the map to place markers
3. Add optional descriptions to markers
4. See other players' markers in real-time
5. Works across different devices and browsers!