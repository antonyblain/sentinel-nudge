# Mini-DAT — TACHE-070 — UC-03 : Iframes same-origin

**Version** : 1.1
**Date** : 2026-04-19
**Auteur** : Architecte logiciel
**Statut** : Soumis au Référent qualité — enrichissement QC + revue Archi sécurité 2026-04-17
**Branche** : feature/p5-tache-070-uc03-iframes-same-origin
**Tâche couverte** : TACHE-070 (UC-03 bloquant v1)
**Phase** : P5
**Niveau de sensibilité** : Exposé

---

## Historique des versions

| Version | Date       | Modifications                                                                                                                                                                                               |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-04-17 | Version initiale Architecte logiciel                                                                                                                                                                        |
| 1.1     | 2026-04-19 | Enrichissement QC + revue Archi sécurité · §8 Arbitrages retenus (Option B cross-origin) · §9 INV-UC03-04/05 formalisés · §10 Tableau risques R-UC03-01 à R-UC03-07 · R-UC03-07 borne mémoire recentSubmits |

---

## 1. Contexte

### 1.1 Problème identifié

UC-03 est classé P0-bloquant pour la release v1 (Option A retenue le 2026-04-14). Le module M7 (réutilisation mot de passe) ne détecte pas les soumissions de formulaires situés dans des iframes same-origin embarquées dans une page principale.

Exemple concret : un portail bancaire (`banque.fr`) qui charge son formulaire de connexion dans une iframe `<iframe src="https://banque.fr/login/frame">`. Avec la configuration actuelle (`all_frames` absent, valeur par défaut `false`), Chrome injecte le content script `password-detector.ts` uniquement dans le top frame. Le formulaire dans l'iframe n'est pas surveillé. M7 ne se déclenche pas.

### 1.2 Configuration actuelle (état initial)

Extrait pertinent du `src/manifest.json` :

```json
"content_scripts": [
  {
    "matches": ["http://*/*", "https://*/*"],
    "js": [
      "content-scripts/detectors/paste-detector.ts",
      "content-scripts/detectors/password-detector.ts"
    ],
    "run_at": "document_idle"
  }
]
```

Observations :

- `all_frames` est absent, ce qui équivaut à `false` selon la spécification Chrome MV3
- `run_at: "document_idle"` est correct et doit être conservé
- `matches` couvre l'ensemble des URL http/https, ce qui est adapté

### 1.3 Périmètre UC-03

Ce mini-DAT couvre les iframes **same-origin** (protocole + domaine + port identiques au top frame). Les iframes cross-origin (UC-04, TACHE-071) sont hors périmètre et font l'objet d'un traitement séparé.

---

## 2. Analyse de l'existant

### 2.1 Variables module-level dans password-detector.ts

Le content script déclare plusieurs variables au niveau module :

| Variable              | Type                                   | Usage                                |
| --------------------- | -------------------------------------- | ------------------------------------ |
| `submittedFields`     | `WeakSet<HTMLInputElement>`            | Évite le double traitement au submit |
| `_snPasswordInputs`   | `Set<HTMLInputElement>`                | Registre UC-05 toggle show/hide      |
| `fieldsWithM2Active`  | `WeakSet<HTMLInputElement>`            | Guard M2 anti-réentrance             |
| `trustedDomainHashes` | `Set<string>`                          | Cache whitelist M2 session           |
| `m9Contexts`          | `WeakMap<HTMLInputElement, M9Context>` | Contextes M9 par champ               |

Avec `all_frames: true`, Chrome instancie un processus de content script **distinct** par frame. Chaque instance dispose de son propre scope JavaScript isolé. Ces variables ne sont pas partagées entre frames.

**Conclusion Q-CONF-01** : la duplication est correcte et attendue. Chaque instance gère les éléments de son propre DOM. Un input dans l'iframe appartient au DOM de cette iframe ; son instance content script est la seule qui peut y accéder. Aucun partage cross-frame n'est nécessaire ni possible via ces variables.

### 2.2 Utilisation de `location.hostname` pour le domain_hash M7

Dans `password-detector.ts`, les occurrences identifiées :

- Ligne 398 : `domainHash = await hashDomain(effectiveSalt, location.hostname)` — M2 focus handler
- Ligne 1229 : `const domainHash = await hashDomain(salt, location.hostname)` — M7 submit handler
- Ligne 1706 : `const currentDomainHash = await hashDomain(salt, location.hostname)` — M2 storage listener
- Ligne 1825 : `context: { url: location.hostname, readyState: document.readyState }` — log diagnostic

Dans une iframe same-origin (`banque.fr` dans `banque.fr`) :

- `location.hostname === 'banque.fr'`
- `top.location.hostname === 'banque.fr'`
- Le `domain_hash` calculé dans l'iframe est **identique** à celui du top frame

Conséquence : pour M7, les hashes produits par l'iframe et par le top frame sont comparables entre eux et avec les hashes stockés depuis d'autres sessions. Le comportement est cohérent et correct pour le cas same-origin.

**Conclusion Q-CONF-02** : l'utilisation de `location.hostname` est correcte pour le cas same-origin. La question du guard (cf. section 3) reste une décision de sécurité défensive, pas une correction fonctionnelle obligatoire.

### 2.3 Traitement des messages entrants dans le Service Worker

Dans `message-router.ts`, le handler `handleValidatedMessage` reçoit le paramètre `sender: chrome.runtime.MessageSender`. Ce sender contient :

- `sender.tab.id` : identifiant de l'onglet émetteur
- `sender.frameId` : identifiant de la frame émettrice (0 pour le top frame, >0 pour les iframes)

Constat : le handler M7 (`m7-handler.ts`) ne consulte pas `sender.frameId`. Il extrait uniquement `_sender.tab?.id ?? 'unknown'` pour le contexte de log (ligne 342). Le payload traité (`hash` + `domain_hash`) ne porte aucune information sur la frame source.

**Conclusion Q-CONF-03** : le SW ignore aujourd'hui l'origine par frame. L'enrichissement du payload avec `frame_info` est optionnel et constitue une décision à arbitrer (cf. section 6).

### 2.4 Scénario double-capture (Q-CONF-04)

Si le top frame et une iframe contiennent chacun un formulaire password, deux soumissions indépendantes peuvent se produire quasi-simultanément. Chaque instance content script envoie un message `password_submitted` au SW.

Le SW traite les messages séquentiellement (single-threaded). Les deux hashes sont calculés avec `location.hostname` de la même origine → `domain_hash` identique. La logique de déduplication M7 opère au niveau du hash de mot de passe (SHA-256 du password + salt). Si le même mot de passe est saisi dans les deux formulaires, le deuxième message arrive après le premier stockage et déclenche une détection de réutilisation intra-session, filtrée par le guard `candidate.domain_hash === domainHash` (ligne 152, m7-handler.ts). Pas de faux positif.

**Conclusion Q-CONF-04** : pas de problème architectural. Deux soumissions distinctes produisent deux hash-events distincts, correctement filtrés.

### 2.5 CSP des iframes et injection content script (Q-CONF-05)

Les content scripts Chrome MV3 sont injectés dans le processus du renderer par le navigateur lui-même, avant l'application des règles CSP de la page. Ils s'exécutent dans un monde isolé (`isolated world`). La CSP d'une iframe same-origin ne peut pas bloquer l'injection du content script.

Notre content script n'insère pas de scripts inline et n'utilise pas `eval`. Les overlays Shadow DOM n'injectent pas de `<script>`. La CSP n'est donc pas un vecteur de blocage fonctionnel.

**Conclusion Q-CONF-05** : pas d'impact. La CSP des iframes n'interfère pas avec l'injection ni le comportement du content script.

### 2.6 Iframes `about:blank` et `srcdoc` (Q-CONF-06)

Comportement Chrome : pour une iframe `about:blank` ou `srcdoc`, Chrome hérite l'origine du parent (`inherited origin`). L'injection du content script se produit si l'URL parente satisfait le pattern `matches`. Ce comportement est conforme à la spécification MV3 et documenté dans la Chrome Extension API.

Ces iframes sont généralement générées programmatiquement et ne contiennent pas de formulaires de connexion. Elles ne constituent pas un cas d'usage principal pour M7.

**Conclusion Q-CONF-06** : à noter dans les invariants pour documentation, sans action corrective requise.

---

## 3. Décision principale — Deux niveaux d'implémentation

Ce mini-DAT propose deux niveaux d'implémentation, en attente de la décision d'arbitrage issue du croisement avec le threat model produit par l'Architecte sécurité.

### Option A — Niveau simple

**Principe** : ajouter uniquement `"all_frames": true` dans le manifest. Pas de guard dans le content script.

**Diff manifest.json attendu** :

```diff
 "content_scripts": [
   {
     "matches": ["http://*/*", "https://*/*"],
     "js": [
       "content-scripts/detectors/paste-detector.ts",
       "content-scripts/detectors/password-detector.ts"
     ],
-    "run_at": "document_idle"
+    "run_at": "document_idle",
+    "all_frames": true
   }
 ]
```

Une seule ligne ajoutée. Aucune modification du code TypeScript.

**Surface couverte** : toutes les frames (same-origin ET cross-origin) correspondant au pattern `matches`. Pour le cas UC-03 (same-origin), le comportement est correct et le `domain_hash` calculé dans l'iframe est identique à celui du top frame.

**Risque** : injection dans des iframes cross-origin tierces (ex. widgets publicitaires, iframes de paiement). Si le content script se charge dans une iframe `checkout.stripe.com`, il calcule `domain_hash('stripe.com')` et tente d'envoyer des messages M7 depuis ce contexte. Cela constitue une surface d'exposition étendue. Ce risque est évalué par l'Architecte sécurité dans le threat model parallèle.

**Adoption recommandée si** : le threat model conclut que le risque cross-origin est acceptable ou peu probable dans les scénarios d'attaque ciblés.

### Option B — Niveau défensif

**Principe** : `"all_frames": true` dans le manifest PLUS un guard en début de content script limitant l'activation à same-origin par rapport au top frame.

**Diff manifest.json** : identique à l'Option A (une ligne).

**Guard TypeScript à ajouter dans password-detector.ts** (à l'initialisation, avant toute logique) :

```typescript
// Guard UC-03 : limiter l'activation aux frames same-origin par rapport au top frame
// Prévient l'activation dans les iframes cross-origin (ex. widgets tiers, iframes de paiement)
// INV-UC03-03 : window.self !== window.top && location.origin !== parent.location.origin → abort
if (window.self !== window.top) {
  try {
    // Dans une iframe cross-origin, l'accès à top.location.origin lève une DOMException
    // (SecurityError). On l'utilise comme signal de détection cross-origin.
    const topOrigin = top!.location.origin;
    if (location.origin !== topOrigin) {
      // Iframe cross-origin détectée — pas d'activation M7/M2/M9
      throw new Error('cross-origin');
    }
  } catch {
    // DOMException ou cross-origin confirmé — sortie silencieuse
    // eslint-disable-next-line no-console
    console.debug('Sentinel Nudge: cross-origin iframe detected — content script deactivated');
    // Fin immédiate du script (aucun listener n'est attaché)
    // Note : en module ES, on ne peut pas faire un return au niveau module.
    // L'implémentation réelle utilisera une variable booléenne de guard vérifiée
    // par toutes les fonctions d'initialisation (voir INV-UC03-02).
  }
}
```

**Note d'implémentation** : un content script en module ES ne peut pas faire un `return` au niveau supérieur. L'implémentation réelle du guard sera une variable booléenne `const IS_SAME_ORIGIN_FRAME` vérifiée au début de chaque fonction d'initialisation (`observePasswordInputs`, `observeDynamicForms`, etc.), ou bien via un wrapper IIFE. Le Développeur choisira la forme syntaxique appropriée.

**Avantage** : la surface d'exposition au sens du threat model est strictement limitée aux frames same-origin. Les iframes cross-origin ne reçoivent aucun traitement.

**Adoption recommandée si** : le threat model identifie des vecteurs d'attaque exploitables via l'injection dans des iframes cross-origin.

---

## 4. Invariants UC-03

| ID          | Invariant                                                                                                                                                                    | Applicable à                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| INV-UC03-01 | Tout formulaire password dans une iframe same-origin de `banque.fr` doit être détecté par M7 au submit                                                                       | Option A et B                              |
| INV-UC03-02 | Dans une iframe cross-origin, le content script ne doit pas s'activer (Option B) ou son activation ne doit pas produire de message vers le SW avec un domain_hash erroné     | Option B (strict) / Option A (best-effort) |
| INV-UC03-03 | Le guard cross-origin s'appuie sur la détection de DOMException lors de l'accès à `top.location.origin` — ce signal est fiable car la Same-Origin Policy l'interdit          | Option B                                   |
| INV-UC03-04 | Le `domain_hash` calculé par une iframe same-origin est identique à celui du top frame (`location.hostname` identique) — les hashes sont comparables entre instances         | Option A et B                              |
| INV-UC03-05 | Les variables module-level (`submittedFields`, `_snPasswordInputs`) sont isolées par instance de frame — pas de partage cross-frame                                          | Option A et B                              |
| INV-UC03-06 | Les iframes `about:blank` / `srcdoc` héritant de l'origine parente sont injectées mais ne contiennent généralement pas de formulaires password — cas sans impact fonctionnel | Option A et B                              |

---

## 5. Interaction avec les autres tâches

### 5.1 TACHE-069 — Filtre `isTrusted`

Le filtre `isTrusted` sur les événements `submit` et `click` (prévu TACHE-069) doit continuer à fonctionner dans chaque instance de content script par frame. Il n'existe pas de dépendance entre frames pour ce filtre : chaque instance écoute les événements de son propre DOM. INV-UC03-05 garantit l'isolation.

### 5.2 TACHE-072 — Set `_snPasswordInputs` (UC-05 toggle show/hide)

Le Set `_snPasswordInputs` est local à chaque instance de content script. Si un formulaire dans une iframe comporte un toggle show/hide, l'instance dans l'iframe gère son propre registre d'inputs. La logique `collectPasswordInputs` et `observeDynamicForms` s'applique dans le scope de l'iframe sans modification. Pas de régression UC-05.

### 5.3 ADR-001 — SW-BOOT-CONTRACT

L'ajout de `all_frames: true` augmente le nombre de content scripts actifs simultanément par page (un par frame), et donc le nombre de messages potentiels vers le SW. Le contrat ADR-001 (handler avec prérequis storage : lire → valider → régénérer → logger) n'est pas modifié. Le handler M7 est déjà conforme. Aucun impact.

### 5.4 ADR-002 — CROSS-LIFECYCLE-INTENT

Le pattern `pending_m7_toast` (stockage dans `chrome.storage.local` + listener `storage.onChanged` côté content script) fonctionne identiquement dans une iframe same-origin. Le listener `storage.onChanged` est attaché par chaque instance. Si le SW écrit `pending_m7_toast`, toutes les instances (top frame + iframe) recevront l'événement. Il faut s'assurer que seule une instance affiche le toast.

**Point de vigilance** : avec `all_frames: true`, le listener `storage.onChanged` sera présent dans le top frame ET dans l'iframe same-origin. Les deux instances pourraient tenter d'afficher le toast M7. Ce point est couvert par l'invariant INV-UC03-07 ci-dessous et doit être adressé dans l'implémentation.

| ID          | Invariant                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INV-UC03-07 | Le toast M7 ne doit s'afficher qu'une seule fois par soumission, même si plusieurs instances de content script (top frame + iframes) écoutent `storage.onChanged`. L'implémentation devra ajouter un guard `window.self === window.top` dans le listener `storage.onChanged` avant l'affichage du toast, ou bien n'afficher le toast que dans l'instance qui a émis le message (via une clé de corrélation dans le payload). |

Ce point est un **nouveau risque de régression** introduit par UC-03. Il doit être résolu par le Développeur avant merge.

---

## 6. Plan de tests

### 6.1 Tests unitaires à créer ou étendre

| ID test    | Description                                                                                                                                                                  | Fichier cible                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| TC-UC03-01 | `collectPasswordInputs()` retourne les inputs d'une iframe same-origin simulée                                                                                               | `tests/unit/detectors/password-detector.test.ts` |
| TC-UC03-02 | Guard cross-origin Option B : si `top.location.origin !== location.origin`, aucun listener n'est attaché                                                                     | `tests/unit/detectors/password-detector.test.ts` |
| TC-UC03-03 | Guard INV-UC03-07 : le listener `storage.onChanged` n'affiche le toast que si `window.self === window.top`                                                                   | `tests/unit/detectors/password-detector.test.ts` |
| TC-UC03-04 | `domain_hash` calculé avec `location.hostname` identique dans iframe same-origin et top frame                                                                                | `tests/unit/utils/hash.test.ts`                  |
| TC-UC03-05 | Idempotence `onSubmit` cross-frame : la même soumission capturée par top frame ET iframe ne déclenche qu'un seul traitement M7 (déduplication SW via hash identique)         | `tests/unit/handlers/m7-handler.test.ts`         |
| TC-UC03-06 | Cohérence `domain_hash` inter-frames : `installation_salt` lu depuis `chrome.storage.local` est identique dans toutes les frames same-origin (même clé de stockage partagée) | `tests/unit/utils/hash.test.ts`                  |

### 6.2 Recette manuelle

| Scénario                                  | Procédure                                                                                           | Résultat attendu                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Site avec iframe same-origin              | Ouvrir DevTools, vérifier injection content script dans la frame (onglet Sources > Content scripts) | Script visible dans la frame same-origin                            |
| Soumission formulaire dans iframe         | Saisir mot de passe dans l'iframe, soumettre                                                        | Message `password_submitted` envoyé au SW, visible dans les logs SW |
| Absence de double toast                   | Avec un mot de passe déjà stocké, soumettre depuis l'iframe                                         | Un seul toast M7 affiché, pas de doublon                            |
| Iframe cross-origin (Option B uniquement) | Ouvrir une page avec iframe cross-origin (ex. YouTube embed)                                        | Aucun log Sentinel Nudge dans la console de l'iframe cross-origin   |

---

## 7. Questions à l'Architecte sécurité (v1.0 — traitées en v1.1)

Les questions QS-UC03-01 à QS-UC03-03 posées en v1.0 ont reçu réponse lors de la revue Archi sécurité du 2026-04-17. Les arbitrages correspondants sont formalisés en §8.

**QS-UC03-01** : _Le threat model identifie-t-il un vecteur d'attaque concret exploitant l'injection du content script dans des iframes cross-origin ?_ → **Réponse** : oui, R-UC03-01 et R-UC03-03 sont identifiés. Option B retenue (§8).

**QS-UC03-02** : _Le threat model couvre-t-il les iframes depuis un sous-domaine différent ?_ → **Réponse** : cas cross-origin (sous-domaine ≠ domaine). Hors périmètre UC-03, couvert par TACHE-071. Guard Option B les exclut correctement.

**QS-UC03-03** : _Le risque de double toast est-il dans le threat model ?_ → **Réponse** : classé R-UC03-02, catégorie Denial of Service (UX). Mitigé par INV-UC03-07.

---

## 8. Arbitrages retenus (v1.1 — post revue Archi sécurité 2026-04-17)

### ARB-UC03-01 tranché : Option B retenue pour les frames cross-origin

Suite à la revue Archi sécurité du 2026-04-17 et à l'analyse du mini-DAT §3 (AIPD M7 v1.3 §7), la décision est de **ne pas étendre `all_frames: true` aux frames cross-origin** sans garde-fou. L'Option B est retenue.

**Justification** :

| Critère                    | Analyse                                                                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface d'attaque          | Option A expose le content script dans toutes les iframes tierces (widgets, paiement, publicité). Un attaquant contrôlant une iframe embarquée dans une page partenaire pourrait observer l'activation du script. |
| Principe Privacy by Design | L'AIPD M7 v1.3 §7 exclut explicitement le traitement de données depuis des contextes tiers non maîtrisés. Option A contredit ce principe si le content script s'active dans stripe.com ou analytics.google.com.   |
| Coût implémentation        | Le guard Option B représente ~15 lignes TypeScript. La DOMException est un signal fiable, gratuit, fourni par le navigateur (Same-Origin Policy). Coût marginal négligeable.                                      |
| Cohérence avec UC-04       | TACHE-071 (UC-04) traitera les frames cross-origin avec une analyse dédiée. Activer l'injection sans guard anticiperait cette décision hors périmètre.                                                            |

**Décision formelle** : `all_frames: true` activé dans manifest.json + guard `IS_SAME_ORIGIN_FRAME` dans `password-detector.ts`. Les frames cross-origin ne reçoivent aucun traitement M7/M2/M9.

**Référence** : mini-DAT §3 Option B, AIPD M7 v1.3 §7, revue Archi sécurité 2026-04-17.

### ARB-UC03-02 tranché : enrichissement `frame_info` reporté

L'enrichissement du payload M7 avec `{ is_top_frame, frame_url_hash }` est reporté au backlog v2. Principe YAGNI appliqué. UC-03 n'exige pas cette traçabilité pour la release v1.

---

## 9. Invariants UC-03 — Compléments v1.1

Les invariants INV-UC03-01 à INV-UC03-06 sont définis en §4. Les invariants INV-UC03-04 et INV-UC03-05 sont formalisés ci-dessous avec leur description complète et leurs tests de référence.

| ID          | Invariant                            | Description complète                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Test de référence      |
| ----------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| INV-UC03-04 | Cohérence `domain_hash` inter-frames | Le `domain_hash` calculé par une iframe same-origin est identique à celui du top frame. `location.hostname` est identique dans toutes les frames same-origin. Le `installation_salt` est lu depuis `chrome.storage.local`, accessible depuis tous les frames d'une même extension — la même valeur de sel est utilisée partout. Les hashes produits sont donc comparables entre instances sans aucune synchronisation explicite.                                                                                                                                   | TC-UC03-04, TC-UC03-06 |
| INV-UC03-05 | Idempotence `onSubmit` cross-frame   | Si le top frame et une iframe same-origin capturent tous deux l'événement `submit` sur le même formulaire (scénario pathologique), les deux messages `password_submitted` arrivent au SW avec le même `hash` et le même `domain_hash`. Le handler M7 traite le second message comme une tentative de réutilisation intra-session sur le même domaine, filtrée par le guard `candidate.domain_hash === domainHash`. Aucun doublon de stockage. Aucun faux positif. Un seul nudge affiché (guard `window.self === window.top` dans le listener `storage.onChanged`). | TC-UC03-03, TC-UC03-05 |

---

## 10. Risques (hérités threat model Archi sécurité + v1.1)

### 10.1 Risques hérités du threat model Archi sécurité (R-UC03-01 à R-UC03-06)

Risques identifiés lors de la revue Archi sécurité 2026-04-17. Statut à la date de production v1.1.

| ID        | Description                                                                                                                                                                            | STRIDE                            | Impact | Probabilité        | Mitigation actuelle                                                                                                                                 | Statut              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| R-UC03-01 | Injection du content script dans des iframes cross-origin tierces (widgets publicitaires, iframes de paiement). Activation dans un contexte non maîtrisé.                              | Elevation of Privilege            | Élevé  | Moyen              | Option B retenue (§8) : guard `IS_SAME_ORIGIN_FRAME` bloque l'activation dans les frames cross-origin.                                              | Mitigé              |
| R-UC03-02 | Double affichage du toast M7 si plusieurs instances de content script reçoivent simultanément l'événement `storage.onChanged`. Expérience utilisateur dégradée.                        | Denial of Service (UX)            | Moyen  | Élevé (sans guard) | Guard `window.self === window.top` dans le listener `storage.onChanged` (INV-UC03-07). À valider en recette.                                        | Mitigé par design   |
| R-UC03-03 | Exfiltration de données via une iframe malveillante embarquée dans une page surveillée. Site hostile intégrant une iframe contrôlée tente de déclencher artificiellement le script M7. | Spoofing / Information Disclosure | Élevé  | Faible             | Option B + filtre `isTrusted` (TACHE-069) : seuls les événements utilisateur authentiques sont traités.                                             | Mitigé              |
| R-UC03-04 | Race condition sur `chrome.storage.local` : deux instances du content script accèdent concurremment à la clé `pending_m7_toast`.                                                       | Tampering                         | Moyen  | Faible             | SW single-threaded, clé `pending_m7_toast` écrite une seule fois par soumission. Guard `window.self === window.top` limite la lecture au top frame. | Résiduel acceptable |
| R-UC03-05 | Injection dans des iframes `about:blank` ou `srcdoc` créées programmatiquement. Origine héritée du parent, content script potentiellement actif dans un contexte non prévu.            | Elevation of Privilege            | Faible | Faible             | Ces iframes ne contiennent généralement pas de formulaires password (Q-CONF-06). Surveillance en recette.                                           | Accepté             |
| R-UC03-06 | Fuite de la logique de détection via la console de l'iframe. Observation par un attaquant des DevTools.                                                                                | Information Disclosure            | Faible | Moyen              | Guard Option B utilise `console.debug` (non visible en production — supprimé par Vite build).                                                       | Mitigé              |

### 10.2 Risque additionnel v1.1 — Borne mémoire `recentSubmits`

| ID        | Description                                                                                                                                                                      | Impact | Probabilité | Mitigation                                                               | Statut          |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- | ------------------------------------------------------------------------ | --------------- |
| R-UC03-07 | Croissance non bornée du cache `recentSubmits` (déduplication M7 intra-session) si un utilisateur soumet de nombreux formulaires depuis plusieurs frames sur une courte période. | Faible | Faible      | Cap FIFO à 20 entrées ou expiration temporelle à 5 minutes (voir §10.3). | Mitigé par FIFO |

### 10.3 Calcul borne mémoire `recentSubmits` (R-UC03-07)

**Variable concernée** : `recentSubmits` — tableau ou Set utilisé dans le handler M7 pour éviter les doublons de nudge sur une même soumission dans la fenêtre glissante de 5 minutes.

**Calcul du pire cas** :

| Facteur                          | Valeur retenue    | Justification                                                                                |
| -------------------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| Nombre de frames simultanées     | 5                 | Estimation haute : 1 top frame + 4 iframes same-origin sur un portail complexe               |
| Soumissions par frame dans 5 min | 4                 | Estimation haute : utilisateur testant plusieurs mots de passe ou erreurs de saisie répétées |
| Taille d'une entrée              | ~64 octets        | `hash` SHA-256 hex (64 chars ASCII) = 64 octets                                              |
| **Pire cas : entrées totales**   | **20**            | 5 frames × 4 soumissions = 20 entrées                                                        |
| **Pire cas : mémoire**           | **~1 280 octets** | 20 × 64 octets ~= 1,25 Ko                                                                    |

**Conclusion** : la borne naturelle de `recentSubmits` dans le pire cas réaliste est de **20 entrées** pour un total de **~1,25 Ko**. Cette volumétrie est négligeable en mémoire JavaScript.

**Politique de purge** : le cache est purgé par expiration temporelle (entrées plus vieilles que 5 minutes supprimées à chaque ajout) ou, si l'implémentation utilise un tableau fixe, par politique FIFO avec cap à 20 entrées. Aucun risque de croissance non bornée. Aucun mécanisme de protection supplémentaire nécessaire.

**Action pour le Développeur** : s'assurer que l'implémentation de `recentSubmits` applique explicitement un cap FIFO à 20 entrées ou une expiration temporelle à 5 minutes — les deux approches sont équivalentes. Documenter le choix dans le code avec un commentaire inline référençant R-UC03-07.

---

## 11. Résumé des impacts

| Composant                                            | Modification                                                                                                    | Ampleur              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------- |
| `src/manifest.json`                                  | Ajout `"all_frames": true`                                                                                      | 1 ligne              |
| `src/content-scripts/detectors/password-detector.ts` | Guard cross-origin (Option B) + guard INV-UC03-07 sur `storage.onChanged`                                       | ~20 lignes           |
| Tests unitaires                                      | 6 nouveaux tests TC-UC03-01 à 06                                                                                | ~110 lignes estimées |
| Aucune modification                                  | `src/background/service-worker.ts`, `src/background/handlers/m7-handler.ts`, `src/background/message-router.ts` | —                    |

---

_Mini-DAT produit par l'Architecte logiciel — La Fabrique v1.1 — 2026-04-19_
