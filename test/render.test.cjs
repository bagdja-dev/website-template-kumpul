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
  assert.match(clientBundle, /addEventListener\('input'/);
  assert.match(clientBundle, /data-category-filter/);
  assert.match(clientBundle, /const pageSize = 12/);
  assert.match(clientBundle, /data-page-previous/);
  assert.match(clientBundle, /data-page-next/);
  assert.match(clientBundle, /Menampilkan/);
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
