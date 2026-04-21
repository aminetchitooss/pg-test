import type { ReportV4Request } from './model';

export function createDefaultReportV4Request(): ReportV4Request {
  return {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'report_v4',
    params: [],
  };
}
