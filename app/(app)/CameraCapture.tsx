import { useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView,
  StyleSheet, SafeAreaView, ActivityIndicator, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { DC } from '../../src/lib/design';

interface Props {
  visible: boolean;
  onDone: (uris: string[]) => void;
  onCancel: () => void;
}

export default function CameraCapture({ visible, onDone, onCancel }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photos, setPhotos] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 1, base64: false });
      if (photo?.uri) setPhotos(prev => [...prev, photo.uri]);
    } catch (_) {}
    setCapturing(false);
  }, [capturing]);

  const handleRemove = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDone = () => {
    const taken = [...photos];
    setPhotos([]);
    onDone(taken);
  };

  const handleCancel = () => {
    setPhotos([]);
    onCancel();
  };

  if (!visible) return null;

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={s.permWrap}>
          <Text style={s.permText}>Camera permission is required.</Text>
          <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
            <Text style={s.permBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCancel} style={{ marginTop: 12 }}>
            <Text style={s.cancelText}>cancel</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={s.container}>
        {/* Camera */}
        <CameraView ref={cameraRef} style={s.camera} facing="back">
          {/* Frame overlay */}
          <View style={s.frameOverlay}>
            <View style={s.frameCornerTL} />
            <View style={s.frameCornerTR} />
            <View style={s.frameCornerBL} />
            <View style={s.frameCornerBR} />
          </View>
          {/* Top bar */}
          <SafeAreaView style={s.topBar}>
            <TouchableOpacity onPress={handleCancel} style={s.topBtn}>
              <Text style={s.topBtnText}>cancel</Text>
            </TouchableOpacity>
            <Text style={s.photoCount}>
              {photos.length > 0 ? `${photos.length} photo${photos.length !== 1 ? 's' : ''}` : 'align receipt in frame'}
            </Text>
            <TouchableOpacity
              onPress={handleDone}
              style={[s.topBtn, photos.length === 0 && { opacity: 0.3 }]}
              disabled={photos.length === 0}
            >
              <Text style={[s.topBtnText, { fontFamily: 'Poppins-SemiBold' }]}>done</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </CameraView>

        {/* Bottom controls */}
        <View style={s.bottomBar}>
          {/* Thumbnails */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.thumbStrip}
            style={s.thumbScroll}
          >
            {photos.map((uri, idx) => (
              <TouchableOpacity key={idx} onPress={() => handleRemove(idx)} activeOpacity={0.8}>
                <Image source={{ uri }} style={s.thumb} />
                <View style={s.thumbRemove}>
                  <Text style={s.thumbRemoveText}>✕</Text>
                </View>
                <Text style={s.thumbLabel}>#{idx + 1}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Shutter */}
          <TouchableOpacity
            style={[s.shutter, capturing && { opacity: 0.5 }]}
            onPress={handleCapture}
            disabled={capturing}
            activeOpacity={0.8}
          >
            {capturing
              ? <ActivityIndicator color="#111111" />
              : <View style={s.shutterInner} />
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const CORNER = 22;
const CORNER_THICKNESS = 3;
const FRAME_MARGIN = 40;

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#000000' },
  camera:         { flex: 1 },
  topBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  topBtn:         { paddingVertical: 8, paddingHorizontal: 4 },
  topBtnText:     { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#ffffff' },
  photoCount:     { fontFamily: 'Poppins-Regular', fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  frameOverlay: {
    position: 'absolute', top: FRAME_MARGIN, left: FRAME_MARGIN,
    right: FRAME_MARGIN, bottom: FRAME_MARGIN,
  },
  frameCornerTL: { position: 'absolute', top: 0, left: 0, width: CORNER, height: CORNER, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderColor: '#ffffff', borderTopLeftRadius: 4 },
  frameCornerTR: { position: 'absolute', top: 0, right: 0, width: CORNER, height: CORNER, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderColor: '#ffffff', borderTopRightRadius: 4 },
  frameCornerBL: { position: 'absolute', bottom: 0, left: 0, width: CORNER, height: CORNER, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS, borderColor: '#ffffff', borderBottomLeftRadius: 4 },
  frameCornerBR: { position: 'absolute', bottom: 0, right: 0, width: CORNER, height: CORNER, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS, borderColor: '#ffffff', borderBottomRightRadius: 4 },

  bottomBar:    { backgroundColor: '#111111', paddingBottom: 32, paddingTop: 16, alignItems: 'center', gap: 16 },
  thumbScroll:  { maxHeight: 80 },
  thumbStrip:   { paddingHorizontal: 20, gap: 10, alignItems: 'center', minWidth: '100%', justifyContent: 'center' },
  thumb:        { width: 60, height: 60, borderRadius: 8, backgroundColor: '#333' },
  thumbRemove:  { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ff5757', alignItems: 'center', justifyContent: 'center' },
  thumbRemoveText: { color: '#fff', fontSize: 9, fontFamily: 'Poppins-Bold', lineHeight: 18 },
  thumbLabel:   { fontFamily: 'Poppins-Regular', fontSize: 9, color: '#aaaaaa', textAlign: 'center', marginTop: 3 },

  shutter:      { width: 68, height: 68, borderRadius: 34, borderWidth: 3, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#ffffff' },

  permWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#ffffff' },
  permText:   { fontFamily: 'Poppins-Regular', fontSize: 14, color: '#111111', textAlign: 'center', marginBottom: 20 },
  permBtn:    { backgroundColor: '#111111', borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText:{ fontFamily: 'Poppins-SemiBold', fontSize: 13, color: '#ffffff' },
  cancelText: { fontFamily: 'Poppins-Regular', fontSize: 13, color: '#aaaaaa' },
});
