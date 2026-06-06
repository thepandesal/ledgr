import { View, Text, StyleSheet, TouchableOpacity, Dimensions, PanResponder, Animated } from 'react-native';
import { Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, useEffect } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { cropEvents } from '../../src/lib/cropEvents';

const { width: SW, height: SH } = Dimensions.get('window');
const MIN_SIZE = 80;
const INITIAL_SIZE = SW * 0.7;

export default function CropQRScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const router = useRouter();

  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 1, h: 1 });
  const [imgDisplay, setImgDisplay] = useState({ x: 0, y: 0, w: SW, h: SH });

  // Crop box state (position + size of the square frame)
  const boxX = useRef((SW - INITIAL_SIZE) / 2);
  const boxY = useRef((SH - INITIAL_SIZE) / 2);
  const boxSize = useRef(INITIAL_SIZE);

  const animX = useRef(new Animated.Value(boxX.current)).current;
  const animY = useRef(new Animated.Value(boxY.current)).current;
  const animSize = useRef(new Animated.Value(boxSize.current)).current;

  useEffect(() => {
    if (!uri) return;
    Image.getSize(uri, (w, h) => {
      setImgNaturalSize({ w, h });
      const ratio = Math.min(SW / w, SH / h);
      const dw = w * ratio;
      const dh = h * ratio;
      setImgDisplay({ x: (SW - dw) / 2, y: (SH - dh) / 2, w: dw, h: dh });
    });
  }, [uri]);

  // Pan responder for moving the box
  const movePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => {
      const newX = Math.max(0, Math.min(SW - boxSize.current, boxX.current + gs.dx));
      const newY = Math.max(0, Math.min(SH - boxSize.current, boxY.current + gs.dy));
      animX.setValue(newX);
      animY.setValue(newY);
    },
    onPanResponderRelease: (_, gs) => {
      boxX.current = Math.max(0, Math.min(SW - boxSize.current, boxX.current + gs.dx));
      boxY.current = Math.max(0, Math.min(SH - boxSize.current, boxY.current + gs.dy));
    },
  })).current;

  // Pan responder for resizing (drag bottom-right corner)
  const resizePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => {
      const newSize = Math.max(MIN_SIZE, Math.min(
        Math.min(SW - boxX.current, SH - boxY.current),
        boxSize.current + gs.dx
      ));
      animSize.setValue(newSize);
    },
    onPanResponderRelease: (_, gs) => {
      boxSize.current = Math.max(MIN_SIZE, Math.min(
        Math.min(SW - boxX.current, SH - boxY.current),
        boxSize.current + gs.dx
      ));
    },
  })).current;

  const crop = async () => {
    if (!uri) return;
    try {
      const cx = boxX.current;
      const cy = boxY.current;
      const cs = boxSize.current;

      // Map screen crop box to natural image coordinates
      const relX = (cx - imgDisplay.x) / imgDisplay.w;
      const relY = (cy - imgDisplay.y) / imgDisplay.h;
      const relS = cs / imgDisplay.w;

      const originX = Math.max(0, relX * imgNaturalSize.w);
      const originY = Math.max(0, relY * imgNaturalSize.h);
      const cropW = Math.min(imgNaturalSize.w - originX, relS * imgNaturalSize.w);
      const cropH = Math.min(imgNaturalSize.h - originY, relS * imgNaturalSize.h);

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          { crop: { originX, originY, width: cropW, height: cropH } },
          { resize: { width: 300, height: 300 } },
        ],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      cropEvents.emit(`data:image/jpeg;base64,${result.base64}`);
      router.back();
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <View style={styles.container}>
      {/* Fixed background image */}
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
      ) : null}

      {/* Dark overlay — 4 sides around the crop box */}
      <Animated.View style={[styles.overlayTop, { height: animY }]} pointerEvents="none" />
      <Animated.View style={[styles.overlayLeft, { top: animY, width: animX, height: animSize }]} pointerEvents="none" />
      <Animated.View style={[styles.overlayRight, { top: animY, left: Animated.add(animX, animSize), height: animSize }]} pointerEvents="none" />
      <Animated.View style={[styles.overlayBottom, { top: Animated.add(animY, animSize) }]} pointerEvents="none" />

      {/* Crop box frame — draggable */}
      <Animated.View
        style={[styles.cropFrame, { left: animX, top: animY, width: animSize, height: animSize }]}
        {...movePan.panHandlers}
      >
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />

        {/* Bottom-right corner — resize handle */}
        <View style={[styles.corner, styles.cornerBR]} {...resizePan.panHandlers} />
        <View style={styles.resizeHandle} {...resizePan.panHandlers}>
          <Ionicons name="resize-outline" size={14} color="#0ccfcf" />
        </View>
      </Animated.View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>drag to move · corner to resize</Text>
        <TouchableOpacity onPress={crop} style={styles.headerBtn}>
          <Ionicons name="checkmark" size={24} color="#0ccfcf" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  image: { position: 'absolute', top: 0, left: 0, width: SW, height: SH },
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayLeft: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayRight: { position: 'absolute', right: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  cropFrame: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  corner: { position: 'absolute', width: 22, height: 22, borderColor: '#0ccfcf', borderWidth: 2.5 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  resizeHandle: { position: 'absolute', bottom: 4, right: 4, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  header: { position: 'absolute', top: 52, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.7)' },
});

