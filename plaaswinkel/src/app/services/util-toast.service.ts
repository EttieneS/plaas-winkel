import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UtilToast, UtilToastData, UtilToastType } from '../components/util-toast/util-toast';

@Injectable({ providedIn: 'root' })
export class UtilToastService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly queue: UtilToastData[] = [];
  private active = false;

  success(message: string): void { this.enqueue('success', message); }
  error(message: string): void { this.enqueue('error', message); }
  warning(message: string): void { this.enqueue('warning', message); }
  info(message: string): void { this.enqueue('info', message); }

  private enqueue(type: UtilToastType, message: string): void {
    if (!message.trim()) return;
    this.queue.push({ type, message: message.trim() });
    this.showNext();
  }

  private showNext(): void {
    if (this.active) return;
    const data = this.queue.shift();
    if (!data) return;
    this.active = true;
    const baseDuration = data.type === 'error' ? 10000 : 5000;
    const duration = baseDuration + Math.min(10000, Math.floor(data.message.length / 80) * 1000);
    const ref = this.snackBar.openFromComponent(UtilToast, {
      data,
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['util-toast-panel', `util-toast-${data.type}`],
      announcementMessage: `${data.type}: ${data.message}`,
      politeness: data.type === 'error' ? 'assertive' : 'polite',
    });
    ref.afterDismissed().subscribe(() => {
      this.active = false;
      this.showNext();
    });
  }
}
