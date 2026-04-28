# MIGRATIONS — Schéma IndexedDB Sentinel Nudge

**Projet :** Sentinel Nudge
**Version doc :** 1.0
**Date :** 2026-04-20
**Cible :** traçabilité des évolutions du schéma IndexedDB + migrations prévisibles v1 → v2+ (T-029 BACKLOG)

---

## 1. Objet

Ce document trace le schéma IndexedDB courant de Sentinel Nudge v1 et décrit le protocole de migration à suivre pour toute évolution future (v2+). Complète le DAT v1.5 §Storage + mini-DAT TACHE-061 heartbeat M7.

## 2. Schéma v1 courant

**Base** : `sentinelNudgeDB` • **Version** : `1`

### 2.1 Stores

| Store | Clé | Indexes | Contenu | Module |
|-------|-----|---------|---------|--------|
| `password_hashes` | `id` (auto) | `tag`, `domain_hash` | `{value: chiffré AES-GCM, iv, tag, domain_hash, ts}` | M7 |
| `events` | `id` (auto) | `ts`, `module` | `{ts, module, type, payload}` log événements modules | M3 |
| `quiz_sessions` | `id` (auto) | `ts` | `{ts, question_id, answer, correct, duration_ms}` | M6 |
| `weekly_scores` | `week` (ISO) | `ts` | `{week, ts, scores_per_module, total}` | M3 |
| `m7_incidents` | `id` (auto) | `ts`, `type` | `{ts, severity, type, context, expires_at}` — FIFO 500 + TTL 365j (T-159) | M7 diagnostics |

### 2.2 Invariants

- **INV-IDB-01** : toutes écritures via `StorageService` (aucun accès direct `indexedDB` depuis handlers).
- **INV-IDB-02** : valeurs chiffrées (`password_hashes.value`) utilisent AES-GCM 256 + IV 12 octets unique par entrée.
- **INV-IDB-03** : timestamps `ts` en ms Unix (`Date.now()`).
- **INV-IDB-04** : pas de données identifiantes directes — uniquement hashes salés + valeurs chiffrées.
- **INV-IDB-05** : `m7_incidents.context` protégé par `assertNoDomainHashInContext` (T-158) — refuse `domain_hash` / `password_hash` / `installation_salt` / URL complète.

## 3. Protocole de migration

Toute évolution du schéma IDB doit :

1. **Incrémenter la version** (`DB_VERSION` dans `storage-service.ts`).
2. **Ajouter méthode `migrateV<N>ToV<N+1>(db: IDBDatabase)`** dans `StorageService` : créations/suppressions stores, ajout indexes, migration données existantes.
3. **Préserver la rétro-compatibilité de lecture** pendant ≥1 cycle — données existantes jamais perdues silencieusement.
4. **Documenter la migration** dans ce fichier (§4 prévisibles + §5 effectuées).
5. **Tests d'intégration** TC-MIGRATION-V<N-TO-N+1> : migration réussie + données legacy corrompues → fallback + log incident `migration_failed`.

## 4. Migrations prévisibles v2

### 4.1 Migration M7 — stats agrégées
**Déclencheur** : T-109 page état de santé.
**Changement** : store `m7_stats` `{date_iso, total_detections, total_dismissed, total_false_positives}` (perf).
**Migration** : créer store vide, peupler au prochain `onPurgeDaily`.

### 4.2 Migration M6 — paramètres quiz
**Déclencheur** : personnalisation quiz (difficulté, thèmes).
**Changement** : `m6_config.*` dans `chrome.storage.local` (pas IDB — mention tracabilité).

### 4.3 Migration M2 — tri whitelist par fréquence
**Déclencheur** : whitelist >1000 entrées.
**Changement** : index `last_accessed` + migration depuis `chrome.storage.local.m2_whitelist` vers nouveau store IDB.

### 4.4 Migration globale — versioning schéma
**Déclencheur** : adoption JSON Schema versionné.
**Changement** : champ `schema_version: number` sur toutes les entrées.
**Migration** : backfill via curseur, `schema_version = 1` sur legacy.

## 5. Historique des migrations effectuées

| Version | Date | Changement | PR | Test intégration |
|---------|------|------------|----|------------------|
| 1 | 2026-04-10 | Création initiale : `password_hashes`, `events`, `quiz_sessions`, `weekly_scores` | Init projet | Unitaires |
| 1.1 (additive) | 2026-04-16 | Ajout store `m7_incidents` (T-061 heartbeat M7) | PR #4 | `boot-sequence-canary-reinit.test.ts` (T-076) |
| 1.2 (additive) | 2026-04-20 | TTL 365j (`expires_at`) + `assertNoDomainHashInContext` (T-158/T-159) | PR #144 | `incident-service-r074-01/02.test.ts` |

> **Note** : 1.1 et 1.2 sont **additives** — le projet a choisi de ne pas incrémenter `DB_VERSION` (reste à 1) car nouveaux stores créés au boot via `initDB()` idempotent (T-081 renforce).

## 6. Responsabilités

- **Architecte logiciel** : valide migration v<N> → v<N+1> en comité d'architecture avant implémentation.
- **Architecte sécurité** : revue STRIDE (fuites données legacy, chiffrement conservé).
- **Développeur** : implémente `migrateV<N>ToV<N+1>` + tests d'intégration.
- **DPO** : valide conformité RGPD si migration touche données personnelles ou durées conservation.
- **Testeur QA** : TC-MIGRATION + recette manuelle sur storage legacy avant release.

## 7. Références

- DAT v1.5 §Storage • SFD v1.2.1 §2.M7 • Mini-DAT TACHE-061 heartbeat M7 • AIPD M7 v1.3 §6.5

## 8. Historique des révisions

| Version | Date | Modifications |
|---------|------|---------------|
| 1.0 | 2026-04-20 | Version initiale — schéma IDB v1 + protocole migration + 4 migrations prévisibles v2 (T-029) |
