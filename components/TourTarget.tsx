import { View, ViewStyle } from 'react-native';
import { useEffect, useRef } from 'react';
import { useTourRegistry } from '../src/lib/TourContext';

type Props = {
  id: string;
  children: React.ReactNode;
  style?: ViewStyle;
};

export default function TourTarget({ id, children, style }: Props) {
  const ref = useRef<View>(null);
  const { register, unregister } = useTourRegistry();

  useEffect(() => {
    register(id, ref);
    return () => unregister(id);
  }, [id, register, unregister]);

  return (
    <View ref={ref} style={style} collapsable={false}>
      {children}
    </View>
  );
}
