import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainComponent } from './website/shared/pages/main/main.component';
import { AboutComponent } from './website/modules/about/about/about.component';
import { MapComponent } from './website/map/map/map.component';



const routes: Routes = [
  {
    path: '',
    component: MapComponent,
    title: 'main',
},
{
  path: 'map',
  loadChildren: () =>
      import('./website/map/map.module').then(
          (m) => m.MapModule
      ),
  title: 'map',
},
{
  path: '**',
  component: MainComponent,
  redirectTo: '',
},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { 

}
