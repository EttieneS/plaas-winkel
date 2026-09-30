import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { UtilToastService } from './util-toast.service';
import { UtilToast } from '../components/util-toast/util-toast';

describe('UtilToastService', () => {
  const openFromComponent = vi.fn();
  let dismissed: Subject<void>[];
  let toast: UtilToastService;

  beforeEach(() => {
    dismissed = [];
    openFromComponent.mockReset().mockImplementation(() => {
      const closed = new Subject<void>();
      dismissed.push(closed);
      return { afterDismissed: () => closed.asObservable() };
    });
    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: { openFromComponent } }],
    });
    toast = TestBed.inject(UtilToastService);
  });

  for (const type of ['success', 'error', 'warning', 'info'] as const) {
    it(`shows an accessible top-right ${type} toast with automatic dismissal`, () => {
      toast[type]('A useful message.');
      expect(openFromComponent).toHaveBeenCalledWith(UtilToast, expect.objectContaining({
        data: { type, message: 'A useful message.' },
        verticalPosition: 'top', horizontalPosition: 'right',
        duration: type === 'error' ? 10000 : 5000,
        panelClass: ['util-toast-panel', `util-toast-${type}`],
        announcementMessage: `${type}: A useful message.`,
      }));
    });
  }

  it('queues rapid notifications and opens each only after the previous dismissal', () => {
    toast.success('First');
    toast.error('Second');
    toast.info('Third');
    expect(openFromComponent).toHaveBeenCalledTimes(1);
    dismissed[0].next();
    expect(openFromComponent.mock.calls[1][1].data.message).toBe('Second');
    dismissed[1].next();
    expect(openFromComponent.mock.calls[2][1].data.message).toBe('Third');
    dismissed[2].next();
    expect(openFromComponent).toHaveBeenCalledTimes(3);
  });

  it('gives long errors more reading time and ignores blank messages', () => {
    toast.info(' ');
    expect(openFromComponent).not.toHaveBeenCalled();
    toast.error('A'.repeat(400));
    expect(openFromComponent.mock.calls[0][1].duration).toBe(15000);
  });
});
