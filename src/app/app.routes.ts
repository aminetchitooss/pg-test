import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'grid', pathMatch: 'full' },
  {
    path: 'grid',
    loadChildren: () => import('./grid/grid.routes').then((m) => m.gridRoutes),
  },
];
