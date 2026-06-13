# TODO - M05639-2026 Steganography App

## Plan Summary
Build a “Quick Crypto”-style steganography web app named **M05639-2026** that can:
- Embed a secret text message into an uploaded image using LSB steganography.
- Optionally protect the message with a passphrase (XOR keystream derived from passphrase).
- Extract the message from a stego image.

## Steps
- [x] Implement LSB encode/decode module in `src/steg/lsbSteg.js` (header + UTF-8 payload + optional passphrase XOR + capacity checks).
- [x] Replace `src/App.jsx` UI with embed/extract workflow and results/errors handling.
- [x] Update `src/App.css` to match new UI (cards, inputs, preview areas).
- [ ] Run `npm run dev` and manually test embed/download/extract + wrong passphrase failure.


