# Compliance reference

Source documents the site must follow, plus a digest of the rules that touch the website.
The digest is a reading aid, not a substitute: quote the source text when it matters.

| Document | File | Effective |
|---|---|---|
| NorthstarMLS Rules | [NorthstarMLS-Rules-2026.pdf](NorthstarMLS-Rules-2026.pdf) (searchable text: [northstarmls-rules-2026.txt](northstarmls-rules-2026.txt)) | 2026-07-01 |

When a new edition arrives, add it here, keep the old one until the site is checked against
the new text, and re-check every `VERIFY-IDX` tag in the code.

## NorthstarMLS rules that apply to this site

Our site is a brokerage **technology platform** (§5.1(h)) doing **limited electronic
advertising (LEA)**: visitors enter their own search criteria and see other brokerages'
listings (§5.1(d)). Planned subscriber-only sold listings would be **virtual brokerage
(VB / VOW)** (§5.1(i), §5.12).

### Every disclosure (§5.4)

- **(a)** Never select or filter listings by compensation or by listing brokerage/agent
  (except "only our own listings").
- **(b)** Exclude service-internal data: retained listings; Withheld, Delete, Incomplete statuses.
- **(c)** Advertise another brokerage's listing only under LEA consent (§5.10 blanket consent).
- **(e)** Show the disclaimer **"Data believed to be accurate but should be independently verified."**
- **(f)** The brokerage (Coldwell Banker) supervises and must consent to automated disclosure
  and to any third-party technology provider.

### Automated disclosure (§5.7)

- Drop listings the seller excluded from automated disclosure; hide the address when the
  seller says so.
- No sale price where sale prices aren't public; **never show the listing agreement type**
  (exclusive right to sell / exclusive agency).
- **Data no more than 12 hours old** after the last feed update.

### LEA and VB platforms (§5.8, §5.9)

- **(a)(ii)** Our brokerage's name, logo, and contact info at least as prominent as any other
  brokerage or third party; contact monitored at least every 48 h.
- **(c)** Identify the **source** of each listing (the MLS) immediately adjacent to it.
- **(d)** Don't modify listing data content. **(e)** Supplemental info (e.g. Close to Home,
  AI chat) must be visually separated from the listing and labeled with its source.
- **(f)** Comments/reviews/automated valuations next to a listing: must honor a seller's
  opt-out.
- **(g)** Notify NorthstarMLS 2 days before starting automated disclosures; let the MLS and
  other users use the site to check compliance.
- **(h)** Fix reported data errors within 48 h (or refer to the MLS / listing brokerage).
- **(i)** A **privacy policy** explaining what visitor data is collected and how it's used.
- **(j)** **EULA:** once per viewing session, the visitor must assent, by an affirmative act,
  to the NorthstarMLS-promulgated EULA **before viewing any MLS data**. Use the MLS's
  current EULA within 30 days of each update.
- **§5.9(a)** Security at least as robust as the MLS's: detect unusual activity, prevent
  scraping and other misuse.
- **§5.9(b)** Keep an **audit trail of each user's activities for 18 months**.
- **§5.9** A license agreement with NorthstarMLS for the platform.

### LEA only (§5.11)

- May (not must) block search-engine indexing of listings.
- Display only MLS-permitted LEA fields, and all MLS-required LEA fields.
- **(f)** Notice: listings are for the viewer's **personal, non-commercial use**, only to
  identify properties they may want to buy and to compare with similar properties.
- **(g)** Never show Incomplete, Withheld, Canceled, Expired, or TNAS listings.

### VB / subscriber features (§5.12), for when accounts are built

- Registrant must be a confirmed **customer** (§1.1(k)): confirmed unique email, username +
  password, **password with an expiration date**, account records kept 180 days after
  the last expiration.
- Terms of use: acknowledges the brokerage relationship; asserts interest in buying/selling;
  personal non-commercial use; no sharing except to advance a purchase/sale; acknowledges
  the MLS's compilation copyright. Must impose **no financial obligation** and no
  representation relationship beyond the legal default; must let the MLS and other users
  register to check compliance.
- Contact for registrant questions monitored every 48 h (live chat counts); listing
  brokerage + agent name and email adjacent to each listing, as visible as the listing.

### Other rules that touch marketing content

- **§5.5(a)** Market stats ("user-composite reports", e.g. blog posts): state the criteria
  and include *"Based on information from the REGIONAL MULTIPLE LISTING SERVICE OF
  MINNESOTA, INC for the period (date) through (date)."*
- **§5.13** A display of 200 characters or fewer (thumbnail, text, tweet) is exempt from the
  display requirements but must link to a full, compliant display.
- **§6.14** We may say we participate in NorthstarMLS; never suggest we are or run an MLS,
  or give direct MLS access (applies to names, URLs, emails too).
- **§7.2** Never call our services "free" unless we receive no compensation from any source.
- **§7.3** Disclose that brokerage compensation is not set by law and is fully negotiable
  (in agreements; a site-wide statement is a reasonable courtesy).
