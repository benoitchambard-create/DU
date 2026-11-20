/* Écran « Pénibilité » : salariés exposés au-delà des seuils, par unité et par facteur (R4121-1-1). */
(function (DU) {
  'use strict';
  const { esc, fmtNum, toast } = DU.util;
  const M = DU.model;

  function render() {
    const root = DU.util.resetRoot();
    const data = DU.store.get();
    const tot = DU.export.penibiliteTotaux(data);
    const input = (u, key, val, label) => `<input class="cell-input mono" inputmode="numeric" data-u="${esc(u.id)}" data-k="${key}"
      value="${esc(val ?? '')}" aria-label="${esc(label)} — ${esc(u.nom)}">`;

    root.innerHTML = `
      <header class="view-head view-head--wide">
        <p class="eyebrow">Facteurs de risques professionnels</p>
        <h1 class="display">Pénibilité</h1>
        <div class="two-col-text">
          <p class="lede">Le document unique doit indiquer la proportion de salariés exposés aux dix facteurs de risques professionnels
          au-delà des seuils réglementaires (art. R4121-1-1 et D4163-2). Saisissez l’effectif de chaque unité et le nombre de salariés exposés.</p>
          <p class="hint">Les cellules s’enregistrent dès que vous quittez le champ. Une cellule vide signifie « non évalué » ; saisissez 0 si personne n’est exposé.</p>
        </div>
      </header>
      <div class="table-scroll" role="region" aria-label="Tableau de pénibilité" tabindex="0">
        <table class="grid-table">
          <thead>
            <tr><th rowspan="2" class="grid-table__ut">Unité de travail</th><th rowspan="2">Effectif</th>
              ${M.PENIBILITE.map((g) => `<th colspan="${g.facteurs.length}" class="grid-table__group">${esc(g.groupe)}</th>`).join('')}</tr>
            <tr>${M.FACTEURS.map((f) => `<th class="grid-table__f">${esc(f.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>${data.unites.map((u) => `<tr>
            <th scope="row" class="grid-table__ut">${esc(u.nom)}</th>
            <td>${input(u, 'effectif', u.effectif, 'Effectif')}</td>
            ${M.FACTEURS.map((f) => `<td>${input(u, f.key, u.penibilite[f.key], f.label)}</td>`).join('')}
          </tr>`).join('')}</tbody>
          <tfoot>
            <tr><th scope="row">Total</th><td class="mono">${tot.effectif || '—'}</td>
              ${M.FACTEURS.map((f) => `<td class="mono">${tot.exposes[f.key] === '' ? '—' : esc(tot.exposes[f.key])}</td>`).join('')}</tr>
            <tr><th scope="row">Proportion exposée</th><td></td>
              ${M.FACTEURS.map((f) => `<td class="mono">${tot.proportion[f.key] === null ? '—' : fmtNum(tot.proportion[f.key] * 100, 1) + ' %'}</td>`).join('')}</tr>
          </tfoot>
        </table>
      </div>
      <p class="hint">Effectif de l’entreprise déclaré : <strong>${esc(data.entreprise.effectif ?? '—')}</strong>
        · somme des effectifs par unité : <strong>${tot.effectif || '—'}</strong>.
        ${tot.effectif && data.entreprise.effectif && tot.effectif !== Number(data.entreprise.effectif) ? 'Les proportions sont calculées sur la somme des effectifs des unités.' : ''}</p>`;

    root.addEventListener('change', (e) => {
      const el = e.target.closest('.cell-input');
      if (!el) return;
      const raw = el.value.trim().replace(',', '.');
      const v = raw === '' ? null : Number(raw);
      if (raw !== '' && (isNaN(v) || v < 0)) { toast('Saisissez un nombre positif.', 'warn'); el.focus(); return; }
      const label = el.dataset.k === 'effectif' ? 'effectif' : (M.FACTEURS.find((f) => f.key === el.dataset.k) || {}).label;
      DU.store.commit((d) => {
        const u = d.unites.find((x) => x.id === el.dataset.u);
        if (!u) return null;
        if (el.dataset.k === 'effectif') u.effectif = v; else u.penibilite[el.dataset.k] = v;
        return { entity: 'unite', id: u.id, type: 'modification', ut: u.nom, libelle: 'Exposition aux facteurs de pénibilité', champs: [String(label).toLowerCase()] };
      });
    });
  }

  DU.views = DU.views || {};
  DU.views.penibilite = { render, title: 'Pénibilité', keepFocus: true };
})(window.DU);
