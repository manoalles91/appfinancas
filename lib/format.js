// Funções compartilhadas de formatação/parse de valores financeiros e datas.

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
}

export function formatCurrencyCompact(value) {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return formatCurrency(n / 1_000_000) + 'M';
  if (abs >= 1_000) return formatCurrency(n / 1_000) + 'k';
  return formatCurrency(n);
}

export function parseLocalDate(dateString) {
  if (!dateString) return null;
  const str = String(dateString).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  const d = new Date(dateString);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(dateString) {
  if (!dateString) return '';
  const clean = String(dateString).slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d}/${m}`;
  }
  const d = parseLocalDate(dateString);
  if (!d) return String(dateString);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatDateLong(dateString) {
  if (!dateString) return '';
  const clean = String(dateString).slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  const d = parseLocalDate(dateString);
  if (!d) return String(dateString);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function monthKey(date) {
  const d = date instanceof Date ? date : parseLocalDate(date);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Retorna a chave do mês da fatura (ex: '2026-10') em que a compra cai,
 * baseado na data da compra e nos dias de fechamento e vencimento do cartão.
 */
export function getCardInvoiceMonth(card, purchaseDateStr) {
  if (!purchaseDateStr) return null;
  const d = typeof purchaseDateStr === 'string'
    ? parseLocalDate(purchaseDateStr.slice(0, 10))
    : purchaseDateStr;
  if (!d || Number.isNaN(d.getTime())) return null;

  const fechamento = Number(card?.fechamento || 3);
  const vencimento = Number(card?.vencimento || 10);

  const day = d.getDate();
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 a 11

  // Determina o mês/ano do fechamento desta fatura
  let closingYear = year;
  let closingMonth = month;
  if (day >= fechamento) {
    closingMonth += 1;
    if (closingMonth > 11) {
      closingMonth = 0;
      closingYear += 1;
    }
  }

  // Determina o mês/ano do vencimento desta fatura
  let dueYear = closingYear;
  let dueMonth = closingMonth;
  if (vencimento <= fechamento) {
    dueMonth += 1;
    if (dueMonth > 11) {
      dueMonth = 0;
      dueYear += 1;
    }
  }

  return `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}`;
}

/**
 * Retorna o rótulo amigável do mês da fatura (ex: 'Outubro/2026')
 */
export function formatInvoiceMonth(monthKeyStr) {
  if (!monthKeyStr) return '';
  const parts = String(monthKeyStr).split('-');
  if (parts.length < 2) return monthKeyStr;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!y || !m) return monthKeyStr;
  const date = new Date(y, m - 1, 1, 12, 0, 0);
  const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${y}`;
}

// Converte um valor textual (ex.: "1.234,56" ou "1234.56") em Number.
export function parseAmount(text) {
  if (text === null || text === undefined) return 0;
  const str = String(text).trim();
  if (!str) return 0;
  const n = Number(str);
  if (!Number.isNaN(n)) return n;

  const cleaned = str.replace(/[^\d.,-]/g, '');
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (hasComma && hasDot) {
    // vírgula = decimais, ponto = milhar
    if (lastComma > lastDot) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(cleaned.replace(/,/g, ''));
  }
  if (hasComma) {
    return parseFloat(cleaned.replace(',', '.'));
  }
  return parseFloat(cleaned);
}
