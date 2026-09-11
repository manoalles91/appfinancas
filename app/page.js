'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Dashboard from '@/components/Dashboard';
import TransactionList from '@/components/TransactionList';
import AddTransactionForm from '@/components/AddTransactionForm';
import Reports from '@/components/Reports';
import NavTabs from '@/components/NavTabs';
import ConfirmDialog from '@/components/ConfirmDialog';
import CSVManager from '@/components/CSVManager';
import CategoriesEditor from '@/components/CategoriesEditor';
import Wishlist from '@/components/Wishlist';
import HouseTasks from '@/components/HouseTasks';
import AppLock from '@/components/AppLock';
import AuditLogViewer from '@/components/AuditLogViewer';
import Financiamentos from '@/components/Financiamentos';
import { useToast } from '@/components/ui/toast';
import { Sparkles, CreditCard, Trash2, Edit3, Plus, ChevronLeft, ChevronRight, ChevronDown, RotateCcw, AlertTriangle, Settings, Home as HomeIcon, ArrowLeftRight, PieChart, X, SlidersHorizontal, ShoppingBag, CheckSquare, Calendar, FastForward, Lock, Unlock, KeyRound, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getCategories, getGroupId } from '@/lib/categories';
import { loadCloudSettings, saveCloudSetting } from '@/lib/cloudSettings';
import { hashPin, verifyPin } from '@/lib/security';
import { Card, CardContent } from '@/components/ui/card';
import { useSession, REQUIRE_AUTH, signOut } from '@/lib/auth';
import AuthScreen from '@/components/AuthScreen';
import { logAudit } from '@/lib/audit';
import { deltaSaldo, getPagoPor, setPagoPor, getSaldo } from '@/lib/saldo';
import { parseLocalDate, getCardInvoiceMonth, formatInvoiceMonth } from '@/lib/format';
import { notifyFinanceEvent } from '@/lib/whatsappNotify';

const TABS = [
  { id: 'inicio', label: 'Início', icon: HomeIcon },
  { id: 'financas', label: 'Finanças', icon: ArrowLeftRight },
  { id: 'desejos', label: 'Desejos', icon: ShoppingBag },
  { id: 'tarefas', label: 'Tarefas', icon: CheckSquare },
  { id: 'config', label: 'Configurações', icon: Settings },
];

export default function Home() {
  const [transactions, setTransactions] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [online, setOnline] = useState(true);
  const [viewDate, setViewDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [activeTab, setActiveTab] = useState('inicio');
  const [financeSubTab, setFinanceSubTab] = useState('transacoes'); // transacoes | cartoes | relatorios
  const [wishlist, setWishlist] = useState([]);
  const [tasks, setTasks] = useState([]);
  const { toast } = useToast();
  const { user, loading: authLoading } = useSession();
  const [showAuthScreen, setShowAuthScreen] = useState(false);

  const [partner1, setPartner1] = useState('Alle');
  const [partner2, setPartner2] = useState('Kelly');

  // Notificações WhatsApp via n8n
  const [whatsappEnabled, setWhatsappEnabled] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('fincasal_whatsapp_enabled') !== 'false' : true));
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('fincasal_n8n_webhook_url') || 'https://n8n.manoalles.space/webhook/financas-alerta' : 'https://n8n.manoalles.space/webhook/financas-alerta'));
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);

  // Modo Privacidade (Ocultar Saldos) e Modal de Lançamento Rápido
  const [isPrivate, setIsPrivate] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('fincasal_privacy') === 'true' : false));
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState('expense');

  const togglePrivacy = useCallback(() => {
    setIsPrivate(prev => {
      const next = !prev;
      try { localStorage.setItem('fincasal_privacy', String(next)); } catch {}
      toast(next ? 'Modo privacidade ativado (saldos ocultos)' : 'Modo privacidade desativado');
      return next;
    });
  }, [toast]);

  const handleOpenQuickAdd = useCallback((type = 'expense') => {
    setQuickAddType(type);
    setIsQuickAddOpen(true);
  }, []);

  // States para edição e adição de cartão
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [newCardData, setNewCardData] = useState({
    nome: '',
    limite: '',
    vencimento: '10',
    fechamento: '3',
    bandeira: 'MasterCard'
  });

  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all');
  const [selectedCardFilter, setSelectedCardFilter] = useState(null);
  const [expandedPurchases, setExpandedPurchases] = useState(null);
  const [cardSelectedFatura, setCardSelectedFatura] = useState({});
  const [cardPurchasesTab, setCardPurchasesTab] = useState({});

  // Estados de Segurança / PIN Lock
  const [pinHash, setPinHash] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('fincasal_pin_hash') || '' : ''));
  const [isLocked, setIsLocked] = useState(() => {
    if (typeof window === 'undefined') return false;
    const hash = localStorage.getItem('fincasal_pin_hash');
    const sessionUnlocked = sessionStorage.getItem('fincasal_unlocked');
    return !!hash && sessionUnlocked !== 'true';
  });
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState('create'); // 'create' | 'change' | 'remove'
  const [pinForm, setPinForm] = useState({ currentPin: '', newPin: '', confirmNewPin: '' });
  const [pinFormError, setPinFormError] = useState('');

  const variaveis = useMemo(() => {
    void transactions;
    try {
      return JSON.parse(localStorage.getItem('fincasal_fixas_variaveis')) || [];
    } catch {
      return [];
    }
  }, [transactions]);

  // States para confirmação de exclusão e reset
  const [txToDelete, setTxToDelete] = useState(null);
  const [cardToDelete, setCardToDelete] = useState(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [resetPin, setResetPin] = useState('');
  const [pendingReset, setPendingReset] = useState(false);

  // States para reajuste manual de fatura por mês
  const [reajusteFatura, setReajusteFatura] = useState(null);
  const [ajusteVersion, setAjusteVersion] = useState(0);

  // Saldo automático: modal "Quem pagou/recebeu?"
  const [pendingPaidTx, setPendingPaidTx] = useState(null);
  const [customPayMode, setCustomPayMode] = useState(false);
  const [customPayAlle, setCustomPayAlle] = useState('');
  const [customPayKelly, setCustomPayKelly] = useState('');
  const [pendingPayInvoice, setPendingPayInvoice] = useState(null);

  // Modal de Liquidação do Acerto do Casal (Pix)
  const [pendingSettleDebt, setPendingSettleDebt] = useState(null);

  const handleOpenSettleDebt = useCallback((data) => {
    setPendingSettleDebt(data);
  }, []);

  const handleConfirmSettleDebt = async () => {
    if (!pendingSettleDebt) return;
    const { debtor, creditor, amount } = pendingSettleDebt;
    const isP1Debtor = debtor === partner1;
    const cleanAmount = Math.round(Number(amount || 0) * 100) / 100;

    try {
      // 1. Debita de quem deve e credita para quem recebe no saldo bancário
      deltaSaldo(isP1Debtor ? 'alle' : 'kelly', -cleanAmount);
      deltaSaldo(isP1Debtor ? 'kelly' : 'alle', cleanAmount);

      // 2. Grava a transação para comprovação e equilíbrio contábil
      const payload = {
        description: `Acerto Casal: Pix de ${debtor} para ${creditor}`,
        amount: cleanAmount,
        type: 'expense',
        category: 'Outros',
        subcategoria: 'Acerto Casal',
        date: new Date().toISOString().slice(0, 10),
        pago: true,
        payment_method: 'checking',
        quem: isP1Debtor ? 'Outro' : 'Eu',
        pago_por: isP1Debtor ? 'alle' : 'kelly',
        pago_alle: isP1Debtor ? cleanAmount : 0,
        pago_kelly: isP1Debtor ? 0 : cleanAmount,
      };

      const { data, error } = await supabase.from('transactions').insert([payload]).select();
      if (error) throw error;
      if (data && data[0]) {
        setTransactions(prev => [data[0], ...prev]);
      }
      setPendingSettleDebt(null);
      notifyFinanceEvent({
        event: 'settle_debt',
        partner1,
        partner2,
        data: {
          devedor: debtor,
          credor: creditor,
          valor: cleanAmount,
        },
      });
      toast(`Acerto de R$ ${cleanAmount.toFixed(2)} liquidado com sucesso!`);
    } catch (err) {
      toast('Erro ao liquidar acerto: ' + (err?.message || err), 'error');
    }
  };

  const getAjustesFaturas = () => {
    try {
      if (typeof window === 'undefined') return {};
      return JSON.parse(localStorage.getItem('fincasal_ajustes_faturas')) || {};
    } catch {
      return {};
    }
  };

  const getFaturasPagas = () => {
    try {
      if (typeof window === 'undefined') return {};
      return JSON.parse(localStorage.getItem('fincasal_faturas_pagas')) || {};
    } catch {
      return {};
    }
  };

  // Handlers para Notificações do WhatsApp
  const handleToggleWhatsAppNotifications = useCallback(async () => {
    const next = !whatsappEnabled;
    setWhatsappEnabled(next);
    try { localStorage.setItem('fincasal_whatsapp_enabled', String(next)); } catch {}
    saveCloudSetting('n8n_webhook_enabled', next);
    toast(next ? 'Notificações WhatsApp ativadas!' : 'Notificações WhatsApp desativadas.');
  }, [whatsappEnabled, toast]);

  const handleUpdateWebhookUrl = useCallback((url) => {
    setN8nWebhookUrl(url);
    try { localStorage.setItem('fincasal_n8n_webhook_url', url); } catch {}
    saveCloudSetting('n8n_webhook_url', url);
  }, []);

  const handleTestWhatsApp = useCallback(async () => {
    setIsTestingWhatsApp(true);
    try {
      const res = await notifyFinanceEvent({
        event: 'test',
        partner1,
        partner2,
        data: {
          mensagem: '🧪 Teste de conexão: Notificações do App de Finanças & Central da Casa ativas no WhatsApp!',
        },
      });
      if (res && res.success) {
        toast('Disparo de teste enviado com sucesso para o n8n!');
      } else {
        toast('Falha ao enviar: ' + (res?.error || 'verifique se o webhook do n8n está ativo'), 'error');
      }
    } catch (err) {
      toast('Erro ao testar: ' + (err?.message || err), 'error');
    } finally {
      setIsTestingWhatsApp(false);
    }
  }, [partner1, partner2, toast]);

  // Sincronização centralizada de configurações na nuvem
  const syncFromCloud = useCallback(async () => {
    try {
      const s = await loadCloudSettings();
      if (typeof s.partner1 === 'string' && s.partner1) setPartner1(s.partner1);
      if (typeof s.partner2 === 'string' && s.partner2) setPartner2(s.partner2);
      if (typeof s.n8n_webhook_url === 'string' && s.n8n_webhook_url) {
        setN8nWebhookUrl(s.n8n_webhook_url);
        try { localStorage.setItem('fincasal_n8n_webhook_url', s.n8n_webhook_url); } catch {}
      }
      if (s.n8n_webhook_enabled !== undefined) {
        const isEn = s.n8n_webhook_enabled !== false && s.n8n_webhook_enabled !== 'false';
        setWhatsappEnabled(isEn);
        try { localStorage.setItem('fincasal_whatsapp_enabled', String(isEn)); } catch {}
      }
      if (s.ajustes_faturas && typeof s.ajustes_faturas === 'object') {
        try { localStorage.setItem('fincasal_ajustes_faturas', JSON.stringify(s.ajustes_faturas)); } catch {}
        setAjusteVersion(v => v + 1);
      }
      if (s.faturas_pagas && typeof s.faturas_pagas === 'object') {
        try { localStorage.setItem('fincasal_faturas_pagas', JSON.stringify(s.faturas_pagas)); } catch {}
        setAjusteVersion(v => v + 1);
      }
      if (s.wishlist && Array.isArray(s.wishlist)) {
        setWishlist(s.wishlist);
        try { localStorage.setItem('fincasal_wishlist', JSON.stringify(s.wishlist)); } catch {}
      }
      if (s.tasks && Array.isArray(s.tasks)) {
        setTasks(s.tasks);
        try { localStorage.setItem('fincasal_tasks', JSON.stringify(s.tasks)); } catch {}
      }
      if (s.financiamentos && Array.isArray(s.financiamentos)) {
        try { localStorage.setItem('fincasal_financiamentos', JSON.stringify(s.financiamentos)); } catch {}
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fincasal:financiamentos-changed'));
      }
      if (s.fixas_variaveis && Array.isArray(s.fixas_variaveis)) {
        try { localStorage.setItem('fincasal_fixas_variaveis', JSON.stringify(s.fixas_variaveis)); } catch {}
      }
      if (s.saldo_alle !== undefined && s.saldo_alle !== null) {
        try { localStorage.setItem('fincasal_saldo_alle', String(s.saldo_alle)); } catch {}
      }
      if (s.saldo_kelly !== undefined && s.saldo_kelly !== null) {
        try { localStorage.setItem('fincasal_saldo_kelly', String(s.saldo_kelly)); } catch {}
      }
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('fincasal:saldo-changed'));
      if (typeof s.app_pin_hash === 'string') {
        setPinHash(s.app_pin_hash);
        try { localStorage.setItem('fincasal_pin_hash', s.app_pin_hash); } catch {}
        if (s.app_pin_hash && sessionStorage.getItem('fincasal_unlocked') !== 'true') {
          setIsLocked(true);
        } else if (!s.app_pin_hash) {
          setIsLocked(false);
        }
      }
    } catch (err) {
      console.error('Error in syncFromCloud:', err);
    }
  }, []);

  // States para edição de transação
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editGrupo, setEditGrupo] = useState('essenciais');
  const [pendingEditScope, setPendingEditScope] = useState(null);

  const openEditTransaction = (t) => {
    const gid = getGroupId(t.category);
    const m = String(t.installment_info || '').match(/^(\d+)\s*\/\s*(\d+)$/);
    let seriesSize = 0;
    if (m) {
      const re = new RegExp(`^(\\d+)/${m[2]}$`);
      seriesSize = transactions.filter(x => x.id !== t.id && x.description === t.description && re.test(String(x.installment_info || ''))).length;
    } else {
      seriesSize = transactions.filter(x => x.id !== t.id && x.description === t.description && (x.fixa || x.type === t.type)).length;
    }
    setEditGrupo(gid || 'outra');
    setEditingTransaction({
      ...t,
      _origDescription: t.description,
      _origAmount: t.amount,
      amount: String(Number(t.amount || 0).toFixed(2)),
      date: (t.date || '').slice(0, 10),
      subcategoria: t.subcategoria || '',
      destino: t.destino || '',
      isParcela: !!m,
      parcelaN: m ? m[1] : '',
      parcelaTotal: m ? m[2] : '',
      valorTipo: m ? 'parcela' : 'total',
      seriesSize,
      applyToAll: seriesSize > 0,
    });
  };

  // Carrega nomes, wishlist e tarefas do localStorage e sincroniza com a nuvem
  useEffect(() => {
    const p1 = localStorage.getItem('fincasal_partner1');
    const p2 = localStorage.getItem('fincasal_partner2');
    if (p1) setPartner1(p1);
    if (p2 && p2 !== 'Esposa') setPartner2(p2);
    else {
      setPartner2('Kelly');
      localStorage.setItem('fincasal_partner2', 'Kelly');
    }

    try {
      const localWishlist = localStorage.getItem('fincasal_wishlist');
      if (localWishlist) setWishlist(JSON.parse(localWishlist));
    } catch {}

    try {
      const localTasks = localStorage.getItem('fincasal_tasks');
      if (localTasks) setTasks(JSON.parse(localTasks));
    } catch {}

    syncFromCloud();
  }, [syncFromCloud]);

  // Handlers para Segurança / PIN Lock
  const handleUnlock = useCallback(() => {
    setIsLocked(false);
    try { sessionStorage.setItem('fincasal_unlocked', 'true'); } catch {}
    toast('Aplicativo desbloqueado com sucesso!');
  }, [toast]);

  const handleLockNow = useCallback(() => {
    setIsLocked(true);
    try { sessionStorage.removeItem('fincasal_unlocked'); } catch {}
    toast('Aplicativo bloqueado.');
  }, [toast]);

  const openPinModal = (mode) => {
    setPinModalMode(mode);
    setPinForm({ currentPin: '', newPin: '', confirmNewPin: '' });
    setPinFormError('');
    setIsPinModalOpen(true);
  };

  const handleSavePinModal = async (e) => {
    e.preventDefault();
    setPinFormError('');

    if (pinHash && (pinModalMode === 'change' || pinModalMode === 'remove')) {
      const isValid = await verifyPin(pinForm.currentPin, pinHash);
      if (!isValid) {
        setPinFormError('O PIN atual informado está incorreto.');
        return;
      }
    }

    if (pinModalMode === 'remove') {
      setPinHash('');
      setIsLocked(false);
      try {
        localStorage.removeItem('fincasal_pin_hash');
        sessionStorage.removeItem('fincasal_unlocked');
      } catch {}
      await saveCloudSetting('app_pin_hash', '');
      setIsPinModalOpen(false);
      toast('Senha de acesso removida.');
      return;
    }

    const cleanPin = String(pinForm.newPin).trim();
    if (cleanPin.length < 4 || cleanPin.length > 8) {
      setPinFormError('O novo PIN deve ter entre 4 e 8 dígitos numéricos.');
      return;
    }

    if (cleanPin !== String(pinForm.confirmNewPin).trim()) {
      setPinFormError('A confirmação do PIN não confere.');
      return;
    }

    const newHash = await hashPin(cleanPin);
    setPinHash(newHash);
    try {
      localStorage.setItem('fincasal_pin_hash', newHash);
      sessionStorage.setItem('fincasal_unlocked', 'true');
    } catch {}
    await saveCloudSetting('app_pin_hash', newHash);
    setIsPinModalOpen(false);
    toast(pinModalMode === 'create' ? 'Senha de acesso configurada com sucesso!' : 'PIN alterado com sucesso!');
  };

  // Handlers para Lista de Desejos
  const handleAddWishlist = useCallback(async (item) => {
    setWishlist(prev => {
      const next = [item, ...prev];
      try { localStorage.setItem('fincasal_wishlist', JSON.stringify(next)); } catch {}
      saveCloudSetting('wishlist', next);
      return next;
    });
    toast('Item adicionado à lista de desejos!');
  }, [toast]);

  const handleUpdateWishlist = useCallback(async (item) => {
    setWishlist(prev => {
      const next = prev.map(w => w.id === item.id ? item : w);
      try { localStorage.setItem('fincasal_wishlist', JSON.stringify(next)); } catch {}
      saveCloudSetting('wishlist', next);
      return next;
    });
    toast('Item atualizado!');
  }, [toast]);

  const handleDeleteWishlist = useCallback(async (id) => {
    setWishlist(prev => {
      const next = prev.filter(w => w.id !== id);
      try { localStorage.setItem('fincasal_wishlist', JSON.stringify(next)); } catch {}
      saveCloudSetting('wishlist', next);
      return next;
    });
    toast('Item removido.');
  }, [toast]);

  // Handlers para Tarefas da Casa
  const handleAddTask = useCallback(async (task) => {
    setTasks(prev => {
      const next = [task, ...prev];
      try { localStorage.setItem('fincasal_tasks', JSON.stringify(next)); } catch {}
      saveCloudSetting('tasks', next);
      return next;
    });
    toast('Tarefa adicionada!');
  }, [toast]);

  const handleToggleTask = useCallback(async (id, completed) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, completed, completed_at: completed ? new Date().toISOString() : null } : t);
      try { localStorage.setItem('fincasal_tasks', JSON.stringify(next)); } catch {}
      saveCloudSetting('tasks', next);
      return next;
    });
  }, []);

  const handleUpdateTask = useCallback(async (task) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === task.id ? task : t);
      try { localStorage.setItem('fincasal_tasks', JSON.stringify(next)); } catch {}
      saveCloudSetting('tasks', next);
      return next;
    });
    toast('Tarefa atualizada!');
  }, [toast]);

  const handleDeleteTask = useCallback(async (id) => {
    setTasks(prev => {
      const next = prev.filter(t => t.id !== id);
      try { localStorage.setItem('fincasal_tasks', JSON.stringify(next)); } catch {}
      saveCloudSetting('tasks', next);
      return next;
    });
    toast('Tarefa removida.');
  }, [toast]);

  const handleClearCompletedTasks = useCallback(async () => {
    setTasks(prev => {
      const next = prev.filter(t => !t.completed);
      try { localStorage.setItem('fincasal_tasks', JSON.stringify(next)); } catch {}
      saveCloudSetting('tasks', next);
      return next;
    });
    toast('Tarefas concluídas foram limpas.');
  }, [toast]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setDataError('');
      const [txRes, cardsRes] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }).limit(5000),
        supabase.from('cartoes').select('*'),
      ]);
      const { data: txData, error: txError } = txRes;
      const { data: cardsData, error: cardsError } = cardsRes;
      if (txError) {
        setDataError(txError.message);
        console.error('Error fetching transactions:', txError.message);
      } else {
        setTransactions(txData || []);
      }
      if (cardsError) {
        setDataError(prev => (prev ? `${prev} | ` : '') + cardsError.message);
        console.error('Error fetching cartoes:', cardsError.message);
      } else {
        setCartoes(cardsData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error.message);
      setDataError(error.message || 'Falha ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Notificação de despesas urgentes (vencidas ou vencendo em até 7 dias)
  useEffect(() => {
    if (loading) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limitDate = new Date(today);
    limitDate.setDate(today.getDate() + 7);
    const urgent = transactions.filter(t => {
      if (!t || t.pago || t.type !== 'expense' || !t.date) return false;
      const td = new Date(String(t.date).slice(0, 10) + 'T00:00:00');
      return td <= limitDate;
    });
    if (urgent.length === 0) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem('fincasal_urgent_notified')) return;
    const total = urgent.reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const msg = `Você tem ${urgent.length} despesa(s) urgente(s) no total de R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
    if (typeof window !== 'undefined') { try { sessionStorage.setItem('fincasal_urgent_notified', '1'); } catch {} }
    toast(msg, urgent.length >= 5 ? 'error' : 'info');
  }, [loading, transactions, toast]);

  // Detecção de conexão online/offline
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnline(navigator.onLine);
    const onOnline = () => { setOnline(true); toast('Conexão restabelecida.'); fetchData(); };
    const onOffline = () => { setOnline(false); toast('Sem conexão. Os dados podem estar desatualizados.', 'error'); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [fetchData, toast]);

  // Tempo real: sincroniza mudanças feitas em outros dispositivos
  useEffect(() => {
    const channel = supabase
      .channel('fincasal-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cartoes' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
        fetchData();
        syncFromCloud();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, syncFromCloud]);

  const monthTransactions = useMemo(() => {
    const viewMonth = viewDate.getMonth();
    const viewYear = viewDate.getFullYear();
    const currentMonthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    return transactions.filter(t => {
      if (!t || !t.date) return false;
      if (t.type === 'credit' && t.card_name) {
        const tInvoice = t.fatura_mes || (t.date ? t.date.slice(0, 7) : null);
        if (tInvoice) return tInvoice === currentMonthKey;
      }
      const d = parseLocalDate(t.date);
      if (!d) return false;
      return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
    });
  }, [transactions, viewDate]);

  const cardsSummary = useMemo(() => {
    void ajusteVersion;
    const viewMonth = viewDate.getMonth();
    const viewYear = viewDate.getFullYear();
    const ajustes = getAjustesFaturas();
    const faturasPagas = getFaturasPagas();
    const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
    const todayDay = new Date().getDate();

    return cartoes.map(card => {
      const cardTxs = transactions.filter(t => t && t.card_name === card.nome && t.type === 'credit');
      const allPurchases = [...cardTxs].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      const allMonths = new Set();
      cardTxs.forEach(t => {
        const inv = t.fatura_mes || (t.date ? t.date.slice(0, 7) : null);
        if (inv) allMonths.add(inv);
      });
      Object.keys(ajustes).forEach(k => {
        if (k.startsWith(card.nome + '|')) allMonths.add(k.split('|')[1]);
      });
      allMonths.add(monthKey);

      const now = new Date();
      const currentCalMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const nextCalMonth = `${now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()}-${String((now.getMonth() + 2) % 12 || 12).padStart(2, '0')}`;
      allMonths.add(currentCalMonth);
      allMonths.add(nextCalMonth);

      const faturasMap = {};
      Array.from(allMonths).sort().reverse().forEach(m => {
        const mKey = `${card.nome}|${m}`;
        const mMatches = cardTxs.filter(t => (t.fatura_mes || (t.date ? t.date.slice(0, 7) : '')) === m);
        const mSoma = mMatches.reduce((a, t) => a + Number(t.amount || 0), 0);
        const mFatura = ajustes[mKey] != null ? Number(ajustes[mKey]) : mSoma;
        const mPaidStatus = faturasPagas[mKey];
        const mIsPaid = typeof mPaidStatus === 'boolean'
          ? mPaidStatus
          : (mMatches.length > 0 && mMatches.every(t => t.pago));

        faturasMap[m] = {
          monthKey: m,
          amount: mFatura,
          somaCompras: mSoma,
          isAjustada: ajustes[mKey] != null,
          isPaga: mIsPaid,
          purchases: mMatches,
        };
      });

      const currentFaturaData = faturasMap[monthKey] || {
        monthKey,
        amount: 0,
        somaCompras: 0,
        isAjustada: false,
        isPaga: false,
        purchases: [],
      };

      const faturaAtual = currentFaturaData.amount;
      const soma = currentFaturaData.somaCompras;
      const isAjustada = currentFaturaData.isAjustada;
      const isPaga = currentFaturaData.isPaga;
      const matches = currentFaturaData.purchases;
      const limite = Number(card.limite || 0);

      // Indicador de Melhor Dia de Compra (dia do fechamento até +3 dias)
      const fechamento = Number(card.fechamento || 3);
      const isMelhorDia = (todayDay >= fechamento && todayDay <= fechamento + 3) ||
                          (fechamento > 27 && (todayDay >= fechamento || todayDay <= (fechamento + 3) % 30));

      // Total de limite comprometido/utilizado no cartão (todas as faturas e parcelas em aberto)
      let totalUtilizado = 0;
      Object.values(faturasMap).forEach(f => {
        if (!f.isPaga && f.amount > 0) {
          totalUtilizado += f.amount;
        }
      });

      const disponivel = Math.max(0, limite - totalUtilizado);
      const percentual = limite > 0 ? (totalUtilizado / limite) * 100 : 0;

      return {
        ...card,
        faturaAtual,
        somaCompras: soma,
        totalUtilizado,
        isAjustada,
        isPaga,
        isMelhorDia,
        totalItems: matches.length,
        purchases: matches,
        disponivel,
        percentual,
        allPurchases,
        faturasMap,
        faturasKeys: Object.keys(faturasMap).sort().reverse(),
      };
    });
  }, [cartoes, transactions, viewDate, ajusteVersion]);

  const pendingUrgentTransactions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limitDate = new Date(today);
    limitDate.setDate(today.getDate() + 7); // Vencidas ou a vencer em até 7 dias

    return transactions.filter(t => {
      if (t.pago || t.type !== 'expense') return false;
      const tDate = new Date(t.date + 'T00:00:00');
      return tDate <= limitDate;
    });
  }, [transactions]);

  const changeMonth = (offset) => {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1, 12, 0, 0);
    setViewDate(next);
  };

  const isCreditTrans = useCallback((t) => {
    if (!t) return false;
    if (t.type === 'income') return false;
    return !!(t.type === 'credit' || t.payment_method === 'credit' || t.card_name);
  }, []);

  const quienDeQuem = useCallback((quem) => {
    if (quem === 'Eu' || quem === 'Comum - Eu') return 'alle';
    if (quem === 'Outro' || quem === 'Comum - Outro') return 'kelly';
    return 'alle';
  }, []);

  const handleAddTransaction = useCallback(async (newTransaction) => {
    const calculatedFat = newTransaction.type === 'credit' && newTransaction.cardName
      ? getCardInvoiceMonth(cartoes.find(c => c && c.nome === newTransaction.cardName), newTransaction.date)
      : null;

    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        description: newTransaction.description,
        amount: newTransaction.amount,
        type: newTransaction.type,
        category: newTransaction.category,
        date: newTransaction.date,
        card_name: newTransaction.cardName,
        fatura_mes: newTransaction.faturaMes || calculatedFat,
        installment_info: newTransaction.installmentInfo,
        pago: newTransaction.type === 'credit' ? false : newTransaction.pago,
        fixa: newTransaction.fixa,
        payment_method: newTransaction.payment_method,
        quem: newTransaction.quem || 'Comum',
        subcategoria: newTransaction.subcategoria || '',
        destino: newTransaction.destino || '',
        ajuste: newTransaction.ajuste || 0,
        pago_por: newTransaction.pago_por || null,
        pago_alle: newTransaction.pago_alle !== undefined ? newTransaction.pago_alle : 0,
        pago_kelly: newTransaction.pago_kelly !== undefined ? newTransaction.pago_kelly : 0,
      }])
      .select();
    if (error) throw error;

    const inserted = data && data[0];
    if (inserted && inserted.pago && !isCreditTrans(inserted)) {
      const isIncome = inserted.type === 'income';
      const sign = isIncome ? 1 : -1;
      const alleVal = Number(inserted.pago_alle || 0);
      const kellyVal = Number(inserted.pago_kelly || 0);

      if (alleVal > 0) deltaSaldo('alle', sign * alleVal);
      if (kellyVal > 0) deltaSaldo('kelly', sign * kellyVal);
      if (alleVal === 0 && kellyVal === 0) {
        const who = quienDeQuem(inserted.quem) || 'alle';
        const amount = Number(inserted.amount || 0);
        deltaSaldo(who, sign * amount);
      }
      setPagoPor(inserted.id, inserted.pago_por || (alleVal > 0 && kellyVal > 0 ? '50_50' : alleVal > 0 ? 'alle' : 'kelly'));
    }

    setTransactions(prev => [data[0], ...prev]);

    notifyFinanceEvent({
      event: 'transaction_created',
      partner1,
      partner2,
      data: inserted || newTransaction,
    });
  }, [isCreditTrans, quienDeQuem, partner1, partner2, cartoes]);

  const handleConvertToTransaction = useCallback(async (wishlistItem) => {
    try {
      const targetMap = {
        'Filhos': 'Filhos',
        [partner1]: 'Eu',
        [partner2]: 'Outro',
        'Casa': 'Comum'
      };
      const quem = targetMap[wishlistItem.target] || 'Comum';
      const newTx = {
        description: wishlistItem.title,
        amount: Number(wishlistItem.price || 0),
        type: 'expense',
        category: wishlistItem.category || 'Compras',
        date: new Date().toISOString().slice(0, 10),
        cardName: null,
        installmentInfo: null,
        pago: true,
        fixa: false,
        payment_method: 'checking',
        quem,
        subcategoria: 'Wishlist',
        destino: wishlistItem.url || '',
        ajuste: 0
      };

      await handleAddTransaction(newTx);
      await handleUpdateWishlist({ ...wishlistItem, status: 'purchased' });
      toast(`Gasto "${wishlistItem.title}" registrado como pago e marcado na lista!`);
    } catch (err) {
      console.error('Error converting wishlist item:', err);
      toast('Erro ao converter: ' + err.message, 'error');
    }
  }, [handleAddTransaction, handleUpdateWishlist, partner1, partner2, toast]);

  const handleBulkAdd = useCallback(async (items, successMessage) => {
    try {
      const CHUNK = 500;
      for (let i = 0; i < items.length; i += CHUNK) {
        const { error } = await supabase.from('transactions').insert(items.slice(i, i + CHUNK));
        if (error) throw error;
      }
      const first = items && items[0];
      if (first && first.pago && !isCreditTrans(first)) {
        const isIncome = first.type === 'income';
        const sign = isIncome ? 1 : -1;
        const alleVal = Number(first.pago_alle || 0);
        const kellyVal = Number(first.pago_kelly || 0);
        if (alleVal > 0) deltaSaldo('alle', sign * alleVal);
        if (kellyVal > 0) deltaSaldo('kelly', sign * kellyVal);
        if (alleVal === 0 && kellyVal === 0) {
          const who = quienDeQuem(first.quem) || 'alle';
          const amount = Number(first.amount || 0);
          deltaSaldo(who, sign * amount);
        }
      }
      await fetchData();
      toast(successMessage || `${items.length} transações adicionadas!`);
    } catch (error) {
      console.error('Error adding transactions:', error.message);
      toast('Erro ao adicionar: ' + error.message, 'error');
    }
  }, [fetchData, toast, isCreditTrans, quienDeQuem]);

  const FIXAS_HORIZON_MONTHS = 24;

  const backfillFixas = useCallback(async () => {
    try {
      const fixas = transactions.filter(t => t && t.fixa && !t.installment_info);
      if (fixas.length === 0) return;
      const now = new Date();
      const horizon = now.getFullYear() * 12 + now.getMonth() + FIXAS_HORIZON_MONTHS;
      const groups = {};
      const takenMonths = {};
      for (const f of fixas) {
        const d = new Date((f.date || '').slice(0, 10) + 'T12:00:00');
        if (isNaN(d.getTime())) continue;
        const key = f.description;
        (groups[key] = groups[key] || []).push(f);
        (takenMonths[key] = takenMonths[key] || new Set()).add(d.getFullYear() * 12 + d.getMonth());
      }
      const inserts = [];
      for (const [key, rows] of Object.entries(groups)) {
        let lastM = -Infinity;
        let ref = null;
        let refRow = null;
        for (const r of rows) {
          const d = new Date((r.date || '').slice(0, 10) + 'T12:00:00');
          if (isNaN(d.getTime())) continue;
          const m = d.getFullYear() * 12 + d.getMonth();
          if (m > lastM) { lastM = m; ref = d; refRow = r; }
        }
        if (!ref) continue;
        const taken = takenMonths[key];
        for (let m = lastM + 1; m <= horizon; m++) {
          if (taken.has(m)) continue;
          const y = Math.floor(m / 12);
          const mo = m % 12;
          const lastDay = new Date(y, mo + 1, 0).getDate();
          inserts.push({
            description: refRow.description,
            amount: refRow.amount,
            type: refRow.type,
            category: refRow.category,
            date: new Date(y, mo, Math.min(ref.getDate(), lastDay), 12, 0, 0).toISOString(),
            fixa: true,
            pago: false,
            payment_method: refRow.payment_method || 'checking',
            quem: refRow.quem || 'Comum',
            subcategoria: refRow.subcategoria || '',
            destino: refRow.destino || '',
            card_name: refRow.type === 'credit' ? refRow.card_name || null : null,
          });
        }
      }
      if (inserts.length === 0) return;
      const CHUNK = 500;
      for (let i = 0; i < inserts.length; i += CHUNK) {
        const { data, error } = await supabase.from('transactions').insert(inserts.slice(i, i + CHUNK)).select();
        if (error) throw error;
        if (data && data.length) setTransactions(prev => [...data, ...prev]);
      }
    } catch (error) {
      console.error('Error backfilling fixas:', error.message);
    }
  }, [transactions]);

  useEffect(() => { backfillFixas(); }, [backfillFixas]);

  const handleImportTransactions = useCallback(async (items) => {
    await handleBulkAdd(items, `${items.length} transações importadas com sucesso!`);
  }, [handleBulkAdd]);

  const confirmDeleteTransaction = useCallback(async () => {
    if (!txToDelete) return;
    const deletedTx = transactions.find(t => t.id === txToDelete);
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', txToDelete);
      if (error) throw error;
      setTransactions(prev => prev.filter(t => t.id !== txToDelete));
      await logAudit({ action: 'delete', entity: 'transaction', entityId: txToDelete, description: 'Transação excluída' });
      notifyFinanceEvent({
        event: 'transaction_deleted',
        partner1,
        partner2,
        data: deletedTx || { id: txToDelete },
      });
      toast('Transação excluída.');
      setTxToDelete(null);
    } catch (error) {
      console.error('Error deleting transaction:', error.message);
      toast('Erro ao excluir: ' + error.message, 'error');
    }
  }, [txToDelete, transactions, toast, partner1, partner2]);

  const handleResetAllTransactions = useCallback(async () => {
    try {
      setPendingReset(false);
      if (pinHash) {
        const unlocked = await verifyPin(resetPin, pinHash);
        if (!unlocked) {
          toast('PIN incorreto. Operação cancelada.', 'error');
          setPendingReset(false);
          return;
        }
      }
      const { error } = await supabase
        .from('transactions')
        .delete()
        .not('id', 'is', null);
      if (error) throw error;
      setTransactions([]);
      setIsResetModalOpen(false);
      setResetConfirmInput('');
      setResetPin('');
      await logAudit({ action: 'reset_all', entity: 'transaction', description: 'Todas as transações foram apagadas (reset)' });
      toast('Todas as transações foram apagadas.');
    } catch (error) {
      console.error('Error resetting transactions:', error.message);
      toast('Erro ao resetar transações: ' + error.message, 'error');
    } finally {
      setPendingReset(false);
    }
  }, [toast, pinHash, resetPin]);

  const handlePayInvoice = useCallback(async (cardName, targetStatus, customMonthKey = null) => {
    try {
      const viewMonth = viewDate.getMonth();
      const viewYear = viewDate.getFullYear();
      const defaultMonthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
      const monthKey = customMonthKey || defaultMonthKey;
      const key = `${cardName}|${monthKey}`;
      
      const ajustes = getAjustesFaturas();
      const cardTxs = transactions.filter(t => {
        if (!t || !t.date) return false;
        if (t.card_name !== cardName || t.type !== 'credit') return false;
        const tInvoice = t.fatura_mes || (t.date ? t.date.slice(0, 7) : null);
        return tInvoice === monthKey;
      });

      const soma = cardTxs.reduce((acc, t) => acc + Number(t.amount || 0), 0);
      const ajustado = ajustes[key];
      const faturaTotal = ajustado != null ? Number(ajustado) : soma;

      if (targetStatus) {
        if (faturaTotal <= 0 && cardTxs.length === 0) {
          toast(`Nenhuma compra ou valor de fatura encontrado para o cartão ${cardName} no mês selecionado.`, 'error');
          return;
        }
        setPendingPayInvoice({
          cardName,
          faturaTotal,
          monthKey,
          txIds: cardTxs.map(t => t.id)
        });
      } else {
        const txIds = cardTxs.map(t => t.id);
        if (txIds.length > 0) {
          const { error } = await supabase
            .from('transactions')
            .update({ pago: false })
            .in('id', txIds);
          if (error) throw error;
        }

        setTransactions(prev => prev.map(t => txIds.includes(t.id) ? { ...t, pago: false } : t));

        const faturasPagas = getFaturasPagas();
        faturasPagas[key] = false;
        if (typeof window !== 'undefined') {
          localStorage.setItem('fincasal_faturas_pagas', JSON.stringify(faturasPagas));
        }
        saveCloudSetting('faturas_pagas', faturasPagas);

        const who = getPagoPor(`fatura|${key}`);
        if (who && faturaTotal > 0) {
          if (who === '50_50') {
            const half = Math.round((faturaTotal / 2) * 100) / 100;
            const rest = Math.round((faturaTotal - half) * 100) / 100;
            deltaSaldo('alle', half);
            deltaSaldo('kelly', rest);
            toast(`Fatura do ${cardName} reaberta: valores estornados aos saldos de ${partner1} e ${partner2}.`);
          } else {
            deltaSaldo(who, faturaTotal);
            const whoName = who === 'alle' ? partner1 : partner2;
            const formatted = faturaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            toast(`Fatura do ${cardName} reaberta: ${formatted} estornado para o saldo de ${whoName}.`);
          }
          setPagoPor(`fatura|${key}`, null);
        } else {
          toast(`Fatura do ${cardName} reaberta.`);
        }
        setAjusteVersion(v => v + 1);
        await logAudit({ action: 'reopen_invoice', entity: 'card', entityId: key, description: `Fatura ${cardName} reaberta` });
        notifyFinanceEvent({
          event: 'invoice_reopened',
          partner1,
          partner2,
          data: {
            cartao: cardName,
            valorFatura: faturaTotal,
            mes: monthKey,
          },
        });
      }
    } catch (error) {
      console.error('Error updating invoice status:', error.message);
      toast('Erro ao atualizar fatura: ' + error.message, 'error');
    }
  }, [transactions, viewDate, toast, partner1, partner2, cartoes]);

  const confirmPayInvoice = useCallback(async (whoPaid) => {
    if (!pendingPayInvoice) return;
    const { cardName, faturaTotal, monthKey, txIds } = pendingPayInvoice;
    const key = `${cardName}|${monthKey}`;
    setPendingPayInvoice(null);

    try {
      if (txIds.length > 0) {
        const { error } = await supabase
          .from('transactions')
          .update({ pago: true })
          .in('id', txIds);
        if (error) throw error;
      }

      setTransactions(prev => prev.map(t => txIds.includes(t.id) ? { ...t, pago: true } : t));

      const faturasPagas = getFaturasPagas();
      faturasPagas[key] = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('fincasal_faturas_pagas', JSON.stringify(faturasPagas));
      }
      saveCloudSetting('faturas_pagas', faturasPagas);

      if (whoPaid && faturaTotal > 0) {
        if (whoPaid === '50_50') {
          const half = Math.round((faturaTotal / 2) * 100) / 100;
          const rest = Math.round((faturaTotal - half) * 100) / 100;
          deltaSaldo('alle', -half);
          deltaSaldo('kelly', -rest);
          setPagoPor(`fatura|${key}`, '50_50');
          const fmtHalf = half.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          toast(`Fatura do ${cardName} paga e dividida 50/50 (${fmtHalf} de cada saldo)!`);
        } else {
          deltaSaldo(whoPaid, -faturaTotal);
          setPagoPor(`fatura|${key}`, whoPaid);
          const whoName = whoPaid === 'alle' ? partner1 : partner2;
          const formatted = faturaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          toast(`Fatura do ${cardName} (${formatted}) paga e debitada do saldo de ${whoName}!`);
        }
      }

      setAjusteVersion(v => v + 1);

      await logAudit({ action: 'pay_invoice', entity: 'card', entityId: key, description: `Fatura ${cardName} paga (${whoPaid})` });

      notifyFinanceEvent({
        event: 'invoice_paid',
        partner1,
        partner2,
        data: {
          cartao: cardName,
          valorFatura: faturaTotal,
          mes: monthKey,
          quemPagou: whoPaid === '50_50' ? '50/50 (Ambos)' : whoPaid === 'alle' ? partner1 : partner2,
        },
      });
    } catch (error) {
      console.error('Error paying invoice:', error.message);
      toast('Erro ao pagar fatura: ' + error.message, 'error');
    }
  }, [pendingPayInvoice, toast, partner1, partner2]);

  const cancelPayInvoice = useCallback(() => {
    setPendingPayInvoice(null);
  }, []);

  const openFaturaAdjust = (card) => {
    const ajustes = getAjustesFaturas();
    const month = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    const key = `${card.nome}|${month}`;
    const existing = ajustes[key];
    setReajusteFatura({
      cardName: card.nome,
      month,
      value: existing != null ? String(existing) : (card.faturaAtual > 0 ? String(card.faturaAtual) : ''),
      hasAdjust: existing != null
    });
  };

  const saveFaturaAdjust = useCallback((e) => {
    e.preventDefault();
    if (!reajusteFatura) return;
    const value = Math.max(0, parseFloat(String(reajusteFatura.value).replace(',', '.')) || 0);
    const ajustes = getAjustesFaturas();
    const key = `${reajusteFatura.cardName}|${reajusteFatura.month}`;
    if (value > 0) {
      ajustes[key] = value;
    } else {
      delete ajustes[key];
    }
    localStorage.setItem('fincasal_ajustes_faturas', JSON.stringify(ajustes));
    saveCloudSetting('ajustes_faturas', ajustes);
    setAjusteVersion(v => v + 1);
    setReajusteFatura(null);
    toast(value > 0
      ? `Fatura de ${reajusteFatura.cardName} ajustada para R$ ${value.toFixed(2).replace('.', ',')}.`
      : `Ajuste da fatura de ${reajusteFatura.cardName} removido.`);
  }, [reajusteFatura, toast]);

  const doMarkPaid = useCallback(async (id, paymentData) => {
    const t = transactions.find(x => x.id === id);
    if (!t) return;
    const isCredit = isCreditTrans(t);
    const isKellySalary = (t.description === 'Salário Kelly' || t.description === 'Salario Kelly');
    const targetMonth = (t.date || '').slice(0, 7);
    const amount = Number(t.amount || 0);

    let whoPaid = '50_50';
    let alleAmount = 0;
    let kellyAmount = 0;

    if (typeof paymentData === 'string') {
      if (paymentData === 'alle') {
        whoPaid = 'alle';
        alleAmount = amount;
        kellyAmount = 0;
      } else if (paymentData === 'kelly') {
        whoPaid = 'kelly';
        alleAmount = 0;
        kellyAmount = amount;
      } else {
        whoPaid = '50_50';
        alleAmount = Math.round((amount / 2) * 100) / 100;
        kellyAmount = Math.round((amount - alleAmount) * 100) / 100;
      }
    } else if (paymentData && typeof paymentData === 'object') {
      whoPaid = paymentData.whoPaid || '50_50';
      alleAmount = Number(paymentData.alleAmount || 0);
      kellyAmount = Number(paymentData.kellyAmount || 0);
    } else {
      if (t.quem === 'Eu') {
        whoPaid = 'alle';
        alleAmount = amount;
        kellyAmount = 0;
      } else if (t.quem === 'Outro') {
        whoPaid = 'kelly';
        alleAmount = 0;
        kellyAmount = amount;
      } else {
        whoPaid = '50_50';
        alleAmount = Math.round((amount / 2) * 100) / 100;
        kellyAmount = Math.round((amount - alleAmount) * 100) / 100;
      }
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          pago: true,
          pago_por: whoPaid,
          pago_alle: alleAmount,
          pago_kelly: kellyAmount
        })
        .eq('id', id);
      if (error) throw error;

      let linkedIds = [];
      if (isKellySalary && targetMonth) {
        const payrollDescriptions = ['Unimed SISMUSA', 'Consignado Sicoob 02', 'Consignado Sicoob 03', 'Sindicato dos Servidores'];
        const linkedPending = transactions.filter(x => 
          x.id !== id && 
          x.quem === 'Outro' && 
          (x.date || '').slice(0, 7) === targetMonth && 
          !x.pago && 
          payrollDescriptions.includes(x.description)
        );
        if (linkedPending.length > 0) {
          linkedIds = linkedPending.map(x => x.id);
          try {
            await supabase.from('transactions').update({
              pago: true,
              pago_por: 'kelly',
              pago_alle: 0,
              pago_kelly: item.amount
            }).in('id', linkedIds);
            for (const item of linkedPending) {
              deltaSaldo('kelly', -1 * Number(item.amount || 0));
              setPagoPor(item.id, 'kelly');
            }
          } catch (err) {
            console.error('Error auto-paying Kelly payroll deductions:', err);
          }
        }
      }

      setTransactions(prev => prev.map(x => {
        if (x.id === id) {
          return {
            ...x,
            pago: true,
            pago_por: whoPaid,
            pago_alle: alleAmount,
            pago_kelly: kellyAmount
          };
        }
        if (linkedIds.includes(x.id)) {
          return {
            ...x,
            pago: true,
            pago_por: 'kelly',
            pago_alle: 0,
            pago_kelly: Number(x.amount || 0)
          };
        }
        return x;
      }));

      if (t && !isCredit) {
        const isIncome = t.type === 'income';
        const sign = isIncome ? 1 : -1;
        if (alleAmount > 0) deltaSaldo('alle', sign * alleAmount);
        if (kellyAmount > 0) deltaSaldo('kelly', sign * kellyAmount);
        setPagoPor(id, whoPaid);

        const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        if (isKellySalary && linkedIds.length > 0) {
          toast(`Salário de Kelly recebido! Descontos em folha efetivados automaticamente.`);
        } else if (whoPaid === '50_50') {
          toast(`${isIncome ? 'Receita' : 'Despesa'} dividida 50/50: ${fmt(alleAmount)} no saldo de ${partner1} e ${fmt(kellyAmount)} no de ${partner2}!`);
        } else if (whoPaid === 'custom') {
          toast(`${isIncome ? 'Receita' : 'Despesa'} registrada com rateio: ${partner1} ${fmt(alleAmount)} | ${partner2} ${fmt(kellyAmount)}.`);
        } else {
          const whoName = whoPaid === 'alle' ? partner1 : partner2;
          const paidVal = whoPaid === 'alle' ? alleAmount : kellyAmount;
          toast(`${isIncome ? 'Receita' : 'Despesa'} de ${fmt(paidVal)} registrada no saldo de ${whoName}!`);
        }
      } else {
        toast('Transação marcada como paga!');
      }

      await logAudit({ action: 'mark_paid', entity: 'transaction', entityId: id, description: `Marcado como pago (${whoPaid})` });

      notifyFinanceEvent({
        event: 'transaction_paid',
        partner1,
        partner2,
        data: {
          id,
          descricao: t ? t.description : 'Transação',
          valor: t ? t.amount : 0,
          tipo: t ? t.type : 'expense',
          categoria: t ? t.category : '',
          data: t ? t.date : '',
          pago: true,
          whoPaid,
          alleAmount,
          kellyAmount,
        },
      });

      if (t && t.fixa && !t.installment_info) {
        const d = new Date((t.date || '').slice(0, 10) + 'T12:00:00');
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 2, 0).getDate();
        const nextDate = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), lastDay), 12, 0, 0);
        const nextKey = nextDate.toISOString().slice(0, 7);
        const exists = transactions.some(x => x.fixa && !x.installment_info && x.description === t.description && x.date && x.date.slice(0, 7) === nextKey);
        if (!exists) {
          const { data, error: insErr } = await supabase
            .from('transactions')
            .insert([{
              description: t.description,
              amount: t.amount,
              type: t.type,
              category: t.category,
              date: nextDate.toISOString(),
              fixa: true,
              pago: false,
              payment_method: t.payment_method || 'checking',
              quem: t.quem || 'Comum',
              subcategoria: t.subcategoria || '',
              destino: t.destino || '',
              card_name: t.type === 'credit' ? t.card_name || null : null,
              pago_por: null,
              pago_alle: 0,
              pago_kelly: 0,
            }])
            .select();
          if (insErr) throw insErr;
          if (data && data[0]) setTransactions(prev => [data[0], ...prev]);
        }
      }
    } catch (error) {
      console.error('Error updating transaction status:', error.message);
      toast('Erro ao atualizar transação: ' + error.message, 'error');
    }
  }, [transactions, toast, isCreditTrans, partner1, partner2]);

  const doMarkUnpaid = useCallback(async (id) => {
    const target = transactions.find(t => t.id === id);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          pago: false,
          pago_por: null,
          pago_alle: 0,
          pago_kelly: 0
        })
        .eq('id', id);
      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === id ? {
        ...t,
        pago: false,
        pago_por: null,
        pago_alle: 0,
        pago_kelly: 0
      } : t));
      await logAudit({ action: 'mark_unpaid', entity: 'transaction', entityId: id, description: 'Marcado como não pago' });
      notifyFinanceEvent({
        event: 'transaction_updated',
        partner1,
        partner2,
        data: {
          id,
          descricao: target ? target.description : 'Transação',
          valor: target ? target.amount : 0,
          pago: false,
          status: 'Reaberta / Pendente',
        },
      });
    } catch (error) {
      console.error('Error updating transaction status:', error.message);
      toast('Erro ao atualizar transação: ' + error.message, 'error');
    }
  }, [transactions, toast, partner1, partner2]);

  const handleTogglePaid = useCallback((id, newStatus) => {
    const t = transactions.find(x => x.id === id);
    const isCredit = isCreditTrans(t);
    const isKellySalary = t && (t.description === 'Salário Kelly' || t.description === 'Salario Kelly');
    const targetMonth = (t && t.date ? t.date : '').slice(0, 7);

    if (newStatus) {
      if (!isCredit) {
        setPendingPaidTx(id);
        return;
      }
      doMarkPaid(id);
      return;
    }

    let linkedUnpaidIds = [];
    if (isKellySalary && targetMonth) {
      const payrollDescriptions = ['Unimed SISMUSA', 'Consignado Sicoob 02', 'Consignado Sicoob 03', 'Sindicato dos Servidores'];
      const linkedPaid = transactions.filter(x => 
        x.id !== id && 
        x.quem === 'Outro' && 
        (x.date || '').slice(0, 7) === targetMonth && 
        x.pago && 
        payrollDescriptions.includes(x.description)
      );
      if (linkedPaid.length > 0) {
        linkedUnpaidIds = linkedPaid.map(x => x.id);
        (async () => {
          try {
            await supabase.from('transactions').update({
              pago: false,
              pago_por: null,
              pago_alle: 0,
              pago_kelly: 0
            }).in('id', linkedUnpaidIds);
            for (const item of linkedPaid) {
              deltaSaldo('kelly', Number(item.amount || 0));
              setPagoPor(item.id, null);
            }
          } catch (err) {
            console.error('Error auto-unpaying Kelly payroll deductions:', err);
          }
        })();
      }
    }

    if (!isCredit && t) {
      const isIncome = t.type === 'income';
      const sign = isIncome ? -1 : 1;
      const alleVal = Number(t.pago_alle || 0);
      const kellyVal = Number(t.pago_kelly || 0);

      if (alleVal > 0 || kellyVal > 0) {
        if (alleVal > 0) deltaSaldo('alle', sign * alleVal);
        if (kellyVal > 0) deltaSaldo('kelly', sign * kellyVal);
        setPagoPor(id, null);
        toast('Transação desmarcada: valores estornados aos saldos em conta.');
      } else {
        const who = getPagoPor(id) || (t.quem === 'Eu' ? 'alle' : t.quem === 'Outro' ? 'kelly' : null);
        if (who) {
          const amount = Number(t.amount || 0);
          deltaSaldo(who, sign * amount);
          setPagoPor(id, null);
          const whoName = who === 'alle' ? partner1 : partner2;
          toast(`Transação desmarcada: estornado para o saldo de ${whoName}.`);
        } else {
          toast('Transação marcada como pendente.');
        }
      }
    }
    doMarkUnpaid(id);
    if (linkedUnpaidIds.length > 0) {
      setTransactions(prev => prev.map(x => linkedUnpaidIds.includes(x.id) ? {
        ...x,
        pago: false,
        pago_por: null,
        pago_alle: 0,
        pago_kelly: 0
      } : x));
    }
  }, [transactions, doMarkPaid, doMarkUnpaid, isCreditTrans, partner1, partner2, toast]);

  const confirmPaidWho = useCallback((paymentData) => {
    const id = pendingPaidTx;
    setPendingPaidTx(null);
    setCustomPayMode(false);
    setCustomPayAlle('');
    setCustomPayKelly('');
    if (id) doMarkPaid(id, paymentData);
  }, [pendingPaidTx, doMarkPaid]);

  const cancelPaidWho = useCallback(() => {
    setPendingPaidTx(null);
    setCustomPayMode(false);
    setCustomPayAlle('');
    setCustomPayKelly('');
  }, []);

  const handleAdjustAmount = useCallback(async (id, amount) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ amount })
        .eq('id', id);
      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, amount } : t));
      toast('Valor ajustado para ' + amount.toFixed(2).replace('.', ','));
      await logAudit({ action: 'adjust_amount', entity: 'transaction', entityId: id, description: `Valor ajustado para ${amount.toFixed(2)}` });
    } catch (error) {
      console.error('Error adjusting amount:', error.message);
      toast('Erro ao ajustar valor: ' + error.message, 'error');
    }
  }, [toast]);

  const handleDeleteByIds = useCallback(async (ids) => {
    if (!ids || ids.length === 0) return true;
    try {
      const { error } = await supabase.from('transactions').delete().in('id', ids);
      if (error) throw error;
      setTransactions(prev => prev.filter(t => !ids.includes(t.id)));
      toast('Registros excluídos com sucesso!');
      return true;
    } catch (error) {
      console.error('Error deleting by IDs:', error.message);
      toast('Erro ao excluir: ' + error.message, 'error');
      return false;
    }
  }, [toast]);

  const executeTransactionUpdate = useCallback(async (scope, editData) => {
    if (!editData) return;
    const { targetTx, newValues, origTx, isParcela, isFixa, parcN, parcTotal, needsSplit, valorTipo, amount } = editData;
    const base = newValues.amount;
    const origDesc = targetTx._origDescription || (origTx && origTx.description) || targetTx.description;
    const targetMonth = (targetTx.date || '').slice(0, 7);

    try {
      const isPaid = !!newValues.pago;
      let pagoPorVal = targetTx.pago_por;
      let pagoAlleVal = targetTx.pago_alle !== undefined ? Number(targetTx.pago_alle) : 0;
      let pagoKellyVal = targetTx.pago_kelly !== undefined ? Number(targetTx.pago_kelly) : 0;

      if (!isPaid) {
        pagoPorVal = null;
        pagoAlleVal = 0;
        pagoKellyVal = 0;
      } else if (newValues.pago_por) {
        pagoPorVal = newValues.pago_por;
        pagoAlleVal = Number(newValues.pago_alle || 0);
        pagoKellyVal = Number(newValues.pago_kelly || 0);
      } else if (!pagoPorVal) {
        if (newValues.quem === 'Eu') {
          pagoPorVal = 'alle'; pagoAlleVal = base; pagoKellyVal = 0;
        } else if (newValues.quem === 'Outro') {
          pagoPorVal = 'kelly'; pagoAlleVal = 0; pagoKellyVal = base;
        } else {
          pagoPorVal = '50_50';
          pagoAlleVal = Math.round((base / 2) * 100) / 100;
          pagoKellyVal = Math.round((base - pagoAlleVal) * 100) / 100;
        }
      }

      const payload = {
        description: newValues.description,
        amount: base,
        type: newValues.type,
        date: newValues.date,
        category: newValues.category,
        subcategoria: newValues.subcategoria || '',
        quem: newValues.quem || 'Comum',
        destino: newValues.destino || '',
        pago: isPaid,
        fixa: !!newValues.fixa,
        payment_method: newValues.payment_method || 'checking',
        card_name: newValues.type === 'credit' ? newValues.card_name || null : null,
        fatura_mes: newValues.type === 'credit' ? (newValues.fatura_mes || null) : null,
        installment_info: newValues.installment_info || null,
        pago_por: pagoPorVal,
        pago_alle: pagoAlleVal,
        pago_kelly: pagoKellyVal,
      };

      const siblingFields = {
        description: newValues.description,
        amount: base,
        type: newValues.type,
        category: newValues.category,
        subcategoria: newValues.subcategoria || '',
        quem: newValues.quem || 'Comum',
        destino: newValues.destino || '',
        payment_method: newValues.payment_method || 'checking',
        card_name: newValues.type === 'credit' ? newValues.card_name || null : null,
        fatura_mes: newValues.type === 'credit' ? (newValues.fatura_mes || null) : null,
        fixa: !!newValues.fixa,
      };

      let created = [];
      if (needsSplit) {
        const lastAmount = valorTipo === 'parcela'
          ? amount
          : Math.round((amount - base * (parcTotal - 1)) * 100) / 100;
        const baseDate = new Date((targetTx.date || new Date().toISOString().slice(0, 10)) + 'T12:00:00');
        const inserts = [];
        for (let i = 1; i <= parcTotal; i++) {
          if (i === parcN) continue;
          const d = new Date(baseDate);
          d.setMonth(d.getMonth() + (i - parcN));
          inserts.push({
            description: newValues.description,
            amount: i === parcTotal ? lastAmount : base,
            type: newValues.type,
            category: newValues.category,
            subcategoria: newValues.subcategoria || '',
            date: d.toISOString(),
            fixa: !!newValues.fixa,
            pago: false,
            payment_method: newValues.payment_method || 'checking',
            quem: newValues.quem || 'Comum',
            destino: newValues.destino || '',
            installment_info: `${i}/${parcTotal}`,
            card_name: newValues.type === 'credit' ? newValues.card_name || null : null,
            fatura_mes: newValues.type === 'credit' ? (newValues.fatura_mes || null) : null,
          });
        }
        const { data: ins, error: insErr } = await supabase.from('transactions').insert(inserts).select();
        if (insErr) throw insErr;
        created = ins || [];
      }

      let updatedCount = 1;

      if (scope === 'single' || needsSplit) {
        const { error } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', targetTx.id);
        if (error) throw error;

        setTransactions(prev => {
          const rest = prev.map(t => t.id === targetTx.id ? { ...t, ...payload } : t);
          return needsSplit ? [...rest, ...created] : rest;
        });

        toast(needsSplit
          ? `Transação dividida em ${parcTotal} parcelas mensais!`
          : 'Transação atualizada com sucesso!');
      } else if (scope === 'future') {
        let siblingIds = [];
        if (isParcela) {
          const m = String(targetTx.installment_info || '').match(/^(\d+)\/(\d+)$/);
          const currentN = m ? parseInt(m[1], 10) : parcN;
          const totalN = m ? m[2] : String(parcTotal);
          siblingIds = transactions
            .filter(t => {
              if (t.id === targetTx.id) return false;
              if (t.description !== origDesc) return false;
              const sm = String(t.installment_info || '').match(/^(\d+)\/(\d+)$/);
              return sm && sm[2] === totalN && parseInt(sm[1], 10) >= currentN;
            })
            .map(t => t.id);
        } else {
          siblingIds = transactions
            .filter(t => {
              if (t.id === targetTx.id) return false;
              if (t.description !== origDesc) return false;
              const mDate = (t.date || '').slice(0, 7);
              return mDate >= targetMonth;
            })
            .map(t => t.id);
        }

        const { error: targetErr } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', targetTx.id);
        if (targetErr) throw targetErr;

        if (siblingIds.length > 0) {
          const { error: sibErr } = await supabase
            .from('transactions')
            .update(siblingFields)
            .in('id', siblingIds);
          if (sibErr) throw sibErr;
        }

        updatedCount = 1 + siblingIds.length;
        setTransactions(prev => prev.map(t => {
          if (t.id === targetTx.id) return { ...t, ...payload };
          if (siblingIds.includes(t.id)) return { ...t, ...siblingFields };
          return t;
        }));

        toast(`Este lançamento e mais ${siblingIds.length} meses/parcelas futuras foram atualizados!`);
      } else if (scope === 'all') {
        let siblingIds = [];
        if (isParcela) {
          const m = String(targetTx.installment_info || '').match(/^(\d+)\/(\d+)$/);
          const totalN = m ? m[2] : String(parcTotal);
          siblingIds = transactions
            .filter(t => {
              if (t.id === targetTx.id) return false;
              if (t.description !== origDesc) return false;
              if (!totalN) return true;
              const sm = String(t.installment_info || '').match(/^(\d+)\/(\d+)$/);
              return sm && sm[2] === totalN;
            })
            .map(t => t.id);
        } else {
          siblingIds = transactions
            .filter(t => {
              if (t.id === targetTx.id) return false;
              return t.description === origDesc && (t.fixa || t.type === targetTx.type);
            })
            .map(t => t.id);
        }

        const { error: targetErr } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', targetTx.id);
        if (targetErr) throw targetErr;

        if (siblingIds.length > 0) {
          const { error: sibErr } = await supabase
            .from('transactions')
            .update(siblingFields)
            .in('id', siblingIds);
          if (sibErr) throw sibErr;
        }

        updatedCount = 1 + siblingIds.length;
        setTransactions(prev => prev.map(t => {
          if (t.id === targetTx.id) return { ...t, ...payload };
          if (siblingIds.includes(t.id)) return { ...t, ...siblingFields };
          return t;
        }));

        toast(`Todas as ${updatedCount} ocorrências de "${origDesc}" foram atualizadas!`);
      }

      const isCredit = isCreditTrans(payload);
      if (!isCredit && origTx) {
        const wasPaid = !!origTx.pago;
        const willBePaid = !!payload.pago;
        const sign = payload.type === 'income' ? 1 : -1;

        const oldAlle = Number(origTx.pago_alle || 0);
        const oldKelly = Number(origTx.pago_kelly || 0);
        const newAlle = Number(payload.pago_alle || 0);
        const newKelly = Number(payload.pago_kelly || 0);

        if (!wasPaid && willBePaid) {
          if (newAlle > 0) deltaSaldo('alle', sign * newAlle);
          if (newKelly > 0) deltaSaldo('kelly', sign * newKelly);
          if (newAlle === 0 && newKelly === 0) {
            const who = payload.pago_por || quienDeQuem(payload.quem) || 'alle';
            deltaSaldo(who, sign * Number(payload.amount || 0));
          }
          setPagoPor(targetTx.id, payload.pago_por || '50_50');
        } else if (wasPaid && !willBePaid) {
          if (oldAlle > 0) deltaSaldo('alle', -sign * oldAlle);
          if (oldKelly > 0) deltaSaldo('kelly', -sign * oldKelly);
          if (oldAlle === 0 && oldKelly === 0) {
            const who = getPagoPor(origTx.id) || quienDeQuem(origTx.quem) || 'alle';
            deltaSaldo(who, -sign * Number(origTx.amount || 0));
          }
          setPagoPor(targetTx.id, null);
        } else if (wasPaid && willBePaid) {
          const diffAlle = newAlle - oldAlle;
          const diffKelly = newKelly - oldKelly;
          if (diffAlle !== 0) deltaSaldo('alle', sign * diffAlle);
          if (diffKelly !== 0) deltaSaldo('kelly', sign * diffKelly);
          setPagoPor(targetTx.id, payload.pago_por || '50_50');
        }
      }

      await logAudit({
        action: needsSplit ? 'split' : 'update',
        entity: 'transaction',
        entityId: targetTx.id,
        description: (needsSplit ? `Dividido em ${parcTotal} parcelas` : `Atualizado (${scope})`) + `: ${newValues.description} (${base.toFixed(2)}) - ${updatedCount} afetados`,
        meta: { amount: base, installment_info: payload.installment_info, scope },
      });

      notifyFinanceEvent({
        event: 'transaction_updated',
        partner1,
        partner2,
        data: {
          id: targetTx.id,
          descricaoAnterior: targetTx.description,
          novaDescricao: newValues.description,
          valorAnterior: targetTx.amount,
          novoValor: base,
          tipo: newValues.type,
          categoria: newValues.category,
          subcategoria: newValues.subcategoria,
          quem: newValues.quem,
          pago: payload.pago,
          data: newValues.date,
          escopo: scope,
        },
      });

      setPendingEditScope(null);
      setEditingTransaction(null);
    } catch (error) {
      console.error('Error updating transaction:', error.message);
      toast('Erro ao atualizar: ' + error.message, 'error');
    }
  }, [transactions, toast, isCreditTrans, quienDeQuem]);

  const handleDeleteTransaction = useCallback(async (tx, scope = 'single') => {
    if (!tx) return;
    try {
      const txId = typeof tx === 'object' ? tx.id : tx;
      const txObj = typeof tx === 'object' ? tx : transactions.find(t => t.id === txId);
      
      if (!txObj) {
        const { error } = await supabase.from('transactions').delete().eq('id', txId);
        if (error) throw error;
        setTransactions(prev => prev.filter(t => t.id !== txId));
        toast('Transação excluída com sucesso!');
        setTxToDelete(null);
        return;
      }

      const desc = txObj.description;
      const isFixa = !!txObj.fixa;
      const isParcela = !!txObj.installment_info;
      const targetMonth = (txObj.date || '').slice(0, 7);

      const sameDescTxs = transactions.filter(t => t.description === desc && (t.type === txObj.type || t.fixa));
      const isRecurring = isFixa || isParcela || sameDescTxs.length > 1;

      if (scope === 'single' || !isRecurring) {
        // 1. Excluir somente esta
        const { error } = await supabase.from('transactions').delete().eq('id', txObj.id);
        if (error) throw error;
        setTransactions(prev => prev.filter(t => t.id !== txObj.id));
        toast('Lançamento excluído com sucesso!');
      } else if (scope === 'future') {
        // 2. Excluir deste mês em diante
        let idsToDelete = [txObj.id];
        if (isParcela) {
          const m = String(txObj.installment_info).match(/^(\d+)\/(\d+)$/);
          if (m) {
            const currentN = parseInt(m[1], 10);
            const totalN = m[2];
            const siblings = transactions.filter(t => {
              if (t.description !== desc) return false;
              const sm = String(t.installment_info || '').match(/^(\d+)\/(\d+)$/);
              return sm && sm[2] === totalN && parseInt(sm[1], 10) >= currentN;
            });
            idsToDelete = siblings.map(t => t.id);
          }
        } else {
          const matching = transactions.filter(t => {
            if (t.description !== desc) return false;
            const mDate = (t.date || '').slice(0, 7);
            return mDate >= targetMonth;
          });
          idsToDelete = matching.map(t => t.id);
        }

        const { error } = await supabase.from('transactions').delete().in('id', idsToDelete);
        if (error) throw error;
        setTransactions(prev => prev.filter(t => !idsToDelete.includes(t.id)));
        toast(`${idsToDelete.length} ${idsToDelete.length === 1 ? 'lançamento excluído' : 'lançamentos excluídos'} deste mês em diante!`);
      } else if (scope === 'all') {
        // 3. Excluir todas as ocorrências
        let idsToDelete = [txObj.id];
        if (isParcela) {
          const m = String(txObj.installment_info).match(/^(\d+)\/(\d+)$/);
          const totalN = m ? m[2] : '';
          const siblings = transactions.filter(t => {
            if (t.description !== desc) return false;
            if (!totalN) return true;
            const sm = String(t.installment_info || '').match(/^(\d+)\/(\d+)$/);
            return sm && sm[2] === totalN;
          });
          idsToDelete = siblings.map(t => t.id);
        } else {
          const matching = transactions.filter(t => t.description === desc && (t.type === txObj.type || t.fixa));
          idsToDelete = matching.map(t => t.id);
        }

        const { error } = await supabase.from('transactions').delete().in('id', idsToDelete);
        if (error) throw error;
        setTransactions(prev => prev.filter(t => !idsToDelete.includes(t.id)));
        toast(`Todas as ${idsToDelete.length} ocorrências de "${desc}" foram excluídas!`);
      }
      notifyFinanceEvent({
        event: 'transaction_deleted',
        partner1,
        partner2,
        data: {
          description: txObj ? txObj.description : 'Transação',
          amount: txObj ? txObj.amount : 0,
          category: txObj ? txObj.category : '',
        },
      });

      setTxToDelete(null);
    } catch (error) {
      console.error('Error deleting transaction:', error.message);
      toast('Erro ao excluir transação: ' + error.message, 'error');
    }
  }, [transactions, toast, partner1, partner2]);

  const handleUpdateTransaction = useCallback((e) => {
    e.preventDefault();
    if (!editingTransaction) return;
    const amount = Math.max(0, parseFloat(String(editingTransaction.amount).replace(',', '.')) || 0);
    if (amount <= 0) {
      toast('Informe um valor válido.', 'error');
      return;
    }
    const isParcela = !!editingTransaction.isParcela;
    const parcN = Math.max(1, parseInt(editingTransaction.parcelaN, 10) || 1);
    const parcTotal = parseInt(editingTransaction.parcelaTotal, 10) || 0;
    const validParcela = isParcela && parcTotal >= parcN && parcTotal > 0;
    const installment_info = validParcela ? `${parcN}/${parcTotal}` : null;

    const origTx = transactions.find(t => t.id === editingTransaction.id);
    const origDesc = editingTransaction._origDescription || (origTx && origTx.description) || editingTransaction.description;

    let siblings = [];
    if (validParcela && parcTotal > 1) {
      const re = new RegExp(`^(\\d+)/${parcTotal}$`);
      siblings = transactions.filter(t => t.id !== editingTransaction.id && t.description === origDesc && re.test(String(t.installment_info || '')));
    } else {
      siblings = transactions.filter(t => t.id !== editingTransaction.id && t.description === origDesc && (t.fixa || t.type === editingTransaction.type));
    }

    const needsSplit = validParcela && parcTotal > 1 && siblings.length === 0;
    const valorTipo = editingTransaction.valorTipo === 'parcela' ? 'parcela' : 'total';
    const base = needsSplit
      ? (valorTipo === 'parcela' ? amount : Math.round((amount / parcTotal) * 100) / 100)
      : amount;

    const newValues = {
      description: editingTransaction.description,
      amount: base,
      type: editingTransaction.type,
      date: new Date((editingTransaction.date || new Date().toISOString().slice(0, 10)) + 'T12:00:00').toISOString(),
      category: editingTransaction.category,
      subcategoria: editingTransaction.subcategoria || '',
      quem: editingTransaction.quem || 'Comum',
      destino: editingTransaction.destino || '',
      pago: !!editingTransaction.pago,
      fixa: !!editingTransaction.fixa,
      payment_method: editingTransaction.payment_method || 'checking',
      card_name: editingTransaction.type === 'credit' ? editingTransaction.card_name || null : null,
      fatura_mes: editingTransaction.type === 'credit' ? (editingTransaction.fatura_mes || null) : null,
      installment_info,
    };

    const isSeries = (validParcela && siblings.length > 0) || (editingTransaction.fixa && siblings.length > 0) || (siblings.length > 0);

    if (isSeries && !needsSplit) {
      setPendingEditScope({
        targetTx: editingTransaction,
        newValues,
        origTx: origTx || editingTransaction,
        isParcela: validParcela,
        isFixa: !!editingTransaction.fixa,
        parcN,
        parcTotal,
        siblingsCount: siblings.length,
        valorTipo,
        needsSplit: false,
        amount,
      });
      return;
    }

    executeTransactionUpdate('single', {
      targetTx: editingTransaction,
      newValues,
      origTx: origTx || editingTransaction,
      isParcela: validParcela,
      isFixa: !!editingTransaction.fixa,
      parcN,
      parcTotal,
      siblingsCount: 0,
      valorTipo,
      needsSplit,
      amount,
    });
  }, [editingTransaction, transactions, toast, executeTransactionUpdate]);

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!newCardData.nome.trim()) {
      toast('Por favor, informe o nome do cartão.', 'error');
      return;
    }
    try {
      const cardPayload = {
        id: crypto.randomUUID(),
        nome: newCardData.nome.trim(),
        limite: Number(newCardData.limite || 0),
        vencimento: Number(newCardData.vencimento || 10),
        fechamento: Number(newCardData.fechamento || 3),
        bandeira: newCardData.bandeira || 'MasterCard'
      };

      const { data, error } = await supabase
        .from('cartoes')
        .insert([cardPayload])
        .select();

      if (error) throw error;

      const addedCard = (data && data.length > 0) ? data[0] : cardPayload;

      setCartoes(prev => [...prev, addedCard]);
      setIsAddCardModalOpen(false);
      setNewCardData({ nome: '', limite: '', vencimento: '10', fechamento: '3', bandeira: 'MasterCard' });
      toast(`Cartão ${addedCard.nome} adicionado!`);
    } catch (error) {
      console.error('Error adding card:', error.message);
      toast('Erro ao cadastrar cartão: ' + error.message, 'error');
    }
  };

  const handleUpdateCard = async (e) => {
    e.preventDefault();
    if (!editingCard.nome.trim()) {
      toast('Por favor, informe o nome do cartão.', 'error');
      return;
    }
    try {
      const { error } = await supabase
        .from('cartoes')
        .update({
          nome: editingCard.nome.trim(),
          bandeira: editingCard.bandeira || 'MasterCard',
          limite: Number(editingCard.limite || 0),
          vencimento: Number(editingCard.vencimento || 10),
          fechamento: Number(editingCard.fechamento || 3)
        })
        .eq('id', editingCard.id);

      if (error) throw error;

      setCartoes(prev => prev.map(c => c.id === editingCard.id ? editingCard : c));
      setIsEditModalOpen(false);
      setEditingCard(null);
      toast('Cartão atualizado!');
    } catch (error) {
      toast('Erro ao atualizar cartão: ' + error.message, 'error');
    }
  };

  const confirmDeleteCard = useCallback(async () => {
    if (!cardToDelete) return;
    try {
      const { error } = await supabase.from('cartoes').delete().eq('id', cardToDelete.id);
      if (error) throw error;
      setCartoes(prev => prev.filter(c => c.id !== cardToDelete.id));
      setIsEditModalOpen(false);
      setEditingCard(null);
      toast(`Cartão ${cardToDelete.nome} removido.`);
      setCardToDelete(null);
    } catch (error) {
      toast('Erro ao remover cartão: ' + error.message, 'error');
    }
  }, [cardToDelete, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-slate-400">
        <div className="space-y-3 text-center">
          <div className="h-10 w-10 mx-auto rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-sm font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (REQUIRE_AUTH && !user && !authLoading) {
    return <AuthScreen />;
  }

  if (showAuthScreen && !REQUIRE_AUTH) {
    return <AuthScreen onClose={() => setShowAuthScreen(false)} />;
  }

  const monthName = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const viewMonthKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;

  const openTransactionsWithPending = () => {
    setTransactionStatusFilter('pending');
    setActiveTab('financas');
    setFinanceSubTab('transacoes');
  };

  const filterByCard = (cardName) => {
    setSelectedCardFilter(selectedCardFilter === cardName ? null : cardName);
    setActiveTab('financas');
    setFinanceSubTab('transacoes');
  };

  return (
    <main className="min-h-screen bg-[#0a0e1a] text-slate-100 p-2.5 sm:p-5 md:p-8 pb-20 md:pb-12">
      <div className="mx-auto max-w-7xl space-y-3.5 sm:space-y-6">
        {/* HEADER COMPACTO MOBILE & DESKTOP */}
        <header className="flex items-center justify-between gap-2 pb-2.5 sm:pb-4 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-xl md:text-2xl font-black tracking-tight text-white leading-tight truncate">
                Minhas Finanças & Casa
              </h1>
              <p className="text-slate-400 font-medium text-[10px] sm:text-xs truncate">
                {partner1} & {partner2} • Família
              </p>
            </div>
          </div>

          {/* Controls Cluster: Seletor de Mês & Ações */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Seletor de Mês Compacto - visível apenas nas abas mensais (Início e Finanças) */}
            {(activeTab === 'inicio' || activeTab === 'financas') && (
              <div className="flex items-center gap-1 bg-[#121827] px-1.5 py-1 rounded-xl border border-white/10">
                <button
                  onClick={() => changeMonth(-1)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer active:scale-90"
                  title="Mês anterior"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[11px] sm:text-xs font-black w-18 sm:w-28 text-center text-white uppercase tracking-wider truncate">
                  {monthLabel}
                </span>
                <button
                  onClick={() => changeMonth(1)}
                  className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer active:scale-90"
                  title="Próximo mês"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Privacy Eye */}
            <button
              onClick={togglePrivacy}
              aria-label="Alternar modo privacidade"
              className={`p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                isPrivate
                  ? 'bg-indigo-600/25 text-indigo-300 border-indigo-500/40'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}
              title={isPrivate ? "Mostrar valores" : "Ocultar valores"}
            >
              {isPrivate ? <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </button>

            {/* Lock PIN (if configured) */}
            {pinHash && (
              <button
                onClick={handleLockNow}
                aria-label="Bloquear aplicativo"
                className="p-1.5 sm:p-2 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl border border-indigo-500/30 text-indigo-300 cursor-pointer"
                title="Bloquear agora"
              >
                <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            )}

            {/* Settings */}
            <button
              onClick={() => setActiveTab('config')}
              aria-label="Configurações"
              className="p-1.5 sm:p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 hover:text-white cursor-pointer"
              title="Configurações"
            >
              <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </div>
        </header>

        {!online && (
          <div role="status" className="mt-2 flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 rounded-2xl px-4 py-3 text-xs text-amber-300 animate-fade-in">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <p className="font-bold">Você está offline. As alterações serão salvas localmente.</p>
          </div>
        )}

        {dataError && (
          <div role="alert" className="mt-2 flex items-start gap-2 bg-rose-500/15 border border-rose-500/30 rounded-2xl px-4 py-3 text-xs text-rose-300 animate-fade-in">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-rose-400" />
            <div className="flex-1">
              <p className="font-bold">Erro ao carregar dados do servidor</p>
              <p className="mt-0.5 text-rose-300/90 capitalize">{dataError}</p>
            </div>
            <button
              type="button"
              onClick={fetchData}
              className="shrink-0 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-white/10 font-bold transition-all cursor-pointer"
            >
              Tentar novamente
            </button>
          </div>
        )}

        <NavTabs
          tabs={TABS}
          active={activeTab}
          onChange={setActiveTab}
          onQuickAdd={() => handleOpenQuickAdd('expense')}
          pendingBadges={{
            financas: pendingUrgentTransactions.length,
            tarefas: tasks.filter(t => !t.completed).length,
          }}
        />

        {/* Aba: Início */}
        {activeTab === 'inicio' && (
          <div className="space-y-6">
            <Dashboard
              transactions={monthTransactions}
              allTransactions={transactions}
              cardsSummary={cardsSummary}
              cartoes={cartoes}
              partner1={partner1}
              partner2={partner2}
              onAddMany={handleBulkAdd}
              onDeleteByIds={handleDeleteByIds}
              viewDate={viewDate}
              tasks={tasks}
              wishlist={wishlist}
              isPrivate={isPrivate}
              onOpenAddTransaction={handleOpenQuickAdd}
              onNavigateTab={(tab, subTab) => {
                if (tab === 'financas') {
                  setActiveTab('financas');
                  setFinanceSubTab(subTab || 'transacoes');
                } else {
                  setActiveTab(tab);
                }
              }}
              onSettleDebt={handleOpenSettleDebt}
            />
          </div>
        )}

        {/* Aba: Finanças (Centraliza Transações, Cartões, Financiamento e Relatórios) */}
        {activeTab === 'financas' && (
          <div className="space-y-6">
            {/* Sub-navegação discreta de Finanças */}
            <div className="flex gap-2 p-1.5 rounded-2xl bg-[#121827] border border-white/10 w-full sm:w-auto self-start overflow-x-auto no-scrollbar">
              {[
                { id: 'transacoes', label: '📄 Extrato & Lançamentos' },
                { id: 'cartoes', label: '💳 Faturas & Cartões' },
                { id: 'financiamentos', label: '🏠 Financiamento da Casa' },
                { id: 'relatorios', label: '📊 Relatórios' }
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setFinanceSubTab(sub.id)}
                  className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                    financeSubTab === sub.id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/40'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Sub-Aba: Transações (Extrato em Largura Total e Ação Rápida) */}
            {financeSubTab === 'transacoes' && (
              <div className="space-y-4 animate-fade-in">
                {selectedCardFilter && (
                  <div className="flex items-center justify-between p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl animate-fade-in">
                    <span className="text-xs font-bold text-purple-300">
                      Exibindo apenas transações do cartão: <strong className="text-white font-black">{selectedCardFilter}</strong>
                    </span>
                    <button
                      onClick={() => setSelectedCardFilter(null)}
                      className="text-xs font-bold text-purple-400 hover:text-white bg-purple-500/20 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                    >
                      Ver Todas
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <CSVManager
                    transactions={transactions}
                    onImport={handleImportTransactions}
                  />
                  <button
                    type="button"
                    onClick={() => handleOpenQuickAdd('expense')}
                    className="px-4 py-2.5 bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-indigo-500/25 border border-indigo-400/30 flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
                  >
                    <Plus className="h-4 w-4 stroke-[2.5]" />
                    <span>Novo Lançamento</span>
                  </button>
                </div>

                <div className="w-full">
                  <TransactionList
                    transactions={monthTransactions}
                    cardsSummary={cardsSummary}
                    onDelete={setTxToDelete}
                    onEdit={openEditTransaction}
                    onTogglePaid={handleTogglePaid}
                    onAdjustAmount={handleAdjustAmount}
                    onPayInvoice={handlePayInvoice}
                    statusFilter={transactionStatusFilter}
                    onStatusFilterChange={setTransactionStatusFilter}
                    partner1={partner1}
                    partner2={partner2}
                    selectedCardFilter={selectedCardFilter}
                    onClearCardFilter={() => setSelectedCardFilter(null)}
                    viewDate={viewDate}
                    variaveis={variaveis}
                    isPrivate={isPrivate}
                    cartoes={cartoes}
                  />
                </div>
              </div>
            )}

            {/* Sub-Aba: Financiamento da Casa */}
            {financeSubTab === 'financiamentos' && (
              <div className="space-y-6 animate-fade-in">
                <Financiamentos
                  transactions={transactions}
                  onAddMany={handleBulkAdd}
                  onDeleteByIds={handleDeleteByIds}
                />
              </div>
            )}

            {/* Sub-Aba: Cartões */}
            {financeSubTab === 'cartoes' && (
              <section className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-indigo-400" />
                    Cartões de Crédito
                  </h2>
                  <button
                    onClick={() => setIsAddCardModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-indigo-500/25 border border-indigo-400/30 active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar Novo Cartão
                  </button>
                </div>

                {cardsSummary.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 bg-slate-800/40 rounded-3xl border border-slate-700 text-center space-y-3">
                    <CreditCard className="h-10 w-10 text-slate-500" />
                    <p className="text-slate-300 font-medium">Nenhum cartão cadastrado ainda.</p>
                    <button
                      onClick={() => setIsAddCardModalOpen(true)}
                      className="mt-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-extrabold transition-all cursor-pointer"
                    >
                      <Plus className="h-4 w-4 inline mr-1" />
                      Adicionar o primeiro cartão
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {cardsSummary.map((card) => {
                      const activeFaturaKey = cardSelectedFatura[card.nome] || viewMonthKey;
                      const activeFaturaData = activeFaturaKey === 'todas'
                        ? null
                        : (card.faturasMap?.[activeFaturaKey] || {
                            monthKey: activeFaturaKey,
                            amount: card.faturaAtual,
                            somaCompras: card.somaCompras,
                            isPaga: card.isPaga,
                            isAjustada: card.isAjustada,
                            purchases: card.purchases,
                          });

                      const currentTab = cardPurchasesTab[card.nome] || 'fatura';
                      const displayedPurchases = currentTab === 'todas' || activeFaturaKey === 'todas'
                        ? (card.allPurchases || [])
                        : (activeFaturaData?.purchases || []);

                      const displayAmountVal = activeFaturaKey === 'todas'
                        ? (card.allPurchases || []).reduce((acc, t) => acc + Number(t.amount || 0), 0)
                        : (activeFaturaData ? activeFaturaData.amount : card.faturaAtual);

                      const displayIsPaga = activeFaturaKey === 'todas'
                        ? false
                        : (activeFaturaData ? activeFaturaData.isPaga : card.isPaga);

                      const displayIsAjustada = activeFaturaKey === 'todas'
                        ? false
                        : (activeFaturaData ? activeFaturaData.isAjustada : card.isAjustada);

                      const displaySomaCompras = activeFaturaKey === 'todas'
                        ? displayAmountVal
                        : (activeFaturaData ? activeFaturaData.somaCompras : card.somaCompras);

                      return (
                        <Card key={card.id} className="bg-[#1e293b] border-slate-800 shadow-xl overflow-hidden group hover:border-slate-700 transition-all">
                          <CardContent className="p-5 sm:p-6 space-y-5">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-xl shrink-0 ${
                                  card.nome === 'Nubank' ? 'bg-[#8a05be]' :
                                  card.nome === 'Inter' ? 'bg-[#ff7a00]' :
                                  card.nome === 'Sicoob' ? 'bg-[#003641]' : 'bg-[#17469e]'
                                }`}>
                                  {card.nome.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-lg text-white truncate">{card.nome}</h3>
                                  <p className="text-xs text-slate-400 uppercase tracking-wider">{card.bandeira || 'MasterCard'}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                                {card.isMelhorDia && (
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse shadow-sm">
                                    ⭐ Melhor dia!
                                  </span>
                                )}
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                                  displayIsPaga
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                }`}>
                                  {displayIsPaga ? 'Paga' : 'Aberta'}
                                </span>
                                {displayIsAjustada && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold border bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                                    AJUSTADA
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/50">
                              <div>
                                <p className="text-[10px] text-slate-500 uppercase font-black">Limite</p>
                                <p className="text-xs font-bold text-slate-300">R${Number(card.limite).toLocaleString('pt-BR')}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-red-400 uppercase font-black" title="Total utilizado em compras e parcelas pendentes">Utilizado</p>
                                <p className="text-xs font-bold text-red-400">R${(card.totalUtilizado != null ? card.totalUtilizado : card.faturaAtual).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-emerald-400 uppercase font-black" title="Limite disponível restante no cartão">Disponível</p>
                                <p className="text-xs font-bold text-emerald-400">R${card.disponivel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-1000 ${card.percentual > 80 ? 'bg-red-500' : 'bg-indigo-500'}`}
                                  style={{ width: `${Math.min(card.percentual, 100)}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                                <span className="text-slate-300">{Math.round(card.percentual)}% utilizado</span>
                                <span className="text-emerald-400">Disponível: {Math.max(0, Math.round(100 - card.percentual))}%</span>
                              </div>
                            </div>

                            {/* Detalhes de Fatura e Datas */}
                            <div className="flex justify-between items-end pt-3 border-t border-slate-800">
                              <div className="text-[10px] text-slate-400 space-y-1">
                                <p>Vencimento: <span className="text-slate-200">dia {card.vencimento}</span></p>
                                <p>Fechamento: <span className="text-slate-200">dia {card.fechamento}</span></p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-slate-500 uppercase font-black">
                                  Fatura {activeFaturaKey === 'todas' ? 'Geral' : formatInvoiceMonth(activeFaturaKey)}
                                </p>
                                <p className="text-xl font-black text-white">
                                  R$ {displayAmountVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                                {displayIsAjustada && displaySomaCompras > 0 && Math.abs(displaySomaCompras - displayAmountVal) > 0.01 && (
                                  <p className="text-[9px] text-slate-400">
                                    Lançamentos: R$ {displaySomaCompras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Seletor Rápido de Fatura do Cartão */}
                            <div className="flex items-center justify-between gap-2 bg-slate-900/80 px-3 py-2 rounded-xl border border-slate-800">
                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                                <CreditCard className="h-3.5 w-3.5 text-indigo-400" /> Fatura:
                              </span>
                              <select
                                value={activeFaturaKey}
                                onChange={(e) => setCardSelectedFatura(prev => ({ ...prev, [card.nome]: e.target.value }))}
                                className="bg-slate-800 text-xs font-bold text-slate-100 rounded-lg px-2.5 py-1 border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer min-w-0"
                              >
                                {(card.faturasKeys || []).map(fKey => {
                                  const fData = card.faturasMap?.[fKey];
                                  const count = fData?.purchases?.length || 0;
                                  const statusTag = fData?.isPaga ? '✓ Paga' : '⏳ Aberta';
                                  return (
                                    <option key={fKey} value={fKey}>
                                      {formatInvoiceMonth(fKey)} ({statusTag} • {count} {count === 1 ? 'despesa' : 'despesas'})
                                    </option>
                                  );
                                })}
                                <option value="todas">📋 Todas as Compras ({(card.allPurchases || []).length})</option>
                              </select>
                            </div>

                            {/* Botão Ver Despesas Associadas */}
                            <button
                              onClick={() => setExpandedPurchases(expandedPurchases === card.nome ? null : card.nome)}
                              className="w-full py-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white text-[11px] font-black rounded-xl transition-all border border-slate-800 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expandedPurchases === card.nome ? 'rotate-180' : ''}`} />
                              {expandedPurchases === card.nome 
                                ? 'OCULTAR DESPESAS ASSOCIADAS' 
                                : `VER DESPESAS ASSOCIADAS (${displayedPurchases.length})`}
                            </button>

                            {/* Conteúdo Expandido das Despesas */}
                            {expandedPurchases === card.nome && (
                              <div className="space-y-2.5 animate-fade-in">
                                {/* Toggle Desta Fatura vs Todas */}
                                <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
                                  <button
                                    type="button"
                                    onClick={() => setCardPurchasesTab(prev => ({ ...prev, [card.nome]: 'fatura' }))}
                                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                      currentTab === 'fatura' && activeFaturaKey !== 'todas'
                                        ? 'bg-indigo-600 text-white shadow'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    Desta Fatura ({activeFaturaData?.purchases?.length || 0})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCardPurchasesTab(prev => ({ ...prev, [card.nome]: 'todas' }))}
                                    className={`flex-1 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                      currentTab === 'todas' || activeFaturaKey === 'todas'
                                        ? 'bg-indigo-600 text-white shadow'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    Todas do Cartão ({(card.allPurchases || []).length})
                                  </button>
                                </div>

                                {/* Lista de Despesas */}
                                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                  {displayedPurchases.length === 0 ? (
                                    <div className="p-3.5 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-1.5">
                                      <p className="text-[11px] text-slate-400">Nenhuma despesa nesta fatura.</p>
                                      {(card.allPurchases || []).length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => setCardPurchasesTab(prev => ({ ...prev, [card.nome]: 'todas' }))}
                                          className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                                        >
                                          Ver todas as {(card.allPurchases || []).length} despesas associadas a este cartão
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    displayedPurchases.map((p) => {
                                      const pFatura = p.fatura_mes || (p.date ? p.date.slice(0, 7) : '');
                                      return (
                                        <div key={p.id} className="flex items-center justify-between text-[11px] rounded-xl bg-slate-900/70 hover:bg-slate-900 px-3 py-2 border border-slate-800/80 transition-all">
                                          <div className="min-w-0 flex-1 pr-2">
                                            <p className="truncate text-slate-100 font-bold text-xs">{p.description}</p>
                                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 flex-wrap mt-0.5">
                                              <span>{new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                              {p.installment_info && (
                                                <span className="font-extrabold text-indigo-300 bg-indigo-500/20 px-1 rounded">
                                                  {p.installment_info}
                                                </span>
                                              )}
                                              {pFatura && (
                                                <span className="font-bold text-violet-300 bg-violet-500/15 px-1.5 py-0.2 rounded border border-violet-500/20">
                                                  Fatura {formatInvoiceMonth(pFatura)}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-xs font-black ${p.pago ? 'text-emerald-400' : 'text-purple-300'}`}>
                                              R$ {Number(p.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                            <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${
                                              p.pago 
                                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                            }`}>
                                              {p.pago ? 'Paga' : 'Aberta'}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Ações da Fatura */}
                            <div className="flex flex-col gap-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handlePayInvoice(card.nome, !displayIsPaga, activeFaturaKey !== 'todas' ? activeFaturaKey : viewMonthKey)}
                                  className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                                    displayIsPaga
                                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500/30 shadow-lg shadow-emerald-500/20'
                                  }`}
                                >
                                  {displayIsPaga ? 'REABRIR FATURA' : 'PAGAR FATURA'}
                                </button>
                                <button
                                  onClick={() => filterByCard(card.nome)}
                                  className={`px-3 py-2.5 text-xs font-black rounded-xl transition-all border cursor-pointer ${
                                    selectedCardFilter === card.nome
                                    ? 'bg-purple-500/30 text-purple-300 border-purple-500/50'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                  }`}
                                  title="Filtrar todas as compras deste cartão no extrato"
                                >
                                  COMPRAS NO EXTRATO
                                </button>
                              </div>
                              <button
                                onClick={() => openFaturaAdjust(card)}
                                className="w-full py-2 bg-indigo-950/50 hover:bg-indigo-900/50 text-indigo-300 hover:text-indigo-200 text-[11px] font-bold rounded-xl transition-all border border-indigo-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <SlidersHorizontal className="h-3 w-3" /> REAJUSTAR FATURA
                              </button>
                              <button
                                onClick={() => { setEditingCard(card); setIsEditModalOpen(true); }}
                                className="w-full py-2 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] font-bold rounded-xl transition-all border border-slate-800/80 flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Edit3 className="h-3 w-3" /> Reajustar Limite e Datas
                              </button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Sub-Aba: Relatórios */}
            {financeSubTab === 'relatorios' && (
              <div className="animate-fade-in">
                <Reports transactions={monthTransactions} />
              </div>
            )}
          </div>
        )}

        {/* Aba: Desejos & Compras */}
        {activeTab === 'desejos' && (
          <Wishlist
            wishlist={wishlist}
            onAdd={handleAddWishlist}
            onUpdate={handleUpdateWishlist}
            onDelete={handleDeleteWishlist}
            onConvertToTransaction={handleConvertToTransaction}
            partner1={partner1}
            partner2={partner2}
          />
        )}

        {/* Aba: Tarefas da Casa */}
        {activeTab === 'tarefas' && (
          <HouseTasks
            tasks={tasks}
            onAdd={handleAddTask}
            onToggle={handleToggleTask}
            onUpdate={handleUpdateTask}
            onDelete={handleDeleteTask}
            onClearCompleted={handleClearCompletedTasks}
            partner1={partner1}
            partner2={partner2}
          />
        )}

        {/* Aba: Relatórios (para compatibilidade direta se acessado) */}
        {activeTab === 'relatorios' && (
          <Reports transactions={monthTransactions} />
        )}

        {/* Aba: Configurações */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <Card className="animate-slide-up">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-indigo-400" /> Configurações do Casal
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome do Parceiro 1</label>
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      value={partner1}
                      onChange={(e) => {
                        setPartner1(e.target.value);
                        localStorage.setItem('fincasal_partner1', e.target.value);
                        saveCloudSetting('partner1', e.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome do Parceiro 2</label>
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      value={partner2}
                      onChange={(e) => {
                        setPartner2(e.target.value);
                        localStorage.setItem('fincasal_partner2', e.target.value);
                        saveCloudSetting('partner2', e.target.value);
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">Os nomes são salvos automaticamente e sincronizados entre os aparelhos.</p>
              </CardContent>
            </Card>

            {/* Configuração de Notificações WhatsApp & n8n */}
            <Card className="animate-slide-up border-emerald-500/30 bg-gradient-to-br from-[#0c1f1c] via-[#121827] to-[#121827] shadow-xl">
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-emerald-500/20 pb-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="text-emerald-400 text-xl">📱</span> Notificações WhatsApp (n8n)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Dispara alertas em tempo real de novas despesas, receitas e alterações de saldo para o WhatsApp seu e da sua esposa.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleWhatsAppNotifications}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-black border transition-all cursor-pointer shadow-md ${
                      whatsappEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {whatsappEnabled ? '🔔 Notificações Ativas' : '🔕 Notificações Desativadas'}
                  </button>
                </div>

                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>URL do Webhook no n8n</span>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        Sincronizado na nuvem
                      </span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="https://n8n.manoalles.space/webhook/financas-alerta"
                        className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono"
                        value={n8nWebhookUrl}
                        onChange={(e) => handleUpdateWebhookUrl(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleTestWhatsApp}
                        disabled={isTestingWhatsApp}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
                      >
                        {isTestingWhatsApp ? 'Enviando...' : '🧪 Enviar Notificação de Teste'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      💡 <strong>Relatório Diário Noturno:</strong> Já está pré-configurado no workflow do n8n para rodar todo dia às <strong>21:00</strong>. Você pode alterar o horário quando quiser abrindo o nó no n8n.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Configuração de Senha & Segurança */}
            <Card className="animate-slide-up border-indigo-500/20 bg-gradient-to-br from-[#1e293b] to-[#172033]">
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <KeyRound className="h-5 w-5 text-indigo-400" /> Senha & Bloqueio do App
                    </h2>
                    <p className="text-xs text-slate-400">
                      Proteja o acesso aos dados financeiros e tarefas da casa com um PIN de segurança.
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                    pinHash
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {pinHash ? '🔒 Protegido com PIN' : '🔓 Sem Senha'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {!pinHash ? (
                    <button
                      onClick={() => openPinModal('create')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-indigo-500/25"
                    >
                      <Lock className="h-4 w-4" /> Criar Senha de Acesso
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => openPinModal('change')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <KeyRound className="h-4 w-4" /> Alterar Senha
                      </button>
                      <button
                        onClick={() => openPinModal('remove')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <Unlock className="h-4 w-4" /> Remover Senha
                      </button>
                      <button
                        onClick={handleLockNow}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer sm:ml-auto"
                      >
                        <Lock className="h-4 w-4 text-indigo-400" /> Bloquear Agora
                      </button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Conta / Conexão */}
            <Card className="animate-slide-up border-emerald-500/20 bg-gradient-to-br from-[#1e293b] to-[#172033]">
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-400" /> Conta & Segurança na Nuvem
                    </h2>
                    <p className="text-xs text-slate-400">
                      {user
                        ? `Conectado como ${user.email}. Ativar RLS no Supabase protege os dados no servidor, não só a interface.`
                        : 'Nenhuma sessão ativa. É possível usar o app sem login (modo atual).'}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-black border ${
                    user
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {user ? '● Conectado' : '○ Visitante'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {!user ? (
                    <button
                      onClick={() => setShowAuthScreen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-emerald-500/25"
                    >
                      <ShieldCheck className="h-4 w-4" /> Entrar / Criar conta
                    </button>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-emerald-300 break-all">
                        {user.email}
                      </span>
                      <button
                        onClick={async () => { await signOut(); toast('Sessão encerrada.'); }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <Unlock className="h-4 w-4" /> Sair
                      </button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <CategoriesEditor />

            <AuditLogViewer />

            <Card className="animate-slide-up border-red-500/20">
              <CardContent className="p-6 space-y-3">
                <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" /> Zona de Perigo
                </h2>
                <p className="text-sm text-slate-400">
                  Exclui permanentemente <strong className="text-slate-200">todas as transações</strong> do banco de dados.
                  Os cartões permanecem cadastrados. Esta ação não pode ser desfeita.
                </p>
                <button
                  onClick={() => setIsResetModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-2xl text-xs font-bold transition-all cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  Resetar Transações
                </button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modal de Adicionar Novo Cartão */}
      {isAddCardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] border border-indigo-500/30 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6 animate-scale-in">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-indigo-400" /> Adicionar Novo Cartão
              </h3>
              <button onClick={() => setIsAddCardModalOpen(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleAddCard} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome do Cartão</label>
                <input
                  type="text"
                  placeholder="Ex: C6 Bank, Santander, XP..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  value={newCardData.nome}
                  onChange={(e) => setNewCardData({...newCardData, nome: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bandeira</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                    value={newCardData.bandeira}
                    onChange={(e) => setNewCardData({...newCardData, bandeira: e.target.value})}
                  >
                    <option value="MasterCard">MasterCard</option>
                    <option value="Visa">Visa</option>
                    <option value="Elo">Elo</option>
                    <option value="Amex">American Express</option>
                    <option value="Outra">Outra</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Limite Total (R$)</label>
                  <input
                    type="number"
                    placeholder="Ex: 5000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={newCardData.limite}
                    onChange={(e) => setNewCardData({...newCardData, limite: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dia Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Ex: 10"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={newCardData.vencimento}
                    onChange={(e) => setNewCardData({...newCardData, vencimento: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dia Fechamento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Ex: 3"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={newCardData.fechamento}
                    onChange={(e) => setNewCardData({...newCardData, fechamento: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddCardModalOpen(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  CADASTRAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Cartão */}
      {isEditModalOpen && editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6 animate-scale-in">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-indigo-400" /> Reajustar {editingCard.nome}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateCard} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nome do Cartão</label>
                  <input
                    type="text"
                    placeholder="Ex: Nubank, Inter..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={editingCard.nome}
                    onChange={(e) => setEditingCard({...editingCard, nome: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bandeira</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                    value={editingCard.bandeira || 'MasterCard'}
                    onChange={(e) => setEditingCard({...editingCard, bandeira: e.target.value})}
                  >
                    <option value="MasterCard">MasterCard</option>
                    <option value="Visa">Visa</option>
                    <option value="Elo">Elo</option>
                    <option value="Amex">American Express</option>
                    <option value="Outra">Outra</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Limite Total (R$)</label>
                <input
                  type="number"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  value={editingCard.limite}
                  onChange={(e) => setEditingCard({...editingCard, limite: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dia Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={editingCard.vencimento}
                    onChange={(e) => setEditingCard({...editingCard, vencimento: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dia Fechamento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={editingCard.fechamento}
                    onChange={(e) => setEditingCard({...editingCard, fechamento: e.target.value})}
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setCardToDelete({ id: editingCard.id, nome: editingCard.nome })}
                  className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1.5 p-1 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" /> Excluir este Cartão
                </button>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-700 cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  SALVAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Reajuste de Fatura */}
      {reajusteFatura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6 animate-scale-in">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-indigo-400" /> Reajustar Fatura — {reajusteFatura.cardName}
              </h3>
              <button onClick={() => setReajusteFatura(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={saveFaturaAdjust} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mês da Fatura</label>
                <input
                  type="month"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  value={reajusteFatura.month}
                  onChange={(e) => setReajusteFatura({ ...reajusteFatura, month: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor da Fatura (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 1234,56"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  value={reajusteFatura.value}
                  onChange={(e) => setReajusteFatura({ ...reajusteFatura, value: e.target.value })}
                />
                <p className="text-[11px] text-slate-500">Deixe em branco ou 0 para remover o ajuste deste mês.</p>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setReajusteFatura(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-700 cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  SALVAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição de Transação */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6 animate-scale-in overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-indigo-400" /> Editar Transação
              </h3>
              <button onClick={() => setEditingTransaction(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateTransaction} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Descrição</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  value={editingTransaction.description}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={editingTransaction.amount}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data</label>
                  <input
                    type="date"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={editingTransaction.date}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                    value={editingTransaction.type}
                    onChange={(e) => {
                      const type = e.target.value;
                      setEditingTransaction((prev) => ({
                        ...prev,
                        type,
                        payment_method: type === 'credit' ? 'credit' : prev.payment_method === 'credit' ? 'checking' : prev.payment_method,
                        card_name: type === 'credit' ? prev.card_name : null,
                      }));
                    }}
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                    <option value="credit">Cartão (crédito)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quem</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                    value={editingTransaction.quem || 'Comum'}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, quem: e.target.value })}
                  >
                    <option value="Eu">{partner1}</option>
                    <option value="Outro">{partner2}</option>
                    <option value="Comum">Comum</option>
                    <option value="Comum - Eu">Comum ({partner1})</option>
                    <option value="Comum - Outro">Comum ({partner2})</option>
                    <option value="Filhos">👶 Filhos</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Grupo</label>
                  <select
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                    value={editGrupo}
                    onChange={(e) => {
                      const gid = e.target.value;
                      setEditGrupo(gid);
                      const g = getCategories().find((x) => x.id === gid);
                      if (g && !g.categories.some((c) => c.name === editingTransaction.category)) {
                        setEditingTransaction((prev) => ({ ...prev, category: g.categories[0].name, subcategoria: '' }));
                      }
                    }}
                  >
                    {getCategories().map((g) => (
                      <option key={g.id} value={g.id}>{g.emoji} {g.label}</option>
                    ))}
                    <option value="outra">✏️ Outra categoria</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categoria</label>
                  {editGrupo !== 'outra' ? (
                    <select
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer"
                      value={editingTransaction.category}
                      onChange={(e) => setEditingTransaction({ ...editingTransaction, category: e.target.value })}
                    >
                      {(getCategories().find((g) => g.id === editGrupo)?.categories || []).map((c) => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      value={editingTransaction.category || ''}
                      onChange={(e) => setEditingTransaction({ ...editingTransaction, category: e.target.value })}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Item (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Parcela Casa"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={editingTransaction.subcategoria}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, subcategoria: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Destino/Origem (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Bradesco, mercado"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={editingTransaction.destino}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, destino: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={!!editingTransaction.isParcela}
                      onChange={(e) => setEditingTransaction({ ...editingTransaction, isParcela: e.target.checked })}
                      className="accent-indigo-500 h-4 w-4"
                    />
                    É parcelado (aparece {'"n/total"'} na lista)
                  </label>
                  {editingTransaction.isParcela && (
                    <div className="space-y-2 animate-fade-in">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parcela nº</label>
                          <input
                            type="number"
                            min="1"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            value={editingTransaction.parcelaN}
                            onChange={(e) => setEditingTransaction({ ...editingTransaction, parcelaN: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de parcelas</label>
                          <input
                            type="number"
                            min="1"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                            value={editingTransaction.parcelaTotal}
                            onChange={(e) => setEditingTransaction({ ...editingTransaction, parcelaTotal: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'total', label: '💰 Valor total (divide em N)' },
                          { value: 'parcela', label: '📆 Valor da parcela (cada uma)' },
                        ].map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setEditingTransaction({ ...editingTransaction, valorTipo: o.value })}
                            className={`rounded-xl px-3 py-2.5 text-[11px] font-bold transition-all cursor-pointer border ${
                              editingTransaction.valorTipo === o.value
                                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-indigo-300/70">
                        {editingTransaction.valorTipo === 'parcela'
                          ? `Cada uma das ${editingTransaction.parcelaTotal || 'N'} parcelas terá esse valor (total de ${(parseFloat(String(editingTransaction.amount).replace(',', '.')) || 0) * (parseInt(editingTransaction.parcelaTotal, 10) || 1)}).`
                          : `Ao salvar, o valor total é dividido em ${editingTransaction.parcelaTotal || 'N'} parcelas mensais (a última recebe a diferença de centavos).`}
                      </p>
                      {editingTransaction.seriesSize > 0 && (
                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none p-3 rounded-xl bg-slate-900/60 border border-slate-700/60">
                          <input
                            type="checkbox"
                            checked={editingTransaction.applyToAll}
                            onChange={(e) => setEditingTransaction({ ...editingTransaction, applyToAll: e.target.checked })}
                            className="h-4 w-4 accent-indigo-500"
                          />
                          Aplicar o novo valor a todas as {editingTransaction.parcelaTotal} parcelas da série
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {editingTransaction.type === 'credit' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cartão</label>
                    <select
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer text-sm"
                      value={editingTransaction.card_name || ''}
                      onChange={(e) => {
                        const nextName = e.target.value;
                        const cObj = cartoes.find(c => c && c.nome === nextName);
                        const nextFat = cObj ? getCardInvoiceMonth(cObj, editingTransaction.date) : editingTransaction.fatura_mes;
                        setEditingTransaction({ ...editingTransaction, card_name: nextName, fatura_mes: nextFat });
                      }}
                    >
                      <option value="">— Nenhum —</option>
                      {cartoes.map((c) => (
                        <option key={c.id} value={c.nome}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-purple-300 uppercase tracking-wider">Fatura de Cobrança (Mês/Ano)</label>
                    <input
                      type="text"
                      placeholder="Ex: 2026-10"
                      className="w-full bg-slate-900 border border-purple-500/40 rounded-xl px-3 py-3 text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all text-sm font-bold"
                      value={editingTransaction.fatura_mes || (editingTransaction.card_name ? getCardInvoiceMonth(cartoes.find(c => c && c.nome === editingTransaction.card_name), editingTransaction.date) || '' : '')}
                      onChange={(e) => setEditingTransaction({ ...editingTransaction, fatura_mes: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!editingTransaction.pago}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, pago: e.target.checked })}
                    className="accent-emerald-500 h-4 w-4"
                  />
                  Pago
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!editingTransaction.fixa}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, fixa: e.target.checked })}
                    className="accent-blue-500 h-4 w-4"
                  />
                  Fixa
                </label>
              </div>

              {editingTransaction.pago && (
                <div className="space-y-2 p-3 rounded-2xl bg-[#0a0e1a] border border-slate-700 animate-fade-in">
                  <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Quem Realizou o Pagamento?</label>
                  <select
                    className="w-full bg-[#121827] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                    value={editingTransaction.pago_por || '50_50'}
                    onChange={(e) => {
                      const v = e.target.value;
                      const tot = Number(editingTransaction.amount || 0);
                      const h = Math.round((tot / 2) * 100) / 100;
                      setEditingTransaction({
                        ...editingTransaction,
                        pago_por: v,
                        pago_alle: v === 'alle' ? tot : v === '50_50' ? h : v === 'kelly' ? 0 : editingTransaction.pago_alle,
                        pago_kelly: v === 'kelly' ? tot : v === '50_50' ? Math.round((tot - h) * 100) / 100 : v === 'alle' ? 0 : editingTransaction.pago_kelly,
                      });
                    }}
                  >
                    <option value="50_50">⚖️ Dividido 50/50</option>
                    <option value="alle">💜 100% {partner1}</option>
                    <option value="kelly">💖 100% {partner2}</option>
                    <option value="custom">✏️ Rateio Personalizado</option>
                  </select>

                  {editingTransaction.pago_por === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="text-[10px] text-purple-300 font-bold uppercase">{partner1} (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingTransaction.pago_alle ?? ''}
                          onChange={(e) => setEditingTransaction({ ...editingTransaction, pago_alle: e.target.value })}
                          className="w-full bg-[#121827] border border-purple-500/40 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-rose-300 font-bold uppercase">{partner2} (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editingTransaction.pago_kelly ?? ''}
                          onChange={(e) => setEditingTransaction({ ...editingTransaction, pago_kelly: e.target.value })}
                          className="w-full bg-[#121827] border border-rose-500/40 rounded-xl px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
              >
                SALVAR ALTERAÇÕES
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Inteligente de Confirmação de Escopo na Edição */}
      {pendingEditScope && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#1e293b] border border-indigo-500/30 w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5 animate-scale-in text-white">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Atualizar Lançamento</h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {pendingEditScope.isFixa
                      ? '🔁 Despesa/Receita Fixa Recorrente'
                      : pendingEditScope.isParcela
                        ? `📦 Lançamento Parcelado (${pendingEditScope.newValues.installment_info || pendingEditScope.targetTx.installment_info})`
                        : '🔁 Lançamento com Repetições'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPendingEditScope(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-2">
              <p className="text-sm font-bold text-white truncate">
                {pendingEditScope.newValues.description}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Valor anterior:</span>
                <span className="text-slate-400 line-through">
                  R$ {Number(pendingEditScope.origTx.amount || 0).toFixed(2).replace('.', ',')}
                </span>
                <span className="text-slate-600">→</span>
                <span className="text-emerald-400 font-black text-sm">
                  R$ {Number(pendingEditScope.newValues.amount || 0).toFixed(2).replace('.', ',')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1 border-t border-white/5">
                <span>
                  Ref: {pendingEditScope.targetTx.date ? (() => {
                    const p = String(pendingEditScope.targetTx.date).split('T')[0].split('-');
                    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : pendingEditScope.targetTx.date;
                  })() : ''}
                </span>
                <span>•</span>
                <span>{pendingEditScope.newValues.category}</span>
                {pendingEditScope.siblingsCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-indigo-400 font-semibold">{pendingEditScope.siblingsCount} repetições encontradas</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Como deseja aplicar esta alteração?
              </p>

              {/* Opção 1: Apenas este lançamento */}
              <button
                type="button"
                onClick={() => executeTransactionUpdate('single', pendingEditScope)}
                className="w-full text-left p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 transition-all flex items-start gap-3.5 cursor-pointer group shadow-sm"
              >
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 group-hover:scale-105 transition-all shrink-0 mt-0.5">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    1. Apenas este lançamento
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Altera somente o valor deste mês/parcela pontual. Os demais meses passados e futuros permanecem intactos.
                  </p>
                </div>
              </button>

              {/* Opção 2: Deste lançamento em diante */}
              <button
                type="button"
                onClick={() => executeTransactionUpdate('future', pendingEditScope)}
                className="w-full text-left p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500/50 transition-all flex items-start gap-3.5 cursor-pointer group shadow-sm"
              >
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20 group-hover:scale-105 transition-all shrink-0 mt-0.5">
                  <FastForward className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                    2. Deste lançamento em diante (Este e os próximos)
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Mantém o histórico dos meses anteriores intacto e atualiza este lançamento e todos os próximos meses/parcelas futuros.
                  </p>
                </div>
              </button>

              {/* Opção 3: Todas as ocorrências */}
              <button
                type="button"
                onClick={() => executeTransactionUpdate('all', pendingEditScope)}
                className="w-full text-left p-3.5 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/50 transition-all flex items-start gap-3.5 cursor-pointer group shadow-sm"
              >
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-300 group-hover:scale-105 transition-all shrink-0 mt-0.5">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-indigo-200 group-hover:text-white transition-colors">
                    3. Todas as ocorrências (Série Completa)
                  </p>
                  <p className="text-xs text-indigo-300/80 mt-0.5 leading-relaxed">
                    Aplica o novo valor em todas as ocorrências desta transação (passadas e futuras).
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setPendingEditScope(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 text-xs cursor-pointer"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Reset de Transações */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] border border-red-500/40 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6 animate-scale-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-red-500 animate-bounce" /> Resetar Transações
              </h3>
              <button onClick={() => { setIsResetModalOpen(false); setResetConfirmInput(''); setResetPin(''); setPendingReset(false); }} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Esta ação irá <strong className="text-red-400">excluir permanentemente todas as transações</strong> do banco de dados. Os cartões permanecerão cadastrados.
              </p>
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                Digite <strong className="font-bold">RESETAR</strong> no campo abaixo para confirmar.
              </div>
              <input
                type="text"
                placeholder="Digite RESETAR para confirmar"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all uppercase"
                value={resetConfirmInput}
                onChange={(e) => setResetConfirmInput(e.target.value)}
              />
              {pinHash && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-red-300">Confirme seu PIN de acesso</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Digite seu PIN para liberar a exclusão"
                    className="w-full bg-slate-900 border border-red-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
                    value={resetPin}
                    onChange={(e) => setResetPin(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsResetModalOpen(false); setResetConfirmInput(''); setResetPin(''); setPendingReset(false); }}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 text-xs cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                disabled={resetConfirmInput.trim().toUpperCase() !== 'RESETAR' || (!!pinHash && !resetPin) || pendingReset}
                onClick={() => { setPendingReset(true); handleResetAllTransactions(); }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" /> {pendingReset ? 'Confirmação...' : 'APAGAR TUDO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Inteligente de Exclusão de Transação */}
      {txToDelete && (
        txToDelete.fixa ||
        txToDelete.installment_info ||
        transactions.filter(t => t.id !== txToDelete.id && t.description === txToDelete.description).length > 0
      ) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] border border-red-500/30 w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5 animate-scale-in text-white">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Excluir Lançamento</h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {txToDelete.fixa ? '🔁 Despesa/Receita Fixa Recorrente' : txToDelete.installment_info ? `📦 Compra Parcelada (${txToDelete.installment_info})` : '🔁 Lançamento com Repetições'}
                  </p>
                </div>
              </div>
              <button onClick={() => setTxToDelete(null)} className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-1">
              <p className="text-sm font-bold text-white truncate">{txToDelete.description}</p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-emerald-400 font-bold">R$ {Number(txToDelete.amount || 0).toFixed(2).replace('.', ',')}</span>
                <span>•</span>
                <span>
                  {txToDelete.date ? (() => {
                    const p = String(txToDelete.date).split('T')[0].split('-');
                    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : txToDelete.date;
                  })() : ''}
                </span>
                <span>•</span>
                <span className="text-slate-300">{txToDelete.category}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Escolha como deseja excluir:</p>

              {/* Opção 1: Excluir somente este mês */}
              <button
                onClick={() => handleDeleteTransaction(txToDelete, 'single')}
                className="w-full text-left p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 transition-all flex items-start gap-3.5 cursor-pointer group shadow-sm"
              >
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20 group-hover:scale-105 transition-all shrink-0 mt-0.5">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                    1. Apenas este lançamento
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Apaga apenas este lançamento pontual. O histórico dos meses passados e os lançamentos futuros são mantidos.
                  </p>
                </div>
              </button>

              {/* Opção 2: Deste mês em diante */}
              <button
                onClick={() => handleDeleteTransaction(txToDelete, 'future')}
                className="w-full text-left p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-orange-500/50 transition-all flex items-start gap-3.5 cursor-pointer group shadow-sm"
              >
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20 group-hover:scale-105 transition-all shrink-0 mt-0.5">
                  <FastForward className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white group-hover:text-orange-300 transition-colors">
                    2. Deste lançamento em diante (Este e os próximos)
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Mantém o histórico passado e cancela/apaga todos os meses ou parcelas futuras a partir deste lançamento.
                  </p>
                </div>
              </button>

              {/* Opção 3: Todas as ocorrências */}
              <button
                onClick={() => handleDeleteTransaction(txToDelete, 'all')}
                className="w-full text-left p-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 transition-all flex items-start gap-3.5 cursor-pointer group shadow-sm"
              >
                <div className="p-2 rounded-xl bg-red-500/20 text-red-400 group-hover:scale-105 transition-all shrink-0 mt-0.5">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-300 group-hover:text-red-200 transition-colors">
                    3. Todas as ocorrências (Série Completa)
                  </p>
                  <p className="text-xs text-red-400/80 mt-0.5 leading-relaxed">
                    Apaga completamente todas as repetições passadas e futuras desta transação.
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setTxToDelete(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 text-xs cursor-pointer"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      ) : txToDelete ? (
        <ConfirmDialog
          open={true}
          title="Excluir Transação"
          message={`Deseja excluir a transação "${txToDelete.description || ''}" no valor de R$ ${Number(txToDelete.amount || 0).toFixed(2).replace('.', ',')}? Esta ação não pode ser desfeita.`}
          confirmLabel="EXCLUIR"
          cancelLabel="CANCELAR"
          danger
          onConfirm={() => handleDeleteTransaction(txToDelete, 'single')}
          onCancel={() => setTxToDelete(null)}
        />
      ) : null}

      {/* Confirmação de exclusão de cartão */}
      <ConfirmDialog
        open={!!cardToDelete}
        title="Excluir Cartão"
        message={`Tem certeza que deseja excluir o cartão ${cardToDelete?.nome}? As compras deste cartão permanecerão no histórico.`}
        confirmLabel="EXCLUIR"
        cancelLabel="CANCELAR"
        danger
        onConfirm={confirmDeleteCard}
        onCancel={() => setCardToDelete(null)}
      />

      {/* Modal de Configuração / Alteração de PIN */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] border border-indigo-500/30 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6 animate-scale-in text-white">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {pinModalMode === 'create' && 'Criar Senha do App'}
                    {pinModalMode === 'change' && 'Alterar Senha do App'}
                    {pinModalMode === 'remove' && 'Remover Senha do App'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {pinModalMode === 'remove'
                      ? 'Digite sua senha atual para desativar o bloqueio'
                      : 'Defina um PIN numérico de 4 a 8 dígitos'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPinModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePinModal} className="space-y-4">
              {/* Se já existe PIN e está alterando ou removendo, pede o PIN atual */}
              {pinHash && (pinModalMode === 'change' || pinModalMode === 'remove') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    PIN Atual
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    placeholder="Digite seu PIN atual"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    value={pinForm.currentPin}
                    onChange={(e) => setPinForm({ ...pinForm, currentPin: e.target.value.replace(/\D/g, '') })}
                    required
                    autoFocus
                  />
                </div>
              )}

              {/* Campos para Novo PIN (apenas nos modos 'create' e 'change') */}
              {pinModalMode !== 'remove' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Novo PIN (4 a 8 dígitos)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      placeholder="Ex: 1234"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      value={pinForm.newPin}
                      onChange={(e) => setPinForm({ ...pinForm, newPin: e.target.value.replace(/\D/g, '') })}
                      required
                      autoFocus={!pinHash}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Confirmar Novo PIN
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      placeholder="Digite o mesmo PIN novamente"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      value={pinForm.confirmNewPin}
                      onChange={(e) => setPinForm({ ...pinForm, confirmNewPin: e.target.value.replace(/\D/g, '') })}
                      required
                    />
                  </div>
                </>
              )}

              {pinFormError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-bold text-center animate-fade-in">
                  {pinFormError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 text-xs cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-3 font-bold rounded-xl transition-all text-xs cursor-pointer shadow-lg ${
                    pinModalMode === 'remove'
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
                  }`}
                >
                  {pinModalMode === 'create' && 'SALVAR PIN'}
                  {pinModalMode === 'change' && 'ATUALIZAR PIN'}
                  {pinModalMode === 'remove' && 'REMOVER SENHA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Bottom Sheet de Lançamento Rápido */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0f172a] border border-white/15 w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 space-y-4 animate-slide-up max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <h3 className="text-base sm:text-lg font-black text-white">Lançamento Rápido</h3>
              </div>
              <button
                onClick={() => setIsQuickAddOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 cursor-pointer"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <AddTransactionForm
              onAdd={handleAddTransaction}
              onAddMany={handleBulkAdd}
              cartoes={cartoes}
              partner1={partner1}
              partner2={partner2}
              initialType={quickAddType}
              onSuccess={() => setIsQuickAddOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Modal: Quem pagou/recebeu? (ajuste automático de saldo e rateio 50/50 ou custom) */}
      {pendingPaidTx && (
        (() => {
          const pt = transactions.find(x => x.id === pendingPaidTx);
          const isReceita = pt && pt.type === 'income';
          const amount = pt ? Number(pt.amount || 0) : 0;
          const saldos = getSaldo();
          const p1Current = saldos.alle;
          const p2Current = saldos.kelly;
          const half = Math.round((amount / 2) * 100) / 100;
          const rest = Math.round((amount - half) * 100) / 100;

          const p1Next100 = isReceita ? p1Current + amount : p1Current - amount;
          const p2Next100 = isReceita ? p2Current + amount : p2Current - amount;
          const p1NextHalf = isReceita ? p1Current + half : p1Current - half;
          const p2NextHalf = isReceita ? p2Current + rest : p2Current - rest;

          const fmt = (val) => Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const isComum = pt && pt.quem && pt.quem.startsWith('Comum');

          const customAlleNum = parseFloat(String(customPayAlle).replace(',', '.')) || 0;
          const customKellyNum = parseFloat(String(customPayKelly).replace(',', '.')) || 0;
          const customSum = Math.round((customAlleNum + customKellyNum) * 100) / 100;
          const isSumExact = Math.abs(customSum - amount) < 0.02;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Quem pagou">
              <div className="bg-[#121827] border border-white/15 w-full max-w-md rounded-3xl shadow-2xl p-4 sm:p-6 space-y-4 animate-scale-in">
                <div className="flex justify-between items-center pb-2.5 border-b border-white/10">
                  <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                    <span>{isReceita ? '💰' : '💳'}</span>
                    {isReceita ? 'Quem recebeu?' : 'Quem realizou o pagamento?'}
                  </h3>
                  <button
                    onClick={cancelPaidWho}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer text-xs"
                    aria-label="Fechar"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-[#0a0e1a] rounded-2xl p-3.5 border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-white truncate max-w-[220px]">{pt && pt.description}</p>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border bg-white/5 border-white/10 text-slate-300 shrink-0">
                      {pt?.quem === 'Eu' ? `💜 ${partner1}` : pt?.quem === 'Outro' ? `💖 ${partner2}` : '🏡 Comum (50/50)'}
                    </span>
                  </div>
                  <p className="text-xl font-black text-emerald-400">
                    R$ {fmt(amount)}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {isReceita
                      ? 'Selecione quem recebeu ou divida a entrada entre ambos.'
                      : isComum
                        ? 'Esta conta é compartilhada. Escolha se foi dividida 50/50, paga inteira por um ou rateada.'
                        : 'Escolha quem pagou para debitar do saldo e atualizar o acerto de contas.'}
                  </p>
                </div>

                {!customPayMode ? (
                  <div className="space-y-2">
                    {/* Opção 1: 50/50 Meio a meio */}
                    <button
                      type="button"
                      onClick={() => confirmPaidWho({ whoPaid: '50_50', alleAmount: half, kellyAmount: rest })}
                      className="w-full flex items-center justify-between p-3 rounded-2xl bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-white cursor-pointer transition-all active:scale-[0.99] group text-left"
                    >
                      <div>
                        <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                          <span>⚖️</span> Dividido 50/50 (Meio a meio)
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          R$ {fmt(half)} do saldo de cada um • Sem acerto pendente
                        </span>
                      </div>
                      <span className="text-xs font-black text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-xl">
                        R$ {fmt(half)} cada
                      </span>
                    </button>

                    {/* Opção 2 e 3: Alle 100% ou Kelly 100% */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => confirmPaidWho({ whoPaid: 'alle', alleAmount: amount, kellyAmount: 0 })}
                        className="flex flex-col p-3 rounded-2xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-white cursor-pointer shadow-md transition-all active:scale-[0.98] group text-left"
                      >
                        <span className="text-xs font-black text-purple-300 flex items-center gap-1 mb-0.5">
                          💜 100% {partner1}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isReceita ? 'Recebe tudo' : 'Paga tudo'}
                        </span>
                        <span className={`text-[10px] font-bold mt-1.5 ${isReceita ? 'text-emerald-400' : 'text-purple-300'}`}>
                          Saldo: R$ {fmt(p1Next100)}
                        </span>
                        {isComum && !isReceita && (
                          <span className="text-[9px] text-purple-300/80 mt-1 font-medium leading-tight">
                            {partner2} fica devendo R$ {fmt(half)}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => confirmPaidWho({ whoPaid: 'kelly', alleAmount: 0, kellyAmount: amount })}
                        className="flex flex-col p-3 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-white cursor-pointer shadow-md transition-all active:scale-[0.98] group text-left"
                      >
                        <span className="text-xs font-black text-rose-300 flex items-center gap-1 mb-0.5">
                          💖 100% {partner2}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isReceita ? 'Recebe tudo' : 'Paga tudo'}
                        </span>
                        <span className={`text-[10px] font-bold mt-1.5 ${isReceita ? 'text-emerald-400' : 'text-rose-300'}`}>
                          Saldo: R$ {fmt(p2Next100)}
                        </span>
                        {isComum && !isReceita && (
                          <span className="text-[9px] text-rose-300/80 mt-1 font-medium leading-tight">
                            {partner1} fica devendo R$ {fmt(half)}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Opção 4: Personalizado / Editável */}
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPayMode(true);
                        setCustomPayAlle(half.toFixed(2));
                        setCustomPayKelly(rest.toFixed(2));
                      }}
                      className="w-full py-2.5 px-3 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 text-indigo-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>✏️</span> Divisão Personalizada (Digitar valores exatos)
                    </button>
                  </div>
                ) : (
                  /* MODO PERSONALIZADO */
                  <div className="space-y-3 p-3.5 rounded-2xl bg-[#0a0e1a] border border-indigo-500/30 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-indigo-300 uppercase tracking-wider">
                        Digitar Rateio Exato
                      </span>
                      <button
                        type="button"
                        onClick={() => setCustomPayMode(false)}
                        className="text-[10px] font-bold text-slate-400 hover:text-white underline cursor-pointer"
                      >
                        Voltar às opções
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-purple-300 uppercase">
                          Pago por {partner1} (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={customPayAlle}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomPayAlle(val);
                            const n = parseFloat(val) || 0;
                            if (amount > 0 && n <= amount) {
                              setCustomPayKelly((amount - n).toFixed(2));
                            }
                          }}
                          className="w-full bg-[#121827] border border-purple-500/40 rounded-xl px-3 py-2 text-sm font-black text-white focus:outline-none focus:border-purple-400"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-rose-300 uppercase">
                          Pago por {partner2} (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={customPayKelly}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomPayKelly(val);
                            const n = parseFloat(val) || 0;
                            if (amount > 0 && n <= amount) {
                              setCustomPayAlle((amount - n).toFixed(2));
                            }
                          }}
                          className="w-full bg-[#121827] border border-rose-500/40 rounded-xl px-3 py-2 text-sm font-black text-white focus:outline-none focus:border-rose-400"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-400">Total da conta: R$ {fmt(amount)}</span>
                      <span className={`font-black ${isSumExact ? 'text-emerald-400' : 'text-amber-400'}`}>
                        Soma: R$ {fmt(customSum)} {isSumExact ? '✅' : '⚠️'}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={customSum <= 0}
                      onClick={() => confirmPaidWho({ whoPaid: 'custom', alleAmount: customAlleNum, kellyAmount: customKellyNum })}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                    >
                      Confirmar Pagamento Personalizado
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={cancelPaidWho}
                  className="w-full py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
                >
                  Cancelar (manter pendente)
                </button>
              </div>
            </div>
          );
        })()
      )}

      {/* Modal: Quem pagou a Fatura do Cartão? (ajuste automático de saldo) */}
      {pendingPayInvoice && (
        (() => {
          const { cardName, faturaTotal } = pendingPayInvoice;
          const saldos = getSaldo();
          const p1Current = saldos.alle;
          const p2Current = saldos.kelly;
          const half = Math.round((faturaTotal / 2) * 100) / 100;
          const p1Next = p1Current - faturaTotal;
          const p2Next = p2Current - faturaTotal;
          const fmt = (val) => Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Quem pagou a fatura">
              <div className="bg-[#121827] border border-purple-500/30 w-full max-w-sm rounded-2xl shadow-2xl p-4 sm:p-5 space-y-3.5 animate-scale-in">
                <div className="flex justify-between items-center pb-2 border-b border-white/10">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>💳</span>
                    Pagar Fatura - {cardName}
                  </h3>
                  <button
                    onClick={cancelPayInvoice}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer text-xs"
                    aria-label="Fechar"
                  >
                    ✕
                  </button>
                </div>

                <div className="bg-[#0a0e1a] rounded-xl p-3 border border-purple-500/20 space-y-1">
                  <p className="text-xs font-bold text-purple-300 truncate">Fatura {cardName}</p>
                  <p className="text-base font-black text-rose-400">
                    R$ {fmt(faturaTotal)}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Escolha quem realizou o pagamento para debitar este valor do saldo em conta:
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  {/* Opção 50/50 na fatura */}
                  <button
                    type="button"
                    onClick={() => confirmPayInvoice('50_50')}
                    className="w-full p-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-white cursor-pointer shadow-md transition-all active:scale-95 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-xs font-black text-emerald-300 flex items-center gap-1">
                        ⚖️ Pagar 50/50 (Metade de cada saldo)
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        R$ {fmt(half)} do saldo de {partner1} e de {partner2}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-lg">
                      50% cada
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => confirmPayInvoice('alle')}
                      className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-white cursor-pointer shadow-md transition-all active:scale-95 group text-left"
                    >
                      <span className="text-xs font-black text-purple-300 flex items-center gap-1 mb-0.5">
                        💜 {partner1}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Saldo: R$ {fmt(p1Current)}
                      </span>
                      <span className="text-[10px] font-bold text-rose-300">
                        ➔ R$ {fmt(p1Next)}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => confirmPayInvoice('kelly')}
                      className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-white cursor-pointer shadow-md transition-all active:scale-95 group text-left"
                    >
                      <span className="text-xs font-black text-rose-300 flex items-center gap-1 mb-0.5">
                        💖 {partner2}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Saldo: R$ {fmt(p2Current)}
                      </span>
                      <span className="text-[10px] font-bold text-rose-300">
                        ➔ R$ {fmt(p2Next)}
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={cancelPayInvoice}
                  className="w-full py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/5 cursor-pointer transition-colors"
                >
                  Cancelar (não alterar fatura)
                </button>
              </div>
            </div>
          );
        })()
      )}

      {/* Modal de Confirmação: Liquidar Acerto do Casal (Pix) */}
      {pendingSettleDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Liquidar Acerto">
          <div className="bg-[#121827] border border-emerald-500/30 w-full max-w-md rounded-3xl shadow-2xl p-4 sm:p-6 space-y-4 animate-scale-in">
            <div className="flex justify-between items-center pb-2.5 border-b border-white/10">
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <span>💸</span>
                Liquidar Acerto do Casal (Pix)
              </h3>
              <button
                onClick={() => setPendingSettleDebt(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer text-xs"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#0a0e1a] rounded-2xl p-4 border border-emerald-500/20 space-y-2 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Transferência de Equilíbrio
              </p>
              <div className="flex items-center justify-center gap-2 text-sm font-black text-white">
                <span className="text-rose-400">{pendingSettleDebt.debtor}</span>
                <span className="text-slate-500">➔</span>
                <span className="text-purple-400">{pendingSettleDebt.creditor}</span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400">
                R$ {Number(pendingSettleDebt.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed text-left pt-1">
                Ao confirmar que o Pix foi realizado, este valor será debitado do saldo bancário de <strong>{pendingSettleDebt.debtor}</strong> e creditado em <strong>{pendingSettleDebt.creditor}</strong>. Uma transação de acerto será gravada no extrato e as contas do mês ficarão equilibradas!
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setPendingSettleDebt(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmSettleDebt}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-emerald-500/25 cursor-pointer transition-all active:scale-95"
              >
                Confirmar Pix Feito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tela de Bloqueio por Senha (AppLock) */}
      {isLocked && pinHash && (
        <AppLock
          pinHash={pinHash}
          onUnlock={handleUnlock}
          partner1={partner1}
          partner2={partner2}
        />
      )}
    </main>
  );
}