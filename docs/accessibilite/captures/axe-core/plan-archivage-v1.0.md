# Plan d'archivage axe-core — Sentinel Nudge

**Version** : 1.0
**Date** : 2026-04-19
**Référence** : T-180, TACHE-150, `tests/e2e/accessibility-themes.spec.ts`
**Responsable** : Expert accessibilité
**Destinataire** : Développeur / DevSecOps (T-XXX dérivée si besoin d'implémentation)

---

## 1. Contexte

Le test E2E `accessibility-themes.spec.ts` (TACHE-150) exécute axe-core sur 4 pages × 3 thèmes = 12 combinaisons. Les résultats sont actuellement loggués en stdout via `console.info(JSON.stringify(...))` lors des violations, et affichés en matrice de synthèse en fin de suite.

Ce plan décrit comment **extraire et archiver** ces résultats en fichier JSON versionné pour constituer les preuves RGAA 4.1 P7.

---

## 2. Etat actuel du test (TACHE-150)

Le test `accessibility-themes.spec.ts` :
- Accumule tous les résultats dans `allResults: AuditResult[]` (interface locale)
- Appelle `printSummaryMatrix(allResults)` dans `afterAll` — affichage console uniquement
- Ne produit aucun fichier de sortie persistant
- Les violations bloquantes (critical/serious) font échouer le test via `expect().toBe(0)`
- Les violations moderate/minor sont loggées mais ne bloquent pas

Structures de données disponibles :

```typescript
interface AuditResult {
  page: PageId;           // 'popup' | 'dashboard' | 'options' | 'onboarding'
  theme: Theme;           // 'light' | 'dark' | 'matrix'
  violations: ViolationRecord[];
  passed: boolean;
  blockers: ViolationRecord[];
}

interface ViolationRecord {
  id: string;             // ex. 'color-contrast'
  impact: string | null;  // 'critical' | 'serious' | 'moderate' | 'minor'
  description: string;
  nodes: number;
  helpUrl: string;
}
```

---

## 3. Methode d'archivage recommandee

### Option A — Ecriture dans afterAll (modification minimale du test)

Ajouter dans la fonction `afterAll` du test, après `printSummaryMatrix(allResults)` :

```typescript
import fs from 'fs';
import path from 'path';

// Dans afterAll, après printSummaryMatrix :
const outputPath = path.resolve(
  __dirname,
  '../../docs/accessibilite/captures/axe-core',
  `${new Date().toISOString().slice(0, 10)}-rapport-12-combinaisons.json`
);

const report = {
  generatedAt: new Date().toISOString(),
  buildRef: process.env['CI_COMMIT_SHA'] ?? 'local',
  scope: '4 pages × 3 themes = 12 combinaisons',
  rules: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
  summary: {
    total: allResults.length,
    passed: allResults.filter(r => r.passed).length,
    withViolations: allResults.filter(r => !r.passed).length,
    totalViolations: allResults.reduce((acc, r) => acc + r.violations.length, 0),
    totalBlockers: allResults.reduce((acc, r) => acc + r.blockers.length, 0),
  },
  results: allResults,
};

fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
console.info(`[A11Y] Rapport archivé : ${outputPath}`);
```

**Avantages** : modification minimaliste du test existant, pas de dépendance supplémentaire, réutilise les données déjà collectées.

**Contrainte** : le répertoire `docs/accessibilite/captures/axe-core/` doit exister avant l'exécution (il est créé par T-180).

### Option B — Reporter Playwright dédié

Configurer un reporter JSON dans `playwright.config.ts` ou un fichier de config dédié pour les tests E2E a11y :

```typescript
// playwright.config.ts (extrait)
reporter: [
  ['list'],
  ['json', { outputFile: 'docs/accessibilite/captures/axe-core/playwright-report.json' }],
],
```

**Avantages** : aucune modification du code de test, format standard Playwright.

**Inconvénient** : le rapport JSON Playwright contient les métadonnées de test (durée, statuts pass/fail) mais pas les violations axe-core structurées. Il faudrait parser le rapport pour extraire les `console.info` loggués. Moins lisible pour un auditeur RGAA.

**Recommandation** : Option A préférable pour la lisibilité des preuves RGAA.

---

## 4. Format JSON cible (exemple)

```json
{
  "generatedAt": "2026-04-19T10:00:00.000Z",
  "buildRef": "4612da1",
  "scope": "4 pages × 3 themes = 12 combinaisons",
  "rules": ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
  "summary": {
    "total": 12,
    "passed": 12,
    "withViolations": 0,
    "totalViolations": 0,
    "totalBlockers": 0
  },
  "results": [
    {
      "page": "popup",
      "theme": "light",
      "violations": [],
      "passed": true,
      "blockers": []
    },
    {
      "page": "popup",
      "theme": "dark",
      "violations": [],
      "passed": true,
      "blockers": []
    }
  ]
}
```

---

## 5. Integration CI

### 5.1 Workflow existant

Le workflow CI E2E (`.github/workflows/`) exécute `accessibility-themes.spec.ts` dans le job `e2e`. Si l'Option A est implémentée, le fichier JSON est écrit dans le répertoire de travail du runner.

### 5.2 Archivage en artifact CI (optionnel)

Pour conserver le rapport JSON en artifact GitHub Actions (sans le committer systématiquement) :

```yaml
# Dans le job e2e, après l'étape playwright :
- name: Archive rapport axe-core
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: axe-core-rapport-${{ github.run_id }}
    path: docs/accessibilite/captures/axe-core/*.json
    retention-days: 90
```

**Note** : l'artifact CI est utile pour le suivi quotidien. Le fichier JSON versionné dans Git est réservé aux points d'archivage formels (avant P7, après correction majeure).

### 5.3 Politique de commit des preuves

| Contexte | Action |
|----------|--------|
| Exécution CI quotidienne | Artifact CI uniquement — ne pas committer |
| Avant comité de recette P7 | Committer le JSON dans `axe-core/` avec message `docs(accessibilite): rapport axe-core 12 combinaisons YYYY-MM-DD` |
| Après correction d'un écart bloquant | Committer le JSON pour prouver la correction |

---

## 6. Prochaines etapes (proposition T-XXX)

Si le Commanditaire ou l'Orchestrateur souhaite implémenter l'Option A :

1. **Développeur** : modifier `tests/e2e/accessibility-themes.spec.ts` pour ajouter l'écriture JSON dans `afterAll`
2. **DevSecOps** : vérifier que le répertoire `docs/accessibilite/captures/axe-core/` est accessible en écriture dans le runner CI (pas de `.gitignore` bloquant)
3. **Développeur** : ajouter `--env CI_COMMIT_SHA=${{ github.sha }}` dans la commande Playwright CI pour tracer le commit dans le rapport
4. **Expert accessibilité** : valider le premier rapport JSON produit avant archivage

Effort estimé : 30 min développeur + 15 min DevSecOps.

---

## 7. Regles d'interpretation du rapport JSON

Un rapport JSON archivé est valide pour conformité RGAA 4.1 si :

| Critère | Seuil |
|---------|-------|
| `summary.totalBlockers` | 0 (zéro violation critical/serious) |
| `summary.passed` | 12/12 (zéro test en échec) |
| `summary.totalViolations` | Documenté — violations moderate/minor admises si tracées dans la checklist v1.1 §12 |
| `buildRef` | Correspond à un commit Git identifiable |
| `generatedAt` | Doit être antérieur à la date du comité de recette P7 |

---

## 8. Regles de nommage des fichiers archives

Rappel de la convention (README.md du répertoire) :

Format : `<date>-rapport-<scope>.json`

Exemples :
- `2026-04-19-rapport-12-combinaisons.json` — premier archivage formel
- `2026-05-15-rapport-12-combinaisons-post-correction-accui01-08.json` — après correction des 8 écarts Should
