# Contexte du projet
Création d'un site web sur mesure à forte identité visuelle, en rupture totale avec les templates standards et les esthétiques générées par IA.

# Règles strictes : Anti-déjà-vu (Interdictions absolues)
- **Mises en page interdites** : Pas de grille SaaS classique (Hero centré + 3 colonnes de cartes avec icônes + bandeau de logos + FAQ en accordéon).
- **Couleurs interdites** : Pas de fond blanc pur (`#FFFFFF`), pas de mode sombre générique (`#0F172A`), pas de dégradés violet/bleu fluo.
- **Typographie interdite** : Interdiction d'utiliser Inter, Roboto, Arial ou Montserrat par défaut.
- **Composants interdits** : Pas de boutons pilules (`rounded-full`) standards, pas d'ombres portées diffuses (`shadow-lg`) sur des cartes blanches, pas d'illustrations vectorielles génériques.

# Direction artistique & Design System
- **Esthétique cible** : [À compléter : ex. Brutalisme éditorial / Néo-rétro tactile / Architecture minimaliste suisse / Web expérimental].
- **Palette de couleurs** :
	• Fond principal (--bg-canvas) : #F8F9FA 
	• Surface / Cartes (--bg-surface) : #FFFFFF avec bordure subtile #E2E8F0
	• Primaire — Confiance (--color-primary) : #1B365D 
	• Secondaire — Humain / Sérénité (--color-secondary) : #0D7377 
	• Accent — Action (--color-cta) : #C85A17 
	• Sémantique :
		• Succès / Sécurisé : #1E6F50
		• Attention / Vigilance : #B45309
		• Alerte / Risque critique : #991B1B 


# Typographie
	• Titres (Editorial & Humain) : Plus Jakarta Sans ou Fraunces (semi-bold / bold, interlignage 1.2, titres courts).
	• Corps de texte (Lisibilité maximale) : Inter ou Atkinson Hyperlegible, taille de base 16px–18px, interlignage 1.6, longueur de ligne limitée à 65–75 caractères.
	• Données / Codes / Références : JetBrains Mono (uniquement pour identifiants de protocole, horodatages ou codes).

# Espacement & Grille
	• Base : Système en 8px (8, 16, 24, 32, 48, 64px).
	• Grille : 12 colonnes sur desktop avec gouttières de 24px, marges généreuses.
	• Rayons de bordure (border-radius) : 8px à 12px pour les cartes et boutons (adoucit l'interface par rapport à des angles trop rigides).



# Interactions & Mouvement
- **Micro-interactions** : Transitions sèches et mécaniques (ex: `cubic-bezier(0.16, 1, 0.3, 1)`), inversion de couleurs au survol plutôt que des zooms classiques.
- **Animations** : Utiliser des animations liées au défilement (scroll-driven) ou des révélations typographiques subtiles. Éviter les rebonds (`bounce`).

# Stack technique & Conventions
- **Technologies** : [Ex: HTML5 / Tailwind CSS / Vanilla JS ou Astro / GSAP].
- **Code** : CSS modulaire utilisant des variables personnalisées (`--bg-primary`, `--text-ink`, `--accent`).
- **Assets** : Utiliser des textures (grain, trame), des formes géométriques brutes ou des photographies contrastées plutôt que des icônes Lucide/Heroicons standardisées.

# Workflow de développement
- Avant de coder une section, proposer d'abord sa structure spatiale (wireframe en texte) pour valider l'originalité de la composition.
- Garder ce fichier sous les 150 lignes pour éviter toute dilution des consignes.

