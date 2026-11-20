/* Écran « Plan d'actions » : PAPRIPACT par année et actions hors programme. */
(function (DU) {
  'use strict';
  const { esc, norm, uid, fmtNum, plural, todayISO, confirmDialog, toast, $ } = DU.util;
  const M = DU.model;
  const ui = DU.ui;

  const CHAMPS = {
    intitule: 'intitulé', objectif: 'objectif', indicateur: 'indicateur', conditions: 'conditions d’exécution',
    responsable: 'responsable', annee: 'programme', echeance: 'échéance', echeanceTexte: 'échéance', budget: 'budget',
    statut: 'statut', realisation: 'réalisation',
  };

  const state = { prog: null, statut: '', q: '' };

  const annees = (data) => [...new Set(data.actions.map((a) => a.annee).filter(Boolean))].sort((a, b) => b - a);

  function defaultProg(data) {
    const y = new Date().getFullYear();
    const ys = annees(data);
    return ys.includes(y) ? String(y) : ys.length ? String(ys[0]) : 'all';
  }

  function filtered(data) {
    const q = norm(state.q);
    return data.actions.filter((a) => {
      if (state.prog === 'hors' && a.annee) return false;
      if (state.prog !== 'all' && state.prog !== 'hors' && String(a.annee) !== state.prog) return false;
      if (state.statut === 'ouvertes' && !M.STATUTS_OUVERTS.includes(a.statut)) return false;
      if (state.statut === 'retard' && !M.enRetard(a, todayISO())) return false;
      if (state.statut && !['ouvertes', 'retard'].includes(state.statut) && a.statut !== state.statut) return false;
      if (q && !norm([a.intitule, a.objectif, a.responsable, a.realisation].join(' ')).includes(q)) return false;
      return true;
    }).sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999'));
  }

  function render(_root, params) {
    const root = DU.util.resetRoot();
    const data = DU.store.get();
    if (params && params.prog) state.prog = params.prog;
    if (params && params.statut) state.statut = params.statut;
    if (!state.prog) state.prog = defaultProg(data);
    const ys = annees(data);
    const hors = data.actions.filter((a) => !a.annee);
    const list = filtered(data);
    const today = todayISO();
    const budget = list.reduce((s, a) => s + (typeof a.budget === 'number' ? a.budget : 0), 0);
    const faites = list.filter((a) => a.statut === 'realisee').length;
    const isYear = !['all', 'hors'].includes(state.prog);

    const progItem = (key, label, n) => `<li><a href="#/actions?prog=${key}" data-prog="${key}" class="ut-nav__item${state.prog === key ? ' is-active' : ''}">
      <span class="ut-nav__name">${label}</span><span class="ut-nav__count">${n}</span></a></li>`;

    root.innerHTML = `
      <div class="split">
        <aside class="split__side">
          <nav class="ut-nav" aria-label="Programmes">
            <p class="eyebrow">Programmes</p>
            <ul>
              ${progItem('all', 'Toutes les actions', data.actions.length)}
              ${ys.map((y) => progItem(String(y), `PAPRIPACT ${y}`, data.actions.filter((a) => a.annee === y).length)).join('')}
              ${progItem('hors', 'Hors programme', hors.length)}
            </ul>
          </nav>
        </aside>
        <section class="split__main">
          <header class="view-head">
            <p class="eyebrow">Plan d’actions</p>
            <h1 class="display">${isYear ? `PAPRIPACT ${esc(state.prog)}` : state.prog === 'hors' ? 'Hors programme' : 'Toutes les actions'}</h1>
            <p class="lede">${isYear ? 'Programme annuel de prévention des risques professionnels et d’amélioration des conditions de travail. ' : ''}
              ${plural(list.length, 'action', 'actions')}, <strong>${faites}</strong> réalisée${faites > 1 ? 's' : ''}${budget ? ` · budget chiffré <span class="mono">${fmtNum(budget, 0)} €</span>` : ''}.</p>
          </header>
          <form class="filters" role="search" onsubmit="return false">
            <label class="field field--grow"><span class="field__label">Rechercher</span>
              <input type="search" name="q" value="${esc(state.q)}" placeholder="Action, objectif, responsable…"></label>
            <label class="field"><span class="field__label">Statut</span>
              <select name="statut">${ui.options([{ value: 'ouvertes', label: 'Ouvertes' }, { value: 'retard', label: 'En retard' }, ...M.STATUTS.map((s) => ({ value: s.key, label: s.label }))], state.statut, { empty: 'Tous' })}</select></label>
          </form>
          <div class="list-head">
            <p class="list-head__count" aria-live="polite">${plural(list.length, 'action affichée', 'actions affichées')}</p>
            <button type="button" class="btn btn--cta" data-new>Nouvelle action</button>
          </div>
          <ol class="action-list">
            ${list.map((a) => `<li><button type="button" class="action" data-open="${esc(a.id)}">
              <span class="action__main">
                <span class="action__title">${esc(a.intitule)}</span>
                ${a.objectif ? `<span class="action__obj">${esc(a.objectif)}</span>` : ''}
              </span>
              <span class="action__meta">
                <span><span class="k">Responsable</span>${esc(a.responsable || '—')}</span>
                <span><span class="k">Échéance</span>${esc(ui.echeance(a))}</span>
                ${a.budget !== '' && a.budget !== null ? `<span><span class="k">Budget</span><span class="mono">${esc(ui.budget(a.budget))}</span></span>` : ''}
                <span><span class="k">Risques liés</span>${a.risqueIds.length}</span>
                ${!isYear ? `<span><span class="k">Programme</span>${a.annee ? `PAPRIPACT ${a.annee}` : 'Hors programme'}</span>` : ''}
              </span>
              <span class="action__status">${ui.statut(a, today)}</span>
            </button></li>`).join('') || '<li class="empty"><p>Aucune action ici pour le moment.</p></li>'}
          </ol>
        </section>
      </div>`;

    $('.filters', root).addEventListener('input', (e) => {
      state[e.target.name] = e.target.value;
      if (e.target.name === 'q') {
        clearTimeout(render.t);
        render.t = setTimeout(() => { render(null, {}); const i = $('#view-root input[name=q]'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 200);
      } else render(null, {});
    });
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-open],[data-new],[data-prog]');
      if (!t) return;
      if (t.dataset.prog) { e.preventDefault(); state.prog = t.dataset.prog; render(null, {}); return; }
      if (t.dataset.open) openAction(t.dataset.open);
      else openAction(null, { annee: isYear ? Number(state.prog) : null });
    });
    if (params && params.id) openAction(params.id);
  }

  /* ---------- Fiche action ---------- */
  function openAction(id, preset = {}) {
    const data = DU.store.get();
    const existing = id ? data.actions.find((a) => a.id === id) : null;
    if (id && !existing) { toast('Cette action n’existe plus.'); return; }
    const a = existing || Object.assign({ id: null, intitule: '', objectif: '', indicateur: '', conditions: '', responsable: '', annee: null, echeance: '', echeanceTexte: '', budget: '', statut: 'a_lancer', realisation: '', risqueIds: [] }, preset);
    const linked = data.risques.filter((r) => a.risqueIds.includes(r.id));
    const y = new Date().getFullYear();
    const years = Array.from(new Set([...annees(data), y - 1, y, y + 1, y + 2, a.annee].filter(Boolean))).sort((p, q) => q - p);

    ui.openPanel(`
      <form class="sheet" novalidate>
        <header class="sheet__head">
          <p class="eyebrow">${existing ? 'Action de prévention' : 'Nouvelle action de prévention'}</p>
          <h2 class="sheet__title">${esc(a.intitule || 'Définir une action')}</h2>
          <button type="button" class="sheet__close" data-close aria-label="Fermer la fiche">Fermer</button>
        </header>
        <div class="sheet__body">
          <label class="field"><span class="field__label">Action de prévention *</span>
            <textarea name="intitule" rows="2" required>${esc(a.intitule)}</textarea></label>
          <label class="field"><span class="field__label">Objectif</span>
            <textarea name="objectif" rows="2">${esc(a.objectif)}</textarea></label>
          <div class="grid-2">
            <label class="field"><span class="field__label">Programme</span>
              <select name="annee" data-num>${ui.options(years.map((v) => ({ value: v, label: `PAPRIPACT ${v}` })), a.annee, { empty: 'Hors programme' })}</select></label>
            <label class="field"><span class="field__label">Responsable</span>
              <input name="responsable" value="${esc(a.responsable)}" list="acteurs-list">
              <datalist id="acteurs-list">${data.acteurs.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label>
            <label class="field"><span class="field__label">Échéance</span>
              <input type="date" name="echeance" value="${esc(a.echeance)}"></label>
            <label class="field"><span class="field__label">ou échéance en texte</span>
              <input name="echeanceTexte" value="${esc(a.echeanceTexte)}" placeholder="Ex. : 2025 → 2027"></label>
            <label class="field"><span class="field__label">Budget (€)</span>
              <input name="budget" value="${esc(a.budget)}" inputmode="decimal" placeholder="Montant ou « Organisationnel »"></label>
            <label class="field"><span class="field__label">Statut</span>
              <select name="statut">${ui.options(M.STATUTS.map((s) => ({ value: s.key, label: s.label })), a.statut)}</select></label>
          </div>
          <label class="field"><span class="field__label">Indicateur de résultat <small>(art. L2312-27)</small></span>
            <input name="indicateur" value="${esc(a.indicateur)}" placeholder="Ex. : nombre de manutentions supprimées par poste"></label>
          <label class="field"><span class="field__label">Conditions d’exécution</span>
            <textarea name="conditions" rows="2" placeholder="Moyens, étapes, prestataire…">${esc(a.conditions)}</textarea></label>
          <label class="field"><span class="field__label">Réalisation effective</span>
            <textarea name="realisation" rows="2">${esc(a.realisation)}</textarea></label>

          <h3 class="sheet__h">Risques concernés</h3>
          <ul class="linked">${linked.map((r) => `<li>
            <a href="#/risques?id=${esc(r.id)}" class="linked__title"><span class="mono">N°${esc(r.num)}</span> ${esc(r.situation)}</a>
            <span class="linked__meta">${esc(M.uniteNom(data, r.uniteId))} · ${ui.prio(M.priorite(r, data.seuils))}</span>
            <button type="button" class="link-quiet" data-unlink="${esc(r.id)}">Retirer</button></li>`).join('') || '<li class="linked__empty">Aucun risque lié.</li>'}</ul>
          <label class="field"><span class="field__label">Lier un risque (numéro ou mots-clés)</span>
            <input type="search" data-risk-search autocomplete="off" placeholder="Ex. : 226 ou « manutention pétrin »"></label>
          <ul class="suggest" data-suggest></ul>
        </div>
        <footer class="sheet__foot">
          <button type="submit" class="btn btn--cta">${existing ? 'Enregistrer' : 'Créer l’action'}</button>
          <button type="button" class="btn btn--ghost" data-close>Annuler</button>
          ${existing ? '<span class="sheet__spacer"></span><button type="button" class="btn btn--danger-text" data-delete>Supprimer</button>' : ''}
        </footer>
      </form>`, { bind: (panel) => bindSheet(panel, a, existing) });
  }

  function bindSheet(panel, a, existing) {
    const form = $('form', panel);
    const risqueIds = a.risqueIds.slice();

    const journalFor = (d, ids, champ) => ids.map((rid) => {
      const r = d.risques.find((x) => x.id === rid);
      return r ? { entity: 'risque', id: r.id, type: 'modification', ut: M.uniteNom(d, r.uniteId), libelle: r.situation, num: r.num, champs: [champ] } : null;
    }).filter(Boolean);

    const values = () => {
      const v = ui.formValues(form);
      const b = String(v.budget || '').replace(/\s|€/g, '').replace(',', '.');
      v.budget = b !== '' && !isNaN(Number(b)) ? Number(b) : v.budget;
      return v;
    };

    const save = (close) => {
      const v = values();
      if (!v.intitule) { toast('L’intitulé de l’action est obligatoire.', 'warn'); form.intitule.focus(); return false; }
      const fields = { intitule: v.intitule, objectif: v.objectif, indicateur: v.indicateur, conditions: v.conditions,
        responsable: v.responsable, annee: v.annee ?? null, echeance: v.echeance, echeanceTexte: v.echeanceTexte,
        budget: v.budget, statut: v.statut, realisation: v.realisation, risqueIds: risqueIds.slice() };
      DU.store.commit((d) => {
        if (existing) {
          const cur = d.actions.find((x) => x.id === existing.id);
          const champs = Object.keys(CHAMPS).filter((k) => String(cur[k] ?? '') !== String(fields[k] ?? '')).map((k) => CHAMPS[k]);
          const before = cur.risqueIds;
          Object.assign(cur, fields);
          const changedRisks = [...fields.risqueIds.filter((x) => !before.includes(x)), ...before.filter((x) => !fields.risqueIds.includes(x))];
          return [
            champs.length ? { entity: 'action', id: cur.id, type: 'modification', ut: 'Plan d’actions', libelle: cur.intitule, champs: Array.from(new Set(champs)) } : null,
            ...journalFor(d, changedRisks, 'actions'),
          ].filter(Boolean);
        }
        const na = Object.assign({ id: uid() }, fields);
        d.actions.push(na);
        a.id = na.id;
        return [{ entity: 'action', id: na.id, type: 'ajout', ut: 'Plan d’actions', libelle: na.intitule }, ...journalFor(d, na.risqueIds, 'actions')];
      });
      toast(existing ? 'Action enregistrée.' : 'Action créée.', 'ok');
      if (close) ui.closePanel();
      return true;
    };

    form.addEventListener('submit', (e) => { e.preventDefault(); save(true); });

    const search = $('[data-risk-search]', panel);
    const suggest = $('[data-suggest]', panel);
    search.addEventListener('input', () => {
      const d = DU.store.get();
      const q = norm(search.value);
      if (!q) { suggest.innerHTML = ''; return; }
      const res = d.risques.filter((r) => !risqueIds.includes(r.id) &&
        (String(r.num) === q || q.split(' ').every((w) => norm([r.situation, r.famille, M.uniteNom(d, r.uniteId)].join(' ')).includes(w)))).slice(0, 8);
      suggest.innerHTML = res.map((r) => `<li><button type="button" data-add-risk="${esc(r.id)}"><span class="mono">N°${esc(r.num)}</span> ${esc(r.situation)} <small>· ${esc(M.uniteNom(d, r.uniteId))}</small></button></li>`).join('') || '<li class="hint">Aucun risque trouvé.</li>';
    });

    const relist = () => {
      const d = DU.store.get();
      $('.linked', panel).innerHTML = d.risques.filter((r) => risqueIds.includes(r.id)).map((r) => `<li>
        <span class="linked__title"><span class="mono">N°${esc(r.num)}</span> ${esc(r.situation)}</span>
        <span class="linked__meta">${esc(M.uniteNom(d, r.uniteId))} · ${ui.prio(M.priorite(r, d.seuils))}</span>
        <button type="button" class="link-quiet" data-unlink="${esc(r.id)}">Retirer</button></li>`).join('') || '<li class="linked__empty">Aucun risque lié.</li>';
    };

    panel.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if ('close' in t.dataset) ui.closePanel();
      else if (t.dataset.addRisk) { risqueIds.push(t.dataset.addRisk); search.value = ''; suggest.innerHTML = ''; relist(); search.focus(); }
      else if (t.dataset.unlink) { risqueIds.splice(risqueIds.indexOf(t.dataset.unlink), 1); relist(); }
      else if ('delete' in t.dataset) {
        const ok = await confirmDialog('Supprimer cette action ? Elle disparaîtra du plan d’actions et des risques liés.', { title: 'Supprimer l’action', submitLabel: 'Supprimer' });
        if (!ok) return;
        DU.store.commit((d) => {
          const cur = d.actions.find((x) => x.id === a.id);
          d.actions = d.actions.filter((x) => x.id !== a.id);
          return [{ entity: 'action', id: a.id, type: 'suppression', ut: 'Plan d’actions', libelle: cur ? cur.intitule : a.intitule }, ...journalFor(d, cur ? cur.risqueIds : [], 'actions')];
        });
        ui.closePanel();
        toast('Action supprimée.');
      }
    });
  }

  DU.views = DU.views || {};
  DU.views.actions = { render, openAction, title: 'Plan d’actions' };
})(window.DU);
