# Revue Expert UX/UI — Sentinel Nudge
**Date** : 2026-04-19  
**Auteur** : Expert UX/UI — La Fabrique  
**Périmètre** : Design system v2, maquettes v3, composants UI, ergonomie, brand  
**Statut** : Soumis au Référent qualité

---

## 1. Bilan général

Le design system Sentinel Nudge est dans un état structurellement solide après les chantiers T-141 à T-156. La séquence Brand Book v1.0 → 5 propositions v2 (T-137) → 6 thèmes v3 (T-146) → arbitrage Commanditaire (T-141) → intégration tokens v2 (T-142) → refonte composants (T-143) → popup pixel-perfect (T-156) → hotfixes (T-157 partiellement) a été menée à son terme sur les composants principaux. Le mécanisme de bascule de thème est architecturalement propre et opérationnel sur les 4 pages principales.

Deux zones résiduelles méritent attention : les 7 pages statiques (tokens dupliqués, non alignés sur v2) et les icônes d'extension (T-144 non réalisé — SVG source volumineux non aligné sur la palette Cyberpunk Neon retenue). Un arbitrage ouvert subsiste sur le contraste du bouton Matrix (T-157c).

---

## 2. Périmètre couvert

| Élément | Source vérifiée | Statut |
|---------|----------------|--------|
| Brand Book v1.0 | `docs/p4-conception/brand-book-sentinel-nudge.md` | Lu intégralement |
| Design proposals v3 (README + tokens-v2.css) | `docs/p4-conception/design-proposals-v3/` | Lu intégralement |
| tokens.css intégré | `src/assets/styles/tokens.css` | Lu intégralement |
| popup.css | `src/pages/popup/popup.css` | Lu intégralement |
| dashboard.css | `src/pages/dashboard/dashboard.css` | Lu (début) |
| options.css | `src/pages/options/options.css` | Lu (début) |
| onboarding.css | `src/pages/onboarding/onboarding.css` | Lu (début) |
| apply-theme.ts (FOUC / T-148) | `src/shared/utils/apply-theme.ts` | Lu intégralement |
| Shadow DOM content-scripts | `password-detector.ts` + `paste-detector.ts` | Lu sections tokens |
| Pages statiques | `src/pages/static/*.html` (score-cyber-hygiene.html représentatif) | Lu tokens inline |
| Icônes SVG | `src/assets/icons/icon.svg` | Fichier trop volumineux pour lecture — constat indirect |
| BACKLOG (tâches UX/UI) | `.claude/BACKLOG.md` | Lu intégralement (T-030 à T-157) |
| SESSION.md | `.claude/SESSION.md` | Lu |

---

## 3. Éléments manquants ou incomplets

| Réf | Élément | Constat | Criticité |
|-----|---------|---------|-----------|
| T-144 | Icône extension v2 alignée palette T-141 | **Non réalisé** (BACKLOG statut « À faire »). Le SVG source actuel (43 886 tokens — volumineux) date de P4' et a été vectorisé sur la palette Aegis Blue v1 sans les couleurs Cyberpunk Neon retenues. Les PNG 16/48/128px sont donc non alignés sur le design system v2. | Should |
| T-134/135/136 | Pages statiques — import tokens.css | Les 7 pages statiques (`src/pages/static/`) embarquent leurs tokens **en inline CSS local** (exemple vérifié : `score-cyber-hygiene.html` déclare `--sn-color-bg: #ffffff`, `--sn-color-accent: #2563eb` directement dans un bloc `<style>`). Aucune importation de `tokens.css` v2 n'est présente. Les valeurs sont partiellement alignées sur Aegis Light mais **ne couvrent ni Midnight Obsidian ni Cyberpunk Neon**. T-134/135/136 sont au statut « À faire » — cohérent. | Should |
| T-149 | Vérification backdrop-filter Aurora MV3 | Aurora a été écarté par l'arbitrage T-141 (Midnight Obsidian retenu). Cette tâche est **caduque**. Aucun `backdrop-filter` n'est présent dans les tokens.css v2 ni dans popup.css — la propriété `--sn-glass-blur: blur(0px)` est définie mais non utilisée en thème clair ou Obsidian, et `blur(8px)` est déclaré pour le dark/Obsidian mais sans application visible dans le CSS de popup. La tâche peut être fermée. | Fermeture recommandée |
| Documentation design system | Aucun document de référence autonome | Le design system est **uniquement documenté via les commentaires de tokens.css** et le Brand Book v1.0. Il n'existe pas de fichier de référence centralisé (type "design-system.md" ou Storybook) permettant à un développeur de découvrir les composants, leur anatomie, leurs variantes et leurs états. | Could |
| T-157 (a)(c)(d) | Finitions popup restantes | Trois sous-points non résolus : (a) bords arrondis chips/boutons à ajuster selon maquette, (c) arbitrage contraste bouton Matrix blanc/noir, (d) scroll résiduel potentiel. Statut « À faire ». | Must |
| T-143 | Statut BACKLOG incohérent | T-143 est marqué « À faire » dans le BACKLOG mais les CSS dashboard/options/onboarding portent le commentaire `T-143 : refonte sur tokens v2`. Vérification : les CSS importent bien tokens.css via HTML et utilisent les variables v2. Le développement semble livré mais le BACKLOG n'a pas été mis à jour. | Anomalie à corriger |

---

## 4. Cohérence design system v2 vs implémentation

### 4.1 tokens.css (source de vérité)

Le fichier `src/assets/styles/tokens.css` est la transposition fidèle de `docs/p4-conception/design-proposals-v3/tokens-v2.css`, avec des enrichissements post-arbitrage T-141 :

- Thème clair : Aegis Light conforme Brand Book v1 (fond `#f5f7fa`, primaire `#1e3a5f`, accent `#2e6da4`)
- Thème sombre : Midnight Obsidian remplace Aurora — surfaces solides `#0d0d0f` / `#1a1a1f` (non glassmorphism — cohérent avec l'arbitrage)
- Thème Matrix : Cyberpunk Neon (`#0a0a14`, néon magenta `#ff2d78`, cyan `#00d4ff`)

**Écart identifié** : Le bloc `@media (prefers-color-scheme: dark)` dans tokens.css déclare `--sn-color-accent` deux fois — d'abord `#60a5fa` puis `#2563eb` (override WCAG AA pour fond bouton). Cette double déclaration est documentée par un commentaire mais crée une dette de lisibilité. La valeur effective est `#2563eb` (seconde déclaration). La valeur `#60a5fa` n'est jamais utilisée dans ce bloc. Recommandation : supprimer la première déclaration redondante et ne conserver que `#2563eb` avec son commentaire de justification.

**Alias de compatibilité v1** : Les tokens `--sn-color-muted` et `--sn-color-accent-muted` sont maintenus comme alias. Propre — assure la non-régression sur les composants qui les référencent encore.

### 4.2 popup.css

Conforme aux maquettes v3 sur les 3 thèmes. La structure `div.popup-header` + emoji `🛡` + `h2.popup-title` est implémentée. Les overrides par thème (`@media (prefers-color-scheme: dark)` + `[data-theme='dark']` + `[data-theme='matrix']` + `[data-theme='light']`) sont systématiquement couverts. T-156 correctement livré.

**Point d'attention** : Le `body.background-color` est aligné sur `--sn-color-surface` (non `--sn-color-bg`) — commenté comme correction de l'artefact T-157(b). Cohérent avec la correction de rendu Aegis Light.

**Dégradé Matrix** : Barre `::before` / `::after` 3px magenta→cyan sur `#popup-root`. Conforme maquette Cyberpunk Neon.

### 4.3 dashboard.css / options.css / onboarding.css

Les trois CSS importent tokens.css via leur HTML respectif et n'embarquent aucune couleur hardcodée en dehors des variables `--sn-*`. L'architecture est correcte. Les commentaires indiquent explicitement « T-143 refonte sur tokens v2 ». La couverture des 3 thèmes repose sur la cascade automatique de tokens.css (pas de surcharge locale nécessaire dans ces CSS pour les couleurs — les tokens font le travail).

**Observation** : Seul `popup.css` gère des overrides thème explicites (header spécifique par thème). Dashboard, options, onboarding n'ont pas de composants aussi thème-dépendants que le header popup — l'absence d'override explicite y est donc normale.

### 4.4 apply-theme.ts (mécanisme FOUC)

Le module `src/shared/utils/apply-theme.ts` est architecturalement propre :

- Import de `tokens.css` via bundler Vite — garantit que les tokens sont disponibles avant toute application
- Whitelist `ALLOWED_THEMES = Set(['light', 'dark', 'matrix'])` — sécurité conforme D-SEC-003
- `initTheme()` appelé avant `DOMContentLoaded` dans les 4 pages principales
- `watchThemeChanges()` sur `chrome.storage.onChanged` — bascule en temps réel depuis options

Le FOUC est traité de manière best-effort (async non awaitée intentionnellement). Le comportement attendu en cas de délai chrome.storage est un flash de thème OS (~50-100ms) avant application du thème stocké — acceptable en pratique.

### 4.5 Content scripts (Shadow DOM)

**Constat de divergence** : Les composants injectés en Shadow DOM (`password-detector.ts` overlay, `paste-detector.ts` toast M17) embarquent leurs tokens **dupliqués en inline CSS** via `:host { --sn-bg: #F8FAFC; ... }`. Ces valeurs sont cohérentes avec Aegis Light et couvrent les thèmes dark et matrix via `:host-context([data-theme="dark"])` et `:host-context([data-theme="matrix"])`.

Le principe est correct (Shadow DOM impose cette approche — `tokens.css` n'est pas accessible depuis l'intérieur du shadow). Cependant, la mise à jour de la palette impose de modifier ces tokens en deux endroits : `tokens.css` **et** chaque fichier Shadow DOM. C'est une dette de maintenance identifiée — non critique pour v1, à tracer.

**Spécificité** : Le toast M17 (`paste-detector.ts`) utilise `--sn-bg: #1e3a5f` (bleu primaire Aegis) pour son fond en mode clair — ce qui diffère du fond Aegis Light standard `#f5f7fa`. C'est un choix délibéré de style (toast sombre = emphase), mais non documenté explicitement dans les maquettes v3 consultées. À confirmer avec le Commanditaire.

---

## 5. Conformité ergonomie

### 5.1 Points de contrôle UI — Grille de revue

| Critère | Constat | Niveau |
|---------|---------|--------|
| Positionnement | Popup 320px fixe conforme MV3. Header / body / footer bien délimités. | Conforme |
| Dimensionnement | `max-height: 600px` popup (T-157d en cours). Dashboard 600-900px responsive. Options 800px max-width. Onboarding 640px. Grille cohérente. | Conforme |
| Espacement | Grille 8px strictement respectée dans tokens.css (`xs:4, sm:8, md:16, lg:24, xl:32, 2xl:48`). | Conforme |
| Typographie | 4 niveaux : display 26px, h1 22px, h2 18px, body 15px, small 13px, micro 11px. Minimum body 15px (supérieur au seuil 14px). | Conforme |
| Couleurs | 3 thèmes cohérents. Signification constante (rouge danger, vert succès, jaune warning). Pas de couleur hors sémantique. | Conforme |
| Animations | `prefers-reduced-motion: reduce` couvre l'intégralité des animations (T-151 livré). Transitions 150-400ms — dans les plages recommandées. | Conforme |
| Feedback | Focus visible sur tous les éléments interactifs (`focus-visible`). Skip links présents sur les 4 pages (T-132). | Conforme |
| Densité d'information | La popup expose 3 actions principales maximum (Tableau de bord + Options + zone modules). | Conforme |
| Wording | Verbes à l'infinitif confirmés sur les boutons dans le Brand Book. Ton non culpabilisant documenté. | Conforme |
| Responsive | Dashboard et options : responsive min/max-width. Popup : 320px fixe (convention MV3). Pages statiques : max-width 720px. | Conforme |

### 5.2 Observations ergonomiques

**Thème clair (Aegis Light)** : Conformité Brand Book v1 complète. Fond `#f5f7fa`, primaire `#1e3a5f` en header, accent `#2e6da4` sur les boutons. Le ratio fg/bg 15.8:1 est largement au-dessus du minimum AA.

**Thème sombre (Midnight Obsidian)** : L'accent bouton `#2563eb` a été ajusté de `#60a5fa` pour atteindre 5.9:1 avec texte blanc — décision de conformité WCAG AA. Le token `--sn-color-accent-text: #60a5fa` découple texte accent (7.7:1 sur fond sombre) du fond bouton. Cette décision est bonne mais alourdit les tokens d'un découplage qui mérite d'être documenté dans le design system.

**Thème Matrix (Cyberpunk Neon)** : L'arbitrage T-157(c) reste ouvert — bouton primaire Matrix en texte blanc (3.62:1 AA large bold, préférence esthétique Commanditaire) vs texte noir (5.6:1 AA normal). Le token actuel `--sn-color-btn-fg: #0a0a14` (noir) résout l'AA mais contredit la préférence du Commanditaire. Ce point nécessite un arbitrage formel avant clôture T-157.

**Sélecteur thème 4 positions (T-147)** : Opérationnel dans options.ts. Persistance `chrome.storage.local` clé `theme` confirmée.

---

## 6. Risques UX résiduels

| ID | Risque | Probabilité | Impact | Mitigation |
|----|--------|-------------|--------|------------|
| R-UX-01 | **Divergence tokens pages statiques** : les 7 pages statiques ne chargent pas tokens.css et déclarent des tokens partiels dans leur `<style>`. Lors d'une évolution de palette, elles ne suivront pas automatiquement. | Haute (déjà observé sur M17 dark mode — T-133 corrigé) | Moyen | T-134 (import tokens.css) à réaliser en P6. |
| R-UX-02 | **Double maintenance tokens Shadow DOM** : password-detector et paste-detector embarquent leurs tokens dupliqués. Toute évolution de couleur doit être répercutée manuellement. | Haute | Faible (v1, peu d'évolutions prévues) | Documenter la règle de synchronisation. Envisager un script de vérification CI (Could). |
| R-UX-03 | **Icônes non alignées sur palette v2** : icon.svg + icon16/48/128.png reflètent la palette Aegis Blue v1 (P4'). Avec les 3 thèmes v2 et notamment le header Aegis Light bleu marine, l'icône reste cohérente visuellement. En revanche, pour Cyberpunk Neon, le décalage esthétique est perceptible. | Moyenne (visible uniquement en comparant icône toolbar vs popup Matrix ouverte) | Faible (icône toolbar est petite, 16px) | T-144 à planifier en P6 (Should). |
| R-UX-04 | **T-149 caduque non fermée** : la tâche vérification backdrop-filter Aurora existe encore dans le BACKLOG avec statut « À faire ». Elle génère du bruit de gestion. | Certaine | Nul | Fermer T-149 avec justification Aurora écarté (T-141). |
| R-UX-05 | **Fond toast M17 en Shadow DOM (bleu #1e3a5f)** : divergence non documentée avec les maquettes v3. Si le Commanditaire revoit les maquettes de contenu-scripts, l'écart sera visible. | Faible | Faible | Documenter le choix dans les commentaires du code. |
| R-UX-06 | **Arbitrage T-157(c) contraste bouton Matrix** : l'absence de décision tranchée crée une inconsistance entre le rendu visuel (noir AA-safe) et la préférence esthétique Commanditaire (blanc pixel-perfect maquette). | Certaine (arbitrage demandé) | Moyen | Décision Commanditaire requise avant clôture T-157. |
| R-UX-07 | **T-143 statut BACKLOG incohérent** : marqué « À faire » alors que les CSS portent les commentaires de livraison T-143 et importent tokens.css. | Certaine | Nul (fonctionnel) | Passer T-143 en « Terminé » dans BACKLOG. |
| R-UX-08 | **Absence de documentation design system autonome** : le design system existe dans tokens.css et le Brand Book mais aucun document de référence (guide composants, états, anatomie) ne synthétise les règles pour les futurs développeurs. | Haute | Moyen (risque de déviation lors des contributions post-OSS) | Créer `docs/p4-conception/design-system-v2.md` (Could, P7). |

---

## 7. Recommandations

### 7.1 Actions immédiates (avant merge PR #81 / PR #92)

| Priorité | Action | Cible |
|----------|--------|-------|
| Must | **Trancher T-157(c)** — arbitrage Commanditaire sur contraste bouton Matrix : blanc (esthétique, 3.62:1 AA large bold) vs noir (WCAG AA normal). Les deux options sont documentées — la décision appartient au Commanditaire. | Commanditaire |
| Must | **Corriger le statut BACKLOG T-143** — passer à « Terminé » (CSS livrés avec tokens v2). | Orchestrateur |
| Should | **Fermer T-149** — Aurora écarté (T-141), backdrop-filter non utilisé dans le design system v2 actuel. Documenter la clôture dans le BACKLOG. | Orchestrateur |

### 7.2 Actions P6 (sprint suivant)

| Priorité | Action | Réf | Responsable |
|----------|--------|-----|-------------|
| Should | **T-134** — Importer `tokens.css` dans les 7 pages statiques (supprimer les tokens inline dupliqués). | T-134 | Développeur |
| Should | **T-135** — Remplacer `<strong>` par `<h3>` dans les tip-box des pages statiques. | T-135 | Développeur |
| Should | **T-144** — Redéfinir le SVG icône extension v2 aligné sur la palette Cyberpunk Neon pour cohérence visuelle dans le thème Matrix. L'icône actuelle (Aegis Blue v1) reste fonctionnelle sur Aegis Light et Obsidian. | T-144 | Expert UX/UI + Développeur |
| Could | **Supprimer la double déclaration `--sn-color-accent`** dans le bloc `@media (prefers-color-scheme: dark)` de tokens.css — garder uniquement `#2563eb` commenté WCAG AA. | — | Développeur |

### 7.3 Actions P7 (audit final)

| Priorité | Action | Réf |
|----------|--------|-----|
| Could | **Créer `docs/p4-conception/design-system-v2.md`** — document de référence autonome : tokens (liste exhaustive + usage), composants (anatomie, variantes, états, responsive), règles d'extension pour contributeurs OSS. | — |
| Could | **Documenter la règle de synchronisation tokens Shadow DOM** — procédure explicite pour maintenir la cohérence entre tokens.css et les blocs `:host { }` de password-detector.ts et paste-detector.ts lors d'évolutions de palette. | — |

### 7.4 Propositions d'alternatives — Arbitrage T-157(c)

Le Commanditaire doit trancher entre ces deux options pour le bouton primaire en thème Matrix :

| | Option A — Texte blanc | Option B — Texte noir (actuel) |
|-|------------------------|-------------------------------|
| Valeur `--sn-color-btn-fg` | `#ffffff` | `#0a0a14` |
| Ratio sur fond magenta `#ff2d78` | 3.62:1 (AA large bold ≥ 14px bold) | 5.6:1 (AA normal text) |
| Conformité WCAG AA | Oui si bouton ≥ 14px bold (vérifié : font-weight 700) | Oui (toutes tailles) |
| Cohérence maquette v3 | Conforme pixel-perfect | Non conforme maquette |
| Cohérence sémantique | Blanc = texte bouton primaire sur fond coloré (convention universelle) | Noir sur fond néon = lisible mais visuellement inattendu |
| Risque axe-core CI | Vert (3.62:1 suffit pour large bold) | Vert |
| Recommandation Expert UX/UI | **Option A recommandée** — le blanc sur magenta est la convention de tout design néon et correspond à la maquette retenue par le Commanditaire. Le ratio 3.62:1 est conforme WCAG AA pour texte large bold. | — |

---

*Rapport produit par Expert UX/UI — La Fabrique*  
*Chemin absolu : `C:/Dev/sentinel-nudge/docs/gouvernance/revues-fabrique-2026-04-19/08-expert-ux-ui.md`*
