import { Injectable } from '@angular/core';
import merge from 'lodash/merge';
import { Preferences, User } from '../models/api.models';

const STORAGE_KEYS = {
  token: 'workshop_token',
  user: 'workshop_user',
  preferences: 'workshop_preferences'
};

@Injectable({ providedIn: 'root' })
export class SessionService {
  private token: string | null = null;
  private user: User = {};
  private legacyCleanupFailed = false;

  constructor() {
    this.clearSession();
  }

  readSession(): { token: string | null; user: User } {
    return { token: this.token, user: this.user };
  }

  get cleanupFailed(): boolean {
    return this.legacyCleanupFailed;
  }

  saveSession(token: string, user: User | undefined, preferences: Preferences): void {
    this.token = token;
    this.user = user ?? {};
    localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(preferences));
  }

  readPreferences(): Preferences {
    const defaults: Preferences = { theme: 'light', showTips: true, compact: false };
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences) || '{}');
      return merge(defaults, saved);
    } catch {
      return defaults;
    }
  }

  clearSession(): void {
    this.token = null;
    this.user = {};
    this.cleanupLegacySession();
  }

  private cleanupLegacySession(): void {
    let failed = false;
    for (const key of [STORAGE_KEYS.token, STORAGE_KEYS.user]) {
      try {
        localStorage.removeItem(key);
      } catch {
        failed = true;
      }
    }
    this.legacyCleanupFailed = failed;
  }
}