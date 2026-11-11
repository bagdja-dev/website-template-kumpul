# `@bagdja/kumpul`

Sample package for the `kumpul` Bagdja website template. Its SSR renderer
implements the supplied Kumpul direction using Bagdja section, theme,
profile, page, location, FAQ, and catalog props. The original visual prototype is
preserved under [`design-reference/`](./design-reference/) as reference.

The design handoff guide, available section catalog, external renderer props,
runtime limits, and reusable design prompt are maintained separately in the
`website/templates/guide` repository.

See [`design-reference/README.md`](./design-reference/README.md) for the visual
direction and notes about the prototype's sample data and host-managed pages.

## Contract

- Package: `@bagdja/kumpul`
- Version: `1.0.0`
- Template slug: `kumpul`
- `rendererApiVersion`: `1`
- Entry point: `dist/server.cjs`
- Export: `render(props)`, returning a React element
- React: supplied by the Bagdja runtime

The package is kept separate from the production renderer. Publishing a package
does not publish or activate a template in the runtime registry; registration,
review, and publication are separate platform steps.

## Development

```sh
npm install
npm run dev
npm test
npm pack --dry-run
```

`npm run dev` opens a local SSR preview at `http://127.0.0.1:4173`. Choose a
fixture and desktop/mobile width from the toolbar. Changes in `src/` and
`fixtures/` refresh automatically. The `home`, `catalog`, `about`, `how-it-works`,
`calendar`, `tagihan`, `transaksi`, `keranjang`, `detail-invoice`,
`detail-transaksi`, `detail-rencana-gathering`, and `empty` fixtures
are mock props only; no Bagdja API, tenant data, or host actions are used. The
about and how-it-works fixtures demonstrate
the existing `about`, `features_grid`, `gallery`, `service_process_section`,
and `faq_list` section contracts. The catalog fixture loads its local
search/category filter from `src/client.js`,
which filters and paginates cards already present in the fixture (12 per page).
The renderer does not fetch more catalog data, and local pagination does not
reduce the SSR response size because all supplied product cards are rendered
before the browser enhancement runs.
Gathering detail links lead to the host-managed product detail route; this
package does not invent an external gathering-detail or transaction contract.
The calendar fixture demonstrates the host-managed `gathering_calendar` system
page with local sample plans and invitations, including a month grid, month
navigation, and date selection that opens the date agenda in a centered desktop
dialog or a mobile bottom sheet. Its tabs, filters, and calendar controls run
only against fixture data; action buttons are intentionally disabled. The
`tagihan` fixture demonstrates the host-managed invoice page with sample
gathering invoices and payment terms, summary counts, and local status filters.
Its payment and detail actions are disabled in preview. The `transaksi` fixture
shows grouped transaction cards with local status filters; detail, chat, and
payment actions are disabled in preview. The `keranjang` fixture demonstrates
selection, quantity changes, local removal, and a checkout summary; checkout is
disabled and these interactions do not persist or call APIs. These account-page
fixtures use local sample props and make no network requests. A
production template can call host APIs only when the host explicitly exposes
and approves the required data/actions through its runtime contract; this
sample bundle makes no network requests.

The `detail-invoice` fixture demonstrates a gathering invoice detail page using
local sample data; payment remains disabled. The `detail-transaksi` fixture
demonstrates the `order_detail` system-section contract with item, shipping,
escrow, and total details; its payment action is disabled. Outside preview,
invoice details remain host-managed, while transaction detail uses only the
transaction data supplied in the `order_detail` section.
The `detail-rencana-gathering` fixture demonstrates the gathering plan summary,
schedule, and product-option snapshot. Its preview-only simulation follows the
host workflow stages: edit the title, invitation policy, deadlines, event date,
and opened product options; prepare email or WhatsApp invitations; review the
read-only list of confirmed attendees; then simulate seat payment status and
final option confirmation. Open invitations show a local QR code and share
link, while invite-only plans hide both. Product price and attendee limits
remain read-only, and the fixture does not invent food or catering features.
Preview shows one workflow stepper; the simulation is ephemeral and makes no
requests or real changes. Outside preview, the page reads only `order` and
`gatheringPlan` data provided by the host's `order_detail` section and omits the
simulator.

Use this repository as a starting sample: create a new designer repository
from it, then replace the renderer and fixtures while preserving the package
and manifest contract. The local preview is a development aid, not a substitute
for Bagdja Studio/reviewer preview or the isolated production runtime.

The runtime's optional `client_bundle` capability is approval-gated. Review
and approve the exact package version before enabling its browser bundle in
Bagdja; the local fixture preview is not that approval.

`npm run build` builds the package; `npm test` checks the renderer, and
`npm pack --dry-run` previews the contents to be uploaded to npm without
publishing anything. The design reference is documentation material and is
intentionally excluded from the published package.
