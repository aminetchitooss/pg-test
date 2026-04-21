import { Provider } from '@angular/core';
import type { MmuRiskApiPort } from '../contracts/ports';
import { HttpMmuRiskApiService } from './http-mmu-risk-api.service';
import { MockMmuRiskApiService } from './mock-mmu-risk-api.service';
import { MMU_RISK_API } from './mmu-risk-api.token';

type Impl = 'mock' | 'http';

// To flip an endpoint from mock to real, change its value to 'http'.
export const MMU_RISK_API_ROUTING: Record<keyof MmuRiskApiPort, Impl> = {
  getUserMappings: 'mock',
  getRisk: 'mock',
  getInputs: 'mock',
  exportPositions: 'mock',
};

export function provideMmuRiskApi(): Provider {
  return {
    provide: MMU_RISK_API,
    useFactory: (mock: MockMmuRiskApiService, http: HttpMmuRiskApiService): MmuRiskApiPort => {
      const impls: Record<Impl, MmuRiskApiPort> = { mock, http };
      const hybrid: Record<string, unknown> = {};
      for (const method of Object.keys(MMU_RISK_API_ROUTING)) {
        const target = impls[MMU_RISK_API_ROUTING[method as keyof MmuRiskApiPort]] as unknown as Record<
          string,
          (...args: unknown[]) => unknown
        >;
        hybrid[method] = target[method].bind(target);
      }
      return hybrid as unknown as MmuRiskApiPort;
    },
    deps: [MockMmuRiskApiService, HttpMmuRiskApiService],
  };
}
