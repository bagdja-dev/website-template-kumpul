import QRCode from 'qrcode';

(() => {
  const header = document.querySelector('.kumpul-header');
  if (header) {
    const updateHeaderHeight = () => {
      document.documentElement.style.setProperty('--kumpul-header-height', `${header.getBoundingClientRect().height}px`);
    };
    updateHeaderHeight();
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(updateHeaderHeight).observe(header);
    } else {
      window.addEventListener('resize', updateHeaderHeight);
    }
  }

  document.querySelectorAll('[data-calendar-page]').forEach((calendar) => {
    const tabs = Array.from(calendar.querySelectorAll('[data-calendar-tab]'));
    const panels = Array.from(calendar.querySelectorAll('[data-calendar-panel]'));
    const description = calendar.querySelector('[data-calendar-description]');
    const filters = Array.from(calendar.querySelectorAll('[data-calendar-filter]'));
    const cards = Array.from(calendar.querySelectorAll('[data-calendar-card]'));
    const filterEmpty = calendar.querySelector('[data-calendar-filter-empty]');
    const calendarPanel = calendar.querySelector('[data-calendar-panel="calendar"]');
    const monthLabel = calendar.querySelector('[data-calendar-month-label]');
    const dayGrid = calendar.querySelector('.kumpul-calendar-grid');
    const eventCards = Array.from(calendar.querySelectorAll('[data-calendar-event]'));
    const selectedLabel = calendar.querySelector('[data-calendar-selected-label]');
    const agendaEmpty = calendar.querySelector('[data-calendar-agenda-empty]');
    const agendaDialog = calendar.querySelector('[data-calendar-agenda-dialog]');
    if (tabs.length === 0 || panels.length === 0) return;

    const descriptions = {
      calendar: 'Lihat jadwal gathering, rencana, dan undangan Anda dalam satu kalender.',
      plans: 'Kelola rencana, peserta, voting, dan pembayaran seat acara yang Anda buat.',
      invitations: 'Acara yang mengundang Anda. Buka undangan untuk menjawab RSVP, membayar seat, dan melihat tiket masuk.',
    };

    const monthNames = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const dateNames = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const eventCounts = new Map();
    eventCards.forEach((card) => {
      const key = card.dataset.calendarDate;
      eventCounts.set(key, (eventCounts.get(key) || 0) + 1);
    });
    let displayedMonth = calendarPanel?.dataset.initialMonth || new Date().toISOString().slice(0, 7);
    let selectedDate = calendarPanel?.dataset.initialDate || `${displayedMonth}-01`;

    const dateKey = (date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');

    const selectDate = (key) => {
      selectedDate = key;
      const [year, month, day] = key.split('-').map(Number);
      if (selectedLabel) selectedLabel.textContent = dateNames.format(new Date(Date.UTC(year, month - 1, day, 12)));
      eventCards.forEach((card) => {
        card.hidden = card.dataset.calendarDate !== selectedDate;
      });
      if (agendaEmpty) agendaEmpty.hidden = eventCards.some((card) => card.dataset.calendarDate === selectedDate);
      dayGrid?.querySelectorAll('[data-calendar-day]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.calendarDay === selectedDate));
      });
    };

    const openAgenda = () => {
      if (agendaDialog && !agendaDialog.open) agendaDialog.showModal();
    };

    const renderMonth = () => {
      if (!dayGrid || !monthLabel) return;
      const [year, month] = displayedMonth.split('-').map(Number);
      const firstDay = new Date(Date.UTC(year, month - 1, 1));
      const startOffset = (firstDay.getUTCDay() + 6) % 7;
      const start = new Date(Date.UTC(year, month - 1, 1 - startOffset));
      monthLabel.textContent = monthNames.format(firstDay);
      dayGrid.setAttribute('aria-label', `Kalender ${monthLabel.textContent}`);
      const fragment = document.createDocumentFragment();

      for (let index = 0; index < 42; index += 1) {
        const date = new Date(start);
        date.setUTCDate(start.getUTCDate() + index);
        const key = date.toISOString().slice(0, 10);
        const count = eventCounts.get(key) || 0;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'kumpul-calendar-day';
        button.dataset.calendarDay = key;
        button.setAttribute('aria-pressed', String(key === selectedDate));
        button.setAttribute('aria-label', `${dateNames.format(date)}${count ? `, ${count} acara` : ''}`);
        if (date.getUTCMonth() !== month - 1) button.dataset.outsideMonth = 'true';
        const dayNumber = document.createElement('span');
        dayNumber.textContent = String(date.getUTCDate());
        button.append(dayNumber);
        if (count) {
          const eventCount = document.createElement('small');
          eventCount.textContent = String(count);
          button.append(eventCount);
        }
        button.addEventListener('click', () => {
          selectDate(key);
          openAgenda();
        });
        fragment.append(button);
      }

      dayGrid.replaceChildren(fragment);
      const [selectedYear, selectedMonth] = selectedDate.split('-');
      if (`${selectedYear}-${selectedMonth}` !== displayedMonth) {
        const firstEvent = eventCards.find((card) => card.dataset.calendarDate.startsWith(`${displayedMonth}-`));
        selectedDate = firstEvent?.dataset.calendarDate || `${displayedMonth}-01`;
      }
      selectDate(selectedDate);
    };

    const selectTab = (tab) => {
      const selectedTab = tab.dataset.calendarTab;
      tabs.forEach((item) => item.setAttribute('aria-selected', String(item === tab)));
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.calendarPanel !== selectedTab;
      });
      if (description) description.textContent = descriptions[selectedTab];
    };

    tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab)));
    calendar.querySelector('[data-calendar-previous]')?.addEventListener('click', () => {
      const [year, month] = displayedMonth.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 2, 1));
      displayedMonth = date.toISOString().slice(0, 7);
      renderMonth();
    });
    calendar.querySelector('[data-calendar-next]')?.addEventListener('click', () => {
      const [year, month] = displayedMonth.split('-').map(Number);
      const date = new Date(Date.UTC(year, month, 1));
      displayedMonth = date.toISOString().slice(0, 7);
      renderMonth();
    });
    calendar.querySelector('[data-calendar-today]')?.addEventListener('click', () => {
      const today = new Date();
      displayedMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      selectedDate = dateKey(today);
      renderMonth();
    });
    dayGrid?.querySelectorAll('[data-calendar-day]').forEach((button) => {
      button.addEventListener('click', () => {
        selectDate(button.dataset.calendarDay);
        openAgenda();
      });
    });
    selectDate(selectedDate);
    calendar.querySelector('[data-calendar-close]')?.addEventListener('click', () => agendaDialog?.close());
    agendaDialog?.addEventListener('click', (event) => {
      if (event.target === agendaDialog) agendaDialog.close();
    });

    filters.forEach((filter) => {
      filter.addEventListener('click', () => {
        filters.forEach((item) => item.setAttribute('aria-pressed', String(item === filter)));
        const status = filter.dataset.calendarFilter;
        const matches = cards.filter((card) =>
          status === 'all' || card.dataset.calendarStatus === status,
        );
        cards.forEach((card) => {
          card.hidden = !matches.includes(card);
        });
        if (filterEmpty) filterEmpty.hidden = matches.length > 0;
      });
    });
  });

  document.querySelectorAll('[data-billing-page]').forEach((billing) => {
    const filters = Array.from(billing.querySelectorAll('[data-billing-filter]'));
    const items = Array.from(billing.querySelectorAll('[data-billing-item]'));
    const countLabel = billing.querySelector('[data-billing-count]');
    const empty = billing.querySelector('[data-billing-empty]');
    const filterEmpty = billing.querySelector('[data-billing-filter-empty]');

    filters.forEach((filter) => {
      filter.addEventListener('click', () => {
        const status = filter.dataset.billingFilter;
        const matchingItems = items.filter((item) =>
          status === 'all' || item.dataset.billingStatus === status,
        );
        filters.forEach((item) => item.setAttribute('aria-pressed', String(item === filter)));
        items.forEach((item) => {
          item.hidden = !matchingItems.includes(item);
        });
        if (countLabel) countLabel.textContent = `${matchingItems.length} tagihan`;
        if (empty) empty.hidden = items.length > 0;
        if (filterEmpty) filterEmpty.hidden = matchingItems.length > 0 || items.length === 0;
      });
    });
  });

  document.querySelectorAll('[data-transactions-page]').forEach((transactions) => {
    const filters = Array.from(transactions.querySelectorAll('[data-transaction-filter]'));
    const items = Array.from(transactions.querySelectorAll('[data-transaction-item]'));
    const empty = transactions.querySelector('[data-transactions-empty]');
    const filterEmpty = transactions.querySelector('[data-transactions-filter-empty]');

    filters.forEach((filter) => {
      filter.addEventListener('click', () => {
        const status = filter.dataset.transactionFilter;
        const matchingItems = items.filter((item) =>
          status === 'all' || item.dataset.transactionStatus === status,
        );
        filters.forEach((item) => item.setAttribute('aria-pressed', String(item === filter)));
        items.forEach((item) => {
          item.hidden = !matchingItems.includes(item);
        });
        if (empty) empty.hidden = items.length > 0;
        if (filterEmpty) filterEmpty.hidden = matchingItems.length > 0 || items.length === 0;
      });
    });
  });

  document.querySelectorAll('[data-cart-page]').forEach((cart) => {
    const list = cart.querySelector('[data-cart-list]');
    const selectAll = cart.querySelector('[data-cart-select-all]');
    const displayCount = cart.querySelector('[data-cart-display-count]');
    const selectedCount = cart.querySelector('[data-cart-selected-count]');
    const selectedTotal = cart.querySelector('[data-cart-selected-total]');
    const empty = cart.querySelector('[data-cart-empty]');
    if (!list) return;

    const items = () => Array.from(list.querySelectorAll('[data-cart-item]'));
    const updateSummary = () => {
      const currentItems = items();
      const selectable = currentItems.filter((item) => item.dataset.cartCheckoutable === 'true');
      const selected = selectable.filter((item) => item.querySelector('[data-cart-select]')?.checked);
      const selectedUnits = selected.reduce((total, item) =>
        total + (Number(item.querySelector('[data-cart-quantity]')?.textContent) || 1), 0);
      const totalUnits = currentItems
        .filter((item) => item.dataset.cartCheckoutable === 'true')
        .reduce((total, item) => total + (Number(item.querySelector('[data-cart-quantity]')?.textContent) || 1), 0);
      const totalCount = currentItems
        .filter((item) => item.querySelector('[data-cart-quantity]'))
        .reduce((total, item) => total + (Number(item.querySelector('[data-cart-quantity]')?.textContent) || 1), 0);
      const totalAmount = selected.reduce((total, item) => {
        const quantity = Number(item.querySelector('[data-cart-quantity]')?.textContent) || 1;
        const unitPrice = Number(item.dataset.cartUnitPrice) || 0;
        return total + quantity * unitPrice;
      }, 0);
      const allSelected = selectable.length > 0 && selected.length === selectable.length;
      cart.classList.toggle('is-empty', currentItems.length === 0);

      currentItems.forEach((item) => {
        const quantity = Number(item.querySelector('[data-cart-quantity]')?.textContent) || 1;
        const price = Number(item.dataset.cartUnitPrice) || 0;
        const lineTotal = item.querySelector('[data-cart-line-total]');
        const decrease = item.querySelector('[data-cart-quantity-decrease]');
        if (lineTotal) lineTotal.textContent = `Rp ${(quantity * price).toLocaleString('id-ID')}`;
        if (decrease) decrease.disabled = quantity <= 1;
      });

      if (displayCount) displayCount.textContent = `(${totalCount} item)`;
      if (selectedCount) selectedCount.textContent = `${selectedUnits} item`;
      if (selectedTotal) selectedTotal.textContent = `Rp ${totalAmount.toLocaleString('id-ID')}`;
      if (selectAll) {
        selectAll.setAttribute('aria-pressed', String(allSelected));
        selectAll.textContent = allSelected ? 'Batalkan semua' : 'Pilih semua';
      }
      if (empty) empty.hidden = currentItems.length > 0;
    };

    selectAll?.addEventListener('click', () => {
      const selectable = items().filter((item) => item.dataset.cartCheckoutable === 'true');
      const allSelected = selectable.length > 0
        && selectable.every((item) => item.querySelector('[data-cart-select]')?.checked);
      selectable.forEach((item) => {
        const checkbox = item.querySelector('[data-cart-select]');
        if (checkbox) checkbox.checked = !allSelected;
      });
      updateSummary();
    });

    list.addEventListener('change', (event) => {
      if (event.target.matches('[data-cart-select]')) updateSummary();
    });
    list.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const item = button.closest('[data-cart-item]');
      if (!item) return;

      const quantityLabel = item.querySelector('[data-cart-quantity]');
      if (button.matches('[data-cart-quantity-increase]') && quantityLabel) {
        quantityLabel.textContent = String((Number(quantityLabel.textContent) || 1) + 1);
      } else if (button.matches('[data-cart-quantity-decrease]') && quantityLabel) {
        quantityLabel.textContent = String(Math.max(1, (Number(quantityLabel.textContent) || 1) - 1));
      } else if (button.matches('[data-cart-remove]')) {
        item.remove();
      }
      updateSummary();
    });

    updateSummary();
  });

  document.querySelectorAll('[data-plan-simulator]').forEach((simulator) => {
    const stages = ['PLAN', 'INVITATIONS', 'INVITATION_CONFIRMATION', 'PAYMENT_CONFIRMATION'];
    const stepButtons = Array.from(simulator.querySelectorAll('[data-sim-step]'));
    const panels = Array.from(simulator.querySelectorAll('[data-sim-panel]'));
    const inviteList = simulator.querySelector('[data-sim-invitees]');
    const participantList = simulator.querySelector('[data-sim-participants]');
    const publicInvitation = simulator.querySelector('[data-sim-public-invitation]');
    const publicInvitationQr = simulator.querySelector('[data-sim-public-qr]');
    const publicInvitationQrStatus = simulator.querySelector('[data-sim-public-qr-status]');
    const publicInvitationLink = simulator.querySelector('[data-sim-public-invitation-link]');
    const paymentList = simulator.querySelector('[data-sim-payments]');
    const finalOptions = simulator.querySelector('[data-sim-final-options]');
    const completePanel = simulator.querySelector('[data-sim-complete]');
    const savedMessage = simulator.querySelector('[data-sim-saved]');
    let activeStage = 'PLAN';
    let furthestStage = 0;
    let invitees = [];
    let participants = [];
    let confirmedParticipants = [];
    let completionDetails = null;

    const activeOptions = () => Array.from(simulator.querySelectorAll('[data-sim-option]:checked'))
      .map((input) => ({
        id: input.value,
        group: input.dataset.simOptionGroup || 'Pilihan',
        label: input.dataset.simOptionLabel || input.value,
        description: input.dataset.simOptionDescription || '',
        location: input.dataset.simOptionLocation || '',
        isFinal: input.dataset.simOptionFinal === 'true',
      }));

    const renderStage = () => {
      renderPublicInvitation();
      panels.forEach((panel) => {
        panel.hidden = completionDetails || panel.dataset.simPanel !== activeStage;
        const isReadOnly = completionDetails || stages.indexOf(panel.dataset.simPanel) < furthestStage;
        panel.querySelectorAll('input, select, button').forEach((control) => {
          control.disabled = isReadOnly && !control.matches('[data-sim-back]');
        });
      });
      stepButtons.forEach((button, index) => {
        const selected = !completionDetails && stages[index] === activeStage;
        const item = button.closest('[data-sim-step-item]');
        button.disabled = completionDetails || index > furthestStage;
        if (selected) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
        item?.classList.toggle('is-current', selected);
        item?.classList.toggle('is-complete', completionDetails || index < furthestStage);
        const number = button.querySelector('[data-sim-step-number]');
        if (number) number.textContent = completionDetails || index < furthestStage ? '✓' : String(index + 1);
      });
      const currentStageText = completionDetails
        ? 'Selesai'
        : ({
          PLAN: 'Atur rencana',
          INVITATIONS: 'Buat undangan',
          INVITATION_CONFIRMATION: 'Konfirmasi undangan',
          PAYMENT_CONFIRMATION: 'Konfirmasi pembayaran',
        })[activeStage];
      const asideStageLabel = simulator.closest('[data-plan-detail]')?.querySelector('[data-plan-aside-step]');
      if (asideStageLabel) asideStageLabel.textContent = currentStageText;
      simulator.dataset.currentStep = completionDetails ? 'COMPLETE' : activeStage;
      if (completePanel) completePanel.hidden = !completionDetails;
    };

    const showError = (stage, message) => {
      const panel = simulator.querySelector(`[data-sim-panel="${stage}"]`);
      const error = panel?.querySelector('[data-sim-error]');
      if (!error) return;
      error.textContent = message;
      error.hidden = false;
    };

    const clearError = (stage) => {
      const error = simulator.querySelector(`[data-sim-panel="${stage}"] [data-sim-error]`);
      if (error) {
        error.textContent = '';
        error.hidden = true;
      }
    };

    const updatePlanSummary = () => {
      const title = simulator.querySelector('[data-sim-title]')?.value.trim();
      const policy = simulator.querySelector('[data-sim-policy]')?.value;
      const page = simulator.closest('[data-plan-detail]');
      const heading = page?.querySelector('.kumpul-plan-heading h1');
      if (heading && title) heading.textContent = title;
      const values = new Map([
        ['Akses undangan', policy === 'INVITE_ONLY' ? 'Khusus undangan' : 'Terbuka'],
        ['Terakhir reservasi', planDateValue('rsvp') ? formatSimulationDate(planDateValue('rsvp')) : 'Belum ditentukan'],
        ['Batas pembayaran', planDateValue('payment') ? formatSimulationDate(planDateValue('payment')) : 'Belum ditentukan'],
        ['Jadwal acara', planDateValue('event') ? formatSimulationDate(planDateValue('event')) : 'Belum ditentukan'],
      ]);
      if (completionDetails) {
        values.set('Status acara', 'Dikonfirmasi · simulasi');
        page?.querySelectorAll('.kumpul-plan-heading .kumpul-transaction-status, .kumpul-plan-aside .kumpul-transaction-status')
          .forEach((label) => {
            label.textContent = 'Dikonfirmasi · simulasi';
            label.className = 'kumpul-transaction-status kumpul-transaction-status-success';
          });
      }
      page?.querySelectorAll('.kumpul-plan-main .kumpul-detail-fields > div').forEach((row) => {
        const label = row.querySelector('dt')?.textContent;
        if (values.has(label)) row.querySelector('dd').textContent = values.get(label);
      });
      const optionList = page?.querySelector('[data-plan-opened-options]');
      const emptyOptions = page?.querySelector('[data-plan-opened-options-empty]');
      const options = activeOptions();
      if (optionList) {
        optionList.replaceChildren(...options.map((option) => {
          const item = document.createElement('li');
          const heading = document.createElement('div');
          heading.className = 'kumpul-plan-option-heading';
          const copy = document.createElement('div');
          const group = document.createElement('span');
          group.className = 'kumpul-plan-option-group';
          group.textContent = option.group;
          const label = document.createElement('h3');
          label.textContent = option.label;
          copy.append(group, label);
          heading.append(copy);
          if (option.isFinal) {
            const badge = document.createElement('span');
            badge.className = 'kumpul-plan-final-option';
            badge.textContent = 'Opsi final';
            heading.append(badge);
          }
          const description = document.createElement('p');
          description.textContent = [option.location, option.description].filter(Boolean).join(' · ') || 'Detail pilihan belum ditambahkan.';
          item.append(heading, description);
          return item;
        }));
        optionList.hidden = options.length === 0;
      }
      if (emptyOptions) emptyOptions.hidden = options.length > 0;
    };

    const planDateValue = (kind) => {
      const date = simulator.querySelector(`[data-sim-${kind}-date]`)?.value;
      if (!date) return '';
      const time = simulator.querySelector(`[data-sim-${kind}-time]`)?.value || '00:00';
      return `${date}T${time}`;
    };

    const formatSimulationDate = (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 'Belum ditentukan';
      return new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Asia/Jakarta',
      }).format(date);
    };

    const readInvitees = () => Array.from(inviteList?.querySelectorAll('[data-sim-invitee]') || [])
      .map((row) => ({
        name: row.querySelector('[data-sim-invitee-name]')?.value.trim() || '',
        email: row.querySelector('[data-sim-invitee-email]')?.value.trim() || '',
        whatsapp: row.querySelector('[data-sim-invitee-whatsapp]')?.value.trim() || '',
        rsvpStatus: row.dataset.simRsvpStatus === 'ACCEPTED' ? 'ACCEPTED' : 'PENDING',
      }));

    const createInviteeRow = (invitee, index) => {
      const row = document.createElement('li');
      row.dataset.simInvitee = '';
      row.dataset.simRsvpStatus = invitee.rsvpStatus === 'ACCEPTED' ? 'ACCEPTED' : 'PENDING';
      const fields = document.createElement('div');
      const name = document.createElement('input');
      name.type = 'text';
      name.value = invitee.name || '';
      name.setAttribute('aria-label', `Nama calon peserta ${index + 1}`);
      name.dataset.simInviteeName = '';
      const email = document.createElement('input');
      email.type = 'email';
      email.value = invitee.email || '';
      email.setAttribute('aria-label', `Email calon peserta ${index + 1}`);
      email.dataset.simInviteeEmail = '';
      const whatsapp = document.createElement('input');
      whatsapp.type = 'tel';
      whatsapp.value = invitee.whatsapp || '';
      whatsapp.setAttribute('aria-label', `WhatsApp calon peserta ${index + 1}`);
      whatsapp.dataset.simInviteeWhatsapp = '';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Hapus';
      remove.setAttribute('aria-label', `Hapus peserta ${index + 1}`);
      remove.dataset.simRemoveInvite = '';
      fields.append(name, email, whatsapp);
      row.append(fields, remove);
      return row;
    };

    const refreshInvitees = () => {
      if (!inviteList) return;
      invitees = readInvitees();
      inviteList.replaceChildren(...invitees.map(createInviteeRow));
    };

    const renderParticipants = () => {
      if (!participantList) return;
      const confirmed = participants.filter((participant) => participant.status === 'ACCEPTED');
      const heading = document.createElement('h4');
      heading.textContent = `Peserta yang sudah konfirmasi · ${confirmed.length}`;
      const rows = confirmed.map((participant) => {
        const row = document.createElement('article');
        row.className = 'kumpul-plan-sim-person';
        const heading = document.createElement('div');
        heading.className = 'kumpul-plan-sim-person-heading';
        const name = document.createElement('strong');
        name.textContent = participant.name;
        const contact = document.createElement('span');
        contact.textContent = [participant.email, participant.whatsapp].filter(Boolean).join(' · ');
        heading.append(name, contact);
        row.append(heading);
        const status = document.createElement('span');
        status.className = 'kumpul-plan-sim-rsvp-status';
        status.textContent = 'Sudah konfirmasi';
        row.append(status);
        return row;
      });
      if (rows.length === 0) {
        const empty = document.createElement('p');
        empty.textContent = 'Belum ada peserta yang mengonfirmasi hadir.';
        rows.push(empty);
      }
      participantList.replaceChildren(heading, ...rows);
    };

    const renderPublicInvitation = () => {
      if (!publicInvitation) return;
      const isOpen = simulator.querySelector('[data-sim-policy]')?.value !== 'INVITE_ONLY';
      publicInvitation.hidden = !isOpen;
      if (!isOpen || !publicInvitationLink || !publicInvitationQr || !publicInvitationQrStatus) return;
      const path = publicInvitation.dataset.simPublicInvitationUrl;
      const url = new URL(path, window.location.origin).href;
      publicInvitationLink.href = url;
      publicInvitationLink.textContent = url;
      publicInvitationQr.hidden = true;
      publicInvitationQrStatus.hidden = false;
      publicInvitationQrStatus.textContent = 'Menyiapkan QR undangan…';
      void QRCode.toDataURL(url, { width: 220, margin: 1 })
        .then((dataUrl) => {
          publicInvitationQr.src = dataUrl;
          publicInvitationQr.hidden = false;
          publicInvitationQrStatus.hidden = true;
        })
        .catch(() => {
          publicInvitationQrStatus.textContent = 'QR undangan tidak dapat dibuat. Gunakan tautan di samping.';
        });
    };

    const renderPaymentsAndFinalOptions = () => {
      confirmedParticipants = participants.filter((participant) => participant.status === 'ACCEPTED');
      if (paymentList) {
        paymentList.replaceChildren(...confirmedParticipants.map((participant) => {
          const row = document.createElement('article');
          row.className = 'kumpul-plan-sim-person kumpul-plan-sim-payment';
          row.dataset.simPaymentPerson = '';
          row.dataset.simPaid = String(participant.paid === true);
          const info = document.createElement('div');
          info.className = 'kumpul-plan-sim-person-heading';
          const name = document.createElement('strong');
          name.textContent = participant.name;
          const contact = document.createElement('span');
          contact.textContent = [participant.email, participant.whatsapp].filter(Boolean).join(' · ');
          info.append(name, contact);
          const action = document.createElement('button');
          action.type = 'button';
          action.dataset.simTogglePaid = '';
          action.textContent = participant.paid ? 'Lunas · batalkan simulasi' : 'Simulasikan peserta sudah membayar';
          row.append(info, action);
          return row;
        }));
      }
      if (finalOptions) {
        const options = activeOptions();
        const groups = [...new Set(options.map((option) => option.group))];
        finalOptions.replaceChildren(...groups.map((group) => {
          const fieldset = document.createElement('fieldset');
          fieldset.className = 'kumpul-plan-sim-final-group';
          const legend = document.createElement('legend');
          legend.textContent = group;
          fieldset.append(legend);
          options.filter((option) => option.group === group).forEach((option, index) => {
            const votes = participants.filter((participant) =>
              participant.status === 'ACCEPTED' && participant.selections[group] === option.id,
            ).length;
            const label = document.createElement('label');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `final-${group}`;
            radio.value = option.id;
            radio.dataset.simFinalOption = group;
            radio.checked = option.isFinal;
            const text = document.createElement('span');
            text.textContent = `${option.label} · ${votes} suara`;
            label.append(radio, text);
            fieldset.append(label);
          });
          return fieldset;
        }));
      }
    };

    const goToStage = (stage) => {
      if (!stages.includes(stage) || stages.indexOf(stage) > furthestStage) return;
      activeStage = stage;
      clearError(stage);
      renderStage();
    };

    simulator.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;

      if (button.matches('[data-sim-step]')) {
        goToStage(button.dataset.simStep);
      } else if (button.matches('[data-sim-save-plan]')) {
        clearError('PLAN');
        const title = simulator.querySelector('[data-sim-title]')?.value.trim();
        if (!title || title.length < 3) {
          showError('PLAN', 'Nama rencana minimal 3 karakter.');
          return;
        }
        updatePlanSummary();
        if (savedMessage) {
          savedMessage.textContent = 'Perubahan tersimpan sementara di preview.';
          savedMessage.hidden = false;
        }
      } else if (button.matches('[data-sim-submit-plan]')) {
        clearError('PLAN');
        const title = simulator.querySelector('[data-sim-title]')?.value.trim();
        if (!title || title.length < 3) {
          showError('PLAN', 'Nama rencana minimal 3 karakter.');
          return;
        }
        const reservation = planDateValue('rsvp');
        const payment = planDateValue('payment');
        const eventAt = planDateValue('event');
        if (!reservation || !payment || !eventAt) {
          showError('PLAN', 'Lengkapi batas reservasi, batas pembayaran, dan tanggal acara sebelum submit.');
          return;
        }
        const reservationAt = new Date(reservation);
        const paymentAt = new Date(payment);
        const eventDate = new Date(eventAt);
        if ([reservationAt, paymentAt, eventDate].some((date) => Number.isNaN(date.getTime()))
          || reservationAt <= new Date()
          || paymentAt < reservationAt
          || eventDate < paymentAt) {
          showError('PLAN', 'Urutan tanggal harus valid: batas reservasi di masa depan, pembayaran setelah reservasi, dan acara setelah pembayaran.');
          return;
        }
        updatePlanSummary();
        if (savedMessage) savedMessage.hidden = true;
        furthestStage = Math.max(furthestStage, 1);
        activeStage = 'INVITATIONS';
        renderStage();
      } else if (button.matches('[data-sim-add-invite]')) {
        const nameInput = simulator.querySelector('[data-sim-invite-name]');
        const emailInput = simulator.querySelector('[data-sim-invite-email]');
        const whatsappInput = simulator.querySelector('[data-sim-invite-whatsapp]');
        const name = nameInput?.value.trim() || '';
        const email = emailInput?.value.trim() || '';
        const whatsapp = whatsappInput?.value.trim() || '';
        const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const validWhatsapp = /^\+?[0-9]{8,20}$/.test(whatsapp.replace(/[\s().-]/g, ''));
        if (!name || (!validEmail && !validWhatsapp)) {
          showError('INVITATIONS', 'Isi nama dan setidaknya satu kontak email atau WhatsApp yang valid.');
          return;
        }
        invitees = [...readInvitees(), { name, email: validEmail ? email : '', whatsapp: validWhatsapp ? whatsapp : '' }];
        inviteList?.replaceChildren(...invitees.map(createInviteeRow));
        if (nameInput) nameInput.value = '';
        if (emailInput) emailInput.value = '';
        if (whatsappInput) whatsappInput.value = '';
        clearError('INVITATIONS');
      } else if (button.matches('[data-sim-remove-invite]')) {
        const row = button.closest('[data-sim-invitee]');
        row?.remove();
        refreshInvitees();
      } else if (button.matches('[data-sim-send-invites]')) {
        clearError('INVITATIONS');
        invitees = readInvitees();
        if (!invitees.length || invitees.some((invitee) => {
          const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitee.email);
          const validWhatsapp = /^\+?[0-9]{8,20}$/.test(invitee.whatsapp.replace(/[\s().-]/g, ''));
          return !invitee.name || (!validEmail && !validWhatsapp);
        })) {
          showError('INVITATIONS', 'Tambahkan minimal satu peserta dengan nama dan kontak email atau WhatsApp yang valid.');
          return;
        }
        participants = invitees.map((invitee) => ({
          ...invitee,
          status: invitee.rsvpStatus,
          paid: false,
          selections: Object.fromEntries([...new Set(activeOptions().map((option) => option.group))]
            .map((group) => [group, activeOptions().find((option) => option.group === group)?.id])),
        }));
        renderParticipants();
        furthestStage = Math.max(furthestStage, 2);
        activeStage = 'INVITATION_CONFIRMATION';
        renderStage();
      } else if (button.matches('[data-sim-back]')) {
        const index = stages.indexOf(activeStage);
        if (index > 0) goToStage(stages[index - 1]);
      } else if (button.matches('[data-sim-confirm-participants]')) {
        clearError('INVITATION_CONFIRMATION');
        const accepted = participants.filter((participant) => participant.status === 'ACCEPTED');
        const minimum = Number(simulator.dataset.minAttendees) || 0;
        const maximum = Number(simulator.dataset.maxAttendees) || 0;
        if (accepted.length < minimum) {
          showError('INVITATION_CONFIRMATION', `RSVP aktif belum memenuhi minimum ${minimum} peserta.`);
          return;
        }
        if (accepted.length > maximum) {
          showError('INVITATION_CONFIRMATION', `Jumlah peserta melebihi batas maksimum (${maximum}).`);
          return;
        }
        renderPaymentsAndFinalOptions();
        furthestStage = Math.max(furthestStage, 3);
        activeStage = 'PAYMENT_CONFIRMATION';
        renderStage();
      } else if (button.matches('[data-sim-toggle-paid]')) {
        const row = button.closest('[data-sim-payment-person]');
        const index = Array.from(paymentList?.querySelectorAll('[data-sim-payment-person]') || []).indexOf(row);
        if (index < 0 || !confirmedParticipants[index]) return;
        confirmedParticipants[index].paid = !confirmedParticipants[index].paid;
        button.textContent = confirmedParticipants[index].paid ? 'Lunas · batalkan simulasi' : 'Simulasikan peserta sudah membayar';
        row.dataset.simPaid = String(confirmedParticipants[index].paid);
      } else if (button.matches('[data-sim-confirm-event]')) {
        clearError('PAYMENT_CONFIRMATION');
        const unpaid = confirmedParticipants.filter((participant) => !participant.paid);
        const selected = Array.from(finalOptions?.querySelectorAll('[data-sim-final-option]:checked') || []);
        const groups = [...new Set(activeOptions().map((option) => option.group))];
        const paymentDeadline = planDateValue('payment');
        if (paymentDeadline && new Date(paymentDeadline) < new Date()) {
          showError('PAYMENT_CONFIRMATION', 'Batas pembayaran sudah lewat; perpanjang tenggat pada tahap rencana untuk melanjutkan simulasi.');
          return;
        }
        if (unpaid.length) {
          showError('PAYMENT_CONFIRMATION', 'Simulasikan pembayaran seluruh peserta yang RSVP-nya diterima.');
          return;
        }
        if (selected.length !== groups.length) {
          showError('PAYMENT_CONFIRMATION', 'Pilih satu opsi final untuk setiap kelompok pilihan.');
          return;
        }
        completionDetails = true;
        updatePlanSummary();
        renderStage();
      } else if (button.matches('[data-sim-restart]')) {
        window.location.reload();
      }
    });

    simulator.addEventListener('change', (event) => {
      if (event.target.matches('[data-sim-option]')) {
        updatePlanSummary();
      } else if (event.target.matches('[data-sim-policy]')) {
        renderPublicInvitation();
      }
    });
    renderStage();
  });

  document.querySelectorAll('[data-gathering-catalog]').forEach((catalog) => {
    const search = catalog.querySelector('[data-gathering-search]');
    const filters = catalog.querySelector('.kumpul-category-filters');
    const results = catalog.querySelector('[data-gathering-results]');
    const noResults = catalog.querySelector('[data-gathering-no-results]');
    const pagination = catalog.querySelector('[data-gathering-pagination]');
    const previousButton = catalog.querySelector('[data-page-previous]');
    const nextButton = catalog.querySelector('[data-page-next]');
    const pageStatus = catalog.querySelector('[data-page-status]');
    const cards = Array.from(catalog.querySelectorAll('[data-gathering-name]'));
    if (!search || !filters || !results || !noResults || !pagination || !previousButton || !nextButton || !pageStatus || cards.length === 0) return;

    let activeCategory = 'all';
    let currentPage = 0;
    let pageCount = 1;
    const pageSize = 12;
    const categoryButtons = Array.from(filters.querySelectorAll('[data-category-filter]'));
    search.closest('label').hidden = false;
    filters.hidden = false;
    results.hidden = false;

    const updateResults = () => {
      const query = search.value.trim().toLocaleLowerCase('id-ID');
      const matchingCards = cards.filter((card) => {
        const matchesQuery = card.dataset.gatheringName.includes(query);
        const matchesCategory = activeCategory === 'all' || card.dataset.gatheringCategory === activeCategory;
        return matchesQuery && matchesCategory;
      });
      pageCount = Math.ceil(matchingCards.length / pageSize);
      currentPage = Math.min(currentPage, Math.max(pageCount - 1, 0));
      const start = currentPage * pageSize;
      const end = Math.min(start + pageSize, matchingCards.length);
      const visibleCards = new Set(matchingCards.slice(start, end));
      cards.forEach((card) => {
        card.hidden = !visibleCards.has(card);
      });

      results.textContent = matchingCards.length
        ? `Menampilkan ${start + 1}–${end} dari ${matchingCards.length} gathering`
        : `0 dari ${cards.length} gathering`;
      noResults.hidden = matchingCards.length > 0;
      pagination.hidden = pageCount <= 1;
      pageStatus.textContent = `Halaman ${currentPage + 1} dari ${Math.max(pageCount, 1)}`;
      previousButton.disabled = currentPage === 0;
      nextButton.disabled = currentPage >= pageCount - 1;
    };

    search.addEventListener('input', () => {
      currentPage = 0;
      updateResults();
    });
    categoryButtons.forEach((button) => {
      button.addEventListener('click', () => {
        activeCategory = button.dataset.categoryFilter;
        currentPage = 0;
        categoryButtons.forEach((item) => {
          item.setAttribute('aria-pressed', String(item === button));
        });
        updateResults();
      });
    });
    previousButton.addEventListener('click', () => {
      if (currentPage === 0) return;
      currentPage -= 1;
      updateResults();
    });
    nextButton.addEventListener('click', () => {
      if (currentPage >= pageCount - 1) return;
      currentPage += 1;
      updateResults();
    });
    updateResults();
  });
})();
