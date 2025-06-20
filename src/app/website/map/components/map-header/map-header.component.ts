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

    constructor() {
        this.currentScheme = JSON.parse(
            localStorage.getItem('current_scheme')!
        ).name_scheme;
    }

    onMouseEnter(index: number) {
        this.mapListClose[index] = true;
    }

    onMouseLeave(index: number) {
        this.mapListClose[index] = false;
    }
}
