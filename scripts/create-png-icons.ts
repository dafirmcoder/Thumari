import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PUBLIC_DIR } from '../src/paths.js';

// Simple valid uncompressed/deflated RGBA PNG generator in pure Node.js
function createRgbaPng(width: number, height: number, r: number, g: number, b: number, a = 255): Buffer {
  const bytesPerPixel = 4;
  const rowBytes = width * bytesPerPixel + 1; // 1 filter byte per row
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * bytesPerPixel;
      
      // Draw rounded border effect or stylized center
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isInner = dist < (width * 0.35);

      if (isInner) {
        rawData[pxOffset] = 251;     // Gold / Accent R
        rawData[pxOffset + 1] = 191; // Gold G
        rawData[pxOffset + 2] = 36;  // Gold B
        rawData[pxOffset + 3] = 255;
      } else {
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = a;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);

    const toCrc = Buffer.concat([typeBuf, data]);
    const crc = crc32(toCrc);
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([length, typeBuf, data, crcBuf]);
  }

  function crc32(buf: Buffer): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i]!;
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: RGBA (6)
  ihdrData[10] = 0; // Compression: 0
  ihdrData[11] = 0; // Filter: 0
  ihdrData[12] = 0; // Interlace: 0

  const ihdrChunk = chunk('IHDR', ihdrData);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

async function main() {
  const iconsDir = path.join(PUBLIC_DIR, 'icons');
  fs.mkdirSync(iconsDir, { recursive: true });

  const icon512 = createRgbaPng(512, 512, 2, 132, 199);
  const icon192 = createRgbaPng(192, 192, 2, 132, 199);
  const iconMaskable = createRgbaPng(512, 512, 3, 105, 161);
  const appleTouch = createRgbaPng(180, 180, 2, 132, 199);

  fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), icon512);
  fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), icon192);
  fs.writeFileSync(path.join(iconsDir, 'icon-maskable.png'), iconMaskable);
  fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), appleTouch);

  console.log('Generated PNG icons in public/icons/');
}

main().catch(console.error);
