"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";

// Track if mermaid has been initialized
let mermaidInitialized = false;

function initMermaid() {
  if (mermaidInitialized || typeof window === "undefined") return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "neutral",
    securityLevel: "loose",
    fontFamily: "inherit",
  });
  mermaidInitialized = true;
}

interface MarkdownCardEditorProps {
  isOpen: boolean;
  initialMarkdown: string;
  onSave: (markdown: string) => void;
  onClose: () => void;
}

// Simple Mermaid preview component
function MermaidPreview({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initMermaid();

    const render = async () => {
      if (!code.trim()) return;
      try {
        const id = `preview-${Math.random().toString(36).slice(2, 11)}`;
        const { svg: result } = await mermaid.render(id, code);
        setSvg(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Render error");
      }
    };
    render();
  }, [code]);

  if (error) {
    return (
      <div className="text-red-500 text-sm p-2 bg-red-50 rounded">{error}</div>
    );
  }
  return svg ? (
    <div dangerouslySetInnerHTML={{ __html: svg }} />
  ) : (
    <div className="text-gray-400">Loading...</div>
  );
}

const SAMPLE_MARKDOWN = `# Welcome to Markdown Cards

This is a **markdown card** with full support for:

## Features

- **Bold** and *italic* text
- [Links](https://example.com)
- Lists (ordered and unordered)
- Tables
- Code blocks
- And more!

## Code Example

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`

## Mermaid Diagrams

\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do Something]
    B -->|No| D[Do Nothing]
    C --> E[End]
    D --> E
\`\`\`

## Table Example

| Feature | Supported |
|---------|-----------|
| GFM     | ✅        |
| Tables  | ✅        |
| Mermaid | ✅        |

> This is a blockquote. Great for callouts!

---

*Double-click the card on canvas to edit.*
`;

export default function MarkdownCardEditor({
  isOpen,
  initialMarkdown,
  onSave,
  onClose,
}: MarkdownCardEditorProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMarkdown(initialMarkdown);
  }, [initialMarkdown]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleSave = useCallback(() => {
    onSave(markdown);
    onClose();
  }, [markdown, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    },
    [onClose, handleSave]
  );

  const insertSample = useCallback(() => {
    setMarkdown(SAMPLE_MARKDOWN);
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[90vw] max-w-5xl h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Markdown Card
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={insertSample}
              className="text-sm text-blue-500 hover:text-blue-600 underline"
            >
              Insert Sample
            </button>
            <div className="flex rounded-lg overflow-hidden border dark:border-gray-600">
              <button
                onClick={() => setActiveTab("edit")}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "edit"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                Edit
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "preview"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                Preview
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-4">
          {activeTab === "edit" ? (
            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder="Enter your markdown here..."
              className="w-full h-full p-4 font-mono text-sm resize-none rounded-lg border dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <div className="w-full h-full overflow-auto p-4 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-900">
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const lang = match ? match[1] : "";
                      const code = String(children).replace(/\n$/, "");

                      if (lang === "mermaid") {
                        return <MermaidPreview code={code} />;
                      }

                      if (!className) {
                        return (
                          <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm">
                            {children}
                          </code>
                        );
                      }

                      return (
                        <pre className="p-3 bg-gray-100 dark:bg-gray-800 rounded overflow-auto">
                          <code className={className}>{children}</code>
                        </pre>
                      );
                    },
                  }}
                >
                  {markdown || "*Nothing to preview*"}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t dark:border-gray-700">
          <p className="text-sm text-gray-500">
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              ⌘S
            </kbd>{" "}
            to save,{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              Esc
            </kbd>{" "}
            to cancel
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Save Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
