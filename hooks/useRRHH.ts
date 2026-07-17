import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Adelanto, Asistencia, Empleado, MetodoRegistro, Nomina } from '@/types/database';

export function useEmpleados() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmpleados = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre');
    if (!error) setEmpleados(data as Empleado[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEmpleados();
  }, [fetchEmpleados]);

  async function crearEmpleado(nombre: string, salarioHora: number) {
    const { error } = await supabase.from('empleados').insert({
      nombre,
      salario_hora: salarioHora,
      activo: true,
    });
    if (error) throw new Error(error.message);
    await fetchEmpleados();
  }

  return { empleados, loading, crearEmpleado, refetch: fetchEmpleados };
}

export function useAsistencia(empleadoId?: number) {
  const [registros, setRegistros] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('asistencia').select('*').order('timestamp', { ascending: false }).limit(50);
    if (empleadoId) query = query.eq('empleado_id', empleadoId);
    const { data, error } = await query;
    if (!error) setRegistros(data as Asistencia[]);
    setLoading(false);
  }, [empleadoId]);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  function proximoTipo(empId: number, fechaISO?: string): 'entrada' | 'salida' {
    const fecha = fechaISO ? new Date(fechaISO).toDateString() : new Date().toDateString();
    const deEseDia = registros.filter(
      (r) => r.empleado_id === empId && new Date(r.timestamp).toDateString() === fecha
    );
    if (deEseDia.length === 0) return 'entrada';
    return deEseDia[0].tipo === 'entrada' ? 'salida' : 'entrada';
  }

  async function marcarAsistencia(
    empId: number,
    tipo: 'entrada' | 'salida',
    metodo: MetodoRegistro = 'manual',
    timestampPersonalizado?: string
  ) {
    const { error } = await supabase.from('asistencia').insert({
      empleado_id: empId,
      tipo,
      metodo_registro: metodo,
      ...(timestampPersonalizado ? { timestamp: timestampPersonalizado } : {}),
    });
    // El trigger de BD rechaza dos entradas/salidas seguidas el mismo día;
    // el mensaje de error ya viene en español, listo para mostrar con showAlert.
    if (error) throw new Error(error.message);
    await fetchRegistros();
  }

  async function eliminarAsistencia(registroId: number) {
    const { error } = await supabase.from('asistencia').delete().eq('id', registroId);
    if (error) throw new Error(error.message);
    await fetchRegistros();
  }

  return { registros, loading, proximoTipo, marcarAsistencia, eliminarAsistencia, refetch: fetchRegistros };
}

export function useAdelantos(empleadoId?: number) {
  const [adelantos, setAdelantos] = useState<Adelanto[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdelantos = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('adelantos').select('*').order('fecha', { ascending: false });
    if (empleadoId) query = query.eq('empleado_id', empleadoId);
    const { data, error } = await query;
    if (!error) setAdelantos(data as Adelanto[]);
    setLoading(false);
  }, [empleadoId]);

  useEffect(() => {
    fetchAdelantos();
  }, [fetchAdelantos]);

  async function registrarAdelanto(empId: number, monto: number, motivo: string) {
    const { error } = await supabase.from('adelantos').insert({ empleado_id: empId, monto, motivo });
    if (error) throw new Error(error.message);
    await fetchAdelantos();
  }

  const pendientes = adelantos.filter((a) => !a.descontado && a.saldo_pendiente > 0);
  const deudaTotalPendiente = pendientes.reduce((acc, a) => acc + a.saldo_pendiente, 0);

  return { adelantos, pendientes, deudaTotalPendiente, loading, registrarAdelanto, refetch: fetchAdelantos };
}

export function useNomina(empleadoId?: number) {
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNominas = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('nomina').select('*').order('semana_inicio', { ascending: false });
    if (empleadoId) query = query.eq('empleado_id', empleadoId);
    const { data, error } = await query;
    if (!error) setNominas(data as Nomina[]);
    setLoading(false);
  }, [empleadoId]);

  useEffect(() => {
    fetchNominas();
  }, [fetchNominas]);

  // Llama a la función SQL generar_nomina_semanal(p_empleado_id, p_semana_inicio),
  // que calcula horas trabajadas, descuenta adelantos pendientes y crea la fila.
  async function generarNomina(empId: number, semanaInicioISO: string): Promise<number> {
    const { data, error } = await supabase.rpc('generar_nomina_semanal', {
      p_empleado_id: empId,
      p_semana_inicio: semanaInicioISO,
    });
    if (error) throw new Error(error.message);
    await fetchNominas();
    return data as number;
  }

  // El trigger procesar_nomina_pagada (en la BD) genera el egreso
  // en caja empresa automáticamente al marcar pagado = true.
  async function marcarPagada(nominaId: number) {
    const { error } = await supabase.from('nomina').update({ pagado: true }).eq('id', nominaId);
    if (error) throw new Error(error.message);
    await fetchNominas();
  }

  return { nominas, loading, generarNomina, marcarPagada, refetch: fetchNominas };
}
