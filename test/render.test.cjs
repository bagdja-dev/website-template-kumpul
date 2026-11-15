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
  assert.match(output, /--kt-accent:#00608e/);
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

test('keeps the Kumpul header layout independent of the host notification bell', () => {
  const props = fixture('home');
  props.auth = { isLoggedIn: true };
  const output = html(props);
  const signedOutProps = fixture('home');
  signedOutProps.auth = { isLoggedIn: false };

  assert.match(output, /class="kumpul-header-main"/);
  assert.doesNotMatch(output, /kumpul-header-has-notifications|padding-right:76px|margin-right:24px/);
  assert.doesNotMatch(html(signedOutProps), /kumpul-header-has-notifications/);
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
  // Foto galeri bisa dibuka di viewer; keterangan ikut untuk ditampilkan di bawah viewer.
  assert.match(output, /class="kumpul-gallery-grid" data-gallery=""/);
  assert.match(output, /data-gallery-image-open="0"[^>]*data-gallery-caption="Camping bersama keluarga"/);
  assert.match(output, /role="button" tabindex="0"/);
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

test('calendar shows services on every day they span and every stage (incl. undated) in the services tab', () => {
  const output = html(fixture('calendar'));
  assert.match(output, /data-calendar-tab="services"/);
  assert.match(output, /data-calendar-panel="services"/);
  assert.match(output, /kumpul-calendar-event-service[^"]*"[^>]*data-calendar-date="2026-12-05"/);
  for (const day of ['2026-12-24', '2026-12-25', '2026-12-26']) {
    assert.match(output, new RegExp(`kumpul-calendar-event-service[^"]*"[^>]*data-calendar-date="${day}"`));
  }
  assert.match(output, /09\.00–13\.00/);
  assert.match(output, /Sepanjang hari/);
  assert.match(output, /href="\/kumpul-demo\/cart\/order\/k_service_ord_villa"[^>]*>Bayar pesanan/);
  assert.match(output, /data-calendar-service-status="confirmed"/);
  // Jasa belum bertanggal: tampil di tab Jadwal Jasa (bukan di grid kalender).
  assert.match(output, /data-calendar-service-status="planning"[^]*?Katering Syukuran[^]*?Jadwal belum ditentukan[^]*?>Lengkapi pesanan</);
  assert.equal((output.match(/data-calendar-event=""[^>]*>(?:(?!<\/article>)[^])*Katering Syukuran/g) || []).length, 0);
  for (const filter of ['all', 'planning', 'payment', 'confirmed', 'completed']) {
    assert.match(output, new RegExp(`data-service-filter="${filter}"`));
  }
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

test('links calendar agenda events in the date popup to their detail pages', () => {
  const output = html(fixture('calendar'));
  assert.match(output, /kumpul-calendar-event-linked/);
  assert.match(output, /class="kumpul-calendar-event-link" href="[^"]+"/);
});

test('makes every billing card a link to its invoice or transaction detail', () => {
  const output = html(fixture('tagihan'));
  assert.match(output, /class="kumpul-billing-card-link" href="\/kumpul-demo\/tagihan\/k_inv_invoice_pottery"/);
  assert.match(output, /class="kumpul-billing-card-link" href="\/kumpul-demo\/order\/k_trx_trx_family_camp"/);
  assert.match(output, /kumpul-billing-card-linked/);
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
  assert.match(output, /<button type="button" class="kumpul-transaction-action-link" disabled="" data-bagdja-intent="transaction\.chat\.open" data-bagdja-key="k_trx_trx_family_camp">Chat Order/);
  const liveProps = live('transaksi');
  liveProps.bridgeVersion = 1;
  assert.match(html(liveProps), /<button type="button" class="kumpul-transaction-action-link" data-bagdja-intent="transaction\.chat\.open" data-bagdja-key="k_trx_trx_family_camp">Chat Order/);
  assert.doesNotMatch(output, /href="\/kumpul-demo\/chat">Chat Order/);
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
  assert.match(output, /data-sim-banner=""/);
  assert.match(output, /data-sim-save-invitation=""/);
  assert.match(output, /Simpan tampilan \(simulasi\)/);
  assert.match(output, /data-sim-invitation-saved=""/);
  assert.match(output, /Preview lokal — gambar tidak diunggah/);
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
  assert.match(output, /data-plan-live/);
  assert.match(output, /KMP-2026-038/);
  assert.doesNotMatch(output, /@[a-z0-9-]+\.[a-z]{2,}/i);
});

test('live gathering plan opens previous steps as read-only summaries and wires host intents', () => {
  const output = html(live('detail-rencana-gathering'));
  // Tahap aktif = Konfirmasi undangan: tahap 1–2 bisa diklik, tahap 4 terkunci.
  assert.match(output, /<button type="button" data-plan-step-tab="PLAN" aria-pressed="false">/);
  assert.match(output, /<button type="button" data-plan-step-tab="INVITATIONS" aria-pressed="false">/);
  assert.match(output, /data-plan-step-tab="PAYMENT_CONFIRMATION" aria-pressed="false" disabled=""/);
  assert.match(output, /data-plan-step-panel="PLAN" hidden=""/);
  assert.doesNotMatch(output, /data-plan-step-panel="INVITATION_CONFIRMATION" hidden/);
  assert.match(output, /Ringkasan tahap yang sudah dilewati/);
  assert.match(output, /Rio Saputra/);
  assert.match(output, /WhatsApp · Menunggu jawaban/);
  // Reservasi dikelola per peserta di dialog adaptif, tanpa pilihan checkbox massal.
  assert.match(output, /data-bagdja-scope=""[^>]*data-kumpul-reservation-item="" data-kumpul-reservation-status="RSVP_CONFIRMED"/);
  assert.match(output, /type="checkbox" hidden=""[^>]*data-bagdja-selectable=""[^>]*data-bagdja-key="k_reg_dewi"[^>]*checked=""/);
  assert.match(output, /data-kumpul-reservation-message=""/);
  assert.match(output, /aria-label="Tolak reservasi Dewi Anggraini"[^>]*data-kumpul-reservation-reject-open=""/);
  assert.match(output, /data-kumpul-reservation-reject-submit="" data-bagdja-intent="gathering\.registrations\.reject" data-bagdja-key="k_plan_plan_workshop"/);
  assert.match(output, /data-kumpul-reservation-open=""[^>]*>Lihat Reservasi<span class="kumpul-reservation-count">3 masuk<\/span><span class="kumpul-reservation-count is-rejected">0 ditolak<\/span>/);
  assert.match(output, /<dialog[^>]*data-kumpul-reservation-dialog=""/);
  assert.match(output, /width:90vw;height:90vh;height:90dvh/);
  assert.match(output, /@media\(max-width:760px\)\{\.kumpul-reservation-dialog\{inset:auto 0 0;width:100vw;height:90vh;height:90dvh/);
  const rejectDialogStart = output.indexOf('data-kumpul-reservation-confirm-dialog');
  const rejectDialogEnd = output.indexOf('</dialog>', rejectDialogStart);
  const rejectDialog = output.slice(rejectDialogStart, rejectDialogEnd);
  assert.match(rejectDialog, /data-kumpul-reservation-confirm-name="">peserta/);
  assert.match(rejectDialog, /type="radio"[^>]*data-kumpul-reservation-reason-option=""/);
  assert.match(rejectDialog, /Kapasitas peserta sudah penuh/);
  assert.match(rejectDialog, /Data reservasi tidak lengkap/);
  assert.match(rejectDialog, /Jadwal atau pilihan tidak tersedia/);
  assert.match(rejectDialog, /Tidak memenuhi ketentuan acara/);
  assert.match(rejectDialog, /Alasan lainnya/);
  assert.match(rejectDialog, /placeholder="Tuliskan alasan penolakan"[^>]*aria-label="Alasan penolakan lainnya" hidden="" data-kumpul-reservation-custom-reason=""/);
  assert.doesNotMatch(rejectDialog, /Keduanya bisa digunakan bersama/);
  assert.doesNotMatch(output.slice(output.indexOf('data-kumpul-reservation-dialog'), output.indexOf('</dialog>', output.indexOf('data-kumpul-reservation-dialog'))), /data-kumpul-reservation-reason/);
  assert.match(output, /data-kumpul-reservation-filter="RSVP_CONFIRMED"/);
  // Tanpa tab "Semua": Hadir jadi tab awal, baris lain disembunyikan sejak render.
  assert.doesNotMatch(output, /data-kumpul-reservation-filter="all"/);
  assert.doesNotMatch(output, />Semua<\/button>/);
  assert.match(output, /data-kumpul-reservation-filter="RSVP_CONFIRMED" aria-pressed="true"/);
  assert.match(output, /data-kumpul-reservation-group="RSVP_CONFIRMED"(?! hidden)/);
  assert.match(output, /data-kumpul-reservation-filter="REJECTED"/);
  assert.match(output, /data-kumpul-reservation-filter="CANCELLED"/);
  const desktopActionsStart = output.indexOf('class="kumpul-plan-sim-actions kumpul-plan-desktop-actions"');
  const desktopActionsEnd = output.indexOf('</div>', desktopActionsStart);
  const desktopActions = output.slice(desktopActionsStart, desktopActionsEnd);
  assert.ok(desktopActions.indexOf('Lihat Reservasi') < desktopActions.indexOf('Tutup Reservasi &amp; Lanjutkan'));
  assert.ok(desktopActions.indexOf('Tutup Reservasi &amp; Lanjutkan') < desktopActions.indexOf('Batalkan acara'));
  const reservationDialogStart = output.indexOf('data-kumpul-reservation-dialog');
  const reservationDialogEnd = output.indexOf('</dialog>', reservationDialogStart);
  // Di dalam dialog, tutup reservasi hanya ada di kaki sheet (khusus HP, disembunyikan di web).
  // Tombol tutup reservasi (kaki sheet HP & baris web) hanya membuka modal konfirmasi Kumpul.
  assert.match(output.slice(reservationDialogStart, reservationDialogEnd), /class="kumpul-reservation-foot"><button[^>]*data-kumpul-sheet-open="close-rsvp"/);
  const closeDialog = output.slice(output.indexOf('data-kumpul-invite-sheet="close-rsvp"'), output.indexOf('</dialog>', output.indexOf('data-kumpul-invite-sheet="close-rsvp"')));
  assert.match(closeDialog, /Tutup reservasi &amp; buka pembayaran\?/);
  assert.match(closeDialog, /data-bagdja-intent="gathering\.reservations\.confirm"[^>]*data-bagdja-confirmed="true"[^>]*>Ya, tutup reservasi/);
  assert.match(closeDialog, /data-kumpul-sheet-close=""[^>]*>Kembali/);
  assert.equal((output.match(/data-bagdja-intent="gathering\.reservations\.confirm"/g) || []).length, 1, 'intent hanya di modal');
  assert.match(output, /\.kumpul-reservation-foot\{display:none\}/);
  // Web: semua tombol aksi ber-border & berlatar.
  assert.match(desktopActions, /class="kumpul-plan-sim-soft"[^>]*>Tutup Reservasi &amp; Lanjutkan/);
  assert.match(output, /\.kumpul-plan-sim-actions \.kumpul-plan-sim-soft\{border-color:var\(--kt-accent\);background:/);
  assert.match(output, /\.kumpul-plan-desktop-actions \.kumpul-plan-cancel-trigger\{[^}]*background:#fef2f2/);
  assert.match(output, /\.kumpul-reservation-dialog \.kumpul-reservation-body \.kumpul-plan-sim-actions button\.kumpul-plan-sim-secondary\{color:#b91c1c\}/);
  assert.doesNotMatch(output, /Tutup RSVP &amp; buka pembayaran/);
  assert.match(output, /data-bagdja-intent="gathering.cancel"/);
  // Tanpa bridge (preview platform) tombol aksi nonaktif.
  assert.match(output, /disabled="" data-bagdja-intent="gathering.reservations.confirm"/);
  const props = live('detail-rencana-gathering');
  props.bridgeVersion = 1;
  assert.doesNotMatch(html(props), /disabled="" data-bagdja-intent="gathering.reservations.confirm"/);
});

test('invitation step lets initiators set banner and text, and register invitees when invite-only', () => {
  const props = live('detail-rencana-gathering');
  props.page.plan.workflowStep = 'INVITATIONS';
  props.page.plan.invitePolicy = 'INVITE_ONLY';
  props.page.plan.invitationBannerUrl = 'https://assets.example/banner.jpg';
  props.page.plan.invitationDescription = 'Kumpul bareng akhir tahun.';
  props.page.actions = ['gathering.invitation.content.save', 'gathering.invitation.add', 'gathering.invitations.submit', 'gathering.cancel'];
  const output = html(props);
  assert.match(output, /<legend>Tampilan undangan<\/legend>/);
  assert.match(output, /<img class="kumpul-invite-banner" src="https:\/\/assets\.example\/banner\.jpg"/);
  assert.match(output, /type="checkbox" data-bagdja-field="invitation\.removeBanner"/);
  assert.match(output, /type="file" accept="image\/jpeg,image\/png,image\/webp,image\/gif" data-bagdja-field="invitation\.banner"/);
  assert.match(output, /data-invitation-banner-preview=""/);
  assert.match(output, /data-invitation-banner-empty=""/);
  assert.match(output, /data-invitation-banner-error=""/);
  // Editor ringan (Tiptap) menulis HTML ke textarea field; teks polos lama → paragraf.
  assert.match(output, /data-bagdja-field="invitation\.description" data-rich-source="">&lt;p&gt;Kumpul bareng akhir tahun\.&lt;\/p&gt;<\/textarea>/);
  assert.match(output, /data-kumpul-rich-editor=""/);
  assert.match(output, /data-rich-cmd="bold"/);
  assert.match(output, /data-rich-cmd="bulletList"/);
  assert.match(output, /data-rich-cmd="link"/);
  // Editor tumbuh mengikuti isi (tanpa scroll internal).
  assert.match(output, /\.kumpul-rich-content \.ProseMirror\{min-height:140px;padding:12px 14px;outline:none;/);
  assert.doesNotMatch(output, /\.kumpul-rich-content \.ProseMirror\{[^}]*(max-height|overflow-y)/);
  assert.match(output, /data-bagdja-intent="gathering\.invitation\.content\.save" data-bagdja-key="k_plan_plan_workshop"/);
  assert.match(output, /data-kumpul-invitation-confirm-open=""[^>]*>Kirim undangan<\/button>/);
  assert.match(output, /<dialog[^>]*data-kumpul-invitation-confirm-dialog/);
  assert.match(output, /data-kumpul-invitation-confirm-submit="">Ya, kirim undangan<\/button>/);
  assert.match(output, /data-bagdja-intent="gathering\.invitations\.submit" data-bagdja-key="k_plan_plan_workshop" data-kumpul-submit-invitation-intent=""/);
  // Mode tertutup: form daftar peserta tersedia.
  assert.match(output, /data-bagdja-field="invitee\.email"/);
  assert.match(output, /data-bagdja-intent="gathering\.invitation\.add"/);

  props.page.plan.invitePolicy = 'OPEN';
  props.page.plan.invitationBannerUrl = 'javascript:alert(1)';
  props.page.actions = ['gathering.invitation.content.save', 'gathering.invitations.submit'];
  const open = html(props);
  assert.match(open, /data-bagdja-field="invitation\.banner"/, 'mode terbuka juga bisa atur tampilan');
  assert.doesNotMatch(open, /data-bagdja-field="invitee\.email"/, 'mode terbuka tanpa daftar peserta');
  assert.doesNotMatch(open, /javascript:alert/);
});

test('invite-only invitation step explains when invitee registration is unavailable', () => {
  const props = live('detail-rencana-gathering');
  props.page.plan.workflowStep = 'INVITATIONS';
  props.page.plan.invitePolicy = 'INVITE_ONLY';
  props.page.actions = ['gathering.invitations.submit', 'gathering.cancel'];
  const output = html(props);
  assert.doesNotMatch(output, /data-bagdja-field="invitee\.email"/);
  assert.match(output, /Pendaftaran peserta belum tersedia untuk akun ini/);
});

test('mobile plan page moves CTAs to a bottom bar and the gathering summary to a bottom sheet', () => {
  const output = html(live('detail-rencana-gathering'));
  // Ringkasan gathering = sheet yang dibuka dari bar bawah.
  assert.match(output, /<input type="checkbox" id="kumpul-plan-summary-toggle" class="kumpul-sheet-toggle"/);
  assert.match(output, /class="kumpul-plan-layout kumpul-plan-summary-sheet"/);
  assert.match(output, /<label for="kumpul-plan-summary-toggle" class="kumpul-plan-mobilebar-icon">/);
  // HP: "Lihat reservasi" = CTA utama bar bawah; "Tutup reservasi & lanjutkan" di kaki bottom sheet
  // reservasi; batal (dan chat) di sheet "Aksi lainnya".
  const panel = output.slice(output.indexOf('data-plan-step-panel="INVITATION_CONFIRMATION"'));
  const bar = panel.slice(panel.indexOf('class="kumpul-plan-mobilebar"'));
  assert.match(bar.slice(0, 1500), /class="kumpul-plan-mobilebar-primary"><button[^>]*data-kumpul-reservation-open=""[^>]*>Lihat Reservasi/);
  const reservationDialogStart = panel.indexOf('data-kumpul-reservation-dialog');
  const reservationDialogEnd = panel.indexOf('</dialog>', reservationDialogStart);
  const reservationDialog = panel.slice(reservationDialogStart, reservationDialogEnd);
  assert.match(reservationDialog, /data-bagdja-intent="gathering\.registrations\.reject"/);
  assert.match(reservationDialog, /data-kumpul-reservation-reject-submit=""[^>]*data-bagdja-intent="gathering\.registrations\.reject"[^>]*data-bagdja-confirmed="true"/, 'konfirmasi tolak memakai modal template, bukan confirm() host');
  assert.match(reservationDialog, /class="kumpul-reservation-foot"><button[^>]*class="kumpul-plan-mobile-reservation-confirm"[^>]*data-kumpul-sheet-open="close-rsvp"[^>]*>Tutup reservasi &amp; lanjutkan/);
  const sheet = panel.slice(panel.indexOf('class="kumpul-sheet"'), panel.indexOf('class="kumpul-plan-mobilebar"'));
  assert.doesNotMatch(sheet, /data-kumpul-reservation-open/);
  assert.doesNotMatch(sheet, /gathering\.reservations\.confirm/);
  assert.match(sheet, /class="kumpul-plan-sheet-cancel"/);
  assert.match(sheet, /<label for="kumpul-cancel-dialog-toggle" class="kumpul-plan-cancel-trigger"/);
  // Desktop tetap punya CTA di panel & pembuka popup batal.
  assert.match(output, /class="kumpul-plan-sim-actions kumpul-plan-desktop-actions"/);
  assert.doesNotMatch(output, /class="kumpul-plan-live-cancel kumpul-plan-desktop-only[^"]*"/);
});

test('cancel gathering uses the template confirmation popup instead of the host confirm', () => {
  const output = html(live('detail-rencana-gathering'));
  const modal = output.slice(output.indexOf('id="kumpul-cancel-dialog-toggle"'));
  assert.match(modal, /class="kumpul-sheet-toggle kumpul-modal-toggle"/);
  assert.match(modal, /role="alertdialog" aria-modal="true" aria-labelledby="kumpul-cancel-dialog-title"[^>]*data-bagdja-scope=""/);
  assert.match(modal, /Batalkan acara\?/);
  assert.match(modal, /data-bagdja-field="reason"/);
  assert.match(modal, /data-bagdja-intent="gathering\.cancel" data-bagdja-key="k_plan_plan_workshop" data-bagdja-confirmed="true"/);
  assert.equal((output.match(/data-bagdja-intent="gathering\.cancel"/g) || []).length, 1, 'satu tombol batal (di popup)');
});

test('places the order chat action in the mobile more sheet and uses a hamburger icon', () => {
  const props = live('detail-rencana-gathering');
  props.page.plan.status = 'PREORDER';
  props.page.plan.workflowStep = 'INVITATIONS';
  props.page.actions = ['gathering.chat.open', 'gathering.invitations.submit', 'gathering.cancel'];
  props.bridgeVersion = 1;
  props.auth = { ...props.auth, chatHref: '/kumpul-demo/chat' };

  const output = html(props);
  const invitations = output.slice(output.indexOf('data-plan-step-panel="INVITATIONS"'));
  const bar = invitations.slice(invitations.indexOf('class="kumpul-plan-mobilebar"'));
  const sheet = invitations.slice(invitations.indexOf('class="kumpul-sheet"'));

  // HP: "Diskusikan" jadi tombol utama bar (berdampingan dengan CTA tahap), tidak lagi di sheet Lainnya.
  assert.doesNotMatch(sheet.slice(0, sheet.indexOf('class="kumpul-plan-mobilebar"')), /gathering\.chat\.open/);
  assert.match(bar, /<div class="kumpul-plan-mobilebar-primary"><button type="button" class="kumpul-plan-mobilebar-discuss" data-bagdja-intent="gathering\.chat\.open" data-bagdja-key="k_plan_plan_workshop"><svg [^>]*class="kumpul-icon"[^>]*><path d="M21 11\.5[^<]*<\/path><\/svg><span>Diskusikan<\/span><\/button>/);
  // Web: Diskusikan + Batalkan acara + CTA tahap dalam satu baris.
  const desktopRow = invitations.slice(invitations.indexOf('class="kumpul-plan-sim-actions kumpul-plan-desktop-actions"'));
  const row = desktopRow.slice(0, desktopRow.indexOf('class="kumpul-plan-mobile"'));
  assert.ok(row.indexOf('Diskusikan') >= 0 && row.indexOf('Diskusikan') < row.indexOf('Batalkan acara'));
  assert.match(output, /\.kumpul-plan-desktop-actions\{flex-wrap:nowrap/);
  assert.doesNotMatch(bar, /kumpul-plan-mobilebar-contact/);
  assert.ok(bar.indexOf('Ringkasan') < bar.indexOf('kumpul-plan-mobilebar-primary'));
  assert.ok(bar.indexOf('kumpul-plan-mobilebar-primary') < bar.indexOf('Lainnya'));
  assert.match(bar, /<path d="M4 6h16M4 12h16M4 18h16"/);

  props.page.plan.status = 'RSVP_OPEN';
  props.page.actions = ['gathering.invitations.submit', 'gathering.cancel'];
  assert.doesNotMatch(html(props), /data-bagdja-intent="gathering\.chat\.open"/);
});

test('invitation confirmation step prints the invitation card with banner, text, and a QR code', () => {
  const props = live('detail-rencana-gathering');
  props.page.plan.invitePolicy = 'OPEN';
  props.page.plan.publicInvitationHref = '/kumpul/gathering/invite/pub-1';
  props.page.plan.publicInvitationUrl = 'https://kumpul.bagdja.test/kumpul/gathering/invite/pub-1';
  props.page.plan.invitationBannerUrl = 'https://assets.example/banner.jpg';
  props.page.plan.invitationDescription = 'Belajar sambil rekreasi.';
  const output = html(props);
  const panel = output.slice(output.indexOf('data-plan-step-panel="INVITATION_CONFIRMATION"'));
  assert.match(panel, /class="kumpul-invite-share"/);
  assert.match(panel, /<img class="kumpul-invite-banner" src="https:\/\/assets\.example\/banner\.jpg"/);
  assert.match(panel, /Belajar sambil rekreasi\./);
  assert.match(panel, /<svg class="kumpul-invite-qr"[^>]*aria-label="QR code undangan terbuka"/);
  assert.match(panel, /https:\/\/kumpul\.bagdja\.test\/kumpul\/gathering\/invite\/pub-1/);

  props.page.plan.publicInvitationUrl = 'javascript:alert(1)';
  const unsafe = html(props);
  assert.doesNotMatch(unsafe, /javascript:alert/);
  assert.doesNotMatch(unsafe, /class="kumpul-invite-qr"/, 'tanpa URL absolut valid tidak ada QR');
});

test('shows venue address and a Google Maps link for options and the final location', () => {
  const output = html(live('detail-rencana-gathering'));
  assert.match(output, /Jl\. Kemang Raya No\. 12, Jakarta Selatan 12730/);
  // Satu baris: alamat lalu ikon Google Maps di kanan.
  assert.match(output, /<span class="kumpul-venue"><span class="kumpul-venue-address">Jl\. Kemang Raya No\. 12, Jakarta Selatan 12730<\/span><a class="kumpul-venue-map" href="https:\/\/maps\.app\.goo\.gl\/StudioTanahKemang" target="_blank" rel="noopener noreferrer" title="Buka di Google Maps" aria-label="Buka di Google Maps"><svg/);
  const props = live('detail-rencana-gathering');
  props.page.plan.occurrence.options[0].mapUrl = 'https://evil.test/maps';
  assert.doesNotMatch(html(props), /href="https:\/\/evil\.test/);
});

test('live gathering plan renders the planning form with Jakarta datetime inputs', () => {
  const props = live('detail-rencana-gathering');
  props.page.plan.workflowStep = 'PLAN';
  props.page.actions = ['gathering.plan.save', 'gathering.cancel'];
  const output = html(props);
  assert.match(output, /data-bagdja-field="title"/);
  assert.match(output, /<input type="datetime-local" data-bagdja-field="rsvpCloseAt" data-kumpul-datetime-input="" value="2026-12-10T23:59"\/>/);
  // HP: pemicu bottom sheet tanggal & jam (picker bawaan disembunyikan lewat CSS).
  assert.match(output, /<button type="button" class="kumpul-datetime-trigger" data-kumpul-datetime-trigger="" data-label="Batas reservasi" aria-label="Pilih batas reservasi">/);
  assert.match(output, /@media\(max-width:760px\)\{\.kumpul-datetime input\[data-kumpul-datetime-input\]\{display:none\}/);
  // Sheet tanggal: kolom dikunci agar baris jam (24 tombol) tidak melebarkan kalender.
  assert.match(output, /\.kumpul-dt-body\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  // Pemilih opsi: kategori digeser ke samping, item ke bawah (kartu seperti detail produk) + centang.
  const picker = output.slice(output.indexOf('class="kumpul-plan-pick"'), output.indexOf('</fieldset>', output.indexOf('class="kumpul-plan-pick"')));
  assert.ok(picker.indexOf('<h4>Sesi</h4>') < picker.indexOf('<h4>Konsumsi</h4>'), 'urutan kategori = urutan data');
  assert.match(picker, /<label class="kumpul-option-tile kumpul-plan-pick-item"><input type="checkbox" class="kumpul-plan-pick-check" data-bagdja-field="optionKeys" aria-label="Buka pilihan Sesi pagi" checked="" value="k_opt_opt_session_morning"\/><span class="kumpul-option-tile-thumb"><img /);
  assert.match(picker, /<button type="button" class="kumpul-plan-pick-info" data-plan-option-open="kumpul-plan-option-0"/, 'ⓘ membuka popup detail yang sama');
  assert.match(output, /<dialog id="kumpul-plan-option-0"/);
  assert.match(output, /\.kumpul-plan-pick\{[^}]*grid-auto-flow:column[^}]*scroll-snap-type:x mandatory/);
  assert.match(output, /data-bagdja-intent="gathering.plan.save" data-bagdja-key="k_plan_plan_workshop" data-bagdja-submit="true"/);
  assert.match(output, /data-plan-step-tab="INVITATIONS" aria-pressed="false" disabled=""/);
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

test('renders only the mobile bottom navigation when the host asks for bottomNavOnly', () => {
  const props = fixture('home');
  props.bottomNavOnly = true;
  props.auth = { ...props.auth, cartHref: '/kumpul-demo/cart', chatHref: '/kumpul-demo/chat' };
  const output = html(props);
  assert.match(output, /class="kumpul-template kumpul-bottom-nav-only"/);
  assert.match(output, /class="kumpul-mobile-dock" aria-label="Menu akun"/);
  assert.doesNotMatch(output, /<header/);
  assert.doesNotMatch(output, /<footer/);
  assert.match(output, /\.kumpul-template\.kumpul-bottom-nav-only\{min-height:0/, 'tinggi 0 di desktop');

  const headerOnly = fixture('home');
  headerOnly.headerOnly = true;
  assert.doesNotMatch(html(headerOnly), /<nav class="kumpul-mobile-dock"/, 'header-only tidak lagi membawa dock');
});

test('renders only the Kumpul header for host-managed pages', () => {
  const props = fixture('home');
  props.headerOnly = true;
  const output = html(props);
  assert.match(output, /class="kumpul-header"/);
  assert.match(output, /\.kumpul-template\.kumpul-header-only\{min-height:0\}/);
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
  // Sumber (bundle dist di-minify — nama variabel tidak dipertahankan).
  const clientBundle = readFileSync(path.join(__dirname, '..', 'src', 'client.js'), 'utf8');

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
  assert.match(clientBundle, /data-sim-save-invitation/);
  assert.match(clientBundle, /Tampilan undangan tersimpan di preview ini saja/);
  assert.doesNotMatch(clientBundle, /data-sim-participant-option|data-sim-rsvp(?!-)/);
  assert.match(clientBundle, /data-billing-filter/);
  assert.match(clientBundle, /data-plan-live/);
  assert.match(clientBundle, /data-kumpul-reservation-reject-open/);
  assert.match(clientBundle, /pendingRejectButton\.click\(\)/);
  assert.match(clientBundle, /data-kumpul-reservation-reason-option/);
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
  assert.match(output, /--kt-bg:#ffffff/);
  assert.doesNotMatch(output, /<script>/);
});

test('uses the requested Kumpul theme defaults when no theme is supplied', () => {
  const props = fixture('home');
  props.templateTheme = { colors: {} };
  props.websiteTheme = { colors: {} };
  const output = html(props);

  assert.match(output, /--kt-bg:#ffffff/);
  assert.match(output, /--kt-text:#18181b/);
  assert.match(output, /--kt-accent:#00608e/);
  assert.match(output, /--kt-hover:#00547d/);
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

test('plan options are grouped per category in data order as swipeable tiles with a detail popup per option', () => {
  const output = html(live('detail-rencana-gathering'));
  const start = output.indexOf('class="kumpul-plan-option-groups"');
  assert.ok(start > 0, 'rail opsi dirender');
  const rails = output.slice(start, output.indexOf('<dialog id="kumpul-plan-option-0"'));
  // Urutan kategori mengikuti data: Sesi lalu Konsumsi — tidak diurutkan abjad.
  assert.ok(rails.indexOf('<h3>Sesi</h3>') < rails.indexOf('<h3>Konsumsi</h3>'));
  assert.equal((rails.match(/data-plan-option-group=""/g) || []).length, 2);
  // Kartu: foto pertama | nama + potongan keterangan; geser ke samping (scroll-snap).
  assert.match(rails, /<button type="button" role="listitem" class="kumpul-option-tile" data-plan-option-open="kumpul-plan-option-2" data-plan-option-id="k_opt_opt_menu_box"[^>]*><span class="kumpul-option-tile-thumb"><img [^>]*><\/span><span class="kumpul-option-tile-copy"><strong class="kumpul-plan-option-name">Paket nasi kotak<\/strong><span class="kumpul-option-tile-summary">Nasi, lauk, dan air mineral\. • Bisa request tanpa pedas<\/span>/);
  assert.match(output, /\.kumpul-option-rail\{[^}]*grid-auto-flow:column[^}]*scroll-snap-type:x mandatory/);
  // Rail digeser di dalam kartu, tidak melebarkan kolom (bug web: kartu keluar dari kotak).
  assert.match(output, /\.kumpul-plan-main\{min-width:0;display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(output, /\.kumpul-plan-option-groups\{min-width:0;display:grid;grid-template-columns:minmax\(0,1fr\)/);
  // Popup: carousel bila gambar > 1, tap gambar → viewer fullscreen.
  const dialog = output.slice(output.indexOf('<dialog id="kumpul-plan-option-0"'), output.indexOf('</dialog>', output.indexOf('<dialog id="kumpul-plan-option-0"')));
  assert.equal((dialog.match(/data-option-image-open="/g) || []).length, 2);
  assert.match(dialog, /data-option-carousel-next=""/);
  assert.equal((output.match(/data-plan-option-dialog=""/g) || []).length, 4);
  assert.match(output, /<div class="kumpul-plan-option-rich"><p>Nasi, lauk, dan <strong>air mineral<\/strong>\.<\/p><ul><li>Bisa request tanpa pedas<\/li><\/ul><\/div>/);
  assert.match(output, /<p class="kumpul-plan-option-plain">Workshop membuat mug untuk pemula\.<\/p>/);
});

test('product detail page renders swipeable option tiles in data order with popups and host intents', () => {
  const props = live('detail-produk');
  props.bridgeVersion = 1;
  const output = html(props);
  assert.match(output, /data-product-detail=""/);
  assert.match(output, /<h1>Study Tour Bandung — Paket Sekolah<\/h1>/);
  const rails = output.slice(output.indexOf('class="kumpul-plan-option-groups"'), output.indexOf('<dialog id="kumpul-product-option-0"'));
  assert.ok(rails.indexOf('<h3>Konsumsi</h3>') < rails.indexOf('<h3>Lokasi</h3>'));
  assert.match(rails, /data-plan-option-open="kumpul-product-option-1"[^>]*><span class="kumpul-option-tile-thumb"><span aria-hidden="true">/, 'tanpa gambar → ikon pengganti');
  assert.match(rails, /<strong class="kumpul-plan-option-name">Prasmanan Nusantara<\/strong><span class="kumpul-option-tile-summary">Prasmanan di rumah makan mitra\.<\/span>/);
  assert.match(output, /<span>3 pilihan<\/span>/);
  // Popup: carousel 3 gambar, HTML ringan, ketersediaan, benefit, lokasi + Google Maps.
  const dialog = output.slice(output.indexOf('<dialog id="kumpul-product-option-0"'), output.indexOf('</dialog>', output.indexOf('<dialog id="kumpul-product-option-0"')));
  assert.equal((dialog.match(/data-option-image-open="/g) || []).length, 3);
  assert.equal((dialog.match(/data-option-carousel-dot="/g) || []).length, 3);
  assert.match(dialog, /<div class="kumpul-plan-option-rich"><p>Makan siang lengkap dan <strong>snack box<\/strong>\.<\/p><\/div>/);
  assert.match(dialog, /<strong>Ketersediaan<\/strong><span>Tersedia selama acara berlangsung<\/span>/);
  assert.match(dialog, /<li>Air mineral botol<\/li>/);
  const single = output.slice(output.indexOf('<dialog id="kumpul-product-option-2"'));
  assert.doesNotMatch(single.slice(0, single.indexOf('</dialog>')), /data-option-carousel-next/, 'satu gambar → tanpa navigasi carousel');
  assert.match(output, /href="https:\/\/maps\.app\.goo\.gl\/MuseumGeologi"/);
  // CTA lewat intent host, di panel (web) dan bar bawah (HP).
  assert.equal((output.match(/data-bagdja-intent="gathering\.plan\.create" data-bagdja-key="k_product_study_tour"/g) || []).length, 2);
  assert.equal((output.match(/data-bagdja-intent="product\.chat\.open"/g) || []).length, 2);
  assert.match(output, /<button type="button" class="kumpul-product-primary" data-bagdja-intent="gathering\.plan\.create"/, 'aktif saat bridge tersedia');
  assert.match(output, /Masuk diperlukan untuk merencanakan gathering/);
});

test('product detail actions stay disabled without the host bridge (designer preview)', () => {
  const output = html(live('detail-produk'));
  assert.match(output, /<button type="button" class="kumpul-product-primary" disabled=""/);
});

test('client mounts the date sheet and image viewer inside the template root (theme variables)', () => {
  const client = readFileSync(path.join(__dirname, '..', 'src', 'client.js'), 'utf8');
  assert.match(client, /\(document\.querySelector\('\.kumpul-template'\) \|\| document\.body\)\.append\(dateTimeSheet\)/);
  assert.match(client, /\(document\.querySelector\('\.kumpul-template'\) \|\| document\.body\)\.append\(imageViewer\)/);
  assert.doesNotMatch(client, /document\.body\.append\(/);
});

test('invitation text renders sanitized HTML from Bagdja and the client bundle stays under the runtime limit', () => {
  const props = live('detail-rencana-gathering');
  props.page.plan.workflowStep = 'INVITATION_CONFIRMATION';
  props.page.plan.invitationDescription = 'Kumpul bareng.\n• Bawa topi';
  props.page.plan.invitationDescriptionHtml = '<p>Kumpul <strong>bareng</strong>.</p><ul><li>Bawa topi</li></ul>';
  const output = html(props);
  assert.match(output, /<div class="kumpul-invite-description is-rich"><p>Kumpul <strong>bareng<\/strong>\.<\/p><ul><li>Bawa topi<\/li><\/ul><\/div>/);
  // MAX_CLIENT_BUNDLE_BYTES runtime = 512 KB.
  const size = readFileSync(path.join(__dirname, '..', 'dist', 'client.js')).length;
  assert.ok(size <= 512 * 1024, `client bundle ${size} B melebihi 512 KB`);
});

test('invitation appearance save lives in the secondary actions and shares the submit scope', () => {
  const props = live('detail-rencana-gathering');
  props.page.plan.workflowStep = 'INVITATIONS';
  props.page.actions = ['gathering.invitation.content.save', 'gathering.invitations.submit', 'gathering.cancel'];
  props.bridgeVersion = 1;
  const output = html(props);
  const panel = output.slice(output.indexOf('data-plan-step-panel="INVITATIONS"'), output.indexOf('data-plan-step-panel="INVITATION_CONFIRMATION"'));
  const fieldset = panel.slice(panel.indexOf('class="kumpul-invite-appearance"'), panel.indexOf('</fieldset>', panel.indexOf('class="kumpul-invite-appearance"')));
  assert.doesNotMatch(fieldset, /gathering\.invitation\.content\.save/, 'tombol simpan tidak lagi di dalam form');
  assert.doesNotMatch(fieldset, /data-bagdja-scope/, 'form tanpa scope sendiri');
  const sheet = panel.slice(panel.indexOf('class="kumpul-sheet"'), panel.indexOf('class="kumpul-plan-mobilebar"'));
  assert.match(sheet, /data-bagdja-intent="gathering\.invitation\.content\.save"[^>]*>Simpan tampilan undangan/);
  const desktopRow = panel.slice(panel.indexOf('kumpul-plan-desktop-actions'), panel.indexOf('class="kumpul-plan-mobile"'));
  assert.match(desktopRow, /Simpan tampilan undangan/);
  assert.match(fieldset, /Perubahan otomatis tersimpan saat undangan dikirim\./);
  // Tombol kirim (tersembunyi, dipicu popup konfirmasi) satu scope dengan isian teks undangan.
  const scopeStart = panel.indexOf('data-bagdja-scope=""');
  const scope = panel.slice(scopeStart);
  assert.ok(scope.indexOf('data-bagdja-field="invitation.description"') >= 0);
  assert.ok(scope.indexOf('data-kumpul-submit-invitation-intent') >= 0);
});

test('open invitation share card offers host-run share and copy link buttons', () => {
  const props = live('detail-rencana-gathering');
  props.page.plan.workflowStep = 'INVITATION_CONFIRMATION';
  props.page.plan.invitePolicy = 'OPEN';
  props.page.plan.publicInvitationHref = '/kumpul-demo/gathering/invite/inv-1';
  props.page.plan.publicInvitationUrl = 'https://kumpul.test/kumpul-demo/gathering/invite/inv-1';
  const output = html(props);
  assert.match(output, /data-bagdja-share="share" data-bagdja-share-url="https:\/\/kumpul\.test\/kumpul-demo\/gathering\/invite\/inv-1" data-bagdja-share-title="[^"]+"[^>]*>.*?Bagikan<\/button>/);
  assert.match(output, /data-bagdja-share="copy" data-bagdja-share-url="https:\/\/kumpul\.test\/kumpul-demo\/gathering\/invite\/inv-1"[^>]*>.*?Salin tautan<\/button>/);
});

test('invitation page renders Kumpul hero, vote rails and the RSVP form for guests', () => {
  const props = live('undangan');
  props.bridgeVersion = 1;
  const output = html(props);
  assert.match(output, /data-invitation-page=""/);
  assert.match(output, /<p class="kumpul-eyebrow">Undangan terbuka<\/p><h1>Bukber Alumni 2026<\/h1>/);
  assert.match(output, /<div class="kumpul-detail-card kumpul-invite-description is-rich"><p>Yuk buka puasa bareng!/);
  // Voting: kartu geser per kategori, radio optionKeys di scope yang sama dengan form & tombol RSVP.
  const flow = output.slice(output.indexOf('class="kumpul-invite-flow" data-bagdja-scope=""'));
  // Satu baris per kategori, item digeser ke samping, centang per item.
  assert.match(flow, /<div class="kumpul-invite-pick"><section class="kumpul-invite-vote-group">/);
  assert.match(flow, /<ul class="kumpul-option-rail kumpul-invite-vote-rail" role="radiogroup" aria-label="Paket"><li class="kumpul-invite-vote-item"><label class="kumpul-option-tile kumpul-invite-vote-tile"><input type="radio" class="kumpul-invite-vote-radio" name="kumpul-vote-0" data-bagdja-field="optionKeys"[^>]*value="k[^"]+"\/>/);
  assert.match(flow, /60% · 3 suara/);
  assert.match(flow, /data-bagdja-field="attendee\.name"/);
  assert.match(flow, /data-bagdja-field="attendee\.contact"/);
  assert.match(flow, /data-bagdja-intent="gathering\.invitation\.rsvp"[^>]*>Kirim kode verifikasi<\/button>/);
  assert.match(output, /class="kumpul-product-mobilebar kumpul-invite-mobilebar"/);
  // Popup opsi dengan carousel (2 gambar).
  const dialog = output.slice(output.indexOf('<dialog id="kumpul-invite-option-0"'), output.indexOf('</dialog>', output.indexOf('<dialog id="kumpul-invite-option-0"')));
  assert.equal((dialog.match(/data-option-image-open="/g) || []).length, 2);
  assert.match(output, /<summary>Syarat &amp; ketentuan peserta<\/summary><p>DP tidak dapat dikembalikan H-3\.<\/p>/);
});

test('invitation page switches the RSVP card per viewer state', () => {
  const render = (viewer, actions) => {
    const props = live('undangan');
    props.bridgeVersion = 1;
    props.page.viewer = { canPay: false, canAddReservation: false, loggedIn: false, ...viewer };
    props.page.actions = actions;
    return html(props);
  };
  const otp = render({ state: 'otp_pending', otpDestination: 'de•••@example.com', form: { askName: true, askContact: true, askWhatsapp: true, whatsappRequired: false } },
    ['gathering.invitation.rsvp', 'gathering.invitation.verify_otp', 'gathering.invitation.resend_otp']);
  assert.match(otp, /data-bagdja-field="otp\.code"/);
  assert.match(otp, /de•••@example\.com/);
  assert.match(otp, /data-bagdja-intent="gathering\.invitation\.verify_otp"/);
  assert.match(otp, /data-bagdja-intent="gathering\.invitation\.resend_otp"/);

  const registered = render({
    state: 'registered', paymentStatus: 'UNPAID', paymentLabel: 'Belum dibayar', canPay: true,
    attendee: { name: 'Dewi Anggraini', contact: 'de•••@example.com', phone: '+6281••••••890' },
  }, ['gathering.invitation.pay']);
  assert.match(registered, /RSVP kamu sudah tercatat/);
  assert.match(registered, /<dl class="kumpul-invite-attendee"><div><dt>Nama<\/dt><dd>Dewi Anggraini<\/dd><\/div><div><dt>Email<\/dt><dd>de•••@example\.com<\/dd><\/div><div><dt>WhatsApp<\/dt><dd>\+6281••••••890<\/dd><\/div><\/dl>/);
  assert.match(registered, /data-bagdja-intent="gathering\.invitation\.pay"[^>]*>Bayar kursi<\/button>/);
  assert.doesNotMatch(registered, /class="kumpul-invite-vote-radio"/, 'hasil voting baca saja');

  const login = render({ state: 'login_required', recipientContact: 'pe•••@gmail.com' }, []);
  assert.match(login, /href="\/auth\/login\?next=[^"]+"[^>]*>Masuk untuk konfirmasi/);
  const mismatch = render({ state: 'account_mismatch', accountLabel: 'la•••@example.com', recipientContact: 'pe•••@gmail.com' }, []);
  assert.match(mismatch, /Ganti akun/);
});

test('invitation uses bottom sheets for OTP, adding another participant and participant terms', () => {
  const render = (viewer, actions, mutate) => {
    const props = live('undangan');
    props.bridgeVersion = 1;
    props.page.viewer = { canPay: false, canAddReservation: false, loggedIn: false, ...viewer };
    props.page.actions = actions;
    if (mutate) mutate(props.page);
    return html(props);
  };
  const otp = render({ state: 'otp_pending', otpDestination: 'de•••@example.com', form: { askName: true, askContact: true, askWhatsapp: true, whatsappRequired: false } },
    ['gathering.invitation.rsvp', 'gathering.invitation.verify_otp', 'gathering.invitation.resend_otp']);
  const otpSheet = otp.slice(otp.indexOf('data-kumpul-invite-sheet="otp"'), otp.indexOf('</dialog>', otp.indexOf('data-kumpul-invite-sheet="otp"')));
  assert.match(otp, /<dialog class="kumpul-invite-sheet" data-kumpul-invite-sheet="otp" data-auto-open-mobile=""/);
  assert.match(otpSheet, /data-bagdja-field="otp\.code"/);
  assert.match(otpSheet, /data-bagdja-intent="gathering\.invitation\.verify_otp"/);
  assert.match(otpSheet, /data-bagdja-intent="gathering\.invitation\.resend_otp"[^>]*>Kirim ulang kode/);
  assert.match(otp, /class="kumpul-product-mobile-primary" data-kumpul-sheet-open="otp"/);

  const added = render({ state: 'registered', paymentStatus: 'UNPAID', paymentLabel: 'Belum dibayar', canAddReservation: true, form: { askName: true, askContact: true, askWhatsapp: true, whatsappRequired: false } },
    ['gathering.invitation.rsvp'], (page) => { page.optionGroups[0].options[1].selected = true; });
  const addSheet = added.slice(added.indexOf('data-kumpul-invite-sheet="add"'), added.indexOf('</dialog>', added.indexOf('data-kumpul-invite-sheet="add"')));
  assert.match(addSheet, /Pilihan sebelumnya sudah terisi/);
  // Default = pilihan sebelumnya (opsi ke-2) dan diletakkan paling depan; dapat dipilih ulang.
  const radios = addSheet.match(/<input type="radio"[^>]*\/>/g) || [];
  assert.equal(radios.length, 2);
  assert.match(radios[0], /name="kumpul-add-vote-0"[^>]*aria-label="Pilih Bedeng Hills Coffee"[^>]*checked=""/);
  assert.doesNotMatch(radios[1], /checked=""/);
  // Hasil voting di halaman: pilihan Anda juga paling depan.
  const result = added.slice(added.indexOf('Hasil voting paket'), added.indexOf('data-kumpul-invite-sheet="add"'));
  assert.ok(result.indexOf('Bedeng Hills Coffee') < result.indexOf('Paket Liwet Asep Stroberi'));
  assert.match(result, /class="kumpul-option-tile kumpul-invite-vote-tile is-readonly is-selected"/);
  assert.match(addSheet, /data-bagdja-field="attendee\.name"/);
  assert.match(addSheet, /data-bagdja-intent="gathering\.invitation\.rsvp"/);
  // Halaman: hasil voting baca saja (radio hanya di sheet), pemicu sheet di panel & bar HP.
  const beforeSheet = added.slice(0, added.indexOf('data-kumpul-invite-sheet="add"'));
  assert.doesNotMatch(beforeSheet, /class="kumpul-plan-pick-check kumpul-invite-vote-radio"/);
  assert.match(added, /data-kumpul-sheet-open="add"[^>]*>\+ Tambah peserta lain/);

  // Syarat peserta: tombol di bar aksi bawah membuka bottom sheet.
  assert.match(otp, /<button type="button" class="kumpul-invite-terms-btn" data-kumpul-sheet-open="terms"/);
  assert.match(otp, /data-kumpul-invite-sheet="terms"[\s\S]*?DP tidak dapat dikembalikan H-3\./);
});

test('buttons show a loading spinner while the host processes an action', () => {
  const output = html(live('undangan'));
  assert.match(output, /@keyframes kumpul-spin/);
  assert.match(output, /\.kumpul-template :is\(button,a,label\)\[aria-busy=true\]::before\{content:'';[^}]*animation:kumpul-spin/);
  assert.match(output, /\.kumpul-template :is\(button,a,label\)\[aria-busy=true\]\{[^}]*opacity:1!important/);
  const client = readFileSync(path.join(__dirname, '..', 'src', 'client.js'), 'utf8');
  assert.match(client, /attributeFilter: \['aria-busy'\]/, 'loading dicerminkan ke tombol yang terlihat');
  assert.match(client, /data-kumpul-invitation-confirm-open/);
  assert.match(client, /data-kumpul-reservation-reject-open/);
});

test('invitation QR card groups share, copy and open-page as uniform buttons', () => {
  const props = live('detail-rencana-gathering');
  props.page.plan.workflowStep = 'INVITATION_CONFIRMATION';
  props.page.plan.invitePolicy = 'OPEN';
  props.page.plan.publicInvitationHref = '/kumpul-demo/gathering/invite/inv-1';
  props.page.plan.publicInvitationUrl = 'https://kumpul.test/kumpul-demo/gathering/invite/inv-1';
  const output = html(props);
  const actions = output.slice(output.indexOf('<div class="kumpul-invite-share-actions">'), output.indexOf('</div>', output.indexOf('<div class="kumpul-invite-share-actions">')));
  assert.match(actions, /data-bagdja-share="share"/);
  assert.match(actions, /data-bagdja-share="copy"/);
  assert.match(actions, /<a class="kumpul-invite-share-btn is-ghost" href="\/kumpul-demo\/gathering\/invite\/inv-1">.*Buka halaman undangan<\/a>/);
  assert.match(output, /\.kumpul-invite-share-qr \.kumpul-invite-share-btn\.is-ghost\{grid-column:1\/-1/);
});

test('payment step shows vote results per option and picks final options with the invitation rail experience', () => {
  const props = live('detail-rencana-gathering');
  props.page.plan.workflowStep = 'PAYMENT_CONFIRMATION';
  props.page.actions = ['gathering.event.confirm', 'gathering.cancel'];
  const [morning, afternoon, box, snack] = props.page.plan.occurrence.options;
  morning.votes = 1;
  afternoon.votes = 3;
  box.votes = 2;
  snack.votes = 2;
  snack.isFinal = true;
  const output = html(props);
  const panel = output.slice(output.indexOf('data-plan-step-panel="PAYMENT_CONFIRMATION"'));

  const results = panel.slice(panel.indexOf('data-plan-vote-results'), panel.indexOf('data-plan-final-options'));
  assert.match(results, /Hasil voting peserta/);
  // Ringkasan sederhana: kartu per kategori dalam grid responsif, tanpa rail/gambar/radio.
  assert.match(results, /<div class="kumpul-vote-summary"><article class="kumpul-vote-card" aria-label="Hasil voting Sesi">/);
  assert.doesNotMatch(results, /kumpul-option-rail|<img|type="radio"|kumpul-plan-pick-info/);
  assert.match(output, /\.kumpul-vote-summary\{[^}]*grid-template-columns:repeat\(auto-fill,minmax\(min\(100%,240px\),1fr\)\)/);
  // Urut suara terbanyak; persentase dihitung dari total kategori.
  assert.ok(results.indexOf('Sesi siang') < results.indexOf('Sesi pagi'));
  assert.match(results, /<li class="is-leading"><div class="kumpul-vote-card-row"><span class="kumpul-vote-card-name">Sesi siang<\/span><strong class="kumpul-vote-card-percent">75%<\/strong>/);
  assert.match(results, /3 suara · terbanyak/);
  assert.match(results, /<strong class="kumpul-vote-card-percent">25%<\/strong>/);
  assert.match(results, /<span>4 suara<\/span>/);
  // Seri → tidak ada yang ditandai terbanyak.
  const consumption = results.slice(results.indexOf('aria-label="Hasil voting Konsumsi"'));
  assert.doesNotMatch(consumption, /is-leading|terbanyak/);

  const final = panel.slice(panel.indexOf('data-plan-final-options'));
  assert.match(final, /Opsi final gathering/);
  assert.match(final, /role="radiogroup" aria-label="Opsi final Sesi"/);
  // Belum ada final di Sesi → suara terbanyak dicentang & paling depan.
  const sesi = final.slice(final.indexOf('aria-label="Opsi final Sesi"'), final.indexOf('aria-label="Opsi final Konsumsi"'));
  assert.match(sesi, /^[^]*?<li class="kumpul-invite-vote-item"><label class="kumpul-option-tile kumpul-invite-vote-tile"><input type="radio" class="kumpul-invite-vote-radio" name="kumpul-final-0" data-bagdja-field="optionKeys"[^>]*checked="" value="k_opt_opt_session_afternoon"/);
  // Sudah ada final di Konsumsi → opsi final paling depan walau suaranya seri.
  const konsumsi = final.slice(final.indexOf('aria-label="Opsi final Konsumsi"'));
  assert.match(konsumsi, /^[^]*?<input type="radio"[^>]*checked="" value="k_opt_opt_menu_snack"/);
  assert.match(konsumsi, /Opsi final/);
  assert.equal((final.match(/checked=""/g) || []).length, 2);
  assert.match(output, /data-bagdja-intent="gathering\.event\.confirm"/);
});

test('payment step manages participant payments in a dedicated modal and keeps Diskusikan on every step', () => {
  const props = live('detail-rencana-gathering');
  props.page.plan.workflowStep = 'PAYMENT_CONFIRMATION';
  props.page.actions = ['gathering.chat.open', 'gathering.registrations.checkout', 'gathering.invoices.resend', 'gathering.event.confirm', 'gathering.cancel'];
  const output = html(props);
  const panelOf = (step) => {
    const start = output.indexOf(`data-plan-step-panel="${step}"`);
    const next = output.indexOf('data-plan-step-panel=', start + 30);
    return output.slice(start, next < 0 ? undefined : next);
  };
  const payment = panelOf('PAYMENT_CONFIRMATION');
  const desktop = payment.slice(payment.indexOf('kumpul-plan-desktop-actions'), payment.indexOf('class="kumpul-plan-mobile"'));
  // Aksi utama: Lihat Pembayaran (buka modal) lalu Konfirmasi acara.
  assert.match(desktop, /class="kumpul-plan-sim-soft" data-kumpul-reservation-open="" aria-haspopup="dialog" aria-controls="kumpul-payment-dialog">Lihat Pembayaran<span class="kumpul-reservation-count">\d+ lunas<\/span>/);
  assert.ok(desktop.indexOf('Lihat Pembayaran') < desktop.indexOf('Konfirmasi acara'));
  assert.doesNotMatch(desktop, /gathering\.registrations\.checkout/);
  const mobileBar = payment.slice(payment.indexOf('class="kumpul-plan-mobilebar"'));
  // HP: bar bawah hanya Diskusikan + Lihat Pembayaran; Konfirmasi acara pindah ke kaki sheet pembayaran.
  assert.match(mobileBar, /class="kumpul-plan-mobilebar-primary"><button[^>]*kumpul-plan-mobilebar-discuss[\s\S]*Lihat Pembayaran/);
  assert.doesNotMatch(mobileBar, /Konfirmasi acara/);
  const sheet = payment.slice(payment.indexOf('class="kumpul-sheet"'), payment.indexOf('class="kumpul-plan-mobilebar"'));
  assert.match(sheet, /Kirim ulang invoice/);

  // Modal pembayaran: tab filter, daftar peserta dengan centang, kaki berisi tombol bayar.
  const dialogStart = payment.indexOf('<dialog id="kumpul-payment-dialog"');
  assert.ok(dialogStart >= 0);
  const dialog = payment.slice(dialogStart, payment.indexOf('</dialog>', dialogStart));
  assert.match(dialog, /class="kumpul-reservation-dialog kumpul-payment-dialog" data-kumpul-reservation-dialog=""/);
  for (const group of ['UNPAID', 'PENDING_PAYMENT', 'PAID', 'REFUNDED']) {
    assert.match(dialog, new RegExp(`data-kumpul-reservation-filter="${group}"`));
  }
  assert.doesNotMatch(dialog, /data-kumpul-reservation-filter="all"/);
  assert.match(dialog, /data-kumpul-reservation-item=""[^>]*data-kumpul-reservation-group="(UNPAID|PAID|PENDING_PAYMENT|REFUNDED)"/);
  assert.match(dialog, /class="kumpul-reservation-foot kumpul-payment-foot"><button[^>]*data-bagdja-intent="gathering\.registrations\.checkout"[^>]*>Bayarkan peserta terpilih<\/button><button type="button" class="kumpul-plan-sim-primary kumpul-payment-confirm-mobile"[^>]*>Konfirmasi acara/);
  // Konfirmasi acara: tombol web & HP hanya membuka modal Kumpul; intent sekali, di modal.
  assert.match(desktop, /class="kumpul-plan-sim-primary" disabled="" data-kumpul-sheet-open="confirm-event"[^>]*>Konfirmasi acara/);
  assert.match(dialog, /kumpul-payment-confirm-mobile"[^>]*data-kumpul-sheet-open="confirm-event"/);
  assert.equal((output.match(/data-bagdja-intent="gathering\.event\.confirm"/g) || []).length, 1, 'intent hanya di modal');
  const confirmStart = payment.indexOf('data-kumpul-invite-sheet="confirm-event"');
  const confirmDialog = payment.slice(confirmStart, payment.indexOf('</dialog>', confirmStart));
  assert.match(confirmDialog, /Konfirmasi acara\?/);
  assert.match(confirmDialog, /data-kumpul-final-summary=""/);
  assert.match(confirmDialog, /data-bagdja-intent="gathering\.event\.confirm"[^>]*data-bagdja-confirmed="true"[^>]*>Ya, konfirmasi acara/);
  assert.match(confirmDialog, /data-kumpul-sheet-close=""[^>]*>Kembali/);
  assert.match(output, /@media\(max-width:760px\)\{\.kumpul-payment-confirm-mobile\{display:inline-flex !important/);
  assert.match(dialog, /class="kumpul-plan-refresh is-compact"[^>]*data-bagdja-refresh=""/);
  assert.equal((output.match(/data-bagdja-intent="gathering\.registrations\.checkout"/g) || []).length, 1, 'bayar hanya di modal');
  assert.match(output, /\.kumpul-reservation-dialog \.kumpul-reservation-foot\.kumpul-payment-foot\{flex:none;padding:12px 20px;display:flex/);

  // Tahap ringkasan (baca saja) tetap punya Diskusikan di web & HP.
  for (const step of ['PLAN', 'INVITATIONS', 'INVITATION_CONFIRMATION', 'PAYMENT_CONFIRMATION']) {
    assert.equal((panelOf(step).match(/data-bagdja-intent="gathering\.chat\.open"/g) || []).length, 2, step);
  }
  const client = readFileSync(path.join(__dirname, '..', 'src', 'client.js'), 'utf8');
  assert.match(client, /getAttribute\('aria-controls'\)/);
});

test('reservation and payment steps offer a host refresh button to reload registrations', () => {
  const props = live('detail-rencana-gathering');
  props.bridgeVersion = 1;
  const confirming = html(props);
  const confirmation = confirming.slice(confirming.indexOf('data-plan-step-panel="INVITATION_CONFIRMATION"'), confirming.indexOf('data-plan-step-panel="PAYMENT_CONFIRMATION"'));
  assert.match(confirmation, /<div class="kumpul-plan-refresh-row"><div class="kumpul-plan-refresh-copy"><p class="kumpul-plan-sim-help">Peserta hadir[\s\S]*?<button type="button" class="kumpul-plan-refresh" data-bagdja-refresh=""[^>]*>[\s\S]*?<span>Muat ulang<\/span>/);
  const head = confirmation.slice(confirmation.indexOf('class="kumpul-reservation-head"'), confirmation.indexOf('class="kumpul-reservation-body"'));
  assert.match(head, /class="kumpul-plan-refresh is-compact" data-bagdja-refresh=""[^>]*aria-label="Muat ulang data terbaru"/);
  assert.doesNotMatch(confirmation, /class="kumpul-plan-refresh[^"]*" disabled=""/);

  props.page.plan.workflowStep = 'PAYMENT_CONFIRMATION';
  const paying = html(props);
  const payment = paying.slice(paying.indexOf('data-plan-step-panel="PAYMENT_CONFIRMATION"'));
  assert.match(payment, /kumpul-plan-refresh-copy"><p class="kumpul-plan-sim-help">Peserta lunas[\s\S]*?data-bagdja-refresh=""/);
  // Tahap yang sudah lewat (baca saja) tidak punya tombol muat ulang.
  const readonly = paying.slice(paying.indexOf('data-plan-step-panel="INVITATION_CONFIRMATION"'), paying.indexOf('data-plan-step-panel="PAYMENT_CONFIRMATION"'));
  assert.doesNotMatch(readonly, /data-bagdja-refresh/);

  // Tanpa bridge (preview desainer) tombol nonaktif.
  assert.match(html(live('detail-rencana-gathering')), /class="kumpul-plan-refresh" disabled="" data-bagdja-refresh=""/);
  const client = readFileSync(path.join(__dirname, '..', 'src', 'client.js'), 'utf8');
  assert.match(client, /closest\('\[data-bagdja-refresh\]'\)/);
  assert.match(client, /kumpul-restore:/);
});

// ── Kontrak D8: shell persisten + isi saja ────────────────────────────────────

test('shell renders header, outlet, footer, and bottom nav once, without page content', () => {
  const props = { ...fixture('home'), shell: true };
  const output = html(props);
  assert.match(output, /class="kumpul-template kumpul-shell"/);
  assert.match(output, /<div class="kumpul-shell-outlet" data-bagdja-outlet="">/);
  assert.match(output, /class="kumpul-header"/);
  assert.match(output, /class="kumpul-footer"/);
  assert.match(output, /class="kumpul-mobile-dock"[^>]*data-bagdja-bottom-nav=""/);
  assert.match(output, /data-bagdja-nav="page:/, 'page menu links carry a nav key');
  assert.match(output, /data-bagdja-nav="calendar"/, 'account menu links carry a nav key');
  assert.doesNotMatch(output, /<main/, 'page content belongs in the outlet, not the shell');
  assert.doesNotMatch(output, /Kumpul bareng jadi lebih mudah\./);
});

test('contentOnly renders the page without header, footer, dock, or styles and announces the active menu', () => {
  const home = html({ ...fixture('home'), contentOnly: true });
  assert.match(home, /class="kumpul-template kumpul-content-only"/);
  assert.match(home, /<main class="kumpul-main">/);
  assert.match(home, /Kumpul bareng jadi lebih mudah\./);
  assert.doesNotMatch(home, /class="kumpul-header"|class="kumpul-footer"|class="kumpul-mobile-dock"|<style/);
  assert.match(home, /data-bagdja-active-nav="page:[^"]+"/, 'home page marks the home menu');

  const calendar = html({ ...fixture('calendar'), contentOnly: true });
  assert.match(calendar, /data-bagdja-active-nav="[^"]*\bcalendar\b[^"]*"/);
});

test('shell keeps the dock offset for content inside it', () => {
  const output = html({ ...fixture('home'), shell: true });
  assert.match(output, /\.kumpul-shell \.kumpul-content-only\{--kumpul-dock-offset:inherit;--kumpul-bar-safe:inherit\}/);
});

test('client.js mounts per root for the inline host and the whole document elsewhere', () => {
  const client = readFileSync(path.join(__dirname, '..', 'dist', 'client.js'), 'utf8');
  assert.match(client, /__bagdjaTemplateHost/);
  assert.match(client, /BagdjaTemplateClient/);
});

// ── Filter section Daftar Produk (tipe + kategori) ───────────────────────────

test('product list section: "all" shows every type and categories narrow the list', () => {
  const props = fixture('home');
  const products = props.products.map((product, index) => ({ ...product, type: index === 0 ? 'service' : product.type, categoryId: index === 0 ? 'cat-a' : 'cat-b' }));
  const escape = (value) => value.replace(/&/g, '&amp;');
  const first = escape(products[0].name);
  const second = escape(products[1].name);
  const withGrid = (content) => ({
    ...props,
    products,
    sections: props.sections.map((section) => section.type === 'products_grid'
      ? { ...section, content: { ...section.content, ...content } }
      : section),
  });
  const all = html(withGrid({ filter_type: 'all', category_ids: [] }));
  assert.ok(all.includes(first) && all.includes(second), '"all" shows the service too');
  const onlyA = html(withGrid({ filter_type: 'all', category_ids: ['cat-a'] }));
  assert.ok(onlyA.includes(first));
  assert.ok(!onlyA.includes(second));
});

// ── Draft pesanan (praorder sebelum penawaran) ────────────────────────────────

test('draft order page renders praorder steps with every field type in the Kumpul layout', () => {
  const output = html(fixture('draft-order'));
  assert.match(output, /data-draft-order=""/);
  assert.match(output, /Road Trip Pangandaran/);
  assert.match(output, /Menunggu penawaran/);
  assert.match(output, /class="kumpul-header"/, 'Kumpul header and navigation stay on the page');
  // Langkah selesai menampilkan isian; langkah berjalan menampilkan form.
  assert.match(output, /Pantai Pangandaran/);
  assert.match(output, /type="date"[^>]*data-bagdja-field="praorder.tanggal_berangkat"|data-bagdja-field="praorder.tanggal_berangkat"[^>]*type="date"/);
  assert.match(output, /type="datetime-local"/);
  assert.match(output, /data-kumpul-geolocate=/);
  assert.match(output, /<select[^>]*data-bagdja-field="praorder.armada"/);
  assert.match(output, /data-bagdja-field="praorder.file"[^>]*data-bagdja-target="foto_rombongan"/);
  assert.match(output, /data-bagdja-intent="order.praorder.file.remove"[^>]*data-bagdja-index="0"/);
  assert.match(output, /data-bagdja-intent="order.praorder.submit"[^>]*data-bagdja-step="dStepKey0000002"/);
  assert.match(output, /data-bagdja-intent="order.praorder.save"/);
  // Langkah penjual & bayar.
  assert.match(output, /Terbuka setelah langkah sebelumnya selesai\./);
  assert.match(output, /data-bagdja-intent="order.draft.pay"[^>]*disabled=""|disabled=""[^>]*data-bagdja-intent="order.draft.pay"/);
  assert.match(output, /data-bagdja-intent="order.draft.cancel"/);
  // Menu Keranjang aktif (header & dock).
  assert.match(output, /aria-current="page"[^>]*>[^<]*<svg[\s\S]*?Keranjang|data-bagdja-nav="cart" aria-current="page"/);
});

test('draft order content announces the cart menu inside the shell', () => {
  const output = html({ ...fixture('draft-order'), contentOnly: true });
  assert.match(output, /data-bagdja-active-nav="[^"]*\bcart\b[^"]*"/);
  assert.doesNotMatch(output, /class="kumpul-header"/);
});
