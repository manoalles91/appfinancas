'use client';

import { getSaldo } from './saldo';

/**
 * Dispara notificação financeira de forma assíncrona diretamente para o webhook do n8n.
 * Non-blocking: não interrompe o fluxo do app em caso de falha de rede.
 * Totalmente compatível com exportação estática (output: export) e uso offline-first.
 *
 * @param {Object} params
 * @param {'transaction_created'|'transaction_updated'|'transaction_deleted'|'transaction_paid'|'saldo_updated'|'invoice_paid'|'invoice_reopened'|'settle_debt'|'test'} params.event
 * @param {Object} params.data
 * @param {string} [params.partner1]
 * @param {string} [params.partner2]
 */
export async function notifyFinanceEvent({ event, data = {}, partner1 = 'Alle', partner2 = 'Kelly' }) {
  if (typeof window === 'undefined') return { success: false, reason: 'ssr' };

  try {
    // Verifica se o usuário desativou as notificações nas configurações locais
    const enabled = localStorage.getItem('fincasal_whatsapp_enabled');
    if (enabled === 'false' && event !== 'test') {
      return { success: false, reason: 'disabled_by_user' };
    }

    const webhookUrl = localStorage.getItem('fincasal_n8n_webhook_url') || 'https://n8n.manoalles.space/webhook/financas-alerta';
    if (!webhookUrl) {
      return { success: false, reason: 'no_webhook_url' };
    }

    // Enriquece com os saldos atuais
    const currentSaldos = getSaldo();
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      partner1,
      partner2,
      saldos: {
        alle: currentSaldos.alle,
        kelly: currentSaldos.kelly,
        total: Math.round((currentSaldos.alle + currentSaldos.kelly) * 100) / 100,
      },
      data,
    };

    // Disparo direto com timeout de 6s
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: errText || `Status ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    console.warn('[WhatsApp Notify] Erro ao disparar evento:', err?.message || err);
    return { success: false, error: err?.message };
  }
}
