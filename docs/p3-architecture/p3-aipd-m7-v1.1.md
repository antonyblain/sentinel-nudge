# Analyse d'Impact relative a la Protection des Donnees (AIPD) — Module M7

**Projet :** Sentinel Nudge
**Module :** M7 — Nudge d'adoption gestionnaire de mots de passe
**Version :** 1.1
**Date de production v1.0 :** 2026-04-11
**Date de mise a jour v1.1 :** 2026-04-18
**Auteur :** DPO (Fabrique)
**Niveau de sensibilite :** Expose
**Base reglementaire :** Article 35 du RGPD (Reglement UE 2016/679)
**Decision declenchante :** D-SEC-005 (PV comite securite P2, DAT v1.1 section 9.4)

**Documents de reference :**

- `p3-dat-v1.3.md` — sections 8.1, 8.2, 8.3, 9.4 (anciennement `p3-dat-v1.1.md`, renommé lors du bump v1.3 — TACHE-071 UC-04)
- `p2-sfd-v1.1.md` — section 2.5
- `p1-cahier-des-charges-v1.1.md` — sections M7, 3.1 (Privacy by Design)
- `gouvernance-pv-securite-p2-v1.0.md`
- `docs/rgpd/politique-de-confidentialite-v1.0.md` — §4.1 (M2) et §4.5 (M7)
- `docs/rgpd/registre-des-traitements-v1.0.md` — RT-M2, RT-M7, RT-PARAM (Art. 30 RGPD)
- RISQUES.md — R-001, R-003, R-007, **R-M7-08** (fuite informationnelle via console)

---

## Historique des versions

| Version | Date | Diff resume | Auteur |
|---------|------|-------------|--------|
| v1.0 | 2026-04-11 | AIPD initiale (10 sections, 5 risques R1-R5, 314 lignes) | DPO Fabrique |
| **v1.1** | **2026-04-18** | **Enrichissement dual TACHE-040 + TACHE-084 :** (1) §1.3 complete avec `chrome.storage.local` comme lieu de stockage de la whitelist M2 (alignement avec RT-M2 et politique §4.1) ; (2) nouvelle section §1.8 « Inventaire des logs console et champs loggés » exhaustive sur service-worker.ts et m7-handler.ts (validation OBS-03, cohérence R-M7-08, traçabilité TACHE-083) ; (3) mise à jour §6.4 « Déclencheurs de révision » pour tracer cette mise à jour | DPO Fabrique |

**Conventions de nommage documentaire :** conformément à la règle FICHIERS.md du plugin, les modifications de cette AIPD restent une version mineure (v1.0 → v1.1) car il s'agit d'enrichissements additifs (aucun contenu v1.0 supprimé, aucune révision sur le fond des risques ou de la base légale).

---

## 1. Description du traitement

### 1.1 Finalite

Ameliorer la cyber-hygiene de l'utilisateur en detectant la reutilisation de mots de passe sur plusieurs domaines distincts. Lorsqu'une reutilisation est detectee, un nudge (toast non bloquant) est affiche pour sensibiliser l'utilisateur a l'adoption d'un gestionnaire de mots de passe open source (KeePass, KeePassXC, Bitwarden, Vaultwarden).

Le traitement poursuit un objectif exclusif de protection de l'utilisateur. Il ne vise ni la surveillance, ni le profilage, ni la monetisation des donnees.

### 1.2 Base legale

**Consentement explicite (Article 6.1.a du RGPD).**

Le module M7 est active par opt-in lors de l'onboarding de l'extension (etape 4 — politique de confidentialite). L'utilisateur doit activer explicitement le module avant tout traitement. Le consentement est :

- **Libre** : M7 est desactivable independamment des autres modules. L'extension fonctionne sans M7.
- **Specifique** : le consentement porte uniquement sur le traitement de hash de mots de passe pour la detection de reutilisation.
- **Eclaire** : la page de politique de confidentialite explique en langage clair le fonctionnement du traitement, les donnees collectees, leur duree de conservation et les droits de l'utilisateur.
- **Univoque** : l'activation se fait par case a cocher dediee dans l'onboarding.

Le consentement est revocable a tout moment via la page de parametres de l'extension.

### 1.3 Donnees traitees

**v1.1 — MAJ TACHE-040 :** la colonne « Stockage » explicite désormais les lieux de stockage pour chaque donnée, et introduit la whitelist M2 (hashs FNV-1a de domaines) comme donnée stockée dans `chrome.storage.local` **en complément** d'IndexedDB. Cette mise à jour aligne l'AIPD M7 sur le registre Art. 30 RGPD (RT-M2, RT-PARAM) et sur la politique de confidentialité v1.0 §4.1.

| Donnee                                                  | Nature                  | Stockage                                                               | Duree de conservation          |
| ------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| `password_value` (mot de passe en clair)                | Donnee sensible         | **Jamais stocke** — efface en memoire < 5 ms apres hachage (D-SEC-001) | 0 seconde                      |
| `password_hash` (SHA-256(installation_salt + password)) | Donnee pseudonymisee    | IndexedDB, champ `value` chiffre AES-256-GCM                           | 90 jours FIFO max 100 entrees  |
| `tag` (4 premiers bytes du hash)                        | Index de pre-filtration | IndexedDB, en clair                                                    | 90 jours                       |
| `domain_hash` (SHA-256(installation_salt + domain))     | Donnee pseudonymisee    | IndexedDB, en clair                                                    | 90 jours                       |
| `first_seen` (horodatage)                               | Metadonnee              | IndexedDB, en clair                                                    | 90 jours                       |
| `count` (nombre de detections)                          | Metadonnee              | IndexedDB, en clair                                                    | 90 jours                       |
| `installation_salt` (16 bytes, 128 bits)                | Cle de salage           | chrome.storage.local                                                   | Duree de vie de l'installation |
| **`whitelist` M2 (hashs FNV-1a de domaines de confiance)** (v1.1) | Preference utilisateur (hash non reversible) | **`chrome.storage.local` (cache session) + IndexedDB (store `whitelist`)** | **Jusqu'a suppression explicite par l'utilisateur** |

**Précisions (v1.1) sur la whitelist M2 :**

- **Double stockage justifié** : `chrome.storage.local` sert de cache de session pour une lecture rapide par le content script (pas de tour via le service worker), IndexedDB sert de source de vérité persistante et de store auditable pour l'export portabilité (Art. 20 RGPD). Cohérence P-018 (validation JSON stricte) et `initBoot()` M2 avec contrôle d'intégrité (TACHE-085).
- **Nature cryptographique** : hash FNV-1a 32 bits non réversible. FNV-1a est un hash d'indexation rapide, **non cryptographiquement sûr** contre une attaque par dictionnaire, mais acceptable ici car (a) les domaines visités ne sont jamais associés à un identifiant utilisateur, (b) l'espace des domaines populaires est fini et l'information révélée serait de toute façon déductible par un attaquant ayant accès au profil navigateur (voir R2 existant dans cette AIPD, R3 pour le modèle de menace profil).
- **Lien avec M7** : la whitelist M2 est **non liée à M7 fonctionnellement** mais elle partage le stockage `chrome.storage.local` avec la clé AES et le sel d'installation M7. Un attaquant compromettant le stockage local accède donc aux deux périmètres. Ce point est tracé dans R3 (Accès via profil Chrome) et dans la politique §10.3.
- **Référence registre Art. 30** : cette donnée est documentée dans **RT-M2** (`docs/rgpd/registre-des-traitements-v1.0.md` §3.1) et dans **RT-PARAM** (§3.8) pour la partie préférences. L'AIPD M7 la mentionne ici pour **traçabilité du périmètre `chrome.storage.local`** vu par l'attaquant (complétude du modèle de menace), pas parce qu'elle relèverait du traitement M7 au sens fonctionnel.

### 1.4 Responsable de traitement

L'utilisateur lui-meme est responsable de traitement au sens de l'article 4(7) du RGPD. Le traitement est integralement local : aucune donnee ne quitte le navigateur, aucun serveur n'est implique, aucune communication reseau n'est etablie.

Sentinel Nudge est un outil mis a disposition de l'utilisateur. L'editeur fournit le code source (licence GPL v3) mais ne collecte, ne recoit et ne traite aucune donnee personnelle des utilisateurs.

### 1.5 Sous-traitants

**Aucun.** Le traitement est integralement realise sur le poste de l'utilisateur par l'extension navigateur. Aucun service tiers, aucune API externe, aucun serveur distant n'intervient dans le traitement des donnees de M7.

### 1.6 Destinataires des donnees

**Aucun.** Les donnees ne sont accessibles que par l'extension elle-meme, dans le perimetre du profil Chrome de l'utilisateur. Aucune transmission, aucun partage, aucune exportation automatique.

### 1.7 Transferts hors UE

**Aucun.** Toutes les donnees restent dans le stockage local du navigateur sur le poste de l'utilisateur.

### 1.8 Inventaire des logs console et champs loggés (v1.1 — TACHE-084)

**Contexte :** la TACHE-061 (heartbeat M7 + canary hash + registre d'incidents) a introduit des logs techniques dans le service worker et dans le handler M7 pour tracer le cycle de vie du boot. Le comité de revue code a soulevé le risque **R-M7-08** (fuite informationnelle via console) : bien que les logs `console.*` ne quittent jamais le navigateur (pas de télémétrie réseau), ils peuvent être lus par tout outil accédant à la console du service worker (DevTools, extension malveillante avec permission `management` ou `debugger`, test de reproduction d'incident partagé publiquement par l'utilisateur).

**Mitigation appliquée (TACHE-083) :** migration de tous les `console.*` directs du service worker et du handler M7 vers une **factory `logger.ts`** (`src/shared/utils/logger.ts`, imports `createLogger` + `Logger`). La factory applique :

1. **Minimisation du payload** : `Logger.errorName(err)` est utilisé à la place de `err.message` pour ne logger que le **nom de la classe d'erreur** (ex. `TypeError`, `QuotaExceededError`) et non le message détaillé susceptible de contenir un chemin, une clé, une valeur utilisateur.
2. **Signature typée** : `logger.info(msg, context?)` avec `context` en objet structuré, facilitant une revue statique (ESLint AST rule prévue TACHE-083 étape 2, scope résiduel TACHE-104).
3. **Namespace explicite** : chaque site logger a un préfixe (`ServiceWorker`, `M7Handler`, etc.) pour la traçabilité sans recours à `fichier:ligne` dans le payload.

**Validation post-TACHE-061 (OBS-03) :** la revue a identifié l'usage de `_sender.tab?.url` (URL complète potentiellement PII) dans un log d'accueil de message. **OBS-03 a été corrigé :** le site `m7-handler.ts:507` logge désormais `tab_id: _sender.tab?.id` et non l'URL. Vérification effectuée sur la révision courante : `grep "sender.tab" m7-handler.ts` → une seule occurrence, `_sender.tab?.id`, aucune occurrence résiduelle de `_sender.tab?.url`. Conformité OBS-03 **confirmée**.

**Inventaire exhaustif des sites logger M7 (v1.1) :**

#### A. `src/background/service-worker.ts` — logger `swLogger` (namespace `ServiceWorker`)

| # | Fichier:ligne | Sévérité | Message | Champs loggés dans `context` | Évaluation RGPD |
|---|---------------|----------|---------|------------------------------|-----------------|
| SW-01 | `service-worker.ts:279-282` | `warn` | `purgePendingIntents: erreur sur clé individuelle` | `hint: 'storage_purge_failed'`, `error_name: Logger.errorName(err)` | **OK** — pas de clé utilisateur, pas de valeur, classe d'erreur uniquement |
| SW-02 | `service-worker.ts:286-290` | `info` | `purgePendingIntents: purge terminée` | `hint: 'storage_hygiene'`, `scanned: pendingKeys.length` (entier), `purged: purgedCount` (entier) | **OK** — compteurs agrégés uniquement |
| SW-03 | `service-worker.ts:577-578` | `info` | `SW init: installation_in_progress — IIFE boot skipped (TACHE-079)` | (aucun) | **OK** — pas de payload |
| SW-04 | `service-worker.ts:607-611` | `warn` | `SW init: encryption_key_material absent — régénération automatique (INV-SEC-03)` | `boot_count: diagnostics.boot_count` (entier, compteur de boots SW) | **OK** — compteur non corrélable à une PII, utile diagnostic |
| SW-05 | `service-worker.ts:737-742` | `info` | `SW init: boot sequence complete` | `modules: ['M2','M3','M5','M6','M7','M9','M17','EXPORT']` (liste statique), `duration_ms: bootMs` (entier), `boot_count: diagnostics.boot_count` | **OK** — métriques techniques agrégées |
| SW-06 | `service-worker.ts:751-755` | `error` | `SW init: boot sequence failed` | `boot_count: diagnostics.boot_count`, `error_name: Logger.errorName(err)` (pas de `err.message`) | **OK** — nom de classe d'erreur uniquement, pas de message |

#### B. `src/background/handlers/m7-handler.ts` — logger `logger` (namespace `M7Handler`)

| # | Fichier:ligne | Sévérité | Message | Champs loggés dans `context` | Évaluation RGPD |
|---|---------------|----------|---------|------------------------------|-----------------|
| M7-01 | `m7-handler.ts:301` | `info` | `readPendingM7Toast: migration legacy timestamp → expires_at effectuée` | (aucun) | **OK** — pas de payload |
| M7-02 | `m7-handler.ts:304-306` | `error` | `readPendingM7Toast: erreur ré-écriture migration` | `error_name: Logger.errorName(migrErr)` | **OK** — classe d'erreur uniquement |
| M7-03 | `m7-handler.ts:326-329` | `info` | `readPendingM7Toast: toast expiré supprimé` | `expires_at: toast.expires_at` (timestamp ms epoch), `overdue_ms: Date.now() - toast.expires_at` (entier ms) | **OK** — timestamps techniques relatifs, pas de domaine ni de hash |
| M7-04 | `m7-handler.ts:335-337` | `error` | `readPendingM7Toast: erreur lecture storage` | `error_name: Logger.errorName(err)` | **OK** — classe d'erreur uniquement |
| M7-05 | `m7-handler.ts:389` | `error` | `Erreur toast action` | `error_name: Logger.errorName(err)` | **OK** — classe d'erreur uniquement |
| M7-06 | `m7-handler.ts:473` | `error` | `Erreur traitement` | `error_name: Logger.errorName(err)` | **OK** — classe d'erreur uniquement |
| M7-07 | `m7-handler.ts:507` | `info` | `message recu` | `action: msg.action` (enum de type de message), **`tab_id: _sender.tab?.id`** (entier, id technique de tab Chrome, non PII, non persistant après fermeture du tab) | **OK (post-OBS-03)** — `_sender.tab?.id` et **non** `_sender.tab?.url` conformément à la correction OBS-03. Le `tab.id` Chrome est un entier incrémental local au navigateur, ne survit pas à un redémarrage, non corrélable à un identifiant utilisateur externe |

**Total : 13 sites logger actifs pour le périmètre M7** (6 service-worker + 7 m7-handler). Aucun `console.*` direct résiduel n'a été détecté dans ces deux fichiers (`grep -n "console\." service-worker.ts m7-handler.ts` → 3 résultats, tous des commentaires pédagogiques référençant R-M7-08/TACHE-083, ligne 577, 607, 737 du service worker ; aucun appel effectif).

**Champs absents de l'inventaire (confirmation de non-logging) :**

| Champ | Pourquoi exclu ? | Invariant sécurité |
|-------|------------------|--------------------|
| `err.message` | Peut contenir path, clé, valeur utilisateur | R-M7-08 mitigation / TACHE-083 |
| `String(err)` | Idem `err.message` | TACHE-083 règle ESLint AST cible |
| `hostname` brut | Serait un domaine visité (PII indirecte) | R-M7-08 / INV-SEC-02 |
| `domain_hash` brut | Bien que pseudonymisé, reste de trop faible utilité en log | Minimisation Art. 5.1.c |
| `password_hash` | Donnée sensible AIPD §1.3 | INV-SEC-01 |
| `installation_salt` | Compromet l'utilité cryptographique si exposé | D-SEC-001 |
| `URL complète` (`_sender.tab?.url`) | PII directe | **OBS-03 correctif appliqué** |
| Contenu saisi (input password) | Valeur sensible M7 | INV-SEC-02 / R-002 |
| Contenu presse-papiers M17 | Donnée sensible type cb/iban/ssn | R-CLI-07 / INV-SEC-02 |

**Cohérence avec R-M7-08 (RISQUES.md) :** le risque de fuite informationnelle par la console est désormais **mitigé au niveau code** pour les 13 sites M7 (service-worker + m7-handler). La règle ESLint AST complémentaire (TACHE-083 étape 2) est **partiellement livrée** : elle couvre le pattern `console.*(..., err.message, ...)` direct, mais ne capture pas encore le pattern `const message = err.message; logger.error(msg, { message })` dans les handlers M2/M3/M5/M6/M17 résiduels (12 sites identifiés, TACHE-104). Ces sites résiduels **sont hors périmètre M7** mais sont tracés pour complétude.

**Recommandations DPO (v1.1) :**

1. **R-REC-AIPD-01** — **Finaliser la règle ESLint AST (TACHE-104)** : sélecteur `VariableDeclarator > MemberExpression[property.name='message']` dans un callee logger, pour bloquer systématiquement la capture de `err.message` dans les 12 sites résiduels handlers.
2. **R-REC-AIPD-02** — **Étendre l'inventaire aux content scripts (TACHE-105)** : environ 26 sites `console.*` recensés dans password-detector/dashboard/onboarding/options/popup. Priorité inférieure car les content scripts exposent moins la console du service worker, mais à tracer pour un prochain AIPD bump quand TACHE-105 sera planifiée.
3. **R-REC-AIPD-03** — **Tests automatisés anti-régression** : ajouter un test unitaire/statique (snapshot) qui échoue si un `_sender.tab?.url` apparaît dans un argument de logger/console dans `src/background/**`. Protection contre régression OBS-03. À cadrer avec testeur QA (lien TACHE-059/082).
4. **R-REC-AIPD-04** — **Revue trimestrielle** : le DPO refait un `grep console\.\|logger\.` sur `src/background/**` chaque trimestre et compare à cet inventaire §1.8 pour détecter toute dérive. Cadence alignée sur TACHE-117 (matrice providers trimestrielle).

**Cohérence avec le registre Art. 30 :**

- **RT-M7** (registre des traitements v1.0 §3.5) — aucune mention de logs dans les « données traitées » car les logs ne sont **pas des données traitées au sens RGPD** (pas de finalité métier, éphémères dans la console navigateur, non persistés au-delà du cycle de vie du service worker). Cette AIPD §1.8 documente néanmoins le périmètre pour transparence et alignement avec R-M7-08.
- **RT-PARAM** (§3.8) — aucune interaction.
- **Registre d'incidents IndexedDB** (store `m7_incidents` introduit par TACHE-061) — **hors périmètre §1.8** car il s'agit d'un registre persistant et structuré, déjà documenté dans RT-M7 (mesure organisationnelle) et dans le mini-DAT TACHE-061 v1.1 §11.3 (soumis au DPO via TACHE-074, voir §6.5 ci-dessous).

---

## 2. Necessite et proportionnalite

### 2.1 Necessite du traitement

La reutilisation de mots de passe est l'une des premieres causes de compromission de comptes. La litterature en sciences comportementales (cf. analyse de litterature P1) montre que les utilisateurs sous-estiment systematiquement ce risque. Le nudge contextuel, declenche au moment precis de la reutilisation, constitue l'intervention la plus efficace pour modifier ce comportement.

Le traitement de hash de mots de passe est techniquement indispensable pour detecter la reutilisation. Sans comparaison entre les mots de passe soumis sur differents domaines, la detection est impossible.

### 2.2 Minimisation des donnees

Le principe de minimisation (article 5.1.c du RGPD) est strictement respecte :

- **Mot de passe en clair** : jamais stocke, efface en memoire en moins de 5 ms apres hachage.
- **Hash sale** : seul le hash SHA-256(installation_salt + password) est conserve, rendant la reconstitution du mot de passe couteuse en calcul.
- **Domaine** : jamais stocke en clair, uniquement sous forme de hash sale SHA-256(installation_salt + domain).
- **URL complete** : jamais collectee.
- **Identifiant utilisateur** : aucun (pas d'UUID, pas de fingerprinting, pas de cookie — ENF-PBD-06).
- **Chiffrement au repos** : le hash du mot de passe est chiffre AES-256-GCM dans IndexedDB (ENF-PBD-04).
- **(v1.1) Logs minimisés** : la factory `logger.ts` interdit le logging de `err.message`, `hostname`, `domain_hash`, `password_hash` et toute URL complète (cf. §1.8). Le nom de classe d'erreur (`Logger.errorName`) est la seule information d'erreur loggée.

### 2.3 Limitation de la conservation

- **Duree maximale** : 90 jours glissants.
- **Volume maximal** : 100 entrees (FIFO — First In, First Out).
- **Purge automatique** : alarme hebdomadaire (lundi 09h) declenchee par le service worker. Suppression des enregistrements dont `first_seen < now - 90 jours`, puis suppression des plus anciens si le seuil de 100 est depasse.
- **Purge manuelle** : bouton "Supprimer toutes mes donnees" dans la page Options qui execute `indexedDB.deleteDatabase('sentinel-nudge-db')` et `chrome.storage.local.clear()`.

### 2.4 Information des personnes concernees

- **Onboarding** : explication en langage clair du fonctionnement de M7 lors de l'etape 4 de l'onboarding.
- **Page de politique de confidentialite** : accessible depuis l'onboarding et la page de parametres (ENF-PBD-08).
- **Page d'explication M7** : page statique dediee accessible depuis le toast nudge ("Voir comment ca marche").
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

**Note v1.1 — Périmètre whitelist M2 :** la whitelist M2 (hashs FNV-1a 32 bits) est **plus faible cryptographiquement** que les domain_hash M7 (SHA-256 salé 256 bits). Un attaquant ayant accès au stockage local peut plus facilement mener une attaque par dictionnaire sur la whitelist M2. Ce point est hors périmètre strict de M7 mais documenté ici pour complétude du modèle de menace `chrome.storage.local`. La whitelist M2 ne révèle que les domaines **explicitement marqués de confiance par l'utilisateur** (ensemble généralement de très petite cardinalité — <10 domaines typiques), limitant la gravité.

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

**Description :** Les donnees de M7 (nombre de reutilisations, frequence, compteur de detections) pourraient etre utilisees pour etablir un profil des habitudes de securite de l'utilisateur.

**Sources de risques :** Exploitation par un tiers ayant acces au profil Chrome. Scenario theorique : un employeur accedant au profil Chrome d'un employe.

**Vraisemblance :** Negligeable. Les donnees sont locales, chiffrees, non transmises. Le profilage n'est possible qu'avec un acces physique ou logique au profil Chrome, et les donnees brutes (hashes et compteurs) ne permettent pas un profilage detaille sans analyse complementaire.

**Gravite :** Limitee. Le profilage se limiterait a savoir que l'utilisateur reutilise des mots de passe (information generique) et a estimer la frequence.

**Mesures de mitigation existantes :**

- Aucune transmission de donnees
- Chiffrement au repos
- Purge automatique a 90 jours
- Pas d'identifiant persistant
- Export de portabilite excluant les hashes de mots de passe (seules les metadonnees agregees sont exportees)

### R5 — Perte de controle des donnees (defaut de consentement ou d'effacement)

**Description :** L'utilisateur pourrait ne pas etre informe du traitement, ne pas pouvoir retirer son consentement, ou ne pas pouvoir exercer son droit a l'effacement.

**Sources de risques :** Defaut d'implementation de l'onboarding, bug empechant la desactivation du module ou la suppression des donnees.

**Vraisemblance :** Negligeable. Le consentement est obtenu par opt-in explicite dans l'onboarding (etape 4). La desactivation du module et l'effacement des donnees sont accessibles en 1 clic dans la page de parametres. Le code source est ouvert et auditable.

**Gravite :** Importante. L'absence de controle sur ses donnees constitue une violation directe des droits fondamentaux de la personne concernee (articles 7, 17 et 20 du RGPD).

**Mesures de mitigation existantes :**

- Consentement opt-in explicite a l'onboarding (etape 4)
- Desactivation du module M7 a tout moment via les parametres
- Bouton "Supprimer toutes mes donnees" (article 17 — droit a l'effacement)
- Bouton "Exporter mes donnees" (article 20 — droit a la portabilite) avec exclusion des hashes bruts
- Code source ouvert (GPL v3) permettant l'audit

---

## 4. Mesures envisagees pour traiter les risques

### 4.1 Mesures techniques

| Mesure                                                               | Reference       | Risques couverts |
| -------------------------------------------------------------------- | --------------- | ---------------- |
| Sel local 128 bits unique par installation                           | D-SEC-001       | R1, R2           |
| Chiffrement AES-256-GCM au repos des hashes                          | NC-DPO-01       | R1, R2, R3       |
| Nullification mot de passe en clair < 5 ms                           | D-SEC-001       | R1               |
| FIFO 100 entrees maximum                                             | SFD M7          | R1, R2, R4       |
| Purge automatique 90 jours                                           | DAT section 8.3 | R1, R2, R4       |
| Index de pre-filtration `tag` (4 bytes) sans exposer le hash complet | DAT section 8.1 | R1               |
| Aucun appel reseau sortant                                           | ENF-PBD-01      | R1, R2, R3, R4   |
| CSP stricte (script-src 'self')                                      | D-SEC-003       | R3               |
| Exclusion des hashes bruts de l'export de portabilite                | DAT section 8.3 | R1               |
| **(v1.1) Factory `logger.ts` avec minimisation systématique** | TACHE-083 / R-M7-08 | **R-M7-08 (fuite console)** |
| **(v1.1) `Logger.errorName` substitué à `err.message`** | TACHE-083 / AIPD §1.8 | **R-M7-08** |

### 4.2 Mesures organisationnelles

| Mesure                                                    | Reference      | Risques couverts   |
| --------------------------------------------------------- | -------------- | ------------------ |
| Code source ouvert (GPL v3)                               | CdC            | R1, R2, R3, R4, R5 |
| Documentation technique publique                          | DAT, SFD       | R5                 |
| Transparence radicale (page Options, page explication M7) | ENF-PBD-08     | R5                 |
| Tests automatises (Vitest + Playwright) en CI             | DAT section 10 | R5                 |
| Revue de code obligatoire (comite de revue code)          | Gouvernance    | R1, R3             |
| **(v1.1) Revue trimestrielle inventaire logs M7 par DPO** | AIPD §1.8 R-REC-AIPD-04 | **R-M7-08** |
| **(v1.1) Règle ESLint AST anti `err.message` (partielle, TACHE-083/104)** | TACHE-083/104 | **R-M7-08** |

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
| R1 — Reidentification par dictionnaire | Limitee                  | Importante         | Modere          | **Acceptable** — sel 128 bits + chiffrement AES-256-GCM + FIFO 100 rendent l'attaque couteuse et limitee dans le temps |
| R2 — Correlation des domaines          | Limitee                  | Limitee            | Faible          | **Acceptable** — sel 128 bits + purge 90 jours + domaines sans URL completes                                           |
| R3 — Acces via profil Chrome           | Limitee                  | Importante         | Modere          | **Acceptable** — risque inherent au modele de securite Chrome, hors perimetre de l'extension. Documente.               |
| R4 — Profilage habitudes               | Negligeable              | Limitee            | Faible          | **Acceptable** — donnees locales, chiffrees, non transmises, purgees automatiquement                                   |
| R5 — Perte de controle                 | Negligeable              | Importante         | Faible          | **Acceptable** — consentement opt-in, effacement 1 clic, code ouvert, tests automatises                                |

**Note v1.1 :** le risque R-M7-08 (fuite informationnelle via console), identifié lors du comité de revue code TACHE-061, n'est **pas un risque AIPD au sens strict** (il n'affecte pas directement les droits des personnes concernées dans un scénario de fonctionnement nominal, car les logs ne sortent pas du navigateur). Il est néanmoins **tracé comme risque sécurité** dans RISQUES.md et **mitigé au niveau code** via TACHE-083 (factory `logger.ts`) et documenté dans §1.8 de la présente AIPD. Aucune ligne supplémentaire dans la matrice §5.1 car son niveau résiduel post-mitigation est **négligeable/négligeable** (hors canevas).

---

## 6. Conclusion et avis du DPO

### 6.1 Avis formel

**Le traitement mis en oeuvre par le module M7 de Sentinel Nudge est conforme au RGPD.** Les risques identifies sont maitrises par un ensemble de mesures techniques, organisationnelles et juridiques coherentes et proportionnees.

Le niveau de risque residuel global est **faible a modere**, ce qui est acceptable au regard de la finalite du traitement (amelioration de la cyber-hygiene) et de l'architecture Privacy by Design mise en oeuvre (traitement 100% local, aucune transmission, chiffrement au repos, purge automatique).

**Avis v1.1 :** les enrichissements TACHE-040 (documentation de `chrome.storage.local` comme lieu de stockage whitelist M2) et TACHE-084 (inventaire exhaustif des logs console M7 + validation OBS-03) **ne modifient pas l'avis formel v1.0**. Ils renforcent au contraire la position de conformité en documentant explicitement : (a) la cohérence entre l'AIPD M7 §1.3, le registre Art. 30 (RT-M2/RT-PARAM) et la politique de confidentialité §4.1 ; (b) la mitigation effective de R-M7-08 par TACHE-083 et la levée d'OBS-03 post-TACHE-061.

### 6.2 Conditions

Le traitement est autorise sous les conditions suivantes :

1. **Consentement opt-in obligatoire** : le module M7 ne doit jamais s'activer sans le consentement explicite de l'utilisateur a l'etape 4 de l'onboarding. Ce point doit etre verifie par un test automatise.
2. **Nullification du mot de passe en clair** : la variable contenant le mot de passe doit etre nullifiee en moins de 5 ms apres le calcul du hash. Ce point doit etre verifie par un test automatise.
3. **Purge effective** : le mecanisme FIFO 100 + purge 90 jours doit etre teste en integration pour garantir qu'aucun hash ne persiste au-dela de la duree prevue.
4. **Exclusion des hashes de l'export** : l'export de portabilite ne doit contenir que les metadonnees agregees (nombre, dates), jamais les hashes bruts.
5. **(v1.1)** **Minimisation des logs console** : aucun `console.*` direct ne doit être réintroduit dans `src/background/service-worker.ts` ou `src/background/handlers/m7-handler.ts`. Tout logging doit passer par la factory `logger.ts` et n'inclure que les champs listés au §1.8. Ce point doit être vérifié par un test statique (ESLint AST + snapshot, cf. R-REC-AIPD-01/03).
6. **(v1.1)** **Interdiction de logger `_sender.tab?.url`** : seul `_sender.tab?.id` est autorisé dans les logs d'accueil de message. Anti-régression OBS-03.

### 6.3 Recommandations complementaires

1. **v2+ — Renforcement de la protection de la cle AES** : implementer la derivation PBKDF2 depuis un PIN utilisateur pour attenuer le risque R3 (acces via profil Chrome).
2. **Audit de securite externe** : avant la publication sur le Chrome Web Store, un audit de securite du code M7 par un tiers (meme benevole, dans le cadre open source) est recommande.
3. **Monitoring des vulnerabilites SHA-256** : bien que SHA-256 soit actuellement considere comme sur, surveiller les publications du NIST concernant les fonctions de hachage et prevoir une migration si necessaire.
4. **Test d'intrusion M7** : inclure un test specifique de resistance du hash sale aux attaques par dictionnaire dans le plan de tests de securite.
5. **(v1.1)** **Finaliser la règle ESLint AST (TACHE-104)** — sélecteur sur `VariableDeclarator > MemberExpression[property.name='message']` pour bloquer les 12 sites handlers résiduels. Impact : extension de la mitigation R-M7-08 à M2/M3/M5/M6/M17 (complétude périmètre SW).
6. **(v1.1)** **Étendre l'inventaire aux content scripts (TACHE-105)** — ~26 sites `console.*` recensés ; priorité inférieure mais à planifier avant la publication Chrome Web Store.

### 6.4 Mise a jour de la presente AIPD

Cette AIPD doit etre revisee dans les cas suivants :

- Modification du mecanisme de hachage ou de chiffrement
- Ajout de donnees collectees par M7
- Introduction d'un composant reseau (meme optionnel)
- Modification de la duree de conservation
- Signalement d'une vulnerabilite affectant SHA-256 ou AES-256-GCM
- Nouvelle version majeure de l'extension
- **(v1.1)** Ajout d'un nouveau site logger dans `service-worker.ts` ou `m7-handler.ts` avec un champ non listé au §1.8 (nouvelle MAJ requise de l'inventaire)
- **(v1.1)** Réintroduction d'un `console.*` direct (régression TACHE-083) — MAJ obligatoire
- **(v1.1)** Modification du mécanisme de stockage de la whitelist M2 (sortie de `chrome.storage.local` ou d'IndexedDB) — MAJ du §1.3

### 6.5 Cohérence avec TACHE-074 et mini-DAT TACHE-061 (v1.1)

**Contexte :** TACHE-074 demande la transmission du mini-DAT TACHE-061 v1.1 (§11.3 — registre d'incidents IndexedDB circulaire) au DPO pour validation de compatibilité avec l'AIPD M7. Bien que TACHE-074 soit une tâche distincte de TACHE-040 et TACHE-084, elle partage le périmètre « instrumentation M7 » introduit par TACHE-061.

**Avis du DPO sur le registre d'incidents (pré-validation TACHE-074) :** le mini-DAT TACHE-061 décrit un registre d'incidents local (store IDB `m7_incidents`, circulaire, minimisé) dont la structure est **compatible avec l'AIPD M7 v1.1** sous réserve que :

1. Les types d'incidents stockés (`boot_fail`, `key_regenerated`, `canary_reinit`, etc.) ne contiennent **pas** les champs interdits listés au §1.8 (`err.message`, `hostname` brut, `domain_hash` brut, `password_hash`, `installation_salt`, URL complète, contenu input utilisateur).
2. Le champ `context` de chaque incident respecte la même discipline de minimisation que les logs console (enum, compteurs, `error_name`, `hint` textuel court).
3. Le registre est **purgé** (circulaire, TTL maximum documenté) et **exclus de l'export de portabilité Art. 20** par défaut — sauf option explicite utilisateur pour diagnostic.
4. La page Options expose un bouton « Voir mon registre d'incidents » (transparence) et « Vider mon registre d'incidents » (effacement local).

**Validation formelle TACHE-074** : sera documentée dans une note additive à cette AIPD dès réception du mini-DAT TACHE-061 v1.1 par le DPO (hors scope de cette v1.1, cf. TACHE-074 « À faire »). La présente section 6.5 constitue une **pré-validation conceptuelle** sur la base des extraits mini-DAT consultés.

---

## 7. Diagramme de flux de données personnelles (intégration v1.1)

Le diagramme de flux de données personnelles reste celui de l'AIPD v1.0 (voir section dédiée dans le DAT v1.3 §8.1). **La mise à jour v1.1 n'introduit pas de nouveau flux** — elle documente explicitement :

- Le flux whitelist M2 déjà existant (chrome.storage.local ↔ IndexedDB ↔ content script) comme partageant le périmètre `chrome.storage.local` avec M7 (clé AES, sel) — §1.3 v1.1
- Les flux de logs SW/M7 vers la console navigateur (non persistés, non transmis réseau) — §1.8

Aucun flux réseau, aucun flux vers un tiers, aucun flux hors UE.

---

**Risque R-007 (RISQUES.md) :** Cette AIPD repond a l'exigence documentee dans R-007 (score 8, statut Ouvert). Le statut peut etre passe a "Resolu" apres validation par le referent qualite et le Commanditaire.

**Risque R-M7-08 (RISQUES.md) :** La section §1.8 de la v1.1 documente l'inventaire exhaustif des logs console M7 demandé par le comité de revue code TACHE-061 §11. La mitigation technique (TACHE-083, factory `logger.ts`) est **effective** pour les 13 sites identifiés dans `service-worker.ts` et `m7-handler.ts`. Le scope résiduel (TACHE-104 règle ESLint + TACHE-105 content scripts) est **hors périmètre M7** mais tracé dans les recommandations complémentaires.

---

_AIPD produite par le DPO — Fabrique — v1.0 2026-04-11, v1.1 2026-04-18_
_Conforme a l'article 35 du RGPD et aux lignes directrices du CEPD (WP248 rev.01)_
_Conforme au guide AIPD de la CNIL (PIA, version 2018)_
_Alignée avec le registre des traitements Art. 30 v1.0 (docs/rgpd/registre-des-traitements-v1.0.md)_
_Alignée avec la politique de confidentialité v1.0 (docs/rgpd/politique-de-confidentialite-v1.0.md)_
