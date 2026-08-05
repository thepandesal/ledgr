import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import * as Network from 'expo-network';
import { flushQueue, getPendingCount } from '../src/lib/offlineQueue';
import { Colors, Fonts, Radius } from './ui/theme';

type SyncState = 'syncing' | 'done' | 'hidden';

export default function SyncModal() {
  const [state, setState] = useState<SyncState>('hidden');
  const [flushedCount, setFlushedCount] = useState(0);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const check = async () => {
      const net = await Network.getNetworkStateAsync();
      const isOnline = !!net.isConnected && !!net.isInternetReachable;

      if (!isOnline) {
        wasOfflineRef.current = true;
        return;
      }

      if (!wasOfflineRef.current) return;
      wasOfflineRef.current = false;

      const pending = await getPendingCount();
      if (pending === 0) return;

      setState('syncing');
      const { flushed } = await flushQueue();
      setFlushedCount(flushed);
      setState('done');
      setTimeout(() => setState('hidden'), 2500);
    };

    interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, []);

  if (state === 'hidden') return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={s.overlay}>
        <View style={s.box}>
          {state === 'syncing' ? (
            <>
              <ActivityIndicator color={Colors.cyan} size="small" />
              <Text style={s.title}>syncing your data</Text>
              <Text style={s.sub}>please wait a moment...</Text>
            </>
          ) : (
            <>
              <Text style={s.checkmark}>✓</Text>
              <Text style={s.title}>all synced!</Text>
              <Text style={s.sub}>{flushedCount} record{flushedCount !== 1 ? 's' : ''} uploaded</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    paddingVertical: 28,
    paddingHorizontal: 36,
    alignItems: 'center',
    gap: 8,
    minWidth: 200,
  },
  title: {
    fontFamily: Fonts.monoBold,
    fontSize: 15,
    color: Colors.text,
    textTransform: 'lowercase',
    letterSpacing: 0.4,
  },
  sub: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.muted,
  },
  checkmark: {
    fontSize: 28,
    color: Colors.success,
  },
});
