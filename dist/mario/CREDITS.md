# Credits and dependencies

- **Super Mario Bros. 3**: original game, artwork, music and level data by Nintendo.
  ROM supplied by the project owner. This is an unofficial co-op project.
- **Southbird SMB3 disassembly**: https://github.com/captainsouthbird/smb3,
  commit `09b1bd81a788de8ceec664a34094e84ddb463117`.
  Original project: http://www.sonicepoch.com/sm3mix/ .
  Used to verify the exact ROM revision, identify gameplay memory, and understand
  scrolling, object state, tile collision, weapon hit flags and transitions.
  Research checkouts are not published.
- **JSNES 2.1.0**: https://github.com/bfirsh/jsnes, Apache-2.0.
  Source is vendored in `site/vendor/jsnes/`; license in `site/vendor/jsnes-LICENSE`.
  Local changes in `ppu/index.js`: correct the odd-bank 8x16 sprite base index;
  detach cached pattern tiles before deserializing a snapshot; optional Mario sprite hiding and per-sprite CHR selection for transformations. `cpu.js` also supports optional address-scoped runtime hooks. The runtime and
  engine tests both use this same vendored source.
- **PeerJS 1.5.5**: https://github.com/peers/peerjs, MIT.
  Browser bundle and license in `site/vendor/`.
- **ErikHK/smb32p**: https://github.com/ErikHK/smb32p, prior simultaneous-play
  research reviewed during investigation. Its fish-character patch is not used.
- **Fairy Link / Zelda Tab**: the owner's existing family game supplies the
  three-player connection layer, learning curriculum and question view, joystick
  and IndexedDB helpers. Dragon/unicorn drawings and this family game UI are
  implemented locally in Canvas/CSS. All UI fonts are system fonts.

- **Mario: Copy Kingdom**: the owner's local `easy_apps/mario_computer` project supplies all 120 form definitions, movement and attack runtime, original-ROM sprite presets and rendering in `site/copy-forms/`, plus the optional JSNES hooks. The family adapter shares Dad's existing emulator and grants forms through Michelle's gifts. The source project is unchanged.
