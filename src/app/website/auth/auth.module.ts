import { NgModule } from '@angular/core';
import { LoginComponent } from './login/login.component';
import { AuthRoutingModule } from './auth-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
    declarations: [LoginComponent],
    imports: [
        FormsModule,
        ReactiveFormsModule,
        AuthRoutingModule,
        HttpClientModule,
    ],
})
export class AuthModule {}
