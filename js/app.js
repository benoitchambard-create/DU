/* Démarrage, navigation par ancre (#/vue?param=…), état d'enregistrement, actions sur fichiers. */
(function (DU) {
  'use strict';
  const { esc, $, $$, plural, openDialog, confirmDialog, toast, todayISO, uid } = DU.util;

  const NAV = [
    { route: 'synthese', label: 'Synthèse' },
    { route: 'risques', label: 'Risques' },
    { route: 'actions', label: 'Plan d’actions' },
    { route: 'penibilite', label: 'Pénibilité' },
    { route: 'versions', label: 'Versions' },
    { route: 'extractions', label: 'Extractions' },
    { route: 'referentiels', label: 'Référentiels' },
  ];

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [pathAndQuery, anchor] = raw.split('#');
    const [name, query] = (pathAndQuery || '').split('?');
    const params = Object.fromEntries(new URLSearchParams(query || ''));
    if (anchor) params.anchor = anchor;
    return { name: name || 'synthese', params };
  }

  let current = null;

  function route() {
    const data = DU.store.get();
    let { name, params } = parseHash();
    if (!data) name = 'accueil';
    else if (!DU.views[name] || name === 'accueil') name = 'synthese';
    current = name;
    DU.ui.closePanel();
    renderNav();
    const view = DU.views[name];
    document.title = `${view.title} · Document unique`;
    view.render(null, params);
    window.scrollTo(0, 0);
    const h1 = $('#view-root h1');
    if (h1 && document.activeElement === document.body) { h1.setAttribute('tabindex', '-1'); }
  }

  /** Réaffiche la vue courante après une modification, en conservant défilement et focus. */
  function refresh() {
    if (!current || current === 'accueil') return route();
    const root = $('#view-root');
    const a = document.activeElement;
    let sel = null;
    if (a && root.contains(a)) {
      const attrs = ['data-u', 'data-k', 'data-ut', 'data-f', 'data-path', 'data-fam', 'data-act', 'data-info', 'name'];
      sel = attrs.filter((x) => a.hasAttribute(x)).map((x) => `[${x}="${CSS.escape(a.getAttribute(x))}"]`).join('');
      if (sel) sel = a.tagName.toLowerCase() + sel;
    }
    const y = window.scrollY;
    DU.views[current].render(null, {});
    renderNav();
    window.scrollTo(0, y);
    if (sel) {
      const el = $('#view-root ' + sel);
      if (el) { el.focus({ preventScroll: true }); if (el.select && el.tagName === 'INPUT' && el.type !== 'search') el.select(); }
    }
  }

  function renderNav() {
    const data = DU.store.get();
    const nav = $('#main-nav');
    const brand = $('#brand-sub');
    const logoWrap = $('#brand-logo');
    const logo = data && data.entreprise.logo;
    logoWrap.hidden = !logo;
    logoWrap.innerHTML = logo ? `<img class="brand__logo" src="${logo.src}" alt="${esc(data.entreprise.raisonSociale || 'Logo de l’entreprise')}">` : '';
    $('#favicon').href = logo ? logo.src : 'data:,';
    if (!data) { nav.innerHTML = ''; brand.textContent = ''; return; }
    brand.textContent = logo ? 'Évaluation des risques' : data.entreprise.raisonSociale || '';
    nav.innerHTML = `<ul>${NAV.map((n) => `<li><a href="#/${n.route}" class="nav__link"${current === n.route ? ' aria-current="page"' : ''}>${esc(n.label)}${
      n.route === 'versions' && data.journal.length ? ` <span class="nav__badge" aria-label="${plural(data.journal.length, 'modification non publiée', 'modifications non publiées')}">${data.journal.length}</span>` : ''}</a></li>`).join('')}</ul>`;
  }

  function renderStatus(st) {
    const el = $('#save-status');
    if (!el) return;
    const time = st.lastSaved ? st.lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    if (!DU.store.get()) { el.innerHTML = ''; return; }
    let html;
    if (st.state === 'error') html = `<span class="status status--error">${esc(st.message || 'Échec de l’enregistrement')}</span>`;
    else if (st.state === 'saving') html = '<span class="status status--saving">Enregistrement…</span>';
    else if (st.fileName && st.filePermission === 'granted') html = `<span class="status status--ok">Enregistré dans <span class="mono">${esc(st.fileName)}</span>${time ? ` · <span class="mono">${time}</span>` : ''}</span>`;
    else if (st.fileName) html = `<button type="button" class="btn btn--small btn--cta" data-file="reconnect">Réautoriser l’accès à ${esc(st.fileName)}</button>`;
    else html = `<span class="status status--local">Copie dans le navigateur${time ? ` · <span class="mono">${time}</span>` : ''}</span>${DU.store.supportsFS ? ' <button type="button" class="btn btn--small btn--ghost" data-file="link">Lier un fichier</button>' : ''}`;
    el.innerHTML = html;
  }

  /* ---------- Fichiers ---------- */
  async function importExcel() {
    let file;
    try { file = await DU.store.pickFile('.xlsx,.xlsm'); } catch (e) { return; }
    if (DU.store.get()) {
      const ok = await confirmDialog('Les données actuelles de ce navigateur seront remplacées par le contenu du fichier Excel. Pensez à télécharger une sauvegarde avant si besoin.', { title: 'Remplacer les données ?', submitLabel: 'Remplacer' });
      if (!ok) return;
    }
    const busy = $('#busy');
    busy.hidden = false;
    try {
      const { data, rapport } = await DU.importExcel.importWorkbook(await file.arrayBuffer());
      DU.store.replace(data);
      location.hash = '#/synthese';
      route();
      const v = data.versions[0];
      const res = await openDialog({
        title: 'Import terminé',
        submitLabel: DU.store.supportsFS ? 'Choisir où enregistrer duerp.json' : 'Continuer',
        cancelLabel: DU.store.supportsFS ? 'Plus tard' : '',
        body: `<ul class="report">
          <li><strong>${rapport.risques}</strong> risques dans <strong>${rapport.unites}</strong> unités de travail</li>
          <li><strong>${rapport.actions}</strong> actions issues de l’inventaire (lignes identiques regroupées)</li>
          <li><strong>${rapport.papripact}</strong> actions des onglets PAPRIPACT</li>
          <li>Version <strong>${esc(v.indice || '—')}</strong> du ${esc(DU.util.fmtDate(v.date))} archivée avec ${plural(v.modifications.length, 'modification', 'modifications')}</li>
          <li class="hint">${rapport.lignesIgnorees} lignes vides ignorées.</li>
          ${rapport.avertissements.map((a) => `<li class="hint">${esc(a)}</li>`).join('')}
        </ul>
        ${DU.store.supportsFS ? '<p>Choisissez maintenant un emplacement (poste ou disque réseau sauvegardé) : chaque modification y sera enregistrée automatiquement.</p>' : '<p>Votre navigateur ne permet pas l’enregistrement automatique dans un fichier : téléchargez régulièrement une sauvegarde depuis « Extractions ».</p>'}`,
      });
      if (res && DU.store.supportsFS) await linkFile();
    } catch (e) {
      console.error(e);
      openDialog({ title: 'Import impossible', body: `<p>${esc(e.message || 'Le fichier n’a pas pu être lu.')}</p>`, submitLabel: 'Fermer', cancelLabel: '' });
    } finally {
      busy.hidden = true;
    }
  }

  async function linkFile() {
    try { await DU.store.linkFile(); toast('Les modifications seront enregistrées dans ce fichier.', 'ok'); } catch (e) {
      if (e.name !== 'AbortError') toast('Impossible d’utiliser ce fichier.', 'warn');
    }
  }

  async function fileAction(kind) {
    try {
      if (kind === 'excel') return importExcel();
      if (kind === 'link') return linkFile();
      if (kind === 'reconnect') return DU.store.reconnect();
      if (kind === 'open') {
        if (DU.store.get() && !(await confirmDialog('Les données actuelles seront remplacées par celles du fichier ouvert.', { title: 'Ouvrir un autre fichier ?', submitLabel: 'Ouvrir' }))) return;
        await DU.store.openFile();
        location.hash = '#/synthese';
        route();
        toast('Document ouvert.', 'ok');
        return;
      }
      if (kind === 'blank') {
        const res = await openDialog({
          title: 'Nouveau document unique',
          submitLabel: 'Créer',
          body: `<label class="field"><span class="field__label">Raison sociale</span><input name="rs" required></label>
            <label class="field"><span class="field__label">Effectif</span><input name="eff" inputmode="numeric" data-num></label>`,
          onSubmit: (f) => DU.ui.formValues(f),
        });
        if (!res) return;
        const d = DU.model.emptyData();
        d.entreprise.raisonSociale = res.rs;
        d.entreprise.effectif = res.eff;
        d.document.dateCreation = todayISO();
        d.unites.push({ id: uid(), nom: 'Ensemble de l’entreprise', effectif: res.eff, penibilite: {} });
        DU.store.replace(d);
        location.hash = '#/referentiels#unites';
        route();
        return;
      }
      if (kind === 'reset') {
        const ok = await confirmDialog('Toutes les données enregistrées dans ce navigateur seront effacées. Le fichier duerp.json lié n’est pas supprimé.', { title: 'Effacer les données du navigateur', submitLabel: 'Effacer' });
        if (!ok) return;
        await DU.store.reset();
        route();
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error(e);
      toast(e.message === 'format' ? 'Ce fichier n’est pas un document unique valide.' : 'L’opération a échoué.', 'warn');
    }
  }

  /* ---------- Démarrage ---------- */
  async function start() {
    document.documentElement.classList.add('js');
    DU.store.onStatus(renderStatus);
    await DU.store.init();
    // Rafraîchissement différé : laisse le focus atteindre le champ suivant (Tab) avant de réafficher
    let pending = false;
    DU.store.subscribe(() => {
      if (pending) return;
      pending = true;
      setTimeout(() => { pending = false; refresh(); renderStatus(DU.store.status); }, 0);
    });
    window.addEventListener('hashchange', route);
    document.addEventListener('click', (e) => {
      const b = e.target.closest('#save-status [data-file]');
      if (b) fileAction(b.dataset.file);
    });
    route();
    renderStatus(DU.store.status);
  }

  DU.app = { start, fileAction, refresh };
  document.addEventListener('DOMContentLoaded', start);
})(window.DU);
