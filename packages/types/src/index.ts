export interface User {
  id: string;
  email: string;
  organizationId: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface Organization {
  id: string;
  name: string;
  createdAt: Date;
}
