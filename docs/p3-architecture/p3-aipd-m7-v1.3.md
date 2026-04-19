# Analyse d'Impact relative a la Protection des Donnees (AIPD) — Alerte mots de passe réutilisés (M7)

**Projet :** Sentinel Nudge
**Fonctionnalité couverte :** Alerte mots de passe réutilisés (référence interne : M7 — Nudge d'adoption gestionnaire de mots de passe)
**Version :** 1.3
**Date de production v1.0 :** 2026-04-11
**Date de mise a jour v1.1 :** 2026-04-18
**Date de mise a jour v1.2 :** 2026-04-19
**Date de mise a jour v1.3 :** 2026-04-19
**Auteur :** DPO (Fabrique)
**Niveau de sensibilite :** Expose
**Base reglementaire :** Article 35 du RGPD (Reglement UE 2016/679)
**Decision declenchante :** D-SEC-005 (PV comite securite P2, DAT v1.1 section 9.4)

**Documents de reference :**

- `p3-dat-v1.4.md` — sections 8.1, 8.2, 8.3, 9.4 (anciennement `p3-dat-v1.1.md` puis `p3-dat-v1.3.md`, renommé lors du bump v1.4 — TACHE-071 UC-04 + intégrations P4)
- `p2-sfd-v1.1.md` — section 2.5
- `p1-cahier-des-charges-v1.1.md` — sections correspondant à la fonctionnalité « Alerte mots de passe réutilisés », 3.1 (Privacy by Design)
- `gouvernance-pv-securite-p2-v1.0.md`
- `docs/rgpd/politique-de-confidentialite-v1.2.md` — §4.1 (Protection contre les sites frauduleux), §4.5 (Alerte mots de passe réutilisés), §8.1 (Particularités export Art. 20), §10.4 (Registre des incidents)
- `docs/rgpd/registre-des-traitements-v1.0.md` — RT-M2, RT-M7, RT-PARAM (Art. 30 RGPD) — à bumper en v1.1 (T-155)
- `docs/p5-decisions/p5-minidat-tache-061-heartbeat-m7-v1.1.md` — §11.3 registre d'incidents IDB circulaire
- `docs/securite/runbook-reponse-incident-v1.0.md` — §3.2 règle de montée automatique « tout incident M7 = P0 », §6.5 Template notification utilisateurs
- RISQUES.md — R-001, R-003, R-007, **R-M7-08** (fuite informationnelle via console)

**Note terminologique (v1.2/v1.3) :** ce document est destiné aux autorités de contrôle et au DPO. Il conserve les codes module techniques internes (M2, M3, M5, M6, M7, M9, M17) dans le détail technique pour la traçabilité avec le DAT, le SFD et le code source. En revanche, **les titres de section et l'introduction** utilisent les formulations user-friendly alignées avec la politique de confidentialité v1.2 (« Alerte mots de passe réutilisés », « Protection contre les sites frauduleux », etc.). Table de correspondance en annexe A.

---

## Historique des versions

| Version | Date | Diff resume | Auteur |
|---------|------|-------------|--------|
| v1.0 | 2026-04-11 | AIPD initiale (10 sections, 5 risques R1-R5, 314 lignes) | DPO Fabrique |
| v1.1 | 2026-04-18 | Enrichissement dual TACHE-040 + TACHE-084 : (1) §1.3 complete avec `chrome.storage.local` comme lieu de stockage de la whitelist « Protection contre les sites frauduleux » (alignement avec RT-M2 et politique §4.1) ; (2) nouvelle section §1.8 « Inventaire des logs console et champs loggés » exhaustive sur service-worker.ts et m7-handler.ts (validation OBS-03, cohérence R-M7-08, traçabilité TACHE-083) ; (3) mise à jour §6.4 « Déclencheurs de révision » pour tracer cette mise à jour | DPO Fabrique |
| v1.2 | 2026-04-19 | Alignement terminologique user-friendly (feedback Commanditaire) : suppression du terme « micro-nudges » (non compréhensible pour l'usager) remplacé par « conseils contextuels », « rappels ciblés » et « nudges » selon le contexte ; titres de sections alignés sur les formulations user-friendly de la politique v1.1 ; codes module techniques (M2, M7, etc.) conservés dans le corps des sections pour traçabilité DAT/SFD/code. Aucune modification de fond. | DPO Fabrique |
| **v1.3** | **2026-04-19** | **Intégration des notes DPO T-074 et T-115 + corrections OBS-04 / E-CROSS référent qualité :** (1) **§1.3** ajout de la ligne `m7_incidents` (registre d'incidents M7) avec **TTL absolue 365 jours** + FIFO 500 (R-074-02, implémentation tracée TACHE-159) et **garantie d'absence de `domain_hash` brut dans `context`** (R-074-01, TACHE-158) ; (2) **§2.4 nouvelle** « Exclusion du registre d'incidents de l'export Art. 20 » (R-074-03, TACHE-160) ; (3) **§4.1** ajout des mesures techniques `m7_incidents` (TTL + FIFO + minimisation contexte) et **mention CodeQL SAST automatisé OWASP Top 10 + CWE Top 25** (T-187 / TACHE-108 livrée, 0 finding au 19/04/2026) ; (4) **§6.2** conditions enrichies « interdiction de logger un `domain_hash` brut sans revue DPO » et « TTL 365 j absolue à respecter » ; (5) **§6.5 réécrite** « Validation TACHE-074 — avis FAVORABLE post-levée des 3 réserves R-074-01/02/03 » (remplace la pré-validation conceptuelle v1.2) ; (6) **§6.6 nouvelle** « Articulation avec le runbook réponse à incident — procédure d'escalade DPO en 6 étapes E1-E6 » intégrant intégralement la note T-115 ; (7) référence DAT bumpée en v1.4 (anomalie OBS-04 référent qualité). Aucune modification du fond AIPD : bases légales Art. 6.1.a inchangée, durées 90j/100 FIFO M7 inchangées, risques R1-R5 inchangés, mesures de protection inchangées, avis formel DPO inchangé. **Cette v1.3 résorbe les notes additives séparées T-074 et T-115 conformément à la règle Commanditaire 19/04 anti-démultiplication des documents.** | DPO Fabrique |

**Conventions de nommage documentaire :** conformément à la règle FICHIERS.md du plugin, les modifications de cette AIPD restent une version mineure (v1.2 → v1.3) car il s'agit d'une intégration documentaire formalisant des avis DPO existants, sans révision sur le fond des risques, de la base légale ou des mesures techniques d'origine.

---

## 1. Description du traitement

### 1.1 Finalite

Ameliorer la cyber-hygiene de l'utilisateur en detectant la reutilisation de mots de passe sur plusieurs domaines distincts. Lorsqu'une reutilisation est detectee, un **conseil contextuel non bloquant** (toast) est affiche pour sensibiliser l'utilisateur a l'adoption d'un gestionnaire de mots de passe open source (KeePass, KeePassXC, Bitwarden, Vaultwarden).

Le traitement poursuit un objectif exclusif de protection de l'utilisateur. Il ne vise ni la surveillance, ni le profilage, ni la monetisation des donnees.

### 1.2 Base legale

**Consentement explicite (Article 6.1.a du RGPD).**

La fonctionnalité « Alerte mots de passe réutilisés » (M7) est activée par opt-in lors de l'onboarding de l'extension (etape 4 — politique de confidentialite). L'utilisateur doit activer explicitement cette fonctionnalité avant tout traitement. Le consentement est :

- **Libre** : « Alerte mots de passe réutilisés » est desactivable independamment des autres fonctionnalités. L'extension fonctionne sans cette fonctionnalité.
- **Specifique** : le consentement porte uniquement sur le traitement d'empreintes de mots de passe pour la detection de reutilisation.
- **Eclaire** : la page de politique de confidentialite explique en langage clair le fonctionnement du traitement, les donnees collectees, leur duree de conservation et les droits de l'utilisateur.
- **Univoque** : l'activation se fait par case a cocher dediee dans l'onboarding.

Le consentement est revocable a tout moment via la page de parametres de l'extension.

### 1.3 Donnees traitees — Alerte mots de passe réutilisés (M7) et périmètre `chrome.storage.local` partagé

**v1.1 — MAJ TACHE-040 :** la colonne « Stockage » explicite désormais les lieux de stockage pour chaque donnée, et introduit la whitelist de la fonctionnalité « Protection contre les sites frauduleux » (M2 — hashs FNV-1a de domaines) comme donnée stockée dans `chrome.storage.local` **en complément** d'IndexedDB. Cette mise à jour aligne la présente AIPD sur le registre Art. 30 RGPD (RT-M2, RT-PARAM) et sur la politique de confidentialité §4.1.

**v1.3 — MAJ TACHE-159 / R-074-02 :** ajout de la ligne `m7_incidents` (registre d'incidents M7 introduit par TACHE-061) avec borne FIFO 500 et **TTL absolue 365 jours**. La discipline de minimisation du champ `context` (R-074-01, TACHE-158) interdit explicitement le stockage de tout `domain_hash` brut, fragment de `password_hash`, `installation_salt` ou URL complète dans ce store.

| Donnee                                                  | Nature                  | Stockage                                                               | Duree de conservation          |
| ------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| `password_value` (mot de passe en clair)                | Donnee sensible         | **Jamais stocke** — efface en memoire < 5 ms apres hachage (D-SEC-001) | 0 seconde                      |
| `password_hash` (SHA-256(installation_salt + password)) | Donnee pseudonymisee    | IndexedDB, champ `value` chiffre AES-256-GCM                           | 90 jours FIFO max 100 entrees  |
| `tag` (4 premiers bytes du hash)                        | Index de pre-filtration | IndexedDB, en clair                                                    | 90 jours                       |
| `domain_hash` (SHA-256(installation_salt + domain))     | Donnee pseudonymisee    | IndexedDB, en clair                                                    | 90 jours                       |
| `first_seen` (horodatage)                               | Metadonnee              | IndexedDB, en clair                                                    | 90 jours                       |
| `count` (nombre de detections)                          | Metadonnee              | IndexedDB, en clair                                                    | 90 jours                       |
| `installation_salt` (16 bytes, 128 bits)                | Cle de salage           | chrome.storage.local                                                   | Duree de vie de l'installation |
| **`whitelist` Protection contre les sites frauduleux / M2 (hashs FNV-1a de domaines de confiance)** (v1.1) | Preference utilisateur (hash non reversible) | **`chrome.storage.local` (cache session) + IndexedDB (store `whitelist`)** | **Jusqu'a suppression explicite par l'utilisateur** |
| **`m7_incidents` (registre d'incidents M7 — métadonnées techniques de diagnostic)** (v1.3) | Metadonnee technique non personnelle | **IndexedDB store `m7_incidents`, FIFO bornée à 500 entrées, severity-prioritized purge (INV-SEC-04)** | **365 jours absolus** (TTL R-074-02) **OU 500 entrées FIFO**, le plus restrictif des deux. Purge journalière `onPurgeDaily`. |

**Précisions (v1.1) sur la whitelist « Protection contre les sites frauduleux » (M2) :**

- **Double stockage justifié** : `chrome.storage.local` sert de cache de session pour une lecture rapide par le content script (pas de tour via le service worker), IndexedDB sert de source de vérité persistante et de store auditable pour l'export portabilité (Art. 20 RGPD). Cohérence P-018 (validation JSON stricte) et `initBoot()` M2 avec contrôle d'intégrité (TACHE-085).
- **Nature cryptographique** : hash FNV-1a 32 bits non réversible. FNV-1a est un hash d'indexation rapide, **non cryptographiquement sûr** contre une attaque par dictionnaire, mais acceptable ici car (a) les domaines visités ne sont jamais associés à un identifiant utilisateur, (b) l'espace des domaines populaires est fini et l'information révélée serait de toute façon déductible par un attaquant ayant accès au profil navigateur (voir R2 existant dans cette AIPD, R3 pour le modèle de menace profil).
- **Lien avec « Alerte mots de passe réutilisés » (M7)** : la whitelist M2 est **non liée à M7 fonctionnellement** mais elle partage le stockage `chrome.storage.local` avec la clé AES et le sel d'installation M7. Un attaquant compromettant le stockage local accède donc aux deux périmètres. Ce point est tracé dans R3 (Accès via profil Chrome) et dans la politique §10.3.
- **Référence registre Art. 30** : cette donnée est documentée dans **RT-M2** (`docs/rgpd/registre-des-traitements-v1.0.md` §3.1) et dans **RT-PARAM** (§3.8) pour la partie préférences. La présente AIPD la mentionne ici pour **traçabilité du périmètre `chrome.storage.local`** vu par l'attaquant (complétude du modèle de menace), pas parce qu'elle relèverait du traitement « Alerte mots de passe réutilisés » au sens fonctionnel.

**Précisions (v1.3) sur le registre `m7_incidents` :**

- **Qualification RGPD** : le registre `m7_incidents` n'est **pas un traitement de données personnelles autonome** (cf. analyse §2.4 de la note DPO T-074 résorbée dans cette v1.3). Les champs `id`, `ts`, `type`, `severity`, `context` sont des métadonnées techniques de diagnostic. Il est néanmoins documenté ici comme **mesure technique liée au traitement RT-M7** (registre Art. 30) et tracé dans la présente AIPD pour transparence et alignement avec le runbook réponse à incident (§6.6).
- **Discipline de minimisation Art. 5.1.c (R-074-01, TACHE-158)** : le champ `context` est typé par une **union discriminée** `IncidentContext` (CM-ID2 du mini-DAT TACHE-061 v1.1) qui n'autorise que les champs `hint` (texte court enum), `boot_count` (entier), `reason` (enum), `code_path` (chemin de fichier sans valeur), `error_name` (nom de classe d'erreur). **Tout ajout d'un champ pseudonymisé (`domain_hash`, fragment de `password_hash`, `installation_salt`) ou tout champ susceptible d'être corrélé à une activité utilisateur observable doit faire l'objet d'une revue formelle DPO préalable**, avec mise à jour de la présente section. Une règle ESLint AST (TACHE-083 / TACHE-104) bloque la capture directe de `err.message` dans tout site logger ou `IncidentService.log()`.
- **Discipline de limitation de la conservation Art. 5.1.e (R-074-02, TACHE-159)** : la borne FIFO 500 est complétée par une **purge par âge** : tout incident dont `ts < Date.now() - 365 jours` est purgé sans condition de severity, lors de la purge journalière `onPurgeDaily`. La méthode `IncidentService.purgeOldEntries(maxAgeDays = 365)` est appelée à chaque cycle. Le test TC-M7-30 vérifie le bon fonctionnement (insertion d'un incident antidaté → purge confirmée).
- **Effacement utilisateur Art. 17** : le bouton « Supprimer toutes mes données » de la page Options exécute `indexedDB.deleteDatabase('sentinel-nudge-db')` qui inclut le store `m7_incidents` par construction. Bouton granulaire « Vider mon registre d'incidents » prévu en R-074-REC-02.
- **Exclusion de l'export Art. 20** : voir §2.4 ci-dessous.

### 1.4 Responsable de traitement

L'utilisateur lui-meme est responsable de traitement au sens de l'article 4(7) du RGPD. Le traitement est integralement local : aucune donnee ne quitte le navigateur, aucun serveur n'est implique, aucune communication reseau n'est etablie.

Sentinel Nudge est un outil mis a disposition de l'utilisateur. L'editeur fournit le code source (licence GPL v3) mais ne collecte, ne recoit et ne traite aucune donnee personnelle des utilisateurs.

### 1.5 Sous-traitants

**Aucun.** Le traitement est integralement realise sur le poste de l'utilisateur par l'extension navigateur. Aucun service tiers, aucune API externe, aucun serveur distant n'intervient dans le traitement des donnees de la fonctionnalité « Alerte mots de passe réutilisés ».

### 1.6 Destinataires des donnees

**Aucun.** Les donnees ne sont accessibles que par l'extension elle-meme, dans le perimetre du profil Chrome de l'utilisateur. Aucune transmission, aucun partage, aucune exportation automatique.

### 1.7 Transferts hors UE

**Aucun.** Toutes les donnees restent dans le stockage local du navigateur sur le poste de l'utilisateur.

### 1.8 Inventaire des logs console et champs loggés — périmètre « Alerte mots de passe réutilisés » (M7) et Service Worker (v1.1 — TACHE-084)

**Contexte :** la TACHE-061 (heartbeat M7 + canary hash + registre d'incidents) a introduit des logs techniques dans le service worker et dans le handler « Alerte mots de passe réutilisés » (m7-handler) pour tracer le cycle de vie du boot. Le comité de revue code a soulevé le risque **R-M7-08** (fuite informationnelle via console) : bien que les logs `console.*` ne quittent jamais le navigateur (pas de télémétrie réseau), ils peuvent être lus par tout outil accédant à la console du service worker (DevTools, extension malveillante avec permission `management` ou `debugger`, test de reproduction d'incident partagé publiquement par l'utilisateur).

**Mitigation appliquée (TACHE-083) :** migration de tous les `console.*` directs du service worker et du handler M7 vers une **factory `logger.ts`** (`src/shared/utils/logger.ts`, imports `createLogger` + `Logger`). La factory applique :

1. **Minimisation du payload** : `Logger.errorName(err)` est utilisé à la place de `err.message` pour ne logger que le **nom de la classe d'erreur** (ex. `TypeError`, `QuotaExceededError`) et non le message détaillé susceptible de contenir un chemin, une clé, une valeur utilisateur.
2. **Signature typée** : `logger.info(msg, context?)` avec `context` en objet structuré, facilitant une revue statique (ESLint AST rule prévue TACHE-083 étape 2, scope résiduel TACHE-104).
3. **Namespace explicite** : chaque site logger a un préfixe (`ServiceWorker`, `M7Handler`, etc.) pour la traçabilité sans recours à `fichier:ligne` dans le payload.

**Validation post-TACHE-061 (OBS-03) :** la revue a identifié l'usage de `_sender.tab?.url` (URL complète potentiellement PII) dans un log d'accueil de message. **OBS-03 a été corrigé :** le site `m7-handler.ts:507` logge désormais `tab_id: _sender.tab?.id` et non l'URL. Vérification effectuée sur la révision courante : `grep "sender.tab" m7-handler.ts` → une seule occurrence, `_sender.tab?.id`, aucune occurrence résiduelle de `_sender.tab?.url`. Conformité OBS-03 **confirmée**.

**Inventaire exhaustif des sites logger du périmètre « Alerte mots de passe réutilisés » (M7) (v1.1) :**

#### A. `src/background/service-worker.ts` — logger `swLogger` (namespace `ServiceWorker`)

| # | Fichier:ligne | Sévérité | Message | Champs loggés dans `context` | Évaluation RGPD |
|---|---------------|----------|---------|------------------------------|-----------------|
| SW-01 | `service-worker.ts:279-282` | `warn` | `purgePendingIntents: erreur sur clé individuelle` | `hint: 'storage_purge_failed'`, `error_name: Logger.errorName(err)` | **OK** — pas de clé utilisateur, pas de valeur, classe d'erreur uniquement |
| SW-02 | `service-worker.ts:286-290` | `info` | `purgePendingIntents: purge terminée` | `hint: 'storage_hygiene'`, `scanned: pendingKeys.length` (entier), `purged: purgedCount` (entier) | **OK** — compteurs agrégés uniquement |
| SW-03 | `service-worker.ts:577-578` | `info` | `SW init: installation_in_progress — IIFE boot skipped (TACHE-079)` | (aucun) | **OK** — pas de payload |
| SW-04 | `service-worker.ts:607-611` | `warn` | `SW init: encryption_key_material absent — régénération automatique (INV-SEC-03)` | `boot_count: diagnostics.boot_count` (entier, compteur de boots SW) | **OK** — compteur non corrélable à une PII, utile diagnostic |
| SW-05 | `service-worker.ts:737-742` | `info` | `SW init: boot sequence complete` | `modules: ['M2','M3','M5','M6','M7','M9','M17','EXPORT']` (liste statique), `duration_ms: bootMs` (entier), `boot_count: diagnostics.boot_count` | **OK** — métriques techniques agrégées |
| SW-06 | `service-worker.ts:751-755` | `error` | `SW init: boot sequence failed` | `boot_count: diagnostics.boot_count`, `error_name: Logger.errorName(err)` (pas de `err.message`) | **OK** — nom de classe d'erreur uniquement, pas de message |

#### B. `src/background/handlers/m7-handler.ts` — logger `logger` (namespace `M7Handler`) — périmètre « Alerte mots de passe réutilisés »

| # | Fichier:ligne | Sévérité | Message | Champs loggés dans `context` | Évaluation RGPD |
|---|---------------|----------|---------|------------------------------|-----------------|
| M7-01 | `m7-handler.ts:301` | `info` | `readPendingM7Toast: migration legacy timestamp → expires_at effectuée` | (aucun) | **OK** — pas de payload |
| M7-02 | `m7-handler.ts:304-306` | `error` | `readPendingM7Toast: erreur ré-écriture migration` | `error_name: Logger.errorName(migrErr)` | **OK** — classe d'erreur uniquement |
| M7-03 | `m7-handler.ts:326-329` | `info` | `readPendingM7Toast: toast expiré supprimé` | `expires_at: toast.expires_at` (timestamp ms epoch), `overdue_ms: Date.now() - toast.expires_at` (entier ms) | **OK** — timestamps techniques relatifs, pas de domaine ni de hash |
| M7-04 | `m7-handler.ts:335-337` | `error` | `readPendingM7Toast: erreur lecture storage` | `error_name: Logger.errorName(err)` | **OK** — classe d'erreur uniquement |
| M7-05 | `m7-handler.ts:389` | `error` | `Erreur toast action` | `error_name: Logger.errorName(err)` | **OK** — classe d'erreur uniquement |
| M7-06 | `m7-handler.ts:473` | `error` | `Erreur traitement` | `error_name: Logger.errorName(err)` | **OK** — classe d'erreur uniquement |
| M7-07 | `m7-handler.ts:507` | `info` | `message recu` | `action: msg.action` (enum de type de message), **`tab_id: _sender.tab?.id`** (entier, id technique de tab Chrome, non PII, non persistant après fermeture du tab) | **OK (post-OBS-03)** — `_sender.tab?.id` et **non** `_sender.tab?.url` conformément à la correction OBS-03. Le `tab.id` Chrome est un entier incrémental local au navigateur, ne survit pas à un redémarrage, non corrélable à un identifiant utilisateur externe |

**Total : 13 sites logger actifs pour le périmètre « Alerte mots de passe réutilisés » (M7)** (6 service-worker + 7 m7-handler). Aucun `console.*` direct résiduel n'a été détecté dans ces deux fichiers (`grep -n "console\." service-worker.ts m7-handler.ts` → 3 résultats, tous des commentaires pédagogiques référençant R-M7-08/TACHE-083, ligne 577, 607, 737 du service worker ; aucun appel effectif).

**Champs absents de l'inventaire (confirmation de non-logging) :**

| Champ | Pourquoi exclu ? | Invariant sécurité |
|-------|------------------|--------------------|
| `err.message` | Peut contenir path, clé, valeur utilisateur | R-M7-08 mitigation / TACHE-083 |
| `String(err)` | Idem `err.message` | TACHE-083 règle ESLint AST cible |
| `hostname` brut | Serait un domaine visité (PII indirecte) | R-M7-08 / INV-SEC-02 |
| `domain_hash` brut | Bien que pseudonymisé, reste de trop faible utilité en log **et formellement interdit dans `m7_incidents.context` (R-074-01, TACHE-158)** | Minimisation Art. 5.1.c |
| `password_hash` | Donnée sensible AIPD §1.3 | INV-SEC-01 |
| `installation_salt` | Compromet l'utilité cryptographique si exposé | D-SEC-001 |
| `URL complète` (`_sender.tab?.url`) | PII directe | **OBS-03 correctif appliqué** |
| Contenu saisi (input password) | Valeur sensible « Alerte mots de passe réutilisés » (M7) | INV-SEC-02 / R-002 |
| Contenu presse-papiers « Alerte copie de données sensibles » (M17) | Donnée sensible type cb/iban/ssn | R-CLI-07 / INV-SEC-02 |

**Cohérence avec R-M7-08 (RISQUES.md) :** le risque de fuite informationnelle par la console est désormais **mitigé au niveau code** pour les 13 sites du périmètre « Alerte mots de passe réutilisés » (service-worker + m7-handler). La règle ESLint AST complémentaire (TACHE-083 étape 2) est **partiellement livrée** : elle couvre le pattern `console.*(..., err.message, ...)` direct, mais ne capture pas encore le pattern `const message = err.message; logger.error(msg, { message })` dans les handlers des autres fonctionnalités (M2/M3/M5/M6/M17, 12 sites identifiés, TACHE-104). Ces sites résiduels **sont hors périmètre « Alerte mots de passe réutilisés »** mais sont tracés pour complétude.

**Recommandations DPO (v1.1) :**

1. **R-REC-AIPD-01** — **Finaliser la règle ESLint AST (TACHE-104)** : sélecteur `VariableDeclarator > MemberExpression[property.name='message']` dans un callee logger, pour bloquer systématiquement la capture de `err.message` dans les 12 sites résiduels handlers.
2. **R-REC-AIPD-02** — **Étendre l'inventaire aux content scripts (TACHE-105)** : environ 26 sites `console.*` recensés dans password-detector/dashboard/onboarding/options/popup. Priorité inférieure car les content scripts exposent moins la console du service worker, mais à tracer pour un prochain bump AIPD quand TACHE-105 sera planifiée.
3. **R-REC-AIPD-03** — **Tests automatisés anti-régression** : ajouter un test unitaire/statique (snapshot) qui échoue si un `_sender.tab?.url` apparaît dans un argument de logger/console dans `src/background/**`. Protection contre régression OBS-03. À cadrer avec testeur QA (lien TACHE-059/082).
4. **R-REC-AIPD-04** — **Revue trimestrielle** : le DPO refait un `grep console\.\|logger\.` sur `src/background/**` chaque trimestre et compare à cet inventaire §1.8 pour détecter toute dérive. Cadence alignée sur TACHE-117 (matrice providers trimestrielle).

**Cohérence avec le registre Art. 30 :**

- **RT-M7** (registre des traitements v1.0 §3.5, correspondant à la fonctionnalité « Alerte mots de passe réutilisés ») — aucune mention de logs dans les « données traitées » car les logs ne sont **pas des données traitées au sens RGPD** (pas de finalité métier, éphémères dans la console navigateur, non persistés au-delà du cycle de vie du service worker). La présente §1.8 documente néanmoins le périmètre pour transparence et alignement avec R-M7-08.
- **RT-PARAM** (§3.8) — aucune interaction.
- **Registre d'incidents IndexedDB** (store `m7_incidents` introduit par TACHE-061) — désormais traité au §1.3 v1.3 (ligne dédiée) avec TTL 365 j et discipline de minimisation `IncidentContext` typée (R-074-01/02).

---

## 2. Necessite et proportionnalite

### 2.1 Necessite du traitement

La reutilisation de mots de passe est l'une des premieres causes de compromission de comptes. La litterature en sciences comportementales (cf. analyse de litterature P1) montre que les utilisateurs sous-estiment systematiquement ce risque. Le conseil contextuel, declenche au moment precis de la reutilisation, constitue l'intervention la plus efficace pour modifier ce comportement.

Le traitement d'empreintes de mots de passe est techniquement indispensable pour detecter la reutilisation. Sans comparaison entre les mots de passe soumis sur differents domaines, la detection est impossible.

### 2.2 Minimisation des donnees

Le principe de minimisation (article 5.1.c du RGPD) est strictement respecte :

- **Mot de passe en clair** : jamais stocke, efface en memoire en moins de 5 ms apres hachage.
- **Empreinte salée** : seul le hash SHA-256(installation_salt + password) est conserve, rendant la reconstitution du mot de passe couteuse en calcul.
- **Domaine** : jamais stocke en clair, uniquement sous forme de hash sale SHA-256(installation_salt + domain).
- **URL complete** : jamais collectee.
- **Identifiant utilisateur** : aucun (pas d'UUID, pas de fingerprinting, pas de cookie — ENF-PBD-06).
- **Chiffrement au repos** : le hash du mot de passe est chiffre AES-256-GCM dans IndexedDB (ENF-PBD-04).
- **(v1.1) Logs minimisés** : la factory `logger.ts` interdit le logging de `err.message`, `hostname`, `domain_hash`, `password_hash` et toute URL complète (cf. §1.8). Le nom de classe d'erreur (`Logger.errorName`) est la seule information d'erreur loggée.
- **(v1.3) Registre d'incidents minimisé** : le champ `context` du store `m7_incidents` est typé `IncidentContext` (union discriminée) et n'autorise que des métadonnées techniques agrégées. **Tout `domain_hash` brut, fragment de `password_hash`, `installation_salt` ou URL complète y est formellement interdit (R-074-01, TACHE-158)**.

### 2.3 Limitation de la conservation

- **Duree maximale `password_hashes`** : 90 jours glissants.
- **Volume maximal `password_hashes`** : 100 entrees (FIFO — First In, First Out).
- **Purge automatique** : alarme hebdomadaire (lundi 09h) declenchee par le service worker. Suppression des enregistrements dont `first_seen < now - 90 jours`, puis suppression des plus anciens si le seuil de 100 est depasse.
- **Purge manuelle** : bouton "Supprimer toutes mes donnees" dans la page Options qui execute `indexedDB.deleteDatabase('sentinel-nudge-db')` et `chrome.storage.local.clear()`.
- **(v1.3) Registre d'incidents `m7_incidents`** : double borne **FIFO 500 entrées** (INV-03 du mini-DAT TACHE-061 v1.1) **+ TTL absolue 365 jours** (R-074-02, TACHE-159). La purge par âge est appelée par `IncidentService.purgeOldEntries(365)` lors de chaque cycle `onPurgeDaily`. La règle de priorité severity (INV-SEC-04) cible d'abord les incidents `info`, puis `warn`, puis `error`, mais ne dispense pas de la TTL absolue — un incident `error` antérieur à 365 jours est purgé sans condition. Test TC-M7-30 vérifie ce comportement.

### 2.4 Exclusion du registre d'incidents de l'export de portabilité Art. 20 (v1.3 — R-074-03 / TACHE-160)

L'export de portabilité (Art. 20 RGPD) exclut désormais **deux catégories de données** par défaut :

1. **Empreintes brutes de mots de passe (`password_hashes`)** — exclues depuis l'origine (AIPD v1.0 §2.4 historique). Justification : éviter qu'un attaquant exfiltrant le fichier d'export puisse mener une attaque par dictionnaire sur les hashes.

2. **Registre d'incidents (`m7_incidents`)** — **exclu par défaut depuis v1.3**. Justification : le registre est un journal forensique de diagnostic technique destiné au mainteneur, **pas une donnée personnelle métier de l'utilisateur**. Sa qualification RGPD (cf. §1.3 v1.3) confirme qu'il ne relève pas de l'Art. 20 par défaut. La portabilité exporte les données utilisateur métier (préférences, scores hebdo, dates de quiz, événements de nudge agrégés), pas les journaux techniques.

**Option utilisateur explicite** : pour respecter l'esprit de transparence radicale du projet et permettre un cas d'usage légitime (l'utilisateur souhaite partager son journal avec le mainteneur pour aider au diagnostic d'un bug), la page Options de l'export propose une case à cocher dédiée « Inclure mon journal de diagnostic », **désactivée par défaut**, accompagnée d'un avertissement (« contient des informations techniques sur le fonctionnement de votre extension »).

**Implémentation** : modification de `export-handler.ts` pour exclure le store `m7_incidents` du périmètre par défaut, ajout d'un paramètre `include_m7_incidents: boolean = false` dans le payload de la requête `get_full_export`. Tracé en TACHE-160.

**Cohérence politique de confidentialité** : ce point est désormais explicitement documenté dans la politique v1.2 §8.1 « Particularités de l'export de portabilité (Art. 20) ».

### 2.5 Information des personnes concernees

- **Onboarding** : explication en langage clair du fonctionnement de la fonctionnalité « Alerte mots de passe réutilisés » lors de l'etape 4 de l'onboarding.
- **Page de politique de confidentialite** : accessible depuis l'onboarding et la page de parametres (ENF-PBD-08).
- **Page d'explication dédiée** : page statique accessible depuis le toast de conseil (« Voir comment ça marche »).
- **Transparence radicale** : code source ouvert (GPL v3), documentation technique publique.

---

## 3. Risques pour les droits et libertes des personnes

### R1 — Reidentification du mot de passe via attaque par dictionnaire sur le hash

**Description :** Un attaquant ayant acces au stockage IndexedDB pourrait tenter de reconstituer le mot de passe en calculant SHA-256(sel + candidat) pour un grand nombre de candidats et en comparant avec les hashes stockes.

**Sources de risques :** Malware ayant acces au profil Chrome, extension malveillante avec permissions elevees, acces physique au poste non verrouille.

**Vraisemblance :** Limitee. L'attaquant doit (1) acceder au profil Chrome, (2) extraire la cle AES-256-GCM depuis chrome.storage.local, (3) dechiffrer les hashes, (4) extraire le sel d'installation, (5) mener une attaque par dictionnaire. Le sel de 128 bits empeche les rainbow tables pre-calculees. Chaque installation a un sel unique.

**Gravite :** Importante. La compromission d'un mot de passe peut entrainer l'acces non autorise a des comptes utilisateur.

**Mesures de mitigation existantes :**

- Sel local de 128 bits unique par installation (D-SEC-001)
- Chiffrement AES-256-GCM du hash au repos (NC-DPO-01)
- Nullification du mot de passe en clair en < 5 ms
- FIFO 100 entrees maximum (surface d'attaque limitee)
- Purge automatique a 90 jours

**Mesures complementaires prevues :**

- v2+ : derivation PBKDF2 depuis un PIN utilisateur pour renforcer la protection de la cle AES

### R2 — Correlation des domaines visites via les domain_hash

**Description :** Un attaquant ayant acces au stockage pourrait tenter de determiner les domaines visites par l'utilisateur en calculant SHA-256(sel + domaine_candidat) pour un dictionnaire de domaines connus.

**Sources de risques :** Memes que R1 (acces au profil Chrome necessaire).

**Vraisemblance :** Limitee. Le sel de 128 bits empeche les tables pre-calculees. L'attaquant doit connaitre le sel et tester un dictionnaire de domaines. Neanmoins, le nombre de domaines populaires est fini (~10 000 domaines couvrent 90% du trafic), rendant l'attaque plus rapide que pour les mots de passe.

**Gravite :** Limitee. La connaissance des domaines visites (sans les URL completes ni les pages) represente une atteinte a la vie privee, mais de moindre gravite que la compromission d'un mot de passe.

**Mesures de mitigation existantes :**

- Sel local de 128 bits (D-SEC-001)
- Seul le domaine est hashe (pas l'URL complete)
- Purge automatique a 90 jours
- FIFO 100 entrees maximum

**Note v1.1 — Périmètre whitelist « Protection contre les sites frauduleux » (M2) :** la whitelist M2 (hashs FNV-1a 32 bits) est **plus faible cryptographiquement** que les domain_hash de la fonctionnalité « Alerte mots de passe réutilisés » (SHA-256 salé 256 bits). Un attaquant ayant accès au stockage local peut plus facilement mener une attaque par dictionnaire sur la whitelist M2. Ce point est hors périmètre strict de « Alerte mots de passe réutilisés » mais documenté ici pour complétude du modèle de menace `chrome.storage.local`. La whitelist M2 ne révèle que les domaines **explicitement marqués de confiance par l'utilisateur** (ensemble généralement de très petite cardinalité — <10 domaines typiques), limitant la gravité.

### R3 — Acces non autorise aux donnees via le profil Chrome

**Description :** Un attaquant ayant acces au profil Chrome de l'utilisateur (session non verrouillee, synchronisation cloud compromise) accede a l'integralite des donnees de l'extension, y compris la cle AES et le sel d'installation.

**Sources de risques :** Acces physique au poste, compromission du compte Google (si synchronisation Chrome activee), malware avec acces au systeme de fichiers.

**Vraisemblance :** Limitee. Ce scenario suppose un acces au profil Chrome, ce qui constitue deja une compromission majeure du poste. Si le profil est compromis, l'attaquant a deja acces aux cookies, mots de passe Chrome, historique et donnees de toutes les extensions.

**Gravite :** Importante. L'acces au profil Chrome permet la compromission totale des donnees de l'extension.

**Mesures de mitigation existantes :**

- Risque accepte et documente (D-SEC-004, R-003) : la compromission du profil Chrome depasse le perimetre de l'extension
- Chiffrement AES-256-GCM qui protege contre l'extraction hors profil (copie brute de la base IndexedDB)
- Documentation de la limitation dans la page Options (transparence radicale)

**Mesures complementaires prevues :**

- v2+ : derivation PBKDF2 depuis un PIN utilisateur

### R4 — Profilage des habitudes de securite de l'utilisateur

**Description :** Les donnees de la fonctionnalité « Alerte mots de passe réutilisés » (nombre de reutilisations, frequence, compteur de detections) pourraient etre utilisees pour etablir un profil des habitudes de securite de l'utilisateur.

**Sources de risques :** Exploitation par un tiers ayant acces au profil Chrome. Scenario theorique : un employeur accedant au profil Chrome d'un employe.

**Vraisemblance :** Negligeable. Les donnees sont locales, chiffrees, non transmises. Le profilage n'est possible qu'avec un acces physique ou logique au profil Chrome, et les donnees brutes (hashes et compteurs) ne permettent pas un profilage detaille sans analyse complementaire.

**Gravite :** Limitee. Le profilage se limiterait a savoir que l'utilisateur reutilise des mots de passe (information generique) et a estimer la frequence.

**Mesures de mitigation existantes :**

- Aucune transmission de donnees
- Chiffrement au repos
- Purge automatique a 90 jours
- Pas d'identifiant persistant
- Export de portabilite excluant les hashes de mots de passe (seules les metadonnees agregees sont exportees)
- **(v1.3) Export de portabilité excluant aussi le registre d'incidents `m7_incidents` par défaut** (R-074-03 / TACHE-160) — réduit encore la surface de profilage exposable

### R5 — Perte de controle des donnees (defaut de consentement ou d'effacement)

**Description :** L'utilisateur pourrait ne pas etre informe du traitement, ne pas pouvoir retirer son consentement, ou ne pas pouvoir exercer son droit a l'effacement.

**Sources de risques :** Defaut d'implementation de l'onboarding, bug empechant la desactivation de la fonctionnalité ou la suppression des donnees.

**Vraisemblance :** Negligeable. Le consentement est obtenu par opt-in explicite dans l'onboarding (etape 4). La desactivation de la fonctionnalité et l'effacement des donnees sont accessibles en 1 clic dans la page de parametres. Le code source est ouvert et auditable.

**Gravite :** Importante. L'absence de controle sur ses donnees constitue une violation directe des droits fondamentaux de la personne concernee (articles 7, 17 et 20 du RGPD).

**Mesures de mitigation existantes :**

- Consentement opt-in explicite a l'onboarding (etape 4)
- Desactivation de la fonctionnalité « Alerte mots de passe réutilisés » a tout moment via les parametres
- Bouton "Supprimer toutes mes donnees" (article 17 — droit a l'effacement) — efface aussi `m7_incidents` par construction (`deleteDatabase`)
- Bouton "Exporter mes donnees" (article 20 — droit a la portabilite) avec exclusion des hashes bruts et du registre `m7_incidents` par défaut
- Code source ouvert (GPL v3) permettant l'audit

---

## 4. Mesures envisagees pour traiter les risques

### 4.1 Mesures techniques

| Mesure                                                               | Reference       | Risques couverts |
| -------------------------------------------------------------------- | --------------- | ---------------- |
| Sel local 128 bits unique par installation                           | D-SEC-001       | R1, R2           |
| Chiffrement AES-256-GCM au repos des hashes                          | NC-DPO-01       | R1, R2, R3       |
| Nullification mot de passe en clair < 5 ms                           | D-SEC-001       | R1               |
| FIFO 100 entrees maximum (`password_hashes`)                         | SFD M7          | R1, R2, R4       |
| Purge automatique 90 jours (`password_hashes`)                       | DAT section 8.3 | R1, R2, R4       |
| Index de pre-filtration `tag` (4 bytes) sans exposer le hash complet | DAT section 8.1 | R1               |
| Aucun appel reseau sortant                                           | ENF-PBD-01      | R1, R2, R3, R4   |
| CSP stricte (script-src 'self')                                      | D-SEC-003       | R3               |
| Exclusion des hashes bruts de l'export de portabilite                | DAT section 8.3 | R1               |
| **(v1.1) Factory `logger.ts` avec minimisation systématique** | TACHE-083 / R-M7-08 | **R-M7-08 (fuite console)** |
| **(v1.1) `Logger.errorName` substitué à `err.message`** | TACHE-083 / AIPD §1.8 | **R-M7-08** |
| **(v1.3) Registre `m7_incidents` borné FIFO 500 + TTL absolue 365 jours** | TACHE-159 / R-074-02 | R4, R5 (limitation conservation) |
| **(v1.3) Discipline de minimisation `IncidentContext` typée — interdiction `domain_hash` brut** | TACHE-158 / R-074-01 | R-M7-08, R2 |
| **(v1.3) Exclusion `m7_incidents` de l'export Art. 20 par défaut** | TACHE-160 / R-074-03 | R4 |
| **(v1.3) Analyse statique SAST automatisée CodeQL — OWASP Top 10 + CWE Top 25** | T-187 / TACHE-108 livrée | R1, R3, R-M7-08 (détection précoce vulnérabilités code) |

**Note v1.3 sur CodeQL (T-187 / TACHE-108)** : depuis la livraison de TACHE-108 (workflow `.github/workflows/codeql.yml`), le code source de l'extension est scanné en continu par GitHub CodeQL avec le ruleset combiné **OWASP Top 10 (web)** et **CWE Top 25**. Exécution à chaque push sur `main`/`develop`, à chaque PR, et selon une cadence hebdomadaire. **État au 19/04/2026 : 0 finding** sur l'ensemble du code de l'extension, en particulier sur le périmètre M7 (`src/background/handlers/m7-handler.ts`, `src/background/services/m7-*.ts`, `src/shared/utils/logger.ts`). Cette mesure est complémentaire des contrôles ISO 27001 A.8.28 (Secure coding) et A.8.8 (Vulnerability management) déjà documentés au référentiel sécurité.

### 4.2 Mesures organisationnelles

| Mesure                                                    | Reference      | Risques couverts   |
| --------------------------------------------------------- | -------------- | ------------------ |
| Code source ouvert (GPL v3)                               | CdC            | R1, R2, R3, R4, R5 |
| Documentation technique publique                          | DAT, SFD       | R5                 |
| Transparence radicale (page Options, page explication dédiée « Alerte mots de passe réutilisés ») | ENF-PBD-08     | R5                 |
| Tests automatises (Vitest + Playwright) en CI             | DAT section 10 | R5                 |
| Revue de code obligatoire (comite de revue code)          | Gouvernance    | R1, R3             |
| **(v1.1) Revue trimestrielle inventaire logs par DPO — périmètre « Alerte mots de passe réutilisés »** | AIPD §1.8 R-REC-AIPD-04 | **R-M7-08** |
| **(v1.1) Règle ESLint AST anti `err.message` (partielle, TACHE-083/104)** | TACHE-083/104 | **R-M7-08** |
| **(v1.3) Procédure d'escalade DPO en 6 étapes (E1-E6)** | AIPD §6.6 / runbook §3.2 | R5, gestion crise |
| **(v1.3) Saisine DPO automatique « tout incident M7 = P0 »** | runbook §3.2 / AIPD §6.6 | R5, gestion crise |

### 4.3 Mesures juridiques

| Mesure                                        | Reference                    | Risques couverts |
| --------------------------------------------- | ---------------------------- | ---------------- |
| Consentement explicite opt-in (article 6.1.a) | Onboarding etape 4           | R5               |
| Droit a l'effacement en 1 clic (article 17)   | Page parametres              | R5               |
| Droit a la portabilite (article 20)           | Page parametres, export JSON | R5               |
| Revocation du consentement a tout moment      | Page parametres              | R5               |
| Politique de confidentialite en langage clair | Onboarding + parametres      | R5               |

---

## 5. Cartographie des risques residuels

### 5.1 Matrice vraisemblance x gravite apres mesures

|                 | Negligeable | Limitee | Importante | Maximale |
| --------------- | :---------: | :-----: | :--------: | :------: |
| **Maximale**    |             |         |            |          |
| **Importante**  |             |         |            |          |
| **Limitee**     |             |   R2    |   R1, R3   |          |
| **Negligeable** |             |   R4    |     R5     |          |

### 5.2 Evaluation des risques residuels

| Risque                                 | Vraisemblance residuelle | Gravite residuelle | Niveau residuel | Acceptabilite                                                                                                          |
| -------------------------------------- | ------------------------ | ------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| R1 — Reidentification par dictionnaire | Limitee                  | Importante         | Modere          | **Acceptable** — sel 128 bits + chiffrement AES-256-GCM + FIFO 100 + CodeQL SAST 0 finding rendent l'attaque couteuse et limitee dans le temps |
| R2 — Correlation des domaines          | Limitee                  | Limitee            | Faible          | **Acceptable** — sel 128 bits + purge 90 jours + domaines sans URL completes + interdiction `domain_hash` dans `m7_incidents.context` |
| R3 — Acces via profil Chrome           | Limitee                  | Importante         | Modere          | **Acceptable** — risque inherent au modele de securite Chrome, hors perimetre de l'extension. Documente.               |
| R4 — Profilage habitudes               | Negligeable              | Limitee            | Faible          | **Acceptable** — donnees locales, chiffrees, non transmises, purgees automatiquement, exclusion `m7_incidents` de l'export |
| R5 — Perte de controle                 | Negligeable              | Importante         | Faible          | **Acceptable** — consentement opt-in, effacement 1 clic, code ouvert, tests automatises, **procédure escalade DPO E1-E6** |

**Note v1.1 :** le risque R-M7-08 (fuite informationnelle via console), identifié lors du comité de revue code TACHE-061, n'est **pas un risque AIPD au sens strict** (il n'affecte pas directement les droits des personnes concernées dans un scénario de fonctionnement nominal, car les logs ne sortent pas du navigateur). Il est néanmoins **tracé comme risque sécurité** dans RISQUES.md et **mitigé au niveau code** via TACHE-083 (factory `logger.ts`) et documenté dans §1.8 de la présente AIPD. Aucune ligne supplémentaire dans la matrice §5.1 car son niveau résiduel post-mitigation est **négligeable/négligeable** (hors canevas).

**Note v1.3 :** la mitigation R-M7-08 est désormais étendue au registre `m7_incidents` via la discipline `IncidentContext` typée (R-074-01 / TACHE-158). La règle ESLint AST anti `err.message` (TACHE-104) couvre désormais le scope service-worker ; le scope content scripts (TACHE-105) reste en R-REC-AIPD-02.

---

## 6. Conclusion et avis du DPO

### 6.1 Avis formel

**Le traitement mis en oeuvre par la fonctionnalité « Alerte mots de passe réutilisés » de Sentinel Nudge est conforme au RGPD.** Les risques identifies sont maitrises par un ensemble de mesures techniques, organisationnelles et juridiques coherentes et proportionnees.

Le niveau de risque residuel global est **faible a modere**, ce qui est acceptable au regard de la finalite du traitement (amelioration de la cyber-hygiene) et de l'architecture Privacy by Design mise en oeuvre (traitement 100% local, aucune transmission, chiffrement au repos, purge automatique).

**Avis v1.1 :** les enrichissements TACHE-040 (documentation de `chrome.storage.local` comme lieu de stockage de la whitelist « Protection contre les sites frauduleux ») et TACHE-084 (inventaire exhaustif des logs console du périmètre « Alerte mots de passe réutilisés » + validation OBS-03) **ne modifient pas l'avis formel v1.0**. Ils renforcent au contraire la position de conformité en documentant explicitement : (a) la cohérence entre l'AIPD §1.3, le registre Art. 30 (RT-M2/RT-PARAM) et la politique de confidentialité §4.1 ; (b) la mitigation effective de R-M7-08 par TACHE-083 et la levée d'OBS-03 post-TACHE-061.

**Avis v1.2 :** l'alignement terminologique user-friendly (suppression de « micro-nudges », titres de section reformulés pour l'usager) **ne modifie en aucune manière** l'avis formel. L'AIPD reste un document technique destiné aux autorités et au DPO, mais sa cohérence avec la politique de confidentialité publique v1.1 est désormais explicite. Les codes module internes (M2, M7, etc.) sont préservés dans le détail technique pour traçabilité DAT/SFD/code source.

**Avis v1.3 :** l'intégration des notes T-074 et T-115 (résorbées dans la présente version conformément à la règle Commanditaire 19/04 anti-démultiplication des documents), assortie de la traçabilité des implémentations TACHE-158 (R-074-01), TACHE-159 (R-074-02) et TACHE-160 (R-074-03), **lève les trois réserves bloquantes** émises en pré-validation et **fait passer l'avis de FAVORABLE SOUS RÉSERVES à FAVORABLE SANS RÉSERVE** sur le périmètre du registre d'incidents `m7_incidents`. La procédure d'escalade DPO E1-E6 (intégrée en §6.6) est désormais **opposable** et complète l'arsenal organisationnel en cas de violation de données affectant la fonctionnalité « Alerte mots de passe réutilisés ». La mention CodeQL SAST (T-187 / TACHE-108 livrée, 0 finding au 19/04/2026) renforce la mesure technique A.8.28 (Secure coding) du référentiel ISO 27001.

### 6.2 Conditions

Le traitement est autorise sous les conditions suivantes :

1. **Consentement opt-in obligatoire** : la fonctionnalité « Alerte mots de passe réutilisés » ne doit jamais s'activer sans le consentement explicite de l'utilisateur a l'etape 4 de l'onboarding. Ce point doit etre verifie par un test automatise.
2. **Nullification du mot de passe en clair** : la variable contenant le mot de passe doit etre nullifiee en moins de 5 ms apres le calcul du hash. Ce point doit etre verifie par un test automatise.
3. **Purge effective `password_hashes`** : le mecanisme FIFO 100 + purge 90 jours doit etre teste en integration pour garantir qu'aucun hash ne persiste au-dela de la duree prevue.
4. **Exclusion des hashes de l'export** : l'export de portabilite ne doit contenir que les metadonnees agregees (nombre, dates), jamais les hashes bruts.
5. **(v1.1)** **Minimisation des logs console** : aucun `console.*` direct ne doit être réintroduit dans `src/background/service-worker.ts` ou `src/background/handlers/m7-handler.ts`. Tout logging doit passer par la factory `logger.ts` et n'inclure que les champs listés au §1.8. Ce point doit être vérifié par un test statique (ESLint AST + snapshot, cf. R-REC-AIPD-01/03).
6. **(v1.1)** **Interdiction de logger `_sender.tab?.url`** : seul `_sender.tab?.id` est autorisé dans les logs d'accueil de message. Anti-régression OBS-03.
7. **(v1.3)** **Interdiction `domain_hash` brut dans `m7_incidents.context` (R-074-01)** : le typage `IncidentContext` (union discriminée, CM-ID2 mini-DAT TACHE-061) doit demeurer la signature obligatoire de `IncidentService.log()`. Tout ajout d'un nouveau type d'incident impliquant un champ pseudonymisé ou corrélable doit faire l'objet d'une **revue formelle DPO préalable** avec mise à jour de la présente AIPD §1.3 et §1.8. Règle permanente inscrite à `LESSONS_LEARNED.md`.
8. **(v1.3)** **TTL 365 jours absolue sur `m7_incidents` (R-074-02)** : la méthode `IncidentService.purgeOldEntries(maxAgeDays = 365)` doit être appelée à chaque cycle `onPurgeDaily`, sans dérogation pour la severity. Test TC-M7-30 doit rester vert en CI.
9. **(v1.3)** **Exclusion `m7_incidents` de l'export Art. 20 par défaut (R-074-03)** : `export-handler.ts` doit exclure `m7_incidents` du périmètre par défaut. L'option utilisateur explicite « Inclure mon journal de diagnostic » doit demeurer désactivée par défaut, accompagnée d'un avertissement clair.

### 6.3 Recommandations complementaires

1. **v2+ — Renforcement de la protection de la cle AES** : implementer la derivation PBKDF2 depuis un PIN utilisateur pour attenuer le risque R3 (acces via profil Chrome).
2. **Audit de securite externe** : avant la publication sur le Chrome Web Store, un audit de securite du code de la fonctionnalité « Alerte mots de passe réutilisés » par un tiers (meme benevole, dans le cadre open source) est recommande.
3. **Monitoring des vulnerabilites SHA-256** : bien que SHA-256 soit actuellement considere comme sur, surveiller les publications du NIST concernant les fonctions de hachage et prevoir une migration si necessaire.
4. **Test d'intrusion** : inclure un test specifique de resistance du hash sale aux attaques par dictionnaire dans le plan de tests de securite.
5. **(v1.1)** **Finaliser la règle ESLint AST (TACHE-104)** — sélecteur sur `VariableDeclarator > MemberExpression[property.name='message']` pour bloquer les 12 sites handlers résiduels. Impact : extension de la mitigation R-M7-08 aux fonctionnalités « Protection contre les sites frauduleux » (M2), « Score de cyber-hygiène » (M3), « Rappel de mise à jour du navigateur » (M5), « Exercices de sensibilisation au phishing » (M6), « Alerte copie de données sensibles » (M17) (complétude périmètre SW).
6. **(v1.1)** **Étendre l'inventaire aux content scripts (TACHE-105)** — ~26 sites `console.*` recensés ; priorité inférieure mais à planifier avant la publication Chrome Web Store.
7. **(v1.3)** **Bouton « Vider mon registre d'incidents » (R-074-REC-02)** — exposer une action granulaire dans la page Options pour l'effacement Art. 17 du seul `m7_incidents` sans toucher aux préférences ni aux scores.
8. **(v1.3)** **Bouton « Voir mon registre d'incidents » (R-074-REC-03)** — page de visualisation lecture seule du registre dans la page Options (transparence radicale).
9. **(v1.3)** **Tabletop annuel — scénario `m7_incidents` corrompu (R-074-REC-05)** — ajouter au tabletop d'octobre 2026 (P1 supply chain prévu) un volet : « comment exploiter / interpréter le registre `m7_incidents` lors d'un incident M7 réel ? ».

### 6.4 Mise a jour de la presente AIPD

Cette AIPD doit etre revisee dans les cas suivants :

- Modification du mecanisme de hachage ou de chiffrement
- Ajout de donnees collectees par la fonctionnalité « Alerte mots de passe réutilisés »
- Introduction d'un composant reseau (meme optionnel)
- Modification de la duree de conservation
- Signalement d'une vulnerabilite affectant SHA-256 ou AES-256-GCM
- Nouvelle version majeure de l'extension
- **(v1.1)** Ajout d'un nouveau site logger dans `service-worker.ts` ou `m7-handler.ts` avec un champ non listé au §1.8 (nouvelle MAJ requise de l'inventaire)
- **(v1.1)** Réintroduction d'un `console.*` direct (régression TACHE-083) — MAJ obligatoire
- **(v1.1)** Modification du mécanisme de stockage de la whitelist « Protection contre les sites frauduleux » (sortie de `chrome.storage.local` ou d'IndexedDB) — MAJ du §1.3
- **(v1.3)** Ajout d'un nouveau type d'incident dans `M7IncidentType` impliquant un champ pseudonymisé ou corrélable — revue DPO préalable obligatoire
- **(v1.3)** Modification de la TTL `m7_incidents` (durée différente de 365 jours ou borne FIFO différente de 500) — MAJ §1.3 / §2.3
- **(v1.3)** Ajout du registre `m7_incidents` au périmètre par défaut de l'export Art. 20 — révision majeure §2.4
- **(v1.3)** Détection d'un finding CodeQL critique non corrigé sous 30 jours — révision §4.1 et passage devant le comité sécurité

### 6.5 Validation TACHE-074 — avis FAVORABLE post-levée des 3 réserves R-074-01/02/03 (v1.3)

**Contexte historique :** TACHE-074 (note DPO du 19/04/2026, désormais résorbée dans cette v1.3) demandait la transmission du mini-DAT TACHE-061 v1.1 (§11.3 — registre d'incidents IndexedDB circulaire) au DPO pour validation de compatibilité avec l'AIPD M7 v1.2. Le DPO avait émis un avis **FAVORABLE SOUS RÉSERVES**, conditionné à la levée de trois réserves bloquantes :

1. **R-074-01** : engagement formel d'absence de `domain_hash` brut dans `context` (JSDoc + LESSONS_LEARNED).
2. **R-074-02** : TTL absolue par âge complémentaire (365 jours) en sus de la borne FIFO 500.
3. **R-074-03** : exclusion explicite du registre de l'export de portabilité Art. 20 par défaut (option utilisateur sur demande).

**Validation v1.3 — avis FAVORABLE SANS RÉSERVE** : les trois réserves sont désormais levées par les implémentations suivantes :

| Réserve | Implémentation | Tâche associée | Trace AIPD v1.3 |
|---|---|---|---|
| R-074-01 — interdiction `domain_hash` brut | Typage `IncidentContext` union discriminée + JSDoc `IncidentService.log()` + règle permanente LESSONS_LEARNED | **TACHE-158** | §1.3 (note v1.3), §2.2, §6.2 condition 7 |
| R-074-02 — TTL absolue 365 j | `IncidentService.purgeOldEntries(365)` appelée par `onPurgeDaily` + test TC-M7-30 | **TACHE-159** | §1.3 (ligne `m7_incidents`), §2.3, §6.2 condition 8 |
| R-074-03 — exclusion export Art. 20 | `export-handler.ts` exclut `m7_incidents` par défaut + option `include_m7_incidents` désactivée par défaut | **TACHE-160** | §2.4 nouvelle, §6.2 condition 9 |

**Recommandations R-074-REC-01 à 05** : intégrées en §6.3 ci-dessus (recommandations 7, 8, 9) ou en §4.2 (R-074-REC-04 bump AIPD v1.3 = présente version livrée).

**Conséquence pour le périmètre M7** : la mise en production de la fonctionnalité « Alerte mots de passe réutilisés » peut être autorisée sans réserve résiduelle DPO sur le périmètre `m7_incidents`. Les conditions §6.2 (notamment 7, 8, 9 nouvelles) doivent être maintenues en CI sous peine de régression de l'avis.

### 6.6 Articulation avec le runbook réponse à incident — Procédure d'escalade DPO en 6 étapes E1-E6 (v1.3)

**Contexte (intégration note T-115 résorbée) :** le runbook réponse à incident v1.0 (`docs/securite/runbook-reponse-incident-v1.0.md`) impose deux dispositions structurantes pour les incidents touchant la fonctionnalité « Alerte mots de passe réutilisés » :

- **Step 2 — Saisine DPO systématique** : règle de montée automatique « tout incident M7 = P0 » (runbook §3.2). Tout incident affectant le périmètre M7 (corruption canary, dérive heartbeat, exception handler, modification non planifiée des stores `password_hashes` / `m7_canary` / `m7_incidents`) déclenche une saisine DPO sans délai.
- **Step 7 — Validation DPO obligatoire avant notification utilisateurs** : le Template 6.5 du runbook (notification in-app aux utilisateurs) ne peut pas être publié sans visa DPO daté dans le journal d'incident.

**Cohérence RGPD acquise** : le DPO a confirmé en T-115 (note résorbée dans cette v1.3) que ces deux dispositions sont **pleinement cohérentes** avec le cadre RGPD du projet. Aucune disposition de l'AIPD M7 v1.2 ne contredit ces étapes ; elles renforcent au contraire la posture de l'AIPD §6.1 (avis formel de conformité conditionné à la maîtrise du risque R3 « accès via profil Chrome ») : un incident M7 réel relève précisément du scénario R3 et mérite la sévérité maximale par défaut.

**Procédure formelle d'escalade DPO en 6 étapes (E1-E6)** — intégrée à la présente AIPD v1.3 :

| Étape | Déclencheur | Action obligatoire | Délai | Responsable |
|---|---|---|---|---|
| **E1 — Notification automatique DPO** | Incident classé P0 par règle automatique « tout incident M7 = P0 » (runbook §3.2) | Invocation immédiate du DPO Fabrique par l'Incident Manager via Claude Code, écrite et tracée dans le journal d'incident | **Dans les 24 h ouvrées** suivant Step 2 | Incident Manager |
| **E2 — Avis DPO sur qualification RGPD** | Réception de la notification E1 | Le DPO produit un avis écrit dans le journal d'incident : (a) qualification de violation au sens Art. 4(12) RGPD (oui/non/à investiguer), (b) recommandation Art. 33 (notification CNIL oui/non + délai), (c) recommandation Art. 34 (notification personnes concernées oui/non + canal) | **Dans les 48 h ouvrées** suivant E1 | DPO |
| **E3 — Décision Art. 33 (CNIL)** | Avis E2 reçu | Le responsable de traitement (utilisateur final pour le traitement local ; éditeur pour les vulnérabilités introduites par le code) prend la décision sur avis DPO. La notification CNIL, si due, doit être faite dans les **72 h** à compter de la prise de connaissance | Sous 72 h Art. 33 | Responsable de traitement |
| **E4 — Décision Art. 34 (personnes)** | Avis E2 reçu, décision E3 prise | Validation DPO **obligatoire** du Template 6.5 du runbook (notification utilisateurs) avant toute publication. Aucune notification ne peut être diffusée (in-app, README, blog) sans visa DPO daté dans le journal d'incident | Avant Step 9 (release publiée) | DPO |
| **E5 — Documentation au registre violations** | Step 9 complétée | Inscription de l'incident au §8 du registre Art. 30 (table « Registre des violations ») avec ID VIOL-XXX, date, nature, données impactées, mesures, statuts notifications | Sous 7 jours après Step 9 | DPO |
| **E6 — Capitalisation post-mortem** | Step 10 du runbook | Le DPO co-relit le post-mortem `gouvernance-pv-postmortem-sec-YYYYMMDD-vX.X.md` (section 4 « Impact », section 8 « Capitalisation ») et propose les enrichissements RGPD (mise à jour AIPD M7, registre Art. 30, politique confidentialité) | Sous 14-30 j après Step 9 | DPO + Incident Manager |

**Tracabilité dans le journal d'incident** : chaque étape E1 à E6 produit **une entrée datée et signée DPO** dans le journal d'incident (`docs/securite/incidents/YYYYMMDD-advisory-GHSA-XXXX.md`). Format type :

```markdown
### [DPO] YYYY-MM-DD HH:MM — E2 Avis qualification RGPD
- Qualification violation Art. 4(12) : OUI / NON / À INVESTIGUER
- Recommandation Art. 33 : <oui/non> — délai restant : XXh
- Recommandation Art. 34 : <oui/non> — canal proposé : <Template 6.5 / autre>
- Justification : <2-3 lignes factuelles>
- Visa DPO : DPO Fabrique
```

**Condition d'auto-saisine** : en l'absence de signalement explicite par l'Incident Manager (cas pathologique : oubli, sous-estimation), le DPO **s'auto-saisit** dès qu'il prend connaissance d'un évènement répondant à l'un des critères suivants :

- Incident classé P0 ou P1 dans le journal d'incident projet.
- Modification non planifiée du store `password_hashes`, `m7_canary` ou `m7_incidents`.
- Mention publique (README, advisory, communauté) d'un comportement anormal du module M7.

L'auto-saisine est tracée par une entrée E1 dans le journal d'incident avec mention explicite « Saisine DPO à l'initiative du DPO (auto-saisine) ».

**Articulation Art. 33 / Art. 34** : le registre Art. 30 §8 (« Registre des violations ») mentionne explicitement Art. 33 (notification CNIL < 72h) et Art. 34 (notification personnes concernées si risque élevé). La validation DPO de E4 conditionne la communication aux utilisateurs ; la décision E3 (notification CNIL) reste de la responsabilité du responsable de traitement (qualification triple : utilisateur final pour le traitement local, éditeur pour les vulnérabilités code) sur avis DPO E2. Cette articulation est à maintenir dans tout bump runbook v1.x ou registre Art. 30 v1.x.

---

## 7. Diagramme de flux de données personnelles (intégration v1.1 / mise à jour v1.3)

Le diagramme de flux de données personnelles reste celui de l'AIPD v1.0 (voir section dédiée dans le DAT v1.4 §8.1). **La mise à jour v1.3 n'introduit pas de nouveau flux** — elle documente explicitement :

- Le flux whitelist « Protection contre les sites frauduleux » déjà existant (chrome.storage.local ↔ IndexedDB ↔ content script) comme partageant le périmètre `chrome.storage.local` avec la fonctionnalité « Alerte mots de passe réutilisés » (clé AES, sel) — §1.3 v1.1
- Les flux de logs Service Worker et « Alerte mots de passe réutilisés » vers la console navigateur (non persistés, non transmis réseau) — §1.8
- Le flux du registre d'incidents `m7_incidents` (write-only depuis service-worker / m7-handler / m7-services vers IDB store, read-only depuis page Options pour transparence — §1.3 v1.3, exclu de l'export Art. 20 par défaut — §2.4 v1.3)

Aucun flux réseau, aucun flux vers un tiers, aucun flux hors UE.

---

**Risque R-007 (RISQUES.md) :** Cette AIPD repond a l'exigence documentee dans R-007 (score 8, statut Ouvert). Le statut peut etre passe a "Resolu" apres validation par le referent qualite et le Commanditaire.

**Risque R-M7-08 (RISQUES.md) :** La section §1.8 de la v1.1 documente l'inventaire exhaustif des logs console du périmètre « Alerte mots de passe réutilisés » demandé par le comité de revue code TACHE-061 §11. La mitigation technique (TACHE-083, factory `logger.ts`) est **effective** pour les 13 sites identifiés dans `service-worker.ts` et `m7-handler.ts`. La v1.3 étend la mitigation au registre `m7_incidents` via la discipline `IncidentContext` typée (R-074-01 / TACHE-158). Le scope résiduel (TACHE-105 content scripts) est **hors périmètre « Alerte mots de passe réutilisés »** mais tracé dans les recommandations complémentaires.

---

## Annexe A — Table de correspondance code module / titre user-friendly (v1.2 / mise à jour v1.3)

Pour traçabilité entre la présente AIPD (document interne, destiné aux autorités et au DPO) et la politique de confidentialité v1.2 (document public, destiné aux utilisateurs) :

| Code module (interne, DAT/SFD/code) | Titre user-friendly (politique v1.2 + titres de sections AIPD v1.3) |
|---|---|
| M2 (Typosquatting + HSTS) | Protection contre les sites frauduleux |
| M3 (Score hebdomadaire) | Score de cyber-hygiène |
| M5 (Mise à jour navigateur) | Rappel de mise à jour du navigateur |
| M6 (Quiz phishing) | Exercices de sensibilisation au phishing |
| **M7 (Réutilisation mots de passe)** | **Alerte mots de passe réutilisés** (objet de la présente AIPD) |
| **M9 (Évaluation force mot de passe — zxcvbn-ts)** | **Détection de mots de passe faibles** (correction v1.3 — précédemment libellé « Alerte connexion non sécurisée » par confusion avec un module hypothétique de détection MITM, désormais aligné sur la définition canonique du code source `src/shared/types/modules.ts` et de la politique v1.2 §3) |
| M17 (Presse-papiers sensible) | Alerte copie de données sensibles |

**Note v1.3 — Correction Annexe A** : la correspondance « M9 = Alerte connexion non sécurisée » mentionnée dans l'AIPD v1.2 était **erronée** — il s'agissait d'un libellé hypothétique de module de détection MITM/certificats invalides, qui ne correspond pas à la définition canonique de M9 dans le code source (`ModuleId = 'M2' | 'M3' | 'M5' | 'M6' | 'M7' | 'M9' | 'M17'`, où M9 = évaluation force mot de passe via zxcvbn-ts). La correction v1.3 aligne l'annexe A sur le code et sur la politique v1.2 §3 (qui liste 7 fonctionnalités sans module hypothétique MITM). Le registre des traitements v1.0 (RT-M9 « Détection certificat invalide / MITM ») contient la même erreur historique, à corriger lors du bump v1.1 du registre (T-155).

Les titres de section de la présente AIPD v1.3 utilisent la formulation user-friendly avec le code module en parenthèse (ex. `### 1.3 Données traitées — Alerte mots de passe réutilisés (M7)`), conformément au feedback Commanditaire du 2026-04-19.

---

_AIPD produite par le DPO — Fabrique — v1.0 2026-04-11, v1.1 2026-04-18, v1.2 2026-04-19, v1.3 2026-04-19_
_Conforme a l'article 35 du RGPD et aux lignes directrices du CEPD (WP248 rev.01)_
_Conforme au guide AIPD de la CNIL (PIA, version 2018)_
_Alignée avec le registre des traitements Art. 30 v1.0 (docs/rgpd/registre-des-traitements-v1.0.md) — bump v1.1 attendu (T-155) pour aligner durées weekly_scores/quiz_sessions et corriger RT-M9_
_Alignée avec la politique de confidentialité v1.2 (docs/rgpd/politique-de-confidentialite-v1.2.md)_
_Alignée avec le runbook réponse à incident v1.0 (docs/securite/runbook-reponse-incident-v1.0.md) §3.2 et §6.5 via §6.6 de la présente AIPD_
_Notes additives DPO T-074 et T-115 résorbées dans cette v1.3 — règle Commanditaire 19/04 anti-démultiplication des documents_
