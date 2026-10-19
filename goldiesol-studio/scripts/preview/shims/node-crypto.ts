// Just enough of node:crypto for the seed ids (SHA-1) and new record ids.
export const randomUUID = () => crypto.randomUUID();

function sha1(bytes: Uint8Array): Uint8Array {
  const ml = bytes.length * 8;
  const withPad = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  withPad.set(bytes);
  withPad[bytes.length] = 0x80;
  const view = new DataView(withPad.buffer);
  view.setUint32(withPad.length - 4, ml >>> 0);
  view.setUint32(withPad.length - 8, Math.floor(ml / 2 ** 32));
  let [h0, h1, h2, h3, h4] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Uint32Array(80);
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  for (let off = 0; off < withPad.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let [a, b, c, d, e] = [h0, h1, h2, h3, h4];
    for (let i = 0; i < 80; i++) {
      const [f, k] =
        i < 20 ? [(b & c) | (~b & d), 0x5a827999] : i < 40 ? [b ^ c ^ d, 0x6ed9eba1] : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6];
      const t = (rotl(a, 5) + f + e + k + w[i]) | 0;
      [e, d, c, b, a] = [d, c, rotl(b, 30), a, t];
    }
    [h0, h1, h2, h3, h4] = [(h0 + a) | 0, (h1 + b) | 0, (h2 + c) | 0, (h3 + d) | 0, (h4 + e) | 0];
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h));
  return out;
}

class Digest extends Uint8Array {
  toString(enc?: string) {
    return enc === 'hex' ? [...this].map((b) => b.toString(16).padStart(2, '0')).join('') : super.toString();
  }
}

export function createHash(alg: string) {
  if (alg !== 'sha1') throw new Error(`Unsupported hash ${alg}`);
  let input = '';
  const api = {
    update(s: string) {
      input += s;
      return api;
    },
    digest() {
      const d = new Digest(sha1(new TextEncoder().encode(input)));
      return d;
    },
  };
  return api;
}
