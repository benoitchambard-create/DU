# Contexte du projet
Site web sur mesure pour une activité de **sécurité des personnes**, destiné aux **entreprises et employeurs** (protection des salariés, travailleurs isolés, prévention des risques).
Identité visuelle forte, en rupture avec les templates standards et les esthétiques générées par IA.
Ton recherché : **rassurant, humain, sérieux, jamais alarmiste**. Le site informe et convainc ; ce n'est pas un canal d'urgence (pas de bouton d'alerte ni de numéro d'urgence).

# Règles strictes : Anti-déjà-vu (Interdictions absolues)
- **Mises en page interdites** : Pas de grille SaaS classique (Hero centré + 3 colonnes de cartes avec icônes + bandeau de logos + FAQ en accordéon).
- **Couleurs interdites** : Pas de fond blanc pur (`#FFFFFF`), pas de mode sombre générique (`#0F172A`), pas de dégradés violet/bleu fluo.
- **Typographie interdite** : Interdiction d'utiliser Inter, Roboto, Arial ou Montserrat.
- **Composants interdits** : Pas de boutons pilules (`rounded-full`) standards, pas d'ombres portées diffuses (`shadow-lg`) sur des cartes, pas d'illustrations vectorielles génériques.
- **Imagerie interdite (sécurité)** : Pas de clichés anxiogènes ou « sécuritaires » : cadenas, boucliers, caméras, cagoules, rubalise, silhouettes menaçantes, rouge d'alarme décoratif.

# Direction artistique
- **Esthétique cible** : **Éditorial chaleureux**. Mise en page inspirée du magazine : grands titres en Fraunces, beaucoup d'air, compositions asymétriques, photographies humaines.
- **Principe de douceur** : tout doit paraître apaisé — angles arrondis, transitions lentes et fluides, contrastes maîtrisés, aucun effet brusque.
- **Crédibilité** : la confiance passe par des preuves concrètes (normes, certifications, chiffres, témoignages d'entreprises) mises en forme éditorialement, pas par des badges ou logos alignés.

# Palette de couleurs (variables CSS)
Une seule convention de nommage, utilisée partout dans le code :
- `--bg-canvas` (fond principal) : `#F8F9FA`
- `--bg-surface` (surfaces / cartes) : `#FCFBF8`
- `--border` (bordures subtiles) : `#E2E8F0`
- `--text-ink` (texte courant) : `#14213A`
- `--color-primary` (Confiance) : `#1B365D`
- `--color-secondary` (Humain / Sérénité) : `#0D7377`
- `--color-cta` (Action) : `#B04E12` — texte blanc conforme WCAG AA (≈ 5,3:1)
- Sémantique :
  - `--color-success` (Succès / Sécurisé) : `#1E6F50`
  - `--color-warning` (Attention / Vigilance) : `#B45309`
  - `--color-danger` (Alerte / Risque critique) : `#991B1B` — réservé aux informations de risque réel, jamais décoratif.

# Typographie
- **Titres** : Fraunces (semi-bold / bold, interlignage 1.2, titres courts).
- **Corps de texte** : Atkinson Hyperlegible, 16px–18px, interlignage 1.6, longueur de ligne limitée à 65–75 caractères.
- **Données / Codes / Références** : JetBrains Mono (uniquement pour références de normes, identifiants de protocole, horodatages ou codes).

# Espacement & Grille
- **Base** : Système en 8px (8, 16, 24, 32, 48, 64px).
- **Grille** : 12 colonnes sur desktop avec gouttières de 24px, marges généreuses.
- **Rayons de bordure** : 12px pour les cartes et blocs, 8px pour les boutons et champs. Aucun angle vif.
- **Profondeur** : par les couleurs de surface et les bordures `--border`, pas par des ombres.

# Interactions & Mouvement
- **Micro-interactions** : transitions douces et fluides (250–400ms, `cubic-bezier(0.22, 1, 0.36, 1)`). Au survol : léger changement de teinte, soulignement progressif ou fond qui s'éclaircit — pas d'inversion brutale ni de zoom.
- **Animations** : révélations typographiques subtiles et apparitions en fondu liées au défilement. Pas de rebond (`bounce`), pas de clignotement.
- **Accessibilité du mouvement** : respecter `prefers-reduced-motion` (désactiver les animations non essentielles).

# Accessibilité
- Niveau minimum **WCAG 2.1 AA** (contrastes, navigation clavier, focus visible, textes alternatifs).
- Ne jamais transmettre une information de risque par la couleur seule (toujours un libellé texte).

# Stack technique & Conventions
- **Technologies** : HTML5 / CSS / JavaScript vanilla, sans outil de build. Site statique (compatible GitHub Pages).
- **Code** : CSS modulaire basé sur les variables personnalisées ci-dessus. JS minimal, uniquement pour l'amélioration progressive (le site doit fonctionner sans JS).
- **Assets** : photographies humaines lumineuses et naturelles (équipes au travail, gestes de prévention), grain léger, formes arrondies organiques. Pas d'icônes Lucide/Heroicons standardisées.

# Application DUERP (racine du dépôt)
- Exception à la règle « fonctionne sans JS » : c'est une application, JavaScript est requis (scripts classiques, pas de modules, pour fonctionner en `file://`).
- Données de l'entreprise (Excel, `duerp*.json`) : jamais dans Git, jamais envoyées à un service externe.
- Cotation : G × F × P × M ; priorité ≥ 12, second temps de 4 à 12 (seuils modifiables dans Référentiels).

# Workflow de développement
- Avant de coder une section, proposer d'abord sa structure spatiale (wireframe en texte) pour valider l'originalité de la composition.
- Garder ce fichier sous les 150 lignes pour éviter toute dilution des consignes.
