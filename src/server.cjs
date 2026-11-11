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
    PAID: 'paid',
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
  const cartItems = props.isPreview === true ? list(props.previewCart) : [];
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
                        disabled: quantity <= 1,
                      }, '−'),
                      h('span', { 'data-cart-quantity' : '' }, String(quantity)),
                      h('button', {
                        type: 'button',
                        'aria-label': `Tambah jumlah ${text(item.name, 'item')}`,
                        'data-cart-quantity-increase': '',
                      }, '+'),
                    )
                    : null,
                  h('button', {
                    type: 'button',
                    className: 'kumpul-cart-remove',
                    'data-cart-remove': '',
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
            h('button', { type: 'button', className: 'kumpul-cart-checkout', disabled: true }, 'Lanjut ke Checkout'),
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
  const transactions = props.isPreview === true ? list(props.previewTransactions) : [];
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
          transaction.status === 'PENDING_PAYMENT'
            ? h('button', { type: 'button', disabled: true }, 'Lanjutkan Pembayaran')
            : null,
          h('button', { type: 'button', disabled: true }, 'Detail Transaksi'),
          h('button', { type: 'button', disabled: true }, 'Chat Order'),
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
  if (props.isPreview !== true) {
    return h('section', { className: 'kumpul-detail-page', 'data-invoice-detail': '' },
      h('h1', null, 'Detail Tagihan'),
      h('p', null, 'Data tagihan dan status pembayaran dikelola oleh host Bagdja.'),
    );
  }
  const invoice = props.isPreview === true ? props.previewInvoice || {} : {};
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
        !isPaid
          ? h('button', { type: 'button', disabled: props.isPreview === true || !paymentOpen },
            paymentOpen ? (isPending ? 'Lanjutkan pembayaran' : 'Login untuk membayar') : 'Pembayaran belum dibuka',
          )
          : null,
      ),
    ),
  );
}

function TransactionDetailSection({ props, section }) {
  const transaction = props.isPreview === true
    ? props.previewTransaction || {}
    : section?.content?.transaction || {};
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
            h('button', { type: 'button', disabled: true }, 'Lanjutkan Pembayaran'),
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
  const invitees = list(props.previewPlanInvitees);
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
  h('style', null, '.kumpul-plan-sim-steps{position:sticky;top:var(--kumpul-header-height,0px);z-index:8;padding-top:10px;background:var(--kt-surface)}.kumpul-plan-sim-form.kumpul-plan-sim-dates{grid-template-columns:repeat(3,minmax(0,1fr))}.kumpul-plan-sim-date-time{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:6px}.kumpul-plan-sim-options .kumpul-plan-sim-option{width:100%;margin:7px 0;display:flex;align-items:flex-start}.kumpul-plan-sim-option>span{display:grid;gap:3px}.kumpul-plan-sim-option small{color:var(--kt-muted);font-size:8px;font-weight:400;line-height:1.45}.kumpul-plan-sim-invite-form{grid-template-columns:repeat(3,minmax(0,1fr)) auto}.kumpul-plan-sim-invitees li>div{grid-template-columns:repeat(3,minmax(0,1fr))}@media(max-width:760px){.kumpul-plan-sim-form.kumpul-plan-sim-dates{grid-template-columns:1fr}.kumpul-plan-sim-invite-form{grid-template-columns:1fr}.kumpul-plan-sim-invitees li>div{grid-template-columns:1fr}}'),
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
    h('p', { className: 'kumpul-plan-sim-help' }, 'Tambahkan kontak undangan melalui email atau WhatsApp. Preview hanya menyimulasikan submit dan tidak mengirim pesan.'),
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

function GatheringPlanDetailSection({ props, section }) {
  const sectionContent = section?.content || {};
  const plan = props.isPreview === true
    ? props.previewGatheringPlan || {}
    : sectionContent.gatheringPlan || {};
  const order = props.isPreview === true
    ? props.previewGatheringOrder || {}
    : sectionContent.order || {};
  const occurrence = plan.occurrence || {};
  const openedIds = new Set(list(occurrence.opened_option_ids_snapshot));
  const openedOptions = list(occurrence.option_groups_snapshot)
    .filter((option) => openedIds.has(option.product_option_id));
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
    props.isPreview === true
      ? null
      : h('section', { className: 'kumpul-plan-workflow', 'aria-label': 'Tahapan gathering' },
        h('p', { className: 'kumpul-plan-current-step' }, 'Tahap saat ini: ', h('strong', { 'data-plan-current-step': '' }, currentStep)),
        h('ol', null,
          ...gatheringWorkflowSteps.map((step, index) => h('li', {
            key: step.key,
            className: index < currentStepIndex ? 'is-complete' : index === currentStepIndex ? 'is-current' : '',
            'aria-current': index === currentStepIndex ? 'step' : undefined,
          },
          h('span', { className: 'kumpul-plan-step-marker', 'aria-hidden': 'true' }, index < currentStepIndex ? '✓' : String(index + 1)),
          h('span', null, step.label),
          )),
        ),
        h('p', { className: 'kumpul-plan-readonly' }, 'Ringkasan ini hanya untuk melihat progres. Aksi rencana tersedia melalui host Bagdja.'),
      ),
    h('div', { className: 'kumpul-plan-layout' },
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
            h('div', null, h('dt', null, 'Lokasi acara'), h('dd', null, text(occurrence.final_location, 'Belum ditentukan'))),
            order.created_at
              ? h('div', null, h('dt', null, 'Tanggal dibuat'), h('dd', null, formatCalendarDate(order.created_at)))
              : null,
          ),
        ),
        h('section', { className: 'kumpul-detail-card' },
          h('h2', null, 'Pilihan dari produk'),
          h('ul', {
            className: 'kumpul-plan-options',
            'data-plan-opened-options': '',
            hidden: openedOptions.length === 0,
          },
              ...openedOptions.map((option) => {
                const voteResult = occurrence.voting_results?.[option.option_group_key];
                const vote = voteResult?.options?.[String(option.product_option_id)];
                return h('li', { key: option.product_option_id },
                  h('div', { className: 'kumpul-plan-option-heading' },
                    h('div', null,
                      h('span', { className: 'kumpul-plan-option-group' }, text(option.option_group_key, 'Pilihan')),
                      h('h3', null, text(option.label, text(option.option_key, 'Opsi gathering'))),
                    ),
                    option.is_final_selection
                      ? h('span', { className: 'kumpul-plan-final-option' }, 'Opsi final')
                      : null,
                  ),
                  h('p', null, [option.venue_location, option.description].filter(Boolean).join(' · ') || 'Detail pilihan belum ditambahkan.'),
                  vote
                    ? h('span', { className: 'kumpul-plan-votes' }, `${vote.votes} suara · ${vote.percentage}%`)
                    : null,
                );
              }),
          ),
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
        h('p', null, 'Rencana gathering dikelola terpisah dari keranjang. Pembayaran peserta hanya tersedia setelah tahap konfirmasi melalui host Bagdja.'),
        order.id
          ? h('p', { className: 'kumpul-plan-order-ref' }, `Referensi pesanan · ${order.id}`)
          : null,
        h('a', { className: 'kumpul-plan-account-link', href: tenantPath(props, '/cart') }, 'Kembali ke Keranjang'),
      ),
    ),
  );
}

function BillingSection({ props }) {
  const previewInvoices = props.isPreview === true ? list(props.previewInvoices) : [];
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
          return h('article', {
            className: `kumpul-billing-card kumpul-billing-card-${status}`,
            'data-billing-item': '',
            'data-billing-status': status,
            key: invoice.id || index,
          },
          h('div', { className: 'kumpul-billing-card-top' },
            h('div', null,
              h('span', { className: 'kumpul-billing-kind' }, isGathering ? 'Tagihan gathering' : `Termin ${invoice.sequence || ''}`.trim()),
              h('h3', null, title),
              h('p', null, reference),
            ),
            h('span', { className: `kumpul-billing-status kumpul-billing-status-${statusInfo.tone}` }, statusInfo.label),
          ),
          h('div', { className: 'kumpul-billing-card-bottom' },
            h('div', null,
              h('strong', null, formatCurrency(invoice.amount)),
              dueDate ? h('p', null, `Batas pembayaran · ${formatCalendarDate(dueDate)}`) : null,
            ),
            status === 'issued'
              ? h('button', { type: 'button', className: 'kumpul-billing-action', disabled: true }, isGathering ? 'Lihat detail tagihan' : 'Bayar')
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
  const plans = isPreview ? list(content.preview_plans) : [];
  const invitations = isPreview ? list(content.preview_invitations) : [];
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
    })),
    ...invitations.filter((invitation) => calendarDateKey(invitation.event_date)).map((invitation) => ({
      id: invitation.id || invitation.plan_number,
      type: 'invitation',
      typeLabel: 'Undangan',
      title: text(invitation.gathering_title, 'Undangan gathering'),
      statusLabel: text(invitation.action_label, 'Undangan diterima'),
      event_date: invitation.event_date,
      location: text(invitation.event_location),
    })),
  ].sort((left, right) => new Date(left.event_date).getTime() - new Date(right.event_date).getTime());
  const initialMonth = calendarMonthKey(content.preview_month, events[0]?.event_date);
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
            className: `kumpul-calendar-event kumpul-calendar-event-${event.type}`,
            'data-calendar-event': '',
            'data-calendar-date': calendarDateKey(event.event_date),
            hidden: calendarDateKey(event.event_date) !== selectedDate,
            key: event.id || index,
          },
          h('div', { className: 'kumpul-calendar-event-time' }, formatCalendarTime(event.event_date) || 'Acara'),
          h('div', { className: 'kumpul-calendar-event-copy' },
            h('span', { className: 'kumpul-calendar-event-kind' }, event.typeLabel),
            h('h4', null, event.title),
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
        h('button', { type: 'button', className: 'kumpul-calendar-action', disabled: true }, 'Lanjutkan rencana'),
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
          h('button', { type: 'button', className: 'kumpul-calendar-action', disabled: true }, 'Lihat undangan'),
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
    @media(max-width:700px){.kumpul-transactions-heading{align-items:flex-start;flex-direction:column;gap:16px}.kumpul-transactions-total{width:100%;padding:11px 13px}.kumpul-transactions-total strong{font-size:18px}.kumpul-transactions-filters{margin-top:20px}.kumpul-transaction-top{align-items:flex-start;padding:12px 14px}.kumpul-transaction-top>div{flex-wrap:wrap;gap:5px;font-size:9px}.kumpul-transaction-status{max-width:120px;white-space:normal;text-align:center}.kumpul-transaction-body{align-items:flex-start;padding:14px;gap:10px}.kumpul-transaction-art{width:44px;height:44px;border-radius:12px;font-size:20px}.kumpul-transaction-item{gap:9px}.kumpul-transaction-item h2{font-size:11px}.kumpul-transaction-total strong{font-size:13px}.kumpul-transaction-actions{padding:0 14px 13px;flex-wrap:wrap}.kumpul-transaction-actions button{flex:1;padding:7px 8px;font-size:8px}}
    .kumpul-billing{max-width:980px;margin:0 auto}.kumpul-billing-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}.kumpul-billing-heading h1{margin:0;color:var(--kt-text);font-size:clamp(30px,4vw,42px);line-height:1.15;letter-spacing:-.04em}.kumpul-billing-description{margin:9px 0 0;color:var(--kt-muted);font-size:13px}.kumpul-billing-summary{display:flex;gap:10px}.kumpul-billing-summary-card{min-width:132px;padding:13px 16px;display:grid;gap:2px;border:1px solid var(--kt-border);border-radius:15px;background:var(--kt-surface)}.kumpul-billing-summary-card strong{font-size:21px;line-height:1.1}.kumpul-billing-summary-card span{color:var(--kt-muted);font-size:10px}.kumpul-billing-preview-note{margin:20px 0 0;padding:11px 14px;border:1px solid var(--kt-border);border-radius:12px;background:var(--kt-surface);color:var(--kt-muted);font-size:11px}.kumpul-billing-filters{margin:25px 0 22px;padding-bottom:7px;display:flex;gap:8px;overflow-x:auto;border-bottom:1px solid var(--kt-border);scrollbar-width:thin}.kumpul-billing-filters button{padding:9px 12px;display:inline-flex;align-items:center;gap:8px;border:1px solid transparent;border-radius:11px 11px 0 0;background:transparent;color:var(--kt-muted);font:inherit;font-size:11px;font-weight:700;white-space:nowrap;cursor:pointer}.kumpul-billing-filters button[aria-pressed=true]{border-color:var(--kt-border);border-bottom-color:var(--kt-surface);background:var(--kt-surface);color:var(--kt-accent)}.kumpul-billing-filters button span{min-width:20px;height:20px;padding:2px 6px;display:grid;place-items:center;border-radius:99px;background:var(--kt-bg);color:var(--kt-muted);font-size:9px}.kumpul-billing-results-heading{margin-bottom:12px;display:flex;align-items:baseline;justify-content:space-between;gap:12px}.kumpul-billing-results-heading h2{margin:0;font-size:16px}.kumpul-billing-results-heading span{color:var(--kt-muted);font-size:11px}.kumpul-billing-list{display:grid;gap:12px}.kumpul-billing-card{overflow:hidden;border:1px solid var(--kt-border);border-radius:16px;background:var(--kt-surface)}.kumpul-billing-card-top{padding:17px 19px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-bottom:1px solid #e8f0f2}.kumpul-billing-kind{color:var(--kt-accent);font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.kumpul-billing-card h3{margin:4px 0 0;font-size:14px}.kumpul-billing-card-top p{margin:5px 0 0;color:var(--kt-muted);font-size:10px}.kumpul-billing-status{padding:6px 9px;flex:none;border-radius:99px;font-size:9px;font-weight:800}.kumpul-billing-status-warning{background:#fff4da;color:#a15c00}.kumpul-billing-status-success{background:#e5f7ef;color:#08734f}.kumpul-billing-status-muted{background:#eef1f4;color:#64748b}.kumpul-billing-card-bottom{padding:14px 19px;display:flex;align-items:center;justify-content:space-between;gap:16px}.kumpul-billing-card-bottom strong{font-size:17px;color:var(--kt-accent)}.kumpul-billing-card-bottom p{margin:4px 0 0;color:var(--kt-muted);font-size:10px}.kumpul-billing-action{min-height:36px;padding:8px 13px;border:0;border-radius:10px;background:var(--kt-accent);color:#fff;font:inherit;font-size:10px;font-weight:750;opacity:.62;cursor:not-allowed}.kumpul-billing-empty{margin:0;padding:32px 18px;border:1px dashed var(--kt-border);border-radius:15px;color:var(--kt-muted);font-size:12px;text-align:center}
    @media(max-width:700px){.kumpul-billing-heading{align-items:flex-start;flex-direction:column;gap:16px}.kumpul-billing-summary{width:100%}.kumpul-billing-summary-card{min-width:0;flex:1;padding:11px 13px}.kumpul-billing-summary-card strong{font-size:18px}.kumpul-billing-filters{margin-top:20px}.kumpul-billing-card-top{padding:15px;gap:10px}.kumpul-billing-card h3{font-size:13px}.kumpul-billing-status{max-width:120px;white-space:normal;text-align:center}.kumpul-billing-card-bottom{padding:13px 15px}.kumpul-billing-card-bottom strong{font-size:15px}}
    .kumpul-calendar-agenda:not([open]){display:none}.kumpul-calendar-agenda[open]{position:fixed;inset:50% auto auto 50%;z-index:10;width:min(560px,calc(100vw - 32px));max-height:calc(100dvh - 48px);margin:0;padding:0;display:flex;flex-direction:column;transform:translate(-50%,-50%);overflow:hidden;border:1px solid var(--kt-border);border-radius:22px;background:var(--kt-bg);color:var(--kt-text);box-shadow:0 24px 80px #0f172a45}.kumpul-calendar-agenda::backdrop{background:rgb(15 23 42 / 45%);backdrop-filter:blur(2px)}.kumpul-calendar-agenda-handle{display:none}.kumpul-calendar-agenda-heading{padding:22px 24px 16px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border-bottom:1px solid var(--kt-border)}.kumpul-calendar-agenda-heading .kumpul-eyebrow{margin:0 0 4px}.kumpul-calendar-agenda-heading h2{margin:0;font-size:20px;text-transform:capitalize}.kumpul-calendar-agenda-close{width:36px;height:36px;flex:none;border:1px solid var(--kt-border);border-radius:50%;background:var(--kt-surface);color:var(--kt-text);font:inherit;font-size:22px;line-height:1;cursor:pointer}.kumpul-calendar-agenda-content{min-height:0;padding:18px 24px 24px;overflow:auto;overscroll-behavior:contain}.kumpul-calendar-agenda-list{display:grid;gap:10px}.kumpul-calendar-empty{margin:0;padding:18px;border:1px dashed var(--kt-border);border-radius:14px;color:var(--kt-muted);font-size:13px;text-align:center}
    @media(max-width:620px){.kumpul-calendar-agenda[open]{inset:auto 0 0;width:100%;max-width:none;max-height:min(84dvh,720px);padding-bottom:env(safe-area-inset-bottom);transform:none;border-right:0;border-bottom:0;border-left:0;border-radius:22px 22px 0 0}.kumpul-calendar-agenda-handle{width:38px;height:4px;margin:10px auto 0;display:block;border-radius:99px;background:#cbd5e1}.kumpul-calendar-agenda-heading{padding:14px 20px 14px}.kumpul-calendar-agenda-content{padding:16px 20px 22px}.kumpul-calendar-agenda-close{width:34px;height:34px}}
    .kumpul-calendar-month-toolbar{margin:22px 0 14px;padding:17px 19px;display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid var(--kt-border);border-radius:17px;background:var(--kt-surface)}.kumpul-calendar-month-title h2{margin:0;font-size:20px;line-height:1.2;text-transform:capitalize}.kumpul-calendar-month-title p{margin:5px 0 0;color:var(--kt-muted);font-size:11px}.kumpul-calendar-month-actions{display:flex;align-items:center;gap:7px}.kumpul-calendar-month-actions button{min-width:38px;height:38px;padding:7px 11px;border:1px solid var(--kt-border);border-radius:11px;background:var(--kt-surface);color:var(--kt-text);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.kumpul-calendar-month-actions button[data-calendar-previous],.kumpul-calendar-month-actions button[data-calendar-next]{font-size:22px;line-height:1}.kumpul-calendar-month-view{overflow:hidden;border:1px solid var(--kt-border);border-radius:17px;background:var(--kt-surface)}.kumpul-calendar-weekdays,.kumpul-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}.kumpul-calendar-weekdays{border-bottom:1px solid var(--kt-border);background:#f8fbfc}.kumpul-calendar-weekdays span{padding:10px 6px;color:var(--kt-muted);font-size:10px;font-weight:750;text-align:center}.kumpul-calendar-day{position:relative;min-width:0;min-height:77px;padding:9px;display:flex;align-items:flex-start;justify-content:space-between;gap:4px;border:0;border-right:1px solid #e8f0f2;border-bottom:1px solid #e8f0f2;background:var(--kt-surface);color:var(--kt-text);font:inherit;text-align:left;cursor:pointer}.kumpul-calendar-day:nth-child(7n){border-right:0}.kumpul-calendar-day:nth-last-child(-n+7){border-bottom:0}.kumpul-calendar-day:hover{background:#f4fafb}.kumpul-calendar-day[aria-pressed=true]{background:#e6f4f6;box-shadow:inset 0 0 0 2px var(--kt-accent)}.kumpul-calendar-day[data-outside-month=true]{color:#a7b3bd;background:#fbfcfd}.kumpul-calendar-day>span{font-size:11px;font-weight:700}.kumpul-calendar-day small{min-width:19px;height:19px;padding:2px 5px;display:grid;place-items:center;border-radius:999px;background:var(--kt-accent);color:#fff;font-size:9px;font-weight:800}.kumpul-calendar-day:focus-visible,.kumpul-calendar-month-actions button:focus-visible{position:relative;z-index:1;outline:3px solid var(--kt-success);outline-offset:-3px}.kumpul-calendar-agenda{margin-top:24px}.kumpul-calendar-agenda>h3{margin:0 0 12px;font-size:16px;text-transform:capitalize}.kumpul-calendar-event{padding:14px 16px;display:grid;grid-template-columns:76px 1fr;align-items:start;gap:14px;border:1px solid var(--kt-border);border-left:4px solid var(--kt-accent);border-radius:14px;background:var(--kt-surface)}.kumpul-calendar-event[hidden]{display:none}.kumpul-calendar-event-invitation{border-left-color:var(--kt-success)}.kumpul-calendar-event-time{padding-top:2px;color:var(--kt-accent);font-size:11px;font-weight:800}.kumpul-calendar-event-copy{min-width:0}.kumpul-calendar-event-kind{color:var(--kt-muted);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.kumpul-calendar-event-copy h4{margin:3px 0 0;font-size:13px}.kumpul-calendar-event-copy p{margin:4px 0 0;color:var(--kt-muted);font-size:10px}
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
    .kumpul-feature-card{position:relative;min-height:360px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;background:radial-gradient(ellipse at 68% 30%,#58a3b8 0,#006699 53%,#00557a 100%);color:#fff}
    .kumpul-about-section{max-width:1180px;min-height:390px;margin:12px auto 0;padding:clamp(26px,5vw,58px);display:grid;grid-template-columns:1fr .85fr;align-items:center;gap:clamp(28px,6vw,72px);overflow:hidden;border:1px solid var(--kt-border);border-radius:26px;background:var(--kt-surface)}.kumpul-about-copy h1{max-width:650px;margin:0;font-size:clamp(34px,5vw,60px);line-height:1.03;font-weight:850;letter-spacing:-.06em}.kumpul-about-body{max-width:620px;margin:20px 0 0;color:var(--kt-muted);font-size:15px;line-height:1.8;white-space:pre-line}.kumpul-about-art,.kumpul-about-image{position:relative;min-height:270px;display:grid;place-items:center;overflow:hidden;border-radius:22px;background:radial-gradient(ellipse at 60% 40%,#58a3b8 0,#006699 58%,#00557a 100%)}.kumpul-about-art:before,.kumpul-about-art:after{position:absolute;width:270px;height:270px;border:1px solid #ffffff50;border-radius:50%;content:""}.kumpul-about-art:after{width:360px;height:360px}.kumpul-about-art span{position:absolute;z-index:1;display:grid;place-items:center;width:104px;height:104px;border:1px solid #ffffff70;border-radius:30px;background:#ffffff25;font-size:55px;box-shadow:0 16px 36px #002b443d}.kumpul-about-art span:first-child{transform:translate(-42px,-18px) rotate(-9deg)}.kumpul-about-art span:last-child{transform:translate(48px,40px) rotate(9deg)}.kumpul-about-image img{position:absolute;width:100%;height:100%;inset:0;object-fit:cover}
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
    .kumpul-plan-detail{max-width:980px;margin:0 auto}.kumpul-plan-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.kumpul-plan-heading h1{margin:0;color:var(--kt-text);font-size:clamp(28px,4vw,40px);line-height:1.15;letter-spacing:-.04em}.kumpul-plan-heading .kumpul-eyebrow{margin-bottom:8px}.kumpul-plan-number{margin:9px 0 0;color:var(--kt-muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px}.kumpul-plan-workflow{margin-top:20px;padding:17px;border:1px solid var(--kt-border);border-radius:16px;background:var(--kt-surface)}.kumpul-plan-current-step{margin:0 0 14px;color:var(--kt-muted);font-size:10px}.kumpul-plan-current-step strong{color:var(--kt-text)}.kumpul-plan-workflow ol{margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));list-style:none}.kumpul-plan-workflow li{min-width:0;padding:12px 9px 0;display:flex;align-items:center;gap:7px;border-top:2px solid var(--kt-border);color:var(--kt-muted);font-size:9px;font-weight:700}.kumpul-plan-workflow li.is-complete,.kumpul-plan-workflow li.is-current{border-color:var(--kt-accent);color:var(--kt-text)}.kumpul-plan-step-marker{width:21px;height:21px;flex:none;display:grid;place-items:center;border:1px solid var(--kt-border);border-radius:50%;font-size:9px}.kumpul-plan-workflow li.is-complete .kumpul-plan-step-marker,.kumpul-plan-workflow li.is-current .kumpul-plan-step-marker{border-color:var(--kt-accent);background:var(--kt-accent);color:#fff}.kumpul-plan-readonly{margin:12px 0 0;color:var(--kt-muted);font-size:9px;line-height:1.5}.kumpul-plan-layout{margin-top:16px;display:grid;grid-template-columns:minmax(0,1fr) 300px;align-items:start;gap:16px}.kumpul-plan-main{display:grid;gap:14px}.kumpul-plan-options{margin:0;padding:0;display:grid;list-style:none}.kumpul-plan-options li{padding:13px 0;border-top:1px solid var(--kt-border)}.kumpul-plan-option-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.kumpul-plan-option-group{color:var(--kt-muted);font-size:8px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}.kumpul-plan-option-heading h3{margin:3px 0 0;font-size:11px}.kumpul-plan-options li>p{margin:6px 0 0;color:var(--kt-muted);font-size:9px;line-height:1.5}.kumpul-plan-final-option{padding:5px 8px;border:1px solid var(--kt-accent);border-radius:99px;color:var(--kt-accent);font-size:8px;font-weight:800;white-space:nowrap}.kumpul-plan-votes{display:inline-block;margin-top:8px;color:var(--kt-accent);font-size:9px;font-weight:750}.kumpul-plan-empty-options{margin:0;color:var(--kt-muted);font-size:10px}.kumpul-plan-aside>p{margin:13px 0 0;color:var(--kt-muted);font-size:10px;line-height:1.6}.kumpul-plan-order-ref{overflow-wrap:anywhere;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8px!important}.kumpul-plan-account-link{margin-top:16px;padding:10px 12px;display:block;border:1px solid var(--kt-border);border-radius:10px;color:var(--kt-accent);font-size:10px;font-weight:800;text-align:center}
    .kumpul-plan-simulator{margin-top:18px;padding:20px;border:1px solid var(--kt-border);border-radius:18px;background:var(--kt-surface);box-shadow:0 8px 26px #0f172a0a}.kumpul-plan-simulator-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.kumpul-plan-simulator-heading h2{margin:0;font-size:19px;letter-spacing:-.025em}.kumpul-plan-simulator-heading .kumpul-eyebrow{margin-bottom:7px}.kumpul-plan-simulator-heading>div>p:last-child{margin:7px 0 0;color:var(--kt-muted);font-size:10px;line-height:1.55}.kumpul-plan-simulation-badge{padding:6px 9px;flex:none;border-radius:99px;background:#e6f4f6;color:var(--kt-accent);font-size:8px;font-weight:800}.kumpul-plan-simulation-note{margin:15px 0;padding:10px 12px;border:1px solid var(--kt-border);border-radius:10px;background:var(--kt-bg);color:var(--kt-muted);font-size:9px;line-height:1.55}.kumpul-plan-sim-steps{margin:17px 0 0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));list-style:none}.kumpul-plan-sim-steps li{min-width:0;border-top:2px solid var(--kt-border)}.kumpul-plan-sim-steps li.is-current,.kumpul-plan-sim-steps li.is-complete{border-color:var(--kt-accent)}.kumpul-plan-sim-steps button{width:100%;padding:10px 5px 4px;display:flex;align-items:center;gap:6px;border:0;background:none;color:var(--kt-muted);font:inherit;font-size:8px;font-weight:750;text-align:left}.kumpul-plan-sim-steps li.is-current button,.kumpul-plan-sim-steps li.is-complete button{color:var(--kt-text)}.kumpul-plan-sim-steps button:disabled{cursor:not-allowed;opacity:.65}.kumpul-plan-sim-steps button:not(:disabled){cursor:pointer}.kumpul-plan-sim-steps button>span:first-child{width:20px;height:20px;flex:none;display:grid;place-items:center;border:1px solid var(--kt-border);border-radius:50%;font-size:8px}.kumpul-plan-sim-steps li.is-current button>span:first-child,.kumpul-plan-sim-steps li.is-complete button>span:first-child{border-color:var(--kt-accent);background:var(--kt-accent);color:#fff}.kumpul-plan-sim-panel{margin-top:17px}.kumpul-plan-sim-panel[hidden],.kumpul-plan-sim-complete[hidden]{display:none}.kumpul-plan-sim-panel h3,.kumpul-plan-sim-complete h3{margin:0;font-size:15px}.kumpul-plan-sim-help{margin:6px 0 14px;color:var(--kt-muted);font-size:9px;line-height:1.5}.kumpul-plan-sim-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}.kumpul-plan-sim-form label,.kumpul-plan-sim-invite-form label,.kumpul-plan-sim-person>label{min-width:0;display:grid;gap:5px;color:var(--kt-muted);font-size:9px;font-weight:700}.kumpul-plan-sim-form input,.kumpul-plan-sim-form select,.kumpul-plan-sim-invite-form input,.kumpul-plan-sim-invitees input,.kumpul-plan-sim-person select{width:100%;min-width:0;min-height:37px;padding:8px 9px;border:1px solid var(--kt-border);border-radius:9px;background:#fff;color:var(--kt-text);font:inherit;font-size:10px}.kumpul-plan-sim-options{min-width:0;margin:15px 0 0;padding:11px;border:1px solid var(--kt-border);border-radius:11px}.kumpul-plan-sim-options legend{padding:0 5px;color:var(--kt-text);font-size:10px;font-weight:800}.kumpul-plan-sim-option{margin:5px 10px 5px 0;display:inline-flex;align-items:center;gap:6px;color:var(--kt-muted);font-size:9px}.kumpul-plan-sim-option input{accent-color:var(--kt-accent)}.kumpul-plan-sim-actions{margin-top:15px;display:flex;justify-content:flex-end;gap:8px}.kumpul-plan-sim-actions button,.kumpul-plan-sim-invite-form button,.kumpul-plan-sim-invitees button,.kumpul-plan-sim-payment button,.kumpul-plan-sim-complete button{min-height:36px;padding:8px 12px;border:1px solid var(--kt-border);border-radius:9px;background:#fff;color:var(--kt-text);font:inherit;font-size:9px;font-weight:800;cursor:pointer}.kumpul-plan-sim-actions .kumpul-plan-sim-primary{border-color:var(--kt-accent);background:var(--kt-accent);color:#fff}.kumpul-plan-sim-actions .kumpul-plan-sim-secondary{color:var(--kt-accent)}.kumpul-plan-sim-error{margin:12px 0 0;color:#b91c1c;font-size:9px;font-weight:700}.kumpul-plan-sim-invite-form{display:grid;grid-template-columns:1fr 1fr auto;align-items:end;gap:9px}.kumpul-plan-sim-invitees{margin:12px 0 0;padding:0;display:grid;gap:7px;list-style:none}.kumpul-plan-sim-invitees li{display:flex;align-items:center;gap:8px}.kumpul-plan-sim-invitees li>div{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:8px}.kumpul-plan-sim-invitees button,.kumpul-plan-sim-payment button{min-height:33px;padding:7px 9px;color:var(--kt-accent)}.kumpul-plan-sim-participants,.kumpul-plan-sim-payments{display:grid;gap:9px}.kumpul-plan-sim-person{padding:12px;display:grid;grid-template-columns:minmax(0,1fr) 170px;align-items:center;gap:11px;border:1px solid var(--kt-border);border-radius:12px;background:var(--kt-bg)}.kumpul-plan-sim-person-heading{min-width:0;display:grid;gap:3px}.kumpul-plan-sim-person-heading strong{font-size:10px}.kumpul-plan-sim-person-heading span{overflow-wrap:anywhere;color:var(--kt-muted);font-size:8px}.kumpul-plan-sim-person-options{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.kumpul-plan-sim-payment{grid-template-columns:minmax(0,1fr) auto}.kumpul-plan-sim-payment[data-sim-paid=true]{border-color:var(--kt-success);background:#effaf5}.kumpul-plan-sim-final-group{margin:7px 0 0;padding:8px;border:1px solid var(--kt-border);border-radius:9px}.kumpul-plan-sim-final-group legend{padding:0 4px;font-size:9px;font-weight:800}.kumpul-plan-sim-final-group label{margin:5px 10px 5px 0;display:inline-flex;align-items:center;gap:6px;color:var(--kt-muted);font-size:9px}.kumpul-plan-sim-final-group input{accent-color:var(--kt-accent)}.kumpul-plan-sim-complete{margin-top:18px;padding:22px;border:1px solid #8bd1ae;border-radius:13px;background:#effaf5;text-align:center}.kumpul-plan-sim-complete>span{width:34px;height:34px;margin:0 auto 9px;display:grid;place-items:center;border-radius:50%;background:var(--kt-success);color:#fff;font-weight:900}.kumpul-plan-sim-complete p{margin:7px 0 13px;color:var(--kt-muted);font-size:9px;line-height:1.5}
    @media(max-width:760px){.kumpul-plan-heading{flex-direction:column;gap:12px}.kumpul-plan-workflow{padding:14px}.kumpul-plan-workflow ol{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.kumpul-plan-workflow li{padding:9px 5px 0;font-size:8px}.kumpul-plan-layout{grid-template-columns:1fr;gap:13px}.kumpul-plan-aside{position:static}.kumpul-plan-simulator{padding:15px}.kumpul-plan-simulator-heading{flex-direction:column;gap:10px}.kumpul-plan-sim-form{grid-template-columns:1fr}.kumpul-plan-sim-invite-form{grid-template-columns:1fr}.kumpul-plan-sim-invite-form button{width:100%}.kumpul-plan-sim-invitees li{align-items:flex-start;flex-direction:column}.kumpul-plan-sim-invitees li>div{width:100%;grid-template-columns:1fr}.kumpul-plan-sim-invitees button{align-self:flex-end}.kumpul-plan-sim-person{grid-template-columns:1fr}.kumpul-plan-sim-person-options{grid-template-columns:1fr}.kumpul-plan-sim-payment{grid-template-columns:1fr}.kumpul-plan-sim-payment button{width:100%}.kumpul-plan-sim-steps button{align-items:flex-start;flex-direction:column;font-size:7px}.kumpul-plan-sim-actions{flex-wrap:wrap}.kumpul-plan-sim-actions button{flex:1}}
    @media(max-width:760px){.kumpul-detail-heading{align-items:flex-start;flex-direction:column}.kumpul-detail-layout{grid-template-columns:1fr;gap:13px}.kumpul-detail-aside{position:static}.kumpul-detail-card{padding:16px}.kumpul-detail-fields{gap:13px}.kumpul-detail-total strong{font-size:19px}.kumpul-detail-item{grid-template-columns:40px minmax(0,1fr);gap:10px}.kumpul-detail-item-art{width:40px;height:40px}.kumpul-detail-item>strong{grid-column:2}.kumpul-detail-page .kumpul-detail-preview-note{font-size:9px}}
    @media(max-width:900px){.kumpul-header-main{padding:12px 20px}.kumpul-utilities>a span{display:none}.kumpul-utilities>a{padding:9px}.kumpul-main{padding:24px 20px 60px}.kumpul-hero{grid-template-columns:1fr}.kumpul-hero-copy{padding:38px}.kumpul-feature-card{min-height:310px}.kumpul-about-section{grid-template-columns:1fr .8fr;gap:24px}.kumpul-about-art,.kumpul-about-image{min-height:230px}.kumpul-process-list{grid-template-columns:repeat(2,minmax(0,1fr))}.kumpul-process-step+.kumpul-process-step{border-left:0}.kumpul-process-step:nth-child(even){border-left:1px solid var(--kt-border)}.kumpul-process-step:nth-child(n+3){border-top:1px solid var(--kt-border)}.kumpul-gathering-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.kumpul-location-list{grid-template-columns:repeat(2,minmax(0,1fr))}.kumpul-category-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.kumpul-calendar-heading{align-items:flex-start;flex-direction:column}.kumpul-calendar-stats{width:100%}.kumpul-cta{align-items:flex-start;flex-direction:column}}
    @media(max-width:620px){.kumpul-header-main{min-height:64px;padding:9px 16px}.kumpul-logo,.kumpul-logo-mark{width:40px;height:40px;border-radius:13px}.kumpul-brand-copy strong{font-size:15px}.kumpul-brand-copy small{font-size:8px}.kumpul-utilities{display:none}.kumpul-page-nav{min-height:47px;justify-content:flex-start;overflow-x:auto;padding:5px 12px}.kumpul-page-nav a{padding:7px 12px;font-size:11px}.kumpul-main{padding:16px 14px 98px}.kumpul-hero{border-radius:21px}.kumpul-hero-copy{padding:27px 22px}.kumpul-community-pill{margin-bottom:17px;font-size:9px}.kumpul-hero h1{font-size:clamp(39px,12vw,58px)}.kumpul-hero-description{margin-top:15px;font-size:13px}.kumpul-hero-actions{gap:8px;margin-top:19px}.kumpul-button{min-height:42px;padding:10px 13px;font-size:11px}.kumpul-stats{gap:20px;margin-top:22px}.kumpul-stat strong{font-size:18px}.kumpul-stat span{font-size:9px}.kumpul-feature-card{min-height:250px;padding:16px}.kumpul-feature-art>span{width:86px;height:86px;font-size:42px}.kumpul-about-section{margin-top:0;padding:22px;grid-template-columns:1fr;border-radius:21px}.kumpul-about-copy h1{font-size:clamp(34px,10vw,48px)}.kumpul-about-body{font-size:13px}.kumpul-about-art,.kumpul-about-image{min-height:230px}.kumpul-gallery-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:135px;gap:9px}.kumpul-gallery-item:nth-child(3n+2){grid-row:span 1}.kumpul-gallery-item:nth-child(4n+1){grid-row:span 2}.kumpul-gallery-item>span{font-size:38px}.kumpul-process-list{grid-template-columns:1fr}.kumpul-process-step{padding:14px;display:grid;grid-template-columns:34px 1fr;column-gap:12px}.kumpul-process-step+.kumpul-process-step,.kumpul-process-step:nth-child(even),.kumpul-process-step:nth-child(n+3){border-top:1px solid var(--kt-border);border-left:0}.kumpul-process-step .kumpul-flow-number{grid-row:span 2}.kumpul-process-step small{grid-column:2}.kumpul-section{margin-top:48px}.kumpul-section-heading .kumpul-section-title,.kumpul-cta h2{font-size:29px}.kumpul-section-description{font-size:12px}.kumpul-flow-list{grid-template-columns:1fr;border-radius:16px}.kumpul-flow-step{min-height:0;padding:13px 15px;display:grid;grid-template-columns:34px 1fr;column-gap:11px}.kumpul-flow-step+.kumpul-flow-step{border-top:1px solid var(--kt-border);border-left:0}.kumpul-flow-number{grid-row:span 2}.kumpul-flow-step strong{margin:0}.kumpul-flow-step>span:last-child{font-size:10px}.kumpul-section-topline{align-items:flex-start}.kumpul-text-link{margin-top:5px;font-size:10px}.kumpul-catalog-heading{align-items:stretch;flex-direction:column;gap:16px}.kumpul-catalog-search{width:100%;min-height:44px}.kumpul-category-filters{grid-template-columns:1fr 1fr;gap:8px}.kumpul-category-filter{padding:9px;gap:8px}.kumpul-category-icon{width:32px;height:32px}.kumpul-category-filter strong{font-size:10px}.kumpul-category-filter small{font-size:8px}.kumpul-gathering-grid{grid-template-columns:1fr;gap:12px}.kumpul-gathering-card{display:grid;grid-template-columns:112px 1fr}.kumpul-gathering-art{min-height:100%;}.kumpul-gathering-art>span:first-child{font-size:36px}.kumpul-card-content{min-width:0;padding:12px}.kumpul-card-content h3{font-size:13px}.kumpul-card-meta{font-size:9px}.kumpul-card-bottom{margin-top:9px;padding-top:8px}.kumpul-card-bottom strong{font-size:10px}.kumpul-card-bottom span{font-size:9px}.kumpul-calendar{margin-top:0}.kumpul-calendar-title{font-size:34px}.kumpul-calendar-description{font-size:12px}.kumpul-calendar-stats{gap:7px}.kumpul-calendar-stat{min-width:0;flex:1;padding:10px}.kumpul-calendar-stat strong{font-size:16px}.kumpul-calendar-stat span{font-size:9px}.kumpul-calendar-card{align-items:flex-start;flex-direction:column;padding:15px}.kumpul-calendar-invitation-action{width:100%;justify-items:start}.kumpul-calendar-action{min-height:36px}.kumpul-section-topline{align-items:flex-start}.kumpul-text-link{margin-top:5px;font-size:10px}.kumpul-testimonial-grid{grid-template-columns:1fr}.kumpul-location-list{grid-template-columns:1fr}.kumpul-cta{margin-top:48px;padding:25px 20px;border-radius:19px}.kumpul-cta-actions{width:100%}.kumpul-cta-actions .kumpul-button{flex:1}.kumpul-footer{padding:20px 15px 95px;flex-direction:column}.kumpul-mobile-dock{position:fixed;z-index:5;right:0;bottom:0;left:0;padding:9px 5px max(9px,env(safe-area-inset-bottom));display:flex;justify-content:space-around;border-top:1px solid var(--kt-border);background:#fffffff2;backdrop-filter:blur(14px)}.kumpul-mobile-dock a{min-width:0;display:grid;justify-items:center;gap:3px;color:var(--kt-muted);font-size:8px}.kumpul-mobile-dock .kumpul-icon{width:19px;height:19px}}
    @media(prefers-reduced-motion:reduce){.kumpul-template *{scroll-behavior:auto!important;transition:none!important}}
  `;
}

function render(props = {}) {
  const colors = themeColors(props);
  const sections = list(props.sections);
  const orderDetailSection = sections.find((section) => section?.type === 'order_detail');
  const activePageSlug = orderDetailSection
    ? orderDetailSection.content?.gatheringPlan ? 'plan-detail' : 'transaction-detail'
    : ['cart', 'orders', 'tagihan', 'invoice-detail', 'transaction-detail', 'plan-detail'].includes(props.activePageSlug)
      ? props.activePageSlug
      : pageSlugForSections(sections);
  const catalogPage = activePageSlug === 'gathering';
  const billingPage = activePageSlug === 'tagihan';
  const transactionsPage = activePageSlug === 'orders';
  const cartPage = activePageSlug === 'cart';
  const invoiceDetailPage = activePageSlug === 'invoice-detail';
  const transactionDetailPage = activePageSlug === 'transaction-detail';
  const gatheringPlanDetailPage = activePageSlug === 'plan-detail';
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
      sections.filter((section) => section?.type === 'gathering_calendar').map((section) => h(CalendarSection, { props, section, key: section.id || 'calendar' })),
      billingPage ? h(BillingSection, { props }) : null,
      transactionsPage ? h(TransactionsSection, { props }) : null,
      cartPage ? h(CartSection, { props }) : null,
      invoiceDetailPage ? h(InvoiceDetailSection, { props }) : null,
      transactionDetailPage ? h(TransactionDetailSection, { props, section: orderDetailSection }) : null,
      gatheringPlanDetailPage ? h(GatheringPlanDetailSection, { props, section: orderDetailSection }) : null,
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
