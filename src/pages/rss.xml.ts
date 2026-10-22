/** /rss.xml — RSS 2.0 feed of published blog posts, newest first (linked from every page's <head>). */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "../lib/site.config";
import { absoluteUrl, blogPostPath } from "../lib/structured-data";
import { xmlEscape, xmlResponse } from "../lib/sitemap";

export const GET: APIRoute = async () => {
  const posts = (await getCollection("blog", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
  const items = posts
    .map((post) => {
      const url = absoluteUrl(blogPostPath(post));
      const author = post.data.author === "AI" ? `${site.name} AI` : "Jim Sawicki";
      return `<item>
  <title>${xmlEscape(post.data.title)}</title>
  <link>${xmlEscape(url)}</link>
  <guid isPermaLink="true">${xmlEscape(url)}</guid>
  <pubDate>${post.data.date.toUTCString()}</pubDate>
  <category>${xmlEscape(post.data.tag)}</category>
  <dc:creator>${xmlEscape(author)}</dc:creator>
  <description>${xmlEscape(post.data.excerpt)}</description>
</item>`;
    })
    .join("\n");

  return xmlResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${xmlEscape(`${site.name} — Market Updates`)}</title>
  <link>${xmlEscape(absoluteUrl("/blog"))}</link>
  <atom:link href="${xmlEscape(absoluteUrl("/rss.xml"))}" rel="self" type="application/rss+xml" />
  <description>Twin Cities real estate market updates from ${xmlEscape(site.name)}.</description>
  <language>en-us</language>
${items}
</channel>
</rss>
`,
    "application/rss+xml",
  );
};
