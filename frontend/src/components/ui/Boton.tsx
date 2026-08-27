import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
}

export function Boton({ variante = 'primario', className, ...rest }: Props) {
  return <button className={`btn btn-${variante} ${className ?? ''}`} {...rest} />;
}