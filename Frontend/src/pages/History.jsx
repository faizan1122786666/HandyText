import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, Trash2, FileText, Calendar, HardDrive, MoreVertical, Filter, ArrowUpDown, ChevronLeft, ChevronRight, CheckCircle2, Pencil, X, PenLine, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../context/ToastContext';
import { api, API_URL } from '../utils/api';
import { getAccessToken } from '../utils/auth';
import {
  deleteHandwritingHistoryItem,
  loadHandwritingHistory,
  renameHandwritingHistoryItem,
} from '../utils/handwritingHistory';
import {
  deleteLocalConversionHistoryItem,
  loadLocalConversionHistory,
  renameLocalConversionHistoryItem,
} from '../utils/localConversionHistory';

const mergeHistory = (remoteItems = []) => {
  const byId = new Map();
  [...loadLocalConversionHistory(), ...remoteItems, ...loadHandwritingHistory()].forEach((item) => {
    if (item?.id) byId.set(String(item.id), item);
  });
  return Array.from(byId.values());
};

export function History() {
  const { addToast } = useToast();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await api.get('/upload/history');
      setHistory(mergeHistory(data));
    } catch (err) {
      setHistory(mergeHistory());
      addToast('Failed to fetch upload history: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'date' or 'name'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const itemsPerPage = 8;

  const filteredHistory = useMemo(() => {
    return history
      .filter(item => (item.original_filename || '').toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'name') {
          return sortOrder === 'asc' 
            ? a.original_filename.localeCompare(b.original_filename) 
            : b.original_filename.localeCompare(a.original_filename);
        } else {
          return sortOrder === 'asc' 
            ? new Date(a.created_at) - new Date(b.created_at) 
            : new Date(b.created_at) - new Date(a.created_at);
        }
      });
  }, [history, searchQuery, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(start, start + itemsPerPage);
  }, [filteredHistory, currentPage]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this document from history?')) {
      try {
        const item = history.find((entry) => entry.id === id);
        if (item?.type === 'handwriting') {
          deleteHandwritingHistoryItem(id);
        } else if (item?.type === 'ocr') {
          deleteLocalConversionHistoryItem(id);
        } else {
          await api.delete(`/upload/conversion/${id}`);
          deleteLocalConversionHistoryItem(id);
        }
        setHistory(history.filter(item => item.id !== id));
        addToast('Document deleted successfully', 'success');
        if (paginatedHistory.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        }
      } catch (err) {
        addToast('Failed to delete: ' + err.message, 'error');
      }
    }
  };

  const downloadDataUrl = (dataUrl, filename) => {
    if (!dataUrl) {
      addToast('This file is not available. Generate or download it again first.', 'info');
      return;
    }
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownload = async (item, format) => {
    addToast(`Exporting as ${format}...`, 'info');
    if (item.type === 'handwriting') {
      const ext = format.toLowerCase();
      downloadDataUrl(
        ext === 'pdf' ? item.pdf_data_url : item.png_data_url,
        item.original_filename?.replace(/\.(png|pdf)$/i, `.${ext}`) || `handwriting.${ext}`
      );
      return;
    }

    try {
      const ext = format.toLowerCase();
      const headers = {};
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/export/${item.id}/${ext}`, { headers });
      if (!response.ok) {
        let detail = 'Download failed';
        try {
          const err = await response.json();
          detail = err.detail || detail;
        } catch {
          detail = response.statusText || detail;
        }
        throw new Error(detail);
      }

      const blob = await response.blob();
      const baseName = (item.original_filename || 'document').replace(/\.[^/.]+$/, '');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${baseName}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      addToast(`Downloaded ${baseName}.${ext}`, 'success');
    } catch (err) {
      addToast(err?.message || 'Download failed', 'error');
    }
  };

  const openRenameDialog = (item) => {
    setRenameTarget(item);
    setRenameValue(item.original_filename || '');
    setActiveMenuId(null);
  };

  const closeRenameDialog = () => {
    setRenameTarget(null);
    setRenameValue('');
  };

  const handleRenameSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = renameValue.trim();
    if (!renameTarget || !trimmed) {
      addToast('Please enter a document name', 'info');
      return;
    }
    setIsRenaming(true);
    try {
      const updated = renameTarget.type === 'handwriting'
        ? { ...renameTarget, original_filename: trimmed }
        : renameTarget.type === 'ocr'
          ? { ...renameTarget, original_filename: trimmed }
        : await api.patch(`/upload/conversion/${renameTarget.id}`, {
            original_filename: trimmed,
          });
      if (renameTarget.type === 'handwriting') {
        renameHandwritingHistoryItem(renameTarget.id, trimmed);
      } else if (renameTarget.type === 'ocr') {
        renameLocalConversionHistoryItem(renameTarget.id, trimmed);
      }
      setHistory((prev) =>
        prev.map((item) => (item.id === renameTarget.id ? { ...item, ...updated } : item))
      );
      addToast('Document renamed successfully', 'success');
      closeRenameDialog();
    } catch (err) {
      addToast(err?.message || 'Failed to rename document', 'error');
    } finally {
      setIsRenaming(false);
    }
  };

  const DocumentMenu = ({ item, align = 'right' }) => (
    <div className="relative">
      <button
        type="button"
        onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
        title="More options"
      >
        <MoreVertical size={16} />
      </button>
      {activeMenuId === item.id && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)} />
          <div
            className={cn(
              'absolute top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-20',
              align === 'right' ? 'right-0' : 'left-0'
            )}
          >
            <button
              type="button"
              onClick={() => openRenameDialog(item)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <Pencil size={16} className="text-slate-400" />
              Rename
            </button>
            <button
              type="button"
              onClick={() => { handleDownload(item, item.type === 'handwriting' ? 'PNG' : 'PDF'); setActiveMenuId(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <Download size={16} className="text-slate-400" />
              Download {item.type === 'handwriting' ? 'PNG' : ''}
            </button>
            {item.type === 'handwriting' && (
              <button
                type="button"
                onClick={() => { handleDownload(item, 'PDF'); setActiveMenuId(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <Download size={16} className="text-slate-400" />
                Download PDF
              </button>
            )}
            <button
              type="button"
              onClick={() => { handleDelete(item.id); setActiveMenuId(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-bold text-red-500 hover:bg-red-50 transition-colors text-left"
            >
              <Trash2 size={16} className="text-red-500" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );

  const handleView = (name) => {
    addToast(`Opening ${name} for preview`, 'info');
  };

  const toggleSort = (key) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatSize = (wordCount) => {
    // Just a placeholder since we don't store actual byte size
    return `${wordCount} words`;
  };

  return (
    <div className="p-4 sm:p-6 w-full max-w-7xl mx-auto min-h-screen bg-slate-50/50 font-sans">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Conversion History</h1>
          <p className="text-base text-slate-600 font-medium">View and manage your previously converted documents.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
          <div className="relative w-full sm:w-60 group">
            <input 
              type="text" 
              placeholder="Search documents..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3461ff]/20 focus:border-[#3461ff] transition-all group-hover:border-slate-300 text-sm"
            />
            <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-[#3461ff] transition-colors" size={16} />
          </div>
          <button className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors shadow-sm w-full sm:w-auto justify-center">
            <Filter size={14} />
            Filter
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Files', value: history.length, icon: FileText },
          { label: 'This Month', value: history.filter(h => { const d = new Date(h.created_at); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length, icon: Calendar },
          { label: 'Total Words', value: history.reduce((sum, h) => sum + (h.word_count || 0), 0).toLocaleString(), icon: HardDrive },
          { label: 'Success Rate', value: history.length > 0 ? Math.round((history.filter(h => h.status === 'completed').length / history.length) * 100) + '%' : '0%', icon: CheckCircle2 },
        ].map((stat, i) => (
          <div key={i} className="p-3.5 rounded-xl border border-slate-100 bg-white shadow-sm shadow-slate-200/50 transition-all duration-300 hover:shadow-md hover:border-slate-200 group flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#3461ff] group-hover:scale-110 transition-transform">
              <stat.icon size={16} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-500 transition-colors mb-0.5">{stat.label}</p>
              <p className="text-lg font-black tracking-tight text-[#3461ff]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 bg-white rounded-3xl border border-slate-100 text-center">
          <Loader2 size={32} className="animate-spin text-[#3461ff] mb-4" />
          <p className="text-slate-500 font-semibold text-sm">Loading your documents…</p>
        </div>
      ) : filteredHistory.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl shadow-lg shadow-slate-200/30 border border-slate-200 overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors" onClick={() => toggleSort('name')}>
                      <div className="flex items-center gap-1.5">
                        Document Name
                        <ArrowUpDown size={12} className={sortBy === 'name' ? 'text-[#3461ff]' : 'text-slate-300'} />
                      </div>
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:text-slate-800 transition-colors" onClick={() => toggleSort('date')}>
                      <div className="flex items-center gap-1.5">
                        Date Added
                        <ArrowUpDown size={12} className={sortBy === 'date' ? 'text-[#3461ff]' : 'text-slate-300'} />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center">Size</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedHistory.map((item) => (
                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform",
                            item.type === 'handwriting' ? "bg-violet-50 text-violet-600" : "bg-blue-50 text-[#3461ff]"
                          )}>
                            {item.type === 'handwriting' ? <PenLine size={18} /> : <FileText size={18} />}
                          </div>
                          <div className="min-w-0">
                            <span className="block font-bold text-slate-800 text-xs truncate">{item.original_filename}</span>
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wide",
                              item.type === 'handwriting' ? "text-violet-500" : "text-blue-500"
                            )}>
                              {item.type === 'handwriting' ? 'Digital to handwriting' : 'Handwritten to digital text'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                          <Calendar size={12} className="text-slate-300" />
                          {formatDate(item.created_at)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1 text-slate-500 text-[11px] font-medium px-2 py-0.5 bg-slate-100 rounded-md">
                          <HardDrive size={12} className="text-slate-400" />
                          {formatSize(item.word_count)}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border",
                          item.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100/50" :
                          item.status === 'failed' ? "bg-red-50 text-red-600 border-red-100/50" :
                          "bg-yellow-50 text-yellow-600 border-yellow-100/50"
                        )}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end">
                          <DocumentMenu item={item} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-4">
              {paginatedHistory.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 active:bg-slate-50 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center border",
                        item.type === 'handwriting'
                          ? "bg-violet-50 text-violet-600 border-violet-100/50"
                          : "bg-blue-50 text-[#3461ff] border-blue-100/50"
                      )}>
                        {item.type === 'handwriting' ? <PenLine size={22} /> : <FileText size={22} />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-[15px] leading-tight mb-1.5">{item.original_filename}</span>
                        <span className={cn(
                          "mb-1 text-[10px] font-bold uppercase tracking-wide",
                          item.type === 'handwriting' ? "text-violet-500" : "text-blue-500"
                        )}>
                          {item.type === 'handwriting' ? 'Digital to handwriting' : 'Handwritten to digital text'}
                        </span>
                        <div className="flex items-center gap-3">
                           <span className="text-[12px] text-slate-400 flex items-center gap-1 font-medium">
                             <Calendar size={14} className="text-slate-300" /> {formatDate(item.created_at)}
                           </span>
                           <span className="text-[12px] text-slate-400 flex items-center gap-1 font-medium">
                             <HardDrive size={14} className="text-slate-300" /> {formatSize(item.word_count)}
                           </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <DocumentMenu item={item} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-50">
                    <span className={cn(
                      "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                      item.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100/50" :
                      item.status === 'failed' ? "bg-red-50 text-red-600 border-red-100/50" :
                      "bg-yellow-50 text-yellow-600 border-yellow-100/50"
                    )}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pagination UI - Custom style from image */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-1 px-1">
            <p className="text-xs font-semibold text-slate-500 order-2 sm:order-1">
              Showing <span className="text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * itemsPerPage, filteredHistory.length)}</span> of <span className="text-slate-900">{filteredHistory.length}</span> documents
            </p>
            
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-300",
                  currentPage === 1 
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed" 
                    : "bg-white border border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-600 shadow-sm"
                )}
              >
                <ChevronLeft size={18} strokeWidth={2.5} />
              </button>
              
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-300",
                  currentPage === totalPages 
                    ? "bg-slate-50 text-slate-300 cursor-not-allowed" 
                    : "bg-blue-50 text-[#3461ff] hover:bg-blue-100 shadow-sm shadow-blue-200/50"
                )}
              >
                <ChevronRight size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-6 bg-white rounded-3xl border border-dashed border-slate-200 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
            <Search size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No documents found</h3>
          <p className="text-slate-500 max-w-xs mx-auto mb-8">
            {searchQuery ? `We couldn't find any documents matching "${searchQuery}". Try a different search term.` : "You haven't converted any documents yet. Start by uploading an image or creating handwriting."}
          </p>
          {!searchQuery && (
            <button className="bg-[#3461ff] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#2b51d6] transition-all shadow-lg shadow-[#3461ff]/20">
              Convert Now
            </button>
          )}
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-[#3461ff] font-bold hover:underline">Clear Search</button>
          )}
        </div>
      )}

      {/* Rename dialog */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Rename document</h2>
              <button
                type="button"
                onClick={closeRenameDialog}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit}>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Document name
              </label>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                maxLength={255}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3461ff]/20 focus:border-[#3461ff] mb-5"
                placeholder="Enter document name"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRenameDialog}
                  className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenaming || !renameValue.trim()}
                  className="px-4 py-2 text-sm font-bold text-white bg-[#3461ff] hover:bg-[#2b51d6] rounded-xl transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isRenaming && <Loader2 size={14} className="animate-spin" />}
                  {isRenaming ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

