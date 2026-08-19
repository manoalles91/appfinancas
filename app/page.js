'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Dashboard from '@/components/Dashboard';
import TransactionList from '@/components/TransactionList';
import AddTransactionForm from '@/components/AddTransactionForm';
import Reports from '@/components/Reports';
import NavTabs from '@/components/NavTabs';
import ConfirmDialog from '@/components/ConfirmDialog';
import CSVManager from '@/components/CSVManager';
import CategoriesEditor from '@/components/CategoriesEditor';
import { useToast } from '@/components/ui/toast';
import { Sparkles, CreditCard, Trash2, Edit3, Plus, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle, Settings, Home as HomeIcon, ArrowLeftRight, PieChart, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';

const TABS = [
  { id: 'inicio', label: 'Início', icon: HomeIcon },
  { id: 'transacoes', label: 'Transações', icon: ArrowLeftRight },
  { id: 'cartoes', label: 'Cartões', icon: CreditCard },
  { id: 'relatorios', label: 'Relatórios', icon: PieChart },
  { id: 'config', label: 'Configurações', icon: Settings },
];

export default function Home() {
  const [transactions, setTransactions] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('inicio');
  const { toast } = useToast();

  const [partner1, setPartner1] = useState('Alle');
  const [partner2, setPartner2] = useState('Kelly');

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

  // States para confirmação de exclusão e reset
  const [txToDelete, setTxToDelete] = useState(null);
  const [cardToDelete, setCardToDelete] = useState(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmInput, setResetConfirmInput] = useState('');

  // Carrega nomes do localStorage (padrão Kelly se não definido)
  useEffect(() => {
    const p1 = localStorage.getItem('fincasal_partner1');
    const p2 = localStorage.getItem('fincasal_partner2');
    if (p1) setPartner1(p1);
    if (p2 && p2 !== 'Esposa') setPartner2(p2);
    else {
      setPartner2('Kelly');
      localStorage.setItem('fincasal_partner2', 'Kelly');
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });
      if (txError) throw txError;
      setTransactions(txData || []);

      const { data: cardsData, error: cardsError } = await supabase
        .from('cartoes')
        .select('*');
      if (cardsError) throw cardsError;
      setCartoes(cardsData || []);
    } catch (error) {
      console.error('Error fetching data:', error.message);
      toast('Erro ao carregar dados: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const monthTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      const isCurrentMonth = d.getMonth() === viewDate.getMonth() && d.getFullYear() === viewDate.getFullYear();
      const isPendingExpense = !t.pago && t.type === 'expense';
      return isCurrentMonth || isPendingExpense;
    });
  }, [transactions, viewDate]);

  const cardsSummary = useMemo(() => {
    const viewMonth = viewDate.getMonth();
    const viewYear = viewDate.getFullYear();

    return cartoes.map(card => {
      const matches = transactions.filter(t => {
        const d = new Date(t.date);
        return t.card_name === card.nome &&
               t.type === 'credit' &&
               d.getMonth() === viewMonth &&
               d.getFullYear() === viewYear;
      });

      const faturaAtual = matches.reduce((acc, t) => acc + Number(t.amount || 0), 0);
      const isPaga = matches.length > 0 && matches.every(t => t.pago);
      const limite = Number(card.limite || 0);

      return {
        ...card,
        faturaAtual,
        isPaga,
        totalItems: matches.length,
        disponivel: limite - faturaAtual,
        percentual: limite > 0 ? (faturaAtual / limite) * 100 : 0
      };
    });
  }, [cartoes, transactions, viewDate]);

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
    const next = new Date(viewDate);
    next.setMonth(next.getMonth() + offset);
    setViewDate(next);
  };

  const handleAddTransaction = useCallback(async (newTransaction) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert([{
        description: newTransaction.description,
        amount: newTransaction.amount,
        type: newTransaction.type,
        category: newTransaction.category,
        date: newTransaction.date,
        card_name: newTransaction.cardName,
        installment_info: newTransaction.installmentInfo,
        pago: newTransaction.pago,
        fixa: newTransaction.fixa,
        payment_method: newTransaction.payment_method,
        quem: newTransaction.quem || 'Comum',
        subcategoria: newTransaction.subcategoria || '',
        destino: newTransaction.destino || '',
        ajuste: newTransaction.ajuste || 0
      }])
      .select();
    if (error) throw error;
    setTransactions(prev => [data[0], ...prev]);
  }, []);

  const handleBulkAdd = useCallback(async (items, successMessage) => {
    try {
      const CHUNK = 500;
      for (let i = 0; i < items.length; i += CHUNK) {
        const { error } = await supabase.from('transactions').insert(items.slice(i, i + CHUNK));
        if (error) throw error;
      }
      await fetchData();
      toast(successMessage || `${items.length} transações adicionadas!`);
    } catch (error) {
      console.error('Error adding transactions:', error.message);
      toast('Erro ao adicionar: ' + error.message, 'error');
    }
  }, [fetchData, toast]);

  const handleImportTransactions = useCallback(async (items) => {
    await handleBulkAdd(items, `${items.length} transações importadas com sucesso!`);
  }, [handleBulkAdd]);

  const confirmDeleteTransaction = useCallback(async () => {
    if (!txToDelete) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', txToDelete);
      if (error) throw error;
      setTransactions(prev => prev.filter(t => t.id !== txToDelete));
      toast('Transação excluída.');
      setTxToDelete(null);
    } catch (error) {
      console.error('Error deleting transaction:', error.message);
      toast('Erro ao excluir: ' + error.message, 'error');
    }
  }, [txToDelete, toast]);

  const handleResetAllTransactions = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .not('id', 'is', null);
      if (error) throw error;
      setTransactions([]);
      setIsResetModalOpen(false);
      setResetConfirmInput('');
      toast('Todas as transações foram apagadas.');
    } catch (error) {
      console.error('Error resetting transactions:', error.message);
      toast('Erro ao resetar transações: ' + error.message, 'error');
    }
  }, [toast]);

  const handlePayInvoice = useCallback(async (cardName, targetStatus) => {
    try {
      const viewMonth = viewDate.getMonth();
      const viewYear = viewDate.getFullYear();
      const cardTxs = transactions.filter(t => {
        const d = new Date(t.date);
        return t.card_name === cardName &&
               t.type === 'credit' &&
               d.getMonth() === viewMonth &&
               d.getFullYear() === viewYear;
      });

      if (cardTxs.length === 0) {
        toast(`Nenhuma compra de cartão encontrada no mês atual para o cartão ${cardName}.`, 'error');
        return;
      }

      const txIds = cardTxs.map(t => t.id);

      const { error } = await supabase
        .from('transactions')
        .update({ pago: targetStatus })
        .in('id', txIds);

      if (error) throw error;

      setTransactions(prev => prev.map(t => txIds.includes(t.id) ? { ...t, pago: targetStatus } : t));
      toast(targetStatus ? `Fatura do ${cardName} marcada como PAGA!` : `Fatura do ${cardName} reaberta.`);
    } catch (error) {
      console.error('Error updating invoice status:', error.message);
      toast('Erro ao atualizar fatura: ' + error.message, 'error');
    }
  }, [transactions, viewDate, toast]);

  const handleTogglePaid = useCallback(async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ pago: newStatus })
        .eq('id', id);
      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, pago: newStatus } : t));
    } catch (error) {
      console.error('Error updating transaction status:', error.message);
      toast('Erro ao atualizar transação: ' + error.message, 'error');
    }
  }, [toast]);

  const handleAdjustAmount = useCallback(async (id, amount) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ amount })
        .eq('id', id);
      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, amount } : t));
      toast('Valor ajustado para ' + amount.toFixed(2).replace('.', ','));
    } catch (error) {
      console.error('Error adjusting amount:', error.message);
      toast('Erro ao ajustar valor: ' + error.message, 'error');
    }
  }, [toast]);

  const handleDeleteByNome = useCallback(async (nome) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('description', nome)
        .ilike('installment_info', '%/%');
      if (error) throw error;
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error deleting financing parcels:', error.message);
      toast('Erro ao remover parcelas: ' + error.message, 'error');
      return false;
    }
  }, [fetchData, toast]);

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

  const monthName = viewDate.toLocaleDateString('pt-BR', { month: 'long' });
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const openTransactionsWithPending = () => {
    setTransactionStatusFilter('pending');
    setActiveTab('transacoes');
  };

  const filterByCard = (cardName) => {
    setSelectedCardFilter(selectedCardFilter === cardName ? null : cardName);
    setActiveTab('transacoes');
  };

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-200 p-4 md:p-6 lg:p-8 pb-28 md:pb-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
              <Sparkles className="h-6 w-6 text-indigo-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Minhas Finanças</h1>
                <button
                  onClick={() => setActiveTab('config')}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 hover:border-slate-600 transition-all text-slate-400 hover:text-white cursor-pointer"
                  title="Configurações do Casal"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
              <p className="text-slate-400 font-medium text-sm">Controle Compartilhado ({partner1} & {partner2})</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors text-slate-400 hover:text-white cursor-pointer">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-bold w-28 text-center text-white uppercase tracking-wider">
              {monthLabel}
            </span>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors text-slate-400 hover:text-white cursor-pointer">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </header>

        <NavTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

        {/* Aba: Início */}
        {activeTab === 'inicio' && (
          <div className="space-y-6">
            {pendingUrgentTransactions.length > 0 && (
              <div className="flex flex-col items-center justify-center p-8 bg-slate-800/40 rounded-3xl border border-red-500/30 text-center space-y-4 animate-fade-in shadow-2xl">
                <div className="text-5xl">🚨</div>
                <div className="space-y-1">
                  <p className="text-slate-300 font-medium">
                    Você tem <span className="text-red-400 font-bold">{pendingUrgentTransactions.length} despesas urgentes (vencidas ou a vencer)</span> no total de
                    <span className="text-red-400 font-bold"> R$ {pendingUrgentTransactions.reduce((acc, t) => acc + Number(t.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </p>
                  <button
                    onClick={openTransactionsWithPending}
                    className="text-red-400 font-bold hover:underline cursor-pointer"
                  >
                    Verificar
                  </button>
                </div>
              </div>
            )}

            <Dashboard
              transactions={monthTransactions}
              allTransactions={transactions}
              partner1={partner1}
              partner2={partner2}
              onAddMany={handleBulkAdd}
              onDeleteByNome={handleDeleteByNome}
            />
          </div>
        )}

        {/* Aba: Transações */}
        {activeTab === 'transacoes' && (
          <div className="space-y-6">
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

            <CSVManager
              transactions={transactions}
              onImport={handleImportTransactions}
            />

            <div className="grid gap-8 lg:grid-cols-2">
              <AddTransactionForm
                onAdd={handleAddTransaction}
                onAddMany={handleBulkAdd}
                cartoes={cartoes}
                partner1={partner1}
                partner2={partner2}
              />
              <TransactionList
                transactions={monthTransactions}
                onDelete={setTxToDelete}
                onTogglePaid={handleTogglePaid}
                onAdjustAmount={handleAdjustAmount}
                statusFilter={transactionStatusFilter}
                onStatusFilterChange={setTransactionStatusFilter}
                partner1={partner1}
                partner2={partner2}
                selectedCardFilter={selectedCardFilter}
                onClearCardFilter={() => setSelectedCardFilter(null)}
                viewDate={viewDate}
              />
            </div>
          </div>
        )}

        {/* Aba: Cartões */}
        {activeTab === 'cartoes' && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-indigo-400" />
                Cartões de Crédito
              </h2>
              <button
                onClick={() => setIsAddCardModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-extrabold transition-all cursor-pointer shadow-lg shadow-indigo-500/20 border border-indigo-400/30 hover:scale-105"
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
                {cardsSummary.map((card) => (
                  <Card key={card.id} className="bg-[#1e293b] border-slate-800 shadow-xl overflow-hidden group hover:border-slate-700 transition-all">
                    <CardContent className="p-6 space-y-6">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-xl ${
                            card.nome === 'Nubank' ? 'bg-[#8a05be]' :
                            card.nome === 'Inter' ? 'bg-[#ff7a00]' :
                            card.nome === 'Sicoob' ? 'bg-[#003641]' : 'bg-[#17469e]'
                          }`}>
                            {card.nome.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-white">{card.nome}</h3>
                            <p className="text-xs text-slate-400 uppercase tracking-wider">{card.bandeira || 'MasterCard'}</p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                          card.isPaga
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }`}>
                          {card.isPaga ? 'Paga' : 'Aberta'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center bg-slate-900/40 p-3 rounded-xl border border-slate-800/50">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase font-black">Limite</p>
                          <p className="text-xs font-bold text-slate-300">R${Number(card.limite).toLocaleString('pt-BR')}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-red-400 uppercase font-black">Em Aberto</p>
                          <p className="text-xs font-bold text-red-400">R${card.faturaAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-emerald-400 uppercase font-black">Livre</p>
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
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                          <span>{Math.round(card.percentual)}% utilizado</span>
                          <span>Disponível: {Math.round(100 - card.percentual)}%</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-end pt-4 border-t border-slate-800">
                        <div className="text-[10px] text-slate-400 space-y-1">
                          <p>Vencimento: <span className="text-slate-200">dia {card.vencimento}</span></p>
                          <p>Fechamento: <span className="text-slate-200">dia {card.fechamento}</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 uppercase font-black">Fatura {monthLabel}</p>
                          <p className="text-xl font-black text-white">R$ {card.faturaAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePayInvoice(card.nome, !card.isPaga)}
                            className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                              card.isPaga
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500/30 shadow-lg shadow-emerald-500/20'
                            }`}
                          >
                            {card.isPaga ? 'REABRIR FATURA' : 'PAGAR FATURA'}
                          </button>
                          <button
                            onClick={() => filterByCard(card.nome)}
                            className={`px-3 py-2.5 text-xs font-black rounded-xl transition-all border cursor-pointer ${
                              selectedCardFilter === card.nome
                              ? 'bg-purple-500/30 text-purple-300 border-purple-500/50'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                            }`}
                            title="Filtrar compras deste cartão"
                          >
                            COMPRAS
                          </button>
                        </div>
                        <button
                          onClick={() => { setEditingCard(card); setIsEditModalOpen(true); }}
                          className="w-full py-2 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] font-bold rounded-xl transition-all border border-slate-800/80 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" /> Reajustar Limite e Datas
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Aba: Relatórios */}
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
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">Os nomes são salvos automaticamente neste dispositivo.</p>
              </CardContent>
            </Card>

            <CategoriesEditor />

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

      {/* Modal de Confirmação de Reset de Transações */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] border border-red-500/40 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6 animate-scale-in">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-red-500 animate-bounce" /> Resetar Transações
              </h3>
              <button onClick={() => { setIsResetModalOpen(false); setResetConfirmInput(''); }} className="text-slate-400 hover:text-white p-1 cursor-pointer">
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
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setIsResetModalOpen(false); setResetConfirmInput(''); }}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 text-xs cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                type="button"
                disabled={resetConfirmInput.trim().toUpperCase() !== 'RESETAR'}
                onClick={handleResetAllTransactions}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" /> APAGAR TUDO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de exclusão de transação */}
      <ConfirmDialog
        open={!!txToDelete}
        title="Excluir Transação"
        message="Deseja excluir esta transação? Esta ação não pode ser desfeita."
        confirmLabel="EXCLUIR"
        cancelLabel="CANCELAR"
        danger
        onConfirm={confirmDeleteTransaction}
        onCancel={() => setTxToDelete(null)}
      />

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
    </main>
  );
}