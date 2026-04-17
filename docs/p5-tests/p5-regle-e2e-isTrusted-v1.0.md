# P5 — Règle E2E Playwright : interactions isTrusted pour les tests M7

**Référence tâche** : TACHE-099
**Phase** : P5 — Fiabilisation M7 + couverture UC P0 v1
**Version** : 1.0
**Date** : 2026-04-17
**Auteur** : Testeur QA
**Statut** : Soumis pour validation — Référent qualité
**Origine** : Comité revue code TACHE-069/072 — point INFO-02

---

## 1. Contexte : le filtre isTrusted dans password-detector.ts

### 1.1 Pourquoi ce filtre existe

M7 (détection de réutilisation de mots de passe inter-domaines) s'active sur l'événement `submit` d'un formulaire contenant un champ password. Cependant, tous les événements `submit` ne proviennent pas d'une action utilisateur : les gestionnaires de mots de passe (Bitwarden, 1Password, Dashlane, etc.) peuvent auto-remplir ET auto-soumettre le formulaire de manière programmatique.

Ces auto-submits générés par du code JavaScript produisent des événements DOM avec `event.isTrusted = false`. Le standard Web Platform définit cette propriété comme `true` uniquement pour les événements déclenchés par une action physique de l'utilisateur (frappe clavier, clic souris, tap écran).

Sans le filtre, M7 déclencherait son toast de notification sur chaque auto-fill d'un password manager, créant des faux positifs intrusifs.

### 1.2 Décision d'arbitrage : ARB-UC02-01

L'arbitrage ARB-UC02-01 (comité revue code TACHE-069/072, 2026-04-17) tranche en faveur du filtre strict :

> M7 ne traite QUE les événements `submit` avec `event.isTrusted = true`.
> Les submits programmatiques (password managers, SPA, scripts de test) sont silencieusement ignorés.

Ce choix est implémenté dans `src/content-scripts/detectors/password-detector.ts`, fonction `handleFormSubmit()` :

```typescript
// ARB-UC02-01 : filtrer les submits programmatiques (PM auto-fill + auto-submit)
if (!event.isTrusted) return;
```

### 1.3 Portée du filtre

Le filtre s'applique aux trois vecteurs de déclenchement de M7 :

| Vecteur | Listener | Filtre isTrusted |
|---------|----------|-----------------|
| Submit de formulaire natif | `form.addEventListener('submit', ...)` | Oui — `handleFormSubmit()` ligne 1192 |
| Touche Enter dans un input password orphelin | `document.addEventListener('keydown', ...)` capture phase | Oui — l'événement keydown issu de `press('Enter')` Playwright est `isTrusted=true` |
| Clic sur bouton proche d'un input orphelin | `document.addEventListener('click', ...)` capture phase | Oui — l'événement click issu de `.click()` Playwright est `isTrusted=true` |

**UC couvert** : UC-02 (gestionnaires de mots de passe auto-submit) et, par extension, tout contexte où un script JS soumet un formulaire sans interaction utilisateur réelle.

---

## 2. Règle prescriptive : API Playwright à utiliser

### 2.1 DO — Interactions génèrant isTrusted=true

Utiliser exclusivement les méthodes de l'API `Locator` de Playwright. Ces méthodes simulent des événements natifs du navigateur (InputEvent, KeyboardEvent, MouseEvent) avec `isTrusted=true`.

**Saisie dans un champ :**

```typescript
// Saisir une valeur — génère un InputEvent isTrusted=true
await page.locator('#password').fill('mon-mot-de-passe');

// Equivalent avec type() si fill() ne convient pas (champ avec validation onChange)
await page.locator('#password').pressSequentially('mon-mot-de-passe');
```

**Soumission par clic sur bouton :**

```typescript
// Clic sur le bouton submit — génère un MouseEvent isTrusted=true
await page.locator('button[type="submit"]').click();

// Variantes acceptables selon le DOM de la page cible
await page.locator('[data-testid="login-btn"]').click();
await page.locator('input[type="submit"]').click();
```

**Soumission par touche Entrée :**

```typescript
// Press Enter dans le champ — génère un KeyboardEvent isTrusted=true
await page.locator('#password').press('Enter');

// Aussi valide : press sur le formulaire si le focus est déjà dans le champ
await page.locator('#password').fill('mon-mot-de-passe');
await page.locator('#password').press('Enter');
```

**Exemple canonique complet (tiré de TC-UC06-E2E-01) :**

```typescript
// 1. Attendre que le champ soit visible
await page.locator('#password').waitFor({ state: 'visible', timeout: 3000 });

// 2. Saisir via Locator API — isTrusted=true garanti
await page.locator('#password').fill('test-password-uc06');

// 3. Soumettre via clic réel — isTrusted=true garanti
await page.locator('button[type="submit"]').click();

// 4. Attendre le traitement SW (hash + IndexedDB)
await page.waitForTimeout(800);
```

### 2.2 DON'T — Interactions génèrant isTrusted=false

Ces patterns sont **interdits** dans tout test Playwright qui vise à déclencher M7. Ils simulent exactement le comportement d'un password manager : M7 les ignorera silencieusement, et le test passera à tort (faux positif de silence).

**Soumission programmatique via evaluate :**

```typescript
// INTERDIT — génère isTrusted=false, filtré par M7
await page.evaluate(() => {
  const form = document.querySelector<HTMLFormElement>('#login-form');
  form?.submit();
});

// INTERDIT — même résultat
await page.evaluate(() => {
  const form = document.querySelector<HTMLFormElement>('#login-form');
  form?.requestSubmit();
});
```

**Dispatch d'événement synthétique :**

```typescript
// INTERDIT — isTrusted=false non modifiable par du code JS (W3C spec)
await page.evaluate(() => {
  const form = document.querySelector('#login-form');
  form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
});
```

**Injection directe de valeur sans événement natif :**

```typescript
// INTERDIT — ne déclenche pas d'événement isTrusted=true sur le champ
await page.evaluate(() => {
  const input = document.querySelector<HTMLInputElement>('#password');
  if (input) input.value = 'mon-mot-de-passe'; // isTrusted=false sur l'input event
});
```

---

## 3. Exceptions documentées : tests qui valident le filtre lui-même

### 3.1 Convention de nommage

Certains tests ont pour objectif de **vérifier que M7 filtre correctement** les submits programmatiques. Ces tests utilisent délibérément les patterns DON'T du §2.2.

Convention obligatoire : le nom du test doit porter le suffixe **`-filter-isTrusted`**.

```
TC-<MODULE>-E2E-<NNN>-filter-isTrusted
```

Exemples valides :
- `TC-UC06-E2E-03-filter-isTrusted`
- `TC-M7-E2E-01-filter-isTrusted`
- `TC-UC02-E2E-04-filter-isTrusted`

### 3.2 Exemple canonique : TC-UC06-E2E-03-filter-isTrusted

Fichier : `tests/e2e/uc06-react-dynamic-input.spec.ts`

```typescript
test(
  'TC-UC06-E2E-03-filter-isTrusted — form.submit() programmatique est filtré par M7',
  async () => {
    // ...setup...

    // Exception documentée : page.evaluate utilisé DÉLIBÉRÉMENT pour valider le filtre
    await page.evaluate(() => {
      const form = document.querySelector<HTMLFormElement>('#login-form');
      form?.submit(); // isTrusted=false → DOIT être filtré par M7 (ARB-UC02-01)
    });

    await page.waitForTimeout(800);

    // Assertion : M7 NE doit PAS avoir loggué "password submitted"
    const m7SubmitLogs = consoleLogs.filter((l) => l.includes('password submitted'));
    expect(m7SubmitLogs).toHaveLength(0);
  },
);
```

### 3.3 Commentaire obligatoire dans les exceptions

Tout usage de `page.evaluate()` pour soumettre un formulaire dans un test E2E doit être accompagné du commentaire :

```typescript
// TACHE-099 exception : ce test valide DÉLIBÉRÉMENT le filtre isTrusted (ARB-UC02-01)
// Ne pas reproduire ce pattern dans les tests qui visent à déclencher M7.
```

---

## 4. Checklist revue de code E2E

À utiliser lors de toute PR contenant un fichier `tests/e2e/**/*.spec.ts` ou `tests/e2e/**/*.test.ts`.

### 4.1 Checklist isTrusted (obligatoire)

- [ ] Chaque soumission de formulaire visant à déclencher M7 utilise `.click()` ou `.press('Enter')` via l'API Locator
- [ ] Aucun `page.evaluate(() => form.submit())` ni `form.requestSubmit()` dans un test de déclenchement M7
- [ ] Aucun `dispatchEvent(new Event('submit'))` dans un test de déclenchement M7
- [ ] Si `page.evaluate()` avec soumission est présent : le test porte le suffixe `-filter-isTrusted`
- [ ] Si le suffixe `-filter-isTrusted` est présent : le test contient le commentaire d'exception obligatoire (§3.3)
- [ ] Si le suffixe `-filter-isTrusted` est présent : l'assertion vérifie que M7 N'a PAS réagi (et non qu'il a réagi)

### 4.2 Checklist générale E2E (rappel)

- [ ] Le test utilise `page.locator()` et non `page.$()` (API dépréciée)
- [ ] Les `waitFor` ont un timeout explicite (pas de dépendance au timeout global seul)
- [ ] Le `afterEach` ferme le contexte Chrome et nettoie le répertoire temporaire
- [ ] Aucune donnée personnelle réelle dans les jeux de données (fixture)
- [ ] Le test passe en isolation (ordre indépendant)
- [ ] Les assertions couvrent le cas nominal ET au moins un cas d'erreur ou de rejet

---

## 5. Anti-patterns et pièges courants

### 5.1 Piège : page.fill() ne suffit pas, il faut aussi cliquer ou presser Enter

`page.locator('#password').fill('valeur')` remplit le champ mais ne soumet pas le formulaire. Sans `.click()` sur le bouton ou `.press('Enter')`, M7 ne reçoit jamais l'événement `submit` : le test passera sans que M7 ait été exercé.

```typescript
// PIÈGE — le formulaire n'est pas soumis
await page.locator('#password').fill('valeur');
// M7 n'a rien reçu ici

// CORRECT
await page.locator('#password').fill('valeur');
await page.locator('button[type="submit"]').click(); // Déclenche le submit event
```

### 5.2 Piège : page.evaluate() pour lire le storage est autorisé

La restriction porte sur la soumission de formulaire, pas sur la lecture du DOM ou du storage. Il est tout à fait correct d'utiliser `page.evaluate()` pour vérifier l'état après soumission :

```typescript
// AUTORISÉ — lecture du storage pour vérifier que M7 a stocké le hash
const storedData = await page.evaluate(async () => {
  return new Promise((resolve) => {
    chrome.storage.local.get(['lastPasswordHash'], resolve);
  });
});
```

### 5.3 Piège : keyboard.press('Enter') au niveau page n'est pas identique à locator.press('Enter')

`page.keyboard.press('Enter')` simule une frappe globale indépendamment du focus. Si le focus n'est pas sur le bon champ au moment de l'appel, l'événement n'atteint pas l'input password. Toujours utiliser `page.locator(sel).press('Enter')` qui garantit le focus préalable.

```typescript
// RISQUÉ — dépend du focus courant
await page.keyboard.press('Enter');

// CORRECT — focus + press garantis
await page.locator('#password').press('Enter');
```

### 5.4 Piège : isTrusted ne peut pas être forgé par du code JS

La propriété `event.isTrusted` est en lecture seule et ne peut pas être modifiée par du JavaScript, même via `Object.defineProperty`. Tout événement créé avec `new Event(...)` ou `new SubmitEvent(...)` aura `isTrusted=false` sans exception. Seul le navigateur lui-même peut créer des événements avec `isTrusted=true`.

```typescript
// NE FONCTIONNE PAS — isTrusted reste false
const evt = new Event('submit', { bubbles: true });
Object.defineProperty(evt, 'isTrusted', { value: true }); // ignoré par le runtime
form.dispatchEvent(evt); // toujours filtré par M7
```

### 5.5 Piège : inputs dynamiques (React/Vue/Angular) nécessitent waitFor avant fill()

Sur les SPA, l'input password peut ne pas exister au moment du `goto()`. Utiliser `waitFor` avant toute interaction, sinon Playwright lèvera une erreur de strict mode ou interagira avec un élément non encore rendu.

```typescript
// PIÈGE — peut échouer sur SPA si l'input est rendu de manière asynchrone
await page.goto(url);
await page.locator('#password').fill('valeur'); // Erreur possible si input pas encore là

// CORRECT
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.locator('#password').waitFor({ state: 'visible', timeout: 3000 });
await page.locator('#password').fill('valeur');
```

---

## 6. Références

| Référence | Nature | Lien |
|-----------|--------|------|
| TACHE-059 | Tâche | 12 scénarios TC-M7 (dépendant de cette règle) |
| TACHE-069 | Tâche | Implémentation UC-02 isTrusted filter + ARB-UC02-01 |
| TACHE-072 | Tâche | UC-05 MutationObserver (toggle show/hide password) |
| TACHE-073 | Tâche | UC-06 inputs dynamiques React + infra Playwright E2E (exemple canonique) |
| TACHE-082 | Tâche | Tests E2E UC-02 et UC-05 à implémenter |
| ARB-UC02-01 | Arbitrage | Décision de filtrer les submits isTrusted=false (comité revue code TACHE-069/072) |
| INFO-02 | Point comité | Comité revue code TACHE-069/072 — origine de cette règle |
| ADR-002 | Décision d'architecture | CROSS-LIFECYCLE-INTENT — intention cross-lifecycle, contexte M7 |
| `password-detector.ts` | Implémentation | `src/content-scripts/detectors/password-detector.ts`, fonction `handleFormSubmit()` ligne ~1183 |
| `uc06-react-dynamic-input.spec.ts` | Exemple canonique | `tests/e2e/uc06-react-dynamic-input.spec.ts` — TC-UC06-E2E-01/02/03 |
| `playwright.config.ts` | Configuration | Référence TACHE-099 en commentaire d'en-tête |
| W3C UIEvents spec | Norme | [Event.isTrusted](https://www.w3.org/TR/uievents/#dom-event-istrusted) — propriété read-only, `true` uniquement pour events natifs |
