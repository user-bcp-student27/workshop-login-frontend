import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SessionService } from '../services/session.service';
import { AuthService } from '../services/auth.service';
import { Preferences } from '../models/api.models';
import { appConfig } from '../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username: string | null | undefined = '';
  password: string | null | undefined = '';
  busy = false;
  message = '';
  preferences: Preferences;

  constructor(
    private router: Router,
    private session: SessionService,
    private auth: AuthService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.preferences = this.session.readPreferences();
  }

  async login(): Promise<void> {
    this.message = '';
    if (this.username === null || this.username === undefined || String(this.username).trim() === '') {
      this.message = 'Ingrese un usuario.';
      return;
    }
    if (this.password === null || this.password === undefined || String(this.password).trim() === '') {
      this.message = 'Ingrese una contraseña.';
      return;
    }
    this.busy = true;
    try {
      const response = await this.auth.login(this.username, this.password);
      if (!response?.token) {
        this.message = 'El backend respondió sin token.';
        return;
      }
      this.session.saveSession(response.token, response.user, this.preferences);
      await this.zone.run(() => this.router.navigate([appConfig.routes.dashboard]));
    } catch {
      this.message = 'No se pudo autenticar a ' + this.username + '. Intente nuevamente.';
    } finally {
      this.zone.run(() => {
        this.busy = false;
        this.cdr.detectChanges();
      });
    }
  }

  get cleanupWarning(): string {
    return this.session.cleanupFailed ? appConfig.cleanupWarning : '';
  }
}
