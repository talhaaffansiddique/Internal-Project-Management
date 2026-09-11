export type UserStatus = 'ACTIVE' | 'INVITED' | 'DISABLED'

export interface Role {
  id: string
  key: string
  name: string
  description?: string
  rank: number
}

export interface Designation {
  id: string
  name: string
  active?: boolean
}

export interface Branch {
  id: string
  name: string
  address: string | null
  active: boolean
}

export interface MasterDataType {
  id: string
  key: string
  name: string
  description?: string
  allowsHierarchy: boolean
  isSystem: boolean
  _count?: { values: number }
}

export interface MasterDataValue {
  id: string
  typeId: string
  key: string
  label: string
  parentId: string | null
  sortOrder: number
  active: boolean
  isSystem: boolean
  meta?: unknown
}

export interface Department {
  id: string
  name: string
  code: string | null
  notes: string | null
  active: boolean
  _count?: { members: number; teams: number }
}

export interface Team {
  id: string
  name: string
  description: string | null
  active: boolean
  department: { id: string; name: string } | null
  _count?: { members: number }
}

export interface TeamMemberView {
  membershipId: string
  id: string
  fullName: string
  email: string
  joinedAt: string
}

export interface TeamDetail extends Team {
  members: TeamMemberView[]
}

export interface AdminUser {
  id: string
  fullName: string
  email: string
  status: UserStatus
  primaryDepartment: { id: string; name: string } | null
  designation: { id: string; name: string } | null
  supervisor: { id: string; fullName: string } | null
  roles: { key: string; name: string }[]
  lastLoginAt: string | null
}

export interface UserLookup {
  id: string
  fullName: string
  email: string
}

export interface FormField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select'
  required?: boolean
  options?: string[]
  help?: string
}

export interface TicketForm {
  type: string
  label: string
  fields: FormField[]
}

export interface ProjectMemberView {
  id: string
  user: { id: string; fullName: string; email: string }
}

export interface Project {
  id: string
  number: number
  title: string
  type: string
  description: string | null
  statusKey: string
  startDate: string | null
  targetDate: string | null
  createdAt: string
  owner: { id: string; fullName: string; email: string }
  members: ProjectMemberView[]
  taskCounts: Record<string, number>
  progress: number
}

export interface Task {
  id: string
  number: number
  projectId: string
  parentTaskId: string | null
  title: string
  description: string | null
  statusKey: string
  dueDate: string | null
  createdAt: string
  assignee: { id: string; fullName: string } | null
  createdBy: { id: string; fullName: string }
  project?: { id: string; number: number; title: string }
  subtasks?: Task[]
}

export type MeetingResponseValue =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'TENTATIVE'

export interface MeetingParticipant {
  id: string
  response: MeetingResponseValue
  respondedAt: string | null
  attended: boolean
  user: { id: string; fullName: string; email: string }
}

export interface Meeting {
  id: string
  number: number
  title: string
  agenda: string | null
  startsAt: string
  endsAt: string
  location: string | null
  onlineLink: string | null
  minutes: string | null
  organizer: { id: string; fullName: string; email: string }
  project: { id: string; number: number; title: string } | null
  participants: MeetingParticipant[]
}

export type TrainingAckValue = 'PENDING' | 'CONFIRMED' | 'NEEDS_FOLLOW_UP'

export interface TrainingParticipant {
  id: string
  ackStatus: TrainingAckValue
  ackAt: string | null
  ackComment: string | null
  user: { id: string; fullName: string; email: string }
}

export interface TrainingChecklistItem {
  id: string
  label: string
  done: boolean
  doneAt: string | null
  sortOrder: number
}

export interface Training {
  id: string
  number: number
  topic: string
  description: string | null
  categoryKey: string | null
  type: 'INDIVIDUAL' | 'GROUP'
  statusKey: string
  scheduledAt: string | null
  completedAt: string | null
  createdAt: string
  trainer: { id: string; fullName: string; email: string }
  createdBy: { id: string; fullName: string }
  participants: TrainingParticipant[]
  checklist: TrainingChecklistItem[]
}

export type ProcurementStatusValue =
  | 'SUBMITTED'
  | 'AWAITING_DIRECTOR'
  | 'WITH_PURCHASING'
  | 'AWAITING_FINAL_APPROVAL'
  | 'ORDERED'
  | 'DELIVERED'
  | 'REJECTED'

export interface ProcurementQuotation {
  id: string
  vendorName: string
  amount: number
  quotationDate: string | null
  validUntil: string | null
  paymentTerms: string | null
  deliveryTime: string | null
  comments: string | null
  attachmentId: string | null
  status: 'PENDING' | 'SELECTED' | 'REJECTED'
  createdBy: { id: string; fullName: string }
  createdAt: string
}

export interface ProcurementItem {
  id: string
  type: 'PRODUCT' | 'SERVICE'
  description: string
  quantity: string | null
}

export interface ProcurementRequest {
  id: string
  number: number
  businessReason: string
  statusKey: ProcurementStatusValue
  createdAt: string
  requester: { id: string; fullName: string; email: string }
  assignedTo: { id: string; fullName: string; email: string } | null
  department: { id: string; name: string } | null
  items: ProcurementItem[]
  quotations: ProcurementQuotation[]
}

export interface Ticket {
  id: string
  number: number
  subject: string
  type: string
  description: string | null
  fields: Record<string, string> | null
  visibility: 'PRIVATE' | 'TEAM'
  statusKey: string
  categoryId: string | null
  createdAt: string
  requester: { id: string; fullName: string; email: string }
  assignee: { id: string; fullName: string; email: string } | null
  team: { id: string; name: string } | null
  closedBy?: { id: string; fullName: string } | null
  closedAt?: string | null
  reopenReason?: string | null
  form?: TicketForm | null
  allowedTransitions?: string[]
  permissions?: { mayAct: boolean; isAdmin: boolean }
}
