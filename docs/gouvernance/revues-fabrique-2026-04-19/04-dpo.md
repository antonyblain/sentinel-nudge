# Revue DPO — Périmètre RGPD / AIPD / Registre Art. 30 / Politique de confidentialité

**Date** : 2026-04-19
**Auteur** : DPO (Fabrique)
**Périmètre** : protection des données personnelles, conformité RGPD, AIPD M7, registre Art. 30, politique de confidentialité, droits Art. 12-22, coordination Architecte sécurité
**Niveau de sensibilité projet** : Exposé
**Documents de référence consultés** :
- `docs/p3-architecture/p3-aipd-m7-v1.2.md` (AIPD M7, dernière version)
- `docs/p3-architecture/p3-aipd-m7-v1.1.md` (référence comparative)
- `docs/p3-architecture/p3-aipd-m7-v1.0.md` (référence historique)
- `docs/rgpd/politique-de-confidentialite-v1.1.md`
- `docs/rgpd/politique-de-confidentialite-v1.0.md`
- `docs/rgpd/registre-des-traitements-v1.0.md` (v1.1 **non livrée**, voir §3)
- `docs/p4-conception/p5-minidat-tache-061-heartbeat-m7-v1.1.md` (registre m7_incidents)
- `docs/p3-architecture/p3-dat-v1.4.md` (section 17 — algorithmes de hachage)
- `docs/securite/runbook-reponse-incident.md` (procédure incident)
- `docs/securite/referentiel-iso27001.md` v1.1
- `.claude/SESSION.md`, `.claude/BACKLOG.md`, `.claude/RISQUES.md`

---

## 1. Bilan général

Le périmètre DPO de Sentinel Nudge présente un **niveau de maturité élevé** sur l'axe livrables principaux (AIPD M7 v1.2, politique de confidentialité v1.1, registre Art. 30 v1.0) et sur l'axe **alignement éditorial user-friendly** post-T-154 (codes module M2/M7 remplacés par titres parlants, suppression du jargon « micro-nudges »). La triple qualification responsable de traitement (utilisateur / Antony Blain particulier / éditeur navigateur) est documentée, la base légale par module est explicite (Art. 6.1.a opt-in M7, Art. 6.1.f intérêt légitime pour les autres, Art. 6.1.b pour les paramètres), et les droits Art. 15-22 sont opérationnels in-app via les boutons « Exporter mes données » et « Supprimer toutes mes données ».

Néanmoins **trois écarts importants** ressortent de cette revue :
1. La tâche **TACHE-074** (transmission formelle du mini-DAT TACHE-061 §11.3 au DPO + note de validation officielle) est **toujours À faire** dans le BACKLOG. L'AIPD v1.2 §6.5 ne contient qu'une **pré-validation conceptuelle**, pas une note additive officielle.
2. La tâche **TACHE-115** (note DPO sur le circuit de saisine systématique pour incidents M7) est **À faire**. Aucune note RGPD additive n'a été versionnée pour formaliser l'articulation runbook ↔ AIPD ↔ Art. 33/34.
3. La tâche **TACHE-155** (registre Art. 30 v1.1 user-friendly, miroir de T-154) est **À faire**. Le registre actuel `registre-des-traitements-v1.0.md` reste avec des titres techniques `RT-M2`, `RT-M7`, etc., ce qui crée une **désynchronisation éditoriale** avec la politique v1.1 et l'AIPD v1.2 (qui utilisent les titres user-friendly).

Le passage du repo en visibilité publique (TACHE-112) est imminent et impacte directement la transparence/auditabilité, mais n'introduit **aucun nouveau traitement** au sens RGPD : Dependabot, Security Advisories, GitHub Issues sont des outils GitHub (pas de qualification responsable de traitement Sentinel Nudge sur ces flux — voir §5).

**Verdict global** : périmètre **conforme RGPD** sur le fond (pas de risque immédiat pour les personnes concernées), mais **trois livrables documentaires manquants** doivent être produits avant clôture définitive du cycle v1 et avant publication Chrome Web Store.

---

## 2. Périmètre couvert — état des livrables

| Livrable | Version | Statut | Date | Conformité éditoriale user-friendly (post T-154) |
|---|---|---|---|---|
| AIPD M7 | v1.2 | Validée Commanditaire (commit 7fedf32) | 2026-04-19 | Oui — titres user-friendly + annexe correspondance code module |
| Politique confidentialité | v1.1 | Validée Commanditaire (commit 7fedf32) | 2026-04-19 | Oui — codes M<N> remplacés intégralement |
| Registre Art. 30 | v1.0 | Validé orchestrateur 2026-04-18 (T-128) | 2026-04-18 | **Non — RT-M2/RT-M7… restent techniques** (T-155 À faire) |
| Note DPO compatibilité TACHE-061 / AIPD (T-074) | — | **Non livrée** | — | — |
| Note DPO circuit incidents M7 (T-115) | — | **Non livrée** | — | — |

### 2.1 AIPD M7 v1.2

L'AIPD couvre intégralement le traitement « Alerte mots de passe réutilisés » (M7) avec :
- 1 base légale : Art. 6.1.a (consentement explicite, opt-in onboarding étape 4)
- 9 catégories de données détaillées dans le tableau §1.3, dont les **logs minimisés** (§1.8 — 13 sites logger inventoriés post-TACHE-083)
- 5 risques (R1-R5) cartographiés, niveau résiduel global **faible à modéré acceptable**
- Mesures techniques (10), organisationnelles (5), juridiques (5)
- Avis formel positif inchangé v1.0 → v1.1 → v1.2
- Annexe A — table de correspondance code module (M2/M7…) ↔ titre user-friendly (« Protection contre les sites frauduleux », « Alerte mots de passe réutilisés »…)

### 2.2 Politique confidentialité v1.1

La politique est **alignée RGPD Art. 12-14** (information transparente, langage clair) et couvre :
- Triple qualification responsable de traitement (§2)
- 7 fonctionnalités × finalité × base légale (§3) — **6 Art. 6.1.f + 1 Art. 6.1.a + Art. 6.1.b implicite paramètres**
- Catégories de données par fonctionnalité (§4)
- Caractère 100% local (§5), aucun destinataire (§6), aucun transfert hors UE (§9)
- Durées de conservation (§7) — alignées avec AIPD §1.3 et registre §3.5
- Droits Art. 15-22 (§8) — exerçables in-app
- Limites assumées (§11) — iframes cross-origin, gestionnaires propriétaires, SSO multi-hostname, sync navigateur, accès profil compromis
- Canal signalement RGPD (§12) — GitHub Issues + Security Advisories + saisine DPO
- Autorité de contrôle CNIL (§13) — adresse complète

### 2.3 Registre Art. 30 v1.0

Le registre couvre **8 traitements** : RT-M2, RT-M3, RT-M5, RT-M6, RT-M7, RT-M9, RT-M17, RT-PARAM. Pour chacun : finalité, base légale, catégories de données, destinataires (aucun), durée de conservation, mesures techniques/organisationnelles, lien ISO 27001. La section §9 documente la **responsabilité conjointe de fait** (Art. 26) avec l'éditeur du navigateur. Section §8 : registre des violations vide à ce jour (aucune VIOL-001 ouverte).

---

## 3. Périmètre manquant

### 3.1 Note DPO compatibilité TACHE-061 / AIPD (T-074) — **manquante**

Le mini-DAT TACHE-061 v1.1 §11.3 introduit le store IndexedDB `m7_incidents` (registre circulaire FIFO 500 entrées) pour tracer les anomalies M7 (boot_fail, key_regenerated, canary_reinit, etc.). L'AIPD v1.2 §6.5 contient une **pré-validation conceptuelle** mais TACHE-074 demande explicitement une **note additive formelle** documentant :

- Acceptation du store `m7_incidents` au regard de l'Art. 5.1.c (minimisation)
- Validation des 4 conditions DPO listées dans AIPD §6.5 v1.2 :
  1. Aucun champ interdit (`err.message` brut, hostname, password_hash, salt, URL complète, contenu input)
  2. `context` minimisé (enum, compteurs, error_name, hint court)
  3. Registre purgé (FIFO 500) et **exclu de l'export Art. 20 par défaut**
  4. UI Options « Voir mon registre d'incidents » + « Vider mon registre d'incidents » (transparence + droit Art. 17 local)
- Position formelle du DPO sur la **TTL temporelle** : aujourd'hui le store est borné par cardinalité (FIFO 500) sans TTL temporelle. Pour un usage diagnostic local, c'est acceptable, mais une **TTL 365 jours** complémentaire renforcerait la conformité Art. 5.1.e (limitation de la conservation).

**Recommandation** : produire `docs/rgpd/note-dpo-tache-061-compatibilite-aipd-v1.0.md` (~150-300 lignes) et **bumper l'AIPD en v1.3** pour intégrer définitivement la validation et l'éventuelle TTL 365j.

### 3.2 Note DPO circuit incidents M7 (T-115) — **manquante**

Le runbook `docs/securite/runbook-reponse-incident.md` mentionne :
- §2 (Rôles) : « DPO évalué systématiquement pour tout incident touchant M7 ou confidentialité des données utilisateurs. Décide si une notification CNIL (72h) et une notification utilisateurs sont requises. »
- §3.2 : « Tout incident impliquant une donnée à caractère personnel ou un risque CNIL déclenche automatiquement la saisine du DPO »
- Step 2 (triage) : moment de saisine DPO
- Step 7 (préparation disclosure) : validation DPO obligatoire avant notification utilisateurs

Mais **aucune note DPO formalisée** ne documente côté RGPD :
- Le circuit explicite à 6 étapes mentionné dans le brief (E1 saisine, E2 qualification, E3 décision notification CNIL, E4 décision notification personnes, E5 communication, E6 traçabilité dans registre violations §8)
- L'articulation avec Art. 33 (notification CNIL <72h depuis prise de connaissance) et Art. 34 (notification personnes concernées si risque élevé)
- Les critères de déclenchement de la notification individuelle (gravité, type de données, nombre de personnes)
- Le canal de notification utilisateurs pour une extension navigateur sans canal de communication direct (option : annonce GitHub Releases + page Options « État de santé Sentinel Nudge » T-109 + dialog d'alerte au prochain démarrage)

**Recommandation** : produire `docs/rgpd/note-dpo-circuit-incidents-m7-v1.0.md` (~200-400 lignes) avec une procédure E1-E6 formalisée et un template de notification utilisateurs.

### 3.3 Registre Art. 30 v1.1 user-friendly (T-155) — **manquant**

T-154 a livré la politique v1.1 + AIPD v1.2 user-friendly. T-155 demande le miroir sur le registre Art. 30 (priorité Could, mais essentiel pour cohérence éditoriale). À ce jour `registre-des-traitements-v1.0.md` utilise toujours `RT-M2 — Détection typosquatting et HSTS` au lieu de `RT-M2 — Protection contre les sites frauduleux`. Le document Art. 30 reste **interne** (autorités + DPO), donc la nomenclature technique est acceptable pour la traçabilité avec le DAT et le code, mais une **annexe table de correspondance** (analogue à AIPD v1.2 Annexe A) doit être ajoutée pour aligner avec la politique publique.

**Recommandation** : produire `docs/rgpd/registre-des-traitements-v1.1.md` avec titres user-friendly + annexe de correspondance + mise à jour des cross-références (politique §14 et AIPD §6.5 doivent pointer sur v1.1).

---

## 4. Cohérence cross-livrables RGPD

### 4.1 Cohérence des durées de conservation

| Donnée | Politique v1.1 §7 | Registre v1.0 §3 | AIPD v1.2 §1.3 / §2.3 | Cohérent ? |
|---|---|---|---|---|
| `password_hashes` (M7) | 90 jours glissants + FIFO 100 | 90 jours glissants | 90 jours FIFO max 100 | ✅ |
| `events` (M2/M3/M7/M17) | 90 jours glissants | 90 jours rolling (M3) | implicite via `first_seen` | ✅ |
| `quiz_sessions` (M6) | 90 jours glissants | Durée installation (M6) | hors scope AIPD M7 | ⚠️ **Désynchro politique vs registre** |
| `weekly_scores` (M3) | 52 semaines (1 an) | 90 jours rolling (M3) | hors scope AIPD M7 | ⚠️ **Désynchro politique vs registre** |
| `whitelist` (M2) | Indéfinie jusqu'à suppression | Jusqu'à suppression | Jusqu'à suppression explicite | ✅ |
| `installation_salt` | Durée de vie installation | implicite | Durée de vie installation | ✅ |
| Clé AES | Durée de vie installation | implicite | Durée de vie installation | ✅ |
| `pending_*` intents | TTL 5-10 min | TTL 5 min M17 (§3.7) | hors scope AIPD M7 | ⚠️ **Pas couvert par registre M5/M6/M7** |
| `m7_incidents` | « registre minimisé purgé selon mêmes règles » §10.4 | Mention §3.5 (mesure organisationnelle) | §1.8 + §6.5 | ⚠️ **TTL temporelle absente partout, juste FIFO 500** |

**Écart 1 — `quiz_sessions` (M6)** : politique dit « 90 jours glissants », registre dit « durée installation ». **Ambiguïté à trancher** — recommandation : aligner sur 90 jours pour cohérence avec les autres stores. Mettre à jour le registre v1.1 (T-155).

**Écart 2 — `weekly_scores` (M3)** : politique dit « 52 semaines », registre dit « 90 jours rolling ». **Incohérence formelle** — l'intention métier est de conserver 1 an d'historique pour le score hebdomadaire (vue tendances annuelles), donc la politique a raison. **Bug du registre v1.0** à corriger en v1.1.

**Écart 3 — `pending_*` intents** : couverts par politique §7 (TTL explicite) et par AIPD §1.8 (purge `onPurgeDaily`), mais pas par le registre Art. 30 par module. À ajouter en v1.1 dans RT-M5, RT-M6, RT-M7, RT-M17.

**Écart 4 — `m7_incidents` TTL temporelle** : nulle part documentée. Borne uniquement par cardinalité (FIFO 500). Pour un usage diagnostic, OK ; pour conformité Art. 5.1.e, ajouter une TTL 365j est recommandé (voir §6 recommandations).

### 4.2 Cohérence des destinataires

Cohérence parfaite sur les trois documents : **aucun destinataire**, **aucun sous-traitant** (pas de DPA Art. 28 nécessaire), **aucun transfert hors UE**. Le statut juridique « éditeur particulier sans entreprise et sans accès aux données » est uniformément documenté.

### 4.3 Cohérence des bases légales

| Module / Fonctionnalité | Politique v1.1 §3 | Registre v1.0 §2 | AIPD v1.2 §1.2 | Cohérent ? |
|---|---|---|---|---|
| M2 — Protection contre les sites frauduleux | Art. 6.1.f | Art. 6.1.f | (hors AIPD) | ✅ |
| M3 — Score de cyber-hygiène | Art. 6.1.f | Art. 6.1.f | (hors AIPD) | ✅ |
| M5 — Rappel mise à jour navigateur | Art. 6.1.f | Art. 6.1.f | (hors AIPD) | ✅ |
| M6 — Exercices sensibilisation phishing | Art. 6.1.f | Art. 6.1.f | (hors AIPD) | ✅ |
| **M7 — Alerte mots de passe réutilisés** | **Art. 6.1.a (opt-in)** | **Art. 6.1.a (opt-in)** | **Art. 6.1.a (opt-in)** | ✅ |
| Évaluation force mot de passe (zxcvbn) | Art. 6.1.f | Implicite RT-PARAM | (hors AIPD) | ⚠️ **Pas de RT dédié** |
| M9 — Alerte connexion non sécurisée | (absent — semble absorbé sous M2 ?) | Art. 6.1.f | (hors AIPD) | ⚠️ **Politique v1.1 ne liste pas explicitement M9** |
| M17 — Alerte copie de données sensibles | Art. 6.1.f | Art. 6.1.f | (hors AIPD) | ✅ |
| Paramètres extension | (implicite §4.8) | Art. 6.1.b | (hors AIPD) | ✅ |

**Écart 5 — Évaluation force du mot de passe (zxcvbn)** : la politique v1.1 §3 et §4.6 la liste comme une fonctionnalité distincte avec base Art. 6.1.f, mais **le registre Art. 30 n'a pas de fiche RT dédiée**. L'AIPD M7 ne la couvre pas car le mot de passe en création n'est jamais stocké (R-002). **Recommandation** : ajouter RT-PWDSTRENGTH dans le registre v1.1.

**Écart 6 — Module M9** : la politique v1.1 §3 cite 7 fonctionnalités (Protection sites frauduleux, Score cyber-hygiène, Rappel mise à jour, Quiz phishing, Alerte mdp réutilisés, Évaluation force, Alerte copie données sensibles) mais **omet « Alerte connexion non sécurisée » (M9)**. Le registre v1.0 a bien RT-M9. C'est une **omission** politique v1.1 à corriger en v1.2 ou via un erratum.

### 4.4 Cohérence des destinataires de l'export Art. 20

- Politique §8 : « hors empreintes brutes de la fonctionnalité Alerte mots de passe réutilisés pour protection »
- AIPD §2.2 : « Exclusion des hashes bruts de l'export de portabilité »
- AIPD §6.5 condition 3 : « Le registre [d'incidents] est exclus de l'export de portabilité Art. 20 par défaut — sauf option explicite utilisateur pour diagnostic »
- Registre §5 : « bouton Exporter mes données → fichier JSON déchiffré localement (TACHE-013 livrée) »

**Cohérence OK** mais le **registre m7_incidents** n'est ni exporté ni purgeable individuellement aujourd'hui dans la page Options. À tracer en T-074 / T-115.

### 4.5 Continuité historique du registre Art. 30

T-128 (registre v1.0 initial) → T-155 (v1.1 user-friendly À faire). La continuité est **partielle** : T-128 est marquée Terminé mais le registre v1.0 n'a **aucune section historique des versions** (contrairement à la politique et l'AIPD). À corriger en v1.1 — ajouter §11 « Historique des versions » avec ligne v1.0 (création T-128) puis v1.1 (user-friendly + corrections T-155 + ajout RT-PWDSTRENGTH + correction durées M3/M6).

---

## 5. Conformité RGPD — analyse par article

### Art. 5 — Principes (licéité, loyauté, transparence, finalité, minimisation, exactitude, conservation, intégrité, responsabilité)

- **Licéité** (5.1.a) : ✅ chaque traitement a une base légale identifiée (Art. 6.1.a/b/f).
- **Loyauté + transparence** (5.1.a) : ✅ politique v1.1 en langage clair, accessible onboarding + Options.
- **Finalité limitée** (5.1.b) : ✅ chaque RT a une finalité unique documentée. Pas de réutilisation pour autre finalité.
- **Minimisation** (5.1.c) : ✅ AIPD §2.2, registre §4 (synthèse minimisation), inventaire logs §1.8 — `Logger.errorName` substitué à `err.message` post-TACHE-083.
- **Exactitude** (5.1.d) : ✅ pas de données déclaratives stockées, donc pas de problème d'exactitude.
- **Conservation limitée** (5.1.e) : ⚠️ **TTL temporelle absente sur `m7_incidents`** (FIFO 500 sans purge temporelle). À renforcer (recommandation §6).
- **Intégrité + confidentialité** (5.1.f) : ✅ AES-256-GCM au repos, sel d'installation, factory logger minimisée.
- **Responsabilité** (5.2) : ✅ AIPD + registre + politique formalisés. Triple qualification documentée.

### Art. 6 — Bases légales

Couverture complète (voir §4.3 ci-dessus). Une seule fonctionnalité repose sur le consentement (M7) avec opt-in à l'onboarding étape 4, libre, spécifique, éclairé, univoque, révocable. Toutes les autres relèvent de l'intérêt légitime (test de mise en balance documenté en RT-M2 §3.1) ou de l'exécution du service (paramètres, RT-PARAM Art. 6.1.b).

### Art. 12-14 — Information transparente

✅ Politique v1.1 couvre :
- Identité du responsable de traitement (§2)
- Finalités et bases légales (§3)
- Catégories de données (§4)
- Destinataires (§6 — aucun)
- Transferts hors UE (§9 — aucun)
- Durées de conservation (§7)
- Droits (§8)
- Autorité de contrôle (§13)
- Existence d'une AIPD (§14, cross-référence AIPD M7)

✅ Information accessible **avant** le traitement (onboarding étape 4 pour M7, première ouverture extension pour les autres fonctionnalités intérêt légitime).

### Art. 15-22 — Droits des personnes concernées

| Droit | Implémentation | Statut |
|---|---|---|
| Art. 15 — Accès | Bouton « Exporter mes données » → JSON | ✅ TACHE-013 livrée |
| Art. 16 — Rectification | Modification paramètres in-app | ✅ Page Options |
| Art. 17 — Effacement | Bouton « Supprimer toutes mes données » | ✅ TACHE-015 livrée (dialog accessible) |
| Art. 18 — Limitation | Désactivation par fonctionnalité | ✅ Toggles Options |
| Art. 19 — Notification destinataires | Sans objet (aucun destinataire) | ✅ |
| Art. 20 — Portabilité | Export JSON local via `URL.createObjectURL()` | ✅ TACHE-013 livrée |
| Art. 21 — Opposition | Désactivation intérêt légitime par fonctionnalité | ✅ |
| Art. 22 — Décision automatisée | Sans objet (conseils non bloquants) | ✅ |

**Particularité du modèle** : tous les droits s'exercent **directement in-app**, sans intervention d'un responsable de traitement tiers. Ce modèle est cohérent avec la triple qualification (l'utilisateur est responsable de traitement de fait).

**Question opérationnelle** : faut-il **aussi** prévoir un canal email/GitHub pour les exercices de droits ? La position du DPO est **non, pas en v1**, car :
- Antony Blain (éditeur particulier) **n'a pas accès aux données** des installations utilisateurs, donc ne peut techniquement pas répondre à une demande Art. 15/17/20 même sur sollicitation
- Le canal GitHub Issues / Security Advisories est documenté pour les questions générales, signalements de vulnérabilité ou clarifications RGPD (politique §12)
- L'utilisateur ne peut adresser une demande qu'à lui-même (puisqu'il est responsable du traitement local) ou à l'éditeur du navigateur (pour la partie sync cloud, hors scope Sentinel Nudge)

Cette position est **alignée RGPD** (le particulier sans entreprise n'est pas tenu de désigner un DPO Art. 37, n'est pas tenu de fournir un canal d'exercice des droits centralisé puisqu'il ne traite aucune donnée).

### Art. 25 — Privacy by Design and by Default

✅ Documenté politique §1, AIPD §2.2 (minimisation), DAT §9.4 (D-SEC-001 à 006), registre §6 (mesures techniques). Les 7 fonctionnalités sont **désactivables individuellement**, M7 est **opt-in par défaut** (Privacy by Default), aucun appel réseau sortant, aucune télémétrie, aucun identifiant persistant.

### Art. 30 — Registre des traitements

✅ Registre v1.0 livré (T-128). 8 RT documentés. ⚠️ v1.1 user-friendly À faire (T-155). Voir §3.3 et §4.

### Art. 32 — Sécurité du traitement

Coordination avec l'Architecte sécurité — référentiel ISO 27001 v1.1 (8 contrôles + A.5.24/26 Géré). AIPD §4.1 (mesures techniques), politique §10.1 (mesures techniques), registre §6 (récap mesures techniques). **Cohérence OK** entre les trois documents et le référentiel ISO 27001. Mesures clés :
- AES-256-GCM au repos
- SHA-256 + sel 128 bits
- CSP stricte
- Permissions MV3 minimales
- Aucune dépendance runtime externe
- Validation messages inter-composants (`MessageValidator`)
- Pattern Cross-Lifecycle-Intent (ADR-002)
- SW-Boot-Contract (ADR-001)
- Factory logger minimisée (TACHE-083)

### Art. 33-34 — Notification de violations

⚠️ **Procédure documentée dans le runbook** (Step 2 saisine DPO, Step 7 validation DPO, template 6.5 notification utilisateurs) **mais pas formalisée côté RGPD**. Voir §3.2 (T-115 manquante). Registre §8 (template VIOL-001) prêt mais sans procédure E1-E6 attachée.

### Art. 35 — AIPD

✅ AIPD M7 v1.2 livrée. ⚠️ **Question** : faut-il bumper en v1.3 après intégration des recommandations T-074 (note formelle, TTL 365j sur m7_incidents, conditions UI Options) ? **Position DPO** : oui, recommandé après livraison T-074, T-115, T-155 — bump cohérent v1.3 reflétant la consolidation post-revue.

---

## 6. Risques privacy résiduels

### 6.1 Risques tracés dans RISQUES.md

| ID | Description | Catégorie | Score | Statut | Couverture DPO |
|---|---|---|---|---|---|
| R-007 | Non-conformité RGPD M7 base légale | RGPD | 8 | Résolu | ✅ AIPD v1.2 + politique §3 |
| R-021 | Whitelist M2 sans chiffrement | RGPD | 1 | Résolu (T-079) | ✅ AIPD §1.3 + politique §4.1 |
| R-M7-06 | Fuite via `context` registre incidents | RGPD | 6 | Résolu périmètre IDB | ✅ INV-SEC-02, mais T-074 note formelle À faire |
| R-M7-08 | Fuite via console SW | RGPD | 4 | Résolu (T-079) | ✅ AIPD §1.8, factory logger |
| R-ADR-06 | Iframes cross-origin (fausse impression) | RGPD/UX | 6 | Mitigé | ✅ Politique §11.1 + AIPD note v1.1 |

### 6.2 Risques résiduels non tracés

**R-DPO-01 (nouveau, à ajouter)** — TTL temporelle absente sur `m7_incidents` :
- Description : le store IDB `m7_incidents` est borné par cardinalité FIFO 500 mais sans purge temporelle. Un utilisateur peu actif pourrait conserver des incidents vieux de plusieurs années si <500 incidents ont été générés.
- Impact RGPD : violation potentielle Art. 5.1.e (limitation de la conservation au-delà du nécessaire pour la finalité diagnostic).
- Probabilité 2, Impact 1, Score 2.
- Mitigation : ajouter une TTL 365 jours dans `IncidentService.purgeOldestByPriority()` + documenter dans AIPD v1.3 et registre v1.1.

**R-DPO-02 (nouveau, à ajouter)** — Désynchronisation durée de conservation `weekly_scores` :
- Description : politique v1.1 §7 dit 52 semaines, registre v1.0 §3.2 dit 90 jours rolling. Incohérence documentaire pouvant induire l'utilisateur en erreur.
- Impact RGPD : violation potentielle Art. 5.1.a (transparence) et Art. 13 (information exacte).
- Probabilité 2, Impact 1, Score 2.
- Mitigation : registre v1.1 (T-155) doit aligner sur 52 semaines.

**R-DPO-03 (nouveau, à ajouter)** — Module M9 absent de la politique §3 :
- Description : la politique v1.1 §3 liste 7 fonctionnalités mais omet « Alerte connexion non sécurisée » (M9). Le registre RT-M9 existe.
- Impact RGPD : violation potentielle Art. 13.1.c (finalité du traitement non communiquée pour M9).
- Probabilité 1, Impact 2, Score 2.
- Mitigation : politique v1.2 ou erratum incluant M9 dans §3 et §4.

**R-DPO-04 (nouveau, à ajouter)** — Note T-074 non livrée bloque la cohérence forensique :
- Description : sans note formelle T-074, le registre m7_incidents n'a pas de validation DPO documentée. En cas d'audit CNIL, l'AIPD §6.5 « pré-validation conceptuelle » serait insuffisante.
- Impact RGPD : faiblesse documentaire (pas de violation directe).
- Probabilité 1, Impact 2, Score 2.
- Mitigation : T-074 livrée + bump AIPD v1.3.

---

## 7. Recommandations

### 7.1 Recommandations Must (avant clôture cycle v1)

**REC-DPO-01 — Livrer la note T-074** (`docs/rgpd/note-dpo-tache-061-compatibilite-aipd-v1.0.md`) avec :
- Validation formelle des 4 conditions DPO listées dans AIPD §6.5
- Position sur la TTL temporelle de `m7_incidents` (proposition : 365 jours en complément de FIFO 500)
- Validation de l'exclusion par défaut du registre incidents de l'export Art. 20
- Cahier des charges UI Options pour « Voir mon registre d'incidents » + « Vider mon registre d'incidents »

**REC-DPO-02 — Livrer la note T-115** (`docs/rgpd/note-dpo-circuit-incidents-m7-v1.0.md`) avec :
- Procédure E1-E6 formalisée (saisine, qualification, décision CNIL Art. 33, décision personnes Art. 34, communication, traçabilité §8 registre violations)
- Critères de déclenchement notification individuelle (gravité × type de données × nombre de personnes)
- Template notification utilisateurs (canal proposé : annonce GitHub Releases + dialog au prochain démarrage extension + page Options « État de santé »)
- Articulation explicite avec le runbook §2 (rôles), §3.2 (déclenchement saisine), §3.3 (Step 2 triage), §3.7 (Step 7 disclosure)

**REC-DPO-03 — Bumper l'AIPD en v1.3** après livraison T-074 / T-115 :
- Section §6.6 (nouvelle) : validation formelle T-074 (référence note v1.0)
- Section §6.7 (nouvelle) : circuit incidents T-115 (référence note v1.0)
- §1.8 : ajouter TTL 365j sur `m7_incidents` si retenue
- §6.4 : ajouter déclencheurs de révision « modification du circuit incidents » et « modification TTL `m7_incidents` »

### 7.2 Recommandations Should (avant publication Chrome Web Store)

**REC-DPO-04 — Livrer le registre v1.1** (T-155) avec :
- Titres user-friendly RT-M2 → « Protection contre les sites frauduleux », etc.
- Annexe table de correspondance code module ↔ titre user-friendly
- Correction durée `weekly_scores` (90j rolling → 52 semaines, alignement politique)
- Ajout RT-PWDSTRENGTH (Évaluation force mot de passe)
- Ajout couverture `pending_*` intents par module
- Ajout TTL temporelle `m7_incidents` (cohérence avec REC-DPO-03)
- Ajout §11 historique des versions
- Mise à jour cross-références AIPD §6.5 et politique §14 vers v1.1

**REC-DPO-05 — Erratum politique v1.1 ou bump v1.2** pour intégrer la fonctionnalité M9 « Alerte connexion non sécurisée » dans §3 et §4 (R-DPO-03).

**REC-DPO-06 — Ajouter à RISQUES.md** les 4 nouveaux risques R-DPO-01 à R-DPO-04 listés en §6.2.

**REC-DPO-07 — Implémentation UI** : confier au Développeur + Expert UX/UI les 2 boutons « Voir mon registre d'incidents » + « Vider mon registre d'incidents » dans la page Options (préalable à la levée définitive de la condition AIPD §6.5).

### 7.3 Recommandations Could (post v1, optimisations)

**REC-DPO-08 — Revue trimestrielle** : DPO refait `grep console\.\|logger\.` sur `src/background/**` et compare à AIPD §1.8. Cadence alignée sur TACHE-117 (matrice providers trimestrielle). Déjà tracé dans AIPD §6.3 R-REC-AIPD-04.

**REC-DPO-09 — Page utilisateur « État de santé »** (TACHE-109) doit afficher l'état du registre d'incidents (nombre d'incidents par sévérité, dernière purge) pour transparence.

**REC-DPO-10 — Étendre l'inventaire logs aux content scripts** (TACHE-105) avant publication Chrome Web Store. ~26 sites identifiés. Bump AIPD v1.4 si livré.

### 7.4 Position sur questions du brief

**Q1 — AIPD v1.3 nécessaire ?** Oui, après livraison T-074 et T-115. Recommandé.

**Q2 — Cohérence durées de conservation ?** Voir §4.1 — **3 désynchronisations** à corriger : `quiz_sessions` (M6), `weekly_scores` (M3), `pending_*` intents non couverts par registre.

**Q3 — Couverture nouveaux traitements post-T-112 (Dependabot, Security Advisories) ?** Confirmé hors scope responsable de traitement Sentinel Nudge — ce sont des outils GitHub gérés par Microsoft/GitHub Inc. en tant que responsable de traitement de la plateforme. Antony Blain en tant qu'utilisateur de GitHub n'a pas de qualification responsable de traitement Sentinel Nudge sur ces flux. À documenter dans politique v1.2 §6 (« GitHub : outil de gestion du dépôt, pas un sous-traitant Sentinel Nudge ») pour clarté absolue post-passage public.

**Q4 — T-128 → T-155 continuité tracée ?** Partiellement — T-128 livré sans §11 historique des versions. T-155 doit corriger ce manque (REC-DPO-04).

**Q5 — Procédure droits Art. 15-22 in-app uniquement ?** Oui, et c'est aligné RGPD (voir §5 Art. 15-22). Le canal GitHub Issues / Security Advisories est documenté pour les questions générales mais **pas pour exercer des droits sur les données** (puisque l'éditeur n'a pas accès aux données). À clarifier dans politique v1.2 §8 et §12.

**Q6 — Inventaire complet données personnelles incluant logs minimisés post-T-083 ?** Oui — AIPD v1.2 §1.8 inventorie 13 sites logger pour le périmètre M7 (service-worker.ts + m7-handler.ts). Les 12 sites résiduels handlers M2/M3/M5/M6/M17 (TACHE-104, Terminé) et les ~26 sites content scripts (TACHE-105, À faire) doivent être consolidés dans un inventaire global v1.3 ou dans une annexe dédiée du registre v1.1.

---

## 8. Synthèse — actions concrètes proposées

| Action | Priorité | Effort estimé | Responsable | Livrable |
|---|---|---|---|---|
| Note DPO T-074 | Must | ~2h | DPO | `docs/rgpd/note-dpo-tache-061-compatibilite-aipd-v1.0.md` |
| Note DPO T-115 | Must | ~3h | DPO | `docs/rgpd/note-dpo-circuit-incidents-m7-v1.0.md` |
| Bump AIPD v1.3 | Must | ~1h | DPO | `docs/p3-architecture/p3-aipd-m7-v1.3.md` |
| Registre v1.1 | Should | ~2h | DPO | `docs/rgpd/registre-des-traitements-v1.1.md` |
| Erratum politique M9 | Should | ~30 min | DPO | Politique v1.2 ou erratum versionné |
| Ajout R-DPO-01/02/03/04 dans RISQUES.md | Should | ~15 min | DPO | Mise à jour RISQUES.md |
| UI Options « Voir/Vider registre incidents » | Should | ~3h | Développeur + Expert UX/UI | Code + tests |
| Clarification GitHub hors scope sous-traitant | Should | ~30 min | DPO | Politique §6 v1.2 |
| Revue trimestrielle logs (cadence) | Could | récurrent | DPO | Trace dans AIPD §6.3 |
| Étendre inventaire logs content scripts | Could | ~2h | DPO + Développeur | Annexe registre v1.1 ou AIPD v1.4 |

---

## 9. Conclusion

Le périmètre DPO Sentinel Nudge présente un niveau de conformité RGPD **élevé** et **opérationnel** — pas de risque immédiat pour les personnes concernées, triple qualification responsable de traitement clarifiée, droits Art. 15-22 effectifs in-app, AIPD M7 robuste avec mesures techniques de pointe (AES-256-GCM, SHA-256 + sel 128 bits, factory logger minimisée).

Les **trois écarts identifiés** (notes T-074 + T-115 manquantes, registre v1.1 user-friendly à produire) sont **documentaires et non-bloquants pour l'usage en environnement contrôlé**, mais doivent être levés **avant publication Chrome Web Store** pour atteindre un niveau « audit-ready » face à un contrôle CNIL ou une revue tiers indépendante.

Les **3 désynchronisations de durées de conservation** (`weekly_scores`, `quiz_sessions`, `pending_*`) sont à corriger en registre v1.1 — pas de violation directe, mais cohérence éditoriale impérative entre les trois documents publics et internes.

L'**omission du module M9** dans la politique v1.1 §3 est un défaut d'information Art. 13.1.c à corriger rapidement (erratum ou v1.2).

Le **passage du repo en visibilité publique (T-112)** n'introduit aucun nouveau traitement — Dependabot et Security Advisories sont des outils GitHub hors qualification responsable de traitement Sentinel Nudge.

**Position formelle DPO** : la conformité RGPD est **acquise sur le fond**. Les recommandations REC-DPO-01 à REC-DPO-03 (Must) doivent être livrées dans les 5 jours ouvrés suivants pour clôturer définitivement le cycle v1 documentaire RGPD.

---

**Chemin absolu du présent rapport** : `C:\Dev\sentinel-nudge\docs\gouvernance\revues-fabrique-2026-04-19\04-dpo.md`

_Revue produite par le DPO (Fabrique) — 2026-04-19_
_Conforme à RGPD Art. 5, 6, 12-22, 25, 30, 32, 33-34, 35_
_Conforme aux lignes directrices CEPD WP248 rev.01 (AIPD)_
_Conforme au guide CNIL PIA 2018_
