import { Component, Input } from '@angular/core';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { IOrganization } from '../../../models/person.interface';

@Component({
    selector: 'app-list-superadmin',
    templateUrl: './list-superadmin.component.html',
    styleUrls: [
        './list-superadmin.component.scss',
        '../../structure/structure.style.scss',
    ],
})
export class ListSuperadminComponent {
    @Input() role!: string;
    @Input() struct!: IOrganization[];
    downIcon = faChevronDown;
    upIcon = faChevronUp;

    constructor() {}

    isOpenStruct: boolean[] = [];

    ngOnInit(): void {
        this.isOpenStruct = new Array(this.struct.length).fill(false);
    }

    // Desc: метод открывает открывет список с подразделениями
    // Input: index - индекс в списке подразделении
    // Output: изменяет значение на противоположное(true/false) для опредененной вкладки
    // Author: Gosman
    confirmation(index: number): void {
        this.isOpenStruct[index] = !this.isOpenStruct[index];
    }
}
