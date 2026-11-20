/* Utilitaires partagés : échappement HTML, dates, nombres, boîtes de dialogue, notifications. */
window.DU = window.DU || {};

(function (DU) {
  'use strict';

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const clone = (o) => JSON.parse(JSON.stringify(o));

  /** Supprime accents, ponctuation superflue et casse : sert aux comparaisons tolérantes. */
  const norm = (s) =>
    String(s ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[’']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const pad = (n) => String(n).padStart(2, '0');

  /** Date locale au format AAAA-MM-JJ. */
  const toISODate = (d) =>
    d instanceof Date && !isNaN(d)
      ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      : '';

  const todayISO = () => toISODate(new Date());

  const parseISO = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return y ? new Date(y, (m || 1) - 1, d || 1) : null;
  };

  const fmtDate = (iso) => {
    const d = parseISO(iso);
    return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
  };

  const fmtDateLong = (iso) => {
    const d = parseISO(iso);
    return d
      ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
  };

  const addYears = (iso, n) => {
    const d = parseISO(iso);
    if (!d) return '';
    d.setFullYear(d.getFullYear() + n);
    return toISODate(d);
  };

  const daysBetween = (fromISO, toISO) => {
    const a = parseISO(fromISO);
    const b = parseISO(toISO);
    return a && b ? Math.round((b - a) / 86400000) : null;
  };

  const fmtNum = (n, digits = 2) =>
    n === null || n === undefined || n === '' || isNaN(n)
      ? '—'
      : Number(n).toLocaleString('fr-FR', { maximumFractionDigits: digits });

  const plural = (n, one, many) => `${fmtNum(n, 0)} ${n > 1 ? many : one}`;

  const debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ---------- Notifications discrètes ---------- */
  function toast(message, tone = 'info') {
    const region = $('#toasts');
    if (!region) return;
    const el = document.createElement('div');
    el.className = `toast toast--${tone}`;
    el.textContent = message;
    region.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => {
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), 400);
    }, 3800);
  }

  /* ---------- Boîte de dialogue générique ---------- */
  /**
   * Ouvre la boîte de dialogue avec un contenu HTML.
   * `onSubmit(form)` peut renvoyer false pour garder la boîte ouverte.
   */
  function openDialog({ title, body, submitLabel = 'Valider', cancelLabel = 'Annuler', tone = 'cta', onSubmit, wide = false }) {
    const dlg = $('#dialog');
    dlg.classList.toggle('dialog--wide', wide);
    dlg.innerHTML = `
      <form method="dialog" class="dialog__form">
        <h2 class="dialog__title">${esc(title)}</h2>
        <div class="dialog__body">${body}</div>
        <div class="dialog__actions">
          ${cancelLabel ? `<button type="button" class="btn btn--ghost" data-dialog-cancel>${esc(cancelLabel)}</button>` : ''}
          <button type="submit" class="btn btn--${tone}">${esc(submitLabel)}</button>
        </div>
      </form>`;
    const form = dlg.querySelector('form');
    return new Promise((resolve) => {
      const close = (val) => {
        dlg.close();
        resolve(val);
      };
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        const res = onSubmit ? onSubmit(form) : true;
        if (res === false) return;
        close(res === undefined ? true : res);
      });
      const cancel = form.querySelector('[data-dialog-cancel]');
      if (cancel) cancel.addEventListener('click', () => close(null));
      dlg.addEventListener('cancel', () => resolve(null), { once: true });
      dlg.showModal();
      const first = form.querySelector('input, select, textarea');
      (first || form.querySelector('[type=submit]')).focus();
    });
  }

  const confirmDialog = (message, { title = 'Confirmer', submitLabel = 'Confirmer', tone = 'danger' } = {}) =>
    openDialog({ title, body: `<p>${esc(message)}</p>`, submitLabel, tone });

  function download(filename, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  /** Remplace le conteneur de vue par une copie vide : supprime les anciens écouteurs. */
  function resetRoot() {
    const old = document.getElementById('view-root');
    const fresh = old.cloneNode(false);
    old.replaceWith(fresh);
    return fresh;
  }

  const slug = (s) =>
    norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document';

  DU.util = {
    esc, uid, clone, norm, toISODate, todayISO, parseISO, fmtDate, fmtDateLong, addYears,
    daysBetween, fmtNum, plural, debounce, $, $$, toast, openDialog, confirmDialog, download, slug, resetRoot,
  };
})(window.DU);
