# BACKLOG — Tâches et demandes de changement

| ID | Type | Titre | Priorité | Statut | Phase | Phase impactée | Responsable | Origine |
|----|------|-------|----------|--------|-------|----------------|-------------|---------|
| TACHE-001 | TÂCHE | Exploration littérature nudging cyber-hygiène | Must | Terminé | P1 | — | Analyste métier | Commanditaire |
| TACHE-002 | TÂCHE | Rédaction du cahier des charges (7 modules v1) | Must | Terminé | P1 | — | Analyste métier | Commanditaire |
| TACHE-003 | TÂCHE | Spécifications fonctionnelles détaillées (P2) | Must | Terminé | P2 | — | Analyste métier | Orchestrateur |
| TACHE-004 | TÂCHE | Analyse comparative des licences open source | Must | Terminé | P1 | — | Analyste métier | Commanditaire |
| TACHE-005 | TÂCHE | Définir la structure du corpus quiz M6 (format JSON, champs, niveaux) | Must | Terminé | P3 | — | Analyste métier | Orchestrateur |
| TACHE-006 | TÂCHE | Produire les 50 exemples du corpus quiz M6 (FR + EN) | Must | En cours | P4 | — | Analyste métier | Orchestrateur |
| TACHE-007 | TÂCHE | Rédiger les 7 pages d'explication statiques (cf. CdC 2.9.7) | Should | À faire | P4 | — | Analyste métier | Orchestrateur |
| TACHE-008 | TÂCHE | AIPD (Analyse d'Impact) pour le traitement M7 (hash mots de passe) | Must | À faire | P3 | — | DPO | Comité sécurité (D-SEC-005) |
| TACHE-009 | TÂCHE | Documenter le statut de responsable de traitement dans la politique de confidentialité | Should | À faire | P3 | — | DPO | Revue qualité P3 |
| TACHE-010 | TÂCHE | Checklist accessibilité des pages statiques (LA-06) | Should | À faire | P4 | — | Expert accessibilité | Revue qualité P3 |
| BACKLOG-M3-SCORING | TÂCHE | Implémenter les 5 composantes de scoring M3 avec pondération exacte | Must | Terminé | P4 | — | Développeur | score-calculator.ts TODO |
| BACKLOG-M2-HSTS | TÂCHE | Charger hsts-preload.json dans RiskAnalyzer et implémenter la vérification O(1) | Must | Terminé | P4 | — | Développeur | risk-analyzer.ts TODO |
| BACKLOG-M2-TARGETS | TÂCHE | Constituer la liste ~500 domaines typosquatting-targets.json | Must | À faire | P4 | — | Développeur | risk-analyzer.ts TODO |
| BACKLOG-M2-LEVENSHTEIN | TÂCHE | Intégrer typosquatting-targets.json dans checkLevenshtein() | Must | Terminé | P4 | — | Développeur | risk-analyzer.ts TODO |
| BACKLOG-M2-DOMAIN-HASH | TÂCHE | Implémenter SHA-256(salt + domain) dans password-detector.ts | Must | Terminé | P4 | — | Développeur | password-detector.ts TODO |
| BACKLOG-M6-QUIZ | TÂCHE | Implémenter overlay M6 avec spaced repetition et conditions de déclenchement | Must | Terminé | P4 | — | Développeur | alarm-manager.ts TODO |
| BACKLOG-M7-HASH | TÂCHE | Implémenter hash blur password + comparaison M7 dans password-detector.ts | Must | À faire | P4 | — | Développeur | password-detector.ts TODO |
| BACKLOG-M9-ZXCVBN | TÂCHE | Attacher listener input zxcvbn temps réel dans password-detector.ts | Must | À faire | P4 | — | Développeur | password-detector.ts TODO |
| BACKLOG-POPUP | TÂCHE | Implémenter popup.ts : demande état SW et affichage score M3 | Must | À faire | P4 | — | Développeur | popup.ts TODO |
| BACKLOG-OPTIONS | TÂCHE | Implémenter options.ts : formulaires config, droits RGPD, export/delete | Must | À faire | P4 | — | Développeur | options.ts TODO |
| BACKLOG-DASHBOARD | TÂCHE | Implémenter dashboard.ts : graphique SVG 52 semaines + table sr-only | Must | À faire | P4 | — | Développeur | dashboard.ts TODO |
| BACKLOG-ONBOARDING | TÂCHE | Implémenter onboarding.ts : 4 étapes + consentement M7 RGPD | Must | À faire | P4 | — | Développeur | onboarding.ts TODO |
| BACKLOG-STORAGE-INT | TÂCHE | Implémenter tests intégration StorageService avec fake-indexeddb | Must | À faire | P4 | — | Testeur QA | storage-service.test.ts TODO |
| BACKLOG-MIGRATION-V2 | TÂCHE | Prévoir migrations IndexedDB v2 dans MIGRATIONS tableau | Should | À faire | P4 | — | Développeur | service-worker.ts TODO |
| BACKLOG-PAGES-STATIC | TÂCHE | Créer les 7 pages HTML statiques d'explication (m2 à m17) | Must | À faire | P4 | — | Développeur | DAT §5 arborescence |

## Légende
- **Type TÂCHE** : tâche de production normale
- **Type CHANGEMENT** : demande de modification impactant une phase antérieure
- **Type BUG** : anomalie détectée en phase de test
- **Priorité MoSCoW** : Must (indispensable), Should (important), Could (souhaitable), Won't (exclu du périmètre actuel)
