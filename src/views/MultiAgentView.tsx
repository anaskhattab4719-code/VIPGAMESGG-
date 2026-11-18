import React, { useState } from 'react';
import {
  Users,
  Play,
  Loader2,
  CheckCircle2,
  Download,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { MultiAgentSession, MultiAgentTurn } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

const AGENT_ROLES: Array<{
  role: MultiAgentTurn['agentRole'];
  labelAr: string;
  color: string;
}> = [
  { role: 'Researcher', labelAr: 'الباحث', color: 'text-cyan-500' },
  { role: 'System Architect', labelAr: 'مهندس المعمارية', color: 'text-blue-500' },
  { role: 'Product Designer', labelAr: 'مصمم المنتج', color: 'text-purple-500' },
  { role: 'Lead Engineer', labelAr: 'كبير المهندسين', color: 'text-emerald-500' },
  { role: 'QA Reviewer', labelAr: 'مراجع الجودة والأمان', color: 'text-amber-500' },
];

export function MultiAgentView() {
  const { t, settings, multiAgentSessions, setMultiAgentSessions, logActivity, triggerMascot } = useVip();
  const isAr = settings.language === 'ar';

  const [objective, setObjective] = useState('');
  const [session, setSession] = useState<MultiAgentSession | null>(multiAgentSessions[0] || null);
  const [runningRole, setRunningRole] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const upsertSession = (nextSess: MultiAgentSession) => {
    setSession(nextSess);
    setMultiAgentSessions((prev) => {
      const exists = prev.some((s) => s.id === nextSess.id);
      return exists ? prev.map((s) => (s.id === nextSess.id ? nextSess : s)) : [nextSess, ...prev];
    });
  };

  const handleRunFullTeam = async () => {
    if (!objective.trim() || runningRole) return;
    setErrorMsg(null);
    setErrorCode(null);

    let current: MultiAgentSession = {
      id: `ma_${Date.now()}`,
      objective: objective.trim(),
      title: objective.trim().slice(0, 48),
      turns: [],
      finalSynthesisMarkdown: '',
      updatedAt: new Date().toISOString(),
    };
    upsertSession(current);

    for (const r of AGENT_ROLES) {
      setRunningRole(r.role);
      try {
        const res = await fetch('/api/ai/multiagent/collaborate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            objective: current.objective,
            agentRole: r.role,
            priorTurns: current.turns,
            mode: 'agent_step',
            language: settings.language,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || `${r.role} failed`);
          setErrorCode(data.code || null);
          setRunningRole(null);
          return;
        }
        const turn: MultiAgentTurn = {
          id: `turn_${Date.now()}_${r.role}`,
          agentRole: r.role,
          summary: data.turn?.summary || `${r.role} delivered output`,
          deliverableMarkdown: data.turn?.deliverableMarkdown || '',
          createdAt: new Date().toISOString(),
        };
        current = {
          ...current,
          turns: [...current.turns, turn],
          updatedAt: new Date().toISOString(),
        };
        upsertSession(current);
        playUiSound('pop', settings.soundEnabled, settings.soundVolume);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Network error');
        setRunningRole(null);
        return;
      }
    }

    // Final Synthesis
    setRunningRole('Synthesizing');
    try {
      const res = await fetch('/api/ai/multiagent/collaborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: current.objective,
          priorTurns: current.turns,
          mode: 'synthesize',
          language: settings.language,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        current = {
          ...current,
          finalSynthesisMarkdown: data.finalSynthesisMarkdown || '',
          updatedAt: new Date().toISOString(),
        };
        upsertSession(current);
      }
      logActivity('Multi-Agent Team Completed', current.title);
      triggerMascot('celebrate', current.title);
      playUiSound('win', settings.soundEnabled, settings.soundVolume);
    } catch {
      // keep individual agent deliverables even if final synthesis fails
    } finally {
      setRunningRole(null);
    }
  };

  const exportDeliverable = (sess: MultiAgentSession) => {
    const md = `# Multi-Agent Deliverable: ${sess.title}\n\n## Final Unified Blueprint\n${
      sess.finalSynthesisMarkdown
    }\n\n---\n\n${sess.turns.map((tn) => `## ${tn.agentRole}\n${tn.deliverableMarkdown}`).join('\n\n')}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VIP_MultiAgent_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.nav.multiAgent}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'فريق متكامل من 5 وكلاء متخصصين يتعاونون خطوة بخطوة لتسليم مشروع شامل ومترابط'
              : 'Five specialized AI agents (Researcher, Architect, Designer, Engineer, QA) collaborating into a unified blueprint'}
          </p>
        </div>

        {session && (
          <button
            type="button"
            onClick={() => exportDeliverable(session)}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? 'تصدير المخرجات (.md)' : 'Export Blueprint (.md)'}</span>
          </button>
        )}
      </div>

      {/* Team Roles Strip & Launch Input */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {AGENT_ROLES.map((r) => {
            const done = session?.turns.some((tn) => tn.agentRole === r.role);
            const active = runningRole === r.role;
            return (
              <div
                key={r.role}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 ${
                  active
                    ? 'border-blue-500 bg-blue-600/15 text-blue-500'
                    : done
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                {active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Users className={`w-3.5 h-3.5 ${r.color}`} />}
                <span>{isAr ? r.labelAr : r.role}</span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            rows={2}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder={
              isAr
                ? 'أدخل هدف المشروع الكامل ليتعاون عليه الوكلاء الخمسة (مثال: بناء منصة تعلم لغات مع تتبع التقدم والاختبارات)...'
                : 'Describe the project objective for all 5 agents to research, architect, design, build, and QA...'
            }
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm"
          />
          <button
            type="button"
            onClick={handleRunFullTeam}
            disabled={Boolean(runningRole) || !objective.trim()}
            className="sm:self-end px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {runningRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>{runningRole ? runningRole : isAr ? 'تشغيل فريق الوكلاء' : 'Launch Multi-Agent Team'}</span>
          </button>
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-4">
          {session ? (
            <>
              {session.finalSynthesisMarkdown && (
                <div className="rounded-xl border-2 border-blue-500/40 bg-blue-600/5 p-5 space-y-2">
                  <h3 className="font-display font-bold text-base flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Sparkles className="w-4 h-4" />
                    <span>{isAr ? 'النتيجة الموحدة النهائية' : 'Unified Final Team Blueprint'}</span>
                  </h3>
                  <pre className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                    {session.finalSynthesisMarkdown}
                  </pre>
                </div>
              )}

              {session.turns.map((turn) => (
                <div
                  key={turn.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-display font-bold text-sm text-blue-600 dark:text-blue-400">{turn.agentRole}</h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(turn.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{turn.summary}</p>
                  <pre className="whitespace-pre-wrap text-xs bg-slate-50 dark:bg-[#0B0E14] border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 max-h-64 overflow-y-auto leading-relaxed">
                    {turn.deliverableMarkdown}
                  </pre>
                </div>
              ))}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-2 text-xs text-slate-500">
              <Users className="w-8 h-8 mx-auto text-slate-400" />
              <p>{isAr ? 'أطلق فريق الوكلاء الخمسة أعلاه لبناء مشروع كامل عبر أدوار متعددة.' : 'Enter an objective above to orchestrate Researcher, Architect, Designer, Engineer & QA together.'}</p>
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
          <h4 className="font-display font-semibold text-sm">{isAr ? 'جلسات الفريق' : 'Team Sessions'}</h4>
          {multiAgentSessions.length === 0 ? (
            <p className="text-xs text-slate-500">{t.common.empty}</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {multiAgentSessions.map((ms) => (
                <div
                  key={ms.id}
                  onClick={() => setSession(ms)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between gap-2 text-xs ${
                    session?.id === ms.id ? 'border-blue-500 bg-blue-600/10' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{ms.title}</p>
                    <p className="text-[11px] text-slate-500">{ms.turns.length}/5 agents</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMultiAgentSessions((prev) => prev.filter((x) => x.id !== ms.id));
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
