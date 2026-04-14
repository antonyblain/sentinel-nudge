# PV — Comité technique post-mortem M7 (Réutilisation mot de passe)

**Date** : 2026-04-14
**Phase** : P4' — Fin d'intégration design system + fiabilisation modules asynchrones
**Objet** : Post-mortem de la saga de mise au point du module M7 (détection réutilisation inter-domaines), atelier PDCA consolidé, revue des cas d'usage non couverts.
**Participants convoqués** : Développeur, Architecte logiciel, Architecte sécurité, Testeur QA.
**Présidence** : Orchestrateur.
**Référent qualité** : validation post-rédaction.

---

## 1. Chronologie des incidents (7 commits correctifs consécutifs)

| Id | Incident | Impact fonctionnel | Impact sécurité | Fix |
|----|----------|--------------------|-----------------|-----|
| P-014 | Custom Elements KO en MV3 isolated world | Composants UI non rendus | Aucun | Construction DOM + Shadow DOM direct |
| P-015 | Format:check Prettier échoue en CI à répétition | 10+ échecs CI | Aucun | Checklist pré-commit `format:check && lint && build && test` |
| P-016 | `encryption_key_material` absent → `registerModuleHandlers` non appelé → `handler_not_registered` silencieux | M7 muet | **Majeur** : extension apparaît saine mais ne protège plus | Auto-régénération clé AES au boot SW + logs structurés sur silent fails |
| P-017 | Inputs password hors `<form>` (React SPA, WordPress moderne, AJAX-only) non détectés | Faux négatifs sur ~30% des sites modernes | Majeur : M7 inefficace sur pattern courant | 3 stratégies de détection : submit form, keydown Enter, click bouton submit proche (heuristique texte) |
| P-018 | ArrayBuffer clé AES non sérialisé par `chrome.storage.local` → régénération à chaque boot → hashes précédents indéchiffrables | Faux `no_reuse` systématique entre sessions SW | **Critique** : détection réellement inopérante inter-sessions | Conversion `Array<number>` + tolérance format legacy |
| P-019 | Herokuapp redirige `/authenticate` → `/login` avant que l'utilisateur voie le toast | Alerte non vue | Majeur : signal utilisateur perdu | Pattern `pending_m7_toast` en `chrome.storage.local` + listener `storage.onChanged` + conservation jusqu'à action utilisateur ou TTL 10 min |
| P-020 | M7 suivait le quota 3 nudges/jour global | Alertes sécurité bloquées dès 3 interactions éducatives | Majeur : dette de conception sur la distinction nudge éducatif / alerte sécurité | Promotion M7 dans `CRITICAL_MODULES` (bypass quota, rate-limit propre : cooldown 30j + suppression_list) |

---

## 2. Synthèse convergente des quatre profils techniques

Les quatre contributions convergent sur **trois causes racines majeures** :

### CR-1 — Absence de contrat de démarrage vérifiable pour le Service Worker

Diagnostiqué par **Développeur** (CR-1), **Architecte logiciel** (§2 « angles morts »), **Architecte sécurité** (§3 « silent fails inacceptables »).

Le SW s'initialise de façon optimiste : il suppose que la clé AES, le salt et la config sont présents et valides. Aucun invariant n'est vérifié au boot. Résultat : toute corruption ou absence devient une défaillance silencieuse. P-016 et P-018 en découlent directement. **Fail silent = fail open** en sécurité (Architecte sécurité) — inacceptable.

### CR-2 — Hypothèses de modèle de page trop restrictives

Diagnostiqué par **Développeur** (P-017 comme « hypothèse form submit »), **Architecte logiciel** (§2 « angles morts »).

La spécification de détection M7/M9 s'appuyait sur le modèle HTML classique `<form><input type="password"></form>`. Le web moderne (React, Vue, WordPress headless, AJAX-only) rompt ce contrat. Les cas non-nominaux auraient dû être contractualisés dans le STD.

### CR-3 — Pyramide de tests trop plate à la base

Diagnostiqué par **Testeur QA** (§1) et relayé par les 3 autres profils. 200 tests verts n'ont rien protégé parce que :

- Mocks `chrome.*` trop accommodants (acceptent des types que Chrome refuse silencieusement)
- Injection directe dans les handlers contournant le flux de boot
- Niveau de simulation trop haut dans la pile (pas de chaîne content-script → DOM → SW)
- Pas de tests de composition d'états (cooldown + quota + pending_toast interagissent)

**Seule la recette manuelle a détecté les bugs.** Ce constat est grave pour un projet de niveau Exposé.

---

## 3. Atelier PDCA consolidé

### PLAN — Ce qu'on voulait

Module M7 détectant la réutilisation de mot de passe inter-domaines, avec hashes chiffrés AES-256-GCM, rate-limité (cooldown 30j), affichant un toast non intrusif.

### DO — Ce qui a été fait

Implémentation P4 nominale. Tests unitaires 15 cas M7, tous verts. Build + CI verts. Comité revue code P4' passé.

### CHECK — Ce qui s'est révélé à la recette manuelle

- M7 silencieux sur 3/3 sites de test (P-016 cause racine, P-018 cause aggravante)
- Fallback orphelin absent → 1/3 sites (practicetestautomation) KO initialement (P-017)
- Toast éphémère → 1/3 sites (herokuapp) KO après P-016 résolu
- Quota_exceeded bloquant dès 4 interactions éducatives (M3/M6) dans la journée

### ACT — Règles permanentes à intégrer (par destination)

| Destination | Règle |
|-------------|-------|
| **LESSONS_LEARNED.md** | Mocks `chrome.*` doivent refuser ce que Chrome refuse (serialization JSON, quota, types non-sérialisables). |
| **LESSONS_LEARNED.md** | Tout silent fail dans un handler ou détecteur MV3 doit être doublé d'un `console.warn` structuré JSON. |
| **LESSONS_LEARNED.md** | Les prérequis d'init critique (clé AES) doivent avoir une stratégie de fallback/auto-récupération au boot SW. |
| **LESSONS_LEARNED.md** | La détection de soumission web = 3 stratégies minimum (submit + Enter + click bouton submit en capture phase). |
| **LESSONS_LEARNED.md** | Pattern pending-intent : toute action traversant une frontière de cycle de vie (SW dormance, redirect, réinjection CS) doit être persistée en storage avec TTL, consommée à la destination. |
| **TECH_STACK.md** | Ajout : *Conversion obligatoire ArrayBuffer → Array<number> avant `chrome.storage.local.set`*. Types interdits : `ArrayBuffer`, `Uint8Array`, `Blob`, `Date`, `Map`, `Set`, `CryptoKey`. |
| **OUTILS.md** | Protocole de recette manuelle formalisé : pré-conditions documentées, fiche Given/When/Then par scénario, PV daté par session, critères P0/P1/P2 définis *avant* exécution. |
| **CLAUDE.md** (gouvernance) | La recette manuelle produit un PV versionné — c'est une ligne de défense au même titre que le CI. |

---

## 4. Revue des cas d'usage M7 non couverts (priorité **critique**)

Les tests manuels ont couvert 3 sites représentatifs. **Plusieurs cas d'usage fréquents ne sont ni testés ni garantis**. Classement par priorité d'impact.

### 4.1 — Cas d'usage à risque sécurité élevé (P0 pour v1)

| # | Cas d'usage | Statut actuel | Risque | Recommandation |
|---|-------------|---------------|--------|----------------|
| UC-01 | **Login multi-étape** (email sur page 1, password sur page 2) — Google, Microsoft, Okta | Non testé | Majeur — domaine de l'email ≠ domaine de la page password sur certains flows SSO. Risque de hash mal rattaché. | Tester sur Google. Documenter le comportement attendu : on attache le hash au `location.hostname` de la page submit password. |
| UC-02 | **Gestionnaires de mots de passe qui auto-remplissent et auto-submittent** (Dashlane observé en logs, 1Password, Bitwarden, LastPass, Chrome Password Manager) | Non testé | Majeur — le PM peut intercepter le submit avant notre event capture. Ou le déclencher sans interaction utilisateur → toast inapproprié. | Tester avec Bitwarden (gratuit, open-source). Vérifier si `event.isTrusted=false` suffit à filtrer. |
| UC-03 | **Iframe same-origin avec form login** (ex: widgets de connexion) | Non testé | Moyen — le content script est injecté dans le top frame, pas l'iframe. | Ajouter `"all_frames": true` dans le manifest pour les content scripts, ou documenter la limite. |
| UC-04 | **Iframe cross-origin** (ex: SSO en iframe, payment portals) | Non testé | Faible (hors scope légal MV3 standard) | Documenter la limite explicite. |
| UC-05 | **Password affiché en clair** (toggle show/hide → `type="text"`) | Non testé | Moyen — notre détecteur filtre `type="password"`. Si l'utilisateur clique « afficher », le type change et la détection est perdue. | Écouter le changement de `type` via `MutationObserver` ou conserver la référence au champ indépendamment du type courant. |
| UC-06 | **Inputs ajoutés dynamiquement après boot** (React/Vue render, modales ouvertes à la demande) | Partiellement (listener capture sur document) | Moyen | Validé en théorie par le listener en capture phase sur `document`, mais jamais testé explicitement. Ajouter un scénario de recette. |

### 4.2 — Cas d'usage à risque fonctionnel (P1)

| # | Cas d'usage | Statut | Risque | Recommandation |
|---|-------------|--------|--------|----------------|
| UC-07 | **Page de changement de mot de passe** (ancien + nouveau + confirmation, 3 champs password) | Non testé | Déclenchements multiples de M7 sur la même soumission | Filtrer via `autocomplete="new-password"` vs `current-password` ; ignorer `new-password`. |
| UC-08 | **Signup** (inscription) avec `autocomplete="new-password"` | Non testé | Faux positif — alerte M7 alors que l'utilisateur crée un compte | Même filtrage via `autocomplete`. |
| UC-09 | **Multi-onglets simultanés**, même password sur 2 onglets différents | Non testé | Possible doublon de toast / race condition sur `pending_m7_toast` | Ajouter un identifiant d'onglet dans la clé pending, ou accepter le doublon (faible fréquence). |
| UC-10 | **Login échoué puis retry** (même submit 2× rapidement) | Non testé | Possible doublon pending_m7_toast écrasé | Le flag `m7ToastShownForDomain` protège intra-page. Inter-page (après redirect erreur), un nouveau pending écrase le précédent — acceptable. |
| UC-11 | **Sites avec CSP strict bloquant l'injection content-script** | Non testé | Aucun (Chrome injecte avant CSP) mais certains CSP bloquent le Shadow DOM | Documenter la limite en cas de retour négatif en production. |
| UC-12 | **Passkeys / WebAuthn** (connexions sans mot de passe) | Hors scope | Aucun | M7 ne s'applique pas — documenter. |

### 4.3 — Cas d'usage édge (P2)

| # | Cas d'usage | Recommandation |
|---|-------------|----------------|
| UC-13 | Password field dans un web component / shadow DOM de l'app | Écouter `document` en capture suffit *sauf* si le site utilise `mode: 'closed'`. Documenter la limite. |
| UC-14 | PWA / TWA (Trusted Web Activities) | Hors scope extension Chrome standard. |
| UC-15 | Reset password par email (token dans URL) | Pas de password submit → M7 inactif (normal). |

---

## 5. Décisions du comité

### D-PM-01 — Adopter les patterns défensifs généralisés (Architecte logiciel §3)

Deux patterns à extraire de M7 et documenter en **ADR génériques** applicables à tous les modules :
- **ADR `SW-BOOT-CONTRACT`** — tout handler avec prérequis storage implémente boot : lire → valider → régénérer/migrer → logger.
- **ADR `CROSS-LIFECYCLE-INTENT`** — toute action traversant dormance/redirect/réinjection est persistée en storage avec TTL avant exécution.

Audit de M2, M3, M5, M6, M9, M17 au regard de ces deux patterns → **TACHE-058** (P5).

### D-PM-02 — Ajouter des tests d'intégration SW + storage avant clôture P5 (Testeur QA §2)

Les 12 scénarios `TC-M7-01` à `TC-M7-12` listés en §3 de la contribution QA deviennent des tests obligatoires avant release v1. **TACHE-059** (P5/P6).

### D-PM-03 — Renforcer les mocks `chrome.storage.local` (Testeur QA §4)

Wrapper de mock qui applique `JSON.parse(JSON.stringify(...))` avant tout `set()` et rejette les types non-conformes avec le même code d'erreur que Chrome. **TACHE-060** (P5).

### D-PM-04 — Ajouter la surveillance d'état dégradé (Architecte sécurité §3)

- Heartbeat M7 dans `chrome.storage.local` clé `diagnostics.m7`
- Badge popup si `m7_ready = false` depuis > 1h
- Canary hash au boot SW pour distinguer absence vs corruption
- Registre d'incidents locaux (IndexedDB circulaire 50 entrées)

**TACHE-061** (P5 — composants internes) et **TACHE-062** (P5 — affichage popup).

### D-PM-05 — Couvrir les cas d'usage P0 avant v1 (§4.1)

UC-01 à UC-06 sont **bloquants pour la v1**. Ajouter à la recette manuelle formalisée + tests E2E Playwright. **TACHE-063** (P5) — protocole de recette manuelle enrichi.

### D-PM-06 — Filtrage `autocomplete` (§4.2, UC-07/UC-08)

Ignorer les champs password avec `autocomplete="new-password"` dans M7. Règle documentée + test unitaire. **TACHE-064** (P5 — faible effort, haute valeur).

### D-PM-07 — Registre des risques à mettre à jour

Ajouter dans `RISQUES.md` :
- **R-M7-03** — Toast éphémère absorbé par redirect (résiduel post-fix : acceptable, couvert par pending_toast)
- **R-M7-04** — Régénération intempestive de clé AES → cécité temporaire de M7

**TACHE-065** (P5).

---

## 6. Score de maturité post-incident

| Dimension | Avant fixes | Après fixes | Cible v1 |
|-----------|-------------|-------------|----------|
| Résilience cycle de vie SW | 2/5 | 4/5 | 5/5 avec ADR SW-BOOT-CONTRACT |
| Robustesse storage | 1/5 | 4/5 | 5/5 avec versioning schéma |
| Couverture patterns soumission | 2/5 | 4/5 | 5/5 avec UC-01 à UC-06 couverts |
| Conformité MV3 isolated world | 2/5 | 4/5 | 5/5 avec ADR MV3-CONSTRAINTS |
| Documentation architecturale | 2/5 | 2/5 | 4/5 avec ADR produits |
| Fiabilité du signal sécurité | 2/5 | 3/5 | 5/5 avec heartbeat + canary |
| Couverture tests automatisés | 3/5 | 3/5 | 4/5 avec TC-M7-01 à 12 + E2E Playwright |

**Global : 2.0/5 → 3.4/5 → cible 4.7/5 en fin P5.**

---

## 7. Actions consolidées (ajouts BACKLOG)

| ID | Titre | Priorité | Phase | Responsable |
|----|-------|----------|-------|-------------|
| TACHE-058 | Rédiger ADR `SW-BOOT-CONTRACT` et `CROSS-LIFECYCLE-INTENT` + audit modules M2/M3/M5/M6/M9/M17 | Must | P5 | Architecte logiciel |
| TACHE-059 | Implémenter 12 scénarios `TC-M7-01` à `TC-M7-12` (tests unitaires + intégration) | Must | P5 | Testeur QA |
| TACHE-060 | Wrapper mock `chrome.storage.local` JSON-strict + quota | Must | P5 | Testeur QA + Développeur |
| TACHE-061 | Heartbeat M7 + canary hash + registre incidents locaux | Must | P5 | Développeur + Architecte sécurité |
| TACHE-062 | Badge popup "dégradé" si diagnostics.m7.ready=false >1h | Should | P5 | Développeur + Expert UX/UI |
| TACHE-063 | Protocole recette manuelle formalisé (Given/When/Then, PV, P0/P1/P2) + scénarios UC-01 à UC-06 | Must | P5 | Testeur QA |
| TACHE-064 | Filtrage `autocomplete="new-password"` dans M7 | Should | P5 | Développeur |
| TACHE-065 | Ajouter R-M7-03 et R-M7-04 dans RISQUES.md | Should | P5 | Architecte sécurité |
| TACHE-066 | Étendre content scripts `"all_frames": true` pour iframes same-origin (UC-03) | Should | P5 | Développeur + Architecte sécurité (revue impact surface d'attaque) |
| TACHE-067 | MutationObserver sur changements `type` de champs password (UC-05 — toggle show/hide) | Could | P5 | Développeur |

---

## 8. Conclusion

La saga M7 révèle un écart structurel entre tests unitaires verts et comportement réel en extension MV3. Les correctifs appliqués (P-016/P-017/P-018, pending_toast, M7 critique) sont robustes — le score de maturité passe de 2.0/5 à 3.4/5. Mais la dette est désormais **documentaire et architecturale** : les patterns défensifs doivent devenir des ADR référençables, pas des implémentations locales.

**La recette manuelle a été la seule ligne de défense efficace.** Ce n'est pas acceptable pour un projet niveau Exposé en cible v1. L'effort P5 doit prioriser (a) la remontée d'état dégradé au user, (b) des tests d'intégration MV3 réalistes, (c) un protocole de recette formalisé.

**Clôture du post-mortem : prononcée.** Les 10 tâches TACHE-058 à TACHE-067 ont été créées dans BACKLOG.md (vérifié). Les incidents P-019 (toast éphémère) et P-020 (quota bloquant alerte sécurité) ont été ajoutés dans PROBLEMES.md avec règles permanentes. Décision résiduelle : **arbitrage Commanditaire attendu** sur le statut bloquant des UC-01 à UC-06 pour la v1 (livraison v1 complète avec ces 6 cas d'usage couverts, ou livraison v1 partielle avec les cas différés en v1.1).

---

*Document produit par l'Orchestrateur sur base des contributions des 4 profils techniques convoqués. Validation Référent qualité à venir.*
