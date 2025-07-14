import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MainComponent } from './website/shared/pages/main/main.component';
import { HeaderComponent } from './website/shared/layout/header/header.component';
import { AboutModule } from './website/modules/about/about.module';

@NgModule({
  declarations: [
    AppComponent,
    MainComponent,
    HeaderComponent,

  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    AboutModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
