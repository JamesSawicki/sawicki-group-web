# Our policies vs. Zillow and Redfin (2026-10-23)

Purpose: national portals' legal pages are written by large legal teams. Where ours differ
in a way that isn't explained by their size or business (ads marketplaces, lending,
accounts, many states), the difference may point to a compliance gap.

**Sources and limits**
- **Redfin:** read directly: [Terms of Use](https://www.redfin.com/about/terms-of-use) (updated
  2025-09-29, including its MLS disclaimer list) and
  [Privacy Policy](https://www.redfin.com/about/privacy-policy) (updated 2025-11-13).
- **Zillow:** blocks automated reading. Points below come from
  [ConductAtlas's capture of the Zillow Privacy Notice](https://conductatlas.com/platform/zillow/zillow-privacy-notice/)
  (dated 2025-11-15, captured 2026-06-02) and third-party summaries of its Terms
  ([ConductAtlas](https://conductatlas.com/platform/zillow/zillow-terms-of-use/disclaimer-of-warranties/),
  [terms.law](https://terms.law/ToS-Watchdog/real-estate/zillow/)). Treat Zillow rows as
  "reported", not verified.
- Our pages: `/privacy`, `/privacy-choices`, `/terms`, `/disclaimers`, `ListingDisclosure`.

## Findings that may be real gaps (ranked)

| # | What they do | What we do | Why it matters | Suggested action |
|---|---|---|---|---|
| 1 | **Redfin shows MLS Grid's disclaimer for NorthstarMLS listings:** "Based on information submitted to the MLS GRID as of {date/time}. All data is obtained from various sources and may not have been verified by broker or MLS GRID. Supplied Open House Information is subject to change without notice. All information should be independently reviewed and verified for accuracy. Properties may or may not be listed by the office/agent presenting the information." Plus a DMCA paragraph sending copyright notices to DMCAnotice@MLSGrid.com. The same block appears for every MLS Grid market on Redfin. | Our disclosure has the NorthstarMLS §5.4(e) sentence, but nothing about MLS Grid, no "as of" time, and no DMCA path. | We get our data through MLS Grid too. This looks like MLS Grid's standard display requirement for data licensees, separate from the NorthstarMLS rules. **Not confirmed:** MLS Grid's published rules weren't found. | **Ask MLS Grid for its display requirements** (with the go-live notice). Meanwhile, prepare the block in `ListingDisclosure` with a real "data as of" time from the API's last successful sync (needs a small API addition). |
| 2 | **Both: text-message consent.** Redfin collects SMS consent, says message and data rates may apply, explains how to opt out, and says it doesn't sell phone numbers. Zillow keeps "consent proof" records for texting. | The contact form and chat collect a phone number, but nothing says you may text them. | If you text leads, federal TCPA rules and carrier rules (10DLC) require clear consent. TCPA damages are $500–1,500 per message. | If you text leads: add an optional consent checkbox (with "message/data rates may apply; reply STOP to opt out") to the contact form and chat contact card, and a short SMS section in `/privacy`. If you only call or email, say so. |
| 3 | **Both: arbitration with a class-action waiver** (Redfin: AAA consumer rules, 30-day opt-out, small-claims exception). Zillow reportedly caps liability at $100. | No arbitration; Minnesota courts; an "as is" disclaimer and liability limit. | It's optional for a small team, and it can feel heavy-handed on a personal site. It's the national norm for limiting exposure to class actions (e.g. privacy or tracking suits). | **Decision for you and the broker.** If wanted, add a short arbitration + class waiver + small-claims exception + 30-day opt-out section to `/terms`. Coldwell Banker may have standard wording. |
| 4 | **Both: an age requirement.** Redfin: age of majority/18, no one under 13. Zillow: not for under-13s. | `/privacy` covers children; `/terms` states no minimum age. | Minor, but expected, and needed once accounts launch. | Add "You must be 18 or older to use this site" to `/terms`. |
| 5 | **Redfin: a DMCA / copyright agent** with contact details and a repeat-infringer policy. | None. | The MLS Grid DMCA paragraph (finding 1) covers listing content. Our own content (photos, posts) has no takedown path. Safe harbor only matters for user-posted content, which we don't have. | Low priority: add a short "Copyright complaints" contact to `/terms`. Include MLS Grid's DMCA paragraph if they require it. |
| 6 | **Redfin: sharing with partner agents and service providers** (lenders, title, inspectors), with "at our discretion" wording. Zillow: shares with real estate professionals at your direction. | `/privacy` covers Coldwell Banker, vendors and MLS duties. | Check that it matches what you actually do: do you refer leads to other agents, or pass contacts to lenders or title? | Confirm, then update `/privacy` if you do any of that. |

## Where we're aligned (or ahead)

- **Global Privacy Control:** Redfin honors GPC in 11 states including Minnesota; Zillow reportedly treats GPC as an opt-out. We honor GPC for everyone.
- **Do Not Track:** Redfin says it doesn't honor DNT; we state our answer as well (California's CalOPPA requires one either way).
- **"Do not sell" stance:** both say they don't sell data for money but admit ad cookies may count as "sale/sharing" under state law. Our GA setup has Signals and ad personalization off, so we can state flatly that we don't sell or share. This flips if Google Ads remarketing is turned on (see `privacy-analytics.md`).
- **Analytics disclosure:** Redfin names Google Analytics and links Google's opt-out; ours does too.
- **AI disclosure:** neither Redfin's privacy policy nor its terms mention AI chat. Zillow has a "Generative AI use" provision (text not captured). Our AI labeling (chat note, `/terms`, `/privacy`) is ahead of both.
- **Chat/call content:** Redfin and Zillow record calls and keep chat entries; we don't record calls and don't log chat text. Our policy says this. Keep it true.
- **Listing data terms:** personal non-commercial use, no scraping, MLS owns its compilation, data deemed reliable but verify. Same as Redfin. Our §5.4(e) wording is the 2026 NorthstarMLS text, which Redfin's Minnesota block doesn't use (it relies on MLS Grid's).
- **Fair housing:** Redfin has an equal housing commitment and bans discriminatory content; we have the EHO statement and fair-housing rules in the chat.
- **Valuations:** Redfin labels estimates as automated, not an appraisal or CMA, and Zillow says Zestimates aren't appraisals. We don't show automated valuations, and the chat now refuses to give them and offers a CMA instead.
- **State rights lists:** Redfin lists CA, CO, CT, UT, VA and 11 GPC states. Our policy covers Minnesota and California. Fine for our size; extend if the audience changes.

## Differences explained by their size or business (not gaps)

Lending, mortgage and insurance sections; account registration terms (ours wait for
`ACCOUNTS_LAUNCHED`); data-broker sources; LiveRamp/hashed-email ad matching; Canadian
terms; ID checks for tours; Premier Agent marketplace terms.
