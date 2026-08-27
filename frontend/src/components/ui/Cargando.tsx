export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="cargando">
      <span className="spinner" />
      {texto}
    </div>
  );
}