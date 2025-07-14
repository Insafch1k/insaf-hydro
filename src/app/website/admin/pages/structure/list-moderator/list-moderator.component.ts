import { Component, Input } from '@angular/core';
import { faPlus, faPen } from '@fortawesome/free-solid-svg-icons';
import { IPersonal, ISubdivision } from '../../../models/person.interface';
import { UserService } from '../../../services/user.service';

@Component({
    selector: 'app-list-moderator',
    templateUrl: './list-moderator.component.html',
    styleUrls: [
        './list-moderator.component.scss',
        '../../structure/structure.style.scss',
    ],
})
export class ListModeratorComponent {
    @Input() role!: string;
    @Input() userList: ISubdivision | undefined = undefined;
    @Input() organization!: string | undefined;
    plusIcon = faPlus;
    editIcon = faPen;

    constructor(private userService: UserService) {}

    setUser(user: IPersonal) {
        this.userService.setUser(user);
    }
}
