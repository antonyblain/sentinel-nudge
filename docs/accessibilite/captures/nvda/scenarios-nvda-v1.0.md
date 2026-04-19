# Scénarios de test NVDA — Sentinel Nudge UI internes

**Version** : 1.0
**Date** : 2026-04-19
**Référence** : T-180, checklist-accessibilite-v1.1.md §14
**Responsable** : Expert accessibilité

---

## 1. Prérequis d'environnement

### 1.1 Versions recommandées

| Composant | Version recommandée | Remarque |
|-----------|---------------------|----------|
| NVDA | 2024.4 (ou supérieure) | Téléchargement gratuit sur nvaccess.org |
| Navigateur | Chrome 139+ ou Edge 139+ (Chromium) | MV3 requis pour l'extension |
| OS | Windows 11 | Seule plateforme supportée pour NVDA dans ce projet |
| Sentinel Nudge | Build `dist/` à jour | Exécuter `npm run build` avant le test |

### 1.2 Configuration NVDA pour ces tests

- Synthèse vocale : eSpeak NG (par défaut) ou Windows OneCore — les deux sont acceptables
- Mode de navigation : **mode navigation** (Browse Mode) pour les pages HTML, **mode focus** (Focus Mode) pour les formulaires
- Paramètre "dire tout lors du chargement de page" : **désactivé** (pour contrôler la lecture étape par étape)
- Ponctuation verbalisée : niveau **Some** (NVDA+P pour ajuster)

### 1.3 Chargement de l'extension

1. Charger l'extension en mode développeur dans Chrome/Edge (`chrome://extensions` > "Charger l'extension non empaquetée" > sélectionner `dist/`)
2. Récupérer l'ID de l'extension affiché (format : `abcdefghijklmnopqrstuvwxyz123456`)
3. Les URLs de test ont le format : `chrome-extension://<ID>/pages/<page>/<page>.html`

---

## 2. Conventions des scénarios

Chaque scénario est structuré en format Given / When / Then :

- **Given** : état initial de la page et configuration NVDA
- **When** : séquence de touches à effectuer (dans l'ordre)
- **Then** : résultat attendu announcé par NVDA (texte ou comportement)

**Notation des touches NVDA** :

| Notation | Touche |
|----------|--------|
| `Tab` | Tabulation |
| `Shift+Tab` | Tabulation inverse |
| `H` | Touche H (navigation par titres, Browse Mode) |
| `F` | Touche F (navigation par formulaires, Browse Mode) |
| `Insert+F7` | Liste des landmarks (éléments de page) |
| `Insert+F6` | Liste des titres |
| `Insert+T` | Lire le titre de la page |
| `Insert+↓` | Lire depuis la position courante |
| `Espace` ou `Entrée` | Activer l'élément focalisé |
| `Echap` | Quitter le mode courant |
| `Insert+Space` | Basculer Browse Mode / Focus Mode |

---

## 3. Popup (`pages/popup/popup.html`)

### SC-NVDA-POP-01 — Titre de page

**Given** : Page popup ouverte, NVDA actif
**When** : `Insert+T`
**Then** : NVDA annonce "Sentinel Nudge — Tableau de bord" (ou titre équivalent défini dans `<title>`)

### SC-NVDA-POP-02 — Langue de la page

**Given** : Page popup ouverte
**When** : `Insert+F7` (liste des landmarks)
**Then** : NVDA lit les landmarks en français sans basculer en prononciation anglaise — confirme `lang="fr"` effectif

### SC-NVDA-POP-03 — Skip link

**Given** : Page popup, curseur NVDA en début de page
**When** : `Tab` (premier Tab depuis le haut de page)
**Then** : NVDA annonce "Aller au contenu principal, lien" (ou formulation équivalente du skip link)

**Note Sentinel Nudge** : Le skip link est généré par `popup.ts`. S'il n'est pas annoncé au premier Tab, cela confirme l'écart ACC-UI non corrigé.

### SC-NVDA-POP-04 — Lecture du score (gauge SVG)

**Given** : Page popup chargée avec données (score visible), NVDA en Browse Mode
**When** : `H` pour naviguer jusqu'au H2 "Score de cyber-hygiène" puis `↓`
**Then** : NVDA annonce la valeur du score. Résultat attendu : "Score de cyber-hygiène : [valeur] sur 100" — le `role="meter"` avec `aria-valuenow`, `aria-valuemin`, `aria-valuemax` et `aria-valuetext` doit être verbalisé. Si seule la valeur numérique brute est annoncée sans contexte, ACC-UI-04 n'est pas corrigé.

**Composant critique** : gauge SVG — vérifier que le SVG n'est pas opaque aux AT (doit porter `aria-hidden="true"` avec valeur portée par l'élément texte adjacent ou le `role="meter"`).

### SC-NVDA-POP-05 — Grille modules avec statuts

**Given** : Page popup, grille modules visible (au moins 1 module actif, 1 inactif)
**When** : Naviguer jusqu'à la section modules par `Tab` répété ou `H`, puis `↓` pour chaque chip
**Then** : Chaque chip annonce son nom ET son statut. Exemple attendu : "Sites douteux — actif" ou "Sites douteux — inactif". Si seule la couleur du point différencie les statuts et que NVDA ne verbalise pas le statut, ACC-UI-02 n'est pas corrigé.

### SC-NVDA-POP-06 — Annonce du chargement (live region)

**Given** : Page popup en cours de chargement (SW répond avec délai)
**When** : Laisser la page se charger, NVDA en écoute
**Then** : NVDA annonce le message de chargement initial ("Chargement..." ou équivalent), puis annonce le contenu chargé (score, modules) sans répétition parasite. Si NVDA n'annonce rien au chargement ou annonce deux fois, ACC-UI-03 n'est pas corrigé.

### SC-NVDA-POP-07 — Quota atteint

**Given** : Quota atteint (3/3 nudges consommés)
**When** : Naviguer jusqu'au `role="meter"` du quota par Tab
**Then** : NVDA annonce "3 sur 3 — quota atteint" (via `aria-valuetext`). Si NVDA annonce uniquement "3" sans contexte de quota atteint, ACC-UI-04 n'est pas corrigé.

### SC-NVDA-POP-08 — Navigation clavier complète (ordre de focus)

**Given** : Page popup chargée
**When** : `Tab` répété depuis le skip link jusqu'au dernier élément interactif, noter l'ordre
**Then** : Ordre logique attendu : skip link → (éventuellement) bouton "En savoir plus" badge dégradé → chips modules (si focalisables) → bouton "Ouvrir les paramètres" → bouton "Ouvrir le tableau de bord". Aucun piège de focus. `Shift+Tab` depuis le dernier élément remonte en sens inverse.

---

## 4. Dashboard (`pages/dashboard/dashboard.html`)

### SC-NVDA-DSH-01 — Titre de page

**Given** : Page dashboard ouverte
**When** : `Insert+T`
**Then** : NVDA annonce "Sentinel Nudge — Tableau de bord analytique" (ou titre équivalent)

### SC-NVDA-DSH-02 — Navigation par landmarks

**Given** : Page dashboard
**When** : `Insert+F7`
**Then** : Liste des landmarks affichée par NVDA incluant au minimum : `main` (ou "Principal") avec son label. Absence de landmark `main` serait un écart WCAG 1.3.6.

### SC-NVDA-DSH-03 — Navigation par titres

**Given** : Page dashboard, Browse Mode
**When** : `H` répété depuis le début de la page
**Then** : Sequence de titres : H1 (nom de la page) → H2 (sections : score, graphique, composantes, quiz). Vérifier l'absence de saut de niveau (pas de H3 sans H2 parent).

### SC-NVDA-DSH-04 — Histogramme SVG et table alternatives

**Given** : Section graphique/histogramme visible
**When** : Naviguer jusqu'au graphique SVG par `↓` en Browse Mode
**Then** : Le SVG doit être soit `aria-hidden="true"` (contenu porté par une table `sr-only` adjacente), soit porteur d'un `aria-label` descriptif. NVDA ne doit pas tenter de lire le SVG brut (cela produirait une série de nombres ou de silence). Vérifier que la table sr-only alternative est correctement annoncée.

### SC-NVDA-DSH-05 — Bouton unique (navigation Tab)

**Given** : Page dashboard
**When** : `Tab` depuis le haut de page
**Then** : Sequence attendue : skip link (si présent) → bouton "Ouvrir les paramètres". Deux Tab au maximum pour atteindre le seul bouton interactif de la page. Si ACC-UI-06 n'est pas corrigé, le skip link sera absent.

---

## 5. Options (`pages/options/options.html`)

### SC-NVDA-OPT-01 — Titre de page

**Given** : Page options ouverte
**When** : `Insert+T`
**Then** : NVDA annonce "Sentinel Nudge — Paramètres"

### SC-NVDA-OPT-02 — Navigation par fieldsets

**Given** : Page options, Browse Mode
**When** : `F` répété (navigation par éléments de formulaire) depuis le début de la page
**Then** : Chaque section de formulaire (Modules, Quota, Profil, Langue, Accessibilité, Apparence) est annoncée avec son `<legend>` comme contexte. Exemple : "Modules actifs, groupe" puis chaque checkbox avec son label et son état (coché/décoché).

### SC-NVDA-OPT-03 — Toggles modules

**Given** : Section Modules visible
**When** : Naviguer jusqu'au premier toggle checkbox par Tab, puis Tab suivant
**Then** : NVDA annonce le nom du module, le type "case à cocher", l'état "coché" ou "non coché", et la description associée (`aria-describedby`). Exemple attendu : "Sites douteux, case à cocher, cochée, Détecte les sites web potentiellement dangereux".

### SC-NVDA-OPT-04 — Radiogroup profil

**Given** : Section Profil visible
**When** : Tab jusqu'au groupe de radios, puis flèches `↑`/`↓`
**Then** : Navigation native au sein du radiogroup par flèches. NVDA annonce chaque radio : "Débutant, bouton radio, sélectionné" / "Intermédiaire, bouton radio" / "Expert, bouton radio". Le groupe annonce "Profil utilisateur, groupe" à l'entrée.

### SC-NVDA-OPT-05 — Dialogue de suppression (encart inline)

**Given** : Page options, section Données et confidentialité
**When** :
1. Tab jusqu'au bouton "Supprimer toutes les données"
2. `Entrée` pour activer le bouton
**Then** :
1. NVDA annonce immédiatement le contenu de l'encart de confirmation (`role="alert"` — annonce assertive) : "Confirmation requise — Cette action supprimera définitivement..."
2. Le focus se déplace sur le bouton "Annuler" (annoncé par NVDA)
3. `Tab` : focus sur bouton "Confirmer la suppression"
4. `Shift+Tab` : retour sur "Annuler"
5. `Entrée` sur "Annuler" : encart fermé, focus retourné sur bouton initial

**Composant critique** : dialogue de suppression inline — vérifier que le focus ne s'échappe pas hors de l'encart et que l'annonce assertive est bien verbalisée.

### SC-NVDA-OPT-06 — Toast de sauvegarde

**Given** : Page options, une modification effectuée (ex. changement de quota)
**When** : Modifier une valeur, attendre l'auto-sauvegarde
**Then** : NVDA annonce "Paramètres enregistrés" (ou texte équivalent) via `aria-live="polite"` sans interrompre la lecture en cours. L'annonce doit intervenir après la fin de la phrase courante.

### SC-NVDA-OPT-07 — Radiogroup thèmes

**Given** : Section Apparence visible
**When** : Tab jusqu'au groupe de thèmes, `↓` pour naviguer
**Then** : NVDA annonce chaque thème : "Aegis Light, bouton radio, sélectionné" puis "Midnight Obsidian, bouton radio" puis "Cyberpunk Neon, bouton radio". Le radiogroup est annoncé par son `aria-label`.

---

## 6. Onboarding (`pages/onboarding/onboarding.html`)

### SC-NVDA-ONB-01 — Titre de page

**Given** : Page onboarding ouverte (étape 1)
**When** : `Insert+T`
**Then** : NVDA annonce "Sentinel Nudge — Bienvenue"

### SC-NVDA-ONB-02 — Indicateur de progression

**Given** : Page onboarding, étape 1 active
**When** : Activer le bouton "Suivant" (`Tab` jusqu'au bouton, `Entrée`)
**Then** : NVDA annonce immédiatement "Étape 2 sur 4" via `aria-live="polite"` sur l'élément `.sr-only` de progression. L'annonce doit suivre l'activation du bouton sans délai perceptible.

Répéter pour les étapes 2 → 3 → 4.

### SC-NVDA-ONB-03 — Focus à chaque étape

**Given** : Onboarding, navigation entre étapes
**When** : Activer "Suivant" pour passer à l'étape 2
**Then** : Le focus se déplace automatiquement sur le premier élément focalisable de l'étape 2 (premier radio du groupe Profil). NVDA annonce cet élément sans nécessiter un Tab supplémentaire. Si le focus reste sur "Suivant" après le changement d'étape, la gestion du focus est défectueuse.

### SC-NVDA-ONB-04 — Module M7 désactivé (étape 3)

**Given** : Onboarding, étape 3 (sélection des modules)
**When** : Tab jusqu'au toggle du module "Mots de passe réutilisés"
**Then** : NVDA annonce "Mots de passe réutilisés (consentement requis à l'étape suivante), case à cocher, non disponible" (ou "grisée"). L'`aria-label` explicatif doit être verbalisé. L'état désactivé (`disabled`) doit être annoncé.

### SC-NVDA-ONB-05 — Lien GitHub (étape 1, nouvel onglet)

**Given** : Onboarding, étape 1
**When** : Tab jusqu'au lien "Voir le code sur GitHub"
**Then** : NVDA annonce "Voir le code sur GitHub (s'ouvre dans un nouvel onglet), lien". Si la mention "s'ouvre dans un nouvel onglet" est absente, ACC-UI-10 n'est pas corrigé.

### SC-NVDA-ONB-06 — Erreur de validation (étape 2, profil non sélectionné)

**Given** : Onboarding, étape 2 (Profil), aucun radio sélectionné
**When** : Activer le bouton "Suivant"
**Then** : NVDA annonce immédiatement le message d'erreur via `role="alert"` : "Veuillez sélectionner un profil" (ou texte équivalent). L'annonce est assertive (interrompt la lecture en cours). Le focus reste sur la page (pas de saut indésiré).

---

## 7. Procédure d'archivage des transcripts

### 7.1 Capture du transcript NVDA

NVDA ne produit pas de transcript automatique par défaut. Pour capturer la sortie verbale :

**Option A — Log NVDA (recommandé)** :
1. Aller dans NVDA > Préférences > Paramètres > Avancé
2. Activer "Activer la journalisation" avec niveau "Debug"
3. Exécuter le scénario
4. Copier le contenu du log : NVDA > Outils > Afficher le journal
5. Filtrer les lignes `speech:` qui contiennent les verbalisations
6. Enregistrer le texte filtré dans un fichier `.txt` selon la convention de nommage

**Option B — Prise de notes manuelle** :
1. Ouvrir un éditeur de texte en parallèle
2. Exécuter le scénario touche par touche
3. Noter immédiatement après chaque interaction ce que NVDA a verbalisé
4. Indiquer les écarts par rapport au résultat attendu

### 7.2 Contenu minimal d'un transcript archivé

```
# Transcript NVDA — <page> — <theme>
Date : YYYY-MM-DD
Testeur : <nom>
NVDA : <version>
Navigateur : Chrome/Edge <version>
Extension build : <hash git ou date>

## SC-NVDA-<PAGE>-01
Action : <touche>
Résultat NVDA : "<texte verbalisé>"
Conformité : OK | ECART — <description>

## SC-NVDA-<PAGE>-02
...
```

### 7.3 Nommage et dépôt

Nommer le fichier selon la convention du README :
`<page>-<theme>-<date>.txt`

Placer dans `docs/accessibilite/captures/nvda/` et committer avec le message :
`docs(accessibilite): transcript NVDA <page> <theme> <date>`
