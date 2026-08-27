import { useState } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import type { Servicio } from '../types';
import { actualizarServicio, crearServicio, eliminarServicio } from '../api';
import { Boton } from '../components/ui/Boton';
import { Modal } from '../components/ui/Modal';
import { Campo, Seleccion, Texto } from '../components/ui/Campos';
import { Insignia } from '../components/ui/Insignia';
import { Aviso } from '../components/ui/Aviso';

interface AvisoUi {
  mensaje: string;
  tipo: 'ok' | 'error';
}

function vacio(): Servicio {
  return {
    id: '',
    nombre: '',
    unidadMedida: '',
    metodoPago: 'CUARTOS',
    extras: [],
  };
}

export function Servicios() {
  const { snap, recargar } = useSnapshot();
  const [aviso, setAviso] = useState<AvisoUi | null>(null);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<Servicio>(vacio());
  const [guardando, setGuardando] = useState(false);
  const [nuevoExtra, setNuevoExtra] = useState('');

  const lista = snap?.servicios ?? [];

  const abrirNuevo = () => {
    setEditando(vacio());
    setNuevoExtra('');
    setFormAbierto(true);
  };

  const abrirEditar = (s: Servicio) => {
    setEditando({ ...s, extras: [...(s.extras ?? [])] });
    setNuevoExtra('');
    setFormAbierto(true);
  };

  const agregarExtra = () => {
    const nombre = nuevoExtra.trim();
    if (!nombre) return;
    if (editando.extras.some((e) => e.toLowerCase() === nombre.toLowerCase())) {
      setAviso({ mensaje: `Ya existe un extra llamado "${nombre}".`, tipo: 'error' });
      return;
    }
    setEditando({ ...editando, extras: [...editando.extras, nombre] });
    setNuevoExtra('');
  };

  const eliminarExtra = (idx: number) => {
    setEditando({ ...editando, extras: editando.extras.filter((_, i) => i !== idx) });
  };

  const guardar = async () => {
    const nombre = editando.nombre.trim();
    const dup = lista.find(
      (s) => s.id !== editando.id && s.nombre.trim().toLowerCase() === nombre.toLowerCase(),
    );
    if (dup) {
      setAviso({ mensaje: `Ya existe un servicio llamado "${dup.nombre}".`, tipo: 'error' });
      return;
    }
    setGuardando(true);
    try {
      const e = { ...editando, nombre };
      if (e.id) {
        await actualizarServicio(e);
        setAviso({ mensaje: 'Servicio actualizado', tipo: 'ok' });
      } else {
        await crearServicio(e);
        setAviso({ mensaje: 'Servicio creado', tipo: 'ok' });
      }
      setFormAbierto(false);
      recargar();
    } catch (err) {
      setAviso({ mensaje: err instanceof Error ? err.message : 'Error', tipo: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (s: Servicio) => {
    if (!window.confirm(`¿Eliminar el servicio "${s.nombre}"?`)) return;
    try {
      await eliminarServicio(s.id);
      setAviso({ mensaje: 'Servicio eliminado', tipo: 'ok' });
    } catch (err) {
      setAviso({ mensaje: err instanceof Error ? err.message : 'Error', tipo: 'error' });
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Servicios</h2>
        <Boton onClick={abrirNuevo}>+ Nuevo servicio</Boton>
      </div>

      {aviso && <Aviso mensaje={aviso.mensaje} tipo={aviso.tipo} onCerrar={() => setAviso(null)} />}

      <div className="panel">
        <table className="tabla">
          <thead>
            <tr>
               <th>Servicio</th>
               <th>Método de pago</th>
               <th>Medida</th>
               <th>Extras</th>
               <th className="acciones">Acciones</th>
             </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No hay servicios registrados.
                </td>
              </tr>
            )}
            {lista.map((s) => (
              <tr key={s.id}>
                <td>
                  <span className="celda-nombre">{s.nombre}</span>
                </td>
                <td>
                  {s.metodoPago === 'PERSONAS' ? (
                    <Insignia tipo="info">Por personas</Insignia>
                  ) : (
                    <Insignia tipo="neutro">Por cuartos</Insignia>
                  )}
                </td>
                <td>{s.unidadMedida || '—'}</td>
                <td>
                  {(s.extras ?? []).length === 0 ? (
                    <span className="muted">—</span>
                  ) : (
                    s.extras.map((ex, i) => (
                      <Insignia key={i} tipo="neutro">{ex}</Insignia>
                    ))
                  )}
                </td>
                <td className="acciones">
                  <Boton variante="secundario" onClick={() => abrirEditar(s)}>
                    Editar
                  </Boton>
                  <Boton variante="peligro" onClick={() => eliminar(s)}>
                    Eliminar
                  </Boton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={formAbierto}
        title={editando.id ? 'Editar servicio' : 'Nuevo servicio'}
        onClose={() => setFormAbierto(false)}
      >
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            if (!guardando) void guardar();
          }}
        >
          <Campo label="Nombre del servicio">
            <Texto
              value={editando.nombre}
              onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
              placeholder="Luz, Agua, Internet…"
              required
            />
          </Campo>
          <Campo label="Unidad de medida" hint="Opcional: kWh, m3, etc.">
            <Texto
              value={editando.unidadMedida}
              onChange={(e) => setEditando({ ...editando, unidadMedida: e.target.value })}
              placeholder="kWh"
            />
          </Campo>
          <Campo label="Se paga…" hint="Por cuartos o por número de participantes">
            <Seleccion
              value={editando.metodoPago}
              onChange={(e) => setEditando({ ...editando, metodoPago: e.target.value })}
            >
              <option value="CUARTOS">Por cuartos</option>
              <option value="PERSONAS">Por personas</option>
            </Seleccion>
          </Campo>

          <Campo label="Cobros extra" hint="Tipos de cobro adicional que aplica a este servicio (cada uno suma +1 al factor)">
            <div className="extras-editor">
              <div className="extras-lista">
                {editando.extras.map((ex, i) => (
                  <span key={i} className="extra-chip">
                    {ex}
                    <button type="button" className="extra-chip-x" onClick={() => eliminarExtra(i)}>
                      ×
                    </button>
                  </span>
                ))}
                {editando.extras.length === 0 && (
                  <span className="muted">Sin extras configurados</span>
                )}
              </div>
              <div className="extras-agregar">
                <Texto
                  value={nuevoExtra}
                  onChange={(e) => setNuevoExtra(e.target.value)}
                  placeholder="Nombre del extra…"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarExtra();
                    }
                  }}
                />
                <Boton type="button" variante="secundario" onClick={agregarExtra}>
                  Agregar
                </Boton>
              </div>
            </div>
          </Campo>

          <div className="form-acciones">
            <Boton type="submit" disabled={guardando}>
              {guardando
                ? editando.id
                  ? 'Guardando…'
                  : 'Creando…'
                : editando.id
                  ? 'Guardar cambios'
                  : 'Crear'}
            </Boton>
            <Boton variante="fantasma" onClick={() => setFormAbierto(false)}>
              Cancelar
            </Boton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
