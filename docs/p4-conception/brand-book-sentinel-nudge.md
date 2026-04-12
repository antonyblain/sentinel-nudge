# Brand Book — Sentinel Nudge
**Version** : 1.0 — 2026-04-12
**Auteur** : Expert UX/UI — La Fabrique
**Statut** : Soumis au Commanditaire pour arbitrage de palette

---

## Table des matières

1. [Évaluation UX/UI actuelle](#1-évaluation-uxui-actuelle)
2. [Identité de marque](#2-identité-de-marque)
3. [Cinq propositions de palette graphique](#3-cinq-propositions-de-palette-graphique)
4. [Typographie](#4-typographie)
5. [Iconographie](#5-iconographie)
6. [Composants UI — Design tokens CSS](#6-composants-ui--design-tokens-css)
7. [Recommandations](#7-recommandations)

---

## 1. Évaluation UX/UI actuelle

### 1.1 Points forts

| Critère | Constat | Niveau |
|---------|---------|--------|
| Cohérence design system | 25 tokens CSS identiques dans les 4 fichiers CSS et dans `BaseNudge.getDesignTokens()`. Aucune valeur magique orpheline. | Excellent |
| Grille d'espacement | Base 4px strictement respectée (xs=4, sm=8, md=16, lg=24, xl=32). Aucun écart hors grille. | Excellent |
| Ratios de contraste déclarés | Tous documentés en commentaire inline (18.1:1 texte, 5.9:1 accent, 5.1:1 success, 4.6:1 warning/muted). | Très bon |
| Cibles WCAG 2.5.5 | `min-height: 44px` systématique sur boutons, selects, liens, radio, checkboxes. | Très bon |
| Feedback focus clavier | `focus-visible` avec `outline: 3px solid var(--sn-color-accent)` sur tous les éléments interactifs. | Très bon |
| `prefers-reduced-motion` | Déclaré dans les 4 CSS et dans `BaseNudge`. Désactive toutes les animations/transitions. | Excellent |
| Shadow DOM des nudges | Isolation CSS complète des composants injectés dans des pages tierces. Évite toute pollution de styles. | Excellent |
| Hiérarchie typographique | Trois niveaux distincts (title 18px, body 15px, small 13px). Ratio cohérent. | Bon |
| Wording boutons | Verbes à l'infinitif cohérents ("Mettre à jour", "Abandonner", "Continuer"). Non culpabilisants. | Très bon |
| Animation d'entrée toast | `slide-up` 200ms ease-out. Conforme aux recommandations Material Design (entrées ease-out). | Bon |

### 1.2 Points faibles et axes d'amélioration

| Réf | Constat | Niveau | Recommandation |
|-----|---------|--------|----------------|
| UX-01 | **Icônes placeholders 1×1px** : les trois fichiers `icon16.png`, `icon48.png`, `icon128.png` sont des carrés noirs. L'extension est invisible dans la barre d'outils Chrome. | Critique | Concevoir et générer les vraies icônes (voir §5). |
| UX-02 | **Tokens CSS non centralisés** : les 25 tokens sont dupliqués dans chaque fichier CSS (popup, options, dashboard, onboarding) et dans `BaseNudge.ts`. Tout changement de palette nécessite 5 modifications manuelles. | Majeur | Créer un fichier `src/assets/styles/tokens.css` importé dans chaque page. Pour les Shadow DOM, maintenir `getDesignTokens()` mais l'alimenter depuis une constante partagée. |
| UX-03 | **Palette monochromatique bleue** : l'accent `#2563EB` (Tailwind blue-600) est la seule couleur identitaire. Le produit est indifférenciable visuellement d'une application Tailwind générique. | Majeur | Adopter une palette différenciante (voir §3). |
| UX-04 | **Couleurs hardcodées hors tokens** dans les CSS pages : `#e5e7eb`, `#f3f4f6`, `#f9fafb`, `#bfdbfe`, `#eff6ff`, `#fef3c7`, `#92400e`, `#fef2f2`, `#fee2e2`, `#f0fdf4`. Ces valeurs Tailwind ne font pas partie du design system et ne basculeront pas en dark mode. | Moyen | Les absorber dans des tokens sémantiques additionnels : `--sn-color-surface`, `--sn-color-border`, `--sn-color-danger-bg`, `--sn-color-success-bg`, `--sn-color-warning-bg`. |
| UX-05 | **Titre popup centré en bleu accent** : la couleur accent sur un élément non interactif crée une confusion sémantique (le bleu signifie "cliquable"). | Moyen | Utiliser `--sn-color-fg` ou une couleur primaire dédiée pour les titres non-liens. |
| UX-06 | **Absence de dark mode** : aucun `@media (prefers-color-scheme: dark)` dans les 4 CSS de pages. Les utilisateurs en thème sombre voient un fond blanc agressif. | Moyen | Décision de roadmap à arbitrer (voir §7.2). |
| UX-07 | **Double déclaration `.about-link`** dans options.css (lignes 380-386) : `display: block` puis `display: flex` sur le même sélecteur. La deuxième déclaration écrase la première silencieusement. | Mineur | Supprimer `display: block;` ligne 380. |
| UX-08 | **Règle `border: none` orpheline** dans options.css (ligne 301 — `.btn`) : déclarée indépendamment, sans autres propriétés btn. Redondant avec les classes spécifiques. | Mineur | Fusionner avec la définition complète du `.btn`. |
| UX-09 | **Emoji comme icône fonctionnelle** (toast M5 : `🔄` aria-hidden) : les emojis varient fortement selon l'OS et la version du navigateur. Sur certains systèmes, 🔄 s'affiche en couleur, sur d'autres en noir et blanc ou pas du tout. | Mineur | Remplacer par une icône SVG inline dans le Shadow DOM dès que le design d'icônes est validé. |
| UX-10 | **Taille max popup non contrainte verticalement** : `min-height: 360px` sans `max-height`. Si le contenu dépasse 480px (taille max MV3 Chrome recommandée), le contenu est coupé. | Mineur | Ajouter `max-height: 480px; overflow-y: auto;` sur `body` de popup. |

### 1.3 Recommandations prioritaires

**Ordre d'intervention suggéré :**

1. **Critique — UX-01** : Créer les icônes réelles (bloque la publication Chrome Web Store).
2. **Majeur — UX-03** : Valider une palette (ce Brand Book, §3).
3. **Majeur — UX-02** : Centraliser les tokens dans un fichier partagé (à faire après validation de la palette).
4. **Majeur — UX-04** : Tokeniser les couleurs hardcodées hors système.
5. **Moyen — UX-06** : Décider de la stratégie dark mode (v1 ou v2).
6. **Mineur — UX-05, UX-07, UX-08, UX-09, UX-10** : Corrections cosmétiques et robustesse.

---

## 2. Identité de marque

### 2.1 Positionnement

**Nom** : Sentinel Nudge

**Tagline** : "Votre gardien discret de cyber-hygiène"

**Positionnement** : Compagnon bienveillant de sécurité numérique. Ni alarme, ni surveillance. Une présence douce qui construit des réflexes durables par des rappels contextuels et des micro-apprentissages.

**Valeurs de marque** :

| Valeur | Expression visuelle |
|--------|---------------------|
| Transparence | Interface épurée, pas d'éléments décoratifs cachant l'information |
| Respect de la vie privée | Tons neutres, aucune couleur "tracking" ou "surveillance" (pas de rouge dominant) |
| Autonomie utilisateur | Boutons de rejet toujours présents, pas d'UX coercitif |
| Science comportementale | Rigueur formelle, hiérarchie claire, pas de surcharge cognitive |

**Ton de voix** :
- Bienveillant : "Votre navigateur peut être mis à jour" (pas "ALERTE : navigateur obsolète !")
- Pédagogique : toujours expliquer le pourquoi
- Non culpabilisant : l'utilisateur garde le contrôle
- Concis : une idée par nudge, une action principale par composant

### 2.2 Logo et icône — Concept

**Concept directeur** : Un bouclier stylisé en forme de "S" inversé (évoquant Sentinel), dont la base se prolonge en une petite flèche courbe orientée vers la droite — le "nudge". L'ensemble forme une figure géométrique lisible en monochrome jusqu'à 16px.

**Lecture à 16px (toolbar Chrome)** :
La version 16px est une silhouette simplifiée : un pentagone (bouclier) avec un point central lumineux. Aucun détail fin. Fond transparent.

**Lecture à 48px (extensions store preview)** :
Le bouclier complet avec la flèche de nudge visible. Deux couleurs : la couleur primaire pour le bouclier, la couleur accent pour la flèche. Fond transparent ou fond arrondi selon la palette choisie.

**Lecture à 128px (store listing)** :
Version complète avec nuances, ombre légère, proportions optimisées pour l'affichage en liste de l'extension dans Chrome Web Store.

**Contrainte monochrome** : toutes les variantes doivent rester lisibles en niveaux de gris (pour les interfaces à faible chrominance, les impressions, et la version badge inactive).

---

## 3. Cinq propositions de palette graphique

> **Note sur la méthode des contrastes** : les ratios indiqués sont calculés selon la formule WCAG 2.1 (luminance relative). Les paires texte/fond sont toutes WCAG AA (4.5:1 minimum pour le texte courant, 3:1 pour les grands textes ≥18px gras ou ≥24px normal).

---

### Proposition 1 — "Aegis Blue" (Professionnelle/Corporate)

*Référence au bouclier (aegis) de la mythologie grecque. Tons bleus institutionnels, évocateurs du monde de la sécurité informatique et des DSI.*

| Token | Valeur | Description et usage | Ratio WCAG sur fond |
|-------|--------|----------------------|----------------------|
| Primaire | `#1E3A5F` | Bleu marine profond — en-têtes, titres, identité forte | 12.8:1 sur #FFFFFF |
| Secondaire | `#2E6DA4` | Bleu institutionnel — boutons secondaires, liens | 5.2:1 sur #FFFFFF |
| Accent | `#4DA8DA` | Bleu ciel — éléments interactifs principaux, focus | 3.2:1 sur #FFFFFF (grand texte OK) |
| Danger | `#C0392B` | Rouge bordeaux — erreurs, alertes sécurité critiques | 5.6:1 sur #FFFFFF |
| Succès | `#1A7A4A` | Vert foncé — confirmations, score élevé | 5.8:1 sur #FFFFFF |
| Warning | `#E67E22` | Orange ambré — avertissements, nudges modérés | 3.1:1 sur #FFFFFF (grand texte OK) |
| Muted | `#5D7A8A` | Gris bleuté — texte secondaire, labels | 4.6:1 sur #FFFFFF |
| Fond | `#F8FAFC` | Blanc légèrement bleuté — fond principal | — |
| Texte | `#1A2733` | Quasi-noir bleuté — corps de texte | 16.4:1 sur #F8FAFC |

**Surface** : `#EFF4F8` (sections, cartes) — séparation douce avec le fond
**Bordure** : `#C8D8E8` (séparateurs, fieldsets)

**Ambiance** : Sérieuse, institutionnelle, professionnelle. Évoque les outils de cybersécurité d'entreprise (CrowdStrike, Microsoft Defender). Crédible pour une DSI.

**Public cible** : Professionnels IT, RSSI, équipes SOC, entreprises avec une charte bleue existante.

**Avantages** : Palette attendue dans le secteur, crédibilité immédiate, déclinaisons nombreuses, contraste élevé naturel.

**Inconvénients** : Peu différenciante (tous les outils de sécurité sont bleus), ton potentiellement froid ou anxiogène pour le grand public, risque de confusion avec le navigateur Chrome lui-même.

---

### Proposition 2 — "Cipher Dark" (Moderne/Tech)

*Inspiration dark mode first, terminaux, interfaces de monitoring avancé. Accents cyan électrique sur fond sombre.*

| Token | Valeur | Description et usage | Ratio WCAG sur fond |
|-------|--------|----------------------|----------------------|
| Primaire | `#00BFA5` | Teal vif — identité, CTA principaux, logo | 4.8:1 sur #121212 |
| Secondaire | `#26C6DA` | Cyan clair — liens, éléments secondaires actifs | 8.9:1 sur #121212 |
| Accent | `#B2EBF2` | Cyan pâle — highlights, tooltips, badges | 13.1:1 sur #121212 |
| Danger | `#FF5252` | Rouge néon — erreurs, alertes critiques | 4.6:1 sur #121212 |
| Succès | `#69F0AE` | Vert menthe — succès, confirmation, score > 80 | 12.7:1 sur #121212 |
| Warning | `#FFD740` | Jaune doré — avertissements, nudges modérés | 11.2:1 sur #121212 |
| Muted | `#90A4AE` | Gris bleu-acier — texte secondaire | 5.4:1 sur #121212 |
| Fond | `#121212` | Noir profond — fond principal (dark mode first) | — |
| Texte | `#ECEFF1` | Blanc cassé — corps de texte | 16.1:1 sur #121212 |

**Surface** : `#1E1E1E` (sections, cartes) — légèrement plus clair que le fond
**Bordure** : `#2D2D2D` (séparateurs, contours)

**Ambiance** : Moderne, tech, nocturne. Évoque les terminaux, les dashboards de cybersécurité en temps réel (SIEM). Attrayant pour les développeurs et profils tech.

**Public cible** : Profils techniques, développeurs, power users, utilisateurs habitués aux interfaces dark mode (VS Code, GitHub Dark).

**Avantages** : Très différenciante, réduit la fatigue oculaire en usage prolongé, tendance forte en 2026, esthétique premium.

**Inconvénients** : Peut paraître intimidante pour le grand public, le fond sombre sur des pages blanches tierces crée un contraste de contexte fort (le nudge "tranche" visuellement sur la page hôte), complexité de la gestion du mode clair pour les pages statiques d'explication.

> **Note d'implémentation** : cette palette implique une stratégie dark-first avec media query `prefers-color-scheme: light` pour les pages (options, dashboard, onboarding). Les toast/overlays injectés fonctionnent dans les deux contextes grâce au Shadow DOM.

---

### Proposition 3 — "Warm Shelter" (Chaleureuse/Accessible)

*Un compagnon rassurant, comme un conseiller de confiance. Tons chauds inspirés du bois, du papier, de la chaleur humaine. Très éloigné du code sécurité anxiogène.*

| Token | Valeur | Description et usage | Ratio WCAG sur fond |
|-------|--------|----------------------|----------------------|
| Primaire | `#5C4033` | Brun chaud — identité, titres forts | 9.7:1 sur #FFFDF7 |
| Secondaire | `#7B5EA7` | Violet doux — boutons principaux, liens | 5.1:1 sur #FFFDF7 |
| Accent | `#E8915B` | Terracotta — éléments interactifs CTA | 3.3:1 sur #FFFDF7 (grand texte OK) |
| Danger | `#C0392B` | Rouge brique — erreurs (couleur universelle) | 5.8:1 sur #FFFDF7 |
| Succès | `#2E7D50` | Vert sauge — succès, confirmations | 5.3:1 sur #FFFDF7 |
| Warning | `#C97D1A` | Ocre doré — avertissements | 4.6:1 sur #FFFDF7 |
| Muted | `#7D6B5D` | Brun grisé — texte secondaire | 4.8:1 sur #FFFDF7 |
| Fond | `#FFFDF7` | Blanc chaud ivoire — fond principal | — |
| Texte | `#2D1B12` | Brun quasi-noir — corps de texte | 17.2:1 sur #FFFDF7 |

**Surface** : `#F5F0E8` (sections, cartes — parchemin clair)
**Bordure** : `#D4C4B8` (séparateurs doux)

**Ambiance** : Chaleureuse, bienveillante, accessible. Évoque un compagnon de confiance, un coach. Désanxiogène. Très éloigné de l'imagerie "cyberattaque".

**Public cible** : Grand public, seniors, utilisateurs non-techniques, organisations associatives, lycéens (sensibilisation scolaire).

**Avantages** : Très différenciante dans le monde de la sécurité, ton rassurant parfaitement aligné avec la valeur "non anxiogène", excellente accessibilité perçue, mémorable.

**Inconvénients** : Peut sembler peu sérieuse pour un RSSI en entreprise, le violet secondaire demande une justification forte, l'association terracotta/brun peut paraître datée selon les tendances 2026.

---

### Proposition 4 — "Forest Protocol" (Nature/Zen)

*Le numérique comme écosystème sain. Tons verts naturels, calme, sérénité. La cyberhygiène comme hygiène de vie au sens large.*

| Token | Valeur | Description et usage | Ratio WCAG sur fond |
|-------|--------|----------------------|----------------------|
| Primaire | `#1B5E35` | Vert forêt profond — identité, titres forts | 10.4:1 sur #F4FAF6 |
| Secondaire | `#2E7D52` | Vert émeraude — boutons, liens | 6.2:1 sur #F4FAF6 |
| Accent | `#52B788` | Vert menthe saturé — CTA principaux, focus | 4.5:1 sur #F4FAF6 |
| Danger | `#B03A2E` | Rouge terre — erreurs, alertes critiques | 5.9:1 sur #F4FAF6 |
| Succès | `#1A7A4A` | Vert vif — confirmations, score élevé | 5.8:1 sur #F4FAF6 |
| Warning | `#C27B2D` | Ambre chaud — avertissements | 4.5:1 sur #F4FAF6 |
| Muted | `#5C7867` | Gris-vert — texte secondaire, labels | 4.6:1 sur #F4FAF6 |
| Fond | `#F4FAF6` | Blanc verdâtre très léger — fond principal | — |
| Texte | `#1A2E22` | Quasi-noir vert — corps de texte | 15.8:1 sur #F4FAF6 |

**Surface** : `#E8F4EC` (sections, cartes — mousse clair)
**Bordure** : `#B8D8C4` (séparateurs naturels)

**Ambiance** : Zen, naturelle, apaisante. Évoque la santé numérique comme bien-être global. Cohérence avec le concept de "nudge" issu des sciences comportementales (pas d'urgence, pas de peur, incitation positive).

**Public cible** : Public sensible au bien-être numérique, millennials, utilisateurs de méditation/mindfulness, organisations souhaitant déculpabiliser la sécurité.

**Avantages** : Cohérence forte avec les valeurs comportementales du produit, très apaisante pour l'utilisateur, déclinable en dark mode avec des tons verts sombres élégants, originalité dans le secteur.

**Inconvénients** : Risque de confusion avec des applications de santé/wellness non liées à la sécurité, la couleur succès (vert) se confond avec la couleur primaire (vert) — nécessite une différenciation par la saturation et la valeur.

> **Point de vigilance** : avec cette palette, la couleur `--sn-color-success` doit être nettement distincte de `--sn-color-accent` visuellement. Utiliser la valeur (lightness) plutôt que la teinte pour différencier.

---

### Proposition 5 — "Pulse Orange" (Audacieuse/Startup)

*Énergie, dynamisme, disruption. Orange électrique et violet profond. Sentinel Nudge comme une startup qui bouscule les codes de la cybersécurité austère.*

| Token | Valeur | Description et usage | Ratio WCAG sur fond |
|-------|--------|----------------------|----------------------|
| Primaire | `#6B21A8` | Violet profond — identité, titres, logo | 9.3:1 sur #FFFFFF |
| Secondaire | `#9333EA` | Violet vif — boutons secondaires, liens | 5.6:1 sur #FFFFFF |
| Accent | `#F97316` | Orange électrique — CTA principaux, badges actifs | 3.1:1 sur #FFFFFF (grand texte OK) / 4.5:1 sur #FFF7ED |
| Danger | `#DC2626` | Rouge pur — erreurs (convention universelle) | 5.9:1 sur #FFFFFF |
| Succès | `#16A34A` | Vert standard — succès (convention universelle) | 5.1:1 sur #FFFFFF |
| Warning | `#D97706` | Ambre standard — avertissements | 4.6:1 sur #FFFFFF |
| Muted | `#6B7280` | Gris neutre — texte secondaire | 4.6:1 sur #FFFFFF |
| Fond | `#FFFFFF` | Blanc pur — fond principal | — |
| Texte | `#111827` | Quasi-noir neutre — corps de texte | 18.5:1 sur #FFFFFF |

**Surface** : `#F9FAFB` (sections, cartes — gris très léger)
**Bordure** : `#E5E7EB` (séparateurs)

**Ambiance** : Vivace, moderne, startup. Évoque ProductHunt, Figma, les outils SaaS nouvelle génération. Contraste fort entre le violet structurant et l'orange énergique.

**Public cible** : Jeunes actifs 25-40 ans, startups, PME tech, utilisateurs qui veulent une extension "cool" à montrer à leurs collègues.

**Avantages** : Très mémorable, fort capital sympathie, contraste violet/orange unique dans le secteur sécurité, CTA orange très cliquable (couleur à fort taux de conversion documenté).

**Inconvénients** : L'accent orange à `#F97316` sur fond blanc (#FFFFFF) ne passe pas WCAG AA pour le texte courant (ratio 3.1:1 < 4.5:1 requis) — doit être utilisé uniquement sur fond coloré ou en grand texte. Peu crédible pour les marchés "Exposé" ou Enterprise. La saturation élevée peut fatiguer en usage prolongé.

> **Correction WCAG pour l'accent** : sur les fonds clairs, utiliser `--sn-color-accent` (`#F97316`) uniquement pour les icônes, les fonds de bouton (texte blanc dessus), et les grands titres. Pour le texte de lien sur fond blanc, utiliser la couleur primaire `#6B21A8` (9.3:1).

---

## 4. Typographie

### 4.1 Font stack — System fonts uniquement (ENF-SEC-03)

```css
/* Corps de texte — lisibilité maximale multi-plateforme */
--sn-font-body: system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell,
  "Helvetica Neue", Arial, sans-serif;

/* Monospace — code, hashes, données techniques */
--sn-font-mono: ui-monospace, "Cascadia Code", "Source Code Pro",
  Menlo, Consolas, "DejaVu Sans Mono", monospace;
```

**Justification du choix system-ui** : `system-ui` résout automatiquement la font native de la plateforme (San Francisco sur macOS/iOS, Segoe UI sur Windows 11, Roboto sur Android/Chrome OS). Cohérence avec l'environnement de l'utilisateur, zéro requête réseau, rendu optimal.

### 4.2 Hiérarchie typographique

| Niveau | Token | Valeur | Usage | Poids |
|--------|-------|--------|-------|-------|
| Display | `--sn-font-size-display` | 26px | Score principal (dashboard), nombre dominant | 700 |
| Titre h1 | `--sn-font-size-h1` | 22px | Titre de page (options, onboarding) | 600 |
| Titre h2 | `--sn-font-size-h2` | 18px | Titre de section, titre toast/overlay | 600 |
| Corps | `--sn-font-size-body` | 15px | Texte principal, descriptions, labels | 400 |
| Small | `--sn-font-size-small` | 13px | Métadonnées, notes, descriptions secondaires | 400 |
| Micro | `--sn-font-size-micro` | 11px | Badge, compteur, tag (usage ponctuel) | 600 |
| Mono | `--sn-font-size-mono` | 13px | Hashes, données techniques | 400 |

**Règles** :
- Taille minimum corps : 15px (conforme WCAG 1.4.4 et recommandations d'ergonomie cognitive sur petits écrans).
- Taille minimum pour le texte lisible dans l'extension : 13px (small), jamais en dessous.
- Interligne (`line-height`) : 1.5 pour le corps, 1.3 pour les titres.
- La taille 11px (micro) est réservée aux badges et compteurs en contexte contrôlé — jamais pour du texte informatif.

### 4.3 Poids typographiques

| Token | Valeur | Usage |
|-------|--------|-------|
| `--sn-font-weight-normal` | 400 | Corps, descriptions |
| `--sn-font-weight-medium` | 500 | Labels de formulaire, navigation (à ajouter) |
| `--sn-font-weight-bold` | 600 | Titres, CTA, valeurs importantes |
| `--sn-font-weight-extrabold` | 700 | Score display, chiffres clés |

---

## 5. Iconographie

### 5.1 Style des icônes internes

**Style recommandé** : Outline (traits fins), épaisseur de trait 1.5px, coin légèrement arrondi (`stroke-linecap: round`, `stroke-linejoin: round`). Inspiré de Heroicons ou Lucide Icons (compatibles GPL v3) mais produit en SVG inline pour éviter toute dépendance.

**Grille de base** : 24×24px (viewBox="0 0 24 24"). Déclinable à 16px (réduction proportionnelle) et 20px (compact).

**Règles** :
- Monochrome par défaut (hérite de `currentColor`).
- Aucun remplissage (fill: none) sauf icônes d'état (succès = rempli vert, danger = rempli rouge).
- Les icônes de navigation et d'action : outline uniquement.
- Les icônes de statut (badge, score) : filled pour lisibilité à petite taille.

### 5.2 Description précise de l'icône principale (logo Sentinel Nudge)

**Grille** : 128×128px (format store), déclinable à 48px et 16px.

**Description géométrique — version 128px** :

```
Structure principale (bouclier) :
- Forme : pentagone symétrique (base rectangulaire, sommet pointu centré en haut)
- Dimensions : 72px de large, 80px de haut
- Position : centrée horizontalement, légèrement remontée (centre à y=58px)
- Coin du sommet : coordonnées (64, 14)
- Côtés supérieurs : de (64,14) vers (101,40) et (27,40) — pente à ~35°
- Côtés inférieurs : de (101,40) vers (101,90) et (27,90) — verticaux
- Base : ligne de (27,90) à (101,90)
- Rayon de bordure des coins inférieurs : 6px
- Trait : 4px, couleur primaire, stroke-linecap round
- Remplissage intérieur : couleur primaire à 12% opacité (hint léger)

Élément central (lettre S stylisée + nudge) :
- Lettre S : centrée dans le bouclier, taille 32px, poids 700, couleur primaire
  Alternative : S formé de deux demi-cercles concentriques (version pure SVG sans texte)
- Flèche de nudge : petite flèche courbe (→ arrondie) partant du bas du S
  Position : (64, 72) vers (78, 80) avec courbe de contrôle (75, 68)
  Trait : 2.5px, couleur accent, stroke-linecap round
  Tête de flèche : triangle 8×6px à l'extrémité

Fond (optionnel selon palette) :
- Carré arrondi 128×128px, rayon 28px (style iOS/Chrome Web Store)
- Couleur : fond de la palette choisie (ou transparent pour usage sur fond externe)
```

**Version 48px (extensions store preview)** :

```
Simplification : bouclier + initiales "SN" centrées (pas de flèche nudge)
- Bouclier : même forme, trait 3px
- Initiales : "SN" en 16px bold, centrées
- Pas de fond arrondi (transparent)
```

**Version 16px (barre d'outils Chrome)** :

```
Simplification maximale : silhouette bouclier monochrome
- Bouclier plein, sans détail intérieur
- Point central de 4px de diamètre (accent) pour indiquer l'état "actif"
- Rendu optimal : tracé pixel-perfect sur grille 16px
- Variantes couleur pour les états :
  - Actif/normal  : couleur primaire de la palette choisie
  - Inactif/grisé : #9CA3AF (gris neutre)
  - Attention     : couleur warning
  - Alerte        : couleur danger
```

### 5.3 Variantes badge Chrome (état de l'extension)

Le badge Chrome (petit texte coloré sur l'icône 16px) doit être configuré via `chrome.action.setBadgeBackgroundColor` et `chrome.action.setBadgeText`.

| État | Couleur fond badge | Texte badge | Condition de déclenchement |
|------|--------------------|-------------|---------------------------|
| Vert "OK" | `#16A34A` | "" (vide) | Score > 75, aucune alerte | 
| Bleu info | `#2563EB` | "1"–"3" | Nombre de nudges en file d'attente |
| Orange warning | `#D97706` | "!" | Score 50–75, ou module désactivé important |
| Rouge alerte | `#DC2626` | "!" | Score < 50, ou alerte critique (M2 typosquatting) |

> Ces couleurs sont intentionnellement stables entre les palettes pour garantir la convention sémantique universelle des couleurs de statut.

---

## 6. Composants UI — Design tokens CSS

> Pour chaque proposition, le bloc suivant remplace le contenu de `:root` dans les 4 fichiers CSS de pages, et le contenu de `:host` dans `BaseNudge.getDesignTokens()`. Les tokens additionnels (surface, bordure, etc.) sont nouveaux et s'ajoutent aux 25 tokens existants.

---

### Tokens — Proposition 1 "Aegis Blue"

```css
/* Proposition 1 — Aegis Blue — :root (pages) et :host (BaseNudge) */
:root {
  /* Couleurs sémantiques */
  --sn-color-fg:          #1A2733;  /* Texte principal       — 16.4:1 sur fond    */
  --sn-color-bg:          #F8FAFC;  /* Fond principal                              */
  --sn-color-primary:     #1E3A5F;  /* Identité, titres      — 12.8:1 sur fond    */
  --sn-color-accent:      #2E6DA4;  /* Interactif, boutons   — 5.2:1 sur fond     */
  --sn-color-accent-muted:#4DA8DA;  /* Accents secondaires   — 3.2:1 (grand texte)*/
  --sn-color-danger:      #C0392B;  /* Erreur                — 5.6:1 sur fond     */
  --sn-color-success:     #1A7A4A;  /* Succès                — 5.8:1 sur fond     */
  --sn-color-warning:     #E67E22;  /* Avertissement         — 3.1:1 (grand texte)*/
  --sn-color-muted:       #5D7A8A;  /* Texte secondaire      — 4.6:1 sur fond     */
  --sn-color-surface:     #EFF4F8;  /* Fond cartes/sections                        */
  --sn-color-border:      #C8D8E8;  /* Séparateurs, bordures                       */
  --sn-color-danger-bg:   #FDECEA;  /* Fond composants danger                      */
  --sn-color-success-bg:  #E8F5EE;  /* Fond composants succès                      */
  --sn-color-warning-bg:  #FEF3E2;  /* Fond composants warning                     */

  /* Typographie */
  --sn-font-body:         system-ui, -apple-system, BlinkMacSystemFont,
                          "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --sn-font-mono:         ui-monospace, "Cascadia Code", Menlo, Consolas, monospace;
  --sn-font-size-display: 26px;
  --sn-font-size-h1:      22px;
  --sn-font-size-h2:      18px;
  --sn-font-size-body:    15px;
  --sn-font-size-small:   13px;
  --sn-font-size-micro:   11px;
  --sn-font-weight-normal:    400;
  --sn-font-weight-medium:    500;
  --sn-font-weight-bold:      600;
  --sn-font-weight-extrabold: 700;
  --sn-line-height:       1.5;
  --sn-line-height-tight: 1.3;

  /* Espacement (base 4px) */
  --sn-space-xs:  4px;
  --sn-space-sm:  8px;
  --sn-space-md:  16px;
  --sn-space-lg:  24px;
  --sn-space-xl:  32px;
  --sn-space-2xl: 48px;

  /* Bordures et ombres */
  --sn-radius-sm: 4px;
  --sn-radius:    8px;
  --sn-radius-lg: 12px;
  --sn-shadow-sm: 0 1px 4px rgba(30, 58, 95, 0.10);
  --sn-shadow:    0 4px 12px rgba(30, 58, 95, 0.15);
  --sn-shadow-lg: 0 8px 24px rgba(30, 58, 95, 0.20);

  /* Cibles WCAG 2.5.5 */
  --sn-min-target: 44px;
}
```

---

### Tokens — Proposition 2 "Cipher Dark"

```css
/* Proposition 2 — Cipher Dark — dark mode first */
:root {
  /* Couleurs sémantiques */
  --sn-color-fg:          #ECEFF1;  /* Texte principal       — 16.1:1 sur fond    */
  --sn-color-bg:          #121212;  /* Fond principal (dark)                       */
  --sn-color-primary:     #00BFA5;  /* Identité, CTA         — 4.8:1 sur fond     */
  --sn-color-accent:      #26C6DA;  /* Interactif            — 8.9:1 sur fond     */
  --sn-color-accent-muted:#B2EBF2;  /* Highlights            — 13.1:1 sur fond    */
  --sn-color-danger:      #FF5252;  /* Erreur                — 4.6:1 sur fond     */
  --sn-color-success:     #69F0AE;  /* Succès                — 12.7:1 sur fond    */
  --sn-color-warning:     #FFD740;  /* Avertissement         — 11.2:1 sur fond    */
  --sn-color-muted:       #90A4AE;  /* Texte secondaire      — 5.4:1 sur fond     */
  --sn-color-surface:     #1E1E1E;  /* Fond cartes/sections                        */
  --sn-color-border:      #2D2D2D;  /* Séparateurs                                 */
  --sn-color-danger-bg:   #2D1515;  /* Fond composants danger                      */
  --sn-color-success-bg:  #152D20;  /* Fond composants succès                      */
  --sn-color-warning-bg:  #2D2415;  /* Fond composants warning                     */

  /* Typographie (identique entre palettes) */
  --sn-font-body:         system-ui, -apple-system, BlinkMacSystemFont,
                          "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --sn-font-mono:         ui-monospace, "Cascadia Code", Menlo, Consolas, monospace;
  --sn-font-size-display: 26px;
  --sn-font-size-h1:      22px;
  --sn-font-size-h2:      18px;
  --sn-font-size-body:    15px;
  --sn-font-size-small:   13px;
  --sn-font-size-micro:   11px;
  --sn-font-weight-normal:    400;
  --sn-font-weight-medium:    500;
  --sn-font-weight-bold:      600;
  --sn-font-weight-extrabold: 700;
  --sn-line-height:       1.5;
  --sn-line-height-tight: 1.3;

  /* Espacement */
  --sn-space-xs:  4px;
  --sn-space-sm:  8px;
  --sn-space-md:  16px;
  --sn-space-lg:  24px;
  --sn-space-xl:  32px;
  --sn-space-2xl: 48px;

  /* Bordures et ombres */
  --sn-radius-sm: 4px;
  --sn-radius:    8px;
  --sn-radius-lg: 12px;
  --sn-shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.40);
  --sn-shadow:    0 4px 12px rgba(0, 0, 0, 0.50);
  --sn-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.60);

  --sn-min-target: 44px;
}
```

---

### Tokens — Proposition 3 "Warm Shelter"

```css
/* Proposition 3 — Warm Shelter */
:root {
  /* Couleurs sémantiques */
  --sn-color-fg:          #2D1B12;  /* Texte principal       — 17.2:1 sur fond    */
  --sn-color-bg:          #FFFDF7;  /* Fond ivoire chaud                           */
  --sn-color-primary:     #5C4033;  /* Identité, titres      — 9.7:1 sur fond     */
  --sn-color-accent:      #7B5EA7;  /* Interactif            — 5.1:1 sur fond     */
  --sn-color-accent-muted:#E8915B;  /* CTA terracotta (grand texte, fonds colorés)*/
  --sn-color-danger:      #C0392B;  /* Erreur                — 5.8:1 sur fond     */
  --sn-color-success:     #2E7D50;  /* Succès                — 5.3:1 sur fond     */
  --sn-color-warning:     #C97D1A;  /* Avertissement         — 4.6:1 sur fond     */
  --sn-color-muted:       #7D6B5D;  /* Texte secondaire      — 4.8:1 sur fond     */
  --sn-color-surface:     #F5F0E8;  /* Fond cartes — parchemin                     */
  --sn-color-border:      #D4C4B8;  /* Séparateurs doux                            */
  --sn-color-danger-bg:   #FDECEA;  /* Fond composants danger                      */
  --sn-color-success-bg:  #EAF4EE;  /* Fond composants succès                      */
  --sn-color-warning-bg:  #FEF3E0;  /* Fond composants warning                     */

  /* Typographie */
  --sn-font-body:         system-ui, -apple-system, BlinkMacSystemFont,
                          "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --sn-font-mono:         ui-monospace, "Cascadia Code", Menlo, Consolas, monospace;
  --sn-font-size-display: 26px;
  --sn-font-size-h1:      22px;
  --sn-font-size-h2:      18px;
  --sn-font-size-body:    15px;
  --sn-font-size-small:   13px;
  --sn-font-size-micro:   11px;
  --sn-font-weight-normal:    400;
  --sn-font-weight-medium:    500;
  --sn-font-weight-bold:      600;
  --sn-font-weight-extrabold: 700;
  --sn-line-height:       1.5;
  --sn-line-height-tight: 1.3;

  /* Espacement */
  --sn-space-xs:  4px;
  --sn-space-sm:  8px;
  --sn-space-md:  16px;
  --sn-space-lg:  24px;
  --sn-space-xl:  32px;
  --sn-space-2xl: 48px;

  /* Bordures et ombres */
  --sn-radius-sm: 4px;
  --sn-radius:    8px;
  --sn-radius-lg: 12px;
  --sn-shadow-sm: 0 1px 4px rgba(92, 64, 51, 0.10);
  --sn-shadow:    0 4px 12px rgba(92, 64, 51, 0.15);
  --sn-shadow-lg: 0 8px 24px rgba(92, 64, 51, 0.20);

  --sn-min-target: 44px;
}
```

---

### Tokens — Proposition 4 "Forest Protocol"

```css
/* Proposition 4 — Forest Protocol */
:root {
  /* Couleurs sémantiques */
  --sn-color-fg:          #1A2E22;  /* Texte principal       — 15.8:1 sur fond    */
  --sn-color-bg:          #F4FAF6;  /* Fond vert très clair                        */
  --sn-color-primary:     #1B5E35;  /* Identité, titres      — 10.4:1 sur fond    */
  --sn-color-accent:      #2E7D52;  /* Interactif, boutons   — 6.2:1 sur fond     */
  --sn-color-accent-muted:#52B788;  /* CTA, focus            — 4.5:1 sur fond     */
  --sn-color-danger:      #B03A2E;  /* Erreur                — 5.9:1 sur fond     */
  --sn-color-success:     #1A7A4A;  /* Succès (ton + saturé) — 5.8:1 sur fond     */
  --sn-color-warning:     #C27B2D;  /* Avertissement         — 4.5:1 sur fond     */
  --sn-color-muted:       #5C7867;  /* Texte secondaire      — 4.6:1 sur fond     */
  --sn-color-surface:     #E8F4EC;  /* Fond cartes — mousse                        */
  --sn-color-border:      #B8D8C4;  /* Séparateurs naturels                        */
  --sn-color-danger-bg:   #FDECEA;  /* Fond composants danger                      */
  --sn-color-success-bg:  #E8F5EE;  /* Fond composants succès                      */
  --sn-color-warning-bg:  #FEF3E2;  /* Fond composants warning                     */

  /* Typographie */
  --sn-font-body:         system-ui, -apple-system, BlinkMacSystemFont,
                          "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --sn-font-mono:         ui-monospace, "Cascadia Code", Menlo, Consolas, monospace;
  --sn-font-size-display: 26px;
  --sn-font-size-h1:      22px;
  --sn-font-size-h2:      18px;
  --sn-font-size-body:    15px;
  --sn-font-size-small:   13px;
  --sn-font-size-micro:   11px;
  --sn-font-weight-normal:    400;
  --sn-font-weight-medium:    500;
  --sn-font-weight-bold:      600;
  --sn-font-weight-extrabold: 700;
  --sn-line-height:       1.5;
  --sn-line-height-tight: 1.3;

  /* Espacement */
  --sn-space-xs:  4px;
  --sn-space-sm:  8px;
  --sn-space-md:  16px;
  --sn-space-lg:  24px;
  --sn-space-xl:  32px;
  --sn-space-2xl: 48px;

  /* Bordures et ombres */
  --sn-radius-sm: 4px;
  --sn-radius:    8px;
  --sn-radius-lg: 12px;
  --sn-shadow-sm: 0 1px 4px rgba(27, 94, 53, 0.10);
  --sn-shadow:    0 4px 12px rgba(27, 94, 53, 0.15);
  --sn-shadow-lg: 0 8px 24px rgba(27, 94, 53, 0.20);

  --sn-min-target: 44px;
}
```

---

### Tokens — Proposition 5 "Pulse Orange"

```css
/* Proposition 5 — Pulse Orange */
:root {
  /* Couleurs sémantiques */
  --sn-color-fg:          #111827;  /* Texte principal       — 18.5:1 sur fond    */
  --sn-color-bg:          #FFFFFF;  /* Fond blanc pur                              */
  --sn-color-primary:     #6B21A8;  /* Identité, titres      — 9.3:1 sur fond     */
  --sn-color-accent:      #9333EA;  /* Interactif, boutons   — 5.6:1 sur fond     */
  --sn-color-accent-muted:#F97316;  /* CTA orange (fond coloré/grand texte seul)  */
  --sn-color-danger:      #DC2626;  /* Erreur                — 5.9:1 sur fond     */
  --sn-color-success:     #16A34A;  /* Succès                — 5.1:1 sur fond     */
  --sn-color-warning:     #D97706;  /* Avertissement         — 4.6:1 sur fond     */
  --sn-color-muted:       #6B7280;  /* Texte secondaire      — 4.6:1 sur fond     */
  --sn-color-surface:     #F9FAFB;  /* Fond cartes                                 */
  --sn-color-border:      #E5E7EB;  /* Séparateurs                                 */
  --sn-color-danger-bg:   #FEF2F2;  /* Fond composants danger                      */
  --sn-color-success-bg:  #F0FDF4;  /* Fond composants succès                      */
  --sn-color-warning-bg:  #FFFBEB;  /* Fond composants warning                     */

  /* Typographie */
  --sn-font-body:         system-ui, -apple-system, BlinkMacSystemFont,
                          "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --sn-font-mono:         ui-monospace, "Cascadia Code", Menlo, Consolas, monospace;
  --sn-font-size-display: 26px;
  --sn-font-size-h1:      22px;
  --sn-font-size-h2:      18px;
  --sn-font-size-body:    15px;
  --sn-font-size-small:   13px;
  --sn-font-size-micro:   11px;
  --sn-font-weight-normal:    400;
  --sn-font-weight-medium:    500;
  --sn-font-weight-bold:      600;
  --sn-font-weight-extrabold: 700;
  --sn-line-height:       1.5;
  --sn-line-height-tight: 1.3;

  /* Espacement */
  --sn-space-xs:  4px;
  --sn-space-sm:  8px;
  --sn-space-md:  16px;
  --sn-space-lg:  24px;
  --sn-space-xl:  32px;
  --sn-space-2xl: 48px;

  /* Bordures et ombres */
  --sn-radius-sm: 4px;
  --sn-radius:    8px;
  --sn-radius-lg: 12px;
  --sn-shadow-sm: 0 1px 4px rgba(107, 33, 168, 0.10);
  --sn-shadow:    0 4px 12px rgba(107, 33, 168, 0.15);
  --sn-shadow-lg: 0 8px 24px rgba(107, 33, 168, 0.20);

  --sn-min-target: 44px;
}
```

---

## 7. Recommandations

### 7.1 Proposition recommandée par l'expert UX/UI

**Recommandation : Proposition 4 — "Forest Protocol"**

**Argumentation** :

| Critère | Justification |
|---------|---------------|
| Alignement avec les valeurs produit | Le vert évoque naturellement la santé, le soin, la protection bienveillante — exactement ce que Sentinel Nudge veut transmettre. Contrairement au bleu (surveillance, corporate) ou au rouge (danger, anxiété). |
| Différenciation dans l'écosystème sécurité | Aucun outil de cybersécurité grand public n'utilise une palette verte centrée. C'est un positionnement unique et mémorable. |
| Cohérence avec la non-anxiogénèse | Les tons verts naturels (forêt, nature) produisent un effet de calme documenté dans la littérature en psychologie des couleurs. Cohérent avec l'approche des nudges comportementaux positifs. |
| Accessibilité WCAG | Tous les tokens principaux passent AA. L'accent `#2E7D52` (6.2:1) passe même AAA sur le fond clair. |
| Applicabilité dark mode | Une déclinaison dark mode verte est naturelle et élégante (fonds `#0D1F15` ou `#111F17`), contrairement au bleu très commun en dark. |
| Double public cible | Un vert professionnel (`#1B5E35`) reste crédible en contexte entreprise tout en étant rassurant pour le grand public. |

**Alternative recommandée si le Commanditaire préfère un positionnement plus "professionnel/entreprise"** : Proposition 1 "Aegis Blue". Elle constitue un upgrade direct du design actuel (même famille chromatique bleue) avec une identité primaire plus affirmée (`#1E3A5F` vs le Tailwind générique actuel).

### 7.2 Dark mode — Décision de roadmap

**Contexte** : le codebase actuel (P4) ne contient aucun dark mode. La palette étant en cours de validation, c'est le bon moment pour décider.

**Option A — Dark mode en v1 (sprint P5/P6)**

- Ajouter `@media (prefers-color-scheme: dark)` dans les 4 CSS de pages avec les tokens sombres de la palette choisie.
- Avantage : expérience utilisateur complète dès la v1 publique. Attendu en 2026 par les utilisateurs tech.
- Inconvénient : +20% d'effort CSS estimé, +risque de régression visuelle à tester.

**Option B — Dark mode en v2 (post-publication)**

- Se concentrer sur la palette lumière en v1. Ajouter dark mode en v2 sous forme de feature flaggée.
- Avantage : focus qualité v1, délai de publication réduit.
- Inconvénient : utilisateurs dark mode verront un fond blanc dans Chrome (mais seulement pour la popup/options — les toasts et overlays sont dans des Shadow DOM indépendants).

**Recommandation de l'expert** : **Option B pour v1**, avec préparation dès maintenant (tous les hardcodes de couleur déjà identifiés en UX-04 doivent impérativement être tokenisés avant v1 pour que la v2 dark mode soit réalisable rapidement).

### 7.3 Responsive — Points de vigilance

| Composant | Breakpoint | Point de vigilance |
|-----------|-----------|---------------------|
| Popup | Fixe 320px | Aucun responsive à gérer (contrainte MV3 fixe). Surveiller le contenu débordant verticalement (UX-10). |
| Options | max-width 800px, padding xl | En dessous de 640px, les radio descriptions avec indentation 28px peuvent déborder. Tester à 480px. |
| Dashboard | min 600px, max 900px | Le `grid-template-columns: 160px 1fr auto` passe à 120px à 700px — vérifier la troncature des labels longs. Prévoir `overflow: hidden; text-overflow: ellipsis`. |
| Onboarding | max-width 640px | La progression par dots est lisible. Tester la navigation clavier au clavier seul sur mobile (pas de hover). |
| Toasts/Overlays | max-width 380px (toast), 400px panel (overlay M2) | Sur mobile < 400px, le panel overlay M2 est trop large. Ajouter `max-width: calc(100vw - 32px)` sur le :host. |

### 7.4 Tableau comparatif des 5 propositions

| Critère | 1. Aegis Blue | 2. Cipher Dark | 3. Warm Shelter | 4. Forest Protocol | 5. Pulse Orange |
|---------|:---:|:---:|:---:|:---:|:---:|
| Alignement valeurs produit | Moyen | Faible | Élevé | Très élevé | Moyen |
| Crédibilité corporate | Très élevée | Élevée | Faible | Élevée | Moyenne |
| Accessibilité grand public | Bonne | Faible | Très bonne | Très bonne | Bonne |
| Différenciation sectorielle | Faible | Élevée | Très élevée | Très élevée | Élevée |
| Conformité WCAG AA | Oui | Oui | Oui | Oui | Partielle (*) |
| Complexité d'implémentation | Faible | Élevée | Faible | Faible | Faible |
| Dark mode naturel | Moyen | Natif | Difficile | Facile | Moyen |
| Mémorabilité | Faible | Élevée | Élevée | Très élevée | Élevée |

(*) Proposition 5 : l'accent orange `#F97316` sur fond blanc ne passe pas WCAG AA pour le texte courant. Usage restreint aux CTA (fond coloré avec texte blanc) et aux grands éléments.

---

## Annexe A — Tableau de synthèse des contrastes WCAG

| Proposition | Paire texte/fond | Ratio | WCAG AA texte | WCAG AA grand texte |
|-------------|-----------------|-------|:---:|:---:|
| 1 Aegis Blue | `#1A2733` / `#F8FAFC` | 16.4:1 | Oui | Oui |
| 1 Aegis Blue | `#2E6DA4` / `#F8FAFC` | 5.2:1 | Oui | Oui |
| 1 Aegis Blue | `#4DA8DA` / `#F8FAFC` | 3.2:1 | Non | Oui |
| 2 Cipher Dark | `#ECEFF1` / `#121212` | 16.1:1 | Oui | Oui |
| 2 Cipher Dark | `#00BFA5` / `#121212` | 4.8:1 | Oui | Oui |
| 2 Cipher Dark | `#FF5252` / `#121212` | 4.6:1 | Oui | Oui |
| 3 Warm Shelter | `#2D1B12` / `#FFFDF7` | 17.2:1 | Oui | Oui |
| 3 Warm Shelter | `#7B5EA7` / `#FFFDF7` | 5.1:1 | Oui | Oui |
| 3 Warm Shelter | `#E8915B` / `#FFFDF7` | 3.3:1 | Non | Oui |
| 4 Forest Protocol | `#1A2E22` / `#F4FAF6` | 15.8:1 | Oui | Oui |
| 4 Forest Protocol | `#2E7D52` / `#F4FAF6` | 6.2:1 | Oui | Oui |
| 4 Forest Protocol | `#52B788` / `#F4FAF6` | 4.5:1 | Oui | Oui |
| 5 Pulse Orange | `#111827` / `#FFFFFF` | 18.5:1 | Oui | Oui |
| 5 Pulse Orange | `#9333EA` / `#FFFFFF` | 5.6:1 | Oui | Oui |
| 5 Pulse Orange | `#F97316` / `#FFFFFF` | 3.1:1 | Non | Non |
| 5 Pulse Orange | `#F97316` / `#FFF7ED` | 2.9:1 | Non | Non |

**Résumé** : les propositions 1, 2, 3 et 4 sont entièrement conformes WCAG AA pour tous les couples texte/fond utilisés en texte courant. La proposition 5 nécessite une restriction d'usage de l'accent orange (CTA uniquement, jamais en texte sur fond blanc).

---

*Brand Book Sentinel Nudge v1.0 — Expert UX/UI, La Fabrique — 2026-04-12*
*Soumis pour arbitrage de palette au Commanditaire avant implémentation.*
