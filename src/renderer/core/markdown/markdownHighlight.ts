import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

interface HighlightLanguageConfig {
  loader: typeof bash;
  label: string;
}

interface HighlightResult {
  html: string;
  language: string | null;
  languageLabel: string | null;
}

const LANGUAGE_CONFIGS = {
  bash: { loader: bash, label: 'Bash' },
  c: { loader: c, label: 'C' },
  cpp: { loader: cpp, label: 'C++' },
  csharp: { loader: csharp, label: 'C#' },
  css: { loader: css, label: 'CSS' },
  diff: { loader: diff, label: 'Diff' },
  dockerfile: { loader: dockerfile, label: 'Dockerfile' },
  go: { loader: go, label: 'Go' },
  java: { loader: java, label: 'Java' },
  javascript: { loader: javascript, label: 'JavaScript' },
  json: { loader: json, label: 'JSON' },
  kotlin: { loader: kotlin, label: 'Kotlin' },
  markdown: { loader: markdown, label: 'Markdown' },
  php: { loader: php, label: 'PHP' },
  powershell: { loader: powershell, label: 'PowerShell' },
  python: { loader: python, label: 'Python' },
  ruby: { loader: ruby, label: 'Ruby' },
  rust: { loader: rust, label: 'Rust' },
  scss: { loader: scss, label: 'SCSS' },
  sql: { loader: sql, label: 'SQL' },
  swift: { loader: swift, label: 'Swift' },
  typescript: { loader: typescript, label: 'TypeScript' },
  xml: { loader: xml, label: 'HTML/XML' },
  yaml: { loader: yaml, label: 'YAML' },
} as const satisfies Record<string, HighlightLanguageConfig>;

const LANGUAGE_ALIASES = {
  cjs: 'javascript',
  cs: 'csharp',
  'c#': 'csharp',
  cxx: 'cpp',
  cc: 'cpp',
  'c++': 'cpp',
  docker: 'dockerfile',
  golang: 'go',
  htm: 'xml',
  html: 'xml',
  hxx: 'cpp',
  hpp: 'cpp',
  ini: 'powershell',
  js: 'javascript',
  json5: 'json',
  jsx: 'javascript',
  kt: 'kotlin',
  kts: 'kotlin',
  md: 'markdown',
  mts: 'typescript',
  php8: 'php',
  ps1: 'powershell',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sass: 'scss',
  shell: 'bash',
  sh: 'bash',
  sqlserver: 'sql',
  svg: 'xml',
  text: '',
  plaintext: '',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'xml',
  xhtml: 'xml',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'bash',
} as const satisfies Record<string, string>;

const LANGUAGE_LABEL_OVERRIDES = {
  'c#': 'C#',
  'c++': 'C++',
  cs: 'C#',
  cxx: 'C++',
  cc: 'C++',
  cpp: 'C++',
  docker: 'Dockerfile',
  dockerfile: 'Dockerfile',
  golang: 'Go',
  hpp: 'C++',
  html: 'HTML',
  htm: 'HTML',
  ini: 'INI',
  javascript: 'JavaScript',
  js: 'JavaScript',
  json: 'JSON',
  jsx: 'JSX',
  markdown: 'Markdown',
  md: 'Markdown',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  python: 'Python',
  py: 'Python',
  ruby: 'Ruby',
  rb: 'Ruby',
  rust: 'Rust',
  rs: 'Rust',
  scss: 'SCSS',
  shell: 'Shell',
  sh: 'Shell',
  sql: 'SQL',
  svg: 'SVG',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  tsx: 'TSX',
  vue: 'Vue',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
} as const satisfies Record<string, string>;

const AUTO_DETECT_LANGUAGES = Object.keys(LANGUAGE_CONFIGS);

let registered = false;

function ensureRegistered() {
  if (registered) {
    return;
  }

  for (const [languageName, config] of Object.entries(LANGUAGE_CONFIGS)) {
    hljs.registerLanguage(languageName, config.loader);
  }

  registered = true;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function normalizeLanguageName(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  return LANGUAGE_ALIASES[normalized as keyof typeof LANGUAGE_ALIASES] ?? normalized;
}

function resolveLanguageLabel(requestedLanguage: string, detectedLanguage: string | null) {
  const requested = requestedLanguage.trim().toLowerCase();
  if (requested) {
    return LANGUAGE_LABEL_OVERRIDES[requested as keyof typeof LANGUAGE_LABEL_OVERRIDES]
      ?? LANGUAGE_CONFIGS[normalizeLanguageName(requested) as keyof typeof LANGUAGE_CONFIGS]?.label
      ?? requestedLanguage.trim();
  }

  if (!detectedLanguage) {
    return null;
  }

  return LANGUAGE_LABEL_OVERRIDES[detectedLanguage as keyof typeof LANGUAGE_LABEL_OVERRIDES]
    ?? LANGUAGE_CONFIGS[detectedLanguage as keyof typeof LANGUAGE_CONFIGS]?.label
    ?? detectedLanguage;
}

export function highlightMarkdownCode(code: string, languageHint = ''): HighlightResult {
  ensureRegistered();

  const normalizedHint = normalizeLanguageName(languageHint);
  if (normalizedHint && hljs.getLanguage(normalizedHint)) {
    const highlighted = hljs.highlight(code, {
      language: normalizedHint,
      ignoreIllegals: true,
    });

    return {
      html: highlighted.value,
      language: normalizedHint,
      languageLabel: resolveLanguageLabel(languageHint, normalizedHint),
    };
  }

  const autoDetected = hljs.highlightAuto(code, AUTO_DETECT_LANGUAGES);
  const normalizedDetected = autoDetected.language ? normalizeLanguageName(autoDetected.language) : null;
  if (normalizedDetected) {
    return {
      html: autoDetected.value,
      language: normalizedDetected,
      languageLabel: resolveLanguageLabel(languageHint, normalizedDetected),
    };
  }

  return {
    html: escapeHtml(code),
    language: normalizedHint || null,
    languageLabel: resolveLanguageLabel(languageHint, normalizedHint || null),
  };
}
