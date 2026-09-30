import { Component, computed, inject, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../services/auth.service';

interface DrawerEntry {
  label: string;
  route: string;
  icon: string;
  description: string;
  permission?: string;
}

@Component({
  imports: [RouterLink, RouterLinkActive, MatListModule, MatIconModule],
  selector: 'app-sidebar',
  styleUrl: './sidebar.scss',
  templateUrl: './sidebar.html',
})
export class Sidebar {
  private readonly auth = inject(AuthService);
  readonly navigated = output<void>();
  readonly entries: readonly DrawerEntry[] = [
    { label: 'Sales', route: '/sales', icon: 'storefront', description: 'Browse our beef boxes' },
    { label: 'Users', route: '/users', icon: 'people', description: 'User management', permission: 'users.view' },
  ];
  readonly visibleEntries = computed(() =>
    this.entries.filter((entry) => !entry.permission || this.auth.hasPermission(entry.permission)),
  );
}
