# ERP Accesorios (React Native + Expo + Supabase)

App móvil (iOS/Android/Web) para gestión de Inventario, Ventas (con consignaciones), Finanzas Bimodal, RRHH/Nómina y Estadísticas de una empresa de accesorios de telefonía.

## 1. Requisitos
- Node.js 18+
- Cuenta gratuita en [supabase.com](https://supabase.com)
- Expo Go instalado en tu celular (para probar sin compilar) o EAS Build (free tier) para generar APK/IPA

## 2. Setup del backend (Supabase) — desde cero
1. Crea un proyecto nuevo en Supabase (o usa uno existente que quieras limpiar por completo).
2. Ve a **SQL Editor** y pega el contenido completo de `supabase/schema.sql`. Este script **elimina y vuelve a crear todas las tablas, funciones, triggers y políticas RLS** — es seguro correrlo en un proyecto ya usado con este mismo esquema, pero borrará los datos existentes.
3. Al final del script hay un `INSERT` comentado para asignarte como admin. Descoméntalo, reemplaza el correo por el tuyo y córrelo aparte (después de haberte registrado al menos una vez desde la app, para que exista en `auth.users`).
4. Copia tu **Project URL** y **anon public key** desde **Settings > API**.

> **¿Ya tenías el esquema viejo corriendo con datos?** NO corras `schema.sql` (borra todo). Corre `supabase/migration.sql` en su lugar: es no destructivo e idempotente — agrega los constraints, triggers y RPCs nuevos sin tocar tus datos.

## 3. Setup del proyecto
```bash
npm install
cp .env.example .env
# Edita .env con tu SUPABASE_URL y SUPABASE_ANON_KEY
npx expo start
```
Escanea el QR con Expo Go (Android) o la app Cámara (iOS).

## ⚠️ Regla importante para evitar crashes en Android/iOS
Cada vez que agregues una librería con código nativo (cualquier paquete `expo-*` o `react-native-*`), **nunca uses `npm install <paquete>` a secas**. Usa siempre:
```bash
npx expo install <paquete>
```

## 4. Generar APK/IPA (gratis, EAS free tier)
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

## 5. Estructura del proyecto
```
app/
  (auth)/login.tsx
  (tabs)/
    index.tsx              → Dashboard: KPIs del día, cajas, alertas y actividad reciente
    inventario/             → Módulo Inventario
    ventas/
      index.tsx             → Lista de ventas ("Venta a {cliente}")
      nueva.tsx              → Nueva venta O nueva consignación (toggle)
      [id].tsx                → Detalle de venta: cliente + modelos vendidos
      consignaciones/
        index.tsx             → Lista de consignaciones + total por cobrar
        [id].tsx                → Detalle + registrar pagos parciales/totales
    finanzas/                → Caja Empresa/Personal + Cuentas por Cobrar
    rrhh/                    → Asistencia, Adelantos, Nómina
    estadisticas/
      index.tsx               → Submenú Productos / Clientes / Empleados
      productos.tsx            → Ranking de modelos, tabla o gráfica
      clientes.tsx              → Ranking de clientes + modelos que prefiere cada uno
      empleados.tsx              → Horas trabajadas y pagos, tabla o gráfica
hooks/          → useInventario, useVentas, useConsignaciones, useFinanzas, useRRHH, useEstadisticas
lib/            → Cliente Supabase, tema, fechas, sistema de avisos (toast/confirmación)
types/          → Tipos TypeScript del esquema de BD
components/     → EmptyState, ProductCard, StatCard, SectionHeader, AlertRow, PieChart, BarChart, ViewToggle, ClienteAutocomplete, Select, DateField, FeedbackHost, SoloAdmin
supabase/schema.sql → Esquema completo (DROP + CREATE) listo para pegar en SQL Editor
```

## 6. Cómo funcionan las consignaciones
- Al crear una nueva operación en Ventas, eliges **Venta normal** o **Consignación**.
- Ambas descuentan stock igual. La diferencia es el dinero: una **venta** ingresa el total a caja de inmediato; una **consignación** NO genera ingreso hasta que registras un pago.
- El saldo pendiente de todas las consignaciones no liquidadas se muestra en **Finanzas** como **"Cuentas por cobrar"** (tarjeta naranja), y es clickeable para ir directo al listado.
- Desde el detalle de una consignación puedes registrar pagos parciales o pagar el saldo completo de un toque; cada pago genera automáticamente el ingreso correspondiente en Finanzas y actualiza el estado (`pendiente` → `parcial` → `liquidada`).

## 7. Notas / edge cases conocidos
- **Turnos abiertos** (entrada sin salida) se excluyen del cálculo de horas hasta cerrarse manualmente.
- **Turnos que cruzan medianoche**: no soportados en esta versión.
- **Stock por color**: el inventario se maneja solo por modelo, no por color.
- **Estadísticas**: las agregaciones (top productos, ranking de clientes, modelos preferidos, horas de empleados) se calculan en el cliente a partir de las filas de `ventas`, `consignaciones` y `nomina` — no hay vistas materializadas en Postgres, dado el volumen de datos esperado para este negocio.
- **Avisos y listas**: los avisos de la app son toasts oscuros auto-desvanecibles y las confirmaciones son modales del tema (`lib/alert.ts` + `components/FeedbackHost.tsx`); los selectores (`components/Select.tsx`) y el selector de fechas (`components/DateField.tsx`) son acoplados al tema oscuro — no se usan los diálogos blancos del sistema (`Alert.alert`, `Picker`, input de fecha manual).
