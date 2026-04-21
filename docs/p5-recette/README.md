# Recette manuelle — Sentinel Nudge v1

> **Point d entree** : [`plan-de-tests-global-v1.0.md`](./plan-de-tests-global-v1.0.md) — vue exhaustive TU + TI + E2E + Manuel en un seul document.

## Contenu du dossier

| Fichier | Role |
| --- | --- |
| [`plan-de-tests-global-v1.0.md`](./plan-de-tests-global-v1.0.md) | **Point d entree** : vue d ensemble de toute la couverture tests (60 TU + 5 TI + 3 E2E + 31 scenarios manuels). Matrice par UC, par module, par NFR, par traitement RGPD. |
| [`protocole-recette-manuelle-v2.0.md`](./protocole-recette-manuelle-v2.0.md) | **Detail manuel** : protocole complet a derouler (2500L, 22 sections). 17 scenarios UC-01..06 (12 P0 + 5 P1) + 14 scenarios modules M2/M3/M5/M6/M9/M17 + commandes DevTools + 3 annexes (matrice providers, NVDA a11y, gabarit PV). |
| [`pv-recette-v1-a-remplir.md`](./pv-recette-v1-a-remplir.md) | **Gabarit signable** : copier sous `pv-recette-v1-<YYYY-MM-DD>.md` avant chaque session, renseigner les 31 scenarios Pass/Fail/Skip, signer. |
| [`archive/`](./archive/) | 7 fichiers consolides dans le master v2.0 (gardes pour tracabilite historique, dont `plan-tests-manuels-consolide-v1.0.md`). |

## Comment faire une session de recette

1. Lire `plan-de-tests-global-v1.0.md` — comprendre ce qui est couvert automatiquement vs manuellement.
2. Verifier que les tests automatises CI sont verts (`gh pr checks` ou `npm test`).
3. Ouvrir `protocole-recette-manuelle-v2.0.md` et lire la section §4 Methode (pre-conditions obligatoires + cycle executif).
4. Copier `pv-recette-v1-a-remplir.md` vers `pv-recette-v1-<date>.md`.
5. Completer l en-tete du PV : SHA commit, version Chrome, version build.
6. Derouler les scenarios dans l ordre des sections §5 a §16, noter Pass/Fail/Skip + observations.
7. A la fin : completer le bilan global, decrire les eventuelles anomalies, signer.
8. Archiver le PV rempli + le lier a une eventuelle release ou demande MEP.

## Regle de verdict release v1

Selon §3 du protocole :

- **AUTORISEE** si **tous les 12 scenarios P0** sont en Pass (Skip documente si pre-condition impossible).
- **BLOQUEE** si au moins 1 scenario P0 en Fail OU en Skip non documente.
- Anomalies P1 en Fail : release v1 possible si documentee + ticket TACHE cree dans BACKLOG.

## Fichiers connexes hors de ce dossier

| Fichier | Lien |
| --- | --- |
| Audit coherence transverse (T-205) | [`docs/gouvernance/audit-coherence-transverse-v1.0.md`](../gouvernance/audit-coherence-transverse-v1.0.md) |
| Regle E2E Playwright `event.isTrusted` | [`docs/p5-decisions/p5-regle-e2e-isTrusted-v1.0.md`](../p5-decisions/p5-regle-e2e-isTrusted-v1.0.md) |
| Mini-DAT UC-01 login multi-etape | [`docs/p5-decisions/p5-minidat-tache-068-uc01-login-multi-etape-v1.1.md`](../p5-decisions/p5-minidat-tache-068-uc01-login-multi-etape-v1.1.md) |
| Mini-DAT UC-03 iframes | [`docs/p5-decisions/p5-minidat-tache-070-uc03-iframes-v1.1.md`](../p5-decisions/p5-minidat-tache-070-uc03-iframes-v1.1.md) |
| Mini-DAT UC-05 toggle show/hide | [`docs/p5-decisions/p5-minidat-tache-072-toggle-show-hide-v1.1.md`](../p5-decisions/p5-minidat-tache-072-toggle-show-hide-v1.1.md) |
| Scenarios NVDA (source originale, copiee en Annexe B du master) | [`docs/accessibilite/captures/nvda/scenarios-nvda-v1.0.md`](../accessibilite/captures/nvda/scenarios-nvda-v1.0.md) |

## Historique

- **T-213** 2026-04-21 : ajout `plan-de-tests-global-v1.0.md` (pivot TU+TI+E2E+Manuel) + `pv-recette-v1-a-remplir.md` (gabarit generique sans date) + correction 4 refs mortes dans protocole v2.0.
- **v2.0** 2026-04-20 (TACHE-204) : consolidation 7 fichiers -> 1 master unique. Voir Annexe D du master.
- **v1.0** 2026-04-18 (TACHE-063) : creation du premier protocole formel (17 scenarios UC-01..06).
