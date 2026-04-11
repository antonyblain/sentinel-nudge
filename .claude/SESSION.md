# SESSION — État courant du projet

## Projet
- **Nom** : Sentinel Nudge
- **Niveau de sensibilité** : Exposé
- **Dépôt GitHub** : https://github.com/antonyblain/sentinel-nudge
- **Date de création** : 2026-04-10

## État courant
- **Phase active** : P1
- **Dernière action** : CdC v1.1 validé, licence GPL v3 validée et appliquée, PDCA LL-002 intégré — 2026-04-11
- **Prochaine action attendue** : Passage en P2 (spécifications fonctionnelles détaillées)
- **Branche Git active** : develop

## Livrables produits

| Phase | Livrable | Version | Statut | Date |
|-------|----------|---------|--------|------|
| P1 | p1-analyse-litterature-nudging-v2.0.md | v2.0 | Validé | 2026-04-11 |
| P1 | p1-cahier-des-charges-v1.1.md | v1.1 | Validé | 2026-04-11 |
| P1 | p1-analyse-licences-open-source-v1.0.md | v1.0 | Validé (GPL v3 retenue) | 2026-04-11 |

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
