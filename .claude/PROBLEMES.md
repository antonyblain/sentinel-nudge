# PROBLÈMES — Problèmes techniques rencontrés par Claude

Chaque problème est traité selon le cycle PDCA : consigné ici (Plan), résolu immédiatement (Do), vérifié (Check), intégré dans les fichiers de mémoire (Act).

| ID | Description | Contexte | Solution / Contournement | Action corrective permanente | Statut |
|----|-------------|----------|--------------------------|------------------------------|--------|
| P-001 | Lecture d'un fichier volumineux (24468 tokens) sans offset/limit, provoquant une erreur de dépassement du seuil de 10000 tokens | Lecture du CdC v1.0 (p1-cahier-des-charges-v1.0.md) pour intégrer les commentaires du Commanditaire | Relecture avec offset/limit par blocs de 200 lignes | Règle : tout fichier > 200 lignes doit être lu par blocs (offset+limit) ou via Grep ciblé. Ne jamais lire un fichier entier sans vérifier sa taille. Intégré dans LESSONS_LEARNED.md. | Résolu |
| P-002 | Tentative de commit Git sans vérifier la configuration user.name/user.email sur le poste | Premier commit sur un nouveau poste Windows après checkout du projet | Demande au Commanditaire de configurer Git manuellement | Règle : avant tout commit, vérifier git config user.name et user.email. Si absent, prescrire la configuration avant de tenter le commit. | Résolu |
| P-003 | git add sur un fichier déjà renommé (ancien nom inexistant), erreur pathspec | Commit du CdC v1.1 — le fichier v1.0 avait été renommé en v1.1 en amont | Utilisation de git rm sur l'ancien nom + git add sur le nouveau | Règle : avant toute commande git add, relire git status pour connaître l'état réel des fichiers. Ne jamais construire une commande à partir d'un état supposé. | Résolu |
