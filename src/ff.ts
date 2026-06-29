export interface DayChangedButton {
  label: string;
  value: string;                 // returned via close() for new callers
  color?: 'primary' | 'accent' | 'warn';
}
export interface DayChangedData {
  title?: string;
  message?: string;
  buttons?: DayChangedButton[];
}

@Component({
  selector: 'app-day-changed',
  templateUrl: './day-changed.component.html',
  styleUrls: ['./day-changed.component.scss'],
  imports: [MatDialogModule, MatIcon, MatButton],
})
export class DayChangedComponent {
  buttonsEnum = Buttons; // keep for the legacy default template path

  private readonly dialogRef = inject(MatDialogRef<DayChangedComponent, string>);
  // optional → existing callers pass nothing, so data is null
  private readonly data = inject<DayChangedData | null>(MAT_DIALOG_DATA, { optional: true });

  readonly title = this.data?.title ?? 'Out of date';
  readonly message =
    this.data?.message ?? "Please reload the application to continue to receive today's risk data.";
  readonly customButtons = this.data?.buttons ?? null;

  constructor(
    private refreshService: RefreshService,
    private oncaService: OncaService,
  ) {}

  // LEGACY path — unchanged behavior for existing modules
  onClick(action: Buttons): void {
    switch (action) {
      case Buttons.RELOAD_ALL:
        this.refreshService.onRefresh({ promptUserOnRefreshScope: false, forceRefreshAll: true });
        break;
      case Buttons.RELOAD:
        this.refreshService.onRefresh({ promptUserOnRefreshScope: false });
        break;
      case Buttons.IGNORE:
      default:
        break;
    }
  }

  // NEW path — dumb return for configurable callers
  onCustomClick(value: string): void {
    this.dialogRef.close(value);
  }
}

<h1 mat-dialog-title>
  <mat-icon color="accent">warning_amber</mat-icon> {{ title }}
</h1>
<div mat-dialog-content>
  <p>{{ message }}</p>
</div>

<div mat-dialog-actions>
  @if (customButtons) {
    @for (button of customButtons; track button.value) {
      <button mat-button [color]="button.color ?? 'accent'" (click)="onCustomClick(button.value)">
        {{ button.label }}
      </button>
    }
  } @else {
    <!-- unchanged legacy buttons -->
    <button mat-button mat-dialog-close color="accent" (click)="onClick(buttonsEnum.RELOAD)">Reload</button>
    <button mat-button mat-dialog-close color="accent" (click)="onClick(buttonsEnum.IGNORE)">Ignore</button>
  }
</div>

Your new caller — handles its own behavior, touches no other module:

this.dialog
  .open(DayChangedComponent, {
    data: {
      title: 'Out of date',
      message: 'Your custom message.',
      buttons: [
        { label: 'Reload', value: 'RELOAD' },
        { label: 'Ignore', value: 'IGNORE' },
      ],
    } satisfies DayChangedData,
  })
  .afterClosed()
  .subscribe((result) => {
    if (result === 'RELOAD') this.oncaService.sendEventToWebview();
  });