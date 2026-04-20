/**
 * @file pages/health/health.ts
 * @description Page "État de santé" Sentinel Nudge — T-109.
 *
 * Agrège et affiche les diagnostics de tous les modules SW (M2, M3, M5, M6,
 * M7, M9, M17) ainsi que l'état heartbeat (diagnostics.m7) et les états
 * canary (canary_ok / canary_reinit / canary_failed) en une page de type
 * "status page" accessible depuis les options de l'extension.
 *
 * Architecture :
 * - Lit chrome.storage.local pour les clés diagnostics.<module>
 * - Tombe en lecture directe (pas de message SW) : données disponibles en
 *   storage, pas de besoin de traitement côté service worker pour le rendu.
 * - Construit le DOM via createElement uniquement (D-SEC-003 : zéro innerHTML).
 * - Sections : 7 modules + heartbeat + canary
 * - Bouton expand/collapse par section pour le JSON brut diagnostics.
 *
 * Accessibilité (WCAG 2.1 AA) :
 * - Landmarks : <main> avec aria-label, sections avec <h2>
 * - Skip link (WCAG 2.4.1)
 * - Contraste assuré via tokens.css
 * - aria-expanded sur boutons détails (WCAG 4.1.2)
 * - aria-live="polite" sur la zone de chargement
 * - Cibles min 44×44px (WCAG 2.5.5)
 *
 * Sécurité :
 * - D-SEC-003 : Aucun innerHTML. Tout DOM via createElement/textContent/appendChild.
 *
 * Référence : T-109, ARB-061-01, ADR-001 R-BOOT-04
 */

import { browser } from '@/shared/browser/browser-adapter';
import { initTheme, watchThemeChanges } from '@/shared/utils/apply-theme';
import { createLogger, Logger } from '@/shared/utils/logger';
import type {
  M2Diagnostics,
  M3Diagnostics,
  M5Diagnostics,
  M6Diagnostics,
  M7Diagnostics,
  M9Diagnostics,
  M17Diagnostics,
} from '@/shared/types/diagnostics';
import {
  DIAGNOSTICS_M2_KEY,
  DIAGNOSTICS_M3_KEY,
  DIAGNOSTICS_M5_KEY,
  DIAGNOSTICS_M6_KEY,
  DIAGNOSTICS_M7_KEY,
  DIAGNOSTICS_M9_KEY,
  DIAGNOSTICS_M17_KEY,
  M2_DIAGNOSTICS_DEFAULT,
  M3_DIAGNOSTICS_DEFAULT,
  M5_DIAGNOSTICS_DEFAULT,
  M6_DIAGNOSTICS_DEFAULT,
  M7_DIAGNOSTICS_DEFAULT,
  M9_DIAGNOSTICS_DEFAULT,
  M17_DIAGNOSTICS_DEFAULT,
} from '@/shared/types/diagnostics';

/** Logger scopé — Health page (INV-SEC-02 étendu) */
const logger = createLogger('Health');

/** Seuil de stale heartbeat : > 1h sans boot → dégradé (ARB-061-01) */
const HEARTBEAT_STALE_MS = 60 * 60 * 1000;

/** Seuil d'erreur récente pour coloration jaune/rouge : < 30 min */
const RECENT_ERROR_MS = 30 * 60 * 1000;

/**
 * Statut calculé pour l'affichage visuel d'un module.
 * - 'ok'      : ready=true, aucune erreur récente
 * - 'warn'    : ready=true mais erreur récente, ou ready=false non critique
 * - 'error'   : ready=false avec erreur récente ou heartbeat stale
 * - 'unknown' : jamais initialisé (last_boot_ts === 0)
 */
type HealthStatus = 'ok' | 'warn' | 'error' | 'unknown';

/**
 * Métadonnées statiques d'un module pour l'affichage.
 */
interface ModuleMeta {
  /** Identifiant du module */
  id: string;
  /** Icône Unicode représentant le module */
  icon: string;
  /** Nom affiché en français */
  name: string;
  /** Description courte */
  description: string;
}

/** Métadonnées des 7 modules */
const MODULE_METAS: ModuleMeta[] = [
  {
    id: 'M2',
    icon: '\u{1F310}', // Globe
    name: 'M2 — Sites suspects',
    description: 'Détection de domaines suspects (typosquatting, HTTP, HSTS)',
  },
  {
    id: 'M3',
    icon: '\u{1F4CA}', // Graphique
    name: 'M3 — Score cyber-hygiène',
    description: 'Calcul et persistance du score hebdomadaire',
  },
  {
    id: 'M5',
    icon: '\u{1F504}', // Mises à jour
    name: 'M5 — Mises à jour navigateur',
    description: 'Vérification des mises à jour du navigateur',
  },
  {
    id: 'M6',
    icon: '\u{1F9E0}', // Cerveau
    name: 'M6 — Quiz phishing',
    description: 'Quiz de sensibilisation phishing (spaced repetition)',
  },
  {
    id: 'M7',
    icon: '\u{1F512}', // Cadenas
    name: 'M7 — Réutilisation mots de passe',
    description: 'Détection de réutilisation de mots de passe (hashes)',
  },
  {
    id: 'M9',
    icon: '\u{1F4AA}', // Force
    name: 'M9 — Force mots de passe',
    description: 'Évaluation de la force des mots de passe (zxcvbn)',
  },
  {
    id: 'M17',
    icon: '\u{1F4CB}', // Presse-papiers
    name: 'M17 — Données sensibles presse-papiers',
    description: 'Détection de données sensibles copiées (CB, IBAN, NIR)',
  },
];

/**
 * Données consolidées de tous les diagnostics.
 */
interface AllDiagnostics {
  m2: M2Diagnostics;
  m3: M3Diagnostics;
  m5: M5Diagnostics;
  m6: M6Diagnostics;
  m7: M7Diagnostics;
  m9: M9Diagnostics;
  m17: M17Diagnostics;
}

/**
 * Formatte un timestamp (ms since epoch) en date/heure lisible locale.
 * Retourne '—' si le timestamp est 0 ou null/undefined.
 *
 * @param ts - Timestamp en millisecondes, ou null/undefined
 * @returns Chaîne formatée ou '—'
 */
export function formatTimestamp(ts: number | null | undefined): string {
  if (!ts || ts === 0) return '\u2014'; // —
  return new Date(ts).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Calcule l'âge d'un timestamp en millisecondes depuis maintenant.
 *
 * @param ts - Timestamp en millisecondes
 * @returns Âge en ms, ou Infinity si ts === 0
 */
export function ageMs(ts: number): number {
  if (ts === 0) return Infinity;
  return Date.now() - ts;
}

/**
 * Détermine le statut de santé pour M2.
 *
 * @param diag - Diagnostics M2
 * @returns Statut calculé
 */
export function computeM2Status(diag: M2Diagnostics): HealthStatus {
  if (diag.last_boot_ts === 0) return 'unknown';
  if (!diag.ready) {
    const errorAge = diag.last_incident ? ageMs(diag.last_incident.ts) : Infinity;
    return errorAge < RECENT_ERROR_MS ? 'error' : 'warn';
  }
  if (diag.last_incident && ageMs(diag.last_incident.ts) < RECENT_ERROR_MS) return 'warn';
  return 'ok';
}

/**
 * Détermine le statut de santé pour M3.
 *
 * @param diag - Diagnostics M3
 * @returns Statut calculé
 */
export function computeM3Status(diag: M3Diagnostics): HealthStatus {
  const bootTs = diag.last_boot;
  if (bootTs === 0) return 'unknown';
  if (!diag.ready) {
    const errorAge = diag.last_incident ? ageMs(diag.last_incident.ts) : Infinity;
    return errorAge < RECENT_ERROR_MS ? 'error' : 'warn';
  }
  if (diag.last_incident && ageMs(diag.last_incident.ts) < RECENT_ERROR_MS) return 'warn';
  return 'ok';
}

/**
 * Détermine le statut de santé pour M5.
 *
 * @param diag - Diagnostics M5
 * @returns Statut calculé
 */
export function computeM5Status(diag: M5Diagnostics): HealthStatus {
  if (diag.last_boot_ts === 0) return 'unknown';
  if (!diag.ready) {
    const errorAge = diag.last_incident ? ageMs(diag.last_incident.ts) : Infinity;
    return errorAge < RECENT_ERROR_MS ? 'error' : 'warn';
  }
  if (diag.last_incident && ageMs(diag.last_incident.ts) < RECENT_ERROR_MS) return 'warn';
  return 'ok';
}

/**
 * Détermine le statut de santé pour M6.
 *
 * @param diag - Diagnostics M6
 * @returns Statut calculé
 */
export function computeM6Status(diag: M6Diagnostics): HealthStatus {
  if (diag.last_boot_ts === 0) return 'unknown';
  if (!diag.ready) {
    const errorAge = diag.last_incident ? ageMs(diag.last_incident.ts) : Infinity;
    return errorAge < RECENT_ERROR_MS ? 'error' : 'warn';
  }
  if (diag.last_incident && ageMs(diag.last_incident.ts) < RECENT_ERROR_MS) return 'warn';
  return 'ok';
}

/**
 * Détermine le statut de santé pour M7 (heartbeat).
 * Tient compte du seuil HEARTBEAT_STALE_MS (ARB-061-01).
 *
 * @param diag - Diagnostics M7
 * @returns Statut calculé
 */
export function computeM7Status(diag: M7Diagnostics): HealthStatus {
  if (diag.last_boot_ts === 0) return 'unknown';
  const stale = ageMs(diag.last_boot_ts) > HEARTBEAT_STALE_MS;
  if (!diag.ready) return stale ? 'error' : 'warn';
  if (stale) return 'warn'; // ready mais heartbeat stale > 1h
  return 'ok';
}

/**
 * Détermine le statut de santé pour M9.
 *
 * @param diag - Diagnostics M9
 * @returns Statut calculé
 */
export function computeM9Status(diag: M9Diagnostics): HealthStatus {
  if (diag.last_action_ts === 0) return 'unknown';
  if (!diag.ready) {
    const errorAge = diag.last_incident ? ageMs(diag.last_incident.ts) : Infinity;
    return errorAge < RECENT_ERROR_MS ? 'error' : 'warn';
  }
  if (diag.last_incident && ageMs(diag.last_incident.ts) < RECENT_ERROR_MS) return 'warn';
  return 'ok';
}

/**
 * Détermine le statut de santé pour M17.
 *
 * @param diag - Diagnostics M17
 * @returns Statut calculé
 */
export function computeM17Status(diag: M17Diagnostics): HealthStatus {
  if (diag.last_action_ts === 0) return 'unknown';
  if (!diag.ready) {
    const errorAge = diag.last_incident ? ageMs(diag.last_incident.ts) : Infinity;
    return errorAge < RECENT_ERROR_MS ? 'error' : 'warn';
  }
  if (diag.last_incident && ageMs(diag.last_incident.ts) < RECENT_ERROR_MS) return 'warn';
  return 'ok';
}

/**
 * Retourne le libellé textuel d'un statut.
 *
 * @param status - Statut de santé
 * @returns Libellé affiché dans le badge
 */
export function statusLabel(status: HealthStatus): string {
  switch (status) {
    case 'ok':
      return 'Opérationnel';
    case 'warn':
      return 'Dégradé';
    case 'error':
      return 'Erreur';
    case 'unknown':
      return 'Non initialisé';
  }
}

/**
 * Crée un badge de statut DOM (span avec point + libellé).
 *
 * @param status - Statut de santé
 * @returns Élément span du badge
 */
function createStatusBadge(status: HealthStatus): HTMLSpanElement {
  const badge = document.createElement('span');
  badge.className = 'status-badge';
  badge.setAttribute('data-status', status);

  const dot = document.createElement('span');
  dot.className = 'status-dot';
  dot.setAttribute('data-status', status);
  dot.setAttribute('aria-hidden', 'true');
  badge.appendChild(dot);

  const text = document.createElement('span');
  text.textContent = statusLabel(status);
  badge.appendChild(text);

  return badge;
}

/**
 * Crée un élément de métadonnée (label + valeur).
 *
 * @param label - Libellé de la métadonnée
 * @param value - Valeur affichée
 * @param valueStatus - Statut optionnel pour coloration de la valeur
 * @returns Élément div meta-item
 */
function createMetaItem(label: string, value: string, valueStatus?: HealthStatus): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'meta-item';

  const labelEl = document.createElement('span');
  labelEl.className = 'meta-label';
  labelEl.textContent = label;
  item.appendChild(labelEl);

  const valueEl = document.createElement('span');
  valueEl.className = 'meta-value';
  if (valueStatus) valueEl.setAttribute('data-status', valueStatus);
  valueEl.textContent = value;
  item.appendChild(valueEl);

  return item;
}

/**
 * Crée le bouton "Voir détails" + bloc JSON expand/collapse.
 *
 * @param diagnostics - Objet diagnostics à sérialiser (JSON pretty-print)
 * @returns Tuple [bouton, bloc details]
 */
export function createDetailsToggle(diagnostics: unknown): [HTMLButtonElement, HTMLDivElement] {
  const blockId = `details-block-${Math.random().toString(36).slice(2, 9)}`;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-details';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', blockId);

  const chevron = document.createElement('i');
  chevron.className = 'btn-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.setAttribute('data-expanded', 'false');
  chevron.textContent = '\u25B6'; // Triangle pointant à droite
  btn.appendChild(chevron);

  const btnText = document.createElement('span');
  btnText.textContent = 'Voir les diagnostics bruts';
  btn.appendChild(btnText);

  const block = document.createElement('div');
  block.className = 'details-block';
  block.id = blockId;
  block.hidden = true;

  const pre = document.createElement('pre');
  pre.className = 'details-pre';
  // textContent garantit l'absence d'injection HTML (D-SEC-003)
  pre.textContent = JSON.stringify(diagnostics, null, 2);
  block.appendChild(pre);

  btn.addEventListener('click', () => {
    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    const nextExpanded = !isExpanded;
    btn.setAttribute('aria-expanded', String(nextExpanded));
    chevron.setAttribute('data-expanded', String(nextExpanded));
    block.hidden = !nextExpanded;
    btnText.textContent = nextExpanded
      ? 'Masquer les diagnostics bruts'
      : 'Voir les diagnostics bruts';
  });

  return [btn, block];
}

/**
 * Construit la section DOM d'un module.
 *
 * @param meta     - Métadonnées statiques du module
 * @param status   - Statut de santé calculé
 * @param metas    - Tableau de métadonnées [label, valeur] à afficher
 * @param diag     - Objet diagnostics brut pour le bloc expand/collapse
 * @param alerts   - Messages d'alerte optionnels (ex: heartbeat stale)
 * @returns Élément section DOM
 */
function buildModuleSection(
  meta: ModuleMeta,
  status: HealthStatus,
  metas: Array<[string, string, HealthStatus?]>,
  diag: unknown,
  alerts: string[] = [],
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'health-section';
  section.setAttribute('data-status', status);
  section.setAttribute('aria-label', meta.name);

  // En-tête : icône + titre + badge
  const header = document.createElement('div');
  header.className = 'section-header';

  const iconEl = document.createElement('span');
  iconEl.className = 'module-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = meta.icon;
  header.appendChild(iconEl);

  const titleEl = document.createElement('h2');
  titleEl.className = 'section-title';
  titleEl.textContent = meta.name;
  header.appendChild(titleEl);

  header.appendChild(createStatusBadge(status));
  section.appendChild(header);

  // Description module
  const descEl = document.createElement('p');
  descEl.className = 'sr-only';
  descEl.textContent = meta.description;
  section.appendChild(descEl);

  // Alertes (ex: heartbeat stale)
  for (const alertMsg of alerts) {
    const alertEl = document.createElement('div');
    alertEl.className = 'heartbeat-alert';
    alertEl.setAttribute('role', 'alert');
    alertEl.textContent = alertMsg;
    section.appendChild(alertEl);
  }

  // Métadonnées
  if (metas.length > 0) {
    const metaContainer = document.createElement('div');
    metaContainer.className = 'section-meta';
    for (const [label, value, valueStatus] of metas) {
      metaContainer.appendChild(createMetaItem(label, value, valueStatus));
    }
    section.appendChild(metaContainer);
  }

  // Bouton détails expand/collapse
  const [btn, block] = createDetailsToggle(diag);
  section.appendChild(btn);
  section.appendChild(block);

  return section;
}

/**
 * Charge tous les diagnostics depuis chrome.storage.local.
 *
 * @returns Promise résolvant les diagnostics de tous les modules
 */
async function loadAllDiagnostics(): Promise<AllDiagnostics> {
  const keys = [
    DIAGNOSTICS_M2_KEY,
    DIAGNOSTICS_M3_KEY,
    DIAGNOSTICS_M5_KEY,
    DIAGNOSTICS_M6_KEY,
    DIAGNOSTICS_M7_KEY,
    DIAGNOSTICS_M9_KEY,
    DIAGNOSTICS_M17_KEY,
  ];

  const data = await browser.storage.local.get(keys);

  return {
    m2: (data[DIAGNOSTICS_M2_KEY] as M2Diagnostics) ?? M2_DIAGNOSTICS_DEFAULT,
    m3: (data[DIAGNOSTICS_M3_KEY] as M3Diagnostics) ?? M3_DIAGNOSTICS_DEFAULT,
    m5: (data[DIAGNOSTICS_M5_KEY] as M5Diagnostics) ?? M5_DIAGNOSTICS_DEFAULT,
    m6: (data[DIAGNOSTICS_M6_KEY] as M6Diagnostics) ?? M6_DIAGNOSTICS_DEFAULT,
    m7: (data[DIAGNOSTICS_M7_KEY] as M7Diagnostics) ?? M7_DIAGNOSTICS_DEFAULT,
    m9: (data[DIAGNOSTICS_M9_KEY] as M9Diagnostics) ?? M9_DIAGNOSTICS_DEFAULT,
    m17: (data[DIAGNOSTICS_M17_KEY] as M17Diagnostics) ?? M17_DIAGNOSTICS_DEFAULT,
  };
}

/**
 * Construit et retourne la section M2.
 *
 * @param diag - Diagnostics M2
 * @returns Élément section DOM
 */
function buildM2Section(diag: M2Diagnostics): HTMLElement {
  const status = computeM2Status(diag);
  const lastBoot = formatTimestamp(diag.last_boot_ts);
  const lastError = diag.last_incident ? formatTimestamp(diag.last_incident.ts) : '\u2014';

  const metas: Array<[string, string, HealthStatus?]> = [
    ['Dernier boot', lastBoot],
    ['Taille whitelist', String(diag.whitelist_size)],
    ['Dernière erreur', lastError, diag.last_incident ? 'warn' : undefined],
  ];

  return buildModuleSection(MODULE_METAS[0]!, status, metas, diag);
}

/**
 * Construit et retourne la section M3.
 *
 * @param diag - Diagnostics M3
 * @returns Élément section DOM
 */
function buildM3Section(diag: M3Diagnostics): HTMLElement {
  const status = computeM3Status(diag);
  const lastBoot = formatTimestamp(diag.last_boot);
  const lastError = diag.last_incident ? formatTimestamp(diag.last_incident.ts) : '\u2014';

  const metas: Array<[string, string, HealthStatus?]> = [
    ['Dernier exécution alarme', lastBoot],
    ['Dernière erreur', lastError, diag.last_incident ? 'warn' : undefined],
  ];

  return buildModuleSection(MODULE_METAS[1]!, status, metas, diag);
}

/**
 * Construit et retourne la section M5.
 *
 * @param diag - Diagnostics M5
 * @returns Élément section DOM
 */
function buildM5Section(diag: M5Diagnostics): HTMLElement {
  const status = computeM5Status(diag);
  const lastBoot = formatTimestamp(diag.last_boot_ts);
  const lastError = diag.last_incident ? formatTimestamp(diag.last_incident.ts) : '\u2014';

  const metas: Array<[string, string, HealthStatus?]> = [
    ['Dernier boot', lastBoot],
    ['Compteur de snoozes', String(diag.snooze_count)],
    ['Dernière erreur', lastError, diag.last_incident ? 'warn' : undefined],
  ];

  return buildModuleSection(MODULE_METAS[2]!, status, metas, diag);
}

/**
 * Construit et retourne la section M6.
 *
 * @param diag - Diagnostics M6
 * @returns Élément section DOM
 */
function buildM6Section(diag: M6Diagnostics): HTMLElement {
  const status = computeM6Status(diag);
  const lastBoot = formatTimestamp(diag.last_boot_ts);
  const installDate = formatTimestamp(diag.install_date);
  const lastError = diag.last_incident ? formatTimestamp(diag.last_incident.ts) : '\u2014';

  const metas: Array<[string, string, HealthStatus?]> = [
    ['Dernier boot', lastBoot],
    ["Date d'installation quiz", installDate],
    ['Dernière erreur', lastError, diag.last_incident ? 'warn' : undefined],
  ];

  return buildModuleSection(MODULE_METAS[3]!, status, metas, diag);
}

/**
 * Construit et retourne la section M7 (module + heartbeat).
 *
 * @param diag - Diagnostics M7
 * @returns Élément section DOM
 */
function buildM7Section(diag: M7Diagnostics): HTMLElement {
  const status = computeM7Status(diag);
  const lastBoot = formatTimestamp(diag.last_boot_ts);
  const lastDetection = formatTimestamp(diag.last_detection_ts);
  const stale = ageMs(diag.last_boot_ts) > HEARTBEAT_STALE_MS;

  const alerts: string[] = [];
  if (stale && diag.last_boot_ts !== 0) {
    alerts.push(
      'Heartbeat dégradé : aucun boot SW détecté depuis plus d\u2019une heure (ARB-061-01).',
    );
  }

  const metas: Array<[string, string, HealthStatus?]> = [
    ['Dernier boot', lastBoot, stale ? 'warn' : undefined],
    ['Nombre de boots', String(diag.boot_count)],
    ['Canary vérifié', diag.canary_verified ? 'Oui' : 'Non'],
    ['Dernière détection', lastDetection],
  ];

  return buildModuleSection(MODULE_METAS[4]!, status, metas, diag, alerts);
}

/**
 * Construit et retourne la section M9.
 *
 * @param diag - Diagnostics M9
 * @returns Élément section DOM
 */
function buildM9Section(diag: M9Diagnostics): HTMLElement {
  const status = computeM9Status(diag);
  const lastAction = formatTimestamp(diag.last_action_ts);
  const lastError = diag.last_incident ? formatTimestamp(diag.last_incident.ts) : '\u2014';

  const metas: Array<[string, string, HealthStatus?]> = [
    ['Dernière action handler', lastAction],
    ['Dernière erreur', lastError, diag.last_incident ? 'warn' : undefined],
  ];

  return buildModuleSection(MODULE_METAS[5]!, status, metas, diag);
}

/**
 * Construit et retourne la section M17.
 *
 * @param diag - Diagnostics M17
 * @returns Élément section DOM
 */
function buildM17Section(diag: M17Diagnostics): HTMLElement {
  const status = computeM17Status(diag);
  const lastAction = formatTimestamp(diag.last_action_ts);
  const lastError = diag.last_incident ? formatTimestamp(diag.last_incident.ts) : '\u2014';

  const metas: Array<[string, string, HealthStatus?]> = [
    ['Dernière action handler', lastAction],
    ['Dernière erreur', lastError, diag.last_incident ? 'warn' : undefined],
  ];

  return buildModuleSection(MODULE_METAS[6]!, status, metas, diag);
}

/**
 * Construit la section Heartbeat (synthèse M7 heartbeat service).
 *
 * @param diag - Diagnostics M7
 * @returns Élément section DOM
 */
function buildHeartbeatSection(diag: M7Diagnostics): HTMLElement {
  const stale = ageMs(diag.last_boot_ts) > HEARTBEAT_STALE_MS && diag.last_boot_ts !== 0;
  const status: HealthStatus = diag.last_boot_ts === 0 ? 'unknown' : stale ? 'warn' : 'ok';

  const section = document.createElement('section');
  section.className = 'health-section';
  section.setAttribute('data-status', status);
  section.setAttribute('aria-label', 'Service Heartbeat M7');

  const header = document.createElement('div');
  header.className = 'section-header';

  const iconEl = document.createElement('span');
  iconEl.className = 'module-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = '\u2764\uFE0F'; // Cœur
  header.appendChild(iconEl);

  const titleEl = document.createElement('h2');
  titleEl.className = 'section-title';
  titleEl.textContent = 'Heartbeat Service';
  header.appendChild(titleEl);

  header.appendChild(createStatusBadge(status));
  section.appendChild(header);

  if (stale) {
    const alertEl = document.createElement('div');
    alertEl.className = 'heartbeat-alert';
    alertEl.setAttribute('role', 'alert');
    alertEl.textContent =
      'Heartbeat dégradé : le service worker ne s\u2019est pas déclenché depuis plus d\u2019une heure.';
    section.appendChild(alertEl);
  }

  const metaContainer = document.createElement('div');
  metaContainer.className = 'section-meta';
  metaContainer.appendChild(
    createMetaItem(
      'Dernier heartbeat',
      formatTimestamp(diag.last_boot_ts),
      stale ? 'warn' : undefined,
    ),
  );
  metaContainer.appendChild(createMetaItem('Boots totaux SW', String(diag.boot_count)));
  section.appendChild(metaContainer);

  const [btn, block] = createDetailsToggle({ heartbeat: diag });
  section.appendChild(btn);
  section.appendChild(block);

  return section;
}

/**
 * Construit la section Canary (état du canary hash de vérification M7).
 *
 * @param diag - Diagnostics M7 (canary_verified + boot_count)
 * @returns Élément section DOM
 */
function buildCanarySection(diag: M7Diagnostics): HTMLElement {
  // Le statut canary est inféré de canary_verified + ready
  let canaryState: 'canary_ok' | 'canary_reinit' | 'canary_failed';
  if (diag.canary_verified && diag.ready) {
    canaryState = 'canary_ok';
  } else if (!diag.canary_verified && diag.ready) {
    // ready=true avec canary_verified=false est une situation anormale (viole INV-01)
    // On l'assimile à canary_failed pour l'affichage
    canaryState = 'canary_failed';
  } else if (!diag.canary_verified && !diag.ready && diag.last_boot_ts !== 0) {
    // ready=false + canary_verified=false → canary_reinit (réinitialisation en cours ou échouée)
    canaryState = 'canary_reinit';
  } else {
    canaryState = 'canary_failed';
  }

  const statusMap: Record<typeof canaryState, HealthStatus> = {
    canary_ok: 'ok',
    canary_reinit: 'warn',
    canary_failed: 'error',
  };

  const labelMap: Record<typeof canaryState, string> = {
    canary_ok: 'Canary OK',
    canary_reinit: 'Canary réinitialisé',
    canary_failed: 'Canary échoué',
  };

  const descMap: Record<typeof canaryState, string> = {
    canary_ok: 'Le hash canary a été vérifié avec succès lors du dernier boot SW.',
    canary_reinit:
      'Le canary a été réinitialisé (CM-EOP1 : canary corrompu, clé AES fonctionnelle). Surveillance recommandée.',
    canary_failed:
      'Le canary n\u2019a pas pu être vérifié. La clé AES a peut-être été régénérée. Vérifiez le registre d\u2019incidents.',
  };

  const status = diag.last_boot_ts === 0 ? 'unknown' : statusMap[canaryState];

  const section = document.createElement('section');
  section.className = 'health-section';
  section.setAttribute('data-status', status);
  section.setAttribute('aria-label', 'Service Canary M7');

  const header = document.createElement('div');
  header.className = 'section-header';

  const iconEl = document.createElement('span');
  iconEl.className = 'module-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = '\u{1F426}'; // Oiseau (canary)
  header.appendChild(iconEl);

  const titleEl = document.createElement('h2');
  titleEl.className = 'section-title';
  titleEl.textContent = 'Canary Service';
  header.appendChild(titleEl);

  header.appendChild(createStatusBadge(status));
  section.appendChild(header);

  const stateEl = document.createElement('p');
  stateEl.className = 'section-meta';
  stateEl.textContent =
    diag.last_boot_ts === 0
      ? 'Canary non initialisé (aucun boot SW enregistré).'
      : `${labelMap[canaryState]} — ${descMap[canaryState]}`;
  section.appendChild(stateEl);

  const [btn, block] = createDetailsToggle({
    canary_verified: diag.canary_verified,
    ready: diag.ready,
    last_boot_ts: diag.last_boot_ts,
    derived_state: canaryState,
  });
  section.appendChild(btn);
  section.appendChild(block);

  return section;
}

/**
 * Point d'entrée principal : charge les diagnostics et rend la page.
 *
 * @returns Promise<void>
 */
export async function initHealth(): Promise<void> {
  const root = document.getElementById('health-main');
  if (!root) return;

  // Titre page
  const h1 = document.createElement('h1');
  h1.className = 'page-title';
  h1.textContent = 'État de santé — Sentinel Nudge';
  root.appendChild(h1);

  const subtitle = document.createElement('p');
  subtitle.className = 'page-subtitle';
  subtitle.textContent =
    'Diagnostics en temps réel des modules de détection. Données lues depuis chrome.storage.local — aucune télémétrie.';
  root.appendChild(subtitle);

  // Zone de chargement annoncée aux lecteurs d'écran
  const loadingEl = document.createElement('p');
  loadingEl.className = 'loading-text';
  loadingEl.setAttribute('aria-live', 'polite');
  loadingEl.textContent = 'Chargement des diagnostics…';
  root.appendChild(loadingEl);

  try {
    const diags = await loadAllDiagnostics();

    root.removeChild(loadingEl);

    // Horodatage du chargement
    const tsEl = document.createElement('p');
    tsEl.className = 'refresh-timestamp';
    tsEl.textContent = `Données chargées le ${formatTimestamp(Date.now())}`;
    root.appendChild(tsEl);

    // Conteneur principal
    const main = document.createElement('div');
    main.className = 'health-main';

    // Séparateur et groupe Modules
    const modGroupTitle = document.createElement('p');
    modGroupTitle.className = 'section-group-title';
    modGroupTitle.setAttribute('aria-hidden', 'true');
    modGroupTitle.textContent = 'Modules de détection';
    main.appendChild(modGroupTitle);

    // 7 sections modules
    main.appendChild(buildM2Section(diags.m2));
    main.appendChild(buildM3Section(diags.m3));
    main.appendChild(buildM5Section(diags.m5));
    main.appendChild(buildM6Section(diags.m6));
    main.appendChild(buildM7Section(diags.m7));
    main.appendChild(buildM9Section(diags.m9));
    main.appendChild(buildM17Section(diags.m17));

    // Séparateur
    const sep = document.createElement('hr');
    sep.className = 'section-separator';
    sep.setAttribute('aria-hidden', 'true');
    main.appendChild(sep);

    // Groupe Services internes
    const svcGroupTitle = document.createElement('p');
    svcGroupTitle.className = 'section-group-title';
    svcGroupTitle.setAttribute('aria-hidden', 'true');
    svcGroupTitle.textContent = 'Services internes';
    main.appendChild(svcGroupTitle);

    // Heartbeat
    main.appendChild(buildHeartbeatSection(diags.m7));

    // Canary
    main.appendChild(buildCanarySection(diags.m7));

    root.appendChild(main);
  } catch (err: unknown) {
    root.removeChild(loadingEl);

    const errorEl = document.createElement('p');
    errorEl.className = 'error-text';
    errorEl.setAttribute('role', 'alert');
    errorEl.textContent = 'Impossible de charger les diagnostics de santé.';
    root.appendChild(errorEl);

    logger.error('Health: échec initialisation', {
      error_name: Logger.errorName(err),
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Appliquer le thème AVANT le rendu pour éviter le FOUC (TACHE-148)
  void initTheme();
  watchThemeChanges();
  initHealth().catch((err: unknown) => {
    logger.error('Health: erreur inattendue DOMContentLoaded', {
      error_name: Logger.errorName(err),
    });
  });
});
