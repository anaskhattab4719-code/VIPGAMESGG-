import React, { useState, useMemo, useRef } from 'react';
import {
  FolderKanban,
  Search,
  Copy,
  Trash2,
  Edit3,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  Clock,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { NavSection } from '../types/vip';
import { playUiSound } from '../utils/soundFx';

type ProjectCategoryFilter =
  | 'all'
  | 'dev'
  | 'game'
  | '3d'
  | 'video'
  | 'code'
  | 'website'
  | 'presentation'
  | 'document'
  | 'workflow'
  | 'dataset'
  | 'idea';

interface UnifiedProjectRow {
  id: string;
  kind: Exclude<ProjectCategoryFilter, 'all'>;
  title: string;
  meta: string;
  statusLabel?: string;
  updatedAt: string;
  versionsCount?: number;
}

export function ProjectManagerView() {
  const {
    t,
    isRtl,
    settings,
    lastSavedAt,
    setActiveSection,
    devProjects,
    setDevProjects,
    setActiveDevId,
    gameProjects,
    setGameProjects,
    setActiveGameId,
    threeDProjects,
    setThreeDProjects,
    setActiveThreeDId,
    videoProjects,
    setVideoProjects,
    codeProjects,
    setCodeProjects,
    websites,
    setWebsites,
    presentations,
    setPresentations,
    documents,
    setDocuments,
    workflows,
    setWorkflows,
    dataReports,
    setDataReports,
    ideas,
    setIdeas,
    conversations,
    agentTasks,
    imageHistory,
    audioHistory,
    pcSessions,
    browserHistory,
    translationsHistory,
    academyLessons,
    academyXp,
    multiAgentSessions,
    recentActivity,
    logActivity,
    restoreWorkspaceBackup,
  } = useVip();

  const [filter, setFilter] = useState<ProjectCategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [renamingKey, setRenamingKey] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [restoreFeedback, setRestoreFeedback] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const isAr = settings.language === 'ar';

  const rows = useMemo<UnifiedProjectRow[]>(() => {
    const all: UnifiedProjectRow[] = [
      ...devProjects.map((d) => ({
        id: d.id,
        kind: 'dev' as const,
        title: d.name,
        meta: `${t.developer.targetTypes[d.targetType]}`,
        statusLabel: t.developer.statusLabels[d.status],
        updatedAt: d.updatedAt,
        versionsCount: d.versions.length,
      })),
      ...gameProjects.map((g) => ({
        id: g.id,
        kind: 'game' as const,
        title: g.title,
        meta: `UE5 ${g.dimension} · ${g.genre} (${g.targetPlatform || 'PC & Android'})`,
        updatedAt: g.updatedAt,
      })),
      ...threeDProjects.map((m) => ({
        id: m.id,
        kind: '3d' as const,
        title: m.name,
        meta: `${m.parts.length} parts · ${m.category}`,
        updatedAt: m.updatedAt,
      })),
      ...videoProjects.map((v) => ({
        id: v.id,
        kind: 'video' as const,
        title: v.title,
        meta: `${v.style} · ${v.scenes.length} scenes`,
        updatedAt: v.createdAt,
      })),
      ...codeProjects.map((c) => ({
        id: c.id,
        kind: 'code' as const,
        title: c.title,
        meta: `${c.language} · ${c.mainFilename}`,
        updatedAt: c.updatedAt,
      })),
      ...websites.map((w) => ({
        id: w.id,
        kind: 'website' as const,
        title: w.name,
        meta: `${w.stylePreset} · ${w.files.length} files`,
        updatedAt: w.updatedAt,
      })),
      ...presentations.map((p) => ({
        id: p.id,
        kind: 'presentation' as const,
        title: p.title,
        meta: `${p.slides.length} slides · ${p.audience}`,
        updatedAt: p.updatedAt,
      })),
      ...documents.map((doc) => ({
        id: doc.id,
        kind: 'document' as const,
        title: doc.title,
        meta: `${doc.sourceType.toUpperCase()} · ${doc.content.length} chars`,
        updatedAt: doc.updatedAt,
      })),
      ...workflows.map((wf) => ({
        id: wf.id,
        kind: 'workflow' as const,
        title: wf.name,
        meta: `${wf.nodes.length} steps`,
        updatedAt: wf.updatedAt,
      })),
      ...dataReports.map((rep) => ({
        id: rep.id,
        kind: 'dataset' as const,
        title: rep.datasetName,
        meta: `${rep.rowCount} rows · ${rep.columnCount} cols`,
        updatedAt: rep.updatedAt,
      })),
      ...ideas.map((idea) => ({
        id: idea.id,
        kind: 'idea' as const,
        title: idea.title,
        meta: `${idea.milestones.length} milestones`,
        updatedAt: idea.updatedAt,
      })),
    ];

    return all
      .filter((r) => filter === 'all' || r.kind === filter)
      .filter((r) => !search.trim() || r.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [
    devProjects,
    gameProjects,
    threeDProjects,
    videoProjects,
    codeProjects,
    websites,
    presentations,
    documents,
    workflows,
    dataReports,
    ideas,
    filter,
    search,
    t,
  ]);

  const openProject = (row: UnifiedProjectRow) => {
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
    if (row.kind === 'dev') {
      setActiveDevId(row.id);
      setActiveSection('developer');
    } else if (row.kind === 'game') {
      setActiveGameId(row.id);
      setActiveSection('game');
    } else if (row.kind === '3d') {
      setActiveThreeDId(row.id);
      setActiveSection('threeD');
    } else if (row.kind === 'video') setActiveSection('video');
    else if (row.kind === 'code') setActiveSection('programming');
    else if (row.kind === 'website') setActiveSection('websiteCreator');
    else if (row.kind === 'presentation') setActiveSection('presentations');
    else if (row.kind === 'document') setActiveSection('documents');
    else if (row.kind === 'workflow') setActiveSection('automation');
    else if (row.kind === 'dataset') setActiveSection('dataAnalyst');
    else if (row.kind === 'idea') setActiveSection('ideaGenerator');
  };

  const commitRename = (row: UnifiedProjectRow) => {
    const val = renameVal.trim();
    if (!val) {
      setRenamingKey(null);
      return;
    }
    if (row.kind === 'dev') setDevProjects((prev) => prev.map((p) => (p.id === row.id ? { ...p, name: val } : p)));
    else if (row.kind === 'game') setGameProjects((prev) => prev.map((p) => (p.id === row.id ? { ...p, title: val } : p)));
    else if (row.kind === '3d') setThreeDProjects((prev) => prev.map((p) => (p.id === row.id ? { ...p, name: val } : p)));
    else if (row.kind === 'video') setVideoProjects((prev) => prev.map((p) => (p.id === row.id ? { ...p, title: val } : p)));
    else if (row.kind === 'code') setCodeProjects((prev) => prev.map((p) => (p.id === row.id ? { ...p, title: val } : p)));
    else if (row.kind === 'website') setWebsites((prev) => prev.map((p) => (p.id === row.id ? { ...p, name: val } : p)));
    else if (row.kind === 'presentation') setPresentations((prev) => prev.map((p) => (p.id === row.id ? { ...p, title: val } : p)));
    else if (row.kind === 'document') setDocuments((prev) => prev.map((p) => (p.id === row.id ? { ...p, title: val } : p)));
    else if (row.kind === 'workflow') setWorkflows((prev) => prev.map((p) => (p.id === row.id ? { ...p, name: val } : p)));
    else if (row.kind === 'dataset') setDataReports((prev) => prev.map((p) => (p.id === row.id ? { ...p, datasetName: val } : p)));
    else if (row.kind === 'idea') setIdeas((prev) => prev.map((p) => (p.id === row.id ? { ...p, title: val } : p)));
    logActivity('Renamed Project', val);
    setRenamingKey(null);
  };

  const duplicateRow = (row: UnifiedProjectRow) => {
    const ts = Date.now();
    const now = new Date().toISOString();
    if (row.kind === 'dev') {
      const src = devProjects.find((p) => p.id === row.id);
      if (src) setDevProjects((prev) => [{ ...src, id: `dev_${ts}`, name: `${src.name} (Copy)`, updatedAt: now }, ...prev]);
    } else if (row.kind === 'game') {
      const src = gameProjects.find((p) => p.id === row.id);
      if (src) setGameProjects((prev) => [{ ...src, id: `game_${ts}`, title: `${src.title} (Copy)`, updatedAt: now }, ...prev]);
    } else if (row.kind === '3d') {
      const src = threeDProjects.find((p) => p.id === row.id);
      if (src) setThreeDProjects((prev) => [{ ...src, id: `3d_${ts}`, name: `${src.name} (Copy)`, updatedAt: now }, ...prev]);
    } else if (row.kind === 'video') {
      const src = videoProjects.find((p) => p.id === row.id);
      if (src) setVideoProjects((prev) => [{ ...src, id: `vid_${ts}`, title: `${src.title} (Copy)`, createdAt: now }, ...prev]);
    } else if (row.kind === 'code') {
      const src = codeProjects.find((p) => p.id === row.id);
      if (src) setCodeProjects((prev) => [{ ...src, id: `code_${ts}`, title: `${src.title} (Copy)`, updatedAt: now }, ...prev]);
    } else if (row.kind === 'website') {
      const src = websites.find((p) => p.id === row.id);
      if (src) setWebsites((prev) => [{ ...src, id: `web_${ts}`, name: `${src.name} (Copy)`, updatedAt: now }, ...prev]);
    } else if (row.kind === 'presentation') {
      const src = presentations.find((p) => p.id === row.id);
      if (src) setPresentations((prev) => [{ ...src, id: `ppt_${ts}`, title: `${src.title} (Copy)`, updatedAt: now }, ...prev]);
    } else if (row.kind === 'document') {
      const src = documents.find((p) => p.id === row.id);
      if (src) setDocuments((prev) => [{ ...src, id: `doc_${ts}`, title: `${src.title} (Copy)`, updatedAt: now }, ...prev]);
    } else if (row.kind === 'workflow') {
      const src = workflows.find((p) => p.id === row.id);
      if (src) setWorkflows((prev) => [{ ...src, id: `wf_${ts}`, name: `${src.name} (Copy)`, updatedAt: now }, ...prev]);
    } else if (row.kind === 'dataset') {
      const src = dataReports.find((p) => p.id === row.id);
      if (src) setDataReports((prev) => [{ ...src, id: `data_${ts}`, datasetName: `${src.datasetName} (Copy)`, updatedAt: now }, ...prev]);
    } else if (row.kind === 'idea') {
      const src = ideas.find((p) => p.id === row.id);
      if (src) setIdeas((prev) => [{ ...src, id: `idea_${ts}`, title: `${src.title} (Copy)`, updatedAt: now }, ...prev]);
    }
    logActivity('Duplicated Project', row.title);
    playUiSound('pop', settings.soundEnabled, settings.soundVolume);
  };

  const deleteRow = (row: UnifiedProjectRow) => {
    if (row.kind === 'dev') setDevProjects((prev) => prev.filter((p) => p.id !== row.id));
    else if (row.kind === 'game') setGameProjects((prev) => prev.filter((p) => p.id !== row.id));
    else if (row.kind === '3d') setThreeDProjects((prev) => prev.filter((p) => p.id !== row.id));
    else if (row.kind === 'video') setVideoProjects((prev) => prev.filter((p) => p.id !== row.id));
    else if (row.kind === 'code') setCodeProjects((prev) => prev.filter((p) => p.id !== row.id));
    else if (row.kind === 'website') setWebsites((prev) => prev.filter((p) => p.id !== row.id));
    else if (row.kind === 'presentation') setPresentations((prev) => prev.filter((p) => p.id !== row.id));
    else if (row.kind === 'document') setDocuments((prev) => prev.filter((p) => p.id !== row.id));
    else if (row.kind === 'workflow') setWorkflows((prev) => prev.filter((p) => p.id !== row.id));
    else if (row.kind === 'dataset') setDataReports((prev) => prev.filter((p) => p.id !== row.id));
    else if (row.kind === 'idea') setIdeas((prev) => prev.filter((p) => p.id !== row.id));
    logActivity('Deleted Project', row.title);
  };

  const restoreLatestDevVersion = (devId: string) => {
    const dev = devProjects.find((d) => d.id === devId);
    if (!dev || dev.versions.length === 0) return;
    const latest = dev.versions[0];
    setDevProjects((prev) =>
      prev.map((d) =>
        d.id === devId
          ? {
              ...d,
              previewHtml: latest.previewHtml,
              files: latest.files,
              status: 'draft',
              updatedAt: new Date().toISOString(),
            }
          : d
      )
    );
    logActivity('Restored Version Snapshot', `${dev.name} (${latest.label})`);
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
  };

  const handleExportWorkspaceBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings,
      conversations,
      devProjects,
      agentTasks,
      gameProjects,
      threeDProjects,
      imageHistory,
      videoProjects,
      audioHistory,
      codeProjects,
      pcSessions,
      browserHistory,
      presentations,
      documents,
      translationsHistory,
      academyLessons,
      academyXp,
      workflows,
      websites,
      dataReports,
      ideas,
      multiAgentSessions,
      recentActivity,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VIP_AI_Workspace_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    playUiSound('pop', settings.soundEnabled, settings.soundVolume);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      restoreWorkspaceBackup(parsed);
      setRestoreFeedback(isAr ? 'تمت استعادة النسخة الاحتياطية بنجاح' : 'Workspace backup restored cleanly');
      playUiSound('win', settings.soundEnabled, settings.soundVolume);
      setTimeout(() => setRestoreFeedback(null), 3500);
    } catch {
      setRestoreFeedback(isAr ? 'ملف النسخة الاحتياطية غير صالح' : 'Invalid backup JSON file');
    }
    e.target.value = '';
  };

  const ArrowDir = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.projects.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t.projects.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lastSavedAt && (
            <span className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isAr ? 'حفظ تلقائي:' : 'Auto-saved'} {new Date(lastSavedAt).toLocaleTimeString()}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={handleExportWorkspaceBackup}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? 'تصدير نسخة (.json)' : 'Export Backup (.json)'}</span>
          </button>
          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isAr ? 'استعادة نسخة (.json)' : 'Restore Backup'}</span>
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportBackup}
            className="hidden"
          />
        </div>
      </div>

      {restoreFeedback && (
        <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {restoreFeedback}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {(
            [
              { id: 'all', label: t.projects.all },
              { id: 'dev', label: t.nav.developer },
              { id: 'website', label: t.nav.websiteCreator },
              { id: 'game', label: t.nav.game },
              { id: '3d', label: t.nav.threeD },
              { id: 'presentation', label: t.nav.presentations },
              { id: 'document', label: t.nav.documents },
              { id: 'workflow', label: t.nav.automation },
              { id: 'dataset', label: t.nav.dataAnalyst },
              { id: 'idea', label: t.nav.ideaGenerator },
              { id: 'video', label: t.nav.video },
              { id: 'code', label: t.nav.programming },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 ${
                filter === f.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.common.search}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 ps-8 pe-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Saved Projects List */}
        <div className="lg:col-span-8 space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-10 text-center space-y-3">
              <FolderKanban className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-xs text-slate-500">{t.common.empty}</p>
              <button
                type="button"
                onClick={() => setActiveSection('templates' as NavSection)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                {t.nav.templates}
              </button>
            </div>
          ) : (
            rows.map((row) => {
              const key = `${row.kind}_${row.id}`;
              return (
                <div
                  key={key}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1 flex-1">
                    {renamingKey === key ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && commitRename(row)}
                          className="px-2.5 py-1 rounded border border-blue-500 bg-slate-50 dark:bg-slate-900 text-sm"
                          autoFocus
                        />
                        <button type="button" onClick={() => commitRename(row)} className="p-1 text-emerald-500">
                          <Check className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => setRenamingKey(null)} className="p-1 text-slate-400">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="font-display font-semibold text-sm truncate">{row.title}</h3>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{row.meta}</span>
                      {row.statusLabel && (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">· {row.statusLabel}</span>
                      )}
                      {typeof row.versionsCount === 'number' && row.versionsCount > 0 && (
                        <span className="font-mono">
                          · {row.versionsCount} {t.projects.versionsCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {row.kind === 'dev' && (row.versionsCount || 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => restoreLatestDevVersion(row.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={t.common.restore}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t.common.restore}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingKey(key);
                        setRenameVal(row.title);
                      }}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={t.common.rename}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateRow(row)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={t.common.duplicate}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRow(row)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-500 hover:bg-rose-500/10"
                      title={t.common.delete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openProject(row)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <span>{t.projects.continueBtn}</span>
                      <ArrowDir className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Recent Activity Log */}
        <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span>{t.projects.recentActivity}</span>
          </h3>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-slate-500">{t.common.empty}</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {recentActivity.map((act) => (
                <div
                  key={act.id}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-0.5"
                >
                  <p className="font-semibold text-slate-900 dark:text-white">{act.action}</p>
                  <p className="text-slate-500 truncate">{act.target}</p>
                  <p className="text-[11px] font-mono text-slate-400">
                    {new Date(act.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
