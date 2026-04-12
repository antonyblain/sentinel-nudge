# SESSION — État courant du projet

## Projet
- **Nom** : Sentinel Nudge
- **Niveau de sensibilité** : Exposé
- **Dépôt GitHub** : https://github.com/antonyblain/sentinel-nudge
- **Date de création** : 2026-04-10

## État courant
- **Phase active** : P4 — Développement (fin de sprint)
- **Dernière action** : Tests Commanditaire P4 complets — M17 ✅, M9 ✅, M2 ✅, popup ✅, options ✅, onboarding ✅, dashboard ✅. M7/M5/M3/M6 non testés (conditions spéciales). Bugs mineurs restants : liens "En savoir plus", focus bouton "Continuer", logs diagnostic à retirer, dialogue suppression — 2026-04-12
- **Prochaine action attendue** : Corriger bugs mineurs restants, retirer logs diagnostic, analyse code mort, puis P5 tests (couverture 80%).
- **Branche Git active** : feature/p4-developpement

## Livrables produits

| Phase | Livrable | Version | Statut | Date |
|-------|----------|---------|--------|------|
| P1 | p1-analyse-litterature-nudging-v2.0.md | v2.0 | Validé | 2026-04-11 |
| P1 | p1-cahier-des-charges-v1.1.md | v1.1 | Validé | 2026-04-11 |
| P1 | p1-analyse-licences-open-source-v1.0.md | v1.0 | Validé (GPL v3 retenue) | 2026-04-11 |
| P2 | gouvernance-pv-securite-p2-v1.0.md | v1.0 | Produit | 2026-04-11 |
| P2 | p2-sfd-v1.1.md | v1.1 | Validé | 2026-04-11 |
| P3 | p3-dat-v1.1.md | v1.1 | Validé | 2026-04-11 |
| P3 | gouvernance-pv-architecture-v1.0.md | v1.0 | Validé | 2026-04-11 |
| P3 | p3-aipd-m7-v1.0.md | v1.0 | Validé (D-SEC-005 satisfait) | 2026-04-11 |
| P4 | src/background/handlers/m5-handler.ts | — | Implémenté | 2026-04-12 |
| P4 | src/content-scripts/ui/toast-m5.ts | — | Implémenté + i18n | 2026-04-12 |
| P4 | src/background/score-calculator.ts | — | Refondu (5 composantes M3) | 2026-04-12 |
| P4 | src/background/handlers/m3-handler.ts | — | Implémenté | 2026-04-12 |
| P4 | src/background/handlers/m6-handler.ts | — | Implémenté | 2026-04-12 |
| P4 | src/content-scripts/ui/toast-m6.ts | — | Implémenté | 2026-04-12 |
| P4 | src/content-scripts/ui/overlay-m6.ts | — | Implémenté + i18n (TACHE-014) | 2026-04-12 |
| P4 | src/content-scripts/ui/overlay-m2.ts | — | Implémenté + i18n (TACHE-014) | 2026-04-12 |
| P4 | src/content-scripts/ui/overlay-m9.ts | — | Implémenté + i18n (TACHE-014) | 2026-04-12 |
| P4 | src/content-scripts/ui/toast-m7.ts | — | Implémenté + i18n (TACHE-014) | 2026-04-12 |
| P4 | src/content-scripts/ui/toast-m17.ts | — | Implémenté + i18n (TACHE-014) | 2026-04-12 |
| P4 | src/assets/data/quiz-corpus.json | — | 20 questions (15 FR + 5 EN) | 2026-04-12 |
| P4 | src/background/service-worker.ts | — | M3/M5/M6 intégrés | 2026-04-12 |
| P4 | src/pages/popup/popup.ts | — | Implémenté | 2026-04-12 |
| P4 | src/pages/popup/popup.css | — | Implémenté | 2026-04-12 |
| P4 | src/pages/options/options.ts | — | handleExport() réel + dialog accessible (TACHE-013/015) | 2026-04-12 |
| P4 | src/pages/options/options.css | — | Implémenté | 2026-04-12 |
| P4 | src/pages/onboarding/onboarding.ts | — | Implémenté | 2026-04-12 |
| P4 | src/pages/onboarding/onboarding.css | — | Implémenté | 2026-04-12 |
| P4 | src/pages/dashboard/dashboard.ts | — | Implémenté | 2026-04-12 |
| P4 | src/pages/dashboard/dashboard.css | — | Implémenté | 2026-04-12 |
| P4 | src/pages/static/m2-explication.html | — | Créé (TACHE-012) | 2026-04-12 |
| P4 | src/pages/static/m3-explication.html | — | Créé (TACHE-012) | 2026-04-12 |
| P4 | src/pages/static/m5-explication.html | — | Créé (TACHE-012) | 2026-04-12 |
| P4 | src/pages/static/m6-explication.html | — | Créé (TACHE-012) | 2026-04-12 |
| P4 | src/pages/static/m7-explication.html | — | Créé (TACHE-012) | 2026-04-12 |
| P4 | src/pages/static/m9-explication.html | — | Créé (TACHE-012) | 2026-04-12 |
| P4 | src/pages/static/m17-explication.html | — | Créé (TACHE-012) | 2026-04-12 |
| P4 | src/assets/data/typosquatting-targets.json | — | Enrichi 20→200 domaines (TACHE-011) | 2026-04-12 |
| P4 | src/assets/_locales/fr/messages.json | — | Étendu (170+ clés) | 2026-04-12 |
| P4 | src/assets/_locales/en/messages.json | — | Étendu (170+ clés) | 2026-04-12 |
| P4 | src/manifest.json | — | web_accessible_resources ajouté | 2026-04-12 |
| P4 | vite.config.ts | — | additionalInputs dashboard/onboarding | 2026-04-12 |
| P4 | tests/unit/modules/m5.test.ts | — | 15 tests OK | 2026-04-12 |
| P4 | tests/unit/modules/m3.test.ts | — | 35 tests OK | 2026-04-12 |
| P4 | tests/unit/modules/m6.test.ts | — | 23 tests OK | 2026-04-12 |

## Actions manuelles en attente

| ID | Titre | Statut |
|----|-------|--------|

## Notes de session
- Projet open-source d'extension navigateur de cyber-hygiène comportementale
- 20 modules de nudging catalogués (littérature + propositions Commanditaire + analyste)
- Lotissement v1 validé : 7 modules (M2, M3, M5, M6, M7, M9, M17)
- Lotissement v2 : 4 modules Should restants (M4, M11, M13, M20)
- Privacy by design : tout traitement local, aucune télémétrie
- Manifest V3 obligatoire, permissions minimales
- Contrainte transversale : quota 3 nudges/jour par défaut (augmentable à 5, 10 ou Tous)
- Licence : GPL v3 validée par le Commanditaire (2026-04-11), appliquée sur le dépôt
- Gestionnaires mdp : uniquement projets open source nommés (KeePass, KeePassXC, Bitwarden, Vaultwarden)
- M5 : détection via chrome.runtime.requestUpdateCheck() (API native, pas de version embarquée)
- Couche d'abstraction navigateur à prévoir dès v1 pour compatibilité future Firefox/Edge
- M3 score-calculator : pondérations M5=20, M6=25, M2=20, M7=20, M9=15. Redistribution proportionnelle si modules désactivés.
- M6 spaced repetition : intervalles [0, 7, 21, 42, 70] jours puis 30j/mois. Score <50% → ×0.7, score 100% → ×1.2
- Pages UI : dashboard et onboarding ajoutés en additionalInputs dans vite.config.ts (non référençables via propriétés MV3 standard)
- TACHE-013 (handleExport) : les handlers SW pour EXPORT (get_all_events, get_all_quiz_sessions, get_whitelist, get_password_hash_meta) restent à implémenter côté service-worker.ts — gap fonctionnel connu, non bloquant pour le build
- Pages statiques d'explication : nommées m{n}-explication.html (conforme à TACHE-012), MODULE_INFOS dans options.ts aligné en conséquence
