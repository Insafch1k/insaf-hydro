import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DataSchemeService {
  private apiUrl = 'http://api.zgidro.ru/api/map/data_scheme';

  constructor(private http: HttpClient) {}

  getSchemeData(id_scheme: number): Observable<any> {
    return this.http.post<any>(this.apiUrl, { id_scheme });
  }
} 