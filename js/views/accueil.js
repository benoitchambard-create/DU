/* Écran d'accueil, affiché tant qu'aucun document n'est chargé. */
(function (DU) {
  'use strict';

  function render() {
    const root = DU.util.resetRoot();
    root.innerHTML = `
      <section class="welcome">
        <div class="welcome__intro">
          <p class="eyebrow">Document unique d’évaluation des risques professionnels</p>
          <h1 class="welcome__title reveal">Vos risques professionnels, <em>lisibles</em> et tenus à jour.</h1>
          <p class="lede">Inventaire par unité de travail, plan d’actions, pénibilité, versions archivées et extractions pour l’inspection du travail.
          Tout reste sur votre poste : rien n’est envoyé sur Internet.</p>
        </div>
        <ol class="welcome__steps">
          <li><button type="button" class="step" data-start="excel">
            <span class="step__n">01</span>
            <span class="step__text"><strong>Importer mon fichier Excel</strong>
              <span>Les onglets « DU complet », « PAPRIPACT », « Listes pour menus », « Présentation » et la page de garde sont convertis automatiquement.</span></span>
          </button></li>
          <li><button type="button" class="step" data-start="open">
            <span class="step__n">02</span>
            <span class="step__text"><strong>Ouvrir un fichier duerp.json</strong>
              <span>Reprendre un document déjà créé avec cet outil, ou une sauvegarde.</span></span>
          </button></li>
          <li><button type="button" class="step" data-start="blank">
            <span class="step__n">03</span>
            <span class="step__text"><strong>Commencer un document vierge</strong>
              <span>Avec les familles de risques usuelles et la méthode de cotation G × F × P × M.</span></span>
          </button></li>
        </ol>
      </section>`;
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-start]');
      if (b) DU.app.fileAction(b.dataset.start);
    });
  }

  DU.views = DU.views || {};
  DU.views.accueil = { render, title: 'Accueil' };
})(window.DU);
