/**
 * Link-preview cards (Open Graph images, 1200×630) for blog posts, drawn at build time:
 * satori lays out the card and turns the text into shapes, sharp rasterizes it to PNG.
 * Build-only (devDependencies): blog pages are prerendered, so the PNGs are static files.
 *
 * The card names our brokerage (Coldwell Banker Realty logo): a shared post is advertising,
 * and Minnesota requires the brokerage name in ads (Minn. Stat. 82.69).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import sharp from "sharp";
import { brandColors, brokerage, site } from "./site.config";

/** Card size recommended by Facebook, LinkedIn and X (1.91:1). */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** What a blog card shows. */
export interface BlogCard {
  title: string;
  /** Short label above the title, e.g. "Rates". */
  tag: string;
  date: Date;
}

// Satori takes React-element-shaped objects; this keeps the layout readable without JSX.
type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): Node => ({
  type,
  props: { style, children: children.length === 1 ? children[0] : children },
});

const fromRoot = (...p: string[]) => path.join(process.cwd(), ...p);
let assets: Promise<{
  fonts: { name: string; data: Buffer; weight: 400 | 600 | 700 }[];
  logo: string;
}> | null = null;

/** Fonts and the brokerage logo, loaded once per build. */
function loadAssets() {
  assets ??= (async () => {
    const font = (w: number) =>
      readFile(
        fromRoot("node_modules", "@fontsource", "inter", "files", `inter-latin-${w}-normal.woff`),
      );
    const [regular, semibold, bold] = await Promise.all([font(400), font(600), font(700)]);
    const logoSrc = brokerage.logo?.src ?? "";
    const logo = logoSrc
      ? `data:image/png;base64,${(await readFile(fromRoot("public", logoSrc))).toString("base64")}`
      : "";
    return {
      fonts: [
        { name: "Inter", data: regular, weight: 400 as const },
        { name: "Inter", data: semibold, weight: 600 as const },
        { name: "Inter", data: bold, weight: 700 as const },
      ],
      logo,
    };
  })();
  return assets;
}

/** Renders a blog post's preview card as PNG bytes. */
export async function renderBlogCard(card: BlogCard): Promise<Buffer> {
  const { fonts, logo } = await loadAssets();
  // Long titles step down so they fit in three lines.
  const titleSize = card.title.length > 80 ? 52 : card.title.length > 55 ? 60 : 68;
  const dateText = card.date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const logoHeight = 52;
  const logoWidth = brokerage.logo
    ? Math.round((brokerage.logo.width / brokerage.logo.height) * logoHeight)
    : 0;

  const tree = h(
    "div",
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      display: "flex",
      backgroundColor: "#fafaf9",
      fontFamily: "Inter",
    },
    // ── Brand bar ──
    h("div", { width: 18, height: "100%", backgroundColor: brandColors.navy }),
    h(
      "div",
      {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px 56px 64px",
      },
      // ── Tag + title ──
      h(
        "div",
        { display: "flex", flexDirection: "column" },
        h(
          "div",
          {
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#b45309",
            marginBottom: 24,
          },
          card.tag,
        ),
        h(
          "div",
          {
            fontSize: titleSize,
            fontWeight: 600,
            lineHeight: 1.15,
            color: "#1c1917",
            display: "block",
            lineClamp: 3,
          },
          card.title,
        ),
      ),
      // ── Who + when, and the brokerage ──
      h(
        "div",
        { display: "flex", alignItems: "flex-end", justifyContent: "space-between" },
        h(
          "div",
          { display: "flex", flexDirection: "column" },
          h("div", { fontSize: 32, fontWeight: 700, color: "#1c1917" }, site.name),
          h("div", { fontSize: 24, color: "#57534e", marginTop: 6 }, dateText),
        ),
        logo
          ? {
              type: "img",
              props: {
                src: logo,
                width: logoWidth,
                height: logoHeight,
                style: { display: "flex" },
              },
            }
          : h("div", { fontSize: 24, color: "#57534e" }, brokerage.name),
      ),
    ),
  );

  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts,
  });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
