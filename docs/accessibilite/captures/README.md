# Preuves brutes accessibilité — Sentinel Nudge

**Objet** : Archivage des preuves brutes d'audit accessibilité pour conformité RGAA 4.1 phase P7.
**Responsable** : Expert accessibilité
**Date de création** : 2026-04-19
**Référence** : T-180, checklist-accessibilite-v1.1.md §13 et §14

---

## Objet du répertoire

Ce répertoire contient les preuves brutes produites lors des audits d'accessibilité de Sentinel Nudge. Il n'est pas un livrable rédigé : c'est un entrepôt de données brutes (transcripts lecteur d'écran, sorties JSON axe-core) destiné à :

1. Constituer les pièces justificatives de la déclaration d'accessibilité RGAA 4.1 (P7)
2. Permettre la traçabilité des résultats d'audit dans le temps
3. Fournir une base de comparaison entre cycles d'audit successifs

---

## Structure

```
captures/
├── README.md                                      (ce fichier)
├── nvda/
│   ├── scenarios-nvda-v1.0.md                     (scénarios de test structurés)
│   ├── popup-aegis-light-2026-XX-XX.txt           (transcript NVDA — popup thème light)
│   ├── popup-midnight-obsidian-2026-XX-XX.txt     (transcript NVDA — popup thème dark)
│   ├── popup-cyberpunk-neon-2026-XX-XX.txt        (transcript NVDA — popup thème matrix)
│   ├── dashboard-aegis-light-2026-XX-XX.txt
│   ├── dashboard-midnight-obsidian-2026-XX-XX.txt
│   ├── dashboard-cyberpunk-neon-2026-XX-XX.txt
│   ├── options-aegis-light-2026-XX-XX.txt
│   ├── options-midnight-obsidian-2026-XX-XX.txt
│   ├── options-cyberpunk-neon-2026-XX-XX.txt
│   ├── onboarding-aegis-light-2026-XX-XX.txt
│   ├── onboarding-midnight-obsidian-2026-XX-XX.txt
│   └── onboarding-cyberpunk-neon-2026-XX-XX.txt
└── axe-core/
    ├── plan-archivage-v1.0.md                     (procédure d'extraction CI)
    └── 2026-XX-XX-rapport-12-combinaisons.json    (sortie axe-core 4 pages × 3 thèmes)
```

---

## Convention de nommage

### Transcripts NVDA

Format : `<page>-<theme>-<date>.txt`

| Segment | Valeurs possibles |
|---------|-------------------|
| `<page>` | `popup`, `dashboard`, `options`, `onboarding` |
| `<theme>` | `aegis-light`, `midnight-obsidian`, `cyberpunk-neon` |
| `<date>` | `YYYY-MM-DD` (ex. `2026-04-19`) |

Exemple : `popup-aegis-light-2026-04-19.txt`

### Sorties axe-core JSON

Format : `<date>-rapport-<scope>.json`

| Segment | Description |
|---------|-------------|
| `<date>` | `YYYY-MM-DD` |
| `<scope>` | description synthétique du périmètre testé |

Exemple : `2026-04-19-rapport-12-combinaisons.json`

---

## Periodicite et declencheurs

| Declencheur | Action requise |
|-------------|----------------|
| Avant chaque comite de recette P7 | Actualiser les transcripts NVDA et la sortie axe-core JSON |
| Changement majeur du design system (nouveaux tokens, nouveau theme) | Rejouer les scenarios NVDA + axe-core sur les pages impactees |
| Correction d'un ecart ACC-UI-xx (plan d'action §15 checklist v1.1) | Rejouer au minimum le scenario NVDA de la page corrigee |
| Nouvelle page UI interne ajoutee au perimetre | Ajouter les scenarios NVDA correspondants dans `nvda/scenarios-nvda-v1.0.md` |

---

## Statut versionne

Les fichiers de ce repertoire sont **versionnés dans Git**.

Justification : les preuves brutes constituent les pièces justificatives de la déclaration RGAA 4.1. Leur historique Git garantit la traçabilité des dates d'audit et l'immuabilité des résultats archivés.

Format retenu :
- Transcripts NVDA : `.txt` (format léger, diff lisible dans Git)
- Sorties axe-core : `.json` (format natif de l'outil, lisible en diff)
- Plans et scénarios : `.md` (format natif Fabrique)

---

## Qui produit ces preuves

| Preuve | Producteur |
|--------|-----------|
| Transcripts NVDA (`nvda/*.txt`) | Commanditaire ou contributeur externe disposant de NVDA installé sur Windows 11 — en suivant `nvda/scenarios-nvda-v1.0.md` |
| Sorties axe-core JSON (`axe-core/*.json`) | Développeur ou DevSecOps — en suivant `axe-core/plan-archivage-v1.0.md` |
| Scenarios et plan d'archivage (`*.md`) | Expert accessibilité |
