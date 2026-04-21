import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideMmuRiskApi } from './mmu-risk/services/mmu-risk-api.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(),
    // Per-endpoint mock/http routing lives in mmu-risk-api.provider.ts → MMU_RISK_API_ROUTING.
    provideMmuRiskApi(),
  ],
};
