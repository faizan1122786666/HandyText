import { getAccessToken } from './auth';

// In development, use Vite proxy by default to avoid CORS/network issues.
// You can still override with VITE_API_URL for deployed environments.
export const API_URL = import.meta.env.VITE_API_URL || '/api';

const FALLBACK_API_URLS = (() => {
  if (!API_URL) return [];
  // Relative path (e.g. /api) should be handled by the same-origin proxy only.
  if (!/^https?:\/\//i.test(API_URL)) return [];

  const fallbacks = [];
  if (API_URL.includes('localhost')) {
    fallbacks.push(API_URL.replace('localhost', '127.0.0.1'));
  } else if (API_URL.includes('127.0.0.1')) {
    fallbacks.push(API_URL.replace('127.0.0.1', 'localhost'));
  }
  return fallbacks;
})();

const getHeaders = () => {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

async function parseErrorMessage(response) {
  try {
    const error = await response.json();
    const detail = error.detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => item.msg || String(item)).join(', ');
    }
    if (typeof detail === 'string') {
      return detail;
    }
    return error.message || 'Something went wrong';
  } catch {
    return response.statusText || 'Something went wrong';
  }
}

async function request(endpoint, options = {}) {
  let response;
  const triedUrls = [];
  const candidateUrls = [API_URL, ...FALLBACK_API_URLS];

  for (const baseUrl of candidateUrls) {
    triedUrls.push(baseUrl);
    try {
      response = await fetch(`${baseUrl}${endpoint}`, options);
      break;
    } catch {
      // Try the next fallback URL, if any.
    }
  }

  if (!response) {
    throw new Error(
      `Cannot reach the backend. This is usually because the backend is not running or the browser blocked it (CORS). Tried: ${triedUrls.join(', ')}`
    );
  }

  try {
    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }
  } catch (err) {
    throw err;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  async post(endpoint, data, isMultipart = false) {
    const options = {
      method: 'POST',
      headers: isMultipart ? {} : getHeaders(),
      body: isMultipart ? data : JSON.stringify(data),
    };

    if (isMultipart) {
      const token = getAccessToken();
      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return request(endpoint, options);
  },

  async get(endpoint) {
    return request(endpoint, {
      method: 'GET',
      headers: getHeaders(),
    });
  },

  async delete(endpoint) {
    return request(endpoint, {
      method: 'DELETE',
      headers: getHeaders(),
    });
  },

  async patch(endpoint, data) {
    return request(endpoint, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
  },

  async put(endpoint, data) {
    return request(endpoint, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
  },
};
