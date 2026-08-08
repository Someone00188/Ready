// frontend/src/hooks/useSound.js
//
// Shaxmat o'yini uchun ovoz effektlari (lichess.org standart to'plamidan,
// ochiq manba). Har bir action turi uchun mos ovoz: yurish, olish,
// shoh berish, mat, durrang, g'alaba, mag'lubiyat, vaqt kam qolganda.

import { useRef, useCallback, useEffect } from 'react';

const SOUND_FILES = {
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  check: '/sounds/check.mp3',
  checkmate: '/sounds/checkmate.mp3',
  draw: '/sounds/draw.mp3',
  victory: '/sounds/victory.mp3',
  defeat: '/sounds/defeat.mp3',
  lowtime: '/sounds/lowtime.mp3'
};

let audioCache = null;

function getAudioCache() {
  if (!audioCache) {
    audioCache = {};
    for (const [key, src] of Object.entries(SOUND_FILES)) {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audioCache[key] = audio;
    }
  }
  return audioCache;
}

/**
 * Ovoz effektlarini boshqarish hook'i.
 * @param {boolean} enabled - ovoz yoqilganmi (foydalanuvchi sozlamasi)
 */
export function useSound(enabled = true) {
  const cacheRef = useRef(null);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    cacheRef.current = getAudioCache();
  }, []);

  const play = useCallback((soundName) => {
    if (!enabledRef.current) return;
    const cache = cacheRef.current || getAudioCache();
    const audio = cache[soundName];
    if (!audio) return;

    try {
      // Bir necha marta tez-tez chaqirilsa ham (masalan tez yurishlarda)
      // oldingi ovoz to'xtatilib, yangisi boshidan chalinadi.
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Brauzer autoplay siyosati bloklashi mumkin — birinchi user
        // interaction'dan keyin ishlaydi, xato e'tiborsiz qoldiriladi.
      });
    } catch {
      // Silent fail — ovoz muhim emas, o'yin davom etadi.
    }
  }, []);

  /**
   * Yangi o'yin holatiga qarab eng mos ovozni tanlab chaladi.
   * @param {object} params
   * @param {boolean} params.isCapture - oxirgi yurish olish bo'ldimi
   * @param {boolean} params.inCheck - hozir shoh ostida turibdimi
   * @param {boolean} params.isCheckmate - mat bo'ldimi
   */
  const playMoveSound = useCallback(({ isCapture, inCheck, isCheckmate } = {}) => {
    if (isCheckmate) return play('checkmate');
    if (inCheck) return play('check');
    if (isCapture) return play('capture');
    return play('move');
  }, [play]);

  /**
   * O'yin tugaganda natijaga qarab ovoz.
   * @param {string} result - 'white' | 'black' | 'draw'
   * @param {string} myColor - 'white' | 'black' | null (spectator)
   */
  const playGameEndSound = useCallback((result, myColor) => {
    if (result === 'draw') return play('draw');
    if (!myColor) return play('victory'); // spectator uchun neytral
    if (result === myColor) return play('victory');
    return play('defeat');
  }, [play]);

  return { play, playMoveSound, playGameEndSound };
}
