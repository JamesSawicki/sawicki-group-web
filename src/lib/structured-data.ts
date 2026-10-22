/**
 * Structured data (schema.org JSON-LD) for every page.
 *
 * Every page's JSON-LD is one `@graph`: the site-wide entities (the website, the agency,
 * its people, the brokerage office) plus that page's own nodes. Entities refer to each
 * other by `@id` (`{siteUrl}/#organization`, `{pageUrl}#listing`, ...), so search engines
 * and AI tools see one connected set of facts instead of disconnected fragments.
 * Layout.astro adds the site entities; pages pass only their own nodes.
 *
 * Rules:
 *  - Only state what we know. No invented addresses, dates or contact details; omit
 *    a property when the data is missing.
 *  - VERIFY-IDX: a listing's offer is made by the listing brokerage (listOfficeName),
 *    never The Sawicki Group, matching the "Listed by" disclosure on the page.
 *  - Absolute URLs come from site.siteUrl (the canonical domain), never the request.
 */
import type { CollectionEntry } from "astro:content";
import type { Listing } from "../types/listing";
import { brokerage, office, site, social, team } from "./site.config";
import { listingPath } from "./listing-utils";

type Node = Record<string, unknown>;

// ─── URLs and ids ────────────────────────────────────────────────────────────

/** Absolute URL on the canonical domain for a site path ("/about" → "https://…/about"). */
export function absoluteUrl(path: string): string {
  return new URL(path, site.siteUrl + "/").toString();
}

export const WEBSITE_ID = `${site.siteUrl}/#website`;
export const ORGANIZATION_ID = `${site.siteUrl}/#organization`;
export const OFFICE_ID = `${site.siteUrl}/#office`;
/** Identifier of a team member's Person node, e.g. personId("jim-sawicki"). */
export const personId = (id: string): string => `${site.siteUrl}/#${id}`;

/** Drops undefined/null/"" values so absent data is omitted rather than asserted empty. */
function compact<T extends Node>(node: T): T {
  return Object.fromEntries(
    Object.entries(node).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  ) as T;
}

// ─── Site-wide entities ──────────────────────────────────────────────────────

/** The website, the agency, its people and the brokerage office (on every page). */
export function siteEntities(): Node[] {
  const officeAddress = office.streetAddress
    ? {
        "@type": "PostalAddress",
        streetAddress: office.streetAddress,
        addressLocality: office.addressLocality,
        addressRegion: office.addressRegion,
        postalCode: office.postalCode,
        addressCountry: "US",
      }
    : undefined; // VERIFY: fill office.streetAddress in site.config.ts

  return [
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: site.siteUrl,
      name: site.name,
      publisher: { "@id": ORGANIZATION_ID },
      inLanguage: "en-US",
    },
    compact({
      "@type": "RealEstateAgent",
      "@id": ORGANIZATION_ID,
      name: site.name,
      url: site.siteUrl,
      slogan: site.tagline,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(site.logoPath),
        width: 1200,
        height: 412,
      },
      image: absoluteUrl(site.ogImagePath),
      areaServed: {
        "@type": "AdministrativeArea",
        name: `${brokerage.serviceArea}`,
      },
      parentOrganization: { "@id": OFFICE_ID },
      employee: team.map((p) => ({ "@id": personId(p.id) })),
      sameAs: Object.values(social),
      address: officeAddress,
    }),
    compact({
      "@type": "RealEstateAgent",
      "@id": OFFICE_ID,
      name: office.name,
      parentOrganization: { "@type": "Organization", name: brokerage.name },
      address: officeAddress,
    }),
    ...team.map((p) =>
      compact({
        "@type": "Person",
        "@id": personId(p.id),
        name: p.name,
        jobTitle: "jobTitle" in p ? p.jobTitle : undefined,
        email: "email" in p ? `mailto:${p.email}` : undefined,
        telephone: "telephone" in p ? p.telephone : undefined,
        worksFor: { "@id": ORGANIZATION_ID },
        memberOf: { "@id": OFFICE_ID },
      }),
    ),
  ];
}

/** The full JSON-LD document for a page: site entities + the page's nodes. */
export function jsonLdDocument(pageNodes: Node[] = []): Node {
  return { "@context": "https://schema.org", "@graph": [...siteEntities(), ...pageNodes] };
}

// ─── Building blocks ─────────────────────────────────────────────────────────

/** A breadcrumb trail; Google shows it in place of the URL in results. */
export function breadcrumbList(pageUrl: string, items: { name: string; path: string }[]): Node {
  return {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** A plain page node (AboutPage, ContactPage, CollectionPage, ...). */
export function webPage(
  type: string,
  path: string,
  name: string,
  description?: string,
  extra: Node = {},
): Node {
  const url = absoluteUrl(path);
  return compact({
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: { "@id": WEBSITE_ID },
    ...extra,
  });
}

// ─── Listings ────────────────────────────────────────────────────────────────

/**
 * schema.org type for the home, from the RESO PropertySubType (same categories as the
 * search filter): condos are Apartments, single-family homes SingleFamilyResidence,
 * other houses (townhomes, twin homes, multi-family) House.
 */
function residenceType(propertyType: string | undefined): string {
  const t = propertyType ?? "";
  if (/^\(CC\)|High Rise|Low Rise|Apartment/i.test(t)) return "Apartment";
  if (/^Single Family/i.test(t)) return "SingleFamilyResidence";
  return "House";
}

const positive = (n: number | undefined | null): n is number => n != null && n > 0;

/**
 * Nodes for a listing page: the listing (a page about a home for sale), its offer and
 * the home itself, plus breadcrumbs.
 *
 * @param images absolute photo URLs, largest first (a few are enough)
 */
export function listingNodes(listing: Listing, images: string[]): Node[] {
  const url = absoluteUrl(listingPath(listing));
  const fullBaths = (listing.bathsFull ?? 0) + (listing.bathsThreeQuarter ?? 0);
  const partialBaths = (listing.bathsHalf ?? 0) + (listing.bathsQuarter ?? 0);
  const place = [listing.address, listing.city].filter(Boolean).join(", ");

  const features: Node[] = [];
  const feature = (name: string, value: unknown) =>
    features.push({ "@type": "LocationFeatureSpecification", name, value });
  if (positive(listing.garageStalls)) feature("Garage stalls", listing.garageStalls);
  if (positive(listing.fireplaces)) feature("Fireplaces", listing.fireplaces);
  if (positive(listing.waterfrontFeet)) feature("Waterfront (feet)", listing.waterfrontFeet);
  if (listing.pool && listing.pool !== "None") feature("Pool", true);

  const home = compact({
    "@type": residenceType(listing.propertyType),
    "@id": `${url}#home`,
    name: place,
    address: compact({
      "@type": "PostalAddress",
      streetAddress: listing.address,
      addressLocality: listing.city,
      addressRegion: "MN",
      postalCode: listing.zipCode,
      addressCountry: "US",
    }),
    geo:
      listing.latitude != null && listing.longitude != null
        ? { "@type": "GeoCoordinates", latitude: listing.latitude, longitude: listing.longitude }
        : undefined,
    numberOfBedrooms: positive(listing.beds) ? listing.beds : undefined,
    numberOfBathroomsTotal: fullBaths + partialBaths || undefined,
    numberOfFullBathrooms: fullBaths || undefined,
    numberOfPartialBathrooms: partialBaths || undefined,
    floorSize: positive(listing.sqftTotal)
      ? {
          "@type": "QuantitativeValue",
          value: listing.sqftTotal,
          unitCode: "FTK",
          unitText: "sq ft",
        }
      : undefined,
    yearBuilt: positive(listing.yearBuilt) ? listing.yearBuilt : undefined,
    additionalProperty: positive(listing.lotSqft)
      ? [
          {
            "@type": "PropertyValue",
            name: "Lot size",
            value: Number((listing.lotSqft / 43560).toFixed(2)),
            unitText: "acres",
          },
        ]
      : undefined,
    amenityFeature: features.length ? features : undefined,
    image: images.length ? images : undefined,
  });

  const offer = compact({
    "@type": "Offer",
    price: listing.listPrice,
    priceCurrency: "USD",
    businessFunction: "http://purl.org/goodrelations/v1#Sell",
    // A pending sale is still listed, but not available to new buyers.
    availability:
      listing.status === "Pending"
        ? "https://schema.org/LimitedAvailability"
        : "https://schema.org/InStock",
    // VERIFY-IDX: the listing brokerage offers the home, never The Sawicki Group.
    offeredBy: listing.listOfficeName
      ? { "@type": "RealEstateAgent", name: listing.listOfficeName }
      : undefined,
    itemOffered: { "@id": `${url}#home` },
  });

  const page = compact({
    "@type": "RealEstateListing",
    "@id": `${url}#listing`,
    url,
    name: `${place} — for sale`,
    description: listing.publicRemarks,
    datePosted: listing.listDate, // only when known; never "today"
    image: images[0],
    isPartOf: { "@id": WEBSITE_ID },
    breadcrumb: { "@id": `${url}#breadcrumb` },
    mainEntity: { "@id": `${url}#home` },
    about: { "@id": `${url}#home` },
    offers: offer,
  });

  return [
    page,
    home,
    breadcrumbList(url, [
      { name: "Home", path: "/" },
      { name: "Listings", path: "/listings" },
      { name: listing.address ?? "Listing", path: listingPath(listing) },
    ]),
  ];
}

// ─── Blog ────────────────────────────────────────────────────────────────────

/** Path of a blog post. */
export const blogPostPath = (post: CollectionEntry<"blog">): string => `/blog/${post.id}`;

/**
 * Nodes for a blog post. AI-written posts are attributed to the organization (matching
 * the page's "The Sawicki Group AI" byline), Jim's to Jim.
 */
export function blogPostNodes(post: CollectionEntry<"blog">): Node[] {
  const url = absoluteUrl(blogPostPath(post));
  const author =
    post.data.author === "AI" ? { "@id": ORGANIZATION_ID } : { "@id": personId("jim-sawicki") };
  return [
    {
      "@type": "BlogPosting",
      "@id": `${url}#article`,
      url,
      mainEntityOfPage: url,
      headline: post.data.title,
      description: post.data.excerpt,
      datePublished: post.data.date.toISOString(),
      articleSection: post.data.tag,
      author,
      publisher: { "@id": ORGANIZATION_ID },
      image: absoluteUrl(site.ogImagePath),
      isPartOf: {
        "@type": "Blog",
        "@id": absoluteUrl("/blog") + "#blog",
        name: "Market Updates",
        url: absoluteUrl("/blog"),
      },
      breadcrumb: { "@id": `${url}#breadcrumb` },
      inLanguage: "en-US",
    },
    breadcrumbList(url, [
      { name: "Home", path: "/" },
      { name: "Market Updates", path: "/blog" },
      { name: post.data.title, path: blogPostPath(post) },
    ]),
  ];
}
