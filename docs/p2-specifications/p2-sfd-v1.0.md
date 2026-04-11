# Spécifications Fonctionnelles Détaillées — Sentinel Nudge v1
## Phase P2 — Analyste métier

**Projet :** Sentinel Nudge
**Version :** 1.0
**Date de production :** 2026-04-11
**Statut :** En cours de rédaction
**Commanditaire :** Antony (RSSI)
**Niveau de sensibilité :** Exposé
**Document de référence :** p1-cahier-des-charges-v1.1.md
**Comité de sécurité pré-P2 :** Tenu le 2026-04-11 (cf. gouvernance-pv-securite-p2-v1.0.md)

---

## Table des matières

1. Introduction
2. Spécifications par module
   - 2.1 M2 — Détection de saisie en contexte risqué
   - 2.2 M3 — Score de cyber-hygiène hebdomadaire
   - 2.3 M5 — Rappel de mise à jour navigateur
   - 2.4 M6 — Mini-quiz phishing contextuel
   - 2.5 M7 — Nudge d'adoption gestionnaire de mots de passe
   - 2.6 M9 — Indicateur de force du mot de passe
   - 2.7 M17 — Alerte au copier-coller de données sensibles
3. Composants transversaux
   - 3.1 Système de quota journalier
   - 3.2 Stockage local (IndexedDB + chrome.storage.local)
   - 3.3 Onboarding — Premier lancement
   - 3.4 Page de paramètres
   - 3.5 Dashboard — Tableau de bord
   - 3.6 Système de notification
   - 3.7 Pages d'explication statiques
4. Exigences non fonctionnelles détaillées
   - 4.1 Privacy by design — mapping par module
   - 4.2 Performance — budget par module
   - 4.3 Accessibilité — checklist WCAG 2.1 AA par composant UI
   - 4.4 Internationalisation — structure i18n
   - 4.5 Sécurité — décisions du comité de sécurité
5. Matrice de traçabilité CdC → SFD
6. Glossaire

---

## 1. Introduction

Ce document détaille les spécifications fonctionnelles de Sentinel Nudge v1, en complément du cahier des charges v1.1. Il fournit pour chaque module et composant transversal :
- Les diagrammes de séquence et machines à états (Mermaid)
- Les dictionnaires de données complets
- Les cas limites et la gestion d'erreurs
- Les interactions inter-modules
- Les critères d'acceptation enrichis (Gherkin)

Les décisions du comité de sécurité pré-P2 (D-SEC-001 à D-SEC-005) sont intégrées dans chaque section concernée.

---

## 2. Spécifications par module

### 2.1 M2 — Détection de saisie en contexte risqué

#### 2.1.1 Diagramme de séquence

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant CS as Content Script
    participant SW as Service Worker
    participant ST as Stockage Local
    participant UI as Overlay M2

    U->>CS: Focus sur <input type="password">
    CS->>CS: Détecter les signaux de risque
    Note over CS: 1. Schéma HTTP?<br/>2. Hors HSTS preload?<br/>3. Typosquatting (Levenshtein)?<br/>4. Cert auto-signé?
    CS->>SW: sendMessage({module: 'M2', signals: [...], domain_hash})
    SW->>ST: Lire whitelist + quota + session M2
    ST-->>SW: {whitelist, quota_count, session_domains}

    alt Domaine dans whitelist
        SW-->>CS: {action: 'skip', reason: 'whitelisted'}
    else Moins de 2 signaux
        SW-->>CS: {action: 'skip', reason: 'insufficient_signals'}
    else Déjà nudgé cette session pour ce domaine
        SW-->>CS: {action: 'skip', reason: 'session_duplicate'}
    else Quota atteint ET M2 non critique
        SW-->>CS: {action: 'skip', reason: 'quota_reached'}
        SW->>ST: Enregistrer événement silencieux (pour M3)
    else Conditions remplies
        SW->>ST: Incrémenter quota
        SW->>ST: Enregistrer domaine dans session M2
        SW-->>CS: {action: 'show', signals: [...]}
        CS->>UI: Afficher overlay M2
        U->>UI: Action utilisateur

        alt Continuer quand même
            UI->>CS: fermer overlay
            CS->>SW: {action: 'dismissed'}
            SW->>ST: Enregistrer événement (action: 'dismissed')
        else Marquer comme de confiance
            UI->>CS: fermer overlay
            CS->>SW: {action: 'trusted', domain_hash}
            SW->>ST: Ajouter à whitelist
            SW->>ST: Enregistrer événement (action: 'trusted')
        else Abandonner la saisie
            UI->>CS: fermer overlay + focus barre d'adresse
            CS->>SW: {action: 'abandoned'}
            SW->>ST: Enregistrer événement (action: 'abandoned')
        else Pourquoi ce message ?
            UI->>UI: Afficher explication inline (signaux détectés + source scientifique)
        end
    end
```

#### 2.1.2 Machine à états du nudge M2

```mermaid
stateDiagram-v2
    [*] --> Dormant
    Dormant --> Détection : focus sur password field
    Détection --> Évaluation : signaux collectés
    Évaluation --> Dormant : < 2 signaux OU whitelist OU session_duplicate
    Évaluation --> EnAttenteQuota : >= 2 signaux ET domaine non whitelist
    EnAttenteQuota --> Affiché : quota disponible OU exception critique
    EnAttenteQuota --> Silencieux : quota atteint (événement logué sans affichage)
    Silencieux --> Dormant : événement archivé pour M3
    Affiché --> Fermé_Ignoré : "Continuer quand même"
    Affiché --> Fermé_Confiance : "Marquer comme de confiance"
    Affiché --> Fermé_Abandonné : "Abandonner la saisie"
    Affiché --> Explication : "Pourquoi ce message ?"
    Explication --> Affiché : retour au nudge
    Fermé_Ignoré --> Archivé : enregistrer action
    Fermé_Confiance --> Archivé : enregistrer action + whitelist
    Fermé_Abandonné --> Archivé : enregistrer action
    Archivé --> Dormant
```

#### 2.1.3 Dictionnaire de données

**Données d'entrée :**

| Champ | Type | Source | Description | Contrainte |
|-------|------|--------|-------------|-----------|
| `current_url` | string | `chrome.tabs` API | URL complète de l'onglet actif | Jamais stockée en clair |
| `url_scheme` | enum('http','https') | Extraction de `current_url` | Schéma de la page | — |
| `domain` | string | Extraction de `current_url` | Domaine de la page courante | Hashé avant tout stockage |
| `domain_hash` | string(64) | SHA-256(`domain`) | Empreinte du domaine | Stocké, jamais le domaine |
| `is_hsts` | boolean | Lookup dans HSTS preload list embarquée | Domaine dans la HSTS preload list | Liste mise à jour via Chrome Web Store |
| `levenshtein_score` | integer | Algorithme Levenshtein vs liste cibles | Distance typographique minimale avec un domaine connu | Seuil : distance ≤ 2 = suspect |
| `is_self_signed` | boolean | `chrome.tabs` security state | Certificat TLS auto-signé | API MV3 à valider en P3 |
| `password_field_focused` | boolean | DOM `focus` event listener | Un champ password a le focus | Content script `document_idle` |

**Données de sortie :**

| Champ | Type | Destination | Description | Rétention |
|-------|------|-------------|-------------|-----------|
| `event_id` | auto-increment | IndexedDB `events` | Identifiant unique de l'événement | 90 jours |
| `module` | string('M2') | IndexedDB `events` | Identifiant du module source | 90 jours |
| `timestamp` | ISO 8601 | IndexedDB `events` | Date/heure de l'événement | 90 jours |
| `domain_hash` | string(64) | IndexedDB `events` | Hash SHA-256 du domaine | 90 jours |
| `signals` | string[] | IndexedDB `events` | Liste des signaux détectés (ex: ['http','typosquatting']) | 90 jours |
| `action_user` | enum | IndexedDB `events` | Action de l'utilisateur : 'dismissed', 'trusted', 'abandoned', 'silent' | 90 jours |
| `quota_increment` | integer(1) | chrome.storage.local | Incrément du compteur de quota journalier | Réinitialisé à minuit |

#### 2.1.4 Cas limites et gestion d'erreurs

| Cas | Comportement attendu | Justification |
|-----|---------------------|---------------|
| Page en HTTPS mais cert auto-signé + typosquatting | Nudge affiché (2 signaux atteints) | Cumul de signaux faibles = risque élevé |
| Formulaire de connexion sur HTTP en localhost (127.0.0.1) | Pas de nudge | Localhost est exclu (développement local légitime) |
| Domaine contenant un caractère Unicode (IDN homograph) | Traiter comme signal de typosquatting | Attaque connue (punycode) |
| Whitelist corrompue (format invalide en IndexedDB) | Recréer la whitelist vide, logger l'erreur | Fail-safe : en cas de doute, protéger l'utilisateur |
| HSTS preload list non chargée (fichier absent du bundle) | Ne pas utiliser ce signal, continuer avec les 3 autres | Dégradation gracieuse |
| Utilisateur désactive M2 dans les paramètres | Aucune détection, aucun nudge, aucun événement logué | Module complètement inactif |
| Champ password dans une iframe cross-origin | Ne pas détecter (limitation MV3 : content script = même origin) | Documenter la limitation |

#### 2.1.5 Interactions inter-modules détaillées

| Interaction | Description | Priorité |
|-------------|-------------|----------|
| M2 → M3 | Chaque événement M2 (affiché ou silencieux) alimente la composante "Comportement sur sites risqués". Action 'dismissed' = -4 pts, 'abandoned' = neutre, 'trusted' = neutre, 'silent' = -4 pts | — |
| M2 vs M7 | Si M2 et M7 se déclenchent sur le même formulaire : M2 est prioritaire (overlay interstitiel). M7 (toast) est différé de 5s après la fermeture de M2. | M2 > M7 |
| M2 vs M9 | M2 sur formulaire de connexion = M9 ne s'active pas (M9 = création uniquement). Pas de conflit. | Pas de conflit |
| M2 vs Quota | M2 est événementiel critique : affiché même si quota atteint (exception). Incrémente le compteur au-delà du quota. | Exception |

#### 2.1.6 Critères d'acceptation enrichis

Les CA-M2-01 à CA-M2-06 du CdC v1.1 sont repris et complétés :

**CA-M2-07 — Exclusion de localhost**
```gherkin
Given l'utilisateur navigue sur http://127.0.0.1:8080 avec un champ password
When l'utilisateur place le focus dans le champ password
Then aucun nudge M2 ne s'affiche
```

**CA-M2-08 — IDN homograph (punycode)**
```gherkin
Given l'utilisateur navigue sur "xn--pypal-4ve.com" (homograph de paypal.com)
  And la page contient un champ password
  And au moins 1 autre signal de risque est présent
When l'utilisateur place le focus dans le champ password
Then le nudge M2 s'affiche avec le signal "typosquatting" dans l'explication
```

**CA-M2-09 — Dégradation gracieuse HSTS**
```gherkin
Given la HSTS preload list n'est pas chargeable (fichier corrompu)
When un événement M2 est évalué
Then le signal HSTS est ignoré
  And les 3 autres signaux sont évalués normalement
  And un log d'erreur est enregistré dans la console de l'extension
```

**CA-M2-10 — Coexistence M2 + M7**
```gherkin
Given l'utilisateur saisit un mot de passe réutilisé sur un site à risque
When M2 et M7 se déclenchent simultanément
Then M2 (overlay interstitiel) s'affiche en priorité
  And M7 (toast) s'affiche 5 secondes après la fermeture de M2
  And les deux événements sont comptabilisés dans le quota
```

**CA-M2-11 — Sécurité DOM (D-SEC-003)**
```gherkin
Given le nudge M2 est affiché
When le contenu du domaine est injecté dans l'overlay
Then le domaine est affiché via textContent (jamais innerHTML)
  And aucun contenu de la page hôte n'est injecté dans l'overlay sans sanitization
```

---

### 2.2 M3 — Score de cyber-hygiène hebdomadaire

#### 2.2.1 Diagramme de séquence

```mermaid
sequenceDiagram
    participant AL as Alarme (lundi 09h)
    participant SW as Service Worker
    participant ST as Stockage Local
    participant BD as Badge Extension
    participant PU as Popup
    participant DB as Dashboard

    AL->>SW: alarm 'weekly_score' fired
    SW->>ST: Lire événements M2 de la semaine
    SW->>ST: Lire état M5 (navigateur à jour?)
    SW->>ST: Lire résultats quiz M6 de la semaine
    SW->>ST: Lire événements M7 de la semaine
    SW->>ST: Lire évaluations M9 de la semaine
    SW->>ST: Lire score précédent
    ST-->>SW: Données brutes de chaque module

    SW->>SW: Calculer les 5 composantes
    Note over SW: 1. MAJ nav: 20 si à jour, 0 sinon<br/>2. Phishing: %bonnes réponses × 25<br/>3. Sites risqués: 20-(4×ignorés)<br/>4. Diversité mdp: 20-(4×réutilisations)<br/>5. Force mdp: (forts/total)×15 ou 15 si 0/0

    SW->>SW: Gérer les modules désactivés (redistribution proportionnelle)
    SW->>SW: Calculer delta vs semaine précédente
    SW->>SW: Sélectionner l'action recommandée (composante la plus faible)

    SW->>ST: Stocker score (week_id, score, composantes, delta)
    SW->>BD: Mettre à jour badge couleur (vert/orange/rouge)
    SW->>BD: Afficher chiffre si notification

    U->>PU: Clic sur icône extension
    PU->>ST: Lire score courant + delta + action recommandée
    ST-->>PU: Données du score
    PU->>PU: Afficher le rapport hebdomadaire

    U->>DB: Clic "Voir l'historique"
    DB->>ST: Lire scores (12 ou 52 semaines)
    ST-->>DB: Données historiques
    DB->>DB: Afficher graphique de progression
```

#### 2.2.2 Machine à états du score

```mermaid
stateDiagram-v2
    [*] --> Attente : extension installée
    Attente --> Calcul : alarme lundi 09h OU premier démarrage lundi
    Calcul --> ModulesActifs : identifier les modules activés
    ModulesActifs --> CollecteMetriques : lire les événements de la semaine
    CollecteMetriques --> CalculComposantes : calculer chaque composante
    CalculComposantes --> Redistribution : module(s) désactivé(s)?

    Redistribution --> ScoreFinal : oui → redistribuer les poids
    CalculComposantes --> ScoreFinal : non → poids standard

    ScoreFinal --> Stockage : enregistrer score + composantes + delta
    Stockage --> MiseAJourBadge : mettre à jour badge couleur
    MiseAJourBadge --> NotificationDisponible : préparer le rapport popup
    NotificationDisponible --> Attente : attendre la semaine suivante

    Note right of Calcul : Si navigateur fermé à 09h,<br/>calcul au prochain démarrage le lundi
```

#### 2.2.3 Dictionnaire de données

**Données d'entrée (agrégées depuis les modules) :**

| Composante | Source | Requête IndexedDB | Calcul |
|-----------|--------|-------------------|--------|
| MAJ navigateur | M5 | Dernier événement M5 de la semaine | `is_up_to_date ? 20 : 0` |
| Résistance phishing | M6 | Derniers résultats quiz (`quiz_history` WHERE `timestamp` >= lundi précédent) | `(sum(correct) / sum(total)) × 25`. Si aucun quiz cette semaine : reprendre le dernier score connu |
| Comportement sites risqués | M2 | `events` WHERE `module='M2'` AND `action_user='dismissed'` AND `timestamp` >= lundi | `max(0, 20 - (4 × count(dismissed)))` |
| Diversité mots de passe | M7 | `events` WHERE `module='M7'` AND nudge affiché AND `timestamp` >= lundi | `max(0, 20 - (4 × count(reuse_detected)))` |
| Force mots de passe | M9 | `events` WHERE `module='M9'` AND `timestamp` >= lundi | Si 0 créations : `15` (indicateur 0/0). Sinon : `(count(force >= 4) / count(total)) × 15` (indicateur X/Y) |

**Données de sortie :**

| Champ | Type | Destination | Rétention |
|-------|------|-------------|-----------|
| `week_id` | string('YYYY-Www') | IndexedDB `scores` | 52 semaines |
| `score` | integer(0-100) | IndexedDB `scores` | 52 semaines |
| `composantes` | object | IndexedDB `scores` | 52 semaines |
| `delta` | integer(-100..+100) | IndexedDB `scores` | 52 semaines |
| `action_recommandee` | string | IndexedDB `scores` | 52 semaines |
| `badge_color` | enum('green','orange','red') | Badge extension | Jusqu'au prochain calcul |

**Algorithme de redistribution des poids :**

```
Si module M désactivé :
  poids_redistribué = poids_M × (poids_module_actif / somme_poids_actifs)
  Appliquer à chaque module actif

Exemple : M6 désactivé (25 pts)
  Actifs : M5(20) + M2(20) + M7(20) + M9(15) = 75
  M5 reçoit : 20 + 25×(20/75) = 26.67
  M2 reçoit : 20 + 25×(20/75) = 26.67
  M7 reçoit : 20 + 25×(20/75) = 26.67
  M9 reçoit : 15 + 25×(15/75) = 20.00
  Total = 100 ✓
```

**Algorithme de sélection de l'action recommandée :**

```
Identifier la composante avec le plus grand écart relatif au maximum :
  ecart_relatif = (poids_max - score_composante) / poids_max

Si ecart_relatif >= 0.5 :
  Recommander l'action corrective de cette composante
Sinon :
  Recommander "Continuez ainsi !" (message de renforcement positif)

Actions correctives par composante :
  MAJ nav → "Mettez à jour votre navigateur pour corriger les failles de sécurité"
  Phishing → "Un quiz phishing est disponible — testez votre vigilance"
  Sites risqués → "Soyez attentif aux alertes sur les sites suspects"
  Diversité mdp → "Diversifiez vos mots de passe avec un gestionnaire"
  Force mdp → "Renforcez vos mots de passe lors de vos prochaines inscriptions"
```

#### 2.2.4 Cas limites et gestion d'erreurs

| Cas | Comportement attendu |
|-----|---------------------|
| Première semaine (pas de score précédent) | Delta = 0, message "Votre premier score !" |
| Tous les modules désactivés sauf M3 | Score = 0/0, message "Activez au moins un module pour obtenir un score" |
| M3 lui-même désactivé | Aucun calcul, aucun badge, aucun rapport |
| Navigateur fermé le lundi | Calcul au premier démarrage le lundi. Si démarrage mardi, calcul immédiat mais semaine de référence = lundi-dimanche précédent |
| IndexedDB corrompue (store `events` inaccessible) | Score = "Données indisponibles", proposer "Effacer et recommencer" |
| Score = 0 | Message empathique : "Ce score est un point de départ — chaque semaine compte" |

#### 2.2.5 Critères d'acceptation enrichis

**CA-M3-06 — Première semaine d'utilisation**
```gherkin
Given l'extension est installée depuis moins de 7 jours
When le premier lundi est atteint
Then le score est calculé sur les jours disponibles
  And le delta affiche "Premier score !"
  And aucune comparaison semaine/semaine n'est affichée
```

**CA-M3-07 — Redistribution avec 2 modules désactivés**
```gherkin
Given l'utilisateur a désactivé M6 (25 pts) et M9 (15 pts)
When le score est calculé
Then les 40 points sont redistribués proportionnellement entre M5 (20), M2 (20), M7 (20)
  And le score total est exprimé sur 100
  And le détail affiche uniquement les 3 modules actifs
```

**CA-M3-08 — Action recommandée sur la composante la plus faible**
```gherkin
Given le score de la composante "Diversité mots de passe" est 4/20
  And toutes les autres composantes sont au-dessus de 50%
When le rapport hebdomadaire est affiché
Then l'action recommandée concerne la diversité des mots de passe
  And un lien "Voir comment faire" renvoie vers la page d'explication M7
```

---

### 2.3 M5 — Rappel de mise à jour navigateur

#### 2.3.1 Diagramme de séquence

```mermaid
sequenceDiagram
    participant BR as Navigateur (démarrage)
    participant SW as Service Worker
    participant API as chrome.runtime.requestUpdateCheck()
    participant ST as Stockage Local
    participant CS as Content Script
    participant UI as Toast M5

    BR->>SW: Événement 'startup' / alarme périodique
    SW->>API: requestUpdateCheck()
    API-->>SW: {status: 'update_available' | 'no_update' | 'throttled'}

    alt status = 'no_update'
        SW->>ST: Marquer navigateur à jour
        Note over SW: M3 composante MAJ = 20/20
    else status = 'throttled'
        SW->>SW: Réessayer dans 1h (alarme)
    else status = 'update_available'
        SW->>ST: Lire date dernier nudge M5
        ST-->>SW: last_m5_nudge_date

        alt Dernier nudge M5 < 48h
            SW->>SW: Reporter (délai de grâce)
        else Dernier nudge M5 >= 48h
            SW->>CS: Vérifier état onglet actif
            CS-->>SW: {fullscreen, form_active}

            alt Plein écran ou formulaire actif
                SW->>SW: Reporter au retour mode normal
            else Mode normal, pas de formulaire
                SW->>ST: Lire quota journalier
                ST-->>SW: quota_count

                alt Quota atteint
                    SW->>ST: Enregistrer événement silencieux
                else Quota disponible
                    SW->>ST: Incrémenter quota
                    SW-->>CS: Afficher toast M5
                    CS->>UI: Rendre toast

                    U->>UI: Action utilisateur
                    alt Mettre à jour maintenant
                        UI->>SW: action: 'update_now'
                        SW->>BR: chrome.tabs.create({url: 'chrome://settings/help'})
                        SW->>ST: Enregistrer événement (action: 'update_now')
                    else Me rappeler dans 4 heures
                        UI->>SW: action: 'remind_4h'
                        SW->>SW: Programmer alarme dans 4h
                        SW->>ST: Enregistrer événement (action: 'remind_4h')
                    else Pourquoi c'est important ?
                        UI->>UI: Ouvrir page statique M5
                    else Fermer (X) / Timeout 8s
                        UI->>SW: action: 'closed'
                        SW->>ST: Enregistrer événement (action: 'closed')
                    end
                end
            end
        end
    end
```

#### 2.3.2 Machine à états

```mermaid
stateDiagram-v2
    [*] --> Veille
    Veille --> Vérification : startup OU alarme périodique
    Vérification --> AJour : no_update
    Vérification --> Throttled : throttled (trop de requêtes)
    Vérification --> MiseAJourDispo : update_available

    AJour --> Veille : M3 = 20/20
    Throttled --> Veille : réessai dans 1h

    MiseAJourDispo --> DélaiGrâce : dernier nudge < 48h
    DélaiGrâce --> Veille : attendre expiration

    MiseAJourDispo --> VérificationContexte : dernier nudge >= 48h
    VérificationContexte --> Reporté : plein écran OU formulaire actif
    Reporté --> VérificationContexte : retour mode normal

    VérificationContexte --> QuotaCheck : contexte OK
    QuotaCheck --> Silencieux : quota atteint
    Silencieux --> Veille : événement logué

    QuotaCheck --> Affiché : quota disponible
    Affiché --> MisAJour : "Mettre à jour"
    Affiché --> Rappel4h : "Me rappeler dans 4h"
    Affiché --> Fermé : fermeture X / timeout 8s
    Affiché --> PageExplication : "Pourquoi c'est important ?"
    PageExplication --> Affiché

    MisAJour --> Archivé : ouvrir chrome://settings/help
    Rappel4h --> Archivé : programmer alarme 4h
    Fermé --> Archivé
    Archivé --> Veille
```

#### 2.3.3 Dictionnaire de données

**Données d'entrée :**

| Champ | Type | Source | Description |
|-------|------|--------|-------------|
| `update_status` | enum('update_available','no_update','throttled') | `chrome.runtime.requestUpdateCheck()` | État de mise à jour du navigateur |
| `current_version` | string | `navigator.userAgentData.brands` ou User-Agent | Version courante du navigateur |
| `last_m5_nudge` | ISO 8601 | chrome.storage.local | Date/heure du dernier nudge M5 |
| `is_fullscreen` | boolean | Content script / `document.fullscreenElement` | Navigateur en plein écran |
| `is_form_active` | boolean | Content script / `document.activeElement.tagName` | Un formulaire a le focus |

**Données de sortie :**

| Champ | Type | Destination | Rétention |
|-------|------|-------------|-----------|
| `event_id` | auto-increment | IndexedDB `events` | 90 jours |
| `module` | string('M5') | IndexedDB `events` | 90 jours |
| `timestamp` | ISO 8601 | IndexedDB `events` | 90 jours |
| `version_detected` | string | IndexedDB `events` | 90 jours |
| `action_user` | enum('update_now','remind_4h','closed','silent') | IndexedDB `events` | 90 jours |

#### 2.3.4 Cas limites et gestion d'erreurs

| Cas | Comportement attendu |
|-----|---------------------|
| `requestUpdateCheck()` retourne 'throttled' | Réessayer dans 1h via alarme. Ne pas afficher de nudge. |
| API `requestUpdateCheck()` non disponible (navigateur modifié) | Dégradation gracieuse : M5 désactivé, composante M3 = 0/20, log d'erreur |
| Utilisateur clique "Mettre à jour" mais `chrome://settings/help` est bloqué | Afficher message alternatif : "Ouvrez manuellement chrome://settings/help" |
| Navigateur sort du plein écran pendant le délai de report | Revérifier et afficher le nudge si les conditions sont toujours remplies |
| 4 clics consécutifs sur "Me rappeler dans 4h" (16h de report) | Après le 3e report consécutif : passer le délai de grâce à 48h (retour au rythme normal) |

#### 2.3.5 Critères d'acceptation enrichis

**CA-M5-05 — Gestion du throttling**
```gherkin
Given chrome.runtime.requestUpdateCheck() retourne "throttled"
When l'événement est traité
Then aucun nudge M5 ne s'affiche
  And une alarme est programmée pour réessayer dans 1 heure
```

**CA-M5-06 — Report maximum (anti-snooze infini)**
```gherkin
Given l'utilisateur a cliqué 3 fois de suite sur "Me rappeler dans 4 heures"
When le nudge M5 se représente une 4e fois
Then le bouton "Me rappeler dans 4 heures" n'est plus proposé
  And les options restantes sont "Mettre à jour" et "Fermer"
  And le prochain nudge M5 suivra le délai de grâce standard de 48h
```

---

### 2.4 M6 — Mini-quiz phishing contextuel

#### 2.4.1 Diagramme de séquence

```mermaid
sequenceDiagram
    participant AL as Alarme spaced repetition
    participant SW as Service Worker
    participant ST as Stockage Local
    participant CS as Content Script
    participant UI as Notification toast
    participant QZ as Quiz overlay

    AL->>SW: alarm 'quiz_scheduled' fired
    SW->>ST: Lire next_quiz_date + profil utilisateur
    ST-->>SW: {next_quiz_date, profile, quiz_history}

    alt Date non atteinte
        SW->>SW: Attendre (rien à faire)
    else Date atteinte
        SW->>ST: Lire quota journalier
        ST-->>SW: quota_count

        alt Quota atteint
            SW->>SW: Reporter au lendemain
        else Quota disponible
            SW->>CS: Vérifier si formulaire actif
            CS-->>SW: {form_active}

            alt Formulaire actif
                SW->>SW: Reporter à la fin de la saisie
            else Pas de formulaire
                SW->>ST: Incrémenter quota (notification uniquement)
                SW-->>CS: Afficher notification quiz
                CS->>UI: Rendre toast "Quiz disponible"

                alt Commencer maintenant
                    U->>UI: Clic "Commencer"
                    UI->>QZ: Ouvrir quiz overlay
                    SW->>SW: Sélectionner 3 questions (difficulté adaptative)

                    loop Pour chaque question (1 à 3)
                        QZ->>U: Afficher question + exemple phishing
                        U->>QZ: Sélectionner réponse + Valider
                        QZ->>QZ: Afficher feedback détaillé
                        U->>QZ: Clic "Question suivante"
                    end

                    QZ->>SW: Résultats {score_pct, categories_failed}
                    SW->>ST: Enregistrer résultats quiz
                    SW->>SW: Calculer prochaine date (spaced repetition)
                    SW->>ST: Mettre à jour next_quiz_date
                    QZ->>U: Afficher résumé final + score

                else Plus tard
                    U->>UI: Clic "Plus tard"
                    UI->>SW: Quiz reporté
                    SW->>ST: Quiz accessible depuis dashboard pendant 7 jours
                else Fermer (X)
                    UI->>SW: Notification fermée
                end
            end
        end
    end
```

#### 2.4.2 Machine à états

```mermaid
stateDiagram-v2
    [*] --> Planifié : date calculée par spaced repetition
    Planifié --> Vérification : date atteinte
    Vérification --> Reporté_Quota : quota atteint
    Vérification --> Reporté_Formulaire : formulaire actif
    Vérification --> Notifié : conditions OK, toast affiché

    Reporté_Quota --> Planifié : reporter au lendemain
    Reporté_Formulaire --> Vérification : fin de saisie

    Notifié --> QuizEnCours : "Commencer maintenant"
    Notifié --> Disponible7j : "Plus tard" / fermeture
    Disponible7j --> QuizEnCours : accès depuis dashboard
    Disponible7j --> Expiré : 7 jours écoulés

    QuizEnCours --> Question : afficher question
    Question --> Feedback : réponse validée
    Feedback --> Question : question suivante
    Feedback --> Terminé : dernière question

    Terminé --> RésultatEnregistré : score + catégories échouées
    RésultatEnregistré --> Planifié : calculer prochaine date

    Expiré --> Planifié : quiz manqué, reprendre le calendrier
```

#### 2.4.3 Dictionnaire de données

**Corpus quiz (embarqué) :**

| Champ | Type | Description |
|-------|------|-------------|
| `quiz_id` | string | Identifiant unique de l'exemple (ex: "phish-042") |
| `category` | enum('urgency','authority','gain','threat') | Technique de phishing utilisée |
| `difficulty` | enum('basic','intermediate','expert') | Niveau de difficulté |
| `locale` | enum('fr','en') | Langue de l'exemple |
| `type` | enum('email','webpage','sms') | Type de contenu simulé |
| `content` | object | Contenu de l'exemple (sujet, expéditeur, corps, URL) |
| `is_phishing` | boolean | Réponse correcte |
| `indicators` | string[] | Liste des signaux de phishing présents |
| `explanation` | string | Feedback détaillé |

**Algorithme de sélection adaptatif :**

```
1. Filtrer par locale courante
2. Filtrer par difficulté selon le profil :
   - Débutant : basic + intermediate
   - Intermédiaire : basic + intermediate + expert (pondéré)
   - Avancé : intermediate + expert
3. Si score des 2 derniers quiz = 100% : augmenter la difficulté d'un cran
4. Prioriser les catégories échouées précédemment
5. Exclure les quiz déjà vus dans les 3 dernières sessions
6. Sélectionner 3 questions (mix phishing / légitime : 2 phishing + 1 légitime)
```

**Données de sortie :**

| Champ | Type | Destination | Rétention |
|-------|------|-------------|-----------|
| `quiz_session_id` | auto-increment | IndexedDB `quiz_history` | Illimité |
| `timestamp` | ISO 8601 | IndexedDB `quiz_history` | Illimité |
| `score_pct` | integer(0-100) | IndexedDB `quiz_history` | Illimité |
| `questions_ids` | string[] | IndexedDB `quiz_history` | Illimité |
| `categories_failed` | string[] | IndexedDB `quiz_history` | Illimité |
| `next_quiz_date` | ISO 8601 | chrome.storage.local | Jusqu'au prochain quiz |

**Calendrier spaced repetition — algorithme :**

```
base_intervals = [0, 7, 21, 42, 70]  // jours depuis installation
after_initial = 30  // mensuel après les 5 premières sessions

Si session_count < 5 :
  next_date = install_date + base_intervals[session_count]
Sinon :
  next_date = last_quiz_date + after_initial

Ajustement : si dernier score < 50% : réduire l'intervalle de 30%
            si dernier score = 100% : augmenter l'intervalle de 20%
```

#### 2.4.4 Cas limites et gestion d'erreurs

| Cas | Comportement attendu |
|-----|---------------------|
| Corpus vide ou fichier JSON corrompu | M6 désactivé, message "Quiz temporairement indisponible", log erreur |
| Utilisateur ne finit pas le quiz (ferme l'overlay en cours) | Sauvegarder les réponses données, marquer le quiz comme incomplet, reproposer au prochain démarrage |
| Tous les quiz du corpus ont déjà été vus | Recycler les plus anciens (vus il y a > 90 jours) |
| Utilisateur change de profil après un quiz | Appliquer le nouveau profil au prochain quiz |
| Quiz planifié pendant le week-end (navigateur fermé) | Reporter au lundi suivant (intégré au calcul M3) |

#### 2.4.5 Critères d'acceptation enrichis

**CA-M6-06 — Quiz incomplet**
```gherkin
Given l'utilisateur a répondu à 2 questions sur 3
When il ferme l'overlay du quiz
Then les 2 réponses sont sauvegardées
  And le quiz est marqué comme incomplet
  And il est reproposé au prochain démarrage du navigateur
```

**CA-M6-07 — Recyclage du corpus**
```gherkin
Given tous les 50 exemples du corpus ont été utilisés
When un nouveau quiz est généré
Then les exemples vus il y a plus de 90 jours sont réintégrés au pool
  And la sélection adaptative s'applique normalement
```

**CA-M6-08 — Ajustement spaced repetition par score**
```gherkin
Given l'utilisateur a obtenu 30% au dernier quiz
When la prochaine date est calculée
Then l'intervalle est réduit de 30% par rapport à l'intervalle standard
  And la prochaine date est enregistrée dans chrome.storage.local
```

---

### 2.5 M7 — Nudge d'adoption gestionnaire de mots de passe

#### 2.5.1 Diagramme de séquence

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant CS as Content Script
    participant SW as Service Worker
    participant ST as Stockage Local
    participant UI as Toast M7

    U->>CS: Submit formulaire avec <input type="password">
    CS->>CS: Capturer valeur password au submit
    CS->>CS: Calculer SHA-256(sel_local + valeur)
    Note over CS: D-SEC-001 : sel local obligatoire
    CS->>CS: Effacer valeur en clair de la mémoire
    CS->>SW: sendMessage({module: 'M7', hash, domain_hash})

    SW->>ST: Lire password_hashes + suppression_list + last_m7_nudge
    ST-->>SW: {hashes[], suppression_domains[], last_nudge_by_domain}

    SW->>ST: Stocker le hash (FIFO max 100)

    alt Hash déjà présent dans le store (réutilisation détectée)
        alt Domaine dans la liste de suppression
            SW->>SW: Pas de nudge (utilisateur a demandé "Ne plus afficher")
        else Dernier nudge M7 pour ce domaine < 30 jours
            SW->>SW: Pas de nudge (délai de grâce)
        else Conditions remplies
            SW->>ST: Lire quota
            alt Quota atteint
                SW->>ST: Enregistrer événement silencieux
            else Quota disponible
                SW->>ST: Incrémenter quota
                SW-->>CS: Afficher toast M7
                CS->>UI: Rendre toast

                alt Voir comment ça marche
                    U->>UI: Clic
                    UI->>SW: Ouvrir page statique gestionnaires mdp
                    SW->>ST: Enregistrer événement (action: 'learn_more')
                else OK, compris
                    U->>UI: Clic
                    UI->>SW: Fermer toast
                    SW->>ST: Enregistrer événement (action: 'acknowledged')
                else Ne plus afficher pour ce site
                    U->>UI: Clic
                    UI->>SW: Ajouter domaine à suppression_list
                    SW->>ST: Enregistrer suppression + événement
                end
            end
        end
    else Hash nouveau (pas de réutilisation)
        SW->>SW: Rien à signaler
    end
```

#### 2.5.2 Machine à états

```mermaid
stateDiagram-v2
    [*] --> Dormant
    Dormant --> Interception : submit formulaire password
    Interception --> Hachage : capturer + SHA-256(sel + valeur)
    Hachage --> Stockage : stocker hash (FIFO 100)
    Stockage --> Comparaison : hash existe déjà?

    Comparaison --> Dormant : hash nouveau (pas de réutilisation)
    Comparaison --> VérificationSuppression : réutilisation détectée

    VérificationSuppression --> Dormant : domaine dans liste suppression
    VérificationSuppression --> VérificationDélai : domaine actif

    VérificationDélai --> Dormant : dernier nudge < 30 jours
    VérificationDélai --> QuotaCheck : délai >= 30 jours

    QuotaCheck --> Silencieux : quota atteint
    QuotaCheck --> Affiché : quota disponible

    Silencieux --> Archivé : événement logué
    Affiché --> EnSavoirPlus : "Voir comment ça marche"
    Affiché --> Compris : "OK, compris"
    Affiché --> Supprimé : "Ne plus afficher pour ce site"
    Affiché --> Fermé : timeout 8s / croix

    EnSavoirPlus --> Archivé : ouvrir page statique
    Compris --> Archivé
    Supprimé --> Archivé : ajouter à suppression_list
    Fermé --> Archivé

    Archivé --> Dormant
```

#### 2.5.3 Dictionnaire de données

**Données d'entrée :**

| Champ | Type | Source | Contrainte sécurité |
|-------|------|--------|-------------------|
| `password_value` | string | DOM `<input type="password">` au submit | **Jamais stocké** — effacé immédiatement après hachage |
| `installation_salt` | string(32) | chrome.storage.local (généré à l'installation) | D-SEC-001 : `crypto.getRandomValues(new Uint8Array(16))` |
| `password_hash` | string(64) | SHA-256(`installation_salt` + `password_value`) | Stocké dans IndexedDB `password_hashes` |
| `domain_hash` | string(64) | SHA-256(`domain`) | Stocké pour la suppression_list |

**Données de sortie :**

| Champ | Type | Destination | Rétention |
|-------|------|-------------|-----------|
| `hash` | string(64) | IndexedDB `password_hashes` | 90 jours FIFO max 100 |
| `timestamp` | ISO 8601 | IndexedDB `password_hashes` | 90 jours |
| `event` | object | IndexedDB `events` | 90 jours |
| `suppression_domain_hash` | string(64) | IndexedDB `whitelist` (module='M7') | Illimité (gestion manuelle) |

#### 2.5.4 Cas limites et gestion d'erreurs

| Cas | Comportement attendu |
|-----|---------------------|
| Formulaire soumis via JavaScript (pas de submit HTML) | Écouter aussi l'événement `XMLHttpRequest` / `fetch` sur les formulaires contenant un password field |
| Champ password vide au submit | Ignorer (pas de hachage d'une chaîne vide) |
| FIFO 100 hashes plein | Supprimer le plus ancien hash avant d'ajouter le nouveau |
| Sel d'installation perdu (chrome.storage.local effacé) | Générer un nouveau sel. Conséquence : les anciens hash ne matcheront plus → pas de faux positifs, mais réutilisations existantes non détectées. Acceptable. |
| Même mot de passe soumis 2x sur le même domaine | Pas de nudge (réutilisation = inter-domaines uniquement) |
| Extension installée après la création du mot de passe (hash pas encore en base) | Pas de détection possible. Le hash sera collecté au prochain login. |

#### 2.5.5 Critères d'acceptation enrichis

**CA-M7-05 — Sel local obligatoire (D-SEC-001)**
```gherkin
Given l'extension est installée
When un mot de passe est intercepté pour hachage
Then le hash est calculé avec SHA-256(sel_installation + mot_de_passe)
  And le sel est lu depuis chrome.storage.local
  And si le sel n'existe pas, un nouveau sel est généré avant le hachage
```

**CA-M7-06 — FIFO 100 hashes**
```gherkin
Given 100 hashes sont déjà stockés dans IndexedDB
When un 101e hash est ajouté
Then le hash le plus ancien est supprimé
  And le nouveau hash est ajouté
  And le store contient exactement 100 hashes
```

**CA-M7-07 — Réutilisation intra-domaine ignorée**
```gherkin
Given l'utilisateur soumet le même mot de passe 2 fois sur "site-a.com"
When le hash est comparé
Then aucun nudge M7 ne s'affiche (réutilisation intra-domaine)
```

---

### 2.6 M9 — Indicateur de force du mot de passe

#### 2.6.1 Diagramme de séquence

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant CS as Content Script
    participant SW as Service Worker
    participant UI as Overlay inline M9

    CS->>CS: Observer les champs password sur la page
    CS->>CS: Détecter formulaire de création (champ confirmation présent?)
    CS->>CS: Vérifier présence gestionnaire de mots de passe

    alt Gestionnaire détecté (autocomplete, data-form-type)
        CS->>CS: Ne pas activer M9
    else Formulaire de création sans gestionnaire
        U->>CS: Focus sur champ password
        CS->>UI: Afficher overlay inline (vide, en attente)

        loop À chaque frappe (debounce 150ms)
            U->>CS: Input event
            CS->>CS: Évaluer force (zxcvbn local)
            CS->>CS: Détecter type (password ou passphrase)

            alt Mode passphrase (>= 3 espaces ET >= 20 chars)
                CS->>UI: Suggestions passphrase (nombre de mots, originalité)
            else Mode password classique
                CS->>UI: Suggestions password (longueur, complexité, patterns)
            end

            CS->>UI: Mettre à jour barre + label + marqueur ANSSI
        end

        U->>CS: Submit formulaire
        CS->>CS: Capturer le niveau de force final (1-5)
        CS->>SW: sendMessage({module: 'M9', strength_level, type: password|passphrase})
        SW->>ST: Enregistrer évaluation (niveau + type, jamais le mdp)
        CS->>UI: Masquer overlay
    end
```

#### 2.6.2 Dictionnaire de données

**Données d'entrée :**

| Champ | Type | Source | Contrainte |
|-------|------|--------|-----------|
| `password_value` | string | DOM input event (temps réel) | **Jamais stocké, jamais transmis** — traitement en mémoire content script uniquement |
| `has_confirmation_field` | boolean | DOM scan | Signal de formulaire de création |
| `has_password_manager` | boolean | DOM attributs (`autocomplete`, `data-form-type`) | Détection heuristique |

**Algorithme zxcvbn — mapping vers niveaux ANSSI :**

| Score zxcvbn | Niveau | Label | Couleur | Marqueur ANSSI | Contribution M3 |
|-------------|--------|-------|---------|----------------|----------------|
| 0 | Très faible | "Très faible" | Rouge | "Déconseillé par l'ANSSI" | Non comptabilisé comme "fort" |
| 1 | Faible | "Faible" | Rouge | "Déconseillé par l'ANSSI" | Non comptabilisé comme "fort" |
| 2 | Moyen | "Moyen" | Jaune | "Acceptable" | Non comptabilisé comme "fort" |
| 3 | Fort | "Fort" | Vert clair | "Recommandé" | Comptabilisé comme "fort" |
| 4 | Très fort | "Très fort" | Vert foncé | "Recommandé" | Comptabilisé comme "fort" |

**Détection du type de mot de passe :**

M9 distingue deux stratégies de création, chacune avec ses propres suggestions :

```
FONCTION détecter_type(valeur):
  SI valeur contient >= 3 espaces ET longueur >= 20
    RETOURNER 'passphrase'
  SINON
    RETOURNER 'password'
```

Une phrase de passe (passphrase) tire sa force de sa longueur et du nombre de mots, pas de la complexité des caractères. Demander des symboles ou des chiffres à un utilisateur qui a choisi une phrase de passe est contre-productif et dégrade l'expérience.

**Suggestions textuelles dynamiques — mode `password` (classique) :**

| Condition | Suggestion |
|-----------|-----------|
| Longueur < 12 | "Ajoutez des caractères — visez au moins 12" |
| Pas de chiffre ET pas de symbole | "Ajoutez un chiffre ou un caractère spécial pour renforcer la force" |
| Pas de symbole ET longueur >= 12 | "Un caractère spécial (@, #, !) vous ferait passer à Fort" |
| Pattern détecté (123, abc, azerty) | "Évitez les séquences prévisibles" |
| Score >= 3 | "Bon mot de passe ! Pensez aussi à la phrase de passe : plus longue, plus facile à retenir" |
| Score = 4 | "Excellent ! Ce mot de passe est très solide" |

**Suggestions textuelles dynamiques — mode `passphrase` :**

| Condition | Suggestion |
|-----------|-----------|
| Nombre de mots < 4 | "Ajoutez un ou deux mots pour renforcer votre phrase de passe" |
| Nombre de mots >= 4 ET score < 3 | "Essayez des mots moins courants ou sans lien logique entre eux" |
| Mots très courants détectés (le, la, de, un, je, et) | "Remplacez les mots très courants par des mots plus originaux" |
| Score >= 3 | "Bonne phrase de passe ! Facile à retenir, difficile à deviner" |
| Score = 4 | "Excellente phrase de passe ! Longue et imprévisible" |

**Note :** L'algorithme zxcvbn gère nativement les phrases de passe (il analyse les séquences de mots via son dictionnaire). Le score zxcvbn reste la référence pour le mapping ANSSI, quel que soit le type détecté. Seules les suggestions textuelles sont adaptées.

#### 2.6.3 Cas limites et gestion d'erreurs

| Cas | Comportement attendu |
|-----|---------------------|
| Champ password sans champ de confirmation mais avec `autocomplete="new-password"` | Considérer comme formulaire de création (activer M9) |
| Gestionnaire détecté mais remplissage non automatique (utilisateur saisit manuellement) | Activer M9 si aucun remplissage auto détecté dans les 500ms après focus |
| Formulaire avec 3+ champs password (cas rare) | Activer M9 sur le premier champ non-confirmation |
| Page SPA qui change le formulaire dynamiquement | MutationObserver sur les champs password pour détecter les ajouts/suppressions |
| Évaluation zxcvbn > 100ms sur appareil lent | Debounce de 150ms sur l'input event pour limiter les évaluations |
| Phrase de passe sans chiffre ni symbole (ex: "le soleil brille sur la montagne") | Suggestions adaptées au mode passphrase (nombre de mots, originalité). Ne pas demander de chiffres/symboles. |
| Saisie qui bascule entre modes (ajout/suppression d'espaces) | Réévaluer le type à chaque frappe. La transition est transparente pour l'utilisateur. |

#### 2.6.4 Critères d'acceptation enrichis

**CA-M9-08 — Phrase de passe : suggestions adaptées**
```gherkin
Given l'overlay M9 est affiché
  And l'utilisateur saisit "le soleil brille sur la montagne"
When la saisie est évaluée
Then le mode "passphrase" est détecté (>= 3 espaces ET longueur >= 20)
  And la suggestion ne mentionne pas de chiffres ni de caractères spéciaux
  And la suggestion est adaptée au mode passphrase (ex: "Bonne phrase de passe !")
```

**CA-M9-09 — Phrase de passe avec mots trop courants**
```gherkin
Given l'overlay M9 est affiché
  And l'utilisateur saisit "le chat est sur la table"
When la saisie est évaluée
Then le mode "passphrase" est détecté
  And la suggestion indique "Remplacez les mots très courants par des mots plus originaux"
```

**CA-M9-10 — Mot de passe classique : suggestion de phrase de passe**
```gherkin
Given l'overlay M9 est affiché
  And l'utilisateur saisit "Tr0ub4dor&3" (mot de passe classique, score zxcvbn = 3)
When la saisie est évaluée
Then le mode "password" est détecté
  And la suggestion mentionne "Pensez aussi à la phrase de passe : plus longue, plus facile à retenir"
```

**CA-M9-11 — Marqueur ANSSI affiché**
```gherkin
Given l'overlay M9 est affiché
  And le mot de passe est évalué "Faible" (score zxcvbn = 1)
When l'utilisateur regarde l'overlay
Then le label "Faible" est affiché en rouge
  And le marqueur "Déconseillé par l'ANSSI" est visible à côté du label
```

**CA-M9-12 — Détection autocomplete="new-password"**
```gherkin
Given une page contient un seul champ password avec autocomplete="new-password"
  And aucun champ de confirmation
When l'utilisateur place le focus dans ce champ
Then l'overlay M9 s'affiche (formulaire de création détecté)
```

**CA-M9-13 — Debounce sur appareil lent**
```gherkin
Given l'utilisateur saisit rapidement 10 caractères en 500ms
When les input events sont reçus
Then l'évaluation zxcvbn est exécutée au maximum toutes les 150ms
  And l'overlay affiche le résultat de la dernière évaluation
```

---

### 2.7 M17 — Alerte au copier-coller de données sensibles

#### 2.7.1 Diagramme de séquence

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant CS as Content Script
    participant SW as Service Worker
    participant ST as Stockage Local
    participant UI as Toast M17

    U->>CS: Événement paste dans <input> ou <textarea>
    CS->>CS: Lire event.clipboardData.getData('text')
    CS->>CS: Pattern matching en mémoire

    Note over CS: Patterns :<br/>1. Carte bancaire (Luhn)<br/>2. IBAN (mod 97)<br/>3. Clé API (32+ alphanum, haute entropie)

    alt Aucun pattern sensible détecté
        CS->>CS: Nullifier la variable clipboard
        Note over CS: D-SEC-002 : < 10ms
    else Pattern sensible détecté
        CS->>CS: Identifier le type (carte/IBAN/API)
        CS->>CS: Nullifier la variable clipboard
        Note over CS: D-SEC-002 : < 10ms
        CS->>SW: sendMessage({module: 'M17', type: 'credit_card'})

        SW->>ST: Lire quota
        alt Quota atteint
            SW->>ST: Enregistrer événement silencieux
        else Quota disponible
            SW->>ST: Incrémenter quota
            SW-->>CS: Afficher toast M17
            CS->>UI: Rendre toast (type de donnée mentionné)

            alt Vider le presse-papiers
                U->>UI: Clic
                UI->>CS: navigator.clipboard.writeText('')
                CS->>SW: action: 'clipboard_cleared'
                SW->>ST: Enregistrer événement
                UI->>UI: Fermer toast
            else OK, merci
                U->>UI: Clic
                UI->>SW: action: 'acknowledged'
                SW->>ST: Enregistrer événement
                UI->>UI: Fermer toast
            else En savoir plus
                U->>UI: Clic
                UI->>SW: Ouvrir page statique M17
            end
        end
    end
```

#### 2.7.2 Dictionnaire de données

**Pattern matching — détails d'implémentation :**

| Type | Regex | Validation | Précision estimée | Temps max |
|------|-------|-----------|-------------------|-----------|
| Carte bancaire | `/\b(?:\d[ -]*?){13,19}\b/` | Algorithme de Luhn sur les chiffres extraits | Haute (>99%) | < 1ms |
| IBAN | `/\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/` | Modulo 97 (ISO 7064) | Haute (>99%) | < 1ms |
| Clé API | `/\b[A-Za-z0-9_-]{32,}\b/` | Calcul d'entropie Shannon >= 4.0 bits/char | Moyenne (~85%) | < 5ms |

**Contrainte D-SEC-002 :** La variable contenant la valeur collée (`clipboardData`) est nullifiée (`= null`) immédiatement après le pattern matching. Temps total : capture + matching + nullification < 10ms.

**Données de sortie :**

| Champ | Type | Destination | Rétention |
|-------|------|-------------|-----------|
| `event_id` | auto-increment | IndexedDB `events` | 90 jours |
| `module` | string('M17') | IndexedDB `events` | 90 jours |
| `timestamp` | ISO 8601 | IndexedDB `events` | 90 jours |
| `data_type` | enum('credit_card','iban','api_key') | IndexedDB `events` | 90 jours |
| `action_user` | enum('clipboard_cleared','acknowledged','silent') | IndexedDB `events` | 90 jours |

**Aucune valeur sensible n'est jamais stockée.** Seul le type de donnée est enregistré.

#### 2.7.3 Cas limites et gestion d'erreurs

| Cas | Comportement attendu |
|-----|---------------------|
| Collage dans un champ `contenteditable` (pas un `<input>`) | Détecter via l'événement paste sur le document, vérifier `event.target` |
| Valeur collée contient à la fois un IBAN et un numéro de carte | Signaler les deux types dans le toast (priorité : carte bancaire en premier) |
| Collage de texte très long (>10 000 caractères) | Limiter le pattern matching aux 1000 premiers caractères (performance) |
| `navigator.clipboard.writeText('')` échoue (permissions refusées) | Afficher message alternatif : "Videz manuellement votre presse-papiers (Ctrl+C sur un texte vide)" |
| Extension tierce intercepte le paste avant M17 | Dégradation gracieuse : si `clipboardData` est vide, ne rien faire |
| Utilisateur colle dans un champ password | Ne pas déclencher M17 (le champ password est le domaine de M2/M7/M9) |

#### 2.7.4 Critères d'acceptation enrichis

**CA-M17-05 — Nullification clipboard en mémoire (D-SEC-002)**
```gherkin
Given l'utilisateur colle un numéro de carte bancaire valide
When le pattern matching est effectué
Then la variable contenant la valeur collée est nullifiée en moins de 10ms
  And aucune trace de la valeur ne persiste en mémoire du content script
```

**CA-M17-06 — Exclusion des champs password**
```gherkin
Given l'utilisateur colle un texte dans un champ <input type="password">
When l'événement paste est intercepté
Then aucun nudge M17 ne s'affiche
  And le pattern matching n'est pas exécuté
```

**CA-M17-07 — Échec du vidage presse-papiers**
```gherkin
Given le nudge M17 est affiché
  And navigator.clipboard.writeText('') échoue (permissions)
When l'utilisateur clique sur "Vider le presse-papiers"
Then un message alternatif s'affiche : "Videz manuellement votre presse-papiers"
  And l'événement est enregistré avec action: 'clipboard_clear_failed'
```

**CA-M17-08 — Limitation collage volumineux**
```gherkin
Given l'utilisateur colle un texte de plus de 10 000 caractères
When le pattern matching est exécuté
Then seuls les 1000 premiers caractères sont analysés
  And le temps de traitement reste inférieur à 10ms
```

---

## 3. Composants transversaux

### 3.1 Système de quota journalier

#### 3.1.1 Algorithme de résolution de priorité

```
FONCTION résoudre_quota(événement, quota_count, quota_max):
  
  // Définir la priorité de l'événement
  priorités = {
    'M2':  1,   // Événementiel critique
    'M17': 1,   // Événementiel critique
    'M7':  2,   // Événementiel standard
    'M9':  2,   // Événementiel standard (pas de quota consommé — inline continu)
    'M5':  3,   // Programmé ponctuel
    'M3':  4,   // Programmé hebdomadaire
    'M6':  4    // Programmé hebdomadaire (notification uniquement)
  }

  // M9 ne consomme pas de quota (overlay inline continu, pas un nudge ponctuel)
  SI événement.module == 'M9':
    RETOURNER {action: 'show', consume_quota: false}

  // Vérifier le quota
  SI quota_count < quota_max:
    RETOURNER {action: 'show', consume_quota: true}

  // Quota atteint — exceptions critiques
  SI priorités[événement.module] == 1:
    RETOURNER {action: 'show_exception', consume_quota: true, notify_user: true}

  // Quota atteint — nudge non critique
  RETOURNER {action: 'defer', consume_quota: false, log_silent: true}
```

**File d'attente des nudges différés :**

```
SI action == 'defer':
  Ajouter à la file d'attente triée par priorité
  Au prochain reset du quota (minuit) :
    Dépiler par ordre de priorité
    Afficher jusqu'à épuisement du nouveau quota
  
  Les nudges différés expirent après 24h (pas d'accumulation)
```

#### 3.1.2 Machine à états du quota

```mermaid
stateDiagram-v2
    [*] --> Disponible : quota_count = 0 (minuit)
    Disponible --> Disponible : nudge affiché (quota_count++)
    Disponible --> Atteint : quota_count >= quota_max

    Atteint --> ExceptionCritique : événement M2 ou M17
    Atteint --> Différé : événement non critique
    Atteint --> Disponible : reset minuit

    ExceptionCritique --> Atteint : nudge affiché (quota_count++), notification utilisateur
    Différé --> FileDAttente : ajouter à la file triée
    FileDAttente --> Disponible : reset minuit → dépiler
    FileDAttente --> Expiré : 24h sans reset

    Note right of Atteint : Badge "Quota du jour atteint"
```

#### 3.1.3 Dictionnaire de données

| Champ | Type | Stockage | Description |
|-------|------|----------|-------------|
| `quota_count` | integer | chrome.storage.local | Nombre de nudges affichés aujourd'hui |
| `quota_max` | integer (3,5,10,0) | chrome.storage.local | Quota configuré (0 = illimité "Tous") |
| `quota_reset_date` | ISO 8601 (date seule) | chrome.storage.local | Date du dernier reset (pour détecter le changement de jour) |
| `deferred_queue` | array | chrome.storage.local | File d'attente des nudges différés [{module, priority, timestamp, event_data}] |

### 3.2 Stockage local (IndexedDB + chrome.storage.local)

#### 3.2.1 Schéma IndexedDB complet

**Base de données :** `sentinel_nudge_db` — Version : 1

| Store | Clé primaire | Index | Champs | Chiffré (AES-256-GCM) |
|-------|-------------|-------|--------|----------------------|
| `events` | `id` (auto-increment) | `module` (non-unique), `timestamp` (non-unique) | `id`, `module`, `timestamp`, `type`, `action_user`, `domain_hash`, `signals`, `data_type` | Oui |
| `password_hashes` | `hash` | `timestamp` (non-unique) | `hash`, `timestamp` | Oui |
| `scores` | `week_id` | — | `week_id`, `score`, `composantes`, `delta`, `action_recommandee` | Non (pas de donnée personnelle) |
| `quiz_history` | `id` (auto-increment) | `timestamp` (non-unique) | `id`, `timestamp`, `score_pct`, `questions_ids`, `categories_failed`, `next_quiz_date` | Non |
| `whitelist` | `domain_hash` | `module` (non-unique) | `domain_hash`, `timestamp_added`, `module` | Non |

#### 3.2.2 Flux chiffrement / déchiffrement

```mermaid
sequenceDiagram
    participant App as Application
    participant WC as Web Crypto API
    participant IDB as IndexedDB
    participant CSL as chrome.storage.local

    Note over App: Écriture d'un enregistrement chiffré

    App->>CSL: Lire encryption_key (raw AES-256)
    CSL-->>App: key_material

    App->>WC: crypto.subtle.importKey('raw', key_material, 'AES-GCM')
    WC-->>App: CryptoKey

    App->>App: Sérialiser l'enregistrement (JSON.stringify)
    App->>WC: crypto.subtle.encrypt({name: 'AES-GCM', iv: random_12_bytes}, key, data)
    WC-->>App: {iv, ciphertext}

    App->>IDB: put({id, iv, ciphertext})
    IDB-->>App: OK

    Note over App: Lecture d'un enregistrement chiffré

    App->>IDB: get(id)
    IDB-->>App: {id, iv, ciphertext}

    App->>CSL: Lire encryption_key
    CSL-->>App: key_material
    App->>WC: crypto.subtle.importKey + decrypt({name: 'AES-GCM', iv}, key, ciphertext)
    WC-->>App: plaintext (JSON)
    App->>App: JSON.parse(plaintext)
```

**Initialisation de la clé :**

```
À la première installation :
  key_bytes = crypto.getRandomValues(new Uint8Array(32))  // 256 bits
  salt_bytes = crypto.getRandomValues(new Uint8Array(16))  // 128 bits (D-SEC-001)
  chrome.storage.local.set({
    encryption_key: Array.from(key_bytes),
    installation_salt: Array.from(salt_bytes),
    db_version: 1
  })
```

#### 3.2.3 Stratégie de migration

```
AU DÉMARRAGE du Service Worker :
  Lire db_version depuis chrome.storage.local
  SI db_version < CURRENT_DB_VERSION :
    Exécuter les migrations séquentiellement (v1→v2, v2→v3, etc.)
    Mettre à jour db_version

CHAQUE migration est :
  - Idempotente (peut être rejouée sans risque)
  - Transactionnelle (rollback si échec)
  - Documentée dans un fichier migrations/ du code source
```

#### 3.2.4 Purge automatique (rétention)

```
ALARME quotidienne 'data_cleanup' (02h00) :
  // Events : 90 jours glissants
  Supprimer de 'events' WHERE timestamp < now - 90 jours

  // Password hashes : 90 jours + FIFO 100
  Supprimer de 'password_hashes' WHERE timestamp < now - 90 jours
  SI count > 100 : supprimer les plus anciens jusqu'à 100

  // Scores : 52 semaines glissantes
  Supprimer de 'scores' WHERE week_id < now - 52 semaines
```

### 3.3 Onboarding — Premier lancement

#### 3.3.1 Machine à états

```mermaid
stateDiagram-v2
    [*] --> Vérification : extension démarrée
    Vérification --> Étape1_Bienvenue : onboarding_completed == false
    Vérification --> Normal : onboarding_completed == true

    Étape1_Bienvenue --> Étape2_Profil : clic "Suivant"
    Étape2_Profil --> Étape1_Bienvenue : clic "Retour"
    Étape2_Profil --> Étape3_Modules : clic "Suivant" + profil sélectionné

    Étape3_Modules --> Étape2_Profil : clic "Retour"
    Étape3_Modules --> Étape4_Confidentialité : clic "Confirmer" + modules cochés

    Étape4_Confidentialité --> Étape3_Modules : clic "Retour"
    Étape4_Confidentialité --> ConsentementM7 : M7 activé?

    ConsentementM7 --> OnboardingTerminé : consentement M7 donné OU M7 désactivé
    Étape4_Confidentialité --> OnboardingTerminé : M7 non activé

    OnboardingTerminé --> Normal : onboarding_completed = true
```

#### 3.3.2 Persistance par étape

| Étape | Données persistées | Moment de persistance |
|-------|-------------------|----------------------|
| Étape 2 (Profil) | `user_profile` : 'beginner' / 'intermediate' / 'advanced' | Dès la sélection du radio button |
| Étape 3 (Modules) | `modules_enabled` : {M2: true, M3: true, ...} | Au clic "Confirmer et démarrer" |
| Étape 4 (Confidentialité) | `m7_consent` : boolean, `onboarding_completed` : true | Au clic de validation finale |

**Récupération d'erreur :** Si le navigateur ferme pendant l'onboarding, l'étape en cours est reprise au prochain démarrage (basé sur `onboarding_completed` == false et les données déjà persistées).

### 3.4 Page de paramètres

#### 3.4.1 Modèle de données

| Section | Clé chrome.storage.local | Type | Défaut |
|---------|--------------------------|------|--------|
| Modules actifs | `modules_enabled` | object {M2: bool, M3: bool, ...} | Tous activés |
| Quota | `quota_max` | integer | 3 |
| Profil | `user_profile` | enum | 'beginner' |
| Langue | `locale` | enum('fr','en') | Détection automatique `chrome.i18n.getUILanguage()` |
| Toast durée | `toast_duration_ms` | integer | 8000 |

#### 3.4.2 Logique de persistance

- Chaque modification est enregistrée immédiatement dans `chrome.storage.local`
- Un événement `chrome.storage.onChanged` notifie le Service Worker et les content scripts actifs
- Les content scripts rechargent leur configuration sans nécessiter de rafraîchissement de la page

### 3.5 Dashboard — Tableau de bord

#### 3.5.1 Requêtes d'agrégation

| Vue | Requête IndexedDB | Données affichées |
|-----|-------------------|-------------------|
| Score courant | `scores.get(current_week_id)` | Score, delta, composantes, action recommandée |
| Historique 12 semaines | `scores.getAll()` + tri par week_id DESC + limit 12 | Graphique linéaire (semaines en X, score 0-100 en Y) |
| Historique complet | `scores.getAll()` + tri par week_id DESC | Graphique étendu (52 semaines max) |
| Détail par composante | Extraction des `composantes` du score courant | 5 barres de progression (une par composante active) |
| Stats nudges | `events.index('module').getAll()` + groupBy module | Nombre de nudges par module, taux de réponse positive |
| Quiz M6 | `quiz_history.getAll()` + tri par timestamp DESC | Scores progressifs, prochaine date, catégories à travailler |

#### 3.5.2 Graphique de progression

| Paramètre | Valeur |
|-----------|--------|
| Type | Ligne avec points |
| Axe X | Semaines (Sxx) |
| Axe Y | Score 0-100 |
| Couleur ligne | Dégradé selon score (rouge → orange → vert) |
| Zone de référence | Bande verte ≥ 70 (objectif) |
| Rendu | Canvas ou SVG (pas de librairie externe — respect ENF-SEC-03) |
| Responsive | Redimensionnement automatique |
| Accessibilité | Données accessibles sous forme de tableau alternatif (lecteur d'écran) |

### 3.6 Système de notification

#### 3.6.1 Spécifications techniques par type

*Section revue par l'expert accessibilité et l'expert UX/UI (2026-04-11).*

**Décisions UX en attente d'arbitrage du Commanditaire :**

| ID | Question | Option A (recommandée) | Option B | Option C |
|----|----------|----------------------|----------|----------|
| UX-01 | Position des toasts | Bas à droite (zone moins utilisée) | Haut à droite (convention Material Design, actuel) | Position configurable |
| UX-02 | Overlay M2 : bloque la visibilité de l'URL | Panel latéral droit (400px, backdrop léger) | Overlay centré avec backdrop allégé (0.3) | Toast amélioré sans backdrop |
| UX-03 | Animation overlay M2 | Scale-in 200ms ease-out | Slide-in depuis le haut 300ms | — |
| UX-04 | Indication file d'attente toasts | Indicateur "1 autre notification" | Empilage 2 toasts max (décalés) | File invisible (actuel) |
| UX-05 | Symboles ✓/◐/✗ dans le badge Chrome | Couleur + chiffre dans le badge, symboles dans la popup uniquement | Symboles dans le badge (test empirique) | — |

**Toast (M5, M7, M17) :**

| Propriété | Valeur |
|-----------|--------|
| Position | `position: fixed; top: 16px; right: 16px; z-index: 2147483647` |
| Largeur | `min-width: min(320px, calc(100vw - 32px)); max-width: 420px` |
| Timer | 8s par défaut (configurable). Pause au hover (`mouseenter` → pause, `mouseleave` → resume). Option "Pas de disparition automatique" dans les paramètres d'accessibilité (WCAG 2.2.1 Timing Adjustable) |
| Animation | Slide-in depuis la droite (300ms ease-out). Fade-out au close (200ms). Animations supprimées si `prefers-reduced-motion: reduce` |
| Empilage | Max 1 toast à la fois. Si un toast est déjà affiché, le nouveau attend en file |
| Shadow DOM | Toasts rendus dans un Shadow DOM isolé (pas de conflit CSS avec la page hôte) |
| ARIA | `role="status"`, `aria-live="polite"`, `aria-atomic="true"` |

**Overlay interstitiel (M2) :**

| Propriété | Valeur |
|-----------|--------|
| Position | `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2147483647` |
| Backdrop | `position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2147483646` |
| Largeur | `max-width: 520px; width: 90vw` |
| Fermeture | Croix + Escape. `Escape` = fermeture neutre (équivalent croix, pas d'action risquée). Le backdrop n'est pas cliquable (pas de fermeture accidentelle) |
| Focus trap | Le focus clavier est piégé dans l'overlay (Tab cycle entre les boutons). Premier focus sur "Abandonner la saisie" (action la plus sûre) |
| Shadow DOM | Oui |
| ARIA | `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby` (titre), `aria-describedby` (détail des signaux de risque détectés) |

**Overlay inline (M9) :**

| Propriété | Valeur |
|-----------|--------|
| Position | Inséré immédiatement après le champ password dans le DOM (`insertAdjacentElement('afterend')`) |
| Largeur | Même largeur que le champ password parent |
| z-index | `z-index: 2147483645` (sous les toasts et overlays) |
| Shadow DOM | Oui |
| ARIA | `role="status"`, `aria-live="polite"` (mises à jour annoncées aux lecteurs d'écran à chaque changement de niveau) |

**Badge icône :**

| Propriété | Valeur |
|-----------|--------|
| API | `chrome.action.setBadgeBackgroundColor` + `chrome.action.setBadgeText` |
| Couleurs | Vert (#4CAF50) score ≥ 70, Orange (#FF9800) 40-69, Rouge (#F44336) < 40, Bleu (#2196F3) notification |
| Indicateur non-chromatique | ✓ (score ≥ 70), ◐ (score 40-69), ✗ (score < 40) — visible indépendamment de la couleur (daltonisme) |
| Texte | Chiffre (nombre de notifications) ou icône d'état seule |

#### 3.6.2 Accessibilité clavier

| Composant | Comportement clavier |
|-----------|---------------------|
| Toast | `Tab` : parcourir les boutons. `Escape` : fermer le toast. `Enter/Space` : activer le bouton focused |
| Overlay M2 | Focus trap : `Tab`/`Shift+Tab` cyclent entre les boutons. `Escape` = fermeture neutre (ferme le nudge, aucune action). Premier focus sur "Abandonner la saisie" (action la plus sûre) |
| Overlay M9 | Non focusable mais annoncé par les lecteurs d'écran via `aria-live="polite"` |
| Tous | Attributs ARIA définis dans le tableau 3.6.1 par type de composant |

**Paramètre d'accessibilité — Timing :**

| Clé | Type | Défaut | Description |
|-----|------|--------|-------------|
| `toast_auto_dismiss` | boolean | true | Si false, les toasts ne disparaissent pas automatiquement (WCAG 2.2.1) |

Ce paramètre est proposé dans la section "Accessibilité" des paramètres de l'extension.

### 3.7 Pages d'explication statiques

#### 3.7.1 Structure i18n

```
src/
  pages/
    explain-m2.html          ← template HTML (structure)
  _locales/
    fr/
      messages.json           ← contient les textes FR de toutes les pages
    en/
      messages.json           ← contient les textes EN de toutes les pages
```

Chaque page utilise `chrome.i18n.getMessage('key')` pour afficher le texte dans la langue active.

#### 3.7.2 Plan de contenu par page

| Page | Sections | Sources scientifiques | Conseils pratiques |
|------|----------|----------------------|-------------------|
| Sites suspects (M2) | Signaux de risque, Typosquatting, Certificats | Sunshine et al. 2009, Schechter et al. 2007 | Vérifier l'URL, chercher le cadenas, utiliser les favoris |
| Mises à jour (M5) | Failles corrigées, Délais d'exploitation | Beautement et al. 2016 | Activer les mises à jour auto, vérifier chrome://settings/help |
| Phishing (M6) | Techniques, Signaux d'alerte, Statistiques | Kumaraguru et al. 2007, Lain et al. 2022 | Vérifier l'expéditeur, ne jamais cliquer dans l'urgence |
| Gestionnaires mdp (M7) | Fonctionnement, Avantages, Projets open source | — | KeePass, KeePassXC, Bitwarden, Vaultwarden + disclaimer |
| Force mdp (M9) | Entropie, Attaques brute force, Temps de craquage | ANSSI Guide mdp 2021 | Phrases de passe, 12+ caractères, pas de patterns |
| Presse-papiers (M17) | Risque partage inter-apps, Historique clipboard | — | Vider après usage, éviter copier-coller de données sensibles |
| Calcul du score (M3) | Formule, Poids, Redistribution | Anderson et al. 2016 | Consulter le détail par composante, suivre l'action recommandée |

---

## 4. Exigences non fonctionnelles détaillées

### 4.1 Privacy by design — mapping par module

| ENF | Description | Modules impactés | Critère de test |
|-----|-------------|-----------------|-----------------|
| ENF-PBD-01 | Aucun appel réseau sortant | Tous sauf M5 | `chrome://net-internals` pendant 1h : 0 requête de l'extension |
| ENF-PBD-02 | Aucune télémétrie | Tous | Audit code : aucun `fetch`, `XMLHttpRequest`, `navigator.sendBeacon` |
| ENF-PBD-03 | Minimisation des données | M2, M7, M9, M17 | Vérifier : seuls les hash/niveaux sont stockés, jamais les valeurs |
| ENF-PBD-04 | Chiffrement au repos | events, password_hashes | Test : lire IndexedDB directement → données illisibles sans clé |
| ENF-PBD-05 | Droit à l'effacement | Paramètres | Test : "Effacer toutes mes données" → stores vides + onboarding |
| ENF-PBD-06 | Aucun identifiant persistant | Installation | Audit : pas d'UUID, pas de fingerprinting, sel = aléatoire non traçable |
| ENF-PBD-07 | Domaines jamais en clair | M2, M7 | Audit code : `SHA-256(domain)` avant tout stockage |
| ENF-PBD-08 | Politique de confidentialité plain language | Onboarding, Paramètres | Revue texte : Flesch-Kincaid ≤ 12 (compréhensible par un collégien) |

### 4.2 Performance — budget par module

| Module | CPU max (événement) | Mémoire max | Latence max (affichage nudge) |
|--------|--------------------|--------------|-----------------------------|
| M2 | 5ms (évaluation signaux) | 1 Mo (HSTS list en mémoire) | 500ms |
| M3 | 50ms (calcul score) | 2 Mo (agrégation événements) | Non applicable (batch) |
| M5 | 1ms (lecture API) | < 1 Mo | 500ms |
| M6 | 10ms (sélection quiz) | 2 Mo (corpus en mémoire) | Non applicable (volontaire) |
| M7 | 2ms (SHA-256 + lookup) | < 1 Mo (100 hashes) | 500ms |
| M9 | 50ms (zxcvbn par frappe) | 1 Mo (dictionnaire zxcvbn) | 100ms |
| M17 | 5ms (pattern matching) | < 1 Mo | 500ms |
| **Total au repos** | **< 0.1% CPU** | **< 20 Mo** | — |

### 4.3 Accessibilité — checklist WCAG 2.1 AA

| Composant UI | Clavier | Lecteur d'écran | Contraste | Cible 44px | Zoom 200% |
|-------------|---------|-----------------|-----------|-----------|-----------|
| Toast (M5, M7, M17) | Tab, Escape, Enter | role="status", aria-live="polite", aria-atomic="true" | 4.5:1 min | Boutons 44×44 | Responsive |
| Overlay M2 | Focus trap, Escape (neutre) | role="alertdialog", aria-modal="true", aria-labelledby, aria-describedby | 4.5:1 min | Boutons 44×44 | Responsive |
| Overlay M9 | Non focusable | role="status", aria-live="polite" | 4.5:1 min | N/A (informatif) | Responsive |
| Popup M3 | Tab dans la popup | Structure sémantique h1/h2/p | 4.5:1 min | Liens/boutons 44×44 | Responsive |
| Dashboard | Navigation standard | Structure sémantique, tableau alternatif pour le graphique | 4.5:1 min | Tous interactifs 44×44 | Responsive |
| Onboarding | Tab, radio buttons, checkboxes | Labels associés, fieldsets | 4.5:1 min | Cibles 44×44 | Responsive |
| Paramètres | Navigation standard | Labels, descriptions | 4.5:1 min | Switches/boutons 44×44 | Responsive |

### 4.4 Internationalisation — structure i18n

**Architecture :**

```
_locales/
  fr/messages.json    ← langue par défaut (default_locale dans manifest.json)
  en/messages.json    ← langue secondaire
```

**Convention de nommage des clés :**

```
{module}_{component}_{element}
Exemples :
  "m2_overlay_title": "Ce domaine présente des signaux inhabituels"
  "m2_overlay_btn_continue": "Continuer quand même"
  "m3_popup_score_label": "Votre score de cyber-hygiène"
  "common_btn_close": "Fermer"
  "settings_quota_label": "Quota journalier de nudges"
```

**Dates et nombres :** Utiliser `Intl.DateTimeFormat` et `Intl.NumberFormat` avec la locale détectée.

### 4.5 Sécurité — décisions du comité de sécurité

| ID | Décision | Implémentation attendue | Module |
|----|----------|------------------------|--------|
| D-SEC-001 | SHA-256 avec sel local | `SHA-256(installation_salt + password)` au lieu de `SHA-256(password)` | M7 |
| D-SEC-002 | Nullification clipboard < 10ms | `clipboardValue = null; delete clipboardValue;` immédiatement après pattern matching | M17 |
| D-SEC-003 | Interdiction innerHTML | Utiliser `element.textContent`, `document.createElement`, `element.appendChild` exclusivement | Tous (content scripts) |
| D-SEC-004 | Risque R-003 accepté | Documenter dans la politique de confidentialité que la clé AES est protégée par le profil Chrome | Transversal |
| D-SEC-005 | AIPD M7 en P3 | Analyse d'Impact relative à la Protection des Données pour le traitement de hash de mots de passe | M7 |

---

## 5. Matrice de traçabilité CdC → SFD

### 5.1 Traçabilité par module

| Réf. CdC | Description CdC | Réf. SFD | Couvert |
|-----------|-----------------|----------|---------|
| CdC 2.2 | M2 — Détection saisie contexte risqué | SFD 2.1 (séquence, états, données, cas limites, Gherkin) | ✓ |
| CdC 2.3 | M3 — Score cyber-hygiène | SFD 2.2 (séquence, états, données, algorithmes, cas limites, Gherkin) | ✓ |
| CdC 2.4 | M5 — Rappel mise à jour | SFD 2.3 (séquence, états, données, cas limites, Gherkin) | ✓ |
| CdC 2.5 | M6 — Quiz phishing | SFD 2.4 (séquence, états, données, corpus, spaced repetition, Gherkin) | ✓ |
| CdC 2.6 | M7 — Nudge gestionnaire mdp | SFD 2.5 (séquence, états, données, D-SEC-001, cas limites, Gherkin) | ✓ |
| CdC 2.7 | M9 — Force mot de passe | SFD 2.6 (séquence, données, zxcvbn, ANSSI, cas limites, Gherkin) | ✓ |
| CdC 2.8 | M17 — Alerte copier-coller | SFD 2.7 (séquence, données, patterns, D-SEC-002, cas limites, Gherkin) | ✓ |

### 5.2 Traçabilité composants transversaux

| Réf. CdC | Description CdC | Réf. SFD | Couvert |
|-----------|-----------------|----------|---------|
| CdC 2.9.1 | Système de quota | SFD 3.1 (algorithme priorité, machine à états, données) | ✓ |
| CdC 2.9.2 | Stockage local | SFD 3.2 (schéma complet, chiffrement, migration, purge) | ✓ |
| CdC 2.9.3 | Onboarding | SFD 3.3 (machine à états, persistance par étape) | ✓ |
| CdC 2.9.4 | Paramètres | SFD 3.4 (modèle de données, persistance) | ✓ |
| CdC 2.9.5 | Dashboard | SFD 3.5 (requêtes, graphique, accessibilité) | ✓ |
| CdC 2.9.6 | Notifications | SFD 3.6 (CSS, z-index, Shadow DOM, accessibilité clavier) | ✓ |
| CdC 2.9.7 | Pages statiques | SFD 3.7 (structure i18n, plan de contenu) | ✓ |

### 5.3 Traçabilité exigences non fonctionnelles

| Réf. CdC | Description | Réf. SFD | Couvert |
|-----------|-------------|----------|---------|
| ENF-PBD-01 à 08 | Privacy by design | SFD 4.1 | ✓ |
| ENF-PERF-01 à 06 | Performance | SFD 4.2 | ✓ |
| ENF-ACC-01 à 06 | Accessibilité | SFD 4.3 | ✓ |
| ENF-I18N-01 à 05 | Internationalisation | SFD 4.4 | ✓ |
| ENF-SEC-01 à 07 | Sécurité extension | SFD 4.5 (+ PV comité sécurité) | ✓ |
| ENF-COMPAT-01 à 05 | Compatibilité | CdC (pas de détail SFD supplémentaire nécessaire — MV3 imposé) | ✓ |

### 5.4 Traçabilité critères d'acceptation

| Origine | Nombre CA CdC | Nombre CA SFD ajoutés | Total |
|---------|--------------|----------------------|-------|
| M2 | 6 (CA-M2-01 à 06) | 5 (CA-M2-07 à 11) | 11 |
| M3 | 5 (CA-M3-01 à 05) | 3 (CA-M3-06 à 08) | 8 |
| M5 | 4 (CA-M5-01 à 04) | 2 (CA-M5-05 à 06) | 6 |
| M6 | 5 (CA-M6-01 à 05) | 3 (CA-M6-06 à 08) | 8 |
| M7 | 4 (CA-M7-01 à 04) | 3 (CA-M7-05 à 07) | 7 |
| M9 | 7 (CA-M9-01 à 07) | 6 (CA-M9-08 à 13) | 13 |
| M17 | 4 (CA-M17-01 à 04) | 4 (CA-M17-05 à 08) | 8 |
| Global | 8 (CA-GLOBAL-01 à 08) | 0 | 8 |
| **Total** | **43** | **26** | **69** |

---

## 6. Glossaire

Le glossaire du CdC v1.1 (section 7) est repris intégralement et complété :

| Terme | Définition |
|-------|-----------|
| **Debounce** | Technique limitant le nombre d'exécutions d'une fonction à une seule par intervalle de temps. Utilisée par M9 pour limiter les évaluations zxcvbn à 1 toutes les 150ms. |
| **FIFO** | First In, First Out — stratégie de gestion de file. Utilisée pour le store `password_hashes` (max 100 entrées, le plus ancien est supprimé en premier). |
| **Focus trap** | Technique d'accessibilité piégeant la navigation clavier (Tab) à l'intérieur d'un élément modal, empêchant le focus de s'échapper vers le contenu sous-jacent. |
| **MutationObserver** | API DOM permettant de détecter les modifications dynamiques du DOM (ajout/suppression de nœuds). Utilisée par M9 pour détecter les champs password ajoutés dynamiquement dans les SPA. |
| **Shadow DOM** | Encapsulation DOM native permettant d'isoler le CSS et le JavaScript d'un composant. Utilisée pour les nudges afin d'éviter les conflits de style avec les pages hôtes. |
| **Entropie de Shannon** | Mesure théorique de l'imprévisibilité d'une chaîne de caractères (bits/caractère). Utilisée par M17 pour distinguer les clés API (entropie ≥ 4.0) des chaînes ordinaires. |

---

*Spécifications Fonctionnelles Détaillées produites par l'Analyste métier — Fabrique — Phase P2*
*Version 1.0 — 2026-04-11*
*Ce document sera soumis au Référent qualité avant transmission au Commanditaire.*
