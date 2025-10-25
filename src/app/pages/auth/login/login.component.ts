import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  userData = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(4),
      Validators.maxLength(20),
    ]),
  });
  error: string | null = null;

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit() {
    if (this.userData.invalid) return;
    const { email, password } = this.userData.value;
    this.auth.login(email!, password!).subscribe({
      next: (res) => {
        if (res.success) {
          localStorage.setItem('schemes', JSON.stringify(res.schemes));
          localStorage.setItem(
            'access_token',
            res.аccess_token || res.access_token
          );
          this.router.navigate(['/menu']);
        } else {
          this.error = 'Неверный логин или пароль';
        }
      },
      error: () => {
        this.error = 'Ошибка авторизации';
      },
    });
  }
}
