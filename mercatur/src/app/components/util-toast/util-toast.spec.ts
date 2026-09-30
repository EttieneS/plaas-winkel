import { TestBed } from '@angular/core/testing';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { UtilToast } from './util-toast';

describe('UtilToast presentation', () => {
  for (const type of ['success', 'error', 'warning', 'info']) {
    it(`renders the ${type} icon, readable message, and working close control`, () => {
      const dismiss = vi.fn();
      TestBed.configureTestingModule({
        providers: [
          { provide: MAT_SNACK_BAR_DATA, useValue: { type, message: 'A useful message.' } },
          { provide: MatSnackBarRef, useValue: { dismiss } },
        ],
      });
      const fixture = TestBed.createComponent(UtilToast);
      fixture.detectChanges();
      const element: HTMLElement = fixture.nativeElement;
      expect(element.querySelector('.toast')?.classList.contains(`toast-${type}`)).toBe(true);
      expect(element.querySelector('.toast-icon path')?.getAttribute('d')).toBeTruthy();
      expect(element.querySelector('.toast-message')?.textContent).toBe('A useful message.');
      element.querySelector<HTMLButtonElement>('[aria-label="Dismiss notification"]')!.click();
      expect(dismiss).toHaveBeenCalledTimes(1);
    });
  }

  it('renders backend HTML-like content as text instead of markup', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_SNACK_BAR_DATA, useValue: {
          type: 'error', message: '<img src=x onerror=alert(1)>',
        } },
        { provide: MatSnackBarRef, useValue: { dismiss: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(UtilToast);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
