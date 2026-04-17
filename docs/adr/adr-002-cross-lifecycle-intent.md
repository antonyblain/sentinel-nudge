# ADR-002 — CROSS-LIFECYCLE-INTENT

**Status** : Accepted  
**Date** : 2026-04-16  
**Auteur** : Architecte logiciel  
**Origine** : D-PM-01 (PV post-mortem M7, 2026-04-14) — incident P-019  
**Phase** : P5

---

## Contexte

Le post-mortem M7 (2026-04-14) a identifié l'incident **P-019** : sur le site `herokuapp.com`, la page de login redirige vers `/login` immédiatement après le submit du formulaire, avant que le content script M7 n'ait eu le temps d'afficher le toast de réutilisation. Le toast était préparé dans la mémoire du SW, mais la navigation détruisait le contexte du content script avant que l'instruction `show` n'arrive à destination.

Le cycle de vie du Service Worker MV3 aggrave le problème : le SW peut être tué par Chrome après ~30 s d'inactivité (contrainte RT-001, `service-worker.ts` §1). Toute donnée stockée uniquement en mémoire est perdue lors de ce kill. Les frontières de cycle de vie suivantes sont susceptibles de provoquer ce type d'incident :

- **Dormance SW** : le SW est tué et relancé entre l'émission et la consommation de l'effet.
- **Redirect post-submit** : la page navigue avant que le content script ne traite la réponse.
- **Réinjection content script** : un `chrome.scripting.executeScript` ou un rechargement de page recrée le content script, qui perd l'état de la session précédente.
- **Kill de process** : crash ou arrêt du navigateur.
- **Navigation cross-origin** : le contexte du content script est remplacé par un nouveau contexte.

La règle `pending_m7_toast` implémentée dans m7-handler.ts (P-019) constitue la réponse opérationnelle. Cet ADR la généralise à tous les modules.

---

## Décision

**Toute action utilisateur dont l'effet traverse une frontière de cycle de vie DOIT être persistée dans `chrome.storage.local` (ou IndexedDB) avec un TTL, et consommée à destination par le contexte qui reçoit l'effet. Aucune action ne repose sur un état mémoire qui suppose la continuité du contexte.**

Les invariants de la règle sont :

- L'intent est écrit dans storage **avant** l'action qui traverse la frontière (par exemple, avant d'envoyer `show` au content script sur une page qui va rediriger).
- L'intent contient un TTL (`expires_at: number`) calculé à l'émission.
- Le consommateur (content script relancé, page rechargée) lit l'intent au démarrage, vérifie `Date.now() < expires_at`, exécute l'effet, puis purge l'intent (one-shot).
- Le payload de l'intent est sérialisable JSON-strict : pas d'`ArrayBuffer`, pas d'`Uint8Array`, pas de `CryptoKey` (leçon P-018, `TECH_STACK.md`).

---

## Conséquences

### Positives

- **Résilience aux kills SW** : un intent émis avant la dormance est retrouvé au réveil suivant.
- **Résilience aux redirects** : le content script rechargé sur la page de destination consomme l'intent sans nouvelle intervention du SW.
- **Résilience aux réinjections** : le content script réinjecté après un `executeScript` retrouve l'intent dans storage.
- **Déduplication naturelle** : la clé storage nommée par module et action (`pending_<module>_<action>`) assure qu'un seul intent est actif par (module, action) à la fois.
- **Traçabilité forensique** : les intents expirés non consommés (clé présente, `expires_at` dépassé) signalent un problème de consommation (contenu script non injecté, bug de désérialisation) — exploitable dans le registre d'incidents.

### Négatives

- **Complexité de sérialisation** : les payloads incluant des buffers binaires doivent être convertis en `Array<number>` (invariant INV-06, leçon P-018). Cela alourdit les émetteurs et les consommateurs.
- **TTL à calibrer** : un TTL trop court manque les redirects lentes (pages lourdes) ; un TTL trop long accumule des intents orphelins. La valeur de 10 minutes choisie pour M7 est un point de départ à ajuster par module selon les mesures terrain.
- **Nettoyage des intents expirés** : la purge quotidienne existante (`onPurgeDaily` dans `service-worker.ts`) doit être étendue pour couvrir les clés `pending_*` expirées. Sans nettoyage, storage s'accumule silencieusement. **Suivi : TACHE-093** (à inscrire au BACKLOG.md).
- **Surface d'exposition storage** : `chrome.storage.local` est lisible par toute extension installée avec la permission `storage` dans le même profil (R-003 accepté). Un payload trop riche (plaintext, URL complète, token) deviendrait exfiltrable pendant toute la durée du TTL — d'où R-CLI-07 (payload minimisé).

---

## Implémentation de référence

La correction P-019 dans TACHE-056 (m7-handler.ts) constitue l'implémentation canonique de cet ADR.

**Fichiers et lignes clés :**

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `src/background/handlers/m7-handler.ts` | 287–294 | Émission de l'intent `pending_m7_toast` dans `chrome.storage.local` avec `domain_hash` et `timestamp` — **avant** le retour `show` au content script |
| `src/background/handlers/m7-handler.ts` | 284–294 | Payload JSON-strict : `{ domain_hash: string, timestamp: number }` — pas de types binaires |
| `src/background/handlers/m7-handler.ts` | 353–362 | Action `toast_orphan` : le content script signale un intent expiré (age_ms > TTL) via `incidentService.log('toast_orphan', 'warn', ...)` |

Le TTL de 10 minutes est appliqué côté consommateur (content script `toast-m7.ts`) : il vérifie `Date.now() - pending.timestamp < 600_000` avant d'afficher. Côté émetteur, le champ `timestamp` correspond à `Date.now()` au moment de l'émission.

Note : l'implémentation actuelle M7 utilise `timestamp` (date d'émission) plutôt que `expires_at` (date d'expiration absolue). R-CLI-03 formalise la forme canonique avec `expires_at` pour toutes les nouvelles implémentations. **La forme `timestamp` de M7 est couverte par une exception transitoire formalisée en section "Exceptions"** (E-CLI-01) et sera mise en conformité par **TACHE-091**. Les deux formes sont fonctionnellement équivalentes à l'instant t (TTL partagé côté consommateur), mais la forme canonique `expires_at` est obligatoire pour toute nouvelle implémentation M5/M6/M17/autres.

---

## Règles dérivées

### R-CLI-01

La clé storage est nommée explicitement `pending_<module>_<action>` (ex. `pending_m7_toast`, `pending_m5_update_reminder`). Cette convention évite les collisions entre modules et rend les intents lisibles dans DevTools sans documentation supplémentaire.

### R-CLI-02

Le payload de l'intent est sérialisable JSON-strict. Les types interdits sont : `ArrayBuffer`, `Uint8Array`, `Blob`, `Date`, `Map`, `Set`, `CryptoKey`. Les buffers binaires sont convertis en `Array<number>` avant stockage (leçon P-018 consolidée dans `TECH_STACK.md`, rappel **INV-06** mini-DAT TACHE-061 §3.2).

### R-CLI-03

Chaque intent contient un champ `expires_at: number` (timestamp ms depuis epoch). Le consommateur vérifie `Date.now() < expires_at` avant d'exécuter l'effet. Un intent expiré est purgé sans exécution. La valeur de TTL par défaut est 10 minutes (600 000 ms) sauf besoin spécifique documenté dans le handler.

### R-CLI-04

La consommation est **one-shot** : le consommateur purge l'intent immédiatement après exécution (`chrome.storage.local.remove('pending_<module>_<action>')`), que l'effet réussisse ou non. La purge DOIT être **atomique avec la consommation** : dans le consommateur, l'appel `chrome.storage.local.remove(...)` est déclenché dans la même microtask que la récupération (lecture → exécution → remove sans `await` intermédiaire sur une I/O externe) afin d'éviter une fenêtre de ré-exécution sur un second cycle (rejeu / replay). En cas d'échec de `remove`, logguer un incident `severity=error` de catégorie `pending_purge_failed` ; ne pas retenter l'exécution. Les exceptions à ce principe (ex. retry sur échec transitoire) doivent être documentées explicitement dans le fichier handler.

### R-CLI-05

Un test dédié couvre le scénario complet : "intent émis → SW killed (simulé par reset du contexte) → re-démarrage → intent consommé OK". Ce test est obligatoire avant la mise en production de tout module implémentant un intent cross-lifecycle.

### R-CLI-06

Si le payload contient une **donnée chiffrée** (ciphertext + IV AES-GCM), l'**IV AES-GCM NE DOIT JAMAIS être réutilisé** lors d'une ré-émission de l'intent. Toute ré-émission (nouvel émetteur sur la même action module) DOIT régénérer un IV frais via `crypto.getRandomValues(new Uint8Array(12))`. Application explicite d'**INV-SEC-01** (mini-DAT TACHE-061 §3.2) : la réutilisation d'IV AES-GCM avec la même clé compromet la confidentialité et l'intégrité du chiffré (CWE-323). Les IV persistés dans un intent restent valides pour la *consommation* de cet intent uniquement ; ils ne peuvent pas être recyclés sur une nouvelle émission.

### R-CLI-07

Le payload de l'intent est **minimisé** (extension d'**INV-SEC-02** mini-DAT TACHE-061 §3.2 au support `pending_*`). Types autorisés : hashes (`domain_hash: string` déjà tronqué à 16 hex), énumérations (`data_type: 'CB' | 'IBAN' | 'SSN'`), IDs abstraits (`question_id: number`), timestamps, compteurs. Types interdits : plaintexts, mots de passe, tokens, URLs complètes (avec query string), cookies, contenus de presse-papiers bruts. Le raisonnement : un intent persiste jusqu'à `expires_at` (jusqu'à 10 min par défaut) dans `chrome.storage.local`, lisible par toute extension tierce disposant de la permission `storage` installée dans le même profil. Un payload minimisé réduit cette surface d'exposition à un renseignement pseudonymisé non exploitable seul. La revue de conformité à R-CLI-07 est obligatoire avant merge pour tout nouveau pattern pending-intent (checklist comité revue code).

---

## Analyse STRIDE

Périmètre de cet ADR : les **intents cross-lifecycle** stockés en `chrome.storage.local` avec TTL.

### Menaces atténuées

| Classe STRIDE | Scénario | Mesure apportée par l'ADR |
|---------------|----------|---------------------------|
| **Tampering** | Un intent est altéré par une extension tierce ou par une purge partielle (corruption JSON) entre émission et consommation | R-CLI-02 (JSON-strict typé) + R-CLI-03 (`expires_at` borné) : la validation au consommateur rejette les payloads malformés ; un intent non désérialisable est logué et purgé |
| **Repudiation** | Une action (toast, quiz) censée avoir été affichée ne laisse aucune trace si l'envoi a échoué silencieusement | `toast_orphan` (intent présent + expiré non consommé) + R-CLI-04 (log incident sur `pending_purge_failed`) : toute discontinuité du pipeline est journalisée |
| **Information Disclosure** | Un intent reste en storage jusqu'à TTL et fuite du contexte sensible si son payload est trop riche | R-CLI-07 : payload minimisé (hashes, enums, IDs) ; aucun plaintext ; surface d'exposition réduite à un pseudonyme non exploitable seul |
| **Denial of Service** | Accumulation d'intents expirés orphelins saturant `chrome.storage.local` (quota 10 Mo) | Purge quotidienne étendue (conséquence négative listée) + R-CLI-04 one-shot atomique |

### Hors périmètre

| Classe STRIDE | Raison |
|---------------|--------|
| **Spoofing** | Un intent n'a pas d'origine authentifiée — n'importe quelle extension avec `storage` peut écrire une clé `pending_*`. L'authentification inter-contextes relève de la vérification `chrome.runtime.id` dans le `MessageRouter` et de la CSP. |
| **Elevation of Privilege** | Un intent ne confère pas de privilèges ; il déclenche un effet (toast) dans un contexte (content script) qui a déjà ses droits. Un intent forgé par une extension tierce ne peut au pire que provoquer un toast parasite (cas de nuisance, pas d'élévation). Documenté comme risque accepté en lien avec R-M7-05. |
| **Rejeu par tiers malveillant** | R-CLI-04 atténue le rejeu *accidentel* (double consommation par le même consommateur). Un rejeu orchestré par une extension tierce qui ré-écrit une clé `pending_*` reste possible et relève du même modèle d'adversaire que R-M7-05 (accepté). |

### Secrets dans les exemples

Revue effectuée sur cet ADR : aucun plaintext, token ou URL complète n'est cité. Les exemples utilisent `domain_hash` (déjà haché), des noms de clés (`pending_m7_toast`) et des champs typés (`snooze_count`, `data_type`). Conforme à INV-SEC-02 appliqué à la documentation et à R-CLI-07 appliqué au schéma lui-même.

---

## Contrôles ISO 27001:2022 (Annexe A)

Cet ADR contribue à la couverture des contrôles suivants :

- **A.5.10 — Acceptable use of information and associated assets** : R-CLI-07 borne l'usage admissible de `chrome.storage.local` (pas de plaintext, pas de secret, pas d'URL) — énoncé opposable en revue de code.
- **A.8.10 — Information deletion** : R-CLI-04 (purge atomique one-shot) + TTL R-CLI-03 + purge quotidienne des `pending_*` expirés garantissent la suppression effective des données transitoires conformément au principe de rétention minimale.
- **A.8.15 — Logging** : `toast_orphan` et `pending_purge_failed` (R-CLI-04) produisent des événements journalisés qui rendent observables les défaillances du pipeline cross-lifecycle.
- **A.8.24 — Use of cryptography** : R-CLI-06 impose la fraîcheur d'IV AES-GCM à chaque émission, alignée sur NIST SP 800-38D et OWASP Cryptographic Storage Cheat Sheet (ne jamais réutiliser un `(key, IV)` sur AES-GCM — CWE-323).
- **A.8.25 — Secure development life cycle** : l'ADR documente un pattern réutilisable opposable à toute nouvelle feature (TACHE-087, 088, 090) et inclus dans la checklist pré-merge.
- **A.8.28 — Secure coding** : R-CLI-02 (typage strict JSON), R-CLI-06 (IV frais), R-CLI-07 (minimisation) formalisent des règles de codage sécurisé couvrant respectivement CWE-502 (Deserialization of Untrusted Data), CWE-323 (IV reuse), CWE-532 (Insertion of Sensitive Information into Log/Storage).

---

## Exceptions

### Exception générale — actions synchrones

Les actions **synchrones dont l'effet est confiné à la même microtask** sont exemptées : si l'action et son effet se produisent dans le même gestionnaire d'événements, sans aucune frontière de cycle de vie entre les deux, le pattern pending-intent est inutile et ajoute une complexité non justifiée. L'exemption doit être documentée en JSDoc dans le fichier handler.

### E-CLI-01 — Exception transitoire pour l'implémentation existante M7 (`pending_m7_toast`)

**Portée** : uniquement le champ de sérialisation de la date d'expiration.

**Nature** : la forme actuelle M7 utilise `{ timestamp: number }` (date d'émission) avec un TTL constant vérifié côté consommateur (`Date.now() - pending.timestamp < 600_000`). Cette forme est **fonctionnellement équivalente** à `expires_at` à l'instant t, tant que la constante TTL est partagée de manière canonique entre émetteur et consommateur (ce qui est le cas dans `m7-handler.ts` et `toast-m7.ts`).

**Durée** : transitoire jusqu'à **TACHE-091** (mise en conformité R-CLI-03 + ajout TC R-CLI-05 + TC "double consommation empêchée"). Après TACHE-091, cette exception est caduque.

**Interdictions pendant l'exception** :
- **INTERDICTION** d'étendre cette forme à de nouveaux modules : toute nouvelle implémentation pending-intent (M5/M6/M17/autres) **doit** utiliser `expires_at` conformément à R-CLI-03.
- **INTERDICTION** de modifier la constante TTL M7 sans propagation simultanée côté émetteur ET consommateur.

**Conditions de validité** :
- La constante TTL doit rester documentée en un seul endroit (actuellement `toast-m7.ts` ligne de référence).
- Tout toast_orphan détecté doit continuer d'être loggué via `incidentService.log('toast_orphan', 'warn', ...)`.

**Suivi** : référencée dans TACHE-091 du BACKLOG et dans `RISQUES.md` (dette de conformité tracée en audit).

---

## Alternatives rejetées

### Option A — Communication directe SW → content script via `chrome.tabs.sendMessage` uniquement

Le SW envoie l'instruction `show` directement au content script. Aucun stockage intermédiaire.

**Rejetée** : c'est le mécanisme qui a échoué pour P-019 (redirect) et qui est structurellement fragile face à la dormance SW et aux navigations. La correction de P-019 le démontre empiriquement.

### Option B — IndexedDB pour tous les intents

Tous les intents cross-lifecycle sont stockés dans un store IndexedDB dédié plutôt que dans `chrome.storage.local`.

**Rejetée pour le cas général** : `chrome.storage.local` est plus simple d'accès depuis le SW et le content script, et les intents sont des données légères et éphémères qui ne justifient pas la complexité transactionnelle d'IndexedDB. IndexedDB reste pertinent pour des intents volumineusement complexes (payloads > 1 Mo) — cas non rencontré dans Sentinel Nudge.

### Option C — Mécanisme de retry (SW réémet l'intent si le content script ne répond pas)

Le SW garde l'intent en mémoire et le réémet à intervalles réguliers jusqu'à confirmation de consommation.

**Rejetée** : la dormance du SW rend ce mécanisme inefficace (la mémoire est perdue). Un retry persisté en storage revient au pattern ADR-002 avec une couche de complexité supplémentaire inutile.

---

## Plan B

Si les intents expirés s'accumulent et dégradent les performances de `chrome.storage.local`, implémenter un index des clés `pending_*` dans un champ unique `pending_intents_index: string[]` mis à jour à chaque émission. La purge quotidienne itère sur cet index et supprime les clés expirées en un seul batch. Cette optimisation est reportée jusqu'à ce que des mesures terrain indiquent un problème réel.
