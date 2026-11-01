import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { size } from '../theme';

/** Stroke icons for the bottom tabs, drawn here rather than adding an icon library. */
export function TabIcon({ name, color }: { name: 'play' | 'games' | 'questions' | 'results'; color: ColorValue }) {
  const stroke = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size.tabIcon} height={size.tabIcon} viewBox="0 0 24 24">
      {name === 'play' && (
        <>
          <Circle cx="12" cy="12" r="9.5" {...stroke} />
          <Path d="M10 8.5 L16 12 L10 15.5 Z" {...stroke} />
        </>
      )}
      {name === 'games' && (
        <>
          <Rect x="4" y="5" width="16" height="4" rx="1.5" {...stroke} />
          <Rect x="4" y="11" width="16" height="4" rx="1.5" {...stroke} />
          <Rect x="4" y="17" width="10" height="2.5" rx="1.25" {...stroke} />
        </>
      )}
      {name === 'questions' && (
        <>
          <Circle cx="12" cy="12" r="9.5" {...stroke} />
          <Path d="M9.5 9.5 a2.5 2.5 0 1 1 3.5 2.3 c-0.7 0.3 -1 0.8 -1 1.5 v0.7" {...stroke} />
          <Circle cx="12" cy="17" r="0.6" fill={color} stroke={color} />
        </>
      )}
      {name === 'results' && (
        <>
          <Rect x="5" y="3.5" width="14" height="17" rx="2" {...stroke} />
          <Path d="M8.5 8.5 L10 10 L12.5 7.5 M14 9 H16 M8.5 14.5 L10 16 L12.5 13.5 M14 15 H16" {...stroke} />
        </>
      )}
    </Svg>
  );
}
