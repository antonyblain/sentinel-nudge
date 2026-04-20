# Cahier des charges — Sentinel Nudge v1
## Phase P1 — Analyste métier

**Projet :** Sentinel Nudge
**Version :** 1.1
**Date de production :** 2026-04-11
**Date de révision :** 2026-04-11
**Statut :** Révisé suite aux commentaires du Commanditaire
**Commanditaire :** Antony (RSSI)
**Niveau de sensibilité :** Exposé

---

## Table des matières

1. Présentation du projet
   - 1.1 Contexte et enjeux
   - 1.2 Objectifs du projet
   - 1.3 Périmètre (v1 / v2 / exclusions)
   - 1.4 Parties prenantes
2. Description fonctionnelle
   - 2.1 Vue d'ensemble des 7 modules v1
   - 2.2 Module M2 — Détection de saisie en contexte risqué
   - 2.3 Module M3 — Score de cyber-hygiène hebdomadaire
   - 2.4 Module M5 — Rappel de mise à jour navigateur
   - 2.5 Module M6 — Mini-quiz phishing contextuel
   - 2.6 Module M7 — Nudge d'adoption gestionnaire de mots de passe
   - 2.7 Module M9 — Indicateur de force du mot de passe
   - 2.8 Module M17 — Alerte au copier-coller de données sensibles
   - 2.9 Composants transversaux
3. Exigences non fonctionnelles
   - 3.1 Privacy by design
   - 3.2 Performance et légèreté
   - 3.3 Accessibilité
   - 3.4 Internationalisation
   - 3.5 Compatibilité navigateurs
   - 3.6 Sécurité de l'extension elle-même
4. Contraintes techniques
   - 4.1 Manifest V3 et permissions
   - 4.2 Stockage local chiffré
   - 4.3 Architecture sans réseau sortant
   - 4.4 Open source et auditabilité
5. Critères d'acceptation globaux
6. Lotissement et évolutions futures
   - 6.1 Périmètre v2
   - 6.2 Périmètre v2+
   - 6.3 Exclusions définitives
7. Glossaire

---

## 1. Présentation du projet

### 1.1 Contexte et enjeux

La grande majorité des incidents de cybersécurité implique le facteur humain : hameçonnage, réutilisation de mots de passe, mises à jour différées, saisies de credentials sur des sites frauduleux. Ces comportements ne résultent pas d'un manque de connaissance mais d'une architecture du choix défavorable : l'action sécurisée est plus coûteuse cognitivement que l'action risquée.

La recherche en sciences comportementales appliquées à la cybersécurité (CyberSecurity Behavioral Science, CSBS) a produit depuis 2007 un corpus solide de preuves empiriques : les nudges — interventions dans l'architecture du choix — peuvent améliorer significativement les comportements de sécurité sans contraindre l'utilisateur. Parmi les résultats les plus robustes : les warnings interstitiels au bon moment sont suivis dans 97 % des cas (Sunshine et al., 2009), les scores de gamification réduisent de 52 % l'usage de mots de passe faibles (Forget et al., 2014), et les simulations de phishing réduisent durablement le taux de clic de 30 points (Kumaraguru et al., 2007).

Sentinel Nudge est une extension navigateur open-source conçue pour appliquer ces mécanismes directement dans le navigateur de l'utilisateur, au moment précis où la décision de sécurité est prise (just-in-time nudge). Elle repose sur trois principes fondateurs :
- **Traitement 100 % local** : aucune donnée ne quitte le poste de l'utilisateur, aucune télémétrie.
- **Transparence radicale** : chaque mécanisme comportemental est documenté et accessible à l'utilisateur.
- **Paternalisme libertarien** (Thaler & Sunstein, 2008) : tout nudge est désactivable, aucune action n'est bloquée.

### 1.2 Objectifs du projet

**Objectif principal :** Améliorer les comportements de cyber-hygiène des utilisateurs par des micro-interventions contextuelles fondées sur des preuves scientifiques, dans le respect strict de leur vie privée.

**Objectifs secondaires :**

| # | Objectif | Indicateur de succès |
|---|----------|---------------------|
| O1 | Réduire la saisie de credentials sur des sites à risque | Taux de réponse positive au nudge M2 > 60 % |
| O2 | Améliorer la force des mots de passe créés | Score M9 : proportion de mots de passe forts > 70 % |
| O3 | Réduire la réutilisation de mots de passe | Nombre de réutilisations détectées (M7) en baisse semaine/semaine |
| O4 | Améliorer la résistance au phishing | Score quiz M6 > 80 % à 3 semaines d'usage |
| O5 | Maintenir le navigateur à jour | Délai entre disponibilité mise à jour et installation < 24h |
| O6 | Sensibiliser aux risques du copier-coller | Taux d'utilisation du bouton « Vider presse-papiers » (M17) > 40 % |
| O7 | Produire une mesure composite de la cyber-hygiène | Score M3 en progression hebdomadaire pour 70 % des utilisateurs |

Ces indicateurs sont mesurés localement et présentés dans le tableau de bord de l'utilisateur. Ils ne sont transmis à aucune partie tierce.

### 1.3 Périmètre

#### v1 — 7 modules (périmètre de ce document)

| # | Module | Priorité MoSCoW | Justification |
|---|--------|-----------------|---------------|
| M2 | Détection de saisie en contexte risqué | Must | Module le mieux validé empiriquement ; vecteur phishing principal |
| M3 | Score de cyber-hygiène hebdomadaire | Must | Colonne vertébrale ; agrège les métriques de tous les modules |
| M5 | Rappel de mise à jour navigateur | Must (remonté de Should) | Risque immédiat ; mise en oeuvre simple et effet mesuré |
| M6 | Mini-quiz phishing contextuel | Must | Seul mécanisme à effet durable >3 mois (Kumaraguru, 2007) |
| M7 | Nudge adoption gestionnaire de mots de passe | Should | Comportement à risque le plus répandu |
| M9 | Indicateur de force du mot de passe | Should | Complète M7 sur le cycle de création |
| M17 | Alerte au copier-coller de données sensibles | Should | Vecteur de fuite sous-estimé ; valeur différenciatrice élevée |

#### v2 (hors périmètre, à préparer)

M4 (Nudge téléchargements), M11 (Audit permissions sites), M13 (Détection liens raccourcis), M20 (Notifications abusives).

#### v2+ (non planifié)

M1, M8, M10, M12, M14, M15, M16, M19.

#### Exclusions définitives

M18 (Fatigue multi-onglets) : valeur sécurité insuffisante, risque d'irritation élevé sur flux de travail légitimes.

### 1.4 Parties prenantes

| Rôle | Personne | Responsabilités |
|------|----------|-----------------|
| Commanditaire / Product Owner | Antony (RSSI) | Vision produit, validation des livrables, arbitrages |
| Utilisateur cible | Tout utilisateur de Chrome | Utilisation quotidienne de l'extension |
| Communauté open-source | Contributeurs GitHub | Audit du code, contributions, signalements |
| Autorité de contrôle | CNIL (France) | Conformité RGPD |

**Profils utilisateurs (personas) :**

- **Débutant** : peu de connaissances en sécurité, utilise le même mot de passe sur plusieurs sites, ne met pas à jour son navigateur spontanément. Sensible aux nudges d'aversion à la perte, aux explications simples.
- **Intermédiaire** : conscient des risques, quelques bonnes pratiques déjà en place, peut avoir un gestionnaire de mots de passe. Sensible aux scores et à la progression.
- **Avancé** : bonnes pratiques déjà établies. Sensible aux détails techniques, à la transparence des mécanismes. Risque d'irritation si nudges trop basiques.

Le profil est auto-déclaré au premier lancement et conditionne la fréquence et la granularité des nudges.

---

## 2. Description fonctionnelle

### 2.1 Vue d'ensemble des 7 modules v1

| Module | Déclenchement | Type de nudge | Fréquence maximale |
|--------|--------------|---------------|-------------------|
| M2 | Saisie de credentials sur site HTTP ou domaine suspect | Toast / Overlay interstitiel | 1 par session par domaine |
| M3 | Hebdomadaire (lundi matin) | Badge popup + notification | 1 par semaine |
| M5 | Navigateur obsolète détecté | Toast non bloquant | 1 par période de 48h |
| M6 | Programmé en spaced repetition | Popup overlay | 1 par semaine (J0, J7, J21, J42, puis mensuel) |
| M7 | Saisie d'un mot de passe déjà connu (hash identique) | Toast | 1 par domaine tous les 30 jours |
| M9 | Saisie dans un champ de création de mot de passe | Overlay inline | Continu pendant la saisie |
| M17 | Événement paste détecté sur contenu sensible | Toast post-collage | 1 par collage de type sensible |

**Règle transversale — Quota journalier :** Le système ne peut afficher plus de 3 nudges actifs par jour, toutes catégories confondues (Anderson et al., 2016). La priorité est donnée aux nudges événementiels (M2, M7, M9, M17) sur les nudges programmés (M3, M5, M6).

---

### 2.2 Module M2 — Détection de saisie en contexte risqué

#### Description fonctionnelle

M2 détecte lorsqu'un utilisateur saisit un mot de passe dans un formulaire sur une page présentant des signaux de risque. Il affiche un nudge non bloquant au moment exact de la saisie (just-in-time). L'utilisateur peut ignorer le nudge, marquer le site comme de confiance, ou abandonner la saisie. L'action n'est jamais bloquée.

**Signaux de risque détectables localement (sans appel réseau) :**
1. Page servie en HTTP (non HTTPS)
2. Domaine non présent dans la HSTS preload list (liste statique embarquée dans l'extension)
3. Similarité typographique avec un domaine connu (typosquatting) — détection par algorithme de distance de Levenshtein sur une liste de domaines cibles à définir
4. Certificat TLS auto-signé (détectable via l'API `chrome.tabs` et les métadonnées de sécurité)

Un minimum de 2 signaux de risque sur 4 est requis pour déclencher le nudge, afin de limiter les faux positifs.

#### Données d'entrée

| Source | Donnée | Description |
|--------|--------|-------------|
| Chrome API `tabs` | URL courante | Schéma HTTP/HTTPS, domaine |
| DOM (content script) | Événement `focus` / `input` sur `<input type="password">` | Détection de la saisie de credentials |
| Stockage local | Liste des domaines de confiance marqués par l'utilisateur | Whitelist personnelle |
| Extension (bundle statique) | HSTS preload list partielle, liste de domaines cibles pour typosquatting | Données embarquées, jamais transmises |

#### Données de sortie

| Destination | Donnée | Description |
|-------------|--------|-------------|
| Stockage local (IndexedDB) | Événement de nudge : horodatage, domaine hashé, action utilisateur | Contribution au score M3 |
| Compteur de quota journalier | Incrémentation de 1 | Gestion du quota de 3 nudges/jour |

**Note RGPD :** Le domaine est stocké sous forme hachée (SHA-256 local). L'URL complète n'est jamais conservée.

#### Règles de déclenchement

```
SI focus sur <input type="password"> sur la page courante
ET la page courante cumule >= 2 signaux de risque parmi [HTTP, hors HSTS, typosquatting, cert auto-signé]
ET le domaine courant n'est pas dans la whitelist utilisateur
ET le quota journalier de nudges n'est pas atteint (< 3)
ALORS afficher le nudge M2
```

#### Maquette textuelle

**Nudge type : overlay interstitiel (non bloquant)**

```
┌──────────────────────────────────────────────────────────────┐
│  Sentinel Nudge                                    [X Fermer] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚠ Ce domaine présente des signaux inhabituels               │
│                                                              │
│  "example-login.net" n'est pas dans la liste des sites       │
│  de confiance connus et est servi sans HTTPS.                │
│                                                              │
│  Reconnais-tu ce service ?                                   │
│                                                              │
│  [Continuer quand même]   [Marquer comme de confiance]       │
│                           [Abandonner la saisie]             │
│                                                              │
│  [Pourquoi ce message ?]                                     │
└──────────────────────────────────────────────────────────────┘
```

- **[Continuer quand même]** : ferme le nudge, l'utilisateur continue. L'événement est enregistré localement.
- **[Marquer comme de confiance]** : ajoute le domaine à la whitelist, ferme le nudge. Ce domaine ne déclenchera plus M2.
- **[Abandonner la saisie]** : ferme le nudge et donne le focus à la barre d'adresse.
- **[Pourquoi ce message ?]** : ouvre une explication inline détaillant les signaux détectés et le mécanisme comportemental utilisé (transparence radicale).

Wording principal : interrogatif, non accusateur (Wash, 2010). La tonalité évite la culpabilisation pour prévenir la réactance psychologique.

#### Interactions avec les autres modules

| Module | Type d'interaction |
|--------|--------------------|
| M3 | Alimente le score : chaque nudge affiché + action utilisateur = métrique de comportement |
| M7 | Peut se déclencher simultanément (même formulaire). Le quota est partagé. |
| M9 | Ne se déclenche pas en même temps (M2 est prioritaire sur formulaire de connexion) |
| Système de quota | Consomme 1 unité sur 3 du quota journalier |

#### Critères d'acceptation

**CA-M2-01 — Déclenchement sur HTTP avec saisie**
```gherkin
Given l'utilisateur navigue sur une page HTTP (non HTTPS)
  And la page contient un champ <input type="password">
  And le domaine n'est pas dans la whitelist utilisateur
  And le quota journalier n'est pas atteint
When l'utilisateur place le focus dans le champ password
Then le nudge M2 s'affiche dans les 500ms
  And le nudge est non bloquant (l'utilisateur peut continuer à saisir)
```

**CA-M2-02 — Non-déclenchement sur domaine de confiance**
```gherkin
Given l'utilisateur a marqué "mybank.com" comme de confiance
When l'utilisateur saisit un mot de passe sur "mybank.com" en HTTPS
Then aucun nudge M2 ne s'affiche
```

**CA-M2-03 — Non-déclenchement si quota atteint**
```gherkin
Given le quota journalier est atteint (ex : 3 nudges par défaut)
When un événement M2 est détecté
Then le nudge M2 est affiché malgré le quota (exception événementiel critique)
  And un indicateur dans les paramètres notifie l'utilisateur du dépassement exceptionnel
```

**CA-M2-04 — Action "Marquer comme de confiance"**
```gherkin
Given le nudge M2 est affiché pour le domaine "example.net"
When l'utilisateur clique sur "Marquer comme de confiance"
Then le domaine "example.net" est ajouté à la whitelist locale
  And le nudge se ferme
  And aucun nudge M2 ne s'affiche sur ce domaine lors des navigations suivantes
```

**CA-M2-05 — Transparence radicale**
```gherkin
Given le nudge M2 est affiché
When l'utilisateur clique sur "Pourquoi ce message ?"
Then une explication s'affiche listant les signaux détectés (HTTP, typosquatting, etc.)
  And le mécanisme comportemental utilisé est décrit (just-in-time nudge, source : Sunshine et al. 2009)
```

**CA-M2-06 — Limitation à 1 nudge par domaine par session**
```gherkin
Given le nudge M2 a déjà été affiché pour "suspicious.net" durant la session courante
When l'utilisateur navigue à nouveau sur "suspicious.net" et saisit un mot de passe
Then aucun nouveau nudge M2 ne s'affiche pour ce domaine durant la même session
```

---

### 2.3 Module M3 — Score de cyber-hygiène hebdomadaire

#### Description fonctionnelle

M3 calcule et affiche un score composite de cyber-hygiène (0 à 100 points) basé sur les comportements détectés par l'ensemble des modules actifs. Ce score est présenté chaque semaine (lundi matin) dans la popup de l'extension et dans le tableau de bord. Il est accompagné d'une progression (delta semaine/semaine) et d'une action concrète recommandée.

Le score est calculé localement à partir des événements stockés en IndexedDB. Il n'est jamais transmis.

**Formule de calcul (transparente et affichable)** :

| Composante | Poids | Source | Calcul |
|------------|-------|--------|--------|
| Mises à jour navigateur | 20 pts | M5 | 20 pts si navigateur à jour, 0 sinon |
| Résistance phishing (quiz) | 25 pts | M6 | % bonnes réponses × 25 |
| Comportement sur sites risqués | 20 pts | M2 | 20 − (4 × nombre de saisies ignorées sur sites risqués cette semaine), plancher 0. Exemple : 0 saisie ignorée = 20/20 ; 3 saisies ignorées = 8/20 ; 5+ = 0/20 |
| Diversité des mots de passe | 20 pts | M7 | 20 − (4 × nombre de réutilisations détectées cette semaine), plancher 0. Exemple : 0 réutilisation = 20/20 ; 2 réutilisations = 12/20 ; 5+ = 0/20 |
| Force des mots de passe créés | 15 pts | M9 | Si aucun mot de passe créé cette semaine : 15/15 (100 %) avec indicateur 0/0 affiché. Sinon : (nombre de mots de passe forts créés / nombre total créés) × 15, avec indicateur X/Y affiché (ex : 3/5) |

Si un module est désactivé, son poids est redistribué proportionnellement entre les modules actifs.

#### Données d'entrée

| Source | Donnée |
|--------|--------|
| IndexedDB local | Événements M2 (nudges affichés + actions), M5 (état MAJ), M6 (résultats quiz), M7 (réutilisations détectées), M9 (évaluation force mdp) |
| Stockage local | Score de la semaine précédente (pour le calcul du delta) |

#### Données de sortie

| Destination | Donnée |
|-------------|--------|
| Popup extension | Score courant (0-100), delta (+/- N pts), action recommandée |
| Dashboard | Historique des scores (52 dernières semaines), graphique de progression |
| IndexedDB | Score calculé horodaté (conservation 1 an glissant) |

#### Règles de déclenchement

```
CHAQUE lundi matin à 09h00 (heure locale) :
SI l'extension est active et le navigateur ouvert
ALORS calculer le score hebdomadaire
  ET afficher un badge sur l'icône de l'extension
  ET préparer le résumé hebdomadaire disponible dans la popup

Si le navigateur est fermé à 09h00 :
  Le score est calculé au prochain démarrage du navigateur ce lundi
```

Le quiz M6 est également planifié via ce déclencheur selon le calendrier spaced repetition.

#### Maquette textuelle

**Popup hebdomadaire (accessible depuis l'icône de l'extension)**

```
┌────────────────────────────────────────────┐
│  Sentinel Nudge — Rapport du lundi         │
├────────────────────────────────────────────┤
│                                            │
│  Votre score de cyber-hygiène              │
│                                            │
│         ████████████░░░░  72 / 100         │
│                    ▲ +5 pts cette semaine  │
│                                            │
│  Détail :                                  │
│  ✓ Navigateur à jour          20/20        │
│  ◐ Résistance phishing        18/25        │
│  ✓ Comportements prudents     20/20        │
│  ✗ Diversité mots de passe     4/20        │
│  ◐ Force mots de passe        10/15        │
│                                            │
│  Action recommandée cette semaine :        │
│  → Diversifier vos mots de passe           │
│    [Voir comment faire en 1 clic]          │
│                                            │
│  [Voir l'historique]  [Paramètres]         │
└────────────────────────────────────────────┘
```

- Le score descend sous 50 : ton empathique, chemin de progression clair (pas de culpabilisation).
- La formule de calcul est accessible depuis un lien « Comment est calculé ce score ? ».

#### Interactions avec les autres modules

| Module | Type d'interaction |
|--------|--------------------|
| M2, M5, M6, M7, M9 | Fournisseurs de métriques — M3 est le consommateur unique |
| M17 | Non intégré dans le score v1 (valeur éducative, pas comportementale mesurable) |
| Système de quota | M3 consomme 1 unité du quota journalier (le lundi uniquement) |

#### Critères d'acceptation

**CA-M3-01 — Calcul hebdomadaire**
```gherkin
Given l'extension a collecté des événements durant la semaine écoulée
When le lundi à 09h00 (ou au premier démarrage du navigateur ce lundi)
Then le score est calculé selon la formule documentée
  And le score est affiché dans la popup et dans le dashboard
  And le delta par rapport à la semaine précédente est calculé et affiché
```

**CA-M3-02 — Redistribution de poids si module désactivé**
```gherkin
Given l'utilisateur a désactivé le module M6 (quiz phishing)
When le score hebdomadaire est calculé
Then les 25 points de M6 sont redistribués proportionnellement aux modules actifs
  And le score total reste exprimé sur 100
```

**CA-M3-03 — Formule transparente**
```gherkin
Given le score est affiché dans la popup
When l'utilisateur clique sur "Comment est calculé ce score ?"
Then la formule détaillée s'affiche avec le poids de chaque composante
  And les sources scientifiques sont mentionnées
```

**CA-M3-04 — Progression empathique pour faible score**
```gherkin
Given le score de l'utilisateur est inférieur à 50
When le rapport hebdomadaire s'affiche
Then aucun message culpabilisant n'est affiché
  And une action de progression concrète et atteignable est proposée
  And le message est formulé en termes de gain ("Tu pourrais gagner X points en...")
```

**CA-M3-05 — Conservation de l'historique**
```gherkin
Given l'utilisateur utilise l'extension depuis 8 semaines
When il accède au dashboard
Then les 8 scores hebdomadaires sont affichés sous forme de graphique
  And les données restent disponibles pendant 52 semaines glissantes
```

---

### 2.4 Module M5 — Rappel de mise à jour navigateur

#### Description fonctionnelle

M5 détecte si le navigateur Chrome utilisé est en retard de mise à jour par rapport à la version stable disponible. Il affiche un nudge non bloquant proposant la mise à jour en 1 clic. La détection repose sur l'API native `chrome.runtime.requestUpdateCheck()` qui interroge le mécanisme de mise à jour intégré de Chrome — ce n'est pas un appel réseau vers un tiers, c'est le canal natif de mise à jour du navigateur. Cela garantit que la détection est toujours à jour, indépendamment du rythme de publication de l'extension.

Contrainte : M5 ne déclenche pas de nudge si l'utilisateur est en plein écran (jeu, présentation, vidéo) ou si un formulaire est actif.

#### Données d'entrée

| Source | Donnée |
|--------|--------|
| `chrome.runtime.requestUpdateCheck()` | Statut de mise à jour du navigateur (update_available / no_update / throttled) |
| `navigator.userAgent` ou `navigator.userAgentData` | Version courante du navigateur |
| Stockage local | Date du dernier nudge M5 affiché |

**Note :** `chrome.runtime.requestUpdateCheck()` utilise le canal de mise à jour natif de Chrome. Ce n'est pas un appel réseau vers un serveur tiers — c'est le mécanisme intégré que Chrome utilise déjà pour ses propres mises à jour. Cela garantit une détection fiable et toujours à jour, sans dépendre du rythme de publication de l'extension.

#### Données de sortie

| Destination | Donnée |
|-------------|--------|
| IndexedDB local | Événement M5 : horodatage, version détectée, action utilisateur |
| M3 | Alimentation de la composante "Mises à jour navigateur" (20 pts) |

#### Règles de déclenchement

```
AU DÉMARRAGE du navigateur :
Appeler chrome.runtime.requestUpdateCheck()
SI le résultat indique une mise à jour disponible (update_available)
ET dernier nudge M5 > 48h (délai de grâce)
ET aucun formulaire actif sur l'onglet courant
ET le navigateur n'est pas en mode plein écran
ET le quota journalier n'est pas atteint
ALORS afficher le nudge M5
```

Le délai de 48h évite la fatigue de répétition (Anderson et al., 2016). L'utilisateur peut également choisir "Me rappeler dans 4 heures".

#### Maquette textuelle

**Nudge type : toast non bloquant (coin supérieur droit)**

```
┌─────────────────────────────────────────────┐
│  Sentinel Nudge                    [X]       │
│  ─────────────────────────────────────────  │
│  Votre navigateur n'est pas à jour           │
│  Version actuelle : 122.0.6261.57            │
│  Version sécurisée : 124.0.6367.79           │
│                                              │
│  Les mises à jour corrigent des failles      │
│  de sécurité actives.                        │
│                                              │
│  [Mettre à jour maintenant]                  │
│  [Me rappeler dans 4 heures]                 │
│  [Pourquoi c'est important ?]                │
└─────────────────────────────────────────────┘
```

- **[Mettre à jour maintenant]** : ouvre `chrome://settings/help` en nouvel onglet (page native de MAJ Chrome).
- **[Me rappeler dans 4 heures]** : reporte le délai de grâce à 4h.
- **[Pourquoi c'est important ?]** : explique le mécanisme (failles de sécurité corrigées, source : Beautement et al., 2016).

#### Interactions avec les autres modules

| Module | Type d'interaction |
|--------|--------------------|
| M3 | Alimente la composante "Mises à jour" (20 pts) |
| Système de quota | Consomme 1 unité sur 3 du quota journalier |

#### Critères d'acceptation

**CA-M5-01 — Déclenchement sur navigateur obsolète**
```gherkin
Given chrome.runtime.requestUpdateCheck() retourne "update_available"
  And le dernier nudge M5 a été affiché il y a plus de 48h
  And le quota journalier n'est pas atteint
When le navigateur démarre
Then le toast M5 s'affiche dans les 5 secondes suivant l'ouverture du premier onglet
```

**CA-M5-02 — Non-déclenchement en plein écran**
```gherkin
Given le navigateur est en mode plein écran (F11 ou vidéo plein écran)
When un événement M5 est détecté
Then aucun nudge M5 ne s'affiche
  And le nudge est reporté au retour au mode normal
```

**CA-M5-03 — Délai de grâce "Me rappeler dans 4 heures"**
```gherkin
Given le nudge M5 est affiché
When l'utilisateur clique sur "Me rappeler dans 4 heures"
Then aucun nudge M5 ne s'affiche pendant les 4 heures suivantes
  And le nudge se représente après ce délai si le navigateur est toujours obsolète
```

**CA-M5-04 — Non-déclenchement si navigateur à jour**
```gherkin
Given chrome.runtime.requestUpdateCheck() retourne "no_update"
When le navigateur démarre
Then aucun nudge M5 ne s'affiche
  And la composante "Mises à jour" dans M3 est créditée de 20/20
```

---

### 2.5 Module M6 — Mini-quiz phishing contextuel

#### Description fonctionnelle

M6 propose des mini-quiz de simulation de phishing selon un calendrier de répétition espacée (spaced repetition). C'est le module au meilleur ratio coût/efficacité à long terme : Kumaraguru et al. (2007) montrent une réduction du taux de clic de phishing de 37 % à 7 % en 1 mois, maintenue à 11 % à 3 mois. Lain et al. (2022) confirment que 4 à 6 répétitions sur 3 mois produisent la réduction maximale.

Chaque quiz présente un exemple visuel (capture d'écran ou description textuelle) d'email ou de page web avec des éléments de phishing, et demande à l'utilisateur d'identifier les signaux suspects. Le feedback après réponse est le composant le plus important pédagogiquement.

**Calendrier spaced repetition :**
- J0 : quiz d'introduction (calibration du niveau)
- J7 : quiz 1
- J21 : quiz 2
- J42 : quiz 3
- J70 : quiz 4
- Puis mensuel jusqu'à désactivation par l'utilisateur

**Corpus minimum en v1 :** 50 exemples, catégorisés par technique (urgence, autorité, gain, menace). Difficulté adaptative selon le profil auto-déclaré et le score des quiz précédents. Le corpus est produit en phase P4 par l'Analyste métier, validé par le Commanditaire, et stocké sous forme de fichiers JSON embarqués dans le bundle (`src/data/quiz-corpus-fr.json` + `quiz-corpus-en.json`). La structure d'un exemple (format, champs, niveaux, catégories) est définie en phase P3.

#### Données d'entrée

| Source | Donnée |
|--------|--------|
| Extension (bundle statique) | Corpus de quiz (exemples visuels / textuels, réponses, explications) |
| Stockage local | Historique des quiz passés, scores, date du prochain quiz planifié |
| Profil utilisateur | Niveau déclaré (Débutant/Intermédiaire/Avancé) pour la sélection de difficulté |

**Note :** Le corpus de quiz est entièrement embarqué dans l'extension. Aucun contenu n'est téléchargé.

#### Données de sortie

| Destination | Donnée |
|-------------|--------|
| IndexedDB local | Résultat du quiz : date, score (% bonnes réponses), catégories échouées |
| M3 | Composante "Résistance phishing" (25 pts) |

#### Règles de déclenchement

```
SELON le calendrier spaced repetition basé sur la date d'installation :
  SI la date planifiée est atteinte
  ET le quota journalier n'est pas atteint
  ET l'utilisateur n'est pas en train de saisir dans un formulaire
  ALORS afficher la notification de disponibilité du quiz

L'utilisateur peut lancer le quiz depuis :
- La notification programmée (popup sur l'icône)
- Le tableau de bord (accès volontaire à tout moment)
```

Le quiz n'est jamais interstitiel forcé. Il est toujours initié sur action de l'utilisateur (la notification l'invite, mais ne force pas).

#### Maquette textuelle

**Notification de disponibilité (toast)**

```
┌────────────────────────────────────────────┐
│  Sentinel Nudge                    [X]     │
│  ──────────────────────────────────────    │
│  Votre quiz phishing de la semaine         │
│  est disponible (3 questions, ~2 min)      │
│                                            │
│  [Commencer maintenant]  [Plus tard]       │
└────────────────────────────────────────────┘
```

**Interface de quiz (popup en overlay)**

```
┌────────────────────────────────────────────────────────────┐
│  Quiz phishing — Question 2/3               [X Quitter]    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Cet email provient de "support@paypa1.com".               │
│  Il vous demande de cliquer ici pour vérifier              │
│  votre compte sous 24 heures.                              │
│                                                            │
│  [Montrer l'email complet]                                 │
│                                                            │
│  Ce message est-il suspect ?                               │
│                                                            │
│  ( ) Oui, c'est du phishing                                │
│  ( ) Non, il semble légitime                               │
│  ( ) Je ne sais pas                                        │
│                                                            │
│  [Valider]                                                 │
└────────────────────────────────────────────────────────────┘
```

**Feedback après réponse (composant le plus important)**

```
┌────────────────────────────────────────────────────────────┐
│  ✓ Bonne réponse !                                         │
│                                                            │
│  Indices qui devaient alerter :                            │
│  • "paypa1.com" — le "l" est remplacé par un "1"           │
│    (typosquatting / usurpation de marque)                  │
│  • Urgence artificielle : "sous 24 heures"                 │
│    Technique d'urgence = signal fiable de phishing         │
│  • PayPal ne demande jamais de vérification par email      │
│                                                            │
│  [Question suivante]                                       │
└────────────────────────────────────────────────────────────┘
```

#### Interactions avec les autres modules

| Module | Type d'interaction |
|--------|--------------------|
| M3 | Alimente la composante "Résistance phishing" |
| M2 | Synergique : M2 agit en prévention directe, M6 en éducation (effet dose-réponse complémentaire) |
| Système de quota | La notification consomme 1 unité ; le quiz lui-même ne consomme pas de quota (initié par l'utilisateur) |

#### Critères d'acceptation

**CA-M6-01 — Calendrier spaced repetition**
```gherkin
Given l'utilisateur a installé l'extension à la date J0
When la date J7 est atteinte
Then une notification de disponibilité du quiz s'affiche au démarrage du navigateur
  And le quiz est accessible depuis le tableau de bord
```

**CA-M6-02 — Feedback systématique**
```gherkin
Given l'utilisateur a répondu à une question du quiz
When la réponse est validée (correcte ou incorrecte)
Then un feedback détaillé s'affiche immédiatement
  And le feedback explique les signaux de phishing présents dans l'exemple
  And le feedback est affiché même si la réponse est correcte
```

**CA-M6-03 — Difficulté adaptative**
```gherkin
Given l'utilisateur a un profil déclaré "Débutant"
When le quiz est généré
Then les exemples sélectionnés sont de niveau Basique ou Intermédiaire
  And les exemples de niveau Expert sont exclus

Given l'utilisateur a obtenu 100% aux 2 derniers quiz
When le quiz suivant est généré
Then la difficulté est augmentée d'un niveau
```

**CA-M6-04 — Accès volontaire au quiz**
```gherkin
Given le quiz programmé est disponible
When l'utilisateur clique sur "Plus tard" dans la notification
Then aucun quiz n'est affiché de force
  And le quiz reste accessible depuis le tableau de bord pendant 7 jours
```

**CA-M6-05 — Non-déclenchement pendant saisie active**
```gherkin
Given l'utilisateur est en train de saisir dans un formulaire
When l'heure planifiée du quiz est atteinte
Then la notification est retardée jusqu'à la fin de la saisie active
```

---

### 2.6 Module M7 — Nudge d'adoption gestionnaire de mots de passe

#### Description fonctionnelle

M7 détecte la réutilisation de mots de passe sur plusieurs domaines. La détection repose sur le hachage local (SHA-256) de la valeur du mot de passe au moment de la saisie dans un formulaire de connexion. Ce hash est comparé aux hash précédemment stockés. Aucun mot de passe en clair n'est jamais stocké.

En cas de réutilisation détectée, M7 affiche un nudge proposant des informations sur les gestionnaires de mots de passe. Le nudge met en avant que le gestionnaire décharge l'utilisateur de mémoriser ses mots de passe — premier frein à l'adoption identifié dans la littérature. Il cite uniquement des projets open source (KeePass, KeePassXC, Bitwarden, Vaultwarden) via une page d'explication dédiée, accompagnée d'un disclaimer : "Sentinel Nudge n'est affilié à aucun de ces projets."

**Contrainte RGPD explicite :** Le traitement de hash de mots de passe constitue un traitement de données personnelles au sens du RGPD, même en local. Ce traitement est documenté dans la politique de confidentialité avec les mentions suivantes : traitement strictement local, aucune transmission, durée de conservation définie (90 jours glissants par défaut, configurable).

#### Données d'entrée

| Source | Donnée |
|--------|--------|
| DOM (content script) | Valeur du champ `<input type="password">` au moment du `submit` |
| IndexedDB local | Hash (SHA-256) des mots de passe précédemment saisis (sans le domaine en clair) |
| Stockage local | Date du dernier nudge M7 par domaine |

**Sécurité du hash :** SHA-256 sans sel = vulnérable aux attaques par dictionnaire si compromis. L'implémentation v1 devra être revue par l'architecte sécurité pour l'ajout d'un sel local dérivé d'un identifiant de l'installation.

#### Données de sortie

| Destination | Donnée |
|-------------|--------|
| IndexedDB local | Hash du mot de passe, horodatage de la saisie (sans domaine en clair) |
| M3 | Composante "Diversité mots de passe" |
| Compteur de quota | Incrémentation de 1 si nudge affiché |

#### Règles de déclenchement

```
À chaque soumission d'un formulaire contenant <input type="password"> :
  Calculer SHA-256(valeur_saisie)
  SI ce hash existe déjà dans le store local
  ET ce domaine n'a pas reçu de nudge M7 depuis 30 jours
  ET le quota journalier n'est pas atteint
  ALORS afficher le nudge M7

Stocker le hash dans tous les cas (même sans nudge).
Ne stocker que les N=100 derniers hash (FIFO, limite de volumétrie).
```

#### Maquette textuelle

**Nudge type : toast (coin supérieur droit)**

```
┌────────────────────────────────────────────────┐
│  Sentinel Nudge                        [X]     │
│  ──────────────────────────────────────────    │
│  Mot de passe déjà utilisé détecté             │
│                                                │
│  Ce mot de passe est utilisé sur d'autres      │
│  sites. Si l'un d'eux est compromis, tous      │
│  vos comptes sont en danger.                   │
│                                                │
│  Un gestionnaire de mots de passe génère       │
│  un mot de passe unique pour chaque site       │
│  — et les retient pour vous.                   │
│                                                │
│  [Voir comment ça marche]  [OK, compris]       │
│                                                │
│  [Ne plus afficher pour ce site]               │
└────────────────────────────────────────────────┘
```

- **[Voir comment ça marche]** : ouvre une page d'explication statique intégrée à l'extension sur les gestionnaires de mots de passe open source (KeePass, KeePassXC, Bitwarden, Vaultwarden). Un disclaimer explicite précise : "Sentinel Nudge n'est affilié à aucun de ces projets."
- **[OK, compris]** : ferme le toast.
- **[Ne plus afficher pour ce site]** : ajoute le domaine à une liste de suppression locale (sans supprimer les hash).

#### Interactions avec les autres modules

| Module | Type d'interaction |
|--------|--------------------|
| M3 | Alimente la composante "Diversité mots de passe" |
| M9 | Complémentaire : M7 = réutilisation à la connexion, M9 = force à la création. Peuvent se déclencher le même jour (quota partagé) |
| M2 | Peut co-exister sur le même formulaire (M2 prioritaire, M7 en toast non bloquant) |

#### Critères d'acceptation

**CA-M7-01 — Détection de réutilisation**
```gherkin
Given l'utilisateur a soumis un formulaire de connexion avec le mot de passe "P@ssw0rd" sur "site-a.com"
When l'utilisateur soumet un formulaire de connexion avec le même mot de passe "P@ssw0rd" sur "site-b.com"
Then un nudge M7 s'affiche
  And le nudge ne mentionne pas les domaines concernés
  And aucun mot de passe en clair n'est accessible depuis l'interface
```

**CA-M7-02 — Limitation à 1 nudge par domaine par 30 jours**
```gherkin
Given un nudge M7 a été affiché pour "site-b.com" il y a 15 jours
When une réutilisation de mot de passe est détectée sur "site-b.com"
Then aucun nudge M7 ne s'affiche pour ce domaine
```

**CA-M7-03 — Aucun stockage en clair**
```gherkin
Given l'utilisateur saisit le mot de passe "Secret123"
When la soumission du formulaire est interceptée par M7
Then seul le hash SHA-256 de "Secret123" est stocké en IndexedDB
  And la valeur en clair n'est jamais accessible depuis l'extension
  And la valeur en clair n'est jamais écrite dans le stockage local
```

**CA-M7-04 — Option de suppression par domaine**
```gherkin
Given le nudge M7 est affiché pour le domaine courant
When l'utilisateur clique sur "Ne plus afficher pour ce site"
Then ce domaine est ajouté à la liste de suppression locale M7
  And aucun nudge M7 ne s'affichera plus pour ce domaine
```

---

### 2.7 Module M9 — Indicateur de force du mot de passe

#### Description fonctionnelle

M9 affiche un indicateur visuel de force du mot de passe en temps réel lors de la saisie dans un champ de **création** de mot de passe. Il fournit également une suggestion textuelle courte pour améliorer la force si elle est insuffisante. M9 détecte la présence d'un gestionnaire de mots de passe actif et masque l'overlay dans ce cas pour éviter les conflits visuels.

M9 ne s'active que sur les champs de création (formulaire d'inscription) et non sur les formulaires de connexion (où M2 et M7 sont prioritaires).

**Critères de force (algorithme zxcvbn ou équivalent local, alignés sur les recommandations ANSSI) :**
- Très faible : longueur < 8 ou pattern trivial (123456, password) — **Déconseillé par l'ANSSI** (indicateur rouge + icône avertissement)
- Faible : longueur 8-11, caractères basiques — **Déconseillé par l'ANSSI** (indicateur rouge + icône avertissement)
- Moyen : longueur 12+, mix lettres/chiffres — **Acceptable sous conditions** (indicateur jaune)
- Fort : longueur 12+, mix lettres/chiffres/symboles, pas de pattern — **Recommandé** (indicateur vert clair)
- Très fort : longueur 16+, entropie élevée — **Recommandé** (indicateur vert foncé)

La page d'explication de M9 (cf. 2.9.7) cite explicitement les recommandations de l'ANSSI (Guide des mots de passe, 2021) et la distinction entre niveaux acceptables et déconseillés.

#### Données d'entrée

| Source | Donnée |
|--------|--------|
| DOM (content script) | Valeur en temps réel du champ `<input type="password">` sur formulaire d'inscription |
| DOM | Présence d'un champ de confirmation de mot de passe (signal de création) |
| DOM | Présence d'attributs typiques d'un gestionnaire de mots de passe (`data-form-type`, remplissage automatique) |

#### Données de sortie

| Destination | Donnée |
|-------------|--------|
| DOM (inline overlay) | Barre colorée + label textuel de force + suggestion |
| IndexedDB local | Évaluation de force au moment de la soumission (pour M3) |
| M3 | Composante "Force mots de passe créés" |

**Aucune valeur de mot de passe n'est stockée.** Seul le niveau de force (1-5) est enregistré.

#### Règles de déclenchement

```
SI focus sur <input type="password">
ET présence d'un champ de confirmation sur la même page (signal de création)
ET aucun gestionnaire de mots de passe n'est détecté comme actif sur ce champ
ALORS afficher l'overlay de force en temps réel
  ET mettre à jour l'overlay à chaque frappe
```

La détection du gestionnaire de mots de passe repose sur la vérification de l'attribut `autocomplete="new-password"` géré par le gestionnaire, ou de l'attribut `data-form-type` injecté par certains gestionnaires.

M9 ne bloque jamais la soumission, même si le mot de passe est évalué comme faible.

#### Maquette textuelle

**Overlay inline (sous le champ de saisie)**

```
┌──────────────────────────────────────────────────┐
│  Mot de passe : [●●●●●●●●         ]              │
│                                                  │
│  Force :  [████████░░░░░░░]  Moyen               │
│                                                  │
│  + Ajoute 1 caractère spécial (@, #, !, ...)     │
│    pour passer à "Fort"                          │
│                                                  │
│  [?] Pourquoi la force du mot de passe compte ?  │
└──────────────────────────────────────────────────┘
```

Couleurs : rouge (Très faible), rouge (Faible), jaune (Moyen), vert clair (Fort), vert foncé (Très fort).
Pour les niveaux Très faible et Faible, un marqueur "Déconseillé par l'ANSSI" est affiché à côté du label de force.
Pour les niveaux Fort et Très fort, un marqueur "Recommandé" est affiché.

- **[?] Pourquoi...** : lien vers la page d'explication statique de M9 (cf. 2.9.7), incluant l'entropie, les risques, et les recommandations ANSSI.

#### Interactions avec les autres modules

| Module | Type d'interaction |
|--------|--------------------|
| M3 | Alimente la composante "Force mots de passe créés" |
| M7 | Complémentaire : M9 agit à la création, M7 agit à la connexion. Non redondants |
| M2 | M9 ne s'active pas sur les formulaires de connexion (domaine de M2 et M7) |

#### Critères d'acceptation

**CA-M9-01 — Activation uniquement sur formulaire de création**
```gherkin
Given une page contient un champ <input type="password"> sans champ de confirmation
When l'utilisateur place le focus dans ce champ
Then l'overlay M9 ne s'affiche pas (formulaire de connexion)

Given une page contient un champ <input type="password"> ET un champ de confirmation
When l'utilisateur place le focus dans le premier champ password
Then l'overlay M9 s'affiche
```

**CA-M9-02 — Mise à jour en temps réel**
```gherkin
Given l'overlay M9 est affiché sur un formulaire de création
When l'utilisateur saisit ou supprime un caractère
Then la barre de force et le label sont mis à jour dans les 100ms
  And la suggestion textuelle est mise à jour en conséquence
```

**CA-M9-03 — Masquage si gestionnaire de mots de passe actif**
```gherkin
Given un gestionnaire de mots de passe a rempli le champ automatiquement
When M9 détecte ce remplissage automatique
Then l'overlay M9 ne s'affiche pas
```

**CA-M9-04 — Non-blocage de la soumission**
```gherkin
Given l'overlay M9 indique un mot de passe "Très faible"
When l'utilisateur soumet le formulaire
Then le formulaire est soumis normalement sans blocage
  And le niveau de force (Très faible) est enregistré localement pour M3
```

**CA-M9-05 — Score 100 % si aucun mot de passe créé**
```gherkin
Given aucun mot de passe n'a été créé cette semaine
When le score M3 est calculé
Then la composante "Force des mots de passe créés" vaut 15/15 (100 %)
  And l'indicateur affiché est "0/0" dans le détail du score
```

**CA-M9-06 — Indicateur X/Y affiché**
```gherkin
Given l'utilisateur a créé 5 mots de passe cette semaine dont 3 évalués "Fort" ou "Très fort"
When le score M3 est calculé
Then la composante "Force des mots de passe créés" vaut (3/5) × 15 = 9/15
  And l'indicateur affiché est "3/5" dans le détail du score
```

**CA-M9-07 — Aucun stockage du mot de passe**
```gherkin
Given l'utilisateur a saisi "MonMotDePasse123" dans un champ de création
When le formulaire est soumis
Then seul le niveau de force (ex : 3 = "Fort") est stocké en IndexedDB
  And la valeur "MonMotDePasse123" n'est jamais écrite dans aucun stockage
```

---

### 2.8 Module M17 — Alerte au copier-coller de données sensibles

#### Description fonctionnelle

M17 détecte quand l'utilisateur colle (événement `paste`) du contenu dans un champ de formulaire et que ce contenu correspond à un pattern de donnée sensible (numéro de carte bancaire Luhn-validé, IBAN, clé API). Il affiche un nudge post-collage non bloquant rappelant le risque du presse-papiers et proposant de le vider.

**Principe fondamental :** M17 n'accède jamais au presse-papiers de manière proactive. Il intercepte uniquement l'événement DOM `paste`, qui contient la valeur au moment du collage. La valeur n'est pas stockée. Le traitement se fait en mémoire vive uniquement, le temps de la vérification du pattern.

La politique de confidentialité de l'extension mentionne explicitement : « Sentinel Nudge n'accède pas à votre presse-papiers. Il détecte uniquement le format de la donnée au moment du collage dans un formulaire. »

**Patterns détectés en v1 :**

| Type | Algorithme de détection | Précision |
|------|------------------------|-----------|
| Numéro de carte bancaire | Regex 13-19 chiffres + validation algorithme de Luhn | Haute |
| IBAN | Regex `[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}` + vérification modulo 97 | Haute |
| Clé API générique | Regex 32+ caractères alphanumériques avec séquences aléatoires (entropie élevée) | Moyenne |

#### Données d'entrée

| Source | Donnée |
|--------|--------|
| DOM (content script) | Événement `paste` + valeur collée (`event.clipboardData.getData('text')`) |
| (Aucun stockage lu) | M17 ne consulte aucune donnée stockée pour fonctionner |

#### Données de sortie

| Destination | Donnée |
|-------------|--------|
| Utilisateur | Toast de notification avec type de données détecté et bouton "Vider le presse-papiers" |
| IndexedDB local | Événement de détection : horodatage, type de donnée (pas la valeur), action utilisateur |

**Aucune valeur de donnée sensible n'est stockée.** Seul le type (carte / IBAN / clé API) est enregistré.

#### Règles de déclenchement

```
SUR événement DOM `paste` dans tout <input> ou <textarea>
  Récupérer la valeur collée depuis event.clipboardData
  Appliquer les patterns de détection en mémoire
  Si un pattern sensible correspond :
    ET le quota journalier n'est pas atteint
    ALORS afficher le nudge M17 (toast post-collage)
  Dans tous les cas : ne pas stocker la valeur collée
```

#### Maquette textuelle

**Nudge type : toast (coin supérieur droit, après le collage)**

```
┌────────────────────────────────────────────────┐
│  Sentinel Nudge                        [X]     │
│  ──────────────────────────────────────────    │
│  Données sensibles dans le presse-papiers      │
│                                                │
│  Un numéro de carte bancaire vient d'être      │
│  collé. Votre presse-papiers le contient       │
│  encore — d'autres applications peuvent        │
│  y accéder.                                    │
│                                                │
│  [Vider le presse-papiers]  [OK, merci]        │
│                                                │
│  [En savoir plus sur ce risque]                │
└────────────────────────────────────────────────┘
```

- **[Vider le presse-papiers]** : exécute `navigator.clipboard.writeText('')` pour effacer le presse-papiers.
- **[OK, merci]** : ferme le toast. Le presse-papiers n'est pas modifié.
- **[En savoir plus sur ce risque]** : page statique expliquant le risque du presse-papiers partagé entre applications.

#### Interactions avec les autres modules

| Module | Type d'interaction |
|--------|--------------------|
| M3 | Non intégré dans le score v1 (éducatif) — à reconsidérer en v2 |
| Système de quota | Consomme 1 unité sur 3 du quota journalier |

#### Critères d'acceptation

**CA-M17-01 — Détection d'un numéro de carte bancaire valide**
```gherkin
Given l'utilisateur a copié le numéro "4111 1111 1111 1111" (carte test Visa, Luhn valide)
When il colle cette valeur dans un champ de formulaire
Then le nudge M17 s'affiche avec la mention "numéro de carte bancaire"
  And la valeur collée n'est pas stockée
  And le collage n'est pas bloqué (la valeur apparaît bien dans le champ)
```

**CA-M17-02 — Non-détection d'un numéro de commande**
```gherkin
Given l'utilisateur colle le numéro de commande "12345678901234" (14 chiffres)
  And ce numéro échoue à la validation de Luhn
When le collage est intercepté
Then aucun nudge M17 ne s'affiche
```

**CA-M17-03 — Vidage du presse-papiers**
```gherkin
Given le nudge M17 est affiché
When l'utilisateur clique sur "Vider le presse-papiers"
Then navigator.clipboard.writeText('') est exécuté
  And le presse-papiers est vide après cette action
  And le toast se ferme
```

**CA-M17-04 — Accès proactif impossible**
```gherkin
Given l'extension Sentinel Nudge est installée et active
When aucun événement paste n'a eu lieu sur la page courante
Then l'extension n'accède à aucun moment au contenu du presse-papiers
```

---

### 2.9 Composants transversaux

#### 2.9.1 Système de quota journalier

**Règle :** Maximum 3 nudges actifs par jour toutes catégories confondues (défaut). Au-delà de ce seuil, l'extension cesse d'envoyer de nouveaux avertissements. La compliance chute exponentiellement au-delà de 3 nudges/jour (Anderson et al., 2016).

**Quota configurable :** L'utilisateur peut augmenter le quota dans les paramètres :
- **3** (défaut, recommandé par la recherche)
- **5** (pour les utilisateurs souhaitant plus de nudges)
- **10** (pour un suivi renforcé)
- **Tous** (illimité — un avertissement s'affiche : "Un nombre élevé de nudges peut provoquer une fatigue d'alerte et réduire votre attention aux avertissements importants.")

Le quota ne peut pas être réduit en deçà de 3. Le seuil de 3 est le plafond recommandé par la littérature scientifique ; descendre en dessous priverait l'utilisateur de nudges potentiellement importants sans bénéfice démontré.

**Compteur :**
- Réinitialisé chaque jour à minuit (heure locale)
- Stocké en `chrome.storage.local` (persistant, accès synchrone)
- Incrémenté de 1 à chaque affichage d'un nudge (toast, overlay, popup)

**Comportement au-delà du quota :** Lorsque le quota est atteint, un message discret est ajouté au badge de l'extension : "Quota du jour atteint — paramètres pour ajuster". Les événements sont toujours enregistrés localement pour le score M3, même sans nudge affiché.

**Priorités (en cas de compétition entre modules) :**
1. Événementiel critique : M2 (contexte risqué immédiat), M17 (donnée sensible en cours de collage)
2. Événementiel standard : M7 (réutilisation), M9 (force)
3. Programmé ponctuel : M5 (MAJ navigateur)
4. Programmé hebdomadaire : M3 (score), M6 (quiz — notification uniquement)

En cas de quota atteint, les nudges de priorité inférieure sont différés au lendemain. Les nudges événementiels critiques (M2, M17) sont affichés même en dépassement de quota si la situation le justifie — cette exception est configurable et désactivable par l'utilisateur.

**Critères d'acceptation du quota :**

```gherkin
Given le quota journalier est atteint (ex : 3/3)
When un événement M5 (programmé ponctuel) est détecté
Then le nudge M5 n'est pas affiché
  And il est planifié pour le lendemain
  And l'événement est enregistré localement pour le score M3

Given le quota journalier est atteint
When un événement M2 (événementiel critique) est détecté
Then le nudge M2 est affiché (exception au quota)
  And un indicateur dans les paramètres notifie l'utilisateur que le quota a été dépassé exceptionnellement

Given le quota journalier est atteint
Then le badge de l'extension affiche le message "Quota du jour atteint"
  And un lien vers les paramètres permet à l'utilisateur d'augmenter le quota

Given l'utilisateur modifie le quota à "Tous" dans les paramètres
Then un avertissement s'affiche expliquant le risque de fatigue d'alerte
  And si confirmé, tous les nudges sont affichés sans limitation
  And le quota est modifiable à tout moment depuis les paramètres
```

#### 2.9.2 Stockage local

**Technologie :** IndexedDB (données volumineuses, structurées) + `chrome.storage.local` (configuration, compteurs légers).

**Schéma IndexedDB — stores principaux :**

| Store | Clé | Champs | Durée de conservation |
|-------|-----|--------|-----------------------|
| `events` | `id` auto-incrémenté | `module`, `timestamp`, `type`, `action_user`, `domain_hash` | 90 jours glissants |
| `password_hashes` | `hash` SHA-256 | `hash`, `timestamp` | 90 jours glissants (FIFO max 100) |
| `scores` | `week_id` (YYYY-Www) | `week_id`, `score`, `composantes` | 52 semaines glissantes |
| `quiz_history` | `id` auto-incrémenté | `timestamp`, `score_pct`, `categories_failed`, `next_quiz_date` | Illimité |
| `whitelist` | `domain_hash` | `domain_hash`, `timestamp_added`, `module` | Illimité (gestion manuelle) |

**Chiffrement :** Les stores `events` et `password_hashes` sont chiffrés avec Web Crypto API (AES-256-GCM). La clé de chiffrement est dérivée d'un secret généré à l'installation (`crypto.getRandomValues`) et stocké dans `chrome.storage.local`. Si `chrome.storage.local` est effacé, les données IndexedDB chiffrées deviennent inaccessibles (invalidation par conception).

```gherkin
Given l'extension est installée pour la première fois
Then une clé AES-256-GCM est générée aléatoirement et stockée dans chrome.storage.local
  And tous les stores IndexedDB sensibles sont chiffrés avec cette clé

Given l'utilisateur efface les données de l'extension depuis chrome://settings
Then la clé de chiffrement est détruite
  And les données IndexedDB deviennent cryptographiquement inaccessibles
```

#### 2.9.3 Onboarding — Premier lancement

Le premier lancement déclenche un wizard en 4 étapes. L'onboarding est obligatoire avant tout affichage de nudge.

**Étape 1 — Bienvenue et philosophie**
```
┌────────────────────────────────────────────────────────────┐
│  Bienvenue dans Sentinel Nudge                             │
│                                                            │
│  Cette extension améliore vos habitudes de sécurité par    │
│  de petites interventions au bon moment — les "nudges".    │
│                                                            │
│  Tout se passe ici, sur votre ordinateur.                  │
│  Aucune donnée n'est envoyée nulle part.                   │
│                                                            │
│  [Suivant →]                                               │
└────────────────────────────────────────────────────────────┘
```

**Étape 2 — Profil auto-déclaré**
```
┌────────────────────────────────────────────────────────────┐
│  Quel est votre profil de sécurité ?                       │
│                                                            │
│  ( ) Débutant    — Je découvre les bonnes pratiques        │
│  ( ) Intermédiaire — J'ai déjà quelques habitudes          │
│  ( ) Avancé     — Je connais bien les risques              │
│                                                            │
│  Ce choix adapte la fréquence et le niveau des nudges.     │
│  Vous pouvez le modifier à tout moment dans les paramètres.│
│                                                            │
│  [← Retour]  [Suivant →]                                   │
└────────────────────────────────────────────────────────────┘
```

**Étape 3 — Présentation des modules et consentement**

Liste des 7 modules avec une case à cocher pour chacun (tous activés par défaut).

```
┌────────────────────────────────────────────────────────────┐
│  Choisissez vos protections                                │
│                                                            │
│  [✓] 🛡 Protection contre les sites suspects               │
│  [✓] 📊 Score de cyber-hygiène                             │
│  [✓] 🔄 Rappel de mise à jour                              │
│  [✓] 🎯 Entraînement anti-phishing                         │
│  [✓] 🔑 Détection de mots de passe réutilisés              │
│  [✓] 💪 Indicateur de force du mot de passe                 │
│  [✓] 📋 Protection du presse-papiers                       │
│                                                            │
│  Vous pouvez modifier ces choix à tout moment.             │
│                                                            │
│  [← Retour]  [Confirmer et démarrer →]                     │
└────────────────────────────────────────────────────────────┘
```

**Étape 4 — Politique de confidentialité**

Présentation simplifiée (plain language) de la politique de confidentialité, avec lien vers la version complète. Consentement explicite requis pour M7 (traitement de hash de mots de passe).

```gherkin
Given c'est le premier lancement de l'extension
Then l'onboarding en 4 étapes s'affiche avant tout autre élément
  And aucun nudge n'est déclenché avant la fin de l'onboarding
  And les choix de modules de l'étape 3 sont enregistrés immédiatement
  And le profil de l'étape 2 est enregistré en stockage local
```

#### 2.9.4 Page de paramètres

Accessible depuis l'icône de l'extension > Paramètres ou depuis tout nudge via "Paramètres".

**Sections :**

1. **Modules actifs** : activation/désactivation module par module. Chaque module est identifié par son nom parlant (ex : "Protection contre les sites suspects") et non par son identifiant interne.
2. **Quota** : affichage du quota journalier (défaut : 3), possibilité de l'augmenter (3, 5, 10, ou Tous). Le quota ne peut pas être réduit en deçà de 3. L'option "Tous" affiche un avertissement sur le risque de fatigue d'alerte.
3. **Profil** : modification du profil auto-déclaré (Débutant / Intermédiaire / Avancé).
4. **Données** : affichage du volume de données stockées, bouton "Effacer toutes mes données".
5. **Transparence radicale** : pour chaque module, description du mécanisme comportemental exploité et des sources scientifiques associées. Cette section est le coeur de l'engagement éthique de Sentinel Nudge.
6. **Politique de confidentialité** : texte complet.
7. **À propos** : version de l'extension, lien vers le dépôt GitHub, licence open-source.

```gherkin
Given un module est désactivé dans les paramètres
Then aucun nudge de ce module ne s'affiche
  And les données de ce module continuent à être collectées pour M3 (sauf si M3 lui-même est désactivé)

Given l'utilisateur clique sur "Effacer toutes mes données"
Then une confirmation est demandée
  And si confirmé, tous les stores IndexedDB et chrome.storage.local sont effacés
  And l'extension repasse à l'état "premier lancement"
```

#### 2.9.5 Dashboard — Tableau de bord

Accessible depuis l'icône de l'extension > Tableau de bord (ouvre un onglet dédié).

**Contenu :**
- Score courant et historique (graphique 12 semaines par défaut ; les données sont conservées sur 52 semaines glissantes, accessibles via un bouton « Voir l'historique complet »)
- Détail par composante (M2, M5, M6, M7, M9)
- Statistiques d'usage : nombre de nudges affichés, taux de réponse positive
- Résultats des quiz M6 (progression)
- Prochaine date de quiz M6 planifiée
- Accès rapide aux paramètres

```gherkin
Given l'utilisateur accède au tableau de bord
Then le score courant est affiché avec le delta semaine/semaine
  And le graphique d'historique sur 12 semaines est affiché par défaut
  And un bouton "Voir l'historique complet" permet d'accéder aux 52 semaines glissantes
  And toutes les données affichées proviennent exclusivement du stockage local
```

#### 2.9.6 Système de notification — Types de nudges

| Type | Déclenchement | Durée affichage | Position | Module(s) |
|------|--------------|-----------------|----------|-----------|
| Toast | Événement contextuel | 8 secondes (ou jusqu'à interaction) — timer en pause au survol souris (hover-pause) | Coin supérieur droit | M5, M7, M17 |
| Overlay interstitiel | Risque immédiat (priorité élevée) | Jusqu'à interaction obligatoire | Centre de l'écran | M2 |
| Overlay inline | Saisie en cours (temps réel) | Pendant la saisie | Sous le champ de formulaire | M9 |
| Badge icône | Hebdomadaire / quota atteint | Permanent jusqu'à consultation | Icône extension | M3, M6, Quota |

**Durée de 8 secondes — justification :** Les toasts contiennent environ 30-40 mots. À ~200 mots/minute en lecture rapide, il faut ~10-12s pour lire et comprendre. 8s incite à l'action rapide tout en laissant le temps de lire (WCAG 2.1 SC 2.2.1 recommande ~1s par 12 mots). Le hover-pause garantit que le timer ne s'écoule pas si l'utilisateur lit activement. Compromis validé par les design systems de référence (Material Design : 4-10s). La durée est configurable dans les paramètres avancés.

**Badge icône — code couleur :**
| Couleur | Condition | Signification |
|---------|-----------|---------------|
| Vert | Score >= 70 | Bonne cyber-hygiène |
| Orange | Score 40-69 | À améliorer |
| Rouge | Score < 40 | Attention requise |
| Bleu + chiffre | Notification en attente | Quiz disponible, rapport lundi, quota atteint |

Le badge change de couleur à chaque recalcul hebdomadaire du score (M3). C'est un renforcement positif (Fogg, 2009) qui motive sans être intrusif.

**Règles communes :**
- Tout nudge peut être fermé par la croix sans action (autonomie préservée).
- Aucun nudge ne bloque la navigation ou la soumission d'un formulaire.
- La position des toasts ne chevauche pas les contrôles natifs du navigateur.
- En mode responsive, les nudges s'adaptent à la taille de la fenêtre.
- Les toasts mettent le timer en pause au survol de la souris (hover-pause), conformément aux bonnes pratiques d'accessibilité.

#### 2.9.7 Pages d'explication statiques

Plusieurs nudges proposent des liens "Pourquoi c'est important ?", "Comment ça marche ?", "En savoir plus". Ces liens renvoient vers des pages HTML statiques intégrées à l'extension (aucun appel réseau).

**Structure :** Une page par module, accessible depuis :
- Le nudge lui-même (lien contextuel)
- La section "Transparence radicale" des paramètres

**Contenu type de chaque page :**

| Section | Description |
|---------|-------------|
| Pourquoi c'est important | Explication du risque en langage accessible, avec un exemple concret |
| Comment ça marche | Description du mécanisme comportemental utilisé (nudge, inoculation, framing, etc.) |
| Sources scientifiques | Références des études citées dans le cahier des charges |
| Conseils pratiques | Actions concrètes que l'utilisateur peut prendre immédiatement |
| Recommandations officielles | Le cas échéant, références aux recommandations ANSSI, CNIL, ou autres autorités |

**Pages prévues en v1 :**

| Page | Accessible depuis | Contenu spécifique |
|------|-------------------|-------------------|
| Sites suspects | M2 "Pourquoi ce message ?" | Signaux de risque (HTTP, typosquatting), sources : Sunshine et al. 2009 |
| Mises à jour navigateur | M5 "Pourquoi c'est important ?" | Failles corrigées, délais d'exploitation, source : Beautement et al. 2016 |
| Phishing | M6 feedback quiz | Techniques de phishing, signaux d'alerte, statistiques |
| Gestionnaires de mots de passe | M7 "Voir comment ça marche" | Fonctionnement, projets open source recommandés (KeePass, KeePassXC, Bitwarden, Vaultwarden), disclaimer de non-affiliation |
| Force des mots de passe | M9 "Pourquoi la force compte ?" | Entropie, attaques par force brute, recommandations ANSSI (Guide des mots de passe, 2021) |
| Presse-papiers | M17 "En savoir plus" | Risque du presse-papiers partagé entre applications |
| Calcul du score | M3 "Comment est calculé ce score ?" | Formule détaillée, poids, sources |

```gherkin
Given un nudge est affiché avec un lien "Pourquoi c'est important ?"
When l'utilisateur clique sur ce lien
Then une page d'explication statique s'ouvre dans un nouvel onglet
  And la page ne génère aucune requête réseau
  And la page contient les sections standard (risque, mécanisme, sources, conseils)

Given l'utilisateur est dans les paramètres section "Transparence radicale"
When il consulte un module
Then un lien vers la page d'explication correspondante est disponible
```

---

## 3. Exigences non fonctionnelles

### 3.1 Privacy by design

| Exigence | Description | Valeur cible |
|----------|-------------|--------------|
| ENF-PBD-01 | Aucun appel réseau sortant | 0 requête HTTP vers un serveur tiers |
| ENF-PBD-02 | Aucune télémétrie | 0 donnée comportementale transmise |
| ENF-PBD-03 | Minimisation des données | Seules les données strictement nécessaires sont collectées |
| ENF-PBD-04 | Chiffrement au repos | AES-256-GCM sur tous les stores IndexedDB contenant des données personnelles |
| ENF-PBD-05 | Droit à l'effacement | Effacement complet en 1 action depuis les paramètres |
| ENF-PBD-06 | Aucun identifiant persistant | Pas d'UUID utilisateur, pas de fingerprinting, pas de cookie |
| ENF-PBD-07 | Domaines jamais stockés en clair | Utilisation systématique de hash SHA-256 pour les noms de domaine |
| ENF-PBD-08 | Politique de confidentialité en plain language | Accessible depuis l'onboarding et les paramètres |

### 3.2 Performance et légèreté

| Exigence | Description | Valeur cible |
|----------|-------------|--------------|
| ENF-PERF-01 | Impact CPU au repos | < 0.1 % CPU en moyenne sur 1 heure |
| ENF-PERF-02 | Impact mémoire | < 20 Mo de RAM en utilisation normale |
| ENF-PERF-03 | Taille de l'extension | < 5 Mo (bundle compressé, corpus quiz inclus) |
| ENF-PERF-04 | Temps de déclenchement du nudge | < 500 ms entre l'événement déclencheur et l'affichage |
| ENF-PERF-05 | Impact sur le chargement des pages | 0 ms de blocage du rendu principal (content scripts injectés en `document_idle`) |
| ENF-PERF-06 | Évaluation de force M9 | < 100 ms par évaluation (algorithme local, pas de réseau) |

### 3.3 Accessibilité

| Exigence | Description | Standard |
|----------|-------------|---------|
| ENF-ACC-01 | Navigation clavier complète | Tous les nudges navigables et actionnables au clavier |
| ENF-ACC-02 | Compatibilité lecteurs d'écran | ARIA labels sur tous les éléments interactifs |
| ENF-ACC-03 | Contraste couleur | Ratio minimum 4.5:1 (WCAG 2.2 AA) |
| ENF-ACC-04 | Taille des cibles tactiles | Minimum 44×44 px pour tous les boutons |
| ENF-ACC-05 | Texte redimensionnable | Mise en page fonctionnelle jusqu'à 200 % de zoom |
| ENF-ACC-06 | Pas de contenu clignotant | Aucune animation > 3 Hz |

Niveau cible : WCAG 2.2 AA (arbitrage Commanditaire 2026-04-20 post-audit T-205 — alignement avec checklist a11y v1.1).

### 3.4 Internationalisation

| Exigence | Description | Valeur cible v1 |
|----------|-------------|-----------------|
| ENF-I18N-01 | Langue principale | Français (fr) |
| ENF-I18N-02 | Langue secondaire | Anglais (en) — corpus quiz obligatoirement bilingue |
| ENF-I18N-03 | Architecture i18n | Utilisation de l'API `chrome.i18n` avec fichiers `_locales/fr/messages.json` et `_locales/en/messages.json` |
| ENF-I18N-04 | Formats de date | Format local (`Intl.DateTimeFormat`) |
| ENF-I18N-05 | Extensibilité | Architecture permettant l'ajout d'une langue sans modification du code |

### 3.5 Compatibilité navigateurs

| Exigence | Description | Valeur cible v1 |
|----------|-------------|-----------------|
| ENF-COMPAT-01 | Navigateur cible principal | Google Chrome, versions N et N-1 (canal stable) |
| ENF-COMPAT-02 | Compatibilité Manifest V3 | Obligatoire — pas de rétrocompatibilité MV2 |
| ENF-COMPAT-03 | Compatibilité Edge | Objectif v2 (Chromium-based — réutilisation quasi intégrale du code MV3, impact faible) |
| ENF-COMPAT-04 | Firefox | Objectif v2+ (Manifest V3 Firefox via `browser_specific_settings`, APIs browser.* vs chrome.* — impact architectural modéré, prévoir couche d'abstraction navigateur dès la v1) |
| ENF-COMPAT-05 | Résolutions écran | 1024×768 minimum, optimisé 1920×1080 |

### 3.6 Sécurité de l'extension elle-même

| Exigence | Description | Valeur cible |
|----------|-------------|--------------|
| ENF-SEC-01 | Content Security Policy | CSP stricte dans le manifest : `script-src 'self'`, pas d'`unsafe-eval` |
| ENF-SEC-02 | Permissions minimales | Déclaration minimale dans le manifest (principe du moindre privilège) |
| ENF-SEC-03 | Absence de dépendances externes au runtime | Aucune librairie chargée depuis un CDN |
| ENF-SEC-04 | Code auditable | Code source disponible publiquement sur GitHub, licence open-source |
| ENF-SEC-05 | SBOM | Génération d'un Software Bill of Materials à chaque release |
| ENF-SEC-06 | Revue de code sécurité | Revue obligatoire avant chaque merge sur main (comité revue code) |
| ENF-SEC-07 | Pas de secret dans le code | Aucune clé, token ou secret dans le code versionné |

---

## 4. Contraintes techniques

### 4.1 Manifest V3 et permissions

L'extension doit être conforme à la spécification Manifest V3 de Chrome. Les permissions doivent être déclarées minimalement et justifiées.

**Permissions requises et justification :**

| Permission | Justification | Modules concernés |
|------------|--------------|-------------------|
| `activeTab` | Accès à l'URL et au DOM de l'onglet actif uniquement | M2, M9, M17 |
| `storage` | `chrome.storage.local` pour la configuration et les compteurs | Tous |
| `scripting` | Injection de content scripts pour la détection DOM | M2, M7, M9, M17 |
| `alarms` | Déclenchement des nudges programmés (M3, M5, M6) | M3, M5, M6 |
| `tabs` | Lecture de l'URL courante pour M2, ouverture d'onglets pour M5 | M2, M5 |
| `clipboardWrite` | Effacement du presse-papiers sur action volontaire de l'utilisateur (M17) | M17 |

**Permissions non utilisées en v1 (à ne pas déclarer) :**
`browsingData`, `notifications`, `webRequest`, `declarativeNetRequest`, `history`, `bookmarks`, `cookies`, `geolocation`, `identity`.

**Content scripts :** Injectés en `document_idle` (pas `document_start`) pour éviter tout impact sur le rendu des pages. Exception : M17 peut nécessiter `document_idle` avec écoute sur `paste`.

**Service Worker :** Le background script est un Service Worker (obligation MV3). Il gère les alarmes, le quota et les communications avec les content scripts via `chrome.runtime.sendMessage`.

### 4.2 Stockage local chiffré

- **IndexedDB** : données volumineuses (événements, hash, scores, quiz). Chiffré avec AES-256-GCM via Web Crypto API.
- **`chrome.storage.local`** : configuration, compteurs, clé de chiffrement. Taille limitée à 5 Mo (quota Chrome). Pas de chiffrement supplémentaire (la clé de chiffrement y réside, elle est protégée par le profil Chrome de l'utilisateur).

**Procédure de migration de données :** À chaque mise à jour majeure de l'extension, un script de migration est exécuté au démarrage du Service Worker pour assurer la compatibilité des données stockées avec le nouveau schéma.

### 4.3 Architecture sans réseau sortant

L'extension ne doit émettre aucune requête HTTP vers un serveur tiers, y compris :
- Pas de mise à jour de corpus (quiz, listes) via API externe
- Pas d'envoi de métriques ou de logs
- Pas de vérification de version en ligne
- Pas de résolution DNS externe (toutes les listes sont embarquées dans le bundle)

Les mises à jour de contenu (corpus de quiz, HSTS preload list) sont distribuées via les mises à jour régulières de l'extension sur le Chrome Web Store.

**Exception M5 :** La détection de mise à jour navigateur (M5) utilise `chrome.runtime.requestUpdateCheck()`, le mécanisme natif de Chrome. Ce n'est pas un appel réseau vers un serveur tiers — c'est le canal de mise à jour intégré que Chrome utilise déjà pour ses propres mises à jour. Cela garantit une détection toujours à jour, sans dépendre du rythme de publication de l'extension.

### 4.4 Open source et auditabilité

- Licence : **GNU GPL v3** (validée par le Commanditaire le 2026-04-11 — cf. p1-analyse-licences-open-source-v1.0.md)
- Dépôt public : https://github.com/antonyblain/sentinel-nudge
- SBOM généré à chaque release (format SPDX ou CycloneDX)
- Aucune obfuscation du code
- Toutes les dépendances npm listées dans `package.json` avec versions fixées (pas de ranges flottants)
- `package-lock.json` versionné obligatoirement

---

## 5. Critères d'acceptation globaux

Ces critères s'appliquent à l'ensemble de l'extension en phase de recette (P7), indépendamment des critères par module.

**CA-GLOBAL-01 — Quota journalier respecté**
```gherkin
Given un scénario simulant 10 événements déclencheurs dans la même journée
  And le quota journalier est à 3 (défaut)
When les événements sont traités
Then seuls 3 nudges (+ les exceptions critiques M2/M17) sont affichés
  And les événements non affichés sont enregistrés localement pour le score M3
  And le badge de l'extension indique "Quota du jour atteint"
  And un lien vers les paramètres permet d'augmenter le quota
```

**CA-GLOBAL-01b — Quota "Tous"**
```gherkin
Given l'utilisateur a configuré le quota à "Tous"
  And un scénario simulant 10 événements déclencheurs dans la même journée
When les événements sont traités
Then les 10 nudges sont affichés sans limitation
```

**CA-GLOBAL-02 — Désactivation d'un module**
```gherkin
Given l'utilisateur désactive le module M7 dans les paramètres
When un événement de réutilisation de mot de passe est détecté
Then aucun nudge M7 ne s'affiche
  And l'entrée de menu module M7 est clairement marquée "Désactivé"
```

**CA-GLOBAL-03 — Effacement complet des données**
```gherkin
Given l'utilisateur a utilisé l'extension pendant 4 semaines
When il clique sur "Effacer toutes mes données" dans les paramètres et confirme
Then tous les stores IndexedDB sont vidés
  And chrome.storage.local est réinitialisé
  And l'extension repasse à l'état "premier lancement" au prochain démarrage
```

**CA-GLOBAL-04 — Aucun appel réseau**
```gherkin
Given l'extension est installée et active
When l'utilisateur navigue pendant 1 heure sur diverses pages
Then aucune requête HTTP sortante n'est émise par l'extension
  And cela est vérifiable via chrome://net-internals
```

**CA-GLOBAL-05 — Accessibilité — Navigation clavier**
```gherkin
Given un nudge (toast, overlay ou inline) est affiché
When l'utilisateur navigue uniquement au clavier (Tab, Enter, Escape)
Then tous les boutons du nudge sont atteignables et actionnables
  And Escape ferme le nudge
```

**CA-GLOBAL-06 — Onboarding obligatoire au premier lancement**
```gherkin
Given l'extension vient d'être installée
When le navigateur démarre pour la première fois avec l'extension
Then l'onboarding s'affiche avant tout nudge
  And aucun nudge n'est déclenché avant que l'onboarding soit terminé
```

**CA-GLOBAL-07 — Transparence radicale accessible**
```gherkin
Given l'utilisateur est dans les paramètres section "Transparence"
When il consulte la page du module M2
Then le mécanisme comportemental (just-in-time nudge) est décrit
  And les sources scientifiques (Sunshine et al., 2009 ; Schechter et al., 2007) sont citées
  And l'utilisateur comprend pourquoi ce module a été conçu de cette manière
```

**CA-GLOBAL-08 — Performance au repos**
```gherkin
Given l'extension est installée et le navigateur est ouvert
When aucun événement déclencheur n'a lieu pendant 1 heure
Then l'utilisation CPU imputable à l'extension est inférieure à 0.1 %
  And l'utilisation mémoire imputable à l'extension est inférieure à 20 Mo
```

---

## 6. Lotissement et évolutions futures

### 6.1 Périmètre v2

Ces modules sont Should dans la priorité globale et ont été reportés en v2 pour permettre la livraison d'une v1 cohérente et testable.

| Module | Titre | Priorité | Raison du report |
|--------|-------|----------|-----------------|
| M4 | Nudge contextuel sur les téléchargements | Should | Tension privacy (hash VirusTotal) à résoudre en architecture |
| M11 | Audit des permissions accordées aux sites web | Should | Limite API : `chrome.contentSettings` sans révocation directe |
| M13 | Détection de lien raccourci avant navigation | Should | Liste de raccourcisseurs à constituer et maintenir |
| M20 | Détection de requête de permission abusive | Should | Détection MV3 via `Notification.requestPermission()` à valider |

**Navigateurs v2 :**
- **Microsoft Edge** : basé sur Chromium, l'extension Chrome MV3 fonctionne avec peu ou pas de modifications. Publication sur le Microsoft Edge Add-ons Store. Impact faible.

**Prérequis pour v2 :**
- Stabilité de la v1 prouvée (60 jours de disponibilité publique sans régression critique)
- Architecture validée pour l'ajout de modules sans refactoring majeur
- Corpus de quiz M6 enrichi à 100+ exemples

### 6.2 Périmètre v2+

Modules Could : validés scientifiquement mais à risque de faux positifs élevé ou de friction utilisateur significative.

M1 (Audit extensions), M8 (Forced Pause formulaires), M10 (Session ouverte), M12 (Mode incognito), M14 (HTTP alerte), M15 (Nettoyage cache), M16 (Formulaires données excessives), M19 (Cookies et tracking).

**Navigateurs v2+ :**
- **Firefox** : nécessite une adaptation du Manifest V3 (via `browser_specific_settings`), et le remplacement des APIs `chrome.*` par `browser.*`. L'impact architectural est modéré. La couche d'abstraction navigateur prévue dès la v1 (cf. ENF-COMPAT-04) facilitera cette transition.

Ces modules seront instruits lors de la roadmap v2 en fonction des retours utilisateurs sur la v1.

### 6.3 Exclusions définitives

| Module | Titre | Motif d'exclusion |
|--------|-------|------------------|
| M18 | Gestion de la fatigue multi-onglets | Valeur sécurité insuffisante ; risque d'irritation élevé sur flux légitimes ; chevauchement avec le module 10 |

---

## 7. Glossaire

| Terme | Définition |
|-------|-----------|
| **Architecture du choix** | Disposition des options présentées à un individu, qui influence sa décision sans la contraindre. Concept central de la théorie du nudge (Thaler & Sunstein, 2008). |
| **Biais de statu quo** | Tendance à conserver l'option par défaut par inertie décisionnelle. Fondement de l'effet de défaut. |
| **Content script** | Script JavaScript injecté par une extension dans le contexte des pages web. Dans Sentinel Nudge, utilisé pour détecter les événements DOM (saisie, collage, focus). |
| **Corpus** | Ensemble des exemples de quiz phishing utilisés par M6. Embarqué statiquement dans l'extension. |
| **CSP (Content Security Policy)** | En-tête HTTP et directive de manifest contrôlant les sources de scripts, styles et ressources autorisés. Mesure de sécurité fondamentale pour les extensions. |
| **CSBS (CyberSecurity Behavioral Science)** | Champ disciplinaire appliquant les sciences comportementales à la cybersécurité. Également désigné "Usable Security". |
| **Cyber-hygiène** | Ensemble des pratiques de sécurité numériques quotidiennes : mots de passe forts, mises à jour, vigilance phishing, etc. |
| **Effet de défaut (Default Effect)** | Mécanisme comportemental : les individus tendent à conserver l'option présentée par défaut. Utilisé dans M5 (bouton MAJ mis en avant). |
| **Entropie (mot de passe)** | Mesure de l'imprévisibilité d'un mot de passe. Plus l'entropie est élevée, plus le mot de passe est difficile à deviner ou à forcer. |
| **Faux positif** | Déclenchement d'un nudge sur une situation qui n'est pas réellement risquée. Source principale de réactance et de désactivation. |
| **Framing** | Effet de cadrage : la présentation d'une même information produit des décisions différentes selon le cadre utilisé (gain vs perte). |
| **Habituation / Alert Fatigue** | Phénomène par lequel la répétition excessive de nudges identiques rend l'utilisateur insensible à ces alertes. Limite fixée à 3 nudges/jour (Anderson et al., 2016). |
| **Hash SHA-256** | Fonction de hachage cryptographique produisant une empreinte de 256 bits. Utilisée dans M7 pour stocker une représentation non réversible des mots de passe. |
| **HSTS Preload List** | Liste publique de domaines qui doivent obligatoirement être servis en HTTPS. Maintenue par Google, embarquée dans les navigateurs et dans Sentinel Nudge. |
| **IndexedDB** | Base de données orientée objet intégrée au navigateur, accessible depuis JavaScript. Utilisée par Sentinel Nudge pour le stockage structuré des événements, scores et hash. |
| **Inoculation comportementale** | Mécanisme consistant à exposer l'utilisateur à une forme atténuée d'une attaque (ex : quiz phishing) pour renforcer sa résistance aux attaques réelles. Validé par Kumaraguru et al. (2007). |
| **Just-in-time nudge** | Nudge déclenché au moment précis où la décision de sécurité est prise, maximisant l'efficacité (Thaler & Sunstein, 2008 ; Sunshine et al., 2009). |
| **Luhn (algorithme de)** | Algorithme de validation de numéros de cartes bancaires. Utilisé par M17 pour distinguer un vrai numéro de carte d'un nombre quelconque. |
| **Manifest V3 (MV3)** | Version actuelle de la spécification des extensions Chrome. Remplace Manifest V2 (déprécié). Contraint les permissions disponibles et impose l'usage de Service Workers. |
| **Micro-nudge** | Nudge de faible intensité et courte durée, conçu pour minimiser la friction tout en guidant l'utilisateur vers un comportement plus sécurisé. |
| **Module** | Composant fonctionnel autonome de Sentinel Nudge. Chaque module détecte un risque spécifique et produit un nudge correspondant. |
| **MoSCoW** | Méthode de priorisation : Must (indispensable), Should (important), Could (souhaitable), Won't (exclu de la version courante). |
| **Nudge** | Intervention dans l'architecture du choix modifiant le comportement de manière prévisible sans interdire aucune option (Thaler & Sunstein, 2008). |
| **Open source** | Code source disponible publiquement, permettant l'inspection, la modification et la redistribution selon les termes de la licence. |
| **Overlay** | Élément d'interface affiché par-dessus le contenu de la page (inline ou modal). Utilisé par M2 et M9. |
| **Paternalisme libertarien** | Approche défendue par Thaler & Sunstein : guider les comportements vers de meilleures décisions tout en préservant la liberté de choix totale. Fondement éthique de Sentinel Nudge. |
| **Privacy by design** | Principe consistant à intégrer la protection de la vie privée dès la conception, et non comme une couche ajoutée après coup. |
| **Quota journalier** | Nombre maximum de nudges pouvant être affichés par jour (défaut : 3). Mécanisme anti-fatigue fondé sur Anderson et al. (2016). |
| **Réactance psychologique** | Résistance comportementale déclenchée lorsqu'un individu perçoit une atteinte à son autonomie. Risque principal en cas de nudge trop insistant ou accusateur. |
| **RGPD** | Règlement Général sur la Protection des Données (UE 2016/679). Cadre juridique applicable au traitement de données personnelles dans l'Union Européenne. |
| **SBOM (Software Bill of Materials)** | Inventaire exhaustif des composants logiciels d'une application (dépendances, versions, licences). Exigé pour l'auditabilité de Sentinel Nudge. |
| **Score de cyber-hygiène** | Indicateur composite (0-100) calculé localement par M3, agrégeant les métriques de comportement de sécurité de l'utilisateur. |
| **Service Worker** | Script JavaScript s'exécutant en arrière-plan, sans accès direct au DOM. Imposé par Manifest V3 pour remplacer les background pages persistantes. |
| **Spaced repetition** | Technique pédagogique consistant à répéter les apprentissages à des intervalles croissants pour maximiser la rétention (Cepeda et al., 2006). Utilisée par M6. |
| **Toast** | Notification légère, non bloquante, apparaissant temporairement dans un coin de l'écran. Type de nudge principal pour M5, M7, M17. |
| **Transparence radicale** | Engagement de Sentinel Nudge à documenter et exposer à l'utilisateur, sur demande, chaque mécanisme comportemental utilisé et ses sources scientifiques. |
| **Typosquatting** | Technique d'usurpation d'identité consistant à enregistrer un nom de domaine visuellement proche d'un domaine légitime (ex : "paypa1.com" pour "paypal.com"). |
| **Web Crypto API** | API JavaScript native du navigateur fournissant des primitives cryptographiques (AES, SHA, etc.). Utilisée par Sentinel Nudge pour le chiffrement local (IndexedDB). |
| **Whitelist** | Liste de domaines ou d'éléments marqués comme de confiance par l'utilisateur, exemptés du déclenchement des nudges correspondants. |
| **zxcvbn** | Algorithme open-source d'évaluation de la force des mots de passe, développé par Dropbox. Alternative locale à considérer pour M9. |

---

*Cahier des charges produit par l'Analyste métier — Fabrique — Phase P1*
*Version 1.1 — 2026-04-11 — Révisé suite aux commentaires du Commanditaire*
*Ce document sera soumis au Référent qualité avant transmission au Commanditaire.*
