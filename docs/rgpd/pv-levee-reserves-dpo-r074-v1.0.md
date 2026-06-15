# PV de levée des réserves DPO R-074-01/02/03

**Projet :** Sentinel Nudge
**Version :** 1.0
**Date :** 2026-04-20
**Auteur :** DPO (Fabrique — orchestrateur direct)
**Référence :** Note DPO T-074 + sous-tâches T-191/T-192/T-193
**Statut :** Validé — avis **FAVORABLE SANS RÉSERVE** (mise à jour de la note T-074 initiale)

---

## 1. Contexte

La note DPO T-074 (`docs/rgpd/note-dpo-tache-061-compatibilite-aipd-v1.0.md`, antérieurement livrée en PR #82) avait émis un **avis FAVORABLE SOUS RÉSERVES** sur la compatibilité du mini-DAT TACHE-061 (heartbeat M7 + registre d'incidents `m7_incidents`) avec l'AIPD M7 v1.1+. Trois réserves avaient été qualifiées **bloquantes MEP v1.0** :

| Réserve | Objet |
|---------|-------|
| R-074-01 | Absence de garantie formelle de non-fuite de `domain_hash` brut (ou `password_hash` / `installation_salt` / URL complète) dans le champ `context` du store `m7_incidents` — violation potentielle Art. 5.1.c RGPD (minimisation) |
| R-074-02 | Absence de TTL absolue par âge sur `m7_incidents` — la borne FIFO 500 seule ne garantit pas Art. 5.1.e RGPD (limitation de conservation) en cas de faible volume |
| R-074-03 | Inclusion par défaut du registre `m7_incidents` dans l'export Art. 20 RGPD (portabilité) — surface de profilage exposable inutilement élargie |

Ces 3 réserves ont été tracées formellement en PR #142 (T-164) dans `.claude/RISQUES.md` (R-074-01/02/03) et `.claude/BACKLOG.md` (3 sous-tâches T-191, T-192, T-193 de vérification formelle post-livraison).

---

## 2. Livrables vérifiés

### 2.1 T-158 — R-074-01 : assertion absence `domain_hash` brut

**PR :** #144 (mergée sur `develop` le 2026-04-20)

**Code vérifié sur `develop`** :
- `src/background/services/incident-service.ts` expose `assertNoDomainHashInContext(context: unknown): void`
- Fonction détecte et rejette (via `throw new Error('INV-SEC-04 violation: forbidden field in IncidentContext')`) tout champ contenant :
  - clé matchant `FORBIDDEN_KEY_PATTERN` (`domain_hash`, `password_hash`, `installation_salt`)
  - valeur SHA-256 hex (64 caractères `/^[a-f0-9]{64}$/i`)
  - valeur HEX32 (salt pattern)
  - valeur URL complète (`/https?:\/\/[^\s]+/`)
- Appel systématique en tête de `IncidentService.log()` — fail-fast garanti

**Tests unitaires** : `tests/unit/shared/incident-service-r074-01.test.ts` — **11 tests verts** couvrant tous les cas de rejet + acceptation.

**Vérification DPO** : Art. 5.1.c RGPD (minimisation) — ✅ satisfait. Aucune donnée pseudonymisée ni identifiante ne peut être écrite dans le contexte d'incident.

**Verdict R-074-01 : LEVÉE**

### 2.2 T-159 — R-074-02 : TTL absolue 365 jours

**PR :** #144 combiné (mergée sur `develop` le 2026-04-20)

**Code vérifié sur `develop`** :
- `IncidentEntry` enrichi avec `expires_at: number` (`src/shared/types/diagnostics.ts`)
- Chaque `IncidentService.log()` initialise `expires_at = Date.now() + 365 * 86400 * 1000`
- Méthode `purgeOldEntries(ttlDays: number = 365): Promise<number>` exposée par `IncidentService`
- Intégration dans `onPurgeDaily` (`src/background/service-worker.ts`) — cycle quotidien
- **Pas de dérogation severity** : même les incidents `severity=error` sont purgés après 365j (Art. 5.1.e strict). JSDoc le documente explicitement.

**Tests unitaires** : `tests/unit/shared/incident-service-r074-02.test.ts` — **6 tests verts** dont TC-M7-30 (purge inter-stores).

**Vérification DPO** : Art. 5.1.e RGPD (limitation de conservation) — ✅ satisfait. Durée 365 jours cohérente avec cycle annuel d'audit + conservation technique minimale.

**Verdict R-074-02 : LEVÉE**

### 2.3 T-160 — R-074-03 : exclusion export portabilité

**PR :** #145 (mergée sur `develop` le 2026-04-19)

**Code vérifié sur `develop`** :
- `src/pages/options/options.ts` — `handleExport(config, includeIncidents = false)` : paramètre opt-in par défaut `false`
- Logique de récupération conditionnelle — `getAllIncidents` appelé uniquement si `includeIncidents === true`
- Payload construit conditionnellement : `const exportPayload = includeIncidents ? { ...basePayload, m7_incidents: m7Incidents } : basePayload`
- UI option opt-in : checkbox `#export-include-m7-incidents` avec `aria-describedby` (accessibilité WCAG 1.3.1 / 4.1.2)
- Commentaires code référençant R-074-03 / Art. 5.1.c / Art. 20 RGPD

**Tests unitaires** : `tests/unit/pages/options/handle-export-r074-03.test.ts` — **8 tests verts** (TC-01 à TC-08) couvrant exclusion par défaut, opt-in, régression stores standard, accessibilité checkbox, fallback SW erreur.

**Vérification DPO** : Art. 5.1.c (minimisation) + Art. 20 (portabilité) — ✅ satisfait. La portabilité par défaut ne contient pas les métadonnées de profilage inutiles ; l'opt-in permet une portabilité étendue consentie explicitement.

**Verdict R-074-03 : LEVÉE**

---

## 3. Avis DPO final

À l'issue de la vérification des 3 livrables (code + tests), de leur merge effectif sur la branche `develop`, et de la validation de leur conformité aux articles 5.1.c, 5.1.e et 20 du RGPD :

> **Avis DPO : FAVORABLE SANS RÉSERVE** (mise à jour de la note DPO T-074 initiale)

Les 3 réserves bloquantes MEP v1.0 sont **LEVÉES**. Le registre `m7_incidents` et sa gestion (IncidentService, purge, export) sont désormais **conformes** à la politique de confidentialité v1.2, à l'AIPD M7 v1.3 et aux exigences RGPD Art. 5.1.c / 5.1.e / 20.

---

## 4. Traçabilité

| Réserve | Livrable | PR | Tests | Statut final |
|---------|----------|----|-------|--------------|
| R-074-01 | assertNoDomainHashInContext | #144 | 11 verts | Levée (T-158 + T-191 + PV 2026-04-20) |
| R-074-02 | purgeOldEntries TTL 365j | #144 (combiné) | 6 verts | Levée (T-159 + T-192 + PV 2026-04-20) |
| R-074-03 | exclusion m7_incidents export | #145 | 8 verts | Levée (T-160 + T-193 + PV 2026-04-20) |

**Total** : 3 réserves levées, **25 tests unitaires** validant les garanties RGPD.

---

## 5. Mises à jour associées

Dans le cadre de ce PV :
- `.claude/RISQUES.md` : statuts R-074-01/02/03 passent de `Ouvert — Bloquant MEP v1.0` à `Levée (PV 2026-04-20)`
- `.claude/BACKLOG.md` : statuts T-191/T-192/T-193 passent de `À faire` à `Terminé (PV 2026-04-20)`

Aucun bump de version requis sur la politique de confidentialité v1.2 ni sur l'AIPD M7 v1.3 — ces documents sont déjà cohérents avec l'implémentation livrée. Ce PV constitue l'élément de **démontrabilité (Art. 5.2 accountability)** de la conformité.

---

## 6. Historique des révisions

| Version | Date | Modifications |
|---------|------|---------------|
| 1.0 | 2026-04-20 | Version initiale — levée formelle des 3 réserves DPO R-074-01/02/03 après vérification code + tests sur `develop` |

---

*PV produit par le DPO de la Fabrique (orchestrateur direct — agent DPO Fabrique ayant correctement refusé auparavant le 2026-04-20 00h55 sur une branche intermédiaire ne contenant pas le code T-158+T-159, cf. feedback_dpo_verification_code_avant_pv.md).*
*Conforme au principe Art. 5.2 RGPD : conformité démontrée par vérification factuelle des livrables, non postulée.*
