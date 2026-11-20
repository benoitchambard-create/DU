/* Écran « Référentiels » : entreprise, document, unités, familles, acteurs, seuils, fichier. */
(function (DU) {
  'use strict';
  const { esc, uid, plural, openDialog, confirmDialog, toast, $ } = DU.util;
  const M = DU.model;
  const ui = DU.ui;

  function render(_root, params) {
    const root = DU.util.resetRoot();
    const data = DU.store.get();
    const st = DU.store.status;
    const countUt = (id) => data.risques.filter((r) => r.uniteId === id).length;
    const countFam = (f) => data.risques.filter((r) => r.famille === f).length;

    root.innerHTML = `
      <div class="split">
        <aside class="split__side">
          <nav class="ut-nav toc" aria-label="Sections">
            <p class="eyebrow">Référentiels</p>
            <ul>
              <li><a href="#/referentiels#entreprise" data-jump="entreprise" class="ut-nav__item">Entreprise</a></li>
              <li><a href="#/referentiels#unites" data-jump="unites" class="ut-nav__item">Unités de travail</a></li>
              <li><a href="#/referentiels#familles" data-jump="familles" class="ut-nav__item">Familles de risques</a></li>
              <li><a href="#/referentiels#acteurs" data-jump="acteurs" class="ut-nav__item">Acteurs</a></li>
              <li><a href="#/referentiels#cotation" data-jump="cotation" class="ut-nav__item">Cotation et seuils</a></li>
              <li><a href="#/referentiels#fichier" data-jump="fichier" class="ut-nav__item">Fichier et sauvegarde</a></li>
            </ul>
          </nav>
        </aside>
        <section class="split__main ref">
          <header class="view-head"><p class="eyebrow">Paramètres du document</p><h1 class="display">Référentiels</h1></header>

          <section id="entreprise" class="ref__block">
            <h2 class="section-title">Entreprise et document</h2>
            <div class="grid-2" data-scope="doc">
              <label class="field"><span class="field__label">Raison sociale</span><input data-path="entreprise.raisonSociale" value="${esc(data.entreprise.raisonSociale)}"></label>
              <label class="field"><span class="field__label">Effectif total</span><input data-path="entreprise.effectif" data-num inputmode="numeric" value="${esc(data.entreprise.effectif ?? '')}"></label>
              <label class="field"><span class="field__label">Code du document</span><input data-path="document.code" class="mono" value="${esc(data.document.code)}"></label>
              <label class="field"><span class="field__label">Indice de la version publiée</span><input data-path="document.indice" class="mono" value="${esc(data.document.indice)}"></label>
              <label class="field"><span class="field__label">Rédacteur</span><input data-path="document.redacteur" value="${esc(data.document.redacteur)}"></label>
              <label class="field"><span class="field__label">Vérificateur</span><input data-path="document.verificateur" value="${esc(data.document.verificateur)}"></label>
            </div>
            <h3 class="sheet__h">Logo</h3>
            <div class="logo-field">
              <div class="logo-field__preview">${data.entreprise.logo ? `<img src="${data.entreprise.logo.src}" alt="Logo actuel">` : '<span class="hint">Aucun logo</span>'}</div>
              <div>
                <p class="hint">Affiché dans l’en-tête de chaque écran, sur les documents PDF et dans les exports Excel. Un fond blanc est rendu transparent automatiquement.</p>
                <div class="btn-row">
                  <button type="button" class="btn btn--ghost" data-logo="pick">${data.entreprise.logo ? 'Remplacer le logo' : 'Choisir un logo'}</button>
                  ${data.entreprise.logo ? '<button type="button" class="btn btn--danger-text" data-logo="remove">Retirer</button>' : ''}
                </div>
              </div>
            </div>
            <h3 class="sheet__h">Informations de présentation</h3>
            <ul class="kv-list">${data.entreprise.infos.map((i, n) => `<li>
              <input data-info="${n}" data-f="label" value="${esc(i.label)}" aria-label="Intitulé">
              <input data-info="${n}" data-f="value" value="${esc(i.value)}" aria-label="Valeur">
              <button type="button" class="link-quiet" data-del-info="${n}">Retirer</button></li>`).join('')}</ul>
            <button type="button" class="btn btn--ghost" data-add-info>Ajouter une information</button>
          </section>

          <section id="unites" class="ref__block">
            <h2 class="section-title">Unités de travail</h2>
            <p class="hint">Une unité de travail regroupe des situations d’exposition homogènes : poste, métier, atelier ou activité.</p>
            <table class="data-table data-table--edit">
              <thead><tr><th>Nom</th><th>Effectif</th><th>Risques</th><th><span class="sr-only">Actions</span></th></tr></thead>
              <tbody>${data.unites.map((u) => `<tr>
                <td><input data-ut="${esc(u.id)}" data-f="nom" value="${esc(u.nom)}" aria-label="Nom de l’unité"></td>
                <td><input data-ut="${esc(u.id)}" data-f="effectif" data-num inputmode="numeric" class="mono input--s" value="${esc(u.effectif ?? '')}" aria-label="Effectif de ${esc(u.nom)}"></td>
                <td class="mono">${countUt(u.id)}</td>
                <td class="t-right"><button type="button" class="link-quiet" data-up="${esc(u.id)}" aria-label="Monter ${esc(u.nom)}">↑</button>
                  <button type="button" class="link-quiet" data-del-ut="${esc(u.id)}">Supprimer</button></td></tr>`).join('')}</tbody>
            </table>
            <form class="inline-form" data-add="unite"><input name="nom" placeholder="Nom de la nouvelle unité" required aria-label="Nom de la nouvelle unité"><button class="btn btn--ghost">Ajouter l’unité</button></form>
          </section>

          <section id="familles" class="ref__block">
            <h2 class="section-title">Familles de risques</h2>
            <ul class="chip-list">${data.familles.map((f, n) => `<li>
              <input data-fam="${n}" value="${esc(f)}" aria-label="Famille de risques">
              <span class="mono chip-list__n" title="Risques concernés">${countFam(f)}</span>
              <button type="button" class="link-quiet" data-del-fam="${n}" aria-label="Supprimer ${esc(f)}">×</button></li>`).join('')}</ul>
            <form class="inline-form" data-add="famille"><input name="nom" placeholder="Nouvelle famille" required aria-label="Nouvelle famille"><button class="btn btn--ghost">Ajouter</button></form>
          </section>

          <section id="acteurs" class="ref__block">
            <h2 class="section-title">Acteurs</h2>
            <p class="hint">Proposés comme responsables dans les fiches action.</p>
            <ul class="chip-list">${data.acteurs.map((a, n) => `<li>
              <input data-act="${n}" value="${esc(a)}" aria-label="Acteur">
              <button type="button" class="link-quiet" data-del-act="${n}" aria-label="Supprimer ${esc(a)}">×</button></li>`).join('')}</ul>
            <form class="inline-form" data-add="acteur"><input name="nom" placeholder="Nom de l’acteur" required aria-label="Nom de l’acteur"><button class="btn btn--ghost">Ajouter</button></form>
          </section>

          <section id="cotation" class="ref__block">
            <h2 class="section-title">Cotation et seuils</h2>
            <p>Risque initial = <strong>G × F × P</strong> · risque résiduel = initial × <strong>M</strong>.</p>
            <div class="grid-2">
              <label class="field"><span class="field__label">« Améliorer en priorité » à partir de</span><input data-path="seuils.priorite" data-num class="mono" value="${esc(data.seuils.priorite)}"></label>
              <label class="field"><span class="field__label">« Second temps » à partir de</span><input data-path="seuils.second" data-num class="mono" value="${esc(data.seuils.second)}"></label>
            </div>
            <div class="scales">${['G', 'F', 'P'].map((k) => `<div><h3 class="sheet__h">${esc(M.ECHELLES[k].nom)} (${k})</h3><ol>${Object.values(M.ECHELLES[k].niveaux).map((l) => `<li>${esc(l)}</li>`).join('')}</ol></div>`).join('')}
              <div><h3 class="sheet__h">Maîtrise (M)</h3><ul>${M.MAITRISE.map((m) => `<li><span class="mono">${m.v}</span> — ${esc(m.label)}</li>`).join('')}</ul></div></div>
          </section>

          <section id="fichier" class="ref__block">
            <h2 class="section-title">Fichier et sauvegarde</h2>
            <p>${st.fileName ? `Les données s’enregistrent automatiquement dans <strong class="mono">${esc(st.fileName)}</strong>${st.filePermission !== 'granted' ? ' (accès à réautoriser)' : ''}.` : 'Les données sont enregistrées dans ce navigateur uniquement. Liez un fichier pour une copie durable sur votre poste ou un disque réseau.'}</p>
            <div class="btn-row">
              ${DU.store.supportsFS ? `<button type="button" class="btn btn--cta" data-file="link">${st.fileName ? 'Changer de fichier' : 'Choisir un fichier d’enregistrement'}</button>` : ''}
              <button type="button" class="btn btn--ghost" data-file="open">Ouvrir un fichier duerp.json</button>
              <button type="button" class="btn btn--ghost" data-file="excel">Réimporter un fichier Excel</button>
              <button type="button" class="btn btn--danger-text" data-file="reset">Effacer les données de ce navigateur</button>
            </div>
          </section>
        </section>
      </div>`;

    const set = (path, value) => {
      const [a, b] = path.split('.');
      DU.store.commit((d) => {
        d[a][b] = value;
        return path.startsWith('seuils') ? { entity: 'referentiel', id: 'seuils', type: 'modification', ut: 'Méthode', libelle: 'Seuils de priorité', champs: [b] } : null;
      });
    };
    const val = (el) => ('num' in el.dataset ? (el.value.trim() === '' ? null : Number(el.value.replace(',', '.'))) : el.value.trim());

    root.addEventListener('change', (e) => {
      const el = e.target;
      if (el.dataset.path) set(el.dataset.path, val(el));
      else if (el.dataset.info !== undefined) DU.store.commit((d) => { d.entreprise.infos[Number(el.dataset.info)][el.dataset.f] = el.value.trim(); });
      else if (el.dataset.ut) {
        DU.store.commit((d) => {
          const u = d.unites.find((x) => x.id === el.dataset.ut);
          const old = u.nom;
          u[el.dataset.f] = val(el);
          return { entity: 'unite', id: u.id, type: 'modification', ut: u.nom, libelle: el.dataset.f === 'nom' ? `Renommage de « ${old} »` : 'Unité de travail', champs: [el.dataset.f] };
        });
      } else if (el.dataset.fam !== undefined) {
        const n = Number(el.dataset.fam);
        const nv = el.value.trim();
        if (!nv) return;
        DU.store.commit((d) => {
          const old = d.familles[n];
          d.familles[n] = nv;
          d.risques.forEach((r) => { if (r.famille === old) r.famille = nv; });
          return { entity: 'referentiel', id: 'famille-' + old, type: 'modification', ut: 'Référentiel', libelle: `Famille « ${old} » renommée « ${nv} »` };
        });
      } else if (el.dataset.act !== undefined) {
        DU.store.commit((d) => { d.acteurs[Number(el.dataset.act)] = el.value.trim(); });
      }
    });

    root.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      const nom = f.nom.value.trim();
      if (!nom) return;
      DU.store.commit((d) => {
        if (f.dataset.add === 'unite') {
          const u = { id: uid(), nom, effectif: null, penibilite: {} };
          d.unites.push(u);
          return { entity: 'unite', id: u.id, type: 'ajout', ut: nom, libelle: 'Nouvelle unité de travail' };
        }
        if (f.dataset.add === 'famille') d.familles.push(nom);
        if (f.dataset.add === 'acteur') d.acteurs.push(nom);
        return null;
      });
    });

    root.addEventListener('click', async (e) => {
      const t = e.target.closest('button, [data-jump]');
      if (!t) return;
      const d = DU.store.get();
      if (t.dataset.jump) { e.preventDefault(); $('#' + t.dataset.jump).scrollIntoView({ behavior: 'smooth' }); return; }
      if ('addInfo' in t.dataset) DU.store.commit((x) => { x.entreprise.infos.push({ label: '', value: '' }); });
      else if (t.dataset.delInfo !== undefined) DU.store.commit((x) => { x.entreprise.infos.splice(Number(t.dataset.delInfo), 1); });
      else if (t.dataset.up) DU.store.commit((x) => {
        const i = x.unites.findIndex((u) => u.id === t.dataset.up);
        if (i > 0) [x.unites[i - 1], x.unites[i]] = [x.unites[i], x.unites[i - 1]];
      });
      else if (t.dataset.delUt) await deleteUnite(t.dataset.delUt);
      else if (t.dataset.delFam !== undefined) {
        const f = d.familles[Number(t.dataset.delFam)];
        const n = countFam(f);
        if (n) { toast(`« ${f} » est utilisée par ${plural(n, 'risque', 'risques')} : renommez-la ou changez la famille de ces risques d’abord.`, 'warn'); return; }
        DU.store.commit((x) => { x.familles.splice(Number(t.dataset.delFam), 1); });
      } else if (t.dataset.delAct !== undefined) DU.store.commit((x) => { x.acteurs.splice(Number(t.dataset.delAct), 1); });
      else if (t.dataset.file) await DU.app.fileAction(t.dataset.file);
      else if (t.dataset.logo === 'remove') DU.store.commit((x) => { x.entreprise.logo = null; });
      else if (t.dataset.logo === 'pick') {
        let file;
        try { file = await DU.store.pickFile('image/png,image/jpeg,image/webp,image/svg+xml'); } catch (err) { return; }
        try {
          const logo = await DU.util.loadLogo(file);
          DU.store.commit((x) => { x.entreprise.logo = logo; });
          toast('Logo enregistré.', 'ok');
        } catch (err) { toast('Cette image n’a pas pu être lue.', 'warn'); }
      }
    });

    if (params && params.anchor) setTimeout(() => { const el = document.getElementById(params.anchor); if (el) el.scrollIntoView(); }, 30);
  }

  async function deleteUnite(id) {
    const d = DU.store.get();
    const u = M.uniteById(d, id);
    const n = d.risques.filter((r) => r.uniteId === id).length;
    if (!n) {
      if (!(await confirmDialog(`Supprimer l’unité « ${u.nom} » ?`, { title: 'Supprimer l’unité', submitLabel: 'Supprimer' }))) return;
      DU.store.commit((x) => { x.unites = x.unites.filter((y) => y.id !== id); return { entity: 'unite', id, type: 'suppression', ut: u.nom, libelle: 'Unité de travail' }; });
      return;
    }
    const others = d.unites.filter((y) => y.id !== id);
    const res = await openDialog({
      title: `Supprimer « ${u.nom} »`,
      submitLabel: 'Déplacer et supprimer',
      tone: 'danger',
      body: `<p>Cette unité contient ${plural(n, 'risque', 'risques')}. Choisissez l’unité qui les reprendra.</p>
        <label class="field"><span class="field__label">Unité de destination</span><select name="dest" required>${ui.options(others.map((o) => ({ value: o.id, label: o.nom })), '', { empty: 'Choisir…' })}</select></label>`,
      onSubmit: (f) => f.dest.value,
    });
    if (!res) return;
    DU.store.commit((x) => {
      const dest = M.uniteNom(x, res);
      const moved = x.risques.filter((r) => r.uniteId === id);
      moved.forEach((r) => { r.uniteId = res; });
      x.unites = x.unites.filter((y) => y.id !== id);
      return [{ entity: 'unite', id, type: 'suppression', ut: u.nom, libelle: `Unité supprimée, risques déplacés vers « ${dest} »` },
        ...moved.map((r) => ({ entity: 'risque', id: r.id, type: 'modification', ut: dest, libelle: r.situation, num: r.num, champs: ['unité'] }))];
    });
  }

  DU.views = DU.views || {};
  DU.views.referentiels = { render, title: 'Référentiels' };
})(window.DU);
