# Privacy and analytics: what the law requires of this site

Memo, 2026-10-23. Covers the Google Analytics 4 setup (`src/lib/analytics.ts`,
`src/components/analytics/Analytics.astro`), the opt-out page (`/privacy-choices`) and the
privacy policy (`/privacy`). Not legal advice: a reading of the sources below, with
uncertain points marked **(uncertain)**. Re-check when traffic grows, when advertising
starts, or when any "what would change this" item below happens.

## Decision

US-only business, so: GA4 loads for everyone **without a consent banner**, except visitors
who send **Global Privacy Control** or opt out on `/privacy-choices` (then gtag.js never
loads and `ga-disable-<ID>` is set). Google Signals and ad personalization are **off**
(`ADS_PERSONALIZATION` in `lib/analytics.ts`). No PII, chat text or form contents ever go
to Google. The privacy policy discloses GA, its cookies, every vendor, retention, GPC and
rights requests.

## Laws and terms checked

### Minnesota Consumer Data Privacy Act (Minn. Stat. ch. 325M, eff. 2025-07-31)

- **Applies to** a controller that processes personal data of **100,000+ Minnesota
  consumers** a year (excluding payment-only data), or 25,000+ and >25% of revenue from
  selling data (Minn. Stat. §325M.12, read on revisor.mn.gov 2026-10-23). Website analytics
  counts every unique browser as a consumer, so a busy public site could approach 100,000 over
  time.
  - One secondary source says the threshold drops to 35,000 on 2026-07-31; the statute text
    on the Revisor's site still says 100,000. **(uncertain: treat 100,000 as current, but
    check again.)**
- **Small-business exemption:** businesses that are "small" under SBA size standards are
  exempt, except §325M.17 (no selling **sensitive** data without consent). SBA standard for
  NAICS 531210 (real estate agents and brokers) is **$15 million** in average annual receipts,
  so the team is almost certainly exempt. **(uncertain:** if the controller is Coldwell
  Banker Realty rather than the team, the brokerage is not small. The site is operated by
  the team, so the team is the controller, but ask the brokerage whether it has required
  privacy language for agent websites.)
- **If it ever applies:** must honor universal opt-out mechanisms (GPC) for targeted
  advertising and sale, post a privacy notice with specific contents (categories, purposes,
  third parties, rights, how to appeal), respond to rights requests within 45 days, give a
  list of specific third parties on request, and no dark patterns. **We already do all of
  this voluntarily** (the policy and `/privacy-choices` were written to the MCDPA standard),
  which is why the setup survives crossing the threshold. Enforcement is by the AG only
  ($7,500/violation, no private right of action; the 30-day cure period ended 2026-01-31).
- Sources: [Minn. Stat. §325M.12](https://www.revisor.mn.gov/statutes/cite/325M.12);
  [Baker Donelson MN guide](https://www.bakerdonelson.com/consumer-data-privacy-law-guide-minnesota);
  [Ethyca on MCDPA UOOM](https://www.ethyca.com/news/what-the-minnesota-consumer-data-privacy-act-mcdpa-means-for-businesses);
  [SBA standard 531210 (HigherGov)](https://highergov.com/naics/531210-offices-of-real-estate-agents-and-brokers).

### California (CCPA/CPRA and CalOPPA)

- **CCPA applies** only with >$26,625,000 annual gross revenue (2025–2026 figure), or
  buying/selling/sharing personal information of 100,000+ California consumers, or 50%+ of
  revenue from selling/sharing. The team meets none. Not covered.
  ([Jackson Lewis CCPA FAQs](https://www.jacksonlewis.com/insights/navigating-california-consumer-privacy-act-30-essential-faqs-covered-businesses-including-clarifying-regulations-effective-1126))
- **CalOPPA** (Bus. & Prof. Code §22575) has no size threshold: any commercial site that
  collects PII from California residents must post a privacy policy listing the categories of
  PII and third parties, its effective date, and **how it responds to "Do Not Track"**. The
  policy now covers all of these (the DNT answer: we honor GPC, not DNT). (From general
  knowledge of the statute; not re-fetched today.)

### State wiretap / pen-register ("pixel") lawsuits

- California Invasion of Privacy Act (CIPA) suits over pixels and analytics grew from ~600
  to 4,000+ cases. **SB 690**, signed 2026-09-30, effective 2027-01-01, ends private suits
  under the pen-register / trap-and-trace section (§638.51) for websites and apps, and applies
  to claims filed on or after 2025-01-01. Claims under the **wiretap/eavesdropping sections
  (§631/§632.7) remain** for capturing the **contents** of communications, e.g. form contents
  or chat text sent to a third party.
  ([Mayer Brown, Oct 2026](https://www.mayerbrown.com/zh-hans/insights/publications/2026/10/california-invalidates-private-lawsuits-for-pen-register-website-claims);
  [Clark Hill](https://www.clarkhill.com/news-events/news/california-sb-690-relief-cipa-website-lawsuits/))
- **Our exposure is low** because GA receives no message or form contents (enforced by the
  typed `AnalyticsEvents` catalogue), there is no session replay, no Meta/TikTok pixel, and
  the policy discloses everything.
- **Remaining risk: the AI chat.** Chat text goes to Anthropic (a third party) to generate
  replies. "Chatbot wiretapping" suits argue a chat vendor eavesdrops on the conversation.
  Anthropic acts as our processor (no training, short retention), and the policy discloses it,
  but the strongest defense is **notice at the point of use**: a one-line note under the chat
  input ("Answers by AI (Anthropic). Messages aren't stored by us. Privacy Policy"). Requested
  from the orchestrator. **(uncertain:** how courts treat processor-style AI vendors is
  unsettled.)
- Minnesota's own wiretap law (Minn. Stat. ch. 626A) is one-party consent; we are a party to
  our own site's communications. **(uncertain,** not researched in depth.)

### Google Analytics terms (§7 Privacy)

Must: post a privacy policy that gives notice of cookies used to collect data; **disclose the
use of Google Analytics and how it collects and processes data** (satisfied with a prominent
link to "How Google uses data when you use our partners' sites or apps", which the policy
has); and **never pass Google anything it could recognize as personally identifiable
information**. ([GA Terms of Service](https://support.google.com/analytics/answer/7124332))
The PII rule is why events carry listing ids, cities, price bands and our own labels only,
and why the search-box event sends a chosen city/ZIP but never typed text. Page URLs contain
listing addresses (SEO slugs), which are property data, not visitor PII.

### Global Privacy Control

GPC is a browser signal (`navigator.globalPrivacyControl` / `Sec-GPC: 1`). California
regulations require covered businesses to treat it as an opt-out of sale/sharing; Minnesota,
Colorado, Connecticut, Texas, Oregon and others require honoring universal opt-out
mechanisms. We aren't covered by those laws yet, but honoring GPC costs nothing and is the
accepted best practice. Our response is stronger than required: analytics is off entirely,
not just ad uses. ([globalprivacycontrol.org](https://globalprivacycontrol.org))

### NorthstarMLS Rules

- **§5.8(i)** requires "a privacy policy that explains the data it will collect from
  visitors and how the platform and brokerage will use the data". The policy covers the
  brokerage's use (supervision, access to client records).
- **§5.9(b)** "The platform shall maintain an audit trail of each user's activities for at
  least 18 months." An 18-month activity audit trail is being designed (the compliance work
  stream), so the policy discloses activity logs kept up to 18 months, without chat or
  contact-form content. **(uncertain:** whether "user" covers anonymous visitors or only MLS
  users; until the audit trail ships, Cloud Run's default log retention (~30 days) is shorter
  than the policy's "up to 18 months", which is a ceiling, not a promise.)

### Anthropic (verified for the policy's claims)

- Read `listing-agent-api` `ChatController` and the `logging` package: the API logs only
  `listingId` and token counts for chat (`chat_usage`), and an event when a contact request is
  prepared; never message text or contact details. Access logs truncate IPs. No database
  table stores chats. The rate limiter keeps the IP in memory for up to 2 hours.
- Anthropic API data isn't used for training; default retention is 7 days since 2025-09-14
  (30 days opt-in; zero retention for qualifying enterprise customers).
  ([summary of Anthropic's API retention change](https://char.com/blog/anthropic-data-retention-policy);
  confirm on Anthropic's own privacy center before quoting "7 days" in anything formal)

### Minnesota real estate records

Brokers keep listings, contracts and related documents for six years (Minn. Stat. §82.72).
The policy says client communications are kept as long as Minnesota rules and the brokerage
require. ([Minn. Stat. §82.72](https://www.revisor.mn.gov/statutes/cite/82.72))

## What would change this setup

| Change                                                                                                   | Why it matters                                                                                                                         | What to do first                                                                           |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Turn on Google Signals, ad personalization, or Google Ads **remarketing** audiences                      | Becomes "sharing" (CCPA) / "targeted advertising" (MCDPA): opt-out must cover it; Google's personalized-ads policy requires disclosure | Update the policy; flip `ADS_PERSONALIZATION`; keep GPC/opt-out blocking it (already does) |
| Google Ads **conversion tracking** only (import GA4 key events, no remarketing)                          | Measurement, not targeting; current policy already discloses it                                                                        | Mark `generate_lead`, `click_to_call` as key events; link Ads to GA4                       |
| **Enhanced conversions** / Customer Match (hashed emails/phones to Google)                               | Sends visitor PII (hashed) to Google; contradicts "never send Google your email"                                                       | Policy rewrite; arguably needs opt-in; avoid unless clearly worth it                       |
| **Session replay** (Hotjar, Clarity, FullStory)                                                          | Captures typed text and clicks: the core CIPA §631 wiretap theory, not covered by SB 690                                               | Don't, or mask all inputs and add a notice/consent                                         |
| **Meta / TikTok pixel**                                                                                  | Pixel lawsuits, data sharing for the platform's own ads = "sale/share"                                                                 | Policy update, opt-out coverage; consider consent                                          |
| Traffic past **100,000 Minnesota browsers/year** and the team stops being SBA-small, or revenue > $26.6M | MCDPA / CCPA apply in full                                                                                                             | Most duties already met; add a formal appeal process and data inventory                    |
| EU/UK visitors targeted (ads, listings marketed abroad)                                                  | GDPR/ePrivacy: consent before analytics cookies                                                                                        | Consent banner + Google Consent Mode v2                                                    |
| Accounts / saved searches / sold data (VOW)                                                              | MLS §5.12 account rules, §5.9(b) audit trail, passwords = sensitive data handling                                                      | New policy sections; retention of audit logs 18 months                                     |
