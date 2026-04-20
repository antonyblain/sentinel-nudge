# Proces-verbal de recette manuelle — Sentinel Nudge v1

> **Statut** : GABARIT A REMPLIR par le Commanditaire pendant la session de recette.
>
> Ce fichier est un pre-remplissage du gabarit `docs/p5-recette/p5-protocole-recette-manuelle-v1.0.md` §11, prepare le 2026-04-20 pour eviter la recopie manuelle. Le Commanditaire renseigne les cases entre `[...]`, coche Pass/Fail/Skip, decrit les anomalies, puis signe.

---

## En-tete

| Champ                    | Valeur                                  |
| ------------------------ | --------------------------------------- |
| Date de recette          | 2026-04-20                              |
| Commanditaire            | Antony Blain (RSSI)                     |
| Testeur                  | Antony Blain                            |
| Version testee           | v1.0.0-rc                               |
| Commit SHA               | [a completer : git rev-parse --short HEAD au moment du build] |
| Build                    | [npm run build — date/heure a completer] |
| Chrome version           | [chrome://version — a completer]        |
| Profil Chrome            | Dedie recette (profil neuf)             |
| Extension chargee depuis | `C:\Dev\sentinel-nudge\dist`            |
| Environnement            | Windows 11 Home — local                 |

---

## Pre-conditions (checklist avant de commencer)

Cocher chaque pre-condition validee avant d'executer le moindre scenario (cf. protocole §4.2) :

- [ ] `npm run build` execute avec succes (`dist/` a jour)
- [ ] Extension chargee en mode developpeur dans Chrome (chrome://extensions)
- [ ] Profil Chrome dedie neuf (pas d'autre extension active)
- [ ] IndexedDB et chrome.storage.local vides (reset via DevTools > Application > Storage)
- [ ] Onboarding M1 complete dans le profil de test (configuration initiale validee)
- [ ] Comptes de test disponibles pour UC-01 (Google, Microsoft) et UC-02 (KeePassXC, Bitwarden, Vaultwarden) — sinon documenter Skip dans le PV
- [ ] Serveur local disponible pour UC-03 (iframes same-origin) — cf. protocole §7 pre-requis
- [ ] Devtools Console ouverts sur le Service Worker + onglet actif (pour logs)

---

## Recapitulatif des scenarios

Pour chaque scenario : remplacer `Pass / Fail / Skip` par **UN SEUL** des trois, puis renseigner les observations.

| ID Scenario | UC    | Priorite | Resultat           | Observations |
| ----------- | ----- | -------- | ------------------ | ------------ |
| SC-UC01-01  | UC-01 | P0       | Pass / Fail / Skip |              |
| SC-UC01-02  | UC-01 | P0       | Pass / Fail / Skip |              |
| SC-UC01-03  | UC-01 | P1       | Pass / Fail / Skip |              |
| SC-UC01-04  | UC-01 | P1       | Pass / Fail / Skip |              |
| SC-UC02-01  | UC-02 | P0       | Pass / Fail / Skip |              |
| SC-UC02-02  | UC-02 | P0       | Pass / Fail / Skip |              |
| SC-UC02-03  | UC-02 | P0       | Pass / Fail / Skip |              |
| SC-UC02-04  | UC-02 | P1       | Pass / Fail / Skip |              |
| SC-UC03-01  | UC-03 | P0       | Pass / Fail / Skip |              |
| SC-UC03-02  | UC-03 | P0       | Pass / Fail / Skip |              |
| SC-UC04-01  | UC-04 | P1       | Pass / Fail / Skip |              |
| SC-UC05-01  | UC-05 | P0       | Pass / Fail / Skip |              |
| SC-UC05-02  | UC-05 | P0       | Pass / Fail / Skip |              |
| SC-UC05-03  | UC-05 | P1       | Pass / Fail / Skip |              |
| SC-UC06-01  | UC-06 | P0       | Pass / Fail / Skip |              |
| SC-UC06-02  | UC-06 | P0       | Pass / Fail / Skip |              |
| SC-UC06-03  | UC-06 | P1       | Pass / Fail / Skip |              |

**Bilan global** (a completer en fin de session) :

| Critere            | Valeur                                              |
| ------------------ | --------------------------------------------------- |
| Scenarios P0       | [N Pass] / 12                                       |
| Scenarios P1       | [N Pass] / 5                                        |
| Scenarios P2       | — (aucun en periode v1)                             |
| Verdict release v1 | AUTORISEE / BLOQUEE                                 |

**Regle de verdict** (protocole §3) :

- **AUTORISEE** si et seulement si **tous les 12 scenarios P0** sont en Pass (Skip documente accepte uniquement si pre-condition impossible)
- **BLOQUEE** si au moins 1 scenario P0 en Fail OU en Skip non documente
- Anomalie P1 en Fail : release v1 possible si documentee + ticket TACHE cree dans BACKLOG.md

---

## Anomalies detectees

Si aucune anomalie : ecrire **"Aucune anomalie detectee"**.

Sinon, reproduire le bloc ci-dessous pour chaque incident.

### ID-INC-001

| Champ                 | Valeur                                         |
| --------------------- | ---------------------------------------------- |
| ID                    | ID-INC-001                                     |
| Scenario              | SC-UC0X-0Y                                     |
| Severite              | Critique / Majeur / Mineur / Cosmetique        |
| Titre court           | [Description en une ligne]                     |
| Steps de reproduction | 1. ... 2. ... 3. ...                           |
| Resultat observe      | [Ce qui se passe]                              |
| Resultat attendu      | [Ce qui devrait se passer]                     |
| Screenshot            | `docs/p5-recette/screenshots/ID-INC-001.png`   |
| Logs console SW       | [Extrait pertinent ou "voir fichier joint"]    |
| Ticket cree           | TACHE-[NNN] dans BACKLOG.md                    |

---

## Signatures

| Role          | Nom          | Date       | Signature |
| ------------- | ------------ | ---------- | --------- |
| Testeur       | Antony Blain | 2026-04-20 |           |
| Commanditaire | Antony Blain | 2026-04-20 |           |

---

## Notes de session

Espace libre pour toute observation transverse : duree totale, difficultes rencontrees, decisions de periode de recette, etc.

[A completer par le Commanditaire]
