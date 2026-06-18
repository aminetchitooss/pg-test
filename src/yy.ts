import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { BehaviorSubject, Observable, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { WarningDialogComponent } from "src/shared/dialogs/warning/warning-dialog.component";
import { DbContextQuery, DbQueryConfig, EnforceType } from "src/shared/interfaces/db-context-query";
import { ReportResponse } from "src/shared/interfaces/rpc-response.interface";
import { WarningDialogData } from "src/shared/interfaces/warning-dialog.interface";
import { TokenService } from "src/shared/services/authentication/token.service";
import { BugReportService } from "src/shared/services/bug-report/bug-report.service";
import { ConfigService } from "src/shared/services/config/config.service";
import { DbContextQueryBuilderService } from "src/shared/services/document-db-context/db-context-query-builder.service";

@Injectable({
  providedIn: "root"
})
export class DbContextReaderDataService<T, K extends EnforceType<T>> {

  protected http = inject(HttpClient);
  protected dialog = inject(MatDialog);
  protected bugReportService = inject(BugReportService);
  protected tokenService = inject(TokenService);
  protected configService = inject(ConfigService);
  // Each context owns its OWN builder instance. The builder carries per-context mutable
  // config (queryParamScope/registryPrefix); a shared root singleton would let different
  // contexts overwrite each other's config. The builder has no injected deps, so `new` is safe.
  protected builderTools = new DbContextQueryBuilderService<T>();
  key = "" as K;
  url = "";

  // Subjects are private to this hierarchy (writes happen only here); consumers get
  // read-only Observable views. asObservable() on a BehaviorSubject still replays the
  // latest value to new subscribers, so the async pipe behaves exactly as before.
  protected readonly _listData$ = new BehaviorSubject<T[] | null>(null);
  protected readonly _listDataRawJsonResponse$ = new BehaviorSubject<ReportResponse | null>(null);
  protected readonly _currentData$ = new BehaviorSubject<T[] | null>(null);

  readonly listData$ = this._listData$.asObservable();
  readonly listDataRawJsonResponse$ = this._listDataRawJsonResponse$.asObservable();
  readonly currentData$ = this._currentData$.asObservable();

  /**
   * Synchronous read-only snapshot of the current single-record data, for callers that
   * need the value imperatively instead of subscribing. Method form (not a getter) so the
   * call site `currentData()` stays identical when this becomes a signal in phase 2.
   */
  currentData(): T[] | null {
    return this._currentData$.getValue();
  }

  getAll(): Observable<boolean> {
    const query = this.builderTools.generateQueryToGetAll();
    return this.getOneTimeDataFromHttp(query).pipe(
      map((response) => this.processReportResponse(response, query, this._listData$))
    );
  }

  getById(id: string): Observable<boolean> {
    const query = this.builderTools.generateQueryToGetById(id);
    return this.getOneTimeDataFromHttp(query).pipe(
      map((response) => {
        response.result = [response.result] as any;
        return response;
      }),
      map((response) => this.processReportResponse(response, query, this._currentData$, true)),
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
    this._currentData$.next(null);
  }

  protected convertData(response: ReportResponse): T[] {
    return [response.result] as T[];
  }

  protected processReportResponse(
    response: ReportResponse,
    query: unknown,
    cb: BehaviorSubject<T[] | null>,
    isSingle = false
  ): boolean {
    if (!response.error && !!response.result?.[0]) {
      try {
        const data = this.convertData(response);

        cb.next(data);
        if (!isSingle) this._listDataRawJsonResponse$.next(response);
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

  protected openErrorDialog(errorString: string, title = "Error"): void {
    this.dialog.open(WarningDialogComponent, {
      width: "600px",
      data: {
        title,
        body: "There has been an error retrieving this report.",
        error: errorString,
        showBugReport: true,
        showCloseButton: true
      } as WarningDialogData
    });
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


////////////


import { Injectable } from '@angular/core';
import { DbContextQuery, ScopeQueries } from 'src/shared/interfaces/db-context-query';
import { UserSettingAction } from 'src/shared/interfaces/user-settings/user-setting-action.interface';

@Injectable({
  providedIn: 'root'
})
export class DbContextQueryBuilderService<T> {
  queryParamScope = '';
  registryPrefix = ``;

  generateQueryToGetAll(): DbContextQuery<T> {
    return this.getQueryTemplate(UserSettingAction.GetSetting);
  }

  generateQueryToGetById(id: string): DbContextQuery<T> {
    return this.getQueryTemplate(UserSettingAction.GetSetting, id);
  }

  generateQueriesToCreateNew(id: string): ScopeQueries<T> {
    return this.scopeQueries(UserSettingAction.PutSetting, id);
  }

  generateQueryToPatchById(id: string): ScopeQueries<T> {
    return this.scopeQueries(UserSettingAction.PutSetting, id);
  }

  generateQueryToDeleteById(templateId: string): ScopeQueries<T> {
    return this.scopeQueries(UserSettingAction.DeleteSetting, templateId);
  }

  /** A registry write (PutSetting) paired with the data-scope write that carries the change. */
  private scopeQueries(dataAction: UserSettingAction, targetId: string): ScopeQueries<T> {
    return {
      registryQuery: this.getQueryTemplate(UserSettingAction.PutSetting),
      dataQuery: this.getQueryTemplate(dataAction, targetId),
    };
  }

  protected getQueryTemplate(method: UserSettingAction, targetId: string = '') {
    return {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method: UserSettingAction[method],
      params: [this.queryParamScope, !!targetId
        ? `${this.registryPrefix}@${targetId}` : this.registryPrefix]
    } satisfies DbContextQuery<T>;
  }
}


////////////////

import { Injectable } from "@angular/core";
import { mergeMap, Observable } from 'rxjs';
import { EnforceType, ScopeQueries } from 'src/shared/interfaces/db-context-query';
import { ReportResponse } from 'src/shared/interfaces/rpc-response.interface';
import { DbContextReaderDataService } from 'src/shared/services/document-db-context/db-context-reader-data.service';

@Injectable({
  providedIn: 'root'
})
export class DbContextAdminDataService<T, K extends EnforceType<T>> extends DbContextReaderDataService<T, K> {

  // NOTE: create/edit/deleteById update local state optimistically (before the server
  // confirms). Rollback-on-failure is a separate concern tracked as the transactional-write
  // change (#7) and intentionally not handled here.

  create(entry: T): Observable<ReportResponse> {
    const savedData = this._listData$.getValue();
    if (!savedData) return this.emptyDataError();

    const nextData = [...savedData, entry];
    this._listData$.next(nextData);

    const queries = this.builderTools.generateQueriesToCreateNew(<any>entry[this.key]);
    queries.dataQuery.params.push(entry);

    return this.updateDataRegistry(queries, nextData);
  }

  edit(entry: Partial<T>): Observable<ReportResponse> {
    const savedData = this._listData$.getValue();
    const currentReport = this._currentData$.getValue()?.[0];
    if (!currentReport || !savedData) return this.emptyDataError();

    const updatedEntry = { ...currentReport, ...entry };

    const queries = this.builderTools.generateQueryToPatchById(<any>updatedEntry[this.key]);
    queries.dataQuery.params.push(updatedEntry);

    const indexToUpdate = savedData.findIndex((item) => item[this.key] === updatedEntry[this.key]);
    const nextData = indexToUpdate === -1
      ? savedData
      : savedData.map((item, i) => (i === indexToUpdate ? updatedEntry : item));
    this._listData$.next(nextData);

    return this.updateDataRegistry(queries, nextData);
  }

  deleteById(id: string): Observable<ReportResponse> {
    const savedData = this._listData$.getValue();
    if (!savedData) return this.emptyDataError();

    const nextData = savedData.filter((item) => item[this.key] !== id);
    this._listData$.next(nextData);

    const queries = this.builderTools.generateQueryToDeleteById(id);

    return this.updateDataRegistry(queries, nextData);
  }

  protected updateDataRegistry(queries: ScopeQueries<T>, entries: Partial<T>[]) {
    const { registryQuery, dataQuery } = queries;
    registryQuery.params.push(entries);

    return this.getOneTimeDataFromHttp(registryQuery).pipe(
      mergeMap(() => this.getOneTimeDataFromHttp(dataQuery))
    );
  }
}


////////

/** Keys of U whose value is a string — used to constrain the identifier key of a context. */
export type EnforceType<U> = {
  [V in keyof U]: U[V] extends string ? V : never;
}[keyof U];

export interface DbContextQuery<U> {
  jsonrpc: string;
  id: string;
  method: string;
  params: [string, string, (U | Partial<U>[])?];
}

export interface ScopeQueries<U> {
  registryQuery: DbContextQuery<U>;
  dataQuery: DbContextQuery<U>;
}

export interface DbQueryConfig {
  url: string;
  queryParamScope: string;
  registryPrefix: string;
}


/////////////



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

    const currentSavedReport = this._currentData$.getValue();
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
        : this._currentData$.getValue()?.[0].prestoQuery;
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


/////////////


import { HttpHeaders } from '@angular/common/http';
import { inject, Injectable, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { decode } from 'js-base64';
import { finalize, Observable } from 'rxjs';
import { ResponseHeaderDataType } from 'src/shared/interfaces/credit-response-header-data-type.interface';
import {
  LoadingState,
  LoadingStateTarget,
} from 'src/shared/interfaces/loading-state.interace';
import {
  ConnectionEventType,
  QueryType,
} from 'src/shared/interfaces/query-history.interface';
import { ReportQuery } from 'src/shared/interfaces/query.interface';
import { ReportResponse } from 'src/shared/interfaces/rpc-response.interface';
import { WarningDialogData } from 'src/shared/interfaces/warning-dialog.interface';
import { GenericObjectFactory } from 'src/shared/services/data-to-objects/generic-object-factory';
import { DataBufferingService } from 'src/shared/services/data-buffering/data-buffering.service';
import { DataRecordingService } from 'src/shared/services/data-recording/data-recording.service';
import { DataService } from 'src/shared/services/data/data.service';
import { QueryDateService } from 'src/shared/services/query-builder/common/query-date.service';
import { ReportBuilderService } from 'src/shared/services/query-builder/common/report-builder.service';
import { TradeDataService } from 'src/shared/services/trade-data/trade-data.service';
import { CreditReportQuery } from '../../interfaces/credit-report-query.interface';
import { CreditTextSubstitutionMap } from '../../interfaces/credit-text-substitution.interface';
import { CreditData } from '../../models/credit-data.model';
import { CreditCsvToObjectsService } from '../credit-csv-to-objects/credit-csv-to-objects.service';
import { CreditGridDataService } from '../credit-grid-data/credit-grid-data.service';
import { CreditPrestoQueryDataService } from '../credit-presto-query-data/credit-presto-query-data.service';
import { CreditQueryInputService } from '../credit-query-input/credit-query-input.service';
import { CreditStoreService } from '../credit-store.service';

@Injectable({
  providedIn: 'root',
})
export class CreditDataService extends DataService {
  portfolioString = '';
  reportDate = new Date();
  updateBuffering = true;
  override isAdmin = this.authService.isAdmin();
  public store = inject(CreditStoreService);

  constructor(
    private queryInputService: CreditQueryInputService,
    private csvToObjects: CreditCsvToObjectsService,
    private dataBufferingService: DataBufferingService<CreditData>,
    private injector: Injector,
    private router: Router,
    private creditPrestoQueryDataService: CreditPrestoQueryDataService,
    private reportBuilderService: ReportBuilderService,
    private queryDateService: QueryDateService,
    private creditGridDataService: CreditGridDataService,
    private tradeDataService: TradeDataService,
  ) {
    super();
    this.dataBufferingService.dataUpdate$.subscribe(this.pushUpdate.bind(this));

    // @todo: populate the indicators for the trade panel
    this.tradeDataService.trackLatencyStats = false;
    this.tradeDataService.defaultAggregatedIndicators = {
      'Security.BondPV01': false,
    };
  }

  onHierarchyChange(portfolioString: string, date: Date) {
    this.closeEventConnection();
    this.portfolioString = portfolioString;
    this.reportDate = date;
    if (portfolioString !== '') {
      this.fetchData();
    }
  }

  closeConnectionAndFetch() {
    this.closeEventConnection();
    this.fetchData();
  }

  fetchData(softRefresh = false) {
    this.stopAllRunningQueries('fetchData', false);
    if (softRefresh) {
      this.store.fetchStarted(false);
    } else {
      this.store.fetchStarted(true);
    }

    this.unitRiskReloaded = false;

    this.creditPrestoQueryDataService.checkIfReportIsSaved().subscribe((isValid: boolean) => {
      if (!isValid) {
        this.router.navigate(['settings']);
        return;
      }
      const reportQuery = this.getQuery();
      if (!reportQuery) return;
      let isLiveData = this.queryInputService.isLiveData();
      this.lastQueryUuid = this.queryHistoryStore.pushQuery(
        reportQuery,
        QueryType.CreditView,
        isLiveData,
      );

      if (isLiveData) {
        this.fetchContinuousData(reportQuery);
      } else {
        this.fetchOneTimeData(reportQuery, softRefresh);
      }
    });
  }

  fetchOneTimeData(reportQuery: ReportQuery, softRefresh = false) {
    if (softRefresh) {
      this.snackBar.open('Refreshing risk data...', 'X', { duration: 0 });
    }
    this.queryHistoryStore.pushQueryConnectionEvent(this.lastQueryUuid, {
      type: ConnectionEventType.CONNECTING,
      receivedAt: new Date(),
    });
    this.loadingService.updateLoading(
      'fetch-one-time',
      LoadingState.LoadingData,
      softRefresh ? LoadingStateTarget.TOPMENU : LoadingStateTarget.CANVAS,
    );
    this.oneTimeQueryRequest$ = this.getOneTimeDataFromHttp(reportQuery)
      .pipe(
        finalize(() => {
          if (softRefresh) {
            this.snackBar.dismiss();
          }
        }),
      )
      .subscribe((response: ReportResponse) => {
        const receivedAt = new Date();
        this.oneTimeQueryRequest$ = undefined;
        console.debug('#RESPONSE fetch-one-time - data loaded');
        this.loadingService.updateLoading('fetch-one-time', LoadingState.Idle);
        this.firstSet = true;
        this.trackOnMessageEventInfo(receivedAt, response, this.firstSet);
        if (!response.error) {
          const jsonResult = this.csvToObjects.convert(
            response,
            new GenericObjectFactory(CreditData),
            reportQuery,
          );
          this.firstSet = true;
          this.pushUpdate(jsonResult);
        } else {
          response.error.payload = reportQuery;
          if (!this.processNoDataForDateErrMsg(null, response)) {
            this.openErrorDialog(JSON.stringify(response.error));
          }
        }
      });
  }

  fetchContinuousData(payload: ReportQuery) {
    this.queryHistoryStore.pushQueryConnectionEvent(this.lastQueryUuid, {
      type: ConnectionEventType.CONNECTING,
      receivedAt: new Date(),
    });
    this.firstSet = true;
    this.openEventStream(payload, this.queryInputService);
  }

  eventSourceOnMessage(e: any, payload: ReportQuery) {
    if (this.processNoDataForDateErrMsg(e)) {
      return;
    }

    const receivedAt = new Date();
    if (!this.processEventSourceMeta(e, payload)) {
      return; // An error / empty response was received.
    }

    const csvResult = decode(e.data);
    const parsedResult = JSON.parse(csvResult);
    this.trackOnMessageEventInfo(receivedAt, parsedResult, this.firstSet);

    // Add a response sample to query history, before we do any changes to it
    if (this.firstSet) {
      this.queryHistoryStore.pushQueryResponse(this.lastQueryUuid, parsedResult);
    }

    const jsonResult: CreditData[] = this.csvToObjects.convert(
      structuredClone(parsedResult),
      new GenericObjectFactory(CreditData),
      payload,
    );

    if (this.firstSet && (!jsonResult || jsonResult.length == 0)) {
      this.shouldRetryConnection = false;
      this.openNoDataDialog();
      this.pushUpdate([]);
      console.debug('#CONTINUOUS_QUERY: FIRST_DATA - No data returned.');
      return;
    }

    if (this.queryInputService.userSettings.exportPrestoResponse) {
      const dataRecordingService = this.injector.get(DataRecordingService);
      dataRecordingService.pushData(csvResult);
    }

    if (
      parsedResult.result.warnings.length > 0 &&
      parsedResult.result.warnings.some((x: any) => x.type === 'unit_risk_reload')
    ) {
      this.unitRiskReloaded = true;
    }

    // First update needs to be pushed immediately
    if (this.firstSet || !this.updateBuffering) {
      this.pushUpdate(jsonResult);
      this.creditGridDataService.updateColumns(
        <ResponseHeaderDataType<CreditData>>parsedResult.result.result[0].header,
        payload,
      );
      return;
    }

    // Buffer updates and deliver them deliver opportunistically
    this.dataBufferingService.pushUpdate(jsonResult);

    // Push trade info into the respective service
    if (this.isAdmin) {
      this.tradeDataService.pushTradeData(parsedResult.result.info);
    }
  }

  private processNoDataForDateErrMsg(e: any, alreadyParsedData?: any) {
    let parsedData: any;

    if (alreadyParsedData) parsedData = alreadyParsedData;
    else {
      if (e.event !== 'error') return false;
      const data = decode(e.data);
      parsedData = JSON.parse(data);
    }
    if (parsedData.error.message.toLowerCase().indexOf('no data loaded for date') > -1) {
      this.shouldRetryConnection = false;
      const displayText: Pick<WarningDialogData, 'title' | 'body'> = {
        title: 'No data for this date',
        body: 'There is no data available for this date.<br/><br/>Please edit the date and try again.',
      };
      this.openNoDataDialog(displayText);
      return true;
    }
    return false;
  }

  pushUpdate(intraData: CreditData[]) {
    if (this.firstSet) {
      this.store.reset();
      this.firstSet = false;
    }
    if (intraData.length > 0) {
      this.store.updateCredit(intraData);
    }
  }

  getOneTimeDataFromHttp(query: ReportQuery): Observable<ReportResponse> {
    console.debug('#REQUEST #STATE fetch-one-time RPC ID - ' + query.id);
    let httpOptions = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }),
    };
    return this.http.post<ReportResponse>(
      this.appEnvironmentService.activeEnvironment.appServer,
      query,
      httpOptions,
    );
  }

  setQueryTextSubstitution(value?: CreditTextSubstitutionMap[]) {
    if (!this.queryInputService.userSettings.queryTextSubstitutions) {
      this.queryInputService.userSettings.queryTextSubstitutions = { override: [] };
    }

    const templateId = this.getCurrentTemplateId();
    const savedData = structuredClone(
      this.queryInputService.userSettings.queryTextSubstitutions[templateId],
    );

    this.queryInputService.userSettings.queryTextSubstitutions[templateId] =
      value ||
      this.creditPrestoQueryDataService.getTextSubstitutionDefaultValues(savedData);
  }

  getQueryTextSubstitution(): CreditTextSubstitutionMap[] {
    const templateId = this.getCurrentTemplateId();
    return this.queryInputService.userSettings.queryTextSubstitutions?.[templateId] || [];
  }

  getQuery(): ReportQuery | null {
    const reportTemplate: ReportQuery = this.reportBuilderService.getReportTemplate();
    const prestoQueryString =
      this.creditPrestoQueryDataService.getCurrentPrestoQueryString();
    if (!prestoQueryString) {
      return reportTemplate;
    }

    try {
      const processedQuery = this.applyKeySubstitutions(prestoQueryString);
      const queryDate = this.queryDateService.getQueryDate(this.reportDate);
      const queryDateIndex = 0;
      const queryFilterIndex = 3;

      for (const key in processedQuery.server.queries) {
        const elm = processedQuery.server.queries[key];
        elm[queryDateIndex] = queryDate;
        elm[queryFilterIndex] = `(${this.portfolioString}) AND ${elm[queryFilterIndex]}`;
      }

      delete processedQuery.client;

      reportTemplate.params[0] = {
        ...reportTemplate.params[0],
        ...processedQuery.server,
      };
      const report = this.creditPrestoQueryDataService.currentData();
      reportTemplate.params[0].report_category += report ? '_' + report[0].name : '';
      reportTemplate.params[0].report_category =
        this.reportBuilderService.generateReportCategories(reportTemplate);
      this.creditPrestoQueryDataService.query = reportTemplate;
      return reportTemplate;
    } catch (e: any) {
      this.shouldRetryConnection = false;
      this.handleFatalError(
        e.toString(),
        <any>prestoQueryString,
        'There has been an error parsing the json query.',
        'Json Error',
      );
      this.router.navigate(['settings']);
      return null;
    }
  }

  getMissingRiskQuery() {
    let query = this.getQuery();
    console.log(query);
  }

  override eventSourceError(err: any, payload: ReportQuery) {
    const keywords = ['presto', 'java'];
    if (keywords.some((k) => err?.error?.message?.indexOf(k) > -1)) {
      this.router.navigate(['settings']);
      this.handleFatalError(err, payload);
      throw err;
    } else super.eventSourceError(err, payload);
  }

  getCurrentTemplateId(): string {
    if (
      this.queryInputService.userSettings.queryOverrideEnabled &&
      this.queryInputService.userSettings.queryOverride
    )
      return 'override';
    return this.queryInputService.userSettings.templateId!;
  }

  private applyKeySubstitutions(entry: string): CreditReportQuery {
    const substitutionList = this.getTexSubstitutionList();
    substitutionList.forEach((d) => {
      entry = entry.replace(new RegExp(d.key, 'g'), d.value);
    });

    return <CreditReportQuery>JSON.parse(entry);
  }

  private getTexSubstitutionList() {
    const currency = this.queryInputService.userSettings.reportingCurrency;
    const substitutionList: CreditTextSubstitutionMap[] = [
      { key: '{C}', value: currency, multi: false },
    ];
    const savedQueryTextSubstitution = this.getQueryTextSubstitution();

    if (this.isTextSubstitutionValid(savedQueryTextSubstitution)) {
      substitutionList.push(...savedQueryTextSubstitution);
    } else {
      this.setQueryTextSubstitution();
      substitutionList.push(...this.getQueryTextSubstitution());
    }

    return substitutionList;
  }

  private isTextSubstitutionValid(value: CreditTextSubstitutionMap[]): boolean {
    if (!value.length) return false;
    const textSubstitutions =
      this.creditPrestoQueryDataService.getTextSubstitutionsFromPrestoQueryString();
    if (value.length !== textSubstitutions.length) return false;

    for (const item of textSubstitutions) {
      const texSubMap = value.find((s) => s.key === item.token);
      if (!texSubMap) return false;

      if (item.multi !== texSubMap.multi) return false;

      const valuesToCompare: string[] = item.multi
        ? texSubMap.value.split(',')
        : [texSubMap.value];
      const areSubstitutionValuesUnchanged = valuesToCompare.every((val) =>
        item.substitutionElements
          .map((e: any) => e.substitutionText)
          .some((e: string) => e.trim() === val.trim()),
      );

      if (!areSubstitutionValuesUnchanged) return false;
    }

    return true;
  }
}


/////// Credivgrid 



  private getCurrentReportHash() {
    const reports = this.creditPrestoQueryDataService.currentData();
    return reports?.[0].hash;
  }
