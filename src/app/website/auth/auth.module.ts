import { NgModule } from '@angular/core';
import { LoginComponent } from './login/login.component';
import { AuthRoutingModule } from './auth-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
    declarations: [LoginComponent],
    imports: [
        FormsModule,
        ReactiveFormsModule,
        AuthRoutingModule,
    ],
})
export class AuthModule {}
