import React, { useState } from 'react';
import {
  GraduationCap,
  Sparkles,
  Award,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  BookOpen,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { AcademyLesson } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

export function AcademyView() {
  const { t, settings, academyLessons, setAcademyLessons, academyXp, setAcademyXp, logActivity, triggerMascot } =
    useVip();
  const isAr = settings.language === 'ar';

  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [lesson, setLesson] = useState<AcademyLesson | null>(academyLessons[0] || null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizChecked, setQuizChecked] = useState(false);
  const [exerciseCode, setExerciseCode] = useState(academyLessons[0]?.starterCode || '');
  const [gradeResult, setGradeResult] = useState<{
    passed: boolean;
    score: number;
    feedbackMarkdown: string;
    improvedHint: string;
  } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [grading, setGrading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleGenerateLesson = async () => {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    setErrorMsg(null);
    setErrorCode(null);
    setQuizChecked(false);
    setAnswers({});
    setGradeResult(null);

    try {
      const res = await fetch('/api/ai/academy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, level, language: settings.language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Lesson generation failed');
        setErrorCode(data.code || null);
        return;
      }

      const raw = data.lesson || {};
      const nextLesson: AcademyLesson = {
        id: `les_${Date.now()}`,
        topic: topic.trim(),
        level,
        title: raw.title || topic.trim(),
        overview: raw.overview || '',
        sections: Array.isArray(raw.sections) ? raw.sections : [],
        quiz: (Array.isArray(raw.quiz) ? raw.quiz : []).map((q: Record<string, unknown>, idx: number) => ({
          id: `q_${idx}`,
          question: String(q.question || ''),
          options: Array.isArray(q.options) ? q.options.map(String) : [],
          correctIndex: Number(q.correctIndex) || 0,
          explanation: String(q.explanation || ''),
        })),
        exercisePrompt: raw.exercisePrompt || '',
        starterCode: raw.starterCode || '',
        updatedAt: new Date().toISOString(),
      };
      setLesson(nextLesson);
      setExerciseCode(nextLesson.starterCode);
      setAcademyLessons((prev) => [nextLesson, ...prev]);
      logActivity('Started Academy Lesson', nextLesson.title);
      playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  };

  const handleCheckQuiz = () => {
    if (!lesson || lesson.quiz.length === 0) return;
    setQuizChecked(true);
    let correctCount = 0;
    lesson.quiz.forEach((q, idx) => {
      if (answers[idx] === q.correctIndex) correctCount += 1;
    });
    const scorePct = Math.round((correctCount / lesson.quiz.length) * 100);
    if (!lesson.completed) {
      const earned = Math.max(20, scorePct);
      setAcademyXp((xp) => xp + earned);
      const updated = { ...lesson, completed: true, quizScore: scorePct };
      setLesson(updated);
      setAcademyLessons((prev) => prev.map((l) => (l.id === lesson.id ? updated : l)));
      if (scorePct >= 66) {
        triggerMascot('celebrate', `${lesson.title} (${scorePct}%)`);
        playUiSound('win', settings.soundEnabled, settings.soundVolume);
      }
    }
  };

  const handleGradeExercise = async () => {
    if (!lesson || !exerciseCode.trim() || grading) return;
    setGrading(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/ai/academy/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercisePrompt: lesson.exercisePrompt,
          submission: exerciseCode,
          language: settings.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Grading failed');
        setErrorCode(data.code || null);
        return;
      }
      setGradeResult(data.evaluation);
      if (data.evaluation?.passed) {
        setAcademyXp((xp) => xp + 50);
        playUiSound('win', settings.soundEnabled, settings.soundVolume);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.nav.academy}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'دروس تفاعلية بالذكاء الاصطناعي، اختبارات فورية وتصحيح التمارين البرمجية مع تتبع التقدم'
              : 'Interactive AI courses, explanations, auto-graded quizzes & coding exercise evaluation'}
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold inline-flex items-center gap-2">
          <Award className="w-4 h-4" />
          <span className="font-mono tabular-nums">{academyXp} XP</span>
          <span>· {academyLessons.filter((l) => l.completed).length} {isAr ? 'درس مكتمل' : 'Completed'}</span>
        </div>
      </div>

      {/* Topic Generator */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerateLesson()}
          placeholder={
            isAr
              ? 'مثال: أساسيات TypeScript، خوارزميات الشطرنج Minimax، الإضاءة في Unreal Engine 5...'
              : 'Enter a topic to study (e.g. Async JavaScript, Linear Algebra for 3D Graphics, C++ Pointers)...'
          }
          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as 'Beginner' | 'Intermediate' | 'Advanced')}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-xs font-medium"
        >
          <option value="Beginner">{isAr ? 'مبتدئ' : 'Beginner'}</option>
          <option value="Intermediate">{isAr ? 'متوسط' : 'Intermediate'}</option>
          <option value="Advanced">{isAr ? 'متقدم' : 'Advanced'}</option>
        </select>
        <button
          type="button"
          onClick={handleGenerateLesson}
          disabled={generating || !topic.trim()}
          className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>{isAr ? 'إنشاء درس تفاعلي' : 'Start Lesson'}</span>
        </button>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">
          {lesson ? (
            <>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display font-bold text-lg">{lesson.title}</h3>
                  <span className="px-2.5 py-0.5 rounded bg-blue-600/10 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                    {lesson.level}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{lesson.overview}</p>

                <div className="space-y-4 pt-2">
                  {lesson.sections.map((sec, i) => (
                    <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-2">
                      <h4 className="font-display font-semibold text-sm flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-blue-500" />
                        <span>{sec.heading}</span>
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {sec.body}
                      </p>
                      {sec.codeExample && (
                        <pre dir="ltr" className="text-xs font-mono bg-slate-950 text-emerald-300 p-3 rounded-lg overflow-x-auto">
                          {sec.codeExample}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Quiz */}
              {lesson.quiz.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
                  <h4 className="font-display font-bold text-base">{isAr ? 'اختبار الفهم السريع' : 'Knowledge Check Quiz'}</h4>
                  <div className="space-y-4">
                    {lesson.quiz.map((q, qIdx) => (
                      <div key={q.id} className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-3 last:border-0">
                        <p className="text-sm font-semibold">
                          {qIdx + 1}. {q.question}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {q.options.map((opt, oIdx) => {
                            const selected = answers[qIdx] === oIdx;
                            const isCorrect = q.correctIndex === oIdx;
                            return (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => setAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))}
                                className={`text-start px-3 py-2 rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 ${
                                  quizChecked
                                    ? isCorrect
                                      ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                                      : selected
                                        ? 'border-rose-500 bg-rose-500/15 text-rose-500'
                                        : 'border-slate-200 dark:border-slate-800'
                                    : selected
                                      ? 'border-blue-500 bg-blue-600/10 font-semibold'
                                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                              >
                                <span>{opt}</span>
                                {quizChecked && isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                                {quizChecked && !isCorrect && selected && <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                        {quizChecked && <p className="text-xs text-slate-500">{q.explanation}</p>}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckQuiz}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                  >
                    {isAr ? 'تصحيح الاختبار وكسب XP' : 'Check Answers & Earn XP'}
                  </button>
                </div>
              )}

              {/* Hands-On Exercise */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-3">
                <h4 className="font-display font-bold text-base">{isAr ? 'التمرين التطبيقي' : 'Practical Exercise'}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300">{lesson.exercisePrompt}</p>
                <textarea
                  rows={6}
                  dir="ltr"
                  value={exerciseCode}
                  onChange={(e) => setExerciseCode(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 text-emerald-300 font-mono text-xs p-3.5"
                />
                <button
                  type="button"
                  onClick={handleGradeExercise}
                  disabled={grading || !exerciseCode.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  {grading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isAr ? 'تقييم الحل بالذكاء الاصطناعي' : 'Evaluate Solution'}</span>
                </button>
                {gradeResult && (
                  <div className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${gradeResult.passed ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
                    <p className="font-bold">
                      Score: {gradeResult.score}/100 — {gradeResult.passed ? (isAr ? 'ممتاز!' : 'Passed!') : isAr ? 'يحتاج تحسيناً' : 'Needs Revision'}
                    </p>
                    <p className="whitespace-pre-wrap">{gradeResult.feedbackMarkdown}</p>
                    {gradeResult.improvedHint && <p className="text-slate-500">{gradeResult.improvedHint}</p>}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3 text-xs text-slate-500">
              <GraduationCap className="w-8 h-8 mx-auto text-slate-400" />
              <p>{isAr ? 'اختر موضوعاً في الأعلى لتوليد درس تفاعلي كامل مع اختبار وتمرين عملي.' : 'Enter any programming, AI, math, or design topic above to generate a complete interactive course lesson.'}</p>
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
          <h4 className="font-display font-semibold text-sm">{isAr ? 'الدروس السابقة' : 'Saved Lessons'}</h4>
          {academyLessons.length === 0 ? (
            <p className="text-xs text-slate-500">{t.common.empty}</p>
          ) : (
            <div className="space-y-2 max-h-[460px] overflow-y-auto">
              {academyLessons.map((les) => (
                <div
                  key={les.id}
                  onClick={() => {
                    setLesson(les);
                    setExerciseCode(les.starterCode);
                    setQuizChecked(false);
                    setAnswers({});
                    setGradeResult(null);
                  }}
                  className={`p-3 rounded-lg border cursor-pointer text-xs ${
                    lesson?.id === les.id ? 'border-blue-500 bg-blue-600/10' : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <p className="font-semibold truncate">{les.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {les.level} {les.completed ? `· ✓ ${les.quizScore ?? 100}%` : ''}
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
