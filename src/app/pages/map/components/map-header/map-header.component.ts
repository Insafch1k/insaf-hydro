import { Component } from '@angular/core';

@Component({
  selector: 'app-map-header',
  templateUrl: './map-header.component.html',
  styleUrls: ['./map-header.component.scss'],
})
export class MapHeaderComponent {
  mapList: string[] = ['Qazan', 'Азнакаево', 'Балтач', 'Апас', 'Квартала'];
  mapListClose: boolean[] = [false, false, false, false, false];
  currentScheme: string = '';
  activePopup: string | null = null;

  constructor() {
    const schemeRaw = localStorage.getItem('current_scheme');
    if (schemeRaw) {
      this.currentScheme = JSON.parse(schemeRaw).name_scheme;
    } else {
      this.currentScheme = '';
    }
  }

  onMouseEnter(index: number) {
    this.mapListClose[index] = true;
  }

  onMouseLeave(index: number) {
    this.mapListClose[index] = false;
  }

  openPopup(type: string) {
    this.activePopup = type;
  }

  closePopup() {
    this.activePopup = null;
  }
}
