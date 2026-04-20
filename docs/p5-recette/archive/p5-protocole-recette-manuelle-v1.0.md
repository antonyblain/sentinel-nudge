# Protocole de recette manuelle — Sentinel Nudge v1.0

**Version** : 1.0
**Date** : 2026-04-19
**Auteur** : Testeur QA (Fabrique)
**Statut** : Approuve
**Tache origine** : TACHE-063 (D-PM-05 post-mortem M7)
**Niveau de sensibilite** : Expose — signature commanditaire obligatoire

---

## 1. Objet et portee

Ce protocole formalise la recette manuelle de Sentinel Nudge v1 pour les six cas d'usage P0 identifies comme bloquants release par le post-mortem M7 (D-PM-05, 2026-04-14).

**Ce que ce protocole couvre** :

- Les criteres Pass/Fail nets pour chaque scenario, au format Given/When/Then
- Le gabarit de PV de recette datee et signable
- La procedure de mise en place de l'environnement de test et de reset entre sessions
- Les priorites P0/P1/P2 et leur definition contractuelle

**Ce que ce protocole ne couvre pas** :

- Les tests unitaires et d'integration automatises (cf. rapports TU/TI dans `docs/p5-tests/`)
- Les modules M2/M3/M5/M6/M9/M17 hors contexte UC-01 a UC-06 (couverts dans `docs/p5-recette/plan-tests-manuels-consolide-v1.0.md`)
- La recette CI/E2E Playwright (TACHE-059) — le present protocole est complementaire et ne se substitue pas aux tests automatises ; toute anomalie decouverte ici doit generer un test de regression automatise

**Relation avec les documents existants** :

- `docs/p5-recette/plan-tests-manuels-consolide-v1.0.md` : document de reference pour les autres modules (M2/M3/M5/M6/M9/M17) — ne pas dupliquer ici
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

## 5. Scenarios UC-01 — Login multi-etape (Google / Microsoft)

**Modules** : M7 (password-detector.ts)
**Mini-DAT** : `docs/p5-decisions/p5-minidat-tache-068-uc01-login-multi-etape-v1.1.md`
**Nota** : le hash M7 est associe au `location.hostname` de la page de soumission du mot de passe (Step 2), pas a celui de la page email (Step 1). Ce comportement est valide par ARB-068-01 Option A.

---

**SC-UC01-01** | Priorite : P0 | Modules : M7
**Scenario** : Google SPA — detection M7 sur login multi-etape email + password

```
Given : Extension installee et M7 actif. Storage reinitialise (Section 4.3).
        Un mot de passe de test X a ete prealablement enregistre pour le domaine "accounts.google.com"
        via une connexion anterieure (ou via import de fixture dans password_hashes).
When  : Ouvrir accounts.google.com/signin.
        Saisir l'email → bouton "Suivant" (Step 1 — aucun champ type="password" visible).
        Sur la page Step 2 : saisir le mot de passe de test X → soumettre.
Then  : Aucun toast M7 n'est apparu au Step 1 (champ email non capture par M7).
        Au Step 2 : le message password_submitted est visible dans la console SW.
        Le domain_hash dans le message correspond a "accounts.google.com".
        Si reutilisation detectable : toast M7 s'affiche sur la page de destination post-login.
        La cle "pending_m7_toast" dans chrome.storage.local est consommee (absente apres affichage).
```

---

**SC-UC01-02** | Priorite : P0 | Modules : M7
**Scenario** : Microsoft — detection M7 avec changement de hostname entre Step 1 et Step 2

```
Given : Extension installee et M7 actif. Storage reinitialise.
        Un mot de passe de test Y a ete prealablement enregistre pour le domaine "login.live.com".
When  : Ouvrir login.microsoftonline.com.
        Saisir l'email → bouton "Suivant" (Step 1 sur login.microsoftonline.com).
        La page redirige vers login.live.com pour la saisie du mot de passe (Step 2).
        Saisir le mot de passe de test Y → soumettre.
Then  : Aucune action M7 au Step 1 (hostname: login.microsoftonline.com, pas de type="password").
        Au Step 2 (hostname: login.live.com) : message password_submitted visible dans console SW.
        Le domain_hash correspond a "login.live.com" (et non a "login.microsoftonline.com").
        Si reutilisation : toast M7 mentionne "login.live.com" — comportement valide ARB-068-01.
```

---

**SC-UC01-03** | Priorite : P1 | Modules : M7
**Scenario** : Login multi-etape sans Step 1 (deep link direct sur page password)

```
Given : Extension installee et M7 actif. Storage reinitialise.
        URL directe vers la page de saisie du mot de passe (ex: lien "connexion" depuis une app tierce).
When  : Ouvrir directement l'URL de la page Step 2 (sans passer par Step 1 email).
        Saisir le mot de passe de test → soumettre.
Then  : M7 capture normalement le submit du Step 2.
        Aucun comportement anormal (pas d'erreur en console SW, pas de toast parasite).
        Le domain_hash est correctement calcule pour le hostname de la page Step 2.
```

---

**SC-UC01-04** | Priorite : P1 | Modules : M7
**Scenario** : Redirections multiples post-login — survie du pending_m7_toast

```
Given : Extension installee et M7 actif. Storage reinitialise.
        Reutilisation de mot de passe detectable (mot de passe X enregistre pour le domaine cible).
When  : Effectuer un login multi-etape (Google ou Microsoft) sur un compte avec reutilisation.
        Observer la chaine de redirections post-login (page intermediaire SSO → dashboard).
Then  : Le pending_m7_toast survit aux redirections intermediaires (TTL 10 min).
        Le toast M7 s'affiche sur la premiere page non-interstitielle du dashboard.
        Le pending_m7_toast est consomme en one-shot (absent des la page suivante).
```

---

## 6. Scenarios UC-02 — Gestionnaires de mots de passe

**Modules** : M7
**Reference providers** : `docs/p5-recette/p5-matrice-compatibilite-providers-m7-v1.0.md` §4
**Critere cle** : `event.isTrusted = true` pour les evenements generes par autofill utilisateur. Un autofill programmatique sans interaction utilisateur (isTrusted=false) ne doit pas declencher de toast M7.

---

**SC-UC02-01** | Priorite : P0 | Modules : M7
**Scenario** : KeePassXC Browser Connector — autofill via icone dans le champ

```
Given : Extension Sentinel Nudge installee et M7 actif. Storage reinitialise.
        KeePassXC installe et connecte via KeePassXC-Browser (extension Chrome).
        Une entree KeePassXC existe pour le site de test avec un mot de passe deja enregistre dans M7.
When  : Ouvrir le site de test avec un formulaire login.
        Cliquer sur l'icone KeePassXC dans le champ password (autofill manuel).
        Soumettre le formulaire.
Then  : L'evenement submit est isTrusted=true (clic utilisateur reel).
        M7 capture le submit et calcule le hash.
        Toast M7 affiche si reutilisation detectee.
        Aucun toast parasite si aucune reutilisation enregistree.
```

---

**SC-UC02-02** | Priorite : P0 | Modules : M7
**Scenario** : Bitwarden extension — autofill via raccourci ou menu contextuel

```
Given : Extension Sentinel Nudge installee et M7 actif. Storage reinitialise.
        Extension Bitwarden installee et connectee. Entree Bitwarden pour le site de test.
        Mot de passe de test deja enregistre dans M7 pour le domaine cible.
When  : Ouvrir le site de test. Utiliser le raccourci Bitwarden (Ctrl+Shift+L) ou le menu
        contextuel pour remplir automatiquement le formulaire. Soumettre.
Then  : Le submit est capture par M7 (isTrusted=true via autofill Enter ou clic bouton submit).
        Hash M7 calcule et envoye au SW.
        Toast M7 si reutilisation. Aucune duplication de toast.
```

---

**SC-UC02-03** | Priorite : P0 | Modules : M7
**Scenario** : Vaultwarden (Bitwarden self-hosted) — comportement identique a Bitwarden upstream

```
Given : Extension Sentinel Nudge installee et M7 actif. Storage reinitialise.
        Extension Bitwarden configuree sur instance Vaultwarden self-hosted.
        Entree pour le site de test avec mot de passe enregistre dans M7.
When  : Meme procedure qu'en SC-UC02-02 (autofill Bitwarden via instance Vaultwarden).
Then  : Comportement identique a SC-UC02-02.
        Confirmer que le backend self-hosted n'introduit pas de comportement different
        (isTrusted, timing autofill, evenement submit).
```

---

**SC-UC02-04** | Priorite : P1 | Modules : M7
**Scenario** : Chrome Password Manager natif — autofill integre navigateur

```
Given : Extension Sentinel Nudge installee et M7 actif. Storage reinitialise.
        Mot de passe enregistre dans le gestionnaire Chrome natif pour le site de test.
When  : Ouvrir le formulaire login. Selectionner la suggestion autofill Chrome natif.
        Soumettre le formulaire.
Then  : M7 capture le submit. isTrusted=true (selection liste native = interaction utilisateur).
        Hash calcule et envoye. Comportement identique aux extensions PM tierces.
```

---

## 7. Scenarios UC-03 — Iframes same-origin

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

## 8. Scenarios UC-04 — Iframes cross-origin (limite documentee)

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

## 9. Scenarios UC-05 — Toggle show/hide password

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

## 10. Scenarios UC-06 — Inputs password dynamiques (SPA React/Vue)

**Modules** : M7 (listener en capture phase sur document)
**Contexte** : les SPA React/Vue peuvent inserer des formulaires de connexion apres le chargement initial du document (modale de login, etape conditionnelle). Le listener en capture phase sur `document` (existant) doit couvrir ces insertions.

---

**SC-UC06-01** | Priorite : P0 | Modules : M7
**Scenario** : React — formulaire de connexion rendu apres interaction utilisateur

```
Given : Extension installee. Storage reinitialise.
        Application React avec un formulaire de connexion rendu dynamiquement
        (ex: bouton "Se connecter" qui affiche une modale contenant <input type="password">).
        Mot de passe de test enregistre dans M7 pour le domaine.
When  : Ouvrir la page. Cliquer "Se connecter" pour declencher le rendu React du formulaire.
        Saisir le mot de passe dans le champ apparu dynamiquement. Soumettre.
Then  : observeDynamicForms() detecte l'insertion du champ type="password" via MutationObserver.
        M7 capture le submit du formulaire dynamique.
        Message password_submitted visible en console SW. Hash calcule pour le domaine.
        Toast si reutilisation.
```

---

**SC-UC06-02** | Priorite : P0 | Modules : M7
**Scenario** : Vue — modale de connexion avec formulaire insere apres navigation SPA

```
Given : Extension installee. Storage reinitialise.
        Application Vue avec routeur client. La route "/login" affiche un composant modal
        contenant un formulaire avec <input type="password"> (insere au montage du composant).
        Mot de passe de test enregistre dans M7.
When  : Ouvrir la page d'accueil ("/"). Naviguer vers "/login" via le routeur Vue (pas de reload).
        Attendre le rendu de la modale. Saisir le mot de passe. Soumettre.
Then  : Le content script (toujours actif sur la page, pas rechargee) detecte l'insertion du champ.
        M7 capture le submit du formulaire Vue injecte dynamiquement.
        Hash calcule et envoye. Comportement nominal identique a un formulaire statique.
```

---

**SC-UC06-03** | Priorite : P1 | Modules : M7
**Scenario** : SPA — formulaire rechargee apres navigation aller-retour (route A → B → A)

```
Given : Extension installee. Storage reinitialise.
        SPA avec routeur. Le formulaire login est rendu sur route "/login", detruit sur route "/home",
        puis re-rendu si l'utilisateur revient sur "/login" (nouveau montage React/Vue).
When  : Naviguer /login → /home → /login. Sur la deuxieme apparition du formulaire, saisir et soumettre.
Then  : Le nouveau DOM du formulaire est detecte par observeDynamicForms().
        Le Set d'inputs du premier rendu est invalide mais un nouveau _snPasswordInputs est peuple.
        M7 capture normalement le submit de la deuxieme instance du formulaire.
        Aucune erreur de reference (input detruit) dans la console SW.
```

---

## 11. Gabarit PV de recette

Le gabarit ci-dessous est a copier et remplir pour chaque session de recette manuelle.

---

```markdown
# Proces-verbal de recette manuelle — Sentinel Nudge

## En-tete

| Champ                    | Valeur                       |
| ------------------------ | ---------------------------- |
| Date de recette          | YYYY-MM-DD                   |
| Commanditaire            | Antony Blain (RSSI)          |
| Testeur                  | [Nom du testeur]             |
| Version testee           | v[X.Y.Z]                     |
| Commit SHA               | [sha court — ex: 8f48f97]    |
| Build                    | [npm run build — date/heure] |
| Chrome version           | [ex: 139.0.7151.70]          |
| Profil Chrome            | [Dedie recette — neuf]       |
| Extension chargee depuis | C:\Dev\sentinel-nudge\dist   |
| Environnement            | Windows 11 Home — local      |

---

## Recapitulatif des scenarios

| ID Scenario | UC    | Priorite | Resultat           | Observations |
| ----------- | ----- | -------- | ------------------ | ------------ |
| SC-UC01-01  | UC-01 | P0       | Pass / Fail / Skip |              |
| SC-UC01-02  | UC-01 | P0       | Pass / Fail / Skip |              |
| SC-UC01-03  | UC-01 | P1       | Pass / Fail / Skip |              |
| SC-UC01-04  | UC-01 | P1       | Pass / Fail / Skip |              |
| SC-UC02-01  | UC-02 | P0       | Pass / Fail / Skip |              |
| SC-UC02-02  | UC-02 | P0       | Pass / Fail / Skip |              |
| SC-UC02-03  | UC-02 | P0       | Pass / Fail / Skip |              |
| SC-UC02-04  | UC-02 | P1       | Pass / Fail / Skip |              |
| SC-UC03-01  | UC-03 | P0       | Pass / Fail / Skip |              |
| SC-UC03-02  | UC-03 | P0       | Pass / Fail / Skip |              |
| SC-UC04-01  | UC-04 | P1       | Pass / Fail / Skip |              |
| SC-UC05-01  | UC-05 | P0       | Pass / Fail / Skip |              |
| SC-UC05-02  | UC-05 | P0       | Pass / Fail / Skip |              |
| SC-UC05-03  | UC-05 | P1       | Pass / Fail / Skip |              |
| SC-UC06-01  | UC-06 | P0       | Pass / Fail / Skip |              |
| SC-UC06-02  | UC-06 | P0       | Pass / Fail / Skip |              |
| SC-UC06-03  | UC-06 | P1       | Pass / Fail / Skip |              |

**Bilan global** :

| Critere            | Valeur               |
| ------------------ | -------------------- |
| Scenarios P0       | [N Pass] / [M Total] |
| Scenarios P1       | [N Pass] / [M Total] |
| Scenarios P2       | —                    |
| Verdict release v1 | AUTORISEE / BLOQUEE  |

---

## Anomalies detectees

Reproduire ce bloc pour chaque incident (si aucun incident : "Aucune anomalie detectee").

### ID-INC-[NNN]

| Champ                 | Valeur                                         |
| --------------------- | ---------------------------------------------- |
| ID                    | ID-INC-[NNN]                                   |
| Scenario              | SC-UC0X-0Y                                     |
| Severite              | Critique / Majeur / Mineur / Cosmétique        |
| Titre court           | [Description en une ligne]                     |
| Steps de reproduction | 1. ... 2. ... 3. ...                           |
| Resultat observe      | [Ce qui se passe]                              |
| Resultat attendu      | [Ce qui devrait se passer]                     |
| Screenshot            | `docs/p5-recette/screenshots/ID-INC-[NNN].png` |
| Logs console SW       | [Extrait pertinent ou "voir fichier joint"]    |
| Ticket cree           | TACHE-[NNN] dans BACKLOG.md                    |

---

## Signatures

| Role          | Nom          | Date       | Signature |
| ------------- | ------------ | ---------- | --------- |
| Testeur       |              | YYYY-MM-DD |           |
| Commanditaire | Antony Blain | YYYY-MM-DD |           |
```

---

## 12. Annexe A — Liste providers UC-01

La liste complete des providers d'authentification testes avec M7 (Google, Microsoft, Okta, KeePassXC, Bitwarden, Vaultwarden, Chrome PM, 1Password) est maintenue dans :

`docs/p5-recette/p5-matrice-compatibilite-providers-m7-v1.0.md`

Ce document est la source de verite sur la compatibilite providers. Il est mis a jour apres chaque session de recette et alimente les release notes.

---

## 13. Historique des revisions

| Version | Date       | Modifications                                                                                                               | Auteur                |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| 1.0     | 2026-04-19 | Creation initiale — protocole de recette manuelle formalise UC-01 a UC-06, format Given/When/Then, 17 scenarios, gabarit PV | Testeur QA (Fabrique) |
