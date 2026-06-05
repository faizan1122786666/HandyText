import React, { useState, useRef, useEffect } from 'react';
import { TbSend2 } from "react-icons/tb";
import { 
  ArrowLeft,
  ChevronRight, Sun, Bell, HelpCircle, ChevronDown, CheckCircle2, Settings, Download,
  FileImage, MoreHorizontal, ChevronLeft, ZoomIn, ZoomOut, Maximize, RotateCw, Crop, Wand2, Plus,
  FileText, Undo2, Redo2, RefreshCw, Keyboard, Code, Sparkles, Bold, Italic, Underline, Strikethrough, Highlighter,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, RemoveFormatting, MessageSquare, History, Check, X,
  Globe, FileDown, HardDrive, Scan, SquarePen
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../utils/cn';
import { useToast } from '../context/ToastContext';
import { useNotifications } from '../context/NotificationContext';
import { api, API_URL } from '../utils/api';
import { getAccessToken } from '../utils/auth';
import {
  buildHighlightedHtml,
  buildLocalCorrections,
  mapApiCorrections,
} from '../utils/editorHighlights';

const formatFileSize = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(decimals)} ${units[unitIndex]}`;
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const getExtension = (filename = '') => {
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return filename.slice(dotIndex).toLowerCase();
};

const escapeHtml = (value = '') => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const isLikelyDocumentHeading = (line = '', index = 0) => {
  const value = line.trim();
  if (!value) return false;
  if (index === 0 && value.length <= 80 && !/[.,;]$/.test(value)) return true;
  if (value.endsWith(':') && value.length <= 60) return true;
  return false;
};

const buildEditorHtmlFromPlainText = (text = '', options = {}) => {
  const { autoBoldHeadings = false } = options;
  const rawLines = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n');

  const lines = rawLines.filter((line, index) => {
    if (line.trim()) return true;

    const previous = rawLines[index - 1]?.trim() || '';
    const next = rawLines[index + 1]?.trim() || '';
    if (!previous || !next) return false;

    const previousLooksWrapped = (
      /[-–—]$/.test(previous) ||
      (!/[.!?:;]$/.test(previous) && previous.length > 45)
    );
    const nextContinuesSentence = /^[a-z,(]/.test(next);
    const isWrappedSentence = previousLooksWrapped && nextContinuesSentence;

    return !isWrappedSentence;
  });

  return lines.map((line, index) => {
    if (!line.trim()) return '<div class="ocr-blank-line"><br></div>';
    const leadingSpaces = line.match(/^\s*/)?.[0]?.length || 0;
    const indent = Math.min(leadingSpaces, 24);
    const escaped = escapeHtml(line.trimEnd());
    const style = indent ? ` style="padding-left:${indent * 0.45}em"` : '';
    if (autoBoldHeadings && isLikelyDocumentHeading(line, index)) {
      return `<div${style}><strong>${escaped}</strong></div>`;
    }
    return `<div${style}>${escaped}</div>`;
  }).join('');
};

// Add a helper icon for shortening text
const ShortenIcon = ({ size, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 7h16" /><path d="M4 12h11" /><path d="M4 17h8" />
  </svg>
);

const HELP_TOOLTIP_TEXT = 'HandyText converts handwriting into digital text and digital text into handwriting';

function HelpIconButton() {
  return (
    <div className="relative group">
      <button
        type="button"
        className="hover:text-slate-800 transition-colors"
        aria-describedby="handytext-help-tooltip"
      >
        <HelpCircle size={18} />
      </button>
      <div
        id="handytext-help-tooltip"
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full mt-2 z-[110] w-56 rounded-lg bg-slate-800 px-3 py-2.5 text-[11px] leading-snug font-medium text-white shadow-xl opacity-0 invisible translate-y-0.5 transition-all duration-150 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0"
      >
        {HELP_TOOLTIP_TEXT}
      </div>
    </div>
  );
}

// --- Workspace persistence (keep image + extracted text across page refresh) ---
const WORKSPACE_STORAGE_KEY = 'handytext-workspace';

const loadWorkspace = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY));
    return parsed && Array.isArray(parsed.pages) ? parsed : null;
  } catch {
    return null;
  }
};

// Pick a durable image source for storage: a remote (Cloudinary) URL once the
// page is OCR'd — small and permanent — otherwise the captured data URL.
const durableImage = (page) => {
  const filePath = page?.ocrData?.file_path;
  if (filePath && /^https?:\/\//i.test(filePath)) return filePath;
  return page?.imageData || page?.image || null;
};

// Rebuild a File from a data URL so a restored (not-yet-extracted) image can
// still be sent to the OCR endpoint after a refresh.
const dataUrlToFile = (dataUrl, filename = 'image.png') => {
  const [meta, b64] = String(dataUrl).split(',');
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
};

export function UploadDashboard() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { addNotification, unreadCount, markAllAsRead, notifications, clearNotifications } = useNotifications();
  const [activeTab, setActiveTab] = useState('ai');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activePage, setActivePage] = useState(() => loadWorkspace()?.activePage || 1);
  const [pages, setPages] = useState(() => loadWorkspace()?.pages || []); // Array of { id, image, ocrData }
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState({ code: 'en', label: 'English (Auto)', dir: 'ltr' });

  // Notification Dropdown State
  const [showNotifications, setShowNotifications] = useState(false);

  // Image Viewer State
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Editor State
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const skipHighlightRebuild = useRef(false);
  // Skip the automatic AI-correction fetch on the first sync (initial mount /
  // workspace restore) so a page refresh does not spend a Gemini API call.
  const didInitialSyncRef = useRef(false);
  const [editorText, setEditorText] = useState('');
  const [documentTitle, setDocumentTitle] = useState(() => loadWorkspace()?.documentTitle || 'New Document');
  const [activeSuggestionId, setActiveSuggestionId] = useState(null);

  // Get current page data
  const currentPage = pages[activePage - 1];
  const ocrData = currentPage?.ocrData;
  const uploadedImage = currentPage?.image;
  const conversionId = currentPage?.id;

  // Dropdown States
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showAccuracyMenu, setShowAccuracyMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showPageMenu, setShowPageMenu] = useState(false);

  // AI Suggestions State
  const [suggestions, setSuggestions] = useState([]);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const AI_ACTION_MAP = {
    'Fix Grammar & Punctuation': 'grammar',
    'Improve Writing': 'improve',
    'Shorten Text': 'shorten',
    'Make it Simple': 'simplify',
  };

  const BLOCK_STYLES = [
    { label: 'Original(auto)', tag: 'p' },
    { label: 'Paragraph', tag: 'p' },
  ];

  const [blockStyle, setBlockStyle] = useState('Original(auto)');
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [borderStyle, setBorderStyle] = useState('none');
  const [enhancedImages, setEnhancedImages] = useState({}); // key: pageId, value: enhancedImageUrl
  
  // OCR Settings State
  const [activeSettingsPanel, setActiveSettingsPanel] = useState(null); // 'advanced', 'language', 'handwriting'
  const [ocrSettings, setOcrSettings] = useState({
    handwritingMode: true,
    enhanceImage: true,
    confidenceThreshold: 0.65,
  });
  // Track which pages are currently processing OCR
  const [processingPages, setProcessingPages] = useState(new Set());
  const [replicateApiKey, setReplicateApiKey] = useState(() => localStorage.getItem('replicateApiKey') || '');
  const [enhancingWithApi, setEnhancingWithApi] = useState(false);
  // Crop state
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 });
  const [cropEnd, setCropEnd] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const imageRef = useRef(null);
  
  // Image edit history for undo/redo
  const [imageHistory, setImageHistory] = useState({});
  const [historyIndex, setHistoryIndex] = useState({});
  const MAX_HISTORY = 50;

  const BORDER_STYLES = [
    { label: 'None', value: 'none' },
    { label: 'Slim Dark', value: '1px solid #475569' },
    { label: 'Dark', value: '2px solid #1e293b' },
    { label: 'Slim Blue', value: '1px solid #3461ff' },
    { label: 'Blue', value: '2px solid #3461ff' },
    { label: 'Dashed', value: '2px dashed #64748b' },
  ];

  const closeFormatMenus = () => {
    setShowBlockMenu(false);
  };

  const runEditorCommand = (command, value = null) => {
    if (!editorRef.current || !ocrData || isProcessing) {
      addToast('Upload and extract text before formatting', 'info');
      return false;
    }
    editorRef.current.focus();
    skipHighlightRebuild.current = true;
    const ok = document.execCommand(command, false, value ?? undefined);
    setEditorText(editorRef.current.innerText);
    requestAnimationFrame(() => {
      skipHighlightRebuild.current = false;
    });
    return ok;
  };

  const handleFormat = (command, value = null) => {
    runEditorCommand(command, value);
  };

  const handleBlockStyle = (style) => {
    if (!runEditorCommand('formatBlock', style.tag)) return;
    setBlockStyle(style.label);
    setShowBlockMenu(false);
  };



  const getEditorPlainText = () => editorRef.current?.innerText ?? editorText;

  const syncLanguageFromText = (text) => {
    return text;
  };

  const applyEditorWithHighlights = (text, suggestionList, activeId = null) => {
    const plain = text ?? getEditorPlainText();
    syncLanguageFromText(plain);
    setEditorText(plain);
    if (!editorRef.current) return;

    if (suggestionList?.length) {
      editorRef.current.innerHTML = buildHighlightedHtml(plain, suggestionList, activeId);
    } else {
      editorRef.current.innerHTML = buildEditorHtmlFromPlainText(plain);
    }
  };

  const applyTextToEditor = (text, suggestionList = []) => {
    applyEditorWithHighlights(text, suggestionList, null);
  };

  const resetEditorToOcrText = () => {
    if (!ocrData || isProcessing) {
      addToast('Upload and extract text before resetting', 'info');
      return;
    }

    const originalText = ocrData.extracted_text ?? '';
    if (!editorRef.current) {
      applyTextToEditor(originalText, suggestions);
      return;
    }

    setActiveSuggestionId(null);
    syncLanguageFromText(originalText);
    editorRef.current.focus();
    skipHighlightRebuild.current = true;
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, originalText);
    setEditorText(editorRef.current.innerText);
    requestAnimationFrame(() => {
      applyEditorWithHighlights(originalText, suggestions, null);
      skipHighlightRebuild.current = false;
    });
    addToast('Text restored to original OCR result', 'success');
  };

  const handleEditorPaste = (e) => {
    if (isProcessing) return;

    const pastedText = e.clipboardData?.getData('text/plain') ?? '';
    if (!pastedText) return;

    e.preventDefault();
    editorRef.current?.focus();
    syncLanguageFromText(pastedText);
    document.execCommand('insertText', false, pastedText);

    const nextText = editorRef.current?.innerText ?? pastedText;
    setEditorText(nextText);
    setSuggestions([]);
    setActiveSuggestionId(null);
  };

  const handleDeletePage = async () => {
    if (pages.length === 0) return;
    
    if (confirm('Are you sure you want to delete this page?')) {
      const pageToDelete = pages[activePage - 1];
      
      // Update pages array
      const newPages = pages.filter((_, index) => index !== activePage - 1);
      setPages(newPages);
      
      // Update active page
      if (newPages.length === 0) {
        setActivePage(1);
      } else if (activePage > newPages.length) {
        setActivePage(newPages.length);
      }
      
      // Remove from enhanced images and edit history
      const newEnhancedImages = { ...enhancedImages };
      delete newEnhancedImages[pageToDelete.id];
      setEnhancedImages(newEnhancedImages);

      const newImageHistory = { ...imageHistory };
      delete newImageHistory[pageToDelete.id];
      setImageHistory(newImageHistory);

      const newHistoryIndex = { ...historyIndex };
      delete newHistoryIndex[pageToDelete.id];
      setHistoryIndex(newHistoryIndex);
      
      // Try to delete from backend
      try {
        await api.delete(`/upload/conversion/${pageToDelete.id}`);
      } catch (e) {
        // Page might not be saved to backend yet or user not logged in
        console.log('Could not delete from backend:', e);
      }
      
      addToast('Page deleted successfully!', 'success');
      setShowPageMenu(false);
    }
  };

  const handleEnhanceImage = async () => {
    if (pages.length === 0) {
      addToast('Please upload an image first!', 'info');
      return;
    }

    const currentPage = pages[activePage - 1];
    if (!currentPage) return;

    const viewBeforeEnhance = getViewSnapshot(currentPage.id);

    if (replicateApiKey) {
      try {
        setEnhancingWithApi(true);
        addToast('Enhancing image with AI... This may take a few seconds', 'info');

        // Convert image to base64
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        const base64Promise = new Promise((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = reject;
        });
        
        img.src = enhancedImages[currentPage.id] || currentPage.image;
        const base64Image = await base64Promise;

        // Call Replicate API for image enhancement
        const response = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${replicateApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            version: '9283608cc6b7be6b65a8e44983db0123eb5dcee1bef0ea383b10474833471bcc', // Real-ESRGAN model
            input: {
              image: base64Image,
              scale: 2,
              face_enhance: true,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('API request failed');
        }

        const prediction = await response.json();
        
        // Poll for completion
        let result = prediction;
        while (result.status !== 'succeeded' && result.status !== 'failed') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
            headers: { 'Authorization': `Token ${replicateApiKey}` },
          });
          result = await pollResponse.json();
        }

        if (result.status === 'failed') {
          throw new Error('Image enhancement failed');
        }

        // Get the enhanced image
        const enhancedImageUrl = result.output;
        applyViewWithHistory(currentPage.id, {
          ...viewBeforeEnhance,
          enhancedImage: enhancedImageUrl,
        });

        addToast('Image enhanced successfully with AI!', 'success');
      } catch (error) {
        console.error('Enhancement error:', error);
        addToast('AI enhancement failed, using basic enhancement', 'warning');
        await handleBasicEnhance(currentPage, viewBeforeEnhance);
      } finally {
        setEnhancingWithApi(false);
      }
    } else {
      await handleBasicEnhance(currentPage, viewBeforeEnhance);
    }
  };

  const handleBasicEnhance = async (currentPage, viewBeforeEnhance) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Apply enhancement (brightness and contrast)
        const brightness = 20; // +20 brightness
        const contrast = 30; // +30 contrast
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128 + brightness)); // R
          data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128 + brightness)); // G
          data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128 + brightness)); // B
        }

        ctx.putImageData(imageData, 0, 0);

        // Get enhanced image URL
        const enhancedUrl = canvas.toDataURL('image/png');
        const viewBefore = viewBeforeEnhance ?? getViewSnapshot(currentPage.id);
        applyViewWithHistory(currentPage.id, {
          ...viewBefore,
          enhancedImage: enhancedUrl,
        });

        addToast('Image enhanced successfully!', 'success');
        resolve();
      };
      img.src = enhancedImages[currentPage.id] || currentPage.image;
    });
  };

  // Crop functions
  const handleCropToggle = () => {
    if (pages.length === 0) {
      addToast('Please upload an image first!', 'info');
      return;
    }
    setIsCropping(!isCropping);
    if (isCropping) {
      // Reset crop selection when turning off
      setCropStart({ x: 0, y: 0 });
      setCropEnd({ x: 0, y: 0 });
    }
  };

  const getImageCoordinates = (e) => {
    if (!imageRef.current) return { x: 0, y: 0 };
    
    const rect = imageRef.current.getBoundingClientRect();
    const img = imageRef.current;
    
    // Calculate scale between displayed image and actual image size
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x: Math.max(0, Math.min(x, img.naturalWidth)), y: Math.max(0, Math.min(y, img.naturalHeight)) };
  };

  const handleCropMouseDown = (e) => {
    if (!isCropping) return;
    e.preventDefault();
    
    const coords = getImageCoordinates(e);
    setCropStart(coords);
    setCropEnd(coords);
    setIsDragging(true);
  };

  const handleCropMouseMove = (e) => {
    if (!isCropping || !isDragging) return;
    e.preventDefault();
    
    const coords = getImageCoordinates(e);
    setCropEnd(coords);
  };

  const handleCropMouseUp = () => {
    setIsDragging(false);
  };

  const getViewSnapshot = (pageId) => ({
    enhancedImage: enhancedImages[pageId] ?? null,
    zoom,
    rotation,
  });

  const normalizeSnapshot = (entry, page) => {
    if (typeof entry === 'string') {
      const isOriginal = page && entry === page.image;
      return { enhancedImage: isOriginal ? null : entry, zoom: 1, rotation: 0 };
    }
    return {
      enhancedImage: entry?.enhancedImage ?? null,
      zoom: entry?.zoom ?? 1,
      rotation: entry?.rotation ?? 0,
    };
  };

  const snapshotsEqual = (a, b, page) => {
    const x = normalizeSnapshot(a, page);
    const y = normalizeSnapshot(b, page);
    return (
      x.enhancedImage === y.enhancedImage &&
      x.zoom === y.zoom &&
      x.rotation === y.rotation
    );
  };

  const applyViewSnapshot = (pageId, snapshot) => {
    setEnhancedImages(prev => {
      const next = { ...prev };
      if (snapshot.enhancedImage) {
        next[pageId] = snapshot.enhancedImage;
      } else {
        delete next[pageId];
      }
      return next;
    });
    setZoom(snapshot.zoom);
    setRotation(snapshot.rotation);
  };

  // Record any viewer edit (enhance, crop, zoom, rotate, fit) for undo/redo
  const applyViewWithHistory = (pageId, nextSnapshot) => {
    const currentPage = pages.find(p => p.id === pageId);
    if (!currentPage) return;

    const current = getViewSnapshot(pageId);

    setImageHistory(prev => {
      const history = [...(prev[pageId] || [])];
      const index = historyIndex[pageId] ?? 0;
      const trimmed = history.slice(0, index + 1);

      if (trimmed.length === 0) {
        trimmed.push(current);
      } else if (!snapshotsEqual(trimmed[trimmed.length - 1], current, currentPage)) {
        trimmed.push(current);
      }
      trimmed.push(nextSnapshot);

      while (trimmed.length > MAX_HISTORY) {
        trimmed.shift();
      }

      const newIndex = trimmed.length - 1;
      setHistoryIndex(prevIdx => ({ ...prevIdx, [pageId]: newIndex }));
      return { ...prev, [pageId]: trimmed };
    });

    applyViewSnapshot(pageId, nextSnapshot);
  };

  const getActivePageOrToast = () => {
    if (pages.length === 0) {
      addToast('Please upload an image first!', 'info');
      return null;
    }
    return pages[activePage - 1] ?? null;
  };

  const handleZoomIn = () => {
    const page = getActivePageOrToast();
    if (!page) return;
    const cur = getViewSnapshot(page.id);
    applyViewWithHistory(page.id, { ...cur, zoom: Math.min(2, cur.zoom + 0.1) });
  };

  const handleZoomOut = () => {
    const page = getActivePageOrToast();
    if (!page) return;
    const cur = getViewSnapshot(page.id);
    applyViewWithHistory(page.id, { ...cur, zoom: Math.max(0.5, cur.zoom - 0.1) });
  };

  const handleFit = () => {
    const page = getActivePageOrToast();
    if (!page) return;
    const cur = getViewSnapshot(page.id);
    if (cur.zoom === 1 && cur.rotation === 0) return;
    applyViewWithHistory(page.id, { ...cur, zoom: 1, rotation: 0 });
  };

  const handleRotate = () => {
    const page = getActivePageOrToast();
    if (!page) return;
    const cur = getViewSnapshot(page.id);
    applyViewWithHistory(page.id, { ...cur, rotation: cur.rotation + 90 });
  };

  // Restore zoom/rotation when switching pages
  useEffect(() => {
    const page = pages[activePage - 1];
    if (!page) {
      setZoom(1);
      setRotation(0);
      return;
    }
    const history = imageHistory[page.id];
    if (!history?.length) {
      setZoom(1);
      setRotation(0);
      return;
    }
    const index = historyIndex[page.id] ?? 0;
    const snap = normalizeSnapshot(history[index], page);
    setZoom(snap.zoom);
    setRotation(snap.rotation);
  }, [activePage, pages[activePage - 1]?.id]);

  const canUndoImage = () => {
    const currentPage = pages[activePage - 1];
    if (!currentPage) return false;
    return (historyIndex[currentPage.id] || 0) > 0;
  };

  const canRedoImage = () => {
    const currentPage = pages[activePage - 1];
    if (!currentPage) return false;
    const history = imageHistory[currentPage.id] || [];
    return (historyIndex[currentPage.id] || 0) < history.length - 1;
  };

  // Undo last image edit
  const undoImageEdit = () => {
    if (pages.length === 0) return;
    
    const currentPage = pages[activePage - 1];
    if (!currentPage) return;
    
    const history = imageHistory[currentPage.id] || [];
    const index = historyIndex[currentPage.id] || 0;
    
    if (index <= 0) {
      addToast('Nothing to undo', 'info');
      return;
    }
    
    const newIndex = index - 1;
    const snapshot = normalizeSnapshot(history[newIndex], currentPage);

    applyViewSnapshot(currentPage.id, snapshot);
    setHistoryIndex(prev => ({ ...prev, [currentPage.id]: newIndex }));

    addToast('Undo successful!', 'success');
  };

  // Redo last undone edit
  const redoImageEdit = () => {
    if (pages.length === 0) return;
    
    const currentPage = pages[activePage - 1];
    if (!currentPage) return;
    
    const history = imageHistory[currentPage.id] || [];
    const index = historyIndex[currentPage.id] || 0;
    
    if (index >= history.length - 1) {
      addToast('Nothing to redo', 'info');
      return;
    }
    
    const newIndex = index + 1;
    const snapshot = normalizeSnapshot(history[newIndex], currentPage);

    applyViewSnapshot(currentPage.id, snapshot);
    setHistoryIndex(prev => ({ ...prev, [currentPage.id]: newIndex }));

    addToast('Redo successful!', 'success');
  };

  const applyCrop = () => {
    if (pages.length === 0) return;
    
    const currentPage = pages[activePage - 1];
    if (!currentPage) return;

    const viewBeforeCrop = getViewSnapshot(currentPage.id);
    
    // Calculate crop area
    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);
    
    if (width < 10 || height < 10) {
      addToast('Please select a larger crop area', 'warning');
      return;
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      
      const croppedUrl = canvas.toDataURL('image/png');

      applyViewWithHistory(currentPage.id, {
        ...viewBeforeCrop,
        enhancedImage: croppedUrl,
        zoom: 1,
        rotation: 0,
      });
      
      setIsCropping(false);
      setCropStart({ x: 0, y: 0 });
      setCropEnd({ x: 0, y: 0 });
      
      addToast('Image cropped successfully!', 'success');
    };
    img.src = enhancedImages[currentPage.id] || currentPage.image;
  };

  const fetchAiCorrections = async (conversionId, action = 'proofread') => {
    setLoadingSuggestions(true);
    setShowAllSuggestions(false);
    try {
      const plain = getEditorPlainText();
      const data = await api.post(`/ai/correct/${conversionId}?action=${action}`, { text: plain });
      if (data.message) {
        addToast(data.message, 'info');
      }

      let items = mapApiCorrections(data.corrections, conversionId).filter((item) =>
        plain.includes(item.oldText)
      );

      if (!items.length) {
        const local = buildLocalCorrections(plain);
        items = mapApiCorrections(local, conversionId).filter((item) => plain.includes(item.oldText));
      }

      setSuggestions(items);
      setShowAllSuggestions(false);
      setActiveSuggestionId(null);
      applyEditorWithHighlights(plain, items, null);

      if (items.length > 0) {
        addToast(`${items.length} issue(s) highlighted — Accept or Ignore each`, 'success');
      }
    } catch (err) {
      const message = err?.message || '';
      const plain = getEditorPlainText();
      if (/quota|rate.?limit|\b429\b/i.test(message)) {
        // Gemini free-tier limit reached — fall back to basic local checks
        // instead of surfacing the raw API error.
        const local = mapApiCorrections(buildLocalCorrections(plain), conversionId)
          .filter((item) => plain.includes(item.oldText));
        setSuggestions(local);
        applyEditorWithHighlights(plain, local, null);
        addToast('AI suggestions are temporarily unavailable (quota reached). Showing basic checks.', 'info');
      } else {
        addToast(message || 'Could not load AI suggestions', 'error');
        setSuggestions([]);
        applyEditorWithHighlights(plain, [], null);
      }
      setShowAllSuggestions(false);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleAcceptSuggestion = (suggestion) => {
    const current = getEditorPlainText();
    if (!current.includes(suggestion.oldText)) {
      addToast('Could not find that text in the editor', 'info');
      return;
    }
    const updated = current.replace(suggestion.oldText, suggestion.newText);
    const remaining = suggestions.filter((s) => s.id !== suggestion.id);
    setSuggestions(remaining);
    if (remaining.length <= 3) setShowAllSuggestions(false);
    setActiveSuggestionId(null);
    applyEditorWithHighlights(updated, remaining, null);
    addToast('Correction applied', 'success');
  };

  const handleIgnoreSuggestion = (id) => {
    const remaining = suggestions.filter((s) => s.id !== id);
    setSuggestions(remaining);
    if (remaining.length <= 3) setShowAllSuggestions(false);
    setActiveSuggestionId((prev) => (prev === id ? null : prev));
    applyEditorWithHighlights(getEditorPlainText(), remaining, null);
  };

  // File Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type?.startsWith('image/')) {
      addToast('Invalid file type. Please upload an image file.', 'error');
      e.target.value = '';
      return;
    }

    const ext = getExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      addToast('Unsupported file extension. Use JPG, JPEG, PNG, or WEBP.', 'error');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      addToast(`File is too large (${formatFileSize(file.size)}). Max size is 5 MB.`, 'error');
      e.target.value = '';
      return;
    }

    const uploadLabel = file.name?.trim() || `Document_${new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')}`;
    const previousTitle = documentTitle;
    
    // Create a temporary page ID for now
    const tempId = `temp-${Date.now()}`;
    const initialImage = URL.createObjectURL(file);
    
    // Add page to UI immediately without OCR
    const newPage = {
      id: tempId,
      image: initialImage,
      ocrData: null,
      file: file, // Keep the file object for later processing
    };
    
    const updatedPages = [...pages, newPage];
    setPages(updatedPages);
    setActivePage(updatedPages.length); // Switch to the new page
    
    // Initialize history for new page
    setImageHistory(prev => ({
      ...prev,
      [tempId]: [initialImage],
    }));
    setHistoryIndex(prev => ({ ...prev, [tempId]: 0 }));
    
    setDocumentTitle(uploadLabel);
    addToast('Image uploaded! Click "Extract Text" to run OCR.', 'info');

    // Capture a data URL so the uploaded image persists across a page refresh.
    const reader = new FileReader();
    reader.onload = () => {
      setPages((prev) => prev.map((p) => (p.id === tempId ? { ...p, imageData: reader.result } : p)));
    };
    reader.readAsDataURL(file);

    // Clear the input
    e.target.value = '';
  };
  
  // Manual OCR Extraction Handler
  const handleExtractText = async () => {
    if (pages.length === 0 || activePage < 1) {
      addToast('Please upload an image first!', 'info');
      return;
    }
    
    const currentPage = pages[activePage - 1];
    // After a refresh the original File object is gone; rebuild it from the
    // persisted data URL so a restored image can still be extracted.
    let sourceFile = currentPage.file;
    if (!sourceFile) {
      const durable = currentPage.imageData || currentPage.image;
      if (typeof durable === 'string' && durable.startsWith('data:')) {
        sourceFile = dataUrlToFile(durable, `${documentTitle || 'image'}.png`);
      }
    }
    if (!sourceFile) {
      addToast('Cannot extract text from this image', 'error');
      return;
    }
    
    // Check if already processing
    if (processingPages.has(currentPage.id)) {
      addToast('Already processing this page...', 'info');
      return;
    }
    
    setProcessingPages(prev => new Set([...prev, currentPage.id]));
    setIsProcessing(true);
    addToast(currentPage.ocrData ? 'Re-extracting text from image...' : 'Extracting text from image...', 'info');
    
    try {
      const formData = new FormData();
      formData.append('file', sourceFile);
      formData.append('language', selectedLanguage.code);
      formData.append('enhanceImage', ocrSettings.enhanceImage);
      formData.append('handwritingMode', ocrSettings.handwritingMode);
      formData.append('confidenceThreshold', ocrSettings.confidenceThreshold);
      
      const data = await api.post('/upload/convert', formData, true);
      
      // Update the page with actual OCR data and permanent ID
      const updatedPages = [...pages];
      const pageIndex = activePage - 1;
      const previousId = currentPage.id;
      updatedPages[pageIndex] = {
        ...currentPage,
        id: data.id,
        ocrData: data,
      };
      
      // Update history to use new ID
      setImageHistory(prev => {
        const history = prev[previousId];
        const newHistory = { ...prev };
        delete newHistory[previousId];
        newHistory[data.id] = history;
        return newHistory;
      });
      
      setHistoryIndex(prev => {
        const index = prev[previousId];
        const newIndex = { ...prev };
        delete newIndex[previousId];
        newIndex[data.id] = index;
        return newIndex;
      });
      
      setPages(updatedPages);
      
      const extracted = data.extracted_text || '';
      if (data.edited_html && editorRef.current && /<(strong|b)\b/i.test(data.edited_html)) {
        setEditorText(extracted);
        editorRef.current.innerHTML = data.edited_html;
      } else {
        setEditorText(extracted);
        if (editorRef.current) {
          editorRef.current.innerHTML = buildEditorHtmlFromPlainText(extracted, { autoBoldHeadings: true });
        } else {
          applyTextToEditor(extracted);
        }
      }
      setDocumentTitle(data.original_filename || documentTitle);
      setSuggestions([]);
      setShowAllSuggestions(false);
      setActiveSuggestionId(null);
      addToast(currentPage.ocrData ? 'OCR re-extraction complete!' : 'OCR processing complete!', 'success');

      // Add notification
      addNotification({
        title: 'Text Extracted',
        message: `Successfully processed ${currentPage.file?.name || 'image'}`,
        type: 'upload'
      });

      // Jump straight to the full-page editor showing the freshly extracted,
      // formatted content. The backend has already saved `edited_html` for this
      // conversion, so the editor loads it with the original layout/alignment.
      if (data.id) {
        navigate(`/document/${data.id}/edit`);
      }

    } catch (err) {
      const rawMessage = err?.message || 'OCR extraction failed. Please try again.';
      let friendlyMessage = rawMessage;

      if (/File size exceeds limit/i.test(rawMessage)) {
        friendlyMessage = 'Upload failed: your file is larger than 5 MB.';
      } else if (/File extension .* not allowed/i.test(rawMessage)) {
        friendlyMessage = 'Upload failed: only JPG, JPEG, PNG, and WEBP are supported.';
      } else if (/File must be an image/i.test(rawMessage)) {
        friendlyMessage = 'Upload failed: selected file is not a valid image.';
      } else if (/OCR processing failed/i.test(rawMessage)) {
        friendlyMessage = 'OCR processing failed. Check OCR setup and try again.';
      }

      addToast(friendlyMessage, 'error');
    } finally {
      setIsProcessing(false);
      setProcessingPages(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentPage.id);
        return newSet;
      });
    }
  };

  // AI Actions Handler — full-text improve (keeps line breaks) + refresh correction list
  const handleAIAction = async (actionLabel) => {
    if (!conversionId) {
      addToast('Please upload a document first', 'info');
      return;
    }

    const action = AI_ACTION_MAP[actionLabel] || 'improve';
    addToast(`${actionLabel} in progress...`, 'info');
    setIsProcessing(true);

    try {
      const suggestData = await api.post(`/ai/suggest/${conversionId}?action=${action}`);
      await fetchAiCorrections(conversionId, action === 'grammar' ? 'grammar' : 'proofread');
      if (suggestData.suggestion && !suggestData.suggestion.startsWith('Error')) {
        setAiSuggestion(suggestData.suggestion);
      }
      addToast(`${actionLabel} completed!`, 'success');
    } catch (err) {
      addToast(err?.message || 'AI action failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Save edited text (both plain text and HTML) to backend
  const saveEditedText = async () => {
    if (!conversionId || !editorRef.current) return;
    
    try {
      const text = getEditorPlainText();
      const html = editorRef.current.innerHTML;
      const headers = {
        'Content-Type': 'application/json'
      };
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      
      await fetch(`${API_URL}/export/${conversionId}/save-edited`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ edited_text: text, edited_html: html })
      });
    } catch (err) {
      console.error('Failed to save edited text:', err);
    }
  };

  // Open the full-page (MS Word-like) editor for the current document.
  const handleOpenFullEditor = async () => {
    if (!conversionId || String(conversionId).startsWith('temp-')) {
      addToast('Extract text first, then open the editor', 'info');
      return;
    }
    await saveEditedText(); // persist current inline edits so the editor loads them
    navigate(`/document/${conversionId}/edit`);
  };

  // Export Handler — download file and record name + size in notifications
  const handleExport = async (format) => {
    if (!conversionId) {
      addToast('Please upload a document first', 'info');
      return;
    }

    setShowExportMenu(false);
    addToast(`Exporting as ${format}...`, 'info');

    // First save the edited text
    await saveEditedText();

    const ext = format.toLowerCase();
    const baseName = (ocrData?.original_filename || documentTitle || 'document').replace(/\.[^/.]+$/, '');
    const exportFileName = `${baseName}.${ext}`;

    try {
      const headers = {};
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/export/${conversionId}/${ext}`, { headers });
      if (!response.ok) {
        let detail = 'Export failed';
        try {
          const err = await response.json();
          detail = err.detail || detail;
        } catch {
          detail = response.statusText || detail;
        }
        throw new Error(detail);
      }

      const blob = await response.blob();
      const fileSize = formatFileSize(blob.size);

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = exportFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);

      addNotification({
        title: 'File Exported',
        message: exportFileName,
        fileName: exportFileName,
        fileSize,
        format: format.toUpperCase(),
        type: 'export',
      });
      addToast(`Downloaded ${exportFileName} (${fileSize})`, 'success');
    } catch (err) {
      addToast(err?.message || 'Export failed', 'error');
    }
  };

  // Sync editor when switching pages
  useEffect(() => {
    const text = ocrData?.extracted_text ?? '';
    setSuggestions([]);
    setActiveSuggestionId(null);
    setAiSuggestion('');
    applyTextToEditor(text, []);
    setDocumentTitle(ocrData?.original_filename || 'New Document');
    // Only auto-fetch AI corrections after a real page change/extraction — not
    // on the initial mount (a refresh would otherwise burn the Gemini quota).
    if (ocrData?.id && didInitialSyncRef.current) {
      fetchAiCorrections(ocrData.id, 'proofread');
    }
    didInitialSyncRef.current = true;
  }, [activePage, ocrData?.id]);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('handytext-theme');
  }, []);

  // Persist the workspace so a page refresh keeps the uploaded image(s) and the
  // extracted text instead of clearing everything.
  useEffect(() => {
    const writeSnapshot = (onlyExtracted) => {
      const snapshotPages = (onlyExtracted ? pages.filter((p) => p.ocrData) : pages)
        .map((p) => ({ id: p.id, image: durableImage(p), ocrData: p.ocrData || null }))
        .filter((p) => p.image || p.ocrData);
      localStorage.setItem(
        WORKSPACE_STORAGE_KEY,
        JSON.stringify({ activePage, documentTitle, pages: snapshotPages }),
      );
    };
    try {
      writeSnapshot(false);
    } catch {
      // localStorage quota exceeded (large data URLs): keep only OCR'd pages,
      // which reference small remote image URLs.
      try {
        writeSnapshot(true);
      } catch {
        /* nothing more we can do */
      }
    }
  }, [pages, activePage, documentTitle]);

  // Apply red underlines when the suggestion list changes (not on every hover)
  useEffect(() => {
    if (!editorRef.current || !suggestions.length || isProcessing) return;
    applyEditorWithHighlights(getEditorPlainText(), suggestions, null);
  }, [suggestions, isProcessing]);

  // Highlight active suggestion in editor without rebuilding HTML (keeps bold/colors)
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.querySelectorAll('[data-suggestion-id]').forEach((el) => {
      el.classList.toggle('ocr-error-active', el.dataset.suggestionId === activeSuggestionId);
    });
  }, [activeSuggestionId]);

  // Auto-save when user stops typing
  useEffect(() => {
    if (!conversionId) return;
    
    const timer = setTimeout(() => {
      saveEditedText();
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [editorText, conversionId]);

  // Click highlighted word in editor → select matching suggestion in sidebar
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const onEditorClick = (e) => {
      const mark = e.target.closest?.('[data-suggestion-id]');
      if (mark?.dataset?.suggestionId) {
        setActiveSuggestionId(mark.dataset.suggestionId);
      }
    };

    el.addEventListener('click', onEditorClick);
    return () => el.removeEventListener('click', onEditorClick);
  }, [ocrData?.id, isProcessing]);


  return (
    <div className="flex flex-col min-h-screen xl:h-screen bg-slate-50 overflow-y-auto xl:overflow-hidden w-full font-sans">
      
      {/* Top Header - Consolidated to save vertical space */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col xl:flex-row xl:items-center xl:justify-between shrink-0 gap-4 xl:gap-2">
        
        {/* Top/Left Section: Breadcrumbs + Icons (Mobile) */}
        <div className="flex items-center justify-between w-full xl:w-auto">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/convert')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors shrink-0"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center text-[13px] font-medium text-slate-500 min-w-0">
            <span>Recent Files</span>
            <ChevronRight size={14} className="mx-2 text-slate-300" />
            <span className="text-slate-800 font-bold truncate max-w-[140px] sm:max-w-none">
              {documentTitle}
            </span>
            </div>
          </div>
          
          {/* Icons - Visible on Mobile Only (Top Right) */}
          <div className="flex xl:hidden items-center gap-3 text-slate-500">
            <button className="hover:text-slate-800 transition-colors"><Sun size={18} /></button>
            <div className="relative">
              <button className="hover:text-slate-800 transition-colors"><Bell size={18} /></button>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#3461ff] text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <HelpIconButton />
          </div>
        </div>
        
        {/* Middle controls (English, Accuracy, Settings, Export) - 2 columns on mobile */}
        <div className="grid grid-cols-2 xl:flex items-center xl:items-center justify-center gap-2.5 w-full xl:w-auto px-4 xl:px-0 xl:mx-4 xl:flex-1">
          {/* Language Dropdown */}
          <div className="relative w-full xl:w-auto">
            <button 
              onClick={() => { setShowLangMenu(!showLangMenu); setShowAccuracyMenu(false); setShowSettingsMenu(false); }} 
              className="w-full h-[46px] xl:h-auto flex items-center justify-between xl:justify-start gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-slate-400 flex-shrink-0" />
                <span className="leading-tight text-left">{selectedLanguage.label}</span>
              </div>
              <ChevronDown size={14} className="text-slate-400 ml-0.5 flex-shrink-0" />
            </button>
            {showLangMenu && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 max-h-60 overflow-y-auto">
                {[
                  { code: 'en', label: 'English (Auto)', dir: 'ltr' }
                ].map((lang) => (
                  <button 
                    key={lang.code}
                    onClick={() => {
                      setSelectedLanguage(lang);
                      setShowLangMenu(false);
                      addToast(`Language set to ${lang.label}`, 'info');
                    }} 
                    className={cn(
                      "w-full text-left px-3 py-2 text-[13px] transition-colors",
                      selectedLanguage.code === lang.code ? "bg-blue-50 text-[#3461ff] font-bold" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Accuracy Dropdown */}
          <div className="relative w-full xl:w-auto">
            <button 
              onClick={() => { setShowAccuracyMenu(!showAccuracyMenu); setShowLangMenu(false); setShowSettingsMenu(false); }} 
              className="w-full h-[46px] xl:h-auto flex items-center justify-between xl:justify-start gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", (ocrData?.confidence_score || 0) > 0.7 ? "bg-green-500" : "bg-orange-500")}></div>
                <span className="leading-tight text-left">Accuracy {Math.round((ocrData?.confidence_score || 0) * 100)}%</span>
              </div>
              <ChevronDown size={14} className="text-slate-400 ml-0.5 flex-shrink-0" />
            </button>
            {showAccuracyMenu && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50">
                <div className="px-3 pb-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">Recognition Stats</div>
                <div className="px-3 py-1.5 text-[13px] text-slate-700 flex justify-between items-center">
                  <span className="font-medium">Engine:</span> 
                  <span className="font-bold text-blue-600">{ocrData?.ocr_engine_used || 'N/A'}</span>
                </div>
                <div className="px-3 py-1.5 text-[13px] text-slate-700 flex justify-between items-center">
                  <span className="font-medium">Confidence:</span> 
                  <span className={cn("font-bold px-2 py-0.5 rounded-md text-[11px]", (ocrData?.confidence_score || 0) > 0.7 ? "text-green-600 bg-green-50" : "text-orange-600 bg-orange-50")}>
                    {(ocrData?.confidence_score || 0) > 0.7 ? 'High' : 'Medium'}
                  </span>
                </div>
                <div className="px-3 py-1.5 text-[13px] text-slate-700 flex justify-between items-center">
                  <span className="font-medium">Words:</span> 
                  <span className="font-bold">{ocrData?.word_count || 0}</span>
                </div>
              </div>
            )}
          </div>

          {/* OCR Settings Dropdown */}
          <div className="relative w-full xl:w-auto">
            <button 
              onClick={() => { setShowSettingsMenu(!showSettingsMenu); setShowLangMenu(false); setShowAccuracyMenu(false); }} 
              className="w-full h-[46px] xl:h-auto flex items-center justify-between xl:justify-start gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Settings size={14} className="text-slate-400 flex-shrink-0" />
                <span className="leading-tight text-left">OCR Settings</span>
              </div>
              <ChevronDown size={14} className="text-slate-400 ml-0.5 flex-shrink-0" />
            </button>
            {showSettingsMenu && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                <button onClick={() => { setActiveSettingsPanel('advanced'); setShowSettingsMenu(false); }} className="w-full text-left px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors">Advanced Options</button>
                <button onClick={() => { setActiveSettingsPanel('language'); setShowSettingsMenu(false); }} className="w-full text-left px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors">Language Models</button>
                <button onClick={() => { setActiveSettingsPanel('handwriting'); setShowSettingsMenu(false); }} className="w-full text-left px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors">Handwriting Mode</button>
              </div>
            )}
          </div>
          
          {/* OCR Settings Panels */}
          {activeSettingsPanel && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800">
                    {activeSettingsPanel === 'advanced' && 'Advanced Options'}
                    {activeSettingsPanel === 'language' && 'Language Models'}
                    {activeSettingsPanel === 'handwriting' && 'Handwriting Mode'}
                  </h3>
                  <button onClick={() => setActiveSettingsPanel(null)} className="text-slate-400 hover:text-slate-600">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-4 space-y-4">
                  {/* Handwriting Mode Settings */}
                  {activeSettingsPanel === 'handwriting' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-800">Handwriting Mode</p>
                          <p className="text-xs text-slate-500">Optimized for handwritten text</p>
                        </div>
                        <button 
                          onClick={() => setOcrSettings(prev => ({ ...prev, handwritingMode: !prev.handwritingMode }))}
                          className={`w-10 h-6 rounded-full transition-colors ${ocrSettings.handwritingMode ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${ocrSettings.handwritingMode ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Advanced Options Settings */}
                  {activeSettingsPanel === 'advanced' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-800">Enhance Image</p>
                          <p className="text-xs text-slate-500">Auto-adjust brightness and contrast</p>
                        </div>
                        <button 
                          onClick={() => setOcrSettings(prev => ({ ...prev, enhanceImage: !prev.enhanceImage }))}
                          className={`w-10 h-6 rounded-full transition-colors ${ocrSettings.enhanceImage ? 'bg-blue-600' : 'bg-slate-300'}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${ocrSettings.enhanceImage ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="font-medium text-slate-800">Replicate API Key</p>
                        </div>
                        <p className="text-xs text-slate-500">Get your API key from replicate.com</p>
                        <input 
                          type="password"
                          value={replicateApiKey}
                          onChange={(e) => {
                            setReplicateApiKey(e.target.value);
                            localStorage.setItem('replicateApiKey', e.target.value);
                          }}
                          placeholder="Enter your Replicate API key"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="font-medium text-slate-800">Confidence Threshold</p>
                          <p className="text-sm font-bold text-slate-600">{Math.round(ocrSettings.confidenceThreshold * 100)}%</p>
                        </div>
                        <input 
                          type="range" 
                          min="0.3" 
                          max="0.9" 
                          step="0.05" 
                          value={ocrSettings.confidenceThreshold}
                          onChange={(e) => setOcrSettings(prev => ({ ...prev, confidenceThreshold: parseFloat(e.target.value) }))}
                          className="w-full accent-blue-600"
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Language Models Settings */}
                  {activeSettingsPanel === 'language' && (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-500">Currently using EasyOCR with English support!</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { code: 'en', label: 'English' }
                        ].map(lang => (
                          <button
                            key={lang.code}
                            onClick={() => setSelectedLanguage({ code: lang.code, label: 'English (Auto)', dir: 'ltr' })}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${selectedLanguage.code === lang.code ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                          >
                            {lang.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="px-4 py-3 border-t border-slate-100">
                  <button 
                    onClick={() => setActiveSettingsPanel(null)} 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Export Button */}
          <div className="relative w-full xl:w-auto">
            <div className="flex rounded-lg shadow-sm overflow-hidden w-full h-[46px] xl:h-auto bg-[#2b51d6]">
              <button 
                onClick={() => handleExport('PDF')}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#3461ff] hover:bg-[#2b51d6] text-white px-3 py-1.5 text-[13px] font-semibold transition-all h-full"
              >
                <Download size={14} />
                Export
              </button>
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="flex items-center justify-center bg-[#2b51d6] hover:bg-[#2342b3] text-white px-2.5 py-1.5 border-l border-white/10 transition-all h-full min-w-[38px]"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {/* Export Dropdown */}
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                <button onClick={() => handleExport('PDF')} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors text-left">
                  <FileDown size={14} className="text-slate-400" /> Export as PDF
                </button>
                <button onClick={() => handleExport('DOCX')} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors text-left">
                  <FileText size={14} className="text-slate-400" /> Export as DOCX
                </button>
                <button onClick={() => handleExport('TXT')} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors text-left">
                  <FileText size={14} className="text-slate-400" /> Export as TXT
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right items (Icons) - Desktop Only */}
        <div className="hidden xl:flex items-center gap-4 text-slate-500 xl:w-auto xl:pl-0">
          <div className="flex items-center gap-3 border-r border-slate-200 pr-4">
            <button className="hover:text-slate-800 transition-colors"><Sun size={18} /></button>

            {/* Notifications (Bell Icon) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) markAllAsRead();
                }}
                className="hover:text-slate-800 transition-colors"
              >
                <Bell size={18} />
              </button>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#3461ff] text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {unreadCount}
                </span>
              )}

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-2 border-b border-slate-50 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Notifications</span>
                    {notifications.length > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); clearNotifications(); }}
                        className="text-[10px] text-slate-400 hover:text-red-500 font-bold"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div key={n.id} className="px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                              n.type === 'export' ? "bg-green-50 text-green-500" : "bg-blue-50 text-blue-500"
                            )}>
                              {n.type === 'export' ? <Download size={14} /> : <FileImage size={14} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-bold text-slate-800 truncate">
                                {n.type === 'export' ? (n.fileName || n.message) : n.title}
                              </p>
                              {n.type === 'export' ? (
                                <p className="text-[11px] text-slate-500 leading-tight mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  {n.fileSize && (
                                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                                      <HardDrive size={10} />
                                      {n.fileSize}
                                    </span>
                                  )}
                                  {n.format && (
                                    <span className="text-slate-400 font-medium">· {n.format}</span>
                                  )}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{n.message}</p>
                              )}
                              <p className="text-[9px] text-slate-300 font-bold mt-1.5 uppercase">
                                {n.type === 'export' ? 'Exported · ' : ''}
                                {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 px-4 text-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Bell size={20} className="text-slate-300" />
                        </div>
                        <p className="text-xs text-slate-400 font-medium">No new notifications</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <HelpIconButton />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col xl:flex-row gap-3 sm:gap-4 px-3 sm:px-4 pb-3 sm:pb-4 overflow-y-auto xl:overflow-hidden">
        
        {/* Column 1: Original Image */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-0 xl:min-w-[280px] min-h-[420px] sm:min-h-[500px] xl:min-h-0">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-slate-800">
              <FileImage size={17} className="text-slate-400" />
              Original ({pages.length > 0 ? activePage : 0}/{pages.length})
            </div>
            <div className="relative flex flex-wrap items-center justify-end gap-1">
              {ocrData && !String(conversionId || '').startsWith('temp-') && (
                <button
                  type="button"
                  onClick={handleOpenFullEditor}
                  disabled={isProcessing}
                  title="Open editor mode"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#3461ff]/30 bg-blue-50 text-[#3461ff] transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SquarePen size={15} />
                </button>
              )}
              <button 
                onClick={undoImageEdit}
                disabled={!canUndoImage()}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  canUndoImage()
                    ? "text-slate-600 hover:bg-slate-100"
                    : "text-slate-300 cursor-not-allowed"
                )}
                title="Undo"
              >
                <Undo2 size={14} />
              </button>
              <button 
                onClick={redoImageEdit}
                disabled={!canRedoImage()}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  canRedoImage()
                    ? "text-slate-600 hover:bg-slate-100"
                    : "text-slate-300 cursor-not-allowed"
                )}
                title="Redo"
              >
                <Redo2 size={14} />
              </button>
              <button 
                onClick={() => setShowPageMenu(!showPageMenu)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <MoreHorizontal size={16} />
              </button>
              
              {showPageMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowPageMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-40">
                    <button 
                      onClick={handleDeletePage}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors text-left"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Delete Page
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Image Viewer */}
          <div className="flex-1 bg-slate-100/50 relative flex flex-col items-center justify-center overflow-hidden p-4 group">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*" 
            />
            
            {uploadedImage ? (
              <div 
                className="w-full h-full shadow-md rounded-md relative overflow-hidden border border-slate-200 flex-1 transition-transform duration-300"
                style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                onMouseLeave={handleCropMouseUp}
              >
                <img 
                  ref={imageRef}
                  src={
                    pages[activePage - 1] && enhancedImages[pages[activePage - 1].id] 
                      ? enhancedImages[pages[activePage - 1].id] 
                      : uploadedImage
                  } 
                  alt="Uploaded" 
                  className="w-full h-full object-contain bg-white" 
                  draggable={false}
                />
                
                {/* Crop selection overlay */}
                {isCropping && (
                  <>
                    {/* Dark overlay outside selection */}
                    <div 
                      className="absolute inset-0 bg-black/40"
                      style={{
                        clipPath: `polygon(
                          0 0, 100% 0, 100% 100%, 0 100%,
                          0 0, 
                          ${(Math.min(cropStart.x, cropEnd.x) / (imageRef.current?.naturalWidth || 1)) * 100}% ${(Math.min(cropStart.y, cropEnd.y) / (imageRef.current?.naturalHeight || 1)) * 100}%,
                          ${(Math.min(cropStart.x, cropEnd.x) / (imageRef.current?.naturalWidth || 1)) * 100}% ${(Math.max(cropStart.y, cropEnd.y) / (imageRef.current?.naturalHeight || 1)) * 100}%,
                          ${(Math.max(cropStart.x, cropEnd.x) / (imageRef.current?.naturalWidth || 1)) * 100}% ${(Math.max(cropStart.y, cropEnd.y) / (imageRef.current?.naturalHeight || 1)) * 100}%,
                          ${(Math.max(cropStart.x, cropEnd.x) / (imageRef.current?.naturalWidth || 1)) * 100}% ${(Math.min(cropStart.y, cropEnd.y) / (imageRef.current?.naturalHeight || 1)) * 100}%,
                          ${(Math.min(cropStart.x, cropEnd.x) / (imageRef.current?.naturalWidth || 1)) * 100}% ${(Math.min(cropStart.y, cropEnd.y) / (imageRef.current?.naturalHeight || 1)) * 100}%
                        )`
                      }}
                    />
                    
                    {/* Selection border */}
                    <div 
                      className="absolute border-2 border-[#3461ff] bg-transparent pointer-events-none"
                      style={{
                        left: `${(Math.min(cropStart.x, cropEnd.x) / (imageRef.current?.naturalWidth || 1)) * 100}%`,
                        top: `${(Math.min(cropStart.y, cropEnd.y) / (imageRef.current?.naturalHeight || 1)) * 100}%`,
                        width: `${(Math.abs(cropEnd.x - cropStart.x) / (imageRef.current?.naturalWidth || 1)) * 100}%`,
                        height: `${(Math.abs(cropEnd.y - cropStart.y) / (imageRef.current?.naturalHeight || 1)) * 100}%`
                      }}
                    >
                      {/* Corner handles */}
                      <div className="absolute -top-1 -left-1 w-3 h-3 bg-[#3461ff] rounded-full" />
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#3461ff] rounded-full" />
                      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-[#3461ff] rounded-full" />
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#3461ff] rounded-full" />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl bg-white hover:bg-blue-50 hover:border-[#3461ff] transition-all cursor-pointer p-8 text-center"
              >
                <div className="w-16 h-16 bg-blue-50 text-[#3461ff] rounded-full flex items-center justify-center mb-4">
                  <Plus size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">Upload Handwriting</h3>
                <p className="text-sm text-slate-500 max-w-[200px]">Click or drag and drop your handwritten notes here</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">JPG</span>
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">PNG</span>
                  <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">WEBP</span>
                </div>
              </div>
            )}
            
            {/* Crop buttons */}
            {isCropping && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-10">
                <button 
                  onClick={applyCrop}
                  className="px-4 py-2 bg-[#3461ff] text-white rounded-lg font-semibold text-sm hover:bg-[#2b51d6] transition-colors shadow-lg"
                >
                  Apply Crop
                </button>
                <button 
                  onClick={() => {
                    setIsCropping(false);
                    setCropStart({ x: 0, y: 0 });
                    setCropEnd({ x: 0, y: 0 });
                  }}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg font-semibold text-sm hover:bg-slate-700 transition-colors shadow-lg"
                >
                  Cancel
                </button>
              </div>
            )}
            
            {/* Nav arrows (only if multiple pages) */}
            {pages.length > 1 && !isCropping && (
              <>
                <button 
                  onClick={() => setActivePage(Math.max(1, activePage - 1))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/90 shadow-md rounded-full flex items-center justify-center text-slate-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={() => setActivePage(Math.min(pages.length, activePage + 1))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/90 shadow-md rounded-full flex items-center justify-center text-slate-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>
          
          {/* Image Toolbar */}
          <div className="flex items-center justify-center gap-6 py-2.5 border-t border-slate-100 shrink-0 bg-white">
            <button onClick={handleZoomIn} className="flex flex-col items-center gap-1 text-slate-500 hover:text-[#3461ff] transition-colors">
              <ZoomIn size={16} />
              <span className="text-[9px] font-bold">Zoom In</span>
            </button>
            <button onClick={handleZoomOut} className="flex flex-col items-center gap-1 text-slate-500 hover:text-[#3461ff] transition-colors">
              <ZoomOut size={16} />
              <span className="text-[9px] font-bold">Zoom Out</span>
            </button>
            <button onClick={handleFit} className="flex flex-col items-center gap-1 text-slate-500 hover:text-[#3461ff] transition-colors">
              <Maximize size={16} />
              <span className="text-[9px] font-bold">Fit</span>
            </button>
            <button onClick={handleRotate} className="flex flex-col items-center gap-1 text-slate-500 hover:text-[#3461ff] transition-colors">
              <RotateCw size={16} />
              <span className="text-[9px] font-bold">Rotate</span>
            </button>

            <button 
              onClick={handleCropToggle}
              className={`flex flex-col items-center gap-1 transition-colors ${isCropping ? 'text-[#3461ff]' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Crop size={16} />
              <span className="text-[9px] font-bold">Crop</span>
            </button>
            <button 
              onClick={handleEnhanceImage} 
              disabled={enhancingWithApi}
              className="flex flex-col items-center gap-1 text-slate-500 hover:text-[#3461ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enhancingWithApi ? (
                <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Wand2 size={16} />
              )}
              <span className="text-[9px] font-bold">Enhance</span>
            </button>

          </div>
          
          {/* Thumbnails */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 sm:p-3 border-t border-slate-100 shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-1 overflow-x-auto min-w-0 flex-1">
              {pages.map((page, index) => (
              <div 
                key={page.id} 
                onClick={() => setActivePage(index + 1)}
                className={cn(
                  "relative w-12 h-16 rounded-md border-2 flex-shrink-0 cursor-pointer overflow-hidden bg-white flex flex-col transition-colors",
                  activePage === index + 1 ? "border-[#3461ff]" : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="flex-1 bg-white m-1 rounded-sm border border-slate-100 flex flex-col items-center justify-center overflow-hidden">
                   <img src={page.image} alt={`Page ${index + 1}`} className="w-full h-full object-cover opacity-80" />
                </div>
                <div className="h-4 bg-white flex items-center justify-center text-[9px] font-bold text-slate-500 border-t border-slate-100">
                  {index + 1}
                </div>
              </div>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0 justify-end sm:justify-start">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="h-10 w-full sm:w-12 sm:h-16 rounded-md border-2 border-dashed border-slate-300 flex flex-row sm:flex-col items-center justify-center gap-1 text-slate-400 hover:text-[#3461ff] hover:border-[#3461ff] hover:bg-blue-50 transition-colors flex-shrink-0"
              >
                <Plus size={14} />
                <span className="text-[8px] font-bold">Add</span>
              </button>
              <button
                type="button"
                onClick={handleExtractText}
                disabled={!currentPage || Boolean(currentPage.ocrData) || processingPages.has(currentPage.id)}
                title="Extract text from current page"
                className="group h-10 w-12 sm:w-9 sm:h-16 rounded-md flex items-center justify-center text-slate-400 bg-transparent hover:bg-blue-50 hover:text-[#3461ff] transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
              >
                {processingPages.has(currentPage?.id) ? (
                  <div className="w-5 h-5 border-2 border-[#3461ff] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center transition-colors group-hover:bg-[#3461ff] group-hover:text-white">
                    <TbSend2 className="text-[22px] transition-transform group-hover:scale-110" />
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {false && (
        <>
        {/* Column 2: Extracted Text */}
        <div className="flex-[1.2] flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-0 xl:min-w-[300px] relative min-h-[500px] xl:min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2 text-[13px] font-bold text-slate-800">
              <FileText size={16} className="text-slate-400" />
              Extracted Text
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                title="Open full editor (edit like MS Word)"
                onClick={handleOpenFullEditor}
                disabled={!ocrData || isProcessing}
                className="inline-flex h-8 w-8 items-center justify-center text-[#3461ff] bg-blue-50 hover:bg-blue-100 border border-[#3461ff]/30 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <SquarePen size={15} />
              </button>
              <div className="h-4 w-px bg-slate-200 mx-0.5"></div>
              <button onClick={() => handleFormat('undo')} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors">
                <Undo2 size={14} />
              </button>
              <button onClick={() => handleFormat('redo')} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors">
                <Redo2 size={14} />
              </button>
              <button
                type="button"
                title="Restore original OCR text"
                onClick={resetEditorToOcrText}
                disabled={!ocrData || isProcessing}
                className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RefreshCw size={14} />
              </button>
              <div className="h-4 w-px bg-slate-200 mx-0.5"></div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowBlockMenu(!showBlockMenu);
                    setShowExportMenu(false);
                    setShowLangMenu(false);
                    setShowHighlightMenu(false);
                    setShowTextColorMenu(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 text-[13px] font-semibold border rounded-md transition-colors",
                    showBlockMenu
                      ? "text-[#3461ff] bg-blue-50 border-[#3461ff]/30"
                      : "text-slate-600 hover:bg-slate-50 border-slate-200"
                  )}
                >
                  {blockStyle}
                  <ChevronDown size={12} className={cn("text-slate-400 transition-transform", showBlockMenu && "rotate-180")} />
                </button>
                {showBlockMenu && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowBlockMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-40">
                      {BLOCK_STYLES.map((style) => (
                        <button
                          key={style.tag}
                          type="button"
                          onClick={() => handleBlockStyle(style)}
                          className={cn(
                            "w-full text-left px-3 py-2 text-[13px] transition-colors",
                            blockStyle === style.label
                              ? "bg-blue-50 text-[#3461ff] font-bold"
                              : "text-slate-700 hover:bg-slate-50 font-medium"
                          )}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Text Editor Area — keep contentEditable empty; React must not manage its children */}
          <div 
            className="relative flex-1 min-h-0"
            style={{ border: borderStyle !== 'none' ? borderStyle : undefined }}
          >
            <div
              ref={editorRef}
              dir={selectedLanguage.dir}
              className={cn(
                "absolute inset-0 p-6 overflow-y-auto leading-[1.25] text-slate-800 outline-none whitespace-pre-wrap break-words",
                "font-sans text-[13px]",
                "[&_div]:min-h-[1.05em] [&_div]:mb-0 [&_.ocr-blank-line]:min-h-[0.25em]",
                isProcessing && "pointer-events-none text-transparent"
              )}
              contentEditable={!isProcessing}
              suppressContentEditableWarning
              onInput={(e) => {
                if (skipHighlightRebuild.current) return;
                const nextText = e.currentTarget.innerText;
                syncLanguageFromText(nextText);
                setEditorText(nextText);
              }}
              onPaste={handleEditorPaste}
            />

            {!ocrData && !isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 px-6 pointer-events-auto">
                <div className="text-center max-w-md">
                  <FileText size={48} className="mx-auto mb-4 opacity-30" />
                  
                  {pages.length > 0 && !pages[activePage - 1]?.ocrData && (
                    <p className="text-sm text-slate-400">
                      Click Extract in the page strip to run OCR for this image.
                    </p>
                  )}
                  
                  {pages.length === 0 && (
                    <p className="text-sm text-slate-400">
                      Upload an image first using the button on the left!
                    </p>
                  )}
                </div>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-white/80 z-10">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium">Processing handwriting...</p>
              </div>
            )}

            {ocrData && !isProcessing && !editorText.trim() && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 pointer-events-none">
                <FileText size={48} className="mb-4 opacity-20" />
                <p className="text-sm font-medium">No text was detected in this image</p>
                <p className="text-xs mt-2 text-slate-300">Try a clearer photo or use crop and rotate.</p>
              </div>
            )}
          </div>
          
          {/* AI Suggestion Display (Overlay if exists) */}
          {aiSuggestion && (
            <div className="absolute bottom-16 left-4 right-4 bg-blue-50 border border-blue-100 rounded-xl p-4 shadow-lg animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-wider">
                  <Sparkles size={14} />
                  AI Improved Version
                </div>
                <button onClick={() => setAiSuggestion('')} className="text-blue-400 hover:text-blue-600 transition-colors">
                  <X size={14} />
                </button>
              </div>
              <p className="text-sm text-slate-700 mb-3 whitespace-pre-wrap">{aiSuggestion}</p>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    if (editorRef.current) editorRef.current.innerText = aiSuggestion;
                    setEditorText(aiSuggestion);
                    setAiSuggestion('');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Check size={14} />
                  Apply Suggestion
                </button>
                <button 
                  onClick={() => setAiSuggestion('')}
                  className="bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          
          {/* Formatting Toolbar */}
          <div className="bg-white rounded-xl shadow-[0_2px_15px_rgb(0,0,0,0.06)] border border-slate-100 px-2 py-1.5 flex items-center gap-1 z-10 w-max max-w-[95%] overflow-x-auto mx-auto mb-3">
            <button
              type="button"
              title="Scan for grammar and spelling"
              onClick={() => conversionId && fetchAiCorrections(conversionId, 'grammar')}
              disabled={!ocrData || isProcessing}
              className="p-1.5 text-[#3461ff] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors shrink-0 disabled:opacity-40"
            >
              <Sparkles size={16} />
            </button>
            <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />
            <button type="button" title="Bold" onClick={() => handleFormat('bold')} className="p-1.5 text-slate-700 font-bold hover:bg-slate-100 rounded-md transition-colors shrink-0 text-[13px]">B</button>
            <button type="button" title="Italic" onClick={() => handleFormat('italic')} className="p-1.5 text-slate-700 italic font-serif hover:bg-slate-100 rounded-md transition-colors shrink-0 text-[13px]">I</button>
            <button type="button" title="Underline" onClick={() => handleFormat('underline')} className="p-1.5 text-slate-700 underline hover:bg-slate-100 rounded-md transition-colors shrink-0 text-[13px]">U</button>
            <button type="button" title="Strikethrough" onClick={() => handleFormat('strikeThrough')} className="p-1.5 text-slate-700 line-through hover:bg-slate-100 rounded-md transition-colors shrink-0 text-[13px]">S</button>
            <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />
            
            {/* Highlight selected text */}
            <button 
              type="button" 
              title="Highlight selected text (yellow)"
              onClick={() => {
                // Apply yellow highlight
                document.execCommand('hiliteColor', false, '#fef08a');
                if (editorRef.current) {
                  setEditorText(editorRef.current.innerText);
                }
              }}
              className="p-1.5 text-yellow-600 hover:bg-yellow-100 rounded-md transition-colors shrink-0"
            >
              <Highlighter size={16} />
            </button>

            <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />
            <button type="button" title="Align left" onClick={() => handleFormat('justifyLeft')} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors shrink-0"><AlignLeft size={16} /></button>
            <button type="button" title="Align center" onClick={() => handleFormat('justifyCenter')} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors shrink-0"><AlignCenter size={16} /></button>
            <button type="button" title="Align right" onClick={() => handleFormat('justifyRight')} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors shrink-0"><AlignRight size={16} /></button>
            <button type="button" title="Justify" onClick={() => handleFormat('justifyFull')} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors shrink-0"><AlignJustify size={16} /></button>
            <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />
            <button type="button" title="Bullet list" onClick={() => handleFormat('insertUnorderedList')} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors shrink-0"><List size={16} /></button>
            <button type="button" title="Numbered list" onClick={() => handleFormat('insertOrderedList')} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors shrink-0"><ListOrdered size={16} /></button>
            <button type="button" title="Clear formatting" onClick={() => handleFormat('removeFormat')} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors shrink-0"><RemoveFormatting size={16} /></button>
            <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />
            {/* Border Style */}
            <div className="shrink-0">
              <button
                type="button"
                title="Cycle page borders"
                onClick={() => {
                  // Find the index of current border style
                  const currentIndex = BORDER_STYLES.findIndex(s => s.value === borderStyle);
                  // Cycle to next index
                  const nextIndex = (currentIndex + 1) % BORDER_STYLES.length;
                  setBorderStyle(BORDER_STYLES[nextIndex].value);
                }}
                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              </button>
            </div>
          </div>

          {/* Editor Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 shrink-0 text-[10px] font-bold text-slate-400 bg-white relative z-0">
            <div>{ocrData?.word_count || 0} Words &nbsp;&nbsp;&nbsp; {ocrData?.char_count || 0} Characters</div>
            <div className="flex items-center gap-3">
              <button className="hover:text-slate-600 transition-colors"><Keyboard size={14} /></button>
              <button className="hover:text-slate-600 transition-colors"><Code size={14} /></button>
            </div>
          </div>
        </div>

        {/* Column 3: AI Sidebar */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-0 xl:min-w-[280px] xl:max-w-[320px] min-h-[400px] xl:min-h-0">
          {/* Tabs */}
          <div className="flex items-center border-b border-slate-100 shrink-0 px-1 pt-1 bg-slate-50/50">
            {[
              { id: 'ai', label: 'AI', icon: Sparkles }
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1.5 py-2.5 text-[10px] font-bold transition-colors relative",
                    isActive ? "text-[#3461ff]" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  <Icon size={16} className={isActive ? "text-[#3461ff]" : "text-slate-400"} />
                  {tab.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3461ff] rounded-t-full"></div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'ai' ? (
              <>
                {/* AI Suggestions */}
                {loadingSuggestions ? (
                  <div className="mb-6 p-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50">
                    <div className="w-6 h-6 border-2 border-[#3461ff] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-[12px] text-slate-600 font-medium">Checking for OCR mistakes...</p>
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[13px] font-bold text-slate-800">AI Suggestions</h3>
                      <span className="px-2 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                        {showAllSuggestions ? suggestions.length : Math.min(3, suggestions.length)} / {suggestions.length}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-2.5 mb-4">
                      {(showAllSuggestions ? suggestions : suggestions.slice(0, 3)).map(suggestion => (
                        <div
                          key={suggestion.id}
                          role="button"
                          tabIndex={0}
                          onMouseEnter={() => setActiveSuggestionId(suggestion.id)}
                          onFocus={() => setActiveSuggestionId(suggestion.id)}
                          className={cn(
                            "p-3 rounded-lg border shadow-sm bg-white transition-all hover:shadow-md cursor-pointer",
                            activeSuggestionId === suggestion.id
                              ? "border-red-300 ring-1 ring-red-200"
                              : "border-slate-100 hover:border-[#3461ff]/30"
                          )}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${suggestion.color} mt-1.5 flex-shrink-0`}></div>
                            <div className="min-w-0 space-y-1">
                              <p className="text-[12px] leading-snug text-red-600 line-through break-words bg-red-50/70 px-2 py-1 rounded-md">
                                {suggestion.oldText}
                              </p>
                              <p className="text-[12px] leading-snug text-emerald-700 font-semibold break-words bg-emerald-50/80 px-2 py-1 rounded-md">
                                {suggestion.newText}
                              </p>
                              {suggestion.reason && (
                                <p className="text-[11px] leading-snug text-slate-500 mt-1">{suggestion.reason}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-3.5">
                            <button 
                              onClick={() => handleAcceptSuggestion(suggestion)}
                              className="bg-[#3461ff] hover:bg-[#2b51d6] text-white text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors"
                            >
                              Accept
                            </button>
                            <button 
                              onClick={() => handleIgnoreSuggestion(suggestion.id)}
                              className="text-slate-500 hover:text-slate-700 hover:bg-slate-50 text-[10px] font-bold px-3 py-1.5 rounded-md transition-colors"
                            >
                              Ignore
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {!showAllSuggestions && suggestions.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowAllSuggestions(true)}
                        className="w-full mb-2 py-2 text-[11px] font-bold text-white bg-[#3461ff] hover:bg-[#2b51d6] rounded-lg transition-colors"
                      >
                        Scan all suggestions ({suggestions.length - 3} more)
                      </button>
                    )}

                    {conversionId && (
                      <button
                        type="button"
                        onClick={() => fetchAiCorrections(conversionId, 'proofread')}
                        className="w-full py-2 text-[11px] font-bold text-[#3461ff] hover:bg-blue-50/50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                      >
                        Scan again for mistakes
                      </button>
                    )}
                  </div>
                ) : ocrData ? (
                  <div className="mb-6 p-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50">
                    <CheckCircle2 size={24} className="text-green-500 mx-auto mb-2" />
                    <p className="text-[12px] text-slate-600 font-medium">No issues found</p>
                    <p className="text-[11px] text-slate-400 mt-1">Use &quot;Fix Grammar &amp; Punctuation&quot; below to scan again</p>
                  </div>
                ) : (
                  <div className="mb-6 p-4 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50">
                    <Sparkles size={24} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-[12px] text-slate-500 font-medium">Upload a document to get AI suggestions</p>
                  </div>
                )}

                {/* AI Actions */}
                <div>
                  <h3 className="text-[13px] font-bold text-slate-800 mb-3">AI Actions</h3>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: 'Fix Grammar & Punctuation', icon: CheckCircle2, color: 'text-purple-500', bg: 'bg-purple-50' },
                      { label: 'Improve Writing', icon: Sparkles, color: 'text-[#3461ff]', bg: 'bg-blue-50' },
                      { label: 'Shorten Text', icon: ShortenIcon, color: 'text-green-500', bg: 'bg-green-50' },
                      { label: 'Make it Simple', icon: FileText, color: 'text-orange-500', bg: 'bg-orange-50' }
                    ].map((action, i) => {
                      const Icon = action.icon;
                      return (
                        <button 
                          key={i} 
                          onClick={() => handleAIAction(action.label)}
                          disabled={isProcessing}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-lg border border-slate-100 shadow-sm bg-white hover:border-slate-300 hover:shadow-md transition-all group",
                            isProcessing && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn("p-1.5 rounded-md", action.bg)}>
                              <Icon size={14} className={action.color} />
                            </div>
                            <span className="text-[12px] font-bold text-slate-700 group-hover:text-slate-900">{action.label}</span>
                          </div>
                          <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <p className="text-xs font-medium">No {activeTab} yet.</p>
              </div>
            )}
          </div>
        </div>
        </>
        )}

      </div>
    </div>
  );
}
