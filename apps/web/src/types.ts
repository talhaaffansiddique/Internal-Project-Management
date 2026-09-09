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

export interface Ticket {
  id: string
  number: number
  subject: string
  type: string
  description: string | null
  fields: Record<string, string> | null
  visibility: 'PRIVATE' | 'TEAM'
  priority: string | null
  statusKey: string
  categoryId: string | null
  createdAt: string
  requester: { id: string; fullName: string; email: string }
  assignee: { id: string; fullName: string; email: string } | null
  team: { id: string; name: string } | null
  closedBy?: { id: string; fullName: string } | null
  form?: TicketForm | null
}
