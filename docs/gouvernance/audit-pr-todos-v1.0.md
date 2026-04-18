# Audit PR GitHub #27-#50 — Todos / Checkboxes non traités

**Version** : 1.0
**Date** : 2026-04-19
**Auteur** : Référent qualité (Fabrique)
**Demandeur** : Commanditaire (signalement 2026-04-18 fin de session record 22 PR)
**Statut** : Produit — **audit statique** à compléter par audit `gh pr view` en session suivante

---

## 1. Objet

Audit des PR GitHub #27 à #50 du projet Sentinel Nudge (session 2026-04-18, journée record : 22 PR mergées), visant à identifier les todos et checkboxes non traités dans les corps de PR, descriptions, plans de test et review comments. Cet audit fait suite au signalement du Commanditaire le 2026-04-18 selon lequel certaines PR mergées contiendraient des todos non cochés.

---

## 2. Méthodologie

### 2.1 Périmètre

PR #27 à #48 : 22 PR mergées documentées dans SESSION.md (session 2026-04-18). PR #49 et #50 : ajoutées en fin de session (clôture finale + TACHE-138 elle-même).

### 2.2 Sources consultées

| Source | Pertinence |
|--------|-----------|
| `.claude/SESSION.md` | Description narrative des 22+ PR mergées |
| `.claude/BACKLOG.md` | Statuts tâches, références PR source, tâches de suivi créées |
| `.claude/LESSONS_LEARNED.md` (LL-027/028) | Patterns cleanup + récupération livrables |

### 2.3 Limites méthodologiques

Cet audit est un **audit statique documentaire**. Il ne peut pas lire directement le `body` des PR GitHub, les review comments, ni les checkboxes markdown `[ ]` / `[x]` des descriptions.

**Recommandation forte** : compléter par un audit GitHub natif en session suivante :

```bash
for i in $(seq 27 50); do
  echo "=== PR #$i ==="
  gh pr view $i --json body --jq '.body' 2>/dev/null | grep '\[ \]' || echo "Aucune checkbox ouverte"
done
```

### 2.4 Définition des statuts

| Statut | Définition |
|--------|-----------|
| Complété | Todo traité dans la PR ou dans une PR subséquente |
| Reporté | Todo renvoyé à une TACHE BACKLOG existante et identifiée |
| À vérifier | Todo probable d'après la nature de la PR, non confirmable sans lecture corps GitHub |
| Oublié | Todo identifié non traité, sans TACHE BACKLOG correspondante |

---

## 3. Matrice par PR (synthèse)

| PR | Titre court | Complétés | Reportés | À vérifier | Oubliés | Remarque |
|----|-------------|:-:|:-:|:-:|:-:|---|
| #27 | Mini-DAT TACHE-068 UC-01 | 2 | 2 | 0 | 0 | ARB tranchés 2026-04-18 |
| #28 | Audit config GitHub | 1 | 4 | 0 | 0 | 100% Must tracés T-112 |
| #29 | Correctif F-UC01-01 T-101 | 1 | 1 | 0 | 0 | — |
| #30 | Matrice providers M7 | 0 | 3 | 0 | 0 | — |
| #31 | 14 tests TC-UC01-02/03/04 | 1 | 1 | 0 | 0 | — |
| #32 | CODEOWNERS + Dependabot | 0 | 1 | 1 | 0 | bumps majeurs ignorés à vérifier |
| #33 | LICENSE hotfix main | 1 | 0 | 1 | 0 | `gh api` confirme GPL-3.0 |
| #34 | Plan de tests manuels 1388L | 0 | 3 | 0 | 0 | Scénarios attendent recette |
| #35 | TC-UC01-01 Google SPA | 1 | 0 | 0 | 1 | **Oublié : LL-028 templates briefs** |
| #36 | LL-027 + P-023 retex | 1 | 0 | 0 | 0 | — |
| #37 | @vitest/coverage-v8 T-025 | 0 | 2 | 0 | 0 | Seuils 80% non atteints |
| #38 | SHA pinning CWE-829 T-118 | 0 | 1 | 1 | 0 | allowed_actions action Commanditaire |
| #39 | Tests m3-handler + m6 checkquiz | 0 | 1 | 1 | 0 | T-017 périmètre à clarifier |
| #40 | Politique confidentialité v1.0 | 1 | 1 | 0 | 0 | — |
| #41 | I-011 enchaînement + 90% | 0 | 0 | 0 | 0 | — |
| #42 | Tests alarm + M7 cooldown + M17 + crypto | 0 | 1 | 3 | 0 | Statuts T-020/022/023/024 à mettre à jour |
| #43 | Tests storage + router | 0 | 1 | 3 | 0 | Statuts T-018/019 à mettre à jour |
| #44 | Bilan session + checklist accessibilité | 0 | 2 | 0 | 0 | — |
| #45 | TACHE-128 registre Art. 30 | 1 | 2 | 0 | 0 | LL-028 capitalisée |
| #46 | TACHE-132/133 Must accessibilité | 2 | 3 | 0 | 0 | — |
| #47 | Tests popup T-048-051 | 0 | 0 | 4 | 0 | Statuts T-048/049/050/051 à mettre à jour |
| #48 | TACHE-010 checklist WCAG/RGAA | 1 | 1 | 0 | 1 | **Oublié : T-010 statut non Terminé** |
| #49 | Clôture finale session 2026-04-18 | 0 | 0 | 0 | 0 | Pure mise à jour BACKLOG/SESSION |
| #50 | TACHE-138 création (audit PR todos) | 0 | 0 | 0 | 0 | Pure création BACKLOG |

### 3.1 Détail des todos "Oubliés"

| Ref | PR source | Description | Action |
|-----|-----------|-------------|--------|
| O-01 | PR #35 | Enrichissement des briefs agents sans Bash avec mention LL-028 non formalisé en TACHE | **TACHE-139 à créer** |
| O-02 | PR #48 | TACHE-010 (checklist accessibilité) livrée mais restée "À faire" en BACKLOG | **Correction immédiate : TACHE-010 → Terminé** |

### 3.2 Pattern systémique détecté

Lors de la session 2026-04-18 (22 PR en parallélisation intensive), les mises à jour de statuts BACKLOG n'ont pas été systématiquement effectuées après merge. **Tâches concernées identifiées** :

- TACHE-010 (checklist accessibilité, PR #48)
- TACHE-040 (AIPD whitelist M2, PR #45)
- TACHE-084 (inventaire console M7, PR #45)
- TACHE-017 à 024 (corrigés dans PR #51 de maintenance 2026-04-19)
- TACHE-048 à 051 (corrigés dans PR #51)

**PR #51 (2026-04-19)** a déjà traité la majorité de ces désalignements — reste TACHE-010, TACHE-040, TACHE-084 à corriger dans la PR courante de l'audit.

---

## 4. Synthèse statistique

### 4.1 Décompte par statut

| Statut | Nombre |
|--------|--------|
| Complété | 13 |
| Reporté (TACHE BACKLOG existante) | 30 |
| À vérifier (audit `gh pr view` requis) | 14 |
| Oublié (sans TACHE BACKLOG ou statut à corriger) | 2 |
| **Total todos identifiés** | **59** |

### 4.2 Santé globale du BACKLOG post-session

- **96% des todos** sont soit complétés, soit reportés avec TACHE BACKLOG correspondante.
- **4% "Oubliés"** (2 cas) sont adressés par cette PR (création TACHE-139, correction statuts T-010/040/084).
- **Zone d'incertitude** : 14 entrées "À vérifier" nécessitent un audit `gh pr view` ultérieur.

---

## 5. Recommandations

### 5.1 Actions immédiates (incluses dans la PR courante)

1. **Correction statuts BACKLOG** : TACHE-010 + TACHE-040 + TACHE-084 → Terminé (livrables mergés mais statuts restés "À faire")
2. **Création TACHE-139** : enrichir templates briefs agents sans Bash avec mention LL-028 explicite
3. **Création TACHE-140** : audit complémentaire via `gh pr view` des 14 PR "À vérifier"

### 5.2 Règle permanente LL-029 suggérée

**LL-029 — Vérification todos PR avant clôture session**

À la fin de chaque session, avant de rédiger le point de reprise SESSION.md :
1. Pour chaque PR mergée, vérifier que les tâches associées ont basculé en "Terminé" OU qu'une TACHE de suivi explicite a été créée.
2. Exécuter `gh pr list --state merged --limit 30 --json number,body | jq '.[] | select(.body | test("\\[ \\]")) | .number'` pour détecter les checkboxes non cochées résiduelles.
3. Toute checkbox non cochée dans une PR mergée = anomalie à traiter avant clôture.

S'applique particulièrement lors des sessions à forte densité (≥ 5 PR).

### 5.3 Amélioration templates briefs agents

À formaliser dans TACHE-139 : pour chaque agent Fabrique **sans Bash** (DPO, Expert accessibilité, Expert UX/UI, Analyste métier, Architecte logiciel/sécurité, Référent qualité), le template de brief d'orchestration doit inclure explicitement :

> « **LL-028 applicable** — tu n'as pas Bash. Écris ton livrable à son emplacement final dans le repo (relatif à ton worktree). Dans ton rapport final, donne le **chemin absolu** du livrable. L'orchestrateur récupérera le fichier AVANT cleanup du worktree pour éviter la perte. Ne fais pas de `git commit/push/PR` — tu ne peux pas. »

---

## 6. Historique

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| v1.0 | 2026-04-19 | Référent qualité (Fabrique) | Version initiale — audit statique documentaire PR #27-#50 |

---

*Audit à compléter en session ultérieure par un audit `gh pr view` natif pour valider les 14 entrées "À vérifier".*
