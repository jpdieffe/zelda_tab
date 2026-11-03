# JJ's Fairy Link

A two-device companion for **The Legend of Zelda: A Link to the Past (USA)**. Dad's Android phone runs the SNES emulator and displays a controller. JJ's Android tablet receives the game video and audio, controls a fairy by tapping or dragging, and fires short-range homing sparks at nearby ordinary enemies.

**Play:** https://jpdieffe.github.io/zelda_tab/

Hosted on GitHub Pages. No ChatGPT account or login is required.

## Play

1. Open https://jpdieffe.github.io/zelda_tab/ in Chrome on both Android devices, on the same Wi-Fi.
2. On the phone, choose **I'm Dad → Take the controls**. The included Zelda game starts automatically; there is no ZIP or ROM picker.
3. On the tablet, choose **I'm JJ → Let's fly**, and enter the eight-character code on the phone. You can also tap the code on the phone to copy a direct pairing link.
4. Turn both devices sideways. Tap the full-screen button. Press **START** on the phone once Zelda's title animation finishes, and create/select an ordinary game file.
5. JJ taps or drags on the game picture to fly. The fairy follows Link until JJ chooses a destination, follows scrolling, and returns beside Link when the room changes. A faint ring shows its range. When an ordinary enemy is close, the fire button lights up and sparks home toward it. With no target, sparks fire in the fairy's last flight direction (up before its first move), burst against walls, and can be fired just for fun.
6. Tap **Sound on** on the tablet to move game sound there. Leave both browser tabs open and the phone unlocked. The app requests a screen wake lock where supported.

No computer or home server is required after deployment. An internet connection is needed to load the app/emulator and reach PeerJS's public pairing service. After pairing, WebRTC streams game video/audio and control messages directly between devices. No TURN relay is configured. Guest Wi-Fi client isolation, VPNs, or networks that block direct peer connections can prevent pairing.

## Phone controls

The large left joystick has a floating thumb origin: touch anywhere inside the circle, then drag to walk in any of eight directions. Lift your thumb to stop. The deadzone ignores small thumb movements. B is now 112 pixels across in a normal landscape view (96 on short screens), with A, X and Y spaced around it. Steering and sword presses work simultaneously.

## Android tablet app

For Android's bottom Back, Home and Recents buttons, install [Fairy Link Tablet](https://jpdieffe.github.io/zelda_tab/downloads/fairy-link-tablet.apk) on JJ's tablet (Android 8+). Open the APK and allow installation from your browser if Android asks, then open **Fairy Link Tablet**, pair with Dad's phone, enable sound and tap **Kid lock**. Accept Android's **Pin / Start** confirmation. The lock bar must say **Android buttons locked** before handing over the tablet. If the prompt is cancelled, **Lock Android buttons** retries it.

The APK uses a WebView with immersive system bars, suppresses Back while locked, and requests Android screen pinning to block Home and Recents. A deliberate Android unpin gesture can still exit screen pinning; enable a PIN/password for unpinning in Android Settings if needed. This is ordinary Android screen pinning, not device-owner kiosk provisioning. No reset, root, device administrator or computer during play is required. Dad's **More > Unlock JJ's tablet** or the tablet's three-second parent hold releases both the game lock and Android pinning. Outside kid lock, Back asks before closing.

The app loads this same GitHub Pages game and receives WebRTC video and audio. It requires internet and an up-to-date Android System WebView. No camera, microphone, storage or accessibility permission is requested. Existing phone saves stay in Chrome on Dad's phone. Android WebView does not share Chrome's storage.

Build with `node scripts/build-android.mjs` using Android SDK platform/build-tools 35 and Android Studio's JDK. Override `ANDROID_HOME` and `FAIRY_JAVA_HOME` if needed. The signing key is stored outside the repository in `../.tools/fairy-android-signing`; back it up to preserve APK upgrade compatibility. The release APK disables WebView debugging. `--debug` builds a separate ignored test APK. Source is in `android/` and build output is ignored.

## Kid lock and Android setup

On JJ's tablet, turn sound on, then tap **Kid lock**. It requests fullscreen and hides the normal toolbar, including Leave, Sound and Fullscreen. Long-press/right-click menus, selection, drag menus and page zoom/scroll gestures are suppressed on the play screen. Moving the fairy and firing still work. A same-page history guard catches ordinary Back navigation while locked. If Android exits browser fullscreen, **Restore fullscreen** brings the game back.

Hold **Hold 3 sec to unlock** continuously to restore the parent controls; releasing, moving off the button, cancelling a touch, or switching apps cancels the hold. Dad can also use **More > Unlock JJ's tablet** on his paired phone.

For the address bar and Android buttons:

1. Open the game in Android Chrome, choose **Chrome menu > Add to Home screen > Install**, and launch the **Fairy Link** icon. The supplied app manifest requests fullscreen app display, with no address bar. The installed shortcut opens JJ's pairing screen. If Chrome only offers a browser shortcut, that shortcut may still show browser controls; use fullscreen plus the in-game lock.
2. In Android Settings, search for **App pinning**, **Screen pinning** or **Pin app**. Enable it and require the device PIN/password when unpinning.
3. Open Fairy Link, open Android's Recent apps/Overview, tap its app icon, and choose **Pin**. Exact names and gestures vary by tablet.

Kid lock prevents accidents; a webpage cannot disable Android system navigation or guarantee that browser Back never leaves. App pinning supplies the system restriction. Parent hold/remote unlock only unlocks the game UI; Android's own unpin gesture and device PIN still apply. Installation does not make this game offline: internet is still required to load and pair. [Android's pinning instructions](https://support.google.com/android/answer/9455138?hl=en), [web app display modes](https://web.dev/articles/add-manifest).

Run `node scripts/kid-lock-test.mjs` to verify lock controls, cancelled/short holds, Back navigation, fullscreen recovery, continued play, manifest parsing and icon loading. The two-device browser test also verifies unlocking from Dad's phone.

## Story compass

A small gold arrow beside Link points toward the next story destination outdoors. The objective appears above the game picture and on Dad's controller. It updates from the current save's inventory, pendants, crystals and story flags; reloading a save does not reset its progress. Turn it off in **More > Story compass**.

This is a destination compass, not turn-by-turn routing: take paths around cliffs and buildings. Inside Link's house it points to the exit; it can also point to relevant NPCs in the current room. Other interiors display an objective hint, with no direction arrow. Dungeon keys, switches, stairs and puzzles still require exploration and the original **X** map. Cross-world objectives explain when to use the mirror or castle portal. The guide recommends one story order and skips completed milestones; it does not cover every optional item or side quest.

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
- The fairy is an overlay tied to the emulator's live RAM, not a ROM patch. It is not persisted inside Zelda save states. Projectiles read live dungeon tile attributes and decode overworld collision through the bundled ROM's tile tables. They sweep in small steps to stop at walls and closed doors, while flying over pits and water. Sparks at the screen boundary burst and disappear. They do not activate switches or damage scenery.
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

The browser integration test starts the bundled game without selecting any file and uses the installed Windows Chrome executable. Set `CHROME_PATH` for another installation. Test screenshots and local save states go in ignored `test-results/`. They are never included in `dist/`. The Node tests cover bundled-ROM integrity, memory location, target filtering, native damage queuing, coordinate transforms, cooldown, free shots, wall sweeps, target loss, scrolling, dungeon floors, ROM collision decoding, story progression, compass coordinates, and invalid inputs. The browser test verifies an empty-room shot hitting a real house wall, compass text/toggle relaying to the tablet, and native enemy damage through the emulator.

## Implementation and references

- `dist/app.js`: UI, automatic bundled-game loading, ROM validation, controller input, save states, audio routing and canvas streaming.
- `dist/network.js`: PeerJS room pairing, WebRTC media/data, heartbeat and reconnection.
- `dist/zelda.js`: verified USA RAM map and conservative damage adapter. It locates the 128 KiB live WRAM by matching a Snes9x save snapshot, excluding serialized copies, checking the live frame counter, then verifying a second snapshot. It never writes to an unverified memory address.
- `dist/fairy.js`: movement, auto-targeting, free shots, projectile sweeps, bursts and drawing.
- `dist/collision.js`: live dungeon and overworld wall detection.
- `dist/guidance.js`: story milestones, ROM entrance coordinates, objective hints and compass drawing.
- [EmulatorJS 4.2.3](https://github.com/EmulatorJS/EmulatorJS/tree/v4.2.3) is loaded from its versioned CDN. [GameManager source](https://github.com/EmulatorJS/EmulatorJS/blob/v4.2.3/data/src/GameManager.js) documents the actual input and state interfaces used here.
- [snesrev/zelda3 variables](https://github.com/snesrev/zelda3/blob/master/src/variables.h), [sprite damage handling](https://github.com/snesrev/zelda3/blob/master/src/sprite.c), and [sprite dispatch table](https://github.com/snesrev/zelda3/blob/master/src/sprite_main.c) were consulted to verify RAM addresses and target types.
- Collision and guidance also use the original [tile detection](https://github.com/snesrev/zelda3/blob/master/src/tile_detect.c), [map progress masks](https://github.com/snesrev/zelda3/blob/master/src/messaging.c), and [ROM entrance/table layout](https://github.com/snesrev/zelda3/blob/master/assets/extract_resources.py).
- [PeerJS](https://peerjs.com/client/getting-started) 1.5.5 is vendored with its license in `dist/vendor/`. EmulatorJS is GPL-3.0; Snes9x uses its own license and is fetched by EmulatorJS from its CDN. The Google Fonts stylesheet is optional; system font fallbacks are provided.

Real Android performance, Wi-Fi latency, heat and audio behavior depend on the devices. Desktop browser integration testing cannot replace a session on the physical phone and tablet.
