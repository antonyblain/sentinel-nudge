# SESSION — État courant du projet

## Projet
- **Nom** : Sentinel Nudge
- **Niveau de sensibilité** : Exposé
- **Dépôt GitHub** : https://github.com/antonyblain/sentinel-nudge
- **Date de création** : 2026-04-10

## État courant
- **Phase active** : P3
- **Dernière action** : PR #2 mergée dans develop — P3 clôturée — 2026-04-11
- **Prochaine action attendue** : Passage en P4 (conception détaillée) ou P4' (stratégie de tests). Créer branche feature/p4-conception.
- **Branche Git active** : develop
- **Branche Git active** : feature/p3-architecture

## Livrables produits

| Phase | Livrable | Version | Statut | Date |
|-------|----------|---------|--------|------|
| P1 | p1-analyse-litterature-nudging-v2.0.md | v2.0 | Validé | 2026-04-11 |
| P1 | p1-cahier-des-charges-v1.1.md | v1.1 | Validé | 2026-04-11 |
| P1 | p1-analyse-licences-open-source-v1.0.md | v1.0 | Validé (GPL v3 retenue) | 2026-04-11 |
| P2 | gouvernance-pv-securite-p2-v1.0.md | v1.0 | Produit | 2026-04-11 |
| P2 | p2-sfd-v1.0.md | v1.0 | Validé | 2026-04-11 |
| P2 | p2-sfd-v1.1.md | v1.1 | Validé | 2026-04-11 |
| P3 | p3-dat-v1.1.md | v1.1 | Validé | 2026-04-11 |
| P3 | gouvernance-pv-architecture-v1.0.md | v1.0 | Validé | 2026-04-11 |
| P3 | p3-aipd-m7-v1.0.md | v1.0 | Validé (D-SEC-005 satisfait) | 2026-04-11 |

## Actions manuelles en attente

| ID | Titre | Statut |
|----|-------|--------|

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
