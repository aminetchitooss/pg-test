import { InjectionToken } from '@angular/core';
import type { MmuRiskApiPort } from '../models/ports';

export const MMU_RISK_API = new InjectionToken<MmuRiskApiPort>('MMU_RISK_API');
