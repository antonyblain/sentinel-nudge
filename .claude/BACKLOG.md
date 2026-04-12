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
| TACHE-030 | TÂCHE | UX-01 — Créer les icônes réelles 16/48/128px (bloque Chrome Web Store) | Must | À faire | P4' | Expert UX/UI + Développeur | Brand Book §1.2 |
| TACHE-031 | TÂCHE | UX-03 — Appliquer la palette Aegis Blue (tokens CSS validés) | Must | À faire | P4' | Développeur | Brand Book §3 — Arbitrage Commanditaire |
| TACHE-032 | TÂCHE | UX-02 — Centraliser les tokens CSS dans src/assets/styles/tokens.css | Must | À faire | P4' | Développeur | Brand Book §1.2 |
| TACHE-033 | TÂCHE | UX-04 — Tokeniser les couleurs hardcodées hors design system (surface, border, danger-bg, success-bg, warning-bg) | Must | À faire | P4' | Développeur | Brand Book §1.2 |
| TACHE-034 | TÂCHE | UX-06 — Implémenter le dark mode (@media prefers-color-scheme: dark) dès v1 | Must | À faire | P4' | Développeur | Brand Book §7.2 — Décision Commanditaire |
| TACHE-035 | TÂCHE | UX-05 — Corriger titre popup : utiliser --sn-color-fg ou primary au lieu de accent | Should | À faire | P4' | Développeur | Brand Book §1.2 |
| TACHE-036 | TÂCHE | UX-07 — Supprimer double déclaration .about-link display dans options.css | Should | À faire | P4' | Développeur | Brand Book §1.2 |
| TACHE-037 | TÂCHE | UX-08 — Fusionner règle border:none orpheline .btn dans options.css | Should | À faire | P4' | Développeur | Brand Book §1.2 |
| TACHE-038 | TÂCHE | UX-09 — Remplacer emoji 🔄 par icône SVG inline dans toast-m5 | Should | À faire | P4' | Développeur | Brand Book §1.2 |
| TACHE-039 | TÂCHE | UX-10 — Ajouter max-height:480px + overflow-y:auto sur popup body | Should | À faire | P4' | Développeur | Brand Book §1.2 |
| TACHE-040 | TÂCHE | Mettre à jour AIPD §1.3 — ajouter chrome.storage.local comme lieu de stockage whitelist M2 | Should | À faire | P5 | DPO | Revue DPO whitelist M2 |
| TACHE-041 | TÂCHE | Documenter comportement HTTP/HTTPS hash (FNV-1a ≠ SHA-256 pour même domaine) dans DAT | Should | À faire | P5 | Architecte logiciel | R-SEC-02 / R-020 |
| TACHE-042 | TÂCHE | Fusionner whitelist chrome.storage.local + IndexedDB dans l'export portabilité RGPD Art. 20 | Could | À faire | P5 | Développeur | Revue DPO |
| TACHE-043 | TÂCHE | Plafonner taille whitelist M2 chrome.storage.local (10 000 entrées max) | Could | À faire | P5 | Développeur | R-SEC-04 |

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

### P4' — Intégration design system (Brand Book)
- TACHE-030 : Icônes réelles 16/48/128px (Critique — bloque Chrome Web Store)
- TACHE-031 : Appliquer palette Aegis Blue (tokens validés par Commanditaire)
- TACHE-032 : Centraliser tokens CSS dans fichier partagé
- TACHE-033 : Tokeniser couleurs hardcodées hors système
- TACHE-034 : Dark mode v1 (prefers-color-scheme: dark)
- TACHE-035 : Titre popup — couleur sémantique correcte
- TACHE-036 : Double déclaration .about-link
- TACHE-037 : border:none orpheline .btn
- TACHE-038 : Emoji → SVG toast-m5
- TACHE-039 : max-height popup

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
