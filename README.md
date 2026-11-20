# Document unique (DUERP)

Application web pour tenir le document unique d'évaluation des risques professionnels :
inventaire par unité de travail, plan d'actions (PAPRIPACT), pénibilité, versions archivées et extractions.

## Utilisation

1. Ouvrir `index.html` dans **Chrome** ou **Edge** (double-clic suffit, aucune installation).
2. Au premier lancement : **Importer mon fichier Excel** (format « DU complet », « PAPRIPACT AA », « Listes pour menus »…).
3. Choisir où enregistrer `duerp.json` : chaque modification y est écrite automatiquement.
   Placer ce fichier sur un disque sauvegardé (réseau, OneDrive…).

Au redémarrage de Chrome, un bouton « Réautoriser l'accès » peut apparaître en haut à droite : c'est une sécurité du navigateur.

## Où sont les données ?

- Dans le fichier `duerp.json` choisi, et dans une copie de travail du navigateur.
- **Rien n'est envoyé sur Internet.** Les fichiers `.xlsx` et `duerp*.json` sont exclus du dépôt Git (`.gitignore`).
- Sauvegarde manuelle : Extractions → « Sauvegarde complète ».

## Mises à jour et conservation

Versions → « Publier une mise à jour » fige le document (motif, rédacteur, vérificateur, consultation du CSE)
avec la liste des modifications générée automatiquement. Les versions publiées ne sont ni modifiables ni supprimables
(conservation 40 ans, art. L4121-3-1 du Code du travail).

## Technique

HTML / CSS / JavaScript sans outil de build. Lecture et écriture Excel : [ExcelJS](https://github.com/exceljs/exceljs) 4.4.0 (licence MIT, copie locale dans `vendor/`).
PDF : impression du navigateur (« Enregistrer au format PDF »).
