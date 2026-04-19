# Politique de confidentialité — Sentinel Nudge

**Extension :** Sentinel Nudge — Extension navigateur open source de cyber-hygiène comportementale
**Version du document :** 1.2
**Date d'entrée en vigueur :** 2026-04-19
**Licence de l'extension :** GNU GPL v3
**Dépôt public :** https://github.com/antonyblain/sentinel-nudge
**Cadre réglementaire :** Règlement (UE) 2016/679 (RGPD), articles 12, 13, 14 notamment

---

## Table des matières

1. [Préambule](#1-préambule)
2. [Identité du responsable de traitement](#2-identité-du-responsable-de-traitement)
3. [Finalités et bases légales](#3-finalités-et-bases-légales)
4. [Catégories de données traitées](#4-catégories-de-données-traitées)
5. [Caractère strictement local du traitement](#5-caractère-strictement-local-du-traitement)
6. [Destinataires des données](#6-destinataires-des-données)
7. [Durées de conservation](#7-durées-de-conservation)
8. [Droits de la personne concernée](#8-droits-de-la-personne-concernée)
9. [Transferts hors Union européenne](#9-transferts-hors-union-européenne)
10. [Mesures de sécurité](#10-mesures-de-sécurité)
11. [Limites de la protection](#11-limites-de-la-protection)
12. [Canal de signalement RGPD et sécurité](#12-canal-de-signalement-rgpd-et-sécurité)
13. [Autorité de contrôle](#13-autorité-de-contrôle)
14. [Registre des traitements](#14-registre-des-traitements)
15. [Date d'entrée en vigueur et historique des versions](#15-date-dentrée-en-vigueur-et-historique-des-versions)

---

## 1. Préambule

Sentinel Nudge est une extension de navigateur open source distribuée sous licence GNU GPL v3. Son objectif est d'améliorer votre cyber-hygiène au quotidien en affichant, au moment opportun, des **conseils contextuels** et des **rappels ciblés** issus des sciences comportementales appliquées à la sécurité.

L'extension a été conçue selon le principe de **Privacy by Design** (article 25 du RGPD). Ses caractéristiques fondamentales sont :

- **Aucun appel réseau sortant** vers un serveur tiers.
- **Aucune télémétrie.**
- **Aucun identifiant persistant** (pas d'UUID, pas de fingerprinting, pas de cookie).
- **Aucun partage de données** avec des tiers, à l'exception du système de mise à jour natif du navigateur pour la fonctionnalité « Rappel de mise à jour du navigateur » (détection de version).
- **Code source ouvert et auditable** (licence GNU GPL v3, code disponible publiquement).

La présente politique est rédigée en langage clair, à destination de l'utilisateur final. Elle est accessible depuis l'onboarding de l'extension et depuis la page **Options**.

---

## 2. Identité du responsable de traitement

### 2.1 Statut particulier

Sentinel Nudge présente une caractéristique juridique importante pour la compréhension des responsabilités : **l'extension ne collecte, ne reçoit et ne transmet aucune donnée personnelle de ses utilisateurs vers un serveur tiers ou vers l'éditeur du code**. L'ensemble des traitements est effectué **localement**, dans le profil du navigateur de l'utilisateur, sur son propre appareil.

En conséquence, et conformément à l'article 4(7) du RGPD, la qualification de « responsable de traitement » dépend de la nature du traitement considéré :

| Traitement                                                        | Qualification du responsable de traitement                                                                         | Justification                                                                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Traitement local des données personnelles par l'extension**     | **L'utilisateur lui-même** — au sens où il décide seul des finalités et des moyens, sur son propre appareil.       | Aucune donnée ne quitte le navigateur. L'extension est un outil mis à disposition. L'utilisateur conserve le contrôle exclusif des données. |
| **Mise à disposition du code source (édition de l'extension)**    | **Antony Blain** (particulier — contributeur open source, sans entreprise) en tant qu'éditeur du code.             | Antony Blain publie le code sous licence GPL v3. Il n'exerce aucun contrôle sur les données traitées localement par les installations.      |
| **Fonctionnement du navigateur qui héberge l'extension**          | **Éditeur du navigateur** (Google pour Chrome, Microsoft pour Edge, Mozilla pour Firefox).                         | Le profil navigateur, sa synchronisation éventuelle et son stockage relèvent de l'éditeur du navigateur. Cf. §11.                             |

### 2.2 Statut de l'éditeur

L'éditeur du code source (Antony Blain) agit en tant que **particulier** dans le cadre d'une contribution open source. Il ne constitue pas une entreprise. Il **ne dispose d'aucun accès** aux données traitées par les installations de l'extension. Aucun canal de télémétrie, aucun serveur d'analyse, aucune base de données centralisée n'existe.

### 2.3 Conséquences pratiques pour l'utilisateur

- **Droit d'accès, de rectification, d'effacement, de portabilité** : ces droits s'exercent **directement sur l'appareil** de l'utilisateur, via les fonctions intégrées à l'extension (voir §8). L'utilisateur n'a pas à adresser de demande à un tiers.
- **Suppression totale** : désinstaller l'extension et/ou cliquer sur « Supprimer toutes mes données » dans la page Options supprime définitivement et localement toutes les données.
- **Responsabilité partagée avec l'éditeur du navigateur** : si l'utilisateur active la synchronisation Chrome (ou équivalent), ses données locales peuvent être synchronisées vers le cloud de l'éditeur du navigateur. Cette synchronisation est **hors du contrôle de Sentinel Nudge**. Cf. §11.

### 2.4 Outils de la plateforme d'hébergement (GitHub) — hors qualification

Le code source de Sentinel Nudge est hébergé sur **GitHub Inc.** (filiale de Microsoft, États-Unis). À ce titre, plusieurs outils de la plateforme GitHub interviennent automatiquement sur le dépôt public, sans intervention de l'éditeur Sentinel Nudge :

- **Dependabot** (analyse automatique des dépendances et alertes de vulnérabilité).
- **GitHub Security Advisories** (canal privé de signalement de vulnérabilités).
- **GitHub CodeQL** (analyse statique SAST automatisée — workflow `codeql.yml`, ruleset OWASP Top 10 + CWE Top 25, exécuté à chaque push et de manière hebdomadaire).
- **GitHub Actions** (intégration continue, exécution des tests et du build).

Ces outils sont fournis et opérés par **GitHub Inc., responsable de traitement au sens de l'article 4(7) RGPD** pour les données techniques qu'ils manipulent (métadonnées de dépôt, identifiants de contributeurs publics, alertes de sécurité). Sentinel Nudge **ne reçoit ni ne traite aucune donnée personnelle d'utilisateur final** via ces outils : ils opèrent exclusivement sur le code source et son écosystème de développement, jamais sur les données traitées localement par l'extension installée chez les utilisateurs. La politique de confidentialité applicable à ces outils est celle de GitHub (https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

L'éditeur Sentinel Nudge **n'est ni responsable de traitement ni sous-traitant** au sens du RGPD pour ces outils, conformément à la qualification triple §2.1 (l'éditeur n'a pas accès aux données utilisateurs, ne les collecte pas, ne les héberge pas).

---

## 3. Finalités et bases légales

Sentinel Nudge est composé de **sept fonctionnalités** en version 1. Chacune poursuit une finalité précise avec une base légale identifiée.

| Fonctionnalité | Finalité                                                                                                                                           | Base légale (RGPD Art. 6)                                         | Opt-in / Opt-out                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| **Protection contre les sites frauduleux** | Détecter la saisie d'un mot de passe sur un site présentant des signaux de risque (HTTP, typosquatting, hors HSTS) et afficher une alerte préventive. | Intérêt légitime (Art. 6.1.f) — sécurité de l'utilisateur         | Activable / désactivable à tout moment depuis la page Options.  |
| **Score de cyber-hygiène** | Calculer un score hebdomadaire de cyber-hygiène basé sur les actions de l'utilisateur (feedback positif comportemental).                           | Intérêt légitime (Art. 6.1.f)                                     | Activable / désactivable à tout moment.                         |
| **Rappel de mise à jour du navigateur** | Détecter une version obsolète du navigateur et proposer la mise à jour.                                                                            | Intérêt légitime (Art. 6.1.f)                                     | Activable / désactivable à tout moment.                         |
| **Exercices de sensibilisation au phishing** | Proposer un quiz éducatif de phishing en répétition espacée.                                                                                        | Intérêt légitime (Art. 6.1.f)                                     | Activable / désactivable à tout moment.                         |
| **Alerte mots de passe réutilisés** | Détecter la réutilisation d'un mot de passe sur plusieurs domaines distincts, afin de sensibiliser à l'usage d'un gestionnaire de mots de passe.   | **Consentement explicite (Art. 6.1.a)** — opt-in à l'onboarding   | **Opt-in obligatoire** — désactivable à tout moment.            |
| **Détection de mots de passe faibles** | Évaluer la force d'un mot de passe au moment de sa création (champ de type création) et afficher un indicateur de robustesse pour aider l'utilisateur à choisir un mot de passe fort. | Intérêt légitime (Art. 6.1.f)                                     | Activable / désactivable à tout moment.                         |
| **Alerte copie de données sensibles** | Détecter le collage d'une donnée sensible (carte bancaire, IBAN, numéro de sécurité sociale) dans un formulaire.                                   | Intérêt légitime (Art. 6.1.f)                                     | Activable / désactivable à tout moment.                         |

**Pourquoi ces bases légales ?**

- **Intérêt légitime (Art. 6.1.f)** : l'utilisateur installe volontairement une extension de sécurité. Les fonctionnalités « Protection contre les sites frauduleux », « Score de cyber-hygiène », « Rappel de mise à jour du navigateur », « Exercices de sensibilisation au phishing », « Détection de mots de passe faibles » et « Alerte copie de données sensibles » traitent strictement les données nécessaires à cette finalité de sécurité, sans jamais communiquer les données à l'extérieur. Le déséquilibre avec les libertés fondamentales est nul puisque les données ne quittent jamais l'appareil.
- **Consentement explicite (Art. 6.1.a)** pour « Alerte mots de passe réutilisés » : le traitement d'empreintes de mots de passe (même pseudonymisées par hash salé et chiffrement AES-256-GCM) est considéré comme plus sensible. Une étape dédiée de l'onboarding demande explicitement le consentement avant toute activation. Ce consentement est **libre, spécifique, éclairé et univoque**, et **révocable à tout moment** via la page Options.

Une **Analyse d'Impact relative à la Protection des Données (AIPD)** a été réalisée pour la fonctionnalité « Alerte mots de passe réutilisés » et mise à jour le 2026-04-19 en version 1.3 (cf. document `docs/p3-architecture/p3-aipd-m7-v1.3.md`).

---

## 4. Catégories de données traitées

Cette section détaille par fonctionnalité, en langage clair, quelles données sont traitées et où elles sont stockées.

### 4.1 Protection contre les sites frauduleux

| Donnée                     | Forme traitée                                          | Lieu de stockage                                    |
| -------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| Nom de domaine visité      | Hash SHA-256 (avec sel d'installation 128 bits)        | `chrome.storage.local` (cache session) + IndexedDB  |
| Whitelist personnelle      | Liste de hash SHA-256 de domaines marqués de confiance | `chrome.storage.local` + IndexedDB (store `whitelist`) |
| Schéma d'URL (HTTP / HTTPS) | Valeur textuelle courte                                | En mémoire uniquement, non stocké                   |

**L'URL complète n'est jamais collectée ni stockée.** Seul le nom de domaine est haché localement.

### 4.2 Score de cyber-hygiène

| Donnée                                 | Forme traitée                                      | Lieu de stockage                                    |
| -------------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| Événements agrégés non-nominatifs (ex. nombre de conseils affichés, acceptés, ignorés) | Compteurs numériques                              | IndexedDB (store `events`, chiffré AES-256-GCM)     |
| Score hebdomadaire consolidé           | Valeur numérique 0-100                             | IndexedDB (store `weekly_scores`, chiffré)          |

### 4.3 Rappel de mise à jour du navigateur

| Donnée                           | Forme traitée                      | Lieu de stockage                                         |
| -------------------------------- | ---------------------------------- | -------------------------------------------------------- |
| Version du navigateur détectée   | Chaîne de version locale (ex. « 121.0 ») | `chrome.storage.local`                              |
| Compteur de rappels différés     | Valeur numérique                   | `chrome.storage.local`                                    |

La détection s'appuie sur `chrome.runtime.requestUpdateCheck()`, mécanisme **natif du navigateur** (mise à jour intégrée gérée par l'éditeur du navigateur). Aucun appel réseau n'est émis par l'extension elle-même.

### 4.4 Exercices de sensibilisation au phishing

| Donnée                                    | Forme traitée                                                 | Lieu de stockage                                    |
| ----------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| Réponses de l'utilisateur aux questions   | Identifiants abstraits de questions + booléens correct / incorrect | IndexedDB (store `quiz_sessions`, chiffré)     |
| Score de la session                       | Valeur numérique                                              | IndexedDB (store `quiz_sessions`, chiffré)          |
| Date d'installation                       | Horodatage ISO 8601                                           | `chrome.storage.local`                              |

Les questions sont référencées par identifiant abstrait uniquement — **aucun texte libre saisi par l'utilisateur n'est stocké**.

### 4.5 Alerte mots de passe réutilisés

Cette fonctionnalité fait l'objet d'une **AIPD dédiée** (cf. §10 et `docs/p3-architecture/p3-aipd-m7-v1.3.md`).

| Donnée                                                        | Forme traitée                                                     | Lieu de stockage                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------ |
| Mot de passe en clair                                         | **Jamais stocké** — nullifié en mémoire en moins de 5 ms          | Aucun                                                        |
| Empreinte du mot de passe (`password_hash`)                   | SHA-256(sel d'installation + mot de passe), chiffré AES-256-GCM   | IndexedDB (store `password_hashes`, chiffré)                 |
| Index de pré-filtration (`tag`)                               | 4 premiers octets du hash (non réversible)                        | IndexedDB (en clair, mais non ré-identifiant)                |
| Hash du domaine associé (`domain_hash`)                       | SHA-256(sel + nom de domaine)                                     | IndexedDB                                                    |
| Compteurs et horodatages                                      | `first_seen`, `count`                                             | IndexedDB                                                    |
| Sel d'installation (`installation_salt`)                      | 16 octets (128 bits) aléatoires                                   | `chrome.storage.local` — durée de vie de l'installation      |
| Clé de chiffrement AES                                        | Matériau exporté de la `CryptoKey`                                | `chrome.storage.local` (voir §10.3 sur la protection)        |
| Registre d'incidents techniques (`m7_incidents`)              | Métadonnées techniques de diagnostic (type, sévérité, horodatage) | IndexedDB (store `m7_incidents`, FIFO 500 + TTL 365 jours)   |

### 4.6 Détection de mots de passe faibles

| Donnée                                    | Forme traitée                                                                                       | Lieu de stockage                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Mot de passe en cours de création         | Analyse via l'algorithme zxcvbn-ts en mémoire, **en moins de 10 ms**                                 | **Aucun** — pas de stockage (R-002)  |
| Score de force                            | Valeur numérique 0-4                                                                                | En mémoire, affichage immédiat        |

Conformément à la décision R-002 du DAT, **le mot de passe en cours de création n'est jamais stocké**, pas même temporairement. L'évaluation se fait à la volée et le résultat (uniquement le niveau de robustesse, pas le mot de passe lui-même) est affiché immédiatement à l'utilisateur sous forme d'indicateur visuel.

### 4.7 Alerte copie de données sensibles

| Donnée                                                | Forme traitée                                                                                        | Lieu de stockage                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Événement de collage                                  | Enum `data_type` strict : `cb` (carte bancaire), `iban`, `ssn` (numéro de sécurité sociale)          | IndexedDB (store `events`, chiffré)                 |
| Contenu de la donnée sensible collée (numéro de CB, IBAN…) | **Jamais collecté** — seul le format détecté est noté (R-CLI-07)                                | Aucun                                                |

L'extension **n'accède pas au presse-papiers en lecture**. Elle détecte uniquement le format de la donnée au moment du collage dans un champ de formulaire (événement `paste` dans le DOM).

### 4.8 Paramètres de l'extension

| Donnée                                  | Forme traitée              | Lieu de stockage                    |
| --------------------------------------- | -------------------------- | ----------------------------------- |
| État d'activation de chaque fonctionnalité | Booléen par fonctionnalité | `chrome.storage.local`              |
| Profil utilisateur auto-déclaré         | Débutant / Intermédiaire / Avancé | `chrome.storage.local`        |
| Quota journalier de rappels             | Valeur numérique (3, 5, 10 ou illimité) | `chrome.storage.local`     |

---

## 5. Caractère strictement local du traitement

Sentinel Nudge traite **100 % des données sur l'appareil de l'utilisateur**. Les conséquences pratiques sont les suivantes :

- **Aucun envoi serveur.** Aucun endpoint distant, aucune API tierce, aucun CDN au runtime.
- **Aucune télémétrie.** Aucune métrique d'usage, aucun log d'erreur, aucune statistique ne quittent le poste.
- **Aucune analyse comportementale externalisée.** Aucune agrégation cloud, aucun profilage distant, aucun scoring tiers.
- **Aucun cookie.** L'extension ne dépose aucun cookie dans le navigateur ni dans les sites visités.
- **Aucun identifiant publicitaire, aucun suivi cross-site.**

Le seul mécanisme qui utilise une fonctionnalité du navigateur pouvant impliquer un appel réseau est `chrome.runtime.requestUpdateCheck()` utilisé pour le « Rappel de mise à jour du navigateur ». Cette fonction **est un service du navigateur, pas de l'extension** : elle utilise le canal de mise à jour que le navigateur utilise déjà pour lui-même. Sentinel Nudge n'émet aucun paquet réseau sortant.

---

## 6. Destinataires des données

**Aucun destinataire.** Les données traitées par Sentinel Nudge ne sont accessibles que par l'extension elle-même, dans le périmètre du profil navigateur de l'utilisateur.

- **Aucun sous-traitant** (au sens de l'article 28 du RGPD) n'intervient.
- **Aucun service tiers** ne reçoit de données.
- **L'éditeur de l'extension (Antony Blain) n'a accès à aucune donnée** d'aucune installation.

---

## 7. Durées de conservation

| Donnée                                            | Durée de conservation                                    | Mécanisme                                                                   |
| ------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Événements « Protection contre les sites frauduleux », « Alerte mots de passe réutilisés », « Alerte copie de données sensibles » (store `events`) | 90 jours glissants                                       | Purge automatique hebdomadaire (alarme lundi matin)                         |
| Empreintes de mots de passe « Alerte mots de passe réutilisés » (`password_hashes`) | 90 jours glissants **et** maximum 100 entrées (FIFO)     | Purge automatique hebdomadaire + éviction FIFO                              |
| Sessions de quiz « Exercices de sensibilisation au phishing » (`quiz_sessions`) | **52 semaines (1 an)** glissantes                        | Purge automatique hebdomadaire (`storageService.purgeExpired`, voir code `src/background/storage-service.ts`) |
| Scores hebdomadaires « Score de cyber-hygiène » (`weekly_scores`) | **52 semaines (1 an)** glissantes                        | Purge automatique hebdomadaire (`storageService.purgeExpired`, voir code `src/background/storage-service.ts`) |
| Whitelist « Protection contre les sites frauduleux » (`whitelist`) | **Indéfinie** — jusqu'à suppression explicite par l'utilisateur | Pas de purge automatique (c'est une préférence utilisateur active)      |
| Sel d'installation (`installation_salt`)          | Durée de vie de l'installation                           | Supprimé lors de la désinstallation ou de la suppression totale             |
| Clé de chiffrement AES                            | Durée de vie de l'installation                           | Supprimée lors de la désinstallation ou de la suppression totale             |
| Registre d'incidents M7 (`m7_incidents`)          | **365 jours absolus** OU 500 entrées maximum (FIFO, le plus restrictif des deux) | Purge automatique journalière (`onPurgeDaily`, alarme quotidienne)          |
| Intents inter-cycle `pending_m7_toast` (chrome.storage.local) | TTL 10 minutes                                          | Purge quotidienne automatique (`onPurgeDaily`)                              |
| Intents inter-cycle `pending_m17_toast` (chrome.storage.local) | TTL 5 minutes                                           | Purge quotidienne automatique (`onPurgeDaily`)                              |
| Intents inter-cycle `pending_m6_quiz` (chrome.storage.local) | TTL 7 jours                                             | Purge quotidienne automatique (`onPurgeDaily`)                              |
| Intents inter-cycle `pending_m5_update_reminder` (chrome.storage.local) | TTL 30 minutes                                          | Purge quotidienne automatique (`onPurgeDaily`)                              |

**Purge manuelle immédiate :** depuis la page Options, le bouton **« Supprimer toutes mes données »** déclenche `indexedDB.deleteDatabase('sentinel-nudge-db')` et `chrome.storage.local.clear()`. L'effacement est complet, immédiat et irréversible.

---

## 8. Droits de la personne concernée

L'utilisateur dispose de l'ensemble des droits prévus aux articles 15 à 22 du RGPD. Compte tenu du caractère strictement local du traitement (cf. §2 et §5), ces droits s'exercent **directement depuis l'extension**, sans avoir à adresser de demande à un tiers.

| Droit (RGPD)                           | Moyen d'exercice dans Sentinel Nudge                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Droit d'accès (Art. 15)**            | Bouton **« Exporter mes données »** dans la page Options. Produit un fichier JSON local, lisible, contenant toutes les données déchiffrées (hors empreintes brutes de la fonctionnalité « Alerte mots de passe réutilisés » pour protection, et hors registre d'incidents techniques `m7_incidents` par défaut — cf. §8.1). |
| **Droit de rectification (Art. 16)**   | L'utilisateur peut modifier ses paramètres (profil, fonctionnalités actives, quota, whitelist) à tout moment depuis la page Options.                                            |
| **Droit à l'effacement (Art. 17)**     | Bouton **« Supprimer toutes mes données »** dans la page Options. Effacement immédiat et complet (IndexedDB + chrome.storage.local). Désinstaller l'extension produit le même effet. |
| **Droit à la limitation (Art. 18)**    | Désactivation fonctionnalité par fonctionnalité depuis la page Options. Pause globale via désactivation de l'extension dans le gestionnaire du navigateur.                                 |
| **Droit à la portabilité (Art. 20)**   | Bouton **« Exporter mes données »** (fichier JSON structuré, déchiffré, téléchargé localement via `URL.createObjectURL()` — aucune transmission réseau).                   |
| **Droit d'opposition (Art. 21)**       | Désactivation de l'intérêt légitime au niveau de chaque fonctionnalité (sauf « Alerte mots de passe réutilisés » qui relève du consentement : désactiver la fonctionnalité équivaut à retirer le consentement).                 |
| **Décision automatisée (Art. 22)**     | Sans objet — aucune décision produisant des effets juridiques n'est prise par l'extension. Les conseils et rappels sont informatifs et non bloquants.                                  |

### 8.1 Particularités de l'export de portabilité (Art. 20)

Pour protéger l'utilisateur contre une éventuelle extraction malveillante, l'export de portabilité applique deux exclusions par défaut :

1. **Empreintes brutes de mots de passe (`password_hashes`)** — exclues. Seules les métadonnées agrégées (nombre d'entrées, horodatages, compteurs) sont exportées. Justification : éviter qu'un attaquant exfiltrant le fichier d'export puisse mener une attaque par dictionnaire sur les hashes.

2. **Registre d'incidents techniques (`m7_incidents`)** — exclu par défaut. Justification : ce registre est un journal forensique de diagnostic technique destiné au mainteneur, pas une donnée personnelle métier de l'utilisateur. L'utilisateur conserve la possibilité de l'inclure explicitement (option « Inclure mon journal de diagnostic » dans la page Options de l'export, désactivée par défaut, accompagnée d'un avertissement sur son contenu technique).

---

## 9. Transferts hors Union européenne

**Aucun transfert.** Les données ne quittent pas l'appareil de l'utilisateur. Aucune donnée n'est transférée vers un pays tiers, ni vers un pays bénéficiant d'une décision d'adéquation, ni via des clauses contractuelles types. La question des transferts internationaux est donc **sans objet** pour le traitement opéré par Sentinel Nudge lui-même.

**Réserve :** si l'utilisateur active la synchronisation de son profil navigateur (par exemple la synchronisation Chrome), des données locales peuvent être synchronisées vers le cloud de l'éditeur du navigateur, éventuellement hors UE. Cette synchronisation est **hors du périmètre de Sentinel Nudge** (voir §11).

---

## 10. Mesures de sécurité

Sentinel Nudge implémente des mesures de sécurité conformes à l'état de l'art, référencées dans le `docs/securite/referentiel-iso27001-v1.2.md` v1.2 (12 contrôles ISO/IEC 27001:2022 documentés, contrôles A.5.24 / A.5.26 au niveau *Géré* après livraison du runbook de réponse à incident).

### 10.1 Mesures techniques

| Mesure                                                  | Description                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Chiffrement au repos AES-256-GCM                        | Toutes les données sensibles en IndexedDB sont chiffrées (stores `events`, `quiz_sessions`, `weekly_scores`, `password_hashes`). |
| Hachage salé SHA-256                                    | Toutes les empreintes (mots de passe, domaines) utilisent un sel local 128 bits unique par installation. |
| Nullification immédiate des mots de passe en clair (fonctionnalité « Alerte mots de passe réutilisés ») | Moins de 5 ms en mémoire avant effacement garanti.                                              |
| Pas de stockage du mot de passe en création            | Les mots de passe en création ne sont jamais stockés (R-002).                                   |
| Permissions minimales                                   | Manifest V3 avec permissions strictement nécessaires au fonctionnement.                         |
| Content Security Policy stricte                         | `script-src 'self'`, pas d'`unsafe-eval`, pas de CDN externe.                                   |
| Aucune dépendance runtime externe                       | Toutes les librairies (zxcvbn, corpus quiz, HSTS list) sont embarquées dans le bundle.           |
| Validation des messages inter-composants                | `MessageValidator` entre content scripts et service worker pour prévenir toute injection.        |
| Pattern Cross-Lifecycle-Intent                          | Les intents persistés sont validés, ont un TTL explicite et sont consommés une seule fois.      |
| Analyse statique SAST automatisée (CodeQL)              | Le code source est scanné en continu par GitHub CodeQL (workflow `codeql.yml`, ruleset OWASP Top 10 + CWE Top 25, exécution à chaque push et hebdomadaire). État au 2026-04-19 : 0 finding (cf. TACHE-187 / TACHE-108 livrée). |

### 10.2 Mesures organisationnelles

- **Code source ouvert (GNU GPL v3)** permettant l'audit public et la contribution communautaire.
- **Revue de code obligatoire** avant chaque merge (comité revue code formalisé).
- **Tests automatisés** (Vitest + Playwright) exécutés en intégration continue à chaque *pull request*.
- **SBOM** (Software Bill of Materials) généré à chaque release.
- **Runbook de réponse à incident** formalisé (10 étapes, classification P0-P3) — cf. `docs/securite/runbook-reponse-incident.md`.
- **Référentiel ISO 27001** formalisé — cf. `docs/securite/referentiel-iso27001-v1.2.md` v1.2 (12 contrôles tracés post-T-166).
- **Procédure d'escalade DPO en 6 étapes (E1-E6)** pour tout incident touchant la fonctionnalité « Alerte mots de passe réutilisés » (cf. AIPD v1.3 §6.6).

### 10.3 Limite assumée sur la clé AES

La clé de chiffrement AES est stockée dans `chrome.storage.local`, inclus dans le profil du navigateur de l'utilisateur. Un attaquant ayant accès au profil du navigateur a **déjà accès à l'ensemble des données de ce navigateur** (cookies de session, mots de passe enregistrés, historique). Cette limite est documentée et acceptée (D-SEC-004 du DAT). Une amélioration future (dérivation PBKDF2 depuis un PIN utilisateur) est prévue en version 2+.

### 10.4 Registre des incidents

Un registre d'incidents local circulaire, en IndexedDB (store `m7_incidents`), trace les événements techniques anormaux liés à la fonctionnalité « Alerte mots de passe réutilisés » (corruption de canary, échec de déchiffrement, régénération de clé, etc.) afin de permettre un diagnostic. Ce registre est **minimisé** (pas de donnée personnelle identifiante, pas de contenu saisi par l'utilisateur, pas de domaine en clair ni haché), borné à **500 entrées maximum (FIFO)** avec une **TTL absolue de 365 jours** (purge automatique journalière). Il est **exclus par défaut de l'export de portabilité Art. 20** (voir §8.1).

---

## 11. Limites de la protection

Par souci de transparence, la présente politique documente explicitement les limites fonctionnelles connues de la protection apportée par Sentinel Nudge.

### 11.1 Iframes cross-origin

Les formulaires de connexion ou de paiement hébergés dans une **iframe cross-origin** (par exemple Stripe, PayPal, certains SSO tiers, composants d'authentification embarqués) ne sont **pas détectés** par Sentinel Nudge en version 1, conformément au choix de sécurité Option C retenu (`host_permissions` minimales, pas de `<all_urls>`).

**Conséquence pratique :** les fonctionnalités « Alerte mots de passe réutilisés » et « Détection de mots de passe faibles » ne se déclenchent pas dans ces iframes. Le risque est documenté (RT-011 du DAT) et son traitement fait l'objet d'une étude en version ultérieure (cf. tâche BACKLOG TACHE-071 « UC-04 iframes cross-origin »).

### 11.2 Gestionnaires de mots de passe propriétaires

L'extension ne reconnaît et ne recommande que des **gestionnaires de mots de passe open source** nommés (KeePass, KeePassXC, Bitwarden, Vaultwarden). Elle n'est affiliée à aucun de ces projets. Les gestionnaires propriétaires (1Password, Dashlane, LastPass, etc.) **ne sont pas supportés** pour la détection d'auto-remplissage en version 1.

### 11.3 Authentification unique (SSO) multi-hostname

Certains systèmes d'authentification unique (notamment Microsoft) redirigent l'utilisateur entre plusieurs noms de domaine distincts pendant le flux de connexion. La détection « Alerte mots de passe réutilisés » peut, dans certains cas, ne pas capturer la saisie sur tous les hostnames intermédiaires. Ce point est documenté dans la matrice de compatibilité providers (`docs/p5-recette/matrice-compatibilite-providers-m7.md`) et fait l'objet d'un suivi spécifique.

### 11.4 Synchronisation du profil navigateur

Si l'utilisateur a activé la synchronisation de son profil navigateur (Chrome Sync, Edge Sync, etc.), les données stockées en `chrome.storage.local` **peuvent être synchronisées vers le cloud de l'éditeur du navigateur**. Ce comportement est géré par le navigateur, pas par Sentinel Nudge, et relève de la politique de confidentialité de l'éditeur du navigateur concerné.

### 11.5 Accès physique ou malveillant au profil

Un attaquant disposant d'un accès physique à l'appareil non verrouillé, d'un malware avec accès au profil navigateur, ou d'une extension navigateur malveillante disposant de permissions élevées peut potentiellement accéder aux données de Sentinel Nudge. Ce risque est traité au niveau du système d'exploitation et du navigateur, et dépasse le périmètre de l'extension (R-003 du registre des risques).

---

## 12. Canal de signalement RGPD et sécurité

En cas de question, de réclamation ou de signalement concernant le traitement de vos données par Sentinel Nudge :

### 12.1 Signalement public (questions, suggestions, améliorations)

Le canal public d'échange est le dépôt GitHub de l'extension :

- **Issues GitHub** — https://github.com/antonyblain/sentinel-nudge/issues (ce canal sera pleinement activé lors du passage du dépôt en visibilité publique — voir la tâche TACHE-112 du BACKLOG).

### 12.2 Signalement confidentiel d'une vulnérabilité liée aux données

Pour tout signalement confidentiel d'une vulnérabilité susceptible d'affecter la protection des données personnelles :

- **GitHub Security Advisories** — canal privé natif GitHub, conformément au fichier `SECURITY.md` du dépôt. Cet outil est fourni par GitHub Inc. (cf. §2.4) et n'implique aucun traitement de données personnelles d'utilisateur final par l'éditeur Sentinel Nudge.
- **SLA** : accusé de réception sous 72 heures, correctif visé sous 30 jours maximum (selon la sévérité).

### 12.3 Processus interne

Chaque signalement lié aux données personnelles déclenche :

1. Une saisine du DPO de la Fabrique pour évaluation de conformité RGPD.
2. Une évaluation selon le runbook de réponse à incident (`docs/securite/runbook-reponse-incident.md`), avec classification P0-P3.
3. Le cas échéant, une mise à jour de la présente politique et une communication publique via le dépôt GitHub.

---

## 13. Autorité de contrôle

En tant qu'éditeur résidant en France, l'autorité de contrôle compétente pour Sentinel Nudge est :

**Commission Nationale de l'Informatique et des Libertés (CNIL)**
3 Place de Fontenoy, TSA 80715
75334 PARIS CEDEX 07
France

Site officiel : https://www.cnil.fr
Téléphone : +33 (0)1 53 73 22 22

Tout utilisateur s'estimant lésé dans le traitement de ses données personnelles peut saisir la CNIL ou l'autorité de contrôle de son État membre de résidence (liste disponible sur https://edpb.europa.eu).

Compte tenu du caractère strictement local du traitement (cf. §2 et §5), la plupart des demandes peuvent être résolues directement par l'utilisateur depuis la page Options de l'extension.

---

## 14. Registre des traitements

Conformément à l'article 30 du RGPD, un registre des traitements formel est tenu pour Sentinel Nudge (cf. `docs/rgpd/registre-des-traitements-v1.0.md`, complément à la présente politique).

Les éléments principaux déjà consolidés :

- Finalités par fonctionnalité — cf. §3 de la présente politique.
- Catégories de données et de personnes concernées — cf. §4 de la présente politique.
- Durées de conservation — cf. §7 de la présente politique.
- Destinataires — cf. §6 (aucun).
- Transferts hors UE — cf. §9 (aucun).
- Mesures de sécurité — cf. §10 et `docs/securite/referentiel-iso27001-v1.2.md` v1.2 (12 contrôles tracés).
- AIPD « Alerte mots de passe réutilisés » — cf. `docs/p3-architecture/p3-aipd-m7-v1.3.md` v1.3 du 2026-04-19.

Le statut particulier de l'éditeur (particulier, sans entreprise, sans accès aux données) et le caractère local du traitement (§2) limitent l'étendue du registre à une formalisation synthétique.

---

## 15. Date d'entrée en vigueur et historique des versions

**Date d'entrée en vigueur de la présente version :** 2026-04-19

| Version | Date       | Nature de la modification                                                                                                                      | Auteur |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1.0     | 2026-04-18 | Version initiale — formalisation complète conforme RGPD Art. 12-14, responsable de traitement, finalités, bases légales, durées, droits, limites. | DPO    |
| 1.1     | 2026-04-19 | Suppression des codes module (M2, M3, M5, M6, M7, M9, M17) remplacés par des titres clairs user-friendly. Suppression du terme « micro-nudges » (non compréhensible pour l'usager) remplacé par « conseils contextuels » / « rappels ciblés » (feedback Commanditaire). Aucune modification des bases légales, des durées de conservation, des mesures de sécurité ni des droits RGPD. | DPO    |
| **1.2** | **2026-04-19** | **Corrections de cohérence cross-livrables (E-CROSS-05/06) :** (1) ajout de la fonctionnalité « Détection de mots de passe faibles » au tableau §3 (omission Art. 13.1.c précédemment) ; (2) précisions §7 sur les durées de conservation alignées sur le code source (`weekly_scores` et `quiz_sessions` = 52 semaines, conforme à `src/background/storage-service.ts`) ; (3) ajout au §7 des intents inter-cycle `pending_*` (TTL explicites par intent, déjà implémentés mais absents du tableau précédent) ; (4) ajout §2.4 sur les outils GitHub (Dependabot, Security Advisories, CodeQL) — qualification GitHub Inc. responsable de traitement, hors périmètre éditeur Sentinel Nudge ; (5) §8.1 nouvelle sous-section sur les particularités de l'export Art. 20 (exclusion `password_hashes` et `m7_incidents` par défaut, option utilisateur explicite) ; (6) §10.1 ajout de la mesure technique CodeQL SAST automatisée (TACHE-187) ; (7) §10.4 enrichi sur le registre `m7_incidents` (FIFO 500 + TTL 365 j, exclusion export par défaut) ; (8) §4.5 ajout de la ligne `m7_incidents` dans les données traitées par « Alerte mots de passe réutilisés » ; (9) références AIPD bumpées en v1.3. Aucune modification des bases légales ni des droits RGPD. | DPO    |

---

### Annexe — Références

- **Règlement (UE) 2016/679 (RGPD)** — https://eur-lex.europa.eu/eli/reg/2016/679/oj
- **Lignes directrices du CEPD** — https://edpb.europa.eu/our-work-tools/general-guidance_fr
- **Guides CNIL (AIPD, registre, consentement, cookies, durées de conservation)** — https://www.cnil.fr/fr/rgpd-passer-a-laction
- **AIPD Sentinel Nudge — Alerte mots de passe réutilisés (v1.3)** — `docs/p3-architecture/p3-aipd-m7-v1.3.md`
- **DAT Sentinel Nudge v1.4** — `docs/p3-architecture/p3-dat-v1.4.md`
- **Cahier des charges v1.1** — `docs/p1-besoin/p1-cahier-des-charges-v1.1.md`
- **Référentiel ISO 27001 v1.2** — `docs/securite/referentiel-iso27001-v1.2.md`
- **Runbook réponse à incident** — `docs/securite/runbook-reponse-incident.md`
- **Registre des traitements Art. 30** — `docs/rgpd/registre-des-traitements-v1.0.md` (à bumper en v1.1 par T-155 pour aligner les durées `weekly_scores`/`quiz_sessions` à 52 semaines et ajouter les intents `pending_*`)
- **SECURITY.md** — `SECURITY.md` (racine du dépôt)
- **GitHub Privacy Statement** — https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement (qualification §2.4)
