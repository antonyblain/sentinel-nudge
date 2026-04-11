# Procès-Verbal du Comité d'Architecture — Sentinel Nudge

## En-tête

| Champ | Valeur |
|-------|--------|
| **Instance** | Comité d'architecture |
| **Date** | 2026-04-11 |
| **Phase** | P3 — Conception architecturale |
| **Document examiné** | p3-dat-v1.0.md |
| **Version PV** | 1.0 |
| **Rapporteur** | Architecte logiciel |

## Participants

| Rôle | Présent | Note |
|------|---------|------|
| Architecte logiciel | Oui (rapporteur) | — |
| Architecte sécurité | Oui | 4/5 |
| DPO | Oui | 4/5 |
| Expert accessibilité | Oui | 3/5 |
| Expert UX/UI | Oui | 4/5 |

**Moyenne de satisfaction : 3.75/5**

---

## Ordre du jour

1. Revue des choix d'architecture (patterns, composants, flux de données)
2. Revue des choix technologiques (stack, frameworks)
3. Modélisation de menaces STRIDE
4. Exigences RGPD sur les flux de données
5. Validation du design system et des composants UI
6. Exigences d'accessibilité
7. Plan B pour chaque dépendance externe

---

## Synthèse des travaux

Le DAT v1.0 a été examiné par les 4 participants. Le document est jugé **de haute qualité sur le fond** : architecture MV3 correctement modélisée, 8 ADR justifiées avec plan B, matrice de traçabilité complète, 10 risques techniques identifiés. Les 5 décisions D-SEC du comité sécurité P2 sont toutes intégrées.

L'avis unanime est **favorable avec réserves**. Les réserves portent sur des points de précision et de complétude, pas sur des remises en cause de l'architecture. Aucune escalade au Commanditaire n'est requise.

---

## Avis individuels

### Architecte sécurité — 4/5

**Points positifs :** CSP exemplaire (`connect-src 'none'`), permissions minimales rigoureuses, chiffrement AES-256-GCM correctement spécifié, sanitisation DOM enforced par ESLint (D-SEC-003), traçabilité complète, zéro dépendance crypto externe.

**Analyse STRIDE :** 22 menaces évaluées sur 5 composants (SW, CS, IndexedDB, chrome.storage, communication). Mitigations jugées adéquates sauf 2 non-conformités.

**Non-conformités :**
- **NC-SEC-01 (Élevée)** : Absence de validation runtime des messages dans le MessageRouter. TypeScript est effacé à la compilation — un message malformé peut atteindre le SW sans contrôle.
- **NC-SEC-02 (Modérée)** : domain_hash calculé par SHA-256(domain) sans sel. Contrairement aux passwords (D-SEC-001 avec sel), les domaines sont corrélables par dictionnaire (top 1M domaines publics).
- **NC-SEC-03 (Faible)** : outerHTML et insertAdjacentHTML non couverts par la règle ESLint D-SEC-003.
- **Incohérence D-SEC-001** : taille du sel — SFD mentionne 16 bytes, DAT mentionne 32 bytes. À clarifier.

**Recommandations :** REC-01 (validation runtime messages), REC-02 (saler domain_hash), REC-03 (nullification variable mdp M7), REC-04 (ESLint outerHTML), REC-05 (durcissement CI/CD supply chain), REC-06 (X-Content-Type-Options pages internes).

### DPO — 4/5

**Points positifs :** Privacy by design structurant (postulat A1), CSP `connect-src 'none'` comme garantie technique, chiffrement au repos, droit d'effacement en 1 clic, domaines systématiquement hachés, M7 correctement identifié pour consentement explicite.

**Cartographie des données personnelles :** 8 types de données identifiés, 6 stockages cartographiés, durées de conservation conformes au SFD (après correction ANOM-001).

**Non-conformités :**
- **NC-DPO-01 (Élevée)** : Store `password_hashes` exclu du périmètre de chiffrement AES-256-GCM. Ce store contient les données les plus sensibles du projet.
- **NC-DPO-02 (Moyenne)** : Bases légales RGPD non formalisées dans le DAT par store IndexedDB.
- **NC-DPO-03 (Faible)** : Champ `module_data: Record<string, unknown>` non borné — risque de collecte excessive.

**Recommandations :** R-DPO-01 (AIPD M7 avant fin P3), R-DPO-02 (registre des traitements), R-DPO-03 (statut responsable de traitement), R-DPO-04 (droit à la portabilité — export JSON), R-DPO-05 (console.log en production), R-DPO-06 (accès Dashboard à IndexedDB).

### Expert accessibilité — 3/5

**Points positifs :** Conscience réelle des enjeux accessibilité, Shadow DOM mode open, live regions, focus trap documenté, targets 44x44px.

**Non-conformités (9) :**
- **NC-ACC-01 (Bloquante)** : M2 `role="dialog"` dans DAT vs `role="alertdialog"` dans SFD.
- **NC-ACC-02 (Bloquante)** : M2 `aria-describedby` absent du tableau §11.1.
- **NC-ACC-08 (Bloquante)** : Dashboard SVG sans architecture d'alternative textuelle.
- **LA-ACC-01 (Bloquante)** : `trapFocus()` utilise `document.activeElement` au lieu de `shadowRoot.activeElement` — code défaillant dans Shadow DOM.
- **NC-ACC-03 (Majeure)** : Focus initial M2 non prescrit sur "Abandonner la saisie".
- **NC-ACC-04 (Majeure)** : M6 quiz sans spécification ARIA (fieldset/legend).
- **NC-ACC-05 (Majeure)** : Barre M9 `role="progressbar"` sans `aria-label`.
- **NC-ACC-06 (Majeure)** : Toasts M5/M7 — `role="alert"`/`assertive` inadapté, devrait être `role="status"`/`polite`.
- **NC-ACC-07 (Mineure)** : Popup M3 — symboles Unicode sans équivalent textuel.

**Lacunes architecturales (6) :** LA-02 (lang dynamique shadow root), LA-03 (valeurs RGB concrètes contraste), LA-04 (overlay M2 responsive zoom 200%), LA-05 (axe-core absent CI), LA-06 (pages statiques sans checklist accessibilité).

**Recommandations :** R-ACC-01 à R-ACC-08 (corrections code trapFocus, tableau §11.1, SVG dashboard, tokens contraste, axe-core CI, prefers-reduced-motion, focus initial M2, checklist pages statiques).

### Expert UX/UI — 4/5

**Points positifs :** Décisions architecturales justifiées et traçables, séparation détecteurs/UI pertinente, patterns ARIA corrects par type, animations bien dimensionnées (200-300ms), pas de framework UI = défendable et bien argumenté.

**Non-conformités :**
- **NC-UX-01 (Bloquante)** : Design system incomplet — seuls 3 tokens couleur définis. Manquent : palette sémantique (danger/success/warning), typographie, espacement, bordures, ombres.
- **NC-UX-02 (Majeure)** : Overlay M6 quiz non spécifié dans le DAT (type, transitions, feedback).
- **NC-UX-03 (Mineure)** : Overlay M9 sans largeur minimale (recommandation 240px).
- **NC-UX-04 (Mineure)** : `role="progressbar"` pour M9 — `role="meter"` plus sémantique.
- **NC-UX-05 (Mineure)** : i18n pluriel pour indicateur file d'attente non couvert.
- **NC-UX-06 (Mineure)** : Séquençage M2+M7 (5s delay) non repris dans architecture QuotaManager.

**Recommandations :** R-01 (compléter design system tokens), R-02 (spécifier interface M6), R-03 (popup état initial), R-04 (toasts fenêtre étroite), R-05 (wording OK).

---

## Divergences et arbitrages

### Divergence 1 — role="progressbar" vs role="meter" pour M9

- **Expert accessibilité** : `role="progressbar"` est acceptable mais devrait avoir `aria-label`.
- **Expert UX/UI** : `role="meter"` est plus sémantique pour un score discret à 5 niveaux.
- **Décision** : Adopter `role="meter"` avec `aria-label="Force du mot de passe"`, `aria-valuemin="0"`, `aria-valuemax="4"`, `aria-valuenow` dynamique, `aria-valuetext` pour le label textuel (ex: "Fort"). `role="meter"` est supporté par ARIA 1.1+ et les AT modernes.

### Divergence 2 — Chiffrement du store password_hashes

- **DPO** : Le store doit être chiffré (données les plus sensibles).
- **Architecte sécurité** : Le hash est la clé primaire, le chiffrer empêche la recherche O(1).
- **Décision (compromis)** : Modifier le schéma — passer en auto-increment pour la clé primaire, stocker le hash dans le champ `value` chiffré. Créer un index secondaire sur un "tag" non réversible (ex: 4 premiers bytes du hash) pour la pré-filtration, avec vérification exacte après déchiffrement. Impact performance acceptable (FIFO 100 max).

### Divergence 3 — Taille du sel D-SEC-001

- **Architecte sécurité** : Incohérence SFD (16 bytes) vs DAT (32 bytes hex).
- **Décision** : Retenir 16 bytes (128 bits) conformément au SFD. Le stockage "32 bytes hex" dans le DAT est la représentation hexadécimale de 16 bytes — clarifier la formulation dans le DAT pour lever l'ambiguïté.

---

## Tâches complémentaires (BACKLOG)

| ID | Tâche | Responsable | Priorité |
|----|-------|-------------|----------|
| T-ARCH-01 | Ajouter module `message-validator.ts` dans le DAT — validation runtime des messages SW | Architecte logiciel | Haute |
| T-ARCH-02 | Saler domain_hash avec installation_salt (aligner sur D-SEC-001) | Architecte logiciel | Haute |
| T-ARCH-03 | Modifier schéma password_hashes : auto-increment + hash chiffré + tag 4 bytes | Architecte logiciel | Haute |
| T-ARCH-04 | Corriger trapFocus() : shadowRoot.activeElement | Architecte logiciel | Haute |
| T-ARCH-05 | Corriger tableau §11.1 : alertdialog M2, status/polite M5/M7, aria-describedby, aria-label progressbar | Architecte logiciel | Haute |
| T-ARCH-06 | Spécifier architecture alternative textuelle SVG dashboard | Architecte logiciel + Expert accessibilité | Haute |
| T-ARCH-07 | Compléter design system tokens (couleurs sémantiques, typo, espacement) | Architecte logiciel + Expert UX/UI | Haute |
| T-ARCH-08 | Spécifier interface M6 quiz overlay (type, transitions, ARIA) | Architecte logiciel + Expert UX/UI | Haute |
| T-ARCH-09 | Ajouter bases légales RGPD par store dans §8.1 | Architecte logiciel + DPO | Moyenne |
| T-ARCH-10 | Compléter règle ESLint : outerHTML, insertAdjacentHTML | Architecte logiciel | Moyenne |
| T-ARCH-11 | Ajouter axe-core dans stack et pipeline CI | Architecte logiciel | Moyenne |
| T-ARCH-12 | Prescrire prefers-reduced-motion dans §11 | Architecte logiciel | Moyenne |
| T-ARCH-13 | Ajouter nullification variable mdp M7 post-hashage | Architecte logiciel | Moyenne |
| T-ARCH-14 | Clarifier taille sel D-SEC-001 (16 bytes = 32 hex) | Architecte logiciel | Moyenne |
| T-ARCH-15 | Documenter état initial popup (avant premier lundi) | Architecte logiciel | Faible |
| T-ARCH-16 | Produire AIPD M7 | DPO | Haute (pré-requis clôture P3) |
| T-ARCH-17 | Documenter responsable de traitement dans politique confidentialité | DPO | Moyenne |

---

## Questions ouvertes

| ID | Question | Responsable |
|----|----------|-------------|
| ~~Q-ARCH-01~~ | ~~Le droit à la portabilité (export JSON) doit-il être implémenté en v1 ou reporté en v2 ?~~ **Résolu** : intégré en v1 (décision Commanditaire 2026-04-11). | Commanditaire |

---

## Actions manuelles identifiées

Aucune action manuelle identifiée.

---

## Décision demandée au Commanditaire

Le comité d'architecture émet un **avis favorable avec réserves** (moyenne 3.75/5). Les réserves sont corrigeables par l'architecte logiciel dans une version 1.1 du DAT sans remise en cause de l'architecture.

**Question au Commanditaire :**
- **Q-ARCH-01** : Le droit à la portabilité des données (bouton "Exporter mes données" en JSON) doit-il être intégré en v1 ou reporté en v2 ? Le DPO le recommande (RGPD Art. 20), l'architecte logiciel estime le surcoût faible.

**Décision demandée :** Validé / Validé avec commentaires / Rejeté

---

*PV rédigé par l'Orchestrateur de la Fabrique — 2026-04-11*
