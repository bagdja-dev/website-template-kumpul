const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { render } = require('../dist/server.cjs');

function fixture(name) {
  return JSON.parse(readFileSync(path.join(__dirname, '..', 'fixtures', `${name}.json`), 'utf8'));
}

function html(props) {
  return renderToStaticMarkup(render(props));
}

test('renders the Kumpul home design from Bagdja section and catalog props', () => {
  const props = fixture('home');
  const output = html(props);

  assert.ok(React.isValidElement(render(props)));
  assert.match(output, /Kumpul bareng jadi lebih mudah\./);
  assert.match(output, /Dari ide sampai absensi, rapi\./);
  assert.match(output, /Perencanaan/);
  assert.match(output, /Family Camp Lembang/);
  assert.match(output, /Workshop Keramik/);
  assert.match(output, /Komunitas yang balik lagi\./);
  assert.match(output, /Rini &amp; Keluarga/);
  assert.match(output, /Tebet Eco Park/);
  assert.match(output, /Siap bikin gathering pertamamu\?/);
  assert.match(output, /href="\/kumpul-demo\/products\/family-camp-lembang"/);
  assert.match(output, /href="\/kumpul-demo\/how-it-works"/);
  assert.match(output, /href="\/kumpul-demo\/gathering"/);
  assert.match(output, /--kt-accent:#006699/);
  assert.match(output, /\.kumpul-header\{position:sticky;top:0;/);
  assert.match(output, /\.kumpul-utilities\{display:none\}/);
  assert.match(output, /class="kumpul-mobile-dock"/);
});

test('renders explicit empty catalog and omits unavailable optional data', () => {
  const output = html(fixture('empty'));

  assert.match(output, /Gathering baru sedang disiapkan/);
  assert.doesNotMatch(output, /Family Camp Lembang/);
  assert.doesNotMatch(output, /class="kumpul-testimonial"/);
  assert.doesNotMatch(output, /class="kumpul-locations"/);
  assert.match(output, /Kumpul bareng jadi lebih mudah\./);
});

test('renders the about page story, feature grid, and gallery', () => {
  const output = html(fixture('about'));

  assert.match(output, /aria-current="page">Tentang/);
  assert.match(output, /Kumpul bukan sekadar datang, tapi bertumbuh bareng\./);
  assert.match(output, /Bagdja Kumpul lahir dari keresahan/);
  assert.match(output, /Pendaftaran praktis/);
  assert.match(output, /Tagihan teratur/);
  assert.match(output, /Cerita dari setiap pertemuan/);
  assert.match(output, /Camping bersama keluarga/);
  assert.doesNotMatch(output, /class="kumpul-hero"/);
  assert.doesNotMatch(output, /Katalog Gathering<\/h2>/);
});

test('renders the how-it-works page process steps and host-provided FAQs', () => {
  const output = html(fixture('how-it-works'));

  assert.match(output, /aria-current="page">Cara Kerja/);
  assert.match(output, /<h1 class="kumpul-section-title">5 langkah, gathering jalan/);
  assert.match(output, /5 langkah, gathering jalan/);
  assert.match(output, /Tentukan tema, jadwal, lokasi, dan kebutuhan acara/);
  assert.match(output, /Bagikan informasi acara dan kumpulkan data peserta/);
  assert.match(output, /Gunakan daftar peserta untuk membantu proses check-in/);
  assert.match(output, /± 1 hari/);
  assert.match(output, /± 7 hari/);
  assert.doesNotMatch(output, /Hari acara|Hari ke-/);
  assert.match(output, /Pertanyaan tentang gathering/);
  assert.match(output, /Opsi pembayaran mengikuti pengaturan/);
  assert.equal((output.match(/class="kumpul-faq-item"/g) || []).length, 4);
});

// ── Halaman sistem: kontrak props.page (template-owned-system-pages-plan.md) ──

const PAGE_SLUG = {
  keranjang: 'cart',
  transaksi: 'orders',
  tagihan: 'tagihan',
  'detail-invoice': 'invoice-detail',
  'detail-transaksi': 'transaction-detail',
  'detail-rencana-gathering': 'plan-detail',
};

function withoutPage(name) {
  const props = fixture(name);
  delete props.page;
  props.isPreview = false;
  if (PAGE_SLUG[name]) props.activePageSlug = PAGE_SLUG[name];
  return props;
}

function live(name) {
  const props = fixture(name);
  props.isPreview = false;
  return props;
}

test('renders the calendar page from props.page with local plan and invitation controls', () => {
  const output = html(fixture('calendar'));

  assert.match(output, /aria-current="page"/);
  assert.match(output, /<span>Kalender<\/span><\/a>/);
  assert.match(output, /Kalender Acara/);
  assert.match(output, /Preview desainer · data contoh saja/);
  assert.match(output, /data-initial-month="2026-12"/);
  assert.match(output, /aria-label="Kalender Desember 2026"/);
  assert.match(output, /data-calendar-next/);
  assert.match(output, /data-calendar-previous/);
  assert.match(output, /data-calendar-day="2026-12-12"/);
  assert.match(output, /<dialog[^>]*data-calendar-agenda-dialog/);
  assert.match(output, /Rencana Saya/);
  assert.match(output, /role="tab"[^>]*aria-selected="true"[^>]*data-calendar-tab="calendar"/);
  assert.match(output, /data-calendar-filter="payment"/);
  assert.match(output, /Family Camp Lembang/);
  assert.match(output, /Workshop Keramik Akhir Tahun/);
  assert.ok((output.match(/data-calendar-card=/g) || []).length >= 4);
});

test('renders live calendar data on the seller website and only notes preview data in preview', () => {
  const output = html(live('calendar'));
  assert.match(output, /Family Camp Lembang/);
  assert.doesNotMatch(output, /Preview desainer · data contoh saja/);
  assert.match(html(withoutPage('calendar')), /<span>Kalender<\/span><\/a>/);
});

test('renders the billing page with all invoice states and status filters', () => {
  const output = html(fixture('tagihan'));

  assert.match(output, /aria-label="Tagihan"/);
  assert.match(output, /<h1>Tagihan Saya<\/h1>/);
  assert.match(output, /data-billing-filter="issued"/);
  assert.match(output, /data-billing-status="scheduled"/);
  assert.match(output, /data-billing-status="paid"/);
  assert.match(output, /data-billing-status="refunded"/);
  assert.match(output, /data-billing-status="cancelled"/);
  assert.match(output, /Family Camp Lembang/);
  assert.match(output, /Workshop Keramik Akhir Tahun/);
  assert.match(output, /Rp 750\.000/);
  assert.match(output, /href="\/kumpul-demo\/tagihan\/k_inv_invoice_pottery"[^>]*>Lihat detail tagihan/);
});

test('keeps billing payment disabled until the host provides the action bridge', () => {
  const disabled = html(live('tagihan'));
  assert.match(disabled, /disabled=""[^>]*data-bagdja-intent="invoice\.pay"[^>]*>Bayar/);

  const props = live('tagihan');
  props.bridgeVersion = 1;
  const enabled = html(props);
  assert.match(enabled, /<button type="button" class="kumpul-billing-action" data-bagdja-intent="invoice\.pay" data-bagdja-key="k_inv_termin_family_camp">Bayar/);
});

test('shows the host-managed message when no billing page data is provided', () => {
  const output = html(withoutPage('tagihan'));
  assert.doesNotMatch(output, /Family Camp Lembang/);
  assert.match(output, /Data tagihan dan status pembayaran dikelola oleh host Bagdja/);
});

test('renders the transactions page with filters and real links to transaction detail', () => {
  const output = html(fixture('transaksi'));

  assert.match(output, /aria-label="Transaksi"/);
  assert.match(output, /<h1>Daftar Transaksi<\/h1>/);
  assert.match(output, /data-transaction-filter="awaiting"/);
  assert.match(output, /data-transaction-filter="done"/);
  assert.match(output, /Family Camp Lembang \+ 1 produk lainnya/);
  assert.match(output, /Menunggu pelunasan/);
  assert.match(output, /Rp 1\.250\.000/);
  assert.match(output, /href="\/kumpul-demo\/order\/k_trx_trx_family_camp">Detail Transaksi/);
});

test('shows the host-managed message when no transactions page data is provided', () => {
  const output = html(withoutPage('transaksi'));
  assert.doesNotMatch(output, /INV-KMP-2026-018/);
  assert.match(output, /Data transaksi dikelola oleh host Bagdja/);
});

test('renders invoice detail and only enables payment through the host bridge', () => {
  const output = html(fixture('detail-invoice'));

  assert.match(output, /data-invoice-detail/);
  assert.match(output, /Workshop Keramik Akhir Tahun/);
  assert.match(output, /INV-KMP-2026-044-01/);
  assert.match(output, /KMP-2026-044/);
  assert.match(output, /Dita Prameswari/);
  assert.match(output, /22 November 2026/);
  assert.match(output, /350\.000/);
  assert.match(output, /disabled=""[^>]*data-bagdja-intent="invoice\.pay"[^>]*>Bayar sekarang/);

  const bridged = live('detail-invoice');
  bridged.bridgeVersion = 1;
  assert.match(html(bridged), /<button type="button" data-bagdja-intent="invoice\.pay" data-bagdja-key="k_inv_INV_KMP_2026_044_01">Bayar sekarang/);
});

test('sends signed-out buyers to the host login before paying an invoice', () => {
  const props = live('detail-invoice');
  props.page.loginRequired = true;
  props.auth = { isLoggedIn: false, loginHref: '/kumpul-demo/auth/login' };
  assert.match(html(props), /<a class="kumpul-detail-pay-link" href="\/kumpul-demo\/auth\/login">Login untuk membayar/);
});

test('shows the host-managed message when no invoice page data is provided', () => {
  const output = html(withoutPage('detail-invoice'));
  assert.doesNotMatch(output, /INV-KMP-2026-044-01/);
  assert.match(output, /Data tagihan dan status pembayaran dikelola oleh host Bagdja/);
});

test('renders transaction detail from props.page with retry payment behind the bridge', () => {
  const output = html(fixture('detail-transaksi'));

  assert.match(output, /data-transaction-detail/);
  assert.match(output, /INV-KMP-2026-018/);
  assert.match(output, /Family Camp Lembang/);
  assert.match(output, /Paket makan keluarga/);
  assert.match(output, /Cidadap, Bandung/);
  assert.match(output, /Rini Saputri/);
  assert.match(output, /disabled=""[^>]*data-bagdja-action="order\.retry_payment"[^>]*>Lanjutkan Pembayaran/);
  assert.doesNotMatch(output, /ESC-KMP-018/);
});

test('still renders a legacy host order_detail section without props.page', () => {
  const props = withoutPage('detail-transaksi');
  props.sections = [{
    type: 'order_detail',
    content: {
      transaction: {
        id: 'trx-host', ref_number: 'INV-HOST-001', status: 'PENDING_PAYMENT', total_amount: 100000,
        items: [{ id: 'i1', quantity: 1, unit_price: 100000, total_amount: 100000, product_name: 'Produk host' }],
      },
      order: null,
    },
  }];
  const output = html(props);
  assert.match(output, /data-transaction-detail/);
  assert.match(output, /INV-HOST-001/);
  assert.match(output, /Produk host/);
});

test('renders gathering plan detail with the preview-only workflow simulator', () => {
  const output = html(fixture('detail-rencana-gathering'));

  assert.match(output, /data-plan-detail/);
  assert.match(output, /data-plan-simulator/);
  assert.match(output, /data-current-step="PLAN"/);
  assert.equal(Array.from(output.matchAll(/data-sim-step="/g)).length, 4);
  assert.match(output, /data-sim-panel="PLAN"/);
  assert.match(output, /data-sim-panel="INVITATIONS" hidden=""/);
  assert.match(output, /Workshop Keramik/);
  assert.match(output, /KMP-2026-038/);
  assert.match(output, /20 Desember 2026/);
  assert.match(output, /Kemang, Jakarta Selatan/);
  assert.match(output, /Rp 425\.000/);
  assert.match(output, /Sesi pagi/);
  assert.match(output, /Dewi Anggraini/);
  const confirmationPanel = output.match(/<div class="kumpul-plan-sim-panel" data-sim-panel="INVITATION_CONFIRMATION"[^]*?<\/div><\/div>/)?.[0] || '';
  assert.match(confirmationPanel, /data-sim-public-invitation/);
  assert.match(confirmationPanel, /gathering\/invite\/k_plan_plan_workshop/);
});

test('only shows the public invitation QR for open gathering plans', () => {
  const props = fixture('detail-rencana-gathering');
  props.page.plan.invitePolicy = 'INVITE_ONLY';
  const output = html(props);
  const confirmationPanel = output.match(/<div class="kumpul-plan-sim-panel" data-sim-panel="INVITATION_CONFIRMATION"[^]*?<\/div><\/div>/)?.[0] || '';

  assert.match(confirmationPanel, /data-sim-public-invitation[^>]*hidden=""/);
});

test('renders the live gathering plan workflow without the simulator or invitee contacts', () => {
  const output = html(live('detail-rencana-gathering'));
  assert.match(output, /data-plan-detail/);
  assert.doesNotMatch(output, /data-plan-simulator/);
  assert.match(output, /class="kumpul-plan-workflow" aria-label="Tahapan gathering"/);
  assert.match(output, /KMP-2026-038/);
  assert.doesNotMatch(output, /@[a-z0-9-]+\.[a-z]{2,}/i);
});

test('shows the host-managed message when no gathering plan data is provided', () => {
  const output = html(withoutPage('detail-rencana-gathering'));
  assert.match(output, /Data rencana gathering dikelola oleh host Bagdja/);
  assert.doesNotMatch(output, /KMP-2026-038/);
});

test('renders the cart with selection, quantity, unavailable items, and gated checkout', () => {
  const output = html(fixture('keranjang'));

  assert.match(output, /aria-label="Keranjang"/);
  assert.match(output, /<h1>Keranjang/);
  assert.match(output, /Family Camp Lembang/);
  assert.match(output, /Menunggu penawaran/);
  assert.match(output, /Rencana gathering belum masuk tahap pembayaran/);
  assert.match(output, /data-cart-select-all/);
  assert.match(output, /data-cart-quantity-increase/);
  assert.match(output, /data-cart-remove/);
  assert.match(output, /Rp 900\.000/);
  assert.match(output, /disabled=""[^>]*data-bagdja-intent="cart\.checkout"[^>]*>Lanjut ke Checkout/);

  const bridged = live('keranjang');
  bridged.bridgeVersion = 1;
  assert.match(html(bridged), /<button type="button" class="kumpul-cart-checkout" data-bagdja-intent="cart\.checkout">Lanjut ke Checkout/);
});

test('shows the host-managed message when no cart page data is provided', () => {
  const output = html(withoutPage('keranjang'));
  assert.doesNotMatch(output, /Family Camp Lembang/);
  assert.match(output, /Item keranjang dan rencana gathering dikelola oleh host Bagdja/);
});

test('renders only the Kumpul header for host-managed pages', () => {
  const props = fixture('home');
  props.headerOnly = true;
  const output = html(props);
  assert.match(output, /class="kumpul-header"/);
  assert.doesNotMatch(output, /<main/);
  assert.doesNotMatch(output, /<footer/);
});

test('renders a complete gathering catalog page from the external renderer contract', () => {
  const output = html(fixture('catalog'));

  assert.match(output, /Katalog Gathering/);
  assert.match(output, /aria-current="page">Katalog Gathering/);
  assert.match(output, /class="kumpul-catalog-search"/);
  assert.doesNotMatch(output, /class="kumpul-catalog-search" hidden/);
  assert.match(output, /placeholder="Cari gathering\.\.\."/);
  assert.match(output, /class="kumpul-category-filters" aria-label="Filter kategori gathering"/);
  assert.doesNotMatch(output, /class="kumpul-category-filters" aria-label="Filter kategori gathering" hidden/);
  assert.match(output, /data-category-filter="family"/);
  assert.match(output, /data-category-filter="workshop"/);
  assert.match(output, /Family Camp Lembang/);
  assert.match(output, /Lembang, Bandung/);
  assert.match(output, /23 Okt 2026/);
  assert.match(output, /Maks\. 40 peserta/);
  assert.match(output, /href="\/kumpul-demo\/products\/family-camp-lembang"/);
  assert.equal((output.match(/data-gathering-name=/g) || []).length, 6);
});

test('renders local pagination controls when the catalog exceeds one page', () => {
  const props = fixture('catalog');
  const seedProducts = [...props.products];
  props.products = Array.from({ length: 13 }, (_, index) => ({
    ...seedProducts[index % seedProducts.length],
    id: `gathering-${index + 1}`,
    name: `Gathering ${index + 1}`,
    slug: `gathering-${index + 1}`,
  }));
  const output = html(props);

  assert.equal((output.match(/data-gathering-name=/g) || []).length, 13);
  assert.match(output, /data-gathering-pagination/);
  assert.match(output, /data-page-previous/);
  assert.match(output, /data-page-next/);
});

test('supports tenant routes on custom domains', () => {
  const props = fixture('home');
  props.websiteSlug = '';
  const output = html(props);

  assert.match(output, /href="\/products\/family-camp-lembang"/);
  assert.match(output, /href="\/gathering"/);
});

test('builds a client filter that only operates on rendered catalog cards', () => {
  const clientBundle = readFileSync(path.join(__dirname, '..', 'dist', 'client.js'), 'utf8');

  assert.match(clientBundle, /data-gathering-catalog/);
  assert.match(clientBundle, /data-gathering-search/);
  assert.match(clientBundle, /addEventListener\(["']input["']/);
  assert.match(clientBundle, /data-category-filter/);
  assert.match(clientBundle, /const pageSize = 12/);
  assert.match(clientBundle, /data-page-previous/);
  assert.match(clientBundle, /data-page-next/);
  assert.match(clientBundle, /Menampilkan/);
  assert.match(clientBundle, /data-calendar-page/);
  assert.match(clientBundle, /data-calendar-tab/);
  assert.match(clientBundle, /data-calendar-filter/);
  assert.match(clientBundle, /data-calendar-previous/);
  assert.match(clientBundle, /data-calendar-next/);
  assert.match(clientBundle, /data-calendar-day/);
  assert.match(clientBundle, /showModal\(\)/);
  assert.match(clientBundle, /data-calendar-close/);
  assert.match(clientBundle, /toDataURL/);
  assert.match(clientBundle, /data-sim-public-qr/);
  assert.doesNotMatch(clientBundle, /data-sim-participant-option|data-sim-rsvp(?!-)/);
  assert.match(clientBundle, /data-billing-filter/);
  assert.match(clientBundle, /dataset\.billingStatus/);
  assert.match(clientBundle, /data-transaction-filter/);
  assert.match(clientBundle, /dataset\.transactionStatus/);
  assert.match(clientBundle, /data-cart-quantity-increase/);
  assert.match(clientBundle, /data-cart-selected-total/);
  assert.match(clientBundle, /data-plan-simulator/);
  assert.match(clientBundle, /data-sim-confirm-event/);
  assert.match(clientBundle, /data-sim-restart/);
  assert.doesNotMatch(clientBundle, /\bfetch\s*\(/);
  assert.doesNotMatch(clientBundle, /XMLHttpRequest/);
});

test('filters catalog data to gathering type and keeps CTA URLs on allowed protocols', () => {
  const props = fixture('home');
  props.products.push({ id: 'store-item', name: 'Produk toko biasa', slug: 'produk-toko', type: 'product' });
  props.sections.find((section) => section.type === 'cta').content.button_url = 'javascript:alert(1)';
  const output = html(props);

  assert.doesNotMatch(output, /Produk toko biasa/);
  assert.doesNotMatch(output, /href="javascript:/);
  assert.match(output, /href="\/kumpul-demo\/gathering"/);
});

test('uses website theme overrides while rejecting non-hex color values', () => {
  const props = fixture('home');
  props.websiteTheme = { colors: { accent: '#D9467A', background: 'red;}</style><script>' } };
  const output = html(props);

  assert.match(output, /--kt-accent:#D9467A/);
  assert.match(output, /--kt-bg:#F0F7F8/);
  assert.doesNotMatch(output, /<script>/);
});

test('escapes tenant-controlled copy as text', () => {
  const props = fixture('home');
  props.profile.name = '<img src=x onerror=alert(1)>';
  props.sections[0].content.headline = '<script>alert(1)</script>';
  const output = html(props);

  assert.match(output, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(output, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(output, /<script>alert\(1\)<\/script>/);
});

test('renders a useful empty state when runtime props are absent', () => {
  const output = html();

  assert.match(output, /class="kumpul-template"/);
  assert.match(output, /Tambahkan section melalui editor website/);
  assert.match(output, /Kumpul/);
});

test('wires cart controls to the Bagdja host bridge with target quantities and selectable keys', () => {
  const props = live('keranjang');
  props.bridgeVersion = 1;
  const output = html(props);
  const firstKey = props.page.items[0].key;
  assert.match(output, new RegExp(`data-cart-quantity-increase=""[^>]*data-bagdja-intent="cart\\.set_quantity" data-bagdja-key="${firstKey}" data-bagdja-quantity="3"`));
  assert.match(output, new RegExp(`data-cart-quantity-decrease=""[^>]*data-bagdja-intent="cart\\.set_quantity" data-bagdja-key="${firstKey}" data-bagdja-quantity="1"`));
  assert.match(output, new RegExp(`data-cart-remove=""[^>]*data-bagdja-intent="cart\\.remove" data-bagdja-key="${firstKey}"`));
  assert.match(output, new RegExp(`data-cart-select=""[^>]*data-bagdja-selectable="" data-bagdja-key="${firstKey}"`));
  const planKey = props.page.items.find((item) => item.kind === 'gathering_plan').key;
  assert.doesNotMatch(output, new RegExp(`data-bagdja-selectable="" data-bagdja-key="${planKey}"`));
});

test('links calendar plans and invitations to their host pages', () => {
  const output = html(live('calendar'));
  assert.match(output, /<a class="kumpul-calendar-action" href="\/kumpul-demo\/gathering\/[^"]+">Lanjutkan rencana/);
});
