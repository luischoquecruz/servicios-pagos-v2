import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import './diseno.css';
import { aplicarTema, leerTema } from './tema';

// Aplicar el tema antes de pintar para evitar un destello.
aplicarTema(leerTema());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);