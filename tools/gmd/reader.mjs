// Lector binario para archivos de proyecto de Game Maker 5.3 (.gmd, versión 530).
import zlib from 'node:zlib';

export class Reader {
  constructor(buf) { this.b = buf; this.p = 0; }
  int() { const v = this.b.readInt32LE(this.p); this.p += 4; return v; }
  bool() { return this.int() !== 0; }
  double() { const v = this.b.readDoubleLE(this.p); this.p += 8; return v; }
  str() {
    const n = this.int();
    if (n < 0 || n > 10_000_000) throw new Error(`Longitud de cadena inválida ${n} en ${this.p - 4}`);
    const s = this.b.toString('latin1', this.p, this.p + n);
    this.p += n;
    return s;
  }
  bytes(n) { const s = this.b.subarray(this.p, this.p + n); this.p += n; return s; }
  /** Bloque comprimido con zlib precedido de su tamaño. */
  zblock() { return zlib.inflateSync(this.bytes(this.int())); }
  expect(v, what) {
    const at = this.p;
    const got = this.int();
    const ok = Array.isArray(v) ? v.includes(got) : got === v;
    if (!ok) throw new Error(`${what}: se esperaba ${v} y llegó ${got} en ${at}`);
    return got;
  }
}
