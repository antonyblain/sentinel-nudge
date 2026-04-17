# INSTRUCTIONS — Préférences et contraintes du Commanditaire

Ces instructions sont lues par l'orchestrateur au démarrage de chaque session et transmises à tous les agents. Elles priment sur les comportements par défaut.

| N° | Instruction | Impact |
|----|-------------|--------|
| I-001 | Privilégier systématiquement les API et services gratuits. Ne proposer une solution payante que si aucune alternative gratuite n'existe, et toujours présenter le coût au Commanditaire avant adoption. | Architecte logiciel, Développeur, DevSecOps |
| I-002 | L'environnement de développement du Commanditaire est Windows 11. Toutes les commandes, scripts, chemins de fichiers et instructions doivent être compatibles Windows 11 natif (PowerShell, cmd). Ne jamais supposer un environnement Linux/macOS sauf si WSL est explicitement demandé. | Tous les agents |
| I-003 | Claude Code est utilisé via Claude Desktop sur Windows 11. | Orchestrateur |
| I-004 | Tous les projets sont synchronisés avec GitHub. Le Commanditaire possède un compte GitHub personnel. | Assistant Git |
| I-005 | Ne jamais commiter de secrets (clés API, tokens, mots de passe). Utiliser systématiquement des fichiers .env exclus du versionnement via .gitignore. | Assistant Git, Développeur |
| I-006 | Dashboard de démarrage enrichi : en plus du tableau de bord court (phase active, dernière action, prochaine action), afficher en début de chaque session les 2-3 dernières décisions marquantes, les questions ouvertes de QUESTIONS.md et les problèmes actifs de PROBLEMES.md. Lire aussi QUESTIONS.md + PROBLEMES.md au démarrage. | Orchestrateur |
| I-007 | Git flow Exposé strict : chaque tâche P5+ démarre sur une branche courte dédiée `feature/<phase>-<tache-id>-<slug>` créée depuis `develop` à jour. Fin de tâche → push + PR vers `develop` avant toute autre tâche. Pas de commit direct sur `develop` ni `main`. L'Assistant Git prescrit proactivement la création de branche. | Assistant Git, tous les agents |
| I-008 | Marquer les chapitres de session (`mark_chapter`) à chaque transition d'étape majeure : nouvelle tâche, nouvelle phase, clôture d'un post-mortem, validation d'un livrable structurant. Pas à chaque commit. | Orchestrateur |

_Ce fichier est enrichi au fil des projets. Chaque nouvelle préférence découverte est proposée au Commanditaire pour ajout._
