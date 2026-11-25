/* يُحمَّل قبل الرسم: يطبّق المظهر المحفوظ فورًا لتجنب وميض الألوان. لا يعتمد على أي وحدة. */
(function () {
  try {
    var theme = 'dark';
    var raw = localStorage.getItem('studentos.v1');
    if (raw) {
      var s = JSON.parse(raw);
      if (s && s.settings && s.settings.theme === 'light') theme = 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', theme === 'light' ? '#f1f5fc' : '#070d1c');
  } catch (e) { /* التخزين غير متاح — يبقى المظهر الداكن */ }
})();
