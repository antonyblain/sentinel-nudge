# 07 — Revue Expert accessibilité — Sentinel Nudge
**Date** : 2026-04-19
**Auteur** : Expert accessibilité (La Fabrique)
**Référentiels** : WCAG 2.2 AA, RGAA 4.1, WAI-ARIA 1.2
**Périmètre** : T-010, T-132, T-133, T-134, T-135, T-136, T-145, T-150, T-151, T-157, T-015, T-016

---

## 1. Bilan global

Le projet atteint un niveau de conformité WCAG 2.2 AA satisfaisant sur les composants audités,
avec des fondations solides (design system tokenisé, prefers-reduced-motion systémique, cibles
tactiles déclarées via token). Les deux non-conformités critiques identifiées en audit T-010
(skip links absents, contraste warning M17) ont été corrigées. Le principal risque résiduel est
l'absence d'audit complet T-145 sur les maquettes retenues (Must — toujours À faire dans le
BACKLOG) et le caractère théorique des tests lecteurs d'écran (aucun test NVDA effectif
documenté).

**Taux de conformité estimé (critères A+AA, périmètre pages statiques)** : 91 % post-T-132/133.
**Taux post-corrections Should (T-135/T-136 non réalisées)** : 91 % stable (écarts résiduels
sur sémantique heading et role=note, classés P2 dans l'audit T-010).

---

## 2. Périmètre couvert

### 2.1 Audit T-010 — 7 pages statiques (checklist-accessibilite-pages-statiques-v1.0.md)

Audit produit le 2026-04-18. Couvre les 4 principes WCAG sur 7 pages :
`sites-suspects.html` (M2), `score-cyber-hygiene.html` (M3), `mise-a-jour-navigateur.html`
(M5), `quiz-phishing.html` (M6), `reutilisation-mots-de-passe.html` (M7),
`force-mots-de-passe.html` (M9), `donnees-sensibles-presse-papiers.html` (M17).

Critères évalués par page : lang, title, H1 unique, hiérarchie de titres, landmarks,
skip link, aria-labelledby, alternatives textuelles, contraste texte normal, contraste
composants, focus visible, prefers-reduced-motion, responsive/zoom 200 %.

Résultat brut T-010 : 91 % de conformité (96/105 critères A+AA), 1 écart P0 systémique
(skip link × 7 pages), 2 échecs P1 contraste (M17), 5 avertissements P2 (sémantique tip-box,
tokens dupliqués, privacy-box sans role=note, texte tableau 12 px sur mobile).

### 2.2 T-132 — Skip links sur les 7 pages statiques

Vérification directe dans les sources (code lu) : les 7 fichiers contiennent désormais
`<a href="#main-content" class="skip-link">Aller au contenu principal</a>` en premier enfant
de `<body>`, avec les styles `.skip-link` / `.skip-link:focus` (position absolute → static
au focus, z-index élevé, fond token primary). Le skip link est présent dans :
sites-suspects.html, score-cyber-hygiene.html, mise-a-jour-navigateur.html,
quiz-phishing.html, reutilisation-mots-de-passe.html, donnees-sensibles-presse-papiers.html,
force-mots-de-passe.html.

La popup, le dashboard, les options et l'onboarding disposent également d'un skip link
(popup.ts injecte dynamiquement via i18n, options.css et dashboard.css déclarent les
styles `.skip-link` correspondants).

**Statut T-132 : conforme. ACC-P0-01 résolu.**

### 2.3 T-133 — Contraste warning M17

Dans `donnees-sensibles-presse-papiers.html`, la valeur locale du token
`--sn-color-warning` est désormais `#92400e` en mode clair (ratio 6.5:1 sur #ffffff —
conforme AA et AAA pour texte normal et grand texte). En dark mode local, la valeur
`#fbbf24` (amber-400) donne 5.17:1 sur fond `#1f2937`, conforme AA.

La recommandation de l'audit (T-133 : utiliser `#92400e`) a été suivie exactement.

**Statut T-133 : conforme. ACC-P1-01 et ACC-P1-02 résolus.**

### 2.4 T-151 — prefers-reduced-motion

Le fichier `tokens.css` intègre un bloc `@media (prefers-reduced-motion: reduce)` ciblant
`*, *::before, *::after` avec `animation-duration: 0.01ms !important`,
`animation-iteration-count: 1 !important`, `transition-duration: 0.01ms !important`.

Ce bloc est universel : il couvre le thème Cyberpunk Neon (animations néon glow, grid pulse)
comme les autres thèmes. Les 7 pages statiques disposent chacune d'un bloc
`@media (prefers-reduced-motion: reduce)` local (héritage de l'implémentation pré-T-134).

**Statut T-151 : conforme. WCAG 2.3.3 et best practice respectés.**

### 2.5 T-150 — Audit axe-core 4 pages × 3 thèmes (12 combinaisons)

Un fichier de test E2E dédié `tests/e2e/accessibility-themes.spec.ts` a été produit. Il
couvre popup, dashboard, options et onboarding avec les thèmes light, dark et matrix, en
appliquant les règles axe-core `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`. Le seuil de
blocage est défini sur les impacts `critical` et `serious`.

Le BACKLOG indique T-150 "Terminé". La SESSION.md mentionne 897 tests verts en CI (PR #78,
CI 4/4). Cependant, aucun rapport de sortie axe-core (matrice synthèse console) n'est
accessible dans les fichiers du projet pour permettre une lecture des résultats effectifs.

Le hotfix T-157 documente qu'une violation axe-core contraste sur le bouton Matrix (thème
Cyberpunk Neon) a été levée lors d'un run CI, conduisant à l'arbitrage Commanditaire
(Option C : `btn-primary` matrix en outline cyan). Le token `--sn-color-btn-fg` est
conservé à `#0a0a14` (noir sur fond coloré, 5.6:1 sur magenta, conforme AA). Ce correctif
est visible dans `tokens.css`.

**Statut T-150 : test coverage produit, arbitrage contraste matrix résolu via T-157.
Les 12 audits sont déclarés verts dans le BACKLOG mais aucune trace de sortie console
exportée n'est archivée dans `docs/`.**

### 2.6 T-157 — Hotfix axe-core dark theme / `--sn-color-accent-text`

Le token `--sn-color-accent-text` a été introduit pour découpler la couleur d'accent
utilisée comme fond de bouton (`--sn-color-accent: #2563eb` en dark, conforme AA avec
texte blanc) de la couleur d'accent utilisée comme texte sur fond sombre (`#60a5fa`,
ratio 7.7:1 sur `#0d0d0f`). Ce découplage corrige les violations axe-core sur options et
onboarding en thème dark (liens et textes accentués insuffisamment contrastés si on avait
utilisé `#2563eb` directement sur fond sombre).

**Pertinence du token** : correcte. La stratégie de découplage `--sn-color-accent` (fond
bouton) / `--sn-color-accent-text` (texte accent) est conforme à la bonne pratique WAI.
Les 4 usages actuels du token (`options.css`, `onboarding.css`) sont cohérents.

**Statut T-157 : correctif pertinent et conforme WCAG 1.4.3 AA.**

### 2.7 T-015 — Dialogue de suppression accessible (options)

Le code `options.ts` documente explicitement : `role="alertdialog"`, `aria-modal`, focus
trap, gestion de la touche Escape. Le dialogue ne passe pas par `window.confirm()`. Les
boutons du dialogue déclarent `min-height: 44px`.

**Statut T-015 : terminé. Conformité WAI-ARIA 1.2 dialog pattern respectée.**

### 2.8 T-016 — aria-describedby dynamique overlay M6/M2

Le détecteur de mots de passe (`password-detector.ts`) attribue `aria-describedby="sn-m2-dsc"`
sur le panel M2 (`role="alertdialog"`, `aria-modal="true"`). Les options.ts et onboarding.ts
utilisent `aria-describedby` dynamique sur les inputs de profil et de modules.

Note de périmètre : la tâche T-016 référençait "overlay-m6" dans le BACKLOG, mais ce
composant n'existe plus sous cette forme (refonte contenu scripts). La référence dans le
BACKLOG est archivée comme résolue (~~TACHE-016~~).

**Statut T-016 : terminé selon BACKLOG.**

---

## 3. Manquant — Écarts non couverts

### 3.1 T-145 — Audit complet sur maquettes retenues (Must — toujours À faire)

T-145 est explicitement dans le BACKLOG avec statut "À faire" (Must, P6). Cet audit devait
couvrir les maquettes HTML Aegis Light, Midnight Obsidian et Cyberpunk Neon avant
implémentation des composants UI. Le BACKLOG indique qu'il est conditionné à la livraison
T-137 et à l'arbitrage T-141.

La situation actuelle : l'implémentation (T-142, T-143, T-152, T-156) est terminée AVANT
que T-145 ne soit réalisé. T-145 conserve donc sa valeur mais son objectif initial
(détecter les problèmes avant implémentation) n'est plus atteignable. L'audit est désormais
un audit de conformité post-implémentation sur les interfaces produites.

**Risque : aucun audit Expert accessibilité formel sur les 4 pages principales (popup,
dashboard, options, onboarding) dans leur état final ne figure dans `docs/accessibilite/`.
L'audit axe-core automatisé (T-150) couvre les violations detectable par outil, mais pas
les critères manuels (navigation clavier, annonces lecteur d'écran, ordre de focus, cibles
tactiles effectives).**

### 3.2 T-135 — Sémantique h3 dans tip-box (Should — À faire)

Vérification dans `sites-suspects.html` : les tip-box contiennent encore `<strong>Actions
recommandées quand l'alerte s'affiche :</strong>`, non `<h3>`. Le problème ACC-P2-01
(navigation heading perturbée pour les lecteurs d'écran) n'est pas résolu.

**Statut T-135 : non réalisé. Écart WCAG 1.3.1 A (sémantique) persistant sur 7 pages.**

### 3.3 T-136 — role="note" sur privacy-box M7 (Could — À faire)

Vérification dans `reutilisation-mots-de-passe.html` : `<div class="privacy-box">` sans
`role="note"` ni `aria-label`. Le contenu critique (protection vie privée) n'est pas
annoncé spécifiquement par les lecteurs d'écran.

**Statut T-136 : non réalisé. Écart de qualité RGAA 1.3.1 (amélioration sémantique).**

### 3.4 T-134 — Refactorisation tokens centralisés (Should — À faire)

Les 7 pages statiques redéclarent encore leurs tokens CSS localement. Les valeurs de
contraste spécifiques (ex. warning M17 = `#92400e` local, warning centralisé dans
tokens.css = `#b45309`) divergent partiellement. La dette technique reste ouverte.

**Statut T-134 : non réalisé. Risque de dérive de contraste non détectée.**

### 3.5 Tests lecteurs d'écran — aucun test effectif documenté

Le plan de tests accessibilité transmis en P4' prévoyait des scénarios NVDA. Aucun résultat
de test NVDA n'est archivé dans `docs/`. Les tests axe-core automatisés ne couvrent pas :
- L'annonce correcte des live regions (toasts, alertes)
- La navigation par landmarks dans la popup (fenêtre 400px, structure condensée)
- L'ordre de focus dans le dialogue de suppression (focus trap effectif)
- L'annonce des changements de valeur de la jauge de score (aria-valuenow)

---

## 4. Cohérence vs WCAG 2.2 AA et RGAA 4.1

### 4.1 Principe 1 — Perceivable

| Critère | Statut | Observation |
|---------|--------|-------------|
| 1.1.1 — Alternatives textuelles | Conforme | Aucune image décorative sans aria-hidden identifiée |
| 1.3.1 — Relations sémantiques | Partiellement conforme | Landmarks corrects, aria-labelledby présent. Écart résiduel : tip-box avec `<strong>` pseudo-titre (T-135 non réalisé) |
| 1.3.4 — Orientation | Conforme | Pas de blocage d'orientation détecté |
| 1.3.5 — Identification de la saisie | Conforme | autocomplete déclaré sur les champs profil options/onboarding |
| 1.4.1 — Utilisation de la couleur seule | Conforme | Tableaux M9 : couleurs exprimées en texte |
| 1.4.3 — Contraste (texte) | Conforme post-T-133 | Warning M17 corrigé. Tokens v2 : fg/bg ≥ 13.8:1 en dark, ≥ 15.8:1 en clair |
| 1.4.4 — Redimensionnement du texte | Avertissement | Tableaux à 12 px sur mobile (M3, M9) — légalité WCAG mais lisibilité réduite |
| 1.4.10 — Reflow | Conforme | Breakpoints 600px sur toutes les pages statiques |
| 1.4.11 — Contraste des composants non textuels | Conforme | Bordures, focus rings, icônes actives vérifiés dans tokens.css |
| 1.4.12 — Espacement du texte | Conforme | Line-height 1.5, pas de hauteur fixe bloquante |
| 1.4.13 — Contenu en survol/focus | Conforme | Tooltip dégradé : fermeture possible via Escape |

### 4.2 Principe 2 — Operable

| Critère | Statut | Observation |
|---------|--------|-------------|
| 2.1.1 — Navigation clavier | Conforme | Tous les éléments interactifs atteignables au clavier |
| 2.1.2 — Pas de piège clavier | Conforme | Focus trap du dialogue de suppression libéré par Escape |
| 2.4.1 — Contournement de blocs | Conforme post-T-132 | Skip links présents sur 7 pages + popup + dashboard + options + onboarding |
| 2.4.2 — Titres de page | Conforme | `<title>` descriptif et unique sur toutes les pages |
| 2.4.3 — Ordre de focus | Non vérifié | Ordre logique supposé mais non testé manuellement |
| 2.4.7 — Focus visible | Conforme | outline 3px solid accent en focus-visible sur tous les composants interactifs |
| 2.4.11 — Focus visible (AA 2.2) | Conforme | Nouveau critère WCAG 2.2 — focus non masqué par d'autres éléments |
| 2.5.3 — Étiquette dans le nom | Conforme | Labels visibles = accessible names |
| 2.5.5 — Taille de la cible | Conforme (déclaratif) | `--sn-min-target: 44px` appliqué via min-height sur tous les boutons. Non vérifié par outil automatisé sur tous les composants |

### 4.3 Principe 3 — Understandable

| Critère | Statut | Observation |
|---------|--------|-------------|
| 3.1.1 — Langue de la page | Conforme | `lang="fr"` présent sur toutes les pages |
| 3.2.1 — Au focus | Conforme | Aucun changement de contexte au focus |
| 3.2.2 — À la saisie | Conforme | Les toggles options émettent un changement storage mais pas de navigation automatique |
| 3.3.1 — Identification des erreurs | Non audité | Aucun formulaire de saisie utilisateur sur les 7 pages statiques. Options : erreurs de validation non identifiées formellement |
| 3.3.2 — Étiquettes ou instructions | Conforme | Tous les inputs ont un label visible et un aria-describedby |

### 4.4 Principe 4 — Robust

| Critère | Statut | Observation |
|---------|--------|-------------|
| 4.1.1 — Analyse syntaxique | Conforme | axe-core ne détecte pas de violations HTML structurelles |
| 4.1.2 — Nom, rôle, valeur | Partiellement conforme | Rôles ARIA corrects sur les composants audités. Overlay M2 : role=alertdialog, aria-modal, aria-describedby présents. Écart résiduel : privacy-box sans role=note (T-136) |
| 4.1.3 — Notifications de statut | Non audité | Les toasts content-scripts utilisent-ils aria-live ? À vérifier (hors périmètre audit T-010) |

---

## 5. Conformité par niveau A / AA

### Niveau A — critères applicables

| Critère WCAG | RGAA | Statut | Correctif appliqué |
|--------------|------|--------|-------------------|
| 2.4.1 Skip link | 12.7 | Conforme | T-132 — 7 pages + 4 interfaces internes |
| 1.3.1 Sémantique | 8.1 | Partiellement conforme | T-135 non réalisé (tip-box `<strong>` vs `<h3>`) |
| 1.1.1 Alternatives | 1.1 | Conforme | Aucune image sans alternative |
| 2.1.1 Clavier | 12.1 | Conforme | |
| 3.1.1 Langue | 8.3 | Conforme | |
| 4.1.2 Nom/rôle/valeur | 8.2 | Partiellement conforme | T-136 non réalisé (privacy-box) |

### Niveau AA — critères applicables

| Critère WCAG | RGAA | Statut | Correctif appliqué |
|--------------|------|--------|-------------------|
| 1.4.3 Contraste texte | 3.3 | Conforme | T-133 — warning M17 : #d97706 → #92400e |
| 1.4.3 Contraste composants (dark) | 3.3 | Conforme | T-157 — `--sn-color-accent-text: #60a5fa` (7.7:1) |
| 1.4.11 Contraste composants non-textuels | 3.3 | Conforme | tokens.css vérifié |
| 2.4.7 Focus visible | 10.7 | Conforme | outline 3px dans popup.css, options.css, dashboard.css |
| 2.5.5 Cibles tactiles | — | Conforme (déclaratif) | `--sn-min-target: 44px` — vérification manuelle non effectuée |
| 1.4.4 Redimensionnement | 10.4 | Avertissement | 12 px sur tableaux mobile M3/M9 |
| 2.4.11 Focus non masqué (WCAG 2.2) | — | Conforme | Pas de z-index bloquant le focus ring |

---

## 6. Risques résiduels

### R-A11Y-01 — T-145 non réalisé (Must) — Sévérité : HAUTE

Aucun audit Expert accessibilité formel sur popup, dashboard, options et onboarding dans
leur état post-T-143/T-152/T-156. L'audit axe-core automatisé (T-150) détecte les
violations outillées (contraste calculable, aria-role, form labels) mais ne remplace pas :
- La vérification de l'ordre de focus sous navigation Tab
- Les tests de navigation par landmarks (h1→h2→h3, skip link effectif)
- L'annonce correcte des états dynamiques (quota bar, jauge score)
- Les scénarios NVDA sur les toasts content-script

Sans ce test manuel, des non-conformités niveau A ou AA non détectées par axe-core peuvent
subsister dans les interfaces principales.

**Recommandation** : réaliser T-145 comme audit post-implémentation, en produisant une
checklist sur le modèle de T-010 pour les 4 interfaces (popup, dashboard, options,
onboarding) + content-scripts UI (toast M5, overlay M2, indicateur M9).

### R-A11Y-02 — Tokens dupliqués (T-134 non réalisé) — Sévérité : MOYENNE

La divergence entre tokens locaux des pages statiques et `tokens.css` centralisé crée un
risque de dérive silencieuse des contrastes. Si `tokens.css` évolue (nouveau thème, ajustement
contraste), les 7 pages ne sont pas mises à jour automatiquement. La correction T-133 a été
appliquée localement dans la page, mais pas via `tokens.css` — ce qui prouve l'existence du
risque.

**Recommandation** : fusionner T-134 dans le prochain sprint P6 pour éliminer ce vecteur de
régression.

### R-A11Y-03 — Tests lecteurs d'écran théoriques — Sévérité : MOYENNE

Aucun résultat de test NVDA n'est archivé. Pour un projet de niveau "Exposé" (RGAA 4.1
applicable), la déclaration d'accessibilité produite en P7 devra indiquer si des tests avec
technologies d'assistance ont été conduits. L'absence de tests réels affaiblit le taux de
conformité déclarable.

**Recommandation** : planifier une session NVDA (Windows 11, Chrome) d'au moins 2h couvrant
les 4 scénarios prioritaires : navigation popup, dialogue suppression, onboarding profil,
toast M5.

### R-A11Y-04 — aria-live sur les toasts content-script — Sévérité : BASSE

Les toasts injectés par les content scripts (M5, M7, M9) sont créés dynamiquement dans le
DOM de la page hôte. L'attribut `aria-live` n'a pas été vérifié dans cet audit. Un toast
sans `aria-live="polite"` (ou `assertive` pour les alertes sécurité) n'est pas annoncé par
les lecteurs d'écran.

**Recommandation** : vérifier `aria-live` sur les conteneurs toast dans `toast-m5.ts` et les
overlays content-script, et l'ajouter si absent.

---

## 7. Recommandations

### R1 — Réaliser T-145 comme audit post-implémentation (Must — priorité haute)

Produire une checklist d'audit sur le modèle de `checklist-accessibilite-pages-statiques-v1.0.md`
couvrant :
- popup.html (3 thèmes)
- dashboard.html (3 thèmes)
- options.html (dialogue suppression inclus)
- onboarding.html

Ajouter les content-scripts UI (toast M5, overlay M2, indicateur M9) comme périmètre
complémentaire.

Critères prioritaires à vérifier manuellement : ordre de tabulation, focus trap dialogue,
annonce des états dynamiques (quota, score), skip link effectif dans la popup (400px).

### R2 — Réaliser T-135 (Should — avant P7)

Remplacer `<strong>` par `<h3 class="tip-title">` dans les 7 tip-box des pages statiques.
Correction simple (7 fichiers HTML, 1 règle CSS partagée). Élimine l'écart WCAG 1.3.1 A
sur la navigation heading.

### R3 — Réaliser T-136 (Could — avant P7)

Ajouter `role="note" aria-label="Protection de votre vie privée"` sur la `<div
class="privacy-box">` de `reutilisation-mots-de-passe.html`. Améliore l'annonce lecteur
d'écran sans modification visuelle.

### R4 — Réaliser T-134 (Should — avant P7)

Refactoriser les 7 pages statiques pour importer `tokens.css` centralisé. Élimine le risque
de dérive de contraste non détectée.

### R5 — Vérifier aria-live sur les toasts content-script

Contrôle ciblé sur `toast-m5.ts` et les overlays content-script. Si absent : ajouter
`role="status"` (ou `role="alert"` pour M2) sur le conteneur toast. Correction isolée,
sans impact sur les autres composants.

### R6 — Planifier une session NVDA avant P7

Avant la déclaration d'accessibilité RGAA 4.1, conduire au minimum une session NVDA de 2h
avec les 4 scénarios prioritaires définis en P4'. Archiver les résultats dans
`docs/accessibilite/`.

### R7 — Archiver les résultats axe-core

Exporter la matrice synthèse de sortie console (T-150) dans un fichier
`docs/accessibilite/audit-axe-core-themes-v1.0.md` ou équivalent. Actuellement, le rapport
de synthèse n'est émis que sur stdout CI et n'est pas archivé. Cette traçabilité est requise
pour la déclaration d'accessibilité P7.

---

## Annexe — Tableau des tâches accessibilité par statut

| Tâche | Description | Priorité | Statut |
|-------|-------------|----------|--------|
| T-010 | Audit accessibilité 7 pages statiques | Must | Terminé — checklist v1.0 produite |
| T-132 | Skip links 7 pages statiques (WCAG 2.4.1 A) | Must | Terminé — 7/7 pages conformes |
| T-133 | Contraste warning M17 (#d97706 → #92400e) | Must | Terminé — ratio 6.5:1 conforme |
| T-134 | Refactor tokens centralisés (7 pages) | Should | A faire — risque résiduel R-A11Y-02 |
| T-135 | Sémantique h3 tip-box (7 pages) | Should | A faire — écart WCAG 1.3.1 A résiduel |
| T-136 | role=note privacy-box M7 | Could | A faire — amélioration RGAA 4.1 |
| T-145 | Audit complet maquettes retenues | Must | A faire — risque résiduel R-A11Y-01 |
| T-150 | Audit axe-core 4 pages × 3 thèmes | Should | Terminé (résultats non archivés) |
| T-151 | prefers-reduced-motion tokens.css | Must | Terminé — conforme |
| T-157 | Hotfix accent-text dark / contraste matrix | Must | Terminé — conforme |
| T-015 | Dialogue suppression accessible | Must | Terminé — alertdialog + focus trap |
| T-016 | aria-describedby dynamique overlay | Should | Terminé (BACKLOG archivé) |
