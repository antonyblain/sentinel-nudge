# P5 — UC-01 Login multi-étape : scénarios de recette manuelle

**Document** : `p5-uc01-login-multietape-scenarios-v1.0.md`  
**Phase** : P5 — Fiabilisation M7 + couverture UC P0 v1  
**Tâche** : TACHE-068  
**Auteur** : Architecte logiciel (rôle analyste d'investigation)  
**Date** : 2026-04-17  
**Statut** : v1.0 — À soumettre au Référent qualité

---

## 1. Objet

Ce document couvre deux livrables distincts issus de TACHE-068 :

1. **Analyse d'impact code** (Partie 1) — Vérification que l'implémentation actuelle de `password-detector.ts` gère correctement les flux de login multi-étape sans nécessiter de code supplémentaire pour la v1.
2. **Scénarios de recette manuelle** (Partie 2) — 9 scénarios Given/When/Then pour les fournisseurs P0/P1 : Google, Microsoft, Okta.
3. **Recommandations et arbitrage** (Partie 3) — Fragilités identifiées, évaluation de leur blocage v1, arbitrage soumis si nécessaire.

---

## 2. Périmètre

### 2.1 Fournisseurs et priorités

| Fournisseur | Priorité | Profil du flux                                                            | URL de référence                                                                           |
| ----------- | -------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Google      | P0       | Deux URL distinctes — même `hostname`, `pathname` différent               | `accounts.google.com/signin/v2/identifier` → `accounts.google.com/signin/v2/challenge/pwd` |
| Microsoft   | P0       | Même URL, changement d'état React (SPA)                                   | `login.microsoftonline.com/common/login` → état password                                   |
| Okta        | P1       | Même `hostname`, redirect ou changement d'état selon configuration tenant | `<tenant>.okta.com/login/login.htm`                                                        |

### 2.2 Cas hors périmètre TACHE-068

| Cas                                                                      | Statut                                                                                                                 |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Cas A — SPA, même URL                                                    | Couvert (voir §3)                                                                                                      |
| Cas B — Navigation même hostname, pathname différent                     | Couvert (voir §3)                                                                                                      |
| Cas C — Redirect cross-domain (ex. "Se connecter avec Google" sur tiers) | Comportement voulu : M7 capture sur le domaine du provider (accounts.google.com), pas sur le site tiers. Non bloquant. |
| Cas D — iframe SSO cross-origin                                          | Traité par TACHE-071 (limitation documentée)                                                                           |

---

## 3. Analyse d'impact code (Partie 1)

### 3.1 Utilisation de `location.hostname` dans le flux M7

**Localisation dans le code** : `password-detector.ts`, ligne 1229.

```typescript
// Calcul du hash de domaine
const domainHash = await hashDomain(salt, location.hostname);
```

Cette ligne est exécutée à l'intérieur de `handleFormSubmit()`, qui est elle-même appelée depuis le handler `submit` de chaque formulaire (l. 1597-1612) ou depuis les listeners orphelins (Enter/click, l. 1485-1578).

**Conclusion** : `location.hostname` est lu **au moment du submit**, pas au moment de l'installation du listener. Il reflète donc l'URL courante de la page au moment où l'utilisateur valide le formulaire. Ce comportement est correct dans tous les cas de figure Multi-étape ci-dessous.

### 3.2 Validation : hostname au submit vs. hostname à l'installation du listener

**Cas B — Navigation entre URL (même hostname, pathname différent)** :  
Lors du passage de `/signin/v2/identifier` à `/signin/v2/challenge/pwd` sur `accounts.google.com`, le navigateur effectue une navigation complète. Le content script est réinjecté par Chrome sur la nouvelle page. L'appel à `initPasswordDetector()` reconstruit tous les listeners et re-bootstrappe `_snPasswordInputs`. La valeur `location.hostname` au submit est `accounts.google.com`. Le `domain_hash = SHA-256(sel + hostname)` est identique aux deux étapes puisque le hostname est le même. Aucun bug.

**Cas A — SPA (même URL, changement d'état React)** :  
Le content script reste en vie puisqu'il n'y a pas de navigation. Les listeners submit attachés au chargement restent valides. Au moment du submit sur l'écran password, `location.hostname` est lu depuis `window.location` courant qui est inchangé (Microsoft ne modifie pas le pathname lors du changement d'état vers l'écran password). Le hash est calculé correctement.

**Validation** : pas de bug sur la lecture du hostname. La variable `location.hostname` est une propriété live de `window.location`, elle reflète toujours l'état courant au moment de la lecture.

### 3.3 Interaction avec `history.pushState` / `replaceState`

`password-detector.ts` n'écoute pas `popstate` ni ne sur-intercepte `pushState`/`replaceState`. Ce n'est pas nécessaire pour le calcul du `domain_hash` car le hash est basé sur `hostname` uniquement (pas le `pathname` ni la `search`). Un `history.pushState` qui changerait `/challenge/identifier` en `/challenge/pwd` sur le même hostname n'affecte pas le hash.

**Fragilité potentielle (non bloquante v1)** : si une SPA change de hostname via `window.location.replace()` (redirect hard), le content script est déchargé et réinjecté par Chrome — le comportement est correct. Si une SPA utilise `history.pushState` avec un chemin modifié sur le même hostname sans rechargement de page, les listeners submit de l'étape précédente restent attachés. Dans ce cas, `submittedFields` (WeakSet) protège contre le double-traitement : si le même champ est soumis deux fois, la seconde occurrence est ignorée (l. 1170-1171). S'il s'agit d'un nouveau champ (ex. React re-render d'un nouveau formulaire), `observeDynamicForms` le détecte via `MutationObserver` et appelle `attachSubmitListeners()` (l. 1659-1661).

**Conclusion** : il n'est pas nécessaire d'écouter `popstate`/`pushstate` pour M7. Le `MutationObserver` suffit pour les formulaires créés dynamiquement. L'absence d'écoute de ces événements est une décision justifiée (les navigations qui changent le hostname déclenchent une réinjection du content script).

### 3.4 Interaction avec TACHE-072 (MutationObserver sur `type`) — cas multi-étape SPA

Dans un flux SPA multi-étape, l'écran email peut contenir un input `type="text"` pour l'email, puis React démonte ce composant et monte un nouveau composant avec un input `type="password"` pour le mot de passe.

**Chemin d'exécution dans le code** :

1. Le nouveau noeud DOM (`input[type="password"]`) est détecté par le `MutationObserver` de `observeDynamicForms()` via `childList: true, subtree: true` (l. 1664-1671). La condition `(node as Element).querySelector?.('input[type="password"]')` est vraie.
2. `attachSubmitListeners()` est appelé. Le nouveau formulaire (s'il existe) reçoit un listener submit.
3. Si l'input password est orphelin (sans `<form>`), `attachOrphanPasswordListeners()` a déjà posé des listeners globaux `keydown` et `click` en capture sur `document` (l. 1489-1562). Ces listeners sont persistants et s'appliquent à tout input password présent dans `_snPasswordInputs` ou avec `type="password"` courant.
4. `registerPasswordInput()` est appelé sur tous les inputs `type="password"` présents au boot (l. 1760-1762). Pour les inputs ajoutés dynamiquement, `handleTypeAttributeMutation` les enregistre si leur type est muté, mais si l'input est créé directement en `type="password"` sans transition, il est capturé par `attachSubmitListeners()` ou par le listener global click/Enter.

**Fragilité identifiée — TACHE-097 (C-06)** : si React démonte puis remonte un input `type="password"` en recréant un nouvel élément DOM (pas une mutation d'attribut), le nouvel élément n'est pas enregistré dans `_snPasswordInputs` via `handleTypeAttributeMutation` (qui requiert une mutation d'attribut, pas une création). Il est en revanche capturé par `attachSubmitListeners()` si le `MutationObserver` détecte le nouveau noeud. Ce cas est documenté comme TACHE-097 (scénario TC-UC05-05-SPA).

**Conclusion** : le code couvre correctement le détachement/réattachement entre les étapes pour les cas Google (navigation complète) et Microsoft (SPA sans démontage de l'input password entre les étapes). Le cas Okta SAML avec démontage complet du composant React reste à confirmer en recette.

### 3.5 Synthèse de l'analyse code

| Question                                                                    | Réponse                                                                                             | Niveau de confiance                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `hostname` lu au submit ?                                                   | Oui — lu dans `handleFormSubmit()`, pas au moment de l'installation du listener                     | Confirmé (lecture directe ligne 1229)      |
| Hostname correct après `pushState` ?                                        | Oui — hash basé sur `hostname` uniquement, `pushState` ne change pas le hostname                    | Confirmé                                   |
| `observeDynamicForms` suffit pour les SPA multi-étape ?                     | Oui pour les cas P0 (Google, Microsoft)                                                             | Confirmé avec réserve sur le cas Okta SAML |
| `_snPasswordInputs` + `collectPasswordInputs` couvrent le cas multi-étape ? | Oui si le nouvel input est créé via mutation de type OU si le MutationObserver childList le détecte | Confirmé avec caveat TACHE-097             |
| Faut-il écouter `popstate`/`pushstate` ?                                    | Non — non nécessaire pour le cas d'usage M7 (hash sur hostname uniquement)                          | Confirmé                                   |

**Verdict global Partie 1** : le code gère correctement le multi-étape pour les cas P0 (Google et Microsoft). Aucun bug bloquant identifié. Une fragilité de niveau P1 (Okta SAML avec démontage complet du composant) est documentée en §5.

---

## 4. Scénarios de recette manuelle (Partie 2)

### 4.1 Conventions

**Format** : Given / When / Then  
**Sévérité des défauts** : P0 = bloquant release v1, P1 = doit être corrigé avant release, P2 = à corriger v1.1  
**Variables d'observation** : à relever manuellement dans la console DevTools (F12 > Console)

**Filtre console recommandé** : `Sentinel Nudge`

**Format des logs observables** :

```
Sentinel Nudge M7: sending password_submitted to SW  → domain_hash: <8 premiers hex>...
Sentinel Nudge M7: SW response received              → response: { success: true, action: "..." }
Sentinel Nudge M7: pending toast rendered             → domain_hash: <8 premiers hex>...
Sentinel Nudge password-detector: injected           → url: <hostname>
Sentinel Nudge: submit listeners attached            → newForms: N, pwdForms: N
```

**Pré-conditions communes** :

- Extension Sentinel Nudge installée et onboarding complété
- Module M7 activé dans les options
- Quota M7 non atteint (ou quota désactivé pour les tests)
- Compte de test dédié (ne pas utiliser de compte personnel — voir §6)
- Console DevTools ouverte sur l'onglet Console avant le début du scénario

---

### 4.2 Google — Flux multi-étape (P0)

**Profil technique** :

- URL étape 1 (email) : `https://accounts.google.com/signin/v2/identifier`
- URL étape 2 (password) : `https://accounts.google.com/signin/v2/challenge/pwd` (ou variante `/v2/challenge/pwd?TL=...`)
- Type de transition : navigation complète (nouvelle page, content script réinjecté)
- `location.hostname` constant : `accounts.google.com`
- `event.isTrusted` attendu : `true` (frappe clavier utilisateur réel)

---

#### Scénario GG-01 — Login nominal utilisateur réel

**Sévérité du défaut si échoue** : P0

**Pré-conditions** :

- Navigateur sur `https://accounts.google.com/signin/v2/identifier`
- Champ email vide
- Console DevTools ouverte

**Given** : l'utilisateur est sur l'écran de saisie email de Google  
**When** : il saisit son adresse email et clique sur "Suivant"  
**Then** : une navigation se produit vers `accounts.google.com/signin/v2/challenge/pwd`

**Given (suite)** : l'utilisateur est maintenant sur l'écran de saisie password  
**When** : il saisit son mot de passe et clique sur "Suivant" (ou presse Enter)  
**Then** :

1. Le log `Sentinel Nudge password-detector: injected` est visible avec `url: accounts.google.com` (confirme la réinjection)
2. Le log `Sentinel Nudge: submit listeners attached` est visible avec `pwdForms: 1`
3. Le log `Sentinel Nudge M7: sending password_submitted to SW` est visible avec `domain_hash: <8 hex>...`
4. Le log `Sentinel Nudge M7: SW response received` est visible
5. Le toast M7 s'affiche dans les 10 secondes (ou le log `pending toast rendered` est visible)
6. Le toast affiche le message de type "Mot de passe déjà utilisé" ou "Nouveau site" selon l'historique

**Valeurs à relever** :

- `location.hostname` observé dans le log inject : \_\_\_
- `domain_hash` (8 premiers hex) : \_\_\_
- `event.isTrusted` : non observable directement en console (filtre interne) — observer si le log `sending password_submitted` apparaît (si oui, isTrusted=true a passé le filtre)
- Comportement MutationObserver : le log `submit listeners attached` doit être distinct de celui de l'étape 1

**Critères d'acceptation** :

- [ ] Le log inject apparaît sur la page challenge/pwd (preuve de réinjection)
- [ ] Le log `sending password_submitted` apparaît exactement une fois
- [ ] Le toast M7 s'affiche

---

#### Scénario GG-02 — Retour arrière ("Autre compte") entre les deux écrans

**Sévérité du défaut si échoue** : P0

**Pré-conditions** :

- Navigateur sur `https://accounts.google.com/signin/v2/identifier`
- Console DevTools ouverte

**Given** : l'utilisateur est sur l'écran email de Google  
**When** : il saisit un email et clique sur "Suivant"  
**Then** : il arrive sur l'écran password

**When (suite)** : il clique sur "Utiliser un autre compte" (lien retour présent sous l'email affiché) ou appuie sur le bouton retour du navigateur  
**Then** : il retourne sur l'écran email

**When (suite)** : il saisit un email différent et clique sur "Suivant"  
**Then** : il arrive de nouveau sur l'écran password

**When (suite)** : il saisit son mot de passe et clique sur "Suivant"  
**Then** :

1. Le log `Sentinel Nudge M7: sending password_submitted` apparaît **exactement une fois** (pas de double envoi)
2. Le toast M7 s'affiche une seule fois
3. Aucun log d'erreur (`level: warn` ou `level: error`) n'est visible

**Valeurs à relever** :

- Nombre d'occurrences du log `sending password_submitted` : \_\_\_
- Nombre de toasts M7 affichés : \_\_\_
- Présence de logs `warn` ou `error` : \_\_\_

**Critères d'acceptation** :

- [ ] Le log `sending password_submitted` apparaît exactement une fois
- [ ] Aucun double toast M7
- [ ] Pas de log `warn` sur `installation_salt absent` ou `sendMessage failed`

**Note** : le guard anti-doublon est assuré par `submittedFields` (WeakSet, l. 1170-1171). Comme le retour arrière provoque une navigation complète, un nouveau content script est injecté avec un `submittedFields` vide — le guard porte uniquement sur la page courante. Le risque de double-capture concerne uniquement les soumissions multiples sur la même instance de page, pas les navigations successives.

---

#### Scénario GG-03 — Gestionnaire de mots de passe (Chrome PM / Bitwarden) dans le flux multi-étape

**Sévérité du défaut si échoue** : P0 (combinaison UC-01 + UC-02)

**Pré-conditions** :

- Gestionnaire de mots de passe actif : Chrome Password Manager intégré OU extension Bitwarden installée
- Entrée sauvegardée pour `accounts.google.com` dans le gestionnaire
- Navigateur sur `https://accounts.google.com/signin/v2/identifier`
- Console DevTools ouverte

**Given** : l'utilisateur est sur l'écran email de Google  
**When** : il saisit son email et clique sur "Suivant"  
**Then** : il arrive sur l'écran password

**When (suite)** : le gestionnaire de mots de passe remplit automatiquement le champ password (auto-fill)  
**Then** : le champ password contient le mot de passe sans interaction clavier de l'utilisateur

**When (suite)** : l'utilisateur clique manuellement sur le bouton "Suivant"  
**Then** :

1. Le log `sending password_submitted` apparaît (le clic physique sur "Suivant" produit un event submit avec `isTrusted=true`)
2. Le toast M7 s'affiche

**When (variante)** : le gestionnaire de mots de passe remplit ET soumet automatiquement (auto-submit)  
**Then** :

1. Le log `sending password_submitted` **n'apparaît pas** (le submit programmatique a `isTrusted=false`, filtré par le guard ligne 1167)
2. Aucun toast M7

**Valeurs à relever** :

- Type de gestionnaire testé : \_\_\_
- Comportement (auto-fill uniquement ou auto-fill + auto-submit) : \_\_\_
- Présence du log `sending password_submitted` en cas d'auto-submit : \_\_\_
- `event.isTrusted` observable indirectement : si log absent → isTrusted=false a bien été filtré

**Critères d'acceptation** :

- [ ] Auto-fill + clic manuel → M7 capture (log présent, toast affiché)
- [ ] Auto-submit → M7 ne capture pas (log absent, pas de toast)
- [ ] Aucun message d'erreur dans la console

**Note UC-02** : le filtre `event.isTrusted` (ligne 1167 de `handleFormSubmit`) est la protection principale contre les faux positifs liés aux gestionnaires. Ce scénario valide la combinaison UC-01 (multi-étape) + UC-02 (gestionnaire) en conditions réelles.

---

### 4.3 Microsoft — Flux multi-étape SPA (P0)

**Profil technique** :

- URL étape 1 et 2 : `https://login.microsoftonline.com/common/login` (URL identique)
- Type de transition : changement d'état React sans navigation (SPA)
- `location.hostname` constant : `login.microsoftonline.com`
- `event.isTrusted` attendu : `true`
- Content script : reste en vie (pas de réinjection entre les deux écrans)

---

#### Scénario MS-01 — Login nominal utilisateur réel

**Sévérité du défaut si échoue** : P0

**Pré-conditions** :

- Navigateur sur `https://login.microsoftonline.com/common/login` ou via une redirection depuis `https://login.live.com`
- Console DevTools ouverte

**Given** : l'utilisateur est sur l'écran email/username de Microsoft  
**When** : il saisit son identifiant et clique sur "Suivant"  
**Then** : l'écran change (React re-render) pour afficher le champ password, **sans navigation** (URL inchangée)

**Observation à ce moment** :

- Le log `Sentinel Nudge password-detector: injected` **ne doit pas** apparaître à nouveau (pas de réinjection)
- Le MutationObserver peut logger un `submit listeners attached` si le formulaire a été recréé par React

**When (suite)** : l'utilisateur saisit son mot de passe et clique sur "Se connecter" (ou presse Enter)  
**Then** :

1. Le log `Sentinel Nudge M7: sending password_submitted to SW` est visible
2. `domain_hash` préfixe correspond à `login.microsoftonline.com`
3. Toast M7 s'affiche (après navigation post-submit ou sur la même page via `storage.onChanged`)

**Valeurs à relever** :

- `location.hostname` observé dans le premier log inject : \_\_\_
- Second log inject présent à l'écran password ? (attendu : non) : \_\_\_
- `domain_hash` (8 premiers hex) : \_\_\_
- Log `submit listeners attached` lors du changement d'écran React : \_\_\_

**Critères d'acceptation** :

- [ ] Le log `sending password_submitted` apparaît
- [ ] Le `domain_hash` est bien celui de `login.microsoftonline.com`
- [ ] Le toast M7 s'affiche
- [ ] Le content script n'est pas réinjecté entre les deux écrans (pas de second log inject)

**Note** : si React recrée entièrement le formulaire lors du passage à l'écran password, `observeDynamicForms` détecte le nouveau noeud via `childList: true, subtree: true` et appelle `attachSubmitListeners()`. Ce comportement est attendu et correct.

---

#### Scénario MS-02 — Retour arrière entre les deux écrans Microsoft

**Sévérité du défaut si échoue** : P0

**Pré-conditions** :

- Navigateur sur `https://login.microsoftonline.com/common/login`
- Console DevTools ouverte

**Given** : l'utilisateur est sur l'écran email de Microsoft  
**When** : il saisit son identifiant et clique sur "Suivant"  
**Then** : l'écran password s'affiche (SPA)

**When (suite)** : l'utilisateur clique sur le lien "Retour" (flèche en haut à gauche de l'interface Microsoft)  
**Then** : l'écran email réapparaît (React re-render inverse)

**When (suite)** : l'utilisateur saisit un autre identifiant, clique "Suivant", puis saisit son mot de passe et clique "Se connecter"  
**Then** :

1. Le log `sending password_submitted` apparaît **exactement une fois**
2. Aucun double toast

**Valeurs à relever** :

- Nombre d'occurrences du log `sending password_submitted` : \_\_\_
- Présence de logs `warn` : \_\_\_

**Critères d'acceptation** :

- [ ] Le log `sending password_submitted` apparaît exactement une fois
- [ ] Aucun double toast M7

**Note** : dans le cas SPA, le content script reste en vie. Si React recrée le formulaire à chaque changement d'état, `_snSubmitAttached` sur l'ancien formulaire évite d'attacher deux fois un listener sur le même objet DOM. Si React crée un nouvel objet `<form>`, le nouveau formulaire reçoit son listener via `attachSubmitListeners()` déclenché par le MutationObserver. Le guard `submittedFields` (WeakSet sur l'input) reste actif tant que l'instance de l'input DOM n'est pas garbage-collected. Si React recycle le même élément DOM input, le guard est opérant. Si React crée un nouvel élément input, le guard ne s'y applique pas — mais c'est le comportement attendu (c'est une nouvelle saisie).

---

#### Scénario MS-03 — Gestionnaire de mots de passe dans le flux SPA Microsoft

**Sévérité du défaut si échoue** : P0

**Pré-conditions** :

- Gestionnaire de mots de passe avec entrée pour `login.microsoftonline.com`
- Navigateur sur `https://login.microsoftonline.com/common/login`
- Console DevTools ouverte

**Given** : l'utilisateur est sur l'écran email de Microsoft  
**When** : il saisit son identifiant et clique sur "Suivant"  
**Then** : l'écran password s'affiche

**When (suite)** : le gestionnaire de mots de passe détecte le champ password et propose un auto-fill  
**When (suite)** : l'utilisateur sélectionne l'entrée dans le gestionnaire (clic dans le menu de suggestion)  
**Then** : le champ password est rempli automatiquement

**When (suite)** : l'utilisateur clique manuellement sur "Se connecter"  
**Then** :

1. Le log `sending password_submitted` apparaît (clic manuel = `isTrusted=true`)
2. Toast M7 s'affiche

**Critères d'acceptation** :

- [ ] Remplissage automatique + clic manuel → M7 capture
- [ ] Remplissage automatique + soumission automatique → M7 ne capture pas

**Note** : Microsoft utilise `autocomplete="current-password"` sur le champ password. La fonction `hasPasswordManagerHint()` (ligne 242-248) détecte cet attribut et retourne `true`. Cela affecte M9 (formulaire de création) mais pas M7 directement. Observer si ce signal interfère avec l'overlay M2 (si actif sur microsoft.com).

---

### 4.4 Okta — Flux multi-étape (P1)

**Profil technique** :

- URL : `https://<tenant>.okta.com/login/login.htm` (configuration tenant-dépendante)
- Type de transition : variable selon configuration (SPA ou redirect)
- `location.hostname` : `<tenant>.okta.com` ou domaine vanity
- Note : scénarios P1 — moins fréquent grand public, priorité entreprise

**Pré-condition spécifique** : accès à un tenant Okta de test. Un tenant d'évaluation gratuit (30 jours) est disponible sur developer.okta.com. Voir §6 pour les instructions de création du compte de test.

> **⚠️ ACTION PRÉALABLE OBLIGATOIRE (AP-OK-01)** : créer le tenant Okta de test **avant toute exécution** des scénarios OK-01/02/03 en suivant la procédure du §6 "Prérequis d'exécution" (ligne "Okta"). Sans ce prérequis, les 3 scénarios OK sont **inexécutables**. Durée estimée : 15-20 min. Résultats à récupérer : URL du tenant (`https://dev-XXXXXXX.okta.com`), identifiants de l'utilisateur de test. Substituer `dev-XXXXXXX` par la valeur réelle dans les pré-conditions individuelles de OK-01, OK-02, OK-03 ci-dessous.

---

#### Scénario OK-01 — Login nominal Okta

**Sévérité du défaut si échoue** : P1

**Pré-conditions** :

- Tenant Okta de test disponible : `https://dev-XXXXXXX.okta.com`
- Compte utilisateur créé dans le tenant
- Navigateur sur `https://dev-XXXXXXX.okta.com/login/login.htm`
- Console DevTools ouverte

**Given** : l'utilisateur est sur la page de login Okta (champ username visible)  
**When** : il saisit son username et clique sur "Next"  
**Then** : selon la configuration du tenant —

- Cas SPA : l'interface change pour afficher le champ password (même URL)
- Cas redirect : navigation vers une URL différente du même hostname

**When (suite)** : l'utilisateur saisit son mot de passe et clique sur "Verify"  
**Then** :

1. Le log `Sentinel Nudge M7: sending password_submitted to SW` est visible
2. `domain_hash` préfixe correspond au hostname du tenant
3. Toast M7 s'affiche

**Valeurs à relever** :

- `location.hostname` observé : \_\_\_
- Type de transition observé (SPA ou navigation) : \_\_\_
- Log inject présent au changement d'étape (confirme navigation) : \_\_\_
- `domain_hash` (8 premiers hex) : \_\_\_

**Critères d'acceptation** :

- [ ] Le log `sending password_submitted` apparaît
- [ ] Le toast M7 s'affiche
- [ ] Le hostname dans le log inject correspond bien au tenant Okta

---

#### Scénario OK-02 — Retour arrière sur Okta

**Sévérité du défaut si échoue** : P1

**Pré-conditions** :

- Idem OK-01

**Given** : l'utilisateur est sur l'écran password Okta (après avoir saisi son username)  
**When** : il clique sur "Back" (lien présent dans l'interface Okta)  
**Then** : l'interface revient sur l'écran username

**When (suite)** : l'utilisateur ressaisit un username différent, clique "Next", puis saisit son mot de passe et clique "Verify"  
**Then** :

1. Le log `sending password_submitted` apparaît exactement une fois
2. Aucun double toast

**Critères d'acceptation** :

- [ ] Le log `sending password_submitted` apparaît exactement une fois
- [ ] Aucun double toast M7

---

#### Scénario OK-03 — Gestionnaire de mots de passe sur Okta

**Sévérité du défaut si échoue** : P1

**Pré-conditions** :

- Idem OK-01
- Gestionnaire de mots de passe avec entrée pour le tenant Okta

**Given** : l'utilisateur est sur l'écran password Okta  
**When** : le gestionnaire de mots de passe propose un auto-fill  
**When (suite)** : l'utilisateur sélectionne l'entrée et clique manuellement sur "Verify"  
**Then** :

1. Le log `sending password_submitted` apparaît
2. Toast M7 s'affiche

**Critères d'acceptation** :

- [ ] Remplissage + clic manuel → M7 capture
- [ ] Auto-submit si présent → M7 ne capture pas

---

## 5. Recommandations code (Partie 3)

### 5.1 Fragilité F-UC01-01 — Nouvel élément input créé par React sans mutation d'attribut

**Fichier** : `src/content-scripts/detectors/password-detector.ts`  
**Zone concernée** : fonction `observeDynamicForms()` (l. 1634), condition de détection des nouveaux noeuds (l. 1649-1658)

**Description** : le MutationObserver détecte les noeuds ajoutés au DOM contenant `input[type="password"]` (via `querySelector`). Si React crée un nouveau noeud `<form>` contenant un `input[type="password"]`, la condition est satisfaite et `attachSubmitListeners()` est appelé. Cependant, si React crée un `input[type="password"]` orphelin (sans `<form>` parent dans le noeud ajouté), la condition `(node as Element).tagName === 'FORM'` est fausse et la condition `querySelector` porte sur le noeud lui-même : si le noeud ajouté est l'input directement (et pas un conteneur), `querySelector` sur un `<input>` ne trouvera pas d'enfant.

**Correctif proposé** :

```typescript
// Avant (ligne 1652-1653)
(node as Element).tagName === 'FORM' ||
  (node as Element).querySelector?.('input[type="password"]')(
    // Après
    node as Element,
  ).tagName === 'FORM' ||
  ((node as Element).tagName === 'INPUT' && (node as HTMLInputElement).type === 'password') ||
  (node as Element).querySelector?.('input[type="password"]');
```

Lors de la détection d'un noeud `<input type="password">` ajouté directement, appeler `registerPasswordInput()` sur cet élément pour l'ajouter dans `_snPasswordInputs`, puis appeler `attachOrphanPasswordListeners()` si nécessaire (les listeners globaux sont déjà en place, `registerPasswordInput` suffit).

**Priorité** : Should — non bloquant pour les cas P0 (Google et Microsoft n'utilisent pas ce pattern dans leur flux principal). Peut devenir un vecteur de non-détection sur certains tenants Okta ou futures évolutions des SPA. Référencer comme complément de TACHE-097.

**Évaluation v1** : non bloquant v1. À traiter en v1.1 ou dans TACHE-097 étendu.

### 5.2 Aucun autre bug identifié nécessitant un correctif v1

Les points suivants sont confirmés corrects sans modification :

- Lecture de `location.hostname` au submit (et non à l'installation du listener)
- Guard anti-doublon `submittedFields` (WeakSet)
- Couverture du toggle show/hide via `_snPasswordInputs` + `collectPasswordInputs`
- Filtre `event.isTrusted` pour les auto-submits gestionnaires
- Pattern `pending_m7_toast` + `storage.onChanged` pour la resilience post-navigation
- `observeDynamicForms` pour les formulaires créés dynamiquement

---

## 6. Prérequis d'exécution (comptes de test)

| Fournisseur | Action requise                                                                                                                                                                                 | Responsable | Statut  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------- |
| Google      | Créer un compte Google dédié aux tests (`sentinel.nudge.test@gmail.com` ou équivalent). Ne pas utiliser de compte professionnel.                                                               | Testeur QA  | À créer |
| Microsoft   | Créer un compte Microsoft personnel dédié (`sentinel.nudge.test@outlook.com` ou équivalent). L'URL `login.microsoftonline.com/common/login` est accessible avec un compte Microsoft personnel. | Testeur QA  | À créer |
| Okta        | Créer un tenant développeur gratuit sur `developer.okta.com`. Créer un utilisateur de test dans le tenant. L'URL de login sera `https://dev-XXXXXXX.okta.com/login/login.htm`.                 | Testeur QA  | À créer |

**Règle de sécurité** : les mots de passe des comptes de test doivent être générés aléatoirement (gestionnaire de mots de passe), uniques, et non réutilisés. Le hash M7 calculé sur ces mots de passe sera stocké dans l'IndexedDB de l'extension — il s'agit de données de test sans valeur réelle.

**Note RGPD** : ces comptes sont des comptes de test. Les hash calculés restent locaux au navigateur de test et ne sont pas transmis à des tiers. Aucune obligation AIPD supplémentaire.

---

## 7. Tableau récapitulatif des scénarios

| ID    | Fournisseur | Type            | Sévérité | Dépendances                                 |
| ----- | ----------- | --------------- | -------- | ------------------------------------------- |
| GG-01 | Google      | Login nominal   | P0       | Compte Google test                          |
| GG-02 | Google      | Retour arrière  | P0       | Compte Google test                          |
| GG-03 | Google      | Gestionnaire PM | P0       | Compte Google test + PM installé            |
| MS-01 | Microsoft   | Login nominal   | P0       | Compte Microsoft test                       |
| MS-02 | Microsoft   | Retour arrière  | P0       | Compte Microsoft test                       |
| MS-03 | Microsoft   | Gestionnaire PM | P0       | Compte Microsoft test + PM installé         |
| OK-01 | Okta        | Login nominal   | P1       | Tenant Okta dev + compte test               |
| OK-02 | Okta        | Retour arrière  | P1       | Tenant Okta dev + compte test               |
| OK-03 | Okta        | Gestionnaire PM | P1       | Tenant Okta dev + compte test + PM installé |

**Total** : 9 scénarios — 6 P0 (Google + Microsoft), 3 P1 (Okta)

---

## 8. Tâches complémentaires à remonter au BACKLOG

### TACHE-101 (proposée) — Correctif détection input password orphelin ajouté directement par React

**Type** : TÂCHE  
**Priorité** : Should  
**Statut** : À faire  
**Phase** : P5  
**Responsable** : Développeur  
**Origine** : TACHE-068 / F-UC01-01  
**Description** : corriger la condition de détection dans `observeDynamicForms()` pour capturer les `<input type="password">` ajoutés directement comme noeuds racines (sans parent `<form>` dans le noeud ajouté). Correctif proposé en §5.1. Peut être consolidé avec TACHE-097 (TC-UC05-05-SPA).

### TACHE-063 (rappel) — Protocole recette manuelle formalisé

Le présent document constitue une contribution partielle à TACHE-063. Le protocole complet (Given/When/Then, pré-conditions, PV daté, P0/P1/P2) doit être complété pour UC-03 à UC-06 (TACHE-070/071/072/073). Le Testeur QA peut utiliser ce document comme gabarit.

---

## 9. Références

| Référence                      | Document                                                    |
| ------------------------------ | ----------------------------------------------------------- |
| TACHE-068                      | BACKLOG.md ligne 69                                         |
| TACHE-069 (UC-02 PM)           | `docs/p5-tests/p5-uc02-password-managers-scenarios-v1.0.md` |
| TACHE-072 (UC-05 toggle)       | BACKLOG.md + `password-detector.ts` l. 80-168               |
| TACHE-097 (TC-UC05-05-SPA)     | BACKLOG.md ligne 100                                        |
| ARB-UC02-01 (isTrusted)        | `password-detector.ts` l. 1162-1167                         |
| INV-UC05-01                    | `password-detector.ts` l. 113                               |
| Post-mortem M7                 | `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md`     |
| SFD §2.5 (M7)                  | `docs/p2-sfd-v1.1.md`                                       |
| ADR-002 CROSS-LIFECYCLE-INTENT | `docs/adr/adr-002-cross-lifecycle-intent.md`                |
