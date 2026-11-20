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

  /**
   * Prépare un logo : fond blanc rendu transparent, marges rognées, largeur limitée.
   * Renvoie { src (PNG en data URL), w, h }.
   */
  function loadLogo(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.onload = () => {
        URL.revokeObjectURL(url);
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const px = id.data;
        let opaque = true;
        for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { opaque = false; break; }
        if (opaque) {
          // Fond blanc → transparent, en conservant l'anticrénelage des contours
          for (let i = 0; i < px.length; i += 4) {
            const m = Math.min(px[i], px[i + 1], px[i + 2]);
            const a = Math.max(0, Math.min(1, (255 - m) / 90));
            if (a < 1) {
              for (let k = 0; k < 3; k++) px[i + k] = a ? Math.max(0, Math.min(255, Math.round((px[i + k] - (1 - a) * 255) / a))) : 0;
              px[i + 3] = Math.round(a * 255);
            }
          }
          ctx.putImageData(id, 0, 0);
        }
        let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
          if (px[(y * c.width + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        if (x1 < 0) { reject(new Error('vide')); return; }
        const w0 = x1 - x0 + 1, h0 = y1 - y0 + 1;
        const scale = Math.min(1, 800 / w0);
        const out = document.createElement('canvas');
        out.width = Math.round(w0 * scale); out.height = Math.round(h0 * scale);
        const o = out.getContext('2d');
        o.imageSmoothingQuality = 'high';
        o.drawImage(c, x0, y0, w0, h0, 0, 0, out.width, out.height);
        resolve({ src: out.toDataURL('image/png'), w: out.width, h: out.height });
      };
      img.src = url;
    });
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
    daysBetween, fmtNum, plural, debounce, $, $$, toast, openDialog, confirmDialog, download, slug, resetRoot, loadLogo,
  };
})(window.DU);
