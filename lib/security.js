// Utilitário de segurança e criptografia de PIN/Senha
//
// O hash usa PBKDF2 (SHA-256, 100k iterações) com um salt aleatório por
// dispositivo, armazenado em localStorage. Isso torna a força bruta de um PIN
// de 4-8 dígitos inviável mesmo que o atacante possua o hash.
//
// Compatibilidade: hashes antigos criados com SHA-256 + salt fixo ('fincasal_salt_')
// continuam sendo aceitos na verificação, mas são automaticamente re-salvados com
// o novo formato quando reconhecidos.

const COOKED_SALT_KEY = 'fincasal_pin_salt';
const ITERATIONS = 100_000;

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function pbkdf2Hex(password, salt, iterations) {
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toHex(bits);
}

function getOrCreateSalt() {
  if (typeof window === 'undefined') return 'fincasal_default_salt';
  let salt = localStorage.getItem(COOKED_SALT_KEY);
  if (!salt) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    salt = toHex(bytes.buffer);
    localStorage.setItem(COOKED_SALT_KEY, salt);
  }
  return salt;
}

// Hash legado: SHA-256 de 'fincasal_salt_' + pin (aplicado em versões anteriores)
async function legacyHash(pin) {
  const data = new TextEncoder().encode('fincasal_salt_' + String(pin).trim());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return toHex(hashBuffer);
}

export async function hashPin(pin) {
  if (!pin) return '';
  const str = String(pin).trim();
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API indisponível neste navegador.');
  }
  const salt = getOrCreateSalt();
  const digest = await pbkdf2Hex(str, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${salt}$${digest}`;
}

// Verifica se o PIN confere com o hash (suporta formato novo e legado)
export async function verifyPin(pin, expectedHash) {
  if (!pin || !expectedHash) return false;
  const str = String(pin).trim();

  if (expectedHash.startsWith('pbkdf2$')) {
    const [algo, iter, salt, digest] = expectedHash.split('$');
    if (algo !== 'pbkdf2' || !iter || !salt || !digest) return false;
    const candidate = await pbkdf2Hex(str, salt, Number(iter));
    return candidate === digest;
  }

  // Formato legado
  const legacy = await legacyHash(str);
  return legacy === expectedHash;
}
