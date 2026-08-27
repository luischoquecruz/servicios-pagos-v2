import { useEffect, useMemo, useState } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import { eliminarPago, registrarPago } from '../api';
import type { Pago } from '../types';
import { fmtBs, fmtFecha, hoy, mesActual, normPeriodo, nombreServicio, toNum } from '../utils';
import { Boton } from '../components/ui/Boton';
import { Campo, Fecha, Numero, Seleccion, Texto } from '../components/ui/Campos';
import { Aviso } from '../components/ui/Aviso';

interface AvisoUi {
  mensaje: string;
  tipo: 'ok' | 'error';
}

interface GrupoMes {
  periodo: string;
  facturas: Pago[];
  total: number;
}

function agruparPorMes(lista: Pago[]): GrupoMes[] {
  const mapa = new Map<string, Pago[]>();
  for (const p of lista) {
    const key = normPeriodo(p.periodo) || p.periodo || 'sin-periodo';
    const arr = mapa.get(key) ?? [];
    arr.push(p);
    mapa.set(key, arr);
  }
  const meses = [...mapa.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([periodo, facturas]) => ({
      periodo,
      facturas: facturas.sort(
        (a, b) =>
          (b.fechaPago ?? '').localeCompare(a.fechaPago ?? '') ||
          b.id.localeCompare(a.id),
      ),
      total: facturas.reduce((s, p) => s + toNum(p.montoBs), 0),
    }));
  return meses;
}

function nombreMes(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  const nombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const idx = parseInt(mes, 10) - 1;
  return `${nombres[idx] ?? mes} ${anio}`;
}

export function Facturas() {
  const { snap, mapSvc, recargar } = useSnapshot();
  const [aviso, setAviso] = useState<AvisoUi | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [editarId, setEditarId] = useState<string | null>(null);
  const [mesesAbiertos, setMesesAbiertos] = useState<Set<string>>(new Set());

  // Form
  const [servicioId, setServicioId] = useState('');
  const [periodo, setPeriodo] = useState(mesActual());
  const [monto, setMonto] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [unidadMedida, setUnidadMedida] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [observacion, setObservacion] = useState('');

  const svc = snap?.servicios ?? [];

  const facturasSnap = useMemo(() => {
    return (snap?.pagos ?? [])
      .filter((p) => !p.inquilinoId)
      .map((p) => ({ ...p, periodo: normPeriodo(p.periodo) }));
  }, [snap?.pagos]);

  const [facturas, setFacturas] = useState<Pago[]>(facturasSnap);
  useEffect(() => {
    setFacturas((prev) => {
      const porId = new Map(facturasSnap.map((p) => [p.id, p]));
      const merge = facturasSnap.map((p) => prev.find((x) => x.id === p.id) ?? p);
      for (const p of prev) {
        if (!porId.has(p.id)) merge.push(p);
      }
      return merge.sort(
        (a, b) =>
          (b.fechaPago ?? '').localeCompare(a.fechaPago ?? '') ||
          b.periodo.localeCompare(a.periodo) ||
          b.id.localeCompare(a.id),
      );
    });
  }, [facturasSnap]);

  const meses = useMemo(() => agruparPorMes(facturas), [facturas]);
  const total = useMemo(() => facturas.reduce((s, p) => s + toNum(p.montoBs), 0), [facturas]);

  // Abrir el mes mas reciente al cargar
  useEffect(() => {
    if (meses.length > 0 && mesesAbiertos.size === 0) {
      setMesesAbiertos(new Set([meses[0].periodo]));
    }
  }, [meses]);

  const toggleMes = (periodo: string) => {
    setMesesAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(periodo)) next.delete(periodo);
      else next.add(periodo);
      return next;
    });
  };

  const seleccionarServicio = (id: string) => {
    setServicioId(id);
    const s = svc.find((x) => x.id === id);
    setUnidadMedida(s?.unidadMedida ?? '');
  };

  const resetForm = () => {
    setEditarId(null);
    setMonto('');
    setCantidad('');
    setUnidadMedida('');
    setObservacion('');
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const factura: Pago = {
        id: editarId ?? '',
        inquilinoId: null,
        servicioId,
        periodo,
        fechaPago: fecha,
        montoBs: toNum(monto),
        cantidad: toNum(cantidad) || null,
        unidadMedida: unidadMedida.trim() || null,
        observacion,
      };
      const creado = await registrarPago(factura);
      const c = { ...creado, periodo: normPeriodo(creado.periodo) || periodo };
      setFacturas((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
      const mesCreado = normPeriodo(c.periodo);
      setMesesAbiertos((prev) => new Set([...prev, mesCreado]));
      resetForm();
      setAviso({
        mensaje: editarId ? 'Factura actualizada' : `Factura registrada: ${fmtBs(creado.montoBs)}`,
        tipo: 'ok',
      });
      recargar();
    } catch (err) {
      setAviso({ mensaje: err instanceof Error ? err.message : 'Error', tipo: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const iniciarEdicion = (p: Pago) => {
    setEditarId(p.id);
    setServicioId(p.servicioId ?? '');
    setPeriodo(normPeriodo(p.periodo));
    setMonto(String(p.montoBs ?? ''));
    setCantidad(p.cantidad != null ? String(p.cantidad) : '');
    setUnidadMedida(p.unidadMedida ?? '');
    setFecha(p.fechaPago ?? hoy());
    setObservacion(p.observacion ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setEditarId(null);
    setServicioId('');
    setPeriodo(mesActual());
    setFecha(hoy());
    resetForm();
  };

  const eliminar = async (p: Pago) => {
    if (!window.confirm('¿Eliminar esta factura?')) return;
    try {
      await eliminarPago(p.id);
      setFacturas((prev) => prev.filter((x) => x.id !== p.id));
      setAviso({ mensaje: 'Factura eliminada', tipo: 'ok' });
      recargar();
    } catch (err) {
      setAviso({ mensaje: err instanceof Error ? err.message : 'Error', tipo: 'error' });
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Facturas de servicios</h2>
        <strong className="total-badge">{fmtBs(total)}</strong>
      </div>

      {aviso && <Aviso mensaje={aviso.mensaje} tipo={aviso.tipo} onCerrar={() => setAviso(null)} />}

      <div className="grid3">
        {/* Formulario */}
        <section className="panel">
          <h3>{editarId ? 'Editar factura' : 'Registrar factura'}</h3>
          {editarId && (
            <p className="muted">
              Editando factura del {fmtFecha(fecha)}.{' '}
              <a onClick={cancelarEdicion} style={{ cursor: 'pointer' }}>Cancelar</a>
            </p>
          )}
          <div className="form-grid">
            <Campo label="Servicio">
              <Seleccion value={servicioId} onChange={(e) => seleccionarServicio(e.target.value)}>
                <option value="">— Seleccionar servicio —</option>
                {svc.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </Seleccion>
            </Campo>
            <Campo label="Mes de consumo">
              <input className="input" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
            </Campo>
            <Campo label="Monto (Bs)">
              <Numero value={monto} min={0} placeholder="0.00" onChange={(e) => setMonto(e.target.value)} />
            </Campo>
            <Campo label="Fecha de la factura">
              <Fecha value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Campo>
            <Campo label="Cantidad" hint="Opcional: consumo medido">
              <Numero value={cantidad} min={0} step="0.01" placeholder="kWh, m3…" onChange={(e) => setCantidad(e.target.value)} />
            </Campo>
            <Campo label="Unidad de medida" hint="Se usa la del servicio, ajustable">
              <Texto value={unidadMedida} onChange={(e) => setUnidadMedida(e.target.value)} placeholder="kWh" />
            </Campo>
            <Campo label="Observación">
              <Texto value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Opcional" />
            </Campo>
            <div className="form-acciones">
              <Boton onClick={() => void guardar()} disabled={guardando || !servicioId || toNum(monto) <= 0}>
                {guardando ? (editarId ? 'Guardando…' : 'Registrando…') : (editarId ? 'Guardar cambios' : 'Registrar factura')}
              </Boton>
            </div>
          </div>
          <p className="muted">
            Este monto es la base del cobro: al generar los cobros del mes se reparte entre los
            inquilinos según el método del servicio (por cuartos o por personas).
          </p>
        </section>

        {/* Lista agrupada por mes */}
        <section className="panel">
          <div className="panel-head">
            <h3>Facturas por mes</h3>
            <span className="muted">{facturas.length} factura{facturas.length !== 1 ? 's' : ''}</span>
          </div>

          {meses.length === 0 && (
            <div className="muted" style={{ padding: '20px', textAlign: 'center' }}>
              No hay facturas registradas.
            </div>
          )}

          <div className="meses-grupo">
            {meses.map((mes) => {
              const abierto = mesesAbiertos.has(mes.periodo);
              return (
                <div key={mes.periodo} className="mes-grupo">
                  <button className="mes-header" onClick={() => toggleMes(mes.periodo)}>
                    <span className="mes-header-left">
                      <span className={`mes-flecha ${abierto ? 'mes-flecha-abierta' : ''}`}>▶</span>
                      <strong>{nombreMes(mes.periodo)}</strong>
                      <span className="muted">{mes.facturas.length} factura{mes.facturas.length !== 1 ? 's' : ''}</span>
                    </span>
                    <span className="mes-header-total">{fmtBs(mes.total)}</span>
                  </button>
                  {abierto && (
                    <div className="mes-contenido">
                      <table className="tabla">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Servicio</th>
                            <th className="num">Cantidad</th>
                            <th className="num">Monto</th>
                            <th>Observación</th>
                            <th className="acciones">—</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mes.facturas.map((p) => (
                            <tr key={p.id}>
                              <td>{fmtFecha(p.fechaPago)}</td>
                              <td>{nombreServicio(p.servicioId, mapSvc)}</td>
                              <td className="num">
                                {p.cantidad != null ? `${p.cantidad} ${p.unidadMedida ?? ''}`.trim() : '—'}
                              </td>
                              <td className="num"><strong>{fmtBs(p.montoBs)}</strong></td>
                              <td className="muted">{p.observacion || '—'}</td>
                              <td className="acciones">
                                <Boton variante="secundario" className="btn-mini" onClick={() => iniciarEdicion(p)}>
                                  Editar
                                </Boton>
                                <Boton variante="peligro" className="btn-mini" onClick={() => eliminar(p)}>
                                  Eliminar
                                </Boton>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
