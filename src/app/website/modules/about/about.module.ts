import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AboutRoutingModule } from './about-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AboutComponent } from './about/about.component';



@NgModule({
  declarations: [
    AboutComponent
  ],
  imports: [
    CommonModule, AboutRoutingModule, FormsModule, ReactiveFormsModule
  ]
})
export class AboutModule { }
