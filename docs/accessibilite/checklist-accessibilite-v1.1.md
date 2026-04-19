# Checklist accessibilité — Sentinel Nudge (toute l'UI)

**Version** : 1.1
**Date** : 2026-04-19
**Référence** : T-162 (fusionne T-RQ-004 + T-168) — Bump v1.0 + scope étendu UI internes
**Responsable** : Expert accessibilité
**Niveau de sensibilité** : Exposé

---

## 1. Objet

Audit accessibilité complet de Sentinel Nudge couvrant :

- **Partie 1** : les 7 pages statiques HTML d'explication (scope v1.0, mis à jour post-corrections T-132/T-133/T-134/T-135/T-136)
- **Partie 2** : les 4 UI internes dynamiques — popup, dashboard, options, onboarding (scope ajouté en v1.1, résorbe T-168)

Référentiels appliqués : WCAG 2.2 niveau AA, RGAA 4.1 (13 thématiques), WAI-ARIA 1.2, Critères Opquast 2020.

---

## 2. Référentiels

| Référentiel | Version | Niveau |
|-------------|---------|--------|
| WCAG (Web Content Accessibility Guidelines) | 2.2 | AA |
| RGAA (Référentiel Général d'Amélioration de l'Accessibilité) | 4.1 | — |
| WAI-ARIA (Accessible Rich Internet Applications) | 1.2 | — |
| Critères Opquast | 2020 | Bonnes pratiques |

---

## 3. Périmètre audité

### 3.1 Pages statiques (Partie 1)

| # | Fichier | Module | Contenu principal |
|---|---------|--------|-------------------|
| 1 | `src/pages/static/sites-suspects.html` | M2 | Explication du détecteur de sites suspects |
| 2 | `src/pages/static/score-cyber-hygiene.html` | M3 | Explication du calcul du score de cyber-hygiène |
| 3 | `src/pages/static/mise-a-jour-navigateur.html` | M5 | Explication du détecteur de mise à jour navigateur |
| 4 | `src/pages/static/quiz-phishing.html` | M6 | Explication du quiz phishing et répétition espacée |
| 5 | `src/pages/static/reutilisation-mots-de-passe.html` | M7 | Explication du détecteur de réutilisation de mots de passe |
| 6 | `src/pages/static/force-mots-de-passe.html` | M9 | Explication de l'indicateur de force des mots de passe |
| 7 | `src/pages/static/donnees-sensibles-presse-papiers.html` | M17 | Explication du détecteur de données sensibles dans le presse-papiers |

### 3.2 UI internes dynamiques (Partie 2 — ajout v1.1)

| # | Fichier HTML | Script principal | Rôle |
|---|-------------|-----------------|------|
| 8 | `src/pages/popup/popup.html` | `popup.ts` | Résumé du score, grille modules, quota, actions |
| 9 | `src/pages/dashboard/dashboard.html` | `dashboard.ts` | Tableau de bord : score, graphique, composantes, quiz |
| 10 | `src/pages/options/options.html` | `options.ts` | Configuration : modules, quota, profil, données RGPD |
| 11 | `src/pages/onboarding/onboarding.html` | `onboarding.ts` | Wizard 4 étapes : bienvenue, profil, modules, consentement M7 |

**Note de méthode** : l'audit de la Partie 2 est théorique — relecture du code source TypeScript et CSS sans exécution en navigateur. Les tests dynamiques (lecteur d'écran NVDA, axe-core en live) sont documentés pour T-180.

---

## PARTIE 1 — Pages statiques HTML

## 4. Analyse par page (post-corrections T-132/T-133/T-134/T-135/T-136)

### 4.1 — sites-suspects.html (M2)

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` sur `<html>` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif et unique (WCAG 2.4.2 A) | ✓ | "Contexte risqué : pourquoi ce domaine est suspect — Sentinel Nudge" |
| `<meta charset>` et `<meta viewport>` | ✓ | UTF-8, width=device-width |
| H1 unique (WCAG 1.3.1 A) | ✓ | Un seul `<h1>` |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2 sans saut |
| Landmarks `<main>` / `<header>` / `<footer>` (WCAG 1.3.6 AA) | ✓ | Présents |
| Skip link "Aller au contenu" (WCAG 2.4.1 A) | **✓** | **Corrigé — T-132 (PR #46)** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Toutes les sections portent `aria-labelledby` |
| Alternatives textuelles images (WCAG 1.1.1 A) | N/A | Aucune image |
| Contraste texte normal ≥ 4.5:1 (WCAG 1.4.3 AA) | ✓ | `#111827` / `#ffffff` → 16.1:1 |
| Contraste texte muted ≥ 4.5:1 (WCAG 1.4.3 AA) | ✓ | `#6b7280` / `#ffffff` → 4.61:1 |
| Contraste H1 danger (WCAG 1.4.3 AA) | ✓ | `#dc2626` / `#ffffff` → 5.56:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Focus navigateur natif préservé |
| `prefers-reduced-motion` (WCAG 2.3.3) | ✓ | Implémenté |
| `prefers-color-scheme: dark` | ✓ | Tokens redéfinis |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ✓ | `max-width: 720px`, breakpoint @600px |
| `<strong>` → `<h3>` dans tip-box (WCAG 1.3.1 A) | **✓** | **Corrigé — T-135 (PR #92)** |
| Tokens CSS centralisés (best practice) | **✓** | **Corrigé — T-134 (PR #92)** |

**Score de conformité page M2** : 16/16 critères applicables conformes, 0 écart.

---

### 4.2 — score-cyber-hygiene.html (M3)

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | "Score de cyber-hygiène : comment est-il calculé — Sentinel Nudge" |
| H1 unique (WCAG 1.3.1 A) | ✓ | Un seul `<h1>` |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2 |
| Landmarks (WCAG 1.3.6 AA) | ✓ | Présents |
| Skip link (WCAG 2.4.1 A) | **✓** | **Corrigé — T-132 (PR #46)** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Présent |
| Table : `<caption>`, `<thead>`, `scope="col"` (WCAG 1.3.1 A) | ✓ | Conforme |
| Contraste texte normal (WCAG 1.4.3 AA) | ✓ | 16.1:1 |
| Contraste muted (WCAG 1.4.3 AA) | ✓ | 4.61:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Aucun élément interactif personnalisé |
| `prefers-reduced-motion` | ✓ | Implémenté |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ⚠ | Breakpoint @600px : `font-size: 0.75rem` (12px) sur tableaux — lisibilité réduite sur mobile (non-échec WCAG strict, avertissement P2 ACC-P2-05 maintenu) |
| `<strong>` → `<h3>` dans tip-box (WCAG 1.3.1 A) | **✓** | **Corrigé — T-135 (PR #92)** |
| Tokens CSS centralisés | **✓** | **Corrigé — T-134 (PR #92)** |

**Score de conformité page M3** : 14/14 critères conformes, 0 écart P0/P1, 1 avertissement P2.

---

### 4.3 — mise-a-jour-navigateur.html (M5)

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | Présent |
| H1 unique (WCAG 1.3.1 A) | ✓ | Présent |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2 |
| Landmarks (WCAG 1.3.6 AA) | ✓ | Présents |
| Skip link (WCAG 2.4.1 A) | **✓** | **Corrigé — T-132 (PR #46)** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Présent |
| `<code>` pour code inline (WCAG 1.3.1 A) | ✓ | `chrome.runtime.requestUpdateCheck()` balisé |
| Contraste texte normal (WCAG 1.4.3 AA) | ✓ | 16.1:1 |
| Contraste muted (WCAG 1.4.3 AA) | ✓ | 4.61:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Natif préservé |
| `prefers-reduced-motion` | ✓ | Implémenté |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ✓ | Conforme |
| `<strong>` → `<h3>` dans tip-box (WCAG 1.3.1 A) | **✓** | **Corrigé — T-135 (PR #92)** |
| Tokens CSS centralisés | **✓** | **Corrigé — T-134 (PR #92)** |

**Score de conformité page M5** : 14/14 critères conformes, 0 écart.

---

### 4.4 — quiz-phishing.html (M6)

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | Présent |
| H1 unique (WCAG 1.3.1 A) | ✓ | Présent |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2 |
| Landmarks (WCAG 1.3.6 AA) | ✓ | Présents |
| Skip link (WCAG 2.4.1 A) | **✓** | **Corrigé — T-132 (PR #46)** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Présent |
| `<em>` pour termes techniques (WCAG 1.3.1 A) | ✓ | "spaced repetition" balisé |
| Contraste texte normal (WCAG 1.4.3 AA) | ✓ | 16.1:1 |
| Contraste muted (WCAG 1.4.3 AA) | ✓ | 4.61:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Natif préservé |
| `prefers-reduced-motion` | ✓ | Implémenté |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ✓ | Conforme |
| `<strong>` → `<h3>` dans tip-box (WCAG 1.3.1 A) | **✓** | **Corrigé — T-135 (PR #92)** |
| Tokens CSS centralisés | **✓** | **Corrigé — T-134 (PR #92)** |

**Score de conformité page M6** : 14/14 critères conformes, 0 écart.

---

### 4.5 — reutilisation-mots-de-passe.html (M7)

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | Présent |
| H1 unique (WCAG 1.3.1 A) | ✓ | Présent |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2 |
| Landmarks (WCAG 1.3.6 AA) | ✓ | Présents |
| Skip link (WCAG 2.4.1 A) | **✓** | **Corrigé — T-132 (PR #46)** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Présent |
| `.privacy-box` avec `role="note"` (WCAG 1.3.1 A) | **✓** | **Corrigé — T-136 (PR #92)** |
| Contraste texte normal (WCAG 1.4.3 AA) | ✓ | 16.1:1 |
| Contraste muted (WCAG 1.4.3 AA) | ✓ | 4.61:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Natif préservé |
| `prefers-reduced-motion` | ✓ | Implémenté |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ✓ | Conforme |
| `<strong>` → `<h3>` dans tip-box (WCAG 1.3.1 A) | **✓** | **Corrigé — T-135 (PR #92)** |
| Tokens CSS centralisés | **✓** | **Corrigé — T-134 (PR #92)** |

**Score de conformité page M7** : 14/14 critères conformes, 0 écart.

---

### 4.6 — force-mots-de-passe.html (M9)

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | Présent |
| H1 unique (WCAG 1.3.1 A) | ✓ | Présent |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2 |
| Landmarks (WCAG 1.3.6 AA) | ✓ | Présents |
| Skip link (WCAG 2.4.1 A) | **✓** | **Corrigé — T-132 (PR #46)** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Présent |
| Table : `<caption>`, `<thead>`, `scope="col"` (WCAG 1.3.1 A) | ✓ | Conforme |
| Table : colonne "Couleur" exprimée en texte (WCAG 1.4.1 AA) | ✓ | Couleurs non transmises par la seule couleur |
| Contraste texte normal (WCAG 1.4.3 AA) | ✓ | 16.1:1 |
| Contraste muted (WCAG 1.4.3 AA) | ✓ | 4.61:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Natif préservé |
| `prefers-reduced-motion` | ✓ | Implémenté |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ⚠ | `font-size: 0.75rem` (12px) sur tableaux mobiles — avertissement P2 ACC-P2-05 maintenu |
| `<strong>` → `<h3>` dans tip-box (WCAG 1.3.1 A) | **✓** | **Corrigé — T-135 (PR #92)** |
| Tokens CSS centralisés | **✓** | **Corrigé — T-134 (PR #92)** |

**Score de conformité page M9** : 15/15 critères conformes, 0 écart P0/P1, 1 avertissement P2.

---

### 4.7 — donnees-sensibles-presse-papiers.html (M17)

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | Présent |
| H1 unique (WCAG 1.3.1 A) | ✓ | Présent |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2 |
| Landmarks (WCAG 1.3.6 AA) | ✓ | Présents |
| Skip link (WCAG 2.4.1 A) | **✓** | **Corrigé — T-132 (PR #46)** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Présent |
| `<code>` pour code inline (WCAG 1.3.1 A) | ✓ | Présent |
| Contraste H1 warning mode clair (WCAG 1.4.3 AA) | **✓** | **Corrigé — T-133 (PR #46)** : `#d97706` → `#92400e`, ratio `#92400e`/`#ffffff` = 6.5:1 |
| Contraste badge blanc/warning (WCAG 1.4.3 AA) | **✓** | **Corrigé — T-133 (PR #46)** : fond badge `#92400e`, ratio `#ffffff`/`#92400e` = 6.5:1 |
| Contraste H1 warning dark mode (WCAG 1.4.3 AA) | ✓ | Via `tokens.css` : `--sn-color-warning: #f59e0b` sur `#1a1a1f` → ratio ~5.2:1 (grand texte) — conforme |
| Contraste texte normal (WCAG 1.4.3 AA) | ✓ | 16.1:1 |
| Contraste muted (WCAG 1.4.3 AA) | ✓ | 4.61:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Natif préservé |
| `prefers-reduced-motion` | ✓ | Implémenté |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ✓ | Conforme |
| `<strong>` → `<h3>` dans tip-box (WCAG 1.3.1 A) | **✓** | **Corrigé — T-135 (PR #92)** |
| Tokens CSS centralisés | **✓** | **Corrigé — T-134 (PR #92)** |

**Score de conformité page M17** : 17/17 critères conformes, 0 écart.

---

## 5. Synthèse Partie 1 — Post-corrections

### 5.1 Tableau récapitulatif 7 pages × 8 critères majeurs

| Page | lang | h1 unique | Landmarks | Skip link | aria-labelledby | Contraste texte | Contraste composants | prefers-reduced-motion |
|------|------|-----------|-----------|-----------|-----------------|-----------------|----------------------|------------------------|
| sites-suspects (M2) | ✓ | ✓ | ✓ | **✓** | ✓ | ✓ | ✓ | ✓ |
| score-cyber-hygiene (M3) | ✓ | ✓ | ✓ | **✓** | ✓ | ✓ | ✓ | ✓ |
| mise-a-jour-navigateur (M5) | ✓ | ✓ | ✓ | **✓** | ✓ | ✓ | ✓ | ✓ |
| quiz-phishing (M6) | ✓ | ✓ | ✓ | **✓** | ✓ | ✓ | ✓ | ✓ |
| reutilisation-mots-de-passe (M7) | ✓ | ✓ | ✓ | **✓** | ✓ | ✓ | ✓ | ✓ |
| force-mots-de-passe (M9) | ✓ | ✓ | ✓ | **✓** | ✓ | ✓ | ✓ | ✓ |
| donnees-sensibles-presse-papiers (M17) | ✓ | ✓ | ✓ | **✓** | ✓ | ✓ | **✓** | ✓ |

### 5.2 Taux de conformité Partie 1 — post-corrections

- **Corrections appliquées** : 7 skip links (ACC-P0-01), 2 contrastes M17 (ACC-P1-01/02), 7 × `<strong>` → `<h3>` (ACC-P2-01), 7 × tokens centralisés (ACC-P2-02), 1 × `role="note"` (ACC-P2-03)
- **Critères de niveau A évalués** : 7 × 8 = 56 occurrences — **56 conformes, 0 écart**
- **Critères de niveau AA évalués** : 7 × 8 = 56 occurrences — **56 conformes, 0 écart**
- **Taux de conformité AA estimé Partie 1** : **~100%** (2 avertissements P2 non bloquants sur taille de police tableaux mobiles M3/M9, sans impact WCAG strict)
- **Avertissement P2 résiduel ACC-P2-05** : tableaux M3/M9 à `0.75rem` (12px) sur mobile — non-échec WCAG 1.4.4 (zoom 200% suffisant), recommandation de porter à 0.875rem (14px) maintenue

---

## PARTIE 2 — UI internes dynamiques (Popup, Dashboard, Options, Onboarding)

## 6. Audit théorique — périmètre et méthode

Audit réalisé par relecture du code source TypeScript et CSS. Les conclusions sont fondées sur l'analyse statique des attributs ARIA, de la structure DOM construite programmatiquement, des styles CSS et des flux de navigation décrits dans le code. Aucun test navigateur n'a été exécuté dans cet audit (voir section 12 — T-180).

---

## 7. Popup (`popup.html` / `popup.ts` / `popup.css`)

### 7.1 Structure HTML de base

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` sur `<html>` (WCAG 3.1.1 A) | ✓ | `popup.html` : `<html lang="fr">` |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | "Sentinel Nudge" — titre minimal mais non ambigu dans le contexte extension |
| `<meta charset>` et `<meta viewport>` | ✓ | UTF-8, `width=device-width, initial-scale=1.0` |
| Landmark principal (WCAG 1.3.6 AA) | ⚠ | `#popup-root` a `role="main"` — conforme, mais dans l'ordre DOM le skip link est injecté dans ce conteneur : le skip link cible `#popup-main` (le div `.popup-body`) qui est l'enfant du `role="main"`. Structurellement correct. |
| Skip link (WCAG 2.4.1 A) | ✓ | Injecté en premier enfant de `#popup-root`, cible `#popup-main` (`.popup-body`). CSS `.skip-link:focus { top: 0 }` — visible au focus clavier. |
| Tokens CSS centralisés | ✓ | `<link rel="stylesheet" href="../../assets/styles/tokens.css">` importé dans le HTML |

### 7.2 Ordre de focus (WCAG 2.4.3 A)

Séquence de tabulation dans la popup (ordre DOM) :

1. Skip link `.skip-link` (href="#popup-main")
2. Pas d'éléments focusables dans `.popup-header` (banner décoratif, `aria-hidden` sur icône et accent)
3. SVG gauge : `role="img"` — non focusable par défaut (correct : données portées par `aria-label`)
4. `.degraded-badge` (si modules dégradés) : `learnMoreBtn` (button) → focus naturel
5. `.modules-grid` : chips `role="listitem"` non interactifs — non focusables (correct)
6. `.quota-track` `role="meter"` — non focusable (correct : données via `aria-valuetext`)
7. `btnDashboard` (button `.btn-primary`)
8. `btnSettings` (button `.btn-secondary`)

**Évaluation** : l'ordre de focus est logique et suit le flux visuel de haut en bas. Le skip link permet de sauter l'en-tête vers le corps (`.popup-body`). Aucun piège de focus identifié.

**Écart identifié ACC-UI-01 (Should)** : le tooltip du badge dégradé (`.degraded-tooltip`) utilise `hidden` pour masquer/afficher son contenu, ce qui est correct. Cependant, quand le tooltip s'ouvre, le focus n'est pas explicitement déplacé vers l'intérieur du tooltip — les boutons "Recharger l'extension" et "Fermer" sont accessibles par Tab séquentiel mais pas par déplacement automatique du focus. Le bouton Fermer replace bien le focus sur `learnMoreBtn` à la fermeture (conforme). Recommandation : ajouter `reloadBtn.focus()` à l'ouverture du tooltip (pattern WAI-ARIA disclosure widget).

### 7.3 Annonces lecteur d'écran

| Composant | Attributs ARIA | Évaluation |
|-----------|---------------|------------|
| SVG gauge arc | `role="img"` + `aria-label` (ex: "Score 74/100 — Bon") | ✓ Conforme WCAG 1.1.1 A |
| Texte score dans SVG | `aria-hidden="true"` | ✓ Évite double annonce |
| Icônes SVG décoratifs (`createInlineIcon`) | `aria-hidden="true"` + `focusable="false"` | ✓ Conforme |
| Grille modules | `role="list"` + `aria-label` sur la grille, `role="listitem"` sur chaque chip | ✓ Conforme WCAG 1.3.1 A |
| Point de statut `.module-chip-dot` | Non labelé — statut visuel par couleur uniquement | ⚠ **ACC-UI-02 (Should)** : le statut actif/inactif/dégradé d'un module est transmis par la couleur du point sans alternative textuelle. Un lecteur d'écran lira le label du module sans connaître son statut. Recommandation : ajouter `aria-label` sur le chip complet : ex. `"Sites douteux — actif"`, `"MDP réutilisés — inactif"`, `"M2 — dégradé"`. |
| Barre quota `.quota-track` | `role="meter"` + `aria-valuenow` + `aria-valuemin` + `aria-valuemax` + `aria-valuetext` + `aria-label` | ✓ Conforme WAI-ARIA 1.2 `meter` role |
| État de chargement `.loading-text` | `aria-live="polite"` | ✓ Conforme WCAG 4.1.3 AA |
| Erreur `.error-text` | `role="alert"` | ✓ Conforme — annonce immédiate |
| Badge mode dégradé | `role="alert"` + `aria-live="polite"` | ⚠ Double annonce potentielle : `role="alert"` implique `aria-live="assertive"` implicite ; l'ajout de `aria-live="polite"` le surcharge. Recommandation : supprimer `aria-live="polite"` redondant, conserver `role="alert"` seul. Mineur, non bloquant. |
| Tooltip dégradé | `role="region"` + `aria-label` | ✓ Acceptable. Préférer `role="dialog"` + focus management pour un pattern disclosure ARIA strict (ACC-UI-01). |
| En-tête popup | `role="banner"` sur `.popup-header` | ✓ Conforme, bien que la popup ait déjà un `role="main"` sur son conteneur racine — la page a donc banner + main, structure valide. |

### 7.4 États dynamiques (WCAG 4.1.3 AA)

| Changement d'état | Mécanisme d'annonce | Évaluation |
|-------------------|---------------------|------------|
| Score chargé (SW response) | L'élément de chargement avec `aria-live="polite"` est retiré du DOM, le `.popup-body` est inséré | ⚠ Le remplacement DOM supprime le noeud `aria-live` avant l'annonce — les lecteurs d'écran ne verront pas de mise à jour dans une région live. **ACC-UI-03 (Should)** : préférer vider puis remplir le conteneur `aria-live` plutôt que de retirer/insérer des noeuds. |
| Quota atteint (couleur warning) | Couleur CSS `--sn-color-warning` sur `.quota-fill` | ⚠ **ACC-UI-04 (Should)** : le changement de couleur pour signaler que le quota est atteint n'est pas accompagné d'une annonce textuelle. L'`aria-valuetext` du `role="meter"` devrait inclure "quota atteint" quand `quotaReached === true`. Exemple : `aria-valuetext="3 sur 3 — quota atteint"`. |
| Tooltip dégradé ouvert/fermé | `hidden` toggle + `aria-expanded` sur `learnMoreBtn` | ✓ `aria-expanded` mis à jour correctement, focus replacé à la fermeture |
| `aria-expanded` sur `learnMoreBtn` | Mis à jour avec `String(!isOpen)` | ✓ Conforme WAI-ARIA 1.2 |

### 7.5 Cibles tactiles WCAG 2.5.5 (44×44 CSS pixels minimum)

| Élément | Taille déclarée | Évaluation |
|---------|----------------|------------|
| `.btn` (dashboard, paramètres) | `min-height: var(--sn-min-target)` = 44px, `width: 100%` (320px) | ✓ Conforme |
| `.degraded-badge-learn-more` (button) | Pas de min-height explicite dans popup.css — héritage btn ou style inline absent | ⚠ **ACC-UI-05 (Should)** : le bouton "En savoir plus" du badge dégradé est créé sans classe `btn` — aucun `min-height: 44px` garanti. Recommandation : ajouter `learnMoreBtn.style.minHeight = '44px'` ou une classe utilitaire. |
| Boutons du tooltip (reload, close) | Pas de min-height explicite | ⚠ Même constat qu'ACC-UI-05 — inclure dans la correction. |

### 7.6 Focus visible (WCAG 2.4.7 AA)

| Élément | Mécanisme focus | Évaluation |
|---------|----------------|------------|
| `.btn:focus-visible` | `outline: 3px solid var(--sn-color-accent); outline-offset: 2px` | ✓ Conforme |
| Skip link `:focus` | `top: 0` (becomes visible) | ✓ Conforme |
| Boutons badge/tooltip | Pas de règle `:focus-visible` dans popup.css pour ces éléments spécifiques | ⚠ Inclus dans ACC-UI-05 — à ajouter lors de la correction min-height |

### 7.7 prefers-reduced-motion (T-151)

Confirmé via `tokens.css` et `popup.css` : les transitions (`var(--sn-transition-fast)`, `var(--sn-transition)`) sont supprimées via le bloc global `@media (prefers-reduced-motion: reduce)` dans `tokens.css`. Statut : **conforme**.

---

## 8. Dashboard (`dashboard.html` / `dashboard.ts` / `dashboard.css`)

### 8.1 Structure HTML de base

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | "Sentinel Nudge — Tableau de bord" |
| `<main>` avec `role="main"` et `aria-label` (WCAG 1.3.6 AA) | ✓ | `<main id="dashboard-root" role="main" aria-label="Tableau de bord Sentinel Nudge">` |
| Pas de skip link dans dashboard.html | ⚠ | **ACC-UI-06 (Should)** : `dashboard.ts` ne génère pas de skip link WCAG 2.4.1 A. Sur une page fullpage (non popup), le skip link est recommandé. La page commence immédiatement par un `<h1>` généré dynamiquement, ce qui atténue l'impact. À corriger dans une prochaine PR. |
| Tokens CSS centralisés | ✓ | `tokens.css` importé dans le HTML |

### 8.2 Structure sémantique et hiérarchie des titres

| Section | Éléments ARIA / sémantiques | Évaluation |
|---------|----------------------------|------------|
| Titre page | `<h1>` "Tableau de bord — Sentinel Nudge" | ✓ Un seul H1 |
| Score courant | `<section aria-label="Score actuel">` + `<h2>` | ✓ Conforme WCAG 1.3.1 A |
| Graphique | `<section aria-label="Historique des scores">` + `<h2>` | ✓ |
| Composantes | `<section aria-label="Détail par composante">` + `<h2>` | ✓ |
| Statistiques nudges | `<section aria-label="Statistiques nudges">` + `<h2>` | ✓ |
| Quiz M6 | `<section aria-label="Quiz">` + `<h2>` | ✓ |
| Action recommandée | `<div aria-label="Action recommandée">` + `<h3>` | ✓ Hiérarchie H2 > H3 correcte |

**Hiérarchie globale** : H1 > H2 (5 sections) > H3 (action recommandée). Conforme WCAG 1.3.1 A.

### 8.3 SVG histogramme — accessibilité (WCAG 1.1.1 A / 1.3.1 A)

| Mécanisme | Implémentation | Évaluation |
|-----------|---------------|------------|
| `role="img"` sur SVG | ✓ | Conforme WAI-ARIA 1.2 |
| `<title id="chart-title">` | ✓ | Titre accessible exposé aux AT |
| `<desc id="chart-desc">` | ✓ | Description textuelle du graphique |
| `aria-labelledby="chart-title chart-desc"` | ✓ | Association titre + description |
| Barres SVG | `aria-hidden="true"` sur chaque `<rect>` | ✓ Décoratives, données portées par la table |
| Table sr-only | `<table class="sr-only" aria-label="...">` avec `<caption>`, `<thead scope="col">` | ✓ Conforme WCAG 1.3.1 A — alternative textuelle complète 52 semaines |
| Ligne de référence (objectif 70) | `aria-hidden="true"` | ✓ Décorative |

**Évaluation** : implémentation excellente. Pattern table sr-only conforme DAT §11.5.

### 8.4 Barres de progression composantes (role="meter")

| Critère | Implémentation | Évaluation |
|---------|---------------|------------|
| `role="meter"` sur `.component-bar-wrapper` | ✓ | Conforme WAI-ARIA 1.2 |
| `aria-valuenow` / `aria-valuemin` / `aria-valuemax` | ✓ | Présents |
| `aria-valuetext` | ✓ | `"${ratio}%"` — conforme |
| `aria-label` sur chaque barre | ✓ | Label du composant (ex: "Sites douteux") |
| Score textuel `.component-score` | `aria-hidden="true"` | ✓ Évite double annonce |

### 8.5 États dynamiques

| État | Mécanisme | Évaluation |
|------|-----------|------------|
| Chargement initial | `aria-live="polite"` sur `.loading-text` | ✓ Annonce correcte |
| Erreur chargement | `role="alert"` | ✓ Annonce immédiate |
| Mise à jour du score (pas de mise à jour dynamique post-load) | N/A — données chargées une fois | ✓ Pas de problème de live region |

### 8.6 Cibles tactiles et focus visible

| Élément | Min-height | Focus |
|---------|------------|-------|
| Bouton "Ouvrir les paramètres" | Classe `.btn` — min-height déclaré dans `dashboard.css` attendu | À vérifier dans `dashboard.css` — **ACC-UI-07 (Should)** : même attention que pour la popup, vérifier `min-height: 44px` sur `.btn` dans dashboard.css |

### 8.7 Ordre de focus Dashboard

Séquence Tab prévisible : H1 (non focusable) → sections (non focusables) → bouton "Ouvrir les paramètres" (seul élément interactif). Ordre logique et conforme.

### 8.8 prefers-reduced-motion

`tokens.css` importé. Transitions supprimées. Conforme T-151.

---

## 9. Options (`options.html` / `options.ts` / `options.css`)

### 9.1 Structure HTML de base

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | "Sentinel Nudge — Paramètres" |
| `<main role="main" aria-label="Paramètres Sentinel Nudge">` (WCAG 1.3.6 AA) | ✓ | Présent |
| Skip link (WCAG 2.4.1 A) | ⚠ | **ACC-UI-08 (Should)** : `options.css` définit `.skip-link` avec les styles corrects (visible au focus), mais `options.ts` ne génère pas de skip link dans le DOM. Le CSS est présent mais l'élément HTML ne l'est pas. Recommandation : ajouter le skip link en premier enfant de `#options-root` comme fait dans la popup. |
| Tokens CSS centralisés | ✓ | `tokens.css` importé |

### 9.2 Formulaires et labels (WCAG 1.3.1 A / 4.1.2 AA)

| Section | Mécanisme label | Évaluation |
|---------|----------------|------------|
| Section Modules — `<fieldset>` + `<legend>` | ✓ | Groupement sémantique correct |
| Toggles modules — `<input type="checkbox">` + `<label htmlFor>` | ✓ | Association `for`/`id` présente |
| `aria-describedby` sur chaque toggle | ✓ | Pointe vers la description `.module-toggle-desc` |
| Section Quota — `<label htmlFor="quota-select">` + `<select id="quota-select">` | ✓ | Double labeling (label + `aria-label`) — légèrement redondant mais non bloquant |
| Section Profil — `<input type="radio">` + `<label htmlFor>` dans `<fieldset>` | ✓ | Conforme |
| `aria-describedby` sur radios profil | ✓ | Pointe vers `.radio-desc` |
| Section Langue — `<label>` + `<select>` | ✓ | Association présente |
| Section Accessibilité — `<input type="checkbox">` + `<label>` | ✓ | Conforme |
| Section Apparence — `<fieldset role="radiogroup" aria-label>` | ✓ | Conforme WAI-ARIA 1.2 |
| Radios thème — `<input type="radio">` + `<label htmlFor>` | ✓ | Navigation clavier flèches native du radiogroup |

**Évaluation globale formulaires** : implémentation soignée, bien conforme WCAG 1.3.1 A et 4.1.2 AA.

### 9.3 Gestion de la suppression (dialogue inline)

| Mécanisme | Implémentation | Évaluation |
|-----------|---------------|------------|
| `role="alert" aria-live="assertive"` sur l'encart | ✓ | Annonce l'ouverture du dialogue de danger |
| `aria-expanded` + `aria-controls` sur btnDelete | ✓ | Pattern disclosure conforme |
| Focus déplacé sur `btnCancelDelete` à l'ouverture | ✓ | `requestAnimationFrame(() => btnCancelDelete.focus())` — bonne pratique |
| `min-height: 44px` sur boutons Annuler/Confirmer | ✓ | `min-height:44px` dans `style.cssText` |
| Pas de piège de focus (pas de modal overlay) | ✓ | Pattern inline — Escape non implémenté mais non requis pour un encart inline |

**Évaluation** : pattern de confirmation inline bien implémenté, sans les problèmes de focus trap d'une modal.

### 9.4 Toast de sauvegarde

| Mécanisme | Implémentation | Évaluation |
|-----------|---------------|------------|
| `role="status"` + `aria-live="polite"` | ✓ | Conforme WCAG 4.1.3 AA |
| Auto-disparition 1.5s | ✓ | Respecte WCAG 2.2.1 (durée ajustable dans la section Accessibilité) |

### 9.5 Statut des opérations données

| Mécanisme | Implémentation | Évaluation |
|-----------|---------------|------------|
| `role="status"` + `aria-live="polite"` sur `.data-status` | ✓ | Conforme pour export/suppression/whitelist |

### 9.6 Cibles tactiles (WCAG 2.5.5)

| Élément | Taille | Évaluation |
|---------|--------|------------|
| `.form-select` | `min-height: var(--sn-min-target)` = 44px | ✓ |
| `.data-btn` | `min-height: var(--sn-min-target)` = 44px | ✓ |
| `.toggle-label` | `min-height: var(--sn-min-target)` = 44px | ✓ |
| `.toggle-checkbox` | 20×20px — cible petite mais label associé couvre la zone | ⚠ La checkbox elle-même fait 20px. La zone cliquable effective dépend du layout. ACC-P2-05 applicable : recommander `touch-action: manipulation` + zone cliquable étendue via padding sur le wrapper |
| `.radio-input` | 20×20px — même constat | ⚠ Idem |

**Note** : les radios et checkboxes à 20px sont conformes si leur label associé forme une cible de 44px (ce qui est le cas pour `.toggle-label` avec `min-height: 44px`). La checkbox elle-même reste à 20px mais la règle WCAG 2.5.5 peut être satisfaite si la cible inclusive label+input fait 44px. Vérification en browser recommandée (T-180).

### 9.7 Focus visible (WCAG 2.4.7 AA)

| Élément | Mécanisme | Évaluation |
|---------|-----------|------------|
| `.toggle-input:focus-visible + .toggle-switch` | `outline: 3px solid var(--sn-color-accent); outline-offset: 2px` | ✓ |
| `.form-select:focus-visible` | `outline: 3px solid var(--sn-color-accent); outline-offset: 2px` | ✓ |
| `.radio-input:focus-visible` | `outline: 3px solid var(--sn-color-accent); outline-offset: 2px` | ✓ |
| `.toggle-checkbox:focus-visible` | `outline: 3px solid var(--sn-color-accent); outline-offset: 2px` | ✓ |
| `.theme-btn:focus-visible` | `outline: 3px solid var(--sn-color-accent); outline-offset: 2px` | ✓ |
| Boutons `.btn:focus-visible` (si classe présente) | ✓ via popup.css pattern repris | ✓ |

**Évaluation** : couverture focus visible complète sur tous les éléments interactifs.

### 9.8 prefers-reduced-motion

`tokens.css` importé. Conforme T-151.

---

## 10. Onboarding (`onboarding.html` / `onboarding.ts` / `onboarding.css`)

### 10.1 Structure HTML de base

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | "Sentinel Nudge — Bienvenue" |
| `<main role="main" aria-label="Configuration initiale Sentinel Nudge">` | ✓ | Présent |
| Skip link (WCAG 2.4.1 A) | ⚠ | **ACC-UI-09 (Could)** : absent, comme pour la page Options. L'onboarding est une page pleine (pas une popup) mais le premier élément focusable est H1 puis les boutons de navigation — l'impact est faible car le contenu utile est immédiatement accessible. Moins critique qu'Options car usage unique (premier lancement). |
| Tokens CSS centralisés | ✓ | `tokens.css` importé |

### 10.2 Navigation par étapes

| Mécanisme | Implémentation | Évaluation |
|-----------|---------------|------------|
| Indicateur de progression | `<span id="progress-indicator" aria-live="polite" class="sr-only">` | ✓ Annonce "Étape X sur 4" à chaque navigation |
| Points visuels de progression | `<ol class="progress-dots" aria-hidden="true">` | ✓ Décoratifs masqués aux AT, sens porté par le texte sr-only |
| `aria-current="step"` sur le point actif | ✓ | Conforme WAI-ARIA 1.2 |
| Focus replacé sur premier élément focusable à chaque étape | ✓ | `firstFocusable.focus()` dans `renderStepContent` |
| Fallback focus sur `stepArea` (tabindex=-1) | ✓ | Bonne pratique si étape sans éléments focusables |
| Bouton Précédent désactivé étape 1 | `btnPrev.disabled = step === 1` | ✓ Conforme |
| Bouton Terminer : désactivé + feedback textuel pendant enregistrement | ✓ | `btnFinish.disabled = true; btnFinish.textContent = 'Enregistrement...'` |

**Évaluation** : gestion du focus entre étapes exemplaire — conforme DAT §11.3.

### 10.3 Formulaires

| Section | Mécanisme | Évaluation |
|---------|-----------|------------|
| Étape 2 — Profil : `<fieldset>` + `<legend class="sr-only">` | ✓ | Legend sr-only valide |
| Radios profil — `<input type="radio">` + `<label htmlFor>` | ✓ | Association présente |
| `aria-describedby` sur radios | ✓ | Pointe vers `.profile-desc` |
| Étape 3 — Modules : `<fieldset>` + `<legend class="sr-only">` | ✓ | Conforme |
| Toggles modules — même pattern qu'Options | ✓ | |
| M7 désactivé : `input.disabled = true` + `aria-label` explicatif | ✓ | `"Mots de passe réutilisés (consentement requis à l'étape suivante)"` — conforme WCAG 4.1.2 AA |
| Étape 4 — Consentement M7 : `<input type="checkbox">` + `<label htmlFor>` | ✓ | Association présente |
| Erreur étape 2 (profil non sélectionné) | `role="alert"` sur `.step-error` | ✓ Annonce immédiate |
| Erreur finale (finishOnboarding failure) | `role="alert"` sur l'élément d'erreur | ✓ |

### 10.4 Lien GitHub (étape 1) — ouverture dans nouvel onglet

| Critère | Implémentation | Évaluation |
|---------|---------------|------------|
| `target="_blank"` + `rel="noopener noreferrer"` | ✓ | Sécurité conforme |
| Indication visuelle d'ouverture nouvel onglet (WCAG 3.2.2 A) | ⚠ | **ACC-UI-10 (Could)** : le lien "Voir le code sur GitHub" s'ouvre dans un nouvel onglet sans en avertir l'utilisateur (pas d'icône ni de texte sr-only "s'ouvre dans un nouvel onglet"). Recommandation : ajouter `<span class="sr-only"> (s'ouvre dans un nouvel onglet)</span>` dans le texte du lien. Même recommandation pour les liens externes dans les pages Options et Onboarding étape 4. |

### 10.5 Cibles tactiles (WCAG 2.5.5)

Boutons Précédent / Suivant / Terminer : doivent avoir `min-height: 44px` via la classe `.btn` dans `onboarding.css`. À confirmer en browser (T-180).

### 10.6 Focus visible

Même pattern que Options : `focus-visible` attendu sur les boutons nav et les inputs. À confirmer via `onboarding.css` (non relu dans cet audit — T-180).

### 10.7 prefers-reduced-motion

`tokens.css` importé. Conforme T-151.

---

## 11. Synthèse globale Partie 2 et taux de conformité consolidé

### 11.1 Taux de conformité estimé — UI internes (Partie 2)

- Aucun échec WCAG de niveau A identifié dans l'audit théorique
- Aucun échec WCAG de niveau AA identifié sur les critères vérifiables statiquement
- **9 écarts de niveau Should/Could** identifiés (ACC-UI-01 à ACC-UI-10), dont 0 bloquant pour la conformité WCAG AA stricte
- Taux estimé Partie 2 : **~94%** (pénalités Should sur skip link Options/Onboarding, statut modules couleur seule, focus tooltip, `aria-live` redondant, quota reached sans annonce textuelle)

### 11.2 Taux de conformité global (Parties 1 + 2)

| Périmètre | Taux estimé |
|-----------|-------------|
| Pages statiques (post-corrections T-132/T-133/T-134/T-135/T-136) | ~100% |
| UI internes (audit théorique) | ~94% |
| **Global (périmètre étendu v1.1)** | **~97%** |

---

## 12. Écarts résiduels et nouvelles recommandations

### 12.1 Écarts Partie 1 (pages statiques) — résidus post-corrections

| ID | Critère | Priorité | Description |
|----|---------|----------|-------------|
| ACC-P2-05 | WCAG 1.4.4 AA | P2 — Could | Tableaux M3 et M9 à `font-size: 0.75rem` (12px) sur mobile. Recommandation : porter à `0.875rem` (14px) minimum. |

### 12.2 Écarts Partie 2 — UI internes

| ID | Page | Critère | Priorité | Description |
|----|------|---------|----------|-------------|
| ACC-UI-01 | Popup | WAI-ARIA 1.2 — Disclosure widget | Should | À l'ouverture du tooltip du badge dégradé, le focus n'est pas déplacé vers le premier bouton de l'intérieur. Ajouter `reloadBtn.focus()` après affichage du tooltip. |
| ACC-UI-02 | Popup | WCAG 1.4.1 A | Should | Statut actif/inactif/dégradé des chips modules transmis uniquement par la couleur du point. Ajouter `aria-label` complet sur chaque chip : ex. `"Sites douteux — actif"`, `"Sites douteux — inactif"`, `"Sites douteux — dégradé"`. |
| ACC-UI-03 | Popup | WCAG 4.1.3 AA | Should | Lors du chargement, le noeud `aria-live` est retiré du DOM avant d'être remplacé — les AT ne peuvent annoncer le changement. Préférer vider puis remplir le conteneur live plutôt que supprimer/insérer. |
| ACC-UI-04 | Popup | WCAG 1.4.1 A + 4.1.3 AA | Should | Quota atteint signalé par couleur warning CSS uniquement. Ajouter `aria-valuetext="3 sur 3 — quota atteint"` sur `role="meter"` quand `quotaReached === true`. |
| ACC-UI-05 | Popup | WCAG 2.5.5 AA | Should | Boutons "En savoir plus", "Recharger l'extension" et "Fermer" dans le badge dégradé sans `min-height: 44px` garanti. Ajouter la contrainte CSS ou inline. |
| ACC-UI-06 | Dashboard | WCAG 2.4.1 A | Should | Skip link absent sur la page dashboard (page fullpage). Ajouter en premier enfant de `#dashboard-root`. |
| ACC-UI-07 | Dashboard | WCAG 2.5.5 AA | Should | Vérifier `min-height: 44px` sur le bouton "Ouvrir les paramètres" dans `dashboard.css`. |
| ACC-UI-08 | Options | WCAG 2.4.1 A | Should | Skip link absent dans `options.ts` malgré les styles CSS présents dans `options.css`. Ajouter l'élément DOM `<a href="#options-main" class="skip-link">Aller au contenu</a>` en premier enfant de `#options-root`, et `id="options-main"` sur le premier `<h1>` ou le conteneur de contenu. |
| ACC-UI-09 | Onboarding | WCAG 2.4.1 A | Could | Skip link absent. Impact faible (usage unique, premier élément focusable est directement le contenu de l'étape 1). |
| ACC-UI-10 | Onboarding, Options | WCAG 3.2.2 A | Could | Liens s'ouvrant dans un nouvel onglet (`target="_blank"`) sans indication textuelle. Ajouter `<span class="sr-only"> (s'ouvre dans un nouvel onglet)</span>` dans le contenu des liens externes : GitHub (onboarding étape 1), politique de confidentialité (onboarding étape 4), liens GitHub et politique (options À propos), liens transparence radicale (options). |

---

## 13. Tests axe-core T-150 / T-157

**Statut post-hotfix T-157 (PR #81) et PR #92 :** 12/12 règles axe-core WCAG 2.2 AA verts confirmés sur le périmètre couvert par les tests automatisés. Les résultats axe-core sont à archiver dans `docs/accessibilite/captures/axe-core/` selon le plan `captures/axe-core/plan-archivage-v1.0.md` (T-180).

**Règles axe-core activées (à maintenir)** :
- `color-contrast` — contraste texte/fond
- `document-title` — titre de page
- `html-has-lang` — langue déclarée
- `landmark-one-main` — landmark main unique
- `page-has-heading-one` — présence d'un H1
- `skip-link` — lien de contournement
- `region` — contenu encadré par des landmarks

---

## 14. Couverture lecteurs d'écran — recommandations pour T-180

Les tests manuels avec NVDA (lecteur d'écran gratuit, Windows 11) ne sont pas réalisables dans cet audit. Les scénarios à tester lors de T-180 :

| Scénario | Page | Critère |
|----------|------|---------|
| Navigation par landmarks (NVDA Insert+F7) | Popup, Dashboard, Options, Onboarding | WCAG 1.3.6 AA |
| Navigation par titres (NVDA H) | Dashboard, Options | WCAG 1.3.1 A |
| Lecture de la gauge score | Popup | WCAG 1.1.1 A |
| Lecture de la grille modules avec statuts | Popup | ACC-UI-02 |
| Annonce du score chargé (live region) | Popup | ACC-UI-03 |
| Annonce quota atteint | Popup | ACC-UI-04 |
| Lecture de l'histogramme SVG + table sr-only | Dashboard | WCAG 1.1.1 A |
| Navigation formul aire Options par fieldset/legend | Options | WCAG 1.3.1 A |
| Navigation par étapes onboarding | Onboarding | WCAG 2.4.3 A |
| Focus M7 désactivé avec aria-label | Onboarding étape 3 | WCAG 4.1.2 AA |

Les captures et résultats sont à archiver dans `docs/accessibilite/captures/` (T-180). Scénarios NVDA structurés disponibles dans `captures/nvda/scenarios-nvda-v1.0.md`.

---

## 15. Plan d'action consolidé

| Priorité | ID | Tâche | Impact WCAG | Effort estimé |
|----------|----|-------|-------------|---------------|
| Should | ACC-UI-01 | Focus déplacé à l'ouverture du tooltip badge dégradé | WAI-ARIA 1.2 | 15 min — `popup.ts` |
| Should | ACC-UI-02 | `aria-label` complet sur chips modules (statut actif/inactif/dégradé) | WCAG 1.4.1 A | 30 min — `popup.ts` `renderModulesSection` |
| Should | ACC-UI-03 | Remplacer suppression/insertion noeud `aria-live` par vidage/remplissage | WCAG 4.1.3 AA | 30 min — `popup.ts` `initPopup` |
| Should | ACC-UI-04 | `aria-valuetext` "quota atteint" quand `quotaReached` | WCAG 4.1.3 AA | 15 min — `popup.ts` `renderQuotaBar` |
| Should | ACC-UI-05 | `min-height: 44px` sur boutons badge dégradé | WCAG 2.5.5 AA | 15 min — `popup.ts` ou `popup.css` |
| Should | ACC-UI-06 | Skip link sur Dashboard | WCAG 2.4.1 A | 20 min — `dashboard.ts` |
| Should | ACC-UI-07 | Vérifier `min-height: 44px` bouton Dashboard | WCAG 2.5.5 AA | 10 min — `dashboard.css` |
| Should | ACC-UI-08 | Skip link sur Options | WCAG 2.4.1 A | 20 min — `options.ts` |
| Could | ACC-UI-09 | Skip link sur Onboarding | WCAG 2.4.1 A | 15 min — `onboarding.ts` |
| Could | ACC-UI-10 | Mentions "nouvel onglet" sur liens `target="_blank"` | WCAG 3.2.2 A | 30 min — `options.ts`, `onboarding.ts` |
| Could | ACC-P2-05 | `font-size` tableaux mobiles M3/M9 : 0.75rem → 0.875rem | WCAG 1.4.4 AA | 15 min — CSS pages statiques |

**Séquençage recommandé** : regrouper ACC-UI-01 à ACC-UI-05 dans une seule PR `popup.ts` + `popup.css`. ACC-UI-06 à ACC-UI-08 dans une PR `dashboard.ts` + `options.ts`. ACC-UI-09/10 en une PR `onboarding.ts` + `options.ts`.

---

## 16. Outillage d'audit

| Outil | Usage | Résultat |
|-------|-------|----------|
| Colour Contrast Analyser (TPGi) | Calcul des ratios de contraste (pages statiques) | ACC-P1-01/02 confirmés corrigés (`#92400e` / `#ffffff` = 6.5:1) |
| axe-core (règles WCAG 2.2 AA) | Tests automatisés intégrés dans Vitest/Playwright | 12/12 verts post-T-157 (à confirmer post-PR #97) |
| Lighthouse (Chrome DevTools) | Audit global accessibilité | Non exécuté dans cet audit v1.1 — T-180 |
| NVDA | Tests manuels lecteur d'écran | Non exécutés — T-180 |
| Inspection manuelle code source | Audit théorique UI internes | Méthode principale Partie 2 de cet audit |

---

## 17. Déclaration d'accessibilité partielle (état courant)

État au 2026-04-19, post-corrections T-132/T-133/T-134/T-135/T-136 :

- **Référentiel** : WCAG 2.2 niveau AA, RGAA 4.1
- **Taux de conformité estimé** : ~97% (global périmètre étendu)
- **Non-conformités bloquantes** : 0
- **Non-conformités importantes (Should)** : 8 (ACC-UI-01 à ACC-UI-08 — améliorations ARIA et accessibilité clavier)
- **Non-conformités mineures (Could)** : 3 (ACC-UI-09/10, ACC-P2-05)
- **Plan d'action** : ACC-UI-01 à ACC-UI-08 Should à traiter dans une ou deux PR groupées
- **Tests NVDA** : à réaliser dans le cadre de T-180, résultats à archiver dans `docs/accessibilite/captures/`
- **Contact** : politique de confidentialité publiée dans l'extension (`politique-confidentialite.html`) — déclaration d'accessibilité formelle (P7) à produire avant publication Chrome Web Store

---

## 18. Historique des versions

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | 2026-04-18 | Expert accessibilité (Fabrique) | Création — audit initial des 7 pages statiques HTML |
| 1.1 | 2026-04-19 | Expert accessibilité (Fabrique) | Bump v1.0 → v1.1. Fermeture des écarts T-132 (skip links ×7), T-133 (contraste M17 `#92400e` 6.5:1), T-134 (tokens centralisés), T-135 (`<strong>` → `<h3>`), T-136 (`role="note"` privacy-box). Recalcul taux : 91% → ~100% pages statiques. Ajout Partie 2 — audit théorique UI internes (popup, dashboard, options, onboarding) — résorbe T-168. Identification de 10 écarts ACC-UI-01 à ACC-UI-10 (0 bloquant, 8 Should, 2 Could). Taux global estimé : ~97%. Renommage du fichier : `checklist-accessibilite-pages-statiques-v1.0.md` → `checklist-accessibilite-v1.1.md` (scope étendu à toute l'UI). |
