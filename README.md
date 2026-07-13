# ERP Accesorios (React Native + Expo + Supabase)

App móvil (iOS/Android) para gestión de Inventario, Ventas, Finanzas Bimodal y RRHH/Nómina de una empresa de accesorios de telefonía. Stack 100% gratuito.

## 1. Requisitos
- Node.js 18+
- Cuenta gratuita en [supabase.com](https://supabase.com)
- Expo Go instalado en tu celular (para probar sin compilar) o EAS Build (free tier) para generar APK/IPA

## 2. Setup del backend (Supabase)
1. Crea un proyecto nuevo en Supabase.
2. Ve a **SQL Editor** y pega el contenido de `supabase/schema.sql` (incluido en este repo) — crea todas las tablas, triggers, funciones y RLS.
3. Ve a **Authentication > Users** y crea al menos 2 usuarios: uno con `app_metadata.role = "admin"` (dueño) y otros con `role = "empleado"`. Esto se configura en **Authentication > Users > [usuario] > Edit > Raw App Meta Data**:
   ```json
   { "role": "admin" }
   ```
4. Copia tu **Project URL** y **anon public key** desde **Settings > API**.

## 3. Setup del proyecto
```bash
npm install
cp .env.example .env
# Edita .env con tu SUPABASE_URL y SUPABASE_ANON_KEY
npx expo start
```
Escanea el QR con Expo Go (Android) o la app Cámara (iOS).

## 4. Generar APK/IPA (gratis, EAS free tier)
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

## 5. Estructura del proyecto
```
app/                  → Rutas (expo-router)
  (auth)/login.tsx
  (tabs)/
    index.tsx         → Dashboard
    inventario/       → Módulo Inventario
    ventas/           → Módulo Ventas
    finanzas/         → Módulo Finanzas Bimodal
    rrhh/             → Módulo RRHH (Asistencia, Adelantos, Nómina)
  voice-assistant.tsx → Comandos de voz/texto
hooks/                → Lógica de datos por módulo (Supabase queries)
lib/                  → Cliente Supabase, tema, parser de comandos
types/                → Tipos TypeScript del esquema de BD
components/           → Componentes UI reutilizables
supabase/schema.sql   → Esquema completo listo para pegar en SQL Editor
```

## 6. Notas importantes / Edge cases conocidos
- **Turnos abiertos**: si un empleado marca entrada y olvida marcar salida, ese registro se excluye del cálculo de horas hasta que se cierre manualmente. Revisar `asistencia` sin pareja antes de generar nómina.
- **Turnos que cruzan medianoche**: no soportados en esta versión (se asume jornada dentro del mismo día calendario).
- **Stock por color**: el inventario se maneja solo por modelo (no por color), replicando el flujo actual del operador que cuenta manualmente el pedido del cliente enviado por WhatsApp.
- **Comandos de voz**: la grabación de audio ya está implementada (`expo-av`), pero la transcripción real requiere conectar un servicio STT gratuito (Groq Whisper free-tier o Web Speech API en la versión web). Ver `TODO` en `app/voice-assistant.tsx`.
- **Finanzas bimodal**: la separación Empresa/Personal es lógica (dos filas en `cajas`), no dos cuentas bancarias reales. Solo el rol `admin` ve la caja `personal` (aplicado vía RLS).

## 7. Roadmap sugerido
1. CRUD Inventario + Ventas con descuento automático ✅ (incluido)
2. Finanzas Bimodal + RLS por rol ✅ (incluido)
3. RRHH: asistencia, adelantos, nómina semanal ✅ (incluido)
4. Comandos de voz/texto con parser regex ✅ (incluido, falta conectar STT)
5. Consignaciones/Vendedores con recordatorios automáticos (usar `pg_cron` en Supabase, gratis)
6. Reconocimiento de color por foto (YOLOv8 open source) — requiere dataset propio, fuera del MVP
