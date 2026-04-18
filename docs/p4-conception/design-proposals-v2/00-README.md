# Design Proposals v2 — Sentinel Nudge

**Auteur** : Expert UX/UI — La Fabrique  
**Date** : 2026-04-18  
**Tâche** : TACHE-137 — Claude Design  
**Statut** : Soumis pour arbitrage Commanditaire

---

## 1. Introduction et méthodologie

Ce dossier contient 5 propositions graphiques haute-fidélité pour Sentinel Nudge v2. Chaque variante est une maquette statique self-contained (1 fichier HTML avec CSS inline) représentant l'intégralité des surfaces UI : popup étendue, dashboard plein écran, options, toasts de notification, et écran d'onboarding.

### Objectif

Positionner Sentinel Nudge comme un produit **premium grand public** tout en préservant :
- Le positionnement **privacy by design** (GPL v3, aucun dark pattern)
- L'absence de culpabilisation et de fausse urgence
- La conformité **WCAG 2.2 AA** (contrastes ≥ 4.5:1 texte normal, ≥ 3:1 texte large)
- Le **dark mode** natif (`@media (prefers-color-scheme: dark)`)

### Périmètre de chaque maquette

| Section | Contenu |
|---------|---------|
| Popup | Score cyber-hygiène (gauge SVG), statut 7 modules, quota jour, actions rapides |
| Dashboard | Tendance hebdo (graphique SVG), historique nudges, whitelist M2 éditable |
| Options | Consentements M2/M3/M5/M6/M7/M9/M17, quota, langue, dark mode, export RGPD |
| Toasts | M7 (réutilisation mdp), M17 (presse-papiers), overlays M2/M6/M9 |
| Onboarding | Accueil + opt-in M7 explicite |

### Contraintes respectées

- **Self-contained** : 1 fichier HTML par variante, CSS inline uniquement, SVG inline, zéro CDN
- **System fonts** uniquement (conformité ENF-SEC-03 Brand Book v1)
- **Aucun dark pattern** : bouton de rejet toujours présent, pas de compte à rebours, pas de culpabilisation
- **Accessibilité** : structure sémantique (nav, main, section, h1/h2/h3), focus visible, aria-labels

---

## 2. Les 5 variantes

| # | Slug | Concept | Référence stylistique |
|---|------|---------|----------------------|
| 1 | `glassmorphism-aurora` | Verre dépoli, dégradés aurorae, fond sombre profond | Apple Vision Pro, Linear.app, Vercel dark |
| 2 | `bento-clarity` | Grille bento, cartes flottantes, blanc immaculé | Apple Human Interface, Stripe Dashboard, Notion |
| 3 | `neo-brutalist-cyber` | Contours épais, couleurs saturées, typographie bold | Figma Community "Brutalist UI", Linear issues |
| 4 | `gradient-mesh-warm` | Fond mesh gradient, tons chauds coral/violet, neumorphisme léger | Dribbble 2025 trends, Luma.ai, Arc Browser |
| 5 | `terminal-minimal` | Typographie monospace, densité maximale, UI data-centric | Raycast, Warp Terminal, Linear compact mode |

---

## 3. Matrice comparative

| Critère | Variante 1 Glassmorphism | Variante 2 Bento Clarity | Variante 3 Neo-Brutalist | Variante 4 Gradient Warm | Variante 5 Terminal |
|---------|--------------------------|--------------------------|--------------------------|--------------------------|---------------------|
| **Energie visuelle** | Haute (premium) | Moyenne (serein) | Très haute (disruptif) | Haute (chaleureux) | Basse (concentré) |
| **Sérieux perçu** | Très élevé | Elevé | Moyen | Moyen | Très élevé |
| **Accessibilité ressentie** | Bonne | Excellente | Moyenne (fatigue) | Très bonne | Bonne (expert) |
| **Différenciation marché** | Forte | Moyenne | Très forte | Forte | Forte |
| **Grand public** | Oui | Oui (meilleur) | Non (niche) | Oui | Non (niche tech) |
| **Cohérence privacy** | Excellente | Excellente | Bonne | Excellente | Excellente |
| **Dark mode natif** | Natif (dark-first) | Adapté | Natif | Adapté | Natif |
| **Complexité implémentation** | Haute | Moyenne | Basse | Haute | Basse |
| **Mémorabilité** | Haute | Moyenne | Très haute | Haute | Moyenne |
| **Risque de vieillissement** | Moyen (trend) | Faible | Faible | Moyen (trend) | Faible |

---

## 4. Recommandation finale

**Variante recommandée : Variante 2 — Bento Clarity**

### Rationale UX

La variante Bento Clarity est la seule qui satisfait simultanément tous les critères du positionnement Sentinel Nudge :

1. **Grand public premium** : les grilles bento à la Apple sont le langage visuel dominant en 2025-2026 (macOS Sequoia widgets, iOS 18, Notion, Linear). L'utilisateur reconnaît immédiatement ce pattern comme "qualité premium" sans apprentissage.

2. **Privacy by design visible** : le blanc immaculé et les espaces respirants communiquent l'ouverture et la transparence — l'opposé des interfaces surveillance sombres et anxiogènes. Chaque consentement est un toggle bien séparé, jamais groupé dans un formulaire opaque.

3. **Accessibilité maximale** : le fond blanc avec typographie sombre offre les contrastes les plus élevés. Les cartes bento délimitent clairement les zones fonctionnelles (principe de Gestalt — proximity + closure), réduisant la charge cognitive.

4. **Durabilité** : la grille bento n'est pas un micro-trend (glassmorphism, neumorphism) — c'est un pattern de mise en page fondamental qui existe depuis les premières newsletters d'Apple et durera.

5. **Cohérence avec la marque** : la palette Aegis Blue validée (TACHE-031) s'intègre naturellement dans un système bento : bleu primaire pour les en-têtes de carte, accent pour les CTA, surface pour les fonds de carte.

### Alternative de secours

Si le Commanditaire préfère un positionnement plus technique/premium : **Variante 1 — Glassmorphism Aurora** (dark-first, très différenciante, risque de vieillissement à surveiller).

### Tâches de suivi recommandées

| ID suggéré | Titre | Priorité |
|------------|-------|----------|
| TACHE-138 | Arbitrage variante retenue par le Commanditaire | Must (bloquant) |
| TACHE-139 | Intégration tokens v2 dans `src/assets/styles/tokens.css` selon variante retenue | Must |
| TACHE-140 | Refonte popup.ts + options.ts avec les nouveaux composants bento/glass selon choix | Should |
| TACHE-141 | Export SVG icône v2 alignée avec l'identité visuelle retenue | Should |
| TACHE-142 | Audit accessibilité complet (Expert accessibilité) sur les maquettes HTML produites | Must |
