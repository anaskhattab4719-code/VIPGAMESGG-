import React, { useState, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import {
  Bot,
  Play,
  ShieldCheck,
  AlertTriangle,
  Wrench,
  Download,
  Loader2,
  FolderCode,
  History,
  BookmarkPlus,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ListChecks,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { AgentGoalStep, AgentGoalTask, DevProject, DevProjectFile, DevTestCheck, DevTestReport } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

const STARTER_DEV_PROJECT: DevProject = {
  id: 'starter_dev_pulse',
  name: 'FocusFlow Mobile PWA',
  targetType: 'mobile_pwa',
  summary:
    'A responsive Pomodoro & task sprint mobile web app with offline manifest, live SVG progress ring, session counter, and local task persistence.',
  architectureNotes:
    'Single-file progressive web app shell paired with manifest.json and modular JS state controller.',
  status: 'draft',
  updatedAt: new Date().toISOString(),
  previewHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FocusFlow PWA</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { margin: 0; background: #0B0E14; color: #F8FAFC; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .card { width: 100%; max-width: 390px; background: #131722; border: 1px solid #232A3B; border-radius: 20px; padding: 20px; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    p { margin: 0 0 16px; font-size: 12px; color: #94A3B8; }
    .timer { font-size: 46px; font-weight: 700; text-align: center; font-variant-numeric: tabular-nums; margin: 14px 0; color: #60A5FA; }
    .row { display: flex; gap: 8px; margin-bottom: 16px; }
    button { flex: 1; padding: 10px 12px; border-radius: 10px; border: 1px solid #2E374E; background: #1E2433; color: #fff; font-weight: 600; cursor: pointer; }
    button.primary { background: #2563EB; border-color: #2563EB; }
    form { display: flex; gap: 8px; margin-bottom: 12px; }
    input { flex: 1; padding: 10px 12px; border-radius: 10px; border: 1px solid #2E374E; background: #0B0E14; color: #fff; font-size: 13px; }
    ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
    li { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border-radius: 10px; background: #0F131D; font-size: 13px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>FocusFlow Sprint</h1>
    <p>Mobile-ready timer &amp; sprint checklist</p>
    <div id="timer" class="timer">25:00</div>
    <div class="row">
      <button id="toggleBtn" class="primary" type="button">Start</button>
      <button id="resetBtn" type="button">Reset</button>
    </div>
    <form id="taskForm">
      <input id="taskInput" placeholder="Add sprint task..." required />
      <button type="submit" style="flex:0 0 auto;">Add</button>
    </form>
    <ul id="taskList"></ul>
  </main>
  <script>
    (function () {
      var remaining = 1500;
      var running = false;
      var timerId = null;
      var timerEl = document.getElementById('timer');
      var toggleBtn = document.getElementById('toggleBtn');
      var resetBtn = document.getElementById('resetBtn');
      var taskForm = document.getElementById('taskForm');
      var taskInput = document.getElementById('taskInput');
      var taskList = document.getElementById('taskList');

      function renderTime() {
        var m = String(Math.floor(remaining / 60)).padStart(2, '0');
        var s = String(remaining % 60).padStart(2, '0');
        timerEl.textContent = m + ':' + s;
      }

      toggleBtn.addEventListener('click', function () {
        if (running) {
          clearInterval(timerId);
          running = false;
          toggleBtn.textContent = 'Start';
        } else {
          running = true;
          toggleBtn.textContent = 'Pause';
          timerId = setInterval(function () {
            if (remaining > 0) { remaining -= 1; renderTime(); }
          }, 1000);
        }
      });

      resetBtn.addEventListener('click', function () {
        clearInterval(timerId);
        running = false;
        remaining = 1500;
        toggleBtn.textContent = 'Start';
        renderTime();
      });

      taskForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = taskInput.value.trim();
        if (!text) return;
        var li = document.createElement('li');
        li.textContent = text;
        taskList.appendChild(li);
        taskInput.value = '';
      });

      renderTime();
    })();
  </script>
</body>
</html>`,
  files: [
    {
      path: 'index.html',
      language: 'html',
      content: '<!-- Synchronized with live previewHtml -->',
    },
    {
      path: 'manifest.json',
      language: 'json',
      content: JSON.stringify(
        {
          name: 'FocusFlow Mobile PWA',
          short_name: 'FocusFlow',
          start_url: '/',
          display: 'standalone',
          background_color: '#0B0E14',
          theme_color: '#2563EB',
        },
        null,
        2
      ),
    },
  ],
  versions: [],
};

function injectRuntimeProbe(html: string, probeId: string): string {
  const probeScript = `<script>
(function() {
  var reported = false;
  window.addEventListener('error', function(ev) {
    reported = true;
    try { parent.postMessage({ type: 'VIP_TEST_ERROR', probeId: '${probeId}', message: ev.message || 'Runtime Error' }, '*'); } catch (e) {}
  });
  window.addEventListener('unhandledrejection', function(ev) {
    reported = true;
    try { parent.postMessage({ type: 'VIP_TEST_ERROR', probeId: '${probeId}', message: String(ev.reason || 'Unhandled Rejection') }, '*'); } catch (e) {}
  });
  window.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      var hasDom = document.body && document.body.innerText.trim().length > 0 || (document.body && document.body.children.length > 0);
      try { parent.postMessage({ type: 'VIP_TEST_OK', probeId: '${probeId}', hasDom: Boolean(hasDom), hadError: reported }, '*'); } catch (e) {}
    }, 180);
  });
})();
</script>`;
  if (html.includes('</head>')) return html.replace('</head>', `${probeScript}\n</head>`);
  if (html.includes('<body')) return html.replace('<body', `${probeScript}\n<body`);
  return `${probeScript}\n${html}`;
}

export function DeveloperAgentView() {
  const {
    t,
    settings,
    devProjects,
    setDevProjects,
    agentTasks,
    setAgentTasks,
    activeDevId,
    setActiveDevId,
    pendingTemplatePrompt,
    setPendingTemplatePrompt,
    logActivity,
    triggerMascot,
  } = useVip();

  const [agentMode, setAgentMode] = useState<'app_builder' | 'goal_agent'>('app_builder');
  const [goalPrompt, setGoalPrompt] = useState('');
  const [planningGoal, setPlanningGoal] = useState(false);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(agentTasks[0]?.id || null);

  const [prompt, setPrompt] = useState('');
  const [targetType, setTargetType] = useState<'webapp' | 'mobile_pwa' | 'fullstack_api'>('webapp');
  const [tab, setTab] = useState<'preview' | 'files' | 'versions'>('preview');
  const [project, setProject] = useState<DevProject>(() => {
    if (activeDevId) {
      const found = devProjects.find((d) => d.id === activeDevId);
      if (found) return found;
    }
    return devProjects[0] || STARTER_DEV_PROJECT;
  });
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [building, setBuilding] = useState(false);
  const [testing, setTesting] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [probeSrcDoc, setProbeSrcDoc] = useState<string | null>(null);
  const activeProbeResolverRef = useRef<((res: { ok: boolean; errors: string[] }) => void) | null>(null);

  useEffect(() => {
    if (activeDevId) {
      const found = devProjects.find((d) => d.id === activeDevId);
      if (found) {
        setProject(found);
        setTargetType(found.targetType);
        setSelectedFileIdx(0);
      }
    }
  }, [activeDevId, devProjects]);

  useEffect(() => {
    if (pendingTemplatePrompt?.section === 'developer') {
      setPrompt(pendingTemplatePrompt.prompt);
      setPendingTemplatePrompt(null);
    }
  }, [pendingTemplatePrompt, setPendingTemplatePrompt]);

  const upsertProject = useCallback(
    (nextProj: DevProject) => {
      setProject(nextProj);
      setActiveDevId(nextProj.id);
      setDevProjects((prev) => {
        const exists = prev.some((p) => p.id === nextProj.id);
        return exists ? prev.map((p) => (p.id === nextProj.id ? nextProj : p)) : [nextProj, ...prev];
      });
    },
    [setActiveDevId, setDevProjects]
  );

  const runAutomatedTests = useCallback(
    async (candidate: DevProject): Promise<DevProject> => {
      setTesting(true);
      const checks: DevTestCheck[] = [];
      const html = candidate.previewHtml || '';

      // 1. HTML DOM Structure Check
      try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const hasElements = Boolean(doc.body && doc.body.children.length > 0);
        const parserErr = doc.querySelector('parsererror');
        checks.push({
          name: 'HTML5 Structure & DOM Render',
          passed: hasElements && !parserErr && html.length > 40,
          detail: hasElements ? 'Valid HTML5 document with rendered DOM elements.' : 'Empty or invalid HTML body.',
        });
      } catch (e) {
        checks.push({
          name: 'HTML5 Structure & DOM Render',
          passed: false,
          detail: e instanceof Error ? e.message : 'DOM parse error',
        });
      }

      // 2. JavaScript Syntax Check across <script> tags & .js files
      const scriptBlocks: string[] = [];
      const docForScripts = new DOMParser().parseFromString(html, 'text/html');
      docForScripts.querySelectorAll('script').forEach((sc) => {
        if (!sc.src && sc.textContent?.trim()) scriptBlocks.push(sc.textContent);
      });
      for (const f of candidate.files || []) {
        if (f.path.endsWith('.js') && f.content.trim()) {
          scriptBlocks.push(f.content);
        }
      }
      let jsSyntaxOk = true;
      let jsErrDetail = `Verified ${scriptBlocks.length} JavaScript block(s) with zero syntax errors.`;
      for (const code of scriptBlocks) {
        try {
          // Validate syntax cleanly without executing arbitrary globals
          new Function(code);
        } catch (err) {
          jsSyntaxOk = false;
          jsErrDetail = err instanceof Error ? err.message : 'JavaScript SyntaxError';
          break;
        }
      }
      checks.push({
        name: 'JavaScript Syntax Validation',
        passed: jsSyntaxOk,
        detail: jsErrDetail,
      });

      // 3. JSON Manifest / Config Check
      const jsonFiles = (candidate.files || []).filter((f) => f.path.endsWith('.json'));
      let jsonOk = true;
      let jsonDetail = jsonFiles.length > 0 ? `Validated ${jsonFiles.length} JSON file(s).` : 'No JSON config issues.';
      for (const jf of jsonFiles) {
        try {
          JSON.parse(jf.content);
        } catch (err) {
          jsonOk = false;
          jsonDetail = `${jf.path}: ${err instanceof Error ? err.message : 'Invalid JSON'}`;
          break;
        }
      }
      checks.push({
        name: 'Config & JSON Schema Check',
        passed: jsonOk,
        detail: jsonDetail,
      });

      // 4. Live Sandboxed Iframe Runtime Execution Probe
      const runtimeResult = await new Promise<{ ok: boolean; errors: string[] }>((resolve) => {
        const probeId = `probe_${Date.now()}`;
        const runtimeErrors: string[] = [];
        let settled = false;

        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          window.removeEventListener('message', onMsg);
          setProbeSrcDoc(null);
          resolve({ ok, errors: runtimeErrors });
        };

        const onMsg = (ev: MessageEvent) => {
          const data = ev.data as { type?: string; probeId?: string; message?: string; hasDom?: boolean; hadError?: boolean };
          if (!data || data.probeId !== probeId) return;
          if (data.type === 'VIP_TEST_ERROR' && data.message) {
            runtimeErrors.push(data.message);
          } else if (data.type === 'VIP_TEST_OK') {
            finish(Boolean(data.hasDom) && !data.hadError && runtimeErrors.length === 0);
          }
        };

        activeProbeResolverRef.current = resolve;
        window.addEventListener('message', onMsg);
        setProbeSrcDoc(injectRuntimeProbe(html, probeId));
        setTimeout(() => finish(runtimeErrors.length === 0), 2200);
      });

      checks.push({
        name: 'Live Sandbox Runtime Probe',
        passed: runtimeResult.ok,
        detail: runtimeResult.ok
          ? 'Application booted inside sandboxed iframe with zero uncaught runtime errors.'
          : runtimeResult.errors.join(' | ') || 'Sandbox runtime check failed.',
      });

      const allPassed = checks.every((c) => c.passed);
      const report: DevTestReport = {
        ranAt: new Date().toISOString(),
        passed: allPassed,
        checks,
      };

      const testedProject: DevProject = {
        ...candidate,
        status: allPassed ? 'tested_verified' : 'needs_repair',
        lastTestReport: report,
        updatedAt: new Date().toISOString(),
      };
      upsertProject(testedProject);
      setTesting(false);
      return testedProject;
    },
    [upsertProject]
  );

  const handleBuildAndTest = async () => {
    if (!prompt.trim() || building) return;
    setBuilding(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/ai/agent/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, targetType, language: settings.language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'App build failed');
        setErrorCode(data.code || null);
        return;
      }

      const rawFiles: DevProjectFile[] = Array.isArray(data.project?.files) ? data.project.files : [];
      const draftProj: DevProject = {
        id: `dev_${Date.now()}`,
        name: data.project?.name || prompt.slice(0, 36),
        targetType,
        summary: data.project?.summary || '',
        architectureNotes: data.project?.architectureNotes || '',
        previewHtml: data.project?.previewHtml || '<html><body><h1>Empty</h1></body></html>',
        files: rawFiles,
        status: 'draft',
        versions: [
          {
            versionId: `ver_${Date.now()}`,
            label: 'v1.0 Initial Build',
            createdAt: new Date().toISOString(),
            previewHtml: data.project?.previewHtml || '',
            files: rawFiles,
            summary: data.project?.summary || 'Initial autonomous build',
          },
        ],
        updatedAt: new Date().toISOString(),
      };

      upsertProject(draftProj);
      setSelectedFileIdx(0);
      setTab('preview');
      const tested = await runAutomatedTests(draftProj);
      logActivity(
        tested.status === 'tested_verified' ? 'Built & Verified App' : 'Built App (Needs Repair)',
        tested.name
      );
      if (tested.status === 'tested_verified') {
        triggerMascot('celebrate', tested.name);
        playUiSound('win', settings.soundEnabled, settings.soundVolume);
      } else {
        playUiSound('click', settings.soundEnabled, settings.soundVolume);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBuilding(false);
    }
  };

  const handleAutoRepair = async () => {
    if (repairing) return;
    setRepairing(true);
    setErrorMsg(null);
    const failedErrors =
      project.lastTestReport?.checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.detail}`) ||
      ['General runtime or syntax inspection requested'];

    try {
      const res = await fetch('/api/ai/agent/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previewHtml: project.previewHtml,
          files: project.files,
          errors: failedErrors,
          language: settings.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Repair failed');
        setErrorCode(data.code || null);
        return;
      }

      const nextHtml = data.repaired?.previewHtml || project.previewHtml;
      const nextFiles: DevProjectFile[] = Array.isArray(data.repaired?.files)
        ? data.repaired.files
        : project.files;

      const updated: DevProject = {
        ...project,
        previewHtml: nextHtml,
        files: nextFiles,
        summary: data.repaired?.fixSummary
          ? `${project.summary}\n\n[Auto-Repair]: ${data.repaired.fixSummary}`
          : project.summary,
        versions: [
          {
            versionId: `ver_${Date.now()}`,
            label: `v1.${project.versions.length + 1} Auto-Repair`,
            createdAt: new Date().toISOString(),
            previewHtml: nextHtml,
            files: nextFiles,
            summary: data.repaired?.fixSummary || 'Automated bug repair snapshot',
          },
          ...project.versions,
        ],
        updatedAt: new Date().toISOString(),
      };

      const tested = await runAutomatedTests(updated);
      logActivity('Auto-Repaired App', tested.name);
      playUiSound(tested.status === 'tested_verified' ? 'win' : 'pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setRepairing(false);
    }
  };

  const handleSaveSnapshot = () => {
    const verLabel = `v1.${project.versions.length + 1} Manual Snapshot`;
    const next: DevProject = {
      ...project,
      versions: [
        {
          versionId: `ver_${Date.now()}`,
          label: verLabel,
          createdAt: new Date().toISOString(),
          previewHtml: project.previewHtml,
          files: project.files,
          summary: project.summary,
        },
        ...project.versions,
      ],
      updatedAt: new Date().toISOString(),
    };
    upsertProject(next);
    logActivity('Saved App Version', `${next.name} (${verLabel})`);
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
  };

  const handleExportZip = async () => {
    const zip = new JSZip();
    zip.file('index.html', project.previewHtml);
    zip.file('README.md', `# ${project.name}\n\n${project.summary}\n\n## Architecture\n${project.architectureNotes}`);
    for (const f of project.files || []) {
      if (f.path !== 'index.html') zip.file(f.path, f.content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_')}_VIP_AI.zip`;
    a.click();
    URL.revokeObjectURL(url);
    playUiSound('pop', settings.soundEnabled, settings.soundVolume);
  };

  const activeGoalTask = agentTasks.find((tk) => tk.id === activeTaskId) || agentTasks[0] || null;

  const handlePlanGoal = async () => {
    if (!goalPrompt.trim() || planningGoal) return;
    setPlanningGoal(true);
    setErrorMsg(null);
    setErrorCode(null);
    try {
      const res = await fetch('/api/ai/agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goalPrompt, language: settings.language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Planning failed');
        setErrorCode(data.code || null);
        return;
      }
      const steps: AgentGoalStep[] = (Array.isArray(data.plan?.steps) ? data.plan.steps : []).map(
        (s: { stepNumber?: number; title?: string; actionType?: string; instruction?: string }, idx: number) => ({
          id: `step_${Date.now()}_${idx}`,
          stepNumber: s.stepNumber || idx + 1,
          title: s.title || `Step ${idx + 1}`,
          actionType: (s.actionType as AgentGoalStep['actionType']) || 'plan',
          instruction: s.instruction || '',
          status: 'pending' as const,
        })
      );
      const newTask: AgentGoalTask = {
        id: `task_${Date.now()}`,
        goal: goalPrompt.trim(),
        title: data.plan?.title || goalPrompt.slice(0, 42),
        summary: data.plan?.summary || '',
        status: 'planned',
        steps,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setAgentTasks((prev) => [newTask, ...prev]);
      setActiveTaskId(newTask.id);
      logActivity('Planned Agent Goal', newTask.title);
      playUiSound('click', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setPlanningGoal(false);
    }
  };

  const runGoalStep = async (task: AgentGoalTask, stepIndex: number): Promise<AgentGoalTask> => {
    const step = task.steps[stepIndex];
    if (!step) return task;
    const markRunning: AgentGoalTask = {
      ...task,
      status: 'running',
      updatedAt: new Date().toISOString(),
      steps: task.steps.map((s, i) => (i === stepIndex ? { ...s, status: 'running', error: undefined } : s)),
    };
    setAgentTasks((prev) => prev.map((tk) => (tk.id === task.id ? markRunning : tk)));

    const previousOutputs = task.steps
      .slice(0, stepIndex)
      .filter((s) => s.status === 'completed' && s.output)
      .map((s) => ({ title: s.title, output: s.output || '' }));

    try {
      const res = await fetch('/api/ai/agent/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: task.goal,
          stepTitle: step.title,
          instruction: step.instruction,
          previousOutputs,
          language: settings.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const failedTask: AgentGoalTask = {
          ...markRunning,
          status: 'failed',
          updatedAt: new Date().toISOString(),
          steps: markRunning.steps.map((s, i) =>
            i === stepIndex ? { ...s, status: 'failed', error: data.error || 'Step failed' } : s
          ),
        };
        setAgentTasks((prev) => prev.map((tk) => (tk.id === task.id ? failedTask : tk)));
        return failedTask;
      }

      const nextSteps: AgentGoalStep[] = markRunning.steps.map((s, i) =>
        i === stepIndex ? { ...s, status: 'completed', output: data.output || '' } : s
      );
      const allDone = nextSteps.every((s) => s.status === 'completed');
      const updated: AgentGoalTask = {
        ...markRunning,
        status: allDone ? 'completed' : 'planned',
        steps: nextSteps,
        updatedAt: new Date().toISOString(),
      };
      setAgentTasks((prev) => prev.map((tk) => (tk.id === task.id ? updated : tk)));
      if (allDone) {
        logActivity('Completed Multi-Step Goal', updated.title);
        triggerMascot('celebrate', updated.title);
        playUiSound('win', settings.soundEnabled, settings.soundVolume);
      } else {
        playUiSound('pop', settings.soundEnabled, settings.soundVolume);
      }
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      const failedTask: AgentGoalTask = {
        ...markRunning,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        steps: markRunning.steps.map((s, i) => (i === stepIndex ? { ...s, status: 'failed', error: msg } : s)),
      };
      setAgentTasks((prev) => prev.map((tk) => (tk.id === task.id ? failedTask : tk)));
      return failedTask;
    }
  };

  const handleRunAllSteps = async (task: AgentGoalTask) => {
    if (executingTaskId) return;
    setExecutingTaskId(task.id);
    let current = task;
    for (let i = 0; i < current.steps.length; i += 1) {
      if (current.steps[i].status === 'completed') continue;
      current = await runGoalStep(current, i);
      if (current.status === 'failed') break;
    }
    setExecutingTaskId(null);
  };

  const activeFile = project.files?.[selectedFileIdx];
  const isAr = settings.language === 'ar';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.developer.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t.developer.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-lg bg-slate-200/80 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setAgentMode('app_builder')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 ${
                agentMode === 'app_builder'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{isAr ? 'بناء واختبار التطبيقات' : 'App Builder'}</span>
            </button>
            <button
              type="button"
              onClick={() => setAgentMode('goal_agent')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 ${
                agentMode === 'goal_agent'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>{isAr ? 'وكيل المهام متعدد الخطوات' : 'Multi-Step Goal Agent'}</span>
            </button>
          </div>

          {agentMode === 'app_builder' && (
            <>
              <button
                type="button"
                onClick={handleSaveSnapshot}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>{t.developer.saveVersion}</span>
              </button>
              <button
                type="button"
                onClick={handleExportZip}
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.developer.exportZip}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {agentMode === 'goal_agent' ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-3">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isAr
                ? 'صِف الهدف متعدد الخطوات ليقوم الوكيل بتخطيطه وتنفيذه وتتبع تقدمه'
                : 'Describe a multi-step goal for VIP AI Agent to plan, execute, and track'}
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <textarea
                rows={2}
                value={goalPrompt}
                onChange={(e) => setGoalPrompt(e.target.value)}
                placeholder={
                  isAr
                    ? 'مثال: صمّم خطة إطلاق منتج برمجي SaaS مع المعمارية التقنية وقاعدة البيانات وخطة الاختبار...'
                    : 'Example: Plan and architect a multi-tenant SaaS booking platform with DB schema, API routes, security checklist, and launch sprint...'
                }
                className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handlePlanGoal}
                disabled={planningGoal || !goalPrompt.trim()}
                className="sm:self-end px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {planningGoal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{isAr ? 'تخطيط المهام' : 'Plan Multi-Step Task'}</span>
              </button>
            </div>
          </div>

          {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 space-y-4">
              {activeGoalTask ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display font-bold text-base">{activeGoalTask.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{activeGoalTask.summary || activeGoalTask.goal}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRunAllSteps(activeGoalTask)}
                      disabled={Boolean(executingTaskId)}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      {executingTaskId === activeGoalTask.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      <span>{isAr ? 'تنفيذ جميع الخطوات المتبقية' : 'Execute Remaining Steps'}</span>
                    </button>
                  </div>

                  {/* Progress Track */}
                  {(() => {
                    const total = Math.max(1, activeGoalTask.steps.length);
                    const done = activeGoalTask.steps.filter((s) => s.status === 'completed').length;
                    const pct = Math.round((done / total) * 100);
                    return (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-500 font-mono">
                          <span>{isAr ? `التقدم: ${done} / ${activeGoalTask.steps.length}` : `Progress: ${done} / ${activeGoalTask.steps.length} steps`}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-3">
                    {activeGoalTask.steps.map((st, idx) => (
                      <div
                        key={st.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-blue-600/15 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center justify-center">
                              {st.stepNumber}
                            </span>
                            <span className="font-semibold text-sm">{st.title}</span>
                            <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono uppercase">
                              {st.actionType}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                st.status === 'completed'
                                  ? 'text-emerald-500'
                                  : st.status === 'failed'
                                    ? 'text-rose-500'
                                    : st.status === 'running'
                                      ? 'text-blue-500'
                                      : 'text-slate-400'
                              }`}
                            >
                              {st.status}
                            </span>
                            <button
                              type="button"
                              onClick={() => runGoalStep(activeGoalTask, idx)}
                              disabled={st.status === 'running' || Boolean(executingTaskId)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-white dark:hover:bg-slate-800 inline-flex items-center gap-1"
                            >
                              {st.status === 'running' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                              <span>{isAr ? 'تنفيذ' : 'Run'}</span>
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{st.instruction}</p>
                        {st.error && <p className="text-xs text-rose-500">{st.error}</p>}
                        {st.output && (
                          <pre className="whitespace-pre-wrap text-xs bg-white dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 rounded-lg p-3 max-h-64 overflow-y-auto leading-relaxed">
                            {st.output}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-10 text-center text-xs text-slate-500">
                  {isAr ? 'أدخل هدفاً أعلاه ليقوم الوكيل بإنشاء خطة تنفيذ خطوة بخطوة.' : 'Enter a goal above to generate a step-by-step execution plan.'}
                </div>
              )}
            </div>

            <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
              <h4 className="font-display font-semibold text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-blue-500" />
                <span>{isAr ? 'سجل مهام الوكيل' : 'Task Execution History'}</span>
              </h4>
              {agentTasks.length === 0 ? (
                <p className="text-xs text-slate-500">{t.common.empty}</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {agentTasks.map((tk) => (
                    <div
                      key={tk.id}
                      onClick={() => setActiveTaskId(tk.id)}
                      className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between gap-2 ${
                        activeGoalTask?.id === tk.id
                          ? 'border-blue-500 bg-blue-600/10'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{tk.title}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {tk.steps.filter((s) => s.status === 'completed').length}/{tk.steps.length} · {tk.status}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAgentTasks((prev) => prev.filter((x) => x.id !== tk.id));
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500"
                        aria-label={t.common.delete}
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
      ) : (
        <>
          {/* Prompt & Target Builder */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.developer.promptLabel}
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.developer.promptPlaceholder}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="lg:col-span-4 space-y-3 flex flex-col justify-between">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Target Architecture</label>
              <div className="grid grid-cols-1 gap-1.5">
                {(['webapp', 'mobile_pwa', 'fullstack_api'] as const).map((tt) => (
                  <button
                    key={tt}
                    type="button"
                    onClick={() => setTargetType(tt)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium text-start transition-colors ${
                      targetType === tt
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t.developer.targetTypes[tt]}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleBuildAndTest}
              disabled={building || testing || !prompt.trim()}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
            >
              {building || testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              <span>{t.developer.buildBtn}</span>
            </button>
          </div>
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} onRetry={handleBuildAndTest} />}

      {/* Verification Status & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {([
            { id: 'preview', icon: Play },
            { id: 'files', icon: FolderCode },
            { id: 'versions', icon: History },
          ] as const).map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap ${
                tab === id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.developer.tabs[id]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
              project.status === 'tested_verified'
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : project.status === 'needs_repair'
                  ? 'bg-rose-500/15 text-rose-500'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}
          >
            {project.status === 'tested_verified' ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            <span>{t.developer.statusLabels[project.status]}</span>
          </div>

          <button
            type="button"
            onClick={() => runAutomatedTests(project)}
            disabled={testing}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>{t.developer.runTests}</span>
          </button>

          <button
            type="button"
            onClick={handleAutoRepair}
            disabled={repairing}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            {repairing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
            <span>{t.developer.autoRepair}</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Live App Preview & Automated Test Results */}
      {tab === 'preview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-display font-semibold text-sm">{project.name}</span>
              <span className="text-slate-500">{t.developer.targetTypes[project.targetType]}</span>
            </div>
            <iframe
              title="VIP AI Developer Agent Preview"
              sandbox="allow-scripts"
              srcDoc={project.previewHtml}
              className="w-full h-[460px] rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
            />
          </div>

          <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-4">
            <div>
              <h3 className="font-display font-semibold text-sm">Automated Verification Report</h3>
              <p className="text-xs text-slate-500 mt-0.5">{project.summary}</p>
            </div>

            {project.lastTestReport ? (
              <div className="space-y-2">
                {project.lastTestReport.checks.map((chk) => (
                  <div
                    key={chk.name}
                    className={`p-3 rounded-lg border text-xs space-y-1 ${
                      chk.passed
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-rose-500/30 bg-rose-500/10'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      {chk.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      )}
                      <span>{chk.name}</span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">{chk.detail}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-amber-500">
                Click "{t.developer.runTests}" to execute automated DOM, syntax, JSON, and sandbox runtime checks.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Project Files */}
      {tab === 'files' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] overflow-hidden grid grid-cols-1 md:grid-cols-12">
          <div className="md:col-span-3 border-b md:border-b-0 md:border-e border-slate-200 dark:border-slate-800 p-3 space-y-1">
            <button
              type="button"
              onClick={() => setSelectedFileIdx(-1)}
              className={`w-full text-start px-3 py-2 rounded-lg text-xs font-mono truncate ${
                selectedFileIdx === -1
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              preview/index.html
            </button>
            {(project.files || []).map((f, idx) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setSelectedFileIdx(idx)}
                className={`w-full text-start px-3 py-2 rounded-lg text-xs font-mono truncate ${
                  selectedFileIdx === idx
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {f.path}
              </button>
            ))}
          </div>

          <div className="md:col-span-9 p-4 space-y-2">
            <textarea
              rows={20}
              dir="ltr"
              value={selectedFileIdx === -1 ? project.previewHtml : activeFile?.content || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (selectedFileIdx === -1) {
                  upsertProject({ ...project, previewHtml: val, status: 'draft' });
                } else {
                  upsertProject({
                    ...project,
                    status: 'draft',
                    files: project.files.map((f, idx) =>
                      idx === selectedFileIdx ? { ...f, content: val } : f
                    ),
                  });
                }
              }}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 text-emerald-300 font-mono text-xs p-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Tab 3: Version History */}
      {tab === 'versions' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-3">
          {project.versions.length === 0 ? (
            <p className="text-xs text-slate-500">{t.common.empty}</p>
          ) : (
            <div className="space-y-2.5">
              {project.versions.map((ver) => (
                <div
                  key={ver.versionId}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{ver.label}</p>
                    <p className="text-xs text-slate-500">{ver.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const restored: DevProject = {
                        ...project,
                        previewHtml: ver.previewHtml,
                        files: ver.files,
                        status: 'draft',
                        updatedAt: new Date().toISOString(),
                      };
                      upsertProject(restored);
                      setTab('preview');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.common.restore}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hidden Sandbox Probe Iframe */}
      {probeSrcDoc && (
        <iframe
          title="Automated Sandbox Runtime Probe"
          sandbox="allow-scripts"
          srcDoc={probeSrcDoc}
          className="hidden"
        />
      )}
        </>
      )}
    </div>
  );
}
