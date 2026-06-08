export const LOCAL_CONVERSION_HISTORY_KEY = 'handytext-local-conversion-history';

const MAX_HISTORY_ITEMS = 25;

export const loadLocalConversionHistory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_CONVERSION_HISTORY_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveLocalConversionHistory = (items) => {
  localStorage.setItem(
    LOCAL_CONVERSION_HISTORY_KEY,
    JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)),
  );
};

export const upsertLocalConversionHistoryItem = (conversion, updates = {}) => {
  if (!conversion?.id) return null;

  const now = new Date().toISOString();
  const existing = loadLocalConversionHistory();
  const previous = existing.find((item) => String(item.id) === String(conversion.id));
  const entry = {
    id: conversion.id,
    type: 'ocr',
    user_id: conversion.user_id || null,
    original_filename: conversion.original_filename || 'document',
    file_path: conversion.file_path || '',
    extracted_text: conversion.extracted_text || '',
    edited_text: conversion.edited_text || null,
    edited_html: conversion.edited_html || null,
    page_border: conversion.page_border ?? true,
    page_border_style: conversion.page_border_style || 'solid',
    word_count: conversion.word_count || 0,
    char_count: conversion.char_count || 0,
    confidence_score: conversion.confidence_score || 0,
    ocr_engine_used: conversion.ocr_engine_used || null,
    created_at: conversion.created_at || previous?.created_at || now,
    status: conversion.status || 'completed',
    ...previous,
    ...conversion,
    ...updates,
    updated_at: now,
  };

  const next = [
    entry,
    ...existing.filter((item) => String(item.id) !== String(conversion.id)),
  ];
  saveLocalConversionHistory(next);
  return entry;
};

export const deleteLocalConversionHistoryItem = (id) => {
  saveLocalConversionHistory(
    loadLocalConversionHistory().filter((item) => String(item.id) !== String(id)),
  );
};

export const renameLocalConversionHistoryItem = (id, name) => {
  const next = loadLocalConversionHistory().map((item) => (
    String(item.id) === String(id)
      ? { ...item, original_filename: name, updated_at: new Date().toISOString() }
      : item
  ));
  saveLocalConversionHistory(next);
};
