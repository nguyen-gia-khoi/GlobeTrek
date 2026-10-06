(function csrfGuard() {
  function readToken() {
    const match = document.cookie.match(/(?:^|; )gt_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function sameOrigin(input) {
    try {
      const url = new URL(input, window.location.origin);
      return url.origin === window.location.origin;
    } catch (error) {
      return true;
    }
  }

  document.addEventListener('DOMContentLoaded', function injectForms() {
    const token = readToken();
    document.querySelectorAll('form').forEach(function addField(form) {
      const method = String(form.getAttribute('method') || 'GET').toUpperCase();
      if (method === 'GET' || method === 'HEAD') return;
      if (!form.querySelector('input[name="_csrf"]')) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = '_csrf';
        input.value = token;
        form.appendChild(input);
      }
      const action = form.getAttribute('action') || window.location.pathname;
      const url = new URL(action, window.location.origin);
      if (url.origin !== window.location.origin) return;
      url.searchParams.set('_csrf', token);
      form.setAttribute('action', `${url.pathname}${url.search}`);
    });
  });

  const originalFetch = window.fetch;
  if (!originalFetch) return;
  window.fetch = function guardedFetch(input, init) {
    const options = init ? Object.assign({}, init) : {};
    const method = String(options.method || 'GET').toUpperCase();
    const target = typeof input === 'string' ? input : input.url;
    if (method !== 'GET' && method !== 'HEAD' && sameOrigin(target)) {
      const headers = new Headers(options.headers || {});
      if (!headers.has('Authorization') && !headers.has('x-csrf-token')) {
        headers.set('x-csrf-token', readToken());
      }
      options.headers = headers;
    }
    return originalFetch.call(this, input, options);
  };
}());
