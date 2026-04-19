# Rapport de revue qualité transversale — Sentinel Nudge

**Date** : 2026-04-19
**Auteur** : Référent qualité (Fabrique)
**Périmètre** : P1 à P6 — tous livrables documentaires produits
**Niveau de sensibilité** : Exposé
**Phase active** : P5 (fiabilisation M7 + couverture UC P0 v1)

---

## 1. Bilan synthétique transversal

Le projet présente un niveau de maturité qualité globalement satisfaisant après 29 PR mergées lors de la session du 2026-04-19. Les processus fondamentaux (Conventional Commits, CI obligatoire, flux PR, cycle PDCA) sont bien appliqués. Les anomalies identifiées sont de nature documentaire et de classement, non fonctionnelles. Trois points d'attention prioritaires ressortent : (1) deux versions actives simultanées du DAT dans le repo sans archivage formalisé, (2) la référence brisée du DAT v1.4 vers le SFD v1.0 (obsolète, remplacé par v1.1), et (3) trois manques de capitalisation LL-XXX sur des incidents récurrents constatés cette session. Les tâches T-134/135/136 restent bien tracées dans le BACKLOG malgré leur statut "À faire". L'audit T-010 décrit encore ces tâches comme "P2" sans mentionner que T-132/T-133 ont depuis été exécutées, créant une lecture trompeuse de l'état courant.

---

## 2. Inventaire macro des livrables par phase

### P1 — Besoin
| Fichier | Version | Statut |
|---------|---------|--------|
| p1-analyse-litterature-nudging-v2.0.md | v2.0 | Validé |
| p1-cahier-des-charges-v1.1.md | v1.1 | Validé |
| p1-analyse-licences-open-source-v1.0.md | v1.0 | Validé |

### P2 — Spécifications
| Fichier | Version | Statut |
|---------|---------|--------|
| p2-sfd-v1.1.md | v1.1 | Validé |
| diagrammes/sources/*.mmd (14 fichiers) | — | Produit |
| diagrammes/images/*.png (13 fichiers) | — | Produit |

### P3 — Architecture
| Fichier | Version | Statut |
|---------|---------|--------|
| p3-dat-v1.3.md | v1.3 | Obsolète — voir A-01 |
| p3-dat-v1.4.md | v1.4 | Produit (en attente validation formelle) |
| p3-aipd-m7-v1.0.md | v1.0 | Supersédé |
| p3-aipd-m7-v1.1.md | v1.1 | Supersédé |
| p3-aipd-m7-v1.2.md | v1.2 | Validé (T-154) |

### P4 — Conception
| Fichier | Version | Statut |
|---------|---------|--------|
| brand-book-sentinel-nudge.md | v1.0 | Validé |
| p4prime-tests-manuels-modules-asynchrones-v1.0.md | v1.0 | Validé |
| design-proposals-v3/ (6 thèmes + tokens-v2) | — | Produit (maquettes actives) |

### P5 — Livrables (éparpillés)
| Fichier | Emplacement actuel | Anomalie |
|---------|--------------------|----------|
| p5-minidat-tache-061-heartbeat-m7-v1.1.md | docs/p4-conception/ | A-03 classement |
| p5-minidat-tache-068-uc01-login-multi-etape-v1.1.md | docs/p4-conception/ | A-03 |
| p5-minidat-tache-070-uc03-iframes-v1.0.md | docs/p4-conception/ | A-03 |
| p5-minidat-tache-072-toggle-show-hide-v1.1.md | docs/p4-conception/ | A-03 |
| p5-audit-modules-adr-compliance-v1.0.md | docs/p4-conception/ | A-03 |
| matrice-compatibilite-providers-m7.md | docs/p5-recette/ | A-04 nommage |
| plan-tests-manuels-consolide-v1.0.md | docs/p5-recette/ | OK |

### Gouvernance / Sécurité / RGPD / Accessibilité / ADR
Voir section 4.1 pour anomalies de classement et nommage.

---

## 3. Cohérence statuts BACKLOG vs repo

### Anomalies BACKLOG vs repo

**A-BAC-01 (bloquante) — T-041 statut "À faire" mais DAT v1.4 §17 produit**
Le DAT v1.4 (mergé PR #87, 2026-04-19) contient une section 17 dédiée "Algorithmes de hachage de domaines (FNV-1a vs SHA-256, T-041)". Le statut T-041 dans le BACKLOG doit passer à "Terminé". (Note orchestrateur : déjà fait dans la PR #90 MAJ BACKLOG en attente merge.)

**A-BAC-02 (observation) — T-155 statut "À faire" mais agent DPO a livré v1.1**
T-155 cohérence éditoriale registre Art. 30 → v1.1 livré par l'agent DPO (PR #82 mergée). À passer Terminé. (Note : déjà fait dans PR #90.)

**A-BAC-03 (observation) — T-063 statut "À faire" mais protocole recette partiellement livré**
Plan tests manuels consolidé v1.0 (PR #34) couvre l'essentiel. À clôturer ou préciser périmètre résiduel.

**A-BAC-04 (observation) — T-071 statut "À faire" mais documentation UC-04 partielle**
Politique v1.1 et DAT v1.4 mentionnent les iframes cross-origin. À vérifier si T-154 (AIPD v1.2) couvre le périmètre.

---

## 4. Conformité aux conventions

### 4.1 Convention de nommage des documents

**A-01 (bloquante) — DAT v1.3 et v1.4 coexistent**
`docs/p3-architecture/p3-dat-v1.3.md` et `p3-dat-v1.4.md` simultanés. LL-001 : "Ne jamais laisser plusieurs versions d'un même livrable coexister." Supprimer v1.3 (Git history conserve l'historique).

**A-02 (bloquante) — 3 versions AIPD M7 + 2 politiques RGPD coexistent**
`p3-aipd-m7-v1.0/v1.1/v1.2.md` ET `politique-de-confidentialite-v1.0/v1.1.md` simultanés. Supprimer v1.0 et v1.1 obsolètes.

**A-03 (bloquante) — Mini-DAT P5 dans docs/p4-conception/**
5 fichiers `p5-*.md` rangés dans le répertoire P4. Selon FICHIERS.md, P5 attend `docs/p5-tests-unitaires/`. Classement non conforme.

**A-04 (bloquante) — matrice-compatibilite-providers-m7.md sans version**
Convention `<phase>-<type>-v<majeur>.<mineur>.md` non respectée. Renommer.

**A-05 (bloquante) — docs/securite/*.md sans version ni préfixe**
`referentiel-iso27001.md` et `runbook-reponse-incident.md` ne portent ni préfixe phase ni version. Comparer avec `audit-config-github-v1.0.md` et `hardening-ci-cd-v1.0.md` qui sont conformes.

**OBS-01 (non bloquante) — Classement docs/securite/ non prévu dans FICHIERS.md**
FICHIERS.md prévoit `docs/referentiel-securite.md` (racine). Le sous-dossier `docs/securite/` est pertinent mais non formalisé.

**OBS-02 (non bloquante) — Répertoire docs/p5-recette/ non référencé dans FICHIERS.md**
FICHIERS.md prévoit `docs/p7-recette/`. Le `docs/p5-recette/` existe sans formalisation.

**OBS-03 (non bloquante) — Répertoire docs/adr/ non référencé dans FICHIERS.md**
Pertinent (pratique standard ADR) mais non formalisé.

### 4.2 Conventional Commits

Aucune anomalie détectable. Les préfixes utilisés (`feat:`, `fix:`, `docs:`, `chore:`, `security:`, `test:`, `ci:`, `refactor:`) sont conformes.

### 4.3 Versionning

Convention correctement appliquée. Les anomalies A-01/A-02 portent sur l'archivage, pas sur la numérotation.

---

## 5. Cohérence inter-livrables

### 5.1 A-06 (bloquante) — DAT v1.4 référence SFD v1.0 (obsolète)
DAT v1.4 en-tête référence `p2-sfd-v1.0.md`. Le SFD courant est `p2-sfd-v1.1.md`. À corriger.

### 5.2 OBS-04 (non bloquante) — AIPD M7 v1.2 référence DAT v1.3
Antérieur au bump DAT v1.4. À corriger au prochain bump AIPD.

### 5.3 A-07 (bloquante) — Audit accessibilité T-010 figé pré-corrections T-132/T-133
`docs/accessibilite/checklist-accessibilite-pages-statiques-v1.0.md` décrit T-132/T-133 comme P0/P1 à réaliser, alors que toutes deux sont Terminé. Bumper en v1.1.

**Précision sur PR #92 (T-134/135/136)** : ces 3 tâches sont marquées Should/Could (P2 selon priorité résiduelle), donc leur description en "P2" dans l'audit reste exacte. L'anomalie porte uniquement sur T-132/T-133.

### 5.4 Référentiel ISO 27001 : conformité nommage vs FICHIERS.md
Couvert par OBS-01.

### 5.5 Politique de confidentialité : 2 versions coexistantes
Visée par A-02. Aucune incohérence de contenu : v1.1 est bien la version user-friendly produite par T-154.

---

## 6. Cycle PDCA — Capitalisation

### 6.1 Problèmes capitalisés correctement
P-001 à P-024 tracés, LL-001 à LL-009 et LL-021 à LL-028 et LL-030 capitalisées. Chaîne PDCA respectée.

### 6.2 A-08 (bloquante) — LL-029 absente du LESSONS_LEARNED.md
T-138 mentionne "LL-029 proposée." mais LL-029 n'apparaît pas dans LESSONS_LEARNED.md (saut LL-028 → LL-030). LL-031 absente aussi. Vérifier si LL-029 a été rédigée et non versée, ou oubliée.

### 6.3 Incidents non capitalisés à examiner
- **Hotfix axe-core T-157 (c)** arbitrage blanc pixel-perfect vs noir AA — leçon design/accessibilité récurrente à capitaliser.
- **Bug "checkout sur mauvaise branche"** constaté 2x en session 2026-04-19 — à consigner dans PROBLEMES.md et capitaliser en LL-XXX si récurrent.

---

## 7. Risques qualité résiduels (prioritisés)

| # | Priorité | Risque | Impact |
|---|---------|--------|--------|
| 1 | Critique | A-01 DAT v1.3+v1.4 coexistent | Décision sur version obsolète |
| 2 | Critique | A-02 3 AIPD + 2 politiques coexistent | Conformité RGPD compromise si mauvaise version référencée |
| 3 | Élevé | A-07 audit T-010 figé pré-corrections | Recette P7 affichera ~91% au lieu de ~97% |
| 4 | Élevé | A-08 LL-029 absente | Trou de numérotation, leçon perdue |
| 5 | Moyen | A-06 DAT v1.4 réf SFD v1.0 obsolète | Incohérence détectable en comité |
| 6 | Moyen | A-03 5 mini-DAT P5 mal classés | Livrables introuvables par agent |
| 7 | Faible | OBS-01/02/03 FICHIERS.md incomplet | Règles non opposables |
| 8 | Faible | A-05 docs/securite/ sans version | Versionning opaque |

---

## 8. Recommandations — Actions correctives (T-RQ-001 à T-RQ-010)

### T-RQ-001 (Must) — Supprimer DAT v1.3
Supprimer `docs/p3-architecture/p3-dat-v1.3.md`. Git history suffit pour traçabilité.

### T-RQ-002 (Must) — Supprimer AIPD M7 v1.0/v1.1 + politique v1.0
Supprimer les 3 fichiers obsolètes de `docs/p3-architecture/` et `docs/rgpd/`. Une seule version active par livrable (LL-001).

### T-RQ-003 (Must) — Corriger référence SFD dans DAT v1.4
Remplacer `p2-sfd-v1.0.md` par `p2-sfd-v1.1.md` dans l'en-tête du DAT v1.4.

### T-RQ-004 (Must) — Bumper audit accessibilité T-010 en v1.1
Mettre à jour `docs/accessibilite/checklist-accessibilite-pages-statiques-v1.0.md` → v1.1 pour acter T-132/T-133 corrigées + actualiser taux de conformité estimé. Responsable : Expert accessibilité.

### T-RQ-005 (Must) — Capitaliser LL-029 absente
Vérifier raison du saut LL-028 → LL-030. Si LL-029 a été prévue (T-138 la mentionne), la rédiger et la verser.

### T-RQ-006 (Should) — Déplacer mini-DAT P5 hors docs/p4-conception/
Soit déplacer vers `docs/p5-tests-unitaires/`, soit enrichir FICHIERS.md d'un emplacement P5 dédié (ex. `docs/p5-architecture/` ou `docs/p5-decisions/`).

### T-RQ-007 (Should) — Normaliser noms fichiers docs/securite/
Renommer `referentiel-iso27001.md` → `referentiel-iso27001-v1.1.md`, `runbook-reponse-incident.md` → `runbook-reponse-incident-v1.0.md`, `matrice-compatibilite-providers-m7.md` → `p5-matrice-compatibilite-providers-m7-v1.0.md`.

### T-RQ-008 (Should) — Enrichir FICHIERS.md
Ajouter règles pour : `docs/securite/`, `docs/adr/`, `docs/rgpd/`, `docs/accessibilite/`, `docs/p5-recette/`. Responsable : Orchestrateur.

### T-RQ-009 (Should) — Clore T-041 si DAT §17 satisfait
Vérifier (par Architecte logiciel) puis passer T-041 en Terminé. (Note orchestrateur : déjà fait dans PR #90 en attente merge.)

### T-RQ-010 (Could) — Capitaliser bug "checkout mauvaise branche" en LL-XXX
Consigner dans PROBLEMES.md + LL dédiée. Règle : vérifier `git branch` et `git status` avant tout commit en contexte multi-branches actif.

---

## Annexe — Récapitulatif des anomalies

| ID | Sévérité | Sujet | Reco |
|----|----------|-------|------|
| A-01 | Bloquante | DAT v1.3 et v1.4 coexistent | T-RQ-001 |
| A-02 | Bloquante | AIPD M7 v1.0/v1.1/v1.2 + politique RGPD v1.0/v1.1 coexistent | T-RQ-002 |
| A-03 | Bloquante | Mini-DAT P5 classés dans docs/p4-conception/ | T-RQ-006 |
| A-04 | Bloquante | matrice-compatibilite-providers-m7.md sans version | T-RQ-007 |
| A-05 | Bloquante | referentiel-iso27001.md et runbook-reponse-incident.md sans version | T-RQ-007 |
| A-06 | Bloquante | DAT v1.4 référence SFD v1.0 obsolète | T-RQ-003 |
| A-07 | Bloquante | Audit accessibilité T-010 figé avant corrections T-132/T-133 | T-RQ-004 |
| A-08 | Bloquante | LL-029 absente du LESSONS_LEARNED.md | T-RQ-005 |
| OBS-01 | Non bloquante | docs/securite/ non formalisé dans FICHIERS.md | T-RQ-008 |
| OBS-02 | Non bloquante | docs/p5-recette/ non formalisé dans FICHIERS.md | T-RQ-008 |
| OBS-03 | Non bloquante | docs/adr/ non formalisé dans FICHIERS.md | T-RQ-008 |
| OBS-04 | Non bloquante | AIPD M7 v1.2 référence DAT v1.3 | À corriger au prochain bump |

---

## Métriques qualité

- **Anomalies bloquantes détectées** : 8
- **Observations non bloquantes** : 4
- **Type d'anomalie le plus fréquent** : Versionning / archivage (A-01, A-02 — coexistence de versions obsolètes) — récurrent depuis LL-001
- **Recommandation backlog transversale** : ajouter règle systématique de suppression de la version N-1 lors de tout bump de version documentaire (s'applique à tous les agents Fabrique).
