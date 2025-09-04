import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-structur',
  templateUrl: './structur.component.html',
  styleUrls: ['./structur.component.scss'],
})
export class StructurComponent {
  constructor(private authService: AuthService, private router: Router) {}
  onLogout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
