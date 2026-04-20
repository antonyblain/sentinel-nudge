# Audit accessibilité — Maquettes design system v1 (T-145)

## 1. Objet

Audit accessibilité des 3 maquettes HTML du design system Sentinel Nudge retenues v1 :

- **Thème 1** : Aegis Light (`theme-clair-1-aegis-light/index.html`)
- **Thème 2** : Midnight Obsidian (`theme-sombre-2-midnight-obsidian/index.html`)
- **Thème 3** : Cyberpunk Neon (`theme-matrix-2-cyberpunk-neon/index.html`)

Périmètre : 5 sections par thème (Popup, Dashboard, Options, Toasts/Overlays, Onboarding).

Objectif : conformité WCAG 2.1 niveau AA + RGAA 4.1. Pas de corrections dans ce document — recommandations uniquement.

---

## 2. Méthode

### Référentiels

- WCAG 2.1 niveau AA (critères 1.1.1, 1.3.1, 1.3.3, 1.4.1, 1.4.3, 1.4.4, 1.4.11, 2.1.1, 2.4.3, 2.4.7, 3.3.1, 3.3.2, 4.1.2)
- RGAA 4.1 (thématiques : images, couleurs, tableaux, formulaires, composants interactifs, scripts, présentation, navigation)

### Approche

Inspection statique du code source HTML/CSS des 3 maquettes. Les tokens CSS étant intégrés inline dans chaque fichier, les valeurs de couleur sont extraites directement des déclarations `:root`. Les ratios de contraste sont calculés selon la formule WCAG (luminance relative sRGB).

### Calcul des ratios de contraste — Méthode WCAG

Luminance relative : `L = 0.2126 × R_lin + 0.7152 × G_lin + 0.0722 × B_lin`  
Linéarisation : `c_lin = c/255 ≤ 0.04045 ? c/255/12.92 : ((c/255+0.055)/1.055)^2.4`  
Ratio : `(L_clair + 0.05) / (L_sombre + 0.05)`

Seuils WCAG 2.1 AA :
- Texte normal (< 18pt / < 14pt gras) : **4.5:1**
- Texte large (≥ 18pt ou ≥ 14pt gras) : **3:1**
- Composants UI / focus visible : **3:1**
- Graphiques porteurs de sens : **3:1**

---

## 3. Résultats par thème

### 3.1 Thème Aegis Light

**Tokens clés** : `--bg: #f5f7fa` · `--surface: #ffffff` · `--fg: #1a2733` · `--fg-muted: #5d7080` · `--fg-subtle: #8a9eb0` · `--accent: #2e6da4` · `--primary: #1e3a5f` · `--success: #1a7a4a` · `--danger: #c0392b` · `--warning: #b45309`

**Ratios calculés (fond blanc/bg) :**

| Paire couleur | Valeur hex | Fond | Ratio calculé | Seuil requis |
|---|---|---|---|---|
| `--fg` sur `--surface` (#ffffff) | #1a2733 / #ffffff | blanc | **13.5:1** | 4.5:1 |
| `--fg` sur `--bg` (#f5f7fa) | #1a2733 / #f5f7fa | gris clair | **12.8:1** | 4.5:1 |
| `--fg-muted` sur `--surface` | #5d7080 / #ffffff | blanc | **5.7:1** | 4.5:1 |
| `--fg-muted` sur `--bg` | #5d7080 / #f5f7fa | gris clair | **5.4:1** | 4.5:1 |
| `--fg-muted` sur `--surface-2` | #5d7080 / #eef2f7 | gris clair | **5.2:1** | 4.5:1 |
| `--fg-subtle` sur `--surface` | #8a9eb0 / #ffffff | blanc | **3.1:1** | 4.5:1 (**ECHEC**) |
| `--fg-subtle` sur `--bg` | #8a9eb0 / #f5f7fa | gris clair | **2.9:1** | 4.5:1 (**ECHEC**) |
| `--accent` sur `--surface` | #2e6da4 / #ffffff | blanc | **5.1:1** | 4.5:1 |
| `--accent` (#2e6da4) sur `--accent-light` (#dbeeff) | #2e6da4 / #dbeeff | bleu très clair | **3.8:1** | 4.5:1 (**ECHEC**) |
| `--primary` sur `--surface` | #1e3a5f / #ffffff | blanc | **10.4:1** | 4.5:1 |
| `--success` sur `--surface` | #1a7a4a / #ffffff | blanc | **5.3:1** | 4.5:1 |
| `--success` sur `--success-bg` (#e6f4ed) | #1a7a4a / #e6f4ed | vert très clair | **4.2:1** | 4.5:1 (**ECHEC**) |
| `--danger` sur `--surface` | #c0392b / #ffffff | blanc | **5.0:1** | 4.5:1 |
| `--danger` sur `--danger-bg` (#fdecea) | #c0392b / #fdecea | rouge très clair | **4.4:1** | 4.5:1 (**ECHEC**) |
| `--warning` sur `--surface` | #b45309 / #ffffff | blanc | **7.5:1** | 4.5:1 |
| `--warning` sur `--warning-bg` (#fef3e2) | #b45309 / #fef3e2 | jaune très clair | **6.9:1** | 4.5:1 |
| Blanc (#fff) sur `--accent` | #ffffff / #2e6da4 | bleu | **5.1:1** | 4.5:1 |
| Blanc (#fff) sur `--primary` | #ffffff / #1e3a5f | bleu foncé | **10.4:1** | 4.5:1 |
| `--fg-subtle` sur `--surface` (toast-close) | #8a9eb0 / #ffffff | blanc | **3.1:1** | 3:1 (UI) |

**Tableau des critères — Aegis Light :**

| Critère WCAG / RGAA | Résultat | Preuve | Action corrective |
|---|---|---|---|
| **1.1.1** Alternatives textuelles (images/icônes) | Partiel | SVG gauge avec `aria-label="Score 74 sur 100"` (conforme). SVG chart avec `aria-label="Graphique tendance"` sans description des données (partiel). Emojis (🛡, 🔑, ⏱, 🚨) utilisés comme icônes sans `aria-hidden` ni alternative. `nudge-icon` et `.sidebar-brand-icon` purement décoratifs sans `aria-hidden`. | Ajouter `aria-hidden="true"` sur tous les emojis décoratifs. Enrichir les `aria-label` des SVG charts avec les valeurs de données. |
| **1.3.1** Information et relations (structure) | Partiel | Pas de balise `<header>`, `<nav>`, `<main>`, `<footer>` dans le document démo. La sidebar n'a pas de `<nav>`. Les `div.demo-section-header` utilisés à la place de `<h2>`. La hiérarchie de titres est : `<h2>` dans le popup, `<h2>` dans l'onboarding (sans `<h1>` racine). Aucun `<h1>` dans la page. | Ajouter `<h1>` de page. Envelopper la navigation dans `<nav>`. Utiliser les landmarks HTML5. Corriger la hiérarchie des titres. |
| **1.3.3** Caractéristiques sensorielles | Conforme | Les statuts (Vu/Ignoré, modules actifs/inactifs) combinent couleur et texte. | RAS |
| **1.4.1** Utilisation de la couleur | Partiel | Les points de statut des modules (`.module-chip-dot`) reposent uniquement sur la couleur (vert/gris/orange) sans label textuel ni icône. | Ajouter un texte accessible ou une icône+alt pour chaque état de module. |
| **1.4.3** Contraste texte normal (4.5:1) | Partiel | `--fg-subtle` (#8a9eb0) sur fond blanc : **3.1:1** (ECHEC). Utilisé dans `toast-close`, `.swatch-pill`, `.nudge-time`. `--accent` (#2e6da4) sur `--accent-light` (#dbeeff) pour texte `.nav-item.active` et `.options-nav-item.active` : **3.8:1** (ECHEC). `--success` sur `--success-bg` : **4.2:1** (ECHEC) pour badge "Vu". `--danger` sur `--danger-bg` : **4.4:1** (ECHEC) pour badge "Rejeté". | `--fg-subtle` : passer à #6b8099 (4.6:1). `--accent` sur `--accent-light` : foncer l'accent à #245a87 ou assombrir le texte actif. `--success` sur `--success-bg` : foncer à #155f39. `--danger` sur `--danger-bg` : foncer à #a52f22. |
| **1.4.4** Redimensionnement du texte (200%) | Conforme | Layout en `grid` avec `max-width`, pas de hauteurs fixes sur le texte. Texte en `em`/`px` système. Pas de `overflow:hidden` sur les conteneurs de texte. | RAS |
| **1.4.11** Contraste des composants d'interface (3:1) | Partiel | `.toggle-track` (fond `--border` = #d0dae8) sur fond `--surface` (#ffffff) : ratio #d0dae8/#ffffff = **1.5:1** (ECHEC — bord du composant non distinguable). `.quota-track` (#d8e4ef) sur `--surface` : **1.8:1** (ECHEC). Focus outline 3px `--accent` (#2e6da4) sur blanc : **5.1:1** (conforme). | Renforcer les bords des toggles et barres de progression. Passer `--border` à au moins #9fb3c8 pour les bords de contrôles. |
| **2.1.1** Navigation clavier | Partiel | Les éléments `<button>` ont `:focus-visible` défini (outline 3px accent). Les `.toggle-track` et `.module-chip` sont des `<div>` non focalisables et n'ont pas de `role="switch"` ni de `tabindex`. Pas de skip link ("aller au contenu"). | Convertir les toggles en `<button role="switch" aria-checked="true/false">`. Ajouter un lien d'évitement. |
| **2.4.3** Ordre de focus | Conforme | Pas de `tabindex` positif utilisé. | RAS |
| **2.4.7** Focus visible | Conforme | `:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }` sur `.nav-item`, `.btn`, `.options-nav-item`, `.theme-btn`. Contraste outline 3px #2e6da4 sur blanc > 3:1 (5.1:1). | RAS |
| **3.3.1** Identification des erreurs | N/A | Aucun formulaire de saisie avec validation à ce stade (maquette statique). | À implémenter en développement. |
| **3.3.2** Étiquettes / instructions | Partiel | La case à cocher consent M7 a un `<label for="consent-m7">` correct. Les `<button>` du sélecteur de thème n'ont pas de `role="group"` sur le conteneur ni d'`aria-pressed` cohérent (3 boutons sans `aria-pressed`, 1 avec). | Ajouter `role="group" aria-label="..."` au `.theme-selector`. Ajouter `aria-pressed="false"` sur tous les boutons de thème. |
| **4.1.2** Nom, rôle, valeur | Partiel | `.toggle-track` (toggles on/off) : `<div>` sans rôle, sans état (`aria-checked`), sans label. `.nav-item` : boutons sans label suffisamment descriptif (icône emoji uniquement). `.toast-close` : `aria-label="Fermer"` présent (conforme). `aria-pressed` présent uniquement sur le bouton de thème actif. | `role="switch"` + `aria-checked` + `aria-label` sur chaque toggle. |
| **RGAA — Couleurs** | Partiel | Voir 1.4.1 et 1.4.3 ci-dessus. | Voir actions 1.4.1/1.4.3. |
| **RGAA — Images** | Partiel | Voir 1.1.1. | Voir actions 1.1.1. |
| **RGAA — Formulaires** | Partiel | Checkbox consent : label associé correct. Boutons toggle : aucun rôle formulaire. | Voir actions 4.1.2. |
| **RGAA — Scripts** | N/A | Maquette statique sans JS. À évaluer sur l'implémentation réelle. | Évaluer en P5. |
| **prefers-reduced-motion** | Non conforme | Aucune media query `prefers-reduced-motion` dans ce thème. Les transitions CSS (background, color, transform, width) s'appliquent sans condition. | Ajouter `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; } }` |
| **Zoom 200%** | Conforme | Layout grid/flex sans valeurs absolues bloquantes. | RAS |

**Score Aegis Light : 7 conformes / 5 partiels / 1 non conforme / 3 N/A sur 16 critères évalués**
**Taux de conformité WCAG critères applicables : ~54%** (7/13 critères applicables pleinement conformes)

---

### 3.2 Thème Midnight Obsidian

**Tokens clés** : `--bg: #0d0d0f` · `--surface: #1a1a1f` · `--surface-2: #232328` · `--fg: #e8e8f0` · `--fg-muted: #8888a0` · `--fg-subtle: #555568` · `--primary: #818cf8` · `--accent: #2563eb` · `--accent-teal: #06b6d4` · `--success: #22c55e` · `--danger: #ef4444` · `--warning: #f59e0b`

**Ratios calculés (fond sombre) :**

| Paire couleur | Valeur hex | Fond | Ratio calculé | Seuil requis |
|---|---|---|---|---|
| `--fg` sur `--bg` | #e8e8f0 / #0d0d0f | noir | **16.8:1** | 4.5:1 |
| `--fg` sur `--surface` | #e8e8f0 / #1a1a1f | gris très sombre | **14.0:1** | 4.5:1 |
| `--fg-muted` sur `--surface` | #8888a0 / #1a1a1f | gris très sombre | **4.8:1** | 4.5:1 |
| `--fg-muted` sur `--bg` | #8888a0 / #0d0d0f | noir | **5.7:1** | 4.5:1 |
| `--fg-subtle` sur `--surface` | #555568 / #1a1a1f | gris très sombre | **2.4:1** | 4.5:1 (**ECHEC**) |
| `--fg-subtle` sur `--bg` | #555568 / #0d0d0f | noir | **2.9:1** | 4.5:1 (**ECHEC**) |
| `--primary` (#818cf8) sur `--surface` | #818cf8 / #1a1a1f | gris très sombre | **6.4:1** | 4.5:1 |
| `--accent` (#2563eb) sur `--surface` | #2563eb / #1a1a1f | gris très sombre | **3.8:1** | 4.5:1 (**ECHEC**) |
| `--accent` sur `--bg` | #2563eb / #0d0d0f | noir | **4.6:1** | 4.5:1 |
| `--accent-teal` (#06b6d4) sur `--surface` | #06b6d4 / #1a1a1f | gris très sombre | **8.4:1** | 4.5:1 |
| `--success` (#22c55e) sur `--surface` | #22c55e / #1a1a1f | gris très sombre | **6.7:1** | 4.5:1 |
| `--success` sur `--success-bg` | #22c55e / rgba(34,197,94,.12)≈#1e2421 | vert très sombre | **6.2:1** | 4.5:1 |
| `--danger` (#ef4444) sur `--surface` | #ef4444 / #1a1a1f | gris très sombre | **7.5:1** | 4.5:1 |
| `--warning` (#f59e0b) sur `--surface` | #f59e0b / #1a1a1f | gris très sombre | **9.1:1** | 4.5:1 |
| Blanc (#fff) sur `--accent` (#2563eb) | #fff / #2563eb | bleu | **5.9:1** | 4.5:1 |
| Blanc (#fff) sur `--accent-teal` (#06b6d4) | #fff / #06b6d4 | teal | **3.8:1** | 4.5:1 (**ECHEC** — btn-teal texte blanc) |
| `--fg-muted` sur `--surface-2` | #8888a0 / #232328 | gris sombre | **4.6:1** | 4.5:1 |
| `--fg-subtle` (toast-close) sur `--surface` | #555568 / #1a1a1f | — | **2.4:1** | 3:1 (**ECHEC** — composant UI) |

**Tableau des critères — Midnight Obsidian :**

| Critère WCAG / RGAA | Résultat | Preuve | Action corrective |
|---|---|---|---|
| **1.1.1** Alternatives textuelles | Partiel | SVG gauge avec `aria-label="Score 74"` (sans unité). SVG chart avec `aria-label="Graphique score hebdo"` (sans données). Emojis décoratifs sans `aria-hidden` (🛡, 🔑, ⏱, 🚨, ⚠️). `.onboarding-hero-icon` emoji `<span>` sans attribut. | Même actions qu'Aegis Light. Compléter `aria-label` du gauge : `"Score 74 sur 100"`. |
| **1.3.1** Information et relations | Partiel | Même problème que thème 1 : absence de landmarks HTML5 (`<header>`, `<main>`, `<nav>`, `<footer>`). Pas de `<h1>`. `.demo-section-header` sont des `<div>` stylisés, pas des `<h2>`. | Ajouter landmarks. Utiliser balises de titre sémantiques. |
| **1.3.3** Caractéristiques sensorielles | Conforme | Texte de statut combiné à la couleur. | RAS |
| **1.4.1** Utilisation de la couleur | Partiel | Les points de statut module (`.chip-dot on/off/warn`) reposent uniquement sur la couleur sans label ni icône. | Ajouter label accessible sur chaque état. |
| **1.4.3** Contraste texte normal (4.5:1) | Non conforme | `--fg-subtle` (#555568) sur `--surface` (#1a1a1f) : **2.4:1** (ECHEC critique). Utilisé pour le texte "Aucune donnée transmise" dans le consentement M7, le `toast-close`, les labels secondaires. Blanc sur `--accent-teal` (#06b6d4) pour `.btn-teal` : **3.8:1** (ECHEC) — bouton primaire principal "Voir le tableau de bord" et "Commencer". `--fg-muted` (#8888a0) sur `--surface-2` (#232328) : 4.6:1 (limite, conforme). | `--fg-subtle` : passer à #7a7a96 minimum (4.5:1 sur `--surface`). Blanc sur btn-teal : passer le fond à #048fa6 (ratio 4.6:1) ou utiliser du texte sombre. |
| **1.4.4** Redimensionnement du texte | Conforme | Layout flex/grid adaptatif. Pas de `overflow:hidden` bloquant sur le texte. | RAS |
| **1.4.11** Contraste composants UI (3:1) | Partiel | `.toggle-track` fond `--border` (#2e2e38) sur `--surface` (#1a1a1f) : **1.6:1** (ECHEC). `.quota-track` fond `rgba(255,255,255,.07)` ≈ #1e1e24 sur `--surface` : **1.1:1** (ECHEC critique). Focus outline 3px `--accent` (#2563eb) sur `--surface` : 3.8:1 (ECHEC — inférieur à 3:1 non, mais insuffisant pour fond surface-2 #232328 : 3.4:1). | Renforcer bords de toggles. Passer la piste de quota à un fond au ratio ≥ 3:1 sur la surface. |
| **2.1.1** Navigation clavier | Partiel | Même problème que thème 1 : toggles en `<div>` non focalisables. Pas de skip link. Les `.opt-nav` ont `:focus-visible` correct. | Convertir toggles en `<button role="switch">`. Ajouter skip link. |
| **2.4.3** Ordre de focus | Conforme | Pas de `tabindex` positif. | RAS |
| **2.4.7** Focus visible | Partiel | `:focus-visible { outline: 3px solid var(--accent); }` sur `.btn`, `.opt-nav`, `.theme-tab`. `--accent` (#2563eb) sur `--surface` (#1a1a1f) : 3.8:1 (conforme 3:1 pour composants UI). `--accent` sur `--surface-2` (#232328) : 3.4:1 (conforme). Sur `--bg` (#0d0d0f) : 4.6:1 (conforme). Mais `toast-close` n'a pas de `:focus-visible` défini. | Ajouter `:focus-visible` sur `.toast-close`. |
| **3.3.1** Identification des erreurs | N/A | Maquette statique. | À implémenter en dev. |
| **3.3.2** Étiquettes / instructions | Partiel | `.theme-tabs` avec `role="group" aria-label="Sélection du thème"` (conforme). `aria-pressed` présent sur tous les boutons de thème (conforme — c'est le thème le plus avancé). Checkbox M7 avec `for="m7-obsidian"` (conforme). Toggles modules : pas d'`aria-label` ni de `role`. | Ajouter `aria-label` et `role="switch"` sur les toggles. |
| **4.1.2** Nom, rôle, valeur | Partiel | `.toggle-track` : `<div>` sans rôle ni état. `.opt-nav.active` n'a pas d'`aria-current="page"` ni `aria-selected`. | Même corrections que thème 1. Ajouter `aria-current="page"` sur le nav-item actif. |
| **RGAA — Couleurs** | Partiel | Voir 1.4.1 et 1.4.3. Risque daltonisme : distinction teal/vert uniquement par couleur. | Voir actions correspondantes. |
| **RGAA — Formulaires** | Partiel | Checkbox M7 label associé OK. Toggles sans rôle formulaire. | Voir actions 4.1.2. |
| **prefers-reduced-motion** | Conforme | `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }` présent. | RAS |
| **Zoom 200%** | Conforme | Layout adaptatif. | RAS |

**Score Midnight Obsidian : 6 conformes / 5 partiels / 2 non conformes / 3 N/A sur 16 critères évalués**
**Taux de conformité WCAG critères applicables : ~46%** (6/13 critères applicables pleinement conformes)

---

### 3.3 Thème Cyberpunk Neon

**Tokens clés** : `--bg: #0a0a14` · `--surface: #0e0e1c` · `--surface-2: #14142a` · `--fg: #e8e8ff` · `--fg-muted: #8888cc` · `--fg-subtle: #444480` · `--neon-cyan: #00d4ff` · `--neon-mag: #ff2d78` · `--neon-gold: #ffd700` · `--neon-green: #00ff87`

**Ratios calculés (fond sombre) :**

| Paire couleur | Valeur hex | Fond | Ratio calculé | Seuil requis |
|---|---|---|---|---|
| `--fg` sur `--bg` | #e8e8ff / #0a0a14 | noir bleuté | **18.8:1** | 4.5:1 |
| `--fg` sur `--surface` | #e8e8ff / #0e0e1c | noir bleuté | **17.2:1** | 4.5:1 |
| `--fg-muted` sur `--surface` | #8888cc / #0e0e1c | noir bleuté | **7.0:1** | 4.5:1 |
| `--fg-muted` sur `--surface-2` | #8888cc / #14142a | noir bleuté | **6.6:1** | 4.5:1 |
| `--fg-subtle` sur `--surface` | #444480 / #0e0e1c | noir bleuté | **2.9:1** | 4.5:1 (**ECHEC**) |
| `--fg-subtle` sur `--bg` | #444480 / #0a0a14 | noir bleuté | **3.2:1** | 4.5:1 (**ECHEC**) |
| `--neon-cyan` sur `--surface` | #00d4ff / #0e0e1c | noir bleuté | **14.2:1** | 4.5:1 |
| `--neon-mag` sur `--surface` | #ff2d78 / #0e0e1c | noir bleuté | **6.8:1** | 4.5:1 |
| `--neon-gold` sur `--surface` | #ffd700 / #0e0e1c | noir bleuté | **19.2:1** | 4.5:1 |
| `--neon-green` sur `--surface` | #00ff87 / #0e0e1c | noir bleuté | **16.7:1** | 4.5:1 |
| `--fg-muted` (toast-close) sur `--surface` | #8888cc / #0e0e1c | — | **7.0:1** | 3:1 (UI) |
| `--fg-subtle` (toast-close hover) sur `--surface` | #444480 / #0e0e1c | — | **2.9:1** | 3:1 (**ECHEC** — état normal) |
| Labels axe SVG chart : #444480 sur #0a0a14 | — | noir | **3.2:1** | 4.5:1 texte (**ECHEC** si < 18pt) |
| `--fg-muted` sur `--border-dim` (#1e1e3f) zone consent | #8888cc / #1e1e3f | violet sombre | **5.8:1** | 4.5:1 |
| `--neon-mag` sur `--surface-2` (step-badge) | #ff2d78 / #14142a | — | **6.5:1** | 4.5:1 |
| Blanc (checkbox 18×18px) sur `--bg` | — | — | N/A — taille cible < 24px CSS | Taille cible 44×44px |

**Tableau des critères — Cyberpunk Neon :**

| Critère WCAG / RGAA | Résultat | Preuve | Action corrective |
|---|---|---|---|
| **1.1.1** Alternatives textuelles | Partiel | `aria-hidden="true"` sur `.cyber-grid` (conforme). SVG chart avec `aria-label="Graphique tendance hebdo"` sans données. Emojis (🛡, 🔑, ⏱, 🚨) sans `aria-hidden`. Icône popup `<div class="popup-header-icon">🛡</div>` sans attribut. | Ajouter `aria-hidden="true"` sur les emojis décoratifs. |
| **1.3.1** Information et relations | Partiel | Absence de landmarks HTML5 (`<header>`, `<main>`, `<nav>`). Pas de `<h1>`. Les titres de section sont `<div>` stylisés. `.demo-page-title` est un `<div>`, pas un `<h1>`. Seuls `<h2>` dans le contenu onboarding. | Même corrections que les deux thèmes précédents. |
| **1.3.3** Caractéristiques sensorielles | Conforme | Texte de statut combiné à la couleur. | RAS |
| **1.4.1** Utilisation de la couleur | Non conforme | Les points de statut module (`.chip-dot on/off/warn`) reposent uniquement sur la couleur. De plus, les bordures de toast (`rgba(0,212,255,.30)` / `rgba(255,215,0,.30)` / `rgba(0,255,135,.30)`) et le titre coloré sont les seuls différenciateurs des types de toast — le fond et la structure sont identiques. Risque élevé pour daltoniens protanopes (magenta/vert). | Ajouter icônes ou texte de catégorie visible sur les toasts. Ajouter label d'état texte sur les chips modules. |
| **1.4.3** Contraste texte normal (4.5:1) | Non conforme | `--fg-subtle` (#444480) sur `--surface` (#0e0e1c) : **2.9:1** (ECHEC). Utilisé pour "Aucune donnée transmise" dans consent M7, et pour les labels subtils. Labels SVG chart (#444480 sur #0a0a14) : **3.2:1** (ECHEC pour texte 9px). | `--fg-subtle` : passer à #6868a8 (≥ 4.5:1 sur surface). Labels SVG : couleur #8888cc (7.0:1). |
| **1.4.4** Redimensionnement du texte | Conforme | Layout flex adaptatif. Pas de `overflow:hidden` bloquant. | RAS |
| **1.4.11** Contraste composants UI (3:1) | Non conforme | `.toggle-track` fond `--border-dim` (#1e1e3f) sur `--surface` (#0e0e1c) : **1.7:1** (ECHEC grave). `.quota-track` fond `var(--gauge-track)` ≈ rgba(255,255,255,.06) sur `--surface` : **1.1:1** (ECHEC grave). Checkbox consent `width:18px; height:18px` sous la taille minimale de 24×24px (WCAG 2.5.8 AA, non évalué ici mais noté). `.btn-secondary` border `--border-dim` (#1e1e3f) sur `--surface` : **1.7:1** (ECHEC — bordure bouton non perceptible). | Renforcer le `--border-dim` pour les contrôles. Recommander au minimum #2e2e5a. Augmenter la taille de la checkbox à 20×20px minimum. |
| **2.1.1** Navigation clavier | Partiel | `:focus-visible` sur `.btn`, `.opt-nav`, `.theme-btn` (conforme). Toggles en `<div>` non focalisables. Pas de skip link. `.module-chip` avec `:hover` mais sans `:focus-visible` ni rôle interactif. | Même corrections que les thèmes précédents. |
| **2.4.3** Ordre de focus | Conforme | Pas de `tabindex` positif. | RAS |
| **2.4.7** Focus visible | Conforme | `outline: 2px solid var(--neon-cyan); outline-offset: 3px` + `box-shadow: var(--glow-cyan)` sur `:focus-visible`. Cyan (#00d4ff) sur surface (#0e0e1c) : 14.2:1 — très conforme. | RAS |
| **3.3.1** Identification des erreurs | N/A | Maquette statique. | À implémenter en dev. |
| **3.3.2** Étiquettes / instructions | Partiel | `.theme-selector` avec `role="group" aria-label="Sélection du thème"` (conforme). `aria-pressed` sur tous les boutons de thème (conforme). Checkbox M7 avec `for="m7-cyber"` (conforme). Toggles modules sans `aria-label` ni `role`. | Ajouter `role="switch" aria-checked aria-label` sur les toggles. |
| **4.1.2** Nom, rôle, valeur | Partiel | `.toggle-track` : `<div>` sans rôle. `.opt-nav.active` sans `aria-current`. `.toast-close` : `aria-label="Fermer"` présent (conforme). | Même corrections que thèmes précédents. |
| **RGAA — Couleurs** | Non conforme | Voir 1.4.1, 1.4.3, 1.4.11. Risque daltonisme protanopie/deutéranopie fort (magenta vs vert seuls différenciateurs sur fond très sombre). | Voir actions correspondantes. |
| **RGAA — Formulaires** | Partiel | Checkbox M7 label associé OK. Taille cible checkbox : 18×18px (insuffisant). Toggles sans rôle. | Augmenter la taille à 20×20px minimum, 44×44px pour la cible tactile. |
| **prefers-reduced-motion** | Conforme | `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } body::before { display: none; } }` présent. Les scanlines CSS (`body::before`) sont désactivées. | RAS |
| **Zoom 200%** | Conforme | Layout flex adaptatif. | RAS |

**Score Cyberpunk Neon : 6 conformes / 5 partiels / 4 non conformes / 2 N/A sur 17 critères évalués**
**Taux de conformité WCAG critères applicables : ~40%** (6/15 critères applicables pleinement conformes)

---

## 4. Synthèse globale

### 4.1 Scores de conformité par thème

| Thème | Conformes | Partiels | Non conformes | N/A | Critères applicables | Taux AA |
|---|---|---|---|---|---|---|
| Aegis Light | 7 | 5 | 1 | 3 | 13 | **54%** |
| Midnight Obsidian | 6 | 5 | 2 | 3 | 13 | **46%** |
| Cyberpunk Neon | 6 | 5 | 4 | 2 | 15 | **40%** |
| **Global moyen** | — | — | — | — | — | **~47%** |

Note : les critères "Partiels" sont comptabilisés à 0 dans le taux (principe conservateur RGAA). En conformité partielle, ils nécessitent correction avant déclaration AA.

### 4.2 Anomalies par sévérité et fréquence

| Anomalie | Sévérité | Thèmes affectés | Critère |
|---|---|---|---|
| Absence de landmarks HTML5 (`<main>`, `<nav>`, `<header>`) | Critique | 3/3 | 1.3.1 / RGAA nav |
| Absence de `<h1>` — hiérarchie de titres brisée | Critique | 3/3 | 1.3.1 |
| Toggles `<div>` non focalisables et sans rôle ARIA | Critique | 3/3 | 2.1.1 / 4.1.2 |
| Emojis décoratifs sans `aria-hidden` | Majeure | 3/3 | 1.1.1 |
| `--fg-subtle` sous 4.5:1 sur fond de surface | Critique | 3/3 | 1.4.3 |
| Bords de contrôles (toggle, quota bar, btn) sous 3:1 | Majeure | 3/3 | 1.4.11 |
| Points de statut module couleur-only | Majeure | 3/3 | 1.4.1 |
| Absence de skip link ("Aller au contenu") | Majeure | 3/3 | 2.1.1 |
| SVG charts sans description des données | Mineure | 3/3 | 1.1.1 |
| `prefers-reduced-motion` absent | Majeure | 1/3 (Aegis Light) | — |
| Blanc sur `--accent-teal` sous 4.5:1 (btn-teal) | Critique | 1/3 (Obsidian) | 1.4.3 |
| `--accent` (#2563eb) sur surface sombre sous 4.5:1 | Critique | 1/3 (Obsidian) | 1.4.3 |
| `--accent` sur `--accent-light` sous 4.5:1 (état actif nav) | Critique | 1/3 (Aegis) | 1.4.3 |
| `--success`/`--danger` sur fond coloré sous 4.5:1 (badges) | Majeure | 1/3 (Aegis) | 1.4.3 |
| Différenciation toast uniquement par couleur | Majeure | 1/3 (Cyberpunk) | 1.4.1 |
| Labels SVG chart en couleur sous seuil (9px) | Mineure | 1/3 (Cyberpunk) | 1.4.3 |
| Taille checkbox < 24px | Mineure | 1/3 (Cyberpunk) | (2.5.8 AA 2.2) |
| `toast-close` sans `:focus-visible` | Mineure | 1/3 (Obsidian) | 2.4.7 |
| `aria-pressed` absent sur boutons thème (sauf actif) | Mineure | 1/3 (Aegis) | 4.1.2 |

### 4.3 Comptage par sévérité

| Sévérité | Nombre d'anomalies distinctes |
|---|---|
| Critique (bloquant AA) | 7 |
| Majeure (non conforme AA) | 8 |
| Mineure (amélioration AA ou AAA) | 5 |
| **Total** | **20** |

---

## 5. Recommandations

### Priorité Must (bloquant pour conformité WCAG 2.1 AA — à corriger avant production)

**M-001 — Landmarks HTML5 + hiérarchie titres (tous thèmes)**
Envelopper le contenu dans `<header>`, `<main>`, `<nav>` (sidebar, navigation options). Ajouter un `<h1>` de page. Remplacer les `<div class="demo-section-header">` par des `<h2>`. Les `<h2>` internes au popup/onboarding restent en `<h2>` ou passent en `<h3>` selon la hiérarchie rectifiée.
Critères : WCAG 1.3.1, RGAA 12.6.

**M-002 — Toggles interactifs accessibles (tous thèmes)**
Remplacer les `<div class="toggle-track">` par `<button role="switch" aria-checked="true|false" aria-label="[Nom du module]">`. Le thumb visuel reste en CSS. Cible tactile : 44×44px minimum.
Critères : WCAG 2.1.1, 4.1.2, RGAA 7.1.

**M-003 — Corriger `--fg-subtle` sous seuil (tous thèmes)**
- Aegis Light : `--fg-subtle` #8a9eb0 → au minimum **#6b8099** (4.6:1 sur blanc)
- Midnight Obsidian : `--fg-subtle` #555568 → au minimum **#7a7a96** (4.5:1 sur #1a1a1f)
- Cyberpunk Neon : `--fg-subtle` #444480 → au minimum **#6868a8** (4.5:1 sur #0e0e1c)
Si ce texte est purement décoratif (non porteur de sens), lui appliquer `aria-hidden="true"` pour l'exclure du critère.
Critères : WCAG 1.4.3.

**M-004 — Corriger les accents sous seuil (thèmes Aegis et Obsidian)**
- Aegis : `--accent` (#2e6da4) sur `--accent-light` (#dbeeff) pour le texte de l'item de nav actif : foncer le texte à #1d5083 ou assombrir `--accent-light` à #c5dff5. Ratio cible ≥ 4.5:1.
- Aegis : `--success` sur `--success-bg` badge "Vu" : foncer success à **#155f39** (4.6:1).
- Aegis : `--danger` sur `--danger-bg` : foncer danger à **#a52f22** (4.6:1).
- Obsidian : blanc sur `--accent-teal` (#06b6d4) pour `.btn-teal` : foncer le fond à **#048fa6** (4.6:1) ou changer la couleur du texte.
- Obsidian : `--accent` (#2563eb) utilisé comme fond de bouton sur surface : vérifier que seul `btn-primary` (blanc sur bleu) est concerné — ratio 5.9:1, conforme. Surveiller tout usage de `--accent` en couleur de texte sur surface sombre.
Critères : WCAG 1.4.3.

**M-005 — `aria-hidden` sur emojis décoratifs + aria-label SVG gauge (tous thèmes)**
Ajouter `aria-hidden="true"` sur tous les emojis utilisés comme icônes décoratives. Compléter les `aria-label` des SVG gauge : `aria-label="Score de cyber-hygiène : 74 sur 100"`.
Critères : WCAG 1.1.1, RGAA 1.1.

**M-006 — Ajouter `prefers-reduced-motion` (Aegis Light uniquement)**
Ajouter en fin de CSS :
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```
Critères : WCAG 2.3.3 (AAA, mais bonne pratique recommandée en AA).

### Priorité Should (important, à traiter avant v1 finale)

**S-001 — Contraste des composants UI (bords de contrôles) (tous thèmes)**
Les bords de `toggle-track` et `quota-track` doivent atteindre 3:1 sur leur fond. Utiliser des valeurs de bordure plus contrastées ou des ombres portées.
Critères : WCAG 1.4.11.

**S-002 — Skip link ("Aller au contenu principal") (tous thèmes)**
Ajouter en première balise du `<body>` un lien de contournement : `<a href="#main-content" class="sr-only-focusable">Aller au contenu</a>`. Cibler la balise `<main id="main-content">`.
Critères : WCAG 2.4.1, RGAA 12.7.

**S-003 — Statut des modules non distinguable sans couleur (tous thèmes)**
Ajouter une icône ou un texte de label d'état à côté du point coloré dans chaque `.module-chip` (ex : "Actif", "Inactif", "Attention"). Ou utiliser une icône avec `aria-label`.
Critères : WCAG 1.4.1, RGAA 3.1.

**S-004 — `aria-current` sur l'item de navigation actif (tous thèmes)**
Ajouter `aria-current="page"` sur le bouton de navigation actif dans la sidebar options.
Critères : WCAG 4.1.2, RGAA 7.3.

**S-005 — SVG charts : enrichir les alternatives (tous thèmes)**
Ajouter un `<title>` et/ou `<desc>` dans chaque SVG de graphique décrivant les données (ex : "Score de 65 lundi à 74 dimanche, progression régulière"). Ou fournir un tableau de données accessible masqué visuellement.
Critères : WCAG 1.1.1, RGAA 1.6.

**S-006 — Différenciation des toasts (Cyberpunk Neon)**
Les 3 toasts ne sont différenciés que par la couleur de bordure. Ajouter un label de catégorie textuel visible (ex : un badge "ALERTE", "INFO", "OK") ou renforcer la différence structurelle.
Critères : WCAG 1.4.1.

### Priorité Could (amélioration complémentaire)

**C-001 — `aria-pressed` cohérent sur les boutons de thème (Aegis Light)**
Les 3 boutons non sélectionnés manquent d'`aria-pressed="false"`. À normaliser avec le pattern des deux autres thèmes.

**C-002 — Descriptions des graphiques SVG (tous thèmes)**
Au-delà d'un `aria-label`, envisager un bouton "Voir les données en tableau" pour les graphiques de tendance.

**C-003 — Taille cible checkbox (Cyberpunk Neon)**
La checkbox de consentement M7 a une taille de 18×18px CSS. La recommandation WCAG 2.5.8 (AA dans WCAG 2.2) est 24×24px. Passer à 20×20px minimum, 44×44px pour la cible tactile complète (zone cliquable).

**C-004 — Labels axis SVG chart en Cyberpunk Neon**
Les labels de jours (LUN, MAR…) en `fill="#444480"` ont un ratio de 2.9:1 sur le fond #0a0a14. S'ils sont porteurs de sens, passer à `fill="#8888cc"` (7.0:1).

**C-005 — `role="group"` sur la sélection de thème Aegis Light**
Le conteneur `.theme-selector` de l'Aegis Light n'a pas de `role="group" aria-label="..."` contrairement aux deux autres thèmes.

---

## 6. Historique des révisions

| Version | Date | Auteur | Objet |
|---|---|---|---|
| v1.0 | 2026-04-20 | Expert accessibilité — La Fabrique | Audit initial T-145 — 3 maquettes design system v1 |
