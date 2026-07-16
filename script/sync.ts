import { CellData, getCellsFromStorage, saveCellsToStorage } from './logic';

export type SyncConfig = {
  url: string;
  anonKey: string;
  syncCode: string;
};

const CONFIG_KEY = 'supabaseSyncConfig';
const SUPABASE_JS_CDN_URL = 'https://esm.sh/@supabase/supabase-js@2';

export function getSyncConfig(): SyncConfig | null {
  const raw = localStorage.getItem(CONFIG_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveSyncConfig(config: SyncConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearSyncConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

let applyingRemoteChange = false;

export async function initSync() {
  const config = getSyncConfig();
  if (!config) {
    return;
  }

  let supabase: any;
  try {
    const { createClient } = await import(/* @vite-ignore */ SUPABASE_JS_CDN_URL);
    supabase = createClient(config.url, config.anonKey);
  } catch (err) {
    console.error('Sync: failed to load Supabase client', err);
    return;
  }

  try {
    const { data, error } = await supabase
      .from('coin_collections')
      .select('cells')
      .eq('sync_code', config.syncCode)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      applyRemoteCells(data.cells as CellData);
    } else {
      await pushToRemote(supabase, config.syncCode, getCellsFromStorage());
    }
  } catch (err) {
    console.error('Sync: failed to load remote data', err);
  }

  supabase
    .channel(`coin_collections:${config.syncCode}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'coin_collections',
        filter: `sync_code=eq.${config.syncCode}`,
      },
      (payload: any) => {
        if (payload.new && payload.new.cells) {
          applyRemoteCells(payload.new.cells as CellData);
        }
      }
    )
    .subscribe();

  window.addEventListener('storage', (event) => {
    if (event.key === 'cells' && !applyingRemoteChange) {
      pushToRemote(supabase, config.syncCode, getCellsFromStorage());
    }
  });
}

function applyRemoteCells(cells: CellData) {
  applyingRemoteChange = true;
  saveCellsToStorage(cells);
  applyingRemoteChange = false;
}

async function pushToRemote(supabase: any, syncCode: string, cells: CellData) {
  const { error } = await supabase.from('coin_collections').upsert({
    sync_code: syncCode,
    cells,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Sync: failed to push local change', error);
  }
}
