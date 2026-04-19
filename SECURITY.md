# Politique de sécurité — Sentinel Nudge

Merci de prendre le temps de signaler un problème de sécurité. Cette politique décrit comment contacter les mainteneurs, ce que nous nous engageons à faire, et le cadre légal de bonne foi dans lequel nous traiterons votre rapport.

## Versions supportées

| Version | Supportée       |
| ------- | --------------- |
| 1.x     | ✅              |
| < 1.0   | ❌ (pré-release) |

## Canal de signalement

**Utilisez exclusivement GitHub Security Advisories** — canal privé, chiffré de bout en bout, visible uniquement par les mainteneurs :

> 🔒 [Signaler une vulnérabilité (canal privé)](https://github.com/antonyblain/sentinel-nudge/security/advisories/new)

### Pourquoi ce canal

- **Privé** : votre rapport n'est **pas** visible du public tant que vous et les mainteneurs n'en décidez pas autrement.
- **Chiffré** : le transport est sécurisé par GitHub, aucune clé GPG n'est nécessaire de votre côté.
- **Traçable** : un fil de discussion privé est créé, toutes les échanges y sont conservés.
- **Intégré** : la CVE et les crédits sont générés depuis le même outil au moment de la divulgation.

**N'ouvrez pas d'issue publique** pour une vulnérabilité. Utiliser le canal public reviendrait à publier une vulnérabilité non corrigée et exposerait tous les utilisateurs.

### Contact de secours

Si vous ne pouvez pas utiliser GitHub Security Advisories (pas de compte GitHub, canal indisponible), vous pouvez contacter en dernier recours : `antony.blain@gmail.com` — mais **privilégiez le canal GitHub**.

## Nos engagements

| Étape                      | Délai garanti                                                                   |
| -------------------------- | ------------------------------------------------------------------------------- |
| Accusé de réception        | **5 jours ouvrés**                                                              |
| Analyse et classification  | **15 jours ouvrés**                                                             |
| Correctif publié           | **30 jours** maximum après confirmation\*                                       |
| Divulgation coordonnée     | Simultanée à la publication du correctif (CVE conjoint)                         |
| Crédit public (optionnel)  | Dans les release notes et la description CVE, avec votre consentement explicite |

\* _Si la complexité technique ou la coordination avec un tiers (Chrome, dépendance amont) justifient un délai plus long, nous vous informerons et conviendrons ensemble d'une nouvelle date._

## Périmètre

### Dans le périmètre

- Code source de l'extension (`src/`)
- Workflows CI/CD (`.github/workflows/`)
- Configuration affectant la sécurité (`manifest.json`, `package.json`, ADR dans `docs/adr/`)
- Détection de réutilisation de mots de passe (module M7, chiffrement AES-256-GCM)
- Stockage local chiffré (IndexedDB, `chrome.storage.local`)
- Content scripts injectés dans les pages de l'utilisateur

### Hors périmètre

- Vulnérabilités dans les dépendances tierces (`node_modules/`) — **signalez directement l'éditeur amont**. Nous intégrons les correctifs via `npm audit` et Dependabot.
- Vulnérabilités dans Chrome, Firefox ou les moteurs de navigateur — **signalez à l'éditeur** (Google, Mozilla).
- Vulnérabilités dans GitHub, Chrome Web Store ou les plateformes d'hébergement.
- Attaques nécessitant un accès physique à la machine de l'utilisateur.
- Ingénierie sociale contre les mainteneurs ou les utilisateurs.
- Déni de service local (l'extension n'expose aucun endpoint réseau).

## Types de vulnérabilités particulièrement recherchés

Compte tenu du positionnement du projet (extension navigateur traitant des événements de cyber-hygiène, privacy by design, tout traitement local) :

1. **Fuite de données locales** — exfiltration de hashes M7, contenu IndexedDB, `chrome.storage.local`.
2. **Bypass du chiffrement M7** — affaiblir l'AES-256-GCM, récupérer la clé, prédire le sel.
3. **Bypass du filtre `isTrusted`** — injecter des événements `isTrusted=false` captés à tort par M7 (cf. ARB-UC02-01).
4. **Injection XSS** — dans les content scripts, les pages UI (popup, options, onboarding, dashboard), ou les pages statiques d'explication.
5. **Élévation de privilèges MV3** — contournement du modèle de permissions, usage abusif de `web_accessible_resources`.
6. **Exposition de données via logs console** — logs non minimisés pouvant révéler URL, hash, sel (cf. R-M7-08, factory `logger.ts`).
7. **Attaques cross-frame / iframes malicieuses** — tromper M7 via des iframes masquant l'origine réelle (cf. UC-03/UC-04).

## Principes de bonne foi (safe harbor)

Nous considérerons les recherches menées dans le cadre de cette politique comme :

- Autorisées au regard des lois informatiques (CFAA aux USA, LCEN/Godfrain en France, ou leurs équivalents dans votre juridiction).
- Autorisées au regard du DMCA (ou équivalent).
- Conformes à nos conditions d'utilisation.

**Sous réserve que vous respectiez les principes suivants** :

- N'exploiter la vulnérabilité **qu'au strict nécessaire** pour en prouver l'existence.
- **Ne pas compromettre** les données d'utilisateurs tiers : si votre preuve de concept doit manipuler des données, utilisez vos propres données de test.
- Ne pas perturber le fonctionnement du service ni l'expérience des autres utilisateurs.
- Nous laisser **un délai raisonnable pour corriger** avant toute divulgation publique (par défaut, jusqu'à la publication du correctif ou 90 jours maximum après le signalement, la première échéance atteinte).
- Ne pas solliciter de contrepartie financière — ce projet est open-source et n'offre pas de bug bounty monétaire. Nous offrons en revanche une attribution publique dans le CVE et les release notes si vous le souhaitez.

## Processus après signalement

1. **Réception** : vous soumettez un rapport via GitHub Security Advisories.
2. **Accusé de réception** : nous vous confirmons avoir pris connaissance du rapport sous 5 jours ouvrés.
3. **Reproduction et triage** : nous reproduisons le problème et attribuons une sévérité (P0 critique → P3 informatif). Nous pouvons vous solliciter pour obtenir des précisions.
4. **Développement du correctif** : nous développons et testons le correctif dans une branche privée.
5. **Coordination de la divulgation** : nous convenons avec vous d'une date et d'un contenu pour la publication du CVE.
6. **Publication** : sortie du correctif (nouvelle version de l'extension), publication du CVE, crédits publics (si vous le souhaitez).
7. **Post-mortem** : revue interne des causes racines et capitalisation dans les documents d'ingénierie.

## Bonnes pratiques de sécurité intégrées au projet

Le projet Sentinel Nudge applique les principes suivants, qui peuvent orienter vos recherches :

- **Tout traitement local** : aucun appel réseau sortant, aucune télémétrie.
- **Aucune donnée identifiante** : pas de compte, pas d'identifiant utilisateur persistant.
- **Permissions minimales** (Manifest V3, principe du moindre privilège).
- **Stockage local chiffré** : hashes de mots de passe chiffrés avec AES-256-GCM (Web Crypto API), clé et sel générés localement.
- **Code open source** : auditable intégralement, couverture de tests visée à 80 %.
- **Revues de code systématiques** : chaque PR passe une revue ESLint + Prettier + Vitest + E2E Playwright, et un comité de revue de code formel pour les modifications sensibles.
- **Référentiel ISO 27001:2022** : cf. [`docs/securite/referentiel-iso27001-v1.2.md`](docs/securite/referentiel-iso27001-v1.2.md).

## Ressources

- [Référentiel ISO 27001 du projet](docs/securite/referentiel-iso27001-v1.2.md)
- [ADR-001 Service Worker Boot Contract](docs/adr/adr-001-sw-boot-contract.md)
- [ADR-002 Cross-Lifecycle Intent](docs/adr/adr-002-cross-lifecycle-intent.md)
- [AIPD module M7](docs/p3-conception/p3-aipd-m7-v1.0.md)

## Historique

| Version | Date       | Changement                                                                                     |
| ------- | ---------- | ---------------------------------------------------------------------------------------------- |
| 1.0     | 2026-04-17 | Réécriture complète (canal GitHub Security Advisories, SLA 30 j, safe harbor, scope détaillé) |
| 0.1     | 2026-04-11 | Version initiale minimale (anglais, email générique)                                           |
