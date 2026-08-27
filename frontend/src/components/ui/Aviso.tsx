interface Props {
  mensaje: string;
  tipo: 'ok' | 'error' | 'info';
  onCerrar: () => void;
}

export function Aviso({ mensaje, tipo, onCerrar }: Props) {
  return (
    <div className={`aviso aviso-${tipo}`}>
      <span>{mensaje}</span>
      <button className="icon-btn" onClick={onCerrar} aria-label="Cerrar">
        ✕
      </button>
    </div>
  );
}