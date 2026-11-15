import { Editor } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Italic from '@tiptap/extension-italic';
import Link from '@tiptap/extension-link';
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Underline from '@tiptap/extension-underline';
import { Placeholder, UndoRedo } from '@tiptap/extensions';
import QRCode from 'qrcode';

(() => {
  // Kontrak Bagdja D8: listener `document` (delegasi) dipasang SEKALI; inisialisasi elemen berjalan per root
  // lewat mount(root) — shell & setiap isi baru di render langsung, atau seluruh dokumen di iframe/SSR.
  const mountSteps = [];
  const onMount = (step) => { mountSteps.push(step); };

  onMount((root) => {
    const header = root.querySelector('.kumpul-header');
    if (!header) return undefined;
    const updateHeaderHeight = () => {
      document.documentElement.style.setProperty('--kumpul-header-height', `${header.getBoundingClientRect().height}px`);
    };
    updateHeaderHeight();
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(updateHeaderHeight);
      observer.observe(header);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  });

  onMount((root) => root.querySelectorAll('input[data-bagdja-field="invitation.banner"]').forEach((input) => {
    const field = input.closest('.kumpul-invite-banner-field');
    const preview = field?.querySelector('[data-invitation-banner-preview]');
    const empty = field?.querySelector('[data-invitation-banner-empty]');
    const error = field?.querySelector('[data-invitation-banner-error]');
    const removeBanner = field?.querySelector('input[data-bagdja-field="invitation.removeBanner"]');
    if (!(preview instanceof HTMLImageElement) || !(empty instanceof HTMLElement)) return;
    const savedSrc = preview.getAttribute('src');
    let objectUrl = '';

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (error) {
        error.hidden = true;
        error.textContent = '';
      }
      if (file && (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
        if (error) {
          error.textContent = file.size > 5 * 1024 * 1024
            ? 'Ukuran banner maksimal 5 MB.'
            : 'Pilih gambar JPG, PNG, WebP, atau GIF.';
          error.hidden = false;
        }
        input.value = '';
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = file && input.files?.[0] ? URL.createObjectURL(file) : '';
      const src = objectUrl || savedSrc;
      if (src) preview.src = src;
      else preview.removeAttribute('src');
      preview.hidden = !src;
      empty.hidden = Boolean(src);
      if (objectUrl && removeBanner instanceof HTMLInputElement) removeBanner.checked = false;
    });
  }));

  // Rencana gathering live: tahap yang sudah dilewati bisa dibuka (ringkasan baca saja).
  onMount((root) => root.querySelectorAll('[data-plan-live]').forEach((workflow) => {
    const tabs = Array.from(workflow.querySelectorAll('[data-plan-step-tab]'));
    const panels = Array.from(workflow.querySelectorAll('[data-plan-step-panel]'));
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        if (tab.disabled) return;
        const step = tab.dataset.planStepTab;
        tabs.forEach((item) => item.setAttribute('aria-pressed', String(item === tab)));
        panels.forEach((panel) => { panel.hidden = panel.dataset.planStepPanel !== step; });
      });
    });
  }));

  // Tombol "Tolak" yang menunggu konfirmasi popup alasan (dipakai handler klik global di bawah).
  let pendingRejectButton = null;

  const updateRejectReason = (rejectDialog) => {
    if (!rejectDialog) return;
    const reasonOptions = Array.from(rejectDialog.querySelectorAll('[data-kumpul-reservation-reason-option]'));
    const customReason = rejectDialog.querySelector('[data-kumpul-reservation-custom-reason]');
    const rejectConfirm = rejectDialog.querySelector('[data-kumpul-reservation-confirm-submit]');
    const selected = reasonOptions.find((option) => option.checked);
    const isCustomReason = selected?.value === 'custom';
    if (customReason) {
      customReason.hidden = !isCustomReason;
      customReason.required = Boolean(isCustomReason);
    }
    if (rejectConfirm) {
      rejectConfirm.disabled = !selected || (isCustomReason && !customReason?.value.trim());
    }
  };

  onMount((root) => root.querySelectorAll('[data-kumpul-reservation-confirm-dialog]').forEach((rejectDialog) => {
    rejectDialog.querySelectorAll('[data-kumpul-reservation-reason-option]').forEach((option) => {
      option.addEventListener('change', () => updateRejectReason(rejectDialog));
    });
    rejectDialog.querySelector('[data-kumpul-reservation-custom-reason]')
      ?.addEventListener('input', () => updateRejectReason(rejectDialog));
    rejectDialog.addEventListener('close', () => { pendingRejectButton = null; });
  }));

  onMount((root) => root.querySelectorAll('[data-kumpul-reservation-dialog]').forEach((dialog) => {
    const filters = Array.from(dialog.querySelectorAll('[data-kumpul-reservation-filter]'));
    const items = Array.from(dialog.querySelectorAll('[data-kumpul-reservation-item]'));
    const filterEmpty = dialog.querySelector('[data-kumpul-reservation-filter-empty]');

    filters.forEach((filter) => {
      filter.addEventListener('click', () => {
        const status = filter.dataset.kumpulReservationFilter;
        const matches = items.filter((item) => item.dataset.kumpulReservationGroup === status);
        filters.forEach((item) => item.setAttribute('aria-pressed', String(item === filter)));
        items.forEach((item) => {
          item.hidden = !matches.includes(item);
        });
        if (filterEmpty) filterEmpty.hidden = matches.length > 0;
      });
    });
  }));

  // Editor ringan teks undangan (Tiptap): menulis HTML ke textarea `invitation.description`
  // yang dikirim bootstrap Bagdja; API menyanitasi profil `basic` (p, br, strong, em, u, s, ul, ol, li, a).
  onMount((root) => root.querySelectorAll('[data-kumpul-rich-editor]').forEach((field) => {
    const source = field.querySelector('[data-rich-source]');
    const box = field.querySelector('[data-rich-box]');
    const mount = field.querySelector('[data-rich-content]');
    if (!(source instanceof HTMLTextAreaElement) || !box || !mount || source.disabled) return;
    let editor;
    try {
      editor = new Editor({
        element: mount,
        content: source.value,
        // Hanya ekstensi yang sesuai profil sanitasi `basic` (menjaga ukuran bundle client).
        extensions: [
          Document, Paragraph, Text, HardBreak, Bold, Italic, Underline,
          BulletList, OrderedList, ListItem, UndoRedo,
          Link.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
          Placeholder.configure({ placeholder: source.getAttribute('placeholder') || '' }),
        ],
        editorProps: { attributes: { 'aria-label': 'Teks undangan', role: 'textbox', 'aria-multiline': 'true' } },
        onUpdate: ({ editor: current }) => {
          source.value = current.isEmpty ? '' : current.getHTML();
        },
      });
    } catch {
      return; // Tetap memakai textarea biasa.
    }
    box.hidden = false;
    field.classList.add('is-ready');
    const buttons = Array.from(field.querySelectorAll('[data-rich-cmd]'));
    const syncToolbar = () => {
      buttons.forEach((button) => {
        const command = button.getAttribute('data-rich-cmd');
        const active = ['bold', 'italic', 'underline', 'bulletList', 'orderedList', 'link'].includes(command) && editor.isActive(command);
        button.setAttribute('aria-pressed', String(active));
      });
    };
    editor.on('selectionUpdate', syncToolbar);
    editor.on('transaction', syncToolbar);
    buttons.forEach((button) => {
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', () => {
        const chain = editor.chain().focus();
        switch (button.getAttribute('data-rich-cmd')) {
          case 'bold': chain.toggleBold().run(); break;
          case 'italic': chain.toggleItalic().run(); break;
          case 'underline': chain.toggleUnderline().run(); break;
          case 'bulletList': chain.toggleBulletList().run(); break;
          case 'orderedList': chain.toggleOrderedList().run(); break;
          case 'clear': chain.clearNodes().unsetAllMarks().run(); break;
          case 'link': {
            const previous = editor.getAttributes('link').href || 'https://';
            const url = window.prompt('Alamat tautan (https://…)', previous);
            if (url === null) break;
            if (!url.trim()) { chain.extendMarkRange('link').unsetLink().run(); break; }
            if (!/^https?:\/\//i.test(url.trim())) break;
            chain.extendMarkRange('link').setLink({ href: url.trim() }).run();
            break;
          }
          default: break;
        }
      });
    });
    syncToolbar();
  }));

  // Pemilih tanggal & jam untuk HP (bottom sheet) — menulis ke input datetime-local asli
  // (`data-bagdja-field`), sehingga intent ke host tidak berubah. Web tetap memakai input bawaan.
  const pad2 = (value) => String(value).padStart(2, '0');
  const formatDateTimeLabel = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || '');
    if (!match) return '';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const day = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
    return `${day} · ${match[4]}.${match[5]} WIB`;
  };
  const syncDateTimeTrigger = (trigger) => {
    const input = trigger.closest('.kumpul-datetime')?.querySelector('[data-kumpul-datetime-input]');
    const textNode = trigger.querySelector('[data-kumpul-datetime-text]');
    if (!(input instanceof HTMLInputElement) || !textNode) return;
    const label = formatDateTimeLabel(input.value);
    textNode.textContent = label || 'Pilih tanggal & jam';
    trigger.toggleAttribute('data-empty', !label);
  };
  onMount((root) => { root.querySelectorAll('[data-kumpul-datetime-trigger]').forEach(syncDateTimeTrigger); });

  let dateTimeSheet = null;
  const openDateTimeSheet = (trigger) => {
    const input = trigger.closest('.kumpul-datetime')?.querySelector('[data-kumpul-datetime-input]');
    if (!(input instanceof HTMLInputElement) || input.disabled) return;
    if (!dateTimeSheet) {
      dateTimeSheet = document.createElement('dialog');
      dateTimeSheet.className = 'kumpul-dt-sheet';
      // Di dalam .kumpul-template agar variabel tema (--kt-*) & gaya dasar berlaku.
      (document.querySelector('.kumpul-template') || document.body).append(dateTimeSheet);
    }
    const sheet = dateTimeSheet;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(input.value || '');
    const fallback = new Date(today.getTime() + 86400000);
    const state = match
      ? { year: +match[1], month: +match[2] - 1, day: +match[3], hour: +match[4], minute: +match[5] }
      : { year: fallback.getFullYear(), month: fallback.getMonth(), day: null, hour: 9, minute: 0 };
    const view = { year: state.year, month: state.month };
    const minutes = [0, 15, 30, 45].includes(state.minute) ? [0, 15, 30, 45] : [0, 15, 30, 45, state.minute].sort((a, b) => a - b);
    const label = trigger.getAttribute('data-label') || 'Tanggal';

    const render = () => {
      const first = new Date(view.year, view.month, 1);
      const offset = (first.getDay() + 6) % 7; // Senin = kolom pertama
      const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
      const atCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth();
      const monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(first);
      const cells = [];
      for (let i = 0; i < offset; i += 1) cells.push('<span></span>');
      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(view.year, view.month, day);
        const selected = state.day === day && state.month === view.month && state.year === view.year;
        cells.push(`<button type="button" data-dt-day="${day}"${date < today ? ' disabled' : ''}${date.getTime() === today.getTime() ? ' data-today' : ''} aria-pressed="${selected}">${day}</button>`);
      }
      const summary = state.day
        ? formatDateTimeLabel(`${state.year}-${pad2(state.month + 1)}-${pad2(state.day)}T${pad2(state.hour)}:${pad2(state.minute)}`)
        : 'Pilih tanggal dulu';
      sheet.innerHTML = `<div class="kumpul-dt-head"><div><strong></strong><span>Waktu Indonesia Barat</span></div><button type="button" class="kumpul-dt-close" data-dt-cancel aria-label="Tutup">×</button></div>`
        + `<div class="kumpul-dt-body">`
        + `<div><div class="kumpul-dt-month"><button type="button" data-dt-month="-1" aria-label="Bulan sebelumnya"${atCurrentMonth ? ' disabled' : ''}>‹</button><strong>${monthLabel}</strong><button type="button" data-dt-month="1" aria-label="Bulan berikutnya">›</button></div>`
        + `<div class="kumpul-dt-grid">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((name) => `<span>${name}</span>`).join('')}${cells.join('')}</div></div>`
        + `<div><div class="kumpul-dt-label">Jam</div><div class="kumpul-dt-hours">${Array.from({ length: 24 }, (_, hour) => `<button type="button" data-dt-hour="${hour}" aria-pressed="${state.hour === hour}">${pad2(hour)}</button>`).join('')}</div></div>`
        + `<div><div class="kumpul-dt-label">Menit</div><div class="kumpul-dt-minutes">${minutes.map((minute) => `<button type="button" data-dt-minute="${minute}" aria-pressed="${state.minute === minute}">${pad2(minute)}</button>`).join('')}</div></div>`
        + `<div class="kumpul-dt-summary">${summary}</div>`
        + `</div><div class="kumpul-dt-foot"><button type="button" data-dt-clear>Kosongkan</button><button type="button" class="kumpul-dt-save" data-dt-save${state.day ? '' : ' disabled'}>Simpan</button></div>`;
      sheet.querySelector('.kumpul-dt-head strong').textContent = label;
      sheet.querySelector('[data-dt-hour][aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    };

    const commit = (value) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      syncDateTimeTrigger(trigger);
      sheet.close();
    };

    sheet.onclick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (target === sheet || target.closest('[data-dt-cancel]')) { sheet.close(); return; }
      const month = target.closest('[data-dt-month]');
      if (month) {
        const next = new Date(view.year, view.month + Number(month.getAttribute('data-dt-month')), 1);
        view.year = next.getFullYear();
        view.month = next.getMonth();
        render();
        return;
      }
      const day = target.closest('[data-dt-day]');
      if (day && !day.disabled) {
        state.year = view.year;
        state.month = view.month;
        state.day = Number(day.getAttribute('data-dt-day'));
        render();
        return;
      }
      const hour = target.closest('[data-dt-hour]');
      if (hour) { state.hour = Number(hour.getAttribute('data-dt-hour')); render(); return; }
      const minute = target.closest('[data-dt-minute]');
      if (minute) { state.minute = Number(minute.getAttribute('data-dt-minute')); render(); return; }
      if (target.closest('[data-dt-clear]')) { commit(''); return; }
      if (target.closest('[data-dt-save]') && state.day) {
        commit(`${state.year}-${pad2(state.month + 1)}-${pad2(state.day)}T${pad2(state.hour)}:${pad2(state.minute)}`);
      }
    };
    render();
    if (!sheet.open) sheet.showModal();
  };
  document.addEventListener('click', (event) => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-kumpul-datetime-trigger]') : null;
    if (!trigger) return;
    event.preventDefault();
    openDateTimeSheet(trigger);
  });

  // Carousel gambar di popup opsi: panah menggeser satu slide, titik mengikuti posisi geser.
  onMount((root) => root.querySelectorAll('[data-option-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('[data-option-carousel-track]');
    const dots = Array.from(carousel.querySelectorAll('[data-option-carousel-dot]'));
    if (!track) return;
    const current = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const go = (index) => track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    carousel.querySelector('[data-option-carousel-prev]')?.addEventListener('click', () => go(Math.max(0, current() - 1)));
    carousel.querySelector('[data-option-carousel-next]')?.addEventListener('click', () => go(Math.min(dots.length - 1, current() + 1)));
    track.addEventListener('scroll', () => {
      const active = current();
      dots.forEach((dot, index) => dot.toggleAttribute('data-active', index === active));
    }, { passive: true });
  }));

  // Image viewer fullscreen: <dialog> modal sendiri agar tampil di atas popup opsi (top layer).
  let imageViewer = null;
  // `captions` (opsional) sejajar dengan `urls`: keterangan foto tampil di bawah viewer.
  const openImageViewer = (urls, startIndex, captions = []) => {
    if (!urls.length) return;
    if (!imageViewer) {
      imageViewer = document.createElement('dialog');
      imageViewer.className = 'kumpul-image-viewer';
      imageViewer.setAttribute('aria-label', 'Pratinjau gambar');
      imageViewer.innerHTML = '<div class="kumpul-image-viewer-stage" data-viewer-stage><img alt="" data-viewer-image></div>'
        + '<button type="button" class="kumpul-image-viewer-close" data-viewer-close aria-label="Tutup pratinjau">×</button>'
        + '<button type="button" class="kumpul-image-viewer-nav is-prev" data-viewer-prev aria-label="Gambar sebelumnya">‹</button>'
        + '<button type="button" class="kumpul-image-viewer-nav is-next" data-viewer-next aria-label="Gambar berikutnya">›</button>'
        + '<p class="kumpul-image-viewer-caption" data-viewer-caption hidden></p>'
        + '<span class="kumpul-image-viewer-count" data-viewer-count></span>';
      (document.querySelector('.kumpul-template') || document.body).append(imageViewer);
      const state = { urls: [], captions: [], index: 0, touchX: null };
      imageViewer.kumpulState = state;
      const show = (index) => {
        state.index = (index + state.urls.length) % state.urls.length;
        imageViewer.querySelector('[data-viewer-image]').src = state.urls[state.index];
        imageViewer.querySelector('[data-viewer-count]').textContent = `${state.index + 1} / ${state.urls.length}`;
        const caption = String(state.captions[state.index] || '').trim();
        const captionElement = imageViewer.querySelector('[data-viewer-caption]');
        captionElement.textContent = caption;
        captionElement.hidden = !caption;
        imageViewer.classList.toggle('has-caption', Boolean(caption));
        imageViewer.querySelector('[data-viewer-image]').alt = caption;
        const many = state.urls.length > 1;
        imageViewer.querySelector('[data-viewer-prev]').hidden = !many;
        imageViewer.querySelector('[data-viewer-next]').hidden = !many;
        imageViewer.querySelector('[data-viewer-count]').hidden = !many;
      };
      imageViewer.kumpulShow = show;
      imageViewer.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('[data-viewer-close]')) imageViewer.close();
        else if (target?.closest('[data-viewer-prev]')) show(state.index - 1);
        else if (target?.closest('[data-viewer-next]')) show(state.index + 1);
        // Area kosong di sekitar gambar = latar → tutup.
        else if (target?.matches('[data-viewer-stage], dialog')) imageViewer.close();
      });
      imageViewer.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') show(state.index - 1);
        if (event.key === 'ArrowRight') show(state.index + 1);
      });
      imageViewer.addEventListener('touchstart', (event) => { state.touchX = event.touches[0].clientX; }, { passive: true });
      imageViewer.addEventListener('touchend', (event) => {
        if (state.touchX === null) return;
        const delta = event.changedTouches[0].clientX - state.touchX;
        state.touchX = null;
        if (Math.abs(delta) > 40 && state.urls.length > 1) show(state.index + (delta < 0 ? 1 : -1));
      });
    }
    imageViewer.kumpulState.urls = urls;
    imageViewer.kumpulState.captions = captions;
    imageViewer.kumpulShow(startIndex);
    if (!imageViewer.open) imageViewer.showModal();
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const slide = target?.closest('[data-option-image-open]');
    if (!slide) return;
    const carousel = slide.closest('[data-option-carousel]');
    const urls = Array.from(carousel?.querySelectorAll('[data-option-image-open] img') || [])
      .map((image) => image.getAttribute('src'))
      .filter(Boolean);
    openImageViewer(urls, Number(slide.getAttribute('data-option-image-open')) || 0);
  });

  // Galeri foto (section Galeri): buka viewer layar penuh beserta keterangan tiap foto.
  const openGalleryImage = (tile) => {
    const tiles = Array.from(tile.closest('[data-gallery]')?.querySelectorAll('[data-gallery-image-open]') || [tile]);
    openImageViewer(
      tiles.map((item) => item.getAttribute('data-gallery-url') || ''),
      Math.max(0, tiles.indexOf(tile)),
      tiles.map((item) => item.getAttribute('data-gallery-caption') || ''),
    );
  };
  document.addEventListener('click', (event) => {
    const tile = event.target instanceof Element ? event.target.closest('[data-gallery-image-open]') : null;
    if (tile) openGalleryImage(tile);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const tile = event.target instanceof Element ? event.target.closest('[data-gallery-image-open]') : null;
    if (!tile) return;
    event.preventDefault();
    openGalleryImage(tile);
  });

  // Loading pada tombol yang terlihat bila intent dijalankan lewat tombol tersembunyi
  // (popup konfirmasi kirim undangan, tolak reservasi): cerminkan aria-busy dari bootstrap Bagdja.
  const busyProxies = (element) => {
    if (element.matches('[data-kumpul-submit-invitation-intent]')) {
      return Array.from((element.closest('[data-bagdja-scope]') || document).querySelectorAll('[data-kumpul-invitation-confirm-open]'));
    }
    if (element.matches('[data-kumpul-reservation-reject-submit]')) {
      return Array.from(element.closest('[data-kumpul-reservation-item]')?.querySelectorAll('[data-kumpul-reservation-reject-open]') || []);
    }
    return [];
  };
  if (typeof MutationObserver === 'function') {
    new MutationObserver((records) => {
      records.forEach((record) => {
        const element = record.target;
        if (!(element instanceof Element)) return;
        const busy = element.getAttribute('aria-busy') === 'true';
        busyProxies(element).forEach((proxy) => {
          if (busy) proxy.setAttribute('aria-busy', 'true');
          else proxy.removeAttribute('aria-busy');
        });
      });
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-busy'] });
  }

  // Modal Konfirmasi acara: ringkas opsi final yang tercentang (per kategori) di scope tahap.
  const fillFinalSummary = (sheet, opener) => {
    const summary = sheet.querySelector('[data-kumpul-final-summary]');
    if (!summary) return;
    const scope = opener.closest('[data-bagdja-scope]') || document;
    const groups = Array.from(scope.querySelectorAll('[data-plan-final-options] .kumpul-invite-vote-group'));
    if (!groups.length) return;
    summary.replaceChildren(...groups.map((group) => {
      const item = document.createElement('li');
      const category = group.querySelector('h4')?.textContent?.trim() || 'Pilihan';
      const checked = group.querySelector('input[type="radio"]:checked');
      const name = checked?.closest('label')?.querySelector('.kumpul-plan-option-name')?.textContent?.trim();
      item.textContent = `${category}: ${name || 'belum dipilih'}`;
      if (!name) item.setAttribute('data-missing', '');
      return item;
    }));
  };

  // Sheet halaman undangan (kode OTP, tambah peserta): HP = bottom sheet, web = modal.
  const inviteSheet = (name) => document.querySelector(`[data-kumpul-invite-sheet="${name}"]`);
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const opener = target?.closest('[data-kumpul-sheet-open]');
    if (opener) {
      const sheet = inviteSheet(opener.getAttribute('data-kumpul-sheet-open'));
      if (sheet instanceof HTMLDialogElement) fillFinalSummary(sheet, opener);
      if (sheet instanceof HTMLDialogElement && !sheet.open) {
        sheet.showModal();
        sheet.querySelector('input[data-bagdja-field="otp.code"]')?.focus();
      }
      return;
    }
    if (target?.closest('[data-kumpul-sheet-close]')) {
      target.closest('dialog')?.close();
      return;
    }
    // Tutup hanya bila tap di luar kotak dialog (backdrop), bukan di padding dalam dialog.
    if (target?.matches('[data-kumpul-invite-sheet]')) {
      const box = target.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) target.close();
    }
  });
  // Setelah reservasi dikirim (status menunggu OTP), sheet kode langsung terbuka di HP.
  onMount((root) => {
    const autoSheet = root.querySelector('[data-kumpul-invite-sheet][data-auto-open-mobile]');
    if (autoSheet instanceof HTMLDialogElement && window.matchMedia('(max-width: 760px)').matches) {
      autoSheet.showModal();
    }
  });

  // Popup detail pilihan rencana (kartu kategori opsi).
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const openOption = target?.closest('[data-plan-option-open]');
    if (openOption) {
      // Tombol ⓘ di dalam <label> pemilih opsi: jangan ikut mencentang/melepas.
      event.preventDefault();
      const dialog = document.getElementById(openOption.getAttribute('data-plan-option-open') || '');
      if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
      return;
    }
    if (target?.closest('[data-plan-option-close]')) {
      target.closest('dialog')?.close();
      return;
    }
    if (target?.matches('[data-plan-option-dialog]')) target.close();
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const rejectOpen = target?.closest('[data-kumpul-reservation-reject-open]');
    if (rejectOpen) {
      const scope = rejectOpen.closest('[data-plan-live]');
      const rejectDialog = scope?.querySelector('[data-kumpul-reservation-confirm-dialog]');
      const item = rejectOpen.closest('[data-kumpul-reservation-item]');
      if (!(rejectDialog instanceof HTMLDialogElement) || !item) return;
      pendingRejectButton = item.querySelector('[data-kumpul-reservation-reject-submit]');
      const name = item.querySelector('.kumpul-plan-sim-person-heading strong')?.textContent?.trim() || 'peserta';
      const confirmName = rejectDialog.querySelector('[data-kumpul-reservation-confirm-name]');
      if (confirmName) confirmName.textContent = name;
      rejectDialog.querySelectorAll('[data-kumpul-reservation-reason-option]').forEach((option) => {
        option.checked = false;
      });
      const customReason = rejectDialog.querySelector('[data-kumpul-reservation-custom-reason]');
      if (customReason instanceof HTMLTextAreaElement) customReason.value = '';
      updateRejectReason(rejectDialog);
      if (!rejectDialog.open) rejectDialog.showModal();
      return;
    }

    const rejectCancel = target?.closest('[data-kumpul-reservation-confirm-cancel]');
    if (rejectCancel) {
      rejectCancel.closest('dialog')?.close();
      pendingRejectButton = null;
      return;
    }

    const rejectSubmit = target?.closest('[data-kumpul-reservation-confirm-submit]');
    if (rejectSubmit) {
      if (!(pendingRejectButton instanceof HTMLButtonElement)) return;
      const rejectDialog = rejectSubmit.closest('[data-kumpul-reservation-confirm-dialog]');
      const selected = rejectDialog?.querySelector('[data-kumpul-reservation-reason-option]:checked');
      const customReason = rejectDialog?.querySelector('[data-kumpul-reservation-custom-reason]');
      const reason = selected?.value === 'custom'
        ? customReason?.value.trim()
        : selected?.value;
      if (!reason) return;
      const row = pendingRejectButton.closest('[data-kumpul-reservation-item]');
      const message = row?.querySelector('[data-kumpul-reservation-message]');
      const checkbox = row?.querySelector('[data-bagdja-selectable]');
      if (!(message instanceof HTMLInputElement) || !(checkbox instanceof HTMLInputElement)) return;
      message.value = reason;
      checkbox.checked = true;
      // Klik dulu sebelum close(): event 'close' mengosongkan pendingRejectButton.
      pendingRejectButton.click();
      rejectDialog.close();
      pendingRejectButton = null;
      return;
    }

    const open = target?.closest('[data-kumpul-reservation-open]');
    if (open) {
      // aria-controls menunjuk dialognya (reservasi / pembayaran); fallback dialog pertama di scope.
      const controlled = open.getAttribute('aria-controls');
      const scope = open.closest('[data-bagdja-scope]') || document;
      const dialog = (controlled && document.getElementById(controlled)) || scope.querySelector('[data-kumpul-reservation-dialog]');
      if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
      return;
    }

    const close = target?.closest('[data-kumpul-reservation-close]');
    if (close) {
      close.closest('dialog')?.close();
      return;
    }

    if (target?.matches('[data-kumpul-reservation-dialog]')) target.close();
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target instanceof Element
      ? event.target.closest('[data-kumpul-invitation-confirm-open]')
      : null;
    if (!trigger) return;
    const scope = trigger.closest('[data-bagdja-scope]') || document;
    const dialog = scope.querySelector('[data-kumpul-invitation-confirm-dialog]');
    if (!(dialog instanceof HTMLDialogElement)) return;
    event.preventDefault();
    if (!dialog.open) dialog.showModal();
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const cancel = target?.closest('[data-kumpul-invitation-confirm-cancel]');
    if (cancel) {
      cancel.closest('dialog')?.close();
      return;
    }

    const confirm = target?.closest('[data-kumpul-invitation-confirm-submit]');
    if (!confirm) return;
    const dialog = confirm.closest('dialog');
    const scope = dialog?.closest('[data-bagdja-scope]') || document;
    const submit = scope.querySelector('[data-kumpul-submit-invitation-intent]');
    if (!(submit instanceof HTMLButtonElement) || submit.disabled) return;
    dialog.close();
    submit.click();
  });

  // Simulator preview: banner undangan hanya dipratinjau lokal (tidak diunggah).
  onMount((root) => root.querySelectorAll('[data-sim-appearance]').forEach((appearance) => {
    const input = appearance.querySelector('[data-sim-banner]');
    const preview = appearance.querySelector('[data-sim-banner-preview]');
    const empty = appearance.querySelector('[data-sim-banner-empty]');
    const description = appearance.querySelector('[data-sim-invitation-description]');
    const error = appearance.querySelector('[data-sim-banner-error]');
    const saved = appearance.querySelector('[data-sim-invitation-saved]');
    const saveButton = appearance.querySelector('[data-sim-save-invitation]');
    let objectUrl = '';
    input?.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (error) {
        error.hidden = true;
        error.textContent = '';
      }
      if (saved) saved.hidden = true;
      if (file && (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
        if (error) {
          error.textContent = file.size > 5 * 1024 * 1024
            ? 'Ukuran banner maksimal 5 MB.'
            : 'Pilih gambar JPG, PNG, WebP, atau GIF.';
          error.hidden = false;
        }
        input.value = '';
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = '';
        if (preview) {
          preview.hidden = true;
          preview.removeAttribute('src');
        }
        if (empty) empty.hidden = false;
        return;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = file ? URL.createObjectURL(file) : '';
      if (preview) {
        preview.hidden = !objectUrl;
        if (objectUrl) preview.src = objectUrl;
        else preview.removeAttribute('src');
      }
      if (empty) empty.hidden = Boolean(objectUrl);
    });
    description?.addEventListener('input', () => {
      if (saved) saved.hidden = true;
    });
    saveButton?.addEventListener('click', () => {
      if (error) error.hidden = true;
      if (saved) {
        saved.textContent = 'Tampilan undangan tersimpan di preview ini saja.';
        saved.hidden = false;
      }
    });
  }));

  // Bottom sheet HP (checkbox + label): tutup dengan Escape dan kunci scroll halaman saat terbuka.
  // Toggle dicari ulang setiap kali (isi halaman bisa berganti tanpa muat ulang dokumen).
  const sheetToggles = () => Array.from(document.querySelectorAll('.kumpul-sheet-toggle'));
  const syncSheetLock = () => {
    document.documentElement.classList.toggle('kumpul-sheet-open', sheetToggles().some((toggle) => toggle.checked));
  };
  onMount((root) => {
    root.querySelectorAll('.kumpul-sheet-toggle').forEach((toggle) => toggle.addEventListener('change', () => {
      if (toggle.checked) sheetToggles().forEach((other) => { if (other !== toggle) other.checked = false; });
      syncSheetLock();
    }));
    // Popup batal: fokus ke kolom alasan saat dibuka.
    root.querySelectorAll('.kumpul-sheet-toggle.kumpul-modal-toggle').forEach((toggle) => {
      toggle.addEventListener('change', () => {
        if (toggle.checked) toggle.parentElement?.querySelector('.kumpul-modal input[data-bagdja-field]')?.focus();
      });
    });
    return () => syncSheetLock();
  });
  // Label pembuka sheet/popup (role="button") bisa dipicu keyboard.
  document.addEventListener('keydown', (event) => {
    const label = event.target instanceof Element ? event.target.closest('label[role="button"][for]') : null;
    if (!label || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    label.click();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !sheetToggles().some((toggle) => toggle.checked)) return;
    sheetToggles().forEach((toggle) => { toggle.checked = false; });
    syncSheetLock();
  });

  onMount((root) => root.querySelectorAll('[data-calendar-page]').forEach((calendar) => {
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
      calendar: 'Lihat jadwal gathering, rencana, undangan, dan jasa Anda dalam satu kalender.',
      plans: 'Kelola rencana, peserta, voting, dan pembayaran seat acara yang Anda buat.',
      invitations: 'Acara yang mengundang Anda. Buka undangan untuk menjawab RSVP, membayar seat, dan melihat tiket masuk.',
      services: 'Pantau pesanan jasa Anda dari perencanaan, pembayaran, hingga selesai.',
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

    // Filter tahap jasa (tab Jadwal Jasa) — terpisah dari filter rencana.
    const serviceFilters = Array.from(calendar.querySelectorAll('[data-service-filter]'));
    const serviceCards = Array.from(calendar.querySelectorAll('[data-service-card]'));
    const serviceFilterEmpty = calendar.querySelector('[data-service-filter-empty]');
    serviceFilters.forEach((filter) => {
      filter.addEventListener('click', () => {
        serviceFilters.forEach((item) => item.setAttribute('aria-pressed', String(item === filter)));
        const status = filter.dataset.serviceFilter;
        let visible = 0;
        serviceCards.forEach((card) => {
          card.hidden = !(status === 'all' || card.dataset.calendarServiceStatus === status);
          if (!card.hidden) visible += 1;
        });
        if (serviceFilterEmpty) serviceFilterEmpty.hidden = visible > 0;
      });
    });
  }));

  onMount((root) => root.querySelectorAll('[data-billing-page]').forEach((billing) => {
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
  }));

  onMount((root) => root.querySelectorAll('[data-transactions-page]').forEach((transactions) => {
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
  }));

  onMount((root) => root.querySelectorAll('[data-cart-page]').forEach((cart) => {
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
  }));

  onMount((root) => root.querySelectorAll('[data-plan-simulator]').forEach((simulator) => {
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
        // Semua opsi sudah dirender server per kategori; cukup tampilkan yang aktif.
        const activeIds = new Set(options.map((option) => option.id));
        optionList.querySelectorAll('[data-plan-option-id]').forEach((row) => {
          row.hidden = !activeIds.has(row.dataset.planOptionId);
        });
        optionList.querySelectorAll('[data-plan-option-group]').forEach((card) => {
          card.hidden = !card.querySelector('[data-plan-option-id]:not([hidden])');
        });
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
  }));

  onMount((root) => root.querySelectorAll('[data-gathering-catalog]').forEach((catalog) => {
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
  }));

  // Muat ulang (data-bagdja-refresh): host mengganti dokumen iframe bila data berubah. window.name
  // bertahan antar-dokumen di iframe yang sama, jadi dialog reservasi & tab filternya dipulihkan.
  const RESTORE_PREFIX = 'kumpul-restore:';
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-bagdja-refresh]') : null;
    if (!button || button.disabled) return;
    const dialog = document.querySelector('[data-kumpul-reservation-dialog][open]');
    const filter = dialog?.querySelector('[data-kumpul-reservation-filter][aria-pressed="true"]');
    try {
      window.name = `${RESTORE_PREFIX}${JSON.stringify({
        dialog: dialog?.id || '',
        filter: filter?.getAttribute('data-kumpul-reservation-filter') || '',
      })}`;
    } catch {
      // window.name tidak tersedia → cukup refresh tanpa memulihkan dialog.
    }
  }, true);
  // Pulihkan dialog setelah muat ulang/refresh data. Dihapus hanya oleh root yang memuat dialognya (shell
  // dipasang lebih dulu daripada isi di render langsung).
  onMount((root) => {
    try {
      if (typeof window.name !== 'string' || !window.name.startsWith(RESTORE_PREFIX)) return;
      const restore = JSON.parse(window.name.slice(RESTORE_PREFIX.length));
      const dialogId = typeof restore?.dialog === 'string' && /^kumpul-[a-z-]{1,40}$/.test(restore.dialog) ? restore.dialog : '';
      const dialog = dialogId ? root.querySelector(`#${dialogId}`) : null;
      if (!dialog && root !== document) return;
      window.name = '';
      if (dialog instanceof HTMLDialogElement && dialog.matches('[data-kumpul-reservation-dialog]')) {
        const filter = typeof restore.filter === 'string' && /^[A-Z_]{1,40}$/.test(restore.filter)
          ? dialog.querySelector(`[data-kumpul-reservation-filter="${restore.filter}"]`)
          : null;
        if (filter instanceof HTMLElement) filter.click();
        if (!dialog.open) dialog.showModal();
      }
    } catch {
      window.name = '';
    }
  });

  // Draft pesanan: koordinat dari perangkat untuk field lokasi.
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-kumpul-geolocate]') : null;
    if (!button || button.disabled) return;
    const input = document.getElementById(button.getAttribute('data-kumpul-geolocate'));
    if (!input || !navigator.geolocation) {
      button.textContent = 'Lokasi tidak tersedia';
      return;
    }
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Mencari lokasi…';
    navigator.geolocation.getCurrentPosition(
      (position) => {
        input.value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        button.disabled = false;
        button.textContent = label;
      },
      () => {
        button.disabled = false;
        button.textContent = 'Izin lokasi ditolak';
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });

  // Draft pesanan: file langsung diunggah begitu dipilih (tombol "Unggah" tetap ada sebagai cadangan).
  document.addEventListener('change', (event) => {
    const input = event.target instanceof HTMLInputElement && event.target.matches('[data-kumpul-autoupload]') ? event.target : null;
    if (!input || !input.files || !input.files.length) return;
    const scope = input.closest('[data-bagdja-scope]') || document;
    const name = input.getAttribute('data-kumpul-autoupload');
    const button = Array.from(scope.querySelectorAll('[data-kumpul-upload-for]'))
      .find((candidate) => candidate.getAttribute('data-kumpul-upload-for') === name);
    if (button && !button.disabled) button.click();
  });

  const mountRoot = (root) => {
    const cleanups = mountSteps.map((step) => step(root)).filter((cleanup) => typeof cleanup === 'function');
    return () => cleanups.forEach((cleanup) => cleanup());
  };
  // Render langsung oleh Bagdja (D8): host memanggil mount untuk shell & setiap isi halaman.
  // Iframe/SSR: seluruh dokumen adalah satu root, dipasang sekarang (perilaku lama).
  if (window.__bagdjaTemplateHost === 'inline') window.BagdjaTemplateClient = { mount: mountRoot };
  else mountRoot(document);
})();
