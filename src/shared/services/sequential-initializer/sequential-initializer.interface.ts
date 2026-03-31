import { Observable } from 'rxjs';

export interface SequentialInitializerInterface {
  init(): Observable<any>;
}
