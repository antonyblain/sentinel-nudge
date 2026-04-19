# Revue Analyste métier — Sentinel Nudge
## Session du 2026-04-19 — Revue complète périmètre P1/P2/P5

**Produit par :** Analyste métier (Fabrique)
**Date :** 2026-04-19
**Phase active :** P5 — Fiabilisation + couverture UC P0 v1
**Destinataire :** Orchestrateur (consolidation revue Fabrique)

---

## 1. Bilan synthétique

L'Analyste métier a produit en phases P1 et P2 un corpus fonctionnel complet et cohérent couvrant les 7 modules v1 du lotissement initial (M2/M3/M5/M6/M7/M9/M17), les composants transversaux, et les exigences non fonctionnelles. Les user stories, critères d'acceptation Gherkin, et maquettes textuelles sont en place. La SFD v1.1 a correctement absorbé les décisions du comité de sécurité pré-P2. En P5, le plan de tests manuels consolidé v1.0 couvre les UC P0 et les modules P1. Deux écarts structurels subsistent : le corpus quiz M6 reste à 20 questions sur les 50 exigés, et la SFD n'a pas été mise à jour pour intégrer les évolutions fonctionnelles issues du post-mortem M7 (UC-01 à UC-06, ARB-068-01, maquettes popup v3). Ces écarts sont portés en risques résiduels.

---

## 2. Périmètre couvert — livrables produits

| Livrable | Version | Statut | Phase |
|----------|---------|--------|-------|
| `docs/p1-besoin/p1-cahier-des-charges-v1.1.md` | v1.1 | Validé Commanditaire | P1 |
| `docs/p1-besoin/p1-analyse-litterature-nudging-v2.0.md` | v2.0 | Validé | P1 |
| `docs/p1-besoin/p1-analyse-licences-open-source-v1.0.md` | v1.0 | Validé (GPL v3 retenue) | P1 |
| `docs/p2-specifications/p2-sfd-v1.1.md` | v1.1 | Validé | P2 |
| `docs/p5-recette/plan-tests-manuels-consolide-v1.0.md` | v1.0 | Produit (P5) | P5 |
| `src/assets/data/quiz-corpus.json` | v1.1 | Produit — 20 questions (objectif : 50+) | P4 |

**Contenu du CdC v1.1 :** 7 modules v1, lotissement v2 (M4/M11/M13/M20), exclusions définitives (M18), 3 personas (Débutant/Intermédiaire/Avancé), exigences non fonctionnelles (privacy by design, performance, accessibilité WCAG 2.1 AA, i18n FR/EN, compatibilité MV3), critères d'acceptation par module (CA-M2-01 à CA-M17-04), glossaire métier.

**Contenu de la SFD v1.1 :** diagrammes de séquence Mermaid + machines à états + dictionnaires de données pour les 7 modules, composants transversaux (quota, stockage, onboarding, paramètres, dashboard, notifications, pages statiques), ENF détaillées, matrice de traçabilité CdC → SFD (69 critères d'acceptation total), glossaire enrichi (debounce, FIFO, focus trap, MutationObserver, Shadow DOM, entropie de Shannon, domain_hash, installation_salt, tag).

**Contenu du plan de tests manuels consolidé v1.0 :** 17 chapitres opérationnels couvrant UC-01 à UC-06 (P0 bloquant v1), M2/M3/M5/M6/M9/M17 (P1), recette providers M7, commandes DevTools, procédure d'anomalie. Produit en P5, consolidant les scénarios éparpillés dans les mini-DAT et le post-mortem.

---

## 3. Périmètre manquant ou à compléter

### 3.1 Corpus quiz M6 — déficit critique (R-017)

La SFD v1.1 §2.4 exige un corpus de **50 exemples minimum** en v1. Le fichier `src/assets/data/quiz-corpus.json` contient **20 questions** (v1.1 déclarée, 20 entrées `phish-001` à `phish-020` confirmées). L'écart est de 30 questions. Le risque R-017 est enregistré dans RISQUES.md (score 1×1=1, Ouvert). Le BACKLOG indique TACHE-006 comme terminé ("corpus quiz 50 questions ✅"), ce qui contredit l'état réel du fichier. Cet écart entre le statut BACKLOG et la réalité du livrable est lui-même un écart de traçabilité à corriger.

### 3.2 Mise à jour SFD post-mortem M7 non réalisée

Le post-mortem M7 (2026-04-14, PV gouvernance-pv-postmortem-m7-v1.0.md) a révélé 6 cas d'usage P0 (UC-01 à UC-06) et 9 cas d'usage P1/P2 (UC-07 à UC-15) non couverts par la spécification initiale. Ces UC ont donné lieu à des mini-DAT et des scénarios de recette en P5, mais la **SFD v1.1 n'a pas été mise à jour** pour intégrer :
- Les règles de comportement M7 sur login multi-étape (UC-01, ARB-068-01 Option A : hash rattaché au hostname du Step 2)
- Le filtrage `isTrusted=false` pour les soumissions par gestionnaire de mots de passe (UC-02)
- La limitation explicite de M7 sur les iframes cross-origin (UC-04 : documenter, pas couvrir)
- Le comportement MutationObserver sur type toggle (UC-05, ARB-072-02 Option A)
- Le comportement sur inputs dynamiques React/Vue (UC-06)

Ces décisions sont tracées dans les mini-DAT P5 mais restent hors SFD de référence.

### 3.3 Maquettes popup v3 non reflétées dans la SFD

La refonte graphique pixel-perfect popup (T-152, T-156 — maquettes v3 avec 3 thèmes : Aegis Light / Midnight Obsidian / Cyberpunk Neon) a profondément modifié la structure du composant popup (div.popup-header + emoji + h2, gauge-wrap, modules-grid, quota-bar). La SFD v1.1 §3.5 décrit un dashboard et une popup dans leur version initiale ; elle ne reflète pas l'architecture visuelle actuelle. L'Expert UX/UI gère ce périmètre de design, mais l'Analyste métier devrait mettre à jour les maquettes textuelles de référence dans la SFD.

### 3.4 Pages statiques d'explication — renommage non reflété

Les 7 pages statiques ont été renommées avec des noms sémantiques (ex. `m2-explication.html` → `sites-suspects.html`, etc.) lors de TACHE-012/007. La SFD v1.1 §3.7 référence encore l'ancienne convention de nommage (`explain-m2.html`). Écart mineur mais facteur de confusion pour tout lecteur de la SFD.

### 3.5 PV de recette (phase P7) — non encore produit

Aucun PV de recette fonctionnelle n'existe à ce jour. C'est attendu : la recette formelle (TACHE-068 — recette Google + Microsoft) est listée comme action manuelle restante du Commanditaire. Le plan de tests manuels consolidé v1.0 est prêt à servir de base au PV, mais ce dernier n'a pas encore été formalisé. Phase P7 non encore ouverte.

---

## 4. Cohérence cross-livrables — écarts identifiés

### E-AM-01 — Statut TACHE-006 incohérent avec le fichier quiz-corpus.json

**Contexte :** BACKLOG ligne 167 indique `~~TACHE-006~~ : corpus quiz 50 questions ✅`. Le fichier `src/assets/data/quiz-corpus.json` contient 20 questions (confirmé par grep : 20 occurrences de `phish-`). La version déclarée dans le JSON est `v1.1`. La SFD et le DAT v1.4 exigent 50+ questions avant release.
**Impact :** Le risque R-017 est mal évalué (score 1 — "Ouvert" mais jugé faible). Si la TACHE-006 est réellement terminée à 50, le fichier versionné n'est pas le bon. Si elle n'est pas terminée, le BACKLOG est inexact.
**Sévérité :** Must — à clarifier avant release v1.

### E-AM-02 — SFD v1.1 ne couvre pas les UC post-mortem M7

**Contexte :** La SFD est datée du 2026-04-11. Le post-mortem et les mini-DAT P5 ont introduit 15 UC entre le 2026-04-14 et le 2026-04-18. Les décisions fonctionnelles (ARB-068-01, ARB-072-02) modifient le comportement spécifié de M7 et M9.
**Impact :** La SFD n'est plus la référence fonctionnelle complète de M7. Un développeur lisant uniquement la SFD aurait un comportement M7 incomplet pour UC-01/UC-02/UC-05/UC-06.
**Sévérité :** Should — non bloquant pour la release si les mini-DAT P5 font foi, mais crée une dette documentaire.

### E-AM-03 — Matrice de traçabilité CdC → SFD non maintenue post-P2

**Contexte :** La SFD v1.1 §5 présente une matrice de traçabilité complète à la date de production (2026-04-11). Elle n'a pas été mise à jour pour inclure les 15 nouveaux UC, les 3 ADR (SW-BOOT-CONTRACT, CROSS-LIFECYCLE-INTENT), ni les décisions du comité architecture P5.
**Impact :** La matrice est obsolète pour les exigences ajoutées en P5. Elle ne permet plus d'assurer la traçabilité complète exigences → livrables.
**Sévérité :** Should.

### E-AM-04 — Plan de tests manuels ne référence pas les CA de la SFD

**Contexte :** Le plan de tests manuels consolidé v1.0 est structuré par UC (P0) et par module (P1). Il n'établit pas de lien explicite avec les CA-Mxx-YY définis dans la SFD v1.1 et le CdC v1.1. Les scénarios de recette sont exprimés en Given/When/Then mais sans référencement aux identifiants formels des CA.
**Impact :** En phase P7, il sera difficile de produire un PV de recette traçant précisément quels critères d'acceptation sont couverts. La matrice de traçabilité exigences → tests est absente.
**Sévérité :** Should.

### E-AM-05 — Nommage pages statiques désaligné SFD / code

**Contexte :** SFD §3.7 : `explain-m2.html`. Code réel : `sites-suspects.html`, `score-cyber-hygiene.html`, `mise-a-jour-navigateur.html`, `quiz-phishing.html`, `reutilisation-mots-de-passe.html`, `force-mots-de-passe.html`, `donnees-sensibles-presse-papiers.html`.
**Impact :** Mineur — les pages existent et fonctionnent. La SFD est désalignée du code.
**Sévérité :** Could.

### E-AM-06 — Lotissement v2 : aucune user story ni spécification préliminaire

**Contexte :** Le CdC §6.1 liste M4/M11/M13/M20 comme périmètre v2. Aucun livrable analyste n'existe pour ces modules (ni CdC, ni user stories préliminaires, ni exigences de haut niveau).
**Impact :** Conforme à la décision initiale (v2 hors périmètre de ce projet). Aucun risque immédiat. À anticiper pour la prochaine itération.
**Sévérité :** Could (périmètre v2+, non bloquant v1).

---

## 5. Conformité initiale — alignement avec les engagements du Commanditaire

### Ce qui est conforme

- **Niveau de sensibilité Exposé** : choix tracé dès P1, toute la gouvernance en découle correctement. Les questions discriminantes ont été posées et le choix validé.
- **Lotissement v1 (7 modules Must/Should)** : M2 (Must), M3 (Must), M5 (Must, remonté de Should), M6 (Must), M7 (Should), M9 (Should), M17 (Should) — tous développés et testés.
- **Lotissement v2 (M4/M11/M13/M20)** : correctement documenté comme hors périmètre v1, à préparer.
- **Privacy by design** : ENF-PBD-01 à 09 couverts dans la SFD, implémentés, tracés dans AIPD et politique de confidentialité.
- **Paternalisme libertarien** : aucun nudge ne bloque une action utilisateur, chaque module est désactivable. Conforme à l'engagement initial.
- **Personas** : 3 profils (Débutant/Intermédiaire/Avancé) intégrés dans l'onboarding et le CdC.
- **Quota 3 nudges/jour** : défaut de 3, configurable 5/10/Tous, avec avertissement fatigue d'alerte. Conforme.
- **Open source (gestionnaires de mots de passe)** : uniquement KeePass, KeePassXC, Bitwarden, Vaultwarden dans M7. Disclaimer d'affiliation conforme.
- **Indicateurs de succès (O1 à O7)** : définis et mesurables localement. Conformes à la vision Commanditaire.

### Ce qui s'est écarté (avec justification)

- **Corpus quiz M6 (50 questions)** : la SFD et le DAT exigent 50+ questions avant release. Le corpus produit en P4 ne contient que 20 questions. L'écart de statut BACKLOG (E-AM-01) masque ce risque.
- **SFD figée à la date P2** : les évolutions fonctionnelles P5 (UC post-mortem M7) ne sont pas reflétées dans la SFD. C'est une dette documentaire acceptée implicitement mais non formalisée.

---

## 6. Risques résiduels — liste prioritisée

| Priorité | ID | Description | Statut actuel |
|----------|----|-------------|---------------|
| **Must** | R-017 | Corpus quiz M6 insuffisant (20/50 questions). Risque de release avec un module M6 sous-alimenté : expérience dégradée dès J42 (épuisement des questions adaptées au profil). | Ouvert — à corriger avant release |
| **Must** | E-AM-01 | Incohérence statut TACHE-006 ("terminé 50 questions") vs fichier JSON réel (20 questions). Risque de release avec une fausse assurance qualité. | À clarifier immédiatement |
| **Should** | E-AM-02 | SFD v1.1 non mise à jour pour les UC post-mortem M7 (UC-01 à UC-06). Dette documentaire — les mini-DAT P5 font foi mais la SFD reste la référence contractuelle. | À adresser avant clôture P5 |
| **Should** | E-AM-03 | Matrice de traçabilité exigences → livrables obsolète depuis P2. Rend difficile la production d'un PV de recette complet en P7. | À adresser avant P7 |
| **Should** | E-AM-04 | Plan de tests manuels non référencé aux CA-Mxx-YY formels de la SFD. Traçabilité incomplète pour la recette P7. | À adresser avant P7 |
| **Could** | E-AM-05 | Nommage pages statiques désaligné SFD / code. Mineur. | Dette documentaire acceptable |
| **Could** | E-AM-06 | Absence de user stories préliminaires pour le lotissement v2 (M4/M11/M13/M20). Hors périmètre v1. | À planifier en début de cycle v2 |

---

## 7. Recommandations — actions concrètes

### Rec-01 — Clarifier et corriger l'état du corpus quiz M6 (Must — avant release)

Le Commanditaire doit confirmer si le corpus à 20 questions est le fichier réel ou si un corpus à 50 questions existe hors repo. Si le corpus est réellement à 20 questions, deux options :
- **Option A** : produire les 30 questions manquantes (4 catégories, 3 niveaux) avant release v1. Proposition de tâche : **T-158 — Compléter corpus quiz M6 (30 questions manquantes, objectif 50+)**, responsable Analyste métier, priorité Must.
- **Option B** : déclarer la release v1 avec corpus 20 questions, documenter la limite (réduction de la fréquence de répétition M6 ou épuisement à J42 pour profil Expert), et planifier l'enrichissement en v1.1.

Le BACKLOG doit être corrigé : TACHE-006 n'est pas terminée à 50 questions si le fichier JSON en contient 20.

### Rec-02 — Mise à jour SFD v1.2 post-mortem M7 (Should — avant clôture P5)

Produire une SFD v1.2 intégrant :
1. Section 2.5 (M7) enrichie : UC-01 login multi-étape (ARB-068-01), UC-02 filtrage isTrusted, UC-04 limite iframes cross-origin documentée, UC-05 MutationObserver type toggle (ARB-072-02), UC-06 inputs dynamiques.
2. Section 5 (matrice traçabilité) étendue aux UC et aux 3 ADR produits en P5.
3. Section 3.7 (pages statiques) mise à jour avec les noms réels des fichiers.

Proposition de tâche : **T-159 — SFD v1.2 : intégration évolutions fonctionnelles P5 (UC-01/02/04/05/06, ARB, nommage pages)**, responsable Analyste métier, priorité Should.

### Rec-03 — Lier le plan de tests manuels aux CA de la SFD (Should — avant P7)

Ajouter dans le plan de tests manuels consolidé une colonne "Critère d'acceptation SFD" pour chaque scénario (ex. TC-M7-UC01-01 → CA-M7-01 + CA-M7-05). Permet de produire un PV de recette traçable en P7. Cette mise à jour peut être réalisée en v1.1 du plan de tests manuels lors de la recette.

Proposition de tâche : **T-160 — Plan tests manuels v1.1 : référencement croisé avec CA de la SFD**, responsable Testeur QA avec contribution Analyste métier, priorité Should.

### Rec-04 — Formaliser l'ouverture de la phase P7 (Should — après recette manuelle TACHE-068)

Dès que la recette manuelle Google + Microsoft (TACHE-068) est déroulée par le Commanditaire, l'Analyste métier doit produire le PV de recette fonctionnelle en confrontant les résultats aux critères d'acceptation du CdC v1.1 et de la SFD v1.1. Ce PV est le livrable P7 manquant.

### Rec-05 — Anticiper les user stories v2 dès la clôture de v1 (Could)

Produire en début de cycle v2 un backlog de user stories préliminaires pour M4/M11/M13/M20 (lotissement v2). Les personas et le glossaire métier v1 sont réutilisables. Pas urgent — à planifier.

---

*Analyste métier — Fabrique — Revue du 2026-04-19*
*Livrable produit directement au chemin indiqué — commit/push/PR par l'orchestrateur.*
