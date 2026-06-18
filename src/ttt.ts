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
    const savedData = this._listData$.getValue();
    if (!savedData) return this.emptyDataError();

    const nextData = [...savedData, entry];

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

    return this.updateDataRegistry(queries, nextData);
  }

  deleteById(id: string): Observable<ReportResponse> {
    const savedData = this._listData$.getValue();
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
    const previousData = this._listData$.getValue();
    this._listData$.next(nextData);

    const { registryQuery, dataQuery } = queries;
    registryQuery.params.push(nextData);

    return this.getOneTimeDataFromHttp(registryQuery).pipe(
      mergeMap(() => this.getOneTimeDataFromHttp(dataQuery)),
      catchError((err) => {
        this._listData$.next(previousData);
        return throwError(() => err);
      })
    );
  }
}
