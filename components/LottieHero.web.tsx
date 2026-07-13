import { useCallback } from 'react';
import lottie from 'lottie-web';
import animationData from '../assets/resting_kid_wallet_lottie.json';

export default function LottieHero({ size }: { size: number }) {
  const actualSize = size > 0 ? size : 300;

  const refCallback = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const anim = lottie.loadAnimation({
      container: node,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData,
    });
    return () => anim.destroy();
  }, []);

  return (
    <div
      ref={refCallback}
      style={{
        width: actualSize,
        height: actualSize,
        margin: '0 auto',
        display: 'block',
      }}
    />
  );
}
