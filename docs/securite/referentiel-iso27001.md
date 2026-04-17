# Référentiel de sécurité — ISO/CEI 27001:2022 (Annexe A)

**Projet** : Sentinel Nudge
**Version** : 1.0
**Date** : 2026-04-17
**Auteur** : Architecte sécurité (Fabrique)
**Statut** : Initialisation — document vivant, enrichi à chaque phase
**Niveau de sensibilité** : Exposé
**Origine** : TACHE-075 — Mini-DAT TACHE-061 v1.1 section 12

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
| **Non applicable** | Le contrôle ne s'applique pas au périmètre projet (ex. contrôles physiques pour un logiciel client-side). |

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
| M2 | Nudge domaines suspects (typosquatting + HSTS) | Partielle — TACHE-085 (initBoot + diagnostics.m2) à livrer |
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
| **P5 (en cours)** | ADR-001, ADR-002, mini-DAT TACHE-061 v1.1, audit modules v1.0, **ce référentiel** |

### 2.3 Niveau de maturité actuel

Auto-évaluation qualitative au 2026-04-17, sur la base des livrables produits :

- **Conception sécurisée (A.5.7, A.8.25, A.8.28)** — niveau *Reproductible* : STRIDE global DAT + STRIDE ciblés par feature (mini-DAT TACHE-061), ADR-001/002 opposables, revue code exposée.
- **Logging / monitoring (A.8.15, A.8.16)** — niveau *Défini* pour M7 (heartbeat, canary, registre), *Partiel* pour M2/M3/M5/M6/M9/M17 (couvert par TACHE-085 à 091, R-ADR-05).
- **Cryptographie (A.8.24)** — niveau *Défini* : AES-256-GCM, SHA-256, IV uniques INV-SEC-01, sérialisation Array&lt;number&gt; INV-06 figée.
- **Gestion de vulnérabilités (A.8.8)** — niveau *Géré* : post-mortem M7 formalisé (7 commits correctifs P-014 à P-020 tracés), PDCA avec 7 règles permanentes, R-M7-04/05/06/07 suivis.
- **Prévention fuite de données (A.8.12)** — niveau *Défini* : INV-SEC-02 (typage `IncidentContext` + lint factory console), Privacy by Design (aucune télémétrie, tout local).
- **Gestion d'incidents (A.5.24/A.5.26)** — niveau *Défini* : structure `M7IncidentRecord` + sévérité info/warn/error, post-mortem M7 capitalisé en LESSONS_LEARNED.

---

## 3. Tableau synthétique des 8 contrôles initiaux

| # | Contrôle | Nom ISO | Statut | Origine mesure | Écarts résiduels |
|---|----------|---------|--------|----------------|------------------|
| 1 | **A.5.7** | Threat intelligence | Implémenté | STRIDE DAT + STRIDE ciblés TACHE-061 | Extension aux autres modules en lot v2 |
| 2 | **A.8.8** | Management of technical vulnerabilities | Implémenté | Post-mortem M7 + SBOM CycloneDX (I-002) + Dependabot | Formalisation process de divulgation (`SECURITY.md`) à produire |
| 3 | **A.8.12** | Data leakage prevention | Implémenté | INV-SEC-02 + typage `IncidentContext` + factory logger + Privacy by Design | Migration factory logger non terminée (TACHE-104, TACHE-105) |
| 4 | **A.8.15** | Logging | Partiellement implémenté | Registre M7 + INV-SEC-03/04 | Incidents M2/M3/M5/M6/M9/M17 à généraliser (TACHE-085 à 091, R-ADR-05) |
| 5 | **A.8.16** | Monitoring activities | Partiellement implémenté | Heartbeat `diagnostics.m7` | Badge dégradé TACHE-062 + diagnostics autres modules à livrer |
| 6 | **A.8.24** | Use of cryptography | Implémenté | AES-256-GCM + SHA-256 + sel installation + INV-SEC-01 (IV frais) + R-CLI-06 | Clé en chrome.storage.local (R-003 accepté) |
| 7 | **A.8.28** | Secure coding | Implémenté | ADR-001 (R-BOOT-01 à 05) + ADR-002 (R-CLI-01 à 07) + INV-SEC-02 + règle ESLint logger | Extension règle ESLint (TACHE-104) |
| 8 | **A.5.24 / A.5.26** | Information security incident management / response | Partiellement implémenté | `M7IncidentRecord` + post-mortem M7 PDCA + RISQUES.md suivi | Process de réponse utilisateur (GitHub issue template sécurité) à produire |

**Note** : les 8 contrôles listés constituent l'initialisation v1.0 (contrôles référencés par le mini-DAT TACHE-061 section 12). D'autres contrôles déjà couverts par les livrables (A.5.10, A.8.10, A.8.25) sont mentionnés dans les ADR mais seront formellement tracés dans les prochaines versions de ce document (v1.1 +).

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
| Consolidation des menaces dans le registre projet RISQUES.md (27 risques dont R-M7-03 à R-M7-09, R-ADR-01 à R-ADR-07, R-UC02-01, R-UC03-07, R-UC05-01) | `.claude/RISQUES.md` |
| Veille vulnérabilités dépendances npm — Dependabot actif sur le dépôt GitHub | Configuration repository `antonyblain/sentinel-nudge` |
| Capitalisation des menaces observées en production (saga M7 — P-014 à P-020) en règles permanentes LESSONS_LEARNED | `.claude/LESSONS_LEARNED.md` (atelier PDCA post-mortem M7) |

#### Statut

**Implémenté** pour le périmètre M7 et pour les composants couverts par les ADR-001/002. Le STRIDE global DAT couvre l'architecture. Les STRIDE ciblés par feature sont désormais une pratique standardisée (toute feature de niveau Exposé passe par un STRIDE ciblé via le mini-DAT ou le PV comité sécurité).

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| STRIDE ciblés non encore produits pour M2/M3/M5/M6/M9/M17 | Absorbé par TACHE-085 à 091 (chaque `initBoot()` inclut une catégorisation des menaces et des `M7IncidentType` équivalents — cf. R-ADR-05). |
| Extension du registre d'incidents à toutes les fonctions sensibles non M7 | R-ADR-05 ouvert, couvert par TACHE-085 à 091 dans leur portée sécurité. |

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
| Registre d'incidents IndexedDB `m7_incidents` avec purge FIFO sévérité-priorisée (500 entrées max, INV-SEC-04) | `src/background/services/incident-service.ts`, `src/shared/types/diagnostics.ts` |
| SBOM CycloneDX généré en CI (Instruction Commanditaire I-002) — visibilité sur les versions exactes des dépendances | `.github/workflows/ci.yml` (job SBOM), artefact publié par release |
| Dependabot actif sur le dépôt GitHub — alertes et PR automatiques sur vulnérabilités des dépendances npm | GitHub security settings, `dependabot.yml` |
| Registre de risques RISQUES.md enrichi à chaque incident/post-mortem (R-M7-03 à R-M7-09 ajoutés 2026-04-16, R-ADR-01 à R-ADR-07 ajoutés 2026-04-17) | `.claude/RISQUES.md` |

#### Statut

**Implémenté** — le projet dispose d'un cycle complet veille → évaluation → action sur les vulnérabilités logicielles internes (via post-mortem + ADR + registre) et sur les vulnérabilités des dépendances (SBOM + Dependabot).

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| Absence d'un fichier `SECURITY.md` racine décrivant le process de divulgation responsable des vulnérabilités découvertes par tiers | Nouvelle tâche à créer au BACKLOG (**TACHE-107 proposée**) — production d'un `SECURITY.md` (coordonnées de contact, GPG, SLA de réponse, politique de reconnaissance). Note pour l'Orchestrateur. |
| Migration factory logger non terminée (12 sites résiduels SW + 26 sites CS/UI) — champ `err.message` potentiellement exposé en console | TACHE-104, TACHE-105 (déjà au BACKLOG). |
| Remédiation R-M7-09 (incidents fantômes au premier install) non encore livrée | TACHE-079 (déjà au BACKLOG). |

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
| **CM-ID3** — règle ESLint interdisant `err.message` / `String(err)` en argument `console.*` (TACHE-083) | `.eslintrc` — règle custom no-restricted-syntax ; `src/shared/logger.ts` (factory) |
| Test unitaire TC-M7-SEC-26 — injection de `context={ password: '...' }` rejetée par validation runtime | `tests/unit/incident-service.test.ts` |
| **R-CLI-07** — minimisation du payload d'un pending-intent (hashes, enums, IDs abstraits ; interdit : plaintext, tokens, URLs avec query string, cookies) | ADR-002 section "Règles dérivées" |
| Pas d'`innerHTML` sur entrées DOM non contrôlées — `textContent` uniquement, ESLint no-restricted-properties | RISQUES.md R-004 (résolu) ; ESLint config |
| CSP stricte `script-src 'self'` | `src/manifest.json`, DAT P3 section CSP |
| Export RGPD Art. 20 — données exportables uniquement sur action explicite utilisateur, fichier local jamais transmis | `src/pages/options/options.ts` `handleExport()` ; TACHE-013 mergée |
| Revue DPO AIPD M7 systématique en cas de nouveau champ loggé (TACHE-074 ouverte sur l'inventaire console post-TACHE-061, TACHE-084 pour complément) | BACKLOG TACHE-074, TACHE-084 |

#### Statut

**Implémenté** sur le périmètre IDB (`incidentService.log()` typé) et sur le périmètre réseau (aucune sortie). Le périmètre console SW est en cours de remédiation via TACHE-083 (factory logger livrée) + TACHE-104/105 (migration résiduelle).

#### Écarts résiduels et remédiation

| Écart | Tâche / Risque |
|-------|----------------|
| 12 sites résiduels `console.*` dans handlers SW avec pattern `const message = err.message` non capturé par la règle ESLint actuelle | TACHE-104 |
| 26 sites `console.*` dans content scripts + pages UI non migrés vers la factory | TACHE-105 |
| R-M7-08 (fuite console SW) partiellement mitigé — statut *Ouvert* | R-M7-08, inventaire DPO à finaliser par TACHE-084 |
| Absence de revue périodique des exports utilisateur (Art. 20) pour détecter une régression introduisant un champ sensible | À intégrer à la checklist comité de recette (P7) |

---

### 4.4 A.8.15 — Logging

**Intitulé officiel ISO** : *Logs that record activities, exceptions, faults and other relevant events shall be produced, stored, protected and analysed.*

#### Objectif du contrôle

Produire, stocker, protéger et analyser des journaux d'événements de sécurité permettant la détection des incidents, la réponse à incident et la forensique post-événement. Les logs doivent être horodatés, structurés, protégés contre l'altération et la suppression.

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| Registre d'incidents IndexedDB `m7_incidents` — store dédié, clé `id` auto-incrément, index `ts` et `type` | Mini-DAT TACHE-061 v1.1 section 4 ; `src/background/services/incident-service.ts` |
| Schéma d'incident structuré `M7IncidentRecord` typé (`id`, `ts`, `type`, `severity` info/warn/error, `context` typé `IncidentContext`) | `src/shared/types/diagnostics.ts` |
| 6 types d'incidents v1 : `boot_fail`, `canary_failed`, `submit_detect_fail`, `toast_orphan`, `storage_write_fail`, `idb_write_fail` + `key_regenerated` (INV-SEC-05) | `src/shared/types/diagnostics.ts` |
| **INV-SEC-03** — log `severity=error` AVANT écrasement d'une valeur cryptographique (traçabilité forensique non négociable) | Mini-DAT TACHE-061 v1.1 section 6bis ; ADR-001 R-BOOT-02 |
| **INV-SEC-04** — purge FIFO sévérité-priorisée : `info → warn → error` (mitigation saturation forensique R-M7-07) | Mini-DAT TACHE-061 v1.1 section 6bis ; test TC-M7-SEC-28 |
| **CM-DOS2** — rate-limit applicatif `repeat_count` < 1s sur couple `(type, severity)` avec même `context` structurel | Mini-DAT TACHE-061 v1.1 section 11.4 ; `IncidentService.log()` |
| **CM-DOS3** — pas de coalescing pour `severity='error'` (timestamp précis préservé) | `IncidentService.log()` |
| Buffer mémoire borné 10 entrées pré-`initDB()` + flush au premier tick après init — ne pas perdre les incidents critiques de boot (ARB-061-02 Option B) | `src/background/services/incident-service.ts` |
| Borne maximale `MAX_INCIDENTS = 500` entrées — rétention forensique de plusieurs jours en fonctionnement nominal (ARB-061-03 Option A) | `src/background/services/incident-service.ts` |
| `diagnostics.m7` publié dans `chrome.storage.local` avec `ready`, `last_boot_ts`, `boot_count`, `canary_verified`, `last_detection_ts` | `src/background/services/heartbeat-service.ts` |
| ADR-002 — journalisation des défaillances pipeline cross-lifecycle (`toast_orphan`, `pending_purge_failed`) | ADR-002 Règle R-CLI-04 |

#### Statut

**Partiellement implémenté** — le module M7 dispose d'un logging complet (registre + heartbeat + 6 types d'incidents). Les modules M2/M3/M5/M6/M9/M17 n'émettent pas encore d'incidents structurés pour leurs défaillances critiques (cf. R-ADR-05).

#### Écarts résiduels et remédiation

| Écart | Tâche / Risque |
|-------|----------------|
| M2 : pas d'incident `whitelist_corrupted` / `whitelist_regenerated` | TACHE-085, R-ADR-01 |
| M3 : pas d'incident `events_store_corrupted` | TACHE-086 |
| M5 : pas d'incident `m5_snooze_corrupted` / `update_check_failed` | TACHE-087, R-ADR-02 |
| M6 : pas d'incident `m6_install_date_corrupted` / `quiz_deferred_stale` | TACHE-088, R-ADR-02 |
| M9 : pas d'incident `m9_handler_error` | TACHE-089 |
| M17 : pas d'incident `m17_handler_error` | TACHE-089, TACHE-090 |
| `storage_write_fail` non instrumenté sur les sites critiques (clé régénérée, pending_m7_toast, heartbeat.write()) | TACHE-078 |
| Incidents fantômes premier install polluent la forensique | TACHE-079, R-M7-09 |
| Logs console SW partiellement minimisés (migration factory en cours) | TACHE-083 livrée, TACHE-104/105 résiduels |

---

### 4.5 A.8.16 — Monitoring activities

**Intitulé officiel ISO** : *Networks, systems and applications shall be monitored for anomalous behaviour and appropriate actions taken to evaluate potential information security incidents.*

#### Objectif du contrôle

Surveiller en continu les systèmes, détecter les comportements anormaux et déclencher une action (alerte, analyse, mitigation) sur les écarts. Le contrôle implique une instrumentation visible et un mécanisme d'évaluation périodique.

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| Heartbeat `diagnostics.m7` — état de santé M7 persisté dans `chrome.storage.local` et mis à jour à chaque boot SW, canary, détection | Mini-DAT TACHE-061 v1.1 section 3.1 ; `src/background/services/heartbeat-service.ts` |
| Champ `ready: boolean` — matérialise l'état fonctionnel de M7 à tout instant | `src/shared/types/diagnostics.ts` `M7Diagnostics.ready` |
| Champ `boot_count: number` monotone croissant — détection de boucles de redémarrage anormales (`> 50 / heure` = anomalie documentée) | `src/shared/types/diagnostics.ts` `M7Diagnostics.boot_count` |
| Champ `last_detection_ts` — surveillance de la cadence de détection (si 0 pendant plusieurs semaines alors que des sites sensibles sont visités, signal faible de dégradation) | `src/shared/types/diagnostics.ts` |
| Invariant INV-01 — `ready === true` implique `canary_verified === true` (aucun faux positif de santé) | Mini-DAT TACHE-061 v1.1 section 6 |
| Invariant INV-05 — si `ready=false` depuis > 3 600 000 ms alors badge dégradé (consommé par TACHE-062) | Mini-DAT TACHE-061 v1.1 section 6 ; TACHE-062 à livrer |
| ADR-001 R-BOOT-04 — tout handler publie un `diagnostics.<module>` homogène (`ready`, `last_boot_ts`, `boot_count`, `invariants_verified`) | ADR-001 section "Règles dérivées" |
| Log `console.info` JSON avec `duration_ms` en fin de séquence boot — surveillance du budget cold-start (< 50 ms cible MV3) | Mini-DAT TACHE-061 v1.1 section 8 |

#### Statut

**Partiellement implémenté** — M7 dispose d'un heartbeat fonctionnel. L'instrumentation visible côté utilisateur (badge dégradé) n'est pas encore livrée (TACHE-062). Les autres modules ne publient pas encore de `diagnostics.<module>` (dépendances TACHE-085 à 091).

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| Badge popup "dégradé" (visuel utilisateur) si `diagnostics.m7.ready=false` depuis > 1h | TACHE-062 (priorité Should, à produire après TACHE-079 — R-M7-09) |
| `diagnostics.m2` / m3 / m5 / m6 / m9 / m17 à implémenter | TACHE-085 à 091 |
| Pas de page utilisateur consolidée "état de santé Sentinel Nudge" agrégeant les 7 diagnostics (vision d'ensemble du RSSI / power user) | À considérer pour v1.1 (non BACKLOG actuellement — proposition à l'Orchestrateur) |
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
| Factory `logger.ts` avec minimisation systématique remplaçant les `console.*` bruts (TACHE-083 mergée) | `src/shared/logger.ts` |
| ESLint `no-restricted-properties` — interdiction de `innerHTML` sur entrées DOM non contrôlées (`textContent` uniquement) | `.eslintrc` ; R-004 résolu |
| TypeScript strict mode activé (`strict: true` dans `tsconfig.json`) | `tsconfig.json` |
| Revue de code systématique niveau Exposé (comité de revue code mobilisé pour chaque tâche P5) — 2 PV de revue produits sur TACHE-061 et TACHE-069/072 | `docs/gouvernance/gouvernance-pv-revue-code-*.md` |
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
| SAST automatisé (CodeQL, Semgrep) non activé en CI | Non tracé au BACKLOG — à considérer pour v1.1 (proposition à l'Orchestrateur via TACHE-108 éventuelle). |
| Pas de liste explicite OWASP Top 10 / CWE Top 25 confrontée au code par scan automatique | Partiellement couvert par ESLint + TypeScript strict + revue humaine ; SAST formel à planifier v1.1. |

---

### 4.8 A.5.24 / A.5.26 — Information security incident management / response

**Intitulés officiels ISO** :

- **A.5.24** — *The organization shall plan and prepare for managing information security incidents by defining, establishing and communicating information security incident management processes, roles and responsibilities.*
- **A.5.26** — *Information security incidents shall be responded to in accordance with the documented procedures.*

#### Objectif des contrôles

Planifier, préparer et exécuter la réponse aux incidents de sécurité avec des processus documentés, des rôles clairs et des procédures écrites. Le cycle attendu est : préparation → détection → analyse → containment → eradication → récupération → leçons apprises.

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| Structure d'incident `M7IncidentRecord` avec sévérité `info / warn / error` — outille la réponse à incident côté support utilisateur et côté Commanditaire (RSSI) | `src/shared/types/diagnostics.ts` |
| 6 types d'incidents v1 (boot_fail, canary_failed, submit_detect_fail, toast_orphan, storage_write_fail, idb_write_fail) + key_regenerated — classification permettant le triage | `src/shared/types/diagnostics.ts` |
| Sévérité `error` pour incidents critiques (clé perdue, canary échec, exception submit, échec IDB), `warn` pour dégradations (toast_orphan), `info` pour événements opérationnels | `src/background/services/incident-service.ts` |
| Post-mortem M7 formalisé (2026-04-14) — 4 profils techniques, 15 UC revus, PDCA avec 7 règles permanentes, score maturité 2.0→3.4/5 | `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md` |
| Atelier PDCA consolidé en `LESSONS_LEARNED.md` (règles permanentes opposables aux prochaines features) | `.claude/LESSONS_LEARNED.md` |
| Cycle PDCA standardisé pour les problèmes techniques : Plan (PROBLEMES.md), Do (application), Check (vérification), Act (capitalisation dans OUTILS / FICHIERS / TECH_STACK / LESSONS_LEARNED) | `.claude/INSTRUCTIONS.md` section "Cycle PDCA" |
| Registre des risques RISQUES.md — enrichi à chaque incident, suivi statut Ouvert / Mitigé / Accepté / Résolu | `.claude/RISQUES.md` |
| Protocole de recette manuelle formalisé (Given/When/Then, pré-conditions, PV daté, P0/P1/P2) — outille la détection et la preuve d'incident en phase de recette | TACHE-063 à produire, pattern déjà appliqué au post-mortem M7 |
| Roles : **Architecte sécurité** (ce rôle) responsable de la posture sécurité et de l'analyse des incidents ; **DPO** en copie pour tout incident touchant à la vie privée (R-M7-08, TACHE-074/084) ; **Référent qualité** contrôle la traçabilité post-incident | `.claude/CLAUDE.md` section "Acteurs disponibles" |
| Responsabilité décrite dans l'AIPD M7 — l'utilisateur est responsable de traitement ; l'éditeur fournit le code et assure la correction de vulnérabilités via releases | AIPD M7 v1.0 section 1.4 |

#### Statut

**Partiellement implémenté** — le projet dispose d'une structure de détection (registre + types + sévérité), d'un process de post-mortem éprouvé (M7) et d'un cycle PDCA standardisé. Les procédures de réponse côté utilisateur (canal de signalement, SLA) restent à formaliser.

#### Écarts résiduels et remédiation

| Écart | Tâche / Risque |
|-------|----------------|
| Absence d'un `SECURITY.md` racine avec procédure de divulgation responsable (coordonnées, GPG, SLA) | **TACHE-107 proposée** (non au BACKLOG actuel) — à soumettre à l'Orchestrateur pour arbitrage. |
| Absence de template GitHub issue "bug sécurité" dédié (champ confidentialité, sévérité suggérée, reproduction minimisée) | À considérer v1.1 — proposition à l'Orchestrateur. |
| Pas de page utilisateur "que faire si M7 ne détecte plus rien ?" (diagnostic auto + procédure de reset) | Partiellement couvert par la page `m7-explication.html` ; pourrait être enrichi après livraison badge dégradé TACHE-062. |
| Procédure de réponse à incident niveau Commanditaire/RSSI documentée informellement (via post-mortem) mais pas comme runbook formel | Proposition : produire un runbook `docs/securite/runbook-reponse-incident.md` en P7 ou v1.1. |
| Classification officielle des incidents (P0/P1/P2) en cours de formalisation par TACHE-063 | TACHE-063 (protocole recette) couvre le besoin adjacent. |

---

## 5. Écarts résiduels et roadmap consolidée

Cette section récapitule l'ensemble des tâches de remédiation identifiées dans les fiches détaillées, triées par priorité et rattachées au contrôle ISO qu'elles impactent.

### 5.1 Tâches existantes au BACKLOG (référence directe)

| Tâche | Priorité | Contrôle ISO impacté | Description courte |
|-------|----------|----------------------|---------------------|
| TACHE-062 | Should | A.8.16 Monitoring | Badge popup dégradé `diagnostics.m7.ready=false > 1h` |
| TACHE-074 | Should | A.8.12 Data leakage | Transmission DPO mini-DAT TACHE-061 pour compatibilité AIPD M7 |
| TACHE-078 | Should | A.8.15 Logging | Instrumenter `storage_write_fail` sur sites critiques |
| TACHE-079 | Should | A.8.15 Logging | Correctif R-M7-09 incidents fantômes premier install |
| TACHE-083 | **Livrée PR #12** | A.8.12 / A.8.28 | Factory `logger.ts` minimisation console SW |
| TACHE-084 | Should | A.8.12 Data leakage | Inventaire exhaustif champs console loggés transmis DPO |
| TACHE-085 | Must | A.8.15 / A.8.16 | M2 — `initBoot()` + `diagnostics.m2` + incidents whitelist |
| TACHE-086 | Should | A.8.15 / A.8.16 | M3 — `diagnostics.m3` minimal |
| TACHE-087 | Should | A.8.15 / A.8.16 | M5 — `initBoot()` + `diagnostics.m5` + `pending_m5_update_reminder` |
| TACHE-088 | Should | A.8.15 / A.8.16 | M6 — `initBoot()` + `diagnostics.m6` + `pending_m6_quiz` |
| TACHE-089 | Could | A.8.15 / A.8.16 | M9 + M17 — `diagnostics.m9` + `diagnostics.m17` minimaux |
| TACHE-090 | Could | A.8.28 / A.8.24 | M17 — `pending_m17_toast` conforme R-CLI-01/07 |
| TACHE-091 | Should | A.8.28 Secure coding | M7 — mise en conformité R-CLI-03 (migrer `timestamp` → `expires_at`, caduque E-CLI-01) |
| TACHE-093 | Should | A.8.10 (hors 8 initiaux) | Purge `pending_*` expirés dans `onPurgeDaily` |
| TACHE-104 | Should | A.8.12 / A.8.28 | Migration factory logger 12 sites résiduels SW |
| TACHE-105 | Could | A.8.12 | Migration factory logger 26 sites CS/UI |

### 5.2 Tâches proposées par ce référentiel (non au BACKLOG, à arbitrer)

| Tâche proposée | Priorité suggérée | Contrôle ISO | Description |
|----------------|-------------------|--------------|-------------|
| **TACHE-107 (proposée)** | Should | A.8.8 / A.5.24 / A.5.26 | Produire un `SECURITY.md` racine (divulgation responsable, contact, GPG, SLA) |
| **TACHE-108 (proposée)** | Could | A.8.28 Secure coding | Activer SAST en CI (CodeQL ou Semgrep) avec ruleset OWASP Top 10 / CWE Top 25 |
| **TACHE-109 (proposée)** | Could | A.8.16 Monitoring | Page utilisateur "état de santé Sentinel Nudge" agrégeant `diagnostics.<module>` des 7 modules (v1.1) |
| **TACHE-110 (proposée)** | Could | A.5.24 / A.5.26 | Runbook `docs/securite/runbook-reponse-incident.md` (procédure formelle de réponse à incident) |
| **TACHE-111 (proposée)** | Could | A.5.24 / A.5.26 | Template GitHub issue "bug sécurité" avec champs confidentialité / sévérité / reproduction |

### 5.3 Priorisation suggérée par l'Architecte sécurité

Pour une release v1 solide, les remédiations à traiter dans l'ordre sont :

1. **TACHE-079** (R-M7-09) — **prérequis TACHE-062** (sinon le badge affichera des faux positifs au premier install).
2. **TACHE-085** (M2 initBoot) — le risque R-ADR-01 (amnésie whitelist M2) est la classe d'incident la plus proche de P-016/P-018 sur un store métier critique.
3. **TACHE-087 / TACHE-088** (M5 / M6 initBoot) — R-ADR-02.
4. **TACHE-104** (règle ESLint renforcée) — pour empêcher de nouvelles régressions R-M7-08 avant que TACHE-105 soit complétée.
5. **TACHE-091** — levée de E-CLI-01 et mise en conformité complète ADR-002.
6. **TACHE-107 proposée** (`SECURITY.md`) — prérequis social à une vraie réception de rapports de vulnérabilités extérieurs (écart bloquant au positionnement open source).

---

## 6. Historique

| Version | Date | Auteur | Modifications | Sources |
|---------|------|--------|---------------|---------|
| 1.0 | 2026-04-17 | Architecte sécurité (Fabrique) | Initialisation — 8 contrôles ISO 27001:2022 Annexe A tracés (A.5.7, A.8.8, A.8.12, A.8.15, A.8.16, A.8.24, A.8.28, A.5.24/A.5.26) depuis mini-DAT TACHE-061 v1.1 section 12. Proposition de 5 tâches complémentaires (TACHE-107 à 111). | Mini-DAT TACHE-061 v1.1 (section 12), ADR-001, ADR-002, AIPD M7 v1.0, RISQUES.md, BACKLOG.md, SESSION.md |

---

## 7. Références

| Document | Chemin |
|----------|--------|
| Mini-DAT TACHE-061 v1.1 | `docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md` |
| ADR-001 SW-BOOT-CONTRACT | `docs/adr/adr-001-sw-boot-contract.md` |
| ADR-002 CROSS-LIFECYCLE-INTENT | `docs/adr/adr-002-cross-lifecycle-intent.md` |
| Audit modules v1.0 | `docs/p4-conception/p5-audit-modules-adr-compliance-v1.0.md` |
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
