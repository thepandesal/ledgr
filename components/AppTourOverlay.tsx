import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions,
  Animated, Modal, Platform,
} from 'react-native';
import { useEffect, useRef, useState, RefObject } from 'react';
import Svg, { Defs, Mask, Rect, Circle } from 'react-native-svg';
import { Colors, Fonts, Radius } from './ui/theme';
import type { TargetLayout, TourStep } from '../src/lib/TourContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const OVERLAY = 'rgba(0,0,0,0.78)';

type Props = {
  visible: boolean;
  steps: TourStep[];
  stepIndex: number;
  targets: Map<string, RefObject<View | null>>;
  onNext: () => void;
  onSkip: () => void;
  loading?: boolean;
};

function measureTarget(ref: RefObject<View | null>): Promise<TargetLayout | null> {
  return new Promise(resolve => {
    const node = ref.current;
    if (!node) { resolve(null); return; }
    node.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) resolve(null);
      else resolve({ x, y, width, height });
    });
  });
}

export default function AppTourOverlay({ visible, steps, stepIndex, targets, onNext, onSkip, loading }: Props) {
  const step = steps[stepIndex];
  const [layout, setLayout] = useState<TargetLayout | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    if (!visible || !step) return;
    let cancelled = false;

    const read = async (attempt = 0) => {
      const ref = targets.get(step.targetId);
      const rect = ref ? await measureTarget(ref) : null;
      if (cancelled) return;
      if (rect) {
        setLayout(rect);
      } else if (attempt < 8) {
        setTimeout(() => read(attempt + 1), 120);
      }
    };

    setLayout(null);
    const t = setTimeout(() => read(), step.tab ? 380 : 80);
    return () => { cancelled = true; clearTimeout(t); };
  }, [visible, step, stepIndex, targets]);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, stepIndex]);

  if (!visible || !step) return null;

  const pad = step.padding ?? 8;
  const hole = layout
    ? {
        x: layout.x - pad,
        y: layout.y - pad,
        w: layout.width + pad * 2,
        h: layout.height + pad * 2,
      }
    : null;

  const cx = hole ? hole.x + hole.w / 2 : SCREEN_W / 2;
  const cy = hole ? hole.y + hole.h / 2 : SCREEN_H / 2;
  const radius = hole ? Math.max(hole.w, hole.h) / 2 : 40;

  const tooltipAbove = hole ? hole.y > SCREEN_H * 0.45 : true;
  const tooltipTop = tooltipAbove
    ? Math.max(24, (hole?.y ?? 120) - 160)
    : Math.min(SCREEN_H - 180, (hole?.y ?? 0) + (hole?.h ?? 0) + 24);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0.35] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={s.root} pointerEvents="box-none">
        {hole ? (
          <>
            <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
              <Defs>
                <Mask id="tour-hole">
                  <Rect width={SCREEN_W} height={SCREEN_H} fill="white" />
                  <Circle cx={cx} cy={cy} r={radius} fill="black" />
                </Mask>
              </Defs>
              <Rect width={SCREEN_W} height={SCREEN_H} fill={OVERLAY} mask="url(#tour-hole)" />
            </Svg>

            <Animated.View
              pointerEvents="none"
              style={[
                s.ring,
                {
                  left: cx - radius,
                  top: cy - radius,
                  width: radius * 2,
                  height: radius * 2,
                  borderRadius: radius,
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                s.ringStatic,
                {
                  left: cx - radius,
                  top: cy - radius,
                  width: radius * 2,
                  height: radius * 2,
                  borderRadius: radius,
                },
              ]}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: OVERLAY }]} />
        )}

        <View style={[s.tooltip, { top: tooltipTop }]}>
          <Text style={s.stepCount}>{stepIndex + 1} of {steps.length}</Text>
          <Text style={s.title}>{step.title}</Text>
          <Text style={s.description}>{step.description}</Text>

          <View style={s.actions}>
            <TouchableOpacity onPress={onSkip} hitSlop={12} activeOpacity={0.7}>
              <Text style={s.skip}>skip tour</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.nextBtn, loading && s.nextDisabled]}
              onPress={onNext}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={s.nextText}>{isLast ? 'get started' : 'next'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.cyan,
  },
  ringStatic: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  tooltip: {
    position: 'absolute',
    left: 24,
    right: 24,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24 },
      android: { elevation: 12 },
      default: { boxShadow: '0 8px 32px rgba(0,0,0,0.15)' } as any,
    }),
  },
  stepCount: { fontFamily: Fonts.mono, fontSize: 11, color: Colors.muted, letterSpacing: 0.5, marginBottom: 6 },
  title: { fontFamily: Fonts.calSans, fontSize: 24, color: Colors.text, letterSpacing: -0.3, marginBottom: 8 },
  description: { fontFamily: Fonts.sans, fontSize: 14, color: Colors.muted, lineHeight: 21, marginBottom: 20 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { fontFamily: Fonts.sansMedium, fontSize: 14, color: Colors.muted },
  nextBtn: { backgroundColor: '#00bf63', borderRadius: Radius.pill, paddingVertical: 12, paddingHorizontal: 28 },
  nextDisabled: { opacity: 0.5 },
  nextText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: Colors.white },
});
