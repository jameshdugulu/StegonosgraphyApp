# TODO - M05639-2026 Steganography App

## Plan Summary
Build a “Quick Crypto”-style steganography web app named **M05639-2026** that can:
- Embed a secret text message into an uploaded image using LSB steganography.
- Optionally protect the message with a key.
- Extract the message from a stego image.

## Steps
- [x] Implement LSB encode/decode module in `src/steg/lsbSteg.js` (header + UTF-8 payload + optional XOR passphrase + capacity checks).
- [x] Replace `src/App.jsx` UI with embed/extract workflow and results/errors handling.
- [x] Update `src/App.css` to match new UI (cards, inputs, preview areas).
- [ ] Run `npm run dev` and manually test embed/download/extract + wrong passphrase failure.

## Updated Task: replace payload key/passphrase with 8 built-in keys
- [ ] Update `src/steg/lsbSteg.js` to use `keyId` (0-7) instead of free-text `passphrase`.
- [ ] Update `src/App.jsx` UI: remove passphrase input, add selector for 8 built-in keys + “no key”.
- [ ] Update `src/App.css` (if needed) for key selector styling.
- [ ] Run `npm run dev` and test:
  - Embed/extract with each of the 8 keys
  - Embed without key + extract without key
  - Extract with wrong key should not recover correct text

