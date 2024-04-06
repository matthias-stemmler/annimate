import { App } from '@/components/app';
import '@/index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';

if (import.meta.env.PROD) {
  document.addEventListener('contextmenu', (event) => {
    if (!(event.target instanceof HTMLTextAreaElement)) {
      event.preventDefault();
    }
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
