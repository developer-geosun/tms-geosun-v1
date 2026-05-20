import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  CreateScenarioContractRequest,
  FreightScenariosApiService,
  ScenarioContractDto,
  UpdateScenarioContractRequest
} from '../../core/api';
import { firstValueFrom } from 'rxjs';
import { AdminFreightScenarioAiConfirmDialogComponent } from './admin-freight-scenario-ai-confirm-dialog.component';

@Component({
  selector: 'app-admin-freight-calculation-scenarios-ai',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './admin-freight-calculation-scenarios-ai.component.html',
  styleUrl: './admin-freight-calculation-scenarios-ai.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminFreightCalculationScenariosAiComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly scenariosApi = inject(FreightScenariosApiService);
  private readonly dialog = inject(MatDialog);

  readonly displayedColumns = ['name', 'isActive', 'updatedAt', 'actions'];
  readonly isLoading = signal(false);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly actionSuccess = signal('');
  readonly scenarios = signal<ScenarioContractDto[]>([]);
  readonly editingId = signal<string | null>(null);

  /** Клієнтська пагінація таблиці */
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [5, 10, 25, 50];

  readonly pagedScenarios = computed(() => {
    const all = this.scenarios();
    const start = this.pageIndex() * this.pageSize();
    return all.slice(start, start + this.pageSize());
  });

  readonly scenarioForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: [''],
    rulesText: ['', Validators.required],
    outputFormatHint: ['JSON'],
    isActive: [true]
  });

  constructor() {
    void this.loadScenarios();
  }

  async loadScenarios(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set('');
    try {
      this.scenarios.set(await this.scenariosApi.list(false));
      this.clampPageIndex();
    } catch {
      this.scenarios.set([]);
      this.pageIndex.set(0);
      this.loadError.set('pages.adminFreightScenariosAi.loadFailed');
    } finally {
      this.isLoading.set(false);
    }
  }

  onScenariosPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.clampPageIndex();
  }

  /** Після зміни списку або pageSize — не залишаємось на порожній сторінці */
  private clampPageIndex(): void {
    const total = this.scenarios().length;
    const size = this.pageSize();
    const maxIndex = Math.max(0, Math.ceil(total / size) - 1);
    if (this.pageIndex() > maxIndex) {
      this.pageIndex.set(maxIndex);
    }
  }

  startCreate(): void {
    this.editingId.set(null);
    this.scenarioForm.reset({
      name: '',
      description: '',
      rulesText: '',
      outputFormatHint: 'JSON',
      isActive: true
    });
  }

  startEdit(scenario: ScenarioContractDto): void {
    this.editingId.set(scenario.id);
    this.scenarioForm.patchValue({
      name: scenario.name,
      description: scenario.description ?? '',
      rulesText: scenario.rulesText,
      outputFormatHint: scenario.outputFormatHint ?? 'JSON',
      isActive: scenario.isActive
    });
  }

  async saveScenario(): Promise<void> {
    if (this.scenarioForm.invalid) {
      this.actionError.set('pages.adminFreightScenariosAi.validationError');
      return;
    }
    this.actionError.set('');
    this.actionSuccess.set('');
    const values = this.scenarioForm.getRawValue();
    try {
      const editingId = this.editingId();
      if (editingId) {
        const payload: UpdateScenarioContractRequest = {
          name: values.name.trim(),
          description: values.description.trim() || null,
          rulesText: values.rulesText,
          outputFormatHint: values.outputFormatHint.trim() || null,
          isActive: values.isActive
        };
        await this.scenariosApi.update(editingId, payload);
        this.actionSuccess.set('pages.adminFreightScenariosAi.updated');
      } else {
        const payload: CreateScenarioContractRequest = {
          name: values.name.trim(),
          description: values.description.trim() || null,
          rulesText: values.rulesText,
          outputFormatHint: values.outputFormatHint.trim() || null,
          isActive: values.isActive
        };
        await this.scenariosApi.create(payload);
        this.actionSuccess.set('pages.adminFreightScenariosAi.created');
      }
      this.editingId.set(null);
      this.scenarioForm.reset({
        name: '',
        description: '',
        rulesText: '',
        outputFormatHint: 'JSON',
        isActive: true
      });
      await this.loadScenarios();
    } catch {
      this.actionError.set('pages.adminFreightScenariosAi.saveFailed');
    }
  }

  async deleteScenario(scenario: ScenarioContractDto): Promise<void> {
    const confirmed = await this.openConfirmDialog('pages.adminFreightScenariosAi.deleteConfirm');
    if (!confirmed) {
      return;
    }
    this.actionError.set('');
    try {
      await this.scenariosApi.delete(scenario.id);
      if (this.editingId() === scenario.id) {
        this.startCreate();
      }
      await this.loadScenarios();
      this.actionSuccess.set('pages.adminFreightScenariosAi.deleted');
    } catch {
      this.actionError.set('pages.adminFreightScenariosAi.deleteFailed');
    }
  }

  async onImportFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.actionError.set('');
    try {
      await this.scenariosApi.importFile(file);
      await this.loadScenarios();
      this.actionSuccess.set('pages.adminFreightScenariosAi.imported');
    } catch {
      this.actionError.set('pages.adminFreightScenariosAi.importFailed');
    }
  }

  async backToRouteRequests(): Promise<void> {
    await this.router.navigate(['/admin/route-requests']);
  }

  private openConfirmDialog(messageKey: string): Promise<boolean> {
    const ref = this.dialog.open(AdminFreightScenarioAiConfirmDialogComponent, {
      data: { messageKey }
    });
    return firstValueFrom(ref.afterClosed()).then((result) => Boolean(result));
  }
}
