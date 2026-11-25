// تطبيق المظهر (داكن/فاتح) وتحديث لون شريط المتصفح.

export function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#f1f5fc' : '#070d1c');
  return t;
}
