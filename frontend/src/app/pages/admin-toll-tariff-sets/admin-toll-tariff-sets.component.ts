import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import {
  CountryReferenceApiService,
  CountryTollRuleContractDto,
  CreateCountryTollRuleContractRequest,
  CreateTollTariffSetContractRequest,
  TollTariffSetContractDto,
  TollTariffSetsApiService,
  TollTypeContract,
  UpdateCountryTollRuleContractRequest,
  UpdateTollTariffSetContractRequest
} from '../../core/api';
import { parseOptionalFormNumber } from '../../core/utils/parse-optional-form-number';
import { AdminFreightScenarioConfirmDialogComponent } from '../admin-freight-calculation-scenarios/admin-freight-scenario-confirm-dialog.component';

@Component({
  selector: 'app-admin-toll-tariff-sets',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatDialogModule
  ],
  templateUrl: './admin-toll-tariff-sets.component.html',
  styleUrl: './admin-toll-tariff-sets.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminTollTariffSetsComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly tollApi = inject(TollTariffSetsApiService);
  private readonly countryReferenceApi = inject(CountryReferenceApiService);
  private readonly dialog = inject(MatDialog);

  readonly tollTypeOptions: TollTypeContract[] = ['EUR_PER_KM', 'EUR_PER_DAY'];
  readonly setColumns = ['name', 'isActive', 'actions'];
  readonly ruleColumns = ['countryCode', 'countryName', 'tollType', 'rate', 'fixedDays', 'isActive', 'actions'];
  private readonly countryNamesByCode = signal<Record<string, string>>({});

  readonly isLoadingSets = signal(false);
  readonly isLoadingRules = signal(false);
  readonly loadError = signal('');
  readonly actionError = signal('');
  readonly actionSuccess = signal('');
  readonly sets = signal<TollTariffSetContractDto[]>([]);
  readonly rules = signal<CountryTollRuleContractDto[]>([]);
  readonly selectedSetId = signal<string | null>(null);
  readonly editingSetId = signal<string | null>(null);
  readonly editingRuleId = signal<string | null>(null);

  readonly selectedSet = computed(
    () => this.sets().find((set) => set.id === this.selectedSetId()) ?? null
  );

  readonly setForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(128)]],
    description: [''],
    isActive: [true]
  });

  readonly ruleForm = this.formBuilder.nonNullable.group({
    countryCode: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    tollType: ['EUR_PER_KM' as TollTypeContract, Validators.required],
    rate: ['', Validators.required],
    fixedDays: [''],
    isActive: [true]
  });

  constructor() {
    void this.loadCountryNames();
    void this.loadSets();
  }

  countryName(code: string): string {
    const normalized = code.trim().toUpperCase();
    return this.countryNamesByCode()[normalized] ?? '—';
  }

  private async loadCountryNames(): Promise<void> {
    try {
      const countries = await this.countryReferenceApi.list();
      const map: Record<string, string> = {};
      for (const country of countries) {
        map[country.codeAlpha2.toUpperCase()] = country.nameUk;
      }
      this.countryNamesByCode.set(map);
    } catch {
      this.countryNamesByCode.set({});
    }
  }

  async loadSets(): Promise<void> {
    this.isLoadingSets.set(true);
    this.loadError.set('');
    try {
      const sets = await this.tollApi.listSets(false);
      this.sets.set(sets);
      const selected = this.selectedSetId();
      if (!selected || !sets.some((set) => set.id === selected)) {
        this.selectedSetId.set(sets[0]?.id ?? null);
      }
      await this.loadRulesForSelected();
    } catch {
      this.sets.set([]);
      this.selectedSetId.set(null);
      this.rules.set([]);
      this.loadError.set('pages.adminTollTariffSets.loadFailed');
    } finally {
      this.isLoadingSets.set(false);
    }
  }

  selectSet(set: TollTariffSetContractDto): void {
    this.selectedSetId.set(set.id);
    this.editingRuleId.set(null);
    this.resetRuleForm();
    void this.loadRulesForSelected();
  }

  startCreateSet(): void {
    this.editingSetId.set(null);
    this.setForm.reset({ name: '', description: '', isActive: true });
  }

  startEditSet(set: TollTariffSetContractDto): void {
    this.editingSetId.set(set.id);
    this.selectedSetId.set(set.id);
    this.setForm.patchValue({
      name: set.name,
      description: set.description ?? '',
      isActive: set.isActive
    });
    void this.loadRulesForSelected();
  }

  async saveSet(): Promise<void> {
    if (this.setForm.invalid) {
      this.actionError.set('pages.adminTollTariffSets.validationError');
      return;
    }
    const values = this.setForm.getRawValue();
    const payloadBase = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      isActive: values.isActive
    };
    this.actionError.set('');
    this.actionSuccess.set('');
    try {
      const editingSetId = this.editingSetId();
      if (editingSetId) {
        const payload: UpdateTollTariffSetContractRequest = payloadBase;
        await this.tollApi.updateSet(editingSetId, payload);
        this.actionSuccess.set('pages.adminTollTariffSets.setUpdated');
      } else {
        const payload: CreateTollTariffSetContractRequest = payloadBase;
        const created = await this.tollApi.createSet(payload);
        this.selectedSetId.set(created.id);
        this.actionSuccess.set('pages.adminTollTariffSets.setCreated');
      }
      this.editingSetId.set(null);
      this.setForm.reset({ name: '', description: '', isActive: true });
      await this.loadSets();
    } catch {
      this.actionError.set('pages.adminTollTariffSets.setSaveFailed');
    }
  }

  async deleteSet(set: TollTariffSetContractDto): Promise<void> {
    const confirmed = await this.openConfirmDialog('pages.adminTollTariffSets.setDeleteConfirm');
    if (!confirmed) {
      return;
    }
    this.actionError.set('');
    try {
      await this.tollApi.deleteSet(set.id);
      if (this.selectedSetId() === set.id) {
        this.selectedSetId.set(null);
        this.rules.set([]);
      }
      await this.loadSets();
      this.actionSuccess.set('pages.adminTollTariffSets.setDeleted');
    } catch {
      this.actionError.set('pages.adminTollTariffSets.setDeleteFailed');
    }
  }

  startCreateRule(): void {
    this.editingRuleId.set(null);
    this.resetRuleForm();
  }

  startEditRule(rule: CountryTollRuleContractDto): void {
    this.editingRuleId.set(rule.id);
    this.ruleForm.patchValue({
      countryCode: rule.countryCode,
      tollType: rule.tollType,
      rate: String(rule.rate),
      fixedDays: rule.fixedDays != null ? String(rule.fixedDays) : '',
      isActive: rule.isActive
    });
  }

  async saveRule(): Promise<void> {
    const setId = this.selectedSetId();
    if (!setId) {
      return;
    }
    const payload = this.toRulePayload();
    if (!payload) {
      this.actionError.set('pages.adminTollTariffSets.validationError');
      return;
    }
    this.actionError.set('');
    this.actionSuccess.set('');
    try {
      const editingRuleId = this.editingRuleId();
      if (editingRuleId) {
        await this.tollApi.updateRule(setId, editingRuleId, payload as UpdateCountryTollRuleContractRequest);
        this.actionSuccess.set('pages.adminTollTariffSets.ruleUpdated');
      } else {
        await this.tollApi.createRule(setId, payload as CreateCountryTollRuleContractRequest);
        this.actionSuccess.set('pages.adminTollTariffSets.ruleCreated');
      }
      this.startCreateRule();
      await this.loadRulesForSelected();
    } catch {
      this.actionError.set('pages.adminTollTariffSets.ruleSaveFailed');
    }
  }

  async deleteRule(rule: CountryTollRuleContractDto): Promise<void> {
    const setId = this.selectedSetId();
    if (!setId) {
      return;
    }
    const confirmed = await this.openConfirmDialog('pages.adminTollTariffSets.ruleDeleteConfirm');
    if (!confirmed) {
      return;
    }
    this.actionError.set('');
    try {
      await this.tollApi.deleteRule(setId, rule.id);
      if (this.editingRuleId() === rule.id) {
        this.startCreateRule();
      }
      await this.loadRulesForSelected();
      this.actionSuccess.set('pages.adminTollTariffSets.ruleDeleted');
    } catch {
      this.actionError.set('pages.adminTollTariffSets.ruleDeleteFailed');
    }
  }

  tollTypeLabel(type: TollTypeContract): string {
    return `pages.adminTollTariffSets.tollType.${type}`;
  }

  async backToRouteRequests(): Promise<void> {
    await this.router.navigate(['/admin/route-requests']);
  }

  private async loadRulesForSelected(): Promise<void> {
    const setId = this.selectedSetId();
    if (!setId) {
      this.rules.set([]);
      return;
    }
    this.isLoadingRules.set(true);
    try {
      this.rules.set(await this.tollApi.listRules(setId));
    } catch {
      this.rules.set([]);
      this.actionError.set('pages.adminTollTariffSets.rulesLoadFailed');
    } finally {
      this.isLoadingRules.set(false);
    }
  }

  private resetRuleForm(): void {
    this.ruleForm.reset({
      countryCode: '',
      tollType: 'EUR_PER_KM',
      rate: '',
      fixedDays: '',
      isActive: true
    });
  }

  private toRulePayload():
    | CreateCountryTollRuleContractRequest
    | UpdateCountryTollRuleContractRequest
    | null {
    if (this.ruleForm.invalid) {
      return null;
    }
    const values = this.ruleForm.getRawValue();
    const rate = Number(values.rate);
    if (!Number.isFinite(rate)) {
      return null;
    }
    const fixedDays = parseOptionalFormNumber(values.fixedDays);
    const editingRuleId = this.editingRuleId();
    if (editingRuleId) {
      return {
        tollType: values.tollType,
        rate,
        fixedDays,
        countryCode: values.countryCode.trim().toUpperCase(),
        isActive: values.isActive
      };
    }
    return {
      countryCode: values.countryCode.trim().toUpperCase(),
      tollType: values.tollType,
      rate,
      fixedDays,
      isActive: values.isActive
    };
  }

  private openConfirmDialog(messageKey: string): Promise<boolean> {
    const ref = this.dialog.open(AdminFreightScenarioConfirmDialogComponent, {
      data: { messageKey }
    });
    return firstValueFrom(ref.afterClosed()).then((result) => Boolean(result));
  }
}
