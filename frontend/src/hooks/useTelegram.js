import { useEffect, useState } from 'react';

/**
 * Telegram WebApp SDK bilan ishlaydi.
 * Telegram tashqarisida ochilsa — brauzer rejimida ishlaydi (test uchun).
 */
export function useTelegram() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [inTelegram, setInTelegram] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (tg && tg.initDataUnsafe?.user) {
      tg.ready();
      tg.expand();

      try {
        tg.setHeaderColor('#262421');
        tg.setBackgroundColor('#262421');
      } catch { /* eski Telegram versiyalari qo'llab-quvvatlamaydi */ }

      const u = tg.initDataUnsafe.user;
      setUser({
        id: String(u.id),
        name: u.first_name + (u.last_name ? ' ' + u.last_name : ''),
        username: u.username || null
      });
      setInTelegram(true);
    } else {
      // Brauzerda test: URL dan yoki localStorage dan id
      const params = new URLSearchParams(window.location.search);
      let id = params.get('uid') || localStorage.getItem('devUserId');

      if (!id) {
        id = 'dev' + Math.floor(Math.random() * 100000);
        localStorage.setItem('devUserId', id);
      }

      setUser({ id, name: 'Test ' + id.slice(-4), username: null });
    }

    setReady(true);
  }, []);

  const haptic = (style = 'light') => {
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style); } catch {}
  };

  const notify = (type = 'success') => {
    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type); } catch {}
  };

  const close = () => {
    try { window.Telegram?.WebApp?.close(); } catch {}
  };

  return { user, ready, inTelegram, haptic, notify, close };
}
