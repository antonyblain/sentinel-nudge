# Guide de tests manuels — 4 modules non validés en P4'

**Version** : 1.0
**Date** : 2026-04-14
**Référence** : PV comité revue de code P4' (`gouvernance-pv-revue-code-p4prime-v1.0.md`)
**Contexte** : 4 modules sur 11 restent non testés manuellement car ils dépendent de conditions temporelles ou d'états externes.

| Module | Raison du blocage | Temps de test estimé |
|--------|-------------------|----------------------|
| M7 — Réutilisation mdp | Nécessite 2 soumissions sur 2 sites différents | 10 min |
| M5 — MAJ navigateur | Dépend de l'état de MAJ Chrome | 5 min |
| M3 — Score hebdomadaire | Déclenché lundi 09h | 3 min |
| M6 — Quiz spaced repetition | Déclenché par algorithme SM-2 | 8 min |

---

## Préparation commune à tous les tests

### 1. Charger l'extension en mode développeur

```
1. Ouvrir Chrome → chrome://extensions
2. Activer "Mode développeur" (coin supérieur droit)
3. Cliquer "Charger l'extension non empaquetée"
4. Sélectionner C:\Dev\sentinel-nudge\dist
5. Vérifier que l'icône bouclier Sentinel Nudge apparaît dans la toolbar
```

### 2. Ouvrir la console du service worker

```
1. Dans chrome://extensions, repérer la carte "Sentinel Nudge"
2. Cliquer "service worker" (lien bleu) → une DevTools dédiée s'ouvre
3. C'est dans cette console que vous collerez les commandes de test
```

**Alternative** pour inspecter une content script : DevTools d'une page ouverte → onglet Console → changer le contexte en haut à gauche pour sélectionner le Shadow DOM de l'extension.

### 3. Reset complet entre deux sessions de test

```javascript
// Réinitialise tout l'état (modules, quota, scores, hashes) — à exécuter dans la console SW
await chrome.storage.local.clear();
await new Promise(r => chrome.runtime.reload());
// Puis recharger la page si nécessaire
```

---

## Module M7 — Réutilisation de mot de passe

### Pré-requis

- M7 doit être activé dans les paramètres de l'extension (consentement coché lors de l'onboarding)
- Deux sites distincts avec un formulaire de login (type `<input type="password">` + bouton submit)

### Option A — Test avec sites réels (recommandé, 10 min)

**Préparation** : choisir 2 sites publics qui acceptent la création de compte avec login/mot de passe. Par exemple :
- https://the-internet.herokuapp.com/login (site de test Heroku — user: `tomsmith`, pass: `SuperSecretPassword!`)
- https://demoqa.com/login (autre site de test)

**Procédure** :

```
1. Ouvrir le premier site (ex: the-internet.herokuapp.com/login)
2. Saisir un mot de passe fictif de test, ex: "TestSentinel2026!"
3. Cliquer sur le bouton de soumission
4. RÉSULTAT ATTENDU : aucun toast M7 ne s'affiche (premier enregistrement)
5. Ouvrir un nouvel onglet sur demoqa.com/login
6. Saisir LE MÊME mot de passe "TestSentinel2026!"
7. Cliquer sur le bouton de soumission
8. RÉSULTAT ATTENDU : toast M7 "Mot de passe déjà utilisé" en bas à droite
```

**Points de vérification** :

- Toast avec fond clair (ou sombre si dark mode), bordure navy, 2 boutons : "En savoir plus" et "Supprimer ce domaine"
- Auto-fermeture après 8 secondes
- Barre de progression rouge sous le toast (timer visuel)

### Option B — Test par injection directe (avancé, 5 min)

```javascript
// Console SW — simuler la soumission d'un mdp sur un premier site
const pwd = 'TestSentinel2026!';
const encoder = new TextEncoder();
const hash = await crypto.subtle.digest('SHA-256', encoder.encode(pwd + 'mock-salt'));
const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');

// Forcer le domain_hash du premier site
const domainHash1 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode('site1.example.com')))).map(b => b.toString(16).padStart(2, '0')).join('');

// Soumission #1 — ne déclenche rien (première occurrence)
await chrome.runtime.sendMessage({
  module: 'M7',
  action: 'password_submitted',
  payload: { hash: hashHex, domain_hash: domainHash1 },
  timestamp: Date.now(),
});

// Vérifier que le hash a été enregistré en IndexedDB
// (les logs du service worker doivent afficher "M7: password registered")
```

### Vérification du stockage

```javascript
// Console SW — vérifier que le hash est bien chiffré en IndexedDB
// (uniquement l'inspecteur IndexedDB via chrome://extensions → service worker → onglet Application → IndexedDB → sentinel-nudge-db)
// Les hashes apparaissent en base64 AES-256-GCM, pas en clair
```

### Réinitialisation entre deux tests M7

```javascript
await chrome.storage.local.remove(['m7_hashes_meta', 'm7_suppressed_domains', 'm7_cooldown']);
// Ne pas purger IndexedDB via cette commande, utiliser chrome.runtime.reload()
await chrome.runtime.reload();
```

---

## Module M5 — Mise à jour navigateur

### Méthode la plus simple : déclencher le check manuellement

```javascript
// Console SW — force un check de MAJ Chrome et retourne le résultat immédiat
const response = await chrome.runtime.sendMessage({
  module: 'M5',
  action: 'check_update',
  payload: {},
  timestamp: Date.now(),
});
console.log('M5 response:', response);
```

**Interprétation du résultat `response.action`** :

| Valeur | Signification | Toast attendu ? |
|--------|---------------|-----------------|
| `show` | MAJ disponible + conditions réunies | Oui, sur l'onglet actif |
| `skip` avec reason `api_unavailable` | `chrome.runtime.requestUpdateCheck()` indisponible | Non (dégradation gracieuse) |
| `skip` avec reason `no_update` | Chrome est à jour | Non |
| `skip` avec reason `throttled` | Trop de checks récents | Non |
| `skip` avec reason `grace_period` | Période de grâce après installation | Non |
| `skip` avec reason `no_active_tab` | Aucun onglet actif | Non |
| `skip` avec reason `deferred_context` | Onglet system/chrome:// | Non |

### Simuler un Chrome pas à jour (avancé)

Impossible sans versioning réel de Chrome. Deux approches :

**Approche 1 — Mock de l'API** (modification temporaire du code) :

```javascript
// Console SW — monkey-patch de chrome.runtime.requestUpdateCheck
const original = chrome.runtime.requestUpdateCheck;
chrome.runtime.requestUpdateCheck = (cb) => {
  cb('update_available', { version: '999.0.0.0' });
};

// Relancer le check
await chrome.runtime.sendMessage({ module: 'M5', action: 'check_update', payload: {}, timestamp: Date.now() });

// Vérifier sur l'onglet actif : toast bleu "Mettre à jour votre navigateur"
// Restaurer après le test
chrome.runtime.requestUpdateCheck = original;
```

**Approche 2 — Docker Chrome ancien** (pour automatisation P6, hors scope ce guide)

### Points de vérification

- Toast avec icône ⚠️ et texte "Mettre à jour votre navigateur"
- 3 boutons : "Mettre à jour maintenant", "Plus tard", "En savoir plus"
- Le bouton "Plus tard" incrémente `m5_snooze_count` (vérifiable avec `chrome.storage.local.get(['m5_snooze_count'])`)
- Le bouton "Mettre à jour" ouvre `chrome://settings/help` dans un nouvel onglet

### Réinitialisation

```javascript
await chrome.storage.local.remove([
  'm5_last_nudge_date',
  'm5_snooze_count',
  'm5_is_up_to_date',
]);
await chrome.runtime.reload();
```

---

## Module M3 — Score hebdomadaire

### Méthode la plus simple : forcer le calcul immédiat

```javascript
// Console SW — lance le calcul du score sans attendre lundi
const response = await chrome.runtime.sendMessage({
  module: 'M3',
  action: 'calculate_score',
  payload: {},
  timestamp: Date.now(),
});
console.log('M3 response:', response);
// response.data.score doit contenir un nombre 0-100 (ou null si aucune donnée)
```

### Générer des événements fictifs pour obtenir un score non-null

Le scoring M3 se base sur les événements des modules M2/M5/M6/M7/M9 stockés en IndexedDB. Pour obtenir un score, il faut déclencher au préalable quelques événements :

```javascript
// Console SW — simuler quelques événements M6 (quiz réussi)
await chrome.runtime.sendMessage({
  module: 'M6',
  action: 'quiz_completed',
  payload: {
    question_id: 'phishing_01',
    answer_correct: true,
    answer_index: 0,
    response_time_ms: 4500,
  },
  timestamp: Date.now(),
});

// Simuler un événement M5 (navigateur à jour)
await chrome.storage.local.set({ m5_is_up_to_date: true });

// Relancer le calcul M3
const response = await chrome.runtime.sendMessage({
  module: 'M3',
  action: 'calculate_score',
  payload: {},
  timestamp: Date.now(),
});
console.log('Score après événements:', response);
```

### Vérification du score dans l'UI

```
1. Ouvrir la popup (clic sur l'icône bouclier dans la toolbar)
2. Le score doit s'afficher dans la jauge circulaire colorée
   - Vert si ≥ 70
   - Orange si 40-69
   - Rouge si < 40
3. Ouvrir le dashboard (bouton "Voir le détail")
4. Vérifier l'historique et le détail par composante
```

### Consulter les scores stockés

```javascript
// Console SW — lister tous les scores hebdomadaires stockés
const scores = await chrome.runtime.sendMessage({
  module: 'M3',
  action: 'get_score',
  payload: {},
  timestamp: Date.now(),
});
console.log('Scores stockés:', scores);
```

### Réinitialisation

```javascript
await chrome.storage.local.remove([
  'm3_last_calculation',
  'm3_current_score',
  'm5_is_up_to_date',
]);
// Purge IndexedDB (scores, events) via reload de l'extension
await chrome.runtime.reload();
```

---

## Module M6 — Quiz spaced repetition

### Méthode : forcer une date de quiz dans le passé

```javascript
// Console SW — force la prochaine date de quiz à hier pour déclencher un quiz maintenant
const yesterday = Date.now() - 86400000; // -24h
await chrome.storage.local.set({
  m6_state: {
    next_quiz_date: yesterday,
    last_quiz_date: null,
    streak_count: 0,
    interval_index: 0,
  },
});

// Déclencher la vérification
const response = await chrome.runtime.sendMessage({
  module: 'M6',
  action: 'check_quiz',
  payload: {},
  timestamp: Date.now(),
});
console.log('M6 check_quiz response:', response);
// response.action doit être 'show' si un quiz est déclenché
```

### Vérification du quiz dans l'UI

```
1. Ouvrir un onglet sur un site HTTPS quelconque (ex: https://example.com)
2. Après la commande ci-dessus, un overlay quiz doit apparaître en bas à droite
3. Une question avec 4 propositions de réponse
4. Cliquer sur une réponse
5. RÉSULTAT ATTENDU : feedback immédiat (correct/incorrect) + explication + bouton "Continuer"
```

### Simuler la complétion d'un quiz

```javascript
// Console SW — simuler une réponse correcte
await chrome.runtime.sendMessage({
  module: 'M6',
  action: 'quiz_completed',
  payload: {
    question_id: 'phishing_01',
    answer_correct: true,
    answer_index: 0,
    response_time_ms: 4500,
  },
  timestamp: Date.now(),
});

// Vérifier que le streak_count a augmenté et que next_quiz_date est repoussée
const state = await chrome.storage.local.get(['m6_state']);
console.log('M6 state après complétion:', state.m6_state);
// Les intervalles suivent la séquence [0, 7, 21, 42, 70] jours puis 30j mensuel
```

### Tester les ajustements d'intervalle

Le score du quiz ajuste le prochain intervalle selon ces règles :
- Score < 50% → intervalle ×0.7 (quiz plus rapproché)
- Score 100% → intervalle ×1.2 (quiz plus espacé)
- Score 50-99% → intervalle standard

```javascript
// Simuler un quiz raté (intervalle doit se raccourcir)
await chrome.runtime.sendMessage({
  module: 'M6',
  action: 'quiz_completed',
  payload: {
    question_id: 'phishing_02',
    answer_correct: false,
    answer_index: 2,
    response_time_ms: 12000,
  },
  timestamp: Date.now(),
});

// Comparer next_quiz_date avant/après
const state = await chrome.storage.local.get(['m6_state']);
console.log('Nouvel intervalle:', (state.m6_state.next_quiz_date - Date.now()) / 86400000, 'jours');
```

### Réinitialisation

```javascript
await chrome.storage.local.remove(['m6_state', 'm6_quiz_history']);
await chrome.runtime.reload();
```

---

## Checklist de test consolidée

Reportez l'issue sur chaque ligne (✓ / ✗ / N/A) :

### M7 — Réutilisation mdp
- [ ] Première soumission sur site A : aucun toast, hash enregistré en IndexedDB
- [ ] Même mot de passe soumis sur site B : toast M7 affiché
- [ ] Bouton "En savoir plus" ouvre `pages/static/reutilisation-mots-de-passe.html`
- [ ] Bouton "Supprimer ce domaine" supprime le hash et ferme le toast
- [ ] Auto-fermeture après 8s avec barre de progression

### M5 — MAJ navigateur
- [ ] `check_update` retourne un `action` cohérent (show / skip avec reason)
- [ ] Si MAJ disponible (mock) : toast bleu affiché sur l'onglet actif
- [ ] Bouton "Mettre à jour" ouvre `chrome://settings/help`
- [ ] Bouton "Plus tard" incrémente `m5_snooze_count`
- [ ] Grace period (30s après install) bloque les nudges

### M3 — Score hebdomadaire
- [ ] `calculate_score` retourne un score 0-100 (ou null si pas de données)
- [ ] Popup affiche la jauge circulaire avec la bonne couleur
- [ ] Dashboard affiche l'historique et le détail par composante
- [ ] Les 5 composantes (M5=20, M6=25, M2=20, M7=20, M9=15) totalisent bien 100

### M6 — Quiz
- [ ] Quiz déclenché avec `next_quiz_date < Date.now()`
- [ ] Overlay affiché avec 4 propositions + question claire
- [ ] Clic sur bonne réponse → feedback + intervalle ×1 ou ×1.2 (selon score)
- [ ] Clic sur mauvaise réponse → explication + intervalle ×0.7
- [ ] `streak_count` incrémenté ou remis à 0

---

## Logging à vérifier

Durant les tests, la console SW doit afficher des logs structurés :

```
[M5Handler] check_update: { action: 'show', ... }
[M6Handler] check_quiz: { action: 'show', next_quiz_date: ... }
[M7Handler] password_submitted: { action: 'show', reason: 'reuse_detected' }
[M3Handler] calculate_score: { score: 72, delta: +5 }
```

**Aucun log ne doit contenir de donnée personnelle** (mot de passe, hash en clair, URL complète, contenu presse-papiers). Vérifiez visuellement que les champs `context` des logs ne contiennent que `error` ou `level`.

---

## Prochaine action après ces tests

1. Cocher les items de la checklist ci-dessus
2. Reporter toute anomalie dans `.claude/PROBLEMES.md`
3. Si tout est vert, la validation P4' est complète — on passe en P5
4. Sinon, créer les TACHES correctives dans BACKLOG.md avec le flag `Must`

---

## Annexe — Commandes utiles pour l'investigation

### Inspecter l'état complet de chrome.storage.local

```javascript
console.log(await chrome.storage.local.get(null));
```

### Forcer un re-render de la popup

Fermer-rouvrir la popup (clic ailleurs puis re-clic sur l'icône).

### Vérifier les alarmes chrome programmées

```javascript
const alarms = await chrome.alarms.getAll();
console.log('Alarmes actives:', alarms);
// Attendu : m3_weekly_score, m5_retry_throttled, m5_snooze, m6_check
```

### Forcer le déclenchement immédiat d'une alarme

```javascript
// M3 weekly
chrome.alarms.clear('m3_weekly_score');
chrome.runtime.sendMessage({ module: 'M3', action: 'calculate_score', payload: {}, timestamp: Date.now() });
```

### Consulter les événements persistés en IndexedDB

Via DevTools du service worker → onglet **Application** → **IndexedDB** → `sentinel-nudge-db` → **events** / **quiz_sessions** / **password_hashes**.
