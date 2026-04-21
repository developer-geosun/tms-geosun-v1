import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ThemeService, Theme } from '../../core/services/theme.service';
import { ConfigService } from '../../core/services/config.service';
import { LanguageService, Language } from '../../core/services/language.service';
import { AuthService } from '../../core/services/auth.service';
import { LogoComponent } from '../../shared/components/logo/logo.component';
import { SocialIconComponent } from '../../shared/components/social-icon/social-icon.component';

/**
 * Компонент панелі інструментів (toolbar)
 */
@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatButtonToggleModule,
    TranslateModule,
    LogoComponent,
    SocialIconComponent
  ]
})
export class ToolbarComponent {
  private readonly themeService = inject(ThemeService);
  readonly configService = inject(ConfigService);
  private readonly translateService = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly currentLanguage = this.languageService.language;
  readonly currentTheme = this.themeService.theme;
  readonly isLogoIconsOpen = signal(false);
  readonly isAuthenticated = this.authService.isAuthenticated;
  
  // Доступні мови
  languages: { code: Language; label: string }[] = [
    { code: 'uk', label: 'UA' },
    { code: 'en', label: 'EN' },
    { code: 'ru', label: 'RU' }
  ];

  themes: { code: Theme; label: string }[] = [
    { code: 'azure-blue', label: 'Azure & Blue' },
    { code: 'rose-red', label: 'Rose & Red' },
    { code: 'magenta-violet', label: 'Magenta & Violet' },
    { code: 'cyan-orange', label: 'Cyan & Orange' }
  ];

  constructor() {}

  /**
   * Змінює тему інтерфейсу
   */
  changeTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  /**
   * Змінює мову інтерфейсу
   */
  changeLanguage(language: Language): void {
    this.languageService.setLanguage(language);
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login'])
    });
  }

  toggleLogoIcons(event: Event): void {
    event.stopPropagation();
    this.isLogoIconsOpen.update((isOpen) => !isOpen);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isLogoIconsOpen()) {
      return;
    }

    const clickedElement = event.target as Node | null;
    if (!clickedElement) {
      return;
    }

    if (!this.elementRef.nativeElement.contains(clickedElement)) {
      this.isLogoIconsOpen.set(false);
    }
  }

  /**
   * Отримує локалізовану назву секції мови у меню налаштувань
   */
  getLanguageSectionTitle(): string {
    return this.getSettingsSectionTitle('settings.languageSection');
  }

  /**
   * Отримує локалізовану назву секції теми у меню налаштувань
   */
  getThemeSectionTitle(): string {
    return this.getSettingsSectionTitle('settings.themeSection');
  }

  private getSettingsSectionTitle(key: 'settings.languageSection' | 'settings.themeSection'): string {
    const translated = this.translateService.instant(key);
    if (translated !== key) {
      return translated;
    }

    const fallbackByLanguage: Record<Language, Record<'settings.languageSection' | 'settings.themeSection', string>> = {
      uk: {
        'settings.languageSection': 'Мова',
        'settings.themeSection': 'Тема'
      },
      en: {
        'settings.languageSection': 'Language',
        'settings.themeSection': 'Theme'
      },
      ru: {
        'settings.languageSection': 'Язык',
        'settings.themeSection': 'Тема'
      }
    };

    return fallbackByLanguage[this.currentLanguage()][key];
  }
}

