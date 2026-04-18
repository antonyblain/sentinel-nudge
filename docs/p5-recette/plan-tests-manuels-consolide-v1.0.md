# Plan de tests manuels consolide — Sentinel Nudge v1

**Version** : 1.0
**Date** : 2026-04-18
**Auteur** : Testeur QA (Fabrique)
**Proprietaire** : Testeur QA — maintenu a chaque cycle de recette
**Public** : Commanditaire (Antony, RSSI) — ce document est autonome et autoporte
**Statut** : Pret a derouler en fin de cycle (apres merge de toutes les PR UC P0)
**Niveau de sensibilite** : Expose — protocole de recette obligatoire

---

## Historique des versions

| Version | Date       | Modifications                                | Auteur      |
|---------|------------|----------------------------------------------|-------------|
| 1.0     | 2026-04-18 | Creation initiale — consolidation de tous les scenarios eparpilles dans les mini-DAT et post-mortem | Testeur QA  |

---

## 1. Objet

Ce plan de tests manuels est le **document de reference unique** a derouler par le Commanditaire pour valider Sentinel Nudge v1 avant release publique.

Il consolide l'ensemble des scenarios de recette eparpilles dans les documents suivants :

- `docs/p4-conception/p4prime-tests-manuels-modules-asynchrones-v1.0.md` (guide DevTools M3/M5/M6/M7)
- `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md` §4 (UC-01 a UC-15)
- `docs/p4-conception/p5-minidat-tache-068-uc01-login-multi-etape-v1.1.md` §12 (TC-UC01-01 a 05)
- `docs/p5-tests/p5-uc01-login-multietape-scenarios-v1.0.md` (scenarios GG-01 a MS-03)
- `docs/p5-tests/p5-uc02-password-managers-scenarios-v1.0.md` (scenarios S-UC02-*)
- `docs/p5-tests/p5-uc06-inputs-dynamiques-scenarios-v1.0.md` (scenarios S-UC06-*)
- `docs/p4-conception/p5-minidat-tache-072-toggle-show-hide-v1.1.md` (UC-05)
- `docs/p4-conception/p5-minidat-tache-070-uc03-iframes-v1.0.md` (UC-03)

Ce document ne duplique pas le contenu detaille de ces sources : il **reference** les cas d'usage, condense les criteres de passage et fournil les commandes DevTools necessaires.

**Le Commanditaire doit pouvoir derouler ce plan sans ouvrir d'autre fichier.**

---

## 2. Pre-requis avant tout test

### 2.1 Build local

```
npm run build
```

Verifier que la commande se termine sans erreur et que le repertoire `dist/` est peuple.

### 2.2 Extension chargee en mode developpeur

```
1. Ouvrir Chrome
2. Naviguer vers chrome://extensions
3. Activer "Mode developpeur" (coin superieur droit)
4. Cliquer "Charger l'extension non empaquelee"
5. Selectionner C:\Dev\sentinel-nudge\dist
6. Verifier que l'icone bouclier Sentinel Nudge apparait dans la barre d'outils
```

**Version Chrome requise** : Chrome v139 ou superieur.

**Version Node** : Node 24 LTS (alignee avec la CI — verifier via `node --version`).

### 2.3 Console Service Worker

```
1. Dans chrome://extensions, reperer la carte "Sentinel Nudge"
2. Cliquer "service worker" (lien bleu) — une fenetre DevTools dediee s'ouvre
3. Toutes les commandes de la Section 9 de ce document s'executent dans cette console
```

**Note** : la console du content script (logs de la page active) est accessible via F12 > onglet Console, en changeant le contexte en haut a gauche de la DevTools.

### 2.4 Reset du storage entre les sessions de test

**AVERTISSEMENT : ne jamais utiliser `chrome.storage.local.clear()`** — cette commande efface `installation_salt` et `encryption_key_material`, rendant M7/M9/M2 silencieusement inoperants (incident P-016 — post-mortem M7).

**Commande de reset ciblee a utiliser** (console SW) :

```javascript
// Reset cible — preserve installation_salt et encryption_key_material
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

// Purge IndexedDB (events, scores, password_hashes, quiz_sessions)
await chrome.runtime.reload();
```

**Commande de verification post-reset** :

```javascript
const { installation_salt, encryption_key_material } = await chrome.storage.local.get(
  ['installation_salt', 'encryption_key_material']
);
console.log('salt:', installation_salt ? 'OK' : 'ABSENT');
console.log('key:', encryption_key_material ? 'OK' : 'ABSENT');
```

Si `ABSENT` apparait pour l'un des deux, utiliser la commande de regeneration complete de la Section 9.3.

---

## 3. Organisation du plan

Le plan est structure en 9 chapitres operationnels :

| Chapitre | Perimetre | Criticite |
|----------|-----------|-----------|
| 4 | UC P0 — Login multi-etape (UC-01) | P0 bloquant v1 |
| 5 | UC P0 — Gestionnaires de mots de passe (UC-02) | P0 bloquant v1 |
| 6 | UC P0 — Iframes same-origin (UC-03) | P0 bloquant v1 |
| 7 | UC P0 — Toggle show/hide (UC-05) | P0 bloquant v1 |
| 8 | UC P0 — Inputs dynamiques React/Vue (UC-06) | P0 bloquant v1 |
| 9 | Module M2 — Typosquatting | P1 |
| 10 | Module M3 — Score hebdomadaire | P1 |
| 11 | Module M5 — Mise a jour navigateur | P1 |
| 12 | Module M6 — Quiz spaced repetition | P1 |
| 13 | Module M9 — Données sensibles | P1 |
| 14 | Module M17 — Presse-papiers | P1 |
| 15 | Recette providers M7 | Voir matrice |
| 16 | Commandes DevTools utiles | Reference |
| 17 | En cas d'anomalie | Procedure |

**Convention de criticite** :
- **P0** : defaut bloquant release v1 — ne pas livrer si echec
- **P1** : defaut a corriger avant release — peut bloquer selon impact
- **P2** : defaut a traiter en v1.1 — release autorisee avec documentation de la limite

**Convention de notation** :
- `[ ]` case a cocher : resultat recette (PASS / FAIL / BLOQUE)
- Chaque scenario a un champ "Observations" a remplir librement

---

## 4. Chapitre UC-01 — Login multi-etape

**Tache origine** : TACHE-068
**Mini-DAT de reference** : `docs/p4-conception/p5-minidat-tache-068-uc01-login-multi-etape-v1.1.md`
**Scenarios detailles** : `docs/p5-tests/p5-uc01-login-multietape-scenarios-v1.0.md`

**Pre-requis du chapitre** :
- TACHE-101 (correctif F-UC01-01) mergee (PR #29 — CI verte 432/432 tests)
- Compte Google de test dedie (ne pas utiliser un compte personnel)
- Compte Microsoft de test dedie
- M7 active dans les options Sentinel Nudge

**Contexte technique** : Google utilise un flux SPA (meme hostname `accounts.google.com` tout au long du flux). Microsoft effectue une navigation complete avec changement de hostname (`login.microsoftonline.com` → `login.live.com`). Le hash M7 est toujours associe au hostname du Step 2 (comportement valide — ARB-068-01 Option A).

---

### TC-M7-UC01-01 — Google SPA : detection nominale

**Reference** : mini-DAT TACHE-068 §2 Cas A + scenarios GG-01 + TACHE-124
**Criticite** : P0
**Provider teste** : Google (`accounts.google.com`)
**Lien matrice** : `docs/p5-recette/matrice-compatibilite-providers-m7.md` §3

**Pre-condition** :
- Naviguer sur `https://accounts.google.com/` (page de connexion)
- Console DevTools ouverte sur l'onglet
- Filtre console : `Sentinel Nudge`
- Storage M7 vide (reset cible Section 2.4)

**Given** : l'utilisateur est sur l'ecran de saisie email Google (`accounts.google.com/signin/...`)
**When** : il saisit son email et clique "Suivant"
**Then** : une navigation complete se produit — le log `Sentinel Nudge password-detector: injected` apparait avec `url: accounts.google.com` (reinjection confirmee)

**When** : il saisit son mot de passe de test et clique "Suivant" (ou presse Enter)
**Then** :
1. Le log `Sentinel Nudge: submit listeners attached` avec `pwdForms: 1` est visible
2. Le log `Sentinel Nudge M7: sending password_submitted to SW` est visible avec un `domain_hash` en prefixe 8 hex
3. Le log `Sentinel Nudge M7: SW response received` est visible
4. Un hash est enregistre dans IndexedDB `password_hashes` (verifiable via DevTools Application > IndexedDB)

**Resultat attendu** : hash enregistre, `domain_hash` correspond a `accounts.google.com`

**Invariants de securite a verifier** (niveau Expose) :
- Le log ne contient jamais le mot de passe en clair
- Le `domain_hash` est une valeur hexadecimale de 64 caracteres (SHA-256)
- Le `salt` n'est jamais expose dans les logs

**Valeurs a relever** :
- `domain_hash` (8 premiers hex) : ___
- Log inject present sur challenge/pwd (preuve reinjection) : ___

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC01-02 — Microsoft cross-hostname

**Reference** : mini-DAT TACHE-068 §2 Cas B + scenarios MS-01
**Criticite** : P0
**Provider teste** : Microsoft (`login.microsoftonline.com` → `login.live.com`)
**Lien matrice** : `docs/p5-recette/matrice-compatibilite-providers-m7.md` §3

**Pre-condition** :
- Naviguer sur `https://login.microsoftonline.com/common/login`
- Console DevTools ouverte
- Storage M7 vide

**Given** : l'utilisateur est sur l'ecran identifiant Microsoft (Step 1)
**When** : il saisit son identifiant et clique "Suivant"
**Then** : l'ecran change (React re-render SPA — URL identique, pas de reinjection du content script)
- Le log inject **ne doit pas** apparaitre a nouveau (pas de navigation)
- Le MutationObserver peut logger `submit listeners attached` si le formulaire a ete recree par React

**When** : il saisit son mot de passe et clique "Se connecter"
**Then** :
1. Log `Sentinel Nudge M7: sending password_submitted to SW` visible
2. Le `domain_hash` correspond au hostname de Step 2 (a observer dans les logs)
3. Toast M7 s'affiche apres la navigation post-submit (pattern `pending_m7_toast` ADR-002)

**Note specifique** : le hash est associe au hostname effectif de saisie (Step 2). Ce comportement est correct et valide (ARB-068-01 Option A).

**Valeurs a relever** :
- Second log inject present lors du changement d'ecran React : ___ (attendu : non)
- `domain_hash` (8 premiers hex) : ___
- Toast affiche apres navigation post-login : ___

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC01-03 — Deep link Step 2 direct

**Reference** : mini-DAT TACHE-068 §8 R-UC01-02
**Criticite** : P0

**Pre-condition** :
- Acceder directement a `https://accounts.google.com/v3/signin/challenge/pwd` (URL de Step 2 sans Step 1)
- Console DevTools ouverte
- Storage M7 vide

**Given** : l'utilisateur arrive directement sur l'ecran password sans avoir passe par l'ecran email
**When** : il saisit son mot de passe et soumet
**Then** :
1. Le log inject est visible (le CS est charge normalement)
2. Le log `sending password_submitted` est visible
3. Aucune erreur console

**Resultat attendu** : detection nominale, pas d'anomalie liee a l'absence de Step 1.

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC01-04 — Verification isCreationForm sur page SSO

**Reference** : mini-DAT TACHE-068 §3.5 + INV-UC01-04
**Criticite** : P0
**Invariant de securite** : le filtre `isCreationForm` ne doit jamais retourner `true` sur une page de connexion multi-etape (INV-UC01-04)

**Pre-condition** :
- Naviguer sur `https://accounts.google.com/v3/signin/challenge/pwd`
- Console DevTools ouverte

**Given** : l'utilisateur est sur l'ecran password Google (Step 2)
**When** : il saisit son mot de passe de test et soumet
**Then** :
1. Le log `sending password_submitted` est visible (M7 n'a PAS filtre la page comme "creation de compte")
2. Aucun log de type `isCreationForm: true` ou `routing to M9` dans la console

**Verification supplementaire** : ouvrir les logs SW et verifier l'absence de `skip` avec `reason: creation_form` sur cette page.

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC01-05 — Retour arriere Google (no double capture)

**Reference** : scenarios GG-02
**Criticite** : P0

**Pre-condition** :
- Naviguer sur `https://accounts.google.com/`
- Console DevTools ouverte

**Given** : l'utilisateur est sur l'ecran password Google
**When** : il clique "Utiliser un autre compte" (retour a l'ecran email) puis saisit un autre email, arrive de nouveau sur l'ecran password, saisit son mot de passe et soumet
**Then** :
1. Le log `sending password_submitted` apparait **exactement une fois**
2. Aucun double toast M7
3. Pas de log `warn` sur `installation_salt absent` ou `sendMessage failed`

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

**Mise a jour matrice apres ce chapitre** : remplir les colonnes Google et Microsoft dans `docs/p5-recette/matrice-compatibilite-providers-m7.md` §3 avec statut, date, version extension.

---

## 5. Chapitre UC-02 — Gestionnaires de mots de passe

**Tache origine** : TACHE-069
**Scenarios detailles** : `docs/p5-tests/p5-uc02-password-managers-scenarios-v1.0.md`
**Lien matrice** : `docs/p5-recette/matrice-compatibilite-providers-m7.md` §4
**Statut actuel matrice** : KeePassXC, Bitwarden, Vaultwarden valides 2026-04-17 (PR #11). Chrome PM : comportement connu (isTrusted=false sur autofill silencieux).

**Pre-requis du chapitre** :
- ARB-UC02-01 tranche : Option A (filtrage `event.isTrusted=false`) — decide et implemente
- URL de test : `https://saucedemo.com` (credentials publics : `standard_user` / `secret_sauce`)
- Deuxieme domaine : `https://practicetestautomation.com/practice-test-login/` (`student` / `Password123`)
- M7 active, storage vide avant chaque scenario

**Rappel comportement isTrusted** : si `event.isTrusted=false` (autofill + auto-submit programmatique), M7 ne captura pas — comportement attendu et voulu. Si `event.isTrusted=true` (autofill + clic manuel utilisateur), M7 captura — comportement voulu.

---

### TC-M7-UC02-01 — Chrome PM : autofill + submit manuel

**Reference** : S-UC02-CP-02
**Criticite** : P0
**Provider** : Chrome Password Manager

**Pre-condition** :
- Profil Chrome avec credential `saucedemo.com` sauvegarde dans Chrome PM
- Storage M7 vide

**Given** : Chrome PM a auto-rempli le formulaire `saucedemo.com`
**When** : l'utilisateur clique manuellement sur le bouton "Login"
**Then** :
1. Log `Sentinel Nudge M7: sending password_submitted to SW` present (isTrusted=true sur clic manuel)
2. Reponse SW : `{ action: "skip", reason: "no_reuse" }` (premier usage)
3. Hash stocke en IndexedDB

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC02-02 — Chrome PM : autofill sans submit (pas de faux positif)

**Reference** : S-UC02-CP-01
**Criticite** : P0

**Pre-condition** : Chrome PM a sauvegarde les credentials `saucedemo.com`, storage M7 vide

**Given** : formulaire `saucedemo.com` affiche
**When** : Chrome PM remplit automatiquement les champs — sans que l'utilisateur clique sur Login
**Then** :
1. Aucun log `sending password_submitted` dans la console
2. Aucun toast M7
3. `pending_m7_toast` absent de chrome.storage.local

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC02-03 — Bitwarden : autofill + submit manuel

**Reference** : S-UC02-BW-02
**Criticite** : P0
**Provider** : Bitwarden

**Pre-condition** :
- Bitwarden installe et deverrouille, credentials `saucedemo.com` enregistres
- Storage M7 vide

**Given** : Bitwarden a rempli le formulaire via Ctrl+Shift+L ou le menu
**When** : l'utilisateur clique manuellement sur "Login"
**Then** :
1. Log `sending password_submitted` present
2. Reponse SW : `{ action: "skip", reason: "no_reuse" }`
3. Hash stocke en IndexedDB
4. Aucun toast (premier usage)

**Verification securite** : verifier que Bitwarden n'injecte pas l'attribut `data-form-type` qui pourrait court-circuiter `handleFocusOnPasswordField` (risque R-UC02-01 — voir §5.3 du document de reference).

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC02-04 — Detection reuse inter-domaine (cas nominal M7)

**Reference** : S-UC02-CP-04
**Criticite** : P0

**Pre-condition** :
- Un hash pour `saucedemo.com` est deja stocke (executer TC-M7-UC02-01 ou 03 au prealable)
- `pending_m7_toast` absent, cooldown non actif

**Given** : l'utilisateur navigue sur `https://practicetestautomation.com/practice-test-login/`
**When** : il saisit le **meme mot de passe** utilise sur `saucedemo.com` et soumet
**Then** :
1. Log `Sentinel Nudge M7: SW response received` contient `{ action: "show" }` (reuse detecte)
2. Toast M7 "Mot de passe deja utilise" s'affiche en bas a droite
3. Le toast comporte un bouton "En savoir plus" et un bouton "Supprimer ce domaine"
4. Auto-fermeture du toast apres ~8 secondes

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC02-05 — No reuse intra-domaine (pas de faux positif)

**Reference** : S-UC02-CP-04 variante
**Criticite** : P0

**Pre-condition** : hash pour `saucedemo.com` deja stocke

**Given** : l'utilisateur retourne sur `https://saucedemo.com` et soumet le meme mot de passe
**When** : le submit se produit
**Then** :
1. Log SW : `{ action: "skip", reason: "no_reuse" }` (intra-domaine — guard `domain_hash` identique)
2. Aucun toast M7

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

**Mise a jour matrice apres ce chapitre** : mettre a jour `docs/p5-recette/matrice-compatibilite-providers-m7.md` §4 pour Chrome PM et Bitwarden.

---

## 6. Chapitre UC-03 — Iframes same-origin

**Tache origine** : TACHE-070
**Mini-DAT de reference** : `docs/p4-conception/p5-minidat-tache-070-uc03-iframes-v1.0.md`
**Dependance code** : `all_frames: true` dans `manifest.json` (implemente dans la tache TACHE-070)

**Pre-requis du chapitre** :
- La configuration `all_frames: true` est presente dans `src/manifest.json` content_scripts
- Build rebuilde (`npm run build`) apres cette modification

---

### TC-M7-UC03-01 — Iframe same-origin : detection M7

**Reference** : mini-DAT TACHE-070 §1.1
**Criticite** : P0

**Pre-condition** :
- Une page de test avec iframe same-origin est disponible (fixture ou site de test)
- Exemple : creer une page HTML locale `tests/fixtures/uc03-iframe-same-origin.html` contenant `<iframe src="/login-frame.html">` avec un formulaire password dans l'iframe
- Serveur HTTP local : `npx http-server . -p 8080` depuis la racine du projet
- Storage M7 vide

**Given** : l'utilisateur navigue sur la page contenant l'iframe same-origin
**When** : il saisit un mot de passe dans le formulaire **a l'interieur de l'iframe** et soumet
**Then** :
1. Log `Sentinel Nudge password-detector: injected` visible dans la console de l'iframe (le content script a bien ete injecte dans l'iframe grace a `all_frames: true`)
2. Log `sending password_submitted` visible
3. `domain_hash` correspond au hostname de l'iframe (identique au top frame pour le cas same-origin)
4. Hash stocke en IndexedDB

**Note** : ouvrir la DevTools sur le frame de l'iframe (menu deroulant en haut de la console pour selectionner le frame).

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC03-02 — Iframe cross-origin : limite documentee (UC-04)

**Reference** : post-mortem M7 §4.1 UC-04 + TACHE-071
**Criticite** : P2 (limite par conception, non bloquante v1)

**Contexte** : les iframes cross-origin sont hors perimetre de Sentinel Nudge v1. Le content script ne peut pas etre injecte dans une iframe d'un domaine different (contrainte MV3 + Same-Origin Policy). Ce comportement est documente comme limite connue, non corrigeable sans refonte architecturale majeure.

**Given** : une page contient un iframe cross-origin avec un formulaire password
**When** : l'utilisateur soumet le formulaire dans l'iframe cross-origin
**Then** : M7 ne detecte pas la soumission — comportement attendu et correct (limite documentee)

**Action** : documenter la limite dans la FAQ utilisateur et le README. Aucun defaut a creer.

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` CONNU-VALIDE (limite documentee) | | |

---

## 7. Chapitre UC-05 — Toggle show/hide

**Tache origine** : TACHE-072
**Mini-DAT de reference** : `docs/p4-conception/p5-minidat-tache-072-toggle-show-hide-v1.1.md`
**Principe cle** : tout input ayant presente `type="password"` a un instant donne reste dans le perimetre de detection M7 jusqu'a destruction du DOM (INV de cycle de vie TACHE-072 §1.2)

**Pre-requis du chapitre** :
- TACHE-072 mergee (MutationObserver etendu avec `attributes: true, attributeFilter: ['type']`)
- Build a jour

---

### TC-M7-UC05-01 — Toggle password->text : detection preservee

**Reference** : mini-DAT TACHE-072 §2.4 Cas A
**Criticite** : P0

**Site de test suggere** : n'importe quel site avec bouton "oeil" (ex. `https://saucedemo.com` si le bouton est present, ou une fixture `tests/fixtures/uc05-toggle.html`)

**Pre-condition** :
- Page avec formulaire login comportant un bouton "voir le mot de passe" (toggle type password<->text)
- Storage M7 vide

**Given** : l'utilisateur est sur le formulaire de login, le champ password est en `type="password"`
**When** : il clique sur le bouton "oeil" pour afficher le mot de passe — le `type` passe a `"text"`
**Then** : le log `MutationObserver: password input registered (type mutation)` est visible dans la console (l'input a ete ajoute a `_snPasswordInputs`)

**When** : l'utilisateur clique sur le bouton "Se connecter" (le champ est toujours en `type="text"` au moment du submit)
**Then** :
1. Log `sending password_submitted` present (M7 a detecte la soumission malgre le type="text")
2. Hash stocke en IndexedDB
3. Aucun faux negatif (M7 n'a pas ignore le champ a cause du type courant)

**Invariant de securite** : `_snPasswordInputs` contient bien l'input apres la mutation — verifiable en console SW : `await chrome.storage.local.get(['diagnostics'])`.

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC05-02 — Toggle text->password : capture elargie

**Reference** : mini-DAT TACHE-072 §2.4 Cas B (ARB-072-02 Option A)
**Criticite** : P0

**Pre-condition** : page de test avec input initialement `type="text"` dont le type est change en `"password"` par JavaScript (pattern React lazy-defined)

**Given** : un input initiallement `type="text"` est present dans le DOM
**When** : JavaScript modifie son attribut `type` en `"password"` (ex. click sur bouton "Masquer")
**Then** : le MutationObserver detecte la mutation et ajoute l'input a `_snPasswordInputs`

**When** : l'utilisateur soumet le formulaire
**Then** :
1. M7 capture la soumission
2. Hash stocke en IndexedDB

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC05-03 — Toggle + auto-fill gestionnaire (combinaison UC-02+UC-05)

**Reference** : post-mortem M7 §4.2
**Criticite** : P1

**Pre-condition** :
- Bitwarden installe et deverrouille
- Page avec bouton toggle present

**Given** : Bitwarden a rempli le champ password
**When** : l'utilisateur clique sur le bouton "voir" (toggle -> type="text"), puis clique "Connexion"
**Then** :
1. Le log `sending password_submitted` est present (isTrusted=true sur clic manuel)
2. Hash stocke

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

## 8. Chapitre UC-06 — Inputs dynamiques React/Vue

**Tache origine** : TACHE-073
**Scenarios detailles** : `docs/p5-tests/p5-uc06-inputs-dynamiques-scenarios-v1.0.md`

**Pre-requis du chapitre** :
- Fichiers de fixtures presents dans `tests/fixtures/` : `uc06-react-use-effect.html`, `uc06-vue-modal.html`, `uc06-conditional-step.html`, `uc06-react-rerender.html`, `uc06-react-orphan-input.html`
- Serveur HTTP local : `npx http-server . -p 8080` depuis la racine du projet
- TACHE-101 mergee (correctif F-UC01-01 necessaire pour S-UC06-05)

---

### TC-M7-UC06-01 — React useEffect delay 100ms

**Reference** : S-UC06-01
**Criticite** : P0

**Pre-condition** :
- Ouvrir `http://localhost:8080/tests/fixtures/uc06-react-use-effect.html`
- Storage M7 vide

**Given** : la page charge — le DOM ne contient pas encore d'`input[type="password"]` (le form React se monte apres 100ms)
**When** : apres 150ms, l'input apparait ; l'utilisateur saisit un mot de passe et clique "Se connecter"
**Then** :
1. Log `Sentinel Nudge M7: password submitted` ou `M7: pending toast stored` present
2. Hash enregistre en IndexedDB
3. Aucune erreur JavaScript dans la console

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC06-02 — Modal Vue a la demande

**Reference** : S-UC06-02
**Criticite** : P1

**Pre-condition** : `http://localhost:8080/tests/fixtures/uc06-vue-modal.html`, storage vide

**Given** : la page affiche uniquement un bouton "Ouvrir le formulaire de connexion" (aucun input password dans le DOM initial)
**When** : l'utilisateur clique sur le bouton — la modal s'affiche avec un input password — il saisit et soumet
**Then** :
1. Le MutationObserver a detecte l'insertion de l'input password dans la modal
2. Log `password submitted` present
3. Hash enregistre

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC06-03 — Input conditionnel apres validation email

**Reference** : S-UC06-03
**Criticite** : P0

**Pre-condition** : `http://localhost:8080/tests/fixtures/uc06-conditional-step.html`, storage vide

**Given** : la page affiche Step 1 (champ email uniquement, aucun input password)
**When** : l'utilisateur saisit un email, clique "Suivant" — Step 2 apparait avec l'input password — il saisit le mot de passe et clique "Se connecter"
**Then** :
1. Log `password submitted` present
2. Hash enregistre en IndexedDB

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC06-04 — Re-render complet apres erreur

**Reference** : S-UC06-04
**Criticite** : P0

**Pre-condition** :
- `http://localhost:8080/tests/fixtures/uc06-react-rerender.html`
- `password_hashes` contient deja un hash pour `test-password-m7` (effectuer une 1ere soumission au prealable)

**Given** : l'utilisateur saisit `wrong-password` et soumet — la page simule une erreur "Wrong password" et recrée entierement le form React (le noeud DOM input est remplace)
**When** : l'utilisateur saisit `test-password-m7` dans le **nouvel** input et soumet
**Then** :
1. M7 detecte la soumission du nouvel input (MutationObserver a recapture le nouveau noeud)
2. Log `password submitted` present
3. Si hash correspondant sur un autre domaine : toast M7 affiche

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

### TC-M7-UC06-05 — Input nu sans form cree par React (post-TACHE-101)

**Reference** : S-UC06-05 — depend de TACHE-101
**Criticite** : P1
**Pre-condition** : TACHE-101 mergee (correctif `node.matches('input[type="password"]')`)

**Pre-condition** : `http://localhost:8080/tests/fixtures/uc06-react-orphan-input.html`, storage vide

**Given** : la page affiche uniquement un bouton "Charger le formulaire"
**When** : l'utilisateur clique — React cree et insere un input password **directement comme noeud racine** dans `document.body` (sans wrapper div)
**When** : l'utilisateur saisit un mot de passe et presse Enter
**Then** :
1. Log `M7/M9: orphan password Enter pressed` present (listener global capture phase)
2. Hash enregistre en IndexedDB
3. Aucune erreur JavaScript

**Si ce test echoue** : cela indique que le correctif TACHE-101 n'a pas entierement resolu le chemin d'execution pour les inputs orpelins. Creer un defaut avec classification P1.

| Resultat | Date | Observations |
|----------|------|--------------|
| `[ ]` PASS / `[ ]` FAIL / `[ ]` BLOQUE | | |

---

## 9. Chapitre M2 — Typosquatting

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

## 10. Chapitre M3 — Score hebdomadaire

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

## 11. Chapitre M5 — Mise a jour navigateur

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

## 12. Chapitre M6 — Quiz spaced repetition

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

## 13. Chapitre M9 — Donnees sensibles (saisie)

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

## 14. Chapitre M17 — Presse-papiers

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

## 15. Chapitre Recette providers M7

**Livrable vivant de reference** : `docs/p5-recette/matrice-compatibilite-providers-m7.md`

Ce chapitre ne duplique pas les scenarios de la matrice. Il donne les instructions pour la mettre a jour.

**A chaque passage de recette :**

1. Executer les scenarios des chapitres 4, 5 et noter les resultats
2. Ouvrir `docs/p5-recette/matrice-compatibilite-providers-m7.md`
3. Mettre a jour les lignes correspondantes :
   - **§3 Providers IdP** : Google et Microsoft — passer de `🔬` a `✅` ou `❌` selon les resultats TC-M7-UC01-01 et TC-M7-UC01-02
   - **§4 Providers Password Managers** : Chrome PM et Bitwarden — mettre a jour si statut change
   - **§5 Sites cibles** : ajouter tout nouveau site teste en recette
4. Renseigner tous les champs de la ligne (version extension, version navigateur, date, testeur)
5. Si statut != `✅` : creer un ticket BACKLOG (BUG ou TACHE) et le referencer dans la colonne "Commentaires"

**Legende des statuts matrice** :
- `✅` Compatible — detection M7 fonctionnelle
- `⚠` Partiellement compatible — limitations connues (lien ticket)
- `❌` Non compatible — ticket BUG obligatoire
- `⏸` Reporte — ticket TACHE Could dans BACKLOG
- `🔬` En cours de test — statut non fige

---

## 16. Commandes DevTools utiles

### 16.1 Inspection du storage

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

### 16.2 Decodage de password_hashes (IndexedDB)

Les hashes sont stockes chiffres (AES-256-GCM). Il n'est pas possible de les dechiffrer depuis la console SW sans disposer de la cle materiau (`encryption_key_material`). Pour verifier leur presence :

```
1. DevTools > onglet Application (F12 sur l'onglet avec l'extension active)
2. Panneau gauche > IndexedDB > sentinel-nudge-db > password_hashes
3. Les entrees sont visibles avec leur structure chiffree : { value, iv, tag, domain_hash }
4. Le champ "value" est le ciphertext AES-256-GCM — non lisible en clair (attendu)
5. Le champ "domain_hash" est le SHA-256 du hostname — verifiable par calcul
```

### 16.3 Calcul manuel du domain_hash (verification)

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

### 16.4 Declenchement manuel M5 (force check)

```javascript
// Console SW
const response = await chrome.runtime.sendMessage({
  module: 'M5', action: 'check_update', payload: {}, timestamp: Date.now(),
});
console.log('M5:', response);
```

### 16.5 Declenchement manuel M6 (force quiz)

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

### 16.6 Inspection des diagnostics par module

```javascript
// Console SW — afficher l'etat de sante de chaque module
const { diagnostics } = await chrome.storage.local.get(['diagnostics']);
console.log('Diagnostics:', JSON.stringify(diagnostics, null, 2));
// Chaque module doit avoir ready: true et un last_boot recent
```

### 16.7 Regeneration complete des pre-requis (reset d'urgence)

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

### 16.8 Injection d'un message de simulation M7 (test sans navigation)

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

### 16.9 Reinitialisation ciblee par module

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

## 17. En cas d'anomalie

### 17.1 Template de rapport de bug

Copier et remplir pour chaque defaut constate :

```
ID BUG       : BUG-[date]-[numero] (ex. BUG-2026-04-18-001)
Scenario     : [ID du scenario, ex. TC-M7-UC01-01]
Date         : [date et heure]
Classification : P0 / P1 / P2
Titre        : [description courte en une ligne]

Environnement :
- Version Chrome       : 
- Version Node         : 
- Version extension    : v1.0 (commit SHA courte : )
- OS                   : Windows 11

Etapes de reproduction :
1. 
2. 
3. 

Comportement observe :
[Description precise — inclure les logs console et/ou DevTools]

Comportement attendu :
[Decrire le resultat correct attendu]

Logs console (extraits) :
[Coller les lignes pertinentes]

Logs SW (extraits) :
[Coller les lignes pertinentes]

Storage observe :
[Coller le resultat de chrome.storage.local.get(null) si pertinent]

Impact :
[Impact fonctionnel et securite si applicable]
```

### 17.2 Classification et procedure par niveau

**P0 — Bloquant release v1** :
1. Stopper la recette
2. Creer le ticket dans BACKLOG.md avec type BUG et priorite Must
3. Informer le responsable du projet avant toute autre action
4. Ne pas pousser en production tant que le correctif n'est pas valide en recette
5. Si la faille a un impact securite : declencher le runbook `docs/securite/runbook-reponse-incident.md`

**P1 — A corriger avant release** :
1. Terminer le scenario en cours
2. Creer le ticket BACKLOG.md avec type BUG et priorite Should
3. Planifier le correctif dans le cycle courant

**P2 — A corriger en v1.1** :
1. Documenter dans BACKLOG.md avec type BUG et priorite Could
2. Documenter la limitation dans le README ou la FAQ utilisateur
3. La release peut etre effectuee en etat avec documentation de la limite

### 17.3 Runbook incident securite

Pour tout defaut ayant un impact sur la securite (fuite de donnees, contournement de la protection, salt ou cle expose) :

Referencer : `docs/securite/runbook-reponse-incident.md`

Les seuils de declenchement du runbook :
- Toute fuite de `installation_salt` ou `encryption_key_material` en clair
- Toute exposition de la valeur en clair d'un mot de passe dans les logs
- Toute communication reseau involontaire (violation du principe privacy by design)
- Tout comportement permettant a un script de page d'extraire les donnees de l'extension

### 17.4 Mise a jour du jeu de regression

Apres chaque bug corrige en recette manuelle :
1. S'assurer qu'un test unitaire ou E2E couvre le scenario du bug (principe : chaque bug = 1 test de regression)
2. Ajouter la reference au bug dans le commentaire du test
3. Le nouveau test doit passer en vert avant la PR du correctif

---

## 18. Tableau de bord recette (a remplir en fin de session)

| Chapitre | Nb scenarios | PASS | FAIL | BLOQUE | Taux |
|----------|-------------|------|------|--------|------|
| UC-01 Login multi-etape | 5 | | | | |
| UC-02 Gestionnaires PM | 5 | | | | |
| UC-03 Iframes | 2 | | | | |
| UC-05 Toggle show/hide | 3 | | | | |
| UC-06 Inputs dynamiques | 5 | | | | |
| M2 Typosquatting | 3 | | | | |
| M3 Score | 2 | | | | |
| M5 MAJ navigateur | 2 | | | | |
| M6 Quiz | 2 | | | | |
| M9 Donnees sensibles | 2 | | | | |
| M17 Presse-papiers | 3 | | | | |
| **Total** | **34** | | | | |

**Date de session recette** : ___
**Version extension testee** : ___
**Version Chrome** : ___
**Resultats : `[ ]` Release autorisee — `[ ]` Release bloquee (defaut P0 ouvert)**

---

## 19. Liens de reference rapide

| Document | Chemin | Usage |
|----------|--------|-------|
| Matrice providers M7 | `docs/p5-recette/matrice-compatibilite-providers-m7.md` | Mettre a jour apres recette UC-01/UC-02 |
| Mini-DAT UC-01 | `docs/p4-conception/p5-minidat-tache-068-uc01-login-multi-etape-v1.1.md` | Details techniques login multi-etape |
| Scenarios UC-02 detail | `docs/p5-tests/p5-uc02-password-managers-scenarios-v1.0.md` | 24 scenarios PM detailles |
| Mini-DAT UC-03 iframes | `docs/p4-conception/p5-minidat-tache-070-uc03-iframes-v1.0.md` | Details techniques iframes same-origin |
| Mini-DAT UC-05 toggle | `docs/p4-conception/p5-minidat-tache-072-toggle-show-hide-v1.1.md` | Details MutationObserver type |
| Scenarios UC-06 detail | `docs/p5-tests/p5-uc06-inputs-dynamiques-scenarios-v1.0.md` | Fixtures React/Vue requis |
| Guide DevTools original | `docs/p4-conception/p4prime-tests-manuels-modules-asynchrones-v1.0.md` | M3/M5/M6/M7 commandes avancees |
| Post-mortem M7 | `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md` | 15 UC identifes et priorises |
| Runbook incident | `docs/securite/runbook-reponse-incident.md` | Procedure si defaut securite P0 |
| BACKLOG | `.claude/BACKLOG.md` | Creer les defauts trouves |
