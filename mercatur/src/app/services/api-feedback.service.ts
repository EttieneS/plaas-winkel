import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { UtilToastService } from './util-toast.service';
import { MonoTypeOperatorFunction, catchError, tap, throwError } from 'rxjs';
import { ApiResponse } from '../interfaces/api-response.interface';

export class ApiFeedbackError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiFeedbackError';
  }
}

@Injectable({ providedIn: 'root' })
export class ApiFeedbackService {
  private readonly toast = inject(UtilToastService);

  forOperation<T>(
    fallback = 'Unable to complete the request. Please try again.',
    successToast = true,
  ): MonoTypeOperatorFunction<ApiResponse<T>> {
    return (source) =>
      source.pipe(
        tap((response) => {
          if (response.success) {
            const message = this.usableMessage(response.message);
            if (message && successToast) this.toast.success(message);
          } else {
            this.toast.error(this.normalize(response, 200, fallback).message);
          }
        }),
        catchError((error: unknown) => {
          const normalized =
            error instanceof ApiFeedbackError
              ? error
              : this.normalize(
                  error instanceof HttpErrorResponse ? error.error : null,
                  error instanceof HttpErrorResponse ? error.status : 0,
                  fallback,
                );
          this.toast.error(normalized.message);
          return throwError(() => normalized);
        }),
      );
  }

  private normalize(body: unknown, status: number, fallback: string): ApiFeedbackError {
    const response =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {};
    const errors: Record<string, string[]> = {};
    if (typeof response['errors'] === 'object' && response['errors'] !== null) {
      for (const [field, messages] of Object.entries(response['errors'])) {
        if (Array.isArray(messages)) {
          const usable = messages
            .map((message: unknown) => this.usableMessage(message))
            .filter((message): message is string => message !== null);
          if (usable.length) errors[field] = usable;
        }
      }
    }
    const message = this.usableMessage(response['message']);
    const messages = [...new Set([...(message ? [message] : []), ...Object.values(errors).flat()])];
    return new ApiFeedbackError(messages.join(' ') || fallback, status, errors);
  }

  private usableMessage(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

}
