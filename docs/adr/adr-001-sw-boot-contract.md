# ADR-001 — SW-BOOT-CONTRACT

**Status** : Accepted  
**Date** : 2026-04-16  
**Auteur** : Architecte logiciel  
**Origine** : D-PM-01 (PV post-mortem M7, 2026-04-14)  
**Phase** : P5

---

## Contexte

Le post-mortem M7 (2026-04-14) a identifié la cause racine CR-1 : le Service Worker (SW) Sentinel Nudge s'initialisait de façon optimiste — il supposait que la clé AES, le canary et la config étaient présents et valides sans le vérifier.

Deux incidents critiques en découlent directement :

- **P-016** — `encryption_key_material` absent au premier réveil après une purge de storage : `registerModuleHandlers` n'était pas appelé, le handler M7 n'était jamais enregistré, et l'extension paraissait saine (pas d'erreur visible) alors qu'elle était muette. *Fail silent = fail open* en sécurité.
- **P-018** — La clé AES stockée sous forme `ArrayBuffer` n'était pas désérialisée correctement par `chrome.storage.local` : la clé était régénérée à chaque réveil du SW, rendant les hashes précédents illisibles et produisant un faux `no_reuse` systématique entre sessions.

Le fix de P-016 ajoute une auto-régénération de la clé, mais sans séquence formalisée, l'instrumentation, la validation et la migration restent laissées à chaque développeur. Le risque de régresser sur n'importe quel autre module ayant un prérequis storage est systémique.

Le principe **"contrat avant code"** imposé par le mini-DAT TACHE-061 (§1.2) généralise cette exigence à l'ensemble des handlers du SW.

---

## Décision

**Tout handler de Service Worker qui a un prérequis storage DOIT implémenter une séquence de boot en 4 étapes. Aucun code métier ne s'exécute avant que la séquence soit terminée et les invariants de boot vérifiés.**

Les 4 étapes obligatoires sont :

1. **Lire** — Charger la ou les valeurs critiques depuis `chrome.storage.local` ou IndexedDB. Traiter l'absence comme un cas normal (premier boot, storage purgé) et non comme une erreur bloquante.
2. **Valider** — Vérifier que les valeurs chargées respectent les invariants du module (type, longueur, cohérence). Un invariant non satisfait déclenche l'étape suivante, pas un crash silencieux.
3. **Régénérer / Migrer** — Si la validation échoue : régénérer la valeur manquante ou migrer le format obsolète. Logguer un incident *avant* d'écraser l'ancienne valeur (traçabilité forensique).
4. **Logger** — Émettre un incident structuré (JSON, `severity=error` pour les échecs critiques, `severity=warn` pour les dégradations mineures) et mettre à jour le `diagnostics.<module>` avec le résultat du boot.

---

## Conséquences

### Positives

- Élimine la classe d'incidents "fail silent au boot" : tout état invalide est détecté, journalisé et corrigé avant que le code métier soit atteint.
- Standardise l'instrumentation : tous les modules exposent un `diagnostics.<module>` homogène (voir R-BOOT-04), ce qui simplifie la surveillance et prépare le badge dégradé (TACHE-062).
- Produit un artefact de santé traçable par module (`diagnostics.m7`, puis `diagnostics.m2`, etc.) consultable dans DevTools sans outillage externe.
- Facilite les tests : chaque étape de la séquence est une unité testable indépendante (voir R-BOOT-03).

### Négatives

- **Coût cold-start** : ~10–25 ms par handler en raison des lectures `chrome.storage.local` supplémentaires (tolérable sur des boots qui se produisent toutes les 30 s d'inactivité au plus, non perceptibles par l'utilisateur).
- **Surface de code accrue** : chaque handler gagnant une séquence `initBoot()` (ou équivalent), la complexité de chaque fichier handler augmente d'environ 30–50 lignes.
- **Tests supplémentaires obligatoires** (R-BOOT-03) : un TC dédié par invariant allonge le plan de tests.

---

## Implémentation de référence

La TACHE-061 constitue l'implémentation canonique de cet ADR pour M7.

**Fichiers et lignes clés :**

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `src/background/service-worker.ts` | 376–547 | Boot sequence IIFE : étapes 1–6 (onBootStart → initDB → initService → loadCryptoKey → verify canary → onBootSuccess/Failure → registerModuleHandlers) |
| `src/background/service-worker.ts` | 379–380 | Étape 1 : `heartbeatService.onBootStart()` — état conservatif `ready=false` avant toute vérification |
| `src/background/service-worker.ts` | 388–426 | Étape 4–5a : clé absente → `incidentService.log('boot_fail', 'error', ...)` → régénération → `canaryService.init()` → `heartbeatService.onBootSuccess()` |
| `src/background/service-worker.ts` | 427–511 | Étape 5b : clé présente → `canaryService.verify()` → branchement CM-EOP1 (canary_reinit vs key_regenerated) |
| `src/background/service-worker.ts` | 529–536 | Catch global : `incidentService.log('boot_fail', ...)` + `heartbeatService.onBootFailure()` |
| `src/background/services/heartbeat-service.ts` | 99–111 | `onBootStart()` — lire + incrémenter `boot_count` + persister `ready=false` |
| `src/background/services/heartbeat-service.ts` | 121–131 | `onBootSuccess()` — persister `ready=true, canary_verified=true` |
| `src/background/handlers/m7-handler.ts` | 253–254 | `heartbeatService.onDetection()` — mise à jour `last_detection_ts` après détection |
| `src/background/handlers/m7-handler.ts` | 304–308 | `incidentService.log('submit_detect_fail', 'error', ...)` — incident sur erreur métier |

---

## Règles dérivées

### R-BOOT-01

Tout handler SW avec un prérequis storage (clé cryptographique, config critique, état de session) DOIT implémenter une fonction `initBoot()` (ou équivalente nommée clairement) qui exécute séquentiellement les 4 étapes : lire → valider → régénérer/migrer → logger. Cette fonction est appelée dans la boot sequence IIFE de `service-worker.ts`, avant `registerModuleHandlers()`.

### R-BOOT-02

Toute écriture de storage critique (clé AES, canary, tokens) DOIT logguer un incident `severity=error` dans le registre d'incidents si l'écriture échoue. Si une ancienne valeur est écrasée (régénération), l'incident DOIT être loggué **avant** l'écrasement, avec le contexte nécessaire à la forensique (ex. `boot_count`, `hashes_purged_count`). Application explicite d'**INV-SEC-03** (mini-DAT TACHE-061 §3.2) : ordre log-avant-écrasement non négociable — un incident `key_regenerated` doit pouvoir être corrélé post-mortem à la valeur qu'il a effacée. Référence : `service-worker.ts` lignes 411–416 (log `key_regenerated` avant `browser.storage.local.set`).

### R-BOOT-03

Tout invariant vérifié au boot DOIT avoir un test case (TC) dédié dans le plan de tests du module. Le TC couvre au minimum le scénario "valeur absente au boot" et "valeur corrompue au boot". L'injection directe dans le handler en contournant la séquence de boot est interdite dans les tests.

### R-BOOT-04

Tout handler publie un objet `diagnostics.<module>` dans `chrome.storage.local`, contenant au minimum les champs : `ready: boolean`, `last_boot_ts: number`, `boot_count: number`, `invariants_verified: boolean`. Ce champ est le prérequis pour le badge dégradé (TACHE-062) et pour la surveillance forensique.

### R-BOOT-05

L'étape 3 (régénérer / migrer) peut entraîner la perte irréversible de données chiffrées dépendant de la valeur régénérée (ex. régénérer la clé AES rend illisibles les `password_hashes` existants — P-018). Avant toute régénération d'une valeur cryptographique, le handler DOIT appliquer le pattern **CM-EOP1** (mini-DAT TACHE-061 §4.1) : vérifier la clé contre une donnée existante (canary déchiffrable OU échantillon d'une base dépendante) afin de distinguer *absence* (cas nominal : premier boot / purge délibérée → régénération + base vide cohérente) de *corruption* (canary présent mais indéchiffrable → incident `key_regenerated` severity=error + purge atomique des bases dépendantes + documentation forensique). L'écrasement inconditionnel sans vérification secondaire est interdit pour les valeurs cryptographiques. Référence : `service-worker.ts` lignes 427–511 (branchement canary_reinit vs key_regenerated), R-M7-04 (RISQUES.md).

---

## Analyse STRIDE

Périmètre de cet ADR : les **boot handlers SW** et leurs prérequis storage. L'analyse ci-dessous précise quelles classes de menaces STRIDE sont atténuées et lesquelles restent hors périmètre.

### Menaces atténuées

| Classe STRIDE | Scénario | Mesure apportée par l'ADR |
|---------------|----------|---------------------------|
| **Tampering** | Une entrée storage critique est corrompue (sérialisation cassée — P-018, purge partielle, manipulation par extension tierce avec permission `storage`) et le handler l'utilise en aveugle | Étape 2 (valider) + R-BOOT-05 : toute valeur chargée est validée contre un invariant avant usage ; la corruption déclenche un branchement tracé, pas un crash silencieux |
| **Repudiation** | Une régénération de valeur critique efface la trace de la valeur précédente sans possibilité de reconstituer l'historique | R-BOOT-02 + INV-SEC-03 : log `severity=error` **avant** écrasement, avec `boot_count`, `hashes_purged_count` et contexte forensique |
| **Information Disclosure** | Un fail silent au boot laisse l'extension "muette" mais considérée saine, sans signal à l'utilisateur ni au RSSI (P-016 : M7 non enregistré, aucun toast) | Étape 1 + 4 : absence de valeur = cas normal traité ; toute indisponibilité publiée dans `diagnostics.<module>` (R-BOOT-04) et exploitable par le badge dégradé (TACHE-062) |
| **Denial of Service** | Un boot optimiste sur un storage indisponible (IDB fermé, quota saturé) rend l'extension non fonctionnelle sans recouvrement | R-BOOT-01 + R-BOOT-04 : séquence formelle de boot + publication d'un état observable = condition nécessaire au recouvrement automatique (régénération, purge) et au signalement à l'utilisateur |

### Hors périmètre

| Classe STRIDE | Raison |
|---------------|--------|
| **Spoofing** | Non traité par un boot contract. L'authenticité de l'origine des messages handlers relève d'un futur ADR MessageRouter (numérotation à fixer lors de sa production) et de la vérification `chrome.runtime.id` côté content script. |
| **Elevation of Privilege** | Non directement traité. Le boot contract n'attribue pas de privilèges ; R-BOOT-05 (CM-EOP1) évite une *classe* d'élévation implicite via régénération non contrôlée, mais la gestion des permissions Chrome reste hors scope (cf. `manifest.json` + politique CSP de l'extension). |
| **Tampering par adversaire disposant d'un accès plénier au profil Chrome** | R-003 accepté (RISQUES.md) — le canary et les diagnostics sont des détecteurs d'intégrité logicielle, pas des mécanismes anti-adversaire root. Cohérent avec R-M7-05. |

### Secrets dans les exemples

Revue effectuée sur cet ADR : aucun plaintext (mot de passe, token, URL complète avec query string) n'est cité. Les références sont limitées aux noms de clés storage (`encryption_key_material`, `password_hashes`, `pending_m7_toast`) qui sont des identifiants de schéma, pas des valeurs. Conforme à **INV-SEC-02** (mini-DAT TACHE-061) appliqué à la documentation.

---

## Contrôles ISO 27001:2022 (Annexe A)

Cet ADR contribue à la couverture des contrôles suivants :

- **A.5.7 — Threat intelligence** : la séquence formelle de boot permet la détection structurée d'états invalides (P-016, P-018) et leur capitalisation en règles dérivées (R-BOOT-05 dérive de P-018), alimentant la base de menaces internes du projet.
- **A.8.15 — Logging** : R-BOOT-02 et R-BOOT-04 imposent la journalisation structurée des événements de boot (incidents `severity=error`, `diagnostics.<module>` exposé), conforme à l'exigence de logs horodatés et corrélables.
- **A.8.16 — Monitoring activities** : `diagnostics.<module>` (R-BOOT-04) est le point d'ancrage du monitoring côté utilisateur (badge dégradé TACHE-062) et côté développeur (DevTools), satisfaisant l'exigence de surveillance continue des systèmes.
- **A.8.25 — Secure development life cycle** : l'ADR formalise une exigence de cycle de vie du code SW (séquence de boot obligatoire), intégrée à la phase P5 du cycle en V et opposable aux nouveaux handlers (TACHE-085 à 091).
- **A.8.28 — Secure coding** : les règles R-BOOT-01 à R-BOOT-05 sont des règles de codage sécurisé explicites (validation avant usage, log avant écrasement, vérification avant régénération) alignées sur CWE-252 (Unchecked Return Value) et CWE-755 (Improper Handling of Exceptional Conditions).

---

## Exceptions

Les handlers **read-only sans prérequis storage** sont exemptés de R-BOOT-01 à R-BOOT-04. Un handler est considéré read-only sans prérequis s'il ne lit aucun état persisté pour décider d'agir (ex. un handler qui ne fait que valider un input utilisateur synchrone et retourner un résultat calculé localement). Cette exception doit être documentée en JSDoc dans le fichier handler.

---

## Alternatives rejetées

### Option A — Séquence de boot centralisée dans un singleton `BootManager`

Un objet `BootManager` centralise les vérifications pour tous les modules et les expose via une API `BootManager.isReady(moduleId)`.

**Rejetée** : crée un couplage fort entre tous les modules, rend les boots de modules indépendants impossibles, et complexifie les tests unitaires qui doivent désormais mocker un singleton global.

### Option B — Aucune règle formelle, conventions documentées uniquement

Les développeurs lisent le post-mortem et appliquent les leçons manuellement.

**Rejetée** : la saga M7 (7 commits correctifs) démontre que les conventions non outillées ne résistent pas au temps. L'objectif est de rendre le fail silent structurellement impossible, pas de le rendre moins probable.

---

## Plan B

Si les coûts cold-start se révèlent problématiques (mesures CI montrant > 50 ms ajoutés au boot sur des dispositifs lents) : regrouper les lectures `chrome.storage.local` des étapes 1 des différents handlers dans un seul appel `chrome.storage.local.get([...keys])` au niveau de la boot sequence IIFE, et distribuer les valeurs aux `initBoot()` individuels. Cela réduit le nombre d'aller-retours IPC sans changer la sémantique de la règle.
