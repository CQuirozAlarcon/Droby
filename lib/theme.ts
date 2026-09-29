export const colors = {
  bg: '#09090B',         // Negro casi puro (zinc-950) - Máximo contraste
  surface: '#18181B',    // Tarjetas (zinc-900)
  surfaceAlt: '#27272A', // Estados activos/hover (zinc-800)
  border: '#3F3F46',     // Bordes sutiles (zinc-700)
  
  primary: '#818CF8',    // Índigo (indigo-400) - Da un toque muy premium y tecnológico
  
  success: '#4ADE80',    // Verde vibrante (green-400)
  danger: '#F87171',     // Rojo (red-400)
  warning: '#FACC15',    // Amarillo puro (yellow-400)
  
  text: '#FAFAFA',       // Texto puro (zinc-50)
  textMuted: '#A1A1AA',  // Texto apagado (zinc-400)
  
  // Categorías de tu negocio
  personal: '#D8B4FE',   // Púrpura suave (purple-300)
  empresa: '#38BDF8',    // Celeste (sky-400)
  porCobrar: '#FF8A65',  // Coral/Naranja vivo para alertar sobre cobros
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 12, lg: 16 };

export const MODELOS_IPHONE = [
  'iPhone 13', 'iPhone 13 Pro', 'iPhone 13 Pro Max',
  'iPhone 14', 'iPhone 14 Pro', 'iPhone 14 Pro Max',
  'iPhone 15', 'iPhone 15 Pro', 'iPhone 15 Pro Max',
  'iPhone 16', 'iPhone 16 Pro', 'iPhone 16 Pro Max',
  'iPhone 17', 'iPhone 17 Pro', 'iPhone 17 Pro Max',
];

// Paleta de colores universal compartida por casi todos los equipos.
// `variante` del producto guarda el `nombre`; `hex` es solo el swatch visual.
export const COLOR_SIN_VARIANTE = 'Sin color';

export const COLORES_UNIVERSALES: { nombre: string; hex: string }[] = [
  { nombre: 'Negro', hex: '#111827' },
  { nombre: 'Blanco', hex: '#F3F4F6' },
  { nombre: 'Rojo', hex: '#EF4444' },
  { nombre: 'Azul', hex: '#3B82F6' },
  { nombre: 'Verde', hex: '#22C55E' },
  { nombre: 'Verde militar', hex: '#084a01' },
  { nombre: 'Rosa', hex: '#EC4899' },
  { nombre: 'Morado', hex: '#8B5CF6' },
  { nombre: 'Amarillo', hex: '#FACC15' },
  
  { nombre: 'Transparente', hex: '#C7CBD1' },
];

export function hexColor(nombre: string): string {
  if (nombre === COLOR_SIN_VARIANTE) return '#6B7280';
  return COLORES_UNIVERSALES.find((c) => c.nombre === nombre)?.hex ?? '#6B7280';
}
