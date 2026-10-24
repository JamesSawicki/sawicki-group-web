/**
 * Builds the web copies of our team logo from the originals Jim supplied (2026-10-24) in
 * public/brand/sawicki/: trimmed, resized PNGs for each logo slot, plus the favicon and
 * home-screen icons. Run after replacing an original: `npm run brand:assets`.
 *
 * The originals are 1370×433 transparent PNGs with three bands: the SG key (rows 0–173),
 * the name (250–341) and the tagline (393–432). The SG letters alone are columns ~360–615.
 *
 * Also the Coldwell Banker Realty web copy (342 px wide) from its original in
 * public/brand/coldwell-banker/. CB's standards allow the framed logo only in CB Blue on
 * light backgrounds; on dark ones we use the white monogram logo (docs/brand.md).
 */
import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const dir = "public/brand/sawicki";
const NAVY = "#212c64"; // brandColors.navy in site.config.ts

/** Crops rows [top, bottom) of an original, trims the transparent edge, resizes to `width`. */
async function web(source, out, width, rows, folder = dir) {
  let img = sharp(`${folder}/${source}`);
  if (rows) {
    const { width: w } = await img.metadata();
    img = sharp(
      await img.extract({ left: 0, top: rows[0], width: w, height: rows[1] - rows[0] }).toBuffer(),
    );
  }
  const trimmed = await img.trim().toBuffer();
  const info = await sharp(trimmed)
    .resize({ width })
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(`${folder}/${out}`);
  console.log(`${out}: ${info.width}×${info.height}`);
}

/** A square navy icon with part of the reverse logo centered at `fill` of its width. */
async function icon(out, size, region, fill) {
  const part = await sharp(`${dir}/sawicki-full-reverse.png`).extract(region).trim().toBuffer();
  const inner = Math.round(size * fill);
  const art = await sharp(part).resize({ width: inner, height: inner, fit: "inside" }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: NAVY } })
    .composite([{ input: art, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer()
    .then(async (buf) => {
      if (out) await writeFile(out, buf);
      return buf;
    });
}

/** A .ico holding PNG images (every current browser reads PNG-in-ICO). */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, buf }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(buf.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.buf)]);
}

// ── Logo slots ──
await web("sawicki-full-color.png", "logo-full-web.png", 800);
await web("sawicki-full-reverse.png", "logo-full-on-dark-web.png", 800);
// Header: key + name, no tagline (it would be ~5px tall at header size).
await web("sawicki-full-color.png", "logo-compact-web.png", 640, [0, 346]);
await web("sawicki-full-reverse.png", "logo-compact-on-dark-web.png", 640, [0, 346]);
await web("sawicki-full-color.png", "mark-web.png", 400, [0, 174]);
await web("sawicki-full-reverse.png", "mark-on-dark-web.png", 400, [0, 174]);
const cb = "public/brand/coldwell-banker";
await web("cbr-horizontal-blue.png", "cbr-horizontal-blue-web.png", 342, null, cb);

// ── Icons ──
// Tab icons show only the SG letters: the long key turns into a hairline at 16–48px.
const letters = { left: 340, top: 0, width: 278, height: 174 };
const keyMark = { left: 340, top: 0, width: 740, height: 174 };
const tabSizes = [16, 32, 48];
const tabIcons = await Promise.all(
  tabSizes.map(async (size) => ({ size, buf: await icon(null, size, letters, 0.8) })),
);
await writeFile("public/favicon.ico", ico(tabIcons));
await icon("public/favicon-32.png", 32, letters, 0.8);
// Home-screen icons are big enough for the whole key mark.
await icon("public/apple-touch-icon.png", 180, keyMark, 0.8);
await icon("public/icon-512.png", 512, keyMark, 0.8);
console.log("favicon.ico (16/32/48), favicon-32.png, apple-touch-icon.png, icon-512.png");
