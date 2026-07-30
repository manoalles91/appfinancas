'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Dashboard from '@/components/Dashboard';
import TransactionList from '@/components/TransactionList';
import AddTransactionForm from '@/components/AddTransactionForm';
import { Sparkles, CreditCard, Trash2, Edit3, Plus, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';

const BUILD_TIME = '30/07/2026 13:45';

export default function Home() {
  const [transactions, setTransactions] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  
  // Nomes dos parceiros para compartilhamento (Padrão: Alle & Kelly)
  const [partner1, setPartner1] = useState('Alle');
  const [partner2, setPartner2] = useState('Kelly');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // States para edição de cartão
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all');
  const [selectedCardFilter, setSelectedCardFilter] = useState(null);

  // State para reset de transações
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
    } finally {
      setLoading(false);
    }
  }, []);

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
    try {
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
    } catch (error) {
      console.error('Error adding transaction:', error.message);
    }
  }, []);

  const handleDeleteTransaction = useCallback(async (id) => {
    if (!confirm('Deseja excluir esta transação?')) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting transaction:', error.message);
    }
  }, []);

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
      alert('Todas as transações foram apagadas com sucesso!');
    } catch (error) {
      console.error('Error resetting transactions:', error.message);
      alert('Erro ao resetar transações: ' + error.message);
    }
  }, []);

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
        alert(`Nenhuma compra de cartão encontrada no mês atual para o cartão ${cardName}.`);
        return;
      }

      const txIds = cardTxs.map(t => t.id);

      const { error } = await supabase
        .from('transactions')
        .update({ pago: targetStatus })
        .in('id', txIds);

      if (error) throw error;

      setTransactions(prev => prev.map(t => txIds.includes(t.id) ? { ...t, pago: targetStatus } : t));
      alert(targetStatus ? `Fatura do ${cardName} marcada como PAGA com sucesso!` : `Fatura do ${cardName} REABERTA!`);
    } catch (error) {
      console.error('Error updating invoice status:', error.message);
      alert('Erro ao atualizar fatura: ' + error.message);
    }
  }, [transactions, viewDate]);

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
    }
  }, []);

  const handleUpdateCard = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('cartoes')
        .update({
          limite: editingCard.limite,
          vencimento: editingCard.vencimento,
          fechamento: editingCard.fechamento
        })
        .eq('id', editingCard.id);
      
      if (error) throw error;
      
      setCartoes(prev => prev.map(c => c.id === editingCard.id ? editingCard : c));
      setIsEditModalOpen(false);
      setEditingCard(null);
    } catch (error) {
      alert('Erro ao atualizar cartão: ' + error.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#0f172a] text-white">Carregando...</div>;

  const monthName = viewDate.toLocaleDateString('pt-BR', { month: 'long' });

  return (
    <main className="min-h-screen bg-[#0f172a] text-slate-200 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Banner de Última Atualização */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-indigo-600/90 backdrop-blur-md border-b border-indigo-500/30">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/90">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            App atualizado: {BUILD_TIME}
          </div>
        </div>

        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800 pt-8">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
              <Sparkles className="h-6 w-6 text-indigo-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white">Minhas Finanças</h1>
                <button 
                  onClick={() => setIsSettingsOpen(true)} 
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 hover:border-slate-600 transition-all text-slate-400 hover:text-white cursor-pointer"
                  title="Configurações do Casal"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
              <p className="text-slate-400 font-medium text-sm">Controle Compartilhado ({partner1} & {partner2})</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-red-500/5"
              title="Resetar todas as transações do sistema"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Resetar Transações</span>
            </button>

            <div className="flex items-center gap-4 bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors text-slate-400 hover:text-white">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-bold w-24 text-center text-white uppercase tracking-wider">
                {monthName}
              </span>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-700 rounded-xl transition-colors text-slate-400 hover:text-white">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <Dashboard 
          transactions={monthTransactions} 
          partner1={partner1} 
          partner2={partner2} 
        />

        {/* Card de Resumo de Pendências (Estilo Print) */}
        {pendingUrgentTransactions.length > 0 && (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-800/40 rounded-3xl border border-red-500/30 text-center space-y-4 animate-fade-in shadow-2xl">
            <div className="text-5xl">🚨</div>
            <div className="space-y-1">
              <p className="text-slate-300 font-medium">
                Você tem <span className="text-red-400 font-bold">{pendingUrgentTransactions.length} despesas urgentes (vencidas ou a vencer)</span> no total de 
                <span className="text-red-400 font-bold"> R$ {pendingUrgentTransactions.reduce((acc, t) => acc + Number(t.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </p>
              <button 
                onClick={() => {
                  setTransactionStatusFilter('pending');
                  const list = document.getElementById('transactions-list');
                  list?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-red-400 font-bold hover:underline cursor-pointer"
              >
                Verificar
              </button>
            </div>
          </div>
        )}

        <section className="space-y-6">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-400" />
            Cartões de Crédito
          </h2>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {cardsSummary.map((card) => (
              <Card key={card.id} className="bg-[#1e293b] border-slate-800 shadow-xl overflow-hidden group hover:border-slate-700 transition-all">
                <CardContent className="p-6 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-xl ${
                        card.nome === 'Nubank' ? 'bg-[#8a05be]' : 
                        card.nome === 'Inter' ? 'bg-[#ff7a00]' : 'bg-[#17469e]'
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
                      {card.isPaga ? '✅ Paga' : '⏳ Aberta'}
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
                      <p className="text-[10px] text-slate-500 uppercase font-black">Fatura {monthName}</p>
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
                        {card.isPaga ? '🔄 REABRIR FATURA' : '💳 PAGAR FATURA'}
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedCardFilter(selectedCardFilter === card.nome ? null : card.nome);
                          const list = document.getElementById('transactions-list');
                          list?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`px-3 py-2.5 text-xs font-black rounded-xl transition-all border cursor-pointer ${
                          selectedCardFilter === card.nome
                          ? 'bg-purple-500/30 text-purple-300 border-purple-500/50'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                        title="Filtrar compras deste cartão"
                      >
                        🔍 COMPRAS
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
        </section>

        {/* Filtro de Cartão Ativo (se houver) */}
        {selectedCardFilter && (
          <div className="flex items-center justify-between p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl animate-fade-in">
            <span className="text-xs font-bold text-purple-300 flex items-center gap-2">
              💳 Exibindo apenas transações do cartão: <strong className="text-white font-black">{selectedCardFilter}</strong>
            </span>
            <button
              onClick={() => setSelectedCardFilter(null)}
              className="text-xs font-bold text-purple-400 hover:text-white bg-purple-500/20 px-2.5 py-1 rounded-xl transition-all cursor-pointer"
            >
              ✕ Ver Todas
            </button>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2" id="transactions-list">
          <AddTransactionForm 
            onAdd={handleAddTransaction} 
            cartoes={cartoes} 
            partner1={partner1} 
            partner2={partner2} 
          />
          <TransactionList 
            transactions={monthTransactions} 
            onDelete={handleDeleteTransaction} 
            onTogglePaid={handleTogglePaid}
            statusFilter={transactionStatusFilter}
            onStatusFilterChange={setTransactionStatusFilter}
            partner1={partner1} 
            partner2={partner2}
            selectedCardFilter={selectedCardFilter}
            onClearCardFilter={() => setSelectedCardFilter(null)}
          />
        </div>
      </div>

      {/* Modal de Edição de Cartão */}
      {isEditModalOpen && editingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6 animate-scale-in">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-indigo-400" /> Reajustar {editingCard.nome}
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <Plus className="h-6 w-6 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleUpdateCard} className="space-y-4">
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

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-700"
                >
                  CANCELAR
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                >
                  SALVAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Configurações do Casal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] border border-slate-700 w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-6 animate-scale-in">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-indigo-400" /> Configurações do Casal
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white p-1">
                <Plus className="h-6 w-6 rotate-45" />
              </button>
            </div>

            <div className="space-y-4">
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

              <div className="pt-4">
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                >
                  SALVAR
                </button>
              </div>
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
              <button onClick={() => { setIsResetModalOpen(false); setResetConfirmInput(''); }} className="text-slate-400 hover:text-white p-1">
                <Plus className="h-6 w-6 rotate-45" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                Esta ação irá <strong className="text-red-400">excluir permanentemente todas as transações</strong> do banco de dados. Os cartões permanecerão cadastrados.
              </p>
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                ⚠️ Digite <strong className="font-bold">RESETAR</strong> no campo abaixo para confirmar.
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
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all border border-slate-700 text-xs"
              >
                CANCELAR
              </button>
              <button
                type="button"
                disabled={resetConfirmInput.trim().toUpperCase() !== 'RESETAR'}
                onClick={handleResetAllTransactions}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 text-xs flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" /> APAGAR TUDO
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
