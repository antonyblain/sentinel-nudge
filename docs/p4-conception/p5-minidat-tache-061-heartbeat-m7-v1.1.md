# Mini-DAT — TACHE-061 : Heartbeat M7, Canary Hash, Registre d'incidents

**Version** : 1.1  
**Date** : 2026-04-16  
**Auteur** : Architecte logiciel  
**Revue sécurité** : Architecte sécurité (sections 6bis, 9bis, 11, 12 ajoutées — 2026-04-16)  
**Contrôle qualité** : Référent qualité — validé avec commentaires 2026-04-16 (2 bloquantes A-01/A-02 corrigées)  
**Validation Commanditaire** : 2026-04-16 — arbitrages ARB-061-01 / 02 / 03 tranchés selon recommandations  
**Statut** : Validé — apte à implémentation  
**Décision à l'origine** : D-PM-04 (PV post-mortem M7 v1.0)  
**Tâches couvertes** : TACHE-061 (composants internes) — prérequis à TACHE-062 (badge popup)  
**Phase** : P5

---

## Historique des versions

| Version | Date | Modifications |
|---------|------|---------------|
| 1.0 | 2026-04-16 | Version initiale Architecte logiciel + enrichissement Architecte sécurité (sections 6bis, 9bis, 11, 12, INV-SEC-01 à 05, risques R-M7-05/06/07) |
| 1.1 | 2026-04-16 | Corrections RQ : alignement interne type `context` (A-01) + ajout TC-M7-SEC-29 dans plan de tests (A-02). Arbitrages ARB-061-01 (Option A), ARB-061-02 (Option B), ARB-061-03 (Option A) tranchés par le Commanditaire. |

---

## 1. Contexte et objectif

### 1.1 Leçon du post-mortem

Le post-mortem M7 (2026-04-14) a identifié deux incidents de classe critique :

- **P-016** — La clé AES absente (storage purgé, premier réveil post-install raté) rendait M7 muet sans aucun signal visible. *Fail silent = fail open* en sécurité.
- **P-018** — La désérialisation `Array<number>` cassée rendait les hashes précédents illisibles : faux `no_reuse` systématique entre sessions.

Le fix de P-016 ajoute une auto-régénération de la clé, mais ne distingue pas "clé absente au premier boot" de "clé corrompue en cours de vie". Le fix de P-018 corrige la sérialisation mais ne détecte pas une régression future.

La décision D-PM-04 impose d'instrumenter M7 pour détecter ces classes de problèmes **en amont**, avant qu'ils impactent la détection.

### 1.2 Principe directeur

> **Contrat avant code.** Ce mini-DAT définit les interfaces TypeScript, les invariants, et les points d'instrumentation. Le développeur ne touche pas service-worker.ts ou m7-handler.ts avant que ce document soit validé.

### 1.3 Trois mécanismes complémentaires

| Mécanisme | Objectif | Stockage |
|-----------|----------|----------|
| **Heartbeat `diagnostics.m7`** | Matérialiser l'état de santé M7 à tout instant | `chrome.storage.local` |
| **Canary hash au boot SW** | Prouver que la clé AES chargée est fonctionnelle | `chrome.storage.local` (ciphertext + IV) |
| **Registre d'incidents IndexedDB** | Tracer les anomalies M7 avec purge FIFO bornée | IndexedDB (store `m7_incidents`) |

---

## 2. Architecture cible

### 2.1 Diagramme du flux boot SW

```
chrome.runtime.onInstalled / réveil SW (module-level IIFE)
│
├─ loadCryptoKey()
│   ├─ [clé absente]  → logger INCIDENT(boot_fail) → régénérer clé → re-tenter canary init
│   └─ [clé présente] → canaryService.verify(cryptoKey)
│                           ├─ [OK]     → heartbeat.ready=true, heartbeat.canary_verified=true
│                           └─ [ÉCHEC]  → logger INCIDENT(canary_failed)
│                                           → régénérer clé AES (rejoue chemin P-016)
│                                           → canaryService.init(newKey) → re-verify
│                                           → heartbeat.ready=true si 2e verify OK
│                                           → heartbeat.ready=false si 2e verify KO
│
├─ persistHeartbeat(diagnostics.m7)       ← chrome.storage.local
│
├─ registerModuleHandlers(cryptoKey)
│
└─ [tout au long du cycle de vie M7]
    └─ m7-handler.ts : points d'instrumentation → logIncident(type, severity, context)
                                                  → updateHeartbeat(last_detection_ts)
```

### 2.2 Emplacement des nouveaux fichiers

```
src/background/
├─ services/
│   ├─ heartbeat-service.ts      ← NEW : lecture/écriture diagnostics.m7
│   ├─ canary-service.ts         ← NEW : init/verify canary hash
│   └─ incident-service.ts       ← NEW : insertion IndexedDB m7_incidents (FIFO 500)
```

Les trois services sont instanciés dans `service-worker.ts` au même niveau que `CryptoService` et `StorageService`. Ils ne dépendent pas de `StorageService` (lequel gère les stores métier) — `incident-service.ts` ouvre sa propre transaction sur la DB existante `sentinel-nudge-db` après migration vers la version 2.

---

## 3. Contrats d'interface TypeScript

### 3.1 Heartbeat — `diagnostics.m7`

```typescript
// src/shared/types/diagnostics.ts  (nouveau fichier)

/**
 * Objet de santé M7 persisté sous la clé chrome.storage.local 'diagnostics.m7'.
 * Mis à jour à chaque boot SW et à chaque détection.
 * Consommé par TACHE-062 (badge dégradé si ready=false depuis > 1h).
 */
export interface M7Diagnostics {
  /** true si et seulement si la boot sequence s'est terminée sans erreur
   *  ET le canary a été vérifié avec succès dans cette session SW. */
  ready: boolean;

  /** Timestamp (ms since epoch) du dernier boot dont ready=true s'est propagé.
   *  Utilisé par TACHE-062 : si Date.now() - last_boot_ts > 3600000 et ready=false → badge dégradé. */
  last_boot_ts: number;

  /** Timestamp (ms since epoch) de la dernière détection de réutilisation, null si aucune. */
  last_detection_ts: number | null;

  /** Nombre de boots du SW depuis l'installation (monotone croissant, jamais decrementé).
   *  Utile pour détecter les boucles de redémarrage anormales (boot_count > 50/heure = anomalie). */
  boot_count: number;

  /** true si le canary a été vérifié avec succès lors de la session courante.
   *  Invariant : si ready=true alors canary_verified=true. */
  canary_verified: boolean;
}

/** Clé chrome.storage.local utilisée pour diagnostics.m7 */
export const DIAGNOSTICS_M7_KEY = 'diagnostics.m7';
```

**Service associé :**

```typescript
// src/background/services/heartbeat-service.ts

import type { M7Diagnostics } from '@/shared/types/diagnostics';
import { DIAGNOSTICS_M7_KEY } from '@/shared/types/diagnostics';
import { browser } from '@/shared/browser/browser-adapter';

export class HeartbeatService {
  /**
   * Lit le heartbeat courant depuis chrome.storage.local.
   * Retourne un heartbeat vide (ready=false) si absent (premier boot ou storage purgé).
   */
  async read(): Promise<M7Diagnostics>;

  /**
   * Persiste le heartbeat dans chrome.storage.local.
   * Appeler après chaque mutation significative (boot, canary, détection).
   */
  async write(diagnostics: M7Diagnostics): Promise<void>;

  /**
   * Incrémente boot_count, met à jour last_boot_ts, remet ready=false et
   * canary_verified=false en début de boot (état conservatif avant vérification).
   * Retourne le nouvel objet pour enchaînement.
   */
  async onBootStart(): Promise<M7Diagnostics>;

  /**
   * Marque ready=true, canary_verified=true, last_boot_ts=Date.now().
   * Persiste immédiatement.
   */
  async onBootSuccess(): Promise<void>;

  /**
   * Marque ready=false. Ne modifie pas boot_count ni last_boot_ts.
   * Persiste immédiatement.
   */
  async onBootFailure(): Promise<void>;

  /**
   * Met à jour last_detection_ts=Date.now(). Persiste immédiatement.
   * Appelé depuis m7-handler.ts après chaque détection de réutilisation.
   */
  async onDetection(): Promise<void>;
}
```

### 3.2 Canary hash

```typescript
// src/background/services/canary-service.ts

import type { CryptoService } from '@/background/crypto-service';
import { browser } from '@/shared/browser/browser-adapter';

/** Plaintext de référence — ne pas modifier entre versions (brisera le canary existant).
 *  Si la chaîne est modifiée lors d'une mise à jour, la migration doit réinitialiser le canary. */
export const CANARY_PLAINTEXT = 'SN-CANARY-v1';

/** Clés chrome.storage.local pour les composants du canary */
export const CANARY_KEYS = {
  CIPHERTEXT: 'canary_ciphertext',  // Array<number> (JSON-safe, cf. leçon P-018)
  IV:         'canary_iv',          // Array<number> (12 bytes)
} as const;

export type CanaryVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'absent' | 'decrypt_failed' | 'mismatch' };

export class CanaryService {
  constructor(private readonly crypto: CryptoService) {}

  /**
   * Chiffre CANARY_PLAINTEXT avec la clé fournie et persiste
   * canary_ciphertext + canary_iv dans chrome.storage.local.
   * Appelé une fois au premier boot après install, ou après régénération de clé.
   *
   * Stockage JSON-safe : Uint8Array → Array<number> (règle P-018).
   */
  async init(key: CryptoKey): Promise<void>;

  /**
   * Déchiffre le canary stocké et compare au CANARY_PLAINTEXT.
   *
   * @returns CanaryVerifyResult
   *   - ok: true  → la clé est fonctionnelle et correspond au canary stocké
   *   - ok: false, reason: 'absent'         → premier boot ou storage purgé → appeler init()
   *   - ok: false, reason: 'decrypt_failed' → clé corrompue ou changée → régénérer + init()
   *   - ok: false, reason: 'mismatch'       → déchiffrement réussi mais plaintext différent
   *                                            (ne devrait pas arriver — log error + régénérer)
   */
  async verify(key: CryptoKey): Promise<CanaryVerifyResult>;
}
```

**Règle de stockage JSON-safe (critique)** : Le ciphertext (`ArrayBuffer`) et l'IV (`Uint8Array`) doivent être convertis en `Array<number>` avant `chrome.storage.local.set()`, conformément à la leçon P-018. La lecture inverse via `new Uint8Array(stored_array)`.

### 3.3 Registre d'incidents IndexedDB

```typescript
// src/shared/types/diagnostics.ts  (suite du même fichier)

/** Types d'incidents tracés dans le registre M7 */
export type M7IncidentType =
  | 'boot_fail'           // Clé AES absente ou non importable au boot SW
  | 'canary_failed'       // Canary non vérifié (absent, decrypt_failed, mismatch)
  | 'submit_detect_fail'  // Exception dans handlePasswordSubmitted
  | 'toast_orphan'        // pending_m7_toast consommé mais toast non affiché
  | 'storage_write_fail'  // Erreur lors d'un browser.storage.local.set critique
  | 'idb_write_fail';     // Erreur lors d'une transaction IndexedDB M7

export type M7IncidentSeverity = 'info' | 'warn' | 'error';

/** Entrée du registre d'incidents IndexedDB */
export interface M7IncidentRecord {
  /** Clé primaire autoIncrement (attribuée par IndexedDB) */
  id?: number;
  /** Timestamp de l'incident (ms since epoch) */
  ts: number;
  /** Type de l'incident */
  type: M7IncidentType;
  /** Sévérité */
  severity: M7IncidentSeverity;
  /**
   * Contexte sérialisable en JSON, typé.
   *
   * NOTE D'ALIGNEMENT (INV-SEC-02 / CM-ID2) : ce champ est initialement
   * typé `Record<string, unknown>` uniquement pour permettre la mise en place
   * incrémentale. Il DOIT être remplacé par l'union discriminée
   * `IncidentContext` (définie en section 11.3 CM-ID2) AVANT la première PR
   * de TACHE-061 mergée. L'interdiction de plaintext sensible (INV-SEC-02)
   * s'applique dès maintenant, même si le type libre l'autorise syntaxiquement.
   */
  context: Record<string, unknown>; // À remplacer par IncidentContext — cf. CM-ID2
}
```

```typescript
// src/background/services/incident-service.ts

import type { M7IncidentRecord, M7IncidentType, M7IncidentSeverity } from '@/shared/types/diagnostics';

/** Borne maximale du registre (FIFO) */
export const MAX_INCIDENTS = 500;

export class IncidentService {
  constructor(private readonly db: IDBDatabase) {}

  /**
   * Insère un incident dans le store 'm7_incidents'.
   * Si le nombre d'entrées atteint MAX_INCIDENTS, supprime l'entrée
   * la plus ancienne (id le plus bas) avant insertion — purge FIFO.
   *
   * @param type     - Type de l'incident (M7IncidentType)
   * @param severity - Sévérité
   * @param context  - Objet JSON contextuel (doit être JSON.stringify-able)
   */
  async log(
    type: M7IncidentType,
    severity: M7IncidentSeverity,
    context: Record<string, unknown>, // À remplacer par IncidentContext — cf. CM-ID2
  ): Promise<void>;

  /**
   * Retourne les N derniers incidents, triés par ts décroissant.
   * Utilisé par les tests et une future page de diagnostic.
   */
  async getLast(n: number): Promise<M7IncidentRecord[]>;

  /**
   * Retourne le nombre total d'entrées dans le store.
   * Utile pour les assertions de test (invariant ≤ 500).
   */
  async count(): Promise<number>;
}
```

---

## 4. Schéma IndexedDB — Migration vers la version 2

### 4.1 Décision de version

La base `sentinel-nudge-db` est actuellement en **version 1** (5 stores définis dans `MIGRATIONS[1]` de `storage-service.ts`). L'ajout du store `m7_incidents` nécessite une **migration vers la version 2**. Le pattern de migration existant dans `StorageService.initDB()` est réutilisé.

### 4.2 Migration v2

```typescript
// À ajouter dans src/background/storage-service.ts, dans l'objet MIGRATIONS :

2: (db: IDBDatabase) => {
  // Store m7_incidents — registre circulaire des anomalies M7
  const incidentsStore = db.createObjectStore('m7_incidents', {
    keyPath: 'id',
    autoIncrement: true,
  });
  // Index sur ts pour les requêtes "derniers N incidents" et la purge FIFO
  incidentsStore.createIndex('ts', 'ts');
  // Index sur type pour filtrer par catégorie d'incident
  incidentsStore.createIndex('type', 'type');
},
```

Et `DB_VERSION` passe de `1` à `2`.

### 4.3 Schéma résultant (version 2)

| Store | Clé primaire | Index | Usage |
|-------|-------------|-------|-------|
| `events` | `id` (autoIncrement) | `timestamp`, `module` | Événements nudge (90j) |
| `password_hashes` | `id` (autoIncrement) | `tag`, `domain_hash`, `first_seen` | Hashes M7 (FIFO 100) |
| `quiz_sessions` | `id` (autoIncrement) | `module`, `quiz_date` | Sessions quiz M6 |
| `weekly_scores` | `week_key` (YYYY-Www) | — | Scores M3 hebdo |
| `whitelist` | `[domain_hash, module]` | `module` | Suppression list |
| `m7_incidents` | `id` (autoIncrement) | `ts`, `type` | **NOUVEAU** Registre incidents M7 |

### 4.4 Migration depuis "aucune DB"

Si un utilisateur installe l'extension pour la première fois avec cette version (version 2 d'emblée), `onupgradeneeded` part de `oldVersion=0` et applique les migrations 1 puis 2 dans l'ordre — le pattern existant dans `StorageService.initDB()` le gère sans modification.

---

## 5. Intégration dans le code existant

### 5.1 `service-worker.ts` — Points d'instrumentation

| Moment | Action à ajouter |
|--------|-----------------|
| Début de la boot sequence (IIFE module-level) | `heartbeatService.onBootStart()` |
| Après `loadCryptoKey()` → clé absente | `incidentService.log('boot_fail', 'error', { hint: 'key absent', boot_count })` |
| Après `canaryService.verify()` → ok | `heartbeatService.onBootSuccess()` |
| Après `canaryService.verify()` → échec | `incidentService.log('canary_failed', 'error', { reason })` + régénération clé + `canaryService.init()` |
| `onFirstInstall()` — après génération clé | `canaryService.init(cryptoKey)` |
| `onFirstInstall()` — fin de séquence | `heartbeatService.onBootSuccess()` |
| `chrome.runtime.onInstalled (update)` | `canaryService.verify()` + traitement résultat |
| `chrome.runtime.onStartup` | `canaryService.verify()` + traitement résultat |

### 5.2 `m7-handler.ts` — Points d'instrumentation

| Moment | Action à ajouter |
|--------|-----------------|
| Fin de `handlePasswordSubmitted()` → réutilisation détectée | `heartbeatService.onDetection()` |
| `catch` de `handlePasswordSubmitted()` | `incidentService.log('submit_detect_fail', 'error', { message })` |
| Consommation de `pending_m7_toast` sans affichage confirmé | `incidentService.log('toast_orphan', 'warn', { domain_hash, ts })` |

### 5.3 Injection des services dans `service-worker.ts`

```typescript
// Nouvelles instanciations à ajouter après les services existants :
const heartbeatService = new HeartbeatService();
const canaryService    = new CanaryService(cryptoService);
// IncidentService reçoit la référence IDBDatabase après initDB() :
// const incidentService = new IncidentService(db);
// → instanciation différée après storageService.initDB(), qui expose getDB() via un getter public
```

Note : `IncidentService` a besoin d'un accès direct à `IDBDatabase`. Il est proposé d'ajouter une méthode `getDB(): IDBDatabase` publique à `StorageService`, ou d'exposer `IncidentService` comme une méthode déléguée de `StorageService` (option à arbitrer — voir section 9).

---

## 6. Invariants

Les invariants suivants sont vérifiables en test et constituent le contrat comportemental des trois mécanismes.

| # | Invariant | Implication |
|---|-----------|-------------|
| INV-01 | `diagnostics.m7.ready === true` implique `diagnostics.m7.canary_verified === true` | Jamais de `ready=true` sans canary vérifié |
| INV-02 | `boot_count` est monotone croissant — ne peut pas diminuer entre deux lectures successives | Toute valeur lue inférieure à la précédente indique une corruption du storage |
| INV-03 | Le store `m7_incidents` contient au maximum `MAX_INCIDENTS` (500) entrées à tout moment | La purge FIFO doit s'exécuter avant chaque insertion si `count >= 500` |
| INV-04 | `canary_ciphertext` et `canary_iv` sont tous les deux absents ou tous les deux présents — jamais un seul | Init atomique : écrire les deux dans un seul `chrome.storage.local.set()` |
| INV-05 | Si `ready=false` depuis plus de 3 600 000 ms, le badge TACHE-062 est affiché (consommé par popup) | `last_boot_ts` doit être mis à jour même en cas d'échec, pour que la durée soit mesurable |
| INV-06 | `canary_ciphertext` et `canary_iv` sont stockés sous forme `Array<number>` — jamais `ArrayBuffer` ni `Uint8Array` | Règle P-018, vérifiable par mock JSON-strict (TACHE-060) |

### 6bis. Invariants sécurité (ajout Architecte sécurité)

Les invariants INV-SEC-XX renforcent la posture cryptographique et la traçabilité forensique. Ils sont **obligatoirement** vérifiés par tests dédiés en TACHE-059.

| # | Invariant | Implication / Justification |
|---|-----------|-----------------------------|
| INV-SEC-01 | `canary_iv` est généré par `crypto.getRandomValues(new Uint8Array(12))` à chaque appel de `canaryService.init()` et n'est **jamais réutilisé** pour chiffrer une autre donnée (password_hash, event, etc.) — l'espace de noms des IV canary est strictement disjoint de celui des IV métier | Un IV réutilisé avec la même clé AES-GCM casse la confidentialité ET l'authenticité (bien connu : catastrophic IV misuse). Le canary ayant un plaintext connu (open-source), un IV partagé avec un payload métier exposerait ce payload. |
| INV-SEC-02 | Le champ `context` d'un incident ne contient JAMAIS : (a) un mot de passe en clair ou sa longueur exacte (longueur > 0 seule acceptée), (b) un token/cookie/secret, (c) une URL complète avec query string ou fragment, (d) un `domain_hash` associé à un mot de passe saisi moins de 5 s auparavant (risque de corrélation temporelle) | Le registre IndexedDB n'est pas chiffré (accessible par tout contexte de l'extension et via DevTools en mode développeur). Minimisation stricte = seul champ structuré ouvert : `hint` (string courte, non sensible), `boot_count` (entier), `reason` (enum), `code_path` (label). |
| INV-SEC-03 | Toute régénération de clé AES-256-GCM doit logger un incident `type='key_regenerated'` (nouveau type à ajouter à `M7IncidentType`), `severity='error'`, `context={ trigger: 'boot_fail' \| 'canary_failed' \| 'decrypt_failed', previous_boot_count: N, hashes_purged_count: M }` **AVANT** l'écrasement de l'ancienne clé et de la base `password_hashes` | Traçabilité forensique : en cas d'incident utilisateur ("M7 ne détecte plus rien"), l'horodatage et la cause racine de toute régénération doivent être reconstituables. Écrire APRÈS la purge rendrait l'incident inutilisable si l'IDB est elle-même corrompue. |
| INV-SEC-04 | Les incidents `severity='error'` ne sont **jamais purgés** par la purge FIFO tant que le store contient > 50 entrées non-error purgeables. La purge FIFO cible en priorité les `severity='info'` puis `severity='warn'` ; la suppression d'un `severity='error'` n'intervient que si 100% du store est composé d'entrées `error` (cas pathologique) | Mitigation de la vulnérabilité "DoS par saturation" : un attaquant local capable de provoquer des incidents bénins (ex. spam de `toast_orphan`) ne peut pas masquer un `canary_failed` ou `boot_fail` antérieur. |
| INV-SEC-05 | Le type d'incident `key_regenerated` est ajouté à `M7IncidentType` et à la liste documentée en section 3.3 | Prérequis technique de INV-SEC-03. |

---

## 7. Plan de tests (scénarios pour TACHE-059)

Les scénarios ci-dessous correspondent aux tests unitaires/intégration à produire en TACHE-059. Ils reprennent la notation TC-M7-XX du PV post-mortem.

| ID | Scénario | Mécanisme | Résultat attendu |
|----|----------|-----------|-----------------|
| TC-M7-13 | Boot SW avec storage vide (premier install) | Canary + Heartbeat | `canaryService.init()` appelé, `ready=true`, `boot_count=1`, canary stocké en `Array<number>` |
| TC-M7-14 | Boot SW avec clé présente et canary valide | Canary + Heartbeat | `verify()` → `ok: true`, `ready=true`, `canary_verified=true`, aucun incident loggé |
| TC-M7-15 | Boot SW avec clé présente mais canary absent | Canary + Heartbeat | `verify()` → `ok: false, reason: 'absent'`, `init()` appelé, `ready=true` si re-verify OK |
| TC-M7-16 | Boot SW avec clé corrompue (ArrayBuffer brut au lieu d'Array<number>) | Canary | `verify()` → `ok: false, reason: 'decrypt_failed'`, incident `canary_failed` loggé, clé régénérée |
| TC-M7-17 | Boot SW normal puis deuxième boot (réveil SW) | Heartbeat | `boot_count` incrémenté, `last_boot_ts` mis à jour |
| TC-M7-18 | Détection de réutilisation via `handlePasswordSubmitted()` | Heartbeat | `last_detection_ts` mis à jour dans les 100ms suivant le retour |
| TC-M7-19 | Exception dans `handlePasswordSubmitted()` | Registre | Incident `submit_detect_fail` inséré, `severity='error'`, `context.message` non vide |
| TC-M7-20 | Insertion de 501 incidents consécutifs | Registre | Après la 501e insertion, `count()` retourne exactement 500 (purge FIFO) |
| TC-M7-21 | Lecture du heartbeat quand `diagnostics.m7` est absent de storage | Heartbeat | Retourne un objet par défaut : `{ ready: false, last_boot_ts: 0, last_detection_ts: null, boot_count: 0, canary_verified: false }` |
| TC-M7-22 | Vérification INV-04 : `canary_ciphertext` présent mais `canary_iv` absent | Canary | `verify()` retourne `ok: false, reason: 'absent'`, `init()` déclenché |
| TC-M7-23 | Vérification INV-06 : canary stocké contient des `Array<number>`, pas d'`ArrayBuffer` | Canary | `JSON.parse(JSON.stringify(stored))` ne lève pas d'exception |
| TC-M7-24 | Migration DB : base existante v1 ouverte en v2 | IndexedDB | Store `m7_incidents` créé, données v1 préservées, `IncidentService` opérationnel |
| TC-M7-SEC-25 | Vérification INV-SEC-01 : deux `init()` successifs produisent deux IV distincts (détection de réutilisation) | Canary | Lecture storage après deux init() consécutifs → `canary_iv` différent à chaque init |
| TC-M7-SEC-26 | Vérification INV-SEC-02 : injection d'un mot de passe dans `context` rejetée par validation | Registre | Un schéma de validation (liste blanche de clés) rejette `context={ password: '...' }` au log |
| TC-M7-SEC-27 | Vérification INV-SEC-03 : régénération clé log incident `key_regenerated` AVANT purge | Registre | Ordre observable : `incidents.getLast(1)` contient `key_regenerated` avec timestamp < purge `password_hashes` |
| TC-M7-SEC-28 | Vérification INV-SEC-04 : saturation par 600 incidents `toast_orphan` info ne purge aucun `error` antérieur | Registre | Après saturation, les entrées `severity='error'` restent présentes, seuls les `info`/`warn` sont purgés |
| TC-M7-SEC-29 | Vérification CM-EOP1 : canary absent/corrompu mais clé AES fonctionnelle (déchiffrement d'une entrée existante réussit) | Canary + Crypto | La clé AES n'est PAS régénérée. Le canary est ré-initialisé à partir de la clé existante. Un incident `canary_reinit` severity=warn est logué. Les données chiffrées existantes restent déchiffrables. |

---

## 8. Impact performances (budget cold-start MV3)

Le Service Worker MV3 est contraint à un cold-start efficace. Le budget total boot acceptable est **< 50ms** (mesurable via `performance.now()` autour de la boot sequence).

| Opération ajoutée | Estimation | Justification |
|-------------------|-----------|---------------|
| `HeartbeatService.onBootStart()` | ~2ms | Un `chrome.storage.local.get` + `set` — opérations I/O locales rapides |
| `CanaryService.verify()` — cas OK | ~5–8ms | Un `chrome.storage.local.get` (2 clés) + `SubtleCrypto.decrypt` (AES-GCM ~16 bytes) + comparaison string |
| `CanaryService.verify()` — cas échec + régénération | ~15–20ms | `generateKey` + `exportKey` + `encrypt` + `storage.set` supplémentaire — chemin exceptionnel |
| `HeartbeatService.onBootSuccess()` | ~1ms | Un `chrome.storage.local.set` |
| **Total cas nominal** | **~10ms** | Dans le budget |
| **Total cas dégradé** | **~25ms** | Dans le budget |

**Mesure à instrumenter** : log `console.info` JSON avec `duration_ms` en fin de séquence boot pour valider le budget en recette.

Aucune bibliothèque externe n'est introduite. Toutes les opérations reposent sur :
- `SubtleCrypto` (natif, déjà en usage) — conforme I-001
- `chrome.storage.local` (natif MV3) — conforme I-001
- `IndexedDB` (natif, déjà en usage) — conforme I-001

---

## 9. Décisions arbitrées (2026-04-16)

| ID | Question | Options | Recommandation |
|----|---------|---------|---------------|
| ARB-061-01 | **Couplage IncidentService / StorageService** : `IncidentService` a besoin de `IDBDatabase`. Faut-il (A) exposer `getDB(): IDBDatabase` public dans `StorageService`, ou (B) déléguer `logIncident()` comme méthode de `StorageService` lui-même (pas de nouveau service), ou (C) `IncidentService` ouvre sa propre connexion IDB (risque de double connexion) ? | A : couplage léger — `StorageService` reste propriétaire de la DB. B : cohérence — moins de services. C : déconseillé (double connexion IDB = risque de blocage). | **Option A** — cohérent avec les patterns existants et moins intrusif sur `StorageService`. |
| ARB-061-02 | **Comportement si `IncidentService` n'est pas encore disponible au boot** (avant `initDB()`) : doit-on accepter les incidents perdus ou tamponner dans un buffer mémoire ? | A : accepter la perte (incidents de boot non tracés). B : buffer mémoire de 10 entrées max, flush après `initDB()`. | **Option B** recommandée — les incidents de boot (notamment `boot_fail` et `canary_failed`) sont les plus importants à tracer. Coût faible. |
| ARB-061-03 | **Borne MAX_INCIDENTS** : 500 entrées. Chaque entrée pèse ~200–500 octets (JSON). Cela représente 100–250 Ko. Acceptable ? | A : 500 (proposition courante). B : 100 (plus conservateur — même valeur que MAX_PASSWORD_HASHES). | **Option A** (500) si l'espace disque ne pose pas de contrainte — les incidents restent rares en fonctionnement nominal. À valider par le Commanditaire si contrainte de stockage identifiée. |

### 9bis. Avis sécurité sur les arbitrages (Architecte sécurité)

**ARB-061-01 — Couplage IncidentService / StorageService**

L'Architecte sécurité confirme **l'Option A** (getter public `getDB()`) avec la nuance suivante : A préserve mieux l'**isolation des responsabilités** (SRP) et réduit la surface d'attaque interne en gardant `IncidentService` petit, auditablement focal, et avec une API minimale (log / getLast / count). L'Option B (fusion dans `StorageService`) concentrerait dans un seul objet la gestion de données métier (hashes, events) ET la journalisation forensique — une mutation accidentelle dans la partie métier pourrait casser la journalisation, ou inversement. L'Option C (double connexion) est rejetée pour les mêmes raisons (R-009 du registre : SW tué pendant écriture concurrente = corruption). **Recommandation sécurité : Option A, validée.**

**ARB-061-02 — Buffer mémoire pré-initDB**

L'Architecte sécurité recommande **fermement l'Option B** (buffer mémoire, flush après `initDB()`). Justification sécurité :
- Les incidents les plus **critiques pour la posture de sécurité** (`boot_fail`, `canary_failed`, future `key_regenerated` INV-SEC-03) se produisent précisément **avant** que `initDB()` ait terminé. L'Option A (perte silencieuse) violerait l'exigence de non-répudiation / traçabilité issue de ISO 27001 A.8.15 Logging.
- Coût mémoire : 10 entrées × ~500 octets = 5 Ko, négligeable dans le contexte SW MV3.
- Contrainte à ajouter : le buffer doit être **borné strict** (drop le plus ancien après 10 entrées) et **flushé immédiatement** au premier tick après `initDB()` pour limiter la fenêtre de perte en cas de kill SW. **Recommandation sécurité : Option B, validée avec la contrainte de borne.**

**ARB-061-03 — Borne MAX_INCIDENTS (500 vs 100)**

L'Architecte sécurité recommande **l'Option A (500)** pour des raisons de **rétention forensique**. Justification :
- 100 entrées se remplissent en quelques minutes si un incident récurrent (ex. boucle `toast_orphan` suite à un bug) se déclenche : la fenêtre d'analyse post-incident serait trop courte. 500 entrées donnent une profondeur d'historique de plusieurs jours en fonctionnement normal.
- Le coût disque (100–250 Ko) est négligeable au regard du stockage total d'une extension navigateur (quota IDB par défaut = plusieurs centaines de Mo).
- Condition impérative : **INV-SEC-04** (priorité severity) doit être implémenté pour que la borne ne devienne pas un vecteur d'effacement des incidents critiques. Sans INV-SEC-04, la borne 500 serait au contraire plus vulnérable que 100 (plus grand espace à saturer avant que ce soit visible). **Recommandation sécurité : Option A (500) conditionnée à l'implémentation d'INV-SEC-04.**

### 9ter. Décisions du Commanditaire (2026-04-16)

| Arbitrage | Décision | Conformité aux recommandations |
|-----------|----------|-------------------------------|
| **ARB-061-01** | **Option A** — getter `getDB()` public sur `StorageService`, `IncidentService` autonome | ✅ Conforme Archi log + Archi sécu |
| **ARB-061-02** | **Option B** — buffer mémoire borné 10 entrées, flush au premier tick après `initDB()` | ✅ Conforme Archi log + Archi sécu |
| **ARB-061-03** | **Option A** — borne MAX_INCIDENTS = 500, INV-SEC-04 **prérequis impératif non négociable** | ✅ Conforme Archi log + Archi sécu |

Les décisions sont figées. Le Développeur peut démarrer l'implémentation de TACHE-061 en conformité avec ce mini-DAT v1.1.

---

## 10. Risques et questions pour l'Architecte sécurité

Les points suivants sont listés ici pour enrichissement par l'Architecte sécurité lors de la revue de ce mini-DAT :

| ID | Risque / Question |
|----|------------------|
| RS-061-01 | **Confidentialité du registre d'incidents** : les entrées `context` peuvent contenir des `domain_hash` (pseudonymisés) et des messages d'erreur. Y a-t-il un risque de fuite d'information si l'IDB est lue par une autre extension ou via DevTools ? Mitigation envisagée : chiffrer le champ `context` avec la clé AES M7 ? |
| RS-061-02 | **Canary comme oracle de chiffrement** : si un adversaire peut lire `canary_ciphertext` + `canary_iv` depuis chrome.storage.local, et connaît le `CANARY_PLAINTEXT` (code open-source), il peut confirmer qu'il possède la bonne clé. Est-ce un risque dans le modèle de menace ? (Rappel : D-SEC-004 considère déjà la clé accessible à toute extension ayant accès au profil.) |
| RS-061-03 | **Régénération silencieuse de la clé** : la régénération sur `canary_failed` invalide tous les hashes M7 précédents (déchiffrement impossible). Cela crée une fenêtre de cécité M7. Ce comportement est acceptable (priorité : M7 reste fonctionnel) mais doit être tracé. Faut-il notifier l'utilisateur via un badge ou un incident visible dans le futur tableau de bord ? |
| RS-061-04 | **`boot_count` comme vecteur de fingerprinting** : si `diagnostics.m7` est accessible à une page web via une fuite (ne devrait pas l'être — chrome.storage inaccessible hors extension), `boot_count` serait un identifiant semi-stable. Risque théorique à confirmer nul. |
| RS-061-05 | **Atomicité de l'init canary** : `canary_ciphertext` et `canary_iv` sont écrits dans un seul `chrome.storage.local.set()` (INV-04). Si le SW est tué entre les deux écritures (si elles étaient séparées), le registre serait incohérent. Confirmer que l'écriture atomique via un seul objet est garantie par Chrome MV3. |

---

## 11. Analyse de menaces (STRIDE ciblée — Architecte sécurité)

L'analyse STRIDE ci-dessous couvre les trois composants introduits par TACHE-061 (Heartbeat, Canary, Registre d'incidents). Elle complète le STRIDE global du DAT P3 en se focalisant sur les nouveaux actifs et flux. Elle alimente les risques **R-M7-05 à R-M7-07** ajoutés à RISQUES.md.

### 11.1 Spoofing / Tampering du canary

**Scénario** : un adversaire local (autre extension installée avec permission `storage`, malware ayant accès au profil Chrome, voire l'utilisateur lui-même via DevTools de l'extension) peut lire puis **réécrire** `canary_ciphertext` et `canary_iv` dans `chrome.storage.local`. Si l'adversaire possède (ou a remplacé) la clé AES M7, il peut forger un canary valide et maintenir artificiellement `ready=true` alors que la clé utilisée n'est plus la clé légitime d'origine.

**Analyse de risque** : dans le modèle de menace acté (R-003 : profil Chrome compromis = clé compromise, risque accepté), le canary n'apporte **aucune protection d'intégrité supplémentaire contre un adversaire qui a la clé**. Son rôle est strictement de détecter des états **non-malveillants** (clé absente, clé corrompue par bug de sérialisation P-018, storage partiellement purgé). Il ne doit pas être présenté comme un mécanisme anti-tampering.

**Contre-mesures** :
- CM-C1 : documenter explicitement dans le DAT et dans le code (JSDoc de `CanaryService`) que le canary est un **détecteur d'intégrité logicielle, pas d'intégrité adversariale**. Tout commentaire laissant entendre "le canary prouve que la clé n'a pas été altérée" doit être supprimé.
- CM-C2 : ne jamais utiliser le résultat du canary comme substitut à un contrôle d'authenticité métier. `canary_verified=true` ne doit **pas** conduire à relâcher d'autres contrôles (ex. ne pas skipper la vérification AES-GCM du hash M7).
- CM-C3 (refus) : le HMAC du canary avec une "clé maître" séparée est rejeté car il ne ferait que déplacer le problème (la clé maître serait stockée au même endroit).

### 11.2 Tampering du registre d'incidents

**Scénario** : IndexedDB de l'extension est accessible en **lecture ET écriture** à tous les contextes de l'extension (service worker, content scripts via messagerie, popup, DevTools de l'extension). Un bug fonctionnel dans un autre module, ou une extension tierce ayant acquis les droits de l'extension via une vulnérabilité d'exécution, pourrait **altérer silencieusement** les entrées (modifier `severity`, supprimer des entrées ciblées, réécrire `context`).

**Analyse de risque** : le registre sert à des fins de **diagnostic local et de forensique post-incident utilisateur** (reconstitution de cause racine par le Commanditaire ou un RSSI tiers). Il n'a pas vocation à être une **preuve juridique** (non-répudiation). Le niveau d'assurance visé est "best-effort traçabilité", pas "tamper-evident".

**Contre-mesures** :
- CM-T1 : documenter explicitement dans le schéma que le registre n'est PAS un journal inviolable. Le rôle attendu est "détecter un motif d'anomalie", pas "prouver qu'une anomalie s'est produite à l'instant t exact".
- CM-T2 : **chaîne de hachage rejetée** pour TACHE-061. Une hash chain (entrée[n].prev_hash = H(entrée[n-1])) offrirait une détection de tampering, mais : (a) le coût CPU sur chaque insertion est notable (SubtleCrypto.digest), (b) un attaquant qui peut réécrire la DB peut aussi recalculer la chaîne, (c) sans ancrage externe (Sigstore, TSA), la chaîne ne prouve rien face à un attaquant avec les droits extension. **Risque accepté** (R-M7-07 partiel).
- CM-T3 : implémenter **INV-SEC-04** (séverité-priorisée FIFO) qui protège contre l'effacement par saturation — la menace la plus réaliste (pas de réécriture, juste du spam).
- CM-T4 : les seules écritures au store `m7_incidents` se font via `IncidentService.log()`. Aucune API d'édition n'est exposée. Tout accès direct depuis un autre module est un écart d'architecture à refuser en revue de code.

### 11.3 Information Disclosure (fuite d'information par le registre)

**Scénario** : le champ `context: Record<string, unknown>` accepte un objet libre. Un développeur, pour faciliter un debug, pourrait y logger : un mot de passe (même tronqué), un URL complet avec token dans la query string, un cookie, un hash intermédiaire pré-sel, une empreinte comportementale permettant de corréler l'utilisateur, etc.

Une extension tierce ou un attaquant ayant accès à l'IDB peut alors **exfiltrer** ces données — violation RGPD (fuite de donnée personnelle) et violation de la politique "aucune télémétrie" du projet.

**Contre-mesures** :
- CM-ID1 : **INV-SEC-02** formalise l'interdiction. Toute PR qui ajoute un appel `incidentService.log(...)` doit passer par revue de code explicite du contenu de `context`.
- CM-ID2 : restreindre par construction. Plutôt que `Record<string, unknown>` libre, typer `context` comme une union discriminée par `type` d'incident :
  ```typescript
  type IncidentContext =
    | { type: 'boot_fail'; hint: 'key_absent' | 'import_failed'; boot_count: number }
    | { type: 'canary_failed'; reason: 'absent' | 'decrypt_failed' | 'mismatch' }
    | { type: 'submit_detect_fail'; code_path: string }  // pas de message, juste un identifiant de chemin
    | ...
  ```
  Cette signature **empêche à la compilation** l'introduction de champs libres susceptibles de contenir du plaintext.
- CM-ID3 : règle ESLint custom (à préciser par le Développeur + DevSecOps) interdisant `message: err.message` ou `String(err)` dans un `context` d'incident (l'erreur native peut contenir le plaintext qui a provoqué l'exception).
- CM-ID4 : **politique de minimisation RGPD** — transmettre ce document au DPO pour confirmation que le registre, ainsi minimisé, reste compatible avec l'AIPD M7 (pas de donnée personnelle, pas de pseudonymes adossés à un identifiant direct).

### 11.4 Denial of Service (saturation du registre)

**Scénario** : un attaquant local (ou un bug) provoque une cadence élevée d'incidents bénins (ex. boucle sur `toast_orphan`, reconnection IDB en échec, etc.). La purge FIFO à 500 entrées efface les incidents critiques antérieurs (`canary_failed`, `boot_fail`) → **masquage forensique**.

**Analyse de risque** : vraisemblance modérée (le déclenchement requiert soit un bug interne, soit un adversaire ayant déjà un pied dans l'extension). Impact significatif : perte de la capacité d'analyse post-incident.

**Contre-mesures** :
- CM-DOS1 : **INV-SEC-04** (priorité severity) — la purge cible d'abord `info`, puis `warn`, puis seulement `error` en dernier recours. Rend le vecteur "saturation par bruit" inefficace tant qu'il reste des entrées non-error purgeables.
- CM-DOS2 : **rate-limit applicatif** — `IncidentService.log()` applique un coalescing interne : si le même couple `(type, severity)` a été loggé < 1 seconde auparavant avec un `context` structurellement identique, incrémenter un compteur `repeat_count` dans la dernière entrée au lieu d'en créer une nouvelle. Bornes : max 10 coalescings consécutifs, au-delà on loggue une nouvelle entrée. **À ajouter à la spec de `log()`**.
- CM-DOS3 : les incidents `severity='error'` sont **horodatés au log et jamais au repeat** — pas de coalescing pour les erreurs afin de préserver le timestamp précis de chaque occurrence critique.

### 11.5 Elevation of Privilege (régénération clé AES comme vecteur d'effacement)

**Scénario** : le flux actuel est **canary_failed → régénération immédiate de la clé AES → perte des `password_hashes` chiffrés avec l'ancienne clé**. Un attaquant local qui peut **corrompre uniquement le canary** (sans accéder à la vraie clé) peut déclencher la régénération et ainsi **effacer** la base M7 — amnésie forcée, plus aucune détection de réutilisation pendant plusieurs jours (le temps que l'utilisateur ressaisisse ses mots de passe). C'est une **élévation indirecte** : l'attaquant passe d'"écriture canary" à "effacement mémoire M7".

**Analyse de risque** : vulnérabilité réelle mais ciblée. L'attaquant doit déjà pouvoir écrire dans `chrome.storage.local` de l'extension (R-003 : s'il peut, il a aussi la clé, donc il peut lire la base directement — l'effacement n'a plus d'intérêt offensif, plutôt de déni). La menace principale reste la **fausse positive de régénération** consécutive à un bug (P-018 rééditée), pas un scénario adversarial pur.

**Contre-mesures — distinguer "clé vraiment perdue" vs "canary corrompu mais clé OK"** :
- CM-EOP1 : **vérification secondaire avant régénération**. Avant de conclure `clé perdue → régénération`, tenter de déchiffrer une entrée `password_hashes` existante avec la clé courante :
  - Si un `password_hash` existe et se déchiffre avec la clé → **la clé est OK**, seul le canary est corrompu → re-`canaryService.init()` AVEC LA MÊME CLÉ, pas de régénération, log `severity='warn'` type=`canary_corrupted_key_ok`.
  - Si la base `password_hashes` est vide (pas de test possible) → régénération acceptable car rien à perdre.
  - Si un `password_hash` existe et ne se déchiffre PAS non plus → la clé est effectivement perdue → régénération + log `key_regenerated` (INV-SEC-03).
- CM-EOP2 : compter le nombre de régénérations en fenêtre glissante (ex. 30 jours, déjà évoqué en R-M7-04). Plus de 2 régénérations / 30 j → notifier l'utilisateur via badge persistant + inciter à signaler via GitHub issue (alerte comportementale anormale).
- CM-EOP3 : INV-SEC-03 garantit la traçabilité forensique de chaque régénération (cause racine + compte d'entrées purgées).

**Impact sur la section 5.1** : la ligne "Après `canaryService.verify()` → échec" doit être complétée par la logique CM-EOP1 (test de la clé sur une entrée existante avant de régénérer). Le Développeur intégrera ce changement en TACHE-061 avec un test TC-M7-SEC-29 : "canary absent mais clé OK → re-init sans régénération".

---

## 12. Références ISO/CEI 27001:2022 — Annexe A

Les mesures organisationnelles et techniques de ce mini-DAT s'appuient sur les contrôles suivants. Elles seront consignées au fur et à mesure dans le référentiel de sécurité projet (à créer : `docs/securite/referentiel-iso27001.md`).

| Contrôle | Nom | Lien avec TACHE-061 |
|---------|-----|---------------------|
| **A.5.7** | Threat intelligence | Le STRIDE ciblé (section 11) formalise la connaissance des menaces applicables au canary et au registre. |
| **A.8.8** | Management of technical vulnerabilities | P-016 / P-018 sont des vulnérabilités techniques (silencieuses) ; le heartbeat + canary en sont la mitigation détective. |
| **A.8.12** | Data leakage prevention | INV-SEC-02 et CM-ID1/CM-ID2/CM-ID3 — interdiction structurelle de plaintext sensible dans `context` d'incident. |
| **A.8.15** | Logging | Le registre d'incidents IndexedDB + INV-SEC-03/INV-SEC-04 — assurer la journalisation des événements de sécurité avec protection contre l'effacement des entrées critiques. |
| **A.8.16** | Monitoring activities | Le heartbeat `diagnostics.m7` + badge TACHE-062 — matérialisation de l'état de santé M7, détection de dérive (`ready=false > 1h`, `boot_count > 50/h`). |
| **A.8.24** | Use of cryptography | INV-SEC-01 (non-réutilisation d'IV AES-GCM) — règle cryptographique essentielle, alignée avec les recommandations NIST SP 800-38D. |
| **A.8.28** | Secure coding | INV-SEC-02 en tant que règle de codage (union typée discriminée), CM-ID3 (lint rule) — prévention des fuites d'information par les journaux. |
| **A.5.24 / A.5.26** | Information security incident management / response | La structure `M7IncidentRecord` et la distinction `info / warn / error` outillent la réponse à incident côté support utilisateur. |

Note : le projet n'étant pas soumis à une certification ISO 27001 formelle (extension open-source communautaire), ces références servent de **boussole méthodologique** et non d'exigence de conformité auditée. Elles seront reprises dans le référentiel de sécurité projet lors de sa création.

---

## 13. Références

| Document | Lien |
|----------|------|
| PV post-mortem M7 | `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md` |
| Code : service-worker.ts | `src/background/service-worker.ts` |
| Code : m7-handler.ts | `src/background/handlers/m7-handler.ts` |
| Code : crypto-service.ts | `src/background/crypto-service.ts` |
| Code : storage-service.ts | `src/background/storage-service.ts` |
| TECH_STACK.md | `.claude/TECH_STACK.md` |
| DAT P3 | `docs/p3-dat-v1.1.md` |
| Registre des risques | `.claude/RISQUES.md` (R-M7-05, R-M7-06, R-M7-07 ajoutés 2026-04-16) |
| ISO/CEI 27001:2022 | Annexe A — contrôles référencés en section 12 |
| NIST SP 800-38D | Recommandation for Block Cipher Modes of Operation: Galois/Counter Mode (GCM) — support de INV-SEC-01 |
