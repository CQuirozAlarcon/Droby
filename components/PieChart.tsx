import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/lib/theme';

interface Segmento {
  valor: number;
  color: string;
}

interface Props {
  segmentos: Segmento[];
  size?: number;
  strokeWidth?: number;
  centroLabel: string;
  centroValor: string;
}

// Gráfico circular tipo torta/dona: cada segmento es un arco de Circle
// dibujado con strokeDasharray, rotados acumulativamente para formar
// las porciones proporcionales al total.
export function PieChart({ segmentos, size = 130, strokeWidth = 18, centroLabel, centroValor }: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(
    segmentos.reduce((acc, s) => acc + Math.max(s.valor, 0), 0),
    0.01
  );

  let acumulado = 0;
  const arcos = segmentos.map((seg, i) => {
    const valorPositivo = Math.max(seg.valor, 0);
    const fraccion = valorPositivo / total;
    const dashArray = `${circumference * fraccion} ${circumference}`;
    const rotacion = acumulado * 360;
    acumulado += fraccion;
    return { ...seg, dashArray, rotacion, key: i };
  });

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {arcos.map((arco) => (
          <Circle
            key={arco.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={arco.color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={arco.dashArray}
            strokeLinecap="butt"
            origin={`${size / 2}, ${size / 2}`}
            rotation={arco.rotacion - 90}
          />
        ))}
      </Svg>
      <View style={styles.centro}>
        <Text style={styles.centroLabel}>{centroLabel}</Text>
        <Text style={styles.centroValor}>{centroValor}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { alignItems: 'center' },
  centroLabel: { color: colors.textMuted, fontSize: 11 },
  centroValor: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 2 },
});
