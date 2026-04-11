# TECH STACK — Technologies validées et réutilisables

Ce fichier est enrichi à chaque décision technologique validée. Il sert de mémoire inter-projets : l'architecte logiciel le consulte en P3 pour réutiliser les choix éprouvés.

## Frameworks

| Type | Technologie | Version | Justification | Projet d'origine | Plan B |
|------|------------|---------|---------------|-------------------|--------|
| Build extension navigateur | Vite + vite-plugin-web-extension | 5.x / ^0.13 | HMR rapide, configuration déclarative manifest.json, multi-entry natif, tree-shaking optimisé | Sentinel Nudge | Webpack + webpack-extension-manifest |
| UI extension (content scripts) | Vanilla TypeScript + Shadow DOM natif | — | Isolation CSS garantie, zéro framework, légèreté maximale, transparence pour audit communautaire | Sentinel Nudge | Lit (Web Components library, ~6 Ko) |

## Langages

| Langage | Conventions adoptées | Projet d'origine |
|---------|---------------------|-------------------|
| TypeScript 5.x | Mode strict, ESLint @typescript-eslint, Prettier, interdiction innerHTML (D-SEC-003) | Sentinel Nudge |

## Bases de données

| Type de besoin | Technologie | Version | Projet d'origine | Plan B |
|---------------|------------|---------|-------------------|--------|
| Stockage local structuré (extension) | IndexedDB (natif navigateur) | — | Sentinel Nudge | chrome.storage.local (fallback 5 Mo si IDB indisponible) |
| Configuration et état volatile | chrome.storage.local (natif MV3) | — | Sentinel Nudge | — |

## Services tiers / API

| Service | Usage | Gratuit ? | Limites | Projet d'origine | Plan B | Effort migration |
|---------|-------|-----------|---------|-------------------|--------|-----------------|
| chrome.runtime.requestUpdateCheck | Vérification mise à jour navigateur (M5) | Oui | API native Chrome MV3 uniquement | Sentinel Nudge | Aucun (API spécifique) | — |
| SubtleCrypto (Web Crypto API) | Chiffrement AES-256-GCM, SHA-256 | Oui (natif) | Chrome/Firefox/Edge | Sentinel Nudge | @noble/ciphers (MIT) | Faible |
| GitHub Actions | CI/CD (lint, test, build, release) | Oui (dépôts publics) | — | Sentinel Nudge | GitLab CI (si migration) | Moyen |
| Syft (Anchore) | Génération SBOM SPDX-JSON | Oui | — | Sentinel Nudge | cyclonedx-npm | Faible |

## Hébergement

| Type | Plateforme | Gratuit ? | Configuration type | Projet d'origine | Plan B |
|------|-----------|-----------|-------------------|-------------------|--------|
| Distribution extension | Chrome Web Store | 5 USD one-time | Publication via chrome-webstore-action (CI/CD) | Sentinel Nudge | Distribution ZIP via GitHub Releases |
| Code source | GitHub | Oui (public) | main + develop + feature branches, PR obligatoires | Sentinel Nudge | GitLab |

## Outils de développement

| Outil | Usage | Configuration |
|-------|-------|---------------|
| ESLint 9 + @typescript-eslint | Linting TypeScript | no-restricted-properties (innerHTML interdit D-SEC-003) |
| Prettier 3 | Formatage code | — |
| Vitest 2 | Tests unitaires et intégration | Coverage v8, mode ESM natif |
| Playwright 1 + playwright-crx | Tests E2E extension Chrome | Charge l'extension réelle dans Chrome |
| license-checker | Vérification compatibilité licences GPL v3 | Bloque le CI si licence incompatible |

## Tests accessibilité

| Outil | Usage | Configuration |
|-------|-------|---------------|
| @axe-core/playwright | Tests automatisés d'accessibilité WCAG | v4.x, licence MPL 2.0 (compatible GPL v3), intégré aux tests E2E Playwright |

## Bibliothèques récurrentes

| Package | Langage | Usage type | Version |
|---------|---------|-----------|---------|
| @zxcvbn-ts/core | TypeScript | Évaluation force de mot de passe (MIT, compatible GPL v3) | ^3.0.4 |

## Patterns architecturaux validés

| Pattern | Contexte d'usage | Projet d'origine | Retour d'expérience |
|---------|-----------------|-------------------|---------------------|
| Service Worker éphémère MV3 | Extension Chrome — orchestration sans background persistant | Sentinel Nudge | Nécessite persistance atomique avant fin opération ; cache 60s pour état quota |
| Browser Adapter (couche d'abstraction navigateur) | Extension multi-navigateur — isoler les appels chrome.* dans un module dédié | Sentinel Nudge | Faible coût v1 (~80 lignes), migration Firefox/Edge facilitée |
| Shadow DOM pour isolation UI injectée | Content scripts injectant des composants UI dans des pages tierces | Sentinel Nudge | Isolation CSS complète, compatible WCAG ARIA, focus trap nécessaire pour modaux |
| Message routing centralisé | Communication content scripts ↔ service worker | Sentinel Nudge | Format NudgeMessage/NudgeResponse standardisé, routage dans MessageRouter |
| Chiffrement AES-256-GCM IndexedDB | Données comportementales sensibles au repos | Sentinel Nudge | SubtleCrypto natif, IV 12 bytes par opération, risque accepté D-SEC-004 |
| Injection conditionnelle content scripts | Modules on/off avec lazy loading via scripting.executeScript | Sentinel Nudge | Réduit CPU/mémoire au repos, nécessite vérification config au réveil SW |

_Ce fichier est enrichi après chaque Comité d'architecture et lors de la rétrospective de fin de projet._
