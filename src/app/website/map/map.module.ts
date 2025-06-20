import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MapComponent } from './map/map.component';
import { MapRoutingModule } from './map-routing.module';
import { MapHeaderComponent } from './components/map-header/map-header.component';
import { MapMenuComponent } from './components/map-menu/map-menu.component';
import { LeftHeaderComponent } from './components/left-header/left-header.component';
import { PassportComponent } from './passport/passport.component';



@NgModule({
  declarations: [
    MapComponent,
    MapHeaderComponent,
    MapMenuComponent,
    LeftHeaderComponent,
    PassportComponent,
  ],
  imports: [
    CommonModule, MapRoutingModule, FormsModule, ReactiveFormsModule
  ]
})
export class MapModule { }
