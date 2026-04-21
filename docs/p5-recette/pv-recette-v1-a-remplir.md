# PV de recette manuelle — Sentinel Nudge v1

> **Gabarit generique** — copier sous le nom `pv-recette-v1-<YYYY-MM-DD>.md` avant chaque session, puis renseigner les champs.
> Protocole de reference : [`protocole-recette-manuelle-v2.0.md`](./protocole-recette-manuelle-v2.0.md) (TACHE-204, v2.0).

---

## En-tete

| Champ | Valeur |
| --- | --- |
| Date de recette | `YYYY-MM-DD` |
| SHA commit teste | `xxxxxxx` |
| Version build | `v1.0.0-rc.X` |
| Version Chrome | `1XX.X.XXXX.XX` |
| Testeur | `Prenom NOM` |
| Environnement | Extension chargee en mode developpeur (`chrome://extensions/`) |

---

## Pre-conditions (§4 du protocole)

Cocher chaque item avant de commencer :

- [ ] Extension chargee et activee (`chrome://extensions/`)
- [ ] Icone Sentinel visible dans la barre Chrome
- [ ] `chrome.storage.local` reinitialise (DevTools > Application > Clear site data)
- [ ] Aucune autre extension de gestion de mots de passe active
- [ ] `console` DevTools ouverte sur l onglet de test
- [ ] Connexion internet active (pour les sites de test en ligne)
- [ ] Profil Chrome vierge ou dedie aux tests
- [ ] Heure systeme correcte (impact sur TTL et quiz spaced-repetition)

---

## Recapitulatif des scenarios

### UC P0 — Bloquants release (12 scenarios)

| ID | Intitule | Priorite | Ref protocole | Resultat | Observations |
| --- | --- | --- | --- | --- | --- |
| TC-UC01-01 | Detection saisie mdp formulaire standard | P0 | §5 | Pass / Fail / Skip | |
| TC-UC01-02 | Detection mdp — React input ajoute dynamiquement | P0 | §5 | Pass / Fail / Skip | |
| TC-UC01-03 | Nudge affiche apres soumission | P0 | §5 | Pass / Fail / Skip | |
| TC-UC02-01 | Compatibilite LastPass autofill | P0 | §6 | Pass / Fail / Skip | |
| TC-UC02-02 | Compatibilite 1Password autofill | P0 | §6 | Pass / Fail / Skip | |
| TC-UC03-01 | Detection mdp dans iframe same-origin | P0 | §7 | Pass / Fail / Skip | |
| TC-UC03-02 | Pas de faux positif iframe cross-origin | P0 | §8 | Pass / Fail / Skip | |
| TC-UC05-01 | Toggle show/hide — detection persistante | P0 | §9 | Pass / Fail / Skip | |
| TC-UC05-02 | Toggle show/hide — pas de double nudge | P0 | §9 | Pass / Fail / Skip | |
| TC-UC06-01 | SPA React — input ajoute sans mutation | P0 | §10 | Pass / Fail / Skip | |
| TC-UC06-02 | SPA Vue — input ajoute dynamiquement | P0 | §10 | Pass / Fail / Skip | |
| TC-UC06-03 | Pas de faux positif champ texte SPA | P0 | §10 | Pass / Fail / Skip | |

### UC P1 — Non bloquants release (5 scenarios)

| ID | Intitule | Priorite | Ref protocole | Resultat | Observations |
| --- | --- | --- | --- | --- | --- |
| TC-UC04-01 | Limite documentee iframe cross-origin — message affiché | P1 | §8 | Pass / Fail / Skip | |
| TC-UC04-02 | Pas de crash extension sur iframe cross-origin | P1 | §8 | Pass / Fail / Skip | |
| TC-UC01-04 | Nudge accessible clavier (NVDA) | P1 | §5 + Annexe B | Pass / Fail / Skip | |
| TC-UC02-03 | Compatibilite Bitwarden autofill | P1 | §6 | Pass / Fail / Skip | |
| TC-UC06-04 | SPA Angular — input ajoute dynamiquement | P1 | §10 | Pass / Fail / Skip | |

### Modules M2/M3/M5/M6/M9/M17 (14 scenarios complementaires)

| ID | Module | Intitule | Priorite | Ref protocole | Resultat | Observations |
| --- | --- | --- | --- | --- | --- | --- |
| TC-M2-01 | M2 Typosquatting | Detection domaine proche | P1 | §11 | Pass / Fail / Skip | |
| TC-M2-02 | M2 Typosquatting | Faux positif domaine legitime | P1 | §11 | Pass / Fail / Skip | |
| TC-M2-03 | M2 Typosquatting | Nudge typosquatting affiche | P1 | §11 | Pass / Fail / Skip | |
| TC-M3-01 | M3 Score | Calcul score hebdomadaire | P1 | §12 | Pass / Fail / Skip | |
| TC-M3-02 | M3 Score | Affichage score popup | P1 | §12 | Pass / Fail / Skip | |
| TC-M5-01 | M5 MAJ nav. | Detection navigateur obsolete | P1 | §13 | Pass / Fail / Skip | |
| TC-M5-02 | M5 MAJ nav. | Nudge mise a jour affiche | P1 | §13 | Pass / Fail / Skip | |
| TC-M6-01 | M6 Quiz | Affichage question quiz | P1 | §14 | Pass / Fail / Skip | |
| TC-M6-02 | M6 Quiz | Logique spaced-repetition | P1 | §14 | Pass / Fail / Skip | |
| TC-M9-01 | M9 Force mdp | Detection saisie mdp faible | P1 | §15 | Pass / Fail / Skip | |
| TC-M9-02 | M9 Force mdp | Nudge force affiche | P1 | §15 | Pass / Fail / Skip | |
| TC-M17-01 | M17 Presse-papiers | Detection coller mdp | P1 | §16 | Pass / Fail / Skip | |
| TC-M17-02 | M17 Presse-papiers | Exclusion coller hors champ mdp | P1 | §16 | Pass / Fail / Skip | |
| TC-M17-03 | M17 Presse-papiers | Nudge clipboard affiche | P1 | §16 | Pass / Fail / Skip | |

---

## Bilan global

| Indicateur | Valeur |
| --- | --- |
| Total scenarios executes | X / 31 |
| P0 Pass | X / 12 |
| P0 Fail | X |
| P0 Skip (documente) | X |
| P1 Pass | X / 19 |
| P1 Fail | X |
| Anomalies detectees | X |

### Verdict release v1

- [ ] **AUTORISEE** — Tous les 12 scenarios P0 en Pass (Skip documente si pre-condition impossible)
- [ ] **BLOQUEE** — Au moins 1 scenario P0 en Fail ou Skip non documente

> **Motif si BLOQUEE** : _____________________________________________________________

---

## Anomalies detectees

Pour chaque anomalie, creer un ticket dans BACKLOG.md avec le type BUG.

| ID | Scenario | Description | Severite | Ticket BACKLOG |
| --- | --- | --- | --- | --- |
| INC-001 | | | P0 / P1 / P2 | TACHE-XXX |

_Ajouter des lignes si necessaire._

---

## Signatures

| Role | Nom | Date | Signature |
| --- | --- | --- | --- |
| Testeur QA | | `YYYY-MM-DD` | |
| Referent qualite | | `YYYY-MM-DD` | |
| Commanditaire | Antony Blain | `YYYY-MM-DD` | |

---

_Gabarit produit par TACHE-213 (2026-04-21). Ancres de reference : protocole-recette-manuelle-v2.0.md §5 a §16._
