export const HANDWRITING_HISTORY_KEY = 'handytext-handwriting-history';

const MAX_HISTORY_ITEMS = 25;

export const loadHandwritingHistory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(HANDWRITING_HISTORY_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveHandwritingHistory = (items) => {
  localStorage.setItem(HANDWRITING_HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
};

export const addHandwritingHistoryItem = (item) => {
  const createdAt = new Date().toISOString();
  const entry = {
    id: `handwriting-${Date.now()}`,
    type: 'handwriting',
    original_filename: item.name || 'handwriting.png',
    text: item.text || '',
    word_count: item.wordCount || 0,
    status: 'completed',
    created_at: createdAt,
    updated_at: createdAt,
    page_type: item.pageType || 'a4',
    font: item.font || '',
    font_size: item.fontSize || 0,
    ink_color: item.inkColor || '',
    png_data_url: item.pngDataUrl || null,
    pdf_data_url: item.pdfDataUrl || null,
    downloaded_formats: item.downloadedFormats || [],
  };

  const next = [entry, ...loadHandwritingHistory()];
  saveHandwritingHistory(next);
  return entry;
};

export const updateHandwritingHistoryItem = (id, updates) => {
  const next = loadHandwritingHistory().map((item) => (
    item.id === id ? { ...item, ...updates, updated_at: new Date().toISOString() } : item
  ));
  saveHandwritingHistory(next);
};

export const deleteHandwritingHistoryItem = (id) => {
  saveHandwritingHistory(loadHandwritingHistory().filter((item) => item.id !== id));
};

export const renameHandwritingHistoryItem = (id, name) => {
  updateHandwritingHistoryItem(id, { original_filename: name });
};
