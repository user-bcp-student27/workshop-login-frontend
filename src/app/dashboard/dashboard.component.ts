import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../services/session.service';
import { TasksService } from '../services/tasks.service';
import { Task, User } from '../models/api.models';
import { prepareTasks } from '../utils/prepare-tasks';
import { appConfig } from '../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  tasks: Task[] = [];
  visibleTasks: Task[] = [];
  user: User = {};
  loading = true;
  error = '';

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private session: SessionService,
    private tasksService: TasksService
  ) {}

  statusLabel(status: string): string {
    return appConfig.statusLabels[(status || '').toUpperCase()] || status;
  }

  async ngOnInit(): Promise<void> {
    const { token, user } = this.session.readSession();
    this.user = user;
    if (!token) {
      await this.router.navigate([appConfig.routes.login]);
      return;
    }
    try {
      const tasks = await this.tasksService.list(this.user.username || '', token);
      const prepared = prepareTasks(tasks);
      this.zone.run(() => {
        this.tasks = prepared.all;
        this.visibleTasks = prepared.visible;
        this.loading = false;
        this.cdr.detectChanges();
      });
    } catch {
      this.zone.run(() => {
        this.error = 'No se pudo cargar el dashboard. Intente nuevamente.';
        this.loading = false;
        this.cdr.detectChanges();
      });
    }
  }

  async logout(): Promise<void> {
    this.session.clearSession();
    await this.router.navigate([appConfig.routes.login]);
  }

  get cleanupWarning(): string {
    return this.session.cleanupFailed ? appConfig.cleanupWarning : '';
  }
}
