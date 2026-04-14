# Procès-Verbal du Comité de Revue de Code P4' — Sentinel Nudge

## En-tête

| Champ | Valeur |
|-------|--------|
| **Instance** | Comité de revue de code (complémentaire à la revue P4) |
| **Date** | 2026-04-14 |
| **Phase** | P4' — Intégration design system Aegis Blue + finalisation logo + UX popup |
| **Périmètre** | 5 commits sur `feature/p4-developpement` (8989ef0 → fe9d653) |
| **Version PV** | 1.0 |
| **Rapporteur** | Développeur |
| **Précédent PV de référence** | `gouvernance-pv-revue-code-v1.0.md` (P4 initial) |

## Commits concernés

| Hash | Type | Objet |
|------|------|-------|
| `8989ef0` | `feat(design-system)` | Intégration palette Aegis Blue — tokens CSS centralisés |
| `81077a2` | `feat(icon)` | Vectorisation HD du logo (TACHE-030) |
| `5ad8210` | `chore` | Mémoire projet P4' + launch.json |
| `5d89a12` | `feat(icon)` | Maximisation densité toolbar (64% → 94.4%) |
| `fe9d653` | `feat(ux)` | Popup branding + alignement KPI + icônes sémantiques |

## Participants et notes de satisfaction

| Rôle | Note | Justification synthétique |
|------|:----:|---------------------------|
| Développeur (rapporteur) | **3.5/5** | Tokenisation solide, D-SEC-003 respecté ; 3 majeurs fonctionnels (JSDoc orphelin, i18n manquantes, magic number `7`) dégradent la note |
| Architecte sécurité | **5/5** | Aucune faille. SVG inline = constantes statiques. 0 `innerHTML`, 0 secret, CSP intacte. 2 observations mineures (gouvernance) |
| Testeur QA | **2/5** | Couche présentation popup.ts à 0% de couverture. 9 nouvelles fonctions non testées. 2 fichiers intégration squelettes |

**Moyenne : 3.5/5**

---

## Synthèse des travaux

### Périmètre examiné

**Design system Aegis Blue (commit `8989ef0`)** : création de `src/assets/styles/tokens.css` avec 50+ variables CSS (couleurs sémantiques, typographie, espacements, ombres), dark mode natif via `@media (prefers-color-scheme: dark)`, tokenisation des 4 feuilles CSS de pages (popup, options, dashboard, onboarding), alignement Shadow DOM (`password-detector.ts`, `paste-detector.ts`) sur la palette Aegis Blue, consolidation des couleurs inline JS en constantes typées.

**Logo vectorisé HD (commits `81077a2` et `5d89a12`)** : vectorisation potrace multi-passes du PNG source 1005×1148 fourni par le Commanditaire, avec classification dédiée de la zone ombragée `#418FB9` et floodfill du fond damier. Régénération `icon.svg` + `icon128.png` + `icon48.png` + `icon16.png`. Maximisation de la densité toolbar : viewBox ajusté (carré 1209×1209 centré sur le bouclier, marge 3%), densité passée de ~64% à 94.4%.

**Refonte UX popup (commit `fe9d653`)** : ajout de l'icône bouclier dans le header (SVG inline 24×24 `currentColor`, Material Design "security"), refactoring du bloc statut en pattern KPI card (chiffre principal + complément optionnel, `white-space: nowrap`, alignement stabilisé), ajout de 2 icônes sémantiques inline (grille pour Modules, horloge pour Quota) via helper `createInlineIcon`, nouveau wording plus synthétique (« 7 / 7 » au lieu de « 7 modules actifs sur 7 »).

### Points forts unanimes

- **D-SEC-003 strictement respecté** sur tous les fichiers touchés (popup.ts, dashboard.ts, onboarding.ts, options.ts, password-detector.ts, paste-detector.ts). 0 `innerHTML`, tout DOM via `createElement` / `textContent` / `appendChild` / `createElementNS`
- **SVG inline compatibles dark/light mode** via `fill="currentColor"` + parent CSS avec token couleur
- **Pattern design token mature** : source unique dans `tokens.css`, dark mode via redéfinition des variables sémantiques
- **Aucune régression CSP** : les SVG inline sont construits en DOM (pas de `data:image/svg`)
- **Aucune faille de sécurité** introduite par les 5 commits (architecte 5/5)
- **Tokenisation CSS à 95%+** des 4 pages, couleurs hardcodées Tailwind éliminées

### Points faibles identifiés

- **Couche présentation non testée** : 0% de couverture sur les 9 nouvelles fonctions de `popup.ts` (`scoreColor`, `scoreLevelLabel`, `getNextMonday`, `createInlineIcon`, `createStatusLabel`, `createStatusValueGroup`, `renderScoreSection`, `renderStatusSection`, `renderActionsSection`, `initPopup`)
- **5 clés i18n manquantes** dans les fichiers de locale (`fr/messages.json`, `en/messages.json`) : `popup_modules_label`, `popup_quota_reached_sub`, `popup_quota_unlimited_sub`, `popup_quota_remaining_sub`, `score_level_high/medium/low`. Les fallbacks en dur masquent le problème en dev mais empêchent une vraie i18n EN
- **Magic number `7`** non rattaché à `MODULE_IDS.length` (popup.ts l.305, 307)
- **Double bloc JSDoc orphelin** sur `renderStatusSection` (popup.ts l.229-236)
- **2 fichiers de test intégration squelettes** (`service-worker.test.ts`, `storage-service.test.ts`) : `expect(true).toBe(true)`, gonflent artificiellement le compteur de 200 tests
- **Script `test:coverage` absent** malgré `@vitest/coverage-v8` installé (TACHE-025 partielle)
- **Dépendances `pngjs` et `potrace` installées en `--no-save`** : non reproductible par un contributeur externe

---

## Constats classifiés par sévérité

### Bloquants (correction avant passage P5)

| Réf | Constat | Source |
|-----|---------|--------|
| B-01 | `createInlineIcon` — aucun test. Une régression sur `aria-hidden`, `focusable=false` ou `fill=currentColor` passerait inaperçue. Critique WCAG/D-SEC-003 | Testeur QA |
| B-02 | `createStatusValueGroup(warning=true)` — le style `color: var(--sn-color-warning)` non testé. Cas `subText=null` non testé | Testeur QA |

### Majeurs (correction avant merge sur `develop` ou plan daté BACKLOG)

| Réf | Constat | Source |
|-----|---------|--------|
| M-01 | Double bloc JSDoc orphelin sur `renderStatusSection` (popup.ts l.229-236). La doc est détachée de la fonction | Développeur |
| M-02 | 5 clés i18n manquantes dans `fr/messages.json` et `en/messages.json` — l'extension n'est pas internalisable EN | Développeur |
| M-03 | Magic number `7` (popup.ts l.305, 307) non rattaché à `MODULE_IDS.length` — risque de désync silencieux en v2 | Développeur |
| M-04 | `scoreColor` / `scoreLevelLabel` — frontières de seuil (39/40/41, 69/70/71) non testées. Refactoring accidentel des `SCORE_*_THRESHOLD` indétectable | Testeur QA |
| M-05 | `getNextMonday` — cas « aujourd'hui lundi » (daysUntilMonday = 7) non testé | Testeur QA |
| M-06 | `renderScoreSection(score=null)` — message « Premier score lundi » non testé | Testeur QA |
| M-07 | `renderStatusSection` — les 3 états quota (atteint, illimité, N) et la pluralisation (« inactif/inactifs ») non testés | Testeur QA |
| M-08 | `initPopup` chemin catch — rendu `role=alert` en cas d'échec SW non testé | Testeur QA |

### Mineurs (notés, correction recommandée non bloquante)

| Réf | Constat | Source |
|-----|---------|--------|
| m-01 | `aria-label` de la section statut en chaîne littérale française (popup.ts l.293), incohérent avec les autres `browser.i18n.getMessage(...)` | Développeur |
| m-02 | Couleurs `#fff` non tokenisées dans popup.css, options.css, onboarding.css (blanc pur sur fond coloré, acceptable mais incohérent) | Développeur |
| m-03 | Shadow DOM `password-detector.ts` / `paste-detector.ts` : couleurs dupliquées manuellement, non synchronisées avec `tokens.css` (dette technique inhérente à MV3) | Développeur |
| m-04 | `createStatusLabel` non testé | Testeur QA |
| m-05 | `pngjs` et `potrace` installés en `--no-save` — non reproductibles | Architecte sécurité (R-022) |
| m-06 | `.claude/launch.json` versionné, devrait être `.vscode/launch.json` standard — expose `http-server` à la racine du repo sur port 8765 | Architecte sécurité (R-023) |
| m-07 | Script `test:coverage` absent de `package.json` et section `coverage` absente de `vite.config.ts` (TACHE-025 partielle) | Testeur QA |
| m-08 | 2 fichiers intégration squelettes (`service-worker.test.ts`, `storage-service.test.ts`) | Testeur QA |

---

## Divergences et arbitrages

**Aucune divergence majeure** entre les 3 participants. Les 3 revues convergent :

- **Sécurité** conforme et robuste (architecte 5/5 sans réserve)
- **Qualité de code** acceptable mais entachée de 3 majeurs fonctionnels (développeur)
- **Testabilité** fortement déficitaire sur la couche présentation (testeur 2/5)

**Arbitrage retenu** : les 2 bloquants signalés par le testeur QA (B-01 et B-02) ne sont pas tant des « bloquants merge » que des « bloquants passage en P5 » — la phase P5 étant précisément dédiée à l'atteinte de 80% de couverture (TACHE-026). Ils sont donc traités comme des **pré-requis P5**, pas comme des correctifs P4'. Cette interprétation a été validée par le rapporteur.

---

## Tâches complémentaires ajoutées au BACKLOG

### Corrections P4' (à faire avant merge sur `develop`)

| TACHE | Description | Priorité |
|-------|-------------|----------|
| TACHE-044 | Corriger le double JSDoc orphelin sur `renderStatusSection` (popup.ts l.229-236) | Must |
| TACHE-045 | Ajouter les 5 clés i18n manquantes dans `fr/messages.json` et `en/messages.json` | Must |
| TACHE-046 | Rattacher le magic number `7` à `MODULE_IDS.length` dans popup.ts | Should |
| TACHE-047 | Traduire `aria-label` de la section statut popup (clé i18n) | Should |

### Tests P5 (couverture couche présentation)

| TACHE | Description | Priorité |
|-------|-------------|----------|
| TACHE-048 | Tests unitaires popup.ts fonctions pures (`scoreColor`, `scoreLevelLabel`, `getNextMonday`) — cas nominaux + frontières (0, 39, 40, 41, 69, 70, 71, 100 ; jours de semaine 0 à 6) | Must |
| TACHE-049 | Tests unitaires popup.ts constructeurs DOM (`createInlineIcon`, `createStatusLabel`, `createStatusValueGroup`) — attributs accessibilité, logique `warning` et `subText=null` | Must |
| TACHE-050 | Tests unitaires popup.ts sections de rendu (`renderScoreSection`, `renderStatusSection`, `renderActionsSection`) — 3 états quota, pluralisation | Must |
| TACHE-051 | Tests unitaires popup.ts chemin catch `initPopup` — mocker `browser.runtime.sendMessage` pour exception, vérifier `role=alert` | Should |
| TACHE-052 | Finaliser TACHE-025 — ajouter `test:coverage` dans `package.json` et section `coverage` dans `vite.config.ts` (seuils 80%) | Must |
| TACHE-053 | Remplacer les 2 fichiers intégration squelettes (`storage-service.test.ts` avec `fake-indexeddb`, `service-worker.test.ts` avec `chrome-mock`) par des tests réels | Must |

### Gouvernance et reproductibilité

| TACHE | Description | Priorité |
|-------|-------------|----------|
| TACHE-054 | Documenter ou ajouter en `devDependencies` explicites `pngjs` et `potrace` (reproductibilité de la vectorisation logo) | Should |
| TACHE-055 | Déplacer `.claude/launch.json` vers `.vscode/launch.json` (convention standard) ou documenter la raison du placement sous `.claude/` | Could |

---

## Risques ajoutés au registre

| Réf | Libellé | Type | P | I | Score | Mitigation | Statut |
|-----|---------|:---:|:-:|:-:|:-----:|------------|:------:|
| R-022 | Outils de build logo (`pngjs`, `potrace`) installés en `--no-save`, non reproductibles par un contributeur externe | Technique | 2 | 1 | 2 | Documenter la commande d'installation dans `docs/p4-conception/logo-propositions/README.md` OU ajouter en `devDependencies` explicites | Ouvert |
| R-023 | `launch.json` expose `http-server .` à la racine du repo (port 8765) — si utilisé hors contexte, peut leaker des fichiers locaux non publics vers localhost | Sécurité | 1 | 2 | 2 | Usage réservé au Commanditaire sur machine dev, localhost uniquement, `.env` gitignoré. Documenter dans FICHIERS.md que `launch.json` ne doit jamais être étendu avec un bind `0.0.0.0` | Accepté |

---

## Plan de tests d'intégration P6 (complément à la section correspondante du précédent PV)

**Tests manuels à effectuer avant merge (modules non encore validés par le Commanditaire)** :

| Module | Méthode de déclenchement manuel (DevTools) |
|--------|---------------------------------------------|
| M7 (réutilisation mdp) | 2 sites local + même mot de passe → toast M7 attendu sur le 2e |
| M5 (MAJ navigateur) | Bouton debug temporaire ou appel manuel `chrome.runtime.sendMessage({module:'M5', action:'check_update'})` |
| M3 (score) | `chrome.runtime.sendMessage({module:'M3', action:'calculate_now'})` dans DevTools service worker |
| M6 (quiz) | Forcer `m6_state.next_quiz_date = Date.now() - 86400000` puis `check_quiz` |

**Configurations matrice P6** :

| Dimension | Valeurs |
|-----------|---------|
| Navigateur | Chrome 120+ (prioritaire), Firefox 131+ si MV3 supporté |
| Thème OS | light, dark |
| Score | null (onboarding), < 40, 40-69, ≥ 70 |
| Modules actifs | 0/7, 3/7, 7/7 |
| Quota | 0 restant (atteint), 2 restants, illimité |
| État SW | disponible, absent / erreur runtime |

---

## Fiche qualité

| Critère | Statut |
|---------|:------:|
| Conventions de nommage respectées | ✓ |
| Fichiers placés dans les bons dossiers | ✓ |
| Pas de secrets commités | ✓ |
| Tests passent en CI (200 tests, 0 échec) | ✓ |
| Lint passe sans warning | ✓ |
| Format Prettier respecté | ✓ |
| Build Vite sans erreur | ✓ |
| PV structuré selon convention Fabrique | ✓ |

---

## Questions ouvertes

| Réf | Question | Destinataire |
|-----|----------|--------------|
| Q-010 | Faut-il déplacer `.claude/launch.json` vers `.vscode/launch.json` (convention standard) ou conserver sous `.claude/` car spécifique à la Fabrique ? | Commanditaire |
| Q-011 | Les 2 bloquants testabilité (B-01, B-02) doivent-ils être traités avant merge P4' ou peuvent-ils attendre P5 ? | Commanditaire |

---

## Décision demandée

Le comité soumet au Commanditaire **3 décisions** :

1. **Validation des corrections P4' avant merge** (TACHE-044 à TACHE-047) : approuver ou ajuster la liste
2. **Traitement des 2 bloquants testabilité** (B-01, B-02) : traiter immédiatement ou reporter en P5 (voir Q-011)
3. **Passage en phase P5** : dès les corrections ci-dessus effectuées, le comité valide le passage en P5 (tests unitaires couche présentation + couverture 80%)

**Recommandation du rapporteur** : corriger TACHE-044, TACHE-045, TACHE-046 avant merge (30 min d'effort). Reporter B-01 et B-02 en P5 avec TACHE-049. TACHE-054 et TACHE-055 en Could.

---

## Métriques qualité

- **Anomalies bloquantes identifiées** : 2 (reportées en P5 avec accord du rapporteur)
- **Anomalies majeures identifiées** : 8
- **Anomalies mineures identifiées** : 8
- **Ratio bloquants / total** : 10% (2/20)
- **Corrections immédiates nécessaires** : 3 (TACHE-044, 045, 046)
- **Tâches reportées P5** : 6 (TACHE-048 à TACHE-053)
- **Risques consignés** : 2 (R-022, R-023)

**Verdict global** : code **validé sous réserve** des 3 corrections P4' immédiates. Le passage en P5 est conditionné à leur traitement et à la mise en place du câblage coverage-v8 (TACHE-052).
