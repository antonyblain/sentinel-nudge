# Matrice de compatibilité providers M7 — Sentinel Nudge

**Statut** : Livrable vivant (mis à jour au fil des recettes)
**Version** : 1.1
**Création** : 2026-04-18
**Dernière révision** : 2026-04-20
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
| :-: | --- | --- |
| ✅ | Compatible — détection M7 fonctionnelle sur le flux testé | Aucune |
| ⚠ | Partiellement compatible — détection OK dans certains cas mais limitations connues | Lien vers ticket BACKLOG (limitation documentée) |
| ❌ | Non compatible — M7 ne détecte pas la réutilisation sur ce provider | Ticket BUG ou TÂCHE obligatoire + mention en FAQ |
| ⏸ | Reporté — provider identifié comme utile à tester mais non couvert pour la version actuelle | Ticket TÂCHE dans BACKLOG (priorité Could) |
| 🔬 | En cours de test — recette en cours, résultat non figé | Aucun statut officiel tant que la recette n'est pas close |

---

## 3. Providers IdP (Identity Providers / SSO)

| Provider | Flux testé | Extension | Navigateur | Hostname Step 1 → Step 2 | Statut | Commentaires | Date recette | Testeur |
| --- | --- | --- | --- | --- | :-: | --- | --- | --- |
| Google | `accounts.google.com` (SPA multi-étape email puis password) | v1.0 (post T-101) | Chrome 139 | `accounts.google.com` → `accounts.google.com` (stable) | 🔬 | Recette prévue après merge TACHE-101 (correctif F-UC01-01) | TC-UC01-01 | À faire |
| Microsoft | `login.microsoftonline.com` → redirect `login.live.com` | v1.0 | Chrome 139 | `login.microsoftonline.com` → `login.live.com` (change) | 🔬 | Cas cross-hostname — hash Step 2 associé à `login.live.com` uniquement (comportement validé par ARB-068-01 Option A) | TC-UC01-02 | À faire |
| Okta | `<tenant>.okta.com` (Universal Directory) | — | — | `<tenant>.okta.com` → `<tenant>.okta.com` (stable, sauf SAML redirect) | ⏸ | Non testé — à planifier v1.1. Flow multi-étape classique (identifier-first : email sur Step 1, password sur Step 2, même hostname). Reporté hors v1 (ARB-068-03 Option A = Google + Microsoft uniquement) | — | — |
| GitLab.com SSO | `gitlab.com/users/sign_in` | — | — | `gitlab.com` → `gitlab.com` (stable) | ⏸ | Non testé — à planifier v1.1. Form login standard same-origin. Cas nominal : hostname stable, flow classique non multi-étape. Non couvert v1 | — | — |
| Auth0 | `<tenant>.auth0.com` (Universal Login) | — | — | `<tenant>.auth0.com` → callback applicatif (change) | ⏸ | Non testé — à planifier v1.1. Identity-as-a-service : Universal Login hébergé sur sous-domaine tenant. Redirect OAuth/OIDC post-auth vers callback applicatif = changement hostname probable → cas proche Microsoft | — | — |
| Keycloak (self-hosted) | `<host>/realms/<realm>/protocol/openid-connect/auth` | — | — | `<host>` → callback applicatif (change) | ⏸ | Non testé — à planifier v1.1. IdP open source auto-hébergé. URL configurable par déploiement — tester sur instance de référence Keycloak 24+. Flow multi-étape selon policies realm. Redirect OIDC post-auth = changement hostname | — | — |
| AWS Cognito | `<userpool>.auth.<region>.amazoncognito.com/login` | — | — | `<userpool>.auth.<region>.amazoncognito.com` → callback applicatif (change) | ⏸ | Non testé — à planifier v1.1. Cloud SSO Amazon — Hosted UI sur domaine Cognito propriétaire. Redirect OAuth post-auth vers callback applicatif = changement hostname garanti. Cas structurellement proche de Auth0 | — | — |
| Azure AD B2C | `<tenant>.b2clogin.com/<tenant>.onmicrosoft.com/<policy>/oauth2/v2.0/authorize` | — | — | `<tenant>.b2clogin.com` → callback applicatif (change) | ⏸ | Non testé — à planifier v1.1. Cloud consumer Microsoft. URL complexe avec policy intégrée (B2C_1_signupsignin). Domaine b2clogin distinct de login.microsoftonline.com. Redirect OAuth post-auth = changement hostname | — | — |
| Discord OAuth | `discord.com/oauth2/authorize` (Authorization Code) | — | — | `discord.com` → callback applicatif (change) | ⏸ | Non testé — à planifier v1.1. Consumer gaming/communautaire. Login form sur discord.com, redirect OAuth vers application tierce post-auth = changement hostname. Cas d'usage : login applicatif via compte Discord | — | — |

---

## 4. Providers Password Managers

| Provider | Méthode remplissage | Extension | Navigateur | isTrusted sur submit ? | Statut | Commentaires | Date recette | Testeur |
| --- | --- | --- | --- | --- | :-: | --- | --- | --- |
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
| --- | --- | --- | :-: | --- | --- | --- |
| saucedemo.com | Site de test login simple (same-origin) | standard `<form>` + submit | ✅ | Référence historique — validé au post-mortem M7 2026-04-14 | 2026-04-14 | Commanditaire |
| the-internet.herokuapp.com/login | Site de test login avec redirect post-submit | form + redirect vers `/authenticate` puis `/login` | ✅ | Pattern `pending_m7_toast` (ADR-002) valide — toast conservé jusqu'à acknowledge | 2026-04-14 | Commanditaire |
| practicetestautomation.com/practice-test-login | Site de test — submit sans event natif (handler JS custom) | input password **orphelin** (hors `<form>`) | ✅ | Triggers fallback `keydown Enter` + `click submit` (cf. P-017) | 2026-04-14 | Commanditaire |
| github.com/login | Login classique same-origin | form + submit | 🔬 | À tester formellement en recette UC-01 | — | — |

---

## 6. Limitations connues transversales

| Limitation | Impact | Documenté dans | Contournement |
| --- | --- | --- | --- |
| Iframes cross-origin | M7 ne détecte pas la saisie dans une iframe cross-origin (content script non injecté) | AIPD M7 §3.2 · mini-DAT TACHE-071 | Documentation utilisateur — limite par conception |
| Autofill silencieux (isTrusted=false) | Pas de détection quand le password manager remplit sans interaction explicite | mini-DAT TACHE-069 | Volontaire (filtrage anti faux positifs) |
| Champs `autocomplete="new-password"` (signup) | Détection active mais sémantique floue (création vs réutilisation) | TACHE-064 (à faire) | À affiner en v1.1 |
| SPA avec input password ajouté comme nœud racine React | Détection manquée jusqu'à TACHE-101 mergée | Bug F-UC01-01 · mini-DAT TACHE-068 §3.1 | TACHE-101 (en cours) |
| Providers cloud SSO avec redirect OAuth (Cognito, Azure AD B2C, Auth0, Keycloak) | Redirect post-auth vers callback applicatif = changement hostname garanti → cas cross-hostname à valider | §3 providers ⏸ | À couvrir lors des recettes v1.1 — même pattern que Microsoft (ARB-068-01 Option A) |

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
4. Signer la revue en §10 (Historique).

### 7.4 À chaque release

1. La matrice est intégrée aux **release notes** (section "Providers supportés").
2. Un diff des changements de statut est résumé dans le CHANGELOG.

---

## 8. Cadence de maintenance

### 8.1 Revue trimestrielle obligatoire — providers grand public

Providers concernés : **Google**, **Microsoft**, **GitHub**, **GitLab.com SSO**, **Discord OAuth**.

Ces providers modifient régulièrement leurs flows d'authentification (A/B tests UI, changements de domaines, nouvelles politiques MFA). Une revue trimestrielle est obligatoire.

Actions :

1. Re-tester le flux complet sur chaque provider (Step 1 + Step 2 si multi-étape).
2. Vérifier que les hostnames Step 1/Step 2 n'ont pas changé.
3. Mettre à jour le statut et la date de recette dans §3.
4. Si régression détectée : créer ticket BUG dans BACKLOG + passer statut ❌ ou ⚠.

Responsable : **Testeur QA**.

### 8.2 Revue semestrielle optionnelle — providers enterprise

Providers concernés : **Okta**, **Auth0**, **Keycloak**, **AWS Cognito**, **Azure AD B2C**.

Ces providers ont des cycles de release plus longs et des configurations tenant-spécifiques. Une revue semestrielle est recommandée dès qu'un de ces providers est utilisé en production par des utilisateurs identifiés.

Actions :

1. Vérifier les notes de release du provider (breaking changes sur le flow d'auth).
2. Re-tester sur instance de référence si disponible (Keycloak : instance interne ; Cognito/Auth0 : tenant de test).
3. Mettre à jour le statut dans §3.

Responsable : **Testeur QA** + **Architecte logiciel** si changement structurel de flow détecté.

### 8.3 Déclencheur événementiel — régression signalée

Applicable à tout provider, quelle que soit la cadence planifiée.

Déclencheur : signalement utilisateur d'une non-détection sur un provider (issue GitHub, retour direct, rapport de bug).

Actions :

1. Re-tester le provider concerné dans les **48 h** suivant le signalement.
2. Mettre à jour le statut (⚠ ou ❌) et référencer l'issue GitHub dans "Commentaires".
3. Créer ticket BUG dans BACKLOG si régression confirmée.
4. Notifier en commentaire de l'issue GitHub avec le résultat du re-test.

Responsable : **Testeur QA**.

---

## 9. Liens BACKLOG

| Tâche | Titre | Lien avec la matrice |
| --- | --- | --- |
| TACHE-068 | UC-01 Login multi-étape | Alimente §3 (Google, Microsoft) |
| TACHE-069 | UC-02 Password managers | Alimente §4 (KeePassXC, Bitwarden, Chrome PM) — **déjà effectué** |
| TACHE-101 | Correctif F-UC01-01 observeDynamicForms React | Pré-requis pour TC-UC01-01 Google ✅ |
| TACHE-117 | Maintenance périodique matrice providers | Assurance de la mise à jour régulière — v1.1 (T-117 Could) |

---

## 10. Historique

| Date | Version | Modification | Auteur |
| --- | --- | --- | --- |
| 2026-04-18 | 1.0 | Création initiale — squelette + données issues du post-mortem M7 + recettes TACHE-069 (UC-02) | Orchestrateur (Fabrique) |
| 2026-04-20 | 1.1 | Ajout 7 providers mineurs (Okta détaillé, GitLab détaillé, Auth0 détaillé, Keycloak, AWS Cognito, Azure AD B2C, Discord OAuth) + section §8 cadence maintenance + limitation transversale redirect OAuth — T-117 Could | Testeur QA (Fabrique) |

---

_Livrable vivant — ne pas figer. Pour toute évolution, ajouter une ligne dans §10._
