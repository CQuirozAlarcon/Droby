// Parser de intención basado en reglas. No requiere LLM pagado.
// Cubre: marcar asistencia, consultar stock, consultar ganancias, registrar venta.

export type Intent =
  | 'MARCAR_ENTRADA'
  | 'MARCAR_SALIDA'
  | 'CONSULTA_STOCK'
  | 'CONSULTA_GANANCIAS'
  | 'REGISTRAR_VENTA'
  | 'REGISTRAR_ADELANTO'
  | 'DESCONOCIDO';

export interface ParsedCommand {
  intent: Intent;
  groups: Record<string, string | undefined>;
}

const INTENT_PATTERNS: { intent: Intent; regex: RegExp }[] = [
  {
    intent: 'MARCAR_ENTRADA',
    regex: /marca(r)?\s+(mi\s+)?entrada|^entrada$|llegu[eé]/i,
  },
  {
    intent: 'MARCAR_SALIDA',
    regex: /marca(r)?\s+(mi\s+)?salida|^salida$|me\s+voy|termin[eé]\s+(mi\s+)?turno/i,
  },
  {
    intent: 'CONSULTA_STOCK',
    regex:
      /cu[aá]nt(o|as)\s+(fundas|cargadores)?\s*(hay|queda[n]?|tengo)\s+(de|del)?\s*(?<modelo>iphone\s*\d+\s*(pro\s*max|pro)?)/i,
  },
  {
    intent: 'CONSULTA_GANANCIAS',
    regex: /(cu[aá]nto|ganancia|gan[eé]|ingres[oó])\s+.*(mes|semana|hoy)/i,
  },
  {
    intent: 'REGISTRAR_ADELANTO',
    regex: /adelant[oó]\s+(?<monto>\d+(\.\d+)?)\s+(a|para)\s+(?<empleado>.+)/i,
  },
  {
    intent: 'REGISTRAR_VENTA',
    regex: /vend(e|er|í)\s+(?<cantidades>.+?)\s+para\s+(cliente\s+)?(?<cliente>.+)/i,
  },
];

export function parseCommand(texto: string): ParsedCommand {
  const normalizado = texto.toLowerCase().trim();
  for (const { intent, regex } of INTENT_PATTERNS) {
    const match = normalizado.match(regex);
    if (match) {
      return { intent, groups: (match.groups as Record<string, string | undefined>) ?? {} };
    }
  }
  return { intent: 'DESCONOCIDO', groups: {} };
}

const MODELO_MAP: Record<string, string> = {
  '13': 'iPhone 13',
  '13 pro': 'iPhone 13 Pro',
  '13 pm': 'iPhone 13 Pro Max',
  '13 pro max': 'iPhone 13 Pro Max',
  '14': 'iPhone 14',
  '14 pro': 'iPhone 14 Pro',
  '14 pm': 'iPhone 14 Pro Max',
  '14 pro max': 'iPhone 14 Pro Max',
  '15': 'iPhone 15',
  '15 pro': 'iPhone 15 Pro',
  '15 pm': 'iPhone 15 Pro Max',
  '15 pro max': 'iPhone 15 Pro Max',
  '16': 'iPhone 16',
  '16 pro': 'iPhone 16 Pro',
  '16 pm': 'iPhone 16 Pro Max',
  '16 pro max': 'iPhone 16 Pro Max',
};

export interface CantidadModelo {
  cantidad: number;
  modelo: string;
}

// Parsea "50 del 15, 100 del 15 pro, 80 del 15 pm, 200 del 16"
export function parseCantidadesPorModelo(texto: string): CantidadModelo[] {
  const items = texto.split(',').map((s) => s.trim());
  return items
    .map((item) => {
      const m = item.match(/(\d+)\s+de[l]?\s+(.+)/i);
      if (!m) return null;
      const cantidad = parseInt(m[1], 10);
      const modeloRaw = m[2].trim().toLowerCase();
      const modelo = MODELO_MAP[modeloRaw] ?? modeloRaw;
      return { cantidad, modelo };
    })
    .filter((x): x is CantidadModelo => x !== null);
}

export function normalizarModeloConsulta(modeloRaw: string): string {
  const clave = modeloRaw.trim().toLowerCase().replace(/\s+/g, ' ');
  return MODELO_MAP[clave.replace('iphone ', '')] ?? modeloRaw;
}
