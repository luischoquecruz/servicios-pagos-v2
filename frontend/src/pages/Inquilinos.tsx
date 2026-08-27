import { useState } from 'react';
import { useSnapshot } from '../components/SnapshotContext';
import type { Inquilino } from '../types';
import {
  actualizarInquilino,
  crearInquilino,
  eliminarInquilino,
  setEstadoInquilino,
} from '../api';
import { fmtBs, fmtFecha, hoy } from '../utils';
import { Boton } from '../components/ui/Boton';
import { Modal } from '../components/ui/Modal';
import { Campo, Casilla, Fecha, Numero, Texto } from '../components/ui/Campos';
import { Insignia } from '../components/ui/Insignia';
import { Aviso } from '../components/ui/Aviso';

interface AvisoUi {
  mensaje: string;
  tipo: 'ok' | 'error' | 'info';
}

function vacio(): Inquilino {
  return {
    id: '',
    nombre: '',
    celular: '',
    fechaIngreso: hoy(),
    fechaSalida: null,
    habilitado: true,
    habitaciones: 1,
    personas: 1,
    cobraAlquiler: true,
  };
}

export function Inquilinos() {
  const { snap, recargar } = useSnapshot();
  const [formAbierto, setFormAbierto] = useState(false);
  const [editando, setEditando] = useState<Inquilino>(vacio());
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<AvisoUi | null>(null);

  const inq = snap?.inquilinos ?? [];

  const abrirNuevo = () => {
    setEditando(vacio());
    setFormAbierto(true);
  };

  const abrirEditar = (i: Inquilino) => {
    setEditando({ ...i });
    setFormAbierto(true);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const e = editando;
      if (e.id) {
        await actualizarInquilino(e);
        setAviso({ mensaje: 'Inquilino actualizado', tipo: 'ok' });
      } else {
        await crearInquilino(e);
        setAviso({ mensaje: 'Inquilino creado', tipo: 'ok' });
      }
      setFormAbierto(false);
      recargar();
    } catch (err) {
      setAviso({ mensaje: err instanceof Error ? err.message : 'Error', tipo: 'error' });
    } finally {
      setGuardando(false);
    }
  };

  const alternarEstado = async (i: Inquilino) => {
    try {
      await setEstadoInquilino(i.id, !i.habilitado);
      setAviso({
        mensaje: `${i.nombre} ${i.habilitado ? 'deshabilitado' : 'habilitado'}`,
        tipo: 'info',
      });
    } catch (err) {
      setAviso({ mensaje: err instanceof Error ? err.message : 'Error', tipo: 'error' });
    }
  };

  const eliminar = async (i: Inquilino) => {
    if (!window.confirm(`¿Eliminar a "${i.nombre}"? No se pueden eliminar inquilinos con cobros/pagos asociados.`)) {
      return;
    }
    try {
      await eliminarInquilino(i.id);
      setAviso({ mensaje: 'Inquilino eliminado', tipo: 'ok' });
    } catch (err) {
      setAviso({ mensaje: err instanceof Error ? err.message : 'Error', tipo: 'error' });
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Inquilinos</h2>
        <Boton onClick={abrirNuevo}>+ Nuevo inquilino</Boton>
      </div>

      {aviso && <Aviso mensaje={aviso.mensaje} tipo={aviso.tipo} onCerrar={() => setAviso(null)} />}

      <div className="panel">
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Celular</th>
              <th>Ingreso</th>
              <th>Salida</th>
              <th className="num">Cuartos</th>
              <th className="num">Personas</th>
              <th>Estado</th>
              <th className="num">Servicios</th>
              <th className="centro">Alquiler</th>
              <th className="acciones">Acciones</th>
            </tr>
          </thead>
          <tbody>
{inq.length === 0 && (
                <tr>
                  <td colSpan={10} className="muted">
                    No hay inquilinos registrados todavía.
                  </td>
                </tr>
              )}
            {inq.map((i) => {
              const activos = snap?.serviciosInquilinos.filter(
                (si) => si.inquilinoId === i.id && si.activo,
              ).length ?? 0;
              return (
                <tr key={i.id} className={i.habilitado ? '' : 'fila-apagada'}>
                  <td>
                    <span className="celda-nombre">{i.nombre}</span>
                  </td>
                  <td>{i.celular || '—'}</td>
                  <td>{fmtFecha(i.fechaIngreso)}</td>
                  <td>{fmtFecha(i.fechaSalida)}</td>
                  <td className="num">{i.habitaciones}</td>
                  <td className="num">{i.personas}</td>
                  <td>
                    {i.habilitado ? (
                      <Insignia tipo="ok">Activo</Insignia>
                    ) : (
                      <Insignia tipo="mal">Deshabilitado</Insignia>
                    )}
                  </td>
                  <td className="num">{activos}</td>
                  <td className="centro">
                    {i.cobraAlquiler ? (
                      <>
                        <Insignia tipo="ok">Sí</Insignia>
                        {i.alquilerBs ? (
                          <div className="muted">{fmtBs(i.alquilerBs)}/mes</div>
                        ) : (
                          <div className="muted">sin monto</div>
                        )}
                      </>
                    ) : (
                      <Insignia tipo="neutro">No</Insignia>
                    )}
                  </td>
                  <td className="acciones">
                    <Boton variante="secundario" onClick={() => abrirEditar(i)}>
                      Editar
                    </Boton>
                    <Boton variante="peligro" onClick={() => eliminar(i)}>
                      Eliminar
                    </Boton>
                    <button
                      className="btn btn-fantasma btn-mini"
                      onClick={() => alternarEstado(i)}
                      title="Cambiar estado"
                    >
                      {i.habilitado ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={formAbierto}
        title={editando.id ? 'Editar inquilino' : 'Nuevo inquilino'}
        onClose={() => setFormAbierto(false)}
      >
        <form className="form-grid">
          <Campo label="Nombre">
            <Texto
              value={editando.nombre}
              onChange={(e) => setEditando({ ...editando, nombre: e.target.value })}
              placeholder="Nombre completo"
              required
            />
          </Campo>
          <Campo label="Celular">
            <Texto
              value={editando.celular}
              onChange={(e) => setEditando({ ...editando, celular: e.target.value })}
              placeholder="7XXXXXXX"
            />
          </Campo>
          <Campo label="Fecha de ingreso">
            <Fecha
              value={editando.fechaIngreso ?? ''}
              onChange={(e) => setEditando({ ...editando, fechaIngreso: e.target.value })}
            />
          </Campo>
          <Campo label="Fecha de salida" hint="Se deja vacía si sigue viviendo">
            <Fecha
              value={editando.fechaSalida ?? ''}
              onChange={(e) =>
                setEditando({ ...editando, fechaSalida: e.target.value || null })
              }
            />
          </Campo>
          <Campo label="Habitaciones alquiladas">
            <Numero
              value={editando.habitaciones}
              min={1}
              onChange={(e) =>
                setEditando({ ...editando, habitaciones: Number(e.target.value) || 0 })
              }
            />
          </Campo>
          <Campo label="Personas que la habitan">
            <Numero
              value={editando.personas}
              min={1}
              onChange={(e) =>
                setEditando({ ...editando, personas: Number(e.target.value) || 0 })
              }
            />
          </Campo>
          <Casilla
            label="Inquilino habilitado"
            checked={editando.habilitado}
            onChange={(e) => setEditando({ ...editando, habilitado: e.target.checked })}
          />
          <Casilla
            label="Cobrar alquiler mensual"
            checked={editando.cobraAlquiler ?? false}
            onChange={(e) =>
              setEditando({ ...editando, cobraAlquiler: e.target.checked })
            }
          />
          {(editando.cobraAlquiler ?? false) && (
            <Campo label="Monto de alquiler (Bs/mes)" hint="Cada inquilino puede tener su propio monto">
              <Numero
                value={editando.alquilerBs ?? ''}
                min={0}
                placeholder="0.00"
                onChange={(e) =>
                  setEditando({ ...editando, alquilerBs: Number(e.target.value) || 0 })
                }
              />
            </Campo>
          )}
          <div className="form-acciones">
            <Boton type="button" disabled={guardando} onClick={() => void guardar()}>
              {editando.id
                ? (guardando ? 'Guardando...' : 'Guardar cambios')
                : (guardando ? 'Creando...' : 'Crear')}
            </Boton>
            <Boton variante="fantasma" type="button" onClick={() => setFormAbierto(false)}>
              Cancelar
            </Boton>
          </div>
        </form>
      </Modal>
    </div>
  );
}