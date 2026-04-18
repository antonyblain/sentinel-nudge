# Mini-DAT — TACHE-068 — UC-01 : Login multi-étape (Google / Microsoft / Okta)

**Version** : 1.1  
**Date** : 2026-04-18  
**Auteur** : Architecte logiciel  
**Statut** : **Validé par le Commanditaire** — arbitrages ARB-068-01/02/03 tranchés (A/A/A)  
**Tâche couverte** : TACHE-068 (UC-01 bloquant v1)  
**Phase** : P5  
**Niveau de sensibilité** : Exposé  

---

## Historique des versions

| Version | Date       | Modifications                     |
|---------|------------|-----------------------------------|
| 1.0     | 2026-04-17 | Version initiale Architecte logiciel |
| 1.1     | 2026-04-18 | Arbitrages Commanditaire A/A/A intégrés · §14 Matrice de compatibilité providers ajoutée · Périmètre recette : Google + Microsoft (Okta reporté hors v1) |

---

## 1. Contexte et objectif

### 1.1 Cas d'usage identifié au post-mortem M7

Le PV post-mortem M7 (2026-04-14, section 4.1) classe UC-01 en **P0 bloquant pour la release v1**. Le risque formulé est : « domaine de l'email ≠ domaine de la page password sur certains flows SSO. Risque de hash mal rattaché. »

TACHE-068 est rattachée à ce cas d'usage avec pour objectif : tester la détection M7 sur les flux email → password séparés et documenter le comportement de `location.hostname` à chaque étape.

### 1.2 Principe du login multi-étape

Les grands fournisseurs d'identité (Google, Microsoft, Okta) ont progressivement adopté un flux de connexion en deux étapes distinctes :

- **Step 1 (Identification)** : saisie de l'adresse e-mail ou de l'identifiant. Le champ est `type="email"` ou `type="text"`, jamais `type="password"`.
- **Step 2 (Authentification)** : saisie du mot de passe. Le champ est `type="password"`. Le formulaire est soumis à cette étape.

Ce modèle introduit une rupture par rapport au formulaire classique email + password sur une seule page. Sentinel Nudge doit comprendre ce qu'il observe dans chacun des contextes.

### 1.3 Impact sur la détection M7

Le module M7 (`password-detector.ts`) capture la valeur du champ `type="password"` au moment de la soumission du formulaire (stratégie submit + Enter + click bouton submit). Il calcule :

```
hash = SHA-256(installation_salt + password_value)
domain_hash = SHA-256(installation_salt + location.hostname)
```

La valeur de `location.hostname` au moment du submit Step 2 est la clé de rattachement du hash dans `password_hashes`. Si le hostname change entre Step 1 et Step 2 (cas Microsoft, Okta), seul le hostname de Step 2 est utilisé pour le hash. Ce comportement est décrit dans les Cas B et C ci-dessous.

### 1.4 Objectif de ce mini-DAT

Documenter pour chaque variante de login multi-étape :
1. Le comportement observable de `location.hostname` à chaque step.
2. La conséquence sur le stockage M7 (`password_hashes` keyed par `domain_hash`).
3. L'interaction avec le pattern `pending_m7_toast` (ADR-002) et le filtre de formulaire de création (`isCreationForm`).
4. Les options architecturales disponibles.
5. Les arbitrages à soumettre au Commanditaire.
6. Les risques nouveaux et les contrôles de sécurité applicables.

---

## 2. Cas identifiés

### Cas A — Google (`accounts.google.com` → `accounts.google.com`)

| Propriété | Step 1 | Step 2 |
|-----------|--------|--------|
| URL exemple | `https://accounts.google.com/v3/signin/identifier` | `https://accounts.google.com/v3/signin/challenge/pwd` |
| `location.hostname` | `accounts.google.com` | `accounts.google.com` |
| Type du champ saisi | `type="email"` (non capturé) | `type="password"` (capturé) |
| Navigation | SPA React — pas de navigation complète entre les steps | SPA React — pas de navigation complète entre les steps |

**Analyse** :

Google utilise un routage SPA (Single-Page Application). La page ne recharge pas entre Step 1 et Step 2 : React remplace dynamiquement le contenu du DOM. `location.hostname` reste `accounts.google.com` tout au long du flux.

Le content script `password-detector.ts` est injecté une seule fois à `document_idle` et reste actif. Le `MutationObserver` (`observeDynamicForms`) détecte l'apparition du champ `type="password"` quand React l'insère dans le DOM au Step 2.

**Comportement M7** :
- Step 1 : aucun champ `type="password"` → aucune action M7.
- Step 2 : champ `type="password"` détecté par `observeDynamicForms` → `registerPasswordInput()` → submission capturée → `domain_hash = SHA-256(salt + "accounts.google.com")`.

**Verdict** : **détection nominale attendue après correctif TACHE-101** (F-UC01-01). En l'état du code actuel, un champ `type="password"` inséré comme nœud racine React peut ne pas être détecté.

**Cas limite F-UC01-01 (TACHE-101)** : si le champ `type="password"` est ajouté comme nœud racine directement par React (sans wrapper), `querySelectorAll('input[type="password"]', addedNode)` ne l'inclut pas. TACHE-101 documente le correctif `node.matches('input[type="password"]')`. Ce correctif est un prérequis pour la couverture complète du Cas A en SPA.

---

### Cas B — Microsoft (`login.microsoftonline.com` → redirect vers `login.live.com`)

| Propriété | Step 1 | Step 2 |
|-----------|--------|--------|
| URL exemple | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` | `https://login.live.com/login.srf?...` |
| `location.hostname` | `login.microsoftonline.com` | `login.live.com` |
| Type du champ saisi | `type="email"` ou `type="text"` | `type="password"` |
| Navigation | Navigation complète (HTTP redirect 302) entre les steps | Nouvelle page |

**Analyse** :

Microsoft effectue une **navigation complète** entre Step 1 (saisie de l'email sur `login.microsoftonline.com`) et Step 2 (saisie du mot de passe sur `login.live.com`). Les deux pages ont des **hostnames distincts**.

Le content script est réinjecté sur `login.live.com` au Step 2. Le `location.hostname` au moment de la soumission du mot de passe est `login.live.com`.

**Comportement M7** :
- Step 1 : aucun champ `type="password"` sur `login.microsoftonline.com` → aucune action M7.
- Step 2 : champ `type="password"` sur `login.live.com` → `domain_hash = SHA-256(salt + "login.live.com")`.
- Le hash est stocké associé à `login.live.com`, pas à `login.microsoftonline.com`.

Si l'utilisateur utilise le même mot de passe sur un autre site dont le `domain_hash` correspond, M7 détectera correctement la réutilisation. Le hash est rattaché au bon hostname (celui de la page de saisie effective).

**Question de recette** : l'isCreationForm heuristic (URL keywords, boutons d'inscription) doit être vérifiée sur `login.live.com` — aucun mot-clé d'inscription attendu sur ces URL Microsoft.

**Verdict** : **détection correcte sur le plan fonctionnel**. Le hash est associé à `login.live.com` (hostname effectif de Step 2). C'est le comportement sémantiquement juste : l'utilisateur a soumis son mot de passe sur ce hostname.

---

### Cas C — Okta (`<tenant>.okta.com` → IdP fédéré)

| Propriété | Step 1 | Step 2 (Okta natif) | Step 2 (IdP fédéré) |
|-----------|--------|----------------------|----------------------|
| URL exemple | `https://company.okta.com/login/login.htm` | `https://company.okta.com/login/login.htm` | `https://sso.company.com/idp/...` ou `https://login.microsoftonline.com/...` |
| `location.hostname` | `company.okta.com` | `company.okta.com` | `sso.company.com` ou `login.microsoftonline.com` |
| Type du champ saisi | `type="email"` puis `type="password"` sur même page (flux simplifié) | `type="password"` | `type="password"` |

**Analyse** :

Okta présente deux variantes selon la configuration du tenant :

1. **Flux Okta natif** : email et password sur la même page ou via AJAX (SPA Okta). `location.hostname = company.okta.com`. Comportement similaire au Cas A.

2. **Flux fédéré (SAML/OIDC)** : Okta redirige vers un IdP externe (ADFS, Azure AD, custom SSO). Le Step 2 (saisie du mot de passe) se produit sur le domaine de l'IdP, potentiellement très différent du tenant Okta d'entrée.

**Comportement M7 (flux fédéré)** :
- `domain_hash` = SHA-256(salt + hostname de l'IdP externe). Ce hash est correct : c'est bien sur l'IdP que le mot de passe est saisi.
- Risque sémantique : l'utilisateur peut avoir des comptes différents sur des tenants Okta différents qui redirigent vers le même IdP — deux utilisateurs distincte sur le même IdP partagent potentiellement le même `domain_hash` (mais le `installation_salt` les distingue).

**Verdict** : **comportement correct sur le plan de la sécurité**. Le hash est associé au hostname réel de saisie. La détection de réutilisation est sémantiquement précise.

---

### Cas D — Champ email Step 1 non capturé (comportement nominal)

**Analyse** :

Le champ de l'étape 1 (email/identifiant) est de type `type="email"` ou `type="text"`. Le filtre `querySelectorAll('input[type="password"]')` dans `password-detector.ts` ne le sélectionne pas. De même, `_snPasswordInputs` (registre UC-05) n'enregistre ce champ que s'il a présenté `type="password"` à un moment donné, ce qui n'est pas le cas pour un champ email.

**Conséquence** :
- Le hash calculé au Step 2 ne mélange jamais la valeur de l'email avec celle du mot de passe.
- Il n'y a pas de faux positif de type "email hashé comme password".
- Le filtre `isCreationForm` doit être vérifié pour s'assurer qu'un formulaire de type "email seul" (Step 1) n'est pas interprété comme un formulaire de création. La présence d'un lien "mot de passe oublié" (signal `a[href*="forgot"]`) peut orienter dans le bon sens.

**Verdict** : **comportement nominal et correct**. Le Step 1 est transparent pour M7. Aucune modification requise pour ce cas.

---

## 3. Impacts techniques

### 3.1 Stabilité de `location.hostname` entre les steps

| Cas | Stabilité | Impact M7 |
|-----|-----------|-----------|
| A — Google SPA | Stable (même hostname) | Nominal — hash associé à `accounts.google.com` |
| B — Microsoft redirect | Instable (redirect cross-domain) | Hash associé à `login.live.com` (Step 2) — correct |
| C — Okta natif | Stable | Nominal |
| C — Okta fédéré | Instable (redirect vers IdP) | Hash associé au hostname de l'IdP — correct |
| D — Champ email Step 1 | Sans objet (pas de champ password) | Transparent |

**Conclusion** : la variabilité de `location.hostname` entre Step 1 et Step 2 n'est **pas un problème** pour M7. Le module capture uniquement le Step 2 (champ `type="password"`), et c'est le hostname de Step 2 qui est utilisé — ce qui est sémantiquement juste.

### 3.2 Cohérence du stockage M7 `password_hashes` (hostname-keyed)

Le store `password_hashes` est indexé par `domain_hash`. La structure actuelle est :

```
password_hashes[i] = {
  value: CipherText(hash),  // AES-256-GCM
  iv: Array<number>,
  tag: string,              // 8 chars hex (pré-filtrage)
  domain_hash: string,      // SHA-256(salt + location.hostname de Step 2)
}
```

Pour le Cas B, les hashes de `login.live.com` et de `login.microsoftonline.com` sont dans des "namespaces" distincts (domain_hash distincts). Si l'utilisateur utilise le même mot de passe sur `login.live.com` et sur un site tiers, la détection de réutilisation s'effectuera correctement car les deux hashes partagent la même valeur chiffrée (même mot de passe) mais des `domain_hash` distincts (filtre `candidate.domain_hash === domainHash` n'écarte pas l'autre domaine).

**Aucune modification de la structure de stockage n'est requise** pour les cas A, B, C, D.

### 3.3 Interaction avec `pending_m7_toast` (ADR-002 / TACHE-091)

Le pattern `pending_m7_toast` (clé `chrome.storage.local`) est écrit **avant** le retour `show` au content script, avec `expires_at = Date.now() + TTL_MS (10 min)`.

Pour le login multi-étape, le scénario critique est :
- Submit Step 2 → M7 détecte réutilisation → écrit `pending_m7_toast` → envoie `show` au content script.
- Le site redirige immédiatement après le submit (post-login redirect vers le dashboard ou la page d'application).
- Le content script sur la nouvelle page lit `pending_m7_toast` via `storage.onChanged` et affiche le toast.

Ce flux est identique au cas de base documenté dans l'ADR-002 (incident P-019, site Herokuapp). **Aucune adaptation du pattern n'est nécessaire pour UC-01**.

Le `domain_hash` stocké dans `pending_m7_toast` correspond au hostname de Step 2. Le toast affiché sur la page de destination est cohérent avec ce hash.

### 3.4 Interaction avec `initBoot` M7 (ADR-001)

La boot sequence du SW (`initBoot`) est indépendante du flux de login multi-étape. Le contrat de boot (lire → valider → régénérer → logger) s'exécute à chaque réveil du SW, avant tout traitement de message `password_submitted`.

Aucun impact de UC-01 sur ADR-001.

### 3.5 Interaction avec le filtre `isCreationForm`

La fonction `isCreationForm` dans `password-detector.ts` filtre les formulaires de création (inscription) pour éviter les faux positifs M7 sur les champs `new-password`. Les heuristiques incluent :
- `autocomplete="new-password"` → création
- 2+ champs password dans le formulaire → création
- Mots-clés d'inscription dans l'URL
- Boutons d'inscription dans le DOM
- Présence d'un champ email sans lien "forgot password"

Pour les pages de login multi-étape (Step 2 uniquement) :
- Pas d'`autocomplete="new-password"` attendu sur `login.live.com`, `accounts.google.com`, `<tenant>.okta.com`.
- Un seul champ password au Step 2.
- URL et boutons de type "connexion", pas "inscription".
- Lien "mot de passe oublié" fréquemment présent.

**Verdict** : le filtre `isCreationForm` ne devrait pas produire de faux négatif (retourner `true` sur une page de login). À vérifier en recette manuelle (TC-UC01-04).

### 3.6 Interaction avec le cross-lifecycle-intent et ADR-002

Le `pending_m7_toast` écrit au Step 2 doit survivre à la post-login redirect. La durée de redirect typique (< 5 secondes) est très inférieure au TTL de 10 minutes. Pour les flows SSO complexes (Okta fédéré avec plusieurs redirects intermédiaires), le TTL de 10 minutes couvre les cas courants. Une chaîne de redirects de plus de 10 minutes constitue un edge case extrêmement rare.

---

## 4. Options architecturales

### Option A — Comportement actuel préservé (hash par hostname de Step 2 uniquement)

**Description** : aucune modification du code. Le hash M7 est associé au `location.hostname` de la page Step 2. La détection est fonctionnelle pour tous les cas A, B, C, D selon l'analyse ci-dessus.

**Avantages** :
- Zéro code à écrire — TACHE-068 se conclut par une documentation + recette manuelle.
- Sémantiquement correct : le hash est associé au point de saisie effectif du mot de passe.
- Minimisation des données : aucune corrélation Step 1 / Step 2.
- Compatible avec l'AIPD M7 existante (pas de traitement nouveau).
- Conforme R-CLI-07 (payload minimisé dans les intents).

**Inconvénients** :
- Sur le Cas B (Microsoft), si l'utilisateur pense à `login.microsoftonline.com` comme "le site Microsoft", le hash stocké sous `login.live.com` peut sembler découplé de son intention. Mais cela n'affecte pas la détection.
- Un bug F-UC01-01 (TACHE-101) peut masquer la détection Google SPA si le champ `type="password"` est inséré comme nœud racine React — correctif documenté, à implémenter.

**Recommandation architecturale** : **Option à privilégier pour v1**.

---

### Option B — Tracking cross-hostname via `pending_m7_email_step1`

**Description** : au Step 1, si l'utilisateur soumet un formulaire contenant un champ `type="email"`, le content script écrit un intent `pending_m7_email_step1 = { email_domain_hash, expires_at }` dans `chrome.storage.local`. Au Step 2, le content script lit cet intent et peut corréler les deux steps.

**Avantages** :
- Permettrait de construire une association Step 1 / Step 2 pour des analytics ou une corrélation de flux.

**Inconvénients** :
- Complexité significative : nouveau intent, nouveau consommateur, nouvelle logique de corrélation.
- Sensibilité RGPD élevée : l'adresse email hashée (même avec salt) est un identifiant indirect de l'utilisateur. La dérivation `email_domain_hash` doit être traitée dans l'AIPD.
- Aucune valeur ajoutée pour la détection M7 : la détection de réutilisation ne dépend pas du Step 1 (seul le mot de passe est hashé).
- Augmente la surface de stockage dans `chrome.storage.local` (quota ~5 Mo) — accumulation d'intents si Step 2 n'est jamais atteint.
- Contredit le principe YAGNI : aucun besoin fonctionnel identifié.

**Recommandation architecturale** : **Option à rejeter pour v1**.

---

### Option C — Documentation + recette manuelle Google/Microsoft/Okta sans code change

**Description** : confirmer formellement par recette manuelle sur 3 comptes réels que le comportement actuel (Option A) est nominal, et documenter les résultats dans un PV de recette daté.

**Avantages** :
- Concrétise la couverture UC-01 sans risque de régression.
- Produit une preuve auditée du comportement réel sur les flows SSO majeurs.
- Compatible avec le niveau Exposé (PV de recette obligatoire pour les UC P0).

**Inconvénients** :
- Dépend de la disponibilité de comptes réels Google / Microsoft / Okta trial pour la recette.
- Le bug F-UC01-01 (TACHE-101) doit être résolu avant la recette Google SPA pour garantir la fiabilité des résultats.

**Recommandation architecturale** : **Complémentaire à Option A — à réaliser dans tous les cas**.

---

## 5. Arbitrages proposés

### ARB-068-01 — Option retenue pour UC-01

**Question** : L'Option A (comportement actuel préservé, hash par hostname Step 2) est-elle suffisante pour valider UC-01 bloquant v1, ou faut-il implémenter l'Option B (tracking cross-hostname) ?

**Options** :
- A — Préserver le comportement actuel + recette manuelle (Option A + C). Zéro code ajouté, TACHE-068 close sur documentation.
- B — Implémenter le tracking cross-hostname (Option B). Charge élevée, valeur ajoutée nulle pour la détection.

**Recommandation** : **Option A**. Le comportement actuel est sémantiquement correct. La détection de réutilisation est fonctionnelle. L'Option B n'apporte aucun bénéfice de sécurité mesurable et introduit une complexité et une surface RGPD non justifiées.

**✅ Décision Commanditaire (2026-04-18) : Option A retenue.** Aucun code M7 ajouté pour UC-01, fermeture de la tâche sur documentation (matrice providers + recette manuelle).

---

### ARB-068-02 — Traitement du bug F-UC01-01 (TACHE-101) avant ou après recette

**Question** : Faut-il implémenter le correctif F-UC01-01 (TACHE-101 — `observeDynamicForms` ne détecte pas les inputs React ajoutés comme nœud racine) **avant** la recette manuelle Google SPA, ou peut-on effectuer la recette en état actuel et documenter la limite ?

**Options** :
- A — Implémenter TACHE-101 avant la recette. Résultat : recette validante sur Google SPA. Effort : faible (1 ligne de correctif documentée).
- B — Effectuer la recette sans TACHE-101 et accepter un éventuel échec sur Google SPA, documenté comme limite connue.

**Recommandation** : **Option A**. Le correctif est minimal (une ligne), bien documenté, et garantit que la recette Google reflète l'état cible plutôt qu'un bug connu.

**✅ Décision Commanditaire (2026-04-18) : Option A retenue.** TACHE-101 implémentée en parallèle par le Développeur, recette Google SPA effectuée uniquement après merge de la PR T-101.

---

### ARB-068-03 — Périmètre de la recette manuelle UC-01

**Question** : La recette manuelle UC-01 doit-elle couvrir les 3 providers (Google, Microsoft, Okta) ou peut-elle se limiter à Google + Microsoft ?

**Options** :
- A — 3 providers (Google, Microsoft, Okta trial). Couverture maximale. Nécessite un compte Okta trial (disponible gratuitement).
- B — 2 providers (Google + Microsoft). Couvre Cas A et Cas B. Okta fédéré est un edge case moins fréquent.

**Recommandation** : **Option A** si un compte Okta trial est accessible. Le flux fédéré Okta est distinct des deux autres et mérite d'être documenté. Recette sur `<tenant>.okta.com` natif suffit (pas besoin d'un vrai IdP fédéré pour valider le comportement).

**✅ Décision Commanditaire (2026-04-18) : Option A retenue (= A du nouveau barème) — périmètre Google + Microsoft pour v1.** Okta reporté hors v1 (pas de compte trial à provisionner maintenant). La matrice de compatibilité providers (§14) recense au fur et à mesure les providers testés — Okta pourra être ajouté en v1.1 sans rouvrir le mini-DAT.

---

## 6. Analyse STRIDE ciblée UC-01

| Menace | Catégorie STRIDE | Vecteur | Mesure |
|--------|-----------------|---------|--------|
| **Hostname Spoofing** | Spoofing | Un site malveillant imite `accounts.google.com` en MITM ou via un typosquatting (ex. `accounts.g00gle.com`). Le hash est associé au faux hostname, non à `accounts.google.com`. | Traitement aval de M2 (détection typosquatting, signaux HTTP/HSTS). M7 seul ne défend pas contre ce vecteur — cohérent avec la limite documentée R-003. |
| **Tampering de `pending_m7_intent`** | Tampering | Une extension tierce ayant permission `storage` réécrit `pending_m7_toast` entre l'émission et la consommation pour substituer un `domain_hash` arbitraire → toast trompeur. | R-CLI-04 (purge atomique one-shot). Le toast affiche uniquement le domain_hash, jamais la valeur en clair. Impact limité : nuisance, pas de fuite de données. Cohérent avec R-003 accepté. |
| **Information Disclosure cross-tenant** | Information Disclosure | Dans le Cas C Okta fédéré, plusieurs tenants Okta pointent vers le même IdP. Le `domain_hash` de l'IdP est identique pour tous ces tenants. Un utilisateur ayant deux comptes Okta sur le même IdP peut voir une "réutilisation" alors qu'il s'agit du même compte IdP sur des contextes d'entreprises différents. | Le `installation_salt` est unique par installation : deux utilisateurs distincts ne partagent jamais le même `domain_hash`. Pour un utilisateur unique avec deux tenants Okta, la détection est un vrai positif (même mot de passe sur deux services différents via le même IdP). Comportement sémantiquement correct. |
| **Step 1 Skipped** | Tampering | Un attaquant injecte directement un message `password_submitted` avec un `domain_hash` forgé au SW, en bypassant le content script. | Le SW ne valide pas l'authenticité du `sender.tab` (R-003). Hors modèle de menace extension (si l'extension est compromise, toutes ses APIs le sont). Cohérent avec R-004. |
| **Flood de `pending_m7_toast`** | Tampering / DoS | Un script malveillant de la page génère en boucle des submits pour remplir `pending_m7_toast` et polluer le chrome.storage.local. | M7 est dans CRITICAL_MODULES mais le cooldown 30j par domaine et la suppression_list limitent le taux de déclenchement effectif. Le déduplicateur `isDuplicateSubmit` (2s) absorbe les rafales. R-UC03-07 accepté. |

---

## 7. Invariants de sécurité (INV-SEC) spécifiques UC-01

### INV-UC01-01

Le `domain_hash` transmis dans `password_submitted` est calculé exclusivement à partir du `location.hostname` de la page Step 2 (page de saisie effective du mot de passe). Il n'inclut jamais le hostname du Step 1, ni l'adresse email, ni le chemin URL.

### INV-UC01-02

Le payload `password_submitted` ne contient jamais la valeur en clair du mot de passe ni de l'email. Il contient uniquement `hash` (SHA-256 salé du mot de passe) et `domain_hash` (SHA-256 salé du hostname Step 2).

### INV-UC01-03

Le `pending_m7_toast` ne contient jamais l'URL complète de la page Step 2 ni le hostname en clair. Il contient uniquement `domain_hash` et `expires_at` (ADR-002, R-CLI-07).

### INV-UC01-04

Le filtre `isCreationForm` ne doit jamais retourner `true` sur une page de connexion multi-étape légitime (Step 2 d'un flux SSO standard). Ce comportement est garanti par l'absence de marqueurs d'inscription (`new-password`, mots-clés signup, champ de confirmation) sur ces pages.

### INV-UC01-05

En cas de chaîne de redirects post-login (Step 2 → page intermédiaire SSO → dashboard), le `pending_m7_toast` doit survivre à chaque redirect grâce au TTL de 10 minutes et au listener `storage.onChanged`. Le premier content script chargé sur une page non-interstitielle consomme et purge l'intent (one-shot, R-CLI-04).

---

## 8. Nouveaux risques identifiés

### R-UC01-01 — Hash cross-hostname : confusion sémantique Step 1 / Step 2

| Attribut | Valeur |
|----------|--------|
| Description | Sur les flows Microsoft (Cas B), le hash est associé à `login.live.com` alors que l'utilisateur identifie subjectivement son compte comme "le compte Microsoft" (associé à `login.microsoftonline.com`). Si l'utilisateur réutilise le même mot de passe sur un autre site et sur `login.live.com`, M7 détecte correctement la réutilisation — mais l'utilisateur peut ne pas reconnaître `login.live.com` comme "son compte Microsoft" dans le toast. |
| Catégorie | UX / Fonctionnel |
| Probabilité | 2 (Possible) |
| Impact | 1 (Négligeable — la protection est effective, seule la lisibilité du toast est affectée) |
| Score | 2 |
| Mesure | Le toast affiche uniquement le `domain_hash` (non lisible) — pas le hostname en clair. Le risque de confusion reste interne à l'utilisateur, sans impact sur la protection réelle. Documenter dans la page `reutilisation-mots-de-passe.html` que la détection porte sur le site de saisie du mot de passe. |
| Responsable | Architecte logiciel + Expert UX/UI |
| Statut | Accepté |

---

### R-UC01-02 — Step 1 skipped : utilisateur naviguant directement vers Step 2

| Attribut | Valeur |
|----------|--------|
| Description | Sur certains flows SSO (deep link vers une page de password directe), l'utilisateur peut arriver directement sur le Step 2 sans être passé par le Step 1. M7 capture normalement le submit du Step 2. Aucun comportement anormal, mais la recette manuelle doit vérifier l'absence de bug sur ce parcours. |
| Catégorie | Fonctionnel |
| Probabilité | 2 (Possible — deep links d'authentification courants en SSO enterprise) |
| Impact | 1 (Négligeable — la détection est nominale dans ce cas) |
| Score | 2 |
| Mesure | Ajouter un scénario TC-UC01-03 (deep link vers Step 2 direct) dans la recette manuelle. |
| Responsable | Testeur QA |
| Statut | Ouvert — couvert par le plan de tests |

---

### R-UC01-03 — `isCreationForm` faux positif sur page Step 2 SSO atypique

| Attribut | Valeur |
|----------|--------|
| Description | Sur un IdP fédéré Okta atypique (tenant personnalisé avec URL d'inscription et de connexion sur la même page, boutons en langue non prévue dans les heuristiques DOM), `isCreationForm` pourrait retourner `true` et filtrer silencieusement le submit Step 2 de M7. |
| Catégorie | Fonctionnel |
| Probabilité | 1 (Rare — les IdP majeurs suivent des patterns UI standardisés) |
| Impact | 2 (Modéré — faux négatif de détection : M7 ne détecte pas une réutilisation sur ce site) |
| Score | 2 |
| Mesure | Vérifier `isCreationForm` en recette manuelle Okta (TC-UC01-02). Si le faux positif se confirme, affiner les heuristiques ou ajouter une exception pour les domaines `*.okta.com`. |
| Responsable | Testeur QA + Développeur |
| Statut | Ouvert — à surveiller en recette |

---

### R-UC01-04 — `pending_m7_toast` expiré lors d'une chaîne de redirects SSO longue

| Attribut | Valeur |
|----------|--------|
| Description | Certains flows SSO enterprise (Okta fédéré + ADFS + SAML multi-hop) peuvent enchaîner plusieurs redirects sur plusieurs secondes. Si la chaîne dépasse 10 minutes (improbable mais théoriquement possible sur des systèmes très lents), le `pending_m7_toast` expire avant d'être consommé par le content script de la page de destination. |
| Catégorie | Fonctionnel |
| Probabilité | 1 (Rare — 10 minutes est un TTL très généreux pour un redirect SSO) |
| Impact | 2 (Modéré — le toast est perdu, M7 ne signale pas la réutilisation pour cette session) |
| Score | 2 |
| Mesure | TTL 10 minutes accepté (R-M7-03 existant). Si des retours terrain remontent ce problème, envisager d'augmenter le TTL ou de le rendre configurable. Documenter dans la recette. |
| Responsable | Architecte logiciel |
| Statut | Accepté |

---

## 9. Contrôles ISO 27001 mobilisés

| Contrôle ISO 27001:2022 | Libellé | Applicabilité UC-01 |
|------------------------|---------|---------------------|
| **A.8.24** | Utilisation de la cryptographie | Hash SHA-256 salé du hostname Step 2 + chiffrement AES-256-GCM des hashes stockés. Inchangé pour UC-01. |
| **A.8.12** | Prévention de la fuite de données (DLP) | INV-UC01-02 : le payload `password_submitted` ne contient jamais le mot de passe en clair ni l'email. INV-UC01-03 : `pending_m7_toast` ne contient jamais le hostname en clair. |
| **A.8.28** | Codage sécurisé | Correction F-UC01-01 (TACHE-101) : `node.matches('input[type="password"]')` avant `querySelectorAll`. Filtre `isCreationForm` vérifié en recette. |
| **A.5.7** | Renseignement sur les menaces | Cas d'usage documentés dans ce mini-DAT (threat model UC-01). Enrichissement du référentiel de menaces M7. |
| **A.8.8** | Gestion des vulnérabilités techniques | Bug F-UC01-01 formalisé en TACHE-101 avec correction documentée. Traçabilité BACKLOG. |
| **A.8.15** | Journalisation | Incidents M7 loggués via `incidentService` (ADR-001). Aucun log de hostname en clair (R-M7-08). |
| **A.8.16** | Surveillance des activités | `diagnostics.m7` (heartbeat) : indépendant du flow UC-01. La détection sur `login.live.com` ou `accounts.google.com` met à jour `last_detection_ts`. |

---

## 10. Impact RGPD / AIPD

### 10.1 `location.hostname` comme donnée personnelle indirecte

Le `domain_hash = SHA-256(installation_salt + location.hostname)` est une donnée pseudonymisée. Le `location.hostname` brut n'est jamais stocké ni transmis.

Pour UC-01, les hostnames impliqués (`accounts.google.com`, `login.live.com`, `login.microsoftonline.com`, `<tenant>.okta.com`) sont des domaines de fournisseurs d'infrastructure d'authentification. Leur présence dans la liste des domaines hashés révèle indirectement que l'utilisateur dispose d'un compte Google, Microsoft, ou sur un tenant Okta spécifique.

**Caractérisation** : cette corrélation implicite est inhérente au fonctionnement de M7 (détection de réutilisation inter-domaines nécessite de stocker des domaines hashés). Elle est couverte par l'AIPD M7 v1.0 (traitement basé sur le consentement explicite, durée 90 jours, droit à l'effacement en 1 clic).

**Impact sur l'AIPD M7 v1.0** : UC-01 n'introduit pas de nouvelle catégorie de données. Les domaines d'authentification SSO étaient implicitement couverts dans l'AIPD (tous les sites avec un champ `type="password"`). Une note de clarification dans l'AIPD serait souhaitable pour mentionner explicitement les domaines SSO de type `login.live.com`, `accounts.google.com`, `<tenant>.okta.com` comme exemples concrets de données pseudonymisées traitées.

### 10.2 Absence de traitement de l'adresse email

Conformément à INV-UC01-01, l'adresse email saisie au Step 1 n'est jamais traitée par M7. Le Cas D confirme que le filtre `type="password"` est la barrière suffisante. L'AIPD M7 n'a pas besoin de couvrir le traitement des emails.

### 10.3 `pending_m7_toast` et minimisation

Conformément à INV-UC01-03 et R-CLI-07, le `pending_m7_toast` contient uniquement `domain_hash` + `expires_at`. Aucune URL complète, aucun hostname en clair, aucune donnée permettant une réidentification directe. La minimisation des données est respectée.

### 10.4 Recommandation DPO

Rattaché à **TACHE-084** (élargissement scope : inventaire domaines SSO UC-01 ajouté). Aucune nouvelle entrée BACKLOG créée. TACHE-084, initialement dédiée à l'inventaire exhaustif des champs loggés par TACHE-061, voit son périmètre étendu pour inclure l'inventaire des domaines SSO Google/Microsoft/Okta traités par UC-01. La note de clarification AIPD (domaines SSO explicitement cités) sera produite dans ce cadre.

---

## 11. Plan d'implémentation

### 11.1 Tâches développeur

| ID | Titre | Priorité | Prérequis |
|----|-------|----------|-----------|
| T-068-DEV-01 | Implémenter le correctif F-UC01-01 (TACHE-101) : `node.matches('input[type="password"]')` dans `observeDynamicForms` avant `querySelectorAll` | Should | Aucun |

Note : si ARB-068-01 valide l'Option A, **aucune autre tâche de développement** n'est requise pour UC-01. Le comportement actuel est fonctionnellement correct.

### 11.2 Tâches QA

| ID | Titre | Priorité | Prérequis |
|----|-------|----------|-----------|
| T-068-QA-01 | Recette manuelle TC-UC01-01 — Google SPA : login multi-étape email → password, vérifier détection M7 | Must | T-068-DEV-01 (TACHE-101) |
| T-068-QA-02 | Recette manuelle TC-UC01-02 — Microsoft redirect : login `login.microsoftonline.com` → `login.live.com`, vérifier hash rattaché à `login.live.com` | Must | Aucun |
| T-068-QA-03 | Recette manuelle TC-UC01-03 — Deep link Step 2 direct : naviguer directement vers la page de saisie du mot de passe, vérifier détection nominale | Should | Aucun |
| T-068-QA-04 | Recette manuelle TC-UC01-04 — `isCreationForm` sur page SSO : vérifier que le filtre ne bloque pas le submit password Step 2 sur Google, Microsoft, Okta | Must | Aucun |
| T-068-QA-05 | Recette manuelle TC-UC01-05 — Okta natif (si compte disponible) : login `<tenant>.okta.com`, vérifier détection M7 | Could | Compte Okta trial |

### 11.3 Résumé des tâches

| Catégorie | Nombre |
|-----------|--------|
| Tâches développeur | 1 (TACHE-101, déjà au BACKLOG) |
| Tâches QA (recette) | 5 (TC-UC01-01 à TC-UC01-05) |
| TACHE-084 (scope étendu) | DPO |
| **Total** | **6 + DPO** |

---

## 12. Tests de recette manuelle

### TC-UC01-01 — Google SPA : login multi-étape

**Pré-conditions** :
- Extension Sentinel Nudge installée et M7 activé.
- Compte Google réel disponible.
- TACHE-101 (correctif F-UC01-01) implémentée et buildée.
- Ouvrir chrome://extensions → Service Worker → DevTools ouvert sur onglet Network et Application → Storage.
- Dans DevTools Application → Storage → IndexedDB → `sentinel-nudge-db` → `password_hashes` : noter le nombre d'entrées avant le test.

**Given** : L'utilisateur ouvre `https://accounts.google.com` et clique sur "Se connecter".

**When** :
1. Step 1 : saisir l'adresse email → cliquer "Suivant".
2. Vérifier que le DOM est mis à jour dynamiquement (SPA React) — pas de reload de page.
3. Step 2 : saisir le mot de passe dans le champ `type="password"` → cliquer "Suivant".
4. Attendre la navigation post-login vers le dashboard Google.

**Then** :
- Dans DevTools → Application → `password_hashes` : une nouvelle entrée est apparue avec `domain_hash` correspondant à `SHA-256(salt + "accounts.google.com")`.
- Dans `chrome.storage.local` : clé `pending_m7_toast` absente (consommée) OU toast M7 affiché sur la page de destination si réutilisation détectée.
- Aucun toast M7 affiché au Step 1 (champ email non capturé).
- Aucune erreur dans les logs du Service Worker.

**Critère de succès P0** : le hash est stocké avec `domain_hash` = SHA-256 salé de `accounts.google.com`.

---

### TC-UC01-02 — Microsoft redirect : cross-hostname Step 1 → Step 2

**Pré-conditions** :
- Extension Sentinel Nudge installée et M7 activé.
- Compte Microsoft réel disponible.
- DevTools ouvert sur Service Worker.

**Given** : L'utilisateur ouvre `https://login.microsoftonline.com` ou une URL de connexion Microsoft.

**When** :
1. Step 1 : saisir l'adresse email/compte Microsoft → cliquer "Suivant".
2. Observer la navigation vers `https://login.live.com/...`.
3. Step 2 : saisir le mot de passe sur `login.live.com` → cliquer "Se connecter".
4. Attendre la navigation post-login.

**Then** :
- Dans `password_hashes` : une nouvelle entrée avec `domain_hash` correspondant à `SHA-256(salt + "login.live.com")` — et NON à `SHA-256(salt + "login.microsoftonline.com")`.
- Aucune entrée avec le `domain_hash` de `login.microsoftonline.com` (aucun champ password sur ce hostname).
- Si réutilisation détectée : toast M7 affiché sur la page de destination avec le `domain_hash` de `login.live.com`.

**Critère de succès P0** : le hash est stocké exclusivement sous le hostname de Step 2 (`login.live.com`).

---

### TC-UC01-03 — Deep link Step 2 direct

**Pré-conditions** :
- Extension Sentinel Nudge installée et M7 activé.
- Compte Google ou Microsoft réel disponible.

**Given** : L'utilisateur accède directement à une URL de saisie de mot de passe (Step 2) sans passer par Step 1 (ex. lien dans un email de notification Google qui pointe directement sur la page de password).

**When** : Saisir le mot de passe dans le champ `type="password"` → soumettre le formulaire.

**Then** :
- M7 capture la soumission normalement.
- Hash stocké avec `domain_hash` du hostname courant.
- Aucune erreur ou comportement anormal.

**Critère de succès P0** : détection nominale sans le Step 1 préalable.

---

### TC-UC01-04 — Filtre `isCreationForm` sur page SSO

**Pré-conditions** :
- Extension Sentinel Nudge installée et M7 activé.
- Accès aux DevTools (console content script ou Service Worker).

**Given** : L'utilisateur est sur la page Step 2 de saisie de mot de passe (Google, Microsoft ou Okta).

**When** : Saisir le mot de passe → observer si M7 se déclenche.

**Then** :
- M7 traite bien la soumission (pas de skip silencieux dû à `isCreationForm` = true).
- Dans les logs SW : message `password_submitted` traité (action `no_reuse` ou `show` selon l'historique).
- Aucun message `isCreationForm=true` ou `skip reason='creation_form'` dans les logs.

**Critère de succès P0** : `isCreationForm` retourne `false` sur toutes les pages Step 2 testées.

---

### TC-UC01-05 — Okta natif (conditionnel)

**Pré-conditions** :
- Compte Okta trial créé (disponible gratuitement sur developer.okta.com).
- Extension installée et M7 activé.

**Given** : L'utilisateur ouvre la page de connexion du tenant Okta (`https://<dev-tenant>.okta.com/login/login.htm`).

**When** : Saisir email → password → soumettre.

**Then** :
- Hash stocké avec `domain_hash` = SHA-256(salt + `<dev-tenant>.okta.com`).
- Détection M7 nominale (si réutilisation détectée : toast ou entrée `no_reuse` dans les logs).
- `isCreationForm` retourne `false`.

**Critère de succès Could** : détection fonctionnelle sur tenant Okta.

---

## 13. Références

| Référence | Lien |
|-----------|------|
| PV post-mortem M7 | `docs/gouvernance/gouvernance-pv-postmortem-m7-v1.0.md` §4.1 |
| ADR-001 SW-BOOT-CONTRACT | `docs/adr/adr-001-sw-boot-contract.md` |
| ADR-002 CROSS-LIFECYCLE-INTENT | `docs/adr/adr-002-cross-lifecycle-intent.md` |
| Mini-DAT TACHE-061 (référence heartbeat) | `docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md` |
| Mini-DAT TACHE-070 (référence iframes) | `docs/p4-conception/p5-minidat-tache-070-uc03-iframes-v1.0.md` §2.2 (en cours de validation) |
| TACHE-101 (correctif F-UC01-01) | BACKLOG.md |
| TACHE-068 (tâche source) | BACKLOG.md |
| AIPD M7 | `docs/p3-architecture/p3-aipd-m7-v1.0.md` |
| Référentiel ISO 27001 v1.1 | `docs/securite/referentiel-iso27001.md` |
| RISQUES.md — R-M7-03, R-M7-04 | `.claude/RISQUES.md` |

---

*Document produit par l'Architecte logiciel — Fabrique Sentinel Nudge — 2026-04-17, v1.1 2026-04-18*  
*Niveau Exposé : arbitrages ARB-068-01/02/03 tranchés (A/A/A) par le Commanditaire le 2026-04-18*

---

## 14. Matrice de compatibilité providers M7 (livrable vivant)

Le Commanditaire a demandé (2026-04-18) qu'une matrice recense **au fur et à mesure** les providers testés avec M7, leur statut de compatibilité, et les éventuelles limitations observées. Ce livrable est **dynamique** : il est enrichi à chaque recette manuelle, à chaque retour utilisateur, à chaque bug remonté.

**Emplacement** : `docs/p5-recette/matrice-compatibilite-providers-m7.md`

**Structure attendue** (colonnes) :

| Colonne | Description |
|---|---|
| Provider | Nom commercial (Google, Microsoft, Okta, Bitwarden, KeePassXC…) |
| Catégorie | IdP / Password Manager / Site cible |
| Flux testé | URL(s) du flux + type (multi-étape, fédéré, SPA, autofill, toggle…) |
| Version testée | Navigateur + version extension Sentinel Nudge |
| Hostname Step 1 / Step 2 | Observations sur la stabilité `location.hostname` |
| Détection M7 | ✅ Compatible / ⚠ Partielle / ❌ Non compatible / ⏸ Reporté |
| Commentaires | Limitations, contournements, liens vers issues/PR |
| Date recette | YYYY-MM-DD |
| Testeur | Rôle (Testeur QA / Commanditaire / Contributeur) |

**Règles de maintenance** :

1. Toute recette manuelle UC-01 alimente cette matrice avant clôture de la tâche.
2. Tout bug remonté sur un provider spécifique ouvre une ligne avec statut ⚠ ou ❌ + référence au ticket BACKLOG.
3. Les contributions externes (issues GitHub après publication repo public) alimentent cette matrice via PR du mainteneur.
4. La matrice est **publique** (dépôt open source) — elle sert également de documentation utilisateur sur les providers supportés.

**Liens avec les tâches BACKLOG** : TACHE-117 créée pour garantir la maintenance périodique de cette matrice.

---

## Historique des révisions

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| v1.0 | 2026-04-17 | Architecte logiciel | Production initiale + corrections QC (AB-01, NB-01/02/03) |
