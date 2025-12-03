// Core types for the Excalidraw Enterprise app
// These are designed to mirror the Prisma schema from todo.md
// but work with local storage for now

// We'll use a simplified type for elements since the internal types aren't exported
export type ExcalidrawElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
};

// ============ Enums ============
export type OrgRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type BoardRole = "OWNER" | "EDITOR" | "VIEWER";

// ============ Core Entities ============

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: string; // ISO date string
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface Membership {
  id: string;
  orgId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  orgId: string;
  ownerId: string;
  title: string;
  description: string | null;
  tags: string[];
  isArchived: boolean;
  thumbnail: string | null; // Base64 data URL for preview
  currentVersionId: string | null;
  versionNumber: number;
  etag: string;
  createdAt: string;
  updatedAt: string;
}

// Stripped AppState - we don't want to save volatile fields
export interface PersistedAppState {
  viewBackgroundColor?: string;
  gridSize?: number | null;
  gridStep?: number;
  gridModeEnabled?: boolean;
  theme?: "light" | "dark";
  zenModeEnabled?: boolean;
  viewModeEnabled?: boolean;
  // Add other non-volatile fields as needed
}

export interface BoardVersion {
  id: string;
  boardId: string;
  version: number;
  createdById: string;
  createdAt: string;
  sceneJson: {
    elements: ExcalidrawElement[];
  };
  appStateJson: PersistedAppState | null;
  thumbnailUrl: string | null;
  label?: string; // Optional checkpoint label
}

export interface BoardPermission {
  id: string;
  boardId: string;
  membershipId: string;
  role: BoardRole;
}

export interface AuditEvent {
  id: string;
  orgId: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ============ Extended Types with Relations ============

export interface BoardWithDetails extends Board {
  owner?: User;
  org?: Organization;
  latestVersion?: BoardVersion;
}

export interface MembershipWithDetails extends Membership {
  user?: User;
  org?: Organization;
}

// ============ API Request/Response Types ============

export interface SaveBoardRequest {
  elements: ExcalidrawElement[];
  appState: Record<string, unknown>;
  clientEtag: string;
  label?: string; // Optional checkpoint label
}

export interface SaveBoardResponse {
  success: boolean;
  board: Board;
  version: BoardVersion;
  conflict?: boolean;
  latestEtag?: string;
}

export interface BoardListParams {
  search?: string;
  tag?: string;
  archived?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "updatedAt" | "createdAt" | "title";
  sortDir?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============ Save Status ============

export type SaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "conflict"
  | "offline";

export interface SaveState {
  status: SaveStatus;
  lastSaved: string | null;
  error: string | null;
  conflictData?: {
    serverVersion: BoardVersion;
    localElements: ExcalidrawElement[];
  };
}

// ============ Files/Assets ============

export interface FileManifestEntry {
  id: string;
  mimeType: string;
  dataURL?: string;
  created?: number;
}

// ============ Draft Type ============

export interface LocalDraft {
  elements: ExcalidrawElement[];
  appState: PersistedAppState;
  timestamp: number;
}
