'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Dashboard from '@/components/Dashboard';
import TransactionList from '@/components/TransactionList';
import AddTransactionForm from '@/components/AddTransactionForm';
import { Sparkles, CreditCard, Trash2, Edit3, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  const [transactions, setTransactions] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  
  // States para edição de cartão
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);

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
      const isPending = !t.pago && (t.type === 'expense' || t.type === 'credit');
      // Mostra transações do mês OU qualquer despesa que ainda não foi paga
      return isCurrentMonth || isPending;
    });
  }, [transactions, viewDate]);

  const cardsSummary = useMemo(() => {
    const prevMonthDate = new Date(viewDate);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();

    return cartoes.map(card => {
      const matches = transactions.filter(t => {
        const d = new Date(t.date + 'T12:00:00');
        return t.card_name === card.nome && 
               t.type === 'credit' && 
               d.getMonth() === prevMonth && 
               d.getFullYear() === prevYear;
      });

      const faturaMesAnterior = matches.reduce((acc, t) => acc + Number(t.amount), 0);
      
      const limite = Number(card.limite);
      return {
        ...card,
        faturaAtual: faturaMesAnterior,
        disponivel: limite - faturaMesAnterior,
        percentual: (faturaMesAnterior / limite) * 100
      };
    });
  }, [cartoes, transactions, viewDate]);

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
          payment_method: newTransaction.payment_method
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
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]">
              <Sparkles className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Minhas Finanças</h1>
              <p className="text-slate-400 font-medium">Controle Total Supabase</p>
            </div>
          </div>
          
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
        </header>

        <Dashboard transactions={monthTransactions} />

        {/* Card de Resumo de Pendências (Estilo Print) */}
        {transactions.filter(t => !t.pago && (t.type === 'expense' || t.type === 'credit')).length > 0 && (
          <div className="flex flex-col items-center justify-center p-8 bg-slate-800/40 rounded-3xl border border-slate-700/50 text-center space-y-4 animate-fade-in shadow-2xl">
            <div className="text-5xl">🏢</div>
            <div className="space-y-1">
              <p className="text-slate-300 font-medium">
                Você tem <span className="text-emerald-400 font-bold">{transactions.filter(t => !t.pago && (t.type === 'expense' || t.type === 'credit')).length} despesas pendentes</span> no total de 
                <span className="text-emerald-400 font-bold"> R$ {transactions.filter(t => !t.pago && (t.type === 'expense' || t.type === 'credit')).reduce((acc, t) => acc + Number(t.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </p>
              <button className="text-emerald-400 font-bold hover:underline cursor-pointer">Verificar</button>
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
                        <p className="text-xs text-slate-400 uppercase tracking-wider">{card.bandeira}</p>
                      </div>
                    </div>
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

                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setEditingCard(card); setIsEditModalOpen(true); }}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black rounded-xl transition-all border border-slate-700 hover:border-slate-600 flex items-center justify-center gap-2"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> REAJUSTE
                    </button>
                    <button className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
                      <Plus className="h-3.5 w-3.5" /> LANÇAR
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <AddTransactionForm onAdd={handleAddTransaction} />
          <TransactionList transactions={monthTransactions} onDelete={handleDeleteTransaction} onTogglePaid={handleTogglePaid} />
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
    </main>
  );
}
