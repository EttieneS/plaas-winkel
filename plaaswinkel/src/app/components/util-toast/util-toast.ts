import { Component, inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarLabel, MatSnackBarRef } from '@angular/material/snack-bar';

export type UtilToastType = 'success' | 'error' | 'warning' | 'info';
export interface UtilToastData { type: UtilToastType; message: string; }

@Component({
  selector: 'app-util-toast',
  imports: [MatSnackBarLabel],
  templateUrl: './util-toast.html',
  styleUrl: './util-toast.scss',
})
export class UtilToast {
  readonly data = inject<UtilToastData>(MAT_SNACK_BAR_DATA);
  private readonly ref = inject(MatSnackBarRef);
  readonly icons: Record<UtilToastType, string> = {
    success: 'M9 12l2 2 4-4 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    error: 'M9 9l6 6 M15 9l-6 6 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    warning: 'M12 9v4 M12 17h.01 M10.3 3.9L1.8 18.1A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0',
    info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  };

  dismiss(): void { this.ref.dismiss(); }
}
