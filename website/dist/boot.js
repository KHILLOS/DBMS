/* Boot script — runs synchronously in <head> (CSP-safe, external file):
   1. Seeds the colour theme before first paint (no wrong-theme flash)
   2. Activates the non-blocking Google Fonts stylesheet once it loads
      (CSP blocks inline onload handlers, so the swap lives here) */
;(function () {
  try {
    var t = localStorage.getItem('med-theme')
    var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light')
  }

  var links = document.querySelectorAll('link[data-fontswap]')
  for (var i = 0; i < links.length; i++) {
    ;(function (l) {
      if (l.sheet) { l.media = 'all'; return }
      l.addEventListener('load', function () { l.media = 'all' }, { once: true })
    })(links[i])
  }
})()
