# Procès-verbal — Comité de sécurité pré-P2

**Projet :** Sentinel Nudge
**Date :** 2026-04-11
**Participants :** Architecte sécurité (Opus), DPO (Opus), Orchestrateur (Opus)
**Phase concernée :** P2 — Spécifications Fonctionnelles Détaillées

---

## 1. Ordre du jour

1. Analyse STRIDE des 7 modules v1
2. Identification et cotation des risques
3. Recommandations RGPD et bases légales
4. Décisions à intégrer dans le SFD

## 2. Analyse STRIDE

### Modules à risque élevé

**M7 (Hash mots de passe)** — Information Disclosure critique :
- SHA-256 sans sel = vulnérable aux attaques par dictionnaire si IndexedDB compromise
- **Décision D-SEC-001** : sel local obligatoire dérivé de crypto.getRandomValues, stocké avec la clé AES

**M17 (Clipboard)** — Information Disclosure modéré :
- Valeur collée transite en mémoire vive pendant le pattern matching
- **Décision D-SEC-002** : nullification variable en < 10ms, documenter la limitation

**M2 (Content scripts)** — Elevation of Privilege :
- Content scripts injectés dans le DOM = surface d'attaque XSS
- **Décision D-SEC-003** : interdiction innerHTML, utilisation exclusive de textContent et méthodes DOM sûres

### Architecture sans réseau

- Validation : l'exception M5 (`chrome.runtime.requestUpdateCheck()`) est acceptable — c'est le canal natif Chrome, pas un appel tiers
- Toutes les autres données embarquées (HSTS, corpus quiz, domaines typosquatting) = mises à jour via Chrome Web Store uniquement

## 3. Registre des risques

8 risques identifiés et cotés (cf. RISQUES.md) :
- 1 risque critique (R-008, score 9) : couche d'abstraction navigateur
- 2 risques élevés (R-001, R-007, score 8) : hash sans sel, conformité RGPD M7
- 3 risques modérés (R-002, R-004, R-005, score 6) : clipboard mémoire, XSS DOM, faux positifs
- 2 risques faibles acceptés (R-003, R-006, score 4) : clé AES dans profil Chrome, fatigue quota "Tous"

## 4. Recommandations RGPD

- M7 : consentement explicite obligatoire (opt-in onboarding étape 4)
- M2 : intérêt légitime (sécurité utilisateur), hash de domaine uniquement
- M3, M6, M9 : données non personnelles (scores agrégés, niveaux)
- M17 : pas de traitement au sens RGPD (mémoire vive uniquement, jamais stocké)
- **AIPD M7** : obligatoire, à produire en P3

## 5. Décisions

| ID | Décision | Impact |
|----|----------|--------|
| D-SEC-001 | SHA-256 avec sel local obligatoire pour M7 | SFD M7, architecture P3 |
| D-SEC-002 | Nullification clipboard < 10ms pour M17 | SFD M17, exigence perf |
| D-SEC-003 | Interdiction innerHTML dans les content scripts | SFD règles dev, revue code |
| D-SEC-004 | Risque R-003 accepté (clé AES dans chrome.storage.local) | Documentation |
| D-SEC-005 | AIPD M7 à produire en P3 | Backlog TACHE-008 |

## 6. Avis du comité

**Le comité de sécurité autorise le passage en P2** sous réserve de l'intégration des 5 décisions dans le SFD.

---

*PV produit par l'Orchestrateur — Fabrique — 2026-04-11*
