/* Extractions : classeur Excel mis en forme et documents imprimables (PDF via le navigateur). */
(function (DU) {
  'use strict';
  const { esc, fmtDate, fmtDateLong, fmtNum, slug, download, todayISO } = DU.util;
  const M = DU.model;

  /* ====================================================================
   * Export Excel
   * ==================================================================== */
  const XL = {
    head: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B365D' } },
    p1: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6E3E1' } },
    p2: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBEEDD' } },
    p3: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F0EA' } },
  };

  function addTable(ws, columns, rows) {
    ws.columns = columns.map((c) => ({ header: c.h, key: c.k, width: c.w || 14 }));
    rows.forEach((r) => ws.addRow(r));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = XL.head;
    header.alignment = { vertical: 'middle', wrapText: true };
    header.height = 30;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    ws.eachRow((row, i) => { if (i > 1) row.alignment = { vertical: 'top', wrapText: true }; });
  }

  async function excel(src, { fichier, versionInfo } = {}) {
    const wb = new window.ExcelJS.Workbook();
    wb.creator = 'Document unique';
    wb.created = new Date();
    const unite = (id) => M.uniteNom(src, id);

    /* Présentation */
    const pres = wb.addWorksheet('Présentation');
    pres.columns = [{ width: 34 }, { width: 80 }];
    [
      ['Document unique d’évaluation des risques professionnels', ''],
      ['Raison sociale', src.entreprise.raisonSociale],
      ['Effectif', src.entreprise.effectif ?? ''],
      ...src.entreprise.infos.map((i) => [i.label, i.value]),
      ['Code document', src.document.code],
      ['Version', versionInfo ? versionInfo.indice : src.document.indice],
      ['Date', versionInfo ? fmtDate(versionInfo.date) : fmtDate(todayISO())],
      ['Rédacteur', versionInfo ? versionInfo.redacteur : src.document.redacteur],
      ['Vérificateur', versionInfo ? versionInfo.verificateur : src.document.verificateur],
    ].forEach((r) => pres.addRow(r));
    pres.getRow(1).font = { bold: true, size: 14 };
    pres.getColumn(1).font = { bold: true };

    /* Méthode */
    const meth = wb.addWorksheet('Méthode');
    meth.columns = [{ width: 18 }, { width: 10 }, { width: 90 }];
    meth.addRow(['Risque initial = G × F × P ; risque résiduel = risque initial × M']).font = { bold: true };
    ['G', 'F', 'P'].forEach((k) => {
      meth.addRow([]);
      meth.addRow([M.ECHELLES[k].nom]).font = { bold: true };
      Object.entries(M.ECHELLES[k].niveaux).forEach(([n, l]) => meth.addRow(['', Number(n), l]));
    });
    meth.addRow([]);
    meth.addRow(['Maîtrise (M)']).font = { bold: true };
    M.MAITRISE.forEach((m) => meth.addRow(['', m.v, m.label]));
    meth.addRow([]);
    meth.addRow(['Priorités']).font = { bold: true };
    meth.addRow(['', `≥ ${src.seuils.priorite}`, M.PRIORITES.p1.label]);
    meth.addRow(['', `${src.seuils.second} à < ${src.seuils.priorite}`, M.PRIORITES.p2.label]);
    meth.addRow(['', `< ${src.seuils.second}`, M.PRIORITES.p3.label]);

    /* Inventaire */
    const du = wb.addWorksheet('DU complet');
    const actionsTxt = (r) => M.actionsDuRisque(src, r.id)
      .map((a) => `${a.intitule}${a.responsable ? ' — ' + a.responsable : ''}${a.echeance ? ' — ' + fmtDate(a.echeance) : a.echeanceTexte ? ' — ' + a.echeanceTexte : ''} (${M.statutLabel(a.statut)})`)
      .join('\n');
    const risques = sortRisques(src);
    addTable(du, [
      { h: 'N°', k: 'num', w: 7 }, { h: 'Unité de travail', k: 'ut', w: 22 }, { h: 'Localisation', k: 'loc', w: 20 },
      { h: 'Famille de risques', k: 'famille', w: 24 }, { h: 'Situation dangereuse', k: 'situation', w: 46 },
      { h: 'Salariés exposés', k: 'exposes', w: 10 }, { h: 'G', k: 'G', w: 5 }, { h: 'F', k: 'F', w: 5 }, { h: 'P', k: 'P', w: 5 },
      { h: 'Risque initial', k: 'ini', w: 9 }, { h: 'Mesures de prévention existantes', k: 'mesures', w: 50 },
      { h: 'M', k: 'M', w: 6 }, { h: 'Risque résiduel', k: 'res', w: 9 }, { h: 'Priorité', k: 'prio', w: 20 },
      { h: 'Impact différencié selon le sexe', k: 'sexe', w: 30 }, { h: 'Actions retenues', k: 'actions', w: 50 },
    ], risques.map((r) => ({
      num: r.num, ut: unite(r.uniteId), loc: r.localisation, famille: r.famille, situation: r.situation,
      exposes: r.exposes ?? '', G: r.G, F: r.F, P: r.P, ini: M.initial(r), mesures: r.mesures, M: r.M,
      res: M.residuel(r), prio: M.priorite(r, src.seuils).label, sexe: r.impactSexe, actions: actionsTxt(r),
    })));
    du.eachRow((row, i) => {
      if (i === 1) return;
      const p = M.priorite(risques[i - 2], src.seuils).key;
      if (XL[p]) row.getCell('prio').fill = XL[p];
    });

    /* Plan d'actions */
    const pa = wb.addWorksheet('Plan d’actions');
    const actions = src.actions.slice().sort((a, b) => (b.annee || 0) - (a.annee || 0));
    addTable(pa, [
      { h: 'Programme', k: 'prog', w: 14 }, { h: 'Action de prévention', k: 'intitule', w: 46 }, { h: 'Objectif', k: 'objectif', w: 36 },
      { h: 'Indicateur de résultat', k: 'indicateur', w: 26 }, { h: 'Conditions d’exécution', k: 'conditions', w: 26 },
      { h: 'Responsable', k: 'resp', w: 16 }, { h: 'Échéance', k: 'ech', w: 14 }, { h: 'Budget', k: 'budget', w: 12 },
      { h: 'Statut', k: 'statut', w: 14 }, { h: 'Réalisation effective', k: 'real', w: 26 }, { h: 'Risques liés (n°)', k: 'risques', w: 18 },
    ], actions.map((a) => ({
      prog: a.annee ? `PAPRIPACT ${a.annee}` : 'Hors programme', intitule: a.intitule, objectif: a.objectif,
      indicateur: a.indicateur, conditions: a.conditions, resp: a.responsable,
      ech: a.echeance ? fmtDate(a.echeance) : a.echeanceTexte, budget: a.budget, statut: M.statutLabel(a.statut),
      real: a.realisation, risques: M.risquesDeLAction(src, a).map((r) => r.num).join(', '),
    })));

    /* Pénibilité */
    const pe = wb.addWorksheet('Pénibilité');
    addTable(pe, [
      { h: 'Unité de travail', k: 'ut', w: 26 }, { h: 'Effectif', k: 'eff', w: 10 },
      ...M.FACTEURS.map((f) => ({ h: f.label, k: f.key, w: 14 })),
    ], src.unites.map((u) => Object.assign({ ut: u.nom, eff: u.effectif ?? '' },
      Object.fromEntries(M.FACTEURS.map((f) => [f.key, u.penibilite[f.key] ?? ''])))));
    const tot = penibiliteTotaux(src);
    const totRow = pe.addRow(Object.assign({ ut: 'Total exposés', eff: tot.effectif || '' }, tot.exposes));
    totRow.font = { bold: true };
    pe.addRow(Object.assign({ ut: 'Proportion exposée' }, Object.fromEntries(M.FACTEURS.map((f) => [f.key, tot.proportion[f.key] === null ? '' : `${fmtNum(tot.proportion[f.key] * 100, 1)} %`])))).font = { italic: true };

    /* Historique */
    if (src.versions && src.versions.length) {
      const hi = wb.addWorksheet('Historique des versions');
      addTable(hi, [
        { h: 'Version', k: 'ind', w: 9 }, { h: 'Date', k: 'date', w: 12 }, { h: 'Motif', k: 'motif', w: 40 },
        { h: 'Rédacteur', k: 'red', w: 18 }, { h: 'Vérificateur', k: 'ver', w: 18 }, { h: 'Consultation CSE', k: 'cse', w: 14 },
        { h: 'Modifications', k: 'mods', w: 80 },
      ], src.versions.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((v) => ({
        ind: v.indice, date: fmtDate(v.date), motif: motifTexte(v), red: v.redacteur, ver: v.verificateur,
        cse: fmtDate(v.consultationCSE), mods: v.modifications.map(modifTexte).join('\n'),
      })));
    }

    const buf = await wb.xlsx.writeBuffer();
    download(fichier || `DUERP-${slug(src.entreprise.raisonSociale)}-${todayISO()}.xlsx`,
      new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  }

  /* ====================================================================
   * Documents imprimables
   * ==================================================================== */
  function sortRisques(src, list) {
    const order = new Map(src.unites.map((u, i) => [u.id, i]));
    return (list || src.risques).slice().sort((a, b) =>
      (order.get(a.uniteId) ?? 999) - (order.get(b.uniteId) ?? 999) || (Number(a.num) || 0) - (Number(b.num) || 0));
  }

  function penibiliteTotaux(src) {
    const effectif = src.unites.reduce((s, u) => s + (Number(u.effectif) || 0), 0);
    const exposes = {}, proportion = {};
    M.FACTEURS.forEach((f) => {
      const vals = src.unites.map((u) => u.penibilite[f.key]).filter((v) => v !== null && v !== undefined && v !== '');
      exposes[f.key] = vals.length ? vals.reduce((s, v) => s + Number(v), 0) : '';
      const base = effectif || Number(src.entreprise.effectif) || 0;
      proportion[f.key] = vals.length && base ? exposes[f.key] / base : null;
    });
    return { effectif, exposes, proportion };
  }

  const motifTexte = (v) => {
    const m = M.MOTIFS.find((x) => x.key === v.motif);
    return [m && v.motif !== 'autre' ? m.label : '', v.motifDetail].filter(Boolean).join(' — ');
  };
  const modifTexte = (m) => {
    const t = { ajout: 'Ajout', modification: 'Modification', suppression: 'Suppression' }[m.type] || '';
    return [m.ut, m.libelle, m.detail || t, m.num ? `n° ${m.num}` : ''].filter(Boolean).join(' · ');
  };

  const prioCell = (r, s) => {
    const p = M.priorite(r, s);
    return `<span class="pr-prio pr-prio--${p.key}">${esc(p.court)}</span>`;
  };

  function tableRisques(src, risques) {
    if (!risques.length) return '<p class="pr-empty">Aucun risque recensé.</p>';
    return `<table class="pr-table">
      <thead><tr>
        <th>N°</th><th>Localisation</th><th>Famille</th><th class="pr-w">Situation dangereuse</th>
        <th title="Gravité">G</th><th title="Fréquence">F</th><th title="Probabilité">P</th><th>Initial</th>
        <th class="pr-w">Mesures de prévention existantes</th><th>M</th><th>Résiduel</th><th>Priorité</th><th class="pr-w">Actions retenues</th>
      </tr></thead><tbody>
      ${risques.map((r) => `<tr>
        <td class="pr-mono">${esc(r.num)}</td><td>${esc(r.localisation)}</td><td>${esc(r.famille)}</td>
        <td>${esc(r.situation)}${r.exposes ? `<br><small>${esc(r.exposes)} salarié(s) exposé(s)</small>` : ''}${r.impactSexe ? `<br><small>Impact F/H : ${esc(r.impactSexe)}</small>` : ''}</td>
        <td>${esc(r.G ?? '')}</td><td>${esc(r.F ?? '')}</td><td>${esc(r.P ?? '')}</td><td class="pr-mono">${fmtNum(M.initial(r))}</td>
        <td>${esc(r.mesures)}</td><td class="pr-mono">${fmtNum(r.M)}</td><td class="pr-mono"><strong>${fmtNum(M.residuel(r))}</strong></td>
        <td>${prioCell(r, src.seuils)}</td>
        <td>${M.actionsDuRisque(src, r.id).map((a) => `${esc(a.intitule)}<small> — ${esc(a.responsable || '')} ${a.echeance ? fmtDate(a.echeance) : esc(a.echeanceTexte || '')} (${esc(M.statutLabel(a.statut))})</small>`).join('<br>')}</td>
      </tr>`).join('')}
      </tbody></table>`;
  }

  function tableActions(src, actions) {
    if (!actions.length) return '<p class="pr-empty">Aucune action.</p>';
    return `<table class="pr-table">
      <thead><tr><th class="pr-w">Action de prévention</th><th class="pr-w">Objectif</th><th>Indicateur de résultat</th>
      <th>Conditions d’exécution</th><th>Responsable</th><th>Échéance</th><th>Budget</th><th>Statut</th><th>Réalisation effective</th><th>Risques (n°)</th></tr></thead>
      <tbody>${actions.map((a) => `<tr>
        <td>${esc(a.intitule)}</td><td>${esc(a.objectif)}</td><td>${esc(a.indicateur)}</td><td>${esc(a.conditions)}</td>
        <td>${esc(a.responsable)}</td><td>${a.echeance ? fmtDate(a.echeance) : esc(a.echeanceTexte)}</td>
        <td class="pr-mono">${typeof a.budget === 'number' ? fmtNum(a.budget, 0) + ' €' : esc(a.budget)}</td>
        <td>${esc(M.statutLabel(a.statut))}</td><td>${esc(a.realisation)}</td>
        <td class="pr-mono">${M.risquesDeLAction(src, a).map((r) => esc(r.num)).join(', ')}</td></tr>`).join('')}
      </tbody></table>`;
  }

  function tablePenibilite(src) {
    const tot = penibiliteTotaux(src);
    return `<table class="pr-table pr-table--num">
      <thead>
        <tr><th rowspan="2">Unité de travail</th><th rowspan="2">Effectif</th>
          ${M.PENIBILITE.map((g) => `<th colspan="${g.facteurs.length}">${esc(g.groupe)}</th>`).join('')}</tr>
        <tr>${M.FACTEURS.map((f) => `<th>${esc(f.label)}</th>`).join('')}</tr>
      </thead>
      <tbody>${src.unites.map((u) => `<tr><td>${esc(u.nom)}</td><td>${esc(u.effectif ?? '')}</td>
        ${M.FACTEURS.map((f) => `<td>${esc(u.penibilite[f.key] ?? '')}</td>`).join('')}</tr>`).join('')}
      </tbody>
      <tfoot>
        <tr><th>Total exposés</th><td>${esc(tot.effectif || '')}</td>${M.FACTEURS.map((f) => `<td>${esc(tot.exposes[f.key])}</td>`).join('')}</tr>
        <tr><th>Proportion exposée</th><td></td>${M.FACTEURS.map((f) => `<td>${tot.proportion[f.key] === null ? '' : fmtNum(tot.proportion[f.key] * 100, 1) + ' %'}</td>`).join('')}</tr>
      </tfoot></table>
      <p class="pr-note">Nombre de salariés exposés aux facteurs de risques professionnels au-delà des seuils fixés à l’article D4163-2 du Code du travail (art. R4121-1-1).</p>`;
  }

  function methode(src) {
    const ech = (k) => `<div><h4>${esc(M.ECHELLES[k].nom)} (${k})</h4><ol>${Object.values(M.ECHELLES[k].niveaux).map((l) => `<li>${esc(l)}</li>`).join('')}</ol></div>`;
    return `<section class="pr-section pr-break">
      <h2>Méthode d’évaluation</h2>
      <p>Chaque situation dangereuse est évaluée par unité de travail. <strong>Risque initial = G × F × P</strong> (de 1 à 64).
      La maîtrise des mesures existantes (M) pondère ce score : <strong>risque résiduel = risque initial × M</strong>.</p>
      <div class="pr-cols">${ech('G')}${ech('F')}${ech('P')}
        <div><h4>Maîtrise (M)</h4><ul>${M.MAITRISE.map((m) => `<li><strong>${fmtNum(m.v)}</strong> — ${esc(m.label)}</li>`).join('')}</ul></div></div>
      <h4>Priorités</h4>
      <ul><li><strong>≥ ${esc(src.seuils.priorite)}</strong> — ${M.PRIORITES.p1.label}</li>
        <li><strong>${esc(src.seuils.second)} à moins de ${esc(src.seuils.priorite)}</strong> — ${M.PRIORITES.p2.label}</li>
        <li><strong>moins de ${esc(src.seuils.second)}</strong> — ${M.PRIORITES.p3.label}</li></ul>
    </section>`;
  }

  function cover(src, titre, info) {
    return `<section class="pr-cover">
      <p class="pr-kicker">${esc(src.entreprise.raisonSociale)}</p>
      <h1>${titre}</h1>
      <dl class="pr-meta">
        ${src.document.code ? `<div><dt>Code</dt><dd>${esc(src.document.code)}</dd></div>` : ''}
        <div><dt>Version</dt><dd>${esc(info.indice || '—')}</dd></div>
        <div><dt>Date</dt><dd>${esc(fmtDateLong(info.date))}</dd></div>
        ${info.redacteur ? `<div><dt>Rédacteur</dt><dd>${esc(info.redacteur)}</dd></div>` : ''}
        ${info.verificateur ? `<div><dt>Vérificateur</dt><dd>${esc(info.verificateur)}</dd></div>` : ''}
        ${info.consultationCSE ? `<div><dt>Consultation du CSE</dt><dd>${esc(fmtDate(info.consultationCSE))}</dd></div>` : ''}
      </dl>
      ${info.motif ? `<p class="pr-motif"><strong>Motif de la mise à jour :</strong> ${esc(info.motif)}</p>` : ''}
    </section>`;
  }

  function docComplet(src, info) {
    const papAnnees = [...new Set(src.actions.map((a) => a.annee).filter(Boolean))].sort((a, b) => b - a);
    const hors = src.actions.filter((a) => !a.annee);
    return `
      ${cover(src, 'Document unique d’évaluation<br>des risques professionnels', info)}
      ${info.modifications && info.modifications.length ? `<section class="pr-section">
        <h2>Modifications depuis la version précédente</h2>
        <table class="pr-table"><thead><tr><th>Unité concernée</th><th class="pr-w">Situation / élément</th><th>Type de modification</th><th>N°</th></tr></thead>
        <tbody>${info.modifications.map((m) => `<tr><td>${esc(m.ut)}</td><td>${esc(m.libelle)}</td><td>${esc(m.detail || { ajout: 'Ajout', modification: 'Modification', suppression: 'Suppression' }[m.type] || '')}${m.champs && m.champs.length ? ` (${esc(m.champs.join(', '))})` : ''}</td><td class="pr-mono">${esc(m.num || '')}</td></tr>`).join('')}</tbody></table>
      </section>` : ''}
      <section class="pr-section pr-break">
        <h2>Présentation de l’entreprise</h2>
        <dl class="pr-infos">
          <div><dt>Raison sociale</dt><dd>${esc(src.entreprise.raisonSociale)}</dd></div>
          ${src.entreprise.effectif ? `<div><dt>Effectif</dt><dd>${esc(src.entreprise.effectif)} salariés</dd></div>` : ''}
          ${src.entreprise.infos.map((i) => `<div><dt>${esc(i.label)}</dt><dd>${esc(i.value)}</dd></div>`).join('')}
        </dl>
        <h3>Unités de travail</h3>
        <p>${src.unites.map((u) => `${esc(u.nom)}${u.effectif ? ` (${esc(u.effectif)})` : ''}`).join(' · ')}</p>
      </section>
      ${methode(src)}
      ${src.unites.map((u) => {
        const rs = sortRisques(src, src.risques.filter((r) => r.uniteId === u.id));
        if (!rs.length) return '';
        return `<section class="pr-section pr-break"><h2>${esc(u.nom)}</h2>
          <p class="pr-sub">${rs.length} risque(s)${u.effectif ? ` · effectif ${esc(u.effectif)}` : ''}</p>${tableRisques(src, rs)}</section>`;
      }).join('')}
      ${papAnnees.map((y) => `<section class="pr-section pr-break"><h2>PAPRIPACT ${y}</h2>
        <p class="pr-sub">Programme annuel de prévention des risques professionnels et d’amélioration des conditions de travail</p>
        ${tableActions(src, src.actions.filter((a) => a.annee === y))}</section>`).join('')}
      ${hors.length ? `<section class="pr-section pr-break"><h2>Autres actions de prévention</h2>${tableActions(src, hors)}</section>` : ''}
      <section class="pr-section pr-break"><h2>Facteurs de risques professionnels</h2>${tablePenibilite(src)}</section>
      <section class="pr-section"><h2>Conservation et mise à disposition</h2>
        <p>Ce document et ses versions successives sont conservés pendant au moins 40 ans (art. L4121-3-1).
        Ils sont tenus à la disposition des travailleurs et anciens travailleurs, des membres du CSE, du service de prévention et de santé au travail,
        de l’inspection du travail et des agents des organismes de sécurité sociale (art. R4121-4).</p></section>`;
  }

  function docUnite(src, uniteId, info) {
    const u = M.uniteById(src, uniteId);
    const rs = sortRisques(src, src.risques.filter((r) => r.uniteId === uniteId));
    return `${cover(src, `Document unique<br>Extrait : ${esc(u ? u.nom : '')}`, info)}
      <section class="pr-section"><h2>${esc(u ? u.nom : '')}</h2>
      <p class="pr-sub">${rs.length} risque(s)${u && u.effectif ? ` · effectif ${esc(u.effectif)}` : ''}</p>${tableRisques(src, rs)}</section>
      ${methode(src)}`;
  }

  function docPapripact(src, annee, info) {
    const actions = src.actions.filter((a) => (annee === 'hors' ? !a.annee : a.annee === annee));
    const budget = actions.reduce((s, a) => s + (typeof a.budget === 'number' ? a.budget : 0), 0);
    const titre = annee === 'hors' ? 'Actions de prévention<br>hors programme annuel' : `PAPRIPACT ${annee}`;
    return `${cover(src, titre, info)}
      <section class="pr-section"><h2>${annee === 'hors' ? 'Actions hors programme' : `Programme annuel de prévention ${annee}`}</h2>
      <p class="pr-sub">${actions.length} action(s) · budget chiffré ${fmtNum(budget, 0)} € (art. L2312-27 du Code du travail)</p>
      ${tableActions(src, actions)}</section>`;
  }

  function docPenibilite(src, info) {
    return `${cover(src, 'Facteurs de risques<br>professionnels', info)}
      <section class="pr-section"><h2>Exposition par unité de travail</h2>${tablePenibilite(src)}</section>`;
  }

  /** Lance l'impression du document ; Chrome propose « Enregistrer au format PDF ». */
  async function print(type, { src, info, uniteId, annee, titre }) {
    await DU.store.flush();
    const root = document.getElementById('print-root');
    const docInfo = Object.assign({ date: todayISO() }, info || {});
    let html = '';
    if (type === 'complet') html = docComplet(src, docInfo);
    else if (type === 'unite') html = docUnite(src, uniteId, docInfo);
    else if (type === 'papripact') html = docPapripact(src, annee, docInfo);
    else if (type === 'penibilite') html = docPenibilite(src, docInfo);
    const pied = `${src.entreprise.raisonSociale || ''} · Document unique${docInfo.indice ? ' · version ' + docInfo.indice : ''} · ${fmtDate(docInfo.date)}`;
    root.innerHTML = `<style>@page { @bottom-left { content: ${JSON.stringify(pied)}; } }</style><div class="pr-doc">${html}</div>`;
    const prevTitle = document.title;
    document.title = titre || `DUERP-${slug(src.entreprise.raisonSociale)}-${docInfo.date}`;
    document.body.classList.add('is-printing');
    const cleanup = () => {
      document.body.classList.remove('is-printing');
      root.innerHTML = '';
      document.title = prevTitle;
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 60);
  }

  DU.export = { excel, print, penibiliteTotaux, motifTexte, modifTexte, sortRisques };
})(window.DU);
