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
