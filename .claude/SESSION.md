# SESSION — État courant du projet

## Fil rouge (narration courte)

**Où on en est.** Sentinel Nudge entre en P5 après une P4' dense (saga fiabilisation M7 de 7 commits correctifs, post-mortem consolidé avec 15 UC catalogués, brand book Aegis Blue validé). Le mini-DAT TACHE-061 v1.1 a été validé (heartbeat + canary + registre incidents), le code correspondant est produit (239 tests OK) et attend le Référent qualité et le comité de revue code. Une PR rétrospective #3 `feature/p4-developpement → develop` a été ouverte pour figer la masse (68 commits).

**Où on va.** Boucler TACHE-061 (revue code + commit sur nouvelle branche courte), puis TACHE-058 (ADR SW-BOOT-CONTRACT + CROSS-LIFECYCLE-INTENT + audit modules), puis ouvrir le chantier UC P0 bloquants v1 (TACHE-068 à 073 : login multi-étape, password managers, iframes, toggle show/hide, inputs dynamiques) en parallèle des tests E2E.

**Pourquoi.** Option A v1 retenue par le Commanditaire (2026-04-14) : les 6 UC P0 sont bloquants pour la release v1. TACHE-061 pose l'infrastructure de détection amont pour éviter que les incidents type P-016/P-018 se répètent.

**Règles de flow adoptées (2026-04-16).** Niveau Exposé respecté : chaque tâche P5+ → branche courte + PR vers `develop`. Pas de cumul sur une feature géante.

## Projet
- **Nom** : Sentinel Nudge
- **Niveau de sensibilité** : Exposé
- **Dépôt GitHub** : https://github.com/antonyblain/sentinel-nudge
- **Date de création** : 2026-04-10

## État courant
- **Phase active** : P5 — Fiabilisation M7 + couverture UC P0 v1 (démarrée 2026-04-16)
- **Dernière action** : **Mini-DAT TACHE-061 v1.1 validé** — produit par Architecte logiciel, enrichi par Architecte sécurité (5 INV-SEC, 5 sections STRIDE, 8 contrôles ISO 27001, 3 nouveaux risques R-M7-05/06/07 dans RISQUES.md), contrôlé par Référent qualité (Validé avec commentaires — 2 bloquantes A-01/A-02 corrigées). 3 arbitrages ARB-061-01/02/03 tranchés par le Commanditaire selon recommandations (Option A / B / A). 2 tâches de suivi créées (TACHE-074 transmission DPO, TACHE-075 référentiel ISO 27001). Livrable : `docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md` — 2026-04-16.
- **Action précédente** : **Saga fiabilisation M7 terminée** — 7 commits correctifs (P-014 à P-020) : P-016 auto-régénération clé AES au boot SW, P-017 détection inputs password orphelins (3 stratégies submit+Enter+click), P-018 sérialisation Array<number> des clés crypto, P-019 pattern pending-intent avec TTL 10 min pour survivre aux redirects post-submit, P-020 promotion M7 en CRITICAL_MODULES (bypass quota 3/jour, cooldown 30j + suppression_list suffisent au rate-limit). Tests M7 **validés sur 3 sites réels** (saucedemo, herokuapp avec redirect, practicetestautomation via fallback Enter). Post-mortem consolidé avec 4 profils techniques : PV `gouvernance-pv-postmortem-m7-v1.0.md` produit + atelier PDCA + revue 15 cas d'usage (UC-01 à UC-15). **Option A retenue par Commanditaire** : v1 complète avec UC-01 à UC-06 (P0) couverts avant release. 16 commits au total sur feature/p4-developpement. 200 tests OK, CI verte, format/lint/build OK — 2026-04-14.
- **Prochaine action attendue** : **Implémentation TACHE-061** par le Développeur (heartbeat M7 + canary hash + registre incidents IndexedDB), selon mini-DAT v1.1 validé. Puis **TACHE-058** (ADR SW-BOOT-CONTRACT + CROSS-LIFECYCLE-INTENT + audit M2/M3/M5/M6/M9/M17). Puis UC P0 (TACHE-068 à 073) en parallèle des tests E2E.
- **Prochaines actions P5 consolidées** : **19 tâches** (17 + TACHE-074/075) réparties en 4 chantiers prioritaires :
  1. **UC P0 bloquants v1** (TACHE-068 à 073) : login multi-étape, password managers, iframes, toggle show/hide, inputs dynamiques
  2. **Patterns défensifs ADR + audit modules** (TACHE-058, TACHE-061, TACHE-062) : SW-BOOT-CONTRACT + CROSS-LIFECYCLE-INTENT, heartbeat M7, badge dégradé
  3. **Tests** (TACHE-059, TACHE-060, TACHE-063, TACHE-017 à 024, TACHE-048 à 053) : 12 scénarios TC-M7, mock chrome.storage JSON-strict, protocole recette formalisé, couverture popup.ts, atteindre 80% couverture (TACHE-026)
  4. **Corrections fonctionnelles** (TACHE-064, TACHE-067, TACHE-040 à 043) : filtrage autocomplete="new-password", MutationObserver type toggle, documentation DPO, hardening web_accessible_resources
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
| P4' | docs/p4-conception/brand-book-sentinel-nudge.md | v1.0 | Validé — palette Aegis Blue retenue | 2026-04-12 |
| P4' | docs/p4-conception/brand-book-preview.html | — | Preview interactive 5 palettes | 2026-04-12 |
| P4' | src/assets/styles/tokens.css | — | Tokens CSS centralisés Aegis Blue + dark mode | 2026-04-13 |
| P4' | src/assets/icons/icon.svg | — | Logo SVG source (bouclier + S + nudge) | 2026-04-13 |
| P4' | src/assets/icons/icon{16,48,128}.png | — | Icônes PNG réelles (générées depuis SVG) | 2026-04-13 |
| P4' | src/assets/icons/icon.svg + icon{16,48,128}.png | — | Logo HD vectorisé via potrace, viewBox maximisé (94.4% densité) | 2026-04-14 |
| P4' | docs/gouvernance/gouvernance-pv-revue-code-p4prime-v1.0.md | v1.0 | PV comité revue code P4' — 3 revues consolidées | 2026-04-14 |
| P4' | docs/p4-conception/p4prime-tests-manuels-modules-asynchrones-v1.0.md | v1.0 | Guide tests manuels M3/M5/M6/M7 avec commandes DevTools | 2026-04-14 |
| P4' | docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md | v1.0 | PV post-mortem M7 — 4 profils techniques, PDCA, 15 UC, score 2.0→3.4/5 | 2026-04-14 |
| P5 | docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md | v1.1 | Validé par Commanditaire — arbitrages ARB-061-01/02/03 tranchés | 2026-04-16 |

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
- Pages statiques d'explication : renommées avec noms parlants (sites-suspects.html, score-cyber-hygiene.html, mise-a-jour-navigateur.html, quiz-phishing.html, reutilisation-mots-de-passe.html, force-mots-de-passe.html, donnees-sensibles-presse-papiers.html). MODULE_INFOS dans options.ts et tous les handlers SW alignés.
- Brand Book validé 2026-04-12 : palette **Aegis Blue** retenue (proposition 1). Dark mode décidé pour v1 (pas v2). 10 tâches UX créées (TACHE-030 à TACHE-039) dans une phase P4' d'intégration design system.
- **Post-mortem M7 2026-04-14** : 3 causes racines identifiées (absence contrat de boot SW, hypothèses modèle de page trop restrictives, pyramide tests trop plate). 7 règles permanentes consolidées dans l'atelier PDCA, à diffuser dans LESSONS_LEARNED.md / TECH_STACK.md / OUTILS.md. Score de maturité M7 : 2.0/5 → 3.4/5 → cible 4.7/5 fin P5.
- **Option A v1 retenue 2026-04-14** : 6 cas d'usage P0 (UC-01 login multi-étape, UC-02 password managers, UC-03 iframes same-origin, UC-04 iframes cross-origin, UC-05 toggle show/hide, UC-06 inputs dynamiques) sont bloquants pour la release v1. Priorisation interne : UC-02 (password managers) et UC-05 (toggle) en premier car usage le plus fréquent.
- **ADR à produire en P5** : `SW-BOOT-CONTRACT` (tout handler avec prérequis storage implémente boot : lire → valider → régénérer/migrer → logger) et `CROSS-LIFECYCLE-INTENT` (toute action traversant dormance/redirect/réinjection est persistée en storage avec TTL, consommée à destination).
