/**
 * /llms.txt — a plain-text guide to the site for AI assistants (llmstxt.org format).
 * Generated so URLs follow site.siteUrl and the blog list stays current.
 *
 * VERIFY-IDX: describes the listing pages but deliberately doesn't list listing data;
 * MLS rules restrict bulk reuse of it.
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { brokerage, office, site, team } from "../lib/site.config";
import { absoluteUrl, blogPostPath } from "../lib/structured-data";

export const GET: APIRoute = async () => {
  const posts = (await getCollection("blog", ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 20);

  const text = `# ${site.name}

> ${site.name} (${team.map((p) => p.name).join(" and ")}) is a Twin Cities real estate team
> with ${brokerage.name}, based at the ${office.name} office in Minnesota.
> ${site.tagline}.

The site offers a map search of homes for sale and pending in the Twin Cities and
Minnesota (listing data from ${brokerage.name}'s MLS, NorthstarMLS, under IDX rules),
a detail page per listing with neighborhood access ("Close to Home": nearby groceries,
parks, transit and more), and weekly market updates.

## Pages

- [Home](${absoluteUrl("/")})
- [Listings: map search](${absoluteUrl("/listings")}): homes for sale; each listing has its own page under /listings/
- [Market Updates](${absoluteUrl("/blog")}): Twin Cities market and mortgage-rate commentary
- [About](${absoluteUrl("/about")})
- [Contact](${absoluteUrl("/contact")})

## Recent market updates

${posts.map((p) => `- [${p.data.title}](${absoluteUrl(blogPostPath(p))}): ${p.data.excerpt}`).join("\n")}

## Machine-readable

- [Sitemap](${absoluteUrl("/sitemap.xml")})
- [RSS feed](${absoluteUrl("/rss.xml")})
- Every page carries schema.org JSON-LD (RealEstateAgent, RealEstateListing, BlogPosting, ...).
`;
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
