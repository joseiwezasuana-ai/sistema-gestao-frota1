import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import SystemErrorBoundary from './components/SystemErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemErrorBoundary>
      <App />
    </SystemErrorBoundary>
  </StrictMode>,
);
