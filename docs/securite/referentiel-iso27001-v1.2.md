# Référentiel de sécurité — ISO/CEI 27001:2022 (Annexe A)

**Projet** : Sentinel Nudge
**Version** : 1.2
**Date** : 2026-04-19
**Auteur** : Architecte sécurité (Fabrique)
**Statut** : Vivant — enrichi à chaque phase
**Niveau de sensibilité** : Exposé
**Origine** : TACHE-075 (v1.0) — TACHE-114 (v1.1, post-TACHE-085/107/110/111) — **TACHE-166 (v1.2, post-revue Fabrique 19/04 : T-028 / T-118 / T-120 / T-115 / T-187)**

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

Sentinel Nudge étant un projet d'extension navigateur open source sans entité juridique opérant un service hébergé, une grande partie des contrôles A.6 (personnel) et A.7 (physique) ne s'applique pas directement. Le projet se concentre sur les contrôles organisationnels A.5 pertinents (gestion d'incidents, threat intelligence, classification de l'information) et l'ensemble des contrôles technologiques A.8 applicables à un logiciel client-side.

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

### 2.2 Phases projet couvertes au 2026-04-19

| Phase | Livrables sécurité produits |
|-------|------------------------------|
| P1 | Cahier des charges v1.1 (principe Privacy by Design) |
| P2 | PV comité sécurité P2 v1.0, SFD v1.1 |
| P3 | DAT v1.4, AIPD M7 v1.2, STRIDE global |
| P4 / P4' | Implémentation code + Brand Book + gouvernance revue code P4' |
| **P5 (en cours)** | ADR-001, ADR-002, mini-DAT TACHE-061 v1.1, audit modules v1.0, référentiel ISO **v1.0/v1.1/v1.2**, `SECURITY.md` v1.0, runbook réponse à incident v1.0, templates GitHub issue, M2 `initBoot` + diagnostics, **resserrement WAR T-028 (PR #91)**, **CodeQL SAST T-187 (PR #97 mergée)**, **SBOM Anchore SHA-pinned T-120 (PR #80)**, **SHA pinning Actions CI T-118**, **note DPO T-115 procédure E1-E6** |

### 2.3 Tableau synthétique — maturité par domaine de contrôle

Auto-évaluation qualitative au 2026-04-19 (post-revue Fabrique 19/04 — T-028 / T-118 / T-120 / T-115 / T-187) sur l'échelle SAMM-like définie en §1.4. Les promotions de maturité intervenues en v1.2 sont signalées en **gras**.

| Domaine | Contrôles ISO | Statut | Maturité | Justification principale |
|---------|---------------|--------|----------|--------------------------|
| Conception sécurisée | A.5.7, A.8.25, A.8.28 | Implémenté | *Reproductible* | STRIDE global DAT + STRIDE ciblés feature (mini-DAT T-061) + ADR-001/002 opposables, revue code Exposé systématique |
| Logging | A.8.15 | Partiellement implémenté | *Défini* (M7 + M2 livrés) | Registre M7 + `diagnostics.m7` (T-061) + `diagnostics.m2` + incidents `whitelist_corrupted`/`_regenerated` livrés (T-085, PR #19). Reste *Partiel* globalement tant que le chantier A (T-086 à 091) n'est pas terminé. |
| Monitoring | A.8.16 | Partiellement implémenté | *Défini* (M7 + M2 livrés) | Idem ci-dessus. Badge dégradé utilisateur et page d'état consolidée pendantes (T-062, T-109). |
| Cryptographie | A.8.24 | Implémenté | *Défini* | AES-256-GCM, SHA-256 + sel, IV uniques INV-SEC-01, sérialisation Array&lt;number&gt; figée (INV-06) |
| Gestion de vulnérabilités | A.8.8 | Implémenté (partiellement dormant) | *Géré* (interne) / *Dormant* (externe) | `SECURITY.md` v1.0 + templates issue livrés (T-107/111, PR #17) — canal GitHub Security Advisories dormant tant que repo privé (T-112 bloquante). Post-mortem M7 éprouvé + SBOM + Dependabot actifs. **v1.2 : ajout cadence revue manuelle `npm audit` trimestrielle (T-174) compensant l'ignore des majors Dependabot pour vite/vite-plugin-web-extension (cf. PR #93).** |
| Prévention fuite de données | A.8.12 | Implémenté | *Défini* | Factory `logger.ts` livrée (T-083, PR #12) + INV-SEC-02 + Privacy by Design. Migration résiduelle T-104/105. |
| **Classification information / minimisation surface** | **A.5.15 / A.8.4** | **Implémenté (v1.2)** | **promotion *Initial* → *Défini*** | **v1.2 : T-028 (PR #91 mergeable) — `web_accessible_resources` resserré (variante hybride B+C : 2 resources explicites + matches `http://*/*` + `https://*/*` au lieu de `<all_urls>`). R-MIN-002 résolu. Mesure documentée et opposable en revue.** |
| Gestion d'incidents | A.5.24 / A.5.26 | **Implémenté (maturité *Géré*)** | *Géré* (depuis v1.1) | Runbook `docs/securite/runbook-reponse-incident.md` v1.0 livré (T-110, PR #18) : classification P0-P3, timeline par sévérité, 10 Steps opérationnels, 5 templates de communication, grille de post-mortem, cadence annuelle de tabletop (T-113). **v1.2 : intégration de la procédure formelle d'escalade DPO E1-E6 (note DPO T-115 v1.0 + AIPD M7 v1.2) — la collaboration DPO/Incident Manager passe d'« informelle » à « 6 étapes typées avec SLA ».** |
| **Sécurité chaîne d'approvisionnement / pipelines** | **A.8.30** | **Implémenté (v1.2)** | **promotion *Initial* → *Géré* (en interne)** | **v1.2 : T-118 — toutes les Actions GitHub des workflows (`ci.yml`, `codeql.yml`, `release.yml`) sont SHA-pinned (CWE-829 atténué). T-174 — cadence revue manuelle trimestrielle `npm audit` + `npm outdated` documentée pour compenser l'ignore des majors Dependabot.** |
| **Supply chain / SBOM** | **A.8.10** | **Implémenté (v1.2)** | **promotion *Reproductible* → *Défini*** | **v1.2 : T-120 (PR #80 mergeable) — installation Syft `curl \| sh` remplacée par `anchore/sbom-action@e22c389...` v0.24.0 SHA-pinned. Élimination de la chaîne d'installation non vérifiable. SBOM SPDX-JSON publié à chaque release.** |
| **Tests sécurité (SAST en CI)** | **A.8.29** | **Implémenté (v1.2 — observe-only)** | **création *Défini*** | **v1.2 : T-187 (PR #97 mergée) — workflow `.github/workflows/codeql.yml` SHA-pinned, ruleset `security-and-quality` (~200 règles couvrant OWASP Top 10 + CWE Top 25), 0 finding J+0. Mode observe-only (non bloquant) en attente de définition d'un seuil de blocage.** |

---

## 3. Tableau synthétique des contrôles tracés

| # | Contrôle | Nom ISO | Statut | Origine mesure | Écarts résiduels |
|---|----------|---------|--------|----------------|------------------|
| 1 | **A.5.7** | Threat intelligence | Implémenté | STRIDE DAT + STRIDE ciblés TACHE-061 + STRIDE ADR-001/002 | Extension aux autres modules (M3/M5/M6/M9/M17) en lot v2 |
| 2 | **A.5.15 / A.8.4** | Access control / Access to source code (et minimisation de surface d'extension) | **Implémenté (v1.2)** | **T-028 (PR #91) — `web_accessible_resources` resserré (variante B+C)** | `host_permissions` reste minimaliste (`<all_urls>` non utilisé) — surveiller toute pression communautaire (R-ADR-07) |
| 3 | **A.8.8** | Management of technical vulnerabilities | Implémenté (partiellement dormant) | Post-mortem M7 + SBOM CycloneDX + Dependabot + `SECURITY.md` v1.0 + templates issue + **cadence revue manuelle `npm audit` trimestrielle T-174 (v1.2)** | Canal GitHub Security Advisories **dormant** tant que repo privé → **TACHE-112** bloquante |
| 4 | **A.8.10** | Information deletion (et **gestion du SBOM** par extension) | **Implémenté (v1.2)** | **T-120 (PR #80) — `anchore/sbom-action@e22c389...` v0.24.0 SHA-pinned remplace `curl \| sh` Syft** | SBOM CycloneDX **et** SPDX en parallèle ; consolidation possible v2 |
| 5 | **A.8.12** | Data leakage prevention | Implémenté | INV-SEC-02 + typage `IncidentContext` + factory `logger.ts` (T-083, PR #12) + Privacy by Design | Migration factory logger non terminée (TACHE-104, TACHE-105) |
| 6 | **A.8.15** | Logging | Partiellement implémenté | Registre M7 + INV-SEC-03/04 + M2 `whitelist_corrupted`/`_regenerated` + `diagnostics.m2` (T-085, PR #19) | Incidents M3/M5/M6/M9/M17 à généraliser (TACHE-086 à 091, R-ADR-05) |
| 7 | **A.8.16** | Monitoring activities | Partiellement implémenté | Heartbeat `diagnostics.m7` + `diagnostics.m2` (T-085, PR #19) | Badge dégradé TACHE-062 + `diagnostics.<module>` des 5 modules restants à livrer |
| 8 | **A.8.24** | Use of cryptography | Implémenté | AES-256-GCM + SHA-256 + sel installation + INV-SEC-01 (IV frais) + R-CLI-06 | Clé en chrome.storage.local (R-003 accepté) |
| 9 | **A.8.28** | Secure coding | Implémenté | ADR-001 (R-BOOT-01 à 05) + ADR-002 (R-CLI-01 à 07) + INV-SEC-02 + règle ESLint logger | Extension règle ESLint (TACHE-104) |
| 10 | **A.8.29** | Security testing in development and acceptance | **Implémenté (v1.2 — observe-only)** | **T-187 (PR #97 mergée) — CodeQL SAST `javascript-typescript` ruleset `security-and-quality`** | Mode observe-only ; définir un seuil de blocage et un process de triage des findings (tâche P5/P6 à créer) |
| 11 | **A.8.30** | Outsourced development (et **supply chain pipelines** par extension) | **Implémenté (v1.2)** | **T-118 — SHA pinning de toutes les Actions GitHub (`ci.yml`, `codeql.yml`, `release.yml`)** + **T-174 cadence revue trimestrielle `npm audit` + `npm outdated`** | Cadence à inscrire au calendrier Q (premier exécution : juillet 2026, fin Q2) |
| 12 | **A.5.24 / A.5.26** | Information security incident management / response | **Implémenté (maturité *Géré*)** | `M7IncidentRecord` + post-mortem M7 PDCA + RISQUES.md suivi + runbook v1.0 (T-110, PR #18) + templates issue (T-111, PR #17) + **note DPO T-115 v1.0 procédure E1-E6 (v1.2) + AIPD M7 v1.2** | Premier tabletop exercise TACHE-113 (cadence annuelle) |

**Note** : la version v1.0 initialisait 8 contrôles (mini-DAT T-061 §12). v1.1 a promu A.5.24/26 à *Géré*. **v1.2 ajoute 4 contrôles (A.5.15/A.8.4, A.8.10, A.8.29, A.8.30) et enrichit 2 contrôles existants (A.8.8, A.5.24/26) — soit 12 contrôles désormais formellement tracés.**

---

## 4. Fiches détaillées

### 4.1 A.5.7 — Threat intelligence

**Intitulé officiel ISO** : *Information relating to information security threats shall be collected and analysed to produce threat intelligence.*

#### Objectif du contrôle

Collecter, analyser et exploiter l'information relative aux menaces de sécurité applicables au système afin d'adapter la posture défensive. Le contrôle couvre à la fois la *threat intelligence stratégique* (paysage de menace) et la *threat intelligence tactique / opérationnelle* (indicateurs, vulnérabilités exploitables).

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| STRIDE global du DAT P3 (6 actifs, 5 classes de menace) | `docs/p3-architecture/p3-dat-v1.4.md` section 9 |
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

### 4.2 A.5.15 / A.8.4 — Access control / minimisation de la surface d'extension (NOUVEAU v1.2)

**Intitulés officiels ISO** :

- **A.5.15** — *Rules to control physical and logical access to information and other associated assets shall be established and implemented based on business and information security requirements.*
- **A.8.4** — *Read and write access to source code, development tools and software libraries shall be appropriately managed.*

**Note de portée** : ces deux contrôles sont historiquement orientés « accès aux assets internes (sources, repos, environnements) ». Pour Sentinel Nudge, ils couvrent **par extension** la minimisation de la surface d'accès **du code de l'extension lui-même** depuis les pages web tierces, via les directives `web_accessible_resources` (WAR) et `host_permissions` du Manifest V3. Cette interprétation est cohérente avec OWASP ASVS V14.4 (Configuration) et le principe du moindre privilège.

#### Objectif du contrôle

Limiter l'accès aux assets sensibles (code, configuration, ressources internes) au strict nécessaire pour l'exécution de la fonction métier. Pour une extension MV3, cela se traduit principalement par :

- la restriction de la liste explicite des ressources de l'extension exposées aux pages web (`web_accessible_resources.resources`) ;
- la restriction de la liste des origines pages web autorisées à charger ces ressources (`web_accessible_resources.matches`) ;
- la restriction des `host_permissions` au strict nécessaire (déjà respecté : aucune `host_permission` ne couvre `<all_urls>` en lecture/écriture).

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| **`web_accessible_resources` resserré (variante hybride B+C)** : `resources` limité à 2 entrées explicites (`pages/dashboard/dashboard.html`, `pages/onboarding/onboarding.html`, `pages/static/*.html`), `matches` resserré de `<all_urls>` à `["http://*/*", "https://*/*"]` (élimine les schemes `chrome-extension://`, `file://`, `view-source:`, etc.) | `src/manifest.json` (post-PR #91) |
| **R-MIN-002 résolu** par T-028 : la finding minor « WAR avec `<all_urls>` trop large » est mitigée. Inscription au registre des risques. | `.claude/RISQUES.md` (R-MIN-002 ajouté en v1.2) ; PR #91 |
| `host_permissions` non déclarées (extension fonctionne avec `activeTab` + `scripting` + injection de content scripts via `matches` http(s)) — principe du moindre privilège strict | `src/manifest.json` `permissions` |
| CSP stricte `default-src 'self'; script-src 'self'; connect-src 'none'` (aucune origine externe autorisée) | `src/manifest.json` `content_security_policy.extension_pages` |
| Aucun script inline dans les pages d'extension — toutes les UI passent par fichiers `.ts/.js` bundlés avec hash CSP-safe | Conformité D-SEC-003 |
| Comité revue code obligatoire sur toute modification de `manifest.json` (changements de permissions / WAR / CSP) | `docs/gouvernance/gouvernance-pv-revue-code-*.md` |

#### Statut

**Implémenté (v1.2)** — depuis la PR #91 (T-028, mergeable au moment du bump v1.2), la mesure est documentée et opposable en revue. Maturité *Défini* : règle écrite dans le manifest, contrôle visible en diff `git diff src/manifest.json`, principe du moindre privilège tracé dans la politique de confidentialité v1.1.

#### Écarts résiduels et remédiation

| Écart | Tâche / Risque |
|-------|----------------|
| Pression communautaire éventuelle pour étendre `host_permissions` à `<all_urls>` (rejeté par postulat A4 du DAT) | R-ADR-07 (Résolu / postulat figé). Surveiller toute issue communautaire en ce sens. |
| Pas de test automatisé qui échoue si `web_accessible_resources.matches` réintroduit `<all_urls>` accidentellement (ex. via un dependabot bumpant un script de génération manifest) | Tâche à créer : règle de validation manifest dans `npm run lint` ou `npm run test` (priorité Could) |
| Pas de revue annuelle systématique du `manifest.json` (drift surveillance) | À intégrer au protocole de recette P7 / cadence audit GitHub trimestrielle (T-129) |

---

### 4.3 A.8.8 — Management of technical vulnerabilities

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
| `SECURITY.md` v1.0 livré (TACHE-107, PR #17) — canal privé GitHub Security Advisories, SLA 30 jours correctif, scope in/out, safe harbor, 7 types de vulnérabilités recherchés | `SECURITY.md` |
| Templates issue GitHub livrés (TACHE-111, PR #17) — `.github/ISSUE_TEMPLATE/config.yml` redirige tout rapport sécurité vers le canal privé ; template `security-bug.md` pour sévérités faibles | `.github/ISSUE_TEMPLATE/` |
| SBOM CycloneDX généré en CI (Instruction Commanditaire I-002) — visibilité sur les versions exactes des dépendances | `.github/workflows/ci.yml` (job SBOM), artefact publié par release |
| **SBOM SPDX-JSON via `anchore/sbom-action@e22c389...` v0.24.0 SHA-pinned (T-120, PR #80)** — remplace `curl \| sh` Syft (cf. §4.5) | `.github/workflows/release.yml` (post-PR #80) |
| Dependabot actif sur le dépôt GitHub — alertes et PR automatiques sur vulnérabilités des dépendances npm | `.github/dependabot.yml` |
| **Cadence revue manuelle trimestrielle `npm audit` + `npm outdated` + revue des CVE (T-174, fusionné T-166)** — compense l'`ignore` Dependabot des bumps majeurs `vite` et `vite-plugin-web-extension` (justifié par incompatibilités MV3 documentées dans `feedback_versions_npm.md`, hotfix PR #93). **Procédure** : tous les 3 mois calendaires (`Q1: avril`, `Q2: juillet`, `Q3: octobre`, `Q4: janvier`), exécuter en local : `npm audit --production` + `npm audit` complet + `npm outdated`. Documenter les CVE non patchables dans RISQUES.md (avec décision : patch / accepter / mitiger). Tracer l'exécution dans `.claude/SESSION.md` ligne d'audit. | Cette section §4.3 + futur ADR audit cadence si formalisation poussée |
| Registre de risques RISQUES.md enrichi à chaque incident/post-mortem | `.claude/RISQUES.md` |

#### Statut

**Implémenté (partiellement dormant)** — le projet dispose d'un cycle complet veille → évaluation → action sur les vulnérabilités logicielles internes (post-mortem + ADR + registre) et sur les vulnérabilités des dépendances (SBOM + Dependabot **+ cadence trimestrielle T-174**). Le canal externe de divulgation responsable est **formalisé** par `SECURITY.md` et les templates issue, **mais dormant** tant que le repository GitHub reste privé : le canal Security Advisories n'est pas atteignable par un tiers sans accès au repo. L'activation opérationnelle dépend exclusivement de **TACHE-112** (checklist pré-publication + bascule `private → public`).

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| Canal GitHub Security Advisories non atteignable depuis l'extérieur (repo privé) | **TACHE-112** (Must, P6) — checklist pré-publication + `gh api ... visibility=public`. Jusque-là, A.8.8 est *dormant* pour la partie divulgation tiers. |
| Migration factory logger non terminée (12 sites résiduels SW + 26 sites CS/UI) — champ `err.message` potentiellement exposé en console | TACHE-104, TACHE-105 |
| Premier exercice de revue trimestrielle `npm audit` à programmer (Q2 2026 — fin juillet 2026) | T-174 (issue de la fusion T-166) — à inscrire au calendrier projet |
| Absence d'exercices tabletop réels pour valider l'opérabilité du process (au-delà du post-mortem M7) | **TACHE-113** (Should, P7) — premier tabletop XSS UC-06 cadencé juillet 2026 |

---

### 4.4 A.8.10 — Information deletion (et **gestion du SBOM** par extension) (ENRICHI v1.2)

**Intitulé officiel ISO** : *Information stored in information systems, devices or in any other storage media shall be deleted when no longer required.*

**Note de portée** : sur Sentinel Nudge, ce contrôle est principalement consommé par les mécanismes de purge utilisateur (droit à l'effacement RGPD Art. 17 — cf. AIPD M7 v1.2) et par la purge FIFO des registres d'incidents (INV-SEC-04). **v1.2 ajoute par extension** la traçabilité du **SBOM** (Software Bill of Materials), considéré comme un asset d'inventaire qu'il faut produire de façon vérifiable et reproductible.

#### Objectif du contrôle (extension SBOM)

Garantir que la liste des composants logiciels embarqués dans une release (dépendances directes et transitives) est **produite par une chaîne d'outillage vérifiable** (SHA pinning, pas de `curl | sh` opaque) et **publiée publiquement** avec chaque release pour permettre :

- la revue tierce des licences (compatibilité GPL v3) ;
- la corrélation rapide entre une CVE annoncée et la version installée chez les utilisateurs ;
- l'audit de supply chain.

#### Réponse Sentinel Nudge — volet purge (héritage v1.0/v1.1)

| Mesure | Référence |
|--------|-----------|
| Droit à l'effacement Art. 17 RGPD : `chrome.storage.local.clear()` + `indexedDB.deleteDatabase('sentinel_nudge')` couvre la purge complète | `src/pages/options/options.ts` `handleDelete()` ; AIPD M7 v1.2 |
| Purge FIFO sévérité-priorisée du registre d'incidents (500 entrées max, priorités `info → warn → error`, INV-SEC-04) | `src/background/services/incident-service.ts` |
| Purge `pending_*` expirés via `onPurgeDaily` (TACHE-093) | À livrer T-093 |

#### Réponse Sentinel Nudge — volet SBOM (NOUVEAU v1.2)

| Mesure | Référence |
|--------|-----------|
| **SBOM SPDX-JSON publié à chaque release GitHub (tag `v*`) via `anchore/sbom-action@e22c389...` v0.24.0 (T-120, PR #80)** — **SHA pinning** complet, source vérifiable (`https://github.com/anchore/sbom-action/commits`) | `.github/workflows/release.yml` job `release` step "Génération SBOM" (post-PR #80) |
| **Élimination de `curl -sSfL ... \| sh -s -- -b /usr/local/bin`** — la chaîne `curl | sh` était une vulnérabilité de classe CWE-829 (Inclusion of Functionality from Untrusted Control Sphere) : tout détournement DNS/MITM sur `raw.githubusercontent.com` permettait d'injecter un installeur malveillant dans un step root du runner CI | PR #80 (description) |
| SBOM CycloneDX généré en CI quotidienne (héritage I-002) — complémentaire au SPDX-JSON publié à la release | `.github/workflows/ci.yml` job SBOM |
| Vérification compatibilité licences GPL v3 (`npm run check-licenses`) en amont du build release | `.github/workflows/release.yml` step "Vérification compatibilité licences GPL v3" |

#### Statut

**Implémenté (v1.2)** sur le volet SBOM. Maturité **promue de *Reproductible* à *Défini*** : la chaîne d'outillage est SHA-pinned, reproductible et vérifiable par un tiers. Le volet purge utilisateur reste *Implémenté* (héritage v1.0/v1.1).

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| SBOM CycloneDX (CI quotidienne) **et** SPDX-JSON (release) coexistent — risque mineur de divergence | À évaluer en v2 : conserver les deux ou en consolider un |
| Pas d'attestation Sigstore / cosign sur les releases | Tâche à créer (priorité Could, P6 ou v2) — alignement S2C2F niveau 2 |
| Purge `pending_*` expirés non encore livrée | TACHE-093 |

---

### 4.5 A.8.12 — Data leakage prevention

**Intitulé officiel ISO** : *Data leakage prevention measures shall be applied to systems, networks and any other devices that process, store or transmit sensitive information.*

#### Objectif du contrôle

Prévenir la divulgation non autorisée d'informations sensibles hors du périmètre maîtrisé (réseau, stockage, canaux de journalisation, supports de sortie). Le contrôle est particulièrement pertinent pour les journaux, les exports utilisateur et les canaux de télémétrie.

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| **Privacy by Design** — principe fondateur du projet : aucune télémétrie, aucun appel réseau sortant dans les modules de nudge, tout traitement local sur le poste de l'utilisateur | Cahier des charges P1 v1.1 section 3.1 ; AIPD M7 v1.2 sections 1.4, 1.6, 1.7 |
| Mot de passe en clair **jamais stocké** — effacement mémoire < 5 ms après hachage (D-SEC-001) | AIPD M7 v1.2 section 1.3 ; `src/content-scripts/password-detector.ts` |
| Valeur collée M17 nullifiée dès la fin du pattern matching (< 10 ms) pour éviter capture par extension malveillante tierce | RISQUES.md R-002 (résolu) |
| **INV-SEC-02** — interdiction structurelle de plaintext sensible dans le champ `context` d'un incident (mots de passe, tokens, URLs complètes, domain_hash corrélable à saisie < 5s) | Mini-DAT TACHE-061 v1.1 section 6bis ; `src/shared/types/diagnostics.ts` |
| **CM-ID2** — typage par union discriminée `IncidentContext` (empêche à la compilation l'ajout de champs libres susceptibles de contenir du plaintext) | Mini-DAT TACHE-061 v1.1 section 11.3 ; `src/shared/types/diagnostics.ts` |
| **CM-ID3 — Factory `logger.ts` livrée (TACHE-083, PR #12)** remplaçant les `console.*` bruts dans `service-worker.ts` et `m7-handler.ts`, règle ESLint custom `no-restricted-syntax` interdisant `err.message` / `String(err)` en argument `console.*` — **mitigation partielle de R-M7-08** (fuite console SW) | `src/shared/logger.ts` ; `.eslintrc` ; mini-DAT TACHE-061 v1.1 section 11.3 |
| Test unitaire TC-M7-SEC-26 — injection de `context={ password: '...' }` rejetée par validation runtime | `tests/unit/incident-service.test.ts` |
| **R-CLI-07** — minimisation du payload d'un pending-intent (hashes, enums, IDs abstraits ; interdit : plaintext, tokens, URLs avec query string, cookies) | ADR-002 section "Règles dérivées" |
| Pas d'`innerHTML` sur entrées DOM non contrôlées — `textContent` uniquement, ESLint no-restricted-properties | RISQUES.md R-004 (résolu) ; ESLint config |
| CSP stricte `script-src 'self'` | `src/manifest.json`, DAT P3 section CSP |
| Export RGPD Art. 20 — données exportables uniquement sur action explicite utilisateur, fichier local jamais transmis | `src/pages/options/options.ts` `handleExport()` ; TACHE-013 mergée |
| Revue DPO AIPD M7 systématique en cas de nouveau champ loggé (TACHE-074 v1.0 livrée + TACHE-115 v1.0 livrée + AIPD M7 **v1.2** livrée) | `docs/rgpd/note-dpo-circuit-incidents-m7-v1.0.md` |

#### Statut

**Implémenté** sur le périmètre IDB (`incidentService.log()` typé) et sur le périmètre réseau (aucune sortie). Le périmètre console SW est en cours de remédiation : la factory `logger.ts` livrée par TACHE-083 (PR #12) établit la brique centrale ; TACHE-104 (12 sites SW résiduels) et TACHE-105 (26 sites CS/UI) achèveront la couverture.

#### Écarts résiduels et remédiation

| Écart | Tâche / Risque |
|-------|----------------|
| 12 sites résiduels `console.*` dans handlers SW avec pattern `const message = err.message` non capturé par la règle ESLint actuelle | TACHE-104 |
| 26 sites `console.*` dans content scripts + pages UI non migrés vers la factory | TACHE-105 |
| R-M7-08 (fuite console SW) partiellement mitigé — statut *Résolu* T-079 PR #55 (cf. RISQUES.md) | RISQUES.md R-M7-08 |
| Absence de revue périodique des exports utilisateur (Art. 20) pour détecter une régression introduisant un champ sensible | À intégrer à la checklist comité de recette (P7) |

---

### 4.6 A.8.15 — Logging

**Intitulé officiel ISO** : *Logs that record activities, exceptions, faults and other relevant events shall be produced, stored, protected and analysed.*

#### Objectif du contrôle

Produire, stocker, protéger et analyser des journaux d'événements de sécurité permettant la détection des incidents, la réponse à incident et la forensique post-événement. Les logs doivent être horodatés, structurés, protégés contre l'altération et la suppression.

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| Registre d'incidents IndexedDB `m7_incidents` — store dédié, clé `id` auto-incrément, index `ts` et `type` (nommage historique ; héberge depuis T-085 aussi les incidents M2) | Mini-DAT TACHE-061 v1.1 section 4 ; `src/background/services/incident-service.ts` |
| Schéma d'incident structuré `M7IncidentRecord` typé (`id`, `ts`, `type`, `severity` info/warn/error, `context` typé `IncidentContext`) | `src/shared/types/diagnostics.ts` |
| Types d'incidents v1 : **M7** — `boot_fail`, `canary_failed`, `submit_detect_fail`, `toast_orphan`, `storage_write_fail`, `idb_write_fail`, `key_regenerated` (INV-SEC-05) ; **M2 — `whitelist_corrupted`, `whitelist_regenerated` (TACHE-085, PR #19)** | `src/shared/types/diagnostics.ts` + `src/background/handlers/m2-handler.ts` |
| **INV-SEC-03** — log `severity=error` AVANT écrasement d'une valeur cryptographique (traçabilité forensique non négociable) | Mini-DAT TACHE-061 v1.1 section 6bis ; ADR-001 R-BOOT-02 |
| **INV-SEC-04** — purge FIFO sévérité-priorisée : `info → warn → error` (mitigation saturation forensique R-M7-07) | Mini-DAT TACHE-061 v1.1 section 6bis ; test TC-M7-SEC-28 |
| **CM-DOS2** — rate-limit applicatif `repeat_count` < 1s sur couple `(type, severity)` avec même `context` structurel | Mini-DAT TACHE-061 v1.1 section 11.4 ; `IncidentService.log()` |
| **CM-DOS3** — pas de coalescing pour `severity='error'` (timestamp précis préservé) | `IncidentService.log()` |
| Buffer mémoire borné 10 entrées pré-`initDB()` + flush au premier tick après init | `src/background/services/incident-service.ts` |
| Borne maximale `MAX_INCIDENTS = 500` entrées | `src/background/services/incident-service.ts` |
| `diagnostics.m7` publié dans `chrome.storage.local` avec `ready`, `last_boot_ts`, `boot_count`, `canary_verified`, `last_detection_ts` | `src/background/services/heartbeat-service.ts` |
| **`diagnostics.m2` publié (TACHE-085, PR #19)** | `src/background/handlers/m2-handler.ts` — `initBootM2()` |
| ADR-002 — journalisation des défaillances pipeline cross-lifecycle (`toast_orphan`, `pending_purge_failed`) | ADR-002 Règle R-CLI-04 |

#### Statut

**Partiellement implémenté** — M7 (TACHE-061) et **M2 (TACHE-085, PR #19)** disposent désormais d'un logging complet. Les modules **M3 / M5 / M6 / M9 / M17** n'émettent pas encore d'incidents structurés pour leurs défaillances critiques (cf. R-ADR-05). Le statut global reste **Partiellement implémenté** tant que le chantier A (TACHE-086 à 091) n'est pas terminé.

#### Écarts résiduels et remédiation

| Écart | Tâche / Risque |
|-------|----------------|
| M2 : incidents `whitelist_corrupted` / `whitelist_regenerated` | **Résolu — TACHE-085 mergée PR #19** |
| M3 : pas d'incident `events_store_corrupted` | TACHE-086 |
| M5 : pas d'incident `m5_snooze_corrupted` / `update_check_failed` | TACHE-087, R-ADR-02 |
| M6 : pas d'incident `m6_install_date_corrupted` / `quiz_deferred_stale` | TACHE-088, R-ADR-02 |
| M9 : pas d'incident `m9_handler_error` | TACHE-089 |
| M17 : pas d'incident `m17_handler_error` | TACHE-089, TACHE-090 |
| `storage_write_fail` non instrumenté sur les sites critiques | TACHE-078 |
| Logs console SW partiellement minimisés | TACHE-083 livrée (PR #12), TACHE-104/105 résiduels |

---

### 4.7 A.8.16 — Monitoring activities

**Intitulé officiel ISO** : *Networks, systems and applications shall be monitored for anomalous behaviour and appropriate actions taken to evaluate potential information security incidents.*

#### Objectif du contrôle

Surveiller en continu les systèmes, détecter les comportements anormaux et déclencher une action (alerte, analyse, mitigation) sur les écarts.

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| Heartbeat `diagnostics.m7` — état de santé M7 persisté dans `chrome.storage.local` | `src/background/services/heartbeat-service.ts` |
| **Heartbeat `diagnostics.m2` (TACHE-085, PR #19)** | `src/background/handlers/m2-handler.ts` |
| Champ `ready: boolean` — matérialise l'état fonctionnel du module | `src/shared/types/diagnostics.ts` |
| Champ `boot_count: number` monotone croissant | `src/shared/types/diagnostics.ts` |
| Champ `last_detection_ts` (M7) | `src/shared/types/diagnostics.ts` |
| Invariant INV-01 — `ready === true` implique `canary_verified === true` | Mini-DAT TACHE-061 v1.1 section 6 |
| Invariant INV-05 — si `ready=false` depuis > 3 600 000 ms alors badge dégradé | TACHE-062 à livrer |
| ADR-001 R-BOOT-04 — tout handler publie un `diagnostics.<module>` homogène | ADR-001 section "Règles dérivées" |
| Log `console.info` JSON avec `duration_ms` en fin de séquence boot | Mini-DAT TACHE-061 v1.1 section 8 |

#### Statut

**Partiellement implémenté** — M7 et M2 (T-085) disposent d'un heartbeat fonctionnel. L'instrumentation visible côté utilisateur (badge dégradé) n'est pas encore livrée (TACHE-062). M3 / M5 / M6 / M9 / M17 ne publient pas encore de `diagnostics.<module>`.

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| Badge popup "dégradé" si `diagnostics.m7.ready=false` depuis > 1h | TACHE-062 |
| `diagnostics.m3` / m5 / m6 / m9 / m17 à implémenter | TACHE-086 à 091 |
| Page utilisateur consolidée "état de santé Sentinel Nudge" | **TACHE-109** (Could, P5.1) |
| Mesures automatisées du `boot_count > 50/h` non déclenchées | À intégrer au badge TACHE-062 |

---

### 4.8 A.8.24 — Use of cryptography

**Intitulé officiel ISO** : *Rules for the effective use of cryptography, including cryptographic key management, shall be defined and implemented.*

#### Objectif du contrôle

Définir et mettre en œuvre des règles pour l'utilisation effective de la cryptographie, y compris la gestion des clés cryptographiques (génération, stockage, rotation, destruction).

#### Réponse Sentinel Nudge

| Mesure | Référence / Justification |
|--------|---------------------------|
| **Algorithme de chiffrement** : AES-256-GCM (hashes M7) — NIST SP 800-38D, OWASP Cryptographic Storage Cheat Sheet | `src/background/crypto-service.ts` ; DAT P3 section crypto |
| **Algorithme de hachage** : SHA-256 avec sel d'installation (16 bytes / 128 bits, `installation_salt`) | AIPD M7 v1.2 section 1.3 |
| **Source d'aléa** : `crypto.getRandomValues()` uniquement (API SubtleCrypto native) | Tous services crypto |
| **Taille de clé AES** : 256 bits | `CryptoService.generateKey()` |
| **IV AES-GCM** : 12 bytes (96 bits) — taille recommandée NIST SP 800-38D pour GCM | `CanaryService.init()`, `CryptoService.encrypt()` |
| **INV-SEC-01** — non-réutilisation d'IV AES-GCM | Mini-DAT TACHE-061 v1.1 section 6bis ; test TC-M7-SEC-25 |
| **R-CLI-06** — IV frais obligatoire à chaque émission d'un pending-intent | ADR-002 section "Règles dérivées" |
| **Sérialisation JSON-safe** — `ArrayBuffer` et `Uint8Array` convertis en `Array<number>` (INV-06) | `TECH_STACK.md`, test TC-M7-23 |
| **Rotation de clé** : régénération sur `canary_failed` avec pattern **CM-EOP1** | ADR-001 R-BOOT-05 |
| **Stockage de clé** : `chrome.storage.local` — risque R-003 accepté | RISQUES.md R-003 |
| **Canary hash** comme détecteur d'intégrité logicielle de la clé | Mini-DAT TACHE-061 v1.1 section 11.1 |
| Aucun chiffrement "maison" — délégation `SubtleCrypto` native | I-001 conformité |
| Aucune bibliothèque crypto tierce dans les dépendances — SBOM vérifiable | `package.json`, SBOM SPDX-JSON release |

**Référence croisée :** Référentiel ISO 27001 v1.2, contrôle A.8.24, section 4.8 — `docs/securite/referentiel-iso27001-v1.2.md`.

#### Statut

**Implémenté** — choix algorithmiques alignés sur les standards (NIST SP 800-38D, OWASP), règles de gestion des IV figées par INV-SEC-01 et R-CLI-06.

#### Écarts résiduels et remédiation

| Écart | Statut |
|-------|--------|
| Clé en `chrome.storage.local` accessible à tout contexte de l'extension | R-003 **Accepté** — limite structurelle MV3, documentée |
| Pas de rotation périodique planifiée de la clé AES | Intentionnel — rotation déclenchée uniquement sur incident |
| Pas d'HSM | Non applicable — extension navigateur client-side |

---

### 4.9 A.8.28 — Secure coding

**Intitulé officiel ISO** : *Secure coding principles shall be applied to software development.*

#### Objectif du contrôle

Appliquer des principes de codage sécurisé à travers des règles opposables (linting, revue, patterns obligatoires).

#### Réponse Sentinel Nudge

| Mesure | Référence / CWE |
|--------|-----------------|
| **ADR-001 SW-BOOT-CONTRACT** — 5 règles dérivées (R-BOOT-01 à R-BOOT-05) opposables en revue de code | `docs/adr/adr-001-sw-boot-contract.md` |
| R-BOOT-01 — séquence lire → valider → régénérer/migrer → logger obligatoire | CWE-252, CWE-755 |
| R-BOOT-02 — log `severity=error` AVANT écrasement d'une valeur critique | CWE-778 |
| R-BOOT-05 — CM-EOP1 avant toute régénération de valeur cryptographique | CWE-321, CWE-330 |
| **ADR-002 CROSS-LIFECYCLE-INTENT** — 7 règles dérivées (R-CLI-01 à R-CLI-07) opposables | `docs/adr/adr-002-cross-lifecycle-intent.md` |
| R-CLI-02 — JSON-strict typé sur payload persisté | CWE-502 |
| R-CLI-06 — IV AES-GCM frais à chaque ré-émission | CWE-323 |
| R-CLI-07 — minimisation du payload | CWE-532, CWE-312 |
| **INV-SEC-02** — typage strict `IncidentContext` par union discriminée | CWE-532 |
| **CM-ID3** — règle ESLint custom interdisant `err.message` / `String(err)` en argument `console.*` | `.eslintrc` `no-restricted-syntax` |
| **Factory `logger.ts` (TACHE-083 mergée PR #12)** | `src/shared/logger.ts` |
| ESLint `no-restricted-properties` — interdiction `innerHTML` | `.eslintrc` ; R-004 résolu |
| TypeScript strict mode (`strict: true`) | `tsconfig.json` |
| Revue de code systématique niveau Exposé | `docs/gouvernance/gouvernance-pv-revue-code-*.md` |
| Checklist pré-commit : `format:check + lint + build + test` (LL-009 + LL-021) | `.claude/OUTILS.md` |
| Hook I-009 — vérification CI obligatoire après push | `.git/hooks/post-push` |
| Conventional Commits | `.claude/INSTRUCTIONS.md` |
| Pas de secret dans le code versionné | `.gitignore`, `.env.example`, feedback_git_precommit |

#### Statut

**Implémenté** — règles documentées (ADR opposables), outillées (ESLint + TypeScript strict), vérifiées (revue systématique en Exposé) et automatisées (CI pré-merge).

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| Règle ESLint TACHE-083 ne capture pas encore le pattern `const message = err.message` via variable intermédiaire | TACHE-104 |
| SAST automatisé (CodeQL) — **désormais activé en CI (T-187, PR #97)** — cf. fiche §4.10 dédiée A.8.29 | A.8.29 §4.10 |
| Pas de liste explicite OWASP Top 10 / CWE Top 25 confrontée au code par scan automatique | **Couvert v1.2 par CodeQL ruleset `security-and-quality` (~200 règles incluant OWASP/CWE) — cf. §4.10** |

---

### 4.10 A.8.29 — Security testing in development and acceptance (NOUVEAU v1.2)

**Intitulé officiel ISO** : *Security testing processes shall be defined and implemented in the development life cycle.*

#### Objectif du contrôle

Intégrer des tests de sécurité automatisés dans le cycle de développement (SAST, DAST, secrets scanning) et de recette, avec une cadence et un seuil de blocage définis. Le contrôle est central pour les pipelines CI/CD modernes (DevSecOps).

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| **CodeQL SAST JavaScript/TypeScript activé en CI (T-187, PR #97 mergée 2026-04-19)** | `.github/workflows/codeql.yml` |
| Workflow **SHA-pinned** : `actions/checkout@de0fac2e...` v6.0.2, `actions/setup-node@53b83947...` v6.3.0, `github/codeql-action/init@ce64ddcb...` v3.35.2, `github/codeql-action/autobuild@ce64ddcb...` v3.35.2, `github/codeql-action/analyze@ce64ddcb...` v3.35.2 (CWE-829 atténué — cf. A.8.30) | `.github/workflows/codeql.yml` |
| **Ruleset `security-and-quality`** : ~200 règles couvrant OWASP Top 10 (A01 Broken Access Control, A03 Injection, A04 Insecure Design, A07 Identification & Authentication Failures, A08 Software & Data Integrity, A10 SSRF) et CWE Top 25 (CWE-79 XSS, CWE-89 SQLi, CWE-787 Out-of-bounds Write, CWE-352 CSRF, CWE-22 Path Traversal, etc.) | Documentation CodeQL ; PR #97 |
| **Cadence d'exécution** : sur tout push `develop`/`main`, sur toute PR vers `develop`, plus un cron lundi 06:00 UTC (complément Dependabot hebdomadaire) | `.github/workflows/codeql.yml` `on:` |
| **Permissions minimales** : `contents:read`, `security-events:write` (publication SARIF), `actions:read` — principe du moindre privilège | `.github/workflows/codeql.yml` `permissions:` |
| **Concurrency control** : `cancel-in-progress: true` pour éviter la congestion de runners | `.github/workflows/codeql.yml` `concurrency:` |
| **Résultat J+0** : **0 finding** sur le scan initial (PR #97). Scan exécuté avec succès, publication SARIF dans onglet Security GitHub. | PR #97 description + Security tab GitHub |
| Tests unitaires Vitest avec couverture sécurité (TC-M7-SEC-25 à 29 + TC-M7-23) | `tests/unit/incident-service.test.ts` etc. |
| Tests E2E Playwright (TACHE-059) — couverture comportementale en environnement Chrome MV3 | `.github/workflows/ci.yml` job `e2e` |
| Vérification compatibilité licences GPL v3 (`npm run check-licenses`) en CI | `.github/workflows/ci.yml` |
| Vérification taille de bundle (`< 5 Mo`) en CI — détection d'inflation suspecte | `.github/workflows/ci.yml` |

#### Statut

**Implémenté (v1.2 — observe-only)** — SAST CodeQL opérationnel et exécuté à chaque PR / push, ruleset sécurité-et-qualité actif. **Maturité *Défini*** : process documenté (workflow versionné), cadence claire (push + cron hebdomadaire), résultat publié dans onglet Security. **Mode observe-only** assumé : non bloquant sur les branch protections en attente d'un seuil de blocage défini.

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| Mode **observe-only** — un finding `error` ne bloque pas le merge actuellement | Tâche à créer (priorité Should, P5/P6) : définir un seuil de blocage (ex. tout finding `severity=error` bloque) + procédure de triage des findings (issue Security tab → PR fix ou justification). Coordonner avec l'Orchestrateur pour ajustement des branch protection rules. |
| Pas de DAST (Dynamic Application Security Testing) | Non applicable au sens classique (pas de serveur), mais E2E Playwright + Lighthouse-CI couvrent partiellement. À documenter explicitement comme « N/A justifié » en P6. |
| Pas de secrets scanning automatisé en CI (gitleaks / trufflehog) | Tâche à créer (priorité Could, P5) — complément à l'inspection manuelle de l'Assistant Git pré-commit. Particulièrement pertinent avant bascule repo public (T-112). |
| Triage des futurs findings non documenté | À intégrer au runbook ou créer un mini-runbook dédié « Triage CodeQL findings ». |

---

### 4.11 A.8.30 — Outsourced development (et **supply chain pipelines** par extension) (NOUVEAU v1.2)

**Intitulé officiel ISO** : *The organization shall direct, monitor and review the activities related to outsourced system development.*

**Note de portée** : ce contrôle est historiquement orienté « gestion des prestataires ». Pour Sentinel Nudge, il couvre **par extension** :

- la **gestion de la supply chain logicielle** (dépendances tierces npm, Actions GitHub tierces) considérées comme un sous-traitement de fait du processus de build/déploiement ;
- la **vérification d'intégrité** de ces composants externes via SHA pinning et revue manuelle.

Cette interprétation est cohérente avec le framework S2C2F (Microsoft) niveau 1-2 et CWE-829 (Inclusion of Functionality from Untrusted Control Sphere).

#### Objectif du contrôle

Contrôler et auditer la chaîne d'approvisionnement logicielle et CI/CD pour prévenir les attaques de type :

- substitution d'une Action GitHub par une version malveillante (typosquatting de tag, takeover de namespace, force-push sur tag flottant) ;
- injection d'une dépendance npm vérolée (typosquatting, malicious package promu via takeover) ;
- vulnérabilité non patchée dans une dépendance ignorée par Dependabot.

#### Réponse Sentinel Nudge

| Mesure | Référence |
|--------|-----------|
| **SHA pinning de toutes les Actions GitHub (T-118, post-revue Fabrique 19/04)** — `ci.yml`, `codeql.yml`, `release.yml` n'utilisent plus aucun tag flottant (`@v3`, `@latest`) | `.github/workflows/*.yml` |
| Exemples : `actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd` v6.0.2, `actions/setup-node@53b83947a5a98c8d113130e565377fae1a50d02f` v6.3.0, `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` v7.0.1, `softprops/action-gh-release@b4309332981a82ec1c5618f44dd2e27cc8bfbfda` v3.0.0 | `.github/workflows/ci.yml`, `release.yml` |
| **`anchore/sbom-action@e22c389...` v0.24.0 SHA-pinned (T-120, PR #80)** remplace `curl \| sh` Syft (cf. §4.4) | `.github/workflows/release.yml` post-PR #80 |
| **`github/codeql-action/*@ce64ddcb0d8d890d2df4a9d1c04ff297367dea2a` v3.35.2 SHA-pinned (T-187, PR #97 mergée)** | `.github/workflows/codeql.yml` |
| **Dependabot configuré (T-119)** — bumps hebdo npm, mensuels Actions GitHub, séparation prod vs dev, PRs distinctes | `.github/dependabot.yml` |
| **Ignore documenté** des bumps majeurs `vite` et `vite-plugin-web-extension` (justifié par incompatibilités MV3 — `feedback_versions_npm.md` ; hotfix PR #93 sur `vitest`/`eslint`/`typescript`) | `.github/dependabot.yml` `ignore:` |
| **Cadence revue manuelle trimestrielle (T-174, fusionné T-166)** — `npm audit` + `npm outdated` + revue CVE (cf. §4.3 A.8.8) — compense l'`ignore` Dependabot des bumps majeurs ; **procédure** : tous les 3 mois (Q1 avril, Q2 juillet, Q3 octobre, Q4 janvier), trace dans `.claude/SESSION.md` | Procédure documentée §4.3 et §4.11 |
| Permissions minimales sur tous les workflows (`permissions: contents: read` par défaut, surcharge locale `contents: write` uniquement sur le job `release` qui en a besoin) — atténuation CWE-829 + principe du moindre privilège | `.github/workflows/*.yml` `permissions:` |
| Concurrency control (`cancel-in-progress`) sur `codeql.yml` — atténue le risque de DoS du runner et de divergence d'analyses | `.github/workflows/codeql.yml` |
| `npm ci` (et non `npm install`) systématiquement en CI — strict respect du `package-lock.json` | tous les workflows |
| `package-lock.json` versionné — reproductibilité de l'arbre de dépendances | repo racine |
| Vérification compatibilité licences GPL v3 (`npm run check-licenses`) en CI bloquant | `.github/workflows/ci.yml`, `release.yml` |
| Audit GitHub configuration trimestriel (T-129) — passé de **42/100 → ~83/100 (Niveau A)** post actions T-112/T-118/T-119/T-120/T-129/T-130 | `docs/securite/audit-config-github-v1.0.md` (à enrichir cf. §6) |

#### Statut

**Implémenté (v1.2)** — toutes les Actions GitHub sont SHA-pinned, Dependabot couvre les bumps automatiques, la cadence manuelle trimestrielle T-174 couvre les bumps majeurs ignorés. **Maturité *Géré* (interne)** : process documenté, outillé, mesuré (audit GitHub trimestriel T-129).

#### Écarts résiduels et remédiation

| Écart | Tâche |
|-------|-------|
| Premier exercice trimestriel `npm audit` à programmer (Q2 2026 fin juillet) | T-174 — à inscrire au calendrier projet (.claude/SESSION.md ou backlog dédié) |
| Pas d'attestation Sigstore / cosign sur les releases ni sur les commits | Tâche à créer (Could, P6 ou v2) — alignement S2C2F niveau 2 |
| Audit GitHub trimestriel T-129 à reprogrammer après bascule repo public (T-112) | T-129 |
| Pas de scan automatisé d'intégrité du `package-lock.json` (détection altération via PR malveillante) | Couvert partiellement par Dependabot + revue PR humaine. Pourrait être renforcé par `npm ci --audit-signatures` (Sigstore npm) en v2. |

---

### 4.12 A.5.24 / A.5.26 — Information security incident management / response (ENRICHI v1.2)

**Intitulés officiels ISO** :

- **A.5.24** — *The organization shall plan and prepare for managing information security incidents by defining, establishing and communicating information security incident management processes, roles and responsibilities.*
- **A.5.26** — *Information security incidents shall be responded to in accordance with the documented procedures.*

#### Objectif des contrôles

Planifier, préparer et exécuter la réponse aux incidents de sécurité avec des processus documentés, des rôles clairs et des procédures écrites. Le cycle attendu est : préparation → détection → analyse → containment → eradication → récupération → leçons apprises.

#### Réponse Sentinel Nudge

**Mesure centrale v1.1** : le runbook **`docs/securite/runbook-reponse-incident.md` v1.0** (TACHE-110, PR #18) matérialise les deux contrôles. Il documente le processus (A.5.24) **et** les procédures de réponse à suivre (A.5.26) de bout en bout.

**Mesure centrale v1.2 (NOUVELLE)** : la **procédure formelle d'escalade DPO en six étapes E1-E6** (note DPO TACHE-115 v1.0 : `docs/rgpd/note-dpo-circuit-incidents-m7-v1.0.md` + intégration AIPD M7 **v1.2**) outille la collaboration DPO/Incident Manager pour tout incident M7 (P0 par règle automatique). La procédure passe d'une « collaboration informelle » à un workflow typé avec SLA explicites.

##### Mapping Steps du runbook ↔ contrôle ISO

| Step runbook | Exigence ISO couverte |
|--------------|-----------------------|
| §2 Rôles + §2.1 Principe de séparation mentale | **A.5.24** "roles and responsibilities" |
| §3 Classification de sévérité P0-P3 + règles de montée/descente | **A.5.24** "incident management processes" |
| §4 Timeline de réponse par sévérité (SLA imposés) | **A.5.26** "responded to in accordance with the documented procedures" |
| Step 1 — Accuser réception (SLA 1-5 jours ouvrés) | **A.5.26** réponse immédiate |
| Step 2 — Triage sévérité confirmé | A.5.24 process documenté |
| Step 3 — Reproduire et confirmer + test de régression rouge | A.5.26 analyse |
| Steps 4-6 — Branche privée + correctif + tests régression | A.5.26 containment + eradication |
| Steps 7-9 — CVE + release notes + coordination + disclosure | A.5.26 récupération + communication |
| Step 10 — Post-mortem écrit | **A.5.24** "leçons apprises" + amélioration continue |
| §6 Templates de communication | A.5.26 communication externe standardisée |
| §9 Cadence annuelle de tabletop | **A.5.24** maintien + exercice + amélioration continue |

##### Mapping procédure E1-E6 (note DPO T-115) ↔ contrôle ISO (NOUVEAU v1.2)

| Étape DPO | Déclencheur | Action / livrable | SLA | Responsable | Exigence ISO couverte |
|-----------|-------------|-------------------|-----|-------------|-----------------------|
| **E1 — Notification automatique DPO** | Incident classé P0 (toute incident M7 → P0 par règle auto runbook §3.2) | Invocation immédiate du DPO via Claude Code, tracée dans le journal d'incident | 24 h ouvrées suivant Step 2 | Incident Manager | A.5.24 (rôles), A.5.26 (procédure) |
| **E2 — Avis DPO sur qualification RGPD** | Notification E1 reçue | Avis écrit : (a) qualification Art. 4(12), (b) recommandation Art. 33 (CNIL), (c) recommandation Art. 34 (personnes) | 48 h ouvrées suivant E1 | DPO | A.5.24 (rôles spécialisés) |
| **E3 — Décision Art. 33 (CNIL)** | Avis E2 reçu | Décision responsable de traitement sur avis DPO ; si due, notification CNIL sous 72 h Art. 33 | 72 h Art. 33 | Responsable de traitement | A.5.26 (procédure documentée), conformité RGPD |
| **E4 — Décision Art. 34 (personnes)** | Avis E2 + décision E3 | Validation DPO obligatoire du Template 6.5 du runbook (notification utilisateurs) avant publication | Avant Step 9 | DPO | A.5.26 (validation procédurale) |
| **E5 — Documentation au registre violations** | Step 9 complétée | Inscription au §8 du registre Art. 30 (table « Registre des violations ») avec ID VIOL-XXX | Sous 7 jours après Step 9 | DPO | A.5.24 (traçabilité), conformité RGPD |
| **E6 — Capitalisation post-mortem** | Step 10 du runbook | Co-relecture DPO du post-mortem + propositions d'enrichissements RGPD (AIPD, registre, politique) | Sous 14-30 j après Step 9 | DPO + Incident Manager | A.5.24 (leçons apprises), boucle PDCA |

**Auto-saisine DPO** (note T-115 §3.2) : si l'Incident Manager omet de saisir le DPO (E1) dans les 24 h ouvrées, le DPO peut s'auto-saisir et le tracer explicitement dans le journal d'incident. Cette clause garantit qu'aucun incident P0 ne passe sous le radar RGPD.

##### Mesures complémentaires

| Mesure | Référence |
|--------|-----------|
| `SECURITY.md` v1.0 racine (TACHE-107, PR #17) | `SECURITY.md` |
| Templates GitHub issue (TACHE-111, PR #17) | `.github/ISSUE_TEMPLATE/` |
| Structure d'incident `M7IncidentRecord` avec sévérité | `src/shared/types/diagnostics.ts` |
| Types d'incidents v1 (M7 + M2) | `src/shared/types/diagnostics.ts` + `src/background/handlers/m2-handler.ts` |
| Post-mortem M7 formalisé (2026-04-14) — précédent éprouvé | `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md` |
| Atelier PDCA consolidé en `LESSONS_LEARNED.md` | `.claude/LESSONS_LEARNED.md` |
| Registre des risques RISQUES.md enrichi à chaque incident | `.claude/RISQUES.md` |
| **Note DPO T-115 v1.0 — circuit DPO obligatoire incidents M7 (procédure E1-E6)** | `docs/rgpd/note-dpo-circuit-incidents-m7-v1.0.md` |
| **AIPD M7 v1.2** — alignée avec la procédure E1-E6 et les enrichissements de gouvernance | `docs/p3-architecture/p3-aipd-m7-v1.2.md` (ou équivalent post-T-169) |

#### Statut

**Implémenté — maturité *Géré*** (depuis v1.1, **enrichi v1.2** par procédure E1-E6). Le projet dispose désormais :

- d'une structure de détection (registre + types + sévérité) ;
- d'un canal de signalement externe formalisé (`SECURITY.md` + templates issue) ;
- d'une procédure opérationnelle complète (runbook avec classification, timeline, 10 Steps, 5 templates, grille de post-mortem) ;
- d'une **procédure formelle d'escalade DPO en 6 étapes typées (E1-E6) avec SLA explicites et mécanisme d'auto-saisine** ;
- d'un précédent éprouvé (post-mortem M7 du 2026-04-14) ;
- d'une cadence de validation périodique (tabletop annuel TACHE-113).

Le niveau *Optimisé* sera atteint après le premier tabletop réel (TACHE-113, juillet 2026) qui exercera l'ensemble runbook + procédure E1-E6 dans un scénario simulé de bout en bout.

#### Écarts résiduels et remédiation

| Écart | Tâche / Risque |
|-------|----------------|
| Runbook formel à produire | **Résolu — TACHE-110 mergée PR #18** |
| `SECURITY.md` racine avec procédure de divulgation responsable | **Résolu (dormant) — TACHE-107 mergée PR #17** |
| Template GitHub issue "bug sécurité" dédié | **Résolu — TACHE-111 mergée PR #17** |
| Procédure formelle DPO d'escalade incidents M7 | **Résolu v1.2 — TACHE-115 mergée + AIPD M7 v1.2 (T-169)** : procédure E1-E6 documentée, SLA explicites, mécanisme d'auto-saisine. |
| Tabletop réel non encore joué | **TACHE-113** (Should, P7) — premier tabletop XSS UC-06, juillet 2026 |
| Pas de page utilisateur "que faire si M7 ne détecte plus rien ?" | Partiellement couvert par `m7-explication.html` ; à enrichir après TACHE-062 et TACHE-109 |
| Premier exercice de la procédure E1-E6 en conditions simulées | À intégrer au tabletop TACHE-113 (scénario : XSS UC-06 → P0 → E1 → E2 → décision Art. 33 simulée) |

---

## 5. Écarts résiduels et roadmap consolidée

Cette section récapitule l'ensemble des tâches de remédiation identifiées dans les fiches détaillées, triées par priorité et rattachées au contrôle ISO qu'elles impactent.

### 5.1 Tâches livrées depuis v1.0 (PR identifiées)

| Tâche | PR | Contrôle ISO impacté | Résultat |
|-------|----|----------------------|----------|
| TACHE-083 | PR #12 | A.8.12 / A.8.28 | Factory `logger.ts` — minimisation console SW |
| TACHE-085 | PR #19 | A.8.15 / A.8.16 | M2 `initBoot()` + `diagnostics.m2` + incidents |
| TACHE-107 | PR #17 | A.8.8 / A.5.24 / A.5.26 | `SECURITY.md` v1.0 racine — **dormant** tant que repo privé |
| TACHE-110 | PR #18 | A.5.24 / A.5.26 / A.8.8 | Runbook réponse à incident v1.0 |
| TACHE-111 | PR #17 | A.5.24 / A.5.26 | Templates GitHub issue |
| **TACHE-028** | **PR #91 (mergeable)** | **A.5.15 / A.8.4 (NOUVEAU v1.2)** | **Resserrement WAR — variante hybride B+C — R-MIN-002 résolu** |
| **TACHE-118** | **(post-revue 19/04)** | **A.8.30 (NOUVEAU v1.2)** | **SHA pinning de toutes les Actions GitHub** |
| **TACHE-120** | **PR #80 (mergeable)** | **A.8.10 (ENRICHI v1.2)** | **`anchore/sbom-action@e22c389...` v0.24.0 SHA-pinned remplace `curl \| sh` Syft** |
| **TACHE-115** | **PR #82 (mergée 19/04)** | **A.5.24 / A.5.26 (ENRICHI v1.2)** | **Procédure DPO E1-E6 + intégration AIPD M7 v1.2** |
| **TACHE-187** | **PR #97 (mergée 19/04)** | **A.8.29 (NOUVEAU v1.2)** | **CodeQL SAST en CI — observe-only** |

### 5.2 Tâches existantes au BACKLOG (référence directe)

| Tâche | Priorité | Contrôle ISO impacté | Description courte |
|-------|----------|----------------------|---------------------|
| TACHE-062 | Should | A.8.16 Monitoring | Badge popup dégradé `diagnostics.m7.ready=false > 1h` |
| TACHE-074 | Should | A.8.12 Data leakage | Transmission DPO mini-DAT TACHE-061 (livrée) |
| TACHE-078 | Should | A.8.15 Logging | Instrumenter `storage_write_fail` |
| TACHE-079 | Should | A.8.15 Logging | Correctif R-M7-09 (mergée PR #10) |
| TACHE-084 | Should | A.8.12 Data leakage | Inventaire exhaustif champs console loggés (livré) |
| TACHE-086 | Should | A.8.15 / A.8.16 | M3 — `diagnostics.m3` minimal |
| TACHE-087 | Should | A.8.15 / A.8.16 | M5 — `initBoot()` + `diagnostics.m5` |
| TACHE-088 | Should | A.8.15 / A.8.16 | M6 — `initBoot()` + `diagnostics.m6` |
| TACHE-089 | Could | A.8.15 / A.8.16 | M9 + M17 — `diagnostics.m9` + `diagnostics.m17` |
| TACHE-090 | Could | A.8.28 / A.8.24 | M17 — `pending_m17_toast` conforme R-CLI-01/07 |
| TACHE-091 | Should | A.8.28 Secure coding | M7 — mise en conformité R-CLI-03 |
| TACHE-093 | Should | A.8.10 | Purge `pending_*` expirés dans `onPurgeDaily` |
| TACHE-104 | Should | A.8.12 / A.8.28 | Migration factory logger 12 sites résiduels SW |
| TACHE-105 | Could | A.8.12 | Migration factory logger 26 sites CS/UI |
| TACHE-109 | Could | A.8.16 Monitoring | Page utilisateur "état de santé Sentinel Nudge" |
| **TACHE-112** | **Must** | A.8.8 + A.8.28 | Checklist pré-publication repo public |
| TACHE-113 | Should | A.5.24 / A.5.26 | Premier tabletop exercise (XSS UC-06) — juillet 2026 |
| **TACHE-129** | Should | A.8.30 | Audit GitHub trimestriel (à reprogrammer post T-112) |
| **TACHE-174** | Should | A.8.8 / A.8.30 | **Cadence revue manuelle `npm audit` trimestrielle (issue de la fusion T-166)** |

### 5.3 Tâches nouvelles à créer suite à v1.2

| Tâche suggérée | Priorité | Contrôle ISO impacté | Description |
|----------------|----------|----------------------|-------------|
| Définir un seuil de blocage CodeQL et procédure de triage des findings | Should | A.8.29 | Aujourd'hui observe-only → définir « tout finding `severity=error` bloque » + workflow de triage (issue Security tab → PR fix ou justification documentée) |
| Règle de validation `manifest.json` (échec si `web_accessible_resources.matches` réintroduit `<all_urls>`) | Could | A.5.15 / A.8.4 | Empêche une régression accidentelle de T-028 (ex. via dependabot bumpant un script de génération manifest) |
| Secrets scanning CI (`gitleaks` ou `trufflehog`) | Could | A.8.29 | Particulièrement pertinent avant bascule repo public T-112 |
| Attestation Sigstore / cosign sur les releases | Could (P6/v2) | A.8.10 / A.8.30 | Alignement S2C2F niveau 2 |
| Premier exercice trimestriel `npm audit` (Q2 2026 fin juillet) | Must | A.8.8 / A.8.30 | Inscrit au calendrier — tracer dans `.claude/SESSION.md` |

### 5.4 Priorisation suggérée par l'Architecte sécurité (mise à jour v1.2)

Pour une release v1 solide puis une bascule open source, les remédiations à traiter dans l'ordre sont :

1. **TACHE-086 à 088** (M3 / M5 / M6 `diagnostics` + `initBoot`) — poursuit le chantier A engagé par T-085 ; R-ADR-01/02 résiduels à fermer.
2. **TACHE-104** (règle ESLint renforcée).
3. **TACHE-091** — levée de E-CLI-01 et conformité ADR-002.
4. **TACHE-062** (badge dégradé) — valorise l'investissement heartbeat.
5. **TACHE-112** (bascule repo public) — débloque 3 bénéfices : A.8.8 sort de *dormant*, A.8.29 CodeQL gratuit confirmé, A.8.30 revue tierce facilitée.
6. **Premier exercice trimestriel `npm audit`** (T-174) — Q2 2026 fin juillet, à tracer.
7. **Définir seuil blocage CodeQL + procédure triage findings** (A.8.29) — sortir du mode observe-only.
8. **TACHE-113** (premier tabletop) — exerce le runbook + la procédure E1-E6.
9. Tâches v2 : Sigstore attestation, secrets scanning CI, validation `manifest.json` automatisée.

---

## 6. Synthèse — score audit GitHub configuration

L'audit GitHub configuration v1.0 (TACHE-129, `docs/securite/audit-config-github-v1.0.md`) avait identifié au 2026-04-15 un score de **42/100** (Niveau D). Suite à la livraison des tâches T-112 (en cours) / T-118 / T-119 / T-120 / T-129 / T-130 et de la présente v1.2 du référentiel ISO 27001, le score est **estimé par DevSecOps à ~83/100 (Niveau A)** au 2026-04-19.

| Famille de contrôles | Score v1.0 (2026-04-15) | Score v1.2 (estimé 2026-04-19) | Delta | Tâches contributrices |
|----------------------|------------------------|-------------------------------|-------|----------------------|
| Workflows CI/CD (SHA pinning, permissions) | 30/100 | ~95/100 | +65 | T-118 (SHA pinning), permissions minimales par défaut |
| Supply chain (SBOM, dépendances) | 50/100 | ~85/100 | +35 | T-119 (Dependabot), T-120 (anchore/sbom-action), T-174 (cadence) |
| SAST / tests sécurité | 0/100 | ~85/100 | +85 | T-187 (CodeQL en CI) |
| Manifest extension (WAR, host_permissions) | 60/100 | ~95/100 | +35 | T-028 (resserrement WAR) |
| Branch protection / PR | 50/100 | ~70/100 | +20 | T-129/T-130 (branch protection) |
| Secrets management | 70/100 | ~75/100 | +5 | Déjà fort en v1.0 ; reste secrets scanning CI à ajouter |
| Repository visibility & disclosure | 30/100 | ~30/100 | 0 | Bloqué T-112 (repo privé) |
| **Global** | **42/100 (D)** | **~83/100 (A)** | **+41** | T-028 / T-118 / T-119 / T-120 / T-129 / T-130 / T-187 + v1.2 référentiel |

**Note** : ce score est une auto-évaluation DevSecOps, à confirmer par un audit T-129 reprogrammé après bascule repo public (T-112). La famille « Repository visibility & disclosure » progressera mécaniquement vers ~90/100 dès la bascule.

---

## 7. Historique

| Version | Date | Auteur | Modifications | Sources |
|---------|------|--------|---------------|---------|
| 1.0 | 2026-04-17 | Architecte sécurité (Fabrique) | Initialisation — 8 contrôles ISO 27001:2022 Annexe A tracés (A.5.7, A.8.8, A.8.12, A.8.15, A.8.16, A.8.24, A.8.28, A.5.24/A.5.26) depuis mini-DAT TACHE-061 v1.1 section 12. Proposition de 5 tâches complémentaires (TACHE-107 à 111). | Mini-DAT TACHE-061 v1.1 (section 12), ADR-001, ADR-002, AIPD M7 v1.0, RISQUES.md, BACKLOG.md, SESSION.md |
| 1.1 | 2026-04-17 | Architecte sécurité (Fabrique) | MAJ post-sprint sécurité (T-083/085/107/110/111 mergées). §1.4 statut *Dormant* + échelle SAMM-like. §2.1 M2 "Implémentée". §2.3 reformaté avec niveaux maturité ; A.5.24/26 promu *Défini* → *Géré*. §3 promotions correspondantes. §4.1 M2 retiré écarts STRIDE. §4.2 A.8.8 intégration `SECURITY.md` + templates + dormance. §4.3 A.8.12 factory `logger.ts`. §4.4 A.8.15 incidents M2. §4.5 A.8.16 `diagnostics.m2`. §4.7 A.8.28 SAST CodeQL renvoyé à T-108. §4.8 A.5.24/26 refonte autour du runbook T-110. §5 nouvelle 5.1 livrées + repriorisation. | TACHE-114 ; PR #12, #17, #18, #19 ; BACKLOG T-112 à T-115 |
| **1.2** | **2026-04-19** | **Architecte sécurité (Fabrique)** | **MAJ post-revue Fabrique 19/04 (5 contrôles enrichis ou ajoutés). Renommage `referentiel-iso27001.md` → `referentiel-iso27001-v1.2.md` (résorption A-05 / T-RQ-007 — convention FICHIERS.md `referentiel-iso27001-v1.x.md`). §2.2 mention des livrables T-028/T-118/T-120/T-115/T-187. §2.3 **promotion A.5.15/A.8.4 *Initial* → *Défini* (T-028)** ; **création A.8.30 *Initial* → *Géré* interne (T-118 + T-174)** ; **promotion A.8.10 *Reproductible* → *Défini* (T-120)** ; **création A.8.29 *Défini* observe-only (T-187)** ; enrichissement A.8.8 (cadence T-174) ; enrichissement A.5.24/26 (procédure E1-E6 T-115). §3 tableau passe de 8 à **12 contrôles**. **§4.2 NOUVEAU** A.5.15/A.8.4 (T-028 WAR resserré, R-MIN-002 résolu). §4.3 A.8.8 ajout cadence trimestrielle T-174. **§4.4 ENRICHI** A.8.10 ajout volet SBOM (T-120 anchore/sbom-action SHA-pinned remplace `curl \| sh`). **§4.10 NOUVEAU** A.8.29 (T-187 CodeQL en CI, ruleset security-and-quality, observe-only). **§4.11 NOUVEAU** A.8.30 (T-118 SHA pinning Actions + T-174 cadence revue manuelle). **§4.12 ENRICHI** A.5.24/26 procédure DPO E1-E6 (note T-115 + AIPD M7 v1.2). §5.1 ajout 5 tâches livrées. §5.3 nouvelle sous-section "Tâches nouvelles à créer suite à v1.2". §5.4 repriorisation. **§6 NOUVEAU** Synthèse score audit GitHub 42/100 → ~83/100 (Niveau A) post T-112/T-118/T-119/T-120/T-129/T-130 + v1.2.** | TACHE-166 ; revue Fabrique 19/04 §03-architecte-securite ; PR #91 (T-028), PR #97 mergée (T-187), PR #80 (T-120), PR #82 mergée (T-115), PR #93 hotfix Dependabot, T-118 SHA pinning post-revue ; BACKLOG.md ; `docs/rgpd/note-dpo-circuit-incidents-m7-v1.0.md` ; `.github/workflows/codeql.yml`, `release.yml`, `ci.yml`, `dependabot.yml` |

---

## 8. Références

| Document | Chemin |
|----------|--------|
| Mini-DAT TACHE-061 v1.1 | `docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md` |
| ADR-001 SW-BOOT-CONTRACT | `docs/adr/adr-001-sw-boot-contract.md` |
| ADR-002 CROSS-LIFECYCLE-INTENT | `docs/adr/adr-002-cross-lifecycle-intent.md` |
| Audit modules v1.0 | `docs/p4-conception/p5-audit-modules-adr-compliance-v1.0.md` |
| Politique sécurité racine | `SECURITY.md` |
| Runbook réponse à incident v1.0 | `docs/securite/runbook-reponse-incident.md` |
| **Note DPO T-115 v1.0 — circuit DPO incidents M7 (procédure E1-E6)** | `docs/rgpd/note-dpo-circuit-incidents-m7-v1.0.md` |
| Templates issue GitHub | `.github/ISSUE_TEMPLATE/` |
| AIPD M7 v1.2 | `docs/p3-architecture/p3-aipd-m7-v1.2.md` (ou équivalent post-T-169) |
| DAT P3 v1.4 | `docs/p3-architecture/p3-dat-v1.4.md` |
| PV post-mortem M7 v1.0 | `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md` |
| **Audit configuration GitHub v1.0** | `docs/securite/audit-config-github-v1.0.md` |
| **Hardening CI/CD v1.0** | `docs/securite/hardening-ci-cd-v1.0.md` |
| Workflows CI / CodeQL / Release | `.github/workflows/ci.yml`, `codeql.yml`, `release.yml` |
| Dependabot | `.github/dependabot.yml` |
| Manifest extension (post-T-028) | `src/manifest.json` |
| Registre des risques | `.claude/RISQUES.md` |
| Backlog | `.claude/BACKLOG.md` |
| Leçons apprises | `.claude/LESSONS_LEARNED.md` |
| Tech stack | `.claude/TECH_STACK.md` |
| ISO/CEI 27001:2022 | Annexe A — contrôles référencés dans ce document |
| NIST SP 800-38D | Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) |
| OWASP ASVS 4.0 | Application Security Verification Standard |
| OWASP Cryptographic Storage Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html |
| CWE Top 25 (2023) | https://cwe.mitre.org/top25/ |
| **S2C2F (Microsoft Secure Supply Chain Consumption Framework)** | https://github.com/ossf/s2c2f |
| **CWE-829 — Inclusion of Functionality from Untrusted Control Sphere** | https://cwe.mitre.org/data/definitions/829.html |
