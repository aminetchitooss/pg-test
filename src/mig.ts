import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { inject, Injectable, signal, WritableSignal } from "@angular/core";
import { Observable, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { DbContextQuery, DbQueryConfig, EnforceType } from "src/shared/interfaces/db-context-query";
import { ReportResponse } from "src/shared/interfaces/rpc-response.interface";
import { TokenService } from "src/shared/services/authentication/token.service";
import { BugReportService } from "src/shared/services/bug-report/bug-report.service";
import { ConfigService } from "src/shared/services/config/config.service";
import { DbContextQueryBuilderService } from "src/shared/services/document-db-context/db-context-query-builder.service";
import { DB_CONTEXT_ERROR_PRESENTER } from "src/shared/services/document-db-context/db-context-error-presenter";

@Injectable({
  providedIn: "root"
})
export class DbContextReaderDataService<T, K extends EnforceType<T>> {

  protected http = inject(HttpClient);
  protected errorPresenter = inject(DB_CONTEXT_ERROR_PRESENTER);
  protected bugReportService = inject(BugReportService);
  protected tokenService = inject(TokenService);
  protected configService = inject(ConfigService);
  // Each context owns its OWN builder instance. The builder carries per-context mutable
  // config (queryParamScope/registryPrefix); a shared root singleton would let different
  // contexts overwrite each other's config. The builder has no injected deps, so `new` is safe.
  protected builderTools = new DbContextQueryBuilderService<T>();
  key = "" as K;
  url = "";

  // State lives in writable signals, private to this hierarchy (writes happen only here).
  // Consumers get read-only signal views and read them by calling, e.g. currentData().
  protected readonly _listData = signal<T[] | null>(null);
  protected readonly _listDataRawJsonResponse = signal<ReportResponse | null>(null);
  protected readonly _currentData = signal<T[] | null>(null);

  readonly listData = this._listData.asReadonly();
  readonly listDataRawJsonResponse = this._listDataRawJsonResponse.asReadonly();
  readonly currentData = this._currentData.asReadonly();

  getAll(): Observable<boolean> {
    const query = this.builderTools.generateQueryToGetAll();
    return this.getOneTimeDataFromHttp(query).pipe(
      map((response) => this.processReportResponse(response, query, this._listData))
    );
  }

  getById(id: string): Observable<boolean> {
    const query = this.builderTools.generateQueryToGetById(id);
    return this.getOneTimeDataFromHttp(query).pipe(
      map((response) => {
        response.result = [response.result] as any;
        return response;
      }),
      map((response) => this.processReportResponse(response, query, this._currentData, true)),
      catchError((err) => {
        console.error("process report response", err);
        return of(false);
      })
    );
  }

  protected initConfig(key: K, config: DbQueryConfig) {
    this.key = key;
    this.url = config.url;
    this.builderTools.queryParamScope = config.queryParamScope;
    this.builderTools.registryPrefix = config.registryPrefix;
  }

  protected clearCurrentData() {
    this._currentData.set(null);
  }

  protected convertData(response: ReportResponse): T[] {
    return [response.result] as T[];
  }

  protected processReportResponse(
    response: ReportResponse,
    query: unknown,
    target: WritableSignal<T[] | null>,
    isSingle = false
  ): boolean {
    if (!response.error && !!response.result?.[0]) {
      try {
        const data = this.convertData(response);

        target.set(data);
        if (!isSingle) this._listDataRawJsonResponse.set(response);
        return true;
      } catch (error: any) {
        this.openErrorDialog(error.message);
        this.bugReportService.addErrorToLog(error);
        return false;
      }
    } else {
      // Don't mutate the incoming response; build the diagnostic payload locally so the
      // "Report is empty" branch stays reachable when there is no error object.
      const hasResult = !!response.result?.[0];
      const errorWithPayload = response.error ? { ...response.error, payload: query } : null;
      const errorMessage = errorWithPayload ? JSON.stringify(errorWithPayload) : "Report is empty";
      this.openErrorDialog(errorMessage, hasResult ? undefined : "Report unavailable");
      if (hasResult) this.bugReportService.addErrorToLog({ ...response, error: errorWithPayload });
      return false;
    }
  }

  // Reports the error through the injected presenter (port). The data layer no longer knows
  // HOW errors are shown — a provided DB_CONTEXT_ERROR_PRESENTER decides (dialog / toast / no-op).
  protected openErrorDialog(errorString: string, title = "Error"): void {
    this.errorPresenter.present({ message: errorString, title });
  }

  protected getOneTimeDataFromHttp(query: DbContextQuery<T>) {
    const httpOptions = {
      headers: new HttpHeaders({
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      })
    };
    return this.http
      .post<ReportResponse>(this.url, query, httpOptions)
      .pipe(map(this.parseInvalidPrestoRequestResponse));
  }

  // Arrow property so `this` stays bound when passed by reference to `map(this.parseInvalidPrestoRequestResponse)`.
  // As a plain method it loses `this` at the call site and `this.url` throws on the error path.
  protected parseInvalidPrestoRequestResponse = (res: ReportResponse): ReportResponse => {
    // Simulate HTTP errors when Presto fails. Presto doesn't send HTTP status codes.
    if (res.error) {
      throw new HttpErrorResponse({
        error: res.error.message,
        status: 400,
        statusText: "Bad Request",
        url: this.url
      });
    }
    return res;
  };

  /** Emits the standard Presto-style error when there is no local data to act on. */
  protected emptyDataError(): Observable<ReportResponse> {
    return of({ error: true } as ReportResponse).pipe(map(this.parseInvalidPrestoRequestResponse));
  }

}
////// new

import { inject, Injectable, InjectionToken } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { WarningDialogComponent } from 'src/shared/dialogs/warning/warning-dialog.component';
import { WarningDialogData } from 'src/shared/interfaces/warning-dialog.interface';

/** A failure the data layer wants surfaced to the user, decoupled from how it is shown. */
export interface DbContextError {
  message: string;
  title?: string;
}

/**
 * Port between the document-db-context data layer and the UI. The data layer reports errors
 * here; the application decides how to present them (dialog, toast, log-only, no-op in tests).
 * This keeps the data services free of any direct dependency on Angular Material / dialogs.
 */
export interface DbContextErrorPresenter {
  present(error: DbContextError): void;
}

/**
 * Default adapter — preserves the original behaviour (opens the shared warning dialog).
 * Override the token to change UX:
 *   { provide: DB_CONTEXT_ERROR_PRESENTER, useClass: MyPresenter }
 */
@Injectable({ providedIn: 'root' })
export class WarningDialogErrorPresenter implements DbContextErrorPresenter {
  private dialog = inject(MatDialog);

  present(error: DbContextError): void {
    this.dialog.open(WarningDialogComponent, {
      width: '600px',
      data: {
        title: error.title ?? 'Error',
        body: 'There has been an error retrieving this report.',
        error: error.message,
        showBugReport: true,
        showCloseButton: true,
      } as WarningDialogData,
    });
  }
}

export const DB_CONTEXT_ERROR_PRESENTER = new InjectionToken<DbContextErrorPresenter>(
  'DB_CONTEXT_ERROR_PRESENTER',
  { providedIn: 'root', factory: () => inject(WarningDialogErrorPresenter) }
);


//////


import { Injectable } from "@angular/core";
import { catchError, mergeMap, Observable, throwError } from 'rxjs';
import { EnforceType, ScopeQueries } from 'src/shared/interfaces/db-context-query';
import { ReportResponse } from 'src/shared/interfaces/rpc-response.interface';
import { DbContextReaderDataService } from 'src/shared/services/document-db-context/db-context-reader-data.service';

@Injectable({
  providedIn: 'root'
})
export class DbContextAdminDataService<T, K extends EnforceType<T>> extends DbContextReaderDataService<T, K> {

  create(entry: T): Observable<ReportResponse> {
    const savedData = this._listData();
    if (!savedData) return this.emptyDataError();

    const nextData = [...savedData, entry];

    const queries = this.builderTools.generateQueriesToCreateNew(<any>entry[this.key]);
    queries.dataQuery.params.push(entry);

    return this.updateDataRegistry(queries, nextData);
  }

  edit(entry: Partial<T>): Observable<ReportResponse> {
    const savedData = this._listData();
    const currentReport = this._currentData()?.[0];
    if (!currentReport || !savedData) return this.emptyDataError();

    const updatedEntry = { ...currentReport, ...entry };

    const queries = this.builderTools.generateQueryToPatchById(<any>updatedEntry[this.key]);
    queries.dataQuery.params.push(updatedEntry);

    const indexToUpdate = savedData.findIndex((item) => item[this.key] === updatedEntry[this.key]);
    const nextData = indexToUpdate === -1
      ? savedData
      : savedData.map((item, i) => (i === indexToUpdate ? updatedEntry : item));

    return this.updateDataRegistry(queries, nextData);
  }

  deleteById(id: string): Observable<ReportResponse> {
    const savedData = this._listData();
    if (!savedData) return this.emptyDataError();

    const nextData = savedData.filter((item) => item[this.key] !== id);

    const queries = this.builderTools.generateQueryToDeleteById(id);

    return this.updateDataRegistry(queries, nextData);
  }

  /**
   * Optimistically applies `nextData` to local state, then persists it as two sequential
   * writes: the registry index, then the data scope.
   *
   * Presto has no cross-document transaction, so there is an unavoidable partial-failure
   * window between the two writes — if the second write fails, the server is left in a
   * half-written state until the next successful full sync. Eliminating that window needs
   * backend (atomic batch) support; it cannot be solved here.
   *
   * What we DO guarantee client-side: on any failure the local cache is rolled back to its
   * previous value and the error is propagated, so the UI never shows an unsaved change as
   * saved. We keep the original registry-first ordering on purpose — which document should
   * be written first is a backend-contract decision, not a client one.
   */
  protected updateDataRegistry(queries: ScopeQueries<T>, nextData: T[]): Observable<ReportResponse> {
    const previousData = this._listData();
    this._listData.set(nextData);

    const { registryQuery, dataQuery } = queries;
    registryQuery.params.push(nextData);

    return this.getOneTimeDataFromHttp(registryQuery).pipe(
      mergeMap(() => this.getOneTimeDataFromHttp(dataQuery)),
      catchError((err) => {
        this._listData.set(previousData);
        return throwError(() => err);
      })
    );
  }
}
///////////
import { inject, Injectable } from "@angular/core";
import * as jsonc from "jsonc-parser";
import { Observable, of } from "rxjs";
import { CreditDecimalPrecision } from "src/app/credit/interfaces/credit-decimal-precision.interface";
import { CreditReportQuery } from "src/app/credit/interfaces/credit-report-query.interface";
import { CreditTextSubstitution, CreditTextSubstitutionMap } from "src/app/credit/interfaces/credit-text-substitution.interface";
import { CreditPrestoQueryData } from "src/app/credit/models/credit-presto-query-data.model";
import { CreditQueryInputService } from "src/app/credit/services/credit-query-input/credit-query-input.service";
import { CreditUserSettingsService } from "src/app/credit/services/credit-user-settings/credit-user-settings.service";
import { getPrestoQueryConfig, PRESTO_QUERY_IDENTIFIER_KEY } from "src/app/credit/utils/credit-presto-query-defaults";
import { ReportGenericResponse } from "src/shared/interfaces/rpc-response.interface";
import { GenericObjectFactory } from "src/shared/services/data-to-objects/generic-object-factory";
import { DbContextReaderDataService } from "src/shared/services/document-db-context/db-context-reader-data.service";
import { JsonKeysToObjectsService } from "src/shared/services/data-to-objects/json-keys-to-objects.service";
import { ReportQuery } from "../../../../shared/interfaces/query.interface";
import { ReportBuilderService } from "../../../../shared/services/query-builder/common/report-builder.service";
import { AppEnvironmentService } from "../../../../shared/services/app-environment/app-environment.service";

@Injectable({
  providedIn: "root"
})
export class CreditPrestoQueryDataService extends DbContextReaderDataService<
  CreditPrestoQueryData,
  typeof PRESTO_QUERY_IDENTIFIER_KEY
> {
  queryInputService = inject(CreditQueryInputService);
  jsonToObjects = inject(JsonKeysToObjectsService);
  userSettingsService = inject(CreditUserSettingsService);
  reportBuilderService = inject(ReportBuilderService);
  appEnvironmentService = inject(AppEnvironmentService);

  query: ReportQuery = this.reportBuilderService.getReportTemplate();
  constructor() {
    super();
    const config = getPrestoQueryConfig(this.appEnvironmentService.activeEnvironment.settings);
    this.initConfig(PRESTO_QUERY_IDENTIFIER_KEY, config);
  }

  public getAllCreditReports(): Observable<boolean> {
    return this.getAll();
  }

  public getCreditReport(templateId: string): Observable<boolean> {
    return this.getById(templateId);
  }

  public clearCreditReport() {
    this.clearCurrentData();
  }

  checkIfReportIsSaved(): Observable<boolean> {
    const currentTemplateId = this.queryInputService.userSettings.templateId;

    if (!currentTemplateId) {
      return of(false);
    }

    if (this.queryInputService.userSettings.queryOverrideEnabled
      && this.queryInputService.userSettings.queryOverride) {
      return of(true);
    }

    const currentSavedReport = this._currentData();
    if (currentSavedReport && currentTemplateId === currentSavedReport[0].templateId) {
      return of(true);
    }

    return this.getCreditReport(currentTemplateId);
  }

  getCurrentPrestoQueryString(isOverride = false): string | undefined {
    const query =
      isOverride ||
      (this.queryInputService.userSettings.queryOverrideEnabled
        && this.queryInputService.userSettings.queryOverride)
        ? this.queryInputService.userSettings.queryOverride
        : this._currentData()?.[0].prestoQuery;
    if (!query) return undefined;
    return jsonc.stripComments(query);
  }

  getTextSubstitutionsFromPrestoQueryString(isOverride = false): CreditTextSubstitution[] {
    const parsedItem = this.getQueryFromPrestoQueryString(isOverride);
    return parsedItem.client?.text_substitutions || [];
  }

  getColumnExpressionKeysFromPrestoQueryString(isOverride = false): string[] {
    const parsedItem = this.getQueryFromPrestoQueryString(isOverride);
    return parsedItem.client?.column_expression_keys || [];
  }

  getColumnDecimalPrecisionFromPrestoQueryString(isOverride = false): CreditDecimalPrecision[] {
    const parsedItem = this.getQueryFromPrestoQueryString(isOverride);
    return parsedItem.client?.precision || [];
  }

  getQueryKeysFromPrestoQueryString(isOverride = false): QueryKeys {
    const parsedItem = this.getQueryFromPrestoQueryString(isOverride);

    return Object.entries(parsedItem.server?.queries).reduce((acc, [key, val]: [string, any]) => {
      acc[key] = <string[]>val[1].map((v) => v.split("=")[0]);
      return acc;
    }, {});
  }

  getQueryFromPrestoQueryString(isOverride = false): CreditReportQuery {
    const queryString = this.getCurrentPrestoQueryString(isOverride);
    let parsedItem = {} as CreditReportQuery;
    if (!queryString) return parsedItem;
    try {
      parsedItem = JSON.parse(queryString) as CreditReportQuery;
      return parsedItem;
    } catch {
      return parsedItem;
    }
  }

  getTextSubstitutionDefaultValues(savedData?: CreditTextSubstitutionMap[]): CreditTextSubstitutionMap[] {
    const items = this.getTextSubstitutionsFromPrestoQueryString();

    return items.map((item) => {
      const data = savedData?.find((d) => d.key === item.token);
      if (data?.key && data?.value) return { key: data.key, value: data.value, multi: data.multi };

      const value: string = item.multi
        ? item.substitutionElements.map((e) => e?.substitutionText).join(",")
        : item.substitutionElements[0]?.substitutionText || "";

      return { key: item.token, value, multi: item.multi };
    });
  }

  protected convertData(response: ReportGenericResponse): CreditPrestoQueryData[] {
    if (!response.result.length) {
      return [];
    }
    return this.jsonToObjects.convert<CreditPrestoQueryData>(
      response.result,
      new GenericObjectFactory<CreditPrestoQueryData>(CreditPrestoQueryData)
    );
  }
}

export interface QueryKeys {
  [key: string]: string[];
}
