import LottieView from 'lottie-react-native';

export default function LottieHero({ size }: { size: number }) {
  return (
    <LottieView
      source={require('../assets/resting_kid_wallet_lottie.json')}
      autoPlay
      loop
      style={{ width: size, height: size, alignSelf: 'center' }}
    />
  );
}
