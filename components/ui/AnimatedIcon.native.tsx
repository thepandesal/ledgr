import { WebView } from 'react-native-webview';
import { Platform, memo } from 'react-native';

type IconSet = 'svg-spinners' | 'line-md' | 'basil' | 'circle-flags' | 'material-symbols' | 'lets-icons';

interface Props {
  set: IconSet;
  icon: string;
  size?: number;
  color?: string;
  loop?: boolean;
}

const iconSets: Record<IconSet, any> = {
  'svg-spinners': require('@iconify-json/svg-spinners/icons.json'),
  'line-md': require('@iconify-json/line-md/icons.json'),
  'basil': require('@iconify-json/basil/icons.json'),
  'circle-flags': require('@iconify-json/circle-flags/icons.json'),
  'material-symbols': require('@iconify-json/material-symbols/icons.json'),
  'lets-icons': require('@iconify-json/lets-icons/icons.json'),
};

function AnimatedIcon({ set, icon, size = 24, color = 'currentColor', loop }: Props) {
  const data = iconSets[set];
  const iconData = data?.icons?.[icon];
  if (!iconData) return null;

  const { width = 24, height = 24 } = data;
  let body = iconData.body.replace(/currentColor/g, color);
  if (loop) {
    body = body.replace(/<animate /g, '<animate repeatCount="indefinite" ');
  }

  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;padding:0;background:transparent;}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${size}" height="${size}">${body}</svg></body></html>`;

  if (Platform.OS === 'web') {
    return (
      <span
        dangerouslySetInnerHTML={{ __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${size}" height="${size}">${body}</svg>` }}
      />
    );
  }

  return (
    <WebView
      source={{ html }}
      style={{ width: size, height: size, backgroundColor: 'transparent' }}
      scrollEnabled={false}
      pointerEvents="none"
      androidLayerType="hardware"
    />
  );
}

export default memo(AnimatedIcon);
