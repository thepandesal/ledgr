import React, { useRef, useState } from 'react';
import { View, Animated, PanResponder, useWindowDimensions } from 'react-native';

const CARD_SIZE = 100;
const GAP       = 10;
const STEP      = CARD_SIZE + GAP;

interface Props<T extends { id: string }> {
  data: T[];
  onDragEnd: (reordered: T[]) => void;
  renderItem: (item: T) => React.ReactNode;
  paddingHorizontal: number;
  sortMode: boolean;
  onDragStateChange?: (dragging: boolean) => void;
}

export default function DraggableGrid<T extends { id: string }>({
  data, onDragEnd, renderItem, paddingHorizontal, sortMode, onDragStateChange,
}: Props<T>) {
  const { width: W } = useWindowDimensions();
  const cols = Math.floor((W - paddingHorizontal * 2 + GAP) / STEP);

  const getPos = (idx: number) => ({
    x: (idx % cols) * STEP,
    y: Math.floor(idx / cols) * STEP,
  });

  // items is the source of truth for order
  const [items, setItems]             = useState(data);
  const [draggingId, setDraggingId]   = useState<string | null>(null);
  const [hoverIdx, setHoverIdx]       = useState(0);

  const itemsRef      = useRef(items);
  const colsRef       = useRef(cols);
  const onDragEndRef  = useRef(onDragEnd);
  const draggingIdRef = useRef<string | null>(null);
  const hoverIdxRef   = useRef(0);
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const dragFromIdx   = useRef(0);
  const sortModeRef   = useRef(sortMode);

  const onDragStateChangeRef = useRef(onDragStateChange);
  onDragStateChangeRef.current = onDragStateChange;
  itemsRef.current     = items;
  colsRef.current      = cols;
  onDragEndRef.current = onDragEnd;
  sortModeRef.current  = sortMode;

  React.useEffect(() => { setItems(data); setDraggingId(null); }, [data]);

  const rows = Math.ceil(items.length / cols);
  const containerHeight = rows * CARD_SIZE + (rows - 1) * GAP;

  // Build display list: move dragging item to hoverIdx slot
  const getDisplayItems = (): T[] => {
    if (draggingId === null) return items;
    const fromIdx = items.findIndex(i => i.id === draggingId);
    if (fromIdx === -1) return items;
    const next = [...items];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(hoverIdx, 0, moved);
    return next;
  };

  const displayItems = getDisplayItems();

  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        () => sortModeRef.current,
    onMoveShouldSetPanResponder:         () => sortModeRef.current,
    onStartShouldSetPanResponderCapture: () => sortModeRef.current,
    onMoveShouldSetPanResponderCapture:  () => draggingIdRef.current !== null,
    onPanResponderGrant: () => {
      pan.setValue({ x: 0, y: 0 });
      onDragStateChangeRef.current?.(true);
    },
    onPanResponderMove: (_, g) => {
      pan.setValue({ x: g.dx, y: g.dy });
      if (draggingIdRef.current === null) return;
      const ox = dragOriginRef.current.x;
      const oy = dragOriginRef.current.y;
      const centerX = ox + g.dx + CARD_SIZE / 2;
      const centerY = oy + g.dy + CARD_SIZE / 2;
      const newHover = Math.max(0, Math.min(
        Math.floor(centerY / STEP) * colsRef.current + Math.floor(centerX / STEP),
        itemsRef.current.length - 1
      ));
      if (newHover !== hoverIdxRef.current) {
        hoverIdxRef.current = newHover;
        setHoverIdx(newHover);
      }
    },
    onPanResponderRelease: () => {
      onDragStateChangeRef.current?.(false);
      const id = draggingIdRef.current;
      const to = hoverIdxRef.current;
      draggingIdRef.current = null;
      // Spring pan to the ghost slot before resetting
      const origin = dragOriginRef.current;
      const targetX = (to % colsRef.current) * STEP;
      const targetY = Math.floor(to / colsRef.current) * STEP;
      Animated.timing(pan, {
        toValue: { x: targetX - origin.x, y: targetY - origin.y },
        useNativeDriver: true,
        duration: 150,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      }).start(() => {
        pan.setValue({ x: 0, y: 0 });
        setDraggingId(null);
        if (id === null) return;
        const prev = itemsRef.current;
        const fromIdx = prev.findIndex(i => i.id === id);
        if (fromIdx === -1) return;
        const next = [...prev];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(to, 0, moved);
        setItems(next);
        onDragEndRef.current(next);
      });
    },
    onPanResponderTerminate: () => {
      pan.setValue({ x: 0, y: 0 });
      onDragStateChangeRef.current?.(false);
      draggingIdRef.current = null;
      setDraggingId(null);
    },
  })).current;

  // Ghost sits at the slot where the card will land = getPos(hoverIdx)
  const ghostPos = draggingId !== null ? getPos(hoverIdx) : null;

  return (
    <View style={{ height: containerHeight, marginHorizontal: paddingHorizontal, marginBottom: 8 }}>
      {ghostPos && (
        <View style={{
          position: 'absolute',
          left: ghostPos.x,
          top: ghostPos.y,
          width: CARD_SIZE,
          height: CARD_SIZE,
          borderRadius: 18,
          borderWidth: 2,
          borderColor: '#5dc4bb',
          borderStyle: 'dashed',
          backgroundColor: '#B6E1DE33',
          zIndex: 1,
        }} />
      )}
      {items.map((item) => {
        const isDragging   = item.id === draggingId;
        // Position in the live-reordered display list
        const displayIdx   = displayItems.findIndex(d => d.id === item.id);
        // Dragging card: stays at its original slot, pan moves it
        // Others: spring to their display slot
        const fromIdx      = items.findIndex(i => i.id === item.id);
        const gridPos      = isDragging ? getPos(fromIdx) : getPos(displayIdx);

        return (
          <CardWrapper
            key={item.id}
            isDragging={isDragging}
            sortMode={sortMode}
            gridPos={gridPos}
            pan={isDragging ? pan : null}
            panHandlers={panResponder.panHandlers}
            onPressIn={() => {
              if (!sortModeRef.current) return;
              const idx = itemsRef.current.findIndex(i => i.id === item.id);
              const pos = getPos(idx);
              dragOriginRef.current = pos;
              hoverIdxRef.current   = idx;
              dragFromIdx.current   = idx;
              draggingIdRef.current = item.id;
              setDraggingId(item.id);
              setHoverIdx(idx);
            }}
          >
            {renderItem(item)}
          </CardWrapper>
        );
      })}
    </View>
  );
}

interface WrapperProps {
  isDragging: boolean;
  sortMode: boolean;
  gridPos: { x: number; y: number };
  pan: Animated.ValueXY | null;
  panHandlers: any;
  onPressIn: () => void;
  children: React.ReactNode;
}

function CardWrapper({ isDragging, sortMode, gridPos, pan, panHandlers, onPressIn, children }: WrapperProps) {
  const scale        = useRef(new Animated.Value(1)).current;
  const animX        = useRef(new Animated.Value(gridPos.x)).current;
  const animY        = useRef(new Animated.Value(gridPos.y)).current;
  // Freeze the drag origin — never update while dragging
  const frozenPos    = useRef(gridPos);
  if (!isDragging) frozenPos.current = gridPos;

  React.useEffect(() => {
    if (isDragging) {
      Animated.spring(scale, { toValue: 1.08, useNativeDriver: true }).start();
    } else {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(animX, { toValue: gridPos.x, useNativeDriver: true, duration: 150, easing: (t) => 1 - Math.pow(1 - t, 3) }),
      ]).start();
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(animY, { toValue: gridPos.y, useNativeDriver: true, duration: 150, easing: (t) => 1 - Math.pow(1 - t, 3) }),
      ]).start();
    }
  }, [isDragging, gridPos.x, gridPos.y]);

  if (isDragging && pan) {
    return (
      <Animated.View
        {...panHandlers}
        onTouchStart={onPressIn}
        style={{
          position: 'absolute',
          left: frozenPos.current.x,
          top:  frozenPos.current.y,
          width: CARD_SIZE,
          height: CARD_SIZE,
          zIndex: 999,
          opacity: 0.92,
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }],
          borderRadius: 18,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 10,
        }}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      {...panHandlers}
      onTouchStart={onPressIn}
      style={{
        position: 'absolute',
        width: CARD_SIZE,
        height: CARD_SIZE,
        zIndex: 2,
        transform: [{ translateX: animX }, { translateY: animY }, { scale }],
        borderRadius: 18,
        borderWidth: 0,
        borderColor: 'transparent',
      }}
    >
      {children}
    </Animated.View>
  );
}
