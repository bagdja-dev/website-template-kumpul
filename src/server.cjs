const React = require('react');
const { adaptPage } = require('./page-adapter.cjs');

const h = React.createElement;
// Inti qrcode saja (sinkron, tanpa fs/canvas) — QR dirender sebagai SVG di server.
const QRCodeCore = require('qrcode/lib/core/qrcode');

const defaultColors = {
  background: '#ffffff',
  surface: '#f4f4f5',
  text: '#18181b',
  textMuted: '#71717a',
  accent: '#00608e',
  accentHover: '#00547d',
  border: '#e4e4e7',
  success: '#0E9F6E',
  warning: '#C27803',
};

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

/**
 * Aksi tulis (bayar, checkout, RSVP) hanya aktif bila halaman mengizinkannya
 * (`page.actions`) DAN host sudah menyediakan bridge aksi (`props.bridgeVersion`,
 * fase P2). Sebelum itu tombol tampil tetapi nonaktif — tidak ada tombol "mati".
 */
function intentEnabled(props, action) {
  return Boolean(props.bridgeVersion) && list(props.kumpulPage && props.kumpulPage.actions).includes(action);
}

/** Atribut standar bridge host Bagdja (bootstrap iframe menangani klik; template tidak memanggil API). */
function intentAttributes(action, key, extra = {}) {
  return { 'data-bagdja-intent': action, ...(key ? { 'data-bagdja-key': key } : {}), ...extra };
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
  const orderDetail = sections.find((section) => section?.type === 'order_detail');
  if (orderDetail?.content?.gatheringPlan) return 'plan-detail';
  if (orderDetail) return 'transaction-detail';
  if (sections.some((section) => section?.type === 'gathering_calendar')) return 'calendar';
  if (sections.some((section) => section?.type === 'about' || section?.type === 'gallery')) return 'about';
  if (sections.some((section) => section?.type === 'service_process_section' || section?.type === 'faq_list')) {
    return 'how-it-works';
  }
  return '';
}

function billingStatus(invoice) {
  if (invoice.kind === 'gathering') {
    if (!invoice.invoice_issued_at || invoice.invoice_status === 'SCHEDULED') return 'scheduled';
    if (invoice.payment_status === 'REFUNDED') return 'refunded';
    if (invoice.payment_status === 'PAID') return 'paid';
    return 'issued';
  }
  return ({
    SCHEDULED: 'scheduled',
    ISSUED: 'issued',
    OVERDUE: 'issued',
    PAID: 'paid',
    REFUNDED: 'refunded',
    CANCELLED: 'cancelled',
  })[invoice.status] || 'scheduled';
}

const billingStatuses = {
  scheduled: { label: 'Menunggu diterbitkan', tone: 'muted' },
  issued: { label: 'Perlu dibayar', tone: 'warning' },
  paid: { label: 'Lunas', tone: 'success' },
  refunded: { label: 'Direfund', tone: 'muted' },
  cancelled: { label: 'Dibatalkan', tone: 'muted' },
};

const billingFilters = [
  ['all', 'Semua'],
  ['scheduled', 'Menunggu diterbitkan'],
  ['issued', 'Perlu dibayar'],
  ['paid', 'Lunas'],
  ['refunded', 'Direfund'],
  ['cancelled', 'Dibatalkan'],
];

const transactionStatuses = {
  PENDING: { label: 'Menunggu pembayaran', tone: 'warning', filter: 'awaiting' },
  PENDING_PAYMENT: { label: 'Menunggu pembayaran', tone: 'warning', filter: 'awaiting' },
  HELD: { label: 'Diproses', tone: 'info', filter: 'process' },
  COMPLETED: { label: 'Selesai', tone: 'success', filter: 'done' },
  REFUNDED: { label: 'Direfund', tone: 'danger', filter: 'cancelled' },
  CLOSED: { label: 'Ditutup', tone: 'muted', filter: 'cancelled' },
  DISPUTED: { label: 'Dalam sengketa', tone: 'danger', filter: 'process' },
  CANCELLED: { label: 'Dibatalkan', tone: 'muted', filter: 'cancelled' },
};

const transactionFilters = [
  ['all', 'Semua'],
  ['awaiting', 'Menunggu Bayar'],
  ['process', 'Diproses'],
  ['done', 'Selesai'],
  ['cancelled', 'Dibatalkan'],
];

function CartSection({ props }) {
  const cartItems = list(props.kumpulPage && props.kumpulPage.cart);
  const displayCount = cartItems
    .filter((item) => item.kind !== 'gathering_plan')
    .reduce((count, item) => count + (Number(item.quantity) || 1), 0);
  const selectableCount = cartItems.filter((item) => item.can_checkout !== false && item.kind !== 'gathering_plan').length;

  return h('section', { className: 'kumpul-cart', 'data-cart-page': '' },
    cartItems.length
      ? h(React.Fragment, null,
        h('header', { className: 'kumpul-cart-heading' },
          h('div', null,
            h('p', { className: 'kumpul-eyebrow' }, 'Pilihan Anda'),
            h('h1', null, 'Keranjang', h('span', { 'data-cart-display-count': '' }, `(${displayCount} item)`)),
            h('p', null, 'Tinjau item gathering sebelum melanjutkan ke checkout.'),
          ),
        ),
        h('p', { className: 'kumpul-cart-preview-note', role: 'note' },
          'Preview desainer · data contoh saja. Perubahan hanya berlaku di halaman ini; checkout dikelola oleh host Bagdja.',
        ),
        h('div', { className: 'kumpul-cart-layout' },
          h('div', { className: 'kumpul-cart-items' },
            h('div', { className: 'kumpul-cart-select-all' },
              h('button', {
                type: 'button',
                'data-cart-select-all': '',
                'aria-pressed': selectableCount > 0 ? 'true' : 'false',
              }, selectableCount ? 'Batalkan semua' : 'Pilih semua'),
            ),
            h('div', { className: 'kumpul-cart-list', 'data-cart-list': '' },
              ...cartItems.map((item, index) => {
                const isPlan = item.kind === 'gathering_plan';
                const canCheckout = item.can_checkout !== false && !isPlan;
                const quantity = Math.max(1, Number(item.quantity) || 1);
                return h('article', {
                  className: 'kumpul-cart-item',
                  'data-cart-item': '',
                  'data-cart-id': text(item.id, String(index)),
                  'data-cart-unit-price': Number(item.price) || 0,
                  'data-cart-checkoutable': canCheckout ? 'true' : 'false',
                  key: item.id || index,
                },
                h('label', { className: 'kumpul-cart-choice' },
                  h('input', {
                    type: 'checkbox',
                    defaultChecked: canCheckout,
                    disabled: !canCheckout,
                    'data-cart-select': '',
                    ...(canCheckout && item.key ? { 'data-bagdja-selectable': '', 'data-bagdja-key': item.key } : {}),
                    'aria-label': canCheckout ? `Pilih ${text(item.name, 'item keranjang')}` : `${text(item.name, 'Item')} belum bisa checkout`,
                  }),
                ),
                h('div', { className: 'kumpul-cart-art', 'aria-hidden': 'true' }, text(item.emoji, isPlan ? '◷' : '✳')),
                h('div', { className: 'kumpul-cart-copy' },
                  h('span', { className: 'kumpul-cart-kind' }, isPlan ? 'Rencana gathering' : text(item.category, 'Gathering')),
                  h('h2', null, text(item.name, 'Item gathering')),
                  item.variant ? h('p', { className: 'kumpul-cart-variant' }, item.variant) : null,
                  h('p', { className: 'kumpul-cart-detail' }, isPlan
                    ? text(item.blocked_reason, 'Rencana gathering belum masuk tahap pembayaran')
                    : text(item.subtitle, 'Informasi gathering dan pilihan peserta')),
                  item.blocked_reason && !isPlan
                    ? h('p', { className: 'kumpul-cart-blocked' }, item.blocked_reason)
                    : null,
                ),
                h('div', { className: 'kumpul-cart-item-controls' },
                  h('strong', { className: 'kumpul-cart-price', 'data-cart-line-total': '' }, formatCurrency((Number(item.price) || 0) * quantity)),
                  !isPlan
                    ? h('div', { className: 'kumpul-cart-quantity', 'aria-label': `Jumlah ${text(item.name, 'item')}` },
                      h('button', {
                        type: 'button',
                        'aria-label': `Kurangi jumlah ${text(item.name, 'item')}`,
                        'data-cart-quantity-decrease': '',
                        disabled: quantity <= 1 || item.quantity_editable === false,
                        ...(item.key && quantity > 1 ? intentAttributes('cart.set_quantity', item.key, { 'data-bagdja-quantity': String(quantity - 1) }) : {}),
                      }, '−'),
                      h('span', { 'data-cart-quantity' : '' }, String(quantity)),
                      h('button', {
                        type: 'button',
                        'aria-label': `Tambah jumlah ${text(item.name, 'item')}`,
                        'data-cart-quantity-increase': '',
                        disabled: item.quantity_editable === false || (Number(item.max_quantity) > 0 && quantity >= Number(item.max_quantity)),
                        ...(item.key ? intentAttributes('cart.set_quantity', item.key, { 'data-bagdja-quantity': String(quantity + 1) }) : {}),
                      }, '+'),
                    )
                    : null,
                  h('button', {
                    type: 'button',
                    className: 'kumpul-cart-remove',
                    'data-cart-remove': '',
                    ...(item.key ? intentAttributes('cart.remove', item.key) : {}),
                    'aria-label': `Hapus ${text(item.name, 'item')}`,
                  }, 'Hapus'),
                ),
                );
              }),
            ),
          ),
          h('aside', { className: 'kumpul-cart-summary', 'data-cart-summary': '' },
            h('h2', null, 'Ringkasan checkout'),
            h('div', { className: 'kumpul-cart-summary-row' },
              h('span', null, 'Item dipilih'),
              h('strong', { 'data-cart-selected-count': '' }, '0 item'),
            ),
            h('div', { className: 'kumpul-cart-summary-total' },
              h('span', null, 'Total sementara'),
              h('strong', { 'data-cart-selected-total': '' }, 'Rp 0'),
            ),
            h('button', { type: 'button', className: 'kumpul-cart-checkout', disabled: !intentEnabled(props, 'cart.checkout'), ...intentAttributes('cart.checkout') }, 'Lanjut ke Checkout'),
            h('p', null, 'Item yang belum dapat dibayar akan tetap tersimpan di keranjang.'),
          ),
        ),
        h('p', { className: 'kumpul-cart-empty', hidden: true, 'data-cart-empty': '' },
          'Keranjang Anda kosong. Tambahkan gathering yang ingin diikuti.',
        ),
      )
      : h('div', { className: 'kumpul-cart-empty-state' },
        h('span', { className: 'kumpul-cart-empty-icon', 'aria-hidden': 'true' }, '🛒'),
        h('h1', null, 'Keranjang Anda kosong'),
        h('p', null, props.isPreview === true
          ? 'Belum ada item pada preview keranjang ini.'
          : 'Item keranjang dan rencana gathering dikelola oleh host Bagdja.'),
        h('a', { href: tenantPath(props, '/gathering'), className: 'kumpul-cart-browse' }, 'Jelajahi Gathering'),
      ),
  );
}

function formatCurrency(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `Rp ${amount.toLocaleString('id-ID')}`
    : 'Nominal belum tersedia';
}

function transactionStatus(transaction) {
  if (transaction.has_outstanding_invoice === true) {
    return { label: text(transaction.outstanding_label, 'Menunggu pelunasan'), tone: 'warning', filter: 'process' };
  }
  return transactionStatuses[transaction.status] || {
    label: text(transaction.status, 'Status belum tersedia'),
    tone: 'muted',
    filter: 'all',
  };
}

function TransactionsSection({ props }) {
  const transactions = list(props.kumpulPage && props.kumpulPage.transactions);
  const counts = Object.fromEntries(transactionFilters.map(([key]) => [
    key,
    key === 'all' ? transactions.length : transactions.filter((transaction) => transactionStatus(transaction).filter === key).length,
  ]));

  return h('section', { className: 'kumpul-transactions', 'data-transactions-page': '' },
    h('header', { className: 'kumpul-transactions-heading' },
      h('div', null,
        h('p', { className: 'kumpul-eyebrow' }, 'Akun Anda'),
        h('h1', null, 'Daftar Transaksi'),
        h('p', null, 'Lihat semua pesanan, status pembayaran, dan riwayat pembelian Anda.'),
      ),
      h('div', { className: 'kumpul-transactions-total' },
        h('strong', null, String(counts.all)),
        h('span', null, 'transaksi tercatat'),
      ),
    ),
    props.isPreview === true
      ? h('p', { className: 'kumpul-transactions-preview-note', role: 'note' },
        'Preview desainer · data contoh saja. Status dan tindakan transaksi dikelola oleh host Bagdja.',
      )
      : null,
    h('div', { className: 'kumpul-transactions-filters', role: 'group', 'aria-label': 'Filter status transaksi' },
      ...transactionFilters.map(([key, label]) => h('button', {
        type: 'button',
        'aria-pressed': key === 'all' ? 'true' : 'false',
        'data-transaction-filter': key,
        key,
      },
      label,
      h('span', null, String(counts[key])),
      )),
    ),
    h('div', { className: 'kumpul-transactions-list', 'data-transactions-list': '' },
      ...transactions.map((transaction, index) => {
        const status = transactionStatus(transaction);
        const items = list(transaction.items);
        const firstItem = items[0] || {};
        const productName = text(firstItem.product_name, 'Gathering');
        const extraCount = Math.max(0, items.length - 1);
        const createdAt = formatCalendarDate(transaction.created_at);
        const refNumber = text(transaction.ref_number, `#${text(transaction.id).slice(0, 8)}`);
        return h('article', {
          className: 'kumpul-transaction-card',
          'data-transaction-item': '',
          'data-transaction-status': status.filter,
          key: transaction.id || index,
        },
        h('div', { className: 'kumpul-transaction-top' },
          h('div', null,
            h('span', { className: 'kumpul-transaction-ref' }, refNumber),
            h('span', { className: 'kumpul-transaction-separator', 'aria-hidden': 'true' }, '·'),
            h('time', null, createdAt),
          ),
          h('span', { className: `kumpul-transaction-status kumpul-transaction-status-${status.tone}` }, status.label),
        ),
        h('div', { className: 'kumpul-transaction-body' },
          h('div', { className: 'kumpul-transaction-item' },
            h('span', { className: 'kumpul-transaction-art', 'aria-hidden': 'true' }, '✳'),
            h('div', null,
              h('h2', null, `${productName}${extraCount ? ` + ${extraCount} produk lainnya` : ''}`),
              h('p', null, `${items.length || Number(transaction.item_count) || 1} item${transaction.courier ? ` · Kurir: ${transaction.courier}` : ''}`),
            ),
          ),
          h('div', { className: 'kumpul-transaction-total' },
            h('span', null, 'Total'),
            h('strong', null, formatCurrency(transaction.total_amount)),
          ),
        ),
        h('div', { className: 'kumpul-transaction-actions' },
          transaction.status === 'PENDING_PAYMENT' && transaction.detail_href
            ? h('a', { className: 'kumpul-transaction-action-link', href: transaction.detail_href }, 'Lanjutkan Pembayaran')
            : null,
          transaction.detail_href
            ? h('a', { className: 'kumpul-transaction-action-link', href: transaction.detail_href }, 'Detail Transaksi')
            : h('button', { type: 'button', disabled: true }, 'Detail Transaksi'),
          h('button', {
            type: 'button',
            className: 'kumpul-transaction-action-link',
            disabled: !intentEnabled(props, 'transaction.chat.open'),
            ...intentAttributes('transaction.chat.open', transaction.key),
          }, 'Chat Order'),
        ),
        );
      }),
      h('p', {
        className: 'kumpul-transactions-empty',
        hidden: transactions.length > 0,
        'data-transactions-empty': '',
      }, props.isPreview === true
        ? 'Belum ada transaksi pada preview ini.'
        : 'Data transaksi dikelola oleh host Bagdja.'),
      h('p', {
        className: 'kumpul-transactions-empty',
        hidden: true,
        'data-transactions-filter-empty': '',
      }, 'Belum ada transaksi dengan status ini. Coba pilih filter lain.'),
    ),
  );
}

function invoiceDetailStatus(invoice) {
  if (invoice.payment_status === 'PAID') return { label: 'Lunas', tone: 'success' };
  if (invoice.payment_status === 'REFUNDED') return { label: 'Direfund', tone: 'muted' };
  if (invoice.payment_status === 'PENDING_PAYMENT') return { label: 'Pembayaran sedang diproses', tone: 'info' };
  return {
    label: invoice.payment_open === false ? 'Pembayaran belum dibuka' : 'Belum dibayar',
    tone: 'warning',
  };
}

function InvoiceDetailSection({ props }) {
  const invoice = props.kumpulPage && props.kumpulPage.invoice;
  if (!invoice) {
    return h('section', { className: 'kumpul-detail-page', 'data-invoice-detail': '' },
      h('h1', null, 'Detail Tagihan'),
      h('p', null, 'Data tagihan dan status pembayaran dikelola oleh host Bagdja.'),
    );
  }
  const status = invoiceDetailStatus(invoice);
  const amount = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: text(invoice.currency, 'IDR'),
    maximumFractionDigits: 0,
  }).format(Number(invoice.amount) || 0);
  const isPaid = ['PAID', 'REFUNDED'].includes(invoice.payment_status);
  const isPending = invoice.payment_status === 'PENDING_PAYMENT';
  const paymentOpen = invoice.payment_open === true;
  const fields = [
    ['Nomor tagihan', invoice.invoice_id],
    ['Nomor rencana gathering', invoice.plan_number],
    ['Nama peserta', invoice.attendee_name],
    ['Initiator gathering', invoice.initiator_name],
    ['Batas pembayaran', invoice.payment_deadline],
    ['Tanggal acara', invoice.event_date],
  ];

  return h('section', { className: 'kumpul-detail-page', 'data-invoice-detail': '' },
    h('a', { className: 'kumpul-detail-back', href: tenantPath(props, '/tagihan') }, '← Kembali ke Tagihan'),
    h('header', { className: 'kumpul-detail-heading' },
      h('div', null,
        h('p', { className: 'kumpul-eyebrow' }, 'Tagihan gathering'),
        h('h1', null, text(invoice.gathering_title, 'Detail Tagihan Gathering')),
      ),
      h('span', { className: `kumpul-transaction-status kumpul-transaction-status-${status.tone}` }, status.label),
    ),
    props.isPreview === true
      ? h('p', { className: 'kumpul-detail-preview-note', role: 'note' },
        'Preview desainer · data contoh saja. Status tagihan dan pembayaran dikelola oleh host Bagdja.',
      )
      : null,
    h('div', { className: 'kumpul-detail-layout' },
      h('section', { className: 'kumpul-detail-card' },
        h('h2', null, 'Informasi tagihan'),
        h('dl', { className: 'kumpul-detail-fields' },
          ...fields.map(([label, value]) => h('div', { key: label },
            h('dt', null, label),
            h('dd', null, label.toLowerCase().includes('tanggal') || label.toLowerCase().includes('pembayaran')
              ? formatCalendarDate(value) || 'Belum ditentukan'
              : text(value, 'Belum tersedia')),
          )),
        ),
        h('div', { className: 'kumpul-detail-total' },
          h('span', null, 'Total tagihan'),
          h('strong', null, amount),
        ),
      ),
      h('aside', { className: 'kumpul-detail-card kumpul-detail-aside' },
        h('h2', null, 'Status pembayaran'),
        h('span', { className: `kumpul-transaction-status kumpul-transaction-status-${status.tone}` }, status.label),
        isPending
          ? h('p', null, 'Pembayaran untuk tagihan ini sedang diproses. Tidak perlu memulai pembayaran baru.')
          : null,
        !isPaid && !isPending
          ? h('div', { className: 'kumpul-detail-login-info' },
            h('h3', null, 'Mengapa perlu login untuk membayar?'),
            h('p', null, 'Akun Bagdja menghubungkan pembayaran escrow dengan peserta. Gunakan email yang sama dengan email saat RSVP. Initiator juga dapat membayar beberapa tagihan dari halaman gathering.'),
          )
          : null,
        !isPaid && paymentOpen && invoice.login_required && props.auth && props.auth.loginHref
          ? h('a', { className: 'kumpul-detail-pay-link', href: props.auth.loginHref }, 'Login untuk membayar')
          : !isPaid
            ? h('button', {
              type: 'button',
              disabled: !paymentOpen || !intentEnabled(props, 'invoice.pay'),
              ...intentAttributes('invoice.pay', invoice.key),
            },
            paymentOpen ? (isPending ? 'Lanjutkan pembayaran' : 'Bayar sekarang') : 'Pembayaran belum dibuka',
            )
            : null,
      ),
    ),
  );
}

function TransactionDetailSection({ props, section }) {
  const transaction = (props.kumpulPage && props.kumpulPage.transaction)
    || (section && section.content && section.content.transaction)
    || {};
  const items = list(transaction.items);
  const status = transactionStatus(transaction);
  const subtotal = items.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
  const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const shipping = transaction.metadata?.shipping || {};
  const shippingCost = Number(transaction.shipping_cost) || 0;
  const address = [
    transaction.recipient_name,
    transaction.phone,
    transaction.address,
    transaction.district,
    transaction.city,
    transaction.postal_code,
  ].filter(Boolean);

  return h('section', { className: 'kumpul-detail-page', 'data-transaction-detail': '' },
    h('a', { className: 'kumpul-detail-back', href: tenantPath(props, '/orders') }, '← Kembali ke Transaksi'),
    h('header', { className: 'kumpul-detail-heading' },
      h('div', null,
        h('p', { className: 'kumpul-eyebrow' }, 'Ringkasan pesanan'),
        h('h1', null, 'Detail Transaksi'),
        h('p', { className: 'kumpul-detail-reference' }, text(transaction.ref_number, `Transaksi #${text(transaction.id, '—')}`)),
      ),
      h('span', { className: `kumpul-transaction-status kumpul-transaction-status-${status.tone}` }, status.label),
    ),
    props.isPreview === true
      ? h('p', { className: 'kumpul-detail-preview-note', role: 'note' },
        'Preview desainer · data contoh saja. Detail dan tindakan transaksi dikelola oleh host Bagdja.',
      )
      : null,
    h('div', { className: 'kumpul-detail-layout' },
      h('div', { className: 'kumpul-detail-main' },
        h('section', { className: 'kumpul-detail-card' },
          h('h2', null, `Detail pemesanan · ${items.length} item`),
          h('div', { className: 'kumpul-detail-items' },
            ...items.map((item, index) => {
              const product = item.order?.product || {};
              const title = text(product.name, text(item.product_name, 'Gathering'));
              const gatheringInvoice = item.order?.gathering_invoice;
              const quantity = Number(item.quantity) || 1;
              return h('article', { className: 'kumpul-detail-item', key: item.id || index },
                h('span', { className: 'kumpul-detail-item-art', 'aria-hidden': 'true' }, text(item.emoji, title.slice(0, 1))),
                h('div', { className: 'kumpul-detail-item-copy' },
                  h('h3', null, title),
                  h('p', null, gatheringInvoice
                    ? `Peserta: ${text(gatheringInvoice.attendee_name, 'Peserta')} · Invoice ${text(gatheringInvoice.invoice_id, 'tersedia')}`
                    : `${quantity} × ${formatCurrency(item.unit_price)}`),
                  gatheringInvoice
                    ? h('small', { className: 'kumpul-detail-escrow-note' }, 'Dana seat ditahan di escrow sampai acara dikonfirmasi pengelola.')
                    : null,
                ),
                h('strong', null, formatCurrency(item.total_amount)),
              );
            }),
          ),
        ),
        address.length
          ? h('section', { className: 'kumpul-detail-card' },
            h('h2', null, 'Alamat pengiriman'),
            h('p', { className: 'kumpul-detail-address' }, address.join(' · ')),
          )
          : null,
        shipping.courier_code || transaction.courier
          ? h('section', { className: 'kumpul-detail-card' },
            h('h2', null, 'Kurir pengiriman'),
            h('dl', { className: 'kumpul-detail-fields' },
              h('div', null, h('dt', null, 'Kurir'), h('dd', null, text(shipping.courier_code, transaction.courier))),
              shipping.courier_service_name
                ? h('div', null, h('dt', null, 'Layanan'), h('dd', null, shipping.courier_service_name))
                : null,
              shipping.destination_area_name
                ? h('div', null, h('dt', null, 'Area tujuan'), h('dd', null, shipping.destination_area_name))
                : null,
              h('div', null, h('dt', null, 'Biaya ongkir'), h('dd', null, formatCurrency(shippingCost))),
            ),
          )
          : null,
      ),
      h('aside', { className: 'kumpul-detail-card kumpul-detail-aside' },
        h('h2', null, 'Ringkasan'),
        h('dl', { className: 'kumpul-detail-totals' },
          h('div', null, h('dt', null, `${itemCount} item`), h('dd', null, formatCurrency(subtotal))),
          h('div', null, h('dt', null, 'Ongkir'), h('dd', null, shipping.courier_code ? formatCurrency(shippingCost) : 'Ditentukan penjual')),
          h('div', { className: 'kumpul-detail-grand-total' }, h('dt', null, 'Total'), h('dd', null, formatCurrency(transaction.total_amount))),
        ),
        h('dl', { className: 'kumpul-detail-fields kumpul-detail-payment-fields' },
          transaction.escrow_id
            ? h('div', null, h('dt', null, 'Escrow ID'), h('dd', { className: 'kumpul-detail-mono' }, transaction.escrow_id))
            : null,
          transaction.created_at
            ? h('div', null, h('dt', null, 'Tanggal transaksi'), h('dd', null, formatCalendarDate(transaction.created_at)))
            : null,
        ),
        transaction.status === 'PENDING_PAYMENT' || transaction.status === 'PENDING'
          ? h(React.Fragment, null,
            // order.* memakai jalur aksi transaksi host yang sudah ada (data-bagdja-action).
            h('button', { type: 'button', disabled: !intentEnabled(props, 'order.retry_payment'), 'data-bagdja-action': 'order.retry_payment' }, 'Lanjutkan Pembayaran'),
            transaction.payment_mode === 'ESCROW'
              ? h('p', { className: 'kumpul-detail-payment-note' }, 'Dana escrow disimpan sampai proses konfirmasi pesanan selesai.')
              : null,
          )
          : h('p', { className: 'kumpul-detail-payment-note' },
            transaction.payment_mode === 'ESCROW'
              ? 'Dana escrow disimpan sampai proses konfirmasi pesanan selesai.'
              : status.label,
          ),
      ),
    ),
  );
}

const gatheringWorkflowSteps = [
  { key: 'PLAN', label: 'Atur rencana' },
  { key: 'INVITATIONS', label: 'Buat undangan' },
  { key: 'INVITATION_CONFIRMATION', label: 'Konfirmasi undangan' },
  { key: 'PAYMENT_CONFIRMATION', label: 'Konfirmasi pembayaran' },
];

const gatheringPlanStatuses = {
  PREORDER: 'Praorder',
  RSVP_OPEN: 'Pendaftaran dibuka',
  PAYMENT_OPEN: 'Pembayaran dibuka',
  CONFIRMED: 'Acara dikonfirmasi',
  IN_PROGRESS: 'Sedang berlangsung',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  LOCKED: 'Dikunci',
};

function GatheringPlanSimulator({ plan, props }) {
  const occurrence = plan.occurrence || {};
  const options = list(occurrence.option_groups_snapshot);
  const openedIds = new Set(list(occurrence.opened_option_ids_snapshot));
  const invitees = list(props.kumpulPage && props.kumpulPage.invitees);
  const localDatePart = (value) => typeof value === 'string' ? value.slice(0, 10) : '';
  const localTimePart = (value) => typeof value === 'string' ? value.slice(11, 16) : '';

  return h('section', {
    className: 'kumpul-plan-simulator',
    'data-plan-simulator': '',
    'data-current-step': 'PLAN',
    'data-min-attendees': String(Number(occurrence.min_attendees) || 0),
    'data-max-attendees': String(Number(occurrence.max_attendees) || 0),
  },
  h('div', { className: 'kumpul-plan-simulator-heading' },
    h('div', null,
      h('p', { className: 'kumpul-eyebrow' }, 'Simulasi interaktif'),
      h('h2', null, 'Coba alur rencana gathering'),
      h('p', null, 'Mulai dari menyusun rencana, kirim undangan contoh, tinjau RSVP, lalu simulasikan konfirmasi acara.'),
    ),
    h('span', { className: 'kumpul-plan-simulation-badge' }, 'Lokal · tanpa API'),
  ),
  h('style', { dangerouslySetInnerHTML: { __html: '.kumpul-plan-sim-steps{position:sticky;top:var(--kumpul-header-height,0px);z-index:8;padding-top:10px;background:var(--kt-surface)}.kumpul-plan-sim-form.kumpul-plan-sim-dates{grid-template-columns:repeat(3,minmax(0,1fr))}.kumpul-plan-sim-date-time{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:6px}.kumpul-plan-sim-options .kumpul-plan-sim-option{width:100%;margin:7px 0;display:flex;align-items:flex-start}.kumpul-plan-sim-option>span{display:grid;gap:3px}.kumpul-plan-sim-option small{color:var(--kt-muted);font-size:8px;font-weight:400;line-height:1.45}.kumpul-plan-sim-invite-form{grid-template-columns:repeat(3,minmax(0,1fr)) auto}.kumpul-plan-sim-invitees li>div{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:760px){.kumpul-plan-sim-form.kumpul-plan-sim-dates{grid-template-columns:1fr}.kumpul-plan-sim-invite-form{grid-template-columns:1fr}.kumpul-plan-sim-invitees li>div{grid-template-columns:1fr}}' } }),
  h('p', { className: 'kumpul-plan-simulation-note', role: 'note' },
    'Semua perubahan hanya tersimpan sementara di halaman preview ini. Tidak ada undangan terkirim, pembayaran diproses, atau data akun yang diubah. Muat ulang untuk mengulang simulasi.',
  ),
  h('ol', { className: 'kumpul-plan-sim-steps', 'aria-label': 'Langkah simulasi' },
    ...gatheringWorkflowSteps.map((step, index) => h('li', {
      key: step.key,
      className: index === 0 ? 'is-current' : '',
      'data-sim-step-item': step.key,
    },
    h('button', {
      type: 'button',
      'data-sim-step': step.key,
      'aria-current': index === 0 ? 'step' : undefined,
      disabled: index > 0,
    },
    h('span', { 'data-sim-step-number': '' }, String(index + 1)),
    h('span', null, step.label),
    )),
    )),
  h('div', { className: 'kumpul-plan-sim-panel', 'data-sim-panel': 'PLAN' },
    h('h3', null, '1. Atur rencana'),
    h('p', { className: 'kumpul-plan-sim-help' }, 'Tetapkan akses undangan, tenggat, tanggal acara, dan pilihan dari produk yang akan dibuka. Harga dan batas peserta mengikuti data produk.'),
    h('div', { className: 'kumpul-plan-sim-form' },
      h('label', null, 'Nama rencana',
        h('input', { type: 'text', required: true, defaultValue: text(plan.title), 'data-sim-title': '' }),
      ),
      h('label', null, 'Akses peserta',
        h('select', { defaultValue: plan.invite_policy === 'INVITE_ONLY' ? 'INVITE_ONLY' : 'OPEN', 'data-sim-policy': '' },
          h('option', { value: 'OPEN' }, 'Terbuka'),
          h('option', { value: 'INVITE_ONLY' }, 'Khusus undangan'),
        ),
      ),
    ),
    h('div', { className: 'kumpul-plan-sim-form kumpul-plan-sim-dates' },
      h('label', null, 'Batas reservasi',
        h('span', { className: 'kumpul-plan-sim-date-time' },
          h('input', { type: 'date', defaultValue: localDatePart(occurrence.rsvp_close_at), 'data-sim-rsvp-date': '' }),
          h('input', { type: 'time', defaultValue: localTimePart(occurrence.rsvp_close_at), 'aria-label': 'Jam batas reservasi', 'data-sim-rsvp-time': '' }),
        ),
      ),
      h('label', null, 'Batas pembayaran',
        h('span', { className: 'kumpul-plan-sim-date-time' },
          h('input', { type: 'date', defaultValue: localDatePart(occurrence.payment_deadline), 'data-sim-payment-date': '' }),
          h('input', { type: 'time', defaultValue: localTimePart(occurrence.payment_deadline), 'aria-label': 'Jam batas pembayaran', 'data-sim-payment-time': '' }),
        ),
      ),
      h('label', null, 'Tanggal acara',
        h('span', { className: 'kumpul-plan-sim-date-time' },
          h('input', { type: 'date', defaultValue: localDatePart(occurrence.final_schedule), 'data-sim-event-date': '' }),
          h('input', { type: 'time', defaultValue: localTimePart(occurrence.final_schedule), 'aria-label': 'Jam acara', 'data-sim-event-time': '' }),
        ),
      ),
    ),
    h('fieldset', { className: 'kumpul-plan-sim-options' },
      h('legend', null, 'Pilihan dari produk yang dibuka'),
      h('p', { className: 'kumpul-plan-sim-help' }, 'Pilihan hanya berasal dari snapshot opsi produk gathering.'),
      options.length
        ? options.map((option) => h('label', { key: option.product_option_id, className: 'kumpul-plan-sim-option' },
          h('input', {
            type: 'checkbox',
            value: option.product_option_id,
            defaultChecked: openedIds.has(option.product_option_id),
            'data-sim-option-group': text(option.option_group_key, 'Pilihan'),
            'data-sim-option-label': text(option.label, text(option.option_key)),
            'data-sim-option-description': text(option.description),
            'data-sim-option-location': text(option.venue_location),
            'data-sim-option-final': option.is_final_selection ? 'true' : 'false',
            'data-sim-option': '',
          }),
          h('span', { style: { display: 'grid', minWidth: 0, gap: '3px' } },
            h('strong', null, `${text(option.option_group_key, 'Pilihan')} · ${text(option.label, text(option.option_key))}`),
            option.venue_location || option.description
              ? h('small', { style: { display: 'block', color: 'var(--kt-muted)', fontSize: '8px', fontWeight: 400, lineHeight: 1.45 } }, [option.venue_location, option.description].filter(Boolean).join(' · '))
              : null,
          ),
        ))
        : h('p', null, 'Belum ada opsi dari produk pada contoh rencana ini.'),
    ),
    h('p', { className: 'kumpul-plan-sim-status', role: 'status', hidden: true, 'data-sim-saved': '' }),
    h('p', { className: 'kumpul-plan-sim-error', role: 'alert', hidden: true, 'data-sim-error': '' }),
    h('div', { className: 'kumpul-plan-sim-actions' },
      h('button', { type: 'button', className: 'kumpul-plan-sim-secondary', 'data-sim-save-plan': '' }, 'Simpan'),
      h('button', { type: 'button', className: 'kumpul-plan-sim-primary', 'data-sim-submit-plan': '' }, 'Submit'),
    ),
  ),
  h('div', { className: 'kumpul-plan-sim-panel', 'data-sim-panel': 'INVITATIONS', hidden: true },
    h('h3', null, '2. Buat undangan'),
    h('p', { className: 'kumpul-plan-sim-help' }, 'Atur banner dan teks undangan, lalu tambahkan kontak melalui email atau WhatsApp. Preview hanya menyimulasikan submit dan tidak mengirim pesan.'),
    h('fieldset', { className: 'kumpul-invite-appearance', 'data-sim-appearance': '' },
      h('legend', null, 'Tampilan undangan'),
      h('div', { className: 'kumpul-invite-appearance-grid' },
        h('div', { className: 'kumpul-invite-banner-field' },
          h('img', { className: 'kumpul-invite-banner', alt: 'Preview banner undangan', hidden: true, 'data-sim-banner-preview': '' }),
          h('div', { className: 'kumpul-invite-banner-empty', 'aria-hidden': 'true', 'data-sim-banner-empty': '' }, 'Belum ada banner'),
          h('label', null, 'Banner undangan (opsional)',
            h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', 'data-sim-banner': '' }),
            h('small', null, 'Preview lokal — gambar tidak diunggah.')),
        ),
        h('label', { className: 'kumpul-invite-text-field' }, 'Teks undangan',
          h('textarea', {
            rows: 5,
            maxLength: 3000,
            defaultValue: text(plan.invitation_description),
            placeholder: 'Ceritakan rencana acara dan informasi penting untuk peserta.',
            'data-sim-invitation-description': '',
          })),
      ),
      h('p', { className: 'kumpul-plan-sim-error', role: 'alert', hidden: true, 'data-sim-banner-error': '' }),
      h('p', { className: 'kumpul-plan-sim-status', role: 'status', hidden: true, 'data-sim-invitation-saved': '' }),
      h('div', { className: 'kumpul-invite-appearance-actions' },
        h('button', { type: 'button', 'data-sim-save-invitation': '' }, 'Simpan tampilan (simulasi)'))),
    h('div', { className: 'kumpul-plan-sim-invite-form' },
      h('label', null, 'Nama calon peserta',
        h('input', { type: 'text', placeholder: 'Nama peserta', 'data-sim-invite-name': '' }),
      ),
      h('label', null, 'Email',
        h('input', { type: 'email', placeholder: 'nama@email.test', 'data-sim-invite-email': '' }),
      ),
      h('label', null, 'WhatsApp',
        h('input', { type: 'tel', placeholder: '+628123456789', 'data-sim-invite-whatsapp': '' }),
      ),
      h('button', { type: 'button', 'data-sim-add-invite': '' }, 'Tambah peserta'),
    ),
    h('ul', { className: 'kumpul-plan-sim-invitees', 'data-sim-invitees': '' },
      ...invitees.map((invitee, index) =>       h('li', {
        key: invitee.email || index,
        'data-sim-invitee': '',
        'data-sim-rsvp-status': invitee.rsvp_status === 'ACCEPTED' ? 'ACCEPTED' : 'PENDING',
      },
        h('div', null,
          h('input', { type: 'text', 'aria-label': `Nama calon peserta ${index + 1}`, defaultValue: text(invitee.name), 'data-sim-invitee-name': '' }),
          h('input', { type: 'email', 'aria-label': `Email calon peserta ${index + 1}`, defaultValue: text(invitee.email), 'data-sim-invitee-email': '' }),
          h('input', { type: 'tel', 'aria-label': `WhatsApp calon peserta ${index + 1}`, defaultValue: text(invitee.whatsapp), 'data-sim-invitee-whatsapp': '' }),
        ),
        h('button', { type: 'button', 'aria-label': `Hapus peserta ${index + 1}`, 'data-sim-remove-invite': '' }, 'Hapus'),
      )),
    ),
    h('p', { className: 'kumpul-plan-sim-error', role: 'alert', hidden: true, 'data-sim-error': '' }),
    h('div', { className: 'kumpul-plan-sim-actions' },
      h('button', { type: 'button', className: 'kumpul-plan-sim-secondary', 'data-sim-back': '' }, 'Kembali'),
      h('button', { type: 'button', className: 'kumpul-plan-sim-primary', 'data-sim-send-invites': '' }, 'Simulasikan kirim undangan'),
    ),
  ),
  h('div', { className: 'kumpul-plan-sim-panel', 'data-sim-panel': 'INVITATION_CONFIRMATION', hidden: true },
    h('h3', null, '3. Konfirmasi undangan'),
    h('p', { className: 'kumpul-plan-sim-help' }, 'Daftar ini hanya menampilkan peserta yang sudah mengonfirmasi hadir. Jumlah peserta harus memenuhi batas produk sebelum RSVP ditutup.'),
    h('section', {
      className: 'kumpul-plan-sim-public-invitation',
      'data-sim-public-invitation': '',
      'data-sim-public-invitation-url': tenantPath(props, `/gathering/invite/${encodeURIComponent(text(plan.id, 'preview'))}`),
      hidden: plan.invite_policy === 'INVITE_ONLY',
    },
    h('h4', null, 'Undangan terbuka'),
    h('p', { className: 'kumpul-plan-sim-help' }, 'Bagikan tautan ini atau pindai QR untuk membuka undangan publik.'),
    h('div', { className: 'kumpul-plan-sim-public-invitation-content' },
      h('div', { className: 'kumpul-plan-sim-qr' },
        h('img', { alt: 'QR undangan terbuka', 'data-sim-public-qr': '', hidden: true }),
        h('span', { role: 'status', 'data-sim-public-qr-status': '' }, 'Menyiapkan QR undangan…'),
      ),
      h('a', {
        href: tenantPath(props, `/gathering/invite/${encodeURIComponent(text(plan.id, 'preview'))}`),
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-sim-public-invitation-link': '',
      }),
    ),
    ),
    h('div', { className: 'kumpul-plan-sim-participants', 'data-sim-participants': '' }),
    h('p', { className: 'kumpul-plan-sim-error', role: 'alert', hidden: true, 'data-sim-error': '' }),
    h('div', { className: 'kumpul-plan-sim-actions' },
      h('button', { type: 'button', className: 'kumpul-plan-sim-secondary', 'data-sim-back': '' }, 'Kembali'),
      h('button', { type: 'button', className: 'kumpul-plan-sim-primary', 'data-sim-confirm-participants': '' }, 'Tutup RSVP & buka pembayaran (simulasi)'),
    ),
  ),
  h('div', { className: 'kumpul-plan-sim-panel', 'data-sim-panel': 'PAYMENT_CONFIRMATION', hidden: true },
    h('h3', null, '4. Konfirmasi pembayaran dan acara'),
    h('p', { className: 'kumpul-plan-sim-help' }, 'Simulasikan pembayaran peserta, pilih opsi final dari hasil voting, lalu konfirmasi acara. Pembayaran nyata tidak diproses.'),
    h('div', { className: 'kumpul-plan-sim-payments', 'data-sim-payments': '' }),
    h('fieldset', { className: 'kumpul-plan-sim-options kumpul-plan-sim-final-options' },
      h('legend', null, 'Opsi final gathering'),
      h('div', { 'data-sim-final-options': '' }),
    ),
    h('p', { className: 'kumpul-plan-sim-error', role: 'alert', hidden: true, 'data-sim-error': '' }),
    h('div', { className: 'kumpul-plan-sim-actions' },
      h('button', { type: 'button', className: 'kumpul-plan-sim-secondary', 'data-sim-back': '' }, 'Kembali'),
      h('button', { type: 'button', className: 'kumpul-plan-sim-primary', 'data-sim-confirm-event': '' }, 'Konfirmasi acara (simulasi)'),
    ),
  ),
  h('div', { className: 'kumpul-plan-sim-complete', hidden: true, 'data-sim-complete': '' },
    h('span', { 'aria-hidden': 'true' }, '✓'),
    h('h3', null, 'Simulasi gathering selesai'),
    h('p', null, 'Rencana, undangan, RSVP, dan konfirmasi acara sudah dicoba. Tidak ada data yang dikirim ke Bagdja.'),
    h('button', { type: 'button', 'data-sim-restart': '' }, 'Ulangi simulasi'),
  ),
  );
}

/** Nilai `<input type="datetime-local">` (waktu Jakarta) dari ISO ber-offset. */
function jakartaInputValue(value) {
  const time = typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? new Date(time + 7 * 3600 * 1000).toISOString().slice(0, 16) : '';
}

function planDateTime(value) {
  const date = formatCalendarDate(value);
  const time = formatCalendarTime(value);
  return date ? `${date}${time ? ` · ${time} WIB` : ''}` : 'Belum ditentukan';
}

/** Alamat + tautan Google Maps (host membuka peta di tab baru; tautan lain tidak dirender). */
function VenueDetails({ address, mapUrl }) {
  const href = typeof mapUrl === 'string' && /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.|(www\.)?google\.[a-z.]+\/maps)/i.test(mapUrl) ? mapUrl : '';
  const addressText = text(address);
  if (!addressText && !href) return null;
  // Satu baris: alamat di kiri, ikon peta besar di ujung kanan (dibuka host di tab baru).
  return h('span', { className: 'kumpul-venue' },
    h('span', { className: 'kumpul-venue-address' }, addressText || 'Lihat lokasi di Google Maps'),
    href
      ? h('a', {
        className: 'kumpul-venue-map',
        href,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: 'Buka di Google Maps',
        'aria-label': 'Buka di Google Maps',
      },
      h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
        h('path', { fill: '#ea4335', d: 'M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Z' }),
        h('circle', { fill: '#fff', cx: '12', cy: '9', r: '2.6' })))
      : null,
  );
}

const invitationChannels = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  email_whatsapp: 'Email & WhatsApp',
  public: 'Tautan terbuka',
};

function PlanOperationNotice({ operation, kinds }) {
  if (!operation || !kinds.includes(operation.kind)) return null;
  const failed = operation.status === 'FAILED';
  return h('p', { className: `kumpul-plan-live-operation${failed ? ' is-failed' : ''}`, role: 'status' },
    h('strong', null, failed ? `${operation.label} gagal` : `${operation.label}…`),
    ` ${Number(operation.processed) || 0}/${Number(operation.total) || 0} diproses`,
    Number(operation.failed) ? ` · ${operation.failed} gagal` : '',
    operation.message ? ` · ${operation.message}` : '',
    failed ? null : ' · muat ulang halaman untuk melihat progres terbaru.',
  );
}

function PlanSummaryFields({ plan, openedOptions }) {
  const occurrence = plan.occurrence || {};
  return h('div', null,
    h('dl', { className: 'kumpul-detail-fields' },
      h('div', null, h('dt', null, 'Nama rencana'), h('dd', null, text(plan.title, 'Rencana gathering'))),
      h('div', null, h('dt', null, 'Akses peserta'), h('dd', null, plan.invite_policy === 'INVITE_ONLY' ? 'Khusus undangan' : 'Terbuka')),
      h('div', null, h('dt', null, 'Batas reservasi'), h('dd', null, planDateTime(occurrence.rsvp_close_at))),
      h('div', null, h('dt', null, 'Batas pembayaran'), h('dd', null, planDateTime(occurrence.payment_deadline))),
      h('div', null, h('dt', null, 'Tanggal acara'), h('dd', null, planDateTime(occurrence.final_schedule))),
      h('div', null, h('dt', null, 'Pilihan dibuka'), h('dd', null,
        openedOptions.length ? openedOptions.map((option) => `${text(option.option_group_key, 'Pilihan')} · ${text(option.label)}`).join(', ') : 'Belum ada')),
    ),
  );
}

/**
 * Tombol "Muat ulang": host menjalankan refresh lembut (`data-bagdja-refresh`) sehingga reservasi /
 * pembayaran terbaru tampil tanpa reload. Aktif hanya bila bridge host tersedia (bukan preview desainer).
 */
function PlanRefreshButton({ props, label = 'Muat ulang', compact = false }) {
  return h('button', {
    type: 'button',
    className: `kumpul-plan-refresh${compact ? ' is-compact' : ''}`,
    disabled: !props.bridgeVersion || props.isPreview === true,
    'data-bagdja-refresh': '',
    'aria-label': 'Muat ulang data terbaru',
    title: 'Muat ulang data terbaru',
  }, h(Icon, { name: 'refresh' }), compact ? null : h('span', null, label));
}

/** Baris ringkasan + tombol Muat ulang (tahap aktif saja). */
function PlanRefreshRow({ props, enabled, children }) {
  return h('div', { className: 'kumpul-plan-refresh-row' },
    h('div', { className: 'kumpul-plan-refresh-copy' }, children),
    enabled ? h(PlanRefreshButton, { props }) : null);
}

function PlanPeopleList({
  registrations,
  selectable,
  selectAction,
  props,
  rowActions,
  filterable = false,
  selectionVisible = true,
  rowScopes = false,
  selectionMessage = '',
  groupOf = reservationGroup,
  initialGroup = 'RSVP_CONFIRMED',
}) {
  if (!registrations.length) {
    return h('p', { className: 'kumpul-plan-sim-help' }, 'Belum ada peserta yang mengonfirmasi kehadiran.');
  }
  return h('ul', { className: `kumpul-plan-live-people${rowScopes ? ' kumpul-reservation-list' : ''}` },
    ...registrations.map((registration) => {
      const canSelect = selectable(registration);
      return h('li', {
        key: registration.key,
        className: 'kumpul-plan-sim-person',
        ...(rowScopes && canSelect ? { 'data-bagdja-scope': '' } : {}),
        ...(filterable ? {
          'data-kumpul-reservation-item': '',
          'data-kumpul-reservation-status': text(registration.registration_status),
          'data-kumpul-reservation-group': groupOf(registration),
          // Tab awal = tab pertama dialog (tanpa tab "Semua").
          hidden: groupOf(registration) !== initialGroup,
        } : {}),
      },
      rowScopes && canSelect && !selectionVisible
        ? h(React.Fragment, null,
          h('input', {
            type: 'checkbox',
            hidden: true,
            defaultChecked: true,
            'data-bagdja-selectable': '',
            'data-bagdja-key': registration.key,
            disabled: !intentEnabled(props, selectAction),
          }),
          h('input', {
            type: 'hidden',
            value: selectionMessage,
            'data-bagdja-field': 'message',
            'data-kumpul-reservation-message': '',
          }))
        : null,
      h('div', { className: 'kumpul-plan-sim-person-heading' },
        h('label', { className: 'kumpul-plan-live-person-name' },
          selectionVisible && canSelect
            ? h('input', {
              type: 'checkbox',
              'data-bagdja-selectable': '',
              'data-bagdja-key': registration.key,
              disabled: !intentEnabled(props, selectAction),
              'aria-label': `Pilih ${text(registration.name, 'peserta')}`,
            })
            : null,
          h('strong', null, text(registration.name, 'Peserta')),
        ),
        h('span', null, [
          registration.status_label,
          list(registration.selected_options).join(', '),
          Number.isFinite(Number(registration.invoice_amount)) ? formatCurrency(registration.invoice_amount) : '',
        ].filter(Boolean).join(' · ')),
        registration.rejection_message ? h('span', null, `Alasan: ${registration.rejection_message}`) : null,
      ),
      rowActions ? h('div', { className: 'kumpul-plan-live-row-actions' }, ...rowActions(registration)) : null);
    }),
  );
}

/** Tab filter reservasi: Ditolak, Dibatalkan (termasuk refund), selebihnya Hadir. */
function reservationGroup(registration) {
  const status = text(registration.registration_status);
  if (status === 'REJECTED') return 'REJECTED';
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'CANCELLED';
  return 'RSVP_CONFIRMED';
}

/** Tab filter pembayaran peserta: Belum bayar, Diproses (checkout berjalan), Lunas, Refund. */
function paymentGroup(registration) {
  const status = text(registration.payment_status);
  if (status === 'PAID') return 'PAID';
  if (status === 'REFUNDED') return 'REFUNDED';
  if (status === 'PENDING_PAYMENT') return 'PENDING_PAYMENT';
  return 'UNPAID';
}

const PAYMENT_FILTERS = [
  ['UNPAID', 'Belum bayar'],
  ['PENDING_PAYMENT', 'Diproses'],
  ['PAID', 'Lunas'],
  ['REFUNDED', 'Refund'],
];

function LivePlanWorkflow({ plan, props }) {
  const page = props.kumpulPage || {};
  const occurrence = plan.occurrence || {};
  const options = list(occurrence.option_groups_snapshot);
  const openedIds = new Set(list(occurrence.opened_option_ids_snapshot));
  const openedOptions = options.filter((option) => openedIds.has(option.product_option_id));
  const invitations = list(page.invitations);
  const privateInvitations = invitations.filter((invitation) => invitation.channel !== 'public');
  const registrations = list(page.registrations);
  const activeRegistrations = registrations.filter((registration) => registration.registration_status === 'RSVP_CONFIRMED');
  const paidRegistrations = activeRegistrations.filter((registration) => registration.payment_status === 'PAID');
  const operation = page.operation;
  const stepIndex = gatheringWorkflowSteps.findIndex((step) => step.key === plan.workflow_step);
  const finished = stepIndex < 0;
  const currentIndex = finished ? gatheringWorkflowSteps.length - 1 : stepIndex;
  const has = (action) => list(page.actions).includes(action);
  const button = (action, label, extra = {}, className = 'kumpul-plan-sim-primary') => h('button', {
    type: 'button',
    className,
    disabled: !intentEnabled(props, action),
    ...intentAttributes(action, plan.key, extra),
  }, label);
  const minMax = `min. ${Number(occurrence.min_attendees) || 0} · maks. ${Number(occurrence.max_attendees) || 0}`;
  const publicLink = plan.invite_policy === 'OPEN' && plan.public_invitation_href
    ? h('p', { className: 'kumpul-plan-live-public' },
      'Undangan terbuka: ',
      h('a', { href: plan.public_invitation_href }, 'Buka halaman undangan'),
      ' — bagikan tautan halaman tersebut ke calon peserta.',
    )
    : null;

  const cancelAvailable = has('gathering.cancel');
  // Tutup reservasi: tombol membuka modal konfirmasi Kumpul; tombol di modal menjalankan intent
  // (`data-bagdja-confirmed` → host tidak menampilkan confirm() bawaan browser).
  const canCloseReservations = plan.workflow_step === 'INVITATION_CONFIRMATION' && has('gathering.reservations.confirm');
  const closeReservationsOpener = (label, className, key) => h('button', {
    key,
    type: 'button',
    className,
    disabled: !intentEnabled(props, 'gathering.reservations.confirm'),
    'data-kumpul-sheet-open': 'close-rsvp',
    'aria-haspopup': 'dialog',
  }, label);
  const desktopReservationClose = canCloseReservations
    ? closeReservationsOpener('Tutup Reservasi & Lanjutkan', 'kumpul-plan-sim-soft', 'confirm-reservations-desktop')
    : null;
  const mobileReservationClose = canCloseReservations
    ? closeReservationsOpener('Tutup reservasi & lanjutkan', 'kumpul-plan-mobile-reservation-confirm', 'confirm-reservations')
    : null;
  const closeReservationsDialog = canCloseReservations
    ? h('dialog', {
      key: 'close-rsvp-dialog',
      className: 'kumpul-reservation-confirm-dialog is-accent',
      'data-kumpul-invite-sheet': 'close-rsvp',
      'aria-labelledby': 'kumpul-close-rsvp-title',
      'aria-describedby': 'kumpul-close-rsvp-description',
    },
    h('div', { className: 'kumpul-reservation-confirm-icon', 'aria-hidden': 'true' }, '✓'),
    h('h4', { id: 'kumpul-close-rsvp-title' }, 'Tutup reservasi & buka pembayaran?'),
    h('p', { id: 'kumpul-close-rsvp-description' },
      h('strong', null, `${activeRegistrations.length} peserta hadir`),
      ' akan lanjut ke tahap pembayaran. Setelah ditutup, peserta baru tidak dapat mendaftar lagi.'),
    h('ul', { className: 'kumpul-close-rsvp-points' },
      h('li', null, `Kuota produk: min. ${Number(occurrence.min_attendees) || 0} · maks. ${Number(occurrence.max_attendees) || 0} peserta`),
      h('li', null, 'Tagihan dikirim ke peserta saat Anda memulai pembayaran')),
    h('div', { className: 'kumpul-reservation-confirm-actions' },
      h('button', { type: 'button', className: 'kumpul-reservation-confirm-cancel', 'data-kumpul-sheet-close': '' }, 'Kembali'),
      h('button', {
        type: 'button',
        className: 'kumpul-reservation-confirm-submit',
        disabled: !intentEnabled(props, 'gathering.reservations.confirm'),
        ...intentAttributes('gathering.reservations.confirm', plan.key, { 'data-bagdja-confirmed': 'true' }),
      }, 'Ya, tutup reservasi')))
    : null;
  const desktopCancelTrigger = cancelAvailable
    ? h('label', { htmlFor: CANCEL_DIALOG_TOGGLE_ID, className: 'kumpul-plan-cancel-trigger', role: 'button', tabIndex: 0 }, 'Batalkan acara')
    : null;
  const mobileCancel = cancelAvailable
    ? h('div', { key: 'cancel', className: 'kumpul-plan-sheet-cancel' },
      h('label', { htmlFor: CANCEL_DIALOG_TOGGLE_ID, className: 'kumpul-plan-cancel-trigger', role: 'button', tabIndex: 0 }, 'Batalkan acara'))
    : null;

  /**
   * Isi panel + CTA. Desktop: CTA di bawah isi panel. HP (≤760px): CTA pindah ke bar bawah
   * (primer langsung, sekunder & batal di sheet "Aksi lainnya"). Bar ada di dalam scope panel
   * sehingga field form tetap ikut terkirim bersama intent.
   */
  const withActions = (step, editable, children, {
    primary = null,
    secondary = [],
    desktopActions = null,
    primaryInSheet = false,
  } = {}) => {
    const secondaryActions = editable ? secondary.filter(Boolean) : [];
    // primary boleh satu tombol atau daftar (mis. Bayarkan peserta terpilih + Konfirmasi acara).
    const primaryActions = editable ? [].concat(primary).filter(Boolean) : [];
    const discuss = (key, className) => has('gathering.chat.open') && props.isPreview !== true
      ? h('button', {
        key,
        type: 'button',
        className,
        disabled: !intentEnabled(props, 'gathering.chat.open'),
        ...intentAttributes('gathering.chat.open', plan.key),
      }, h(Icon, { name: 'chat' }), h('span', null, 'Diskusikan'))
      : null;
    // Web: satu baris — Diskusikan | aksi sekunder | Batalkan acara | aksi utama (desktopActions bila diatur panel).
    const desktopActionItems = [
      discuss('discuss-desktop', 'kumpul-plan-discuss'),
      ...(editable
        ? desktopActions
          ? desktopActions
          : [...secondaryActions, desktopCancelTrigger ? h(React.Fragment, { key: 'cancel' }, desktopCancelTrigger) : null, ...primaryActions]
        : []),
    ].filter(Boolean);
    const mobileSecondaryActions = primaryInSheet && primaryActions.length
      ? [...primaryActions, ...secondaryActions]
      : secondaryActions;
    return h('div', { 'data-bagdja-scope': '' },
      ...children,
      desktopActionItems.length
        ? h('div', { className: 'kumpul-plan-sim-actions kumpul-plan-desktop-actions' }, ...desktopActionItems)
        : null,
      h(PlanMobileBar, {
        step,
        primary: primaryInSheet ? [] : primaryActions,
        secondary: mobileSecondaryActions,
        cancel: editable ? mobileCancel : null,
        discuss: discuss('discuss-mobile', 'kumpul-plan-mobilebar-discuss'),
      }),
    );
  };

  const planPanel = (editable) => editable && has('gathering.plan.save')
    ? withActions('PLAN', editable, [
      h('p', { key: 'help', className: 'kumpul-plan-sim-help' }, 'Tetapkan akses undangan, tenggat, tanggal acara, dan pilihan produk yang dibuka untuk peserta.'),
      h('div', { key: 'main', className: 'kumpul-plan-sim-form' },
        h('label', null, 'Nama rencana',
          h('input', { type: 'text', required: true, minLength: 3, maxLength: 255, defaultValue: text(plan.title), 'data-bagdja-field': 'title' })),
        h('label', null, 'Akses peserta',
          h('select', { defaultValue: plan.invite_policy === 'INVITE_ONLY' ? 'INVITE_ONLY' : 'OPEN', 'data-bagdja-field': 'invitePolicy' },
            h('option', { value: 'OPEN' }, 'Terbuka'),
            h('option', { value: 'INVITE_ONLY' }, 'Khusus undangan'))),
      ),
      h('div', { key: 'dates', className: 'kumpul-plan-sim-form kumpul-plan-live-dates' },
        ...[
          ['rsvpCloseAt', 'Batas reservasi', occurrence.rsvp_close_at],
          ['paymentDueAt', 'Batas pembayaran', occurrence.payment_deadline],
          ['scheduledAt', 'Tanggal acara', occurrence.final_schedule],
        ].map(([field, label, value]) => h('label', { key: field, className: 'kumpul-datetime' }, `${label} (WIB)`,
          h('input', { type: 'datetime-local', defaultValue: jakartaInputValue(value), 'data-bagdja-field': field, 'data-kumpul-datetime-input': '' }),
          // HP: pemilih tanggal & jam khusus (bottom sheet di client.js) menggantikan picker bawaan.
          h('button', {
            type: 'button',
            className: 'kumpul-datetime-trigger',
            'data-kumpul-datetime-trigger': '',
            'data-label': label,
            'aria-label': `Pilih ${label.toLowerCase()}`,
          },
          h(Icon, { name: 'calendar' }),
          h('span', { 'data-kumpul-datetime-text': '' }, value
            ? `${formatCalendarDate(value, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${formatCalendarTime(value)} WIB`
            : 'Pilih tanggal & jam'))))),
      h('fieldset', { key: 'options', className: 'kumpul-plan-sim-options kumpul-plan-pick-fieldset' },
        h('legend', null, 'Pilihan dari produk yang dibuka'),
        options.length
          ? h(PlanOptionPicker, { options, openedIds })
          : h('p', null, 'Produk ini tidak memiliki pilihan.'),
      ),
    ], {
      primary: button('gathering.plan.save', 'Submit & lanjut buat undangan', { 'data-bagdja-submit': 'true', key: 'submit' }),
      secondary: [button('gathering.plan.save', 'Simpan', { key: 'save' }, 'kumpul-plan-sim-secondary')],
    })
    : withActions('PLAN', false, [h(PlanSummaryFields, { key: 'summary', plan, openedOptions })]);

  const inviteOnly = plan.invite_policy === 'INVITE_ONLY';
  const invitationsPanel = (editable) => {
    const canSubmitInvitations = editable && has('gathering.invitations.submit');
    const invitationSubmitButton = canSubmitInvitations
      ? h('button', {
        type: 'button',
        className: 'kumpul-plan-sim-primary',
        disabled: !intentEnabled(props, 'gathering.invitations.submit'),
        'aria-haspopup': 'dialog',
        'data-kumpul-invitation-confirm-open': '',
      }, 'Kirim undangan')
      : null;
    return withActions('INVITATIONS', editable, [
    h('p', { key: 'help', className: 'kumpul-plan-sim-help' }, inviteOnly
      ? 'Rencana khusus undangan: atur tampilan undangan, daftarkan calon peserta lewat email atau WhatsApp, lalu kirim undangan.'
      : 'Rencana terbuka: atur tampilan undangan, lalu kirim. Undangan publik dibuat saat dikirim dan siapa pun dengan tautan bisa RSVP.'),
    h(React.Fragment, { key: 'public' }, publicLink),
    h(InvitationAppearance, {
      key: 'appearance',
      plan,
      editable: editable && has('gathering.invitation.content.save'),
    }),
    inviteOnly || privateInvitations.length
      ? h('section', { key: 'participants', className: 'kumpul-plan-invitees', 'aria-label': 'Daftar calon peserta' },
        h('h4', null, `Daftar calon peserta${privateInvitations.length ? ` (${privateInvitations.length})` : ''}`),
        editable && inviteOnly && has('gathering.invitation.add')
          ? h('div', { className: 'kumpul-plan-sim-invite-form', 'data-bagdja-scope': '' },
            h('label', null, 'Nama calon peserta', h('input', { type: 'text', maxLength: 120, placeholder: 'Nama peserta', 'data-bagdja-field': 'invitee.name' })),
            h('label', null, 'Email', h('input', { type: 'email', maxLength: 254, placeholder: 'nama@email.com', 'data-bagdja-field': 'invitee.email' })),
            h('label', null, 'WhatsApp', h('input', { type: 'tel', maxLength: 20, placeholder: '+628123456789', 'data-bagdja-field': 'invitee.whatsapp' })),
            button('gathering.invitation.add', 'Tambah peserta', {}, ''))
          : editable && inviteOnly
            ? h('p', { className: 'kumpul-plan-sim-help', role: 'note' }, 'Pendaftaran peserta belum tersedia untuk akun ini. Muat ulang halaman atau hubungi penyelenggara.')
            : null,
        editable && inviteOnly ? h('p', { className: 'kumpul-plan-sim-help' }, 'Isi email atau nomor WhatsApp. Undangan berlaku sampai batas reservasi di tahap 1.') : null,
        privateInvitations.length
          ? h('ul', { className: 'kumpul-plan-live-people' },
            ...privateInvitations.map((invitation) => h('li', { key: invitation.key, className: 'kumpul-plan-sim-person' },
              h('div', { className: 'kumpul-plan-sim-person-heading' },
                h('strong', null, text(invitation.name, 'Peserta')),
                h('span', null, `${invitationChannels[invitation.channel] || 'Undangan'} · ${text(invitation.status_label)}`)),
              h('div', { className: 'kumpul-plan-live-row-actions' },
                invitation.invite_href ? h('a', { href: invitation.invite_href }, 'Lihat undangan') : null,
                editable && invitation.can_revoke && has('gathering.invitation.revoke')
                  ? h('button', {
                    type: 'button',
                    disabled: !intentEnabled(props, 'gathering.invitation.revoke'),
                    ...intentAttributes('gathering.invitation.revoke', plan.key, { 'data-bagdja-target': invitation.key }),
                  }, 'Cabut')
                  : null))))
          : h('p', { className: 'kumpul-plan-sim-help' }, editable
            ? 'Belum ada calon peserta. Tambahkan minimal satu sebelum mengirim undangan.'
            : 'Belum ada calon peserta.'))
      : null,
    h(PlanOperationNotice, { key: 'operation', operation, kinds: ['INVITATION_DISPATCH', 'INVITATION_REVOCATION'] }),
    canSubmitInvitations
      ? h('button', {
        key: 'submit-intent',
        type: 'button',
        hidden: true,
        disabled: !intentEnabled(props, 'gathering.invitations.submit'),
        ...intentAttributes('gathering.invitations.submit', plan.key, { 'data-kumpul-submit-invitation-intent': '', 'data-bagdja-confirmed': 'true' }),
      }, 'Kirim undangan')
      : null,
    canSubmitInvitations
      ? h('dialog', {
        key: 'submit-confirmation',
        className: 'kumpul-invitation-confirm',
        'data-kumpul-invitation-confirm-dialog': '',
        'aria-labelledby': 'kumpul-invitation-confirm-title',
        'aria-describedby': 'kumpul-invitation-confirm-description',
        style: {
          width: 'min(440px, calc(100vw - 32px))',
          maxWidth: '440px',
          padding: '24px',
          border: '1px solid var(--kt-border)',
          borderRadius: '18px',
          backgroundColor: 'var(--kt-surface)',
          color: 'var(--kt-text)',
          boxShadow: '0 24px 80px rgba(0,0,0,.24)',
        },
      },
      h('h2', { id: 'kumpul-invitation-confirm-title', style: { margin: 0, fontSize: '18px', fontWeight: 800 } }, 'Kirim undangan?'),
      h('p', {
        id: 'kumpul-invitation-confirm-description',
        style: { margin: '10px 0 0', color: 'var(--kt-muted)', fontSize: '13px', lineHeight: 1.6 },
      }, inviteOnly
        ? 'Undangan akan dikirim kepada peserta yang terdaftar. Setelah dikirim, rencana masuk ke tahap Konfirmasi undangan.'
        : 'Tautan undangan publik akan dibuat dan siapa pun yang memilikinya dapat RSVP. Setelah dikirim, rencana masuk ke tahap Konfirmasi undangan.'),
      h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' } },
        h('button', {
          type: 'button',
          className: 'kumpul-plan-sim-secondary',
          'data-kumpul-invitation-confirm-cancel': '',
        }, 'Periksa lagi'),
        h('button', {
          type: 'button',
          className: 'kumpul-plan-sim-primary',
          'data-kumpul-invitation-confirm-submit': '',
        }, 'Ya, kirim undangan')))
      : null,
    ], {
      primary: invitationSubmitButton,
      // Simpan tampilan undangan: aksi sekunder (HP: sheet "Lainnya"; web: baris CTA). Kirim undangan
      // juga menyimpan isi form ini lebih dulu (host), jadi tombol ini opsional.
      secondary: [
        has('gathering.invitation.content.save')
          ? button('gathering.invitation.content.save', 'Simpan tampilan undangan', { key: 'save-appearance' }, 'kumpul-plan-sim-secondary')
          : null,
      ],
    });
  };

  const confirmationPanel = (editable) => {
    const canReject = editable && has('gathering.registrations.reject');
    const rejectedRegistrations = registrations.filter((registration) => registration.registration_status === 'REJECTED');
    const reservationOpen = h('button', {
      type: 'button',
      className: 'kumpul-plan-sim-primary',
      'data-kumpul-reservation-open': '',
      'aria-haspopup': 'dialog',
      'aria-controls': 'kumpul-reservation-dialog',
    },
    'Lihat Reservasi',
    h('span', { className: 'kumpul-reservation-count' }, `${activeRegistrations.length} masuk`),
    h('span', { className: 'kumpul-reservation-count is-rejected' }, `${rejectedRegistrations.length} ditolak`));
    const reservationDialog = h(React.Fragment, null,
      h('style', { dangerouslySetInnerHTML: { __html: '.kumpul-reservation-dialog{position:fixed;inset:50% auto auto 50%;width:90vw;height:90vh;height:90dvh;max-width:none;max-height:none;margin:0;padding:0;transform:translate(-50%,-50%);overflow:hidden;border:1px solid var(--kt-border);border-radius:18px;background:var(--kt-surface);color:var(--kt-text);box-shadow:0 24px 80px #0f172a30}.kumpul-reservation-dialog::backdrop{background:#0f172a80;backdrop-filter:blur(3px)}.kumpul-reservation-dialog[open]{display:flex;flex-direction:column}.kumpul-reservation-head{flex:none;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--kt-border)}.kumpul-reservation-head h4{margin:0;font-size:16px}.kumpul-reservation-head p{margin:4px 0 0;color:var(--kt-muted);font-size:10px}.kumpul-reservation-close{width:34px;height:34px;flex:none;border:1px solid var(--kt-border);border-radius:50%;background:#fff;color:var(--kt-text);font-size:18px;cursor:pointer}.kumpul-reservation-body{flex:1 1 auto;min-height:0;padding:16px 20px;overflow:auto;overscroll-behavior:contain}.kumpul-reservation-filters{margin-bottom:14px;display:flex;flex-wrap:wrap;gap:7px}.kumpul-reservation-filters button{min-height:34px;padding:7px 12px;border:1px solid var(--kt-border);border-radius:99px;background:#fff;color:var(--kt-muted);font:inherit;font-size:10px;font-weight:750;cursor:pointer}.kumpul-reservation-filters button[aria-pressed=true]{border-color:var(--kt-accent);background:#e6f4f6;color:var(--kt-accent)}.kumpul-reservation-list{margin:0;padding:0;display:grid;gap:8px;list-style:none}.kumpul-reservation-list .kumpul-plan-sim-person{grid-template-columns:minmax(0,1fr) auto}.kumpul-reservation-list .kumpul-reservation-delete{width:38px;height:38px;display:grid;place-items:center;align-self:center;border:1px solid #fecaca;border-radius:10px;background:#fff5f5;color:#b91c1c;cursor:pointer}.kumpul-reservation-delete:hover{border-color:#b91c1c;background:#fee2e2}.kumpul-reservation-delete:disabled{opacity:.5;cursor:not-allowed}.kumpul-reservation-delete svg{width:17px;height:17px}.kumpul-reservation-reason{margin-top:14px;display:grid;gap:6px;color:var(--kt-muted);font-size:10px;font-weight:700}.kumpul-reservation-reason textarea{width:100%;min-height:66px;padding:9px 10px;border:1px solid var(--kt-border);border-radius:10px;background:#fff;color:var(--kt-text);font:inherit;font-size:11px;resize:vertical}.kumpul-reservation-count{padding:4px 7px;border-radius:99px;background:#ffffff25;font-size:9px;font-weight:700;white-space:nowrap}.kumpul-reservation-count.is-rejected{background:#fee2e2;color:#b91c1c}.kumpul-plan-sim-actions button[data-kumpul-reservation-open]{display:inline-flex;align-items:center;gap:8px}.kumpul-plan-live-confirm-actions{margin-top:16px;padding-top:14px;display:flex;justify-content:flex-end;gap:10px;border-top:1px solid var(--kt-border)}.kumpul-plan-live-confirm-actions .kumpul-plan-cancel-trigger{min-height:36px;padding:8px 12px;display:inline-flex;align-items:center;border:1px solid #fecaca;border-radius:9px;background:#fff;color:#b91c1c;font-size:10px;font-weight:800;cursor:pointer}.kumpul-plan-mobile-reservation-confirm{min-height:40px;padding:8px 12px;border:1px solid var(--kt-accent);border-radius:9px;background:var(--kt-accent);color:#fff;font:inherit;font-size:10px;font-weight:800;cursor:pointer}.kumpul-plan-mobile-reservation-confirm:disabled{opacity:.55;cursor:not-allowed}.kumpul-plan-sheet-confirmation-actions{grid-template-columns:1fr 1fr;align-items:center}.kumpul-plan-sheet-confirmation-actions .kumpul-plan-cancel-trigger{min-height:40px;justify-content:center;border:1px solid #fecaca;border-radius:9px;background:#fff;color:#b91c1c;text-align:center}.kumpul-plan-live-confirm-actions button.kumpul-plan-sim-primary{min-height:36px}.kumpul-plan-sim-actions .kumpul-plan-sim-soft{border-color:var(--kt-accent);background:color-mix(in srgb,var(--kt-accent) 12%,#fff);color:var(--kt-accent)}.kumpul-plan-sim-actions .kumpul-plan-sim-soft:hover{background:color-mix(in srgb,var(--kt-accent) 20%,#fff)}.kumpul-plan-desktop-actions .kumpul-plan-cancel-trigger{flex:1;min-height:36px;justify-content:center;border-color:#fca5a5;background:#fef2f2;color:#b91c1c;font-size:9px}.kumpul-plan-desktop-actions .kumpul-plan-cancel-trigger:hover{background:#fee2e2}.kumpul-plan-sim-actions button[data-kumpul-reservation-open],.kumpul-plan-mobilebar-primary button[data-kumpul-reservation-open]{justify-content:center}.kumpul-plan-mobilebar-primary button[data-kumpul-reservation-open]{display:inline-flex;align-items:center;gap:6px}.kumpul-reservation-foot{display:none}.kumpul-reservation-dialog .kumpul-reservation-body .kumpul-plan-sim-actions button.kumpul-plan-sim-secondary{color:#b91c1c}.kumpul-reservation-dialog .kumpul-reservation-body .kumpul-plan-sim-person-heading{grid-column:1}.kumpul-reservation-dialog .kumpul-plan-live-people{margin:0;padding:0;display:grid;gap:8px;list-style:none}.kumpul-reservation-dialog .kumpul-reservation-body .kumpul-plan-sim-person{grid-template-columns:minmax(0,1fr) auto}@media(max-width:760px){.kumpul-reservation-dialog{inset:auto 0 0;width:100vw;height:90vh;height:90dvh;max-height:90vh;max-height:90dvh;transform:none;border-right:0;border-bottom:0;border-left:0;border-radius:20px 20px 0 0}.kumpul-reservation-head{padding:14px}.kumpul-reservation-body{padding:14px}.kumpul-plan-live-confirm-actions{flex-wrap:wrap}.kumpul-plan-live-confirm-actions *{flex:1}.kumpul-plan-live-confirm-actions .kumpul-plan-cancel-trigger{justify-content:center}}@media(max-width:760px){.kumpul-reservation-foot{flex:none;padding:12px 14px calc(12px + env(safe-area-inset-bottom,0px));display:flex;border-top:1px solid var(--kt-border);background:var(--kt-surface)}.kumpul-reservation-dialog .kumpul-reservation-foot button{flex:1 1 auto;width:100%;min-height:44px;font-size:12px}}' } }),
      h('style', { dangerouslySetInnerHTML: { __html: '.kumpul-reservation-confirm-dialog{position:fixed;inset:50% auto auto 50%;width:min(440px,calc(100vw - 32px));max-width:440px;max-height:90vh;margin:0;padding:22px;transform:translate(-50%,-50%);overflow:auto;border:1px solid var(--kt-border);border-radius:18px;background:var(--kt-surface);color:var(--kt-text);box-shadow:0 24px 80px #0f172a50}.kumpul-reservation-confirm-dialog::backdrop{background:#0f172a70;backdrop-filter:blur(2px)}.kumpul-reservation-confirm-dialog[open]{display:grid;gap:10px}.kumpul-reservation-confirm-dialog h4{margin:0;font-size:17px}.kumpul-reservation-confirm-dialog p{margin:0;color:var(--kt-muted);font-size:12px;line-height:1.55}.kumpul-reservation-confirm-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:#fee2e2;color:#b91c1c;font-size:19px;font-weight:900}.kumpul-reservation-reasons{margin:4px 0 0;padding:0;border:0;display:grid;gap:7px}.kumpul-reservation-reasons legend{margin-bottom:8px;font-size:11px;font-weight:800}.kumpul-reservation-reason-option{min-height:38px;padding:8px 10px;display:flex;align-items:center;gap:9px;border:1px solid var(--kt-border);border-radius:10px;background:#fff;color:var(--kt-text);font-size:11px;cursor:pointer}.kumpul-reservation-reason-option:has(input:checked){border-color:#fca5a5;background:#fff5f5;color:#991b1b}.kumpul-reservation-reason-option input{accent-color:#b91c1c}.kumpul-reservation-custom-reason{width:100%;min-height:72px;padding:10px;border:1px solid var(--kt-border);border-radius:10px;background:#fff;color:var(--kt-text);font:inherit;font-size:11px;resize:vertical}.kumpul-reservation-confirm-actions{margin-top:8px;display:flex;justify-content:flex-end;gap:9px}.kumpul-reservation-confirm-actions button{min-height:40px;padding:8px 13px;border:1px solid var(--kt-border);border-radius:9px;background:#fff;color:var(--kt-text);font:inherit;font-size:11px;font-weight:800;cursor:pointer}.kumpul-reservation-confirm-actions .kumpul-reservation-confirm-submit{border-color:#b91c1c;background:#b91c1c;color:#fff}.kumpul-reservation-confirm-actions button:disabled{opacity:.45;cursor:not-allowed}.kumpul-reservation-delete{border:1px solid #fecaca;background:#fff5f5}@media(max-width:760px){.kumpul-reservation-confirm-dialog{inset:auto 0 0;width:100vw;max-width:none;max-height:85vh;padding:20px 16px calc(18px + env(safe-area-inset-bottom,0px));transform:none;border-right:0;border-bottom:0;border-left:0;border-radius:20px 20px 0 0}.kumpul-reservation-confirm-actions button{min-height:44px}}' } }),
      h('dialog', {
        id: 'kumpul-reservation-dialog',
        className: 'kumpul-reservation-dialog',
        'data-kumpul-reservation-dialog': '',
        'aria-labelledby': 'kumpul-reservation-title',
      },
      h('div', { className: 'kumpul-reservation-head' },
        h('div', null,
          h('h4', { id: 'kumpul-reservation-title' }, 'Reservasi masuk'),
          h('p', null, `${activeRegistrations.length} masuk · ${rejectedRegistrations.length} ditolak`)),
        h('div', { className: 'kumpul-reservation-head-actions' },
          editable ? h(PlanRefreshButton, { props, compact: true }) : null,
        h('button', {
          type: 'button',
          className: 'kumpul-reservation-close',
          'data-kumpul-reservation-close': '',
          'aria-label': 'Tutup panel reservasi',
        }, '×'))),
      h('div', { className: 'kumpul-reservation-body' },
        h('div', { className: 'kumpul-reservation-filters', role: 'group', 'aria-label': 'Filter reservasi' },
          ...[
            ['RSVP_CONFIRMED', 'Hadir'],
            ['REJECTED', 'Ditolak'],
            ['CANCELLED', 'Dibatalkan'],
          ].map(([status, label], index) => h('button', {
            key: status,
            type: 'button',
            'data-kumpul-reservation-filter': status,
            'aria-pressed': index === 0 ? 'true' : 'false',
          }, label))),
        h(PlanPeopleList, {
          registrations,
          props,
          filterable: true,
          selectAction: 'gathering.registrations.reject',
          selectable: (registration) => canReject && registration.can_reject,
          selectionVisible: false,
          rowScopes: true,
          selectionMessage: '',
          rowActions: (registration) => registration.can_reject && canReject
            ? [
              h('button', {
                type: 'button',
                key: 'reject',
                className: 'kumpul-reservation-delete',
                disabled: !intentEnabled(props, 'gathering.registrations.reject'),
                title: `Tolak reservasi ${text(registration.name, 'peserta')}`,
                'aria-label': `Tolak reservasi ${text(registration.name, 'peserta')}`,
                'data-kumpul-reservation-reject-open': '',
              },
              h('svg', {
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.8,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                'aria-hidden': 'true',
              },
              h('path', { d: 'M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6' }))),
              h('button', {
                type: 'button',
                key: 'reject-submit',
                hidden: true,
                disabled: !intentEnabled(props, 'gathering.registrations.reject'),
                'data-kumpul-reservation-reject-submit': '',
                // Modal "Tolak reservasi?" (alasan + konfirmasi) milik template menggantikan confirm() host.
                ...intentAttributes('gathering.registrations.reject', plan.key, { 'data-bagdja-confirmed': 'true' }),
              }, 'Tolak reservasi'),
            ]
            : [],
        }),
        h('p', {
          className: 'kumpul-reservation-empty',
          role: 'status',
          hidden: !registrations.length || registrations.some((registration) => reservationGroup(registration) === 'RSVP_CONFIRMED'),
          'data-kumpul-reservation-filter-empty': '',
        }, 'Tidak ada reservasi pada filter ini.')),
      // HP: CTA tahap ada di kaki bottom sheet reservasi (web: di baris aksi panel).
      editable && mobileReservationClose
        ? h('div', { className: 'kumpul-reservation-foot' }, mobileReservationClose)
        : null),
      canReject
        ? h('dialog', {
          className: 'kumpul-reservation-confirm-dialog',
          'data-kumpul-reservation-confirm-dialog': '',
          'aria-labelledby': 'kumpul-reservation-confirm-title',
          'aria-describedby': 'kumpul-reservation-confirm-description',
        },
        h('div', { className: 'kumpul-reservation-confirm-icon', 'aria-hidden': 'true' }, '!'),
        h('h4', { id: 'kumpul-reservation-confirm-title' }, 'Tolak reservasi?'),
        h('p', { id: 'kumpul-reservation-confirm-description' },
          'Reservasi ',
          h('strong', { 'data-kumpul-reservation-confirm-name': '' }, 'peserta'),
          ' akan ditolak. Pilih alasan untuk disampaikan kepada peserta.'),
        h('fieldset', { className: 'kumpul-reservation-reasons' },
          h('legend', null, 'Alasan penolakan'),
          ...[
            ['capacity', 'Kapasitas peserta sudah penuh'],
            ['incomplete', 'Data reservasi tidak lengkap'],
            ['unavailable', 'Jadwal atau pilihan tidak tersedia'],
            ['requirements', 'Tidak memenuhi ketentuan acara'],
            ['custom', 'Alasan lainnya'],
          ].map(([value, label]) => h('label', { key: value, className: 'kumpul-reservation-reason-option' },
            h('input', {
              type: 'radio',
              name: 'kumpul-reservation-rejection-reason',
              value: value === 'custom' ? 'custom' : label,
              required: true,
              defaultChecked: false,
              'data-kumpul-reservation-reason-option': '',
            }),
            h('span', null, label)))),
        h('textarea', {
          className: 'kumpul-reservation-custom-reason',
          rows: 3,
          maxLength: 2000,
          placeholder: 'Tuliskan alasan penolakan',
          'aria-label': 'Alasan penolakan lainnya',
          hidden: true,
          'data-kumpul-reservation-custom-reason': '',
        }),
        h('div', { className: 'kumpul-reservation-confirm-actions' },
          h('button', {
            type: 'button',
            className: 'kumpul-reservation-confirm-cancel',
            'data-kumpul-reservation-confirm-cancel': '',
          }, 'Kembali'),
          h('button', {
            type: 'button',
            className: 'kumpul-reservation-confirm-submit',
            disabled: true,
            'data-kumpul-reservation-confirm-submit': '',
          }, 'Tolak reservasi')))
        : null);
    return withActions('INVITATION_CONFIRMATION', editable, [
      h(PlanRefreshRow, { key: 'help', props, enabled: editable },
        h('p', { className: 'kumpul-plan-sim-help' }, `Peserta hadir ${activeRegistrations.length} (${minMax}). Jumlah harus memenuhi batas produk sebelum RSVP ditutup.`),
        h('p', { className: 'kumpul-plan-sim-help' }, 'Tinjau dan kelola reservasi yang masuk sebelum membuka pembayaran.')),
      h(InvitationShareCard, { key: 'share', plan }),
      reservationDialog,
      closeReservationsDialog,
    ], {
      primary: reservationOpen,
      desktopActions: [
        reservationOpen,
        desktopReservationClose,
        desktopCancelTrigger,
      ],
    });
  };

  const paymentPanel = (editable) => {
    const canCheckout = editable && has('gathering.registrations.checkout');
    const deposit = Number(occurrence.deposit_amount_per_seat) || 0;
    // Daftar pembayaran = peserta hadir + yang sudah direfund (tetap terlihat di tab Refund).
    const paymentRegistrations = registrations.filter((registration) => registration.registration_status === 'RSVP_CONFIRMED'
      || text(registration.payment_status) === 'REFUNDED');
    const countOf = (group) => paymentRegistrations.filter((registration) => paymentGroup(registration) === group).length;
    const unpaidCount = countOf('UNPAID');
    // Tab awal: Belum bayar bila masih ada, selain itu tab pertama yang berisi.
    const initialGroup = (PAYMENT_FILTERS.find(([group]) => group === 'UNPAID' && unpaidCount)
      || PAYMENT_FILTERS.find(([group]) => countOf(group))
      || PAYMENT_FILTERS[0])[0];
    const checkoutButton = canCheckout
      ? button('gathering.registrations.checkout', 'Bayarkan peserta terpilih', { key: 'checkout' }, 'kumpul-plan-sim-secondary kumpul-payment-checkout')
      : null;
    const canConfirmEvent = editable && has('gathering.event.confirm');
    // Web: Konfirmasi acara di baris aksi panel. HP: di kaki sheet pembayaran (seperti Tutup reservasi).
    // Kedua tombol hanya membuka modal konfirmasi Kumpul; intent ada di modal (`data-bagdja-confirmed`
    // → host tidak menampilkan confirm() bawaan browser).
    const confirmEventOpener = (key, className) => h('button', {
      key,
      type: 'button',
      className,
      disabled: !intentEnabled(props, 'gathering.event.confirm'),
      'data-kumpul-sheet-open': 'confirm-event',
      'aria-haspopup': 'dialog',
    }, 'Konfirmasi acara');
    const desktopConfirm = canConfirmEvent ? confirmEventOpener('confirm', 'kumpul-plan-sim-primary') : null;
    const mobileConfirm = canConfirmEvent ? confirmEventOpener('confirm-mobile', 'kumpul-plan-sim-primary kumpul-payment-confirm-mobile') : null;
    const confirmEventDialog = canConfirmEvent
      ? h('dialog', {
        key: 'confirm-event-dialog',
        className: 'kumpul-reservation-confirm-dialog is-accent',
        'data-kumpul-invite-sheet': 'confirm-event',
        'aria-labelledby': 'kumpul-confirm-event-title',
        'aria-describedby': 'kumpul-confirm-event-description',
      },
      h('div', { className: 'kumpul-reservation-confirm-icon', 'aria-hidden': 'true' }, '✓'),
      h('h4', { id: 'kumpul-confirm-event-title' }, 'Konfirmasi acara?'),
      h('p', { id: 'kumpul-confirm-event-description' },
        h('strong', null, `${paidRegistrations.length} dari ${activeRegistrations.length} peserta lunas`),
        '. Acara dikonfirmasi dengan opsi final berikut:'),
      // Diisi client.js dari radio Opsi final yang tercentang saat modal dibuka.
      h('ul', { className: 'kumpul-close-rsvp-points', 'data-kumpul-final-summary': '' },
        h('li', null, 'Opsi final sesuai pilihan di tahap ini')),
      h('p', null, deposit
        ? `DP ${formatCurrency(deposit * paidRegistrations.length)} dicairkan ke penyelenggara setelah acara dikonfirmasi.`
        : 'Peserta menerima pemberitahuan bahwa acara sudah dikonfirmasi.'),
      h('div', { className: 'kumpul-reservation-confirm-actions' },
        h('button', { type: 'button', className: 'kumpul-reservation-confirm-cancel', 'data-kumpul-sheet-close': '' }, 'Kembali'),
        h('button', {
          type: 'button',
          className: 'kumpul-reservation-confirm-submit',
          disabled: !intentEnabled(props, 'gathering.event.confirm'),
          ...intentAttributes('gathering.event.confirm', plan.key, { 'data-bagdja-confirmed': 'true' }),
        }, 'Ya, konfirmasi acara')))
      : null;
    const paymentOpen = h('button', {
      key: 'payment-open',
      type: 'button',
      className: 'kumpul-plan-sim-soft',
      'data-kumpul-reservation-open': '',
      'aria-haspopup': 'dialog',
      'aria-controls': 'kumpul-payment-dialog',
    },
    'Lihat Pembayaran',
    h('span', { className: 'kumpul-reservation-count' }, `${paidRegistrations.length} lunas`),
    unpaidCount ? h('span', { className: 'kumpul-reservation-count is-rejected' }, `${unpaidCount} belum`) : null);
    const paymentDialog = h('dialog', {
      key: 'payment-dialog',
      id: 'kumpul-payment-dialog',
      className: 'kumpul-reservation-dialog kumpul-payment-dialog',
      'data-kumpul-reservation-dialog': '',
      'aria-labelledby': 'kumpul-payment-title',
    },
    h('div', { className: 'kumpul-reservation-head' },
      h('div', null,
        h('h4', { id: 'kumpul-payment-title' }, 'Pembayaran peserta'),
        h('p', null, `${paidRegistrations.length} lunas dari ${activeRegistrations.length} peserta · ${minMax}`)),
      h('div', { className: 'kumpul-reservation-head-actions' },
        editable ? h(PlanRefreshButton, { props, compact: true }) : null,
        h('button', {
          type: 'button',
          className: 'kumpul-reservation-close',
          'data-kumpul-reservation-close': '',
          'aria-label': 'Tutup panel pembayaran',
        }, '×'))),
    h('div', { className: 'kumpul-reservation-body' },
      h('div', { className: 'kumpul-reservation-filters', role: 'group', 'aria-label': 'Filter pembayaran' },
        ...PAYMENT_FILTERS.map(([group, label]) => h('button', {
          key: group,
          type: 'button',
          'data-kumpul-reservation-filter': group,
          'aria-pressed': group === initialGroup ? 'true' : 'false',
        }, label, h('span', { className: 'kumpul-payment-filter-count' }, String(countOf(group)))))),
      canCheckout && unpaidCount
        ? h('p', { className: 'kumpul-plan-sim-help kumpul-payment-hint' }, 'Centang peserta yang ingin Anda bayarkan, lalu tekan "Bayarkan peserta terpilih".')
        : null,
      h(PlanPeopleList, {
        registrations: paymentRegistrations,
        props,
        filterable: true,
        groupOf: paymentGroup,
        initialGroup,
        selectAction: 'gathering.registrations.checkout',
        selectable: (registration) => canCheckout && registration.can_checkout,
        rowActions: editable ? (registration) => [
          registration.can_cancel_checkout && has('gathering.registration.cancel_checkout')
            ? h('button', {
              type: 'button',
              key: 'cancel',
              disabled: !intentEnabled(props, 'gathering.registration.cancel_checkout'),
              ...intentAttributes('gathering.registration.cancel_checkout', plan.key, { 'data-bagdja-target': registration.key }),
            }, 'Batalkan checkout')
            : null,
          registration.can_refund && has('gathering.registration.refund')
            ? h('button', {
              type: 'button',
              key: 'refund',
              disabled: !intentEnabled(props, 'gathering.registration.refund'),
              ...intentAttributes('gathering.registration.refund', plan.key, { 'data-bagdja-target': registration.key }),
            }, 'Refund')
            : null,
        ] : null,
      }),
      h('p', {
        className: 'kumpul-reservation-empty',
        role: 'status',
        hidden: !paymentRegistrations.length || countOf(initialGroup) > 0,
        'data-kumpul-reservation-filter-empty': '',
      }, 'Tidak ada peserta pada filter ini.')),
    // Kaki dialog (web & HP): bayarkan peserta yang dicentang di daftar ini.
    checkoutButton || mobileConfirm
      ? h('div', { className: `kumpul-reservation-foot kumpul-payment-foot${checkoutButton ? '' : ' is-mobile-only'}` }, checkoutButton, mobileConfirm)
      : null);

    const resendButton = has('gathering.invoices.resend')
      ? button('gathering.invoices.resend', 'Kirim ulang invoice', { key: 'resend' }, 'kumpul-plan-sim-secondary')
      : null;
    return withActions('PAYMENT_CONFIRMATION', editable, [
      h(PlanRefreshRow, { key: 'help', props, enabled: editable },
        h('p', { className: 'kumpul-plan-sim-help' },
          `Peserta lunas ${paidRegistrations.length} dari ${activeRegistrations.length} (${minMax}).`,
          deposit ? ` DP ${formatCurrency(deposit * paidRegistrations.length)} dicairkan ke penyelenggara saat acara dikonfirmasi.` : ''),
        h('p', { className: 'kumpul-plan-sim-help' }, 'Kelola pembayaran peserta lewat tombol Lihat Pembayaran.')),
      h(PlanOperationNotice, { key: 'operation', operation, kinds: ['INVOICE_ISSUANCE'] }),
      // Ringkasan baca saja / tanpa aksi tetap bisa membuka daftar pembayaran.
      editable ? null : h('div', { key: 'payment-open-readonly', className: 'kumpul-plan-sim-actions' }, paymentOpen),
      paymentDialog,
      confirmEventDialog,
      h(PlanVoteResults, { key: 'votes', options, openedIds, occurrence }),
      h(PlanFinalOptionPicker, { key: 'final', options, openedIds, occurrence, selectable: editable && has('gathering.event.confirm') }),
    ], {
      // HP: aksi utama hanya Lihat Pembayaran; bayar & Konfirmasi acara ada di kaki sheet pembayaran.
      primary: paymentOpen,
      secondary: [resendButton],
      // Web: Diskusikan | Kirim ulang invoice | Batalkan acara | Lihat Pembayaran | Konfirmasi acara.
      desktopActions: [resendButton, desktopCancelTrigger, paymentOpen, desktopConfirm],
    });
  };

  const panels = [planPanel, invitationsPanel, confirmationPanel, paymentPanel];
  return h('section', {
    className: 'kumpul-plan-simulator kumpul-plan-live',
    'aria-label': 'Tahapan gathering',
    'data-plan-live': '',
    'data-current-step': finished ? 'DONE' : plan.workflow_step,
  },
  h('div', { className: 'kumpul-plan-simulator-heading' },
    h('div', null,
      h('p', { className: 'kumpul-eyebrow' }, 'Kelola rencana'),
      h('h2', null, finished ? 'Rencana selesai diproses' : `Tahap ${currentIndex + 1}: ${gatheringWorkflowSteps[currentIndex].label}`),
      h('p', null, 'Klik tahap sebelumnya untuk melihat ringkasan yang sudah diisi.'))),
  h('ol', { className: 'kumpul-plan-sim-steps', 'aria-label': 'Tahapan gathering' },
    ...gatheringWorkflowSteps.map((step, index) => h('li', {
      key: step.key,
      className: finished || index < currentIndex ? 'is-complete' : index === currentIndex ? 'is-current' : '',
    },
    h('button', {
      type: 'button',
      'data-plan-step-tab': step.key,
      'aria-current': index === currentIndex ? 'step' : undefined,
      'aria-pressed': index === currentIndex ? 'true' : 'false',
      disabled: index > currentIndex,
    },
    h('span', null, finished || index < currentIndex ? '✓' : String(index + 1)),
    h('span', null, step.label))))),
  ...gatheringWorkflowSteps.map((step, index) => {
    const editable = !finished && index === currentIndex;
    return h('div', {
      key: step.key,
      className: 'kumpul-plan-sim-panel',
      'data-plan-step-panel': step.key,
      hidden: index !== currentIndex,
    },
    h('h3', null, `${index + 1}. ${step.label}`),
    index < currentIndex || finished ? h('p', { className: 'kumpul-plan-live-readonly' }, 'Ringkasan tahap yang sudah dilewati — tidak dapat diubah.') : null,
    panels[index](editable));
  }),
  // Batalkan acara (web) kini ada di baris CTA setiap tahap (withActions).
  cancelAvailable
    ? h(CancelGatheringDialog, {
      confirmButton: button('gathering.cancel', 'Ya, batalkan acara', { 'data-bagdja-confirmed': 'true' }, 'kumpul-plan-live-danger'),
      confirmed: plan.status === 'CONFIRMED',
    })
    : null,
  );
}

/** id checkbox pembuka popup "Batalkan acara" — satu per halaman. */
const CANCEL_DIALOG_TOGGLE_ID = 'kumpul-cancel-dialog-toggle';

/**
 * Popup konfirmasi batal acara (gaya sama dengan popup "Kirim undangan"). Memakai checkbox + label
 * sehingga tetap jalan tanpa JavaScript template. Tombol konfirmasi membawa `data-bagdja-confirmed`
 * sehingga host tidak lagi menampilkan window.confirm.
 */
function CancelGatheringDialog({ confirmButton, confirmed }) {
  return h(React.Fragment, null,
    h('input', { type: 'checkbox', id: CANCEL_DIALOG_TOGGLE_ID, className: 'kumpul-sheet-toggle kumpul-modal-toggle', 'aria-label': 'Buka konfirmasi batalkan acara' }),
    h('label', { htmlFor: CANCEL_DIALOG_TOGGLE_ID, className: 'kumpul-modal-backdrop', 'aria-hidden': 'true' }),
    h('div', {
      className: 'kumpul-modal',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-labelledby': 'kumpul-cancel-dialog-title',
      'aria-describedby': 'kumpul-cancel-dialog-description',
      'data-bagdja-scope': '',
    },
    h('span', { className: 'kumpul-modal-icon is-danger', 'aria-hidden': 'true' }, '!'),
    h('h2', { id: 'kumpul-cancel-dialog-title' }, 'Batalkan acara?'),
    h('p', { id: 'kumpul-cancel-dialog-description' }, confirmed
      ? 'Acara akan dibatalkan. Sisa dana peserta yang masih ditahan di escrow akan direfund; DP yang sudah dicairkan ke penyelenggara tidak ikut direfund.'
      : 'Acara akan dibatalkan dan proses refund ke peserta dijalankan sesuai kebijakan. Tindakan ini tidak dapat diurungkan.'),
    h('label', { className: 'kumpul-modal-field' }, 'Alasan pembatalan (opsional)',
      h('input', { type: 'text', maxLength: 500, placeholder: 'Dibatalkan oleh initiator', 'data-bagdja-field': 'reason' })),
    h('div', { className: 'kumpul-modal-actions' },
      h('label', { htmlFor: CANCEL_DIALOG_TOGGLE_ID, className: 'kumpul-modal-secondary', role: 'button', tabIndex: 0 }, 'Kembali'),
      confirmButton),
    ),
  );
}

/** QR code SVG (server-side, tetap tampil tanpa JavaScript). null bila teks tidak bisa dikodekan. */
function QrCodeSvg({ value, label }) {
  let modules;
  try {
    modules = QRCodeCore.create(value, { errorCorrectionLevel: 'M' }).modules;
  } catch {
    return null;
  }
  const { size, data } = modules;
  const quiet = 2;
  let d = '';
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (data[row * size + col]) d += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }
  const box = size + quiet * 2;
  return h('svg', {
    className: 'kumpul-invite-qr',
    viewBox: `0 0 ${box} ${box}`,
    role: 'img',
    'aria-label': label,
    shapeRendering: 'crispEdges',
  },
  h('rect', { width: box, height: box, fill: '#fff' }),
  h('path', { d, fill: '#111' }));
}

/**
 * Kartu undangan seperti yang dilihat peserta: banner, judul, teks, jadwal — plus QR & tautan
 * undangan terbuka bila tersedia (rencana OPEN setelah undangan dikirim).
 */
/** Teks undangan: HTML ringan tersanitasi Bagdja bila ada, selain itu teks polos (baris dipertahankan). */
function InvitationDescription({ plan }) {
  const html = text(plan.invitation_description_html);
  if (html) return h('div', { className: 'kumpul-invite-description is-rich', dangerouslySetInnerHTML: { __html: html } });
  const plain = text(plan.invitation_description);
  return plain ? h('p', { className: 'kumpul-invite-description' }, plain) : null;
}

/** Nilai awal editor: HTML editor apa adanya; teks polos lama → paragraf (di-escape). */
function invitationEditorHtml(plan) {
  const html = text(plan.invitation_description_html);
  if (html) return html;
  const plain = text(plan.invitation_description);
  if (!plain) return '';
  const escape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return plain.split(/\n{2,}/).map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, '<br>')}</p>`).join('');
}

function InvitationShareCard({ plan }) {
  const occurrence = plan.occurrence || {};
  const banner = text(plan.invitation_banner_url);
  const shareUrl = plan.invite_policy === 'OPEN' ? text(plan.public_invitation_url) : '';
  const shareHref = plan.invite_policy === 'OPEN' ? text(plan.public_invitation_href) : '';
  return h('section', { className: 'kumpul-invite-share', 'aria-label': 'Undangan gathering' },
    h('article', { className: 'kumpul-invite-share-card' },
      banner ? h('img', { className: 'kumpul-invite-banner', src: banner, alt: `Banner ${text(plan.title, 'undangan')}`, loading: 'lazy' }) : null,
      h('div', { className: 'kumpul-invite-share-body' },
        h('p', { className: 'kumpul-eyebrow' }, plan.invite_policy === 'OPEN' ? 'Undangan terbuka' : 'Undangan khusus'),
        h('h4', null, text(plan.title, 'Rencana gathering')),
        h(InvitationDescription, { plan }),
        h('p', { className: 'kumpul-invite-share-meta' },
          `Acara: ${planDateTime(occurrence.final_schedule)} · RSVP sampai ${planDateTime(occurrence.rsvp_close_at)}`),
      )),
    shareUrl || shareHref
      ? h('div', { className: 'kumpul-invite-share-qr' },
        shareUrl ? h(QrCodeSvg, { value: shareUrl, label: 'QR code undangan terbuka' }) : null,
        h('div', null,
          h('strong', null, 'Bagikan undangan'),
          h('p', null, shareUrl
            ? 'Pindai QR atau bagikan tautan ini ke calon peserta. Siapa pun dengan tautan bisa RSVP.'
            : 'Bagikan tautan halaman undangan ke calon peserta. Siapa pun dengan tautan bisa RSVP.'),
          shareUrl ? h('code', { className: 'kumpul-invite-share-url' }, shareUrl) : null,
          // Bagikan/salin dijalankan host Bagdja (iframe sandbox tak punya izin share/clipboard).
          h('div', { className: 'kumpul-invite-share-actions' },
            h('button', {
              type: 'button',
              className: 'kumpul-invite-share-btn is-primary',
              'data-bagdja-share': 'share',
              'data-bagdja-share-url': shareUrl || shareHref,
              'data-bagdja-share-title': text(plan.title, 'Undangan gathering'),
            }, h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M12 3v12m0-12-4 4m4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6' })), 'Bagikan'),
            h('button', {
              type: 'button',
              className: 'kumpul-invite-share-btn',
              'data-bagdja-share': 'copy',
              'data-bagdja-share-url': shareUrl || shareHref,
            }, h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M9 9h10v12H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1' })), 'Salin tautan'),
            h('a', { className: 'kumpul-invite-share-btn is-ghost', href: shareHref || shareUrl },
              h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, h('path', { d: 'M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' })),
              'Buka halaman undangan'))))
      : null,
  );
}

/** id checkbox pembuka sheet "Ringkasan gathering" (HP) — satu per halaman. */
const PLAN_SUMMARY_TOGGLE_ID = 'kumpul-plan-summary-toggle';

/**
 * Bar bawah HP untuk halaman rencana: tombol Ringkasan (membuka sheet ringkasan),
 * Lainnya (sheet CTA sekunder + batal), dan CTA primer tahap. Sheet memakai checkbox + label
 * sehingga tetap berfungsi walau JavaScript template tidak dimuat. Disembunyikan di desktop.
 */
function PlanMobileBar({ step, primary = [], secondary = [], cancel = null, discuss = null }) {
  const primaries = [].concat(primary).filter(Boolean);
  const moreId = `kumpul-plan-more-${slug(step)}`;
  const hasMore = secondary.length > 0 || Boolean(cancel);
  return h('div', { className: 'kumpul-plan-mobile' },
    hasMore ? h('input', { type: 'checkbox', id: moreId, className: 'kumpul-sheet-toggle', 'aria-label': 'Buka aksi lainnya' }) : null,
    hasMore ? h('label', { htmlFor: moreId, className: 'kumpul-sheet-backdrop', 'aria-hidden': 'true' }) : null,
    hasMore
      ? h('div', { className: 'kumpul-sheet', role: 'dialog', 'aria-label': 'Aksi lainnya' },
        h('div', { className: 'kumpul-sheet-head' },
          h('strong', null, 'Aksi lainnya'),
          h('label', { htmlFor: moreId, className: 'kumpul-sheet-close' }, 'Tutup')),
        h('div', { className: 'kumpul-sheet-actions' }, ...secondary),
        cancel)
      : null,
    h('div', { className: 'kumpul-plan-mobilebar', role: 'toolbar', 'aria-label': 'Aksi rencana' },
      h('label', { htmlFor: PLAN_SUMMARY_TOGGLE_ID, className: 'kumpul-plan-mobilebar-icon' },
        h(Icon, { name: 'info' }), h('span', null, 'Ringkasan')),
      // Diskusikan (chat penyelenggara) jadi tombol utama bar, berdampingan dengan CTA tahap.
      // Dua CTA utama → Diskusikan cukup ikon agar tetap muat di layar sempit.
      discuss || primaries.length
        ? h('div', { className: `kumpul-plan-mobilebar-primary${primaries.length > 1 ? ' is-compact' : ''}` }, discuss, ...primaries)
        : null,
      hasMore
        ? h('label', { htmlFor: moreId, className: 'kumpul-plan-mobilebar-icon' },
          h(Icon, { name: 'more' }), h('span', null, 'Lainnya'))
        : null,
    ),
  );
}

/** Banner + teks undangan: form di tahap Buat undangan, tampilan baca saja setelahnya. */
function InvitationAppearance({ plan, editable }) {
  const banner = text(plan.invitation_banner_url);
  const description = text(plan.invitation_description);
  if (!editable) {
    if (!banner && !description) return null;
    return h('section', { className: 'kumpul-invite-appearance is-readonly', 'aria-label': 'Tampilan undangan' },
      h('h4', null, 'Tampilan undangan'),
      banner ? h('img', { className: 'kumpul-invite-banner', src: banner, alt: 'Banner undangan', loading: 'lazy' }) : null,
      h(InvitationDescription, { plan }));
  }
  // Tanpa scope sendiri: tombol Simpan (aksi sekunder) & Kirim undangan ada di scope panel yang sama.
  return h('fieldset', { className: 'kumpul-invite-appearance' },
    h('legend', null, 'Tampilan undangan'),
    h('p', { className: 'kumpul-plan-sim-help' }, 'Banner dan teks ini tampil di halaman undangan yang dibuka peserta.'),
    h('div', { className: 'kumpul-invite-appearance-grid' },
      h('div', { className: 'kumpul-invite-banner-field' },
      h('img', {
        className: 'kumpul-invite-banner',
        ...(banner ? { src: banner } : {}),
        alt: 'Pratinjau banner undangan',
        loading: 'lazy',
        hidden: !banner,
        'data-invitation-banner-preview': '',
      }),
      h('div', {
        className: 'kumpul-invite-banner-empty',
        'aria-hidden': 'true',
        hidden: Boolean(banner),
        'data-invitation-banner-empty': '',
      }, 'Belum ada banner'),
      banner
        ? h('label', { className: 'kumpul-invite-remove' },
          h('input', { type: 'checkbox', 'data-bagdja-field': 'invitation.removeBanner' }),
          'Hapus banner ini')
        : null,
      h('label', null, banner ? 'Ganti banner (opsional)' : 'Banner undangan (opsional)',
        h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', 'data-bagdja-field': 'invitation.banner' }),
        h('small', null, 'JPG, PNG, atau WebP, maksimal 5 MB. Ukuran 1600×700 px paling pas.')),
      h('p', {
        className: 'kumpul-plan-sim-error',
        role: 'alert',
        hidden: true,
        'data-invitation-banner-error': '',
      })),
      // Editor ringan (Tiptap, client.js) menulis HTML ke textarea field; tanpa JS textarea tetap dipakai.
      h('div', { className: 'kumpul-invite-text-field kumpul-rich-field', 'data-kumpul-rich-editor': '' },
        h('span', { className: 'kumpul-rich-label' }, 'Teks undangan'),
        h('div', { className: 'kumpul-rich-box', hidden: true, 'data-rich-box': '' },
          h('div', { className: 'kumpul-rich-toolbar', role: 'toolbar', 'aria-label': 'Format teks undangan' },
            ...[
              ['bold', 'B', 'Tebal'],
              ['italic', 'I', 'Miring'],
              ['underline', 'U', 'Garis bawah'],
              ['bulletList', '•', 'Daftar berpoin'],
              ['orderedList', '1.', 'Daftar bernomor'],
              ['link', '🔗', 'Tautan'],
              ['clear', '⌫', 'Hapus format'],
            ].map(([command, label, title]) => h('button', {
              key: command,
              type: 'button',
              className: `kumpul-rich-btn is-${command}`,
              'data-rich-cmd': command,
              title,
              'aria-label': title,
              'aria-pressed': 'false',
            }, label))),
          h('div', { className: 'kumpul-rich-content', 'data-rich-content': '' })),
        h('textarea', {
          rows: 6,
          maxLength: 5000,
          defaultValue: invitationEditorHtml(plan),
          placeholder: 'Ceritakan rencana acara dan informasi penting untuk peserta.',
          'aria-label': 'Teks undangan',
          'data-bagdja-field': 'invitation.description',
          'data-rich-source': '',
        }),
        h('small', null, 'Bisa tebal, miring, daftar, dan tautan. Kosongkan untuk menghapus teks.'))),
    h('p', { className: 'kumpul-plan-sim-help' }, 'Perubahan otomatis tersimpan saat undangan dikirim.'),
  );
}

/** Jumlah suara opsi — adaptor: `{ [optionId]: n }`; bentuk lama: `{ [grup]: { options: { [id]: { votes, percentage } } } }`. */
function optionVotes(occurrence, option) {
  const results = occurrence.voting_results || {};
  const direct = results[option.product_option_id];
  if (typeof direct === 'number') return { votes: direct };
  const nested = results[option.option_group_key]?.options?.[String(option.product_option_id)];
  return nested && Number.isFinite(Number(nested.votes)) ? { votes: Number(nested.votes), percentage: nested.percentage } : null;
}

/**
 * Opsi yang dibuka dikelompokkan per kategori (urutan data) beserta suara peserta. `index` = posisi
 * di snapshot → popup detail `kumpul-plan-option-<index>` (dirender PlanOptionGroups di halaman ini).
 * Persentase dihitung dari total suara kategori bila adaptor tidak menyertakannya.
 */
function votedOptionGroups(options, openedIds, occurrence) {
  const groups = [];
  const byName = new Map();
  options.forEach((option, index) => {
    if (!openedIds.has(option.product_option_id)) return;
    const name = text(option.option_group_key, 'Pilihan');
    if (!byName.has(name)) {
      const group = { name, entries: [], total: 0 };
      byName.set(name, group);
      groups.push(group);
    }
    const vote = optionVotes(occurrence, option);
    const votes = vote ? Math.max(0, Number(vote.votes) || 0) : 0;
    byName.get(name).entries.push({ option, index, votes, percentage: vote?.percentage });
    byName.get(name).total += votes;
  });
  groups.forEach((group) => {
    const top = Math.max(0, ...group.entries.map((entry) => entry.votes));
    const leaders = group.entries.filter((entry) => entry.votes === top);
    group.entries.forEach((entry) => {
      const raw = entry.percentage !== undefined ? Number(entry.percentage) : group.total ? (entry.votes / group.total) * 100 : 0;
      entry.percentage = Math.max(0, Math.min(100, Math.round(Number.isFinite(raw) ? raw : 0)));
      // Unggul = suara terbanyak tunggal (seri / belum ada suara → tidak ada yang ditandai).
      entry.leading = top > 0 && leaders.length === 1 && leaders[0] === entry;
    });
  });
  return groups;
}

/** Isi kartu opsi bergaya undangan: foto | nama, ringkasan, bar suara, tombol ⓘ detail. */
function voteTileBody({ option, index, votes, percentage }, badge) {
  const images = list(option.image_urls).filter((url) => text(url));
  const imageUrl = images[0] || text(option.image_url);
  const title = text(option.label, text(option.option_key, 'Opsi gathering'));
  return [
    h('span', { key: 'thumb', className: 'kumpul-option-tile-thumb' },
      imageUrl ? h('img', { src: imageUrl, alt: '', loading: 'lazy' }) : h('span', { 'aria-hidden': 'true' }, h(Icon, { name: 'calendar' }))),
    h('span', { key: 'copy', className: 'kumpul-option-tile-copy' },
      h('strong', { className: 'kumpul-plan-option-name' }, title),
      badge ? h('span', { className: 'kumpul-plan-final-option' }, badge) : null,
      optionSummary(option.description, 90) ? h('span', { className: 'kumpul-option-tile-summary' }, optionSummary(option.description, 90)) : null,
      h('span', { className: 'kumpul-invite-vote-bar', role: 'img', 'aria-label': `${percentage}% suara` },
        h('span', { style: { width: `${percentage}%` } })),
      h('span', { className: 'kumpul-invite-vote-meta' }, `${percentage}% · ${votes} suara`)),
    h('button', {
      key: 'info',
      type: 'button',
      className: 'kumpul-plan-pick-info',
      'data-plan-option-open': `kumpul-plan-option-${index}`,
      'aria-haspopup': 'dialog',
      'aria-label': `Detail ${title}`,
      title: 'Lihat detail',
    }, 'i'),
  ];
}

/**
 * Tahap Konfirmasi pembayaran: ringkasan hasil voting — satu kartu per kategori berisi daftar opsi
 * (urut suara terbanyak) dengan persentase. Grid kartu menyesuaikan lebar layar, tanpa scroll samping.
 */
function PlanVoteResults({ options, openedIds, occurrence }) {
  const groups = votedOptionGroups(options, openedIds, occurrence);
  return h('section', { className: 'kumpul-plan-vote-section', 'data-plan-vote-results': '' },
    h('div', { className: 'kumpul-plan-vote-section-head' },
      h('h3', null, 'Hasil voting peserta'),
      h('p', null, 'Ringkasan perolehan suara tiap opsi dari peserta yang RSVP.')),
    groups.length
      ? h('div', { className: 'kumpul-vote-summary' },
        ...groups.map((group) => h('article', { key: group.name, className: 'kumpul-vote-card', 'aria-label': `Hasil voting ${group.name}` },
          h('header', { className: 'kumpul-vote-card-head' },
            h('h4', null, group.name),
            h('span', null, `${group.total} suara`)),
          h('ol', { className: 'kumpul-vote-card-list' },
            ...[...group.entries].sort((left, right) => right.votes - left.votes).map((entry) => {
              const title = text(entry.option.label, text(entry.option.option_key, 'Opsi gathering'));
              return h('li', { key: entry.option.product_option_id || entry.index, className: entry.leading ? 'is-leading' : undefined },
                h('div', { className: 'kumpul-vote-card-row' },
                  h('span', { className: 'kumpul-vote-card-name' }, title),
                  h('strong', { className: 'kumpul-vote-card-percent' }, `${entry.percentage}%`)),
                h('span', { className: 'kumpul-vote-card-bar', role: 'img', 'aria-label': `${title}: ${entry.percentage}% (${entry.votes} suara)` },
                  h('span', { style: { width: `${entry.percentage}%` } })),
                h('span', { className: 'kumpul-vote-card-meta' }, `${entry.votes} suara${entry.leading ? ' · terbanyak' : ''}`));
            })))))
      : h('p', { className: 'kumpul-plan-sim-help' }, 'Belum ada opsi yang dibuka untuk voting.'));
}

/**
 * Tahap Konfirmasi pembayaran: pilih opsi final per kategori dengan pengalaman yang sama seperti
 * undangan — satu baris per kategori, item digeser ke samping, opsi terpilih paling depan.
 * Belum ada opsi final → opsi bersuara terbanyak (tunggal) dicentang sebagai saran.
 */
function PlanFinalOptionPicker({ options, openedIds, occurrence, selectable }) {
  const groups = votedOptionGroups(options, openedIds, occurrence);
  return h('section', { className: 'kumpul-plan-vote-section', 'data-plan-final-options': '' },
    h('div', { className: 'kumpul-plan-vote-section-head' },
      h('h3', null, 'Opsi final gathering'),
      h('p', null, selectable
        ? 'Pilih satu opsi per kategori. Opsi ini dipakai saat acara dikonfirmasi.'
        : 'Opsi yang ditetapkan untuk acara.')),
    groups.length
      ? h('div', { className: 'kumpul-invite-pick' },
        ...groups.map((group, groupIndex) => {
          const hasFinal = group.entries.some((entry) => entry.option.is_final_selection === true);
          const isChosen = (entry) => (hasFinal ? entry.option.is_final_selection === true : entry.leading);
          const entries = [...group.entries].sort((left, right) => Number(isChosen(right)) - Number(isChosen(left)));
          return h('section', { key: group.name, className: 'kumpul-invite-vote-group' },
            h('div', { className: 'kumpul-plan-pick-head' },
              h('h4', null, group.name),
              h('span', null, `${group.entries.length} pilihan`)),
            h('ul', {
              className: 'kumpul-option-rail kumpul-invite-vote-rail',
              role: selectable ? 'radiogroup' : 'list',
              'aria-label': `Opsi final ${group.name}`,
            },
            ...entries.map((entry) => {
              const title = text(entry.option.label, text(entry.option.option_key, 'Opsi gathering'));
              const badge = entry.option.is_final_selection === true ? 'Opsi final' : entry.leading ? 'Suara terbanyak' : '';
              return h('li', { key: entry.option.product_option_id || entry.index, className: 'kumpul-invite-vote-item' }, selectable
                ? h('label', { className: 'kumpul-option-tile kumpul-invite-vote-tile' },
                  h('input', {
                    type: 'radio',
                    className: 'kumpul-invite-vote-radio',
                    name: `kumpul-final-${groupIndex}`,
                    value: entry.option.product_option_id,
                    defaultChecked: isChosen(entry),
                    'data-bagdja-field': 'optionKeys',
                    'aria-label': `Pilih ${title} sebagai opsi final`,
                  }),
                  ...voteTileBody(entry, badge))
                : h('div', { className: `kumpul-option-tile kumpul-invite-vote-tile is-readonly${entry.option.is_final_selection === true ? ' is-selected' : ''}` },
                  ...voteTileBody(entry, badge)));
            })));
        }))
      : h('p', { className: 'kumpul-plan-sim-help' }, 'Tidak ada pilihan yang perlu ditetapkan.'));
}

/** Potongan keterangan singkat untuk kartu opsi (teks polos, satu baris spasi). */
function optionSummary(value, limit = 140) {
  const plain = text(value).replace(/\s+/g, ' ').trim();
  return plain.length > limit ? `${plain.slice(0, limit - 1).trimEnd()}…` : plain;
}

/**
 * Pilihan per kategori (detail rencana & detail produk): judul kategori lalu kartu opsi yang
 * digeser ke samping — foto pertama | nama + potongan keterangan. Klik kartu membuka
 * `<dialog id=dialogId>` (handler `data-plan-option-open` di client.js). Urutan = urutan data.
 *
 * groups: [{ name, hidden?, items: [{ dialogId, label, summary?, imageUrl?, hidden?, badge?, optionId? }] }]
 */
function OptionItemRail({ groups, hidden = false }) {
  return h('div', {
    className: 'kumpul-plan-option-groups',
    'data-plan-opened-options': '',
    hidden,
  },
  ...groups.map((group) => h('section', {
    key: group.name,
    className: 'kumpul-option-rail-group',
    'data-plan-option-group': '',
    hidden: Boolean(group.hidden),
  },
  h('h3', null, group.name),
  h('div', { className: 'kumpul-option-rail', role: 'list' },
    ...group.items.map((item) => h('button', {
      key: item.dialogId,
      type: 'button',
      role: 'listitem',
      className: 'kumpul-option-tile',
      'data-plan-option-open': item.dialogId,
      ...(item.optionId !== undefined ? { 'data-plan-option-id': item.optionId } : {}),
      'aria-haspopup': 'dialog',
      'aria-controls': item.dialogId,
      hidden: Boolean(item.hidden),
    },
    h('span', { className: 'kumpul-option-tile-thumb' },
      item.imageUrl
        ? h('img', { src: item.imageUrl, alt: '', loading: 'lazy' })
        : h('span', { 'aria-hidden': 'true' }, h(Icon, { name: 'calendar' }))),
    h('span', { className: 'kumpul-option-tile-copy' },
      h('strong', { className: 'kumpul-plan-option-name' }, item.label),
      item.badge ? h('span', { className: 'kumpul-plan-final-option' }, item.badge) : null,
      item.summary ? h('span', { className: 'kumpul-option-tile-summary' }, item.summary) : null)))))));
}

/**
 * Galeri gambar di popup opsi: satu gambar biasa, lebih dari satu = carousel (geser/panah/titik).
 * Tap gambar → image viewer fullscreen (client.js, `data-option-image-open`).
 */
function OptionImageCarousel({ images, title }) {
  const urls = list(images).filter((url) => text(url));
  if (!urls.length) return null;
  const many = urls.length > 1;
  return h('div', { className: 'kumpul-option-carousel', 'data-option-carousel': '' },
    h('div', { className: 'kumpul-option-carousel-track', 'data-option-carousel-track': '' },
      ...urls.map((url, index) => h('button', {
        key: `${index}-${url}`,
        type: 'button',
        className: 'kumpul-option-carousel-slide',
        'data-option-image-open': String(index),
        'aria-label': `Lihat gambar ${index + 1} dari ${urls.length}`,
      },
      h('img', { src: url, alt: many ? `${title} ${index + 1}` : title, loading: index === 0 ? 'eager' : 'lazy' })))),
    many
      ? h(React.Fragment, null,
        h('button', { type: 'button', className: 'kumpul-option-carousel-nav is-prev', 'data-option-carousel-prev': '', 'aria-label': 'Gambar sebelumnya' }, '‹'),
        h('button', { type: 'button', className: 'kumpul-option-carousel-nav is-next', 'data-option-carousel-next': '', 'aria-label': 'Gambar berikutnya' }, '›'),
        h('div', { className: 'kumpul-option-carousel-dots', 'aria-hidden': 'true' },
          ...urls.map((url, index) => h('span', { key: index, 'data-option-carousel-dot': String(index), ...(index === 0 ? { 'data-active': '' } : {}) }))))
      : null);
}

/** Popup detail satu opsi. `children` = detail tambahan (ketersediaan, benefit, suara). */
function OptionDetailDialog({ id, images, groupLabel, title, badge, descriptionHtml, description, venue, address, mapUrl, children }) {
  return h('dialog', {
    id,
    className: 'kumpul-plan-option-dialog',
    'data-plan-option-dialog': '',
    'aria-labelledby': `${id}-title`,
  },
  h(OptionImageCarousel, { images, title }),
  h('div', { className: 'kumpul-plan-option-dialog-body' },
    h('div', { className: 'kumpul-plan-option-dialog-head' },
      h('div', null,
        h('span', { className: 'kumpul-plan-option-group' }, groupLabel),
        h('h3', { id: `${id}-title` }, title)),
      h('button', { type: 'button', className: 'kumpul-plan-option-dialog-close', 'data-plan-option-close': '', 'aria-label': 'Tutup detail pilihan' }, '×')),
    badge ? h('span', { className: 'kumpul-plan-final-option' }, badge) : null,
    // HTML ringan tersanitasi Bagdja (descriptionHtml); selain itu teks polos.
    text(descriptionHtml)
      ? h('div', { className: 'kumpul-plan-option-rich', dangerouslySetInnerHTML: { __html: text(descriptionHtml) } })
      : h('p', { className: 'kumpul-plan-option-plain' }, text(description) || 'Detail pilihan belum ditambahkan.'),
    text(venue) ? h('p', { className: 'kumpul-plan-option-venue' }, text(venue)) : null,
    h(VenueDetails, { address, mapUrl }),
    children));
}

/**
 * Tahap Atur rencana: pilih opsi produk yang dibuka. Kategori digeser ke samping (satu kolom per
 * kategori), item tersusun ke bawah dengan model kartu yang sama seperti detail produk, plus centang.
 * Tap kartu = centang/lepas; tombol ⓘ membuka popup detail (`kumpul-plan-option-<index>`, dirender
 * ringkasan "Pilihan dari produk" di halaman yang sama dengan urutan snapshot yang sama).
 */
function PlanOptionPicker({ options, openedIds }) {
  const groups = [];
  const byName = new Map();
  options.forEach((option, index) => {
    const name = text(option.option_group_key, 'Pilihan');
    if (!byName.has(name)) {
      const group = { name, entries: [] };
      byName.set(name, group);
      groups.push(group);
    }
    byName.get(name).entries.push({ option, index });
  });
  return h('div', { className: 'kumpul-plan-pick' },
    ...groups.map((group) => h('section', { key: group.name, className: 'kumpul-plan-pick-group' },
      h('div', { className: 'kumpul-plan-pick-head' },
        h('h4', null, group.name),
        h('span', null, `${group.entries.length} pilihan`)),
      h('ul', { className: 'kumpul-plan-pick-list' },
        ...group.entries.map(({ option, index }) => {
          const images = list(option.image_urls).filter((url) => text(url));
          const imageUrl = images[0] || text(option.image_url);
          const title = text(option.label, text(option.option_key, 'Opsi gathering'));
          return h('li', { key: option.product_option_id || index },
            h('label', { className: 'kumpul-option-tile kumpul-plan-pick-item' },
              h('input', {
                type: 'checkbox',
                className: 'kumpul-plan-pick-check',
                value: option.product_option_id,
                defaultChecked: openedIds.has(option.product_option_id),
                'data-bagdja-field': 'optionKeys',
                'aria-label': `Buka pilihan ${title}`,
              }),
              h('span', { className: 'kumpul-option-tile-thumb' },
                imageUrl
                  ? h('img', { src: imageUrl, alt: '', loading: 'lazy' })
                  : h('span', { 'aria-hidden': 'true' }, h(Icon, { name: 'calendar' }))),
              h('span', { className: 'kumpul-option-tile-copy' },
                h('strong', { className: 'kumpul-plan-option-name' }, title),
                optionSummary(option.description) ? h('span', { className: 'kumpul-option-tile-summary' }, optionSummary(option.description)) : null,
                text(option.venue_location) ? h('span', { className: 'kumpul-plan-pick-venue' }, text(option.venue_location)) : null),
              h('button', {
                type: 'button',
                className: 'kumpul-plan-pick-info',
                'data-plan-option-open': `kumpul-plan-option-${index}`,
                'aria-haspopup': 'dialog',
                'aria-label': `Detail ${title}`,
                title: 'Lihat detail',
              }, 'i')));
        })))));
}

/**
 * Pilihan rencana dikelompokkan per kategori sesuai urutan data (tidak diurutkan ulang).
 * Semua opsi dirender (yang belum dibuka `hidden`) agar simulator preview cukup menampilkan/menyembunyikan baris.
 */
function PlanOptionGroups({ options, openedIds, occurrence }) {
  const groups = [];
  const byName = new Map();
  options.forEach((option, index) => {
    const name = text(option.option_group_key, 'Pilihan');
    if (!byName.has(name)) {
      const group = { name, entries: [] };
      byName.set(name, group);
      groups.push(group);
    }
    byName.get(name).entries.push({ option, index });
  });
  const dialogId = (index) => `kumpul-plan-option-${index}`;
  const optionTitle = (option) => text(option.label, text(option.option_key, 'Opsi gathering'));
  const isOpen = (option) => openedIds.has(option.product_option_id);
  const imagesOf = (option) => {
    const urls = list(option.image_urls).filter((url) => text(url));
    return urls.length ? urls : text(option.image_url) ? [text(option.image_url)] : [];
  };
  return h(React.Fragment, null,
    h(OptionItemRail, {
      hidden: !options.some(isOpen),
      groups: groups.map((group) => ({
        name: group.name,
        hidden: !group.entries.some(({ option }) => isOpen(option)),
        items: group.entries.map(({ option, index }) => ({
          dialogId: dialogId(index),
          optionId: text(option.product_option_id),
          label: optionTitle(option),
          summary: optionSummary(option.description),
          imageUrl: imagesOf(option)[0] || '',
          hidden: !isOpen(option),
          badge: option.is_final_selection ? 'Final' : '',
        })),
      })),
    }),
    ...options.map((option, index) => {
      const vote = optionVotes(occurrence, option);
      return h(OptionDetailDialog, {
        key: `dialog-${option.product_option_id || index}`,
        id: dialogId(index),
        images: imagesOf(option),
        groupLabel: text(option.option_group_key, 'Pilihan'),
        title: optionTitle(option),
        badge: option.is_final_selection ? 'Opsi final' : '',
        descriptionHtml: option.description_html,
        description: option.description,
        venue: option.venue_location,
        address: option.venue_address,
        mapUrl: option.venue_map_url,
      },
      vote
        ? h('span', { className: 'kumpul-plan-votes' }, `${vote.votes} suara${vote.percentage !== undefined ? ` · ${vote.percentage}%` : ''}`)
        : null);
    }));
}

/**
 * Detail produk gathering (props.page `product_detail`, contractVersion 1). Pilihan paket memakai
 * kartu kategori yang sama dengan detail rencana: urutan data, satu gambar per kategori, daftar
 * bernomor, popup detail per opsi. CTA lewat intent host (Bagdja membuat rencana / membuka chat).
 */
function ProductDetailSection({ props }) {
  const product = (props.kumpulPage && props.kumpulPage.product) || {};
  const related = list(props.kumpulPage && props.kumpulPage.related);
  const images = list(product.images);
  const groups = list(product.option_groups);
  const canPlan = intentEnabled(props, 'gathering.plan.create');
  const canChat = intentEnabled(props, 'product.chat.open');
  const deposit = Number(product.deposit_amount);
  const facts = [
    Number.isFinite(deposit) && deposit > 0 ? ['DP per peserta', formatCurrency(deposit)] : null,
    product.min_attendees ? ['Minimum peserta', `${product.min_attendees} orang`] : null,
    product.max_attendees ? ['Maksimum peserta', `${product.max_attendees} orang`] : null,
    text(product.event_date_label) ? ['Jadwal', text(product.event_date_label)] : null,
    text(product.location) ? ['Lokasi', text(product.location)] : null,
  ].filter(Boolean);
  const planButton = (className, key) => h('button', {
    key,
    type: 'button',
    className,
    disabled: !canPlan,
    ...intentAttributes('gathering.plan.create', product.key),
  }, 'Rencanakan gathering');
  const chatButton = (className, key, label) => h('button', {
    key,
    type: 'button',
    className,
    disabled: !canChat,
    'aria-label': 'Tanya produk',
    ...intentAttributes('product.chat.open', product.key),
  }, h(Icon, { name: 'chat' }), label ? h('span', null, label) : null);
  let optionIndex = 0;
  const dialogs = [];
  const cards = groups.map((group) => {
    const options = list(group.options);
    return {
      name: text(group.label, 'Pilihan'),
      items: options.map((option) => {
        const optionImages = list(option.images).filter((url) => text(url));
        if (!optionImages.length && text(option.image_url)) optionImages.push(text(option.image_url));
        const dialogId = `kumpul-product-option-${optionIndex}`;
        optionIndex += 1;
        const benefits = list(option.benefits).filter((benefit) => text(benefit));
        dialogs.push(h(OptionDetailDialog, {
          key: dialogId,
          id: dialogId,
          images: optionImages,
          groupLabel: text(group.label, 'Pilihan'),
          title: text(option.label, 'Opsi'),
          descriptionHtml: option.description_html,
          description: option.description,
          venue: option.venue,
          address: option.address,
          mapUrl: option.map_url,
        },
        text(option.availability_note)
          ? h('div', { className: 'kumpul-product-option-meta' }, h('strong', null, 'Ketersediaan'), h('span', null, text(option.availability_note)))
          : null,
        benefits.length
          ? h('div', { className: 'kumpul-product-option-meta' }, h('strong', null, 'Benefit'),
            h('ul', null, ...benefits.map((benefit, index) => h('li', { key: index }, benefit))))
          : null));
        return { dialogId, label: text(option.label, 'Opsi'), summary: optionSummary(option.description), imageUrl: optionImages[0] || '' };
      }),
    };
  });

  return h('section', { className: 'kumpul-product-detail', 'data-product-detail': '' },
    h('div', { className: 'kumpul-product-top' },
      h('div', { className: 'kumpul-product-gallery' },
        images.length
          ? h('img', { className: 'kumpul-product-cover', src: images[0], alt: text(product.name, 'Gathering') })
          : h('div', { className: 'kumpul-product-cover is-empty', 'aria-hidden': 'true' }, h(Icon, { name: 'calendar' })),
        images.length > 1
          ? h('div', { className: 'kumpul-product-thumbs' },
            ...images.slice(1, 5).map((url, index) => h('img', { key: url, src: url, alt: `${text(product.name, 'Gathering')} ${index + 2}`, loading: 'lazy' })))
          : null),
      h('div', { className: 'kumpul-product-info' },
        text(product.category) ? h('p', { className: 'kumpul-card-meta' }, text(product.category)) : null,
        h('h1', null, text(product.name, 'Gathering')),
        text(product.price_label) ? h('p', { className: 'kumpul-product-price' }, text(product.price_label)) : null,
        facts.length
          ? h('dl', { className: 'kumpul-product-facts' },
            ...facts.map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value))))
          : null,
        text(product.description_html)
          ? h('div', { className: 'kumpul-product-rich', dangerouslySetInnerHTML: { __html: text(product.description_html) } })
          : text(product.description) ? h('p', { className: 'kumpul-product-plain' }, text(product.description)) : null,
        h('div', { className: 'kumpul-product-actions' },
          planButton('kumpul-product-primary', 'plan'),
          chatButton('kumpul-product-secondary', 'chat', 'Tanya produk')),
        !props.kumpulPage?.loggedIn
          ? h('p', { className: 'kumpul-product-hint' }, 'Masuk diperlukan untuk merencanakan gathering atau bertanya ke penyelenggara.')
          : null)),
    groups.length
      ? h('section', { className: 'kumpul-detail-card kumpul-product-options' },
        h('div', { className: 'kumpul-product-section-head' },
          h('h2', null, 'Pilihan paket'),
          h('span', null, `${groups.reduce((total, group) => total + list(group.options).length, 0)} pilihan`)),
        h(OptionItemRail, { groups: cards }),
        ...dialogs)
      : null,
    text(product.detail_html)
      ? h('section', { className: 'kumpul-detail-card' },
        h('h2', null, 'Detail acara'),
        h('div', { className: 'kumpul-product-rich', dangerouslySetInnerHTML: { __html: text(product.detail_html) } }))
      : null,
    list(product.specifications).length || text(product.cancellation_policy)
      ? h('section', { className: 'kumpul-detail-card' },
        h('h2', null, 'Ketentuan'),
        list(product.specifications).length
          ? h('dl', { className: 'kumpul-product-facts' },
            ...list(product.specifications).map((spec, index) => h('div', { key: index }, h('dt', null, text(spec.label)), h('dd', null, text(spec.value)))))
          : null,
        text(product.cancellation_policy)
          ? h('p', { className: 'kumpul-product-plain' }, h('strong', null, 'Kebijakan pembatalan: '), text(product.cancellation_policy))
          : null)
      : null,
    related.length
      ? h('section', { className: 'kumpul-product-related' },
        h('h2', null, 'Gathering lainnya'),
        h('div', { className: 'kumpul-product-related-grid' },
          ...related.map((item, index) => h('a', { key: index, className: 'kumpul-product-related-card', href: text(item.href, '#') },
            text(item.imageUrl)
              ? h('img', { src: text(item.imageUrl), alt: '', loading: 'lazy' })
              : h('span', { className: 'kumpul-product-related-empty', 'aria-hidden': 'true' }, h(Icon, { name: 'calendar' })),
            h('strong', null, text(item.name, 'Gathering')),
            text(item.priceLabel) ? h('span', null, text(item.priceLabel)) : null))))
      : null,
    // HP: CTA menempel di atas dock navigasi.
    h('div', { className: 'kumpul-product-mobilebar' },
      chatButton('kumpul-product-mobile-chat', 'chat-mobile', ''),
      planButton('kumpul-product-mobile-primary', 'plan-mobile')));
}

/**
 * Halaman undangan gathering (props.page `gathering_invitation`). Gaya Kumpul: hero banner,
 * kartu fakta, pemilih paket seperti Atur rencana (kategori geser, item ke bawah, centang),
 * kartu RSVP per status. HP: kode OTP & "tambah peserta lain" di bottom sheet (web: OTP inline,
 * tambah peserta = modal). Semua aksi lewat intent host (RSVP/OTP undangan terbuka tanpa login).
 */
function GatheringInvitationSection({ props }) {
  const data = (props.kumpulPage && props.kumpulPage.invitationPage) || {};
  const invitation = data.invitation || {};
  const viewer = data.viewer || {};
  const groups = list(data.optionGroups);
  const state = text(viewer.state, 'closed');
  const form = viewer.form || null;
  const isOpenPolicy = invitation.policy !== 'INVITE_ONLY';
  const dateTime = (value) => {
    const date = formatCalendarDate(value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const time = formatCalendarTime(value);
    return date ? `${date}${time ? ` · ${time} WIB` : ''}` : 'Belum ditentukan';
  };
  const intentButton = (action, label, className, extra = {}) => h('button', {
    type: 'button',
    className,
    disabled: !intentEnabled(props, action),
    ...intentAttributes(action, invitation.key, extra),
  }, label);
  const sheetButton = (name, label, className) => h('button', {
    type: 'button', className, 'data-kumpul-sheet-open': name, 'aria-haspopup': 'dialog',
  }, label);
  // Di halaman: pilih saat form/OTP; sesudah RSVP hanya hasil voting (pilih ulang di sheet tambah peserta).
  const pageSelectable = state === 'guest_form' || state === 'otp_pending';
  const facts = [
    ['Harga per peserta', formatCurrency(invitation.seatPrice)],
    ['Jadwal acara', dateTime(invitation.scheduledAt)],
    ['Batas RSVP', dateTime(invitation.rsvpCloseAt)],
    ['Kuota peserta', `Min. ${Number(invitation.minAttendees) || 0} · Maks. ${Number(invitation.maxAttendees) || 0}`],
  ];

  // Popup detail opsi (sekali per opsi; dipakai pemilih halaman & sheet).
  const dialogIdOf = new Map();
  const dialogs = [];
  groups.forEach((group) => list(group.options).forEach((option) => {
    const dialogId = `kumpul-invite-option-${dialogIdOf.size}`;
    dialogIdOf.set(option.key, dialogId);
    const images = list(option.images).filter((url) => text(url));
    if (!images.length && text(option.imageUrl)) images.push(text(option.imageUrl));
    dialogs.push(h(OptionDetailDialog, {
      key: dialogId,
      id: dialogId,
      images,
      groupLabel: text(group.label, 'Pilihan'),
      title: text(option.label, 'Opsi'),
      badge: option.selected ? 'Pilihan Anda' : '',
      descriptionHtml: option.descriptionHtml,
      description: option.description,
      venue: option.venue,
      address: option.address,
      mapUrl: option.mapUrl,
    }, h('span', { className: 'kumpul-plan-votes' }, `${Number(option.votes) || 0} suara · ${Number(option.percentage) || 0}%`)));
  }));

  /**
   * Pemilih paket: satu baris per kategori, item digeser ke samping (centang bila dapat dipilih).
   * Item terpilih diletakkan paling depan agar langsung terlihat (sisanya tetap urutan data).
   */
  const picker = (namePrefix, selectable) => h('div', { className: 'kumpul-invite-pick' },
    ...groups.map((group, groupIndex) => h('section', { key: text(group.key, String(groupIndex)), className: 'kumpul-invite-vote-group' },
      h('div', { className: 'kumpul-plan-pick-head' },
        h('h4', null, text(group.label, 'Pilihan')),
        h('span', null, `${Number(group.totalVotes) || 0} suara`)),
      h('ul', { className: 'kumpul-option-rail kumpul-invite-vote-rail', role: selectable ? 'radiogroup' : 'list', 'aria-label': text(group.label, 'Pilihan') },
        ...[...list(group.options)].sort((left, right) => Number(right.selected === true) - Number(left.selected === true)).map((option) => {
          const images = list(option.images).filter((url) => text(url));
          const imageUrl = images[0] || text(option.imageUrl);
          const percentage = Math.max(0, Math.min(100, Number(option.percentage) || 0));
          const body = [
            h('span', { key: 'thumb', className: 'kumpul-option-tile-thumb' },
              imageUrl ? h('img', { src: imageUrl, alt: '', loading: 'lazy' }) : h('span', { 'aria-hidden': 'true' }, h(Icon, { name: 'calendar' }))),
            h('span', { key: 'copy', className: 'kumpul-option-tile-copy' },
              h('strong', { className: 'kumpul-plan-option-name' }, text(option.label, 'Opsi')),
              optionSummary(option.description, 90) ? h('span', { className: 'kumpul-option-tile-summary' }, optionSummary(option.description, 90)) : null,
              h('span', { className: 'kumpul-invite-vote-bar', role: 'img', 'aria-label': `${percentage}% suara` },
                h('span', { style: { width: `${percentage}%` } })),
              h('span', { className: 'kumpul-invite-vote-meta' }, `${percentage}% · ${Number(option.votes) || 0} suara`)),
            h('button', {
              key: 'info',
              type: 'button',
              className: 'kumpul-plan-pick-info',
              'data-plan-option-open': dialogIdOf.get(option.key),
              'aria-haspopup': 'dialog',
              'aria-label': `Detail ${text(option.label, 'opsi')}`,
              title: 'Lihat detail',
            }, 'i'),
          ];
          return h('li', { key: option.key, className: 'kumpul-invite-vote-item' }, selectable
            ? h('label', { className: 'kumpul-option-tile kumpul-invite-vote-tile' },
              h('input', {
                type: 'radio',
                className: 'kumpul-invite-vote-radio',
                name: `${namePrefix}-${groupIndex}`,
                value: option.key,
                defaultChecked: option.selected === true,
                'data-bagdja-field': 'optionKeys',
                'aria-label': `Pilih ${text(option.label, 'opsi')}`,
              }),
              ...body)
            : h('div', { className: `kumpul-option-tile kumpul-invite-vote-tile is-readonly${option.selected ? ' is-selected' : ''}` }, ...body));
        })))));

  const field = (name, label, attrs) => h('label', { className: 'kumpul-invite-field' }, label, h('input', { 'data-bagdja-field': name, ...attrs }));
  const rsvpFields = form
    ? h('div', { className: 'kumpul-invite-fields' },
      form.askName ? field('attendee.name', 'Nama peserta', { type: 'text', maxLength: 255, autoComplete: 'name', placeholder: 'Nama lengkap' }) : null,
      form.askContact ? field('attendee.contact', 'Email', { type: 'email', maxLength: 320, autoComplete: 'email', inputMode: 'email', placeholder: 'nama@email.com' }) : null,
      form.askWhatsapp
        ? field('attendee.whatsapp', form.whatsappRequired ? 'WhatsApp (nomor yang diundang)' : 'WhatsApp (opsional)', { type: 'tel', maxLength: 20, autoComplete: 'tel', inputMode: 'tel', placeholder: '+628123456789' })
        : null)
    : null;
  const rsvpLabel = isOpenPolicy ? 'Kirim kode verifikasi' : 'Konfirmasi kehadiran';
  const otpInput = () => h('label', { className: 'kumpul-invite-field kumpul-invite-otp' }, 'Kode verifikasi',
    h('input', { type: 'text', inputMode: 'numeric', autoComplete: 'one-time-code', pattern: '[0-9]{6}', maxLength: 6, placeholder: '••••••', 'data-bagdja-field': 'otp.code' }));
  const otpHint = h('p', { className: 'kumpul-plan-sim-help' },
    'Kode 6 digit sudah dikirim ke ', h('strong', null, text(viewer.otpDestination, 'email Anda')),
    viewer.otpExpiresAt ? ` · berlaku sampai ${formatCalendarTime(viewer.otpExpiresAt)} WIB` : '', '.');
  const sheetHead = (title, subtitle) => h('div', { className: 'kumpul-invite-sheet-head' },
    h('div', null, h('strong', null, title), subtitle ? h('span', null, subtitle) : null),
    h('button', { type: 'button', className: 'kumpul-plan-option-dialog-close', 'data-kumpul-sheet-close': '', 'aria-label': 'Tutup' }, '×'));

  let panel;
  let mobilePrimary = null;
  const sheets = [];
  if (state === 'guest_form') {
    panel = [
      h('h2', { key: 'h' }, isOpenPolicy ? 'Ajukan reservasi' : 'Konfirmasi kehadiran'),
      h('p', { key: 'p', className: 'kumpul-plan-sim-help' }, isOpenPolicy
        ? `Harga ${formatCurrency(invitation.seatPrice)} per peserta. Kami kirim kode 6 digit ke email untuk memastikan reservasi.`
        : 'RSVP langsung tercatat atas nama Anda.'),
      h(React.Fragment, { key: 'f' }, rsvpFields),
      h('div', { key: 'a', className: 'kumpul-invite-actions' }, intentButton('gathering.invitation.rsvp', rsvpLabel, 'kumpul-product-primary')),
    ];
    mobilePrimary = intentButton('gathering.invitation.rsvp', rsvpLabel, 'kumpul-product-mobile-primary');
  } else if (state === 'otp_pending') {
    panel = [
      h('h2', { key: 'h' }, 'Masukkan kode verifikasi'),
      h(React.Fragment, { key: 'p' }, otpHint),
      // Web: kode inline. HP: kode di bottom sheet (terbuka otomatis), panel ini hanya pemicu.
      h('div', { key: 'inline', className: 'kumpul-invite-otp-inline' },
        otpInput(),
        h('div', { className: 'kumpul-invite-actions' },
          intentButton('gathering.invitation.verify_otp', 'Verifikasi & konfirmasi', 'kumpul-product-primary'),
          intentButton('gathering.invitation.resend_otp', 'Kirim ulang kode', 'kumpul-product-secondary'))),
      h('div', { key: 'm', className: 'kumpul-invite-mobile-only' }, sheetButton('otp', 'Masukkan kode', 'kumpul-product-secondary')),
      h('details', { key: 'd', className: 'kumpul-invite-more' },
        h('summary', null, 'Salah email? Ubah data reservasi'),
        h('div', { className: 'kumpul-invite-more-body' },
          h('p', { className: 'kumpul-plan-sim-help' }, 'Pilihan paket di atas ikut dikirim ulang.'),
          rsvpFields,
          intentButton('gathering.invitation.rsvp', 'Kirim kode baru', 'kumpul-product-secondary'))),
    ];
    sheets.push(h('dialog', {
      key: 'otp',
      className: 'kumpul-invite-sheet',
      'data-kumpul-invite-sheet': 'otp',
      'data-auto-open-mobile': '',
      'aria-label': 'Masukkan kode verifikasi',
    },
    sheetHead('Masukkan kode verifikasi', 'Cek email Anda'),
    h('div', { className: 'kumpul-invite-sheet-body' },
      otpHint,
      otpInput(),
      h('div', { className: 'kumpul-invite-sheet-actions' },
        intentButton('gathering.invitation.verify_otp', 'Verifikasi & konfirmasi', 'kumpul-product-primary'),
        intentButton('gathering.invitation.resend_otp', 'Kirim ulang kode', 'kumpul-product-secondary')))));
    mobilePrimary = sheetButton('otp', 'Masukkan kode verifikasi', 'kumpul-product-mobile-primary');
  } else if (state === 'registered') {
    const paid = viewer.paymentStatus === 'PAID';
    panel = [
      h('div', { key: 'ok', className: 'kumpul-invite-success' },
        h('span', { className: 'kumpul-invite-success-icon', 'aria-hidden': 'true' }, '✓'),
        h('div', null,
          h('h2', null, 'RSVP kamu sudah tercatat'),
          h('p', null, 'Pembayaran: ', h('span', { className: `kumpul-invite-pay-chip${paid ? ' is-paid' : ''}` }, text(viewer.paymentLabel, 'Belum dibayar'))))),
      // Identitas peserta (kontak & nomor sudah tersamar oleh Bagdja).
      viewer.attendee && (text(viewer.attendee.name) || text(viewer.attendee.contact) || text(viewer.attendee.phone))
        ? h('dl', { key: 'who', className: 'kumpul-invite-attendee' },
          ...[
            ['Nama', text(viewer.attendee.name)],
            ['Email', text(viewer.attendee.contact)],
            ['WhatsApp', text(viewer.attendee.phone)],
          ].filter(([, value]) => value).map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value))))
        : null,
      viewer.canPay
        ? h('div', { key: 'pay', className: 'kumpul-invite-actions' }, intentButton('gathering.invitation.pay', viewer.paymentStatus === 'PENDING_PAYMENT' ? 'Lanjutkan pembayaran' : 'Bayar kursi', 'kumpul-product-primary'))
        : !paid ? h('p', { key: 'wait', className: 'kumpul-plan-sim-help' }, 'Penyelenggara akan membuka pembayaran setelah reservasi dikonfirmasi.') : null,
      viewer.canAddReservation
        ? h('div', { key: 'add', className: 'kumpul-invite-add' }, sheetButton('add', '+ Tambah peserta lain', 'kumpul-product-secondary'))
        : null,
    ];
    if (viewer.canAddReservation) {
      sheets.push(h('dialog', {
        key: 'add',
        className: 'kumpul-invite-sheet is-wide',
        'data-kumpul-invite-sheet': 'add',
        'aria-label': 'Tambah peserta lain',
      },
      sheetHead('Tambah peserta lain', 'Pilihan sebelumnya sudah terisi — ubah bila perlu'),
      h('div', { className: 'kumpul-invite-sheet-body' },
        picker('kumpul-add-vote', true),
        rsvpFields,
        h('div', { className: 'kumpul-invite-sheet-actions' },
          intentButton('gathering.invitation.rsvp', 'Kirim kode verifikasi', 'kumpul-product-primary')))));
    }
    mobilePrimary = viewer.canPay
      ? intentButton('gathering.invitation.pay', 'Bayar kursi', 'kumpul-product-mobile-primary')
      : viewer.canAddReservation ? sheetButton('add', 'Tambah peserta lain', 'kumpul-product-mobile-primary') : null;
  } else if (state === 'login_required') {
    panel = [
      h('h2', { key: 'h' }, 'Undangan khusus'),
      h('p', { key: 'p', className: 'kumpul-plan-sim-help' },
        'Undangan ini untuk ', h('strong', null, text(invitation.inviteeName, 'penerima undangan')),
        viewer.recipientContact ? ` (${viewer.recipientContact})` : '', '. Masuk dengan akun email tersebut untuk konfirmasi.'),
      h('a', { key: 'a', className: 'kumpul-invite-link-btn', href: text(data.loginHref, '/auth/login') }, 'Masuk untuk konfirmasi'),
    ];
  } else if (state === 'account_mismatch') {
    panel = [
      h('h2', { key: 'h' }, 'Akun tidak cocok'),
      h('p', { key: 'p', className: 'kumpul-invite-warning', role: 'alert' },
        'Anda masuk sebagai ', h('strong', null, text(viewer.accountLabel, 'akun lain')), ', sedangkan undangan dikirim ke ',
        h('strong', null, text(viewer.recipientContact, 'email lain')), '.'),
      h('a', { key: 'a', className: 'kumpul-invite-link-btn is-secondary', href: text(data.switchAccountHref, '/auth/logout') }, 'Ganti akun'),
    ];
  } else {
    panel = [
      h('h2', { key: 'h' }, state === 'unavailable' ? 'Status undangan belum bisa dimuat' : 'RSVP belum dibuka'),
      h('p', { key: 'p', className: 'kumpul-plan-sim-help' }, state === 'unavailable'
        ? 'Muat ulang halaman untuk mencoba lagi.'
        : 'Pendaftaran belum dibuka atau masa reservasi sudah berakhir.'),
    ];
  }

  return h('section', { className: 'kumpul-invite-page', 'data-invitation-page': '' },
    h('div', { className: 'kumpul-invite-hero' },
      text(invitation.bannerUrl)
        ? h('img', { className: 'kumpul-invite-hero-banner', src: text(invitation.bannerUrl), alt: `Banner ${text(invitation.title, 'undangan')}` })
        : h('div', { className: 'kumpul-invite-hero-banner is-empty', 'aria-hidden': 'true' }, h(Icon, { name: 'calendar' })),
      h('div', { className: 'kumpul-invite-hero-copy' },
        h('p', { className: 'kumpul-eyebrow' }, isOpenPolicy ? 'Undangan terbuka' : 'Undangan khusus'),
        h('h1', null, text(invitation.title, 'Undangan gathering')),
        h('p', { className: 'kumpul-invite-host' },
          'Diprakarsai oleh ', h('strong', null, text(invitation.initiatorName, 'Penyelenggara')),
          text(invitation.planNumber) ? h('span', null, ` · ${text(invitation.planNumber)}`) : null),
        h('div', { className: 'kumpul-invite-chips' },
          text(invitation.inviteeName) ? h('span', { className: 'kumpul-invite-chip' }, `Untuk ${text(invitation.inviteeName)}`) : null,
          h('span', { className: `kumpul-invite-chip${invitation.rsvpOpen ? ' is-open' : ''}` }, text(invitation.statusLabel, 'Undangan'))))),
    h('dl', { className: 'kumpul-product-facts kumpul-invite-facts' },
      ...facts.map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value)))),
    text(invitation.descriptionHtml)
      ? h('div', { className: 'kumpul-detail-card kumpul-invite-description is-rich', dangerouslySetInnerHTML: { __html: text(invitation.descriptionHtml) } })
      : text(invitation.description) ? h('p', { className: 'kumpul-detail-card kumpul-invite-description' }, text(invitation.description)) : null,
    // Satu scope: pilihan (radio) + data peserta + tombol RSVP/OTP (termasuk di dalam sheet) terkirim bersama.
    h('div', { className: 'kumpul-invite-flow', 'data-bagdja-scope': '' },
      groups.length
        ? h('section', { className: 'kumpul-detail-card kumpul-invite-vote' },
          h('div', { className: 'kumpul-product-section-head' },
            h('h2', null, pageSelectable ? 'Pilih paket favoritmu' : 'Hasil voting paket'),
            h('span', null, pageSelectable ? 'Satu pilihan per kategori' : 'Suara terverifikasi')),
          picker('kumpul-vote', pageSelectable))
        : null,
      h('section', { className: `kumpul-detail-card kumpul-invite-rsvp is-${state}`, 'aria-live': 'polite' }, ...panel),
      ...sheets,
      // HP: syarat peserta dibuka dari bar aksi bawah (bottom sheet), berdampingan dengan CTA utama.
      text(invitation.terms)
        ? h('dialog', { className: 'kumpul-invite-sheet', 'data-kumpul-invite-sheet': 'terms', 'aria-label': 'Syarat & ketentuan peserta' },
          sheetHead('Syarat & ketentuan peserta', text(invitation.title, 'Undangan gathering')),
          h('div', { className: 'kumpul-invite-sheet-body' }, h('p', { className: 'kumpul-invite-terms-text' }, text(invitation.terms))))
        : null,
      mobilePrimary || text(invitation.terms)
        ? h('div', { className: 'kumpul-product-mobilebar kumpul-invite-mobilebar' },
          text(invitation.terms)
            ? h('button', {
              type: 'button',
              className: 'kumpul-invite-terms-btn',
              'data-kumpul-sheet-open': 'terms',
              'aria-haspopup': 'dialog',
              'aria-label': 'Syarat & ketentuan peserta',
            }, h(Icon, { name: 'info' }), h('span', null, 'Syarat'))
            : null,
          mobilePrimary)
        : null),
    ...dialogs,
    text(invitation.terms)
      ? h('details', { className: 'kumpul-detail-card kumpul-invite-terms' },
        h('summary', null, 'Syarat & ketentuan peserta'),
        h('p', null, text(invitation.terms)))
      : null,
    invitation.validUntilAt
      ? h('p', { className: 'kumpul-invite-valid' }, `Undangan berlaku sampai ${formatCalendarDate(invitation.validUntilAt)}.`)
      : null,
  );
}

function GatheringPlanDetailSection({ props, section }) {
  const sectionContent = section?.content || {};
  const plan = (props.kumpulPage && props.kumpulPage.plan) || sectionContent.gatheringPlan || {};
  const order = sectionContent.order || {};
  const occurrence = plan.occurrence || {};
  const openedIds = new Set(list(occurrence.opened_option_ids_snapshot));
  const allOptions = list(occurrence.option_groups_snapshot);
  const openedOptions = allOptions.filter((option) => openedIds.has(option.product_option_id));
  const currentStepIndex = plan.workflow_step === 'LOCKED'
    ? gatheringWorkflowSteps.length
    : Math.max(0, gatheringWorkflowSteps.findIndex((step) => step.key === plan.workflow_step));
  const currentStep = plan.workflow_step === 'LOCKED'
    ? 'Selesai'
    : gatheringWorkflowSteps.find((step) => step.key === plan.workflow_step)?.label || 'Tahap belum tersedia';
  const dateTime = (value) => {
    const date = formatCalendarDate(value);
    const time = formatCalendarTime(value);
    return date ? `${date}${time ? ` · ${time} WIB` : ''}` : 'Belum ditentukan';
  };
  const workflowStatus = text(gatheringPlanStatuses[plan.status], text(plan.status, 'Status belum tersedia'));
  const seatPrice = Number(occurrence.price_per_seat);
  const depositPerSeat = Number(occurrence.deposit_amount_per_seat);

  if (!plan.id && !plan.plan_number && !plan.title) {
    return h('section', { className: 'kumpul-plan-detail', 'data-plan-detail': '' },
      h('h1', null, 'Detail Rencana Gathering'),
      h('p', null, props.isPreview === true
        ? 'Belum ada contoh rencana gathering pada preview ini.'
        : 'Data rencana gathering dikelola oleh host Bagdja.'),
    );
  }

  return h('section', { className: 'kumpul-plan-detail', 'data-plan-detail': '' },
    h('a', { className: 'kumpul-detail-back', href: tenantPath(props, '/cart') }, '← Kembali ke Keranjang'),
    h('header', { className: 'kumpul-plan-heading' },
      h('div', null,
        h('p', { className: 'kumpul-eyebrow' }, 'Detail rencana gathering'),
        h('h1', null, text(plan.title, 'Rencana Gathering')),
        h('p', { className: 'kumpul-plan-number' }, `Nomor rencana · ${text(plan.plan_number, 'Belum tersedia')}`),
      ),
      h('span', { className: 'kumpul-transaction-status kumpul-transaction-status-info' }, workflowStatus),
    ),
    props.isPreview === true
      ? h('p', { className: 'kumpul-detail-preview-note', role: 'note' },
        'Preview desainer · data contoh saja. Status dan pengelolaan rencana dilakukan oleh host Bagdja.',
      )
      : null,
    props.isPreview === true ? h(GatheringPlanSimulator, { plan, props }) : null,
    props.isPreview === true ? null : h(LivePlanWorkflow, { plan, props }),
    // Preview: CTA simulasi tetap di panel, bar HP hanya membuka ringkasan.
    props.isPreview === true ? h(PlanMobileBar, { step: 'preview' }) : null,
    // HP: ringkasan gathering menjadi bottom sheet (checkbox + label, tanpa JavaScript).
    h('input', { type: 'checkbox', id: PLAN_SUMMARY_TOGGLE_ID, className: 'kumpul-sheet-toggle', 'aria-label': 'Buka ringkasan gathering' }),
    h('label', { htmlFor: PLAN_SUMMARY_TOGGLE_ID, className: 'kumpul-sheet-backdrop', 'aria-hidden': 'true' }),
    h('div', { className: 'kumpul-plan-layout kumpul-plan-summary-sheet', role: 'region', 'aria-label': 'Ringkasan gathering' },
      h('div', { className: 'kumpul-sheet-head kumpul-plan-summary-head' },
        h('strong', null, 'Ringkasan gathering'),
        h('label', { htmlFor: PLAN_SUMMARY_TOGGLE_ID, className: 'kumpul-sheet-close' }, 'Tutup')),
      h('div', { className: 'kumpul-plan-main' },
        h('section', { className: 'kumpul-detail-card' },
          h('h2', null, 'Ringkasan gathering'),
          h('dl', { className: 'kumpul-detail-fields' },
            h('div', null, h('dt', null, 'Status acara'), h('dd', null, text(gatheringPlanStatuses[occurrence.status], text(occurrence.status, 'Belum tersedia')))),
            h('div', null, h('dt', null, 'Akses undangan'), h('dd', null, plan.invite_policy === 'INVITE_ONLY' ? 'Khusus undangan' : 'Terbuka')),
            h('div', null, h('dt', null, 'Harga per peserta'), h('dd', null, Number.isFinite(seatPrice) ? formatCurrency(seatPrice) : 'Belum ditentukan')),
            Number.isFinite(depositPerSeat) && depositPerSeat > 0
              ? h('div', null, h('dt', null, 'Uang muka per peserta'), h('dd', null, formatCurrency(depositPerSeat)))
              : null,
            h('div', null, h('dt', null, 'Batas peserta'), h('dd', null, `Min. ${Number(occurrence.min_attendees) || 0} · Maks. ${Number(occurrence.max_attendees) || 0}`)),
            h('div', null, h('dt', null, 'Terakhir reservasi'), h('dd', null, dateTime(occurrence.rsvp_close_at))),
            h('div', null, h('dt', null, 'Batas pembayaran'), h('dd', null, dateTime(occurrence.payment_deadline))),
            h('div', null, h('dt', null, 'Jadwal acara'), h('dd', null, dateTime(occurrence.final_schedule))),
            h('div', null, h('dt', null, 'Lokasi acara'), h('dd', null,
              text(occurrence.final_location, 'Belum ditentukan'),
              h(VenueDetails, { address: occurrence.final_location_address, mapUrl: occurrence.final_location_map_url }))),
            order.created_at
              ? h('div', null, h('dt', null, 'Tanggal dibuat'), h('dd', null, formatCalendarDate(order.created_at)))
              : null,
          ),
        ),
        h('section', { className: 'kumpul-detail-card' },
          h('h2', null, 'Pilihan dari produk'),
          h(PlanOptionGroups, { options: allOptions, openedIds, occurrence }),
          h('p', {
            className: 'kumpul-plan-empty-options',
            'data-plan-opened-options-empty': '',
            hidden: openedOptions.length > 0,
          }, 'Belum ada pilihan yang dibuka untuk peserta.'),
        ),
      ),
      h('aside', { className: 'kumpul-detail-card kumpul-plan-aside' },
        h('h2', null, 'Status rencana'),
        h('span', { className: 'kumpul-transaction-status kumpul-transaction-status-info' }, workflowStatus),
        h('p', null, 'Tahap kerja · ', h('span', { 'data-plan-aside-step': '' }, currentStep)),
        h('p', null, 'Rencana gathering dikelola terpisah dari keranjang. Pembayaran peserta dibuka setelah RSVP ditutup di tahap Konfirmasi undangan.'),
        order.id
          ? h('p', { className: 'kumpul-plan-order-ref' }, `Referensi pesanan · ${order.id}`)
          : null,
        h('a', { className: 'kumpul-plan-account-link', href: tenantPath(props, '/cart') }, 'Kembali ke Keranjang'),
      ),
    ),
  );
}

function BillingSection({ props }) {
  const previewInvoices = list(props.kumpulPage && props.kumpulPage.invoices);
  const outstandingCount = previewInvoices.filter((invoice) => billingStatus(invoice) === 'issued').length;
  const counts = Object.fromEntries(billingFilters.map(([key]) => [
    key,
    key === 'all' ? previewInvoices.length : previewInvoices.filter((invoice) => billingStatus(invoice) === key).length,
  ]));

  return h('section', { className: 'kumpul-billing', 'data-billing-page': '' },
    h('header', { className: 'kumpul-billing-heading' },
      h('div', null,
        h('p', { className: 'kumpul-eyebrow' }, 'Akun Anda'),
        h('h1', null, 'Tagihan Saya'),
        h('p', { className: 'kumpul-billing-description' }, 'Semua termin dan tagihan gathering Anda, tersusun dalam satu halaman.'),
      ),
      h('div', { className: 'kumpul-billing-summary', 'aria-label': 'Ringkasan tagihan' },
        h('div', { className: 'kumpul-billing-summary-card' },
          h('strong', null, String(counts.all)),
          h('span', null, 'total tagihan'),
        ),
        h('div', { className: 'kumpul-billing-summary-card' },
          h('strong', null, String(outstandingCount)),
          h('span', null, 'perlu dibayar'),
        ),
      ),
    ),
    props.isPreview === true
      ? h('p', { className: 'kumpul-billing-preview-note', role: 'note' },
        'Preview desainer · data contoh saja. Pembayaran dan detail tagihan dikelola oleh host Bagdja.',
      )
      : null,
    h('div', { className: 'kumpul-billing-filters', role: 'group', 'aria-label': 'Filter status tagihan' },
      ...billingFilters.map(([key, label]) => h('button', {
        type: 'button',
        'aria-pressed': key === 'all' ? 'true' : 'false',
        'data-billing-filter': key,
        key,
      },
      label,
      h('span', null, String(counts[key])),
      )),
    ),
    h('section', { className: 'kumpul-billing-results' },
      h('div', { className: 'kumpul-billing-results-heading' },
        h('h2', null, 'Daftar tagihan'),
        h('span', { 'data-billing-count': '' }, `${counts.all} tagihan`),
      ),
      h('div', { className: 'kumpul-billing-list', 'data-billing-list': '' },
        ...previewInvoices.map((invoice, index) => {
          const status = billingStatus(invoice);
          const statusInfo = billingStatuses[status];
          const isGathering = invoice.kind === 'gathering';
          const title = text(isGathering ? invoice.gathering_title : invoice.productName, 'Tagihan gathering');
          const reference = isGathering
            ? `${text(invoice.invoice_id, 'Invoice')} · ${text(invoice.attendee_name, 'Peserta')}`
            : `${text(invoice.label, 'Termin pembayaran')} · ${text(invoice.anchorStepName, text(invoice.orderId, 'Pesanan'))}`;
          const dueDate = invoice.payment_deadline || invoice.dueDate;
          // Seluruh kartu bisa diklik: gathering → detail tagihan, termin → detail transaksi.
          const cardHref = isGathering ? invoice.detail_href : invoice.transaction_href;
          return h('article', {
            className: `kumpul-billing-card kumpul-billing-card-${status}${cardHref ? ' kumpul-billing-card-linked' : ''}`,
            'data-billing-item': '',
            'data-billing-status': status,
            key: invoice.id || index,
          },
          h('div', { className: 'kumpul-billing-card-top' },
            h('div', null,
              h('span', { className: 'kumpul-billing-kind' }, isGathering ? 'Tagihan gathering' : `Termin ${invoice.sequence || ''}`.trim()),
              h('h3', null, cardHref
                ? h('a', { className: 'kumpul-billing-card-link', href: cardHref }, title)
                : title),
              h('p', null, reference),
            ),
            h('span', { className: `kumpul-billing-status kumpul-billing-status-${statusInfo.tone}` }, statusInfo.label),
          ),
          h('div', { className: 'kumpul-billing-card-bottom' },
            h('div', null,
              h('strong', null, formatCurrency(invoice.amount)),
              dueDate ? h('p', null, `Batas pembayaran · ${formatCalendarDate(dueDate)}`) : null,
            ),
            status === 'issued' && isGathering && invoice.detail_href
              ? h('a', { className: 'kumpul-billing-action', href: invoice.detail_href }, 'Lihat detail tagihan')
              : status === 'issued'
                ? h('button', {
                  type: 'button',
                  className: 'kumpul-billing-action',
                  disabled: !invoice.can_pay || !intentEnabled(props, 'invoice.pay'),
                  ...intentAttributes('invoice.pay', invoice.key),
                }, isGathering ? 'Lihat detail tagihan' : 'Bayar')
                : null,
          ),
          );
        }),
        h('p', {
          className: 'kumpul-billing-empty',
          hidden: previewInvoices.length > 0,
          'data-billing-empty': '',
        }, props.isPreview === true
          ? 'Belum ada tagihan pada preview ini.'
          : 'Data tagihan dan status pembayaran dikelola oleh host Bagdja.'),
        h('p', {
          className: 'kumpul-billing-empty',
          hidden: true,
          'data-billing-filter-empty': '',
        }, 'Tidak ada tagihan dengan status ini.'),
      ),
    ),
  );
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
    info: h('path', { d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v5m0-8h.01' }),
    more: h('path', { d: 'M4 6h16M4 12h16M4 18h16' }),
    refresh: h('path', { d: 'M20 11a8 8 0 0 0-14.9-3.9M4 4v4h4m-4 5a8 8 0 0 0 14.9 3.9M20 20v-4h-4' }),
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
          h('a', {
            href,
            key: label,
            'aria-label': label,
            title: label,
            'aria-current': (
              props.activePageSlug === 'calendar' && label === 'Kalender'
              || (props.activePageSlug === 'tagihan' || props.activePageSlug === 'invoice-detail') && label === 'Tagihan'
              || (props.activePageSlug === 'orders' || props.activePageSlug === 'transaction-detail') && label === 'Transaksi'
              || (props.activePageSlug === 'cart' || props.activePageSlug === 'plan-detail') && label === 'Keranjang'
            ) ? 'page' : undefined,
          }, h(Icon, { name: icon }), h('span', null, label)),
        ),
        !auth.isLoggedIn && auth.loginHref
          ? h('a', { className: 'kumpul-login', href: auth.loginHref }, 'Masuk')
          : null,
      ),
    ),
    pages.length
      ? h('nav', { className: 'kumpul-page-nav', 'aria-label': 'Navigasi halaman' },
        ...pages.map((page) =>
          h('a', {
            href: tenantPath(props, page.isHome ? '/' : `/${encodeURIComponent(page.slug)}`),
            key: page.slug,
            'aria-current': activePage
              ? page.slug === activePage.slug ? 'page' : undefined
              : props.activePageSlug ? undefined : page.isHome ? 'page' : undefined,
          }, page.title),
        ),
      )
      : null,
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

const calendarStatuses = [
  ['all', 'Semua'],
  ['planning', 'Perencanaan'],
  ['rsvp', 'RSVP'],
  ['payment', 'Pembayaran'],
  ['confirmed', 'Dikonfirmasi'],
  ['completed', 'Selesai'],
  ['cancelled', 'Dibatalkan'],
];

const calendarStatusLabels = {
  PREORDER: 'Perencanaan',
  RSVP_OPEN: 'RSVP dibuka',
  PAYMENT_OPEN: 'Menunggu pembayaran',
  CONFIRMED: 'Dikonfirmasi',
  IN_PROGRESS: 'Sedang berlangsung',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

function calendarStatusFilter(status) {
  if (status === 'PREORDER') return 'planning';
  if (status === 'RSVP_OPEN') return 'rsvp';
  if (status === 'PAYMENT_OPEN') return 'payment';
  if (status === 'CONFIRMED' || status === 'IN_PROGRESS') return 'confirmed';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'CANCELLED') return 'cancelled';
  return 'other';
}

function calendarDateKey(value) {
  if (typeof value !== 'string') return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return '';
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day)
    ? `${year}-${month}-${day}`
    : '';
}

function formatCalendarDate(value, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const key = calendarDateKey(value);
  if (!key) return '';
  return new Intl.DateTimeFormat('id-ID', { ...options, timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
}

function formatCalendarTime(value) {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

function calendarMonthKey(value, fallback) {
  if (typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  return calendarDateKey(fallback).slice(0, 7) || new Date().toISOString().slice(0, 7);
}

function calendarMonthCells(monthKey, events, selectedDate) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const offset = (firstDay.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month - 1, 1 - offset));

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    const eventCount = events.filter((event) => calendarDateKey(event.event_date) === key).length;
    return h('button', {
      type: 'button',
      className: 'kumpul-calendar-day',
      'aria-label': `${formatCalendarDate(key, { day: 'numeric', month: 'long' })}${eventCount ? `, ${eventCount} acara` : ''}`,
      'aria-pressed': key === selectedDate ? 'true' : 'false',
      'data-calendar-day': key,
      'data-outside-month': date.getUTCMonth() !== month - 1 ? 'true' : undefined,
      key,
    },
    h('span', null, String(date.getUTCDate())),
    eventCount ? h('small', null, String(eventCount)) : null,
    );
  });
}

function CalendarSection({ props, section }) {
  const content = section?.content || {};
  const isPreview = props.isPreview === true;
  const plans = list(content.plans);
  const invitations = list(content.invitations);
  const attentionCount = invitations.filter((invitation) => invitation.needs_action === true).length;
  const events = [
    ...plans.filter((plan) => calendarDateKey(plan.event_date)).map((plan) => ({
      id: plan.id || plan.plan_number,
      type: 'plan',
      typeLabel: 'Rencana',
      title: text(plan.title, 'Rencana gathering'),
      statusLabel: text(plan.status_label, calendarStatusLabels[plan.status] || 'Status belum tersedia'),
      event_date: plan.event_date,
      location: text(plan.event_location),
      href: plan.detail_href,
    })),
    ...invitations.filter((invitation) => calendarDateKey(invitation.event_date)).map((invitation) => ({
      id: invitation.id || invitation.plan_number,
      type: 'invitation',
      typeLabel: 'Undangan',
      title: text(invitation.gathering_title, 'Undangan gathering'),
      statusLabel: text(invitation.action_label, 'Undangan diterima'),
      event_date: invitation.event_date,
      location: text(invitation.event_location),
      href: invitation.detail_href,
    })),
  ].sort((left, right) => new Date(left.event_date).getTime() - new Date(right.event_date).getTime());
  const initialMonth = calendarMonthKey(content.month, events[0]?.event_date);
  const initialDate = events.find((event) => calendarDateKey(event.event_date).startsWith(`${initialMonth}-`));
  const selectedDate = initialDate ? calendarDateKey(initialDate.event_date) : `${initialMonth}-01`;
  const monthLabel = formatCalendarDate(`${initialMonth}-01`, { month: 'long', year: 'numeric' });

  return h('section', { className: 'kumpul-calendar', id: section.id || 'kalender-acara', 'data-calendar-page': '' },
    h('header', { className: 'kumpul-calendar-heading' },
      h('div', null,
        h('p', { className: 'kumpul-eyebrow' }, 'Acara Anda'),
        h('h1', { className: 'kumpul-calendar-title' }, text(content.title, 'Kalender Acara')),
        h('p', { className: 'kumpul-calendar-description', 'data-calendar-description': '' },
          'Lihat jadwal gathering, rencana, dan undangan Anda dalam satu kalender.',
        ),
      ),
      h('div', { className: 'kumpul-calendar-stats', 'aria-label': 'Ringkasan kalender' },
        ...[
          [plans.length, 'rencana'],
          [invitations.length, 'undangan'],
          [attentionCount, 'perlu tindakan'],
        ].map(([value, label]) => h('div', { className: 'kumpul-calendar-stat', key: label },
          h('strong', null, String(value)),
          h('span', null, label),
        )),
      ),
    ),
    isPreview
      ? h('p', { className: 'kumpul-calendar-preview-note', role: 'note' },
        'Preview desainer · data contoh saja. RSVP, pembayaran, dan detail acara dikelola oleh host Bagdja.',
      )
      : null,
    h('div', { className: 'kumpul-calendar-tabs', role: 'tablist', 'aria-label': 'Kalender acara' },
      h('button', {
        type: 'button',
        role: 'tab',
        id: 'calendar-tab-calendar',
        'aria-controls': 'calendar-panel-calendar',
        'aria-selected': 'true',
        'data-calendar-tab': 'calendar',
      }, 'Kalender', h('span', null, String(events.length))),
      h('button', {
        type: 'button',
        role: 'tab',
        id: 'calendar-tab-plans',
        'aria-controls': 'calendar-panel-plans',
        'aria-selected': 'false',
        'data-calendar-tab': 'plans',
      }, 'Rencana Saya', h('span', null, String(plans.length))),
      h('button', {
        type: 'button',
        role: 'tab',
        id: 'calendar-tab-invitations',
        'aria-controls': 'calendar-panel-invitations',
        'aria-selected': 'false',
        'data-calendar-tab': 'invitations',
      }, 'Undangan', h('span', null, String(invitations.length)),
        attentionCount ? h('b', { 'aria-label': `${attentionCount} perlu tindakan` }, String(attentionCount)) : null,
      ),
    ),
    h('div', {
      id: 'calendar-panel-calendar',
      role: 'tabpanel',
      'aria-labelledby': 'calendar-tab-calendar',
      'data-calendar-panel': 'calendar',
      'data-initial-month': initialMonth,
      'data-initial-date': selectedDate,
    },
      h('div', { className: 'kumpul-calendar-month-toolbar' },
        h('div', { className: 'kumpul-calendar-month-title' },
          h('h2', { 'data-calendar-month-label': '' }, monthLabel),
          h('p', null, 'Pilih tanggal untuk melihat agenda.'),
        ),
        h('div', { className: 'kumpul-calendar-month-actions' },
          h('button', { type: 'button', 'aria-label': 'Bulan sebelumnya', 'data-calendar-previous': '' }, '‹'),
          h('button', { type: 'button', 'data-calendar-today': '' }, 'Hari ini'),
          h('button', { type: 'button', 'aria-label': 'Bulan berikutnya', 'data-calendar-next': '' }, '›'),
        ),
      ),
      h('div', { className: 'kumpul-calendar-month-view' },
        h('div', { className: 'kumpul-calendar-weekdays', 'aria-hidden': 'true' },
          ...['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => h('span', { key: day }, day)),
        ),
        h('div', { className: 'kumpul-calendar-grid', role: 'group', 'aria-label': `Kalender ${monthLabel}` },
          ...calendarMonthCells(initialMonth, events, selectedDate),
        ),
      ),
      h('dialog', {
        className: 'kumpul-calendar-agenda',
        'aria-labelledby': 'calendar-agenda-title',
        'data-calendar-agenda-dialog': '',
      },
        h('div', { className: 'kumpul-calendar-agenda-handle', 'aria-hidden': 'true' }),
        h('header', { className: 'kumpul-calendar-agenda-heading' },
          h('div', null,
            h('p', { className: 'kumpul-eyebrow' }, 'Agenda tanggal'),
            h('h2', { id: 'calendar-agenda-title', 'data-calendar-selected-label': '' }, formatCalendarDate(selectedDate)),
          ),
          h('button', {
            type: 'button',
            className: 'kumpul-calendar-agenda-close',
            'aria-label': 'Tutup agenda tanggal',
            'data-calendar-close': '',
          }, '×'),
        ),
        h('div', { className: 'kumpul-calendar-agenda-content', 'aria-live': 'polite' },
        h('div', { className: 'kumpul-calendar-list kumpul-calendar-agenda-list', 'data-calendar-agenda': '' },
          ...events.map((event, index) => h('article', {
            className: `kumpul-calendar-event kumpul-calendar-event-${event.type}${event.href ? ' kumpul-calendar-event-linked' : ''}`,
            'data-calendar-event': '',
            'data-calendar-date': calendarDateKey(event.event_date),
            hidden: calendarDateKey(event.event_date) !== selectedDate,
            key: event.id || index,
          },
          h('div', { className: 'kumpul-calendar-event-time' }, formatCalendarTime(event.event_date) || 'Acara'),
          h('div', { className: 'kumpul-calendar-event-copy' },
            h('span', { className: 'kumpul-calendar-event-kind' }, event.typeLabel),
            h('h4', null, event.href
              ? h('a', { className: 'kumpul-calendar-event-link', href: event.href }, event.title)
              : event.title),
            h('p', null, `${event.statusLabel}${event.location ? ` · ${event.location}` : ''}`),
          ),
          )),
          h('p', {
            className: 'kumpul-calendar-empty',
            hidden: events.some((event) => calendarDateKey(event.event_date) === selectedDate),
            'data-calendar-agenda-empty': '',
          }, isPreview ? 'Belum ada acara pada tanggal ini.' : 'Data agenda kalender dikelola oleh host Bagdja.'),
        ),
      ),
    ),
    ),
    h('div', {
      id: 'calendar-panel-plans',
      role: 'tabpanel',
      'aria-labelledby': 'calendar-tab-plans',
      'data-calendar-panel': 'plans',
      hidden: true,
    },
      h('nav', { className: 'kumpul-calendar-filters', 'aria-label': 'Filter status rencana' },
        ...calendarStatuses.map(([filter, label]) => {
          const count = filter === 'all'
            ? plans.length
            : plans.filter((plan) => calendarStatusFilter(plan.status) === filter).length;
          return h('button', {
            type: 'button',
            'aria-pressed': filter === 'all' ? 'true' : 'false',
            'data-calendar-filter': filter,
            key: filter,
          }, label, h('span', null, String(count)));
        }),
      ),
      h('div', { className: 'kumpul-calendar-list', 'data-calendar-list': 'plans' },
        ...plans.map((plan, index) => h('article', {
          className: 'kumpul-calendar-card',
          'data-calendar-card': '',
          'data-calendar-status': calendarStatusFilter(plan.status),
          key: plan.id || plan.plan_number || index,
        },
        h('div', { className: 'kumpul-calendar-card-copy' },
          h('div', { className: 'kumpul-calendar-card-title' },
            h('h2', null, text(plan.title, 'Rencana gathering')),
            h('span', { className: 'kumpul-calendar-status' }, text(plan.status_label, calendarStatusLabels[plan.status] || 'Status belum tersedia')),
          ),
          h('p', { className: 'kumpul-calendar-meta' }, `Nomor rencana: ${text(plan.plan_number, '—')}`),
          h('p', { className: 'kumpul-calendar-meta' }, text(plan.workflow_step_label, 'Tahap acara')),
          h('p', { className: 'kumpul-calendar-meta' },
            `Jadwal: ${formatCalendarDate(plan.event_date) || 'Belum ditentukan'} · Peserta: min. ${Number(plan.min_attendees) || 0}, maks. ${Number(plan.max_attendees) || 0}`,
          ),
          plan.payment_deadline
            ? h('p', { className: 'kumpul-calendar-meta' }, `Batas pembayaran: ${formatCalendarDate(plan.payment_deadline)}`)
            : null,
        ),
        plan.detail_href
          ? h('a', { className: 'kumpul-calendar-action', href: plan.detail_href }, 'Lanjutkan rencana')
          : h('button', { type: 'button', className: 'kumpul-calendar-action', disabled: true }, 'Lanjutkan rencana'),
        )),
        h('p', {
          className: 'kumpul-calendar-empty',
          hidden: plans.length > 0,
          'data-calendar-empty': '',
        }, 'Belum ada rencana acara. Rencana gathering yang Anda buat akan dikelola dari kalender ini.'),
        plans.length
          ? h('p', { className: 'kumpul-calendar-empty', hidden: true, 'data-calendar-filter-empty': '' }, 'Tidak ada acara pada status ini.')
          : null,
      ),
    ),
    h('div', {
      id: 'calendar-panel-invitations',
      role: 'tabpanel',
      'aria-labelledby': 'calendar-tab-invitations',
      'data-calendar-panel': 'invitations',
      hidden: true,
    },
      h('div', { className: 'kumpul-calendar-list', 'data-calendar-list': 'invitations' },
        ...invitations.map((invitation, index) => h('article', {
          className: 'kumpul-calendar-card',
          key: invitation.id || invitation.plan_number || index,
        },
        h('div', { className: 'kumpul-calendar-card-copy' },
          h('div', { className: 'kumpul-calendar-card-title' },
            h('h2', null, text(invitation.gathering_title, 'Undangan gathering')),
            invitation.is_new ? h('span', { className: 'kumpul-calendar-new' }, 'Undangan baru') : null,
          ),
          h('p', { className: 'kumpul-calendar-meta' },
            `${formatGatheringDate(invitation.event_date) || 'Belum dijadwalkan'}${invitation.event_location ? ` · ${invitation.event_location}` : ''}`,
          ),
          h('p', { className: 'kumpul-calendar-meta' },
            `Diundang oleh ${text(invitation.initiator_name, 'Penyelenggara')} · ${text(invitation.plan_number, '—')}`,
          ),
        ),
        h('div', { className: 'kumpul-calendar-invitation-action' },
          invitation.action_label ? h('span', null, invitation.action_label) : null,
          invitation.detail_href
            ? h('a', { className: 'kumpul-calendar-action', href: invitation.detail_href }, 'Lihat undangan')
            : h('button', {
              type: 'button',
              className: 'kumpul-calendar-action',
              disabled: !invitation.key || !intentEnabled(props, 'gathering.respond'),
              ...(invitation.key ? intentAttributes('gathering.respond', invitation.key) : {}),
            }, 'Lihat undangan'),
        ),
        )),
        h('p', {
          className: 'kumpul-calendar-empty',
          hidden: invitations.length > 0,
        }, 'Belum ada undangan. Undangan acara yang dikirim ke akun Anda akan muncul di sini.'),
      ),
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
    ...links.map(([label, href, icon]) => h('a', {
      href,
      key: label,
      'aria-label': label,
      'aria-current': (
        (props.activePageSlug === 'tagihan' || props.activePageSlug === 'invoice-detail') && label === 'Tagihan'
        || (props.activePageSlug === 'orders' || props.activePageSlug === 'transaction-detail') && label === 'Transaksi'
        || (props.activePageSlug === 'cart' || props.activePageSlug === 'plan-detail') && label === 'Keranjang'
      ) ? 'page' : undefined,
    },
      h(Icon, { name: icon }), h('span', null, label),
    )),
  );
}

function styles(colors) {
  return `
    .kumpul-cart{max-width:1080px;margin:0 auto}.kumpul-cart-heading h1{margin:0;font-size:clamp(30px,4vw,40px);line-height:1.15;letter-spacing:-.04em}.kumpul-cart-heading h1 span{margin-left:9px;color:var(--kt-muted);font-size:14px;font-weight:500;letter-spacing:0}.kumpul-cart-heading>div>p:last-child{margin:8px 0 0;color:var(--kt-muted);font-size:12px}.kumpul-cart-preview-note{margin:18px 0 0;padding:10px 13px;border:1px solid var(--kt-border);border-radius:12px;background:var(--kt-surface);color:var(--kt-muted);font-size:10px}.kumpul-cart-layout{margin-top:22px;display:grid;grid-template-columns:minmax(0,1fr) 300px;align-items:start;gap:22px}.kumpul-cart-select-all{margin-bottom:10px}.kumpul-cart-select-all button{padding:8px 0;border:0;background:none;color:var(--kt-muted);font:inherit;font-size:10px;font-weight:750;cursor:pointer}.kumpul-cart-list{display:grid;gap:11px}.kumpul-cart-item{padding:15px;display:grid;grid-template-columns:24px 70px minmax(0,1fr) auto;align-items:start;gap:13px;border:1px solid var(--kt-border);border-radius:16px;background:var(--kt-surface)}.kumpul-cart-choice{padding-top:4px;display:flex;justify-content:center}.kumpul-cart-choice input{width:17px;height:17px;accent-color:var(--kt-accent)}.kumpul-cart-choice input:disabled{opacity:.4}.kumpul-cart-art{width:70px;height:70px;display:grid;place-items:center;border:1px solid var(--kt-border);border-radius:14px;background:var(--kt-bg);color:var(--kt-accent);font-size:29px}.kumpul-cart-copy{min-width:0}.kumpul-cart-kind{color:var(--kt-accent);font-size:8px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.kumpul-cart-copy h2{margin:4px 0 0;font-size:13px}.kumpul-cart-detail,.kumpul-cart-variant{margin:5px 0 0;color:var(--kt-muted);font-size:10px}.kumpul-cart-blocked{margin:7px 0 0;color:#a15c00;font-size:9px;font-weight:700}.kumpul-cart-item-controls{min-width:130px;display:grid;justify-items:end;gap:10px}.kumpul-cart-price{color:var(--kt-accent);font-size:13px}.kumpul-cart-quantity{display:flex;align-items:center;border:1px solid var(--kt-border);border-radius:9px;overflow:hidden}.kumpul-cart-quantity button{width:30px;height:28px;border:0;background:var(--kt-bg);color:var(--kt-text);font:inherit;font-weight:700;cursor:pointer}.kumpul-cart-quantity button:disabled{opacity:.4;cursor:not-allowed}.kumpul-cart-quantity span{min-width:28px;text-align:center;font-size:10px}.kumpul-cart-remove{padding:0;border:0;background:none;color:#b91c1c;font:inherit;font-size:9px;font-weight:700;cursor:pointer}.kumpul-cart-summary{position:sticky;top:20px;padding:18px;border:1px solid var(--kt-border);border-radius:17px;background:var(--kt-surface)}.kumpul-cart-summary h2{margin:0 0 15px;font-size:15px}.kumpul-cart-summary-row,.kumpul-cart-summary-total{display:flex;justify-content:space-between;gap:12px}.kumpul-cart-summary-row{padding-bottom:13px;border-bottom:1px solid var(--kt-border);color:var(--kt-muted);font-size:10px}.kumpul-cart-summary-row strong{color:var(--kt-text)}.kumpul-cart-summary-total{padding:14px 0;align-items:baseline;color:var(--kt-muted);font-size:10px}.kumpul-cart-summary-total strong{color:var(--kt-accent);font-size:18px}.kumpul-cart-checkout{width:100%;min-height:42px;border:0;border-radius:11px;background:var(--kt-accent);color:#fff;font:inherit;font-size:11px;font-weight:800;opacity:.56;cursor:not-allowed}.kumpul-cart-summary>p{margin:11px 0 0;color:var(--kt-muted);font-size:9px;line-height:1.5}.kumpul-cart-empty{margin:8px 0 0;padding:20px;border:1px dashed var(--kt-border);border-radius:13px;color:var(--kt-muted);font-size:11px;text-align:center}.kumpul-cart-empty-state{max-width:600px;margin:20px auto;padding:50px 20px;text-align:center;border:1px solid var(--kt-border);border-radius:22px;background:var(--kt-surface)}.kumpul-cart-empty-icon{width:58px;height:58px;margin:auto;display:grid;place-items:center;border-radius:50%;background:var(--kt-bg);font-size:27px}.kumpul-cart-empty-state h1{margin:15px 0 0;font-size:25px}.kumpul-cart-empty-state p{margin:8px 0 0;color:var(--kt-muted);font-size:12px}.kumpul-cart-browse{margin-top:18px;padding:11px 17px;display:inline-flex;border-radius:11px;background:var(--kt-accent);color:#fff;font-size:10px;font-weight:800}
    .kumpul-cart.is-empty .kumpul-cart-select-all,.kumpul-cart.is-empty .kumpul-cart-summary{display:none}.kumpul-cart.is-empty .kumpul-cart-layout{grid-template-columns:1fr}
    @media(max-width:760px){.kumpul-cart-layout{grid-template-columns:1fr;gap:15px}.kumpul-cart-item{grid-template-columns:20px 52px minmax(0,1fr);gap:10px;padding:12px}.kumpul-cart-art{width:52px;height:52px;border-radius:12px;font-size:23px}.kumpul-cart-copy h2{font-size:11px}.kumpul-cart-item-controls{grid-column:3;min-width:0;width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px}.kumpul-cart-price{margin-right:auto;font-size:12px}.kumpul-cart-summary{position:static}.kumpul-cart-heading h1{font-size:32px}}
    .kumpul-transactions{max-width:980px;margin:0 auto}.kumpul-transactions-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}.kumpul-transactions-heading h1{margin:0;color:var(--kt-text);font-size:clamp(30px,4vw,42px);line-height:1.15;letter-spacing:-.04em}.kumpul-transactions-heading>div:first-child>p:last-child{margin:9px 0 0;color:var(--kt-muted);font-size:13px}.kumpul-transactions-total{padding:13px 16px;display:grid;gap:2px;border:1px solid var(--kt-border);border-radius:15px;background:var(--kt-surface)}.kumpul-transactions-total strong{font-size:21px;line-height:1.1}.kumpul-transactions-total span{color:var(--kt-muted);font-size:10px}.kumpul-transactions-preview-note{margin:20px 0 0;padding:11px 14px;border:1px solid var(--kt-border);border-radius:12px;background:var(--kt-surface);color:var(--kt-muted);font-size:11px}.kumpul-transactions-filters{margin:25px 0 22px;padding-bottom:7px;display:flex;gap:8px;overflow-x:auto;border-bottom:1px solid var(--kt-border);scrollbar-width:thin}.kumpul-transactions-filters button{padding:9px 12px;display:inline-flex;align-items:center;gap:8px;border:1px solid transparent;border-radius:11px 11px 0 0;background:transparent;color:var(--kt-muted);font:inherit;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer}.kumpul-transactions-filters button[aria-pressed=true]{border-color:var(--kt-border);border-bottom-color:var(--kt-surface);background:var(--kt-surface);color:var(--kt-accent)}.kumpul-transactions-filters button span{min-width:20px;height:20px;padding:2px 6px;display:grid;place-items:center;border-radius:99px;background:var(--kt-bg);color:var(--kt-muted);font-size:9px}.kumpul-transactions-list{display:grid;gap:12px}.kumpul-transaction-card{overflow:hidden;border:1px solid var(--kt-border);border-radius:16px;background:var(--kt-surface)}.kumpul-transaction-top{padding:13px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #e8f0f2}.kumpul-transaction-top>div{display:flex;align-items:center;gap:8px;color:var(--kt-muted);font-size:10px}.kumpul-transaction-ref{color:var(--kt-text);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:750}.kumpul-transaction-status{padding:6px 9px;flex:none;border-radius:99px;font-size:9px;font-weight:800}.kumpul-transaction-status-warning{background:#fff4da;color:#a15c00}.kumpul-transaction-status-info{background:#e8f2ff;color:#2563eb}.kumpul-transaction-status-success{background:#e5f7ef;color:#08734f}.kumpul-transaction-status-danger{background:#ffeded;color:#b91c1c}.kumpul-transaction-status-muted{background:#eef1f4;color:#64748b}.kumpul-transaction-body{padding:16px 18px;display:flex;align-items:center;justify-content:space-between;gap:20px}.kumpul-transaction-item{min-width:0;display:flex;align-items:center;gap:13px}.kumpul-transaction-art{width:58px;height:58px;flex:none;display:grid;place-items:center;border:1px solid var(--kt-border);border-radius:14px;background:var(--kt-bg);color:var(--kt-accent);font-size:26px}.kumpul-transaction-item>div{min-width:0}.kumpul-transaction-item h2{margin:0;font-size:13px}.kumpul-transaction-item p{margin:5px 0 0;color:var(--kt-muted);font-size:10px}.kumpul-transaction-total{flex:none;text-align:right}.kumpul-transaction-total span{display:block;color:var(--kt-muted);font-size:10px}.kumpul-transaction-total strong{display:block;margin-top:3px;font-size:16px}.kumpul-transaction-actions{padding:0 18px 15px;display:flex;justify-content:flex-end;gap:8px}.kumpul-transaction-actions button{min-height:34px;padding:7px 11px;border:1px solid var(--kt-border);border-radius:10px;background:var(--kt-surface);color:var(--kt-text);font:inherit;font-size:9px;font-weight:750;opacity:.62;cursor:not-allowed}.kumpul-transaction-actions button:disabled{opacity:.62}.kumpul-transactions-empty{margin:0;padding:32px 18px;border:1px dashed var(--kt-border);border-radius:15px;color:var(--kt-muted);font-size:12px;text-align:center}
    @media(max-width:700px){.kumpul-transactions-heading{align-items:flex-start;flex-direction:column;gap:16px}.kumpul-transactions-total{width:100%;padding:11px 13px}.kumpul-transactions-total strong{font-size:18px}.kumpul-transactions-filters{margin-top:20px}.kumpul-transaction-top{align-items:flex-start;padding:12px 14px}.kumpul-transaction-top>div{flex-wrap:wrap;gap:5px;font-size:9px}.kumpul-transaction-status{max-width:120px;white-space:normal;text-align:center}.kumpul-transaction-body{align-items:flex-start;padding:14px;gap:10px}.kumpul-transaction-art{width:44px;height:44px;border-radius:12px;font-size:20px}.kumpul-transaction-item{gap:9px}.kumpul-transaction-item h2{font-size:11px}.kumpul-transaction-total strong{font-size:13px}.kumpul-transaction-actions{padding:0 14px 13px;flex-wrap:wrap}.kumpul-transaction-actions button,.kumpul-transaction-actions .kumpul-transaction-action-link{flex:1;padding:7px 8px;font-size:8px}}
    .kumpul-billing{max-width:980px;margin:0 auto}.kumpul-billing-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}.kumpul-billing-heading h1{margin:0;color:var(--kt-text);font-size:clamp(30px,4vw,42px);line-height:1.15;letter-spacing:-.04em}.kumpul-billing-description{margin:9px 0 0;color:var(--kt-muted);font-size:13px}.kumpul-billing-summary{display:flex;gap:10px}.kumpul-billing-summary-card{min-width:132px;padding:13px 16px;display:grid;gap:2px;border:1px solid var(--kt-border);border-radius:15px;background:var(--kt-surface)}.kumpul-billing-summary-card strong{font-size:21px;line-height:1.1}.kumpul-billing-summary-card span{color:var(--kt-muted);font-size:10px}.kumpul-billing-preview-note{margin:20px 0 0;padding:11px 14px;border:1px solid var(--kt-border);border-radius:12px;background:var(--kt-surface);color:var(--kt-muted);font-size:11px}.kumpul-billing-filters{margin:25px 0 22px;padding-bottom:7px;display:flex;gap:8px;overflow-x:auto;border-bottom:1px solid var(--kt-border);scrollbar-width:thin}.kumpul-billing-filters button{padding:9px 12px;display:inline-flex;align-items:center;gap:8px;border:1px solid transparent;border-radius:11px 11px 0 0;background:transparent;color:var(--kt-muted);font:inherit;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer}.kumpul-billing-filters button[aria-pressed=true]{border-color:var(--kt-border);border-bottom-color:var(--kt-surface);background:var(--kt-surface);color:var(--kt-accent)}.kumpul-billing-filters button span{min-width:20px;height:20px;padding:2px 6px;display:grid;place-items:center;border-radius:99px;background:var(--kt-bg);color:var(--kt-muted);font-size:9px}.kumpul-billing-results-heading{margin-bottom:12px;display:flex;align-items:baseline;justify-content:space-between;gap:12px}.kumpul-billing-results-heading h2{margin:0;font-size:16px}.kumpul-billing-results-heading span{color:var(--kt-muted);font-size:11px}.kumpul-billing-list{display:grid;gap:12px}.kumpul-billing-card{overflow:hidden;border:1px solid var(--kt-border);border-radius:16px;background:var(--kt-surface)}.kumpul-billing-card-top{padding:17px 19px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-bottom:1px solid #e8f0f2}.kumpul-billing-kind{color:var(--kt-accent);font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.kumpul-billing-card h3{margin:4px 0 0;font-size:14px}.kumpul-billing-card-linked{position:relative;transition:border-color .15s,box-shadow .15s}.kumpul-billing-card-linked:hover{border-color:var(--kt-accent);box-shadow:0 8px 22px rgba(15,23,42,.06)}.kumpul-billing-card-linked:focus-within{border-color:var(--kt-accent)}.kumpul-billing-card-link{color:inherit;text-decoration:none;outline:none}.kumpul-billing-card-link::after{content:'';position:absolute;inset:0;z-index:0;border-radius:inherit}.kumpul-billing-card-linked .kumpul-billing-status,.kumpul-billing-card-linked .kumpul-billing-action{position:relative;z-index:1}.kumpul-billing-card-top p{margin:5px 0 0;color:var(--kt-muted);font-size:10px}.kumpul-billing-status{padding:6px 9px;flex:none;border-radius:99px;font-size:9px;font-weight:800}.kumpul-billing-status-warning{background:#fff4da;color:#a15c00}.kumpul-billing-status-success{background:#e5f7ef;color:#08734f}.kumpul-billing-status-muted{background:#eef1f4;color:#64748b}.kumpul-billing-card-bottom{padding:14px 19px;display:flex;align-items:center;justify-content:space-between;gap:16px}.kumpul-billing-card-bottom strong{font-size:17px;color:var(--kt-accent)}.kumpul-billing-card-bottom p{margin:4px 0 0;color:var(--kt-muted);font-size:10px}.kumpul-billing-action{min-height:36px;padding:8px 13px;border:0;border-radius:10px;background:var(--kt-accent);color:#fff;font:inherit;font-size:10px;font-weight:750;opacity:.62;cursor:not-allowed}.kumpul-billing-empty{margin:0;padding:32px 18px;border:1px dashed var(--kt-border);border-radius:15px;color:var(--kt-muted);font-size:12px;text-align:center}
    @media(max-width:700px){.kumpul-billing-heading{align-items:flex-start;flex-direction:column;gap:16px}.kumpul-billing-summary{width:100%}.kumpul-billing-summary-card{min-width:0;flex:1;padding:11px 13px}.kumpul-billing-summary-card strong{font-size:18px}.kumpul-billing-filters{margin-top:20px}.kumpul-billing-card-top{padding:15px;gap:10px}.kumpul-billing-card h3{font-size:13px}.kumpul-billing-status{max-width:120px;white-space:normal;text-align:center}.kumpul-billing-card-bottom{padding:13px 15px}.kumpul-billing-card-bottom strong{font-size:15px}}
    .kumpul-calendar-agenda:not([open]){display:none}.kumpul-calendar-agenda[open]{position:fixed;inset:50% auto auto 50%;z-index:10;width:min(560px,calc(100vw - 32px));max-height:calc(100dvh - 48px);margin:0;padding:0;display:flex;flex-direction:column;transform:translate(-50%,-50%);overflow:hidden;border:1px solid var(--kt-border);border-radius:22px;background:var(--kt-bg);color:var(--kt-text);box-shadow:0 24px 80px #0f172a45}.kumpul-calendar-agenda::backdrop{background:rgb(15 23 42 / 45%);backdrop-filter:blur(2px)}.kumpul-calendar-agenda-handle{display:none}.kumpul-calendar-agenda-heading{padding:22px 24px 16px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-bottom:1px solid var(--kt-border)}.kumpul-calendar-agenda-heading .kumpul-eyebrow{margin:0 0 4px}.kumpul-calendar-agenda-heading h2{margin:0;font-size:20px;text-transform:capitalize}.kumpul-calendar-agenda-close{width:36px;height:36px;flex:none;border:1px solid var(--kt-border);border-radius:50%;background:var(--kt-surface);color:var(--kt-text);font:inherit;font-size:22px;line-height:1;cursor:pointer}.kumpul-calendar-agenda-content{min-height:0;padding:18px 24px 24px;overflow:auto;overscroll-behavior:contain}.kumpul-calendar-agenda-list{display:grid;gap:10px}.kumpul-calendar-empty{margin:0;padding:18px;border:1px dashed var(--kt-border);border-radius:14px;color:var(--kt-muted);font-size:13px;text-align:center}
    @media(max-width:620px){.kumpul-calendar-agenda[open]{inset:auto 0 0;width:100%;max-width:none;max-height:min(84dvh,720px);padding-bottom:env(safe-area-inset-bottom);transform:none;border-right:0;border-bottom:0;border-left:0;border-radius:22px 22px 0 0}.kumpul-calendar-agenda-handle{width:38px;height:4px;margin:10px auto 0;display:block;border-radius:99px;background:#cbd5e1}.kumpul-calendar-agenda-heading{padding:14px 20px 14px}.kumpul-calendar-agenda-content{padding:16px 20px 22px}.kumpul-calendar-agenda-close{width:34px;height:34px}}
    .kumpul-calendar-month-toolbar{margin:22px 0 14px;padding:17px 19px;display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid var(--kt-border);border-radius:17px;background:var(--kt-surface)}.kumpul-calendar-month-title h2{margin:0;font-size:20px;line-height:1.2;text-transform:capitalize}.kumpul-calendar-month-title p{margin:5px 0 0;color:var(--kt-muted);font-size:11px}.kumpul-calendar-month-actions{display:flex;align-items:center;gap:7px}.kumpul-calendar-month-actions button{min-width:38px;height:38px;padding:7px 11px;border:1px solid var(--kt-border);border-radius:11px;background:var(--kt-surface);color:var(--kt-text);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.kumpul-calendar-month-actions button[data-calendar-previous],.kumpul-calendar-month-actions button[data-calendar-next]{font-size:22px;line-height:1}.kumpul-calendar-month-view{overflow:hidden;border:1px solid var(--kt-border);border-radius:17px;background:var(--kt-surface)}.kumpul-calendar-weekdays,.kumpul-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}.kumpul-calendar-weekdays{border-bottom:1px solid var(--kt-border);background:#f8fbfc}.kumpul-calendar-weekdays span{padding:10px 6px;color:var(--kt-muted);font-size:10px;font-weight:750;text-align:center}.kumpul-calendar-day{position:relative;min-width:0;min-height:77px;padding:9px;display:flex;align-items:flex-start;justify-content:space-between;gap:4px;border:0;border-right:1px solid #e8f0f2;border-bottom:1px solid #e8f0f2;background:var(--kt-surface);color:var(--kt-text);font:inherit;text-align:left;cursor:pointer}.kumpul-calendar-day:nth-child(7n){border-right:0}.kumpul-calendar-day:nth-last-child(-n+7){border-bottom:0}.kumpul-calendar-day:hover{background:#f4fafb}.kumpul-calendar-day[aria-pressed=true]{background:#e6f4f6;box-shadow:inset 0 0 0 2px var(--kt-accent)}.kumpul-calendar-day[data-outside-month=true]{color:#a7b3bd;background:#fbfcfd}.kumpul-calendar-day>span{font-size:11px;font-weight:700}.kumpul-calendar-day small{min-width:19px;height:19px;padding:2px 5px;display:grid;place-items:center;border-radius:999px;background:var(--kt-accent);color:#fff;font-size:9px;font-weight:800}.kumpul-calendar-day:focus-visible,.kumpul-calendar-month-actions button:focus-visible{position:relative;z-index:1;outline:3px solid var(--kt-success);outline-offset:-3px}.kumpul-calendar-agenda{margin-top:24px}.kumpul-calendar-agenda>h3{margin:0 0 12px;font-size:16px;text-transform:capitalize}.kumpul-calendar-event{padding:14px 16px;display:grid;grid-template-columns:76px 1fr;align-items:start;gap:14px;border:1px solid var(--kt-border);border-left:4px solid var(--kt-accent);border-radius:14px;background:var(--kt-surface)}.kumpul-calendar-event[hidden]{display:none}.kumpul-calendar-event-linked{position:relative;transition:border-color .15s,box-shadow .15s}.kumpul-calendar-event-linked:hover,.kumpul-calendar-event-linked:focus-within{border-color:var(--kt-accent);box-shadow:0 8px 22px rgba(15,23,42,.06)}.kumpul-calendar-event-link{color:inherit;text-decoration:none;outline:none}.kumpul-calendar-event-link::after{content:'';position:absolute;inset:0;border-radius:inherit}.kumpul-calendar-event-invitation{border-left-color:var(--kt-success)}.kumpul-calendar-event-time{padding-top:2px;color:var(--kt-accent);font-size:11px;font-weight:800}.kumpul-calendar-event-copy{min-width:0}.kumpul-calendar-event-kind{color:var(--kt-muted);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.kumpul-calendar-event-copy h4{margin:3px 0 0;font-size:13px}.kumpul-calendar-event-copy p{margin:4px 0 0;color:var(--kt-muted);font-size:10px}
    @media(max-width:620px){.kumpul-calendar-month-toolbar{padding:13px;align-items:flex-start}.kumpul-calendar-month-title h2{font-size:17px}.kumpul-calendar-month-title p{max-width:170px;font-size:9px}.kumpul-calendar-month-actions{gap:4px}.kumpul-calendar-month-actions button{min-width:33px;height:34px;padding:5px 8px;font-size:10px}.kumpul-calendar-weekdays span{padding:8px 2px;font-size:9px}.kumpul-calendar-day{min-height:55px;padding:6px 5px}.kumpul-calendar-day>span{font-size:10px}.kumpul-calendar-day small{min-width:16px;height:16px;padding:1px 4px;font-size:8px}.kumpul-calendar-event{grid-template-columns:52px 1fr;gap:9px;padding:12px}.kumpul-calendar-event-time{font-size:10px}}
    @media(max-width:620px){.kumpul-calendar-tabs{overflow-x:auto}.kumpul-calendar-tabs button{flex:none;white-space:nowrap}}
    .kumpul-template{--kt-bg:${colors.background};--kt-surface:${colors.surface};--kt-text:${colors.text};--kt-muted:${colors.textMuted};--kt-accent:${colors.accent};--kt-hover:${colors.accentHover};--kt-border:${colors.border};--kt-success:${colors.success};--kt-warning:${colors.warning};min-height:100vh;background:var(--kt-bg);color:var(--kt-text);font:400 15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .kumpul-template *{box-sizing:border-box}.kumpul-template [hidden]{display:none!important}.kumpul-template a{color:inherit;text-decoration:none}.kumpul-template a:focus-visible{outline:3px solid var(--kt-success);outline-offset:3px}
    .kumpul-icon{width:20px;height:20px;flex:none}.kumpul-header{position:sticky;top:0;z-index:10;background:var(--kt-surface);border-bottom:1px solid var(--kt-border)}
    .kumpul-header-main{min-height:72px;max-width:1280px;margin:auto;padding:12px 28px;display:flex;align-items:center;justify-content:space-between;gap:24px}
    .kumpul-brand{display:flex;align-items:center;gap:12px;min-width:0}.kumpul-logo,.kumpul-logo-mark{width:44px;height:44px;flex:none;border-radius:15px}.kumpul-logo{object-fit:cover}.kumpul-logo-mark{display:grid;place-items:center;background:var(--kt-accent);color:#fff;font-size:17px;font-weight:800;letter-spacing:-.04em}
    .kumpul-brand-copy{display:grid;line-height:1.2}.kumpul-brand-copy strong{font-size:17px;letter-spacing:-.02em}.kumpul-brand-copy small{margin-top:5px;color:var(--kt-muted);font-size:10px;font-weight:750;letter-spacing:.13em;text-transform:uppercase}
    .kumpul-utilities{display:flex;align-items:center;justify-content:flex-end;gap:7px}.kumpul-utilities>a{display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:999px;color:var(--kt-muted);font-size:12px;font-weight:650;transition:background .16s,color .16s}.kumpul-utilities>a:hover,.kumpul-utilities>a[aria-current=page]{background:var(--kt-bg);color:var(--kt-accent)}.kumpul-utilities .kumpul-login{background:var(--kt-accent);color:#fff}
    .kumpul-page-nav{min-height:52px;padding:7px 24px;display:flex;align-items:center;justify-content:center;gap:8px;border-top:1px solid #eef2f4}.kumpul-page-nav a{padding:8px 16px;border:1px solid transparent;border-radius:999px;color:var(--kt-muted);font-size:13px;font-weight:650;white-space:nowrap}.kumpul-page-nav a:hover{border-color:var(--kt-border);color:var(--kt-accent)}.kumpul-page-nav a[aria-current=page]{background:var(--kt-text);color:#fff}
    .kumpul-main{max-width:1280px;margin:0 auto;padding:32px 28px 80px}.kumpul-hero{display:grid;grid-template-columns:1.08fr .92fr;min-height:430px;overflow:hidden;border:1px solid var(--kt-border);border-radius:28px;background:var(--kt-surface);box-shadow:0 12px 40px #0f172a0b}
    .kumpul-hero-copy{align-self:center;padding:clamp(28px,5vw,64px)}.kumpul-pill{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid var(--kt-border);border-radius:999px;background:var(--kt-bg);color:var(--kt-accent);font-size:11px;font-weight:750;letter-spacing:.045em}
    .kumpul-community-pill{margin-bottom:20px}.kumpul-status-dot{width:8px;height:8px;border-radius:50%;background:var(--kt-success);box-shadow:0 0 0 4px #0e9f6e1d}.kumpul-hero h1{max-width:620px;margin:0;font-size:clamp(42px,6.1vw,76px);line-height:.98;font-weight:850;letter-spacing:-.065em}.kumpul-hero-description{max-width:540px;margin:20px 0 0;color:var(--kt-muted);font-size:15px;line-height:1.75}
    .kumpul-hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.kumpul-button{min-height:44px;padding:11px 17px;display:inline-flex;align-items:center;justify-content:center;gap:10px;border:1px solid transparent;border-radius:999px;font-size:13px;font-weight:750;transition:background .16s,transform .16s}.kumpul-button:hover{transform:translateY(-1px)}.kumpul-button .kumpul-icon{width:17px;height:17px}.kumpul-button-primary{background:var(--kt-accent);color:#fff!important}.kumpul-button-primary:hover{background:var(--kt-hover)}.kumpul-button-secondary{border-color:var(--kt-border);background:var(--kt-bg);color:var(--kt-text)}
    .kumpul-stats{display:flex;gap:clamp(20px,4vw,48px);margin-top:28px}.kumpul-stat{display:grid;gap:2px}.kumpul-stat strong{font-size:22px;line-height:1.2;letter-spacing:-.04em}.kumpul-stat span{color:var(--kt-muted);font-size:11px}
    .kumpul-feature-card{position:relative;min-height:360px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;background:radial-gradient(ellipse at 68% 30%,#6ca8c6 0,#00608e 53%,#004b70 100%);color:#fff}
    .kumpul-about-section{max-width:1180px;min-height:390px;margin:12px auto 0;padding:clamp(26px,5vw,58px);display:grid;grid-template-columns:1fr .85fr;align-items:center;gap:clamp(28px,6vw,72px);overflow:hidden;border:1px solid var(--kt-border);border-radius:26px;background:var(--kt-surface)}.kumpul-about-copy h1{max-width:650px;margin:0;font-size:clamp(34px,5vw,60px);line-height:1.03;font-weight:850;letter-spacing:-.06em}.kumpul-about-body{max-width:620px;margin:20px 0 0;color:var(--kt-muted);font-size:15px;line-height:1.8;white-space:pre-line}.kumpul-about-art,.kumpul-about-image{position:relative;min-height:270px;display:grid;place-items:center;overflow:hidden;border-radius:22px;background:radial-gradient(ellipse at 60% 40%,#6ca8c6 0,#00608e 58%,#004b70 100%)}.kumpul-about-art:before,.kumpul-about-art:after{position:absolute;width:270px;height:270px;border:1px solid #ffffff50;border-radius:50%;content:""}.kumpul-about-art:after{width:360px;height:360px}.kumpul-about-art span{position:absolute;z-index:1;display:grid;place-items:center;width:104px;height:104px;border:1px solid #ffffff70;border-radius:30px;background:#ffffff25;font-size:55px;box-shadow:0 16px 36px #002b443d}.kumpul-about-art span:first-child{transform:translate(-42px,-18px) rotate(-9deg)}.kumpul-about-art span:last-child{transform:translate(48px,40px) rotate(9deg)}.kumpul-about-image img{position:absolute;width:100%;height:100%;inset:0;object-fit:cover}
    .kumpul-gallery-grid{margin-top:24px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:180px;gap:14px}.kumpul-gallery-item{position:relative;margin:0;display:grid;place-items:center;overflow:hidden;border:1px solid var(--kt-border);border-radius:18px;background:linear-gradient(135deg,#d9eff0,#91c4c9)}.kumpul-gallery-item:nth-child(3n+2){grid-row:span 2}.kumpul-gallery-item img{position:absolute;width:100%;height:100%;inset:0;object-fit:cover;transition:transform .25s}.kumpul-gallery-item:hover img{transform:scale(1.04)}.kumpul-gallery-item>span{font-size:48px;filter:drop-shadow(0 10px 12px #163c3b25)}.kumpul-gallery-item figcaption{position:absolute;right:10px;bottom:10px;left:10px;padding:8px 10px;border:1px solid #ffffff80;border-radius:10px;background:#fffffff0;color:var(--kt-text);font-size:11px;font-weight:700}
    .kumpul-process-list{margin:28px 0 0;padding:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));list-style:none;border:1px solid var(--kt-border);border-radius:20px;background:var(--kt-surface)}.kumpul-process-step{min-width:0;padding:22px 18px;display:flex;flex-direction:column;align-items:flex-start;gap:10px}.kumpul-process-step+.kumpul-process-step{border-left:1px solid var(--kt-border)}.kumpul-process-step h2{margin:0;font-size:14px}.kumpul-process-step p{margin:0;color:var(--kt-muted);font-size:11px;line-height:1.6}.kumpul-process-step small{margin-top:auto;color:var(--kt-accent);font-size:10px;font-weight:750}
    .kumpul-faq-list{margin-top:24px;display:grid;gap:10px}.kumpul-faq-item{padding:17px 19px;border:1px solid var(--kt-border);border-radius:15px;background:var(--kt-surface)}.kumpul-faq-item summary{font-size:13px;font-weight:750;cursor:pointer;list-style:none}.kumpul-faq-item summary::-webkit-details-marker{display:none}.kumpul-faq-item summary:after{float:right;color:var(--kt-accent);content:"+";font-size:18px;line-height:1}.kumpul-faq-item[open] summary:after{content:"−"}.kumpul-faq-item p{margin:12px 0 0;color:var(--kt-muted);font-size:12px;line-height:1.7;white-space:pre-line}
    .kumpul-feature-location{position:relative;z-index:1;align-self:flex-start;display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid #ffffff44;border-radius:999px;background:#ffffffec;color:#28576a;font-size:11px;font-weight:700}.kumpul-feature-location .kumpul-icon{width:16px;height:16px}
    .kumpul-feature-art{position:absolute;inset:0;display:grid;place-items:center;overflow:hidden}.kumpul-feature-art:before,.kumpul-feature-art:after{position:absolute;content:"";border:1px solid #ffffff2c;border-radius:50%;width:310px;height:310px}.kumpul-feature-art:after{width:430px;height:430px}.kumpul-feature-art>span{position:relative;z-index:1;width:112px;height:112px;display:grid;place-items:center;border:1px solid #ffffff66;border-radius:34px;background:#ffffff20;font-size:56px;font-weight:800;letter-spacing:-.1em;transform:rotate(-8deg);box-shadow:0 18px 48px #002b443d}.kumpul-feature-art i{position:absolute;width:8px;height:8px;border-radius:50%;background:#c9edf2;box-shadow:0 0 18px #fff}.kumpul-feature-art i:first-of-type{top:29%;right:22%}.kumpul-feature-art i:last-of-type{bottom:27%;left:19%;width:6px;height:6px}
    .kumpul-feature-note{position:relative;z-index:1;display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid #ffffffaa;border-radius:17px;background:#fff;color:var(--kt-text);box-shadow:0 10px 24px #002b4433}.kumpul-feature-note>span:nth-child(2){min-width:0;display:grid}.kumpul-feature-note strong{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.kumpul-feature-note small{margin-top:3px;color:var(--kt-muted);font-size:10px}.kumpul-avatar{width:36px;height:36px;flex:none;display:grid;place-items:center;border:1px solid var(--kt-border);border-radius:50%;background:var(--kt-bg);color:var(--kt-accent);font-size:12px;font-weight:800}.kumpul-check{width:25px;height:25px;flex:none;margin-left:auto;display:grid;place-items:center;border-radius:50%;background:var(--kt-success);color:#fff;font-weight:800}
    .kumpul-section{margin-top:76px}.kumpul-section-heading{max-width:680px}.kumpul-eyebrow{margin:0 0 10px;color:var(--kt-accent);font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}    .kumpul-section-heading .kumpul-section-title,.kumpul-cta h2{margin:0;font-size:clamp(26px,3.8vw,42px);line-height:1.08;font-weight:800;letter-spacing:-.05em}.kumpul-section-description{margin:12px 0 0;color:var(--kt-muted);font-size:13px}
    .kumpul-calendar{margin:10px auto 0;max-width:1120px}.kumpul-calendar-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}.kumpul-calendar-title{margin:0;font-size:clamp(32px,4vw,48px);line-height:1.05;font-weight:850;letter-spacing:-.055em}.kumpul-calendar-description{margin:12px 0 0;color:var(--kt-muted);font-size:14px}.kumpul-calendar-stats{display:flex;flex-wrap:wrap;gap:10px}.kumpul-calendar-stat{min-width:105px;padding:12px 15px;display:grid;gap:2px;border:1px solid var(--kt-border);border-radius:14px;background:var(--kt-surface)}.kumpul-calendar-stat strong{font-size:18px;line-height:1.2}.kumpul-calendar-stat span{color:var(--kt-muted);font-size:10px}.kumpul-calendar-preview-note{margin:22px 0 0;padding:12px 15px;border:1px solid var(--kt-border);border-radius:13px;background:#e6f4f6;color:#28576a;font-size:12px}.kumpul-calendar-tabs{margin-top:25px;display:flex;gap:8px;border-bottom:1px solid var(--kt-border)}.kumpul-calendar-tabs button{min-height:44px;padding:9px 14px;display:inline-flex;align-items:center;gap:8px;border:1px solid transparent;border-bottom:2px solid transparent;background:transparent;color:var(--kt-muted);font:inherit;font-size:13px;font-weight:700;cursor:pointer}.kumpul-calendar-tabs button[aria-selected=true]{border-bottom-color:var(--kt-accent);color:var(--kt-text)}.kumpul-calendar-tabs button>span,.kumpul-calendar-tabs button>b,.kumpul-calendar-filters button>span{padding:2px 7px;border-radius:999px;background:var(--kt-bg);color:var(--kt-muted);font-size:10px}.kumpul-calendar-tabs button>b{background:var(--kt-accent);color:#fff}.kumpul-calendar-filters{margin:20px 0;display:flex;gap:8px;overflow-x:auto;padding-bottom:3px}.kumpul-calendar-filters button{flex:none;padding:8px 11px;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--kt-border);border-radius:999px;background:var(--kt-surface);color:var(--kt-muted);font:inherit;font-size:11px;font-weight:650;cursor:pointer}.kumpul-calendar-filters button[aria-pressed=true]{border-color:var(--kt-accent);background:#e6f4f6;color:var(--kt-accent)}.kumpul-calendar-list{display:grid;gap:12px}.kumpul-calendar-card{padding:18px 20px;display:flex;align-items:center;justify-content:space-between;gap:18px;border:1px solid var(--kt-border);border-radius:17px;background:var(--kt-surface);box-shadow:0 7px 20px #0f172a08}.kumpul-calendar-card-copy{min-width:0}.kumpul-calendar-card-title{display:flex;align-items:center;flex-wrap:wrap;gap:9px}.kumpul-calendar-card-title h2{margin:0;font-size:15px;line-height:1.35}.kumpul-calendar-status,.kumpul-calendar-new{padding:4px 8px;border:1px solid var(--kt-border);border-radius:999px;color:var(--kt-muted);font-size:9px;font-weight:750}.kumpul-calendar-new{border-color:transparent;background:var(--kt-accent);color:#fff}.kumpul-calendar-meta{margin:6px 0 0;color:var(--kt-muted);font-size:11px}.kumpul-calendar-action{flex:none;min-height:38px;padding:8px 13px;border:1px solid var(--kt-border);border-radius:999px;background:var(--kt-bg);color:var(--kt-muted);font:inherit;font-size:10px;font-weight:700}.kumpul-calendar-action:disabled{opacity:.72}.kumpul-calendar-invitation-action{display:grid;justify-items:end;gap:7px}.kumpul-calendar-invitation-action>span{color:var(--kt-muted);font-size:10px}.kumpul-calendar-empty{margin:0;padding:28px 20px;border:1px dashed var(--kt-border);border-radius:15px;background:var(--kt-surface);color:var(--kt-muted);font-size:12px;text-align:center}.kumpul-calendar [hidden]{display:none!important}
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
    .kumpul-detail-page{max-width:980px;margin:0 auto}.kumpul-detail-back{display:inline-block;margin-bottom:20px;color:var(--kt-accent);font-size:11px;font-weight:750}.kumpul-detail-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.kumpul-detail-heading h1{margin:0;color:var(--kt-text);font-size:clamp(28px,4vw,40px);line-height:1.15;letter-spacing:-.04em}.kumpul-detail-heading .kumpul-eyebrow{margin-bottom:8px}.kumpul-detail-heading>div>p:last-child{margin:8px 0 0;color:var(--kt-muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}.kumpul-detail-preview-note{margin:18px 0 0;padding:11px 14px;border:1px solid var(--kt-border);border-radius:12px;background:var(--kt-surface);color:var(--kt-muted);font-size:10px}.kumpul-detail-layout{margin-top:22px;display:grid;grid-template-columns:minmax(0,1fr) 310px;align-items:start;gap:18px}.kumpul-detail-main{display:grid;gap:14px}.kumpul-detail-card{min-width:0;padding:20px;border:1px solid var(--kt-border);border-radius:17px;background:var(--kt-surface)}.kumpul-detail-card h2{margin:0 0 16px;font-size:14px}.kumpul-detail-fields{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.kumpul-detail-fields>div{min-width:0}.kumpul-detail-fields dt,.kumpul-detail-totals dt{color:var(--kt-muted);font-size:9px}.kumpul-detail-fields dd,.kumpul-detail-totals dd{margin:4px 0 0;font-size:11px;font-weight:700;overflow-wrap:anywhere}.kumpul-detail-total{margin-top:20px;padding-top:16px;display:flex;align-items:baseline;justify-content:space-between;gap:12px;border-top:1px solid var(--kt-border);color:var(--kt-muted);font-size:11px}.kumpul-detail-total strong{color:var(--kt-accent);font-size:22px}.kumpul-detail-aside{position:sticky;top:20px}.kumpul-detail-aside>p{margin:13px 0 0;color:var(--kt-muted);font-size:10px;line-height:1.6}.kumpul-detail-aside>button{width:100%;min-height:42px;margin-top:16px;padding:10px;border:0;border-radius:11px;background:var(--kt-accent);color:#fff;font:inherit;font-size:11px;font-weight:800;opacity:.55;cursor:not-allowed}.kumpul-detail-login-info{margin-top:15px;padding:13px;border-left:3px solid var(--kt-accent);background:var(--kt-bg)}.kumpul-detail-login-info h3{margin:0;font-size:11px}.kumpul-detail-login-info p{margin:7px 0 0;color:var(--kt-muted);font-size:10px;line-height:1.6}.kumpul-detail-items{display:grid}.kumpul-detail-item{padding:13px 0;display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:12px;border-top:1px solid var(--kt-border)}.kumpul-detail-item-art{width:48px;height:48px;display:grid;place-items:center;border:1px solid var(--kt-border);border-radius:13px;background:var(--kt-bg);color:var(--kt-accent);font-size:20px;font-weight:800}.kumpul-detail-item-copy{min-width:0}.kumpul-detail-item h3{margin:0;font-size:11px}.kumpul-detail-item p{margin:5px 0 0;color:var(--kt-muted);font-size:9px}.kumpul-detail-item>strong{font-size:10px;white-space:nowrap}.kumpul-detail-escrow-note{display:block;margin-top:5px;color:var(--kt-accent);font-size:8px;line-height:1.5}.kumpul-detail-address{margin:0;color:var(--kt-muted);font-size:11px;line-height:1.6}.kumpul-detail-totals{margin:0;display:grid;gap:12px}.kumpul-detail-totals>div{display:flex;justify-content:space-between;gap:12px}.kumpul-detail-totals dd{margin:0;text-align:right}.kumpul-detail-grand-total{padding-top:13px;border-top:1px solid var(--kt-border)}.kumpul-detail-grand-total dt{color:var(--kt-text);font-weight:800}.kumpul-detail-grand-total dd{color:var(--kt-accent);font-size:16px}.kumpul-detail-payment-fields{margin-top:17px;padding-top:14px;border-top:1px solid var(--kt-border)}.kumpul-detail-fields .kumpul-detail-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:9px}.kumpul-detail-payment-note{padding:10px 12px;border:1px solid var(--kt-border);border-radius:11px;background:var(--kt-bg)}
    .kumpul-plan-detail{max-width:980px;margin:0 auto}.kumpul-plan-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.kumpul-plan-heading h1{margin:0;color:var(--kt-text);font-size:clamp(28px,4vw,40px);line-height:1.15;letter-spacing:-.04em}.kumpul-plan-heading .kumpul-eyebrow{margin-bottom:8px}.kumpul-plan-number{margin:9px 0 0;color:var(--kt-muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px}.kumpul-plan-workflow{margin-top:20px;padding:17px;border:1px solid var(--kt-border);border-radius:16px;background:var(--kt-surface)}.kumpul-plan-current-step{margin:0 0 14px;color:var(--kt-muted);font-size:10px}.kumpul-plan-current-step strong{color:var(--kt-text)}.kumpul-plan-workflow ol{margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));list-style:none}.kumpul-plan-workflow li{min-width:0;padding:12px 9px 0;display:flex;align-items:center;gap:7px;border-top:2px solid var(--kt-border);color:var(--kt-muted);font-size:9px;font-weight:700}.kumpul-plan-workflow li.is-complete,.kumpul-plan-workflow li.is-current{border-color:var(--kt-accent);color:var(--kt-text)}.kumpul-plan-step-marker{width:21px;height:21px;flex:none;display:grid;place-items:center;border:1px solid var(--kt-border);border-radius:50%;font-size:9px}.kumpul-plan-workflow li.is-complete .kumpul-plan-step-marker,.kumpul-plan-workflow li.is-current .kumpul-plan-step-marker{border-color:var(--kt-accent);background:var(--kt-accent);color:#fff}.kumpul-plan-readonly{margin:12px 0 0;color:var(--kt-muted);font-size:9px;line-height:1.5}.kumpul-plan-layout{margin-top:16px;display:grid;grid-template-columns:minmax(0,1fr) 300px;align-items:start;gap:16px}.kumpul-plan-main{min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:14px}.kumpul-plan-options{margin:0;padding:0;display:grid;list-style:none}.kumpul-invite-terms-text{margin:0;color:var(--kt-muted);font-size:13px;line-height:1.7;white-space:pre-line}.kumpul-invite-mobilebar .kumpul-invite-terms-btn{width:56px;min-height:44px;flex:none;display:grid;align-content:center;justify-items:center;gap:2px;border:0;border-radius:10px;background:transparent;color:var(--kt-text);font:inherit;font-size:9px;font-weight:700;cursor:pointer}.kumpul-invite-terms-btn .kumpul-icon{width:20px;height:20px}@media(max-width:760px){.kumpul-invite-terms{display:none}}.kumpul-vote-summary{min-width:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:10px}.kumpul-vote-card{min-width:0;padding:12px;display:grid;align-content:start;gap:10px;border:1px solid var(--kt-border);border-radius:12px;background:var(--kt-bg)}.kumpul-vote-card-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.kumpul-vote-card-head h4{margin:0;min-width:0;overflow-wrap:anywhere;color:var(--kt-text);font-size:12px;font-weight:800}.kumpul-vote-card-head span{flex:none;color:var(--kt-muted);font-size:10px}.kumpul-vote-card-list{margin:0;padding:0;display:grid;gap:9px;list-style:none}.kumpul-vote-card-list li{min-width:0;display:grid;gap:4px}.kumpul-vote-card-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.kumpul-vote-card-name{min-width:0;overflow-wrap:anywhere;color:var(--kt-text);font-size:11px;line-height:1.35}.kumpul-vote-card-percent{flex:none;color:var(--kt-text);font-size:12px;font-weight:800}.kumpul-vote-card-bar{height:6px;display:block;overflow:hidden;border-radius:99px;background:var(--kt-border)}.kumpul-vote-card-bar>span{height:100%;display:block;border-radius:99px;background:color-mix(in srgb,var(--kt-accent) 45%,var(--kt-border))}.kumpul-vote-card-meta{color:var(--kt-muted);font-size:9px}.kumpul-vote-card-list li.is-leading .kumpul-vote-card-name{font-weight:800}.kumpul-vote-card-list li.is-leading .kumpul-vote-card-percent,.kumpul-vote-card-list li.is-leading .kumpul-vote-card-meta{color:var(--kt-accent)}.kumpul-vote-card-list li.is-leading .kumpul-vote-card-bar>span{background:var(--kt-accent)}.kumpul-plan-sim-soft .kumpul-reservation-count:not(.is-rejected){background:color-mix(in srgb,var(--kt-accent) 16%,#fff)}.kumpul-close-rsvp-points li[data-missing]{color:#b91c1c;font-weight:700}.kumpul-payment-filter-count{margin-left:6px;padding:1px 6px;border-radius:99px;background:var(--kt-bg);font-size:9px}.kumpul-payment-hint{margin:0 0 12px}.kumpul-reservation-dialog .kumpul-reservation-foot.kumpul-payment-foot{flex:none;padding:12px 20px;display:flex;justify-content:flex-end;border-top:1px solid var(--kt-border);background:var(--kt-surface)}.kumpul-payment-foot{gap:10px}.kumpul-payment-foot button{min-height:40px;padding:8px 16px}.kumpul-reservation-dialog .kumpul-payment-foot .kumpul-payment-checkout{border:1px solid var(--kt-accent);border-radius:9px;background:var(--kt-surface);color:var(--kt-accent);font:inherit;font-size:11px;font-weight:800;cursor:pointer}.kumpul-reservation-dialog .kumpul-payment-foot .kumpul-payment-checkout:disabled{opacity:.5;cursor:not-allowed}.kumpul-reservation-dialog .kumpul-payment-foot .kumpul-payment-confirm-mobile,.kumpul-reservation-dialog .kumpul-reservation-foot.kumpul-payment-foot.is-mobile-only{display:none}.kumpul-reservation-dialog .kumpul-payment-foot .kumpul-payment-confirm-mobile{border:1px solid var(--kt-accent);border-radius:9px;background:var(--kt-accent);color:#fff;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.kumpul-reservation-dialog .kumpul-payment-foot .kumpul-payment-confirm-mobile:disabled{opacity:.55;cursor:not-allowed}@media(max-width:760px){.kumpul-payment-confirm-mobile{display:inline-flex !important;align-items:center;justify-content:center}.kumpul-reservation-dialog .kumpul-reservation-foot.kumpul-payment-foot.is-mobile-only{display:flex}}.kumpul-payment-dialog .kumpul-plan-live-people{margin:0;padding:0;display:grid;gap:8px;list-style:none}@media(max-width:760px){.kumpul-reservation-dialog .kumpul-reservation-foot.kumpul-payment-foot{padding:12px 14px calc(12px + env(safe-area-inset-bottom,0px))}.kumpul-payment-foot button{flex:1;min-height:44px}}.kumpul-plan-refresh-row{min-width:0;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.kumpul-plan-refresh-copy{min-width:0;flex:1}.kumpul-plan-refresh{flex:none;min-height:34px;padding:7px 12px;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--kt-border);border-radius:99px;background:var(--kt-surface);color:var(--kt-text);font:inherit;font-size:10px;font-weight:800;cursor:pointer}.kumpul-plan-refresh:hover{border-color:var(--kt-accent);color:var(--kt-accent)}.kumpul-plan-refresh:disabled{opacity:.5;cursor:not-allowed}.kumpul-plan-refresh .kumpul-icon{width:15px;height:15px}.kumpul-plan-refresh.is-compact{width:34px;padding:0;justify-content:center;border-radius:50%}.kumpul-template .kumpul-plan-refresh[aria-busy=true] .kumpul-icon{display:none}.kumpul-template .kumpul-plan-refresh.is-compact[aria-busy=true]::before{margin-right:0}.kumpul-reservation-head-actions{flex:none;display:flex;align-items:center;gap:8px}.kumpul-plan-vote-section{min-width:0;margin:14px 0 0;padding:14px;display:grid;gap:12px;border:1px solid var(--kt-border);border-radius:14px;background:var(--kt-surface)}.kumpul-plan-vote-section-head h3{margin:0;color:var(--kt-text);font-size:13px;font-weight:800}.kumpul-plan-vote-section-head p{margin:3px 0 0;color:var(--kt-muted);font-size:10px;line-height:1.5}@media(max-width:760px){.kumpul-plan-vote-section{padding:12px;border-radius:12px}}.kumpul-invite-pick{min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:14px}.kumpul-invite-vote-rail{margin:0 -2px;padding:2px 2px 8px;list-style:none}.kumpul-invite-vote-item{min-width:0;display:flex}.kumpul-invite-vote-item>.kumpul-option-tile{width:100%}.kumpul-invite-attendee{margin:0;padding:10px 12px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;border:1px solid var(--kt-border);border-radius:12px;background:var(--kt-bg)}.kumpul-invite-attendee dt{color:var(--kt-muted);font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.kumpul-invite-attendee dd{margin:3px 0 0;overflow:hidden;font-size:12px;font-weight:700;text-overflow:ellipsis;white-space:nowrap}@media(max-width:760px){.kumpul-invite-attendee{grid-template-columns:1fr}}.kumpul-reservation-confirm-dialog.is-accent .kumpul-reservation-confirm-icon{background:color-mix(in srgb,var(--kt-accent) 14%,#fff);color:var(--kt-accent)}.kumpul-reservation-confirm-dialog.is-accent .kumpul-reservation-confirm-actions .kumpul-reservation-confirm-submit{border-color:var(--kt-accent);background:var(--kt-accent)}.kumpul-close-rsvp-points{margin:2px 0 0;padding:10px 12px 10px 28px;display:grid;gap:4px;border-radius:10px;background:var(--kt-bg);color:var(--kt-muted);font-size:11px;line-height:1.5}.kumpul-reservation-confirm-dialog[open]{visibility:visible}.kumpul-invite-mobile-only{display:none}.kumpul-invite-add{display:flex}.kumpul-invite-sheet{width:min(560px,calc(100vw - 32px));max-height:88vh;max-height:88dvh;margin:auto;padding:0;overflow:auto;border:1px solid var(--kt-border);border-radius:20px;background:var(--kt-surface);color:var(--kt-text);box-shadow:0 24px 80px #0f172a40}.kumpul-invite-sheet.is-wide{width:min(760px,calc(100vw - 32px))}.kumpul-invite-sheet::backdrop{background:#0f172a6b;backdrop-filter:blur(2px)}.kumpul-invite-sheet[open]{visibility:visible}.kumpul-invite-sheet-head{position:sticky;top:0;z-index:1;padding:16px 18px 12px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid var(--kt-border);background:var(--kt-surface)}.kumpul-invite-sheet-head strong{display:block;font-size:15px}.kumpul-invite-sheet-head span{display:block;margin-top:2px;color:var(--kt-muted);font-size:11px}.kumpul-invite-sheet-body{min-width:0;padding:14px 18px 18px;display:grid;grid-template-columns:minmax(0,1fr);gap:12px}.kumpul-invite-sheet-actions{display:grid;gap:8px}.kumpul-invite-sheet-actions button{width:100%;min-height:46px}.kumpul-invite-sheet .kumpul-invite-otp input{max-width:none}@media(max-width:760px){.kumpul-invite-mobile-only{display:block}.kumpul-invite-otp-inline,.kumpul-invite-add{display:none}.kumpul-invite-sheet,.kumpul-invite-sheet.is-wide{width:100vw;max-width:none;max-height:90vh;max-height:90dvh;margin:auto 0 0;border-right:0;border-bottom:0;border-left:0;border-radius:20px 20px 0 0}.kumpul-invite-sheet-head:before{content:'';position:absolute;top:6px;left:50%;width:36px;height:4px;margin-left:-18px;border-radius:2px;background:var(--kt-border)}.kumpul-invite-sheet-body{padding-bottom:calc(18px + env(safe-area-inset-bottom,0px))}}.kumpul-invite-page{max-width:880px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:16px}.kumpul-invite-hero{overflow:hidden;border:1px solid var(--kt-border);border-radius:22px;background:var(--kt-surface)}.kumpul-invite-hero-banner{width:100%;aspect-ratio:16/7;display:grid;place-items:center;object-fit:cover;background:color-mix(in srgb,var(--kt-accent) 12%,#fff);color:var(--kt-accent)}.kumpul-invite-hero-banner.is-empty .kumpul-icon{width:44px;height:44px}.kumpul-invite-hero-copy{padding:18px 20px 20px}.kumpul-invite-hero-copy h1{margin:4px 0 0;font-size:clamp(24px,4vw,34px);line-height:1.15;letter-spacing:-.03em}.kumpul-invite-host{margin:8px 0 0;color:var(--kt-muted);font-size:12px}.kumpul-invite-host strong{color:var(--kt-text)}.kumpul-invite-chips{margin-top:12px;display:flex;flex-wrap:wrap;gap:6px}.kumpul-invite-chip{padding:5px 10px;border-radius:99px;background:var(--kt-bg);color:var(--kt-muted);font-size:10px;font-weight:800}.kumpul-invite-chip.is-open{background:color-mix(in srgb,var(--kt-accent) 12%,#fff);color:var(--kt-accent)}.kumpul-invite-facts{margin:0}.kumpul-detail-card.kumpul-invite-description{margin:0;color:var(--kt-muted);font-size:13px;line-height:1.7}.kumpul-invite-flow{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;min-width:0}.kumpul-invite-vote{min-width:0;display:grid;gap:14px}.kumpul-invite-vote-group{min-width:0;display:grid;gap:8px}.kumpul-invite-vote-tile{position:relative;padding-left:40px}.kumpul-invite-vote-tile.is-readonly{padding-left:10px}.kumpul-invite-vote-tile.is-readonly.is-selected,.kumpul-invite-vote-tile:has(.kumpul-invite-vote-radio:checked){border-color:var(--kt-accent);box-shadow:inset 0 0 0 1px var(--kt-accent);background:color-mix(in srgb,var(--kt-accent) 5%,var(--kt-surface))}.kumpul-invite-vote-radio{position:absolute;top:50%;left:12px;width:20px;height:20px;margin:0;transform:translateY(-50%);accent-color:var(--kt-accent);cursor:pointer}.kumpul-invite-vote-bar{height:5px;overflow:hidden;border-radius:99px;background:var(--kt-bg)}.kumpul-invite-vote-bar>span{height:100%;display:block;border-radius:99px;background:var(--kt-accent)}.kumpul-invite-vote-meta{color:var(--kt-accent);font-size:9px;font-weight:800}.kumpul-invite-rsvp{display:grid;gap:10px}.kumpul-invite-rsvp h2{margin:0;font-size:17px}.kumpul-invite-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.kumpul-invite-field{display:grid;gap:5px;font-size:11px;font-weight:700}.kumpul-invite-field input{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--kt-border);border-radius:12px;background:#fff;color:var(--kt-text);font:inherit;font-size:14px;font-weight:500}.kumpul-invite-field input:focus{outline:none;border-color:var(--kt-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--kt-accent) 15%,transparent)}.kumpul-invite-otp input{max-width:220px;font-size:22px;font-weight:800;letter-spacing:.4em;text-align:center}.kumpul-invite-actions{display:flex;flex-wrap:wrap;gap:8px}.kumpul-invite-actions .kumpul-product-primary{flex:0 1 auto;min-width:220px}.kumpul-invite-success{display:flex;align-items:flex-start;gap:12px}.kumpul-invite-success-icon{width:40px;height:40px;flex:none;display:grid;place-items:center;border-radius:50%;background:color-mix(in srgb,var(--kt-success,#16a34a) 15%,#fff);color:var(--kt-success,#16a34a);font-size:20px;font-weight:900}.kumpul-invite-success p{margin:4px 0 0;color:var(--kt-muted);font-size:12px}.kumpul-invite-pay-chip{padding:3px 8px;border-radius:99px;background:#fff4da;color:#a15c00;font-size:10px;font-weight:800}.kumpul-invite-pay-chip.is-paid{background:#e5f7ef;color:#08734f}.kumpul-invite-more{border-top:1px solid var(--kt-border);padding-top:10px}.kumpul-invite-more summary{color:var(--kt-accent);font-size:12px;font-weight:800;cursor:pointer}.kumpul-invite-more-body{margin-top:10px;display:grid;gap:10px}.kumpul-invite-link-btn{width:fit-content;min-height:44px;padding:10px 18px;display:inline-flex;align-items:center;border:1px solid var(--kt-accent);border-radius:12px;background:var(--kt-accent);color:#fff;font-size:12px;font-weight:800;text-decoration:none}.kumpul-invite-link-btn.is-secondary{background:#fff;color:var(--kt-accent)}.kumpul-invite-warning{margin:0;padding:10px 12px;border-left:3px solid #f59e0b;border-radius:8px;background:#fffbeb;color:#92400e;font-size:12px}.kumpul-invite-terms summary{font-size:13px;font-weight:800;cursor:pointer}.kumpul-invite-terms p{margin:10px 0 0;color:var(--kt-muted);font-size:12px;line-height:1.7;white-space:pre-line}.kumpul-invite-valid{margin:0;color:var(--kt-muted);font-size:11px;text-align:center}@media(max-width:760px){.kumpul-invite-fields{grid-template-columns:1fr}.kumpul-invite-rsvp .kumpul-invite-actions{display:none}.kumpul-invite-page{padding-bottom:calc(72px + var(--kumpul-dock-offset))}.kumpul-invite-hero{border-radius:18px}.kumpul-invite-hero-copy{padding:14px 16px 16px}}.kumpul-invite-share-actions{margin:10px 0 6px;display:flex;flex-wrap:wrap;gap:8px}.kumpul-invite-share-btn{min-height:40px;padding:8px 14px;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--kt-accent);border-radius:11px;background:#fff;color:var(--kt-accent);font:inherit;font-size:12px;font-weight:800;cursor:pointer}.kumpul-invite-share-btn.is-primary{background:var(--kt-accent);color:#fff}.kumpul-invite-share-btn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.kumpul-template .kumpul-invite-share-btn[aria-busy=true]{cursor:progress}.kumpul-invite-share-qr>div{width:100%;min-width:0}.kumpul-invite-share-qr .kumpul-invite-share-url{margin-top:10px;padding:9px 10px;border:1px solid var(--kt-border);border-radius:10px;background:var(--kt-bg);color:var(--kt-text);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;line-height:1.45;text-align:left}.kumpul-invite-share-qr .kumpul-invite-share-actions{margin:10px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:8px}.kumpul-invite-share-qr .kumpul-invite-share-btn{width:100%;min-height:44px;justify-content:center;text-decoration:none}.kumpul-invite-share-qr .kumpul-invite-share-btn.is-ghost{grid-column:1/-1;border-color:var(--kt-border);background:var(--kt-bg);color:var(--kt-text)}.kumpul-invite-share-qr .kumpul-invite-share-btn.is-ghost:hover{border-color:var(--kt-accent);color:var(--kt-accent)}.kumpul-invite-share-btn[data-bagdja-share-state=copied]::after{content:' ✓'}@media(max-width:760px){.kumpul-invite-share-actions{display:grid;grid-template-columns:1fr 1fr}.kumpul-invite-share-btn{justify-content:center;min-height:44px}}.kumpul-invite-description.is-rich>*{margin:0 0 8px}.kumpul-invite-description.is-rich>:last-child{margin-bottom:0}.kumpul-invite-description.is-rich ul,.kumpul-invite-description.is-rich ol{padding-left:20px}.kumpul-invite-description.is-rich a{color:var(--kt-accent);text-decoration:underline}.kumpul-invite-description:not(.is-rich){white-space:pre-line}.kumpul-rich-field{display:grid;gap:6px}.kumpul-rich-label{font-size:11px;font-weight:700}.kumpul-rich-field.is-ready textarea[data-rich-source]{display:none}.kumpul-rich-box{overflow:hidden;border:1px solid var(--kt-border);border-radius:12px;background:#fff}.kumpul-rich-box:focus-within{border-color:var(--kt-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--kt-accent) 15%,transparent)}.kumpul-rich-toolbar{padding:6px;display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--kt-border);background:var(--kt-bg)}.kumpul-rich-btn{min-width:34px;height:34px;padding:0 8px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--kt-text);font:inherit;font-size:13px;font-weight:800;cursor:pointer}.kumpul-rich-btn.is-italic{font-style:italic}.kumpul-rich-btn.is-underline{text-decoration:underline}.kumpul-rich-btn:hover{background:#fff;border-color:var(--kt-border)}.kumpul-rich-btn[aria-pressed=true]{background:var(--kt-accent);border-color:var(--kt-accent);color:#fff}.kumpul-rich-content .ProseMirror{min-height:140px;padding:12px 14px;outline:none;font-size:13px;line-height:1.6;overflow-wrap:anywhere}.kumpul-rich-content .ProseMirror>*{margin:0 0 8px}.kumpul-rich-content .ProseMirror ul,.kumpul-rich-content .ProseMirror ol{padding-left:20px}.kumpul-rich-content .ProseMirror a{color:var(--kt-accent);text-decoration:underline}.kumpul-rich-content .ProseMirror p.is-editor-empty:first-child::before{content:attr(data-placeholder);float:left;height:0;color:var(--kt-muted);pointer-events:none}@media(max-width:760px){.kumpul-rich-btn{min-width:40px;height:40px}.kumpul-rich-content .ProseMirror{font-size:15px}}.kumpul-plan-pick-fieldset{min-width:0}.kumpul-plan-pick{margin:4px -2px 0;padding:2px 2px 8px;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(300px,1fr);gap:12px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scrollbar-width:thin}.kumpul-plan-pick-group{min-width:0;padding:10px;display:grid;align-content:start;gap:8px;border:1px solid var(--kt-border);border-radius:14px;background:var(--kt-bg);scroll-snap-align:start}.kumpul-plan-pick-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}.kumpul-plan-pick-head h4{margin:0;color:var(--kt-muted);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.kumpul-plan-pick-head span{color:var(--kt-muted);font-size:9px}.kumpul-plan-pick-list{margin:0;padding:0;display:grid;gap:8px;list-style:none}.kumpul-plan-pick-item{position:relative;width:100%;padding-left:40px}.kumpul-plan-pick-item:has(.kumpul-plan-pick-check:checked){border-color:var(--kt-accent);box-shadow:inset 0 0 0 1px var(--kt-accent);background:color-mix(in srgb,var(--kt-accent) 5%,var(--kt-surface))}.kumpul-plan-pick-check{position:absolute;top:50%;left:12px;width:20px;height:20px;margin:0;transform:translateY(-50%);accent-color:var(--kt-accent);cursor:pointer}.kumpul-plan-pick-venue{color:var(--kt-accent);font-size:9px;font-weight:700}.kumpul-plan-pick-info{width:30px;height:30px;flex:none;align-self:center;display:grid;place-items:center;border:1px solid var(--kt-border);border-radius:50%;background:#fff;color:var(--kt-accent);font:italic 800 13px/1 Georgia,serif;cursor:pointer}.kumpul-plan-pick-info:hover{border-color:var(--kt-accent)}.kumpul-plan-option-dialog[open]{visibility:visible}@media(max-width:760px){.kumpul-plan-pick{grid-auto-columns:88%}}.kumpul-plan-desktop-actions{flex-wrap:nowrap;align-items:stretch}.kumpul-plan-desktop-actions>*{min-width:0;flex:1 1 0}.kumpul-plan-desktop-actions button,.kumpul-plan-desktop-actions .kumpul-plan-cancel-trigger{line-height:1.25;text-align:center}.kumpul-plan-sim-actions .kumpul-plan-discuss{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-color:var(--kt-accent);background:#fff;color:var(--kt-accent)}.kumpul-plan-sim-actions .kumpul-plan-discuss:hover{background:color-mix(in srgb,var(--kt-accent) 8%,#fff)}.kumpul-plan-discuss .kumpul-icon{width:15px;height:15px}.kumpul-datetime-trigger{display:none}.kumpul-dt-sheet{box-sizing:border-box;width:100vw;max-width:none;max-height:92vh;max-height:92dvh;margin:auto 0 0;padding:0;overflow:auto;border:0;border-radius:20px 20px 0 0;background:var(--kt-bg);color:var(--kt-text);box-shadow:0 -12px 32px #0f172a2e}.kumpul-dt-sheet::backdrop{background:#0f172a6b}.kumpul-dt-head{position:sticky;top:0;z-index:1;padding:18px 16px 10px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--kt-border);background:var(--kt-bg)}.kumpul-dt-head strong{font-size:14px}.kumpul-dt-head span{display:block;margin-top:2px;color:var(--kt-muted);font-size:11px}.kumpul-dt-close{width:36px;height:36px;border:1px solid var(--kt-border);border-radius:50%;background:#fff;color:var(--kt-text);font-size:20px;cursor:pointer}.kumpul-dt-body{padding:14px 16px;display:grid;grid-template-columns:minmax(0,1fr);gap:16px}.kumpul-dt-body>*{min-width:0}.kumpul-dt-month{display:flex;align-items:center;justify-content:space-between}.kumpul-dt-month strong{font-size:14px;text-transform:capitalize}.kumpul-dt-month button{width:40px;height:40px;border:1px solid var(--kt-border);border-radius:12px;background:#fff;color:var(--kt-text);font-size:20px;cursor:pointer}.kumpul-dt-month button:disabled{opacity:.35}.kumpul-dt-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center}.kumpul-dt-grid>span{padding:4px 0;color:var(--kt-muted);font-size:10px;font-weight:800}.kumpul-dt-grid button{aspect-ratio:1;min-height:40px;border:0;border-radius:12px;background:transparent;color:var(--kt-text);font:inherit;font-size:13px;font-weight:700;cursor:pointer}.kumpul-dt-grid button:disabled{color:var(--kt-border);cursor:not-allowed}.kumpul-dt-grid button[data-today]{box-shadow:inset 0 0 0 1px var(--kt-accent)}.kumpul-dt-grid button[aria-pressed=true]{background:var(--kt-accent);color:#fff}.kumpul-dt-label{margin-bottom:8px;color:var(--kt-muted);font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.kumpul-dt-hours{display:grid;grid-auto-flow:column;grid-auto-columns:52px;gap:6px;overflow-x:auto;padding-bottom:4px;scroll-snap-type:x proximity;scrollbar-width:none}.kumpul-dt-hours::-webkit-scrollbar{display:none}.kumpul-dt-minutes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.kumpul-dt-hours button,.kumpul-dt-minutes button{min-height:44px;border:1px solid var(--kt-border);border-radius:12px;background:#fff;color:var(--kt-text);font:inherit;font-size:13px;font-weight:700;cursor:pointer;scroll-snap-align:start}.kumpul-dt-hours button[aria-pressed=true],.kumpul-dt-minutes button[aria-pressed=true]{border-color:var(--kt-accent);background:var(--kt-accent);color:#fff}.kumpul-dt-summary{padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--kt-accent) 8%,#fff);color:var(--kt-accent);font-size:12px;font-weight:800;text-align:center}.kumpul-dt-foot{position:sticky;bottom:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:1fr 2fr;gap:8px;border-top:1px solid var(--kt-border);background:var(--kt-bg)}.kumpul-dt-foot button{min-height:46px;border:1px solid var(--kt-border);border-radius:12px;background:#fff;color:var(--kt-text);font:inherit;font-size:13px;font-weight:800;cursor:pointer}.kumpul-dt-foot .kumpul-dt-save{border-color:var(--kt-accent);background:var(--kt-accent);color:#fff}.kumpul-dt-foot .kumpul-dt-save:disabled{opacity:.5}@media(max-width:760px){.kumpul-datetime input[data-kumpul-datetime-input]{display:none}.kumpul-datetime-trigger{width:100%;min-height:46px;padding:10px 12px;display:flex;align-items:center;gap:10px;border:1px solid var(--kt-border);border-radius:12px;background:#fff;color:var(--kt-text);font:inherit;font-size:12px;font-weight:700;text-align:left;cursor:pointer}.kumpul-datetime-trigger .kumpul-icon{width:18px;height:18px;flex:none;color:var(--kt-accent)}.kumpul-datetime-trigger[data-empty] span{color:var(--kt-muted);font-weight:500}.kumpul-plan-mobilebar-primary{gap:6px}.kumpul-plan-mobilebar-primary .kumpul-plan-mobilebar-discuss{flex:none;padding:8px 12px;display:inline-flex;align-items:center;gap:6px;border:1px solid var(--kt-accent);background:#fff;color:var(--kt-accent)}.kumpul-plan-mobilebar-primary .kumpul-plan-mobilebar-discuss:only-child{flex:1;justify-content:center}.kumpul-plan-mobilebar-primary button.kumpul-plan-sim-soft{background:#fff;color:var(--kt-accent)}.kumpul-plan-mobilebar-primary.is-compact .kumpul-plan-mobilebar-discuss{padding:8px 11px}.kumpul-plan-mobilebar-primary.is-compact .kumpul-plan-mobilebar-discuss span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.kumpul-plan-mobilebar-discuss .kumpul-icon{width:16px;height:16px}}.kumpul-product-detail{max-width:1080px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:18px}.kumpul-product-top{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:26px;align-items:start}.kumpul-product-gallery{display:grid;gap:8px}.kumpul-product-cover{width:100%;aspect-ratio:4/3;display:grid;place-items:center;object-fit:cover;border:1px solid var(--kt-border);border-radius:18px;background:var(--kt-surface);color:var(--kt-accent)}.kumpul-product-cover.is-empty .kumpul-icon{width:42px;height:42px}.kumpul-product-thumbs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.kumpul-product-thumbs img{width:100%;aspect-ratio:1;object-fit:cover;border:1px solid var(--kt-border);border-radius:11px}.kumpul-product-info h1{margin:4px 0 0;font-size:clamp(24px,3.4vw,34px);line-height:1.15;letter-spacing:-.03em}.kumpul-product-price{margin:10px 0 0;color:var(--kt-accent);font-size:20px;font-weight:800}.kumpul-product-facts{margin:16px 0 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.kumpul-product-facts div{padding:10px 12px;border:1px solid var(--kt-border);border-radius:12px;background:var(--kt-surface)}.kumpul-product-facts dt{color:var(--kt-muted);font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.kumpul-product-facts dd{margin:4px 0 0;font-size:12px;font-weight:700}.kumpul-product-rich,.kumpul-product-plain{margin:16px 0 0;color:var(--kt-muted);font-size:13px;line-height:1.65}.kumpul-product-plain{white-space:pre-line}.kumpul-product-rich>*{margin:0 0 10px}.kumpul-product-rich>:last-child{margin-bottom:0}.kumpul-product-rich h2,.kumpul-product-rich h3{color:var(--kt-text);font-size:15px}.kumpul-product-rich ul,.kumpul-product-rich ol{padding-left:20px}.kumpul-product-rich a{color:var(--kt-accent);text-decoration:underline}.kumpul-product-rich img{max-width:100%;border-radius:12px}.kumpul-product-rich table{width:100%;border-collapse:collapse}.kumpul-product-rich td,.kumpul-product-rich th{padding:6px 8px;border:1px solid var(--kt-border);text-align:left}.kumpul-product-actions{margin-top:20px;display:flex;gap:8px}.kumpul-product-actions button,.kumpul-product-mobilebar button{min-height:44px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:12px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}.kumpul-product-primary,.kumpul-product-mobile-primary{flex:1;padding:10px 16px;border:1px solid var(--kt-accent);background:var(--kt-accent);color:#fff}.kumpul-product-secondary{padding:10px 14px;border:1px solid var(--kt-accent);background:color-mix(in srgb,var(--kt-accent) 10%,#fff);color:var(--kt-accent)}.kumpul-product-actions button:disabled,.kumpul-product-mobilebar button:disabled{opacity:.55;cursor:not-allowed}.kumpul-product-actions .kumpul-icon{width:18px;height:18px}.kumpul-product-hint{margin:10px 0 0;color:var(--kt-muted);font-size:10px}.kumpul-product-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}.kumpul-product-section-head h2{margin:0}.kumpul-product-section-head span{color:var(--kt-muted);font-size:10px;font-weight:700}.kumpul-product-options .kumpul-plan-option-groups{margin-top:12px}.kumpul-product-option-meta{display:grid;gap:4px;font-size:12px}.kumpul-product-option-meta strong{color:var(--kt-muted);font-size:9px;letter-spacing:.06em;text-transform:uppercase}.kumpul-product-option-meta ul{margin:0;padding-left:18px;color:var(--kt-text)}.kumpul-product-related h2{margin:6px 0 10px;font-size:16px}.kumpul-product-related-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}.kumpul-product-related-card{padding:10px;display:grid;gap:6px;border:1px solid var(--kt-border);border-radius:14px;background:var(--kt-surface);color:var(--kt-text);font-size:12px;text-decoration:none}.kumpul-product-related-card img,.kumpul-product-related-empty{width:100%;aspect-ratio:16/10;display:grid;place-items:center;object-fit:cover;border-radius:10px;background:color-mix(in srgb,var(--kt-accent) 10%,#fff);color:var(--kt-accent)}.kumpul-product-related-card span{color:var(--kt-accent);font-weight:700}.kumpul-product-mobilebar{display:none}@media(max-width:760px){.kumpul-product-top{grid-template-columns:1fr;gap:16px}.kumpul-product-actions{display:none}.kumpul-product-detail{padding-bottom:calc(72px + var(--kumpul-dock-offset))}.kumpul-product-mobilebar{position:fixed;z-index:20;right:0;bottom:var(--kumpul-dock-offset);left:0;padding:8px 12px calc(8px + var(--kumpul-bar-safe));display:flex;gap:8px;border-top:1px solid var(--kt-border);background:#fffffff5;box-shadow:0 -6px 18px #0f172a0f;backdrop-filter:blur(14px)}.kumpul-product-mobile-chat{width:48px;flex:none;border:1px solid var(--kt-border);background:#fff;color:var(--kt-text)}.kumpul-product-mobile-chat .kumpul-icon{width:20px;height:20px}}.kumpul-plan-option-groups{min-width:0;display:grid;grid-template-columns:minmax(0,1fr);gap:16px}.kumpul-option-rail-group{min-width:0}.kumpul-plan-option-groups[hidden],.kumpul-option-rail-group[hidden],.kumpul-option-tile[hidden]{display:none}.kumpul-option-rail-group h3{margin:0 0 8px;color:var(--kt-muted);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.kumpul-option-rail{margin:0 -2px;padding:2px 2px 8px;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(260px,320px);gap:10px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x mandatory;scrollbar-width:thin;-webkit-overflow-scrolling:touch}.kumpul-option-tile{min-width:0;padding:10px;display:flex;align-items:center;gap:12px;border:1px solid var(--kt-border);border-radius:14px;background:var(--kt-surface);color:var(--kt-text);font:inherit;text-align:left;cursor:pointer;scroll-snap-align:start;transition:border-color .15s ease,box-shadow .15s ease}.kumpul-option-tile:hover{border-color:var(--kt-accent);box-shadow:0 6px 18px #0f172a12}.kumpul-option-tile:focus-visible{outline:2px solid var(--kt-accent);outline-offset:2px}.kumpul-option-tile-thumb{width:72px;height:72px;flex:none;display:grid;place-items:center;overflow:hidden;border-radius:11px;background:color-mix(in srgb,var(--kt-accent) 10%,#fff);color:var(--kt-accent)}.kumpul-option-tile-thumb img{width:100%;height:100%;object-fit:cover}.kumpul-option-tile-thumb .kumpul-icon{width:24px;height:24px}.kumpul-option-tile-copy{min-width:0;flex:1;display:grid;gap:4px}.kumpul-option-tile .kumpul-plan-option-name{overflow:hidden;font-size:12px;font-weight:800;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.kumpul-option-tile .kumpul-plan-final-option{justify-self:start}.kumpul-option-tile-summary{overflow:hidden;color:var(--kt-muted);font-size:10px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.kumpul-plan-option-dialog{width:min(460px,calc(100vw - 32px));max-height:90vh;margin:auto;padding:0;overflow:auto;border:1px solid var(--kt-border);border-radius:18px;background:var(--kt-surface);color:var(--kt-text);box-shadow:0 24px 80px #0f172a40}.kumpul-plan-option-dialog::backdrop{background:#0f172a70;backdrop-filter:blur(2px)}.kumpul-option-carousel{position:relative;background:#0f172a}.kumpul-option-carousel-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain}.kumpul-option-carousel-track::-webkit-scrollbar{display:none}.kumpul-option-carousel-slide{width:100%;flex:none;padding:0;border:0;background:transparent;cursor:zoom-in;scroll-snap-align:center}.kumpul-option-carousel-slide img{width:100%;height:240px;display:block;object-fit:cover}.kumpul-option-carousel-nav{position:absolute;top:50%;width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:50%;background:#ffffffe0;color:#0f172a;font-size:22px;line-height:1;transform:translateY(-50%);cursor:pointer;box-shadow:0 4px 12px #0f172a33}.kumpul-option-carousel-nav.is-prev{left:10px}.kumpul-option-carousel-nav.is-next{right:10px}.kumpul-option-carousel-dots{position:absolute;right:0;bottom:10px;left:0;display:flex;justify-content:center;gap:5px;pointer-events:none}.kumpul-option-carousel-dots span{width:6px;height:6px;border-radius:99px;background:#ffffff8c;transition:width .2s ease}.kumpul-option-carousel-dots span[data-active]{width:16px;background:#fff}.kumpul-image-viewer{width:100vw;max-width:none;height:100vh;height:100dvh;max-height:none;margin:0;padding:0;border:0;background:#000000f2;color:#fff;overflow:hidden}.kumpul-image-viewer::backdrop{background:#000}.kumpul-image-viewer[open]{display:flex;align-items:center;justify-content:center}.kumpul-image-viewer-stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:56px 12px}.kumpul-image-viewer-stage img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;user-select:none;-webkit-user-drag:none}.kumpul-image-viewer-close,.kumpul-image-viewer-nav{position:absolute;z-index:2;display:grid;place-items:center;border:0;border-radius:50%;background:#ffffff26;color:#fff;cursor:pointer}.kumpul-image-viewer-close:hover,.kumpul-image-viewer-nav:hover{background:#ffffff40}.kumpul-image-viewer-close{top:calc(12px + env(safe-area-inset-top,0px));right:12px;width:42px;height:42px;font-size:24px}.kumpul-image-viewer-nav{top:50%;width:44px;height:44px;font-size:28px;transform:translateY(-50%)}.kumpul-image-viewer-nav.is-prev{left:12px}.kumpul-image-viewer-nav.is-next{right:12px}.kumpul-image-viewer-nav[hidden]{display:none}.kumpul-image-viewer-count{position:absolute;z-index:2;bottom:calc(16px + env(safe-area-inset-bottom,0px));left:50%;padding:4px 10px;border-radius:99px;background:#ffffff26;font-size:11px;transform:translateX(-50%)}.kumpul-plan-option-dialog-body{padding:18px 20px 20px;display:grid;gap:10px}.kumpul-plan-option-dialog-body>p{margin:0;color:var(--kt-muted);font-size:12px;line-height:1.6}.kumpul-plan-option-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.kumpul-plan-option-dialog-head h3{margin:3px 0 0;font-size:17px}.kumpul-plan-option-dialog-close{width:34px;height:34px;flex:none;border:1px solid var(--kt-border);border-radius:50%;background:#fff;color:var(--kt-text);font-size:18px;cursor:pointer}.kumpul-plan-option-dialog .kumpul-plan-final-option{justify-self:start}.kumpul-plan-option-plain{white-space:pre-line}.kumpul-plan-option-rich{color:var(--kt-muted);font-size:12px;line-height:1.6}.kumpul-plan-option-rich>*{margin:0 0 8px}.kumpul-plan-option-rich>:last-child{margin-bottom:0}.kumpul-plan-option-rich ul,.kumpul-plan-option-rich ol{padding-left:18px}.kumpul-plan-option-rich li{margin:2px 0}.kumpul-plan-option-rich a{color:var(--kt-accent);text-decoration:underline}.kumpul-plan-option-rich strong{color:var(--kt-text)}@media(max-width:760px){.kumpul-option-rail{grid-auto-columns:86%}.kumpul-plan-option-dialog{width:100vw;max-width:none;max-height:88vh;margin:auto 0 0;border-right:0;border-bottom:0;border-left:0;border-radius:20px 20px 0 0}.kumpul-plan-option-dialog-body{padding-bottom:calc(20px + env(safe-area-inset-bottom,0px))}}.kumpul-plan-options li{padding:13px 0;border-top:1px solid var(--kt-border)}.kumpul-plan-option-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.kumpul-plan-option-group{color:var(--kt-muted);font-size:8px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.kumpul-plan-option-heading h3{margin:3px 0 0;font-size:11px}.kumpul-plan-options li>p{margin:6px 0 0;color:var(--kt-muted);font-size:9px;line-height:1.5}.kumpul-plan-final-option{padding:5px 8px;border:1px solid var(--kt-accent);border-radius:99px;color:var(--kt-accent);font-size:8px;font-weight:800;white-space:nowrap}.kumpul-plan-votes{display:inline-block;margin-top:8px;color:var(--kt-accent);font-size:9px;font-weight:750}.kumpul-plan-empty-options{margin:0;color:var(--kt-muted);font-size:10px}.kumpul-plan-aside>p{margin:13px 0 0;color:var(--kt-muted);font-size:10px;line-height:1.6}.kumpul-plan-order-ref{overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8px!important}.kumpul-plan-account-link{margin-top:16px;padding:10px 12px;display:block;border:1px solid var(--kt-border);border-radius:10px;color:var(--kt-accent);font-size:10px;font-weight:800;text-align:center}
    .kumpul-plan-simulator{margin-top:18px;padding:20px;border:1px solid var(--kt-border);border-radius:18px;background:var(--kt-surface);box-shadow:0 8px 26px #0f172a0a}.kumpul-plan-simulator-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.kumpul-plan-simulator-heading h2{margin:0;font-size:19px;letter-spacing:-.025em}.kumpul-plan-simulator-heading .kumpul-eyebrow{margin-bottom:7px}.kumpul-plan-simulator-heading>div>p:last-child{margin:7px 0 0;color:var(--kt-muted);font-size:10px;line-height:1.55}.kumpul-plan-simulation-badge{padding:6px 9px;flex:none;border-radius:99px;background:#e6f4f6;color:var(--kt-accent);font-size:8px;font-weight:800}.kumpul-plan-simulation-note{margin:15px 0;padding:10px 12px;border:1px solid var(--kt-border);border-radius:10px;background:var(--kt-bg);color:var(--kt-muted);font-size:9px;line-height:1.55}.kumpul-plan-sim-steps{margin:17px 0 0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));list-style:none}.kumpul-plan-sim-steps li{min-width:0;border-top:2px solid var(--kt-border)}.kumpul-plan-sim-steps li.is-current,.kumpul-plan-sim-steps li.is-complete{border-color:var(--kt-accent)}.kumpul-plan-sim-steps button{width:100%;padding:10px 5px 4px;display:flex;align-items:center;gap:6px;border:0;background:none;color:var(--kt-muted);font:inherit;font-size:8px;font-weight:750;text-align:left}.kumpul-plan-sim-steps li.is-current button,.kumpul-plan-sim-steps li.is-complete button{color:var(--kt-text)}.kumpul-plan-sim-steps button:disabled{cursor:not-allowed;opacity:.65}.kumpul-plan-sim-steps button:not(:disabled){cursor:pointer}.kumpul-plan-sim-steps button>span:first-child{width:20px;height:20px;flex:none;display:grid;place-items:center;border:1px solid var(--kt-border);border-radius:50%;font-size:8px}.kumpul-plan-sim-steps li.is-current button>span:first-child,.kumpul-plan-sim-steps li.is-complete button>span:first-child{border-color:var(--kt-accent);background:var(--kt-accent);color:#fff}.kumpul-plan-sim-panel{margin-top:17px}.kumpul-plan-sim-panel[hidden],.kumpul-plan-sim-complete[hidden]{display:none}.kumpul-plan-sim-panel h3,.kumpul-plan-sim-complete h3{margin:0;font-size:15px}.kumpul-plan-sim-help{margin:6px 0 14px;color:var(--kt-muted);font-size:9px;line-height:1.5}.kumpul-plan-sim-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.kumpul-plan-sim-form label,.kumpul-plan-sim-invite-form label,.kumpul-plan-sim-person>label{min-width:0;display:grid;gap:5px;color:var(--kt-muted);font-size:9px;font-weight:700}.kumpul-plan-sim-form input,.kumpul-plan-sim-form select,.kumpul-plan-sim-invite-form input,.kumpul-plan-sim-invitees input,.kumpul-plan-sim-person select{width:100%;min-width:0;min-height:37px;padding:8px 9px;border:1px solid var(--kt-border);border-radius:9px;background:#fff;color:var(--kt-text);font:inherit;font-size:10px}.kumpul-plan-sim-options{min-width:0;margin:15px 0 0;padding:11px;border:1px solid var(--kt-border);border-radius:11px}.kumpul-plan-sim-options legend{padding:0 5px;color:var(--kt-text);font-size:10px;font-weight:800}.kumpul-plan-sim-option{margin:5px 10px 5px 0;display:inline-flex;align-items:center;gap:6px;color:var(--kt-muted);font-size:9px}.kumpul-plan-sim-option input{accent-color:var(--kt-accent)}.kumpul-plan-sim-actions{margin-top:15px;display:flex;justify-content:flex-end;gap:8px}.kumpul-plan-sim-actions button,.kumpul-plan-sim-invite-form button,.kumpul-plan-sim-invitees button,.kumpul-plan-sim-payment button,.kumpul-plan-sim-complete button{min-height:36px;padding:8px 12px;border:1px solid var(--kt-border);border-radius:9px;background:#fff;color:var(--kt-text);font:inherit;font-size:9px;font-weight:800;cursor:pointer}.kumpul-plan-sim-actions .kumpul-plan-sim-primary{border-color:var(--kt-accent);background:var(--kt-accent);color:#fff}.kumpul-plan-sim-actions .kumpul-plan-sim-secondary{color:var(--kt-accent)}.kumpul-plan-sim-error{margin:12px 0 0;color:#b91c1c;font-size:9px;font-weight:700}.kumpul-plan-sim-invite-form{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;gap:9px}.kumpul-plan-sim-invitees{margin:12px 0 0;padding:0;display:grid;gap:7px;list-style:none}.kumpul-plan-sim-invitees li{display:flex;align-items:center;gap:8px}.kumpul-plan-sim-invitees li>div{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:8px}.kumpul-plan-sim-invitees button,.kumpul-plan-sim-payment button{min-height:33px;padding:7px 9px;color:var(--kt-accent)}.kumpul-plan-sim-participants,.kumpul-plan-sim-payments{display:grid;gap:9px}.kumpul-plan-sim-person{padding:12px;display:grid;grid-template-columns:minmax(0,1fr) 170px;align-items:center;gap:11px;border:1px solid var(--kt-border);border-radius:12px;background:var(--kt-bg)}.kumpul-plan-sim-person-heading{min-width:0;display:grid;gap:3px}.kumpul-plan-sim-person-heading strong{font-size:10px}.kumpul-plan-sim-person-heading span{overflow-wrap:anywhere;color:var(--kt-muted);font-size:8px}.kumpul-plan-sim-person-options{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.kumpul-plan-sim-payment{grid-template-columns:minmax(0,1fr) auto}.kumpul-plan-sim-payment[data-sim-paid=true]{border-color:var(--kt-success);background:#effaf5}.kumpul-plan-sim-final-group{margin:7px 0 0;padding:8px;border:1px solid var(--kt-border);border-radius:9px}.kumpul-plan-sim-final-group legend{padding:0 4px;font-size:9px;font-weight:800}.kumpul-plan-sim-final-group label{margin:5px 10px 5px 0;display:inline-flex;align-items:center;gap:6px;color:var(--kt-muted);font-size:9px}.kumpul-plan-sim-final-group input{accent-color:var(--kt-accent)}.kumpul-plan-sim-complete{margin-top:18px;padding:22px;border:1px solid #8bd1ae;border-radius:13px;background:#effaf5;text-align:center}.kumpul-plan-sim-complete>span{width:34px;height:34px;margin:0 auto 9px;display:grid;place-items:center;border-radius:50%;background:var(--kt-success);color:#fff;font-weight:900}.kumpul-plan-sim-complete p{margin:7px 0 13px;color:var(--kt-muted);font-size:9px;line-height:1.5}.kumpul-plan-live .kumpul-plan-sim-steps{position:sticky;top:var(--kumpul-header-height,0px);z-index:8;padding-top:10px;background:var(--kt-surface)}.kumpul-plan-live-dates{margin-top:11px;grid-template-columns:repeat(3,minmax(0,1fr))}.kumpul-plan-live .kumpul-plan-sim-option{width:100%;margin:7px 0;display:flex;align-items:flex-start}.kumpul-plan-live .kumpul-plan-sim-option>span{display:grid;gap:3px}.kumpul-plan-live .kumpul-plan-sim-option small{color:var(--kt-muted);font-size:8px;line-height:1.45}.kumpul-plan-live .kumpul-plan-sim-invite-form{margin-bottom:12px;grid-template-columns:repeat(3,minmax(0,1fr)) auto}.kumpul-plan-live-readonly{margin:6px 0 12px;padding:8px 10px;border-radius:9px;background:var(--kt-bg);color:var(--kt-muted);font-size:9px}.kumpul-plan-live-people{margin:12px 0 0;padding:0;display:grid;gap:8px;list-style:none}.kumpul-plan-live-people .kumpul-plan-sim-person{grid-template-columns:minmax(0,1fr) auto}.kumpul-plan-live-person-name{display:flex;align-items:center;gap:8px}.kumpul-plan-live-person-name input{accent-color:var(--kt-accent)}.kumpul-plan-live-row-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;font-size:9px;font-weight:800}.kumpul-plan-live-row-actions a{color:var(--kt-accent)}.kumpul-plan-live-row-actions button{min-height:32px;padding:6px 10px;border:1px solid var(--kt-border);border-radius:9px;background:#fff;color:var(--kt-accent);font:inherit;cursor:pointer}.kumpul-plan-live-public{margin:0 0 12px;padding:10px 12px;border:1px dashed var(--kt-accent);border-radius:11px;color:var(--kt-muted);font-size:9px}.kumpul-plan-live-public a{color:var(--kt-accent);font-weight:800}.kumpul-plan-live-operation{margin:12px 0 0;padding:10px 12px;border-radius:10px;background:#e6f4f6;color:var(--kt-text);font-size:9px}.kumpul-plan-live-operation.is-failed{background:#fdecec;color:#b91c1c}.kumpul-plan-live-reason{margin-top:12px;display:grid;gap:5px;color:var(--kt-muted);font-size:9px;font-weight:700}.kumpul-plan-live-reason textarea,.kumpul-plan-live-cancel input{width:100%;padding:8px 9px;border:1px solid var(--kt-border);border-radius:9px;font:inherit;font-size:10px}.kumpul-plan-live .kumpul-plan-sim-final-group{display:grid;gap:4px}.kumpul-plan-live .kumpul-plan-sim-final-group p{margin:0;color:var(--kt-muted);font-size:9px}.kumpul-plan-live-cancel{margin-top:18px;padding-top:12px;border-top:1px solid var(--kt-border);font-size:10px}.kumpul-plan-live-cancel summary{color:#b91c1c;font-weight:800;cursor:pointer}.kumpul-plan-live-cancel label{margin:10px 0;display:grid;gap:5px;color:var(--kt-muted);font-size:9px;font-weight:700}.kumpul-plan-live-danger{min-height:36px;padding:8px 12px;border:0;border-radius:9px;background:#b91c1c;color:#fff;font:inherit;font-size:9px;font-weight:800;cursor:pointer}.kumpul-plan-live button:disabled{cursor:not-allowed;opacity:.55}.kumpul-venue{margin-top:6px;display:flex;align-items:center;gap:10px;font-size:10px;font-weight:400;line-height:1.45;color:var(--kt-muted)}.kumpul-venue-address{min-width:0;flex:1}.kumpul-venue-map{width:40px;height:40px;flex:none;display:grid;place-items:center;border:1px solid var(--kt-border);border-radius:12px;background:#fff;box-shadow:0 2px 8px #0f172a14;transition:transform .15s ease,box-shadow .15s ease}.kumpul-venue-map:hover{transform:translateY(-1px);box-shadow:0 6px 14px #0f172a1f}.kumpul-venue-map:focus-visible{outline:2px solid var(--kt-accent);outline-offset:2px}.kumpul-venue-map svg{width:24px;height:24px}@media(max-width:760px){.kumpul-plan-live-dates,.kumpul-plan-live .kumpul-plan-sim-invite-form,.kumpul-plan-live-people .kumpul-plan-sim-person{grid-template-columns:1fr}.kumpul-plan-live-row-actions{justify-content:flex-start}}
    @media(max-width:760px){.kumpul-plan-heading{flex-direction:column;gap:12px}.kumpul-plan-workflow{padding:14px}.kumpul-plan-workflow ol{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.kumpul-plan-workflow li{padding:9px 5px 0;font-size:8px}.kumpul-plan-layout{grid-template-columns:minmax(0,1fr);gap:13px}.kumpul-plan-aside{position:static}.kumpul-plan-simulator{padding:15px}.kumpul-plan-simulator-heading{flex-direction:column;gap:10px}.kumpul-plan-sim-form{grid-template-columns:1fr}.kumpul-plan-sim-invite-form{grid-template-columns:1fr}.kumpul-plan-sim-invite-form button{width:100%}.kumpul-plan-sim-invitees li{align-items:flex-start;flex-direction:column}.kumpul-plan-sim-invitees li>div{width:100%;grid-template-columns:1fr}.kumpul-plan-sim-invitees button{align-self:flex-end}.kumpul-plan-sim-person{grid-template-columns:1fr}.kumpul-plan-sim-person-options{grid-template-columns:1fr}.kumpul-plan-sim-payment{grid-template-columns:1fr}.kumpul-plan-sim-payment button{width:100%}.kumpul-plan-sim-steps button{align-items:flex-start;flex-direction:column;font-size:7px}.kumpul-plan-sim-actions{flex-wrap:wrap}.kumpul-plan-sim-actions button{flex:1}}
    @media(max-width:760px){.kumpul-detail-heading{align-items:flex-start;flex-direction:column}.kumpul-detail-layout{grid-template-columns:1fr;gap:13px}.kumpul-detail-aside{position:static}.kumpul-detail-card{padding:16px}.kumpul-detail-fields{gap:13px}.kumpul-detail-total strong{font-size:19px}.kumpul-detail-item{grid-template-columns:40px minmax(0,1fr);gap:10px}.kumpul-detail-item-art{width:40px;height:40px}.kumpul-detail-item>strong{grid-column:2}.kumpul-detail-page .kumpul-detail-preview-note{font-size:9px}}
    .kumpul-transaction-actions .kumpul-transaction-action-link{display:inline-flex;min-height:34px;align-items:center;justify-content:center;padding:7px 11px;border:1px solid var(--kt-border);border-radius:10px;background:var(--kt-surface);color:var(--kt-text);font-size:9px;font-weight:750;text-decoration:none}
    .kumpul-transaction-actions .kumpul-transaction-action-link:hover{border-color:var(--kt-accent);color:var(--kt-accent)}
    a.kumpul-billing-action{display:inline-flex;align-items:center;text-decoration:none;opacity:1;cursor:pointer}
    .kumpul-billing-action:not(:disabled),.kumpul-detail-aside>button:not(:disabled),.kumpul-cart-checkout:not(:disabled){opacity:1;cursor:pointer}
    .kumpul-detail-aside>.kumpul-detail-pay-link{display:flex;width:100%;min-height:42px;margin-top:16px;align-items:center;justify-content:center;border-radius:11px;background:var(--kt-accent);color:#fff;font-size:11px;font-weight:800;text-decoration:none}
    .kumpul-template.kumpul-header-only{min-height:0}.kumpul-header-only .kumpul-header{position:static}
    .kumpul-template.kumpul-bottom-nav-only{min-height:0;background:transparent}
    a.kumpul-calendar-action{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;opacity:1;cursor:pointer}
    @media(max-width:900px){.kumpul-header-main{padding:12px 20px}.kumpul-utilities>a span{display:none}.kumpul-utilities>a{padding:9px}.kumpul-main{padding:24px 20px 60px}.kumpul-hero{grid-template-columns:1fr}.kumpul-hero-copy{padding:38px}.kumpul-feature-card{min-height:310px}.kumpul-about-section{grid-template-columns:1fr .8fr;gap:24px}.kumpul-about-art,.kumpul-about-image{min-height:230px}.kumpul-process-list{grid-template-columns:repeat(2,minmax(0,1fr))}.kumpul-process-step+.kumpul-process-step{border-left:0}.kumpul-process-step:nth-child(even){border-left:1px solid var(--kt-border)}.kumpul-process-step:nth-child(n+3){border-top:1px solid var(--kt-border)}.kumpul-gathering-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.kumpul-location-list{grid-template-columns:repeat(2,minmax(0,1fr))}.kumpul-category-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.kumpul-calendar-heading{align-items:flex-start;flex-direction:column}.kumpul-calendar-stats{width:100%}.kumpul-cta{align-items:flex-start;flex-direction:column}}
    @media(max-width:620px){.kumpul-header-main{min-height:64px;padding:9px 16px}.kumpul-logo,.kumpul-logo-mark{width:40px;height:40px;border-radius:13px}.kumpul-brand-copy strong{font-size:15px}.kumpul-brand-copy small{font-size:8px}.kumpul-utilities{display:none}.kumpul-page-nav{min-height:47px;justify-content:flex-start;overflow-x:auto;padding:5px 12px}.kumpul-page-nav a{padding:7px 12px;font-size:11px}.kumpul-main{padding:16px 14px 98px}.kumpul-hero{border-radius:21px}.kumpul-hero-copy{padding:27px 22px}.kumpul-community-pill{margin-bottom:17px;font-size:9px}.kumpul-hero h1{font-size:clamp(39px,12vw,58px)}.kumpul-hero-description{margin-top:15px;font-size:13px}.kumpul-hero-actions{gap:8px;margin-top:19px}.kumpul-button{min-height:42px;padding:10px 13px;font-size:11px}.kumpul-stats{gap:20px;margin-top:22px}.kumpul-stat strong{font-size:18px}.kumpul-stat span{font-size:9px}.kumpul-feature-card{min-height:250px;padding:16px}.kumpul-feature-art>span{width:86px;height:86px;font-size:42px}.kumpul-about-section{margin-top:0;padding:22px;grid-template-columns:1fr;border-radius:21px}.kumpul-about-copy h1{font-size:clamp(34px,10vw,48px)}.kumpul-about-body{font-size:13px}.kumpul-about-art,.kumpul-about-image{min-height:230px}.kumpul-gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:135px;gap:9px}.kumpul-gallery-item:nth-child(3n+2){grid-row:span 1}.kumpul-gallery-item:nth-child(4n+1){grid-row:span 2}.kumpul-gallery-item>span{font-size:38px}.kumpul-process-list{grid-template-columns:1fr}.kumpul-process-step{padding:14px;display:grid;grid-template-columns:34px 1fr;column-gap:12px}.kumpul-process-step+.kumpul-process-step,.kumpul-process-step:nth-child(even),.kumpul-process-step:nth-child(n+3){border-top:1px solid var(--kt-border);border-left:0}.kumpul-process-step .kumpul-flow-number{grid-row:span 2}.kumpul-process-step small{grid-column:2}.kumpul-section{margin-top:48px}.kumpul-section-heading .kumpul-section-title,.kumpul-cta h2{font-size:29px}.kumpul-section-description{font-size:12px}.kumpul-flow-list{grid-template-columns:1fr;border-radius:16px}.kumpul-flow-step{min-height:0;padding:13px 15px;display:grid;grid-template-columns:34px 1fr;column-gap:11px}.kumpul-flow-step+.kumpul-flow-step{border-top:1px solid var(--kt-border);border-left:0}.kumpul-flow-number{grid-row:span 2}.kumpul-flow-step strong{margin:0}.kumpul-flow-step>span:last-child{font-size:10px}.kumpul-section-topline{align-items:flex-start}.kumpul-text-link{margin-top:5px;font-size:10px}.kumpul-catalog-heading{align-items:stretch;flex-direction:column;gap:16px}.kumpul-catalog-search{width:100%;min-height:44px}.kumpul-category-filters{grid-template-columns:1fr 1fr;gap:8px}.kumpul-category-filter{padding:9px;gap:8px}.kumpul-category-icon{width:32px;height:32px}.kumpul-category-filter strong{font-size:10px}.kumpul-category-filter small{font-size:8px}.kumpul-gathering-grid{grid-template-columns:1fr;gap:12px}.kumpul-gathering-card{display:grid;grid-template-columns:112px 1fr}.kumpul-gathering-art{min-height:100%;}.kumpul-gathering-art>span:first-child{font-size:36px}.kumpul-card-content{min-width:0;padding:12px}.kumpul-card-content h3{font-size:13px}.kumpul-card-meta{font-size:9px}.kumpul-card-bottom{margin-top:9px;padding-top:8px}.kumpul-card-bottom strong{font-size:10px}.kumpul-card-bottom span{font-size:9px}.kumpul-calendar{margin-top:0}.kumpul-calendar-title{font-size:34px}.kumpul-calendar-description{font-size:12px}.kumpul-calendar-stats{gap:7px}.kumpul-calendar-stat{min-width:0;flex:1;padding:10px}.kumpul-calendar-stat strong{font-size:16px}.kumpul-calendar-stat span{font-size:9px}.kumpul-calendar-card{align-items:flex-start;flex-direction:column;padding:15px}.kumpul-calendar-invitation-action{width:100%;justify-items:start}.kumpul-calendar-action{min-height:36px}.kumpul-section-topline{align-items:flex-start}.kumpul-text-link{margin-top:5px;font-size:10px}.kumpul-testimonial-grid{grid-template-columns:1fr}.kumpul-location-list{grid-template-columns:1fr}.kumpul-cta{margin-top:48px;padding:25px 20px;border-radius:19px}.kumpul-cta-actions{width:100%}.kumpul-cta-actions .kumpul-button{flex:1}.kumpul-footer{padding:20px 15px 95px;flex-direction:column}.kumpul-mobile-dock{position:fixed;z-index:5;right:0;bottom:0;left:0;padding:9px 5px max(9px,env(safe-area-inset-bottom));display:flex;justify-content:space-around;border-top:1px solid var(--kt-border);background:#fffffff2;backdrop-filter:blur(14px)}.kumpul-mobile-dock a{min-width:0;display:grid;justify-items:center;gap:3px;color:var(--kt-muted);font-size:8px}.kumpul-mobile-dock .kumpul-icon{width:19px;height:19px}.kumpul-bottom-nav-only .kumpul-mobile-dock{position:static;background:var(--kt-surface)}}
    .kumpul-template{--kumpul-dock-offset:0px;--kumpul-bar-safe:env(safe-area-inset-bottom,0px)}
    /* Tombol yang sedang diproses host (aria-busy dari bootstrap Bagdja): spinner, tidak tampak nonaktif. */
    @keyframes kumpul-spin{to{transform:rotate(360deg)}}.kumpul-template :is(button,a,label)[aria-busy=true]{position:relative;cursor:progress!important;opacity:1!important;pointer-events:none}.kumpul-template :is(button,a,label)[aria-busy=true]::before{content:'';width:1em;height:1em;flex:none;display:inline-block;margin-right:.5em;vertical-align:-.15em;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;box-sizing:border-box;animation:kumpul-spin .7s linear infinite}.kumpul-template :is(button,a,label)[aria-busy=true]>svg{display:none}.kumpul-template :is(.kumpul-reservation-delete,.kumpul-product-mobile-chat,.kumpul-plan-pick-info)[aria-busy=true]::before{margin-right:0}@media(prefers-reduced-motion:reduce){.kumpul-template :is(button,a,label)[aria-busy=true]::before{animation-duration:1.8s}}
    .kumpul-sheet-toggle{position:fixed;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}.kumpul-sheet-backdrop,.kumpul-sheet-head,.kumpul-plan-mobile{display:none}
    .kumpul-invite-appearance{min-width:0;margin:14px 0 0;padding:14px;border:1px solid var(--kt-border);border-radius:13px;background:#fff}.kumpul-invite-appearance legend{padding:0 4px;font-size:11px;font-weight:800}.kumpul-invite-appearance-grid{margin-top:10px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:14px}.kumpul-invite-banner-field,.kumpul-invite-text-field{min-width:0;display:grid;align-content:start;gap:8px}.kumpul-invite-appearance label{display:grid;gap:5px;font-size:10px;font-weight:700}.kumpul-invite-appearance textarea{width:100%;min-height:104px;padding:8px 9px;border:1px solid var(--kt-border);border-radius:9px;font:inherit;font-size:10px;resize:vertical}.kumpul-invite-appearance input[type=file]{max-width:100%;font:inherit;font-size:9px}.kumpul-invite-appearance small{color:var(--kt-muted);font-size:8px;font-weight:400;line-height:1.45}    .kumpul-invite-banner{display:block;width:100%;aspect-ratio:16/7;object-fit:cover;border:1px solid var(--kt-border);border-radius:11px;background:var(--kt-surface)}.kumpul-invite-banner[hidden],.kumpul-invite-banner-empty[hidden]{display:none}.kumpul-invite-banner-empty{aspect-ratio:16/7;display:grid;place-items:center;border:1px dashed var(--kt-border);border-radius:11px;color:var(--kt-muted);font-size:9px}.kumpul-invite-banner-current{margin:0;display:grid;gap:6px}.kumpul-invite-appearance .kumpul-invite-remove{display:flex;align-items:center;gap:6px;font-weight:600}.kumpul-invite-appearance-actions{margin-top:12px;display:flex;justify-content:flex-end}.kumpul-invite-appearance-actions button{min-height:36px;padding:8px 12px;border:1px solid var(--kt-border);border-radius:9px;background:#fff;color:var(--kt-accent);font:inherit;font-size:9px;font-weight:800;cursor:pointer}.kumpul-invite-appearance-actions button:disabled{opacity:.5;cursor:not-allowed}.kumpul-invite-appearance.is-readonly{display:grid;gap:8px}.kumpul-invite-appearance.is-readonly h4,.kumpul-plan-invitees h4{margin:0;font-size:11px}.kumpul-invite-description{margin:0;font-size:10px;line-height:1.6;white-space:pre-line}.kumpul-plan-invitees{margin-top:16px;display:grid;gap:8px}
    .kumpul-invite-share{margin:14px 0;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:14px;align-items:start}.kumpul-invite-share-card{min-width:0;overflow:hidden;border:1px solid var(--kt-border);border-radius:13px;background:#fff}.kumpul-invite-share-card .kumpul-invite-banner{border:0;border-radius:0}.kumpul-invite-share-body{padding:14px;display:grid;gap:6px}.kumpul-invite-share-body .kumpul-eyebrow{margin:0}.kumpul-invite-share-body h4{margin:0;font-size:14px;line-height:1.3}.kumpul-invite-share-meta{margin:0;color:var(--kt-muted);font-size:9px}.kumpul-invite-share-qr{min-width:0;padding:14px;display:grid;justify-items:center;gap:10px;border:1px dashed var(--kt-accent);border-radius:13px;background:#fff;text-align:center}.kumpul-invite-qr{width:min(180px,100%);height:auto;display:block}.kumpul-invite-share-qr strong{font-size:11px}.kumpul-invite-share-qr p{margin:4px 0 0;color:var(--kt-muted);font-size:9px;line-height:1.5}.kumpul-invite-share-url{margin-top:8px;display:block;padding:6px 8px;border-radius:7px;background:var(--kt-surface);font-size:8px;overflow-wrap:anywhere}.kumpul-invite-share-open{margin-top:8px;display:inline-flex;min-height:36px;align-items:center;padding:0 12px;border:1px solid var(--kt-accent);border-radius:9px;color:var(--kt-accent);font-size:9px;font-weight:800}
    .kumpul-plan-cancel-trigger{min-height:36px;padding:8px 12px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #fca5a5;border-radius:9px;background:#fff;color:#b91c1c;font-size:9px;font-weight:800;cursor:pointer}.kumpul-plan-cancel-trigger:hover{background:#fef2f2}.kumpul-plan-sheet-cancel .kumpul-plan-cancel-trigger{width:100%;min-height:44px;font-size:10px}.kumpul-plan-live-cancel .kumpul-plan-cancel-trigger{margin:0;display:inline-flex;color:#b91c1c;font-size:9px}.kumpul-plan-cancel-trigger:focus-visible,.kumpul-modal-secondary:focus-visible{outline:2px solid var(--kt-accent);outline-offset:2px}
    .kumpul-modal-backdrop,.kumpul-modal{display:none}.kumpul-modal-toggle:checked+.kumpul-modal-backdrop{position:fixed;z-index:60;inset:0;display:block;background:#0f172a80}.kumpul-modal-toggle:checked~.kumpul-modal{position:fixed;z-index:61;top:50%;left:50%;width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 32px);padding:24px;display:block;overflow-y:auto;border:1px solid var(--kt-border);border-radius:18px;background:var(--kt-surface);color:var(--kt-text);box-shadow:0 24px 80px #0000003d;transform:translate(-50%,-50%)}.kumpul-modal-icon{width:40px;height:40px;margin-bottom:12px;display:grid;place-items:center;border-radius:50%;font-size:18px;font-weight:800}.kumpul-modal-icon.is-danger{background:#fee2e2;color:#b91c1c}.kumpul-modal h2{margin:0;font-size:18px;font-weight:800}.kumpul-modal>p{margin:10px 0 0;color:var(--kt-muted);font-size:13px;line-height:1.6}.kumpul-modal-field{margin-top:16px;display:grid;gap:6px;font-size:11px;font-weight:700}.kumpul-modal-field input{width:100%;padding:10px 11px;border:1px solid var(--kt-border);border-radius:10px;background:#fff;font:inherit;font-size:12px}.kumpul-modal-actions{margin-top:22px;display:flex;justify-content:flex-end;gap:10px}.kumpul-modal-secondary{min-height:40px;padding:8px 14px;display:inline-flex;align-items:center;border:1px solid var(--kt-border);border-radius:9px;background:#fff;color:var(--kt-accent);font-size:11px;font-weight:800;cursor:pointer}.kumpul-modal-actions .kumpul-plan-live-danger{min-height:40px;padding:8px 14px;font-size:11px}
    @media(max-width:520px){.kumpul-modal-actions{flex-direction:column-reverse}.kumpul-modal-actions>*{width:100%;justify-content:center;min-height:44px}}
    .kumpul-sheet-head strong{font-size:13px}.kumpul-sheet-close{min-height:36px;padding:0 10px;display:inline-flex;align-items:center;border-radius:9px;color:var(--kt-accent);font-size:10px;font-weight:800;cursor:pointer}.kumpul-sheet-actions{display:grid;gap:8px}.kumpul-sheet-actions button{width:100%;min-height:44px;padding:9px 12px;border:1px solid var(--kt-border);border-radius:11px;background:#fff;color:var(--kt-accent);font:inherit;font-size:10px;font-weight:800;cursor:pointer}.kumpul-sheet-actions:empty{display:none}.kumpul-plan-sheet-cancel{margin-top:14px;padding-top:12px;display:grid;gap:8px;border-top:1px solid var(--kt-border);font-size:10px}.kumpul-sheet-actions:empty+.kumpul-plan-sheet-cancel{margin-top:0;padding-top:0;border-top:0}.kumpul-plan-sheet-cancel label{display:grid;gap:5px;font-weight:700}.kumpul-plan-sheet-cancel input{width:100%;padding:10px;border:1px solid var(--kt-border);border-radius:9px;font:inherit;font-size:10px}.kumpul-plan-sheet-cancel .kumpul-plan-live-danger{width:100%;min-height:44px;font-size:10px}
    @media(max-width:760px){.kumpul-invite-share{grid-template-columns:1fr}.kumpul-invite-appearance-grid{grid-template-columns:1fr}.kumpul-invite-appearance-actions button{width:100%}.kumpul-plan-live .kumpul-plan-desktop-actions,.kumpul-plan-desktop-only{display:none}.kumpul-plan-detail{padding-bottom:calc(72px + var(--kumpul-dock-offset))}.kumpul-plan-mobile{display:block}.kumpul-plan-mobilebar{position:fixed;z-index:20;right:0;bottom:var(--kumpul-dock-offset);left:0;padding:8px 12px calc(8px + var(--kumpul-bar-safe));display:flex;align-items:center;gap:6px;border-top:1px solid var(--kt-border);background:#fffffff5;box-shadow:0 -6px 18px #0f172a0f;backdrop-filter:blur(14px)}.kumpul-plan-mobilebar-icon{flex:none;width:54px;min-height:44px;display:grid;align-content:center;justify-items:center;gap:2px;border-radius:10px;color:var(--kt-text);font-size:8px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent}.kumpul-plan-mobilebar-icon:active{background:var(--kt-surface)}.kumpul-plan-mobilebar-icon .kumpul-icon{width:20px;height:20px}.kumpul-plan-mobilebar-primary{min-width:0;flex:1;display:flex}.kumpul-plan-mobilebar-primary button{min-width:0;min-height:44px;flex:1;padding:8px 12px;border:1px solid var(--kt-accent);border-radius:11px;background:var(--kt-accent);color:#fff;font:inherit;font-size:10px;font-weight:800;line-height:1.25;cursor:pointer}.kumpul-plan-mobilebar-primary button:disabled{opacity:.5;cursor:not-allowed}.kumpul-sheet-backdrop{position:fixed;z-index:40;inset:0;display:block;background:#0f172a6b;opacity:0;pointer-events:none;transition:opacity .2s ease}.kumpul-sheet-toggle:checked+.kumpul-sheet-backdrop{opacity:1;pointer-events:auto}.kumpul-sheet,.kumpul-plan-layout.kumpul-plan-summary-sheet{position:fixed;z-index:41;right:0;bottom:0;left:0;max-height:85vh;margin:0;padding:0 16px calc(16px + env(safe-area-inset-bottom,0px));display:block;overflow-y:auto;overscroll-behavior:contain;border-radius:18px 18px 0 0;background:var(--kt-bg);box-shadow:0 -12px 32px #0f172a2e;visibility:hidden;transform:translateY(105%);transition:transform .25s ease,visibility .25s}.kumpul-sheet-toggle:checked~.kumpul-sheet,.kumpul-sheet-toggle:checked~.kumpul-plan-summary-sheet{visibility:visible;transform:none}.kumpul-plan-summary-sheet .kumpul-plan-main{display:grid;gap:13px}.kumpul-plan-summary-sheet .kumpul-plan-main>.kumpul-detail-card:first-child>h2{display:none}.kumpul-plan-summary-sheet .kumpul-plan-aside{margin-top:13px}.kumpul-sheet-head{position:sticky;z-index:1;top:0;margin:0 -16px 12px;padding:18px 16px 10px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid var(--kt-border);background:var(--kt-bg)}.kumpul-sheet-head:before{content:'';position:absolute;top:7px;left:50%;width:36px;height:4px;margin-left:-18px;border-radius:2px;background:var(--kt-border)}html.kumpul-sheet-open,html:has(.kumpul-sheet-toggle:checked){overflow:hidden}}
    @media(max-width:620px){.kumpul-template:has(.kumpul-mobile-dock){--kumpul-dock-offset:max(54px,calc(45px + env(safe-area-inset-bottom,0px)));--kumpul-bar-safe:0px}}
    @media(prefers-reduced-motion:reduce){.kumpul-template *{scroll-behavior:auto!important;transition:none!important}}
  `;
}

function render(inputProps = {}) {
  const kumpulPage = adaptPage(inputProps.page);
  const props = kumpulPage ? { ...inputProps, kumpulPage } : inputProps;
  const colors = themeColors(props);
  const sections = list(props.sections);

  // Header saja untuk halaman yang isinya masih dikelola Bagdja (mis. chat, checkout).
  if (props.headerOnly === true) {
    return h('div', { className: 'kumpul-template kumpul-header-only' },
      h('style', { dangerouslySetInnerHTML: { __html: styles(colors) } }),
      h(Header, { ...props, activePageSlug: '' }),
    );
  }

  // Navigasi bawah (HP) untuk halaman yang sama — host menempelkannya di bawah layar
  // (manifest `bottom_nav`). Di desktop dock tersembunyi sehingga tingginya 0.
  if (props.bottomNavOnly === true) {
    return h('div', { className: 'kumpul-template kumpul-bottom-nav-only' },
      h('style', { dangerouslySetInnerHTML: { __html: styles(colors) } }),
      h(MobileDock, { ...props, activePageSlug: '' }),
    );
  }

  const orderDetailSection = sections.find((section) => section?.type === 'order_detail');
  const activePageSlug = kumpulPage
    ? kumpulPage.activePageSlug
    : orderDetailSection
      ? orderDetailSection.content?.gatheringPlan ? 'plan-detail' : 'transaction-detail'
      : ['cart', 'orders', 'tagihan', 'invoice-detail', 'transaction-detail', 'plan-detail'].includes(props.activePageSlug)
        ? props.activePageSlug
        : pageSlugForSections(sections);
  const calendarPageSection = kumpulPage && kumpulPage.calendar
    ? { id: 'kalender-acara', type: 'gathering_calendar', content: kumpulPage.calendar }
    : null;
  const catalogPage = activePageSlug === 'gathering';
  const billingPage = activePageSlug === 'tagihan';
  const transactionsPage = activePageSlug === 'orders';
  const cartPage = activePageSlug === 'cart';
  const invoiceDetailPage = activePageSlug === 'invoice-detail';
  const transactionDetailPage = activePageSlug === 'transaction-detail';
  const gatheringPlanDetailPage = activePageSlug === 'plan-detail';
  const productDetailPage = activePageSlug === 'product-detail';
  const invitationPage = activePageSlug === 'invitation';
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
      calendarPageSection
        ? h(CalendarSection, { props, section: calendarPageSection, key: 'calendar' })
        : null,
      billingPage ? h(BillingSection, { props }) : null,
      transactionsPage ? h(TransactionsSection, { props }) : null,
      cartPage ? h(CartSection, { props }) : null,
      invoiceDetailPage ? h(InvoiceDetailSection, { props }) : null,
      transactionDetailPage ? h(TransactionDetailSection, { props, section: orderDetailSection }) : null,
      gatheringPlanDetailPage ? h(GatheringPlanDetailSection, { props, section: orderDetailSection }) : null,
      productDetailPage ? h(ProductDetailSection, { props }) : null,
      invitationPage ? h(GatheringInvitationSection, { props }) : null,
      testimonials ? h(TestimonialsSection, testimonials) : null,
      locations ? h(LocationsSection, { props, section: locations }) : null,
      cta ? h(CallToAction, { props, section: cta }) : null,
      sections.length === 0 && !activePageSlug
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
    h(MobileDock, { ...props, activePageSlug }),
  );
}

module.exports = { render };
