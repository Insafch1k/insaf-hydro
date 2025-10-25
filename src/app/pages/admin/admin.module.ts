import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminRoutingModule } from './admin-routing.module';
import { StructurComponent } from './structur/structur.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  providers: [],
  declarations: [StructurComponent],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AdminRoutingModule],
})
export class AdminModule {}
