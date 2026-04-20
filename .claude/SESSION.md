# SESSION — État courant du projet

## Fil rouge (narration courte)

**Où on en est (session 2026-04-20 jour — cycle clôture MEP v1.0 + refonte UI + fix bugs recette).** Consigne Commanditaire « enchaine jusqu'à finir tâches résiduelles ou 95% session ». **~18 agents lancés en 6 vagues**, 15 livrés CI verte, 3 stalls kill/relance (pattern LL-034 respecté).

**Livrables majeurs cycle jour** :
- **Migration tests legacy T-189 finalisée** (6 lots) : M7, M2/M3/M6, M5, M9/M17, background, password-detector (lots 1+2) = ~20 fichiers tests migrés vers wrapper mock-chrome-storage T-060, zéro régression, 1046 tests suite complète
- **3 réserves DPO bloquantes MEP v1.0 levées** (PV formel 2026-04-20) : T-158 assertNoDomainHashInContext + T-159 TTL 365j purgeOldEntries + T-160 exclusion m7_incidents export. PR #144 + #145 + PV `docs/rgpd/pv-levee-reserves-dpo-r074-v1.0.md` (PR #154)
- **Petits livrables orchestrateur direct** : T-029 doc MIGRATIONS IDB v2, T-054 obsolète cleanup, T-055 launch.json vers .vscode/ (PR #160 groupée)
- **Audit a11y maquettes T-145** (PR #155) : 20 anomalies dont 7 critiques transversales (contraste `--fg-subtle` <4.5:1, landmarks HTML5 manquants, toggles div inaccessibles clavier)
- **Enrichissement SFD §2.M7 v1.2.1** (PR #149) : intégration ARB-061-01/02/03 depuis §9 addendum → corps §2.5.6/7/8, conflit add/add résolu par reset+cherry-pick
- **Cleanup Option A** (PR #148) : -11572 lignes designs obsolètes v2 + thèmes v3 non retenus + logo-propositions + vectorize.cjs + registre-v1.0 + p4prime-tests
- **BACKLOG cleanup** (PR #153) : 28 lignes manquantes T-092/T-161-186/T-188 ajoutées + 15 statuts périmés à jour + 4 lignes vides parasites supprimées. **193 IDs T-001 à T-193 sans gap**
- **5 BUGs recette Commanditaire tracés** : T-197 bouton radio toggle module (FIX livré PR #169), T-198 bascule FR/EN sans effet, T-199 coins popup non arrondis, T-200 baseline Brand Book (FIX livré PR #168), T-201 CTA "Tableau de bord" court (FIX livré PR #168)
- **3 tâches refonte UI tracées** : T-194/195/196 (propositions Claude Design Paramètres+Dashboard + décliner thèmes sombres + renommer Matrix → Cyber Punk)
- **3 tâches UI tracées** : T-200/201/202 ajustements popup (baseline/CTA/bouton "Voir la liste de confiance")

**PR mergées cycle jour (estimation ~20-25)** : T-189 lots multiples + T-060 + T-063 + T-064 + T-076 + T-078 + T-082 + T-096 + T-097 + T-102 + T-103 + T-120 + T-145 + T-158/159 + T-160 + T-164 + T-167 + T-191/192/193 + T-042 + T-043 + T-067 + T-080+T-081 + T-109 + T-117 + hotfix prettier + session bilans + BACKLOG cleanup + T-194/195/196 trace + T-197/198/199 BUGs trace + T-200/201/202 UI trace + T-197 FIX + T-200/201 FIX.

**4 nouvelles mémoires auto capitalisées** :
- `feedback_demarrage_session_cible` — lecture ciblée SESSION.md limit:60, pas intégrale
- `feedback_prettier_claude_files` — `.prettierignore` exclut `.claude/*.md`
- `feedback_discipline_pr` — 1 PR SESSION par session, pas intermédiaires
- `feedback_agents_no_patch_scripts` — agents Edit/Write, pas scripts patch
- `feedback_dpo_verification_code_avant_pv` — DPO grep code + PR MERGED avant PV levée
- `feedback_agent_volume_max` — briefs ≤1500L + monitoring 15 min, kill si stall

**Stalls observés cycle jour (4 sur ~18 agents)** : password-detector initial (9 fichiers 4378L), M5/M9/M17 premier tour, BACKLOG cleanup (28 lignes à reconstruire), T-194 Claude Design (kill volontaire car mauvais modèle). Tous rattrapés par kill/relance avec briefs plus petits (règle LL-034). Les re-tentatives ont livré CI verte dès la 1ère tentative.

**Discipline respectée** :
- LL-022 2 agents max initial, relaxé sur consigne explicite « parallélise au max »
- LL-031 détecté 6 fois (HEAD déplacée par agents), 0 commit errone (git branch --show-current systématique)
- LL-033 `.prettierignore` effectif sur `.claude/*.md`
- LL-034 briefs ≤1500L + monitoring actif

**État Phase P5** : **~95% Must v1.0 couverts**. Restent :
- T-145 audit a11y : livré, 20 anomalies à corriger → tâches filles à créer
- T-198 BUG i18n FR/EN → à fixer prochaine session
- T-199 BUG coins popup → à fixer prochaine session
- T-202 bouton "Voir la liste de confiance" → implémentation à faire
- Arbitrage Commanditaire T-194 (2 propositions Claude Design nouvelle session, brief fourni)

## 🔜 Point de reprise prochaine session

1. **Vérifier convergence ~25 PR en file auto-merge** — develop doit recevoir tous les livrables du cycle
2. **Arbitrage Claude Design** T-194+T-195 (6 propositions Paramètres/Dashboard × 3 thèmes × 2 variantes structurelles) — brief fourni pour nouvelle session dédiée
3. **Brief Claude Design T-203** 6 variantes thématiques alternatives (3 thèmes × 2) — fourni en fin de session
4. **FIX BUG restants** : T-198 i18n FR/EN + T-199 coins popup (2 fixes rapides)
5. **T-202** implémenter bouton "Voir la liste de confiance" (whitelist M2 UI)
6. **Tâches filles T-145** : créer 7 sous-tâches critiques audit a11y (contraste, landmarks, toggles clavier)
7. **T-196** renommage taxonomique Matrix → Cyber Punk (tokens + i18n + dossier design)
8. **Exécuter recette manuelle T-063** sur 6 UC P0 avant MEP v1.0

---

**Où on en est (session 2026-04-19 soir — cycle parallélisation agents Fabrique, ~19h00-21h10).** Session reprise sur consigne Commanditaire « parallélise plusieurs tâches, il faut qu'on avance de façon importante » puis prolongée en autonomie (Commanditaire au match de foot) jusqu'à ~95% budget session. **8 agents Fabrique lancés en 3 vagues successives sur zones disjointes** (LL-022 respecté — 2 agents simultanés max), **tous livrés CI 6/6 dès la première tentative** (aucune régression, aucune itération auto-correction).

**Tâches livrées (8 agents + 1 orchestrateur + 2 hotfix)** :

*Vague 1 (4 agents)* :
- **T-059** 12 scénarios TC-M7-01 à TC-M7-12 (32 tests unitaires + intégration) — PR #123
- **T-060** Wrapper mock `chrome.storage.local` JSON-strict + simulation quota + SW lifecycle (55 tests, 310L) — PR #124
- **T-064** Filtre `autocomplete="new-password"` M7 (UC-07/UC-08, 15 tests + correctif TC-UC01-04-B) — PR #125
- **T-078** Instrumenter `storage_write_fail` aux 4 sites critiques (SW boot ×2, m7-handler pending_m7_toast, heartbeat-service write) + 6 tests — PR #126 **mergée**

*Vague 2 (1 agent)* :
- **T-063** Protocole recette manuelle v1.0 (601L, 17 scénarios G/W/T UC-01 à UC-06, gabarit PV signé) — PR #127 **mergée**

*Vague 3 (3 agents, session autonome foot)* :
- **T-076** Test d'intégration boot-sequence canary_reinit (CM-EOP1 OBS-01, 6 tests 639L, fake-indexeddb) — PR #129 **mergée**
- **T-082** 5 scénarios SM-01/02/04/05/07 TC-M7 (15 tests, 677L, complément T-059) — PR #130 **mergée**
- **T-096** Renforcer tests isTrusted (NB-01 beforeEach + NB-03 helper `findCallByKey`, 17 tests 14→17) — PR #131

*Vague 4 (3 agents, reprise Commanditaire « continue »)* :
- **T-097** TC-UC05-05-SPA détachement/re-render React/Vue (7 tests, ARB-072-01 validé) — PR #133 **mergée**
- **T-102** Bump mini-DAT T-070 iframes v1.0 → v1.1 (R-UC03-07 borne recentSubmits + INV-UC03-04/05 + Option B formalisée + risques hérités) — PR #135
- **T-103** Refactor MessageRouter injection `IncidentService` via constructeur (élimine fenêtre boot 100ms, +25 tests dont 3 régression boot-window) — PR #134

*Orchestrateur direct* :
- **T-167** SFD v1.2 stub (addendum §9 UC+ARB+ADR, cf. LL-032) — PR #120 **mergée**

*Hotfix* :
- **Prettier** `.prettierignore` pour exclure `.claude/*.md` — PR #122 **mergée**
- **Fix LESSONS_LEARNED** restauration format compact + `.prettierignore` embarqué sur branche T-167

**18+ PR mergées dans la fenêtre soir** : #91 T-028, #94 revue Fabrique, #104 PDCA, #117 cycle final, #121 clôture 1er cycle, #80 T-120 SBOM anchore, #118 codeql-action v4, #122 hotfix prettier, #119 dev-deps Dependabot, #126 T-078, #127 T-063, #120 T-167, #129 T-076, #130 T-082, #128 bilan session vague 1-2, #132 bilan enrichi vague 3, #133 T-097, #124 T-060.

**5 PR en auto-merge GitHub** (séquencement automatique) : #135 T-102, #134 T-103, #131 T-096, #125 T-064, #123 T-059.

**Leçons capitalisées (2 nouvelles)** :
- **LL-032** (déjà capitalisée après-midi) : Ne pas déléguer à l'Analyste métier les bumps documentaires >1000L — orchestrateur produit stubs + découpage PR incrémentales.
- **LL-033** (nouvelle) : Prettier casse les tableaux Markdown compacts des fichiers `.claude/*.md`. `.prettierignore` configuré pour les exclure.

**Mémoire auto enrichie (2 nouvelles)** :
- `feedback_demarrage_session_cible.md` — lecture ciblée au démarrage (SESSION.md limit:60, pas d'intégrale)
- `feedback_prettier_claude_files.md` — ne jamais Prettier sur `.claude/*.md`

**Incidents observés (non bloquants)** :
- LL-031 reproduit 2× (HEAD déplacée par agents en worktree) — détecté par `git branch --show-current` systématique, aucun commit sur mauvaise branche grâce à vérification pré-commit.
- `tests/helpers/` et `tests/unit/helpers/` apparus en untracked dans WT principal — artefact des checkouts transitoires sur branches d'agents, disparaîtra après merge des PR correspondantes (#124).

## 🔜 Point de reprise prochaine session

1. **Vérifier les 5 PR restantes bien mergées** (#131 T-096, #128 session, #125 T-064, #124 T-060, #123 T-059). Si bloquées, relancer `gh pr update-branch` séquentiel.
2. **Should/Could restants prio BACKLOG** : T-066 (CS `all_frames: true` iframes same-origin — **nécessite arbitrage Archi sécu sur surface d'attaque**), T-097 (TC-UC05-05-SPA), T-102 (mini-DAT T-070 bump v1.1), T-103 (refactor MessageRouter injection constructeur), T-064 (filtre autocomplete, déjà livré mais couverture E2E à compléter).
3. **Enrichissement SFD §2.M7** par PR incrémentale (intégration ARB-061-01/02/03 dans corps du SFD, §9 → §2 — cf. LL-032 roadmap).
4. **Migration tests existants** vers wrapper `mock-chrome-storage` (T-060 livré) — couvre P-018 régression à détecter dans les tests legacy. Migration progressive par fichier.
5. **Protocole recette formelle T-063** à exécuter sur les 6 UC pour v1 — recette manuelle complète avec PV signé (action Commanditaire : valider calendrier recette).

---

**Où on en est (session 2026-04-19 soir — reprise courte ~19h00, clôture PR cycle convergence + T-167 stub).** Session courte démarrée après feedback Commanditaire sur consommation tokens (26% consommés sur dashboard de démarrage — LL capitalisée). Objectifs limités et atteints.

**Livré ce soir** :

- **LL-032** capitalisée (LESSONS_LEARNED.md) : pattern lenteur pathologique Analyste métier sur gros bumps SFD >1000L ; règle : orchestrateur produit lui-même les stubs + découpage en PR incrémentales.
- **T-167 SFD v1.2 stub** produit directement par l'orchestrateur — `docs/p2-specifications/p2-sfd-v1.2.md` (renommage v1.1→v1.2 + addendum §9 référençant UC-01 à UC-15 + ARB-061-01/02/03 + ADR-001/002 + roadmap SFD). Corps §1 à §8 intact. PR **#120** en auto-merge (CI verte).
- **3 PR cycle convergence mergées** : #91 T-028 WAR resserré, #94 revue Fabrique (9 rôles + synthèse), #104 P-025 PDCA checkout branche.
- **#96 fermée** (SESSION cloture cycle 2 obsolète, contenu avalé par #117 déjà mergée).
- **Mémoire auto enrichie** : `feedback_demarrage_session_cible.md` — règle lecture ciblée des fichiers de mémoire au démarrage (SESSION.md limit:60, Grep ciblé, pas d'intégral).

**PR laissées en auto-merge (GitHub séquence seul)** : #80 T-120 SBOM anchore SHA-pinned, #120 T-167 SFD v1.2 stub.

**PR Dependabot ouvertes non traitées** : #118 codeql-action v3→v4, #119 dev-deps (4 updates) — à évaluer prochaine session.

## 🔜 Point de reprise prochaine session

1. **Vérifier que #80 et #120 sont bien mergées** (sinon relancer update-branch).
2. **Traiter Dependabot #118 (codeql-action v4 — breaking ?) et #119 (dev-deps group).**
3. **Should restants** (prio) : T-179 couverture popup/password-detector, T-175 E2E UC-01 à 05, T-176 12 scénarios TC-M7, T-177 mock chrome.storage JSON-strict.
4. **Intégration détaillée SFD §2.M7** (enrichissement incrémental §9 → §2 pour ARB-061-01/02/03).

---

**Où on en est (session 2026-04-19 après-midi — finalisation Must revue Fabrique).** 🎯 Reprise post-clôture cycle 4 du matin avec attaque massive des Must restants (T-161/162/165+169/166/167/170/180/188/155 + Should T-RQ-007 partielle). **11 PR mergées sur l'après-midi** + 6 PR cycle convergence finale.

**Tâches livrées après-midi 19/04** :

- **T-161** DAT v1.4 → v1.5 (6 corrections : SFD ref, Annexe B WAR, CRITICAL_MODULES, ADR-002 M7 expires_at, badge dégradé, CodeQL) — PR #108 mergée après rebase
- **T-162** Checklist a11y v1.0 → v1.1 + scope étendu UI internes (fusion T-168) — PR #109
- **T-165 + T-169** Politique RGPD v1.2 + AIPD M7 v1.3 (intégration notes T-074/T-115 anti-démultiplication) — PR #110
- **T-166** Référentiel ISO 27001 v1.1 → v1.2 (8→12 contrôles, score audit 42→~83/100 Niveau A) — PR #111 (rebase conflit résolu)
- **T-170** Mini-DAT P5 → docs/p5-decisions/ (5 git mv + 3 sed refs) — PR #112
- **T-180** Dispositif archivage NVDA + axe-core RGAA 4.1 P7 — PR #113
- **T-188** Migration logger CS + pages UI (29 occurrences `console.*` migrées + ESLint rule étendue) — PR #114
- **T-155** Registre traitements v1.1 enrichi (6 désalignements résorbés, R-074-REC-01 traitée) — PR #115 (retry après LL-031 confusion git)
- **T-RQ-007 partielle** Normaliser noms `docs/securite/*` + matrice providers (résorbe A-05) — PR #116
- **2 conflits PR rebase** : #91 T-028 + #108 T-161 (sed referentiel obsolete)

**Triptyque RGPD aligné 4/4** : politique v1.2 ↔ AIPD v1.3 ↔ ISO v1.2 ↔ registre v1.1+ enrichi.

**❌ T-167 SFD v1.2 — REPORTÉ à prochaine session** : 4 tentatives échouées sur le bump SFD :

1. 1ère tentative tuée par BSOD Windows Commanditaire
2. 2e tentative arrêt silencieux à 59s sans Write (en réalité phase Read très lente)
3. 3e tentative idem (3+ heures sans Write)
4. 4e tentative ultra-minimaliste killée à 28s alors qu'elle s'apprêtait à Write
   **Diagnostic** : agent Analyste métier ne crashe pas, mais sa phase de synthèse cognitive sur ce bump (1733 lignes SFD v1.1 + lecture mini-DAT + post-mortem) prend des heures avant de basculer en Write. **Capitalisable en LL-032** : limiter les briefs Analyste sur gros bumps à des stubs minimalistes + multiples PR séparées pour l'enrichissement.

**Mémoire enrichie** : `feedback_confiance_controle.md` ajouté — principe Commanditaire « confiance n'exclut pas contrôle » : après toute modif (gh api PATCH, edit config, merge), relire/vérifier explicitement l'état effectif via commande inverse. Appliqué systématiquement à T-112 et toutes les actions critiques de la session.

---

## 🔜 Point de reprise prochaine session

1. **T-167 SFD v1.2** : faire moi-même (orchestrateur) le stub minimal — pas d'agent Analyste sur ce bump (cf. LL-032 à capitaliser)
2. **6 PR cycle convergence** restantes (#80/91/93/94/96/104) — vérifier convergence puis cleanup
3. **Should restants** : T-179 couverture popup/password-detector, T-175 E2E UC-01 à 05, T-176 12 scénarios TC-M7, T-177 mock chrome.storage JSON-strict
4. **Capitaliser LL-032** : pattern lenteur Analyste sur gros bumps + recommandation stubs minimalistes

---

**Où on en est (session 2026-04-19 matinée — parallélisation maximale + repo PUBLIC).** 🚀 **Session intensive enchaînée sans temps mort I-011** sous direction Commanditaire « parallélise + dis-moi ce que toi tu fais en parallèle ». **Bilan provisoire ~10:30** :

**Tâches terminées matinée 2026-04-19** :

- **T-157** finitions popup (4 sous-tâches a/b/c/d) + hotfix axe-core options/onboarding dark — PR #81 mergée (squash `473ea3b`, CI 4/4 verte). Commanditaire arbitrage Option C bouton Matrix outline cyan transparent + glow (14.2:1 AAA) tranché en début de session. Hotfix axe-core nouveau token sémantique `--sn-color-accent-text` introduit pour découpler texte sur fond dark vs fond bouton primary.
- **T-041** DAT v1.4 (FNV-1a vs SHA-256) — PR #87 mergée (squash, CI 4/4 verte). Section 17 ~130L documentant le cloisonnement des deux espaces de hash de domaine + matrice ISO 27001 A.8.24 + 7 sites d'usage.
- **T-074** note DPO compatibilité mini-DAT TACHE-061 / AIPD M7 — Avis FAVORABLE SOUS RÉSERVES (R-074-01/02/03 bloquantes MEP) — PR #82 (en cours merge).
- **T-115** note DPO circuit incidents M7 obligatoire (Step 2/7 runbook) — Avis FAVORABLE + procédure escalade DPO 6 étapes E1-E6 — PR #82.
- **T-155** registre traitements Art. 30 v1.1 user-friendly + annexe correspondance — PR #82.
- **T-120** SBOM via anchore/sbom-action SHA-pinned (CWE-829) — PR #80 (en cours merge).
- **T-112** ✅ **REPO PUBLIC** complet via CLI (10 étapes contrôlées) — `visibility=public`, secret_scanning + push_protection + dependabot security updates + private_vulnerability_reporting tous `enabled`, branch protection main+develop avec CI checks `quality`+`e2e` + linear history + no force push + admins inclus. Note pragmatique : `required_approving_review_count: 0` sur les 2 branches (sinon repo solo bloqué — à relever quand contributeurs externes apparaîtront).
- **T-130** topics + Discussions + DCO via CLI avec contrôles — 10 topics ajoutés, GitHub Discussions activées, `web_commit_signoff_required: true`. Reste : doc `docs/securite/secrets-cws.md` à différer (post-roadmap CWS).
- **PR Dependabot #84** (ws + playwright-crx) mergée immédiatement après passage public.

**Mémoire enrichie** : `feedback_confiance_controle.md` ajouté — principe Commanditaire « confiance n'exclut pas contrôle » : après toute modif (gh api PATCH, edit config, merge), relire/vérifier explicitement l'état effectif via commande inverse. Appliqué systématiquement à T-112 et toutes les actions critiques de la session.

**Innovation méthodologique LL-022/023/024 reconfirmée** : 4 agents Fabrique en parallélisation simultanée (Dev T-157 + Archi logiciel T-041 + DPO T-074/115/155 + DevSecOps T-120) puis 2 nouveaux (Dev T-134/135/136 + Archi sécu T-028) sur zones strictement disjointes. Aucun conflit de merge. Cycle hotfix axe-core inséré sans interrompre les agents.

**État courant (~10:30)** :

- 3 PR ouvertes en attente CI verte (post update-branch) : #80 T-120, #82 DPO, #83 Dependabot actions
- 2 nouveaux agents en background : Dev T-134/135/136 (pages statiques a11y) + Archi sécu T-028 (web_accessible_resources resserrement)
- Aucun worktree mort. CI verte sur develop tip.

**Actions Commanditaire restantes** : recette manuelle Google+MS (TACHE-068) toujours, T-130 (d) doc secrets-cws.md différée.

---

**Clôture session 2026-04-18 (récap)** : 29 PR mergées (#51 à #78 moins #75 fermée). Cycle UC-01 + Chantiers G/H/I/J + conformité RGPD user-friendly + audit GitHub + LL-030/031 + pixel-perfect popup 3 thèmes + hotfix 6 défauts rendu. Tests : 435 → 897 verts (+462). Supply-chain hardening : SHA pinning CWE-829, CODEOWNERS, dependabot, LICENSE GPL-3.0 sur main. 2FA + Passkey activés (T-122), paramétrage repo (default=develop, squash only, auto-delete, T-129).

---

**Où on en est (session 2026-04-18 soir — TACHE-156 pixel-perfect popup).** TACHE-156 refonte pixel-perfect popup complète : commit `de154cd`, **PR #78 ouverte vers `develop`**, CI **4/4 verte** (897/897 tests, 2× Qualité + 2× E2E Playwright). Structure `div.popup-header` + emoji 🛡 + `h2`, fond bleu solide Aegis Light, `surface-2` + barre accent dégradée Midnight Obsidian, `surface-2` + texte cyan + glow Cyberpunk Neon. TACHE-152 et TACHE-153 passées Terminé dans le BACKLOG. TACHE-156 ajoutée Terminé. **Action Commanditaire** : vérifier le rendu visuel dans Chrome (charger le dist/ avec les 3 thèmes), puis merger PR #78 → develop.

---

**Où on en est (session 2026-04-18 journée complète — 22 PR mergées, journée record).** 🎯 Session extraordinaire avec parallélisation intensive (jusqu'à 4 agents Fabrique simultanés en worktrees isolés). **22 PR mergées** (#27-#48) couvrant 6 chantiers : (1) **UC-01** login multi-étape techniquement clôturé (PR #27/29/30/31/34/35 — mini-DAT + matrice providers + correctif + 14 tests + plan tests 1388L), (2) **Audit & supply-chain** (PR #28/32/33/36/38/41 — audit GitHub score 42/100, CODEOWNERS+dependabot, LICENSE GPL-3.0 sur main via hotfix, SHA pinning CWE-829, I-011), (3) **Tests massifs** (PR #37/39/42/43/47 — coverage-v8 + m3/m6/alarm/M7 cooldown/M17/crypto native/storage-service/message-router/popup = **675/675 tests verts**, +240 tests depuis début session), (4) **Conformité RGPD** (PR #40/44/45/48 — politique confidentialité v1.0 + registre traitements Art. 30 + AIPD M7 v1.1 avec chrome.storage.local whitelist M2 et 13 sites logger inventoriés + checklist accessibilité WCAG/RGAA + 100% recos audit GitHub tracés), (5) **Accessibilité Must** (PR #46 — skip links WCAG 2.4.1 A sur 7 pages + contraste M17 2.89→8.24:1), (6) **Retex** (PR #36/41/45 — LL-027/028 pattern silent cleanup + récup-avant-cleanup agent sans Bash + I-011 règle 90%). **Reste Commanditaire (fin de cycle v1)** : recette manuelle Google+MS, 2FA T-122, T-112 passage public, T-129 paramétrage repo (10 min). **Nouvelle tâche session suivante** : TACHE-137 Must — Expert UX/UI 5 propositions graphiques ultra sexy et professionnelles via Claude Design.

---

**Où on en est (fin session 2026-04-17 soirée).** 🎯 **Chantier A "Remédiation ADR audit modules" vidé** + **dispositif Sécurité OSS produit** (dormant jusqu'à publication publique du repo) + **référentiel ISO 27001 v1.1** publié + **PDCA capitalisé sur la parallélisation d'agents Fabrique**.

**12 PR supplémentaires mergées vers `develop`** sur cette session soirée (PR #14 → #25), s'ajoutant aux 13 du matin (PR #3 → #13) = **25 PR mergées sur la journée 2026-04-17** :

_Vague Sécurité OSS + CI (12 PR)_ :

- PR #14 TACHE-106 intégration `test:e2e` en CI + alignement Node 24 LTS (workflow xvfb sur Ubuntu)
- PR #15 TACHE-099 règle E2E Playwright `isTrusted` (doc recette)
- PR #16 TACHE-075 référentiel ISO 27001 v1.0 (8 contrôles, 511 lignes)
- PR #17 TACHE-107+111 SECURITY.md v1.0 + templates issue GitHub (dormant jusqu'à T-112)
- PR #18 TACHE-110 runbook réponse à incident (542 lignes, classification P0-P3, 10 steps)
- PR #19 TACHE-085 M2 initBoot + diagnostics + incidents whitelist
- PR #20 maintenance BACKLOG : statuts + ajout T-112 à T-115
- PR #21 TACHE-114 référentiel ISO 27001 v1.1 (A.5.24/26 Défini → Géré après runbook)
- PR #22 TACHE-086+087+088 M3/M5/M6 initBoot + diagnostics (3 tâches combinées en 1 PR)
- PR #23 PDCA capitalisation — P-021/P-022 + LL-022/023/024 (parallélisation agents Fabrique)
- PR #24 TACHE-093 purge `pending_*` expirés dans `onPurgeDaily`
- PR #25 TACHE-089+090+091 M9/M17 diagnostics + pending_m17_toast + M7 `expires_at` (E-CLI-01 supprimée)

**État tests** : **408/408 Vitest verts** (294 → 408, +114 tests), 4 E2E Playwright en CI Ubuntu (T-106 effectif).

**Innovation méthodologique capitalisée** : parallélisation intensive d'agents Fabrique en worktrees isolés (jusqu'à 2 agents simultanés sur zones strictement disjointes). 6 agents Fabrique mobilisés ce soir en background. Leçons LL-022/023/024/025/026 opérationnalisées.

**Où on va (reprise prochaine session).** BACKLOG post-chantier A :

- **Chantier Tests & couverture** : TACHE-017 à 024 + TACHE-048 à 053 + TACHE-059/060/063 + objectif 80% (TACHE-026)
- **UC post-v1** : TACHE-094 à 100 (suivi UC-02/UC-05), TACHE-101 F-UC01-01
- **Conformité** : TACHE-009 politique confidentialité DPO, TACHE-040 à 043 DPO whitelist M2, TACHE-084 AIPD inventaire console
- **Sécurité OSS (activation)** : **TACHE-112 Must** checklist pré-publication repo public (pré-requis à activer `Private vulnerability reporting`)
- **Sécurité complémentaires** : TACHE-108 SAST CodeQL (Could), TACHE-109 page état santé (Could, dépend T-109), TACHE-113 tabletop juillet 2026, TACHE-115 DPO circuit M7
- **Divers** : TACHE-104/105 migration logger, TACHE-062 badge dégradé (T-085 produit les diagnostics requis)

**Gouvernance stable.** 2 branches actives (`develop`, `main`), CI toujours verte (hook I-009 opérationnel), 10+ agents Fabrique mobilisés. Niveau Exposé strict maintenu — aucune PR directe sur develop, `--delete-branch` systématique, cleanup worktree systématique post-merge (LL-024).

**Règles de flow confirmées & enrichies.** Niveau Exposé : branche courte + PR + `--delete-branch` + cleanup worktree. Format/lint/build/test obligatoires avant chaque commit. `gh pr checks` systématique après push (I-009 + hook automatique). **Nouvelle règle capitalisée LL-023** : check pro-actif `gh pr list` pendant l'attente d'agents background (notifications runtime parfois retardées). **Nouvelle règle LL-025** : diagnostic factuel (gh pr list + git log feature-branch + worktree list) AVANT toute action corrective. **Nouvelle règle LL-026** : ne jamais tenter de récupérer un travail avant d'avoir vérifié 3× qu'il est réellement perdu.

## Projet

- **Nom** : Sentinel Nudge
- **Niveau de sensibilité** : Exposé
- **Dépôt GitHub** : https://github.com/antonyblain/sentinel-nudge
- **Date de création** : 2026-04-10

## État courant

- **Phase active** : P5 — Fiabilisation M7 + couverture UC P0 v1 (démarrée 2026-04-16)
- **Dernière action** : **TACHE-156 refonte pixel-perfect popup** — commit `de154cd` sur `feature/p5-tache-156-popup-pixel-perfect-maquettes`, PR #78 ouverte vers develop, CI 4/4 verte (897/897 tests). TACHE-152/153 passées Terminé dans BACKLOG, TACHE-156 ajoutée Terminé. — 2026-04-18
- **Action précédente** : **TACHE-061 clôturée** — PR #4 ouverte vers develop (code heartbeat + canary + registre incidents, 239/239 tests, 4 corrections pré-merge appliquées, PV comité v1.0 validé, R-M7-08/09 ajoutés, 9 tâches post-merge TACHE-076 à 084). Mini-DAT v1.1 validé en amont (arbitrages ARB-061-01/02/03, 5 INV-SEC, 5 STRIDE, 8 ISO 27001) — 2026-04-16.
- **Mini-DAT TACHE-061 v1.1** initial : produit par Architecte logiciel, enrichi par Architecte sécurité, contrôlé par Référent qualité (Validé avec commentaires — 2 bloquantes A-01/A-02 corrigées). 3 arbitrages ARB-061-01/02/03 tranchés selon recommandations (Option A / B / A). 2 tâches de suivi créées (TACHE-074 transmission DPO, TACHE-075 référentiel ISO 27001) — 2026-04-16.
- **Action précédente** : **Saga fiabilisation M7 terminée** — 7 commits correctifs (P-014 à P-020) : P-016 auto-régénération clé AES au boot SW, P-017 détection inputs password orphelins (3 stratégies submit+Enter+click), P-018 sérialisation Array<number> des clés crypto, P-019 pattern pending-intent avec TTL 10 min pour survivre aux redirects post-submit, P-020 promotion M7 en CRITICAL_MODULES (bypass quota 3/jour, cooldown 30j + suppression_list suffisent au rate-limit). Tests M7 **validés sur 3 sites réels** (saucedemo, herokuapp avec redirect, practicetestautomation via fallback Enter). Post-mortem consolidé avec 4 profils techniques : PV `gouvernance-pv-postmortem-m7-v1.0.md` produit + atelier PDCA + revue 15 cas d'usage (UC-01 à UC-15). **Option A retenue par Commanditaire** : v1 complète avec UC-01 à UC-06 (P0) couverts avant release. 16 commits au total sur feature/p4-developpement. 200 tests OK, CI verte, format/lint/build OK — 2026-04-14.
- **Prochaine action attendue** : **Commanditaire : vérifier le rendu visuel de la popup dans Chrome** (charger dist/ avec `npm run build`, puis extension non packagée dans chrome://extensions, vérifier les 3 thèmes Aegis Light / Midnight Obsidian / Cyberpunk Neon vs maquettes v3), puis **merger PR #78 → develop**. Après merge : démarrer la prochaine tâche selon BACKLOG (T-143 dashboard/options/onboarding pixel-perfect, ou T-068 recette manuelle Google+MS selon priorité Commanditaire).
- **Prochaine action archivée** : (TACHE-068) Soumettre mini-DAT TACHE-068 v1.0 — voir fil rouge session 2026-04-18 pour détails.
- **Prochaines actions P5 consolidées** : **19 tâches** (17 + TACHE-074/075) réparties en 4 chantiers prioritaires :
  1. **UC P0 bloquants v1** (TACHE-068 à 073) : login multi-étape, password managers, iframes, toggle show/hide, inputs dynamiques
  2. **Patterns défensifs ADR + audit modules** (TACHE-058, TACHE-061, TACHE-062) : SW-BOOT-CONTRACT + CROSS-LIFECYCLE-INTENT, heartbeat M7, badge dégradé
  3. **Tests** (TACHE-059, TACHE-060, TACHE-063, TACHE-017 à 024, TACHE-048 à 053) : 12 scénarios TC-M7, mock chrome.storage JSON-strict, protocole recette formalisé, couverture popup.ts, atteindre 80% couverture (TACHE-026)
  4. **Corrections fonctionnelles** (TACHE-064, TACHE-067, TACHE-040 à 043) : filtrage autocomplete="new-password", MutationObserver type toggle, documentation DPO, hardening web_accessible_resources
- **Branche Git active** : feature/p5-tache-156-popup-pixel-perfect-maquettes (PR #78 en attente merge)

## Livrables produits

| Phase | Livrable                                                             | Version         | Statut                                                                 | Date       |
| ----- | -------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------- | ---------- |
| P1    | p1-analyse-litterature-nudging-v2.0.md                               | v2.0            | Validé                                                                 | 2026-04-11 |
| P1    | p1-cahier-des-charges-v1.1.md                                        | v1.1            | Validé                                                                 | 2026-04-11 |
| P1    | p1-analyse-licences-open-source-v1.0.md                              | v1.0            | Validé (GPL v3 retenue)                                                | 2026-04-11 |
| P2    | gouvernance-pv-securite-p2-v1.0.md                                   | v1.0            | Produit                                                                | 2026-04-11 |
| P2    | p2-sfd-v1.1.md                                                       | v1.1            | Validé                                                                 | 2026-04-11 |
| P3    | p3-dat-v1.3.md                                                       | v1.3            | Produit (en attente validation)                                        | 2026-04-17 |
| P3    | gouvernance-pv-architecture-v1.0.md                                  | v1.0            | Validé                                                                 | 2026-04-11 |
| P3    | p3-aipd-m7-v1.0.md                                                   | v1.0            | Validé (D-SEC-005 satisfait)                                           | 2026-04-11 |
| P4    | src/background/handlers/m5-handler.ts                                | —               | Implémenté                                                             | 2026-04-12 |
| P4    | src/content-scripts/ui/toast-m5.ts                                   | —               | Implémenté + i18n                                                      | 2026-04-12 |
| P4    | src/background/score-calculator.ts                                   | —               | Refondu (5 composantes M3)                                             | 2026-04-12 |
| P4    | src/background/handlers/m3-handler.ts                                | —               | Implémenté                                                             | 2026-04-12 |
| P4    | src/background/handlers/m6-handler.ts                                | —               | Implémenté                                                             | 2026-04-12 |
| P4    | src/content-scripts/ui/toast-m6.ts                                   | —               | Implémenté                                                             | 2026-04-12 |
| P4    | src/content-scripts/ui/overlay-m6.ts                                 | —               | Implémenté + i18n (TACHE-014)                                          | 2026-04-12 |
| P4    | src/content-scripts/ui/overlay-m2.ts                                 | —               | Implémenté + i18n (TACHE-014)                                          | 2026-04-12 |
| P4    | src/content-scripts/ui/overlay-m9.ts                                 | —               | Implémenté + i18n (TACHE-014)                                          | 2026-04-12 |
| P4    | src/content-scripts/ui/toast-m7.ts                                   | —               | Implémenté + i18n (TACHE-014)                                          | 2026-04-12 |
| P4    | src/content-scripts/ui/toast-m17.ts                                  | —               | Implémenté + i18n (TACHE-014)                                          | 2026-04-12 |
| P4    | src/assets/data/quiz-corpus.json                                     | —               | 20 questions (15 FR + 5 EN)                                            | 2026-04-12 |
| P4    | src/background/service-worker.ts                                     | —               | M3/M5/M6 intégrés                                                      | 2026-04-12 |
| P4    | src/pages/popup/popup.ts                                             | —               | Implémenté                                                             | 2026-04-12 |
| P4    | src/pages/popup/popup.css                                            | —               | Implémenté                                                             | 2026-04-12 |
| P4    | src/pages/options/options.ts                                         | —               | handleExport() réel + dialog accessible (TACHE-013/015)                | 2026-04-12 |
| P4    | src/pages/options/options.css                                        | —               | Implémenté                                                             | 2026-04-12 |
| P4    | src/pages/onboarding/onboarding.ts                                   | —               | Implémenté                                                             | 2026-04-12 |
| P4    | src/pages/onboarding/onboarding.css                                  | —               | Implémenté                                                             | 2026-04-12 |
| P4    | src/pages/dashboard/dashboard.ts                                     | —               | Implémenté                                                             | 2026-04-12 |
| P4    | src/pages/dashboard/dashboard.css                                    | —               | Implémenté                                                             | 2026-04-12 |
| P4    | src/pages/static/m2-explication.html                                 | —               | Créé (TACHE-012)                                                       | 2026-04-12 |
| P4    | src/pages/static/m3-explication.html                                 | —               | Créé (TACHE-012)                                                       | 2026-04-12 |
| P4    | src/pages/static/m5-explication.html                                 | —               | Créé (TACHE-012)                                                       | 2026-04-12 |
| P4    | src/pages/static/m6-explication.html                                 | —               | Créé (TACHE-012)                                                       | 2026-04-12 |
| P4    | src/pages/static/m7-explication.html                                 | —               | Créé (TACHE-012)                                                       | 2026-04-12 |
| P4    | src/pages/static/m9-explication.html                                 | —               | Créé (TACHE-012)                                                       | 2026-04-12 |
| P4    | src/pages/static/m17-explication.html                                | —               | Créé (TACHE-012)                                                       | 2026-04-12 |
| P4    | src/assets/data/typosquatting-targets.json                           | —               | Enrichi 20→200 domaines (TACHE-011)                                    | 2026-04-12 |
| P4    | src/assets/\_locales/fr/messages.json                                | —               | Étendu (170+ clés)                                                     | 2026-04-12 |
| P4    | src/assets/\_locales/en/messages.json                                | —               | Étendu (170+ clés)                                                     | 2026-04-12 |
| P4    | src/manifest.json                                                    | —               | web_accessible_resources ajouté                                        | 2026-04-12 |
| P4    | vite.config.ts                                                       | —               | additionalInputs dashboard/onboarding                                  | 2026-04-12 |
| P4    | tests/unit/modules/m5.test.ts                                        | —               | 15 tests OK                                                            | 2026-04-12 |
| P4    | tests/unit/modules/m3.test.ts                                        | —               | 35 tests OK                                                            | 2026-04-12 |
| P4    | tests/unit/modules/m6.test.ts                                        | —               | 23 tests OK                                                            | 2026-04-12 |
| P4'   | docs/p4-conception/brand-book-sentinel-nudge.md                      | v1.0            | Validé — palette Aegis Blue retenue                                    | 2026-04-12 |
| P4'   | docs/p4-conception/brand-book-preview.html                           | —               | Preview interactive 5 palettes                                         | 2026-04-12 |
| P4'   | src/assets/styles/tokens.css                                         | —               | Tokens CSS centralisés Aegis Blue + dark mode                          | 2026-04-13 |
| P4'   | src/assets/icons/icon.svg                                            | —               | Logo SVG source (bouclier + S + nudge)                                 | 2026-04-13 |
| P4'   | src/assets/icons/icon{16,48,128}.png                                 | —               | Icônes PNG réelles (générées depuis SVG)                               | 2026-04-13 |
| P4'   | src/assets/icons/icon.svg + icon{16,48,128}.png                      | —               | Logo HD vectorisé via potrace, viewBox maximisé (94.4% densité)        | 2026-04-14 |
| P4'   | docs/gouvernance/gouvernance-pv-revue-code-p4prime-v1.0.md           | v1.0            | PV comité revue code P4' — 3 revues consolidées                        | 2026-04-14 |
| P4'   | docs/p4-conception/p4prime-tests-manuels-modules-asynchrones-v1.0.md | v1.0            | Guide tests manuels M3/M5/M6/M7 avec commandes DevTools                | 2026-04-14 |
| P4'   | docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md                | v1.0            | PV post-mortem M7 — 4 profils techniques, PDCA, 15 UC, score 2.0→3.4/5 | 2026-04-14 |
| P5    | docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md         | v1.1            | Validé par Commanditaire — arbitrages ARB-061-01/02/03 tranchés        | 2026-04-16 |
| P5    | docs/gouvernance/gouvernance-pv-revue-code-tache-061-v1.0.md         | v1.0            | Validé avec observations                                               | 2026-04-16 |
| P5    | docs/adr/adr-001-sw-boot-contract.md                                 | v1.0 (Accepted) | Validé — 5 R-BOOT + STRIDE + 5 ISO 27001                               | 2026-04-17 |
| P5    | docs/adr/adr-002-cross-lifecycle-intent.md                           | v1.0 (Accepted) | Validé — 7 R-CLI + E-CLI-01 + STRIDE + 6 ISO 27001                     | 2026-04-17 |
| P5    | docs/p4-conception/p5-audit-modules-adr-compliance-v1.0.md           | v1.0            | Validé avec observations intégrées — 28 écarts, 8 tâches               | 2026-04-17 |

## Actions manuelles en attente

| ID  | Titre | Statut |
| --- | ----- | ------ |

## Notes de session

- Projet open-source d'extension navigateur de cyber-hygiène comportementale
- 20 modules de nudging catalogués (littérature + propositions Commanditaire + analyste)
- Lotissement v1 validé : 7 modules (M2, M3, M5, M6, M7, M9, M17)
- Lotissement v2 : 4 modules Should restants (M4, M11, M13, M20)
- Privacy by design : tout traitement local, aucune télémétrie
- Manifest V3 obligatoire, permissions minimales
- Contrainte transversale : quota 3 nudges/jour par défaut (augmentable à 5, 10 ou Tous)
- Licence : GPL v3 validée par le Commanditaire (2026-04-11), appliquée sur le dépôt
- Gestionnaires mdp : uniquement projets open source nommés (KeePass, KeePassXC, Bitwarden, Vaultwarden)
- M5 : détection via chrome.runtime.requestUpdateCheck() (API native, pas de version embarquée)
- Couche d'abstraction navigateur à prévoir dès v1 pour compatibilité future Firefox/Edge
- M3 score-calculator : pondérations M5=20, M6=25, M2=20, M7=20, M9=15. Redistribution proportionnelle si modules désactivés.
- M6 spaced repetition : intervalles [0, 7, 21, 42, 70] jours puis 30j/mois. Score <50% → ×0.7, score 100% → ×1.2
- Pages UI : dashboard et onboarding ajoutés en additionalInputs dans vite.config.ts (non référençables via propriétés MV3 standard)
- TACHE-013 (handleExport) : les handlers SW pour EXPORT (get_all_events, get_all_quiz_sessions, get_whitelist, get_password_hash_meta) restent à implémenter côté service-worker.ts — gap fonctionnel connu, non bloquant pour le build
- Pages statiques d'explication : renommées avec noms parlants (sites-suspects.html, score-cyber-hygiene.html, mise-a-jour-navigateur.html, quiz-phishing.html, reutilisation-mots-de-passe.html, force-mots-de-passe.html, donnees-sensibles-presse-papiers.html). MODULE_INFOS dans options.ts et tous les handlers SW alignés.
- Brand Book validé 2026-04-12 : palette **Aegis Blue** retenue (proposition 1). Dark mode décidé pour v1 (pas v2). 10 tâches UX créées (TACHE-030 à TACHE-039) dans une phase P4' d'intégration design system.
- **Post-mortem M7 2026-04-14** : 3 causes racines identifiées (absence contrat de boot SW, hypothèses modèle de page trop restrictives, pyramide tests trop plate). 7 règles permanentes consolidées dans l'atelier PDCA, à diffuser dans LESSONS_LEARNED.md / TECH_STACK.md / OUTILS.md. Score de maturité M7 : 2.0/5 → 3.4/5 → cible 4.7/5 fin P5.
- **Option A v1 retenue 2026-04-14** : 6 cas d'usage P0 (UC-01 login multi-étape, UC-02 password managers, UC-03 iframes same-origin, UC-04 iframes cross-origin, UC-05 toggle show/hide, UC-06 inputs dynamiques) sont bloquants pour la release v1. Priorisation interne : UC-02 (password managers) et UC-05 (toggle) en premier car usage le plus fréquent.
- **ADR à produire en P5** : `SW-BOOT-CONTRACT` (tout handler avec prérequis storage implémente boot : lire → valider → régénérer/migrer → logger) et `CROSS-LIFECYCLE-INTENT` (toute action traversant dormance/redirect/réinjection est persistée en storage avec TTL, consommée à destination).
