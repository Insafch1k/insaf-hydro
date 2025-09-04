import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class DataSchemeService {
  private apiUrl = 'http://api.zgidro.ru/api/map/data_scheme';
  private deleteUrl = 'http://api.zgidro.ru/api/map/delete_object';

  constructor(private http: HttpClient) {}

  getSchemeData(id_scheme: number): Observable<any> {
    return this.http.post<any>(this.apiUrl, { id_scheme }).pipe(
      catchError((err) => {
        console.error('Ошибка загрузки схемы:', err);
        return throwError(() => new Error('Ошибка загрузки схемы'));
      })
    );
  }

  deleteObjects(
    deletedObjects: { type: string; id: number }[],
    id_scheme: number
  ): Observable<any> {
    const payload = {
      data: {
        type: 'FeatureCollection',
        id_scheme,
        features: deletedObjects.map((obj) => ({
          id: obj.id,
          name_object_type: obj.type,
          type: 'Feature',
          geometry: null,
          properties: {},
        })),
      },
    };
    return this.http.delete(this.deleteUrl, { body: payload }).pipe(
      catchError((err) => {
        console.error('Ошибка при отправке удалённых объектов:', err);
        return throwError(
          () => new Error('Ошибка при отправке удалённых объектов')
        );
      })
    );
  }

  createObjects(payload: any): Observable<any> {
    return this.http
      .post('http://api.zgidro.ru/api/map/create_object', payload)
      .pipe(
        catchError((err) => {
          console.error('Ошибка при отправке созданных объектов:', err);
          return throwError(
            () => new Error('Ошибка при отправке созданных объектов')
          );
        })
      );
  }
}
