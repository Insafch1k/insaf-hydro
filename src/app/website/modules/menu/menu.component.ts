import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent implements OnInit {
    objects: any[] = [];

    ngOnInit() {
        const schemes = localStorage.getItem('schemes');
        if (schemes) {
            this.objects = JSON.parse(schemes).map((scheme: any) => ({
                id: scheme.id_scheme,
                title: scheme.name_scheme,
                city: '',
                date: '',
                creator: '',
                img: 'assets/data/images/map-object.png'
            }));
        } else {
            // Заглушка, если схем нет
            this.objects = [];
        }
    }
}
