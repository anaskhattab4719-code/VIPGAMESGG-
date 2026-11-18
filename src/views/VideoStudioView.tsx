import React, { useState, useRef, useEffect } from 'react';
import {
  Film,
  Clapperboard,
  Subtitles,
  Mic,
  Volume2,
  Download,
  Loader2,
  Upload,
  Trash2,
  X,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { VideoProject } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound, SfxPreset, synthesizeSfxWav } from '../utils/soundFx';

function formatSrtTime(sec: number): string {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function VideoStudioView() {
  const {
    t,
    settings,
    videoProjects,
    setVideoProjects,
    pendingTemplatePrompt,
    setPendingTemplatePrompt,
    logActivity,
  } = useVip();

  const [tab, setTab] = useState<'storyboard' | 'generator' | 'history'>('storyboard');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('Cinematic');
  const [transition, setTransition] = useState<'Crossfade' | 'Cut' | 'Dip to Black' | 'Slide'>('Crossfade');
  const [durationSec, setDurationSec] = useState(12);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [resolution, setResolution] = useState<'360p' | '720p' | '1080p'>('720p');
  const [refFrame, setRefFrame] = useState<{ base64: string; mimeType: string; url: string } | null>(null);
  const [sfxPreset, setSfxPreset] = useState<SfxPreset>('chime');

  const [activeProject, setActiveProject] = useState<VideoProject | null>(
    videoProjects[0] || null
  );
  const [loadingStoryboard, setLoadingStoryboard] = useState(false);
  const [loadingVo, setLoadingVo] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const frameUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (pendingTemplatePrompt?.section === 'video') {
      setPrompt(pendingTemplatePrompt.prompt);
      setPendingTemplatePrompt(null);
    }
  }, [pendingTemplatePrompt, setPendingTemplatePrompt]);

  const handleFrameUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      const base64 = url.includes(',') ? url.split(',')[1] : url;
      setRefFrame({ base64, mimeType: file.type, url });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const generateStoryboard = async () => {
    if (!prompt.trim() || loadingStoryboard) return;
    setLoadingStoryboard(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/ai/video/storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style,
          durationSec,
          transition,
          language: settings.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to plan storyboard');
        setErrorCode(data.code || null);
        return;
      }

      const created: VideoProject = {
        id: `vid_${Date.now()}`,
        title: data.storyboard.title || prompt.slice(0, 40),
        style: data.storyboard.style || style,
        transition,
        voiceoverScript: data.storyboard.voiceoverScript || '',
        scenes: data.storyboard.scenes || [],
        createdAt: new Date().toISOString(),
      };
      setActiveProject(created);
      setVideoProjects((prev) => [created, ...prev]);
      logActivity('Planned Video Storyboard', created.title);
      playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoadingStoryboard(false);
    }
  };

  const attachProceduralSfx = () => {
    if (!activeProject) return;
    const sfxDataUrl = synthesizeSfxWav(sfxPreset, 1, 1.4);
    const updated = { ...activeProject, sfxDataUrl };
    setActiveProject(updated);
    setVideoProjects((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    playUiSound('pop', settings.soundEnabled, settings.soundVolume);
  };

  const generateVoiceover = async () => {
    if (!activeProject?.voiceoverScript || loadingVo) return;
    setLoadingVo(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/ai/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: activeProject.voiceoverScript,
          voiceName: 'Charon',
          style: 'Cinematic documentary trailer voice-over',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Voice-over failed');
        setErrorCode(data.code || null);
        return;
      }
      const updated = { ...activeProject, audioDataUrl: data.audioDataUrl };
      setActiveProject(updated);
      setVideoProjects((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoadingVo(false);
    }
  };

  const generateRealVideo = async () => {
    if (!prompt.trim() || loadingVideo) return;
    setLoadingVideo(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const clampedDur = Math.max(3, Math.min(15, durationSec));
      const res = await fetch('/api/ai/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style,
          aspectRatio,
          duration: `${clampedDur}s`,
          resolution,
          imageBase64: refFrame?.base64,
          imageMimeType: refFrame?.mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Video generation failed');
        setErrorCode(data.code || null);
        return;
      }

      const created: VideoProject = activeProject
        ? { ...activeProject, videoDataUrl: data.videoDataUrl }
        : {
            id: `vid_${Date.now()}`,
            title: prompt.slice(0, 40),
            style,
            voiceoverScript: '',
            scenes: [],
            videoDataUrl: data.videoDataUrl,
            createdAt: new Date().toISOString(),
          };
      setActiveProject(created);
      setVideoProjects((prev) => {
        const exists = prev.some((v) => v.id === created.id);
        return exists ? prev.map((v) => (v.id === created.id ? created : v)) : [created, ...prev];
      });
      playUiSound('win', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoadingVideo(false);
    }
  };

  const downloadSrt = () => {
    if (!activeProject || activeProject.scenes.length === 0) return;
    const srt = activeProject.scenes
      .map(
        (sc, i) =>
          `${i + 1}\n${formatSrtTime(sc.startSec)} --> ${formatSrtTime(sc.endSec)}\n${sc.subtitleText}\n`
      )
      .join('\n');
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.title.replace(/\s+/g, '_')}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.video.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t.video.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] overflow-x-auto">
          {(['storyboard', 'generator', 'history'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab === k
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t.video.tabs[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt & Settings Card */}
      {tab !== 'history' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 space-y-3">
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t.video.promptPlaceholder}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {tab === 'generator' && (
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    ref={frameUploadRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFrameUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => frameUploadRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t.video.refImage}</span>
                  </button>
                  {refFrame && (
                    <div className="flex items-center gap-2">
                      <img
                        src={refFrame.url}
                        alt="Starting frame"
                        className="w-9 h-9 rounded object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setRefFrame(null)}
                        className="text-xs text-rose-500 inline-flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        {t.common.clear}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t.video.style}</label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
                >
                  {['Cinematic', 'Documentary', '3D Animation', '1930s Ink', 'Commercial'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">{t.video.transition}</label>
                <select
                  value={transition}
                  onChange={(e) => setTransition(e.target.value as typeof transition)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
                >
                  <option value="Crossfade">Crossfade</option>
                  <option value="Cut">Hard Cut</option>
                  <option value="Dip to Black">Dip to Black</option>
                  <option value="Slide">Directional Slide</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">{t.video.aspect}</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
                >
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Vertical</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">{t.video.duration}</label>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs font-mono tabular-nums"
                />
              </div>

              {tab === 'generator' && (
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t.video.resolution}</label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as typeof resolution)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
                  >
                    <option value="360p">360p</option>
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                  </select>
                </div>
              )}

              <div className="col-span-2 sm:col-span-3 flex flex-wrap gap-2">
                {tab === 'storyboard' ? (
                  <button
                    type="button"
                    onClick={generateStoryboard}
                    disabled={loadingStoryboard || !prompt.trim()}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
                  >
                    {loadingStoryboard ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Clapperboard className="w-4 h-4" />
                    )}
                    <span>{t.video.generateStoryboard}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={generateRealVideo}
                    disabled={loadingVideo || !prompt.trim()}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
                  >
                    {loadingVideo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Film className="w-4 h-4" />
                    )}
                    <span>{t.video.generateVideo}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      {/* Active Storyboard / Video Output */}
      {tab !== 'history' && activeProject && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-base">{activeProject.title}</h3>
              <p className="text-xs text-slate-500">{activeProject.style}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeProject.voiceoverScript && (
                <button
                  type="button"
                  onClick={generateVoiceover}
                  disabled={loadingVo}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {loadingVo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{t.video.generateVoiceover}</span>
                </button>
              )}
              {activeProject.scenes.length > 0 && (
                <button
                  type="button"
                  onClick={downloadSrt}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Subtitles className="w-3.5 h-3.5" />
                  <span>{t.video.exportSrt}</span>
                </button>
              )}
              <div className="flex items-center gap-1.5">
                <select
                  value={sfxPreset}
                  onChange={(e) => setSfxPreset(e.target.value as SfxPreset)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-xs"
                >
                  {(['chime', 'laser', 'explosion', 'engine', 'sword', 'rain'] as const).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={attachProceduralSfx}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{t.video.attachSfx}</span>
                </button>
              </div>
            </div>
          </div>

          {activeProject.videoDataUrl && (
            <div className="space-y-2">
              <video
                src={activeProject.videoDataUrl}
                controls
                className="w-full max-h-[420px] rounded-xl bg-black border border-slate-800"
              />
              <a
                href={activeProject.videoDataUrl}
                download={`${activeProject.title.replace(/\s+/g, '_')}.mp4`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.common.download} MP4</span>
              </a>
            </div>
          )}

          {activeProject.audioDataUrl && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
              <audio src={activeProject.audioDataUrl} controls className="flex-1 min-w-[220px]" />
              <a
                href={activeProject.audioDataUrl}
                download="voiceover.wav"
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Voice-Over WAV</span>
              </a>
            </div>
          )}

          {activeProject.sfxDataUrl && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
              <audio src={activeProject.sfxDataUrl} controls className="flex-1 min-w-[220px]" />
              <a
                href={activeProject.sfxDataUrl}
                download="scene_sfx.wav"
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>SFX WAV</span>
              </a>
            </div>
          )}

          {activeProject.voiceoverScript && (
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs leading-relaxed">
              <p className="font-semibold mb-1">Narration Script</p>
              <p className="text-slate-600 dark:text-slate-300">{activeProject.voiceoverScript}</p>
            </div>
          )}

          {activeProject.scenes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeProject.scenes.map((sc) => (
                <div
                  key={sc.sceneNumber}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between font-mono text-[11px] text-blue-500 tabular-nums">
                    <span>Scene {sc.sceneNumber}</span>
                    <span>
                      {sc.startSec}s – {sc.endSec}s
                    </span>
                  </div>
                  <p className="font-medium text-slate-900 dark:text-white">{sc.visualPrompt}</p>
                  <p className="text-slate-500 dark:text-slate-400">Camera: {sc.cameraMotion}</p>
                  <p className="text-amber-600 dark:text-amber-400">“{sc.subtitleText}”</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-3">
          <h3 className="font-display font-semibold text-sm">{t.video.tabs.history}</h3>
          {videoProjects.length === 0 ? (
            <p className="text-xs text-slate-500">{t.common.empty}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {videoProjects.map((vp) => (
                <div
                  key={vp.id}
                  onClick={() => {
                    setActiveProject(vp);
                    setTab('storyboard');
                  }}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 cursor-pointer flex items-start justify-between gap-2"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold truncate">{vp.title}</p>
                    <p className="text-xs text-slate-500">
                      {vp.style} · {vp.scenes.length} scenes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVideoProjects((prev) => prev.filter((x) => x.id !== vp.id));
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-500"
                    aria-label={t.common.delete}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
