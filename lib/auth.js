'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Permite o uso do app sem login até o modo RLS ser ativado.
// Controlado por NEXT_PUBLIC_REQUIRE_AUTH=true (necessita Supabase Auth configurado).
export const REQUIRE_AUTH =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true';

export function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const applySession = (newSession) => {
      setSession(newSession);
      setLoading(false);
      if (newSession?.user) {
        claimLegacyRows(newSession.user.id);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      applySession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      applySession(newSession);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

// Adota linhas legadas (owner IS NULL) para o usuário logado.
// Best-effort: se a coluna owner ainda não existir (RLS não aplicado), falha em silêncio.
async function claimLegacyRows(uid) {
  if (!uid) return;
  for (const table of ['transactions', 'cartoes', 'app_settings']) {
    try {
      await supabase
        .from(table)
        .update({ owner: uid })
        .is('owner', null);
    } catch {
      // coluna/RLS ainda não configurada — ignore
    }
  }
}

export async function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email, password) {
  return supabase.auth.signUp({ email, password });
}

export async function signInAnonymously() {
  return supabase.auth.signInAnonymously();
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}
