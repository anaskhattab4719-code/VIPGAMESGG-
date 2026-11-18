import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  Download,
  Loader2,
  Printer,
  MessageSquareText,
  Trash2,
  FilePlus2,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { VipDocumentItem } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { extractDocxText, exportDocxBlob } from '../utils/officeExport';
import { playUiSound } from '../utils/soundFx';

export function DocumentsView() {
  const { t, settings, documents, setDocuments, logActivity } = useVip();
  const isAr = settings.language === 'ar';

  const [activeDoc, setActiveDoc] = useState<VipDocumentItem>(
    documents[0] || {
      id: 'starter_doc_vip',
      title: isAr ? 'مستند جديد - VIP AI' : 'Untitled VIP Document',
      sourceType: 'created',
      content: isAr
        ? '# ملخص تنفيذي\n\nاكتب هنا أو ارفع ملف Word (.docx) أو PDF لتحليله أو تلخيصه أو تحريره.'
        : '# Executive Document\n\nWrite here or upload a Word (.docx), PDF, or Markdown/Text file to read, summarize, rewrite, or export as real .DOCX.',
      updatedAt: new Date().toISOString(),
    }
  );
  const [prompt, setPrompt] = useState('');
  const [qaReply, setQaReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const upsertDoc = (doc: VipDocumentItem) => {
    setActiveDoc(doc);
    setDocuments((prev) => {
      const exists = prev.some((d) => d.id === doc.id);
      return exists ? prev.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...prev];
    });
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.docx')) {
        const buffer = await file.arrayBuffer();
        const text = await extractDocxText(buffer);
        const imported: VipDocumentItem = {
          id: `doc_${Date.now()}`,
          title: file.name.replace(/\.docx$/i, ''),
          sourceType: 'docx',
          content: text,
          updatedAt: new Date().toISOString(),
        };
        upsertDoc(imported);
        logActivity('Imported Word .docx', file.name);
      } else if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
        setLoading(true);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await fetch('/api/ai/documents/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'extract_pdf', pdfBase64: base64, language: settings.language }),
        });
        const data = await res.json();
        setLoading(false);
        if (!res.ok) {
          setErrorMsg(data.error || 'PDF extraction failed');
          setErrorCode(data.code || null);
          return;
        }
        const imported: VipDocumentItem = {
          id: `doc_${Date.now()}`,
          title: file.name.replace(/\.pdf$/i, ''),
          sourceType: 'pdf',
          content: data.resultText || '',
          updatedAt: new Date().toISOString(),
        };
        upsertDoc(imported);
        logActivity('Extracted PDF Document', file.name);
      } else {
        const text = await file.text();
        const imported: VipDocumentItem = {
          id: `doc_${Date.now()}`,
          title: file.name,
          sourceType: 'txt',
          content: text,
          updatedAt: new Date().toISOString(),
        };
        upsertDoc(imported);
        logActivity('Imported Text Document', file.name);
      }
      playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setLoading(false);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to parse document');
    }
    e.target.value = '';
  };

  const runDocAction = async (action: 'create' | 'summarize' | 'rewrite' | 'qa') => {
    if (loading) return;
    if ((action === 'create' || action === 'qa') && !prompt.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/ai/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          prompt: prompt.trim(),
          content: activeDoc.content,
          language: settings.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Document processing failed');
        setErrorCode(data.code || null);
        return;
      }

      if (action === 'summarize' || action === 'qa') {
        setQaReply(data.resultText || '');
        if (action === 'summarize') {
          upsertDoc({ ...activeDoc, summary: data.resultText || '', updatedAt: new Date().toISOString() });
        }
      } else {
        upsertDoc({
          ...activeDoc,
          id: action === 'create' ? `doc_${Date.now()}` : activeDoc.id,
          title: action === 'create' ? prompt.trim().slice(0, 40) : activeDoc.title,
          sourceType: action === 'create' ? 'created' : activeDoc.sourceType,
          content: data.resultText || activeDoc.content,
          updatedAt: new Date().toISOString(),
        });
      }
      logActivity(`Document ${action}`, activeDoc.title);
      playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportDocx = async () => {
    const blob = await exportDocxBlob(activeDoc.title, activeDoc.content);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title.replace(/\s+/g, '_')}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    playUiSound('pop', settings.soundEnabled, settings.soundVolume);
  };

  const handleExportMarkdown = () => {
    const blob = new Blob([activeDoc.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    const win = window.open('', '_blank', 'width=850,height=700');
    if (!win) {
      window.print();
      return;
    }
    win.document.write(
      `<!DOCTYPE html><html><head><title>${activeDoc.title}</title><style>body{font-family:system-ui,sans-serif;max-width:740px;margin:40px auto;padding:20px;line-height:1.7;white-space:pre-wrap;color:#111}</style></head><body><h1>${activeDoc.title}</h1>${activeDoc.content.replace(/</g, '&lt;')}</body></html>`
    );
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.nav.documents}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'قراءة وتحليل ملفات Word (.docx) و PDF، التلخيص وإعادة الصياغة، والتصدير إلى .DOCX و PDF'
              : 'Read .docx & PDF files, create, summarize, rewrite, chat with documents & export Word .DOCX / PDF'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Upload className="w-3.5 h-3.5 text-blue-500" />
            <span>{isAr ? 'فتح .DOCX / .PDF / .TXT' : 'Open .DOCX / .PDF / .TXT'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleUploadFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.MD</span>
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportDocx}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? 'تصدير Word (.docx)' : 'Export .DOCX'}</span>
          </button>
        </div>
      </div>

      {/* AI Document Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              isAr
                ? 'أدخل موضوعاً لإنشاء مستند جديد، أو اطرح سؤالاً حول المستند المفتوح، أو تعليمات إعادة الصياغة...'
                : 'Enter a topic to draft a new document, a question about this doc, or rewrite instructions...'
            }
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => runDocAction('create')}
              disabled={loading || !prompt.trim()}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus2 className="w-3.5 h-3.5" />}
              <span>{isAr ? 'إنشاء مستند' : 'Draft Doc'}</span>
            </button>
            <button
              type="button"
              onClick={() => runDocAction('summarize')}
              disabled={loading || !activeDoc.content.trim()}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{isAr ? 'تلخيص' : 'Summarize'}</span>
            </button>
            <button
              type="button"
              onClick={() => runDocAction('rewrite')}
              disabled={loading || !activeDoc.content.trim()}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-500" />
              <span>{isAr ? 'تحسين وإعادة صياغة' : 'Rewrite'}</span>
            </button>
            <button
              type="button"
              onClick={() => runDocAction('qa')}
              disabled={loading || !prompt.trim()}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <MessageSquareText className="w-3.5 h-3.5 text-blue-500" />
              <span>{isAr ? 'سؤال عن الملف' : 'Ask Doc'}</span>
            </button>
          </div>
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <input
                value={activeDoc.title}
                onChange={(e) => upsertDoc({ ...activeDoc, title: e.target.value, updatedAt: new Date().toISOString() })}
                className="font-display font-bold text-base bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none flex-1"
              />
              <span className="text-[11px] font-mono text-slate-400">
                {activeDoc.content.split(/\s+/).filter(Boolean).length} {isAr ? 'كلمة' : 'words'}
              </span>
            </div>

            <textarea
              rows={18}
              value={activeDoc.content}
              onChange={(e) => upsertDoc({ ...activeDoc, content: e.target.value, updatedAt: new Date().toISOString() })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {qaReply && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-600/5 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-display font-semibold text-xs uppercase text-blue-500">
                  {isAr ? 'تحليل وملخص الذكاء الاصطناعي' : 'AI Summary / Answer'}
                </h4>
                <button type="button" onClick={() => setQaReply(null)} className="text-xs text-slate-400">
                  {t.common.close}
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                {qaReply}
              </pre>
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
          <h4 className="font-display font-semibold text-sm">{isAr ? 'المستندات المحفوظة' : 'Saved Documents'}</h4>
          {documents.length === 0 ? (
            <p className="text-xs text-slate-500">{t.common.empty}</p>
          ) : (
            <div className="space-y-2 max-h-[460px] overflow-y-auto">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => setActiveDoc(doc)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between gap-2 ${
                    activeDoc.id === doc.id
                      ? 'border-blue-500 bg-blue-600/10'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{doc.title}</p>
                    <p className="text-[11px] text-slate-500 uppercase">{doc.sourceType}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDocuments((prev) => prev.filter((x) => x.id !== doc.id));
                    }}
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
