# Protocole de recette manuelle — Sentinel Nudge v1

> **Fichier unique de recette manuelle** — consolide tous les scenarios a derouler pour valider la release v1.
> Version v2.0 (2026-04-20) remplace les 7 fichiers precedents (liste en Annexe D).
> Pour chaque session de recette : copier `pv-recette-v1-2026-04-20-a-remplir.md` et renseigner les resultats.

**Ref protocole Fabrique** : TACHE-063 (protocole v1.0, PR #127) + TACHE-204 (consolidation v2.0).

---

## Table des matieres

1. [Objet](#1-objet)
2. [Perimetre](#2-perimetre)
3. [Priorites P0/P1/P2](#3-priorites)
4. [Methode generale](#4-methode-generale)
5. [Chapitre UC-01 — Login multi-etape](#5-chapitre-uc-01--login-multi-etape)
6. [Chapitre UC-02 — Gestionnaires de mots de passe](#6-chapitre-uc-02--gestionnaires-de-mots-de-passe)
7. [Chapitre UC-03 — Iframes same-origin](#7-chapitre-uc-03--iframes-same-origin)
8. [Chapitre UC-04 — Iframes cross-origin (limite documentee)](#8-chapitre-uc-04--iframes-cross-origin-limite-documentee)
9. [Chapitre UC-05 — Toggle show/hide password](#9-chapitre-uc-05--toggle-showhide-password)
10. [Chapitre UC-06 — Inputs password dynamiques (SPA React/Vue)](#10-chapitre-uc-06--inputs-password-dynamiques-spa-reactvue)
11. [Chapitre M2 — Typosquatting](#11-chapitre-m2--typosquatting)
12. [Chapitre M3 — Score hebdomadaire](#12-chapitre-m3--score-hebdomadaire)
13. [Chapitre M5 — Mise a jour navigateur](#13-chapitre-m5--mise-a-jour-navigateur)
14. [Chapitre M6 — Quiz spaced repetition](#14-chapitre-m6--quiz-spaced-repetition)
15. [Chapitre M9 — Donnees sensibles (saisie)](#15-chapitre-m9--donnees-sensibles-saisie)
16. [Chapitre M17 — Presse-papiers](#16-chapitre-m17--presse-papiers)
17. [Commandes DevTools utiles](#17-commandes-devtools-utiles)
18. [Annexe A — Matrice providers M7](#18-annexe-a--matrice-providers-m7)
19. [Annexe B — Scenarios NVDA (accessibilite)](#19-annexe-b--scenarios-nvda-accessibilite)
20. [Annexe C — Gabarit PV de recette](#20-annexe-c--gabarit-pv-de-recette)
21. [Annexe D — Historique de consolidation v1 -> v2](#21-annexe-d--historique-de-consolidation-v1---v2)

---

## 1. Objet et portee

Ce protocole formalise la recette manuelle de Sentinel Nudge v1 pour les six cas d'usage P0 identifies comme bloquants release par le post-mortem M7 (D-PM-05, 2026-04-14).

**Ce que ce protocole couvre** :

- Les criteres Pass/Fail nets pour chaque scenario, au format Given/When/Then
- Le gabarit de PV de recette datee et signable
- La procedure de mise en place de l'environnement de test et de reset entre sessions
- Les priorites P0/P1/P2 et leur definition contractuelle

**Ce que ce protocole ne couvre pas** :

- Les tests unitaires et d integration automatises (cf. tests unitaires Vitest dans `tests/unit/`, tests d integration dans `tests/integration/`, tests E2E Playwright dans `tests/e2e/` — 1133 tests total verifies en CI)
- Les modules M2/M3/M5/M6/M9/M17 hors contexte UC-01 a UC-06 (couverts dans les §11 a §16 du present document, consolides depuis l ancien `plan-tests-manuels-consolide-v1.0.md`, archive dans `docs/p5-recette/archive/`)
- La recette CI/E2E Playwright (TACHE-059) — le present protocole est complementaire et ne se substitue pas aux tests automatises ; toute anomalie decouverte ici doit generer un test de regression automatise

**Relation avec les documents existants** :

- Vue d ensemble TU + TI + E2E + Manuel : [`docs/p5-recette/plan-de-tests-global-v1.0.md`](./plan-de-tests-global-v1.0.md) — document pivot recensant la couverture exhaustive
- `docs/p5-recette/p5-matrice-compatibilite-providers-m7-v1.0.md` : liste des providers UC-01 testee — referenciee en Annexe A

---

## 2. Referentiel

### 2.1 Cas d'usage P0 bloquants v1

| UC    | Libelle                                                            | Module(s) | Mini-DAT                                              |
| ----- | ------------------------------------------------------------------ | --------- | ----------------------------------------------------- |
| UC-01 | Login multi-etape (email p1, password p2) — Google, Microsoft      | M7        | `p5-minidat-tache-068-uc01-login-multi-etape-v1.1.md` |
| UC-02 | Gestionnaires de mots de passe (KeePassXC, Bitwarden, Vaultwarden) | M7        | — (matrice providers)                                 |
| UC-03 | Iframes same-origin avec formulaire de connexion                   | M7        | `p5-minidat-tache-070-uc03-iframes-v1.0.md`           |
| UC-04 | Iframes cross-origin (limite documentee)                           | M7        | `p5-minidat-tache-070-uc03-iframes-v1.0.md` §1.2      |
| UC-05 | Toggle show/hide password (type="password" → type="text")          | M7        | `p5-minidat-tache-072-toggle-show-hide-v1.1.md`       |
| UC-06 | Inputs password ajoutes dynamiquement (SPA React/Vue)              | M7        | — (listener capture document)                         |

### 2.2 Modules concernes

| Module | Responsabilite                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------- |
| M7     | Detection de reutilisation de mots de passe (password-detector.ts) — module central pour tous les UC |
| M2     | Typosquatting — impact indirect (domain_hash)                                                        |
| M3     | Score hebdomadaire — impact indirect (quota)                                                         |
| M5     | Mise a jour navigateur — aucun impact direct sur UC-01 a UC-06                                       |
| M6     | Quiz spaced repetition — aucun impact direct                                                         |
| M9     | Detection donnees sensibles — interaction via `isCreationForm()` / filtre new-password               |
| M17    | Presse-papiers — aucun impact direct sur UC-01 a UC-06                                               |

---

## 3. Priorites

| Priorite | Definition                                                                                                                                    | Consequence sur la release                                  |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| P0       | **Bloquant release v1** — toute anomalie sur un scenario P0 empeche la publication de v1. Le scenario doit passer en Pass avant tout release. | Release BLOQUEE si 1 seul scenario P0 est en Fail           |
| P1       | **Bloquant v1.1** — anomalie acceptable pour la release v1 si documentee comme limite connue, mais doit etre corrigee avant v1.1.             | Release possible si anomalie documentee + ticket TACHE cree |
| P2       | **Nice-to-have** — comportement ameliorable mais non bloquant. Ticket Could dans le backlog.                                                  | Release possible sans action immediate                      |

---

## 4. Methode

### 4.1 Format Given/When/Then

Chaque scenario suit le format standard Gherkin :

```
**Given** (pre-condition) : etat de l'environnement et des donnees avant le test
**When** (action) : action(s) effectuee(s) par le testeur
**Then** (resultat attendu) : comportement observable attendu pour valider le scenario
```

Le critere **Pass** est atteint si ET SEULEMENT SI tous les points du Then sont verifies.
Le critere **Fail** est prononce si au moins un point du Then n'est pas satisfait.
Le statut **Skip** est admis si la pre-condition Given ne peut pas etre satisfaite (ex. absence de compte de test) — le testeur documente la raison dans le PV.

### 4.2 Pre-conditions obligatoires pour toute session de recette

Les conditions suivantes doivent etre verifiees avant d'executer le premier scenario :

1. **Extension fraichement construite** : `npm run build` termine sans erreur, `dist/` est peuple
2. **Chrome version requise** : Chrome v139 ou superieur (`chrome://settings/help`)
3. **Profil navigateur dedie** : utiliser un profil Chrome neuf (sans extensions tierces, sans historique) pour eviter les interferences. Creer via `chrome://settings/createProfile`
4. **Extension chargee en mode developpeur** :
   - `chrome://extensions` > activer "Mode developpeur"
   - "Charger l'extension non empaquetee" > selectionner `C:\Dev\sentinel-nudge\dist`
   - Verifier l'icone bouclier Sentinel Nudge dans la barre d'outils
5. **Storage reinitialise** entre chaque UC (commande ciblee Section 4.3)
6. **Console Service Worker ouverte** : `chrome://extensions` > cliquer "service worker" sur la carte Sentinel Nudge
7. **Donnees de test preparees** : compte Google et compte Microsoft avec mot de passe de test (different du mot de passe reel)

### 4.3 Reset du storage entre sessions

**AVERTISSEMENT** : ne jamais utiliser `chrome.storage.local.clear()` — cette commande efface `installation_salt` et `encryption_key_material`, rendant M7/M9/M2 silencieusement inoperants (incident P-016, post-mortem M7).

**Commande de reset ciblee** (console Service Worker) :

```javascript
await chrome.storage.local.remove([
  'm2_session_domains',
  'm2_trusted_domains',
  'm3_current_score',
  'm3_last_calculation',
  'm5_last_nudge_date',
  'm5_snooze_count',
  'm5_is_up_to_date',
  'm6_state',
  'm6_quiz_history',
  'm7_hashes_meta',
  'm7_suppressed_domains',
  'm7_cooldown',
  'quota_state',
  'pending_m7_toast',
  'pending_m5_update_reminder',
  'pending_m6_quiz',
  'pending_m17_toast',
]);
await chrome.runtime.reload();
```

**Verification post-reset** (console Service Worker) :

```javascript
const { installation_salt, encryption_key_material } = await chrome.storage.local.get([
  'installation_salt',
  'encryption_key_material',
]);
console.log('salt:', installation_salt ? 'OK' : 'ABSENT');
console.log('key:', encryption_key_material ? 'OK' : 'ABSENT');
```

Si `ABSENT` apparait pour l'un des deux, recharger l'extension depuis `chrome://extensions`.

### 4.4 Cycle executif

```
1. Verifier les pre-conditions (Section 4.2)
2. Reset storage (Section 4.3)
3. Executer les scenarios dans l'ordre documente
4. Pour chaque scenario : noter Pass/Fail/Skip + observations dans le gabarit PV
5. En cas de Fail : creer un incident au format ID-INC (Section 11)
6. En fin de session : signer le PV et soumettre au referent qualite
```

---


---

## 5. Chapitre UC-01 — Login multi-etape

Source detaillee : TACHE-068 mini-DAT (`docs/p5-decisions/p5-minidat-tache-068-uc01-login-multi-etape-v1.1.md`).

### 5.1 Conventions

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

### 5.2 Google — Flux multi-étape (P0)

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

### 5.3 Microsoft — Flux multi-étape SPA (P0)

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

### 5.4 Okta — Flux multi-étape (P1)

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


---

## 6. Chapitre UC-02 — Gestionnaires de mots de passe

Source detaillee : p5-uc02 v1.0 (archivee). ARB-UC02-01 (comite revue code TACHE-069/072, 2026-04-17) : M7 filtre `event.isTrusted=false` (cf. §17 regle E2E).

### Référence des identifiants de scénarios

Format : `S-UC02-[XX]-[NN]`

- `XX` : code gestionnaire (CP=Chrome PM, BW=Bitwarden, 1P=1Password, KX=KeePassXC, DL=Dashlane, VW=Vaultwarden)
- `NN` : numéro de scénario (01 à 04)

---

### 6.1 Chrome Password Manager (CPM) — P0

**Pré-requis d'installation** : Chrome PM est actif par défaut si l'utilisateur est connecté à un compte Google avec des mots de passe sauvegardés. Pour le test, utiliser un profil Chrome dédié avec un mot de passe sauvegardé pour `saucedemo.com`.

**Procédure de préparation du profil de test** :

1. Créer un nouveau profil Chrome (pas de synchronisation compte Google nécessaire)
2. Naviguer sur `https://saucedemo.com`
3. Saisir manuellement `standard_user` / `secret_sauce` et valider
4. Accepter la proposition d'enregistrement du mot de passe par Chrome
5. Réinitialiser l'état Sentinel Nudge (§3.2)

---

#### S-UC02-CP-01 — Chrome PM : auto-remplissage SANS submit

**Priorité scénario** : P0 — Bloquant release si échec

**Objectif** : Vérifier que M7 ne se déclenche pas sur un auto-remplissage sans soumission.

**Pré-conditions** :

- Chrome PM a sauvegardé les credentials pour `saucedemo.com`
- Storage M7 vide (§3.2)
- La page `https://saucedemo.com` est ouverte

**Given** : L'utilisateur navigue sur `https://saucedemo.com`, le formulaire de connexion est affiché avec les champs username et password vides.

**When** : L'utilisateur clique sur le champ password ou sur la suggestion de complétion automatique de Chrome PM (icône clé dans le champ), et Chrome PM remplit les deux champs — sans que l'utilisateur appuie sur Entrée ou clique sur le bouton de connexion.

**Then** :

- Aucun log `"Sentinel Nudge M7: sending password_submitted to SW"` n'apparaît dans la console
- Aucun toast M7 n'apparaît
- `pending_m7_toast` est absent de `chrome.storage.local` (vérifiable en DevTools Application > Storage > Local Storage)
- La détection M7 n'a pas été déclenchée

**Résultat attendu** : PASS si aucune alerte M7 n'est déclenchée.

**Sévérité si échec** : P0 — Faux positif systématique avec Chrome PM → extension inutilisable pour tout utilisateur Chrome avec PM actif.

**Comportement à documenter** :

- Valeur de `event.isTrusted` observée dans la console lors du remplissage (si un event submit est journalisé)
- Le remplissage auto se fait-il via un `input` event, un `change` event, ou directement par mutation de `.value` sans event ?

---

#### S-UC02-CP-02 — Chrome PM : auto-remplissage + submit manuel

**Priorité scénario** : P0 — Bloquant release si échec

**Objectif** : Vérifier que M7 capture correctement le hash après auto-remplissage suivi d'un submit manuel.

**Pré-conditions** :

- Chrome PM a sauvegardé les credentials pour `saucedemo.com`
- Storage M7 vide (§3.2)
- La page `https://saucedemo.com` est ouverte

**Given** : L'utilisateur a laissé Chrome PM auto-remplir les champs du formulaire `saucedemo.com`.

**When** : L'utilisateur clique manuellement sur le bouton "Login" (ou appuie sur Entrée).

**Then** :

- Le log `"Sentinel Nudge M7: sending password_submitted to SW"` apparaît dans la console (CS a capturé le submit)
- Le log `"M7Handler: message recu"` apparaît dans la console SW
- La réponse SW contient `{ success: true, action: "skip", reason: "no_reuse" }` (premier usage, pas de réutilisation)
- Un enregistrement est ajouté dans IndexedDB store `password_hashes` (vérifiable via DevTools Application > IndexedDB)
- Aucun toast M7 n'apparaît (pas de réutilisation)

**Résultat attendu** : PASS si le hash est capturé et stocké, sans toast (no_reuse attendu).

**Sévérité si échec** : P0 — Si M7 ne capture pas : faux négatif permanent pour les utilisateurs Chrome PM (protection désactivée de facto pour la majorité des utilisateurs).

**Comportement à documenter** :

- Valeur de `event.isTrusted` du submit event capturé (visible dans le log `"submit event captured"`)
- Chrome PM modifie-t-il le submit event de quelque façon ?

---

#### S-UC02-CP-03 — Chrome PM : auto-remplissage + auto-submit

**Priorité scénario** : P1 — Nuisance si comportement non défini

**Objectif** : Vérifier le comportement de M7 si Chrome PM déclenche la soumission programmatiquement.

**Note préalable** : Chrome PM (natif) ne déclenche pas d'auto-submit dans sa version standard. Ce scénario s'applique si une version future ou une configuration spécifique (ex. Single Sign-On Chrome Enterprise) déclenche un submit programmatique. Si le comportement ne peut pas être reproduit avec Chrome PM natif, le scénario est marqué "Non reproductible — comportement documenté uniquement".

**Pré-conditions** :

- Chrome PM a sauvegardé les credentials pour `saucedemo.com`
- Storage M7 vide (§3.2)
- La page `https://saucedemo.com` est ouverte

**Given** : Chrome PM détecte un formulaire de connexion connu et remplit automatiquement les champs.

**When** : Chrome PM déclenche la soumission programmatiquement (via `form.submit()` ou `form.requestSubmit()`), sans action utilisateur explicite.

**Then — comportement attendu (à définir avant exécution, cf. §5 ARB-UC02-01)** :

- **Option A (filtre isTrusted)** : Si M7 filtre `event.isTrusted=false`, aucun log de capture de submit, aucun hash stocké, aucun toast. Résultat attendu : PASS.
- **Option B (pas de filtre)** : M7 capture le submit, hash stocké, pas de toast (no_reuse). Résultat attendu : PASS si pas de toast intempestif.

**La décision sur le comportement attendu doit être prise par arbitrage AVANT l'exécution de ce scénario** (cf. §5 ARB-UC02-01).

**Sévérité si échec** : P1 — Toast affiché sans action utilisateur = nuisance ; capture manquée = faux négatif limité (cas rare).

**Comportement à documenter** :

- `event.isTrusted` du submit event observé
- Méthode de soumission utilisée par Chrome PM (`form.submit()` vs `form.requestSubmit()` vs click bouton)
- Timing entre auto-fill et submit (délai en ms)

---

#### S-UC02-CP-04 — Chrome PM : connexion répétée au même site (no_reuse)

**Priorité scénario** : P0 — Bloquant release si échec

**Objectif** : Vérifier qu'une deuxième connexion au même site avec le même mot de passe ne déclenche pas d'alerte (la réutilisation intra-domaine est explicitement ignorée).

**Pré-conditions** :

- Le scénario S-UC02-CP-02 a été exécuté avec succès (un hash pour `saucedemo.com` est stocké)
- `pending_m7_toast` : absent
- `m7_last_nudge_by_domain` : absent (pas de cooldown actif)
- La page `https://saucedemo.com` est ouverte

**Given** : L'utilisateur a déjà soumis le mot de passe de `saucedemo.com` lors d'une session précédente (hash stocké en IndexedDB avec le `domain_hash` de `saucedemo.com`).

**When** : L'utilisateur ouvre à nouveau `saucedemo.com`, Chrome PM auto-remplit, et l'utilisateur soumet manuellement le formulaire.

**Then** :

- Le log `"Sentinel Nudge M7: SW response received"` contient `{ action: "skip", reason: "no_reuse" }` (le handler M7 a ignoré la comparaison intra-domaine conformément à l'algorithme `isPasswordReused`)
- Aucun toast M7 n'apparaît

**Résultat attendu** : PASS si aucune alerte pour une reconnexion au même domaine.

**Sévérité si échec** : P0 — Faux positif systématique sur tout site revisité = extension inutilisable.

**Comportement à documenter** : Confirmer dans les logs que le handler a bien parcouru le store `password_hashes` et ignoré l'entrée pour `saucedemo.com` (`domain_hash` identique).

---

### 6.2 Bitwarden — P0

**Pré-requis d'installation** :

- Installer l'extension Bitwarden depuis le Chrome Web Store
- Créer un compte Bitwarden gratuit (ou utiliser un serveur Vaultwarden local)
- Enregistrer les credentials de test (`standard_user` / `secret_sauce` pour `saucedemo.com`) dans le coffre Bitwarden
- Déverrouiller le coffre avant les tests

---

#### S-UC02-BW-01 — Bitwarden : auto-remplissage SANS submit

**Priorité scénario** : P0 — Bloquant release si échec

**Objectif** : Vérifier que M7 ne se déclenche pas sur un auto-remplissage Bitwarden sans soumission.

**Pré-conditions** :

- Bitwarden déverrouillé, credentials `saucedemo.com` enregistrés
- Storage M7 vide (§3.2)
- Page `https://saucedemo.com` ouverte

**Given** : L'utilisateur navigue sur `https://saucedemo.com`, le formulaire de connexion est affiché.

**When** : L'utilisateur clique sur le bouton Bitwarden dans la toolbar ou utilise le raccourci clavier Bitwarden (`Ctrl+Shift+L`) pour déclencher le remplissage automatique des champs — sans soumettre le formulaire ensuite.

**Then** :

- Aucun log `"Sentinel Nudge M7: sending password_submitted to SW"` dans la console
- Aucun toast M7
- `pending_m7_toast` absent

**Résultat attendu** : PASS si aucune alerte.

**Sévérité si échec** : P0.

**Comportement à documenter** :

- Bitwarden déclenche-t-il un event `input`, `change` ou aucun event lors du remplissage ?
- Bitwarden utilise-t-il `element.value = ...` (sans event) ou `InputEvent` synthétique ?

---

#### S-UC02-BW-02 — Bitwarden : auto-remplissage + submit manuel

**Priorité scénario** : P0 — Bloquant release si échec

**Objectif** : Vérifier que M7 capture le hash après remplissage Bitwarden + submit manuel.

**Pré-conditions** :

- Bitwarden déverrouillé, credentials `saucedemo.com` enregistrés
- Storage M7 vide (§3.2)

**Given** : Bitwarden a auto-rempli les champs de connexion `saucedemo.com`.

**When** : L'utilisateur clique manuellement sur "Login".

**Then** :

- Log `"Sentinel Nudge M7: sending password_submitted to SW"` présent
- Réponse SW : `{ success: true, action: "skip", reason: "no_reuse" }`
- Un hash enregistré en IndexedDB `password_hashes`
- Aucun toast

**Résultat attendu** : PASS.

**Sévérité si échec** : P0.

**Comportement à documenter** :

- `event.isTrusted` du submit : attendu `true` (action utilisateur physique)
- Bitwarden ajoute-t-il des attributs DOM (`data-form-type`, `data-bwautofill`, etc.) ? Ceux-ci pourraient interférer avec la détection `hasPasswordManagerHint()` qui filtre `data-form-type`.

**Attention** : le code actuel (`hasPasswordManagerHint()`, ligne 150-157 de password-detector.ts) retourne `true` si `field.hasAttribute('data-form-type')` est présent — ce qui entraîne un `return` prématuré dans `handleFocusOnPasswordField` et **pourrait bloquer M7 si le submit n'est pas capturé autrement**. Vérifier si Bitwarden injecte cet attribut.

---

#### S-UC02-BW-03 — Bitwarden : auto-remplissage + auto-submit

**Priorité scénario** : P0 — Bloquant release si comportement non défini

**Objectif** : Tester le comportement de M7 quand Bitwarden effectue un auto-submit (option "Auto-fill on page load" activée dans les paramètres Bitwarden).

**Pré-conditions** :

- Bitwarden déverrouillé, credentials `saucedemo.com` enregistrés
- **Activer** l'option Bitwarden "Auto-fill on page load" (Paramètres Bitwarden > Options > Auto-fill on page load)
- Storage M7 vide (§3.2)

**Given** : L'utilisateur navigue sur `https://saucedemo.com`.

**When** : Bitwarden détecte le formulaire connu, remplit les champs et soumet automatiquement le formulaire sans action utilisateur.

**Then — comportement attendu (cf. §5 ARB-UC02-01)** :

- Observer si un `submit` event est déclenché
- Observer la valeur de `event.isTrusted` dans le log `"submit event captured"`
- Si Bitwarden utilise `form.submit()` : `event.isTrusted = false` ou pas d'event submit du tout
- Si Bitwarden utilise `form.requestSubmit()` : un `submit` event avec `event.isTrusted = false`
- Si Bitwarden clique programmatiquement le bouton submit : `event.isTrusted = false`

**Résultat attendu** : Dépend de l'arbitrage ARB-UC02-01. Documenter le comportement observé sans verdict PASS/FAIL jusqu'à la décision d'arbitrage.

**Sévérité si comportement non défini** : P0 — Ce scénario est le coeur de la problématique UC-02.

**Comportement à documenter** :

- `event.isTrusted` observé
- Méthode de soumission (form.submit, form.requestSubmit, click bouton)
- Délai entre affichage de la page et auto-submit (ms)
- M7 est-il déclenché ou non ?

---

#### S-UC02-BW-04 — Bitwarden : connexion répétée au même site (no_reuse)

**Priorité scénario** : P0

**Objectif** : Vérifier l'absence de faux positif sur un site revisité avec Bitwarden.

**Pré-conditions** :

- S-UC02-BW-02 exécuté avec succès (hash `saucedemo.com` en IndexedDB)
- `pending_m7_toast` absent
- Cooldown non actif

**Given** : Le hash de `saucedemo.com` est déjà stocké en IndexedDB.

**When** : L'utilisateur ouvre `saucedemo.com`, Bitwarden remplit, l'utilisateur soumet manuellement.

**Then** :

- Réponse SW : `{ action: "skip", reason: "no_reuse" }`
- Aucun toast

**Résultat attendu** : PASS.

**Sévérité si échec** : P0.

---

### 6.3 1Password — P1

**Pré-requis d'installation** :

- Installer l'extension 1Password pour Chrome (extension officielle)
- Disposer d'un compte 1Password (version d'essai acceptée)
- Enregistrer les credentials de test dans 1Password
- Déverrouiller le coffre avant les tests

---

#### S-UC02-1P-01 — 1Password : auto-remplissage SANS submit

**Priorité scénario** : P1

**Objectif** : Vérifier l'absence de détection M7 sur auto-remplissage seul.

**Pré-conditions** : 1Password déverrouillé, credentials `saucedemo.com` enregistrés, storage M7 vide.

**Given** : Formulaire `saucedemo.com` affiché.

**When** : L'utilisateur utilise l'interface 1Password (popup ou inline suggestion) pour remplir les champs sans soumettre.

**Then** :

- Aucun log M7 send, aucun toast.

**Sévérité si échec** : P1.

**Comportement à documenter** :

- 1Password injecte-t-il `data-form-type` sur le champ ? Si oui, M7 sera aveugle au focus sur ce champ (impact sur M2 et M9 également).
- 1Password déclenche-t-il un event `input` synthétique ?

---

#### S-UC02-1P-02 — 1Password : auto-remplissage + submit manuel

**Priorité scénario** : P1

**Objectif** : Vérifier la capture du hash après remplissage 1Password + submit utilisateur.

**Pré-conditions** : 1Password déverrouillé, credentials enregistrés, storage M7 vide.

**Given** : 1Password a rempli le formulaire `saucedemo.com`.

**When** : L'utilisateur clique sur "Login".

**Then** :

- Log M7 send présent, réponse `no_reuse`, hash stocké.

**Sévérité si échec** : P1.

**Comportement à documenter** : `event.isTrusted` du submit ; présence attribut `data-form-type` (risque de court-circuit dans `handleFocusOnPasswordField`).

---

#### S-UC02-1P-03 — 1Password : auto-remplissage + auto-submit

**Priorité scénario** : P1

**Objectif** : Tester le comportement M7 lors d'un auto-submit 1Password.

**Note** : 1Password propose une option "Auto-submit after auto-fill" dans ses paramètres avancés.

**Pré-conditions** : Activer "Auto-submit after auto-fill" dans les paramètres 1Password ; storage M7 vide.

**Given** : L'utilisateur navigue sur un site avec credentials connus dans 1Password.

**When** : 1Password auto-remplit et auto-soumet sans interaction utilisateur.

**Then** : Observer et documenter (cf. ARB-UC02-01 pour le verdict attendu).

**Sévérité si comportement non défini** : P1.

**Comportement à documenter** :

- `event.isTrusted` observé
- 1Password clique-t-il le bouton ou appelle `form.requestSubmit()` ?
- Délai fill → submit (ms)

---

#### S-UC02-1P-04 — 1Password : connexion répétée (no_reuse)

**Priorité scénario** : P1

**Objectif** : Vérifier l'absence de faux positif sur site revisité.

**Pré-conditions** : S-UC02-1P-02 exécuté avec succès.

**Given/When/Then** : Identique à S-UC02-CP-04, avec 1Password comme PM.

**Sévérité si échec** : P1.

---

### 6.4 KeePassXC — P1

**Pré-requis d'installation** :

- Installer KeePassXC (version Windows, open source)
- Installer l'extension KeePassXC-Browser pour Chrome
- Créer une base de données KeePassXC avec credentials de test
- Activer l'intégration navigateur dans KeePassXC (Outils > Paramètres > Intégration navigateur)
- Ouvrir et déverrouiller la base de données avant les tests

---

#### S-UC02-KX-01 — KeePassXC : auto-remplissage SANS submit

**Priorité scénario** : P1

**Objectif** : Vérifier l'absence de détection M7 sur auto-remplissage seul.

**Pré-conditions** : KeePassXC déverrouillé, credentials `saucedemo.com` enregistrés, storage M7 vide.

**Given** : Formulaire `saucedemo.com` affiché.

**When** : L'utilisateur déclenche le remplissage via l'extension KeePassXC-Browser (icône dans le champ ou raccourci `Ctrl+Shift+U`) sans soumettre.

**Then** : Aucun log M7 send, aucun toast.

**Sévérité si échec** : P1.

**Comportement à documenter** :

- KeePassXC-Browser injecte-t-il `data-form-type` ou d'autres attributs ?
- Le remplissage se fait-il via événements synthétiques ou mutation directe de `.value` ?

---

#### S-UC02-KX-02 — KeePassXC : auto-remplissage + submit manuel

**Priorité scénario** : P1

**Given** : KeePassXC-Browser a rempli le formulaire. **When** : Submit utilisateur. **Then** : Hash capturé, `no_reuse`.

**Sévérité si échec** : P1.

---

#### S-UC02-KX-03 — KeePassXC : auto-remplissage + auto-submit

**Priorité scénario** : P1

**Note** : KeePassXC-Browser propose une option d'auto-submit dans les paramètres de l'entrée (champ "Auto-Type"). Vérifier si l'extension Chrome déclenche un auto-submit.

**Given** : Option auto-submit KeePassXC activée pour l'entrée test.

**When** : L'utilisateur déclenche le remplissage automatique complet (remplissage + submit).

**Then** : Observer et documenter (cf. ARB-UC02-01).

**Comportement à documenter** : `event.isTrusted`, méthode de soumission, délai.

**Sévérité si comportement non défini** : P1.

---

#### S-UC02-KX-04 — KeePassXC : connexion répétée (no_reuse)

**Priorité scénario** : P1

**Given/When/Then** : Identique à S-UC02-CP-04, avec KeePassXC. **Sévérité si échec** : P1.

---

### 6.5 Dashlane — P2

**Pré-requis d'installation** :

- Installer l'extension Dashlane pour Chrome
- Compte Dashlane (version d'essai acceptée)
- Credentials de test enregistrés dans Dashlane

---

#### S-UC02-DL-01 — Dashlane : auto-remplissage SANS submit

**Priorité** : P2. **Sévérité si échec** : P2.

**Given** : Formulaire affiché. **When** : Remplissage Dashlane, pas de submit. **Then** : Aucun M7.

**Comportement à documenter** : Dashlane a été observé dans les logs post-mortem (PV §4.1). Documenter précisément le mécanisme de remplissage (attributs injectés, events déclenchés).

---

#### S-UC02-DL-02 — Dashlane : auto-remplissage + submit manuel

**Priorité** : P2.

**Given** : Dashlane a rempli. **When** : Submit manuel. **Then** : Hash capturé, `no_reuse`.

**Sévérité si échec** : P2.

---

#### S-UC02-DL-03 — Dashlane : auto-remplissage + auto-submit

**Priorité** : P2.

**Note** : Dashlane propose un mode "Connexion automatique" pour les sites de confiance.

**Given** : Connexion automatique Dashlane activée pour le site de test.

**When** : Navigation sur le site, Dashlane déclenche le remplissage et la soumission.

**Then** : Documenter le comportement (cf. ARB-UC02-01 pour le verdict).

**Comportement à documenter** : `event.isTrusted`, méthode submit, délai, logs observés.

**Sévérité si comportement non défini** : P2.

---

#### S-UC02-DL-04 — Dashlane : connexion répétée (no_reuse)

**Priorité** : P2. **Given/When/Then** : Identique aux -04 précédents. **Sévérité si échec** : P2.

---

### 6.6 Vaultwarden — P2

**Pré-requis d'installation** :

- Docker Desktop installé (pour l'instance Vaultwarden locale)
- Lancer Vaultwarden : `docker run -d --name vaultwarden -p 8080:80 vaultwarden/server:latest`
- Configurer le client Bitwarden pour pointer sur `http://localhost:8080` (Settings > Self-hosted environment)
- Créer un compte et enregistrer les credentials de test
- **Note** : HTTPS requis pour certaines fonctions Bitwarden. Utiliser un tunnel ngrok ou accepter les limitations HTTP en test local.

**Principe de couverture** : Les scénarios S-UC02-VW-01 à 04 reproduisent exactement les scénarios S-UC02-BW-01 à 04 avec le client Bitwarden pointant sur Vaultwarden. Si les résultats sont identiques à Bitwarden (P0), indiquer "Couvert par Bitwarden — comportement identique" et clore les scénarios P2.

Les scénarios ne sont pas dupliqués ici ; se référer aux scénarios S-UC02-BW-01 à 04 avec la note de contexte Vaultwarden.

---


---

## 7. Chapitre UC-03 — Iframes same-origin

**Modules** : M7
**Mini-DAT** : `docs/p5-decisions/p5-minidat-tache-070-uc03-iframes-v1.0.md`
**Pre-requis fonctionnel** : `"all_frames": true` doit etre present dans `src/manifest.json` (TACHE-066). Si absent, tous les scenarios UC-03 sont en Fail par construction — verifier le manifest avant d'executer.
**Verification manifest** :

```javascript
// Console SW — verifier que all_frames est actif
const manifest = chrome.runtime.getManifest();
console.log(JSON.stringify(manifest.content_scripts, null, 2));
// Chercher "all_frames": true dans la reponse
```

---

**SC-UC03-01** | Priorite : P0 | Modules : M7
**Scenario** : Iframe same-origin — detection M7 sur formulaire login dans une iframe

```
Given : Extension installee avec all_frames=true dans le manifest. Storage reinitialise.
        Page de test contenant une iframe <iframe src="https://memedomaine.test/login/frame">
        (same-origin : protocole + domaine + port identiques au top frame).
        Un mot de passe de test enregistre dans M7 pour ce domaine.
When  : Ouvrir la page conteneur. Cliquer dans l'iframe et remplir le formulaire login.
        Soumettre le formulaire dans l'iframe.
Then  : Le content script est injecte dans l'iframe (frameId > 0 visible dans les logs SW).
        M7 capture le submit depuis l'iframe.
        Le domain_hash correspond au domaine same-origin (coherent avec le top frame).
        Le toast M7 s'affiche UNE SEULE FOIS (guard window.self === window.top actif — INV-UC03-07).
```

---

**SC-UC03-02** | Priorite : P0 | Modules : M7
**Scenario** : Iframe same-origin — absence de double toast (guard top-frame)

```
Given : Meme configuration qu'en SC-UC03-01. Reutilisation de mot de passe detectable.
When  : Soumettre le formulaire dans l'iframe.
        Observer attentivement l'affichage : un seul toast ou plusieurs ?
Then  : Un seul toast M7 s'affiche, meme si deux instances content script sont actives
        (top frame + iframe). Le guard INV-UC03-07 est operationnel.
        Aucun doublon de toast. Aucune erreur en console SW.
```

---


---

## 8. Chapitre UC-04 — Iframes cross-origin (limite documentee)

**Modules** : M7
**Mini-DAT** : `docs/p5-decisions/p5-minidat-tache-070-uc03-iframes-v1.0.md` §1.2
**Priorite globale UC-04** : P1

**Limite documentee — a valider** :

Les iframes cross-origin (protocole, domaine ou port different du top frame) sont hors perimetre de detection M7 pour Sentinel Nudge v1. Cette limite est inherente au modele de securite Chrome MV3 : Chrome n'injecte pas le content script dans des iframes cross-origin pour des raisons de securite et de confidentialite (isolation des origines). Ce n'est pas un bug — c'est une limite de conception documentee et acceptee.

---

**SC-UC04-01** | Priorite : P1 | Modules : M7
**Scenario** : Iframe cross-origin — verification de la limite (pas de detection attendue)

```
Given : Extension installee. Storage reinitialise.
        Page de test contenant une iframe cross-origin :
        <iframe src="https://autredomaine.test/login/frame"> (domaine different du top frame).
When  : Ouvrir la page conteneur. Remplir et soumettre le formulaire dans l'iframe cross-origin.
Then  : M7 NE detecte PAS la soumission dans l'iframe cross-origin.
        Aucun message password_submitted dans la console SW pour cette soumission.
        Comportement attendu et conforme a la limite documentee UC-04.
        [PASS = absence de detection confirmee et documentee dans le PV]
```

**Note PV obligatoire** : inscrire explicitement dans la colonne Observations du PV :
"UC-04 — Limite confirmee : iframes cross-origin hors perimetre M7 v1. Comportement conforme."

---


---

## 9. Chapitre UC-05 — Toggle show/hide password

**Modules** : M7
**Mini-DAT** : `docs/p5-decisions/p5-minidat-tache-072-toggle-show-hide-v1.1.md`
**Pre-requis fonctionnel** : MutationObserver etendu aux mutations d'attribut `type` (TACHE-067). Si la correction n'est pas implementee, SC-UC05-01 sera en Fail — verifier la version du build.

---

**SC-UC05-01** | Priorite : P0 | Modules : M7
**Scenario** : Toggle show — submit avec type="text" (apres clic "voir mot de passe")

```
Given : Extension installee. Storage reinitialise.
        Page de test avec <input type="password"> + bouton toggle "voir".
        Mot de passe de test enregistre dans M7 pour ce domaine.
When  : Focus sur le champ password. Cliquer le bouton "voir" (type passe en "text").
        Saisir le mot de passe de test dans le champ type="text" (ou laisser la valeur deja saisie).
        Soumettre le formulaire.
Then  : M7 capture la valeur du champ malgre le type="text" au moment du submit.
        Message password_submitted visible en console SW.
        Hash calcule pour le domaine. Toast si reutilisation detectable.
        Invariant INV-UC05-01 respecte : l'input reste dans _snPasswordInputs apres le toggle.
```

---

**SC-UC05-02** | Priorite : P0 | Modules : M7
**Scenario** : Toggles multiples rapides — un seul hash envoye au submit

```
Given : Extension installee. Storage reinitialise. Page de test avec champ password + bouton toggle.
When  : Cliquer le bouton toggle 5 fois en moins de 500ms (password→text→password→text→password).
        Saisir la valeur. Soumettre.
Then  : Un seul message password_submitted envoye au SW pour ce champ.
        Pas de doublon de hash. Guard submittedFields (WeakSet) operationnel (INV-UC05-03).
        Aucune erreur en console SW.
```

---

**SC-UC05-03** | Priorite : P1 | Modules : M7, M9
**Scenario** : Input demarrant en type="text", toggle vers type="password" avant submit

```
Given : Extension installee. Storage reinitialise.
        Page avec <input type="text" id="pwd"> modifie en type="password" par JS apres chargement
        (pattern lazy-defined identifie dans ARB-072-02).
When  : Le JS de la page change le type de "text" vers "password".
        Saisir le mot de passe. Soumettre.
Then  : M7 capture l'input (INV-UC05-02 : inputs lazy-defined couverts par ARB-072-02).
        Hash calcule et envoye. Aucune omission silencieuse.
```

---


---

## 10. Chapitre UC-06 — Inputs password dynamiques (SPA React/Vue)

Source detaillee : p5-uc06 v1.0 (archivee). 5 scenarios S-UC06-01 a -05 couvrant React useEffect delay, Vue modal, input conditionnel, re-render complet, input nu sans form.


### 10.1 S-UC06-01 — React useEffect delay 100ms

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

### 10.2 S-UC06-02 — Modal Vue avec form password à la demande

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

### 10.3 S-UC06-03 — Input password conditionnel après validation email

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

### 10.4 S-UC06-04 — Re-render complet après "Wrong password"

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

### 10.5 S-UC06-05 — Input nu sans `<form>` créé par React sans wrapping

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


---

## 11. Chapitre M2 — Typosquatting

**Module** : M2 — Detection de sites suspects (typosquatting / HTTP non-securise)
**Pre-requis** : M2 active dans les options Sentinel Nudge

---

### TC-M2-01 — Detection typosquatting

**Criticite** : P1

**Pre-condition** : naviguer sur un site dont le domaine figure dans `src/assets/data/typosquatting-targets.json` ou un domaine similaire avec faute de frappe (ex. `g00gle.com`)

**Given** : l'utilisateur arrive sur un site suspect
**When** : la page se charge
**Then** :
1. Un overlay M2 "Site suspect detecte" s'affiche
2. L'overlay comporte un bouton "Faire confiance a ce site" et un bouton "Quitter"
3. Cliquer "Faire confiance" ajoute le domaine a la whitelist (`chrome.storage.local` cle `m2_trusted_domains`)

**Verification whitelist** (console SW) :
```javascript
const { m2_trusted_domains } = await chrome.storage.local.get(['m2_trusted_domains']);
console.log('Trusted domains:', m2_trusted_domains);
```

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M2-02 — Detection HTTP non-securise

**Criticite** : P1

**Pre-condition** : naviguer sur un site HTTP (non HTTPS) avec un formulaire de login

**Given** : l'utilisateur est sur un site HTTP avec un champ password
**When** : il clique sur le champ password (focus)
**Then** :
1. L'overlay M2 "Connexion non securisee" s'affiche
2. Le domaine n'est pas dans la whitelist

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M2-03 — Whitelist persistante (session suivante)

**Criticite** : P1

**Pre-condition** : TC-M2-01 execute, site X ajoute a la whitelist

**Given** : l'utilisateur retourne sur le site X lors d'une nouvelle session de navigation
**When** : la page se charge
**Then** : l'overlay M2 ne s'affiche PAS (whitelist persistee via `chrome.storage.local`)

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

## 12. Chapitre M3 — Score hebdomadaire

**Module** : M3 — Score de cyber-hygiene hebdomadaire
**Pre-requis** : M3 active, evenements generes (au moins quelques interactions M5/M6/M7 prealables)

---

### TC-M3-01 — Calcul et affichage du score

**Criticite** : P1

**Declenchement manuel** (console SW) :
```javascript
// Generer quelques evenements de test
await chrome.storage.local.set({ m5_is_up_to_date: true });
await chrome.runtime.sendMessage({
  module: 'M6', action: 'quiz_completed',
  payload: { question_id: 'phishing_01', answer_correct: true, answer_index: 0, response_time_ms: 4500 },
  timestamp: Date.now(),
});

// Forcer le calcul du score
const response = await chrome.runtime.sendMessage({
  module: 'M3', action: 'calculate_score', payload: {}, timestamp: Date.now(),
});
console.log('Score M3:', response);
```

**Given** : des evenements M5/M6/M7 ont ete generes
**When** : le calcul M3 est force via la commande ci-dessus
**Then** :
1. `response.data.score` contient un nombre entre 0 et 100
2. Ouvrir la popup (icone bouclier) — le score s'affiche dans la jauge circulaire
3. Couleur attendue : vert si >=70, orange si 40-69, rouge si <40
4. Bouton "Voir le detail" ouvre le dashboard avec l'historique

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M3-02 — Reinitialisation score

**Criticite** : P1

**Reinitialisation** (console SW) :
```javascript
await chrome.storage.local.remove(['m3_last_calculation', 'm3_current_score', 'm5_is_up_to_date']);
await chrome.runtime.reload();
```

**Given** : le storage M3 est reinitialise
**When** : le score est recalcule (commande TC-M3-01)
**Then** : le score est recalcule a partir de zero (aucune donnee residuelle)

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

## 13. Chapitre M5 — Mise a jour navigateur

**Module** : M5 — Detection et nudge mise a jour Chrome
**Pre-requis** : M5 active dans les options

---

### TC-M5-01 — Check de mise a jour (simulation)

**Criticite** : P1

**Declenchement manuel** (console SW) :
```javascript
// Monkey-patch pour simuler une MAJ disponible
const original = chrome.runtime.requestUpdateCheck;
chrome.runtime.requestUpdateCheck = (cb) => {
  cb('update_available', { version: '999.0.0.0' });
};

// Lancer le check
const response = await chrome.runtime.sendMessage({
  module: 'M5', action: 'check_update', payload: {}, timestamp: Date.now(),
});
console.log('M5 response:', response);

// Restaurer apres le test
chrome.runtime.requestUpdateCheck = original;
```

**Given** : la simulation de MAJ disponible est activee
**When** : le check M5 est force
**Then** :
1. Toast bleu "Mettre a jour votre navigateur" s'affiche sur l'onglet actif
2. Boutons : "Mettre a jour maintenant", "Plus tard", "En savoir plus"
3. "Plus tard" incremente `m5_snooze_count` (verifier via `chrome.storage.local.get(['m5_snooze_count'])`)
4. "Mettre a jour" ouvre `chrome://settings/help`

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M5-02 — Chrome a jour (pas de toast)

**Criticite** : P1

**Declenchement** (console SW) :
```javascript
const response = await chrome.runtime.sendMessage({
  module: 'M5', action: 'check_update', payload: {}, timestamp: Date.now(),
});
console.log('M5 response (should be skip/no_update):', response);
```

**Given** : Chrome est a jour
**When** : le check M5 est lance sans monkey-patch
**Then** : `response.action === 'skip'` et `response.reason === 'no_update'` — aucun toast

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

## 14. Chapitre M6 — Quiz spaced repetition

**Module** : M6 — Quiz de sensibilisation phishing
**Pre-requis** : M6 active, un onglet HTTPS ouvert (ex. `https://example.com`)

---

### TC-M6-01 — Declenchement quiz

**Criticite** : P1

**Declenchement manuel** (console SW) :
```javascript
// Forcer la date du prochain quiz a hier
await chrome.storage.local.set({
  m6_state: {
    next_quiz_date: Date.now() - 86400000,
    last_quiz_date: null,
    streak_count: 0,
    interval_index: 0,
  },
});

// Declencher le check
const response = await chrome.runtime.sendMessage({
  module: 'M6', action: 'check_quiz', payload: {}, timestamp: Date.now(),
});
console.log('M6 response:', response);
```

**Given** : la date du prochain quiz est forcee dans le passe
**When** : le check M6 est lance
**Then** :
1. `response.action === 'show'`
2. Un overlay quiz apparait sur l'onglet HTTPS actif : question + 4 reponses
3. Cliquer sur une reponse → feedback immediat (correct/incorrect) + explication + bouton "Continuer"
4. Apres le quiz, `m6_state.streak_count` incremente (verifier via `chrome.storage.local.get(['m6_state'])`)

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M6-02 — Progression spaced repetition

**Criticite** : P1

**Pre-condition** : plusieurs quiz completes avec des scores variables

**Given** : l'utilisateur a repond incorrectement a plusieurs questions
**When** : le quiz suivant est declenche
**Then** : `m6_state.interval_index` est ajuste selon l'algorithme SM-2 (intervalle reduit si score <50%)

**Verification** :
```javascript
const { m6_state } = await chrome.storage.local.get(['m6_state']);
console.log('M6 state:', m6_state);
// interval_index et next_quiz_date doivent etre coherents avec le score obtenu
```

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

## 15. Chapitre M9 — Donnees sensibles (saisie)

**Module** : M9 — Detection de saisie de donnees sensibles (IBAN, SSN, etc.)
**Pre-requis** : M9 active dans les options, onglet HTTPS ouvert

---

### TC-M9-01 — Detection saisie IBAN

**Criticite** : P1

**Pre-condition** : naviguer sur une page avec un champ text libre

**Given** : l'utilisateur est sur une page HTTPS avec un champ texte
**When** : il saisit un IBAN fictif (ex. `FR7630006000011234567890189`) dans le champ
**Then** :
1. Un nudge M9 s'affiche apres saisie
2. Le toast ou overlay indique que des donnees sensibles ont ete detectees
3. Aucune valeur en clair n'est loggee dans la console

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M9-02 — Non-declenchement sur champ password

**Criticite** : P1

**Pre-condition** : page avec `<input type="password">`

**Given** : l'utilisateur est sur un formulaire avec champ password
**When** : il saisit des donnees dans le champ `type="password"`
**Then** : M9 ne se declenche PAS (le champ password est hors perimetre M9)

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

## 16. Chapitre M17 — Presse-papiers

**Module** : M17 — Detection de donnees sensibles collees depuis le presse-papiers
**Pre-requis** : M17 active dans les options

---

### TC-M17-01 — Detection IBAN colle

**Criticite** : P1

**Pre-condition** : copier un IBAN fictif dans le presse-papiers (ex. `FR7630006000011234567890189`)

**Given** : l'utilisateur est sur une page HTTPS avec un champ texte
**When** : il colle (Ctrl+V) le contenu du presse-papiers dans le champ
**Then** :
1. Un nudge M17 s'affiche
2. Le `data_type` dans `pending_m17_toast` est `iban` (verifiable via console SW : `await chrome.storage.local.get(['pending_m17_toast'])`)
3. Jamais la valeur collee en clair dans le storage

**Invariant de securite** (niveau Expose) : le storage `pending_m17_toast` contient uniquement `data_type` enum (`cb`/`iban`/`ssn`) et `expires_at` — jamais la valeur collee (R-CLI-07 ADR-002).

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M17-02 — Non-declenchement sur champ password

**Criticite** : P1

**Pre-condition** : page avec `<input type="password">`

**Given** : l'utilisateur colle depuis le presse-papiers dans un champ `type="password"`
**When** : Ctrl+V est effectue
**Then** : M17 ne se declenche PAS (champ password exclu du perimetre M17)

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M17-03 — TTL et purge pending_m17_toast

**Criticite** : P1

**Pre-condition** : `pending_m17_toast` present dans le storage avec `expires_at` dans le passe

**Verification** (console SW) :
```javascript
const { pending_m17_toast } = await chrome.storage.local.get(['pending_m17_toast']);
console.log('pending_m17_toast:', pending_m17_toast);
// expires_at doit etre dans le futur (+5 min apres la detection)
```

**Given** : un `pending_m17_toast` est present
**When** : le SW est redemarre apres l'expiration du TTL (simuler via `await chrome.runtime.reload()` et attendre l'alarme `onPurgeDaily`)
**Then** : la cle `pending_m17_toast` est absente du storage (purge automatique via `onPurgeDaily` TACHE-093)

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---


---

## 17. Commandes DevTools utiles

Toutes les commandes a coller dans la console du Service Worker (chrome://extensions > service worker > Inspect).

### 17.1 Commandes de diagnostic et reset (plan consolide)


#### 16.1 Inspection du storage

```javascript
// Lister tous les contenus de chrome.storage.local
const all = await chrome.storage.local.get(null);
console.log(JSON.stringify(all, null, 2));

// Inspecter les cles specifiques M7
const m7 = await chrome.storage.local.get([
  'installation_salt',
  'encryption_key_material',
  'pending_m7_toast',
  'm7_hashes_meta',
  'm7_suppressed_domains',
  'm7_cooldown',
  'diagnostics',
]);
console.log('M7 state:', JSON.stringify(m7, null, 2));
```

#### 16.2 Decodage de password_hashes (IndexedDB)

Les hashes sont stockes chiffres (AES-256-GCM). Il n'est pas possible de les dechiffrer depuis la console SW sans disposer de la cle materiau (`encryption_key_material`). Pour verifier leur presence :

```
1. DevTools > onglet Application (F12 sur l'onglet avec l'extension active)
2. Panneau gauche > IndexedDB > sentinel-nudge-db > password_hashes
3. Les entrees sont visibles avec leur structure chiffree : { value, iv, tag, domain_hash }
4. Le champ "value" est le ciphertext AES-256-GCM — non lisible en clair (attendu)
5. Le champ "domain_hash" est le SHA-256 du hostname — verifiable par calcul
```

#### 16.3 Calcul manuel du domain_hash (verification)

```javascript
// Console SW — calculer le domain_hash attendu pour un hostname donne
const { installation_salt } = await chrome.storage.local.get(['installation_salt']);
const encoder = new TextEncoder();
const data = encoder.encode(installation_salt + 'accounts.google.com');
const hashBuffer = await crypto.subtle.digest('SHA-256', data);
const hashHex = Array.from(new Uint8Array(hashBuffer))
  .map(b => b.toString(16).padStart(2, '0')).join('');
console.log('domain_hash attendu pour accounts.google.com:', hashHex);
```

#### 16.4 Declenchement manuel M5 (force check)

```javascript
// Console SW
const response = await chrome.runtime.sendMessage({
  module: 'M5', action: 'check_update', payload: {}, timestamp: Date.now(),
});
console.log('M5:', response);
```

#### 16.5 Declenchement manuel M6 (force quiz)

```javascript
// Console SW — placer la date de prochain quiz dans le passe
await chrome.storage.local.set({
  m6_state: { next_quiz_date: Date.now() - 86400000, last_quiz_date: null, streak_count: 0, interval_index: 0 },
});
const response = await chrome.runtime.sendMessage({
  module: 'M6', action: 'check_quiz', payload: {}, timestamp: Date.now(),
});
console.log('M6:', response);
```

#### 16.6 Inspection des diagnostics par module

```javascript
// Console SW — afficher l'etat de sante de chaque module
const { diagnostics } = await chrome.storage.local.get(['diagnostics']);
console.log('Diagnostics:', JSON.stringify(diagnostics, null, 2));
// Chaque module doit avoir ready: true et un last_boot recent
```

#### 16.7 Regeneration complete des pre-requis (reset d'urgence)

A utiliser UNIQUEMENT si `installation_salt` ou `encryption_key_material` est absent.

```javascript
// Console SW — regenere TOUS les pre-requis
const saltBytes = crypto.getRandomValues(new Uint8Array(16));
const installationSalt = Array.from(saltBytes)
  .map(b => b.toString(16).padStart(2, '0')).join('');

const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
);
const keyMaterial = await crypto.subtle.exportKey('raw', key);

await chrome.storage.local.set({
  installation_salt: installationSalt,
  encryption_key_material: keyMaterial,
  config: {
    modules: { M2: true, M3: true, M5: true, M6: true, M7: true, M9: true, M17: true },
    quota_limit: 3,
    profile: 'beginner',
    onboarding_complete: true,
    language: 'fr',
  },
  quota_state: { date: new Date().toISOString().split('T')[0], count: 0 },
});

console.log('Pre-requis regeneres. Rechargement SW...');
await chrome.runtime.reload();
```

**Note** : apres une regeneration complete, tous les hashes M7 precedemment stockes sont PERDUS (ils etaient chiffres avec l'ancienne cle).

#### 16.8 Injection d'un message de simulation M7 (test sans navigation)

```javascript
// Console SW — simuler une soumission de mot de passe depuis un pseudo-domaine
const { installation_salt } = await chrome.storage.local.get(['installation_salt']);
const encoder = new TextEncoder();
const pwdHash = Array.from(new Uint8Array(
  await crypto.subtle.digest('SHA-256', encoder.encode(installation_salt + 'TestSentinel2026!'))
)).map(b => b.toString(16).padStart(2, '0')).join('');
const domainHash = Array.from(new Uint8Array(
  await crypto.subtle.digest('SHA-256', encoder.encode(installation_salt + 'site1.example.com'))
)).map(b => b.toString(16).padStart(2, '0')).join('');

await chrome.runtime.sendMessage({
  module: 'M7',
  action: 'password_submitted',
  payload: { hash: pwdHash, domain_hash: domainHash },
  timestamp: Date.now(),
});
```

#### 16.9 Reinitialisation ciblee par module

```javascript
// M7 uniquement
await chrome.storage.local.remove(['m7_hashes_meta', 'm7_suppressed_domains', 'm7_cooldown', 'pending_m7_toast']);
await chrome.runtime.reload();

// M5 uniquement
await chrome.storage.local.remove(['m5_last_nudge_date', 'm5_snooze_count', 'm5_is_up_to_date', 'pending_m5_update_reminder']);
await chrome.runtime.reload();

// M6 uniquement
await chrome.storage.local.remove(['m6_state', 'm6_quiz_history', 'pending_m6_quiz']);
await chrome.runtime.reload();

// M2 uniquement
await chrome.storage.local.remove(['m2_session_domains', 'm2_trusted_domains']);
await chrome.runtime.reload();
```

---


### 17.2 Reset cible et regeneration complete (p4prime)

#### 3. Reset ciblé entre deux sessions de test

**⚠️ NE JAMAIS utiliser `chrome.storage.local.clear()`** — cette commande efface `installation_salt` et `encryption_key_material`, rendant M7/M9/M2 silencieusement inopérants (cf. P-016 dans PROBLEMES.md).

```javascript
// RESET CIBLÉ — à exécuter dans la console SW
// Préserve installation_salt et encryption_key_material (indispensables)
await chrome.storage.local.remove([
  'm2_session_domains',
  'm2_trusted_domains',
  'm3_current_score',
  'm3_last_calculation',
  'm5_last_nudge_date',
  'm5_snooze_count',
  'm5_is_up_to_date',
  'm6_state',
  'm6_quiz_history',
  'm7_hashes_meta',
  'm7_suppressed_domains',
  'm7_cooldown',
  'quota_state',
]);

// Purge IndexedDB (events, scores, password_hashes, quiz_sessions) via reload
await chrome.runtime.reload();
```

#### 4. Régénération COMPLÈTE des pré-requis

⚠️ **Si vous avez fait `chrome.storage.local.clear()` par erreur, ou si l'onboarding n'a jamais été complété, la régénération doit inclure 3 éléments** (P-016 étendu) :

1. `installation_salt` — sel de hashing SHA-256
2. `encryption_key_material` — clé AES-256-GCM (sans elle, **aucun handler SW n'est enregistré** !)
3. `config` — configuration des modules + consentements

```javascript
// Console SW — régénère TOUS les pré-requis (salt + clé AES + config)
const saltBytes = crypto.getRandomValues(new Uint8Array(16));
const installationSalt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');

// Génération de la clé AES-256-GCM (indispensable pour enregistrer les handlers)
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt'],
);
const keyMaterial = await crypto.subtle.exportKey('raw', key);

await chrome.storage.local.set({
  installation_salt: installationSalt,
  encryption_key_material: keyMaterial,
  config: {
    modules: { M2: true, M3: true, M5: true, M6: true, M7: true, M9: true, M17: true },
    quota_limit: 3,
    profile: 'beginner',
    onboarding_complete: true,
    language: 'fr',
  },
  quota_state: { date: new Date().toISOString().split('T')[0], count: 0 },
});

console.log('Pré-requis complets regénérés');
await chrome.runtime.reload();
```

**Note 1** : depuis le commit qui a corrigé P-016 (auto-récupération SW), si `encryption_key_material` est absent au démarrage du service worker, **il est automatiquement régénéré** et les handlers sont enregistrés. Cette commande reste utile pour un reset manuel forcé.

**Note 2** : cette commande active M7 **sans consentement explicite**, uniquement pour les besoins de test. En production, M7 requiert un opt-in via l'onboarding (RGPD).

---

---

## 18. Annexe A — Matrice providers M7

Source : `p5-matrice-compatibilite-providers-m7-v1.0.md` (v1.1 evolutive). Livrable vivant, mis a jour apres chaque recette.


- le **statut de compatibilité** observé ;
- les **limitations** et contournements éventuels ;
- la **version extension** + **navigateur** utilisés lors de la recette ;
- le **lien vers le ticket BACKLOG** si anomalie remontée.

Ce document est **la source de vérité** sur les providers supportés par M7. Il alimente la documentation utilisateur (README, FAQ) et les release notes.

---

### 18. 2. Légende de statut

| Symbole | Signification | Action associée |
|:-:|---|---|
| ✅ | Compatible — détection M7 fonctionnelle sur le flux testé | Aucune |
| ⚠ | Partiellement compatible — détection OK dans certains cas mais limitations connues | Lien vers ticket BACKLOG (limitation documentée) |
| ❌ | Non compatible — M7 ne détecte pas la réutilisation sur ce provider | Ticket BUG ou TÂCHE obligatoire + mention en FAQ |
| ⏸ | Reporté — provider identifié comme utile à tester mais non couvert pour la version actuelle | Ticket TÂCHE dans BACKLOG (priorité Could) |
| 🔬 | En cours de test — recette en cours, résultat non figé | Aucun statut officiel tant que la recette n'est pas close |

---

### 18. 3. Providers IdP (Identity Providers / SSO)

| Provider | Flux testé | Extension | Navigateur | Hostname Step 1 → Step 2 | Statut | Commentaires | Date recette | Testeur |
|---|---|---|---|---|:-:|---|---|---|
| Google | `accounts.google.com` (SPA multi-étape email puis password) | v1.0 (post T-101) | Chrome 139 | `accounts.google.com` → `accounts.google.com` (stable) | 🔬 | Recette prévue après merge TACHE-101 (correctif F-UC01-01) | TC-UC01-01 | À faire |
| Microsoft | `login.microsoftonline.com` → redirect `login.live.com` | v1.0 | Chrome 139 | `login.microsoftonline.com` → `login.live.com` (change) | 🔬 | Cas cross-hostname — hash Step 2 associé à `login.live.com` uniquement (comportement validé par ARB-068-01 Option A) | TC-UC01-02 | À faire |
| Okta | `<tenant>.okta.com` natif | — | — | — | ⏸ | Reporté hors v1 (ARB-068-03 Option A = Google + Microsoft uniquement) | — | — |
| GitLab.com SSO | À définir | — | — | — | ⏸ | Non couvert v1 | — | — |
| Auth0 | À définir | — | — | — | ⏸ | Non couvert v1 | — | — |

---

### 18. 4. Providers Password Managers

| Provider | Méthode remplissage | Extension | Navigateur | isTrusted sur submit ? | Statut | Commentaires | Date recette | Testeur |
|---|---|---|---|---|:-:|---|---|---|
| KeePassXC (navigateur connector) | Autofill manuel (icône dans champ) | v1.0 | Chrome 139 | true (user click) | ✅ | Comportement nominal — le clic utilisateur déclenche `input` puis `submit` trusted | 2026-04-17 | QA session soirée |
| Bitwarden | Autofill via menu | v1.0 | Chrome 139 | true | ✅ | Détection OK. Autofill Enter → trusted | 2026-04-17 | QA session soirée |
| Vaultwarden (Bitwarden self-hosted) | Idem Bitwarden | v1.0 | Chrome 139 | true | ✅ | Comportement identique à Bitwarden upstream | 2026-04-17 | QA session soirée |
| Chrome Password Manager natif | Autofill automatique au chargement | v1.0 | Chrome 139 | **false** sur autofill silencieux | ⚠ | Filtrage `event.isTrusted=false` actif → pas de faux positif, mais aussi pas de détection. Documenté comme comportement attendu (UC-02) | 2026-04-17 | QA session soirée (TACHE-069 PR #11) |
| 1Password | Autofill via extension | — | — | — | ⏸ | Non testé v1 — Closed-source, projet OSS ne supporte que les PM open source (cf. CLAUDE.md §projet) | — | — |
| Dashlane | Autofill via extension | — | — | — | ⏸ | Non testé v1 — Closed-source (idem) | — | — |
| KeePass Desktop + auto-type | Auto-type via raccourci OS | — | — | À investiguer | 🔬 | Cas spécial : auto-type OS génère des événements keyboard au niveau natif → isTrusted=true | À planifier | — |

---

### 18. 5. Sites cibles notables (sites testés en recette)

| Site | Type | Flux testé | Statut M7 | Commentaires | Date | Testeur |
|---|---|---|:-:|---|---|---|
| saucedemo.com | Site de test login simple (same-origin) | standard `<form>` + submit | ✅ | Référence historique — validé au post-mortem M7 2026-04-14 | 2026-04-14 | Commanditaire |
| the-internet.herokuapp.com/login | Site de test login avec redirect post-submit | form + redirect vers `/authenticate` puis `/login` | ✅ | Pattern `pending_m7_toast` (ADR-002) valide — toast conservé jusqu'à acknowledge | 2026-04-14 | Commanditaire |
| practicetestautomation.com/practice-test-login | Site de test — submit sans event natif (handler JS custom) | input password **orphelin** (hors `<form>`) | ✅ | Triggers fallback `keydown Enter` + `click submit` (cf. P-017) | 2026-04-14 | Commanditaire |
| github.com/login | Login classique same-origin | form + submit | 🔬 | À tester formellement en recette UC-01 | — | — |

---

### 18. 6. Limitations connues transversales

| Limitation | Impact | Documenté dans | Contournement |
|---|---|---|---|
| Iframes cross-origin | M7 ne détecte pas la saisie dans une iframe cross-origin (content script non injecté) | AIPD M7 §3.2 · mini-DAT TACHE-071 | Documentation utilisateur — limite par conception |
| Autofill silencieux (isTrusted=false) | Pas de détection quand le password manager remplit sans interaction explicite | mini-DAT TACHE-069 | Volontaire (filtrage anti faux positifs) |
| Champs `autocomplete="new-password"` (signup) | Détection active mais sémantique floue (création vs réutilisation) | TACHE-064 (à faire) | À affiner en v1.1 |
| SPA avec input password ajouté comme nœud racine React | Détection manquée jusqu'à TACHE-101 mergée | Bug F-UC01-01 · mini-DAT TACHE-068 §3.1 | TACHE-101 (en cours) |

---

### 18. 7. Process de mise à jour

### 7.1 À chaque recette manuelle

1. Le Testeur QA ajoute une ligne dans la table correspondante (§3, §4 ou §5) **avant** clôture de la tâche.
2. Renseigner **tous** les champs (pas de case vide). Si non applicable : `—`.
3. Si statut ≠ ✅, créer un ticket BACKLOG correspondant (BUG ou TÂCHE) et le référencer dans "Commentaires".

### 7.2 À chaque remontée externe (issue GitHub, retour utilisateur)

1. Créer ou mettre à jour la ligne du provider concerné.
2. Passer le statut à ⚠ ou ❌ selon gravité.
3. Référencer l'issue GitHub : `#<numéro>`.

### 7.3 Revue trimestrielle (Architecte logiciel)

1. Vérifier que tous les statuts 🔬 ont été finalisés ou requalifiés.
2. Vérifier que tous les statuts ⚠ ont un ticket ouvert ou résolu.
3. Mettre à jour les versions "Extension" et "Navigateur" à la release courante si le comportement reste nominal.
4. Signer la revue en §9 (Historique).

### 7.4 À chaque release

1. La matrice est intégrée aux **release notes** (section "Providers supportés").
2. Un diff des changements de statut est résumé dans le CHANGELOG.

---

### 18. 8. Liens BACKLOG

| Tâche | Titre | Lien avec la matrice |
|---|---|---|
| TACHE-068 | UC-01 Login multi-étape | Alimente §3 (Google, Microsoft) |
| TACHE-069 | UC-02 Password managers | Alimente §4 (KeePassXC, Bitwarden, Chrome PM) — **déjà effectué** |
| TACHE-101 | Correctif F-UC01-01 observeDynamicForms React | Pré-requis pour TC-UC01-01 Google ✅ |
| TACHE-117 | Maintenance périodique matrice providers | Assurance de la mise à jour régulière |

---

### 18. 9. Historique

| Date | Version | Modification | Auteur |
|---|---|---|---|
| 2026-04-18 | 1.0 | Création initiale — squelette + données issues du post-mortem M7 + recettes TACHE-069 (UC-02) | Orchestrateur (Fabrique) |

---

*Livrable vivant — ne pas figer. Pour toute évolution, ajouter une ligne dans §9.*

---

## 19. Annexe B — Scenarios NVDA (accessibilite)

Tests manuels avec lecteur d'ecran NVDA 2024.2+ sur Firefox ESR 115+ / Chrome 128+. Reference : `docs/accessibilite/captures/nvda/scenarios-nvda-v1.0.md` (archivee).

### 19. 1. Prérequis d'environnement

### 1.1 Versions recommandées

| Composant | Version recommandée | Remarque |
|-----------|---------------------|----------|
| NVDA | 2024.4 (ou supérieure) | Téléchargement gratuit sur nvaccess.org |
| Navigateur | Chrome 139+ ou Edge 139+ (Chromium) | MV3 requis pour l'extension |
| OS | Windows 11 | Seule plateforme supportée pour NVDA dans ce projet |
| Sentinel Nudge | Build `dist/` à jour | Exécuter `npm run build` avant le test |

### 1.2 Configuration NVDA pour ces tests

- Synthèse vocale : eSpeak NG (par défaut) ou Windows OneCore — les deux sont acceptables
- Mode de navigation : **mode navigation** (Browse Mode) pour les pages HTML, **mode focus** (Focus Mode) pour les formulaires
- Paramètre "dire tout lors du chargement de page" : **désactivé** (pour contrôler la lecture étape par étape)
- Ponctuation verbalisée : niveau **Some** (NVDA+P pour ajuster)

### 1.3 Chargement de l'extension

1. Charger l'extension en mode développeur dans Chrome/Edge (`chrome://extensions` > "Charger l'extension non empaquetée" > sélectionner `dist/`)
2. Récupérer l'ID de l'extension affiché (format : `abcdefghijklmnopqrstuvwxyz123456`)
3. Les URLs de test ont le format : `chrome-extension://<ID>/pages/<page>/<page>.html`

---

### 19. 2. Conventions des scénarios

Chaque scénario est structuré en format Given / When / Then :

- **Given** : état initial de la page et configuration NVDA
- **When** : séquence de touches à effectuer (dans l'ordre)
- **Then** : résultat attendu announcé par NVDA (texte ou comportement)

**Notation des touches NVDA** :

| Notation | Touche |
|----------|--------|
| `Tab` | Tabulation |
| `Shift+Tab` | Tabulation inverse |
| `H` | Touche H (navigation par titres, Browse Mode) |
| `F` | Touche F (navigation par formulaires, Browse Mode) |
| `Insert+F7` | Liste des landmarks (éléments de page) |
| `Insert+F6` | Liste des titres |
| `Insert+T` | Lire le titre de la page |
| `Insert+↓` | Lire depuis la position courante |
| `Espace` ou `Entrée` | Activer l'élément focalisé |
| `Echap` | Quitter le mode courant |
| `Insert+Space` | Basculer Browse Mode / Focus Mode |

---

### 19. 3. Popup (`pages/popup/popup.html`)

### SC-NVDA-POP-01 — Titre de page

**Given** : Page popup ouverte, NVDA actif
**When** : `Insert+T`
**Then** : NVDA annonce "Sentinel Nudge — Tableau de bord" (ou titre équivalent défini dans `<title>`)

### SC-NVDA-POP-02 — Langue de la page

**Given** : Page popup ouverte
**When** : `Insert+F7` (liste des landmarks)
**Then** : NVDA lit les landmarks en français sans basculer en prononciation anglaise — confirme `lang="fr"` effectif

### SC-NVDA-POP-03 — Skip link

**Given** : Page popup, curseur NVDA en début de page
**When** : `Tab` (premier Tab depuis le haut de page)
**Then** : NVDA annonce "Aller au contenu principal, lien" (ou formulation équivalente du skip link)

**Note Sentinel Nudge** : Le skip link est généré par `popup.ts`. S'il n'est pas annoncé au premier Tab, cela confirme l'écart ACC-UI non corrigé.

### SC-NVDA-POP-04 — Lecture du score (gauge SVG)

**Given** : Page popup chargée avec données (score visible), NVDA en Browse Mode
**When** : `H` pour naviguer jusqu'au H2 "Score de cyber-hygiène" puis `↓`
**Then** : NVDA annonce la valeur du score. Résultat attendu : "Score de cyber-hygiène : [valeur] sur 100" — le `role="meter"` avec `aria-valuenow`, `aria-valuemin`, `aria-valuemax` et `aria-valuetext` doit être verbalisé. Si seule la valeur numérique brute est annoncée sans contexte, ACC-UI-04 n'est pas corrigé.

**Composant critique** : gauge SVG — vérifier que le SVG n'est pas opaque aux AT (doit porter `aria-hidden="true"` avec valeur portée par l'élément texte adjacent ou le `role="meter"`).

### SC-NVDA-POP-05 — Grille modules avec statuts

**Given** : Page popup, grille modules visible (au moins 1 module actif, 1 inactif)
**When** : Naviguer jusqu'à la section modules par `Tab` répété ou `H`, puis `↓` pour chaque chip
**Then** : Chaque chip annonce son nom ET son statut. Exemple attendu : "Sites douteux — actif" ou "Sites douteux — inactif". Si seule la couleur du point différencie les statuts et que NVDA ne verbalise pas le statut, ACC-UI-02 n'est pas corrigé.

### SC-NVDA-POP-06 — Annonce du chargement (live region)

**Given** : Page popup en cours de chargement (SW répond avec délai)
**When** : Laisser la page se charger, NVDA en écoute
**Then** : NVDA annonce le message de chargement initial ("Chargement..." ou équivalent), puis annonce le contenu chargé (score, modules) sans répétition parasite. Si NVDA n'annonce rien au chargement ou annonce deux fois, ACC-UI-03 n'est pas corrigé.

### SC-NVDA-POP-07 — Quota atteint

**Given** : Quota atteint (3/3 nudges consommés)
**When** : Naviguer jusqu'au `role="meter"` du quota par Tab
**Then** : NVDA annonce "3 sur 3 — quota atteint" (via `aria-valuetext`). Si NVDA annonce uniquement "3" sans contexte de quota atteint, ACC-UI-04 n'est pas corrigé.

### SC-NVDA-POP-08 — Navigation clavier complète (ordre de focus)

**Given** : Page popup chargée
**When** : `Tab` répété depuis le skip link jusqu'au dernier élément interactif, noter l'ordre
**Then** : Ordre logique attendu : skip link → (éventuellement) bouton "En savoir plus" badge dégradé → chips modules (si focalisables) → bouton "Ouvrir les paramètres" → bouton "Ouvrir le tableau de bord". Aucun piège de focus. `Shift+Tab` depuis le dernier élément remonte en sens inverse.

---

### 19. 4. Dashboard (`pages/dashboard/dashboard.html`)

### SC-NVDA-DSH-01 — Titre de page

**Given** : Page dashboard ouverte
**When** : `Insert+T`
**Then** : NVDA annonce "Sentinel Nudge — Tableau de bord analytique" (ou titre équivalent)

### SC-NVDA-DSH-02 — Navigation par landmarks

**Given** : Page dashboard
**When** : `Insert+F7`
**Then** : Liste des landmarks affichée par NVDA incluant au minimum : `main` (ou "Principal") avec son label. Absence de landmark `main` serait un écart WCAG 1.3.6.

### SC-NVDA-DSH-03 — Navigation par titres

**Given** : Page dashboard, Browse Mode
**When** : `H` répété depuis le début de la page
**Then** : Sequence de titres : H1 (nom de la page) → H2 (sections : score, graphique, composantes, quiz). Vérifier l'absence de saut de niveau (pas de H3 sans H2 parent).

### SC-NVDA-DSH-04 — Histogramme SVG et table alternatives

**Given** : Section graphique/histogramme visible
**When** : Naviguer jusqu'au graphique SVG par `↓` en Browse Mode
**Then** : Le SVG doit être soit `aria-hidden="true"` (contenu porté par une table `sr-only` adjacente), soit porteur d'un `aria-label` descriptif. NVDA ne doit pas tenter de lire le SVG brut (cela produirait une série de nombres ou de silence). Vérifier que la table sr-only alternative est correctement annoncée.

### SC-NVDA-DSH-05 — Bouton unique (navigation Tab)

**Given** : Page dashboard
**When** : `Tab` depuis le haut de page
**Then** : Sequence attendue : skip link (si présent) → bouton "Ouvrir les paramètres". Deux Tab au maximum pour atteindre le seul bouton interactif de la page. Si ACC-UI-06 n'est pas corrigé, le skip link sera absent.

---

### 19. 5. Options (`pages/options/options.html`)

### SC-NVDA-OPT-01 — Titre de page

**Given** : Page options ouverte
**When** : `Insert+T`
**Then** : NVDA annonce "Sentinel Nudge — Paramètres"

### SC-NVDA-OPT-02 — Navigation par fieldsets

**Given** : Page options, Browse Mode
**When** : `F` répété (navigation par éléments de formulaire) depuis le début de la page
**Then** : Chaque section de formulaire (Modules, Quota, Profil, Langue, Accessibilité, Apparence) est annoncée avec son `<legend>` comme contexte. Exemple : "Modules actifs, groupe" puis chaque checkbox avec son label et son état (coché/décoché).

### SC-NVDA-OPT-03 — Toggles modules

**Given** : Section Modules visible
**When** : Naviguer jusqu'au premier toggle checkbox par Tab, puis Tab suivant
**Then** : NVDA annonce le nom du module, le type "case à cocher", l'état "coché" ou "non coché", et la description associée (`aria-describedby`). Exemple attendu : "Sites douteux, case à cocher, cochée, Détecte les sites web potentiellement dangereux".

### SC-NVDA-OPT-04 — Radiogroup profil

**Given** : Section Profil visible
**When** : Tab jusqu'au groupe de radios, puis flèches `↑`/`↓`
**Then** : Navigation native au sein du radiogroup par flèches. NVDA annonce chaque radio : "Débutant, bouton radio, sélectionné" / "Intermédiaire, bouton radio" / "Expert, bouton radio". Le groupe annonce "Profil utilisateur, groupe" à l'entrée.

### SC-NVDA-OPT-05 — Dialogue de suppression (encart inline)

**Given** : Page options, section Données et confidentialité
**When** :
1. Tab jusqu'au bouton "Supprimer toutes les données"
2. `Entrée` pour activer le bouton
**Then** :
1. NVDA annonce immédiatement le contenu de l'encart de confirmation (`role="alert"` — annonce assertive) : "Confirmation requise — Cette action supprimera définitivement..."
2. Le focus se déplace sur le bouton "Annuler" (annoncé par NVDA)
3. `Tab` : focus sur bouton "Confirmer la suppression"
4. `Shift+Tab` : retour sur "Annuler"
5. `Entrée` sur "Annuler" : encart fermé, focus retourné sur bouton initial

**Composant critique** : dialogue de suppression inline — vérifier que le focus ne s'échappe pas hors de l'encart et que l'annonce assertive est bien verbalisée.

### SC-NVDA-OPT-06 — Toast de sauvegarde

**Given** : Page options, une modification effectuée (ex. changement de quota)
**When** : Modifier une valeur, attendre l'auto-sauvegarde
**Then** : NVDA annonce "Paramètres enregistrés" (ou texte équivalent) via `aria-live="polite"` sans interrompre la lecture en cours. L'annonce doit intervenir après la fin de la phrase courante.

### SC-NVDA-OPT-07 — Radiogroup thèmes

**Given** : Section Apparence visible
**When** : Tab jusqu'au groupe de thèmes, `↓` pour naviguer
**Then** : NVDA annonce chaque thème : "Aegis Light, bouton radio, sélectionné" puis "Midnight Obsidian, bouton radio" puis "Cyberpunk Neon, bouton radio". Le radiogroup est annoncé par son `aria-label`.

---

### 19. 6. Onboarding (`pages/onboarding/onboarding.html`)

### SC-NVDA-ONB-01 — Titre de page

**Given** : Page onboarding ouverte (étape 1)
**When** : `Insert+T`
**Then** : NVDA annonce "Sentinel Nudge — Bienvenue"

### SC-NVDA-ONB-02 — Indicateur de progression

**Given** : Page onboarding, étape 1 active
**When** : Activer le bouton "Suivant" (`Tab` jusqu'au bouton, `Entrée`)
**Then** : NVDA annonce immédiatement "Étape 2 sur 4" via `aria-live="polite"` sur l'élément `.sr-only` de progression. L'annonce doit suivre l'activation du bouton sans délai perceptible.

Répéter pour les étapes 2 → 3 → 4.

### SC-NVDA-ONB-03 — Focus à chaque étape

**Given** : Onboarding, navigation entre étapes
**When** : Activer "Suivant" pour passer à l'étape 2
**Then** : Le focus se déplace automatiquement sur le premier élément focalisable de l'étape 2 (premier radio du groupe Profil). NVDA annonce cet élément sans nécessiter un Tab supplémentaire. Si le focus reste sur "Suivant" après le changement d'étape, la gestion du focus est défectueuse.

### SC-NVDA-ONB-04 — Module M7 désactivé (étape 3)

**Given** : Onboarding, étape 3 (sélection des modules)
**When** : Tab jusqu'au toggle du module "Mots de passe réutilisés"
**Then** : NVDA annonce "Mots de passe réutilisés (consentement requis à l'étape suivante), case à cocher, non disponible" (ou "grisée"). L'`aria-label` explicatif doit être verbalisé. L'état désactivé (`disabled`) doit être annoncé.

### SC-NVDA-ONB-05 — Lien GitHub (étape 1, nouvel onglet)

**Given** : Onboarding, étape 1
**When** : Tab jusqu'au lien "Voir le code sur GitHub"
**Then** : NVDA annonce "Voir le code sur GitHub (s'ouvre dans un nouvel onglet), lien". Si la mention "s'ouvre dans un nouvel onglet" est absente, ACC-UI-10 n'est pas corrigé.

### SC-NVDA-ONB-06 — Erreur de validation (étape 2, profil non sélectionné)

**Given** : Onboarding, étape 2 (Profil), aucun radio sélectionné
**When** : Activer le bouton "Suivant"
**Then** : NVDA annonce immédiatement le message d'erreur via `role="alert"` : "Veuillez sélectionner un profil" (ou texte équivalent). L'annonce est assertive (interrompt la lecture en cours). Le focus reste sur la page (pas de saut indésiré).

---

### 19. 7. Procédure d'archivage des transcripts

### 7.1 Capture du transcript NVDA

NVDA ne produit pas de transcript automatique par défaut. Pour capturer la sortie verbale :

**Option A — Log NVDA (recommandé)** :
1. Aller dans NVDA > Préférences > Paramètres > Avancé
2. Activer "Activer la journalisation" avec niveau "Debug"
3. Exécuter le scénario
4. Copier le contenu du log : NVDA > Outils > Afficher le journal
5. Filtrer les lignes `speech:` qui contiennent les verbalisations
6. Enregistrer le texte filtré dans un fichier `.txt` selon la convention de nommage

**Option B — Prise de notes manuelle** :
1. Ouvrir un éditeur de texte en parallèle
2. Exécuter le scénario touche par touche
3. Noter immédiatement après chaque interaction ce que NVDA a verbalisé
4. Indiquer les écarts par rapport au résultat attendu

### 7.2 Contenu minimal d'un transcript archivé

```
# Transcript NVDA — <page> — <theme>
Date : YYYY-MM-DD
Testeur : <nom>
NVDA : <version>
Navigateur : Chrome/Edge <version>
Extension build : <hash git ou date>

### 19. SC-NVDA-<PAGE>-01
Action : <touche>
Résultat NVDA : "<texte verbalisé>"
Conformité : OK | ECART — <description>

### 19. SC-NVDA-<PAGE>-02
...
```

### 7.3 Nommage et dépôt

Nommer le fichier selon la convention du README :
`<page>-<theme>-<date>.txt`

Placer dans `docs/accessibilite/captures/nvda/` et committer avec le message :
`docs(accessibilite): transcript NVDA <page> <theme> <date>`

---

## 20. Annexe C — Gabarit PV de recette

Le gabarit PV pre-rempli est maintenu dans un fichier separe pour faciliter la signature et l'archivage :

- Fichier : [`pv-recette-v1-2026-04-20-a-remplir.md`](./pv-recette-v1-2026-04-20-a-remplir.md)
- Usage : copier-renommer pour chaque session (ex. `pv-recette-v1-YYYY-MM-DD.md`), remplir, signer, archiver.

Structure du PV : en-tete (date, SHA, Chrome) + pre-conditions + recapitulatif des 17 scenarios Pass/Fail/Skip + bilan global + anomalies eventuelles + signatures.

---

## 21. Annexe D — Historique de consolidation v1 -> v2

La v2.0 (2026-04-20, TACHE-204) consolide **7 fichiers** precedents (archives dans `docs/p5-recette/archive/`) :

| Source | Contribution au master v2.0 |
| --- | --- |
| `p5-protocole-recette-manuelle-v1.0.md` (T-063, PR #127) | Structure generale §1-4, chapitres UC-03/04/05 |
| `plan-tests-manuels-consolide-v1.0.md` (archive) | Chapitres modules §11-16, commandes DevTools §17.1 — **integralement fusionne dans ce master v2.0** ; archive dans `docs/p5-recette/archive/`, non perdu |
| `p5-matrice-compatibilite-providers-m7-v1.0.md` | Annexe A §18 |
| `p5-uc01-login-multietape-scenarios-v1.0.md` | Chapitre UC-01 §5 (version detaillee) |
| `p5-uc02-password-managers-scenarios-v1.0.md` | Chapitre UC-02 §6 (version detaillee) |
| `p5-uc06-inputs-dynamiques-scenarios-v1.0.md` | Chapitre UC-06 §10 (version detaillee) |
| `p4prime-tests-manuels-modules-asynchrones-v1.0.md` | Commandes DevTools §17.2 |
| `scenarios-nvda-v1.0.md` (reste aussi dans `docs/accessibilite/`) | Annexe B §19 |

Fichier connexe maintenu separement :

- `docs/p5-decisions/p5-regle-e2e-isTrusted-v1.0.md` (TACHE-099) — regle ADR-like pour tests automatises E2E Playwright, hors perimetre recette manuelle.

## 22. Historique des revisions

| Version | Date | Auteur | Changements |
| --- | --- | --- | --- |
| v2.0 | 2026-04-20 | Orchestrateur (T-204) | Consolidation 7 fichiers -> 1 master unique a derouler. Renumerotation chapitres, fusion Given/When/Then detailles, ajout annexes matrice + NVDA + gabarit PV. |
| v1.0 | 2026-04-18 | Testeur QA (T-063) | Creation protocole formel 17 scenarios Given/When/Then UC-01 a UC-06, gabarit PV signable. |
