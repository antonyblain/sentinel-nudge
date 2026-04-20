# P5 — Scénarios de recette UC-06 : Inputs password dynamiques (React/Vue)

**Référence tâche** : TACHE-073
**Phase** : P5 — Tests unitaires / Recette UC P0 bloquants v1
**Version** : 1.0
**Date** : 2026-04-17
**Auteur** : Testeur QA
**Statut** : Soumis pour validation — Référent qualité

---

## 1. Objectif et contexte

### 1.1 Objectif du UC-06

UC-06 couvre la détection M7 (réutilisation de mots de passe inter-domaines) dans le contexte des SPA modernes (React, Vue, Svelte). Ces frameworks rendent les inputs de manière asynchrone : rendu différé après mount, inputs dans des modales créées à la demande, re-render complet après action utilisateur, conditional rendering.

Le détecteur `observeDynamicForms()` utilise un `MutationObserver` sur `document.body` avec `{ childList: true, subtree: true, attributes: true, attributeFilter: ['type'] }`. Les nouveaux inputs password insérés par React/Vue sont détectés via ce MutationObserver. Ce scénario valide le comportement effectif en conditions concrètes.

### 1.2 Référence post-mortem M7

Le PV du comité post-mortem M7 (`docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md`, §4.1, UC-06) identifie ce cas d'usage comme **P0 bloquant** pour la v1 :

> "SPA modernes (React, Vue, Svelte) rendent les inputs de manière asynchrone via useEffect, lazy loading, modales conditionnelles. Le MutationObserver est posé mais les scénarios n'ont pas été validés sur des pages SPA réelles."
>
> Recommandation : "Produire des pages HTML test autonomes simulant les patterns React/Vue courants et valider la détection avant release."

### 1.3 Bogue connu F-UC01-01 (interaction avec UC-06)

La faille F-UC01-01 (identifiée TACHE-068, correctif TACHE-101) concerne les inputs ajoutés **directement comme nœud racine** dans un `addedNode` : `querySelectorAll('input[type="password"]', addedNode)` ne l'inclut pas car `querySelectorAll` ne teste pas le nœud racine lui-même.

Le Cas 5 (ci-dessous) couvre spécifiquement ce chemin. Les Cas 1 à 4 utilisent des wrappings via un conteneur `<div>`, qui ne déclenchent pas F-UC01-01 — ils doivent passer même AVANT que TACHE-101 soit mergée.

---

## 2. Cas à couvrir

| Cas | Description | Sévérité | Dépend de TACHE-101 |
|-----|-------------|----------|---------------------|
| **Cas 1** | Form React avec input password rendu via `useEffect` (délai 100ms) | **P0** | Non |
| **Cas 2** | Modal Vue avec form password affiché à la demande (bouton "Login" → modal) | **P1** | Non |
| **Cas 3** | Formulaire multi-étape : input password conditionnel, affiché après email valide | **P0** | Non |
| **Cas 4** | Re-render complet après "Wrong password" (React détruit et recrée le form) | **P0** | Non |
| **Cas 5** | Input password créé par `React.createElement` directement sans wrapping form (F-UC01-01) | **P1** | **Oui** — Cas 5 est attendu ÉCHOUER avant TACHE-101 |

---

## 3. Scénarios manuels (Given/When/Then)

### S-UC06-01 — React useEffect delay 100ms

**Objectif** : vérifier que M7 capture correctement un input password rendu de manière différée par React.

**Sévérité** : P0

**Given** :
- Sentinel Nudge est installé et activé, M7 actif
- L'état du storage est réinitialisé (aucun hash précédent, aucun `pending_m7_toast`)
- La page de test `tests/fixtures/uc06-react-use-effect.html` est ouverte via `http-server` sur `http://localhost:8080/tests/fixtures/uc06-react-use-effect.html`
- DevTools Console ouverte sur l'onglet

**When** :
1. La page charge — le DOM ne contient pas encore d'`input[type="password"]` (le form React se montera après 100ms via `useEffect`)
2. Après 150ms, observer dans le DOM l'apparition de l'`input[type="password"]` (vérifier via DevTools Elements)
3. Saisir une valeur dans l'input password (ex : `test-password-m7`)
4. Cliquer sur le bouton "Se connecter" de type `submit`

**Then** :
- Un message JSON structuré contenant `"M7: password submitted"` apparaît dans la Console (ou `"M7: pending toast stored"`)
- Aucune erreur JavaScript n'est levée dans la Console
- `chrome.storage.local` contient une entrée `password_hashes` non vide (vérifiable via l'inspecteur de storage de l'extension dans `chrome://extensions`)

**Critère de passage** : Le hash est enregistré dans IndexedDB ET le toast M7 est affiché lors d'une seconde soumission avec le même password sur un domaine différent (voir S-UC06-01b optionnel ci-dessous).

---

### S-UC06-02 — Modal Vue avec form password à la demande

**Objectif** : vérifier que M7 détecte un input password inséré dans le DOM lors de l'ouverture d'une modal Vue.

**Sévérité** : P1

**Given** :
- Sentinel Nudge est installé et activé, M7 actif
- L'état du storage est réinitialisé
- La page de test `tests/fixtures/uc06-vue-modal.html` est ouverte via `http-server` sur `http://localhost:8080/tests/fixtures/uc06-vue-modal.html`
- La page s'affiche avec uniquement un bouton "Ouvrir le formulaire de connexion" visible (aucun input password dans le DOM initial)
- DevTools Console ouverte sur l'onglet

**When** :
1. Cliquer sur le bouton "Ouvrir le formulaire de connexion"
2. La modal apparaît avec un input `[type="email"]` et un input `[type="password"]`
3. Vérifier dans DevTools Elements que l'input password est bien dans le DOM
4. Saisir une valeur dans l'input password
5. Cliquer sur le bouton "Valider" (type `submit`) de la modal

**Then** :
- Un message JSON structuré contenant `"M7: password submitted"` ou `"M7: pending toast stored"` apparaît dans la Console
- Lors de la fermeture et réouverture de la modal (deuxième connexion depuis le même onglet), soumettre le même password → le toast M7 doit apparaître si un hash existait sur un autre domaine

**Critère de passage** : Le MutationObserver a capté l'insertion de l'input password de la modal. La detection M7 fonctionne sur la modale.

---

### S-UC06-03 — Input password conditionnel après validation email

**Objectif** : vérifier que M7 détecte un input password rendu conditionnellement après qu'un email valide a été saisi (pattern Google-like multi-step).

**Sévérité** : P0

**Given** :
- Sentinel Nudge est installé et activé, M7 actif
- L'état du storage est réinitialisé
- La page de test `tests/fixtures/uc06-conditional-step.html` est ouverte via `http-server` sur `http://localhost:8080/tests/fixtures/uc06-conditional-step.html`
- La page affiche l'étape 1 : un champ email et un bouton "Suivant" (aucun input password dans le DOM)
- DevTools Console ouverte sur l'onglet

**When** :
1. Saisir une adresse email valide (ex : `test@example.com`) dans le champ email
2. Cliquer sur "Suivant"
3. Observer l'apparition du champ password dans le DOM (l'étape 2 s'affiche)
4. Vérifier via DevTools Elements que l'`input[type="password"]` est bien présent
5. Saisir un mot de passe (ex : `test-password-m7`) dans le champ password
6. Cliquer sur le bouton "Se connecter" (type `submit`)

**Then** :
- Un message JSON structuré contenant `"M7: password submitted"` ou `"M7: pending toast stored"` apparaît dans la Console
- Aucune erreur JavaScript n'est levée
- Le hash est enregistré dans IndexedDB

**Critère de passage** : M7 opère correctement même si l'input password n'était pas dans le DOM lors du chargement initial de la page.

---

### S-UC06-04 — Re-render complet après "Wrong password"

**Objectif** : vérifier que M7 continue de fonctionner sur un input password recréé par React après une erreur d'authentification.

**Sévérité** : P0

**Given** :
- Sentinel Nudge est installé et activé, M7 actif
- `password_hashes` contient déjà un hash pour le mot de passe `test-password-m7` (enregistré lors d'une session précédente)
- La page de test `tests/fixtures/uc06-react-rerender.html` est ouverte via `http-server` sur `http://localhost:8080/tests/fixtures/uc06-react-rerender.html`
- DevTools Console ouverte sur l'onglet

**When** :
1. Saisir `wrong-password` dans l'input password initial
2. Cliquer sur "Se connecter" — la page simule une erreur "Wrong password" et **détruit puis recrée** l'intégralité du form React (le nœud DOM est replacé)
3. Observer dans DevTools Elements que l'input password est un nouveau nœud DOM (différent du précédent)
4. Saisir `test-password-m7` (le même mot de passe que celui hashé en pré-condition) dans le nouvel input password
5. Cliquer sur "Se connecter"

**Then** :
- M7 détecte la soumission de la 2e tentative
- Un message JSON structuré `"M7: password submitted"` ou `"M7: pending toast stored"` apparaît dans la Console
- Le toast M7 s'affiche si le hash correspond à un hash sur un autre domaine (dépend de l'état du storage en pré-condition)

**Critère de passage** : M7 détecte la soumission même après un re-render complet du formulaire. Le MutationObserver a recapturé le nouveau nœud.

---

### S-UC06-05 — Input nu sans `<form>` créé par React sans wrapping

**Objectif** : vérifier le comportement de M7 sur un input password ajouté directement au DOM sans élément `<form>` parent, via `React.createElement` ou équivalent.

**Sévérité** : P1

**Dépendance** : Ce scénario est attendu **ÉCHOUER** avant que TACHE-101 soit mergée (correctif F-UC01-01). L'exécuter pour documenter l'état avant correctif.

**Given** :
- Sentinel Nudge est installé et activé, M7 actif
- L'état du storage est réinitialisé
- La page de test `tests/fixtures/uc06-react-orphan-input.html` est ouverte via `http-server` sur `http://localhost:8080/tests/fixtures/uc06-react-orphan-input.html`
- La page montre un bouton "Charger le formulaire" (aucun input dans le DOM)
- DevTools Console ouverte sur l'onglet

**When** :
1. Cliquer sur "Charger le formulaire"
2. React crée et insère dans le DOM l'input password **directement comme nœud racine** dans `document.body` (sans `<div>` wrapper)
3. Vérifier dans DevTools Elements que l'input est présent comme enfant direct de `body`
4. Saisir un mot de passe dans l'input
5. Appuyer sur `Enter` (déclenche le listener orphan `keydown` de `attachOrphanPasswordListeners`)

**Then (attendu après TACHE-101 mergée)** :
- M7 détecte la soumission via le fallback `attachOrphanPasswordListeners`
- Un message JSON structuré `"M7/M9: orphan password Enter pressed"` apparaît dans la Console
- Le hash est enregistré dans IndexedDB

**Then (attendu AVANT TACHE-101 — comportement à documenter)** :
- Le MutationObserver voit le `addedNode` mais `querySelectorAll('input[type="password"]', addedNode)` ne l'inclut pas
- Le fallback Enter de `attachOrphanPasswordListeners` PEUT néanmoins fonctionner (le listener est posé sur `document` en capture, pas via `attachSubmitListeners`)
- **Documenter** le résultat observé dans le rapport de recette

**Critère de passage (post-TACHE-101)** : Le hash est enregistré. Avant TACHE-101 : documenter le résultat réel pour tracer la régression.

---

## 4. Pré-conditions

### 4.1 Environnement de test

- **Navigateur** : Google Chrome stable (version >= 120) sur Windows 11
- **Extension** : Sentinel Nudge chargée en mode développeur depuis `dist/` (buildée via `npm run build`)
- **Module M7** : activé dans les options Sentinel Nudge
- **Service Worker** : initialisé (clé AES présente dans `chrome.storage.local`, vérifiable via `chrome://extensions > Inspect views : service worker > Console`)
- **Serveur HTTP** : `npx http-server . -p 8080` lancé depuis la racine du projet (pour servir les fixtures)
- **DevTools Console** : ouverte sur l'onglet de test pour observer les logs M7 structurés JSON
- **React CDN** : les pages de fixtures utilisent React 18 via CDN (`https://unpkg.com/react@18/umd/react.development.js`) — connexion internet requise

### 4.2 Fichiers de test requis

Les pages HTML de test suivantes doivent être présentes dans `tests/fixtures/` :

| Fichier | Usage |
|---------|-------|
| `uc06-react-use-effect.html` | S-UC06-01 (React useEffect delay 100ms) |
| `uc06-vue-modal.html` | S-UC06-02 (Vue modal à la demande) |
| `uc06-conditional-step.html` | S-UC06-03 (input conditionnel post-email) |
| `uc06-react-rerender.html` | S-UC06-04 (re-render complet post erreur) |
| `uc06-react-orphan-input.html` | S-UC06-05 (input nu sans form) |

Ces fichiers sont créés avec la présente tâche TACHE-073 (voir section Livrables).

### 4.3 État du storage avant chaque scénario

Sauf indication contraire dans la pré-condition du scénario, l'état de départ est :

- `password_hashes` IndexedDB : **vide**
- `pending_m7_toast` : absent de `chrome.storage.local`
- `m7_last_nudge_by_domain` : absent ou vide
- Suppression_list M7 : vide

**Procédure de réinitialisation entre scénarios** :
1. Ouvrir `chrome://extensions`
2. Cliquer sur "Inspect views : service worker" de l'extension Sentinel Nudge
3. Dans la Console du SW, exécuter :
   ```javascript
   chrome.storage.local.clear(() => console.log('storage.local cleared'));
   ```
4. Ouvrir `chrome://extensions` > "Inspect views : service worker" > Onglet Application > IndexedDB > `sentinel-nudge` > Effacer le store `password_hashes`
5. Recharger la page de test

---

## 5. Critères d'acceptation par scénario

| Scénario | Critère de passage | Critère d'échec |
|----------|--------------------|-----------------|
| S-UC06-01 | Hash enregistré dans IndexedDB après soumission sur page React useEffect | Aucun log M7 dans la Console après soumission |
| S-UC06-02 | Hash enregistré après soumission via modal Vue | La modal s'ouvre mais M7 ne détecte pas la soumission |
| S-UC06-03 | Hash enregistré après soumission sur input conditionnel post-email | L'input password conditionnel est ignoré par M7 |
| S-UC06-04 | Hash enregistré sur la 2e tentative après re-render React | La 2e tentative n'est pas captée (nouveau nœud DOM non détecté) |
| S-UC06-05 | Hash enregistré via fallback Enter (post-TACHE-101) | Avant TACHE-101 : documenter le comportement observé |

---

## 6. Prérequis d'exécution

### 6.1 Comptes de test

Aucun compte réel requis — les pages de test sont des simulateurs locaux autonomes. Les mots de passe saisis sont fictifs et ne sont jamais transmis à un serveur.

### 6.2 Installation et lancement

```powershell
# 1. Construire l'extension
npm run build

# 2. Lancer le serveur HTTP local (depuis la racine du projet)
npx http-server . -p 8080

# 3. Charger l'extension en mode développeur
# chrome://extensions > Mode développeur > Charger l'extension non empaquetée > sélectionner dist/

# 4. Ouvrir la page de test dans Chrome
# http://localhost:8080/tests/fixtures/uc06-react-use-effect.html
```

### 6.3 Vérification préalable

Avant d'exécuter les scénarios, vérifier que les scénarios de base M7 fonctionnent sur `https://saucedemo.com` (reference UC-01). Si la base ne fonctionne pas, les scénarios UC-06 ne sont pas exécutables.

---

## 7. Sévérité et priorisation

| Scénario | Sévérité | Justification |
|----------|----------|---------------|
| S-UC06-01 (React useEffect) | **P0** | Pattern très fréquent dans les SPA React modernes (Next.js, Create React App) |
| S-UC06-02 (Vue modal) | **P1** | Fréquent mais moins universel que useEffect ; modal patterns bien testés par S-UC06-01 |
| S-UC06-03 (Conditionnel post-email) | **P0** | Pattern Google/Microsoft login — très fréquent en entreprise |
| S-UC06-04 (Re-render post erreur) | **P0** | Pattern critique : si M7 manque la 2e tentative, le cas de réutilisation réel n'est pas détecté |
| S-UC06-05 (Orphan sans form) | **P1** | Dépend de TACHE-101 — cas moins fréquent, couvert partiellement par le fallback Enter |

Les scénarios P0 sont bloquants pour la release v1. Les scénarios P1 sont attendus en recette avant release mais ne bloquent pas le go/no-go si TACHE-101 est planifiée.

---

## 8. Règle E2E — Interactions utilisateur réelles (TACHE-099 intégrée)

### 8.1 Règle

Tout test E2E Sentinel Nudge testant M7 ou M2 (détection submit password / paste sensible) **DOIT** utiliser une interaction utilisateur réelle :

- `page.locator('button[type=submit]').click()` — Playwright simule un clic utilisateur
- `page.keyboard.press('Enter')` — Playwright simule une touche clavier utilisateur
- `page.locator('#password').fill('valeur')` — Playwright simule une saisie clavier

### 8.2 Interdiction

Les appels suivants sont **strictement interdits** dans les tests M7/M2 :

```typescript
// INTERDIT — génère isTrusted=false, filtré par UC-02 (TACHE-069)
await page.evaluate(() => document.querySelector('form').submit());
await page.evaluate(() => document.querySelector('form').requestSubmit());
await page.evaluate(() => (document.querySelector('button') as HTMLButtonElement).click());
```

Ces appels programmatiques génèrent `event.isTrusted=false`. M7 filtre `isTrusted=false` (ARB-UC02-01 Option A, décidé dans TACHE-069) pour éliminer les auto-submits des gestionnaires de mots de passe. Le submit est donc **invisible à M7**.

### 8.3 Pourquoi

`event.isTrusted=true` est positionné par le navigateur uniquement pour les événements issus d'une interaction physique utilisateur (clic réel, touche clavier réelle). Les appels JavaScript programmatics retournent `isTrusted=false`.

Playwright, via `.click()`, `.press()` et `.fill()`, simule des interactions au niveau du DevTools Protocol (CDP) qui déclenchent des événements d'entrée natifs avec `isTrusted=true`.

### 8.4 Exception

Les tests dont l'objet est de **valider le filtre isTrusted** lui-même (vérifier que les submits programmatiques sont bien ignorés par M7) DOIVENT utiliser `page.evaluate(() => form.submit())` et DOIVENT être nommés avec le suffixe `*-filter-isTrusted*` :

```
tests/e2e/uc02-filter-isTrusted.spec.ts      # Valide que isTrusted=false est filtré
```

---

*Document produit par le Testeur QA — TACHE-073 — 2026-04-17*
*Référence : post-mortem M7, §4.1 UC-06 ; TACHE-099 (règle E2E isTrusted) intégrée §8*
