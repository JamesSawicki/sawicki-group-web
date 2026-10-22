/** /sitemap-blog.xml — every published (non-draft) blog post. */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { absoluteUrl, blogPostPath } from "../lib/structured-data";
import { urlset, xmlResponse } from "../lib/sitemap";

export const GET: APIRoute = async () => {
  // Drafts are excluded even in dev, so this always matches what production publishes.
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return xmlResponse(
    urlset(
      posts.map((post) => ({ loc: absoluteUrl(blogPostPath(post)), lastmod: post.data.date })),
    ),
  );
};
