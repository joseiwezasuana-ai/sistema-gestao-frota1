import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import SystemErrorBoundary from './components/SystemErrorBoundary';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register service worker
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Nova versão disponível. Atualizar agora?')) {
      updateSW();
    }
  },
  onOfflineReady() {
    console.log('App pronta para uso offline!');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemErrorBoundary>
      <App />
    </SystemErrorBoundary>
  </StrictMode>,
);
