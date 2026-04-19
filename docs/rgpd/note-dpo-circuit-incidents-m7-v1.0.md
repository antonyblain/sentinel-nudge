# Note DPO — Circuit DPO obligatoire pour incidents M7 (Step 2 et Step 7 du runbook)

**Référence** : T-115
**Version** : 1.0
**Date** : 2026-04-19
**Auteur** : DPO (Fabrique)
**Niveau de sensibilité** : Exposé
**Destinataires** : Référent qualité, Commanditaire, Architecte sécurité, Incident Manager
**Statut** : Avis formel — favorable, formalisation par note additive

**Documents confrontés :**
- Runbook réponse à incident v1.0 (`docs/securite/runbook-reponse-incident.md`) — Step 2 (saisine DPO systématique tout incident M7), Step 7 (validation DPO obligatoire avant notification utilisateurs), Template 6.5
- AIPD M7 v1.2 (`docs/p3-architecture/p3-aipd-m7-v1.2.md`)
- Registre des traitements Art. 30 v1.0 (`docs/rgpd/registre-des-traitements-v1.0.md`) §8 (registre des violations) et §5 (droits Art. 15-22)

---

## 1. Question soumise au DPO

Les deux étapes du runbook réponse à incident — **Step 2** (saisine DPO systématique pour tout incident touchant M7, §3.2 « Règle de montée automatique ») et **Step 7** (validation DPO obligatoire avant toute communication in-app aux utilisateurs, cf. Template 6.5) — sont-elles cohérentes avec le registre des traitements Art. 30 v1.0 et l'AIPD M7 v1.2 ? Une mise à jour formelle de l'AIPD M7 ou une note additive est-elle requise ?

## 2. Avis DPO : COHÉRENT — formalisation par la présente note additive

Les deux étapes du runbook v1.0 sont **pleinement cohérentes** avec le cadre RGPD du projet et avec les obligations du responsable de traitement au titre des Art. 33 et 34 RGPD. Elles ne nécessitent **pas** un bump majeur de l'AIPD M7, mais leur consignation formelle dans le corpus RGPD doit être assurée par la présente note additive et par leur intégration au prochain bump mineur du registre Art. 30 (v1.1, en cours T-155).

### 2.1 Cohérence avec le registre Art. 30 v1.0

- **§8 « Registre des violations »** : la procédure est explicitement référencée — « le runbook impose la saisine DPO systématique (Step 2) et la validation DPO obligatoire avant notification utilisateurs (Step 7 + template 6.5) ». **Cohérence acquise** dès v1.0.
- **§5 « Droits des personnes »** : la notification utilisateurs (Step 7) est le mécanisme opérationnel d'exécution de l'Art. 34 RGPD (communication d'une violation à la personne concernée lorsque le risque est élevé). **Cohérence acquise**.
- **Articulation Art. 33 (notification CNIL < 72h)** : le registre §8 mentionne explicitement Art. 33 et Art. 34. La validation DPO de Step 7 conditionne la communication aux utilisateurs ; la décision Art. 33 (notification CNIL) reste de la responsabilité du responsable de traitement (utilisateur final + éditeur Antony Blain selon qualification triple §1) sur avis DPO. **Cohérence à maintenir** dans tout bump runbook v1.x ou registre Art. 30 v1.x.

### 2.2 Cohérence avec l'AIPD M7 v1.2

- L'AIPD M7 §6.2 « Conditions » impose le consentement opt-in et la nullification du mot de passe. Aucune disposition ne concerne directement la procédure de réponse à incident, qui relève du runbook (mesure organisationnelle).
- La règle de montée automatique « tout incident M7 = P0 » du runbook §3.2 **renforce** la posture de l'AIPD M7 §6.1 (avis formel de conformité conditionné à la maîtrise du risque R3 « accès via profil Chrome ») : un incident M7 réel relève précisément du scénario R3 et mérite la sévérité maximale par défaut.
- **Aucune mise à jour de l'AIPD M7 v1.2 n'est nécessaire** au titre du runbook. Le lien entre AIPD et runbook sera ajouté au prochain bump mineur de l'AIPD (v1.3 prévu post TACHE-061, cf. note T-074 §4.4) sous forme d'une mention au §6.5 ou en nouvelle §6.6 « Articulation avec le runbook réponse à incident ».

### 2.3 Décision : note additive plutôt que bump AIPD

Le DPO conclut qu'une **note additive** (la présente) est l'instrument approprié, plutôt qu'un bump AIPD M7 immédiat, pour les raisons suivantes :

1. Le runbook v1.0 est un livrable Architecte sécurité validé en TACHE-110 ; ses dispositions (Step 2, Step 7, Template 6.5) sont déjà cohérentes en l'état avec le corpus RGPD existant.
2. Un bump AIPD pour formaliser un lien déjà existant (§6.5 de l'AIPD pré-validait déjà la cohérence avec le runbook) serait disproportionné.
3. La présente note additive sera référencée par le prochain bump mineur de l'AIPD M7 (v1.3) et par le registre Art. 30 v1.1 (T-155, §7 « Mesures organisationnelles »).

## 3. Procédure formelle d'escalade DPO pour incidents M7

Le DPO formalise ci-après la procédure mécanique d'escalade qui complète et confirme le runbook v1.0 :

| Étape | Déclencheur | Action obligatoire | Délai | Responsable |
|---|---|---|---|---|
| **E1 — Notification automatique DPO** | Incident classé P0 par règle automatique « tout incident M7 = P0 » (runbook §3.2) | Invocation immédiate du DPO Fabrique par l'Incident Manager via Claude Code, écrite et tracée dans le journal d'incident | **Dans les 24 h ouvrées** suivant Step 2 | Incident Manager |
| **E2 — Avis DPO sur qualification RGPD** | Réception de la notification E1 | Le DPO produit un avis écrit dans le journal d'incident : (a) qualification de violation au sens Art. 4(12) RGPD (oui/non/à investiguer), (b) recommandation Art. 33 (notification CNIL oui/non + délai), (c) recommandation Art. 34 (notification personnes concernées oui/non + canal) | **Dans les 48 h ouvrées** suivant E1 | DPO |
| **E3 — Décision Art. 33 (CNIL)** | Avis E2 reçu | Le responsable de traitement (utilisateur final pour le traitement local ; éditeur pour les vulnérabilités introduites par le code) prend la décision sur avis DPO. La notification CNIL, si due, doit être faite dans les **72 h** à compter de la prise de connaissance | Sous 72 h Art. 33 | Responsable de traitement |
| **E4 — Décision Art. 34 (personnes)** | Avis E2 reçu, décision E3 prise | Validation DPO **obligatoire** du Template 6.5 du runbook (notification utilisateurs) avant toute publication. Aucune notification ne peut être diffusée (in-app, README, blog) sans visa DPO daté dans le journal d'incident | Avant Step 9 (release publiée) | DPO |
| **E5 — Documentation au registre violations** | Step 9 complétée | Inscription de l'incident au §8 du registre Art. 30 (table « Registre des violations ») avec ID VIOL-XXX, date, nature, données impactées, mesures, statuts notifications | Sous 7 jours après Step 9 | DPO |
| **E6 — Capitalisation post-mortem** | Step 10 du runbook | Le DPO co-relit le post-mortem `gouvernance-pv-postmortem-sec-YYYYMMDD-vX.X.md` (section 4 « Impact », section 8 « Capitalisation ») et propose les enrichissements RGPD (mise à jour AIPD M7, registre Art. 30, politique confidentialité) | Sous 14-30 j après Step 9 | DPO + Incident Manager |

### 3.1 Tracabilité dans le journal d'incident

Chaque étape E1 à E6 doit produire **une entrée datée et signée DPO** dans le journal d'incident (`docs/securite/incidents/YYYYMMDD-advisory-GHSA-XXXX.md`). Format type :

```markdown
### [DPO] YYYY-MM-DD HH:MM — E2 Avis qualification RGPD
- Qualification violation Art. 4(12) : OUI / NON / À INVESTIGUER
- Recommandation Art. 33 : <oui/non> — délai restant : XXh
- Recommandation Art. 34 : <oui/non> — canal proposé : <Template 6.5 / autre>
- Justification : <2-3 lignes factuelles>
- Visa DPO : DPO Fabrique
```

### 3.2 Condition d'auto-saisine

En l'absence de signalement explicite par l'Incident Manager (cas pathologique : oubli, sous-estimation), le DPO **s'auto-saisit** dès qu'il prend connaissance d'un évènement répondant à l'un des critères suivants :

- Incident classé P0 ou P1 dans le journal d'incident projet.
- Modification non planifiée du store `password_hashes`, `m7_canary` ou `m7_incidents`.
- Mention publique (README, advisory, communauté) d'un comportement anormal du module M7.

L'auto-saisine est tracée par une entrée E1 dans le journal d'incident avec mention explicite « Saisine DPO à l'initiative du DPO (auto-saisine) ».

## 4. Conclusion

**Avis formel DPO : FAVORABLE**. Le runbook v1.0 est cohérent avec le registre Art. 30 v1.0 et l'AIPD M7 v1.2. Aucune mise à jour de l'AIPD n'est requise immédiatement. La présente note additive **acte formellement** la procédure d'escalade DPO en six étapes E1-E6, qui sera référencée :

- au prochain bump du registre Art. 30 v1.1 (T-155) §7 « Mesures organisationnelles » et §8 « Registre des violations » ;
- au prochain bump de l'AIPD M7 v1.3 (post TACHE-061) en nouvelle section §6.6 « Articulation avec le runbook réponse à incident » ;
- dans `LESSONS_LEARNED.md` (règle permanente : « tout incident M7 → saisine DPO sous 24 h ouvrées »).

---

## 5. Références

- Runbook réponse à incident v1.0 — `docs/securite/runbook-reponse-incident.md` §2.1, §3.2, §5 (Step 2, Step 7), §6.5 (Template notification utilisateurs)
- AIPD M7 v1.2 — `docs/p3-architecture/p3-aipd-m7-v1.2.md` §6.1, §6.2, §6.5
- Registre Art. 30 v1.0 — `docs/rgpd/registre-des-traitements-v1.0.md` §5, §7, §8
- RGPD Art. 4(12), Art. 33, Art. 34, Art. 39 (missions DPO)
- ISO/CEI 27001:2022 Annexe A — A.5.24, A.5.26 (gestion des incidents)
- Note DPO T-074 v1.0 (compatibilité TACHE-061) — `docs/rgpd/note-dpo-tache-061-compatibilite-aipd-v1.0.md`

---

*Note DPO produite par le DPO — Fabrique — v1.0 2026-04-19. Note additive au corpus RGPD projet, ne se substitue pas à un bump AIPD ou registre.*
