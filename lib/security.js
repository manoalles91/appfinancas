// Utilitário de segurança e criptografia de PIN/Senha usando SHA-256

export async function hashPin(pin) {
  if (!pin) return '';
  const str = String(pin).trim();
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    // Fallback simples para ambientes sem Web Crypto API
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return 'fallback_' + Math.abs(hash).toString(16);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode('fincasal_salt_' + str);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function verifyPin(pin, expectedHash) {
  if (!pin || !expectedHash) return false;
  const h = await hashPin(pin);
  return h === expectedHash;
}
