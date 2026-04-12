# RISQUES — Registre des risques projet

| ID | Description | Catégorie | Probabilité (1-4) | Impact (1-4) | Score (P*I) | Mesure de mitigation | Responsable | Statut |
|----|-------------|-----------|-------------------|-------------|-------------|---------------------|-------------|--------|
| R-001 | Hash SHA-256 sans sel (M7) vulnérable aux attaques par dictionnaire si IndexedDB compromise | Sécurité | 2 | 4 | 8 | Ajouter un sel local dérivé d'un identifiant d'installation (crypto.getRandomValues). Sel stocké dans chrome.storage.local avec la clé AES. | Architecte sécurité | Résolu |
| R-002 | Valeur collée (M17) transite en mémoire vive — risque de capture par extension malveillante tierce | Sécurité | 2 | 3 | 6 | Nullifier la variable dès la fin du pattern matching (< 10ms). Documenter la limitation dans la politique de confidentialité. | Architecte sécurité | Résolu |
| R-003 | Clé AES-256-GCM en chrome.storage.local — si l'attaquant a accès au profil Chrome, il a la clé | Sécurité | 1 | 4 | 4 | Risque accepté : si le profil Chrome est compromis, toutes les extensions le sont. Documenter cette limite. Chiffrement protège contre l'extraction hors profil. | Architecte sécurité | Accepté |
| R-004 | Content scripts injectés = surface d'attaque DOM (XSS via page malveillante ciblant l'extension) | Sécurité | 2 | 3 | 6 | CSP stricte (script-src 'self'). Sanitization de toute donnée DOM avant affichage dans les overlays. Pas d'innerHTML, utiliser textContent. ESLint no-restricted-properties. | Développeur | Résolu |
| R-005 | Typosquatting faux positifs (M2) sur domaines légitimes avec noms proches de domaines connus | Fonctionnel | 3 | 2 | 6 | Seuil Levenshtein ≥ 2 signaux cumulés. Whitelist utilisateur. Affiner la liste de domaines cibles en P3. | Analyste métier | Ouvert |
| R-006 | Fatigue d'alerte si l'utilisateur met le quota à "Tous" | Fonctionnel | 2 | 2 | 4 | Avertissement explicite dans les paramètres. Proposition de revenir au défaut si taux de fermeture sans action > 80%. | Analyste métier | Accepté |
| R-007 | Non-conformité RGPD sur le traitement de hash de mots de passe (M7) — base légale à documenter | RGPD | 2 | 4 | 8 | Base légale : consentement explicite (opt-in M7 dans l'onboarding). Durée de conservation 90j. Droit à l'effacement en 1 clic. AIPD M7 v1.0 produite et validée. | DPO | Résolu |
| R-008 | Incompatibilité future Firefox MV3 si la couche d'abstraction navigateur n'est pas prévue dès la v1 | Technique | 3 | 3 | 9 | Couche d'abstraction browser-adapter.ts prévue (ADR-008). | Architecte logiciel | Mitigé |
| R-009 | Service Worker tué avant fin écriture IndexedDB (RT-001 du DAT) | Technique | 2 | 3 | 6 | Opérations atomiques + persistance intermédiaire. | Architecte logiciel | Ouvert |
| R-010 | vite-plugin-web-extension abandonné (RT-002 du DAT) | Technique | 1 | 2 | 2 | Pin de version, plan B Webpack. | Architecte logiciel | Ouvert |
| R-011 | API certificat auto-signé M2 inaccessible en MV3 (RT-003 du DAT) | Technique | 3 | 1 | 3 | Dégradation gracieuse (3 signaux restants sur M2). | Architecte logiciel | Ouvert |
| R-012 | zxcvbn > 100ms sur machines basses performances (RT-004 du DAT) | Performance | 1 | 2 | 2 | Debounce 300ms, plan B entropie Shannon. | Développeur | Ouvert |
| R-013 | HSTS preload list obsolète (RT-005 du DAT) | Technique | 2 | 1 | 2 | Mise à jour à chaque release. | Intégrateur DevSecOps | Ouvert |
| R-014 | IndexedDB indisponible (RT-006 du DAT) | Technique | 1 | 3 | 3 | Détection + fallback chrome.storage.local. | Architecte logiciel | Ouvert |
| R-015 | Refus Chrome Web Store (RT-007 du DAT) | Technique | 1 | 3 | 3 | Respect strict politiques CWS, plan B distribution ZIP via GitHub Releases. | Intégrateur DevSecOps | Ouvert |
| R-016 | Régression WCAG (RT-008 du DAT) | Accessibilité | 2 | 2 | 4 | axe-core en CI. | Expert accessibilité | Ouvert |
| R-017 | Corpus quiz insuffisant (RT-009 du DAT) | Fonctionnel | 1 | 1 | 1 | Min 50 questions avant release. | Analyste métier | Ouvert |
| R-018 | Frais CWS 5 USD (RT-010 du DAT) | Organisationnel | N/A | Bloquant | N/A | Soumettre au Commanditaire pour validation. | Orchestrateur | Ouvert |

| R-019 | Divergence chrome.storage.local / IndexedDB sur whitelist M2 si SW tué pendant écriture | Technique | 2 | 2 | 4 | R-SEC-01 : synchronisation bidirectionnelle au démarrage du SW (plan B). En l'état, le content script est la source de vérité pour M2. | Architecte sécurité | Ouvert |
| R-020 | FNV-1a (HTTP) produit un hash différent de SHA-256 (HTTPS) pour un même domaine — whitelist HTTP ne protège pas en HTTPS | Technique | 2 | 1 | 2 | Comportement voulu : un site passant de HTTP à HTTPS change de profil de risque. Documenter dans le DAT. | Architecte sécurité | Accepté |
| R-021 | domain_hash whitelist M2 dans chrome.storage.local sans chiffrement ni purge automatique — données pseudonymisées persistantes | RGPD | 1 | 1 | 1 | chrome.storage.local.clear() couvre le droit à l'effacement. Durée de conservation = jusqu'à suppression manuelle ou désinstallation. Documenter dans AIPD. | DPO | Ouvert |

## Échelle
- **Probabilité** : 1 = Rare, 2 = Possible, 3 = Probable, 4 = Quasi certain
- **Impact** : 1 = Négligeable, 2 = Modéré, 3 = Significatif, 4 = Critique
- **Score >= 9** : risque critique, mitigation obligatoire
- **Score 4-8** : risque élevé, mitigation recommandée
- **Score 1-3** : risque faible, acceptation possible
