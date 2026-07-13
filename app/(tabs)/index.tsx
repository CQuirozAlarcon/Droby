import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as Speech from 'expo-speech';
import { colors, radius, spacing } from '@/lib/theme';
import { parseCommand, parseCantidadesPorModelo } from '@/lib/voiceCommandParser';
import { useInventario } from '@/hooks/useInventario';
import { useVentas } from '@/hooks/useVentas';
import { useEmpleados, useAsistencia, useAdelantos } from '@/hooks/useRRHH';
import { useFinanzas } from '@/hooks/useFinanzas';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface MensajeChat {
  id: string;
  autor: 'user' | 'asistente';
  texto: string;
  esError?: boolean;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { rol, signOut } = useAuth();
  const { productos, buscarPorModelo } = useInventario();
  const { crearVenta } = useVentas();
  const { empleados } = useEmpleados();
  const { marcarAsistencia } = useAsistencia();
  const { registrarAdelanto } = useAdelantos();
  const { saldoDe } = useFinanzas();

  const [texto, setTexto] = useState('');
  const [grabando, setGrabando] = useState(false);
  const [mensajes, setMensajes] = useState<MensajeChat[]>([
    { id: 'bienvenida', autor: 'asistente', texto: 'Hola, dime qué necesitas: marcar asistencia, consultar stock, registrar una venta o un adelanto.' },
  ]);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
  }, []);

  const saldoEmpresa = saldoDe('empresa');
  const saldoPersonal = saldoDe('personal');
  const totalMostrado = rol === 'admin' ? saldoEmpresa + saldoPersonal : saldoEmpresa;

  function agregarMensaje(msg: MensajeChat) {
    setMensajes((prev) => [...prev, msg]);
  }

  function responder(mensaje: string, esError = false) {
    Speech.speak(mensaje, { language: 'es-PE' });
    agregarMensaje({ id: String(Date.now()), autor: 'asistente', texto: mensaje, esError });
  }

  async function iniciarGrabacion() {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permiso denegado', 'Se necesita acceso al micrófono');
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setGrabando(true);
    } catch (e: any) {
      Alert.alert('Error al grabar', e.message);
    }
  }

  async function detenerGrabacion() {
    setGrabando(false);
    await audioRecorder.stop();
    // TODO: enviar audioRecorder.uri a Groq Whisper free-tier (o Web Speech API en web)
    // y volcar la transcripción en setTexto(...). Por ahora, escribe el comando manualmente.
    Alert.alert('Grabación capturada', 'Conecta el servicio de transcripción (ver TODO en el código) o escribe el comando.');
  }

  async function ejecutarComando() {
    if (!texto.trim()) return;
    const textoEnviado = texto.trim();
    agregarMensaje({ id: String(Date.now()), autor: 'user', texto: textoEnviado });
    setTexto('');

    const { intent, groups } = parseCommand(textoEnviado);

    try {
      switch (intent) {
        case 'MARCAR_ENTRADA':
        case 'MARCAR_SALIDA': {
          if (empleados.length === 0) throw new Error('No hay empleados registrados');
          const empleado = empleados[0]; // TODO: resolver empleado por identidad del usuario autenticado
          const tipo = intent === 'MARCAR_ENTRADA' ? 'entrada' : 'salida';
          await marcarAsistencia(empleado.id, tipo, 'voz');
          responder(`Listo, ${tipo} registrada para ${empleado.nombre}.`);
          break;
        }

        case 'CONSULTA_STOCK': {
          const modeloConsultado = groups.modelo?.replace(/\s+/g, ' ').trim();
          if (!modeloConsultado) throw new Error('No entendí el modelo consultado');
          const producto = productos.find((p) =>
            p.modelo.toLowerCase().includes(modeloConsultado.toLowerCase())
          );
          if (!producto) throw new Error(`No encontré stock para "${modeloConsultado}"`);
          responder(`Tienes ${producto.stock_actual} unidades de ${producto.modelo} en stock.`);
          break;
        }

        case 'CONSULTA_GANANCIAS': {
          responder(`El saldo actual de la caja empresa es ${saldoEmpresa.toFixed(2)} soles.`);
          break;
        }

        case 'REGISTRAR_ADELANTO': {
          const monto = parseFloat(groups.monto ?? '');
          const nombreEmpleado = groups.empleado?.trim();
          if (!monto || !nombreEmpleado) throw new Error('No entendí el monto o el empleado');
          const empleado = empleados.find((e) => e.nombre.toLowerCase().includes(nombreEmpleado.toLowerCase()));
          if (!empleado) throw new Error(`No encontré al empleado "${nombreEmpleado}"`);
          await registrarAdelanto(empleado.id, monto, 'Adelanto registrado por voz/texto');
          responder(`Adelanto de ${monto} soles registrado para ${empleado.nombre}.`);
          break;
        }

        case 'REGISTRAR_VENTA': {
          const cantidadesTexto = groups.cantidades;
          const clienteNombre = groups.cliente?.trim();
          if (!cantidadesTexto || !clienteNombre) throw new Error('No entendí los productos o el cliente');

          const cantidades = parseCantidadesPorModelo(cantidadesTexto);
          if (cantidades.length === 0) throw new Error('No pude interpretar las cantidades por modelo');

          const items = cantidades.map(({ cantidad, modelo }) => {
            const producto = buscarPorModelo(modelo);
            if (!producto) throw new Error(`No encontré el producto "${modelo}"`);
            return { producto_id: producto.id, cantidad, precio_unitario: producto.precio_unitario };
          });

          const { data: existente } = await supabase
            .from('clientes')
            .select('id')
            .ilike('nombre', clienteNombre)
            .maybeSingle();

          let clienteId = existente?.id;
          if (!clienteId) {
            const { data: nuevo, error } = await supabase
              .from('clientes')
              .insert({ nombre: clienteNombre, tipo_cliente: 'mayorista' })
              .select()
              .single();
            if (error) throw new Error(error.message);
            clienteId = nuevo.id;
          }

          const venta = await crearVenta(clienteId, items, 'empresa');
          responder(`Venta #${venta.id} registrada por ${venta.total.toFixed(2)} soles.`);
          break;
        }

        default:
          responder('No reconocí ese comando. Intenta con: "marcar entrada", "cuánto hay de iPhone 15" o "vender 50 del 15 para cliente Juan".', true);
      }
    } catch (e: any) {
      responder(`Error: ${e.message}`, true);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.topSection}>
        <Pressable style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>

        <Pressable style={styles.financeRing} onPress={() => router.push('/finanzas')}>
          <View style={styles.ringInner}>
            <Text style={styles.ringLabel}>{rol === 'admin' ? 'Total' : 'Empresa'}</Text>
            <Text style={styles.ringValue}>S/ {totalMostrado.toFixed(0)}</Text>
          </View>
        </Pressable>

        <View style={styles.quickAccessRow}>
          <Pressable style={styles.quickCard} onPress={() => router.push('/ventas')}>
            <Text style={styles.quickEmoji}>🛒</Text>
            <Text style={styles.quickLabel}>Ventas</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => router.push('/rrhh/asistencia')}>
            <Text style={styles.quickEmoji}>🕒</Text>
            <Text style={styles.quickLabel}>Asistencia</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={mensajes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatContent}
        renderItem={({ item }) => (
          <View
            style={[
              styles.bubble,
              item.autor === 'user' ? styles.bubbleUser : styles.bubbleAsistente,
              item.esError && { borderColor: colors.danger, borderWidth: 1 },
            ]}
          >
            <Text style={styles.bubbleText}>{item.texto}</Text>
          </View>
        )}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un comando..."
          placeholderTextColor={colors.textMuted}
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={ejecutarComando}
        />
        <Pressable
          style={[styles.micButton, grabando && { backgroundColor: colors.danger }]}
          onPress={grabando ? detenerGrabacion : iniciarGrabacion}
        >
          <Text style={styles.micIcon}>{grabando ? '⏹' : '🎙️'}</Text>
        </Pressable>
        <Pressable style={styles.sendButton} onPress={ejecutarComando}>
          <Text style={styles.sendIcon}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topSection: { padding: spacing.lg, paddingBottom: spacing.sm, alignItems: 'center' },
  logoutButton: { alignSelf: 'flex-end', marginBottom: spacing.sm },
  logoutText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  financeRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  ringInner: { alignItems: 'center' },
  ringLabel: { color: colors.textMuted, fontSize: 11 },
  ringValue: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 2 },
  quickAccessRow: { flexDirection: 'row', gap: spacing.md },
  quickCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    minWidth: 90,
  },
  quickEmoji: { fontSize: 22 },
  quickLabel: { color: colors.text, fontSize: 12, marginTop: spacing.xs, fontWeight: '600' },
  chatContent: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  bubble: { maxWidth: '85%', borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs },
  bubbleUser: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  bubbleAsistente: { backgroundColor: colors.surface, alignSelf: 'flex-start' },
  bubbleText: { color: colors.text, fontSize: 14 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micIcon: { fontSize: 18 },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: { color: colors.bg, fontSize: 18, fontWeight: '700' },
});
