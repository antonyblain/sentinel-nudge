# PV — Comité de revue code TACHE-061

**Version** : 1.0
**Date** : 2026-04-16
**Phase** : P5
**Objet** : Revue du code TACHE-061 — Heartbeat M7, Canary Hash, Registre d'incidents IndexedDB
**Niveau projet** : Exposé
**Statut** : Validé avec commentaires — 4 corrections bloquantes à appliquer avant merge
**Référence documentaire** : `docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md` v1.1
**Référence commit de départ** : `8590478` (mini-DAT commité, code en working directory)
**Branche courante** : `feature/p4-developpement` (PR #3 vers `develop` ouverte)

---

## Résumé exécutif

Le comité a examiné l'implémentation de TACHE-061 (4 fichiers sources neufs, 3 fichiers modifiés, 4 fichiers de tests, +39 tests, 239 tests OK au total). Le livrable est conforme au mini-DAT v1.1 sur les points structurants (3 services isolés, arbitrages ARB-061-01/02/03 appliqués, invariants INV-01 à 06 et INV-SEC-01 à 05 implémentés, mesures STRIDE CM-C/T/ID/DOS/EOP1 couvertes). Les 3 participants convergent sur un **merge favorable conditionnel à 4 corrections pré-merge**. La divergence Testeur QA / Développeur sur la sévérité de TC-M7-24 a été arbitrée en faveur du Testeur QA (test bidon = Bloquant). Deux nouveaux risques R-M7-08 et R-M7-09 sont à consigner, et les risques R-M7-06 et R-M7-07 sont proposés comme Résolus sur leur périmètre principal.

---

## 1. Ordre du jour

1. Revue conformité architecturale (code vs mini-DAT v1.1 vs DAT)
2. Revue qualité du code (SOLID, Clean Code, couverture, gestion d'erreurs)
3. Revue sécurité (checklist OWASP adaptée MV3, invariants INV-SEC-01 à 05, STRIDE)
4. Revue tests (couverture des 17 IDs TC-M7-*, qualité assertions, mocks, fake IDB)
5. Revue documentation inline (JSDoc, traçabilité mini-DAT)
6. Revue dépendances (aucune nouvelle dépendance introduite — conforme I-001)
7. Arbitrage des divergences et décisions de merge

---

## 2. Participants

| Rôle | Agent |
|------|-------|
| Rapporteur | Développeur |
| Reviewer sécurité | Architecte sécurité |
| Reviewer tests | Testeur QA |

---

## 3. Périmètre revu

### Fichiers sources créés

- `src/shared/types/diagnostics.ts`
- `src/background/services/heartbeat-service.ts`
- `src/background/services/canary-service.ts`
- `src/background/services/incident-service.ts`

### Fichiers sources modifiés

- `src/background/storage-service.ts` (migration IDB v1→v2, `getDB()` public selon ARB-061-01)
- `src/background/service-worker.ts` (boot sequence IIFE avec heartbeat + canary + CM-EOP1)
- `src/background/handlers/m7-handler.ts` (onDetection + logs incidents)

### Fichiers de tests

- `tests/unit/services/heartbeat-service.test.ts` (13 tests)
- `tests/unit/services/canary-service.test.ts` (11 tests)
- `tests/unit/services/incident-service.test.ts` (9 tests)
- `tests/integration/boot-sequence.test.ts` (6 tests)
- `tests/unit/modules/m7.test.ts` (modifié — mocks Heartbeat/Incident)

**Total ajouté** : +39 tests, **239 tests OK** globalement, CI verte (format:check + lint + build + test).

---

## 4. Synthèse des travaux

Le Développeur a présenté l'implémentation en insistant sur trois points :
- Isolation stricte des 3 services (zéro import croisé, orchestration uniquement dans service-worker.ts).
- Respect des 3 arbitrages Commanditaire (ARB-061-01 Option A : `getDB()` public, ARB-061-02 Option B : buffer mémoire 10 entrées avec flush au premier tick post-`initService()`, ARB-061-03 Option A : `MAX_INCIDENTS = 500` avec INV-SEC-04 priorité severity).
- Intégration directe de `IncidentContext` (union discriminée CM-ID2) sans passer par l'étape intermédiaire `Record<string, unknown>` — renforce INV-SEC-02 dès le premier commit.

L'Architecte sécurité a confirmé l'implémentation des 5 invariants INV-SEC-01 à 05 et des 5 contre-mesures STRIDE. Il a confirmé OBS-03 (URL exposée dans console) en **Majeur** et identifié deux nouveaux risques R-M7-08 (fuite console SW) et R-M7-09 (incidents fantômes premier install).

Le Testeur QA a relevé que 14 des 17 IDs de test du mini-DAT sont couverts correctement, et que 3 présentent des lacunes dont **TC-M7-24 (`expect(true).toBe(true)`) en Bloquant** — un test enregistré comme passant alors qu'il ne teste rien pollue les métriques et donne une fausse assurance.

---

## 5. Avis individuels

### 5.1 Rapporteur (Développeur) — Note 4/5

Le livrable est solide, instrumenté avec rigueur et traçable jusqu'au mini-DAT. Le code est propre, documenté, et les invariants sécurité sont tous implémentés. Point de retenue : combinaison de trois fragilités connues non bloquantes (CM-EOP1 sans test d'intégration dédié, Fake IDB maison au lieu de `fake-indexeddb`, double-exécution boot au premier install).

**Points soulevés par l'auteur** :
- La logique CM-EOP1 (test clé vs password_hashes) est inline dans la IIFE du service-worker — devrait être extraite en méthode dédiée `verifyKeyAgainstPasswordHashes()` pour être testable unitairement.
- `StorageService.initDB()` n'est pas explicitement idempotent. La double ouverture `indexedDB.open()` est inoffensive en pratique mais le comportement documenté serait plus robuste.
- Le coalescing du registre repose sur `this.lastInserted` (état mémoire) réinitialisé au kill SW. Comportement acceptable mais non documenté.
- `handleToastAction` catch ligne 217 logge en `console.error` mais n'instrumente pas un incident IDB — point aveugle forensique sur le store `events`.

### 5.2 Architecte sécurité — Note 4/5

Le code implémente avec fidélité l'ensemble des invariants INV-SEC-01 à INV-SEC-05 et des contre-mesures STRIDE validées au mini-DAT. Le contrat typé `IncidentContext` (union discriminée CM-ID2) empêche à la compilation l'introduction de plaintext sensible — excellent travail de défense en profondeur.

**Vérifications conformes** :
- INV-SEC-01 : `crypto.getRandomValues(new Uint8Array(12))` à chaque `CanaryService.init()` — IV AES-GCM jamais réutilisé. Test TC-M7-SEC-25 l'atteste.
- INV-SEC-02 : tous les sites d'appel `incidentService.log(...)` passent des contextes minimisés (enums, compteurs, hashes tronqués). Aucune URL complète, aucun plaintext.
- INV-SEC-03 : `incidentService.log('key_regenerated', ...)` appelé **avant** `generateKey` + `set` dans les deux chemins (`boot_fail` lignes 411-421 et `canary_failed` lignes 490-499).
- INV-SEC-04 : `purgeOldestByPriority` parcourt `['info', 'warn', 'error']` dans cet ordre. TC-M7-SEC-28 le vérifie.
- CM-EOP1 : vérification clé existante via déchiffrement d'une entrée `password_hashes` avant régénération (lignes 440-473).

**Point majeur** : OBS-03 confirmée — `_sender.tab?.url` loggué en clair dans `console.info` m7-handler.ts ligne 342. URL peut contenir tokens SSO, CSRF, session. Périmètre RGPD (minimisation). À corriger avant merge.

**Nouveaux risques identifiés** :
- **R-M7-08** (fuite info console SW) : les `console.*` loggent URL complètes, `err.message` bruts, `boot_count` corrélables. Accessibles via chrome://extensions en mode dev ou bug reports. P=2, I=2, score=4. Mitigation : factory console.* avec minimisation systématique + règle ESLint.
- **R-M7-09** (incidents fantômes premier install) : race `onInstalled` vs IIFE produit systématiquement un `boot_fail` + `key_regenerated` faux positifs. P=3, I=1, score=3. Mitigation : flag `installation_in_progress`.

**Mise à jour statut** : R-M7-06 passe à **Résolu** sur périmètre IDB (le volet console est couvert par R-M7-08). R-M7-07 passe à **Résolu** (INV-SEC-04 implémenté et testé).

### 5.3 Testeur QA — Note 3/5

Effort substantiel, infrastructure de test bien construite (fake IDB en mémoire, mocks chrome.storage). Couverture nominale satisfaisante : 14/17 IDs couverts correctement.

**Trois lacunes substantielles** :
- **TC-M7-24 (Bloquant)** : `expect(true).toBe(true)` avec commentaire "jsdom limitation". Un test enregistré comme passant alors qu'il ne teste rien est plus dangereux qu'un test absent — il donne une fausse assurance de couverture.
- **TC-M7-SEC-29 (Majeur)** : couvre uniquement le retour `absent` du canary. Le chemin distinctif de CM-EOP1 ("canary absent + password_hash déchiffrable avec la clé courante → `canary_reinit` sans régénération") n'est pas testé. C'est précisément le chemin qui protège contre la régression la plus risquée (effacement silencieux des hashes M7).
- **TC-M7-SEC-26 (Majeur)** : pas de validation runtime de `IncidentContext` — uniquement typage statique documenté. En JavaScript pur (sans compilation TS), `context={ password: 'secret' }` passerait.

**Autres observations** :
- TC-M7-20 : assertion `toBeLessThanOrEqual(MAX_INCIDENTS)` laxiste — le mini-DAT §7 impose `toBe(500)` exactement.
- Mock `chrome.storage.local` non JSON-strict (attend TACHE-060).
- Chemins boot "clé absente" (régression P-016) et CM-EOP1 complet absents des tests d'intégration.

---

## 6. Divergences et arbitrages

### Divergence — Sévérité de TC-M7-24

| Reviewer | Position |
|----------|----------|
| Testeur QA | **Bloquant** — test bidon pollue les métriques, fausse assurance de couverture |
| Développeur (rapporteur) | Mineur — jsdom ne supporte pas IDB, correctif prévu post-merge avec `fake-indexeddb` |
| Architecte sécurité | Mineur — la migration v1→v2 est simple (création de store vide), portée du test manquant réduite |

**Arbitrage rendu** : **position Testeur QA retenue**. Un test enregistré comme passant alors qu'il n'exerce aucune assertion réelle est un faux positif de CI et biaise la prise de décision de merge. La correction est triviale : exposer `DB_VERSION` depuis storage-service.ts et asserter `expect(DB_VERSION).toBe(2)`. Le test approfondi (fake-indexeddb) reste planifié en TACHE-077 post-merge.

### Aucune autre divergence

Les 3 reviewers convergent sur OBS-03 (URL dans console → à corriger avant merge), sur l'absence de bloquant sécurité, et sur la qualité globale du livrable.

---

## 7. Notes de satisfaction

| Reviewer | Note | Justification synthétique |
|----------|------|---------------------------|
| Développeur (rapporteur) | **4/5** | Livrable solide, traçabilité mini-DAT excellente, 3 fragilités non bloquantes identifiées |
| Architecte sécurité | **4/5** | INV-SEC-01 à 05 tous implémentés, IncidentContext empêche plaintext à la compilation, bémol OBS-03 et instrumentation console |
| Testeur QA | **3/5** | 14/17 IDs couverts correctement, 2 défauts significatifs affectent la valeur protectrice (TC-M7-24 bidon, TC-M7-SEC-29 chemin distinctif absent) |

**Moyenne comité** : 3,67/5.

---

## 8. Constats classifiés

### 8.1 Bloquants (à corriger AVANT merge)

| Ref | Constat | Localisation | Action |
|-----|---------|--------------|--------|
| **OBS-03** | Fuite URL complète dans `console.info` | `src/background/handlers/m7-handler.ts` ligne 341-342 | Remplacer `_sender.tab?.url ?? 'unknown'` par `_sender.tab?.id ?? 'unknown'` |
| **C-01** | Test bidon `expect(true).toBe(true)` | `tests/integration/boot-sequence.test.ts` — TC-M7-24 | Exporter `DB_VERSION` depuis storage-service.ts et asserter `toBe(2)` |
| **MIN-03** | JSDoc `@param setReady` orphelin | `src/background/services/heartbeat-service.ts` méthode `onDetection()` | Supprimer la ligne `@param setReady` |
| **SM-06 / C-05** | Assertion laxiste | `tests/unit/services/incident-service.test.ts` — TC-M7-20 | `toBeLessThanOrEqual(MAX_INCIDENTS)` → `toBe(500)` |

### 8.2 Majeurs (à tracer en BACKLOG — post-merge)

| Ref | Constat | Cible BACKLOG |
|-----|---------|---------------|
| **OBS-01** | TC-M7-SEC-29 couverture partielle CM-EOP1 (chemin distinctif absent) | TACHE-076 |
| **OBS-02** | TC-M7-24 migration IDB sans assertion réelle (fake-indexeddb nécessaire) | TACHE-077 |
| **MAJ-01** | CM-EOP1 inline dans service-worker.ts à extraire en méthode dédiée testable | TACHE-080 |
| **SM-02 / C-03** | TC-M7-SEC-26 pas de validation runtime `IncidentContext` | TACHE-082 |
| **SM-05 / C-04** | Chemins boot "clé absente" (P-016) et CM-EOP1 complet absents en intégration | TACHE-082 |

### 8.3 Mineurs (à tracer en BACKLOG — post-merge)

| Ref | Constat | Cible BACKLOG |
|-----|---------|---------------|
| **OBS-04** | `storage_write_fail` déclaré mais non instrumenté | TACHE-078 |
| **OBS-05** / **R-M7-09** | Double boot_fail + key_regenerated au premier install | TACHE-079 |
| **MAJ-02** | `StorageService.initDB()` non idempotent | TACHE-081 |
| **SM-01** | Scénario "ArrayBuffer brut" distinct de "clé AES différente" non testé | TACHE-082 |
| **SM-04** | Ordre inter-stores key_regenerated avant purge password_hashes non testé | TACHE-082 |
| **R-M7-08** | Fuite info console SW (URL, err.message, boot_count) | TACHE-083 |
| **R-M7-08 volet DPO** | Mise à jour de l'AIPD M7 pour inventorier les champs console loggés (volet RGPD de R-M7-08) | TACHE-084 |

---

## 9. Tâches complémentaires à créer (→ BACKLOG.md)

| ID | Titre | Priorité | Responsable |
|----|-------|----------|-------------|
| TACHE-076 | Compléter test CM-EOP1 (chemin canary absent + clé OK → canary_reinit) en intégration boot-sequence | Must | Testeur QA + Développeur |
| TACHE-077 | Ajouter `fake-indexeddb` devDependency et réécrire TC-M7-24 avec assertion IDB réelle | Should | Développeur |
| TACHE-078 | Instrumenter `storage_write_fail` aux sites critiques (écritures clé régénérée, pending_m7_toast, heartbeat) | Should | Développeur |
| TACHE-079 | Corriger double-exécution boot IIFE + onFirstInstall au premier install (flag installation_in_progress) | Should | Développeur (avant TACHE-062) |
| TACHE-080 | Extraire CM-EOP1 en méthode dédiée `verifyKeyAgainstPasswordHashes()` testable unitairement | Could | Développeur |
| TACHE-081 | Rendre `StorageService.initDB()` idempotent explicitement (flag dbReady) | Could | Développeur |
| TACHE-082 | Enrichir TACHE-059 avec SM-01 / SM-02 / SM-04 / SM-05 / SM-07 | Should | Testeur QA |
| TACHE-083 | Mitiger R-M7-08 — factory console.* avec minimisation systématique, règle ESLint interdisant `err.message` dans `console.*` | Should | Architecte sécurité + DevSecOps |
| TACHE-084 | AIPD M7 — inventaire exhaustif des champs console loggés, transmettre au DPO (complément TACHE-074) | Should | DPO |

---

## 10. Actions manuelles

Aucune action manuelle attendue à ce stade. L'ensemble des corrections et suivis est dans le périmètre des agents.

---

## 11. Mise à jour du registre des risques (→ RISQUES.md)

### Nouvelles entrées

- **R-M7-08** — Fuite d'information par console SW (URL complètes, `err.message`, `boot_count` corrélables). Catégorie : RGPD / Sécurité. P=2, I=2, **Score=4**. Statut : Ouvert. Mesures : (a) remplacer URL par hostname ou tab.id dans tous les `console.*` (premier pas : OBS-03 pré-merge) ; (b) règle ESLint interdisant `err.message` dans arguments `console.*` (TACHE-083) ; (c) factory console.* avec minimisation (TACHE-083) ; (d) documenter dans AIPD M7 (TACHE-084).
- **R-M7-09** — Incidents fantômes au premier install (race `onInstalled` vs IIFE). Catégorie : Technique. P=3, I=1, **Score=3**. Statut : Ouvert. Mesure : flag `installation_in_progress` (TACHE-079).

### Changements de statut

- **R-M7-06** (fuite info dans context incident) : **Résolu sur périmètre IDB** — INV-SEC-02 + CM-ID2 (union typée `IncidentContext`) implémentés et testés (TC-M7-SEC-26 sur type-system). Le volet console est désormais couvert par R-M7-08 distinct.
- **R-M7-07** (purge FIFO exploitable) : **Résolu** — INV-SEC-04 (priorité severity `info → warn → error` non purgeable) implémenté et testé (TC-M7-SEC-28, saturation 600 incidents info ne purge aucun error antérieur).

---

## 12. Fiche qualité

| Critère | Résultat |
|---------|----------|
| Conformité au mini-DAT v1.1 | Conforme sur points structurants (arbitrages, invariants, STRIDE) |
| Qualité du code (SOLID, Clean Code) | 4/5 — SRP respecté, 3 duplications mineures tolérables, nommage cohérent |
| Couverture tests | 14/17 IDs mini-DAT couverts correctement, 3 lacunes (1 Bloquante, 2 Majeures) |
| Sécurité (INV-SEC + STRIDE) | 5/5 INV-SEC implémentés, 5 CM STRIDE couvertes, 1 point Majeur OBS-03 |
| Documentation inline (JSDoc, traçabilité) | Très bonne — références croisées INV-*, CM-*, ARB-* dans les commentaires |
| Dépendances introduites | Aucune — conforme I-001 |
| CI (format + lint + build + test) | Verte — 239 tests OK |
| **Verdict comité** | **Validé avec commentaires** — 4 corrections bloquantes pré-merge |

---

## 13. Questions ouvertes (→ QUESTIONS.md)

Aucune. Toutes les divergences ont été tranchées par le comité, et tous les points non bloquants sont tracés en BACKLOG.md avec TACHE-076 à TACHE-084.

---

## 14. Décision demandée au Commanditaire

Le comité soumet au Commanditaire :

1. **Autoriser** l'application des 4 corrections pré-merge par le Développeur (OBS-03, C-01, MIN-03, SM-06/C-05) — périmètre strictement délimité, pas de modifications hors liste.
2. **Autoriser** l'ajout de 2 nouveaux risques R-M7-08 / R-M7-09 à `RISQUES.md` et le passage à **Résolu** des risques R-M7-06 (périmètre IDB) et R-M7-07.
3. **Autoriser** la création de 9 nouvelles tâches TACHE-076 à TACHE-084 dans `BACKLOG.md` pour couvrir les constats Majeurs et Mineurs non bloquants.
4. **Autoriser** le commit du code TACHE-061 corrigé sur une nouvelle branche courte `feature/p5-tache-061-heartbeat` (conformément à la règle I-007 Git flow strict adoptée 2026-04-16), suivie d'une PR vers `develop`.

---

*PV émis à l'issue du comité de revue code du 2026-04-16. Rédigé par l'Orchestrateur sur la base des avis individuels du Rapporteur (Développeur), de l'Architecte sécurité et du Testeur QA.*
