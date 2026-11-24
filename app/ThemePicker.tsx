'use client';

import { useEffect, useSyncExternalStore } from 'react';

const themes = [
  ['system', 'Automático (sistema)'],
  ['light', 'Claro'],
  ['dark', 'Escuro'],
  ['rose', 'Rosé'],
  ['ocean', 'Oceano'],
  ['lavender', 'Lavanda'],
  ['midnight', 'Meia-noite'],
] as const;

let fallbackTheme = 'system';
function readTheme() {
  let saved = fallbackTheme;
  try {
    saved = localStorage.getItem('quero-theme') || fallbackTheme;
  } catch {}
  return themes.some(([id]) => id === saved) ? saved : 'system';
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('quero-theme-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('quero-theme-change', callback);
  };
}

export default function ThemePicker() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system');
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const selected = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = selected;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return (
    <label className="theme-picker">
      <span>Aparência</span>
      <select
        aria-label="Tema do site"
        value={theme}
        onChange={(event) => {
          fallbackTheme = event.target.value;
          try {
            localStorage.setItem('quero-theme', event.target.value);
          } catch {}
          window.dispatchEvent(new Event('quero-theme-change'));
        }}
      >
        {themes.map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
