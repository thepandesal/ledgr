import { View, Text, StyleSheet, TouchableOpacity, Dimensions, PanResponder, Animated as RNAnimated } from 'react-native';
import { Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { cropEvents } from '../../src/lib/cropEvents';

const { width: SW, height: SH } = Dimensions.get('window');
const CROP_SIZE = SW * 0.75;

export default function CropQRScreen() {
  const { uri, returnTo } = useLocalSearchParams<{ uri: string; returnTo: string }>();
  const router = useRouter();

  const [imgSize, setImgSize] = useState({ w: SW, h: SH });
  const scale = useRef(1);
  const translateX = useRef(0);
  const translateY = useRef(0);
  const animScale = useRef(new RNAnimated.Value(1)).current;
  const animX = useRef(new RNAnimated.Value(0)).current;
  const animY = useRef(new RNAnimated.Value(0)).current;

  const lastScale = useRef(1);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastDist = useRef(0);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      lastX.current = translateX.current;
      lastY.current = translateY.current;
      lastScale.current = scale.current;
      lastDist.current = 0;
    },
    onPanResponderMove: (_, gs) => {
      if (gs.numberActiveTouches === 2) {
        // pinch to zoom
        const touches = (gs as any).nativeEvent?.touches;
        if (touches && touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (lastDist.current === 0) { lastDist.current = dist; return; }
          const newScale = Math.max(0.5, Math.min(5, lastScale.current * (dist / lastDist.current)));
          scale.current = newScale;
          animScale.setValue(newScale);
        }
      } else {
        translateX.current = lastX.current + gs.dx;
        translateY.current = lastY.current + gs.dy;
        animX.setValue(translateX.current);
        animY.setValue(translateY.current);
      }
    },
    onPanResponderRelease: () => {
      lastDist.current = 0;
    },
  })).current;

  const crop = async () => {
    if (!uri) return;
    try {
      Image.getSize(uri, async (iw, ih) => {
        // figure out how the image is displayed
        const displayW = SW;
        const displayH = SH;
        const ratio = Math.min(displayW / iw, displayH / ih);
        const renderedW = iw * ratio * scale.current;
        const renderedH = ih * ratio * scale.current;

        // center of screen
        const cx = SW / 2;
        const cy = SH / 2;

        // image origin on screen (with pan)
        const imgLeft = cx - renderedW / 2 + translateX.current;
        const imgTop = cy - renderedH / 2 + translateY.current;

        // crop box on screen
        const cropLeft = cx - CROP_SIZE / 2;
        const cropTop = cy - CROP_SIZE / 2;

        // relative position of crop box within rendered image
        const relLeft = (cropLeft - imgLeft) / renderedW;
        const relTop = (cropTop - imgTop) / renderedH;
        const relSize = CROP_SIZE / renderedW;

        // map back to original image pixels
        const originX = Math.max(0, relLeft * iw);
        const originY = Math.max(0, relTop * ih);
        const cropW = Math.min(iw - originX, relSize * iw);
        const cropH = Math.min(ih - originY, relSize * ih);

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
      });
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <View style={styles.container}>
      {/* Image with pan/zoom */}
      <RNAnimated.Image
        source={{ uri }}
        style={[
          styles.image,
          {
            transform: [
              { translateX: animX },
              { translateY: animY },
              { scale: animScale },
            ],
          },
        ]}
        resizeMode="contain"
        {...panResponder.panHandlers}
      />

      {/* Dark overlay with square cutout */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.cropFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>move & scale</Text>
        <TouchableOpacity onPress={crop} style={styles.headerBtn}>
          <Ionicons name="checkmark" size={24} color="#0ccfcf" />
        </TouchableOpacity>
      </View>

      <Text style={styles.hint}>pinch to zoom · drag to reposition</Text>
    </View>
  );
}

const SIDE = (SW - CROP_SIZE) / 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  image: { position: 'absolute', width: SW, height: SH },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlayTop: { height: (SH - CROP_SIZE) / 2, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMiddle: { flexDirection: 'row', height: CROP_SIZE },
  overlaySide: { width: SIDE, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  cropFrame: { width: CROP_SIZE, height: CROP_SIZE },
  corner: { position: 'absolute', width: 20, height: 20, borderColor: '#0ccfcf', borderWidth: 2 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  header: { position: 'absolute', top: 52, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: 'RobotoMono_400Regular', fontSize: 13, color: '#fff' },
  hint: { position: 'absolute', bottom: 48, alignSelf: 'center', fontFamily: 'RobotoMono_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)' },
});
