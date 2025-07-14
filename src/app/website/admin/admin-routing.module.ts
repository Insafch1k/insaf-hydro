import { NgModule, createComponent } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StructurComponent } from './pages/structur/structur.component';
import { StructureComponent } from './pages/structure/structure.component';

const routes: Routes = [
    {
        path: 'structure',
        component: StructureComponent,
    },
    {
        path: 'structur',
        component: StructurComponent,
    },
    
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class AdminRoutingModule {}
