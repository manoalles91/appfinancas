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

export function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return String(dateString);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatDateLong(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return String(dateString);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function monthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
