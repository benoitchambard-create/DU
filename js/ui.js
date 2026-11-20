/* Fragments d'interface réutilisés : badges, cotation, panneau latéral. */
(function (DU) {
  'use strict';
  const { esc, fmtNum, fmtDate, $ } = DU.util;
  const M = DU.model;

  const prio = (p) =>
    `<span class="prio prio--${p.key}" title="${esc(p.label)}"><span class="prio__mark" aria-hidden="true"></span>${esc(p.court)}</span>`;

  const statut = (a, today) => {
    const late = M.enRetard(a, today);
    return `<span class="statut statut--${a.statut}${late ? ' statut--late' : ''}">${esc(M.statutLabel(a.statut))}${late ? ' · en retard' : ''}</span>`;
  };

  /** « G3 · F4 · P2 = 24 → × 0,5 = 12 » */
  function score(r) {
    const ini = M.initial(r);
    const res = M.residuel(r);
    const v = (x) => (x === null || x === undefined ? '–' : x);
    return `<span class="score" aria-label="Gravité ${v(r.G)}, fréquence ${v(r.F)}, probabilité ${v(r.P)}, risque initial ${fmtNum(ini)}, maîtrise ${fmtNum(r.M)}, risque résiduel ${fmtNum(res)}">
      <span aria-hidden="true">G${v(r.G)} · F${v(r.F)} · P${v(r.P)} <span class="score__eq">=</span> ${fmtNum(ini)}
      <span class="score__arrow">→</span> ×${fmtNum(r.M)} <span class="score__eq">=</span> <strong>${fmtNum(res)}</strong></span></span>`;
  }

  const options = (list, selected, { empty } = {}) =>
    (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') +
    list.map((o) => {
      const value = typeof o === 'object' ? o.value : o;
      const label = typeof o === 'object' ? o.label : o;
      return `<option value="${esc(value)}"${String(value) === String(selected ?? '') ? ' selected' : ''}>${esc(label)}</option>`;
    }).join('');

  const echeance = (a) => (a.echeance ? fmtDate(a.echeance) : a.echeanceTexte || 'Sans échéance');

  const budget = (b) => (b === '' || b === null || b === undefined ? '' : typeof b === 'number' ? `${fmtNum(b, 0)} €` : b);

  /* ---------- Panneau latéral ---------- */
  let lastFocus = null;
  let onClose = null;
  let hideTimer = null;

  function openPanel(html, { bind, close } = {}) {
    const panel = $('#panel');
    clearTimeout(hideTimer);
    if (panel.hidden || !panel.contains(document.activeElement)) lastFocus = document.activeElement;
    onClose = close || null;
    panel.innerHTML = `<div class="panel__inner">${html}</div>`;
    panel.hidden = false;
    document.body.classList.add('has-panel');
    requestAnimationFrame(() => panel.classList.add('is-open'));
    // Les écouteurs sont posés sur le contenu, recréé à chaque ouverture : pas d'accumulation
    if (bind) bind(panel.firstElementChild);
    const first = panel.querySelector('[autofocus], input, select, textarea, button');
    if (first) first.focus({ preventScroll: true });
  }

  function closePanel() {
    const panel = $('#panel');
    if (panel.hidden) return;
    panel.classList.remove('is-open');
    document.body.classList.remove('has-panel');
    hideTimer = setTimeout(() => { panel.hidden = true; panel.innerHTML = ''; }, 320);
    if (onClose) onClose();
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('#panel').hidden && !$('#dialog').open) closePanel();
  });

  /** Valeur d'un formulaire sous forme d'objet (nombres convertis si data-num). */
  function formValues(form) {
    const out = {};
    form.querySelectorAll('[name]').forEach((el) => {
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) {
        if (el.type === 'checkbox' && !(el.name in out)) out[el.name] = false;
        return;
      }
      let v = el.type === 'checkbox' ? (el.value === 'on' ? true : el.value) : el.value;
      if ('num' in el.dataset) v = v === '' ? null : Number(String(v).replace(',', '.'));
      else if (typeof v === 'string') v = v.trim();
      out[el.name] = v;
    });
    return out;
  }

  DU.ui = { prio, statut, score, options, echeance, budget, openPanel, closePanel, formValues };
})(window.DU);
