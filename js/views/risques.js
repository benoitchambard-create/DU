/* Écran « Risques » : unités de travail à gauche, inventaire filtrable, fiche en panneau latéral. */
(function (DU) {
  'use strict';
  const { esc, norm, uid, fmtNum, plural, todayISO, confirmDialog, toast, $, $$ } = DU.util;
  const M = DU.model;
  const ui = DU.ui;

  const CHAMPS = {
    uniteId: 'unité', localisation: 'localisation', famille: 'famille', situation: 'situation dangereuse',
    G: 'gravité', F: 'fréquence', P: 'probabilité', mesures: 'mesures existantes', M: 'maîtrise',
    exposes: 'salariés exposés', impactSexe: 'impact F/H',
  };

  const state = { ut: 'all', q: '', famille: '', prio: '', ini: '', m: '', sansAction: false, tri: 'num' };

  function applyParams(params) {
    if (!params || !Object.keys(params).length) return;
    Object.assign(state, { ut: 'all', q: '', famille: '', prio: '', ini: '', m: '', sansAction: false });
    if (params.ut) state.ut = params.ut;
    if (params.prio) state.prio = params.prio;
    if (params.ini) state.ini = params.ini;
    if (params.m) state.m = params.m;
    if (params.famille) state.famille = params.famille;
    if (params.sansAction) state.sansAction = true;
    if (params.tri) state.tri = params.tri;
  }

  function filtered(data) {
    const q = norm(state.q);
    const list = data.risques.filter((r) => {
      if (state.ut !== 'all' && r.uniteId !== state.ut) return false;
      if (state.famille && r.famille !== state.famille) return false;
      if (state.prio && M.priorite(r, data.seuils).key !== state.prio) return false;
      if (state.ini && M.niveauInitial(r, data.seuils) !== state.ini) return false;
      if (state.m && String(r.M) !== String(state.m)) return false;
      if (state.sansAction && M.hasOpenAction(data, r.id)) return false;
      if (q) {
        const hay = norm([r.num, r.situation, r.localisation, r.famille, r.mesures, M.uniteNom(data, r.uniteId)].join(' '));
        if (!q.split(' ').every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const order = new Map(data.unites.map((u, i) => [u.id, i]));
    if (state.tri === 'residuel') list.sort((a, b) => (M.residuel(b) ?? -1) - (M.residuel(a) ?? -1));
    else if (state.tri === 'initial') list.sort((a, b) => (M.initial(b) ?? -1) - (M.initial(a) ?? -1));
    else list.sort((a, b) => (order.get(a.uniteId) ?? 999) - (order.get(b.uniteId) ?? 999) || (a.num || 0) - (b.num || 0));
    return list;
  }

  function counts(data, risques) {
    const c = { p1: 0, p2: 0, p3: 0, nc: 0 };
    risques.forEach((r) => c[M.priorite(r, data.seuils).key]++);
    return c;
  }

  function bar(c, total) {
    if (!total) return '';
    const seg = (k) => (c[k] ? `<span class="bar__seg bar__seg--${k}" style="flex:${c[k]}"></span>` : '');
    return `<span class="bar" aria-hidden="true">${seg('p1')}${seg('p2')}${seg('p3')}${seg('nc')}</span>`;
  }

  function renderSidebar(data) {
    const all = counts(data, data.risques);
    return `
      <nav class="ut-nav" aria-label="Unités de travail">
        <p class="eyebrow">Unités de travail</p>
        <ul>
          <li><a href="#/risques?ut=all" class="ut-nav__item${state.ut === 'all' ? ' is-active' : ''}" data-ut="all">
            <span class="ut-nav__name">Toutes les unités</span><span class="ut-nav__count">${data.risques.length}</span>
            ${bar(all, data.risques.length)}</a></li>
          ${data.unites.map((u) => {
            const rs = data.risques.filter((r) => r.uniteId === u.id);
            const c = counts(data, rs);
            return `<li><a href="#/risques?ut=${esc(u.id)}" class="ut-nav__item${state.ut === u.id ? ' is-active' : ''}" data-ut="${esc(u.id)}"
              aria-label="${esc(u.nom)} : ${rs.length} risques dont ${c.p1} prioritaires">
              <span class="ut-nav__name">${esc(u.nom)}</span><span class="ut-nav__count">${rs.length}</span>${bar(c, rs.length)}</a></li>`;
          }).join('')}
        </ul>
        <a class="link-quiet" href="#/referentiels#unites">Gérer les unités</a>
      </nav>`;
  }

  function renderList(data) {
    const list = filtered(data);
    const today = todayISO();
    const showUt = state.ut === 'all';
    $('#risk-count').textContent = list.length === data.risques.length && state.ut === 'all'
      ? `${plural(list.length, 'risque', 'risques')}`
      : `${plural(list.length, 'risque affiché', 'risques affichés')}`;
    $('#risk-list').innerHTML = list.length ? list.map((r) => {
      const p = M.priorite(r, data.seuils);
      const acts = M.actionsDuRisque(data, r.id);
      const open = acts.filter((a) => M.STATUTS_OUVERTS.includes(a.statut));
      const late = acts.some((a) => M.enRetard(a, today));
      return `<li><button type="button" class="risk risk--${p.key}" data-open="${esc(r.id)}">
        <span class="risk__id"><span class="mono">N°${esc(String(r.num).padStart(3, '0'))}</span>
          <span class="risk__fam">${esc(r.famille || 'Famille non renseignée')}</span></span>
        <span class="risk__main">
          <span class="risk__title">${esc(r.situation || 'Situation dangereuse à décrire')}</span>
          <span class="risk__meta">${showUt ? `${esc(M.uniteNom(data, r.uniteId))}${r.localisation ? ' · ' : ''}` : ''}${esc(r.localisation)}${r.exposes ? ` · ${esc(r.exposes)} exposé(s)` : ''}</span>
        </span>
        <span class="risk__side">
          ${ui.score(r)}
          <span class="risk__badges">${ui.prio(p)}
            <span class="risk__act${late ? ' is-late' : ''}">${open.length ? `${plural(open.length, 'action ouverte', 'actions ouvertes')}${late ? ' · en retard' : ''}` : acts.length ? 'Actions closes' : 'Aucune action'}</span></span>
        </span>
      </button></li>`;
    }).join('') : `<li class="empty"><p>Aucun risque ne correspond à ces filtres.</p>
      <button type="button" class="btn btn--ghost" data-reset>Effacer les filtres</button></li>`;
  }

  function render(_root, params) {
    const root = DU.util.resetRoot();
    const data = DU.store.get();
    applyParams(params);
    if (state.ut !== 'all' && !M.uniteById(data, state.ut)) state.ut = 'all';
    const u = state.ut === 'all' ? null : M.uniteById(data, state.ut);
    const rs = u ? data.risques.filter((r) => r.uniteId === u.id) : data.risques;
    const c = counts(data, rs);
    const noAction = rs.filter((r) => M.priorite(r, data.seuils).key === 'p1' && !M.hasOpenAction(data, r.id)).length;

    root.innerHTML = `
      <div class="split">
        <aside class="split__side">${renderSidebar(data)}</aside>
        <section class="split__main">
          <header class="view-head">
            <p class="eyebrow">Inventaire des risques</p>
            <h1 class="display">${esc(u ? u.nom : 'Toutes les unités')}</h1>
            <p class="lede">${plural(rs.length, 'risque évalué', 'risques évalués')}${u && u.effectif ? ` · effectif ${esc(u.effectif)}` : ''}
              · <strong>${c.p1}</strong> à améliorer en priorité${noAction ? `, dont ${noAction} sans action ouverte` : ''}.</p>
          </header>
          <form class="filters" role="search" onsubmit="return false">
            <label class="field field--grow"><span class="field__label">Rechercher</span>
              <input type="search" name="q" value="${esc(state.q)}" placeholder="N°, situation, mesure, localisation…"></label>
            <label class="field"><span class="field__label">Famille</span>
              <select name="famille">${ui.options(data.familles, state.famille, { empty: 'Toutes' })}</select></label>
            <label class="field"><span class="field__label">Priorité</span>
              <select name="prio">${ui.options(['p1', 'p2', 'p3', 'nc'].map((k) => ({ value: k, label: M.PRIORITES[k].court })), state.prio, { empty: 'Toutes' })}</select></label>
            <label class="field"><span class="field__label">Trier par</span>
              <select name="tri">${ui.options([{ value: 'num', label: 'Numéro' }, { value: 'residuel', label: 'Risque résiduel' }, { value: 'initial', label: 'Risque initial' }], state.tri)}</select></label>
            <label class="check"><input type="checkbox" name="sansAction"${state.sansAction ? ' checked' : ''}> Sans action ouverte</label>
            ${state.ini || state.m ? `<p class="filters__extra">Filtre de la synthèse : ${state.ini ? `danger initial ${esc({ eleve: 'élevé', modere: 'modéré', faible: 'faible' }[state.ini])}` : ''}${state.ini && state.m ? ', ' : ''}${state.m ? `maîtrise ${esc(fmtNum(Number(state.m)))}` : ''}
              <button type="button" class="link-quiet" data-clear-matrix>retirer</button></p>` : ''}
          </form>
          <div class="list-head">
            <p id="risk-count" class="list-head__count" aria-live="polite"></p>
            <button type="button" class="btn btn--cta" data-new>Ajouter un risque</button>
          </div>
          <ol id="risk-list" class="risk-list"></ol>
        </section>
      </div>`;

    renderList(data);

    const form = $('.filters', root);
    form.addEventListener('input', (e) => {
      const el = e.target;
      if (el.name === 'sansAction') state.sansAction = el.checked;
      else state[el.name] = el.value;
      renderList(DU.store.get());
    });
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-open],[data-new],[data-reset],[data-clear-matrix],[data-ut]');
      if (!t) return;
      if (t.dataset.ut) { e.preventDefault(); state.ut = t.dataset.ut; render(null, {}); return; }
      if (t.dataset.open) openRisque(t.dataset.open);
      else if ('new' in t.dataset) openRisque(null, { uniteId: state.ut !== 'all' ? state.ut : '' });
      else if ('reset' in t.dataset || 'clearMatrix' in t.dataset) {
        Object.assign(state, { q: '', famille: '', prio: '', ini: '', m: '', sansAction: false });
        render(null, {});
      }
    });
    if (params && params.id) openRisque(params.id);
  }

  /* ---------- Fiche risque ---------- */
  function seg(name, value) {
    const e = M.ECHELLES[name];
    return `<fieldset class="seg" data-seg="${name}">
      <legend>${esc(e.nom)} <span class="mono">${name}</span></legend>
      <div class="seg__opts">${[1, 2, 3, 4].map((n) => `<label class="seg__opt"><input type="radio" name="${name}" value="${n}" data-num${value === n ? ' checked' : ''}><span>${n}</span></label>`).join('')}</div>
      <p class="seg__desc" data-desc="${name}">${value ? esc(e.niveaux[value]) : 'Non renseigné'}</p>
    </fieldset>`;
  }

  function openRisque(id, preset = {}) {
    const data = DU.store.get();
    const existing = id ? data.risques.find((r) => r.id === id) : null;
    if (id && !existing) { toast('Ce risque n’existe plus.'); return; }
    const r = existing || Object.assign({ id: null, num: M.nextNum(data), uniteId: '', localisation: '', famille: '', situation: '', G: null, F: null, P: null, mesures: '', M: null, exposes: null, impactSexe: '' }, preset);
    const actions = existing ? M.actionsDuRisque(data, r.id) : [];
    const libres = existing ? data.actions.filter((a) => !a.risqueIds.includes(r.id)) : [];
    const today = todayISO();

    ui.openPanel(`
      <form class="sheet" novalidate>
        <header class="sheet__head">
          <p class="eyebrow">${existing ? `Risque <span class="mono">N°${esc(r.num)}</span>` : 'Nouveau risque'}</p>
          <h2 class="sheet__title">${esc(existing ? r.situation || 'Risque sans titre' : 'Décrire une situation dangereuse')}</h2>
          <button type="button" class="sheet__close" data-close aria-label="Fermer la fiche">Fermer</button>
        </header>

        <div class="sheet__body">
          <div class="grid-2">
            <label class="field"><span class="field__label">Unité de travail *</span>
              <select name="uniteId" required>${ui.options(data.unites.map((u) => ({ value: u.id, label: u.nom })), r.uniteId, { empty: 'Choisir…' })}</select></label>
            <label class="field"><span class="field__label">Localisation</span>
              <input name="localisation" value="${esc(r.localisation)}"></label>
            <label class="field"><span class="field__label">Famille de risques</span>
              <select name="famille">${ui.options(data.familles, r.famille, { empty: 'Choisir…' })}</select></label>
            <label class="field"><span class="field__label">Numéro</span>
              <input name="num" value="${esc(r.num)}" inputmode="numeric" data-num class="mono"></label>
          </div>
          <label class="field"><span class="field__label">Situation dangereuse *</span>
            <textarea name="situation" rows="2" required>${esc(r.situation)}</textarea></label>

          <h3 class="sheet__h">Cotation</h3>
          <div class="cotation">${seg('G', r.G)}${seg('F', r.F)}${seg('P', r.P)}</div>
          <p class="calc">Risque initial <output data-out="ini" class="calc__val">${fmtNum(M.initial(r))}</output></p>

          <label class="field"><span class="field__label">Mesures de prévention existantes</span>
            <textarea name="mesures" rows="4">${esc(r.mesures)}</textarea></label>

          <fieldset class="maitrise"><legend>Maîtrise des mesures <span class="mono">M</span></legend>
            ${M.MAITRISE.map((m) => `<label class="maitrise__opt"><input type="radio" name="M" value="${m.v}" data-num${r.M === m.v ? ' checked' : ''}>
              <span class="maitrise__v mono">${fmtNum(m.v)}</span><span><strong>${esc(m.court)}</strong><br><small>${esc(m.label)}</small></span></label>`).join('')}
          </fieldset>
          <p class="calc">Risque résiduel <output data-out="res" class="calc__val">${fmtNum(M.residuel(r))}</output>
            <span data-out="prio">${ui.prio(M.priorite(r, data.seuils))}</span></p>

          <h3 class="sheet__h">Exposition</h3>
          <div class="grid-2">
            <label class="field"><span class="field__label">Salariés exposés</span>
              <input name="exposes" value="${esc(r.exposes ?? '')}" inputmode="numeric" data-num></label>
          </div>
          <label class="field"><span class="field__label">Impact différencié selon le sexe <small>(art. L4121-3)</small></span>
            <textarea name="impactSexe" rows="2" placeholder="Ex. : exposition différente des femmes enceintes, charge physique, équipements inadaptés…">${esc(r.impactSexe)}</textarea></label>

          <h3 class="sheet__h">Actions de prévention</h3>
          ${existing ? `
            <ul class="linked">${actions.map((a) => `<li>
              <a href="#/actions?id=${esc(a.id)}" class="linked__title">${esc(a.intitule)}</a>
              <span class="linked__meta">${esc(a.responsable || 'Sans responsable')} · ${esc(ui.echeance(a))} · ${ui.statut(a, today)}</span>
              <button type="button" class="link-quiet" data-unlink="${esc(a.id)}">Délier</button></li>`).join('') || '<li class="linked__empty">Aucune action liée.</li>'}</ul>
            <div class="inline-form">
              <select data-link-select aria-label="Lier une action existante">${ui.options(libres.map((a) => ({ value: a.id, label: (a.annee ? `[${a.annee}] ` : '') + a.intitule })), '', { empty: 'Lier une action existante…' })}</select>
              <button type="button" class="btn btn--ghost" data-link>Lier</button>
              <button type="button" class="btn btn--ghost" data-new-action>Créer une action</button>
            </div>` : '<p class="hint">Enregistrez d’abord le risque pour lui associer des actions.</p>'}
        </div>

        <footer class="sheet__foot">
          <button type="submit" class="btn btn--cta">${existing ? 'Enregistrer' : 'Ajouter le risque'}</button>
          <button type="button" class="btn btn--ghost" data-close>Annuler</button>
          ${existing ? `<span class="sheet__spacer"></span>
            <button type="button" class="btn btn--ghost" data-duplicate>Dupliquer</button>
            <button type="button" class="btn btn--danger-text" data-delete>Supprimer</button>` : ''}
        </footer>
      </form>`, { bind: (panel) => bindSheet(panel, r, existing) });
  }

  function bindSheet(panel, r, existing) {
    const form = $('form', panel);
    const data = () => DU.store.get();

    const live = () => {
      const v = ui.formValues(form);
      const tmp = { G: v.G ?? null, F: v.F ?? null, P: v.P ?? null, M: v.M ?? null };
      $('[data-out=ini]', form).textContent = fmtNum(M.initial(tmp));
      $('[data-out=res]', form).textContent = fmtNum(M.residuel(tmp));
      $('[data-out=prio]', form).innerHTML = ui.prio(M.priorite(tmp, data().seuils));
      ['G', 'F', 'P'].forEach((k) => {
        $(`[data-desc=${k}]`, form).textContent = tmp[k] ? M.ECHELLES[k].niveaux[tmp[k]] : 'Non renseigné';
      });
    };
    form.addEventListener('change', live);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = ui.formValues(form);
      if (!v.uniteId || !v.situation) {
        toast('L’unité de travail et la situation dangereuse sont obligatoires.', 'warn');
        (v.uniteId ? form.situation : form.uniteId).focus();
        return;
      }
      const fields = { uniteId: v.uniteId, localisation: v.localisation, famille: v.famille, situation: v.situation,
        G: v.G ?? null, F: v.F ?? null, P: v.P ?? null, mesures: v.mesures, M: v.M ?? null,
        exposes: v.exposes ?? null, impactSexe: v.impactSexe, num: v.num || r.num };
      DU.store.commit((d) => {
        const ut = M.uniteNom(d, fields.uniteId);
        if (existing) {
          const cur = d.risques.find((x) => x.id === existing.id);
          const champs = Object.keys(CHAMPS).filter((k) => String(cur[k] ?? '') !== String(fields[k] ?? '')).map((k) => CHAMPS[k]);
          Object.assign(cur, fields);
          return champs.length ? { entity: 'risque', id: cur.id, type: 'modification', ut, libelle: cur.situation, num: cur.num, champs } : null;
        }
        const nr = Object.assign({ id: uid() }, fields);
        d.risques.push(nr);
        r.id = nr.id;
        return { entity: 'risque', id: nr.id, type: 'ajout', ut, libelle: nr.situation, num: nr.num };
      });
      toast(existing ? 'Risque enregistré.' : 'Risque ajouté.', 'ok');
      if (existing) ui.closePanel(); else openRisque(r.id);
    });

    panel.addEventListener('click', async (e) => {
      const t = e.target.closest('button');
      if (!t) return;
      if ('close' in t.dataset) ui.closePanel();
      else if ('delete' in t.dataset) {
        const ok = await confirmDialog(`Supprimer le risque n°${r.num} ? Sa suppression figurera dans la liste des modifications de la prochaine version.`, { title: 'Supprimer ce risque', submitLabel: 'Supprimer' });
        if (!ok) return;
        DU.store.commit((d) => {
          d.risques = d.risques.filter((x) => x.id !== r.id);
          d.actions.forEach((a) => { a.risqueIds = a.risqueIds.filter((x) => x !== r.id); });
          return { entity: 'risque', id: r.id, type: 'suppression', ut: M.uniteNom(d, r.uniteId), libelle: r.situation, num: r.num };
        });
        ui.closePanel();
        toast('Risque supprimé.');
      } else if ('duplicate' in t.dataset) {
        const copy = Object.assign({}, data().risques.find((x) => x.id === r.id));
        delete copy.id;
        copy.num = M.nextNum(data());
        openRisque(null, copy);
      } else if ('link' in t.dataset) {
        const aid = $('[data-link-select]', panel).value;
        if (!aid) return;
        linkAction(aid, r, true);
        openRisque(r.id);
      } else if (t.dataset.unlink) {
        linkAction(t.dataset.unlink, r, false);
        openRisque(r.id);
      } else if ('newAction' in t.dataset) {
        DU.views.actions.openAction(null, { risqueIds: [r.id], responsable: '', annee: null });
      }
    });
  }

  function linkAction(aid, r, on) {
    DU.store.commit((d) => {
      const a = d.actions.find((x) => x.id === aid);
      if (!a) return null;
      a.risqueIds = on ? Array.from(new Set([...a.risqueIds, r.id])) : a.risqueIds.filter((x) => x !== r.id);
      return { entity: 'risque', id: r.id, type: 'modification', ut: M.uniteNom(d, r.uniteId), libelle: r.situation, num: r.num, champs: ['actions'] };
    });
  }

  DU.views = DU.views || {};
  DU.views.risques = { render, openRisque, title: 'Risques' };
})(window.DU);
