import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MenuRoutingModule } from './menu-routing.module';
import { MenuComponent } from './menu.component';

@NgModule({
    declarations: [MenuComponent],
    imports: [
        FormsModule,
        ReactiveFormsModule,
        MenuRoutingModule,
    ],
})
export class MenuModule {}
