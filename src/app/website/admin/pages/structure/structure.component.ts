import { Component } from '@angular/core';

@Component({
  selector: 'app-structure',
  templateUrl: './structure.component.html',
  styleUrls: ['./structure.component.scss']
})
export class StructureComponent {
  orgOpen = true;
  depOpen = true;

  toggleOrg() {
    this.orgOpen = !this.orgOpen;
  }

  toggleDep() {
    this.depOpen = !this.depOpen;
  }
}