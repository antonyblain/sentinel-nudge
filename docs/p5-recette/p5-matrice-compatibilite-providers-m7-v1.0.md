# Matrice de compatibilité providers M7 — Sentinel Nudge

**Statut** : Livrable vivant (mis à jour au fil des recettes)
**Création** : 2026-04-18
**Origine** : Demande Commanditaire (2026-04-18) — mini-DAT TACHE-068 §14
**Propriétaire** : Testeur QA (mise à jour à chaque recette) + Architecte logiciel (revue trimestrielle)
**Public** : Document ouvert — publié avec le dépôt open source (sert de documentation utilisateur)

---

## 1. Objectif

Recenser au fur et à mesure les **providers** (IdP, gestionnaires de mots de passe, sites cibles notables) testés avec le module M7 (détection de réutilisation de mots de passe) de Sentinel Nudge, avec pour chacun :

- le **statut de compatibilité** observé ;
- les **limitations** et contournements éventuels ;
- la **version extension** + **navigateur** utilisés lors de la recette ;
- le **lien vers le ticket BACKLOG** si anomalie remontée.

Ce document est **la source de vérité** sur les providers supportés par M7. Il alimente la documentation utilisateur (README, FAQ) et les release notes.

---

## 2. Légende de statut

| Symbole | Signification | Action associée |
|:-:|---|---|
| ✅ | Compatible — détection M7 fonctionnelle sur le flux testé | Aucune |
| ⚠ | Partiellement compatible — détection OK dans certains cas mais limitations connues | Lien vers ticket BACKLOG (limitation documentée) |
| ❌ | Non compatible — M7 ne détecte pas la réutilisation sur ce provider | Ticket BUG ou TÂCHE obligatoire + mention en FAQ |
| ⏸ | Reporté — provider identifié comme utile à tester mais non couvert pour la version actuelle | Ticket TÂCHE dans BACKLOG (priorité Could) |
| 🔬 | En cours de test — recette en cours, résultat non figé | Aucun statut officiel tant que la recette n'est pas close |

---

## 3. Providers IdP (Identity Providers / SSO)

| Provider | Flux testé | Extension | Navigateur | Hostname Step 1 → Step 2 | Statut | Commentaires | Date recette | Testeur |
|---|---|---|---|---|:-:|---|---|---|
| Google | `accounts.google.com` (SPA multi-étape email puis password) | v1.0 (post T-101) | Chrome 139 | `accounts.google.com` → `accounts.google.com` (stable) | 🔬 | Recette prévue après merge TACHE-101 (correctif F-UC01-01) | TC-UC01-01 | À faire |
| Microsoft | `login.microsoftonline.com` → redirect `login.live.com` | v1.0 | Chrome 139 | `login.microsoftonline.com` → `login.live.com` (change) | 🔬 | Cas cross-hostname — hash Step 2 associé à `login.live.com` uniquement (comportement validé par ARB-068-01 Option A) | TC-UC01-02 | À faire |
| Okta | `<tenant>.okta.com` natif | — | — | — | ⏸ | Reporté hors v1 (ARB-068-03 Option A = Google + Microsoft uniquement) | — | — |
| GitLab.com SSO | À définir | — | — | — | ⏸ | Non couvert v1 | — | — |
| Auth0 | À définir | — | — | — | ⏸ | Non couvert v1 | — | — |

---

## 4. Providers Password Managers

| Provider | Méthode remplissage | Extension | Navigateur | isTrusted sur submit ? | Statut | Commentaires | Date recette | Testeur |
|---|---|---|---|---|:-:|---|---|---|
| KeePassXC (navigateur connector) | Autofill manuel (icône dans champ) | v1.0 | Chrome 139 | true (user click) | ✅ | Comportement nominal — le clic utilisateur déclenche `input` puis `submit` trusted | 2026-04-17 | QA session soirée |
| Bitwarden | Autofill via menu | v1.0 | Chrome 139 | true | ✅ | Détection OK. Autofill Enter → trusted | 2026-04-17 | QA session soirée |
| Vaultwarden (Bitwarden self-hosted) | Idem Bitwarden | v1.0 | Chrome 139 | true | ✅ | Comportement identique à Bitwarden upstream | 2026-04-17 | QA session soirée |
| Chrome Password Manager natif | Autofill automatique au chargement | v1.0 | Chrome 139 | **false** sur autofill silencieux | ⚠ | Filtrage `event.isTrusted=false` actif → pas de faux positif, mais aussi pas de détection. Documenté comme comportement attendu (UC-02) | 2026-04-17 | QA session soirée (TACHE-069 PR #11) |
| 1Password | Autofill via extension | — | — | — | ⏸ | Non testé v1 — Closed-source, projet OSS ne supporte que les PM open source (cf. CLAUDE.md §projet) | — | — |
| Dashlane | Autofill via extension | — | — | — | ⏸ | Non testé v1 — Closed-source (idem) | — | — |
| KeePass Desktop + auto-type | Auto-type via raccourci OS | — | — | À investiguer | 🔬 | Cas spécial : auto-type OS génère des événements keyboard au niveau natif → isTrusted=true | À planifier | — |

---

## 5. Sites cibles notables (sites testés en recette)

| Site | Type | Flux testé | Statut M7 | Commentaires | Date | Testeur |
|---|---|---|:-:|---|---|---|
| saucedemo.com | Site de test login simple (same-origin) | standard `<form>` + submit | ✅ | Référence historique — validé au post-mortem M7 2026-04-14 | 2026-04-14 | Commanditaire |
| the-internet.herokuapp.com/login | Site de test login avec redirect post-submit | form + redirect vers `/authenticate` puis `/login` | ✅ | Pattern `pending_m7_toast` (ADR-002) valide — toast conservé jusqu'à acknowledge | 2026-04-14 | Commanditaire |
| practicetestautomation.com/practice-test-login | Site de test — submit sans event natif (handler JS custom) | input password **orphelin** (hors `<form>`) | ✅ | Triggers fallback `keydown Enter` + `click submit` (cf. P-017) | 2026-04-14 | Commanditaire |
| github.com/login | Login classique same-origin | form + submit | 🔬 | À tester formellement en recette UC-01 | — | — |

---

## 6. Limitations connues transversales

| Limitation | Impact | Documenté dans | Contournement |
|---|---|---|---|
| Iframes cross-origin | M7 ne détecte pas la saisie dans une iframe cross-origin (content script non injecté) | AIPD M7 §3.2 · mini-DAT TACHE-071 | Documentation utilisateur — limite par conception |
| Autofill silencieux (isTrusted=false) | Pas de détection quand le password manager remplit sans interaction explicite | mini-DAT TACHE-069 | Volontaire (filtrage anti faux positifs) |
| Champs `autocomplete="new-password"` (signup) | Détection active mais sémantique floue (création vs réutilisation) | TACHE-064 (à faire) | À affiner en v1.1 |
| SPA avec input password ajouté comme nœud racine React | Détection manquée jusqu'à TACHE-101 mergée | Bug F-UC01-01 · mini-DAT TACHE-068 §3.1 | TACHE-101 (en cours) |

---

## 7. Process de mise à jour

### 7.1 À chaque recette manuelle

1. Le Testeur QA ajoute une ligne dans la table correspondante (§3, §4 ou §5) **avant** clôture de la tâche.
2. Renseigner **tous** les champs (pas de case vide). Si non applicable : `—`.
3. Si statut ≠ ✅, créer un ticket BACKLOG correspondant (BUG ou TÂCHE) et le référencer dans "Commentaires".

### 7.2 À chaque remontée externe (issue GitHub, retour utilisateur)

1. Créer ou mettre à jour la ligne du provider concerné.
2. Passer le statut à ⚠ ou ❌ selon gravité.
3. Référencer l'issue GitHub : `#<numéro>`.

### 7.3 Revue trimestrielle (Architecte logiciel)

1. Vérifier que tous les statuts 🔬 ont été finalisés ou requalifiés.
2. Vérifier que tous les statuts ⚠ ont un ticket ouvert ou résolu.
3. Mettre à jour les versions "Extension" et "Navigateur" à la release courante si le comportement reste nominal.
4. Signer la revue en §9 (Historique).

### 7.4 À chaque release

1. La matrice est intégrée aux **release notes** (section "Providers supportés").
2. Un diff des changements de statut est résumé dans le CHANGELOG.

---

## 8. Liens BACKLOG

| Tâche | Titre | Lien avec la matrice |
|---|---|---|
| TACHE-068 | UC-01 Login multi-étape | Alimente §3 (Google, Microsoft) |
| TACHE-069 | UC-02 Password managers | Alimente §4 (KeePassXC, Bitwarden, Chrome PM) — **déjà effectué** |
| TACHE-101 | Correctif F-UC01-01 observeDynamicForms React | Pré-requis pour TC-UC01-01 Google ✅ |
| TACHE-117 | Maintenance périodique matrice providers | Assurance de la mise à jour régulière |

---

## 9. Historique

| Date | Version | Modification | Auteur |
|---|---|---|---|
| 2026-04-18 | 1.0 | Création initiale — squelette + données issues du post-mortem M7 + recettes TACHE-069 (UC-02) | Orchestrateur (Fabrique) |

---

*Livrable vivant — ne pas figer. Pour toute évolution, ajouter une ligne dans §9.*
