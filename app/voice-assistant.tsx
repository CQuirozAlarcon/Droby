import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import * as Speech from 'expo-speech';
import { colors, radius, spacing } from '@/lib/theme';
import { parseCommand, parseCantidadesPorModelo } from '@/lib/voiceCommandParser';
import { useInventario } from '@/hooks/useInventario';
import { useVentas } from '@/hooks/useVentas';
import { useEmpleados, useAsistencia, useAdelantos } from '@/hooks/useRRHH';
import { useFinanzas } from '@/hooks/useFinanzas';
import { supabase } from '@/lib/supabase';

interface LogEntry {
  texto: string;
  respuesta: string;
  ok: boolean;
}

export default function VoiceAssistantScreen() {
  const [texto, setTexto] = useState('');
  const [grabando, setGrabando] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) return;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    })();
  }, []);

  const { productos, buscarPorModelo } = useInventario();
  const { crearVenta } = useVentas();
  const { empleados } = useEmpleados();
  const { registros, proximoTipo, marcarAsistencia } = useAsistencia();
  const { registrarAdelanto } = useAdelantos();
  const { saldoDe } = useFinanzas();

  function responder(mensaje: string, ok = true) {
    Speech.speak(mensaje, { language: 'es-PE' });
    setLog((prev) => [{ texto, respuesta: mensaje, ok }, ...prev]);
  }

  // --- Grabación de audio (expo-audio). La transcripción real requiere
  // enviar el archivo a un servicio STT (ver TODO abajo); aquí queda
  // el flujo de captura listo para conectar.
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
    const uri = audioRecorder.uri;

    // TODO: enviar `uri` (audio) a Groq Whisper free-tier (o Web Speech API en web)
    // para obtener la transcripción y volcarla en `setTexto(transcripcion)`.
    // Ejemplo con Groq:
    // const form = new FormData();
    // form.append('file', { uri, type: 'audio/m4a', name: 'audio.m4a' } as any);
    // form.append('model', 'whisper-large-v3');
    // const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}` },
    //   body: form,
    // });
    // const data = await res.json();
    // setTexto(data.text);

    Alert.alert('Grabación capturada', 'Conecta el endpoint de transcripción (ver TODO en el código) o escribe el comando manualmente por ahora.');
  }

  async function ejecutarComando() {
    if (!texto.trim()) return;
    const { intent, groups } = parseCommand(texto);

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
          const saldo = saldoDe('empresa');
          responder(`El saldo actual de la caja empresa es ${saldo.toFixed(2)} soles.`);
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
          responder('No reconocí ese comando. Intenta con: "marcar entrada", "cuánto hay de iPhone 15" o "vender 50 del 15 para cliente Juan".', false);
      }
    } catch (e: any) {
      responder(`Error: ${e.message}`, false);
    }

    setTexto('');
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Ejemplos: "marca mi entrada" · "cuánto hay de iphone 15" · "vender 50 del 15, 100 del 15 pro para
          cliente Juan" · "adelanto 100 a Carlos"
        </Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Escribe o dicta tu comando..."
            placeholderTextColor={colors.textMuted}
            value={texto}
            onChangeText={setTexto}
            onSubmitEditing={ejecutarComando}
          />
          <Pressable style={styles.sendButton} onPress={ejecutarComando}>
            <Text style={styles.sendText}>▶</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.micButton, grabando && { backgroundColor: colors.danger }]}
          onPress={grabando ? detenerGrabacion : iniciarGrabacion}
        >
          <Text style={styles.micText}>{grabando ? '⏹ Detener grabación' : '🎙️ Grabar comando de voz'}</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Historial</Text>
        {log.map((entry, i) => (
          <View key={i} style={[styles.logEntry, !entry.ok && { borderLeftColor: colors.danger }]}>
            <Text style={styles.logTexto}>"{entry.texto}"</Text>
            <Text style={[styles.logRespuesta, !entry.ok && { color: colors.danger }]}>{entry.respuesta}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  sendButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, justifyContent: 'center' },
  sendText: { color: colors.bg, fontSize: 18, fontWeight: '700' },
  micButton: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  micText: { color: colors.text, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
  logEntry: { backgroundColor: colors.surface, borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.xs, borderLeftWidth: 3, borderLeftColor: colors.success },
  logTexto: { color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  logRespuesta: { color: colors.text, fontSize: 13, marginTop: 2 },
});
