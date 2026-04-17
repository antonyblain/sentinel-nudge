# Référentiel de sécurité — ISO/CEI 27001:2022 (Annexe A)

**Projet** : Sentinel Nudge
**Version** : 1.1
**Date** : 2026-04-17
**Auteur** : Architecte sécurité (Fabrique)
**Statut** : Vivant — enrichi à chaque phase
**Niveau de sensibilité** : Exposé
**Origine** : TACHE-075 (v1.0) — TACHE-114 (v1.1, post-TACHE-085/107/110/111)

---

## 1. Introduction

### 1.1 Objectif

Ce document constitue le référentiel de sécurité du projet Sentinel Nudge. Il trace, contrôle par contrôle, la correspondance entre les mesures techniques et organisationnelles implémentées ou planifiées dans le projet et les contrôles de l'**Annexe A de la norme ISO/CEI 27001:2022**.

Il sert trois finalités :

1. **Boussole méthodologique** — guider les choix de conception, de codage et de recette selon une grille reconnue internationalement.
2. **Preuve de traçabilité** — pour chaque exigence de sécurité décidée en projet, pointer vers l'implémentation, le test, l'ADR ou le risque associé.
3. **Point d'entrée pour audit** — permettre à un tiers (RSSI, auditeur, relecteur OSS, futur contributeur) de vérifier rapidement le niveau de maturité sécurité du projet sans parcourir l'ensemble des livrables.

### 1.2 Cadre ISO 27001:2022

L'ISO/CEI 27001:2022 est la norme internationale de référence pour les systèmes de management de la sécurité de l'information (SMSI). Son Annexe A décrit 93 contrôles répartis en 4 thèmes :

- **A.5** — Contrôles organisationnels (37 contrôles)
- **A.6** — Contrôles relatifs au personnel (8 contrôles)
- **A.7** — Contrôles physiques (14 contrôles)
- **A.8** — Contrôles technologiques (34 contrôles)

Sentinel Nudge étant un projet d'extension navigateur open source sans entité juridique opérant un service hébergé, une grande partie des contrôles A.6 (personnel) et A.7 (physique) ne s'applique pas directement. Le projet se concentre sur les contrôles organisationnels A.5 pertinents (gestion d'incidents, threat intelligence) et l'ensemble des contrôles technologiques A.8 applicables à un logiciel client-side.

### 1.3 Note sur la portée

Le projet Sentinel Nudge **n'est pas soumis à une certification ISO 27001 formelle** (extension open-source communautaire, pas d'organisme de rattachement). Les contrôles référencés ici servent de **boussole méthodologique** et non d'exigence de conformité auditée. Cette posture est conforme à la note de clôture du mini-DAT TACHE-061 section 12.

### 1.4 Conventions

#### Statuts d'applicabilité

| Statut | Description |
|--------|-------------|
| **Implémenté** | Mesure effective dans le code, la documentation ou la gouvernance, vérifiable par une référence précise (fichier source, ADR, test). |
| **Partiellement implémenté** | Tronc de la mesure présent, écart(s) résiduel(s) identifié(s) avec tâche de remédiation au BACKLOG. |
| **Planifié** | Mesure décidée, non encore implémentée, tâche au BACKLOG. |
| **Dormant** | Mesure produite et disponible, mais non activée opérationnellement en raison d'un prérequis externe (ex. canal public non ouvert). Redevient *Implémenté* dès la levée du prérequis. |
| **Non applicable** | Le contrôle ne s'applique pas au périmètre projet (ex. contrôles physiques pour un logiciel client-side). |

#### Niveaux de maturité qualitative (échelle SAMM-like)

| Niveau | Signification |
|--------|---------------|
| *Initial* | Action ad hoc, non reproductible |
| *Reproductible* | Pattern existant appliqué au cas par cas |
| *Défini* | Process documenté, applicable uniformément |
| *Géré* | Process documenté + outillé + mesuré (SLA, métriques, tabletop) |
| *Optimisé* | Amélioration continue, boucle de rétroaction active |

#### Mapping avec les autres référentiels

Chaque fiche de contrôle comporte un tableau de correspondance :

- **RISQUES.md** — risques projet couverts par la mesure (identifiants R-XXX).
- **BACKLOG.md** — tâches de production ou de remédiation (identifiants TACHE-XXX).
- **ADR** — décisions architecturales qui dérivent de ce contrôle (ADR-XXX).
- **AIPD** — points d'ancrage dans l'AIPD M7 (section 1.3, 2.x, etc.).

---

## 2. Périmètre

### 2.1 Modules couverts

Le référentiel couvre le périmètre v1 validé par le Commanditaire (cahier des charges P1 v1.1), soit **7 modules actifs** :

| Module | Description | Statut couverture sécurité |
|--------|-------------|----------------------------|
| M2 | Nudge domaines suspects (typosquatting + HSTS) | **Implémentée** — TACHE-085 mergée (PR #19) : `initBootM2()` + `diagnostics.m2` + incidents `whitelist_corrupted` / `whitelist_regenerated` |
| M3 | Score de cyber-hygiène hebdomadaire | Partielle — TACHE-086 (diagnostics.m3 minimal) à livrer |
| M5 | Nudge mise à jour navigateur | Partielle — TACHE-087 (initBoot + diagnostics.m5) à livrer |
| M6 | Quiz de sensibilisation (spaced repetition) | Partielle — TACHE-088 (initBoot + diagnostics.m6) à livrer |
| M7 | Nudge réutilisation de mot de passe | **Implémentée** — TACHE-061 mergée (heartbeat + canary + registre) |
| M9 | Nudge certificats expirés | Basique — TACHE-089 (diagnostics.m9 minimal) à livrer |
| M17 | Nudge données sensibles dans presse-papiers | Basique — TACHE-089/090 (diagnostics.m17 + pending_m17_toast) à livrer |

### 2.2 Phases projet couvertes au 2026-04-17

| Phase | Livrables sécurité produits |
|-------|------------------------------|
| P1 | Cahier des charges v1.1 (principe Privacy by Design) |
| P2 | PV comité sécurité P2 v1.0, SFD v1.1 |
| P3 | DAT v1.3, AIPD M7 v1.0, STRIDE global |
| P4 / P4' | Implémentation code + Brand Book + gouvernance revue code P4' |
| **P5 (en cours)** | ADR-001, ADR-002, mini-DAT TACHE-061 v1.1, audit modules v1.0, référentiel ISO v1.0/v1.1, `SECURITY.md` v1.0, runbook réponse à incident v1.0, templates GitHub issue, M2 `initBoot` + diagnostics |

### 2.3 Tableau synthétique — maturité par domaine de contrôle

Auto-évaluation qualitative au 2026-04-17 (post-TACHE-085/107/110/111) sur l'échelle SAMM-like définie en §1.4. Les promotions de maturité intervenues en v1.1 sont signalées en gras.

| Domaine | Contrôles ISO | Statut | Maturité | Justification principale |
|---------|---------------|--------|----------|--------------------------|
| Conception sécurisée | A.5.7, A.8.25, A.8.28 | Implémenté | *Reproductible* | STRIDE global DAT + STRIDE ciblés feature (mini-DAT T-061) + ADR-001/002 opposables, revue code Exposé systématique |
| Logging | A.8.15 | **Partiellement implémenté** | *Défini* (M7 + M2 livrés) | **Registre M7 + `diagnostics.m7` (T-061) + `diagnostics.m2` + incidents `whitelist_corrupted`/`_regenerated` livrés (T-085, PR #19).** Reste *Partiel* globalement tant que le chantier A (T-086 à 091) n'est pas terminé. |
| Monitoring | A.8.16 | **Partiellement implémenté** | *Défini* (M7 + M2 livrés) | Idem ci-dessus. Badge dégradé utilisateur et page d'état consolidée pendantes (T-062, T-109). |
| Cryptographie | A.8.24 | Implémenté | *Défini* | AES-256-GCM, SHA-256 + sel, IV uniques INV-SEC-01, sérialisation Array&lt;number&gt; figée (INV-06) |
| Gestion de vulnérabilités | A.8.8 | **Implémenté (partiellement dormant)** | *Géré* (interne) / *Dormant* (externe) | **`SECURITY.md` v1.0 + templates issue livrés (T-107/111, PR #17)** — **canal GitHub Security Advisories dormant tant que repo privé (T-112 bloquante)**. Post-mortem M7 éprouvé + SBOM + Dependabot actifs. |
| Prévention fuite de données | A.8.12 | Implémenté | *Défini* | **Factory `logger.ts` livrée (T-083, PR #12)** + INV-SEC-02 + Privacy by Design. Migration résiduelle T-104/105. |
| **Gestion d'incidents** | **A.5.24 / A.5.26** | **Implémenté (maturité *Géré*)** | **promotion de *Défini* → *Géré*** | **Runbook `docs/securite/runbook-reponse-incident.md` v1.0 livré (T-110, PR #18)** : classification P0-P3, timeline par sévérité, 10 Steps opérationnels, 5 templates de communication, grille de post-mortem, cadence annuelle de tabletop (T-113). Précédent éprouvé : post-mortem M7 du 2026-04-14. |

---

## 3. Tableau synthétique des 8 contrôles initiaux

| # | Contrôle | Nom ISO | Statut | Origine mesure | Écarts résiduels |
|---|----------|---------|--------|----------------|------------------|
| 1 | **A.5.7** | Threat intelligence | Implémenté | STRIDE DAT + STRIDE ciblés TACHE-061 + STRIDE ADR-001/002 | Extension aux autres modules (M3/M5/M6/M9/M17) en lot v2 |
| 2 | **A.8.8** | Management of technical vulnerabilities | **Implémenté (partiellement dormant)** | Post-mortem M7 + SBOM CycloneDX + Dependabot + **`SECURITY.md` v1.0 (T-107, PR #17)** + **templates issue (T-111, PR #17)** | Canal GitHub Security Advisories **dormant** tant que repo privé → **TACHE-112** bloquante |
| 3 | **A.8.12** | Data leakage prevention | Implémenté | INV-SEC-02 + typage `IncidentContext` + **factory `logger.ts` (T-083, PR #12)** + Privacy by Design | Migration factory logger non terminée (TACHE-104, TACHE-105) |
| 4 | **A.8.15** | Logging | Partiellement implémenté | Registre M7 + INV-SEC-03/04 + **M2 `whitelist_corrupted`/`_regenerated` + `diagnostics.m2` (T-085, PR #19)** | Incidents M3/M5/M6/M9/M17 à généraliser (TACHE-086 à 091, R-ADR-05) |
| 5 | **A.8.16** | Monitoring activities | Partiellement implémenté | Heartbeat `diagnostics.m7` + **`diagnostics.m2` (T-085, PR #19)** | Badge dégradé TACHE-062 + `diagnostics.<module>` des 5 modules restants à livrer |
| 6 | **A.8.24** | Use of cryptography | Implémenté | AES-256-GCM + SHA-256 + sel installation + INV-SEC-01 (IV frais) + R-CLI-06 | Clé en chrome.storage.local (R-003 accepté) |
| 7 | **A.8.28** | Secure coding | Implémenté | ADR-001 (R-BOOT-01 à 05) + ADR-002 (R-CLI-01 à 07) + INV-SEC-02 + règle ESLint logger | Extension règle ESLint (TACHE-104) ; SAST CodeQL (TACHE-108) bloqué par TACHE-112 |
| 8 | **A.5.24 / A.5.26** | Information security incident management / response | **Implémenté (maturité *Géré*)** — **promu en v1.1** | `M7IncidentRecord` + post-mortem M7 PDCA + RISQUES.md suivi + **runbook v1.0 (T-110, PR #18)** + **templates issue (T-111, PR #17)** | Premier tabletop exercise TACHE-113 (cadence annuelle) + confirmation circuit DPO TACHE-115 |

**Note** : les 8 contrôles listés constituent l'initialisation v1.0 (contrôles référencés par le mini-DAT TACHE-061 section 12). D'autres contrôles déjà couverts par les livrables (A.5.10, A.8.10, A.8.25) sont mentionnés dans les ADR mais seront formellement tracés dans les prochaines versions de ce document (v1.2+).

---

## 4. Fiches détaillées

### 4.1 A.5.7 — Threat intelligence

**Intitulé officiel ISO** : *Information relating to information security threats shall be collected and analysed to produce threat intelligence.*

#### Objectif du contrôle

Collecter, analyser et exploiter l'information relative aux menaces de sécurité applicables au système afin d'adapter la posture défensive. Le contrôle couvre à la fois la *threat intelligence stratégique* (paysage de menace) et la *threat intelligence tactique / opérationnelle* (indicateurs, vulnérabilités exploitables).

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| STRIDE global du DAT P3 (6 actifs, 5 classes de menace) | `docs/p3-architecture/p3-dat-v1.3.md` section 9 |
| STRIDE ciblé Heartbeat + Canary + Registre d'incidents (5 sous-sections : spoofing/tampering canary, tampering registre, info disclosure, DoS, EoP régénération clé) | `docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md` section 11 |
| STRIDE ADR-001 SW-BOOT-CONTRACT (4 menaces atténuées, 3 hors périmètre documentées) | `docs/adr/adr-001-sw-boot-contract.md` section "Analyse STRIDE" |
| STRIDE ADR-002 CROSS-LIFECYCLE-INTENT (4 menaces atténuées, 3 hors périmètre documentées) | `docs/adr/adr-002-cross-lifecycle-intent.md` section "Analyse STRIDE" |
| Consolidation des menaces dans le registre projet RISQUES.md (27+ risques dont R-M7-03 à R-M7-09, R-ADR-01 à R-ADR-07, R-UC02-01, R-UC03-07, R-UC05-01) | `.claude/RISQUES.md` |
| Veille vulnérabilités dépendances npm — Dependabot actif sur le dépôt GitHub | Configuration repository `antonyblain/sentinel-nudge` |
| Capitalisation des menaces observées en production (saga M7 — P-014 à P-020) en règles permanentes LESSONS_LEARNED | `.claude/LESSONS_LEARNED.md` (atelier PDCA post-mortem M7) |

#### Statut

**Implémenté** pour le périmètre M7 et pour les composants couverts par les ADR-001/002. Le STRIDE global DAT couvre l'architecture. Les STRIDE ciblés par feature sont désormais une pratique standardisée (toute feature de niveau Exposé passe par un STRIDE ciblé via le mini-DAT ou le PV comité sécurité).

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| STRIDE ciblés non encore produits pour M3/M5/M6/M9/M17 | Absorbé par TACHE-086 à 091 (chaque `initBoot()` inclut une catégorisation des menaces et des types d'incidents équivalents — cf. R-ADR-05). M2 désormais couvert (T-085 livrée PR #19). |
| Extension du registre d'incidents à toutes les fonctions sensibles non M7 | R-ADR-05 ouvert, couvert par TACHE-086 à 091. M2 couvert (T-085). |

---

### 4.2 A.8.8 — Management of technical vulnerabilities

**Intitulé officiel ISO** : *Information about technical vulnerabilities of information systems in use shall be obtained, the organization's exposure to such vulnerabilities shall be evaluated and appropriate measures shall be taken.*

#### Objectif du contrôle

Détecter, évaluer et corriger les vulnérabilités techniques affectant les systèmes utilisés, avec un cycle d'obtention d'information (veille) → évaluation (scope, sévérité) → action (patch, mitigation, contournement).

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| Post-mortem M7 (2026-04-14) avec identification de 2 vulnérabilités logicielles latentes (P-016 fail silent, P-018 sérialisation cassée) et 7 commits correctifs (P-014 à P-020) | `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md` |
| Atelier PDCA post-mortem consolidant 7 règles permanentes (contrat avant code, pyramide tests, etc.) | Section "PDCA" du PV post-mortem + `.claude/LESSONS_LEARNED.md` |
| ADR-001 SW-BOOT-CONTRACT — généralisation détective + corrective de la classe "fail silent at boot" (CWE-252 Unchecked Return Value, CWE-755 Improper Handling of Exceptional Conditions) | `docs/adr/adr-001-sw-boot-contract.md` |
| ADR-002 CROSS-LIFECYCLE-INTENT — généralisation de la résilience aux frontières de cycle de vie (CWE-502 Deserialization of Untrusted Data) | `docs/adr/adr-002-cross-lifecycle-intent.md` |
| Heartbeat `diagnostics.m7` + canary hash au boot SW — mitigation détective de P-016 / P-018 en amont | TACHE-061 mergée (PR #4), `src/background/services/canary-service.ts`, `heartbeat-service.ts` |
| Registre d'incidents IndexedDB `m7_incidents` (nomenclature historique, héberge aussi les incidents M2 depuis T-085 — dette sémantique mineure non bloquante ISO, à résorber en migration IDB ultérieure) avec purge FIFO sévérité-priorisée (500 entrées max, INV-SEC-04) | `src/background/services/incident-service.ts`, `src/shared/types/diagnostics.ts` |
| **`SECURITY.md` v1.0 livré (TACHE-107, PR #17)** — canal privé GitHub Security Advisories, SLA 30 jours correctif, scope in/out, safe harbor, 7 types de vulnérabilités recherchés | `SECURITY.md` |
| **Templates issue GitHub livrés (TACHE-111, PR #17)** — `.github/ISSUE_TEMPLATE/config.yml` redirige tout rapport sécurité vers le canal privé ; template `security-bug.md` pour sévérités faibles | `.github/ISSUE_TEMPLATE/` |
| SBOM CycloneDX généré en CI (Instruction Commanditaire I-002) — visibilité sur les versions exactes des dépendances | `.github/workflows/ci.yml` (job SBOM), artefact publié par release |
| Dependabot actif sur le dépôt GitHub — alertes et PR automatiques sur vulnérabilités des dépendances npm | GitHub security settings, `dependabot.yml` |
| Registre de risques RISQUES.md enrichi à chaque incident/post-mortem (R-M7-03 à R-M7-09 ajoutés 2026-04-16, R-ADR-01 à R-ADR-07 ajoutés 2026-04-17) | `.claude/RISQUES.md` |

#### Statut

**Implémenté (partiellement dormant)** — le projet dispose d'un cycle complet veille → évaluation → action sur les vulnérabilités logicielles internes (post-mortem + ADR + registre) et sur les vulnérabilités des dépendances (SBOM + Dependabot). Le canal externe de divulgation responsable est **formalisé** par `SECURITY.md` et les templates issue, **mais dormant** tant que le repository GitHub reste privé : le canal Security Advisories n'est pas atteignable par un tiers sans accès au repo. L'activation opérationnelle dépend exclusivement de **TACHE-112** (checklist pré-publication + bascule `private → public`).

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| Canal GitHub Security Advisories non atteignable depuis l'extérieur (repo privé) | **TACHE-112** (Must, P6) — checklist pré-publication + `gh api ... visibility=public`. Jusque-là, A.8.8 est *dormant* pour la partie divulgation tiers. |
| Migration factory logger non terminée (12 sites résiduels SW + 26 sites CS/UI) — champ `err.message` potentiellement exposé en console | TACHE-104, TACHE-105 |
| Remédiation R-M7-09 (incidents fantômes au premier install) | TACHE-079 (mergée PR #10). Confirmation en recette P7. |
| Absence d'exercices tabletop réels pour valider l'opérabilité du process (au-delà du post-mortem M7) | **TACHE-113** (Should, P7) — premier tabletop XSS UC-06 cadencé juillet 2026 |

---

### 4.3 A.8.12 — Data leakage prevention

**Intitulé officiel ISO** : *Data leakage prevention measures shall be applied to systems, networks and any other devices that process, store or transmit sensitive information.*

#### Objectif du contrôle

Prévenir la divulgation non autorisée d'informations sensibles hors du périmètre maîtrisé (réseau, stockage, canaux de journalisation, supports de sortie). Le contrôle est particulièrement pertinent pour les journaux, les exports utilisateur et les canaux de télémétrie.

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| **Privacy by Design** — principe fondateur du projet : aucune télémétrie, aucun appel réseau sortant dans les modules de nudge, tout traitement local sur le poste de l'utilisateur | Cahier des charges P1 v1.1 section 3.1 ; AIPD M7 v1.0 sections 1.4, 1.6, 1.7 |
| Mot de passe en clair **jamais stocké** — effacement mémoire < 5 ms après hachage (D-SEC-001) | AIPD M7 v1.0 section 1.3 ; `src/content-scripts/password-detector.ts` |
| Valeur collée M17 nullifiée dès la fin du pattern matching (< 10 ms) pour éviter capture par extension malveillante tierce | RISQUES.md R-002 (résolu) |
| **INV-SEC-02** — interdiction structurelle de plaintext sensible dans le champ `context` d'un incident (mots de passe, tokens, URLs complètes, domain_hash corrélable à saisie < 5s) | Mini-DAT TACHE-061 v1.1 section 6bis ; `src/shared/types/diagnostics.ts` |
| **CM-ID2** — typage par union discriminée `IncidentContext` (empêche à la compilation l'ajout de champs libres susceptibles de contenir du plaintext) | Mini-DAT TACHE-061 v1.1 section 11.3 ; `src/shared/types/diagnostics.ts` |
| **CM-ID3 — Factory `logger.ts` livrée (TACHE-083, PR #12)** remplaçant les `console.*` bruts dans `service-worker.ts` et `m7-handler.ts`, règle ESLint custom `no-restricted-syntax` interdisant `err.message` / `String(err)` en argument `console.*` — **mitigation partielle de R-M7-08** (fuite console SW) | `src/shared/logger.ts` ; `.eslintrc` ; mini-DAT TACHE-061 v1.1 section 11.3 |
| Test unitaire TC-M7-SEC-26 — injection de `context={ password: '...' }` rejetée par validation runtime | `tests/unit/incident-service.test.ts` |
| **R-CLI-07** — minimisation du payload d'un pending-intent (hashes, enums, IDs abstraits ; interdit : plaintext, tokens, URLs avec query string, cookies) | ADR-002 section "Règles dérivées" |
| Pas d'`innerHTML` sur entrées DOM non contrôlées — `textContent` uniquement, ESLint no-restricted-properties | RISQUES.md R-004 (résolu) ; ESLint config |
| CSP stricte `script-src 'self'` | `src/manifest.json`, DAT P3 section CSP |
| Export RGPD Art. 20 — données exportables uniquement sur action explicite utilisateur, fichier local jamais transmis | `src/pages/options/options.ts` `handleExport()` ; TACHE-013 mergée |
| Revue DPO AIPD M7 systématique en cas de nouveau champ loggé (TACHE-074 ouverte sur l'inventaire console post-TACHE-061, TACHE-084 pour complément) | BACKLOG TACHE-074, TACHE-084 |

#### Statut

**Implémenté** sur le périmètre IDB (`incidentService.log()` typé) et sur le périmètre réseau (aucune sortie). Le périmètre console SW est en cours de remédiation : la factory `logger.ts` livrée par TACHE-083 (PR #12) établit la brique centrale ; TACHE-104 (12 sites SW résiduels) et TACHE-105 (26 sites CS/UI) achèveront la couverture.

#### Écarts résiduels et remédiation

| Écart | Tâche / Risque |
|-------|----------------|
| 12 sites résiduels `console.*` dans handlers SW avec pattern `const message = err.message` non capturé par la règle ESLint actuelle | TACHE-104 |
| 26 sites `console.*` dans content scripts + pages UI non migrés vers la factory | TACHE-105 |
| R-M7-08 (fuite console SW) partiellement mitigé — statut *Ouvert* tant que T-104/105 non livrées | R-M7-08 ; inventaire DPO à finaliser par TACHE-084 |
| Absence de revue périodique des exports utilisateur (Art. 20) pour détecter une régression introduisant un champ sensible | À intégrer à la checklist comité de recette (P7) |

---

### 4.4 A.8.15 — Logging

**Intitulé officiel ISO** : *Logs that record activities, exceptions, faults and other relevant events shall be produced, stored, protected and analysed.*

#### Objectif du contrôle

Produire, stocker, protéger et analyser des journaux d'événements de sécurité permettant la détection des incidents, la réponse à incident et la forensique post-événement. Les logs doivent être horodatés, structurés, protégés contre l'altération et la suppression.

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| Registre d'incidents IndexedDB `m7_incidents` — store dédié, clé `id` auto-incrément, index `ts` et `type` (nommage historique ; héberge depuis T-085 aussi les incidents M2 — dette sémantique mineure à résorber en v2) | Mini-DAT TACHE-061 v1.1 section 4 ; `src/background/services/incident-service.ts` |
| Schéma d'incident structuré `M7IncidentRecord` typé (`id`, `ts`, `type`, `severity` info/warn/error, `context` typé `IncidentContext`) | `src/shared/types/diagnostics.ts` |
| Types d'incidents v1 : **M7** — `boot_fail`, `canary_failed`, `submit_detect_fail`, `toast_orphan`, `storage_write_fail`, `idb_write_fail`, `key_regenerated` (INV-SEC-05) ; **M2 — `whitelist_corrupted`, `whitelist_regenerated` (TACHE-085, PR #19)** | `src/shared/types/diagnostics.ts` + `src/background/handlers/m2-handler.ts` |
| **INV-SEC-03** — log `severity=error` AVANT écrasement d'une valeur cryptographique (traçabilité forensique non négociable) | Mini-DAT TACHE-061 v1.1 section 6bis ; ADR-001 R-BOOT-02 |
| **INV-SEC-04** — purge FIFO sévérité-priorisée : `info → warn → error` (mitigation saturation forensique R-M7-07) | Mini-DAT TACHE-061 v1.1 section 6bis ; test TC-M7-SEC-28 |
| **CM-DOS2** — rate-limit applicatif `repeat_count` < 1s sur couple `(type, severity)` avec même `context` structurel | Mini-DAT TACHE-061 v1.1 section 11.4 ; `IncidentService.log()` |
| **CM-DOS3** — pas de coalescing pour `severity='error'` (timestamp précis préservé) | `IncidentService.log()` |
| Buffer mémoire borné 10 entrées pré-`initDB()` + flush au premier tick après init — ne pas perdre les incidents critiques de boot (ARB-061-02 Option B) | `src/background/services/incident-service.ts` |
| Borne maximale `MAX_INCIDENTS = 500` entrées — rétention forensique de plusieurs jours en fonctionnement nominal (ARB-061-03 Option A) | `src/background/services/incident-service.ts` |
| `diagnostics.m7` publié dans `chrome.storage.local` avec `ready`, `last_boot_ts`, `boot_count`, `canary_verified`, `last_detection_ts` | `src/background/services/heartbeat-service.ts` |
| **`diagnostics.m2` publié (TACHE-085, PR #19)** avec `ready`, `last_boot_ts`, `boot_count` après contrôle d'intégrité whitelist au boot SW (pattern ADR-001) | `src/background/handlers/m2-handler.ts` — `initBootM2()` |
| ADR-002 — journalisation des défaillances pipeline cross-lifecycle (`toast_orphan`, `pending_purge_failed`) | ADR-002 Règle R-CLI-04 |

#### Statut

**Partiellement implémenté** — M7 (TACHE-061) et **M2 (TACHE-085, PR #19)** disposent désormais d'un logging complet (registre + `diagnostics.<module>` + incidents typés). Les modules **M3 / M5 / M6 / M9 / M17** n'émettent pas encore d'incidents structurés pour leurs défaillances critiques (cf. R-ADR-05). Le statut global reste **Partiellement implémenté** tant que le chantier A (TACHE-086 à 091) n'est pas terminé.

#### Écarts résiduels et remédiation

| Écart | Tâche / Risque |
|-------|----------------|
| M2 : incidents `whitelist_corrupted` / `whitelist_regenerated` | **Résolu — TACHE-085 mergée PR #19** |
| M3 : pas d'incident `events_store_corrupted` | TACHE-086 |
| M5 : pas d'incident `m5_snooze_corrupted` / `update_check_failed` | TACHE-087, R-ADR-02 |
| M6 : pas d'incident `m6_install_date_corrupted` / `quiz_deferred_stale` | TACHE-088, R-ADR-02 |
| M9 : pas d'incident `m9_handler_error` | TACHE-089 |
| M17 : pas d'incident `m17_handler_error` | TACHE-089, TACHE-090 |
| `storage_write_fail` non instrumenté sur les sites critiques (clé régénérée, pending_m7_toast, heartbeat.write()) | TACHE-078 |
| Incidents fantômes premier install polluent la forensique | TACHE-079 (mergée PR #10) — confirmation recette P7 |
| Logs console SW partiellement minimisés (migration factory en cours) | TACHE-083 livrée (PR #12), TACHE-104/105 résiduels |
| Nommage IDB store `m7_incidents` englobe désormais M2 — dette sémantique | Non bloquant ISO. À renommer `incidents_v2` dans une migration IndexedDB ultérieure (hors scope v1). |

---

### 4.5 A.8.16 — Monitoring activities

**Intitulé officiel ISO** : *Networks, systems and applications shall be monitored for anomalous behaviour and appropriate actions taken to evaluate potential information security incidents.*

#### Objectif du contrôle

Surveiller en continu les systèmes, détecter les comportements anormaux et déclencher une action (alerte, analyse, mitigation) sur les écarts. Le contrôle implique une instrumentation visible et un mécanisme d'évaluation périodique.

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| Heartbeat `diagnostics.m7` — état de santé M7 persisté dans `chrome.storage.local` et mis à jour à chaque boot SW, canary, détection | Mini-DAT TACHE-061 v1.1 section 3.1 ; `src/background/services/heartbeat-service.ts` |
| **Heartbeat `diagnostics.m2` — état de santé M2 persisté (TACHE-085, PR #19)** via `initBootM2()` après contrôle d'intégrité whitelist | `src/background/handlers/m2-handler.ts` |
| Champ `ready: boolean` — matérialise l'état fonctionnel du module à tout instant (commun à m7 et m2) | `src/shared/types/diagnostics.ts` |
| Champ `boot_count: number` monotone croissant — détection de boucles de redémarrage anormales (`> 50 / heure` = anomalie documentée) | `src/shared/types/diagnostics.ts` |
| Champ `last_detection_ts` (M7) — surveillance de la cadence de détection (si 0 pendant plusieurs semaines alors que des sites sensibles sont visités, signal faible de dégradation) | `src/shared/types/diagnostics.ts` |
| Invariant INV-01 — `ready === true` implique `canary_verified === true` (aucun faux positif de santé) | Mini-DAT TACHE-061 v1.1 section 6 |
| Invariant INV-05 — si `ready=false` depuis > 3 600 000 ms alors badge dégradé (consommé par TACHE-062) | Mini-DAT TACHE-061 v1.1 section 6 ; TACHE-062 à livrer |
| ADR-001 R-BOOT-04 — tout handler publie un `diagnostics.<module>` homogène (`ready`, `last_boot_ts`, `boot_count`, `invariants_verified`) | ADR-001 section "Règles dérivées" |
| Log `console.info` JSON avec `duration_ms` en fin de séquence boot — surveillance du budget cold-start (< 50 ms cible MV3) | Mini-DAT TACHE-061 v1.1 section 8 |

#### Statut

**Partiellement implémenté** — M7 et **M2 (T-085)** disposent d'un heartbeat fonctionnel. L'instrumentation visible côté utilisateur (badge dégradé) n'est pas encore livrée (TACHE-062). **M3 / M5 / M6 / M9 / M17** ne publient pas encore de `diagnostics.<module>` (dépendances TACHE-086 à 091).

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| Badge popup "dégradé" (visuel utilisateur) si `diagnostics.m7.ready=false` depuis > 1h | TACHE-062 (priorité Should, à produire après TACHE-079 — R-M7-09) |
| `diagnostics.m2` | **Résolu — TACHE-085 mergée PR #19** |
| `diagnostics.m3` / m5 / m6 / m9 / m17 à implémenter | TACHE-086 à 091 |
| Page utilisateur consolidée "état de santé Sentinel Nudge" agrégeant les 7 diagnostics (vision d'ensemble RSSI / power user) | **TACHE-109** (Could, P5.1) — bloquée par TACHE-086 à 091 |
| Mesures automatisées du `boot_count > 50/h` non déclenchées — seuil documenté mais pas d'alerte active | À intégrer au badge TACHE-062 ou à une tâche dédiée v1.1 |

---

### 4.6 A.8.24 — Use of cryptography

**Intitulé officiel ISO** : *Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.*

#### Objectif du contrôle

Définir et mettre en œuvre des règles pour l'utilisation effective de la cryptographie, y compris la gestion des clés cryptographiques (génération, stockage, rotation, destruction). Les algorithmes, tailles de clés et modes doivent être explicites et alignés sur les standards en vigueur.

#### Réponse Sentinel Nudge

| Mesure | Référence / Justification |
|--------|---------------------------|
| **Algorithme de chiffrement** : AES-256-GCM (hashes M7) — NIST SP 800-38D, OWASP Cryptographic Storage Cheat Sheet | `src/background/crypto-service.ts` ; DAT P3 section crypto |
| **Algorithme de hachage** : SHA-256 avec sel d'installation (16 bytes / 128 bits, `installation_salt`) — pour `password_hash` et `domain_hash` | AIPD M7 v1.0 section 1.3 |
| **Source d'aléa** : `crypto.getRandomValues()` uniquement (API SubtleCrypto native) — conforme I-001 | Tous services crypto |
| **Taille de clé AES** : 256 bits (maximum recommandé pour AES-GCM) | `CryptoService.generateKey()` |
| **IV AES-GCM** : 12 bytes (96 bits) — taille recommandée NIST SP 800-38D pour GCM | `CanaryService.init()`, `CryptoService.encrypt()` |
| **INV-SEC-01** — non-réutilisation d'IV AES-GCM : tout IV est généré par `crypto.getRandomValues(new Uint8Array(12))` à chaque appel, espace de noms canary strictement disjoint de l'espace de noms métier | Mini-DAT TACHE-061 v1.1 section 6bis ; test TC-M7-SEC-25 |
| **R-CLI-06** — IV frais obligatoire à chaque émission d'un pending-intent contenant un ciphertext (extension INV-SEC-01) | ADR-002 section "Règles dérivées" |
| **Sérialisation JSON-safe** — `ArrayBuffer` et `Uint8Array` convertis en `Array<number>` avant stockage (INV-06 mini-DAT + INV-06 ADR-002 R-CLI-02) — leçon P-018 consolidée | `TECH_STACK.md`, test TC-M7-23 |
| **Rotation de clé** : régénération sur `canary_failed` avec pattern **CM-EOP1** (vérification secondaire avant régénération pour distinguer "clé perdue" vs "canary corrompu seul") | ADR-001 R-BOOT-05 ; Mini-DAT TACHE-061 v1.1 section 11.5 ; test TC-M7-SEC-29 |
| **Stockage de clé** : `chrome.storage.local` — risque R-003 accepté (profil Chrome compromis = clé compromise ; limite équivalente à toute autre extension) | RISQUES.md R-003 (Accepté) |
| **Canary hash** comme détecteur d'intégrité logicielle de la clé (absence, corruption P-018) — pas un mécanisme anti-tampering adversarial (CM-C1) | Mini-DAT TACHE-061 v1.1 section 11.1 |
| Aucun chiffrement "maison" — toutes opérations cryptographiques déléguées à `SubtleCrypto` native | I-001 conformité |
| Aucune bibliothèque crypto tierce dans les dépendances — SBOM vérifiable | `package.json`, SBOM CycloneDX CI |

#### Statut

**Implémenté** — choix algorithmiques alignés sur les standards (NIST SP 800-38D, OWASP), règles de gestion des IV figées par INV-SEC-01 et R-CLI-06, pattern de rotation sécurisée documenté (CM-EOP1) et testé (TC-M7-SEC-29).

#### Écarts résiduels et remédiation

| Écart | Statut |
|-------|--------|
| Clé en `chrome.storage.local` accessible à tout contexte de l'extension (et à DevTools) | R-003 **Accepté** — limite structurelle MV3, documentée dans la politique de confidentialité et l'AIPD. |
| Pas de rotation périodique planifiée de la clé AES | Intentionnel — rotation déclenchée uniquement sur incident (canary_failed) ; rotation périodique invaliderait l'historique `password_hashes` sans gain sécuritaire (clé locale non transmissible). |
| Pas d'HSM / module matériel de sécurité | Non applicable — extension navigateur client-side, aucune infrastructure serveur. |

---

### 4.7 A.8.28 — Secure coding

**Intitulé officiel ISO** : *Secure coding principles shall be applied to software development.*

#### Objectif du contrôle

Appliquer des principes de codage sécurisé dans le développement logiciel, à travers des règles opposables (linting, revue de code, patterns obligatoires) et une formation continue des développeurs. Le contrôle couvre la prévention des classes connues de défauts (OWASP Top 10, CWE Top 25).

#### Réponse Sentinel Nudge

| Mesure | Référence / CWE |
|--------|-----------------|
| **ADR-001 SW-BOOT-CONTRACT** — 5 règles dérivées (R-BOOT-01 à R-BOOT-05) opposables en revue de code sur tout nouveau handler SW | `docs/adr/adr-001-sw-boot-contract.md` |
| R-BOOT-01 — séquence lire → valider → régénérer/migrer → logger obligatoire | CWE-252 (Unchecked Return Value), CWE-755 (Improper Handling of Exceptional Conditions) |
| R-BOOT-02 — log `severity=error` AVANT écrasement d'une valeur critique | CWE-778 (Insufficient Logging) |
| R-BOOT-05 — CM-EOP1 avant toute régénération de valeur cryptographique (vérification secondaire) | CWE-321 (Use of Hard-coded Cryptographic Key avoidance), CWE-330 (Use of Insufficiently Random Values avoidance) |
| **ADR-002 CROSS-LIFECYCLE-INTENT** — 7 règles dérivées (R-CLI-01 à R-CLI-07) opposables pour tout pattern pending-intent | `docs/adr/adr-002-cross-lifecycle-intent.md` |
| R-CLI-02 — JSON-strict typé sur payload persisté (types interdits : ArrayBuffer, Uint8Array, Blob, Date, Map, Set, CryptoKey) | CWE-502 (Deserialization of Untrusted Data) |
| R-CLI-06 — IV AES-GCM frais à chaque ré-émission | CWE-323 (Reusing a Nonce, Key Pair in Encryption) |
| R-CLI-07 — minimisation du payload (pas de plaintext, token, URL) | CWE-532 (Insertion of Sensitive Information into Log File), CWE-312 (Cleartext Storage of Sensitive Information) |
| **INV-SEC-02** — typage strict `IncidentContext` par union discriminée (rejet à la compilation des champs libres susceptibles de contenir du plaintext) | CWE-532 ; type-safety as defense |
| **CM-ID3** — règle ESLint custom interdisant `err.message` / `String(err)` en argument `console.*` (TACHE-083) | `.eslintrc` `no-restricted-syntax` |
| **Factory `logger.ts` avec minimisation systématique** remplaçant les `console.*` bruts (TACHE-083 mergée PR #12) | `src/shared/logger.ts` |
| ESLint `no-restricted-properties` — interdiction de `innerHTML` sur entrées DOM non contrôlées (`textContent` uniquement) | `.eslintrc` ; R-004 résolu |
| TypeScript strict mode activé (`strict: true` dans `tsconfig.json`) | `tsconfig.json` |
| Revue de code systématique niveau Exposé (comité de revue code mobilisé pour chaque tâche P5) — PV de revue produits sur TACHE-061, TACHE-069/072 | `docs/gouvernance/gouvernance-pv-revue-code-*.md` |
| Checklist pré-commit : `format:check + lint + build + test` obligatoire (`feedback_precommit_checks`) | `.claude/OUTILS.md` |
| Hook I-009 — vérification CI obligatoire après push (local vert ≠ CI verte) | `.git/hooks/post-push` + documentation |
| Conventional Commits sur tout commit (`feat:`, `fix:`, `security:`, etc.) | `.claude/INSTRUCTIONS.md` |
| Pas de secret dans le code versionné — `.env` gitignoré, `.env.example` commité, vérification Assistant Git pré-commit | `.gitignore`, `.env.example`, feedback_git_precommit |

#### Statut

**Implémenté** — les règles de codage sécurisé sont documentées (ADR opposables), outillées (ESLint + TypeScript strict), vérifiées (revue de code systématique en Exposé) et automatisées (CI pré-merge avec format, lint, build, test).

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| Règle ESLint TACHE-083 ne capture pas encore le pattern `const message = err.message` via variable intermédiaire — renforcement AST avec sélecteur `VariableDeclarator > MemberExpression[property.name='message']` | TACHE-104 |
| SAST automatisé (CodeQL natif GitHub) non activé en CI | **TACHE-108** (Could, P5) — CodeQL gratuit sur repos publics, donc bloqué tant que TACHE-112 (repo privé → public) non livrée. |
| Pas de liste explicite OWASP Top 10 / CWE Top 25 confrontée au code par scan automatique | Partiellement couvert par ESLint + TypeScript strict + revue humaine ; SAST formel couvert par TACHE-108. |

---

### 4.8 A.5.24 / A.5.26 — Information security incident management / response

**Intitulés officiels ISO** :

- **A.5.24** — *The organization shall plan and prepare for managing information security incidents by defining, establishing and communicating information security incident management processes, roles and responsibilities.*
- **A.5.26** — *Information security incidents shall be responded to in accordance with the documented procedures.*

#### Objectif des contrôles

Planifier, préparer et exécuter la réponse aux incidents de sécurité avec des processus documentés, des rôles clairs et des procédures écrites. Le cycle attendu est : préparation → détection → analyse → containment → eradication → récupération → leçons apprises.

#### Réponse Sentinel Nudge

**Mesure centrale v1.1** : le runbook **`docs/securite/runbook-reponse-incident.md` v1.0** (TACHE-110, PR #18) matérialise les deux contrôles. Il documente le processus (A.5.24) **et** les procédures de réponse à suivre (A.5.26) de bout en bout.

##### Mapping Steps du runbook ↔ contrôle ISO

| Step runbook | Exigence ISO couverte |
|--------------|-----------------------|
| §2 Rôles (Incident Manager / Technical Lead / Communications / Observer / DPO / Reporter) + §2.1 Principe de séparation mentale | **A.5.24** "roles and responsibilities" |
| §3 Classification de sévérité P0-P3 (grille CVSS-like) + §3.2 Règle de montée automatique (M7 → P0, DPO saisi systématiquement, supply chain release → P0) + §3.3 Règle de descente (reproduction et analyse obligatoire, pas de descente par défaut) | **A.5.24** "incident management processes" |
| §4 Timeline de réponse par sévérité (SLA imposés) | **A.5.26** "responded to in accordance with the documented procedures" |
| Step 1 — Accuser réception (SLA 1-5 jours ouvrés selon P) | **A.5.26** réponse immédiate |
| Step 2 — Triage sévérité confirmé | A.5.24 process documenté |
| Step 3 — Reproduire et confirmer + écriture d'un test de régression rouge avant correctif | A.5.26 analyse |
| Steps 4-6 — Branche privée + développement correctif + tests de régression complets | A.5.26 containment + eradication |
| Steps 7-9 — CVE + release notes + coordination avec le reporter + publication disclosure coordonnée | A.5.26 récupération + communication |
| Step 10 — Post-mortem écrit avec grille imposée (§8 : contexte, root cause, défenses ayant fonctionné/manqué, actions correctives, capitalisation) | **A.5.24** "leçons apprises" + boucle d'amélioration continue |
| §6 Templates de communication (§6.1 accusé de réception, §6.2 demande d'info, §6.3 release notes security fix, §6.4 description CVE, §6.5 notification utilisateurs) | A.5.26 communication externe standardisée |
| §9 Cadence annuelle de tabletop (premier prévu juillet 2026 via TACHE-113) | **A.5.24** maintien du dispositif + exercice + amélioration continue |

##### Mesures complémentaires

| Mesure | Référence |
|--------|-----------|
| `SECURITY.md` v1.0 racine (TACHE-107, PR #17) — canal privé GitHub Security Advisories, SLA 30 jours, safe harbor, périmètre, 7 types de vulnérabilités recherchés | `SECURITY.md` |
| Templates GitHub issue (TACHE-111, PR #17) — `.github/ISSUE_TEMPLATE/config.yml` redirige tout rapport sécurité vers le canal privé ; `security-bug.md` pour sévérités faibles avec avertissement de redirection | `.github/ISSUE_TEMPLATE/` |
| Structure d'incident `M7IncidentRecord` avec sévérité `info / warn / error` — outille la détection interne et le suivi opérationnel | `src/shared/types/diagnostics.ts` |
| Types d'incidents v1 (M7 : boot_fail, canary_failed, submit_detect_fail, toast_orphan, storage_write_fail, idb_write_fail, key_regenerated ; **M2 depuis T-085 : whitelist_corrupted, whitelist_regenerated**) | `src/shared/types/diagnostics.ts` + `src/background/handlers/m2-handler.ts` |
| Sévérité `error` pour incidents critiques (clé perdue, canary échec, exception submit, échec IDB, whitelist corrompue), `warn` pour dégradations, `info` pour événements opérationnels | `src/background/services/incident-service.ts` |
| Post-mortem M7 formalisé (2026-04-14) — 4 profils techniques, 15 UC revus, PDCA avec 7 règles permanentes, score maturité 2.0 → 3.4/5 — sert de **précédent éprouvé** pour le runbook v1.0 | `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md` |
| Atelier PDCA consolidé en `LESSONS_LEARNED.md` | `.claude/LESSONS_LEARNED.md` |
| Cycle PDCA standardisé pour les problèmes techniques : Plan (PROBLEMES.md), Do (application), Check (vérification), Act (capitalisation) | `.claude/INSTRUCTIONS.md` section "Cycle PDCA" |
| Registre des risques RISQUES.md — enrichi à chaque incident, suivi statut Ouvert / Mitigé / Accepté / Résolu | `.claude/RISQUES.md` |

#### Statut

**Implémenté — maturité *Géré*** (promotion depuis *Défini* en v1.1 post-TACHE-110). Le projet dispose désormais :

- d'une structure de détection (registre + types + sévérité) ;
- d'un canal de signalement externe formalisé (`SECURITY.md` + templates issue) ;
- d'une **procédure opérationnelle complète** (runbook avec classification, timeline, 10 Steps, 5 templates, grille de post-mortem) ;
- d'un **précédent éprouvé** (post-mortem M7 du 2026-04-14, dont les leçons ont été intégrées au runbook en tant que scénario de référence) ;
- d'une cadence de **validation périodique** (tabletop annuel planifié via TACHE-113).

Le niveau *Optimisé* sera atteint après le premier tabletop réel (TACHE-113, juillet 2026) qui permettra de mesurer l'opérabilité du runbook dans un scénario simulé de bout en bout et d'intégrer les écarts constatés en amélioration continue.

#### Écarts résiduels et remédiation

| Écart | Tâche / Risque |
|-------|----------------|
| Runbook formel à produire | **Résolu — TACHE-110 mergée PR #18** (`docs/securite/runbook-reponse-incident.md` v1.0) |
| `SECURITY.md` racine avec procédure de divulgation responsable | **Résolu (dormant) — TACHE-107 mergée PR #17** (statut *dormant* tant que repo privé, cf. A.8.8 et TACHE-112) |
| Template GitHub issue "bug sécurité" dédié | **Résolu — TACHE-111 mergée PR #17** (`.github/ISSUE_TEMPLATE/config.yml` + `security-bug.md`) |
| Tabletop réel non encore joué (le post-mortem M7 fait office de répétition générale non simulée, mais n'est pas un scénario de divulgation tiers) | **TACHE-113** (Should, P7) — premier tabletop XSS UC-06, cadence annuelle, juillet 2026 |
| Confirmation DPO du circuit de saisine systématique pour tout incident M7 (runbook Step 2) et de la validation DPO obligatoire avant notification utilisateurs (Step 7 + template §6.5) | **TACHE-115** (Should, P5) — compatibilité registre des traitements + AIPD M7 v1.0 à documenter dans `docs/rgpd/` |
| Pas de page utilisateur "que faire si M7 ne détecte plus rien ?" (diagnostic auto + procédure de reset) | Partiellement couvert par la page `m7-explication.html` ; pourrait être enrichi après livraison badge dégradé TACHE-062 et page d'état TACHE-109. |
| Classification officielle des incidents (P0/P1/P2) en phase recette distincte de la sévérité A.5.24/26 du runbook | TACHE-063 (protocole recette) adresse le besoin adjacent pour les tests, sans chevauchement avec le runbook. |

---

## 5. Écarts résiduels et roadmap consolidée

Cette section récapitule l'ensemble des tâches de remédiation identifiées dans les fiches détaillées, triées par priorité et rattachées au contrôle ISO qu'elles impactent.

### 5.1 Tâches livrées depuis v1.0 (PR identifiées)

| Tâche | PR | Contrôle ISO impacté | Résultat |
|-------|----|----------------------|----------|
| TACHE-083 | PR #12 | A.8.12 / A.8.28 | Factory `logger.ts` — minimisation console SW ; R-M7-08 partiellement mitigé |
| TACHE-085 | PR #19 | A.8.15 / A.8.16 | M2 `initBoot()` + `diagnostics.m2` + incidents `whitelist_corrupted` / `whitelist_regenerated` ; R-ADR-01 mitigé |
| TACHE-107 | PR #17 | A.8.8 / A.5.24 / A.5.26 | `SECURITY.md` v1.0 racine (canal privé GH Advisories, SLA 30 j, safe harbor) — **dormant** tant que repo privé (T-112) |
| TACHE-110 | PR #18 | A.5.24 / A.5.26 / A.8.8 | Runbook `docs/securite/runbook-reponse-incident.md` v1.0 — promeut A.5.24/26 en maturité *Géré* |
| TACHE-111 | PR #17 | A.5.24 / A.5.26 | Templates GitHub issue (config.yml + security-bug.md) — aiguillent tout rapport sécurité vers le canal privé |

### 5.2 Tâches existantes au BACKLOG (référence directe)

| Tâche | Priorité | Contrôle ISO impacté | Description courte |
|-------|----------|----------------------|---------------------|
| TACHE-062 | Should | A.8.16 Monitoring | Badge popup dégradé `diagnostics.m7.ready=false > 1h` |
| TACHE-074 | Should | A.8.12 Data leakage | Transmission DPO mini-DAT TACHE-061 pour compatibilité AIPD M7 |
| TACHE-078 | Should | A.8.15 Logging | Instrumenter `storage_write_fail` sur sites critiques |
| TACHE-079 | Should | A.8.15 Logging | Correctif R-M7-09 incidents fantômes premier install (mergée PR #10) |
| TACHE-084 | Should | A.8.12 Data leakage | Inventaire exhaustif champs console loggés transmis DPO |
| TACHE-086 | Should | A.8.15 / A.8.16 | M3 — `diagnostics.m3` minimal |
| TACHE-087 | Should | A.8.15 / A.8.16 | M5 — `initBoot()` + `diagnostics.m5` + `pending_m5_update_reminder` |
| TACHE-088 | Should | A.8.15 / A.8.16 | M6 — `initBoot()` + `diagnostics.m6` + `pending_m6_quiz` |
| TACHE-089 | Could | A.8.15 / A.8.16 | M9 + M17 — `diagnostics.m9` + `diagnostics.m17` minimaux |
| TACHE-090 | Could | A.8.28 / A.8.24 | M17 — `pending_m17_toast` conforme R-CLI-01/07 |
| TACHE-091 | Should | A.8.28 Secure coding | M7 — mise en conformité R-CLI-03 (migrer `timestamp` → `expires_at`, caduque E-CLI-01) |
| TACHE-093 | Should | A.8.10 (hors 8 initiaux) | Purge `pending_*` expirés dans `onPurgeDaily` |
| TACHE-104 | Should | A.8.12 / A.8.28 | Migration factory logger 12 sites résiduels SW |
| TACHE-105 | Could | A.8.12 | Migration factory logger 26 sites CS/UI |
| TACHE-108 | Could | A.8.28 Secure coding | Activer SAST CodeQL en CI — bloqué par TACHE-112 (gratuité conditionnée aux repos publics) |
| TACHE-109 | Could | A.8.16 Monitoring | Page utilisateur "état de santé Sentinel Nudge" v1.1 — bloquée par TACHE-086 à 091 |
| **TACHE-112** | **Must** | A.8.8 (activation dormance) + A.8.28 (T-108) | Checklist pré-publication repo public + bascule `private → public` — débloque le canal GH Advisories (A.8.8, A.5.24/26) **et** CodeQL gratuit (A.8.28 via T-108) |
| TACHE-113 | Should | A.5.24 / A.5.26 | Premier tabletop exercise (XSS UC-06) — cadence annuelle, juillet 2026 |
| TACHE-115 | Should | A.5.24 / A.5.26 (RGPD) | DPO — confirmer compatibilité circuit saisine runbook avec registre des traitements + AIPD M7 |

### 5.3 Priorisation suggérée par l'Architecte sécurité

Pour une release v1 solide puis une bascule open source, les remédiations à traiter dans l'ordre sont :

1. **TACHE-086 à 088** (M3 / M5 / M6 `diagnostics` + `initBoot`) — poursuit le chantier A engagé par T-085 ; R-ADR-01/02 résiduels à fermer.
2. **TACHE-104** (règle ESLint renforcée) — empêche de nouvelles régressions R-M7-08 avant que TACHE-105 soit complétée.
3. **TACHE-091** — levée de E-CLI-01 et mise en conformité complète ADR-002.
4. **TACHE-062** (badge dégradé) — valorise l'investissement heartbeat fait en T-061 et T-085 (rend visible à l'utilisateur la dégradation d'un `diagnostics.*`).
5. **TACHE-112** (bascule repo public) — **débloque 3 bénéfices sécurité à forte valeur** : activation A.8.8 canal GH Advisories (sort de *dormant*), activation T-108 CodeQL gratuit (A.8.28), crédit des reporters open source. À coordonner avec une revue finale historique (`truffleHog`) et un audit README.
6. **TACHE-113** (premier tabletop) — valide l'opérabilité du runbook en conditions simulées et fait progresser A.5.24/26 vers *Optimisé*.
7. **TACHE-115** (confirmation DPO) — boucle la cohérence RGPD du circuit d'incident.

---

## 6. Historique

| Version | Date | Auteur | Modifications | Sources |
|---------|------|--------|---------------|---------|
| 1.0 | 2026-04-17 | Architecte sécurité (Fabrique) | Initialisation — 8 contrôles ISO 27001:2022 Annexe A tracés (A.5.7, A.8.8, A.8.12, A.8.15, A.8.16, A.8.24, A.8.28, A.5.24/A.5.26) depuis mini-DAT TACHE-061 v1.1 section 12. Proposition de 5 tâches complémentaires (TACHE-107 à 111). | Mini-DAT TACHE-061 v1.1 (section 12), ADR-001, ADR-002, AIPD M7 v1.0, RISQUES.md, BACKLOG.md, SESSION.md |
| **1.1** | **2026-04-17** | **Architecte sécurité (Fabrique)** | **MAJ post-sprint sécurité (T-083/085/107/110/111 mergées).** §1.4 : ajout statut *Dormant* + échelle de maturité SAMM-like. §2.1 : M2 passe à "Implémentée" (T-085). §2.3 : tableau synthétique par domaine reformaté avec niveaux de maturité et justifications ; A.5.24/26 promu *Défini* → *Géré*. §3 : A.5.24/26 passe de *Partiellement implémenté* à *Implémenté (maturité Géré)* ; A.8.8 mentionne dormance et TACHE-112 ; A.8.15/16 mentionnent M2 livré. §4.1 : M2 retiré des écarts STRIDE ciblés. §4.2 A.8.8 : intégration `SECURITY.md` + templates + dormance + TACHE-112. §4.3 A.8.12 : intégration factory `logger.ts` T-083. §4.4 A.8.15 : ajout incidents M2 T-085 + dette sémantique store `m7_incidents`. §4.5 A.8.16 : ajout `diagnostics.m2` + TACHE-109. §4.7 A.8.28 : renvoi SAST vers TACHE-108 (dépendance T-112). §4.8 A.5.24/26 : **refonte — intégration runbook TACHE-110 comme mesure centrale**, mapping Steps du runbook ↔ contrôle ISO, promotion maturité *Géré*, ajout TACHE-113 (tabletop) + TACHE-115 (DPO). §5 : nouvelle sous-section 5.1 "Tâches livrées depuis v1.0", retrait des tâches livrées de la roadmap 5.2, ajout T-112/113/115, repriorisation en 7 points. §7 : ajout références `SECURITY.md`, runbook, templates issue. | TACHE-114 ; PR #12 (T-083), #17 (T-107/111), #18 (T-110), #19 (T-085) ; BACKLOG.md T-112 à T-115 |

---

## 7. Références

| Document | Chemin |
|----------|--------|
| Mini-DAT TACHE-061 v1.1 | `docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md` |
| ADR-001 SW-BOOT-CONTRACT | `docs/adr/adr-001-sw-boot-contract.md` |
| ADR-002 CROSS-LIFECYCLE-INTENT | `docs/adr/adr-002-cross-lifecycle-intent.md` |
| Audit modules v1.0 | `docs/p4-conception/p5-audit-modules-adr-compliance-v1.0.md` |
| Politique sécurité racine | `SECURITY.md` |
| Runbook réponse à incident v1.0 | `docs/securite/runbook-reponse-incident.md` |
| Templates issue GitHub | `.github/ISSUE_TEMPLATE/` |
| AIPD M7 v1.0 | `docs/p3-architecture/p3-aipd-m7-v1.0.md` |
| DAT P3 v1.3 | `docs/p3-architecture/p3-dat-v1.3.md` |
| PV post-mortem M7 v1.0 | `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md` |
| Registre des risques | `.claude/RISQUES.md` |
| Backlog | `.claude/BACKLOG.md` |
| Leçons apprises | `.claude/LESSONS_LEARNED.md` |
| Tech stack | `.claude/TECH_STACK.md` |
| ISO/CEI 27001:2022 | Annexe A — contrôles référencés dans ce document |
| NIST SP 800-38D | Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) |
| OWASP ASVS 4.0 | Application Security Verification Standard |
| OWASP Cryptographic Storage Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html |
| CWE Top 25 (2023) | https://cwe.mitre.org/top25/ |
