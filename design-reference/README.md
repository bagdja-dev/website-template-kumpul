# Kumpul design reference

[`kumpul-template.html`](./kumpul-template.html) is the embedded mockup
extracted from the supplied Meta AI saved page. The outer saved page was only a
viewer shell; this file contains the actual React Artifact prototype. Keep it
as a visual reference, not as the production renderer or a source of live
website data.

## Design direction

- **Brand:** Kumpul, with a deep-teal identity described as premium, trusted,
  and family-oriented.
- **Palette:** primary `#006699`, hover `#00557A`, light surface `#E6F4F6`,
  border `#B3D4DD`, success `#0E9F6E`. Supporting neutrals include navy
  `#0F172A` and slate `#64748B`.
- **Header:** two rows; the prototype calls out a 56px top row for right-aligned
  utility icons and a 52px lower row for centered page navigation. The brand
  mark and Kumpul identity sit at the left.
- **Responsive intent:** the prototype provides desktop/mobile preview modes.
  Preserve the information hierarchy and gathering actions at narrow widths;
  the reference is not itself a responsive implementation contract.
- **Tone:** friendly community and family gatherings, balanced with clear
  operational status, payment, and attendance information.

## Page and content cues

The home-page concept groups content into:

1. A hero with the “Kumpul bareng jadi lebih mudah” message, primary
   “Lihat Gathering Terdekat” action, secondary explainer action, community
   metrics, and a featured gathering card.
2. A five-step gathering flow: planning, registration, payment, confirmation,
   and QR attendance.
3. A nearby-gatherings preview on the home page and a dedicated catalog with
   search and category filters, plus location, date, capacity, and pricing.
4. Community testimonials and a closing sign-up/detail call to action.
5. A location list showing active gathering counts.

The prototype also previews a gathering-detail route and common system pages
such as cart, invoices, transactions, calendar, inbox, and profile. This sample
implements the home, about, how-it-works, and gathering catalog pages. Catalog
search and category filters and 12-item pagination operate only on the products already
passed in renderer props; they do not page through or fetch host data, and do
not reduce the initial server-rendered response. Product/gathering detail and the
system pages remain host-managed surfaces under the current external-template
contract; the template should render only the data and actions the host passes
to it.

## Implementation cautions

- Counts, prices, dates, locations, testimonials, and attendee names in the
  mockup are illustrative content, not API guarantees or production defaults.
- The prototype labels `templateTheme: gathering`, `websiteSlug`, and
  `SSR render(props)` as integration context. Use the actual renderer contract
  and sanitized props; do not make direct API calls from the template.
- Reuse the theme through the platform's supported theme props rather than
  hard-coding this palette over website-level theme settings.
- The package renderer implements the page concepts with the Bagdja `hero`,
  `about`, `features_grid`, `gallery`, `products_grid`,
  `service_process_section`, `faq_list`, `testimonial`, `locations_list`, and
  `cta` section contracts. The `about.json` and `how-it-works.json` fixtures
  demonstrate the corresponding pages; `products_grid`-only demonstrates the
  catalog. This reference itself is not a runtime artifact.
