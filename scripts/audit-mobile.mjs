/**
 * Responsive audit: loads key pages at phone, tablet and desktop widths in a headless
 * Chrome and reports layout problems. Run with the site up (default: `npm run dev`):
 *
 *   npm run audit:mobile                       # checks http://localhost:4321
 *   npm run audit:mobile -- http://host:port   # checks another server
 *
 * Reports, per page and width:
 *   - TOO WIDE: content wider than the screen (the page scrolls sideways or a phone
 *     zooms out to fit it), and which elements cause it
 *   - tap targets under 24px (fails WCAG 2.2) and under 44px (recommended minimum)
 *   - text smaller than 12px
 * and saves full-page phone screenshots to .audit/ for a visual check.
 *
 * Uses the locally installed Google Chrome (playwright-core downloads no browsers).
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const base = (process.argv[2] ?? "http://localhost:4321").replace(/\/$/, "");
const outDir = ".audit";
mkdirSync(outDir, { recursive: true });

const viewports = [
  { name: "phone", width: 375, height: 812, mobile: true },
  { name: "tablet", width: 768, height: 1024, mobile: true },
  { name: "desktop", width: 1280, height: 900, mobile: false },
];

const browser = await chromium.launch({ channel: "chrome", headless: true });

// ─── Pages to check: fixed routes + the first listing and blog post found ───────
const discover = await browser.newPage();
async function firstLink(path, pattern) {
  await discover.goto(base + path, { waitUntil: "load" });
  const hrefs = await discover.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
  return hrefs.find((h) => h && pattern.test(h));
}
const pages = ["/", "/listings", "/blog", "/about", "/contact", "/privacy"];
const listing = await firstLink("/listings", /^\/listings\/[a-z0-9-]+-\d+$/);
const post = await firstLink("/blog", /^\/blog\/[a-z0-9-]+$/);
if (listing) pages.push(listing);
if (post) pages.push(post);
await discover.close();

// ─── Audit ───────────────────────────────────────────────────────────────────
let problems = 0;
for (const vp of viewports) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
  });
  const page = await ctx.newPage();
  console.log(`\n── ${vp.name} (${vp.width}px) ──`);

  for (const path of pages) {
    try {
      await page.goto(base + path, { waitUntil: "load", timeout: 45000 });
    } catch (e) {
      console.log(`${path.padEnd(40)} LOAD FAILED: ${e.message.split("\n")[0]}`);
      problems++;
      continue;
    }
    await page.waitForTimeout(1000);

    const r = await page.evaluate((deviceWidth) => {
      const describe = (el) => {
        const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/) : [];
        return el.tagName.toLowerCase() + (cls.length ? "." + cls.slice(0, 4).join(".") : "");
      };
      const visible = (el) => {
        const s = getComputedStyle(el);
        const b = el.getBoundingClientRect();
        return s.display !== "none" && s.visibility !== "hidden" && b.width > 0 && b.height > 0;
      };
      // Elements past the right edge whose parent isn't: the root causes of overflow.
      // Elements inside a clipping ancestor (carousels, the map) don't widen the page.
      const clipped = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "hidden" || o === "auto" || o === "scroll" || o === "clip") return true;
        }
        return false;
      };
      const all = [...document.body.querySelectorAll("*")].filter(visible);
      const over = all.filter(
        (el) => el.getBoundingClientRect().right > deviceWidth + 1 && !clipped(el),
      );
      const causes = over.filter((el) => !over.includes(el.parentElement)).slice(0, 4);
      const taps = [
        ...document.querySelectorAll("a[href],button,input,select,textarea,summary"),
      ].filter(visible);
      const size = (el) => el.getBoundingClientRect();
      return {
        tooWideBy: document.documentElement.scrollWidth - deviceWidth,
        causes: causes.map((el) => `${describe(el)} (${Math.round(size(el).width)}px)`),
        taps: taps.length,
        under24: taps.filter((el) => size(el).height < 24 || size(el).width < 24).length,
        under44: taps.filter((el) => size(el).height < 44).length,
        smallText: all.filter(
          (el) =>
            [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) &&
            parseFloat(getComputedStyle(el).fontSize) < 12,
        ).length,
      };
    }, vp.width);

    const width = r.tooWideBy > 0 ? `TOO WIDE (${vp.width + r.tooWideBy}px)` : "fits";
    if (r.tooWideBy > 0) problems++;
    console.log(
      `${path.slice(0, 40).padEnd(40)} ${width.padEnd(18)} taps ${r.taps}: <24px ${r.under24}, <44px ${r.under44}` +
        (r.smallText ? ` | text <12px: ${r.smallText}` : ""),
    );
    if (r.causes.length) console.log(`    caused by: ${r.causes.join("; ")}`);
    if (vp.name === "phone") {
      const file = `${outDir}/phone${path.replace(/[^a-z0-9]+/gi, "_").slice(0, 60) || "_home"}.png`;
      await page.screenshot({ path: file, fullPage: true });
    }
  }
  await ctx.close();
}
await browser.close();

console.log(`\nPhone screenshots: ${outDir}/`);
console.log(problems ? `${problems} layout problem(s) found.` : "No pages wider than the screen.");
process.exitCode = problems ? 1 : 0;
