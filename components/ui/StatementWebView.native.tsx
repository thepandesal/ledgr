import { WebView } from 'react-native-webview';

interface Props {
  html: string;
  webviewRef: React.RefObject<any>;
  onMessage: (event: any) => void;
}

export default function StatementWebView({ html, webviewRef, onMessage }: Props) {
  return (
    <WebView
      ref={webviewRef}
      source={{ html }}
      style={{ position: 'absolute', width: 794, height: 1, opacity: 0, top: -9999 }}
      onMessage={onMessage}
      javaScriptEnabled
      originWhitelist={['*']}
    />
  );
}
