import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'risk-position', pathMatch: 'full' },
  {
    path: 'grid',
    loadChildren: () => import('./grid/grid.routes').then((m) => m.gridRoutes),
  },
  {
    path: 'risk-position',
    loadChildren: () =>
      import('./risk-position/risk-position.routes').then((m) => m.riskPositionRoutes),
  },
];
