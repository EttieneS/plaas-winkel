import { User } from './user.interface';

export interface UsersPage {
  users: User[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role_ids: number[];
}
