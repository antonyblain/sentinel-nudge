# Analyse d'Impact relative a la Protection des Donnees (AIPD) — Module M7

**Projet :** Sentinel Nudge
**Module :** M7 — Nudge d'adoption gestionnaire de mots de passe
**Version :** 1.0
**Date de production :** 2026-04-11
**Auteur :** DPO (Fabrique)
**Niveau de sensibilite :** Expose
**Base reglementaire :** Article 35 du RGPD (Reglement UE 2016/679)
**Decision declenchante :** D-SEC-005 (PV comite securite P2, DAT v1.1 section 9.4)

**Documents de reference :**

- `p3-dat-v1.3.md` — sections 8.1, 8.2, 8.3, 9.4 (anciennement `p3-dat-v1.1.md`, renommé lors du bump v1.3 — TACHE-071 UC-04)
- `p2-sfd-v1.1.md` — section 2.5
- `p1-cahier-des-charges-v1.1.md` — sections M7, 3.1 (Privacy by Design)
- `gouvernance-pv-securite-p2-v1.0.md`
- RISQUES.md — R-001, R-003, R-007

---

## 1. Description du traitement

### 1.1 Finalite

Ameliorer la cyber-hygiene de l'utilisateur en detectant la reutilisation de mots de passe sur plusieurs domaines distincts. Lorsqu'une reutilisation est detectee, un nudge (toast non bloquant) est affiche pour sensibiliser l'utilisateur a l'adoption d'un gestionnaire de mots de passe open source (KeePass, KeePassXC, Bitwarden, Vaultwarden).

Le traitement poursuit un objectif exclusif de protection de l'utilisateur. Il ne vise ni la surveillance, ni le profilage, ni la monetisation des donnees.

### 1.2 Base legale

**Consentement explicite (Article 6.1.a du RGPD).**

Le module M7 est active par opt-in lors de l'onboarding de l'extension (etape 4 — politique de confidentialite). L'utilisateur doit activer explicitement le module avant tout traitement. Le consentement est :

- **Libre** : M7 est desactivable independamment des autres modules. L'extension fonctionne sans M7.
- **Specifique** : le consentement porte uniquement sur le traitement de hash de mots de passe pour la detection de reutilisation.
- **Eclaire** : la page de politique de confidentialite explique en langage clair le fonctionnement du traitement, les donnees collectees, leur duree de conservation et les droits de l'utilisateur.
- **Univoque** : l'activation se fait par case a cocher dediee dans l'onboarding.

Le consentement est revocable a tout moment via la page de parametres de l'extension.

### 1.3 Donnees traitees

| Donnee                                                  | Nature                  | Stockage                                                               | Duree de conservation          |
| ------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| `password_value` (mot de passe en clair)                | Donnee sensible         | **Jamais stocke** — efface en memoire < 5 ms apres hachage (D-SEC-001) | 0 seconde                      |
| `password_hash` (SHA-256(installation_salt + password)) | Donnee pseudonymisee    | IndexedDB, champ `value` chiffre AES-256-GCM                           | 90 jours FIFO max 100 entrees  |
| `tag` (4 premiers bytes du hash)                        | Index de pre-filtration | IndexedDB, en clair                                                    | 90 jours                       |
| `domain_hash` (SHA-256(installation_salt + domain))     | Donnee pseudonymisee    | IndexedDB, en clair                                                    | 90 jours                       |
| `first_seen` (horodatage)                               | Metadonnee              | IndexedDB, en clair                                                    | 90 jours                       |
| `count` (nombre de detections)                          | Metadonnee              | IndexedDB, en clair                                                    | 90 jours                       |
| `installation_salt` (16 bytes, 128 bits)                | Cle de salage           | chrome.storage.local                                                   | Duree de vie de l'installation |

### 1.4 Responsable de traitement

L'utilisateur lui-meme est responsable de traitement au sens de l'article 4(7) du RGPD. Le traitement est integralement local : aucune donnee ne quitte le navigateur, aucun serveur n'est implique, aucune communication reseau n'est etablie.

Sentinel Nudge est un outil mis a disposition de l'utilisateur. L'editeur fournit le code source (licence GPL v3) mais ne collecte, ne recoit et ne traite aucune donnee personnelle des utilisateurs.

### 1.5 Sous-traitants

**Aucun.** Le traitement est integralement realise sur le poste de l'utilisateur par l'extension navigateur. Aucun service tiers, aucune API externe, aucun serveur distant n'intervient dans le traitement des donnees de M7.

### 1.6 Destinataires des donnees

**Aucun.** Les donnees ne sont accessibles que par l'extension elle-meme, dans le perimetre du profil Chrome de l'utilisateur. Aucune transmission, aucun partage, aucune exportation automatique.

### 1.7 Transferts hors UE

**Aucun.** Toutes les donnees restent dans le stockage local du navigateur sur le poste de l'utilisateur.

---

## 2. Necessite et proportionnalite

### 2.1 Necessite du traitement

La reutilisation de mots de passe est l'une des premieres causes de compromission de comptes. La litterature en sciences comportementales (cf. analyse de litterature P1) montre que les utilisateurs sous-estiment systematiquement ce risque. Le nudge contextuel, declenche au moment precis de la reutilisation, constitue l'intervention la plus efficace pour modifier ce comportement.

Le traitement de hash de mots de passe est techniquement indispensable pour detecter la reutilisation. Sans comparaison entre les mots de passe soumis sur differents domaines, la detection est impossible.

### 2.2 Minimisation des donnees

Le principe de minimisation (article 5.1.c du RGPD) est strictement respecte :

- **Mot de passe en clair** : jamais stocke, efface en memoire en moins de 5 ms apres hachage.
- **Hash sale** : seul le hash SHA-256(installation_salt + password) est conserve, rendant la reconstitution du mot de passe couteuse en calcul.
- **Domaine** : jamais stocke en clair, uniquement sous forme de hash sale SHA-256(installation_salt + domain).
- **URL complete** : jamais collectee.
- **Identifiant utilisateur** : aucun (pas d'UUID, pas de fingerprinting, pas de cookie — ENF-PBD-06).
- **Chiffrement au repos** : le hash du mot de passe est chiffre AES-256-GCM dans IndexedDB (ENF-PBD-04).

### 2.3 Limitation de la conservation

- **Duree maximale** : 90 jours glissants.
- **Volume maximal** : 100 entrees (FIFO — First In, First Out).
- **Purge automatique** : alarme hebdomadaire (lundi 09h) declenchee par le service worker. Suppression des enregistrements dont `first_seen < now - 90 jours`, puis suppression des plus anciens si le seuil de 100 est depasse.
- **Purge manuelle** : bouton "Supprimer toutes mes donnees" dans la page Options qui execute `indexedDB.deleteDatabase('sentinel-nudge-db')` et `chrome.storage.local.clear()`.

### 2.4 Information des personnes concernees

- **Onboarding** : explication en langage clair du fonctionnement de M7 lors de l'etape 4 de l'onboarding.
- **Page de politique de confidentialite** : accessible depuis l'onboarding et la page de parametres (ENF-PBD-08).
- **Page d'explication M7** : page statique dediee accessible depuis le toast nudge ("Voir comment ca marche").
- **Transparence radicale** : code source ouvert (GPL v3), documentation technique publique.

---

## 3. Risques pour les droits et libertes des personnes

### R1 — Reidentification du mot de passe via attaque par dictionnaire sur le hash

**Description :** Un attaquant ayant acces au stockage IndexedDB pourrait tenter de reconstituer le mot de passe en calculant SHA-256(sel + candidat) pour un grand nombre de candidats et en comparant avec les hashes stockes.

**Sources de risques :** Malware ayant acces au profil Chrome, extension malveillante avec permissions elevees, acces physique au poste non verrouille.

**Vraisemblance :** Limitee. L'attaquant doit (1) acceder au profil Chrome, (2) extraire la cle AES-256-GCM depuis chrome.storage.local, (3) dechiffrer les hashes, (4) extraire le sel d'installation, (5) mener une attaque par dictionnaire. Le sel de 128 bits empeche les rainbow tables pre-calculees. Chaque installation a un sel unique.

**Gravite :** Importante. La compromission d'un mot de passe peut entrainer l'acces non autorise a des comptes utilisateur.

**Mesures de mitigation existantes :**

- Sel local de 128 bits unique par installation (D-SEC-001)
- Chiffrement AES-256-GCM du hash au repos (NC-DPO-01)
- Nullification du mot de passe en clair en < 5 ms
- FIFO 100 entrees maximum (surface d'attaque limitee)
- Purge automatique a 90 jours

**Mesures complementaires prevues :**

- v2+ : derivation PBKDF2 depuis un PIN utilisateur pour renforcer la protection de la cle AES

### R2 — Correlation des domaines visites via les domain_hash

**Description :** Un attaquant ayant acces au stockage pourrait tenter de determiner les domaines visites par l'utilisateur en calculant SHA-256(sel + domaine_candidat) pour un dictionnaire de domaines connus.

**Sources de risques :** Memes que R1 (acces au profil Chrome necessaire).

**Vraisemblance :** Limitee. Le sel de 128 bits empeche les tables pre-calculees. L'attaquant doit connaitre le sel et tester un dictionnaire de domaines. Neanmoins, le nombre de domaines populaires est fini (~10 000 domaines couvrent 90% du trafic), rendant l'attaque plus rapide que pour les mots de passe.

**Gravite :** Limitee. La connaissance des domaines visites (sans les URL completes ni les pages) represente une atteinte a la vie privee, mais de moindre gravite que la compromission d'un mot de passe.

**Mesures de mitigation existantes :**

- Sel local de 128 bits (D-SEC-001)
- Seul le domaine est hashe (pas l'URL complete)
- Purge automatique a 90 jours
- FIFO 100 entrees maximum

### R3 — Acces non autorise aux donnees via le profil Chrome

**Description :** Un attaquant ayant acces au profil Chrome de l'utilisateur (session non verrouillee, synchronisation cloud compromise) accede a l'integralite des donnees de l'extension, y compris la cle AES et le sel d'installation.

**Sources de risques :** Acces physique au poste, compromission du compte Google (si synchronisation Chrome activee), malware avec acces au systeme de fichiers.

**Vraisemblance :** Limitee. Ce scenario suppose un acces au profil Chrome, ce qui constitue deja une compromission majeure du poste. Si le profil est compromis, l'attaquant a deja acces aux cookies, mots de passe Chrome, historique et donnees de toutes les extensions.

**Gravite :** Importante. L'acces au profil Chrome permet la compromission totale des donnees de l'extension.

**Mesures de mitigation existantes :**

- Risque accepte et documente (D-SEC-004, R-003) : la compromission du profil Chrome depasse le perimetre de l'extension
- Chiffrement AES-256-GCM qui protege contre l'extraction hors profil (copie brute de la base IndexedDB)
- Documentation de la limitation dans la page Options (transparence radicale)

**Mesures complementaires prevues :**

- v2+ : derivation PBKDF2 depuis un PIN utilisateur

### R4 — Profilage des habitudes de securite de l'utilisateur

**Description :** Les donnees de M7 (nombre de reutilisations, frequence, compteur de detections) pourraient etre utilisees pour etablir un profil des habitudes de securite de l'utilisateur.

**Sources de risques :** Exploitation par un tiers ayant acces au profil Chrome. Scenario theorique : un employeur accedant au profil Chrome d'un employe.

**Vraisemblance :** Negligeable. Les donnees sont locales, chiffrees, non transmises. Le profilage n'est possible qu'avec un acces physique ou logique au profil Chrome, et les donnees brutes (hashes et compteurs) ne permettent pas un profilage detaille sans analyse complementaire.

**Gravite :** Limitee. Le profilage se limiterait a savoir que l'utilisateur reutilise des mots de passe (information generique) et a estimer la frequence.

**Mesures de mitigation existantes :**

- Aucune transmission de donnees
- Chiffrement au repos
- Purge automatique a 90 jours
- Pas d'identifiant persistant
- Export de portabilite excluant les hashes de mots de passe (seules les metadonnees agregees sont exportees)

### R5 — Perte de controle des donnees (defaut de consentement ou d'effacement)

**Description :** L'utilisateur pourrait ne pas etre informe du traitement, ne pas pouvoir retirer son consentement, ou ne pas pouvoir exercer son droit a l'effacement.

**Sources de risques :** Defaut d'implementation de l'onboarding, bug empechant la desactivation du module ou la suppression des donnees.

**Vraisemblance :** Negligeable. Le consentement est obtenu par opt-in explicite dans l'onboarding (etape 4). La desactivation du module et l'effacement des donnees sont accessibles en 1 clic dans la page de parametres. Le code source est ouvert et auditable.

**Gravite :** Importante. L'absence de controle sur ses donnees constitue une violation directe des droits fondamentaux de la personne concernee (articles 7, 17 et 20 du RGPD).

**Mesures de mitigation existantes :**

- Consentement opt-in explicite a l'onboarding (etape 4)
- Desactivation du module M7 a tout moment via les parametres
- Bouton "Supprimer toutes mes donnees" (article 17 — droit a l'effacement)
- Bouton "Exporter mes donnees" (article 20 — droit a la portabilite) avec exclusion des hashes bruts
- Code source ouvert (GPL v3) permettant l'audit

---

## 4. Mesures envisagees pour traiter les risques

### 4.1 Mesures techniques

| Mesure                                                               | Reference       | Risques couverts |
| -------------------------------------------------------------------- | --------------- | ---------------- |
| Sel local 128 bits unique par installation                           | D-SEC-001       | R1, R2           |
| Chiffrement AES-256-GCM au repos des hashes                          | NC-DPO-01       | R1, R2, R3       |
| Nullification mot de passe en clair < 5 ms                           | D-SEC-001       | R1               |
| FIFO 100 entrees maximum                                             | SFD M7          | R1, R2, R4       |
| Purge automatique 90 jours                                           | DAT section 8.3 | R1, R2, R4       |
| Index de pre-filtration `tag` (4 bytes) sans exposer le hash complet | DAT section 8.1 | R1               |
| Aucun appel reseau sortant                                           | ENF-PBD-01      | R1, R2, R3, R4   |
| CSP stricte (script-src 'self')                                      | D-SEC-003       | R3               |
| Exclusion des hashes bruts de l'export de portabilite                | DAT section 8.3 | R1               |

### 4.2 Mesures organisationnelles

| Mesure                                                    | Reference      | Risques couverts   |
| --------------------------------------------------------- | -------------- | ------------------ |
| Code source ouvert (GPL v3)                               | CdC            | R1, R2, R3, R4, R5 |
| Documentation technique publique                          | DAT, SFD       | R5                 |
| Transparence radicale (page Options, page explication M7) | ENF-PBD-08     | R5                 |
| Tests automatises (Vitest + Playwright) en CI             | DAT section 10 | R5                 |
| Revue de code obligatoire (comite de revue code)          | Gouvernance    | R1, R3             |

### 4.3 Mesures juridiques

| Mesure                                        | Reference                    | Risques couverts |
| --------------------------------------------- | ---------------------------- | ---------------- |
| Consentement explicite opt-in (article 6.1.a) | Onboarding etape 4           | R5               |
| Droit a l'effacement en 1 clic (article 17)   | Page parametres              | R5               |
| Droit a la portabilite (article 20)           | Page parametres, export JSON | R5               |
| Revocation du consentement a tout moment      | Page parametres              | R5               |
| Politique de confidentialite en langage clair | Onboarding + parametres      | R5               |

---

## 5. Cartographie des risques residuels

### 5.1 Matrice vraisemblance x gravite apres mesures

|                 | Negligeable | Limitee | Importante | Maximale |
| --------------- | :---------: | :-----: | :--------: | :------: |
| **Maximale**    |             |         |            |          |
| **Importante**  |             |         |            |          |
| **Limitee**     |             |   R2    |   R1, R3   |          |
| **Negligeable** |             |   R4    |     R5     |          |

### 5.2 Evaluation des risques residuels

| Risque                                 | Vraisemblance residuelle | Gravite residuelle | Niveau residuel | Acceptabilite                                                                                                          |
| -------------------------------------- | ------------------------ | ------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| R1 — Reidentification par dictionnaire | Limitee                  | Importante         | Modere          | **Acceptable** — sel 128 bits + chiffrement AES-256-GCM + FIFO 100 rendent l'attaque couteuse et limitee dans le temps |
| R2 — Correlation des domaines          | Limitee                  | Limitee            | Faible          | **Acceptable** — sel 128 bits + purge 90 jours + domaines sans URL completes                                           |
| R3 — Acces via profil Chrome           | Limitee                  | Importante         | Modere          | **Acceptable** — risque inherent au modele de securite Chrome, hors perimetre de l'extension. Documente.               |
| R4 — Profilage habitudes               | Negligeable              | Limitee            | Faible          | **Acceptable** — donnees locales, chiffrees, non transmises, purgees automatiquement                                   |
| R5 — Perte de controle                 | Negligeable              | Importante         | Faible          | **Acceptable** — consentement opt-in, effacement 1 clic, code ouvert, tests automatises                                |

---

## 6. Conclusion et avis du DPO

### 6.1 Avis formel

**Le traitement mis en oeuvre par le module M7 de Sentinel Nudge est conforme au RGPD.** Les risques identifies sont maitrises par un ensemble de mesures techniques, organisationnelles et juridiques coherentes et proportionnees.

Le niveau de risque residuel global est **faible a modere**, ce qui est acceptable au regard de la finalite du traitement (amelioration de la cyber-hygiene) et de l'architecture Privacy by Design mise en oeuvre (traitement 100% local, aucune transmission, chiffrement au repos, purge automatique).

### 6.2 Conditions

Le traitement est autorise sous les conditions suivantes :

1. **Consentement opt-in obligatoire** : le module M7 ne doit jamais s'activer sans le consentement explicite de l'utilisateur a l'etape 4 de l'onboarding. Ce point doit etre verifie par un test automatise.
2. **Nullification du mot de passe en clair** : la variable contenant le mot de passe doit etre nullifiee en moins de 5 ms apres le calcul du hash. Ce point doit etre verifie par un test automatise.
3. **Purge effective** : le mecanisme FIFO 100 + purge 90 jours doit etre teste en integration pour garantir qu'aucun hash ne persiste au-dela de la duree prevue.
4. **Exclusion des hashes de l'export** : l'export de portabilite ne doit contenir que les metadonnees agregees (nombre, dates), jamais les hashes bruts.

### 6.3 Recommandations complementaires

1. **v2+ — Renforcement de la protection de la cle AES** : implementer la derivation PBKDF2 depuis un PIN utilisateur pour attenuer le risque R3 (acces via profil Chrome).
2. **Audit de securite externe** : avant la publication sur le Chrome Web Store, un audit de securite du code M7 par un tiers (meme benevole, dans le cadre open source) est recommande.
3. **Monitoring des vulnerabilites SHA-256** : bien que SHA-256 soit actuellement considere comme sur, surveiller les publications du NIST concernant les fonctions de hachage et prevoir une migration si necessaire.
4. **Test d'intrusion M7** : inclure un test specifique de resistance du hash sale aux attaques par dictionnaire dans le plan de tests de securite.

### 6.4 Mise a jour de la presente AIPD

Cette AIPD doit etre revisee dans les cas suivants :

- Modification du mecanisme de hachage ou de chiffrement
- Ajout de donnees collectees par M7
- Introduction d'un composant reseau (meme optionnel)
- Modification de la duree de conservation
- Signalement d'une vulnerabilite affectant SHA-256 ou AES-256-GCM
- Nouvelle version majeure de l'extension

---

**Risque R-007 (RISQUES.md) :** Cette AIPD repond a l'exigence documentee dans R-007 (score 8, statut Ouvert). Le statut peut etre passe a "Resolu" apres validation par le referent qualite et le Commanditaire.

---

_AIPD produite par le DPO — Fabrique — 2026-04-11_
_Conforme a l'article 35 du RGPD et aux lignes directrices du CEPD (WP248 rev.01)_
_Conforme au guide AIPD de la CNIL (PIA, version 2018)_
