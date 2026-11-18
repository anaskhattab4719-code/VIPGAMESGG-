import React, { useState, useRef } from 'react';
import {
  Volume2,
  Mic,
  MicOff,
  Upload,
  Music,
  Waves,
  Download,
  Loader2,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { AudioHistoryItem } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound, SfxPreset, synthesizeSfxWav } from '../utils/soundFx';

export function AudioStudioView() {
  const { t, settings, audioHistory, setAudioHistory } = useVip();

  const [tab, setTab] = useState<'tts' | 'stt' | 'sfx' | 'music'>('tts');

  // TTS state
  const [ttsMode, setTtsMode] = useState<'single' | 'dialogue'>('single');
  const [ttsText, setTtsText] = useState('');
  const [secondText, setSecondText] = useState('');
  const [voiceName, setVoiceName] = useState<'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr'>('Kore');
  const [secondVoice, setSecondVoice] = useState<'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr'>('Puck');
  const [styleHint, setStyleHint] = useState('Warm, expressive studio narrator');
  const [ttsLoading, setTtsLoading] = useState(false);

  // STT state
  const [isRecording, setIsRecording] = useState(false);
  const [sttLoading, setSttLoading] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUploadRef = useRef<HTMLInputElement | null>(null);

  // SFX state
  const [sfxPreset, setSfxPreset] = useState<SfxPreset>('laser');
  const [sfxPitch, setSfxPitch] = useState(1.0);
  const [sfxDuration, setSfxDuration] = useState(1.0);
  const [sfxUrl, setSfxUrl] = useState<string | null>(null);

  // Music state
  const [musicPrompt, setMusicPrompt] = useState('');
  const [musicMode, setMusicMode] = useState<'clip' | 'pro'>('clip');
  const [musicLoading, setMusicLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleGenerateTts = async () => {
    if (!ttsText.trim() || ttsLoading) return;
    setTtsLoading(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/ai/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ttsText,
          voiceName,
          style: styleHint,
          mode: ttsMode,
          secondSpeakerText: secondText,
          secondVoiceName: secondVoice,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'TTS failed');
        setErrorCode(data.code || null);
        return;
      }

      const item: AudioHistoryItem = {
        id: `aud_${Date.now()}`,
        kind: 'tts',
        title: ttsText.slice(0, 42),
        audioDataUrl: data.audioDataUrl,
        createdAt: new Date().toISOString(),
      };
      setAudioHistory((prev) => [item, ...prev]);
      playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setTtsLoading(false);
    }
  };

  const transcribeBase64 = async (audioBase64: string, mimeType: string) => {
    setSttLoading(true);
    setErrorMsg(null);
    setErrorCode(null);
    try {
      const res = await fetch('/api/ai/audio/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType, language: settings.language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Transcription failed');
        setErrorCode(data.code || null);
        return;
      }
      setTranscript(data.transcript || '');
      const item: AudioHistoryItem = {
        id: `aud_${Date.now()}`,
        kind: 'transcript',
        title: (data.transcript || 'Transcript').slice(0, 42),
        transcript: data.transcript,
        createdAt: new Date().toISOString(),
      };
      setAudioHistory((prev) => [item, ...prev]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSttLoading(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const url = String(reader.result || '');
          const base64 = url.includes(',') ? url.split(',')[1] : url;
          transcribeBase64(base64, 'audio/webm');
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setIsRecording(true);
    } catch {
      setErrorMsg('Microphone access denied or unavailable.');
    }
  };

  const handleUploadAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      const base64 = url.includes(',') ? url.split(',')[1] : url;
      transcribeBase64(base64, file.type || 'audio/mpeg');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSynthesizeSfx = () => {
    const dataUrl = synthesizeSfxWav(sfxPreset, sfxPitch, sfxDuration);
    setSfxUrl(dataUrl);
    const audio = new Audio(dataUrl);
    audio.volume = settings.soundVolume;
    audio.play().catch(() => {});

    const item: AudioHistoryItem = {
      id: `sfx_${Date.now()}`,
      kind: 'sfx',
      title: `${t.audio.sfxPresets[sfxPreset]} (${sfxPitch.toFixed(1)}x)`,
      audioDataUrl: dataUrl,
      createdAt: new Date().toISOString(),
    };
    setAudioHistory((prev) => [item, ...prev]);
  };

  const handleGenerateMusic = async () => {
    if (!musicPrompt.trim() || musicLoading) return;
    setMusicLoading(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/ai/audio/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: musicPrompt, mode: musicMode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Music generation failed');
        setErrorCode(data.code || null);
        return;
      }

      const item: AudioHistoryItem = {
        id: `mus_${Date.now()}`,
        kind: 'music',
        title: musicPrompt.slice(0, 40),
        audioDataUrl: data.audioDataUrl,
        lyrics: data.lyrics,
        createdAt: new Date().toISOString(),
      };
      setAudioHistory((prev) => [item, ...prev]);
      playUiSound('win', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setMusicLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.audio.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t.audio.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] overflow-x-auto">
          {(
            [
              { id: 'tts', icon: Volume2 },
              { id: 'stt', icon: Mic },
              { id: 'sfx', icon: Waves },
              { id: 'music', icon: Music },
            ] as const
          ).map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap ${
                tab === id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.audio.tabs[id]}</span>
            </button>
          ))}
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
          {/* TTS Tab */}
          {tab === 'tts' && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTtsMode('single')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    ttsMode === 'single'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.audio.singleMode}
                </button>
                <button
                  type="button"
                  onClick={() => setTtsMode('dialogue')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    ttsMode === 'dialogue'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.audio.dialogueMode}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">{t.audio.voice}</label>
                  <select
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value as typeof voiceName)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                  >
                    {['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {ttsMode === 'dialogue' ? (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Speaker B Voice</label>
                    <select
                      value={secondVoice}
                      onChange={(e) => setSecondVoice(e.target.value as typeof secondVoice)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                    >
                      {['Puck', 'Kore', 'Charon', 'Fenrir', 'Zephyr'].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">{t.audio.styleHint}</label>
                    <input
                      value={styleHint}
                      onChange={(e) => setStyleHint(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
                    />
                  </div>
                )}
              </div>

              <textarea
                rows={4}
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                placeholder="Enter narration or script..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-sm"
              />

              {ttsMode === 'dialogue' && (
                <textarea
                  rows={3}
                  value={secondText}
                  onChange={(e) => setSecondText(e.target.value)}
                  placeholder="Speaker B reply line..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-sm"
                />
              )}

              <button
                type="button"
                onClick={handleGenerateTts}
                disabled={ttsLoading || !ttsText.trim()}
                className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-2"
              >
                {ttsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                <span>{t.audio.generateSpeech}</span>
              </button>
            </>
          )}

          {/* STT Tab */}
          {tab === 'stt' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`px-4 py-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 ${
                    isRecording
                      ? 'bg-rose-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>{isRecording ? t.audio.stopRecording : t.audio.recordAudio}</span>
                </button>

                <input
                  ref={audioUploadRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleUploadAudio}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => audioUploadRef.current?.click()}
                  className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>{t.audio.uploadAudio}</span>
                </button>

                {sttLoading && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-blue-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.common.loading}</span>
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold">Transcript</span>
                  {transcript && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(transcript);
                        setCopiedTranscript(true);
                        setTimeout(() => setCopiedTranscript(false), 1500);
                      }}
                      className="text-xs inline-flex items-center gap-1 text-blue-500"
                    >
                      {copiedTranscript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedTranscript ? t.common.copied : t.common.copy}</span>
                    </button>
                  )}
                </div>
                <textarea
                  rows={6}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-sm"
                />
              </div>
            </div>
          )}

          {/* Procedural SFX Tab (100% Real Offline + Downloadable WAV) */}
          {tab === 'sfx' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1">{t.audio.sfxPreset}</label>
                  <select
                    value={sfxPreset}
                    onChange={(e) => setSfxPreset(e.target.value as SfxPreset)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                  >
                    {Object.entries(t.audio.sfxPresets).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span>Pitch</span>
                    <span className="font-mono tabular-nums">{sfxPitch.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    value={sfxPitch}
                    onChange={(e) => setSfxPitch(Number(e.target.value))}
                    className="w-full"
                  />
                </label>

                <label className="space-y-1">
                  <div className="flex justify-between">
                    <span>Duration</span>
                    <span className="font-mono tabular-nums">{sfxDuration.toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min={0.3}
                    max={3.0}
                    step={0.1}
                    value={sfxDuration}
                    onChange={(e) => setSfxDuration(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSynthesizeSfx}
                  className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-2"
                >
                  <Waves className="w-4 h-4" />
                  <span>{t.audio.generateSfx}</span>
                </button>
                {sfxUrl && (
                  <a
                    href={sfxUrl}
                    download={`vip_ai_${sfxPreset}.wav`}
                    className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.audio.downloadWav}</span>
                  </a>
                )}
              </div>

              {sfxUrl && <audio src={sfxUrl} controls className="w-full" />}
            </div>
          )}

          {/* Music Tab */}
          {tab === 'music' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMusicMode('clip')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    musicMode === 'clip'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  Lyria Clip (30s)
                </button>
                <button
                  type="button"
                  onClick={() => setMusicMode('pro')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    musicMode === 'pro'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  Lyria Pro (Full)
                </button>
              </div>

              <textarea
                rows={4}
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                placeholder={t.audio.musicPrompt}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-sm"
              />

              <button
                type="button"
                onClick={handleGenerateMusic}
                disabled={musicLoading || !musicPrompt.trim()}
                className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-2"
              >
                {musicLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Music className="w-4 h-4" />}
                <span>{t.audio.generateMusic}</span>
              </button>
            </div>
          )}
        </div>

        {/* Audio History */}
        <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
          <h3 className="font-display font-semibold text-sm">Audio Library</h3>
          {audioHistory.length === 0 ? (
            <p className="text-xs text-slate-500">{t.common.empty}</p>
          ) : (
            <div className="space-y-3 max-h-[460px] overflow-y-auto">
              {audioHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{item.title}</p>
                      <p className="text-[11px] text-slate-500 uppercase">{item.kind}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAudioHistory((prev) => prev.filter((x) => x.id !== item.id))
                      }
                      className="p-1 text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {item.audioDataUrl && (
                    <div className="space-y-1.5">
                      <audio src={item.audioDataUrl} controls className="w-full h-8" />
                      <a
                        href={item.audioDataUrl}
                        download={`${item.id}.wav`}
                        className="inline-flex items-center gap-1 text-[11px] text-blue-500 hover:underline"
                      >
                        <Download className="w-3 h-3" />
                        <span>{t.common.download}</span>
                      </a>
                    </div>
                  )}
                  {item.transcript && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3">
                      {item.transcript}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
