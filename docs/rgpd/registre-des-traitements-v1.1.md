# Registre des traitements — Sentinel Nudge

**Version** : 1.1 (enrichie post-rapport DPO T-165+T-169 §4.2 le 2026-04-19)
**Date** : 2026-04-19
**Auteur** : DPO de la Fabrique (fonction)
**Conformité** : RGPD Art. 30
**Lié à** : politique de confidentialité v1.2, AIPD « Alerte mots de passe réutilisés » v1.3, référentiel ISO 27001 v1.2 (12 contrôles + procédure DPO E1-E6), DAT v1.4, runbook réponse à incident v1.0

**Note terminologique (v1.1) :** ce registre est un **document destiné aux autorités de contrôle (CNIL) et au DPO** au titre de l'Art. 30 RGPD. Il conserve ses qualités de document technique et juridique. La présente version v1.1 applique cependant le même principe d'alignement terminologique user-friendly que la politique de confidentialité v1.2 et l'AIPD M7 v1.3 (feedback Commanditaire 2026-04-19) : les **codes module techniques internes** (M2, M3, M5, M6, M7, M9, M17) sont remplacés en première position par leur **titre user-friendly** (« Protection contre les sites frauduleux », « Score de cyber-hygiène personnel », etc.) afin d'assurer la cohérence avec la politique de confidentialité publique. Les codes module sont préservés (a) entre parenthèses dans les titres de fiche et (b) dans l'**annexe A — Table de correspondance** pour la traçabilité avec le DAT, le SFD et le code source.

**Note enrichissement (v1.1+ 2026-04-19) :** la présente version v1.1 a été **enrichie sur place** (sans bump de version, application de la règle Commanditaire anti-démultiplication documentaire) suite au rapport DPO T-165+T-169 §4.2 portant 6 corrections : alignement durées RT-M3 (90 j → 52 semaines glissantes) et RT-M6 (durée installation → 52 semaines / 364 j) sur la vérité source code (`src/background/storage-service.ts`), correction du libellé RT-M9 (« Détection certificat invalide / MITM » → « Détection de mots de passe faibles (zxcvbn-ts) »), ajout des fiches RT-M7-INC §3.9 (registre `m7_incidents` FIFO 500 / TTL 365 j résorbant R-074-REC-01) et RT-INTENT §3.10 (intents `pending_*` à TTL court ADR-002), bumping des cross-références politique v1.2 / AIPD v1.3 / ISO v1.2 / DAT v1.4. **Avis DPO** : FAVORABLE SANS RESERVE.

---

## 1. Responsable de traitement

Conformément à la §2 de la politique de confidentialité v1.2 (triple qualification) :

| Acteur | Statut RGPD | Portée |
|---|---|---|
| **Utilisateur final** | Responsable de traitement de fait | Traitement local sur son appareil, dans son navigateur |
| **Antony Blain** (particulier, éditeur du code GPL v3) | Éditeur — **sans accès aux données** | Conception du code open source, aucune collecte ni remontée |
| **Éditeur du navigateur** (Google Inc. / Microsoft / Mozilla) | Responsable du stockage (profil navigateur) | Stockage chrome.storage.local et IndexedDB dans le profil utilisateur |

**DPO** : non désigné (Art. 37 — pas d'obligation : absence d'activité commerciale, absence de traitement à grande échelle de catégories particulières, absence de suivi systématique à grande échelle par l'éditeur). Rôle « DPO de la Fabrique » tenu comme fonction de conformité interne au processus de développement.

---

## 2. Matrice synthétique des traitements

| ID | Fonctionnalité (titre user-friendly) | Code interne | Finalité | Base légale | Durée conservation | Données | Destinataires | Transferts UE |
|---|---|---|---|---|---|---|---|---|
| RT-M2 | **Protection contre les sites frauduleux** | M2 | Alerte domaine suspect | Art. 6.1.f | Jusqu'à suppression | Hash de domaine | Aucun | Aucun |
| RT-M3 | **Score de cyber-hygiène personnel** | M3 | Feedback cyber-hygiène | Art. 6.1.f | **52 semaines glissantes** | Events agrégés non-nominatifs | Aucun | Aucun |
| RT-M5 | **Alerte mise à jour navigateur** | M5 | Rappel mise à jour | Art. 6.1.f | 30 jours snooze | Version navigateur locale | Aucun | Aucun |
| RT-M6 | **Quiz d'apprentissage anti-phishing** | M6 | Apprentissage | Art. 6.1.f | **52 semaines (364 jours)** | Réponses + score + date | Aucun | Aucun |
| RT-M7 | **Alerte mots de passe réutilisés** | M7 | Alerte sécurité | **Art. 6.1.a (opt-in)** | 90 jours | Hash salé mdp + hostname | Aucun | Aucun |
| RT-M7-INC | **Registre interne d'incidents M7** | M7 (sous-store) | Diagnostic / gestion incidents technique | Art. 6.1.f | **365 jours TTL (FIFO 500)** | IncidentContext typé strict (pas de PII) | Aucun (exclu Art. 20) | Aucun |
| RT-M9 | **Détection de mots de passe faibles (zxcvbn-ts)** | M9 | Évaluation force mot de passe à la saisie | Art. 6.1.f | Pas de stockage valeur | Score entropie 0-100 (RAM <10 ms) | Aucun | Aucun |
| RT-M17 | **Détection de données sensibles dans le presse-papiers** | M17 | Alerte donnée sensible | Art. 6.1.f | Pas de stockage valeur | Type seul (cb/iban/ssn) | Aucun | Aucun |
| RT-INTENT | **Intents cross-lifecycle (pending_*)** | INTENT | Persistance courte intention nudge inter-contextes | Art. 6.1.f | **TTL court (5 min — 7 jours selon intent)** | Type d'intent + payload minimal (pas de PII) | Aucun | Aucun |
| RT-PARAM | **Paramètres + whitelist** | PARAM | Configuration utilisateur | Art. 6.1.b | Jusqu'à suppression | Préférences + whitelist Protection contre les sites frauduleux | Aucun | Aucun |

---

## 3. Fiches détaillées

### 3.1 RT-M2 — Protection contre les sites frauduleux (M2)

- **Finalité** : alerter l'utilisateur lorsqu'il navigue sur un domaine suspect (proche d'un domaine connu — Levenshtein ≥ 2 signaux cumulés) ou absent de la HSTS preload list.
- **Base légale** : Art. 6.1.f RGPD — intérêt légitime de l'utilisateur à être protégé contre le phishing. Test de mise en balance : impact positif significatif (protection contre phishing), traitement strictement local, pas de profilage, possibilité de désactivation à tout moment.
- **Catégories de personnes concernées** : utilisateur final uniquement.
- **Catégories de données** : hash FNV-1a de noms de domaines visités (chrome.storage.local + IndexedDB pour la whitelist utilisateur). Aucune URL complète, aucun timestamp de navigation.
- **Destinataires** : aucun (traitement 100% local).
- **Transferts hors UE** : aucun.
- **Durée de conservation** : whitelist conservée jusqu'à suppression explicite par l'utilisateur. Pas d'historique de navigation.
- **Mesures techniques** : hash non réversible FNV-1a, stockage local uniquement, exclusion via `.gitignore` côté code source. ISO 27001 A.8.12 (Data leakage prevention), A.8.24 (Use of cryptography).
- **Mesures organisationnelles** : AIPD intégrée à l'AIPD projet (« Alerte mots de passe réutilisés » pour la partie hash). Politique de confidentialité v1.2 §4.1.

### 3.2 RT-M3 — Score de cyber-hygiène personnel (M3)

- **Finalité** : calculer un score hebdomadaire agrégé à partir des 5 composantes (« Alerte mise à jour navigateur » 20%, « Quiz d'apprentissage anti-phishing » 25%, « Protection contre les sites frauduleux » 20%, « Alerte mots de passe réutilisés » 20%, « Détection de mots de passe faibles » 15%) pour feedback utilisateur (dashboard popup).
- **Base légale** : Art. 6.1.f — intérêt légitime de l'utilisateur à connaître son niveau de cyber-hygiène. Aucun profilage externe.
- **Catégories de personnes concernées** : utilisateur final uniquement.
- **Catégories de données** : events agrégés par module (compteurs hebdomadaires), pas de granularité horodatée fine. Week_key au format `YYYY-Www`.
- **Destinataires** : aucun.
- **Transferts hors UE** : aucun.
- **Durée de conservation** : **52 semaines glissantes** (purge automatique via `onPurgeDaily`, fenêtre rolling sur la base du `week_key` lexicographique). **Vérité source** : `src/background/storage-service.ts` lignes 404-407 — `const scoreCutoffKey = this.getWeekKeyOffset(-52)` (purge `weekly_scores` avec week_key < semaine courante − 52). Correction T-165+T-169 §4.2 : la mention v1.1 initiale « 90 jours rolling » était une survivance de l'avant-projet (alignement par défaut sur la rétention `events`) ; la fenêtre effective implémentée est **52 semaines** afin de couvrir un cycle annuel de cyber-hygiène (saisonnalité phishing, comparaisons année N vs N-1).
- **Mesures techniques** : IndexedDB local, store `weekly_scores` isolé, purge rolling 52 semaines. ISO 27001 A.8.10 (Data deletion), A.8.12.
- **Mesures organisationnelles** : RT-M3 documenté dans DAT v1.4 §score-calculator. Cohérence inter-documentaire avec politique v1.2 §4.2 et AIPD v1.3 annexe A.

### 3.3 RT-M5 — Alerte mise à jour navigateur (M5)

- **Finalité** : inciter à la mise à jour du navigateur si une version plus récente est disponible.
- **Base légale** : Art. 6.1.f — intérêt légitime à maintenir un navigateur à jour (protection contre CVE connues).
- **Catégories de personnes concernées** : utilisateur final.
- **Catégories de données** : version actuelle du navigateur (locale, récupérée via `chrome.runtime.requestUpdateCheck()` API native), compteur de snooze, date du dernier nudge.
- **Destinataires** : aucun.
- **Transferts hors UE** : aucun (pas de version embarquée, pas d'appel réseau applicatif).
- **Durée de conservation** : état volatile, snooze réinitialisé à chaque mise à jour effective. Historique non conservé.
- **Mesures techniques** : validation de type/plage au boot SW (ADR-001 `initBoot()`, couvert par TACHE-087 mergé).
- **Mesures organisationnelles** : incident `m5_snooze_corrupted` tracé si régénération (registre incidents IDB).

### 3.4 RT-M6 — Quiz d'apprentissage anti-phishing (M6)

- **Finalité** : renforcer la culture cyber-hygiène par des quiz courts, selon un calendrier de révision espacée ([0, 7, 21, 42, 70] jours puis mensuel).
- **Base légale** : Art. 6.1.f — intérêt légitime à la formation continue de l'utilisateur.
- **Catégories de personnes concernées** : utilisateur final.
- **Catégories de données** : réponses aux quiz (référence par ID de question, **jamais le texte** — R-CLI-07), score par session, date d'installation (pivot spaced repetition), prochaine date de quiz.
- **Destinataires** : aucun.
- **Transferts hors UE** : aucun (corpus quiz embarqué dans l'extension, chargé localement).
- **Durée de conservation** : **52 semaines (364 jours) glissants** par session de quiz. **Vérité source** : `src/background/storage-service.ts` lignes 316 + 376-402 — `const quizCutoff = new Date(Date.now() - 364 * 24 * 60 * 60 * 1000).toISOString()` (purge `quiz_sessions` avec quiz_date < cutoff). Correction T-165+T-169 §4.2 : la mention v1.1 initiale « durée installation » était trop large (jamais purgé tant que l'extension reste installée) et entrait en contradiction avec le code effectif. La rétention réelle est **52 semaines**, justifiée par la nécessité de mesurer la rétention pédagogique long-terme (cycles spaced repetition jusqu'à 70 jours puis mensuels) tout en respectant le principe de minimisation Art. 5.1.e.
- **Mesures techniques** : IDs de questions abstraits uniquement, corpus bilingue FR/EN embarqué versionné, purge rolling 364 j sur `quiz_sessions`. ISO 27001 A.8.10 (Data deletion), A.8.12, A.5.34.
- **Mesures organisationnelles** : `initBoot()` Quiz d'apprentissage anti-phishing avec validation `m6_install_date` (TACHE-088 mergé). Cohérence inter-documentaire avec politique v1.2 §4.4 et AIPD v1.3 annexe A.

### 3.5 RT-M7 — Alerte mots de passe réutilisés (M7)

- **Finalité** : alerter l'utilisateur lorsqu'il réutilise un même mot de passe sur plusieurs domaines distincts (risque de cascade suite à fuite).
- **Base légale** : **Art. 6.1.a RGPD — consentement explicite via opt-in dans l'onboarding**. Le consentement est retirable à tout moment (désactivation de la fonctionnalité « Alerte mots de passe réutilisés » dans les paramètres → purge automatique du store `password_hashes`).
- **Catégories de personnes concernées** : utilisateur final.
- **Catégories de données** : **hash SHA-256 salé** du mot de passe (sel d'installation local), associé au **hash SHA-256 du hostname** (jamais l'URL complète, jamais le mot de passe en clair). Chiffré AES-256-GCM avec clé locale avant persistance IndexedDB.
- **Destinataires** : aucun (alerte contextuelle par toast local uniquement).
- **Transferts hors UE** : aucun.
- **Durée de conservation** : **90 jours glissants** (purge automatique). Cooldown 30 jours par domaine pour éviter sur-sollicitation.
- **Mesures techniques** :
  - Hash salé par installation (sel `crypto.getRandomValues(32)`)
  - Chiffrement AES-256-GCM au repos (IV unique à chaque écriture, R-CLI-06)
  - Stockage IndexedDB isolé (store `password_hashes`, FIFO 100 entrées max)
  - Canary hash au boot SW (ADR-001, TACHE-061)
  - **Registre d'incidents IDB local** (store `m7_incidents`, **circulaire FIFO 500, TTL 365 j**, severity-prioritized purge INV-SEC-04, **exclu par défaut de l'export portabilité Art. 20** — cf. fiche dédiée RT-M7-INC §3.9 et note DPO T-074)
  - **Factory `logger.ts`** avec minimisation systématique des logs console (substitution `Logger.errorName` à `err.message`, interdiction `_sender.tab?.url`) — TACHE-083 mergée
  - ISO 27001 A.8.24 (cryptographie), A.8.12 (DLP), A.8.28 (secure coding), A.8.15 (Logging), A.8.16 (Monitoring).
- **Mesures organisationnelles** :
  - **AIPD « Alerte mots de passe réutilisés » v1.3** dédiée (cf. `docs/p3-architecture/p3-aipd-m7-v1.3.md`).
  - Note DPO T-074 v1.0 (compatibilité TACHE-061) — `docs/rgpd/note-dpo-tache-061-compatibilite-aipd-v1.0.md`.
  - Note DPO T-115 v1.0 (circuit DPO obligatoire incidents) — `docs/rgpd/note-dpo-circuit-incidents-m7-v1.0.md`.
- **Base de minimisation** (Art. 5.1.c) : aucune valeur en clair ne transite jamais, aucun identifiant utilisateur, aucun timestamp précis.

### 3.6 RT-M9 — Détection de mots de passe faibles (zxcvbn-ts) (M9)

- **Finalité** : évaluer en local la force d'un mot de passe au moment de la saisie via la bibliothèque `zxcvbn-ts` (analyse d'entropie, dictionnaires, motifs courants), afin d'alerter l'utilisateur lorsqu'un mot de passe est trop faible et de l'inciter à choisir un mot de passe plus robuste.
- **Base légale** : Art. 6.1.f — intérêt légitime de l'utilisateur à utiliser des authentifiants robustes (réduction du risque de brute-force et de credential stuffing).
- **Catégories de personnes concernées** : utilisateur final.
- **Catégories de données** : pattern saisi en RAM uniquement, **nullifié dès la fin du matching (<10 ms)** — conformité R-002 non-stockage. Seul le **score numérique d'entropie (entier 0-100)** issu de `zxcvbn-ts` est éventuellement consommé localement (alimentation pondérée 15 % du « Score de cyber-hygiène personnel » RT-M3), jamais la valeur du mot de passe.
- **Destinataires** : aucun.
- **Transferts hors UE** : aucun (bibliothèque `zxcvbn-ts` embarquée localement, dictionnaires intégrés au bundle, aucun appel réseau).
- **Durée de conservation** : **aucune persistance** de la valeur du mot de passe (traitement volatile RAM <10 ms). Score d'entropie : agrégé dans la fenêtre rolling 52 semaines de « Score de cyber-hygiène personnel » (cf. RT-M3).
- **Mesures techniques** : variable locale nullifiée immédiatement après usage (pattern « zero-on-exit »), aucune persistance store IDB ni log console. ISO 27001 A.8.11 (Data masking), A.8.12 (DLP), A.8.24 (cryptographie — usage indirect via score).
- **Mesures organisationnelles** : INV-SEC-02 (jamais de texte en clair persistant) applicable. **Vérité source** : `src/shared/types/modules.ts` ligne 17 — `M9 : Évaluation force mot de passe (zxcvbn-ts)`. Correction T-165+T-169 §4.2 : le libellé v1.1 initial « Détection certificat invalide / MITM » était une **erreur héritée d'un avant-projet** (M9 ayant été repurposé tôt en sprint sans mise à jour du registre). Le code source, le DAT v1.4, la politique v1.2 §3 et l'AIPD v1.3 annexe A désignent unanimement la finalité **« évaluation de la force du mot de passe via zxcvbn-ts »**. La couverture certificat invalide / MITM heuristique a été retirée du périmètre v1 (aucune implémentation effective dans `src/`).

### 3.7 RT-M17 — Détection de données sensibles dans le presse-papiers (M17)

- **Finalité** : alerter l'utilisateur lorsqu'il colle une donnée sensible (CB, IBAN, SSN) sur un site où ce n'est pas attendu.
- **Base légale** : Art. 6.1.f — intérêt légitime à la protection des données sensibles.
- **Catégories de personnes concernées** : utilisateur final.
- **Catégories de données** : **type de donnée uniquement** (enum `cb | iban | ssn`), **jamais la valeur** (R-CLI-07 / INV-SEC-02). Exclusion explicite des inputs `type="password"` (TACHE-023).
- **Destinataires** : aucun.
- **Transferts hors UE** : aucun.
- **Durée de conservation** : pattern `pending_m17_toast` persistant avec `expires_at` 5 min (ADR-002 R-CLI-03) — purgé après consommation ou expiration. Cf. fiche dédiée RT-INTENT §3.10 pour la matrice complète des intents.
- **Mesures techniques** : détection regex sur event `paste`, enum strict, exclusion type password. ISO 27001 A.8.11, A.8.12.
- **Mesures organisationnelles** : `pending_m17_toast` purgé via `onPurgeDaily` si expiré (TACHE-093 mergée).

### 3.8 RT-PARAM — Paramètres + consentement + whitelist Protection contre les sites frauduleux

- **Finalité** : stocker les préférences utilisateur, les consentements par fonctionnalité, la whitelist « Protection contre les sites frauduleux ».
- **Base légale** : Art. 6.1.b — exécution d'un contrat (fourniture du service extension) + Art. 6.1.a pour le consentement « Alerte mots de passe réutilisés ».
- **Catégories de personnes concernées** : utilisateur final.
- **Catégories de données** : préférences (quota, langue, dark mode), état de consentement par fonctionnalité (booléen + date), whitelist « Protection contre les sites frauduleux » (hashs FNV-1a de domaines).
- **Destinataires** : aucun.
- **Transferts hors UE** : aucun.
- **Durée de conservation** : jusqu'à désinstallation de l'extension ou suppression explicite des données (bouton dédié).
- **Mesures techniques** : chrome.storage.local, validation JSON stricte (P-018), `initBoot()` « Protection contre les sites frauduleux » avec contrôle intégrité whitelist (TACHE-085).
- **Mesures organisationnelles** : droit d'accès via bouton « Exporter mes données » (Art. 20 RGPD, TACHE-013 livrée).

### 3.9 RT-M7-INC — Registre interne d'incidents M7 (M7 sous-store)

*Fiche ajoutée v1.1+ (2026-04-19) suite au rapport DPO T-165+T-169 §4.2 — résorption recommandation **R-074-REC-01** (formalisation du registre incidents M7 dans le registre Art. 30).*

- **Finalité** : conserver localement un journal technique d'incidents survenus dans le pipeline de la fonctionnalité « Alerte mots de passe réutilisés » (RT-M7) — exemples : échec de déchiffrement AES-GCM (`AES_DECRYPT_FAILED`), corruption détectée au boot SW (`BOOT_CANARY_MISMATCH`), incohérence de schema IDB (`SCHEMA_VERSION_MISMATCH`), saturation FIFO (`FIFO_SATURATION`). Sert exclusivement le **diagnostic local par l'utilisateur** (page Options « Diagnostic ») et la **télémétrie de support en cas d'export volontaire** (jamais transmis automatiquement).
- **Base légale** : Art. 6.1.f — intérêt légitime à la **fiabilité opérationnelle** de la fonctionnalité « Alerte mots de passe réutilisés » dont l'utilisateur a explicitement consenti à l'usage (Art. 6.1.a sur RT-M7). Le journal technique est nécessaire pour identifier et corriger les défaillances qui priveraient l'utilisateur de la protection consentie. Test de mise en balance : impact positif (continuité de service de la mesure de sécurité), aucun PII collecté, exclusion par défaut de l'export portabilité Art. 20, durée bornée 365 j FIFO.
- **Catégories de personnes concernées** : utilisateur final uniquement.
- **Catégories de données** : type `IncidentContext` typé strict — `{ code: IncidentCode; severity: 'P0'|'P1'|'P2'|'P3'; timestamp_ms: number; module: 'M7'; meta?: Record<string, string|number|boolean> }` — `meta` filtré par allowlist (jamais d'URL, jamais de hash mot de passe, jamais de hostname clair). **Aucune PII**, aucun timestamp utilisateur identifiant.
- **Destinataires** : aucun. **Exclu par défaut de l'export Art. 20** (cf. note DPO T-074 §3.3) — disponible uniquement via la page Options « Diagnostic » à l'initiative explicite de l'utilisateur.
- **Transferts hors UE** : aucun.
- **Durée de conservation** : **365 jours glissants (TTL)** + **plafond FIFO de 500 entrées** — la première limite atteinte déclenche la purge. Politique `severity-prioritized` (INV-SEC-04) : en cas de saturation FIFO 500, les entrées P2/P3 sont purgées en priorité avant les P0/P1, qui restent conservées jusqu'au TTL 365 j.
- **Mesures techniques** :
  - Store IndexedDB isolé `m7_incidents`, schema typé `IncidentContext` strict (validation à l'écriture, rejet silencieux et logging factory `logger.ts` si schema invalide)
  - Allowlist `meta` côté code (interdiction `url`, `hash`, `hostname`, `password*`, `_sender*`)
  - Purge automatique FIFO via `onPurgeDaily` (TACHE-093 mergée)
  - Severity-prioritized purge INV-SEC-04
  - Exclusion explicite de la sérialisation Art. 20 (filtre `excludeStores` côté `exportUserData()`)
  - ISO 27001 A.8.10 (Data deletion), A.8.12 (DLP), A.8.15 (Logging), A.8.16 (Monitoring), A.5.24/A.5.26 (Information security incident management — Géré post-runbook T-110).
- **Mesures organisationnelles** :
  - Note DPO T-074 v1.0 — exclusion Art. 20 documentée et tracée
  - Note DPO T-115 v1.0 — circuit DPO obligatoire (E1-E6) en cas d'incident P0/P1
  - Runbook réponse à incident v1.0 — classification P0-P3 alignée
  - AIPD v1.3 annexe A — risque résiduel **R-074-REC-01 résorbé** par formalisation Art. 30
- **Base de minimisation** (Art. 5.1.c) : journal strictement technique, aucune donnée nominative ou pseudonymisée d'utilisateur, aucun élément reconstituant le secret protégé par RT-M7.

### 3.10 RT-INTENT — Intents cross-lifecycle (pending_*) (INTENT)

*Fiche ajoutée v1.1+ (2026-04-19) suite au rapport DPO T-165+T-169 §4.2 — formalisation du traitement transverse des intents persistants à TTL court (ADR-002 CROSS-LIFECYCLE-INTENT, R-CLI-03, TACHE-093 mergée).*

- **Finalité** : assurer la **continuité d'intention de nudge** entre deux contextes d'exécution Manifest V3 désynchronisés (service worker éphémère ↔ content script ↔ popup), notamment lorsqu'un nudge programmé doit survivre à un cycle de vie SW (ex. : un toast déclenché côté SW puis affiché côté content script après reprise). Mécanisme strictement transitoire avec **TTL court par type d'intent**, garantissant qu'aucune intention obsolète ne s'accumule.
- **Base légale** : Art. 6.1.f — intérêt légitime à la **fiabilité d'affichage** des nudges déjà légitimés par leur traitement parent (RT-M5/M6/M7/M17). Test de mise en balance : impact positif (continuité de l'expérience utilisateur), TTL court (≤ 7 jours, le plus souvent ≤ 30 min), payload sans PII, purge automatique systématique.
- **Catégories de personnes concernées** : utilisateur final uniquement.
- **Catégories de données** : payload minimal par type d'intent (jamais d'URL, jamais de valeur sensible, jamais de hash mot de passe). Quatre intents répertoriés à ce jour :

  | ID intent | Module parent | TTL | Payload typique | Référence |
  |---|---|---|---|---|
  | `pending_m7_toast` | RT-M7 | **10 minutes** | `{ scheduled_at: number; expires_at: number }` (pas d'URL ni hash) | ADR-002 R-CLI-03 / TACHE-093 |
  | `pending_m17_toast` | RT-M17 | **5 minutes** | `{ type: 'cb'\|'iban'\|'ssn'; expires_at: number }` (jamais la valeur) | ADR-002 R-CLI-03 / TACHE-093 |
  | `pending_m6_quiz` | RT-M6 | **7 jours** | `{ next_quiz_due: string; expires_at: number }` (date ISO, pas de réponse) | ADR-002 R-CLI-03 / TACHE-093 |
  | `pending_m5_update_reminder` | RT-M5 | **30 minutes** | `{ browser_version: string; expires_at: number }` (version locale) | ADR-002 R-CLI-03 / TACHE-093 |

- **Destinataires** : aucun (purement intra-extension, jamais transmis hors profil navigateur).
- **Transferts hors UE** : aucun.
- **Durée de conservation** : **TTL strictement borné par intent (5 min à 7 jours)**, purge déclenchée à la **première occurrence** entre (a) consommation par le contexte cible (toast affiché, quiz lancé), (b) expiration `expires_at`, (c) prochaine itération de `onPurgeDaily` (TACHE-093 mergée).
- **Mesures techniques** :
  - Stockage `chrome.storage.local` (pas IDB — légèreté + auto-flush au profile reload)
  - Schema typé strict par intent (validation à l'écriture)
  - Champ `expires_at` obligatoire et vérifié à la lecture (ignoré si dépassé)
  - Purge inconditionnelle des intents expirés à chaque alarme `onPurgeDaily` (TACHE-093)
  - Aucun log applicatif du payload (factory `logger.ts` n'expose que le type d'intent, pas son contenu)
  - ISO 27001 A.8.10 (Data deletion), A.8.12 (DLP), A.8.28 (Secure coding).
- **Mesures organisationnelles** :
  - ADR-002 CROSS-LIFECYCLE-INTENT — contrat formel R-CLI-03 (TTL borné obligatoire)
  - TACHE-093 mergée — purge automatique opérationnelle
  - Cohérence inter-documentaire avec politique v1.2 §4 et AIPD v1.3 annexe A
- **Base de minimisation** (Art. 5.1.c) : payload réduit au strict nécessaire pour reprendre l'intention, aucune donnée nominative, TTL court systématique.

---

## 4. Synthèse minimisation des données

| Traitement (titre user-friendly) | Code | Donnée minimisée | Justification | Invariant sécurité |
|---|---|---|---|---|
| Protection contre les sites frauduleux | M2 | Hash FNV-1a de domaine | Pas d'URL, pas d'historique | A.8.11 |
| Score de cyber-hygiène personnel | M3 | Compteurs agrégés hebdomadaires | Pas de timestamp fin, fenêtre 52 semaines | A.8.12 |
| Alerte mise à jour navigateur | M5 | Version seule | Pas de téléchargement embarqué | — |
| Quiz d'apprentissage anti-phishing | M6 | ID abstrait de question | Pas de texte de question (R-CLI-07), purge 364 j | INV-SEC-02 |
| Alerte mots de passe réutilisés | M7 | Hash SHA-256 salé + hostname hashé | Valeur jamais transmise, jamais stockée en clair | INV-SEC-01/02 |
| Registre interne d'incidents M7 | M7-INC | IncidentContext typé strict (allowlist meta) | Aucune PII, exclu Art. 20, FIFO 500 / TTL 365 j | INV-SEC-04 |
| Détection de mots de passe faibles (zxcvbn-ts) | M9 | Pattern RAM volatile / score entropie entier | Nullification <10 ms (R-002), valeur jamais stockée | INV-SEC-02 |
| Détection de données sensibles dans le presse-papiers | M17 | Enum type seul | Valeur jamais lue durablement (R-CLI-07) | INV-SEC-02 |
| Intents cross-lifecycle (pending_*) | INTENT | Type d'intent + payload minimal sans PII | TTL court (5 min — 7 j), purge `onPurgeDaily` | INV-SEC-02 |
| Paramètres + whitelist | PARAM | Préférences + hash whitelist | Pas d'URL, consentement révocable | A.8.11 |

---

## 5. Droits des personnes concernées (Art. 15-22)

Tous les droits s'exercent directement dans l'extension, sans contacter un tiers :

- **Accès / Portabilité** (Art. 15, 20) : bouton « Exporter mes données » dans Options → fichier JSON déchiffré localement (TACHE-013 livrée). **Exclusions** : hashes bruts « Alerte mots de passe réutilisés », **registre interne d'incidents M7 (RT-M7-INC)** et **intents techniques (RT-INTENT)** exclus par défaut (cf. note DPO T-074 §3.3 et fiches §3.9 / §3.10).
- **Effacement** (Art. 17) : bouton « Supprimer toutes mes données » dans Options → purge IndexedDB + chrome.storage.local. Dialog accessible HTML (TACHE-015 livrée).
- **Rectification** (Art. 16) : non applicable (pas de données déclaratives).
- **Opposition / Retrait consentement** (Art. 7.3, 21) : toggle par fonctionnalité dans Options → purge spécifique à la fonctionnalité.
- **Limitation** (Art. 18) : désactivation d'une fonctionnalité = suspension automatique du traitement.

---

## 6. Mesures de sécurité techniques (récap)

Référence : `docs/securite/referentiel-iso27001-v1.2.md` **v1.2 (12 contrôles explicites + A.5.24/26 Géré + procédure DPO E1-E6)**.

- A.5.7 Threat intelligence · A.5.34 Privacy by design
- A.8.8 Vulnerability management · A.8.10 Data deletion · A.8.11 Data masking
- A.8.12 Data leakage prevention · A.8.15 Logging · A.8.16 Monitoring
- A.8.24 Cryptography · A.8.28 Secure coding
- A.5.24/A.5.26 Information security incident management (Géré post-runbook T-110, procédure E1-E6 formalisée)

---

## 7. Mesures organisationnelles (récap)

- Politique de confidentialité **v1.2** (docs/rgpd/)
- AIPD « Alerte mots de passe réutilisés » **v1.3** (docs/p3-architecture/)
- **Note DPO T-074 v1.0** — compatibilité mini-DAT TACHE-061 / AIPD M7 (docs/rgpd/) **(v1.1)**
- **Note DPO T-115 v1.0** — circuit DPO obligatoire incidents « Alerte mots de passe réutilisés » (docs/rgpd/) **(v1.1)**
- Runbook réponse à incident v1.0 (docs/securite/) — classification P0-P3 + procédure d'escalade DPO E1-E6
- Référentiel ISO 27001 **v1.2** (12 contrôles + procédure DPO E1-E6)
- DAT **v1.4**
- ADR-001 SW-BOOT-CONTRACT + ADR-002 CROSS-LIFECYCLE-INTENT
- Code source open source GPL v3 (auditabilité publique — post TACHE-112)
- Canal signalement vulnérabilités : GitHub Security Advisories (SECURITY.md, actif après passage public)

---

## 8. Registre des violations — Template

Aucune violation enregistrée à ce jour (état 2026-04-19).

| ID | Date | Nature | Personnes concernées | Données impactées | Mesures | Notification CNIL | Notification personnes |
|---|---|---|---|---|---|---|---|
| VIOL-001 | — | — | — | — | — | — | — |

**Procédure** : en cas d'incident de sécurité, le runbook `docs/securite/runbook-reponse-incident-v1.0.md` impose la saisine DPO systématique (Step 2) et la validation DPO obligatoire avant notification utilisateurs (Step 7 + template 6.5). Articulation avec Art. 33 (notification CNIL < 72 h) et Art. 34 (notification personnes concernées). La **procédure d'escalade DPO en six étapes E1-E6** est formalisée dans la note DPO T-115 v1.0 (`docs/rgpd/note-dpo-circuit-incidents-m7-v1.0.md`) et désormais reflétée au référentiel ISO 27001 v1.2 (12 contrôles). **Auto-saisine** du DPO prévue (note T-115 §3.2) en cas d'absence de signalement par l'Incident Manager.

---

## 9. Responsabilité conjointe de fait (Art. 26)

Traitement coresponsable avec :

- **Éditeur du navigateur hôte** (Google Chrome, Microsoft Edge, Mozilla Firefox) — pour le stockage `chrome.storage.local` et IndexedDB dans le profil utilisateur. Si l'utilisateur active Chrome Sync, les données peuvent être synchronisées vers les serveurs Google selon la politique de l'éditeur (hors contrôle de l'éditeur Sentinel Nudge).
- **Utilisateur final** — qui reste maître de son appareil, de son profil navigateur, de la portée de son consentement « Alerte mots de passe réutilisés » opt-in.

L'éditeur Sentinel Nudge (Antony Blain, particulier) n'est **pas un processeur** au sens de l'Art. 28 car il n'accède jamais aux données de l'utilisateur. Il est éditeur de code open source, sans activité commerciale ni collecte.

---

## 10. Historique des versions

| Version | Date | Modifications | Auteur |
|---|---|---|---|
| v1.0 | 2026-04-18 | Création initiale — 8 traitements documentés, cohérence politique confidentialité v1.0 + AIPD M7 v1.0 | DPO Fabrique |
| **v1.1** | **2026-04-19** | **Alignement terminologique user-friendly (T-155, feedback Commanditaire) :** remplacement des codes module M2/M3/M5/M6/M7/M9/M17 par leurs titres user-friendly en première position dans la matrice synthétique (§2), les fiches détaillées (§3) et la synthèse de minimisation (§4). Codes module préservés entre parenthèses dans les titres de fiche et dans l'**annexe A — Table de correspondance**. Intégration de la note DPO T-074 v1.0 (compatibilité TACHE-061) et de la note DPO T-115 v1.0 (circuit DPO incidents) au §7 « Mesures organisationnelles » et au §8 « Registre des violations ». Mise à jour de la fiche RT-M7 §3.5 pour mentionner explicitement le registre `m7_incidents` (TACHE-061) et la factory `logger.ts` (TACHE-083). Aucune modification de fond sur les bases légales, durées de conservation, données traitées ou destinataires. | DPO Fabrique |
| **v1.1+** | **2026-04-19** | **Enrichissement post-rapport DPO T-165+T-169 §4.2 (re-tentative T-155 propre, application LL-031 worktree) — 6 corrections sans bump de version (règle anti-démultiplication documentaire) :** (1) RT-M3 durée corrigée 90 jours rolling → **52 semaines glissantes** (vérité source `storage-service.ts` lignes 404-407 `getWeekKeyOffset(-52)`) ; (2) RT-M6 durée corrigée durée installation → **52 semaines (364 jours)** (vérité source `storage-service.ts` lignes 316/376-402 `Date.now() - 364 * 24 * 60 * 60 * 1000`) ; (3) RT-M9 libellé corrigé « Détection certificat invalide / MITM » → **« Détection de mots de passe faibles (zxcvbn-ts) »** (vérité source `src/shared/types/modules.ts` ligne 17 + politique v1.2 §3 + AIPD v1.3 annexe A) ; (4) **ajout fiche RT-INTENT §3.10** — intents `pending_*` à TTL court (m7_toast 10 min, m17_toast 5 min, m6_quiz 7 j, m5_update_reminder 30 min) référence ADR-002 R-CLI-03 + TACHE-093 ; (5) **ajout fiche RT-M7-INC §3.9** — registre `m7_incidents` FIFO 500 / TTL 365 j / IncidentContext typé strict / exclusion Art. 20 — résorbe **R-074-REC-01** ; (6) cross-références bumpées politique v1.0→**v1.2**, AIPD v1.0→**v1.3**, ISO v1.0/8 contrôles→**v1.2/12 contrôles + procédure E1-E6**, DAT→**v1.4**. Lignes ajoutées §2 matrice (RT-M7-INC + RT-INTENT), §4 synthèse minimisation (idem), Annexe A (ID M7-INC + INTENT). **Avis DPO : FAVORABLE SANS RESERVE.** | DPO Fabrique |

---

## Annexe A — Table de correspondance (code module / titre user-friendly)

Pour traçabilité entre le présent registre (document destiné aux autorités de contrôle et au DPO) et les artefacts techniques (DAT, SFD, code source qui utilisent la nomenclature M2/M3/...) ainsi qu'avec la politique de confidentialité v1.2 (document public destiné aux utilisateurs) :

| Code module (interne, DAT/SFD/code) | Titre user-friendly (politique v1.2 / registre v1.1 / AIPD v1.3) | ID registre Art. 30 |
|---|---|---|
| M2 (Typosquatting + HSTS) | **Protection contre les sites frauduleux** | RT-M2 |
| M3 (Score hebdomadaire) | **Score de cyber-hygiène personnel** | RT-M3 |
| M5 (Mise à jour navigateur) | **Alerte mise à jour navigateur** | RT-M5 |
| M6 (Quiz phishing spaced repetition) | **Quiz d'apprentissage anti-phishing** | RT-M6 |
| M7 (Réutilisation mots de passe) | **Alerte mots de passe réutilisés** | RT-M7 |
| M7 sous-store `m7_incidents` (registre incidents technique) | **Registre interne d'incidents M7** *(jamais exposé à l'utilisateur, exclu Art. 20)* | RT-M7-INC |
| M9 (Évaluation force mot de passe — zxcvbn-ts) | **Détection de mots de passe faibles (zxcvbn-ts)** | RT-M9 |
| M17 (Presse-papiers sensible) | **Détection de données sensibles dans le presse-papiers** | RT-M17 |
| INTENT (`pending_*` cross-lifecycle, ADR-002) | **Intents cross-lifecycle (pending_*)** *(traitement transverse, TTL court)* | RT-INTENT |
| PARAM (Paramètres + whitelist + consentements) | **Paramètres + whitelist Protection contre les sites frauduleux** | RT-PARAM |

**Règle d'usage** :
- En interne (mini-DAT, ADR, code, BACKLOG, TACHE-XXX) : utiliser les **codes module** (M2, M7, etc.) pour précision technique.
- En externe (politique de confidentialité publique, communication utilisateur, dialogues onboarding/options) : utiliser les **titres user-friendly**.
- Dans les documents RGPD destinés aux autorités (présent registre, AIPD) : **les deux** (titre user-friendly en premier, code en parenthèses ou en colonne dédiée) afin d'assurer la traçabilité.

**Note sur la fonctionnalité M9 (mise à jour v1.1+ 2026-04-19)** : le titre user-friendly « Détection de mots de passe faibles (zxcvbn-ts) » correspond à la finalité **réellement implémentée** dans le code source (`src/shared/types/modules.ts` ligne 17 — « Évaluation force mot de passe (zxcvbn-ts) »), à la politique de confidentialité v1.2 §3 et à l'AIPD v1.3 annexe A. Le libellé « Détection certificat invalide / MITM » présent dans la version v1.1 initiale était une survivance d'avant-projet (M9 ayant été repurposé tôt en sprint sans mise à jour du registre) ; cette couverture certificat/MITM n'a jamais été implémentée dans le périmètre v1 et a été retirée du registre par la correction T-165+T-169 §4.2. Si une fonctionnalité distincte « connexion non sécurisée » devait être réintroduite dans une version ultérieure, elle ferait l'objet d'un nouveau RT-Mxx dédié et d'une nouvelle entrée à l'annexe A.

**Note sur le sous-traitement `m7_incidents` (RT-M7-INC, ajout v1.1+ 2026-04-19)** : bien qu'il s'agisse techniquement d'un **sous-store IDB rattaché à la fonctionnalité M7**, le DPO a fait le choix d'une **fiche Art. 30 distincte (§3.9)** afin de matérialiser explicitement (a) la finalité distincte (diagnostic technique vs alerte utilisateur), (b) l'exclusion par défaut de l'export portabilité Art. 20 (cf. note DPO T-074 §3.3), (c) le périmètre `IncidentContext` typé strict (allowlist `meta`, jamais de PII), et (d) la résorption de la recommandation **R-074-REC-01** issue de l'AIPD v1.3. La traçabilité avec RT-M7 reste assurée via la mention dédiée « Registre d'incidents IDB local » dans la fiche RT-M7 §3.5 « Mesures techniques ».

**Note sur le traitement transverse RT-INTENT (ajout v1.1+ 2026-04-19)** : les intents `pending_*` sont un mécanisme **transverse à plusieurs modules** (M5, M6, M7, M17) imposé par le contrat ADR-002 CROSS-LIFECYCLE-INTENT (R-CLI-03) pour pallier l'éphémérité du service worker Manifest V3. Le DPO a fait le choix d'une **fiche Art. 30 distincte (§3.10)** plutôt qu'une dispersion par module afin (a) de matérialiser le caractère transverse du traitement, (b) de centraliser la matrice des TTL courts (5 min — 7 jours) qui constitue la garantie de minimisation Art. 5.1.e, et (c) de tracer la résolution opérationnelle apportée par TACHE-093 (purge automatique `onPurgeDaily`).

---

*Document conforme à l'Art. 30 RGPD. À revoir au moins annuellement ou à chaque évolution matérielle d'un traitement. Prochaine revue prévue : 2027-04-19.*
*Aligné avec la politique de confidentialité v1.2, l'AIPD « Alerte mots de passe réutilisés » v1.3, le référentiel ISO 27001 v1.2, le DAT v1.4, le runbook réponse à incident v1.0, et les notes DPO T-074 v1.0 et T-115 v1.0.*
