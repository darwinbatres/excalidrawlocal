/**
 * BoardEditor - Main Excalidraw editor component with autosave
 *
 * Features:
 * - Smart autosave (only saves when content actually changes)
 * - Save status indicator
 * - Version history sidebar
 * - Conflict detection via ETags
 * - Markdown card insertion with mermaid.js support
 *
 * All data is persisted to the database via API
 */

// Excalidraw styles - imported here to avoid loading on non-editor pages
import "@excalidraw/excalidraw/index.css";

import React, { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { BoardVersion, SaveStatus } from "@/types";
import { boardApi, ApiError, type BoardWithScene } from "@/services/api.client";
import { stripVolatileAppState } from "@/lib/utils";
import { useApp } from "@/contexts/AppContext";
import { SaveIndicator } from "./SaveIndicator";
import { VersionHistory } from "./VersionHistory";
import MarkdownCard from "./MarkdownCard";
import MarkdownCardEditor from "./MarkdownCardEditor";

// Dynamic import for Excalidraw (it needs to be client-side only)
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

// Dynamic import for Footer component
const Footer = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Footer,
  { ssr: false }
);

// We'll import exportToBlob dynamically when needed
let exportToBlob:
  | typeof import("@excalidraw/excalidraw")["exportToBlob"]
  | null = null;

interface BoardEditorProps {
  boardId: string;
  onTitleChange?: (title: string) => void;
  /** When true, the editor is read-only (view mode) */
  viewMode?: boolean;
  /** Callback to toggle view mode */
  onViewModeChange?: (viewMode: boolean) => void;
}

// Autosave interval from environment variable (default: 10 seconds)
const AUTOSAVE_INTERVAL = parseInt(
  process.env.NEXT_PUBLIC_AUTOSAVE_INTERVAL_MS || "10000",
  10
);

// Use any for Excalidraw types since their internal types aren't fully exported
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawElements = readonly any[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawAppState = any;
// BinaryFiles type: { [fileId: string]: { mimeType: string; id: string; dataURL: string; created: number; } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BinaryFiles = Record<string, any>;

// Excalidraw API type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BinaryFileData = any;

interface ExcalidrawAPI {
  getSceneElements: () => ExcalidrawElements;
  getAppState: () => ExcalidrawAppState;
  getFiles: () => BinaryFiles;
  updateScene: (data: {
    elements?: ExcalidrawElements;
    appState?: ExcalidrawAppState;
  }) => void;
  addFiles: (files: BinaryFileData[]) => void;
}

/**
 * Strip markdown formatting to get plain text for search indexing.
 * Removes common markdown syntax while preserving readable text.
 */
function stripMarkdownToPlainText(markdown: string): string {
  return (
    markdown
      // Remove code blocks (```...```)
      .replace(/```[\s\S]*?```/g, "")
      // Remove inline code (`...`)
      .replace(/`[^`]+`/g, "")
      // Remove headers (# ## ### etc) but keep the text
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic markers
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // Remove links but keep text [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove images ![alt](url)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, "")
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Remove blockquotes
      .replace(/^>\s+/gm, "")
      // Clean up extra whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Generate a simple hash of scene content to detect actual changes.
 * Only includes properties that matter for persistence (not UI state).
 */
function hashSceneContent(
  elements: ExcalidrawElements,
  files: BinaryFiles
): string {
  // Only hash non-deleted elements and their important properties
  const elementData = elements
    .filter((el) => !el.isDeleted)
    .map((el) => ({
      id: el.id,
      type: el.type,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      angle: el.angle,
      strokeColor: el.strokeColor,
      backgroundColor: el.backgroundColor,
      fillStyle: el.fillStyle,
      strokeWidth: el.strokeWidth,
      roughness: el.roughness,
      opacity: el.opacity,
      text: el.text,
      points: el.points,
      fileId: el.fileId,
      link: el.link,
      customData: el.customData,
    }));

  const fileIds = Object.keys(files).sort();

  // Simple string hash for comparison
  const content = JSON.stringify({ elements: elementData, fileIds });
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Generate a thumbnail image from the current scene.
 * Returns a base64 data URL or null if generation fails.
 */
async function generateThumbnail(
  elements: ExcalidrawElements,
  appState: ExcalidrawAppState,
  files: BinaryFiles
): Promise<string | null> {
  try {
    // Lazy load exportToBlob
    if (!exportToBlob) {
      const excalidrawModule = await import("@excalidraw/excalidraw");
      exportToBlob = excalidrawModule.exportToBlob;
    }

    // Filter out deleted elements
    const visibleElements = elements.filter((el) => !el.isDeleted);

    if (visibleElements.length === 0) {
      return null; // No content to thumbnail
    }

    // Generate thumbnail blob
    const blob = await exportToBlob({
      elements: visibleElements,
      appState: {
        ...appState,
        exportBackground: true,
        viewBackgroundColor: appState.viewBackgroundColor || "#ffffff",
      },
      files,
      maxWidthOrHeight: 400, // Reasonable size for thumbnails
      getDimensions: () => ({ width: 400, height: 300, scale: 1 }),
    });

    // Convert blob to base64 data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Failed to generate thumbnail:", error);
    return null;
  }
}

export function BoardEditor({
  boardId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onTitleChange,
  viewMode = false,
  onViewModeChange,
}: BoardEditorProps) {
  const { user } = useApp();
  const [board, setBoard] = useState<BoardWithScene | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showMarkdownEditor, setShowMarkdownEditor] = useState(false);
  const [editingMarkdownElementId, setEditingMarkdownElementId] = useState<
    string | null
  >(null);
  const [editingMarkdownContent, setEditingMarkdownContent] = useState("");
  const [initialData, setInitialData] = useState<{
    elements: ExcalidrawElements;
    appState: ExcalidrawAppState;
    files: BinaryFiles;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storageSize, setStorageSize] = useState<string | null>(null);

  const excalidrawRef = useRef<ExcalidrawAPI | null>(null);
  const lastSavedEtagRef = useRef<string>("");
  const hasUnsavedChangesRef = useRef(false);
  const lastSavedHashRef = useRef<string>("");

  // Load board and initial data from API
  useEffect(() => {
    const loadBoard = async () => {
      try {
        const boardData = await boardApi.get(boardId);

        setBoard(boardData);
        lastSavedEtagRef.current = boardData.etag || "";

        // Get data from latest version
        const latestVersion = boardData.latestVersion;

        if (latestVersion) {
          const sceneJson = latestVersion.sceneJson as {
            elements?: ExcalidrawElements;
            files?: BinaryFiles;
          };
          const elements = sceneJson.elements || [];
          const files = sceneJson.files || {};

          setInitialData({
            elements,
            appState: latestVersion.appStateJson || {},
            files,
          });
          setLastSaved(latestVersion.createdAt);

          // Set initial hash so we don't save unchanged content
          lastSavedHashRef.current = hashSceneContent(elements, files);
        } else {
          // New board with no versions yet
          setInitialData({
            elements: [],
            appState: {},
            files: {},
          });
          lastSavedHashRef.current = hashSceneContent([], {});
        }
      } catch (error) {
        console.error("Failed to load board:", error);
        setLoadError(
          error instanceof ApiError ? error.message : "Failed to load board"
        );
      }
    };

    loadBoard();
  }, [boardId]);

  // Fetch storage info for this board
  const fetchStorageInfo = useCallback(async () => {
    try {
      const response = await fetch(`/api/boards/${boardId}/storage`);
      if (response.ok) {
        const data = await response.json();
        setStorageSize(data.totalFormatted);
      }
    } catch (error) {
      console.warn("Failed to fetch storage info:", error);
    }
  }, [boardId]);

  // Load storage info when board loads and after saves
  useEffect(() => {
    if (board) {
      // Use setTimeout to avoid calling setState synchronously in effect
      const timeoutId = setTimeout(() => fetchStorageInfo(), 0);
      return () => clearTimeout(timeoutId);
    }
  }, [board, fetchStorageInfo]);

  // Save to server via API
  const saveToServer = useCallback(
    async (
      elements: ExcalidrawElements,
      appState: ExcalidrawAppState,
      files: BinaryFiles
    ) => {
      if (!board || !user) return;

      setSaveStatus("saving");

      try {
        // Generate thumbnail in parallel (don't block save on it)
        const thumbnailPromise = generateThumbnail(elements, appState, files);

        // Start save immediately, thumbnail will be included if ready
        const thumbnail = await thumbnailPromise;

        const result = await boardApi.saveVersion(board.id, {
          sceneJson: { elements: [...elements], files },
          appStateJson: stripVolatileAppState(appState),
          expectedEtag: lastSavedEtagRef.current || undefined,
          thumbnail: thumbnail || undefined,
        });

        // Check for conflicts
        if (result.conflict) {
          setSaveStatus("conflict");
          return;
        }

        // Update our etag reference and saved hash
        lastSavedEtagRef.current = result.etag;
        lastSavedHashRef.current = hashSceneContent(elements, files);
        hasUnsavedChangesRef.current = false;

        setSaveStatus("saved");
        setLastSaved(result.version.createdAt);

        // Refresh storage info after save
        fetchStorageInfo();

        // Reset to idle after a bit
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        console.error("Failed to save:", error);

        // Handle conflict from 409 response
        if (error instanceof ApiError && error.status === 409) {
          setSaveStatus("conflict");
        } else {
          setSaveStatus("error");
        }
      }
    },
    [board, user, fetchStorageInfo]
  );

  // Interval-based autosave: save every 10 seconds IF there are unsaved changes
  useEffect(() => {
    if (!board || !user || viewMode) return;

    const intervalId = setInterval(() => {
      // Only save if there are unsaved changes and we have the excalidraw ref
      if (hasUnsavedChangesRef.current && excalidrawRef.current) {
        const elements = excalidrawRef.current.getSceneElements();
        const appState = excalidrawRef.current.getAppState();
        const files = excalidrawRef.current.getFiles();
        saveToServer(elements, appState, files);
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(intervalId);
  }, [board, user, saveToServer, viewMode]);

  // Handle changes from Excalidraw - only marks dirty if content actually changed
  const handleChange = useCallback(
    (
      elements: ExcalidrawElements,
      _appState: ExcalidrawAppState,
      files: BinaryFiles
    ) => {
      if (!board) return;

      // Compare current scene hash with last saved hash
      const currentHash = hashSceneContent(elements, files);
      if (currentHash !== lastSavedHashRef.current) {
        hasUnsavedChangesRef.current = true;
      }
    },
    [board]
  );

  // Manual save
  const handleManualSave = useCallback(() => {
    if (!excalidrawRef.current) return;
    const elements = excalidrawRef.current.getSceneElements();
    const appState = excalidrawRef.current.getAppState();
    const files = excalidrawRef.current.getFiles();
    saveToServer(elements, appState, files);
  }, [saveToServer]);

  // Restore version via API
  const handleRestoreVersion = useCallback(
    async (version: BoardVersion) => {
      if (!excalidrawRef.current || !user || !board) return;

      try {
        // Restore via API (this creates a new version from the old one)
        const result = await boardApi.restoreVersion(board.id, version.version);

        // Get the scene data from the version
        const sceneJson = version.sceneJson as {
          elements?: ExcalidrawElements;
          files?: BinaryFiles;
        };

        // Update the scene in Excalidraw
        excalidrawRef.current.updateScene({
          elements: sceneJson.elements || [],
          appState: version.appStateJson || undefined,
        });

        // Add files if present
        if (sceneJson.files && Object.keys(sceneJson.files).length > 0) {
          excalidrawRef.current.addFiles(Object.values(sceneJson.files));
        }

        // Update etag
        lastSavedEtagRef.current = result.etag;

        setShowHistory(false);
        setSaveStatus("saved");
        setLastSaved(result.version.createdAt);

        // Refresh storage info after restore
        fetchStorageInfo();
      } catch (error) {
        console.error("Failed to restore version:", error);
        alert(
          error instanceof ApiError
            ? error.message
            : "Failed to restore version"
        );
      }
    },
    [user, board, fetchStorageInfo]
  );

  // Handle editing a markdown card (triggered by double-click)
  const handleEditMarkdownCard = useCallback(
    (elementId: string, markdown: string) => {
      setEditingMarkdownElementId(elementId);
      setEditingMarkdownContent(markdown);
      setShowMarkdownEditor(true);
    },
    []
  );

  // Save markdown card content
  const handleSaveMarkdownCard = useCallback(
    (newMarkdown: string) => {
      if (!excalidrawRef.current || !editingMarkdownElementId) return;

      const elements = excalidrawRef.current.getSceneElements();
      const searchableText = stripMarkdownToPlainText(newMarkdown);

      // Find the markdown card to get its search text element ID
      const markdownCard = elements.find(
        (el) => el.id === editingMarkdownElementId
      );
      const searchTextElementId = markdownCard?.customData?.searchTextElementId;

      const updatedElements = elements.map((el) => {
        // Update the markdown card
        if (el.id === editingMarkdownElementId) {
          return {
            ...el,
            customData: {
              ...el.customData,
              markdown: newMarkdown,
            },
            // Bump version to trigger re-render
            version: (el.version || 1) + 1,
            updated: Date.now(),
          };
        }
        // Update the linked search text element
        if (searchTextElementId && el.id === searchTextElementId) {
          return {
            ...el,
            text: searchableText,
            originalText: searchableText,
            version: (el.version || 1) + 1,
            updated: Date.now(),
          };
        }
        return el;
      });

      excalidrawRef.current.updateScene({ elements: updatedElements });
      hasUnsavedChangesRef.current = true;
      setEditingMarkdownElementId(null);
      setEditingMarkdownContent("");
    },
    [editingMarkdownElementId]
  );

  // Insert a new markdown card element
  const handleInsertMarkdownCard = useCallback(() => {
    if (!excalidrawRef.current) return;

    const appState = excalidrawRef.current.getAppState();
    const scrollX = appState.scrollX || 0;
    const scrollY = appState.scrollY || 0;
    const zoom = appState.zoom?.value || 1;
    const viewportWidth = appState.width || 800;
    const viewportHeight = appState.height || 600;

    // Calculate center in scene coordinates
    const centerX = -scrollX + viewportWidth / 2 / zoom;
    const centerY = -scrollY + viewportHeight / 2 / zoom;

    const cardWidth = 400;
    const cardHeight = 300;
    const seed = Math.floor(Math.random() * 2000000000);
    const elementId = `md-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
    const searchTextId = `mdsearch-${elementId}`;
    const groupId = `mdgroup-${elementId}`;

    const defaultMarkdown =
      "# New Markdown Card\n\nDouble-click to edit this card.\n\n## Features\n\n- **Bold** and *italic* text\n- Lists and tables\n- Code blocks\n- Mermaid diagrams\n\n```mermaid\ngraph LR\n    A[Start] --> B[End]\n```";
    const searchableText = stripMarkdownToPlainText(defaultMarkdown);

    // Create embeddable element for markdown card
    const markdownElement = {
      id: elementId,
      type: "embeddable" as const,
      x: centerX - cardWidth / 2,
      y: centerY - cardHeight / 2,
      width: cardWidth,
      height: cardHeight,
      angle: 0,
      strokeColor: "#1e1e1e",
      backgroundColor: "#ffffff",
      fillStyle: "solid" as const,
      strokeWidth: 1,
      strokeStyle: "solid" as const,
      roughness: 0,
      opacity: 100,
      groupIds: [groupId],
      frameId: null,
      index: null,
      roundness: { type: 3 },
      seed: seed,
      version: 1,
      versionNonce: seed,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: `markdown://${elementId}`,
      locked: false,
      customData: {
        markdown: defaultMarkdown,
        isMarkdownCard: true,
        searchTextElementId: searchTextId,
      },
    };

    // Create a hidden text element for search indexing
    // This text element is grouped with the markdown card and contains plain text version
    // It's positioned at the same location but with 0 opacity so Excalidraw's search can find it
    const searchTextElement = {
      id: searchTextId,
      type: "text" as const,
      x: centerX - cardWidth / 2,
      y: centerY - cardHeight / 2,
      width: cardWidth,
      height: 20,
      angle: 0,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: "solid" as const,
      strokeWidth: 0,
      strokeStyle: "solid" as const,
      roughness: 0,
      opacity: 0, // Invisible
      groupIds: [groupId],
      frameId: null,
      index: null,
      roundness: null,
      seed: seed + 1,
      version: 1,
      versionNonce: seed + 1,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: true,
      text: searchableText,
      originalText: searchableText,
      fontSize: 16, // Normal font size so search doesn't zoom excessively
      fontFamily: 1,
      textAlign: "left" as const,
      verticalAlign: "top" as const,
      containerId: null,
      lineHeight: 1.25,
      autoResize: false,
      customData: {
        isMarkdownSearchText: true,
        parentMarkdownCardId: elementId,
      },
    };

    const currentElements = excalidrawRef.current.getSceneElements();
    excalidrawRef.current.updateScene({
      elements: [...currentElements, markdownElement, searchTextElement],
    });

    hasUnsavedChangesRef.current = true;
  }, []);

  // Validate embeddable URLs - accept markdown:// scheme
  const validateEmbeddable = useCallback((url: string) => {
    if (url.startsWith("markdown://")) {
      return true;
    }
    // Allow standard embeddables (YouTube, etc.)
    return undefined; // Let Excalidraw handle with default validation
  }, []);

  // Render custom embeddable content for markdown cards
  const renderEmbeddable = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (element: any, appState: ExcalidrawAppState) => {
      // Check if this is a markdown card
      if (
        element.link?.startsWith("markdown://") ||
        element.customData?.isMarkdownCard
      ) {
        return (
          <MarkdownCard
            element={element}
            appState={appState}
            onEdit={viewMode ? undefined : handleEditMarkdownCard}
          />
        );
      }
      // Return null for non-markdown embeddables (use default rendering)
      return null;
    },
    [handleEditMarkdownCard, viewMode]
  );

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!board || !initialData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Save indicator - only show when not in view mode */}
      {!viewMode && (
        <SaveIndicator
          status={saveStatus}
          lastSaved={lastSaved}
          onManualSave={handleManualSave}
          onShowHistory={() => setShowHistory(true)}
          storageSize={storageSize}
        />
      )}

      {/* Excalidraw */}
      <Excalidraw
        excalidrawAPI={(api) => {
          excalidrawRef.current = api as ExcalidrawAPI;
        }}
        initialData={{
          elements: initialData.elements,
          appState: {
            ...initialData.appState,
            collaborators: new Map(),
            viewModeEnabled: viewMode,
          },
          files: initialData.files,
        }}
        viewModeEnabled={viewMode}
        onChange={viewMode ? undefined : handleChange}
        validateEmbeddable={validateEmbeddable}
        renderEmbeddable={renderEmbeddable}
        UIOptions={{
          canvasActions: {
            loadScene: !viewMode,
            export: { saveFileToDisk: true },
            saveToActiveFile: false,
          },
        }}
      >
        {/* Custom Footer with tool buttons - centered */}
        <Footer>
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              bottom: 0,
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              className="Island"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.25rem",
                borderRadius: "0.5rem",
                backgroundColor: "var(--island-bg-color, #fff)",
                boxShadow: "var(--shadow-island, 0 1px 5px rgba(0,0,0,.15))",
                pointerEvents: "auto",
              }}
            >
              {/* View/Edit Mode Toggle */}
              {onViewModeChange && (
                <button
                  onClick={() => onViewModeChange(!viewMode)}
                  className="ToolIcon_type_button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.25rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    backgroundColor: viewMode
                      ? "var(--color-primary, #6965db)"
                      : "transparent",
                    color: viewMode
                      ? "#fff"
                      : "var(--color-on-surface, #1b1b1f)",
                  }}
                  title={
                    viewMode
                      ? "Switch to Edit mode"
                      : "Switch to View-only mode"
                  }
                >
                  {viewMode ? (
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  )}
                  {viewMode ? "View" : "Edit"}
                </button>
              )}

              {/* Separator */}
              {onViewModeChange && !viewMode && (
                <div
                  style={{
                    width: "1px",
                    height: "1.5rem",
                    backgroundColor: "var(--default-border-color, #e0e0e0)",
                  }}
                />
              )}

              {/* Markdown Button - only show in edit mode */}
              {!viewMode && (
                <button
                  onClick={handleInsertMarkdownCard}
                  className="ToolIcon_type_button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.25rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    backgroundColor: "transparent",
                    color: "var(--color-on-surface, #1b1b1f)",
                  }}
                  title="Insert Markdown Card (supports mermaid.js diagrams)"
                >
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Markdown
                </button>
              )}
            </div>
          </div>
        </Footer>
      </Excalidraw>

      {/* Version History Sidebar */}
      {showHistory && (
        <VersionHistory
          boardId={boardId}
          onClose={() => setShowHistory(false)}
          onRestore={handleRestoreVersion}
        />
      )}

      {/* Markdown Card Editor Modal */}
      <MarkdownCardEditor
        isOpen={showMarkdownEditor}
        initialMarkdown={editingMarkdownContent}
        onSave={handleSaveMarkdownCard}
        onClose={() => {
          setShowMarkdownEditor(false);
          setEditingMarkdownElementId(null);
          setEditingMarkdownContent("");
        }}
      />
    </div>
  );
}
