import { bootstrapApplication } from '@angular/platform-browser';
import {
  CellStyleModule,
  ClientSideRowModelModule,
  CsvExportModule,
  DateFilterModule,
  ModuleRegistry,
  NumberEditorModule,
  NumberFilterModule,
  PaginationModule,
  RowSelectionModule,
  RowStyleModule,
  TextEditorModule,
  TextFilterModule,
  ValidationModule,
} from 'ag-grid-community';
import {
  CellSelectionModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  IntegratedChartsModule,
  LicenseManager,
  PivotModule,
  RichSelectModule,
  RowGroupingModule,
  SetFilterModule,
  SideBarModule,
  StatusBarModule,
} from 'ag-grid-enterprise';
import { appConfig } from './app/app.config';
import { App } from './app/app';

ModuleRegistry.registerModules([
  // Community
  CellStyleModule,
  ClientSideRowModelModule,
  CsvExportModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  PaginationModule,
  TextEditorModule,
  NumberEditorModule,
  RowSelectionModule,
  RowStyleModule,
  ValidationModule,

  // Enterprise
  SetFilterModule,
  SideBarModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  StatusBarModule,
  CellSelectionModule,
  IntegratedChartsModule,
  RichSelectModule,
  RowGroupingModule,
  PivotModule,
]);

// TODO: Replace with your AG Grid Enterprise license key
// LicenseManager.setLicenseKey('YOUR_LICENSE_KEY');

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
