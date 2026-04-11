# RISQUES — Registre des risques projet

| ID | Description | Catégorie | Probabilité (1-4) | Impact (1-4) | Score (P*I) | Mesure de mitigation | Responsable | Statut |
|----|-------------|-----------|-------------------|-------------|-------------|---------------------|-------------|--------|
| R-001 | Hash SHA-256 sans sel (M7) vulnérable aux attaques par dictionnaire si IndexedDB compromise | Sécurité | 2 | 4 | 8 | Ajouter un sel local dérivé d'un identifiant d'installation (crypto.getRandomValues). Sel stocké dans chrome.storage.local avec la clé AES. | Architecte sécurité | Ouvert |
| R-002 | Valeur collée (M17) transite en mémoire vive — risque de capture par extension malveillante tierce | Sécurité | 2 | 3 | 6 | Nullifier la variable dès la fin du pattern matching (< 10ms). Documenter la limitation dans la politique de confidentialité. | Architecte sécurité | Ouvert |
| R-003 | Clé AES-256-GCM en chrome.storage.local — si l'attaquant a accès au profil Chrome, il a la clé | Sécurité | 1 | 4 | 4 | Risque accepté : si le profil Chrome est compromis, toutes les extensions le sont. Documenter cette limite. Chiffrement protège contre l'extraction hors profil. | Architecte sécurité | Accepté |
| R-004 | Content scripts injectés = surface d'attaque DOM (XSS via page malveillante ciblant l'extension) | Sécurité | 2 | 3 | 6 | CSP stricte (script-src 'self'). Sanitization de toute donnée DOM avant affichage dans les overlays. Pas d'innerHTML, utiliser textContent. | Développeur | Ouvert |
| R-005 | Typosquatting faux positifs (M2) sur domaines légitimes avec noms proches de domaines connus | Fonctionnel | 3 | 2 | 6 | Seuil Levenshtein ≥ 2 signaux cumulés. Whitelist utilisateur. Affiner la liste de domaines cibles en P3. | Analyste métier | Ouvert |
| R-006 | Fatigue d'alerte si l'utilisateur met le quota à "Tous" | Fonctionnel | 2 | 2 | 4 | Avertissement explicite dans les paramètres. Proposition de revenir au défaut si taux de fermeture sans action > 80%. | Analyste métier | Accepté |
| R-007 | Non-conformité RGPD sur le traitement de hash de mots de passe (M7) — base légale à documenter | RGPD | 2 | 4 | 8 | Base légale : consentement explicite (opt-in M7 dans l'onboarding). Durée de conservation 90j. Droit à l'effacement en 1 clic. AIPD à produire en P3. | DPO | Ouvert |
| R-008 | Incompatibilité future Firefox MV3 si la couche d'abstraction navigateur n'est pas prévue dès la v1 | Technique | 3 | 3 | 9 | Prévoir dès P3 une couche d'abstraction (browser API wrapper) pour isoler les appels chrome.* spécifiques. | Architecte logiciel | Ouvert |

## Échelle
- **Probabilité** : 1 = Rare, 2 = Possible, 3 = Probable, 4 = Quasi certain
- **Impact** : 1 = Négligeable, 2 = Modéré, 3 = Significatif, 4 = Critique
- **Score >= 9** : risque critique, mitigation obligatoire
- **Score 4-8** : risque élevé, mitigation recommandée
- **Score 1-3** : risque faible, acceptation possible
