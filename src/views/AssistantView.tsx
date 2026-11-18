import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Send,
  Mic,
  MicOff,
  Paperclip,
  Volume2,
  Trash2,
  Edit3,
  Check,
  X,
  FileText,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { ChatAttachment, ChatMessage, Conversation } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AssistantView() {
  const {
    t,
    settings,
    conversations,
    setConversations,
    devProjects,
    gameProjects,
    threeDProjects,
    codeProjects,
    triggerMascot,
  } = useVip();

  const [activeId, setActiveId] = useState<string | null>(
    conversations[0]?.id || null
  );
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'general' | 'explain' | 'project'>('general');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeConv = conversations.find((c) => c.id === activeId) || null;

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages.length, isStreaming]);

  const createNewConversation = () => {
    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      title: settings.language === 'ar' ? 'محادثة جديدة' : 'New Conversation',
      mode,
      messages: [],
      updatedAt: new Date().toISOString(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newConv.id);
    setErrorMsg(null);
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
    }
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
  };

  const commitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c))
      );
    }
    setRenamingId(null);
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const next: ChatAttachment[] = [];

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const base64 = await fileToBase64(file);
        next.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          mimeType: file.type,
          data: base64,
          previewUrl: `data:${file.type};base64,${base64}`,
        });
      } else if (
        file.type === 'application/pdf' ||
        file.type.startsWith('audio/')
      ) {
        const base64 = await fileToBase64(file);
        next.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          mimeType: file.type,
          data: base64,
        });
      } else {
        const textContent = await file.text();
        next.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          mimeType: file.type || 'text/plain',
          textContent: textContent.slice(0, 40000),
        });
      }
    }
    setAttachments((prev) => [...prev, ...next]);
    e.target.value = '';
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if ((!text && attachments.length === 0) || isStreaming) return;

    setErrorMsg(null);
    setErrorCode(null);

    let targetConvId = activeId;
    if (!targetConvId) {
      const created: Conversation = {
        id: `conv_${Date.now()}`,
        title: text.slice(0, 38) || 'VIP AI Chat',
        mode,
        messages: [],
        updatedAt: new Date().toISOString(),
      };
      setConversations((prev) => [created, ...prev]);
      targetConvId = created.id;
      setActiveId(created.id);
    }

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    const assistantMsgId = `msg_${Date.now() + 1}`;
    const placeholderAssistant: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    const existingMsgs =
      conversations.find((c) => c.id === targetConvId)?.messages || [];
    const historyToSend = [...existingMsgs, userMessage];

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== targetConvId) return c;
        const shouldAutoTitle = c.messages.length === 0 && text.length > 0;
        return {
          ...c,
          title: shouldAutoTitle ? text.slice(0, 40) : c.title,
          mode,
          messages: [...c.messages, userMessage, placeholderAssistant],
          updatedAt: new Date().toISOString(),
        };
      })
    );

    if (!overrideText) setInput('');
    setAttachments([]);
    setIsStreaming(true);
    playUiSound('pop', settings.soundEnabled, settings.soundVolume);

    if (text.length > 4) {
      triggerMascot('chat_reaction', text.slice(0, 80));
    }

    const projectMemoryParts: string[] = [];
    if (devProjects.length > 0) {
      projectMemoryParts.push(
        `Developer Apps: ${devProjects.slice(0, 6).map((d) => `${d.name} (${d.targetType}, ${d.status})`).join('; ')}`
      );
    }
    if (gameProjects.length > 0) {
      projectMemoryParts.push(
        `UE5 Games: ${gameProjects.slice(0, 6).map((g) => `${g.title} (${g.dimension} ${g.genre})`).join('; ')}`
      );
    }
    if (threeDProjects.length > 0) {
      projectMemoryParts.push(
        `3D Assets: ${threeDProjects.slice(0, 6).map((m) => `${m.name} (${m.parts.length} parts)`).join('; ')}`
      );
    }
    if (codeProjects.length > 0) {
      projectMemoryParts.push(
        `Code Projects: ${codeProjects.slice(0, 6).map((c) => `${c.title} [${c.language}]`).join('; ')}`
      );
    }
    const projectMemory = projectMemoryParts.join('\n');

    try {
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyToSend.map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments?.map((a) => ({
              name: a.name,
              mimeType: a.mimeType,
              data: a.data,
              textContent: a.textContent,
            })),
          })),
          language: settings.language,
          mode,
          projectMemory,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Streaming reader unavailable');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          const payload = JSON.parse(jsonStr) as {
            text?: string;
            done?: boolean;
            error?: string;
            code?: string;
          };

          if (payload.error) {
            setErrorMsg(payload.error);
            setErrorCode(payload.code || null);
          } else if (payload.text) {
            accumulated += payload.text;
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id !== targetConvId) return c;
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === assistantMsgId ? { ...m, content: accumulated } : m
                  ),
                };
              })
            );
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Chat stream failed';
      setErrorMsg(msg);
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== targetConvId) return c;
          return {
            ...c,
            messages: c.messages.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: msg, error: true }
                : m
            ),
          };
        })
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const toggleVoiceInput = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // Prefer native Web SpeechRecognition for zero-latency dictation when supported
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rec = new SpeechRec() as any;
        rec.lang = settings.language === 'ar' ? 'ar-SA' : 'en-US';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        setIsRecording(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (ev: any) => {
          const transcript = ev.results?.[0]?.[0]?.transcript || '';
          if (transcript) {
            setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
          setIsRecording(false);
        };
        rec.onerror = () => setIsRecording(false);
        rec.onend = () => setIsRecording(false);
        rec.start();
        return;
      } catch {
        setIsRecording(false);
      }
    }

    // Fallback: record audio clip & send to Gemini 3.5 Transcribe
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          try {
            const res = await fetch('/api/ai/audio/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64,
                mimeType: 'audio/webm',
                language: settings.language,
              }),
            });
            const data = await res.json();
            if (res.ok && data.transcript) {
              setInput((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
            } else if (data.error) {
              setErrorMsg(data.error);
            }
          } catch {
            setErrorMsg('Failed to transcribe recorded audio.');
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setErrorMsg(t.assistant.micUnsupported);
    }
  };

  const speakMessage = async (msg: ChatMessage) => {
    if (speakingMsgId === msg.id) {
      activeAudioRef.current?.pause();
      window.speechSynthesis?.cancel();
      setSpeakingMsgId(null);
      return;
    }
    setSpeakingMsgId(msg.id);

    try {
      const res = await fetch('/api/ai/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: msg.content.slice(0, 1200),
          voiceName: 'Kore',
        }),
      });
      const data = await res.json();
      if (res.ok && data.audioDataUrl) {
        const audio = new Audio(data.audioDataUrl);
        audio.volume = settings.soundVolume;
        activeAudioRef.current = audio;
        audio.onended = () => setSpeakingMsgId(null);
        await audio.play();
        return;
      }
    } catch {
      // Fallback to Web Speech API
    }

    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(msg.content.slice(0, 1000));
      utter.lang = settings.language === 'ar' ? 'ar-SA' : 'en-US';
      utter.onend = () => setSpeakingMsgId(null);
      window.speechSynthesis.speak(utter);
    } else {
      setSpeakingMsgId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-8.5rem)] min-h-[560px]">
      {/* Conversation History Sidebar */}
      <aside className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t.assistant.conversations}
          </span>
          <button
            type="button"
            onClick={createNewConversation}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.assistant.newChat}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 p-4 text-center">
              {t.common.empty}
            </p>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeConv?.id;
              return (
                <div
                  key={conv.id}
                  className={`group rounded-lg px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300'
                  }`}
                  onClick={() => setActiveId(conv.id)}
                >
                  {renamingId === conv.id ? (
                    <div
                      className="flex items-center gap-1 flex-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && commitRename(conv.id)}
                        className="w-full px-2 py-1 text-xs rounded border border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => commitRename(conv.id)}
                        className="p-1 text-emerald-500"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="p-1 text-slate-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-medium truncate flex-1">{conv.title}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(conv.id);
                            setRenameValue(conv.title);
                          }}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                          aria-label={t.common.rename}
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conv.id);
                          }}
                          className="p-1 rounded hover:bg-rose-500/20 text-rose-500"
                          aria-label={t.common.delete}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Panel */}
      <section className="lg:col-span-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] flex flex-col overflow-hidden">
        {/* Mode Selector Header */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
            {(['general', 'explain', 'project'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  mode === m
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t.assistant.modes[m]}
              </button>
            ))}
          </div>
          {isStreaming && (
            <span className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{t.common.loading}</span>
            </span>
          )}
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

          {!activeConv || activeConv.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
                {t.assistant.emptyTitle}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.assistant.emptyDesc}
              </p>
            </div>
          ) : (
            activeConv.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : msg.error
                        ? 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {msg.attachments.map((att) =>
                        att.previewUrl ? (
                          <img
                            key={att.id}
                            src={att.previewUrl}
                            alt={att.name}
                            referrerPolicy="no-referrer"
                            className="w-28 h-28 object-cover rounded-lg border border-white/20"
                          />
                        ) : (
                          <div
                            key={att.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/15 text-xs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[140px]">{att.name}</span>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <div className="whitespace-pre-wrap break-words">
                    {msg.content || (isStreaming && msg.role === 'assistant' ? '...' : '')}
                  </div>

                  {msg.role === 'assistant' && msg.content && !msg.error && (
                    <div className="mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/60 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => speakMessage(msg)}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10 ${
                          speakingMsgId === msg.id ? 'text-blue-500' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{t.assistant.speakReply}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Attachment Preview Strip */}
        {attachments.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-900/50">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              >
                <span className="truncate max-w-[160px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachments((p) => p.filter((x) => x.id !== att.id))}
                  className="text-slate-400 hover:text-rose-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Composer Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.txt,.md,.json,.csv,.js,.ts,.tsx,.py,.cpp,.h,.cs,.java,.kt,.html,.css,.pdf"
            onChange={handleFileAttach}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            title={t.assistant.attachFile}
            aria-label={t.assistant.attachFile}
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`p-2.5 rounded-lg border shrink-0 transition-colors ${
              isRecording
                ? 'border-rose-500 bg-rose-500/15 text-rose-500'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={isRecording ? t.assistant.listening : t.assistant.voiceInput}
            aria-label={t.assistant.voiceInput}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={t.assistant.placeholder}
            className="flex-1 resize-none rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-36"
          />

          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={isStreaming || (!input.trim() && attachments.length === 0)}
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{t.assistant.send}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
