# Revue Architecte logiciel — Sentinel Nudge
**Date :** 2026-04-19  
**Auteur :** Architecte logiciel (Fabrique)  
**Phase active :** P5 — Fiabilisation M7 + couverture UC P0 v1  
**Base de revue :** branche develop, commit 5187a41

---

## 1. Bilan général

L'architecture de Sentinel Nudge est saine et cohérente dans ses grandes lignes. Le DAT v1.4, les deux ADR et les trois mini-DAT forment un corpus documentaire solide qui a guidé l'implémentation de façon fidèle. Les points forts principaux sont : la rigueur du contrat de boot (ADR-001 effectivement implémenté sur M2/M5/M6 après les tâches 085/087/088), la profondeur de la section §17 sur le cloisonnement FNV-1a vs SHA-256, et la cohérence entre les mini-DAT UC-01/UC-03 et le code réel du password-detector.

Trois gaps résiduels méritent attention avant la release v1 : (a) la divergence Annexe B du DAT v1.4 par rapport au manifest réel (WAR vide vs WAR peuplé), qui indique un manque de synchronisation lors du merge T-028 ; (b) l'état partiel du pattern pending-intent sur M5/M6/M17 (ADR-002 non remédié sur ces modules) ; (c) l'absence de `diagnostics.m9` et `diagnostics.m17` en mode proactif (résolu en mode réactif uniquement, TACHE-089 toujours ouverte).

---

## 2. Périmètre couvert par la revue

| Livrable | Fichier | Statut lecture |
|---------|---------|---------------|
| DAT v1.4 | `docs/p3-architecture/p3-dat-v1.4.md` | Lu intégralement par blocs |
| ADR-001 SW-BOOT-CONTRACT | `docs/adr/adr-001-sw-boot-contract.md` | Lu intégralement |
| ADR-002 CROSS-LIFECYCLE-INTENT | `docs/adr/adr-002-cross-lifecycle-intent.md` | Lu intégralement |
| Audit ADR-compliance v1.0 | `docs/p4-conception/p5-audit-modules-adr-compliance-v1.0.md` | Lu intégralement |
| Mini-DAT TACHE-061 v1.1 | `docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md` | Lu partiellement (intro + architecture) |
| Mini-DAT TACHE-068 v1.1 | `docs/p4-conception/p5-minidat-tache-068-uc01-login-multi-etape-v1.1.md` | Lu partiellement (intro + cas) |
| Mini-DAT TACHE-070 v1.0 | `docs/p4-conception/p5-minidat-tache-070-uc03-iframes-v1.0.md` | Lu partiellement (intro + analyse) |
| Contexte | SESSION.md, BACKLOG.md, TECH_STACK.md, RISQUES.md, PROBLEMES.md | Lu |
| Code | package.json, vite.config.ts, src/manifest.json, src/shared/utils/hash.ts | Lu intégralement |
| Code | src/shared/constants/modules.ts (via Grep) | Lu |
| Code | src/background/handlers/* (via Grep ciblé) | Sondé |
| Code | src/background/service-worker.ts, services/m2/m5/m6-boot-service.ts (via Grep) | Sondé |
| CI | .github/workflows/ci.yml, release.yml (node-version) | Sondé |

---

## 3. Points manquants ou non couverts

### 3.1 Mini-DAT TACHE-062 (badge dégradé) — non produit

Le badge dégradé (TACHE-062) est le consommateur naturel des `diagnostics.<module>` publiés par ADR-001. Son mini-DAT n'a pas été produit à ce stade. Ce n'est pas un blocant release v1, mais son absence laisse la mécanique de surveillance ouverte côté UX (les diagnostics sont publiés, personne ne les lit depuis la popup pour le moment).

### 3.2 ADR-003 à ADR-007 — ADR "intra-DAT" non externalisés

Les décisions ADR-003 (Vanilla TS + Shadow DOM), ADR-004 (SubtleCrypto), ADR-005 (Vitest + Playwright), ADR-006 (accès direct M2 à chrome.storage.local), ADR-007 (ENF → décisions) et ADR-008 (Browser Adapter) sont intégrées dans le corps du DAT (§4.2 et §7) mais n'existent pas en fichiers `docs/adr/adr-00X-*.md` autonomes, contrairement à ADR-001 et ADR-002. Cette asymétrie est une dette de capitalisation. Elle ne cause pas de problème opérationnel car les décisions sont traçables dans le DAT, mais l'outillage d'audit (Grep sur `docs/adr/`) ne les remonte pas.

### 3.3 E-CLI-01 (timestamp vs expires_at M7) — TACHE-091 toujours ouverte

L'exception transitoire E-CLI-01 sur la forme `timestamp` vs `expires_at` dans `pending_m7_toast` est documentée dans ADR-002 et tracée en TACHE-091. Elle reste ouverte. Aucun nouveau module n'a (à tort) adopté cette forme, ce qui respecte l'interdiction. Le risque est minime mais la dette doit être soldée avant la release publique.

---

## 4. Cohérence cross-livrables

### 4.1 DAT §17 (FNV-1a vs SHA-256) — cohérent avec hash.ts

La section §17 du DAT v1.4 est précise et exacte. Le code de `src/shared/utils/hash.ts` correspond pixel-pour-pixel aux extraits documentés : la fonction `sha256Hex()` teste `crypto.subtle` et bascule sur `fallbackHash()` (FNV-1a) si absent. Le tableau §17.4 des sites d'usage a été établi sur le commit 5187a41 — il est exact au regard du Grep sur `password-detector.ts`. Le cloisonnement conceptuel (FNV-1a = déduplication session non persistée, SHA-256 = canal cryptographique persistant) est respecté dans le code.

Un point fin : la section §17.3 décrit le schéma `SHA-256(installation_salt || domain)` mais le JSDoc de `hashDomain()` dans `hash.ts` dit `sha256Hex(salt + domain)` — même sémantique, notation différente. Pas d'incohérence fonctionnelle.

### 4.2 ADR-001 — application réelle dans les modules

L'audit v1.0 constatait 3 écarts sur M2/M3/M5/M6 et 1 sur M9/M17. La situation a évolué depuis : les tâches 085, 087, 088 ont produit des `initBootM2()`, `initBootM5()`, `initBootM6()` effectivement appelés dans la boot IIFE de `service-worker.ts` (confirmé par Grep aux lignes 374/379/384 et 755-769). Les `diagnostics.m2`, `.m5`, `.m6` sont publiés conformément à R-BOOT-04. M3 a un `readM3Diagnostics()` mis à jour lors de l'alarme score, ce qui est la variante documentée dans `m3-boot-service.ts` (M3 est read-only, pas d'initBoot() au boot SW — décision tracée dans les JSDoc).

Points résiduels confirmés par le Grep sur le code réel :
- `diagnostics.m9` et `diagnostics.m17` sont mis à jour de façon réactive (lors d'un traitement) mais pas au boot SW — ce comportement est documenté dans les JSDoc comme "Option B" (TACHE-089 toujours ouverte). Les handlers M9/M17 sont correctement qualifiés "read-only sans prérequis storage propre" dans le code, ce qui les exempte de R-BOOT-01 à R-BOOT-03, mais R-BOOT-04 reste attendu au boot.

### 4.3 ADR-002 — application réelle dans les modules

M7 : conforme (sauf E-CLI-01, exception documentée). M2/M3/M9 : N/A justifié. M5 et M6 : le pattern pending-intent reste absent — confirmé par l'absence de grep sur `pending_m5_` ou `pending_m6_quiz` dans les handlers (le `m6_quiz_deferred` existant ne respecte pas R-CLI-01 à R-CLI-03). M17 : pas de pending-intent. Ces gaps sont traçables en TACHE-090 (M17) et à planifier pour M5/M6.

### 4.4 Mini-DAT TACHE-061 (heartbeat M7) — cohérent avec IncidentService et HeartbeatService

Les références du mini-DAT v1.1 aux lignes de `service-worker.ts` (376-547), `heartbeat-service.ts` (99-131), `m7-handler.ts` (253-254, 304-308) ont été vérifiées par la revue de code du comité (PV gouvernance-pv-revue-code-tache-061-v1.0.md, validé). Le modèle des 3 mécanismes (heartbeat, canary, registre incidents) est en place. La `IncidentService` avec purge FIFO prioritaire (R-M7-07 résolu) est opérationnelle.

### 4.5 Mini-DAT TACHE-068 (UC-01 login multi-étape) — cohérent

Le mini-DAT v1.1 documente précisément les 3 cas (Google SPA, Microsoft cross-domain, Okta hors v1) et l'invariant architectural : le `domain_hash` est calculé sur `location.hostname` au Step 2, ce qui est cohérent avec le code de `password-detector.ts` (ligne 1229 citée). Les arbitrages ARB-068-01/02/03 (tous Option A) sont tracés. L'analyse de la matrice providers est complète. Aucun écart code/document détecté sur la logique de hachage.

### 4.6 Mini-DAT TACHE-070 (UC-03 iframes same-origin) — cohérent

Le mini-DAT v1.0 conclut correctement que `all_frames: true` dans le manifest est la solution technique. Le manifest réel (`src/manifest.json`) déclare bien `"all_frames": true` dans la section `content_scripts`. L'analyse des variables module-level (scope isolé par instance) est exacte et bien documentée.

### 4.7 CRITICAL_MODULES — DAT vs code

Le DAT §5 (structure du projet) mentionne `CRITICAL_MODULES = ['M2','M17']` dans le commentaire du fichier `constants/modules.ts`. Or, le code réel contient `CRITICAL_MODULES = ['M2', 'M7', 'M17']` — M7 a été ajouté lors de P-020 (post-mortem M7, décision de bypass quota). Cette divergence entre le commentaire de structure du DAT et le code est mineure (M7 est bien listé dans la décision D-PM et dans PROBLEMES.md), mais le DAT §5 devrait être mis à jour lors de la prochaine révision (v1.5) pour refléter les 3 modules critiques.

### 4.8 T-028 (WAR resserré) — gap en Annexe B du DAT v1.4

La tâche T-028 a resserré les `web_accessible_resources` du manifest. Le manifest source réel (`src/manifest.json`) contient une section WAR peuplée avec 3 entrées (dashboard.html, onboarding.html, `pages/static/*.html`) et `"matches": ["<all_urls>"]`. L'Annexe B du DAT v1.4 montre en revanche `"web_accessible_resources": []` (vide). C'est un gap de synchronisation : l'Annexe B n'a pas été mise à jour lors du merge de T-028. Le corps du DAT §6.2 (flux de données) et la section §10.3 (lazy loading) restent cohérents avec le fonctionnement réel, mais l'Annexe B est trompeuse pour un auditeur. Ce point doit être corrigé en DAT v1.5.

---

## 5. Conformité aux standards d'architecture

### 5.1 Stack technique (package.json vs DAT Annexe A)

La comparaison ligne à ligne est exacte. Toutes les versions du DAT Annexe A correspondent aux versions figées dans `package.json` :

| Package | DAT Annexe A | package.json | Résultat |
|---------|-------------|--------------|---------|
| vite | ^5.2.0 | ^5.2.0 | OK |
| vite-plugin-web-extension | ^4.5.0 | ^4.5.0 | OK |
| vitest | ^2.0.0 | ^2.0.0 | OK |
| @playwright/test | ^1.44.0 | ^1.44.0 | OK |
| @axe-core/playwright | ^4.9.0 | ^4.9.0 | OK |
| eslint | ^9.0.0 | ^9.0.0 | OK |
| @typescript-eslint/* | ^8.0.0 | ^8.0.0 | OK |
| jsdom | ^29.0.0 | ^29.0.2 | OK (patch) |
| @zxcvbn-ts/core | ^3.0.4 | ^3.0.4 | OK |

Aucune dérive détectée. Les corrections P-005 à P-013 (versions npm, ESLint flat config) sont bien intégrées dans le DAT et le code.

### 5.2 Node 24 LTS — alignement engines/CI

`package.json` déclare `"engines": { "node": ">=24" }`. Les workflows CI (`ci.yml`, `release.yml`) utilisent `node-version: 24`. L'alignement est parfait. Aucune dérive.

### 5.3 ESLint flat config v9

Confirmé : `eslint.config.js` (flat config ESM) est utilisé, cohérent avec P-007 et la TECH_STACK. La règle D-SEC-003 (no-restricted-properties sur innerHTML/outerHTML/insertAdjacentHTML/document.write) est documentée dans le DAT §9.3 et doit être présente dans le fichier de config.

### 5.4 Vite config — cohérence avec le DAT

La `vite.config.ts` implémente exactement ce que le DAT ADR-002 décrit : `root: resolve(__dirname, 'src')`, `additionalInputs` pour dashboard et onboarding (non référençables en propriétés standard MV3), `outDir` en chemin absolu, cible `es2022`. Les exclusions de couverture (service-worker.ts, pages UI DOM-heavy) sont documentées avec justification dans le fichier lui-même.

### 5.5 Modèle C4 — couverture

Les niveaux C4-1 (contexte) et C4-2 (conteneurs) sont documentés avec des diagrammes Mermaid dans le DAT §2.2 et §3.2. Le niveau C4-3 (composants) est présent en §6.1. Le niveau C4-4 (code) n'est pas formalisé — ce qui est standard pour ce type de projet et conforme aux préconisations C4 (le niveau code est optionnel). Aucun gap.

---

## 6. Risques architecturaux résiduels

### 6.1 Gap WAR Annexe B (documentation, non-bloquant release)

L'Annexe B du DAT montre `web_accessible_resources: []`, le manifest réel a 3 ressources peuplées. Risque : un auditeur externe ou un contributeur se basant sur le DAT pour comprendre la surface d'exposition de l'extension aurait une vision incorrecte. Sévérité : faible (le manifest source fait foi, l'Annexe B est indicative). Action : corriger en DAT v1.5 lors de la prochaine modification structurelle.

### 6.2 Pending-intent M5/M6/M17 (dette architecturale, non-bloquant release v1)

L'ADR-002 est partiellement appliqué. M5 et M6 peuvent perdre leur toast si le SW est tué ou si l'onglet navigue entre le calcul et l'envoi. M17 peut perdre son toast lors d'un coller suivi d'un redirect rapide. Ces cas sont rares (M5 est périodique, M6 est déclenché sur alarme) et ne constituent pas un risque sécurité direct (pas de bypass de contrôle). Ils constituent une dette ADR-002 tracée dans l'audit v1.0 et les RISQUES.md (R-ADR-02 résolu côté boot, mais le volet ADR-002 M5/M6/M17 reste ouvert). Priorité : Should avant release publique pour M5 et M6, Could pour M17.

### 6.3 CRITICAL_MODULES commentaire DAT §5 obsolète (cosmétique)

Le commentaire de structure dans le DAT indique `['M2','M17']` mais le code contient `['M2','M7','M17']`. Aucun impact sur le comportement. Correction à intégrer en DAT v1.5.

### 6.4 ADR-003 à ADR-008 non externalisés (dette de capitalisation)

Les décisions TypeScript, SubtleCrypto, Vitest, M2 storage direct, ENF→décisions et Browser Adapter sont dans le DAT mais pas dans des fichiers `docs/adr/` autonomes. Cela freine la réutilisation inter-projets et l'audit outillé par pattern. Non bloquant v1, mais à traiter lors de la clôture de phase.

### 6.5 TACHE-062 (badge dégradé) — consommateur des diagnostics manquant

Les `diagnostics.<module>` sont publiés (M2/M5/M6/M7, et en réactif pour M9/M17). Le badge dégradé prévu pour la popup (TACHE-062) n'est pas encore implémenté. Sans ce consommateur, la valeur des diagnostics est limitée aux DevTools. Ce gap a une incidence sur l'expérience utilisateur (l'utilisateur ne voit pas un indicateur visuel en cas de module défaillant). Non bloquant release v1 si la popup affiche l'état nominal par défaut.

---

## 7. Recommandations

### R-ARCH-01 — DAT v1.5 : corriger Annexe B (WAR)
Mettre l'Annexe B en conformité avec le manifest réel (3 entrées WAR). Inclure aussi la correction du commentaire `CRITICAL_MODULES` dans §5. Cette révision peut être groupée avec le prochain ajout structurel (ex. TACHE-062 badge dégradé) pour éviter une version mineure dédiée uniquement cosmétique.

### R-ARCH-02 — Externaliser ADR-003 à ADR-008 dans docs/adr/
Produire 6 fichiers `adr-003-*.md` à `adr-008-*.md` reprenant les décisions du DAT §4.2 et §7. Format identique à ADR-001/002. Capitaliser dans TECH_STACK.md. Ce travail est outillable (copier-coller structuré depuis le DAT) et peut être délégué à un agent en background.

### R-ARCH-03 — Solder TACHE-091 (E-CLI-01) avant release publique
La forme `timestamp` vs `expires_at` dans `pending_m7_toast` est une exception documentée. La mettre en conformité avec R-CLI-03 avant la mise en ligne publique pour éviter qu'un contributeur n'identifie une incohérence entre le code M7 et les règles ADR-002.

### R-ARCH-04 — Produire mini-DAT TACHE-062 (badge dégradé) en P5
Ce livrable complète la mécanique de surveillance initiée par ADR-001. Sans mini-DAT, l'implémentation risque de dériver des invariants R-BOOT-04 (les champs diagnostics.m2/m5/m6/m7 doivent être interprétés de façon homogène par le badge). Un mini-DAT de 1 page suffit à cadrer l'interface et les seuils d'alerte.

### R-ARCH-05 — Planifier pending-intent M5 et M6 avant release
Les tâches correspondantes (TACHE-087/088 pour le boot, mais pas pour le pending-intent) doivent être créées ou étendues. M5 est le cas le plus simple (un seul intent `pending_m5_update_toast`). M6 requiert une migration de `m6_quiz_deferred` vers la convention R-CLI-01 à R-CLI-04. Priorité Should.
