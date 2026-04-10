# OUTILS — Registre des outils par extension de fichier

**Règle** : avant chaque ouverture de fichier, vérifier si l'extension est connue. Si elle n'est pas listée ci-dessous, proposer un outil et enrichir ce fichier immédiatement après validation.

| Extension | Outil de lecture | Outil de création/édition | Notes |
|-----------|-----------------|--------------------------|-------|
| .docx | pandoc, python-docx | docx-js (npm) | Skill redacteur-technique |
| .xlsx | openpyxl, pandas | openpyxl | — |
| .pdf | pdfplumber, PyMuPDF | reportlab, weasyprint | — |
| .md | cat, lecture directe | éditeur texte | Format natif des fichiers de mémoire |
| .json | jq, python json | python json | Manifest V3, configuration |
| .csv | pandas, csvkit | pandas | — |
| .svg | navigateur | Mermaid, draw.io | Diagrammes |
| .mermaid | Mermaid CLI | Mermaid | Diagrammes d'architecture |
| .png / .jpg | visionneuse | — | Images, captures d'écran |
| .env | cat (ATTENTION : ne jamais commiter) | éditeur texte | Secrets |
| .ts / .js | lecture directe | éditeur texte | Code source extension |
| .html | navigateur | éditeur texte | Pages popup/options |
| .css | lecture directe | éditeur texte | Styles extension |

_Ce fichier est enrichi à chaque nouveau type de fichier rencontré._
