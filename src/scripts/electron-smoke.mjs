import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

function createJsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function buildEmbedding(text) {
  const normalized = String(text || '').toLowerCase();
  const keywords = ['alpha', 'vector', 'search', 'notes', 'project', 'assistant'];
  const counts = keywords.map((keyword) => {
    const matches = normalized.match(new RegExp(keyword, 'g'));
    return matches ? matches.length : 0;
  });

  const vector = counts.map((count, index) => count + index + 1);
  return vector.some((value) => value > 0) ? vector : [1, 2, 3, 4, 5, 6];
}

async function startMockAiServer() {
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST') {
      createJsonResponse(res, 405, { error: { message: 'Method not allowed' } });
      return;
    }

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));

    if (req.url === '/v1/embeddings') {
      const inputs = Array.isArray(body.input) ? body.input : [body.input];
      createJsonResponse(res, 200, {
        data: inputs.map((input, index) => ({
          index,
          embedding: buildEmbedding(input),
        })),
      });
      return;
    }

    if (req.url === '/v1/chat/completions') {
      const messages = Array.isArray(body.messages) ? body.messages : [];
      const systemPrompt = messages.find((message) => message.role === 'system')?.content || '';
      const userMessage = messages.filter((message) => message.role === 'user').at(-1)?.content || '';

      let content = 'Unhandled mock request';
      if (systemPrompt.includes('Continue the text')) {
        content = ' and validates the new AI boundary.';
      } else if (systemPrompt.includes('Rewrite the text')) {
        content = 'The system uses vector search.';
      } else if (systemPrompt.includes('笔记内容')) {
        content = 'Alpha project uses vector search for note retrieval.';
      } else if (userMessage.toLowerCase().includes('rewrite')) {
        content = 'The system uses vector search.';
      }

      createJsonResponse(res, 200, {
        choices: [
          {
            message: {
              content,
            },
          },
        ],
      });
      return;
    }

    createJsonResponse(res, 404, { error: { message: `Unknown route: ${req.url}` } });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to acquire mock AI server address');
  }

  return {
    server,
    port: address.port,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function loadPlaywrightElectron() {
  const playwrightModule = await import('playwright');
  if (!playwrightModule._electron) {
    throw new Error('Playwright Electron automation is unavailable');
  }
  return playwrightModule._electron;
}

async function run() {
  const electron = await loadPlaywrightElectron();
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'notewizard-smoke-'));
  const mockServer = await startMockAiServer();

  const assistantEndpoint = `http://127.0.0.1:${mockServer.port}/v1/chat/completions`;
  const embeddingEndpoint = `http://127.0.0.1:${mockServer.port}/v1/embeddings`;

  const smokeConfig = {
    aiSources: [
      {
        id: 'assistant-source',
        name: 'Assistant Source',
        endpoint: assistantEndpoint,
        apiKey: 'smoke-key',
        aiModel: 'mock-chat-model',
      },
      {
        id: 'embedding-source',
        name: 'Embedding Source',
        endpoint: embeddingEndpoint,
        apiKey: 'smoke-key',
        aiModel: 'mock-embedding-model',
      },
      {
        id: 'rag-chat-source',
        name: 'RAG Chat Source',
        endpoint: assistantEndpoint,
        apiKey: 'smoke-key',
        aiModel: 'mock-chat-model',
      },
    ],
    aiAssistant: {
      enabled: true,
      sourceId: 'assistant-source',
      model: 'mock-chat-model',
      typingDelay: 100,
      minInputLength: 1,
      systemPrompt: 'Continue the text with a short suffix.',
    },
    rag: {
      enabled: true,
      embeddingSourceId: 'embedding-source',
      embeddingModel: 'mock-embedding-model',
      ragChatSourceId: 'rag-chat-source',
      ragChatModel: 'mock-chat-model',
      chunkSize: 200,
      chunkOverlap: 20,
      topK: 3,
      similarityThreshold: 0.1,
      autoIndex: false,
      indexOnSave: false,
    },
    noteSavePath: workspaceRoot,
  };

  let electronApp;
  let page;
  let originalConfig;

  try {
    electronApp = await electron.launch({
      args: ['main.js'],
      cwd: repoRoot,
      env: {
        ...process.env,
        ComSpec: process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
        COMSPEC: process.env.COMSPEC || process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
        SystemRoot: process.env.SystemRoot || 'C:\\Windows',
        WINDIR: process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows',
      },
    });

    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => Boolean(window.electronAPI?.settings && window.electronAPI?.rag && window.electronAPI?.aiChat));

    originalConfig = await page.evaluate(() => window.electronAPI.settings.getConfig());

    await page.evaluate(async (nextConfig) => {
      const currentConfig = await window.electronAPI.settings.getConfig();
      await window.electronAPI.settings.saveConfig({
        ...currentConfig,
        ...nextConfig,
        aiAssistant: {
          ...(currentConfig.aiAssistant || {}),
          ...(nextConfig.aiAssistant || {}),
        },
        rag: {
          ...(currentConfig.rag || {}),
          ...(nextConfig.rag || {}),
        },
        aiSources: nextConfig.aiSources,
      });
    }, smokeConfig);

    const result = await page.evaluate(async (sample) => {
      const { aiService } = await import('/src/renderer/features/ai/services/ai.service.ts');
      const { ragService } = await import('/src/renderer/features/rag/services/rag.service.ts');

      const completion = await aiService.generateCompletion({
        context: sample.completionContext,
        systemPrompt: sample.completionPrompt,
      });

      const rewrite = await aiService.generate({
        systemPrompt: sample.rewritePrompt,
        messages: [{ role: 'user', content: sample.rewriteInput }],
      });

      const initialize = await ragService.initialize();
      const clear = await ragService.clearIndex();
      const index = await ragService.indexNote({
        noteId: 'note-1',
        noteTitle: sample.noteTitle,
        content: sample.noteContent,
      });
      const search = await ragService.search({
        query: sample.searchQuery,
        topK: 3,
        similarityThreshold: 0.1,
      });
      const question = await ragService.askQuestion(sample.question);

      return {
        completion,
        rewrite,
        initialize,
        clear,
        index,
        search,
        question,
      };
    }, {
      completionContext: 'Drafting architecture notes',
      completionPrompt: 'Continue the text with a short suffix.',
      rewritePrompt: 'Rewrite the text in polished English.',
      rewriteInput: 'the system use vector search',
      noteTitle: 'Alpha Vector Notes',
      noteContent: 'Alpha project uses vector search for note retrieval and semantic answers.',
      searchQuery: 'vector search note retrieval',
      question: 'What does the alpha project use for note retrieval?',
    });

    if (!result.completion.success || result.completion.answer !== ' and validates the new AI boundary.') {
      throw new Error(`AI completion smoke failed: ${JSON.stringify(result.completion)}`);
    }

    if (!result.rewrite.success || result.rewrite.answer !== 'The system uses vector search.') {
      throw new Error(`AI rewrite smoke failed: ${JSON.stringify(result.rewrite)}`);
    }

    if (!result.initialize.success || !result.clear.success || !result.index.success) {
      throw new Error(`RAG initialize/index smoke failed: ${JSON.stringify({ initialize: result.initialize, clear: result.clear, index: result.index })}`);
    }

    if (!result.search.success || !result.search.results?.length || result.search.results[0].noteTitle !== 'Alpha Vector Notes') {
      throw new Error(`RAG search smoke failed: ${JSON.stringify(result.search)}`);
    }

    if (!result.question.success || result.question.answer !== 'Alpha project uses vector search for note retrieval.') {
      throw new Error(`RAG question smoke failed: ${JSON.stringify(result.question)}`);
    }

    console.log('Electron smoke passed');
    console.log(JSON.stringify({
      completion: result.completion.answer,
      rewrite: result.rewrite.answer,
      searchResults: result.search.results.length,
      ragAnswer: result.question.answer,
    }, null, 2));
  } finally {
    if (page && originalConfig) {
      await page.evaluate(async (config) => {
        await window.electronAPI.settings.saveConfig(config);
      }, originalConfig);
    }

    if (electronApp) {
      await electronApp.close();
    }

    await mockServer.close();
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});