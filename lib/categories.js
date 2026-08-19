export const CATEGORY_GROUPS = [
    {
        id: 'essenciais',
        label: 'Essenciais',
        emoji: '🏠',
        categories: [
            { name: 'Moradia', items: ['Parcela Casa', 'Aluguel', 'Condomínio', 'IPTU', 'Luz', 'Água', 'Gás', 'Internet'] },
            { name: 'Alimentação', items: ['Supermercado', 'Feira', 'Açougue', 'Padaria'] },
            { name: 'Transporte', items: ['Combustível', 'Manutenção', 'IPVA', 'Transporte Público', 'Uber'] },
            { name: 'Saúde', items: ['Plano', 'Farmácia', 'Consultas', 'Exames', 'Dentista'] },
            { name: 'Educação', items: ['Mensalidade', 'Material Escolar', 'Cursos'] },
            { name: 'Dependentes/Filhos', items: ['Creche', 'Escola', 'Fraldas', 'Pediatra', 'Mesada'] },
        ],
    },
    {
        id: 'estilo_vida',
        label: 'Estilo de Vida',
        emoji: '🎮',
        categories: [
            { name: 'Lazer e Entretenimento', items: ['Restaurantes', 'Delivery', 'Passeios', 'Viagens', 'Cinema/Shows', 'Academia'] },
            { name: 'Itens Pessoais & Vestuário', items: ['Roupas', 'Calçados', 'Salão/Barbearia', 'Cosméticos'] },
            { name: 'Assinaturas & Serviços', items: ['Streaming', 'Softwares', 'Hospedagem', 'VPS/n8n'] },
            { name: 'Hobbies & Projetos', items: ['Equipamentos', 'Instrumentos', 'Setup', 'Periféricos'] },
            { name: 'Pequenos Luxos', items: ['Cafés', 'Compras por Impulso'] },
        ],
    },
    {
        id: 'investimentos',
        label: 'Investimentos & Futuro',
        emoji: '📈',
        categories: [
            { name: 'Reserva de Emergência', items: ['Aportes'] },
            { name: 'Aposentadoria', items: ['Tesouro IPCA', 'Previdência', 'Fundos de Dividendos'] },
            { name: 'Projetos de Médio Prazo', items: ['Troca de Carro', 'Viagens Grandes', 'Novos Negócios'] },
        ],
    },
    {
        id: 'renda',
        label: 'Renda',
        emoji: '💵',
        categories: [
            { name: 'Salário', items: ['Salário', '13º'] },
            { name: 'Extra', items: ['Freelas', 'Bônus', 'Restituição'] },
            { name: 'Renda Passiva', items: ['Aluguéis', 'Dividendos', 'Juros'] },
        ],
    },
];

const LEGACY_CATEGORY_GROUP = {
    'Moradia': 'essenciais',
    'Alimentação': 'essenciais',
    'Transporte': 'essenciais',
    'Saúde': 'essenciais',
    'Educação': 'essenciais',
    'Filhos': 'essenciais',
    'Seguros': 'essenciais',
    'Contas Fixas': 'essenciais',
    'Energia': 'essenciais',
    'Água': 'essenciais',
    'Internet/Tel': 'essenciais',
    'Trabalho': 'estilo_vida',
    'Lazer': 'estilo_vida',
    'Viagem': 'estilo_vida',
    'Compras': 'estilo_vida',
    'Pets': 'estilo_vida',
    'Assinaturas': 'estilo_vida',
    'Investimentos': 'investimentos',
    'Salário': 'renda',
};

export const getGroupId = (category) => {
    const name = String(category || '').trim();
    if (!name) return null;
    const groups = getCategories();
    const direct = groups.find((g) => g.categories.some((c) => c.name === name));
    if (direct) return direct.id;
    return LEGACY_CATEGORY_GROUP[name] || null;
};

export const getGroupInfo = (category) => {
    const id = getGroupId(category);
    return getCategories().find((g) => g.id === id) || null;
};

const CUSTOM_KEY = 'fincasal_categorias_custom';

export const getCategories = () => {
    if (typeof window === 'undefined') return CATEGORY_GROUPS;
    try {
        const raw = localStorage.getItem(CUSTOM_KEY);
        if (!raw) return CATEGORY_GROUPS;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : CATEGORY_GROUPS;
    } catch {
        return CATEGORY_GROUPS;
    }
};

export const saveCustomCategories = (groups) => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(groups));
};

export const resetCustomCategories = () => {
    localStorage.removeItem(CUSTOM_KEY);
};