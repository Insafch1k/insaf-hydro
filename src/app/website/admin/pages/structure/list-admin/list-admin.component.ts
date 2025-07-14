import { Component, Input } from '@angular/core';
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons';
import { IOrganization } from '../../../models/person.interface';

@Component({
    selector: 'app-list-admin',
    templateUrl: './list-admin.component.html',
    styleUrls: [
        './list-admin.component.scss',
        '../../structure/structure.style.scss',
    ],
})
export class ListAdminComponent {
    @Input() role!: string;
    @Input() organization: IOrganization | undefined = undefined;
    downIcon = faChevronDown;
    upIcon = faChevronUp;

    isOpenStruct: boolean[] = [];

    ngOnInit(): void {
        this.isOpenStruct = new Array(
            this.organization?.subdivisions.length
        ).fill(false);
    }

    // Desc: метод открывает открывет список с подразделениями
    // Input: index - индекс в списке подразделении
    // Output: изменяет значение на противоположное(true/false) для опредененной вкладки
    // Author: Gosman
    confirmation(index: number): void {
        this.isOpenStruct[index] = !this.isOpenStruct[index];
    }
}
