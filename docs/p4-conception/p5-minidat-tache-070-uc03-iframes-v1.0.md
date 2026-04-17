# Mini-DAT — TACHE-070 — UC-03 : Iframes same-origin

**Version** : 1.0  
**Date** : 2026-04-17  
**Auteur** : Architecte logiciel  
**Statut** : Soumis au Référent qualité  
**Branche** : feature/p5-tache-070-uc03-iframes-same-origin

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

| Variable | Type | Usage |
|----------|------|-------|
| `submittedFields` | `WeakSet<HTMLInputElement>` | Évite le double traitement au submit |
| `_snPasswordInputs` | `Set<HTMLInputElement>` | Registre UC-05 toggle show/hide |
| `fieldsWithM2Active` | `WeakSet<HTMLInputElement>` | Guard M2 anti-réentrance |
| `trustedDomainHashes` | `Set<string>` | Cache whitelist M2 session |
| `m9Contexts` | `WeakMap<HTMLInputElement, M9Context>` | Contextes M9 par champ |

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

| ID | Invariant | Applicable à |
|----|-----------|-------------|
| INV-UC03-01 | Tout formulaire password dans une iframe same-origin de `banque.fr` doit être détecté par M7 au submit | Option A et B |
| INV-UC03-02 | Dans une iframe cross-origin, le content script ne doit pas s'activer (Option B) ou son activation ne doit pas produire de message vers le SW avec un domain_hash erroné | Option B (strict) / Option A (best-effort) |
| INV-UC03-03 | Le guard cross-origin s'appuie sur la détection de DOMException lors de l'accès à `top.location.origin` — ce signal est fiable car la Same-Origin Policy l'interdit | Option B |
| INV-UC03-04 | Le `domain_hash` calculé par une iframe same-origin est identique à celui du top frame (`location.hostname` identique) — les hashes sont comparables entre instances | Option A et B |
| INV-UC03-05 | Les variables module-level (`submittedFields`, `_snPasswordInputs`) sont isolées par instance de frame — pas de partage cross-frame | Option A et B |
| INV-UC03-06 | Les iframes `about:blank` / `srcdoc` héritant de l'origine parente sont injectées mais ne contiennent généralement pas de formulaires password — cas sans impact fonctionnel | Option A et B |

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

| ID | Invariant |
|----|-----------|
| INV-UC03-07 | Le toast M7 ne doit s'afficher qu'une seule fois par soumission, même si plusieurs instances de content script (top frame + iframes) écoutent `storage.onChanged`. L'implémentation devra ajouter un guard `window.self === window.top` dans le listener `storage.onChanged` avant l'affichage du toast, ou bien n'afficher le toast que dans l'instance qui a émis le message (via une clé de corrélation dans le payload). |

Ce point est un **nouveau risque de régression** introduit par UC-03. Il doit être résolu par le Développeur avant merge.

---

## 6. Plan de tests

### 6.1 Tests unitaires à créer ou étendre

| ID test | Description | Fichier cible |
|---------|-------------|---------------|
| TC-UC03-01 | `collectPasswordInputs()` retourne les inputs d'une iframe same-origin simulée | `tests/unit/detectors/password-detector.test.ts` |
| TC-UC03-02 | Guard cross-origin Option B : si `top.location.origin !== location.origin`, aucun listener n'est attaché | `tests/unit/detectors/password-detector.test.ts` |
| TC-UC03-03 | Guard INV-UC03-07 : le listener `storage.onChanged` n'affiche le toast que si `window.self === window.top` | `tests/unit/detectors/password-detector.test.ts` |
| TC-UC03-04 | `domain_hash` calculé avec `location.hostname` identique dans iframe same-origin et top frame | `tests/unit/utils/hash.test.ts` |

### 6.2 Recette manuelle

| Scénario | Procédure | Résultat attendu |
|----------|-----------|-----------------|
| Site avec iframe same-origin | Ouvrir DevTools, vérifier injection content script dans la frame (onglet Sources > Content scripts) | Script visible dans la frame same-origin |
| Soumission formulaire dans iframe | Saisir mot de passe dans l'iframe, soumettre | Message `password_submitted` envoyé au SW, visible dans les logs SW |
| Absence de double toast | Avec un mot de passe déjà stocké, soumettre depuis l'iframe | Un seul toast M7 affiché, pas de doublon |
| Iframe cross-origin (Option B uniquement) | Ouvrir une page avec iframe cross-origin (ex. YouTube embed) | Aucun log Sentinel Nudge dans la console de l'iframe cross-origin |

---

## 7. Décisions à arbitrer

### ARB-UC03-01 — Option A (niveau simple) ou Option B (niveau défensif)

**Contexte** : ce choix dépend du threat model produit par l'Architecte sécurité en parallèle. Les deux options produisent un diff manifest identique (1 ligne). Option B ajoute un guard TypeScript d'environ 15 lignes.

**Option A** : implémentation minimale (I-001 respecté), risque cross-origin théorique mais hors périmètre UC-03.

**Option B** : défense en profondeur, surface d'exposition réduite, quelques lignes de code supplémentaires.

**Recommandation architecturale** : Option B, car la DOMException est un signal fiable et gratuit fourni par la Same-Origin Policy du navigateur. Le coût est négligeable, le bénéfice défensif est réel.

**Décision attendue** : Commanditaire ou croisement avec threat model Architecte sécurité.

### ARB-UC03-02 — Enrichissement payload M7 avec `frame_info` (Q-CONF-03)

**Contexte** : ajouter `{ is_top_frame: boolean, frame_url_hash: string }` dans le payload `password_submitted` permettrait de tracer l'origine par frame dans IndexedDB. Utile pour forensique et pour l'évolution R-ADR-06.

**Pour** : traçabilité améliorée, diagnostic plus précis en cas d'incident.

**Contre** : augmente la taille des enregistrements stockés, complexifie le contrat de message (impact sur ADR-001), hors besoin fonctionnel UC-03 strict.

**Recommandation architecturale** : reporter à une tâche ultérieure (backlog v2). UC-03 n'exige pas cette traçabilité. Respecter YAGNI.

**Décision attendue** : Commanditaire.

---

## 8. Questions à l'Architecte sécurité

En attente de la livraison du threat model, les questions suivantes permettront le croisement :

**QS-UC03-01** : Le threat model identifie-t-il un vecteur d'attaque concret exploitant l'injection du content script dans des iframes cross-origin (ex. exfiltration de données M7, manipulation de l'overlay M2) ? Cette réponse est le critère de choix A/B.

**QS-UC03-02** : Le threat model couvre-t-il le scénario d'une iframe same-origin chargée depuis un sous-domaine différent (ex. `login.banque.fr` dans `banque.fr`) ? Techniquement cross-origin, ce cas n'est pas couvert par UC-03 mais est souvent confondu avec same-origin.

**QS-UC03-03** : Le risque de double affichage du toast (INV-UC03-07) est-il classé dans le threat model ? Si oui, sous quelle catégorie STRIDE ?

---

## 9. Résumé des impacts

| Composant | Modification | Ampleur |
|-----------|-------------|---------|
| `src/manifest.json` | Ajout `"all_frames": true` | 1 ligne |
| `src/content-scripts/detectors/password-detector.ts` | Guard cross-origin (Option B uniquement) + guard INV-UC03-07 sur `storage.onChanged` | ~20 lignes |
| Tests unitaires | 4 nouveaux tests TC-UC03-01 à 04 | ~80 lignes estimées |
| Aucune modification | `src/background/service-worker.ts`, `src/background/handlers/m7-handler.ts`, `src/background/message-router.ts` | — |
