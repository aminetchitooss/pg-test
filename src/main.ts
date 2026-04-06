import { bootstrapApplication } from '@angular/platform-browser';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule, LicenseManager } from 'ag-grid-enterprise';
import { appConfig } from './app/app.config';
import { App } from './app/app';

ModuleRegistry.registerModules([AllCommunityModule, AllEnterpriseModule]);

// TODO: Replace with your AG Grid Enterprise license key
// LicenseManager.setLicenseKey('YOUR_LICENSE_KEY');

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
