import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    TranslateModule
  ]
})
export class RegisterComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal(false);
  readonly hasSuccess = signal(false);
  readonly errorCode = signal<'409' | '429' | 'generic' | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  submit(): void {
    if (this.form.invalid || this.isLoading()) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();
    if (values.password !== values.confirmPassword) {
      this.errorCode.set('generic');
      return;
    }

    this.errorCode.set(null);
    this.hasSuccess.set(false);
    this.isLoading.set(true);

    this.authService.register({ email: values.email, password: values.password }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.hasSuccess.set(true);
        this.router.navigate(['/login']);
      },
      error: (error: { status?: number }) => {
        this.isLoading.set(false);
        this.errorCode.set(this.mapErrorCode(error.status));
      }
    });
  }

  private mapErrorCode(status?: number): '409' | '429' | 'generic' {
    if (status === 409) {
      return '409';
    }
    if (status === 429) {
      return '429';
    }
    return 'generic';
  }
}
