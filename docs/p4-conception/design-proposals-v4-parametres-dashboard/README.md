# Design proposals v4 — Pages Paramètres + Tableau de bord

## Décisions

| Date       | Décision                                                                 | Ref                |
| ---------- | ------------------------------------------------------------------------ | ------------------ |
| 2026-04-20 | **T-194** — 2 propositions UI produites (Aegis Light) : sidebar-nav vs tabs-horizontales | Session Claude Design |
| 2026-04-20 | **T-194** — Choix Commanditaire : **proposition-1-sidebar-nav**          | Arbitrage verbal    |
| 2026-04-20 | **T-195** — Déclinaison de la structure retenue sur Midnight Obsidian + Cyberpunk Neon | Cette PR            |

## Contenu

| Dossier                                         | Thème              | `data-theme` | Statut              |
| ----------------------------------------------- | ------------------ | ------------ | ------------------- |
| `proposition-1-sidebar-nav/`                    | Aegis Light        | `light`      | **Retenue T-194**   |
| `proposition-1-sidebar-nav-midnight-obsidian/`  | Midnight Obsidian  | `dark`       | Déclinaison T-195   |
| `proposition-1-sidebar-nav-cyberpunk-neon/`     | Cyberpunk Neon     | `matrix`     | Déclinaison T-195   |

Chaque dossier contient les 2 pages maquettées :

- `parametres.html` — page Paramètres (options extension)
- `tableau-de-bord.html` — page Tableau de bord (vue d'ensemble cyber-hygiène)

## Structure UI retenue (proposition-1-sidebar-nav)

- **Navigation latérale gauche** (`--sn-sidebar-width: 260px`) : logo + menu vertical entre les sections de la page.
- **Contenu principal** à droite : cartes empilées, marges généreuses, hiérarchie H1/H2/H3 claire.
- **Cibles tactiles ≥ 44px** (`--sn-min-target`).
- **Skip link** pour navigation clavier, `aria-label` sur les landmarks, focus visible.
- **Responsive** : la sidebar se replie sur mobile (≤ 768px).

## Déclinaisons T-195 — choix éditoriaux

Les 3 variantes partagent **strictement** la même structure HTML et les mêmes classes CSS. Seuls changent :

1. **Attribut `data-theme`** sur `<html>` (`light` → `dark` / `matrix`).
2. **Bloc de tokens CSS inline** (section `:root { ... }` du `<style>` d'en-tête).

Les tokens sont alignés sur `src/assets/styles/tokens.css` (source de vérité prod). Les écarts visuels (Midnight Obsidian : accent bleu + shadows amplifiées ; Cyberpunk Neon : néon cyan/magenta, rayons anguleux 2–12px, police monospace systématique) émergent uniquement des valeurs de tokens — aucune surcharge CSS ad-hoc.

## Cohérence avec tokens prod

| Token                     | Aegis Light | Midnight Obsidian | Cyberpunk Neon   |
| ------------------------- | ----------- | ----------------- | ---------------- |
| `--sn-color-bg`           | `#f5f7fa`   | `#0d0d0f`         | `#0a0a14`        |
| `--sn-color-surface`      | `#ffffff`   | `#1a1a1f`         | `#0e0e1c`        |
| `--sn-color-fg`           | `#1a2733`   | `#e8e8f0`         | `#e8e8ff`        |
| `--sn-color-accent`       | `#2e6da4`   | `#2563eb`         | `#ff2d78`        |
| `--sn-color-accent-text`  | `#2e6da4`   | `#60a5fa` (AA 7.7:1) | `#00d4ff` (AA 14.2:1) |
| `--sn-radius-lg`          | `12px`      | `12px`            | `8px` (anguleux) |
| `--sn-font-body`          | Inter       | Inter             | ui-monospace     |

## Vérification visuelle recommandée

Ouvrir les 6 fichiers HTML directement dans un navigateur (aucune dépendance externe, styles inline). Comparer visuellement à la prod (popup + options + dashboard actuels) pour valider l'intention avant d'intégrer en prod.

## Prochaine étape

**T-203** — Variantes thèmes additionnelles (hors périmètre v1, backlog Could). À ouvrir en session Claude Design dédiée si besoin.

## Historique

- **v1** 2026-04-20 : création du dossier v4 après session Claude Design T-194, 2 propositions Aegis Light produites (sidebar-nav + tabs-horizontales).
- **v2** 2026-04-20 : choix Commanditaire = sidebar-nav, déclinaison T-195 sur Midnight Obsidian + Cyberpunk Neon.
