/* Écran « Versions » : modifications en cours, publication d'une version figée, historique (40 ans). */
(function (DU) {
  'use strict';
  const { esc, uid, fmtDate, fmtDateLong, plural, todayISO, openDialog, toast } = DU.util;
  const M = DU.model;

  const TYPE = { ajout: 'Ajout', modification: 'Modification', suppression: 'Suppression' };

  function render() {
    const root = DU.util.resetRoot();
    const data = DU.store.get();
    const last = M.derniereVersion(data);
    const versions = data.versions.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const j = data.journal;

    root.innerHTML = `
      <header class="view-head view-head--wide">
        <p class="eyebrow">Mises à jour et archives</p>
        <h1 class="display">Versions</h1>
        <p class="lede">Chaque mise à jour publiée est figée et conservée : elle ne peut plus être modifiée ni supprimée.
        Le Code du travail impose de conserver les versions successives pendant au moins 40 ans (art. L4121-3-1).</p>
      </header>

      <section class="draft" aria-labelledby="h-draft">
        <div class="draft__head">
          <div>
            <p class="eyebrow">En cours de rédaction</p>
            <h2 id="h-draft" class="section-title">${j.length ? plural(j.length, 'modification', 'modifications') : 'Aucune modification'} depuis la version ${esc(last ? last.indice || '—' : '—')}${last ? ` du ${fmtDate(last.date)}` : ''}</h2>
          </div>
          <button type="button" class="btn btn--cta" data-publish>Publier une mise à jour</button>
        </div>
        ${j.length ? `<table class="data-table">
          <thead><tr><th>Type</th><th>Unité / domaine</th><th>Élément</th><th>N°</th><th>Champs modifiés</th><th>Date</th></tr></thead>
          <tbody>${j.slice().reverse().map((e) => `<tr>
            <td><span class="tag tag--${e.type}">${TYPE[e.type] || e.type}</span></td>
            <td>${esc(e.ut || '')}</td><td>${esc(e.libelle || '')}</td><td class="mono">${esc(e.num ?? '')}</td>
            <td>${esc((e.champs || []).join(', '))}</td><td class="mono">${fmtDate(e.date)}</td></tr>`).join('')}</tbody>
        </table>` : '<p class="hint">Même sans modification, publiez une version lors de la revue annuelle : elle date la réévaluation.</p>'}
      </section>

      <section aria-labelledby="h-hist">
        <h2 id="h-hist" class="section-title">Historique</h2>
        <ol class="timeline">${versions.map((v) => `<li class="timeline__item">
          <div class="timeline__mark"><span class="timeline__ind">${esc(v.indice || '—')}</span></div>
          <div class="timeline__body">
            <p class="timeline__date">${esc(fmtDateLong(v.date))}</p>
            <p class="timeline__motif">${esc(DU.export.motifTexte(v) || 'Motif non précisé')}</p>
            <p class="timeline__meta">${[v.redacteur && `Rédacteur : ${esc(v.redacteur)}`, v.verificateur && `Vérificateur : ${esc(v.verificateur)}`, v.consultationCSE && `CSE consulté le ${fmtDate(v.consultationCSE)}`].filter(Boolean).join(' · ')}</p>
            <details class="timeline__details"><summary>${plural(v.modifications.length, 'modification', 'modifications')}</summary>
              <ul>${v.modifications.map((m) => `<li>${esc(DU.export.modifTexte(m))}${m.champs && m.champs.length ? ` <small>(${esc(m.champs.join(', '))})</small>` : ''}</li>`).join('') || '<li>Aucune modification enregistrée.</li>'}</ul>
            </details>
            <div class="timeline__actions">
              <button type="button" class="btn btn--ghost" data-pdf="${esc(v.id)}">Imprimer / PDF</button>
              <button type="button" class="btn btn--ghost" data-xlsx="${esc(v.id)}">Excel</button>
            </div>
          </div>
        </li>`).join('') || '<li class="hint">Aucune version publiée.</li>'}</ol>
      </section>`;

    root.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if ('publish' in t.dataset) publish();
      else if (t.dataset.pdf || t.dataset.xlsx) {
        const v = DU.store.get().versions.find((x) => x.id === (t.dataset.pdf || t.dataset.xlsx));
        if (!v) return;
        if (t.dataset.pdf) DU.export.print('complet', { src: v.snapshot, info: versionInfo(v), titre: `DUERP-version-${v.indice}-${v.date}` });
        else DU.export.excel(Object.assign({}, v.snapshot, { versions: [] }), { versionInfo: v, fichier: `DUERP-version-${v.indice}-${v.date}.xlsx` });
      }
    });
  }

  const versionInfo = (v) => ({
    indice: v.indice, date: v.date, redacteur: v.redacteur, verificateur: v.verificateur,
    consultationCSE: v.consultationCSE, motif: DU.export.motifTexte(v), modifications: v.modifications,
  });

  async function publish() {
    const data = DU.store.get();
    const last = M.derniereVersion(data);
    const indice = M.indiceSuivant(data.document.indice || (last && last.indice));
    const n = data.journal.length;
    const res = await openDialog({
      title: 'Publier une mise à jour',
      submitLabel: 'Publier la version',
      wide: true,
      body: `
        <p>La version publiée sera figée et archivée avec ${plural(n, 'modification', 'modifications')}. Vous pourrez ensuite l’imprimer ou l’exporter.</p>
        <div class="grid-2">
          <label class="field"><span class="field__label">Indice de version</span><input name="indice" value="${esc(indice)}" required class="mono"></label>
          <label class="field"><span class="field__label">Date</span><input type="date" name="date" value="${todayISO()}" required></label>
          <label class="field"><span class="field__label">Rédacteur</span><input name="redacteur" value="${esc(data.document.redacteur)}"></label>
          <label class="field"><span class="field__label">Vérificateur</span><input name="verificateur" value="${esc(data.document.verificateur)}"></label>
        </div>
        <fieldset class="radio-list"><legend>Motif de la mise à jour <small>(art. R4121-2)</small></legend>
          ${M.MOTIFS.map((m, i) => `<label><input type="radio" name="motif" value="${m.key}"${i === 0 ? ' checked' : ''}> ${esc(m.label)}</label>`).join('')}
        </fieldset>
        <label class="field"><span class="field__label">Précision (facultatif)</span><input name="motifDetail" placeholder="Ex. : création de l’atelier de conditionnement n°2"></label>
        <label class="field"><span class="field__label">Date de consultation du CSE (facultatif)</span><input type="date" name="consultationCSE"></label>`,
      onSubmit: (form) => DU.ui.formValues(form),
    });
    if (!res) return;
    DU.store.commit((d) => {
      const modifications = d.journal.map((e) => ({ type: e.type, ut: e.ut, libelle: e.libelle, num: e.num, champs: e.champs || [], entity: e.entity }));
      d.document.indice = res.indice;
      d.document.redacteur = res.redacteur;
      d.document.verificateur = res.verificateur;
      d.versions.push({
        id: uid(), indice: res.indice, date: res.date, motif: res.motif, motifDetail: res.motifDetail,
        redacteur: res.redacteur, verificateur: res.verificateur, consultationCSE: res.consultationCSE,
        modifications, snapshot: DU.importExcel.snapshotOf(d),
      });
      d.journal = [];
      return null;
    });
    toast(`Version ${res.indice} publiée et archivée.`, 'ok');
  }

  DU.views = DU.views || {};
  DU.views.versions = { render, versionInfo, title: 'Versions' };
})(window.DU);
