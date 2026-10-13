import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { GRID_MODE_ICONS, GRID_MODE_LABELS, GRID_MODES, GridMode } from './grid-mode';
import { GridModeService } from './grid-mode.service';

/**
 * The toolbar control for the layout mode — an icon button showing the current
 * mode's icon, opening a single-choice menu of every GridMode:
 *
 *   <grid-mode-select (modeChanged)="flagSettingsUnsaved($event)" />
 *
 * Reads and writes GridModeService; the grid follows through GridModeGridDirective.
 * `modeChanged` fires only on a real change, so the host can mirror the mode into
 * its settings. Sized like the toolbar's other 30px icon buttons; named for
 * assistive tech by the tooltip text plus the current mode.
 */
@Component({
  selector: 'grid-mode-select',
  imports: [MatIconButton, MatIcon, MatMenu, MatMenuItem, MatMenuTrigger, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      class="grid-mode-trigger"
      [matMenuTriggerFor]="menu"
      [matTooltip]="tooltip()"
      [attr.aria-label]="tooltip() + ', currently ' + labels()[modeService.mode()]"
    >
      <mat-icon class="mode-icon">{{ icons()[modeService.mode()] }}</mat-icon>
      <mat-icon class="caret">arrow_drop_down</mat-icon>
    </button>

    <mat-menu #menu="matMenu" class="grid-mode-menu">
      @for (mode of modes; track mode) {
        <button
          mat-menu-item
          role="menuitemradio"
          [attr.aria-checked]="mode === modeService.mode()"
          [class.is-current]="mode === modeService.mode()"
          (click)="pick(mode)"
        >
          <mat-icon>{{ icons()[mode] }}</mat-icon>
          <span class="label">{{ labels()[mode] }}</span>
          <!-- A plain span: mat-menu-item projects EVERY <mat-icon> into its
               leading slot, which would put the check before the label. -->
          @if (mode === modeService.mode()) {
            <span class="current-mark material-icons" aria-hidden="true">check</span>
          }
        </button>
      }
    </mat-menu>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        margin-left: 4px;
      }

      /* Same footprint as the toolbar's .smaller-icon-button, a little wider so
         the mode icon and the drop-down caret fit side by side. */
      .grid-mode-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 30px;
        padding: 0;
        line-height: 30px;
        color: inherit;
      }

      .grid-mode-trigger ::ng-deep .mat-mdc-button-touch-target {
        width: 44px;
        height: 30px;
      }

      .grid-mode-trigger .mat-icon {
        width: 20px;
        height: 20px;
        font-size: 20px;
        line-height: 20px;
        margin: 0;
      }

      .grid-mode-trigger .caret {
        width: 16px;
        font-size: 18px;
        margin-left: -2px;
        opacity: 0.7;
      }

      /* The menu renders in an overlay outside this view. */
      ::ng-deep .grid-mode-menu .mat-mdc-menu-item {
        min-height: 36px;
        font-size: 13px;
        white-space: nowrap;
      }

      ::ng-deep .grid-mode-menu .mat-mdc-menu-item-text {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
      }

      ::ng-deep .grid-mode-menu .mat-mdc-menu-item .current-mark {
        margin-left: auto;
        padding-left: 12px;
        font-size: 18px;
        line-height: 1;
      }

      ::ng-deep .grid-mode-menu .mat-mdc-menu-item.is-current {
        font-weight: 600;
      }
    `,
  ],
})
export class GridModeSelectComponent {
  protected modeService = inject(GridModeService);
  protected readonly modes = GRID_MODES;

  /** Menu labels per mode; override to rename them for a given grid. */
  readonly labels = input<Readonly<Record<GridMode, string>>>(GRID_MODE_LABELS);
  /** Material Icons ligature per mode, on the button and in the menu. */
  readonly icons = input<Readonly<Record<GridMode, string>>>(GRID_MODE_ICONS);
  readonly tooltip = input('Change grid type');

  /** The user picked a different mode. */
  readonly modeChanged = output<GridMode>();

  protected pick(mode: GridMode): void {
    if (mode === this.modeService.mode()) return;
    this.modeService.set(mode);
    this.modeChanged.emit(mode);
  }
}
