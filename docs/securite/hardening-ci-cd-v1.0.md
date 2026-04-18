# Hardening CI/CD — SHA Pinning et permissions minimales

**Version** : 1.0
**Date** : 2026-04-18
**Auteur** : Intégrateur DevSecOps (Fabrique)
**Statut** : Produit
**Origine** : TACHE-118 — Recommandations REC-10/REC-11 de l'audit config GitHub v1.0 (TACHE-116)
**Référence CWE** : CWE-829 — Inclusion of Functionality from Untrusted Control Sphere

---

## 1. Contexte et justification

### 1.1 Problème adressé

Les workflows GitHub Actions font appel à des actions tierces (ex. `actions/checkout@v4`). L'utilisation d'un tag mutable (`@v4`) expose le pipeline à une attaque de type supply-chain :

- Un tag Git peut être supprimé puis recréé pointant vers un commit malveillant.
- Une action compromise permet d'exécuter du code arbitraire dans le runner CI avec accès aux secrets du dépôt.
- Un acteur malveillant ayant compromis le compte d'un mainteneur d'action peut republier un tag existant.

**CWE-829** — Inclusion of Functionality from Untrusted Control Sphere : un composant logiciel inclut des fonctionnalités provenant d'une sphère de contrôle non fiable ou non vérifiée.

**Conforme ISO 27001** :
- A.8.20 — Sécurité des réseaux
- A.8.30 — Externalisation du développement logiciel
- A.5.21 — Gestion de la sécurité de l'information dans la chaîne d'approvisionnement ICT

### 1.2 Solution appliquée

Le SHA-pinning consiste à référencer une action par son **hash de commit complet (40 caractères)** au lieu d'un tag :

```yaml
# Avant (vulnérable)
uses: actions/checkout@v4

# Après (immutable)
uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1
```

Un hash de commit est **immuable** — il ne peut pas être redirigé vers un contenu différent.

---

## 2. Actions pinnées

### 2.1 Table récapitulative

| Action | Tag épinglé | SHA commit (40 chars) | Rôle dans le pipeline | Fichier(s) |
|--------|-------------|----------------------|----------------------|------------|
| `actions/checkout` | v4.3.1 | `34e114876b0b11c390a56381ad16ebd13914f8d5` | Clone le dépôt dans le runner | ci.yml (2×), release.yml (1×) |
| `actions/setup-node` | v4.4.0 | `49933ea5288caeca8642d1e84afbd3f7d6820020` | Configure Node.js 24 LTS + cache npm | ci.yml (2×), release.yml (1×) |
| `actions/upload-artifact` | v4.6.2 | `ea165f8d65b6e75b540449e92b4886f43607fa02` | Upload rapports Playwright et traces | ci.yml (2×) |
| `softprops/action-gh-release` | v2.6.2 | `3bb12739c298aeb8a4eeaf626c5b8d85266b0e65` | Crée la GitHub Release + upload assets | release.yml (1×) |

**Total : 4 actions distinctes pinnées, 8 occurrences dans les workflows.**

### 2.2 Actions non pinnées — Justifications

| Action | Raison de non-pinning |
|--------|----------------------|
| `trmcnvn/chrome-addon` (commentée) | Action commentée — inactive. Ne sera épinglée que lors de son activation (TACHE-112 + Chrome Web Store). |

### 2.3 Composants hors périmètre SHA pinning

| Composant | Situation | Note |
|-----------|-----------|------|
| Installation Syft via `curl \| sh` | Non pinnée — script de shell depuis internet | TACHE-120 planifie le remplacement par `anchore/sbom-action` avec SHA épinglé. À traiter avant activation release en production. |

---

## 3. Permissions minimales

### 3.1 Principe appliqué

Les workflows déclarent maintenant `permissions: contents: read` au niveau global, ce qui :
- Bloque toute écriture accidentelle sur le dépôt depuis un job qui n'en aurait pas besoin.
- Documente explicitement l'intention du moindre privilège (conformément à REC-11 de l'audit).
- Limite l'impact d'une compromission d'action tierce sur le périmètre des secrets accessibles.

### 3.2 Configuration par workflow

#### ci.yml

```yaml
# Niveau workflow — moindre privilège
permissions:
  contents: read

jobs:
  quality:
    # Pas de surcharge locale — read suffit
  e2e:
    # Pas de surcharge locale — read suffit
```

Justification : les jobs `quality` et `e2e` ne créent aucun asset, ne publient rien, ne modifient pas le dépôt. `contents: read` est suffisant.

#### release.yml

```yaml
# Niveau workflow — moindre privilège par défaut
permissions:
  contents: read

jobs:
  release:
    # Surcharge locale nécessaire : création GitHub Release + upload ZIP/SBOM
    permissions:
      contents: write
```

Justification : seul le job `release` nécessite `contents: write` pour créer la GitHub Release via l'API. La surcharge est déclarée **localement au niveau du job** uniquement, conformément au principe du moindre privilège.

---

## 4. Procédure de mise à jour des SHA

### 4.1 Mise à jour manuelle

Lorsqu'une nouvelle version d'une action est disponible :

1. Identifier le tag de la nouvelle version (ex. `v4.4.0` → `v4.5.0`).
2. Récupérer le SHA du commit correspondant :
   ```
   gh api repos/<owner>/<action>/git/refs/tags/<tag> --jq '.object.sha'
   ```
   Exemple :
   ```
   gh api repos/actions/checkout/git/refs/tags/v4.5.0 --jq '.object.sha'
   ```
3. Vérifier que l'objet est de type `commit` (pas `tag`) :
   ```
   gh api repos/<owner>/<action>/git/refs/tags/<tag> --jq '.object.type'
   ```
   Si le type est `tag` (tag annoté), récupérer le SHA de l'objet cible :
   ```
   gh api repos/<owner>/<action>/git/tags/<sha> --jq '.object.sha'
   ```
4. Mettre à jour le fichier workflow avec le nouveau SHA et le commentaire de version.
5. Mettre à jour le tableau de la section 2.1 du présent document.
6. Valider en CI (la nouvelle version sera exécutée).

### 4.2 Mise à jour automatisée (TACHE-119 — Dependabot)

TACHE-119 a configuré `.github/dependabot.yml` avec l'écosystème `github-actions` (mises à jour mensuelles). Dependabot ouvrira automatiquement des PR de bump des actions GitHub — **y compris avec mise à jour des SHA pinnés**.

Comportement Dependabot sur SHA pinned actions :
- Dependabot détecte les actions référencées par SHA.
- Il ouvre une PR mettant à jour simultanément le SHA et le commentaire `# vX.Y.Z`.
- La PR passe par la CI avant merge — aucun risque de régression silencieuse.

**Recommandation** : avec TACHE-119 actif, la mise à jour manuelle n'est nécessaire que pour les correctifs de sécurité urgents (0-day). Dans tous les autres cas, laisser Dependabot gérer le cycle mensuel.

---

## 5. Action manuelle Commanditaire requise

### 5.1 Restreindre `allowed_actions` dans Settings GitHub

**Objectif** : compléter le SHA pinning au niveau workflow par une restriction au niveau Settings GitHub. Actuellement, `allowed_actions = all` — n'importe quelle action du marketplace peut être utilisée. Il faut passer à `selected` pour limiter aux actions explicitement autorisées.

**Instructions** :

1. Ouvrir le dépôt sur GitHub : https://github.com/antonyblain/sentinel-nudge
2. Aller dans **Settings** (onglet en haut)
3. Dans le menu gauche : **Actions** → **General**
4. Section **Actions permissions** → sélectionner **"Allow select actions and reusable workflows"**
5. Dans le champ qui apparaît, ajouter les actions autorisées :
   ```
   actions/checkout@*,
   actions/setup-node@*,
   actions/upload-artifact@*,
   softprops/action-gh-release@*,
   ```
6. Cliquer **Save**

**Résultat attendu** : toute action non listée sera bloquée à l'exécution. Les workflows existants continuent de fonctionner car toutes leurs actions sont dans la liste.

**Note** : conserver `@*` (wildcard de version) dans les allowed_actions — la restriction de version est assurée par le SHA pinning dans les fichiers `.yml`. Les deux mécanismes sont complémentaires.

---

## 6. Historique des modifications

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | 2026-04-18 | Intégrateur DevSecOps (Fabrique) | Version initiale — SHA pinning 4 actions, permissions minimales ci.yml + release.yml |
