/* Écran « Extractions » : documents pour l'inspection, le CSE, les salariés, le médecin du travail. */
(function (DU) {
  'use strict';
  const { esc, fmtDate, todayISO, download, slug } = DU.util;
  const M = DU.model;
  const ui = DU.ui;

  function render() {
    const root = DU.util.resetRoot();
    const data = DU.store.get();
    const versions = data.versions.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const annees = [...new Set(data.actions.map((a) => a.annee).filter(Boolean))].sort((a, b) => b - a);
    const versionOpts = [{ value: 'current', label: 'État actuel (non publié)' }, ...versions.map((v) => ({ value: v.id, label: `Version ${v.indice} du ${fmtDate(v.date)}` }))];

    const doc = (n, titre, pour, desc, controls, buttons) => `
      <li class="doc">
        <span class="doc__n">${n}</span>
        <div class="doc__text"><h2 class="doc__title">${titre}</h2><p class="doc__for">${pour}</p><p>${desc}</p></div>
        <form class="doc__form" data-doc="${n}" onsubmit="return false">${controls}<div class="doc__btns">${buttons}</div></form>
      </li>`;

    root.innerHTML = `
      <header class="view-head view-head--wide">
        <p class="eyebrow">Mise à disposition</p>
        <h1 class="display">Extractions</h1>
        <p class="lede">Chaque document s’ouvre dans la fenêtre d’impression de Chrome : choisissez <strong>« Enregistrer au format PDF »</strong> comme destination.
        Pour un contrôle, privilégiez une <strong>version publiée</strong> : elle est datée et ne bougera plus.</p>
      </header>
      <ol class="doc-list">
        ${doc('01', 'Document unique complet', 'Inspection du travail · CARSAT · CSE · médecin du travail',
          'Page de garde, liste des modifications, présentation, méthode de cotation, inventaire par unité, PAPRIPACT, pénibilité et modalités de conservation.',
          `<label class="field"><span class="field__label">Version</span><select name="version">${ui.options(versionOpts, versions[0] ? versions[0].id : 'current')}</select></label>`,
          '<button class="btn btn--cta" data-act="complet-pdf">Imprimer / PDF</button><button class="btn btn--ghost" data-act="complet-xlsx">Excel</button>')}
        ${doc('02', 'Extrait par unité de travail', 'Salariés · managers · affichage au poste',
          'Les risques d’une seule unité avec leurs mesures et actions, suivis de la méthode de cotation.',
          `<label class="field"><span class="field__label">Unité</span><select name="ut">${ui.options(data.unites.map((u) => ({ value: u.id, label: u.nom })), '')}</select></label>`,
          '<button class="btn btn--cta" data-act="unite-pdf">Imprimer / PDF</button>')}
        ${doc('03', 'Programme annuel de prévention', 'CSE (consultation annuelle) · direction',
          'PAPRIPACT de l’année : actions, objectifs, indicateurs, responsables, échéances et budget.',
          `<label class="field"><span class="field__label">Programme</span><select name="annee">${ui.options([...annees.map((y) => ({ value: y, label: `PAPRIPACT ${y}` })), { value: 'hors', label: 'Actions hors programme' }], annees[0])}</select></label>`,
          '<button class="btn btn--cta" data-act="pap-pdf">Imprimer / PDF</button>')}
        ${doc('04', 'Facteurs de pénibilité', 'Médecin du travail · déclarations',
          'Effectifs et salariés exposés au-delà des seuils, par unité et par facteur, avec les proportions.',
          '', '<button class="btn btn--cta" data-act="pen-pdf">Imprimer / PDF</button>')}
        ${doc('05', 'Sauvegarde complète', 'Vous · archivage',
          'Toutes les données et toutes les versions dans un seul fichier, à conserver en lieu sûr. Il se rouvre depuis Référentiels → Fichier.',
          '', '<button class="btn btn--ghost" data-act="json">Télécharger (.json)</button><button class="btn btn--ghost" data-act="xlsx">Export Excel complet</button>')}
      </ol>`;

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const d = DU.store.get();
      const form = b.closest('form');
      const v = ui.formValues(form);
      const current = { indice: d.document.indice ? `${d.document.indice} (en cours)` : 'en cours', date: todayISO(), redacteur: d.document.redacteur, verificateur: d.document.verificateur };
      const choose = () => {
        if (v.version && v.version !== 'current') {
          const ver = d.versions.find((x) => x.id === v.version);
          return { src: ver.snapshot, info: DU.views.versions.versionInfo(ver), ver };
        }
        return { src: d, info: Object.assign(current, { modifications: d.journal }) };
      };
      switch (b.dataset.act) {
        case 'complet-pdf': { const c = choose(); DU.export.print('complet', { src: c.src, info: c.info }); break; }
        case 'complet-xlsx': {
          const c = choose();
          DU.export.excel(c.ver ? Object.assign({}, c.src, { versions: [] }) : d, { versionInfo: c.ver });
          break;
        }
        case 'unite-pdf': DU.export.print('unite', { src: d, info: current, uniteId: v.ut, titre: `DUERP-${slug(M.uniteNom(d, v.ut))}-${todayISO()}` }); break;
        case 'pap-pdf': DU.export.print('papripact', { src: d, info: current, annee: v.annee === 'hors' ? 'hors' : Number(v.annee), titre: `PAPRIPACT-${v.annee}` }); break;
        case 'pen-pdf': DU.export.print('penibilite', { src: d, info: current, titre: `Penibilite-${todayISO()}` }); break;
        case 'json': download(`duerp-sauvegarde-${todayISO()}.json`, new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' })); break;
        case 'xlsx': DU.export.excel(d); break;
        default:
      }
    });
  }

  DU.views = DU.views || {};
  DU.views.extractions = { render, title: 'Extractions' };
})(window.DU);
