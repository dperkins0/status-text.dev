/**
 * Type definitions for the application
 */

export interface User {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  created_at: number;
  avatar_url: string | null;
}

export interface PublicUser {
  id: string;
  username: string;
  avatar_url: string | null;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: number;
  accepted_at: number | null;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface StatusUpdate {
  id: string;
  user_id: string;
  status_text: string;
  status_type: StatusType;
  created_at: number;
}

export type StatusType =
  | 'online'
  | 'away'
  | 'busy'
  | 'brb'
  | 'phone'
  | 'lunch'
  | 'offline'
  | 'appear_offline';

export interface Session {
  id: string;
  user_id: string;
  created_at: number;
  expires_at: number;
}

export interface FriendWithStatus extends PublicUser {
  status_type: StatusType;
  status_text: string;
  last_updated: number;
}

/**
 * API response types
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface UpdateStatusRequest {
  status_type: StatusType;
  status_text: string;
}
