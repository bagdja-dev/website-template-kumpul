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
- Version: `1.3.10`
- Template slug: `kumpul`
- `manifestVersion`: `1`, `rendererApiVersion`: `1`
- Default palette: `manifest.theme` (`mode: light`, background `#ffffff`,
  accent `#00608e`, text `#18181b`) is stored as the template structure theme,
  so Studio reset returns to these colors.
- Entry point: `dist/server.cjs` (wajib) dan `dist/client.js` (JavaScript browser), dinyatakan di `manifest.entry`
- Halaman contoh untuk website baru: `manifest.defaultPages` (Beranda, Katalog Gathering, Cara Kerja, Tentang)
- Data contoh website baru: `manifest.sampleData` (kategori, gathering, FAQ, dan tagline), dipakai untuk seed website serta preview package
- Halaman sistem milik template (`manifest.pageOverrides`): header, keranjang, transaksi, detail transaksi, tagihan, invoice, kalender, rencana gathering

## Halaman sistem (`props.page`)

Sejak `1.1.0`, data halaman sistem dibaca dari `props.page` sesuai kontrak
Bagdja (`bagdja-website-template-runtime/contract/page-contract.d.ts`), bukan
lagi dari `props.preview*`. `src/page-adapter.cjs` adalah satu-satunya tempat
yang mengenal bentuk kontrak itu dan menerjemahkannya ke model internal
renderer. Data yang sama dipakai di preview lokal, preview platform, dan
website seller; `isPreview` hanya mengatur catatan "Preview desainer" dan
simulator rencana gathering.

- Tanggal: ISO 8601 dengan offset timezone; uang: bilangan bulat rupiah.
- Template tidak menerima email/token/ID internal. Identitas aksi = `key` opaque.
- Aksi memakai atribut bridge host Bagdja — bootstrap di iframe menangani
  klik, template tidak memanggil API:
  `data-bagdja-intent` (`cart.set_quantity` / `cart.remove` / `cart.checkout` /
  `invoice.pay` / `gathering.respond`) + `data-bagdja-key`,
  `data-bagdja-quantity` (jumlah tujuan), `data-bagdja-selectable` pada checkbox
  item yang ikut checkout, dan `data-bagdja-action="order.retry_payment"` untuk
  aksi transaksi. Tombol baru aktif bila host menyediakan bridge
  (`props.bridgeVersion`); setelah aksi berhasil host memuat ulang halaman atau
  mengarahkan ke pembayaran.
- `props.headerOnly === true` → hanya header Kumpul (halaman yang isinya masih
  dikelola Bagdja, mis. chat dan checkout).
- Fixture halaman sistem di `fixtures/` memakai data yang sama dengan fixture
  standar Bagdja, dengan identitas Kumpul.
- Export: `render(props)`, returning a React element
- React: supplied by the Bagdja runtime

The package is kept separate from the production renderer. Publishing a package
to npm does not publish or activate it in Bagdja: the platform fetches and
validates the exact version into staging, then activates it only after the
separate deep-review approval and release.

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
payment actions are disabled in preview. On live orders pages, **Chat Order**
creates or reuses a website chat thread scoped to the selected transaction and
opens that conversation. The `keranjang` fixture demonstrates
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
simulator. During live invitation confirmation, organizers can open the
reservation manager to filter registrations, review accepted/rejected counts,
and reject an eligible reservation individually. The manager adapts to a
large desktop dialog or a mobile bottom sheet; closing reservations remains
next to the cancel action on desktop and in the mobile actions sheet.

Use this repository as a starting sample: create a new designer repository
from it, then replace the renderer and fixtures while preserving the package
and manifest contract. The local preview is a development aid, not a substitute
for Bagdja Studio/reviewer preview or the isolated production runtime.

`dist/client.js` dibaca reviewer Bagdja sebelum versi disetujui; setelah
terbit, JavaScript ini berjalan di semua halaman website seller di dalam iframe
sandbox. Preview fixture lokal bukan persetujuan tersebut.

`npm run build` builds the package; `npm test` checks the renderer, and
`npm pack --dry-run` previews the contents to be uploaded to npm without
publishing anything. The design reference is documentation material and is
intentionally excluded from the published package.

After review, publish the exact version declared in `package.json`:

```sh
npm publish --access public
```

The generated npm package must contain `manifest.json`, `dist/server.cjs`, and
optionally `dist/client.js`; the platform retrieves those files from npm, so
reviewers do not upload bundle files manually.
