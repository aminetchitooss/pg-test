import { inject, Injectable } from '@angular/core';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { languages } from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { CONFIG_SCHEMA } from './credit-json-editor-schema';
import { CreditPrestoQueryDataService } from '../credit-presto-query-data/credit-presto-query-data.service';
import { SequentialInitializerInterface } from '../../../../shared/services/sequential-initializer/sequential-initializer.interface';

@Injectable({
  providedIn: 'root',
})
export class CreditJsonEditorService implements SequentialInitializerInterface {
  prestoQueryDataService = inject(CreditPrestoQueryDataService);
  isProviderRegistered = false;

  suggestions$: BehaviorSubject<languages.CompletionItem[]> = new BehaviorSubject<
    languages.CompletionItem[]
  >([]);

  init(): Observable<any> {
    (window as any).MonacoEnvironment = {
      getWorker: (workerId: string, label: string) => {
        if (label === 'json') {
          return new Worker('assets/monaco-editor/vs/language/json/json.worker.js', {
            type: 'module',
          });
        }
        return new Worker('assets/monaco-editor/vs/editor/editor.worker.js', { type: 'module' });
      },
    };
    return of(true);
  }

  registerCustomCompletionProvider() {
    if (this.isProviderRegistered) {
      return;
    }
    this.updateIntellisense();

    monaco.languages.registerCompletionItemProvider('json', {
      triggerCharacters: ['{'],
      provideCompletionItems: (model: any, position: any) => {
        const suggestions = this.updateIntellisense();
        return { suggestions };
      },
    });
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      allowComments: true,
      validate: true,
      enableSchemaRequest: false,
      schemas: [{ uri: 'urn:config', fileMatch: ['*'], schema: CONFIG_SCHEMA }],
    });
    this.isProviderRegistered = true;
  }

  updateIntellisense(): languages.CompletionItem[] {
    const value = this.prestoQueryDataService.getTextSubstitutionsFromPrestoQueryString(true);
    const out = [
      {
        label: '{C}',
        kind: languages.CompletionItemKind.Keyword,
        insertText: 'C}',
        documentation: 'Currency',
      },
      {
        label: '{D}',
        kind: languages.CompletionItemKind.Keyword,
        insertText: 'D}',
        documentation: 'Date',
      },
    ] as languages.CompletionItem[];

    try {
      out.push(
        ...value.map((e: any) => {
          return {
            label: e.token,
            kind: languages.CompletionItemKind.Keyword,
            insertText: e.token.substring(1),
            documentation: e.description,
          } as languages.CompletionItem;
        })
      );
    } catch (e) {}

    this.suggestions$.next(out);
    return out;
  }
}
