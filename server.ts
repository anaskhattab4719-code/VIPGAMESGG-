import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'vip_ai_store.json');
const USERS_FILE = path.join(DATA_DIR, 'vip_ai_users.json');
const SESSION_SECRET = process.env.SESSION_SECRET || 'vip_ai_local_session_secret_v2';

interface StoredUser {
  id: string;
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function signToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token?: string): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(`${userId}.${ts}`).digest('hex');
  if (sig.length !== expected.length) return null;
  const valid = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  return valid ? userId : null;
}

function classifyGeminiError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    lower.includes('permission_denied') ||
    lower.includes('403') ||
    lower.includes('billing') ||
    lower.includes('paid')
  ) {
    return {
      status: 403,
      code: 'PAID_KEY_REQUIRED',
      error:
        'This model requires a billing-enabled Gemini API key in AI Studio Settings > Secrets.',
      details: message,
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      error:
        'API quota exceeded or this model requires a paid tier API key in AI Studio Settings > Secrets.',
      details: message,
    };
  }
  if (lower.includes('api_key_invalid') || lower.includes('invalid api key')) {
    return {
      status: 400,
      code: 'API_KEY_INVALID',
      error: 'The configured GEMINI_API_KEY in Settings > Secrets is invalid.',
      details: message,
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      code: 'MODEL_UNAVAILABLE',
      error: 'The requested Gemini model endpoint is currently unavailable for this API key.',
      details: message,
    };
  }
  return {
    status: 500,
    code: 'AI_REQUEST_FAILED',
    error: message || 'An unexpected error occurred while contacting Gemini AI.',
    details: message,
  };
}

function safeParseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const startIdx = cleaned.indexOf('{');
    const endIdx = cleaned.lastIndexOf('}');
    if (startIdx >= 0 && endIdx > startIdx) {
      try {
        return JSON.parse(cleaned.slice(startIdx, endIdx + 1)) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tempFile = `${filePath}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tempFile, filePath);
}

async function startServer() {
  const app = express();

  // Secure CORS & Security Headers for Capacitor Android WebView & Web Clients
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = new Set([
      'https://localhost',
      'http://localhost',
      'capacitor://localhost',
      'https://ais-dev-w6m5aocjevp6x3vgl6yxg6-977857223551.europe-west2.run.app',
      'https://ais-pre-w6m5aocjevp6x3vgl6yxg6-977857223551.europe-west2.run.app',
    ]);
    if (
      origin &&
      (allowedOrigins.has(origin) ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('https://localhost:') ||
        origin.endsWith('.run.app'))
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const CREATOR_KNOWLEDGE_EN =
    'Creator Attribution: VIP AI was created, designed, and built by Anas Ali (أنس علي). Whenever the user asks who made you, who created you, who developed VIP AI, or who owns this platform, clearly state that Anas Ali made and created you.';
  const CREATOR_KNOWLEDGE_AR =
    'معلومة المُنشئ: تم تصميم وتطوير وإنشاء منصة VIP AI بواسطة أنس علي (Anas Ali). عندما يسألك المستخدم من صنعك أو من أنشأك أو من طوّر VIP AI، أجب بوضوح أن أنس علي (Anas Ali) هو الذي صنعك وأنشأك.';

  // Ensure PWA manifest.json and Service Worker sw.js always serve with standard headers
  app.use((req: Request, res: Response, next) => {
    if (req.path === '/manifest.json') {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
    } else if (req.path === '/sw.js') {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  });

  // Health & Quota Transparency
  app.get('/api/health', (_req: Request, res: Response) => {
    const key = process.env.GEMINI_API_KEY;
    const configured = Boolean(key && key !== 'MY_GEMINI_API_KEY');
    res.json({
      ok: true,
      app: 'VIP AI',
      creator: 'Anas Ali',
      geminiConfigured: configured,
      quotas: {
        freeTierReady: [
          'gemini-4-hydrogen (Chat, Developer Agent, UE5 Specs, 3D Blueprints, Storyboards)',
          'gemini-3.8-flash-lite-tts / gemini-3.8-flash-tts (Speech & Voice-Over)',
          'gemini-3.5-transcribe (Audio Transcription)',
        ],
        paidBillingRequired: [
          'gemini-3.1-flash-lite-image / gemini-nano-banana-2.1 (Image Generation)',
          'gemini-omni-1.2-flash (Video Generation)',
          'lyria-3-clip-preview / lyria-3-pro-preview (Music Generation)',
        ],
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Authentication Endpoints (Local Scoped Accounts with Scrypt Password Hashing)
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const { email, password, name, role = 'AI & App Creator' } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
    };
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password || password.length < 6) {
      res.status(400).json({ error: 'Valid email and password (min 6 chars) are required.' });
      return;
    }

    const users = await readJsonFile<StoredUser[]>(USERS_FILE, []);
    if (users.some((u) => u.email === cleanEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const newUser: StoredUser = {
      id: `usr_${Date.now()}`,
      email: cleanEmail,
      name: (name || cleanEmail.split('@')[0]).trim(),
      role,
      salt,
      passwordHash: hashPassword(password, salt),
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    await writeJsonFile(USERS_FILE, users);

    const token = signToken(newUser.id);
    res.json({
      ok: true,
      token,
      user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role },
    });
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = await readJsonFile<StoredUser[]>(USERS_FILE, []);
    const user = users.find((u) => u.email === cleanEmail);

    if (!user || !password || hashPassword(password, user.salt) !== user.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signToken(user.id);
    res.json({
      ok: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const userId = verifyToken(token);
    if (!userId) {
      res.json({ ok: true, user: null });
      return;
    }
    const users = await readJsonFile<StoredUser[]>(USERS_FILE, []);
    const user = users.find((u) => u.id === userId);
    res.json({
      ok: true,
      user: user ? { id: user.id, email: user.email, name: user.name, role: user.role } : null,
    });
  });

  // Scoped Workspace Store Routes
  function getStoreScopeKey(req: Request): string {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const userId = verifyToken(token);
    return userId || 'default';
  }

  app.get('/api/store', async (req: Request, res: Response) => {
    try {
      const scope = getStoreScopeKey(req);
      const allStores = await readJsonFile<Record<string, Record<string, unknown>>>(STORE_FILE, {});
      // Backward compatibility if flat store existed
      const data = allStores[scope] || (scope === 'default' && !allStores.default ? (allStores as unknown as Record<string, unknown>) : {});
      res.json({ ok: true, data });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Read error' });
    }
  });

  app.put('/api/store', async (req: Request, res: Response) => {
    try {
      const scope = getStoreScopeKey(req);
      const allStores = await readJsonFile<Record<string, Record<string, unknown>>>(STORE_FILE, {});
      const existingScope = allStores[scope] || {};
      const incoming = req.body && typeof req.body === 'object' ? req.body : {};
      allStores[scope] = { ...existingScope, ...incoming, updatedAt: new Date().toISOString() };
      await writeJsonFile(STORE_FILE, allStores);
      res.json({ ok: true, updatedAt: allStores[scope].updatedAt });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Write error' });
    }
  });

  app.delete('/api/store', async (req: Request, res: Response) => {
    try {
      const scope = getStoreScopeKey(req);
      const allStores = await readJsonFile<Record<string, Record<string, unknown>>>(STORE_FILE, {});
      allStores[scope] = {};
      await writeJsonFile(STORE_FILE, allStores);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Reset error' });
    }
  });

  // 1. Streaming AI Assistant Chat (with Project Memory Context)
  app.post('/api/ai/chat/stream', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({
        code: 'KEY_NOT_CONFIGURED',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const { messages, language = 'en', mode = 'general', projectMemory = '' } = req.body as {
      messages: Array<{
        role: 'user' | 'assistant';
        content: string;
        attachments?: Array<{ name: string; mimeType: string; data: string; textContent?: string }>;
      }>;
      language?: 'en' | 'ar';
      mode?: 'general' | 'explain' | 'project';
      projectMemory?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const memoryAddon = projectMemory
      ? `\n\n[User Workspace Project Memory — reference when helpful]:\n${projectMemory}`
      : '';

    const systemMap: Record<string, string> = {
      general:
        (language === 'ar'
          ? `أنت المساعد الرئيسي لمنصة VIP AI. أجب بدقة ووضوح واحترافية باللغة العربية أو لغة المستخدم، وتذكّر مشاريع المستخدم السابقة عند الإجابة.\n${CREATOR_KNOWLEDGE_AR}`
          : `You are the flagship AI Assistant inside VIP AI. Respond clearly, accurately, and execute multi-step reasoning cleanly.\n${CREATOR_KNOWLEDGE_EN}`) +
        memoryAddon,
      explain:
        (language === 'ar'
          ? `أنت معلّم خبير في VIP AI. اشرح المفاهيم المعقدة بأسلوب مبسط ومتدرج مع أمثلة واقعية.\n${CREATOR_KNOWLEDGE_AR}`
          : `You are an expert tutor inside VIP AI. Break down difficult subjects step-by-step with concrete examples.\n${CREATOR_KNOWLEDGE_EN}`) +
        memoryAddon,
      project:
        (language === 'ar'
          ? `أنت مهندس مشاريع ذكي في VIP AI. ساعد المستخدم في تخطيط المشاريع وهيكلة المهام والملفات والخطوات التالية.\n${CREATOR_KNOWLEDGE_AR}`
          : `You are a senior project architect inside VIP AI. Plan projects, milestones, file structures, and actionable engineering steps.\n${CREATOR_KNOWLEDGE_EN}`) +
        memoryAddon,
    };

    try {
      const contents = messages.map((msg) => {
        const parts: Array<Record<string, unknown>> = [];
        if (msg.attachments && msg.attachments.length > 0) {
          for (const att of msg.attachments) {
            if (att.textContent) {
              parts.push({ text: `[Attached Document: ${att.name}]\n${att.textContent}` });
            } else if (att.data && att.mimeType) {
              parts.push({
                inlineData: {
                  mimeType: att.mimeType,
                  data: att.data,
                },
              });
            }
          }
        }
        parts.push({ text: msg.content || 'Analyze the attached content.' });
        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts,
        };
      });

      const stream = await ai.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: systemMap[mode] || systemMap.general,
        },
      });

      for await (const chunk of stream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.write(`data: ${JSON.stringify({ error: classified.error, code: classified.code })}\n\n`);
      res.end();
    }
  });

  // 2. AI Developer Agent — Autonomous Full-Stack / Mobile / Web App Builder
  app.post('/api/ai/agent/build', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({
        code: 'KEY_NOT_CONFIGURED',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const { prompt, targetType = 'webapp', language = 'en' } = req.body as {
      prompt: string;
      targetType?: 'webapp' | 'mobile_pwa' | 'fullstack_api';
      language?: 'en' | 'ar';
    };

    if (!prompt?.trim()) {
      res.status(400).json({ error: 'Application description prompt is required.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are an autonomous senior software engineer in VIP AI.
Build a complete, self-contained, immediately runnable project for: "${prompt}".
Target Type: ${targetType} (if mobile_pwa, include responsive mobile UI + manifest.json; if fullstack_api, include Express server.js + frontend index.html).
Always include a complete self-contained index.html in previewHtml (with clean HTML5, inline/linked CSS, and vanilla ES6+ JS without missing external files) so our automated browser test harness can render and verify it with zero runtime errors!
Prose summary & architecture notes language: ${language === 'ar' ? 'Arabic' : 'English'}.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              summary: { type: Type.STRING },
              architectureNotes: { type: Type.STRING },
              previewHtml: { type: Type.STRING },
              files: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    path: { type: Type.STRING },
                    language: { type: Type.STRING },
                    content: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const appSpec = safeParseJson<Record<string, unknown>>(response.text, {});
      res.json({ ok: true, project: appSpec });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 2B. AI Developer Agent — Automatic Error Repair
  app.post('/api/ai/agent/repair', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({
        code: 'KEY_NOT_CONFIGURED',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const { previewHtml, files = [], errors = [], language = 'en' } = req.body as {
      previewHtml: string;
      files: Array<{ path: string; language: string; content: string }>;
      errors: string[];
      language?: 'en' | 'ar';
    };

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are VIP AI's automated bug repair engineer.
Detected test & runtime errors:
${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Current previewHtml:
${previewHtml}

Current files:
${JSON.stringify(files)}

Fix ALL detected errors cleanly, return the repaired previewHtml and updated files, and explain what was repaired in ${language === 'ar' ? 'Arabic' : 'English'}.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fixSummary: { type: Type.STRING },
              previewHtml: { type: Type.STRING },
              files: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    path: { type: Type.STRING },
                    language: { type: Type.STRING },
                    content: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const repaired = JSON.parse((response.text ?? '{}').trim());
      res.json({ ok: true, repaired });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 3. 3D Creator — Procedural Composite 3D Model Generator
  app.post('/api/ai/3d/generate', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({
        code: 'KEY_NOT_CONFIGURED',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const { prompt, category = 'object', language = 'en' } = req.body as {
      prompt: string;
      category?: 'object' | 'character' | 'environment';
      language?: 'en' | 'ar';
    };

    if (!prompt?.trim()) {
      res.status(400).json({ error: '3D description prompt is required.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Design a rich composite 3D asset made of 5 to 12 distinct geometric sub-parts for Three.js PBR rendering.
Prompt: "${prompt}"
Category: ${category}
Coordinate system: Y-up, ground plane at Y = 0. Ensure parts connect cleanly with realistic proportions so nothing floats detached.
Supported part shapes: "box", "sphere", "cylinder", "cone", "torus", "dodecahedron".
Provide hex colors (e.g. "#3B82F6"), roughness (0.05 to 0.95), metalness (0.0 to 1.0), emissiveHex (optional hex for glowing accents or "#000000"), position [x,y,z], rotation [rx,ry,rz] in radians, and scale/dimensions [sx,sy,sz].
Prose description language: ${language === 'ar' ? 'Arabic' : 'English'}.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              description: { type: Type.STRING },
              parts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    shape: { type: Type.STRING },
                    position: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    rotation: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    dimensions: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                    color: { type: Type.STRING },
                    roughness: { type: Type.NUMBER },
                    metalness: { type: Type.NUMBER },
                    emissive: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const sceneSpec = JSON.parse((response.text ?? '{}').trim());
      res.json({ ok: true, sceneSpec });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 4. Mascot Quick Reaction / Joke
  app.post('/api/ai/mascot/react', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ error: 'GEMINI_API_KEY not configured.' });
      return;
    }

    const { trigger, language = 'en', context = '' } = req.body as {
      trigger: 'joke' | 'chat_reaction' | 'greeting' | 'chess';
      language?: 'en' | 'ar';
      context?: string;
    };

    try {
      const langPrompt =
        language === 'ar'
          ? `تحدث بالعربية بأسلوب مرح وذكي مستوحى من شخصيات الرسوم المتحركة الكلاسيكية في الثلاثينيات (بدون ذكر أي علامات تجارية). جملة أو جملتين قصيرتين فقط. (${CREATOR_KNOWLEDGE_AR})`
          : `Speak in 1–2 short, witty, cheerful sentences in the spirit of a classic 1930s rubber-hose cartoon inventor mascot named Pip. (${CREATOR_KNOWLEDGE_EN})`;

      const taskPrompt =
        trigger === 'joke'
          ? 'Tell a clever, family-friendly creative/tech joke.'
          : trigger === 'chess'
            ? `React cheerfully to this chess event: ${context}`
            : trigger === 'chat_reaction'
              ? `React warmly and briefly to the user's message topic: ${context}`
              : 'Say a playful studio greeting and offer creative encouragement.';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `${langPrompt}\n${taskPrompt}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({ ok: true, line: (response.text ?? '').trim() });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 5. Unreal Engine 5 Game Creation Generator (PC & Android)
  app.post('/api/ai/game/generate', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({
        code: 'KEY_NOT_CONFIGURED',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const {
      prompt,
      dimension = '3D',
      genre = 'Adventure',
      multiplayer = false,
      targetPlatform = 'PC & Android',
      language = 'en',
      config = {},
    } = req.body as {
      prompt: string;
      dimension?: '2D' | '3D';
      genre?: string;
      multiplayer?: boolean;
      targetPlatform?: string;
      language?: 'en' | 'ar';
      config?: Record<string, unknown>;
    };

    if (!prompt?.trim()) {
      res.status(400).json({ error: 'Game description prompt is required.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Design a complete, practical Unreal Engine 5 project blueprint for the following game concept:
Prompt: ${prompt}
Target Dimension: ${dimension}
Genre: ${genre}
Target Platform: ${targetPlatform}
Multiplayer Architecture: ${multiplayer ? 'Dedicated/Listen Server Replicated' : 'Single-Player'}
Current Visual Parameters: ${JSON.stringify(config)}
Language for prose descriptions (GDD, environment, mechanics, UE5 import steps): ${language === 'ar' ? 'Arabic (keep C++ code, file paths, and Blueprint node names in standard English UE5 syntax)' : 'English'}.

Be technically accurate for Unreal Engine 5.4+. Include PC and/or Android config (e.g. Config/Android/AndroidEngine.ini if Android is included, touch controls/Enhanced Input). Do not claim the browser builds a compiled binary; instead produce real editable C++ source (.h/.cpp), Build.cs, DefaultEngine.ini, accurate Blueprint node specifications, level design specs, character specs, physics/lighting/audio settings, and clear step-by-step Unreal Editor import instructions.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              projectSlug: { type: Type.STRING },
              summary: { type: Type.STRING },
              gddMarkdown: { type: Type.STRING },
              ue5WorkflowSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              folderStructure: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              characterSpec: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  archetype: { type: Type.STRING },
                  movementSpeed: { type: Type.NUMBER },
                  jumpHeight: { type: Type.NUMBER },
                  abilities: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
              },
              environmentSpec: {
                type: Type.OBJECT,
                properties: {
                  biome: { type: Type.STRING },
                  lightingPreset: { type: Type.STRING },
                  lumenEnabled: { type: Type.BOOLEAN },
                  naniteEnabled: { type: Type.BOOLEAN },
                  gravityScale: { type: Type.NUMBER },
                  audioAmbience: { type: Type.STRING },
                },
              },
              blueprintNodes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    blueprintName: { type: Type.STRING },
                    nodeType: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    connections: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                },
              },
              sourceFiles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    path: { type: Type.STRING },
                    language: { type: Type.STRING },
                    code: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = safeParseJson<Record<string, unknown>>(response.text, {
        title: prompt.slice(0, 42),
        projectSlug: 'VIP_UE5_Game',
        summary: 'Generated UE5 architecture specification.',
      });
      res.json({ ok: true, project: parsed });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 6. Image Studio (Real Gemini Image Generation & Editing)
  app.post('/api/ai/image/generate', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({
        code: 'KEY_NOT_CONFIGURED',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const {
      prompt,
      style = 'realistic',
      aspectRatio = '1:1',
      quality = 'standard',
      referenceImageBase64,
      referenceMimeType,
    } = req.body as {
      prompt: string;
      style?: string;
      aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
      quality?: 'standard' | '1K' | '2K' | '4K';
      referenceImageBase64?: string;
      referenceMimeType?: string;
    };

    if (!prompt?.trim()) {
      res.status(400).json({ error: 'Image prompt is required.' });
      return;
    }

    const styleHints: Record<string, string> = {
      realistic: 'Photorealistic, natural lighting, fine detail, crisp lens depth',
      cartoon: 'Expressive classic cartoon illustration, clean ink outlines, rich palette',
      '3d': 'High-craft 3D concept render, physically based materials, studio rim lighting',
      character: 'Game character concept sheet, crisp silhouette, detailed costume design',
      background: 'Atmospheric wide environment concept background, layered depth',
    };

    const fullPrompt = `${styleHints[style] ? `${styleHints[style]}. ` : ''}${prompt.trim()}`;
    const usePro = quality === '2K' || quality === '4K';
    const model = usePro ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';

    try {
      const parts: Array<Record<string, unknown>> = [];
      if (referenceImageBase64 && referenceMimeType) {
        parts.push({
          inlineData: {
            data: referenceImageBase64,
            mimeType: referenceMimeType,
          },
        });
      }
      parts.push({ text: fullPrompt });

      const config: Record<string, unknown> = {
        imageConfig: usePro
          ? { aspectRatio, imageSize: quality }
          : { aspectRatio },
      };

      const response = await ai.models.generateContent({
        model,
        contents: { parts },
        config,
      });

      let imageDataUrl: string | null = null;
      let textNote = '';

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textNote += part.text;
        }
      }

      if (!imageDataUrl) {
        res.status(502).json({
          code: 'NO_IMAGE_RETURNED',
          error: 'The image model responded without image data.',
          details: textNote,
        });
        return;
      }

      res.json({ ok: true, imageDataUrl, textNote, model });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 7A. Video Studio — Storyboard, Scene Plan, Transitions & Subtitles
  app.post('/api/ai/video/storyboard', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({
        code: 'KEY_NOT_CONFIGURED',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const { prompt, style = 'Cinematic', durationSec = 15, transition = 'Crossfade', language = 'en' } = req.body as {
      prompt: string;
      style?: string;
      durationSec?: number;
      transition?: string;
      language?: 'en' | 'ar';
    };

    if (!prompt?.trim()) {
      res.status(400).json({ error: 'Video concept prompt is required.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Create a detailed production storyboard, voice-over narration script, transitions (preferred: ${transition}), and timed subtitles for a ${durationSec}-second ${style} video about: "${prompt}".
Language: ${language === 'ar' ? 'Arabic' : 'English'}.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              style: { type: Type.STRING },
              voiceoverScript: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    startSec: { type: Type.NUMBER },
                    endSec: { type: Type.NUMBER },
                    visualPrompt: { type: Type.STRING },
                    cameraMotion: { type: Type.STRING },
                    transition: { type: Type.STRING },
                    subtitleText: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const storyboard = JSON.parse((response.text ?? '{}').trim());
      res.json({ ok: true, storyboard });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 7B. Video Studio — Real Video Generation via Gemini Omni Flash (Interactions API)
  app.post('/api/ai/video/generate', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({
        code: 'KEY_NOT_CONFIGURED',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const {
      prompt,
      aspectRatio = '16:9',
      duration = '6s',
      resolution = '720p',
      style = 'Cinematic',
      imageBase64,
      imageMimeType,
    } = req.body as {
      prompt: string;
      aspectRatio?: '16:9' | '9:16';
      duration?: string;
      resolution?: '360p' | '720p' | '1080p';
      style?: string;
      imageBase64?: string;
      imageMimeType?: string;
    };

    if (!prompt?.trim()) {
      res.status(400).json({ error: 'Video prompt is required.' });
      return;
    }

    try {
      const fullPrompt = `${style} style: ${prompt.trim()}`;
      const input =
        imageBase64 && imageMimeType
          ? [
              { type: 'image' as const, mime_type: imageMimeType, data: imageBase64 },
              { type: 'text' as const, text: fullPrompt },
            ]
          : fullPrompt;

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: aspectRatio,
            duration,
            resolution,
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (!videoPart?.data) {
        res.status(502).json({
          code: 'NO_VIDEO_RETURNED',
          error: 'Video generation returned no video payload.',
        });
        return;
      }

      const mime = videoPart.mime_type || 'video/mp4';
      res.json({
        ok: true,
        videoDataUrl: `data:${mime};base64,${videoPart.data}`,
        model: 'gemini-omni-1.2-flash',
      });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 8A. Audio Studio — Text-to-Speech (Single & Dual Speaker)
  app.post('/api/ai/audio/tts', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({
        code: 'KEY_NOT_CONFIGURED',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const {
      text,
      voiceName = 'Kore',
      style = 'Clear, natural studio narrator',
      mode = 'single',
      secondSpeakerText = '',
      secondVoiceName = 'Puck',
    } = req.body as {
      text: string;
      voiceName?: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
      style?: string;
      mode?: 'single' | 'dialogue';
      secondSpeakerText?: string;
      secondVoiceName?: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
    };

    if (!text?.trim()) {
      res.status(400).json({ error: 'Text input is required for speech synthesis.' });
      return;
    }

    try {
      if (mode === 'dialogue' && secondSpeakerText.trim()) {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `SpeakerA: ${text.trim()}`,
                  speechMetadata: { speaker: 'SpeakerA', style },
                },
                {
                  text: `SpeakerB: ${secondSpeakerText.trim()}`,
                  speechMetadata: { speaker: 'SpeakerB', style },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  { speaker: 'SpeakerA', voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
                  {
                    speaker: 'SpeakerB',
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: secondVoiceName } },
                  },
                ],
              },
            },
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
          res.status(502).json({ error: 'No audio generated by TTS model.' });
          return;
        }
        res.json({ ok: true, audioDataUrl: `data:audio/wav;base64,${base64Audio}` });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim(),
                speechMetadata: { style },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'No audio generated by TTS model.' });
        return;
      }
      res.json({ ok: true, audioDataUrl: `data:audio/wav;base64,${base64Audio}` });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 8B. Audio Studio — Speech-to-Text Transcription
  app.post('/api/ai/audio/transcribe', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({
        code: 'KEY_NOT_CONFIGURED',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const { audioBase64, mimeType = 'audio/webm', language = 'en' } = req.body as {
      audioBase64: string;
      mimeType?: string;
      language?: 'en' | 'ar';
    };

    if (!audioBase64) {
      res.status(400).json({ error: 'Audio data is required.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            {
              text:
                language === 'ar'
                  ? 'انسخ هذا الصوت بدقة تامة إلى نص مكتوب.'
                  : 'Transcribe this audio accurately into text.',
            },
          ],
        },
      });
      res.json({ ok: true, transcript: (response.text ?? '').trim() });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 8C. Audio Studio — Lyria Music Generation
  app.post('/api/ai/audio/music', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({
        code: 'KEY_NOT_CONFIGURED',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const { prompt, mode = 'clip' } = req.body as {
      prompt: string;
      mode?: 'clip' | 'pro';
    };

    if (!prompt?.trim()) {
      res.status(400).json({ error: 'Music prompt is required.' });
      return;
    }

    const model = mode === 'pro' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';

    try {
      const response = await ai.models.generateContentStream({
        model,
        contents: prompt.trim(),
      });

      const audioChunks: Buffer[] = [];
      let lyrics = '';
      let mimeType = 'audio/mpeg';

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (audioChunks.length === 0 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
          }
          if (part.text) {
            lyrics += part.text;
          }
        }
      }

      if (audioChunks.length === 0) {
        res.status(502).json({
          code: 'NO_MUSIC_RETURNED',
          error: 'Lyria returned no audio stream.',
        });
        return;
      }

      const audioBase64 = Buffer.concat(audioChunks).toString('base64');
      res.json({
        ok: true,
        audioDataUrl: `data:${mimeType};base64,${audioBase64}`,
        lyrics,
        model,
      });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 9. Programming Center
  app.post('/api/ai/code/assist', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({
        code: 'KEY_NOT_CONFIGURED',
        error: 'GEMINI_API_KEY is not configured in Settings > Secrets.',
      });
      return;
    }

    const {
      action,
      targetLanguage,
      prompt,
      existingCode = '',
      uiLanguage = 'en',
    } = req.body as {
      action: 'generate' | 'explain' | 'debug' | 'improve' | 'structure';
      targetLanguage: string;
      prompt: string;
      existingCode?: string;
      uiLanguage?: 'en' | 'ar';
    };

    if (!prompt?.trim() && !existingCode?.trim()) {
      res.status(400).json({ error: 'Provide a description or source code.' });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are VIP AI's senior software engineer.
Action: ${action}
Target Programming Language / Stack: ${targetLanguage}
User Request: ${prompt}
Existing Code (if provided):
\`\`\`
${existingCode}
\`\`\`
Explanation Prose Language: ${uiLanguage === 'ar' ? 'Arabic' : 'English'} (keep all code and filenames in standard programming syntax).
When targetLanguage is HTML, CSS, or JavaScript, if generating a web UI or interactive app, also include a self-contained previewable HTML document in previewHtml so it can run in an iframe sandbox.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              explanationMarkdown: { type: Type.STRING },
              mainCode: { type: Type.STRING },
              mainFilename: { type: Type.STRING },
              previewHtml: { type: Type.STRING },
              files: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    path: { type: Type.STRING },
                    content: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const result = safeParseJson<Record<string, unknown>>(response.text, {});
      res.json({ ok: true, result });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 10. VIP AI Agent — Multi-Step Goal Planner & Step Executor
  app.post('/api/ai/agent/plan', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const { goal, language = 'en' } = req.body as { goal: string; language?: 'en' | 'ar' };
    if (!goal?.trim()) {
      res.status(400).json({ error: 'Goal description is required.' });
      return;
    }
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Break down this complex user goal into 4 to 6 concrete, sequential executable steps for VIP AI Agent.
Goal: "${goal}"
Language for titles, summary, and instructions: ${language === 'ar' ? 'Arabic' : 'English'}.
Valid actionType values: "plan", "research", "design", "code", "verify", "deliver".
${language === 'ar' ? CREATOR_KNOWLEDGE_AR : CREATOR_KNOWLEDGE_EN}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    actionType: { type: Type.STRING },
                    instruction: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });
      const plan = safeParseJson(response.text, { title: goal.slice(0, 48), summary: '', steps: [] });
      res.json({ ok: true, plan });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  app.post('/api/ai/agent/step', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const { goal, stepTitle, instruction, previousOutputs = [], language = 'en' } = req.body as {
      goal: string;
      stepTitle: string;
      instruction: string;
      previousOutputs?: Array<{ title: string; output: string }>;
      language?: 'en' | 'ar';
    };
    try {
      const priorCtx = previousOutputs
        .map((p, idx) => `Step ${idx + 1} (${p.title}):\n${p.output}`)
        .join('\n\n---\n\n');
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are VIP AI Agent executing a milestone for the user's goal.
Overall Goal: ${goal}
Current Step: ${stepTitle}
Step Instruction: ${instruction}
${priorCtx ? `\nPrior Completed Steps:\n${priorCtx}\n` : ''}
Produce a detailed, actionable Markdown deliverable for this step in ${language === 'ar' ? 'Arabic' : 'English'}. Include code snippets, checklists, or technical specs where appropriate.`,
      });
      res.json({ ok: true, output: (response.text ?? '').trim() });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 11. PC Assistant — OS Workflow Guidance & File Organization Advisor
  app.post('/api/ai/pc/assist', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const {
      query,
      osTarget = 'Windows',
      folderManifest = '',
      language = 'en',
    } = req.body as {
      query: string;
      osTarget?: 'Windows' | 'macOS' | 'Linux' | 'Android';
      folderManifest?: string;
      language?: 'en' | 'ar';
    };
    if (!query?.trim()) {
      res.status(400).json({ error: 'PC workflow question or task is required.' });
      return;
    }
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are VIP AI's PC Workflow & System Organization Assistant.
Target Operating System: ${osTarget}
User Task / Question: ${query}
${folderManifest ? `\nUser-Approved Selected Folder File Listing (read-only metadata):\n${folderManifest}\n` : ''}
Provide safe, exact, step-by-step instructions tailored to ${osTarget}. Never pretend you directly modified OS files outside the browser. Mark "requiresConfirmation": true on any step that moves, renames, or deletes files, and include a clear safetyWarning if destructive commands are discussed.
Language for prose: ${language === 'ar' ? 'Arabic (keep terminal commands/paths accurate)' : 'English'}.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              safetyWarning: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    detail: { type: Type.STRING },
                    commandHint: { type: Type.STRING },
                    requiresConfirmation: { type: Type.BOOLEAN },
                  },
                },
              },
            },
          },
        },
      });
      const guide = safeParseJson(response.text, { title: 'PC Workflow Guide', summary: '', safetyWarning: '', steps: [] });
      res.json({ ok: true, guide });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 12. VIP Browser — Live Google Search Grounding & URL Summarization
  app.post('/api/ai/browser/search', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const { query = '', url = '', mode = 'search', language = 'en' } = req.body as {
      query?: string;
      url?: string;
      mode?: 'search' | 'url';
      language?: 'en' | 'ar';
    };
    if (!query.trim() && !url.trim()) {
      res.status(400).json({ error: 'Search query or URL is required.' });
      return;
    }
    try {
      const promptText =
        mode === 'url' && url.trim()
          ? `Analyze and summarize this webpage thoroughly in ${language === 'ar' ? 'Arabic' : 'English'}: ${url.trim()}\n${query.trim() ? `Focus specifically on: ${query.trim()}` : 'Include key takeaways, structured facts, and action items.'}`
          : `Research the web and provide a clear, factual, structured answer with verified sources in ${language === 'ar' ? 'Arabic' : 'English'} for: ${query.trim()}`;

      const tools = mode === 'url' && url.trim() ? [{ urlContext: {} }, { googleSearch: {} }] : [{ googleSearch: {} }];

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          tools,
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seen = new Set<string>();
      const citations: Array<{ title: string; uri: string }> = [];
      for (const ch of chunks) {
        const uri = ch.web?.uri;
        if (uri && !seen.has(uri)) {
          seen.add(uri);
          citations.push({ title: ch.web?.title || uri, uri });
        }
      }

      res.json({
        ok: true,
        summary: (response.text ?? '').trim(),
        citations,
      });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 13. Presentation Maker — Structured Slide Deck Generator
  app.post('/api/ai/presentation/generate', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const { topic, audience = 'Executive & Technical', slideCount = 7, themeColor = '#2563EB', language = 'en' } =
      req.body as {
        topic: string;
        audience?: string;
        slideCount?: number;
        themeColor?: string;
        language?: 'en' | 'ar';
      };
    if (!topic?.trim()) {
      res.status(400).json({ error: 'Presentation topic is required.' });
      return;
    }
    try {
      const count = Math.max(3, Math.min(14, Number(slideCount) || 7));
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Design a crisp, high-impact ${count}-slide presentation deck about: "${topic}".
Target Audience: ${audience}
Slide language: ${language === 'ar' ? 'Arabic' : 'English'}.
Valid slide layouts: "title", "bullets", "two-column", "quote", "closing".
For each slide, provide a clear title, optional subtitle, 3-5 concise bullets (no walls of text), detailed speakerNotes, and an English visual imagePrompt for optional illustration.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              audience: { type: Type.STRING },
              slides: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    layout: { type: Type.STRING },
                    bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                    speakerNotes: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });
      const deck = safeParseJson(response.text, { title: topic, audience, slides: [] });
      res.json({ ok: true, deck: { ...deck, themeColor } });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 14. VIP Documents — Create, Summarize, Rewrite, Q&A (supports Text & PDF inlineData)
  app.post('/api/ai/documents/process', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const {
      action = 'create',
      prompt = '',
      content = '',
      pdfBase64 = '',
      language = 'en',
    } = req.body as {
      action?: 'create' | 'summarize' | 'rewrite' | 'qa' | 'extract_pdf';
      prompt?: string;
      content?: string;
      pdfBase64?: string;
      language?: 'en' | 'ar';
    };

    try {
      const parts: Array<Record<string, unknown>> = [];
      if (pdfBase64) {
        parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } });
      }
      const langLabel = language === 'ar' ? 'Arabic' : 'English';
      const instructionMap: Record<string, string> = {
        create: `Write a complete, well-structured professional document in ${langLabel} with clear headings and sections for: ${prompt}`,
        summarize: `Provide an executive summary, key bullet points, and action items in ${langLabel} for the provided document.`,
        rewrite: `Rewrite and polish the provided document professionally in ${langLabel}. Instruction: ${prompt || 'Improve clarity, formatting, and tone.'}`,
        qa: `Answer the user's question accurately in ${langLabel} based strictly on the provided document.\nQuestion: ${prompt}`,
        extract_pdf: `Extract clean, structured readable Markdown text preserving headings and lists from the attached PDF document.`,
      };

      const textBlock = `${instructionMap[action] || instructionMap.create}${
        content ? `\n\nDocument Content:\n${content.slice(0, 60000)}` : ''
      }`;
      parts.push({ text: textBlock });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts }],
      });

      res.json({ ok: true, resultText: (response.text ?? '').trim() });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 15. Universal Translator — Multilingual Text & PDF Translation
  app.post('/api/ai/translate', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const {
      text = '',
      sourceLang = 'Auto-Detect',
      targetLang = 'Arabic',
      tone = 'Natural & Accurate',
      pdfBase64 = '',
    } = req.body as {
      text?: string;
      sourceLang?: string;
      targetLang?: string;
      tone?: string;
      pdfBase64?: string;
    };
    if (!text.trim() && !pdfBase64) {
      res.status(400).json({ error: 'Text or document is required for translation.' });
      return;
    }
    try {
      const parts: Array<Record<string, unknown>> = [];
      if (pdfBase64) {
        parts.push({ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } });
      }
      parts.push({
        text: `Translate accurately from ${sourceLang} into ${targetLang}.
Style / Tone: ${tone}.
Preserve Markdown formatting, technical terminology accuracy, and paragraph spacing. Output only the translated content without meta commentary.
${text.trim() ? `\nSource Text:\n${text}` : ''}`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts }],
      });

      res.json({ ok: true, translatedText: (response.text ?? '').trim() });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 16. VIP Academy — Interactive Lesson Generator & Exercise Grader
  app.post('/api/ai/academy/generate', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const { topic, level = 'Beginner', language = 'en' } = req.body as {
      topic: string;
      level?: 'Beginner' | 'Intermediate' | 'Advanced';
      language?: 'en' | 'ar';
    };
    if (!topic?.trim()) {
      res.status(400).json({ error: 'Learning topic is required.' });
      return;
    }
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Create a structured interactive VIP Academy lesson on "${topic}" at the ${level} level.
Instruction language: ${language === 'ar' ? 'Arabic (keep code snippets in standard syntax)' : 'English'}.
Include 3 teaching sections (each with optional codeExample), 3 multiple-choice quiz questions (4 options each, correctIndex 0-3, and explanation), plus one practical coding/thinking exercisePrompt and starterCode.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              overview: { type: Type.STRING },
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    heading: { type: Type.STRING },
                    body: { type: Type.STRING },
                    codeExample: { type: Type.STRING },
                  },
                },
              },
              quiz: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                  },
                },
              },
              exercisePrompt: { type: Type.STRING },
              starterCode: { type: Type.STRING },
            },
          },
        },
      });
      const lesson = safeParseJson(response.text, {
        title: topic,
        overview: '',
        sections: [],
        quiz: [],
        exercisePrompt: '',
        starterCode: '',
      });
      res.json({ ok: true, lesson });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  app.post('/api/ai/academy/grade', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const { exercisePrompt, submission, language = 'en' } = req.body as {
      exercisePrompt: string;
      submission: string;
      language?: 'en' | 'ar';
    };
    if (!submission?.trim()) {
      res.status(400).json({ error: 'Submission answer or code is required.' });
      return;
    }
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Grade this student's exercise solution in ${language === 'ar' ? 'Arabic' : 'English'}.
Exercise: ${exercisePrompt}
Student Submission:
\`\`\`
${submission}
\`\`\``,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              passed: { type: Type.BOOLEAN },
              score: { type: Type.INTEGER },
              feedbackMarkdown: { type: Type.STRING },
              improvedHint: { type: Type.STRING },
            },
          },
        },
      });
      const evaluation = safeParseJson(response.text, { passed: true, score: 80, feedbackMarkdown: '', improvedHint: '' });
      res.json({ ok: true, evaluation });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 17. Automation Studio — Execute Chained Workflow Node
  app.post('/api/ai/automation/run-step', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const {
      action = 'summarize',
      promptTemplate = '',
      initialInput = '',
      previousOutput = '',
      language = 'en',
    } = req.body as {
      action?: string;
      promptTemplate?: string;
      initialInput?: string;
      previousOutput?: string;
      language?: 'en' | 'ar';
    };
    try {
      const resolvedPrompt = (promptTemplate || '{{prev_output}}')
        .replace(/\{\{input\}\}/gi, initialInput)
        .replace(/\{\{prev_output\}\}/gi, previousOutput || initialInput);

      const actionDirective: Record<string, string> = {
        web_search: 'Perform live web research using Google Search grounding and synthesize key facts with source context.',
        summarize: 'Produce a crisp executive summary highlighting key insights.',
        translate: 'Translate the provided content accurately while preserving structure.',
        code_gen: 'Generate clean, runnable implementation code or script.',
        analyze: 'Perform structured critical analysis, pros/cons, and technical conclusions.',
        extract_tasks: 'Extract a prioritized, actionable task checklist.',
      };

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Workflow Action: ${action} — ${actionDirective[action] || 'Process the input cleanly.'}
Output language preference: ${language === 'ar' ? 'Arabic unless translation specifies otherwise' : 'English unless translation specifies otherwise'}.

Input Payload:
${resolvedPrompt}

${previousOutput && !promptTemplate.includes('{{prev_output}}') ? `\nContext from Previous Step:\n${previousOutput}` : ''}`,
        config: action === 'web_search' ? { tools: [{ googleSearch: {} }] } : undefined,
      });

      res.json({ ok: true, output: (response.text ?? '').trim() });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 18. Website Creator — Responsive Multi-Section Website Generator
  app.post('/api/ai/website/generate', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const { prompt, stylePreset = 'Modern Editorial', language = 'en' } = req.body as {
      prompt: string;
      stylePreset?: string;
      language?: 'en' | 'ar';
    };
    if (!prompt?.trim()) {
      res.status(400).json({ error: 'Website description is required.' });
      return;
    }
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Design and build a complete, responsive, production-craft website for: "${prompt}".
Visual Aesthetic Preset: ${stylePreset}.
Content Language: ${language === 'ar' ? 'Arabic (include dir="rtl" lang="ar" in the HTML)' : 'English'}.
Requirements:
- Return a self-contained previewHtml (complete HTML5 with clean responsive CSS / CSS Grid / Flexbox and interactive vanilla JS navigation/forms/filters that works cleanly inside a sandboxed iframe without missing external dependencies).
- Return modular files[] (index.html, styles.css, main.js).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              summary: { type: Type.STRING },
              previewHtml: { type: Type.STRING },
              files: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    path: { type: Type.STRING },
                    language: { type: Type.STRING },
                    content: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });
      const site = safeParseJson(response.text, { name: prompt.slice(0, 36), summary: '', previewHtml: '', files: [] });
      res.json({ ok: true, site });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 19. Data Analyst — Dataset Statistical Interpretation & Anomalies
  app.post('/api/ai/data/analyze', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const {
      datasetName = 'Dataset',
      rowCount = 0,
      columnsSummary = [],
      sampleRows = [],
      question = '',
      language = 'en',
    } = req.body as {
      datasetName?: string;
      rowCount?: number;
      columnsSummary?: unknown[];
      sampleRows?: unknown[];
      question?: string;
      language?: 'en' | 'ar';
    };
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are VIP AI's senior Data Analyst.
Analyze this real dataset profile computed from user data and generate executive insights, anomalies, and actionable recommendations in ${language === 'ar' ? 'Arabic' : 'English'}.
Dataset: ${datasetName} (${rowCount} rows)
Column Profiles: ${JSON.stringify(columnsSummary)}
Sample Rows (first 15): ${JSON.stringify(sampleRows.slice(0, 15))}
${question ? `Specific User Question: ${question}` : ''}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              aiInsightsMarkdown: { type: Type.STRING },
              anomalies: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedLabelColumn: { type: Type.STRING },
              suggestedValueColumn: { type: Type.STRING },
            },
          },
        },
      });
      const analysis = safeParseJson(response.text, {
        aiInsightsMarkdown: '',
        anomalies: [],
        recommendations: [],
        suggestedLabelColumn: '',
        suggestedValueColumn: '',
      });
      res.json({ ok: true, analysis });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 20. Idea Generator — Seed Idea to Full Product Roadmap & Architecture
  app.post('/api/ai/ideas/generate', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const { seedIdea, focus = 'product', language = 'en' } = req.body as {
      seedIdea: string;
      focus?: string;
      language?: 'en' | 'ar';
    };
    if (!seedIdea?.trim()) {
      res.status(400).json({ error: 'Seed idea is required.' });
      return;
    }
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Expand this seed idea into a structured, build-ready project plan and architecture in ${language === 'ar' ? 'Arabic' : 'English'}.
Seed Idea: "${seedIdea}"
Focus Area: ${focus}
Pick the best launchTarget among: "developer", "websiteCreator", "presentations", "game".`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              tagline: { type: Type.STRING },
              valueProposition: { type: Type.STRING },
              targetAudience: { type: Type.STRING },
              architectureSpec: { type: Type.STRING },
              launchTarget: { type: Type.STRING },
              milestones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    phase: { type: Type.STRING },
                    goal: { type: Type.STRING },
                    deliverables: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                },
              },
              risks: { type: Type.ARRAY, items: { type: Type.STRING } },
              weekOneSprint: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      });
      const idea = safeParseJson(response.text, {
        title: seedIdea.slice(0, 40),
        tagline: '',
        valueProposition: '',
        targetAudience: '',
        architectureSpec: '',
        launchTarget: 'developer',
        milestones: [],
        risks: [],
        weekOneSprint: [],
      });
      res.json({ ok: true, idea });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // 21. VIP Multi-Agent — Collaborative Specialist Team Orchestration
  app.post('/api/ai/multiagent/collaborate', async (req: Request, res: Response) => {
    const ai = getAI();
    if (!ai) {
      res.status(503).json({ code: 'KEY_NOT_CONFIGURED', error: 'GEMINI_API_KEY is not configured in Settings > Secrets.' });
      return;
    }
    const {
      objective,
      agentRole,
      priorTurns = [],
      mode = 'agent_step',
      language = 'en',
    } = req.body as {
      objective: string;
      agentRole?: 'Researcher' | 'System Architect' | 'Product Designer' | 'Lead Engineer' | 'QA Reviewer';
      priorTurns?: Array<{ agentRole: string; summary: string; deliverableMarkdown: string }>;
      mode?: 'agent_step' | 'synthesize';
      language?: 'en' | 'ar';
    };
    if (!objective?.trim()) {
      res.status(400).json({ error: 'Project objective is required.' });
      return;
    }
    try {
      const historyText = priorTurns
        .map((pt) => `### ${pt.agentRole}\n${pt.deliverableMarkdown}`)
        .join('\n\n---\n\n');

      if (mode === 'synthesize') {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `You are the Principal Orchestrator synthesizing the complete collaborative outputs of the VIP AI specialist team into one unified, polished final blueprint & implementation package in ${language === 'ar' ? 'Arabic' : 'English'}.
Objective: ${objective}

Team Outputs:
${historyText}`,
        });
        res.json({ ok: true, finalSynthesisMarkdown: (response.text ?? '').trim() });
        return;
      }

      const roleInstructions: Record<string, string> = {
        Researcher: 'Conduct domain research, competitive benchmarks, technical constraints, and requirements.',
        'System Architect': 'Design the complete system architecture, data schemas, APIs, and tech stack tradeoffs.',
        'Product Designer': 'Design the UX flows, information hierarchy, key screens, and accessibility rules.',
        'Lead Engineer': 'Provide concrete module breakdown, core implementation code skeletons, and build scripts.',
        'QA Reviewer': 'Identify edge cases, security/reliability risks, performance bottlenecks, and a concrete test plan.',
      };

      const roleName = agentRole || 'Researcher';
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are acting strictly as the **${roleName}** in a collaborative Multi-Agent team inside VIP AI.
Role Mandate: ${roleInstructions[roleName] || 'Contribute specialist engineering analysis.'}
Overall Team Objective: ${objective}
${historyText ? `\nContext from earlier agents:\n${historyText}\n` : ''}
Respond in ${language === 'ar' ? 'Arabic (keep technical terms/code in English syntax)' : 'English'}.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              deliverableMarkdown: { type: Type.STRING },
            },
          },
        },
      });
      const turn = safeParseJson(response.text, { summary: `${roleName} completed review`, deliverableMarkdown: '' });
      res.json({ ok: true, turn });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(classified.status).json(classified);
    }
  });

  // Vite Dev Middleware or Static Production Build
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VIP AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VIP AI server:', err);
  process.exit(1);
});
