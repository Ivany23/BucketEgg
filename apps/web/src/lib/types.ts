/**
 * Tipos das RESPOSTAS da API (os pedidos estão em api-schema.d.ts, gerado do OpenAPI).
 * Escritos a partir de respostas reais da API (dados de demonstração, 12/10/2026).
 */
export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'ANALYST' | 'FIELD_REP';
export type OutletStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | 'REJECTED';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'CANCELLED';
export type OrderStatus = 'DRAFT' | 'SUBMITTED' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CARD';
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'photo' | 'select';
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ImportKind = 'DATASET' | 'OUTLETS';

export interface Page<T> {
  data: T[];
  meta: { total: number; page?: number; limit: number; pages?: number; nextCursor?: string | null };
}

export interface Person {
  id: string;
  name: string | null;
  email?: string;
}

export interface LoginResponse {
  access_token: string;
  user: { id: string; email: string; name: string | null };
  organization: { id: string; name: string; role: Role } | null;
  needsOnboarding: boolean;
}

export interface Me {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  createdAt: string;
  memberships: { id: string; role: Role; organization: { id: string; name: string; slug: string } }[];
  activeOrganizationId: string | null;
  activeRole: Role | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  geofenceRadiusM: number;
  createdAt: string;
  updatedAt: string;
  _count?: { projects: number; memberships: number; products?: number };
  /** Em GET /organizations: o meu papel nesta organização. */
  memberships?: { role: Role }[];
}

export interface Project {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  isArchived: boolean;
  orderSeq: number;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { datasets: number; outlets: number; beats: number; routes: number; orders: number };
}

export interface MemberRef {
  id: string;
  role: Role;
  user: Person;
}

export interface Member {
  id: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  user: { id: string; email: string; name: string | null; phone: string | null; isActive: boolean };
  supervisors: MemberRef[];
  supervising: MemberRef[];
}

export interface Outlet {
  id: string;
  code: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  contactName: string | null;
  channel: string | null;
  outletClass: string | null;
  visitFrequencyDays: number;
  latitude: number | null;
  longitude: number | null;
  status: OutletStatus;
  potentialScore: number;
  zone: string | null;
  lastVisitedAt: string | null;
  creditLimit: number;
  balance: number;
  projectId: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OverdueOutlet extends Outlet {
  daysSinceLastVisit: number | null;
  overdueDays: number;
  priority: number;
}

export interface NearbyOutlet extends Outlet {
  distanceM: number;
}

export interface Payment {
  id: string;
  outletId: string;
  userId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

export interface OutletDetail extends Outlet {
  visits: (Visit & { user?: Person })[];
  orders: (Pick<Order, 'id' | 'number' | 'status' | 'total' | 'createdAt'> & Partial<Order>)[];
  payments: Payment[];
  beatStops: { beatId: string; beat?: { id: string; name: string } }[];
}

export interface Beat {
  id: string;
  name: string;
  description: string | null;
  weekdays: number[];
  projectId: string;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: Person | null;
  _count?: { outlets: number; routes: number };
}

export interface BeatDetail extends Beat {
  outlets: { beatId: string; outletId: string; orderIndex: number; outlet: Outlet }[];
}

export interface Task {
  id: string;
  title: string | null;
  notes: string | null;
  status: TaskStatus;
  dueDate: string;
  routeId: string | null;
  orderIndex: number;
  estArrival: string | null;
  projectId: string;
  outletId: string;
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
  outlet: Outlet;
  route?: { id: string; name: string } | null;
  visits: { id: string; checkInAt: string; checkOutAt: string | null }[];
}

export interface RouteSummary {
  id: string;
  name: string;
  date: string;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  totalDistance: number | null;
  estimatedMins: number | null;
  optimizedBy: 'GOOGLE' | 'NEAREST_NEIGHBOUR' | null;
  projectId: string;
  assigneeId: string;
  beatId: string | null;
  createdAt: string;
  assignee: Person;
  stops: number;
  completed: number;
}

export interface RouteDetail extends Omit<RouteSummary, 'stops' | 'completed'> {
  tasks: Task[];
}

export interface MyDay {
  date: string;
  total: number;
  completed: number;
  tasks: Task[];
}

export interface Visit {
  id: string;
  projectId: string;
  outletId: string;
  userId: string;
  taskId: string | null;
  checkInAt: string;
  checkInLat: number | null;
  checkInLng: number | null;
  distanceM: number | null;
  withinGeofence: boolean;
  checkOutAt: string | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  durationMins: number | null;
  isProductive: boolean;
  noOrderReason: string | null;
  notes: string | null;
  photoUrls: string[];
  outlet?: { id: string; name: string; zone?: string | null; latitude?: number | null; longitude?: number | null };
  user?: Person;
  _count?: { orders: number };
}

export interface AttendanceDay {
  date: string;
  present: number;
  absent: Person[];
  records: {
    id: string;
    userId: string;
    projectId: string;
    date: string;
    clockInAt: string;
    clockInLat: number | null;
    clockInLng: number | null;
    clockOutAt: string | null;
    clockOutLat: number | null;
    clockOutLng: number | null;
    selfieUrl: string | null;
    user: Person;
  }[];
}

export interface Product {
  id: string;
  organizationId: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  unit: string;
  price: number;
  taxRate: number;
  isActive: boolean;
  isMustSell: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  projectId: string;
  outletId: string;
  userId: string;
  visitId: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  outlet: { id: string; name: string; address?: string | null; phone?: string | null };
  user: Person;
  _count?: { items: number };
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  lineTotal: number;
  product: { id?: string; sku: string; name: string; unit?: string };
}

export interface OrderDetail extends Order {
  items: OrderItem[];
}

export interface CreatedOrder extends OrderDetail {
  missingMustSell: { id: string; sku: string; name: string }[];
}

export interface Statement {
  outlet: { id: string; name: string; creditLimit: number };
  totalOrdered: number;
  totalPaid: number;
  balance: number;
  orders: { id: string; number: string; total: number; status: OrderStatus; createdAt: string }[];
  payments: Payment[];
}

export interface SuggestedOrder {
  basedOnOrders: number;
  items: {
    productId: string;
    sku: string;
    name: string;
    price: number;
    suggestedQuantity: number;
    reason: string;
    frequency: number;
  }[];
}

export interface FieldDef {
  type: FieldType;
  label: string;
  active: boolean;
  originalName?: string;
}
export type DatasetSchema = Record<string, FieldDef>;

export interface Dataset {
  id: string;
  name: string;
  schema: DatasetSchema;
  status: 'PROCESSING' | 'READY' | 'FAILED';
  rowCount: number;
  createdAt: string;
}

export interface DataRecord {
  id: string;
  seq: string;
  data: Record<string, unknown>;
  outletId: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  createdAt: string;
  submittedBy: Person | null;
  updatedAt: string | null;
  updatedBy: Person | null;
  deletedAt: string | null;
  revisions: number;
}

export interface RecordsPage extends Page<DataRecord> {
  schema: DatasetSchema;
  status: Dataset['status'];
  canEdit: boolean;
}

export interface RecordHistory {
  id: string;
  seq: string;
  data: Record<string, unknown>;
  createdAt: string;
  submittedBy: Person | null;
  deletedAt: string | null;
  revisions: {
    id: string;
    action: 'UPDATE' | 'DELETE' | 'RESTORE';
    previousData: { data: Record<string, unknown>; outletId: string | null } | null;
    newData: { data: Record<string, unknown>; outletId: string | null } | null;
    reason: string | null;
    createdAt: string;
    editedBy: Person;
  }[];
}

export interface ImportJob {
  id: string;
  organizationId: string;
  projectId: string;
  datasetId: string | null;
  createdById: string;
  kind: ImportKind;
  status: JobStatus;
  fileName: string;
  fileSize: number | string;
  format: string;
  sheetName: string | null;
  targetName: string | null;
  rowsProcessed: number;
  rowsFailed: number;
  rowErrors?: { row: number; error: string }[] | null;
  error: string | null;
  cancelRequested: boolean;
  attempts: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface Dashboard {
  period: { from: string; to: string };
  planVsActual: { planned: number; completed: number; missed: number; pending: number; completionRate: number };
  visits: { total: number; productive: number; strikeRate: number; outsideGeofence: number; avgDurationMins: number };
  sales: { orders: number; revenue: number; avgOrderValue: number };
  collections: { payments: number; amount: number };
  outlets: { active: number; pendingApproval: number; visited: number; coverage: number };
  attendanceToday: number;
  leaderboard: {
    user: Person;
    visits: number;
    productiveVisits: number;
    strikeRate: number;
    orders: number;
    revenue: number;
  }[];
}

export interface TrendPoint {
  date: string;
  orders: number;
  revenue: number;
}

/** Rótulos em português para os enums. */
export const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  MANAGER: 'Supervisor',
  ANALYST: 'Analista de dados',
  FIELD_REP: 'Promotor',
};
export const OUTLET_STATUS_LABEL: Record<OutletStatus, string> = {
  PENDING_APPROVAL: 'A aguardar aprovação',
  ACTIVE: 'Ativa',
  INACTIVE: 'Inativa',
  REJECTED: 'Rejeitada',
};
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  PENDING: 'Por visitar',
  IN_PROGRESS: 'Em curso',
  COMPLETED: 'Concluída',
  MISSED: 'Falhada',
  CANCELLED: 'Cancelada',
};
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: 'Rascunho',
  SUBMITTED: 'Submetida',
  CONFIRMED: 'Confirmada',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelada',
};
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Numerário',
  CHEQUE: 'Cheque',
  BANK_TRANSFER: 'Transferência',
  MOBILE_MONEY: 'M-Pesa / e-Mola',
  CARD: 'Cartão',
};
export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  QUEUED: 'Em fila',
  PROCESSING: 'A importar',
  COMPLETED: 'Concluída',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelada',
};
export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  string: 'Texto',
  number: 'Número',
  boolean: 'Sim / Não',
  date: 'Data',
  photo: 'Fotografia',
  select: 'Escolha',
};
export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Papéis que gerem equipa, planeamento e catálogo. */
export const MANAGEMENT_ROLES: Role[] = ['OWNER', 'ADMIN', 'MANAGER'];
/** Papéis que corrigem e exportam dados recolhidos. */
export const DATA_ROLES: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'];
export const ADMIN_ROLES: Role[] = ['OWNER', 'ADMIN'];
