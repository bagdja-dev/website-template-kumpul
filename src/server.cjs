const React = require('react');

const h = React.createElement;

const defaultColors = {
  background: '#F0F7F8',
  surface: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  accent: '#006699',
  accentHover: '#00557A',
  border: '#B3D4DD',
  success: '#0E9F6E',
  warning: '#C27803',
};

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function slug(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isGatheringCatalogPage(sections) {
  const visibleSections = sections.filter((section) => section && section.type);
  return visibleSections.length === 1 && visibleSections[0].type === 'products_grid';
}

function pageSlugForSections(sections) {
  if (isGatheringCatalogPage(sections)) return 'gathering';
  if (sections.some((section) => section?.type === 'about' || section?.type === 'gallery')) return 'about';
  if (sections.some((section) => section?.type === 'service_process_section' || section?.type === 'faq_list')) {
    return 'how-it-works';
  }
  return '';
}

function formatGatheringDate(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function tenantPath(props, path) {
  const base = text(props.websiteSlug).replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}` || '/';
}

function themeColors(props) {
  const templateColors = props.templateTheme?.colors || {};
  const websiteColors = props.websiteTheme?.colors || {};
  const colors = {};

  for (const [key, fallback] of Object.entries(defaultColors)) {
    const candidate = websiteColors[key] ?? templateColors[key];
    colors[key] = typeof candidate === 'string' && /^#[\da-f]{3,8}$/i.test(candidate)
      ? candidate
      : fallback;
  }
  return colors;
}

function Icon({ name }) {
  const paths = {
    arrow: h('path', { d: 'M5 12h14m-6-6 6 6-6 6' }),
    calendar: h('path', { d: 'M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z' }),
    cart: h('path', { d: 'M3 4h2l2.2 11h10.9L21 8H6M9 19h.01M17 19h.01' }),
    chat: h('path', { d: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z' }),
    orders: h('path', { d: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' }),
    profile: h('path', { d: 'M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' }),
    receipt: h('path', { d: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6' }),
    search: h('path', { d: 'm20 20-4.3-4.3M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z' }),
    ticket: h('path', { d: 'M4 7V5h16v2a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4v2H4v-2a2 2 0 0 0 0-4v-2a2 2 0 0 0 0-4Z M12 7v2m0 2v2m0 2v2' }),
  };

  return h('svg', {
    'aria-hidden': 'true',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: 'kumpul-icon',
  }, paths[name] || paths.arrow);
}

function Section(props, type) {
  return list(props.sections).find((section) => section?.type === type) || null;
}

function gatheringProducts(props) {
  const section = Section(props, 'products_grid');
  const filterType = text(section?.content?.filter_type, 'gathering');
  return list(props.products).filter((product) => !product.type || product.type === filterType);
}

function SectionHeading({ eyebrow, title, description, titleTag = 'h2' }) {
  return h('div', { className: 'kumpul-section-heading' },
    eyebrow ? h('p', { className: 'kumpul-eyebrow' }, eyebrow) : null,
    title ? h(titleTag, { className: 'kumpul-section-title' }, title) : null,
    description ? h('p', { className: 'kumpul-section-description' }, description) : null,
  );
}

function Header(props) {
  const profile = props.profile || {};
  const auth = props.auth || {};
  const pages = list(props.pages).filter((page) => page.placement !== 'footer').slice(0, 5);
  const activePage = pages.find((page) => {
    const identity = `${page.slug} ${page.title}`.toLocaleLowerCase('id-ID');
    if (props.activePageSlug === 'gathering') return /gather|event|katalog/.test(identity);
    if (props.activePageSlug === 'about') return /about|tentang/.test(identity);
    if (props.activePageSlug === 'how-it-works') return /cara|how|flow/.test(identity);
    return false;
  });
  const accountLinks = [
    ['Keranjang', auth.cartHref, 'cart'],
    ['Tagihan', auth.tagihanHref, 'receipt'],
    ['Transaksi', auth.ordersHref, 'orders'],
    ['Kalender', auth.calendarHref, 'calendar'],
    ['Inbox', auth.chatHref, 'chat'],
    ['Profil', auth.profileHref, 'profile'],
  ].filter(([, href]) => typeof href === 'string' && href.length > 0);

  return h('header', { className: 'kumpul-header' },
    h('div', { className: 'kumpul-header-main' },
      h('a', { className: 'kumpul-brand', href: tenantPath(props, '/') },
        profile.logoUrl
          ? h('img', { className: 'kumpul-logo', src: profile.logoUrl, alt: text(profile.name, 'Logo') })
          : h('span', { className: 'kumpul-logo-mark', 'aria-hidden': 'true' }, text(profile.name, 'K').slice(0, 2).toLowerCase()),
        h('span', { className: 'kumpul-brand-copy' },
          h('strong', null, text(profile.name, 'Kumpul')),
          h('small', null, text(profile.tagline, 'Deep Teal • Family Trust')),
        ),
      ),
      h('nav', { className: 'kumpul-utilities', 'aria-label': 'Menu akun' },
        ...accountLinks.map(([label, href, icon]) =>
          h('a', { href, key: label, 'aria-label': label, title: label }, h(Icon, { name: icon }), h('span', null, label)),
        ),
        !auth.isLoggedIn && auth.loginHref
          ? h('a', { className: 'kumpul-login', href: auth.loginHref }, 'Masuk')
          : null,
      ),
    ),
    h('nav', { className: 'kumpul-page-nav', 'aria-label': 'Navigasi halaman' },
      ...pages.map((page) =>
        h('a', {
          href: tenantPath(props, page.isHome ? '/' : `/${encodeURIComponent(page.slug)}`),
          key: page.slug,
          'aria-current': activePage
            ? page.slug === activePage.slug ? 'page' : undefined
            : props.activePageSlug ? undefined : page.isHome ? 'page' : undefined,
        }, page.title),
      ),
    ),
  );
}

function Hero(props) {
  const section = props.section;
  const content = section?.content || {};
  const profile = props.profile || {};
  const products = gatheringProducts(props);
  const featured = products[0];
  const pages = list(props.pages);
  const gatheringPage = pages.find((page) => /gather|event|katalog/i.test(`${page.slug} ${page.title}`));
  const flowPage = pages.find((page) => /cara|how|flow/i.test(`${page.slug} ${page.title}`));
  const detailHref = featured?.slug
    ? tenantPath(props, `/products/${encodeURIComponent(featured.slug)}`)
    : tenantPath(props, gatheringPage ? `/${encodeURIComponent(gatheringPage.slug)}` : '/gathering');
  const flowHref = tenantPath(props, flowPage ? `/${encodeURIComponent(flowPage.slug)}` : '/cara-kerja');

  return h('section', { className: 'kumpul-hero' },
    h('div', { className: 'kumpul-hero-copy' },
      h('span', { className: 'kumpul-pill kumpul-community-pill' },
        h('span', { className: 'kumpul-status-dot' }),
        text(content.subtitle, 'Komunitas aktif • saatnya berkumpul'),
      ),
      h('h1', null, text(content.headline, 'Kumpul bareng jadi lebih mudah.')),
      h('p', { className: 'kumpul-hero-description' },
        text(content.lede, text(profile.tagline, 'Platform gathering untuk keluarga, workshop, dan komunitas. Dari perencanaan hingga hari acara, semua dalam satu alur.')),
      ),
      h('div', { className: 'kumpul-hero-actions' },
        h('a', { className: 'kumpul-button kumpul-button-primary', href: detailHref },
          'Lihat Gathering Terdekat', h(Icon, { name: 'arrow' }),
        ),
        h('a', { className: 'kumpul-button kumpul-button-secondary', href: flowHref },
          'Cara kerja 90 detik',
        ),
      ),
      h('div', { className: 'kumpul-stats' },
        ...list(content.stats).slice(0, 3).map((stat, index) => h('div', { className: 'kumpul-stat', key: stat.label || index },
          h('strong', null, text(stat.value)),
          h('span', null, text(stat.label)),
        )),
      ),
    ),
    h('div', { className: 'kumpul-feature-card' },
      h('div', { className: 'kumpul-feature-location' },
        h(Icon, { name: 'calendar' }),
        h('span', null, 'Gathering unggulan'),
      ),
      h('div', { className: 'kumpul-feature-art', 'aria-hidden': 'true' },
        h('span', null, 'K'),
        h('i', null),
        h('i', null),
      ),
      h('a', { className: 'kumpul-feature-note', href: detailHref },
        h('span', { className: 'kumpul-avatar' }, 'K'),
        h('span', null,
          h('strong', null, text(featured?.name, 'Temukan gathering untukmu')),
          h('small', null, text(featured?.category, 'Bersama keluarga dan komunitas')),
        ),
        h('span', { className: 'kumpul-check', 'aria-hidden': 'true' }, '✓'),
      ),
    ),
  );
}

function FeaturesSection(section) {
  const content = section?.content || {};
  const steps = list(content.features).slice(0, 6).map((feature, index) => [
    text(feature.icon, String(index + 1)),
    text(feature.title, `Tahap ${index + 1}`),
    text(feature.desc),
  ]);

  return h('section', { className: 'kumpul-section kumpul-flow', id: section?.id || 'cara-kerja' },
    h(SectionHeading, {
      eyebrow: text(content.eyebrow, 'Alur Kumpul'),
      title: text(content.title, 'Dari ide sampai absensi, rapi.'),
      description: text(content.subtitle, 'Perjalanan acara yang jelas, dari rencana pertama sampai peserta pulang dengan cerita.'),
    }),
    h('ol', { className: 'kumpul-flow-list' },
      ...steps.map(([number, title, description], index) =>
        h('li', { className: 'kumpul-flow-step', key: number },
          h('span', { className: 'kumpul-flow-number' }, number || String(index + 1)),
          h('strong', null, title),
          h('span', null, description),
        ),
      ),
      steps.length === 0
        ? h('li', { className: 'kumpul-flow-empty' }, 'Alur gathering akan ditampilkan di sini.')
        : null,
    ),
  );
}

function AboutSection(section) {
  const content = section?.content || {};
  const title = text(content.title, 'Kumpul bukan sekadar datang, tapi bertumbuh bareng.');
  const body = text(content.body);
  const image = text(content.image_url);

  if (!body && !image) return null;

  return h('section', { className: 'kumpul-about-section' },
    image
      ? h('div', { className: 'kumpul-about-image' },
        h('img', { src: image, alt: '', loading: 'lazy' }),
      )
      : h('div', { className: 'kumpul-about-art', 'aria-hidden': 'true' },
        h('span', null, '🌿'),
        h('span', null, '🏕️'),
      ),
    h('div', { className: 'kumpul-about-copy' },
      h('p', { className: 'kumpul-eyebrow' }, text(content.eyebrow, 'Tentang Kumpul')),
      h('h1', null, title),
      body ? h('p', { className: 'kumpul-about-body' }, body) : null,
    ),
  );
}

function GallerySection(section) {
  const content = section?.content || {};
  const images = list(content.images).filter((image) => image && typeof image === 'object');
  if (!images.length) return null;

  return h('section', { className: 'kumpul-section kumpul-gallery', id: section.id || 'galeri' },
    h(SectionHeading, {
      eyebrow: text(content.eyebrow, 'Momen kebersamaan'),
      title: text(content.title, 'Galeri Kumpul'),
    }),
    h('div', { className: 'kumpul-gallery-grid' },
      ...images.map((image, index) => h('figure', { className: `kumpul-gallery-item kumpul-gallery-${index % 4}`, key: image.url || image.caption || index },
        image.url
          ? h('img', { src: image.url, alt: text(image.alt, text(image.caption, 'Momen Kumpul')), loading: 'lazy' })
          : h('span', { 'aria-hidden': 'true' }, ['⛺', '🎪', '🎨', '🏃', '📚', '🌳'][index % 6]),
        image.caption ? h('figcaption', null, image.caption) : null,
      )),
    ),
  );
}

function ProcessSection(section) {
  const content = section?.content || {};
  const steps = list(content.flow_steps)
    .filter((step) => step && typeof step === 'object')
    .sort((left, right) => (Number(left.sequence) || 0) - (Number(right.sequence) || 0));

  return h('section', { className: 'kumpul-section kumpul-process', id: section.id || 'cara-kerja' },
    h(SectionHeading, {
      eyebrow: text(content.eyebrow, 'Cara Kerja'),
      title: text(content.title, '5 langkah, gathering jalan. Tanpa drama WA.'),
      description: text(content.subtitle, 'Alur yang jelas membantu panitia dan peserta menikmati setiap momen.'),
      titleTag: 'h1',
    }),
    steps.length
      ? h('ol', { className: 'kumpul-process-list' },
        ...steps.map((step, index) => h('li', { className: 'kumpul-process-step', key: step.id || step.sequence || index },
          h('span', { className: 'kumpul-flow-number' }, String(step.sequence || index + 1)),
          h('div', null,
            h('h2', null, text(step.status_name, `Tahap ${index + 1}`)),
            step.description ? h('p', null, step.description) : null,
            typeof step.process_day === 'number' && Number.isFinite(step.process_day)
              ? h('small', null, `± ${step.process_day} hari`)
              : null,
          ),
        )),
      )
      : h('div', { className: 'kumpul-empty-state' },
        h('h3', null, 'Alur gathering belum tersedia'),
        h('p', null, 'Langkah acara akan ditampilkan setelah alur dipilih di pengaturan halaman.'),
      ),
  );
}

function FaqSection({ props, section }) {
  const content = section?.content || {};
  const category = text(content.filter_category).toLocaleLowerCase('id-ID');
  const faqs = list(props.faqs).filter((faq) => !category || text(faq.category).toLocaleLowerCase('id-ID') === category);
  if (!faqs.length) return null;

  return h('section', { className: 'kumpul-section kumpul-faq', id: section.id || 'faq' },
    h(SectionHeading, {
      eyebrow: text(content.eyebrow, 'Pertanyaan umum'),
      title: text(content.title, 'FAQ Gathering'),
    }),
    h('div', { className: 'kumpul-faq-list' },
      ...faqs.map((faq, index) => h('details', { className: 'kumpul-faq-item', key: faq.id || faq.question || index },
        h('summary', null, faq.question),
        h('p', null, faq.answer),
      )),
    ),
  );
}

function GatheringCard({ product, index, props, catalogPage = false }) {
  const href = tenantPath(props, `/products/${encodeURIComponent(text(product.slug, product.id || ''))}`);
  const image = text(product.image, text(product.images?.[0]?.url));
  const gathering = product.gatheringMeta || {};
  const eventDate = formatGatheringDate(gathering.eventDate);
  const eventTime = text(gathering.eventTime);
  return h('article', {
    className: 'kumpul-gathering-card',
    key: product.id || product.slug || index,
    ...(catalogPage ? {
      'data-gathering-name': `${product.name || ''} ${product.description || ''}`.toLocaleLowerCase('id-ID'),
      'data-gathering-category': slug(product.category),
    } : {}),
  },
    h('a', { className: `kumpul-gathering-art kumpul-art-${index % 4}`, href, 'aria-label': `Lihat ${text(product.name, 'gathering')}` },
      image
        ? h('img', { src: image, alt: text(product.name, 'Foto gathering'), loading: 'lazy' })
        : h('span', { 'aria-hidden': 'true' }, catalogPage ? h(Icon, { name: 'ticket' }) : ['⛺', '🎨', '🏃', '📚'][index % 4]),
    ),
    h('div', { className: 'kumpul-card-content' },
      h('p', { className: 'kumpul-card-meta' },
        text(product.category, text(product.type, 'Gathering')),
        catalogPage && eventDate ? h('span', null, `${eventDate}${eventTime ? ` · ${eventTime}` : ''}`) : null,
      ),
      h('h3', null, h('a', { href }, text(product.name, 'Gathering komunitas'))),
      catalogPage && gathering.location
        ? h('p', { className: 'kumpul-card-location' }, h(Icon, { name: 'calendar' }), gathering.location)
        : null,
      product.description ? h('p', { className: 'kumpul-card-description' }, product.description) : null,
      h('div', { className: 'kumpul-card-bottom' },
        h('strong', null, text(product.priceLabel, 'Lihat detail')),
        catalogPage && gathering.maxAttendees
          ? h('span', null, `Maks. ${gathering.maxAttendees} peserta`)
          : null,
        h('a', { href }, 'Lihat detail'),
      ),
    ),
  );
}

function GatheringCategories({ categories, products }) {
  const counts = new Map();
  for (const product of products) {
    const key = slug(product.category);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }

  const availableCategories = categories.filter((category) => counts.has(slug(category.label))).slice(0, 8);

  return h('div', { className: 'kumpul-category-filters', 'aria-label': 'Filter kategori gathering' },
    h('button', { type: 'button', className: 'kumpul-category-filter', 'data-category-filter': 'all', 'aria-pressed': 'true' }, 'Semua'),
    ...availableCategories.map((category) => {
      const key = slug(category.label);
      return h('button', {
        type: 'button',
        className: 'kumpul-category-filter',
        'data-category-filter': key,
        'aria-pressed': 'false',
        key: category.id || key,
      },
      h('span', { className: 'kumpul-category-icon', 'aria-hidden': 'true' }, category.label.slice(0, 1)),
      h('span', null,
        h('strong', null, category.label),
        h('small', null, text(category.description, `${counts.get(key)} gathering`)),
      ));
    }),
  );
}

function GatheringsSection({ props, section, catalogPage = false }) {
  const content = section?.content || {};
  const products = gatheringProducts(props);
  const categories = list(props.categories);
  const gatheringPage = list(props.pages).find((page) => /gather|event|katalog/i.test(`${page.slug} ${page.title}`));
  const catalogHref = tenantPath(props, gatheringPage ? `/${encodeURIComponent(gatheringPage.slug)}` : '/gathering');

  return h('section', {
    className: 'kumpul-section kumpul-gatherings',
    id: section?.id || 'gathering',
    ...(catalogPage ? { 'data-gathering-catalog': '' } : {}),
  },
    catalogPage
      ? h('div', { className: 'kumpul-catalog-heading' },
        h(SectionHeading, {
          eyebrow: text(content.eyebrow, 'Temukan acara berikutnya'),
          title: text(content.title, 'Katalog Gathering'),
          description: text(content.subtitle, 'Pilih pengalaman berikutnya bersama keluarga dan komunitas.'),
        }),
        h('label', { className: 'kumpul-catalog-search' },
          h(Icon, { name: 'search' }),
          h('input', {
            type: 'search',
            placeholder: 'Cari gathering...',
            'aria-label': 'Cari gathering',
            'data-gathering-search': '',
          }),
        ),
      )
      : h('div', { className: 'kumpul-section-topline' },
        h(SectionHeading, {
          eyebrow: text(content.eyebrow, 'Cari kegiatan berikutnya'),
          title: text(content.title, 'Gathering Terdekat'),
          description: text(content.subtitle),
        }),
        h('a', { className: 'kumpul-text-link', href: catalogHref },
          'Lihat semua', h(Icon, { name: 'arrow' }),
        ),
      ),
    catalogPage ? h(GatheringCategories, { categories, products }) : null,
    catalogPage
      ? h('p', { className: 'kumpul-catalog-results', 'aria-live': 'polite', hidden: true, 'data-gathering-results': '' })
      : null,
    products.length
      ? h('div', {
        className: `kumpul-gathering-grid${catalogPage ? ' kumpul-catalog-grid' : ''}`,
      },
        ...products.map((product, index) => h(GatheringCard, {
          product,
          index,
          props,
          catalogPage,
          key: product.id || product.slug || index,
        })),
      )
      : h('div', { className: 'kumpul-empty-state' },
        h('span', { className: 'kumpul-empty-icon', 'aria-hidden': 'true' }, '✳'),
        h('h3', null, text(content.empty_title, 'Gathering baru sedang disiapkan')),
        h('p', null, text(content.empty_description, 'Belum ada acara untuk ditampilkan. Silakan kembali lagi segera.')),
      ),
    catalogPage && products.length
      ? h('p', { className: 'kumpul-no-results', hidden: true, 'data-gathering-no-results': '' }, 'Tidak ada gathering yang cocok. Coba ubah kata kunci atau kategori.')
      : null,
    catalogPage && products.length
      ? h('nav', { className: 'kumpul-pagination', 'aria-label': 'Halaman katalog gathering', hidden: true, 'data-gathering-pagination': '' },
        h('button', { type: 'button', 'data-page-previous': '', disabled: true }, 'Sebelumnya'),
        h('span', { 'aria-live': 'polite', 'data-page-status': '' }),
        h('button', { type: 'button', 'data-page-next': '' }, 'Berikutnya'),
      )
      : null,
  );
}

function TestimonialsSection(section) {
  const content = section?.content || {};
  const items = list(content.items).slice(0, 3);

  if (!items.length) return null;

  return h('section', { className: 'kumpul-section kumpul-testimonials', id: section?.id || 'cerita-komunitas' },
    h(SectionHeading, {
      eyebrow: text(content.eyebrow, 'Cerita komunitas'),
      title: text(content.title, 'Komunitas yang balik lagi.'),
      description: text(content.subtitle, 'Pengalaman hangat dari orang-orang yang sudah berkumpul bersama.'),
    }),
    h('div', { className: 'kumpul-testimonial-grid' },
      ...items.map((item, index) => h('figure', { className: 'kumpul-testimonial', key: item.name || index },
        h('div', { className: 'kumpul-rating', 'aria-label': 'Rating bintang 5' }, '★★★★★'),
        h('blockquote', null, `“${text(item.quote)}”`),
        h('figcaption', null,
          h('span', { className: 'kumpul-avatar' }, text(item.location, 'K').slice(0, 1)),
          h('span', null,
            h('strong', null, text(item.location, 'Komunitas Kumpul')),
            item.context ? h('small', null, item.context) : null,
          ),
        ),
      )),
    ),
  );
}

function LocationsSection({ props, section }) {
  const content = section?.content || {};
  const locations = list(props.locations).slice(0, 4);
  if (!locations.length) return null;

  return h('section', { className: 'kumpul-section kumpul-locations', id: section?.id || 'lokasi' },
    h(SectionHeading, {
      eyebrow: text(content.eyebrow, 'Temukan suasana baru'),
      title: text(content.title, 'Lokasi Kumpul'),
      description: text(content.subtitle, 'Tempat-tempat pilihan untuk bertemu dan berbagi cerita.'),
    }),
    h('div', { className: 'kumpul-location-list' },
      ...locations.map((location, index) => h('article', { className: 'kumpul-location', key: location.id || location.name || index },
        h('span', { className: 'kumpul-location-icon', 'aria-hidden': 'true' }, text(location.emoji, ['🌳', '⛰', '🏔', '🏘'][index % 4])),
        h('span', null, h('strong', null, text(location.name, 'Lokasi gathering')), h('small', null, text(location.city || location.address_line || location.address))),
      )),
    ),
  );
}

function CallToAction({ props, section }) {
  const content = section?.content || {};
  const action = text(content.button_action, 'whatsapp');
  let href = tenantPath(props, '/gathering');

  if (action === 'whatsapp') {
    const phone = text(content.button_whatsapp, props.profile?.whatsapp).replace(/\D/g, '');
    if (phone) {
      const message = text(content.button_message);
      href = `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
    }
  } else if (action === 'phone') {
    const phone = text(content.button_phone, props.profile?.phone).replace(/[^\d+(). -]/g, '');
    if (phone) href = `tel:${phone}`;
  } else if (action === 'email') {
    const email = text(content.button_email);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) href = `mailto:${email}`;
  } else if (action === 'link') {
    const target = text(content.button_url);
    if (target.startsWith('/') && !target.startsWith('//')) {
      href = tenantPath(props, target);
    } else {
      try {
        const url = new URL(target);
        if (url.protocol === 'https:' || url.protocol === 'http:') href = url.href;
      } catch {
        href = tenantPath(props, '/gathering');
      }
    }
  }

  return h('section', { className: 'kumpul-cta' },
    h('div', null,
      h('p', { className: 'kumpul-eyebrow' }, text(content.eyebrow, 'Mulai cerita baru')),
      h('h2', null, text(content.title, 'Siap bikin gathering pertamamu?')),
      h('p', null, text(content.subtitle, 'Rencanakan acara, undang komunitas, dan nikmati momen bersama.')),
    ),
    h('div', { className: 'kumpul-cta-actions' },
      h('a', { className: 'kumpul-button kumpul-button-light', href },
        text(content.button_text, 'Lihat Gathering'), h(Icon, { name: 'arrow' }),
      ),
    ),
  );
}

function MobileDock(props) {
  const auth = props.auth || {};
  const links = [
    ['Keranjang', auth.cartHref, 'cart'],
    ['Tagihan', auth.tagihanHref, 'receipt'],
    ['Transaksi', auth.ordersHref, 'orders'],
    ['Kalender', auth.calendarHref, 'calendar'],
    ['Inbox', auth.chatHref, 'chat'],
    ['Profil', auth.profileHref, 'profile'],
  ].filter(([, href]) => typeof href === 'string' && href.length > 0);

  if (!links.length) return null;
  return h('nav', { className: 'kumpul-mobile-dock', 'aria-label': 'Menu akun' },
    ...links.map(([label, href, icon]) => h('a', { href, key: label, 'aria-label': label },
      h(Icon, { name: icon }), h('span', null, label),
    )),
  );
}

function styles(colors) {
  return `
    .kumpul-template{--kt-bg:${colors.background};--kt-surface:${colors.surface};--kt-text:${colors.text};--kt-muted:${colors.textMuted};--kt-accent:${colors.accent};--kt-hover:${colors.accentHover};--kt-border:${colors.border};--kt-success:${colors.success};--kt-warning:${colors.warning};min-height:100vh;background:var(--kt-bg);color:var(--kt-text);font:400 15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .kumpul-template *{box-sizing:border-box}.kumpul-template [hidden]{display:none!important}.kumpul-template a{color:inherit;text-decoration:none}.kumpul-template a:focus-visible{outline:3px solid var(--kt-success);outline-offset:3px}
    .kumpul-icon{width:20px;height:20px;flex:none}.kumpul-header{position:relative;z-index:2;background:var(--kt-surface);border-bottom:1px solid var(--kt-border)}
    .kumpul-header-main{min-height:72px;max-width:1280px;margin:auto;padding:12px 28px;display:flex;align-items:center;justify-content:space-between;gap:24px}
    .kumpul-brand{display:flex;align-items:center;gap:12px;min-width:0}.kumpul-logo,.kumpul-logo-mark{width:44px;height:44px;flex:none;border-radius:15px}.kumpul-logo{object-fit:cover}.kumpul-logo-mark{display:grid;place-items:center;background:var(--kt-accent);color:#fff;font-size:17px;font-weight:800;letter-spacing:-.04em}
    .kumpul-brand-copy{display:grid;line-height:1.2}.kumpul-brand-copy strong{font-size:17px;letter-spacing:-.02em}.kumpul-brand-copy small{margin-top:5px;color:var(--kt-muted);font-size:10px;font-weight:750;letter-spacing:.13em;text-transform:uppercase}
    .kumpul-utilities{display:flex;align-items:center;justify-content:flex-end;gap:7px}.kumpul-utilities>a{display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:999px;color:var(--kt-muted);font-size:12px;font-weight:650;transition:background .16s,color .16s}.kumpul-utilities>a:hover{background:var(--kt-bg);color:var(--kt-accent)}.kumpul-utilities .kumpul-login{background:var(--kt-accent);color:#fff}
    .kumpul-page-nav{min-height:52px;padding:7px 24px;display:flex;align-items:center;justify-content:center;gap:8px;border-top:1px solid #eef2f4}.kumpul-page-nav a{padding:8px 16px;border:1px solid transparent;border-radius:999px;color:var(--kt-muted);font-size:13px;font-weight:650;white-space:nowrap}.kumpul-page-nav a:hover{border-color:var(--kt-border);color:var(--kt-accent)}.kumpul-page-nav a[aria-current=page]{background:var(--kt-text);color:#fff}
    .kumpul-main{max-width:1280px;margin:0 auto;padding:32px 28px 80px}.kumpul-hero{display:grid;grid-template-columns:1.08fr .92fr;min-height:430px;overflow:hidden;border:1px solid var(--kt-border);border-radius:28px;background:var(--kt-surface);box-shadow:0 12px 40px #0f172a0b}
    .kumpul-hero-copy{align-self:center;padding:clamp(28px,5vw,64px)}.kumpul-pill{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid var(--kt-border);border-radius:999px;background:var(--kt-bg);color:var(--kt-accent);font-size:11px;font-weight:750;letter-spacing:.045em}
    .kumpul-community-pill{margin-bottom:20px}.kumpul-status-dot{width:8px;height:8px;border-radius:50%;background:var(--kt-success);box-shadow:0 0 0 4px #0e9f6e1d}.kumpul-hero h1{max-width:620px;margin:0;font-size:clamp(42px,6.1vw,76px);line-height:.98;font-weight:850;letter-spacing:-.065em}.kumpul-hero-description{max-width:540px;margin:20px 0 0;color:var(--kt-muted);font-size:15px;line-height:1.75}
    .kumpul-hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.kumpul-button{min-height:44px;padding:11px 17px;display:inline-flex;align-items:center;justify-content:center;gap:10px;border:1px solid transparent;border-radius:999px;font-size:13px;font-weight:750;transition:background .16s,transform .16s}.kumpul-button:hover{transform:translateY(-1px)}.kumpul-button .kumpul-icon{width:17px;height:17px}.kumpul-button-primary{background:var(--kt-accent);color:#fff!important}.kumpul-button-primary:hover{background:var(--kt-hover)}.kumpul-button-secondary{border-color:var(--kt-border);background:var(--kt-bg);color:var(--kt-text)}
    .kumpul-stats{display:flex;gap:clamp(20px,4vw,48px);margin-top:28px}.kumpul-stat{display:grid;gap:2px}.kumpul-stat strong{font-size:22px;line-height:1.2;letter-spacing:-.04em}.kumpul-stat span{color:var(--kt-muted);font-size:11px}
    .kumpul-feature-card{position:relative;min-height:360px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;background:radial-gradient(ellipse at 68% 30%,#58a3b8 0,#006699 53%,#00557a 100%);color:#fff}
    .kumpul-about-section{max-width:1180px;min-height:390px;margin:12px auto 0;padding:clamp(26px,5vw,58px);display:grid;grid-template-columns:1fr .85fr;align-items:center;gap:clamp(28px,6vw,72px);overflow:hidden;border:1px solid var(--kt-border);border-radius:26px;background:var(--kt-surface)}.kumpul-about-copy h1{max-width:650px;margin:0;font-size:clamp(34px,5vw,60px);line-height:1.03;font-weight:850;letter-spacing:-.06em}.kumpul-about-body{max-width:620px;margin:20px 0 0;color:var(--kt-muted);font-size:15px;line-height:1.8;white-space:pre-line}.kumpul-about-art,.kumpul-about-image{position:relative;min-height:270px;display:grid;place-items:center;overflow:hidden;border-radius:22px;background:radial-gradient(ellipse at 60% 40%,#58a3b8 0,#006699 58%,#00557a 100%)}.kumpul-about-art:before,.kumpul-about-art:after{position:absolute;width:270px;height:270px;border:1px solid #ffffff50;border-radius:50%;content:""}.kumpul-about-art:after{width:360px;height:360px}.kumpul-about-art span{position:absolute;z-index:1;display:grid;place-items:center;width:104px;height:104px;border:1px solid #ffffff70;border-radius:30px;background:#ffffff25;font-size:55px;box-shadow:0 16px 36px #002b443d}.kumpul-about-art span:first-child{transform:translate(-42px,-18px) rotate(-9deg)}.kumpul-about-art span:last-child{transform:translate(48px,40px) rotate(9deg)}.kumpul-about-image img{position:absolute;width:100%;height:100%;inset:0;object-fit:cover}
    .kumpul-gallery-grid{margin-top:24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:180px;gap:14px}.kumpul-gallery-item{position:relative;margin:0;display:grid;place-items:center;overflow:hidden;border:1px solid var(--kt-border);border-radius:18px;background:linear-gradient(135deg,#d9eff0,#91c4c9)}.kumpul-gallery-item:nth-child(3n+2){grid-row:span 2}.kumpul-gallery-item img{position:absolute;width:100%;height:100%;inset:0;object-fit:cover;transition:transform .25s}.kumpul-gallery-item:hover img{transform:scale(1.04)}.kumpul-gallery-item>span{font-size:48px;filter:drop-shadow(0 10px 12px #163c3b25)}.kumpul-gallery-item figcaption{position:absolute;right:10px;bottom:10px;left:10px;padding:8px 10px;border:1px solid #ffffff80;border-radius:10px;background:#fffffff0;color:var(--kt-text);font-size:11px;font-weight:700}
    .kumpul-process-list{margin:28px 0 0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));list-style:none;border:1px solid var(--kt-border);border-radius:20px;background:var(--kt-surface)}.kumpul-process-step{min-width:0;padding:22px 18px;display:flex;flex-direction:column;align-items:flex-start;gap:10px}.kumpul-process-step+.kumpul-process-step{border-left:1px solid var(--kt-border)}.kumpul-process-step h2{margin:0;font-size:14px}.kumpul-process-step p{margin:0;color:var(--kt-muted);font-size:11px;line-height:1.6}.kumpul-process-step small{margin-top:auto;color:var(--kt-accent);font-size:10px;font-weight:750}
    .kumpul-faq-list{margin-top:24px;display:grid;gap:10px}.kumpul-faq-item{padding:17px 19px;border:1px solid var(--kt-border);border-radius:15px;background:var(--kt-surface)}.kumpul-faq-item summary{font-size:13px;font-weight:750;cursor:pointer;list-style:none}.kumpul-faq-item summary::-webkit-details-marker{display:none}.kumpul-faq-item summary:after{float:right;color:var(--kt-accent);content:"+";font-size:18px;line-height:1}.kumpul-faq-item[open] summary:after{content:"−"}.kumpul-faq-item p{margin:12px 0 0;color:var(--kt-muted);font-size:12px;line-height:1.7;white-space:pre-line}
    .kumpul-feature-location{position:relative;z-index:1;align-self:flex-start;display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #ffffff44;border-radius:999px;background:#ffffffec;color:#28576a;font-size:11px;font-weight:700}.kumpul-feature-location .kumpul-icon{width:16px;height:16px}
    .kumpul-feature-art{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden}.kumpul-feature-art:before,.kumpul-feature-art:after{position:absolute;content:"";border:1px solid #ffffff2c;border-radius:50%;width:310px;height:310px}.kumpul-feature-art:after{width:430px;height:430px}.kumpul-feature-art>span{position:relative;z-index:1;width:112px;height:112px;display:grid;place-items:center;border:1px solid #ffffff66;border-radius:34px;background:#ffffff20;font-size:56px;font-weight:800;letter-spacing:-.1em;transform:rotate(-8deg);box-shadow:0 18px 48px #002b443d}.kumpul-feature-art i{position:absolute;width:8px;height:8px;border-radius:50%;background:#c9edf2;box-shadow:0 0 18px #fff}.kumpul-feature-art i:first-of-type{top:29%;right:22%}.kumpul-feature-art i:last-of-type{bottom:27%;left:19%;width:6px;height:6px}
    .kumpul-feature-note{position:relative;z-index:1;display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid #ffffffaa;border-radius:17px;background:#fff;color:var(--kt-text);box-shadow:0 10px 24px #002b4433}.kumpul-feature-note>span:nth-child(2){min-width:0;display:grid}.kumpul-feature-note strong{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.kumpul-feature-note small{margin-top:3px;color:var(--kt-muted);font-size:10px}.kumpul-avatar{width:36px;height:36px;flex:none;display:grid;place-items:center;border:1px solid var(--kt-border);border-radius:50%;background:var(--kt-bg);color:var(--kt-accent);font-size:12px;font-weight:800}.kumpul-check{width:25px;height:25px;flex:none;margin-left:auto;display:grid;place-items:center;border-radius:50%;background:var(--kt-success);color:#fff;font-weight:800}
    .kumpul-section{margin-top:76px}.kumpul-section-heading{max-width:680px}.kumpul-eyebrow{margin:0 0 10px;color:var(--kt-accent);font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}    .kumpul-section-heading .kumpul-section-title,.kumpul-cta h2{margin:0;font-size:clamp(26px,3.8vw,42px);line-height:1.08;font-weight:800;letter-spacing:-.05em}.kumpul-section-description{margin:12px 0 0;color:var(--kt-muted);font-size:13px}
    .kumpul-flow-list{margin:28px 0 0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));list-style:none;border:1px solid var(--kt-border);border-radius:20px;background:var(--kt-surface)}.kumpul-flow-step{position:relative;min-height:150px;padding:22px 18px;display:flex;flex-direction:column;align-items:flex-start;gap:8px}.kumpul-flow-step+.kumpul-flow-step{border-left:1px solid var(--kt-border)}.kumpul-flow-number{width:31px;height:31px;display:grid;place-items:center;border-radius:11px;background:var(--kt-bg);color:var(--kt-accent);font-size:12px;font-weight:800}.kumpul-flow-step strong{margin-top:4px;font-size:13px}.kumpul-flow-step>span:last-child{color:var(--kt-muted);font-size:11px}
    .kumpul-section-topline{display:flex;align-items:flex-end;justify-content:space-between;gap:18px}.kumpul-text-link{flex:none;display:inline-flex;align-items:center;gap:8px;color:var(--kt-accent);font-size:12px;font-weight:750}.kumpul-text-link .kumpul-icon{width:16px;height:16px}.kumpul-gathering-grid{margin-top:25px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
    .kumpul-catalog-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:28px}.kumpul-catalog-search{width:min(100%,360px);min-height:48px;padding:0 15px;display:flex;align-items:center;gap:10px;border:1px solid var(--kt-border);border-radius:14px;background:var(--kt-surface);color:var(--kt-muted)}.kumpul-catalog-search .kumpul-icon{width:18px;height:18px}.kumpul-catalog-search input{width:100%;border:0;outline:0;background:transparent;color:var(--kt-text);font:inherit;font-size:13px}.kumpul-catalog-search input::placeholder{color:var(--kt-muted)}        .kumpul-category-filters{margin-top:24px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.kumpul-category-filter{min-width:0;padding:13px;display:flex;align-items:center;gap:11px;border:1px solid var(--kt-border);border-radius:16px;background:var(--kt-surface);color:var(--kt-text);text-align:left;cursor:pointer}.kumpul-category-filter[aria-pressed=true]{border-color:var(--kt-accent);background:#e6f4f6}.kumpul-category-icon{width:39px;height:39px;flex:none;display:grid;place-items:center;border-radius:12px;background:var(--kt-bg);color:var(--kt-accent);font-size:15px;font-weight:800}.kumpul-category-filter>span:last-child{min-width:0;display:grid}.kumpul-category-filter strong{font-size:12px}.kumpul-category-filter small{overflow:hidden;color:var(--kt-muted);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.kumpul-catalog-results{margin:20px 0 -12px;color:var(--kt-muted);font-size:12px}.kumpul-no-results{margin:20px 0;padding:28px;border:1px dashed var(--kt-border);border-radius:16px;background:var(--kt-surface);color:var(--kt-muted);text-align:center}.kumpul-pagination{margin-top:26px;display:flex;align-items:center;justify-content:center;gap:16px}.kumpul-pagination button{min-height:40px;padding:8px 14px;border:1px solid var(--kt-border);border-radius:999px;background:var(--kt-surface);color:var(--kt-accent);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.kumpul-pagination button:disabled{opacity:.45;cursor:not-allowed}.kumpul-pagination span{min-width:110px;color:var(--kt-muted);font-size:11px;text-align:center}.kumpul-catalog-grid{margin-top:20px}.kumpul-card-location{margin:8px 0;color:var(--kt-muted);display:flex;align-items:center;gap:6px;font-size:10px}.kumpul-card-location .kumpul-icon{width:14px;height:14px}.kumpul-card-bottom span{color:var(--kt-muted);font-size:10px}
    .kumpul-gathering-card{overflow:hidden;border:1px solid var(--kt-border);border-radius:19px;background:var(--kt-surface);transition:transform .18s,box-shadow .18s}.kumpul-gathering-card:hover{transform:translateY(-3px);box-shadow:0 14px 28px #0f172a12}    .kumpul-gathering-art{position:relative;min-height:160px;display:grid;place-items:center;overflow:hidden;background:linear-gradient(135deg,#d9eff0,#91c4c9)}.kumpul-gathering-art>span:first-child{font-size:52px;filter:drop-shadow(0 10px 12px #163c3b25)}.kumpul-gathering-art>img{width:100%;height:100%;position:absolute;inset:0;object-fit:cover}.kumpul-art-1{background:linear-gradient(135deg,#eee7db,#d4bd9f)}.kumpul-art-2{background:linear-gradient(135deg,#d9e8d9,#9dbba0)}.kumpul-art-3{background:linear-gradient(135deg,#e1e8ed,#b1c8d6)}
    .kumpul-card-content{padding:16px}.kumpul-card-meta{display:flex;justify-content:space-between;gap:10px;color:var(--kt-muted);font-size:10px}.kumpul-card-content h3{margin:10px 0 8px;font-size:16px;line-height:1.3;letter-spacing:-.025em}.kumpul-card-content h3 a:hover{color:var(--kt-accent)}.kumpul-card-description{margin:0;color:var(--kt-muted);font-size:11px;line-height:1.55}.kumpul-card-bottom{margin-top:14px;padding-top:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #edf1f3}.kumpul-card-bottom strong{font-size:12px}.kumpul-card-bottom a{color:var(--kt-accent);font-size:11px;font-weight:750}
    .kumpul-empty-state{margin-top:24px;padding:44px 20px;text-align:center;border:1px dashed var(--kt-border);border-radius:20px;background:#ffffff80}.kumpul-empty-icon{width:42px;height:42px;margin:0 auto 12px;display:grid;place-items:center;border-radius:14px;background:#e6f4f6;color:var(--kt-accent);font-size:22px}.kumpul-empty-state h3{margin:0;font-size:17px}.kumpul-empty-state p{margin:8px auto 0;max-width:420px;color:var(--kt-muted);font-size:12px}
    .kumpul-testimonial-grid{margin-top:24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.kumpul-testimonial{margin:0;padding:21px;border:1px solid var(--kt-border);border-radius:18px;background:var(--kt-surface)}.kumpul-rating{color:var(--kt-warning);font-size:13px;letter-spacing:.12em}.kumpul-testimonial blockquote{margin:13px 0 18px;font-size:13px;line-height:1.65}.kumpul-testimonial figcaption{display:flex;align-items:center;gap:10px}.kumpul-testimonial figcaption>span:last-child{display:grid}.kumpul-testimonial figcaption strong{font-size:11px}.kumpul-testimonial figcaption small{color:var(--kt-muted);font-size:10px}
    .kumpul-location-list{margin-top:22px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.kumpul-location{min-width:0;padding:14px;display:flex;align-items:center;gap:10px;border:1px solid var(--kt-border);border-radius:15px;background:var(--kt-surface)}.kumpul-location-icon{font-size:21px}.kumpul-location>span:nth-child(2){min-width:0;display:grid}.kumpul-location strong{overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.kumpul-location small{overflow:hidden;color:var(--kt-muted);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.kumpul-location-count{margin-left:auto;color:var(--kt-accent);font-size:9px;font-weight:750;white-space:nowrap}
    .kumpul-cta{margin-top:76px;padding:34px 38px;display:flex;align-items:center;justify-content:space-between;gap:24px;border-radius:23px;background:var(--kt-accent);color:#fff}.kumpul-cta .kumpul-eyebrow{color:#c8eaf1}.kumpul-cta h2{font-size:clamp(24px,3.3vw,36px)}.kumpul-cta>div:first-child>p:last-child{margin:10px 0 0;color:#d9edf2;font-size:12px}.kumpul-cta-actions{display:flex;flex-wrap:wrap;gap:9px}.kumpul-button-light{background:#fff;color:var(--kt-accent)!important}.kumpul-button-outline{border-color:#ffffff75;color:#fff!important}
    .kumpul-footer{padding:26px 28px;display:flex;justify-content:space-between;gap:14px;border-top:1px solid var(--kt-border);color:var(--kt-muted);font-size:11px}.kumpul-footer strong{color:var(--kt-text)}.kumpul-mobile-dock{display:none}
    @media(max-width:900px){.kumpul-header-main{padding:12px 20px}.kumpul-utilities>a span{display:none}.kumpul-utilities>a{padding:9px}.kumpul-main{padding:24px 20px 60px}.kumpul-hero{grid-template-columns:1fr}.kumpul-hero-copy{padding:38px}.kumpul-feature-card{min-height:310px}.kumpul-about-section{grid-template-columns:1fr .8fr;gap:24px}.kumpul-about-art,.kumpul-about-image{min-height:230px}.kumpul-process-list{grid-template-columns:repeat(2,minmax(0,1fr))}.kumpul-process-step+.kumpul-process-step{border-left:0}.kumpul-process-step:nth-child(even){border-left:1px solid var(--kt-border)}.kumpul-process-step:nth-child(n+3){border-top:1px solid var(--kt-border)}.kumpul-gathering-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.kumpul-location-list{grid-template-columns:repeat(2,minmax(0,1fr))}.kumpul-category-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.kumpul-cta{align-items:flex-start;flex-direction:column}}
    @media(max-width:620px){.kumpul-header-main{min-height:64px;padding:9px 16px}.kumpul-logo,.kumpul-logo-mark{width:40px;height:40px;border-radius:13px}.kumpul-brand-copy strong{font-size:15px}.kumpul-brand-copy small{font-size:8px}.kumpul-utilities{gap:1px}.kumpul-utilities>a{padding:8px}.kumpul-utilities .kumpul-icon{width:18px;height:18px}.kumpul-page-nav{min-height:47px;justify-content:flex-start;overflow-x:auto;padding:5px 12px}.kumpul-page-nav a{padding:7px 12px;font-size:11px}.kumpul-main{padding:16px 14px 98px}.kumpul-hero{border-radius:21px}.kumpul-hero-copy{padding:27px 22px}.kumpul-community-pill{margin-bottom:17px;font-size:9px}.kumpul-hero h1{font-size:clamp(39px,12vw,58px)}.kumpul-hero-description{margin-top:15px;font-size:13px}.kumpul-hero-actions{gap:8px;margin-top:19px}.kumpul-button{min-height:42px;padding:10px 13px;font-size:11px}.kumpul-stats{gap:20px;margin-top:22px}.kumpul-stat strong{font-size:18px}.kumpul-stat span{font-size:9px}.kumpul-feature-card{min-height:250px;padding:16px}.kumpul-feature-art>span{width:86px;height:86px;font-size:42px}.kumpul-about-section{margin-top:0;padding:22px;grid-template-columns:1fr;border-radius:21px}.kumpul-about-copy h1{font-size:clamp(34px,10vw,48px)}.kumpul-about-body{font-size:13px}.kumpul-about-art,.kumpul-about-image{min-height:230px}.kumpul-gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:135px;gap:9px}.kumpul-gallery-item:nth-child(3n+2){grid-row:span 1}.kumpul-gallery-item:nth-child(4n+1){grid-row:span 2}.kumpul-gallery-item>span{font-size:38px}.kumpul-process-list{grid-template-columns:1fr}.kumpul-process-step{padding:14px;display:grid;grid-template-columns:34px 1fr;column-gap:12px}.kumpul-process-step+.kumpul-process-step,.kumpul-process-step:nth-child(even),.kumpul-process-step:nth-child(n+3){border-top:1px solid var(--kt-border);border-left:0}.kumpul-process-step .kumpul-flow-number{grid-row:span 2}.kumpul-process-step small{grid-column:2}.kumpul-section{margin-top:48px}.kumpul-section-heading .kumpul-section-title,.kumpul-cta h2{font-size:29px}.kumpul-section-description{font-size:12px}.kumpul-flow-list{grid-template-columns:1fr;border-radius:16px}.kumpul-flow-step{min-height:0;padding:13px 15px;display:grid;grid-template-columns:34px 1fr;column-gap:11px}.kumpul-flow-step+.kumpul-flow-step{border-top:1px solid var(--kt-border);border-left:0}.kumpul-flow-number{grid-row:span 2}.kumpul-flow-step strong{margin:0}.kumpul-flow-step>span:last-child{font-size:10px}.kumpul-section-topline{align-items:flex-start}.kumpul-text-link{margin-top:5px;font-size:10px}.kumpul-catalog-heading{align-items:stretch;flex-direction:column;gap:16px}.kumpul-catalog-search{width:100%;min-height:44px}.kumpul-category-filters{grid-template-columns:1fr 1fr;gap:8px}.kumpul-category-filter{padding:9px;gap:8px}.kumpul-category-icon{width:32px;height:32px}.kumpul-category-filter strong{font-size:10px}.kumpul-category-filter small{font-size:8px}.kumpul-gathering-grid{grid-template-columns:1fr;gap:12px}.kumpul-gathering-card{display:grid;grid-template-columns:112px 1fr}.kumpul-gathering-art{min-height:100%;}.kumpul-gathering-art>span:first-child{font-size:36px}.kumpul-card-content{min-width:0;padding:12px}.kumpul-card-content h3{font-size:13px}.kumpul-card-meta{font-size:9px}.kumpul-card-bottom{margin-top:9px;padding-top:8px}.kumpul-card-bottom strong{font-size:10px}.kumpul-card-bottom span{font-size:9px}.kumpul-testimonial-grid{grid-template-columns:1fr}.kumpul-location-list{grid-template-columns:1fr}.kumpul-cta{margin-top:48px;padding:25px 20px;border-radius:19px}.kumpul-cta-actions{width:100%}.kumpul-cta-actions .kumpul-button{flex:1}.kumpul-footer{padding:20px 15px 95px;flex-direction:column}.kumpul-mobile-dock{position:fixed;z-index:5;right:0;bottom:0;left:0;padding:9px 5px max(9px,env(safe-area-inset-bottom));display:flex;justify-content:space-around;border-top:1px solid var(--kt-border);background:#fffffff2;backdrop-filter:blur(14px)}.kumpul-mobile-dock a{min-width:0;display:grid;justify-items:center;gap:3px;color:var(--kt-muted);font-size:8px}.kumpul-mobile-dock .kumpul-icon{width:19px;height:19px}}
    @media(prefers-reduced-motion:reduce){.kumpul-template *{scroll-behavior:auto!important;transition:none!important}}
  `;
}

function render(props = {}) {
  const colors = themeColors(props);
  const sections = list(props.sections);
  const activePageSlug = pageSlugForSections(sections);
  const catalogPage = activePageSlug === 'gathering';
  const hero = Section(props, 'hero');
  const features = Section(props, 'features_grid');
  const gatherings = Section(props, 'products_grid');
  const testimonials = Section(props, 'testimonial');
  const locations = Section(props, 'locations_list');
  const cta = Section(props, 'cta');
  const profile = props.profile || {};

  return h('div', { className: 'kumpul-template' },
    h('style', { dangerouslySetInnerHTML: { __html: styles(colors) } }),
    h(Header, { ...props, activePageSlug }),
    h('main', { className: 'kumpul-main' },
      hero ? h(Hero, { ...props, section: hero }) : null,
      sections.filter((section) => section?.type === 'about').map((section) => h(AboutSection, { ...section, key: section.id || 'about' })),
      features ? h(FeaturesSection, features) : null,
      sections.filter((section) => section?.type === 'gallery').map((section) => h(GallerySection, { ...section, key: section.id || 'gallery' })),
      gatherings ? h(GatheringsSection, { props, section: gatherings, catalogPage }) : null,
      sections.filter((section) => section?.type === 'service_process_section').map((section) => h(ProcessSection, { ...section, key: section.id || 'process' })),
      sections.filter((section) => section?.type === 'faq_list').map((section) => h(FaqSection, { props, section, key: section.id || 'faq' })),
      testimonials ? h(TestimonialsSection, testimonials) : null,
      locations ? h(LocationsSection, { props, section: locations }) : null,
      cta ? h(CallToAction, { props, section: cta }) : null,
      sections.length === 0
        ? h('section', { className: 'kumpul-empty-state', 'aria-label': 'Belum ada section' },
          h('h1', null, text(profile.name, 'Kumpul')),
          h('p', null, 'Tambahkan section melalui editor website untuk mulai menampilkan konten.'),
        )
        : null,
    ),
    h('footer', { className: 'kumpul-footer' },
      h('strong', null, text(profile.name, 'Kumpul')),
      h('span', null, text(profile.tagline, 'Tempat cerita dan kebersamaan dimulai.')),
    ),
    h(MobileDock, props),
  );
}

module.exports = { render };
