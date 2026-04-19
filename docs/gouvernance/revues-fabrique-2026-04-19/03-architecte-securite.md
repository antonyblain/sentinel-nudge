# Revue Fabrique 2026-04-19 — Architecte sécurité

**Auteur** : Architecte sécurité (Fabrique)
**Date** : 2026-04-19
**Niveau de sensibilité** : Exposé
**Périmètre** : modélisation de menaces, référentiel ISO 27001:2022, registre des risques, AIPD M7 (coordination DPO), mesures de sécurité par module, hardening supply-chain, runbook réponse à incident, dispositif sécurité OSS.
**Documents confrontés** :
- `docs/securite/referentiel-iso27001.md` v1.1 (TACHE-114)
- `docs/securite/runbook-reponse-incident.md` v1.0 (TACHE-110)
- `docs/securite/audit-config-github-v1.0.md` (TACHE-116)
- `docs/p3-architecture/p3-aipd-m7-v1.2.md` (TACHE-154)
- `docs/p3-architecture/p3-dat-v1.4.md` (TACHE-041 algorithmes hachage)
- `docs/rgpd/note-dpo-tache-061-compatibilite-aipd-v1.0.md` (T-074)
- `docs/rgpd/note-dpo-circuit-incidents-m7-v1.0.md` (T-115, procédure E1-E6)
- `docs/rgpd/registre-des-traitements-v1.1.md` (T-155)
- `docs/adr/adr-001-sw-boot-contract.md`, `adr-002-cross-lifecycle-intent.md`
- `docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md`
- `SECURITY.md` v1.0 (TACHE-107)
- `.claude/RISQUES.md`, `.claude/BACKLOG.md`, `.claude/PROBLEMES.md`, `.claude/SESSION.md`

---

## 1. Bilan global

**Niveau de maturité sécurité atteint** : *Géré* (cible *Optimisé* après premier tabletop juillet 2026 — TACHE-113).

Le projet dispose de l'ensemble du dispositif sécurité attendu pour un projet OSS de niveau Exposé : référentiel ISO 27001:2022 vivant, modélisation de menaces STRIDE en plusieurs couches (DAT global + mini-DAT TACHE-061 + ADR-001/002), registre des risques tracé (29 entrées dont 16 Résolues, 8 Acceptées, 5 Ouvertes, 0 Critique), AIPD M7 v1.2 user-friendly avec exigences DPO formalisées, runbook P0-P3 avec 10 Steps, SECURITY.md aligné OSS (canal GH Advisories, SLA 30 j, safe harbor), supply-chain durcie (SHA pinning T-118, CODEOWNERS T-119, SBOM Anchore T-120, branch protection planifiée par T-112).

**Faits marquants depuis le référentiel ISO v1.1 (2026-04-17)** :
- T-028 mergée — MIN-002 (`web_accessible_resources` resserré aux 2 ressources réellement ouvertes par les content scripts) → impact ISO A.5.15 + A.8.4 + OWASP ASVS V14.4 + CWE-668.
- T-074 + T-115 mergées (PR #82) — notes DPO formelles sur compatibilité AIPD M7 v1.2 et procédure d'escalade DPO en 6 étapes E1-E6.
- T-118 / T-119 / T-120 — supply-chain hardening (SHA pinning Actions, CODEOWNERS, dependabot, SBOM via `anchore/sbom-action@<sha>` immuable).
- Hotfix dependabot.yml — durcissement du pattern `ignore` pour les bumps majeurs vite/vitest/eslint/typescript (compat MV3 fragile documentée P-006/P-007).
- 22 PR mergées sur la session 2026-04-18, 29 PR sur la session 2026-04-19.

**Points d'attention résiduels** : la posture sécurité est solide en l'état pour un repo *privé*, mais le dispositif OSS reste **partiellement dormant** tant que TACHE-112 (passage public) n'est pas exécutée par le Commanditaire. Trois réserves bloquantes MEP issues de la note DPO T-074 (R-074-01/02/03) ne sont pas tracées au BACKLOG. Plusieurs livrables de mon périmètre nécessitent un bump documentaire pour intégrer les acquis post-T-085/107/110/111.

---

## 2. Périmètre couvert

### 2.1 Modélisation de menaces STRIDE

| Niveau | Périmètre couvert | Statut |
|--------|-------------------|--------|
| Global (DAT P3 §9) | 6 actifs × 5 classes STRIDE (DAT v1.3, repris dans v1.4 sans modification structurelle) | Présent |
| Ciblé feature M7 (mini-DAT TACHE-061 §11) | 5 sous-menaces : spoofing/tampering canary, tampering registre, info disclosure, DoS, EoP régénération clé — 5 INV-SEC + CM-C1/C2, CM-ID1 à CM-ID4, CM-DOS1/2/3, CM-EOP1 | Implémenté + testé (TC-M7-SEC-25 à 29) |
| ADR-001 SW-BOOT-CONTRACT | 4 menaces atténuées + 3 hors périmètre documentées + 5 R-BOOT opposables | Implémenté |
| ADR-002 CROSS-LIFECYCLE-INTENT | 4 menaces atténuées + 3 hors périmètre + 7 R-CLI opposables (R-CLI-06 IV frais, R-CLI-07 minimisation payload) | Implémenté |
| Mini-DAT TACHE-070 (UC-03 iframes same-origin) | Threat model étendu hérité, R-UC03-01 à 07 (R-UC03-07 borne mémoire `recentSubmits` accepté) | Implémenté |
| UC-01 SSO multi-étape (mini-DAT TACHE-068) | R-UC01-01 à 04 (confusion sémantique Step1/Step2 acceptée) | Implémenté |

### 2.2 Référentiel ISO 27001:2022

8 contrôles tracés (A.5.7, A.5.24/A.5.26, A.8.8, A.8.12, A.8.15, A.8.16, A.8.24, A.8.28). Maturité auto-évaluée *Reproductible* à *Géré* selon domaine.

### 2.3 Registre des risques

29 entrées au total : R-001 à R-023 (corpus initial DAT/CdC), R-M7-03 à R-M7-09 (post-mortem M7), R-ADR-01 à R-ADR-07 (audit ADR-001/002), R-UC01-01 à 04, R-UC02-01, R-UC03-07, R-UC05-01. Statuts : 16 Résolus, 8 Acceptés, 5 Ouverts (R-005, R-006, R-009, R-010, R-011, R-013, R-014, R-015, R-016, R-017 — risques techniques mineurs ou organisationnels).

### 2.4 AIPD M7 v1.2 + coordination DPO

AIPD bumpée v1.0 → v1.1 (TACHE-040/084) → v1.2 (TACHE-154 alignement user-friendly). Notes DPO formelles T-074 (favorable sous réserves, 3 R-074-XX bloquantes MEP + 5 recommandations) et T-115 (procédure d'escalade DPO 6 étapes E1-E6, auto-saisine) intégrées.

### 2.5 Mesures de sécurité par module

| Module | Couverture sécurité | Origine |
|--------|---------------------|---------|
| M2 (typosquatting) | `initBootM2()` + `diagnostics.m2` + incidents `whitelist_corrupted/_regenerated` | TACHE-085 mergée |
| M3 (score) | `diagnostics.m3` + check IDB | TACHE-086 mergée |
| M5 (update) | `initBoot()` + `diagnostics.m5` + `pending_m5_update_reminder` | TACHE-087 mergée |
| M6 (quiz) | `initBoot()` + `diagnostics.m6` + `pending_m6_quiz` (R-CLI-01) | TACHE-088 mergée |
| M7 (réutilisation) | Heartbeat + canary + registre incidents + 5 INV-SEC + CM-EOP1 + cooldown 30j + suppression_list (CRITICAL_MODULES) | TACHE-061 / 091 mergées |
| M9 (certificats) | `diagnostics.m9` minimal | TACHE-089 mergée |
| M17 (presse-papiers) | `diagnostics.m17` + `pending_m17_toast` (R-CLI-01/07, valeur jamais persistée) | TACHE-089/090 mergées |

### 2.6 Patterns sécurité critiques

- Cryptographie : AES-256-GCM (NIST SP 800-38D), SHA-256 + sel d'installation 16 bytes, IV frais 12 bytes (INV-SEC-01 + R-CLI-06), `crypto.getRandomValues()` exclusif, `SubtleCrypto` natif, sérialisation JSON-safe `Array<number>` (INV-06).
- HMAC SHA-256 avec sel d'installation pour `password_hash` et `domain_hash`.
- `whitelist` M2 = FNV-1a 32 bits non cryptographique (justifié AIPD §1.3 — domaines de confiance pseudonymisés).
- Pas de bibliothèque crypto tierce (SBOM vérifiable).

### 2.7 Hardening supply-chain (mergé)

- T-118 — SHA pinning des Actions tierces dans `ci.yml`/`release.yml`, `permissions: read-all` par défaut (CWE-829, ISO A.8.30).
- T-119 — `.github/CODEOWNERS` (`@antonyblain` propriétaire des 9 chemins sensibles) + `.github/dependabot.yml` (npm hebdo + github-actions mensuel, ignore majors vite/vite-plugin-web-extension).
- T-120 — SBOM via `anchore/sbom-action@e22c389904149dbc22b58101806040fa8d37a610` (v0.24.0 SHA-pinned), élimine le pattern `curl | sh` (CWE-829, ISO A.8.10).
- Hotfix dependabot — élargissement du pattern `ignore` aux bumps majeurs `vitest`, `eslint`, `typescript` (compat MV3/ESLint 9 fragile capturée P-006/P-007/P-013).

### 2.8 Runbook réponse à incident + canal OSS

- Runbook 542 lignes : 6 rôles (IM/TL/COMM/OBS/DPO/Reporter), classification P0-P3 + règle de montée auto (M7 = P0, supply-chain = P0, DPO saisi systématiquement), timeline SLA 7/14/30 jours, 10 Steps, 5 templates communication, grille post-mortem, cadence annuelle tabletop (T-113 juillet 2026).
- `SECURITY.md` v1.0 racine — canal GH Security Advisories (privé chiffré), SLA 30 j, safe harbor, scope in/out, 7 types de vulnérabilités recherchées.
- Templates GitHub issue (`config.yml` + `security-bug.md`) — aiguillage automatique vers le canal privé.

---

## 3. Manquant — écarts matériels identifiés

### 3.1 Écarts BLOQUANTS pour la MEP (réserves DPO non tracées)

La note DPO T-074 v1.0 (mergée PR #82) a émis trois réserves **explicitement bloquantes pour la mise en production**. Aucune n'est actuellement tracée comme tâche au BACKLOG. À créer immédiatement :

- **TACHE à créer (T-158 proposée)** — R-074-01 — Documenter dans la JSDoc de `IncidentService.log()` et dans le contrat `M7IncidentType` (`src/shared/types/diagnostics.ts`) la règle d'absence de `domain_hash` brut dans `context` + obligation de revue DPO formelle pour tout futur ajout de champ pseudonymisé. Ajouter règle permanente dans `LESSONS_LEARNED.md`. Effort ≈ 30 min. Priorité **Must** (bloquant MEP).
- **TACHE à créer (T-159 proposée)** — R-074-02 — Implémenter `IncidentService.purgeOldEntries(maxAgeDays = 365)` appelée par `onPurgeDaily` + test TC-M7-30. Doctrine CNIL (durée max absolue 6-12 mois pour journaux applicatifs). Effort ≈ 1 h. Priorité **Must** (bloquant MEP).
- **TACHE à créer (T-160 proposée)** — R-074-03 — Exclure explicitement le store `m7_incidents` de l'export portabilité Art. 20 (compléter `handleExport()` dans `options.ts` + test). Documentation AIPD M7 §2.4. Effort ≈ 30 min. Priorité **Must** (bloquant MEP).

### 3.2 Bumps documentaires manquants suite aux mergés post-v1.1

Le référentiel ISO 27001 v1.1 date du 2026-04-17. Cinq évènements significatifs sont survenus depuis et nécessitent un bump v1.1 → **v1.2** :

| Évènement | Impact ISO | Action référentiel |
|-----------|------------|---------------------|
| **T-028** (resserrement WAR aux 2 seules ressources réellement ouvertes) | A.5.15 (moindre privilège) + A.8.4 (accès code source) | Promouvoir A.5.15/A.8.4 en *Implémenté* + ajouter en §3 9e contrôle |
| **T-118** (SHA pinning Actions) | A.8.30 (sécurité externalisation) | Ajouter A.8.30 + référencer CWE-829 |
| **T-119** (CODEOWNERS + dependabot) | A.5.15 (review obligatoire) + A.8.8 (gestion vulns) | Renforcer fiches §4.2/§4.7 |
| **T-120** (SBOM via action SHA-pinned) | A.8.10 (suppression d'information) — déjà mentionné en §5.2 | Promouvoir A.8.10 en fiche §3/§4 dédiée |
| **T-074/T-115** (notes DPO formelles + procédure E1-E6) | A.5.24 (préparation incidents) | Référencer la procédure E1-E6 dans la fiche §4.8 (mapping Steps Runbook ↔ Étapes DPO) |

L'AIPD M7 elle-même est désormais en v1.2. Une **AIPD v1.3** est recommandée par le DPO (T-074 §4.4) post-livraison des 3 R-074-XX, avec mention explicite TTL 365 j et exclusion Art. 20.

### 3.3 R-MIN-002 nouveau non créé dans RISQUES.md

T-028 a résolu MIN-002 (WAR `<all_urls>` trop permissif) en restreignant aux 2 seules ressources réellement ouvertes par `paste-detector` et `password-detector`. Le risque résiduel acceptable doit être consigné comme **R-MIN-002** dans `.claude/RISQUES.md` :

- **R-MIN-002 — WAR exposition `donnees-sensibles-presse-papiers.html` et `sites-suspects.html` aux origines `http://*/*` + `https://*/*`** — Probabilité 1 / Impact 2 / Score 2 — **Accepté** — Mitigation : pages purement statiques, pas de paramètre URL exploitable, pas de stockage local, pas de privilèges étendus. Origine : T-028 PR #X. Cohérent avec OWASP ASVS V14.4.

### 3.4 R-118 / R-119 / R-120 résiduels supply-chain — non tracés

Les trois mesures de hardening ont chacune un risque résiduel à formaliser :

- **R-118-01** — SHA pinning : risque de divergence entre tag annoncé et SHA pin (drift). Mitigation : revue manuelle au bump dependabot, log SHA dans CHANGELOG. Probabilité 1 / Impact 1 — Accepté.
- **R-119-01** — Dependabot configuré pour ignorer les majors vite/vite-plugin-web-extension/vitest/eslint/typescript. Conséquence : **CVE majeures sur ces 5 dépendances ne déclencheront pas de PR automatique**. Probabilité 2 / Impact 3 / Score 6 — **À mitiger** : ajouter une revue manuelle trimestrielle (`npm audit`) **explicitement** dans la cadence projet + alerte dans `OUTILS.md` ou `LESSONS_LEARNED.md`. Cette mesure de défense en profondeur est obligatoire compte tenu du périmètre ignoré.
- **R-120-01** — Dépendance `anchore/sbom-action@<sha>` : si le SHA est révoqué (cas exceptionnel), la génération SBOM échouera silencieusement en CI (release impossible). Mitigation : monitoring du job SBOM en CI + plan B documenté (pin Syft binaire). Probabilité 1 / Impact 2 — Accepté.

### 3.5 Risques liés au passage public T-112

Le repo passera de privé à public lors de T-112 (Must, P6, action manuelle Commanditaire). Le référentiel ISO v1.1 §4.2 mentionne déjà la dormance du canal GH Security Advisories. **Risques nouveaux à formaliser dans RISQUES.md** :

- **R-112-01 — Exposition publique du code source v1** — Surface d'attaque accrue : tout chercheur ou attaquant aura accès au code, à l'historique git complet (15+ commits depuis ouverture du repo), aux ADR, aux STRIDE, à la liste des CWE référencées. Mitigation : audit `truffleHog`/`gitleaks` pré-publication (déjà T-112 point 3), revue README + CHANGELOG, dispositif SECURITY.md actif dès J+0, runbook prêt à dérouler. Probabilité 3 / Impact 2 / Score 6 — **Mitigé** par T-112 si exécuté complètement.
- **R-112-02 — Reverse engineering du modèle de menace publié pour identifier des angles d'attaque** — Tout STRIDE et toute fiche ADR exposés peuvent guider un attaquant vers les zones d'incertitude résiduelle (R-CLI-XX, R-ADR-XX listés Ouverts/Acceptés). Mitigation : aucune posture défensive à modifier (les acceptations de risque sont des trade-offs explicites et défendables) ; renforcer le dispositif détection (registre incidents, badge dégradé T-062 mergé). Probabilité 2 / Impact 2 / Score 4 — Accepté (transparence OSS = bénéfice net).
- **R-112-03 — Risque de typosquatting du nom de package npm `sentinel-nudge`** — Hors scope v1 (extension non publiée sur npm). Probabilité 1 / Impact 2 — Accepté.

### 3.6 Évaluation services tiers (critère qualité interne projet)

Conformément aux critères de qualité internes Architecte sécurité (revue services tiers), recensement des dépendances de service externalisées :

| Service | Trust Center / certif | Localisation données | Statut |
|---------|----------------------|----------------------|--------|
| GitHub (hébergement repo + Actions + Security Advisories + Dependabot) | SOC 2 Type II + ISO 27001 + ISO 27018 + GDPR Microsoft | UE/US (DPA Microsoft) | **Évalué OK** — TLS 1.3, 2FA + Passkey activés (T-122 Terminé) |
| Chrome Web Store (publication future) | Google Cloud Trust Center, ISO 27001 | UE/US | À évaluer en P8 (publication) |
| Anchore (action SBOM) | SOC 2 Type II annoncé | n/a (pas de transit de données utilisateur) | **Évalué OK** — SHA-pinned, action open-source auditable |
| Aucune télémétrie / aucun service tiers consommé en runtime extension | n/a | 100% local | **Conforme** Privacy by Design |

Pas de coordination DPO requise pour transfert hors UE — aucun transit de données personnelles vers un service tiers.

---

## 4. Cohérence cross-livrables

### 4.1 Cohérence référentiel ISO ↔ RISQUES.md ↔ BACKLOG.md

Le référentiel ISO v1.1 §5.2 liste 19 tâches de remédiation. Vérification croisée avec BACKLOG :

| Tâche référentiel | Statut BACKLOG actuel | Cohérent ? |
|-------------------|----------------------|-----------|
| TACHE-062 badge dégradé | **Terminé** | Désynchronisé — référentiel v1.1 mentionne *à livrer* |
| TACHE-074 transmission DPO | **À faire** dans BACKLOG **ALORS QUE** PR #82 mergée le 2026-04-19 | Désynchronisé — la note DPO T-074 v1.0 a été produite, T-074 doit être passée *Terminé* |
| TACHE-085/086/087/088/089/090/091 | **Terminés** | Désynchronisé — référentiel v1.1 ne reflète pas tous (note : v1.1 a déjà intégré T-085 à 091) |
| TACHE-093 purge `pending_*` | **Terminé** | Désynchronisé léger |
| TACHE-104 règle ESLint renforcée | **Terminé** | Désynchronisé |
| TACHE-115 confirmation DPO circuit | **À faire** **ALORS QUE** PR #82 mergée | Désynchronisé — T-115 doit être *Terminé* |

→ Mise à jour référentiel v1.1 → **v1.2** est due (cf. §3.2). Les statuts BACKLOG T-074 et T-115 sont à corriger immédiatement (passer à *Terminé*).

### 4.2 Cohérence Runbook ↔ AIPD M7 v1.2 ↔ Note DPO T-115

La procédure d'escalade DPO E1-E6 formalisée par T-115 est **alignée** avec le runbook §2.1 (DPO délégué Fabrique), §3.2 (règle de montée auto M7 = P0, DPO saisi systématiquement) et Step 7 + Template 6.5 (validation DPO obligatoire avant notification utilisateurs). Aucun écart bloquant. Recommandation : référencer explicitement la procédure E1-E6 dans la prochaine itération du runbook (v1.1 lors du premier tabletop T-113).

### 4.3 Cohérence STRIDE ↔ ADR ↔ INV-SEC

Vérification : tous les 5 INV-SEC (mini-DAT TACHE-061 §6bis) sont effectivement implémentés et testés. Tous les 5 R-BOOT (ADR-001) sont opposables en revue de code. Tous les 7 R-CLI (ADR-002) sont opposables. R-CLI-06 (IV frais) cohérent avec INV-SEC-01. R-CLI-07 (minimisation payload) cohérent avec INV-SEC-02 + R-074-01 (extension DPO). **Cohérence STRIDE / INV-SEC / R-BOOT / R-CLI complète sur le périmètre M7**.

### 4.4 Cohérence DAT v1.4 ↔ AIPD M7 v1.2

DAT v1.4 a été bumpé pour T-041 (algorithmes hachage FNV-1a vs SHA-256). Vérification AIPD §1.3 : le tableau des données traitées mentionne déjà la nature FNV-1a (whitelist M2) et SHA-256 + sel (M7 password_hash, domain_hash). **Cohérence acquise**. Aucune mise à jour AIPD requise à ce titre.

### 4.5 Cohérence audit GitHub T-116 ↔ T-112 ↔ référentiel ISO

L'audit GitHub T-116 (score 42/100, 4 Must + 6 Should) a produit 28 recommandations (REC-01 à REC-28). T-112 v1.1 enrichie (BACKLOG ligne 114) couvre désormais 100% des Musts (REC-04 résolu via T-121 LICENSE GPL-3.0 sur main, REC-05 branch protection, REC-13 audit historique git, REC-15/16/17 Dependency graph, REC-20 Private vulnerability reporting, REC-21/22 secret scanning + push protection). **Cohérence acquise**. Une fois T-112 exécutée, le référentiel ISO v1.2 pourra promouvoir A.5.32 (gestion droits propriété intellectuelle / licensing) en *Implémenté*.

### 4.6 Anomalie sémantique IDB store `m7_incidents` — non bloquante

Le store IndexedDB historiquement nommé `m7_incidents` héberge depuis T-085 aussi les incidents M2 (`whitelist_corrupted`/`whitelist_regenerated`). Cette dette sémantique est documentée dans le référentiel v1.1 §4.4 comme « non bloquante ISO, à renommer `incidents_v2` dans une migration IDB ultérieure ». Pas d'action requise v1.

---

## 5. Conformité ISO 27001 + RGPD + OWASP

### 5.1 Conformité ISO 27001:2022

8 contrôles initiaux + 4 contrôles à intégrer en v1.2 (A.5.15, A.8.4, A.8.10 dédiée, A.8.30) = **12 contrôles tracés** sur les ~40 applicables à un projet client-side. **Conformité boussole** au standard satisfaisante pour un projet OSS Exposé sans certification formelle. Maturité globale auto-évaluée : *Géré* sur 3 contrôles (A.5.24/26, A.8.8, A.8.16 partiel), *Défini* sur 4 contrôles, *Reproductible* sur le reste. Cible : 2 promotions vers *Optimisé* après tabletop T-113 (juillet 2026).

### 5.2 Conformité RGPD (coordination DPO)

- AIPD M7 v1.2 intégrée et user-friendly. Note DPO T-074 favorable sous 3 réserves (à lever — §3.1).
- Procédure d'escalade DPO E1-E6 formalisée — opérationnelle dès J+1 du premier incident M7 réel.
- Registre Art. 30 v1.0 (et v1.1 user-friendly) — cohérent avec runbook §8 (registre violations).
- Politique de confidentialité v1.1 user-friendly publiée.
- Droits Art. 15/17/20 implémentés (export, effacement, accès).
- Aucune télémétrie, aucun transfert hors UE, aucun sous-traitant.
- **Réserves restantes** : 3 R-074-XX bloquants MEP (§3.1).

### 5.3 Conformité OWASP

- **OWASP Top 10 2021** : A01 (broken access control) couvert par CSP stricte + permissions minimales + WAR resserré T-028 ; A02 (crypto failures) couvert par AES-256-GCM + INV-SEC-01 + R-CLI-06 ; A03 (injection) couvert par `textContent` + ESLint no-restricted-properties + INV-SEC-02 ; A05 (security misconfiguration) couvert par audit T-116 + T-118/119/120 ; A06 (vulnerable components) couvert par SBOM + Dependabot ; A08 (software integrity failures) couvert par SHA pinning T-118 + SBOM SHA-pinned T-120 ; A09 (logging failures) couvert par registre incidents + INV-SEC-03/04 + factory logger T-083.
- **OWASP ASVS 4.0** : V14.4 (file/resource access) couvert par T-028 ; V6 (cryptography) couvert par INV-SEC + ADR-001/002 ; V7 (error/logging) couvert par CM-ID1-4 + factory logger.
- **CWE Top 25** : CWE-79 (XSS) — N/A pas d'`innerHTML` ; CWE-323 (nonce reuse) — INV-SEC-01 + R-CLI-06 ; CWE-502 (deserialization) — R-CLI-02 + JSON-strict ; CWE-532 (sensitive info logging) — INV-SEC-02 + factory logger ; CWE-668 (resource exposure) — T-028 ; CWE-755 (improper exception handling) — ADR-001 R-BOOT-01/02 ; CWE-829 (untrusted control sphere) — T-118 + T-120 ; CWE-252 (unchecked return) — R-BOOT-01.

### 5.4 Postulat « pas de mesure par défaut »

Vérification des choix sécurité : chaque mesure dispose d'une justification documentée (ADR, mini-DAT, INV-SEC, RISQUES). Aucune mesure non opposable détectée.

---

## 6. Risques résiduels (synthèse)

| ID | Source | Sévérité | Statut | Action requise |
|----|--------|----------|--------|----------------|
| R-074-01 / 02 / 03 | Note DPO T-074 | **Bloquant MEP** | **À tracer au BACKLOG** | T-158/159/160 proposées (§3.1) |
| R-MIN-002 (à créer) | T-028 mergée | Faible (2/4) | À documenter | Ajout RISQUES.md (§3.3) |
| R-119-01 | Hotfix dependabot | Modéré (6/16) | **À mitiger** | Cadence revue manuelle trimestrielle `npm audit` à instaurer (§3.4) |
| R-112-01 / 02 | Préparation passage public | Modéré (6/16) / Faible (4/16) | Mitigé/Accepté | Couvert par checklist T-112 (§3.5) |
| R-003 | Clé AES en `chrome.storage.local` | Limite structurelle MV3 | **Accepté** | Documenté |
| R-005 / R-009 / R-010 / R-011 / R-013 / R-014 / R-015 / R-016 / R-017 | Risques techniques mineurs RT-001 à 010 | Faible | Ouvert | Suivi BACKLOG, non bloquant |
| R-CLI-XX, R-ADR-XX | Patterns ADR | Tous Résolus | OK | Vigilance maintenue en revue de code |

**Aucun risque critique non mitigé.** Aucun risque imposant une remontée arbitrage Commanditaire au-delà de la décision T-112 (déjà prise — passage public planifié).

---

## 7. Recommandations

### 7.1 Actions immédiates (avant ouverture session 2026-04-20)

1. **Tracer R-074-01/02/03 au BACKLOG comme T-158/159/160** — Must, P5, bloquant MEP. Voir §3.1.
2. **Créer R-MIN-002 dans RISQUES.md** — entrée 1 ligne consignant l'acceptation du risque résiduel post T-028.
3. **Corriger statuts BACKLOG T-074 et T-115 → *Terminé*** — désynchronisation post-merge PR #82 (cohérence §4.1).
4. **Créer R-118-01 / R-119-01 / R-120-01 dans RISQUES.md** — risques résiduels supply-chain (§3.4). R-119-01 prioritaire (modéré 6/16).
5. **Créer R-112-01 / R-112-02 / R-112-03 dans RISQUES.md** — risques liés au passage public, à mitiger par exécution complète T-112.

### 7.2 Bumps documentaires à programmer (session 2026-04-20+)

6. **Bump référentiel ISO v1.1 → v1.2** — TACHE à créer (T-161 proposée), Should, P5 — intégrer T-028 (A.5.15+A.8.4), T-118 (A.8.30), T-119, T-120 (A.8.10 dédiée), T-074/115 (procédure E1-E6 dans §4.8). Effort ≈ 1h30.
7. **Bump AIPD M7 v1.2 → v1.3** post-livraison T-158/159/160 — TACHE à créer (T-162 proposée), Should, P5 — mention TTL 365 j et exclusion Art. 20 (réserves DPO levées). Effort ≈ 30 min.
8. **Bump Runbook v1.0 → v1.1** post-premier tabletop (T-113, juillet 2026) — référencer la procédure E1-E6 + scénarios joués + leçons capitalisées.

### 7.3 Mesures défense en profondeur à instaurer

9. **Cadence revue manuelle `npm audit` trimestrielle** (R-119-01) — calendaire avril/juillet/octobre/janvier, à inscrire dans `OUTILS.md` ou créer un rituel projet. Effort 30 min / trimestre.
10. **Préparer le tabletop T-113** dès maintenant — choisir scénario (XSS UC-06 par défaut, alternative compromission supply-chain via dependency typosquatting), préparer le journal d'incident simulé, mobiliser DPO Fabrique à J+24h selon E1.

### 7.4 Posture sécurité au passage public T-112

11. **Activer immédiatement après bascule public** : Private vulnerability reporting (REC-20), Branch protection rules `main` + `develop` avec required status checks `quality` + `e2e` (REC-05), Secret scanning + push protection (REC-21/22).
12. **Déclencher audit historique git via `truffleHog`** **avant** la bascule (T-112 point 3 déjà prévu) — non négociable, vérification finale absence secrets historiques.
13. **Surveiller le canal Security Advisories J+1 à J+30** — premier mois post-bascule = période sensible (curiosité scanners + chercheurs sécurité). Mobiliser le runbook au moindre rapport.

### 7.5 Cibles de maturité ISO à 6 mois

14. **A.5.24/A.5.26 — Promotion *Géré* → *Optimisé*** — conditionnée à T-113 (premier tabletop juillet 2026) + capitalisation écarts en LL + bump runbook v1.1.
15. **A.8.16 — Monitoring *Partiel* → *Défini* complet** — atteint dès que les 7 modules ont leurs `diagnostics.<module>` (déjà le cas) + page utilisateur état de santé (T-109) + badge dégradé (T-062 Terminé).
16. **A.8.28 — Secure coding *Reproductible* → *Défini*** — conditionné à activation CodeQL T-108 (post T-112).

---

**Conclusion** : la posture sécurité du projet est **solide et défendable** pour la release v1 et pour le passage public OSS planifié. **Trois actions sont incontournables avant MEP** : levée des 3 réserves DPO R-074-01/02/03 (§3.1), création de R-MIN-002 + R-119-01 dans RISQUES.md (§3.3, §3.4), bump référentiel ISO v1.2 (§3.2). Aucune objection à la poursuite du flux. Avis favorable sous réserve d'exécution des recommandations 1 à 5 de §7.1 avant la prochaine session de travail.

**Soumis au référent qualité** pour contrôle qualité interne avant consolidation par l'orchestrateur dans la PR globale « Revues Fabrique ».
