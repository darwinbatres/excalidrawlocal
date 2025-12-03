/**
 * Home Page - Boards list with search, filter, and pagination
 * Now using database API instead of localStorage
 */

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useApp } from "@/contexts/AppContext";
import { boardApi, ApiError } from "@/services/api.client";
import type { Board } from "@/types";
import { formatRelativeTime, cn } from "@/lib/utils";

type SortField = "updatedAt" | "createdAt" | "title";

export default function HomePage() {
  const router = useRouter();
  const { user, currentOrg, isLoading, isAuthenticated } = useApp();

  // Hydration check - wait for client mount before rendering dynamic content
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [boards, setBoards] = useState<Board[]>([]);
  const [totalBoards, setTotalBoards] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [error, setError] = useState<string | null>(null);

  // Workspace storage
  const [workspaceStorage, setWorkspaceStorage] = useState<string | null>(null);

  // Per-board storage sizes
  const [boardStorages, setBoardStorages] = useState<Record<string, string>>(
    {}
  );

  // Filters
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortField>("updatedAt");
  const pageSize = 12;

  // Create board modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [newBoardDescription, setNewBoardDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete board confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<Board | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load boards from API
  const loadBoards = useCallback(async () => {
    if (!currentOrg) return;

    setLoading(true);
    setError(null);

    try {
      const result = await boardApi.list({
        orgId: currentOrg.id,
        query: search || undefined,
        archived: showArchived,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });

      setBoards(result.items);
      setTotalBoards(result.total);
      setTotalPages(Math.ceil(result.total / pageSize));

      // Fetch storage for each board
      const storagePromises = result.items.map(async (board) => {
        try {
          const res = await fetch(`/api/boards/${board.id}/storage`);
          if (res.ok) {
            const data = await res.json();
            return { id: board.id, size: data.totalFormatted };
          }
        } catch {
          // Ignore individual failures
        }
        return null;
      });

      const storageResults = await Promise.all(storagePromises);
      const newStorages: Record<string, string> = {};
      for (const result of storageResults) {
        if (result) {
          newStorages[result.id] = result.size;
        }
      }
      setBoardStorages(newStorages);
    } catch (err) {
      console.error("Failed to load boards:", err);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load boards");
      }
    } finally {
      setLoading(false);
    }
  }, [currentOrg, search, showArchived, page]);

  // Load workspace storage
  const loadWorkspaceStorage = useCallback(async () => {
    if (!currentOrg) return;

    try {
      const res = await fetch(
        `/api/orgs/${currentOrg.id}/storage?archived=${showArchived}`,
        {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setWorkspaceStorage(data.totalFormatted);
      }
    } catch (err) {
      console.error("Failed to load workspace storage:", err);
    }
  }, [currentOrg, showArchived]);

  useEffect(() => {
    if (isAuthenticated && currentOrg) {
      loadBoards();
      loadWorkspaceStorage();
    }
  }, [loadBoards, loadWorkspaceStorage, isAuthenticated, currentOrg]);

  // Create board
  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentOrg || !newBoardTitle.trim()) return;

    setCreating(true);
    try {
      const board = await boardApi.create({
        orgId: currentOrg.id,
        title: newBoardTitle.trim(),
        description: newBoardDescription.trim() || undefined,
      });

      setNewBoardTitle("");
      setNewBoardDescription("");
      setShowCreateModal(false);

      // Navigate to the new board
      toast("Board created", {
        description: board.title,
      });
      router.push(`/boards/${board.id}`);
    } catch (err) {
      console.error("Failed to create board:", err);
      toast.error("Failed to create board", {
        description: err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setCreating(false);
    }
  };

  // Archive board
  const handleArchiveBoard = async (boardId: string) => {
    try {
      // Find the board to check its current state
      const board = boards.find((b) => b.id === boardId);
      const isArchiving = !board?.isArchived;
      await boardApi.archive(boardId, isArchiving);
      await loadBoards();
      await loadWorkspaceStorage();
      toast(isArchiving ? "Board archived" : "Board restored", {
        description: board?.title,
      });
    } catch (err) {
      console.error("Failed to archive board:", err);
      toast.error("Failed to archive board", {
        description: err instanceof ApiError ? err.message : "Please try again",
      });
    }
  };

  // Delete board - open confirmation modal
  const openDeleteModal = (board: Board) => {
    setBoardToDelete(board);
    setShowDeleteModal(true);
  };

  // Delete board - confirm and execute
  const handleDeleteBoard = async () => {
    if (!boardToDelete) return;

    setDeleting(true);
    try {
      const deletedTitle = boardToDelete.title;
      await boardApi.delete(boardToDelete.id);
      setShowDeleteModal(false);
      setBoardToDelete(null);
      await loadBoards();
      await loadWorkspaceStorage();
      toast("Board deleted", {
        description: deletedTitle,
      });
    } catch (err) {
      console.error("Failed to delete board:", err);
      toast.error("Failed to delete board", {
        description: err instanceof ApiError ? err.message : "Please try again",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Cleanup board (remove orphaned files)
  const handleCleanupBoard = async (boardId: string) => {
    try {
      const board = boards.find((b) => b.id === boardId);
      const res = await fetch(`/api/boards/${boardId}/cleanup`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.cleaned) {
        toast("Cleanup complete", {
          description: `Removed ${data.filesRemoved} file(s), freed ${data.bytesFreedFormatted}`,
        });
        // Refresh board list and storage info
        loadBoards();
        loadWorkspaceStorage();
      } else {
        toast("Nothing to clean up", {
          description: board?.title || "No orphaned files found",
        });
      }
    } catch (err) {
      console.error("Failed to cleanup board:", err);
      toast.error("Cleanup failed", {
        description: "Please try again",
      });
    }
  };

  // Show loading spinner during SSR hydration and auth check
  if (!mounted || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </Layout>
    );
  }

  if (!user || !currentOrg) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
          <div className="w-full max-w-md mx-4 p-8 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 mb-4">
                <svg
                  className="w-8 h-8 text-indigo-600 dark:text-indigo-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Welcome to Excalidraw
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                Sign in to start creating and managing your boards.
              </p>
            </div>
            <LoginForm />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Your Boards
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-gray-600 dark:text-gray-400">
                {totalBoards} board{totalBoards !== 1 ? "s" : ""} in{" "}
                {currentOrg.name}
              </p>
              {workspaceStorage && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                    />
                  </svg>
                  {workspaceStorage}
                </span>
              )}
            </div>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Board
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex-1 min-w-[200px] max-w-md">
            <Input
              placeholder="Search boards..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortField)}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="updatedAt">Last modified</option>
              <option value="createdAt">Created</option>
              <option value="title">Title</option>
            </select>

            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => {
                  setShowArchived(e.target.checked);
                  setPage(1);
                }}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 dark:bg-gray-800"
              />
              Show archived
            </label>
          </div>
        </div>

        {/* Board Grid */}
        {!boards || boards.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
            <svg
              className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              No boards found
            </h3>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              {search
                ? "Try a different search term"
                : "Create your first board to get started"}
            </p>
            {!search && (
              <Button className="mt-6" onClick={() => setShowCreateModal(true)}>
                Create Board
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(boards || []).map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                storageSize={boardStorages[board.id]}
                onClick={() => router.push(`/boards/${board.id}`)}
                onArchive={() => handleArchiveBoard(board.id)}
                onDelete={() => openDeleteModal(board)}
                onCleanup={() => handleCleanupBoard(board.id)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Create Board Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Board"
      >
        <form onSubmit={handleCreateBoard}>
          <div className="space-y-4">
            <Input
              label="Board title"
              value={newBoardTitle}
              onChange={(e) => setNewBoardTitle(e.target.value)}
              placeholder="My awesome diagram"
              autoFocus
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Description (optional)
              </label>
              <textarea
                value={newBoardDescription}
                onChange={(e) => setNewBoardDescription(e.target.value)}
                placeholder="What's this board about?"
                className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 resize-none"
                rows={3}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
              type="button"
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!newBoardTitle.trim() || creating}>
              {creating ? "Creating..." : "Create Board"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Board Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Board"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete{" "}
            <strong className="text-gray-900 dark:text-gray-100">
              {boardToDelete?.title}
            </strong>
            ?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            This action cannot be undone. All board data and version history
            will be permanently removed.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDeleteBoard}
              disabled={deleting}
              className="!bg-red-600 hover:!bg-red-700 !border-red-600"
            >
              {deleting ? "Deleting..." : "Delete Board"}
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}

// Board Card Component
function BoardCard({
  board,
  storageSize,
  onClick,
  onArchive,
  onDelete,
  onCleanup,
}: {
  board: Board;
  storageSize?: string;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onCleanup: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={cn(
        "group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-lg hover:border-gray-200 dark:hover:border-gray-700 transition-all cursor-pointer",
        board.isArchived && "opacity-60"
      )}
    >
      {/* Preview area */}
      <div
        onClick={onClick}
        className="h-36 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center overflow-hidden"
      >
        {board.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={board.thumbnail}
            alt={`Preview of ${board.title}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg
            className="w-12 h-12 text-gray-300 dark:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className="p-4" onClick={onClick}>
        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
          {board.title}
          {board.isArchived && (
            <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded">
              Archived
            </span>
          )}
        </h3>
        {board.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
            {board.description}
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Updated {formatRelativeTime(board.updatedAt)}
          </p>
          {storageSize && (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                />
              </svg>
              {storageSize}
            </span>
          )}
        </div>
      </div>

      {/* Menu */}
      <div className="absolute top-2 right-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1.5 rounded-lg bg-white/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-10 overflow-hidden">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                {board.isArchived ? "Unarchive" : "Archive"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCleanup();
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                Clean up storage
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Login Form - Uses NextAuth credentials provider
function LoginForm() {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-3 p-4 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/30">
          <svg
            className="w-5 h-5 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </div>
      )}
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        disabled={loading}
        autoComplete="email"
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        disabled={loading}
        autoComplete="current-password"
      />
      <Button
        type="submit"
        className="w-full mt-2"
        size="lg"
        disabled={!email.trim() || !password.trim() || loading}
        isLoading={loading}
      >
        Sign In
      </Button>
    </form>
  );
}
