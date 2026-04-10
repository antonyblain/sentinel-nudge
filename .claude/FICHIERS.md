# FICHIERS — Règles de classement et convention de nommage

**Règle** : avant de ranger un fichier, vérifier son type ci-dessous. Si le type est inconnu, demander l'avis du Commanditaire et enrichir ce fichier immédiatement.

## Convention de nommage des documents
Format : `<phase>-<type>-v<majeur>.<mineur>.docx`
- Version majeure : incrémentée en cas de rejet et reprise complète
- Version mineure : incrémentée en cas de validation avec commentaires intégrés
- Exemples : `p1-cahier-des-charges-v1.0.docx`, `p3-dat-v2.1.docx`, `gouvernance-pv-architecture-v1.0.docx`

## Arborescence cible

| Type de fichier | Emplacement | Exemple |
|----------------|-------------|---------|
| Livrables P1 (besoin) | `docs/p1-besoin/` | p1-cahier-des-charges-v1.0.docx |
| Livrables P2 (spéc. fonc.) | `docs/p2-specifications/` | p2-sfd-v1.0.docx |
| Livrables P3 (architecture) | `docs/p3-architecture/` | p3-dat-v1.0.docx |
| Livrables P4 (conception) | `docs/p4-conception/` | p4-std-v1.0.docx |
| Livrables P4' (tests) | `docs/p4b-strategie-tests/` | p4b-plan-de-tests-v1.0.docx |
| Rapports P5 (TU) | `docs/p5-tests-unitaires/` | p5-rapport-tu-v1.0.docx |
| Rapports P6 (TI) | `docs/p6-tests-integration/` | p6-rapport-ti-v1.0.docx |
| PV de recette P7 | `docs/p7-recette/` | p7-pv-recette-v1.0.docx |
| Mode opératoire P8 | `docs/p8-mep/` | p8-mode-operatoire-v1.0.docx |
| PV de comités | `docs/gouvernance/` | gouvernance-pv-architecture-v1.0.docx |
| Fiches qualité | `docs/gouvernance/` | Annexées aux PV |
| Résumés de session | `docs/gouvernance/resumes/` | resume-session-2026-04-10.md |
| Guide actions manuelles | `docs/actions-manuelles/` | actions-manuelles-v1.0.docx |
| Référentiel sécurité | `docs/` | referentiel-securite.docx |
| Référentiel RGPD | `docs/` | referentiel-rgpd.docx |
| Rétrospective | `docs/gouvernance/` | retrospective-v1.0.docx |
| Code source extension | `src/` | background.ts, content.ts, popup.html |
| Tests automatisés | `tests/` | Selon la stack |
| Infrastructure / CI | `infra/` | github-actions.yml |
| Secrets (NON versionné) | Racine | .env |
| Template secrets | Racine | .env.example |
| Diagrammes Mermaid | Avec le livrable qui les référence | p3-diagramme-c4.mermaid |
| Maquettes / images | Avec le livrable qui les référence | p2-maquette-accueil.png |

_Ce fichier est enrichi à chaque nouveau type de fichier rencontré._
