/** DTOs shared between API responses and client components. */

export type StatusDTO = {
  key: string;
  label: string;
  color: string;
  group: string;
  isTerminal: boolean;
  isResolved: boolean;
};

export type StatusGroupDTO = { key: string; label: string; color: string; count: number };

export type CategoryDTO = {
  id: string;
  slug: string;
  name: string;
  color: string;
  notice: string | null;
  isSensitive: boolean;
  children: { id: string; slug: string; name: string; notice: string | null }[];
};

export type CategoryFacet = { slug: string; name: string; color: string; count: number };

export type MapReportDTO = {
  id: string;
  number: string;
  title: string;
  excerpt: string;
  lat: number;
  lng: number;
  status: string;
  group: string;
  color: string;
  statusLabel: string;
  category: string;
  createdAt: string;
  photos: string[]; // URLs to /api/files/:id
};

export type ListReportDTO = {
  id: string;
  number: string;
  title: string;
  excerpt: string;
  status: StatusDTO;
  category: { slug: string; name: string; color: string };
  address: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  updatedAt: string;
  photo: string | null;
  photoCount: number;
};

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number; pages: number };

export type AttachmentDTO = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
  isImage: boolean;
  isPublic: boolean;
  kind: "CITIZEN" | "ADMIN";
  createdAt: string;
};

export type HistoryEntryDTO = {
  id: string;
  at: string;
  status: StatusDTO;
  note: string | null;
  isPublic: boolean;
  actorName: string | null;
};

export type CommentDTO = {
  id: string;
  kind: "UPDATE" | "RESPONSE" | "NOTE" | "CITIZEN";
  visibility: "PUBLIC" | "INTERNAL";
  body: string;
  at: string;
  authorName: string | null;
};

export type ReportDetailDTO = {
  id: string;
  number: string;
  title: string;
  description: string;
  isPublic: boolean;
  status: StatusDTO;
  category: { id: string; slug: string; name: string; color: string };
  subcategory: { id: string; name: string } | null;
  location: {
    lat: number;
    lng: number;
    street: string | null;
    streetNumber: string | null;
    district: string | null;
    formattedAddress: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  dueAt: string | null;
  redirectedTo: string | null;
  resolution: string | null;
  history: HistoryEntryDTO[];
  comments: CommentDTO[];
  attachments: AttachmentDTO[];
  viewer: { isOwner: boolean; isStaff: boolean; canComment: boolean };
};

export type AdminReportDetailDTO = ReportDetailDTO & {
  reporter: { id: string; name: string; email: string | null; phone: string | null } | null;
  department: { id: string; name: string } | null;
  assignee: { id: string; name: string } | null;
  transitions: { key: string; label: string; color: string; requiresComment: boolean }[];
  canProcess: boolean;
  canAssign: boolean;
  canEdit: boolean;
  audit: { id: string; action: string; at: string; actorName: string | null; data: unknown }[];
};

export type NotificationDTO = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};
