// Devuelve "YYYY-MM-DD" usando la fecha LOCAL del dispositivo.
// Ojo: new Date().toISOString() devuelve UTC, lo que entre las 19:00 y
// 23:59 en Perú (UTC-5) reporta la fecha de "mañana" — bug de zona horaria.
export function fechaLocalISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}
