# PV — Comité de revue code TACHE-069 (UC-02) + TACHE-072 (UC-05)

**Version** : 1.0
**Date** : 2026-04-17
**Phase** : P5
**Objet** : Revue du code UC-02 (filtre `event.isTrusted`) + UC-05 (MutationObserver toggle show/hide password)
**Niveau projet** : Exposé
**Statut** : Validé avec commentaires — 1 correction bloquante C-01 appliquée pré-commit
**Référence documentaire** : `docs/p4-conception/p5-minidat-tache-072-toggle-show-hide-v1.1.md` + `docs/p5-tests/p5-uc02-password-managers-scenarios-v1.0.md`
**Branche** : `feature/p5-uc02-uc05-implementation`
**Arbitrages Commanditaire préalables** : ARB-UC02-01 Option A, ARB-072-01 Option A, ARB-072-02 Option A

---

## Résumé exécutif

Le comité a examiné l'implémentation UC-02 (filtre `!event.isTrusted` dans `handleFormSubmit`) et UC-05 (registre `_snPasswordInputs` + `handleTypeAttributeMutation` + collecteur unifié + 4 points de rupture corrigés). Les 3 participants convergent sur la qualité du code et la conformité aux arbitrages, mais divergent sur la couverture des tests. **Divergence arbitrée en faveur du Testeur QA** : le constat **C-01 Bloquant** (TC-UC05-05 testait la propriété triviale du `Set` et non l'invariant métier INV-UC05-03) a été retenu. Le Développeur a appliqué la correction : TC-UC05-05 renommé `TC-UC05-05-SET-DEDUP` (périmètre clarifié) + ajout d'un nouveau test SM-UC05-06 qui appelle réellement `handleFormSubmit` 2 fois et vérifie `sendMessage count === 1`. **253 tests verts** post-correction. Merge autorisé.

---

## 1. Ordre du jour

1. Qualité du code (SOLID, Clean Code, lisibilité)
2. Conformité architecturale (code vs mini-DAT v1.1 vs ADR)
3. Revue sécurité (STRIDE adapté content script MV3 + invariants)
4. Revue tests (couverture des invariants + qualité des assertions)
5. Documentation inline (JSDoc, traçabilité)
6. Arbitrage des divergences

---

## 2. Participants

| Rôle              | Agent               |
| ----------------- | ------------------- |
| Rapporteur        | Développeur         |
| Reviewer sécurité | Architecte sécurité |
| Reviewer tests    | Testeur QA          |

---

## 3. Périmètre revu

### Fichiers modifiés

- `src/content-scripts/detectors/password-detector.ts`
  - **UC-02** : `if (!event.isTrusted) return;` tout début de `handleFormSubmit` (ligne 1167, avant le guard `submittedFields`)
  - **UC-05** : `const _snPasswordInputs = new Set<HTMLInputElement>()` + `registerPasswordInput` + `collectPasswordInputs` + `handleTypeAttributeMutation` + 4 points de rupture corrigés (`attachSubmitListeners`, 2×`attachOrphanPasswordListeners`, listener `focusin`)
  - `observeDynamicForms` étendu avec `attributes: true, attributeFilter: ['type']`

### Fichiers créés

- `tests/unit/content-scripts/password-detector-isTrusted.test.ts` — 14 tests (3 UC-02 + 11 UC-05 post-correction C-01)

### Documents associés

- `docs/p4-conception/p5-minidat-tache-072-toggle-show-hide-v1.1.md` (v1.1 révisée pour ARB-072-02)
- `docs/p5-tests/p5-uc02-password-managers-scenarios-v1.0.md` (scénarios recette manuelle)

---

## 4. Synthèse des travaux

Le Développeur a présenté une implémentation sobre, conforme aux 3 arbitrages, avec traçabilité forte aux invariants et ARB dans les commentaires. Les 4 points de rupture du mini-DAT §5 sont tous corrigés. Le Set `_snPasswordInputs` stocke uniquement des refs DOM (pas de values sensibles), le risque de rétention mémoire est donc nul.

L'Architecte sécurité a validé la conformité INV-SEC-02 (logs minimisés dans `handleTypeAttributeMutation` : `input_id`, `input_name`, `new_type` uniquement). Il a identifié 2 nouveaux risques de score 2 (acceptés) : R-UC02-01 (contournement par script tiers en capture phase, hors périmètre M7) et R-UC05-01 (hash de donnée non-password via toggle `text→password`, impact local uniquement).

Le Testeur QA a identifié un **problème de couverture** : TC-UC05-05 vérifiait `_snPasswordInputs.size === 1` après 10 toggles — ce qui teste une propriété triviale du `Set` (déduplication intrinsèque) et non l'invariant INV-UC05-03 (un seul hash M7 envoyé par submit, qui dépend du guard `submittedFields` dans `handleFormSubmit`). C'était un faux positif de couverture.

---

## 5. Avis individuels

### 5.1 Rapporteur Développeur — Note 4/5

Implémentation conforme aux 3 arbitrages. 4 points de rupture mini-DAT §5 tous corrigés. Nommage `_snPasswordInputs` cohérent avec le préfixe `_sn` existant. JSDoc complet sur les 3 nouvelles fonctions. Point retenu : `console.info` dans `handleTypeAttributeMutation` pourrait être DEBUG en production (à arbitrer avec l'architecte lors de la définition du niveau DEBUG projet).

Constats classifiés :

- Aucun Bloquant, aucun Majeur
- 5 Mineurs (NB-01 à NB-05 du QC)
- 3 Informatifs (niveau log, E2E Playwright, Shadow DOM v2)

### 5.2 Architecte sécurité — Note 4/5

Filtre `isTrusted` bien placé (premier check avant toute manipulation de `salt` / `value` / `hash`). `_snPasswordInputs` ne stocke pas de values sensibles (uniquement des refs DOM). Logs conformes INV-SEC-02. Aucun risque bloquant.

Constats classifiés :

- Aucun Bloquant, aucun Majeur
- 3 Mineurs :
  - M-SEC-01 : `attachSubmitListeners` sans `{ capture: true }` — risque T-UC02-02 théorique, à évaluer v1.1
  - M-SEC-02 : pas de rate-limiting sur logs `handleTypeAttributeMutation` — coalescing 100ms recommandé v1.1
  - M-SEC-03 : commentaire ligne 140 référence `R-CLI-07` (ADR-002 pending-intents) alors que le cadre exact est INV-SEC-02 — renommage mineur

2 nouveaux risques consignés :

- **R-UC02-01** — Contournement M7 par script tiers en capture phase (P=1, I=2, score=2, Accepté)
- **R-UC05-01** — Hash d'une donnée non-password via toggle text→password (P=2, I=1, score=2, Accepté)

### 5.3 Testeur QA — Note 3/5 (avant correction C-01) → 4/5 (après correction)

Couverture nominale UC-02 satisfaisante (3 tests précis). Couverture UC-05 avec **défaut structurel** identifié :

Constats classifiés :

- **C-01 Bloquant** : TC-UC05-05 teste la propriété triviale du Set, pas INV-UC05-03. L'invariant critique "1 seul hash par submit après toggles" n'est pas vérifié.
- C-02 Majeur : auto-exec `initPasswordDetector` au chargement du module test → listeners globaux non nettoyés (NB-05 confirmé Majeur)
- C-03 Majeur : TC-UC05-01 et TC-UC05-04 ne vérifient pas que `sendMessage` est effectivement appelé (couvrent uniquement le registre)
- C-04 Mineur (NB-01 confirmé)
- C-05 Mineur (NB-03 confirmé)
- C-06 Mineur : TC-UC05-05 SPA React/Vue absent du mini-DAT §6
- C-07 Info : scénarios recette UC-02 §8 à mettre à jour (6 cellules "Dépend ARB-UC02-01" → verdict Option A connu)

---

## 6. Divergences et arbitrages

### Divergence — Sévérité de TC-UC05-05

| Reviewer            | Position                                                                               |
| ------------------- | -------------------------------------------------------------------------------------- |
| Développeur         | Mineur — le test est utile comme non-régression du Set, NB-02 en suivi BACKLOG         |
| Architecte sécurité | N/A (pas son périmètre direct)                                                         |
| Testeur QA          | **Bloquant** — faux positif de couverture, l'invariant métier critique n'est pas testé |

**Arbitrage rendu** : **position Testeur QA retenue**. Un test qui passe pour de mauvaises raisons donne une fausse assurance de couverture — identique au pattern TC-M7-24 sur TACHE-061 (arbitré pro-QA). La règle établie est : **un test qui ne teste pas son invariant est un test à corriger avant merge**.

**Correction appliquée par le Dev** :

1. TC-UC05-05 renommé `TC-UC05-05-SET-DEDUP` + description clarifiée (teste le Set, pas INV-UC05-03)
2. Nouveau test **SM-UC05-06** ajouté : appel réel `handleFormSubmit` 2× sur le même input après toggles, assertion `sendMessage` avec `module:'M7'` compte **exactement 1** (vérifie le guard `submittedFields` WeakSet dans `handleFormSubmit`)
3. `handleFormSubmit` était déjà exporté (ligne 1841) — aucune modif `password-detector.ts` nécessaire

**Résultat** : 252 → 253 tests, CI verte.

### Aucune autre divergence

Les 3 reviewers convergent sur l'absence de bloquant sécurité et sur la qualité globale du code.

---

## 7. Notes de satisfaction

| Reviewer                          | Note    | Justification synthétique                                                            |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| Développeur (rapporteur)          | **4/5** | Implémentation conforme, 5 mineurs non bloquants, 3 points informatifs               |
| Architecte sécurité               | **4/5** | INV-SEC-02 respecté, 2 risques nouveaux acceptés (score 2), 3 mineurs hardening v1.1 |
| Testeur QA (post-correction C-01) | **4/5** | 253/253 tests, invariant INV-UC05-03 désormais testé end-to-end                      |

**Moyenne comité** : 4,0/5.

---

## 8. Constats classifiés

### 8.1 Bloquants (corrigés AVANT commit)

| Ref      | Constat                                                        | Localisation                                                     | Action appliquée                                                                            |
| -------- | -------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **C-01** | TC-UC05-05 teste la propriété triviale du Set, pas INV-UC05-03 | `tests/unit/content-scripts/password-detector-isTrusted.test.ts` | TC-UC05-05 renommé SET-DEDUP + ajout SM-UC05-06 (handleFormSubmit 2× → sendMessage count=1) |

### 8.2 Majeurs (traçables en BACKLOG)

| Ref              | Constat                                                               | Tâche BACKLOG proposée                                                              |
| ---------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **C-02 / NB-05** | Auto-exec `initPasswordDetector` → listeners non nettoyés entre tests | TACHE-094 (refactor guard `isExtensionContext()` ou export conditionnel)            |
| **C-03**         | TC-UC05-01 et -04 ne vérifient pas `sendMessage`                      | TACHE-095 (couverture end-to-end via `handleFormSubmit` — peut recouvrir TACHE-082) |

### 8.3 Mineurs (traçables en BACKLOG)

| Ref              | Constat                                                         | Tâche BACKLOG                       |
| ---------------- | --------------------------------------------------------------- | ----------------------------------- |
| **NB-01 / C-04** | Absence `beforeEach` clearing `_snPasswordInputs` dans UC-02    | TACHE-096                           |
| **NB-03 / C-05** | Mock `storage.local.get` positionnel fragile                    | TACHE-096 (peut recouvrir)          |
| **C-06**         | TC-UC05-05 SPA React/Vue absent                                 | TACHE-097 (scénario complémentaire) |
| **M-SEC-01**     | `attachSubmitListeners` sans `capture:true`                     | TACHE-098 (hardening v1.1)          |
| **M-SEC-02**     | Pas de rate-limiting logs `handleTypeAttributeMutation`         | TACHE-098 (peut recouvrir)          |
| **M-SEC-03**     | Commentaire ligne 140 référence imprécise R-CLI-07 → INV-SEC-02 | TACHE-098 (trivial)                 |

### 8.4 Info (non bloquants, pas de tâche)

| Ref         | Constat                                                              | Traitement                                                 |
| ----------- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| **C-07**    | Scénarios recette UC-02 §8 : 6 cellules "Dépend ARB" à mettre à jour | **Traité** dans le même commit : MAJ du document scenarios |
| **INFO-02** | Filtre `isTrusted` bloque submits programmatiques en E2E             | TACHE-099 (règle E2E Playwright documentée)                |
| **INFO-03** | Shadow DOM angle mort v1                                             | À tracer dans limitations connues v1                       |

---

## 9. Tâches complémentaires à créer (→ BACKLOG.md)

| ID        | Titre                                                                                                                                                                                | Priorité | Responsable                       | Origine                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------- | ------------------------------------- |
| TACHE-094 | Refactor auto-exec `initPasswordDetector` : exporter `isExtensionContext()` mockable ou conditionnement par variable d'env, pour éviter pollution tests                              | Should   | Développeur                       | C-02 / NB-05 comité                   |
| TACHE-095 | Couverture end-to-end UC-05 : TC-UC05-01 et TC-UC05-04 étendus pour vérifier `sendMessage` compte (actuellement niveau registre uniquement)                                          | Should   | Testeur QA                        | C-03 comité                           |
| TACHE-096 | Renforcer tests `password-detector-isTrusted` : `beforeEach` clearing UC-02 (NB-01) + mock storage par clé plutôt que positionnel (NB-03)                                            | Could    | Testeur QA                        | NB-01 + NB-03 comité                  |
| TACHE-097 | Scénario TC-UC05-05 SPA React/Vue (détachement/re-render d'input) — couverture du mini-DAT §6                                                                                        | Could    | Testeur QA                        | C-06 comité                           |
| TACHE-098 | Hardening UC-02/UC-05 v1.1 : `capture:true` sur attachSubmitListeners + rate-limiting console.info handleTypeAttributeMutation + renommer référence R-CLI-07 → INV-SEC-02 ligne 140  | Could    | Développeur + Architecte sécurité | M-SEC-01/02/03 comité                 |
| TACHE-099 | Documenter règle E2E Playwright : tests M7 utilisent `page.locator().click()` uniquement, interdire `page.evaluate(() => form.submit())` / `form.requestSubmit()`                    | Must     | Testeur QA                        | INFO-02 comité (dépendance TACHE-059) |
| TACHE-100 | Scénarios interaction UC-02 + UC-05 : SM-UC02-01 (filtre sur click orphelin), SM-UC02-UC05-01 (toggle + isTrusted=false), SM-SALT-ABSENT-01 (return silencieux) — enrichir TACHE-059 | Should   | Testeur QA                        | Scénarios manquants QA                |

---

## 10. Actions manuelles

Aucune.

---

## 11. Mise à jour du registre des risques (→ RISQUES.md)

### Nouvelles entrées

- **R-UC02-01** — Contournement M7 par script tiers en capture phase (Sécurité, P=1, I=2, score=2, Accepté). Un script malveillant de la page peut intercepter le submit utilisateur réel, consommer la valeur, puis relancer un submit programmatique (`isTrusted=false` filtré par M7). Hors périmètre M7 (page déjà compromise — R-004 CSP et sanitization du site primaires). Documenter la limite dans la politique de confidentialité.
- **R-UC05-01** — Hash M7 d'une donnée non-password via toggle `text → password` (Sécurité, P=2, I=1, score=2, Accepté). Un site peut forcer M7 à hasher une donnée arbitraire (numéro de carte, token) en togglant `type`. Impact local uniquement (hash salé par `installation_salt`, aucune exfiltration). Surveiller via tests E2E TACHE-059 avec des sites utilisant `type="search"`/`type="email"` togglés.

### Changements de statut

Aucun.

---

## 12. Fiche qualité

| Critère                                                     | Résultat                                                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Conformité arbitrages ARB-UC02-01 / ARB-072-01 / ARB-072-02 | ✅ Conforme sur les 3                                                                                  |
| Qualité du code (SOLID, Clean Code)                         | 4/5 — SRP respecté, documentation inline complète, nommage cohérent                                    |
| Couverture tests (post-correction C-01)                     | 14 tests UC-02/UC-05 (3 filtre isTrusted + 11 UC-05 registre/collecte/mutation/INV-UC05-03 end-to-end) |
| Sécurité (STRIDE + invariants)                              | INV-SEC-02 respecté, 2 nouveaux risques acceptés (score 2), aucun bloquant                             |
| Documentation inline                                        | Très bonne — références croisées ARB, INV-UC05, R-CLI-07                                               |
| Dépendances introduites                                     | Aucune (I-001 respecté)                                                                                |
| CI post-correction                                          | 253/253 tests verts, lint 0 erreur 0 warning                                                           |
| **Verdict comité**                                          | **Validé avec commentaires** — C-01 corrigé pré-commit, autres tracés en BACKLOG                       |

---

## 13. Questions ouvertes (→ QUESTIONS.md)

Aucune. Toutes les divergences ont été tranchées par le comité.

---

## 14. Décision demandée au Commanditaire

Le comité soumet au Commanditaire :

1. **Validation du PV** avec note moyenne 4,0/5 post-correction C-01.
2. **Autorisation de commit + PR** sur la branche `feature/p5-uc02-uc05-implementation` vers `develop` (Git flow I-007).
3. **Autorisation d'ajout** des 2 risques R-UC02-01 / R-UC05-01 (scores 2, Accepté) à `RISQUES.md`.
4. **Autorisation de création** des 7 tâches complémentaires **TACHE-094 à TACHE-100** dans `BACKLOG.md`.
5. **Autorisation de mise à jour** du document `docs/p5-tests/p5-uc02-password-managers-scenarios-v1.0.md` pour refléter l'arbitrage Option A sur les 6 cellules auto-submit §8 (C-07 traité dans le même commit).

---

_PV émis à l'issue du comité de revue code du 2026-04-17. Rédigé par l'Orchestrateur sur la base des avis individuels du Rapporteur Développeur, de l'Architecte sécurité et du Testeur QA, et de l'arbitrage rendu sur la divergence TC-UC05-05._
