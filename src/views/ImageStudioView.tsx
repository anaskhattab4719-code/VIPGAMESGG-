import React, { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Wand2,
  Download,
  Upload,
  Trash2,
  Loader2,
  SlidersHorizontal,
  RotateCcw,
  Eraser,
  X,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { ImageHistoryItem } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

export function ImageStudioView() {
  const { t, settings, imageHistory, setImageHistory, logActivity } = useVip();

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<'realistic' | 'cartoon' | '3d' | 'character' | 'background'>('realistic');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '3:4' | '4:3' | '9:16' | '16:9'>('1:1');
  const [quality, setQuality] = useState<'standard' | '1K' | '2K' | '4K'>('standard');
  const [refImage, setRefImage] = useState<{ base64: string; mimeType: string; url: string } | null>(null);

  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Real Client-Side Canvas Image Editor & Enhancer
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(
    imageHistory[0]?.imageDataUrl || null
  );
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [crispness, setCrispness] = useState(0); // 0 = normal, 1 = subtle sepia/warmth, 2 = B&W high contrast
  const [removeBg, setRemoveBg] = useState(false);
  const [bgThreshold, setBgThreshold] = useState(38);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const refUploadRef = useRef<HTMLInputElement | null>(null);
  const editUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!activeImageUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxW = 900;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const filterParts = [
        `brightness(${brightness}%)`,
        `contrast(${contrast + crispness * 8}%)`,
        `saturate(${crispness === 2 ? 0 : saturation}%)`,
      ];
      if (crispness === 1) filterParts.push('sepia(25%)');

      ctx.filter = filterParts.join(' ');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';

      if (removeBg && canvas.width > 4 && canvas.height > 4) {
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = frame.data;
        const w = canvas.width;
        const h = canvas.height;
        // Sample average color from the 4 image corners
        const corners = [
          0,
          (w - 1) * 4,
          (h - 1) * w * 4,
          ((h - 1) * w + (w - 1)) * 4,
        ];
        let kr = 0;
        let kg = 0;
        let kb = 0;
        for (const c of corners) {
          kr += d[c];
          kg += d[c + 1];
          kb += d[c + 2];
        }
        kr /= 4;
        kg /= 4;
        kb /= 4;

        const maxDist = bgThreshold * 2.2;
        for (let i = 0; i < d.length; i += 4) {
          const dist = Math.hypot(d[i] - kr, d[i + 1] - kg, d[i + 2] - kb);
          if (dist < maxDist) {
            const softEdge = Math.max(0, Math.min(1, (dist - maxDist * 0.65) / (maxDist * 0.35 + 1)));
            d[i + 3] = Math.round(d[i + 3] * softEdge);
          }
        }
        ctx.putImageData(frame, 0, 0);
      }
    };
    img.src = activeImageUrl;
  }, [activeImageUrl, brightness, contrast, saturation, crispness, removeBg, bgThreshold]);

  const handleUploadReference = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      const base64 = url.includes(',') ? url.split(',')[1] : url;
      setRefImage({ base64, mimeType: file.type, url });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUploadToEditor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      setActiveImageUrl(url);
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setCrispness(0);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/ai/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style,
          aspectRatio,
          quality,
          referenceImageBase64: refImage?.base64,
          referenceMimeType: refImage?.mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Image generation failed');
        setErrorCode(data.code || null);
        return;
      }

      const item: ImageHistoryItem = {
        id: `img_${Date.now()}`,
        prompt: prompt.trim(),
        style,
        aspectRatio,
        quality,
        imageDataUrl: data.imageDataUrl,
        createdAt: new Date().toISOString(),
      };
      setImageHistory((prev) => [item, ...prev]);
      setActiveImageUrl(data.imageDataUrl);
      logActivity('Generated AI Image', prompt.trim().slice(0, 40));
      playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  };

  const exportEditedCanvas = (format: 'image/png' | 'image/jpeg') => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL(format, 0.92);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `vip_ai_image.${format === 'image/png' ? 'png' : 'jpg'}`;
    a.click();
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
          {t.image.title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t.image.subtitle}
        </p>
      </div>

      {/* Generator Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-3">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.image.promptPlaceholder}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={refUploadRef}
                type="file"
                accept="image/*"
                onChange={handleUploadReference}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => refUploadRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t.image.referenceImage}</span>
              </button>

              {refImage && (
                <div className="flex items-center gap-2">
                  <img
                    src={refImage.url}
                    alt="Reference"
                    className="w-8 h-8 rounded object-cover border border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => setRefImage(null)}
                    className="text-xs text-rose-500 inline-flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    {t.image.clearRef}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t.image.style}
              </label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as typeof style)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
              >
                {Object.entries(t.image.styles).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t.image.aspect}
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as typeof aspectRatio)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
              >
                {['1:1', '16:9', '9:16', '4:3', '3:4'].map((ar) => (
                  <option key={ar} value={ar}>
                    {ar}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {t.image.quality}
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as typeof quality)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
              >
                <option value="standard">Standard</option>
                <option value="1K">1K Pro</option>
                <option value="2K">2K Pro</option>
                <option value="4K">4K Ultra</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !prompt.trim()}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                <span>{t.image.generate}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} onRetry={handleGenerate} />}

      {/* Canvas Editor & Enhancer + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display font-semibold text-sm flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-500" />
              <span>{t.image.editorTitle}</span>
            </h3>

            <div className="flex items-center gap-2">
              <input
                ref={editUploadRef}
                type="file"
                accept="image/*"
                onChange={handleUploadToEditor}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => editUploadRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t.image.uploadToEdit}</span>
              </button>
              {activeImageUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => exportEditedCanvas('image/png')}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.image.exportPng}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportEditedCanvas('image/jpeg')}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
                  >
                    {t.image.exportJpg}
                  </button>
                </>
              )}
            </div>
          </div>

          {activeImageUrl ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 flex items-center justify-center min-h-[260px]">
                <canvas ref={canvasRef} className="max-w-full max-h-[420px] rounded-lg" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span>{t.image.brightness}</span>
                    <span className="font-mono tabular-nums">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={180}
                    value={brightness}
                    onChange={(e) => setBrightness(Number(e.target.value))}
                    className="w-full"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span>{t.image.contrast}</span>
                    <span className="font-mono tabular-nums">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={180}
                    value={contrast}
                    onChange={(e) => setContrast(Number(e.target.value))}
                    className="w-full"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span>{t.image.saturation}</span>
                    <span className="font-mono tabular-nums">{saturation}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    value={saturation}
                    onChange={(e) => setSaturation(Number(e.target.value))}
                    className="w-full"
                  />
                </label>

                <div className="flex items-end gap-2">
                  <select
                    value={crispness}
                    onChange={(e) => setCrispness(Number(e.target.value))}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-xs"
                  >
                    <option value={0}>Natural</option>
                    <option value={1}>Warm Studio</option>
                    <option value={2}>Noir B&amp;W</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setBrightness(100);
                      setContrast(100);
                      setSaturation(100);
                      setCrispness(0);
                      setRemoveBg(false);
                    }}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700"
                    title={t.common.reset}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Background Removal Matte Tool */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => setRemoveBg((v) => !v)}
                  className={`px-3 py-1.5 rounded-lg border font-medium inline-flex items-center gap-1.5 ${
                    removeBg
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>{t.image.removeBg}</span>
                </button>

                {removeBg && (
                  <label className="flex items-center gap-3 flex-1 min-w-[200px] max-w-sm">
                    <span className="text-slate-500 whitespace-nowrap">{t.image.bgThreshold}</span>
                    <input
                      type="range"
                      min={10}
                      max={95}
                      value={bgThreshold}
                      onChange={(e) => setBgThreshold(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="font-mono tabular-nums w-7 text-end">{bgThreshold}</span>
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div className="h-64 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-500">
              <ImageIcon className="w-8 h-8 opacity-60" />
              <p className="text-xs">{t.common.empty}</p>
            </div>
          )}
        </div>

        {/* Image History */}
        <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
          <h3 className="font-display font-semibold text-sm">{t.image.history}</h3>
          {imageHistory.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.common.empty}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 max-h-[460px] overflow-y-auto">
              {imageHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setActiveImageUrl(item.imageDataUrl)}
                  className="group relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 cursor-pointer"
                >
                  <img
                    src={item.imageDataUrl}
                    alt={item.prompt}
                    referrerPolicy="no-referrer"
                    className="w-full h-28 object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageHistory((prev) => prev.filter((x) => x.id !== item.id));
                    }}
                    className="absolute top-1.5 right-1.5 p-1 rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={t.common.delete}
                  >
                    <Trash2 className="w-3 h-3" />
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
