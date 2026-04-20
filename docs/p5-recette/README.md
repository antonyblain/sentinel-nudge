# Recette manuelle — Sentinel Nudge v1

> **Source unique de verite** pour la recette manuelle : [`protocole-recette-manuelle-v2.0.md`](./protocole-recette-manuelle-v2.0.md).

## Contenu du dossier

| Fichier                                                          | Role                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`protocole-recette-manuelle-v2.0.md`](./protocole-recette-manuelle-v2.0.md) | **Fichier unique a derouler** (2500L, 22 sections). 17 scenarios UC-01..06 (12 P0 + 5 P1) + 6 chapitres modules M2/M3/M5/M6/M9/M17 + commandes DevTools + 3 annexes (matrice providers, NVDA a11y, gabarit PV) |
| [`pv-recette-v1-2026-04-20-a-remplir.md`](./pv-recette-v1-2026-04-20-a-remplir.md) | Gabarit PV pre-rempli a copier/renommer a chaque session de recette (`pv-recette-v1-YYYY-MM-DD.md`) et a signer |
| [`archive/`](./archive/)                                         | 7 fichiers consolides dans le master v2.0 (garde pour tracabilite historique) |

## Comment faire une session de recette

1. Ouvrir `protocole-recette-manuelle-v2.0.md` et lire la section §4 Methode (pre-conditions obligatoires + cycle executif).
2. Copier `pv-recette-v1-2026-04-20-a-remplir.md` vers `pv-recette-v1-<date>.md` (sauf si on est le 2026-04-20).
3. Completer l'en-tete du PV : SHA commit, version Chrome, version build.
4. Derouler les scenarios dans l'ordre des sections §5 a §16, noter Pass/Fail/Skip + observations.
5. A la fin : completer le bilan global, decrire les eventuelles anomalies, signer.
6. Archiver le PV rempli + le lier a une eventuelle release ou demande MEP.

## Regle de verdict release v1

Selon §3 du protocole :

- **AUTORISEE** si **tous les 12 scenarios P0** sont en Pass (Skip documente si pre-condition impossible).
- **BLOQUEE** si au moins 1 scenario P0 en Fail OU en Skip non documente.
- Anomalies P1 en Fail : release v1 possible si documentee + ticket TACHE cree dans BACKLOG.

## Fichiers connexes hors de ce dossier

| Fichier                                                           | Lien                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Regle E2E Playwright `event.isTrusted`                            | [`docs/p5-decisions/p5-regle-e2e-isTrusted-v1.0.md`](../p5-decisions/p5-regle-e2e-isTrusted-v1.0.md) |
| Mini-DAT UC-01 login multi-etape                                  | [`docs/p5-decisions/p5-minidat-tache-068-uc01-login-multi-etape-v1.1.md`](../p5-decisions/p5-minidat-tache-068-uc01-login-multi-etape-v1.1.md) |
| Mini-DAT UC-03 iframes                                            | [`docs/p5-decisions/p5-minidat-tache-070-uc03-iframes-v1.1.md`](../p5-decisions/p5-minidat-tache-070-uc03-iframes-v1.1.md) |
| Mini-DAT UC-05 toggle show/hide                                   | [`docs/p5-decisions/p5-minidat-tache-072-toggle-show-hide-v1.1.md`](../p5-decisions/p5-minidat-tache-072-toggle-show-hide-v1.1.md) |
| Scenarios NVDA (source originale, copiee en Annexe B du master)   | [`docs/accessibilite/captures/nvda/scenarios-nvda-v1.0.md`](../accessibilite/captures/nvda/scenarios-nvda-v1.0.md) |

## Historique

- **v2.0** 2026-04-20 (TACHE-204) : consolidation 7 fichiers -> 1 master unique. Voir Annexe D du master.
- **v1.0** 2026-04-18 (TACHE-063) : creation du premier protocole formel (17 scenarios UC-01..06).
