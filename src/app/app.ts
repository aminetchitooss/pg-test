import { Component, signal } from '@angular/core';
import { CreditJsonEditorComponent } from "./credit/components/credit-json-editor/credit-json-editor.component";
import { FormsModule } from "@angular/forms";

@Component({
  selector: 'app-root',
  imports: [CreditJsonEditorComponent, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('pg-test');
  test =""
}
