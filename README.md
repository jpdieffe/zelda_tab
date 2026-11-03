# JJ's Fairy Link

A two-device companion for **The Legend of Zelda: A Link to the Past (USA)**. Dad's Android phone runs the SNES emulator and displays a controller. JJ's Android tablet receives the game video and audio, controls a fairy by tapping or dragging, and fires short-range homing sparks at nearby ordinary enemies.

**Play:** https://jpdieffe.github.io/zelda_tab/

Hosted on GitHub Pages. No ChatGPT account or login is required.

## Play

1. Open https://jpdieffe.github.io/zelda_tab/ in Chrome on both Android devices, on the same Wi-Fi.
2. On the phone, choose **I'm Dad → Take the controls**. The included Zelda game starts automatically; there is no ZIP or ROM picker.
3. On the tablet, choose **I'm JJ → Let's fly**, and enter the eight-character code on the phone. You can also tap the code on the phone to copy a direct pairing link.
4. Turn both devices sideways. Tap the full-screen button. Press **START** on the phone once Zelda's title animation finishes, and create/select an ordinary game file.
5. JJ taps or drags on the game picture to fly. The fairy follows Link until JJ chooses a destination, follows scrolling, and returns beside Link when the room changes. A faint ring shows its range. When an ordinary enemy is close, the fire button lights up.
6. Tap **Sound on** on the tablet to move game sound there. Leave both browser tabs open and the phone unlocked. The app requests a screen wake lock where supported.

No computer or home server is required after deployment. An internet connection is needed to load the app/emulator and reach PeerJS's public pairing service. After pairing, WebRTC streams game video/audio and control messages directly between devices. No TURN relay is configured. Guest Wi-Fi client isolation, VPNs, or networks that block direct peer connections can prevent pairing.

## Saving

The latest save state is stored in IndexedDB on the phone, under the site's origin. The game saves every 30 seconds while running, on **Save & keep playing**, and when the phone tab is hidden. The last state is restored automatically when starting the game. **More → Download save backup** exports a portable state file; **Restore backup** loads it. Closing Android Chrome abruptly can lose changes since the most recent completed save. Clearing browser/site data removes local saves.

The supplied USA ROM is bundled at `dist/assets/alttp-usa.sfc` and is published with the app. It is publicly downloadable from this repository and GitHub Pages. The phone loads it automatically; JJ's tablet only receives the game picture, audio and session-status messages. PeerJS handles connection metadata; the ROM is not sent to it. Personal saves and test screenshots are not published.

Saves belong to the website address where they were created. If you previously played at another address, download a save backup there and restore it here. Existing saves on this GitHub Pages address continue to work.

## GitHub Pages deployment

Push to `main` to run `.github/workflows/pages.yml`. The workflow runs the game-rule and bundled-ROM integrity tests and publishes only `dist/`. Configure the repository's **Settings → Pages → Source** as **GitHub Actions**. The repository and app, including the bundled game, are public. Save states, test screenshots, local dependencies and hosting credentials are excluded.

All app assets use relative URLs so they work at the `/zelda_tab/` project path. Pairing still uses PeerJS and WebRTC; GitHub Pages serves the app files and does not run the game or relay video.

## Fairy rules and scope

- Range: **54 SNES pixels**; movement: **125 pixels/second**; cooldown: **650 ms**.
- Each spark queues **1 damage unit** through the original game's pending-damage and recoil timers. Zelda itself handles health reduction, defeat, drops and room progression.
- Targets are an explicit allowlist of ordinary enemies. NPCs, tutorial guards, switches, bosses and enemies with special damage requirements are excluded. This is deliberately a first-version limitation, not full enemy coverage.
- Sprite state, health, invulnerability flags, floor, screen position, type, scene and distance are checked. A target is revalidated on impact. Dialogues, pause menus and room transitions disable shooting.
- The fairy is an overlay tied to the emulator's live RAM, not a ROM patch. It is not persisted inside Zelda save states. Its projectiles do not test dungeon wall collision.
- The included USA ROM is verified against SHA-256 `66871d66be19ad2c34c927d6b14cd8eb6fc3181965b6e517cb361f7316009cfb` before starting. Randomizers, ROM hacks and other regions need separate memory profiles.

## Development

Requires Node.js 24+ and Chrome for browser tests.

```sh
npm ci
npm test
npm run dev
```

Local preview: `http://localhost:4173`. HTTPS is required on real phones/tablets for WebRTC canvas capture, Web Crypto and wake lock. `localhost` is considered secure for desktop testing.

```sh
npm run test:browser
```

The browser integration test starts the bundled game without selecting any file and uses the installed Windows Chrome executable. Set `CHROME_PATH` for another installation. Test screenshots and local save states go in ignored `test-results/`. They are never included in `dist/`. The Node tests cover bundled-ROM integrity, memory location, target filtering, native damage queuing, coordinate transforms, cooldown, and invalid inputs.

## Implementation and references

- `dist/app.js`: UI, automatic bundled-game loading, ROM validation, controller input, save states, audio routing and canvas streaming.
- `dist/network.js`: PeerJS room pairing, WebRTC media/data, heartbeat and reconnection.
- `dist/zelda.js`: verified USA RAM map and conservative damage adapter. It locates the 128 KiB live WRAM by matching a Snes9x save snapshot, excluding serialized copies, checking the live frame counter, then verifying a second snapshot. It never writes to an unverified memory address.
- `dist/fairy.js`: movement, auto-targeting, projectiles and drawing.
- [EmulatorJS 4.2.3](https://github.com/EmulatorJS/EmulatorJS/tree/v4.2.3) is loaded from its versioned CDN. [GameManager source](https://github.com/EmulatorJS/EmulatorJS/blob/v4.2.3/data/src/GameManager.js) documents the actual input and state interfaces used here.
- [snesrev/zelda3 variables](https://github.com/snesrev/zelda3/blob/master/src/variables.h), [sprite damage handling](https://github.com/snesrev/zelda3/blob/master/src/sprite.c), and [sprite dispatch table](https://github.com/snesrev/zelda3/blob/master/src/sprite_main.c) were consulted to verify RAM addresses and target types.
- [PeerJS](https://peerjs.com/client/getting-started) 1.5.5 is vendored with its license in `dist/vendor/`. EmulatorJS is GPL-3.0; Snes9x uses its own license and is fetched by EmulatorJS from its CDN. The Google Fonts stylesheet is optional; system font fallbacks are provided.

Real Android performance, Wi-Fi latency, heat and audio behavior depend on the devices. Desktop browser integration testing cannot replace a session on the physical phone and tablet.
