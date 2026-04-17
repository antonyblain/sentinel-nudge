# Runbook — Réponse à incident de sécurité

**Projet** : Sentinel Nudge
**Version** : 1.0
**Date** : 2026-04-17
**Auteur** : Architecte sécurité (Fabrique)
**Statut** : Actif — document opérationnel à suivre mécaniquement en cas d'incident
**Niveau de sensibilité** : Exposé
**Origine** : TACHE-110 (proposée en TACHE-075, validée par le Commanditaire)
**Contrôles ISO 27001:2022** : A.5.24 (préparation), A.5.26 (réponse), A.8.8 (vulnérabilités techniques)

---

## 1. Objectif et portée

### 1.1 Objectif

Ce runbook décrit la **procédure opérationnelle à suivre mécaniquement** lorsque le projet Sentinel Nudge reçoit, détecte ou soupçonne un incident de sécurité affectant son code source, ses artefacts publiés (Chrome Web Store) ou la confidentialité des données locales de ses utilisateurs.

Il est destiné au **mainteneur du projet** (Antony, RSSI) et à tout co-mainteneur futur. Il standardise la réponse pour :

1. **Éviter la gestion improvisée** sous la pression d'un signalement reçu.
2. **Respecter le SLA public** engagé dans `SECURITY.md` (30 jours maximum entre confirmation et publication du correctif).
3. **Garantir la transparence** attendue d'un projet open-source en s'alignant sur la divulgation coordonnée (Coordinated Vulnerability Disclosure — CVD).
4. **Capitaliser** chaque incident en règles permanentes (LESSONS_LEARNED.md) et en mesures durcies (RISQUES.md, ADR, référentiel ISO).

### 1.2 Portée — quand déclencher ce runbook

Déclencher ce runbook dès que l'un des évènements suivants survient :

| Déclencheur | Canal source |
|-------------|--------------|
| Rapport d'une vulnérabilité via **GitHub Security Advisories** (canal officiel, cf. `SECURITY.md`) | `github.com/antonyblain/sentinel-nudge/security/advisories` |
| Alerte Dependabot de sévérité **High** ou **Critical** sur une dépendance embarquée dans le bundle publié | Onglet Security du dépôt GitHub |
| Découverte interne d'une vulnérabilité exploitable pendant une revue de code, un audit ou un post-mortem | Post-mortem, revue de code, audit |
| Signalement Chrome Web Store (violation de politique, takedown, comportement malveillant suspecté) | Chrome Web Store Developer Dashboard |
| Suspicion de compromission du compte mainteneur, d'un PAT, ou du repository GitHub | GitHub security alerts, monitoring personnel |
| Découverte d'un secret exposé (clé API, token) dans un commit historique | `git-secrets`, `gitleaks`, alerte GitHub push protection |

**Ne pas déclencher ce runbook** pour : une erreur fonctionnelle non exploitable, un bug UX non lié à la sécurité, une question de licence ou de gouvernance open-source hors périmètre sécurité (ces cas suivent le flux BACKLOG standard).

### 1.3 Périmètre couvert

- Code source versionné (`src/`, `tests/`, `docs/`, `.github/`).
- Artefacts publiés : build ZIP uploadé au Chrome Web Store, SBOM CycloneDX, release GitHub.
- Dépendances embarquées dans le bundle final (transitive dependencies déclarées dans le SBOM).
- Données locales stockées par l'extension chez l'utilisateur final : `chrome.storage.local` (sel, clé AES-256-GCM, préférences), IndexedDB (`password_hashes`, `m7_incidents`, `m7_canary`).
- Processus de release (workflow GitHub Actions, signatures, publications Chrome Web Store).

**Hors périmètre** :
- Sécurité de l'infrastructure Chrome elle-même (Google responsable).
- Sécurité des navigateurs tiers où l'extension pourrait être portée ultérieurement (Firefox, Edge) — hors v1.
- Vulnérabilités dans des dépendances `devDependencies` non embarquées dans le bundle publié (Vite, Vitest, Playwright, ESLint) — traitées en BACKLOG standard Dependabot, sans activer ce runbook, sauf si exploitation supply chain avérée.

---

## 2. Rôles et responsabilités

Le projet est maintenu par une personne unique (Antony). Les rôles ci-dessous décrivent **des casquettes distinctes à porter mentalement** pour éviter les confusions et garantir la couverture de toutes les dimensions d'un incident. En phase de tabletop, ces rôles peuvent être joués par la même personne à des moments séquentiels.

| Rôle | Responsabilités | Porteur par défaut |
|------|-----------------|-------------------|
| **Incident Manager (IM)** | Coordonne l'incident de bout en bout. Décide de la sévérité, du SLA, du plan d'action, de la communication externe. Tient le journal de bord de l'incident. Prononce la clôture. | Antony (mainteneur / RSSI) |
| **Technical Lead (TL)** | Reproduit la vulnérabilité, analyse l'impact technique, développe le correctif, écrit les tests de régression, prépare la release. | Antony (développeur) |
| **Communications (COMM)** | Rédige les messages au reporter via GitHub Advisory thread, les release notes, la description CVE, les communications publiques (README, blog, réseaux). Coordonne la divulgation avec le reporter. | Antony (communications) |
| **Observer (OBS)** | Prend du recul, challenge la décision de sévérité, vérifie que le post-mortem est écrit, s'assure que la capitalisation en LESSONS_LEARNED est faite. Joue le rôle de contre-expertise méthodologique. Peut être délégué à un agent Fabrique (Architecte sécurité ou Référent qualité) via invocation Claude Code. | Architecte sécurité Fabrique (par délégation) |
| **DPO** | Évalué systématiquement pour tout incident touchant M7 ou confidentialité des données utilisateurs. Décide si une notification CNIL (72 h) et une notification utilisateurs sont requises. | DPO Fabrique (par délégation) |
| **Reporter** | Tiers ayant signalé la vulnérabilité. Sera crédité dans les release notes et la CVE (sauf refus explicite). | Externe |

### 2.1 Principe de séparation mentale

Même porté par une seule personne, **le rôle d'Incident Manager décide** ; le Technical Lead ne prend pas de décision de divulgation ; le Communications ne modifie pas le correctif. Cette séparation mentale évite les biais (ex : minimiser un impact pour accélérer la release).

En cas de doute sur une décision à fort enjeu (sévérité P0, notification utilisateurs, délai de publication), **invoquer un agent Fabrique** (Architecte sécurité, DPO ou Orchestrateur selon la dimension) pour obtenir un second regard écrit et tracé.

---

## 3. Classification de sévérité

La sévérité détermine le SLA, le canal de communication et le niveau d'urgence. Elle est prononcée par l'Incident Manager à l'étape de triage (Step 2) et peut être révisée en cours d'incident si de nouvelles informations émergent.

### 3.1 Grille de sévérité

| Sévérité | Définition | Exemples concrets Sentinel Nudge | SLA patch | CVSS 3.1 indicatif |
|----------|------------|----------------------------------|-----------|--------------------|
| **P0 — Critique** | Exploitation permet de compromettre la confidentialité des données sensibles utilisateur (hashes M7, mots de passe réels reconstructibles) ou de porter atteinte à l'intégrité du produit distribué. Exploitation à distance sans interaction utilisateur ou avec interaction minimale. | Bypass crypto M7 permettant la dérivation du mot de passe source depuis `password_hashes` ; exfiltration des hashes via XSS dans une page privilégiée ; compromission de la supply chain (build Chrome Web Store remplacé) ; secret maintainer exposé ; vulnérabilité dans code M7 (tout incident M7 = P0 automatique). | **7 jours** | 9.0 — 10.0 |
| **P1 — Élevée** | Vulnérabilité exploitable mais à impact fonctionnel ou scope limité. Ne compromet pas directement les hashes M7 mais affecte l'intégrité d'autres stores ou permet une escalade de privilèges limitée. | XSS dans un content script non-M7 ; prototype pollution exploitable via le storage ; dépendance critique avec CVE active exploitable dans notre contexte (ex : vulnérabilité dans une lib de parsing utilisée par M2) ; contournement de la whitelist M2 par injection. | **14 jours** | 7.0 — 8.9 |
| **P2 — Modérée** | Faiblesse defense-in-depth sans exploitation directe démontrée, ou exploitation conditionnée à des prérequis forts (machine déjà compromise, attaquant local privilégié). | Absence de CSP renforcée sur une page d'options ; HSTS non vérifié sur une URL secondaire ; logs débug verbeux contenant des URLs (sans plaintext) ; fuite de métadonnées non corrélables ; Dependabot High sur devDependency. | **30 jours** | 4.0 — 6.9 |
| **P3 — Informationnelle** | Hardening informatif, meilleure pratique non encore appliquée, ou vulnérabilité théorique sans vecteur d'exploitation dans notre contexte. | Usage de `SHA-1` dans un test unitaire fixture ; commentaire de code mentionnant un chemin interne ; dépendance dev avec CVE non exploitable dans notre bundle. | Best effort — prochaine release mineure | 0.1 — 3.9 |

### 3.2 Règle de montée automatique

- **Tout incident touchant le module M7** (hashes de mots de passe, canary, clé AES-256-GCM, registre `m7_incidents`) est **P0 automatique**, quelle que soit la première évaluation technique. Motivation : M7 est le seul actif contenant un indicateur dérivable d'un secret réel utilisateur (cf. AIPD M7 v1.0 section 2.3).
- **Tout incident impliquant une donnée à caractère personnel** ou un risque CNIL déclenche automatiquement la **saisine du DPO** (cf. section 2.1).
- **Tout incident sur la supply chain de release** (workflow compromis, secret PAT fuité, build CWS modifié post-CI) est **P0 automatique** jusqu'à preuve du contraire.

### 3.3 Règle de descente

Une sévérité **ne peut être descendue qu'après reproduction et analyse d'impact documentées**, et avec la mention écrite dans le journal d'incident de l'Incident Manager. Jamais par défaut.

---

## 4. Timeline de réponse par sévérité

La timeline ci-dessous mesure les délais **depuis la réception du signalement initial** (ou la détection interne). Elle respecte le SLA public de 30 jours maximum pour P0 à P2 inscrit dans `SECURITY.md`.

| Jalon | P0 — Critique | P1 — Élevée | P2 — Modérée | P3 — Info |
|-------|---------------|-------------|--------------|-----------|
| **Accusé de réception (Step 1)** | 1 jour ouvré | 2 jours ouvrés | 5 jours ouvrés | 5 jours ouvrés |
| **Triage sévérité confirmé (Step 2)** | 2 jours ouvrés | 5 jours ouvrés | 10 jours ouvrés | 15 jours ouvrés |
| **Reproduction et analyse d'impact (Step 3)** | 3 jours ouvrés | 7 jours ouvrés | 15 jours ouvrés | Best effort |
| **Correctif développé et testé (Steps 4 à 6)** | 5 jours | 10 jours | 21 jours | Prochaine release mineure |
| **Préparation disclosure coordonnée (Step 7)** | 6 jours | 12 jours | 25 jours | N/A |
| **Release publiée + disclosure publique (Steps 8 et 9)** | **7 jours max** | **14 jours max** | **30 jours max** | Best effort |
| **Post-mortem écrit (Step 10)** | 14 jours après release | 21 jours après release | 30 jours après release | Non obligatoire |

**Règle d'embargo minimal** : jamais de disclosure publique avant que la release correctrice ne soit **publiée sur le Chrome Web Store et propagée aux utilisateurs** (compter 24 à 72 h de délai Chrome Web Store review). La CVE est publiée **dès que le reporter a confirmé la publication**.

**Règle d'embargo maximal** : si le reporter demande un embargo supérieur à 90 jours sans justification technique (dépendance tierce non patchée par son mainteneur), l'Incident Manager arbitre en faveur de la publication à 90 jours. Motivation : alignement avec les pratiques Project Zero et Disclose.io.

---

## 5. Procédure pas à pas

Cette procédure se lit de haut en bas, étape par étape. Chaque étape est un bloc auto-suffisant : pré-conditions, actions, livrables, critère de sortie. **Cocher chaque case au fur et à mesure dans le journal d'incident.**

### Step 1 — Accuser réception (SLA 1 à 5 jours ouvrés)

**Pré-condition** : un rapport vient d'arriver via GitHub Security Advisory.

**Actions** :

- [ ] Ouvrir le thread de l'advisory sur `github.com/antonyblain/sentinel-nudge/security/advisories`.
- [ ] Créer le journal d'incident local (fichier privé) : `docs/securite/incidents/YYYYMMDD-advisory-GHSA-XXXX-XXXX-XXXX.md` **à ne pas committer tant que la divulgation n'est pas publique**. Ce fichier trace toutes les décisions horodatées.
- [ ] Noter dans le journal : date/heure réception, identifiant reporter (nom GitHub ou pseudonyme choisi), titre du rapport, résumé 2 lignes.
- [ ] Répondre au reporter via le thread Advisory avec le template 6.1 (Accusé de réception).
- [ ] Si le signalement vient d'un canal non conforme (email privé, Twitter DM, issue publique) : **rediriger immédiatement vers la création d'une Security Advisory** et supprimer/rendre privée la trace publique si possible (edit issue, `git push --force-with-lease` sur commit accidentel) puis notifier GitHub Support pour une purge de cache.

**Livrable** : message d'accusé de réception publié dans le thread Advisory + première ligne du journal d'incident.

**Critère de sortie** : le reporter a un retour sous 24 h ouvrées (P0) à 5 jours ouvrés (P2/P3).

### Step 2 — Triager la sévérité (SLA 2 à 15 jours ouvrés)

**Pré-condition** : Step 1 complétée.

**Actions** :

- [ ] Lire le rapport complet, identifier le module affecté (M2, M3, M5, M6, M7, M9, M17) ou composant transverse (SW boot, factory logger, build pipeline).
- [ ] Appliquer la grille de sévérité section 3.1. **En cas de doute entre deux niveaux, choisir le plus sévère**.
- [ ] Appliquer les règles de montée automatique section 3.2 (M7 = P0, donnée personnelle = DPO, supply chain = P0).
- [ ] Calculer un CVSS 3.1 indicatif via le calculator FIRST ([https://www.first.org/cvss/calculator/3.1](https://www.first.org/cvss/calculator/3.1)). Noter le vecteur complet dans le journal.
- [ ] Si **P0 et touche M7** : invoquer l'Architecte sécurité et le DPO (Fabrique) pour double validation écrite de la sévérité dans le journal.
- [ ] Si **P0 supply chain** : considérer la possibilité d'un yank release préventif (retrait Chrome Web Store) en attendant correctif.
- [ ] Confirmer la sévérité au reporter via le thread Advisory (template 6.2 si info manquante nécessaire).
- [ ] Mettre à jour le champ "Severity" de la GitHub Advisory (Critical / High / Medium / Low).

**Livrable** : sévérité prononcée, CVSS calculé, entrée journal datée.

**Critère de sortie** : la sévérité est écrite dans le journal et communiquée au reporter.

### Step 3 — Reproduire et confirmer (SLA 3 à 15 jours ouvrés)

**Pré-condition** : Step 2 complétée.

**Actions** :

- [ ] Préparer un environnement isolé : worktree ou VM dédiée (**jamais sur le poste de développement principal** si exploit réel manipulé).
- [ ] Checkout la version affectée : `git checkout v<version>` (la version du Chrome Web Store publiée au moment du rapport).
- [ ] Build local : `npm ci && npm run build`.
- [ ] Charger l'extension en dev mode dans un Chrome profil jetable.
- [ ] Suivre les steps-to-reproduce du rapport.
- [ ] Documenter dans le journal : capture d'écran (sans données personnelles), logs pertinents, confirmation ou infirmation.
- [ ] Si reproduction échoue : demander info complémentaire via template 6.2.
- [ ] Si reproduction confirmée : écrire un **test de régression échouant** dans `tests/unit/` ou `tests/e2e/` (branche privée, cf. Step 4). Ce test doit être rouge maintenant et vert après correctif.
- [ ] Analyser l'impact : combien d'utilisateurs concernés ? Quelles versions affectées ? Exploitation active observée (indicateurs dans `m7_incidents` ?) ?

**Livrable** : confirmation de reproduction dans le journal + test de régression `.fail.test.ts` (à renommer après fix).

**Critère de sortie** : la vulnérabilité est reproduite **ou** infirmée. En cas d'infirmation, fermer l'advisory avec motif "not reproducible" et remercier le reporter.

### Step 4 — Créer une branche privée (immédiat après Step 3)

**Pré-condition** : vulnérabilité confirmée.

**Règle de confidentialité du correctif** : les correctifs de sécurité **ne transitent jamais par la branche `develop` publique** avant publication de la release et de la disclosure. Sinon, un attaquant peut surveiller `develop` et weaponiser la vulnérabilité avant que les utilisateurs ne soient patchés (effet "silent patch" connu).

**Actions** :

- [ ] Dans la GitHub Advisory, cliquer **"Start a temporary private fork"**. GitHub crée un fork privé auquel seuls le mainteneur, les collaborateurs de l'advisory et le reporter (s'il est ajouté) ont accès.
- [ ] Cloner le fork privé localement : `git clone <url-fork-privé>`.
- [ ] Créer la branche de correctif : `git checkout -b security/advisory-GHSA-XXXX-XXXX-XXXX`.
- [ ] Ne pas pousser cette branche vers le repository public `antonyblain/sentinel-nudge`.
- [ ] Noter dans le journal l'URL du fork privé.

**Alternative si impossible (multi-fix coordonnés)** : créer une branche **locale non poussée** pendant toute la durée du développement, pousser uniquement au moment du merge final (Step 9) directement sur `develop` puis `main`.

**Livrable** : fork privé créé + branche `security/advisory-*` initialisée.

**Critère de sortie** : l'espace de travail du correctif est isolé du repository public.

### Step 5 — Développer le correctif (SLA 5 à 21 jours selon P)

**Pré-condition** : Step 4 complétée.

**Actions** :

- [ ] Analyser la root cause : la vulnérabilité est-elle un cas particulier ou le symptôme d'une classe plus large ? (Précédent : P-016 fail silent / P-018 serialization → ADR-001 + ADR-002 généralisés.)
- [ ] Concevoir le correctif minimal : défensif d'abord (atténuation), puis correctif structurel dans un second commit si pertinent.
- [ ] Si le correctif révèle qu'un **ADR existant est enfreint** ou qu'un **nouvel ADR est nécessaire**, produire l'ADR dans la même branche.
- [ ] Coder le correctif en respectant les règles INV-SEC (pas de plaintext en logs, pas de champs libres en `IncidentContext`, factory logger).
- [ ] Écrire les tests unitaires couvrant la vulnérabilité : le test de régression du Step 3 passe désormais au vert ; ajouter des tests négatifs (fuzzing, inputs malformés) si pertinent.
- [ ] Vérifier localement : `npm run format:check && npm run lint && npm run build && npm run test`.
- [ ] **Tests E2E Playwright obligatoires** sur les flux affectés (`npm run test:e2e`).
- [ ] Mettre à jour `CHANGELOG.md` dans la branche privée (ligne "Security" en tête de la release).

**Livrable** : correctif commité sur `security/advisory-*` + tests verts localement.

**Critère de sortie** : tous les checks locaux passent (format, lint, build, 294 Vitest unit/integration, 3 E2E Playwright minimum sur flux M7 + UC concerné).

### Step 6 — Tests de régression complets (SLA 5 à 21 jours selon P)

**Pré-condition** : Step 5 complétée.

**Actions** :

- [ ] Lancer la suite complète Vitest : `npm run test` — doit rapporter **294 passing minimum** (au 2026-04-17) sans régression.
- [ ] Lancer la suite E2E Playwright : `npm run test:e2e` — **3 scénarios E2E minimum** (UC-02 typosquatting, UC-05 M7, UC-06 inputs dynamiques) doivent passer.
- [ ] Si P0/P1 sur M7 : ajouter un scénario E2E spécifique vérifiant le comportement corrigé (ex : injection plaintext rejetée, canary régénéré, etc.).
- [ ] Vérifier que le SBOM CycloneDX n'introduit pas de nouvelle dépendance vulnérable : `npm run sbom` (ou équivalent workflow CI).
- [ ] Noter dans le journal : couverture ligne/branche du module patché, nombre de tests ajoutés, résultat E2E.

**Livrable** : rapport de tests dans le journal (screenshots ou copie de la sortie Vitest/Playwright).

**Critère de sortie** : 0 test échoué, 0 régression détectée, SBOM clean.

### Step 7 — Préparer la CVE et les release notes (SLA 6 à 25 jours selon P)

**Pré-condition** : Step 6 complétée.

**Actions** :

- [ ] Dans la GitHub Security Advisory, remplir le formulaire **"Request CVE"** (GitHub est CNA autorité — la CVE sera assignée automatiquement après publication).
- [ ] Rédiger la description CVE avec le template 6.4 (courte, factuelle, sans PoC exploitable).
- [ ] Identifier les versions affectées : "affected : >=X.Y.Z, <A.B.C" ; "patched : A.B.C".
- [ ] Préparer les release notes avec le template 6.3 : section **"Security"** en tête, crédits reporter (sauf refus), référence CVE, lien advisory.
- [ ] Préparer la communication Chrome Web Store : note dans le champ "Update notes" pour accélérer la review Google si P0.
- [ ] Si impact utilisateur (données personnelles compromises, action attendue de l'utilisateur) : préparer une communication in-app via un `NudgeCard` spécial et un README update — **valider avec DPO** avant diffusion.

**Livrable** : description CVE, release notes, communications pré-rédigées.

**Critère de sortie** : tous les éléments de communication sont prêts, relus, et stockés dans la GitHub Advisory (non publiés).

### Step 8 — Coordonner la publication avec le reporter (SLA J-1 avant release)

**Pré-condition** : Step 7 complétée.

**Actions** :

- [ ] Envoyer au reporter via le thread Advisory : date prévue de release, résumé du fix, texte des release notes, description CVE proposée, crédit prévu.
- [ ] Demander : **(a)** validation du crédit (nom ou pseudonyme ou anonyme) ; **(b)** accord sur la date de disclosure ; **(c)** relecture de la description CVE.
- [ ] Attendre le retour du reporter (P0 : 24 h ; P1 : 48 h ; P2/P3 : 72 h). En cas de non-réponse passé ce délai, documenter la relance unique puis **procéder à la disclosure** sans son retour (embargo n'est pas un droit de veto perpétuel).
- [ ] Intégrer ses retours si pertinents.

**Livrable** : accord reporter (ou date dépassée documentée) + version finale de la comm.

**Critère de sortie** : go/no-go final prononcé par l'Incident Manager pour la release.

### Step 9 — Merge, release, publication CVE (jour de disclosure)

**Pré-condition** : Step 8 complétée, go prononcé.

**Actions** (dans l'ordre strict) :

- [ ] Depuis le fork privé, ouvrir une PR **directement vers `main`** du repo public (branche `security/advisory-*` → `main`), **ou** merger localement la branche privée sur `develop` puis promouvoir `develop` → `main` via la procédure standard si le flux interne le permet sans délai.
- [ ] Exécuter une dernière fois la CI sur la PR : `gh pr checks <numéro>`. Attendre vert.
- [ ] Merger la PR (squash merge si la branche contient plusieurs commits de correction).
- [ ] Bump de version : `npm version patch` (ou `minor` si changement d'API), push du tag.
- [ ] Déclencher le workflow de release GitHub : `.github/workflows/release.yml`.
- [ ] Uploader le build ZIP au Chrome Web Store Developer Dashboard. **Cocher "Expedited review"** si P0 (Google peut accélérer la review pour fixes sécurité documentés).
- [ ] Dès confirmation de publication Chrome Web Store (compter 24 à 72 h) :
  - [ ] Publier la GitHub Advisory (passage de "Draft" à "Published").
  - [ ] Publier la CVE via le bouton "Request CVE" si pas déjà fait.
  - [ ] Publier la release GitHub avec les release notes (template 6.3).
  - [ ] Notifier le reporter via le thread Advisory : "Published, thank you".
  - [ ] Poster un message public court sur le README / blog / réseaux si P0 (optionnel P1-P2).

**Livrable** : release publiée, advisory publique, CVE assignée.

**Critère de sortie** : les utilisateurs ont accès au correctif via Chrome Web Store autoupdate.

### Step 10 — Post-mortem écrit (SLA 14 à 30 jours après release)

**Pré-condition** : Step 9 complétée, incident clos.

**Actions** :

- [ ] Rédiger le post-mortem selon la grille section 8 dans `docs/gouvernance/gouvernance-pv-postmortem-sec-YYYYMMDD-vX.X.md`.
- [ ] Commit le post-mortem sur `develop` (le post-mortem est public par défaut — un projet OSS communique en transparence). Masquer uniquement les PoC exploitables et les IoC sensibles.
- [ ] Capitaliser dans `.claude/LESSONS_LEARNED.md` : nouvelles règles permanentes, patterns à éviter, invariants à renforcer.
- [ ] Mettre à jour `.claude/RISQUES.md` : créer ou clôturer les entrées R-XXX correspondantes.
- [ ] Mettre à jour `docs/securite/referentiel-iso27001.md` : si de nouvelles mesures sont permanentes, les tracer dans les fiches A.5.24/A.5.26 ou A.8.8.
- [ ] Mettre à jour `.claude/BACKLOG.md` : créer les tâches de remédiation long terme identifiées (correctifs defense-in-depth, tests à généraliser).
- [ ] Si pertinent, produire un nouvel ADR (format `docs/adr/adr-XXX-*.md`) pour capturer une décision architecturale dérivée.
- [ ] Archiver le journal d'incident local dans `docs/securite/incidents/` (maintenant public, PoC retirés).

**Livrable** : PV post-mortem committé + fichiers de mémoire Fabrique mis à jour.

**Critère de sortie** : LESSONS_LEARNED enrichi, RISQUES à jour, incident clôturé dans le journal.

---

## 6. Templates de communication

### 6.1 Template — Accusé de réception (GitHub Advisory)

```markdown
Hi @<reporter>,

Thank you for reporting this potential security issue via GitHub Security Advisories.
Your report has been received on YYYY-MM-DD and is now being triaged under advisory GHSA-XXXX-XXXX-XXXX.

Next steps on our side:
- Initial triage and severity assessment: <target date per SLA section 4>
- Reproduction in an isolated environment: <target date>
- You will hear back from me before <target date> with either (a) a severity confirmation and a tentative fix timeline, or (b) a request for additional information.

Our public vulnerability disclosure policy is in SECURITY.md. In summary, we commit to:
- Acknowledging reports within 5 business days (done).
- Publishing a fix within 30 days of confirmation, coordinated with you.
- Crediting you in the release notes and CVE (unless you prefer to remain anonymous — please let me know).

Please keep this thread as the single channel of communication about this issue.
Do not share details publicly until the coordinated disclosure date.

Thank you again for your responsible disclosure.

— Antony, maintainer of Sentinel Nudge
```

### 6.2 Template — Demande d'information complémentaire

```markdown
Hi @<reporter>,

Thank you for the initial report. To progress the triage, I would need the following additional details:

1. **Environment**: Chrome version, OS, extension version (visible in chrome://extensions).
2. **Reproduction steps**: a numbered, step-by-step reproduction from a freshly installed extension, including any specific timing or state.
3. **Impact assessment from your side**: what you believe an attacker can achieve with this vulnerability, and under what prerequisites.
4. **(Optional) PoC**: a minimal proof-of-concept if you have one, attached as a private file to this advisory thread (please do not post it on public channels).

If any of the above cannot be provided, let me know what you can share and I will work with what is available.

— Antony
```

### 6.3 Template — Release notes "Security fix"

```markdown
## vA.B.C — YYYY-MM-DD

### Security

- **Fix**: <one-line description of the vulnerability, no PoC>. Affected versions: `>=X.Y.Z, <A.B.C`. Patched in `A.B.C`.
  - Severity: **<P0/P1/P2>** (CVSS 3.1: `<score>` — `<vector>`)
  - CVE: [CVE-YYYY-NNNNN](https://nvd.nist.gov/vuln/detail/CVE-YYYY-NNNNN)
  - Advisory: [GHSA-XXXX-XXXX-XXXX](https://github.com/antonyblain/sentinel-nudge/security/advisories/GHSA-XXXX-XXXX-XXXX)
  - Credit: @<reporter> for the responsible disclosure (or "An independent security researcher" if reporter prefers anonymity).
  - User action required: **<none | update via Chrome Web Store autoupdate | specific instructions>**

### Other changes
<non-security changes that shipped in the same release, if any>
```

### 6.4 Template — Description CVE

```
Title: <Component / Module> <vulnerability class> in Sentinel Nudge

Description:
Sentinel Nudge (browser extension) versions `>=X.Y.Z, <A.B.C` are affected by a <vulnerability class> in the <component> module. An attacker with <prerequisites> could <impact>. The issue has been fixed in version A.B.C, released on YYYY-MM-DD.

Affected versions: >=X.Y.Z, <A.B.C
Patched versions: A.B.C
Severity: <Critical / High / Medium / Low>
CVSS 3.1: <score> (<vector>)
CWE: CWE-<NNN> <name>

References:
- https://github.com/antonyblain/sentinel-nudge/security/advisories/GHSA-XXXX-XXXX-XXXX
- https://github.com/antonyblain/sentinel-nudge/releases/tag/vA.B.C

Credit: <reporter> via GitHub Security Advisories.
```

### 6.5 Template — Notification utilisateurs (si action requise)

À utiliser uniquement si **P0 avec compromission confirmée des données locales utilisateur** ou si une action manuelle est requise (ex : réinitialiser le store M7).

```markdown
# Security Notice — Sentinel Nudge vA.B.C

Date: YYYY-MM-DD
Severity: Critical (P0)
CVE: CVE-YYYY-NNNNN

## Summary
A critical vulnerability in Sentinel Nudge was fixed in version A.B.C. All users running versions `>=X.Y.Z, <A.B.C` are affected.

## User action required
Please update to version A.B.C via Chrome Web Store autoupdate (usually automatic within 24 hours).
**Additionally, please perform the following manual action:**
<specific instructions, e.g., clear the M7 password hashes store via extension options>.

## Was my data exposed?
<factual answer based on impact analysis — do not speculate>

## What we are doing to prevent recurrence
<brief statement referencing the post-mortem URL once published>

Questions: please open a standard (non-security) GitHub issue.
```

---

## 7. Outils et ressources

### 7.1 Canaux officiels

| Outil | URL | Usage |
|-------|-----|-------|
| GitHub Security Advisories | `https://github.com/antonyblain/sentinel-nudge/security/advisories` | Canal unique officiel de réception et de gestion des vulnérabilités |
| GitHub Dependabot | Onglet Security du repo | Alertes et PR automatiques sur dépendances vulnérables |
| Chrome Web Store Developer Dashboard | `https://chrome.google.com/webstore/devconsole/` | Upload, review, takedown, communication Google |
| NVD / MITRE CVE | `https://nvd.nist.gov`, `https://cve.mitre.org` | Consultation des CVE publiées, références tierces |
| CVSS Calculator v3.1 (FIRST) | `https://www.first.org/cvss/calculator/3.1` | Calcul du score CVSS indicatif |
| CWE catalog | `https://cwe.mitre.org` | Classification normalisée des classes de vulnérabilité |

### 7.2 Ressources internes projet

| Ressource | Chemin | Usage |
|-----------|--------|-------|
| Politique de signalement | `SECURITY.md` (racine) | Document public vu par les reporters |
| Référentiel ISO 27001 | `docs/securite/referentiel-iso27001.md` | Fiches A.5.24, A.5.26, A.8.8 |
| ADR-001 SW-BOOT-CONTRACT | `docs/adr/adr-001-sw-boot-contract.md` | Classe "fail silent at boot" (CWE-252, CWE-755) |
| ADR-002 CROSS-LIFECYCLE-INTENT | `docs/adr/adr-002-cross-lifecycle-intent.md` | Résilience aux frontières de cycle de vie (CWE-502) |
| AIPD M7 v1.0 | `docs/p3-architecture/p3-aipd-m7-v1.0.md` | Impact vie privée du module M7 — à consulter pour tout incident M7 |
| Registre des risques | `.claude/RISQUES.md` | 27+ risques projet, à enrichir au Step 10 |
| Lessons learned | `.claude/LESSONS_LEARNED.md` | Capitalisation post-incident |
| Backlog | `.claude/BACKLOG.md` | Tâches de remédiation long terme |
| Post-mortem M7 | `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md` | Précédent référent — structure et niveau de détail attendus |
| Dashboard CI | `https://github.com/antonyblain/sentinel-nudge/actions` | Vérification `format:check + lint + build + test + e2e` |

### 7.3 Dépendances critiques à surveiller

Ces dépendances sont particulièrement sensibles car elles participent à la chaîne de confiance M7 ou SW boot :

- **@noble/hashes** (ou équivalent) — primitives SHA-256 utilisées pour `domain_hash` M7.
- **Web Crypto API** (runtime Chromium, pas une npm dep) — AES-256-GCM M7.
- **idb** ou accès direct `indexedDB` — store `password_hashes` et `m7_incidents`.
- **Chrome Runtime Manifest V3** — service worker lifecycle, `chrome.storage.local`.

Toute CVE publiée sur ces composants déclenche un triage prioritaire (P1 minimum).

---

## 8. Post-mortem — grille imposée

Tout incident P0 ou P1 produit un post-mortem écrit. Les P2 font l'objet d'un post-mortem synthétique (sections 1, 2, 4, 6, 8 seulement). Les P3 ne nécessitent pas de post-mortem formel.

**Fichier** : `docs/gouvernance/gouvernance-pv-postmortem-sec-YYYYMMDD-vX.X.md`

### Grille de rédaction (sections obligatoires)

1. **En-tête** : CVE, GHSA, sévérité, CVSS, dates clés (réception, confirmation, release, disclosure), reporter (ou anonyme).
2. **Que s'est-il passé ?** — Récit factuel chronologique, sans jargon, sans jugement. Timeline horodatée des évènements clés.
3. **Comment a-t-on détecté ?** — Canal de signalement, durée de présence de la vulnérabilité avant détection (code archaeology : `git blame` sur les lignes patchées), nombre de releases affectées.
4. **Quel a été l'impact ?** — Analyse scope : combien d'utilisateurs, quels modules, quelles données. Exploitation active observée ? Indicateurs forensiques dans `m7_incidents` ou logs utilisateurs remontés ?
5. **Quelles corrections techniques ?** — Liste des commits, des tests ajoutés, des ADR produits ou mis à jour. Lien vers la PR (publique post-release).
6. **Quelles améliorations process ?** — Ce qui a bien fonctionné dans la réponse, ce qui a raté, délai réel vs SLA. Si SLA dépassé, analyser la cause.
7. **Dettes techniques révélées** — Vulnérabilités adjacentes non exploitées mais du même pattern, ouvertes en tâches BACKLOG. Lier chaque dette à un identifiant R-XXX ou TACHE-XXX.
8. **Capitalisation** — Règles permanentes à ajouter dans LESSONS_LEARNED.md, invariants à renforcer (INV-SEC-XX), contrôles ISO à faire monter en maturité.

### Principe de rédaction

Suivre le modèle du post-mortem M7 v1.0 : factuel, horodaté, orienté système (blameless). **Ne jamais pointer une personne** ; toujours analyser le système qui a laissé passer la vulnérabilité (code review, tests manquants, absence d'ADR, invariant non écrit).

---

## 9. Exercices — Tabletop annuels

Un runbook non exercé s'atrophie. Le projet s'engage à pratiquer **au minimum un tabletop annuel**, idéalement deux.

### 9.1 Cadence proposée

| Date cible | Exercice | Scénario |
|------------|----------|----------|
| Avril (anniversaire du projet) | Tabletop P0 M7 | Signalement fictif : "bypass du typage `IncidentContext` permettant d'injecter des mots de passe en plaintext dans `m7_incidents`" |
| Octobre (pré-release annuelle majeure) | Tabletop P1 supply chain | Signalement fictif : "CVE critical sur une devDependency migrée en runtime dependency accidentellement" |

### 9.2 Format

- Durée : 90 minutes.
- Participants : mainteneur + (par délégation Fabrique) Architecte sécurité, DPO, Orchestrateur.
- Livrable : PV `docs/gouvernance/gouvernance-pv-tabletop-YYYYMMDD-vX.X.md` avec chronométrage réel de chaque étape du runbook, écart vs SLA théorique, points d'amélioration.
- Déclencheur d'actions : chaque écart détecté ouvre une entrée BACKLOG (amélioration du runbook, du tooling, des templates).

### 9.3 Premier tabletop

**Cible** : T+3 mois après publication de ce runbook, soit **juillet 2026**. Scénario pilote : signalement fictif d'une XSS dans un content script UC-06.

---

## 10. Références

### 10.1 Standards et cadres

- **ISO/CEI 27001:2022 Annexe A** — contrôles A.5.24 (Information security incident management planning and preparation), A.5.26 (Response to information security incidents), A.8.8 (Management of technical vulnerabilities).
- **ISO/CEI 27035:2023** — Information security incident management (cadre conceptuel du cycle incident).
- **NIST SP 800-61 Rev. 3** — Computer Security Incident Handling Guide (preparation, detection, containment, eradication, recovery, post-incident).
- **CERT/CC Guide to Coordinated Vulnerability Disclosure** — pratique de référence pour la CVD en open-source.
- **Disclose.io** — policy template et pratiques reporter-friendly.
- **FIRST CVSS v3.1** — scoring normalisé.
- **MITRE CWE Top 25** — classification des classes de faiblesse.

### 10.2 Documents projet

- `SECURITY.md` (racine) — politique publique de signalement.
- `docs/securite/referentiel-iso27001.md` — fiches détaillées A.5.24 (§4.8), A.5.26 (§4.8), A.8.8 (§4.2).
- `docs/adr/adr-001-sw-boot-contract.md` — classe CWE-252 / CWE-755.
- `docs/adr/adr-002-cross-lifecycle-intent.md` — classe CWE-502.
- `docs/p3-architecture/p3-aipd-m7-v1.0.md` — impact vie privée M7.
- `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md` — post-mortem de référence, 2026-04-14.
- `.claude/RISQUES.md` — registre des risques projet (R-M7-xx, R-ADR-xx).
- `.claude/LESSONS_LEARNED.md` — règles permanentes.

### 10.3 Historique du document

| Version | Date | Auteur | Changements | Sources |
|---------|------|--------|-------------|---------|
| 1.0 | 2026-04-17 | Architecte sécurité (Fabrique) | Initialisation — runbook complet aligné A.5.24/A.5.26/A.8.8 ; SLA 7j/14j/30j cohérent avec SECURITY.md ; 10 steps procéduraux ; 5 templates de communication ; grille post-mortem ; cadence tabletop annuelle. | TACHE-110 (validée par Commanditaire), `docs/securite/referentiel-iso27001.md` §4.2 et §4.8, post-mortem M7 v1.0, ADR-001, ADR-002. |
