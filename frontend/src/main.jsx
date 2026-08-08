import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/design.css';
import './styles/theme-light.css';
import './styles/extensions.css';
import './styles/mobile-responsive.css';
import './styles/polish.css';

// React render bo'lishidan oldin temani qo'llaymiz — sahifa ochilganda
// noto'g'ri (default) tema bir zumga chaqnab (flash) ko'rinib qolmasligi uchun
if (localStorage.getItem('appTheme') === 'light') {
  document.documentElement.dataset.theme = 'light';
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
