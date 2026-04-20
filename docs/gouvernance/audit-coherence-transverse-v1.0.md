# Audit de cohérence transverse — Sentinel Nudge v1

**Document** : `docs/gouvernance/audit-coherence-transverse-v1.0.md`
**Date** : 2026-04-20
**Auteur** : Référent qualité (T-205)
**Phase** : P5 / gouvernance transverse
**Niveau de sensibilité** : Exposé

---

## 1. Objectif, portée, méthode

### 1.1 Objectif

Vérifier la traçabilité descendante depuis les documents fondateurs (CdC v1.1, SFD v1.2, DAT v1.5) jusqu'au code source (`src/`) et aux tests (`tests/`), identifier les gaps bloquant la MEP v1, les arbitrages pendants non résolus, et les incohérences inter-documentaires.

### 1.2 Portée

7 modules v1 (M2, M3, M5, M6, M7, M9, M17), 6 use cases P0 (UC-01 à UC-06), 69 critères d'acceptation, 33 exigences non fonctionnelles, 18 risques actifs, 2 ADR, 28 écarts ADR documentés, périmètre RGPD 10 traitements, accessibilité WCAG 2.1 AA.

### 1.3 Méthode

Grep ciblé par référentiel d'IDs sur l'ensemble du dépôt. Lecture partielle (TOC + sections clés) des documents fondateurs. Cross-référencement BACKLOG.md / RISQUES.md / src/ / tests/. Aucun script Python, aucun heredoc bash.

**Documents lus (partiellement)** : p1-cahier-des-charges-v1.1.md, p2-sfd-v1.2.md, p3-dat-v1.5.md, p3-aipd-m7-v1.3.md, plan-tests-manuels-consolide-v1.0.md, p5-audit-modules-adr-compliance-v1.0.md, registre-des-traitements-v1.1.md, politique-de-confidentialite-v1.2.md, referentiel-iso27001-v1.2.md, checklist-accessibilite-v1.1.md, BACKLOG.md, RISQUES.md.

---

## 2. Matrice de traçabilité principale

### 2.1 Exigences fonctionnelles CdC → SFD → DAT → code → tests

| Réf. CdC | Module | SFD | DAT | Src | Tests | Statut |
|---|---|---|---|---|---|---|
| CdC 2.2 | M2 — saisie contexte risqué | SFD §2.1 ✓ | DAT §3/§9 ✓ | `m2-handler.ts`, `risk-analyzer.ts`, `m2-boot-service.ts` ✓ | `m2.test.ts` ✓ | ✅ Conforme |
| CdC 2.3 | M3 — score cyber-hygiène | SFD §2.2 ✓ | DAT §3 ✓ | `m3-handler.ts`, `m3-boot-service.ts`, `score-calculator.ts` ✓ | `storage-service.test.ts` partiel | 🟡 Partiel (diagnostics.m3 livré T-086) |
| CdC 2.4 | M5 — rappel MAJ navigateur | SFD §2.3 ✓ | DAT §3 ✓ | `m5-handler.ts`, `m5-boot-service.ts` ✓ | Couverture unitaire faible | 🟡 Partiel |
| CdC 2.5 | M6 — quiz phishing | SFD §2.4 ✓ | DAT §3 ✓ | `m6-handler.ts`, `m6-boot-service.ts` ✓ | Couverture unitaire faible | 🟡 Partiel |
| CdC 2.6 | M7 — nudge gestionnaire mdp | SFD §2.5 + §9 ✓ | DAT §3/§17/§18 ✓ | `m7-handler.ts`, `heartbeat-service.ts`, `canary-service.ts` ✓ | 47+ tests (T-059/082/076/096) ✓ | ✅ Conforme |
| CdC 2.7 | M9 — force mot de passe | SFD §2.6 ✓ | DAT §3 ✓ | `m9-handler.ts`, `m9-boot-service.ts` ✓ | `password-detector-*` partiels | 🟡 Partiel |
| CdC 2.8 | M17 — alerte copier-coller | SFD §2.7 ✓ | DAT §3 ✓ | `m17-handler.ts`, `paste-detector.ts`, `m17-boot-service.ts` ✓ | `paste-detector-m17-password-exclusion.test.ts` ✓ | 🟡 Partiel |

**Composants transversaux** :

| Réf. CdC | Composant | SFD | DAT | Src | Tests | Statut |
|---|---|---|---|---|---|---|
| CdC 2.9.1 | Système de quota | SFD §3.1 ✓ | DAT §3 ✓ | `quota-manager.ts` ✓ | ✓ | ✅ Conforme |
| CdC 2.9.2 | Stockage local | SFD §3.2 ✓ | DAT §8 ✓ | `storage-service.ts` ✓ | `storage-service.test.ts` ✓ | ✅ Conforme |
| CdC 2.9.3 | Onboarding | SFD §3.3 ✓ | DAT §3 ✓ | `onboarding.ts` ✓ | Couverture faible | 🟡 Partiel |
| CdC 2.9.4 | Paramètres | SFD §3.4 ✓ | DAT §3 ✓ | `options.ts` ✓ | **BUG T-197 ouvert** | 🔴 Gap critique |
| CdC 2.9.5 | Dashboard | SFD §3.5 ✓ | DAT §3 ✓ | `dashboard.ts` ✓ | `accessibility-themes.spec.ts` partiel | 🟡 Partiel |
| CdC 2.9.7 | Pages statiques | SFD §3.7 ✓ | DAT §3 ✓ | 7 pages statiques ✓ | Tests axe-core ✓ | ✅ Conforme |
| ENF-PBD-09 | Droit à la portabilité | SFD §4.1 ✓ | DAT §14 ✓ | `export-handler.ts` ✓ | **Aucun test unitaire** | 🟡 Partiel |

> **Note critique** : `CA-GLOBAL-02` (désactivation d'un module) est directement affecté par `TACHE-197` (BUG — bouton radio ne fonctionne pas). C'est un critère d'acceptation global du CdC, bloquant MEP.

### 2.2 Modules M1-M17 : spécification → architecture → code → recette

| Module | CdC | SFD | DAT | Src | Tests auto | Recette manuelle | Statut |
|---|---|---|---|---|---|---|---|
| M2 | ✓ v1 | ✓ §2.1 | ✓ | `m2-handler.ts` + `m2-boot-service.ts` | Unitaires ✓ | Plan §9 (3 scénarios) | 🟡 Partiel (ADR-001 : 3 écarts résiduels non encore vérifiés formellement) |
| M3 | ✓ v1 | ✓ §2.2 | ✓ | `m3-handler.ts` + `score-calculator.ts` | Unitaires partiels | Plan §10 (2 scénarios) | 🟡 Partiel (ADR-001 : 3 écarts T-086 livré) |
| M5 | ✓ v1 | ✓ §2.3 | ✓ | `m5-handler.ts` + `m5-boot-service.ts` | Faibles | Plan §11 (2 scénarios) | 🟡 Partiel (ADR-001+002 : 7 écarts T-087 livré) |
| M6 | ✓ v1 | ✓ §2.4 | ✓ | `m6-handler.ts` + `m6-boot-service.ts` | Faibles | Plan §12 (2 scénarios) | 🟡 Partiel (ADR-001+002 : 7 écarts T-088 livré) |
| M7 | ✓ v1 | ✓ §2.5 + stub §9 | ✓ §3/§17/§18 | Complet (8 fichiers) | 47+ tests ✓ | Plan §15 (recette providers) + UC-01 à UC-06 | ✅ Conforme (référence canonique) |
| M9 | ✓ v1 | ✓ §2.6 | ✓ | `m9-handler.ts` + `m9-boot-service.ts` | Partiels | Plan §13 (2 scénarios) | 🟡 Partiel (ADR-001 : 1 écart T-089 livré) |
| M17 | ✓ v1 | ✓ §2.7 | ✓ | `m17-handler.ts` + `paste-detector.ts` + `m17-boot-service.ts` | `paste-detector` ✓ | Plan §14 (3 scénarios) | 🟡 Partiel (ADR-002 : 4 écarts T-090 livré) |
| M1, M4, M8, M10-M16, M19-M20 | CdC §6.2 (v2/v3) | Absent | Absent | Absent | Absent | Absent | ✅ Conforme (hors périmètre v1, explicitement reporté) |

### 2.3 Use Cases UC-01 à UC-06 : SFD → mini-DAT → code → tests → recette

| UC | Titre | SFD §9 | Mini-DAT | Code | Tests unit | Tests E2E | Recette manuelle | Statut |
|---|---|---|---|---|---|---|---|---|
| UC-01 | Login multi-étape (Google, Microsoft) | ✓ stub | `p5-minidat-tache-068-uc01-v1.1.md` ✓ | `password-detector.ts` (F-UC01-01 T-101) ✓ | `password-detector-uc01.test.ts` ✓ | Absent (T-175 À faire) | **En cours — Commanditaire requis** | 🟡 Partiel |
| UC-02 | Password managers | ✓ stub | Post-mortem M7 §UC-02 (pas de mini-DAT dédié) | `password-detector.ts` ✓ | `password-detector-isTrusted.test.ts` ✓ | Absent (T-175) | Plan §5 ✓ | 🟡 Partiel (mini-DAT manquant, T-175 À faire) |
| UC-03 | Iframes same-origin | ✓ stub | `p5-minidat-tache-070-uc03-iframes-v1.1.md` ✓ | `password-detector-uc03.test.ts` ✓ | Tests unitaires ✓ | Absent (T-175) | Plan §6 ✓ | 🟡 Partiel |
| UC-04 | Iframes cross-origin | ✓ stub | Partagé avec mini-DAT T-070 | **Limitation SOP documentée DAT §16.1** — hors périmètre v1 | TC-M7-UC03-02 (P2) ✓ | N/A | P2 explicite | ✅ Conforme (limitation documentée, non bloquant v1) |
| UC-05 | Toggle show/hide | ✓ stub | `p5-minidat-tache-072-toggle-show-hide-v1.1.md` ✓ | `password-detector-t067-type-mutation.test.ts` ✓ | 17 tests ✓ | Absent (T-175/T-190) | Plan §7 ✓ | 🟡 Partiel |
| UC-06 | Inputs dynamiques React/Vue | ✓ stub | Post-mortem M7 §UC-06 (pas de mini-DAT dédié) | `observeDynamicForms()` ✓ (T-101) | `password-detector-t067` + E2E ✓ | `uc06-react-dynamic-input.spec.ts` ✓ | Plan §8 ✓ | ✅ Conforme |
| UC-07 à UC-15 | Couverture défensive | ✓ stub §9.1 (P1/P2) | Aucun | Absent | Absent | Absent | P1/P2 explicite | ✅ Conforme (hors périmètre v1) |

**Observation** : UC-02 n'a pas de mini-DAT dédié — uniquement le post-mortem M7 comme référence. Cohérence acceptable pour v1 (référence opposable) mais à formaliser en v1.1.

### 2.4 NFR (perf, a11y, sécurité, privacy) : CdC → validation

| ID | Description | Valeur CdC | Valeur SFD | Valeur DAT | Implémentation | Test | Statut |
|---|---|---|---|---|---|---|---|
| ENF-PERF-01 | CPU repos < 0.1% | < 0.1% | < 0.1% ✓ | < 0.1% ✓ | SW éphémère + alarmes | Pas de test automatisé | 🟡 Partiel |
| ENF-PERF-02 | Mémoire < 20 Mo | < 20 Mo | < 20 Mo ✓ | < 20 Mo ✓ | Lazy loading CS | Pas de test automatisé | 🟡 Partiel |
| ENF-PERF-03 | Taille < 5 Mo | < 5 Mo | < 5 Mo ✓ | < 5 Mo ✓ | Corpus JSON compressé | Build CI ✓ | ✅ Conforme |
| ENF-PERF-04 | Nudge < 500ms | < 500ms | < 500ms ✓ | P99 ✓ | CS préchargé | Pas de test automatisé | 🟡 Partiel |
| ENF-PERF-06 | M9 < 100ms | < 100ms | < 100ms (zxcvbn + debounce 300ms) | < 100ms P99 ✓ | zxcvbn-ts sync | **Incohérence SFD/DAT** : SFD dit debounce 150ms, DAT dit 300ms | 🟠 À arbitrer |
| ENF-PBD-01 | 0 appel réseau | 0 | 0 ✓ | 0 ✓ | Pas de fetch/XHR | Audit CodeQL 0 finding ✓ | ✅ Conforme |
| ENF-PBD-05 | Droit effacement | 1 action | §3.5 ✓ | ✓ | `options.ts` ✓ | `CA-GLOBAL-03` recette | 🟡 Partiel |
| ENF-PBD-09 | Droit portabilité | Export JSON | SFD §4.1 ✓ | DAT §14 ✓ | `export-handler.ts` ✓ | **Aucun test unitaire** | 🟡 Partiel |
| ENF-ACC-01 à 06 | WCAG 2.1 AA | AA | SFD §4.3 ✓ | DAT §11 ✓ | 12/12 axe-core ✓ | ACC-UI-01 à 10 ouverts (Should) | 🟡 Partiel |
| ENF-SEC-01 à 07 | Sécurité extension | CSP + SBOM | SFD §4.5 ✓ | DAT §9 ✓ | CodeQL 0 finding ✓ | CI CodeQL ✓ | ✅ Conforme |
| ENF-I18N-01 à 05 | i18n FR/EN | FR + EN | SFD §4.4 ✓ | DAT §12 ✓ | `_locales/fr/` + `en/` ✓ | Non testé automatiquement | 🟡 Partiel |
| ENF-COMPAT-01 à 05 | Compatibilité Chrome | Chrome N/N-1 | CdC ✓ | DAT §4 ✓ | MV3 ✓ | CI Chrome ✓ | ✅ Conforme |

---

## 3. Gaps identifiés (éléments prévus sans trace aval)

| ID | Description | Document amont | Trace aval | Impact MEP v1 | Action |
|---|---|---|---|---|---|
| GAP-01 | `CA-GLOBAL-02` (désactivation module) — bouton radio Options non fonctionnel | CdC §5 | `TACHE-197` ouvert | **BLOQUANT** — Art. 7.3 RGPD (droit de retrait consentement M7) | T-197 Must |
| GAP-02 | Tests unitaires `export-handler.ts` (ENF-PBD-09) absents | SFD §4.1, AIPD §6.2 condition 4 | `export-handler.ts` présent, 0 test dans `tests/` | Moyen — fonctionnel mais non vérifié | Créer suite tests T-XXX Should |
| GAP-03 | `audit-maquettes-v1-t145.md` référencé dans brief mais non produit | BACKLOG T-145 | T-145 statut "À faire" | Non bloquant (TACHE-150 axe-core couverture partielle) | Suivre T-145 |
| GAP-04 | Tests E2E UC-01/02/03/05 absents (seul UC-06 a un spec E2E) | SFD §9.1, plan recette | `uc06-react-dynamic-input.spec.ts` seulement | Moyen — recette manuelle couvre UC-01 à 05 | T-175 Should |
| GAP-05 | Mini-DAT UC-02 (password managers) non produit | SFD §9.1 ref post-mortem | Post-mortem M7 seulement | Non bloquant (post-mortem fait référence) | Should v1.1 |
| GAP-06 | Mini-DAT UC-06 (inputs dynamiques) non produit | SFD §9.1 ref post-mortem | Post-mortem M7 seulement | Non bloquant (E2E + recette couvrent) | Could v1.1 |
| GAP-07 | Tests de performance ENF-PERF-01/02/04 sans automatisation | CdC §3.2, SFD §4.2 | Aucun test dédié | Non bloquant (critères mesurables en recette manuelle) | Could v1.1 |
| GAP-08 | Tests TACHE-191/192/193 (levée formelle réserves DPO R-074-01/02/03) À faire | AIPD §6.5, RISQUES.md | TACHE-158/159/160 Terminé | **BLOQUANT MEP** — avis DPO FAVORABLE SANS RÉSERVE conditionné à ces vérifications formelles | T-191/192/193 Must |
| GAP-09 | Recette manuelle UC-01 Commanditaire non complétée (Google + Microsoft) | BACKLOG T-068 statut "En cours (recette)" | Plan recette §4 prêt | **BLOQUANT MEP** — matrice providers §3 non alimentée | Action Commanditaire |
| GAP-10 | `diagnostics.m5`, `diagnostics.m6`, `diagnostics.m9`, `diagnostics.m17` présents en code (T-087/088/089 Terminé) mais badge dégradé TACHE-062 toujours "À faire" | DAT §18, BACKLOG T-062 | `diagnostics.*` implémentés ✓ | Non bloquant v1 (Should) | T-062 Should |

---

## 4. Arbitrages pendants (décisions jamais tranchées)

| ID | Description | Document | Statut | Impact |
|---|---|---|---|---|
| ARB-01 | Tests E2E UC-01 à UC-05 (T-175) — priorisation Should vs Must pour MEP v1 | BACKLOG T-175 "Arbitrage Commanditaire" | **Pending** | Moyen — recette manuelle couvre UC-01 à 05 en attendant |
| ARB-02 | TACHE-092 (volet logging incidents transverses) — tâche séparée ou implicite dans T-085 à 089 | Audit ADR compliance §Tâches, BACKLOG T-092 "Annulée doublon T-091" | Résolu — implicite dans T-085 à 089 | Aucun |
| ARB-03 | Debounce M9 : 150ms (SFD §2.6) vs 300ms (DAT §10.3) | SFD §2.6 vs DAT §10 | **Incohérence non arbitrée** | Faible fonctionnel — comportement UX légèrement différent |
| ARB-04 | TACHE-108 CodeQL "observe-only" → seuil bloquant | Référentiel ISO 27001 §5.3 "tâches nouvelles" | **Pending** (Could v5.3) | Non bloquant v1 |
| ARB-05 | TACHE-123 — vérification faux positif `autocomplete="new-password"` sur IdP SSO réel | BACKLOG T-123 "À faire" | **Pending** Could | Faible |
| ARB-06 | ENF-PBD-09 — export `m7_incidents` inclus opt-in : UI avertissement à implémenter | AIPD §6.2 condition 9, BACKLOG T-160 Terminé | Résolu côté code, **avertissement UI non testé** | Moyen — condition AIPD §6.2.9 |
| ARB-07 | T-117 — matrice compatibilité providers M7 maintenance trimestrielle : pas de date fixée | BACKLOG T-117 "À faire" | Pending (Could) | Non bloquant v1 |

---

## 5. Incohérences entre documents

| ID | Documents | Incohérence | Sévérité | Recommandation |
|---|---|---|---|---|
| INC-01 | SFD §2.6 (debounce M9 150ms) vs DAT §10 (debounce 300ms) | Valeur de debounce différente entre spec et architecture | Faible | Arbitrer et aligner en PR incrémentale SFD §2.6 ou DAT §10 |
| INC-02 | SFD §9.1 réf. mini-DAT T-070 "v1.0" mais fichier actuel est v1.1 | Référence de version obsolète dans le stub §9 | Observation | Corriger la référence lors du prochain bump SFD |
| INC-03 | BACKLOG T-085 statut "Terminé" ; ISO 27001 §5.1 confirme "PR #19" ; mais RISQUES.md R-ADR-01 indique "Résolu (T-079 PR #55)" (ancienne résolution) | Double résolution référencée pour R-ADR-01 | Observation non bloquante | Nettoyer RISQUES.md : remplacer "(T-079 PR #55)" par "(T-085 PR #19)" pour R-ADR-01/02 |
| INC-04 | CdC §3.3 cible WCAG 2.1 AA, SFD §4.3 dit WCAG 2.1 AA, checklist v1.1 titre "WCAG 2.2 AA" | Versions WCAG divergent selon les documents | Observation | Décider de la version cible (2.1 ou 2.2) et aligner tous les documents |
| INC-05 | Registre Art. 30 v1.1 §3.2 mentionne "90 jours rolling" initial corrigé en "52 semaines" via note T-165+T-169 | Mention d'une valeur obsolète encore lisible sans aller jusqu'à la note corrective | Observation non bloquante | La note est présente dans le doc — acceptable, à consolider lors du prochain bump |

---

## 6. Couverture RGPD (AIPD → registre → code)

| Traitement | AIPD | Registre Art. 30 | Politique confidentialité | Code | Statut |
|---|---|---|---|---|---|
| RT-M7 — hash mdp | AIPD M7 v1.3 FAVORABLE SANS RÉSERVE (conditionnel T-191/192/193) | v1.1 ✓ | v1.2 §M7 ✓ | `m7-handler.ts` + `crypto-service.ts` ✓ | 🟠 Partiel (T-191/192/193 bloquants) |
| RT-M7-INC — registre incidents | AIPD §6.2 conditions 7/8/9 ✓ | v1.1 ligne RT-M7-INC ✓ | Exclusion export mentionnée ✓ | `export-handler.ts` T-160 ✓ | 🟠 À vérifier formellement (T-191/192/193) |
| RT-M2 — hash domaine | AIPD §1.3 (whitelist partagée) ✓ | v1.1 ✓ | v1.2 §M2 ✓ | `m2-handler.ts` + FNV-1a ✓ | ✅ Conforme |
| RT-M3 — score agrégé | AIPD §annexe A ✓ | v1.1 ✓ | v1.2 §M3 ✓ | `score-calculator.ts` 52 semaines ✓ | ✅ Conforme |
| RT-M5 — version navigateur | — (pas d'AIPD dédiée, Art. 6.1.f) | v1.1 ✓ | v1.2 §M5 ✓ | `m5-handler.ts` local ✓ | ✅ Conforme |
| RT-M6 — quiz sessions | — (Art. 6.1.f) | v1.1 ✓ | v1.2 §M6 ✓ | `m6-handler.ts` + IndexedDB ✓ | ✅ Conforme |
| RT-M9 — force mdp (RAM < 10ms) | — (pas de stockage) | v1.1 ✓ | v1.2 §M9 ✓ | Nullification RAM ✓ | ✅ Conforme |
| RT-M17 — presse-papiers | — (pas de stockage valeur) | v1.1 ✓ | v1.2 §M17 ✓ | `paste-detector.ts` nullification ✓ | ✅ Conforme |
| RT-INTENT — pending intents | — (Art. 6.1.f, TTL court) | v1.1 ✓ | Non explicite | `pending_*` avec `expires_at` ✓ | 🟡 Partiel (politique confidentialité §pending non explicite) |
| RT-PARAM — whitelist + préférences | AIPD §1.3 ✓ | v1.1 ✓ | v1.2 §paramètres ✓ | `chrome.storage.local` ✓ | ✅ Conforme |

**Point d'attention** : les 3 conditions de l'AIPD §6.2 (7, 8, 9) nouvelles en v1.3 sont implémentées (T-158/159/160 Terminé) mais la **vérification formelle DPO** (T-191/192/193) reste À faire. L'avis FAVORABLE SANS RÉSERVE est conditionnel à ces vérifications. Bloquant MEP.

---

## 7. Couverture sécurité (STRIDE → référentiel ISO 27001 → mesures codées)

| Contrôle ISO | Mesure | Implémentation code | Tests | Statut |
|---|---|---|---|---|
| A.8.24 — Cryptographie | SHA-256 salé (D-SEC-001) + AES-256-GCM | `crypto-service.ts` + `hash.ts` ✓ | Tests canary T-059/076 ✓ | ✅ Conforme |
| A.8.28 — Secure coding | Pas d'innerHTML (D-SEC-003), nullification clipboard (D-SEC-002) | `paste-detector.ts` + `message-validator.ts` ✓ | T-096/098 ✓ | ✅ Conforme |
| A.8.29 — SAST | CodeQL CI, 0 finding, observe-only | `.github/workflows/codeql.yml` ✓ (T-187) | Hebdo + PR ✓ | 🟡 Partiel (seuil bloquant non défini — ARB-04) |
| A.8.15 / A.8.16 — Logging | Factory `logger.ts`, incidents IndexedDB | `logger.ts` + `incident-service.ts` ✓ | Tests incidents M7 ✓ | 🟡 Partiel (T-104 TACHE Terminé ; T-105 console CS À faire) |
| A.8.10 — Purge | FIFO 100 pw_hashes, 52 sem. scores, 90j events, 365j incidents | `storage-service.ts` + `incident-service.ts` ✓ | TC-M7-30 ✓ | ✅ Conforme |
| A.5.15 / A.8.4 — Moindre privilège | WAR resserré (T-028), permissions MV3 minimales | `manifest.json` ✓ | CI build ✓ | ✅ Conforme |
| A.5.24 / A.5.26 — Incident management | Runbook v1.0 + procédure DPO E1-E6 | `docs/securite/runbook-reponse-incident-v1.0.md` ✓ | Tabletop T-113 À faire | 🟡 Partiel |
| A.8.8 — Gestion vulnérabilités | SECURITY.md + Dependabot + npm audit | `SECURITY.md` ✓ (dormant si repo privé) | T-174 Could | 🟡 Partiel (T-112 Terminé — repo public ✓) |
| A.8.30 — Revue tierce | Audit config GitHub v1.0 + SHA pinning Actions | `audit-config-github-v1.0.md` ✓ | T-129 Should | 🟡 Partiel |

**ADR-001 (SW boot contract)** : 26 écarts sur 6 modules documentés dans `p5-audit-modules-adr-compliance-v1.0.md`. T-085 à T-091 Terminés selon BACKLOG. Vérification formelle post-implémentation non tracée — à intégrer dans T-191/192/193 ou PR dédiée.

**ADR-002 (cross-lifecycle intent)** : M5 (4 écarts T-087), M6 (4 écarts T-088), M17 (4 écarts T-090) — tous Terminés selon BACKLOG.

---

## 8. Couverture accessibilité (WCAG → checklist → audit → corrections)

| Périmètre | Standard | Checklist v1.1 | Audit axe-core | Corrections | Statut |
|---|---|---|---|---|---|
| Pages statiques (7 pages) | WCAG 2.1 AA | ✓ Partie 1 | 12/12 règles axe-core ✓ (T-150/157) | T-132/133/134/135/136 Terminé | ✅ Conforme (~100%) |
| Popup | WCAG 2.1 AA | ✓ §7 | axe-core ✓ | T-157 Terminé | 🟡 Partiel (ACC-UI-01 à 05 Should ouverts) |
| Dashboard | WCAG 2.1 AA | ✓ §8 | axe-core ✓ | — | 🟡 Partiel (ACC-UI-06/07 Should) |
| Options | WCAG 2.1 AA | ✓ §9 | axe-core ✓ | — | 🟡 Partiel (ACC-UI-08 Should — **SKIP LINK MANQUANT**) |
| Onboarding | WCAG 2.1 AA | ✓ §10 | axe-core ✓ | — | 🟡 Partiel (ACC-UI-09 Could) |
| NVDA (lecteurs d'écran) | WCAG 1.3.6 | Scénarios `captures/nvda/` ✓ | Non exécuté — T-180 Terminé (dispositif archivage) | — | 🟡 Partiel (tests NVDA réels non exécutés) |
| Audit maquettes T-145 | WCAG 2.2 AA | T-145 À faire | T-150 partiel | — | 🔴 Gap (T-145 toujours À faire) |

**Point d'attention** : incohérence CdC "WCAG 2.1 AA" vs checklist v1.1 "WCAG 2.2 AA" (INC-04 ci-dessus). Les 10 écarts résiduels ACC-UI-01 à ACC-UI-10 sont tous de priorité Should/Could — aucun n'est un niveau A bloquant WCAG.

---

## 9. Couverture risques (RISQUES.md → mitigations)

| Risque | Score | Statut RISQUES.md | Mitigation codée | Tests | MEP |
|---|---|---|---|---|---|
| R-001 SHA-256 sans sel | 8 | Résolu | `hash.ts` SHA-256 salé ✓ | T-059 ✓ | ✅ |
| R-002 Clipboard mémoire | 6 | Résolu | `paste-detector.ts` nullification ✓ | T-096 ✓ | ✅ |
| R-004 XSS DOM content scripts | 6 | Résolu | `message-validator.ts`, pas d'innerHTML ✓ | T-098 ✓ | ✅ |
| R-005 Typosquatting faux positifs | 6 | **Ouvert** | Levenshtein ≥ 2 signaux ✓, whitelist ✓ | `levenshtein.test.ts` ✓ | 🟡 Acceptable |
| R-007 RGPD M7 | 8 | Résolu | Opt-in onboarding + purge + AIPD ✓ | Tests M7 ✓ | ✅ |
| R-008 Firefox MV3 incompatibilité | 9 | Mitigé | `browser-adapter.ts` ✓ | Non testé Firefox | 🟡 Acceptable (Firefox hors périmètre v1) |
| R-009 SW tué avant IDB write | 6 | Ouvert | Opérations atomiques + `pending_*` | Couverture partielle | 🟡 |
| R-016 Régression WCAG | 4 | Ouvert | axe-core CI ✓ | 12/12 ✓ | ✅ |
| R-017 Corpus quiz < 50 questions | 1 | Ouvert | Min 50 questions validées | Non testé | 🟡 |
| R-018 Frais CWS 5 USD | N/A | Ouvert | À soumettre Commanditaire | — | 🟠 Bloquant distribution CWS |
| **R-074-01** | 6 | **Ouvert — Bloquant MEP** | T-158 Terminé | T-191 À faire | 🔴 |
| **R-074-02** | 4 | **Ouvert — Bloquant MEP** | T-159 Terminé | T-192 À faire | 🔴 |
| **R-074-03** | 4 | **Ouvert — Bloquant MEP** | T-160 Terminé | T-193 À faire | 🔴 |
| R-ADR-01 à 05 | ≤6 | Résolu (T-079... note obsolète) | T-085 à 091 Terminé | Formellement à vérifier | 🟡 |

---

## 10. Synthèse + verdict + recommandations BACKLOG

### 10.1 Tableau de synthèse IDs analysés

| Référentiel | IDs identifiés | Conformes | Partiels | À arbitrer | Gaps critiques |
|---|---|---|---|---|---|
| Modules M v1 (M2/3/5/6/7/9/17) | 7 | 1 (M7) | 6 | 0 | 0 |
| Use cases UC-01 à UC-06 | 6 | 2 (UC-04, UC-06) | 3 (UC-01/03/05) | 1 (UC-02 mini-DAT) | 0 |
| NFR (ENF-PBD/PERF/ACC/SEC/I18N/COMPAT) | 33 | 15 | 15 | 1 (INC-01) | 0 |
| Critères acceptation CA (CdC 43 + SFD 26) | 69 | ~65 | 3 | 0 | 1 (CA-GLOBAL-02 / BUG T-197) |
| Risques actifs RISQUES.md | 33 | 18 | 9 | 0 | 3 (R-074-01/02/03) |
| ADR (ADR-001, ADR-002) | 2 | 1 (ADR-002 conforme M7) | 1 (ADR-001 : T-085 à 091 livrés mais non vérifiés formellement) | 0 | 0 |
| RGPD traitements | 10 | 7 | 2 | 1 (T-191/192/193) | 0 |
| Contrôles ISO 27001 actifs | 12+ | 6 | 5 | 1 (ARB-04 CodeQL seuil) | 0 |
| Accessibilité WCAG écarts | 11 | 2 | 9 (tous Should/Could) | 0 | 0 |

**Ratio global (approximatif)** :
- ✅ Conforme : ~55%
- 🟡 Partiel : ~35%
- 🟠 À arbitrer : ~5%
- 🔴 Gap critique : ~5% (3 risques RGPD + 2 actions bloquantes MEP)

### 10.2 Verdict MEP v1

**MEP v1 conditionnée à 4 actions bloquantes** :

| Priorité | Action | Tâche | Responsable |
|---|---|---|---|
| **BLOQUANT 1** | Corriger BUG T-197 (bouton radio désactivation module) | T-197 Must | Développeur |
| **BLOQUANT 2** | Lever formellement réserve DPO R-074-01 (T-191) | T-191 Must | Architecte sécurité + DPO |
| **BLOQUANT 3** | Lever formellement réserve DPO R-074-02 (T-192) | T-192 Must | Architecte sécurité + DPO |
| **BLOQUANT 4** | Lever formellement réserve DPO R-074-03 (T-193) | T-193 Must | Architecte sécurité + DPO |
| **Prérequis MEP** | Recette manuelle UC-01 Google + Microsoft par Commanditaire | T-068 En cours | Commanditaire |
| **Prérequis MEP** | Valider frais CWS 5 USD (R-018) | R-018 Ouvert | Commanditaire |

### 10.3 Top 3 gaps critiques

1. **GAP-01 / T-197** : BUG bouton radio désactivation module — CA-GLOBAL-02 non satisfait, RGPD Art. 7.3 impacté.
2. **GAP-08 / T-191+192+193** : Vérification formelle levée réserves DPO R-074-01/02/03 non exécutée — avis DPO FAVORABLE SOUS CONDITIONS non encore converti en FAVORABLE SANS RÉSERVE.
3. **GAP-09 / T-068** : Recette manuelle UC-01 Commanditaire non terminée — matrice providers Google/Microsoft vide, critère de sortie recette non atteint.

### 10.4 Top 3 arbitrages pendants

1. **ARB-01 / T-175** : Tests E2E UC-01 à UC-05 — Should ou Must pour MEP v1 ? La recette manuelle couvre le besoin à court terme mais l'automatisation est attendue pour v1.1.
2. **INC-01** : Debounce M9 — 150ms (SFD) ou 300ms (DAT) ? Incohérence documentaire à trancher.
3. **ARB-04** : CodeQL "observe-only" → quand passer à "seuil bloquant" ? A.8.29 ne sera vraiment couvert qu'à ce stade.

### 10.5 Recommandations BACKLOG

Les actions suivantes sont recommandées à l'orchestrateur pour intégration au BACKLOG :

| Type | Description | Priorité |
|---|---|---|
| TÂCHE | T-NEW-01 — Tests unitaires `export-handler.ts` (ENF-PBD-09 / AIPD condition 4) | Should |
| TÂCHE | T-NEW-02 — Alignement debounce M9 SFD/DAT (INC-01) : décider 150ms ou 300ms + PR incrémentale | Should |
| TÂCHE | T-NEW-03 — Aligner RISQUES.md R-ADR-01/02 sur T-085/087 (remplacer "(T-079 PR #55)" obsolète) | Could |
| TÂCHE | T-NEW-04 — Décider version WCAG cible : 2.1 AA (CdC) ou 2.2 AA (checklist) et aligner tous les docs | Should |
| TÂCHE | T-NEW-05 — Mentionner `pending_*` intents dans politique de confidentialité §durées conservation | Could |

---

## 11. Annexe — Liste des IDs analysés

**Modules v1** : M2, M3, M5, M6, M7, M9, M17 (7 modules)
**Hors périmètre v1** : M1, M4, M8, M10, M11, M12, M13, M14, M15, M16, M19, M20 (confirmés §6.2 CdC)
**Use cases** : UC-01 à UC-15 (UC-01 à 06 P0 v1, UC-07 à 15 P1/P2)
**NFR** : ENF-PBD-01 à 09, ENF-PERF-01 à 06, ENF-ACC-01 à 06, ENF-I18N-01 à 05, ENF-COMPAT-01 à 05, ENF-SEC-01 à 07 (38 exigences)
**Critères d'acceptation** : CA-M2-01 à 11, CA-M3-01 à 08, CA-M5-01 à 06, CA-M6-01 à 08, CA-M7-01 à 07, CA-M9-01 à 13, CA-M17-01 à 08, CA-GLOBAL-01 à 08 (total : 69)
**Risques** : R-001 à R-023, R-M7-03 à 09, R-ADR-01 à 07, R-UC01 à UC05, R-MIN-002, R-074-01 à 03 (33+ risques)
**ADR** : ADR-001 (SW boot contract), ADR-002 (cross-lifecycle intent)
**Décisions sécurité** : D-SEC-001 à 005
**Décisions post-mortem** : ARB-061-01/02/03, ARB-068-01/02, ARB-072-01/02
**Contrôles ISO 27001** : A.5.15, A.5.24, A.5.26, A.8.4, A.8.8, A.8.10, A.8.12, A.8.15, A.8.16, A.8.24, A.8.28, A.8.29, A.8.30 (13 contrôles)
**Traitements RGPD** : RT-M2, RT-M3, RT-M5, RT-M6, RT-M7, RT-M7-INC, RT-M9, RT-M17, RT-INTENT, RT-PARAM (10 traitements)

---

*Audit produit par le Référent qualité — Sentinel Nudge T-205 — 2026-04-20*
*Méthode : Grep ciblé + lecture partielle TOC + cross-référencement multi-fichiers. Durée : ~14 min.*
