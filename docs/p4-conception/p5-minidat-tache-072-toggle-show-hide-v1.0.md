# Mini-DAT — TACHE-072 : Toggle Show/Hide password (UC-05)

**Version** : 1.0
**Date** : 2026-04-17
**Auteur** : Architecte logiciel
**Statut** : Soumis au référent qualité
**Décision à l'origine** : D-PM-05 (PV post-mortem M7 — UC-05 bloquant v1)
**Tâches couvertes** : TACHE-072 (Must bloquant) — consolide TACHE-067 (Could)
**Phase** : P5

---

## Historique des versions

| Version | Date | Modifications |
|---------|------|---------------|
| 1.0 | 2026-04-17 | Version initiale Architecte logiciel |

---

## 1. Contexte et objectif

### 1.1 Leçon du post-mortem M7

Le post-mortem M7 (2026-04-14) identifie UC-05 comme bloquant v1 : lorsqu'un site propose un bouton "œil" basculant l'attribut `type` d'un `<input>` entre `"password"` et `"text"`, M7 peut manquer la détection au submit.

L'analyse du code existant (`password-detector.ts`) confirme quatre points de rupture concrets :

| Point de rupture | Ligne(s) concernées | Mécanisme cassé |
|---|---|---|
| Listener `focusin` | 1639 | `if (target.type !== 'password') return` — champ déjà togglé avant focus → raté |
| `attachSubmitListeners` | 1494 | `querySelectorAll('input[type="password"]')` au moment du submit — si togglé → raté |
| `attachOrphanPasswordListeners` | 1391, 1433 | Même filtre statique `type="password"` en deux endroits |
| `observeDynamicForms` | 1525 | MutationObserver surveille uniquement `childList` (nœuds) — pas l'attribut `type` |

Le chemin d'échec type est : `type="password"` au chargement → utilisateur clique "voir" → `type="text"` → submit → M7 ne capture rien.

### 1.2 Principe directeur

> **Invariant de cycle de vie** : tout input ayant présenté `type="password"` à un instant donné de la durée de vie de la page doit rester dans le périmètre de détection M7 jusqu'à destruction du DOM ou navigation.

Ce principe est non négociable. Il conditionne toute décision de conception du présent document.

---

## 2. Décisions de conception

### 2.1 Emplacement du MutationObserver pour les attributs de type

**Décision** : intégrer l'observation des mutations d'attribut `type` dans la fonction existante `observeDynamicForms()` de `password-detector.ts`, sans créer de module séparé.

**Justification** : `observeDynamicForms()` est déjà l'unique point de surveillance DOM du content script. Créer un module dédié fragmenterait la logique de surveillance sans gain de cohésion. Le périmètre de TACHE-072 ne justifie pas un nouveau fichier.

**Conséquence** : la fonction `observeDynamicForms()` voit sa responsabilité étendue de "détection de formulaires ajoutés" à "surveillance des mutations d'attribut `type`". Son nom pourrait être renommé en `observePasswordInputLifecycle()` — laissé à l'appréciation du développeur pour limiter le diff.

### 2.2 Quoi observer

**Décision** : observer l'attribut `type` sur **tous les inputs du document** via `attributeFilter: ['type']` sur `document.body`, plutôt que d'enregistrer un observateur par input individuellement.

**Justification** :
- Un observateur sur `document.body` avec `subtree: true` couvre les inputs injectés dynamiquement (SPA, React, Vue) sans nécessiter de re-registration.
- Enregistrer un observateur par input est plus coûteux en mémoire et nécessite une gestion de cycle de vie complexe (`disconnect` au retrait du DOM).
- L'`attributeFilter: ['type']` limite le volume de callbacks aux seules mutations pertinentes.

### 2.3 Cible du MutationObserver

```
document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ['type']
}
```

L'observateur existant (`childList: true, subtree: true`) est conservé tel quel pour la détection de formulaires ajoutés. Les deux observations sont fusionnées dans un seul appel `observer.observe()` en ajoutant `attributes: true` et `attributeFilter: ['type']`.

### 2.4 Comportement sur mutation d'attribut

Deux cas :

**Cas A — `type` passe de `"password"` à `"text"`** (toggle "voir mot de passe") :
- Ajouter l'input au `Set` de monitoring `_snPasswordInputs` (voir section 3).
- Ne pas déclencher de hash immédiatement — le hash n'est calculé qu'au submit.
- Conséquence : au submit, la recherche des champs à hasher consulte `_snPasswordInputs` en plus du sélecteur `input[type="password"]`.

**Cas B — `type` passe de `"text"` à `"password"`** (toggle "masquer") :
- Si l'input est déjà dans `_snPasswordInputs` : aucune action (déjà couvert).
- Si l'input n'est **pas** encore dans `_snPasswordInputs` : ne pas l'ajouter automatiquement. Ce cas (champ démarrant en `text` puis repassant en `password`) est ambigu — il pourrait s'agir d'un champ non-password initialement. La décision est d'ignorer ce sous-cas pour v1 (INV-UC05-02).

**Cas C — `type` passe de `"text"` à `"password"` pour un input initialement `type="password"`** : déjà couvert par Cas A (l'input est dans `_snPasswordInputs`).

### 2.5 Interaction avec le filtrage `autocomplete="new-password"` (TACHE-064)

Compatible sans modification. `_snPasswordInputs` stocke les inputs à monitorer pour M7. La détection `isCreationForm()` (qui exclut `autocomplete="new-password"` du monitoring M7 en le routant vers M9) intervient en aval, au moment du submit dans `handleFormSubmit`. Le MutationObserver enregistre l'input dans `_snPasswordInputs` sans préjuger de son rôle ; c'est `handleFormSubmit` qui appliquera le filtrage M9 versus M7 comme aujourd'hui.

### 2.6 Performance — budget MutationObserver

L'ajout de `attributes: true, attributeFilter: ['type']` sur un observateur déjà en place n'introduit pas de coût supplémentaire significatif : les mutations d'attribut `type` sont rares (uniquement lors d'interactions utilisateur explicites sur le bouton toggle). Le callback traite une liste de mutations et effectue uniquement un ajout dans un `Set` — opération O(1).

Aucun debounce n'est nécessaire pour ce callback. Les mutations d'attribut ne sont pas continues (contrairement aux mutations `childList` en SPA qui peuvent être en rafale).

Budget estimé : < 0,5 ms par batch de mutations sur une page standard. Pas de seuil de throttle à définir.

---

## 3. Contrat d'interface TypeScript

Signatures proposées pour les additions à `password-detector.ts`. Ces interfaces décrivent le contrat ; le développeur les implémente dans le corps de la fonction.

```typescript
/**
 * Set persistant des inputs ayant présenté type="password" à un moment
 * donné du cycle de vie de la page.
 * Clé : HTMLInputElement (WeakSet impossible car on doit itérer).
 * Utilisation d'un Set standard — les inputs sont des objets DOM liés au
 * document ; ils seront GC'd lors de la destruction du document.
 */
declare const _snPasswordInputs: Set<HTMLInputElement>;

/**
 * Enregistre un input dans le périmètre de monitoring M7/M9.
 * Idempotent : plusieurs appels avec le même input sont sans effet.
 *
 * @param input - Element input ayant présenté type="password"
 */
declare function registerPasswordInput(input: HTMLInputElement): void;

/**
 * Retourne la liste consolidée des inputs à surveiller au submit :
 * - Inputs actuellement type="password" dans le DOM
 * - Inputs précédemment type="password" enregistrés dans _snPasswordInputs
 *   (union — sans doublon)
 *
 * @param scope - Formulaire (HTMLFormElement) ou document pour les orphelins
 * @returns Tableau d'inputs dédupliqués
 */
declare function collectPasswordInputs(
  scope: HTMLFormElement | Document
): HTMLInputElement[];

/**
 * Callback MutationObserver pour les mutations d'attribut type.
 * Appelé par observeDynamicForms() sur mutation attributeFilter=['type'].
 *
 * @param mutations - Liste des MutationRecord filtrés sur type='attributes'
 */
declare function handleTypeAttributeMutation(
  mutations: MutationRecord[]
): void;
```

**Modification de signature dans les fonctions existantes** :

```typescript
// Avant (ligne 1494) :
const pwdFields = form.querySelectorAll<HTMLInputElement>('input[type="password"]');

// Après (contrat) :
const pwdFields: HTMLInputElement[] = collectPasswordInputs(form);
// -> inclut les inputs togglés en type="text" présents dans _snPasswordInputs
```

```typescript
// Avant (ligne 1433) :
const orphans = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[type="password"]'),
).filter((f) => !f.form && f.value.length > 0);

// Après (contrat) :
const orphans = collectPasswordInputs(document)
  .filter((f) => !f.form && f.value.length > 0);
```

---

## 4. Invariants

**INV-UC05-01** : tout input ayant présenté `type="password"` à un instant quelconque du cycle de vie de la page (y compris après toggle vers `"text"`) reste dans `_snPasswordInputs` jusqu'à navigation ou déchargement du document. Il ne peut pas être retiré du Set par une mutation ultérieure de son attribut `type`.

**INV-UC05-02** : un input dont le `type` initial est `"text"` (et qui n'a jamais été `"password"`) ne doit PAS être ajouté à `_snPasswordInputs`, même s'il est ultérieurement modifié en `"password"` par un script tiers. Cet invariant prévient les faux positifs sur des champs de recherche ou de texte libre transformés dynamiquement.

**INV-UC05-03** : pour un input donné, un seul hash M7 est calculé et envoyé par événement submit, quelle que soit la séquence de toggles préalables (password → text → password → text → submit). Le guard `submittedFields` (WeakSet existant, ligne 1068) assure cette déduplication ; il est conservé sans modification.

**INV-UC05-04** : l'ajout dans `_snPasswordInputs` via le MutationObserver ne crée aucune référence circulaire et ne perturbe pas le garbage collection du document. Les inputs sont des objets DOM ; leur libération suit le cycle de vie normal du document, indépendamment de leur présence dans le Set.

---

## 5. Analyse sécurité

### 5.1 Visibilité transitoire du mot de passe en clair

Lorsque l'utilisateur clique "voir", le champ passe en `type="text"` et la valeur devient visible à l'écran. Ce comportement est intentionnel côté site. Du point de vue de M7 :
- M7 ne lit jamais la valeur avant le submit. Le toggle n'aggrave pas l'exposition côté extension.
- En revanche, si un script tiers lit `input.value` sur un champ `type="text"`, la valeur est accessible. Ce risque est propre au site, pas à M7 — à signaler dans la documentation utilisateur si pertinent.
- Interaction M17 (clipboard) : si l'utilisateur copie le mot de passe affiché en clair, M17 pourrait potentiellement le capturer via `clipboard` API. Cette interaction est hors périmètre TACHE-072 et doit faire l'objet d'une analyse séparée avec l'architecte sécurité.

### 5.2 R-CLI-07 — Non-journalisation de la valeur en clair (INV-SEC-02 étendu)

Le contexte de toute entrée de log liée aux mutations de type ne doit pas contenir `input.value`. Seuls sont autorisés dans les logs : `input.id`, `input.name`, `input.type` (valeur cible de la mutation), et l'horodatage. Le développeur doit s'assurer qu'aucun log `console.info` / `console.warn` ajouté pour cette tâche n'inclut `field.value` ou `passwordValue`.

### 5.3 Risque de rétention mémoire d'une valeur sensible

`_snPasswordInputs` est un `Set<HTMLInputElement>` — il maintient une référence forte à chaque input enregistré. Tant que le content script vit (durée de vie de la page), ces références empêchent le GC de collecter les éléments DOM.

Analyse : ce n'est pas un risque de fuite de la **valeur** du mot de passe. M7 ne stocke jamais `input.value` dans `_snPasswordInputs` — seule la référence à l'élément DOM est conservée. La valeur en clair reste dans le DOM natif du navigateur (inaccessible à un GC par construction). Le Set ne crée pas de risque supplémentaire par rapport à la référence que le DOM lui-même maintient sur l'input.

Si l'input est retiré du DOM (navigation SPA intra-page, suppression par le site), la référence dans `_snPasswordInputs` devient orpheline. **Mitigation recommandée** : le MutationObserver existant (`childList: true, subtree: true`) déjà en place peut détecter le retrait de nœuds ; une purge de `_snPasswordInputs` sur `removedNodes` est possible mais non obligatoire pour v1 (le document lui-même est déchargé à la navigation). Un `WeakRef` n'est pas adapté ici car on doit itérer sur le Set au submit.

**Décision v1** : pas de purge active. La rétention est bornée à la durée de vie du document. À réévaluer si des cas de SPA à longue durée de vie (> 30 min, formulaires multiples) sont identifiés.

---

## 6. Plan de tests

| ID | Scénario | Précondition | Action | Résultat attendu |
|---|---|---|---|---|
| TC-UC05-01 | Toggle simple, submit avec type="text" | Page avec `<input type="password">` + bouton toggle | (1) Focus champ (2) Toggle → type="text" (3) Saisie mdp (4) Submit | Hash M7 calculé et envoyé au SW. Toast affiché si réutilisation. |
| TC-UC05-02 | Input démarre en "text", toggle → "password", submit | `<input type="text" id="pwd">` modifié en `type="password"` par JS après chargement | (1) JS change type→"password" (2) Saisie (3) Submit | Input NON capturé (INV-UC05-02 — n'était pas "password" à l'initialisation). |
| TC-UC05-03 | Toggle multiple rapide (spam), 1 seul hash | Page avec toggle | Toggle × 5 en < 500ms puis submit | Un seul message M7 envoyé au SW pour cet input (INV-UC05-03, guard `submittedFields`). |
| TC-UC05-04 | Formulaire avec 2 inputs password, 1 seul togglé | `<form>` avec input-A (password) + input-B (password) | Toggle input-A → type="text". Submit. | 2 hashes capturés : hash(input-A.value) + hash(input-B.value). |
| TC-UC05-05 | Navigation SPA (React/Vue), formulaire rechargé | SPA avec routeur client, formulaire login rendu/détruit/re-rendu | (1) Route A → formulaire login + toggle (2) Route B (3) Retour route A → nouveau formulaire | Le nouveau formulaire (nouveau DOM) est détecté par `observeDynamicForms()`. L'ancien Set de références est invalide mais un nouveau `_snPasswordInputs` est peuplé. Submit capturé normalement. |

---

## 7. Impact sur les fichiers existants

### 7.1 `src/content-scripts/detectors/password-detector.ts` — Modifications principales

Ce fichier est le seul modifié par TACHE-072.

**Ajouts** :

- Déclaration de `_snPasswordInputs: Set<HTMLInputElement>` (module-level, aux côtés de `submittedFields`, `m9Contexts`, etc.)
- Fonction `registerPasswordInput(input)` — appelée (a) à l'initialisation sur tous les inputs `type="password"` présents, (b) par le callback MutationObserver sur mutation `password → text`
- Fonction `collectPasswordInputs(scope)` — remplace les `querySelectorAll('input[type="password"]')` aux points de rupture identifiés
- Fonction `handleTypeAttributeMutation(mutations)` — extrait la logique du callback MutationObserver pour lisibilité et testabilité

**Modifications** :

| Localisation | Nature | Lignes actuelles |
|---|---|---|
| `initPasswordDetector()` | Appel `registerPasswordInput` sur tous les inputs présents au boot | ~1618 |
| `observeDynamicForms()` | Ajout `attributes: true, attributeFilter: ['type']` à l'observe, ajout de la branche `type='attributes'` dans le callback | 1525–1547 |
| `attachSubmitListeners()` — lambda submit | Remplacer `querySelectorAll('input[type="password"]')` par `collectPasswordInputs(form)` | 1494 |
| `attachOrphanPasswordListeners()` — keydown | Remplacer filtre `target.type !== 'password'` par vérification `_snPasswordInputs.has(target)` | 1391 |
| `attachOrphanPasswordListeners()` — click | Remplacer `querySelectorAll('input[type="password"]')` par `collectPasswordInputs(document)` | 1433 |
| `initPasswordDetector()` — listener `focusin` | Ajouter une branche : si `target.type !== 'password'` mais `_snPasswordInputs.has(target)` → traiter quand même | 1639 |

### 7.2 `src/content-scripts/detectors/toast-m7.ts`

Non applicable — le toast M7 est entièrement intégré dans `password-detector.ts` (fonction `showToastM7`, ligne 1208). Aucun fichier séparé `toast-m7.ts` n'existe actuellement.

### 7.3 `src/background/handlers/m7-handler.ts`

Pas touché. Le handler SW reçoit uniquement un hash et un domain_hash — il est agnostique du type d'input côté DOM. La logique de capture reste entièrement dans le content script.

---

## 8. Décisions à arbitrer

Un seul point requiert arbitrage du Commanditaire :

**ARB-072-01 — Purge de `_snPasswordInputs` sur retrait DOM (SPA longue durée)**

Contexte : si une SPA retire et re-crée des formulaires fréquemment (navigation intra-page longue, ex. wizard multi-étapes), `_snPasswordInputs` peut accumuler des références à des inputs retirés du DOM. Pour v1, la purge active n'est pas implémentée (rétention bornée à la durée de vie du document, généralement < 30 min).

Options :
- **Option A (recommandée)** : ne pas implémenter de purge en v1. Réévaluer si des rapports terrain signalent une fuite mémoire mesurable. Budget mémoire estimé : < 50 inputs par page, négligeable.
- **Option B** : implémenter une purge sur `removedNodes` dans le callback `childList` de `observeDynamicForms()`. Coût : +15 lignes, léger risque de purge prématurée si le site retire/réinsère des inputs (pattern React reconciliation).

Recommandation : Option A pour v1.

---

*Fin du document — TACHE-072 — v1.0*
