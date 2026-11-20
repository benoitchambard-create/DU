/*
 * Import du fichier Excel historique (onglets « DU complet », « Listes pour menus »,
 * « Présentation », « 1ère page », « PAPRIPACT AA »). La lecture se fait par intitulés
 * de colonnes, pas par position, pour tolérer les variantes du fichier.
 */
(function (DU) {
  'use strict';
  const { norm, uid, clone } = DU.util;
  const M = DU.model;

  const MAX_COL = 40;

  /* ---------- Lecture des cellules ---------- */
  function val(v) {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object') {
      if ('result' in v) return val(v.result);
      if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
      if ('text' in v) return val(v.text);
      return null; // formule sans résultat, erreur…
    }
    return v;
  }
  const cell = (ws, r, c) => val(ws.getRow(r).getCell(c).value);
  const txt = (v) => {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return excelDateISO(v);
    return String(v).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  };
  const num = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && /^\s*-?\d+([.,]\d+)?\s*$/.test(v)) return parseFloat(v.replace(',', '.'));
    return null;
  };
  const pad = (n) => String(n).padStart(2, '0');
  const excelDateISO = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const frDateISO = (s) => {
    const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s || '');
    if (!m) return '';
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${y}-${pad(m[2])}-${pad(m[1])}`;
  };
  const lastRow = (ws) => Math.min(ws.rowCount || 0, 5000);

  /** Cherche une ligne d'en-têtes contenant `needle` ; renvoie {row, cols: Map(intitulé normalisé → colonne)}. */
  function findHeader(ws, needle, maxRow = 40) {
    for (let r = 1; r <= Math.min(maxRow, lastRow(ws)); r++) {
      const cols = new Map();
      for (let c = 1; c <= MAX_COL; c++) {
        const t = norm(txt(cell(ws, r, c)));
        if (t && !cols.has(t)) cols.set(t, c);
      }
      if ([...cols.keys()].some((k) => k === needle || k.startsWith(needle))) return { row: r, cols };
    }
    return null;
  }

  /** Associe un champ à la première colonne dont l'intitulé satisfait le test. */
  function pickCol(cols, test) {
    for (const [k, c] of cols) if (test(k)) return c;
    return null;
  }

  /** Valeurs listées sous un intitulé donné (onglet « Listes pour menus »). */
  function listUnder(ws, label) {
    for (let r = 1; r <= Math.min(60, lastRow(ws)); r++) {
      for (let c = 1; c <= MAX_COL; c++) {
        if (norm(txt(cell(ws, r, c))) === label) {
          const out = [];
          for (let rr = r + 1; rr <= lastRow(ws); rr++) {
            const t = txt(cell(ws, rr, c));
            if (!t) break;
            out.push(t);
          }
          return out;
        }
      }
    }
    return [];
  }

  function statutDepuis(texte) {
    const t = norm(texte);
    if (!t) return null;
    if (t.startsWith('non fait') || t.startsWith('pas fait') || t.includes('non realise')) return 'non_realisee';
    if (t.startsWith('abandon')) return 'abandonnee';
    if (t.startsWith('en cours') || t.includes('partiel')) return 'en_cours';
    if (t === 'fait' || t.startsWith('fait') || t.startsWith('realise') || t.startsWith('ok')) return 'realisee';
    return null;
  }

  const findSheet = (wb, test) => wb.worksheets.find((ws) => test(norm(ws.name), ws));

  /* ---------- Import ---------- */
  async function importWorkbook(arrayBuffer) {
    const wb = new window.ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    const data = M.emptyData();
    const rapport = { risques: 0, unites: 0, actions: 0, papripact: 0, lignesIgnorees: 0, avertissements: [] };

    /* Listes de référence */
    const listes = findSheet(wb, (n, ws) => n.includes('liste') || !!findHeader(ws, 'familles de risques', 10));
    let utListe = [];
    if (listes) {
      const familles = listUnder(listes, 'familles de risques');
      if (familles.length) data.familles = familles;
      utListe = listUnder(listes, 'ut');
      data.acteurs = listUnder(listes, 'acteurs');
    }

    /* Inventaire des risques */
    let duSheet = null, head = null;
    for (const ws of wb.worksheets) {
      const h = findHeader(ws, 'situation dangereuse', 40);
      if (h && pickCol(h.cols, (k) => k === 'ut' || k.startsWith('unite'))) { duSheet = ws; head = h; break; }
    }
    if (!duSheet) throw new Error('Aucun onglet ne contient de colonnes « UT » et « Situation dangereuse ».');

    const C = head.cols;
    const col = {
      num: pickCol(C, (k) => /^(n°|no|n|numero|num)$/.test(k)),
      ut: pickCol(C, (k) => k === 'ut' || k.startsWith('unite')),
      localisation: pickCol(C, (k) => k.startsWith('localisation') || k.startsWith('lieu')),
      famille: pickCol(C, (k) => k.startsWith('famille')),
      situation: pickCol(C, (k) => k.startsWith('situation dangereuse')),
      G: pickCol(C, (k) => k === 'g' || k.startsWith('gravite')),
      F: pickCol(C, (k) => k === 'f' || k.startsWith('frequence')),
      P: pickCol(C, (k) => k === 'p' || k.startsWith('probabilite')),
      mesures: pickCol(C, (k) => k.startsWith('mesure')),
      M: pickCol(C, (k) => k === 'm' || k.startsWith('maitrise')),
      action: pickCol(C, (k) => k.startsWith('action')),
      acteur: pickCol(C, (k) => k.startsWith('acteur') || k.startsWith('responsable')),
      echeance: pickCol(C, (k) => k.startsWith('echeance')),
      suivi: pickCol(C, (k) => k.startsWith('suivi')),
    };
    const get = (r, k) => (col[k] ? cell(duSheet, r, col[k]) : null);

    const unitesByNorm = new Map();
    const ensureUnite = (nom) => {
      const key = norm(nom);
      if (!unitesByNorm.has(key)) {
        const u = { id: uid(), nom: nom.trim(), effectif: null, penibilite: {} };
        unitesByNorm.set(key, u);
        data.unites.push(u);
      }
      return unitesByNorm.get(key);
    };
    utListe.forEach(ensureUnite);

    const famillesNorm = new Set(data.familles.map(norm));
    const actionsByKey = new Map();
    let autoNum = 0;

    for (let r = head.row + 1; r <= lastRow(duSheet); r++) {
      const ut = txt(get(r, 'ut'));
      const situation = txt(get(r, 'situation'));
      const famille = txt(get(r, 'famille'));
      if (!ut && !situation && !famille) { rapport.lignesIgnorees++; continue; }

      const unite = ensureUnite(ut || 'Sans unité');
      if (famille && !famillesNorm.has(norm(famille))) { data.familles.push(famille); famillesNorm.add(norm(famille)); }
      const n = num(get(r, 'num'));
      autoNum = Math.max(autoNum + 1, n || 0);
      const risque = {
        id: uid(),
        num: n || autoNum,
        uniteId: unite.id,
        localisation: txt(get(r, 'localisation')),
        famille: famille ? (M.findFamille(data, famille) || famille) : '',
        situation,
        G: num(get(r, 'G')),
        F: num(get(r, 'F')),
        P: num(get(r, 'P')),
        mesures: txt(get(r, 'mesures')),
        M: num(get(r, 'M')),
        exposes: null,
        impactSexe: '',
      };
      data.risques.push(risque);

      const libelle = txt(get(r, 'action'));
      if (libelle) {
        const acteur = txt(get(r, 'acteur')).replace(/\n/g, ', ');
        const key = norm(libelle) + '|' + norm(acteur);
        if (!actionsByKey.has(key)) {
          const ech = get(r, 'echeance');
          const suivi = txt(get(r, 'suivi'));
          const a = {
            id: uid(), intitule: libelle, objectif: '', indicateur: '', conditions: '',
            responsable: acteur, annee: null,
            echeance: ech instanceof Date ? excelDateISO(ech) : '',
            echeanceTexte: ech instanceof Date ? '' : txt(ech),
            budget: '', statut: statutDepuis(suivi) || 'a_lancer', realisation: suivi, risqueIds: [],
          };
          actionsByKey.set(key, a);
          data.actions.push(a);
        }
        actionsByKey.get(key).risqueIds.push(risque.id);
      }
    }
    rapport.risques = data.risques.length;
    rapport.actions = data.actions.length;
    rapport.unites = data.unites.length;
    if (!col.G || !col.F || !col.P || !col.M) rapport.avertissements.push('Certaines colonnes de cotation (G, F, P ou M) sont introuvables.');

    /* Programmes annuels de prévention (PAPRIPACT) */
    const anneeCourante = new Date().getFullYear();
    wb.worksheets.forEach((ws) => {
      const m = /papripact\s*(\d{2,4})/.exec(norm(ws.name));
      if (!m) return;
      const annee = m[1].length === 2 ? 2000 + Number(m[1]) : Number(m[1]);
      const h = findHeader(ws, 'actions de prevention', 15) || findHeader(ws, 'action', 15);
      if (!h) return;
      const pc = {
        intitule: pickCol(h.cols, (k) => k.startsWith('action')),
        objectif: pickCol(h.cols, (k) => k.startsWith('objectif')),
        planning: pickCol(h.cols, (k) => k.startsWith('planning') || k.startsWith('echeance') || k.startsWith('calendrier')),
        responsable: pickCol(h.cols, (k) => k.startsWith('responsable')),
        budget: pickCol(h.cols, (k) => k.startsWith('budget') || k.startsWith('cout')),
        realisation: pickCol(h.cols, (k) => k.startsWith('realisation')),
        indicateur: pickCol(h.cols, (k) => k.startsWith('indicateur')),
      };
      const g = (r, k) => (pc[k] ? cell(ws, r, pc[k]) : null);
      for (let r = h.row + 1; r <= lastRow(ws); r++) {
        const intitule = txt(g(r, 'intitule'));
        if (!intitule) continue;
        const planning = g(r, 'planning');
        const budget = g(r, 'budget');
        const realisation = txt(g(r, 'realisation'));
        const statut = statutDepuis(realisation) || (annee < anneeCourante ? 'a_verifier' : 'a_lancer');
        data.actions.push({
          id: uid(), intitule, objectif: txt(g(r, 'objectif')), indicateur: txt(g(r, 'indicateur')), conditions: '',
          responsable: txt(g(r, 'responsable')).replace(/\n/g, ', '), annee,
          echeance: planning instanceof Date ? excelDateISO(planning) : '',
          echeanceTexte: planning instanceof Date ? '' : txt(planning),
          budget: typeof budget === 'number' ? budget : txt(budget),
          statut, realisation: statutDepuis(realisation) ? '' : realisation, risqueIds: [],
        });
        rapport.papripact++;
      }
    });

    /* Présentation de l'entreprise */
    let dateMaj = '';
    const pres = findSheet(wb, (n) => n.includes('presentation'));
    if (pres) {
      for (let r = 1; r <= Math.min(80, lastRow(pres)); r++) {
        const parts = [];
        for (let c = 1; c <= 10; c++) { const t = txt(cell(pres, r, c)); if (t) parts.push({ t, raw: cell(pres, r, c) }); }
        if (!parts.length) continue;
        const first = parts[0].t;
        const i = first.indexOf(':');
        if (i === -1) continue;
        const label = first.slice(0, i).trim();
        const rest = [first.slice(i + 1).trim(), ...parts.slice(1).map((p) => (p.raw instanceof Date ? DU.util.fmtDate(excelDateISO(p.raw)) : p.t))]
          .filter(Boolean).join(' ');
        const nl = norm(label);
        if (nl.startsWith('raison sociale')) data.entreprise.raisonSociale = rest;
        else if (nl.includes('employe') || nl.includes('effectif') || nl.includes('salarie')) {
          const n = parseInt(rest.replace(/\s/g, ''), 10);
          data.entreprise.effectif = isNaN(n) ? null : n;
        } else if (nl.startsWith('date de mise a jour')) {
          dateMaj = frDateISO(rest);
          continue;
        }
        if (!nl.startsWith('raison sociale') && !nl.includes('employe')) data.entreprise.infos.push({ label, value: rest });
      }
    }

    /* Page de garde : identification du document et dernière version */
    const garde = findSheet(wb, (n) => n.includes('page') || n.includes('garde'));
    const version = { id: uid(), indice: '', date: dateMaj, motif: 'autre', motifDetail: 'Version importée depuis le fichier Excel', redacteur: '', verificateur: '', consultationCSE: '', modifications: [] };
    if (garde) {
      const all = [];
      for (let r = 1; r <= Math.min(120, lastRow(garde)); r++) for (let c = 1; c <= 12; c++) { const t = txt(cell(garde, r, c)); if (t) all.push(t); }
      const joined = all.join('\n');
      const grab = (re) => { const m = re.exec(joined); return m ? m[1].trim() : ''; };
      data.document.code = grab(/code\s*:\s*([^\n]+)/i);
      data.document.indice = grab(/version\s*:\s*([^\n]+)/i);
      data.document.redacteur = grab(/r[ée]dacteur\s*:\s*([^\n]+)/i);
      data.document.verificateur = grab(/v[ée]rificateur\s*:\s*([^\n]+)/i);
      data.document.dateCreation = frDateISO(grab(/date de cr[ée]ation\s*:\s*([\d/]+)/i));
      if (!data.entreprise.raisonSociale) {
        const rs = all.find((t) => t === t.toUpperCase() && t.length > 3 && !/DOCUMENT|UNIQUE|EVALUATION|RISQUES|DES/.test(t));
        if (rs) data.entreprise.raisonSociale = rs;
      }
      const maj = frDateISO(grab(/mise [àa] jour\s*([\d/]+)/i));
      if (maj) version.date = maj;
      version.indice = data.document.indice;
      version.redacteur = data.document.redacteur;
      version.verificateur = data.document.verificateur;

      const hm = findHeader(garde, 'ut concerne', 80);
      if (hm) {
        const mc = {
          ut: pickCol(hm.cols, (k) => k.startsWith('ut')),
          situation: pickCol(hm.cols, (k) => k.startsWith('situation')),
          type: pickCol(hm.cols, (k) => k.startsWith('type')),
          num: pickCol(hm.cols, (k) => k.startsWith('n°') || k.startsWith('no') || k.includes('item')),
        };
        for (let r = hm.row + 1; r <= lastRow(garde); r++) {
          const s = txt(mc.situation ? cell(garde, r, mc.situation) : '');
          const u = txt(mc.ut ? cell(garde, r, mc.ut) : '');
          if (!s && !u) continue;
          version.modifications.push({
            type: 'modification', ut: u, libelle: s,
            detail: txt(mc.type ? cell(garde, r, mc.type) : ''),
            num: txt(mc.num ? cell(garde, r, mc.num) : ''),
          });
        }
      }
    }
    if (!version.date) version.date = DU.util.todayISO();

    if (data.entreprise.effectif === null && data.unites.length) data.entreprise.effectif = null;
    version.snapshot = snapshotOf(data);
    data.versions.push(version);
    return { data, rapport };
  }

  /** Copie figée des éléments constitutifs du document (sans historique). */
  function snapshotOf(d) {
    return clone({
      entreprise: d.entreprise, document: d.document, seuils: d.seuils, familles: d.familles,
      unites: d.unites, risques: d.risques, actions: d.actions,
    });
  }

  DU.importExcel = { importWorkbook, snapshotOf };
})(window.DU);
