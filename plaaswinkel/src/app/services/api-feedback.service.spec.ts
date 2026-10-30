import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { UtilToastService } from './util-toast.service';
import { of, throwError } from 'rxjs';
import { ApiFeedbackError, ApiFeedbackService } from './api-feedback.service';

describe('API feedback', () => {
  const open = vi.fn();
  const success = vi.fn();
  let feedback: ApiFeedbackService;

  beforeEach(() => {
    open.mockReset();
    success.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: UtilToastService, useValue: { error: open, success } }],
    });
    feedback = TestBed.inject(ApiFeedbackService);
  });

  for (const status of [401, 403, 404, 409, 422, 500]) {
    it(`preserves the backend message and HTTP ${status} on the error channel`, () => {
      const error = vi.fn();
      const next = vi.fn();
      throwError(() => new HttpErrorResponse({
        status, error: { success: false, message: 'The operation cannot proceed.', data: null },
      })).pipe(feedback.forOperation()).subscribe({ next, error });
      expect(next).not.toHaveBeenCalled();
      expect(error.mock.calls[0][0]).toBeInstanceOf(ApiFeedbackError);
      expect(error.mock.calls[0][0].status).toBe(status);
      expect(open).toHaveBeenCalledExactlyOnceWith(
        'The operation cannot proceed.',
      );
    });
  }

  it('includes usable field messages and preserves structured validation errors', () => {
    const error = vi.fn();
    throwError(() => new HttpErrorResponse({
      status: 422,
      error: { message: 'Validation failed.', errors: {
        email: ['Use a valid email.', 'Use a valid email.'],
        password: ['Password is required.'], ignored: [null, 42, ' '],
      } },
    })).pipe(feedback.forOperation()).subscribe({ error });
    expect(open.mock.calls[0][0]).toBe(
      'Validation failed. Use a valid email. Password is required.',
    );
    expect(error.mock.calls[0][0].errors.password).toEqual(['Password is required.']);
  });

  it('uses field messages when no summary is usable', () => {
    throwError(() => new HttpErrorResponse({
      status: 422, error: { message: ' ', errors: { email: ['Email is required.'] } },
    })).pipe(feedback.forOperation()).subscribe({ error: () => {} });
    expect(open.mock.calls[0][0]).toBe('Email is required.');
  });

  for (const body of [null, '<html>Server error</html>', { message: 12 }, { message: ' ' }]) {
    it(`uses a fallback for an unusable error body ${JSON.stringify(body)}`, () => {
      throwError(() => new HttpErrorResponse({ status: 0, error: body }))
        .pipe(feedback.forOperation('Please try again.'))
        .subscribe({ error: () => {} });
      expect(open.mock.calls[0][0]).toBe('Please try again.');
    });
  }

  it('toasts an application failure without turning it into a success', () => {
    const response = { success: false, message: 'Capacity has been reached.', data: null };
    const next = vi.fn();
    of(response).pipe(feedback.forOperation()).subscribe(next);
    expect(next).toHaveBeenCalledWith(response);
    expect(open.mock.calls[0][0]).toBe('Capacity has been reached.');
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('uses the backend success message and preserves the payload', () => {
    const response = { success: true, message: 'Saved successfully.', data: { id: 1 } };
    const next = vi.fn();
    of(response).pipe(feedback.forOperation()).subscribe(next);
    expect(next).toHaveBeenCalledWith(response);
    expect(success).toHaveBeenCalledExactlyOnceWith('Saved successfully.');
    expect(open).not.toHaveBeenCalled();
  });
});
