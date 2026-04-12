# Procès-Verbal du Comité de Revue de Code — Sentinel Nudge

## En-tête

| Champ | Valeur |
|-------|--------|
| **Instance** | Comité de revue de code |
| **Date** | 2026-04-12 |
| **Phase** | P4 — Développement |
| **Périmètre** | Code source complet (src/, tests/) |
| **Version PV** | 1.0 |
| **Rapporteur** | Développeur |

## Participants

| Rôle | Présent | Note |
|------|---------|------|
| Développeur (rapporteur) | Oui | 3/5 |
| Architecte sécurité | Oui | 4/5 |
| Testeur QA | Oui | 3/5 |
| DPO | Oui | 4.9/5 |
| Expert accessibilité | Oui | 3.5/5 |
| Expert UX/UI | Oui | 4/5 |

**Moyenne de satisfaction : 3.7/5**

---

## Synthèse des travaux

Le code P4 comprend 62+ fichiers TypeScript (socle + 7 modules + 4 pages UI + tests), 200 tests unitaires, un build Vite fonctionnel et une CI GitHub Actions verte. L'ensemble des 7 modules v1 est implémenté.

**Points forts unanimes :**
- D-SEC-003 strictement respecté (0 innerHTML dans tout le code source)
- Chiffrement AES-256-GCM correctement implémenté (SubtleCrypto natif)
- Privacy by design exemplaire (ENF-PBD-01 à 09 tous conformes)
- Consentement M7 granulaire et non pré-coché
- Hash salé SHA-256 avec nullification dans `finally`
- CSP stricte (connect-src 'none', script-src 'self')
- Aucune vulnérabilité npm en production (0 CVE sur deps prod)

**Points faibles identifiés :**
- ADR-008 (BrowserAdapter) violée (17 appels chrome.* directs)
- Couverture de tests à 22% (cible 80%)
- Accessibilité : trapFocus sur toasts non-modaux (piège clavier)
- i18n non intégré dans les composants content-scripts (strings en dur)
- Pages statiques d'explication absentes
- Corpus quiz incomplet (20/50+)

---

## Constats classifiés

### Bloquants (6)

| ID | Constat | Correction requise |
|----|---------|-------------------|
| B-001 | `src/coverage/` pollue ESLint, lint cassé | Ajouter `coverage/` au .gitignore, déplacer hors `src/` |
| B-002 | Double listener `alarms.onAlarm` dans service-worker.ts | Fusionner dans un seul listener |
| ACC-01 | `trapFocus()` appelé sur toasts non-modaux M5/M7/M17 (WCAG 2.1.2) | Supprimer `trapFocus` des 3 toasts |
| ACC-02 | `type="button"` manquant sur boutons toast-m7 | Ajouter l'attribut |
| ACC-03 | Double `<main>` dans popup.ts | Remplacer par `<div>` |
| ACC-04 | Double `role="img"` dans dashboard.ts (wrapper + SVG) | Retirer du wrapper |

### Majeurs (13)

| ID | Constat |
|----|---------|
| M-001 | ADR-008 violée : 17 appels chrome.* directs. Ajouter tabs.create, runtime.getURL, runtime.getManifest, storage.local.clear à BrowserAdapter |
| M-002 | Quota incrémenté avant handler dans message-router.ts |
| M-005 | Corpus quiz 20/50+ questions (TACHE-006) |
| M-006 | 7 pages statiques absentes (BACKLOG-PAGES-STATIC) |
| ACC-05 | `:focus-visible` absent dans Shadow DOM (ajouter dans BaseNudge) |
| ACC-06 | `aria-describedby` absent sur overlay-m6 |
| ACC-07 | `window.confirm()` non accessible dans options.ts |
| UX-015 | Clés i18n mortes — composants content-scripts utilisent des strings en dur |
| Mi-005 | `purgeExpired()` ne purge que le store `events` (pas hashes/scores/quiz) |
| RSV-DPO-01 | Export RGPD (Art. 20) retourne un squelette vide |
| TM-001 | m3-handler.ts à 0% couverture |
| TM-004 | storage-service.ts à 0% (666 lignes non testées) |
| TM-005 | message-router.ts à 0% couverture |

### Mineurs (15+)

Constats de style, nommage, optimisation — listés dans les rapports individuels. Non reproduits ici.

---

## Avis individuels résumés

**Développeur (3/5)** : Le code respecte D-SEC-003, le typage est strict. L'ADR-008 n'a pas été appliquée jusqu'au bout dans les pages et handlers. Le double listener et le lint cassé sont des régressions à corriger en priorité.

**Architecte sécurité (4/5)** : Posture de sécurité remarquable. D-SEC-001 à 005 tous conformes. Aucune donnée personnelle dans les logs. 0 CVE en dépendance production. Le `web_accessible_resources` avec `<all_urls>` pourrait être resserré.

**Testeur QA (3/5)** : Les tests existants sont de bonne qualité technique (M17 exemplaire). La couverture globale de 22% est très insuffisante pour le niveau Exposé. 4 composants critiques à 0% (storage-service, message-router, alarm-manager, service-worker). Les tests d'intégration sont des stubs.

**DPO (4.9/5)** : ENF-PBD-01 à 09 tous conformes. Le consentement M7 est exemplaire. L'export RGPD Art. 20 est un squelette à compléter avant MEP.

**Expert accessibilité (3.5/5)** : Le socle BaseNudge est solide (trapFocus corrigé, tokens CSS, prefers-reduced-motion). 4 non-conformités bloquantes (trapFocus toasts, double main, double role=img) toutes corrigeables rapidement. L'overlay-m9 (role=meter) est exemplaire.

**Expert UX/UI (4/5)** : Design system cohérent (20 tokens uniformes). Incohérences mineures d'animation entre composants. Constat structurant : les composants content-scripts n'utilisent pas l'API i18n (clés mortes dans _locales).

---

## Décision

**Le code P4 ne peut pas passer en phase suivante en l'état.** Les 6 constats bloquants doivent être corrigés.

**Plan de correction proposé :**

1. **Immédiat (avant prochain commit)** : corriger les 6 bloquants (B-001, B-002, ACC-01 à ACC-04)
2. **P4 suite** : corriger les majeurs d'architecture (M-001 BrowserAdapter, M-002 quota, ACC-05 focus-visible, Mi-005 purge)
3. **P5 (tests)** : amener la couverture à 80% (TM-001 à TM-014)
4. **P4/P5** : pages statiques (M-006), corpus quiz (M-005), export RGPD (RSV-DPO-01), i18n composants (UX-015)

**Décision demandée au Commanditaire :** Approuver le plan de correction et valider le passage en correction des bloquants.

---

*PV rédigé par l'Orchestrateur de la Fabrique — 2026-04-12*
