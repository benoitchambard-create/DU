/* Modèle de données du DUERP : échelles de cotation, priorités, pénibilité, calculs. */
(function (DU) {
  'use strict';
  const { norm } = DU.util;

  /* Échelles reprises du fichier Excel d'origine (onglet « Listes pour menus »). */
  const ECHELLES = {
    G: {
      nom: 'Gravité',
      niveaux: {
        1: 'Légère : travail inconfortable, incident sans arrêt de travail',
        2: 'Sans effet irréversible : accident avec arrêt, sans séquelles',
        3: 'Élevée : accident avec arrêt et possibilité de séquelles',
        4: 'Très élevée : atteinte irréversible, invalidité permanente ou décès',
      },
    },
    F: {
      nom: 'Fréquence d’exposition',
      niveaux: {
        1: 'Très improbable : 1 fois par an ou moins, durée d’1 h à 1 jour',
        2: 'Improbable : 1 fois par mois, plus d’1 h par jour',
        3: 'Périodique : 1 fois par semaine, entre 1 et 4 h par jour',
        4: 'Permanente : chaque jour, plus d’1 h par jour',
      },
    },
    P: {
      nom: 'Probabilité',
      niveaux: {
        1: 'Très improbable : ne s’est jamais produit, exceptionnel',
        2: 'Improbable : se produit rarement',
        3: 'Périodique : se produit occasionnellement',
        4: 'Régulière : se produit régulièrement ou de manière certaine',
      },
    },
  };

  const MAITRISE = [
    { v: 1, court: 'Aucune mesure', label: 'Aucune mesure n’est en place ou les mesures sont inefficaces' },
    { v: 0.5, court: 'Insuffisante', label: 'Des mesures insuffisantes sont en place' },
    { v: 0.1, court: 'Améliorable', label: 'Des mesures répondent bien au risque mais peuvent être améliorées' },
    { v: 0.01, court: 'Très efficace', label: 'Des mesures très efficaces sont en place, aucune autre mesure possible à date' },
  ];

  /* Les 10 facteurs de risques professionnels (art. L4161-1 du Code du travail). */
  const PENIBILITE = [
    { groupe: 'Contraintes physiques marquées', facteurs: [
      { key: 'manutention', label: 'Manutentions manuelles de charges' },
      { key: 'postures', label: 'Postures pénibles' },
      { key: 'vibrations', label: 'Vibrations mécaniques' },
    ] },
    { groupe: 'Environnement physique agressif', facteurs: [
      { key: 'chimiques', label: 'Agents chimiques dangereux' },
      { key: 'hyperbare', label: 'Activités en milieu hyperbare' },
      { key: 'temperatures', label: 'Températures extrêmes' },
      { key: 'bruit', label: 'Bruit' },
    ] },
    { groupe: 'Rythmes de travail', facteurs: [
      { key: 'nuit', label: 'Travail de nuit' },
      { key: 'equipes', label: 'Équipes successives alternantes' },
      { key: 'repetitif', label: 'Travail répétitif' },
    ] },
  ];
  const FACTEURS = PENIBILITE.flatMap((g) => g.facteurs);

  const STATUTS = [
    { key: 'a_lancer', label: 'À lancer' },
    { key: 'en_cours', label: 'En cours' },
    { key: 'realisee', label: 'Réalisée' },
    { key: 'non_realisee', label: 'Non réalisée' },
    { key: 'abandonnee', label: 'Abandonnée' },
    { key: 'a_verifier', label: 'Statut à vérifier' },
  ];
  const statutLabel = (k) => (STATUTS.find((s) => s.key === k) || STATUTS[0]).label;
  const STATUTS_OUVERTS = ['a_lancer', 'en_cours', 'non_realisee'];

  const MOTIFS = [
    { key: 'annuelle', label: 'Mise à jour annuelle' },
    { key: 'amenagement', label: 'Aménagement important modifiant les conditions de santé, sécurité ou travail' },
    { key: 'information', label: 'Information supplémentaire sur l’évaluation d’un risque' },
    { key: 'accident', label: 'Suite à un accident du travail ou une maladie professionnelle' },
    { key: 'autre', label: 'Autre motif' },
  ];

  const FAMILLES_DEFAUT = [
    'Agents biologiques', 'Ambiance lumineuse', 'Ambiance thermique', 'Bruit', 'Chute de hauteur',
    'Chute de plain-pied', 'Circulations internes', 'Effondrement et chute d’objet', 'Électricité',
    'Équipements de travail', 'Incendie, explosion', 'Intervention d’entreprises extérieures',
    'Manutention manuelle', 'Manutention mécanique', 'Postures pénibles',
    'Produits chimiques, émissions, déchets', 'Rayonnements', 'Risque routier en mission',
    'Risques psychosociaux', 'Travail de nuit', 'Travail en équipe', 'Travail répétitif', 'Vibrations',
  ];

  function emptyData() {
    return {
      schema: 1,
      entreprise: { raisonSociale: '', effectif: null, infos: [], logo: null },
      document: { code: '', indice: '', redacteur: '', verificateur: '', dateCreation: '' },
      seuils: { priorite: 12, second: 4 },
      familles: FAMILLES_DEFAUT.slice(),
      acteurs: [],
      unites: [],
      risques: [],
      actions: [],
      versions: [],
      journal: [],
    };
  }

  /* ---------- Cotation ---------- */
  const isNum = (v) => typeof v === 'number' && !isNaN(v);

  function initial(r) {
    return isNum(r.G) && isNum(r.F) && isNum(r.P) ? r.G * r.F * r.P : null;
  }

  function residuel(r) {
    const i = initial(r);
    return i !== null && isNum(r.M) ? Math.round(i * r.M * 1000) / 1000 : null;
  }

  const PRIORITES = {
    p1: { key: 'p1', court: 'Prioritaire', label: 'Améliorer en priorité' },
    p2: { key: 'p2', court: 'Second temps', label: 'Améliorer dans un second temps' },
    p3: { key: 'p3', court: 'Acceptable', label: 'Pas d’amélioration à apporter dans un premier temps' },
    nc: { key: 'nc', court: 'Non coté', label: 'Cotation incomplète' },
  };

  function priorite(r, seuils) {
    const v = residuel(r);
    if (v === null) return PRIORITES.nc;
    if (v >= seuils.priorite) return PRIORITES.p1;
    if (v >= seuils.second) return PRIORITES.p2;
    return PRIORITES.p3;
  }

  function niveauInitial(r, seuils) {
    const v = initial(r);
    if (v === null) return null;
    if (v >= seuils.priorite) return 'eleve';
    if (v >= seuils.second) return 'modere';
    return 'faible';
  }

  /* ---------- Requêtes sur les données ---------- */
  const uniteById = (data, id) => data.unites.find((u) => u.id === id);
  const uniteNom = (data, id) => (uniteById(data, id) || {}).nom || 'Sans unité';
  const actionsDuRisque = (data, rid) => data.actions.filter((a) => a.risqueIds.includes(rid));
  const risquesDeLAction = (data, a) => data.risques.filter((r) => a.risqueIds.includes(r.id));

  function hasOpenAction(data, rid) {
    return data.actions.some((a) => a.risqueIds.includes(rid) && STATUTS_OUVERTS.includes(a.statut));
  }

  /** Échéance d'une action en date ISO, ou null si texte libre. */
  const echeanceISO = (a) => a.echeance || null;

  function enRetard(a, today) {
    const e = echeanceISO(a);
    return !!e && e < today && STATUTS_OUVERTS.includes(a.statut);
  }

  const nextNum = (data) => data.risques.reduce((m, r) => Math.max(m, Number(r.num) || 0), 0) + 1;

  const derniereVersion = (data) =>
    data.versions.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;

  /** Indice suivant : A → B, Z → AA, 3 → 4. */
  function indiceSuivant(ind) {
    if (!ind) return 'A';
    if (/^\d+$/.test(ind)) return String(Number(ind) + 1);
    const s = ind.toUpperCase();
    if (/^[A-Z]+$/.test(s)) {
      const chars = s.split('');
      let i = chars.length - 1;
      while (i >= 0) {
        if (chars[i] === 'Z') { chars[i] = 'A'; i--; } else { chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1); return chars.join(''); }
      }
      return 'A' + chars.join('');
    }
    return ind + '+1';
  }

  const findFamille = (data, label) => data.familles.find((f) => norm(f) === norm(label));

  DU.model = {
    ECHELLES, MAITRISE, PENIBILITE, FACTEURS, STATUTS, STATUTS_OUVERTS, MOTIFS, PRIORITES, FAMILLES_DEFAUT,
    emptyData, initial, residuel, priorite, niveauInitial, statutLabel,
    uniteById, uniteNom, actionsDuRisque, risquesDeLAction, hasOpenAction, enRetard, echeanceISO,
    nextNum, derniereVersion, indiceSuivant, findFamille,
  };
})(window.DU);
