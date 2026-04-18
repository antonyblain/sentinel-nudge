# Guide des briefs d'agents Fabrique — templates standardisés

**Version** : 1.0
**Date** : 2026-04-19
**Auteur** : Orchestrateur (Fabrique)
**Origine** : TACHE-139 — suite audit T-138 (oubli O-01) — capitalisation LL-028

---

## 1. Objet

Ce guide formalise les sections obligatoires à inclure dans **tout brief d'agent Fabrique lancé en worktree isolé background**, afin d'éviter les 4 classes d'erreurs identifiées sur la période 2026-04-17 → 2026-04-19 :

1. **Perte de livrable** quand l'agent n'a pas Bash (LL-028)
2. **Conflit de numéros TACHE** quand agents travaillent en parallèle
3. **Test plans avec checkboxes non cochées** polluant les PR post-merge (LL-029 suggérée par T-138 v1.1)
4. **Statuts BACKLOG non synchronisés** après merge (pattern détecté par T-138)

---

## 2. Matrice agents Fabrique — capacités Bash

| Agent | Tools disponibles | Peut git commit/push/PR ? | LL-028 applicable ? |
|---|---|:-:|:-:|
| Orchestrateur | `Read, Write, Bash, Grep, Glob, Skill` | ✅ Oui | Non |
| Architecte logiciel | `Read, Write, Bash, Grep, Glob` | ✅ Oui | Non |
| Architecte sécurité | `Read, Write, Bash, Grep, Glob` | ✅ Oui | Non |
| Développeur | `Read, Write, Bash, Grep, Glob` | ✅ Oui | Non |
| Testeur QA | `Read, Write, Bash, Grep, Glob` | ✅ Oui | Non |
| Intégrateur DevSecOps | `Read, Write, Bash, Grep, Glob` | ✅ Oui | Non |
| Assistant Git | `Read, Bash, Grep, Glob` | ✅ Oui | Non |
| **Analyste métier** | `Read, Write, Grep, Glob` | ❌ **Non** | ✅ **Oui** |
| **DPO** | `Read, Write, Grep, Glob` | ❌ **Non** | ✅ **Oui** |
| **Expert accessibilité** | `Read, Write, Grep, Glob` | ❌ **Non** | ✅ **Oui** |
| **Expert UX/UI** | `Read, Write, Grep, Glob` | ❌ **Non** | ✅ **Oui** |
| **Référent qualité** | `Read, Grep, Glob` | ❌ **Non** | ✅ **Oui** (+ pas de Write) |

---

## 3. Template de brief standard

### 3.1 Structure obligatoire

```markdown
Tu es le [Rôle] de la Fabrique pour Sentinel Nudge (niveau [POC/Personnel/Exposé]).
Tu dois réaliser TACHE-XXX : [titre].

## Contexte OBLIGATOIRE à charger
1. Lire `.claude/SESSION.md` + `.claude/BACKLOG.md` ligne TACHE-XXX
2. Lire `.claude/INSTRUCTIONS.md` intégral (I-001 à I-011)
3. Lire `.claude/LESSONS_LEARNED.md` LL-024/027/028 et `.claude/PROBLEMES.md` P-023
4. [Fichiers techniques spécifiques à la tâche]

## Tâche à réaliser
[Description précise du livrable attendu]

## [SECTION LL-028 si agent sans Bash]

## Étapes
[Liste numérotée des étapes]

## Rapport final ≤N mots
[Structure attendue du rapport]
```

### 3.2 Section LL-028 — template pour agents SANS Bash

**À copier-coller intégralement** dans tout brief d'un agent listé dans §2 comme « LL-028 applicable » :

```markdown
## LL-028 — Tu n'as PAS Bash (applicable à ton rôle)

Tu ne peux pas exécuter `git`, `npm`, `gh`, ni aucune commande shell. L'orchestrateur
s'en occupe. Ta responsabilité :

1. **Écris ton livrable** directement à son emplacement final dans le repo
   (relatif à ton worktree), pas dans un dossier temporaire. Exemple :
   `docs/p4-conception/mon-livrable-v1.0.md`, PAS `tmp/mon-livrable.md`.

2. **Dans ton rapport final**, donne le **chemin absolu** exact du/des fichier(s)
   produits dans ton worktree (format `C:\Dev\sentinel-nudge\.claude\worktrees\agent-<id>\...`).
   L'orchestrateur copiera le fichier vers le repo principal AVANT cleanup.

3. **Ne tente AUCUNE commande** `git commit/push/PR/checkout/add`. Si tu as besoin
   d'une information de repo (ex. dernier SHA), indique-le dans ton rapport —
   l'orchestrateur te la fournira.

4. **Ne documente pas de commandes Git à exécuter** dans ton rapport. L'orchestrateur
   suit le flux de commit standard.

**Règle d'or** : ton travail s'arrête à l'écriture du/des fichier(s) + rapport final.
```

### 3.3 Sections pour agents AVEC Bash

Pour les agents avec Bash (Dev, Testeur, DevSecOps, Architectes), inclure :

```markdown
## Étapes Git (I-007 flow Exposé)

1. `git checkout develop && git pull`
2. `git checkout -b feature/p5-tache-XXX-<slug-court>`
3. [Produire le livrable]
4. **Pré-commit obligatoire** (mémoire feedback_precommit_checks + I-009) :
   - `npm run format:check` (ou `npx prettier --write src/` si échec)
   - `npm run lint`
   - `npm run build`
   - `npm run test` — tous verts obligatoire
5. Commit au format Conventional Commits : `<type>(<scope>): TACHE-XXX <résumé>`
6. `git push -u origin feature/p5-tache-XXX-<slug-court>`
7. `gh pr create --base develop --title "..." --body "..."`
8. **Attendre CI verte (I-009)** via `gh pr checks <num>` polling jusqu'à SUCCESS
9. Rapport final
```

### 3.4 Anti-pattern test plan avec checkboxes

**À éviter** dans le corps des PR (LL-029) :

```markdown
## Test plan
- [ ] CI verte
- [ ] Tests passent
- [ ] Aucune régression
```

Raison : ces checkboxes restent visuellement non-cochées après merge (cf. audit T-140), GitHub ne coche pas automatiquement. Pollution visuelle des PR post-merge.

**Préférer** :

```markdown
## Validation (automatique via merge CI)
- CI verte requise avant merge (format + lint + build + test)
- Compteur tests attendu : 432/432
- 0 régression vs baseline 408 tests
```

Les checkboxes `[ ]` réelles ne doivent apparaître QUE pour des actions humaines post-merge (rare : ex. recette manuelle Commanditaire).

---

## 4. Checklist orchestrateur avant lancement d'agent

Avant chaque `Agent(subagent_type=..., isolation="worktree", run_in_background=True)` :

1. ☐ Identifié l'agent adéquat dans la matrice §2 ?
2. ☐ Zone de travail strictement disjointe des autres agents actifs ? (LL-022)
3. ☐ Section LL-028 incluse si agent sans Bash ? (§3.2)
4. ☐ Étapes Git incluses si agent avec Bash ? (§3.3)
5. ☐ Format rapport final précisé avec limite de mots ?
6. ☐ Contexte SESSION.md + BACKLOG.md + INSTRUCTIONS.md + LESSONS_LEARNED.md mentionné ?
7. ☐ TACHE BACKLOG correspondante existe et ID unique ?
8. ☐ Si numéros TACHE à créer par l'agent : préciser la plage d'IDs réservée (éviter conflits parallélisme) ?

---

## 5. Historique

| Version | Date | Modifications |
|---|---|---|
| v1.0 | 2026-04-19 | Création initiale — capitalise LL-028 + recommandations audit T-138 v1.1 |

---

*Guide à enrichir à chaque nouvelle leçon d'orchestration. Les prompts orchestrateur doivent s'appuyer sur ce guide comme source unique de vérité.*
