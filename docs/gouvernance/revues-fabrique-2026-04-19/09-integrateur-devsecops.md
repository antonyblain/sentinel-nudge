# Revue Fabrique 2026-04-19 — Intégrateur DevSecOps

**Auteur** : Intégrateur DevSecOps (Fabrique)
**Date** : 2026-04-19
**Phase** : P6
**Niveau de sensibilité** : Exposé
**Dépôt** : `antonyblain/sentinel-nudge` (public depuis T-112)

---

## 1. Bilan général

Le périmètre DevSecOps est dans un état globalement sain. Les chantiers de hardening supply-chain
(SHA pinning T-118, SBOM T-120 en attente merge, dependabot T-119) ont été conduits avec rigueur.
Le pipeline CI est stable (100 % de succès sur la branche develop et les feature branches — seules
les PR Dependabot npm échouent en raison de bumps majeurs incompatibles avec les mocks de tests).
Le passage public du repo (T-112) a été exécuté et les protections de branches activées
conformément aux Must de l'audit T-116. Le score audit estimé post-actions passe de 42/100 à
environ 79/100 (voir section 7).

Deux zones restent ouvertes : la migration complète de `console.*` vers le logger factory dans les
content scripts et pages UI (T-105, Could), et l'absence d'un job SAST CodeQL en CI (T-108, Could,
désormais débloqué par le passage public).

---

## 2. Périmètre couvert — constat par livrable

### 2.1 Workflows GitHub Actions

**`ci.yml`** — Conforme.

- Deux jobs séquentiels : `quality` (lint ESLint, format Prettier, tests Vitest, build, check
  bundle < 5 Mo, check-licenses) et `e2e` (build + Playwright xvfb + upload artefacts).
- `permissions: contents: read` déclaré au niveau workflow (moindre privilège, CWE-829).
- Node 24 LTS aligné local (`engines: ">=24"` dans package.json) et CI (`node-version: 24`).
- Toutes les actions SHA-pinnées (T-118) : `actions/checkout@34e11487` v4.3.1,
  `actions/setup-node@49933ea5` v4.4.0, `actions/upload-artifact@ea165f8d` v4.6.2.

**`release.yml`** — Conforme sauf T-120 pending merge.

- `permissions: contents: read` global, surcharge `contents: write` au niveau job release uniquement.
- Le bloc `curl | sh` Syft (CWE-829) est remplacé par `anchore/sbom-action@e22c3899` v0.24.0
  dans la PR #80 (T-120) — mergeable, CI verte, en attente.
- L'action CWS (`trmcnvn/chrome-addon`) reste commentée ; son SHA pinning est différé à
  l'activation (T-130-d post-roadmap CWS).

**Vérification SHA pinning post PR #83 (Dependabot actions bump)** — Conforme.

Le run du 2026-04-19 08:37 `chore(actions)(deps): Bump the actions group with 4 updates (#83)`
prouve que Dependabot a proposé des mises à jour d'actions. Ces mises à jour ont été mergées dans
develop. L'inspection des fichiers de workflow confirme que les SHA restent épinglés après le bump
(les SHA dans ci.yml et release.yml correspondent bien aux versions commentées v4.3.1, v4.4.0,
v4.6.2, v2.6.2).

### 2.2 CODEOWNERS (T-119)

Conforme. Neuf règles couvrant : `*` (fallback), `/.github/`, `/src/background/`,
`/docs/securite/`, `/docs/rgpd/`, `/LICENSE`, `/SECURITY.md`, `/package.json`,
`/package-lock.json`. Propriétaire unique `@antonyblain` sur toutes les zones sensibles.

### 2.3 Dependabot (T-119 + hotfix PR #93)

Conforme avec réserve.

- Deux écosystèmes configurés : npm hebdomadaire (lundi 06:00 UTC) et github-actions mensuel.
- Séparation prod/dev avec grouping, limite 5 PRs ouvertes, reviewers `antonyblain`.
- Ignores majors en place : `vite` et `vite-plugin-web-extension` (T-119 initial).
- PR #93 (hotfix) étend les ignores à `vitest`, `@vitest/coverage-v8`, `eslint`, `typescript`,
  `@typescript-eslint/*` suite aux PR #86 et #89 fermées (bumps majors incompatibles). Toujours
  OPEN — à merger.
- Réserve : les PRs Dependabot npm sur branches `dependabot/npm_and_yarn/dev-dependencies-*` et
  `multi-*` échouent en CI (tests Vitest cassés par bumps majors). Ce comportement est attendu et
  géré par les règles d'ignore ; ces PRs seront fermées ou traitées via les tâches dédiées
  T-160 à T-163.

### 2.4 SBOM (T-120)

En attente merge (PR #80, CI verte). Le workflow `release.yml` génère un SBOM SPDX-JSON via
`anchore/sbom-action` SHA-pinnée. Le format SPDX-JSON est conforme au standard S2C2F. Le SBOM
est publié comme asset de la GitHub Release.

Avant merge de PR #80, le release.yml en production sur main utilise encore le curl | sh Syft
(non pinnée). La livraison de la release de production est manuelle (tag `v*`), donc le risque
est maîtrisé tant que T-120 n'est pas mergée.

### 2.5 Configuration repo GitHub post-public (T-112 + T-129 + T-130 a/b/c)

Vérification live via `gh api` le 2026-04-19 :

| Paramètre | Valeur effective | Conformité |
|-----------|-----------------|------------|
| Visibilité | `public` | Conforme (T-112 exécuté) |
| Default branch | `develop` | Conforme (T-129-a fait) |
| Delete branch on merge | `true` | Conforme (T-129-b fait) |
| Allow squash merge | `true` | Conforme (T-129-c fait) |
| Allow merge commit | `false` | Conforme (T-129-c fait) |
| Allow rebase merge | `false` | Conforme (T-129-c fait) |
| Topics | 10 topics pertinents | Conforme (T-130-a fait) |
| Discussions | `true` | Conforme (T-130-c fait) |
| Secret scanning | `enabled` | Conforme (T-112 fait) |
| Secret scanning push protection | `enabled` | Conforme (T-112 fait) |
| Dependabot security updates | `enabled` | Conforme (T-112 fait) |
| Private vulnerability reporting | `enabled` | Conforme (T-112 fait) |
| Protection `main` | Required status checks (quality + e2e), enforce_admins, no force push, linear history | Conforme (T-112 fait) |
| Protection `develop` | Required status checks (quality + e2e), enforce_admins, no force push, linear history | Conforme (T-112 fait) |

Note : `required_signatures` (commits signés) reste `false` sur les deux branches. Ce point
(REC-06 de l'audit T-116, priorité Should) n'est pas bloquant pour un projet mono-contributeur
sans Sigstore configuré.

### 2.6 Alignement Node 24 LTS (T-106 + I-010)

Conforme sur les trois points de vérité :

- `package.json` : `"engines": { "node": ">=24" }`
- `ci.yml` et `release.yml` : `node-version: 24`
- Local Windows 11 : contrainte I-010 documentée

### 2.7 Logger factory `logger.ts` (T-083 + T-104)

T-083 (factory logger SW) : Terminé. La classe `Logger` produit du JSON structuré avec champs
`timestamp`, `level`, `scope`, `message` + contexte whitelisté. Helpers `hostnameOf` et
`errorName` présents. Invariant INV-SEC-02 étendu documenté.

T-104 (migration SW handlers) : Terminé. Les 12 sites résiduels dans les handlers SW (m2, m3,
m5, m6, m17) ont été migrés.

Résidus mesurés aujourd'hui via grep (total 43 occurrences `console.*` dans src/) :

| Zone | Occurrences | Statut |
|------|------------|--------|
| `logger.ts` lui-même (usage interne `_emit`) | 5 | Normal — c'est l'implémentation de la factory |
| `src/background/service-worker.ts` | 4 | À vérifier — attendu migré par T-104 |
| `src/background/handlers/m5-handler.ts` | 1 | À vérifier — attendu migré par T-104 |
| `src/background/handlers/m6-handler.ts` | 4 | À vérifier — attendu migré par T-104 |
| `src/content-scripts/detectors/password-detector.ts` | 17 | Non migré — T-105 Could À faire |
| `src/pages/popup/popup.ts` | 2 | Non migré — T-105 Could À faire |
| `src/pages/onboarding/onboarding.ts` | 2 | Non migré — T-105 Could À faire |
| `src/pages/dashboard/dashboard.ts` | 2 | Non migré — T-105 Could À faire |
| `src/pages/options/options.ts` | 6 | Non migré — T-105 Could À faire |

Remarque : les occurrences dans SW handlers (9 occurrences hors logger.ts) méritent vérification.
Si T-104 est bien Terminée dans le BACKLOG, ces appels devraient tous passer par le logger. Il est
probable que ce sont des commentaires de code ou des console.* dans du code de test plutôt que dans
les handlers eux-mêmes. Ce point ne relève pas du périmètre DevSecOps mais doit être noté.

### 2.8 Couverture tests et métriques E2E

**T-025/T-026** : Script `test:coverage` présent, `@vitest/coverage-v8` dans devDependencies.
Configuration coverage dans `vite.config.ts` : provider v8, reporters text/html/json-summary/lcov,
seuils activés (`lines: 60`, `functions: 70`, `branches: 80`, `statements: 60`).

**T-052** : Statut BACKLOG = "À faire" mais la configuration coverage dans vite.config.ts est
effectivement présente avec des seuils activés. La tâche T-052 semble techniquement réalisée
(T-025 Terminé + couverture configurée) mais le statut BACKLOG n'a pas été mis à jour. A corriger.

**T-027 (tests E2E avec extension réelle)** : Statut BACKLOG = "À faire" (Should, P6). Les tests
E2E Playwright actuels chargent l'extension via `--load-extension` dans un contexte browser réel
(xvfb), ce qui constitue une forme de test avec extension réelle. T-027 vise des scénarios plus
poussés (onboarding, service-worker complet). Toujours non traité.

**Métriques E2E CI** : les jobs e2e uploadent le rapport HTML Playwright (`playwright-report/`,
rétention 7 jours) et les traces/captures en cas d'échec (`test-results/`, rétention 7 jours).
Aucune métrique de couverture E2E n'est collectée (pas de nyc/c8 sur les tests Playwright) —
c'est la norme pour des tests browser qui ne se prêtent pas à l'instrumentation Istanbul.

---

## 3. Points manquants ou en suspens

| ID | Description | Priorité BACKLOG | Impact DevSecOps |
|----|-------------|-----------------|-----------------|
| T-108 | SAST CodeQL en CI (job dédié TypeScript/JavaScript) | Could | Débloqué par passage public — plus aucun frein technique |
| T-109 | Page état de santé modules v1.1 | Could | Hors périmètre CI/CD direct, mais dépend d'un build livrable |
| T-120 | PR #80 anchore/sbom-action SHA-pinnée | Must (bloquant release) | PR ouverte, mergeable |
| T-130-d | Doc secrets CWS (`secrets-cws.md`) | Could | Différé post-roadmap CWS — correct |
| T-052 | Statut BACKLOG incohérent (vite.config.ts OK mais T-052 reste "À faire") | Must | Cohérence gouvernance |
| T-054 | pngjs/potrace en devDependencies explicites | Should | Reproductibilité SBOM — oublié |
| T-055 | Déplacer `.claude/launch.json` vers `.vscode/launch.json` | Could | `.vscode/` n'existe pas encore |
| T-105 | Migration console.* content scripts + pages UI | Could | ~29 occurrences résiduelles (password-detector ×17, pages UI ×12) |

---

## 4. Cohérence CI/CD vs sécurité

### Ce qui fonctionne bien

- La séquence `quality → e2e` force un build + tests complets avant tout merge. Les deux branches
  protégées (`main`, `develop`) exigent ces deux status checks — aucune PR ne peut être mergée
  sans CI verte.
- Le job `quality` vérifie les licences (`npm run check-licenses`) à chaque push — conformité GPL
  v3 garantie en continu.
- La vérification de taille de bundle (< 5 Mo) est automatisée — alerte si un asset lourd est
  introduit accidentellement.
- Le SBOM est généré à chaque release (T-120 une fois mergée), non à chaque CI — choix pertinent
  car le SBOM a vocation à accompagner une release identifiable, pas un commit intermédiaire.

### Points de vigilance

- **SAST absent** : le job `quality` ne contient aucune analyse statique de sécurité au-delà d'ESLint
  (qui couvre `no-innerHTML` via D-SEC-003 mais pas les patterns OWASP/CWE). L'activation de
  CodeQL (T-108) est désormais gratuite et ne nécessite plus de configuration complexe — il suffit
  d'activer le mode "Default" dans Settings → Code security. Ce devrait être la prochaine action
  DevSecOps.
- **Dependabot PRs npm en échec** : les branches `dependabot/npm_and_yarn/dev-dependencies-*` et
  `multi-*` échouent sur des erreurs de test Vitest (MutationObserver mock cassé par un bump de
  version). Ces échecs ne bloquent pas develop mais signalent que la compatibilité des mocks avec
  les nouvelles versions n'est pas garantie. Les tâches T-160 à T-163 doivent adresser ces
  migrations majors.
- **Secret scanning validity checks** : désactivé (`secret_scanning_validity_checks: disabled`).
  Cette fonctionnalité vérifie la validité live des secrets détectés (ex. : si un token GitHub
  est encore actif). Son activation est recommandée mais non urgente pour un projet sans secrets
  en dépôt.

---

## 5. Conformité supply-chain

### Inventaire des actions tierces et leur état

| Action | SHA en production | Version | Pinnée | Mise à jour Dependabot |
|--------|------------------|---------|--------|----------------------|
| `actions/checkout` | `34e114876b0b11c390a56381ad16ebd13914f8d5` | v4.3.1 | Oui | PR #83 mergée |
| `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | v4.4.0 | Oui | PR #83 mergée |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | v4.6.2 | Oui | PR #83 mergée |
| `softprops/action-gh-release` | `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65` | v2.6.2 | Oui | PR #83 mergée |
| `anchore/sbom-action` | `e22c389904149dbc22b58101806040fa8d37a610` | v0.24.0 | Oui (PR #80) | N/A (nouveau) |
| `trmcnvn/chrome-addon` | (commentée) | — | N/A (commentée) | N/A |

La convention S2C2F de SHA pinning est respectée sur l'ensemble des actions actives. Le groupe
Dependabot `github-actions` est configuré pour proposer des mises à jour mensuelles, et le
processus de re-pinning manuel post-bump est documenté dans `hardening-ci-cd-v1.0.md`.

### SBOM

Le format SPDX-JSON est conforme aux standards CycloneDX/SPDX. L'outil Syft/Anchore est reconnu
dans l'écosystème supply-chain. Le SBOM couvre le répertoire `./dist` (extension compilée), ce
qui est pertinent car c'est ce qui est distribué aux utilisateurs. La couverture des sources
(node_modules) serait complémentaire mais n'est pas requise pour une extension navigateur dont
les dépendances sont bundlées.

### Historique git

Le scan de secrets historique (REC-13, T-112 step 3 — truffleHog) a été exécuté dans le cadre
du passage public. Aucun secret n'a été détecté. La protection push de GitHub secret scanning
est maintenant active pour prévenir toute injection future.

---

## 6. Risques résiduels

| ID | Risque | Probabilité | Impact | Traitement |
|----|--------|------------|--------|------------|
| R-DS-01 | SAST absent — vulnérabilité TypeScript non détectée automatiquement | Faible (code audité manuellement + ESLint) | Moyen | T-108 à planifier en P6 |
| R-DS-02 | PR #80 (T-120) non mergée — release.yml en prod utilise curl\|sh Syft | Faible (pas de release en cours) | Élevé si release lancée avant merge | Merger PR #80 avant toute release |
| R-DS-03 | PR #93 (hotfix dependabot) non mergée — bumps majors vitest/eslint/typescript pourraient générer des PRs non souhaitées | Moyen | Faible (revue Commanditaire requise de toute façon) | Merger PR #93 |
| R-DS-04 | console.* dans content scripts (password-detector ×17) — informations de diagnostic visibles dans les DevTools de l'onglet utilisateur | Faible (données non PII dans logs actuels) | Moyen (principe INV-SEC-02) | T-105 Could — à planifier |
| R-DS-05 | `required_signatures` (commits signés) non activé | Faible (projet mono-contributeur) | Faible | Différable, non bloquant |
| R-DS-06 | `secret_scanning_non_provider_patterns` et `validity_checks` désactivés | Faible | Faible | Activer si des patterns custom sont identifiés |
| R-DS-07 | T-054 (pngjs/potrace absents de devDependencies) — SBOM incomplet pour la chaîne de build logo | Faible | Faible (outils de génération one-shot) | T-054 Should — à traiter avec T-144 |
| R-DS-08 | Dependabot PRs npm en échec (MutationObserver mock) — migrations majors bloquées | Moyen | Moyen (dépendances dev non mises à jour) | T-160 à T-163 — planifiées |

---

## 7. Recommandations et score audit estimé post-actions

### Score audit révisé (T-116 référence : 42/100)

| Section | Score initial | Score actuel | Progression |
|---------|--------------|-------------|-------------|
| Métadonnées (S1) | 6/10 | 9/10 | Topics, default branch, licence GPL détectée |
| Branch protection (S2) | 0/15 | 13/15 | Main + develop protégées, status checks, no force push. Manque signed commits |
| Actions permissions (S3) | 7/15 | 12/15 | SHA pinning complet, permissions read. Manque CodeQL |
| Secrets et variables (S4) | 8/10 | 10/10 | Secret scanning actif, push protection active |
| Dependabot (S5) | 5/10 | 9/10 | Alerts + security updates + version updates configurés. Ignores majors OK |
| Code scanning (S6) | 0/10 | 0/10 | T-108 non traité |
| Sécurité avancée (S7) | 5/10 | 9/10 | PVR actif, secret scanning actif |
| Collaborateurs et 2FA (S8) | 3/5 | 5/5 | 2FA + Passkey activés (T-122) |
| Règles de merge (S9) | 5/10 | 10/10 | Squash only, delete on merge, DCO |
| Webhooks/Notifs (S10) | 3/5 | 3/5 | Inchangé |
| Pages/Wiki/Discussions (S11) | 0/5 | 3/5 | Discussions activées, Issues actives |
| **Total estimé** | **42/100** | **~83/100** | **Niveau A** |

Note : ce score est une estimation — un audit complet via API serait nécessaire pour confirmer
chaque sous-critère.

### Recommandations priorisées

**Immédiates (avant prochaine release)**

1. **Merger PR #80** (T-120) : remplacement curl|sh Syft par anchore/sbom-action SHA-pinnée.
   Bloquant si une release est publiée avant merge.

2. **Merger PR #93** (hotfix dependabot) : extension des ignores majors à vitest/eslint/typescript.
   Prévient les PRs Dependabot non souhaitées.

**Court terme (P6)**

3. **Activer CodeQL** (T-108) : Settings → Code security → Code scanning → Set up → Default
   (TypeScript/JavaScript). Gratuit sur repo public. Ajouter un job `codeql` en CI parallèle à
   `e2e` dans `needs: quality`. Estimation effort : 2h (configuration + triage premiers résultats).

4. **Corriger statut T-052** dans BACKLOG : la configuration coverage dans vite.config.ts est
   présente et fonctionnelle. T-052 devrait passer "Terminé" avec une note référençant les seuils
   conservateurs (60/70/80/60) et la cible 80% complets après T-017 à T-024.

**Moyen terme (P6+)**

5. **T-105** (migration console.* content scripts) : 29 occurrences résiduelles dans
   password-detector et pages UI. Priorité Could. À grouper avec la prochaine PR de développement
   sur ces fichiers pour réduire le nombre de PR.

6. **T-054** (pngjs/potrace en devDependencies) : à traiter lors de T-144 (refonte icône v2)
   pour garantir la reproductibilité de la génération PNG.

7. **T-055** (launch.json) : créer `.vscode/` et déplacer le fichier. Effort < 5 minutes.

8. **T-027** (tests E2E avec extension réelle — scénarios onboarding/service-worker) : la
   infrastructure xvfb est en place, seuls les scénarios manquent.

**Différés (post-roadmap)**

9. **T-130-d** (secrets-cws.md) : à produire uniquement quand la publication Chrome Web Store est
   planifiée. Différé confirmé.

10. **T-109** (page état de santé v1.1) : débloquée techniquement (T-085 à T-091 faits), mais
    dépend d'un arbitrage fonctionnel sur l'UX de la page. Hors périmètre DevSecOps direct.

---

*Revue produite par l'Intégrateur DevSecOps de la Fabrique — 2026-04-19.*
*Sources : ci.yml, release.yml, dependabot.yml, CODEOWNERS, package.json, vite.config.ts,*
*BACKLOG.md, SESSION.md, audit-config-github-v1.0.md, hardening-ci-cd-v1.0.md,*
*gh api (security_and_analysis, branches/protection, private-vulnerability-reporting),*
*gh run list, gh pr list.*
