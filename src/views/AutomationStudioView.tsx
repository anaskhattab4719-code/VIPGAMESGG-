import React, { useState } from 'react';
import {
  Workflow,
  Play,
  Plus,
  Trash2,
  GripVertical,
  ArrowDown,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { AutomationNode, AutomationWorkflow } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

const STARTER_WORKFLOW: AutomationWorkflow = {
  id: 'starter_wf_research',
  name: 'Web Research → Arabic Brief → Action Plan',
  description: 'Chains live Google Search grounding into an executive summary and task list.',
  initialInput: 'Unreal Engine 5.5 MegaLights & Mobile Vulkan best practices 2025',
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'node_1',
      stepOrder: 1,
      label: 'Live Web Search',
      action: 'web_search',
      promptTemplate: 'Research verified facts and key releases for: {{input}}',
      status: 'idle',
    },
    {
      id: 'node_2',
      stepOrder: 2,
      label: 'Executive Summary',
      action: 'summarize',
      promptTemplate: 'Summarize these technical findings clearly:\n{{prev_output}}',
      status: 'idle',
    },
    {
      id: 'node_3',
      stepOrder: 3,
      label: 'Actionable Checklist',
      action: 'extract_tasks',
      promptTemplate: 'Extract an engineering adoption checklist from:\n{{prev_output}}',
      status: 'idle',
    },
  ],
};

export function AutomationStudioView() {
  const { t, settings, workflows, setWorkflows, logActivity, triggerMascot } = useVip();
  const isAr = settings.language === 'ar';

  const [wf, setWf] = useState<AutomationWorkflow>(workflows[0] || STARTER_WORKFLOW);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const upsertWorkflow = (nextWf: AutomationWorkflow) => {
    setWf(nextWf);
    setWorkflows((prev) => {
      const exists = prev.some((x) => x.id === nextWf.id);
      return exists ? prev.map((x) => (x.id === nextWf.id ? nextWf : x)) : [nextWf, ...prev];
    });
  };

  const reorderNodes = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || toIdx < 0 || toIdx >= wf.nodes.length) return;
    const copy = [...wf.nodes];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    const reindexed = copy.map((n, idx) => ({ ...n, stepOrder: idx + 1 }));
    upsertWorkflow({ ...wf, nodes: reindexed, updatedAt: new Date().toISOString() });
  };

  const addNode = () => {
    const newNode: AutomationNode = {
      id: `node_${Date.now()}`,
      stepOrder: wf.nodes.length + 1,
      label: isAr ? `خطوة ${wf.nodes.length + 1}` : `Step ${wf.nodes.length + 1}`,
      action: 'analyze',
      promptTemplate: 'Analyze the previous step output and provide structured conclusions:\n{{prev_output}}',
      status: 'idle',
    };
    upsertWorkflow({ ...wf, nodes: [...wf.nodes, newNode], updatedAt: new Date().toISOString() });
  };

  const handleRunPipeline = async () => {
    if (running || wf.nodes.length === 0) return;
    setRunning(true);
    setErrorMsg(null);
    setErrorCode(null);

    let currentWf: AutomationWorkflow = {
      ...wf,
      nodes: wf.nodes.map((n) => ({ ...n, status: 'idle', lastOutput: '' })),
    };
    upsertWorkflow(currentWf);

    let previousOutput = '';
    for (let i = 0; i < currentWf.nodes.length; i += 1) {
      const node = currentWf.nodes[i];
      currentWf = {
        ...currentWf,
        nodes: currentWf.nodes.map((n, idx) => (idx === i ? { ...n, status: 'running' } : n)),
      };
      upsertWorkflow(currentWf);

      try {
        const res = await fetch('/api/ai/automation/run-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: node.action,
            promptTemplate: node.promptTemplate,
            initialInput: currentWf.initialInput,
            previousOutput,
            language: settings.language,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || `Node "${node.label}" failed`);
          setErrorCode(data.code || null);
          currentWf = {
            ...currentWf,
            nodes: currentWf.nodes.map((n, idx) => (idx === i ? { ...n, status: 'error' } : n)),
          };
          upsertWorkflow(currentWf);
          setRunning(false);
          return;
        }

        previousOutput = data.output || '';
        currentWf = {
          ...currentWf,
          updatedAt: new Date().toISOString(),
          nodes: currentWf.nodes.map((n, idx) =>
            idx === i ? { ...n, status: 'done', lastOutput: previousOutput } : n
          ),
        };
        upsertWorkflow(currentWf);
        playUiSound('pop', settings.soundEnabled, settings.soundVolume);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Network error');
        setRunning(false);
        return;
      }
    }

    logActivity('Executed Automation Workflow', currentWf.name);
    triggerMascot('celebrate', currentWf.name);
    playUiSound('win', settings.soundEnabled, settings.soundVolume);
    setRunning(false);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(wf, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${wf.name.replace(/\s+/g, '_')}.workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.nav.automation}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'مصمم مسارات ذكي بالسحب والإفلات لربط خطوات البحث والتلخيص والترجمة والبرمجة تلقائياً'
              : 'Visual drag-and-drop AI workflow builder chaining real backend steps sequentially'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addNode}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAr ? 'إضافة عقدة خطوة' : 'Add Node'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={handleRunPipeline}
            disabled={running}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isAr ? 'تشغيل المسار بالكامل' : 'Run Workflow Pipeline'}</span>
          </button>
        </div>
      </div>

      {/* Pipeline Metadata & Trigger Input */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5 space-y-2">
          <label className="block text-xs font-semibold">{isAr ? 'اسم المسار' : 'Workflow Name'}</label>
          <input
            value={wf.name}
            onChange={(e) => upsertWorkflow({ ...wf, name: e.target.value })}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-semibold"
          />
        </div>
        <div className="md:col-span-7 space-y-2">
          <label className="block text-xs font-semibold">
            {isAr ? 'المدخل الأولي ({{input}})' : 'Initial Trigger Input ({{input}})'}
          </label>
          <input
            value={wf.initialInput}
            onChange={(e) => upsertWorkflow({ ...wf, initialInput: e.target.value })}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
          />
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      {/* Visual Connected Pipeline Canvas */}
      <div className="space-y-3">
        {wf.nodes.map((node, idx) => (
          <React.Fragment key={node.id}>
            <div
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx !== null) reorderNodes(dragIdx, idx);
                setDragIdx(null);
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab shrink-0" />
                  <span className="w-6 h-6 rounded-full bg-blue-600/15 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <input
                    value={node.label}
                    onChange={(e) =>
                      upsertWorkflow({
                        ...wf,
                        nodes: wf.nodes.map((n, i) => (i === idx ? { ...n, label: e.target.value } : n)),
                      })
                    }
                    className="font-display font-semibold text-sm bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={node.action}
                    onChange={(e) =>
                      upsertWorkflow({
                        ...wf,
                        nodes: wf.nodes.map((n, i) =>
                          i === idx ? { ...n, action: e.target.value as AutomationNode['action'] } : n
                        ),
                      })
                    }
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                  >
                    <option value="web_search">Web Search (Grounded)</option>
                    <option value="summarize">Summarize</option>
                    <option value="translate">Translate</option>
                    <option value="analyze">Analyze</option>
                    <option value="extract_tasks">Extract Tasks</option>
                    <option value="code_gen">Generate Code</option>
                  </select>

                  {node.status === 'running' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                  {node.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {node.status === 'error' && <XCircle className="w-4 h-4 text-rose-500" />}

                  {wf.nodes.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        upsertWorkflow({
                          ...wf,
                          nodes: wf.nodes.filter((_, i) => i !== idx).map((n, k) => ({ ...n, stepOrder: k + 1 })),
                        })
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <textarea
                rows={2}
                value={node.promptTemplate}
                onChange={(e) =>
                  upsertWorkflow({
                    ...wf,
                    nodes: wf.nodes.map((n, i) => (i === idx ? { ...n, promptTemplate: e.target.value } : n)),
                  })
                }
                placeholder="Prompt template — supports {{input}} and {{prev_output}}"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-mono"
              />

              {node.lastOutput && (
                <pre className="whitespace-pre-wrap text-xs bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {node.lastOutput}
                </pre>
              )}
            </div>

            {idx < wf.nodes.length - 1 && (
              <div className="flex justify-center">
                <div className="p-1.5 rounded-full bg-blue-600/10 text-blue-500">
                  <ArrowDown className="w-4 h-4" />
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
