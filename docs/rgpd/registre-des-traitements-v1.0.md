# Registre des traitements — Sentinel Nudge

**Version** : 1.0
**Date** : 2026-04-18
**Auteur** : DPO de la Fabrique (fonction)
**Conformité** : RGPD Art. 30
**Lié à** : politique de confidentialité v1.0, AIPD M7 v1.0, référentiel ISO 27001 v1.1, runbook réponse à incident

---

## 1. Responsable de traitement

Conformément à la §2 de la politique de confidentialité v1.0 (triple qualification) :

| Acteur | Statut RGPD | Portée |
|---|---|---|
| **Utilisateur final** | Responsable de traitement de fait | Traitement local sur son appareil, dans son navigateur |
| **Antony Blain** (particulier, éditeur du code GPL v3) | Éditeur — **sans accès aux données** | Conception du code open source, aucune collecte ni remontée |
| **Éditeur du navigateur** (Google / Microsoft / Mozilla) | Responsable du stockage (profil navigateur) | Stockage chrome.storage.local et IndexedDB dans le profil utilisateur |

**DPO** : non désigné (Art. 37 — pas d'obligation : absence d'activité commerciale, absence de traitement à grande échelle de catégories particulières, absence de suivi systématique à grande échelle par l'éditeur). Rôle « DPO de la Fabrique » tenu comme fonction de conformité interne au processus de développement.

---

## 2. Matrice synthétique des traitements

| ID | Module | Finalité | Base légale | Durée conservation | Données | Destinataires | Transferts UE |
|---|---|---|---|---|---|---|---|
| RT-M2 | Typosquatting + HSTS | Alerte domaine suspect | Art. 6.1.f | Jusqu'à suppression | Hash de domaine | Aucun | Aucun |
| RT-M3 | Score hebdomadaire | Feedback cyber-hygiène | Art. 6.1.f | 90 jours rolling | Events agrégés non-nominatifs | Aucun | Aucun |
| RT-M5 | Maj navigateur | Rappel mise à jour | Art. 6.1.f | 30 jours snooze | Version navigateur locale | Aucun | Aucun |
| RT-M6 | Quiz phishing | Apprentissage | Art. 6.1.f | Durée installation | Réponses + score + date | Aucun | Aucun |
| RT-M7 | Réutilisation mdp | Alerte sécurité | **Art. 6.1.a (opt-in)** | 90 jours | Hash salé mdp + hostname | Aucun | Aucun |
| RT-M9 | Certificats | Alerte MITM | Art. 6.1.f | Pas de stockage | Pattern en RAM <10ms | Aucun | Aucun |
| RT-M17 | Presse-papiers | Alerte donnée sensible | Art. 6.1.f | Pas de stockage valeur | Type seul (cb/iban/ssn) | Aucun | Aucun |
| RT-PARAM | Paramètres + whitelist | Configuration utilisateur | Art. 6.1.b | Jusqu'à suppression | Préférences + whitelist M2 | Aucun | Aucun |

---

## 3. Fiches détaillées

### 3.1 RT-M2 — Détection typosquatting et HSTS

- **Finalité** : alerter l'utilisateur lorsqu'il navigue sur un domaine suspect (proche d'un domaine connu — Levenshtein ≥ 2 signaux cumulés) ou absent de la HSTS preload list.
- **Base légale** : Art. 6.1.f RGPD — intérêt légitime de l'utilisateur à être protégé contre le phishing. Test de mise en balance : impact positif significatif (protection contre phishing), traitement strictement local, pas de profilage, possibilité de désactivation à tout moment.
- **Catégories de personnes concernées** : utilisateur final uniquement.
- **Catégories de données** : hash FNV-1a de noms de domaines visités (chrome.storage.local + IndexedDB pour la whitelist utilisateur). Aucune URL complète, aucun timestamp de navigation.
- **Destinataires** : aucun (traitement 100% local).
- **Transferts hors UE** : aucun.
- **Durée de conservation** : whitelist conservée jusqu'à suppression explicite par l'utilisateur. Pas d'historique de navigation.
- **Mesures techniques** : hash non réversible FNV-1a, stockage local uniquement, exclusion via `.gitignore` côté code source. ISO 27001 A.8.12 (Data leakage prevention), A.8.24 (Use of cryptography).
- **Mesures organisationnelles** : AIPD intégrée à l'AIPD projet (M7 pour la partie hash). Politique de confidentialité v1.0 §5.

### 3.2 RT-M3 — Score cyber-hygiène hebdomadaire

- **Finalité** : calculer un score hebdomadaire agrégé à partir des 5 composantes (M5 20%, M6 25%, M2 20%, M7 20%, M9 15%) pour feedback utilisateur (dashboard popup).
- **Base légale** : Art. 6.1.f — intérêt légitime de l'utilisateur à connaître son niveau de cyber-hygiène. Aucun profilage externe.
- **Catégories de personnes concernées** : utilisateur final uniquement.
- **Catégories de données** : events agrégés par module (compteurs hebdomadaires), pas de granularité horodatée fine. Week_key au format `YYYY-Www`.
- **Destinataires** : aucun.
- **Transferts hors UE** : aucun.
- **Durée de conservation** : 90 jours glissants (purge automatique via `onPurgeDaily`).
- **Mesures techniques** : IndexedDB local, store `weekly_scores` isolé, purge rolling 90j. ISO 27001 A.8.10 (Data deletion), A.8.12.
- **Mesures organisationnelles** : RT-M3 documenté dans DAT v1.3 §score-calculator.

### 3.3 RT-M5 — Rappel mise à jour navigateur

- **Finalité** : inciter à la mise à jour du navigateur si une version plus récente est disponible.
- **Base légale** : Art. 6.1.f — intérêt légitime à maintenir un navigateur à jour (protection contre CVE connues).
- **Catégories de personnes concernées** : utilisateur final.
- **Catégories de données** : version actuelle du navigateur (locale, récupérée via `chrome.runtime.requestUpdateCheck()` API native), compteur de snooze, date du dernier nudge.
- **Destinataires** : aucun.
- **Transferts hors UE** : aucun (pas de version embarquée, pas d'appel réseau applicatif).
- **Durée de conservation** : état volatile, snooze réinitialisé à chaque mise à jour effective. Historique non conservé.
- **Mesures techniques** : validation de type/plage au boot SW (ADR-001 `initBoot()`, couvert par TACHE-087 M5 mergé).
- **Mesures organisationnelles** : incident `m5_snooze_corrupted` tracé si régénération (registre incidents IDB).

### 3.4 RT-M6 — Quiz phishing spaced repetition

- **Finalité** : renforcer la culture cyber-hygiène par des quiz courts, selon un calendrier de révision espacée ([0, 7, 21, 42, 70] jours puis mensuel).
- **Base légale** : Art. 6.1.f — intérêt légitime à la formation continue de l'utilisateur.
- **Catégories de personnes concernées** : utilisateur final.
- **Catégories de données** : réponses aux quiz (référence par ID de question, **jamais le texte** — R-CLI-07), score par session, date d'installation (pivot spaced repetition), prochaine date de quiz.
- **Destinataires** : aucun.
- **Transferts hors UE** : aucun (corpus quiz embarqué dans l'extension, chargé localement).
- **Durée de conservation** : historique des sessions quiz conservé durant la durée d'installation de l'extension. Effaçable via bouton « Supprimer mes données ».
- **Mesures techniques** : IDs de questions abstraits uniquement, corpus bilingue FR/EN embarqué versionné. ISO 27001 A.8.12, A.5.34.
- **Mesures organisationnelles** : `initBoot()` M6 avec validation `m6_install_date` (TACHE-088 mergé).

### 3.5 RT-M7 — Détection réutilisation mots de passe

- **Finalité** : alerter l'utilisateur lorsqu'il réutilise un même mot de passe sur plusieurs domaines distincts (risque de cascade suite à fuite).
- **Base légale** : **Art. 6.1.a RGPD — consentement explicite via opt-in dans l'onboarding**. Le consentement est retirable à tout moment (désactivation module M7 dans les paramètres → purge automatique du store `password_hashes`).
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
  - ISO 27001 A.8.24 (cryptographie), A.8.12 (DLP), A.8.28 (secure coding).
- **Mesures organisationnelles** : **AIPD M7 v1.0** dédiée (cf. `docs/p3-architecture/p3-aipd-m7-v1.0.md`). Registre d'incidents `m7_incidents` (IDB circulaire, TACHE-061).
- **Base de minimisation** (Art. 5.1.c) : aucune valeur en clair ne transite jamais, aucun identifiant utilisateur, aucun timestamp précis.

### 3.6 RT-M9 — Détection certificat invalide / MITM

- **Finalité** : alerter en cas de certificat invalide ou de connexion probablement sur un MITM (détection heuristique).
- **Base légale** : Art. 6.1.f — intérêt légitime à la sécurité des communications.
- **Catégories de personnes concernées** : utilisateur final.
- **Catégories de données** : pattern détecté en RAM uniquement, **nullifié dès la fin du matching (<10ms)** — conformité R-002 non-stockage.
- **Destinataires** : aucun.
- **Transferts hors UE** : aucun.
- **Durée de conservation** : **aucune persistance** (traitement volatile).
- **Mesures techniques** : variable locale nullifiée immédiatement après usage. ISO 27001 A.8.11 (Data masking), A.8.24.
- **Mesures organisationnelles** : INV-SEC-02 (jamais de texte en clair persistant) applicable.

### 3.7 RT-M17 — Détection presse-papiers sensible

- **Finalité** : alerter l'utilisateur lorsqu'il colle une donnée sensible (CB, IBAN, SSN) sur un site où ce n'est pas attendu.
- **Base légale** : Art. 6.1.f — intérêt légitime à la protection des données sensibles.
- **Catégories de personnes concernées** : utilisateur final.
- **Catégories de données** : **type de donnée uniquement** (enum `cb | iban | ssn`), **jamais la valeur** (R-CLI-07 / INV-SEC-02). Exclusion explicite des inputs `type="password"` (TACHE-023).
- **Destinataires** : aucun.
- **Transferts hors UE** : aucun.
- **Durée de conservation** : pattern `pending_m17_toast` persistant avec `expires_at` 5 min (ADR-002 R-CLI-03) — purgé après consommation ou expiration.
- **Mesures techniques** : détection regex sur event `paste`, enum strict, exclusion type password. ISO 27001 A.8.11, A.8.12.
- **Mesures organisationnelles** : `pending_m17_toast` purgé via `onPurgeDaily` si expiré (TACHE-093 mergé).

### 3.8 RT-PARAM — Paramètres + consentement + whitelist

- **Finalité** : stocker les préférences utilisateur, les consentements par module, la whitelist M2.
- **Base légale** : Art. 6.1.b — exécution d'un contrat (fourniture du service extension) + Art. 6.1.a pour le consentement M7.
- **Catégories de personnes concernées** : utilisateur final.
- **Catégories de données** : préférences (quota, langue, dark mode), état de consentement par module (booléen + date), whitelist M2 (hashs de domaines).
- **Destinataires** : aucun.
- **Transferts hors UE** : aucun.
- **Durée de conservation** : jusqu'à désinstallation de l'extension ou suppression explicite des données (bouton dédié).
- **Mesures techniques** : chrome.storage.local, validation JSON stricte (P-018), `initBoot()` M2 avec contrôle intégrité whitelist (TACHE-085).
- **Mesures organisationnelles** : droit d'accès via bouton « Exporter mes données » (Art. 20 RGPD Art. 20, TACHE-013 livrée).

---

## 4. Synthèse minimisation des données

| Traitement | Donnée minimisée | Justification | Invariant sécurité |
|---|---|---|---|
| RT-M2 | Hash FNV-1a de domaine | Pas d'URL, pas d'historique | A.8.11 |
| RT-M3 | Compteurs agrégés hebdomadaires | Pas de timestamp fin | A.8.12 |
| RT-M5 | Version seule | Pas de téléchargement embarqué | — |
| RT-M6 | ID abstrait de question | Pas de texte de question (R-CLI-07) | INV-SEC-02 |
| RT-M7 | Hash SHA-256 salé + hostname hashé | Valeur jamais transmise, jamais stockée en clair | INV-SEC-01/02 |
| RT-M9 | Pattern RAM volatile | Nullification <10ms (R-002) | INV-SEC-02 |
| RT-M17 | Enum type seul | Valeur jamais lue durablement (R-CLI-07) | INV-SEC-02 |
| RT-PARAM | Préférences + hash whitelist | Pas d'URL, consentement révocable | A.8.11 |

---

## 5. Droits des personnes concernées (Art. 15-22)

Tous les droits s'exercent directement dans l'extension, sans contacter un tiers :

- **Accès / Portabilité** (Art. 15, 20) : bouton « Exporter mes données » dans Options → fichier JSON déchiffré localement (TACHE-013 livrée).
- **Effacement** (Art. 17) : bouton « Supprimer toutes mes données » dans Options → purge IndexedDB + chrome.storage.local. Dialog accessible HTML (TACHE-015 livrée).
- **Rectification** (Art. 16) : non applicable (pas de données déclaratives).
- **Opposition / Retrait consentement** (Art. 7.3, 21) : toggle par module dans Options → purge module-specific.
- **Limitation** (Art. 18) : désactivation module = suspension automatique du traitement.

---

## 6. Mesures de sécurité techniques (récap)

Référence : `docs/securite/referentiel-iso27001-v1.2.md` v1.2 (12 contrôles explicites + A.5.24/26 Géré + procédure DPO E1-E6).

- A.5.7 Threat intelligence · A.5.34 Privacy by design
- A.8.8 Vulnerability management · A.8.10 Data deletion · A.8.11 Data masking
- A.8.12 Data leakage prevention · A.8.15 Logging · A.8.16 Monitoring
- A.8.24 Cryptography · A.8.28 Secure coding
- A.5.24/A.5.26 Information security incident management (Géré post-runbook T-110)

---

## 7. Mesures organisationnelles (récap)

- Politique de confidentialité v1.0 (docs/rgpd/)
- AIPD M7 v1.0 (docs/p3-architecture/)
- Runbook réponse à incident (docs/securite/) — classification P0-P3
- Référentiel ISO 27001 v1.2
- ADR-001 SW-BOOT-CONTRACT + ADR-002 CROSS-LIFECYCLE-INTENT
- Code source open source GPL v3 (auditabilité publique — post TACHE-112)
- Canal signalement vulnérabilités : GitHub Security Advisories (SECURITY.md, actif après passage public)

---

## 8. Registre des violations — Template

Aucune violation enregistrée à ce jour (état 2026-04-18).

| ID | Date | Nature | Personnes concernées | Données impactées | Mesures | Notification CNIL | Notification personnes |
|---|---|---|---|---|---|---|---|
| VIOL-001 | — | — | — | — | — | — | — |

**Procédure** : en cas d'incident de sécurité, le runbook `docs/securite/runbook-reponse-incident.md` impose la saisine DPO systématique (Step 2) et la validation DPO obligatoire avant notification utilisateurs (Step 7 + template 6.5). Articulation avec Art. 33 (notification CNIL < 72h) et Art. 34 (notification personnes concernées).

---

## 9. Responsabilité conjointe de fait (Art. 26)

Traitement coresponsable avec :

- **Éditeur du navigateur hôte** (Google Chrome, Microsoft Edge, Mozilla Firefox) — pour le stockage `chrome.storage.local` et IndexedDB dans le profil utilisateur. Si l'utilisateur active Chrome Sync, les données peuvent être synchronisées vers les serveurs Google selon la politique de l'éditeur (hors contrôle de l'éditeur Sentinel Nudge).
- **Utilisateur final** — qui reste maître de son appareil, de son profil navigateur, de la portée de son consentement M7 opt-in.

L'éditeur Sentinel Nudge (Antony Blain, particulier) n'est **pas un processeur** au sens de l'Art. 28 car il n'accède jamais aux données de l'utilisateur. Il est éditeur de code open source, sans activité commerciale ni collecte.

---

## 10. Historique des versions

| Version | Date | Modifications | Auteur |
|---|---|---|---|
| v1.0 | 2026-04-18 | Création initiale — 8 traitements documentés, cohérence politique confidentialité v1.0 + AIPD M7 | DPO Fabrique |

---

*Document conforme à l'Art. 30 RGPD. À revoir au moins annuellement ou à chaque évolution matérielle d'un traitement. Prochaine revue prévue : 2027-04-18.*
