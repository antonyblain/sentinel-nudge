# Sentinel Nudge

> Extension navigateur open source de cyber-hygiène comportementale — **privacy by design**.

[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)
[![Node.js ≥ 24](https://img.shields.io/badge/node-%E2%89%A524-brightgreen.svg)](https://nodejs.org/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange.svg)](https://developer.chrome.com/docs/extensions/develop/migrate)
[![Tests](https://img.shields.io/badge/tests-835%2B%20verts-brightgreen.svg)](#tests--qualité)
[![WCAG 2.2 AA](https://img.shields.io/badge/WCAG%202.2-AA-brightgreen.svg)](docs/accessibilite/audit-axe-core-themes-v1.0.md)

Sentinel Nudge observe vos habitudes de navigation **localement** sur votre appareil et vous propose des **conseils contextuels discrets** pour renforcer votre cyber-hygiène, en s'appuyant sur la recherche en sciences comportementales.

**Aucune donnée ne sort de votre navigateur.** Aucune télémétrie. Aucun appel réseau applicatif. Aucun compte requis.

---

## ✨ Fonctionnalités

7 modules de protection activables indépendamment :

| Module | Rôle |
|---|---|
| 🛡️ **Protection contre les sites frauduleux** | Alerte sur les domaines suspects (typosquatting, absence HSTS) |
| 📊 **Score de cyber-hygiène** | Feedback hebdomadaire agrégé sur vos habitudes |
| 🔄 **Rappel de mise à jour du navigateur** | Détecte si votre navigateur n'est pas à jour |
| 🎓 **Exercices de sensibilisation au phishing** | Quiz courts en répétition espacée |
| 🔐 **Alerte mots de passe réutilisés** | Détection locale (hash salé) de la réutilisation inter-domaines |
| 🔒 **Alerte connexion non sécurisée** | Alerte sur certificats invalides ou MITM probable |
| 📋 **Alerte copie de données sensibles** | Détecte le collage de CB / IBAN / SSN sur des sites non attendus |

**3 thèmes** activables : Clair (Aegis Light) · Sombre (Midnight Obsidian) · Matrix (Cyberpunk Neon), avec bascule auto `prefers-color-scheme` du navigateur.

---

## 🛠️ Installation développeur

**Prérequis** : Node.js ≥ 24, navigateur Chromium-based (Chrome 139+, Edge 139+).

```bash
git clone https://github.com/antonyblain/sentinel-nudge.git
cd sentinel-nudge
npm install
npm run build
```

Puis dans Chrome/Edge :

1. `chrome://extensions/` → activer le **Mode développeur**
2. Cliquer **"Charger l'extension non empaquetée"** → pointer vers le dossier `dist/`
3. L'extension apparaît dans la barre d'outils

**Scripts disponibles** :

```bash
npm run dev              # watch + rebuild auto
npm run test             # Vitest unit (~835 tests)
npm run test:coverage    # couverture v8 (seuils 60/80/70/60 activés)
npm run test:e2e         # Playwright E2E (4 pages × 3 thèmes = 12 combinaisons axe-core)
npm run lint             # ESLint (règles sécurité AST custom)
npm run format:check     # Prettier
```

---

## 🔒 Sécurité

Sentinel Nudge applique un modèle de menace formel (STRIDE) et 10 contrôles ISO 27001 A.5/A.8 explicites.

- **Politique de sécurité & divulgation responsable** : [SECURITY.md](SECURITY.md) — canal GitHub Security Advisories, SLA 30 jours.
- **Référentiel ISO 27001 v1.2** : [docs/securite/referentiel-iso27001-v1.2.md](docs/securite/referentiel-iso27001-v1.2.md)
- **Runbook de réponse à incident** : [docs/securite/runbook-reponse-incident.md](docs/securite/runbook-reponse-incident.md) (classification P0-P3, 10 étapes)
- **Hardening CI/CD** : SHA pinning actions (CWE-829), permissions read-all par défaut — [docs/securite/hardening-ci-cd-v1.0.md](docs/securite/hardening-ci-cd-v1.0.md)

---

## 🛡️ Confidentialité & RGPD

Tout le traitement est **100% local**. Aucune donnée n'est transmise à un tiers.

- **Politique de confidentialité v1.1** : [docs/rgpd/politique-de-confidentialite-v1.1.md](docs/rgpd/politique-de-confidentialite-v1.1.md)
- **AIPD (Analyse d'Impact Protection Données) v1.2** : [docs/p3-architecture/p3-aipd-m7-v1.2.md](docs/p3-architecture/p3-aipd-m7-v1.2.md)
- **Registre des traitements Art. 30 RGPD** : [docs/rgpd/registre-des-traitements-v1.0.md](docs/rgpd/registre-des-traitements-v1.0.md)

**Droits RGPD exerçables directement dans l'extension** : accès, portabilité (Art. 20), effacement, opposition. Bouton **Exporter mes données** + **Supprimer toutes mes données** dans les Options.

---

## ♿ Accessibilité

- **WCAG 2.2 AA** validé sur les 4 pages × 3 thèmes via [axe-core](https://github.com/dequelabs/axe-core) automatisé en CI (12/12 combinaisons PASS).
- Skip links WCAG 2.4.1 A sur les 7 pages d'explication.
- Respect de `prefers-reduced-motion` sur toutes les animations.
- Rapport d'audit : [docs/accessibilite/audit-axe-core-themes-v1.0.md](docs/accessibilite/audit-axe-core-themes-v1.0.md)

---

## 📚 Documentation

| Document | Pour qui |
|---|---|
| [Politique de confidentialité v1.1](docs/rgpd/politique-de-confidentialite-v1.1.md) | Utilisateur final |
| [Matrice de compatibilité providers](docs/p5-recette/matrice-compatibilite-providers-m7.md) | Utilisateur curieux + contributeurs |
| [Plan de tests manuels consolidé v1.0](docs/p5-recette/plan-tests-manuels-consolide-v1.0.md) | Testeurs QA |
| [Référentiel ISO 27001 v1.2](docs/securite/referentiel-iso27001-v1.2.md) | Audit sécurité |
| [SECURITY.md](SECURITY.md) | Chercheurs en sécurité |
| [Runbook incident](docs/securite/runbook-reponse-incident.md) | Gestion des vulnérabilités signalées |

---

## 🤝 Contribution

Les contributions sont bienvenues. Avant de contribuer :

1. Lire [SECURITY.md](SECURITY.md) et [la politique de confidentialité](docs/rgpd/politique-de-confidentialite-v1.1.md).
2. Ouvrir une [Issue](https://github.com/antonyblain/sentinel-nudge/issues) pour discuter du changement avant d'ouvrir une PR.
3. Flux Git : branches courtes `feature/p5-tache-<id>-<slug>` depuis `develop` → PR vers `develop` → squash merge (historique linéaire).
4. Vérifications pré-commit obligatoires : `npm run format:check && npm run lint && npm run build && npm run test`.
5. CI GitHub Actions doit être verte avant merge (Qualité + E2E Playwright + axe-core 12/12).

**Vulnérabilités de sécurité** : signaler via **GitHub Security Advisories** uniquement, cf. [SECURITY.md](SECURITY.md). Ne **pas** ouvrir d'issue publique.

---

## 🧪 Tests & qualité

- **Tests unitaires Vitest** : 835+ tests, 44 fichiers. Couverture v8 avec seuils bloquants (60% lines / 80% branches / 70% functions / 60% statements sur périmètre testable — pages UI DOM-heavy exclues, documentées dans `vite.config.ts`).
- **Tests E2E Playwright** : 12 combinaisons accessibilité axe-core (popup + dashboard + options + onboarding × clair/sombre/matrix).
- **Règles ESLint custom AST** : interdiction `console.log` direct, interdiction `const message = err.message` (minimisation logs sécurité).

---

## 📜 Licence

Distribué sous **GNU General Public License v3.0** — voir [LICENSE](LICENSE).

Vous êtes libre d'utiliser, modifier et redistribuer ce logiciel, à condition que **toute version dérivée reste sous la même licence GPL v3**. Cela garantit que Sentinel Nudge et ses forks restent open source.

---

## 📌 Statut

**v1** en stabilisation finale (phase P6 — conformité, accessibilité, supply-chain hardening). Recette fonctionnelle sur Chrome 139+ / Edge 139+.

Roadmap v1.1+ : support Firefox MV3, extension aux providers Okta, intégration Chrome Web Store.

---

*Sentinel Nudge est développé en France par [Antony Blain](https://github.com/antonyblain) (particulier, sans activité commerciale). Extension conçue dans le cadre d'une démarche de sensibilisation RSSI.*
