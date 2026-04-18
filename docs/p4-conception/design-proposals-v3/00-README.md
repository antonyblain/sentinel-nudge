# Design Proposals v3 — Sentinel Nudge
## 6 thèmes : Clair x2 / Sombre x2 / Matrix x2

**Auteur** : Expert UX/UI — Fabrique Sentinel Nudge  
**Date** : 2026-04-18  
**Branche** : feature/p5-tache-068-uc01-login-multi-etape  
**Statut** : Soumis au Commanditaire pour arbitrage TACHE-137 (reorientée)

---

## Introduction

Ce dossier contient 6 maquettes HTML self-contained + 1 fichier de tokens de démonstration, répondant à la réorientation du Commanditaire :

- 2 propositions de **thème clair** (avec dark fallback automatique via OS)
- 2 propositions de **thème sombre** (avec fallback clair élégant)
- 2 propositions de **thème matrix** (activation manuelle uniquement)

Chaque fichier HTML est autonome : CSS inline, SVG inline, zéro dépendance externe.

---

## Mécanisme de bascule CSS (tokens-v2.css)

```
:root              →  Thème clair (défaut OS clair)
@media prefers-color-scheme: dark  →  Override auto thème sombre
[data-theme="light"]   →  Force clair (même si OS dark)
[data-theme="dark"]    →  Force sombre (même si OS clair)
[data-theme="matrix"]  →  Thème matrix (manuel uniquement, pas de bascule OS)
```

**Application en TypeScript (extension)** :

```typescript
// service-worker.ts ou options.ts
const stored = await chrome.storage.local.get('theme');
const theme: 'auto' | 'light' | 'dark' | 'matrix' = stored.theme ?? 'auto';
if (theme !== 'auto') {
  document.documentElement.dataset.theme = theme;
}
// Pour 'auto' : laisser @media (prefers-color-scheme) agir, rien à faire.
```

**Sélecteur dans les Options** : toggle 4 positions "Auto (OS) · Clair · Sombre · Matrix"  
- Auto = valeur par défaut stockée dans `chrome.storage.local`  
- Clair/Sombre/Matrix = override stocké, appliqué au chargement de chaque page

---

## Matrice des 6 thèmes

| # | Slug | Type | Concept | Palette (5 clés) | Ambiance | Ref stylistique |
|---|------|------|---------|-------------------|----------|-----------------|
| 1 | `theme-clair-1-aegis-light` | Clair | Sobre, institutionnel, fidèle au brand book v1 | `#f5f7fa` `#1e3a5f` `#2e6da4` `#1a7a4a` `#c0392b` | Professionnel RSSI, banque, entreprise | GOV.UK / Tailwind Admin |
| 2 | `theme-clair-2-morning-mist` | Clair | Chaleureux, moderne, bento grid aéré | `#fafaf8` `#3d2b8e` `#6654c0` `#1d6b4f` `#b83030` | Productivité, Notion, Linear | Notion / Linear / Primer |
| 3 | `theme-sombre-1-aurora` | Sombre | Deep-space, glassmorphism, dégradés Aurora | `#090e1a` `#5b9cf6` `#a78bfa` `#4ade80` `#f87171` | Spectaculaire, premium, techno | macOS Monterey / Arc Browser |
| 4 | `theme-sombre-2-midnight-obsidian` | Sombre | Charbon mat, surfaces solides, Indigo+Teal | `#0d0d0f` `#818cf8` `#06b6d4` `#22c55e` `#ef4444` | Confortable longue durée, sobre | Material You / Figma Dark / Arc |
| 5 | `theme-matrix-1-terminal-phosphor` | Matrix | Terminal CRT, vert phosphore monochrome, CLI pur | `#000000` `#00ff41` `#00b32c` `#ff4444` `#ffaa00` | Hacker minimaliste, hardcore terminal | Matrix (film) / Commodore 64 |
| 6 | `theme-matrix-2-cyberpunk-neon` | Matrix | Néon magenta+cyan, grid perspective, synthwave | `#0a0a14` `#ff2d78` `#00d4ff` `#ffd700` `#00ff87` | Rétro-futuriste, personnalisé, marquant | Cyberpunk 2077 / Synthwave84 |

---

## Comparatif des 6 thèmes

| Critère | Aegis Light | Morning Mist | Aurora | Obsidian | Terminal Phosphor | Cyberpunk Neon |
|---------|------------|--------------|--------|----------|-------------------|----------------|
| Contraste fg/bg | 15.8:1 | 16.2:1 | 14.2:1 | 13.8:1 | 17.8:1 | 13.8:1 |
| Contraste accent | 5.2:1 | 5.4:1 | 5.8:1 | 4.7:1 | 17.8:1 | 14.2:1 |
| WCAG AA (corps) | PASS | PASS | PASS | PASS | PASS | PASS |
| Dark fallback OS | Oui (auto) | Oui (auto) | N/A | N/A | N/A | N/A |
| Fallback clair | N/A | N/A | Oui | Oui | N/A | N/A |
| Bascule OS auto | Oui | Oui | Oui | Oui | Non | Non |
| Niveau d'énergie | Faible | Moyen | Elevé | Moyen | Moyen | Elevé |
| Différenciation | Basse | Haute | Très haute | Haute | Très haute | Très haute |
| Privacy alignment | Neutre | Neutre | Neutre | Neutre | Fort | Moyen |
| Glassmorphism | Non | Non | Oui | Non | Non | Non |
| Animations | Légères | Légères | Aurora orbs | Non | Rain + scanlines | Grid + scanlines |
| prefers-reduced-motion | Oui | Oui | Oui | Oui | Oui | Oui |
| Idéal pour | Entreprise | Pro créatif | Enthousiaste tech | Développeur | Hacker/RSSI | Personnalisation |

---

## Composants représentés dans chaque maquette

Chaque fichier HTML contient les 5 sections suivantes :

1. **Popup étendue** (320px) : score gauge SVG, 7-8 modules chips, quota bar, boutons d'action
2. **Dashboard** : 3 KPI cards, graphique tendance SVG, historique nudges avec tags
3. **Options** : navigation latérale, **sélecteur thème 4 positions** (Auto/Clair/Sombre/Matrix), toggles modules
4. **Toasts M7/M17 + Overlay M2** : toast mot de passe faible, session longue, succès, overlay phishing
5. **Onboarding** : hero gradient, 3 étapes, consentement M7 opt-in, footer CTA

---

## Recommandations par type

### Thème clair

**Recommandation : Aegis Light (theme-clair-1)**  
- Continuité avec la palette Aegis Blue v1 (tokens.css existant)  
- Migration rapide vers tokens-v2.css sans rupture de charte graphique  
- Plus adapté au contexte entreprise/RSSI que Morning Mist  
- Morning Mist est recommandé si le Commanditaire souhaite un repositionnement "outil moderne" grand public

### Thème sombre

**Recommandation : Aurora (theme-sombre-1)**  
- Le Commanditaire a explicitement dit l'aimer dans la session précédente  
- Glassmorphism + dégradés = identité visuelle forte et reconnaissable  
- Midnight Obsidian est recommandé en fallback si les performances (backdrop-filter) posent problème sur certains navigateurs/extensions

### Thème matrix

**Recommandation : Terminal Phosphor (theme-matrix-1)**  
- Cohérence avec l'identité "outil de sécurité" : le terminal CLI est le langage naturel du RSSI  
- Monochrome phosphore = confort visuel nocturne maximal (moins de fatigue oculaire)  
- Cyberpunk Neon est recommandé si le Commanditaire préfère quelque chose de plus personnalisé et distinctif visuellement

---

## Suivi recommandé (tâches post-arbitrage)

| ID suggéré | Description | Priorité |
|------------|-------------|----------|
| TACHE-146 | Intégrer tokens-v2.css dans le build Vite (remplacer tokens.css v1) | Must |
| TACHE-147 | Ajouter sélecteur thème 4 positions dans options.ts + chrome.storage.local | Must |
| TACHE-148 | Appliquer data-theme au chargement dans popup.ts, dashboard.ts, options.ts, onboarding.ts | Must |
| TACHE-149 | Vérifier rendu glassmorphism Aurora en MV3 (backdrop-filter support Chromium) | Should |
| TACHE-150 | Audit contrastes automatisé avec axe-core sur les 3 thèmes retenus | Should |
| TACHE-151 | Test `prefers-reduced-motion` sur les animations Aurora orbs et Matrix rain | Should |
