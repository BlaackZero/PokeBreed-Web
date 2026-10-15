// BMP (como los guarda Game Maker 5) → PNG con transparencia.
import zlib from 'node:zlib';

/** Decodifica un BMP sin comprimir (1/4/8/24/32 bits) a RGBA. */
export function decodeBmp(buf) {
  if (buf.toString('latin1', 0, 2) !== 'BM') throw new Error('No es un BMP');
  const dataOffset = buf.readUInt32LE(10);
  const headerSize = buf.readUInt32LE(14);
  const width = buf.readInt32LE(18);
  const rawHeight = buf.readInt32LE(22);
  const bpp = buf.readUInt16LE(28);
  const compression = buf.readUInt32LE(30);
  if (compression !== 0 && compression !== 3) throw new Error(`Compresión BMP no soportada: ${compression}`);
  const height = Math.abs(rawHeight);
  const bottomUp = rawHeight > 0;
  const colors = buf.readUInt32LE(46) || (bpp <= 8 ? 1 << bpp : 0);
  const palette = [];
  for (let i = 0; i < colors; i++) {
    const o = 14 + headerSize + i * 4;
    palette.push([buf[o + 2], buf[o + 1], buf[o]]);
  }
  const stride = Math.ceil((width * bpp) / 32) * 4;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = dataOffset + (bottomUp ? height - 1 - y : y) * stride;
    for (let x = 0; x < width; x++) {
      let r, g, b, a = 255;
      if (bpp === 24 || bpp === 32) {
        const o = row + x * (bpp / 8);
        b = buf[o]; g = buf[o + 1]; r = buf[o + 2];
      } else if (bpp === 16) {
        const v = buf.readUInt16LE(row + x * 2);
        r = ((v >> 10) & 31) << 3; g = ((v >> 5) & 31) << 3; b = (v & 31) << 3;
      } else {
        const bit = x * bpp;
        const byte = buf[row + (bit >> 3)];
        const idx = (byte >> (8 - bpp - (bit & 7))) & ((1 << bpp) - 1);
        [r, g, b] = palette[idx] ?? [0, 0, 0];
      }
      const o = (y * width + x) * 4;
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a;
    }
  }
  return { width, height, rgba };
}

/** Game Maker usa el color del píxel inferior izquierdo como transparente. */
export function applyColorKey(img) {
  const { width, height, rgba } = img;
  const o = (height - 1) * width * 4;
  const [kr, kg, kb] = [rgba[o], rgba[o + 1], rgba[o + 2]];
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] === kr && rgba[i + 1] === kg && rgba[i + 2] === kb) rgba[i + 3] = 0;
  }
  return img;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

export function encodePng({ width, height, rgba }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
