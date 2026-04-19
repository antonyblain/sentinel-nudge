# Note DPO — Compatibilité du mini-DAT TACHE-061 (heartbeat M7 + canary + registre d'incidents) avec l'AIPD M7 v1.2

**Référence** : T-074
**Version** : 1.0
**Date** : 2026-04-19
**Auteur** : DPO (Fabrique)
**Niveau de sensibilité** : Exposé
**Destinataires** : Référent qualité, Commanditaire (Antony Blain, RSSI), Architecte sécurité, Architecte logiciel
**Statut** : Avis formel — favorable sous réserves

**Documents confrontés :**
- Mini-DAT TACHE-061 v1.1 (`docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md`)
- AIPD « Alerte mots de passe réutilisés » (M7) v1.2 (`docs/p3-architecture/p3-aipd-m7-v1.2.md`)
- Politique de confidentialité v1.1 (`docs/rgpd/politique-de-confidentialite-v1.1.md`)
- Registre des traitements Art. 30 v1.0 (`docs/rgpd/registre-des-traitements-v1.0.md`)
- Question initiale : **CM-ID4** du STRIDE ciblé mini-DAT §11.3
- Référence : RISQUES.md R-007, R-M7-08

---

## 1. Objet de la note

Le mini-DAT TACHE-061 v1.1 introduit trois mécanismes complémentaires d'instrumentation de la fonctionnalité « Alerte mots de passe réutilisés » (M7) :

1. **Heartbeat M7** (`diagnostics.m7` dans `chrome.storage.local`) — état de santé du module.
2. **Canary hash au boot SW** (`canary_ciphertext` + `canary_iv` dans `chrome.storage.local`) — preuve de fonctionnement de la clé AES-256-GCM.
3. **Registre d'incidents IndexedDB** (store `m7_incidents`, FIFO bornée à 500 entrées) — traçabilité forensique des anomalies M7.

La question soumise au DPO (CM-ID4) porte spécifiquement sur la conformité du **registre d'incidents IndexedDB circulaire** aux deux principes RGPD suivants :

- **Article 5.1.c — Minimisation** : les données traitées doivent être adéquates, pertinentes et limitées à ce qui est nécessaire au regard des finalités.
- **Article 5.1.e — Limitation de la conservation** : les données ne doivent pas être conservées plus longtemps que nécessaire.

La présente note constitue la position formelle du DPO et clôture la pré-validation conceptuelle inscrite à l'AIPD M7 v1.2 §6.5.

---

## 2. Position DPO

### 2.1 Avis global : FAVORABLE SOUS RÉSERVES

Le DPO émet un avis **favorable sous réserves** quant à la compatibilité du registre d'incidents IndexedDB introduit par TACHE-061 avec l'AIPD M7 v1.2, le registre Art. 30 v1.0 et la politique de confidentialité v1.1.

L'architecture du registre est, dans son principe, **conforme** à la doctrine RGPD du projet (Privacy by Design, traitement 100% local, minimisation stricte). Les trois invariants sécurité INV-SEC-02, INV-SEC-03 et INV-SEC-04 ainsi que les contre-mesures CM-ID1 à CM-ID4 et CM-DOS1 à CM-DOS3 répondent **adéquatement** aux risques de fuite informationnelle (R-M7-08), de saturation par déni de service et d'effacement forensique. La levée d'OBS-03 (substitution `_sender.tab?.url` → `_sender.tab?.id`) confirme la discipline de minimisation appliquée au périmètre logger M7.

Toutefois, plusieurs points de **conformité formelle** doivent être consolidés avant que l'avis ne devienne pleinement favorable sans réserve.

### 2.2 Analyse Article 5.1.c (minimisation)

| Aspect | Disposition mini-DAT | Évaluation DPO |
|---|---|---|
| **Champs structurés du `M7IncidentRecord`** | `id`, `ts`, `type`, `severity`, `context` (typage à durcir CM-ID2) | Conforme — quatre métadonnées techniques et un champ contextuel sont strictement nécessaires à la finalité de diagnostic. Aucune redondance. |
| **Plaintext sensible interdit** | INV-SEC-02 : pas de mot de passe, pas de token, pas d'URL avec query string, pas de `domain_hash` corrélé temporellement à une saisie < 5 s | **Conforme et explicite** — l'interdiction est portée à la fois par l'invariant et par les contre-mesures CM-ID1 (revue PR), CM-ID2 (typage union discriminée), CM-ID3 (règle ESLint AST). |
| **Hostname haché** mentionné dans la question CM-ID4 | Le mini-DAT ne mentionne pas l'écriture systématique d'un `hostname haché` dans `context`. Seules les valeurs `boot_count`, `hint`, `reason`, `code_path` sont énumérées dans CM-ID2. | **Sous réserve** — voir réserve §3.1 ci-dessous. Si le `domain_hash` est ré-introduit dans `context` pour un type d'incident futur, cette ré-introduction doit faire l'objet d'une mise à jour de l'AIPD §1.3 et d'un nouveau passage devant le DPO (revue de tout `incidentService.log(...)` qui ajouterait un `domain_hash`). |
| **`severity` (`info` / `warn` / `error`)** | Énumération fermée à 3 valeurs | Conforme — métadonnée nécessaire et minimale. |
| **Volume nominal** | ~200–500 octets par entrée × 500 max = 100–250 Ko total | Conforme — volumétrie négligeable, alignée avec un usage de diagnostic et non d'analytique. |

**Conclusion §2.2** : le registre d'incidents respecte le principe de minimisation **par construction** dès lors que la contrainte CM-ID2 (typage union discriminée `IncidentContext` à la place de `Record<string, unknown>`) est livrée **avant la première PR de TACHE-061 mergée**, comme l'engage le mini-DAT §3.3 (note d'alignement) et CM-ID2.

### 2.3 Analyse Article 5.1.e (limitation de la conservation)

| Aspect | Disposition mini-DAT | Évaluation DPO |
|---|---|---|
| **Mécanisme de purge** | FIFO bornée à `MAX_INCIDENTS = 500` (INV-03) | Conforme — la borne garantit qu'aucun incident ne survit indéfiniment dans le store en présence d'un flux normal. |
| **Priorité severity (INV-SEC-04)** | La purge cible d'abord `info`, puis `warn`, et seulement en dernier ressort `error` | **Conforme et appréciable** — empêche la saturation malveillante d'effacer les incidents critiques. **Effet de bord à signaler** : un incident `severity='error'` peut, en théorie, persister bien au-delà du flux nominal de 500 entrées. À encadrer par une **TTL maximale absolue** (recommandation §4.1 ci-dessous). |
| **TTL absolue par âge** | **Non défini dans le mini-DAT.** Le mini-DAT ne mentionne aucune purge fondée sur `ts < now - X jours` (à la différence des `password_hashes` purgés à 90 j et des `events` purgés à 90 j). | **Sous réserve** — voir réserve §3.2. Le principe de limitation de la conservation impose une durée maximale **temporelle**, pas seulement une borne en cardinalité. |
| **Effacement utilisateur (Art. 17)** | Le bouton « Supprimer toutes mes données » de la page Options exécute `indexedDB.deleteDatabase('sentinel-nudge-db')` (registre M7 inclus) et `chrome.storage.local.clear()` (heartbeat + canary inclus) | Conforme — déjà implémenté pour M7 v1.0, étendu transparentement au store `m7_incidents` par construction. |
| **Exclusion de l'export Art. 20** | **Non explicite dans le mini-DAT.** L'AIPD M7 v1.2 §6.5 condition 3 le mentionne comme **exigence DPO**. | **Sous réserve** — voir réserve §3.3. La portabilité doit exporter les données « personnelles » de l'utilisateur, pas le journal forensique technique destiné au diagnostic. |
| **Conservation du heartbeat et du canary** | `diagnostics.m7` et `canary_ciphertext`/`canary_iv` dans `chrome.storage.local` — durée de vie de l'installation | Conforme — ce sont des métadonnées techniques de fonctionnement, non des données personnelles au sens RGPD (cf. §2.4 ci-dessous). |

**Conclusion §2.3** : la limitation de la conservation est respectée par la borne FIFO 500 mais **incomplètement** au regard de la double exigence (cardinalité + temporalité) que la CNIL recommande pour les journaux de sécurité. Une TTL absolue est nécessaire pour clôturer la conformité.

### 2.4 Qualification RGPD du registre d'incidents

Le DPO confirme que le store `m7_incidents`, dans son périmètre tel que défini par le mini-DAT v1.1 et après application des contre-mesures CM-ID1 à CM-ID4 et INV-SEC-02 :

- **N'est PAS un traitement de données personnelles autonome** au sens du RGPD. Les champs `boot_count`, `severity`, `type`, `hint`, `error_name`, `code_path` sont des métadonnées techniques sans corrélation directe à une personne identifiable.
- **EST néanmoins une mesure technique liée au traitement RT-M7** (registre Art. 30 v1.0 §3.5) au titre des mesures organisationnelles « Registre d'incidents `m7_incidents` (IDB circulaire, TACHE-061) » déjà documentées.
- **DOIT à ce titre être tracé** dans l'AIPD M7 (mise à jour v1.3 recommandée — voir §4.4) et dans le registre Art. 30 v1.1 (en cours de production T-155) au titre des mesures techniques RT-M7.

Cette qualification est cohérente avec la position prise en AIPD M7 §1.8 sur les logs console : « les logs ne sont pas des données traitées au sens RGPD (pas de finalité métier, éphémères dans la console navigateur, non persistés au-delà du cycle de vie du service worker) ». Le registre IDB est plus persistant que les logs console mais reste de même nature (métadonnées techniques de diagnostic). La frontière conformité est tenue par INV-SEC-02 et le typage discriminé CM-ID2.

---

## 3. Réserves

Trois réserves doivent être levées pour que l'avis devienne pleinement favorable sans réserve. Elles sont **bloquantes pour la mise en production** mais **non bloquantes pour le démarrage de TACHE-061** (elles peuvent être traitées en parallèle de l'implémentation ou en post-merge avant publication Chrome Web Store).

### 3.1 Réserve R-074-01 — Engagement formel d'absence de `domain_hash` brut dans `context`

**Constat** : le mini-DAT v1.1 §11.3 (CM-ID2) liste les champs autorisés dans `IncidentContext` (`hint`, `boot_count`, `reason`, `code_path`) mais ne ferme pas explicitement la porte à un futur ajout d'un `domain_hash` ou d'une donnée pseudonymisée corrélable.

**Exigence DPO** : la documentation interne (mini-DAT, JSDoc de `IncidentService.log()`, README développeur) doit porter de manière explicite la règle suivante :

> Tout ajout d'un type d'incident impliquant un champ pseudonymisé (`domain_hash`, fragment de `password_hash`, `installation_salt`) ou tout champ susceptible d'être corrélé à une activité utilisateur observable doit faire l'objet d'une **revue formelle DPO** avant merge, avec mise à jour de l'AIPD M7 §1.8.

**Action** : ajout de cette règle dans la JSDoc de `IncidentService.log()` (TACHE-061) et dans le contrat documentaire de `M7IncidentType` (`src/shared/types/diagnostics.ts`). Mention dans `LESSONS_LEARNED.md` (règle permanente).

**Impact** : aucun sur le périmètre actuel de TACHE-061 (les types listés respectent déjà la règle).

### 3.2 Réserve R-074-02 — TTL absolue par âge en complément de la borne FIFO

**Constat** : la borne `MAX_INCIDENTS = 500` couplée à INV-SEC-04 (priorité severity) garantit qu'un incident `severity='error'` peut persister indéfiniment si le flux nominal d'incidents `info`/`warn` reste sous le seuil de saturation. Cette persistance théorique illimitée n'est pas conforme à la doctrine CNIL applicable aux journaux de sécurité (recommandation : durée maximale absolue de 6 à 12 mois pour les journaux applicatifs locaux).

**Exigence DPO** : ajouter à `IncidentService` une **purge complémentaire par âge** :

- Tout incident dont `ts < Date.now() - 365 jours` est purgé sans condition de severity, lors de la purge hebdomadaire `onPurgeDaily` du service worker (alarme déjà existante pour M7 password_hashes).
- La durée de 365 jours est cohérente avec la durée nominale d'instruction d'un incident de sécurité (postmortem + capitalisation + détection de récurrence sur cycle annuel).
- L'AIPD M7 v1.3 mentionnera cette TTL dans le tableau §1.3.

**Action** : ajout d'une méthode `IncidentService.purgeOldEntries(maxAgeDays: number = 365)` appelée par `onPurgeDaily`. Test TC-M7-30 (à créer) : insertion d'un incident antidaté → purge confirmée.

**Impact** : ajout mineur en TACHE-061 (méthode + test) ou TACHE-062 (selon planification — à arbitrer par l'Architecte logiciel).

### 3.3 Réserve R-074-03 — Exclusion explicite du registre d'incidents de l'export de portabilité Art. 20

**Constat** : l'export de portabilité actuel (TACHE-013 livrée) exclut déjà les hashes bruts de `password_hashes` (AIPD M7 §2.4 — « Exclusion des hashes bruts de l'export de portabilité »). Le store `m7_incidents` n'étant pas mentionné dans le périmètre d'export TACHE-013 (créé avant TACHE-061), il pourrait être inclus par défaut lors d'une refactorisation future de l'export.

**Exigence DPO** : 

1. **Exclusion par défaut** : `m7_incidents` est exclus de l'export Art. 20 par défaut. L'export reste centré sur les données utilisateur métier (préférences, scores hebdo, dates de quiz) et exclut les journaux techniques de diagnostic.
2. **Option explicite « Inclure mon journal de diagnostic »** dans la page Options de l'export — cas d'usage : l'utilisateur souhaite partager son journal avec le mainteneur pour aider au diagnostic d'un bug. Cette option est désactivée par défaut, accompagnée d'un avertissement (« contient des informations techniques sur le fonctionnement de votre extension »).
3. **Documentation claire** : la politique de confidentialité v1.2 (futur bump) mentionnera explicitement cette exclusion par défaut au §8 (droits) et §10 (mesures de sécurité).

**Action** : modification de `export-handler.ts` pour exclure le store `m7_incidents` (TACHE à créer, dépendance TACHE-061). Mise à jour future de la politique de confidentialité.

**Impact** : ajout d'une tâche distincte dans le BACKLOG (T-XXX à créer par l'orchestrateur).

---

## 4. Recommandations

### 4.1 Recommandation R-074-REC-01 — Traçabilité du registre dans le registre Art. 30

Le registre des traitements Art. 30 (en cours de production v1.1 par T-155) doit mentionner **explicitement** le store `m7_incidents` dans la fiche RT-M7 (« Alerte mots de passe réutilisés ») au titre des **mesures techniques** :

> Registre d'incidents IDB local (store `m7_incidents`, circulaire FIFO 500, TTL 365 j, severity-prioritized purge INV-SEC-04, exclu de l'export portabilité Art. 20 par défaut).

Cette mention assure la cohérence entre le mini-DAT, l'AIPD et le registre Art. 30, et permet au DPO de tracer l'existence du store en cas d'audit CNIL.

### 4.2 Recommandation R-074-REC-02 — Bouton « Vider mon registre d'incidents » dans la page Options

Au-delà du bouton global « Supprimer toutes mes données », exposer un bouton dédié « Vider mon registre d'incidents » dans la page Options (section diagnostic). Justification : permet à l'utilisateur d'exercer son droit à l'effacement Art. 17 de manière granulaire, sans perdre ses préférences ni son historique de scores. Cohérent avec l'AIPD M7 §6.5 condition 4 (déjà pré-validée).

**Action** : ajout d'une tâche distincte dans le BACKLOG (TACHE UI dédiée + handler IDB `clear()` sur le store `m7_incidents`). Non bloquant pour TACHE-061.

### 4.3 Recommandation R-074-REC-03 — Bouton « Voir mon registre d'incidents » (transparence radicale)

En cohérence avec le principe de transparence radicale du projet (politique de confidentialité §10.2 « Transparence radicale »), exposer une page de visualisation du registre dans la page Options (section diagnostic). L'utilisateur doit pouvoir lire son propre journal de diagnostic, conformément à l'esprit de l'Art. 15 RGPD (droit d'accès), même si le registre n'est pas formellement qualifié de donnée personnelle.

**Action** : ajout d'une tâche distincte dans le BACKLOG (UI + sélecteur severity/type, lecture seule). Non bloquant pour TACHE-061.

### 4.4 Recommandation R-074-REC-04 — Bump AIPD M7 v1.3 après livraison TACHE-061

Une fois TACHE-061 livrée et les réserves R-074-01 / 02 / 03 traitées, l'AIPD M7 doit être bumpée en v1.3 pour intégrer :

- Une nouvelle ligne dans le tableau §1.3 « Données traitées » : registre d'incidents `m7_incidents` (nature : métadonnées techniques de diagnostic ; stockage : IDB store `m7_incidents` ; durée : 365 jours max OU 500 entrées FIFO, plus restrictif des deux).
- Une mise à jour du §1.8 « Inventaire des logs » étendue au registre IDB (en complément des logs console).
- Une mise à jour du §6.5 « Cohérence avec TACHE-074 » → remplacée par une mention « Validation TACHE-074 v1.0 (2026-04-19), avis favorable sous réserves levées en TACHE-XXX/YYY/ZZZ ».
- Un ajout aux conditions §6.2 (interdiction de logger un `domain_hash` brut sans revue DPO).

**Action** : tâche à planifier post TACHE-061 (T-XXX à créer par l'orchestrateur).

### 4.5 Recommandation R-074-REC-05 — Tabletop annuel : ajout d'un scénario « registre d'incidents corrompu »

Le runbook réponse à incident (`docs/securite/runbook-reponse-incident.md` §9) prévoit un tabletop annuel. Le DPO recommande d'ajouter au scénario d'octobre 2026 (P1 supply chain) un volet dédié : « comment exploiter / interpréter le registre `m7_incidents` lors d'un incident M7 réel ? ». Permet de valider l'utilité opérationnelle du registre et de détecter des angles morts.

---

## 5. Conclusion : favorable sous réserves

**Avis formel DPO** : **FAVORABLE SOUS RÉSERVES**.

Le registre d'incidents IndexedDB introduit par TACHE-061, dans le cadre du mini-DAT v1.1, est **compatible avec l'AIPD M7 v1.2**, le registre Art. 30 v1.0 et la politique de confidentialité v1.1 sous réserve de la levée des trois réserves bloquantes pour la mise en production :

1. **R-074-01** : engagement formel d'absence de `domain_hash` brut dans `context` (JSDoc + LESSONS_LEARNED).
2. **R-074-02** : TTL absolue par âge complémentaire (365 jours) en sus de la borne FIFO 500.
3. **R-074-03** : exclusion explicite du registre de l'export de portabilité Art. 20 par défaut (option utilisateur sur demande).

Les cinq recommandations R-074-REC-01 à 05 sont **non bloquantes** mais structurent la conformité dans la durée (registre Art. 30, transparence radicale, bump AIPD, tabletop).

**Le DPO autorise le démarrage de l'implémentation TACHE-061** sur la base du mini-DAT v1.1, sous condition que :
- les trois réserves soient ouvertes en BACKLOG (tâches dédiées) avant la première PR mergée ;
- la CM-ID2 (typage union discriminée) soit livrée avec la première PR de TACHE-061, comme l'engage le mini-DAT §3.3 ;
- la levée formelle des trois réserves soit faite avant publication Chrome Web Store.

Cet avis sera consigné en pré-validation à l'AIPD M7 §6.5 (déjà fait en v1.2) et formalisé en bump v1.3 après livraison TACHE-061.

---

## 6. Références

- Mini-DAT TACHE-061 v1.1 — `docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md` (§3.3, §6bis, §11.3, §11.5, §12)
- AIPD M7 v1.2 — `docs/p3-architecture/p3-aipd-m7-v1.2.md` (§1.3, §1.8, §2.2, §2.3, §6.5)
- Politique de confidentialité v1.1 — `docs/rgpd/politique-de-confidentialite-v1.1.md`
- Registre des traitements Art. 30 v1.0 — `docs/rgpd/registre-des-traitements-v1.0.md` (RT-M7)
- ISO/CEI 27001:2022 Annexe A — A.5.34 (Privacy by design), A.8.10 (Data deletion), A.8.11 (Data masking), A.8.12 (DLP), A.8.15 (Logging)
- RGPD Art. 5.1.c (minimisation), Art. 5.1.e (limitation conservation), Art. 17 (effacement), Art. 20 (portabilité)
- Lignes directrices CEPD WP248 rev.01 (AIPD)
- Guide CNIL « Sécurité des données personnelles » 2024 (durée des journaux applicatifs)

---

*Note DPO produite par le DPO — Fabrique — v1.0 2026-04-19. Validité : jusqu'à livraison TACHE-061 puis intégration au bump AIPD M7 v1.3.*
