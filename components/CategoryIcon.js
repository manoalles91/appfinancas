'use client';

import {
    Home, ShoppingCart, Car, Utensils, Heart, Gamepad2, GraduationCap,
    Briefcase, Wifi, CreditCard, TrendingUp, Banknote, MoreHorizontal,
    Zap, Droplets, Smartphone, Shield, Baby, PawPrint, Plane
} from 'lucide-react';

const categoryMap = {
    'Moradia': { icon: Home, color: 'text-blue-400' },
    'Alimentação': { icon: Utensils, color: 'text-orange-400' },
    'Transporte': { icon: Car, color: 'text-yellow-400' },
    'Saúde': { icon: Heart, color: 'text-red-400' },
    'Lazer': { icon: Gamepad2, color: 'text-pink-400' },
    'Educação': { icon: GraduationCap, color: 'text-cyan-400' },
    'Trabalho': { icon: Briefcase, color: 'text-emerald-400' },
    'Internet/Tel': { icon: Wifi, color: 'text-sky-400' },
    'Cartão': { icon: CreditCard, color: 'text-purple-400' },
    'Investimentos': { icon: TrendingUp, color: 'text-green-400' },
    'Salário': { icon: Banknote, color: 'text-emerald-400' },
    'Energia': { icon: Zap, color: 'text-amber-400' },
    'Água': { icon: Droplets, color: 'text-blue-300' },
    'Assinaturas': { icon: Smartphone, color: 'text-indigo-400' },
    'Seguros': { icon: Shield, color: 'text-teal-400' },
    'Filhos': { icon: Baby, color: 'text-rose-300' },
    'Pets': { icon: PawPrint, color: 'text-amber-300' },
    'Viagem': { icon: Plane, color: 'text-violet-400' },
    'Compras': { icon: ShoppingCart, color: 'text-fuchsia-400' },
};

export const CATEGORIES = Object.keys(categoryMap);

export default function CategoryIcon({ category, size = 'md' }) {
    const entry = categoryMap[category] || { icon: MoreHorizontal, color: 'text-muted-foreground' };
    const Icon = entry.icon;

    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
        lg: 'h-6 w-6',
    };

    return <Icon className={`${sizeClasses[size]} ${entry.color}`} />;
}
