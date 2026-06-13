/*
  LSB Steganography (RGBA) for hiding UTF-8 text inside an image.

  Payload layout (bytes):
  - magic: 8 bytes  ("M05639L1")
  - version: 1 byte (0x01)
  - flags: 1 byte   (bit0 = 1 if passphrase XOR used)
  - length: 4 bytes big-endian payload length in bytes (after XOR)
  - payload: N bytes (UTF-8 bytes of message, optionally XOR’d)

  Bits are written in row-major order across the image’s RGBA bytes:
  channelByteIndex -> bitIndex -> set LSB.
*/

const MAGIC = new TextEncoder().encode('M05639L1'); // 8 bytes
const VERSION = 1;

function utf8ToBytes(str) {
  return new TextEncoder().encode(str);
}

function bytesToUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}

function bytesXorKeystream(bytes, passphrase) {
  if (!passphrase) return bytes;

  // Deterministic 32-bit FNV-1a hash from passphrase as PRNG seed.
  let h = 0x811c9dc5;
  for (let i = 0; i < passphrase.length; i++) {
    h ^= passphrase.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  const out = new Uint8Array(bytes.length);

  // xorshift32 keystream
  let x = h >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x >>>= 0;
    x ^= x << 5;
    x >>>= 0;

    const keyByte = x & 0xff;
    out[i] = bytes[i] ^ keyByte;
  }

  return out;
}

function buildPacket(messageBytes, passphraseProvided) {
  const flags = passphraseProvided ? 0x01 : 0x00;

  // payloadBytes are already XOR’d if passphraseProvided.
  const header = new Uint8Array(8 + 1 + 1 + 4);
  header.set(MAGIC, 0);
  header[8] = VERSION;
  header[9] = flags;

  const len = messageBytes.length;
  header[10] = (len >>> 24) & 0xff;
  header[11] = (len >>> 16) & 0xff;
  header[12] = (len >>> 8) & 0xff;
  header[13] = len & 0xff;

  const packet = new Uint8Array(header.length + messageBytes.length);
  packet.set(header, 0);
  packet.set(messageBytes, header.length);
  return packet;
}

function getCapacityBytes(imageData) {
  // Each RGBA byte holds 1 bit in its LSB.
  const totalBytes = imageData.data.length;
  const capacityBits = totalBytes;
  const capacityBytes = Math.floor(capacityBits / 8);
  return { capacityBits, capacityBytes };
}

function setBitToLsb(byteValue, bit) {
  return (byteValue & 0xfe) | (bit & 1);
}

function readLsb(byteValue) {
  return byteValue & 1;
}

function packetToBits(packet) {
  const bits = new Uint8Array(packet.length * 8);
  let bi = 0;
  for (let i = 0; i < packet.length; i++) {
    const b = packet[i];
    for (let k = 7; k >= 0; k--) {
      bits[bi++] = (b >>> k) & 1;
    }
  }
  return bits;
}

function bitsToBytes(bits) {
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    let v = 0;
    for (let k = 0; k < 8; k++) {
      v = (v << 1) | (bits[i * 8 + k] & 1);
    }
    bytes[i] = v;
  }
  return bytes;
}

async function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    const loaded = new Promise((resolve, reject) => {
      img.onload = () => resolve(true);
      img.onerror = () => reject(new Error('Failed to load image'));
    });
    img.src = url;
    await loaded;
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function encodeTextToImage({ imageFile, message, passphrase = '' }) {
  if (!imageFile) throw new Error('Please provide an image file');
  if (typeof message !== 'string') throw new Error('Message must be a string');

  const img = await loadImageFromFile(imageFile);

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const { capacityBytes } = getCapacityBytes(imageData);

  const messageBytesUtf8 = utf8ToBytes(message);
  const usePass = passphrase.trim().length > 0;
  const payloadBytes = usePass
    ? bytesXorKeystream(messageBytesUtf8, passphrase.trim())
    : messageBytesUtf8;

  const packet = buildPacket(payloadBytes, usePass);

  if (packet.length > capacityBytes) {
    // packet includes header + payload.
    throw new Error(
      `Message too large for this image. Max payload size is ${Math.max(
        0,
        capacityBytes - (8 + 1 + 1 + 4)
      )} bytes (UTF-8).`
    );
  }

  const bits = packetToBits(packet);

  // Write bits into LSBs of the image data bytes.
  const data = imageData.data;
  if (bits.length > data.length) throw new Error('Internal error: capacity mismatch');

  for (let i = 0; i < bits.length; i++) {
    data[i] = setBitToLsb(data[i], bits[i]);
  }

  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) return reject(new Error('Failed to generate stego image'));
      resolve(b);
    });
  });

  return {
    stegoBlob: blob,
    meta: {
      width: canvas.width,
      height: canvas.height,
      capacityBytes,
      embeddedBytes: packet.length,
      messageBytes: messageBytesUtf8.length,
      usedPassphrase: usePass
    }
  };
}

export async function decodeTextFromImage({ imageFile, passphrase = '' }) {
  if (!imageFile) throw new Error('Please provide an image file');

  const img = await loadImageFromFile(imageFile);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Read header bits first: magic(8 bytes) + version(1) + flags(1) + length(4) = 14 bytes
  const headerBytesLen = 8 + 1 + 1 + 4;
  const headerBitsLen = headerBytesLen * 8;
  if (headerBitsLen > data.length) throw new Error('Image is too small to contain data');

  const headerBits = new Uint8Array(headerBitsLen);
  for (let i = 0; i < headerBitsLen; i++) headerBits[i] = readLsb(data[i]);
  const headerBytes = bitsToBytes(headerBits);

  // Validate magic
  for (let i = 0; i < MAGIC.length; i++) {
    if (headerBytes[i] !== MAGIC[i]) {
      throw new Error('No valid steganography payload found (invalid header).');
    }
  }

  const version = headerBytes[8];
  if (version !== VERSION) {
    throw new Error(`Unsupported steganography version: ${version}`);
  }

  const flags = headerBytes[9];
  const usedPassphrase = (flags & 0x01) === 0x01;

  const len =
    (headerBytes[10] << 24) |
    (headerBytes[11] << 16) |
    (headerBytes[12] << 8) |
    headerBytes[13];

  const payloadLen = len >>> 0; // ensure unsigned
  const payloadBitsLen = payloadLen * 8;

  const totalBitsNeeded = headerBitsLen + payloadBitsLen;
  if (totalBitsNeeded > data.length) {
    throw new Error('Corrupted steganography payload (length exceeds image capacity).');
  }

  const payloadBits = new Uint8Array(payloadBitsLen);
  for (let i = 0; i < payloadBitsLen; i++) {
    payloadBits[i] = readLsb(data[headerBitsLen + i]);
  }

  const payloadBytes = bitsToBytes(payloadBits);

  let messageBytes = payloadBytes;
  if (usedPassphrase) {
    const key = passphrase.trim();
    if (!key) {
      throw new Error('This payload is protected by a passphrase. Please provide it to decode.');
    }
    messageBytes = bytesXorKeystream(payloadBytes, key);
  }

  let message;
  try {
    message = bytesToUtf8(messageBytes);
  } catch {
    throw new Error('Failed to decode text from payload.');
  }

  return {
    message,
    meta: {
      width: canvas.width,
      height: canvas.height,
      payloadBytes: payloadLen,
      usedPassphrase
    }
  };
}

