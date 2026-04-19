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
| **Mini-DAT P5 (décisions architecture par tâche)** | `docs/p5-decisions/` | `p5-minidat-tache-061-heartbeat-m7-v1.1.md` (arbitrage Commanditaire 19/04 — voir T-170) |
| Rapports P6 (TI) | `docs/p6-tests-integration/` | p6-rapport-ti-v1.0.md |
| **Plan de tests manuels P5** | `docs/p5-recette/` | `plan-tests-manuels-consolide-v1.0.md`, `matrice-compatibilite-providers-m7-v1.0.md` |
| PV de recette P7 | `docs/p7-recette/` | p7-pv-recette-v1.0.md |
| Mode opératoire P8 | `docs/p8-mep/` | p8-mode-operatoire-v1.0.md |
| PV de comités | `docs/gouvernance/` | gouvernance-pv-architecture-v1.0.md |
| Fiches qualité | `docs/gouvernance/` | Annexées aux PV |
| Résumés de session | `docs/gouvernance/resumes/` | resume-session-2026-04-10.md |
| **Revues Fabrique transversales** | `docs/gouvernance/revues-fabrique-<date>/` | `00-synthese-consolidee.md` + `01-…` à `09-…` (1 par rôle) |
| Guide actions manuelles | `docs/actions-manuelles/` | actions-manuelles-v1.0.md |
| **Référentiel sécurité ISO 27001** | `docs/securite/` | `referentiel-iso27001-v1.x.md` (versionné — convention enrichie 19/04) |
| **Runbook réponse à incident** | `docs/securite/` | `runbook-reponse-incident-v1.x.md` |
| **Audits sécurité** | `docs/securite/` | `audit-config-github-v1.0.md`, `hardening-ci-cd-v1.0.md` |
| **Politique de confidentialité** | `docs/rgpd/` | `politique-de-confidentialite-v1.x.md` |
| **Registre des traitements Art. 30** | `docs/rgpd/` | `registre-des-traitements-v1.x.md` |
| **Notes DPO complémentaires** | À éviter — préférer évolution AIPD M7 v1.x ou registre v1.x existants (cf. feedback Commanditaire 19/04 « pas de démultiplication »). Si vraiment justifié : `docs/rgpd/note-dpo-<sujet>-v1.x.md` |
| **Audits accessibilité** | `docs/accessibilite/` | `checklist-accessibilite-pages-statiques-v1.x.md`, `audit-axe-core-themes-v1.x.md` |
| **Captures preuves a11y (NVDA, axe-core JSON)** | `docs/accessibilite/captures/` | Brut, non-versionné en doc rédigée |
| **ADR (Architecture Decision Records)** | `docs/adr/` | `adr-001-sw-boot-contract.md`, `adr-002-cross-lifecycle-intent.md` — uniquement décisions cross-cutting/réutilisables. Les autres restent dans le corps du DAT (cf. feedback 19/04). |
| Référentiel sécurité (legacy) | `docs/` | _Ancien emplacement — déprécié au profit de `docs/securite/`_ |
| Référentiel RGPD (legacy) | `docs/` | _Ancien emplacement — déprécié au profit de `docs/rgpd/`_ |
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
