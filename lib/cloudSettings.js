import { supabase } from './supabase';

export async function loadCloudSettings() {
  try {
    const { data, error } = await supabase.from('app_settings').select('key,value');
    if (error || !data) return {};
    const out = {};
    for (const row of data) {
      try { out[row.key] = JSON.parse(row.value); } catch { out[row.key] = row.value; }
    }
    return out;
  } catch {
    return {};
  }
}

export async function saveCloudSetting(key, value) {
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
    if (error) {
      console.error(`Error saving ${key}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Error saving ${key}:`, err.message);
    return false;
  }
}
