import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // CRITICAL FIX: Use relative path './sw.js' instead of absolute '/sw.js'
    // This allows the app to work in subdirectories (like GitHub Pages /repo-name/)
    navigator.serviceWorker.register('./sw.js').then(
      (registration) => {
        console.log('SW registered: ', registration);
      },
      (registrationError) => {
        console.log('SW registration failed: ', registrationError);
      }
    );
  });
}