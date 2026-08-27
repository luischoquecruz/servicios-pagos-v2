import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

interface CampoProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export function Campo({ label, children, hint }: CampoProps) {
  return (
    <label className="campo">
      <span className="campo-label">{label}</span>
      {children}
      {hint ? <small className="campo-hint">{hint}</small> : null}
    </label>
  );
}

export function Texto(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Numero(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" type="number" step="any" {...props} />;
}

export function Fecha(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" type="date" {...props} />;
}

export function Seleccion(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />;
}

export function Casilla({ label, ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="casilla">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}