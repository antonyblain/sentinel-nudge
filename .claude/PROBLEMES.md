# PROBLÈMES — Problèmes techniques rencontrés par Claude

Chaque problème est traité selon le cycle PDCA : consigné ici (Plan), résolu immédiatement (Do), vérifié (Check), intégré dans les fichiers de mémoire (Act).

| ID | Description | Contexte | Solution / Contournement | Action corrective permanente | Statut |
|----|-------------|----------|--------------------------|------------------------------|--------|
| P-001 | Lecture d'un fichier volumineux (24468 tokens) sans offset/limit, provoquant une erreur de dépassement du seuil de 10000 tokens | Lecture du CdC v1.0 (p1-cahier-des-charges-v1.0.md) pour intégrer les commentaires du Commanditaire | Relecture avec offset/limit par blocs de 200 lignes | Règle : tout fichier > 200 lignes doit être lu par blocs (offset+limit) ou via Grep ciblé. Ne jamais lire un fichier entier sans vérifier sa taille. Intégré dans LESSONS_LEARNED.md. | Résolu |
