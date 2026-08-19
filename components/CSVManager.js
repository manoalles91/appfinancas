'use client';

import { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileSpreadsheet, Download, Upload } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

const EXPORT_COLUMNS = [
    { key: 'date', header: 'data' },
    { key: 'description', header: 'descricao' },
    { key: 'amount', header: 'valor' },
    { key: 'type', header: 'tipo' },
    { key: 'category', header: 'categoria' },
    { key: 'subcategoria', header: 'subcategoria' },
    { key: 'card_name', header: 'cartao' },
    { key: 'installment_info', header: 'parcela' },
    { key: 'pago', header: 'pago' },
    { key: 'fixa', header: 'fixa' },
    { key: 'payment_method', header: 'pagamento' },
    { key: 'quem', header: 'quem' },
    { key: 'destino', header: 'destino' },
    { key: 'ajuste', header: 'ajuste' },
];

const HEADER_ALIASES = {
    date: ['date', 'data', 'vencimento', 'dt', 'dia'],
    description: ['description', 'descricao', 'descrição', 'desc', 'nome', 'titulo', 'título', 'gasto', 'despesa', 'observacao', 'observação'],
    amount: ['amount', 'valor', 'value', 'preco', 'preço', 'total', 'montante'],
    type: ['type', 'tipo', 'classe', 'natureza'],
    category: ['category', 'categoria', 'grupo'],
    subcategoria: ['subcategoria', 'subcategory'],
    card_name: ['card_name', 'cardname', 'cartao', 'cartão', 'card'],
    installment_info: ['installment_info', 'installment', 'parcela', 'parcelas'],
    pago: ['pago', 'paid', 'status', 'paga', 'quitado', 'quitada'],
    fixa: ['fixa', 'fixed', 'fixo', 'recorrente'],
    payment_method: ['payment_method', 'paymentmethod', 'pagamento', 'forma_pagamento', 'forma', 'meio_pagamento'],
    quem: ['quem', 'who', 'responsavel', 'responsável', 'pessoa', 'dono'],
    destino: ['destino', 'destination', 'origem'],
    ajuste: ['ajuste', 'adjustment', 'ajust'],
};

const escapeCSV = (value, delimiter) => {
    const s = value == null ? '' : String(value);
    if (s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
};

const detectDelimiter = (line) => {
    let countComma = 0;
    let countSemicolon = 0;
    let inQuotes = false;
    for (const c of line) {
        if (c === '"') inQuotes = !inQuotes;
        else if (!inQuotes) {
            if (c === ',') countComma++;
            else if (c === ';') countSemicolon++;
        }
    }
    return countSemicolon >= countComma ? ';' : ',';
};

const parseCSVLine = (line, delimiter) => {
    const cells = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQuotes) {
            if (c === '"') {
                if (line[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === delimiter) {
            cells.push(field);
            field = '';
        } else {
            field += c;
        }
    }
    cells.push(field);
    return cells;
};

const parseAmount = (value) => {
    if (value == null) return 0;
    let s = String(value).trim().replace(/[R$\s]/g, '');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/,/g, '');
    } else if (s.includes(',')) {
        s = s.replace(',', '.');
    }
    return Math.abs(parseFloat(s) || 0);
};

const parseBoolean = (value) => {
    if (value == null) return false;
    const s = String(value).trim().toLowerCase();
    return ['sim', 's', 'true', '1', 'pago', 'paga', 'yes', 'y', 'x'].includes(s);
};

const parseDate = (value) => {
    const s = String(value || '').trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (m) {
        let year = m[3];
        if (year.length === 2) year = '20' + year;
        return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    return null;
};

const mapType = (value) => {
    const s = String(value || '').trim().toLowerCase();
    if (['receita', 'income', 'entrada', 'credito_entrada', 'ganho', '+'].includes(s)) return 'income';
    if (['cartao', 'credit', 'credito', 'crédito', 'compra_cartao'].includes(s)) return 'credit';
    return 'expense';
};

const mapPayment = (value, type) => {
    const s = String(value || '').trim().toLowerCase();
    if (['credit', 'credito', 'crédito', 'cartao', 'cartão'].includes(s)) return 'credit';
    if (type === 'credit') return 'credit';
    return 'checking';
};

const mapQuem = (value) => {
    const s = String(value || '').trim().toLowerCase();
    if (['comum - eu', 'comum-eu', 'eu comum'].includes(s)) return 'Comum - Eu';
    if (['comum - outro', 'comum-outro', 'outro comum'].includes(s)) return 'Comum - Outro';
    if (['eu', 'alle', 'p1'].includes(s)) return 'Eu';
    if (['outro', 'kelly', 'p2'].includes(s)) return 'Outro';
    return 'Comum';
};

const parseImport = (text) => {
    text = text.replace(/^\ufeff/, '');
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) return { rows: [] };

    const delimiter = detectDelimiter(lines[0]);
    const headerRow = parseCSVLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());

    const colMap = {};
    headerRow.forEach((h, i) => {
        for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
            if (aliases.includes(h) && colMap[key] === undefined) colMap[key] = i;
        }
    });

    if (colMap.date === undefined || colMap.amount === undefined) {
        throw new Error('Colunas obrigatórias não encontradas. O arquivo precisa ter cabeçalho com "data" e "valor".');
    }

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i], delimiter);
        const get = (key) => (colMap[key] !== undefined ? (cells[colMap[key]] || '').trim() : '');

        const date = parseDate(get('date'));
        const amount = parseAmount(get('amount'));
        if (!date || amount <= 0) continue;

        const type = mapType(get('type'));
        rows.push({
            description: get('description') || 'Importado',
            amount,
            type,
            category: get('category') || (type === 'income' ? 'Salário' : 'Compras'),
            subcategoria: get('subcategoria'),
            card_name: get('card_name'),
            installment_info: get('installment_info'),
            pago: parseBoolean(get('pago')),
            fixa: parseBoolean(get('fixa')),
            payment_method: mapPayment(get('payment_method'), type),
            quem: mapQuem(get('quem')),
            destino: get('destino'),
            ajuste: parseAmount(get('ajuste')),
            date,
        });
    }
    return { rows };
};

export default function CSVManager({ transactions = [], onImport }) {
    const fileRef = useRef(null);
    const { toast } = useToast();

    const handleExport = () => {
        const delimiter = ';';
        const header = EXPORT_COLUMNS.map((c) => c.header).join(delimiter);
        const lines = (Array.isArray(transactions) ? transactions : []).map((t) =>
            EXPORT_COLUMNS.map((c) => {
                let v = t ? t[c.key] : '';
                if (c.key === 'amount') v = Number(v || 0).toFixed(2).replace('.', ',');
                if (c.key === 'date') v = String(v || '').slice(0, 10);
                if (c.key === 'pago' || c.key === 'fixa') v = v ? 'sim' : 'nao';
                return escapeCSV(v, delimiter);
            }).join(delimiter)
        );

        const csv = '\ufeff' + [header, ...lines].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transacoes_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast(`${lines.length} transações exportadas!`);
    };

    const handleFile = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const { rows } = parseImport(text);
            if (rows.length === 0) {
                toast('Nenhuma transação válida encontrada no arquivo.', 'error');
                return;
            }
            if (onImport) await onImport(rows);
        } catch (err) {
            toast('Erro ao ler arquivo: ' + err.message, 'error');
        } finally {
            e.target.value = '';
        }
    };

    return (
        <Card className="animate-slide-up border-emerald-500/15">
            <CardContent className="p-4 md:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                        <p className="text-sm font-bold text-white">Planilha (.csv)</p>
                        <p className="text-[11px] text-slate-500 truncate">Exporte para editar no Excel/Google Sheets, ou importe de volta.</p>
                    </div>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-lg shadow-emerald-500/20 border border-emerald-400/30 hover:scale-105"
                        title="Baixar todas as transações em CSV"
                    >
                        <Download className="h-4 w-4" />
                        EXPORTAR
                    </button>
                    <button
                        onClick={() => fileRef.current && fileRef.current.click()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-lg shadow-indigo-500/20 border border-indigo-400/30 hover:scale-105"
                        title="Importar transações de um arquivo CSV"
                    >
                        <Upload className="h-4 w-4" />
                        IMPORTAR
                    </button>
                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
                </div>
            </CardContent>
        </Card>
    );
}