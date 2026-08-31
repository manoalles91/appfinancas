'use client';

import { supabase } from '@/lib/supabase';

const SALDO_KEYS = { alle: 'saldo_alle', kelly: 'saldo_kelly' };
const LS_ALLE = 'fincasal_saldo_alle';
const LS_KELLY = 'fincasal_saldo_kelly';

export function getSaldo() {
  if (typeof window === 'undefined') return { alle: 0, kelly: 0 };
  const a = parseFloat(localStorage.getItem(LS_ALLE)) || 0;
  const k = parseFloat(localStorage.getItem(LS_KELLY)) || 0;
  return { alle: Number.isFinite(a) ? a : 0, kelly: Number.isFinite(k) ? k : 0 };
}

export function syncSaldoToStorage(alleVal, kellyVal) {
  if (typeof window === 'undefined') return;
  try {
    if (alleVal !== undefined && alleVal !== null) {
      localStorage.setItem(LS_ALLE, String(Math.round(Number(alleVal) * 100) / 100));
    }
    if (kellyVal !== undefined && kellyVal !== null) {
      localStorage.setItem(LS_KELLY, String(Math.round(Number(kellyVal) * 100) / 100));
    }
    window.dispatchEvent(new CustomEvent('fincasal:saldo-changed'));
  } catch {}
}

async function persistSaldo(who, val) {
  const safeWho = who === 'kelly' ? 'kelly' : 'alle';
  const num = Number.isFinite(Number(val)) ? Number(val) : 0;
  const raw = String(Math.round(num * 100) / 100);
  try {
    if (safeWho === 'alle') localStorage.setItem(LS_ALLE, raw);
    else localStorage.setItem(LS_KELLY, raw);
  } catch {}
  try {
    await supabase
      .from('app_settings')
      .upsert({ key: SALDO_KEYS[safeWho], value: raw }, { onConflict: 'key' });
  } catch (err) {
    console.error('Error saving saldo:', err && err.message);
  }
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fincasal:saldo-changed'));
  } catch {}
}

export function setSaldo(who, value) {
  persistSaldo(who, value);
  return value;
}

export function deltaSaldo(who, delta) {
  const safeWho = who === 'kelly' ? 'kelly' : 'alle';
  const cur = getSaldo();
  const safeDelta = Number.isFinite(Number(delta)) ? Number(delta) : 0;
  const next = safeWho === 'alle' ? cur.alle + safeDelta : cur.kelly + safeDelta;
  persistSaldo(safeWho, next);
  return next;
}

export function getPagoPor(txId) {
  if (typeof window === 'undefined') return null;
  try {
    const map = JSON.parse(localStorage.getItem('fincasal_pago_por')) || {};
    return map[txId] || null;
  } catch { return null; }
}

export function setPagoPor(txId, who) {
  if (typeof window === 'undefined') return;
  try {
    const map = JSON.parse(localStorage.getItem('fincasal_pago_por')) || {};
    if (who) map[txId] = who;
    else delete map[txId];
    localStorage.setItem('fincasal_pago_por', JSON.stringify(map));
  } catch {}
}

