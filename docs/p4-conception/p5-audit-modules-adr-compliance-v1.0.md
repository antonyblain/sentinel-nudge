# Audit de conformité — ADR-001 (SW-BOOT-CONTRACT) et ADR-002 (CROSS-LIFECYCLE-INTENT)

**Version** : 1.0  
**Date** : 2026-04-17  
**Auteur** : Architecte logiciel  
**Phase** : P5  
**Origine** : TACHE-058 — D-PM-01 (PV post-mortem M7, 2026-04-14)  
**Périmètre** : 6 modules (M2, M3, M5, M6, M9, M17) + module de référence M7  
**ADR évalués** :
- ADR-001 `SW-BOOT-CONTRACT` — séquence de boot : lire → valider → régénérer/migrer → logger
- ADR-002 `CROSS-LIFECYCLE-INTENT` — actions traversant une frontière de cycle de vie persistées en storage avec TTL

**Revue sécurité (2026-04-17)** : enrichissement par l'Architecte sécurité — qualification des écarts en risques actifs vs dettes de nommage, et croisement avec RISQUES.md (R-ADR-01 à R-ADR-05).

---

## Méthode d'audit

Pour chaque module, les fichiers suivants ont été lus intégralement :

- `src/background/handlers/<mx>-handler.ts`
- `src/background/service-worker.ts` (instanciation, boot sequence IIFE)

Critères d'évaluation :
- **OK** — conforme
- **KO** — non conforme, écart documenté
- **N/A** — règle non applicable (handler read-only sans prérequis storage, ou action sans frontière lifecycle)

---

## M7 — Réutilisation mot de passe (référence canonique)

### ADR-001 — SW-BOOT-CONTRACT

| Critère | Résultat |
|---------|----------|
| Prérequis storage ? | Oui (`encryption_key_material`, `password_hashes` IDB, `m7_last_nudge_by_domain`) |
| Séquence boot 4 étapes implémentée ? | Oui (`service-worker.ts` lignes 376–547 : onBootStart → initDB → initService → loadCryptoKey → verify canary → onBootSuccess/Failure) |
| Publie `diagnostics.m7` ? | Oui (`HeartbeatService` — `chrome.storage.local` clé `diagnostics.m7`) |
| R-BOOT-01 (`initBoot()` avec 4 étapes) | OK |
| R-BOOT-02 (écriture critique loggue incident si échec) | OK (`incidentService.log('key_regenerated', 'error', ...)` **avant** `browser.storage.local.set` — `service-worker.ts` lignes 411–421) |
| R-BOOT-03 (TC par invariant) | OK (mini-DAT TACHE-061 plan de tests, TC-M7-SEC-29 ajouté par RQ en v1.1) |
| R-BOOT-04 (publie `diagnostics.<module>`) | OK (`diagnostics.m7` : `ready`, `last_boot_ts`, `boot_count`, `canary_verified`, `last_detection_ts`) |

### ADR-002 — CROSS-LIFECYCLE-INTENT

| Critère | Résultat |
|---------|----------|
| Action traversant une frontière lifecycle ? | Oui (affichage toast après submit → redirect post-login — P-019) |
| Pattern pending-intent implémenté ? | Oui (`pending_m7_toast` — `m7-handler.ts` lignes 287–294) |
| R-CLI-01 (clé nommée `pending_<module>_<action>`) | OK (`pending_m7_toast`) |
| R-CLI-02 (payload JSON-strict) | OK (`{ domain_hash: string, timestamp: number }` — aucun type binaire) |
| R-CLI-03 (TTL obligatoire, `expires_at`) | Partiel — TTL de 10 min appliqué côté consommateur (`timestamp` + constante TTL). La forme canonique `expires_at` (R-CLI-03) n'est pas encore utilisée. Écart mineur. |
| R-CLI-04 (consommation one-shot) | OK (consommateur purge la clé après affichage) |
| R-CLI-05 (TC "intent émis → SW killed → re-démarrage → consommation OK") | KO — aucun TC couvrant ce scénario complet n'est implémenté à ce jour (TACHE-059 couvre TC-M7-01 à TC-M7-12 mais pas explicitement ce scénario E2E) |

**Écarts M7 :** 2
1. `pending_m7_toast.timestamp` au lieu de `expires_at` (R-CLI-03 — mineur, cosmétique)
2. TC "intent → SW kill → consommation" manquant (R-CLI-05)

#### Qualification sécurité des 2 écarts M7

**Écart 1 (`timestamp` vs `expires_at`) — dette de nommage, PAS un risque actif.**  
Le TTL effectif est identique dans les deux formes tant que la constante `600_000` est partagée entre émetteur et consommateur. Aucun scénario de contournement identifié. Si l'hypothèse "constante partagée" devait être brisée (ex. changement de TTL côté émetteur sans mise à jour côté consommateur), le symptôme serait une incohérence de durée, non un fail silent sécurité. Priorité de remédiation : Should (cosmétique + futur-proofing, pas sécuritaire). Pas d'entrée RISQUES.md dédiée.

**Écart 2 (TC R-CLI-05 manquant) — dette de test, risque résiduel mineur.**  
L'implémentation M7 est fonctionnellement correcte (vérifiée manuellement sur herokuapp.com lors du fix P-019), mais l'absence de TC automatisé "intent → SW kill → consommation" laisse une fenêtre où une future régression pourrait passer en CI. Priorité Should. Le risque est couvert implicitement par R-M7-03 (toast M7 éphémère) mais mérite une nouvelle TC (TACHE-091). Pas d'entrée RISQUES.md dédiée — le risque métier est déjà tracé en R-M7-03 accepté.

---

## M2 — Saisie en contexte risqué (typosquatting)

**Fichier** : `src/background/handlers/m2-handler.ts`

### Analyse des prérequis storage

M2 utilise les éléments de storage suivants :
- `m2_session_domains` (`chrome.storage.local`) : liste des domaines déjà nudgés dans la session courante — prérequis pour la déduplication.
- `whitelist` (IndexedDB, store `whitelist`) : domaines de confiance — prérequis pour filtrer les faux positifs.
- `encryption_key_material` : clé AES passée en paramètre, chargée par la boot sequence globale.

La clé AES est chargée par la boot sequence IIFE de `service-worker.ts` et transmise via `createM2Handler(storageService, cryptoKey)`. M2 ne la charge pas lui-même. La boot sequence globale gère donc la dépendance crypto de M2.

`m2_session_domains` est un état de session (perdu lors d'un kill SW sans impact fonctionnel grave — la déduplication rate au pire une session, ce qui est acceptable). La whitelist est gérée par `StorageService` (IndexedDB), initialisée dans la boot sequence via `storageService.initDB()`.

### ADR-001 — SW-BOOT-CONTRACT

| Critère | Résultat |
|---------|----------|
| Prérequis storage ? | Oui (clé AES, whitelist IDB, `m2_session_domains`) |
| Séquence boot 4 étapes implémentée dans le handler ? | KO — aucune `initBoot()` propre à M2 ; la clé AES et l'init IDB sont déléguées à la boot sequence globale sans vérification d'invariant propre à M2 |
| Publie `diagnostics.m2` ? | KO — aucun `diagnostics.m2` dans `chrome.storage.local` |
| R-BOOT-01 (`initBoot()` avec 4 étapes) | KO |
| R-BOOT-02 (écriture critique loggue incident si échec) | N/A (M2 n'écrit pas de données crypto — il lit uniquement la clé préparée par la boot sequence globale) |
| R-BOOT-03 (TC par invariant) | KO — aucun TC couvrant "whitelist corrompue au boot" ou "m2_session_domains corrompu" |
| R-BOOT-04 (publie `diagnostics.<module>`) | KO |

**Écarts M2 / ADR-001 :** 3
1. Absence d'`initBoot()` propre à M2 avec vérification de l'état de la whitelist M2 (R-BOOT-01).
2. Absence de `diagnostics.m2` (R-BOOT-04) — prérequis pour le badge dégradé TACHE-062.
3. Absence de TC pour "whitelist corrompue" et "m2_session_domains corrompu" (R-BOOT-03).

**Risque actif identifié (R-ADR-01) :** classe d'incident "amnésie silencieuse whitelist M2" analogue à P-016/P-018 mais portant sur un store métier. Un store partiellement lisible produirait soit des faux positifs persistants (nuisance), soit des faux négatifs (bypass silencieux du nudge). Score P*I = 2*2 = 4. Mitigation intégrée à TACHE-085.

### ADR-002 — CROSS-LIFECYCLE-INTENT

M2 affiche un overlay au focus sur un champ password d'un site risqué. L'action `risk_detected` → affichage overlay se produit sur la page courante, sans navigation. L'interaction utilisateur (`overlay_action`) se produit sur la même page.

Cependant : si l'utilisateur ferme l'overlay et navigue avant d'interagir (ex. clic sur un lien), l'overlay est détruit avec la page. Ce cas est distinguable de P-019 (M7) car :
- M2 ne fait pas de submit de formulaire → pas de redirect automatique post-action.
- L'état de déduplication (`m2_session_domains`) est intentionnellement perdu entre sessions (il n'est pas un "intent" à consommer — c'est un état de déduplication sessionnel).

Le seul cas de frontière lifecycle potentiel est si M2 devait persister une action en attente (ex. "l'utilisateur a cliqué 'Why' mais la page a navigué avant l'ouverture de l'explication"). Ce cas est actuellement géré par `browser.tabs.create` qui ouvre un nouvel onglet — pas de dépendance à la continuité du content script.

| Critère | Résultat |
|---------|----------|
| Action traversant une frontière lifecycle ? | Non (overlay M2 est synchrone avec la page courante ; `learn_more` ouvre un nouvel onglet sans dépendance) |
| Pattern pending-intent nécessaire ? | N/A |
| R-CLI-01 à R-CLI-05 | N/A |

**Écarts M2 / ADR-002 :** 0

---

## M3 — Score cyber-hygiène hebdomadaire

**Fichier** : `src/background/handlers/m3-handler.ts`

### Analyse des prérequis storage

M3 est déclenché par une alarme planifiée (`m3_weekly`). Il lit :
- `weekly_scores` (IndexedDB, store `weekly_scores`) — scores passés pour le delta.
- `events` (IndexedDB, store `events`) — événements des autres modules pour le calcul.
- `config` (`chrome.storage.local`) — modules actifs, profil.
- Clé AES passée en paramètre (chargée par la boot sequence globale).

M3 ne stocke aucune donnée crypto directement. Sa dépendance à la clé AES est satisfaite par la boot sequence globale (`loadCryptoKey()`).

### ADR-001 — SW-BOOT-CONTRACT

| Critère | Résultat |
|---------|----------|
| Prérequis storage ? | Oui (`weekly_scores` IDB, `events` IDB, `config`) |
| Séquence boot 4 étapes propre à M3 ? | KO — aucune `initBoot()` M3 ; la dépendance IDB est assurée par `storageService.initDB()` global |
| Publie `diagnostics.m3` ? | KO |
| R-BOOT-01 | KO — pas d'`initBoot()` M3 |
| R-BOOT-02 | N/A (M3 n'écrit pas de données critiques non récupérables) |
| R-BOOT-03 | KO — pas de TC pour "weekly_scores corrompus" ou "events IDB inaccessible" |
| R-BOOT-04 | KO |

**Écarts M3 / ADR-001 :** 3
1. Absence d'`initBoot()` M3 avec vérification de la disponibilité du store `weekly_scores` (R-BOOT-01).
2. Absence de `diagnostics.m3` (R-BOOT-04).
3. Absence de TC pour "store events vide / corrompu au moment du calcul score" (R-BOOT-03).

Nuance : l'impact de l'absence de boot contract pour M3 est inférieur à M7 — un score erroné est une anomalie fonctionnelle, pas une défaillance silencieuse de sécurité. La priorité de remédiation est Should plutôt que Must.

### ADR-002 — CROSS-LIFECYCLE-INTENT

M3 est déclenché par une alarme, pas par une action utilisateur. Il n'envoie pas de toast au content script (il met à jour le badge de l'extension, qui survit aux navigations). Aucune frontière lifecycle à traverser pour l'effet principal.

| Critère | Résultat |
|---------|----------|
| Action traversant une frontière lifecycle ? | Non (badge = état persisté par Chrome, survit aux navigations) |
| R-CLI-01 à R-CLI-05 | N/A |

**Écarts M3 / ADR-002 :** 0

---

## M5 — Rappel mise à jour navigateur

**Fichier** : `src/background/handlers/m5-handler.ts`

### Analyse des prérequis storage

M5 utilise :
- `m5_last_nudge_date` (`chrome.storage.local`) — timestamp du dernier nudge, prérequis pour le délai de grâce 48h.
- `m5_snooze_count` (`chrome.storage.local`) — compteur de reports consécutifs, prérequis pour l'anti-snooze infini (SFD CA-M5-06).
- `m5_is_up_to_date` (`chrome.storage.local`) — état mis à jour pour M3.
- Clé AES passée en paramètre.

### ADR-001 — SW-BOOT-CONTRACT

| Critère | Résultat |
|---------|----------|
| Prérequis storage ? | Oui (`m5_last_nudge_date`, `m5_snooze_count`, `m5_is_up_to_date`) |
| Séquence boot 4 étapes propre à M5 ? | KO — les fonctions de lecture (`getLastNudgeDate()`, `getSnoozeCount()`) retournent des valeurs par défaut (0) si absentes, sans validation ni régénération formalisée. Pas d'`initBoot()` explicite. |
| Publie `diagnostics.m5` ? | KO |
| R-BOOT-01 | KO |
| R-BOOT-02 | N/A (M5 n'écrit pas de données crypto non récupérables ; un `m5_snooze_count` corrompu → reset à 0 = comportement acceptable) |
| R-BOOT-03 | KO — pas de TC pour "m5_snooze_count corrompu" ou "m5_last_nudge_date manquant" |
| R-BOOT-04 | KO |

**Écarts M5 / ADR-001 :** 3
1. Absence d'`initBoot()` M5 (R-BOOT-01). Les fonctions `getLastNudgeDate()` et `getSnoozeCount()` gèrent silencieusement l'absence (retournent 0), mais sans logguer — c'est un fail silent partiel.
2. Absence de `diagnostics.m5` (R-BOOT-04).
3. Absence de TC pour les états corrompus des clés M5 (R-BOOT-03).

Note : la sévérité est faible — `m5_snooze_count=0` par défaut est un fallback safe (pas d'impact sécurité). La remédiation est Should.

**Risque actif identifié (R-ADR-02) :** le fail silent partiel ("retour 0 sans log") signifie qu'une corruption légitime d'état passerait inaperçue. Un `m5_snooze_count` reseté spontanément à 0 produit un spam du nudge M5 (nuisance utilisateur, fatigue d'alerte — R-006). Couvert par TACHE-087. Score P*I = 2*2 = 4.

### ADR-002 — CROSS-LIFECYCLE-INTENT

M5 affiche un toast navigateur (`show_update_toast`) via `browser.tabs.sendMessage` directement au content script de l'onglet actif. Cette action peut traverser une frontière lifecycle si :
- L'onglet navigue entre l'appel `requestUpdateCheck()` et l'envoi du message.
- Le SW est tué entre la vérification et l'envoi du toast.

L'implémentation actuelle (lignes 225–230 de `m5-handler.ts`) envoie le message directement via `browser.tabs.sendMessage` **sans pattern pending-intent**. Si le SW est tué entre l'évaluation et l'envoi, ou si l'onglet navigue, le toast est perdu.

| Critère | Résultat |
|---------|----------|
| Action traversant une frontière lifecycle ? | Oui — `show_update_toast` envoyé via `tabs.sendMessage` peut être perdu si l'onglet navigue ou si le SW est interrompu |
| Pattern pending-intent implémenté ? | KO — aucun `pending_m5_update_toast` dans `chrome.storage.local` |
| R-CLI-01 (clé nommée `pending_<module>_<action>`) | KO |
| R-CLI-02 (payload JSON-strict) | N/A (non implémenté) |
| R-CLI-03 (TTL obligatoire) | KO |
| R-CLI-04 (consommation one-shot) | KO |
| R-CLI-05 (TC "intent → SW kill → consommation") | KO |

**Écarts M5 / ADR-002 :** 4 (R-CLI-01, R-CLI-03, R-CLI-04, R-CLI-05 — R-CLI-02 non applicable car le pattern n'existe pas)

Note de pondération : M5 envoie le toast via alarme périodique (toutes les 48h), pas via une action utilisateur immédiate. Le risque de perte est plus faible que pour M7 (submit + redirect synchrone). La remédiation est Should plutôt que Must.

---

## M6 — Mini-quiz phishing (spaced repetition)

**Fichier** : `src/background/handlers/m6-handler.ts`

### Analyse des prérequis storage

M6 utilise :
- `m6_next_quiz_date` (`chrome.storage.local`) — timestamp de la prochaine session, prérequis pour décider de lancer le quiz.
- `m6_install_date` (`chrome.storage.local`) — référence pour le calcul spaced repetition.
- `m6_quiz_deferred` (`chrome.storage.local`) — flag de quiz reporté par l'utilisateur.
- `quiz_sessions` (IndexedDB) — historique des sessions passées.
- Clé AES passée en paramètre.

### ADR-001 — SW-BOOT-CONTRACT

| Critère | Résultat |
|---------|----------|
| Prérequis storage ? | Oui (`m6_next_quiz_date`, `m6_install_date`, `m6_quiz_deferred`, `quiz_sessions` IDB) |
| Séquence boot 4 étapes propre à M6 ? | KO — `getOrInitInstallDate()` initialise `m6_install_date` si absent (lignes 109–122 de `m6-handler.ts`), mais cette logique est appelée lors du traitement d'un message, pas à un boot explicite. Pas d'`initBoot()` formalisé. |
| Publie `diagnostics.m6` ? | KO |
| R-BOOT-01 | KO |
| R-BOOT-02 | N/A (M6 n'écrit pas de données crypto non récupérables) |
| R-BOOT-03 | KO — pas de TC pour "m6_next_quiz_date corrompu" ou "quiz_sessions IDB inaccessible" |
| R-BOOT-04 | KO |

**Écarts M6 / ADR-001 :** 3
1. Absence d'`initBoot()` M6 formalisé (R-BOOT-01). `getOrInitInstallDate()` est un pattern défensif informel — il n'est pas appelé dans la boot sequence globale, seulement lors du premier `check_quiz`.
2. Absence de `diagnostics.m6` (R-BOOT-04).
3. Absence de TC pour "m6_next_quiz_date corrompu" (R-BOOT-03).

**Risque actif identifié (R-ADR-02 — commun à M5/M6) :** une corruption de `m6_install_date` (ex. sérialisation cassée analogue P-018 sur un numérique) déclencherait une régénération silencieuse via `getOrInitInstallDate()`, ce qui décale le calendrier spaced repetition sans trace. Impact : le quiz peut être retardé ou avancé hors plan ; pas d'impact sécurité direct, mais invisible en forensique. Couvert par TACHE-088. Score P*I = 2*2 = 4 (mutualisé avec M5).

### ADR-002 — CROSS-LIFECYCLE-INTENT

M6 affiche l'overlay quiz via `browser.tabs.sendMessage(activeTab.id, { module: 'M6', action: 'show_quiz_toast', ...})` (lignes 483–488 de `m6-handler.ts`). Ce message peut être perdu si l'onglet actif navigue entre la préparation et l'envoi.

Cas typique : le quiz est planifié, l'alarme se déclenche, le SW construit la sélection adaptative, mais l'utilisateur navigue au même instant — le message `show_quiz_toast` échoue silencieusement.

Il existe un mécanisme partiel : `m6_quiz_deferred` (`chrome.storage.local`) est utilisé pour relancer le quiz lors de la prochaine vérification si l'utilisateur a cliqué "Plus tard" (lignes 434–438 de `m6-handler.ts`). Mais ce flag ne couvre pas le cas "message envoyé mais non reçu (onglet navigue)", seulement le cas "utilisateur explicitement différé".

| Critère | Résultat |
|---------|----------|
| Action traversant une frontière lifecycle ? | Oui — `show_quiz_toast` via `tabs.sendMessage` peut être perdu si l'onglet navigue |
| Pattern pending-intent implémenté ? | Partiel — `m6_quiz_deferred` existe pour le report explicite, mais pas pour la perte silencieuse |
| R-CLI-01 (clé nommée `pending_<module>_<action>`) | KO — `m6_quiz_deferred` ne suit pas la convention `pending_<module>_<action>` |
| R-CLI-02 (payload JSON-strict) | KO (la clé `m6_quiz_deferred` stocke un booléen simple, pas de payload structuré) |
| R-CLI-03 (TTL obligatoire) | KO — `m6_quiz_deferred` n'a pas de TTL ni de `expires_at` |
| R-CLI-04 (consommation one-shot) | Partiel — le flag est effacé après consommation (ligne 491), mais seulement en cas de succès |
| R-CLI-05 (TC dédié) | KO |

**Écarts M6 / ADR-002 :** 4 (R-CLI-01, R-CLI-02, R-CLI-03, R-CLI-05 ; R-CLI-04 partiel)

Note : `m6_quiz_deferred` est un précédent positif qui montre que l'équipe a intégré le besoin de persistance. La remédiation consiste à étendre ce pattern pour couvrir la perte silencieuse et à le conformer aux règles R-CLI-01 à R-CLI-05. Priorité Should.

---

## M9 — Indicateur de force de mot de passe

**Fichier** : `src/background/handlers/m9-handler.ts`

### Analyse des prérequis storage

M9 est un handler minimaliste. Il reçoit un score de force (0–4) du content script et l'enregistre dans le store `events` (IndexedDB) via `storageService.logEvent()`. Il ne lit aucun état de storage pour décider d'agir — la décision est entièrement basée sur le payload reçu.

La seule dépendance storage est la clé AES (passée en paramètre via la boot sequence globale) et l'accès à IndexedDB (initialisé par `storageService.initDB()` global).

### ADR-001 — SW-BOOT-CONTRACT

| Critère | Résultat |
|---------|----------|
| Prérequis storage propre à M9 ? | Non — M9 ne lit aucun état storage pour décider d'agir. La clé AES et l'init IDB sont des dépendances globales gérées par la boot sequence. |
| Séquence boot 4 étapes propre à M9 ? | N/A (M9 est un handler read-only au sens de l'ADR-001 : il écrit uniquement, et l'écriture échoue-safe via le catch de `logEvent`) |
| Publie `diagnostics.m9` ? | KO |
| R-BOOT-01 | N/A |
| R-BOOT-02 | N/A |
| R-BOOT-03 | N/A |
| R-BOOT-04 | KO — l'absence de `diagnostics.m9` signifie que l'état de santé M9 n'est pas observable |

**Écarts M9 / ADR-001 :** 1
1. Absence de `diagnostics.m9` (R-BOOT-04) — l'état "M9 opérationnel" n'est pas exposé.

Note : la sévérité est faible. M9 n'a pas d'état critique propre. L'écart R-BOOT-04 est la seule non-conformité. Priorité Could.

### ADR-002 — CROSS-LIFECYCLE-INTENT

M9 reçoit un message du content script et enregistre le score dans IndexedDB. C'est une opération synchrone du point de vue du cycle de vie : le content script envoie le message, le SW répond. Il n'y a pas d'effet différé ni de frontière lifecycle à traverser.

| Critère | Résultat |
|---------|----------|
| Action traversant une frontière lifecycle ? | Non |
| R-CLI-01 à R-CLI-05 | N/A |

**Écarts M9 / ADR-002 :** 0

---

## M17 — Données sensibles presse-papiers

**Fichier** : `src/background/handlers/m17-handler.ts`

### Analyse des prérequis storage

M17 reçoit une détection de données sensibles du content script (`paste-detector.ts`) et affiche un toast. Il ne lit aucun état de storage pour décider d'afficher le toast (le quota est géré par `MessageRouter` en amont). La clé AES est passée en paramètre.

M17 ne lit pas de state persisté propre avant d'agir — sa décision est basée uniquement sur le type de donnée reçu dans le payload.

### ADR-001 — SW-BOOT-CONTRACT

| Critère | Résultat |
|---------|----------|
| Prérequis storage propre à M17 ? | Non — M17 ne lit aucun état propre pour décider d'agir (pas de whitelist, pas de cooldown propre, pas de clé propre) |
| Séquence boot 4 étapes propre à M17 ? | N/A |
| Publie `diagnostics.m17` ? | KO |
| R-BOOT-01 | N/A |
| R-BOOT-02 | N/A |
| R-BOOT-03 | N/A |
| R-BOOT-04 | KO — absence de `diagnostics.m17` |

**Écarts M17 / ADR-001 :** 1
1. Absence de `diagnostics.m17` (R-BOOT-04).

Note : même profil que M9. Priorité Could.

### ADR-002 — CROSS-LIFECYCLE-INTENT

M17 affiche un toast via `show` retourné au content script (la réponse NudgeResponse avec `action: 'show'`). Ce mécanisme passe par `MessageRouter` qui appelle `sender.sendResponse` — la réponse est synchrone avec la page courante. Il n'y a pas de `tabs.sendMessage` différé ni de redirect attendu.

Cependant : si l'utilisateur colle une donnée sensible pendant une navigation (ex. coller une CB dans un formulaire de paiement qui redirige après soumission), le toast M17 pourrait être perdu exactement comme M7. La détection M17 se produit au `paste`, pas au `submit`, donc la probabilité de redirect immédiat est plus faible.

L'implémentation actuelle n'implémente pas de pattern pending-intent pour M17.

| Critère | Résultat |
|---------|----------|
| Action traversant une frontière lifecycle ? | Potentiellement (coller sur une page qui redirige) — cas moins fréquent que M7 mais possible |
| Pattern pending-intent implémenté ? | KO |
| R-CLI-01 à R-CLI-05 | KO (non implémenté) |

**Écarts M17 / ADR-002 :** 4 (R-CLI-01, R-CLI-02, R-CLI-03, R-CLI-04, R-CLI-05 — priorité Could, cas de frontière peu fréquent)

Note de priorité : le cas redirect pendant un collage est moins systématique que le submit M7. La remédiation M17/ADR-002 est Could.

---

## Tableau de synthèse

### ADR-001 par module

| Module | Prérequis storage | initBoot() | diagnostics.<m> | R-BOOT-01 | R-BOOT-02 | R-BOOT-03 | R-BOOT-04 | Écarts |
|--------|-------------------|------------|-----------------|-----------|-----------|-----------|-----------|--------|
| M7 (référence) | Oui | Oui | Oui | OK | OK | OK | OK | 0 |
| M2 | Oui | Non | Non | KO | N/A | KO | KO | 3 |
| M3 | Oui | Non | Non | KO | N/A | KO | KO | 3 |
| M5 | Oui | Non | Non | KO | N/A | KO | KO | 3 |
| M6 | Oui | Non (partiel) | Non | KO | N/A | KO | KO | 3 |
| M9 | Non (global) | N/A | Non | N/A | N/A | N/A | KO | 1 |
| M17 | Non (global) | N/A | Non | N/A | N/A | N/A | KO | 1 |

### ADR-002 par module

| Module | Frontière lifecycle | Pattern pending-intent | R-CLI-01 | R-CLI-02 | R-CLI-03 | R-CLI-04 | R-CLI-05 | Écarts |
|--------|---------------------|------------------------|----------|----------|----------|----------|----------|--------|
| M7 (référence) | Oui (redirect submit) | Oui (`pending_m7_toast`) | OK | OK | Partiel | OK | KO | 2 |
| M2 | Non | N/A | N/A | N/A | N/A | N/A | N/A | 0 |
| M3 | Non (badge) | N/A | N/A | N/A | N/A | N/A | N/A | 0 |
| M5 | Oui (tabs.sendMessage) | Non | KO | KO | KO | KO | KO | 4 |
| M6 | Oui (tabs.sendMessage) | Partiel (`m6_quiz_deferred`) | KO | KO | KO | Partiel | KO | 4 |
| M9 | Non | N/A | N/A | N/A | N/A | N/A | N/A | 0 |
| M17 | Potentiel (coller+redirect) | Non | KO | KO | KO | KO | KO | 4 |

### Total des écarts

| ADR | M2 | M3 | M5 | M6 | M9 | M17 | M7 (ref) | Total |
|-----|----|----|----|----|----|----|----------|-------|
| ADR-001 | 3 | 3 | 3 | 3 | 1 | 1 | 0 | 14 |
| ADR-002 | 0 | 0 | 4 | 4 | 0 | 4 | 2 | 14 |
| **Total** | **3** | **3** | **7** | **7** | **1** | **5** | **2** | **28** |

> **Lecture du total** : 28 écarts au total, dont **26 sur les 6 modules à mettre en conformité** (M2/M3/M5/M6/M9/M17) et **2 sur M7 qualifiés en dettes** (nommage `timestamp` vs `expires_at` couvert par E-CLI-01 + TC R-CLI-05 manquant) — M7 reste la référence canonique malgré ces 2 dettes, toutes deux prises en charge par TACHE-091.

---

## Risques actifs consignés (enrichissement Architecte sécurité)

La revue sécurité du 2026-04-17 consigne les risques nouveaux suivants dans RISQUES.md, dérivés des écarts ADR-001/002 :

| Risque | Périmètre | Score | Couvert par |
|--------|-----------|-------|-------------|
| R-ADR-01 | Amnésie silencieuse whitelist M2 (IDB) | 2*2 = 4 | TACHE-085 |
| R-ADR-02 | Amnésie silencieuse M5/M6 (chrome.storage.local clés d'état) | 2*2 = 4 | TACHE-087, TACHE-088 |
| R-ADR-03 | Future non-conformité INV-SEC-01 si un pending-intent stockait un ciphertext avec IV réutilisé | 1*4 = 4 | R-CLI-06 (ADR-002) |
| R-ADR-04 | Rejeu d'un pending-intent par consommation non atomique | 2*2 = 4 | R-CLI-04 renforcée |
| R-ADR-05 | Logging d'incidents non couvert pour M2/M3/M5/M6/M9/M17 (hors heartbeat) | 3*2 = 6 | À ajouter : élargissement TACHE-085 à 089 OU nouvelle TACHE-092 |

**Impact sur les tâches de remédiation** : les tâches TACHE-085 à 091 doivent intégrer le volet "logging incidents" (R-ADR-05). Proposition à l'Orchestrateur : ajouter explicitement la section "Catégories d'incidents à émettre" dans le périmètre de chaque TACHE-085 à 089 (voir propositions d'ajustement ci-dessous).

---

## Tâches de remédiation proposées

Les tâches suivantes sont proposées pour intégration dans BACKLOG.md. Elles ne font pas l'objet d'une modification de BACKLOG.md dans ce document — elles sont soumises à l'orchestrateur pour priorisation.

### TACHE-085 — Implémenter `initBoot()` et `diagnostics.m2` pour M2

**Module** : M2  
**ADR** : ADR-001 (R-BOOT-01, R-BOOT-03, R-BOOT-04)  
**Priorité** : Must  
**Justification** : M2 est un module critique (bypass quota). L'absence de boot contract pour la whitelist M2 peut conduire à un fail silent si le store whitelist est corrompu (faux positifs persistants). L'absence de `diagnostics.m2` bloque TACHE-062 (badge dégradé).  
**Périmètre** : ajouter `initBoot()` dans `m2-handler.ts` vérifiant la disponibilité du store whitelist, publier `diagnostics.m2` dans `chrome.storage.local`, ajouter 2 TC (whitelist corrompue, m2_session_domains corrompu).  
**Sécurité (R-ADR-05)** : définir et émettre les incidents `m2_whitelist_read_fail` (severity=error) et `m2_whitelist_corrupted` (severity=warn) ; étendre `IncidentContext` (INV-SEC-02) avec les variantes associées.

---

### TACHE-086 — Implémenter `diagnostics.m3` et TC "store events corrompu" pour M3

**Module** : M3  
**ADR** : ADR-001 (R-BOOT-01, R-BOOT-03, R-BOOT-04)  
**Priorité** : Should  
**Justification** : M3 est un module de reporting sans impact sécurité direct, mais l'absence de `diagnostics.m3` bloque la visibilité de l'état de santé du score hebdomadaire.  
**Périmètre** : ajouter une vérification légère de disponibilité IndexedDB au déclenchement de l'alarme M3 (pas de `initBoot()` complet, mais un check + log si `weekly_scores` est inaccessible), publier `diagnostics.m3`, ajouter 1 TC "store events vide/corrompu au moment du calcul".  
**Sécurité (R-ADR-05)** : émettre `m3_events_read_fail` (severity=error) si lecture IDB échoue ; `m3_score_compute_fail` (severity=warn) si calcul dégradé.

---

### TACHE-087 — Implémenter pending-intent `pending_m5_update_toast` et `diagnostics.m5`

**Module** : M5  
**ADR** : ADR-001 (R-BOOT-04), ADR-002 (R-CLI-01/03/04/05)  
**Priorité** : Should  
**Justification** : M5 envoie `show_update_toast` directement via `tabs.sendMessage` sans persistance — le toast peut être perdu si l'onglet navigue. L'impact est limité (alarme 48h, réessai au prochain cycle) mais la non-conformité à ADR-002 est documentée.  
**Périmètre** : ajouter `pending_m5_update_toast: { snooze_count, expires_at }` dans `chrome.storage.local` avant l'envoi du toast M5, consommation côté content script `toast-m5.ts`, purge one-shot, ajouter TC R-CLI-05, publier `diagnostics.m5`.  
**Sécurité (R-ADR-02 + R-ADR-05)** : `initBoot()` M5 valide types de `m5_snooze_count` (number ≥ 0) et `m5_last_nudge_date` (number valide) ; émet `m5_state_corrupted` (severity=warn) sur régénération ; `m5_update_check_fail` (severity=error) sur échec `runtime.requestUpdateCheck`.

---

### TACHE-088 — Conformer `m6_quiz_deferred` à ADR-002 et implémenter `diagnostics.m6`

**Module** : M6  
**ADR** : ADR-001 (R-BOOT-04), ADR-002 (R-CLI-01/02/03/04/05)  
**Priorité** : Should  
**Justification** : `m6_quiz_deferred` est un précédent positif à étendre. La renommer en `pending_m6_quiz` + ajouter `expires_at` + couvrir la perte silencieuse (`tabs.sendMessage` non reçu) aligne M6 sur l'ADR-002 sans réarchitecture majeure.  
**Périmètre** : renommer `m6_quiz_deferred` → `pending_m6_quiz: { questions, expires_at }`, ajouter consommation côté content script `toast-m6.ts` (vérification TTL), purge one-shot, ajouter TC R-CLI-05, publier `diagnostics.m6`.  
**Sécurité (R-ADR-02 + R-ADR-05)** : `initBoot()` M6 valide `m6_install_date` (number > 0), `m6_next_quiz_date` (number ≥ `m6_install_date`) ; émet `m6_state_corrupted` (severity=warn) sur régénération ; `m6_quiz_read_fail` (severity=error) sur échec IDB. **R-CLI-07 applicable** : `pending_m6_quiz.questions` ne doit contenir que des `question_id` (IDs abstraits), pas le texte des questions ou réponses.

---

### TACHE-089 — Implémenter `diagnostics.m9` et `diagnostics.m17`

**Modules** : M9, M17  
**ADR** : ADR-001 (R-BOOT-04)  
**Priorité** : Could  
**Justification** : M9 et M17 n'ont pas de boot contract requis (handlers sans prérequis storage propre), mais l'absence de `diagnostics.m9` et `diagnostics.m17` empêche la surveillance uniforme de l'état de l'extension (TACHE-062).  
**Périmètre** : publier `diagnostics.m9` et `diagnostics.m17` dans `chrome.storage.local` avec au minimum `{ ready: true, last_boot_ts }` initialisés par la boot sequence globale. Pas d'`initBoot()` propre requis.  
**Sécurité (R-ADR-05)** : émettre `m9_log_event_fail` et `m17_toast_emit_fail` (severity=warn) si l'opération principale du handler échoue ; pas de volet crypto à couvrir.

---

### TACHE-090 — Implémenter pending-intent `pending_m17_toast`

**Module** : M17  
**ADR** : ADR-002 (R-CLI-01/02/03/04/05)  
**Priorité** : Could  
**Justification** : cas de frontière lifecycle possible mais rare (coller une CB sur une page qui redirige). L'impact sécurité est faible (l'alerte M17 n'est pas bloquante — c'est un nudge informatif, pas une protection active).  
**Périmètre** : ajouter `pending_m17_toast: { data_type, expires_at }` dans `chrome.storage.local`, consommation côté content script `toast-m17.ts`, purge one-shot, TC R-CLI-05.  
**Sécurité (R-CLI-07)** : `data_type` ∈ {'CB','IBAN','SSN'} (enum), **jamais** la valeur collée brute. R-002 résolu doit rester résolu — nullification en mémoire + pas de plaintext dans l'intent.

---

### TACHE-091 — Corriger R-CLI-03 M7 (timestamp → expires_at) et TC R-CLI-05 M7

**Module** : M7  
**ADR** : ADR-002 (R-CLI-03, R-CLI-05)  
**Priorité** : Should  
**Justification** : harmoniser `pending_m7_toast` avec la forme canonique `expires_at` (au lieu de `timestamp` + constante TTL côté consommateur) et ajouter le TC E2E "intent → SW kill → consommation".  
**Périmètre** : modifier `m7-handler.ts` ligne 292 (`timestamp: Date.now()` → `expires_at: Date.now() + 600_000`), adapter le consommateur `toast-m7.ts`, ajouter TC R-CLI-05 dans le plan de tests M7.  
**Sécurité** : la TC R-CLI-05 doit également couvrir le "double consommation empêchée" (R-ADR-04) — purge atomique vérifiée.

---

### TACHE-092 (proposée, à arbitrer par l'Orchestrateur) — Volet logging incidents transverses

**Modules** : M2, M3, M5, M6, M9, M17  
**ADR** : ADR-001 (R-BOOT-02 étendu)  
**Priorité** : Should  
**Justification** : R-ADR-05 — la forensique est actuellement concentrée sur M7. L'élargissement est déjà intégré aux TACHE-085 à 089 via la section "Sécurité" ajoutée ci-dessus, donc TACHE-092 peut rester implicite (pas besoin de tâche séparée) sauf si l'Orchestrateur préfère isoler le volet sécurité pour raisons de traçabilité. Décision Commanditaire à venir.

### TACHE-093 (proposée — couverture NB-04 du QC) — Étendre `onPurgeDaily` aux clés `pending_*` expirées

**Modules** : transverse (infrastructure)
**ADR** : ADR-002 (Conséquences négatives — section "Nettoyage des intents expirés")
**Priorité** : Should
**Justification** : le pattern pending-intent s'accumule silencieusement dans `chrome.storage.local` si les intents émis ne sont pas consommés (content script non injecté, page fermée avant consommation). La purge quotidienne existante `onPurgeDaily` ne couvre pas ces clés. Sans extension, le storage croît indéfiniment et peut atteindre le quota extension (~5 Mo). Couvrir toutes les clés matchant `pending_*` dont `expires_at < Date.now()`.

---

## Observations transversales

1. **Le diagnostic d'absence de `diagnostics.<module>`** (R-BOOT-04) est systématique sur tous les modules sauf M7. Ce manque bloque TACHE-062 (badge dégradé) pour tous les modules autres que M7. Les tâches TACHE-085 à TACHE-089 sont donc des prérequis à TACHE-062.

2. **La boot sequence globale** (`service-worker.ts` IIFE) couvre la dépendance crypto (clé AES + canary) pour tous les modules, ce qui est positif. Les `initBoot()` manquants concernent les états locaux des modules (whitelist M2, snooze M5, calendrier M6), pas la crypto.

3. **M5 et M6** sont les modules avec le plus d'écarts cumulés (7 chacun). Ce sont aussi les deux modules qui déclenchent des toast via `tabs.sendMessage` (comme M7 avant les fixes P-016/P-019), ce qui les rend structurellement candidats aux mêmes incidents. La priorité Should est justifiée.

4. **M2** présente 3 écarts ADR-001 mais 0 écart ADR-002, ce qui est cohérent avec son mode d'interaction synchrone (overlay déclenché par un focus, pas un submit avec redirect).

5. **Revue sécurité 2026-04-17** : 5 risques nouveaux (R-ADR-01 à R-ADR-05) ajoutés à RISQUES.md. Aucun n'est critique (tous score ≤ 6), tous sont couverts par les tâches de remédiation proposées. Le volet logging incidents transverses (R-ADR-05) est intégré dans les périmètres des TACHE-085 à 089 via les sections "Sécurité" ajoutées.
