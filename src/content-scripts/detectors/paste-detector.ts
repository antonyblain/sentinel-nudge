/**
 * @file content-scripts/detectors/paste-detector.ts
 * @description Détecteur de données sensibles dans le presse-papiers (module M17).
 *
 * Ce content script écoute l'événement `paste` sur le document.
 * Si le contenu collé correspond à un pattern sensible (carte bancaire, IBAN, clé API),
 * une variable locale est nullifiée immédiatement (D-SEC-002 < 10ms)
 * et le type détecté (jamais la valeur) est transmis au service worker.
 *
 * Algorithme par type (SFD §2.7.2) :
 * 1. Carte bancaire : regex 13-19 chiffres + validation Luhn
 * 2. IBAN : regex [A-Z]{2}[0-9]{2}[A-Z0-9]{11,30} + modulo 97 (ISO 7064)
 * 3. Clé API : regex 32+ alphanum + entropie Shannon ≥ 4.0 bits/char
 *
 * Exclusions (SFD §2.7.3 CA-M17-06) :
 * - Champs <input type="password"> : M2/M7/M9 domaine
 *
 * Contraintes de performance (SFD §2.7.3 CA-M17-08) :
 * - > 10 000 caractères → analyse limitée aux 1000 premiers caractères
 * - Temps total capture + matching + nullification < 10ms (D-SEC-002)
 *
 * Sécurité (D-SEC-002) :
 * - La variable contenant la valeur collée est nullifiée après le pattern matching
 * - Aucune valeur sensible n'est envoyée au SW — uniquement le type
 * - Aucun innerHTML (D-SEC-003)
 *
 * Référence : SFD §2.7 (M17), DAT §6.2 (flux M17), §9.4 (D-SEC-002)
 */

import { browser } from '@/shared/browser/browser-adapter';

// ---------------------------------------------------------------------------
// UC-03 / INV-UC03-01 : filtre same-origin fail-closed
// Référence : mini-DAT TACHE-070 §INV-UC03-01
// Évalué une seule fois au boot du content script (niveau module).
// NE PAS logguer ici : amplification R-M7-08 dans N iframes.
// ---------------------------------------------------------------------------

/**
 * true si ce content script s'exécute dans le top frame OU dans une iframe
 * dont l'origine est identique à celle du top frame (same-origin).
 * Toute exception (SecurityError cross-origin) → false (fail-closed).
 */
let _snIsSameOriginOrTop = false;
try {
  _snIsSameOriginOrTop = window.top?.location.origin === window.location.origin;
} catch {
  // Cross-origin SecurityError — fail-closed
  _snIsSameOriginOrTop = false;
}

/** Types de données sensibles détectées */
type SensitiveDataType = 'credit_card' | 'iban' | 'api_key';

/** Limite de caractères pour l'analyse (SFD §2.7.3 CA-M17-08 : > 10k → 1000 premiers) */
const MAX_ANALYZE_LENGTH = 1000;
/** Seuil au-delà duquel la troncature est appliquée */
const TRUNCATE_THRESHOLD = 10_000;

/** Entropie Shannon minimale pour les clés API (SFD §2.7.2) */
const MIN_API_KEY_ENTROPY = 4.0;

/**
 * Patterns de détection de données sensibles (SFD §2.7.2).
 * Ordre de priorité : carte bancaire > IBAN > clé API.
 */
const PATTERNS = {
  /** Numéro de carte bancaire : 13 à 19 chiffres avec séparateurs optionnels */
  credit_card: /\b(?:\d[ -]*?){13,19}\b/,
  /** IBAN : code pays (2 lettres) + 2 chiffres + 11 à 30 caractères alphanumériques */
  iban: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b/,
  /** Clé API : 32+ caractères alphanumériques (validation entropie Shannon séparée) */
  api_key: /\b[A-Za-z0-9_-]{32,}\b/,
} as const;

/**
 * Initialise le détecteur de presse-papiers.
 * Appelé une seule fois à l'injection du content script.
 *
 * UC-03 / INV-UC03-01 : retour anticipé si le script est exécuté dans une iframe
 * cross-origin. Aucun listener, aucun log, aucun message SW (INV-UC03-03).
 */
function initPasteDetector(): void {
  // UC-03 / INV-UC03-01 : guard same-origin — fail-closed
  if (!_snIsSameOriginOrTop) return;

  // {capture: true} : interception en phase de capture, avant tout stopPropagation()
  // Google Search et d'autres sites modernes bloquent la remontée de l'événement paste.
  // Sans capture, le listener n'est jamais déclenché sur ces inputs enrichis.
  document.addEventListener('paste', handlePaste, { capture: true });
}

/**
 * Gère l'événement paste et détecte les données sensibles.
 * La nullification de la variable locale est garantie dans le bloc finally (D-SEC-002).
 *
 * @param event - Événement ClipboardEvent
 */
function handlePaste(event: ClipboardEvent): void {
  // Exclusion des champs password (SFD §2.7.3 CA-M17-06)
  const target = event.target;
  if (target instanceof HTMLInputElement && target.type === 'password') {
    return;
  }

  // Lecture du contenu collé depuis clipboardData (jamais depuis navigator.clipboard)
  let clipboardText: string | null = event.clipboardData?.getData('text/plain') ?? null;

  if (!clipboardText || clipboardText.length === 0) {
    clipboardText = null;
    return;
  }

  let detectedTypes: SensitiveDataType[] = [];

  try {
    // Troncature si > 10 000 caractères (SFD §2.7.3 CA-M17-08 + performance)
    const textToAnalyze =
      clipboardText.length > TRUNCATE_THRESHOLD
        ? clipboardText.substring(0, MAX_ANALYZE_LENGTH)
        : clipboardText;

    // Pattern matching en mémoire (résultat : liste de types par ordre de priorité)
    detectedTypes = detectSensitiveTypes(textToAnalyze);
  } finally {
    // D-SEC-002 : nullification de la variable clipboard immédiatement après l'analyse
    // Ceci garantit < 10ms même si la détection prend du temps
    clipboardText = null;
  }

  if (detectedTypes.length === 0) return;

  // Envoyer uniquement le type (jamais la valeur) au service worker
  void notifyServiceWorker(detectedTypes);
}

/**
 * Détecte les types de données sensibles dans le texte.
 * Retourne une liste ordonnée par priorité (carte > IBAN > clé API).
 *
 * Validations secondaires (SFD §2.7.2) :
 * - Carte bancaire : algorithme de Luhn
 * - IBAN : modulo 97 (ISO 7064)
 * - Clé API : entropie Shannon ≥ 4.0 bits/char
 *
 * @param text - Texte à analyser (déjà tronqué si > 10k caractères)
 * @returns Liste des types détectés (peut en contenir plusieurs, ex: IBAN + clé API)
 */
export function detectSensitiveTypes(text: string): SensitiveDataType[] {
  const detected: SensitiveDataType[] = [];

  // 1. Carte bancaire (priorité 1)
  const cardMatch = PATTERNS.credit_card.exec(text);
  if (cardMatch) {
    const digits = cardMatch[0].replace(/[ -]/g, '');
    if (luhnCheck(digits)) {
      detected.push('credit_card');
    }
  }

  // 2. IBAN (priorité 2)
  const ibanMatch = PATTERNS.iban.exec(text);
  if (ibanMatch) {
    if (ibanModulo97(ibanMatch[0])) {
      detected.push('iban');
    }
  }

  // 3. Clé API (priorité 3)
  const apiMatch = PATTERNS.api_key.exec(text);
  if (apiMatch) {
    if (shannonEntropy(apiMatch[0]) >= MIN_API_KEY_ENTROPY) {
      detected.push('api_key');
    }
  }

  return detected;
}

/**
 * Valide un numéro de carte bancaire par l'algorithme de Luhn.
 *
 * L'algorithme de Luhn (ISO/IEC 7812-1) :
 * 1. Parcourir les chiffres de droite à gauche
 * 2. Positions paires (en partant de la droite) : doubler le chiffre
 *    Si résultat > 9 : soustraire 9
 * 3. Sommer tous les chiffres
 * 4. Si somme % 10 === 0 : valide
 *
 * @param digits - Chiffres du numéro de carte (sans espaces ni tirets)
 * @returns true si le numéro passe la vérification Luhn
 */
export function luhnCheck(digits: string): boolean {
  const cleaned = digits.replace(/\D/g, '');
  if (cleaned.length < 13 || cleaned.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  // Parcours de droite à gauche
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]!, 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Valide un IBAN par la méthode modulo 97 (ISO 7064).
 *
 * Algorithme :
 * 1. Déplacer les 4 premiers caractères en fin de chaîne
 * 2. Remplacer les lettres par leurs valeurs numériques (A=10, B=11, ..., Z=35)
 * 3. Calculer le modulo 97 de l'entier résultant
 * 4. Si résultat === 1 : valide
 *
 * @param iban - IBAN brut (ex: "FR7614508059000001234567890")
 * @returns true si le modulo 97 est valide
 */
export function ibanModulo97(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();

  if (cleaned.length < 15 || cleaned.length > 34) return false;

  // Déplacer les 4 premiers caractères en fin
  const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);

  // Convertir les lettres en chiffres (A=10, ..., Z=35)
  const numeric = rearranged
    .split('')
    .map((c) => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        // Lettre A-Z → valeur décimale (A=10, ..., Z=35)
        return (code - 55).toString();
      }
      return c;
    })
    .join('');

  // Calcul modulo 97 sur grands entiers (chaîne de chiffres potentiellement très longue)
  // Traitement par blocs de 9 chiffres pour éviter les dépassements d'entier
  let remainder = 0;
  let offset = 0;
  while (offset < numeric.length) {
    const chunk = remainder.toString() + numeric.substring(offset, offset + 9);
    remainder = parseInt(chunk, 10) % 97;
    offset += 9;
  }

  return remainder === 1;
}

/**
 * Calcule l'entropie de Shannon d'une chaîne de caractères.
 *
 * Formule : H = -Σ p(c) × log2(p(c))
 * où p(c) est la fréquence relative d'un caractère c.
 *
 * Une clé API légitime présente une entropie ≥ 4.0 bits/char (SFD §2.7.2).
 * Un mot commun ou une chaîne répétitive aura une entropie bien inférieure.
 *
 * @param text - Texte à analyser
 * @returns Entropie en bits par caractère
 */
export function shannonEntropy(text: string): number {
  if (text.length === 0) return 0;

  // Comptage des fréquences des caractères
  const freq = new Map<string, number>();
  for (const char of text) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }

  // Calcul de l'entropie
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / text.length;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Notifie le service worker de la détection et déclenche le toast M17.
 *
 * Le toast est affiché IMMÉDIATEMENT après la détection, avant la communication
 * avec le SW. Le SW est notifié en arrière-plan pour le logging uniquement (fire and forget).
 * Cela garantit l'affichage même si le SW est endormi (Bug 5-6 — M17 fiabilité).
 *
 * Seul le type de données est transmis — jamais la valeur sensible (D-SEC-002).
 * Si plusieurs types sont détectés, le premier (priorité la plus haute) est utilisé
 * pour le toast, mais tous sont enregistrés.
 *
 * @param types - Types de données détectées (ordonnés par priorité)
 */
async function notifyServiceWorker(types: SensitiveDataType[]): Promise<void> {
  const primaryType = types[0]!;

  // M17 critique : afficher le toast IMMÉDIATEMENT, sans attendre la réponse du SW
  showToastM17(primaryType);

  // Notifier le SW en arrière-plan pour le logging (fire and forget)
  // Un échec ici est non bloquant — le toast est déjà affiché
  const message = {
    module: 'M17' as const,
    action: 'sensitive_data_detected',
    payload: {
      type: primaryType,
      all_types: types,
    },
    timestamp: Date.now(),
  };
  try {
    await browser.runtime.sendMessage(message);
  } catch {
    // SW endormi — logging perdu mais toast déjà affiché, non bloquant
  }
}

/**
 * Affiche le toast M17 sur la page courante.
 *
 * @param dataType - Type de donnée détectée (pour l'affichage dans le toast)
 */
/**
 * Affiche un toast M17 directement dans le DOM de la page.
 *
 * N'utilise PAS les Custom Elements (customElements.define ne fonctionne pas
 * dans l'isolated world des content scripts Chrome MV3).
 * Construit le DOM manuellement avec un Shadow DOM pour l'isolation CSS.
 */
function showToastM17(dataType: SensitiveDataType): void {
  // Supprimer le toast précédent s'il existe (évite les doublons)
  const existing = document.getElementById('sn-m17-toast-host');
  if (existing) existing.remove();

  const labels: Record<SensitiveDataType, string> = {
    credit_card: 'Numéro de carte bancaire',
    iban: 'IBAN / RIB',
    api_key: 'Clé API',
  };

  // Conteneur hôte
  const host = document.createElement('div');
  host.id = 'sn-m17-toast-host';
  // all:initial reset + display:block explicite (all:initial remet display à inline,
  // ce qui rend l'élément invisible car inline+fixed = taille zéro sans contenu inline)
  host.setAttribute(
    'style',
    'all:initial; display:block; position:fixed; bottom:24px; right:24px; z-index:2147483647; width:380px; pointer-events:auto;',
  );
  document.body.appendChild(host);

  // Shadow DOM pour isolation CSS
  const shadow = host.attachShadow({ mode: 'open' });

  // Styles — tokens v2 via :host + :host-context (T-143)
  const style = document.createElement('style');
  style.textContent = `
    :host {
      --sn-bg: #1e3a5f; --sn-fg: #e0e8f0; --sn-muted: #a8c8e8;
      --sn-danger: #c0392b; --sn-danger-hover: #a33025;
      --sn-accent: #2e6da4; --sn-accent-hover: #245a87;
      --sn-link: #8cc5e8;
      --sn-radius: 8px;
    }
    :host-context([data-theme="dark"]) {
      --sn-bg: #1a1a1f; --sn-fg: #e8e8f0; --sn-muted: #8888a0;
      --sn-danger: #ef4444; --sn-danger-hover: #dc2626;
      --sn-accent: #60a5fa; --sn-accent-hover: #93c5fd;
      --sn-link: #93c5fd;
    }
    :host-context([data-theme="matrix"]) {
      --sn-bg: #0e0e1c; --sn-fg: #e8e8ff; --sn-muted: #8888cc;
      --sn-danger: #ff2d78; --sn-danger-hover: #ff5599;
      --sn-accent: #ff2d78; --sn-accent-hover: #ff5599;
      --sn-link: #00d4ff;
      --sn-radius: 4px;
    }
    .toast { background:var(--sn-bg); color:var(--sn-fg); border-radius:var(--sn-radius); padding:16px 20px;
      box-shadow:0 4px 12px rgba(0,0,0,0.3); max-width:380px; font:15px/1.5 system-ui,sans-serif;
      animation:slideUp .2s ease-out; }
    @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    .title { font-weight:600; margin-bottom:8px; display:flex; align-items:center; gap:8px; }
    .icon { font-size:20px; }
    .desc { font-size:13px; color:var(--sn-muted); margin-bottom:12px; }
    .actions { display:flex; gap:8px; flex-wrap:wrap; }
    button { border:none; border-radius:6px; padding:8px 16px; font:14px system-ui,sans-serif;
      cursor:pointer; min-height:44px; }
    .btn-danger { background:var(--sn-danger); color:#fff; }
    .btn-danger:hover { background:var(--sn-danger-hover); }
    .btn-secondary { background:var(--sn-accent); color:#fff; }
    .btn-secondary:hover { background:var(--sn-accent-hover); }
    .btn-link { background:none; color:var(--sn-link); text-decoration:underline; padding:8px; }
  `;
  shadow.appendChild(style);

  // Toast
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');

  const title = document.createElement('div');
  title.className = 'title';
  const iconSpan = document.createElement('span');
  iconSpan.className = 'icon';
  iconSpan.setAttribute('aria-hidden', 'true');
  iconSpan.textContent = '\u26A0\uFE0F';
  title.appendChild(iconSpan);
  const titleText = document.createElement('span');
  titleText.textContent = 'Données sensibles détectées';
  title.appendChild(titleText);
  toast.appendChild(title);

  const desc = document.createElement('p');
  desc.className = 'desc';
  desc.textContent = `Type détecté : ${labels[dataType] ?? dataType}. Attention au copier-coller de données confidentielles.`;
  toast.appendChild(desc);

  const actions = document.createElement('div');
  actions.className = 'actions';

  const btnClear = document.createElement('button');
  btnClear.type = 'button';
  btnClear.className = 'btn-danger';
  btnClear.textContent = 'Vider le presse-papiers';
  btnClear.addEventListener('click', () => {
    navigator.clipboard
      .writeText('')
      .then(() => {
        btnClear.textContent = '\u2713 Vidé';
        btnClear.disabled = true;
      })
      .catch(() => {
        btnClear.textContent = 'Échec — videz manuellement';
      });
  });
  actions.appendChild(btnClear);

  const btnOk = document.createElement('button');
  btnOk.type = 'button';
  btnOk.className = 'btn-secondary';
  btnOk.textContent = 'OK, merci';
  btnOk.addEventListener('click', () => host.remove());
  actions.appendChild(btnOk);

  const btnInfo = document.createElement('button');
  btnInfo.type = 'button';
  btnInfo.className = 'btn-link';
  btnInfo.textContent = 'En savoir plus';
  btnInfo.addEventListener('click', () => {
    window.open(
      browser.runtime.getURL('pages/static/donnees-sensibles-presse-papiers.html'),
      '_blank',
    );
  });
  actions.appendChild(btnInfo);

  toast.appendChild(actions);
  shadow.appendChild(toast);

  // Auto-fermeture après 15s
  setTimeout(() => {
    if (host.parentNode) host.remove();
  }, 15000);
}

initPasteDetector();
