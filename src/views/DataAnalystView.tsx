import React, { useState, useRef, useMemo } from 'react';
import {
  BarChart3,
  Upload,
  Sparkles,
  Download,
  Loader2,
  AlertCircle,
  Table2,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { DataAnalysisReport, DataColumnProfile } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

const SAMPLE_CSV = `Region,Quarter,Revenue,Expenses,Customers
MENA,Q1,148000,62000,410
Europe,Q2,215000,98000,680
North America,Q3,312000,134000,920
Asia Pacific,Q4,264000,111000,795
Latin America,Q4,96000,45000,260`;

function parseDelimitedText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const splitLine = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === delimiter && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = splitLine(lines[0]).map((h, i) => h || `Column_${i + 1}`);
  const rows = lines.slice(1).map((line) => {
    const vals = splitLine(line);
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      rec[h] = vals[i] ?? '';
    });
    return rec;
  });
  return { headers, rows };
}

function profileColumns(headers: string[], rows: Record<string, string>[]): DataColumnProfile[] {
  return headers.map((col) => {
    const values = rows.map((r) => (r[col] ?? '').trim());
    const nonEmpty = values.filter(Boolean);
    const missingCount = values.length - nonEmpty.length;
    const uniqueCount = new Set(nonEmpty).size;
    const nums = nonEmpty.map((v) => Number(v.replace(/[$,%]/g, ''))).filter((n) => !Number.isNaN(n));
    const isNumeric = nonEmpty.length > 0 && nums.length / nonEmpty.length >= 0.75;

    if (isNumeric) {
      const sum = nums.reduce((a, b) => a + b, 0);
      return {
        name: col,
        type: 'numeric',
        nonEmptyCount: nonEmpty.length,
        missingCount,
        uniqueCount,
        min: Math.min(...nums),
        max: Math.max(...nums),
        sum,
        mean: sum / nums.length,
      };
    }

    const freq = new Map<string, number>();
    nonEmpty.forEach((v) => freq.set(v, (freq.get(v) || 0) + 1));
    const topValues = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, count]) => ({ label, count }));
    return {
      name: col,
      type: 'categorical',
      nonEmptyCount: nonEmpty.length,
      missingCount,
      uniqueCount,
      topValues,
    };
  });
}

const CHART_PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#EF4444'];

export function DataAnalystView() {
  const { t, settings, setDataReports, logActivity } = useVip();
  const isAr = settings.language === 'ar';

  const [datasetName, setDatasetName] = useState('Regional_Sales_Sample.csv');
  const [rawCsv, setRawCsv] = useState(SAMPLE_CSV);
  const [question, setQuestion] = useState('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'donut'>('bar');
  const [labelCol, setLabelCol] = useState('Region');
  const [valueCol, setValueCol] = useState('Revenue');
  const [report, setReport] = useState<DataAnalysisReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parseDelimitedText(rawCsv), [rawCsv]);
  const profiles = useMemo(() => profileColumns(parsed.headers, parsed.rows), [parsed.headers, parsed.rows]);

  const numericCols = profiles.filter((c) => c.type === 'numeric').map((c) => c.name);
  const effectiveLabelCol = parsed.headers.includes(labelCol) ? labelCol : parsed.headers[0] || '';
  const effectiveValueCol = parsed.headers.includes(valueCol) ? valueCol : numericCols[0] || parsed.headers[1] || '';

  const chartSeries = useMemo(() => {
    if (!effectiveLabelCol || !effectiveValueCol) return [];
    return parsed.rows.slice(0, 12).map((row) => ({
      label: row[effectiveLabelCol] || 'N/A',
      value: Number(String(row[effectiveValueCol] || '0').replace(/[$,%]/g, '')) || 0,
    }));
  }, [parsed.rows, effectiveLabelCol, effectiveValueCol]);

  const handleUploadCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setDatasetName(file.name);
    setRawCsv(text);
    const p = parseDelimitedText(text);
    const prof = profileColumns(p.headers, p.rows);
    const cat = prof.find((c) => c.type === 'categorical')?.name || p.headers[0] || '';
    const num = prof.find((c) => c.type === 'numeric')?.name || p.headers[1] || '';
    if (cat) setLabelCol(cat);
    if (num) setValueCol(num);
    e.target.value = '';
  };

  const handleAnalyze = async () => {
    if (parsed.rows.length === 0 || analyzing) return;
    setAnalyzing(true);
    setErrorMsg(null);
    setErrorCode(null);
    try {
      const res = await fetch('/api/ai/data/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetName,
          rowCount: parsed.rows.length,
          columnsSummary: profiles,
          sampleRows: parsed.rows.slice(0, 15),
          question: question.trim(),
          language: settings.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Analysis failed');
        setErrorCode(data.code || null);
        return;
      }

      const nextReport: DataAnalysisReport = {
        id: `data_${Date.now()}`,
        datasetName,
        rowCount: parsed.rows.length,
        columnCount: parsed.headers.length,
        columns: profiles,
        aiInsightsMarkdown: data.analysis?.aiInsightsMarkdown || '',
        anomalies: Array.isArray(data.analysis?.anomalies) ? data.analysis.anomalies : [],
        recommendations: Array.isArray(data.analysis?.recommendations) ? data.analysis.recommendations : [],
        chartLabelCol: effectiveLabelCol,
        chartValueCol: effectiveValueCol,
        updatedAt: new Date().toISOString(),
      };
      setReport(nextReport);
      setDataReports((prev) => [nextReport, ...prev]);
      logActivity('Analyzed Dataset', `${datasetName} (${parsed.rows.length} rows)`);
      playUiSound('win', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setAnalyzing(false);
    }
  };

  const exportMarkdownReport = () => {
    const md = `# Data Analysis Report: ${datasetName}\nRows: ${parsed.rows.length} | Columns: ${parsed.headers.length}\n\n## Insights\n${
      report?.aiInsightsMarkdown || 'Run AI Insights to populate narrative.'
    }\n\n## Anomalies\n${(report?.anomalies || []).map((a) => `- ${a}`).join('\n')}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${datasetName.replace(/\.\w+$/, '')}_Report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxVal = Math.max(1, ...chartSeries.map((d) => Math.abs(d.value)));
  const totalVal = Math.max(1, chartSeries.reduce((acc, d) => acc + Math.max(0, d.value), 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.nav.dataAnalyst}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'ارفع ملفات CSV/TSV، استكشف الإحصاءات التلقائية، ارسم المخططات البيانية واستخرج الرؤى والشذوذ'
              : 'Upload CSV/TSV datasets, profile numeric & categorical stats, render Bar/Line/Donut charts & AI anomalies'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Upload className="w-3.5 h-3.5 text-blue-500" />
            <span>{isAr ? 'رفع CSV / TSV' : 'Upload CSV / TSV'}</span>
          </button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleUploadCsv} className="hidden" />
          <button
            type="button"
            onClick={exportMarkdownReport}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? 'تصدير التقرير (.md)' : 'Export Report (.md)'}</span>
          </button>
        </div>
      </div>

      {/* Dataset Input + AI Question */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6 space-y-2">
          <div className="flex justify-between text-xs font-semibold">
            <span>{datasetName}</span>
            <span className="font-mono text-slate-500">
              {parsed.rows.length} rows × {parsed.headers.length} cols
            </span>
          </div>
          <textarea
            rows={5}
            dir="ltr"
            value={rawCsv}
            onChange={(e) => setRawCsv(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 font-mono text-xs"
          />
        </div>

        <div className="lg:col-span-6 space-y-3 flex flex-col justify-between">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">{isAr ? 'نوع الرسم' : 'Chart'}</label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as 'bar' | 'line' | 'donut')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2"
              >
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="donut">Donut Chart</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">{isAr ? 'المحور (X)' : 'Label Col'}</label>
              <select
                value={effectiveLabelCol}
                onChange={(e) => setLabelCol(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2"
              >
                {parsed.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">{isAr ? 'القيمة (Y)' : 'Value Col'}</label>
              <select
                value={effectiveValueCol}
                onChange={(e) => setValueCol(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2"
              >
                {parsed.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={isAr ? 'سؤال محدد عن البيانات (اختياري)...' : 'Optional specific question about this dataset...'}
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || parsed.rows.length === 0}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{isAr ? 'تحليل ذكي للبيانات' : 'Generate AI Insights'}</span>
            </button>
          </div>
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      {/* Interactive SVG Visualization + Profiling Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              <span>
                {effectiveValueCol} by {effectiveLabelCol}
              </span>
            </span>
          </div>

          {chartSeries.length > 0 && chartType === 'bar' && (
            <svg viewBox="0 0 560 240" className="w-full h-60 overflow-visible">
              {chartSeries.map((pt, idx) => {
                const barW = Math.max(18, Math.floor(460 / chartSeries.length) - 10);
                const gap = Math.floor(500 / chartSeries.length);
                const barH = Math.max(4, (Math.abs(pt.value) / maxVal) * 170);
                const x = 40 + idx * gap;
                const y = 195 - barH;
                return (
                  <g key={idx}>
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx={4}
                      fill={CHART_PALETTE[idx % CHART_PALETTE.length]}
                    />
                    <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.8}>
                      {pt.value.toLocaleString()}
                    </text>
                    <text x={x + barW / 2} y={215} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.65}>
                      {pt.label.slice(0, 10)}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {chartSeries.length > 0 && chartType === 'line' && (
            <svg viewBox="0 0 560 240" className="w-full h-60 overflow-visible">
              <polyline
                fill="none"
                stroke="#3B82F6"
                strokeWidth="3"
                points={chartSeries
                  .map((pt, idx) => {
                    const x = 45 + (idx * 470) / Math.max(1, chartSeries.length - 1);
                    const y = 195 - (Math.abs(pt.value) / maxVal) * 165;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
              {chartSeries.map((pt, idx) => {
                const x = 45 + (idx * 470) / Math.max(1, chartSeries.length - 1);
                const y = 195 - (Math.abs(pt.value) / maxVal) * 165;
                return (
                  <g key={idx}>
                    <circle cx={x} cy={y} r={5} fill="#3B82F6" />
                    <text x={x} y={y - 10} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.85}>
                      {pt.value.toLocaleString()}
                    </text>
                    <text x={x} y={216} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.65}>
                      {pt.label.slice(0, 10)}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {chartSeries.length > 0 && chartType === 'donut' && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
              <svg viewBox="0 0 180 180" className="w-44 h-44 shrink-0 -rotate-90">
                {(() => {
                  let offset = 0;
                  const radius = 64;
                  const circumference = 2 * Math.PI * radius;
                  return chartSeries.map((pt, idx) => {
                    const pct = Math.max(0, pt.value) / totalVal;
                    const dash = pct * circumference;
                    const el = (
                      <circle
                        key={idx}
                        cx={90}
                        cy={90}
                        r={radius}
                        fill="transparent"
                        stroke={CHART_PALETTE[idx % CHART_PALETTE.length]}
                        strokeWidth={24}
                        strokeDasharray={`${dash} ${circumference - dash}`}
                        strokeDashoffset={-offset}
                      />
                    );
                    offset += dash;
                    return el;
                  });
                })()}
              </svg>
              <div className="space-y-1.5 text-xs">
                {chartSeries.map((pt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-xs shrink-0" style={{ background: CHART_PALETTE[idx % CHART_PALETTE.length] }} />
                    <span className="font-medium">{pt.label}</span>
                    <span className="font-mono text-slate-500">({pt.value.toLocaleString()})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Client-Side Column Profiling */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3">
          <h4 className="font-display font-semibold text-sm flex items-center gap-2">
            <Table2 className="w-4 h-4 text-blue-500" />
            <span>{isAr ? 'إحصاءات الأعمدة المباشرة' : 'Column Statistical Profile'}</span>
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto text-xs">
            {profiles.map((col) => (
              <div key={col.name} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>{col.name}</span>
                  <span className="font-mono text-[10px] uppercase text-blue-500">{col.type}</span>
                </div>
                {col.type === 'numeric' ? (
                  <p className="font-mono text-[11px] text-slate-500">
                    Min: {col.min?.toFixed(1)} · Mean: {col.mean?.toFixed(1)} · Max: {col.max?.toFixed(1)} · Sum: {col.sum?.toLocaleString()}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Unique: {col.uniqueCount} · Missing: {col.missingCount}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights & Anomaly Detection */}
      {report && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          <div className="md:col-span-7 space-y-2">
            <h4 className="font-display font-bold text-sm">{isAr ? 'التقرير التحليلي' : 'AI Analytical Summary'}</h4>
            <div className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {report.aiInsightsMarkdown}
            </div>
          </div>
          <div className="md:col-span-5 space-y-4">
            {report.anomalies.length > 0 && (
              <div className="space-y-1.5">
                <h5 className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{isAr ? 'الشذوذ والملاحظات' : 'Detected Anomalies'}</span>
                </h5>
                <ul className="list-disc ps-4 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  {report.anomalies.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.recommendations.length > 0 && (
              <div className="space-y-1.5">
                <h5 className="text-xs font-semibold text-emerald-500">{isAr ? 'التوصيات' : 'Recommendations'}</h5>
                <ul className="list-disc ps-4 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  {report.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
