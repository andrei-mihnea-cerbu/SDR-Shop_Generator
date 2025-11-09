import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { NotificationProvider } from './context/NotificationProvider.tsx';
import { ShopProvider } from './context/ShopContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NotificationProvider>
      <ShopProvider>
        <App />
      </ShopProvider>
    </NotificationProvider>
  </StrictMode>
);
