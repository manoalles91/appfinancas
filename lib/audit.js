import { supabase } from './supabase';

// Registra uma ação no histórico (audit trail).
// Best-effort: se a tabela audit_log não existir (migração RLS não aplicada),
// falha em silêncio sem interromper a operação principal.
export async function logAudit({ action, entity, entityId, description, meta }) {
  try {
    await supabase.from('audit_log').insert({
      action,
      entity,
      entity_id: entityId || null,
      description: description || '',
      meta: meta || null,
    });
  } catch {
    // silencioso
  }
}

export async function fetchAudit(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}
