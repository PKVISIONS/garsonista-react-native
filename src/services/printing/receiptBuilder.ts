/**
 * ESC/POS bytes for Greek thermal printers (ISO-8859-7 on device — test on hardware).
 */
export function buildSimpleOrderReceiptEscPos(lines: string[]): Uint8Array {
  const escInit = new Uint8Array([0x1b, 0x40]);
  const escAlignCenter = new Uint8Array([0x1b, 0x61, 0x01]);
  const escAlignLeft = new Uint8Array([0x1b, 0x61, 0x00]);
  const lf = new Uint8Array([0x0a]);
  const text = lines.join('\n') + '\n\n\n';
  const body = new TextEncoder().encode(text);
  const out = new Uint8Array(
    escInit.length +
      escAlignCenter.length +
      body.length +
      escAlignLeft.length +
      lf.length +
      3,
  );
  let o = 0;
  out.set(escInit, o);
  o += escInit.length;
  out.set(escAlignCenter, o);
  o += escAlignCenter.length;
  out.set(body, o);
  o += body.length;
  out.set(escAlignLeft, o);
  o += escAlignLeft.length;
  out.set(lf, o);
  o += lf.length;
  out[o++] = 0x1d;
  out[o++] = 0x56;
  out[o++] = 0x00;
  return out;
}
