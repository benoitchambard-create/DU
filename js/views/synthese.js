/* Écran « Synthèse » : phrase-titre, conformité, matrice danger × maîtrise, priorités. */
(function (DU) {
  'use strict';
  const { esc, fmtDate, fmtDateLong, addYears, daysBetween, plural, todayISO, fmtNum } = DU.util;
  const M = DU.model;
  const ui = DU.ui;

  function render(_root) {
    const root = DU.util.resetRoot();
    const data = DU.store.get();
    const today = todayISO();
    const s = data.seuils;
    const R = data.risques;
    const prio = (r) => M.priorite(r, s).key;
    const p1 = R.filter((r) => prio(r) === 'p1');
    const p1Sans = p1.filter((r) => !M.hasOpenAction(data, r.id));
    const nc = R.filter((r) => prio(r) === 'nc');

    const last = M.derniereVersion(data);
    const echeance = last ? addYears(last.date, 1) : null;
    const jours = echeance ? daysBetween(today, echeance) : null;
    const annee = new Date().getFullYear();
    const pap = data.actions.filter((a) => a.annee === annee);
    const papFaites = pap.filter((a) => a.statut === 'realisee').length;
    const retard = data.actions.filter((a) => M.enRetard(a, today));
    const aVerifier = data.actions.filter((a) => a.statut === 'a_verifier');
    const utEff = data.unites.filter((u) => u.effectif).length;
    const utPen = data.unites.filter((u) => Object.values(u.penibilite || {}).some((v) => v !== null && v !== '')).length;
    const expo = R.filter((r) => r.exposes !== null && r.exposes !== undefined && r.exposes !== '').length;

    /* Conformité : chaque ligne porte un libellé texte, la couleur n'est qu'un renfort */
    const check = (ok, titre, detail, href, warnLabel = 'À faire') => `
      <li class="check-row check-row--${ok === true ? 'ok' : ok === 'warn' ? 'warn' : 'todo'}">
        <span class="check-row__state">${ok === true ? 'Conforme' : ok === 'warn' ? 'À surveiller' : warnLabel}</span>
        <span class="check-row__text"><strong>${titre}</strong><span>${detail}</span></span>
        ${href ? `<a class="link-quiet" href="${href}">Voir</a>` : ''}
      </li>`;

    const checks = [
      check(jours !== null && jours >= 0 ? (jours <= 60 ? 'warn' : true) : false, 'Mise à jour annuelle',
        last ? `Version ${esc(last.indice || '—')} du ${fmtDate(last.date)} · ${jours >= 0 ? `prochaine avant le ${fmtDate(echeance)} (${plural(jours, 'jour', 'jours')})` : `échéance dépassée depuis le ${fmtDate(echeance)}`}` : 'Aucune version publiée',
        '#/versions', 'En retard'),
      check(data.journal.length ? 'warn' : true, 'Modifications à publier',
        data.journal.length ? `${plural(data.journal.length, 'modification', 'modifications')} depuis la dernière version` : 'Le document publié est à jour', '#/versions'),
      check(pap.length ? true : false, `PAPRIPACT ${annee}`,
        pap.length ? `${plural(pap.length, 'action', 'actions')}, ${papFaites} réalisée${papFaites > 1 ? 's' : ''}` : 'Aucune action programmée cette année', `#/actions?prog=${annee}`),
      check(retard.length ? 'warn' : true, 'Actions en retard',
        retard.length ? `${plural(retard.length, 'action ouverte a', 'actions ouvertes ont')} dépassé l’échéance` : 'Aucune action en retard', '#/actions?prog=all&statut=retard'),
      check(utPen === data.unites.length && data.unites.length ? true : false, 'Facteurs de pénibilité',
        `${utPen} / ${data.unites.length} unités renseignées · effectifs : ${utEff} / ${data.unites.length}`, '#/penibilite'),
      check(expo === R.length && R.length ? true : 'warn', 'Salariés exposés par risque',
        `${expo} / ${R.length} risques renseignés`, '#/risques'),
    ];
    if (nc.length) checks.push(check('warn', 'Cotations incomplètes', `${plural(nc.length, 'risque', 'risques')} sans G, F, P ou M`, '#/risques?prio=nc'));
    if (aVerifier.length) checks.push(check('warn', 'Statuts à vérifier', `${plural(aVerifier.length, 'action', 'actions')} des anciens PAPRIPACT sans réalisation renseignée`, '#/actions?prog=all&statut=a_verifier'));

    /* Matrice danger initial × maîtrise */
    const lignes = [
      { k: 'eleve', l: 'Élevé', d: `≥ ${s.priorite}` },
      { k: 'modere', l: 'Modéré', d: `${s.second} à ${s.priorite}` },
      { k: 'faible', l: 'Faible', d: `< ${s.second}` },
    ];
    const cols = M.MAITRISE;
    const cellCount = (li, m) => R.filter((r) => M.niveauInitial(r, s) === li && r.M === m).length;
    const max = Math.max(1, ...lignes.flatMap((l) => cols.map((c) => cellCount(l.k, c.v))));
    const matrix = `
      <table class="matrix">
        <caption class="sr-only">Nombre de risques selon le danger initial et la maîtrise des mesures</caption>
        <thead><tr><th scope="col"><span class="matrix__axis">Danger initial ↓ · Maîtrise →</span></th>
          ${cols.map((c) => `<th scope="col"><span class="mono">${fmtNum(c.v)}</span><br>${esc(c.court)}</th>`).join('')}</tr></thead>
        <tbody>${lignes.map((l, li) => `<tr><th scope="row">${l.l}<br><span class="mono">${esc(l.d)}</span></th>
          ${cols.map((c, ci) => {
            const n = cellCount(l.k, c.v);
            const zone = li + ci <= 1 ? 'hot' : li + ci <= 3 ? 'mid' : 'cool';
            const a = n ? 0.12 + 0.6 * (n / max) : 0;
            return `<td><a class="matrix__cell matrix__cell--${zone}${n ? '' : ' is-empty'}" style="--a:${a.toFixed(2)}"
              href="#/risques?ini=${l.k}&m=${c.v}" aria-label="${n} risques : danger ${l.l.toLowerCase()}, maîtrise ${c.court.toLowerCase()}">${n || '·'}</a></td>`;
          }).join('')}</tr>`).join('')}
        </tbody>
      </table>
      <p class="matrix__legend">En haut à gauche : dangers importants dont les mesures sont absentes ou insuffisantes. Cliquez une case pour voir les risques.</p>`;

    /* Répartition par unité */
    const parUt = data.unites.map((u) => {
      const rs = R.filter((r) => r.uniteId === u.id);
      const c = { p1: 0, p2: 0, p3: 0, nc: 0 };
      rs.forEach((r) => c[prio(r)]++);
      return { u, n: rs.length, c };
    }).filter((x) => x.n).sort((a, b) => b.c.p1 - a.c.p1 || b.c.p2 - a.c.p2 || b.n - a.n);
    const maxN = Math.max(1, ...parUt.map((x) => x.n));

    /* Priorités */
    const top = p1.slice().sort((a, b) => (M.hasOpenAction(data, a.id) - M.hasOpenAction(data, b.id)) || (M.residuel(b) - M.residuel(a))).slice(0, 8);
    const prochaines = data.actions.filter((a) => M.STATUTS_OUVERTS.includes(a.statut) && a.echeance)
      .sort((a, b) => a.echeance.localeCompare(b.echeance)).slice(0, 6);

    root.innerHTML = `
      <section class="hero">
        <p class="eyebrow">${esc(data.entreprise.raisonSociale || 'Document unique')} · ${esc(fmtDateLong(today))}</p>
        <h1 class="hero__title reveal">
          ${plural(R.length, 'risque évalué', 'risques évalués')} dans ${plural(data.unites.length, 'unité de travail', 'unités de travail')}.
          <span class="hero__second">${p1.length ? `${plural(p1.length, 'est à améliorer', 'sont à améliorer')} en priorité${p1Sans.length ? ` ; ${p1Sans.length} n’${p1Sans.length > 1 ? 'ont' : 'a'} pas encore d’action.` : ', et chacun a une action en cours.'}` : 'Aucun risque n’est en priorité haute.'}</span>
        </h1>
      </section>

      <div class="synth-grid">
        <section class="synth-grid__a" aria-labelledby="h-conf">
          <h2 id="h-conf" class="section-title">Conformité</h2>
          <ul class="check-list">${checks.join('')}</ul>
        </section>
        <section class="synth-grid__b" aria-labelledby="h-mat">
          <h2 id="h-mat" class="section-title">Danger et maîtrise</h2>
          ${matrix}
        </section>
      </div>

      <div class="synth-grid synth-grid--rev">
        <section class="synth-grid__a" aria-labelledby="h-top">
          <h2 id="h-top" class="section-title">À traiter en priorité</h2>
          ${top.length ? `<ol class="top-list">${top.map((r, i) => {
            const acts = M.actionsDuRisque(data, r.id).filter((a) => M.STATUTS_OUVERTS.includes(a.statut));
            return `<li><a href="#/risques?id=${esc(r.id)}" class="top">
              <span class="top__n">${String(i + 1).padStart(2, '0')}</span>
              <span class="top__main"><span class="top__title">${esc(r.situation)}</span>
                <span class="top__meta">${esc(M.uniteNom(data, r.uniteId))} · ${esc(r.famille)} · <span class="mono">N°${esc(r.num)}</span></span></span>
              <span class="top__side"><span class="mono top__score">${fmtNum(M.residuel(r))}</span>
                <span class="top__act">${acts.length ? plural(acts.length, 'action ouverte', 'actions ouvertes') : 'Sans action'}</span></span>
            </a></li>`;
          }).join('')}</ol>
          ${p1.length > top.length ? `<a class="link-quiet" href="#/risques?prio=p1&tri=residuel">Voir les ${p1.length} risques prioritaires</a>` : ''}`
          : '<p class="hint">Aucun risque prioritaire. Les risques « second temps » restent à suivre.</p>'}
        </section>
        <section class="synth-grid__b" aria-labelledby="h-ut">
          <h2 id="h-ut" class="section-title">Par unité de travail</h2>
          <ul class="ut-bars">${parUt.map(({ u, n, c }) => `<li>
            <a href="#/risques?ut=${esc(u.id)}" class="ut-bar">
              <span class="ut-bar__name">${esc(u.nom)}</span>
              <span class="ut-bar__track" style="--w:${(n / maxN * 100).toFixed(1)}%">
                ${['p1', 'p2', 'p3', 'nc'].map((k) => (c[k] ? `<span class="bar__seg bar__seg--${k}" style="flex:${c[k]}"></span>` : '')).join('')}
              </span>
              <span class="ut-bar__num"><strong>${c.p1}</strong> / ${n}</span>
            </a></li>`).join('')}</ul>
          <p class="ut-bars__legend"><span class="key key--p1"></span>Prioritaire <span class="key key--p2"></span>Second temps <span class="key key--p3"></span>Acceptable · chiffre : prioritaires / total</p>
          <h2 class="section-title section-title--sub">Prochaines échéances</h2>
          <ul class="due-list">${prochaines.map((a) => `<li><a href="#/actions?id=${esc(a.id)}">
            <span class="mono">${fmtDate(a.echeance)}</span><span>${esc(a.intitule)}</span>${ui.statut(a, today)}</a></li>`).join('') || '<li class="hint">Aucune échéance datée.</li>'}</ul>
        </section>
      </div>`;
  }

  DU.views = DU.views || {};
  DU.views.synthese = { render, title: 'Synthèse' };
})(window.DU);
