# Analyse comparative des licences open source — Sentinel Nudge
## Phase P1 — Analyste métier

**Projet :** Sentinel Nudge
**Version :** 1.0
**Date de production :** 2026-04-11
**Statut :** Soumis au Commanditaire
**Commanditaire :** Antony (RSSI)

---

## 1. Contexte et besoin

Sentinel Nudge est un projet open source. Le choix de la licence conditionne :
- Ce que les tiers peuvent faire avec le code (modifier, redistribuer, vendre)
- Les obligations des tiers (attribution, partage sous la même licence, non-commercialisation)
- La compatibilité avec les dépendances utilisées

**Contrainte exprimée par le Commanditaire :** ne pas permettre que le projet soit utilisé pour vendre des produits ou services à des tiers sans contribution en retour.

---

## 2. Licences analysées

### 2.1 MIT License (permissive)

| Critère | Valeur |
|---------|--------|
| Type | Permissive |
| Attribution requise | Oui (copyright + texte licence) |
| Copyleft | Non |
| Usage commercial | Autorisé sans restriction |
| Modification | Autorisée sans obligation de partage |
| Distribution de versions modifiées | Autorisée sans obligation de partage du code source |
| Brevets | Pas de clause explicite |
| Compatibilité | Maximale (compatible avec quasi toutes les licences) |

**Avantages :** Adoption maximale, simplicité, aucune friction pour les contributeurs.
**Inconvénients :** Aucune protection contre l'exploitation commerciale. Une entreprise peut prendre le code, le modifier, le vendre en version propriétaire sans rien reverser.

**Exemples :** React, jQuery, Node.js.

### 2.2 Apache License 2.0 (permissive avec brevets)

| Critère | Valeur |
|---------|--------|
| Type | Permissive |
| Attribution requise | Oui (NOTICE file + mention des modifications) |
| Copyleft | Non |
| Usage commercial | Autorisé sans restriction |
| Modification | Autorisée, obligation de mentionner les changements |
| Distribution de versions modifiées | Autorisée sans obligation de partage du code source |
| Brevets | Clause de protection brevets (rétorsion si action en justice) |
| Compatibilité | Très large (compatible GPL v3) |

**Avantages :** Protection contre les revendications de brevets, attribution plus rigoureuse que MIT.
**Inconvénients :** Même problème que MIT concernant l'exploitation commerciale.

**Exemples :** Kubernetes, Android, TensorFlow.

### 2.3 GNU GPL v3 (copyleft fort)

| Critère | Valeur |
|---------|--------|
| Type | Copyleft fort |
| Attribution requise | Oui |
| Copyleft | Oui — tout dérivé doit être sous GPL v3 |
| Usage commercial | Autorisé, mais le code dérivé doit rester open source |
| Modification | Autorisée, obligation de partage sous GPL v3 |
| Distribution de versions modifiées | Obligatoirement sous GPL v3 avec code source disponible |
| Brevets | Protection brevets incluse |
| Compatibilité | Restrictive (incompatible avec licences permissives dans le sens inverse) |

**Avantages :** Garantit que tout dérivé reste open source. Empêche l'appropriation propriétaire.
**Inconvénients :** Peut décourager les contributions d'entreprises qui ne veulent pas ouvrir leur code. Effet "viral" : tout logiciel lié doit être GPL.

**Exemples :** Linux kernel, GCC, WordPress.

### 2.4 GNU AGPL v3 (copyleft réseau)

| Critère | Valeur |
|---------|--------|
| Type | Copyleft fort + clause réseau |
| Attribution requise | Oui |
| Copyleft | Oui — même pour les services en ligne (SaaS) |
| Usage commercial | Autorisé, mais le code doit rester open source même en SaaS |
| Modification | Autorisée, obligation de partage sous AGPL v3 |
| Distribution / SaaS | Code source obligatoirement disponible pour les utilisateurs du service |
| Brevets | Protection brevets incluse |
| Compatibilité | Très restrictive |

**Avantages :** La plus protectrice contre l'exploitation SaaS. Ferme le "loophole" GPL (services en ligne sans distribution).
**Inconvénients :** Très dissuasif pour les entreprises. Non pertinent ici : Sentinel Nudge est une extension navigateur, pas un SaaS.

**Exemples :** Nextcloud, Mattermost, Vaultwarden.

### 2.5 Mozilla Public License 2.0 (copyleft faible, par fichier)

| Critère | Valeur |
|---------|--------|
| Type | Copyleft faible (par fichier) |
| Attribution requise | Oui |
| Copyleft | Par fichier uniquement — les fichiers modifiés doivent rester MPL 2.0, mais les nouveaux fichiers ajoutés peuvent être sous une autre licence |
| Usage commercial | Autorisé |
| Modification | Autorisée, obligation de partage uniquement pour les fichiers modifiés |
| Distribution de versions modifiées | Les fichiers MPL modifiés doivent être partagés ; les ajouts peuvent être propriétaires |
| Brevets | Protection brevets incluse |
| Compatibilité | Bonne (compatible GPL v2/v3) |

**Avantages :** Compromis équilibré. Protège le code original (les fichiers modifiés doivent rester ouverts) tout en permettant des extensions propriétaires. Peu dissuasif pour les contributeurs.
**Inconvénients :** La granularité par fichier peut être contournée en créant de nouveaux fichiers qui importent le code MPL sans le modifier directement. Protection plus faible que GPL contre l'appropriation systématique.

**Exemples :** Firefox, Rust, LibreOffice.

### 2.6 European Union Public License 1.2 (EUPL)

| Critère | Valeur |
|---------|--------|
| Type | Copyleft faible à moyen |
| Attribution requise | Oui |
| Copyleft | Oui — tout dérivé distribué doit être sous licence compatible (EUPL, GPL, AGPL, MPL, etc.) |
| Usage commercial | Autorisé, mais code dérivé distribué doit rester open source |
| Modification | Autorisée, obligation de partage du code modifié |
| Distribution de versions modifiées | Sous EUPL ou licence compatible listée en annexe |
| Brevets | Protection brevets incluse |
| Compatibilité | Excellente (liste explicite de licences compatibles en annexe, dont GPL v2/v3, AGPL, MPL, LGPL, etc.) |

**Avantages :** Conçue pour le droit européen (juridiquement valide dans les 23 langues de l'UE). Copyleft modéré. Reconnue par l'OSI. Très bonne compatibilité avec d'autres licences copyleft. Adaptée aux projets financés/soutenus par des organismes européens.
**Inconvénients :** Moins connue dans l'écosystème JavaScript/extension navigateur. Moins de jurisprudence que GPL.

**Exemples :** Projets de la Commission européenne, GovStack.

---

## 3. Matrice de décision

| Critère | MIT | Apache 2.0 | GPL v3 | AGPL v3 | MPL 2.0 | EUPL 1.2 |
|---------|-----|-----------|--------|---------|---------|----------|
| Empêche l'exploitation commerciale propriétaire | Non | Non | Oui | Oui | Partiellement | Oui |
| Protection contre le SaaS | Non | Non | Non | Oui | Non | Non |
| Compatibilité dépendances | Maximale | Très large | Restrictive | Très restrictive | Bonne | Excellente |
| Attractivité contributeurs | Maximale | Haute | Moyenne | Faible | Haute | Moyenne |
| Protection brevets | Non | Oui | Oui | Oui | Oui | Oui |
| Conformité droit européen | Neutre | Neutre | Neutre | Neutre | Neutre | Optimale |
| Simplicité juridique | Maximale | Haute | Moyenne | Faible | Haute | Moyenne |
| Adapté extension navigateur | Oui | Oui | Oui | Non pertinent | Oui | Oui |

---

## 4. Recommandation

Compte tenu des contraintes exprimées :
- **Interdire l'exploitation commerciale propriétaire** (produits/services vendus sans contribution)
- **Rester attractif pour les contributeurs open source**
- **Extension navigateur** (pas de SaaS — AGPL non pertinent)
- **Projet européen** (RSSI basé en France, CNIL, RGPD)

### Option recommandée : **GPL v3**

**Raisons :**
1. Garantit que toute version dérivée reste open source et redistribuable
2. Empêche structurellement qu'une entreprise prenne le code pour le vendre en version propriétaire
3. Licence la plus connue et la plus éprouvée juridiquement dans cette catégorie
4. Compatible avec les dépendances JavaScript courantes (la plupart sont MIT ou Apache, donc intégrables dans un projet GPL)
5. Linux, WordPress, et des milliers de projets majeurs prouvent que GPL n'empêche pas l'adoption

**Risque à accepter :** Certaines entreprises évitent de contribuer à des projets GPL. Pour Sentinel Nudge, ce risque est faible car le projet cible des utilisateurs individuels et la communauté sécurité, pas des intégrateurs d'entreprise.

### Option alternative : **MPL 2.0**

Si la GPL v3 semble trop restrictive pour attirer des contributeurs, la MPL 2.0 offre un bon compromis :
- Le code Sentinel Nudge reste ouvert (tout fichier modifié doit être partagé)
- Des extensions propriétaires sont possibles dans de nouveaux fichiers (non souhaitable mais tolérable)
- Très bonne compatibilité, peu dissuasive

### Option à écarter pour ce projet

- **MIT / Apache 2.0** : ne répondent pas à la contrainte anti-exploitation commerciale
- **AGPL v3** : surdimensionné (pas de composante SaaS), trop dissuasif
- **EUPL 1.2** : intéressante juridiquement pour un projet européen, mais moins connue dans l'écosystème des extensions navigateur — à reconsidérer si le projet reçoit un financement institutionnel européen

---

## 5. Décision demandée

**Trois options :**

| Option | Licence | Protection commerciale | Attractivité contributeurs |
|--------|---------|----------------------|---------------------------|
| A (recommandée) | GPL v3 | Forte | Moyenne |
| B | MPL 2.0 | Modérée | Haute |
| C | EUPL 1.2 | Forte | Moyenne (moins connue) |

Le Commanditaire est invité à choisir l'option qui correspond le mieux à sa vision du projet.

---

*Analyse produite par l'Analyste métier — Fabrique — Phase P1*
*Version 1.0 — 2026-04-11*
