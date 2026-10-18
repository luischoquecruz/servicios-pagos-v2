import { useState } from 'react';
import type { FormEvent } from 'react';
import { getInfo } from '../api';
import { borrarClave, guardarClave } from '../clave';
import { MODO_SCRIPT } from '../modo';
import { Boton } from './ui/Boton';

/** Pantalla que pide la clave de acceso y la valida contra la API. */
export function Acceso({ motivo, onEntrar }: { motivo: string | null; onEntrar: () => void }) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(motivo);
  const [probando, setProbando] = useState(false);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    const valor = clave.trim();
    if (!valor) {
      setError('Ingresa la clave de acceso');
      return;
    }
    setProbando(true);
    setError(null);
    guardarClave(valor);
    try {
      await getInfo();
      onEntrar();
    } catch (err) {
      borrarClave();
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setProbando(false);
    }
  };

  return (
    <div className="acceso">
      <form className="acceso-caja" onSubmit={entrar}>
        <strong className="acceso-titulo">Alquileres</strong>
        <p className="muted">
          Ingresa la clave de acceso{MODO_SCRIPT ? ' del Apps Script' : ' del servidor'}. Se guarda solo en
          este dispositivo.
        </p>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          placeholder="Clave de acceso"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          autoFocus
        />
        {error && <small className="acceso-error">{error}</small>}
        <Boton type="submit" disabled={probando}>
          {probando ? 'Verificando…' : 'Entrar'}
        </Boton>
      </form>
    </div>
  );
}
