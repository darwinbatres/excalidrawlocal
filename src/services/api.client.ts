// =============================================================================
// API Client - Database-backed board operations
// =============================================================================
// This replaces localStorage with real API calls to the database backend
// =============================================================================

import type { Board, BoardVersion } from "@/types";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface BoardSearchParams {
  orgId: string;
  query?: string;
  tags?: string[];
  archived?: boolean;
  limit?: number;
  offset?: number;
}

export interface CreateBoardParams {
  orgId: string;
  title: string;
  description?: string;
  tags?: string[];
  sceneJson?: unknown;
}

export interface UpdateBoardParams {
  title?: string;
  description?: string;
  tags?: string[];
  isArchived?: boolean;
}

export interface SaveVersionParams {
  sceneJson: unknown;
  appStateJson?: unknown;
  label?: string;
  expectedEtag?: string;
  thumbnail?: string; // Base64 data URL for preview
}

export interface SaveVersionResult {
  version: BoardVersion;
  etag: string;
  conflict?: boolean;
  currentEtag?: string;
}

// Extended Board type that includes the latest scene data
export interface BoardWithScene extends Omit<Board, "etag"> {
  latestVersion?: {
    version: number;
    sceneJson: unknown;
    appStateJson?: unknown;
    createdAt: string;
    createdById: string;
  };
  etag?: string;
}

// -----------------------------------------------------------------------------
// API Error class
// -----------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// -----------------------------------------------------------------------------
// Fetch helper with error handling
// -----------------------------------------------------------------------------

async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      error.message || error.error || `Request failed: ${response.status}`,
      error.details
    );
  }

  return response.json();
}

// -----------------------------------------------------------------------------
// Board API
// -----------------------------------------------------------------------------

export const boardApi = {
  /**
   * List boards for an organization
   */
  async list(params: BoardSearchParams): Promise<PaginatedResponse<Board>> {
    const searchParams = new URLSearchParams({
      orgId: params.orgId,
    });

    if (params.query) searchParams.set("query", params.query);
    if (params.tags?.length) searchParams.set("tags", params.tags.join(","));
    if (params.archived !== undefined)
      searchParams.set("archived", String(params.archived));
    if (params.limit !== undefined)
      searchParams.set("limit", String(params.limit));
    if (params.offset !== undefined)
      searchParams.set("offset", String(params.offset));

    return fetchApi<PaginatedResponse<Board>>(
      `/api/boards?${searchParams.toString()}`
    );
  },

  /**
   * Get a single board with its latest version data
   */
  async get(boardId: string): Promise<BoardWithScene> {
    return fetchApi<BoardWithScene>(`/api/boards/${boardId}`);
  },

  /**
   * Create a new board
   */
  async create(params: CreateBoardParams): Promise<Board> {
    return fetchApi<Board>("/api/boards", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  /**
   * Update board metadata (title, description, tags)
   */
  async update(boardId: string, params: UpdateBoardParams): Promise<Board> {
    return fetchApi<Board>(`/api/boards/${boardId}`, {
      method: "PATCH",
      body: JSON.stringify(params),
    });
  },

  /**
   * Archive or unarchive a board
   */
  async archive(boardId: string, archive: boolean = true): Promise<Board> {
    return fetchApi<Board>(`/api/boards/${boardId}`, {
      method: "PATCH",
      body: JSON.stringify({ isArchived: archive }),
    });
  },

  /**
   * Delete a board permanently
   */
  async delete(boardId: string): Promise<void> {
    await fetchApi<void>(`/api/boards/${boardId}`, {
      method: "DELETE",
    });
  },

  /**
   * Save a new version of the board
   */
  async saveVersion(
    boardId: string,
    params: SaveVersionParams
  ): Promise<SaveVersionResult> {
    return fetchApi<SaveVersionResult>(`/api/boards/${boardId}/save`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  /**
   * Get version history for a board
   */
  async getVersions(
    boardId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<PaginatedResponse<BoardVersion>> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined)
      params.set("limit", String(options.limit));
    if (options?.offset !== undefined)
      params.set("offset", String(options.offset));

    const queryString = params.toString();
    const url = `/api/boards/${boardId}/versions${
      queryString ? `?${queryString}` : ""
    }`;

    return fetchApi<PaginatedResponse<BoardVersion>>(url);
  },

  /**
   * Get a specific version
   */
  async getVersion(boardId: string, version: number): Promise<BoardVersion> {
    return fetchApi<BoardVersion>(`/api/boards/${boardId}/versions/${version}`);
  },

  /**
   * Restore a previous version (creates new version with that content)
   */
  async restoreVersion(
    boardId: string,
    version: number
  ): Promise<{ version: BoardVersion; etag: string }> {
    return fetchApi<{ version: BoardVersion; etag: string }>(
      `/api/boards/${boardId}/versions/${version}`,
      { method: "POST" }
    );
  },
};

// Named export for the API client
const apiClient = {
  board: boardApi,
};

// Default export for convenience
export default apiClient;
