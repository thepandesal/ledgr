type IconSet = 'svg-spinners' | 'line-md' | 'basil' | 'circle-flags' | 'material-symbols';

interface Props {
  set: IconSet;
  icon: string;
  size?: number;
  color?: string;
}

const iconSets: Record<IconSet, any> = {
  'svg-spinners': require('@iconify-json/svg-spinners/icons.json'),
  'line-md': require('@iconify-json/line-md/icons.json'),
  'basil': require('@iconify-json/basil/icons.json'),
  'circle-flags': require('@iconify-json/circle-flags/icons.json'),
  'material-symbols': require('@iconify-json/material-symbols/icons.json'),
};

export default function AnimatedIcon({ set, icon, size = 24, color = 'currentColor' }: Props) {
  const data = iconSets[set];
  const iconData = data?.icons?.[icon];
  if (!iconData) return null;

  const { width = 24, height = 24 } = data;
  const body = iconData.body.replace(/currentColor/g, color);

  return (
    <span
      style={{ display: 'flex', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      dangerouslySetInnerHTML={{
        __html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${size}" height="${size}">${body}</svg>`,
      }}
    />
  );
}
