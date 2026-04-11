# LEÇONS APPRISES — Amélioration continue

Ce fichier est alimenté en continu après chaque problème résolu (PDCA Act) et synthétisé lors de la rétrospective de fin de projet.

## Leçons

| ID | Date | Catégorie | Ce qui s'est passé | Ce qui a bien fonctionné | Ce qui a échoué | Amélioration appliquée |
|----|------|-----------|--------------------|--------------------------|-----------------|-----------------------|
| LL-001 | 2026-04-11 | Processus | Production de 3 fichiers distincts pour un même livrable (draft, v1.0, compléments) au lieu de maintenir un seul document | La grille d'analyse uniforme et la rigueur scientifique | La multiplication des fichiers a créé de la confusion pour le Commanditaire | Règle : mettre à jour le document en place pour des modifications mineures, ou incrémenter la version majeure et supprimer l'ancienne version. Ne jamais laisser plusieurs versions d'un même livrable coexister. |
| LL-002 | 2026-04-11 | Technique | Tentative de lecture d'un fichier de 24468 tokens (CdC v1.0, ~1500 lignes) sans offset/limit, provoquant une erreur de dépassement du seuil de 10000 tokens | Le fallback avec offset+limit par blocs de 200 lignes a fonctionné | La première tentative en lecture intégrale a échoué et gaspillé un appel outil | **Règle permanente** : tout fichier susceptible de dépasser 200 lignes doit être lu par blocs (offset+limit de 200 lignes max) ou via Grep ciblé sur les sections pertinentes. Avant de lire un fichier volumineux, estimer sa taille ou utiliser Grep pour localiser la section d'intérêt. |

_Ce fichier est consolidé à chaque rétrospective de fin de projet. Les enseignements les plus importants sont intégrés dans les fichiers du plugin (.claude/) pour les projets futurs._
