# Audit de configuration GitHub — Sentinel Nudge

**Version** : 1.0
**Date** : 2026-04-18
**Auteur** : Intégrateur DevSecOps (Fabrique)
**Statut** : Produit — en attente de validation Commanditaire
**Dépôt audité** : `antonyblain/sentinel-nudge` (privé)
**Niveau de sensibilité** : Exposé
**Origine** : TACHE-116 — Demande Commanditaire 2026-04-18

---

## Résumé exécutif

**Score global : 42/100 — Niveau C**

Le dépôt dispose d'une base saine (CI verte, un seul contributeur admin, pas de secrets exposés, workflows Actions fonctionnels) mais présente des lacunes significatives sur trois axes qui doivent être corrigés avant le passage en public prévu par TACHE-112.

### Top 3 recommandations critiques

1. **[Must] Activer les Branch Protection Rules sur `main` et `develop`** — aucune des deux branches structurantes n'est protégée. Toute push directe ou force push est possible sans contrôle. Bloquant pour le niveau Exposé (I-007).

2. **[Must] Activer Dependabot alerts + security updates + graph des dépendances** — le projet dépend de nombreux packages npm. Aucune alerte automatique de vulnérabilité n'est configurée. Bloquant pour TACHE-112 (checklist pré-publication).

3. **[Must] Corriger la détection de licence par GitHub** — GitHub détecte MIT au lieu de GPL v3. Anomalie dans le fichier LICENSE ou son formatage. Bloquant pour la publication OSS (signal erroné pour les utilisateurs et les outils automatisés).

---

## Section 1 — Métadonnées du dépôt

| Item | Valeur observée | Bonne pratique | Statut | Priorité | ISO 27001 |
|------|-----------------|----------------|--------|----------|-----------|
| Visibilité | `private` | `private` jusqu'à TACHE-112 complétée | Conforme | — | A.5.9 |
| Description | "Extension navigateur open-source de cyber-hygiène comportementale" | Présente, pertinente | Conforme | — | — |
| Homepage | `null` (vide) | URL documentation ou page projet | A améliorer | Could | — |
| Topics | `[]` (aucun topic) | `browser-extension`, `security`, `privacy`, `chrome-extension`, `nudge` | A améliorer | Could | — |
| Default branch | `main` | `develop` (I-007 niveau Exposé : develop est la branche d'intégration) | Non conforme | Should | A.8.32 |
| Archivé | `false` | — | Conforme | — | — |
| Template | `false` | — | Conforme | — | — |
| Fork | `false` | — | Conforme | — | — |
| Licence détectée GitHub | `MIT` | `GPL-3.0` (décision TACHE-004, validée P1) | Non conforme | Must | A.5.32 |
| Licence réelle (local) | `GPL-3.0` dans LICENSE et package.json | Cohérent | Conforme (local) | — | A.5.32 |

**Recommandations :**

- **REC-01 [Should]** Passer `default_branch` de `main` à `develop` via Settings → General → Default branch. La branche par défaut devrait être `develop` (branche d'intégration du flow Exposé I-007). `main` reste la branche de production mergée via PR uniquement.
- **REC-02 [Could]** Ajouter 4 à 6 topics pertinents (ex. `browser-extension`, `security`, `privacy`, `chrome-extension`) pour la découvrabilité OSS une fois le repo public.
- **REC-03 [Could]** Renseigner `homepage` avec l'URL du dépôt lui-même ou d'une future page projet.
- **REC-04 [Must]** Investiguer la détection MIT par GitHub — le fichier LICENSE local contient bien GPL v3. L'API GitHub renvoie `spdx_id: MIT`. Vérifier l'absence d'un second fichier LICENSE ou d'une en-tête MIT dans un fichier racine. Corriger avant publication publique (TACHE-112).

---

## Section 2 — Branch Protection Rules

**Constat** : L'API GitHub retourne HTTP 403 "Upgrade to GitHub Pro or make this repository public to enable this feature" pour les endpoints `GET /branches/{branch}/protection`. Ce comportement confirme que **les branch protection rules sont indisponibles sur un repo privé avec GitHub Free**. L'API confirme par ailleurs : `main protected: False`, `develop protected: False`.

| Item | Valeur observée | Bonne pratique (Exposé) | Statut | Priorité | ISO 27001 |
|------|-----------------|-------------------------|--------|----------|-----------|
| Protection `main` | Aucune | Reviews (1+), dismiss stale, required checks, linear history, no force push, include admins, signed commits | Absent | Must | A.8.32 |
| Protection `develop` | Aucune | Reviews (1 souple), required status checks CI, no force push | Absent | Must | A.8.32 |
| Signed commits (`main`) | Non requis | Activé (Sigstore / GPG) | Absent | Should | A.8.11 |
| Linear history (`main`) | Non requis | Activé | Absent | Should | A.8.32 |
| No force push (`main`) | Non requis | Activé | Absent | Must | A.8.32 |
| Include administrators | Non requis | Activé (évite contournement admin) | Absent | Should | A.5.15 |
| Required status checks | Aucun | `quality`, `e2e` (jobs ci.yml) | Absent | Must | A.8.32 |
| CODEOWNERS | Absent | `.github/CODEOWNERS` présent | Absent | Should | A.5.15 |
| Branches fantômes | 3 branches feature non supprimées après merge (`feature/p5-tache-068-*`, `feature/p5-tache-075-*`, `feature/p5-tache-114-*`) | Auto-delete après merge activé + suppression manuelle des branches orphelines | Non conforme | Should | A.8.32 |

**Recommandations :**

- **REC-05 [Must]** Après passage public (TACHE-112), configurer immédiatement les branch protection rules sur `main` et `develop` via Settings → Branches. Sur GitHub Free, les règles de protection ne sont disponibles que sur les repos publics.
  - `main` : 1 reviewer requis, dismiss stale reviews, required status checks (`quality` + `e2e`), linear history, no force push, include administrators.
  - `develop` : required status checks (`quality` + `e2e`), no force push.
- **REC-06 [Should]** Activer `delete_branch_on_merge` dans Settings → General pour supprimer automatiquement les branches après merge de PR. Actuellement `false`.
- **REC-07 [Should]** Créer `.github/CODEOWNERS` désignant `@antonyblain` comme owner de l'ensemble du dépôt. Prérequis pour activer "Require review from code owners" dans les branch protection rules.
- **REC-08 [Should]** Supprimer les 3 branches feature orphelines (`feature/p5-tache-068-uc01-login-multi-etape`, `feature/p5-tache-075-referentiel-iso27001`, `feature/p5-tache-114-referentiel-iso-v1.1`) — leurs PRs sont mergées mais les branches n'ont pas été supprimées (violation LL-024).

---

## Section 3 — Actions Permissions

| Item | Valeur observée | Bonne pratique | Statut | Priorité | ISO 27001 |
|------|-----------------|----------------|--------|----------|-----------|
| Actions activées | `enabled: true` | Activé | Conforme | — | A.8.20 |
| Allowed actions | `all` | `local_only` ou `selected` (limiter aux actions vérifiées) | A améliorer | Should | A.8.20 |
| SHA pinning requis | `sha_pinning_required: false` | `true` (épingler les actions par hash SHA, pas par tag) | Non conforme | Should | A.8.30 |
| Workflow permissions par défaut | `read` | `read` (minimal recommandé) | Conforme | — | A.8.20 |
| Approuver les PRs depuis workflows | `can_approve_pull_request_reviews: false` | `false` (bon) | Conforme | — | A.5.15 |
| Fork PRs workflow approval | Non applicable (repo privé, forking activé mais sans effet pratique) | Désactiver le forking avant passage public si non souhaité | A surveiller | Could | A.8.20 |
| Self-hosted runners | Aucun (`total_count: 0`) | Utiliser GitHub-hosted uniquement (moins de surface d'attaque) | Conforme | — | A.8.20 |

**Constat sur ci.yml et release.yml** :

- `ci.yml` : les actions `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4` sont épinglées par **tag** et non par **hash SHA**. Un tag peut être redirigé (supply chain attack).
- `release.yml` : `softprops/action-gh-release@v2` est une action tierce non officielle, épinglée par tag uniquement.
- `release.yml` : `permissions: contents: write` au niveau job — correct car limité au job release, pas global au workflow.
- `ci.yml` : **aucune déclaration `permissions:` globale** — le workflow hérite des permissions par défaut (`read`), ce qui est acceptable mais non explicité.
- L'installation de Syft via `curl | sh` dans `release.yml` est un pattern risqué (exécution de script arbitraire depuis internet).

**Recommandations :**

- **REC-09 [Should]** Passer `allowed_actions` de `all` à `local_only` ou à une liste d'actions approuvées (GitHub Actions marketplace). Au minimum : restreindre aux actions `actions/*` officielles + `softprops/action-gh-release`.
- **REC-10 [Should]** Activer `sha_pinning_required: true` via Settings → Actions → General → "Require SHA pinning". Puis épingler les actions dans les workflows par leur hash SHA complet (ex. `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` pour v4.2.2).
- **REC-11 [Should]** Ajouter une déclaration `permissions: read-all` ou `permissions: contents: read` explicite au niveau du workflow dans `ci.yml` pour documenter l'intention du moindre privilège.
- **REC-12 [Could]** Remplacer le pattern `curl | sh` pour l'installation de Syft par une GitHub Action officielle Anchore ou par une installation via un hash de release vérifié.

---

## Section 4 — Secrets et Variables

| Item | Valeur observée | Bonne pratique | Statut | Priorité | ISO 27001 |
|------|-----------------|----------------|--------|----------|-----------|
| Secrets repo | `total_count: 0` — aucun secret configuré | Aucun secret attendu pour CI actuelle (pas de déploiement automatisé) | Conforme (CI actuelle) | — | A.8.12 |
| Variables repo | Aucune variable configurée | — | Conforme | — | A.8.12 |
| Secrets référencés dans workflows | `release.yml` commente des secrets CWS (`CWS_EXTENSION_ID`, `CWS_CLIENT_ID`, etc.) mais ils sont commentés | Les secrets commentés ne sont pas actifs — OK | Conforme | — | A.8.12 |
| Secrets dans le code | Non vérifié par git-secrets/truffleHog (fait partie de TACHE-112) | Audit historique git obligatoire avant publication | A vérifier | Must | A.8.12 |

**Recommandations :**

- **REC-13 [Must]** Intégrer un scan d'historique git (truffleHog ou git-secrets) dans TACHE-112 avant publication publique pour garantir l'absence de secrets dans l'historique de commits.
- **REC-14 [Could]** Lorsque les secrets CWS seront configurés pour la publication Chrome Web Store, les documenter dans `.claude/INSTRUCTIONS.md` avec leur nom exact, leur source et la procédure d'ajout (conformément au protocole gestion des secrets DevSecOps).

---

## Section 5 — Dependabot

| Item | Valeur observée | Bonne pratique | Statut | Priorité | ISO 27001 |
|------|-----------------|----------------|--------|----------|-----------|
| Dependency graph | Non vérifié directement (API 403 sur vulnerability-alerts indique probable désactivation globale) | Activé | Probablement désactivé | Must | A.8.8 |
| Dependabot alerts | `Vulnerability alerts are disabled` (HTTP 404) | Activé | Désactivé | Must | A.8.8 |
| Dependabot security updates | `enabled: false` (API confirmée) | Activé | Désactivé | Must | A.8.8 |
| Dependabot version updates | `.github/dependabot.yml` absent | Fichier présent avec config npm + GitHub Actions | Absent | Should | A.8.8 |

**Recommandations :**

- **REC-15 [Must]** Activer le dependency graph : Settings → Code security → Dependency graph → Enable.
- **REC-16 [Must]** Activer Dependabot alerts : Settings → Code security → Dependabot alerts → Enable.
- **REC-17 [Must]** Activer Dependabot security updates : Settings → Code security → Dependabot security updates → Enable (nécessite Dependabot alerts activé préalablement).
- **REC-18 [Should]** Créer `.github/dependabot.yml` avec configuration pour `npm` (hebdomadaire, auto-merge patches) et `github-actions` (mensuel). Ces activations sont incluses dans la checklist TACHE-112.

---

## Section 6 — Code Scanning (CodeQL)

| Item | Valeur observée | Bonne pratique | Statut | Priorité | ISO 27001 |
|------|-----------------|----------------|--------|----------|-----------|
| Code scanning | Désactivé (HTTP 403 "not enabled") | Activé sur repo public (gratuit) | Désactivé | Could | A.8.25 |
| SAST dans CI | Absent (workflow dédié TACHE-108 planifié) | Job CodeQL dédié dans CI | Absent | Could | A.8.25 |
| Languages couverts | Non applicable | TypeScript/JavaScript | Non applicable | — | — |
| Schedule | Non applicable | Weekly + on push | Non applicable | — | — |

**Recommandations :**

- **REC-19 [Could]** Après passage public (TACHE-112), activer CodeQL via Settings → Code security → Code scanning → Set up → Default. Correspond à TACHE-108 (planifié). Gratuit sur repos publics.

---

## Section 7 — Sécurité avancée

| Item | Valeur observée | Bonne pratique | Statut | Priorité | ISO 27001 |
|------|-----------------|----------------|--------|----------|-----------|
| Private vulnerability reporting | Non disponible (repo privé) | Activé sur repo public — SECURITY.md le référence mais le canal est inopérant | Bloqué par TACHE-112 | Must | A.5.24 |
| Secret scanning | Désactivé (HTTP 404 "disabled on this repository") | Activé sur repo public (gratuit) | Désactivé | Must (après T-112) | A.8.12 |
| Push protection (secret scanning) | Non disponible (dépend de secret scanning) | Activé | Non disponible | Should | A.8.12 |
| SECURITY.md | Présent, v1.0, complet | Présent et référençant le canal Security Advisories | Conforme (dormant) | — | A.5.24 |
| Issue templates | `.github/ISSUE_TEMPLATE/config.yml` + `security-bug.md` présents | Présents | Conforme | — | A.5.24 |

**Recommandations :**

- **REC-20 [Must]** Activer "Private vulnerability reporting" immédiatement après passage public (TACHE-112, step 1). Sans cela, le canal SECURITY.md est inopérant et les chercheurs en sécurité ne peuvent pas signaler de vulnérabilités via le canal officiel.
- **REC-21 [Must]** Activer secret scanning après passage public : Settings → Code security → Secret scanning → Enable. Gratuit sur repos publics.
- **REC-22 [Should]** Activer push protection (nécessite secret scanning activé).

---

## Section 8 — Collaborators et Teams

| Item | Valeur observée | Bonne pratique | Statut | Priorité | ISO 27001 |
|------|-----------------|----------------|--------|----------|-----------|
| Collaborateurs | 1 seul : `antonyblain` (rôle : admin) | Moindre privilège — seul le maintainer principal a les droits admin | Conforme | — | A.5.15 |
| Teams | Non applicable (compte personnel, pas d'organisation) | — | Conforme | — | A.5.15 |
| 2FA | Non vérifié via API (paramètre compte GitHub personnel) | 2FA activé sur le compte owner | À vérifier | Must | A.8.5 |

**Recommandations :**

- **REC-23 [Must]** Vérifier que le compte GitHub `antonyblain` a la 2FA activée : Settings → Password and authentication. Condition sine qua non pour la sécurité du dépôt (compte unique avec droits admin).

---

## Section 9 — Règles de Merge

| Item | Valeur observée | Bonne pratique (Exposé) | Statut | Priorité | ISO 27001 |
|------|-----------------|-------------------------|--------|----------|-----------|
| Allow squash merge | `true` | `true` (recommandé pour historique propre) | Conforme | — | A.8.32 |
| Allow merge commit | `true` | `false` (désactiver pour forcer squash) | A améliorer | Should | A.8.32 |
| Allow rebase merge | `true` | `false` (désactiver pour forcer squash) | A améliorer | Should | A.8.32 |
| Auto-delete head branches | `false` | `true` (supprimer automatiquement après merge) | Non conforme | Should | A.8.32 |
| Auto-merge | `false` | `false` (garder le contrôle manuel en niveau Exposé) | Conforme | — | — |
| Web commit signoff required | `false` | `true` (pour traçabilité DCO si OSS public) | A améliorer | Could | A.5.10 |

**Recommandations :**

- **REC-24 [Should]** Désactiver "Allow merge commits" et "Allow rebase merges" : Settings → General → Pull Requests. Ne conserver que "Allow squash merging" pour garantir un historique linéaire sur `main` et `develop` (cohérent avec REC-05).
- **REC-25 [Should]** Activer "Automatically delete head branches" : Settings → General → Pull Requests. Évite l'accumulation de branches orphelines (REC-08).
- **REC-26 [Could]** Activer "Require contributors to sign off on web-based commits" pour traçabilité DCO (Developer Certificate of Origin), pertinent avant publication OSS.

---

## Section 10 — Webhooks et Notifications

| Item | Valeur observée | Bonne pratique | Statut | Priorité | ISO 27001 |
|------|-----------------|----------------|--------|----------|-----------|
| Webhooks | Aucun (`[]`) | Acceptable pour projet solo sans intégrations externes | Conforme | — | A.8.20 |
| Email notifications | Non vérifié (paramètre personnel GitHub, hors API repo) | Notifications activées sur events sécurité | À vérifier | Could | A.5.24 |

**Recommandations :**

- **REC-27 [Could]** Vérifier les paramètres de notification GitHub pour recevoir les alertes Dependabot et secret scanning par email une fois activés.

---

## Section 11 — Pages, Wiki, Issues, Discussions, Projects

| Item | Valeur observée | Bonne pratique | Statut | Priorité | ISO 27001 |
|------|-----------------|----------------|--------|----------|-----------|
| GitHub Pages | Désactivé (HTTP 404) | Non nécessaire actuellement | Conforme | — | — |
| Wiki | Désactivé (`has_wiki: false`) | Désactivé (documentation dans le dépôt) | Conforme | — | — |
| Issues | Activé (`has_issues: true`) | Activé | Conforme | — | A.5.24 |
| Discussions | Désactivé (`has_discussions: false`) | Envisager après passage public pour la communauté OSS | A améliorer | Could | — |
| Projects | Activé (`has_projects: true`) | Acceptable | Conforme | — | — |
| Forking | Activé (`allow_forking: true`) | Activé (OSS — fork attendu) | Conforme (OSS) | — | — |

**Recommandations :**

- **REC-28 [Could]** Activer GitHub Discussions après passage public pour créer un espace communautaire (Q&A, annonces, idées).

---

## Tableau récapitulatif des recommandations

| ID | Priorité | Titre | Bloqué par | Intégrable dans |
|----|----------|-------|------------|-----------------|
| REC-04 | Must | Corriger détection licence MIT → GPL v3 par GitHub | — | TACHE-112 |
| REC-05 | Must | Activer branch protection rules `main` et `develop` | TACHE-112 (repo doit être public) | TACHE-112 |
| REC-13 | Must | Scan historique git (truffleHog) avant publication | — | TACHE-112 |
| REC-15 | Must | Activer dependency graph | — | TACHE-112 |
| REC-16 | Must | Activer Dependabot alerts | — | TACHE-112 |
| REC-17 | Must | Activer Dependabot security updates | REC-16 | TACHE-112 |
| REC-20 | Must | Activer Private vulnerability reporting | TACHE-112 | TACHE-112 |
| REC-21 | Must | Activer secret scanning | TACHE-112 | TACHE-112 |
| REC-23 | Must | Vérifier 2FA compte `antonyblain` | — | Action manuelle immédiate |
| REC-01 | Should | Passer default branch de `main` à `develop` | — | Nouvelle tâche |
| REC-06 | Should | Activer auto-delete head branches | — | Nouvelle tâche |
| REC-07 | Should | Créer `.github/CODEOWNERS` | — | Nouvelle tâche |
| REC-08 | Should | Supprimer 3 branches orphelines | — | Action manuelle immédiate |
| REC-09 | Should | Restreindre `allowed_actions` (pas `all`) | — | Nouvelle tâche |
| REC-10 | Should | Activer SHA pinning + épingler actions | — | Nouvelle tâche |
| REC-11 | Should | Ajouter `permissions: read-all` dans ci.yml | — | Nouvelle tâche |
| REC-18 | Should | Créer `.github/dependabot.yml` | — | Nouvelle tâche |
| REC-22 | Should | Activer push protection | REC-21 | TACHE-112 |
| REC-24 | Should | Désactiver merge commit + rebase | — | Nouvelle tâche |
| REC-25 | Should | Activer auto-delete branches | — | Nouvelle tâche |
| REC-02 | Could | Ajouter topics GitHub | — | Nouvelle tâche |
| REC-12 | Could | Remplacer curl-pipe-sh Syft | — | Nouvelle tâche |
| REC-14 | Could | Documenter secrets CWS futurs | — | Lors de TACHE-112 |
| REC-19 | Could | Activer CodeQL | TACHE-112 | TACHE-108 |
| REC-26 | Could | Activer web commit signoff (DCO) | — | Nouvelle tâche |
| REC-28 | Could | Activer GitHub Discussions | TACHE-112 | Nouvelle tâche |

---

## Plan d'action

### Actions immédiates (sans attendre TACHE-112)

| Action | Responsable | Effort |
|--------|-------------|--------|
| Vérifier 2FA compte `antonyblain` (REC-23) | Commanditaire | 5 min |
| Supprimer 3 branches orphelines (REC-08) | Commanditaire / DevSecOps | 5 min |
| Activer auto-delete head branches (REC-25) | Commanditaire | 2 min |
| Désactiver merge commit + rebase (REC-24) | Commanditaire | 2 min |
| Passer default branch de `main` à `develop` (REC-01) | Commanditaire | 2 min |

### Intégrer dans TACHE-112 (checklist pré-publication)

Les éléments suivants doivent être ajoutés à la checklist TACHE-112 :

- REC-04 : investigation et correction détection licence MIT
- REC-05 : activation branch protection rules
- REC-13 : scan truffleHog sur historique git
- REC-15, REC-16, REC-17 : activation Dependabot complet
- REC-20 : activation Private vulnerability reporting
- REC-21, REC-22 : activation secret scanning + push protection

### Nouvelles tâches BACKLOG à créer

| ID suggéré | Titre | Priorité |
|------------|-------|----------|
| TACHE-118 | Hardening Actions CI : SHA pinning des actions + `permissions: read-all` + restriction `allowed_actions` | Should |
| TACHE-119 | Créer `.github/CODEOWNERS` + `.github/dependabot.yml` | Should |
| TACHE-120 | Remplacer curl-pipe-sh Syft par action officielle Anchore dans release.yml | Could |

---

## Annexe — Données brutes collectées (extrait)

### Paramètres repo (gh api)

```
visibility: private
default_branch: main
license.spdx_id: MIT  (anomalie — GPL v3 attendu)
allow_squash_merge: true
allow_merge_commit: true
allow_rebase_merge: true
allow_auto_merge: false
delete_branch_on_merge: false
web_commit_signoff_required: false
has_wiki: false
has_issues: true
has_discussions: false
has_projects: true
allow_forking: true
topics: []
```

### Actions permissions

```
enabled: true
allowed_actions: all
sha_pinning_required: false
default_workflow_permissions: read
can_approve_pull_request_reviews: false
```

### Secrets / Variables

```
secrets: total_count = 0 (aucun)
variables: aucune
```

### Dependabot

```
dependency_graph: non vérifié directement
dependabot_alerts: disabled (HTTP 404)
dependabot_security_updates: enabled: false
.github/dependabot.yml: absent (HTTP 404)
```

### Code scanning / Secret scanning

```
code_scanning: not enabled (HTTP 403)
secret_scanning: disabled (HTTP 404)
```

### Branches

```
main: protected = false
develop: protected = false
feature/p5-tache-068-uc01-login-multi-etape: protected = false (orpheline)
feature/p5-tache-075-referentiel-iso27001: protected = false (orpheline)
feature/p5-tache-114-referentiel-iso-v1.1: protected = false (orpheline)
```

### Collaborateurs

```
antonyblain: role = admin (seul collaborateur)
```

### Webhooks

```
[] (aucun webhook)
```

---

## Historique

| Version | Date | Changement |
|---------|------|------------|
| 1.0 | 2026-04-18 | Production initiale — TACHE-116 |
