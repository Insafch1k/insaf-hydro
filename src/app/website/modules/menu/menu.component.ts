import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss']
})
export class MenuComponent implements OnInit {
    objects: any[] = [];

    constructor(private authService: AuthService, private router: Router) {}

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

    onLogout() {
        this.authService.logout();
        this.router.navigate(['/auth/login']);
    }

    onSelectScheme(scheme: any) {
        this.router.navigate(['/map'], { state: { id_scheme: scheme.id } });
    }
}
