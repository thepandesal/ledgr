import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const QUEUE_KEY = 'offline_sync_queue';

export type QueueItem = {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  payload: any;
};

export async function getQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(queue: QueueItem[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function queueWrite(table: string, operation: QueueItem['operation'], payload: any) {
  const queue = await getQueue();
  queue.push({ id: Date.now().toString(), table, operation, payload });
  await saveQueue(queue);
}

export async function flushQueue(): Promise<{ flushed: number; failed: number }> {
  const queue = await getQueue();
  if (!queue.length) return { flushed: 0, failed: 0 };

  const remaining: QueueItem[] = [];
  let flushed = 0;

  for (const item of queue) {
    let error;
    if (item.operation === 'insert') {
      ({ error } = await supabase.from(item.table).insert(item.payload));
    } else if (item.operation === 'update') {
      ({ error } = await supabase.from(item.table).update(item.payload).eq('id', item.payload.id));
    } else if (item.operation === 'delete') {
      ({ error } = await supabase.from(item.table).delete().eq('id', item.payload.id));
    }

    if (error) remaining.push(item);
    else flushed++;
  }

  await saveQueue(remaining);
  return { flushed, failed: remaining.length };
}

export async function getPendingCount(): Promise<number> {
  return (await getQueue()).length;
}
