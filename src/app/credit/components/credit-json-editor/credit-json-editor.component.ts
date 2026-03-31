import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  forwardRef,
  inject,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/editor/editor.all';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import { CreditJsonEditorService } from '../../services/credit-json-editor/credit-json-editor.service';

@Component({
  selector: 'credit-json-editor',
  templateUrl: './credit-json-editor.component.html',
  styles:[`
    :host{
      display: block;
      height: 500px;
    }
    `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CreditJsonEditorComponent),
      multi: true,
    },
  ],
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditJsonEditorComponent implements OnInit, OnDestroy, ControlValueAccessor {
  @ViewChild('editorContainer', { static: true }) editorContainer!: ElementRef<HTMLDivElement>;

  public value = signal<string>('');
  private editor!: monaco.editor.IStandaloneCodeEditor;
  private ngZone = inject(NgZone);
  private jsonEditorService = inject(CreditJsonEditorService);

  format() {
    this.ngZone.runOutsideAngular(() => {
      this.editor.getAction('editor.action.formatDocument')?.run();
    });
  }

  disable() {
    this.ngZone.runOutsideAngular(() => {
      this.editor.updateOptions({
        readOnly: true,
        domReadOnly: true,
      });
    });
  }

  ngOnInit(): void {
    this.jsonEditorService.init();
    this.ngZone.runOutsideAngular(() => {
      this.editor = monaco.editor.create(this.editorContainer.nativeElement, {
        value: this.value(),
        language: 'json',
        minimap: { enabled: false },
        automaticLayout: true,

        detectIndentation: false,
        insertSpaces: true,
        tabSize: 2,

        trimAutoWhitespace: true,
        autoIndent: 'full',
        formatOnPaste: true,
        formatOnType: true,
      });
      this.jsonEditorService.registerCustomCompletionProvider();
      this.editor.onDidChangeModelContent(() => {
        const newValue = this.editor.getValue();
        this.value.set(newValue);
        this.onChange(newValue);
      });

      this.editor.onDidBlurEditorWidget(() => {
        this.onTouched();
      });
    });
  }

  writeValue(value: string): void {
    this.ngZone.runOutsideAngular(() => {
      if (value !== this.value()) {
        this.value.set(value || '');
        if (this.editor) {
          this.editor.setValue(this.value());
        }
      }
    });
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.editor) {
      this.editor.updateOptions({ readOnly: isDisabled });
    }
  }

  ngOnDestroy(): void {
    if (this.editor) {
      this.editor.dispose();
    }
  }

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
}
