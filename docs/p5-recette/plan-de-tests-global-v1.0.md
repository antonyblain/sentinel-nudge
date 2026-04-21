# Plan de tests global — Sentinel Nudge v1

> **Document pivot** — vue exhaustive de la couverture tests toutes natures confondues (TU + TI + E2E + Manuel).
> Produit par TACHE-213 (2026-04-21). Mis a jour a chaque ajout de fichier de test.

---

## 1. Objectif

Ce document centralise la couverture de tests de Sentinel Nudge v1 en une vue unique. Il repond a la question : "Qu est-ce qui est teste, par quelle methode, et qu est-ce qui reste couvert uniquement par la recette manuelle ?"

Il ne se substitue pas aux fichiers de tests eux-memes ni au protocole de recette manuelle ; il en est le plan de navigation.

---

## 2. Quatre natures de tests

| Nature | Outil | Emplacement | Volumetrie |
| --- | --- | --- | --- |
| TU — Tests unitaires | Vitest | `tests/unit/` | 60 fichiers .test.ts |
| TI — Tests d integration | Vitest | `tests/integration/` | 5 fichiers .test.ts |
| E2E — Tests end-to-end | Playwright | `tests/e2e/` | 3 fichiers .spec.ts |
| Manuel | Chrome + DevTools | Protocole v2.0 | 17 scenarios UC + 14 scenarios modules |

> Couverture automatisee CI : 1133 tests passes (derniere verification T-206, PR #182).

---

## 3. Matrice de couverture par perimetre

### 3.1 Par use case (UC-01 a UC-06)

| UC | TU | TI | E2E | Manuel | Statut |
| --- | --- | --- | --- | --- | --- |
| UC-01 Login multi-etape | `password-detector-uc01.test.ts`, `password-detector-fuc0101.test.ts` | — | Absent (T-175, Should v1.1) | §5 protocole v2.0 (3 TC P0) | Partiel |
| UC-02 Gestionnaires de mots de passe | `password-detector-isTrusted.test.ts` | — | Absent (T-175) | §6 protocole v2.0 (2 TC P0 + 1 P1) | Partiel |
| UC-03 Iframes same-origin | `password-detector-uc03.test.ts` | — | Absent (T-175) | §7 protocole v2.0 (1 TC P0) | Partiel |
| UC-04 Iframes cross-origin (limite) | — | — | N/A (limite documentee) | §8 protocole v2.0 (2 TC P1) | Couvert |
| UC-05 Toggle show/hide | `password-detector-t067-type-mutation.test.ts`, `password-detector-t095-uc05-sendmessage.test.ts` | — | Absent (T-175) | §9 protocole v2.0 (2 TC P0) | Partiel |
| UC-06 Inputs dynamiques SPA | `password-detector-uc05-spa.test.ts` | — | `uc06-react-dynamic-input.spec.ts` | §10 protocole v2.0 (3 TC P0 + 1 P1) | Couvert |

### 3.2 Par module fonctionnel

| Module | TU | TI | E2E | Manuel | Statut |
| --- | --- | --- | --- | --- | --- |
| M2 Typosquatting | `m2.test.ts`, `levenshtein.test.ts` (dans `tests/unit/`) | — | — | §11 protocole v2.0 (3 TC) | Partiel |
| M3 Score hebdomadaire | `m3.test.ts`, `m3-handler.test.ts`, `score-calculator.test.ts`, `score-calculator-components.test.ts` | — | — | §12 protocole v2.0 (2 TC) | Partiel |
| M5 Mise a jour navigateur | `m5.test.ts` | — | — | §13 protocole v2.0 (2 TC) | Partiel |
| M6 Quiz spaced repetition | `m6.test.ts`, `m6-handler-checkquiz.test.ts` | — | — | §14 protocole v2.0 (2 TC) | Partiel |
| M7 Reutilisation mots de passe | `m7.test.ts`, `m7-tc-scenarios.test.ts`, `m7-tc-scenarios-sm.test.ts`, `m7-cooldown-fonctionnel.test.ts`, `m7-dedup.test.ts`, `crypto-m7-native.test.ts` | `boot-sequence.test.ts`, `boot-sequence-canary-reinit.test.ts` | — | §18 Annexe A matrice providers (recette manuelle) | Couvert |
| M9 Donnees sensibles (saisie) | `m9.test.ts`, `password-detector-t064-newpassword.test.ts`, `password-detector-t094-extension-context.test.ts`, `password-detector-t098-t100-hardening.test.ts` | — | — | §15 protocole v2.0 (2 TC) | Partiel |
| M17 Presse-papiers | `m17.test.ts`, `paste-detector-m17-password-exclusion.test.ts` | — | — | §16 protocole v2.0 (3 TC) | Partiel |

### 3.3 Par exigence non-fonctionnelle (NFR)

| Exigence | Nature tests | Fichiers / References | Statut |
| --- | --- | --- | --- |
| ENF-PERF — Performance | TU (quota-manager, alarm-manager) | `quota-manager.test.ts`, `alarm-manager.test.ts` | Partiel |
| ENF-ACC — Accessibilite | Manuel (NVDA) | §19 Annexe B protocole v2.0 + `accessibility-themes.spec.ts` | Partiel |
| ENF-SEC — Securite | TU (crypto, hash, canary) | `crypto-service.test.ts`, `crypto-m7-native.test.ts`, `hash.test.ts`, `canary-service.test.ts` | Couvert |
| ENF-PBD — Privacy by design (Art. 20 RGPD) | TU | `handle-export-enf-pbd-09.test.ts`, `handle-export-r074-03.test.ts` | Couvert (T-206) |
| ENF-I18N — Internationalisation | TU | `options-language-reload.test.ts` | Partiel |
| ENF-COMPAT — Compatibilite navigateurs | Manuel (matrice providers M7) | Annexe A protocole v2.0 | Partiel |

### 3.4 Par traitement RGPD

| Traitement | TU couvrant | Statut |
| --- | --- | --- |
| RT-M7 Hachage mots de passe | `crypto-service.test.ts`, `hash.test.ts`, `m7.test.ts` | Couvert |
| RT-EXPORT Export Art. 20 | `handle-export-enf-pbd-09.test.ts`, `handle-export-r074-03.test.ts` | Couvert (T-206) |
| RT-INCIDENT Journal incidents | `incident-service.test.ts`, `incident-service-r074-01.test.ts`, `incident-service-r074-02.test.ts` | Couvert |
| RT-STORAGE Migration stockage | `storage-migration-v1-v2.test.ts` | Couvert |
| RT-INTENT Intent cross-lifecycle | TTL tests `pending_*` dans `m7.test.ts` | Couvert |

### 3.5 Par controle securite (ADR et contrats boot)

| ADR / Contrat | Tests couvrant | Fichiers |
| --- | --- | --- |
| ADR-001 SW boot contract | TU boot par module | `service-worker.test.ts`, `service-worker-install-flag.test.ts`, `message-router.test.ts`, `message-router-boot-window.test.ts` |
| ADR-002 Cross-lifecycle intent TTL | TU TTL | `m7.test.ts` (pending intent) |
| CM-EOP1 Canary re-init | TU + TI | `canary-service.test.ts`, `boot-sequence-canary-reinit.test.ts` |
| P-016 Cle AES absente (auto-regen) | TU SW | `service-worker.test.ts` |
| P-018 ArrayBuffer non-serializable | TU + helper | `mock-chrome-storage.test.ts`, `helpers/mock-chrome-storage.ts` |
| P-019 Toast post-redirect TTL | TU M7 intent | `m7.test.ts` |

---

## 4. Inventaire detaille des fichiers de test

### 4.1 Tests unitaires — `tests/unit/` (60 fichiers)

**background/** (8 fichiers)
- `alarm-manager.test.ts`
- `crypto-m7-native.test.ts`
- `message-router-boot-window.test.ts`
- `message-router.test.ts`
- `score-calculator-components.test.ts`
- `service-worker-install-flag.test.ts`
- `storage-service.test.ts`
- `storage-write-fail.test.ts`

**content-scripts/** (10 fichiers)
- `password-detector-fuc0101.test.ts`
- `password-detector-isTrusted.test.ts`
- `password-detector-t064-newpassword.test.ts`
- `password-detector-t067-type-mutation.test.ts`
- `password-detector-t094-extension-context.test.ts`
- `password-detector-t095-uc05-sendmessage.test.ts`
- `password-detector-t098-t100-hardening.test.ts`
- `password-detector-uc01.test.ts`
- `password-detector-uc03.test.ts`
- `password-detector-uc05-spa.test.ts`
- `paste-detector-m17-password-exclusion.test.ts`

**modules/** (11 fichiers)
- `m17.test.ts`
- `m2.test.ts`
- `m3-handler.test.ts`
- `m3.test.ts`
- `m5.test.ts`
- `m6-handler-checkquiz.test.ts`
- `m6.test.ts`
- `m7-cooldown-fonctionnel.test.ts`
- `m7-dedup.test.ts`
- `m7-tc-scenarios-sm.test.ts`
- `m7-tc-scenarios.test.ts`
- `m7.test.ts`
- `m9.test.ts`

**pages/options/** (5 fichiers)
- `handle-export-enf-pbd-09.test.ts`
- `handle-export-r074-03.test.ts`
- `options-language-reload.test.ts`
- `options-module-toggle.test.ts`
- `options-theme-selector.test.ts`

**pages/popup/** (8 fichiers)
- `popup-degraded-badge.test.ts`
- `popup-dom-constructors.test.ts`
- `popup-init-catch.test.ts`
- `popup-pure-functions.test.ts`
- `popup-render-sections.test.ts`
- `popup-subtitle-cta-t200-t201.test.ts`
- `popup-t152-new-components.test.ts`
- `popup-theme-apply.test.ts`

**pages/whitelist/** (1 fichier)
- `whitelist.test.ts`

**services/** (4 fichiers)
- `canary-service.test.ts`
- `heartbeat-service.test.ts`
- `incident-service.test.ts`
- `rate-limiter.test.ts`

**shared/** (3 fichiers)
- `incident-service-r074-01.test.ts`
- `incident-service-r074-02.test.ts`
- `logger.test.ts`

**shared/utils/** (1 fichier)
- `classify-error.test.ts`

**helpers/** (1 fichier)
- `mock-chrome-storage.test.ts`

**Racine unit/** (6 fichiers)
- `crypto-service.test.ts`
- `hash.test.ts`
- `levenshtein.test.ts`
- `quota-manager.test.ts`
- `score-calculator.test.ts`

### 4.2 Tests d integration — `tests/integration/` (5 fichiers)

- `boot-sequence-canary-reinit.test.ts` — Re-initialisation canary apres boot (CM-EOP1)
- `boot-sequence.test.ts` — Sequence de boot Service Worker (ADR-001)
- `service-worker.test.ts` — Comportement SW complet
- `storage-migration-v1-v2.test.ts` — Migration schema stockage (RT-STORAGE)
- `storage-service.test.ts` — Service stockage cross-composants

### 4.3 Tests E2E — `tests/e2e/` (3 fichiers)

- `accessibility-themes.spec.ts` — Accessibilite multi-themes (ENF-ACC + ENF-COMPAT)
- `uc06-react-dynamic-input.spec.ts` — UC-06 inputs dynamiques React (P0)
- `whitelist-page.spec.ts` — Page whitelist (fonctionnel UI)

---

## 5. Cas particuliers couverts

| Anomalie / Decision | Description | Tests couvrant |
| --- | --- | --- |
| F-UC01-01 | React input ajoute sans mutation DOM | `password-detector-fuc0101.test.ts` + TC-UC01-02 recette |
| P-016 | Cle AES absente — auto-regeneration SW au boot | `service-worker-install-flag.test.ts` |
| P-018 | ArrayBuffer non-serializable JSON (chrome.storage mock) | `mock-chrome-storage.test.ts`, helper `tests/helpers/mock-chrome-storage.ts` |
| P-019 | Toast ephemere post-redirect — pending-intent TTL | `m7.test.ts` (scenarios TTL) |
| CM-EOP1 | Canary re-init apres echec boot | `canary-service.test.ts`, `boot-sequence-canary-reinit.test.ts` |
| ADR-001 | SW boot contract — tous modules | `boot-sequence.test.ts` |
| ADR-002 | Cross-lifecycle intent `pending_*` | `m7.test.ts` (scenarios pending intent) |

---

## 6. Ordre d execution pour MEP v1

1. **Automatises CI** — TU (60 fichiers) + TI (5 fichiers) + E2E (3 specs) : doivent etre verts (actuellement 1133/1133 selon CI T-206).
2. **Recette manuelle UC P0** — §5 a §10 du protocole v2.0 : 12 scenarios bloquants release.
3. **Recette manuelle modules** — §11 a §16 : 14 scenarios complementaires P1.
4. **PV de recette** — Remplir `pv-recette-v1-<date>.md` (copie du gabarit), signer.
5. **Verdict AUTORISEE** si 12 scenarios P0 tous en Pass.

---

## 7. Gaps connus (audit T-205)

| ID | Description | Priorite backlog |
| --- | --- | --- |
| T-175 | Tests E2E manquants pour UC-01 a UC-05 (event.isTrusted non simulable automatiquement — cf. ADR `p5-regle-e2e-isTrusted-v1.0.md`) | Should v1.1 |
| T-125 | Automatisation E2E modules M3/M5/M6 | Could v1.1 |

---

## 8. References

| Document | Lien |
| --- | --- |
| Protocole de recette manuelle (detail) | [`protocole-recette-manuelle-v2.0.md`](./protocole-recette-manuelle-v2.0.md) |
| Gabarit PV a remplir | [`pv-recette-v1-a-remplir.md`](./pv-recette-v1-a-remplir.md) |
| Audit coherence transverse (T-205) | [`docs/gouvernance/audit-coherence-transverse-v1.0.md`](../gouvernance/audit-coherence-transverse-v1.0.md) |
| Regle E2E isTrusted (ADR) | [`docs/p5-decisions/p5-regle-e2e-isTrusted-v1.0.md`](../p5-decisions/p5-regle-e2e-isTrusted-v1.0.md) |
| Archive anciens fichiers | [`docs/p5-recette/archive/`](./archive/) |

---

## 9. Historique

| Version | Date | Auteur | Changements |
| --- | --- | --- | --- |
| v1.0 | 2026-04-21 | Testeur QA (T-213) | Creation — vue pivot TU + TI + E2E + Manuel. |
