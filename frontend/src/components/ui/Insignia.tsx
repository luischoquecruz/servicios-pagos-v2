type Tipo = 'ok' | 'mal' | 'neutro' | 'info';

export function Insignia({ tipo, children }: { tipo: Tipo; children: React.ReactNode }) {
  return <span className={`insignia insignia-${tipo}`}>{children}</span>;
}