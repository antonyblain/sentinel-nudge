# Revue Fabrique 2026-04-19 — Synthèse consolidée

**Date** : 2026-04-19
**Demandeur** : Commanditaire — « chaque rôle de la fabrique fasse une revue complète de son périmètre et vérifie la cohérence avec les actions en attente / en cours »
**Méthode** : 9 agents Fabrique en parallèle (2 vagues), brief standard à 7 sections (bilan, périmètre couvert, manquant, cohérence, conformité, risques, recommandations).
**Livrables** : 9 rapports individuels (`01-…` à `09-…`) + cette synthèse (`00-…`).

---

## Bilan global

**Maturité projet** : élevée. 29 PR mergées la veille + 5 PR mergées matinée du 19/04 + 4 en attente auto-merge. **897/897 tests verts**, supply-chain durcie, repo public OSS opérationnel, conformité RGPD complète, design system v2 intégré. Aucun risque critique non mitigé.

**Score audit GitHub estimé** (DevSecOps) : **42/100 → ~83/100 (Niveau A)** post-T-112/T-118/T-119/T-120/T-129/T-130.

**Anomalies identifiées** : essentiellement documentaires (cohérence inter-livrables, classement, versioning), pas fonctionnelles. **8 bloquantes (Réf. qualité)** + écarts cross-rôles à arbitrer.

---

## Tableau de bord par rôle

| # | Rôle | Verdict | Anomalies bloquantes | Recommandations |
|---|---|---|---|---|
| 01 | Analyste métier | ✅ Solide, 2 écarts SFD | 1 (E-AM-02 SFD obsolète vs UC P5) | T-159, T-160 (E-AM-01 invalidé après vérification) |
| 02 | Architecte logiciel | ✅ Stack solide, 3 gaps cosmétiques | 0 | DAT v1.5 (Annexe B WAR + CRITICAL_MODULES + ADR-002 M5/M6/M17) |
| 03 | Architecte sécurité | ✅ Posture *Géré*, 3 écarts MEP | 3 (réserves DPO non tracées, R-MIN/119/112-* absents, ISO v1.2 dû) | T-RS-01 à 05 |
| 04 | DPO | ⚠️ 3 livrables vus comme manquants (en réalité livrés autrement, à clarifier) + 3 désynchros durées | 3 désynchros + M9 absent politique | R-DPO-01 à 04, AIPD v1.3, politique v1.2 |
| 05 | Référent qualité | ⚠️ 8 anomalies bloquantes (versioning + classement + cohérence) | 8 (A-01 à A-08) | T-RQ-001 à 010 |
| 06 | Testeur QA | ⚠️ 4 lacunes Must, 2 fichiers couverture déficit | 4 (T-027/059/060/063 + popup/password-detector ~20% lignes) | Plan tests + scénarios TC-M7 |
| 07 | Expert accessibilité | ✅ T-132/133 OK, T-145 audit manuel manquant | 1 (T-145 audit manuel popup/dashboard/options/onboarding) | Audit + tests NVDA + archivage axe-core |
| 08 | Expert UX/UI | ✅ Design system v2 propre, 3 anomalies cosmétiques | 0 (3 cosmétiques) | T-143 close, T-149 caduc, double déclaration tokens.css à nettoyer, T-144 icônes v2 |
| 09 | Intégrateur DevSecOps | ✅ CI/CD + supply-chain conformes | 0 | Score audit ~83/100, T-108 CodeQL planifiable |

---

## Cohérences et écarts cross-rôles

### ✅ Cohérences confirmées
- **Stack package.json ↔ DAT Annexe A** (Archi log) : alignement parfait sur 10 deps clés.
- **DAT §17 FNV-1a vs SHA-256 ↔ code `hash.ts`** (Archi log) : exact, frontière respectée.
- **ADR-001 SW-BOOT-CONTRACT** appliqué sur M2/M5/M6 dans le code (Archi log).
- **Tokens.css v2 ↔ pages popup/dashboard/options/onboarding** (UX/UI) : import correct, anti-FOUC OK.
- **CRITICAL_MODULES** (M2/M7/M17) cohérent code ↔ post-mortem (Archi log).

### ❌ Écarts cross-rôles à arbitrer

**E-CROSS-01 — DAT v1.4 référence SFD v1.0 obsolète** (Réf. qualité A-06)
Confirmation cross : Archi log voit la même chose en relisant l'en-tête. Action : T-RQ-003.

**E-CROSS-02 — AIPD M7 v1.2 référence DAT v1.3 obsolète** (Réf. qualité OBS-04 + DPO)
Action : à corriger au prochain bump AIPD v1.3.

**E-CROSS-03 — DAT Annexe B vs manifest réel** (Archi log Gap 1, Réf. qualité non détecté)
WAR théorique = `[]`, WAR réel post-T-028 = 2 entrées. Bumper DAT v1.5.

**E-CROSS-04 — Audit T-010 figé pré-T-132/T-133** (Réf. qualité A-07 + Expert a11y confirmé)
Bumper checklist en v1.1.

**E-CROSS-05 — Module M9 absent politique RGPD v1.1** (DPO)
RT-M9 existe dans le registre mais §3 politique l'omet. Défaut Art. 13.1.c. Politique v1.2 à produire.

**E-CROSS-06 — Désynchro durées de conservation** (DPO)
3 cas : `weekly_scores` (politique 52w vs registre 90j), `quiz_sessions` (politique 90j vs registre durée install), `pending_*` (politique vs absent registre).

**E-CROSS-07 — Statut BACKLOG vs livrable réel** (Réf. qualité A-BAC-01/02/03/04)
- T-041 "À faire" alors que DAT v1.4 §17 produit (PR #87 mergée) → corrigé dans PR #90 en attente
- T-155 "À faire" alors que registre v1.1 livré (PR #82 mergée) → corrigé dans PR #90
- T-063 partiellement livré via plan tests v1.0 (PR #34) → préciser périmètre résiduel
- T-143 "À faire" alors que tokens v2 intégrés (UX/UI) → à passer Terminé

**E-CROSS-08 — DPO voit T-074/T-115/T-155 comme non livrés** (DPO)
**Confusion à clarifier** : T-074/T-115/T-155 SONT livrés dans `docs/rgpd/note-dpo-*.md` et `registre-des-traitements-v1.1.md` (PR #82 mergée à 08:34:54Z). L'agent DPO actuel n'a probablement pas vu les fichiers car nommés différemment de ce qu'il attendait dans `docs/rgpd/`. Vérifier la cohérence ; les fichiers existent, sont versionnés, et la PR est mergée.

**E-CROSS-09 — Réserves DPO bloquantes MEP non tracées** (Archi sécu confirmé par DPO)
T-074 contient 3 réserves R-074-01/02/03 (registre m7_incidents : absence domain_hash brut, TTL 365j, exclusion export Art. 20). Ces 3 réserves sont **bloquantes pour MEP** mais ne sont pas tracées comme tâches dans le BACKLOG.

---

## Plan d'action consolidé

### 🔴 MUST (à traiter avant clôture session 2026-04-19 ou prochaine session)

| ID | Source | Titre | Responsable | Effort |
|----|--------|-------|-------------|--------|
| T-160 | Réf. qualité T-RQ-002 + DPO | Supprimer fichiers obsolètes (DAT v1.3, AIPD M7 v1.0+v1.1, politique RGPD v1.0) | Orchestrateur | 5 min |
| T-161 | Réf. qualité T-RQ-003 + Archi log | Corriger référence SFD v1.0→v1.1 + Annexe B WAR + CRITICAL_MODULES dans DAT v1.4 → bump v1.5 | Archi log | 30 min |
| T-162 | Réf. qualité T-RQ-004 + Expert a11y | Bumper checklist a11y T-010 v1.0→v1.1 (T-132/T-133 résolus, taux conformité actualisé) | Expert a11y | 15 min |
| T-163 | Réf. qualité T-RQ-005 | Capitaliser LL-029 absente (saut LL-028→LL-030) | Orchestrateur | 15 min |
| T-164 | Archi sécu E-CROSS-09 | Tracer 3 réserves DPO R-074-01/02/03 comme tâches dérivées au BACKLOG | Orchestrateur | 10 min |
| T-165 | DPO E-CROSS-05 | Politique RGPD v1.2 ajout module M9 + résorption 3 désynchros durées conservation | DPO | 1h |
| T-166 | Archi sécu | Référentiel ISO 27001 v1.1→v1.2 (intégrer T-028 A.5.15+A.8.4, T-118 A.8.30, T-120 A.8.10, T-074/T-115 procédure E1-E6) | Archi sécu | 45 min |
| T-167 | Analyste métier T-159 | SFD v1.2 intégrer UC-01 à UC-15 + 3 ARB structurants | Analyste métier | 2h |
| T-168 | Expert a11y | Audit a11y manuel popup + dashboard + options + onboarding (états dynamiques, ordre focus, annonces SR) — débloque conformité RGAA 4.1 P7 | Expert a11y | 2h |
| T-169 | DPO | AIPD M7 v1.3 après livraisons T-074/T-115 + ajout TTL 365j optionnelle sur m7_incidents | DPO | 1h |

### 🟡 SHOULD (à traiter session courante ou suivante)

| ID | Source | Titre |
|----|--------|-------|
| T-170 | Réf. qualité T-RQ-006 | Déplacer mini-DAT P5 hors `docs/p4-conception/` (créer `docs/p5-decisions/`) |
| T-171 | Réf. qualité T-RQ-007 | Normaliser noms fichiers `docs/securite/` (ajouter version) + matrice providers |
| T-172 | Réf. qualité T-RQ-008 | Enrichir FICHIERS.md avec `docs/securite/`, `docs/adr/`, `docs/rgpd/`, `docs/accessibilite/`, `docs/p5-recette/` |
| T-173 | Analyste métier T-160 | Plan tests manuels v1.1 référencement croisé CA-Mxx-YY |
| T-174 | Archi sécu | Cadence revue manuelle `npm audit` trimestrielle (compense ignore majors dependabot) |
| T-175 | Testeur QA | TACHE-027 tests E2E UC-01 à UC-05 réels (UC-06 déjà E2E) — débloque release v1 |
| T-176 | Testeur QA | TACHE-059 12 scénarios TC-M7-01 à 12 + 5 scénarios comité TACHE-082 |
| T-177 | Testeur QA | TACHE-060 Mock chrome.storage JSON-strict (élimine masques d'erreurs sérialisation) |
| T-178 | Testeur QA | TACHE-063 PV recette template (PASS/FAIL/BLOQUE signé) |
| T-179 | Testeur QA | Renforcer couverture password-detector.ts (19% → ≥60%) + popup.ts (28% → ≥60%) |
| T-180 | Expert a11y | Tests NVDA archivés + sortie axe-core T-150 archivée fichier (pas seulement stdout CI) |
| T-181 | UX/UI | Nettoyer double déclaration `--sn-color-accent` dans `tokens.css` `@media dark` |
| T-182 | UX/UI | T-144 icônes extension v2 alignées palette T-141 |
| T-183 | Archi log | ADR-002 CROSS-LIFECYCLE-INTENT à appliquer sur M5/M6 (Should pour release publique) |
| T-184 | Archi log | Mini-DAT TACHE-062 (badge dégradé) + TACHE-091 (E-CLI-01) |
| T-185 | Archi log | Externaliser ADR-003 à ADR-008 du corps DAT en fichiers `docs/adr/adr-XXX-*.md` autonomes |

### 🟢 COULD

| ID | Source | Titre |
|----|--------|-------|
| T-186 | Réf. qualité T-RQ-010 | Capitaliser bug "checkout sur mauvaise branche" en LL-XXX (constaté 2× en session 2026-04-19) |
| T-187 | DevSecOps + Archi sécu | T-108 CodeQL SAST en CI (gratuit en public, ~2h) |
| T-188 | DevSecOps + Archi log | T-105 migration logger content scripts (29 sites résiduels) |
| T-189 | Archi log | ADR-002 sur M17 (Could) |

### ❌ À CLORE / INVALIDER

| Tâche | Raison |
|-------|--------|
| ~~T-149~~ | Aurora écarté par T-141 — backdrop-filter Aurora caduc, fermer |
| ~~T-130 (d)~~ | Doc secrets-cws.md différée (post-roadmap CWS planifiée) |
| ~~E-AM-01 (Analyste)~~ | Quiz-corpus contient bien 50 questions (vérifié `grep '"id":"phish-' = 50`), agent s'est trompé |
| ~~T-052~~ | Configuration coverage déjà effective dans vite.config.ts (DevSecOps) — passer Terminé |

### ⚖️ ARBITRAGES COMMANDITAIRE REQUIS

1. **T-170 emplacement P5** : créer `docs/p5-decisions/` (proposition Réf. qualité) ou utiliser `docs/p5-tests-unitaires/` existant (FICHIERS.md actuel) ?
2. **T-167 priorité SFD v1.2** : Must (Analyste métier) ou Should ? Impact sur recette P7 (référence contractuelle).
3. **T-175 priorité E2E UC-01 à UC-05** : Must avant release v1 (Testeur QA propose) ou recette manuelle suffisante ?
4. **T-187 CodeQL** : Could (DevSecOps) ou activer maintenant que repo public ?

---

## Statut session 2026-04-19 matinée — récapitulatif

### Mergées (8 PR)
| PR | Tâche | Mergée |
|----|-------|--------|
| #81 | T-157 popup finitions + hotfix axe-core | 08:21 |
| #87 | T-041 DAT v1.4 FNV-1a vs SHA-256 | 08:28 |
| #84 | Dependabot ws + playwright-crx | 08:31 |
| #82 | T-074 + T-115 + T-155 docs DPO | 08:34 |
| #83 | Dependabot actions group | 08:37 |
| #92 | T-134/T-135/T-136 pages statiques a11y | 08:41 |

### Auto-merge actif (4 PR — cycle update-branch en cours)
- #80 T-120 SBOM Anchore SHA-pinned
- #90 chore session MAJ memoire
- #91 T-028 web_accessible_resources resserré
- #93 hotfix dependabot ignore majors stricts

### Fermées (2 PR)
- #86 Dependabot vite/vitest majors (breaking)
- #89 Dependabot 8 dev-deps majors (breaking)

### Tâches livrées hors PR
- **T-112** repo PUBLIC via CLI (10 étapes contrôlées)
- **T-130 a/b/c** topics + Discussions + DCO via CLI

---

## Mémoire enrichie cette session
- `feedback_confiance_controle.md` (principe Commanditaire « confiance n'exclut pas contrôle »)
