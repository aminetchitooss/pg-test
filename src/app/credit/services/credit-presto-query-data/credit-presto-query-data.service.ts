import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CreditPrestoQueryDataService {
  getTextSubstitutionsFromPrestoQueryString(
    _includeAll: boolean
  ): { token: string; description: string }[] {
    return [];
  }
}
