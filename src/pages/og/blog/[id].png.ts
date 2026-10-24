/**
 * /og/blog/<post>.png — each published post's link-preview card (lib/og-image.ts), built
 * once at build time as a static file. Blog post pages point og:image here.
 */
import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import { renderBlogCard } from "../../../lib/og-image";

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  // Same posts as the blog pages: drafts only in dev.
  const posts = await getCollection("blog", ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.map((post) => ({ params: { id: post.id }, props: { post } }));
};

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: CollectionEntry<"blog"> };
  const png = await renderBlogCard({
    title: post.data.title,
    tag: post.data.tag,
    date: post.data.date,
  });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
};
