# P5 — Scénarios de recette UC-02 : Gestionnaires de mots de passe

**Référence tâche** : TACHE-069
**Phase** : P5 — Tests unitaires / Recette UC P0 bloquants v1
**Version** : 1.0
**Date** : 2026-04-17
**Auteur** : Testeur QA
**Statut** : Soumis pour validation — Référent qualité

---

## 1. Objectif et contexte

### 1.1 Objectif du UC-02

UC-02 couvre la détection M7 (réutilisation de mots de passe inter-domaines) dans le contexte des gestionnaires de mots de passe (password managers, ci-après PM). Ces outils peuvent auto-remplir et, pour certains, auto-soumettre les formulaires de connexion. Le comportement de M7 doit être défini, testé et documenté pour chaque cas.

### 1.2 Référence post-mortem M7

Le PV du comité post-mortem M7 (`docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md`, §4.1, UC-02) identifie ce cas d'usage comme **P0 bloquant** pour la v1 :

> "Gestionnaires de mots de passe qui auto-remplissent et auto-submittent (Dashlane observé en logs, 1Password, Bitwarden, LastPass, Chrome Password Manager). Non testé. Risque majeur : le PM peut intercepter le submit avant notre event capture. Ou le déclencher sans interaction utilisateur → toast inapproprié."
>
> Recommandation : "Tester avec Bitwarden. Vérifier si `event.isTrusted=false` suffit à filtrer."

### 1.3 Décisions attendues du présent protocole

Ce protocole doit permettre de statuer sur deux questions avant tout développement correctif :

1. La détection M7 fonctionne-t-elle correctement (ni faux positif, ni faux négatif) avec chaque PM ?
2. Faut-il filtrer les soumissions programmatiques (`event.isTrusted=false`) ou conserver le comportement actuel ?

Ces questions font l'objet d'une analyse d'impact code en section 5.

---

## 2. Périmètre et priorisation des gestionnaires

### 2.1 Règle projet

SESSION.md stipule : "Gestionnaires mdp : uniquement projets open source nommés (KeePass, KeePassXC, Bitwarden, Vaultwarden)". Cette règle s'applique aux recommandations faites à l'utilisateur. Elle ne restreint pas le périmètre de test : l'extension doit rester fonctionnelle avec tout PM populaire pour ne pas pénaliser les utilisateurs.

### 2.2 Priorisation

| Priorité | Gestionnaire | Justification |
|----------|-------------|---------------|
| **P0** | Chrome Password Manager (CPM) | Présent par défaut sur tout poste Chrome ; cas le plus fréquent en production |
| **P0** | Bitwarden | Open source, leader libre ; recommandé par la règle projet |
| **P1** | 1Password | Très répandu en entreprise ; auto-submit documenté |
| **P1** | KeePassXC | Open source ; comportement navigateur via extension KeePassXC-Browser |
| **P2** | Dashlane | Présent dans les logs post-mortem M7 ; comportement auto-submit observé |
| **P2** | Vaultwarden | Compatible Bitwarden (serveur auto-hébergé) ; comportement identique au client Bitwarden |

**Note Vaultwarden** : Vaultwarden est un serveur back-end auto-hébergé compatible avec le client Bitwarden. L'extension navigateur utilisée est identique à Bitwarden. Les scénarios P2 pour Vaultwarden seront exécutés avec le client Bitwarden pointant sur une instance Vaultwarden locale. Si les résultats sont identiques à Bitwarden P0, les scénarios Vaultwarden peuvent être marqués "couverts par Bitwarden".

---

## 3. Pré-conditions communes à tous les scénarios

### 3.1 Environnement de test

- **Navigateur** : Google Chrome stable (version >= 120) sur Windows 11
- **Extension** : Sentinel Nudge chargée en mode développeur (`dist/` buildée avec `npm run build`)
- **Extension activée** : M7 activé dans les options Sentinel Nudge
- **Service Worker** : SW initialisé (clé AES présente dans `chrome.storage.local`, vérifiable via `chrome://extensions > Inspect views : service worker > Console`)
- **Outil de diagnostic** : DevTools Console ouvert sur l'onglet cible (pour observer les logs M7 structurés JSON)
- **URL cible** : `https://saucedemo.com` (site de démo avec formulaire login classique, credentials publics : `standard_user` / `secret_sauce`)
- **Deuxième domaine** : `https://practicetestautomation.com/practice-test-login/` (credentials publics : `student` / `Password123`)

### 3.2 État du storage avant chaque scénario

Sauf indication contraire dans la pré-condition du scénario, l'état de départ est :

- `password_hashes` IndexedDB : **vide** (aucun hash précédent)
- `pending_m7_toast` : absent de `chrome.storage.local`
- `m7_last_nudge_by_domain` : absent ou vide
- Suppression_list M7 (whitelist IndexedDB) : vide

**Procédure de réinitialisation entre scénarios** :
1. Ouvrir `chrome://extensions`
2. Sur la carte Sentinel Nudge, cliquer "Options"
3. Dans la page Options, utiliser le bouton "Effacer toutes mes données" (si disponible) OU
4. Ouvrir DevTools SW Console et exécuter :
   ```js
   chrome.storage.local.clear(() => console.log('storage.local cleared'));
   ```
5. Recharger le Service Worker : cliquer "Service Worker" puis "Update" sur la page `chrome://extensions`
6. Fermer et rouvrir l'onglet cible

### 3.3 Vérification des logs M7

Les logs M7 sont émis en JSON structuré dans la console du content script (DevTools > onglet cible > Console) et dans la console du SW (chrome://extensions > Inspect SW).

Logs attendus au submit :
- `"Sentinel Nudge M7: sending password_submitted to SW"` — le CS a capturé le submit
- `"Sentinel Nudge M7: SW response received"` avec `{ response: { success: true, action: "skip", reason: "no_reuse" } }` ou `action: "show"`

Absence de ces logs = M7 n'a pas capturé le submit (faux négatif).

---

## 4. Scénarios de recette par gestionnaire

### Référence des identifiants de scénarios

Format : `S-UC02-[XX]-[NN]`
- `XX` : code gestionnaire (CP=Chrome PM, BW=Bitwarden, 1P=1Password, KX=KeePassXC, DL=Dashlane, VW=Vaultwarden)
- `NN` : numéro de scénario (01 à 04)

---

### 4.1 Chrome Password Manager (CPM) — P0

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

### 4.2 Bitwarden — P0

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

### 4.3 1Password — P1

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

### 4.4 KeePassXC — P1

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

### 4.5 Dashlane — P2

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

### 4.6 Vaultwarden — P2

**Pré-requis d'installation** :
- Docker Desktop installé (pour l'instance Vaultwarden locale)
- Lancer Vaultwarden : `docker run -d --name vaultwarden -p 8080:80 vaultwarden/server:latest`
- Configurer le client Bitwarden pour pointer sur `http://localhost:8080` (Settings > Self-hosted environment)
- Créer un compte et enregistrer les credentials de test
- **Note** : HTTPS requis pour certaines fonctions Bitwarden. Utiliser un tunnel ngrok ou accepter les limitations HTTP en test local.

**Principe de couverture** : Les scénarios S-UC02-VW-01 à 04 reproduisent exactement les scénarios S-UC02-BW-01 à 04 avec le client Bitwarden pointant sur Vaultwarden. Si les résultats sont identiques à Bitwarden (P0), indiquer "Couvert par Bitwarden — comportement identique" et clore les scénarios P2.

Les scénarios ne sont pas dupliqués ici ; se référer aux scénarios S-UC02-BW-01 à 04 avec la note de contexte Vaultwarden.

---

## 5. Analyse d'impact code

### 5.1 Question 1 — M7 capture-t-il les submits `event.isTrusted=false` ?

**Réponse basée sur la lecture du code** :

**Oui, dans l'implémentation actuelle.** Il n'existe aucun filtre sur `event.isTrusted` dans `password-detector.ts`. Les listeners `submit` sont attachés via `form.addEventListener('submit', ...)` et le listener global `document.addEventListener('submit', ..., { capture: true })`. Ces listeners reçoivent tous les événements submit quelle que soit leur origine — humaine ou programmatique.

La propriété `event.isTrusted` est disponible sur l'objet `SubmitEvent` et `Event` passé à `handleFormSubmit(event, pwdField)` mais elle n'est pas lue ni vérifiée dans le code. Le type de `event` est `SubmitEvent | Event`, ce qui est cohérent.

**Exception importante pour `form.submit()`** : si un PM appelle `form.submit()` directement (méthode legacy), **aucun événement `submit` n'est déclenché** du tout dans le DOM. Dans ce cas, M7 est aveugle indépendamment de tout filtre `isTrusted`. Ce comportement est à documenter lors de l'exécution des scénarios -03.

### 5.2 Question 2 — Risque de faux positifs M7 lors d'auto-fill (formulaires cachés)

**Risque identifié : réel mais mitigé par le code actuel.**

Chrome PM peut remplir des formulaires cachés (ex. formulaires de connexion pré-chargés en `display:none`). La séquence d'un faux positif serait :

1. PM remplit un formulaire caché
2. Le site déclenche programmatiquement le submit du formulaire caché
3. M7 capture ce submit → hash stocké pour un domaine dont l'utilisateur ne s'est pas consciemment connecté

Le code actuel contient une protection partielle via `submittedFields` (WeakSet) qui évite le double traitement du même champ. Cependant, si plusieurs formulaires cachés avec champs password distincts sont présents, chacun génèrerait un hash distinct.

**Facteur aggravant** : certains sites (ex. portails SSO) pré-chargent plusieurs formulaires de connexion pour des domaines différents dans une même page. Si tous sont auto-soumis par un PM, M7 pourrait stocker des hashes pour des domaines que l'utilisateur n'a pas consciemment visités.

**Évaluation de la probabilité** : faible en pratique (les PM ne soumettent généralement que le formulaire visible actif), mais non nulle avec l'option "Auto-fill on page load" active.

### 5.3 Question 3 — Faut-il filtrer `event.isTrusted=false` ?

**Analyse des options :**

**Option A — Filtrer `event.isTrusted=false` (ne capturer que les submits humains)**

Avantages :
- Élimine les faux positifs lors d'auto-submit par PM (toast non sollicité)
- Respecte l'intention de M7 : alerter l'utilisateur sur un comportement qu'il a consciemment effectué
- Règle propre, facile à auditer

Inconvénients :
- Les PM qui simulent un clic humain sur le bouton submit (ex. 1Password clique le bouton via automation script) peuvent générer `event.isTrusted=true` même si c'est programmatique — le filtre serait contourné
- Si `form.submit()` est utilisé (pas d'event du tout), le filtre est sans effet de toute façon

**Option B — Conserver le comportement actuel (pas de filtre)**

Avantages :
- Capture maximale — aucun hash manqué
- Simplicité

Inconvénients :
- Toast M7 potentiellement déclenché sans action consciente de l'utilisateur (lors d'auto-submit PM)
- Risque de faux positifs sur formulaires cachés (§5.2)

**Option C — Ajouter un flag "dernière soumission = auto-fill" pour différer la décision**

Avantages :
- Permet de capturer le hash (utile pour les analyses futures) tout en indiquant au toast qu'il doit adapter son message
- Plus nuancé

Inconvénients :
- Complexité accrue
- La détection d'auto-fill elle-même est heuristique (§5.4)

**Recommandation QA** : **Option A avec exception documentée**. Le risque principal est un toast non sollicité lors d'un auto-submit PM — ce qui est une nuisance significative pour l'utilisateur et nuit à la crédibilité de l'extension. Filtrer `event.isTrusted=false` est la décision la plus conservatrice et la plus cohérente avec la philosophie de M7 (alerter sur un comportement utilisateur conscient). L'exception pour `form.submit()` (pas d'event) est acceptable : dans ce cas M7 est silencieux, ce qui est le moindre mal. Cette recommandation doit être soumise en arbitrage (cf. §5.6 ARB-UC02-01).

### 5.4 Question 4 — Flag "dernière soumission = auto-fill" ?

**Analyse :**

Un tel flag nécessiterait de détecter l'auto-fill avant le submit. La détection actuelle dans `checkAutoFill()` est heuristique (champ rempli dans les 500ms après focus sans input event) et ne couvre pas tous les cas PM. De plus, le timing entre auto-fill et submit dans les scénarios PM auto-submit est souvent < 100ms, rendant la fenêtre de détection difficile à fiabiliser.

**Conclusion** : Un flag de ce type introduit une complexité significative pour une valeur ajoutée limitée (le filtre `isTrusted=false` en Option A couvre déjà le cas principal). Non recommandé pour v1. À reconsidérer si les tests montrent des comportements non couverts par Option A.

### 5.5 Question 5 — Gestionnaires qui masquent ou retardent le submit event

**Comportements connus (à confirmer lors des scénarios -03) :**

| PM | Méthode de submit probable | Impact sur M7 |
|----|---------------------------|---------------|
| Chrome PM | Pas d'auto-submit en standard | Sans objet |
| Bitwarden | `form.requestSubmit()` ou clic simulé | `isTrusted=false` attendu |
| 1Password | Clic programmé sur bouton submit | `isTrusted=false` attendu |
| KeePassXC | Dépend de l'option "Auto-Type" (simulation clavier) | Peut générer `isTrusted=true` via simulation clavier bas niveau |
| Dashlane | `form.requestSubmit()` (observé dans les logs post-mortem) | `isTrusted=false` attendu |

**Cas KeePassXC particulier** : L'option "Auto-Type" de KeePassXC simule des frappes clavier au niveau système, ce qui peut produire des events avec `isTrusted=true` dans certaines configurations. Ce comportement doit être vérifié lors du scénario S-UC02-KX-03.

**Cas `form.submit()` (legacy)** : Si un PM utilise cette méthode, aucun event `submit` n'est émis dans le DOM. La détection M7 est impossible sans refactoring spécifique (ex. monkey-patch de `HTMLFormElement.prototype.submit`). Cette approche est déconseillée (fragile, contournée facilement). Le comportement "M7 muet sur `form.submit()`" doit être documenté comme limite connue.

### 5.6 Arbitrage requis avant implémentation

#### ARB-UC02-01 — Filtrage des soumissions programmatiques dans M7

**Contexte** : M7 capture actuellement tous les événements `submit` sans distinction de leur origine. Les gestionnaires de mots de passe peuvent déclencher des soumissions programmatiques (`event.isTrusted=false`), potentiellement sans action consciente de l'utilisateur.

**Options** :

| Option | Description | Avantages | Inconvénients |
|--------|-------------|-----------|---------------|
| **A — Filtrer `isTrusted=false`** | Ajouter dans `handleFormSubmit` : `if ('isTrusted' in event && !event.isTrusted) return;` | Élimine les faux positifs auto-submit PM ; cohérent avec l'intention de M7 | Ne capture pas les submits auto-PM (faux négatifs limités mais réels) ; contournable si PM simule clic |
| **B — Conserver le comportement actuel** | Aucune modification | Capture maximale | Toast M7 potentiellement déclenché sans action utilisateur |
| **C — Capturer + flag auto-fill** | Capturer tous les submits mais annoter avec flag `isTrusted` pour adapter le message toast | Nuancé, information riche | Complexité ; détection auto-fill heuristique non fiable |

**Recommandation QA** : Option A.

**Décision requise de** : Commanditaire (RSSI).

**Impact sur le développement** : Si Option A retenue, modification de `handleFormSubmit` (1 ligne) + tests unitaires correspondants (scénario TC-M7-13 à créer). Effort estimé : 0.5j développeur.

---

## 6. Tableau de synthèse des scénarios

| ID scénario | Gestionnaire | Type | Priorité | Sévérité échec |
|-------------|-------------|------|----------|----------------|
| S-UC02-CP-01 | Chrome PM | Auto-fill sans submit | P0 | P0 |
| S-UC02-CP-02 | Chrome PM | Auto-fill + submit manuel | P0 | P0 |
| S-UC02-CP-03 | Chrome PM | Auto-fill + auto-submit | P1 | P1 |
| S-UC02-CP-04 | Chrome PM | Connexion répétée (no_reuse) | P0 | P0 |
| S-UC02-BW-01 | Bitwarden | Auto-fill sans submit | P0 | P0 |
| S-UC02-BW-02 | Bitwarden | Auto-fill + submit manuel | P0 | P0 |
| S-UC02-BW-03 | Bitwarden | Auto-fill + auto-submit | P0 | P0 |
| S-UC02-BW-04 | Bitwarden | Connexion répétée (no_reuse) | P0 | P0 |
| S-UC02-1P-01 | 1Password | Auto-fill sans submit | P1 | P1 |
| S-UC02-1P-02 | 1Password | Auto-fill + submit manuel | P1 | P1 |
| S-UC02-1P-03 | 1Password | Auto-fill + auto-submit | P1 | P1 |
| S-UC02-1P-04 | 1Password | Connexion répétée (no_reuse) | P1 | P1 |
| S-UC02-KX-01 | KeePassXC | Auto-fill sans submit | P1 | P1 |
| S-UC02-KX-02 | KeePassXC | Auto-fill + submit manuel | P1 | P1 |
| S-UC02-KX-03 | KeePassXC | Auto-fill + auto-submit | P1 | P1 |
| S-UC02-KX-04 | KeePassXC | Connexion répétée (no_reuse) | P1 | P1 |
| S-UC02-DL-01 | Dashlane | Auto-fill sans submit | P2 | P2 |
| S-UC02-DL-02 | Dashlane | Auto-fill + submit manuel | P2 | P2 |
| S-UC02-DL-03 | Dashlane | Auto-fill + auto-submit | P2 | P2 |
| S-UC02-DL-04 | Dashlane | Connexion répétée (no_reuse) | P2 | P2 |
| S-UC02-VW-01 à 04 | Vaultwarden | (cf. Bitwarden) | P2 | P2 |

**Total : 24 scénarios** (20 détaillés + 4 Vaultwarden par référence à Bitwarden)

---

## 7. Prérequis de recette

### 7.1 Postes et environnements requis

| Ressource | Détails |
|-----------|---------|
| Poste Windows 11 | Chrome stable ≥ 120, DevTools accessibles |
| Compte Google de test | Pour Chrome PM — ne pas utiliser de compte personnel |
| Compte Bitwarden de test | Gratuit — ne pas utiliser de compte personnel |
| Compte 1Password de test | Version d'essai — ne pas utiliser de compte personnel |
| KeePassXC installé | Version Windows, open source |
| Compte Dashlane de test | Version d'essai |
| Docker Desktop | Pour Vaultwarden (P2 uniquement) |
| Build Sentinel Nudge | `npm run build` exécuté, `dist/` chargée en mode développeur |

### 7.2 Données de test

- Credentials `saucedemo.com` : `standard_user` / `secret_sauce` (publics, documentés)
- Credentials `practicetestautomation.com` : `student` / `Password123` (publics, documentés)
- Aucune donnée personnelle réelle dans les fixtures de test

### 7.3 Dépendances bloquantes avant exécution

1. **ARB-UC02-01 tranché** : le verdict PASS/FAIL des scénarios -03 dépend de cette décision
2. **TACHE-063 complétée** : protocole de recette formalisé (prérequis indiqué dans la mission)
3. **Build stable** : `npm run build && npm test` verts (CI verte sur la branche courante)

### 7.4 Durée estimée d'exécution

| Session | Périmètre | Durée estimée |
|---------|-----------|--------------|
| Session 1 | Chrome PM (P0) + Bitwarden (P0) | 2h |
| Session 2 | 1Password + KeePassXC (P1) | 2h |
| Session 3 | Dashlane + Vaultwarden (P2) | 2h |
| **Total** | | **6h** |

---

## 8. Grille de résultats d'exécution (à remplir lors de la recette)

| ID scénario | Date | Résultat (PASS/FAIL/BLOQUÉ) | `event.isTrusted` observé | Submit méthode observée | Défaut créé | Notes |
|-------------|------|-----------------------------|-----------------------------|--------------------------|-------------|-------|
| S-UC02-CP-01 | | | | | | |
| S-UC02-CP-02 | | | | | | |
| S-UC02-CP-03 | | Dépend ARB-UC02-01 | | | | |
| S-UC02-CP-04 | | | | | | |
| S-UC02-BW-01 | | | | | | |
| S-UC02-BW-02 | | | | | | |
| S-UC02-BW-03 | | Dépend ARB-UC02-01 | | | | |
| S-UC02-BW-04 | | | | | | |
| S-UC02-1P-01 | | | | | | |
| S-UC02-1P-02 | | | | | | |
| S-UC02-1P-03 | | Dépend ARB-UC02-01 | | | | |
| S-UC02-1P-04 | | | | | | |
| S-UC02-KX-01 | | | | | | |
| S-UC02-KX-02 | | | | | | |
| S-UC02-KX-03 | | Dépend ARB-UC02-01 | | | | |
| S-UC02-KX-04 | | | | | | |
| S-UC02-DL-01 | | | | | | |
| S-UC02-DL-02 | | | | | | |
| S-UC02-DL-03 | | Dépend ARB-UC02-01 | | | | |
| S-UC02-DL-04 | | | | | | |
| S-UC02-VW-01 à 04 | | Référence BW | | | | |

---

## 9. Risques et points de vigilance identifiés

### R-UC02-01 — Attribut `data-form-type` injecté par certains PM

**Description** : Le code `hasPasswordManagerHint()` (password-detector.ts, ligne 155) retourne `true` si l'attribut `data-form-type` est présent sur le champ. Cela provoque un `return` prématuré dans `handleFocusOnPasswordField()`, ce qui empêche M7 d'être initialisé sur le focus — mais M7 dépend du submit event, pas du focus. Le risque réel est sur M2/M9, pas sur M7 directement. Cependant, si ce `return` est interprété comme "ne pas traiter ce champ du tout", il y a un risque de faux négatif M7. À vérifier lors de S-UC02-1P-02 et S-UC02-BW-02.

**PM concernés** : 1Password (utilise `data-form-type`), possiblement Dashlane.

### R-UC02-02 — `form.submit()` ne déclenche pas d'event submit

**Description** : Si un PM utilise `form.submit()` pour soumettre (méthode legacy), aucun event `submit` n'est émis. M7 est aveugle dans ce cas. Le seul moyen de couvrir ce cas serait un monkey-patch de `HTMLFormElement.prototype.submit`, déconseillé car fragile et potentiellement détectable comme malware.

**Décision recommandée** : Documenter comme limite connue, non bloquant pour v1.

### R-UC02-03 — Toast M7 déclenché après expiration du cooldown lors d'auto-submit

**Description** : Si l'utilisateur a déjà un hash stocké pour le site A et que le PM auto-soumet le site A 31 jours plus tard, le cooldown est expiré et M7 pourrait afficher un toast sur un submit non conscient.

**Mitigation** : Couverte par Option A de ARB-UC02-01 (filtre `isTrusted=false`).

---

*Fin du document — Version 1.0 — TACHE-069 — 2026-04-17*
