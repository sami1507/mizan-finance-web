// Reproducible vector-first assets. No remote requests, user data or system fonts.
// Sharp is supplied by the locked Next.js dependency tree.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const directory = path.join(root, "public", "brand");
await mkdir(directory, { recursive: true });
await mkdir(path.join(root, "docs", "screenshots"), { recursive: true });

const colors = { navy: "#172d38", ivory: "#f7f5f0", emerald: "#087f60", gold: "#ac8b4d", lightGold: "#d5bc80", white: "#ffffff" };
const markPath = "M10 47V28c0-6 3.5-10 8.5-10S27 22 27 28v19M27 28c0-6 3.5-10 8.5-10S44 22 44 28v19";
const mark = (ink, accent) => `<g fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="${markPath}"/></g><circle cx="55" cy="44" r="4" fill="${accent}"/>`;
// Custom, outlined lettering keeps downloadable SVGs independent of installed fonts.
const word = ink => `<g fill="none" stroke="${ink}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"><path d="M0 33V19c0-5 3-8 7.5-8S15 14 15 19v14M15 19c0-5 3-8 7.5-8S30 14 30 19v14M46 12v21M61 12h22L61 33h22M116 12v21M116 22.5c0-6.5-4.7-11.5-10.5-11.5S95 16 95 22.5 99.7 34 105.5 34 116 29 116 22.5M132 33V19c0-5 3.4-8 8-8s8 3 8 8v14"/></g><circle cx="46" cy="2" r="2.8" fill="${ink}"/>`;
const finance = ink => `<g fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="round"><path d="M0 11V0h7M0 5h6M16 0v11M25 11V0l8 11V0M42 11l4-11 4 11M43.5 7h5M59 11V0l8 11V0M84 1c-7-4-10 13 0 9M94 0h7M94 0v11h7M94 5h6"/></g>`;
const logo = (ink, accent) => `<g transform="translate(12 19)">${mark(ink, accent)}</g><g transform="translate(102 23) scale(1.35)">${word(ink)}</g><g transform="translate(104 81)">${finance(ink)}</g>`;
const svg = (width, height, content, label) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}"><title>${label}</title>${content}</svg>`;
const assets = [];
async function save(name, content, width, height, description) {
  const source = svg(width, height, content, description);
  await writeFile(path.join(directory, `${name}.svg`), `${source}\n`);
  const pngWidth = name.startsWith("logo-") ? 1044 : 512;
  await sharp(Buffer.from(source)).resize({ width: pngWidth }).png().toFile(path.join(directory, `${name}.png`));
  assets.push({ name, svg: `${name}.svg`, png: `${name}.png`, viewBox: [width, height], pngWidth, transparent: true, description });
}
for (const [name, ink, accent] of [
  ["on-light", colors.navy, colors.gold],
  ["on-dark", colors.ivory, colors.lightGold],
  ["black", "#000000", "#000000"],
  ["white", "#ffffff", "#ffffff"],
]) {
  await save(`mark-${name}`, mark(ink, accent), 64, 64, `Mizan Finance symbol — ${name}`);
  await save(`logo-${name}`, logo(ink, accent), 348, 104, `Mizan Finance — ${name}`);
}
const icon = svg(64, 64, `<rect width="64" height="64" rx="14" fill="${colors.navy}"/><g transform="translate(4 4) scale(.875)">${mark(colors.ivory, colors.lightGold)}</g>`, "Mizan Finance");
await writeFile(path.join(root, "src", "app", "icon.svg"), `${icon}\n`);
await writeFile(path.join(directory, "app-icon.svg"), `${icon}\n`);
await sharp(Buffer.from(icon)).resize(512, 512).png().toFile(path.join(directory, "app-icon-512.png"));
await sharp(Buffer.from(icon)).resize(192, 192).png().toFile(path.join(directory, "app-icon-192.png"));
await sharp(Buffer.from(icon)).resize(180, 180).png().toFile(path.join(root, "src", "app", "apple-icon.png"));

// A restrained editorial share card: actual brand artwork, no invented product metrics.
const social = svg(1200, 630, `<rect width="1200" height="630" fill="${colors.ivory}"/><path d="M80 80h1040v470H80Z" fill="none" stroke="#d9dfdf"/><path d="M80 80h180" stroke="${colors.gold}" stroke-width="3"/><g transform="translate(174 145) scale(2.45)">${logo(colors.navy, colors.gold)}</g><path d="M300 478h600" stroke="#d9dfdf"/><path d="M560 520h80" stroke="${colors.emerald}" stroke-width="3"/>`, "Mizan Finance — personal finance, in balance");
await writeFile(path.join(directory, "social-share.svg"), `${social}\n`);
await sharp(Buffer.from(social)).png().toFile(path.join(directory, "social-share.png"));

const board = svg(1200, 850, `<rect width="1200" height="850" fill="${colors.ivory}"/><g transform="translate(60 38) scale(1.4)">${logo(colors.navy, colors.gold)}</g><path d="M60 215h1080" stroke="#d9dfdf"/><rect x="60" y="255" width="520" height="230" rx="12" fill="white"/><g transform="translate(142 313)">${logo(colors.navy, colors.gold)}</g><rect x="620" y="255" width="520" height="230" rx="12" fill="${colors.navy}"/><g transform="translate(702 313)">${logo(colors.ivory, colors.lightGold)}</g><g transform="translate(60 545) scale(1.5)">${mark("#000000", "#000000")}</g><rect x="210" y="545" width="96" height="96" rx="14" fill="${colors.navy}"/><g transform="translate(210 545) scale(1.5)">${mark("#ffffff", "#ffffff")}</g><g transform="translate(370 562) scale(.5)">${mark(colors.navy, colors.gold)}</g><g transform="translate(438 554) scale(.75)">${mark(colors.navy, colors.gold)}</g><g transform="translate(528 545)">${mark(colors.navy, colors.gold)}</g>${[colors.navy,colors.ivory,colors.emerald,colors.gold,"#ae3838","#805b20"].map((color,i) => `<rect x="${60+i*180}" y="714" width="160" height="76" rx="8" fill="${color}" stroke="#d9dfdf"/>`).join("")}`, "Mizan brand assets: light, dark, monochrome, small sizes and colors");
await sharp(Buffer.from(board)).png().toFile(path.join(root, "docs", "screenshots", "brand-board.png"));
await writeFile(path.join(directory, "manifest.json"), `${JSON.stringify({ version: 1, artwork: "Original geometric Mizan m-dot mark and outlined lettering authored for this project; no external bitmap or font embedded in logo SVGs.", colors, assets, appIcons: ["app-icon.svg", "app-icon-192.png", "app-icon-512.png"], social: { svg: "social-share.svg", png: "social-share.png", width: 1200, height: 630, transparent: false } }, null, 2)}\n`);
console.log(`Generated Mizan SVG/PNG brand assets at ${directory}`);
