import React from 'react';
import { AppDataProvider } from './services/store/AppDataContext';
import { ToastProvider } from './components/ui/Toast';
import { Shell } from './components/layout/Shell';

const App: React.FC = () => {
  return (
    <AppDataProvider>
      <ToastProvider>
        <div className="min-h-svh bg-black font-sans text-zinc-50 antialiased">
          <Shell />
        </div>
      </ToastProvider>
    </AppDataProvider>
  );
};

export default App;
