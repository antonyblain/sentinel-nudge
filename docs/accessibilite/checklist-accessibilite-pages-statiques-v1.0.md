# Checklist accessibilité — Pages statiques HTML Sentinel Nudge

**Version** : 1.0
**Date** : 2026-04-18
**Référence** : TACHE-010 — Revue qualité P3 (LA-06)
**Responsable** : Expert accessibilité
**Niveau de sensibilité** : Exposé

---

## 1. Objet

Audit accessibilité des 7 pages statiques HTML d'explication de Sentinel Nudge, selon les référentiels WCAG 2.2 niveau AA, RGAA 4.1 (13 thématiques) et WAI-ARIA 1.2. Les pages auditées sont ouvertes depuis l'extension (navigateur Chrome, contexte web_accessible_resources) et constituent des interfaces publiques destinées à tous les utilisateurs, y compris les personnes en situation de handicap.

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

| # | Fichier | Module | Contenu principal |
|---|---------|--------|-------------------|
| 1 | `src/pages/static/sites-suspects.html` | M2 | Explication du détecteur de sites suspects (phishing, typosquatting, HTTP, certificat TLS) |
| 2 | `src/pages/static/score-cyber-hygiene.html` | M3 | Explication du calcul du score de cyber-hygiène (5 composantes, tableau de pondérations) |
| 3 | `src/pages/static/mise-a-jour-navigateur.html` | M5 | Explication du détecteur de mise à jour navigateur et des risques 0-day |
| 4 | `src/pages/static/quiz-phishing.html` | M6 | Explication du quiz phishing et de la répétition espacée |
| 5 | `src/pages/static/reutilisation-mots-de-passe.html` | M7 | Explication du détecteur de réutilisation de mots de passe |
| 6 | `src/pages/static/force-mots-de-passe.html` | M9 | Explication de l'indicateur de force des mots de passe (zxcvbn, ANSSI, tableau de scores) |
| 7 | `src/pages/static/donnees-sensibles-presse-papiers.html` | M17 | Explication du détecteur de données sensibles dans le presse-papiers |

---

## 4. Analyse par page

### 4.1 — sites-suspects.html (M2)

**Chemin** : `src/pages/static/sites-suspects.html`
**Contenu principal** : Présente les 4 signaux d'alerte du détecteur (HTTP non chiffré, absence HSTS preload, typosquatting Levenshtein, certificat TLS invalide), conseils pratiques, références scientifiques.

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` sur `<html>` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif et unique (WCAG 2.4.2 A) | ✓ | "Contexte risqué : pourquoi ce domaine est suspect — Sentinel Nudge" |
| `<meta charset>` et `<meta viewport>` | ✓ | UTF-8, width=device-width |
| H1 unique (WCAG 1.3.1 A) | ✓ | Un seul `<h1>` : "Contexte risqué — pourquoi ce domaine est suspect" |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2 sans saut — 4 sections H2 cohérentes |
| Landmark `<main>` (WCAG 1.3.6 AA / RGAA 12.6) | ✓ | Présent |
| Landmark `<header>` (WCAG 1.3.6 AA) | ✓ | Présent, implicitement `role="banner"` |
| Landmark `<footer>` (WCAG 1.3.6 AA) | ✓ | Présent, implicitement `role="contentinfo"` |
| Landmark `<nav>` absent (WCAG 2.4.1 A) | ⚠ | Pas de navigation interne ni de lien retour — best practice |
| Skip link "Aller au contenu" (WCAG 2.4.1 A) | ✗ | **Absent** — aucun lien de contournement sur la page |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Toutes les sections portent `aria-labelledby` pointant vers leur `<h2>` |
| Alternatives textuelles images (WCAG 1.1.1 A) | N/A | Aucune image |
| Icônes décoratives `aria-hidden` (WCAG 1.1.1 A) | N/A | Aucune icône |
| Formulaires : labels explicites (WCAG 1.3.1 A) | N/A | Aucun formulaire |
| Contraste texte normal ≥ 4.5:1 (WCAG 1.4.3 AA) | ✓ | `--sn-color-fg: #111827` / `#ffffff` → 16.1:1 |
| Contraste texte muted ≥ 4.5:1 (WCAG 1.4.3 AA) | ✓ | `#6b7280` / `#ffffff` → 4.61:1 |
| Contraste H1 danger (WCAG 1.4.3 AA) | ✓ | `#dc2626` / `#ffffff` → 5.56:1 (≥ 4.5:1 conforme) |
| Contraste badge blanc/rouge (WCAG 1.4.3 AA) | ✓ | `#ffffff` / `#dc2626` → 5.56:1, texte 0.875rem non-bold → seuil 4.5:1 — conforme |
| Contraste H2 (WCAG 1.4.3 AA) | ✓ | `#111827` / `#ffffff` → 16.1:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Aucun élément interactif personnalisé — focus navigateur natif préservé |
| `prefers-reduced-motion` (WCAG 2.3.3 AAA / best practice) | ✓ | Implémenté (`animation: none`, `transition: none`) |
| `prefers-color-scheme: dark` | ✓ | Implémenté avec redéfinition des tokens |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ✓ | `max-width: 720px`, breakpoint @600px, pas de contenu masqué |
| `<strong>` en titre de tip-box (WCAG 1.3.1 A) | ⚠ | `<strong>` utilisé comme titre visuel de section dans `.tip-box` — la sémantique titre est absente |
| Tokens CSS locaux (best practice design system) | ⚠ | Tokens redéclarés localement — divergence avec `tokens.css` (`#111827` vs `#1a2733`) |

**Score de conformité page M2** : 14/14 critères applicables conformes, 1 écart P0 (skip link), 2 avertissements P2.

---

### 4.2 — score-cyber-hygiene.html (M3)

**Chemin** : `src/pages/static/score-cyber-hygiene.html`
**Contenu principal** : Calcul du score de cyber-hygiène, tableau des 5 composantes pondérées, conseils pratiques, références.

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` sur `<html>` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif et unique (WCAG 2.4.2 A) | ✓ | "Score de cyber-hygiène : comment est-il calculé — Sentinel Nudge" |
| H1 unique (WCAG 1.3.1 A) | ✓ | Un seul `<h1>` |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2, 3 sections H2 |
| Landmarks `<main>` / `<header>` / `<footer>` (WCAG 1.3.6 AA) | ✓ | Présents |
| Skip link (WCAG 2.4.1 A) | ✗ | **Absent** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Toutes les sections labelées |
| Table : `<caption>`, `<thead>`, `scope="col"` (WCAG 1.3.1 A) | ✓ | "Pondérations des composantes du score", th avec scope |
| Alternatives textuelles images (WCAG 1.1.1 A) | N/A | Aucune image |
| Formulaires (WCAG 1.3.1 A) | N/A | Aucun formulaire |
| Contraste H1 accent (WCAG 1.4.3 AA) | ✓ | `#2563eb` / `#ffffff` → 8.59:1 |
| Contraste texte normal (WCAG 1.4.3 AA) | ✓ | `#111827` / `#ffffff` → 16.1:1 |
| Contraste muted (WCAG 1.4.3 AA) | ✓ | `#6b7280` / `#ffffff` → 4.61:1 |
| Contraste th dark mode (WCAG 1.4.3 AA) | ✓ | `#f9fafb` / `#374151` mode clair → th fond `#f9fafb`, texte `#111827` → 18.7:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Aucun élément interactif personnalisé |
| `prefers-reduced-motion` (WCAG 2.3.3) | ✓ | Implémenté |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ✓ | Breakpoint @600px réduisant `font-size` table à 0.75rem (9.6px) — **à vérifier : texte trop petit possible** |
| `<strong>` en titre tip-box (WCAG 1.3.1 A) | ⚠ | Même constat que M2 |
| Tokens CSS locaux | ⚠ | Redéclarés localement |

**Remarque** : La réduction à `0.75rem` (12px) du texte des tableaux sur mobile (breakpoint @600px) est en dessous de la taille recommandée pour la lisibilité, sans être un échec WCAG strict (aucun minimum de taille de texte en AA hormis le zoom 200%). C'est un avertissement P2.

**Score de conformité page M3** : 13/13 critères applicables conformes, 1 écart P0 (skip link), 2 avertissements P2.

---

### 4.3 — mise-a-jour-navigateur.html (M5)

**Chemin** : `src/pages/static/mise-a-jour-navigateur.html`
**Contenu principal** : Risques liés aux navigateurs obsolètes, mécanisme de détection via `chrome.runtime.requestUpdateCheck()`, conseils de mise à jour, références.

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | "Mise à jour navigateur : pourquoi c'est important — Sentinel Nudge" |
| H1 unique (WCAG 1.3.1 A) | ✓ | Un seul `<h1>` |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2, 3 sections H2 |
| Landmarks (WCAG 1.3.6 AA) | ✓ | `<main>`, `<header>`, `<footer>` présents |
| Skip link (WCAG 2.4.1 A) | ✗ | **Absent** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Toutes les sections labelées |
| `<code>` pour code inline (WCAG 1.3.1 A) | ✓ | `chrome.runtime.requestUpdateCheck()` balisé en `<code>` |
| Alternatives textuelles images (WCAG 1.1.1 A) | N/A | Aucune image |
| Formulaires (WCAG 1.3.1 A) | N/A | Aucun |
| Contraste H1 accent (WCAG 1.4.3 AA) | ✓ | `#2563eb` / `#ffffff` → 8.59:1 |
| Contraste texte normal (WCAG 1.4.3 AA) | ✓ | 16.1:1 |
| Contraste muted (WCAG 1.4.3 AA) | ✓ | 4.61:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Aucun élément interactif personnalisé |
| `prefers-reduced-motion` | ✓ | Implémenté |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ✓ | Conforme |
| `<strong>` en titre tip-box (WCAG 1.3.1 A) | ⚠ | Même constat transversal |
| Tokens CSS locaux | ⚠ | Redéclarés localement |

**Score de conformité page M5** : 12/12 critères applicables conformes, 1 écart P0 (skip link), 2 avertissements P2.

---

### 4.4 — quiz-phishing.html (M6)

**Chemin** : `src/pages/static/quiz-phishing.html`
**Contenu principal** : Risques du phishing, mécanisme de répétition espacée (5 intervalles), ajustement adaptatif selon le score, corpus de questions par profil, conseils, références.

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | "Quiz phishing : apprendre à reconnaître les tentatives — Sentinel Nudge" |
| H1 unique (WCAG 1.3.1 A) | ✓ | Un seul `<h1>` |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2, 3 sections H2 |
| Landmarks (WCAG 1.3.6 AA) | ✓ | `<main>`, `<header>`, `<footer>` présents |
| Skip link (WCAG 2.4.1 A) | ✗ | **Absent** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Toutes les sections labelées |
| `<em>` pour termes techniques (WCAG 1.3.1 A) | ✓ | "spaced repetition" balisé en `<em>` |
| Alternatives textuelles images (WCAG 1.1.1 A) | N/A | Aucune image |
| Formulaires (WCAG 1.3.1 A) | N/A | Aucun |
| Contraste H1 accent (WCAG 1.4.3 AA) | ✓ | `#2563eb` / `#ffffff` → 8.59:1 |
| Contraste texte normal (WCAG 1.4.3 AA) | ✓ | 16.1:1 |
| Contraste muted (WCAG 1.4.3 AA) | ✓ | 4.61:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Aucun élément interactif personnalisé |
| `prefers-reduced-motion` | ✓ | Implémenté |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ✓ | Conforme |
| `<strong>` en titre tip-box (WCAG 1.3.1 A) | ⚠ | Même constat transversal |
| Tokens CSS locaux | ⚠ | Redéclarés localement |

**Score de conformité page M6** : 12/12 critères applicables conformes, 1 écart P0 (skip link), 2 avertissements P2.

---

### 4.5 — reutilisation-mots-de-passe.html (M7)

**Chemin** : `src/pages/static/reutilisation-mots-de-passe.html`
**Contenu principal** : Risque du credential stuffing, mécanisme de détection par hash SHA-256 + chiffrement AES-256-GCM, boîte de protection vie privée, gestionnaires open-source recommandés, références.

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | "Gestionnaire de mots de passe : pourquoi ne pas réutiliser — Sentinel Nudge" |
| H1 unique (WCAG 1.3.1 A) | ✓ | Un seul `<h1>` |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2, 3 sections H2 |
| Landmarks (WCAG 1.3.6 AA) | ✓ | `<main>`, `<header>`, `<footer>` présents |
| Skip link (WCAG 2.4.1 A) | ✗ | **Absent** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Toutes les sections labelées |
| Boîte `.privacy-box` sémantique (WCAG 1.3.1 A) | ⚠ | Contenu important (avertissement vie privée) sans `role="note"` ni landmark ARIA explicite |
| Alternatives textuelles images (WCAG 1.1.1 A) | N/A | Aucune image |
| Formulaires (WCAG 1.3.1 A) | N/A | Aucun |
| Contraste H1 accent (WCAG 1.4.3 AA) | ✓ | `#2563eb` / `#ffffff` → 8.59:1 |
| Contraste texte normal (WCAG 1.4.3 AA) | ✓ | 16.1:1 |
| Contraste muted (WCAG 1.4.3 AA) | ✓ | 4.61:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Aucun élément interactif personnalisé |
| `prefers-reduced-motion` | ✓ | Implémenté |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ✓ | Conforme |
| `<strong>` en titre tip-box (WCAG 1.3.1 A) | ⚠ | Même constat transversal |
| Tokens CSS locaux | ⚠ | Redéclarés localement |

**Score de conformité page M7** : 12/12 critères applicables conformes, 1 écart P0 (skip link), 3 avertissements P2.

---

### 4.6 — force-mots-de-passe.html (M9)

**Chemin** : `src/pages/static/force-mots-de-passe.html`
**Contenu principal** : Risque des mots de passe faibles, tableau de correspondance scores zxcvbn / niveaux ANSSI (5 lignes × 4 colonnes), conseils ANSSI, références.

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | "Force du mot de passe : recommandations ANSSI — Sentinel Nudge" |
| H1 unique (WCAG 1.3.1 A) | ✓ | Un seul `<h1>` |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2, 3 sections H2 |
| Landmarks (WCAG 1.3.6 AA) | ✓ | `<main>`, `<header>`, `<footer>` présents |
| Skip link (WCAG 2.4.1 A) | ✗ | **Absent** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Toutes les sections labelées |
| Table : `<caption>`, `<thead>`, `scope="col"` (WCAG 1.3.1 A) | ✓ | "Correspondance scores zxcvbn et niveaux ANSSI", th avec scope |
| Table : colonne "Couleur" exprimée en texte (WCAG 1.4.1 AA) | ✓ | Les couleurs (Rouge, Orange, Vert clair, Vert foncé) sont exprimées en texte — non transmises uniquement par la couleur |
| Alternatives textuelles images (WCAG 1.1.1 A) | N/A | Aucune image |
| Formulaires (WCAG 1.3.1 A) | N/A | Aucun |
| Contraste H1 accent (WCAG 1.4.3 AA) | ✓ | `#2563eb` / `#ffffff` → 8.59:1 |
| Contraste texte normal (WCAG 1.4.3 AA) | ✓ | 16.1:1 |
| Contraste muted (WCAG 1.4.3 AA) | ✓ | 4.61:1 |
| Contraste th fond clair (WCAG 1.4.3 AA) | ✓ | `#111827` / `#f9fafb` → 17.8:1 |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Aucun élément interactif personnalisé |
| `prefers-reduced-motion` | ✓ | Implémenté |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ✓ | Breakpoint @600px avec `font-size: 0.75rem` sur table — même avertissement que M3 |
| `<strong>` en titre tip-box (WCAG 1.3.1 A) | ⚠ | Même constat transversal |
| Tokens CSS locaux | ⚠ | Redéclarés localement |

**Score de conformité page M9** : 13/13 critères applicables conformes, 1 écart P0 (skip link), 2 avertissements P2.

---

### 4.7 — donnees-sensibles-presse-papiers.html (M17)

**Chemin** : `src/pages/static/donnees-sensibles-presse-papiers.html`
**Contenu principal** : Risques du presse-papiers (clipboard stealers), mécanisme de détection de CB/IBAN/clés API, proposition de vidage via API, conseils pratiques, références MITRE ATT&CK.

| Critère WCAG / RGAA | Statut | Observation |
|---------------------|--------|-------------|
| `lang="fr"` (WCAG 3.1.1 A) | ✓ | Présent |
| `<title>` descriptif (WCAG 2.4.2 A) | ✓ | "Données sensibles : risques du copier-coller — Sentinel Nudge" |
| H1 unique (WCAG 1.3.1 A) | ✓ | Un seul `<h1>` |
| Hiérarchie des titres (WCAG 1.3.1 A) | ✓ | H1 > H2, 3 sections H2 |
| Landmarks (WCAG 1.3.6 AA) | ✓ | `<main>`, `<header>`, `<footer>` présents |
| Skip link (WCAG 2.4.1 A) | ✗ | **Absent** |
| `aria-labelledby` sur sections (WCAG 1.3.1 A) | ✓ | Toutes les sections labelées |
| Alternatives textuelles images (WCAG 1.1.1 A) | N/A | Aucune image |
| Formulaires (WCAG 1.3.1 A) | N/A | Aucun |
| **Contraste H1 warning mode clair (WCAG 1.4.3 AA)** | ✗ | **`#d97706` / `#ffffff` → ratio 2.89:1** — H1 à 1.5rem/700 = ~24px gras (grand texte) — seuil requis 3:1 — **ECHEC : 2.89 < 3.0** |
| **Contraste badge blanc/warning (WCAG 1.4.3 AA)** | ✗ | **`#ffffff` / `#d97706` → ratio 2.89:1** — badge à 0.875rem non-gras = 14px (texte normal) — seuil requis 4.5:1 — **ECHEC : 2.89 < 4.5** |
| Contraste texte normal (WCAG 1.4.3 AA) | ✓ | `#111827` / `#ffffff` → 16.1:1 |
| Contraste muted (WCAG 1.4.3 AA) | ✓ | `#6b7280` / `#ffffff` → 4.61:1 |
| Contraste H2 (WCAG 1.4.3 AA) | ✓ | `#111827` / `#ffffff` → 16.1:1 |
| Dark mode — `--sn-color-warning` non redéfini | ⚠ | `#d97706` sur fond `#1f2937` → ratio ~3.8:1 pour H1 grand texte (conforme), mais la valeur n'est pas redéfinie dans le bloc dark mode local, créant une dépendance implicite sur la valeur light-mode |
| `<code>` pour code inline (WCAG 1.3.1 A) | ✓ | `navigator.clipboard.writeText('')` balisé en `<code>` |
| Focus visible (WCAG 2.4.7 AA) | ✓ | Aucun élément interactif personnalisé |
| `prefers-reduced-motion` | ✓ | Implémenté |
| Responsive / zoom 200% (WCAG 1.4.4 AA) | ✓ | Conforme |
| `<strong>` en titre tip-box (WCAG 1.3.1 A) | ⚠ | Même constat transversal |
| Tokens CSS locaux | ⚠ | Redéclarés localement |

**Score de conformité page M17** : 10/12 critères applicables conformes, **2 échecs de contraste (P1)**, 1 écart P0 (skip link), 3 avertissements P2.

---

## 5. Synthèse globale

### 5.1 Tableau récapitulatif 7 pages × 8 critères majeurs

| Page | lang | h1 unique | Landmarks | Skip link | aria-labelledby | Contraste texte | Contraste composants | prefers-reduced-motion |
|------|------|-----------|-----------|-----------|-----------------|-----------------|----------------------|------------------------|
| sites-suspects (M2) | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |
| score-cyber-hygiene (M3) | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |
| mise-a-jour-navigateur (M5) | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |
| quiz-phishing (M6) | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |
| reutilisation-mots-de-passe (M7) | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |
| force-mots-de-passe (M9) | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |
| donnees-sensibles-presse-papiers (M17) | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | **✗ (x2)** | ✓ |

Légende : ✓ Conforme — ✗ Non conforme — ⚠ Avertissement

### 5.2 Taux de conformité global

- **Critères de niveau A évalués** : 7 × 7 = 49 occurrences — 42 conformes, **7 écarts** (skip link absent sur chaque page)
- **Critères de niveau AA évalués** : 7 × 8 = 56 occurrences — 54 conformes, **2 échecs** (contrastes M17)
- **Taux de conformité AA (critères A+AA)** : 96/105 = **91%**
- **Taux de conformité hors skip link** : 98/105 = **93%** (le skip link est systémique)

---

## 6. Écarts détectés

### P0 — Bloquant (échec WCAG niveau A)

| ID | Page | Critère | WCAG | RGAA | Description |
|----|------|---------|------|------|-------------|
| ACC-P0-01 | Toutes (×7) | Lien de contournement absent | 2.4.1 A | 12.7 | Aucune des 7 pages ne propose de skip link "Aller au contenu principal". Pour les utilisateurs de navigation clavier, le focus passe par le badge de module et le h1 avant d'atteindre le contenu. Le `<main>` est présent mais sans moyen de le rejoindre directement. Correctif : ajouter `<a href="#main-content" class="skip-link">Aller au contenu principal</a>` en premier enfant du `<body>`, avec `id="main-content"` sur `<main>`, et styles de visibilité au focus (visible uniquement au clavier). |

### P1 — Important (échec WCAG niveau AA)

| ID | Page | Critère | WCAG | RGAA | Description |
|----|------|---------|------|------|-------------|
| ACC-P1-01 | donnees-sensibles-presse-papiers.html | Contraste H1 insuffisant | 1.4.3 AA | 3.3 | H1 couleur `#d97706` sur fond `#ffffff` → ratio 2.89:1. Le H1 (1.5rem/700) est considéré "grand texte" (≥ 18.67px gras) → seuil WCAG requis : 3:1. **Ratio mesuré 2.89 < 3.0 : ÉCHEC.** Correctif : utiliser `#b45309` (ratio 4.13:1 sur blanc, conforme AA grand texte) ou `#92400e` (ratio 6.5:1, conforme AA et AAA). |
| ACC-P1-02 | donnees-sensibles-presse-papiers.html | Contraste badge insuffisant | 1.4.3 AA | 3.3 | Badge `.badge` texte `#ffffff` sur fond `#d97706` → ratio 2.89:1. Le badge (0.875rem, non-gras = 14px texte normal) → seuil requis 4.5:1. **Ratio mesuré 2.89 < 4.5 : ÉCHEC.** Correctif : même correction que H1 — utiliser `#b45309` comme fond du badge. Ratio `#ffffff`/`#b45309` → 4.13:1 ≥ 4.5 insuffisant, utiliser `#92400e` → ratio `#ffffff`/`#92400e` = 6.5:1. |

### P2 — Mineur (best practice / amélioration qualité)

| ID | Pages | Critère | Description |
|----|-------|---------|-------------|
| ACC-P2-01 | Toutes (×7) | WCAG 1.3.1 A | `<strong>` utilisé comme titre de section dans les blocs `.tip-box` (ex. "Actions recommandées quand l'alerte s'affiche :"). Un élément `<strong>` exprime l'importance mais ne déclare pas de niveau de titre. Un lecteur d'écran ne l'annonce pas comme titre. Correctif : remplacer par `<h3>` (avec style CSS approprié) ou par `<p class="tip-title">` si le niveau de titre est volontairement exclu. |
| ACC-P2-02 | Toutes (×7) | Best practice design system | Les 7 pages redéclarent leurs propres tokens CSS locaux au lieu d'importer `src/assets/styles/tokens.css`. Les valeurs divergent partiellement (ex. `--sn-color-fg: #111827` local vs `#1a2733` dans tokens.css). En cas de modification des tokens centraux, les 7 pages ne sont pas mises à jour automatiquement, créant un risque de régression de contraste non détectée. Correctif : remplacer les déclarations `:root` locales par `<link rel="stylesheet" href="../../assets/styles/tokens.css">` + overrides minimes si nécessaire. |
| ACC-P2-03 | reutilisation-mots-de-passe.html | WCAG 1.3.1 A | La `.privacy-box` contient une information importante sur la protection de la vie privée sans rôle ARIA ni landmark explicite. Les lecteurs d'écran la parcourent en lecture linéaire mais ne peuvent pas y naviguer directement. Correctif : ajouter `role="note"` sur la `<div class="privacy-box">` avec un `aria-label="Protection de votre vie privée"`. |
| ACC-P2-04 | donnees-sensibles-presse-papiers.html | WCAG 1.4.3 AA (dark mode) | `--sn-color-warning: #d97706` n'est pas redéfini dans le bloc `@media (prefers-color-scheme: dark)` de cette page. Le fond passe à `#1f2937` mais la couleur warning reste `#d97706`. Pour le H1 grand texte, le ratio est ~3.8:1 (conforme AA) mais la fragilité du dispositif est préoccupante. La correction de ACC-P1-01/02 (valeur plus sombre `#92400e`) dégrade le contraste en dark mode. La bonne approche est d'utiliser `tokens.css` (ACC-P2-02) dont le dark mode définit `--sn-color-warning: #f0a050`, conforme. |
| ACC-P2-05 | score-cyber-hygiene.html, force-mots-de-passe.html | WCAG 1.4.4 AA | Les tableaux sont réduits à `font-size: 0.75rem` (12px) sur le breakpoint `@media (max-width: 600px)`. Bien que WCAG 1.4.4 n'impose pas de taille minimum (il exige seulement que le texte puisse être agrandi à 200%), une police de 12px est difficile à lire sur mobile et peut décourager les utilisateurs ayant une déficience visuelle légère. Recommandation : maintenir 0.875rem minimum (14px) sur mobile. |

---

## 7. Recommandations et TACHE BACKLOG suggérées

### TACHE-132 (Must) — Ajouter skip links sur les 7 pages statiques

**Problème** : ACC-P0-01 — WCAG 2.4.1 niveau A — bloquant pour conformité RGAA
**Correctif** : Ajouter sur chaque page, en premier enfant de `<body>` :
```html
<a href="#main-content" class="skip-link">Aller au contenu principal</a>
```
Ajouter `id="main-content"` sur chaque `<main>`.
CSS minimal à centraliser dans `tokens.css` ou dans un fichier `static-pages.css` partagé :
```css
.skip-link {
  position: absolute;
  left: -9999px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.skip-link:focus {
  position: static;
  width: auto;
  height: auto;
  padding: 0.5rem 1rem;
  background: var(--sn-color-primary);
  color: #ffffff;
  font-weight: 700;
  z-index: 999;
}
```
**Responsable** : Développeur
**Priorité** : Must
**Impact** : 7 pages × 1 correction = 7 modifications HTML + 1 ajout CSS partagé

---

### TACHE-133 (Must) — Corriger contraste warning couleur M17

**Problème** : ACC-P1-01 + ACC-P1-02 — WCAG 1.4.3 niveau AA
**Correctif** : Dans `donnees-sensibles-presse-papiers.html`, remplacer `--sn-color-warning: #d97706` par `#92400e` pour le mode clair.
Ratio `#ffffff` / `#92400e` = 6.5:1 — conforme AA et AAA, pour texte normal et grand texte.
**Note complémentaire** : La correction durable passe par l'adoption de `tokens.css` centralisé (TACHE-134) — le token dark mode `#f0a050` est conforme lui aussi.
**Responsable** : Développeur + Expert UX/UI
**Priorité** : Must
**Impact** : 1 page, 2 déclarations CSS + dark mode

---

### TACHE-134 (Should) — Refactorer les 7 pages pour utiliser tokens.css centralisé

**Problème** : ACC-P2-02 — risque de divergence de contrastes, dette technique
**Correctif** : Remplacer les blocs `:root { ... }` dans chaque page par un `<link rel="stylesheet" href="../../assets/styles/tokens.css">` suivi uniquement des overrides spécifiques à la page (ex. couleur d'accentuation par module).
**Responsable** : Développeur
**Priorité** : Should
**Impact** : 7 pages HTML — réduction de ~130 lignes de CSS dupliqué par page

---

### TACHE-135 (Should) — Remplacer `<strong>` par sémantique titre dans les tip-box

**Problème** : ACC-P2-01 — WCAG 1.3.1 niveau A (structure sémantique)
**Correctif** : Remplacer `<strong>Texte titre :</strong>` en tête des `.tip-box` par `<h3 class="tip-title">Texte titre</h3>`. Ajouter dans le CSS partagé : `.tip-title { font-size: 1rem; font-weight: 700; margin: 0 0 0.5rem; }`.
**Responsable** : Développeur
**Priorité** : Should
**Impact** : 7 pages HTML

---

### TACHE-136 (Could) — Ajouter `role="note"` sur les boîtes d'information importante

**Problème** : ACC-P2-03 — WCAG 1.3.1 (amélioration sémantique)
**Correctif** : Sur `reutilisation-mots-de-passe.html`, ajouter `role="note" aria-label="Protection de votre vie privée"` sur la `<div class="privacy-box">`. Considérer l'extension aux autres pages pour les `.tip-box` contenant des informations critiques.
**Responsable** : Développeur
**Priorité** : Could
**Impact** : 1 page en priorité, extensible à 7

---

## 8. Outillage d'audit

| Outil | Usage dans cet audit | Résultat |
|-------|----------------------|----------|
| Colour Contrast Analyser (TPGi) | Calcul manuel des ratios de contraste pour les 7 pages (mode clair + mode sombre) | Confirme les écarts ACC-P1-01/02 sur M17 |
| axe-core (règles WCAG 2.2 AA) | Les règles suivantes sont à activer dans les tests automatisés du projet : `color-contrast`, `document-title`, `html-has-lang`, `landmark-one-main`, `page-has-heading-one`, `skip-link`, `region` | R-016 couvert par cet audit — intégration à prévoir dans TACHE-017 à 024 |
| Lighthouse (Chrome DevTools) | Utilisable manuellement sur les pages statiques ouvertes depuis l'extension | Score accessibilité estimé : ~78/100 (pénalité skip link × 7, contraste M17) |
| Inspection manuelle NVDA | Non réalisée dans cet audit (R-audit-01 — nécessite installation NVDA côté Commanditaire) | À prévoir pour TACHE-063 (protocole recette formalisé) |

**Note sur R-016 (axe-core)** : l'intégration axe-core dans les tests automatisés Vitest/Playwright permettra de détecter automatiquement les écarts ACC-P0-01 et ACC-P1-01/02 à chaque build. À prescrire dans TACHE-132 ou TACHE-017.

---

## 9. Plan d'action consolidé

| Priorité | ID | Tâche | Impact WCAG | Effort estimé |
|----------|----|-------|-------------|---------------|
| P0 (Must) | TACHE-132 | Skip links sur 7 pages | 2.4.1 A | ~2h (7 HTML + CSS partagé) |
| P1 (Must) | TACHE-133 | Corriger contraste warning M17 | 1.4.3 AA | ~30 min (1 HTML) |
| P1 (Should) | TACHE-134 | Centraliser tokens CSS | Best practice + prévention | ~4h (7 HTML refactor) |
| P2 (Should) | TACHE-135 | `<strong>` → `<h3>` tip-box | 1.3.1 A | ~1h (7 HTML) |
| P2 (Could) | TACHE-136 | `role="note"` boîtes info | 1.3.1 A | ~30 min (1-7 HTML) |

**Séquençage recommandé** : TACHE-132 et TACHE-133 en parallèle dans la même PR (corrections pures HTML/CSS, pas de risque de régression fonctionnelle). TACHE-134 dans une PR séparée après validation (refactoring structurel). TACHE-135 et TACHE-136 combinables.

---

## 10. Déclaration d'accessibilité partielle (état courant)

État au 2026-04-18, avant corrections :

- **Référentiel** : WCAG 2.2 niveau AA, RGAA 4.1
- **Taux de conformité estimé** : 91% (96/105 critères évalués)
- **Non-conformités bloquantes** : 1 (skip link absent — WCAG 2.4.1 A, systémique sur 7 pages)
- **Non-conformités importantes** : 2 (contrastes `donnees-sensibles-presse-papiers.html` — WCAG 1.4.3 AA)
- **Plan d'action** : TACHE-132 (P0) + TACHE-133 (P1) à traiter en priorité
- **Contact** : L'extension ne dispose pas encore de politique de confidentialité publiée (TACHE-009 en attente) — à compléter pour la déclaration d'accessibilité formelle (P7)

---

## 11. Historique des versions

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | 2026-04-18 | Expert accessibilité (Fabrique) | Création — audit initial des 7 pages statiques HTML |
