const QUEUE_KEY = 'readyup_offline_queue';

export interface QueuedAction {
  id: string;
  table: string;
  type: 'insert' | 'update';
  data: Record<string, any>;
  timestamp: number;
}

export function getQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(action: Omit<QueuedAction, 'id' | 'timestamp'>) {
  const queue = getQueue();
  queue.push({
    ...action,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  });
  saveQueue(queue);
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export async function replayQueue(
  supabase: any,
  onProgress?: (completed: number, total: number) => void
): Promise<number> {
  const queue = getQueue();
  if (queue.length === 0) return 0;

  let completed = 0;
  const failed: QueuedAction[] = [];

  for (const action of queue) {
    try {
      if (action.type === 'insert') {
        const { error } = await supabase.from(action.table).insert(action.data);
        if (error) throw error;
      } else if (action.type === 'update') {
        const { id, ...rest } = action.data;
        const { error } = await supabase.from(action.table).update(rest).eq('id', id);
        if (error) throw error;
      }
      completed++;
      onProgress?.(completed, queue.length);
    } catch (err) {
      console.error('[OfflineQueue] Failed to replay action:', err);
      failed.push(action);
    }
  }

  if (failed.length > 0) {
    saveQueue(failed);
  } else {
    clearQueue();
  }

  return completed;
}

/** Returns true if device is online */
export function isOnline(): boolean {
  return navigator.onLine;
}
