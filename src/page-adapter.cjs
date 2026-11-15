/**
 * Adaptor kontrak `props.page` Bagdja → model internal Kumpul.
 *
 * Kontrak: bagdja-website-template-runtime/contract/page-contract.d.ts
 * Plan:    plan/website-builder/template-owned-system-pages-plan.md
 *
 * Renderer halaman Kumpul membaca bentuk data internal yang sama seperti saat
 * desain dibuat; modul ini satu-satunya tempat yang mengenal bentuk `props.page`.
 * Data yang sama dipakai di preview lokal, preview platform, dan website seller.
 */

const PAGE_SLUGS = {
  cart: 'cart',
  orders: 'orders',
  order_detail: 'transaction-detail',
  tagihan: 'tagihan',
  invoice_detail: 'invoice-detail',
  calendar: 'calendar',
  gathering_plan: 'plan-detail',
  product_detail: 'product-detail',
  gathering_invitation: 'invitation',
  draft_order: 'draft-order',
};

function list(value) {
  return Array.isArray(value) ? value : [];
}

function gatheringPaymentStatus(status) {
  if (status === 'PAID') return 'PAID';
  if (status === 'REFUNDED') return 'REFUNDED';
  return 'PENDING_PAYMENT';
}

function adaptCart(page) {
  return list(page.items).map((item) => ({
    id: item.key,
    key: item.key,
    kind: item.kind,
    name: item.name,
    category: item.category,
    subtitle: item.subtitle,
    variant: item.variant,
    emoji: item.emoji,
    imageUrl: item.imageUrl,
    price: item.unitPrice,
    quantity: item.quantity,
    quantity_editable: item.quantityEditable !== false,
    max_quantity: item.maxQuantity,
    can_checkout: item.checkoutable !== false,
    blocked_reason: item.blockedReason,
    detail_href: item.detailHref,
  }));
}

function adaptTransactions(page) {
  return list(page.transactions).map((transaction) => ({
    id: transaction.key,
    key: transaction.key,
    ref_number: transaction.reference,
    status: transaction.status,
    status_label: transaction.statusLabel,
    created_at: transaction.createdAt,
    total_amount: transaction.totalAmount,
    item_count: transaction.itemCount,
    has_outstanding_invoice: Boolean(transaction.outstanding),
    outstanding_label: transaction.outstanding ? transaction.outstanding.label : undefined,
    items: list(transaction.itemNames).map((name) => ({ product_name: name })),
    detail_href: transaction.detailHref,
  }));
}

function adaptTransaction(page) {
  const transaction = page.transaction || {};
  const shipping = transaction.shipping || {};
  return {
    id: transaction.key,
    key: transaction.key,
    ref_number: transaction.reference,
    status: transaction.status,
    status_label: transaction.statusLabel,
    status_message: transaction.statusMessage,
    created_at: transaction.createdAt,
    total_amount: transaction.totalAmount,
    subtotal_amount: transaction.subtotalAmount,
    payment_mode: transaction.paymentMode,
    payment_mode_label: transaction.paymentModeLabel,
    shipping_cost: transaction.shippingAmount,
    recipient_name: shipping.recipient,
    phone: shipping.phone,
    address: shipping.address,
    metadata: {
      shipping: {
        courier_service_name: shipping.courierLabel || transaction.courierLabel,
        destination_area_name: shipping.areaLabel,
      },
    },
    items: list(transaction.items).map((item) => ({
      id: item.key,
      key: item.key,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_amount: item.totalAmount,
      product_name: item.name,
      emoji: item.emoji,
      detail_href: item.detailHref,
    })),
  };
}

function adaptInvoices(page) {
  return list(page.invoices).map((invoice) => {
    if (invoice.kind === 'gathering') {
      return {
        id: invoice.key,
        key: invoice.key,
        kind: 'gathering',
        invoice_id: invoice.label,
        gathering_title: invoice.title,
        amount: invoice.amount,
        invoice_issued_at: invoice.status === 'SCHEDULED' ? null : invoice.createdAt,
        invoice_status: invoice.status === 'SCHEDULED' ? 'SCHEDULED' : 'ISSUED',
        payment_status: gatheringPaymentStatus(invoice.status),
        payment_deadline: invoice.dueAt,
        can_pay: invoice.canPay === true,
        detail_href: invoice.detailHref,
        transaction_href: invoice.transactionHref,
      };
    }
    return {
      id: invoice.key,
      key: invoice.key,
      kind: 'termin',
      sequence: invoice.sequence,
      productName: invoice.title,
      label: invoice.label,
      amount: invoice.amount,
      status: invoice.status,
      anchorStepName: invoice.stepLabel,
      createdAt: invoice.createdAt,
      dueDate: invoice.dueAt,
      can_pay: invoice.canPay === true,
      detail_href: invoice.detailHref,
      transaction_href: invoice.transactionHref,
    };
  });
}

function adaptInvoice(page) {
  const invoice = page.invoice || {};
  return {
    key: invoice.key,
    invoice_id: invoice.number,
    plan_number: invoice.planNumber,
    gathering_title: invoice.title,
    attendee_name: invoice.attendeeName,
    initiator_name: invoice.initiatorName,
    amount: invoice.amount,
    currency: page.currency,
    payment_status: invoice.status === 'PAID' || invoice.status === 'REFUNDED' ? invoice.status : 'UNPAID',
    payment_open: page.canPay === true,
    login_required: page.loginRequired === true,
    payment_deadline: invoice.dueAt,
    event_date: invoice.eventAt,
  };
}

function adaptPlan(page) {
  const plan = page.plan || {};
  const occurrence = plan.occurrence || {};
  const options = list(occurrence.options);
  return {
    id: plan.key,
    key: plan.key,
    plan_number: plan.planNumber,
    title: plan.title,
    status: plan.status,
    status_label: plan.statusLabel,
    workflow_step: plan.workflowStep,
    workflow_step_label: plan.workflowStepLabel,
    invite_policy: plan.invitePolicy,
    invitation_banner_url: typeof plan.invitationBannerUrl === 'string' && /^https:\/\//.test(plan.invitationBannerUrl)
      ? plan.invitationBannerUrl
      : undefined,
    invitation_description: plan.invitationDescription,
    invitation_description_html: typeof plan.invitationDescriptionHtml === 'string' ? plan.invitationDescriptionHtml : undefined,
    can_cancel: plan.canCancel === true,
    public_invitation_href: plan.publicInvitationHref,
    public_invitation_url: typeof plan.publicInvitationUrl === 'string' && /^https?:\/\/[^\s<>"']+$/.test(plan.publicInvitationUrl)
      ? plan.publicInvitationUrl
      : undefined,
    occurrence: {
      status: occurrence.status,
      status_label: occurrence.statusLabel,
      price_per_seat: occurrence.seatPrice,
      currency: page.currency,
      deposit_amount_per_seat: occurrence.depositPerSeatAmount,
      min_attendees: occurrence.minAttendees,
      max_attendees: occurrence.maxAttendees,
      rsvp_close_at: occurrence.rsvpCloseAt,
      payment_deadline: occurrence.paymentDueAt,
      final_schedule: occurrence.scheduledAt,
      final_location: occurrence.location,
      final_location_address: occurrence.locationAddress,
      final_location_map_url: occurrence.locationMapUrl,
      option_groups_snapshot: options.map((option) => ({
        product_option_id: option.key,
        option_group_key: option.group,
        option_key: option.key,
        label: option.label,
        description: option.description,
        description_html: typeof option.descriptionHtml === 'string' ? option.descriptionHtml : undefined,
        venue_location: option.venue,
        venue_address: option.address,
        venue_map_url: option.mapUrl,
        image_url: typeof option.imageUrl === 'string' && /^(https:\/\/|data:image\/)/.test(option.imageUrl) ? option.imageUrl : undefined,
        image_urls: list(option.images).filter((url) => typeof url === 'string' && /^(https:\/\/|data:image\/)/.test(url)).slice(0, 5),
        is_final_selection: option.isFinal === true,
      })),
      opened_option_ids_snapshot: options.filter((option) => option.isOpen).map((option) => option.key),
      voting_results: Object.fromEntries(
        options.filter((option) => typeof option.votes === 'number').map((option) => [option.key, option.votes]),
      ),
    },
  };
}

function adaptInvitations(page) {
  return list(page.invitations).map((invitation) => ({
    key: invitation.key,
    name: invitation.name,
    status: invitation.status,
    status_label: invitation.statusLabel,
    channel: invitation.channel,
    invite_href: invitation.inviteHref,
    can_revoke: invitation.canRevoke === true,
  }));
}

function adaptRegistrations(page) {
  return list(page.registrations).map((registration) => ({
    key: registration.key,
    name: registration.name,
    registration_status: registration.registrationStatus,
    payment_status: registration.paymentStatus,
    status_label: registration.statusLabel,
    invoice_amount: registration.invoiceAmount,
    selected_options: list(registration.selectedOptions),
    rejection_message: registration.rejectionMessage,
    can_reject: registration.canReject === true,
    can_checkout: registration.canCheckout === true,
    can_cancel_checkout: registration.canCancelCheckout === true,
    can_refund: registration.canRefund === true,
  }));
}

function adaptOperation(page) {
  const operation = page.operation;
  if (!operation || typeof operation !== 'object') return null;
  return {
    kind: operation.kind,
    status: operation.status,
    label: operation.label,
    processed: operation.processedCount,
    total: operation.totalCount,
    failed: operation.failedCount,
    message: operation.message,
  };
}

function adaptCalendar(page) {
  return {
    title: 'Kalender Acara',
    month: page.initialMonth,
    plans: list(page.plans).map((plan) => ({
      id: plan.key,
      key: plan.key,
      title: plan.title,
      plan_number: plan.planNumber,
      status: plan.status,
      workflow_step_label: plan.stepLabel,
      event_date: plan.eventAt,
      payment_deadline: plan.paymentDueAt,
      min_attendees: plan.minAttendees,
      max_attendees: plan.maxAttendees,
      detail_href: plan.detailHref,
    })),
    invitations: list(page.invitations).map((invitation) => ({
      id: invitation.key,
      key: invitation.key,
      gathering_title: invitation.title,
      plan_number: invitation.planNumber,
      initiator_name: invitation.initiatorName,
      event_date: invitation.eventAt,
      event_location: invitation.location,
      is_new: invitation.isNew === true,
      needs_action: invitation.needsAction === true,
      response: invitation.response,
      action_label: invitation.responseLabel,
      detail_href: invitation.detailHref,
    })),
    services: list(page.services).map((service) => ({
      id: service.key,
      key: service.key,
      title: service.title,
      image_url: service.imageUrl,
      status: service.status,
      status_label: service.statusLabel,
      start_at: service.startAt,
      end_at: service.endAt,
      all_day: service.allDay === true,
      quantity: service.quantity,
      detail_href: service.detailHref,
    })),
  };
}

/**
 * @returns {null | {
 *   type: string, activePageSlug: string, actions: string[], timezone: string,
 *   cart?: object[], transactions?: object[], transaction?: object, invoices?: object[],
 *   invoice?: object, plan?: object, invitees?: object[], viewerRole?: string, calendar?: object,
 * }}
 */
/** Detail produk gathering — urutan kelompok & opsi dipertahankan apa adanya (urutan data seller). */
function adaptProduct(page) {
  const product = page.product && typeof page.product === 'object' ? page.product : {};
  const gathering = product.gathering && typeof product.gathering === 'object' ? product.gathering : {};
  return {
    key: product.key,
    name: product.name,
    category: product.category,
    price_label: product.priceLabel,
    href: product.href,
    images: list(product.images).filter((url) => typeof url === 'string'),
    description: product.description,
    description_html: typeof product.descriptionHtml === 'string' ? product.descriptionHtml : undefined,
    detail_html: typeof product.detailHtml === 'string' ? product.detailHtml : undefined,
    deposit_amount: gathering.depositAmount,
    min_attendees: gathering.minAttendees,
    max_attendees: gathering.maxAttendees,
    event_date_label: gathering.eventDateLabel,
    location: gathering.location,
    cancellation_policy: gathering.cancellationPolicy,
    option_groups: list(gathering.optionGroups).map((group) => ({
      label: group.label,
      options: list(group.options).map((option) => ({
        key: option.key,
        label: option.label,
        description: option.description,
        description_html: typeof option.descriptionHtml === 'string' ? option.descriptionHtml : undefined,
        venue: option.venue,
        address: option.address,
        map_url: option.mapUrl,
        availability_note: option.availabilityNote,
        benefits: list(option.benefits),
        image_url: typeof option.imageUrl === 'string' ? option.imageUrl : undefined,
        images: list(option.images).filter((url) => typeof url === 'string'),
      })),
    })),
    specifications: list(product.specifications),
  };
}

function adaptPage(page) {
  if (!page || typeof page !== 'object' || !PAGE_SLUGS[page.type]) return null;
  const base = {
    type: page.type,
    activePageSlug: PAGE_SLUGS[page.type],
    actions: list(page.actions),
    timezone: typeof page.timezone === 'string' ? page.timezone : 'Asia/Jakarta',
  };
  switch (page.type) {
    case 'cart':
      return { ...base, cart: adaptCart(page) };
    case 'orders':
      return { ...base, transactions: adaptTransactions(page) };
    case 'order_detail':
      return { ...base, transaction: adaptTransaction(page) };
    case 'tagihan':
      return { ...base, invoices: adaptInvoices(page) };
    case 'invoice_detail':
      return { ...base, invoice: adaptInvoice(page) };
    case 'calendar':
      return { ...base, calendar: adaptCalendar(page) };
    case 'gathering_plan':
      return {
        ...base,
        plan: adaptPlan(page),
        // Keputusan E3: tanpa email/kontak peserta.
        invitees: list(page.invitees).map((invitee) => ({
          name: invitee.name,
          rsvp_status: invitee.rsvpStatus,
          rsvp_label: invitee.rsvpLabel,
        })),
        // Kontrak v2: data pengelolaan initiator (tanpa kontak peserta).
        invitations: adaptInvitations(page),
        registrations: adaptRegistrations(page),
        operation: adaptOperation(page),
        viewerRole: page.viewerRole,
      };
    case 'gathering_invitation':
      // Undangan: bentuk kontrak dipakai langsung (camelCase) — sudah tersanitasi & tanpa kontak mentah.
      return {
        ...base,
        invitationPage: {
          invitation: page.invitation && typeof page.invitation === 'object' ? page.invitation : {},
          optionGroups: list(page.optionGroups),
          viewer: page.viewer && typeof page.viewer === 'object' ? page.viewer : { state: 'closed' },
          loginHref: typeof page.loginHref === 'string' ? page.loginHref : '',
          switchAccountHref: typeof page.switchAccountHref === 'string' ? page.switchAccountHref : '',
        },
      };
    case 'product_detail':
      return { ...base, product: adaptProduct(page), related: list(page.related), loggedIn: page.loggedIn === true };
    case 'draft_order':
      // Draft pesanan: bentuk kontrak dipakai langsung (camelCase, sudah tersanitasi host).
      return {
        ...base,
        draftOrder: {
          order: page.order && typeof page.order === 'object' ? page.order : {},
          steps: list(page.steps),
          quote: page.quote && typeof page.quote === 'object' ? page.quote : null,
          canPay: page.canPay === true,
          canCancel: page.canCancel === true,
          ordersHref: typeof page.ordersHref === 'string' ? page.ordersHref : '',
        },
      };
    default:
      return null;
  }
}

module.exports = { adaptPage, PAGE_SLUGS };
