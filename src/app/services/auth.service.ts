import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import { LoginRequest, LoginResponse } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  async login(username: string, password: string): Promise<LoginResponse | undefined> {
    const request: LoginRequest = { username, password, client: environment.client };
    const response = await axios.post<LoginResponse>(environment.loginUrl, request, { timeout: environment.loginTimeout });
    return response?.data;
  }
}