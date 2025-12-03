import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useApp } from "@/contexts/AppContext";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";

// Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

export function Header() {
  const {
    user,
    currentOrg,
    userOrgs,
    switchOrg,
    createOrg,
    renameOrg,
    deleteOrg,
    logout,
  } = useApp();
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [orgToRename, setOrgToRename] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [orgToDelete, setOrgToDelete] = useState<{
    id: string;
    name: string;
    boardCount: number;
  } | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Don't render the header if user is not authenticated
  if (!user) {
    return null;
  }

  const handleNameChange = (name: string) => {
    setNewOrgName(name);
    // Auto-generate slug from name
    setNewOrgSlug(generateSlug(name));
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const orgName = newOrgName.trim();
      await createOrg(orgName, newOrgSlug.trim());
      setNewOrgName("");
      setNewOrgSlug("");
      setShowNewOrgModal(false);
      toast("Workspace created", {
        description: orgName,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create organization"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!orgToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const deletedName = orgToDelete.name;
      await deleteOrg(orgToDelete.id);
      setOrgToDelete(null);
      setShowDeleteConfirm(false);
      toast("Workspace deleted", {
        description: deletedName,
      });
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete workspace"
      );
    } finally {
      setDeleting(false);
    }
  };

  const openRenameModal = (org: { id: string; name: string }) => {
    setOrgToRename(org);
    setRenameValue(org.name);
    setRenameError(null);
    setShowRenameModal(true);
    setShowOrgDropdown(false);
  };

  const handleRenameOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgToRename || !renameValue.trim()) return;

    setRenaming(true);
    setRenameError(null);

    try {
      const newName = renameValue.trim();
      await renameOrg(orgToRename.id, newName);
      setOrgToRename(null);
      setRenameValue("");
      setShowRenameModal(false);
      toast("Workspace renamed", {
        description: newName,
      });
    } catch (err) {
      setRenameError(
        err instanceof Error ? err.message : "Failed to rename workspace"
      );
    } finally {
      setRenaming(false);
    }
  };

  const openDeleteConfirm = (org: {
    id: string;
    name: string;
    boardCount?: number;
  }) => {
    setOrgToDelete({
      id: org.id,
      name: org.name,
      boardCount: org.boardCount || 0,
    });
    setDeleteError(null);
    setShowDeleteConfirm(true);
    setShowOrgDropdown(false);
  };

  // Can delete if: user owns the org, org has no boards, and user has more than 1 org
  const canDeleteOrg = (org: {
    id: string;
    role: string;
    boardCount?: number;
  }) => {
    return (
      org.role === "OWNER" && (org.boardCount || 0) === 0 && userOrgs.length > 1
    );
  };

  // Can rename if user owns the org
  const canRenameOrg = (org: { role: string }) => {
    return org.role === "OWNER";
  };

  return (
    <>
      <header className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-4 justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-xl font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            Excalidraw
          </Link>

          {currentOrg && (
            <div className="relative">
              <button
                onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <span className="font-medium">{currentOrg.name}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    showOrgDropdown ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showOrgDropdown && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-50 overflow-hidden">
                  <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Workspaces
                  </div>
                  {(userOrgs || []).map((org) => (
                    <div
                      key={org.id}
                      className={`group flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                        org.id === currentOrg.id
                          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <button
                        onClick={() => {
                          switchOrg(org.id);
                          setShowOrgDropdown(false);
                        }}
                        className="flex-1 text-left flex items-center gap-2"
                      >
                        <span className="truncate">{org.name}</span>
                        {org.id === currentOrg.id && (
                          <svg
                            className="w-4 h-4 shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </button>
                      <div className="flex items-center gap-0.5">
                        {canRenameOrg(org) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRenameModal(org);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
                            title="Rename workspace"
                          >
                            <svg
                              className="w-4 h-4"
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
                          </button>
                        )}
                        {canDeleteOrg(org) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteConfirm(org);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-all"
                            title="Delete workspace"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-gray-100 dark:border-gray-700 my-2" />
                  <button
                    onClick={() => {
                      setShowOrgDropdown(false);
                      setShowNewOrgModal(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
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
                    Create workspace
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {user.name || user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                Sign out
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Create Org Modal */}
      <Modal
        isOpen={showNewOrgModal}
        onClose={() => setShowNewOrgModal(false)}
        title="Create Workspace"
      >
        <form onSubmit={handleCreateOrg}>
          {error && (
            <div className="mb-4 flex items-center gap-3 p-4 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/30">
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
            label="Workspace name"
            value={newOrgName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="My Workspace"
            autoFocus
            disabled={creating}
          />
          <div className="mt-3">
            <Input
              label="URL slug"
              value={newOrgSlug}
              onChange={(e) =>
                setNewOrgSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")
                )
              }
              placeholder="my-workspace"
              disabled={creating}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowNewOrgModal(false)}
              type="button"
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!newOrgName.trim() || !newOrgSlug.trim() || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Workspace Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Workspace"
      >
        <div className="space-y-4">
          {deleteError && (
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
              {deleteError}
            </div>
          )}
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to delete{" "}
            <strong className="text-gray-900 dark:text-gray-100">
              {orgToDelete?.name}
            </strong>
            ?
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            This action cannot be undone. All workspace settings and memberships
            will be permanently removed.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDeleteOrg}
              disabled={deleting}
              className="bg-red-600! hover:bg-red-700! border-red-600!"
            >
              {deleting ? "Deleting..." : "Delete Workspace"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rename Workspace Modal */}
      <Modal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        title="Rename Workspace"
      >
        <form onSubmit={handleRenameOrg}>
          {renameError && (
            <div className="mb-4 flex items-center gap-3 p-4 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/30">
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
              {renameError}
            </div>
          )}
          <Input
            label="Workspace name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="My Workspace"
            autoFocus
            disabled={renaming}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowRenameModal(false)}
              type="button"
              disabled={renaming}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!renameValue.trim() || renaming}>
              {renaming ? "Renaming..." : "Rename"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
