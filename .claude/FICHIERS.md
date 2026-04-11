# FICHIERS — Règles de classement et convention de nommage

**Règle** : avant de ranger un fichier, vérifier son type ci-dessous. Si le type est inconnu, demander l'avis du Commanditaire et enrichir ce fichier immédiatement.

## Convention de nommage des documents
Format : `<phase>-<type>-v<majeur>.<mineur>.md`
- Extension `.md` (Markdown) retenue pour tous les livrables — format natif Claude Code, versionnable Git, lisible sans outil tiers
- Version majeure : incrémentée en cas de rejet et reprise complète
- Version mineure : incrémentée en cas de validation avec commentaires intégrés
- Exemples : `p1-cahier-des-charges-v1.0.md`, `p3-dat-v2.1.md`, `gouvernance-pv-architecture-v1.0.md`

## Arborescence cible

| Type de fichier | Emplacement | Exemple |
|----------------|-------------|---------|
| Livrables P1 (besoin) | `docs/p1-besoin/` | p1-cahier-des-charges-v1.0.md |
| Livrables P2 (spéc. fonc.) | `docs/p2-specifications/` | p2-sfd-v1.0.md |
| Livrables P3 (architecture) | `docs/p3-architecture/` | p3-dat-v1.0.md |
| Livrables P4 (conception) | `docs/p4-conception/` | p4-std-v1.0.md |
| Livrables P4' (tests) | `docs/p4b-strategie-tests/` | p4b-plan-de-tests-v1.0.md |
| Rapports P5 (TU) | `docs/p5-tests-unitaires/` | p5-rapport-tu-v1.0.md |
| Rapports P6 (TI) | `docs/p6-tests-integration/` | p6-rapport-ti-v1.0.md |
| PV de recette P7 | `docs/p7-recette/` | p7-pv-recette-v1.0.md |
| Mode opératoire P8 | `docs/p8-mep/` | p8-mode-operatoire-v1.0.md |
| PV de comités | `docs/gouvernance/` | gouvernance-pv-architecture-v1.0.md |
| Fiches qualité | `docs/gouvernance/` | Annexées aux PV |
| Résumés de session | `docs/gouvernance/resumes/` | resume-session-2026-04-10.md |
| Guide actions manuelles | `docs/actions-manuelles/` | actions-manuelles-v1.0.md |
| Référentiel sécurité | `docs/` | referentiel-securite.md |
| Référentiel RGPD | `docs/` | referentiel-rgpd.md |
| Rétrospective | `docs/gouvernance/` | retrospective-v1.0.md |
| Code source extension | `src/` | background.ts, content.ts, popup.html |
| Tests automatisés | `tests/` | Selon la stack |
| Infrastructure / CI | `infra/` | github-actions.yml |
| Secrets (NON versionné) | Racine | .env |
| Template secrets | Racine | .env.example |
| Diagrammes Mermaid (sources) | `docs/<phase>/diagrammes/sources/` | p3-c4-contexte.mmd |
| Diagrammes Mermaid (images) | `docs/<phase>/diagrammes/images/` | p3-c4-contexte.png |
| Maquettes / images | `docs/<phase>/diagrammes/images/` | p2-maquette-accueil.png |

_Ce fichier est enrichi à chaque nouveau type de fichier rencontré._
