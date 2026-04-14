# BACKLOG — Tâches et demandes de changement

| ID | Type | Titre | Priorité | Statut | Phase | Responsable | Origine |
|----|------|-------|----------|--------|-------|-------------|---------|
| TACHE-001 | TÂCHE | Exploration littérature nudging cyber-hygiène | Must | Terminé | P1 | Analyste métier | Commanditaire |
| TACHE-002 | TÂCHE | Rédaction du cahier des charges (7 modules v1) | Must | Terminé | P1 | Analyste métier | Commanditaire |
| TACHE-003 | TÂCHE | Spécifications fonctionnelles détaillées (P2) | Must | Terminé | P2 | Analyste métier | Orchestrateur |
| TACHE-004 | TÂCHE | Analyse comparative des licences open source | Must | Terminé | P1 | Analyste métier | Commanditaire |
| TACHE-005 | TÂCHE | Définir la structure du corpus quiz M6 | Must | Terminé | P3 | Analyste métier | Orchestrateur |
| TACHE-006 | TÂCHE | Compléter le corpus quiz M6 de 20 à 50+ questions bilingues FR/EN | Must | Terminé | P4 | Analyste métier | Orchestrateur |
| TACHE-007 | TÂCHE | Rédiger les 7 pages d'explication statiques HTML (CdC §2.9.7) | Must | Terminé | P4 | Analyste métier | Orchestrateur |
| TACHE-008 | TÂCHE | AIPD M7 (Analyse d'Impact Protection Données) | Must | Terminé | P3 | DPO | D-SEC-005 |
| TACHE-009 | TÂCHE | Documenter le statut de responsable de traitement dans la politique de confidentialité | Should | À faire | P4 | DPO | Revue qualité P3 |
| TACHE-010 | TÂCHE | Checklist accessibilité des pages statiques (LA-06) | Should | À faire | P5 | Expert accessibilité | Revue qualité P3 |
| TACHE-011 | TÂCHE | Constituer la liste ~500 domaines typosquatting-targets.json | Must | Terminé | P4 | Développeur | risk-analyzer.ts |
| TACHE-012 | TÂCHE | Créer les 7 pages HTML statiques d'explication | Must | Terminé | P4 | Développeur | DAT §5 |
| TACHE-013 | TÂCHE | Compléter export RGPD Art. 20 (options.ts) — déchiffrer les données réelles | Must | Terminé | P4 | Développeur | RSV-DPO-01 |
| TACHE-014 | TÂCHE | Intégrer i18n (browser.i18n.getMessage) dans les composants content-scripts | Must | Terminé | P4 | Développeur | UX-015 |
| TACHE-015 | TÂCHE | Remplacer window.confirm() par un dialogue HTML accessible dans options.ts | Should | Terminé | P4 | Développeur | ACC-07 |
| TACHE-016 | TÂCHE | Ajouter aria-describedby dynamique sur overlay-m6 (question courante) | Should | Terminé | P4 | Développeur | ACC-06 |
| TACHE-017 | TÂCHE | Tests unitaires m3-handler (0% couverture) | Must | À faire | P5 | Testeur QA | TM-001 |
| TACHE-018 | TÂCHE | Tests unitaires storage-service avec fake-indexeddb (0% couverture, 666 lignes) | Must | À faire | P5 | Testeur QA | TM-004 |
| TACHE-019 | TÂCHE | Tests unitaires message-router (0% couverture) | Must | À faire | P5 | Testeur QA | TM-005 |
| TACHE-020 | TÂCHE | Tests unitaires alarm-manager (0% couverture) | Must | À faire | P5 | Testeur QA | TM-008 |
| TACHE-021 | TÂCHE | Test handleCheckQuiz M6 (date dépassée, quiz disponible) | Must | À faire | P5 | Testeur QA | TM-002 |
| TACHE-022 | TÂCHE | Test cooldown 30j M7 fonctionnel (pas factice) | Must | À faire | P5 | Testeur QA | TM-003 |
| TACHE-023 | TÂCHE | Test exclusion champ password dans paste-detector M17 | Must | À faire | P5 | Testeur QA | TM-006 |
| TACHE-024 | TÂCHE | Test comparaison crypto M7 avec environnement Node.js natif | Must | À faire | P5 | Testeur QA | TM-007 |
| TACHE-025 | TÂCHE | Ajouter @vitest/coverage-v8 dans devDependencies + script test:coverage | Must | À faire | P5 | Développeur | TM-020 |
| TACHE-026 | TÂCHE | Atteindre 80% couverture de tests (niveau Exposé) | Must | À faire | P5 | Testeur QA | Comité revue code |
| TACHE-027 | TÂCHE | Tests E2E Playwright avec extension réelle (service-worker, onboarding) | Should | À faire | P6 | Testeur QA | TM-017 |
| TACHE-028 | TÂCHE | Resserrer web_accessible_resources (remplacer <all_urls>) | Should | À faire | P5 | Architecte sécurité | MIN-002 |
| TACHE-029 | TÂCHE | Prévoir migrations IndexedDB v2 dans MIGRATIONS | Should | À faire | P4 | Développeur | BACKLOG-MIGRATION-V2 |
| TACHE-030 | TÂCHE | UX-01 — Créer les icônes réelles 16/48/128px (bloque Chrome Web Store) | Must | Terminé | P4' | Expert UX/UI + Développeur | Brand Book §1.2 |
| TACHE-031 | TÂCHE | UX-03 — Appliquer la palette Aegis Blue (tokens CSS validés) | Must | Terminé | P4' | Développeur | Brand Book §3 — Arbitrage Commanditaire |
| TACHE-032 | TÂCHE | UX-02 — Centraliser les tokens CSS dans src/assets/styles/tokens.css | Must | Terminé | P4' | Développeur | Brand Book §1.2 |
| TACHE-033 | TÂCHE | UX-04 — Tokeniser les couleurs hardcodées hors design system (surface, border, danger-bg, success-bg, warning-bg) | Must | Terminé | P4' | Développeur | Brand Book §1.2 |
| TACHE-034 | TÂCHE | UX-06 — Implémenter le dark mode (@media prefers-color-scheme: dark) dès v1 | Must | Terminé | P4' | Développeur | Brand Book §7.2 — Décision Commanditaire |
| TACHE-035 | TÂCHE | UX-05 — Corriger titre popup : utiliser --sn-color-fg ou primary au lieu de accent | Should | Terminé | P4' | Développeur | Brand Book §1.2 |
| TACHE-036 | TÂCHE | UX-07 — Supprimer double déclaration .about-link display dans options.css | Should | Terminé | P4' | Développeur | Brand Book §1.2 |
| TACHE-037 | TÂCHE | UX-08 — Fusionner règle border:none orpheline .btn dans options.css | Should | Terminé | P4' | Développeur | Brand Book §1.2 |
| TACHE-038 | TÂCHE | UX-09 — Remplacer emoji 🔄 par icône SVG inline dans toast-m5 | Should | Reporté P5 | P4' | Développeur | Brand Book §1.2 |
| TACHE-039 | TÂCHE | UX-10 — Ajouter max-height:480px + overflow-y:auto sur popup body | Should | Terminé | P4' | Développeur | Brand Book §1.2 |
| TACHE-040 | TÂCHE | Mettre à jour AIPD §1.3 — ajouter chrome.storage.local comme lieu de stockage whitelist M2 | Should | À faire | P5 | DPO | Revue DPO whitelist M2 |
| TACHE-041 | TÂCHE | Documenter comportement HTTP/HTTPS hash (FNV-1a ≠ SHA-256 pour même domaine) dans DAT | Should | À faire | P5 | Architecte logiciel | R-SEC-02 / R-020 |
| TACHE-042 | TÂCHE | Fusionner whitelist chrome.storage.local + IndexedDB dans l'export portabilité RGPD Art. 20 | Could | À faire | P5 | Développeur | Revue DPO |
| TACHE-043 | TÂCHE | Plafonner taille whitelist M2 chrome.storage.local (10 000 entrées max) | Could | À faire | P5 | Développeur | R-SEC-04 |
| TACHE-044 | TÂCHE | Corriger double JSDoc orphelin renderStatusSection (popup.ts) | Must | Terminé | P4' | Développeur | Comité revue code P4' |
| TACHE-045 | TÂCHE | Ajouter 5 clés i18n manquantes (popup_modules_label, popup_quota_*_sub, popup_status_aria_label) | Must | Terminé | P4' | Développeur | Comité revue code P4' |
| TACHE-046 | TÂCHE | Remplacer magic number `7` par MODULE_IDS.length dans popup.ts | Should | Terminé | P4' | Développeur | Comité revue code P4' |
| TACHE-047 | TÂCHE | Traduire aria-label de la section statut popup via browser.i18n | Should | Terminé | P4' | Développeur | Comité revue code P4' |
| TACHE-048 | TÂCHE | Tests unitaires popup.ts fonctions pures (scoreColor, scoreLevelLabel, getNextMonday) | Must | À faire | P5 | Testeur QA | Comité revue code P4' |
| TACHE-049 | TÂCHE | Tests unitaires popup.ts constructeurs DOM (createInlineIcon, createStatusLabel, createStatusValueGroup) | Must | À faire | P5 | Testeur QA | Comité revue code P4' |
| TACHE-050 | TÂCHE | Tests unitaires popup.ts sections de rendu (renderScoreSection, renderStatusSection, renderActionsSection) | Must | À faire | P5 | Testeur QA | Comité revue code P4' |
| TACHE-051 | TÂCHE | Tests unitaires popup.ts chemin catch initPopup (role=alert) | Should | À faire | P5 | Testeur QA | Comité revue code P4' |
| TACHE-052 | TÂCHE | Finaliser TACHE-025 — script test:coverage + section coverage dans vite.config.ts (seuils 80%) | Must | À faire | P5 | Développeur | Comité revue code P4' |
| TACHE-053 | TÂCHE | Remplacer 2 fichiers intégration squelettes par des tests réels (storage-service, service-worker) | Must | À faire | P5 | Testeur QA | Comité revue code P4' |
| TACHE-054 | TÂCHE | Documenter ou ajouter en devDependencies explicites `pngjs` et `potrace` (reproductibilité vectorisation logo) | Should | À faire | P5 | DevSecOps | R-022 |
| TACHE-055 | TÂCHE | Déplacer .claude/launch.json vers .vscode/launch.json ou documenter le placement actuel | Could | À faire | P5 | Dev | R-023 |
| TACHE-056 | TÂCHE | Pattern pending_toast M7 — survit à la navigation post-submit (storage.local + storage.onChanged) | Should | Terminé | P4' | Développeur | Test manuel M7 site herokuapp |
| TACHE-057 | TÂCHE | Promouvoir M7 en module critique (bypass quota) — le cooldown 30j + suppression_list suffisent au rate-limit | Must | Terminé | P4' | Développeur | Test manuel M7 quota_exceeded bloquant |

## Actions résiduelles par phase

### P4 — Développement (terminé)
- ~~TACHE-006~~ : corpus quiz 50 questions ✅
- ~~TACHE-007 + TACHE-012~~ : 7 pages statiques HTML ✅ (renommées avec noms parlants)
- ~~TACHE-011~~ : 496 domaines typosquatting ✅
- ~~TACHE-013~~ : export RGPD fonctionnel ✅
- ~~TACHE-014~~ : i18n content-scripts ✅
- ~~TACHE-015~~ : dialogue accessible suppression ✅
- TACHE-009 : politique de confidentialité (reporté P5)
- TACHE-029 : migrations IndexedDB v2 (reporté P5)

### P4' — Intégration design system (Brand Book) — Terminé
- ~~TACHE-030~~ : Icônes réelles SVG→PNG ✅
- ~~TACHE-031~~ : Palette Aegis Blue appliquée ✅
- ~~TACHE-032~~ : Tokens CSS centralisés (tokens.css) ✅
- ~~TACHE-033~~ : Couleurs hardcodées tokenisées ✅
- ~~TACHE-034~~ : Dark mode v1 ✅
- ~~TACHE-035~~ : Titre popup → primary ✅
- ~~TACHE-036~~ : Double .about-link corrigé ✅
- ~~TACHE-037~~ : .btn orphelin fusionné ✅
- TACHE-038 : Emoji → SVG toast-m5 (reporté P5 — toast M5 pas encore implémenté côté content-script)
- ~~TACHE-039~~ : max-height popup ✅

### P5 — Tests unitaires
- TACHE-017 à TACHE-024 : tests manquants (handlers, storage, router, alarms)
- TACHE-025 : coverage-v8 + script
- TACHE-026 : objectif 80% couverture
- TACHE-010 : checklist accessibilité pages statiques
- TACHE-028 : resserrer web_accessible_resources

### P6 — Tests d'intégration
- TACHE-027 : tests E2E Playwright avec extension réelle

## Légende
- **Type TÂCHE** : tâche de production normale
- **Type CHANGEMENT** : demande de modification impactant une phase antérieure
- **Type BUG** : anomalie détectée en phase de test
- **Priorité MoSCoW** : Must (indispensable), Should (important), Could (souhaitable), Won't (exclu du périmètre actuel)
