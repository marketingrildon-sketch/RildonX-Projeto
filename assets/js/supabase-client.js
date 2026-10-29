import { createClient } from '@supabase/supabase-js';

const isPlaceholder = function (value) {
  return !value || typeof value !== 'string' || value.includes('SUA_') || value.includes('YOUR_') || value.includes('EXAMPLE');
};

const supabaseUrl = window.SUPABASE_URL;
const supabaseAnonKey = window.SUPABASE_ANON_KEY;

const requestTimeoutMs = 15000;
const storageRequestTimeoutMs = 120000;
const browserFetch = window.fetch.bind(window);
const fetchWithTimeout = function (input, init) {
  const controller = new AbortController();
  const requestOptions = Object.assign({}, init || {}, { signal: controller.signal });
  const originalSignal = init && init.signal;
  const requestUrl = typeof input === 'string' ? input : input && input.url;
  const isStorageRequest = typeof requestUrl === 'string' && requestUrl.indexOf('/storage/v1/') !== -1;
  const timeoutMs = isStorageRequest ? storageRequestTimeoutMs : requestTimeoutMs;
  let timedOut = false;
  const timeoutId = window.setTimeout(function () {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortOriginalRequest = function () {
    controller.abort();
  };

  if (originalSignal) {
    if (originalSignal.aborted) abortOriginalRequest();
    else originalSignal.addEventListener('abort', abortOriginalRequest, { once: true });
  }

  return browserFetch(input, requestOptions).catch(function (error) {
    if (!timedOut) throw error;
    const timeoutError = new Error('O Supabase não respondeu dentro do tempo limite.');
    timeoutError.name = 'TimeoutError';
    throw timeoutError;
  }).finally(function () {
    window.clearTimeout(timeoutId);
    if (originalSignal) originalSignal.removeEventListener('abort', abortOriginalRequest);
  });
};

if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
  console.error('Supabase não configurado. Defina window.SUPABASE_URL e window.SUPABASE_ANON_KEY com valores válidos.');
} else {
  window.supabase = { createClient: createClient };
  if (!window.supabaseClient || typeof window.supabaseClient.from !== 'function') {
    window.supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: fetchWithTimeout }
    });
  }
}
