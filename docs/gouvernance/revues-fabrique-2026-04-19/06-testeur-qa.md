# Revue Fabrique 2026-04-19 — Testeur QA

**Date** : 2026-04-19
**Auteur** : Testeur QA (Fabrique)
**Destinataire** : Orchestrateur — consolidation PR "Revues Fabrique"
**Perimetre** : P5 Tests unitaires + P6 Tests integration + E2E + Plan recette + Accessibilite
**Referentiel** : SESSION.md, BACKLOG.md, coverage-summary.json, fichiers tests/

---

## 1. Bilan general

**Etat global : SATISFAISANT avec deficits identifies.**

La base de tests est solide : 897 tests Vitest verts, pyramide respectee (unit > integration > E2E),
couverture V8 activee avec seuils bloquants. Les modules critiques (M7, M9, M3) ont une couverture
fonctionnelle serieuse. Deux E2E specifiques a l'extension sont operationnels en CI Ubuntu xvfb.

Cependant, quatre lacunes materielles subsistent :

1. TACHE-059 (12 scenarios TC-M7-01 a TC-M7-12) : non implementes. Les tests M7 existants couvrent
   des sous-ensembles fonctionnels (cooldown, dedup, pending_toast) mais pas les 12 scenarios
   post-mortem nommes TC-M7-01 a 12. Cinq scenarios supplementaires identifies en comite
   (TACHE-082 : SM-01/02/04/05/07) sont egalement en attente.

2. TACHE-060 (mock chrome.storage.local JSON-strict) : non implemente. Les mocks actuels acceptent
   des types non serialisables (ArrayBuffer, Date, Map) que Chrome rejetterait silencieusement.
   Le risque de regression P-018 reste non couvert par les tests.

3. TACHE-063 (protocole recette formalisee) : non produit. Le plan de tests manuels v1.0 existe
   (PR #34, 34 scenarios, chapitre UC-01 a 15), mais le protocole formel avec PV date et
   grille de validation n'a pas ete produit separement.

4. Tests E2E sur UC-01 a UC-05 : seul UC-06 est couvert en E2E automatise. UC-01 a UC-05
   (bloquants v1) restent exclusivement en tests manuels a derouler par le Commanditaire.

---

## 2. Perimetre couvert — inventaire exhaustif

### 2.1 Tests unitaires Vitest (48 fichiers, 897 tests verts)

**Repertoire tests/unit/** — 44 fichiers de test :

| Sous-repertoire | Fichiers | Perimetre |
|-----------------|----------|-----------|
| modules/ | m2, m3, m3-handler, m5, m6, m6-handler-checkquiz, m7, m7-cooldown-fonctionnel, m7-dedup, m9, m17 | 11 fichiers — handlers metier |
| background/ | alarm-manager, crypto-m7-native, message-router, score-calculator-components, service-worker-install-flag, storage-service | 6 fichiers — infrastructure SW |
| content-scripts/ | password-detector-fuc0101, password-detector-isTrusted, password-detector-t094-extension-context, password-detector-t095-uc05-sendmessage, password-detector-t098-t100-hardening, password-detector-uc01, password-detector-uc03, paste-detector-m17-password-exclusion | 8 fichiers — detectors |
| pages/popup/ | popup-degraded-badge, popup-dom-constructors, popup-init-catch, popup-pure-functions, popup-render-sections, popup-t152-new-components, popup-theme-apply | 7 fichiers — popup UI |
| pages/options/ | options-theme-selector | 1 fichier |
| services/ | canary-service, heartbeat-service, incident-service, rate-limiter | 4 fichiers |
| shared/ | logger, utils/classify-error | 2 fichiers |
| (racine unit/) | crypto-service, hash, levenshtein, quota-manager, score-calculator | 5 fichiers |

**Repertoire tests/integration/** — 4 fichiers :

| Fichier | Scenarios couverts |
|---------|--------------------|
| boot-sequence.test.ts | TC-M7-13/14/15/17/24, TC-TACHE-079-01/02/03/04, TC-M2-INT-01/02/03, TC-M3-INT-01/02, TC-M5-INT-01/02, TC-M6-INT-01/02, TC-M9-INT-01/02, TC-M17-INT-01/02 |
| service-worker.test.ts | Tests d'integration SW |
| storage-service.test.ts | Tests d'integration StorageService + IDB |
| storage-migration-v1-v2.test.ts | Migration v1->v2 IndexedDB |

### 2.2 Tests E2E Playwright (2 fichiers, 15 tests)

| Fichier | Tests | Perimetre |
|---------|-------|-----------|
| uc06-react-dynamic-input.spec.ts | 3 | UC-06 : React useEffect delay, isTrusted filter |
| accessibility-themes.spec.ts | 12 (4 pages x 3 themes) | TACHE-150 : axe-core wcag2a/2aa/21aa/22aa |

**CI** : job `e2e` en CI Ubuntu via xvfb (TACHE-106, PR #14). Chrome headed MV3 supporte.
**Regle isTrusted** : documentee et implementee (TACHE-099, PR #15). UC-06 l'applique strictement.

### 2.3 Plan de tests manuels

`docs/p5-recette/plan-tests-manuels-consolide-v1.0.md` (1388 lignes, 34 scenarios, PR #34)

| Chapitre | UC / Module | Scenarios | Criticite |
|----------|-------------|-----------|-----------|
| 4 | UC-01 Login multi-etape | TC-M7-UC01-01 a 04 + GG-01 a GG-05, MS-01 a MS-03 | P0 bloquant v1 |
| 5 | UC-02 Password managers | S-UC02-* | P0 bloquant v1 |
| 6 | UC-03 Iframes same-origin | S-UC03-* | P0 bloquant v1 |
| 7 | UC-05 Toggle show/hide | S-UC05-* | P0 bloquant v1 |
| 8 | UC-06 Inputs dynamiques | S-UC06-* | P0 bloquant v1 |
| 9 | M2 Typosquatting | Scenarios M2 | P1 |
| 10 | M3 Score hebdomadaire | Scenarios M3 DevTools | P1 |
| 11 | M5 Mise a jour navigateur | Scenarios M5 | P1 |
| 12 | M6 Quiz spaced repetition | Scenarios M6 | P1 |
| 13 | M9 Donnees sensibles | Scenarios M9 | P1 |
| 14 | M17 Presse-papiers | Scenarios M17 | P1 |
| 15 | Matrice providers M7 | Matrice m7 (Google, Microsoft, Bitwarden...) | Variable |

Le plan couvre UC-01 a UC-06 (P0 v1) et les 6 modules non-M7. Les UC-04 (iframes cross-origin),
UC-07 a UC-15 (post-v1) sont documentes comme hors perimetre v1 ou limites connues.

### 2.4 Fixtures E2E

`tests/fixtures/` : 5 fichiers HTML (uc06-conditional-step, uc06-react-orphan-input,
uc06-react-rerender, uc06-react-use-effect, uc06-vue-modal). Couverture correcte pour UC-06.
Aucune fixture pour UC-01 a UC-05 (tests manuels uniquement).

---

## 3. Manquants identifies

### 3.1 TACHE-059 — 12 scenarios TC-M7-01 a TC-M7-12 (Must, A faire)

Les 12 scenarios nommes TC-M7-01 a TC-M7-12 cites dans le post-mortem M7 (D-PM-02) n'existent
pas sous ces identifiants dans les tests actuels. Les tests existants couvrent des sous-cas
fonctionnels equivalents sous d'autres noms (TC-M7-COOLDOWN-*, TC-M7-SUPPRESS-*, TC-M7-MIG-*,
TC-UC03-DEDUP-*, TC-M7-ADR-04, etc.) mais la traceabilite formelle "TC-M7-01 a 12" est absente.

Cinq scenarios supplementaires identifies en comite de revue de code (TACHE-082, Should, A faire)
ne sont pas non plus implementes :
- SM-01 : ArrayBuffer brut dans canary_ciphertext — regression P-018 directe
- SM-02 : validation runtime IncidentContext dans IncidentService.log
- SM-04 : ordre inter-stores key_regenerated ts < purge password_hashes
- SM-05 : cle absente au boot → incident boot_fail hint='key_absent' en integration
- SM-07 : onDetection sans onBootSuccess prealable

### 3.2 TACHE-060 — Mock chrome.storage.local JSON-strict (Must, A faire)

Aucun wrapper JSON-strict n'est implemente dans les mocks actuels. Les mocks des 48 fichiers
de test stockent directement dans un objet JavaScript sans passer par JSON.parse(JSON.stringify()),
ce qui masque les erreurs de serialisation qui se declencheraient en production (ArrayBuffer,
Uint8Array, Date, Map, Set, CryptoKey). La TACHE-060 est reference dans ADR-002, mini-DAT TACHE-061
§INV-06 et le PV de revue de code ("Mock chrome.storage.local non JSON-strict (attend TACHE-060)").

### 3.3 TACHE-063 — Protocole recette formalisee (Must, A faire)

Le plan de tests manuels v1.0 est complet (34 scenarios). Mais le protocole avec PV date,
grille de validation Given/When/Then formalisee, case a cocher PASS/FAIL/BLOQUE signee
n'a pas ete produit comme livrable autonome. Ce protocole est requis pour la phase de
recette officielle (P7).

### 3.4 TACHE-027 — Tests E2E avec extension reelle service-worker et onboarding (P6, A faire)

UC-01 a UC-05 bloquants v1 n'ont aucun test E2E automatise. Ils dependent exclusivement
de la recette manuelle par le Commanditaire (TACHE-068 en cours). L'onboarding n'a aucune
couverture E2E. TACHE-027 est toujours listee "A faire" dans les actions P6 du BACKLOG.

### 3.5 TACHE-097 — TC-UC05-05-SPA detachement React/Vue (Could, A faire)

Scénario de test manquant pour le detachement/re-render d'input React ou Vue. Depend de
TACHE-101 (correctif F-UC01-01, merge PR #29 — livre). La dependance est levee ; le
scenario reste a implementer.

### 3.6 TACHE-096 — Renforcement isTrusted et mock storage par cle (Could, A faire)

Ameliorations signalees en comite (NB-01/NB-03) : beforeEach clearing `_snPasswordInputs`
dans la section UC-02 du fichier `password-detector-isTrusted.test.ts` et mock storage
par cle plutot que positionnel.

### 3.7 TACHE-076 — TC CM-EOP1 integration (Must, A faire)

Scenario de test manquant : canary absent + cle OK → canary_reinit. Signale en comite de
revue de code (OBS-01 PV TACHE-061). Le test d'integration boot-sequence.test.ts couvre
TC-M7-15 (canary absent → init + re-verify) mais pas le chemin specifique CM-EOP1 (dechiffrement
d'un password_hash pour valider la cle, methode `verifyKeyAgainstPasswordHashes()`).

---

## 4. Coherence de la couverture par module

Source : `coverage/coverage-summary.json` (derniere execution locale disponible).
Perimetre exclu du calcul : service-worker.ts, pages/dashboard/, pages/onboarding/, pages/options/.

### 4.1 Tableau de couverture par module

| Module / Composant | Lines % | Functions % | Branches % | Seuil |
|--------------------|---------|-------------|------------|-------|
| **alarm-manager.ts** | 97.1% | 100% | 85.7% | OK |
| **crypto-service.ts** | 100% | 100% | 100% | OK |
| **message-router.ts** | 86.3% | 87.5% | 95.2% | OK |
| **quota-manager.ts** | 82.8% | 83.3% | 66.7% | Branches insuffisantes |
| **score-calculator.ts** | 74.3% | 80% | 87.3% | Lines/statements limites |
| **storage-service.ts** | 79.0% | 66.2% | 90.5% | Functions insuffisantes |
| **export-handler.ts** | 78.3% | 100% | 72.7% | Branches insuffisantes |
| **m2-handler.ts** | 77.4% | 71.4% | 79.5% | Sous seuil 80% |
| **m3-handler.ts** | 96.9% | 100% | 88.9% | OK |
| **m5-handler.ts** | 84.2% | 100% | 64.9% | Branches critiques a ameliorer |
| **m6-handler.ts** | 85.3% | 100% | 72.2% | Branches insuffisantes |
| **m7-handler.ts** | 88.8% | 100% | 89.2% | OK |
| **m9-handler.ts** | 100% | 100% | 93.3% | OK |
| **m17-handler.ts** | 84.6% | 100% | 77.8% | Branches insuffisantes |
| **canary-service.ts** | 96% | 100% | 90% | OK |
| **heartbeat-service.ts** | 97.6% | 100% | 90% | OK |
| **incident-service.ts** | 75.7% | 73.1% | 85.5% | Functions insuffisantes |
| **m2-boot-service.ts** | 82.9% | 100% | 91.1% | OK |
| **m3-boot-service.ts** | 68.4% | 100% | 72.2% | Lines + branches insuffisantes |
| **m5-boot-service.ts** | 73.2% | 100% | 80% | Lines limites |
| **m6-boot-service.ts** | 75.9% | 100% | 79.1% | Lines + branches limites |
| **m9-boot-service.ts** | 84.2% | 100% | 88.9% | OK |
| **m17-boot-service.ts** | 83.8% | 100% | 81.8% | OK |
| **rate-limiter.ts** | 100% | 100% | 100% | OK |
| **password-detector.ts** | 18.96% | 37.5% | 72.7% | CRITIQUE — majeur deficit |
| **paste-detector.ts** | 44.2% | 62.5% | 100% | INSUFFISANT |
| **risk-analyzer.ts** | 73.5% | 50% | 78.9% | Functions insuffisantes |
| **popup.ts** | 28.2% | 25% | 95.7% | CRITIQUE — lines/functions |
| **browser-adapter.ts** | 87.9% | 60% | 85.7% | Functions insuffisantes |

### 4.2 Totaux globaux (perimetre couvert)

| Metrique | Valeur | Seuil defini | Etat |
|----------|--------|-------------|------|
| Lines | 65.1% | 60% | PASSE |
| Statements | 65.1% | 60% | PASSE |
| Functions | 75.4% | 70% | PASSE |
| Branches | 84.3% | 80% | PASSE |

**Les seuils bloquants dans vite.config.ts sont respectes sur le perimetre inclus.** Toutefois
deux fichiers tirent significativement la moyenne vers le bas :

- `password-detector.ts` : 18.96% lignes / 37.5% fonctions — ce fichier fait 1139 lignes.
  Les tests TACHE-017 a 024 ont ete partiellement livres (content-scripts), mais d'importantes
  portions de la logique de detection (MutationObserver, handleTypeAttributeMutation, UC-03
  iframes, UC-05 toggle) restent non couvertes en test unitaire.

- `popup.ts` : 28.24% lignes / 25% fonctions. Ce fichier est exclu des pages UI lourdes
  dans la config (pages/options/, pages/dashboard/, pages/onboarding/) mais `pages/popup/`
  est INCLUS dans le perimetre. La refonte T-152/T-156 a ajoute de nombreuses fonctions
  non encore couvertes au-dela des composants extraits (renderScoreSection, renderModulesSection,
  renderQuotaBar testies dans popup-t152-new-components.test.ts). La fonction `initPopup()`
  et les branches du rendu dynamique restent peu couvertes (chemin catch couvert via
  popup-init-catch, chemins nominaux partiellement via popup-dom-constructors).

### 4.3 Coherence par module metier (M2/M3/M5/M6/M7/M9/M17)

| Module | Handler | Boot-service | Content-script | Evaluation globale |
|--------|---------|-------------|---------------|--------------------|
| M2 | 77.4% | 82.9% | 18.96% (partage password-detector) | Insuffisant — password-detector tire la couverture |
| M3 | 96.9% | 68.4% | N/A | Handler OK, boot-service a renforcer |
| M5 | 84.2% | 73.2% | N/A | Branches handler a renforcer (64.9%) |
| M6 | 85.3% | 75.9% | N/A | Branches handler a renforcer (72.2%) |
| M7 | 88.8% | Dans heartbeat+canary (97%+) | 18.96% | Handler excellent, content-script en deficit |
| M9 | 100% | 84.2% | N/A | Excellent |
| M17 | 84.6% | 83.8% | 44.2% paste-detector | Acceptable |

La pyramide des tests est globalement equilibree au niveau des handlers et services. Le
deficit majeur se concentre sur les content-scripts (password-detector.ts, paste-detector.ts)
qui sont par nature difficiles a tester en jsdom (DOM events, MutationObserver, isTrusted).

---

## 5. Conformite des tests aux exigences

### 5.1 TC-M7-01 a TC-M7-12 (TACHE-059) — Non implementes formellement

Verification : aucun fichier de test ne contient les identifiants "TC-M7-01" a "TC-M7-12"
(pattern non trouve par recherche dans tests/).

Les scenarios couverts de facon equivalente mais sans cet identifiant :
- Cooldown 30j : TC-M7-COOLDOWN-01/02/03/04 dans m7-cooldown-fonctionnel.test.ts
- Suppression_list : TC-M7-SUPPRESS-01/02/03 dans m7-cooldown-fonctionnel.test.ts
- Deduplication : TC-UC03-DEDUP-01/02/03 dans m7-dedup.test.ts
- Migration pending_toast : TC-M7-MIG-LEGACY-01, TC-M7-MIG-EXPIRES-AT-01 dans m7.test.ts
- Cross-lifecycle : TC-M7-RCLI-05 dans m7.test.ts
- Double consommation : TC-M7-ADR-04 dans m7.test.ts
- Boot sequence : TC-M7-13/14/15/17/24 dans boot-sequence.test.ts

Diagnostic : la couverture fonctionnelle de M7 est reelle mais la traceabilite formelle
vers les 12 identifiants post-mortem est manquante. TACHE-059 reste "A faire" dans le BACKLOG.

### 5.2 Mock JSON-strict (TACHE-060) — Non implemente

Confirmation par inspection des mocks dans les 5 fichiers M7 les plus representatifs
(m7.test.ts, m7-cooldown-fonctionnel.test.ts, m7-dedup.test.ts, storage-service.test.ts,
boot-sequence.test.ts) : tous utilisent un objet `mockLocalStorage: Record<string, unknown>`
avec `Object.assign()` direct, sans serialisation JSON intermediaire. La contrainte JSON-strict
definie par ADR-002 (R-CLI-02) n'est pas validee par les tests.

### 5.3 Tests axe-core 12/12 (TACHE-150) — Implemente et marque Termine dans BACKLOG

Le fichier `tests/e2e/accessibility-themes.spec.ts` genere dynamiquement 12 tests
(4 pages : popup, dashboard, options, onboarding) x (3 themes : light, dark, matrix).
L'assertion bloquante ne porte que sur les violations critical/serious (violations moderate/minor
sont documentees mais ne font pas echouer). Le fichier est bien structure avec rapport de
synthese matriciel. TACHE-150 est marquee Termine dans le BACKLOG.

Note : la CI PR #79 (hotfix) signale un echec axe-core sur le contraste du bouton Matrix
(T-157 ouvert, arbitrage blanc vs noir AA en cours). L'etat des 12 audits post-hotfix PR #79
doit etre confirme avant de considerer TACHE-150 comme definitivement close.

### 5.4 Regle isTrusted (TACHE-099) — Conforme

La regle est documentee dans playwright.config.ts et implementee dans uc06-react-dynamic-input.spec.ts :
- TC-UC06-E2E-01/02 utilisent page.locator().fill() et page.locator().click()
- TC-UC06-E2E-03-filter-isTrusted valide deliberement que form.submit() programmatique
  n'est pas capte par M7 (test du filtre isTrusted=false)
Conforme a TACHE-099.

### 5.5 Tests E2E Playwright — Couverture UC-01 a UC-06

| UC | Couverture E2E automatise | Couverture test unitaire | Recette manuelle |
|----|--------------------------|--------------------------|-----------------|
| UC-01 (login multi-etape) | Neant | 4 tests TC-UC01-01 a 04 | Plan v1.0 chapitre 4 |
| UC-02 (password managers) | Neant | isTrusted, t094, t095, t098-t100 | Plan v1.0 chapitre 5 |
| UC-03 (iframes same-origin) | Neant | password-detector-uc03 | Plan v1.0 chapitre 6 |
| UC-04 (iframes cross-origin) | Neant | Neant (limite connue) | Non couvre (document. dans DAT) |
| UC-05 (toggle show/hide) | Neant | t095-uc05-sendmessage | Plan v1.0 chapitre 7 |
| UC-06 (inputs dynamiques) | 3 tests E2E | fuc0101, react-use-effect | Plan v1.0 chapitre 8 |

Constat : UC-06 est le seul cas d'usage P0 bloquant v1 avec couverture E2E automatisee.
Les UC-01 a UC-05 reposent uniquement sur la recette manuelle, non encore executee (TACHE-068
en cours — en attente Commanditaire).

### 5.6 TACHE-027 (E2E extension reelle onboarding + SW) — A faire

Ce point est liste dans les "Actions residuelles P6" du BACKLOG. Aucun fichier spec n'existe
pour l'onboarding, le flux d'installation ou le service-worker E2E au sens systemique (le
fichier uc06 charge bien l'extension reelle, mais reste focalise sur M7/UC-06).

### 5.7 Plan de tests manuels — Couverture UC-01 a UC-15

Le plan v1.0 documente UC-01 a UC-06 en detail (P0 bloquants) et les 6 modules M2/M3/M5/M6/
M9/M17 (P1). UC-07 a UC-15 du post-mortem sont marques "hors perimetre v1" ou "limites
connues documentees" (UC-04 iframes cross-origin, UC-07 autocomplete new-password, etc.).
Le plan ne pretend pas couvrir UC-07 a UC-15, ce qui est coherent avec l'Option A retenue.

---

## 6. Risques tests residuels

| Risque | Severite | Description | Mitigation actuelle |
|--------|----------|-------------|---------------------|
| R-QA-01 | Elevee | TACHE-059 non faite : les 12 scenarios TC-M7 du post-mortem ne sont pas tracables formellement. Un regroupement/renommage des tests existants serait la mitigation minimale. | Coverage fonctionnelle partielle via TC-M7-COOLDOWN-*, TC-M7-DEDUP-*, etc. |
| R-QA-02 | Elevee | TACHE-060 non faite : un ArrayBuffer ou CryptoKey stocke accidentellement dans chrome.storage.local ne sera pas detecte par les tests (P-018 masque). | Revue manuelle des payloads dans ADR-002. |
| R-QA-03 | Elevee | password-detector.ts a 18.96% de couverture de lignes. Des regressions sur UC-03/UC-05 pourraient passer inapercues. | Tests unitaires specifiques par UC present mais incomplets. |
| R-QA-04 | Moyenne | Recette manuelle UC-01 a UC-05 non executee (attend Commanditaire). Les defauts potentiels sur Google SPA et Microsoft cross-hostname ne sont pas encore qualifies. | Plan de tests v1.0 pret a derouler. |
| R-QA-05 | Moyenne | popup.ts a 28.24% de couverture. Les branches du rendu dynamique post-T-156 (pixel-perfect popup) sont peu testees. | Tests TC-GAUGE-*/TC-MODULES-GRID-*/TC-QUOTA-BAR-* couvrent les composants extraits. |
| R-QA-06 | Moyenne | T-157 ouvert : contraste bouton Matrix (axe-core FAIL en CI PR #79). Les 12 audits axe-core ne sont pas tous verts post-hotfix. | Arbitrage en cours — TACHE-157 creee. |
| R-QA-07 | Faible | TACHE-076 non faite : chemin CM-EOP1 (canary absent + cle OK) non couvert en integration. | TC-M7-15 couvre le chemin adjacent mais pas la methode extractee. |
| R-QA-08 | Faible | UC-06 E2E : la verification du stockage dans chrome.storage.local utilise un contournement (log console + DOM status) plutot qu'un acces direct au storage SW. La robustesse de l'assertion sur la persistance du hash est limitee. | Note documentee dans le test, contournement acceptable pour un premier E2E. |

---

## 7. Recommandations

### Priorite Must — a traiter avant release v1

**R-QA-01 : Formaliser la traceabilite TC-M7-01 a TC-M7-12 (TACHE-059)**
Renommer ou completer les tests existants pour qu'ils portent les identifiants post-mortem.
Si un scenario n'est pas couvert par les tests actuels, l'implementer. Estimation : 1 session.

**R-QA-02 : Implémenter le mock JSON-strict (TACHE-060)**
Creer `tests/helpers/chrome-storage-json-strict-mock.ts` appliquant
`JSON.parse(JSON.stringify(items))` avant chaque `set()` et rejetant les types interdits
(ArrayBuffer, Uint8Array, Blob, Date, Map, Set, CryptoKey) avec une erreur explicite.
Integrer dans les tests M7, canary-service, heartbeat-service, et les tests d'integration
boot-sequence. Estimation : 1 session.

**R-QA-03 : Executer la recette manuelle UC-01 a UC-05 (TACHE-068)**
Le plan v1.0 est pret. Le Commanditaire doit derouler les scenarios sur Google + Microsoft
avant toute release. Sans cette recette, les defauts M7 sur les providers reels ne peuvent
pas etre qualifies. Prealable : build a jour, Chrome 139+.

**R-QA-04 : Resoudre TACHE-157 avant validation axe-core (T-150)**
L'echec CI contraste bouton Matrix doit etre tranche (arbitrage blanc vs noir AA) pour
que les 12 audits axe-core soient tous verts et que TACHE-150 soit definitivement close.

### Priorite Should — a planifier pour v1.1

**R-QA-05 : Augmenter la couverture password-detector.ts**
Objectif : passer de 18.96% a 60%+ de lignes couvertes. Cela implique de tester les
branches MutationObserver, handleTypeAttributeMutation, les chemins UC-03 (iframes) et
UC-05 (toggle) en isolation jsdom. L'atteinte du seuil global 80% (TACHE-026 cible finale)
est conditionnee par cette progression.

**R-QA-06 : Implémenter TC-UC05-05-SPA (TACHE-097)**
La dependance TACHE-101 est levee (PR #29 mergee). Ce scenario teste le detachement/re-render
d'input React/Vue, une regression identifiee en comite de revue de code.

**R-QA-07 : Protocole de recette formalisee (TACHE-063)**
Produire le PV de recette template avec cases a cocher PASS/FAIL/BLOQUE, date, signature
Commanditaire, et grille de non-regression. Requis pour la phase P7.

**R-QA-08 : Automatiser les tests E2E UC-01 a UC-05 (TACHE-027)**
A moyen terme, les scenarios P0 bloquants devraient etre automatises en E2E. Les fixtures
HTML pour les providers (Google, Microsoft, Bitwarden) pourraient etre simulees localement
pour eviter la dependance aux comptes de test en ligne.

### Priorite Could — backlog v2

**R-QA-09 : Scenarios SM-01/02/04/05/07 (TACHE-082)**
Cinq scenarios de securite identifies en comite, notamment SM-01 (ArrayBuffer brut dans
canary_ciphertext, regression P-018 directe). A integrer avec TACHE-060.

**R-QA-10 : Jeu de regression formel (post v1)**
Constituer un sous-ensemble de tests labellises "regression" parmi les tests existants,
rejoue automatiquement a chaque PR. Aujourd'hui la CI rejoue l'ensemble des 897 tests,
ce qui est efficace mais ne distingue pas le coeur de regression des tests exploratoires.

---

## Annexe — Recapitulatif statuts taches Testeur QA

| Tache | Libelle court | Statut BACKLOG | Etat reel constate |
|-------|--------------|---------------|-------------------|
| TACHE-017 a 024 | Tests handlers/storage/router | Termine (partiellement) | Fichiers livres, couverture variable |
| TACHE-025 | coverage-v8 + script | Termine | Operationnel dans vite.config.ts |
| TACHE-026 | Objectif 80% couverture | A faire (seuils conservateurs actifs) | Seuils 60/70/80/60 actifs — cible 80% non atteinte pour password-detector |
| TACHE-027 | E2E extension reelle | A faire (P6) | Non demarre |
| TACHE-059 | TC-M7-01 a 12 | A faire | Non formalises |
| TACHE-060 | Mock JSON-strict | A faire | Non implemente |
| TACHE-063 | Protocole recette | A faire | Non produit |
| TACHE-073 | UC-06 E2E Playwright | Termine | Livre (3 tests, CI verte) |
| TACHE-076 | TC CM-EOP1 integration | A faire | Non couvert |
| TACHE-082 | SM-01/02/04/05/07 | A faire | Non implementes |
| TACHE-095 | TC-UC05-01/04 sendMessage | Termine | Livre dans t095-uc05-sendmessage |
| TACHE-096 | Renforcement isTrusted mock | A faire (Could) | Non applique |
| TACHE-097 | TC-UC05-05-SPA | A faire (Could) | Non implemente |
| TACHE-099 | Regle isTrusted documentee | Termine | Documente + applique UC-06 |
| TACHE-100 | SM-UC02-01, SM-UC02-UC05-01, SM-SALT | Termine | Livre dans t098-t100-hardening |
| TACHE-124 | TC-UC01-01 Google SPA | Termine | Livre dans password-detector-uc01 |
| TACHE-150 | Audit axe-core 12 combinaisons | Termine (avec reserve) | Implemente ; echec CI PR #79 contraste Matrix a resoudre |
