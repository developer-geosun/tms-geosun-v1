import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule
  ]
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly hasSuccess = signal(false);
  readonly errorCode = signal<'401' | '403' | 'generic' | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  submit(): void {
    if (this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorCode.set(null);
    this.hasSuccess.set(false);
    this.isLoading.set(true);

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.hasSuccess.set(true);
        this.router.navigate(['/main']);
      },
      error: (error: { status?: number }) => {
        this.isLoading.set(false);
        this.errorCode.set(this.mapErrorCode(error.status));
      }
    });
  }

  private mapErrorCode(status?: number): '401' | '403' | 'generic' {
    if (status === 401) {
      return '401';
    }
    if (status === 403) {
      return '403';
    }
    return 'generic';
  }
}
