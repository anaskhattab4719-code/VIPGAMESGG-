import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initApiBridge } from './utils/apiBridge';
import { registerPwaServiceWorker } from './utils/pwaRegister';

initApiBridge();
void registerPwaServiceWorker();

createRoot(document.getElementById('root')!).render(<App />);
